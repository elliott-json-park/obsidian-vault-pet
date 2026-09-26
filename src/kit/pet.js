// 펫 창: 캐릭터 애니메이션, 말풍선, 마우스 상호작용.
const canvas = document.getElementById('pet');
const bubbleEl = document.getElementById('bubble');
const loadingEl = document.getElementById('loading');
const hintEl = document.getElementById('playhint');
const fieldEl = document.getElementById('field');
const fctx = fieldEl.getContext('2d');
const sprite = new PetSprite.PetRenderer(canvas);
const T = new I18N.Strings();

let scale = 3;
let soundOn = true;
let realMood = 'idle'; // brain 이 알려 준 진짜 기분
let growth = null;
let wasLoading = false;
let idlePool = []; // 심심할 때 차례로 할 모션들 (설정에서 켠 것 + 입은 세트의 전용 모션)
// 한 모션을 최소 5분은 쓰고 다음 것으로 넘어간다 (너무 자주 바뀌면 정신이 없다. main.js·sprite.js 도 같은 규칙)
const IDLE_HOLD = 5 * 60_000;
let idleTurn = { i: 0, at: 0 };
// 그날의 기분 (main.js 의 temper). 돌아다니는 횟수·까부는 횟수·사냥 확률이 달라진다
let temper = 'calm';
const TEMPER = {
  calm: { stroll: 1.8, idle: 1.5, hunt: 0.15, huntGap: 1.6, far: 0.7 },
  playful: { stroll: 0.5, idle: 0.5, hunt: 0.7, huntGap: 0.5, far: 1.5 },
  grumpy: { stroll: 1.2, idle: 1.3, hunt: 0.25, huntGap: 1.2, far: 1 },
};
const tp = () => TEMPER[temper] || TEMPER.calm;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (v) => String(v).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- 설정·상태 ----------

// 배율은 소수도 들어온다. 캔버스는 반올림한 크기로 놓는다
function applyScale() {
  const px = Math.round(PetSprite.GRID * scale);
  canvas.style.width = `${px}px`;
  canvas.style.height = `${px}px`;
  if (typeof placeCat === 'function') placeCat();
  if (typeof repaintItems === 'function') repaintItems();
}

// 코스튬을 갈아입을 때: 새 옷(config)이 '코스튬 입을 때' 모션(action)보다 한 발 먼저 온다.
// 연기 펑·커튼처럼 고양이를 가렸다 보여 주는 모션이면 가려진 뒤에 갈아입어야 '짠' 하는 맛이 살아서,
// 모션이 올 때까지 새 옷을 잠깐 들고 있는다. 모션을 건너뛰면(놀이 중 등) 그 자리에서 바로 갈아입힌다
let pendingWear = null;
let pendingWearTimer = null;
function flushWear() {
  clearTimeout(pendingWearTimer);
  if (!pendingWear) return;
  const w = pendingWear;
  pendingWear = null;
  sprite.setAccessory(w.acc);
}

pet.onConfig((c) => {
  scale = c.scale;
  soundOn = c.sound;
  T.set(c.language, c.personality);
  sprite.setFur(c.fur);
  bubblesOn = c.bubbles !== false;
  clearTimeout(pendingWearTimer);
  pendingWear = null;
  if (c.wearMotion) {
    pendingWear = { acc: c.accessory, key: c.wearMotion };
    pendingWearTimer = setTimeout(flushWear, 500); // 모션이 안 오면 혼자 남지 않게
  } else sprite.setAccessory(c.accessory);
  sprite.setMoodMotions(c.moodMotions);
  idlePool = c.idleMotions || [];
  if (c.temper) temper = c.temper;
  applyScale();
  // 처음 한 번만 저장해 둔 자리에 세운다 (없으면 화면 오른쪽 끝)
  if (catX == null) {
    catX = c.startX != null ? c.startX : homeX();
    placeCat();
  }
});

// 트레이의 '자리 초기화'
pet.onReset(() => {
  catX = homeX();
  catLift = 0;
  catVy = 0;
  goHome();
  placeCat();
});

let stageTimer = null;
pet.onState((s) => {
  realMood = s.mood;
  quietNow = !!s.quiet;
  syncMood();
  if (s.growth) {
    const prevKey = growth ? growth.stageKey : null;
    growth = s.growth;
    if (prevKey !== growth.stageKey) {
      clearTimeout(stageTimer);
      if (sprite.action === 'evolve') {
        // 번쩍이는 도중에 모습이 바뀌게
        stageTimer = setTimeout(() => sprite.setStage(growth.stageKey), 900);
      } else if (wasLoading && prevKey) {
        // 첫 실행: 기록을 다 읽고 나서 단계가 올라가면 한 번에 자라는 연출
        wasLoading = false;
        sprite.play('evolve');
        if (soundOn) PetSound.play('evolve');
        stageTimer = setTimeout(() => sprite.setStage(growth.stageKey), 900);
      } else sprite.setStage(growth.stageKey);
    }
  }
});

pet.onLoading((p) => {
  if (p === null) {
    loadingEl.hidden = true;
    return;
  }
  wasLoading = true;
  loadingEl.hidden = false;
  loadingEl.textContent = T.t('pet.loading', { p: Math.round(p * 100) });
});

pet.onAction((a) => {
  // 모션을 건너뛰었으면 미뤄 둔 코스튬을 바로 입힌다 (가려 줄 모션이 없으니 기다릴 이유가 없다)
  if (!playAction(a)) flushWear();
});
function playAction(a) {
  if (toy) {
    // 상자·봉투 속에 있으면 튀어나오지 않고 속에서 반응한다
    if (toy.inside) { reactInside(toy); return false; }
    // 장난감을 끌어안거나 물고 있는 중에는 다른 동작을 안 한다
    if (toy.state === 'busy' || toy.state === 'carry' || toy.state === 'enter') return false;
  }
  // 먹이를 주우러 가거나 노는 중이면 모션은 건너뛴다 (걸으면서 춤추면 이상하다)
  if (PetSprite.PetRenderer.isMotion(a) && (toy || treats.length)) return false;
  // 한창 먹는 중이면 쓰다듬어도 먹던 걸 계속 먹는다
  if (treats.some((o) => o.eating)) return false;
  // 사냥하는 중이면 끊지 않는다
  if (hunt) return false;
  sprite.play(a);
  // 이 모션이 방금 입은 코스튬을 보여 줄 모션이면, 가려지는 순간에 갈아입도록 넘긴다
  if (pendingWear && pendingWear.key === a) {
    clearTimeout(pendingWearTimer);
    const w = pendingWear;
    pendingWear = null;
    sprite.wearDuring(a, w.acc);
  }
  return true;
}
pet.onSound((s) => soundOn && PetSound.play(s));

// ---------- 말풍선 ----------

const queue = [];
let current = null;
let hideTimer = null;
let typeTimer = null;
const LINK_HINT = { achievements: 'pet.linkAchievements', quests: 'pet.linkQuests', wardrobe: 'pet.linkWardrobe' };
// 말풍선 종류마다 앞에 붙는 도트 아이콘. 없으면 아이콘 없이 글만 나온다
// 말풍선 앞 아이콘은 무슨 말인지 알려 줄 때만 (보상 · 밥 · 알림 · 쉬자 · 늦은 밤 · 팁).
// 쓰다듬기 반응 · 수다 · 인사처럼 그냥 하는 말에는 안 붙인다 (2026-09-25)
const BUBBLE_ICON = {
  grow: 'sparkle', achieve: 'medal', item: 'gift', quest: 'check', attend: 'fire', retro: 'medal',
  treat: 'ricebowl', fed: 'ricebowl', hungry: 'ricebowl', lunch: 'ricebowl', dinner: 'ricebowl',
  notify: 'bang', rest: 'pillow', late: 'moon', tip: 'claudethink',
};
const REWARD = new Set(['grow', 'achieve', 'item', 'quest', 'attend', 'retro']);
const CHATTY = new Set(['chatter', 'poke', 'stop', 'tip']);

let skipFollow = false; // 앞말을 버렸으면 이어지는 뒷말('follow')도 버린다
pet.onBubble((b) => {
  if (b.kind === 'follow' && skipFollow) return;
  skipFollow = false;
  if (current && CHATTY.has(b.kind) && queue.length) {
    skipFollow = true;
    return; // 수다는 밀려 있으면 버린다
  }
  if (b.kind === 'notify') queue.unshift(b);
  else queue.push(b);
  while (queue.length > 5) {
    const i = queue.findIndex((q) => CHATTY.has(q.kind));
    queue.splice(i >= 0 ? i : queue.length - 1, 1);
  }
  if (!current) nextBubble();
});

function nextBubble() {
  clearTimeout(hideTimer);
  clearInterval(typeTimer);
  current = queue.shift() || null;
  if (!current) {
    bubbleEl.classList.remove('show');
    setTimeout(() => !current && (bubbleEl.hidden = true), 150);
    return;
  }
  const textEl = bubbleEl.querySelector('.text');
  bubbleEl.className = 'bubble' + (REWARD.has(current.kind) ? ' reward' : current.kind === 'notify' ? ' notify' : '');
  bubbleEl.querySelector('.hint').textContent = current.link && LINK_HINT[current.link] ? T.t(LINK_HINT[current.link]) : '';
  const ic = BUBBLE_ICON[current.kind];
  bubbleEl.querySelector('.ico').innerHTML = ic ? PixelArt.svg(ic, 14) : '';
  // 부르는 소리가 나면 귀를 세우고 고개를 돌려 본다
  if (current.kind === 'notify' && !sprite.action && !(toy && toy.inside)) sprite.play('perk');
  bubbleEl.hidden = false;
  requestAnimationFrame(() => bubbleEl.classList.add('show'));

  // 한 글자씩 타이핑
  const chars = [...current.text];
  let i = 0;
  textEl.textContent = '';
  typeTimer = setInterval(() => {
    textEl.textContent = chars.slice(0, ++i).join('');
    if (i >= chars.length) clearInterval(typeTimer);
  }, 28);
  if (soundOn && REWARD.has(current.kind) === false && current.kind !== 'poke') PetSound.play('pop', 0.015);

  const ms = Math.max(3500, Math.min(9000, 2200 + chars.length * 110)) + (current.link ? 2500 : 0);
  hideTimer = setTimeout(() => {
    bubbleEl.classList.remove('show');
    hideTimer = setTimeout(nextBubble, 220);
  }, ms);
}

bubbleEl.addEventListener('click', () => {
  if (current && current.link) pet.open(current.link);
  nextBubble();
});

// ---------- 걸어 다니기 ----------
// 펫 창은 모니터 작업 영역 전체다. 고양이는 바닥(작업표시줄 위)을 따라 화면 끝에서 끝까지 다닌다.
// 놀 때도, 먹이를 주우러 갈 때도, 심심할 때도 같은 걸음을 쓴다.

let catX = null; // 고양이 한가운데의 가로 자리(창 안 좌표). 첫 설정을 받으면 정한다
let catLift = 0; // 바닥에서 떠 있는 높이(px). 들어 올렸거나 뛰어올랐을 때
let catVy = 0;
let lifted = false; // 사람이 들어 올린 뒤 바닥에 닿을 때까지 (장난감을 향해 뛴 건 아니다)
let strollTo = null;
let nextStroll = performance.now() + 15000;
let nextIdleMotion = performance.now() + 40000;

const petPx = () => Math.round(PetSprite.GRID * scale);
const cellPx = () => petPx() / PetSprite.GRID; // 고양이 도트 한 칸의 화면 크기
// 바닥에 놓이는 물건의 도트 한 칸 크기. 고양이보다 한 눈금 작게 찍는다
const itemDot = () => Math.max(2, Math.round(scale) - 1);

// 고양이가 돌아다닐 수 있는 가로 범위
function lane() {
  const half = petPx() / 2;
  return [half, Math.max(half, window.innerWidth - half)];
}

// 저장한 자리가 없을 때 서는 곳: 화면 오른쪽 끝에서 조금 안쪽
const homeX = () => Math.max(petPx() / 2, window.innerWidth - petPx() / 2 - 90);

// 떠 있는 고양이의 그림자. 고양이 캔버스 안에 그리면 같이 떠오르니, 떠 있는 동안은 바닥에 따로 찍는다.
// 높이 뜰수록 작고 옅어진다 (sprite.js 의 drawShadow 와 같은 두 줄짜리 도트 타원)
const shadowEl = document.createElement('canvas');
shadowEl.id = 'floor-shadow';
document.body.appendChild(shadowEl);
function updateFloorShadow() {
  const cell = cellPx();
  const air = catX != null && catLift > cell * 1.5 && canvas.style.visibility !== 'hidden';
  sprite.floorShadow = air;
  shadowEl.hidden = !air;
  if (!air) return;
  const G = PetSprite.GRID;
  const GROUND = PetSprite.util.GROUND;
  const h = catLift / cell; // 떠 있는 높이 (고양이 도트 칸)
  const rx = (sprite._shadow && sprite._shadow[1]) || 8;
  const w = Math.max(2, rx * (0.95 - Math.min(h, 12) * 0.045));
  if (shadowEl.width !== G) {
    shadowEl.width = G;
    shadowEl.height = 2;
  }
  const ctx = shadowEl.getContext('2d');
  ctx.clearRect(0, 0, G, 2);
  ctx.fillStyle = 'rgba(30,15,8,0.22)';
  const cx = G / 2;
  for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
    ctx.fillRect(x, 0, 1, 1);
    if (Math.abs(x - cx) < w - 2) ctx.fillRect(x, 1, 1, 1);
  }
  shadowEl.style.opacity = String(Math.max(0.35, 1 - catLift / (window.innerHeight * 0.9)));
  shadowEl.style.width = `${petPx()}px`;
  shadowEl.style.height = `${2 * cell}px`;
  shadowEl.style.left = `${Math.round(catX - petPx() / 2)}px`;
  shadowEl.style.bottom = `${Math.round((G - GROUND - 3) * cell)}px`;
}

function placeCat() {
  if (catX == null) return;
  const [min, max] = lane();
  catX = Math.max(min, Math.min(max, catX));
  canvas.style.left = `${Math.round(catX - petPx() / 2)}px`;
  canvas.style.bottom = `${Math.round(catLift)}px`;
}

// 걷던 걸 멈추고 그 자리에 선다
function goHome() {
  strollTo = null;
  sprite.setMove(0);
  sprite.setFacing(1);
}

// goal 쪽으로 걷는다. 멀면 성큼성큼, 가까우면 살금살금, stop 안쪽이면 선다. 남은 거리를 돌려준다
function walkTo(goal, dt, fast = 1, stop = 0) {
  const [min, max] = lane();
  goal = clamp(goal, min, max);
  const dx = goal - catX;
  const dist = Math.abs(dx);
  const speed = dist <= stop ? 0 : (dist > 500 ? 280 : dist > 140 ? 170 : 90) * fast;
  if (speed) {
    catX = clamp(catX + Math.sign(dx) * Math.min(speed * dt, dist), min, max);
    sprite.setMove(Math.sign(dx) * speed);
    sprite.setToyPose(null);
  } else sprite.setMove(0);
  placeCat();
  return Math.abs(goal - catX);
}

