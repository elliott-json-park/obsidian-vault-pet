// 리캡 카드 숫자 (데스크톱판 8차 recap.js 의 옵시디언판): 한 기간(이번 달 · 지난달 · 처음부터) 동안 같이 쓴 기록을 센다.
// 자랑 카드(kit/house.js 의 drawCard)가 이걸로 칸을 채운다. 어떤 칸을 넣을지는 사용자가 고른다 (settings.cardPrefs).
// 플러그인의 사용량 기록(폴더 × 시간 버킷)만 쓴다. 노트 내용은 원래 없다. 폴더는 개수와 가장 많이 쓴 폴더 이름(지금 볼트 이름으로 맞춘 것)만 낸다.
// 옵시디언 없이 도는 순수 JS 라 tests/run.js 가 직접 돌린다
const { coinsForDay } = require('./shop');
const { xpOf, levelOf, MAX_LEVEL } = require('./growth');
const { hourKeyToMs } = require('./usage');

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const KINDS = ['month', 'last', 'all'];

// 기간: month = 이번 달 1일 ~ 지금, last = 지난달 한 달, all = 처음부터 지금까지
function periodOf(kind, now = Date.now()) {
  const d = new Date(now);
  if (kind === 'last') {
    const from = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const to = new Date(d.getFullYear(), d.getMonth(), 1);
    return { kind, from: from.getTime(), to: to.getTime(), year: from.getFullYear(), month: from.getMonth() + 1 };
  }
  if (kind === 'all') return { kind, from: 0, to: now + 1, year: d.getFullYear(), month: d.getMonth() + 1 };
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  return { kind: 'month', from: from.getTime(), to: now + 1, year: from.getFullYear(), month: from.getMonth() + 1 };
}

// 하루씩 이어서 쓴 가장 긴 날 수 (days 는 'YYYY-MM-DD' 목록)
function longestStreak(days) {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of sorted) {
    const [y, m, dd] = k.split('-').map(Number);
    const t = new Date(y, m - 1, dd).getTime();
    run = prev != null && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = t;
  }
  return best;
}

