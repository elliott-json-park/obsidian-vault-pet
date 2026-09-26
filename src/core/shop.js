// 글자 지갑과 상점. (킷커밋 데스크톱판의 토큰 지갑 자리)
//
// 옵시디언에 **새로 쓴 글자**가 그대로 돈이 된다. 많이 쓸수록 많이 번다.
// 이름은 renderer 쪽 i18n.js 의 'item.<key>' / 'motion.<key>' / 'shop.<kind>' 에 있다.

// 코인 셈: 하루(로컬 날짜)마다 계단식으로 센다.
//  그날 쓴 글자 앞 5,000자까지는 5자 = 1코인 (하루 최대 1,000코인), 그 뒤로는 25자 = 1코인
const DAILY_FIRST_TOKENS = 5_000; // 하루에 높은 비율로 쳐 주는 글자 수
const FIRST_TOKENS_PER_COIN = 5; // 그 안에서는 5자 = 1코인
const AFTER_TOKENS_PER_COIN = 25; // 그 뒤로는 25자 = 1코인
// 처음 만났을 때 쥐여 주는 용돈
const WELCOME_COINS = 1_000;

// 하루 쓴 글자 → 그날 번 코인
function coinsForDay(tokens) {
  const t = Math.max(0, tokens || 0);
  const first = Math.min(t, DAILY_FIRST_TOKENS);
  return Math.floor(first / FIRST_TOKENS_PER_COIN) + Math.floor((t - first) / AFTER_TOKENS_PER_COIN);
}

// sinceMs 이후 쓴 글자로 번 코인. usage 의 시간 버킷을 날짜별로 묶어 하루씩 계단을 적용한다.
// 시작 시각이 걸친 날은 그 시각이 속한 시간 버킷부터만 센다 (usage.eachBucket 과 같은 기준. 기록이 시간 단위라 이게 가장 촘촘하다)
function coinsSince(usage, sinceMs = 0) {
  const days = {};
  for (const [key, b] of usage.eachBucket(sinceMs)) days[key.slice(0, 10)] = (days[key.slice(0, 10)] || 0) + (b.c || 0);
  return Object.values(days).reduce((a, t) => a + coinsForDay(t), 0);
}

// 아이콘은 따로 없다. key 와 같은 이름의 도트가 renderer/pixelart.js 에 있다.
// 악세사리 그림은 renderer/accessories.js, 모션은 renderer/motions.js 에 있다.