// 서 있는 채로 그쪽을 본다
function face(x) {
  if (Math.abs(x - catX) > 2) sprite.setFacing(Math.sign(x - catX));
}

window.addEventListener('resize', () => {
  placeCat();
  resizeField();
});

// ---------- 바닥에 놓인 물건 ----------
// 던지는 장난감과 간식이 같은 물리를 쓴다. 중력으로 떨어지고, 바닥에 튕기고, 굴러가다 선다.
const GRAVITY = 1500; // px/s²
const BOUNCE = 0.42; // 바닥에 부딪히고 남는 속도
const ROLL = 0.9; // 바닥에서 구를 때 1/60초마다 줄어드는 비율

// 장난감마다 노는 방식
//  throw  : 바닥에 떨어지는 작은 것. 끌었다 놓으면 던져진다. on = 잡았을 때 하는 짓
//  place  : 바닥에 놓아 두는 큰 것. 고양이가 들어가거나 올라탄다 (그림은 toys.js)
//  rod·teaser·bubbles·laser : 마우스로 흔드는 것. 화면 전체 놀이판에 그린다
const TOY_DEFS = {
  ball: { mode: 'throw', on: 'bat' }, // 덮치면 톡 튀어 나가고, 가끔은 앞발로 톡톡 드리블
  jingle: { mode: 'throw', on: 'bat', jingle: true }, // 공과 같은데 구를 때마다 딸랑
  yarn: { mode: 'throw', on: 'yarn' }, // 굴러간 자리에 실이 풀리고, 잡으면 끌어안고 뒷발 차기. 세 번째엔 칭칭 감긴다
  catnip: { mode: 'throw', on: 'nip' }, // 끌어안고 뒷발 차다가 캣닢에 취해 데굴데굴
  windup: { mode: 'throw', on: 'pin' }, // 혼자 달려 다닌다. 잡으면 꾹 눌렀다가 놓아 준다
  wand: { mode: 'rod' }, // 낚싯줄 끝 물고기를 쫓는다. 높으면 뛰어오른다
  bubbles: { mode: 'bubbles' }, // 휘저으면 방울이 나오고, 뛰어올라 터뜨린다
  laser: { mode: 'laser' }, // 빨간 점을 미친 듯이 쫓지만 잡아도 발밑엔 없다
  box: { mode: 'place' }, // 쏙 들어가 숨었다가, 빼꼼, 아늑~, 결국 잠든다
  bag: { mode: 'place' }, // 봉투 속으로 돌진. 부스럭거리며 기어 다니고 입구에서 눈만 반짝
  scratcher: { mode: 'place' }, // 벅벅 긁고 그 위에서 식빵
};
const HINT = { throw: 'play.hintThrow', place: 'play.hintPlace', rod: 'play.hintRod', teaser: 'play.hintTeaser', bubbles: 'play.hintBubbles', laser: 'play.hintLaser' };
const HINT_MS = 4_000; // 놀이 안내는 이만큼 보여 주고 사라진다
// 놀다 보면 질린다. 이만큼 잡거나(5~8번 중 하나) 이만큼 놀고 나면 더는 안 쫓는다 (큰 장난감은 안 질린다)
const BORED_CATCHES = [5, 8];
const BORED_SECS = 75;

let toy = null; // 지금 꺼낸 장난감 (startPlay 참고)
let treats = []; // 바닥에 떨어진 간식들
let held = null; // 지금 손에 쥔 것 { o, dx, dy, hist }
let hintTimer = null;
let mouseX = null; // 마지막으로 본 마우스 자리 (흔드는 장난감이 따라온다)
let mouseY = null;

const floorY = () => window.innerHeight - 4;
// 바닥에서 집을 수 있는 것: 간식, 장난감, 장난감이 내놓은 것들(공 발사기의 공·눈덩이…)
const items = () => [
  ...treats,
  ...loot,
  ...(toy && toy.el && !toy.el.hidden ? [toy] : []),
  ...(toy && toy.extras ? toy.extras.filter((x) => x.el && !x.el.hidden && !x.noGrab) : []),
];
// 2차 장난감(toyplay*.js)이 쓰는 것: 마우스로 쓰는 장난감인가
const isCursorToy = () => !!toy && (CURSOR_MODES.has(toy.mode) || !!(toy.C && toy.C.cursor));
let catVx = 0; // 폭발에 날아갈 때 옆으로 가는 속도

function spawnItem(key) {
  const el = document.createElement('canvas');
  el.className = 'toy';
  PixelArt.paint(el, key, itemDot());
  document.body.appendChild(el);
  const size = PixelArt.size(key) || { w: 12, h: 12 };
  return { key, el, x: 0, y: 0, vx: 0, vy: 0, half: (Math.max(size.w, size.h) * itemDot()) / 2 };
}

// 상자·봉투·스크래처는 고양이와 같은 도트 크기로 찍는다 (고양이가 들어가면 고양이 캔버스가 이어서 그린다)
function paintPlaced(o) {
  const cell = cellPx();
  const m = PetToys.paintPlaced(o.el, o.key, cell);
  o.half = (m.h * cell) / 2;
  o.hw = (m.w * cell) / 2;
}

function placeItem(o) {
  o.el.style.left = `${Math.round(o.x)}px`;
  o.el.style.top = `${Math.round(o.y)}px`;
}

// 배율이 바뀌면 바닥의 물건도 같이 다시 찍는다
function repaintItems() {
  for (const o of [...treats, ...(toy && toy.el ? [toy] : [])]) {
    if (o.placed) paintPlaced(o);
    else {
      PixelArt.paint(o.el, o.key, itemDot());
      const size = PixelArt.size(o.key) || { w: 12, h: 12 };
      o.half = (Math.max(size.w, size.h) * itemDot()) / 2;
    }
    placeItem(o);
  }
}

// 한 프레임만큼 굴린다
function stepItem(o, dt) {
  if (held && held.o === o) return;
  if (o.el && o.el.hidden) return; // 고양이가 물고 있거나 안에 들어가 있다
  const hw = o.hw || o.half;
  const bounce = o.placed ? 0.12 : BOUNCE;
  o.vy += GRAVITY * dt;
  o.x += o.vx * dt;
  o.y += o.vy * dt;

  if (o.x < hw) {
    o.x = hw;
    o.vx = -o.vx * BOUNCE;
  }
  const right = window.innerWidth - hw;
  if (o.x > right) {
    o.x = right;
    o.vx = -o.vx * BOUNCE;
  }

  const ground = floorY() - o.half;
  if (o.y >= ground) {
    o.y = ground;
    if (o.vy > 60) o.vy = -o.vy * bounce; // 통 튀어 오른다
    else {
      o.vy = 0;
      o.vx *= Math.pow(o.placed ? 0.8 : ROLL, dt * 60);
      if (Math.abs(o.vx) < 5) o.vx = 0;
    }
  }
  placeItem(o);
}

// 바닥에 얌전히 놓여 있나 (주워 먹을 수 있는 상태)
const resting = (o) => o.vy === 0 && Math.abs(o.vx) < 14 && o.y >= floorY() - o.half - 2;
const onFloor = (o) => o.y >= floorY() - o.half - 2;

// 간식이 바닥에 있으면 자다가도 일어난다 (화면에서만. 진짜 기분은 brain 이 정한다).
// 장난감을 꺼내면 하던 기분 모션(노트북 타자·졸기…)은 잠깐 멈추고 놀이에만 집중한다. 놀이가 끝나면 돌아간다
function syncMood() {
  const wake = treats.length && (realMood === 'sleeping' || realMood === 'sleepy');
  sprite.setMood(toy || wake ? 'idle' : realMood);
}

// ---------- 장난감 놀이 ----------

function startPlay(key) {
  endPlay();
  if (sprite.motion) sprite.cancel();
  // 2차 장난감은 toyplay*.js 가 동작을 통째로 갖는다 (window.TOY_CUSTOM)
  const C = (window.TOY_CUSTOM || {})[key];
  const def = C ? { mode: 'custom' } : TOY_DEFS[key] || TOY_DEFS.ball;
  const now = performance.now();
  const P = petPx();
  const W = window.innerWidth;
  const side = catX > W / 2 ? -1 : 1;
  toy = {
    key, def, mode: def.mode, state: 'free', until: 0, busyUntil: 0, pounceUntil: 0, catches: 0,
    limit: BORED_CATCHES[0] + Math.floor(Math.random() * (BORED_CATCHES[1] - BORED_CATCHES[0] + 1)),
    startedAt: now, bored: false, x: 0, y: 0, vx: 0, vy: 0, el: null,
  };
  if (def.mode === 'throw') {
    Object.assign(toy, spawnItem(key));
    // 던지는 장난감은 고양이 옆 조금 위에서 떨어진다
    toy.x = clamp(catX + side * 110, toy.half, W - toy.half);
    toy.y = window.innerHeight - P - 140;
    if (key === 'yarn') toy.thread = [];
    if (key === 'windup') Object.assign(toy, { wind: 5, dir: side });
  } else if (def.mode === 'place') {
    const el = document.createElement('canvas');
    el.className = 'toy placed';
    document.body.appendChild(el);
    Object.assign(toy, { el, placed: true, state: 'drop' });
    paintPlaced(toy);
    toy.x = clamp(catX + side * P * 1.15, toy.hw, W - toy.hw);
    toy.y = window.innerHeight - P - 60;
  } else if (def.mode === 'custom') {
    toy.C = C;
    toy.extras = [];
    if (mouseX == null) {
      mouseX = clamp(catX + side * 160, 20, W - 20);
      mouseY = window.innerHeight - P * 1.3;
    }
    C.start(toy, side);
  } else {
    // 흔드는 장난감은 마우스를 따라온다. 아직 마우스를 못 봤으면 고양이 옆 허공에서 시작
    if (mouseX == null) {
      mouseX = clamp(catX + side * 160, 20, W - 20);
      mouseY = window.innerHeight - P * 1.3;
    }
    if (def.mode === 'rod') toy.rod = makeRod();
    if (def.mode === 'teaser') toy.tz = { hx: mouseX, hy: mouseY, tx: mouseX, ty: mouseY - P * 0.55, vx: 0, vy: 0, side };
    if (def.mode === 'bubbles') toy.bub = { list: [], pops: [], next: 0, lx: mouseX, ly: mouseY };
  }
  if (toy.el) placeItem(toy);
  syncMood();
  resizeField();
  strollTo = null;
  document.body.classList.add('playing');
  hintEl.textContent = def.mode === 'custom' ? `${T.t('toyHow.' + key)} · ${T.t('play.stopHint')}` : T.t(HINT[def.mode]);
  hintEl.hidden = false;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => (hintEl.hidden = true), HINT_MS);
  if (isCursorToy()) setOver(true);
  placeCat();
}

function endPlay() {
  if (!toy) return;
  if (held && held.o === toy) held = null;
  const wasInside = toy.inside;
  if (toy.C && toy.C.end) toy.C.end(toy);
  for (const x of toy.extras || []) if (x.el) x.el.remove();
  if (toy.el) toy.el.remove();
  toy = null;
  cursorDown = null;
  if (floating) popGiant(null);
  setOver(false);
  sprite.setToyPose(null);
  sprite.toyOff = 0;
  sprite.carry = null;
  if (sprite.action && sprite.action.startsWith('toy')) sprite.cancel();
  sprite.setLook(0);
  syncMood();
  clearField();
  clearTimeout(hintTimer);
  document.body.classList.remove('playing');
  hintEl.hidden = true;
  goHome();
  // 상자·봉투에서 나오면 기지개 한 번
  if (wasInside) sprite.play('stretch');
}

// 물고 있던 장난감을 고양이 앞 바닥에 다시 내놓는다
function showToy(o, x) {
  o.el.hidden = false;
  o.x = clamp(x, o.hw || o.half, window.innerWidth - (o.hw || o.half));
  o.y = floorY() - o.half - 1;
  o.vx = 0;
  o.vy = 0;
  placeItem(o);
}

// 하던 걸 다 놓고 장난감을 바닥에 둔다 (먹이가 떨어졌을 때·질렸을 때)
function releaseToy(o) {
  sprite.carry = null;
  sprite.setToyPose(null);
  if (o.inside) {
    o.inside = false;
    o.phase = null;
    o.scoot = null;
    sprite.toyOff = 0;
  }
  if (o.el && o.el.hidden) showToy(o, o.placed ? o.x : catX + sprite.facing * petPx() * 0.35);
  o.batting = o.pinned = false;
  o.state = o.placed ? 'drop' : 'free';
}

// 한 번 잡았다. main 이 배부름·기운을 깎고, 기분 좋은 말은 가끔만 한다. 다 놀았으면 질린다
function scored(o, now) {
  o.catches++;
  pet.caught();
  if (o.catches >= o.limit || now - o.startedAt > BORED_SECS * 1000) {
    getBored(o);
    return true;
  }
  return false;
}

// 장난감에 질렸다. 고개를 돌리고 하품한 뒤 식빵 자세. 놀이를 접는 건 main 이 한다
function getBored(o) {
  releaseToy(o);
  o.bored = true;
  sprite.setMove(0);
  sprite.setLook(0);
  const x = o.el ? o.x : mouseX != null ? mouseX : catX;
  sprite.setFacing(x > catX ? -1 : 1);
  sprite.play('bored');
  pet.bored();
}

// ---------- 주우러 가기 ----------
// 간식이 있으면 간식부터, 없으면 장난감. 둘 다 없으면 false 를 돌려주고 산책에 넘긴다

function stepChase(dt, now) {
  if (treats.length) return stepTreat(dt);
  if (toy) return stepToy(dt, now);
  // 다 먹었으면 더는 바닥을 쳐다보지 않는다 (쳐다보는 동안은 기분 모션이 쉰다)
  if (sprite.look) sprite.setLook(0);
  return false;
}

function stepTreat(dt) {
  const o = treats[0];
  // 놀던 중이면 장난감은 내려놓고 먹으러 간다
  if (toy && (toy.inside || toy.state !== 'free')) releaseToy(toy);
  if (catX == null) return false; // 아직 첫 설정(저장한 자리)을 못 받았다
  if (catLift > 0) return true; // 뛰어오른 채면 내려올 때까지
  // 먹는 중에는 그 자리에 서 있는다
  if (o.eating) {
    sprite.setMove(0);
    return true;
  }
  // 벽에 붙은 물건은 고양이가 갈 수 있는 끝자리까지만 가서 먹는다 (고양이 몸 반쪽만큼은 벽에 못 붙는다)
  // 입이 먹이에 닿을 만큼 바짝 붙어야 먹는다
  const near = 6;
  const dist = walkTo(o.x, dt, 1, near);
  if (dist <= near) face(o.x); // 서 있어도 그쪽은 본다
  sprite.setLook(Math.min(1, dist / 60));
  // 사람이 들고 있으면 올려다보며 기다린다
  if (held && held.o === o) return true;
  if (dist < near && resting(o) && !sprite.action) {
    o.eating = true;
    o.bites = o.bites || 0; // 먹다 만 거면 이어서
    o.gap = Math.abs(catX - o.x); // 먹기 시작한 거리. 이보다 멀어지면 입이 안 닿는다
    o.chain = (o.chain || 0) + 1;
    face(o.x);
    nibbleOnce(o, o.chain);
  }
  return true;
}

