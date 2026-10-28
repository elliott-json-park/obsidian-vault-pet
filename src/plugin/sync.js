'use strict';
/*
 * 여러 기기 합치기 (1.5.1).
 *
 * 옵시디언 Sync · iCloud 로 두 기기가 한 볼트를 쓰면 data.json 하나를 서로 덮어썼다. 나중에 저장한 쪽이 이겨서
 * 다른 기기에서 산 물건 · 딴 업적 · 코인이 사라졌다. 이제 밖에서 data.json 이 바뀌면(onExternalSettingsChange)
 * 다시 읽어 지금 것과 합친다.
 *
 * 공통 조상: 기기마다 이름(dev)이 있고, 저장할 때 meta.sync[dev] 에 판 번호(rev, 저장 시각)를 적는다.
 * 남이 쓴 파일의 meta.sync[나] 는 '그 기기가 마지막으로 받은 내 판'이다. 그 판을 기억하고 있으면(history)
 * 그게 공통 조상이고, 3방향으로 합친다.
 *   - 내가 안 바꾼 칸은 상대 값, 상대가 안 바꾼 칸은 내 값 (한 기기를 쉬게 두고 다른 기기를 쓰면 그대로 넘어온다)
 *   - 둘 다 바꾼 칸만 칸마다 정한 규칙: 횟수 · 코인은 양쪽에서 늘어난 만큼 더하고, 물건 · 업적은 합집합 …
 * 조상을 모르면(상대가 오래 오프라인, 1.5.0 이하 기기) 잃지 않는 쪽으로 합친다.
 *   - 횟수 · 코인은 큰 쪽, 물건 · 업적은 합집합, 설정은 내 것
 *   - 1.5.0 이하 기기의 사용량은 섞지 않는다 (그 기기는 이 기기의 글을 자기 것으로 다시 세어 두었다)
 *
 * 기기마다 따로인 것(DEVICE)은 합치지 않는다: 고양이 자리 · 하우스 자리 · 저전력 · 방해 금지 · 집중 시간 · 말풍선 기억 …
 * 밥 게이지 · 마지막 끼니(TIMED)는 시각으로 고르고, 판 번호를 올리지 않는다 (가만있어도 매분 바뀐다).
 */

const DEVICE_SETTINGS = ['position', 'showPet', 'houseInSidebar', 'lowPower'];
const DEVICE_STATE = [
  'quietUntil', 'focus', 'focusQuiet', 'focusBreak', 'lastVersion', 'whatsNew', 'ui', 'lineMemory', 'brainDaily',
  'pending', 'replies', 'recapNudged', 'refundNote', 'toyOffers', 'lastFood', 'lastMeal',
];
const TIMED_STATE = ['gauge', 'life'];
const HISTORY_MAX = 12;
const FOOD_DROP_PER_HOUR = 25; // core/gauge.js 와 같다
const HOUR = 3600_000;

/* ── 비교 · 복사 ── */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// 같은 값인가 (객체는 키 순서와 상관없이)
function same(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same(a[k], b[k]));
}

const omit = (o, keys) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !keys.includes(k)));

// 판 번호를 정할 때 보는 몫: 기기마다 따로인 것 · 시각으로 고르는 것을 뺀 settings · state · usage
function sharedOf(raw) {
  const r = raw || {};
  return { settings: omit(r.settings, DEVICE_SETTINGS), state: omit(r.state, [...DEVICE_STATE, ...TIMED_STATE]), usage: r.usage || {} };
}

// 합친 뒤 메모리에 다시 넣을 몫 (판 번호 몫 + 밥 게이지 · 끼니)
function liveOf(raw) {
  const s = sharedOf(raw);
  for (const k of TIMED_STATE) s.state[k] = ((raw || {}).state || {})[k];
  return s;
}

function vvOf(raw) {
  const s = raw && raw.meta && raw.meta.sync;
  return isObj(s) ? s : {};
}

/* ── 칸마다 규칙 ──
 * 둘 다 바꿨을 때(exact) 또는 조상을 모를 때(!exact) 쓰는 규칙. b = 조상 (모르면 undefined)
 */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const SUM = { t: 'sum' };