// 코스튬 — 한 번 사면 계속 쓴다. level 이 있으면 그 레벨도 찍어야 살 수 있다.
// 레벨 잠금 (2026-09-24 리뉴얼, 최대 Lv80): 코스튬·장난감·모션을 가격 순으로 Lv1~80 에 고르게 펴고, 해금 시점으로 묶었다.
//  해금 시점 = Lv1 · 5 · 10 … 30 (5레벨마다) · 33 … 48 (3레벨마다) · 50 … 80 (2레벨마다). 보물 공방 제작품은 잠그지 않는다
// slot = 입는 칸. 칸마다 하나씩, 여러 칸을 겹쳐 입는다 (COSTUME_SLOTS).
// 세트(set)는 여러 부위를 한 번에 덮는다: covers 에 적힌 칸을 대신 차지한다 (람보 = 머리+목, 우주 헬멧 = 머리+얼굴+목)
const ACCESSORIES = [
  { key: 'none', price: 0 },
  { key: 'sprout', price: 100, slot: 'head' },
  { key: 'mustache', price: 200, slot: 'face' },
  { key: 'mask', price: 250, level: 5, slot: 'face' },
  { key: 'bellcollar', price: 350, level: 10, slot: 'neck' },
  { key: 'bunny', price: 350, level: 15, slot: 'head' },
  { key: 'glasses', price: 200, slot: 'face' },
  { key: 'mikan', price: 350, level: 15, slot: 'head' },
  { key: 'toast', price: 400, level: 20, slot: 'head' },
  { key: 'bandana', price: 400, level: 15, slot: 'head' },
  { key: 'nerd', price: 250, level: 5, slot: 'face' },
  { key: 'eyepatch', price: 450, level: 20, slot: 'face' },
  { key: 'headphones', price: 300, level: 10, slot: 'head' },
  { key: 'bee', price: 500, level: 25, slot: 'head' },
  { key: 'flowercrown', price: 500, level: 25, slot: 'head' },
  { key: 'nightcap', price: 550, level: 30, slot: 'head' },
  { key: 'beanie', price: 500, level: 25, slot: 'head' },
  { key: 'tube', price: 800, level: 42, slot: 'neck' },
  { key: 'straw', price: 850, level: 42, slot: 'head' },
  { key: 'party', price: 900, level: 45, slot: 'head' },
  { key: 'frog', price: 550, level: 30, slot: 'head' },
  { key: 'scarf', price: 550, level: 30, slot: 'neck' },
  { key: 'tophat', price: 1000, level: 48, slot: 'head' },
  { key: 'chef', price: 1050, level: 48, slot: 'head' },
  { key: 'propeller', price: 650, level: 33, slot: 'head' },
  { key: 'antlers', price: 1200, level: 50, slot: 'head' },
  { key: 'santa', price: 1300, level: 54, slot: 'head' },
  { key: 'wizard', price: 800, level: 42, slot: 'head' },
  { key: 'halo', price: 850, level: 42, slot: 'head' },
  { key: 'wings', price: 1300, level: 54, slot: 'back' },
  { key: 'crown', price: 1500, level: 56, slot: 'head' },
  // 2차 (2026-09-22): 무기·B급·귀여움, 그리고 비싸고 화려한 고급
  { key: 'socks', price: 250, level: 5, slot: 'head' },
  { key: 'bananahat', price: 250, slot: 'head' },
  { key: 'plunger', price: 300, level: 10, slot: 'head' },
  { key: 'boxhelm', price: 300, level: 5, slot: 'head' },
  { key: 'clover', price: 350, level: 15, slot: 'head' },
  { key: 'sheetmask', price: 350, level: 15, slot: 'face' },
  { key: 'snorkel', price: 400, level: 20, slot: 'face' },
  { key: 'watergun', price: 550, level: 30, slot: 'hand' },
  { key: 'police', price: 800, level: 39, slot: 'head' },
  { key: 'pistol', price: 950, level: 48, slot: 'hand' },
  { key: 'lightsaber', price: 1450, level: 56, slot: 'hand' },
  { key: 'dragonhorns', price: 2700, level: 68, slot: 'head' },
  { key: 'spacehelm', price: 1500, level: 45, slot: 'head' }, // 2026-09-25 세트 → 머리 아이템 '금붕어 어항 돔'
  { key: 'goldaura', price: 4200, level: 76, slot: 'effect' },
  { key: 'phoenix', price: 4500, level: 78, slot: 'back' },
  { key: 'spotlight', price: 4800, level: 78, slot: 'effect' },

  // --- 3차 (2026-09-22 확정): 칸마다 B급 감성, 비싼 건 화려하게 ---
  { key: 'spidercat', price: 1800, level: 18, slot: 'set', covers: ['head', 'face', 'neck', 'hand'] },
  { key: 'ironcat', price: 4700, level: 35, slot: 'set', covers: ['head', 'face', 'neck', 'hand'] },
  { key: 'aliencat', price: 2400, level: 38, slot: 'set', covers: ['head', 'face', 'neck'] },
  { key: 'beesuit', price: 1300, level: 20, slot: 'set', covers: ['head', 'neck', 'back', 'hand'] },
  { key: 'ninjaset', price: 1600, level: 15, slot: 'set', covers: ['head', 'face', 'neck', 'hand', 'back'] },
  { key: 'magicalgirl', price: 5300, level: 48, slot: 'set', covers: ['head', 'neck', 'hand', 'back'] },
  { key: 'gungye', price: 1600, level: 60, slot: 'face' },
  { key: 'rudolph', price: 400, level: 15, slot: 'face' },
  { key: 'pinocchio', price: 450, level: 20, slot: 'face' },
  { key: 'vampeyes', price: 1200, level: 52, slot: 'face' },
  { key: 'vampfang', price: 300, level: 10, slot: 'face' },
  { key: 'pignose', price: 250, level: 5, slot: 'face' },
  { key: 'bearhood', price: 700, level: 33, slot: 'head' },
  { key: 'melonhelm', price: 500, level: 25, slot: 'head' },
  { key: 'arrowhit', price: 350, level: 10, slot: 'head' },
  { key: 'sheeptowel', price: 400, level: 20, slot: 'head' },
  { key: 'combatcap', price: 450, level: 20, slot: 'head' },
  { key: 'clownhat', price: 500, level: 25, slot: 'head' },
  { key: 'softcone', price: 300, level: 10, slot: 'head' },
  { key: 'potnoodle', price: 450, level: 25, slot: 'head' },
  { key: 'unicorn', price: 2900, level: 70, slot: 'head' },
  { key: 'santasuit', price: 900, level: 45, slot: 'neck' },
  { key: 'tuxedo', price: 700, level: 39, slot: 'neck' },
  // --- 5차 (2026-09-23 확정) ---
  { key: 'fedora', price: 700, level: 36, slot: 'head' },
  { key: 'deerstalker', price: 700, level: 33, slot: 'head' },
  { key: 'realdevilhorns', price: 1900, level: 64, slot: 'head' },
  { key: 'blackbeanie', price: 400, level: 15, slot: 'head' },
  { key: 'hiphopbeanie', price: 500, level: 25, slot: 'head' },
  { key: 'newsboy', price: 600, level: 30, slot: 'head' },
  { key: 'knighthelm', price: 1500, level: 58, slot: 'head' },
  { key: 'chefuniform', price: 800, level: 39, slot: 'neck' },
  { key: 'trenchcoat', price: 1200, level: 52, slot: 'neck' },
  { key: 'boxsuit', price: 300, level: 10, slot: 'neck' },
  { key: 'hanbokman', price: 1500, level: 58, slot: 'neck' },
  { key: 'hanbokwoman', price: 1500, level: 58, slot: 'neck' },
  { key: 'knightarmor', price: 1550, level: 58, slot: 'neck' },
  { key: 'bluephoenix', price: 4500, level: 78, slot: 'back' },
  { key: 'bigangel', price: 2500, level: 66, slot: 'back' },
  { key: 'redelectric', price: 1400, level: 56, slot: 'back' },
  { key: 'blackbass', price: 1200, level: 50, slot: 'back' },
  { key: 'gundamwings', price: 4100, level: 76, slot: 'back' },
  { key: 'spiderlegs', price: 3300, level: 72, slot: 'back' },
  { key: 'swallowtail', price: 2100, level: 64, slot: 'back' },
  { key: 'katanaback', price: 1100, level: 48, slot: 'back' },
  { key: 'knightsword', price: 1600, level: 60, slot: 'back' },
  { key: 'lifeburden', price: 900, level: 45, slot: 'back' },
  { key: 'k2rifle', price: 1200, level: 50, slot: 'hand' },
  { key: 'thorhammer', price: 3600, level: 74, slot: 'hand' },
  { key: 'elfbow', price: 2700, level: 68, slot: 'hand' },
  { key: 'plungerhand', price: 300, level: 10, slot: 'hand' },
  { key: 'supersoaker', price: 1700, level: 62, slot: 'hand' },
  // --- 4차 (2026-09-22 확정) ---
  // 해적 선장·미라는 2026-09-25 에 세트에서 부위 아이템으로 나눴다 (세트 키는 머리 아이템이 됐다)
  { key: 'piratecap', price: 600, level: 40, slot: 'head' },
  { key: 'piratecoat', price: 700, level: 40, slot: 'neck' },
  { key: 'piratehook', price: 500, level: 40, slot: 'hand' },
  { key: 'mummycat', price: 500, level: 35, slot: 'head' },
  { key: 'mummywrap', price: 600, level: 35, slot: 'neck' },
  { key: 'reaper', price: 3100, level: 30, slot: 'set', covers: ['head', 'face', 'neck', 'hand'] },
  { key: 'robocat', price: 4100, level: 43, slot: 'set', covers: ['head', 'face', 'neck', 'hand'] },
  { key: 'snotdrip', price: 250, level: 5, slot: 'face' },
  { key: 'hanbok', price: 1500, level: 58, slot: 'neck' },
  { key: 'tutu', price: 900, level: 45, slot: 'neck' },
  { key: 'raincoat', price: 600, level: 30, slot: 'neck' },
  { key: 'dobok', price: 700, level: 36, slot: 'neck' },
  { key: 'campingpack', price: 900, level: 42, slot: 'back' },
  { key: 'guitar', price: 1100, level: 48, slot: 'back' },
  { key: 'quiver', price: 800, level: 42, slot: 'back' },
  { key: 'balloons', price: 700, level: 33, slot: 'back' },
  { key: 'umbrella', price: 600, level: 33, slot: 'hand' },
  { key: 'bearsuit', price: 700, level: 33, slot: 'neck' },
  { key: 'archmage', price: 2500, level: 66, slot: 'neck' },
  { key: 'pierrot', price: 700, level: 36, slot: 'neck' },
  { key: 'reservist', price: 500, level: 25, slot: 'neck' },
  { key: 'prisoner', price: 400, level: 15, slot: 'neck' },
  { key: 'discosuit', price: 3600, level: 72, slot: 'neck' },
  { key: 'devilwings', price: 1800, level: 62, slot: 'back' },
  { key: 'aureole', price: 2400, level: 66, slot: 'back' },
  { key: 'ghostpal', price: 800, level: 39, slot: 'back' },
  { key: 'flywings', price: 350, level: 15, slot: 'back' },
  { key: 'butterfly', price: 2100, level: 64, slot: 'back' },
  { key: 'jetpack', price: 3000, level: 70, slot: 'back' },
  { key: 'herocape', price: 800, level: 39, slot: 'back' },
  { key: 'trident', price: 1700, level: 62, slot: 'hand' },
  { key: 'dualpistol', price: 1400, level: 56, slot: 'hand' },
  { key: 'excalibur', price: 3900, level: 74, slot: 'hand' },
  { key: 'fryingpan', price: 400, level: 15, slot: 'hand' },
  { key: 'whip', price: 500, level: 30, slot: 'hand' },
  { key: 'starwand', price: 1550, level: 58, slot: 'hand' },
  { key: 'bunnymitt', price: 350, level: 15, slot: 'hand' },
  { key: 'bearmitt', price: 350, level: 10, slot: 'hand' },
  { key: 'greenonion', price: 200, slot: 'hand' },
  { key: 'shuriken', price: 600, level: 30, slot: 'hand' },
  { key: 'sojubottle', price: 400, level: 20, slot: 'hand' },
  { key: 'brokensoju', price: 450, level: 20, slot: 'hand' },
  { key: 'handgrenade', price: 700, level: 36, slot: 'hand' },
  { key: 'cigesse', price: 450, level: 20, slot: 'hand' },
  { key: 'cigmarlboro', price: 450, level: 20, slot: 'hand' },
  { key: 'cigdevil', price: 500, level: 25, slot: 'hand' },
  { key: 'saiyan', price: 5100, level: 78, slot: 'effect' },
  { key: 'tipsy', price: 500, level: 30, slot: 'effect' },
  { key: 'stinky', price: 300, level: 10, slot: 'effect' },
  { key: 'snowfall', price: 600, level: 30, slot: 'effect' },
  { key: 'raincloud', price: 500, level: 25, slot: 'effect' },
  { key: 'sakura', price: 800, level: 42, slot: 'effect' },
  { key: 'moneyrain', price: 4650, level: 78, slot: 'effect' },
  { key: 'mosquito', price: 200, slot: 'effect' },
  { key: 'fireworks', price: 3300, level: 72, slot: 'effect' },
  { key: 'soapbubble', price: 400, level: 20, slot: 'effect' },
  // 6차 (2026-09-24): 세트·머리·얼굴·몸·등·손·효과 새 코스튬. 그림은 renderer/accessories-*6.js
  { key: 'humming', price: 400, level: 15, slot: 'effect' },
  { key: 'matrixrain', price: 3000, level: 70, slot: 'effect' },
  { key: 'loadspin', price: 500, level: 25, slot: 'effect' },
  { key: 'autumnleaf', price: 800, level: 39, slot: 'effect' },
  { key: 'flytrio', price: 250, level: 5, slot: 'effect' },
  { key: 'afterimage', price: 4200, level: 76, slot: 'effect' },
  { key: 'glitchfx', price: 2600, level: 68, slot: 'effect' },
  { key: 'frostbreath', price: 500, level: 25, slot: 'effect' },
  { key: 'dizzystars', price: 350, level: 15, slot: 'effect' },
  { key: 'thinkbubble', price: 1200, level: 52, slot: 'effect' },
  { key: 'flyswatter', price: 250, level: 5, slot: 'hand' },
  { key: 'karaokemic', price: 650, level: 33, slot: 'hand' },
  { key: 'hotteokturner', price: 450, level: 20, slot: 'hand' },
  { key: 'cupbokki', price: 350, level: 15, slot: 'hand' },
  { key: 'megaphone', price: 700, level: 36, slot: 'hand' },
  { key: 'taegeukfan', price: 900, level: 45, slot: 'hand' },
  { key: 'magnifier', price: 850, level: 42, slot: 'hand' },
  { key: 'cottoncandy', price: 550, level: 30, slot: 'hand' },
  { key: 'yoyohand', price: 400, level: 20, slot: 'hand' },
  { key: 'ventiamericano', price: 950, level: 48, slot: 'hand' },
  { key: 'ppyonghammer', price: 500, level: 25, slot: 'hand' },
  { key: 'wiltbouquet', price: 1100, level: 50, slot: 'hand' },
  { key: 'kitchenknife', price: 1300, level: 54, slot: 'hand' },
  { key: 'torchhand', price: 1600, level: 60, slot: 'hand' },
  { key: 'sniperrifle', price: 2400, level: 66, slot: 'hand' },
  { key: 'bananahand', price: 200, slot: 'hand' },
  { key: 'carrothand', price: 250, level: 5, slot: 'hand' },
  { key: 'birdnest', price: 600, level: 30, slot: 'head' },
  { key: 'glovecomb', price: 250, level: 5, slot: 'head' },
  { key: 'shrimpband', price: 450, level: 25, slot: 'head' },
  { key: 'mushcap', price: 550, level: 30, slot: 'head' },
  { key: 'gradcap', price: 800, level: 39, slot: 'head' },
  { key: 'monkeyhood', price: 700, level: 36, slot: 'head' },
  { key: 'grannyspecs', price: 300, level: 10, slot: 'face' },
  { key: 'cucumbereyes', price: 250, level: 5, slot: 'face' },
  { key: 'caterbrows', price: 300, level: 10, slot: 'face' },
  { key: 'foggyglasses', price: 350, level: 15, slot: 'face' },
  { key: 'masquerade', price: 800, level: 39, slot: 'face' },
  { key: 'overtimer', price: 1400, level: 25, slot: 'set', covers: ['head', 'face', 'neck', 'hand'] },
  { key: 'seonbi', price: 2100, level: 33, slot: 'set', covers: ['head', 'neck'] },
  { key: 'dinosuit', price: 1300, level: 28, slot: 'set', covers: ['head', 'neck', 'back'] },
  // 크리스마스트리는 2026-09-25 에 모자(머리)와 옷(몸)으로 나눴다
  { key: 'xmasstar', price: 600, level: 45, slot: 'head' },
  { key: 'xmastree', price: 900, level: 45, slot: 'neck' },
  { key: 'mondaydev', price: 1700, level: 23, slot: 'set', covers: ['head', 'face', 'neck', 'back'] },
  { key: 'schoolwear', price: 800, level: 42, slot: 'neck' },
  { key: 'aloha', price: 700, level: 33, slot: 'neck' },
  { key: 'baseballuni', price: 800, level: 39, slot: 'neck' },
  { key: 'snailhouse', price: 1200, level: 52, slot: 'back' },
  { key: 'shieldkite', price: 1000, level: 48, slot: 'back' },
  { key: 'surfboard', price: 1200, level: 52, slot: 'back' },
  { key: 'ninetails', price: 3600, level: 74, slot: 'back' },
  { key: 'monkeytail', price: 700, level: 36, slot: 'back' },
  // 보물 공방 전용 (2026-09-24): 상점에서는 안 판다. 조합표는 main/workshop.js, 그림은 renderer/accessories-workshop-*.js
  { key: 'capcrown', price: 0, slot: 'head', workshop: true },
  { key: 'rubberslingshot', price: 0, slot: 'hand', workshop: true },
  { key: 'receiptcape', price: 0, slot: 'back', workshop: true },
  { key: 'bubblearmor', price: 0, slot: 'neck', workshop: true },
  { key: 'dustscarf', price: 0, slot: 'neck', workshop: true },
  { key: 'strawglasses', price: 0, slot: 'face', workshop: true },
  { key: 'leafwreath', price: 0, slot: 'head', workshop: true },
  { key: 'buttonnecklace', price: 0, slot: 'neck', workshop: true },
  { key: 'toothpickrapier', price: 0, slot: 'hand', workshop: true },
  { key: 'pigeonhat', price: 0, slot: 'head', workshop: true },
  { key: 'candysparkle', price: 0, slot: 'effect', workshop: true },
  { key: 'socksock', price: 0, slot: 'hand', workshop: true },
  { key: 'esckeycap', price: 0, slot: 'neck', workshop: true },
  { key: 'legohelm', price: 0, slot: 'head', workshop: true },
  { key: 'coinmedal', price: 0, slot: 'neck', workshop: true },
  { key: 'crayondoodle', price: 0, slot: 'effect', workshop: true },
  { key: 'ddakjicape', price: 0, slot: 'back', workshop: true },
  { key: 'staticshock', price: 0, slot: 'effect', workshop: true },
  { key: 'cicadasuit', price: 0, slot: 'set', covers: ['head', 'neck'], workshop: true },
  { key: 'acorncheeks', price: 0, slot: 'face', workshop: true },
  { key: 'legendcapcrown', price: 0, slot: 'head', workshop: true },
  { key: 'lotteryfan', price: 0, slot: 'hand', workshop: true },
  { key: 'usbantenna', price: 0, slot: 'head', workshop: true },
  { key: 'gatekeeper', price: 0, slot: 'set', covers: ['head', 'neck', 'back'], workshop: true },
  // --- 7차 (2026-09-24 확정): 세트 6 · 얼굴 22 · 몸 11 · 손 6 · 효과 14. 그림은 renderer/accessories-7.js ---
  { key: 'nyangwarts', price: 2800, level: 40, slot: 'set', covers: ['head', 'neck', 'hand'] },
  { key: 'cyberhacker', price: 3800, level: 45, slot: 'set', covers: ['head', 'face', 'neck'] },
  { key: 'holyknight', price: 5600, level: 57, slot: 'set', covers: ['head', 'face', 'neck', 'hand', 'back'] },
  { key: 'sunwukong', price: 5800, level: 60, slot: 'set', covers: ['head', 'neck', 'hand', 'back'] },
  { key: 'mudang', price: 4200, level: 50, slot: 'set', covers: ['head', 'neck', 'hand'] },
  { key: 'exorcist', price: 5400, level: 53, slot: 'set', covers: ['neck', 'back'] },
  { key: 'shuttershades', price: 450, level: 25, slot: 'face' },
  { key: 'weldgoggles', price: 500, level: 30, slot: 'face' },
  { key: 'skigoggles', price: 700, level: 36, slot: 'face' },
  { key: 'aviators', price: 600, level: 30, slot: 'face' },
  { key: 'hahoe', price: 1200, level: 50, slot: 'face' },
  { key: 'gaksital', price: 1200, level: 50, slot: 'face' },
  { key: 'foxmask', price: 900, level: 45, slot: 'face' },
  { key: 'luchamask', price: 1600, level: 60, slot: 'face' },
  { key: 'gasmask', price: 700, level: 36, slot: 'face' },
  { key: 'robbermask', price: 350, level: 15, slot: 'face' },
  { key: 'phantommask', price: 1100, level: 48, slot: 'face' },
  { key: 'dokkaebimask', price: 1500, level: 56, slot: 'face' },
  { key: 'stareyes', price: 400, level: 20, slot: 'face' },
  { key: 'lasereyes', price: 1800, level: 62, slot: 'face' },
  { key: 'cybereye', price: 1400, level: 56, slot: 'face' },
  { key: 'claudeeyes', price: 1000, level: 48, slot: 'face' },
  { key: 'bubblegum', price: 350, level: 10, slot: 'face' },
  { key: 'buckteeth', price: 250, level: 5, slot: 'face' },
  { key: 'nosebleed', price: 200, slot: 'face' },
  { key: 'sagebeard', price: 900, level: 45, slot: 'face' },
  { key: 'camopaint', price: 300, level: 10, slot: 'face' },
  { key: 'goggletan', price: 300, level: 10, slot: 'face' },
  { key: 'idcardshirt', price: 500, level: 25, slot: 'neck' },
  { key: 'turtleneck', price: 600, level: 33, slot: 'neck' },
  { key: 'princessdress', price: 1300, level: 54, slot: 'neck' },
  { key: 'sequindress', price: 2200, level: 64, slot: 'neck' },
  { key: 'sailor', price: 800, level: 42, slot: 'neck' },
  { key: 'baristaapron', price: 700, level: 33, slot: 'neck' },
  { key: 'goldcuirass', price: 3400, level: 72, slot: 'neck' },
  { key: 'blackknight', price: 3000, level: 70, slot: 'neck' },
  { key: 'vampcape', price: 2400, level: 66, slot: 'neck' },
  { key: 'dragonscale', price: 2800, level: 68, slot: 'neck' },
  { key: 'melonsuit', price: 450, level: 20, slot: 'neck' },
  { key: 'tanghulu', price: 300, level: 10, slot: 'hand' },
  { key: 'seoyebut', price: 600, level: 30, slot: 'hand' },
  { key: 'goldsword', price: 3800, level: 74, slot: 'hand' },
  { key: 'chorong', price: 900, level: 45, slot: 'hand' },
  { key: 'witchbroom', price: 1600, level: 60, slot: 'hand' },
  { key: 'spellbook', price: 2600, level: 68, slot: 'hand' },
  { key: 'rainbowarc', price: 900, level: 45, slot: 'effect' },
  { key: 'thunderstorm', price: 1200, level: 52, slot: 'effect' },
  { key: 'fireflies', price: 700, level: 36, slot: 'effect' },
  { key: 'aurora', price: 2600, level: 68, slot: 'effect' },
  { key: 'meteorshower', price: 2200, level: 64, slot: 'effect' },
  { key: 'windblown', price: 400, level: 20, slot: 'effect' },
  { key: 'livehearts', price: 1000, level: 48, slot: 'effect' },
  { key: 'fireaura', price: 3600, level: 72, slot: 'effect' },
  { key: 'iceaura', price: 3600, level: 74, slot: 'effect' },
  { key: 'thunderaura', price: 3800, level: 74, slot: 'effect' },
  { key: 'darkaura', price: 3600, level: 72, slot: 'effect' },
  { key: 'magiccircle', price: 3000, level: 70, slot: 'effect' },
  { key: 'heavenbeam', price: 4400, level: 78, slot: 'effect' },
  { key: 'dragonaura', price: 5200, level: 80, slot: 'effect' },
];