// 야금야금: 한 입 먹을 때마다 고양이 쪽 가장자리부터 이빨 자국 모양으로 조금씩 사라진다
const BITES = 4;
// 입이 닿나: 사람이 집어 갔거나, 멀리 굴러갔거나, 고양이가 들려 있으면 못 먹는다
const inReach = (o) => !(held && held.o === o) && !dragging && !lifted && catLift <= 0 && resting(o) && Math.abs(catX - o.x) <= o.gap + 6;
function nibbleOnce(o, chain) {
  if (!treats.includes(o) || chain !== o.chain) return;
  // 먹는 사이에 먹이가 멀어졌으면 멈춘다. 먹던 자국은 그대로 두고, 다시 다가가면 이어서 먹는다 (stepTreat)
  if (!inReach(o)) {
    o.eating = false;
    return;
  }
  o.bites++;
  sprite.play('nibble');
  if (soundOn) PetSound.play('pop', 0.015);
  paintBitten(o, o.bites / (BITES + 1), catX < o.x);
  if (o.bites < BITES) {
    setTimeout(() => nibbleOnce(o, chain), 560);
    return;
  }
  setTimeout(() => {
    o.el.remove();
    treats = treats.filter((x) => x !== o);
    syncMood();
    pet.treatEaten(o.key);
  }, 520);
}

// 먹이 그림을 다시 찍고 frac 만큼 베어 문다. 가운데 줄이 더 깊게 파여서 한 입 모양이 된다
function paintBitten(o, frac, fromLeft) {
  PixelArt.paint(o.el, o.key, itemDot());
  const ctx = o.el.getContext('2d', { willReadFrequently: true });
  const w = o.el.width;
  const h = o.el.height;
  // 그림이 실제로 있는 가로·세로 범위 (도트 그림은 가장자리가 비어 있다)
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3]) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
  if (x1 < 0) return;
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  for (let y = y0; y <= y1; y++) {
    const bulge = Math.sin((Math.PI * (y - y0 + 0.5)) / ch) * Math.max(1, cw * 0.18);
    const cut = Math.max(0, Math.round(cw * frac + bulge - 1));
    if (fromLeft) ctx.clearRect(x0, y, cut, 1);
    else ctx.clearRect(x1 + 1 - cut, y, cut, 1);
  }
}

function stepToy(dt, now) {
  const o = toy;
  if (catX == null) return false;
  if (o.bored) {
    sprite.setMove(0);
    return true;
  }
  if (o.mode === 'custom') return o.C.step(o, dt, now) !== false;
  if (o.mode === 'place') return stepPlace(o, dt, now);
  if (o.mode === 'throw') return stepThrow(o, dt, now);
  return stepHunt(o, dt, now);
}

// ----- 던지는 장난감 -----

function stepThrow(o, dt, now) {
  const P = petPx();
  if (o.key === 'windup') stepWindup(o, dt, now);
  if (o.def.jingle) stepJingle(o, now);
  if (o.thread) stepThread(o);
  if (catLift > 0) return true;

  switch (o.state) {
    case 'busy':
      // 끌어안기·누르기·톡톡 드리블 중
      sprite.setMove(0);
      if (o.batting) {
        o.x = catX + sprite.facing * P * 0.3 + Math.sin(now / 70) * P * 0.05;
        o.y = floorY() - o.half;
        placeItem(o);
      }
      if (o.pinned) {
        o.x = catX + sprite.facing * P * 0.22 + rand(-1, 1);
        o.y = floorY() - o.half;
        placeItem(o);
      }
      if (now > o.until) finishBusy(o, now);
      return true;
    case 'carry': {
      // 쥐돌이를 물고 마우스가 있는 쪽으로 총총
      const d = walkTo(mouseX != null ? mouseX : catX, dt, 0.7, 4);
      if (d <= 4 || now > o.until) dropCarry(o, now);
      return true;
    }
    case 'wait':
      // 물어다 놓고 다시 던져 주길 기다린다. 한참 안 던져 주면 제가 톡 친다
      sprite.setMove(0);
      face(o.x);
      if (now > o.until) {
        o.state = 'free';
        o.vx = sprite.facing * 260;
        o.vy = -160;
        sprite.play('pounce');
      }
      return true;
  }

  const near = 26;
  const dist = walkTo(o.x, dt, o.key === 'windup' || (o.nip || 0) > now ? 1.5 : 1, near);
  if (dist <= near) face(o.x);
  sprite.setLook(Math.min(1, dist / 60));
  // 코앞에 낮게 놓여 있으면 덮친다
  const low = o.y > window.innerHeight - P * 0.75;
  if (dist < 30 && low && now > o.pounceUntil && !(held && held.o === o)) catchThrow(o, now);
  return true;
}

function catchThrow(o, now) {
  o.pounceUntil = now + 1100;
  if (scored(o, now)) return;
  const dir = Math.sign(o.x - catX) || sprite.facing;
  switch (o.def.on) {
    case 'bat':
      if (Math.random() < 0.35) {
        // 앞발로 이쪽저쪽 톡톡 굴리다가 툭 차 낸다
        Object.assign(o, { state: 'busy', batting: true, until: now + 1300 });
        sprite.play('toyBat');
      } else {
        sprite.play('pounce');
        o.vy = -280;
        o.vx += dir * 140;
      }
      break;
    case 'yarn': {
      // 세 번째마다 실이 몸에 칭칭 감긴다
      const tangle = o.catches % 3 === 0;
      o.el.hidden = true;
      Object.assign(o, { state: 'busy', tangle, until: now + (tangle ? 2600 : 2400) });
      sprite.play(tangle ? 'toyTangle' : 'toyYarn');
      break;
    }
    case 'carry':
      o.el.hidden = true;
      sprite.carry = 'mouse';
      Object.assign(o, { state: 'carry', until: now + 5000 });
      break;
    case 'nip':
      o.el.hidden = true;
      Object.assign(o, { state: 'busy', phase: 1, until: now + 2800 });
      sprite.play('toyKick');
      break;
    case 'pin':
      Object.assign(o, { state: 'busy', pinned: true, wind: 0, until: now + 1600 });
      sprite.play('toyPin');
      break;
  }
}

function finishBusy(o, now) {
  const P = petPx();
  if (o.batting) {
    o.batting = false;
    o.state = 'free';
    o.vx = sprite.facing * 320;
    o.vy = -120;
    return;
  }
  if (o.pinned) {
    // 놓아주면 태엽 쥐가 고양이 앞쪽(바라보는 쪽)으로 도망간다. 반대로 보내면 고양이 발밑으로 달려와 바로 다시 잡힌다
    Object.assign(o, { pinned: false, state: 'free', wind: 4 + Math.random() * 2, dir: sprite.facing });
    return;
  }
  if (o.def.on === 'nip' && o.phase === 1) {
    // 뒷발 차기 다음엔 캣닢에 취해 데굴데굴
    o.phase = 2;
    o.until = now + 3600;
    sprite.play('toyHigh');
    return;
  }
  // 털실·캣닢 인형을 다시 바닥에 내놓는다
  showToy(o, catX + sprite.facing * P * 0.35);
  o.state = 'free';
  if (o.def.on === 'yarn') {
    o.vx = sprite.facing * 300;
    o.vy = -220;
    if (o.tangle) o.thread = []; // 감긴 실은 끊어졌다
  }
  if (o.def.on === 'nip') o.pounceUntil = now + 2500; // 헤롱헤롱. 잠깐은 안 덮친다
}

// 물고 온 쥐돌이를 내려놓는다
function dropCarry(o, now) {
  sprite.carry = null;
  showToy(o, catX + sprite.facing * petPx() * 0.32);
  sprite.setMove(0);
  sprite.play('toyProud');
  o.state = 'wait';
  o.until = now + 6500;
}

// 태엽 쥐는 바닥에 닿아 있으면 혼자 달린다. 태엽이 다 풀리면 멈춘다
function stepWindup(o, dt, now) {
  if (o.state !== 'free' || (held && held.o === o) || !(o.wind > 0) || !onFloor(o)) return;
  o.wind -= dt;
  const hw = o.hw || o.half;
  if (o.x <= hw + 1) o.dir = 1;
  if (o.x >= window.innerWidth - hw - 1) o.dir = -1;
  o.vx = (o.dir || 1) * 150 * Math.min(1, o.wind);
  if (now > (o.hop || 0)) {
    o.hop = now + 380;
    o.vy = -60; // 달리면서 통통
  }
}

// 방울공은 구를 때마다 딸랑
let fieldFx = []; // 놀이판에 잠깐 뜨는 음표
function stepJingle(o, now) {
  if (o.el.hidden) return;
  const sp = Math.abs(o.vx) + Math.abs(o.vy);
  if (sp > 60 && now > (o.ring || 0)) {
    o.ring = now + 260;
    if (soundOn) PetSound.play('jingle', 0.02);
    fieldFx.push({ x: o.x + rand(-6, 6), y: o.y - o.half - 4, t: now });
  }
}

// 털실은 처음 멈춘 자리에 실 끝을 남기고, 굴러가는 대로 실이 풀린다
function stepThread(o) {
  const P = petPx();
  const vis = !o.el.hidden;
  const x = vis ? o.x : catX;
  const y = vis ? o.y + o.half * 0.4 : window.innerHeight - catLift - P * 0.2;
  o.threadEnd = { x, y };
  if (!o.thread.length) {
    if (vis && resting(o)) o.thread.push({ x: o.x, y: floorY() - 2 });
    return;
  }
  const last = o.thread[o.thread.length - 1];
  if (Math.hypot(x - last.x, y - last.y) > 6) {
    o.thread.push({ x, y });
    if (o.thread.length > 160) o.thread.shift();
  }
}

// ----- 장난감을 톡 눌렀을 때 -----
// 던지는 장난감은 바닥에 있는 걸 톡, 흔드는 장난감은 아무 데나 톡. 장난감마다 반응이 다르다
const CURSOR_MODES = new Set(['rod', 'teaser', 'bubbles', 'laser']);
let cursorDown = null; // 흔드는 장난감을 든 채로 누른 순간 { t, x, y }
let floating = false; // 큰 비눗방울에 갇혀 떠 있다

function toyClick(o) {
  if (toy && toy.C) return toy.C.click && toy.C.click(toy, o);
  const now = performance.now();
  const away = Math.sign(o.x - catX) || 1;
  switch (o.key) {
    case 'ball':
      // 뻥 — 하늘 높이 차 올린다
      o.vy = -780;
      o.vx = rand(-180, 180);
      break;
    case 'jingle':
      // 딸랑딸랑 흔들어서 부른다
      o.vy = -220;
      o.pounceUntil = 0;
      if (soundOn) PetSound.play('jingle', 0.03);
      for (let i = 0; i < 3; i++) fieldFx.push({ x: o.x + rand(-10, 10), y: o.y - o.half - 4 - i * 6, t: now + i * 90 });
      break;
    case 'yarn':
      // 데굴데굴 — 실이 길게 풀린다
      o.vx = away * 440;
      o.vy = -80;
      break;
    case 'catnip':
      // 캣닢 가루가 퍼진다. 고양이가 눈이 뒤집혀 달려온다
      o.nip = now + 3500;
      o.pounceUntil = 0;
      for (let i = 0; i < 4; i++) fieldFx.push({ x: o.x + rand(-14, 14), y: o.y - o.half - rand(0, 14), t: now, nip: true });
      break;
    case 'windup':
      // 태엽을 다시 감는다
      Object.assign(o, { wind: 5, dir: Math.random() < 0.5 ? -1 : 1 });
      break;
    case 'wand': {
      // 줄을 휙 챈다 — 물고기가 높이 튄다
      const e = o.rod.pts[o.rod.pts.length - 1];
      e.py = e.y + 34;
      e.px = e.x + rand(-16, 16);
      break;
    }
    case 'laser':
      // 번쩍! 고양이가 깜짝 놀라 우다다
      o.flashUntil = now + 450;
      if (!sprite.action && !floating) sprite.play('zoomies');
      break;
    case 'bubbles':
      // 톡 누르면 방울이 한 움큼 (꾹 누르면 큰 방울 — releaseGiant)
      bubbleBurst(o, 7);
      break;
    case 'box':
    case 'bag':
    case 'scratcher':
      // 똑똑 두드리면: 안에 있으면 반응하고, 아직이면 바로 다가온다
      if (o.inside) reactInside(o);
      else {
        o.el.classList.remove('knock');
        void o.el.offsetWidth;
        o.el.classList.add('knock');
        if (['notice', 'sniff'].includes(o.state)) o.state = 'approach';
      }
      break;
  }
}

// 비눗방울 여러 개를 고리에서 한꺼번에 불어 낸다
function bubbleBurst(o, n) {
  const D = itemDot();
  const st = o.bub;
  for (let i = 0; i < n && st.list.length < 22; i++) {
    const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
    const sp = rand(40, 130);
    st.list.push({ x: mouseX + 7 * D, y: mouseY - 9 * D, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + Math.random() * 3, born: performance.now(), life: 7000 + Math.random() * 4000, wob: Math.random() * 6 });
  }
  if (soundOn) PetSound.play('bubble', 0.02);
}

// 꾹 누르는 동안 큰 방울이 부푼다
function startGiant(o) {
  if (o.bub.giant && !o.bub.giant.growing) return; // 이미 하나 떠 있다
  o.bub.giant = { x: mouseX, y: mouseY, r: 8, growing: true, born: performance.now() };
}

// 뗐다. 너무 짧게 눌렀으면 없던 일, 아니면 큰 방울이 천천히 가라앉다가 고양이에 닿으면 가둔다
function releaseGiant(o, quick) {
  const g = o.bub.giant;
  if (!g || !g.growing) return;
  if (quick || g.r < petPx() * 0.3) {
    o.bub.giant = null;
    return;
  }
  Object.assign(g, { growing: false, vx: 0, vy: 60, born: performance.now() });
}

function stepGiant(o, dt, now) {
  const g = o.bub.giant;
  if (!g) return;
  const P = petPx();
  if (g.growing) {
    g.r = Math.min(P * 0.72, g.r + 55 * dt);
    g.x = mouseX + 7 * itemDot();
    g.y = mouseY - 9 * itemDot() - g.r * 0.6;
    return;
  }
  if (g.trapped) {
    // 고양이를 품고 둥실둥실 올라간다
    g.y -= 42 * dt;
    g.x += Math.sin(now / 500) * 10 * dt;
    catX = clamp(g.x, ...lane());
    catLift = Math.max(0, window.innerHeight - g.y - P * 0.32);
    placeCat();
    if (now > g.popAt || g.y - g.r < 10) popGiant(o);
    return;
  }
  g.y += g.vy * dt;
  g.x += Math.sin(now / 700) * 6 * dt;
  // 고양이에 닿으면 쏙 가둔다 (바닥에 있을 때만)
  const cy = window.innerHeight - catLift - P * 0.32;
  if (!floating && catLift <= 0 && Math.hypot(g.x - catX, g.y - cy) < g.r + P * 0.12) {
    Object.assign(g, { trapped: true, popAt: now + 4200 });
    floating = true;
    pet.stat('giant');
    sprite.cancel();
    sprite.setToyPose('toyFloat');
    if (soundOn) PetSound.play('bubble', 0.03);
    return;
  }
  if (g.y + g.r >= floorY() || now - g.born > 9000) popGiant(o);
}

