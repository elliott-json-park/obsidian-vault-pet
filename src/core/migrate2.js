// 2.0.0 으로 옮기기 (한 번만). 보물 공방 · 동네 친구 · 그날의 기분 · 먹고 싶은 것 · 오늘의 소식을 없앴다.
//  - 남은 보물(상자 + 바닥에 두고 끈 것)은 등급마다 정한 값만큼 코인으로 준다
//  - 공방에서 만든 코스튬은 옷장에 남는다. 친구에게 선물해서 옷장에 없던 것도 돌려준다 (공방 코스튬은 이제 상점 코스튬이다)
//  - 지운 모션을 산 값은 shop.migrate 가 돌려준다 (RETIRED_MOTIONS). 남은 모션은 이제 공짜라 돌려주지 않는다
//  - 없앤 기능의 기록은 data.json 에서 지운다
// state · settings 는 plugin/store.js 의 Store. 무엇을 했는지 돌려준다 (이미 옮겼으면 null)
const TREASURE_COINS = { common: 15, rare: 40, legend: 120 };
// 2.0.0 이전에 있던 보물 등급 (core/treasure.js 를 지웠으니 여기 남긴다. 없는 키는 흔함으로 친다)
const RARE = new Set(['worm', 'acorn', 'cicada', 'crayon', 'coin10', 'keycap', 'eartip', 'lego', 'postit', 'googlyeye', 'ddakji', 'marble', 'deadbattery']);
const LEGEND = new Set(['shinycap', 'clover3', 'lottery', 'usbcap', 'oldkey']);
const rarityOf = (key) => (LEGEND.has(key) ? 'legend' : RARE.has(key) ? 'rare' : 'common');

const GONE_STATE = ['treasures', 'treasureSeen', 'eventLoot', 'eventLog', 'friends', 'guests', 'craving', 'temper', 'news', 'workshopMade'];

function migrateV2(state) {
  if (state.get('v2')) return null;
  const out = { coins: 0, treasures: 0, restored: [] };
  const box = { ...(state.get('treasures') || {}) };
  for (const x of state.get('eventLoot') || []) if (x && x.key) box[x.key] = (box[x.key] || 0) + 1;
  for (const [key, n] of Object.entries(box)) {
    const k = Math.max(0, Math.floor(Number(n) || 0));
    out.treasures += k;
    out.coins += k * TREASURE_COINS[rarityOf(key)];
  }
  const items = state.get('items') || [];
  const made = [...new Set((state.get('workshopMade') || []).map((x) => x && x.key).filter(Boolean))];
  out.restored = made.filter((k) => !items.includes(k));
  const patch = { v2: true };
  if (out.restored.length) patch.items = [...items, ...out.restored];
  if (out.coins) {
    patch.walletBonus = (state.get('walletBonus') || 0) + out.coins;
    patch.refundNote = (state.get('refundNote') || 0) + out.coins;
  }
  state.set(patch);
  for (const k of GONE_STATE) delete state.data[k];
  state.saveSoon();
  return out;
}

module.exports = { migrateV2, TREASURE_COINS };