// 코스튬 칸. 이 순서대로 겹쳐 그린다 (뒤에 있는 것부터: 효과 → 등 → 목 → 얼굴 → 세트 → 머리 → 손)
const COSTUME_SLOTS = ['effect', 'back', 'neck', 'face', 'set', 'head', 'hand'];
// 화면에 보여 주는 칸 순서 (옷장·상점 분류)
const COSTUME_TABS = ['set', 'head', 'face', 'neck', 'back', 'hand', 'effect'];

// 입고 있는 것 { 칸: 키 } 을 그리는 순서대로 늘어놓은 키 목록
function outfitList(outfit) {
  return COSTUME_SLOTS.map((s) => (outfit || {})[s]).filter((k) => k && k !== 'none');
}

// 예전에 팔다가 상점에서 뺀 악세사리. 산 사람에게는 코인을 돌려준다 (main.js 의 migrateShop)
const RETIRED_ACCESSORIES = [
  // 8차 (2026-09-24): 6차 코스튬 중 28종 · 보물 공방 1종을 뺐다 (공방 것은 공짜라 돌려줄 코인 없음)
  { key: 'scubatank', price: 1100 },
  { key: 'hikepack', price: 1300 },
  { key: 'almostclover', price: 0 },
  { key: 'churubib', price: 350 },
  { key: 'turtleshell', price: 900 },
  { key: 'backscratcher', price: 500 },
  { key: 'bottari', price: 800 },
  { key: 'surveycorps', price: 3600 },
  { key: 'earpencil', price: 150 },
  { key: 'donuthalo', price: 700 },
  { key: 'hardhat', price: 500 },
  { key: 'tpcrown', price: 200 },
  { key: 'xbandaid', price: 150 },
  { key: 'goldmonocle', price: 900 },
  { key: 'braces', price: 400 },
  { key: 'darkcircles', price: 250 },
  { key: 'mouthrose', price: 600 },
  { key: 'econe', price: 300 },
  { key: 'grannyapron', price: 600 },
  { key: 'lifevest', price: 700 },
  { key: 'pajamas', price: 600 },
  { key: 'neckpillow', price: 450 },
  { key: 'blueteam', price: 400 },
  { key: 'churubag', price: 900 },
  { key: 'dragontattoo', price: 1600 },
  { key: 'podaegi', price: 1500 },
  { key: 'teddyhand', price: 800 },
  { key: 'sandbucket', price: 600 },
  { key: 'bugcrawl', price: 600 },
  // 7차 (2026-09-23): 공주 리본 · 딸기 모자 · 둔갑술 나뭇잎 · 악마 뿔 머리띠 · 쿠나이
  { key: 'ribbon', price: 250 },
  { key: 'berryhat', price: 450 },
  { key: 'tanukileaf', price: 200 },
  { key: 'devilband', price: 300 },
  { key: 'kunai', price: 800 },
  { key: 'flower', price: 550 },
  { key: 'cap', price: 750 },
  { key: 'shades', price: 950 },
  { key: 'horns', price: 1400 },
  { key: 'bowtie', price: 300 }, // 2026-09-22 턱시도로 바뀜
  { key: 'rambo', price: 1200 }, // 2026-09-23 삭제
  { key: 'burgerset', price: 1100 }, // 2026-09-23 삭제
  { key: 'deliverycat', price: 1000 }, // 2026-09-23 삭제
  { key: 'heartshades', price: 550 }, // 2026-09-23 삭제
];