// 큰 방울이 톡 — 갇혀 있던 고양이는 떨어진다
function popGiant(o) {
  const t = o || toy;
  if (t && t.bub && t.bub.giant) {
    const g = t.bub.giant;
    t.bub.pops.push({ x: g.x, y: g.y, r: g.r / itemDot(), age: 0 });
    t.bub.giant = null;
  }
  if (floating) {
    floating = false;
    catVy = 0;
    sprite.setToyPose(null);
    sprite.play('toyPop');
    if (t) t.pounceUntil = performance.now() + 1500;
  }
  if (soundOn) PetSound.play('bubble', 0.03);
}

// ----- 마우스로 흔드는 장난감 -----

// 뛰어오르면 발이 닿나 (고양이 머리 위 조금까지)
function canReach(tg) {
  const cell = cellPx();
  const top = window.innerHeight - catLift - (PetSprite.GRID - sprite.headTop()) * cell;
  const P = petPx();
  return Math.abs(tg.x - catX) < P * 0.3 && tg.y > top - P * 0.22 && tg.y < window.innerHeight - catLift;
}

// 폴짝 — 필요한 높이만큼 뛴다 (위로 가는 속도는 중력으로 줄어든다)
function leap(h) {
  const P = petPx();
  const need = clamp(h, P * 0.25, P * 1.6);
  catVy = -Math.sqrt(2 * GRAVITY * need);
  catLift = 0.5;
  sprite.setToyPose(null);
  sprite.setMove(0);
  sprite.play('toyLeap');
}

function huntTarget(o) {
  const P = petPx();
  switch (o.mode) {
    case 'laser':
      return mouseX == null ? null : { x: mouseX, y: mouseY };
    case 'rod': {
      const e = o.rod.pts[o.rod.pts.length - 1];
      return { x: e.x, y: e.y + itemDot() * 2 };
    }
    case 'teaser':
      return { x: o.tz.tx, y: o.tz.ty };
    case 'bubbles': {
      // 닿을 만한 방울 중 가까운 것
      let best = null;
      let score = Infinity;
      for (const b of o.bub.list) {
        const h = floorY() - b.y;
        if (h > P * 2.3) continue;
        const s = Math.abs(b.x - catX) + h * 0.4;
        if (s < score) {
          score = s;
          best = b;
        }
      }
      return best ? { x: best.x, y: best.y, b: best } : null;
    }
  }
  return null;
}

function stepHunt(o, dt, now) {
  const P = petPx();
  // 큰 비눗방울에 갇혀 둥실 떠 있는 중
  if (floating) {
    sprite.setMove(0);
    return true;
  }
  const tg = huntTarget(o);

  // 공중에서는 몸을 틀어 목표 쪽으로 조금 더 간다. 닿으면 잡은 것
  if (catLift > 0) {
    sprite.setMove(0);
    if (tg && !lifted) {
      const dx = tg.x - catX;
      catX = clamp(catX + Math.sign(dx) * Math.min(220 * dt, Math.abs(dx)), ...lane());
      placeCat();
      if (!o.airCaught && canReach(tg)) {
        o.airCaught = true;
        huntCatch(o, tg, now, true);
      }
    }
    return true;
  }
  o.airCaught = false;
  if (now < o.busyUntil) {
    sprite.setMove(0);
    return true;
  }
  if (o.after && now > o.after.at) {
    const a = o.after;
    o.after = null;
    sprite.play(a.pose);
    o.busyUntil = now + a.hold;
    return true;
  }
  if (!tg) {
    // 쫓을 게 없다 (방울이 다 터졌다). 마우스 쪽을 보며 기다린다
    sprite.setMove(0);
    sprite.setToyPose(null);
    if (mouseX != null) face(mouseX);
    return true;
  }

  const h = floorY() - tg.y; // 바닥에서 얼마나 높이 있나
  const reach = 24;
  const dist = walkTo(tg.x, dt, o.mode === 'laser' ? 1.4 : 1, reach);
  sprite.setLook(Math.min(1, dist / 60));
  if (dist > reach) return true;
  face(tg.x);

  if (h < P * 0.5) {
    // 낮다 → 엉덩이 씰룩씰룩 하다가 덮친다
    sprite.setToyPose(null);
    if (now > o.pounceUntil) {
      if (!o.wiggled && Math.random() < 0.45) {
        o.wiggled = true;
        sprite.play('toyWiggle');
        o.busyUntil = now + 850;
        return true;
      }
      o.wiggled = false;
      o.pounceUntil = now + 1100;
      sprite.play('pounce');
      huntCatch(o, tg, now, false);
    }
  } else if (o.mode === 'teaser' && h < P * 1.15) {
    // 깃털이 코앞 높이면 뒷발로 서서 앞발 휙휙
    sprite.setToyPose('toySwipe');
    if (now > o.pounceUntil && Math.abs(tg.x - catX) < P * 0.3) {
      o.pounceUntil = now + 900;
      huntCatch(o, tg, now, false);
    }
  } else if (h < P * 2) {
    // 뛰면 닿는다 → 폴짝
    if (now > o.pounceUntil) {
      o.pounceUntil = now + 1500;
      leap(h - P * 0.55);
    } else sprite.setToyPose('toyChatter');
  } else {
    // 너무 높다 → 올려다보며 턱을 딱딱
    sprite.setToyPose('toyChatter');
  }
  return true;
}

function huntCatch(o, tg, now, inAir) {
  if (o.mode === 'bubbles') {
    popBubble(o, tg.b);
    if (!inAir) sprite.play('toyPop');
  }
  if (o.mode === 'rod') {
    // 앞발에 채인 물고기가 휙 튀어 오른다
    const e = o.rod.pts[o.rod.pts.length - 1];
    e.py = e.y + 16;
    e.px = e.x + rand(-10, 10);
  }
  if (o.mode === 'teaser') {
    o.tz.vy -= 500;
    o.tz.vx += rand(-260, 260);
  }
  if (o.mode === 'laser') o.after = { at: now + 650, pose: 'toyPeek', hold: 1400 }; // 잡았는데… 어라?
  scored(o, now);
}

// 낚싯대: 장대 끝에서 늘어진 줄(점 여러 개를 이은 것)을 매 프레임 흔든다
function makeRod() {
  const P = petPx();
  const n = 12;
  const r = { n, seg: (P * 0.95) / n, side: mouseX > catX ? -1 : 1, pts: [] };
  rodTip(r);
  for (let i = 0; i <= n; i++) r.pts.push({ x: r.tx, y: r.ty + i * r.seg, px: r.tx, py: r.ty + i * r.seg });
  return r;
}

// 장대는 고양이 쪽으로 기울여 든다
function rodTip(r) {
  const P = petPx();
  const want = catX < mouseX ? -1 : 1;
  r.side += (want - r.side) * 0.06;
  r.hx = mouseX;
  r.hy = mouseY;
  r.tx = mouseX + r.side * P * 0.45;
  r.ty = mouseY - P * 0.5;
}

function stepRod(r, dt) {
  rodTip(r);
  const g = GRAVITY * dt * dt;
  const floor = floorY() - 2;
  for (let i = 1; i < r.pts.length; i++) {
    const p = r.pts[i];
    let vx = (p.x - p.px) * 0.985;
    const vy = (p.y - p.py) * 0.985;
    if (p.y >= floor - 0.5) vx *= 0.7; // 바닥에 끌리는 줄은 빨리 선다
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + g;
  }
  for (let it = 0; it < 10; it++) {
    r.pts[0].x = r.tx;
    r.pts[0].y = r.ty;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1];
      const b = r.pts[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d <= r.seg) continue; // 줄이라 늘어지기만 하고 짧아지는 건 괜찮다
      const k = (d - r.seg) / d;
      if (i === 1) {
        b.x -= dx * k;
        b.y -= dy * k;
      } else {
        a.x += dx * k * 0.5;
        a.y += dy * k * 0.5;
        b.x -= dx * k * 0.5;
        b.y -= dy * k * 0.5;
      }
    }
    for (const p of r.pts) if (p.y > floor) p.y = floor;
  }
}

// 깃털 막대: 끝이 용수철처럼 늦게 따라와서 휘청인다
function stepTeaser(tz, dt) {
  const P = petPx();
  const want = catX < mouseX ? -1 : 1;
  tz.side += (want - tz.side) * 0.05;
  tz.hx = mouseX;
  tz.hy = mouseY;
  const rx = mouseX + tz.side * P * 0.35;
  const ry = mouseY - P * 0.55;
  const n = Math.ceil(dt / 0.016);
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    tz.vx += ((rx - tz.tx) * 90 - tz.vx * 7) * h;
    tz.vy += ((ry - tz.ty) * 90 - tz.vy * 7 + 300) * h;
    tz.tx += tz.vx * h;
    tz.ty += tz.vy * h;
  }
  tz.ty = Math.min(tz.ty, floorY() - 4);
  tz.bx = (tz.tx - rx) * -0.3;
  tz.by = (tz.ty - ry) * -0.3;
}

// 비눗방울: 마우스를 휘저으면 고리에서 방울이 나와 둥실둥실 떠다니다 톡
function stepBubbles(o, dt, now) {
  const st = o.bub;
  const D = itemDot();
  const vx = (mouseX - st.lx) / Math.max(dt, 0.001);
  const vy = (mouseY - st.ly) / Math.max(dt, 0.001);
  st.lx = mouseX;
  st.ly = mouseY;
  if (Math.hypot(vx, vy) > 160 && now > st.next && st.list.length < 14) {
    st.next = now + 110;
    st.list.push({
      x: mouseX + 7 * D, y: mouseY - 9 * D, vx: vx * 0.18 + rand(-20, 20), vy: vy * 0.18 - rand(10, 30),
      r: 2 + Math.random() * 3, born: now, life: 7000 + Math.random() * 4000, wob: Math.random() * 6,
    });
  }
  const damp = Math.pow(0.97, dt * 60);
  for (const b of st.list) {
    b.vx *= damp;
    b.vy = b.vy * damp + 14 * dt;
    b.x += (b.vx + Math.sin(now / 600 + b.wob) * 8) * dt;
    b.y += b.vy * dt;
  }
  st.list = st.list.filter((b) => {
    const dead = now - b.born > b.life || b.y + b.r * D >= floorY() || b.x < 0 || b.x > window.innerWidth;
    if (dead) st.pops.push({ x: b.x, y: b.y, r: b.r, age: 0 });
    return !dead;
  });
  st.pops = st.pops.filter((p) => (p.age += dt) < 0.3);
}

function popBubble(o, b) {
  const st = o.bub;
  const i = st.list.indexOf(b);
  if (i < 0) return;
  st.list.splice(i, 1);
  st.pops.push({ x: b.x, y: b.y, r: b.r, age: 0 });
  if (soundOn) PetSound.play('bubble', 0.02);
}

// ----- 큰 장난감 (상자·봉투·스크래처) -----

// 고양이 캔버스 가운데에서 장난감 가운데까지 몇 칸인가 (고양이 몸 한가운데 열은 가운데보다 반 칸 왼쪽)
const offOf = (o) => (o.x - (catX - cellPx() * 0.5)) / cellPx();

// 들어가기 전에 설 자리. 상자는 가까운 옆, 봉투는 입구 쪽(왼쪽), 스크래처는 그 위
function standX(o) {
  const P = petPx();
  if (o.key === 'bag') return o.x - P * 0.4;
  if (o.key === 'box') return o.x + (Math.sign(catX - o.x) || -1) * P * 0.42;
  return o.x;
}

function stepPlace(o, dt, now) {
  if (catLift > 0) return true;
  if (held && held.o === o) o.state = 'drop';
  switch (o.state) {
    case 'drop':
      // 떨어지는 중이거나 사람이 옮기는 중. 바닥에 놓이면 '어? 저게 뭐지'
      sprite.setMove(0);
      if (!(held && held.o === o) && resting(o)) {
        o.state = 'notice';
        o.until = now + 1100;
        face(o.x);
        sprite.play('perk');
      }
      return true;
    case 'notice':
      sprite.setMove(0);
      if (now > o.until) o.state = 'approach';
      return true;
    case 'approach':
      // 살금살금 다가가서
      if (walkTo(standX(o), dt, 0.6, 2) <= 3) {
        face(o.x);
        o.state = 'sniff';
        o.until = now + 1200;
        sprite.play('toySniff');
      }
      return true;
    case 'sniff':
      // 킁킁. 그새 옮겼으면 다시 다가간다
      sprite.setMove(0);
      if (!resting(o) || Math.abs(standX(o) - catX) > 8) o.state = 'approach';
      else if (now > o.until) enterPlaced(o, now);
      return true;
    case 'enter': {
      sprite.setMove(0);
      const k = clamp(1 - (o.until - now) / o.dur, 0, 1);
      if (o.key === 'box') {
        // 뛰어오르는 동안 상자 한가운데로. 공중에 뜬 뒤부터는 고양이 캔버스가 상자를 그린다
        const s = clamp((k - 0.25) / 0.55, 0, 1);
        catX = o.from + (o.x + cellPx() * 0.5 - o.from) * s * s * (3 - 2 * s);
        placeCat();
        if (k >= 0.55) o.el.hidden = true;
      }
      sprite.toyOff = offOf(o);
      if (now > o.until) {
        if (o.key === 'bag') {
          // 봉투 속으로 사라졌다. 이제부터 봉투는 고양이 캔버스가 그린다 (고양이는 안 보이니 자리를 봉투로 옮긴다)
          o.el.hidden = true;
          catX = o.x + cellPx() * 0.5;
          placeCat();
          sprite.toyOff = offOf(o);
        }
        o.state = 'inside';
        o.insideAt = now;
        if (o.key === 'box') pet.stat('box');
        nextPhase(o, now);
      }
      return true;
    }
    case 'inside':
      sprite.setMove(0);
      if (o.scoot) {
        // 봉투째 바닥을 슥슥 기어간다
        const [min, max] = lane();
        catX = clamp(catX + o.scoot.v * dt, min, max);
        o.x = catX - cellPx() * 0.5 + sprite.toyOff * cellPx();
        placeCat();
        if (now > o.scoot.until || catX <= min || catX >= max) o.scoot = null;
      }
      if (now > o.until) nextPhase(o, now);
      return true;
  }
  return true;
}