const MAX = { t: 'max' };
const MIN_NZ = { t: 'minNz' };
const OR = { t: 'or' };
const LOCAL = { t: 'local' };
const DEVICE = { t: 'device' };
const mapOf = (each) => ({ t: 'map', each });
const objOf = (fields, rest = LOCAL) => ({ t: 'obj', fields, rest });
const unionOf = (key, limit) => ({ t: 'union', key, limit });
const custom = (fn) => ({ t: 'fn', fn });

// 노트 기록 [최고 글자, 최고 링크, mtime, 새 노트로 셌나, ...기능 최고값, 최고 단어] — 칸마다 큰 쪽
const FILE_REC = custom((b, l, r) => {
  if (!Array.isArray(l)) return r;
  if (!Array.isArray(r)) return l;
  const out = [];
  for (let i = 0; i < Math.max(l.length, r.length); i++) {
    if (l[i] === undefined) out[i] = r[i];
    else if (r[i] === undefined) out[i] = l[i];
    else out[i] = Math.max(num(l[i]), num(r[i]));
  }
  return out;
});

const BUCKET = objOf({ c: SUM, w: SUM, l: SUM, n: SUM, s: SUM, v: SUM, e: SUM, t: mapOf(SUM) }, SUM);

const USAGE = objOf({
  files: mapOf(FILE_REC),
  gone: mapOf(FILE_REC),
  projects: mapOf(objOf({ buckets: mapOf(BUCKET), last: MAX })),
  lastEdit: MAX,
  lastBurst: MAX,
  firstAt: MIN_NZ,
});

// 숫자는 모두 더하는 표 (purchaseStats: 평생 구매 기록. v 는 형식 번호라 큰 쪽)
const DEEP_SUM = custom((b, l, r, ctx) => deepNum(b, l, r, ctx, 'sum'));
const DEEP_MAX = custom((b, l, r, ctx) => deepNum(b, l, r, ctx, 'max'));
function deepNum(b, l, r, ctx, how) {
  if (l === undefined) return r;
  if (r === undefined) return l;
  if (typeof l === 'number' && typeof r === 'number') return how === 'sum' ? rule(SUM, b, l, r, ctx) : Math.max(l, r);
  if (isObj(l) && isObj(r)) {
    const out = {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) out[k] = deepNum(isObj(b) ? b[k] : undefined, l[k], r[k], ctx, how);
    return out;
  }
  return l;
}

