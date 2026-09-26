// 깜짝 이벤트와 하찮은 보물.
//
// 켜 두기만 해도 가끔 뭔가 일어난다:
//  fetch : 고양이가 화면 밖으로 나갔다가 뭔가를 물고 돌아온다
//  bird  : 새가 날아가다가 뭔가를 떨어뜨린다
//  rare  : 아주 가끔 평소엔 안 하는 모션을 한다 (보물 없음)
// (동네 친구가 놀러 오는 건 7차부터 main/friends.js 가 따로 맡는다)
// 보물은 전부 정말 하찮은 것들이다. 바닥에 떨어진 걸 눌러서 줍는다(10분 넘게 안 누르면 고양이가 챙겨 둔다).
// 자리를 비운 동안(5분 넘게 키보드·마우스를 안 만짐)에는 이벤트가 일어나지 않는다 (main.js 의 maybeEvent).
// 도트는 renderer/pixelart.js 의 TREASURE, 이름은 renderer/i18n.js 의 'treasure.<key>'.

// from: 어느 이벤트에서 나오나
const TREASURES = [
  // 흔함
  { key: 'bottlecap', rarity: 'common', from: ['fetch'] },
  { key: 'rubberband', rarity: 'common', from: ['fetch'] },
  { key: 'breadtie', rarity: 'common', from: ['fetch'] },
  { key: 'receipt', rarity: 'common', from: ['fetch', 'bird'] },
  { key: 'button', rarity: 'common', from: ['fetch'] },
  { key: 'dustball', rarity: 'common', from: ['fetch'] },
  { key: 'toothpick', rarity: 'common', from: ['fetch'] },
  { key: 'clip', rarity: 'common', from: ['fetch'] },
  { key: 'dryleaf', rarity: 'common', from: ['fetch', 'bird'] },
  { key: 'pebble', rarity: 'common', from: ['fetch'] },
  { key: 'crumb', rarity: 'common', from: ['fetch', 'bird'] },
  { key: 'candywrap', rarity: 'common', from: ['fetch'] },
  { key: 'pigeonfeather', rarity: 'common', from: ['bird'] },
  { key: 'seedshell', rarity: 'common', from: ['bird'] },
  { key: 'twig', rarity: 'common', from: ['bird'] },
  // 드묾
  { key: 'worm', rarity: 'rare', from: ['bird'] },
  { key: 'acorn', rarity: 'rare', from: ['bird'] },
  { key: 'cicada', rarity: 'rare', from: ['fetch', 'bird'] },
  { key: 'crayon', rarity: 'rare', from: ['fetch'] },
  { key: 'coin10', rarity: 'rare', from: ['fetch'] },
  { key: 'keycap', rarity: 'rare', from: ['fetch'] },
  { key: 'eartip', rarity: 'rare', from: ['fetch'] },
  { key: 'lego', rarity: 'rare', from: ['fetch'] },
  { key: 'postit', rarity: 'rare', from: ['fetch', 'bird'] },
  // 전설 (그래도 하찮다)
  { key: 'shinycap', rarity: 'legend', from: ['fetch', 'bird'] },
  { key: 'clover3', rarity: 'legend', from: ['fetch'] },
  { key: 'lottery', rarity: 'legend', from: ['bird'] },
  { key: 'usbcap', rarity: 'legend', from: ['fetch'] },
  // 7차 (2026-09-23): 하찮은 공작 재료로 10종 더
  { key: 'lonesock', rarity: 'common', from: ['fetch'] },
  { key: 'bubblewrap', rarity: 'common', from: ['fetch'] },
  { key: 'drinkstraw', rarity: 'common', from: ['fetch', 'bird'] },
  { key: 'pinecone', rarity: 'common', from: ['bird'] },
  { key: 'bandaid', rarity: 'common', from: ['fetch'] },
  { key: 'googlyeye', rarity: 'rare', from: ['fetch'] },
  { key: 'ddakji', rarity: 'rare', from: ['fetch'] },
  { key: 'marble', rarity: 'rare', from: ['fetch', 'bird'] },
  { key: 'deadbattery', rarity: 'rare', from: ['fetch'] },
  { key: 'oldkey', rarity: 'legend', from: ['fetch', 'bird'] },
];
const RARITY_WEIGHT = { common: 70, rare: 25, legend: 5 };

// 이벤트 종류와 뽑힐 비율
const EVENTS = [
  { type: 'fetch', w: 45 },
  { type: 'bird', w: 40 },
  { type: 'rare', w: 15 },
];
// 이벤트 때만 나오는 모션 (rare). renderer/reactions.js 에 있고 설정·상점에는 없다
const RARE_MOTIONS = ['backflip', 'levitate'];

