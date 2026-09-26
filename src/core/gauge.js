// 고양이의 배부름·기운 게이지 (0~100).
//  - 배부름: 시간이 지나면 천천히 준다. 밥을 먹으면 크게, 간식은 조금 오른다
//  - 기운  : 깨어 있으면 천천히, 장난감 놀이를 하면 빨리 준다. 졸거나 자는 동안 다시 찬다
// 둘 중 하나라도 바닥이면 장난감 놀이를 거부한다 (main.js 의 startPlay).
// 값은 state.json 의 gauge 에 { food, energy, at } 로 남긴다.
const HOUR = 60 * 60_000;

const FOOD_DROP_PER_HOUR = 12; // 배부름 100 → 0 까지 8시간쯤
const ENERGY_DROP_PER_HOUR = 3; // 깨어 있을 때 (100 → 0 까지 30시간쯤)
const ENERGY_REST_PER_HOUR = 50; // 졸거나 잘 때 (0 → 100 까지 2시간쯤)
const MEAL = 45;
const SNACK = 12;
const PLAY_ENERGY = 1.5; // 장난감을 한 번 잡을 때마다 (가득 찬 기운으로 50번 넘게 논다)
const PLAY_FOOD = 1;
// 이 밑이면 놀자고 해도 안 논다
const PLAY_MIN_FOOD = 20;
const PLAY_MIN_ENERGY = 20;

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
    this.g.food = clamp(this.g.food - FOOD_DROP_PER_HOUR * h);
    this.g.energy = clamp(this.g.energy + (sleeping ? ENERGY_REST_PER_HOUR : -ENERGY_DROP_PER_HOUR) * h);
    this.g.at = now;
    if (now - this.savedAt > 60_000) this.save();
  }

  get() {
    return { food: Math.round(this.g.food), energy: Math.round(this.g.energy) };
  }

  // fill 이 있으면 그만큼 (다이어트 공기는 0, 황금 고등어는 듬뿍). energy 는 기운 음식이 채우는 기운
  eat(kind, fill, energy = 0) {
    this.g.food = clamp(this.g.food + (typeof fill === 'number' ? fill : kind === 'meal' ? MEAL : SNACK));
    this.g.energy = clamp(this.g.energy + energy);
    this.save();
  }

  // 장난감을 한 번 잡았다
  play() {
    this.g.energy = clamp(this.g.energy - PLAY_ENERGY);
    this.g.food = clamp(this.g.food - PLAY_FOOD);
  }

  // 지금 놀 수 있나? 안 되면 이유 ('hungry' | 'tired')
  playBlocker() {
    if (this.g.food < PLAY_MIN_FOOD) return 'hungry';
    if (this.g.energy < PLAY_MIN_ENERGY) return 'tired';
    return null;
  }

  save() {
    this.savedAt = Date.now();
    this.state.set({ gauge: { ...this.g } });
  }
}

module.exports = { Gauge, PLAY_MIN_FOOD, PLAY_MIN_ENERGY, MEAL, SNACK };