function enterPlaced(o, now) {
  o.inside = true;
  o.state = 'enter';
  o.from = catX;
  o.phase = null;
  if (o.key === 'box') {
    o.dur = 1100;
    sprite.play('toyBoxIn');
  } else if (o.key === 'bag') {
    o.dur = 900;
    sprite.play('toyBagIn');
  } else {
    // 스크래처는 그냥 올라선다
    o.dur = 1;
    o.el.hidden = true;
  }
  sprite.toyOff = offOf(o);
  o.until = now + o.dur;
}

// 안에 들어가 있는 동안의 순서
//  상자: 숨기 → 빼꼼 → 아늑 → 잠 / 봉투: 부스럭(가끔 기어가기) ↔ 눈만 반짝 / 스크래처: 벅벅 ↔ 식빵
function nextPhase(o, now) {
  const set = (pose, ms) => {
    o.phase = pose;
    o.until = now + ms;
    sprite.setToyPose(pose);
  };
  if (o.key === 'box') {
    if (!o.phase) set('toyBoxHide', rand(3000, 5000));
    else if (o.phase === 'toyBoxHide') set('toyBoxPeek', rand(4000, 6000));
    else if (o.phase === 'toyBoxPeek') set('toyBoxCozy', rand(20000, 28000));
    else set('toyBoxNap', 1e9);
  } else if (o.key === 'bag') {
    if (o.phase === 'toyBag') set('toyBagPeek', 4800);
    else {
      set('toyBag', rand(3000, 6000));
      if (Math.random() < 0.6) o.scoot = { v: (Math.random() < 0.5 ? -1 : 1) * petPx() * 0.45, until: now + 900 };
    }
  } else if (o.phase === 'toyScratch') set('toyScratchLoaf', rand(10000, 16000));
  else set('toyScratch', rand(4000, 6000));
}

// 안에 있을 때 쓰다듬거나 뭔가 일이 생기면: 상자는 쏙 튀어나왔다 들어가고, 봉투는 입구로 눈만 내민다
function reactInside(o) {
  const now = performance.now();
  if (o.state !== 'inside') return;
  if (o.key === 'box' && !sprite.action) sprite.play('toyBoxPop');
  if (o.key === 'bag') {
    o.phase = 'toyBagPeek';
    o.until = now + 2400;
    o.scoot = null;
    sprite.setToyPose('toyBagPeek');
  }
}

// ---------- 놀이판 (화면 전체 캔버스) ----------

let fieldDirty = false;
function resizeField() {
  fieldEl.width = window.innerWidth;
  fieldEl.height = window.innerHeight;
  fieldDirty = true;
}
function clearField() {
  fieldFx = [];
  fctx.clearRect(0, 0, fieldEl.width, fieldEl.height);
  fieldDirty = false;
}

function stepField(dt, now) {
  const o = toy;
  if (!o) return;
  if (mouseX != null) {
    if (o.mode === 'rod') stepRod(o.rod, dt);
    if (o.mode === 'teaser') stepTeaser(o.tz, dt);
    if (o.mode === 'bubbles') {
      stepBubbles(o, dt, now);
      stepGiant(o, dt, now);
    }
  }
  fieldFx = fieldFx.filter((f) => now - f.t < 700);
}

function drawField(now) {
  const o = toy;
  const need = o && (!['throw', 'place'].includes(o.mode) || (o.thread && o.thread.length) || fieldFx.length);
  if (need && o.mode === 'custom' && o.C.draw) {
    fieldDirty = true;
    fctx.clearRect(0, 0, fieldEl.width, fieldEl.height);
    o.C.draw(fctx, o, itemDot(), now);
    drawFieldFx(now);
    return;
  }
  if (!need) {
    if (fieldDirty) clearField();
    return;
  }
  fieldDirty = true;
  fctx.clearRect(0, 0, fieldEl.width, fieldEl.height);
  const D = itemDot();
  const t = now / 1000;
  const F = PetToys.field;
  if (o.thread && o.thread.length && o.threadEnd) F.thread(fctx, [...o.thread, o.threadEnd], D);
  if (mouseX != null) {
    if (o.mode === 'rod') F.rod(fctx, o.rod, D);
    if (o.mode === 'teaser') F.teaser(fctx, o.tz, D);
    if (o.mode === 'bubbles') {
      F.bubbles(fctx, o.bub, D, mouseX, mouseY, t);
      if (o.bub.giant) F.giant(fctx, o.bub.giant, D, t);
    }
    if (o.mode === 'laser') F.laser(fctx, mouseX, mouseY, D, t, (o.flashUntil || 0) > now ? 2.6 : 1);
  }
  drawFieldFx(now);
}

function drawFieldFx(now) {
  const D = itemDot();
  const F = PetToys.field;
  for (const f of fieldFx) {
    if (now < f.t) continue;
    if (f.nip) F.nip(fctx, f.x, f.y - (now - f.t) * 0.02, D, 1 - (now - f.t) / 700);
    else F.note(fctx, f.x, f.y - (now - f.t) * 0.03, D, 1 - (now - f.t) / 700);
  }
}

// ---------- 산책 ----------

// 심심하면 창 안에서 몇 걸음 걷는다. 자거나 말하는 중이면 가만히 있는다
function stepStroll(dt, now) {
  const [min, max] = lane();
  if (max - min < 28) {
    if (catX != null) goHome();
    return;
  }
  if (catX == null) return false; // 아직 첫 설정(저장한 자리)을 못 받았다

  if (strollTo == null) {
    sprite.setMove(0);
    if (now > nextIdleMotion) {
      // 가끔은 걷는 대신 켜 둔 모션 중 하나를 한다. 반복형 모션은 두 바퀴
      const awake = sprite.mood === 'idle' || sprite.mood === 'active';
      if (idlePool.length > 1 && idleTurn.at && now - idleTurn.at >= IDLE_HOLD) { idleTurn.i++; idleTurn.at = now; }
      const pick = idlePool.length ? idlePool[idleTurn.i % idlePool.length] : null;
      const M = pick && PetSprite.MOTIONS[pick];
      // 다른 걸 하는 중이면 조금 있다가 다시 본다
      nextIdleMotion = now + (M && awake && sprite.busy() ? 3000 : (50000 + Math.random() * 60000) * tp().idle);
      if (M && awake && !sprite.busy()) {
        sprite.play(pick, { times: M.loop ? 2 : 1 });
        if (!idleTurn.at) idleTurn.at = now; // 처음 쓴 때부터 5분을 센다
        nextStroll = Math.max(nextStroll, now + 8000);
        return;
      }
    }
    if (now < nextStroll) return;
    nextStroll = now + (14000 + Math.random() * 16000) * tp().stroll;
    if (sprite.busy() || sprite.mood !== 'idle' || current) return;
    // 화면이 넓어도 산책은 몇 걸음만. 벽에 붙어 있으면 반대쪽으로
    let dir = Math.random() < 0.5 ? -1 : 1;
    if (catX - min < 60) dir = 1;
    if (max - catX < 60) dir = -1;
    strollTo = Math.max(min, Math.min(max, catX + dir * (40 + Math.random() * 180) * tp().far));
    return;
  }

  const dx = strollTo - catX;
  if (Math.abs(dx) < 1.2 || sprite.mood === 'sleeping' || sprite.action) {
    strollTo = null;
    sprite.setMove(0);
    sprite.setFacing(1);
    return;
  }
  const v = Math.sign(dx) * 26; // 느릿느릿
  catX = Math.max(min, Math.min(max, catX + v * dt));
  sprite.setMove(v);
  placeCat();
}

pet.onPlay(({ toy: key, on, records, tugLevel }) => {
  // 놀이 기록(두더지 최고 점수·가위바위보 연승…)과 줄다리기 난이도는 main 이 같이 보내 준다 (toyplay4.js)
  if (records) window.TOY_RECORDS = { ...records };
  if (tugLevel) window.TUG_LEVEL = tugLevel;
  if (on) startPlay(key);
  else endPlay();
});

// 먹이는 고양이 옆 바닥에 툭 떨어진다
pet.onTreat(({ key }) => {
  if (sprite.motion) sprite.cancel(); // 하던 모션은 멈추고 주우러 간다
  const o = spawnItem(key);
  const [min, max] = lane();
  const from = catX == null ? (min + max) / 2 : catX;
  const side = Math.random() < 0.5 ? -1 : 1;
  o.x = Math.max(o.half, Math.min(window.innerWidth - o.half, from + side * (34 + Math.random() * 40)));
  o.y = 8;
  placeItem(o);
  treats.push(o);
  syncMood();
});

// 말풍선이 캐릭터 머리 위에 붙어 있게
function placeOverlays() {
  if (catX == null) return;
  const headPx = (PetSprite.GRID - sprite.headTop()) * scale + catLift;
  const keepIn = (el) => {
    const half = el.offsetWidth / 2 + 6;
    return `${Math.round(Math.max(half, Math.min(window.innerWidth - half, catX)))}px`;
  };
  const hintUp = hintEl.hidden ? 0 : 24;
  if (!hintEl.hidden) {
    hintEl.style.bottom = `${Math.round(headPx + 8)}px`;
    hintEl.style.left = keepIn(hintEl);
  }
  bubbleEl.style.bottom = `${Math.min(headPx + 8 + hintUp, window.innerHeight - 30)}px`;
  bubbleEl.style.left = keepIn(bubbleEl);
  if (!loadingEl.hidden) loadingEl.style.left = keepIn(loadingEl);
}

// ---------- 들어 올리기 ----------
// 잡은 자리를 축으로 진자처럼 흔들린다. 손이 움직이면 몸은 반대로 쏠렸다가 돌아오고,
// 뒷발과 꼬리는 몸보다 한 박자 늦게 따라온다
const swing = { a: 0, va: 0, l: 0, vl: 0, x: 0, v: 0, px: 24, py: 38 };

function grabSwing(pressInfo) {
  const cell = cellPx();
  swing.a = swing.va = swing.l = swing.vl = swing.v = 0;
  swing.x = catX;
  swing.px = clamp(24 + pressInfo.dx / cell, 18, 30);
  swing.py = clamp(PetSprite.GRID - pressInfo.dy / cell, 34, 40);
}

function stepSwing(dt) {
  if (!lifted) return;
  const P = petPx();
  const L = P * 0.55;
  const v = (catX - swing.x) / Math.max(dt, 0.001);
  swing.x = catX;
  const dv = clamp(v - swing.v, -2500, 2500);
  swing.v = v;
  // 묵직한 고양이: 손을 흔들어도 조금만 쏠리고, 금방 멈춘다 (문어처럼 출렁이지 않게)
  swing.va += (dv / L) * Math.cos(swing.a) * 0.4;
  swing.va += (-(GRAVITY / L) * Math.sin(swing.a) - 6 * swing.va) * dt;
  swing.a = clamp(swing.a + swing.va * dt, -0.4, 0.4);
  swing.vl += ((swing.a - swing.l) * 320 - swing.vl * 24) * dt;
  swing.l += swing.vl * dt;
  // 오래 들고 있으면: 4초 뒤 버둥버둥 "내려 줘", 10초가 넘으면 스스로 빠져나온다
  const heldFor = dragging ? performance.now() - liftAt : 0;
  const struggle = heldFor > HELD_STRUGGLE_MS && catLift > 6;
  if (struggle && !swing.said) {
    swing.said = true;
    pet.eventSay('heldLong');
  }
  if (dragging && heldFor > HELD_ESCAPE_MS && catLift > 6) return escapeHold();
  // 바닥에 발이 닿을 만큼 낮으면 들린 자세는 풀어 둔다 (발이 바닥을 뚫고 내려가 보인다)
  sprite.setHeld(catLift > 6 ? { rot: swing.a, legs: clamp((swing.a - swing.l) * 9, -2, 2), px: swing.px, py: swing.py, struggle } : null);
}

const HELD_STRUGGLE_MS = 4000;
const HELD_ESCAPE_MS = 10000;
let liftAt = 0; // 들어 올린 시각
let fallFrom = 0; // 놓았을 때 높이 (착지 반응을 고른다)

// 버둥대다 손에서 빠져나온다. 살짝 튀어 올랐다가 떨어진다
function escapeHold() {
  dragging = false;
  press = null;
  document.body.classList.remove('dragging');
  pet.drag('end', { x: catX });
  fallFrom = catLift;
  catVy = -220;
  catVx = (Math.random() < 0.5 ? -1 : 1) * 120;
  sprite.setHeld(null);
  pet.eventSay('heldEscape');
}

// 들어 올렸다 놓은 고양이, 장난감을 향해 뛴 고양이는 중력으로 떨어진다
function stepFall(dt) {
  if (dragging || floating || catLift <= 0) return;
  catVy += GRAVITY * dt;
  catLift = Math.max(0, catLift - catVy * dt);
  // 폭발 등으로 옆으로 날아가는 중
  if (catVx) {
    const [min, max] = lane();
    catX = clamp(catX + catVx * dt, min, max);
    if (catX <= min || catX >= max) catVx = -catVx * 0.4; // 벽에 부딪혀 튕긴다
  }
  if (!catLift) {
    catVy = 0;
    catVx = 0;
    if (lifted) {
      lifted = false;
      sprite.setHeld(null);
      // 높이서 떨어졌으면 쿵 착지 + 째려보기, 조금 들었다 놓았으면 귀만 쫑긋, 바닥에 내려놓았으면 그대로
      const P = petPx();
      if (fallFrom > P * 1.6) {
        sprite.play('land');
        pet.eventSay('dropHigh');
      } else if (fallFrom > P * 0.4 && !sprite.action) sprite.play('perk');
      fallFrom = 0;
    }
  }
  placeCat();
}

// ---------- 깜짝 이벤트 ----------
// main/treasure.js 가 가끔 보낸다.
//  fetch : 화면 밖으로 나갔다가 보물을 물고 돌아온다   bird : 새가 날아가다 보물을 떨어뜨린다
//  rare : 평소엔 안 하는 모션을 한 번   (동네 친구는 아래 '동네 친구' 가 따로 맡는다)
// 보물은 바닥에 떨어지고, 눌러서 줍는다. 한참 안 주우면 고양이가 알아서 챙겨 둔다
let ev = null; // 진행 중인 fetch (bird 는 따로 날아다닌다)
let birds = [];
let loot = []; // 바닥에 떨어진 보물
const LOOT_KEEP_MS = 10 * 60_000;
// 손님 고양이 털색은 sprite.js 의 PetSprite.GUEST_FURS (도감도 같이 쓴다)
const GUEST_FURS = PetSprite.GUEST_FURS;

function spawnLoot(key, x, y) {
  const o = spawnItem(key);
  o.el.classList.add('loot');
  Object.assign(o, { loot: true, born: performance.now(), x: clamp(x, o.half, window.innerWidth - o.half), y, vx: rand(-40, 40), vy: -60 });
  placeItem(o);
  loot.push(o);
  return o;
}

function collectLoot(o) {
  if (!loot.includes(o)) return;
  loot = loot.filter((x) => x !== o);
  o.el.classList.remove('loot');
  o.el.classList.add('collect');
  setTimeout(() => o.el.remove(), 520);
  if (soundOn) PetSound.play('pop', 0.02);
  pet.treasure(o.key);
}