// 먹이 하나가 채우는 배부름. 비쌀수록 많이 찬다: 밥 20 + 가격 × 0.5, 간식 3 + 가격 × 0.3.
// fill 을 적어 둔 건 그 값 그대로 (다이어트 공기 = 0)
const fillOf = (it) => (typeof it.fill === 'number' ? it.fill : Math.round(it.group === 'meal' ? 20 + it.price * 0.5 : 3 + it.price * 0.3));

// 먹이 — 먹이면 없어진다. 밥(meal)은 배고픔을 다 채우고, 간식(snack)은 배는 거의 안 차는 대신 기분이 확 좋아진다.
// 공짜 밥은 없다. 전부 코인으로 사서 준다
const FOODS = [
  { key: 'milk', group: 'meal', price: 15 },
  { key: 'pouch', group: 'meal', price: 25 },
  { key: 'tuna', group: 'meal', price: 30 },
  { key: 'chicken', group: 'meal', price: 35 },
  { key: 'fishgrill', group: 'meal', price: 40 },
  { key: 'omurice', group: 'meal', price: 50 },
  { key: 'salmon', group: 'meal', price: 60 },
  { key: 'tempura', group: 'meal', price: 65 },
  { key: 'ramen', group: 'meal', price: 70 },
  { key: 'sushi', group: 'meal', price: 75 },
  { key: 'bento', group: 'meal', price: 90 },
  // 3차 (2026-09-22): 기운 음식 — 배도 채우고 기운도 조금 채운다 (energy)
  { key: 'tonkotsu', group: 'meal', price: 85, energy: 15 },
  { key: 'truffleJjajang', group: 'meal', price: 95, energy: 12 },
  { key: 'emberChicken', group: 'meal', price: 80, energy: 18 },
  { key: 'grandmaKimchi', group: 'meal', price: 60, energy: 20 },
  { key: 'churu', group: 'snack', price: 15 },
  { key: 'anchovy', group: 'snack', price: 15 },
  // 2차 (2026-09-22): 고양이 세계에만 있는 수상한 간식. fill = 배부름이 얼마나 차나 (없으면 간식 기본값)
  { key: 'creamtaiyaki', group: 'snack', price: 35 },
  { key: 'roachchip', group: 'snack', price: 20 },
  { key: 'nipteabag', group: 'snack', price: 45 },
  { key: 'cricket', group: 'snack', price: 30 },
  { key: 'mosquitojelly', group: 'snack', price: 25 },
  { key: 'flysoda', group: 'snack', price: 25 },
  { key: 'frogtea', group: 'snack', price: 40 },
  { key: 'wormgummy', group: 'snack', price: 20 },
  { key: 'hairfloss', group: 'snack', price: 15 },
  { key: 'churubar', group: 'snack', price: 40 },
  { key: 'tunalatte', group: 'snack', price: 35 },
  { key: 'vinylchip', group: 'snack', price: 20 },
  { key: 'foilcandy', group: 'snack', price: 25 },
  { key: 'bonemacaron', group: 'snack', price: 50 },
  { key: 'churuchamp', group: 'snack', price: 75 },
  // 3차 (2026-09-22)
  { key: 'cookieMilk', group: 'snack', price: 40 },
  { key: 'dubaiSmelt', group: 'snack', price: 55 },
  { key: 'pumpkinLatte', group: 'snack', price: 45 },
  { key: 'dietair', group: 'snack', price: 5, fill: 0 },
  { key: 'goldmackerel', group: 'snack', price: 150 },
];

