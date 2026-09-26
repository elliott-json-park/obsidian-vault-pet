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
        return { key: r.key, slot: slotOf(r.key), tier: r.tier, need, any: r.any, anyHave: anyN, made: this.everMade(r.key), owned, ready };
      }),
      made: RECIPES.filter((r) => this.everMade(r.key)).length,
      total: RECIPES.length,
    };
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
      workshopMade: [...(this.state.get('workshopMade') || []), { key, at: Date.now() }],
    });
    return { ok: true, key, used };
  }
}

module.exports = { Workshop, RECIPES };
