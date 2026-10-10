// 보물 공방 (2026-09-24). 깜짝 이벤트로 주운 하찮은 보물을 재료로 공방 전용 코스튬을 만든다.
// 만들면 재료 보물의 개수가 준다. 도감(한 번이라도 주운 기록)과 '보물 모으기' 업적은 그대로 남는다 (treasure.js 의 treasureSeen).
// 코스튬은 main/shop.js 의 ACCESSORIES 에 workshop: true 로 들어 있다 (상점에서는 안 판다). 그림은 renderer/accessories-workshop-*.js
//
// 재료 개수는 보물이 하루 4개쯤 들어온다고 보고 잡았다 (깜짝 이벤트 하루 최대 8번, 흔함 70 · 드묾 25 · 전설 5).
//  특정 흔한 보물 하나는 하루 0.14개, 드문 것 0.08개, 전설 0.04개꼴
//  2026-09-25: 모이기 힘들어서 줄였다 (any 절반, 따로 적힌 재료 약 30%↓ · 쉬움은 2개, 전설 1개) → 쉬움 2주 · 보통 3~4주 · 어려움 5~6주
//  any = '흔한 보물 아무거나'. 이 조합에 따로 적힌 재료는 빼고, 가장 많이 쌓인 흔한 보물부터 쓴다
const { TREASURES } = require('./treasure');
const { ACCESSORIES } = require('./shop');
const slotOf = (key) => (ACCESSORIES.find((a) => a.key === key) || {}).slot || null;

const RECIPES = [
  // ---------- 쉬움 ----------
  { key: 'capcrown', tier: 'easy', need: { bottlecap: 2 }, any: 4 },
  { key: 'rubberslingshot', tier: 'easy', need: { rubberband: 2, twig: 2 }, any: 3 },
  { key: 'receiptcape', tier: 'easy', need: { receipt: 2 }, any: 4 },
  { key: 'bubblearmor', tier: 'easy', need: { bubblewrap: 2, breadtie: 2 }, any: 3 },
  { key: 'dustscarf', tier: 'easy', need: { dustball: 2 }, any: 4 },
  { key: 'strawglasses', tier: 'easy', need: { drinkstraw: 2, clip: 2 }, any: 3 },
  { key: 'leafwreath', tier: 'easy', need: { dryleaf: 2, pinecone: 2 }, any: 3 },
  { key: 'buttonnecklace', tier: 'easy', need: { button: 2, breadtie: 2 }, any: 3 },
  { key: 'toothpickrapier', tier: 'easy', need: { toothpick: 2, bandaid: 2 }, any: 3 },
  { key: 'pigeonhat', tier: 'easy', need: { pigeonfeather: 2, seedshell: 2 }, any: 3 },
  { key: 'candysparkle', tier: 'easy', need: { candywrap: 2, crumb: 2 }, any: 3 },
  // ---------- 보통 ----------
  { key: 'socksock', tier: 'normal', need: { lonesock: 3, googlyeye: 2 }, any: 4 },
  { key: 'esckeycap', tier: 'normal', need: { keycap: 2, breadtie: 2, clip: 2 }, any: 4 },
  { key: 'legohelm', tier: 'normal', need: { lego: 3 }, any: 6 },
  { key: 'coinmedal', tier: 'normal', need: { coin10: 3 }, any: 3 },
  { key: 'crayondoodle', tier: 'normal', need: { crayon: 2, postit: 2 }, any: 4 },
  { key: 'ddakjicape', tier: 'normal', need: { ddakji: 2, marble: 2 }, any: 4 },
  { key: 'staticshock', tier: 'normal', need: { deadbattery: 2, clip: 3 }, any: 4 },
  { key: 'cicadasuit', tier: 'normal', need: { cicada: 2, worm: 2, acorn: 2 }, any: 4 },
  { key: 'acorncheeks', tier: 'normal', need: { acorn: 3, seedshell: 3 }, any: 4 },
  // ---------- 어려움 (전설 보물) ----------
  { key: 'legendcapcrown', tier: 'hard', need: { shinycap: 1, bottlecap: 6 }, any: 5 },
  { key: 'lotteryfan', tier: 'hard', need: { lottery: 1, receipt: 4 }, any: 5 },
  { key: 'usbantenna', tier: 'hard', need: { usbcap: 1, eartip: 2 }, any: 5 },
  { key: 'gatekeeper', tier: 'hard', need: { oldkey: 1, ddakji: 2, marble: 2 }, any: 6 },
];

const COMMON = TREASURES.filter((t) => t.rarity === 'common').map((t) => t.key);
const RARE = TREASURES.filter((t) => t.rarity === 'rare').map((t) => t.key);
const rarityOf = (key) => (TREASURES.find((t) => t.key === key) || {}).rarity || null;