// 고양이가 딴 걸 하고 있지 않나 (먹기·놀기·들림 중이면 이벤트는 건너뛴다)
const catFree = () => !ev && !toy && !treats.length && !held && !dragging && !lifted && catLift <= 0 && catX != null;

pet.onEvent((e) => {
  const now = performance.now();
  if (e.type === 'bird') return startBird(e.treasure);
  if (!catFree() || hunt) return;
  if (e.type === 'rare') {
    pendingRare = { motion: e.motion, until: performance.now() + 60_000 };
    return;
  }
  if (sprite.motion) sprite.cancel();
  strollTo = null;
  const [min, max] = lane();
  const side = catX - min < max - catX ? -1 : 1; // 가까운 쪽 화면 끝으로
  if (e.type === 'fetch') {
    ev = { type: 'fetch', key: e.treasure, phase: 'out', side, home: catX, x: catX, until: 0 };
    pet.eventSay('eventFetchOut');
  }
  void now;
});

// 새 한 마리. 화면 한쪽에서 날아와 고양이 근처에서 보물을 떨어뜨리고 반대쪽으로 사라진다
function startBird(key) {
  const el = document.createElement('canvas');
  el.className = 'bird';
  document.body.appendChild(el);
  const dir = Math.random() < 0.5 ? 1 : -1;
  if (dir < 0) el.classList.add('left');
  const P = petPx();
  const x0 = dir > 0 ? -30 : window.innerWidth + 30;
  const at = catX != null ? catX : window.innerWidth / 2;
  birds.push({ el, key, dir, x: x0, y0: floorY() - P * rand(1.7, 2.6), t: 0, dropX: clamp(at + rand(-140, 140), 40, window.innerWidth - 40), dropped: !key, frame: -1 });
}

function stepBirds(dt) {
  for (const b of birds) {
    b.t += dt;
    b.x += b.dir * 180 * dt;
    b.y = b.y0 + Math.sin(b.t * 5) * 6;
    const f = Math.floor(b.t / 0.14) % 2;
    if (f !== b.frame) {
      b.frame = f;
      PixelArt.paint(b.el, f ? 'bird1' : 'bird2', itemDot());
    }
    b.el.style.left = `${Math.round(b.x)}px`;
    b.el.style.top = `${Math.round(b.y)}px`;
    if (!b.dropped && (b.dir > 0 ? b.x >= b.dropX : b.x <= b.dropX)) {
      b.dropped = true;
      spawnLoot(b.key, b.x, b.y + 10);
      // 깨어 있으면 고양이가 올려다보고 한마디
      if (catX != null && !sprite.busy() && ['idle', 'active', 'thinking'].includes(sprite.mood)) {
        face(b.x);
        if (!toy && !treats.length) sprite.play('perk');
      }
      pet.eventSay('eventBird');
    }
    if (b.x < -60 || b.x > window.innerWidth + 60) b.gone = true;
  }
  for (const b of birds) if (b.gone) b.el.remove();
  birds = birds.filter((b) => !b.gone);
}

// 드문 모션은 고양이가 한가할 때 한다 (바쁘면 1분까지 기다린다)
let pendingRare = null;
function stepRare(now) {
  if (!pendingRare) return;
  if (now > pendingRare.until) return (pendingRare = null);
  if (!catFree() || hunt || sprite.busy() || sprite.move || !['idle', 'active'].includes(sprite.mood)) return;
  sprite.play(pendingRare.motion, { times: 1 });
  pendingRare = null;
  pet.eventSay('eventRare');
}

// fetch 진행. 고양이를 이쪽에서 움직였으면 true
function stepEvent(dt, now) {
  if (!ev) return false;
  const P = petPx();
  const [min, max] = lane();
  if (ev.type === 'fetch') {
    // 사람이 들어 올리거나 간식을 주면 그만둔다
    if (dragging || lifted || treats.length || toy) {
      endFetch(false);
      return false;
    }
    const speed = 150;
    if (ev.phase === 'out') {
      // 화면 끝까지 걸어가서, 끝을 넘어 밖으로 나간다 (catX 는 끝에 두고 캔버스만 더 민다)
      if (Math.abs(catX - (ev.side < 0 ? min : max)) > 2) {
        walkTo(ev.side < 0 ? min : max, dt);
        ev.x = catX;
        return true;
      }
      ev.x += ev.side * speed * dt;
      sprite.setMove(ev.side * speed);
      canvas.style.left = `${Math.round(ev.x - P / 2)}px`;
      if (Math.abs(ev.x - catX) > P) {
        ev.phase = 'away';
        ev.until = now + rand(5000, 9000);
        canvas.style.visibility = 'hidden';
        sprite.setMove(0);
      }
      return true;
    }
    if (ev.phase === 'away') {
      if (now < ev.until) return true;
      ev.phase = 'in';
      canvas.style.visibility = '';
      sprite.carry = 'treasure';
      sprite.carryKey = ev.key;
      return true;
    }
    if (ev.phase === 'in') {
      ev.x -= ev.side * speed * dt;
      sprite.setMove(-ev.side * speed);
      canvas.style.left = `${Math.round(ev.x - P / 2)}px`;
      if (ev.side < 0 ? ev.x >= catX : ev.x <= catX) {
        ev.phase = 'back';
        ev.backTo = clamp(catX - ev.side * rand(80, 200), min, max);
      }
      return true;
    }
    if (ev.phase === 'back') {
      if (walkTo(ev.backTo, dt) > 2) return true;
      endFetch(true);
      return true;
    }
  }
  return false;
}

// ---------- 동네 친구 (7차) ----------
// main/friends.js 가 두 시간쯤마다 한 친구를 보낸다 (단짝은 하우스에서 불러도 온다). 정해진 시간만큼 머물다 간다.
//  - 고양이 옆 자리에 와서 앉아 있다가 가끔 자리를 옮기고, 장난감이 나와 있으면 같이 쫓아가 폴짝
//  - 가끔 우리 고양이와 수다 (한 번 올 때 두 번쯤)
//  - 들어서 옮길 수 있고, 더블 클릭하면 카드가 뜬다 (TMI · 남은 시간 · 물물교환 · 밥·간식 주기)
// 고양이 친구(fur)는 sprite.js 의 PetRenderer, 동물 친구(art)는 friends.js 의 PetFriends.draw 로 그린다
let friend = null;
let quietNow = false; // 방해 금지 (main 이 pushState 로 알려 준다)
let bubblesOn = true; // 설정의 말풍선 켜기
const FSPEED = 110;
const fbubble = document.createElement('div');
fbubble.className = 'bubble fbubble';
fbubble.hidden = true;
document.body.appendChild(fbubble);
const cbubble = document.createElement('div'); // 수다할 때 우리 고양이 말 (보통 말풍선과 따로)
cbubble.className = 'bubble fbubble cat';
cbubble.hidden = true;
document.body.appendChild(cbubble);
let fcard = null; // 누르면 뜨는 친구 카드
// 카드 윗줄을 끌어 옮긴 자리 ({ left, top }). 먹이를 주거나 교환해서 카드를 다시 그려도 그 자리에 둔다.
// 사람이 카드를 닫거나 친구가 가면 다시 친구 옆에 붙는다
let fcardPos = null;
let fcardDrag = null;

pet.onFriend((f) => startFriend(f));
pet.onFriendLeave(() => friend && friendBye(true));
pet.onFriendWear((w) => friend && friend.r && friend.id === w.id && friend.r.setAccessory(w.wear));

function friendName(id) {
  return T.t('fr.' + id + '.name');
}

function startFriend(f) {
  if (friend) removeFriend();
  const c = document.createElement('canvas');
  c.className = 'friend';
  c.width = c.height = PetSprite.GRID;
  document.body.appendChild(c);
  let r = null;
  if (f.fur != null) {
    r = new PetSprite.PetRenderer(c);
    r.fur = PetSprite.GUEST_FURS[f.fur];
    r.setStage('cat');
    r.setAccessory(f.wear || 'none'); // 선물 받은 공방 코스튬
    r.setMood('idle');
  }
  const P = petPx();
  const [min, max] = lane();
  // 고양이와 가까운 화면 끝에서 들어온다
  const fromLeft = catX == null ? Math.random() < 0.5 : catX < (min + max) / 2;
  const now = performance.now();
  const stay = Math.max(30_000, f.until - Date.now());
  friend = {
    ...f, canvas: c, r, ctx: c.getContext('2d'), x: fromLeft ? -P / 2 : window.innerWidth + P / 2, lift: 0, vy: 0,
    facing: fromLeft ? 1 : -1, state: 'enter', target: 0, wanderAt: now + 25_000, leaveAt: now + stay,
    chatAt: now + (f.kind === 'call' ? 35_000 : 70_000), chat2At: now + (f.kind === 'call' ? 170_000 : 330_000), chats: [], talked: new Set(),
    eatUntil: 0, food: null, hopAt: 0, said: false,
  };
  friend.target = friendSpot();
  c.addEventListener('mousedown', grabFriend);
  placeFriend();
}

// 우리 고양이 옆 (화면 안쪽) 자리
function friendSpot() {
  const P = petPx();
  const [min, max] = lane();
  if (catX == null) return (min + max) / 2;
  const side = catX > (min + max) / 2 ? -1 : 1;
  return clamp(catX + side * P * rand(0.9, 1.6), min, max);
}

function placeFriend() {
  if (!friend) return;
  const P = petPx();
  const c = friend.canvas;
  c.style.width = c.style.height = `${P}px`;
  c.style.left = `${Math.round(friend.x - P / 2)}px`;
  c.style.bottom = `${Math.round(friend.lift)}px`;
}

function removeFriend() {
  if (!friend) return;
  friend.canvas.remove();
  if (friend.food) friend.food.remove();
  fbubble.hidden = true;
  cbubble.hidden = true;
  closeFriendCard(true);
  friend = null;
}

// 시간이 다 됐다: 인사하고 (가끔 보물을 두고) 화면 밖으로
async function friendBye(fromMain) {
  if (!friend || friend.state === 'bye') return;
  friend.state = 'bye';
  closeFriendCard(true);
  const r = fromMain ? null : await pet.friendBye().catch(() => null);
  if (!friend) return;
  if (r && r.gift) spawnLoot(r.gift, friend.x, floorY() - 20);
  friendSay(friendLine('bye', 'fr.bye'), 'f');
  pet.eventSay('eventGuestBye', { friend: friend.id, item: (r && r.gift) || undefined });
  const [min, max] = lane();
  friend.exit = friend.x > (min + max) / 2 ? window.innerWidth + petPx() : -petPx();
}

// 친구마다 다른 멘트 (i18n 'fr.<id>.<kind>', 여러 개면 '|' 로 나눠 하나 고른다). 없으면 공통 멘트
function friendLine(kind, common) {
  const key = friend ? 'fr.' + friend.id + '.' + kind : '';
  const s = key ? T.t(key) : key;
  if (!s || s === key) return common ? T.t(common) : '';
  const all = String(s).split('|');
  return all[Math.floor(Math.random() * all.length)];
}

// 말풍선: who = 'f'(친구) | 'c'(우리 고양이)
function friendSay(text, who, ms = 3200) {
  const el = who === 'c' ? cbubble : fbubble;
  el.textContent = text;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => (el.hidden = true), 150);
  }, ms);
}

// 수다 한 판: 'f:…|c:…|f:…' 를 한 줄씩 번갈아
function friendChat() {
  if (!friend || quietNow || !bubblesOn) return;
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((i) => !friend.talked.has(i) && T.t('fr.' + friend.id + '.talk' + i) !== 'fr.' + friend.id + '.talk' + i);
  if (!all.length) return;
  const i = all[Math.floor(Math.random() * all.length)];
  friend.talked.add(i);
  const lines = String(T.t('fr.' + friend.id + '.talk' + i)).split('|').map((x) => [x.slice(0, 1), x.slice(2)]);
  const now = performance.now();
  friend.chats = lines.map(([who, text], k) => ({ at: now + k * 3400, who, text }));
}

function stepFriend(dt, now) {
  if (!friend) return;
  const f = friend;
  const P = petPx();
  const [min, max] = lane();
  // 떠날 때
  if (f.state !== 'bye' && now >= f.leaveAt && !f.held) friendBye(false);
  // 들려 있으면 떨어뜨릴 때까지 아무것도 안 한다. 놓으면 바닥으로 뚝
  if (!f.held && f.lift > 0) {
    f.vy -= 1400 * dt;
    f.lift = Math.max(0, f.lift + f.vy * dt);
    if (f.lift === 0) {
      if (f.vy < -500) friendSay(friendLine('thrown') || '!!', 'f', 2000);
      f.vy = 0;
    }
  }
  let mode = 'idle';
  if (f.held) mode = 'held';
  else if (f.state === 'bye') {
    const d = f.exit - f.x;
    f.x += Math.sign(d) * FSPEED * 1.2 * dt;
    f.facing = Math.sign(d) || f.facing;
    mode = 'walk';
    if (Math.abs(d) < 4) return removeFriend();
  } else if (now < f.eatUntil) mode = 'eat';
  else {
    if (f.food) {
      f.food.remove();
      f.food = null;
    }
    // 장난감이 나와 있으면 그쪽으로 가서 폴짝 (흔드는 장난감은 커서 쪽으로)
    let goal = f.target;
    if (toy) {
      const tx = isCursorToy() ? mouseX : toy.x;
      if (tx != null) goal = clamp(tx + (tx > f.x ? -P * 0.4 : P * 0.4), min, max);
    } else if (now > f.wanderAt) {
      f.target = friendSpot();
      goal = f.target;
      f.wanderAt = now + rand(25_000, 45_000);
    }
    const d = goal - f.x;
    if (Math.abs(d) > 3) {
      f.x += Math.sign(d) * Math.min(Math.abs(d), FSPEED * dt);
      f.facing = Math.sign(d);
      mode = 'walk';
    } else {
      if (f.state === 'enter') {
        f.state = 'here';
        friendSay(friendLine('hi', 'fr.hi'), 'f', 2800);
        pet.eventSay('eventGuest', { friend: f.id });
        if (f.r) f.r.play('wave');
      }
      if (catX != null && !toy) f.facing = Math.sign(catX - f.x) || f.facing;
      if (toy && now > f.hopAt) f.hopAt = now + rand(1200, 2600);
      if (toy && now < f.hopAt - 600 && now > f.hopAt - 1300) mode = 'hop';
    }
    // 수다: 도착하고 한참 뒤 한 번, 몇 분 뒤 또 한 번 (말풍선이 비어 있을 때만)
    if (f.state === 'here' && bubbleEl.hidden && !fcard) {
      if (f.chatAt && now > f.chatAt) { f.chatAt = 0; friendChat(); }
      else if (f.chat2At && now > f.chat2At) { f.chat2At = 0; friendChat(); }
    }
  }
  for (const c of f.chats) if (!c.done && now >= c.at) { c.done = true; friendSay(c.text, c.who); if (c.who === 'c' && catX != null) face(f.x); }
  // 그리기
  if (f.r) {
    f.r.setFacing(f.facing);
    f.r.setMove(mode === 'walk' ? f.facing * FSPEED : 0);
    f.r.setHeld(mode === 'held' ? { rot: 0, legs: 0, px: 24, py: 36 } : null);
    if (mode === 'hop' && !f.r.action) f.r.play('happy');
    f.r.frame();
  } else {
    f.ctx.clearRect(0, 0, PetSprite.GRID, PetSprite.GRID);
    PetFriends.draw(f.ctx, f.art, now / 1000, mode, f.facing);
  }
  placeFriend();
}