// 밥 게이지: 둘 다 지금 시각까지 줄여 보고 많은 쪽 (어느 기기에서 먹였든 남는다).
// 상대 쪽이 뚜렷이 많을 때만 바꾼다 — 시각만 다른 같은 게이지로 두 기기가 서로 다시 쓰지 않게
function foodNow(g, now) {
  if (!isObj(g) || typeof g.food !== 'number') return -1;
  const openH = Math.max(0, Math.min(24 * HOUR, now - Math.max(g.at || now, g.foodLockUntil || 0))) / HOUR;
  return Math.max(0, Math.min(100, g.food - FOOD_DROP_PER_HOUR * openH));
}
const GAUGE = custom((b, l, r, ctx) => {
  const fl = foodNow(l, ctx.now);
  const fr = foodNow(r, ctx.now);
  if (fl < 0) return r;
  if (fr < 0) return l;
  const lock = Math.max(l.foodLockUntil || 0, r.foodLockUntil || 0);
  if (fr <= fl + 0.5 && lock === (l.foodLockUntil || 0)) return l;
  return { food: Math.max(fl, fr), at: ctx.now, foodLockUntil: lock };
});
// 마지막 끼니: 늦게 먹은 쪽
const LIFE = custom((b, l, r) => (!isObj(l) ? r : !isObj(r) ? l : num(r.fedAt) > num(l.fedAt) ? r : l));
// 오늘 퀘스트: 같은 묶음이면 받은 보상은 합집합, 다른 묶음이면 늦게 뽑은 쪽
const QUESTS = custom((b, l, r) => {
  if (!isObj(l)) return r;
  if (!isObj(r)) return l;
  if (l.id !== r.id) return num(r.at) > num(l.at) ? r : l;
  return { ...l, claimed: [...new Set([...(l.claimed || []), ...(r.claimed || [])])] };
});
// 홈의 할 일 (2.0.0, core/todos.js): id 로 합친다. 같은 할 일은 늦게 고친 쪽, 어느 쪽이든 지운 할 일(todoTomb)은 뺀다.
// 순서는 내 목록 순서에 상대에만 있는 것을 뒤에 붙인다
const TODOS = custom((b, l, r, ctx) => {
  if (!Array.isArray(l)) return r;
  if (!Array.isArray(r)) return l;
  const gone = new Set([...(ctx.tombs || [])]);
  const theirs = new Map(r.filter(isObj).map((x) => [x.id, x]));
  const out = [];
  for (const x of l.filter(isObj)) {
    const y = theirs.get(x.id);
    theirs.delete(x.id);
    out.push(y && num(y.up) > num(x.up) ? y : x);
  }
  out.push(...theirs.values());
  return out.filter((x) => !gone.has(x.id));
});
// [날짜, 그날 횟수] 짝: 늦은 날 쪽, 같은 날이면 횟수를 합친다
const dayPair = (dayKey, countKey) => (b, l, r, ctx) => {
  const dl = l[dayKey] || '';
  const dr = r[dayKey] || '';
  if (!dl && !dr) return {};
  if (dl !== dr) return dr > dl ? { [dayKey]: r[dayKey], [countKey]: r[countKey] } : { [dayKey]: l[dayKey], [countKey]: l[countKey] };
  const bb = b && b[dayKey] === dl ? b[countKey] : 0;
  return { [dayKey]: l[dayKey], [countKey]: rule(SUM, bb, l[countKey], r[countKey], ctx) };
};

