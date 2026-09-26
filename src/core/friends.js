// 동네 친구들 (7차, 2026-09-23). 예전 '동네 고양이 손님'을 넓혀 여러 동물이 놀러 온다.
//
//  - 두 시간쯤마다 한 마리가 놀러 와서 10분 머물다 간다 (자리를 비운 동안은 안 온다)
//  - 단짝이 된 친구는 하우스 '동네 친구들'에서 불러 5분 같이 놀 수 있다. 한 번에 한 친구, 돌아간 뒤 30분 쉬었다가 다시
//  - 올 때마다 원하는 보물과 개수가 달라진다. 그걸 주면 답례로 밥이나 간식을 준다 (물물교환)
//  - 밥·간식을 주면 친해진다. 친밀도: 처음 봄 · 아는 사이 · 친구 · 단짝
//  - 단짝 고양이 친구에게는 보물 공방에서 만든 코스튬을 선물할 수 있다 (2026-09-25). 선물하면 내 인벤토리에서 빠지고,
//    친구는 칸마다 하나씩 입는다. 같은 칸에 새 옷을 주면 먼저 입던 옷은 사라진다. 다른 친구에게 주려면 공방에서 다시 만든다
// 이름·별명·TMI·수다는 renderer/i18n.js 의 'friend.<id>.*', 그림은 renderer/friends.js (고양이 셋은 sprite.js 의 GUEST_FURS)
const { find: findTreasure } = require('./treasure');
const { ACCESSORIES, COSTUME_SLOTS } = require('./shop');

// fur = GUEST_FURS 번호 (고양이 친구), art = renderer/friends.js 의 그림 (동물 친구)
// likes = 물물교환 때 달라고 하는 보물들, gifts = 답례로 주는 먹이들
// generous = 물물교환 답례가 두 배
// 2026-09-25: 족까치·F-22 랩터·개구라가 떠나고 최번개·돈돈까스가 왔다. 떠난 친구들이 좋아하던 보물은 남은 친구들에게 나눴다
const FRIENDS = [
  { id: 'dust', fur: 0, likes: ['dustball', 'pigeonfeather', 'pebble', 'marble', 'seedshell', 'dryleaf'], gifts: ['churu', 'anchovy', 'milk', 'tuna'] },
  { id: 'coal', fur: 1, likes: ['bottlecap', 'deadbattery', 'coin10', 'lottery', 'keycap'], gifts: ['emberChicken', 'chicken', 'churubar', 'anchovy'] },
  { id: 'tofu', fur: 2, likes: ['button', 'rubberband', 'candywrap', 'bandaid', 'lonesock', 'crayon'], gifts: ['milk', 'creamtaiyaki', 'pouch', 'churu'] },
  { id: 'bolt', fur: 4, likes: ['clip', 'usbcap', 'deadbattery', 'keycap', 'googlyeye'], gifts: ['churu', 'chicken', 'milk', 'anchovy'] },
  { id: 'dondon', fur: 5, likes: ['shinycap', 'coin10', 'lottery', 'marble', 'postit'], gifts: ['sushi', 'salmon', 'goldmackerel', 'churuchamp'], generous: true },
  { id: 'pigeon', art: 'pigeon', likes: ['crumb', 'seedshell', 'receipt', 'bottlecap', 'twig', 'pinecone'], gifts: ['bento', 'omurice', 'anchovy', 'cookieMilk'] },
  { id: 'hedgehog', art: 'hedgehog', likes: ['lottery', 'ddakji', 'coin10', 'clover3', 'marble', 'worm'], gifts: ['cricket', 'wormgummy', 'fishgrill', 'churubar'] },
  { id: 'raccoon', art: 'raccoon', likes: ['candywrap', 'crumb', 'bottlecap', 'lonesock', 'bubblewrap', 'drinkstraw'], gifts: ['ramen', 'tonkotsu', 'vinylchip', 'foilcandy'] },
];
// 예전 손님 번호 (0 먼지 1 연탄 2 두부 3 호떡). 호떡은 떠났다
const OLD_GUESTS = ['dust', 'coal', 'tofu'];

// 친밀도: 점수가 이만큼 되면 한 단계 (처음 봄 · 아는 사이 · 친구 · 단짝)
const FRIEND_STEPS = [0, 10, 30, 55]; // 2026-09-24: 6 · 20 · 45 에서 올렸다
const PTS = { visit: 1, meal: 2, snack: 1, trade: 3 };
const MAX_FEEDS = 3; // 한 번 놀러 왔을 때 받아먹는 최대 횟수 (그 뒤로는 배불러서 사양)
const GIFT_CHANCE = [0.2, 0.35, 0.5, 0.7]; // 돌아갈 때 보물을 두고 갈 확률

const VISIT_MS = 10 * 60_000;
const CALL_MS = 5 * 60_000;
const CALL_COOLDOWN_MS = 30 * 60_000;
const VISIT_GAP_MS = 2 * 60 * 60_000; // 두 시간쯤마다 한 마리
const WANT_N = { common: [3, 6], rare: [1, 3], legend: [1, 1] };

