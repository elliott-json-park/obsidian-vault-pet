// 통계 탭에 쓰는 계산. usage.js 의 시간 단위 버킷(YYYY-MM-DDTHH → {c,l,n,s,v,e})만 가지고 만든다.
//
// 도표 셋:
//  - 요일×시간 히트맵        heatmap()
//  - 주간 리포트 (지난주 대비) weekly()
//  - 집중 구간 분포           focus()
//  - 코인 지갑 흐름           coinFlow()
// 그리고 이 숫자들에서 고양이가 읽어 줄 한 줄을 고른다  insight()

const DAY = 24 * 60 * 60 * 1000;

// 코인 셈은 상점과 같은 계단식 (하루 앞 5,000자는 5자 = 1코인, 그 뒤로는 25자 = 1코인)
const { coinsForDay, coinsSince } = require('./shop');

const keyDate = (key) => {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, Number(key.slice(11, 13)));
};

// 오늘 0시
function midnight(offsetDays = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offsetDays).getTime();
}

// 요일(0=일) × 시간(0~23) 쓴 글자 수
function heatmap(usage) {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let max = 0;
  let peak = null;
  for (const [key, b] of usage.eachBucket()) {
    if (!b.c) continue;
    const d = keyDate(key);
    const w = d.getDay();
    const h = d.getHours();
    grid[w][h] += b.c;
    if (grid[w][h] > max) {
      max = grid[w][h];
      peak = { weekday: w, hour: h, n: grid[w][h] };
    }
  }
  return { grid, max, peak };
}

// 최근 7일과 그 앞 7일
function weekly(usage) {
  const cut = midnight(6); // 최근 7일 시작 (오늘 포함)
  const prevCut = midnight(13); // 그 앞 7일 시작

  const blank = () => ({ c: 0, l: 0, n: 0, s: 0, days: new Set(), dayC: {} });
  const cur = blank();
  const prev = blank();
  for (const [key, b] of usage.eachBucket(prevCut)) {
    const t = keyDate(key).getTime();
    const box = t >= cut ? cur : prev;
    box.c += b.c;
    box.l += b.l;
    box.n += b.n;
    box.s += b.s;
    box.dayC[key.slice(0, 10)] = (box.dayC[key.slice(0, 10)] || 0) + b.c;
    if (b.e) box.days.add(key.slice(0, 10));
  }
  const pack = (x) => ({ c: x.c, l: x.l, n: x.n, s: x.s, days: x.days.size, coins: Object.values(x.dayC).reduce((a, c) => a + coinsForDay(c), 0) });
  return { now: pack(cur), prev: pack(prev) };
}

// 쉬지 않고 이어서 일한 구간. 활동이 있는 시간대가 연달아 붙어 있으면 한 구간으로 본다
function focus(usage) {
  const hours = new Set();
  for (const [key, b] of usage.eachBucket()) if (b.e) hours.add(keyDate(key).getTime());
  const sorted = [...hours].sort((a, b) => a - b);

  const runs = [];
  let len = 0;
  for (let i = 0; i < sorted.length; i++) {
    len++;
    if (i + 1 >= sorted.length || sorted[i + 1] - sorted[i] > 60 * 60 * 1000) {
      runs.push(len);
      len = 0;
    }
  }
  // 1시간 / 2시간 / 3시간 / 4시간 / 5시간 이상
  const bins = [0, 0, 0, 0, 0];
  for (const r of runs) bins[Math.min(r, 5) - 1]++;
  return { bins, longest: runs.length ? Math.max(...runs) : 0, count: runs.length };
}