// 보물 교환소 (2026-10-10): 쌓인 보물을 원하는 보물로 바꾼다. 전설은 못 받는다(어려움 단계를 지킨다).
// 받는 쪽 등급 → 내는 방법들 (앞에 있는 것부터). 낼 보물은 많이 쌓인 것부터 골고루 (pickAny 와 같은 방식)
const RATES = {
  common: [{ pay: 'common', n: 3 }],
  rare: [{ pay: 'rare', n: 3 }, { pay: 'common', n: 8 }],
};

// pool 에서 n 개를 많이 쌓인 것부터 골고루 고른다. keep = { 키: 남겨 둘 개수 }. 모자라면 null
function takeEven(box, pool, n, keep = {}) {
  const have = Object.fromEntries(pool.map((k) => [k, Math.max(0, (box[k] || 0) - (keep[k] || 0))]));
  const order = pool.filter((k) => have[k] > 0).sort((a, b) => have[b] - have[a]);
  const out = {};
  let left = n;
  while (left > 0) {
    let took = false;
    for (const k of order) {
      if (left <= 0) break;
      if (have[k] > 0) {
        have[k]--;
        out[k] = (out[k] || 0) + 1;
        left--;
        took = true;
      }
    }
    if (!took) return null;
  }
  return out;
}

// target 하나를 받으려면 무엇을 내야 하나. { pay: { 키: 개수 }, rate } 또는 null
//  avoid = 내지 않을 키들 (받을 것 · 조합에 따로 적힌 재료), keep = 남겨 둘 개수
function quote(box, target, { avoid = [], keep = {} } = {}) {
  const rates = RATES[rarityOf(target)];
  if (!rates) return null;
  for (const r of rates) {
    const pool = (r.pay === 'rare' ? RARE : COMMON).filter((k) => k !== target && !avoid.includes(k));
    const pay = takeEven(box, pool, r.n, keep);
    if (pay) return { pay, rate: r };
  }
  return null;
}

// 흔한 보물 아무거나 n 개를 고른다: 이 조합에 따로 적힌 재료는 빼고, 많이 쌓인 것부터. 모자라면 null
function pickAny(box, recipe, n) {
  if (!n) return {};
  const pool = COMMON.filter((k) => !(k in recipe.need) && (box[k] || 0) > 0).sort((a, b) => box[b] - box[a]);
  const out = {};
  let left = n;
  // 한 종류를 다 털지 않게 골고루: 많은 것부터 하나씩 돌아가며 뺀다
  const have = Object.fromEntries(pool.map((k) => [k, box[k]]));
  while (left > 0) {
    let took = false;
    for (const k of pool) {
      if (left <= 0) break;
      if (have[k] > 0) {
        have[k]--;
        out[k] = (out[k] || 0) + 1;
        left--;
        took = true;
      }
    }
    if (!took) return null;
  }
  return out;
}
const anyHave = (box, recipe) => COMMON.filter((k) => !(k in recipe.need)).reduce((a, k) => a + (box[k] || 0), 0);

class Workshop {
  constructor(state, treasures, shop) {
    this.state = state;
    this.treasures = treasures;
    this.shop = shop;
  }

  // 실제로 옷장에 있나. 개발자 모드의 '다 가진 척'(shop.owned)은 공방에서는 치지 않는다
  hasMade(key) {
    return (this.state.get('items') || []).includes(key);
  }
  // 한 번이라도 만든 적 있나 (친구에게 선물해서 지금은 없어도 공방 진행도는 남는다). 가진 게 없으면 다시 만들 수 있다
  everMade(key) {
    return this.hasMade(key) || (this.state.get('workshopMade') || []).some((x) => x.key === key);
  }

  // 화면에 보여 줄 조합 목록: 재료마다 가진 개수, 만들 수 있나, 이미 만들었나
  summary() {
    const box = this.treasures.box();
    return {
      recipes: RECIPES.map((r) => {
        const need = Object.entries(r.need).map(([key, n]) => ({ key, n, have: box[key] || 0 }));
        const anyN = anyHave(box, r);
        const owned = this.hasMade(r.key);
        const ready = need.every((x) => x.have >= x.n) && anyN >= r.any;
        const fillable = !ready && !owned && need.some((x) => x.have < x.n) && this.fill(r.key, { dry: true }).ok;
        const made = (this.state.get('workshopMade') || []).filter((x) => x.key === r.key).pop() || null;
        return { key: r.key, slot: slotOf(r.key), tier: r.tier, need, any: r.any, anyHave: anyN, made: this.everMade(r.key), madeAt: made ? made.at : 0, used: made ? made.used || null : null, owned, ready, fillable };
      }),
      // 교환소: 받을 수 있는 보물과 지금 바꿀 수 있나
      exchange: TREASURES.filter((t) => RATES[t.rarity]).map((t) => {
        const q = quote(box, t.key);
        return { key: t.key, rarity: t.rarity, have: box[t.key] || 0, ok: !!q, pay: q ? q.rate : RATES[t.rarity][0] };
      }),
      made: RECIPES.filter((r) => this.everMade(r.key)).length,
      total: RECIPES.length,
    };
  }