// 상점에서 뺀 간식 (2026-09-21 개편: 츄르·멸치·아이스크림만 남겼다). 창고에 남은 건 산 값만큼 코인으로 돌려준다
// 2026-09-22 에 뺀 간식도 같은 식으로 (아이스크림·생쥐 앞다리·도마뱀 떡볶이·테이프 캔디·쥐돌이 크림빵)
const RETIRED_FOODS = {'icecream': 100, 'mouseleg': 30, 'lizardtteok': 45, 'tapecandy': 20, 'goldfishjelly': 50, 'fishcookie': 40, 'strawberry': 45, 'cheese': 50, 'jerky': 60, 'yogurt': 65, 'taiyaki': 70, 'dango': 75, 'watermelon': 80, 'pudding': 90, 'croissant': 95, 'macaron': 100, 'catjelly': 110, 'catnip': 120, 'donut': 130, 'cake': 180};

// 이름이 바뀐 옛 간식. 창고에 남은 건 새 이름으로 옮긴다
const RENAMED_FOODS = { cookie: 'fishcookie', fish: 'fishgrill', shrimp: 'tempura' };

// 장난감 — 한 번 사면 계속 쓴다. 우클릭으로 꺼내서 논다
// 장난감마다 고양이가 노는 방식은 renderer/pet.js 의 TOY_DEFS 에 있다
const TOYS = [
  { key: 'ball', price: 250 },
  { key: 'yarn', price: 300 },
  { key: 'wand', price: 400, level: 10 },
  { key: 'catnip', price: 500, level: 20 },
  { key: 'box', price: 800, level: 25 },
  { key: 'scratcher', price: 850, level: 30 },
  { key: 'windup', price: 900, level: 36 },
  { key: 'laser', price: 950, level: 42 },
  { key: 'bubbles', price: 1050 },
  // 2차 (2026-09-22): 동작은 renderer/toyplay*.js 가 갖는다
  { key: 'grenade', price: 1200, level: 52 },
  { key: 'squirtgun', price: 900, level: 33 },
  { key: 'balloon', price: 500, level: 15 },
  { key: 'cup', price: 350, level: 5 },
  { key: 'bananapeel', price: 300 },
  { key: 'catwheel', price: 2000, level: 66 },
  { key: 'vacuum', price: 1100, level: 50 },
  { key: 'boxtower', price: 950, level: 39 },
  { key: 'magichat', price: 1300, level: 58 },
  { key: 'slotmachine', price: 2500, level: 70 },
  { key: 'snowball', price: 450, level: 15 },
  { key: 'rccar', price: 1200, level: 56 },
  { key: 'ufotoy', price: 2200, level: 68 },
  { key: 'ballshooter', price: 1350, level: 60 },
  { key: 'jumprope', price: 550, level: 20 },
  { key: 'catlaptop', price: 1500, level: 62 },
  // 3차 (2026-09-24): 사람과 같이 하는 놀이. 동작은 renderer/toyplay4.js
  { key: 'rps', price: 400, level: 10 },
  { key: 'tugrope', price: 700, level: 25 },
  { key: 'whackcat', price: 850, level: 30 },
  { key: 'domino', price: 950, level: 39 },
  { key: 'trampoline', price: 1100, level: 48 },
];

// 상점에서 뺀 장난감 (2026-09-22: 종이봉투·방울공·요요). 산 사람에게는 코인을 돌려준다 (migrate)
const RETIRED_TOYS = [
  // 7차 (2026-09-23): 쥐돌이 · 깃털 · 뿅망치 · 드론 · 휴지 롤 · 방울 달린 막대 새
  { key: 'mouse', price: 350 },
  { key: 'feather', price: 500 },
  { key: 'squeakhammer', price: 550 },
  { key: 'drone', price: 1450 },
  { key: 'tissue', price: 400 },
  { key: 'birdwand', price: 500 },
  { key: 'bag', price: 400 },
  { key: 'jingle', price: 550 },
  { key: 'yoyo', price: 400 },
];