// 말풍선·카드 자리 (고양이 말풍선과 같은 식으로 머리 위에)
function placeFriendOverlays() {
  const P = petPx();
  const put = (el, x, bottom) => {
    if (el.hidden) return;
    const half = el.offsetWidth / 2 + 6;
    el.style.left = `${Math.round(Math.max(half, Math.min(window.innerWidth - half, x)))}px`;
    el.style.bottom = `${Math.round(Math.min(bottom, window.innerHeight - 40))}px`;
  };
  if (friend) put(fbubble, friend.x, friend.lift + P * 0.62);
  if (catX != null) put(cbubble, catX, catLift + P * 0.62 + (bubbleEl.hidden ? 0 : 44));
  // 카드는 머리 위가 아니라 친구 옆에 붙인다. 말풍선이 머리 위 가운데에 뜨니까 말풍선 반 폭만큼 더 비켜 선다.
  // 고양이가 있는 쪽은 고양이 말풍선이 뜨니 반대쪽을 먼저 쓰고, 화면 끝이라 자리가 없으면 다른 쪽으로
  if (fcard && friend && fcardPos) {
    // 사람이 옮겨 둔 자리. 창 밖으로는 못 나간다
    const w = fcard.offsetWidth, h = fcard.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, fcardPos.left));
    const top = Math.max(8, Math.min(window.innerHeight - h - 8, fcardPos.top));
    fcard.style.left = `${Math.round(left)}px`;
    fcard.style.bottom = `${Math.round(window.innerHeight - top - h)}px`;
  } else if (fcard && friend) {
    const w = fcard.offsetWidth, h = fcard.offsetHeight;
    const half = (el) => (el.hidden ? 0 : el.offsetWidth / 2);
    const gap = Math.max(P * 0.45, half(fbubble), 70) + 8;
    const rightX = friend.x + gap, leftX = friend.x - gap - w;
    const fitsR = rightX + w <= window.innerWidth - 8, fitsL = leftX >= 8;
    const preferR = catX == null ? true : catX < friend.x;
    const x = (preferR ? fitsR : !fitsL) ? (fitsR ? rightX : leftX) : fitsL ? leftX : rightX;
    fcard.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - w - 8, x)))}px`;
    fcard.style.bottom = `${Math.round(Math.max(8, Math.min(window.innerHeight - h - 8, friend.lift)))}px`;
  }
}

// ---- 들어서 옮기기 ----
function grabFriend(e) {
  if (e.button !== 0 || !friend || friend.state === 'bye') return;
  e.stopPropagation();
  friend.held = { dx: e.clientX - friend.x, dy: window.innerHeight - e.clientY - friend.lift, x0: e.clientX, y0: e.clientY, moved: false };
  document.body.classList.add('dragging');
}
function moveFriend(e) {
  if (!friend || !friend.held) return false;
  const h = friend.held;
  if (!h.moved && Math.hypot(e.clientX - h.x0, e.clientY - h.y0) < 5) return true;
  h.moved = true;
  const [min, max] = lane();
  friend.x = clamp(e.clientX - h.dx, min, max);
  friend.lift = Math.max(0, window.innerHeight - e.clientY - h.dy);
  friend.vy = 0;
  friend.target = friend.x;
  placeFriend();
  return true;
}
// 놓을 때: 끌지 않고 눌렀다 뗐으면(클릭) 친구 카드(물물교환·밥 주기·친밀도)를 열고, 열려 있으면 접는다. 끌었으면 거기 내려놓는다
function dropFriend() {
  if (!friend || !friend.held) return false;
  const clicked = !friend.held.moved;
  friend.held = null;
  document.body.classList.remove('dragging');
  if (clicked) fcard ? closeFriendCard(true) : openFriendCard();
  return true;
}
function isOverFriend(e) {
  if (!friend) return false;
  const r = friend.canvas.getBoundingClientRect();
  const gx = ((e.clientX - r.left) / r.width) * PetSprite.GRID;
  const gy = ((e.clientY - r.top) / r.height) * PetSprite.GRID;
  if (friend.r) return friend.r.hit(gx, gy);
  return PetFriends.hit(friend.art, friend.facing < 0 ? PetSprite.GRID - 1 - gx : gx, gy);
}
function isOverFriendUi(e) {
  const inside = (el) => {
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };
  return inside(fcard) || isOverFriend(e);
}

// ---- 친구 카드: 친밀도 · 남은 시간 · 물물교환 · 밥·간식 주기 ----
async function openFriendCard() {
  if (!friend || friend.state === 'bye') return;
  const info = await pet.friendInfo().catch(() => null);
  if (!info || !friend || info.id !== friend.id) return;
  closeFriendCard();
  const id = info.id;
  const ic = (k, n = 16) => PixelArt.svg(k, n);
  const hearts = [1, 2, 3].map((i) => `<span class="${i <= info.level ? 'on' : ''}">${ic('heart', 11)}</span>`).join('');
  // 친밀도 막대: 지금 단계에서 다음 단계까지 얼마나 찼나 (단짝이면 가득). 단계 점수는 main/friends.js 의 FRIEND_STEPS
  const prev = info.prev || 0;
  const pct = info.next ? Math.round(((info.pts - prev) / (info.next - prev)) * 100) : 100;
  const bondNote = info.next
    ? T.t('fr.toNext', { level: T.t('friend.' + (info.level + 1)), n: info.next - info.pts })
    : T.t('fr.bondMax');
  const w = info.want, g = info.gift;
  const enough = w.have >= w.n;
  const tradeBtn = info.traded
    ? `<span class="fc-note">${esc(T.t('fr.traded'))}</span>`
    : `<button class="fc-btn" data-fc="trade" ${enough ? '' : 'disabled'}>${esc(T.t('fr.trade'))}</button>${enough ? '' : `<span class="fc-note">${esc(T.t('fr.short'))}</span>`}`;
  const full = info.feeds >= info.maxFeeds;
  const foods = info.pantry.length
    ? info.pantry.map((p) => `<button class="fc-food" data-feed="${p.key}" data-group="${p.group}" title="${esc(T.t('item.' + p.key))}" ${full ? 'disabled' : ''}>${ic(p.key, 26)}<small>${p.n}</small></button>`).join('')
    : `<span class="fc-note">${esc(T.t('fr.feedNone'))}</span>`;
  fcard = document.createElement('div');
  fcard.className = 'fcard';
  // 윗줄(이름·별명)은 잡고 끌어서 카드를 옮기는 손잡이다
  fcard.innerHTML = `
    <div class="fc-head" title="${esc(T.t('fr.cardDrag'))}">
      <span class="fc-grip" aria-hidden="true"></span>
      <div class="fc-id">
        <div class="fc-name">${esc(friendName(id))}</div>
        <div class="fc-sp">${esc(T.t('fr.' + id + '.nick'))} · ${esc(T.t('fr.' + id + '.species'))}</div>
      </div>
      <button class="fc-x" data-fc="close" aria-label="close">×</button>
    </div>
    <div class="fc-body">
      <div class="fc-time">${ic('hourglass', 12)}<span class="fc-left"></span></div>
      <div class="fc-bond">
        <div class="fc-bond-top"><span class="fc-hearts">${hearts}</span><b>${esc(T.t('friend.' + info.level))}</b><span class="fc-note">${esc(bondNote)}</span></div>
        <div class="fc-bar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="fc-sec">
        <div class="fc-title"><b>${esc(T.t('fr.want'))}</b><small>${esc(T.t('fr.ptsTrade'))}</small></div>
        <div class="fc-trade">
          <div class="fc-box">${ic(w.key, 24)}<span><b>${esc(T.t('treasure.' + w.key))} ×${w.n}</b><small class="${enough ? 'ok' : 'lack'}">${esc(T.t('fr.have', { n: w.have }))}</small></span></div>
          <span class="fc-arrow">→</span>
          <div class="fc-box gift">${ic(g.key, 24)}<span><b>×${g.n}</b><small>${esc(T.t('fr.gift'))}</small></span></div>
        </div>
        <div class="fc-row">${tradeBtn}</div>
      </div>
      <div class="fc-sec">
        <div class="fc-title"><b>${esc(T.t('fr.feed'))}</b><small class="${full ? 'lack' : ''}">${esc(full ? T.t('fr.full') : T.t('fr.feedLeft', { n: info.maxFeeds - info.feeds }))}</small></div>
        <div class="fc-note">${esc(T.t('fr.ptsFeed'))}</div>
        <div class="fc-foods">${foods}</div>
      </div>
    </div>`;
  document.body.appendChild(fcard);
  fcard.querySelector('.fc-head').addEventListener('mousedown', grabCard);
  const tickLeft = () => {
    if (!fcard || !friend) return;
    const ms = Math.max(0, friend.until - Date.now());
    fcard.querySelector('.fc-left').textContent = T.t('fr.left', { m: Math.floor(ms / 60000), s: Math.floor((ms % 60000) / 1000) });
  };
  tickLeft();
  fcard._timer = setInterval(tickLeft, 1000);
  fcard.addEventListener('mousedown', (e) => e.stopPropagation());
  fcard.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.fc === 'close') return closeFriendCard(true);
    if (b.dataset.fc === 'trade') {
      const r = await pet.friendTrade();
      if (r && r.ok) {
        friendSay(friendLine('thanks', 'fr.thanks'), 'f');
        if (friend && friend.r) friend.r.play('happy');
        openFriendCard();
      }
      return;
    }
    if (b.dataset.feed) {
      const r = await pet.friendFeed(b.dataset.feed);
      if (r && r.ok && friend) {
        friendEat(b.dataset.feed);
        openFriendCard();
      } else if (r && r.error === 'full') friendSay(friendLine('full', 'fr.fullSay'), 'f');
    }
  });
  placeFriendOverlays();
}
// forget: 사람이 닫았으면 끌어 옮긴 자리도 잊는다 (다시 그릴 때는 그대로 둔다)
function closeFriendCard(forget) {
  if (forget) fcardPos = null;
  if (fcardDrag) dropCard();
  if (!fcard) return;
  clearInterval(fcard._timer);
  fcard.remove();
  fcard = null;
}

// ---- 친구 카드 끌어 옮기기: 윗줄(이름 칸)을 잡고 끈다 ----
function grabCard(e) {
  if (e.button !== 0 || !fcard || e.target.closest('button')) return;
  const r = fcard.getBoundingClientRect();
  fcardDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
  fcard.classList.add('moving');
  document.body.classList.add('dragging');
  e.preventDefault();
}
function moveCard(e) {
  if (!fcardDrag || !fcard) return false;
  fcardPos = { left: e.clientX - fcardDrag.dx, top: e.clientY - fcardDrag.dy };
  placeFriendOverlays();
  return true;
}
function dropCard() {
  if (!fcardDrag) return false;
  fcardDrag = null;
  if (fcard) fcard.classList.remove('moving');
  document.body.classList.remove('dragging');
  return true;
}

// 받아먹기: 발 앞에 먹이를 놓고, 우리 고양이처럼 한 입씩 야금야금 (친구 쪽 가장자리부터 이빨 자국으로 사라진다)
const FRIEND_BITE_MS = 640;
function friendEat(key) {
  const f = friend;
  if (!f) return;
  if (f.food) f.food.remove();
  const el = document.createElement('canvas');
  el.className = 'friend-food';
  PixelArt.paint(el, key, itemDot());
  document.body.appendChild(el);
  const fx = f.x + f.facing * petPx() * 0.22;
  el.style.left = `${Math.round(fx - el.width / 2)}px`;
  el.style.bottom = `${Math.round(f.lift)}px`;
  f.food = el;
  // 한 입 간격 × (BITES + 1): 마지막 한 입 뒤 잠깐 있다가 치운다 (stepFriend 가 eatUntil 이 지나면 치운다)
  f.eatUntil = performance.now() + FRIEND_BITE_MS * (BITES + 1);
  const bite = { key, el };
  const fromLeft = f.x < fx;
  for (let i = 1; i <= BITES; i++)
    setTimeout(() => {
      if (friend !== f || f.food !== el) return;
      if (f.r) f.r.play('nibble');
      if (soundOn) PetSound.play('pop', 0.015);
      paintBitten(bite, i / (BITES + 1), fromLeft);
    }, FRIEND_BITE_MS * (i - 0.5));
  setTimeout(() => friend === f && friendSay(friendLine('yum', 'fr.yum'), 'f'), 1600);
}

// 물어 오기 끝: 입에 문 보물을 발 앞에 내려놓는다 (중간에 그만뒀으면 그냥 들고 온 셈 치고 떨군다)
function endFetch(done) {
  if (!ev) return;
  const key = ev.key;
  // 이미 밖에 나갔다 왔으면(보물을 찾았으면) 끊겨도 그 자리에 떨군다
  const found = ['away', 'in', 'back'].includes(ev.phase);
  canvas.style.visibility = '';
  sprite.carry = null;
  sprite.carryKey = null;
  ev = null;
  placeCat();
  if (!key || !(done || found)) return;
  spawnLoot(key, catX + sprite.facing * petPx() * 0.3, floorY() - petPx() * 0.25);
  if (!done) return;
  sprite.play('happy');
  pet.eventSay('eventFetchBack', { item: key });
}

// ---------- 커서 사냥 ----------
// 커서가 바닥 가까이에서 한참 가만히 있으면, 가끔 고양이가 몸을 낮춰 살금살금 다가가
// 엉덩이를 씰룩이다 덮친다. 다가가는 동안 커서가 움직이면 멈칫하고 그만둔다
let hunt = null;
let nextHunt = performance.now() + 3 * 60_000;
const HUNT_STILL_MS = 7000;

function stepHunt(dt, now) {
  const P = petPx();
  if (!hunt) {
    if (now < nextHunt || now - lastMouseMove < HUNT_STILL_MS || mouseX == null) return false;
    const near = mouseY > floorY() - P * 2.6 && Math.abs(mouseX - catX) < 360 && Math.abs(mouseX - catX) > P * 0.7;
    const calm = catFree() && !sprite.busy() && (sprite.mood === 'idle' || sprite.mood === 'active');
    if (!near || !calm) return false;
    nextHunt = now + 60_000;
    if (Math.random() > tp().hunt) return false;
    hunt = { phase: 'stalk', x: mouseX, y: mouseY, startMove: lastMouseMove };
    strollTo = null;
    sprite.setToyPose('huntCrouch');
  }
  // 사람이 들어 올리거나 먹이·장난감·이벤트가 끼어들면 그만
  if (dragging || lifted || toy || treats.length || ev) return endHunt(false), false;
  const moved = lastMouseMove !== hunt.startMove;
  if (hunt.phase === 'stalk') {
    if (moved) {
      // 들켰다: 멈칫하고 딴청
      endHunt(false);
      sprite.play('perk');
      if (Math.random() < 0.5) pet.eventSay('huntMiss');
      return true;
    }
    const d = hunt.x - catX;
    face(hunt.x);
    if (Math.abs(d) > P * 0.55) {
      const [min, max] = lane();
      catX = clamp(catX + Math.sign(d) * 38 * dt, min, max);
      sprite.setMove(Math.sign(d) * 38);
      placeCat();
      return true;
    }
    sprite.setMove(0);
    sprite.setToyPose(null);
    sprite.play('toyWiggle');
    hunt.phase = 'wiggle';
    hunt.at = now;
    return true;
  }
  if (hunt.phase === 'wiggle') {
    if (now - hunt.at < 950) return true;
    // 덮친다!
    sprite.play('pounce');
    catVy = -430;
    catVx = Math.sign(hunt.x - catX) * 140;
    catLift = 1;
    hunt.phase = 'pounce';
    hunt.at = now;
    return true;
  }
  if (hunt.phase === 'pounce') {
    if (catLift > 0 || now - hunt.at < 500) return true;
    const caught = !moved;
    endHunt(true);
    if (caught) {
      sprite.play('happy');
      pet.eventSay('huntCatch');
    }
    return true;
  }
  return false;
}

function endHunt(done) {
  if (!hunt) return;
  hunt = null;
  sprite.setToyPose(null);
  sprite.setMove(0);
  // 한 번 사냥하면 한참 쉰다
  nextHunt = performance.now() + ((done ? 8 : 4) * 60_000 + Math.random() * 6 * 60_000) * tp().huntGap;
}

// ---------- 그리기 루프 ----------

let lastLoop = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min(0.2, (now - lastLoop) / 1000);
  lastLoop = now;
  if (!document.hidden) {
    if (toy && toy.el && !toy.noPhysics) stepItem(toy, dt);
    if (toy && toy.extras) for (const x of toy.extras) if (x.el && !x.noPhysics) stepItem(x, dt);
    for (const o of treats) stepItem(o, dt);
    for (const o of loot) {
      stepItem(o, dt);
      if (now - o.born > LOOT_KEEP_MS && !(held && held.o === o)) collectLoot(o);
    }
    stepBirds(dt);
    stepRare(now);
    stepFriend(dt, now);
    stepField(dt, now);
    stepFall(dt);
    stepSwing(dt);
    // 끌려가는 중이거나 들렸다 떨어지는 중이면 걷지 않는다
    // 깜짝 이벤트(물어 오기·손님)가 고양이를 쥐고 있으면 걷기·주우러 가기는 쉰다
    const evBusy = stepEvent(dt, now) || (!dragging && !lifted && stepHunt(dt, now));
    if (dragging || lifted) sprite.setMove(0);
    else if (!evBusy && !stepChase(dt, now)) stepStroll(dt, now);
    updateFloorShadow();
    sprite.frame();
    drawField(now);
    placeOverlays();
    placeFriendOverlays();
  }
  const moving = toy || treats.length || loot.length || birds.length || ev || friend || hunt || sprite.move || sprite.busy() || dragging || catLift > 0;
  const slow = !moving && sprite.mood === 'sleeping';
  setTimeout(loop, slow ? 160 : moving ? 33 : 55);
}

// ---------- 마우스 ----------
// 창 전체가 클릭을 통과시키다가, 캐릭터·말풍선 위에 올라왔을 때만 마우스를 받는다.

let over = false;
let press = null;
let dragging = false;

function isOverPet(e) {
  const r = canvas.getBoundingClientRect();
  return sprite.hit(((e.clientX - r.left) / r.width) * PetSprite.GRID, ((e.clientY - r.top) / r.height) * PetSprite.GRID);
}

// 마우스 밑에 있는 바닥 물건. 위에 있는 것부터 찾는다
function itemAt(e) {
  const list = items();
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i].el.getBoundingClientRect();
    if (e.clientX >= r.left - 3 && e.clientX <= r.right + 3 && e.clientY >= r.top - 3 && e.clientY <= r.bottom + 3) return list[i];
  }
  return null;
}

function isOverBubble(e) {
  if (bubbleEl.hidden) return false;
  const r = bubbleEl.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom + 8;
}

function setOver(v) {
  if (v === over) return;
  over = v;
  pet.hover(v);
}

// 눈이 커서를 따라본다 (고양이 머리에서 이만큼 안이면)
const GAZE_RANGE = 340;
function updateGaze() {
  if (mouseX == null || catX == null || canvas.style.visibility === 'hidden') return (sprite.gaze = null);
  const P = petPx();
  const hx = catX;
  const hy = window.innerHeight - catLift - P * 0.5;
  const dx = mouseX - hx;
  const dy = mouseY - hy;
  if (Math.hypot(dx, dy) > GAZE_RANGE) return (sprite.gaze = null);
  const step = (v) => (Math.abs(v) < P * 0.18 ? 0 : Math.sign(v));
  sprite.gaze = { x: step(dx), y: step(dy) };
}

// 고양이 위를 누르지 않고 좌우로 문지르면 쓰다듬기. 몇 번 스치는 걸로는 안 되고
// 2.5초쯤 계속 문질러야 골골한다 (방향을 바꾸는 사이가 0.9초 넘게 비면 처음부터 다시 센다)
const RUB_MS = 2500;
const RUB_GAP = 900;
const rub = { x: null, dir: 0, since: 0, last: 0, flips: 0, until: 0 };
function trackRub(e) {
  const now = performance.now();
  // 문지르는 손은 삐뚤빼뚤하다. 도트 한 칸 한 칸이 아니라 고양이 몸 언저리(캔버스 가운데 아래쪽)면 쓰다듬는 걸로 친다
  if (press || held || dragging || toy || now < rub.until || !nearBody(e)) {
    rub.x = null;
    rub.since = 0;
    return;
  }
  if (rub.x != null) {
    const dx = e.clientX - rub.x;
    if (Math.abs(dx) >= 2) {
      const dir = Math.sign(dx);
      if (rub.dir && dir !== rub.dir) {
        if (!rub.since || now - rub.last > RUB_GAP) {
          rub.since = now;
          rub.flips = 0;
        }
        rub.flips++;
        rub.last = now;
      }
      rub.dir = dir;
    }
  }
  rub.x = e.clientX;
  if (rub.since && now - rub.last > RUB_GAP) rub.since = 0;
  if (rub.since && now - rub.since >= RUB_MS && rub.flips >= 4) {
    rub.since = 0;
    rub.until = now + 3500;
    // 쓰다듬기 싫은 날은 반은 냥펀치
    const swat = temper === 'grumpy' && Math.random() < 0.5;
    if (!treats.some((o) => o.eating) && !hunt && !ev) sprite.play(swat ? 'swat' : 'purr');
    pet.rub(swat ? 'swat' : undefined);
  }
}
let lastMouseMove = performance.now();

// 고양이 몸 언저리인가: 캔버스 가로 가운데 70%, 세로 아래쪽 60%
function nearBody(e) {
  if (canvas.style.visibility === 'hidden') return false;
  const r = canvas.getBoundingClientRect();
  return Math.abs(e.clientX - (r.left + r.width / 2)) < r.width * 0.35 && e.clientY > r.top + r.height * 0.4 && e.clientY < r.bottom;
}

window.addEventListener('mousemove', (e) => {
  if (e.clientX !== mouseX || e.clientY !== mouseY) lastMouseMove = performance.now();
  // 흔드는 장난감(낚싯대·깃털·비눗방울·레이저)은 쥐지 않아도 마우스를 따라다닌다
  mouseX = e.clientX;
  mouseY = e.clientY;
  updateGaze();
  trackRub(e);
  // 친구 카드를 끄는 중이면 카드가 따라온다
  if (moveCard(e)) return;
  // 들고 있는 동네 친구는 마우스를 따라온다
  if (moveFriend(e)) return;
  // 손에 쥔 물건은 마우스를 그대로 따라온다. 던질 속도를 재려고 최근 위치를 몇 개 남긴다
  if (held) {
    const o = held.o;
    const hw = o.hw || o.half;
    // 창 밖으로는 못 끌고 나간다
    o.x = Math.max(hw, Math.min(window.innerWidth - hw, e.clientX + held.dx));
    o.y = Math.max(o.half, Math.min(floorY() - o.half, e.clientY + held.dy));
    placeItem(o);
    held.hist.push({ t: performance.now(), x: e.clientX, y: e.clientY });
    if (held.hist.length > 6) held.hist.shift();
    return;
  }
  if (press && !press.noDrag && !dragging && Math.hypot(e.screenX - press.x, e.screenY - press.y) > 4) {
    dragging = true;
    lifted = true;
    liftAt = performance.now();
    swing.said = false;
    strollTo = null;
    if (sprite.action) sprite.cancel();
    grabSwing(press);
    document.body.classList.add('dragging');
    pet.drag('start');
  }
  // 잡은 자리 그대로 고양이가 마우스를 따라온다 (위로 들어 올릴 수도 있다)
  if (dragging) {
    catX = e.clientX - press.dx;
    catLift = Math.max(0, window.innerHeight - e.clientY - press.dy);
    catVy = 0;
    placeCat();
    return;
  }
  // 마우스로 흔드는 장난감을 든 동안은 창이 클릭을 받는다 (클릭·꾹 누르기로 장난감을 쓴다)
  if (!dragging) setOver(isOverPet(e) || isOverBubble(e) || isOverFriendUi(e) || !!itemAt(e) || isCursorToy() || !!(toy && toy.C && toy.C.wantsMouse && toy.C.wantsMouse(toy, e)));
});

window.addEventListener('mouseleave', () => {
  sprite.gaze = null;
  if (!dragging) setOver(false);
});

// 바닥 물건 집기 — 고양이 끌기보다 먼저 본다
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const o = itemAt(e);
  if (!o) {
    // 흔드는 장난감: 누른 시각을 재 둔다. 비눗방울은 꾹 누르는 동안 큰 방울이 부푼다
    // 두더지 잡기처럼 고양이를 직접 두드리는 놀이(overCat)는 고양이 위를 눌러도 장난감 쪽으로 보낸다
    if (toy && (isCursorToy() || (toy.C && toy.C.wantsMouse && toy.C.wantsMouse(toy, e))) && (!isOverPet(e) || (toy.C && toy.C.overCat))) {
      cursorDown = { t: performance.now(), x: e.clientX, y: e.clientY };
      if (toy.mode === 'bubbles') startGiant(toy);
      if (toy.C && toy.C.down) toy.C.down(toy, e);
    }
    return;
  }
  o.vx = 0;
  o.vy = 0;
  // 고양이가 톡톡 치던 장난감을 사람이 집어 가면 놀이는 처음부터
  if (o === toy && !o.placed) Object.assign(o, { state: 'free', batting: false, pinned: false });
  held = { o, dx: o.x - e.clientX, dy: o.y - e.clientY, t0: performance.now(), x0: e.clientX, y0: e.clientY, hist: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
  if (toy && toy.C && toy.C.grab) toy.C.grab(toy, o);
  o.el.classList.add('held');
  e.preventDefault();
});

canvas.addEventListener('mousedown', (e) => {
  if (held || e.button !== 0 || !isOverPet(e)) return;
  if (toy && toy.C && toy.C.overCat) return;
  // dx·dy: 고양이 한가운데·발밑에서 잡은 곳까지의 거리. 놀이 중에는 쓰다듬기만 되고 들어 올리지는 못한다
  press = { x: e.screenX, y: e.screenY, dx: e.clientX - catX, dy: window.innerHeight - e.clientY - catLift, noDrag: !!toy || catLift > 0 };
});

window.addEventListener('mouseup', (e) => {
  if (dropCard()) return;
  if (dropFriend()) return;
  // 놓는 순간의 손목 속도를 그대로 물건에 넘긴다
  if (cursorDown && toy) {
    const quick = performance.now() - cursorDown.t < 260;
    cursorDown = null;
    if (toy.mode === 'bubbles') releaseGiant(toy, quick);
    if (toy.C && toy.C.up) toy.C.up(toy, quick, e);
    if (quick) toyClick(toy);
    return;
  }
  cursorDown = null;
  if (held) {
    const o = held.o;
    // 거의 안 움직이고 금방 뗐으면 던진 게 아니라 톡 누른 것
    // 보물은 톡 누르면 줍는다
    if (o.loot && Math.hypot(e.clientX - held.x0, e.clientY - held.y0) < 6 && performance.now() - held.t0 < 400) {
      o.el.classList.remove('held');
      held = null;
      collectLoot(o);
      return;
    }
    const mine = o === toy || (toy && toy.extras && toy.extras.includes(o));
    if (mine && Math.hypot(e.clientX - held.x0, e.clientY - held.y0) < 5 && performance.now() - held.t0 < 300) {
      o.el.classList.remove('held');
      held = null;
      toyClick(o);
      return;
    }
    const h = held.hist;
    const a = h[0];
    const b = h[h.length - 1];
    const secs = Math.max(0.016, (b.t - a.t) / 1000);
    const cap = (v) => Math.max(-1600, Math.min(1600, v * 0.7));
    o.vx = o.placed ? cap((b.x - a.x) / secs) * 0.4 : cap((b.x - a.x) / secs);
    o.vy = o.placed ? 0 : cap((b.y - a.y) / secs);
    // 태엽 쥐는 던질 때마다 태엽이 다시 감긴다
    if (o === toy && o.key === 'windup') Object.assign(o, { wind: 5, dir: Math.sign(o.vx) || sprite.facing });
    o.el.classList.remove('held');
    held = null;
    if (toy && toy.C && toy.C.release) toy.C.release(toy, o);
    return;
  }
  if (e.button !== 0 || !press) return;
  if (dragging) {
    dragging = false;
    fallFrom = catLift;
    document.body.classList.remove('dragging');
    pet.drag('end', { x: catX });
    // 바닥에서 끌기만 했으면 바로 내려놓은 것
    if (catLift <= 0) {
      lifted = false;
      sprite.setHeld(null);
    }
  } else if (isOverPet(e)) {
    // 두 번째 클릭이 금방 오면 더블클릭(하우스 열기)이라 쓰다듬기는 취소한다
    if (pokeTimer) {
      clearTimeout(pokeTimer);
      pokeTimer = null;
    } else pokeTimer = setTimeout(() => {
      pokeTimer = null;
      pet.poke();
    }, 260);
  }
  press = null;
});
let pokeTimer = null;

canvas.addEventListener('dblclick', (e) => {
  if (isOverPet(e)) pet.open();
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (toy) return pet.stopPlay();
  if (isOverPet(e) || isOverBubble(e)) pet.context();
});

applyScale();
resizeField();
loop();
pet.ready();