// 얼마나 자주: 1분마다 이 확률로 (평균 한 시간에 한 번쯤), 이벤트끼리는 최소 이만큼 띄우고, 하루 최대 몇 번
const CHANCE_PER_MIN = 1 / 60;
const MIN_GAP_MS = 20 * 60_000;
const MAX_PER_DAY = 8;

const weighted = (list, w) => {
  let r = Math.random() * list.reduce((a, x) => a + w(x), 0);
  for (const x of list) if ((r -= w(x)) < 0) return x;
  return list[list.length - 1];
};

function pickTreasure(from) {
  const pool = TREASURES.filter((t) => t.from.includes(from));
  return weighted(pool, (t) => RARITY_WEIGHT[t.rarity]).key;
}

const find = (key) => TREASURES.find((t) => t.key === key) || null;

// 이름이 바뀐 보물 (2026-09-24). 장난감 깃털·UI 나뭇잎 도트와 키가 겹쳐서 엉뚱한 그림이 나왔다.
// 이미 주운 건 새 이름으로 옮긴다 (Treasures 를 만들 때 한 번)
const RENAMED = { feather: 'pigeonfeather', leaf: 'dryleaf' };

class Treasures {
  constructor(state) {
    this.state = state;
    this.migrate();
  }

  migrate() {
    const box = { ...this.box() };
    let moved = false;
    for (const [from, to] of Object.entries(RENAMED)) {
      if (!box[from]) continue;
      box[to] = (box[to] || 0) + box[from];
      delete box[from];
      moved = true;
    }
    if (moved) this.state.set({ treasures: box });
    // 한 번이라도 주운 보물 기록 (2026-09-24). 공방 재료·친구 교환으로 개수가 0 이 돼도 도감과 업적은 그대로 남긴다
    const seen = new Set(this.state.get('treasureSeen') || []);
    const before = seen.size;
    for (const [k, n] of Object.entries(box)) if (n > 0) seen.add(RENAMED[k] || k);
    if (seen.size !== before || !this.state.get('treasureSeen')) this.state.set({ treasureSeen: [...seen] });
  }

  // 한 번이라도 주운 보물 종류
  seen() {
    return new Set(this.state.get('treasureSeen') || []);
  }

  // 보물을 쓴다 (공방 재료). { key: 개수 } 를 받아 모자라면 false, 되면 빼고 true
  spend(need) {
    const box = { ...this.box() };
    for (const [k, n] of Object.entries(need)) if ((box[k] || 0) < n) return false;
    for (const [k, n] of Object.entries(need)) {
      box[k] -= n;
      if (!box[k]) delete box[k];
    }
    this.state.set({ treasures: box });
    return true;
  }

  box() {
    return this.state.get('treasures') || {};
  }

  // 주웠다. { count: 이 보물 몇 개째, kinds: 모은 종류 수 } 를 돌려준다
  add(key) {
    if (!find(key)) return null;
    const box = { ...this.box() };
    box[key] = (box[key] || 0) + 1;
    const seen = this.seen();
    const fresh = !seen.has(key);
    seen.add(key);
    this.state.set({ treasures: box, treasureSeen: [...seen] });
    return { count: box[key], kinds: seen.size, total: TREASURES.length, fresh };
  }

  // 이번에 일어날 이벤트. 조건이 안 맞으면 null
  //  ctx = { asleep, busy, force }  (force = 개발자 모드에서 바로 일으키기)
  roll(ctx = {}) {
    const now = Date.now();
    const today = new Date().toDateString();
    const log = this.state.get('eventLog') || { day: today, n: 0, last: 0 };
    if (log.day !== today) Object.assign(log, { day: today, n: 0 });
    if (!ctx.force) {
      if (ctx.busy || log.n >= MAX_PER_DAY || now - log.last < MIN_GAP_MS) return null;
      if (Math.random() >= CHANCE_PER_MIN) return null;
    }
    // 자는 동안에는 고양이가 안 움직인다. 새만 지나간다
    const kinds = ctx.asleep ? EVENTS.filter((e) => e.type === 'bird') : EVENTS;
    const type = ctx.type || weighted(kinds, (e) => e.w).type;
    this.state.set({ eventLog: { day: log.day, n: log.n + 1, last: now } });
    if (type === 'rare') return { type, motion: RARE_MOTIONS[Math.floor(Math.random() * RARE_MOTIONS.length)] };
    return { type, treasure: pickTreasure(type) };
  }

  summary() {
    const box = this.box();
    const seen = this.seen();
    return {
      // seen: 한 번이라도 주웠나 (다 써서 0개여도 도감에는 보인다)
      list: TREASURES.map((t) => ({ key: t.key, rarity: t.rarity, count: box[t.key] || 0, seen: seen.has(t.key) || !!box[t.key] })),
      kinds: TREASURES.filter((t) => seen.has(t.key) || box[t.key]).length,
      total: TREASURES.length,
    };
  }
}

module.exports = { Treasures, TREASURES, find };