const byJson = (x) => JSON.stringify(x);
const pad = (n) => String(n).padStart(2, '0');
const dayOfMs = (ms) => {
  const d = new Date(num(ms));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// 보너스 XP 한 줄이 '같은 보상'인가. 두 기기가 따로 같은 보상을 줬으면 한 줄만 남긴다
//  업적은 평생 한 번, 출석 · 하루 목표 · 퀘스트 다 깨기는 하루 한 번, 퀘스트는 그날 그 퀘스트 한 번.
//  집중 시간은 하루에 여러 번이고 기기마다 따로라 줄마다 다르다
function bonusKey(x) {
  const w = (x && x.why) || {};
  const day = dayOfMs(x && x.at);
  switch (w.k) {
    case 'bonus.ach':
      return `ach|${JSON.stringify(w.v)}`;
    case 'bonus.goalW':
    case 'bonus.goalC':
      return `goal|${day}`;
    case 'bonus.attend':
    case 'bonus.allclear':
      return `${w.k}|${day}`;
    case 'bonus.quest':
      return `quest|${JSON.stringify(w.v)}|${day}`;
    default:
      return byJson(x);
  }
}
const STATE = objOf({
  // 코인 · 별 · 횟수: 양쪽에서 늘어난 만큼
  walletSpent: SUM, walletBonus: SUM, starsSpent: SUM, questsDone: SUM, pokes: SUM, mealsTaken: SUM, restsTaken: SUM,
  pantry: mapOf(SUM), cnt: mapOf(SUM),
  focusStats: objOf({ n: SUM, min: SUM, last: MAX }),
  purchaseStats: objOf({ v: MAX }, DEEP_SUM),
  // 한 번 오르면 안 내려가는 것
  lastLevel: MAX, lastStage: MAX, stageScheme: MAX, starsPaid: MAX, maxStreakMin: MAX, attendDay: MAX, mealDay: MAX, restDay: MAX, earlyDay: MAX,
  goalLog: mapOf(MAX), toyRecords: DEEP_MAX,
  startedAt: MIN_NZ,
  greeted: OR, onboarded: OR, initialized: OR, bubbleSplit: OR, keyFix1004: OR, keyFix1009: OR, v2: OR,
  // 모으는 것: 합집합
  items: unionOf(String),
  retiredPaid: unionOf(String),
  todoTomb: unionOf(String, 200),
  bonus: unionOf(bonusKey),
  purchases: unionOf((p) => `${p.at}|${p.key}|${p.price}`, 300),
  starLog: unionOf((p) => `${p.at}|${p.key}`, 200),
  achievements: mapOf({ t: 'min' }),
  rewarded: mapOf(OR), achRetro: mapOf(OR), achNoCoins: mapOf(OR), streakGifts: mapOf(OR),
  questSet: QUESTS,
  todos: TODOS,
  gauge: GAUGE,
  life: LIFE,
  ...Object.fromEntries(DEVICE_STATE.map((k) => [k, DEVICE])),
});
const SETTINGS = objOf(Object.fromEntries(DEVICE_SETTINGS.map((k) => [k, DEVICE])));
// 날짜 · 횟수 짝은 STATE 를 다 합친 다음에 맞춘다
const PAIRS = [dayPair('pokesDay', 'pokesToday')];

// 값을 고르는 칸(설정 · 기타)은 3방향으로만 판단할 수 있다
const PICKS = new Set(['local']);

function rule(spec, b, l, r, ctx) {
  switch (spec.t) {
    case 'device':
      return l;
    case 'local':
      return l !== undefined ? l : r;
    case 'sum': {
      if (l === undefined) return r;
      if (r === undefined) return l;
      if (typeof l !== 'number' || typeof r !== 'number') return l;
      return ctx.exact ? Math.max(0, l + r - num(b)) : Math.max(l, r);
    }
    case 'max':
      if (l === undefined || l === null) return r;
      if (r === undefined || r === null) return l;
      return r > l ? r : l;
    case 'min':
      if (l === undefined || l === null) return r;
      if (r === undefined || r === null) return l;
      return r < l ? r : l;
    case 'minNz':
      if (!l) return r;
      if (!r) return l;
      return Math.min(l, r);
    case 'or':
      return l === undefined ? r : r === undefined ? l : !!(l || r);
    case 'union': {
      if (!Array.isArray(l)) return r;
      if (!Array.isArray(r)) return l;
      const seen = new Set(l.map(spec.key));
      let out = [...l, ...r.filter((x) => !seen.has(spec.key(x)))];
      if (out.some((x) => isObj(x) && typeof x.at === 'number')) out = out.slice().sort((a, c) => num(a && a.at) - num(c && c.at));
      return spec.limit ? out.slice(-spec.limit) : out;
    }
    case 'fn':
      return spec.fn(b, l, r, ctx);
    case 'map':
    case 'obj': {
      if (!isObj(l)) return r;
      if (!isObj(r)) return l;
      const out = {};
      const keys = new Set([...Object.keys(l), ...Object.keys(r)]);
      if (ctx.exact && isObj(b)) for (const k of Object.keys(b)) keys.add(k);
      for (const k of keys) {
        const sub = spec.t === 'map' ? spec.each : spec.fields[k] || spec.rest;
        const v = merge(sub, isObj(b) ? b[k] : undefined, l[k], r[k], ctx);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    default:
      return l;
  }
}

// 한 칸 합치기. 조상을 알면(exact) 한쪽만 바꾼 칸은 바뀐 쪽을, 모르면 규칙대로 (고르는 칸은 내 것)
function merge(spec, b, l, r, ctx) {
  if (spec.t === 'device') return l;
  if (same(l, r)) return l;
  // 칸이 여럿인 묶음은 통째로 고르지 않는다 (안에 기기마다 따로인 칸이 있을 수 있다)
  if (spec.t === 'obj') return rule(spec, b, l, r, ctx);
  if (ctx.exact) {
    if (same(l, b)) return r;
    if (same(r, b)) return l;
  } else if (PICKS.has(spec.t)) return l !== undefined ? l : r;
  return rule(spec, b, l, r, ctx);
}

/*
 * data.json 둘을 합친다. base = 공통 조상의 sharedOf (모르면 null). 넣은 값은 건드리지 않는다
 *  opts.legacy: 상대가 1.5.0 이하 (meta.sync 가 없다) → 사용량은 내 것만
 */
function mergeData(base, local, remote, { now = Date.now(), legacy = false } = {}) {
  const ctx = { exact: !!base, now };
  // 어느 기기에서든 지운 할 일은 합친 목록에 다시 넣지 않는다 (TODOS)
  ctx.tombs = [...((local.state || {}).todoTomb || []), ...((remote.state || {}).todoTomb || [])];
  const b = base || {};
  const settings = merge(SETTINGS, b.settings, local.settings || {}, remote.settings || {}, ctx);
  const state = merge(STATE, b.state, local.state || {}, remote.state || {}, ctx);
  for (const pair of PAIRS) Object.assign(state, pair(b.state, local.state || {}, remote.state || {}, ctx));
  let usage = legacy ? local.usage : merge(USAGE, b.usage, local.usage || {}, remote.usage || {}, ctx);
  // 어느 쪽에선 아직 살아 있는 노트는 지운 기록(gone)에서 뺀다
  if (usage && isObj(usage.gone) && isObj(usage.files)) {
    const gone = Object.fromEntries(Object.entries(usage.gone).filter(([k]) => !(k in usage.files)));
    usage = { ...usage, gone };
  }
  const vv = { ...vvOf(local) };
  for (const [k, v] of Object.entries(vvOf(remote))) if (!(num(vv[k]) >= num(v))) vv[k] = v;
  return {
    ...local,
    version: Math.max(num(local.version), num(remote.version)) || local.version,
    settings,
    state,
    usage,
    meta: { ...(local.meta || {}), sync: vv },
  };
}

/*
 * 이 기기의 판 장부. 저장할 때 stamp, 밖에서 바뀌면 incoming.
 *  dev: 이 기기 이름 (볼트마다 기기마다 하나, 동기화되지 않는 곳에 둔다 — plugin/main.js 의 deviceId)
 *  loaded: 켤 때 읽은 data.json
 */
class SyncBook {
  constructor(dev, loaded) {
    this.dev = dev;
    this.history = new Map(); // 판 번호 → 그 판 sharedOf 의 JSON
    this.rev = num(vvOf(loaded)[dev]);
    this.last = JSON.stringify(sharedOf(loaded));
    // 내가 쓴 파일이면 그 판을 기억한다. 남이 쓴 파일이면 다음 저장에 새 판을 연다 (이 내용은 내 어느 판과도 다르다)
    if (loaded && loaded.meta && loaded.meta.syncBy === dev && this.rev) this.remember(this.rev, this.last);
    else this.last = null;
  }

  remember(rev, json) {
    this.history.set(rev, json);
    while (this.history.size > HISTORY_MAX) this.history.delete(this.history.keys().next().value);
  }

  // 저장 직전에 부른다. 판 번호 몫이 바뀌었으면 새 판 번호를 연다. data.meta 를 고친다
  stamp(data, now = Date.now()) {
    const json = JSON.stringify(sharedOf(data));
    if (json !== this.last) {
      this.rev = Math.max(now, this.rev + 1);
      this.last = json;
      this.remember(this.rev, json);
    }
    data.meta = { ...(data.meta || {}), sync: { ...vvOf(data), [this.dev]: this.rev }, syncBy: this.dev };
    return data;
  }

  /*
   * 밖에서 바뀐 data.json (remote) 을 지금 것(local) 과 합친다.
   * 돌려주는 것: { merged, changed, exact, legacy }. changed = 메모리에 다시 넣어야 하는가
   */
  incoming(local, remote, now = Date.now()) {
    const legacy = !isObj(remote.meta && remote.meta.sync);
    const seen = vvOf(remote)[this.dev];
    const json = seen ? this.history.get(seen) : undefined;
    const base = json ? JSON.parse(json) : null;
    const merged = mergeData(base, local, remote, { now, legacy });
    const changed = !same(liveOf(merged), liveOf(local));
    // 합친 내용은 내 어느 판과도 다르다. 다음 저장에 새 판을 연다
    if (changed) this.last = null;
    return { merged, changed, exact: !!base, legacy };
  }
}

module.exports = { SyncBook, mergeData, sharedOf, same, DEVICE_SETTINGS, DEVICE_STATE, TIMED_STATE };