  // 보물 하나를 바꿔 받는다. { ok, reason?, key, paid? }
  exchange(target) {
    if (!RATES[rarityOf(target)]) return { ok: false, reason: rarityOf(target) ? 'legend' : 'missing' };
    const q = quote(this.treasures.box(), target);
    if (!q || !this.treasures.spend(q.pay)) return { ok: false, reason: 'short' };
    this.treasures.gain(target);
    return { ok: true, key: target, paid: q.pay };
  }

  // 이 조합에 모자란 재료(따로 적힌 것)를 한 번에 바꿔 채운다.
  // 조합 재료와 '아무 보물' 몫은 남겨 두고 나머지에서 낸다. 전설 재료가 모자라면 못 채운다.
  // dry = true 면 바꾸지 않고 되는지만 본다. { ok, reason?, got?: { 키: 개수 }, paid? }
  fill(key, { dry = false } = {}) {
    const r = RECIPES.find((x) => x.key === key);
    if (!r) return { ok: false, reason: 'missing' };
    const box = { ...this.treasures.box() };
    const short = Object.entries(r.need).filter(([k, n]) => (box[k] || 0) < n);
    if (!short.length) return { ok: false, reason: 'enough' };
    if (short.some(([k]) => rarityOf(k) === 'legend')) return { ok: false, reason: 'legend' };
    const avoid = Object.keys(r.need);
    const got = {};
    const paid = {};
    for (const [k, n] of short) {
      for (let i = box[k] || 0; i < n; i++) {
        // '아무 보물' 몫(흔한 것 r.any 개)은 남긴다: 흔한 보물로 낼 때 그만큼은 빼고 센다
        const spare = anyHave(box, r) - r.any;
        const q = quote(box, k, { avoid });
        if (!q) return { ok: false, reason: 'short' };
        const commonsPaid = Object.entries(q.pay).filter(([pk]) => COMMON.includes(pk)).reduce((a, [, v]) => a + v, 0);
        if (commonsPaid > spare) {
          // 흔한 보물로는 '아무 보물' 몫을 깎으니, 드문 보물로만 낼 수 있나 다시 본다
          const rareOnly = rarityOf(k) === 'rare' ? takeEven(box, RARE.filter((x) => x !== k && !avoid.includes(x)), 3) : null;
          if (!rareOnly) return { ok: false, reason: 'short' };
          q.pay = rareOnly;
        }
        for (const [pk, pv] of Object.entries(q.pay)) {
          box[pk] -= pv;
          paid[pk] = (paid[pk] || 0) + pv;
        }
        box[k] = (box[k] || 0) + 1;
        got[k] = (got[k] || 0) + 1;
      }
    }
    if (dry) return { ok: true, got, paid };
    if (!this.treasures.spend(paid)) return { ok: false, reason: 'short' };
    for (const [k, n] of Object.entries(got)) this.treasures.gain(k, n);
    return { ok: true, got, paid };
  }

  // 만든다. { ok, reason?, key, used? }
  craft(key) {
    const r = RECIPES.find((x) => x.key === key);
    if (!r) return { ok: false, reason: 'missing' };
    if (this.hasMade(key)) return { ok: false, reason: 'made' };
    const box = this.treasures.box();
    if (!Object.entries(r.need).every(([k, n]) => (box[k] || 0) >= n)) return { ok: false, reason: 'short' };
    const extra = pickAny(box, r, r.any);
    if (!extra) return { ok: false, reason: 'short' };
    const used = { ...r.need };
    for (const [k, n] of Object.entries(extra)) used[k] = (used[k] || 0) + n;
    if (!this.treasures.spend(used)) return { ok: false, reason: 'short' };
    this.state.set({
      items: [...(this.state.get('items') || []), key],
      workshopMade: [...(this.state.get('workshopMade') || []), { key, at: Date.now(), used }], // used = 쓴 재료 (카드의 '재료' 꼬리표)
    });
    return { ok: true, key, used };
  }
}

module.exports = { Workshop, RECIPES, RATES, quote };
