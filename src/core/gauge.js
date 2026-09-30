// 고양이의 배부름·기운 게이지 (0~100).
//  - 배부름: 시간이 지나면 천천히 준다. 밥을 먹으면 크게, 간식은 조금 오른다
//  - 기운  : 깨어 있으면 천천히, 장난감 놀이를 하면 빨리 준다. 졸거나 자는 동안 다시 찬다
// 둘 중 하나라도 바닥이면 장난감 놀이를 거부한다 (main.js 의 startPlay).
// 값은 state.json 의 gauge 에 { food, energy, at } 로 남긴다.
const HOUR = 60 * 60_000;

const FOOD_DROP_PER_HOUR = 25; // 배부름 가득(100) → 배고픔(25) 까지 3시간 (2026-09-29 1차 테스트 피드백: 12 는 너무 느려 밥 주는 재미가 덜했다)
const ENERGY_DROP_PER_HOUR = 3; // 깨어 있을 때 (100 → 0 까지 30시간쯤)
const ENERGY_REST_PER_HOUR = 50; // 졸거나 잘 때 (0 → 100 까지 2시간쯤)
const MEAL = 45;
const SNACK = 12;
const PLAY_ENERGY = 1.5; // 장난감을 한 번 잡을 때마다 (가득 찬 기운으로 60번쯤 논다)
const PLAY_FOOD = 1;
// 배부름은 이 밑이면, 기운은 이 이하면 놀자고 해도 안 논다 (놀다가 닿으면 지쳐서 그만둔다)
const PLAY_MIN_FOOD = 20;
const PLAY_MIN_ENERGY = 10; // 2026-09-29: 20 에서 내렸다. 10% 이하일 때만 지친다

const clamp = (v) => Math.max(0, Math.min(100, v));

class Gauge {
  constructor(state) {
    this.state = state;
    const g = state.get('gauge');
    this.g = g && typeof g.food === 'number' ? { ...g } : { food: 80, energy: 90, at: Date.now() };
    this.savedAt = 0;
  }

  // 지난번 이후 흐른 시간만큼 줄이거나 채운다. sleeping = 지금 졸거나 자는 중
  tick(sleeping, now = Date.now()) {
    const h = Math.max(0, Math.min(24 * HOUR, now - this.g.at)) / HOUR;
    // 고정(프리미엄 음식) 동안은 줄지 않는다. 고정이 끝난 뒤의 시간만 줄인다 (자면서 기운이 차는 건 그대로)
    const lockedH = (until) => Math.max(0, Math.min(now, until || 0) - this.g.at) / HOUR;
    this.g.food = clamp(this.g.food - FOOD_DROP_PER_HOUR * Math.max(0, h - lockedH(this.g.foodLockUntil)));
    this.g.energy = clamp(this.g.energy + (sleeping ? ENERGY_REST_PER_HOUR * h : -ENERGY_DROP_PER_HOUR * Math.max(0, h - lockedH(this.g.energyLockUntil))));
    this.g.at = now;
    if (now - this.savedAt > 60_000) this.save();
  }

  get() {
    return { food: Math.round(this.g.food), energy: Math.round(this.g.energy), foodLockUntil: this.g.foodLockUntil || 0, energyLockUntil: this.g.energyLockUntil || 0 };
  }

  // fill 이 있으면 그만큼 (다이어트 공기는 0, 황금 고등어는 듬뿍). energy 는 기운 음식이 채우는 기운
  eat(kind, fill, energy = 0) {
    this.g.food = clamp(this.g.food + (typeof fill === 'number' ? fill : kind === 'meal' ? MEAL : SNACK));
    this.g.energy = clamp(this.g.energy + energy);
    this.save();
  }

  // ms 동안 배부름(과 기운)이 안 줄어든다 (이미 고정 중이면 더 긴 쪽)
  lockFood(ms, now = Date.now()) {
    this.g.foodLockUntil = Math.max(this.g.foodLockUntil || 0, now + ms);
    this.save();
  }
  lockEnergy(ms, now = Date.now()) {
    this.g.energyLockUntil = Math.max(this.g.energyLockUntil || 0, now + ms);
    this.save();
  }
  locked(key, now = Date.now()) {
    return now < (this.g[key + 'LockUntil'] || 0);
  }

  // 장난감을 한 번 잡았다
  play() {
    if (!this.locked('energy')) this.g.energy = clamp(this.g.energy - PLAY_ENERGY);
    if (!this.locked('food')) this.g.food = clamp(this.g.food - PLAY_FOOD);
  }

  // 지금 놀 수 있나? 안 되면 이유 ('hungry' | 'tired')
  playBlocker() {
    if (this.g.food < PLAY_MIN_FOOD) return 'hungry';
    if (this.g.energy <= PLAY_MIN_ENERGY) return 'tired';
    return null;
  }

  save() {
    this.savedAt = Date.now();
    this.state.set({ gauge: { ...this.g } });
  }
}

module.exports = { Gauge, PLAY_MIN_FOOD, PLAY_MIN_ENERGY, MEAL, SNACK };