// 슬롯머신 한 판 값과 릴 그림 수 (마지막 그림은 해골 = 꽝)
const SLOT_PRICE = 15; // 2026-09-24: 10 → 15
const SLOT_SYMBOLS = 5;

// 모션 자리(상황). 상황마다 기본(공짜) 모션이 있고, 산 모션은 어느 상황에든 끼울 수 있다.
//  free  : 처음부터 쓸 수 있는 모션. 맨 앞이 기본값이고, 이 자리의 권장 모션이기도 하다
//  multi : 여러 개를 골라 두면 고른 순서대로 차례차례 번갈아 한다 (2026-09-23 부터 모든 자리가 multi)
// 순서가 곧 설정 화면 순서다.
// type·curl·wait·happy·levelup·wave 는 motions.js 가 아니라 sprite.js 의 기본 자세라서 원래 자리에서만 쓴다 (BASIC_POSES)
const MOTION_SLOTS = [
  { key: 'work', free: ['type'], multi: true }, // Claude 가 일하는 동안
  { key: 'workLong', free: ['type'], multi: true }, // 15분 넘게 쉬지 않고 이어서 일할 때 (main.js 의 WORK_TIERS)
  { key: 'workHour', free: ['type'], multi: true }, // 1시간 넘게 이어서 일할 때
  { key: 'waiting', free: ['wait'], multi: true }, // Claude 가 권한·확인을 기다릴 때. wait = 느낌표 띄우고 손 흔드는 원래 자세
  { key: 'done', free: ['happy', 'hooray'], multi: true }, // Claude 가 답을 끝냈을 때
  { key: 'levelup', free: ['levelup', 'fireup'], multi: true }, // 레벨 업·업적
  { key: 'wear', free: ['happy', 'blowkiss'], multi: true }, // 꾸미기 아이템을 장착했을 때
  { key: 'sleep', free: ['curl', 'nodoff'], multi: true }, // 졸리거나 잠들었을 때 (둘 다 이 모션)
  { key: 'poke', free: ['happy', 'blowkiss'], multi: true }, // 쓰다듬었을 때
  { key: 'rest', free: ['stretch'], multi: true }, // 오래 일해서 쉬자고 할 때
  { key: 'hungry', free: ['fishthink'], multi: true }, // 배고파서 조를 때 (오래 굶겨도 이 모션. 대사만 더 처절해진다)
  { key: 'idle', free: ['loaf', 'bath', 'zoomies', 'box', 'coffee'], multi: true }, // 심심할 때 가끔
];
const BASIC_POSES = new Set(['type', 'curl', 'wait', 'happy', 'levelup', 'wave']);
// 공짜 모션 중 기본 자세가 아닌 것 (어느 자리에든 끼울 수 있다)
const FREE_MOTIONS = new Set(MOTION_SLOTS.flatMap((x) => x.free).filter((k) => !BASIC_POSES.has(k)));

// 세트 전용 모션: 그 세트를 입고 있으면 '심심할 때'에 저절로 섞여 나온다. 상점·설정에는 안 나온다 (renderer/motions.js 6차)
const SET_MOTIONS = {
  'spidercat': [
    'spider',
    'webhang'
  ],
  'ninjaset': [
    'ninja',
    'bunshin',
    'leafwarp'
  ],
  'ironcat': [
    'ironflight',
    'repulsor'
  ],
  'aliencat': [
    'ufoflyby',
    'ufowarp',
    'telekinesis'
  ],
  'beesuit': [
    'honeypot',
    'waggle'
  ],
  'magicalgirl': [
    'heartbeam',
    'starcall'
  ],
  'reaper': [
    'namebook',
    'kpopdance'
  ],
  'robocat': [
    'recharge',
    'rocketpunch',
    'reboot'
  ],
  'overtimer': [
    'sojushot',
    'nightcall',
    'fighting'
  ],
  'seonbi': [
    'examboard',
    'calligraphy',
    'dozebook'
  ],
  'dinosuit': [
    'shortarms',
    'eggpop'
  ],
  'mondaydev': [
    'deployfire',
    'icedrip'
  ],
  // 9차 (2026-09-25): 7차 새 세트
  'nyangwarts': [
    'broomloop',
    'invischloak'
  ],
  'cyberhacker': [
    'hacktype',
    'glitch'
  ],
  'holyknight': [
    'shieldblock',
    'holywings'
  ],
  'sunwukong': [
    'dustdisguise',
    'ruyistaff',
    'cloudloop'
  ],
  'mudang': [
    'bellshake',
    'fandance',
    'churugod'
  ],
  'exorcist': [
    'holywater',
    'demonturn'
  ]
};

// 예전에 팔다가 뺀 모션. 산 사람에게는 코인을 돌려준다 (스파이더냥·닌자 변신은 세트 전용으로 옮겼다)
const RETIRED_MOTIONS = [
  { key: 'giant', price: 650 }, // 2026-09-24: 커지면 캔버스 밖으로 나간 부분이 잘려서 뺐다
  { key: 'lietype', price: 1050 },
  { key: 'zoneout', price: 500 },
  { key: 'keyboardnap', price: 900 },
  { key: 'magic', price: 900 },
  { key: 'gamer', price: 800 },
  { key: 'shy', price: 550 },
  { key: 'refill', price: 900 },
  { key: 'hourglass', price: 550 },
  { key: 'rain', price: 550 },
  { key: 'flex', price: 950 },
  { key: 'sleeptalk', price: 800 },
  { key: 'headbonk', price: 800 },
  { key: 'eyemask', price: 800 },
  { key: 'snoring', price: 800 },
  { key: 'tailheart', price: 800 },
  { key: 'champagne', price: 800 },
  { key: 'phonetime', price: 800 },
  { key: 'cry', price: 550 },
  { key: 'spider', price: 1300 },
  { key: 'ninja', price: 900 },
];

