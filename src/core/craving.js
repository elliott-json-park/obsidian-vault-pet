// 오늘 먹고 싶은 것 (2026-10-10). 고양이가 날마다 밥 하나 · 간식 하나를 조른다.
//  - 날짜로 정해서 앱을 껐다 켜도 안 바뀐다. 어제 고른 건 빼고, 적게 먹여 본 음식일수록 잘 뽑힌다
//  - 프리미엄은 빼되, 일주일에 한 번쯤(PREMIUM_EVERY) 하나가 프리미엄이다
//  - 들어주면(그 음식을 먹이면) 산 값의 절반을 코인으로 돌려준다 (main.js 의 treat-eaten)
// state.craving = { day, meal, snack, fed: [키…], prev: [어제 둘], run, lastDay }
// electron 없이 도는 순수 Node 라 test/craving.test.js 가 직접 돌린다
const { FOODS } = require('./shop');

const PREMIUM_EVERY = 7;
const REFUND = 0.5;

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 같은 날 · 같은 사람이면 같은 수가 나오는 난수 (mulberry32)
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// fedCounts: { 키: 지금까지 사 먹인 횟수 } (적을수록 잘 뽑힌다)
function pickOne(list, rnd, fedCounts, avoid) {
  const pool = list.filter((x) => !avoid.includes(x.key));
  const use = pool.length ? pool : list;
  const w = use.map((x) => 1 / (1 + (fedCounts[x.key] || 0)));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < use.length; i++) if ((r -= w[i]) <= 0) return use[i].key;
  return use[use.length - 1].key;
}

// 그날의 두 음식. seed = 사람마다 다르게 (처음 만난 시각 등)
function pickCraving(day, { seed = '', fedCounts = {}, avoid = [] } = {}) {
  const rnd = seeded(`${seed}|${day}`);
  const premiumDay = rnd() < 1 / PREMIUM_EVERY;
  const premiumMeal = premiumDay && rnd() < 0.5;
  const list = (group, premium) => FOODS.filter((x) => x.group === group && !!x.premium === premium && x.fill !== 0);
  return {
    meal: pickOne(list('meal', premiumMeal), rnd, fedCounts, avoid),
    snack: pickOne(list('snack', premiumDay && !premiumMeal), rnd, fedCounts, avoid),
  };
}

class Craving {
  // fedCounts() = { 키: 횟수 } 를 돌려주는 함수, seed() = 사람마다 다른 값
  constructor(state, { fedCounts = () => ({}), seed = () => '' } = {}) {
    this.state = state;
    this.fedCounts = fedCounts;
    this.seed = seed;
  }

  // 오늘 것 (날이 바뀌었으면 새로 고른다)
  today(now = new Date()) {
    const day = dayKey(now);
    const c = this.state.get('craving') || {};
    if (c.day === day) return c;
    const prev = c.day ? [c.meal, c.snack] : [];
    const pick = pickCraving(day, { seed: String(this.seed()), fedCounts: this.fedCounts(), avoid: prev });
    const next = { day, ...pick, fed: [], prev, run: c.run || 0, lastDay: c.lastDay || null };
    this.state.set({ craving: next });
    return next;
  }

  // 이 음식을 먹었다. 오늘 먹고 싶던 것이고 아직 안 들어줬으면 { refund, first, run } 를 돌려준다
  // run = 하루도 안 빠지고 소원을 들어준 날 수 (어제도 들어줬으면 이어진다)
  eaten(key, now = new Date()) {
    const c = this.today(now);
    if ((key !== c.meal && key !== c.snack) || c.fed.includes(key)) return null;
    const it = FOODS.find((x) => x.key === key);
    const refund = Math.floor((it ? it.price : 0) * REFUND);
    const firstToday = !c.fed.length;
    let run = c.run || 0;
    if (firstToday) {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      run = c.lastDay === dayKey(y) ? run + 1 : 1;
    }
    this.state.set({ craving: { ...c, fed: [...c.fed, key], run, lastDay: c.day } });
    return { refund, first: firstToday, run, both: c.fed.length + 1 >= 2 };
  }
}

module.exports = { Craving, pickCraving, dayKey, PREMIUM_EVERY, REFUND };
