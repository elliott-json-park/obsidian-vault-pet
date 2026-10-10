// 고양이의 배부름 게이지 (0~100).
//  - 시간이 지나면 천천히 준다. 밥을 먹으면 크게, 간식은 조금 오른다. 놀면 아주 조금 준다
//  - 벌이 아니라 덤이다 (2026-10-10): 배가 든든하면(FULL 이상) 깜짝 이벤트(보물)와 동네 친구 방문이 더 잦다.
//    배가 고파도 손해는 없다. 조르는 말풍선만 나온다 (main/treasure.js 의 roll · main/friends.js 의 tick)
//  - 예전 '기운' 게이지는 2026-10-10 에 없앴다 (졸면 금방 차서 하는 일이 없었다). state 에 남은 energy 값은 무시한다
// 값은 state.json 의 gauge 에 { food, at, foodLockUntil } 로 남긴다.
const HOUR = 60 * 60_000;

const FOOD_DROP_PER_HOUR = 25; // 배부름 가득(100) → 배고픔(25) 까지 3시간 (2026-09-29 1차 테스트 피드백: 12 는 너무 느려 밥 주는 재미가 덜했다)
const MEAL = 45;
const SNACK = 12;
const PLAY_FOOD = 1; // 장난감을 한 번 잡을 때마다
const FULL = 50; // 이 이상이면 '든든' (덤이 붙는다)

const clamp = (v) => Math.max(0, Math.min(100, v));

class Gauge {
  constructor(state) {
    this.state = state;
    const g = state.get('gauge');
    this.g = g && typeof g.food === 'number' ? { food: g.food, at: g.at || Date.now(), foodLockUntil: g.foodLockUntil || 0 } : { food: 80, at: Date.now(), foodLockUntil: 0 };
    this.savedAt = 0;
  }

  // 지난번 이후 흐른 시간만큼 줄인다. 고정(프리미엄 음식) 동안은 줄지 않는다
  tick(now = Date.now()) {
    const h = Math.max(0, Math.min(24 * HOUR, now - this.g.at)) / HOUR;
    // 고정(프리미엄 음식) 동안은 줄지 않는다. 24시간 상한은 고정이 끝난 뒤의 시간에 건다
    // (옵시디언판 1.2.4: 상한과 고정 시간이 서로 상쇄돼 오래 꺼 두면 안 줄던 것을 고침)
    const openH = Math.max(0, Math.min(24 * HOUR, now - Math.max(this.g.at, this.g.foodLockUntil || 0))) / HOUR;
    this.g.food = clamp(this.g.food - FOOD_DROP_PER_HOUR * openH);
    this.g.at = now;
    if (now - this.savedAt > 60_000) this.save();
  }

  get() {
    return { food: Math.round(this.g.food), foodLockUntil: this.g.foodLockUntil || 0, full: this.full() };
  }

  // 배가 든든한가 (덤이 붙는 상태)
  full() {
    return this.g.food >= FULL || this.locked();
  }

  // fill 이 있으면 그만큼 (다이어트 공기는 0, 황금 고등어는 듬뿍)
  eat(kind, fill) {
    this.g.food = clamp(this.g.food + (typeof fill === 'number' ? fill : kind === 'meal' ? MEAL : SNACK));
    this.save();
  }

  // ms 동안 배부름이 안 줄어든다 (이미 고정 중이면 더 긴 쪽)
  lockFood(ms, now = Date.now()) {
    this.g.foodLockUntil = Math.max(this.g.foodLockUntil || 0, now + ms);
    this.save();
  }
  locked(now = Date.now()) {
    return now < (this.g.foodLockUntil || 0);
  }

  // 장난감을 한 번 잡았다
  play() {
    if (!this.locked()) this.g.food = clamp(this.g.food - PLAY_FOOD);
  }

  save() {
    this.savedAt = Date.now();
    this.state.set({ gauge: { ...this.g } });
  }
}

module.exports = { Gauge, MEAL, SNACK, FULL };