const levelOf = (pts) => FRIEND_STEPS.filter((n) => pts >= n).length - 1;
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

class Friends {
  // state = JsonFile. pantry(먹이 창고)·treasures(보물 상자)는 같은 state 에 있다
  constructor(state) {
    this.state = state;
    this.migrate();
    const s = this.st();
    // 켜자마자는 말고, 20분~두 시간 안에 첫 손님
    if (!s.nextAt || s.nextAt < Date.now()) this.save({ nextAt: Date.now() + rint(20, 120) * 60_000 });
    // 앱을 껐다 켜면 방문 중이던 친구는 돌아간 셈
    if (s.visit) this.save({ visit: null });
  }

  st() {
    return this.state.get('friends') || { list: {}, visit: null, nextAt: 0, callReadyAt: 0 };
  }
  save(patch) {
    this.state.set({ friends: { ...this.st(), ...patch } });
  }
  one(id) {
    return (this.st().list || {})[id] || { pts: 0, visits: 0 };
  }
  setOne(id, patch) {
    const list = { ...(this.st().list || {}) };
    list[id] = { ...this.one(id), ...patch };
    this.save({ list });
  }

  // 예전 '동네 고양이' 방문 횟수를 친밀도 점수로 옮긴다 (한 번만)
  // 떠난 친구(족까치·랩터·개구라)의 기록과 방문은 지운다
  migrate() {
    const cur = this.st();
    const gone = Object.keys(cur.list || {}).filter((id) => !FRIENDS.some((f) => f.id === id));
    if (gone.length || (cur.visit && !FRIENDS.some((f) => f.id === cur.visit.id))) {
      const list = { ...(cur.list || {}) };
      for (const id of gone) delete list[id];
      this.save({ list, visit: cur.visit && FRIENDS.some((f) => f.id === cur.visit.id) ? cur.visit : null });
    }
    const old = this.state.get('guests');
    if (!old || this.st().migrated) return;
    const list = { ...(this.st().list || {}) };
    for (const id of OLD_GUESTS) if (old[id] && old[id].visits) list[id] = { pts: old[id].visits * 2, visits: old[id].visits };
    this.save({ list, migrated: true });
  }

  // 지금 놀러 와 있는 친구 (시간이 지났으면 null)
  current() {
    const v = this.st().visit;
    return v && v.until > Date.now() ? v : null;
  }

  // 1분마다 main 이 부른다. 새 손님이 올 때가 됐으면 방문 정보를 돌려준다
  //  ctx = { away, busy } — 자리를 비웠거나(키보드·마우스를 5분 넘게 안 만짐) 바쁘면 미룬다
  tick(ctx = {}) {
    const s = this.st();
    const now = Date.now();
    if (s.visit && s.visit.until <= now) this.finish();
    if (this.current() || now < s.nextAt || ctx.away || ctx.busy) return null;
    return this.start(pick(FRIENDS).id, 'visit');
  }

  // 방문 시작. kind = 'visit'(저절로) | 'call'(불러서)
  start(id, kind) {
    const f = FRIENDS.find((x) => x.id === id);
    if (!f) return null;
    const now = Date.now();
    const wantKey = pick(f.likes);
    const rar = (findTreasure(wantKey) || {}).rarity || 'common';
    const [a, b] = WANT_N[rar];
    const n = rint(a, b);
    const food = pick(f.gifts);
    const give = (rar === 'legend' ? 4 : rar === 'rare' ? 2 + (n > 1 ? 1 : 0) : 1 + Math.floor(n / 3)) * (f.generous ? 2 : 1);
    const visit = { id, kind, at: now, until: now + (kind === 'call' ? CALL_MS : VISIT_MS), want: { key: wantKey, n }, gift: { key: food, n: give }, traded: false, feeds: 0 };
    const before = levelOf(this.one(id).pts);
    this.setOne(id, { visits: this.one(id).visits + 1, pts: this.one(id).pts + PTS.visit, lastAt: now });
    this.save({ visit });
    return { ...visit, level: levelOf(this.one(id).pts), up: levelOf(this.one(id).pts) > before };
  }

  // 돌아간다 (시간이 다 됐거나 앱이 보냈다). 가끔 보물을 두고 간다
  finish() {
    const v = this.st().visit;
    if (!v) return null;
    const lv = levelOf(this.one(v.id).pts);
    const f = FRIENDS.find((x) => x.id === v.id);
    const gift = f && Math.random() < GIFT_CHANCE[lv] ? pick(f.likes) : null;
    const patch = { visit: null, nextAt: Date.now() + VISIT_GAP_MS + rint(-20, 20) * 60_000 };
    if (v.kind === 'call') patch.callReadyAt = Date.now() + CALL_COOLDOWN_MS;
    this.save(patch);
    return { id: v.id, gift };
  }