// 상점에서 파는 모션 (전부 B급). rec = 권장 자리. 권장일 뿐이고 산 모션은 어느 자리에든 끼울 수 있다
const MOTIONS = [
  // --- 6차 (2026-09-23 확정) ---
  { key: 'giantfist', rec: ['workLong', 'workHour'], price: 650, level: 64 },
  { key: 'trophy', rec: ['done', 'levelup'], price: 550, level: 50 },
  { key: 'laptoptoss', rec: ['rest'], price: 600, level: 56 },
  { key: 'smokereveal', rec: ['wear'], price: 550, level: 48 },
  { key: 'curtainreveal', rec: ['wear'], price: 600, level: 52 },
  { key: 'drums', rec: ['idle'], price: 600, level: 54 },
  { key: 'piano', rec: ['idle'], price: 600, level: 56 },
  { key: 'electricjam', rec: ['idle'], price: 650, level: 60 },
  { key: 'ropeskip', rec: ['idle'], price: 500, level: 30 },
  { key: 'sneeze', rec: ['idle'], price: 250 },
  { key: 'hiccup', rec: ['idle'], price: 250 },
  { key: 'fart', rec: ['idle'], price: 300 },
  { key: 'codefrenzy', rec: ['work', 'workLong', 'workHour'], price: 500, level: 15 },
  { key: 'snot', rec: ['sleep'], price: 550, level: 48 },
  { key: 'workout', rec: ['rest', 'idle'], price: 550, level: 52 },
  { key: 'soul', rec: ['rest', 'workHour'], price: 650, level: 70 },
  { key: 'cafe', rec: ['rest', 'idle'], price: 500, level: 15 },
  { key: 'karaoke', rec: ['idle', 'levelup'], price: 350, level: 5 },
  { key: 'gum', rec: ['idle'], price: 350 },
  { key: 'ghost', rec: ['idle'], price: 300 },
  { key: 'dealwithit', rec: ['done', 'levelup', 'wear'], price: 350 },
  { key: 'rocket', rec: ['levelup', 'done'], price: 700, level: 74 },
  { key: 'explode', rec: ['hungry', 'workHour'], price: 650, level: 62 },
  { key: 'smoke', rec: ['rest'], price: 500, level: 33 },
  { key: 'soju', rec: ['rest', 'idle'], price: 500, level: 36 },
  { key: 'bubbles', rec: ['idle'], price: 300 },
  { key: 'ufo', rec: ['idle'], price: 700, level: 76 },
  { key: 'codeflame', rec: ['work', 'workLong', 'workHour'], price: 650, level: 58 },
  { key: 'skullsmoke', rec: ['rest'], price: 550, level: 45 },
  { key: 'lightning', rec: ['idle', 'workHour'], price: 550, level: 42 },
  { key: 'monitors', rec: ['work', 'workLong'], price: 500, level: 25 },
  { key: 'papers', rec: ['workLong', 'workHour'], price: 550, level: 45 },
  { key: 'aura', rec: ['workHour'], price: 700, level: 72 },
  { key: 'tapfoot', rec: ['waiting'], price: 350, level: 10 },
  { key: 'blanket', rec: ['sleep'], price: 500, level: 10 },
  { key: 'grumpy', rec: ['poke'], price: 350 },
  { key: 'startle', rec: ['poke'], price: 500, level: 36 },
  { key: 'melt', rec: ['poke'], price: 550, level: 42 },
  { key: 'popper', rec: ['done', 'levelup'], price: 500, level: 30 },
  { key: 'coronation', rec: ['levelup', 'wear'], price: 650, level: 60 },
  { key: 'levelbanner', rec: ['levelup'], price: 550, level: 39 },
  { key: 'hammock', rec: ['rest', 'sleep'], price: 550, level: 39 },
  { key: 'fooddream', rec: ['hungry'], price: 500, level: 20 },
  { key: 'sipcode', rec: ['work'], price: 500, level: 30 },
  { key: 'headbang', rec: ['work', 'workLong'], price: 500, level: 25 },
  { key: 'eureka', rec: ['work'], price: 500, level: 15 },
  { key: 'smokingkeys', rec: ['workLong', 'workHour'], price: 550, level: 48 },
  { key: 'soulcode', rec: ['workHour'], price: 650, level: 72 },
  { key: 'ivcoffee', rec: ['workHour'], price: 650, level: 68 },
  { key: 'overheat', rec: ['workHour'], price: 650, level: 68 },
  { key: 'raisehand', rec: ['waiting'], price: 350, level: 5 },
  { key: 'pray', rec: ['waiting'], price: 350, level: 5 },
  { key: 'fishdream', rec: ['sleep'], price: 500, level: 20 },
  { key: 'slowblink', rec: ['poke'], price: 500, level: 33 },
  { key: 'shinyfur', rec: ['poke', 'wear'], price: 500, level: 30 },
  { key: 'donebanner', rec: ['done'], price: 500, level: 15 },
  { key: 'bigbutton', rec: ['done'], price: 500, level: 10 },
  { key: 'glowup', rec: ['levelup', 'wear'], price: 650, level: 66 },
  { key: 'fireworksbg', rec: ['levelup', 'done'], price: 650, level: 64 },
  { key: 'teatime', rec: ['rest'], price: 500, level: 39 },
  { key: 'foodsign', rec: ['hungry'], price: 500, level: 20 },
  { key: 'paperplane', rec: ['idle'], price: 500, level: 25 },
  { key: 'airpunch', rec: ['idle'], price: 500, level: 10 },
  { key: 'knitting', rec: ['idle', 'rest'], price: 500, level: 25 },
];

// 모션의 권장 자리들. '일할 때' · '15분 넘게' · '1시간 넘게' 는 서로 호환이라 셋 중 하나에 맞으면 셋 다 권장
const WORK_SLOTS = ['work', 'workLong', 'workHour'];
const slotsOf = (m) => (m.rec.some((s) => WORK_SLOTS.includes(s)) ? [...new Set([...m.rec, ...WORK_SLOTS])] : m.rec);

const ALL = [
  ...ACCESSORIES.map((x) => ({ ...x, kind: 'acc' })),
  ...FOODS.map((x) => ({ ...x, kind: 'food' })),
  ...TOYS.map((x) => ({ ...x, kind: 'toy' })),
  ...MOTIONS.map((x) => ({ ...x, kind: 'motion' })),
];
const find = (key, kind) => ALL.find((x) => x.key === key && (!kind || x.kind === kind));
const slotOf = (key) => MOTION_SLOTS.find((s) => s.key === key) || null;

class Shop {
  // state 는 JsonFile, usage 는 UsageTracker, getSettings/getGrowth 는 함수
  constructor(state, usage, getSettings, getGrowth) {
    this.state = state;
    this.usage = usage;
    this.getSettings = getSettings;
    this.getGrowth = getGrowth;
  }

  // 개발자 모드: 상점 물건이 전부 풀리고 먹이는 공짜. 진짜 옷장·지갑은 건드리지 않아서 끄면 원래대로 돌아간다
  // (배포 전에 지운다)
  dev() {
    return !!this.getSettings().devMode;
  }

  // 코인을 세기 시작하는 시각 = 처음 만난 시각. 그 뒤로 일한 만큼만 코인이 된다.
  // (예전 기록까지 소급해서 쳐 주면 처음부터 다 살 수 있어서 모으는 재미가 없다)
  since() {
    return this.state.get('startedAt') || 0;
  }

  wallet() {
    const tokens = this.usage.totals(this.since()).c;
    // 토큰 코인은 하루씩 계단식으로 센다 (coinsForDay). 업적 보상으로 받은 코인(이미 가진 걸 또 받았을 때)도 번 코인에 넣는다
    const earned = coinsSince(this.usage, this.since()) + WELCOME_COINS + (this.state.get('walletBonus') || 0);
    const spent = this.state.get('walletSpent') || 0;
    return {
      earned,
      spent,
      balance: Math.max(0, earned - spent),
      welcome: WELCOME_COINS,
      rate: { first: FIRST_TOKENS_PER_COIN, cap: DAILY_FIRST_TOKENS, after: AFTER_TOKENS_PER_COIN }, // 계단식 비율 (상점·대시보드 안내문)
      tokens,
      since: this.since(), // 처음 만난 시각. 상점에서 "언제부터 세는지" 를 보여 준다
    };
  }

  owned(key) {
    if (this.dev() && find(key) && find(key).kind !== 'food') return true;
    return (this.state.get('items') || []).includes(key);
  }

  // 먹이는 몇 개 남았나
  stock(key) {
    return (this.state.get('pantry') || {})[key] || 0;
  }

  // 못 사는 이유. 살 수 있으면 null
  blocker(key) {
    const it = find(key);
    if (!it) return 'missing';
    if (it.workshop) return 'workshop'; // 공방에서만 만든다
    if (it.kind !== 'food' && this.owned(key)) return 'owned';
    if (this.dev()) return null;
    if (it.level) {
      const g = this.getGrowth();
      if (!g || g.level < it.level) return 'level';
    }
    if (this.wallet().balance < it.price) return 'coins';
    return null;
  }