// 최근 n일 코인 흐름. 번 코인은 그날 쓴 글자에서, 쓴 코인은 구매 기록에서
function coinFlow(usage, purchases, n = 14) {
  const rows = usage.daily(n).map((d) => ({ day: d.day, earned: coinsForDay(d.c), spent: 0 }));
  const index = Object.fromEntries(rows.map((r) => [r.day, r]));
  for (const p of purchases || []) {
    const d = new Date(p.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (index[key]) index[key].spent += p.price;
  }
  let running = 0;
  for (const r of rows) {
    running += r.earned - r.spent;
    r.net = running;
  }
  return rows;
}

// 고양이가 읽어 줄 한 줄. { k: i18n 키, v: 채울 값 } 을 돌려준다
function insight({ heat, week, focusInfo, wallet }) {
  // 지난주보다 눈에 띄게 달라졌으면 그 얘기부터
  if (week.prev.c >= 1000 && week.now.c >= 1000) {
    const diff = Math.round(((week.now.c - week.prev.c) / week.prev.c) * 100);
    if (diff >= 25) return { k: 'insight.busier', v: { n: diff } };
    if (diff <= -25) return { k: 'insight.calmer', v: { n: Math.abs(diff) } };
  }
  if (focusInfo.longest >= 4) return { k: 'insight.marathon', v: { h: focusInfo.longest } };
  if (heat.peak && heat.peak.n >= 500) {
    return { k: 'insight.peak', v: { day: heat.peak.weekday, hour: heat.peak.hour } };
  }
  if (week.now.days >= 5) return { k: 'insight.steady', v: { d: week.now.days } };
  if (wallet && wallet.balance >= 500) return { k: 'insight.rich', v: { n: wallet.balance } };
  return { k: 'insight.hello', v: {} };
}

// 대시보드: 지금까지·이번 달·오늘의 쓴 글자와 번 코인.
// 토큰도 코인도 처음 만난 뒤의 기록만 센다 (그 전 기록은 통계의 누적 기록에서 본다).
// 지금까지 번 코인에는 처음 받은 용돈도 들어간다
function dashboard(usage, wallet) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const since = (wallet && wallet.since) || 0;
  const row = (from) => ({ o: usage.totals(Math.max(from, since)).c, coins: coinsSince(usage, Math.max(from, since)) });
  return {
    all: { ...row(0), coins: wallet ? wallet.earned : coinsSince(usage, since) },
    month: row(monthStart),
    today: row(dayStart),
  };
}

// 고양이의 가계부: 지금까지 산 것을 항목별로 묶는다.
//  식비 = 밥·간식 / 품위 유지비 = 악세사리 / 유흥비 = 모션·장난감 / 기타 = 지금은 상점에 없는 물건
// kindOf(key) → 'food' | 'acc' | 'motion' | 'toy' | null
function ledger(purchases, kindOf) {
  const CAT = { food: 'food', acc: 'dignity', motion: 'fun', toy: 'fun' };
  const cats = {};
  for (const p of purchases || []) {
    const cat = CAT[kindOf(p.key)] || 'etc';
    const c = (cats[cat] ||= { cat, total: 0, items: {} });
    const it = (c.items[p.key] ||= { key: p.key, kind: kindOf(p.key), count: 0, total: 0, last: 0 });
    it.count++;
    it.total += p.price;
    it.last = Math.max(it.last, p.at);
    c.total += p.price;
  }
  const order = ['food', 'dignity', 'fun', 'etc'];
  const list = order.filter((k) => cats[k]).map((k) => ({ ...cats[k], items: Object.values(cats[k].items).sort((a, b) => b.total - a.total) }));
  return { cats: list, total: list.reduce((n, c) => n + c.total, 0), count: (purchases || []).length };
}

function summary(usage, state, wallet, kindOf) {
  const heat = heatmap(usage);
  const week = weekly(usage);
  const focusInfo = focus(usage);
  return {
    heat,
    week,
    focus: focusInfo,
    flow: coinFlow(usage, state.get('purchases')),
    insight: insight({ heat, week, focusInfo, wallet }),
    dash: dashboard(usage, wallet),
    ledger: ledger(state.get('purchases'), kindOf || (() => null)),
  };
}

module.exports = { summary, heatmap, weekly, focus, coinFlow, insight, dashboard, ledger };