  // 단짝 부르기: 단짝이고, 아무도 안 와 있고, 쿨타임이 지났으면
  canCall(id) {
    const s = this.st();
    if (levelOf(this.one(id).pts) < 3) return 'notBest';
    if (this.current()) return 'busy';
    if (Date.now() < (s.callReadyAt || 0)) return 'cooldown';
    return null;
  }
  call(id) {
    const why = this.canCall(id);
    if (why) return { error: why };
    return this.start(id, 'call');
  }

  // 물물교환: 원하는 보물을 원하는 만큼 주면 답례 먹이를 준다
  trade() {
    const v = this.current();
    if (!v || v.traded) return { error: v ? 'done' : 'gone' };
    const box = { ...(this.state.get('treasures') || {}) };
    if ((box[v.want.key] || 0) < v.want.n) return { error: 'short' };
    box[v.want.key] -= v.want.n;
    if (!box[v.want.key]) delete box[v.want.key];
    const pantry = { ...(this.state.get('pantry') || {}) };
    pantry[v.gift.key] = (pantry[v.gift.key] || 0) + v.gift.n;
    this.state.set({ treasures: box, pantry });
    this.save({ visit: { ...v, traded: true } });
    return this.addPts(v.id, PTS.trade, { gift: v.gift });
  }

  // 밥·간식 주기 (창고에서 하나 꺼낸다). group = 'meal' | 'snack'
  feed(key, group) {
    const v = this.current();
    if (!v) return { error: 'gone' };
    if (v.feeds >= MAX_FEEDS) return { error: 'full' };
    const pantry = { ...(this.state.get('pantry') || {}) };
    if (!pantry[key]) return { error: 'none' };
    pantry[key]--;
    if (!pantry[key]) delete pantry[key];
    this.state.set({ pantry });
    this.save({ visit: { ...v, feeds: v.feeds + 1 } });
    return this.addPts(v.id, group === 'meal' ? PTS.meal : PTS.snack, { key });
  }

  addPts(id, n, extra) {
    const before = levelOf(this.one(id).pts);
    this.setOne(id, { pts: this.one(id).pts + n });
    const level = levelOf(this.one(id).pts);
    return { ok: true, id, level, up: level > before, ...extra };
  }

  // 선물 받은 코스튬 { 칸: 키 } 과 입는 순서대로의 목록
  wear(id) {
    return { ...(this.one(id).wear || {}) };
  }
  wearList(id) {
    const w = this.wear(id);
    return COSTUME_SLOTS.map((s) => w[s]).filter(Boolean);
  }
  // 선물할 수 있나: 단짝 고양이 친구에게만
  canGift(id) {
    const f = FRIENDS.find((x) => x.id === id);
    if (!f || f.fur == null) return 'notCat';
    if (levelOf(this.one(id).pts) < 3) return 'notBest';
    return null;
  }
  // 선물하기: 내가 실제로 가진 공방 코스튬을 인벤토리에서 빼고 친구가 그 칸에 입는다.
  // 세트면 세트가 덮는 칸도 비우고, 입던 세트가 덮는 칸에 주면 세트를 벗긴다. { ok, id, key, lost: [밀려나 사라진 옷] }
  gift(id, key) {
    const why = this.canGift(id);
    if (why) return { error: why };
    const it = ACCESSORIES.find((a) => a.key === key);
    const items = this.state.get('items') || [];
    if (!it || !it.workshop) return { error: 'notWorkshop' };
    if (!items.includes(key)) return { error: 'notOwned' };
    const wear = this.wear(id);
    const lost = [];
    const drop = (s) => {
      if (wear[s]) lost.push(wear[s]);
      delete wear[s];
    };
    drop(it.slot);
    if (it.slot === 'set') for (const s of it.covers || []) drop(s);
    else if (wear.set && ((ACCESSORIES.find((a) => a.key === wear.set) || {}).covers || []).includes(it.slot)) drop('set');
    wear[it.slot] = key;
    this.state.set({ items: items.filter((k) => k !== key) });
    this.setOne(id, { wear });
    return { ok: true, id, key, lost };
  }

  // 하우스·펫 창에 넘기는 요약
  summary() {
    const s = this.st();
    const v = this.current();
    return {
      now: v ? { id: v.id, kind: v.kind, until: v.until, want: v.want, gift: v.gift, traded: v.traded, feeds: v.feeds, maxFeeds: MAX_FEEDS } : null,
      callReadyAt: s.callReadyAt || 0,
      list: FRIENDS.map((f) => {
        const o = this.one(f.id);
        const level = levelOf(o.pts);
        return { id: f.id, fur: f.fur, art: f.art || null, visits: o.visits, pts: o.pts, level, prev: FRIEND_STEPS[level], next: FRIEND_STEPS[level + 1] || null, likes: f.likes, can: this.canCall(f.id), wear: this.wearList(f.id), wearBy: this.wear(f.id), giftable: !this.canGift(f.id) };
      }),
    };
  }
}

module.exports = { Friends, FRIENDS, FRIEND_STEPS, VISIT_MS, CALL_MS, CALL_COOLDOWN_MS, MAX_FEEDS };