  // 산다. { ok, reason, item } 을 돌려준다
  buy(key) {
    const it = find(key);
    const reason = this.blocker(key);
    if (reason) return { ok: false, reason, item: it || null };

    if (this.dev()) {
      // 개발자 모드에서는 돈을 안 받고 기록도 안 남긴다 (먹이만 창고에 넣는다. 나머지는 이미 다 풀려 있다)
      this.state.set({ pantry: { ...(this.state.get('pantry') || {}), [key]: this.stock(key) + 1 } });
      return { ok: true, item: it };
    }
    this.state.set({ walletSpent: (this.state.get('walletSpent') || 0) + it.price });
    // 코인 흐름 도표가 쓰는 구매 기록. 너무 쌓이지 않게 최근 것만 남긴다
    const log = [...(this.state.get('purchases') || []), { at: Date.now(), key, price: it.price }];
    this.state.set({ purchases: log.slice(-300) });
    if (it.kind === 'food') {
      const pantry = { ...(this.state.get('pantry') || {}) };
      pantry[key] = (pantry[key] || 0) + 1;
      this.state.set({ pantry });
    } else {
      this.state.set({ items: [...(this.state.get('items') || []), key] });
    }
    return { ok: true, item: it };
  }

  // 슬롯머신 한 판. 코인 SLOT_PRICE(15)개를 넣고 릴 셋을 돌린다. 해골이 아닌 같은 그림 셋이면 간식 두 개
  spin() {
    if (this.wallet().balance < SLOT_PRICE) return { ok: false, reason: 'coins' };
    this.state.set({ walletSpent: (this.state.get('walletSpent') || 0) + SLOT_PRICE });
    const log = [...(this.state.get('purchases') || []), { at: Date.now(), key: 'slot', price: SLOT_PRICE }];
    this.state.set({ purchases: log.slice(-300) });
    const pick = () => Math.floor(Math.random() * SLOT_SYMBOLS);
    const win = Math.random() < 1 / 6;
    let reels;
    if (win) {
      const s = Math.floor(Math.random() * (SLOT_SYMBOLS - 1));
      reels = [s, s, s];
    } else {
      do reels = [pick(), pick(), pick()];
      while (reels[0] === reels[1] && reels[1] === reels[2] && reels[0] !== SLOT_SYMBOLS - 1);
    }
    const snacks = FOODS.filter((x) => x.group === 'snack' && x.fill !== 0);
    const prize = win ? [0, 1].map(() => snacks[Math.floor(Math.random() * snacks.length)].key) : [];
    return { ok: true, reels, win, prize };
  }

  // 먹이 하나를 꺼낸다
  useFood(key) {
    const it = find(key, 'food');
    if (!it || this.stock(key) < 1) return null;
    const pantry = { ...(this.state.get('pantry') || {}) };
    pantry[key] = pantry[key] - 1;
    if (!pantry[key]) delete pantry[key];
    this.state.set({ pantry });
    return it;
  }

  // 이 자리에 이 모션을 끼울 수 있나. 그 자리의 기본 모션, 공짜 모션, 산 모션이면 어디든 된다
  // (기본 자세 type·curl 등은 원래 자리에서만)
  canUseMotion(slot, key) {
    const s = slotOf(slot);
    if (!s) return false;
    if (s.free.includes(key)) return true;
    if (BASIC_POSES.has(key)) return false;
    if (FREE_MOTIONS.has(key)) return true;
    return !!find(key, 'motion') && this.owned(key);
  }

  // 업적 보상 넣어 주기. { food: { 키: 개수 } } 는 창고에, { item: 키 } 는 옷장에.
  // 이미 가진 걸 또 받으면 그 값만큼 코인으로 돌려준다. 무엇을 줬는지 돌려준다
  give(reward) {
    if (!reward) return null;
    // 코인 보상 (7차 업적): 지갑에 바로 더한다
    if (reward.coins) {
      this.state.set({ walletBonus: (this.state.get('walletBonus') || 0) + reward.coins });
      return { coins: reward.coins, kind: 'coins' };
    }
    if (reward.food) {
      const pantry = { ...(this.state.get('pantry') || {}) };
      for (const [k, n] of Object.entries(reward.food)) if (find(k, 'food')) pantry[k] = (pantry[k] || 0) + n;
      this.state.set({ pantry });
      return { food: reward.food };
    }
    const it = reward.item && find(reward.item);
    if (!it) return null;
    const items = this.state.get('items') || [];
    if (items.includes(it.key)) {
      this.state.set({ walletBonus: (this.state.get('walletBonus') || 0) + it.price });
      return { item: it.key, kind: it.kind, coins: it.price };
    }
    this.state.set({ items: [...items, it.key] });
    return { item: it.key, kind: it.kind };
  }

  // 예전 버전에서 넘어온 창고·옷장을 지금 목록에 맞춘다. 돌려준 코인 액수를 알려 준다
  migrate() {
    let refund = 0;
    const pantry = { ...(this.state.get('pantry') || {}) };
    let moved = false;
    for (const [from, to] of Object.entries(RENAMED_FOODS)) {
      if (!pantry[from]) continue;
      pantry[to] = (pantry[to] || 0) + pantry[from];
      delete pantry[from];
      moved = true;
    }
    for (const k of Object.keys(pantry)) {
      if (find(k, 'food')) continue;
      refund += (RETIRED_FOODS[k] || 0) * (pantry[k] || 0);
      delete pantry[k];
      moved = true;
    }
    if (moved) this.state.set({ pantry });

    const items = this.state.get('items') || [];
    const gone = [...RETIRED_ACCESSORIES, ...RETIRED_TOYS, ...RETIRED_MOTIONS].filter((r) => items.includes(r.key));
    if (gone.length) {
      refund += gone.reduce((a, r) => a + r.price, 0);
      this.state.set({ items: items.filter((k) => !gone.some((r) => r.key === k)) });
    }
    if (refund) {
      // 쓴 코인보다 돌려줄 게 많으면 남는 건 보너스로 (잃는 코인이 없게)
      const spent = this.state.get('walletSpent') || 0;
      this.state.set({ walletSpent: Math.max(0, spent - refund), walletBonus: (this.state.get('walletBonus') || 0) + Math.max(0, refund - spent) });
    }
    return { refund, retired: gone.map((r) => r.key) };
  }

  // 화면에 뿌릴 목록
  summary() {
    const g = this.getGrowth();
    const level = g ? g.level : 1;
    const row = (it) => ({
      key: it.key,
      kind: it.kind,
      price: it.price,
      level: it.level || null,
      group: it.group || undefined,
      slot: it.slot || undefined,
      covers: it.covers || undefined,
      fill: it.kind === 'food' ? fillOf(it) : undefined,
      energy: it.kind === 'food' ? it.energy || 0 : undefined,
      slots: it.kind === 'motion' ? slotsOf(it) : undefined,
      owned: it.kind === 'food' ? undefined : this.owned(it.key),
      stock: it.kind === 'food' ? this.stock(it.key) : undefined,
      locked: !!(it.level && level < it.level) && !this.dev(),
      blocker: this.blocker(it.key),
    });
    return {
      wallet: this.wallet(),
      dev: this.dev(),
      // 보물 공방 코스튬(workshop)은 상점에 안 나온다. 공방에서 보물로 만든다 (main/workshop.js)
      acc: ACCESSORIES.filter((x) => !x.workshop).map((x) => row({ ...x, kind: 'acc' })),
      food: FOODS.map((x) => row({ ...x, kind: 'food' })),
      toy: TOYS.map((x) => row({ ...x, kind: 'toy' })),
      motion: MOTIONS.map((x) => row({ ...x, kind: 'motion' })),
      slots: MOTION_SLOTS,
      setMotions: SET_MOTIONS, // 세트 카드의 '전용 모션' 버튼이 쓴다
    };
  }
}

module.exports = { SET_MOTIONS, COSTUME_SLOTS, COSTUME_TABS, outfitList, fillOf, Shop, ACCESSORIES, FOODS, TOYS, MOTIONS, MOTION_SLOTS, BASIC_POSES, FREE_MOTIONS, find, slotOf, slotsOf, coinsForDay, coinsSince, WELCOME_COINS, SLOT_PRICE };