// usage: core/usage 의 UsageTracker (뺀 폴더는 빼고 본다)
// opts: { startedAt 처음 만난 시각, bonus [{at, xp}], achievements {id: 딴 시각}, folderName(id) → 이름 | null, now }
function recap(usage, kind = 'month', opts = {}) {
  const now = opts.now || Date.now();
  const P = periodOf(KINDS.includes(kind) ? kind : 'month', now);
  const startedAt = opts.startedAt || 0;
  const inRange = (ms) => ms >= P.from && ms < P.to;
  const fromStart = (ms) => !startedAt || ms >= startedAt - 3_600_000;

  const sum = { c: 0, l: 0, n: 0, s: 0 };
  const hours = new Array(24).fill(0);
  const daily = {}; // 'YYYY-MM-DD' → { c, e }
  // 경험치 · 레벨 변화: 처음 만난 뒤 기록만 (성장과 같은 기준)
  const before = { c: 0, l: 0, n: 0, s: 0 };
  const during = { c: 0, l: 0, n: 0, s: 0 };
  const byFolder = {};
  for (const [id, p] of Object.entries((usage.data && usage.data.projects) || {})) {
    if (usage.excluded && usage.excluded.has(id)) continue;
    for (const [key, b] of Object.entries(p.buckets || {})) {
      const t = hourKeyToMs(key);
      const add = (o) => {
        o.c += b.c || 0;
        o.l += b.l || 0;
        o.n += b.n || 0;
        o.s += b.s || 0;
      };
      if (startedAt && fromStart(t) && t < P.from) add(before);
      if (!inRange(t)) continue;
      if (fromStart(t)) add(during);
      add(sum);
      hours[Number(key.slice(11, 13))] += b.e || 0;
      const day = key.slice(0, 10);
      const row = (daily[day] ||= { c: 0, e: 0 });
      row.c += b.c || 0;
      row.e += b.e || 0;
      if (b.e || b.c) byFolder[id] = (byFolder[id] || 0) + (b.c || 0) + 1;
    }
  }

  const days = Object.keys(daily).filter((k) => daily[k].c || daily[k].e);
  let busiest = null;
  for (const k of days) if (!busiest || daily[k].c > busiest.c) busiest = { day: k, c: daily[k].c };
  const peak = hours.some(Boolean) ? hours.indexOf(Math.max(...hours)) : null;
  const favId = Object.entries(byFolder).sort((a, b) => b[1] - a[1])[0];
  // 코인: 처음 만난 날부터, 하루씩 계단식 (shop.coinsSince 와 같은 셈)
  const startDay = startedAt ? dayKey(new Date(startedAt)) : '';
  const coins = Object.entries(daily).reduce((a, [k, r]) => a + (k >= startDay ? coinsForDay(r.c) : 0), 0);
  const bonus = opts.bonus || [];
  const bonusBefore = bonus.filter((b) => b.at >= startedAt && b.at < P.from).reduce((a, b) => a + (b.xp || 0), 0);
  const bonusDuring = bonus.filter((b) => b.at >= startedAt && inRange(b.at)).reduce((a, b) => a + (b.xp || 0), 0);
  const xpBefore = startedAt && P.from > startedAt ? xpOf(before) + bonusBefore : 0;
  const xpGained = xpOf(during) + bonusDuring;
  const ach = Object.values(opts.achievements || {}).filter((at) => typeof at === 'number' && inRange(at)).length;

  return {
    ...P,
    written: sum.c,
    links: sum.l,
    notes: sum.n,
    sessions: sum.s,
    activeDays: days.length,
    streak: longestStreak(days),
    busiest, // { day, c } 가장 많이 쓴 날
    peakHour: peak,
    favFolder: favId && opts.folderName ? opts.folderName(favId[0]) : null,
    folders: Object.keys(byFolder).length,
    coins,
    xp: xpGained,
    levelFrom: Math.min(MAX_LEVEL, levelOf(xpBefore)),
    levelTo: Math.min(MAX_LEVEL, levelOf(xpBefore + xpGained)),
    achievements: ach,
    daily: Object.fromEntries(Object.entries(daily).map(([k, r]) => [k, r.c])),
  };
}

// 카드에 고를 수 있는 것 (kit/house.js 의 카드 편집과 같은 목록)
const CARD_CELLS = ['written', 'links', 'notes', 'sessions', 'days', 'streak', 'busiest', 'peak', 'folder', 'coins', 'achievements', 'level', 'xp', 'folders'];
const CARD_THEMES = ['cream', 'night', 'mint', 'sakura'];
const CARD_POSES = ['idle', 'thinking', 'waiting', 'sleeping'];
const CARD_MAX_CELLS = 6;
const CARD_CAPTION = 40;

// 하우스가 보낸 카드 설정을 모양대로 거른다. 모르는 값은 버리고 기본으로
function cleanCardPrefs(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const out = {};
  if (['post', 'story'].includes(p.format)) out.format = p.format;
  if (KINDS.includes(p.period)) out.period = p.period;
  if (Array.isArray(p.cells)) out.cells = [...new Set(p.cells.filter((c) => CARD_CELLS.includes(c)))].slice(0, CARD_MAX_CELLS);
  if (CARD_THEMES.includes(p.theme)) out.theme = p.theme;
  if (CARD_POSES.includes(p.pose)) out.pose = p.pose;
  if (typeof p.caption === 'string') out.caption = p.caption.replace(/\s+/g, ' ').slice(0, CARD_CAPTION);
  for (const k of ['grass', 'name', 'level', 'title']) if (typeof p[k] === 'boolean') out[k] = p[k];
  return out;
}

module.exports = { recap, periodOf, longestStreak, KINDS, CARD_CELLS, CARD_THEMES, CARD_POSES, CARD_MAX_CELLS, CARD_CAPTION, cleanCardPrefs };
