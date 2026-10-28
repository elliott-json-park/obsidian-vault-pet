// 킷커밋 데스크톱판 main.js 의 옵시디언판.
// 창·트레이·IPC 로 하던 일을 옵시디언의 오버레이(펫 무대)·상태 표시줄·메뉴·iframe 다리로 옮겼다.
// 성장·상점·퀘스트·업적·게이지는 core/* (데스크톱판과 같은 코드)가 그대로 한다.
// 2.0.0: 동네 친구 · 보물 공방 · 그날의 기분 · 먹고 싶은 것 · 오늘의 소식을 없앴다. 홈의 할 일 · 노트 지도 · 쉬는 시간을 더했다
const { Menu, Notice, setIcon } = require('obsidian');
const { computeGrowth, xpOf, levelOf, FURS, EAR_SHAPES, STAGES, foldStage, CHARS_PER_XP, XP_PER_LINK, XP_PER_NOTE, XP_PER_SESSION, XP_PER_TASK } = require('../core/growth');
const { Goals, cleanGoal, GOAL_COINS, GOAL_XP, FOCUS_LENGTHS, BREAK_LENGTHS } = require('../core/goals');
const { Brain } = require('../core/brain');
const { Gamify } = require('../core/gamify');
const { SET_MOTIONS, COSTUME_SLOTS, outfitList, fillOf, Shop, ACCESSORIES, FOODS, TOYS, MOTIONS, MOTION_SLOTS, slotOf, find: findItem } = require('../core/shop');
const stats = require('../core/stats');
const { Gauge } = require('../core/gauge');
const { Todos } = require('../core/todos');
const { migrateV2 } = require('../core/migrate2');
const { triedSkills } = require('../core/skills');
const { recap, cleanCardPrefs } = require('../core/recap');
const { TASK_COINS } = require('../core/shop');
const { dayOf } = require('../core/usage');
const { Strings, LANGS, PERSONAS } = require('../kit/i18n');
const PixelArt = require('../kit/pixelart');
const { DEFAULT_SETTINGS } = require('./store');
const { KitFrame } = require('./frame');

const MIN = 60_000;
const WORK_TIERS = [
  { slot: 'workHour', ms: 60 * MIN },
  { slot: 'workLong', ms: 30 * MIN }, // 2026-09-29: 15분은 모션이 너무 금방 바뀌어서 30분으로 (데스크톱판과 같이)
];
const STATE_DEFAULTS = { lastLevel: null, lastStage: null, stageScheme: 0, greeted: false, onboarded: false, quietUntil: 0, brainDaily: {}, life: { hungrySince: 0, fedAt: 0 }, walletSpent: 0, startedAt: 0, pantry: {}, purchases: [] };
// 프리미엄 밥·간식 (데스크톱판 4차, 2026-09-26). 몇 가지는 먹으면 특별한 일이 생긴다 (premiumEaten)
const HOUR_MS = 60 * MIN;
const OMAKASE_LOCK = 4 * HOUR_MS; // 참치 뱃살 오마카세: 4시간 배부름 고정
// 배부름을 고정하는 음식: 비쌀수록 길다 (2026-09-27 가격 정리. 데스크톱판 0.4.0: 기운이 없어져 배부름만 고정).
// 용 사탕은 기운 가득 대신 6시간 '든든' 고정
const BOTH_LOCK = { afternoonTea: 2 * HOUR_MS, dragonCandy: 6 * HOUR_MS, royalTable: 8 * HOUR_MS, dragonKingFeast: 24 * HOUR_MS };
// 구름 마시멜로: 먹고 잠깐 뒤 둥실 신나서 우다다 (2.0.0: 깜짝 이벤트를 없애서)
const MALLOW_ZOOM_MS = 6_000;
const GOLD_MOUSE_COINS = [40, 120]; // 황금 쥐 초콜릿: 코인 (2.0.0: 예전엔 보물)
const MYSTERY_PREMIUM = 0.15; // 미스터리 간식 상자: 프리미엄 간식이 나올 확률
const FORTUNE_GIFT = 0.2; // 포춘 쿠키: 코인을 같이 받을 확률
const FORTUNE_COINS = 50;
// 기본 '냠냠' 대신 자기 말을 하는 간식
const PREMIUM_TALK = new Set(['fortuneCookie', 'mysteryBox']);
const MOTION_HOLD = 5 * MIN;
// focus = 집중 시간 시작 · 끝 (집중하는 동안은 방해 금지라, 그래도 꼭 보여야 하는 말) · goal = 하루 목표를 채웠다
const ALWAYS = new Set(['notify', 'focus']);
const REWARD = new Set(['grow', 'achieve', 'item', 'quest', 'attend', 'retro', 'goal']);
// 말풍선 상한 (데스크톱판 0.4.0). 수다 등급은 시간당 1번, 그리고 꼭 필요하지 않은 말풍선(COUNTED)이 지난 한 시간에
// 3번 이상이었으면 수다는 건너뛴다. 수다를 2초 안에 눌러 닫는 일이 세 번 이어지면 수다를 3시간 쉰다
const CHATTY_KINDS = new Set(['chatter', 'tip', 'memory', 'reply']);
const COUNTED = new Set([...CHATTY_KINDS, 'hungry', 'lunch', 'dinner', 'rest', 'late', 'drowsy', 'greet', 'end', 'event', 'groom', 'toyAsk']);
const CHATTY_PER_HOUR = 1;
const COUNTED_PER_HOUR = 3;
const QUICK_DISMISS_MS = 2000;
const CHATTER_MUTE_MS = 3 * HOUR_MS;
// 업적 · 보상은 한 말풍선으로 묶는다. 마지막 업적 뒤 2초, 처음 것 뒤 늦어도 10초에 한 번에
const NEWS_WAIT = 2000;
const NEWS_MAX_WAIT = 10_000;
// 하루 한 번 고양이가 묻는다 [id, 시간대(분)]. 앞에 있는 것부터 그 시간대면 고른다. 15초 지나면 사라지고 손해는 없다
const ASKS = [
  ['lunch', 12 * 60 + 30, 15 * 60],
  ['sleep', 21 * 60, 24 * 60],
  ['busy', 9 * 60, 18 * 60],
  ['mood', 0, 24 * 60],
];
const ASK_MS = 15_000;
const BUSY_MUTE_MS = 2 * HOUR_MS;
// 쉬는 틈에 한 판 ([옵시디언] 데스크톱판은 'Claude 가 2분 넘게 일하는 동안'). 10분 넘게 이어서 쓰다가 1~5분 손을 놓으면
// 가진 장난감 하나를 물고 와서 놀자고 한다. 누르면 그 장난감으로 논다 (20초 지나면 사라진다). 하루 3번, 한 번 뒤 60분은 쉰다
const TOY_OFFER_WRITE = 10 * MIN;
const TOY_OFFER_IDLE_S = [60, 300];
const TOY_OFFER_GAP = 60 * MIN;
const TOY_OFFER_PER_DAY = 3;
const TOY_OFFER_MS = 20_000;
const THEMES = ['auto', 'cream', 'cocoa', 'mint', 'sakura', 'choco'];
// 펫 판이 부탁하는 말 (들어 올리기 · 떨어뜨리기 · 커서 사냥). 깜짝 이벤트 · 친구 말은 2.0.0 에 없앴다
const EVENT_LINES = new Set(['heldLong', 'heldEscape', 'dropHigh', 'huntCatch', 'huntMiss']);
// 모션을 끈 상황 (설정 motionsOff). 고양이가 그 상태로 있어야 하는 상황(같이 쓸 때 · 기다릴 때 · 잘 때)은 끄면 기본 자세로,
// 잠깐 하는 상황(다 썼을 때 · 레벨 업 · 쓰다듬기 …)은 끄면 아무 모션도 안 한다
const MOOD_SLOTS = new Set(['work', 'workLong', 'workHour', 'waiting', 'sleep']);
// 홈 칸 (kit/house.js 의 HOME_SECTIONS 와 같다. 설정 homeLayout 을 거를 때 쓴다)
const HOME_SECTIONS = ['goal', 'today', 'map', 'todo', 'cat', 'quests', 'recent'];
const RECORD_KEYS = new Set(['whackcat', 'rps', 'rpsStreak', 'trampoline', 'jumprope', 'quilt', 'shellgame', 'volley', 'simon']); // 줄넘기 · 4차 장난감 넷
// 처음 설치한 날 이만큼은 밥 · 배고픔 알림을 쉰다 (만나자마자 '밥 줘' 부터 하지 않게)
const FIRST_GRACE = 2 * HOUR_MS;
const scaleStep = (v) => Math.max(1, Math.min(5, Math.round(Number(v) || 3)));
const gaugeBar = (v) => '■'.repeat(Math.round(v / 10)) + '□'.repeat(10 - Math.round(v / 10)) + ' ' + v;

class KitHost {
  // plugin 은 KitCommitPlugin. settings/state 는 Store, usage 는 core/usage 의 UsageTracker
  constructor(plugin, { settings, state, usage }) {
    this.plugin = plugin;
    this.settings = settings;
    this.state = state;
    this.usage = usage;
    this.T = new Strings();
    this.growth = null;
    this.loading = true;
    this.playing = null;
    this.dragging = false;
    this.houses = new Set(); // 열린 하우스 iframe 들
    this.pet = null; // 펫 무대 iframe
    this.stage = null; // 펫 무대 (오버레이) — plugin/stage.js
    this.motionTurn = {};
    this.lastWorkSlot = 'work';
    this.pokes = [];
    this.sleepPokes = [];
    this.hideTimer = null;
    this.timers = [];
    // 바닥에 떨어뜨렸는데 아직 안 먹은 먹이. 'pet:treat-eaten' 은 여기 있는 것만 믿는다
    this.floorTreats = [];
    // 말풍선 상한 · 업적 말풍선 묶기 · 장난감 권하기 · 하우스 알림
    this.bubbleLog = [];
    this.chatterMuteUntil = 0;
    this.quickDismiss = 0;
    this.newsBuf = [];
    this.newsTimer = null;
    this.newsFirst = 0;
    this.growthTimer = null;
    this.toyOffer = null;
    this.toastQueue = [];
  }

  // ---------- 시작 ----------

  init() {
    const { settings, state, usage } = this;
    usage.setExcluded(settings.get('excludedProjects'));
    this.syncStrings();
    this.gamify = new Gamify(state, usage, () => settings.data, () => this.T);
    this.shop = new Shop(state, usage, () => settings.data, () => this.growth);
    // 평생 산 횟수(bought)·한 번이라도 가졌던 코스튬 수(accEver)는 gamify 가 purchaseStats·옷장에서 직접 읽는다
    this.gamify.extra = () => {
      const w = this.shop.wallet();
      const items = new Set(state.get('items') || []);
      const kinds = { acc: 0, motion: 0, toy: 0 };
      for (const k of items) {
        const it = findItem(k);
        if (it && it.kind in kinds && k !== 'none' && !it.exclusive && !it.stars) kinds[it.kind]++;
      }
      return {
        owned: kinds, totalAcc: ACCESSORIES.filter((a) => a.key !== 'none' && !a.exclusive && !a.stars).length, totalToy: TOYS.length,
        spent: w.spent, earned: w.earned, balance: w.balance,
        maxBacklinks: this.plugin.linkStats().max,
        orphans: this.plugin.orphanList ? this.plugin.orphanList().length : 0,
      };
    };
    this.gamify.rewarder = (reward) => this.shop.give(reward);
    if (!state.get('startedAt')) state.set({ startedAt: Date.now() });
    if (state.get('stageScheme') !== STAGES.length) {
      const last = state.get('lastStage');
      if (last != null) state.set({ lastStage: foldStage(last) });
      state.set({ stageScheme: STAGES.length });
    }
    this.migrateShop();
    // 2.0.0: 보물 → 코인, 공방 코스튬은 옷장에, 없앤 기능의 기록은 지운다 (한 번만. core/migrate2.js)
    this.v2 = migrateV2(state);
    this.goals = new Goals(state, settings, usage);
    this.gauge = new Gauge(state);
    // 홈의 할 일 (플러그인 안에만 있는 목록). 처음 끝낸 할 일마다 업적 · 퀘스트 숫자
    this.todos = new Todos(state, () => this.noteSkill('todoDone'));

    const brain = new Brain(() => settings.data, () => ({ today: usage.today() }), () => this.T);
    this.brain = brain;
    brain.daily = state.get('brainDaily') || {};
    brain.life = state.get('life') || { hungrySince: 0, fedAt: 0 };
    brain.systemIdle = () => this.plugin.idleSeconds();
    brain.graceUntil = (state.get('startedAt') || 0) + FIRST_GRACE;
    // 옵시디언판은 타이핑을 hook 처럼 늘 알려 준다 (plugin/main.js 의 onType). 그래서 '같이 쓰는 중'은 타이핑할 때만이다
    brain.lastHookAt = Date.now();
    // 기억해서 하는 말에 끼울 실제 있었던 일
    brain.memoryVars = () => this.memoryVars();
    brain.on('bubble', ({ text, kind, extra }) => this.bubble(text, kind, undefined, undefined, extra && extra.ms, extra));
    brain.on('life', (life) => {
      state.set({ life });
      this.pushState();
      this.pushHouse();
    });
    brain.on('action', (a) => {
      const m = this.resolveAction(a);
      if (m) this.send('pet:action', m);
    });
    let prevMood = null;
    brain.on('mood', () => {
      const sleepy = ['sleepy', 'sleeping'].includes(brain.mood);
      if (sleepy && !['sleepy', 'sleeping'].includes(prevMood)) this.send('pet:config', this.petConfig());
      prevMood = brain.mood;
      this.pushState();
      this.sendHouse('house:mood', brain.mood);
      this.plugin.updateStatus();
    });
    this.wireGame();
    this.checkVersion();
  }

  // 업데이트 뒤 처음 켰을 때 '새로 생긴 것' (1.3.0~). 처음 설치한 사람은 첫 실행 안내가 있으니 띄우지 않는다.
  // 하우스가 열리면 창으로 보여 주고, 고양이는 한 번만 말풍선으로 알린다 (누르면 하우스)
  checkVersion() {
    const ver = this.plugin.manifest ? this.plugin.manifest.version : '';
    if (!ver || this.state.get('lastVersion') === ver) return;
    this.state.set({ lastVersion: ver, whatsNew: this.state.get('onboarded') ? ver : null });
    if (this.state.get('whatsNew')) this.later(() => this.state.get('whatsNew') && this.bubble(this.T.t('pet.whatsNew', { v: ver }), 'item', 'whatsnew'), 9000);
  }

  // 볼트를 다 확인한 뒤 (plugin.scan 이 끝나면)
  ready() {
    this.loading = false;
    this.send('pet:loading', null);
    this.brain.activity(this.usage.lastActivity);
    this.recomputeGrowth();
    this.brain.tick();
    this.minuteTick();
  }

  // 다른 기기의 data.json 을 합친 뒤 (1.5.1, plugin/sync.js). 따로 들고 있던 값을 다시 읽고 화면에 다시 보낸다.
  // 레벨은 큰 쪽으로 합쳐져서, 다른 기기에서 이미 축하한 레벨 업을 여기서 또 하지 않는다
  reloadShared() {
    const { settings, state, usage } = this;
    usage.setExcluded(settings.get('excludedProjects'));
    const g = state.get('gauge');
    if (this.gauge && g && typeof g.food === 'number') this.gauge.g = { food: g.food, at: g.at || Date.now(), foodLockUntil: g.foodLockUntil || 0 };
    if (this.brain) this.brain.life = state.get('life') || { hungrySince: 0, fedAt: 0 };
    this.syncStrings();
    this.plugin.relabel();
    this.recomputeGrowth();
    this.send('pet:config', this.petConfig());
    this.pushState();
    this.pushHouse();
    this.plugin.updateStatus();
  }

  // ---------- 글·성격 ----------

  syncStrings() {
    const { settings, state } = this;
    this.T.set(settings.get('language'), settings.get('personality'));
    // 최근에 한 말: 껐다 켜도 3일 동안은 같은 말을 또 안 하게 state 에 남긴다 (모아서 1초 뒤 한 번)
    if (state && !this.T.onRecent) {
      this.T.recent = state.get('lineMemory') || {};
      let t = null;
      this.T.onRecent = () => {
        clearTimeout(t);
        t = setTimeout(() => state.set({ lineMemory: this.T.recent }), 1000);
      };
    }
    this.T.context = () => {
      const last = this.state.get('lastFood');
      return {
        name: settings.get('petName'),
        m: this.usage ? this.usage.today().c.toLocaleString() : 0,
        streak: this.gamify ? this.gamify.streaks().current : 0,
        lv: this.growth ? this.growth.level : 1,
        coins: this.shop ? this.shop.wallet().balance.toLocaleString() : 0,
        ...(last ? { last: this.T.t('item.' + last) } : {}),
      };
    };
  }

  stageName(g, next) {
    const key = next ? g.nextStageKey : g.stageKey;
    return key ? this.T.t('stage.' + key) : '';
  }

  oneStage() {
    return STAGES.length < 2;
  }

  // ---------- 펫 무대 ----------

  effScale() {
    return 1 + (scaleStep(this.settings.get('scale')) - 1) * 0.5;
  }

  catStartX() {
    const p = this.settings.get('position');
    return p && p.v === 3 && isFinite(p.x) ? p.x : null;
  }

  petVisible() {
    return !!(this.stage && this.stage.visible());
  }

  resetPosition() {
    this.settings.set({ position: null });
    this.send('pet:config', this.petConfig());
    this.send('pet:reset');
  }

  hideFor(ms) {
    if (!this.stage) return;
    this.stopPlay(); // 안 보이는 채로 놀면서 배부름·기운이 깎이지 않게
    this.stage.setHidden(true);
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.showPet(), ms);
    this.plugin.updateStatus();
  }

  showPet() {
    clearTimeout(this.hideTimer);
    if (!this.settings.get('showPet')) {
      this.settings.set({ showPet: true });
      this.plugin.mountStage();
    }
    if (this.stage) this.stage.setHidden(false);
    this.plugin.updateStatus();
  }

  // 펫 끄기 (데스크톱판의 '종료' 자리). 하우스·리본·명령으로 다시 켠다
  turnOff() {
    clearTimeout(this.hideTimer);
    this.stopPlay();
    this.settings.set({ showPet: false });
    this.plugin.unmountStage();
    this.plugin.updateStatus();
  }

  // 펫 무대 iframe 이 새로 생겼을 때 (plugin.mountStage)
  attachPet(frame) {
    this.pet = frame;
  }

  detachPet() {
    this.pet = null;
    this.playing = null;
  }

  // ---------- 하우스 ----------

  // 하우스 화면이 기억하는 작은 값들 (데스크톱판은 창의 저장소에 두던 것)
  uiGet(key) {
    const v = (this.state.get('ui') || {})[key];
    return v === undefined ? null : v;
  }

  uiSet(key, value) {
    this.state.set({ ui: { ...(this.state.get('ui') || {}), [key]: String(value) } });
  }


  openHouse(tab) {
    this.plugin.openHouse(tab);
  }

  attachHouse(frame) {
    this.houses.add(frame);
    this.gamify.count('house');
    // 하우스가 닫혀 있는 동안 모아 둔 알림을 보여 준다
    const list = this.toastQueue;
    this.toastQueue = [];
    list.forEach((x, i) => this.later(() => frame.emit('house:toast', x), 600 + i * 2600));
  }

  // 하우스 아래쪽 알림 (보상·해금 알림은 말풍선 대신 이걸로). 하우스가 닫혀 있으면 셋까지 모아 뒀다가 열 때 보여 준다
  houseToast(text, icon) {
    if (!text) return;
    if (this.houses.size) this.sendHouse('house:toast', { text, icon });
    else this.toastQueue = [...this.toastQueue, { text, icon }].slice(-3);
  }

  detachHouse(frame) {
    this.houses.delete(frame);
  }

  send(channel, payload) {
    if (this.pet) this.pet.emit(channel, payload);
  }

  // 하우스가 열려 있을 때만 새 데이터를 만들어 보낸다 (payload 가 크다)
  pushHouse() {
    if (this.houses.size) this.sendHouse('house:data', this.housePayload());
  }

  sendHouse(channel, payload) {
    for (const h of this.houses) h.emit(channel, payload);
  }

  // ---------- 메뉴 (트레이·펫 우클릭) ----------

  isQuiet() {
    return (this.state.get('quietUntil') || 0) > Date.now();
  }

  menuHeader() {
    const T = this.T;
    const name = this.settings.get('petName');
    if (!this.growth) return [{ title: T.t('tray.loading', { name }), disabled: true }];
    const t = this.usage.today();
    const g = this.gauge.get();
    return [
      { title: this.oneStage() ? T.t('tray.statusOne', { name, lv: this.growth.level }) : T.t('tray.status', { name, lv: this.growth.level, stage: this.stageName(this.growth) }), disabled: true },
      { title: T.t('tray.gauges', { food: gaugeBar(g.food) }), disabled: true },
      { title: this.goalLine(), disabled: true },
      { title: T.t('tray.today', { m: t.c.toLocaleString(), s: t.s, streak: this.gamify.streaks().current }), disabled: true },
    ];
  }

  commonMenu() {
    const T = this.T;
    const visible = this.petVisible();
    const f = this.goals.focusInfo();
    return [
      f.on
        ? { title: T.t('focus.menuStop', { left: this.focusLeftText(f.left) }), icon: 'hourglass', click: () => this.focusStop() }
        : { title: T.t('focus.menuStart'), icon: 'hourglass', submenu: FOCUS_LENGTHS.map((m) => ({ title: T.t('focus.menuLen', { m }), click: () => this.focusStart(m) })) },
      { title: T.t('tray.house'), icon: 'home', click: () => this.openHouse() },
      { title: T.t('tray.quests'), icon: 'scroll', click: () => this.openHouse('quests') },
      { sep: true },
      this.isQuiet() ? { title: T.t('tray.quietOff'), icon: 'bell', click: () => this.setQuiet(0) } : { title: T.t('tray.quietOn'), icon: 'bellOff', click: () => this.setQuiet(60) },
      visible ? { title: T.t('tray.hide'), icon: 'moon', click: () => this.hideFor(60 * MIN) } : { title: T.t('tray.show'), icon: 'eye', click: () => this.showPet() },
      { title: T.t('tray.resetPos'), icon: 'pin', click: () => this.resetPosition() },
      { sep: true },
      this.settings.get('showPet') ? { title: T.t('tray.quit'), icon: 'zzz', click: () => this.turnOff() } : { title: T.t('tray.turnOn'), icon: 'paw', click: () => this.showPet() },
    ];
  }

  // 항목 목록을 옵시디언 메뉴로. icon 은 도트 아이콘 이름 (plugin.pixelIcon 이 옵시디언 아이콘으로 등록한다)
  buildMenu(items) {
    const menu = new Menu();
    const add = (m, list) => {
      for (const it of list) {
        if (!it) continue;
        if (it.sep) {
          m.addSeparator();
          continue;
        }
        let flat = false;
        m.addItem((mi) => {
          mi.setTitle(it.title);
          const ic = it.icon && this.plugin.pixelIcon(it.icon);
          if (ic) mi.setIcon(ic);
          if (it.disabled) mi.setDisabled(true);
          if (it.submenu && typeof mi.setSubmenu === 'function') add(mi.setSubmenu(), it.submenu);
          else if (it.submenu) {
            mi.setDisabled(true);
            flat = true;
          } else if (it.click) mi.onClick(() => it.click());
        });
        // 하위 메뉴를 못 쓰는 옛 옵시디언이면 하위 항목을 들여 쓴 채로 바로 아래에 펼친다
        if (flat) add(m, it.submenu.map((x) => ({ ...x, title: '   ' + x.title })));
      }
    };
    add(menu, items);
    return menu;
  }

  trayMenu(evt) {
    const menu = this.buildMenu([...this.menuHeader(), { sep: true }, ...this.commonMenu()]);
    if (evt) menu.showAtMouseEvent(evt);
    return menu;
  }

  // 펫을 우클릭했을 때 (데스크톱판의 pet:context)
  petContextMenu(pos) {
    const T = this.T;
    const pantry = this.state.get('pantry') || {};
    const foodItem = (x) => ({ title: `${T.t('item.' + x.key)} ×${pantry[x.key]}`, icon: x.key, click: () => this.giveFood(x.key) });
    const foodMenu = (group, label, empty, ic) => {
      const list = FOODS.filter((x) => x.group === group && pantry[x.key] > 0).map(foodItem);
      return list.length ? { title: T.t(label), icon: ic, submenu: list } : { title: T.t(empty), icon: ic, click: () => this.openHouse('shop') };
    };
    const myToys = TOYS.filter((x) => this.shop.owned(x.key)).map((x) => ({ title: `${T.t('item.' + x.key)}   —   ${T.t('toyHow.' + x.key)}`, icon: x.key, click: () => this.startPlay(x.key) }));
    const toyMenu = this.playing
      ? [{ title: T.t('tray.stopPlay'), icon: 'yarn', click: () => this.stopPlay() }]
      : myToys.length
        ? [{ title: T.t('tray.toys'), icon: 'yarn', submenu: myToys }]
        : [{ title: T.t('tray.noToys'), icon: 'yarn', click: () => this.openHouse('shop') }];
    // 크기 단계(1~5)와 소리 끄기. 하우스 설정과 같은 값을 바꾼다 (데스크톱판 0.3.0)
    const step = scaleStep(this.settings.get('scale'));
    const sizeMenu = {
      title: T.t('tray.size'),
      icon: 'sparkle',
      submenu: [1, 2, 3, 4, 5].map((n) => ({ title: (n === step ? '✓ ' : '') + T.t('set.sizeStep', { n }), click: () => this.setSettings({ scale: n }) })),
    };
    const muted = !this.settings.get('soundEnabled');
    const muteItem = { title: (muted ? '✓ ' : '') + T.t('tray.mute'), icon: 'bellOff', click: () => this.setSettings({ soundEnabled: muted }) };
    const menu = this.buildMenu([
      ...this.menuHeader(),
      { sep: true },
      foodMenu('meal', 'tray.feed', 'tray.noMeals', 'ricebowl'),
      foodMenu('snack', 'tray.treats', 'tray.noTreats', 'churu'),
      ...toyMenu,
      { sep: true },
      sizeMenu,
      muteItem,
      { sep: true },
      ...this.commonMenu(),
    ]);
    menu.showAtPosition(pos || { x: 100, y: 100 });
  }

  // ---------- 장난감 놀이 ----------

  startPlay(toy) {
    if (this.playing) return this.stopPlay();
    if (!this.shop.owned(toy)) return this.openHouse('shop');
    if (!this.pet) this.showPet();
    // 배고파도 논다 (데스크톱판 0.4.0: 배부름은 벌이 아니라 덤. 놀면 배가 조금씩 꺼진다)
    this.gauge.tick();
    this.playing = { toy };
    this.gamify.count('play');
    this.showPet();
    this.send('pet:play', { toy, on: true, records: this.state.get('toyRecords') || {}, tugLevel: this.settings.get('tugLevel') || 'mid' });
    this.sound('quest');
  }

  stopPlay() {
    if (!this.playing) return;
    this.playing = null;
    this.send('pet:play', { on: false });
  }

  giveFood(key) {
    const it = this.shop.useFood(key);
    if (!it) return false;
    this.showPet();
    this.dropTreat(key);
    this.sound('pop');
    return true;
  }

  // 바닥에 떨어뜨린 먹이. 펫 판을 새로 만들면 바닥이 사라지니 창고로 돌려준다 (끌 때도)
  dropTreat(key) {
    this.floorTreats.push(key);
    this.send('pet:treat', { key });
  }

  refundTreats() {
    if (!this.floorTreats.length || !this.shop) return;
    const food = {};
    for (const k of this.floorTreats) food[k] = (food[k] || 0) + 1;
    this.floorTreats = [];
    this.shop.give({ food });
    this.pushHouse();
  }

  // 하우스의 '밥 주기' 버튼. 창고에 있는 밥 중 마지막에 준 밥 → 싼 것 순서로 하나 꺼낸다
  feed() {
    const wasHungry = this.brain.hungry();
    const pantry = this.state.get('pantry') || {};
    const has = (k) => k && pantry[k] > 0 && FOODS.some((x) => x.key === k && x.group === 'meal');
    const pickKey = [this.state.get('lastMeal')].find(has);
    const meal = pickKey ? FOODS.find((x) => x.key === pickKey) : FOODS.find((x) => x.group === 'meal' && pantry[x.key] > 0);
    if (!meal) return { ok: false, wasHungry };
    this.giveFood(meal.key);
    return { ok: true, wasHungry, key: meal.key };
  }

  // ---------- 기억하는 고양이 · 하루 한 번 질문 · 쉬는 틈에 한 판 ----------

  // 기억 대사(LINE.memory)에 끼울 실제 있었던 일. 값이 없는 건 빼고 준다 (그 값을 쓰는 대사는 안 고른다).
  // [옵시디언] {yMsgs} 자리는 어제 쓴 글자 수 (1,000자 넘게). 폴더 이름이나 노트 내용은 쓰지 않는다
  memoryVars(now = new Date()) {
    const { T, state, settings } = this;
    const v = {};
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yKey = dayOf(y);
    const tKey = dayOf(now);
    let lastHour = -1;
    let yChars = 0;
    for (const [key, b] of this.usage.eachBucket(y.getTime())) {
      if (!b.e && !b.c) continue;
      const h = Number(key.slice(11, 13));
      if (key.slice(0, 10) === yKey) {
        yChars += b.c || 0;
        lastHour = Math.max(lastHour, h);
      } else if (key.slice(0, 10) === tKey && h < 5) lastHour = Math.max(lastHour, 24 + h); // 자정 넘어 새벽까지
    }
    if (lastHour >= 24) v.yDawn = String(lastHour - 24);
    else if (lastHour >= 22) v.yHour = String(lastHour);
    if (yChars >= 1000) v.yMsgs = yChars.toLocaleString();
    // 요즘 자주 먹인 밥 (다섯 번 넘게)
    const fed = Object.entries((state.get('purchaseStats') || {}).keys || {}).filter(([k, x]) => FOODS.some((f) => f.key === k) && (x.n || 0) >= 5).sort((a, b) => b[1].n - a[1].n)[0];
    if (fed) v.fav = T.t('item.' + fed[0]);
    const worn = Object.values(this.cleanOutfit(settings.get('outfit')) || {});
    if (worn.length) v.outfit = T.t('item.' + worn[Math.floor(Math.random() * worn.length)]);
    // 어제 점심을 걸렀다고 대답했으면
    const lunch = (state.get('replies') || {}).lunch;
    if (lunch && lunch.day === yKey && lunch.ans === 'no') v.skipped = ''; // 빈 글자 (대사의 {skipped} 는 '이 대사를 골라도 된다'는 표시)
    return v;
  }

  // 하루 한 번 고양이가 묻는다. "오늘 많이 바빠?" 에 '응' 하면 수다를 2시간 쉰다. 대답은 기억 대사의 재료가 된다
  askTick(now = new Date()) {
    if (!this.brain || !['active', 'idle'].includes(this.brain.mood) || this.isQuiet() || !this.petVisible()) return;
    const r = this.state.get('replies') || {};
    if (r.asked === now.toDateString()) return;
    if (Math.random() > 1 / 30) return; // 그 시간대 안에서 아무 때나 (분마다 1/30)
    const m = now.getHours() * 60 + now.getMinutes();
    const ask = ASKS.find(([, from, to]) => m >= from && m < to);
    if (!ask) return;
    this.state.set({ replies: { ...r, asked: now.toDateString() } });
    const id = ask[0];
    this.brain.talk(this.T.line('ask_' + id), 'reply', Date.now(), { ask: id, ms: ASK_MS, choices: [this.T.t(`ask.${id}.a`), this.T.t(`ask.${id}.b`)] });
  }

  // 쉬는 틈에 한 판: 10분 넘게 이어서 쓰다가 1~5분 손을 놓으면 장난감을 물고 와서 놀자고 한다
  toyOfferTick(now = Date.now()) {
    const { brain, state } = this;
    if (!brain || this.playing || this.isQuiet() || !this.petVisible() || this.loading) return;
    if (brain.mood === 'thinking' || brain.mood === 'waiting' || brain.mood === 'sleeping') return;
    // streakMs = 쉬지 않고 이어서 쓴 시간 (20분 넘게 쉬면 0). idle = 옵시디언에서 아무것도 안 만진 초
    const idle = this.plugin.idleSeconds();
    if (brain.streakMs() < TOY_OFFER_WRITE || idle < TOY_OFFER_IDLE_S[0] || idle > TOY_OFFER_IDLE_S[1]) return;
    const today = new Date().toDateString();
    const log = state.get('toyOffers') || {};
    const n = log.day === today ? log.n || 0 : 0;
    if (n >= TOY_OFFER_PER_DAY || now - (log.at || 0) < TOY_OFFER_GAP) return;
    const mine = TOYS.filter((x) => this.shop.owned(x.key));
    if (!mine.length) return;
    const toy = mine[Math.floor(Math.random() * mine.length)].key;
    state.set({ toyOffers: { day: today, n: n + 1, at: now } });
    this.toyOffer = { toy, at: now };
    this.send('pet:action', 'happy');
    this.bubble(this.T.line('toyOffer', { toy: this.T.t('item.' + toy) }), 'toyAsk', 'play:' + toy, undefined, TOY_OFFER_MS);
  }

  // ---------- 모션 ----------

  // 이 상황의 모션을 껐나 (설정 motionsOff, 2.0.0)
  motionOff(slot) {
    const off = this.settings.get('motionsOff');
    return Array.isArray(off) && off.includes(slot);
  }

  motionList(slot) {
    const s = slotOf(slot);
    if (!s) return [];
    // 끈 상황: 고양이가 머무는 상황은 기본 자세 하나, 잠깐 하는 상황은 빈 목록 (motionFor 가 null)
    if (this.motionOff(slot)) return MOOD_SLOTS.has(slot) ? [s.free[0]] : [];
    const raw = slot === 'idle' ? this.settings.get('idleMotions') : (this.settings.get('motions') || {})[slot];
    const list = (Array.isArray(raw) ? raw : raw ? [raw] : slot === 'idle' ? s.free : [s.free[0]]).filter((k) => this.shop.canUseMotion(slot, k));
    return list.length || slot === 'idle' ? list : [s.free[0]];
  }

  motionFor(slot) {
    const s = slotOf(slot);
    if (!s) return slot;
    const list = this.motionList(slot);
    if (!list.length) return this.motionOff(slot) ? null : s.free[0];
    const now = Date.now();
    const st = this.motionTurn[slot] || (this.motionTurn[slot] = { i: 0, at: now });
    if (list.length > 1 && now - st.at >= MOTION_HOLD) {
      st.i++;
      st.at = now;
    }
    return list[st.i % list.length];
  }

  // 세트 옷 전용 모션 (설정 '세트 옷 모션 섞기'를 끄면 안 섞는다. '심심할 때'를 꺼도 안 섞는다)
  setMotions() {
    if (this.settings.get('setMotionsOn') === false || this.motionOff('idle')) return [];
    const set = this.cleanOutfit(this.settings.get('outfit')).set;
    return (set && SET_MOTIONS[set]) || [];
  }

  // 상황 모션 하나를 펫 판에 보낸다. 그 상황 모션을 껐으면 아무것도 안 한다
  act(slot, fallback = null) {
    const m = this.motionFor(slot) || fallback;
    if (m) this.send('pet:action', m);
    return m;
  }

  idlePool() {
    return [...this.motionList('idle'), ...this.setMotions()];
  }

  workSlot() {
    const streak = this.brain ? this.brain.streakMs() : 0;
    const tier = WORK_TIERS.find((w) => streak >= w.ms);
    return tier ? tier.slot : 'work';
  }

  checkWorkTier() {
    const now = this.workSlot();
    if (now === this.lastWorkSlot) return;
    this.lastWorkSlot = now;
    this.send('pet:config', this.petConfig());
  }

  moodMotions() {
    const sleep = this.motionList('sleep');
    return { thinking: this.motionList(this.workSlot()), sleeping: sleep, sleepy: sleep, waiting: this.motionList('waiting') };
  }

  resolveAction(a) {
    return typeof a === 'string' && a.startsWith('slot:') ? this.motionFor(a.slice(5)) : a;
  }

  // 프리미엄 밥·간식을 먹었다. 먹은 횟수·종류는 업적용으로 센다
  premiumEaten(it) {
    const { T, gamify } = this;
    gamify.count('premium');
    gamify.count('pf_' + it.key);
    const later = (fn) => this.later(fn, 2600);
    if (it.key === 'otoroOmakase') {
      this.gauge.lockFood(OMAKASE_LOCK);
      later(() => this.bubble(T.line('omakaseLock'), 'fed'));
    } else if (BOTH_LOCK[it.key]) {
      this.gauge.lockFood(BOTH_LOCK[it.key]);
      later(() => this.bubble(T.line('bothLock', { h: BOTH_LOCK[it.key] / HOUR_MS }), 'fed'));
    } else if (it.key === 'cloudMallow') {
      later(() => this.bubble(T.line('mallowEvent'), 'fed'));
      this.later(() => this.send('pet:action', 'zoomies'), MALLOW_ZOOM_MS);
    } else if (it.key === 'goldMouseChoco') {
      const [lo, hi] = GOLD_MOUSE_COINS;
      const n = lo + Math.floor(Math.random() * (hi - lo + 1));
      this.shop.give({ coins: n });
      later(() => this.bubble(T.line('goldMouseCoins', { n }), 'item'));
    } else if (it.key === 'roomService') {
      this.bubble(T.line('roomService'), 'fed');
    } else if (it.key === 'fortuneCookie') {
      this.bubble(T.line('fortune'), 'treat');
      if (Math.random() < FORTUNE_GIFT) {
        this.shop.give({ coins: FORTUNE_COINS });
        later(() => this.bubble(T.line('fortuneCoins', { n: FORTUNE_COINS }), 'item'));
      }
    } else if (it.key === 'mysteryBox') {
      const premium = Math.random() < MYSTERY_PREMIUM;
      const pool = FOODS.filter((x) => x.group === 'snack' && x.key !== 'mysteryBox' && x.fill !== 0 && !!x.premium === premium);
      const got = pool[Math.floor(Math.random() * pool.length)].key;
      this.shop.give({ food: { [got]: 1 } });
      if (premium) gamify.count('mysteryPremium');
      this.bubble(T.line(premium ? 'mysteryJackpot' : 'mysteryGot', { name: T.t('item.' + got) }), 'item');
    }
    this.pushHouse();
  }

  setQuiet(min) {
    this.state.set({ quietUntil: min ? Date.now() + min * MIN : 0 });
    if (min) this.gamify.count('quiet');
    this.send('pet:quiet', this.isQuiet());
    this.plugin.updateStatus();
    this.pushHouse();
  }

  // ---------- 코스튬 ----------

  cleanOutfit(outfit) {
    const out = {};
    for (const s of COSTUME_SLOTS) {
      const k = (outfit || {})[s];
      const it = k && ACCESSORIES.find((a) => a.key === k && a.slot === s);
      if (it && this.shop.owned(k)) out[s] = k;
    }
    const set = out.set && ACCESSORIES.find((a) => a.key === out.set);
    if (set) for (const s of set.covers || []) delete out[s];
    return out;
  }

  syncAccessory() {
    const list = outfitList(this.settings.get('outfit'));
    this.settings.set({ accessory: list.length ? list.join(',') : 'none' });
  }

  migrateShop() {
    const { refund } = this.shop.migrate();
    if (refund) this.state.set({ refundNote: (this.state.get('refundNote') || 0) + refund });
    // 모션 자리에 끼워 둔 예전 'bubbles'(비눗방울 놀이) → 'bubbleplay' (shop.migrate 참고)
    const fix = (v) => (Array.isArray(v) ? v.map(fix) : v === 'bubbles' ? 'bubbleplay' : v);
    const motions = this.settings.get('motions') || {};
    if (Object.values(motions).some((v) => JSON.stringify(v).includes('"bubbles"'))) {
      this.settings.set({ motions: Object.fromEntries(Object.entries(motions).map(([k, v]) => [k, fix(v)])) });
    }
    const idle = this.settings.get('idleMotions');
    if (Array.isArray(idle) && idle.includes('bubbles')) this.settings.set({ idleMotions: fix(idle) });
    // 데스크톱판 0.3.0~0.4.0: 키가 바뀐 모션 · 평생 구매 기록(purchaseStats) · 장부의 옛 비눗방울 (모두 한 번만)
    this.shop.migrateKeys(this.settings);
    this.shop.migrateStats();
    this.shop.migrateLedgerKeys();
    if (!this.settings.get('outfit')) this.settings.set({ outfit: {} });
    this.settings.set({ outfit: this.cleanOutfit(this.settings.get('outfit')) });
    this.syncAccessory();
  }

  // ---------- 상태 ----------

  petConfig() {
    const s = this.settings;
    return {
      scale: this.effScale(),
      startX: this.catStartX(),
      name: s.get('petName'),
      accessory: s.get('accessory'),
      fur: s.get('fur'),
      ears: s.get('ears'),
      bubbles: s.get('bubblesEnabled'),
      sound: s.get('soundEnabled'),
      lowPower: !!s.get('lowPower'),
      language: s.get('language'),
      personality: s.get('personality'),
      moodMotions: this.moodMotions(),
      idleMotions: this.idlePool(),
    };
  }

  pushState() {
    this.send('pet:state', { mood: this.brain.mood, growth: this.growth, quiet: this.isQuiet(), streak: this.gamify.streaks().current });
  }

  // merge: 같은 표식의 말풍선이 아직 줄에 서 있으면 쌓지 않고 새것으로 바꾼다 (연달아 사거나 먹일 때)
  // ms: 보일 시간을 정해서 (없으면 글 길이로). extra: 고를 것이 있는 질문 ({ ask, choices })
  bubble(text, kind, link, merge, ms, extra) {
    if (!text) return;
    if (!ALWAYS.has(kind)) {
      if (!this.settings.get('bubblesEnabled') && !REWARD.has(kind)) return;
      if (this.isQuiet()) return;
    }
    const now = Date.now();
    this.bubbleLog = this.bubbleLog.filter((x) => now - x.at < HOUR_MS);
    if (CHATTY_KINDS.has(kind)) {
      if (now < this.chatterMuteUntil) return;
      if (this.bubbleLog.filter((x) => CHATTY_KINDS.has(x.kind)).length >= CHATTY_PER_HOUR || this.bubbleLog.length >= COUNTED_PER_HOUR) return;
    }
    if (COUNTED.has(kind)) this.bubbleLog.push({ at: now, kind });
    // '앞말||뒷말' 은 두 번에 나눠서 말한다 (뜸 들이는 맛)
    const [first, ...rest] = String(text).split('||');
    this.send('pet:bubble', { text: first, kind, link, merge, ms, ...(extra && extra.ask ? { ask: extra.ask, choices: extra.choices } : {}) });
    // 이어지는 말도 같은 곳으로 간다 (예: '쉬는 동안||털실 한 판 할래?' 의 뒷말을 눌러도 논다)
    for (const more of rest) this.send('pet:bubble', { text: more, kind: 'follow', link });
    if (['lunch', 'dinner', 'rest'].includes(kind)) this.gamify.noteBubble(kind);
    this.state.set({ brainDaily: this.brain.daily });
  }

  sound(type) {
    if (this.settings.get('soundEnabled') && !this.isQuiet()) this.send('pet:sound', type);
  }

  // ---------- 하루 목표 · 집중 시간 (1.5.0) ----------

  // "오늘의 목표 120 / 300단어" (메뉴 · 상태 표시줄 설명)
  goalLine() {
    const p = this.goals.progress();
    if (!p.on) return this.T.t('goal.menuOff');
    const v = { n: p.value.toLocaleString(), target: p.target.toLocaleString() };
    return this.T.t((p.done ? 'goal.menuDone' : 'goal.menu') + (p.unit === 'words' ? 'W' : 'C'), v);
  }

  // 오늘 목표를 막 채웠으면 축하하고 코인 · 경험치 (recomputeGrowth 끝 · minuteTick)
  checkGoal() {
    if (this.loading || !this.goals) return null;
    const r = this.goals.check();
    if (!r) return null;
    const { T, gamify } = this;
    gamify.grant(GOAL_XP, { k: r.unit === 'words' ? 'bonus.goalW' : 'bonus.goalC', v: { n: r.target.toLocaleString() } });
    this.shop.give({ coins: GOAL_COINS });
    gamify.count('goal');
    gamify.best('goalStreak', r.streak);
    this.act('levelup');
    this.sound('levelup');
    const v = { n: r.target.toLocaleString(), coins: GOAL_COINS, d: r.streak };
    this.bubble(T.line(r.streak > 1 ? 'goalStreak' : r.unit === 'words' ? 'goalDoneW' : 'goalDoneC', v), 'goal', 'home');
    this.growthSoon();
    this.plugin.updateStatus();
    return r;
  }

  focusLeftText(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  // 집중 시간 시작. 그동안은 방해 금지 (끝나면 풀린다). 고양이 머리 위에 남은 시간
  focusStart(min) {
    if (this.goals.focusInfo().on) return this.goals.focusInfo();
    const f = this.goals.focusStart(min);
    // 집중 때문에 켠 방해 금지면 그 끝 시각을 적어 둔다 (원래 더 길게 켜 둔 방해 금지는 건드리지 않게)
    const quietBefore = this.state.get('quietUntil') || 0;
    this.state.set({ quietUntil: Math.max(quietBefore, f.end), focusQuiet: quietBefore < f.end ? f.end : 0 });
    this.send('pet:quiet', true);
    this.sendFocus();
    this.send('pet:action', 'wave');
    this.bubble(this.T.line('focusStart', { m: f.min }), 'focus');
    this.afterFocusChange();
    return this.goals.focusInfo();
  }

  // 그만두기 (벌은 없다). 집중 때문에 켠 방해 금지만 끈다
  focusStop(silent = false) {
    const f = this.goals.focusStop();
    if (!f) return this.goals.focusInfo();
    this.endFocusQuiet();
    this.sendFocus();
    if (!silent) this.bubble(this.T.line('focusStop'), 'focus');
    this.afterFocusChange();
    return this.goals.focusInfo();
  }

  // 집중 때문에 켠 방해 금지만 끈다 (그사이 사용자가 방해 금지를 다시 정했으면 그대로)
  endFocusQuiet() {
    const mine = this.state.get('focusQuiet');
    if (mine && this.state.get('quietUntil') === mine) this.state.set({ quietUntil: 0 });
    this.state.set({ focusQuiet: 0 });
    this.send('pet:quiet', this.isQuiet());
  }

  afterFocusChange() {
    this.plugin.updateStatus();
    if (this.plugin.focusChanged) this.plugin.focusChanged();
    this.pushHouse();
  }

  // 끝날 시각이 됐는지 (fastTick). 다 마쳤으면 축하 + 코인 · 경험치 + 쉬자는 말
  focusTick(now = Date.now()) {
    const r = this.goals.focusTick(now);
    if (!r) return null;
    this.endFocusQuiet();
    this.sendFocus();
    if (!r.stale) {
      this.gamify.grant(r.xp, { k: 'bonus.focus', v: { m: r.min } });
      this.shop.give({ coins: r.coins });
      this.gamify.count('focus');
      this.gamify.count('focusMin', r.min);
      this.act('levelup');
      this.sound('achieve');
      this.bubble(this.T.line('focusDone', { m: r.min, coins: r.coins }), 'focus', 'home');
      this.growthSoon();
    }
    this.afterFocusChange();
    return r;
  }

  // 쉬는 시간 (2.0.0): 집중을 마친 뒤 홈에서 켠다. 끝나면 고양이가 다시 해 보자고 한다 (상은 없다)
  breakStart(min) {
    const b = this.goals.breakStart(min);
    if (b) {
      this.act('rest', 'stretch');
      this.bubble(this.T.line('breakStart', { m: b.min }), 'focus');
    }
    this.afterFocusChange();
    return this.goals.focusInfo();
  }

  breakStop() {
    this.goals.breakStop();
    this.afterFocusChange();
    return this.goals.focusInfo();
  }

  breakTick(now = Date.now()) {
    const r = this.goals.breakTick(now);
    if (!r) return null;
    this.send('pet:action', 'wave');
    this.bubble(this.T.line('breakDone', { m: r.min }), 'focus', 'home');
    this.afterFocusChange();
    return r;
  }

  // 펫 판에 남은 시간 (끝 시각만 보내고, 초는 펫 판이 센다)
  sendFocus() {
    const f = this.goals.focusInfo();
    this.send('pet:focus', f.on ? { end: f.end, min: f.min } : null);
  }

  recomputeGrowth() {
    if (this.loading) return;
    const { gamify, usage, state, settings } = this;
    const silent = !gamify.st.initialized;
    const since = state.get('startedAt') || 0;
    const bonus = (s) => gamify.bonusXp(s);
    let g = computeGrowth(since, usage, bonus);
    for (let i = 0; i < 4; i++) {
      gamify.evaluate(g, silent);
      const next = computeGrowth(since, usage, bonus);
      if (next.xp === g.xp) break;
      g = next;
    }
    if (silent) gamify.finishInit();
    const before = this.growth ? this.growth.xp : null;
    this.growth = g;

    const lastLevel = state.get('lastLevel');
    const lastStage = state.get('lastStage');
    if (lastLevel != null) {
      const name = settings.get('petName');
      if (g.stageIndex > lastStage) {
        this.send('pet:action', 'evolve');
        this.sound('evolve');
        this.later(() => this.bubble(this.T.line('grow', { name, stage: this.stageName(g) }), 'grow'), 1700);
      } else if (g.level > lastLevel) {
        this.act('levelup');
        this.sound('levelup');
        this.bubble(this.T.line('levelup', { lv: g.level }), 'grow');
        const opened = FURS.filter((f) => f.level > lastLevel && f.level <= g.level);
        if (opened.length) this.later(() => this.bubble(this.T.t('fur.unlocked', { name: this.T.t('fur.' + opened[opened.length - 1].key) }), 'item', 'wardrobe'), 2500);
      }
    }
    state.set({ lastLevel: g.level, lastStage: g.stageIndex });
    this.pushState();
    this.checkGoal();
    this.plugin.updateStatus();
    this.pushHouse();
    return before !== null ? g.xp - before : 0;
  }

  // 쓰다듬기처럼 잦은 일은 2초 모아서 한 번만 다시 계산한다
  growthSoon() {
    if (this.growthTimer) return;
    this.growthTimer = setTimeout(() => {
      this.growthTimer = null;
      this.recomputeGrowth();
    }, 2000);
  }

  // 리캡 카드 숫자 (core/recap.js). 가장 많이 쓴 폴더는 지금 볼트의 폴더 이름으로
  recapOf(kind) {
    const names = {};
    for (const p of this.usage.projects(this.plugin.topFolders())) names[p.id] = p.root ? this.T.t('set.rootFolder') : p.label || null;
    return recap(this.usage, String(kind || 'month'), {
      startedAt: this.state.get('startedAt') || 0,
      bonus: this.state.get('bonus') || [],
      achievements: this.state.get('achievements') || {},
      folderName: (id) => names[id] || null,
    });
  }

  // 매달 첫 주에 한 번: 지난달 리캡 카드가 준비됐다고 하우스 알림으로만 알린다 (말풍선 없음. 지난달에 쓴 날이 있을 때만)
  recapNudge() {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (d.getDate() > 7 || this.state.get('recapNudged') === key) return;
    this.state.set({ recapNudged: key });
    const r = recap(this.usage, 'last', { startedAt: this.state.get('startedAt') || 0 });
    if (r.activeDays > 0) this.houseToast(this.T.t('toast.recapReady', { month: new Date(r.year, r.month - 1, 1).toLocaleDateString(this.T.locale, { month: 'long' }) }), 'sparkle');
  }

  // 누적 기록 (데스크톱판의 claudeStats 자리): 볼트 전체와 킷커밋을 켠 뒤의 기록
  vaultStats() {
    const since = this.state.get('startedAt') || 0;
    const tot = this.usage.totals(since);
    const hours = this.usage.hours(since);
    const peak = hours.some(Boolean) ? hours.indexOf(Math.max(...hours)) : null;
    const folders = this.usage.projects(this.plugin.topFolders()).filter((p) => !p.excluded && p.chars > 0);
    const fav = folders.sort((a, b) => b.chars - a.chars)[0];
    const v = this.plugin.vaultNumbers();
    return {
      notes: v.notes,
      vaultChars: v.chars,
      vaultLinks: v.links,
      sessions: tot.s,
      written: tot.c,
      links: tot.l,
      newNotes: tot.n,
      activeDays: this.usage.activeDays(since).size,
      peakHour: peak,
      favFolder: fav ? (fav.root ? this.T.t('set.rootFolder') : fav.label || '-') : null,
      daily: this.usage.dailyChars(since),
      since,
    };
  }

  housePayload() {
    const { settings, usage, state, gamify, shop, brain } = this;
    const since = state.get('startedAt') || 0;
    const motion = {
      chosen: Object.fromEntries(MOTION_SLOTS.map((x) => [x.key, this.motionList(x.key)[0] || x.free[0]])),
      lists: Object.fromEntries(MOTION_SLOTS.map((x) => [x.key, this.motionList(x.key)])),
      off: MOTION_SLOTS.filter((x) => this.motionOff(x.key)).map((x) => x.key), // 끈 상황 (2.0.0)
      setOn: this.settings.get('setMotionsOn') !== false,
      idle: this.motionList('idle'),
      mood: this.moodMotions(),
    };
    return {
      settings: settings.data,
      release: !settings.get('devUnlocked'),
      obsidian: true,
      growth: this.growth,
      pastLevel: levelOf(xpOf(this.plugin.baselineTotals())),
      loading: this.loading,
      today: usage.today(),
      all: usage.totals(since),
      daily: usage.daily(14),
      hours: usage.hours(),
      projects: usage.projects(this.plugin.topFolders()),
      subfolders: this.plugin.subFolders ? this.plugin.subFolders() : {}, // 1.6.0
      stages: STAGES,
      furs: FURS,
      formula: { CHARS_PER_XP, XP_PER_LINK, XP_PER_NOTE, XP_PER_SESSION, XP_PER_TASK, TASK_COINS },
      goal: this.goals.progress(), // 오늘의 목표 (1.5.0)
      focus: this.goals.focusInfo(), // 집중 시간 (1.5.0)
      game: gamify.summary(),
      shop: shop.summary(),
      motion,
      stats: stats.summary(usage, state, shop.wallet(), (key) => {
        if (key === 'slot') return 'toy';
        const it = findItem(key);
        return it ? it.kind : null;
      }),
      hooks: { installed: true, partial: false, file: '' },
      mood: brain.mood,
      hungry: brain.hungry(),
      gauge: this.gauge.get(),
      todos: this.todos.summary(), // 홈의 할 일 (2.0.0)
      home: this.plugin.homeData ? this.plugin.homeData() : null, // 노트 지도 · 최근 노트 · 외톨이 노트 (2.0.0)
      skills: gamify.lastGrowth ? triedSkills(gamify.context({})) : [], // 해 본 옵시디언 기술 (다음 단계 안내가 쓴다)
      quiet: this.isQuiet(),
      petShown: !!settings.get('showPet'),
      firstRun: !state.get('onboarded'),
      version: this.plugin.manifest ? this.plugin.manifest.version : '',
      whatsNew: state.get('whatsNew') || null, // 업데이트 뒤 아직 안 본 '새로 생긴 것' (버전 문자열)
      vault: this.vaultStats(),
      toyRecords: state.get('toyRecords') || {},
    };
  }

  // ---------- 게임 이벤트 → 펫 반응 ----------

  wireGame() {
    const { gamify } = this;
    const T = () => this.T;
    gamify.on('unlock', (e) => {
      if (e.type === 'achievement') {
        // 업적 · 보상은 한 말풍선으로 묶는다 (데스크톱판 0.4.0)
        this.queueNews(e);
      } else if (e.type === 'quest') {
        this.send('pet:action', 'happy');
        this.sound('quest');
        this.bubble(T().line('quest', { text: e.quest.text, xp: e.quest.xp }), 'quest', 'quests');
      } else if (e.type === 'allclear') {
        this.act('levelup');
        this.sound('achieve');
        this.bubble(T().line('questAll', { xp: e.xp }), 'quest', 'quests');
      }
    });
    gamify.on('retro', (events) => {
      const n = events.filter((e) => e.type === 'achievement').length;
      if (n) this.later(() => {
        this.send('pet:action', 'achieve');
        this.bubble(T().line('retro', { n }), 'retro', 'achievements');
      }, 6000);
    });
    gamify.on('attend', ({ streak, xp }) => {
      this.send('pet:action', 'wave');
      this.bubble(streak > 1 ? T().line('attend', { d: streak, xp }) : T().line('attendFirst', { xp }), 'attend');
    });
    // Lv80 뒤 별 · 연속 출석 기념 선물: 코인이 들어왔다고 하우스 알림으로
    gamify.on('star', (e) => {
      this.sound('achieve');
      this.houseToast(T().t('toast.star', { n: e.stars, coins: e.coins.toLocaleString() }), 'star');
      this.pushHouse();
    });
    gamify.on('streakGift', (e) => {
      this.houseToast(T().t('toast.streakGift', { d: e.days, coins: e.coins.toLocaleString() }), 'fire');
      this.pushHouse();
    });
    gamify.on('rested', (kind) => {
      if (kind === 'rest') this.bubble(T().line('restedRest'), 'rested');
    });
  }

  rewardText(r) {
    const T = this.T;
    if (!r) return '';
    if (r.food) return Object.entries(r.food).map(([k, n]) => T.t('ach.foodN', { name: T.t('item.' + k), n })).join(', ');
    if (r.coins) return T.t('news.coins', { n: r.coins.toLocaleString() });
    if (r.item) return T.t((r.kind === 'motion' ? 'motion.' : 'item.') + r.item);
    return '';
  }

  // 마지막 업적 뒤 2초, 처음 것 뒤 늦어도 10초에 한 번에
  // 예: "업적 달성! 「든든한 집사」 +150XP 대단해! · 보상: 츄르 2개"  /  "업적 2개 달성! 「…」 외 +300XP · 보상: 츄르 2개, 코인 250"
  queueNews(e) {
    this.newsBuf.push(e);
    this.newsFirst ||= Date.now();
    clearTimeout(this.newsTimer);
    this.newsTimer = setTimeout(() => this.flushNews(), Math.max(0, Math.min(NEWS_WAIT, this.newsFirst + NEWS_MAX_WAIT - Date.now())));
  }

  flushNews() {
    const T = this.T;
    const list = this.newsBuf;
    this.newsBuf = [];
    this.newsFirst = 0;
    this.newsTimer = null;
    if (!list.length) return;
    const title = T.t(`ach.${list[0].achievement.id}.name`);
    const xp = list.reduce((a, x) => a + (x.achievement.xp || 0), 0);
    const head = list.length === 1 ? T.line('achieve', { title, xp }) : T.t('news.many', { n: list.length, title, xp });
    const got = list.map((x) => this.rewardText(x.reward)).filter(Boolean);
    // 받은 게 코스튬뿐이면 옷장으로, 아니면 업적 탭으로
    const onlyAcc = list.every((x) => x.reward && x.reward.item && x.reward.kind !== 'motion' && !x.reward.coins);
    const lv = this.motionFor('levelup');
    if (lv) this.send('pet:action', lv === 'levelup' ? 'achieve' : lv);
    this.sound('achieve');
    this.bubble(got.length ? `${head} · ${T.t('news.reward', { what: got.join(', ') })}` : head, 'achieve', onlyAcc ? 'wardrobe' : 'achievements');
  }

  // ---------- 옵시디언에서 온 활동 (plugin 이 부른다) ----------

  // 1분마다
  minuteTick() {
    if (this.loading) return;
    this.recapNudge();
    this.askTick();
    this.gamify.tick(this.brain.lastActivity, this.brain.streakMs());
    this.recomputeGrowth();
  }

  // 5초마다
  fastTick() {
    if (!this.brain) return;
    this.brain.lastHookAt = Date.now();
    this.brain.tick();
    this.gauge.tick();
    if (this.gauge.get().food < 25 && !this.brain.hungry()) this.brain.getHungry();
    this.checkWorkTier();
    this.toyOfferTick();
    this.focusTick();
    this.breakTick();
  }

  // 옵시디언 습관 하나 (plugin/main.js · 할 일): 업적 · 퀘스트 숫자를 올리고 조금 뒤 다시 판정한다 (2.0.0).
  // key = move · retitle · orphanFix · todoDone · view_<옵시디언 화면 종류>
  noteSkill(key, n = 1) {
    if (!this.gamify) return false;
    const ok = this.gamify.count(key, n);
    if (ok) this.growthSoon();
    return ok;
  }

  // 기록이 늘었다 (plugin.flush)
  onUsage() {
    this.brain.activity(this.usage.lastActivity);
    return this.recomputeGrowth();
  }

  later(fn, ms) {
    const id = setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== id);
      fn();
    }, ms);
    this.timers.push(id);
  }

  destroy() {
    for (const id of this.timers) clearTimeout(id);
    clearTimeout(this.hideTimer);
    clearTimeout(this.newsTimer);
    clearTimeout(this.growthTimer);
    if (this.brain) {
      clearTimeout(this.brain.groomTimer);
      clearTimeout(this.brain.breakTimer);
    }
    if (this.gamify) clearTimeout(this.gamify.evalTimer);
    // 바닥에 남은 먹이는 다음에 켜면 사라지니 창고로 돌려 둔다 (plugin.onunload 가 이 뒤에 저장한다)
    this.refundTreats();
  }

  // ---------- IPC: 보내기만 하는 것 (ipcMain.on) ----------

  onSend(ch, frame, ...a) {
    const { state, gamify, brain, T } = this;
    switch (ch) {
      case 'pet:ready': {
        if (frame !== this.pet) return;
        // 펫 판을 새로 만들었으면 바닥·놀이·친구가 다 사라진 새 화면이다. 호스트 쪽 사정을 다시 맞춘다
        this.dragging = false;
        this.playing = null;
        this.refundTreats();
        this.send('pet:config', this.petConfig());
        this.pushState();
        this.send('pet:quiet', this.isQuiet());
        this.sendFocus();
        if (this.loading) this.send('pet:loading', this.plugin.loadingProgress || 0);
        const refund = state.get('refundNote');
        if (refund) {
          state.set({ refundNote: 0 });
          this.later(() => this.bubble(T.t('shop.refund', { n: refund.toLocaleString() }), 'item', 'wardrobe'), 2500);
        }
        if (!state.get('greeted')) {
          state.set({ greeted: true });
          this.later(() => {
            this.send('pet:action', 'wave');
            this.bubble(T.line('hello', { name: this.settings.get('petName') }), 'hello');
          }, 1200);
        }
        return;
      }
      case 'pet:hover':
        if (this.stage && !this.dragging) this.stage.setInteractive(!!a[0]);
        return;
      case 'pet:drag': {
        const [phase, pos] = a;
        if (!this.stage) return;
        if (phase === 'start') {
          this.dragging = true;
          gamify.count('lift');
          this.stage.setInteractive(true);
          return;
        }
        this.dragging = false;
        this.stage.setInteractive(false);
        if (pos && isFinite(pos.x)) this.settings.set({ position: { x: Math.round(pos.x), v: 3 } });
        return;
      }
      case 'pet:poke':
        return this.poke();
      case 'pet:open':
        return this.openHouse(a[0]);
      case 'pet:play-stop':
        return this.stopPlay();
      case 'pet:treat-eaten': {
        const key = a[0];
        const it = findItem(key, 'food');
        // 호스트가 떨군 먹이만 먹은 걸로 친다
        const i = this.floorTreats.indexOf(key);
        if (!it || i < 0) return;
        this.floorTreats.splice(i, 1);
        state.set({ lastFood: key, ...(it.group === 'meal' ? { lastMeal: key } : {}) }); // "아까 그거 또 없어?" · '밥 주기' 순서에 쓴다
        this.sound('quest');
        if (it.premium) this.premiumEaten(it);
        if (it.group === 'meal') {
          if (key !== 'roomService') this.bubble(T.line('treat', { name: T.t(`item.${key}`) }), 'fed', undefined, 'fed');
          this.gauge.eat('meal', fillOf(it));
          gamify.count('fed');
          brain.meal();
        } else {
          if (!PREMIUM_TALK.has(key)) this.bubble(T.line('treat', { name: T.t(`item.${key}`) }), 'treat', undefined, 'treat');
          this.gauge.eat('snack', fillOf(it));
          gamify.count('snack');
          brain.treat();
        }
        return;
      }
      case 'pet:stat':
        if (['giant', 'box'].includes(a[0])) gamify.count(a[0]);
        return;
      case 'pet:played':
      case 'pet:caught': {
        // 놀면 배가 조금 꺼진다. 함께 하는 놀이 한 판(played)은 말은 안 한다
        if (!this.playing) return;
        this.gauge.play();
        gamify.count('catch');
        if (ch === 'pet:played' || !brain.ready('caught', 4_000)) return;
        this.bubble(T.line('caught'), 'play');
        this.sound('quest');
        return;
      }
      case 'pet:toy-record': {
        const [key, value, force] = a;
        if (!RECORD_KEYS.has(key) || !Number.isFinite(value) || value < 0) return;
        const rec = { ...(state.get('toyRecords') || {}) };
        if (!force && value <= (rec[key] || 0)) return;
        rec[key] = Math.floor(value);
        state.set({ toyRecords: rec });
        this.pushHouse();
        return;
      }
      case 'pet:context':
        return this.petContextMenu(this.stage ? this.stage.lastMouse() : null);
      case 'pet:rub': {
        const counted = gamify.poke();
        gamify.count('rub');
        if (brain.ready('rub', 12_000)) this.bubble(T.line(brain.mood === 'sleeping' ? 'rubSleep' : 'rub'), 'poke');
        if (counted) this.growthSoon();
        return;
      }
      // 고양이 질문에 대답했다 (i = 0 첫째 · 1 둘째)
      case 'pet:bubble-reply': {
        const [ask, i] = a;
        if (!ASKS.some(([id]) => id === ask) || (i !== 0 && i !== 1)) return;
        const ans = i === 0 ? 'yes' : 'no';
        state.set({ replies: { ...(state.get('replies') || {}), [ask]: { day: dayOf(new Date()), ans } } });
        if (ask === 'busy' && ans === 'yes') this.chatterMuteUntil = Math.max(this.chatterMuteUntil, Date.now() + BUSY_MUTE_MS);
        this.send('pet:action', 'happy');
        this.bubble(T.line(`ans_${ask}_${ans}`), 'answer');
        return;
      }
      // 수다 말풍선이 끝났다: 2초 안에 눌러 닫았으면(ms < 2000) 귀찮다는 뜻. 세 번 이어지면 수다를 3시간 쉰다
      case 'pet:bubble-end': {
        const [kind, ms] = a;
        if (!CHATTY_KINDS.has(kind)) return;
        if (ms >= 0 && ms < QUICK_DISMISS_MS) this.quickDismiss++;
        else this.quickDismiss = 0;
        if (this.quickDismiss >= 3) {
          this.quickDismiss = 0;
          this.chatterMuteUntil = Date.now() + CHATTER_MUTE_MS;
        }
        return;
      }
      case 'pet:event-say': {
        const [kind] = a;
        if (!EVENT_LINES.has(kind)) return;
        if (['dropHigh', 'huntMiss', 'heldLong'].includes(kind) && !brain.ready('say:' + kind, 30_000)) return;
        this.bubble(T.line(kind), 'event');
        return;
      }
    }
  }

  poke() {
    const { brain, gamify, T } = this;
    if (['sleeping', 'sleepy'].includes(brain.mood)) {
      const now = Date.now();
      this.sleepPokes.push(now);
      while (this.sleepPokes.length && now - this.sleepPokes[0] > 30_000) this.sleepPokes.shift();
      const counted = gamify.poke();
      if (this.sleepPokes.length >= 3) {
        this.sleepPokes.length = 0;
        brain.wake(now);
        this.send('pet:action', 'wakeGrumpy');
        this.bubble(T.line('pokeWake'), 'poke');
      } else {
        this.send('pet:action', 'stir');
        if (brain.ready('pokeSleep', 20_000)) this.bubble(T.line('pokeSleep'), 'poke');
      }
      if (counted) this.growthSoon();
      return;
    }
    // 2.0.0: 그날의 기분을 없앴다. 고른 쓰다듬기 모션 (껐으면 가르릉만)
    this.act('poke', 'purr');
    const counted = gamify.poke();
    const now = Date.now();
    this.pokes.push(now);
    while (this.pokes.length && now - this.pokes[0] > 20_000) this.pokes.shift();
    if (this.pokes.length >= 4 && brain.ready('pokeMany', 15_000)) {
      this.bubble(T.line('pokeMany'), 'poke');
      gamify.count('spam');
    } else if (this.growth && brain.ready('poke', 8_000)) {
      this.bubble(T.line('poke', { lv: this.growth ? this.growth.level : 1 }), 'poke');
    }
    if (counted) this.growthSoon();
  }

  // ---------- IPC: 답을 돌려주는 것 (ipcMain.handle) ----------

  async onInvoke(ch, frame, ...a) {
    const { settings, state, gamify, shop, T } = this;
    switch (ch) {
      case 'house:get':
        return this.housePayload();
      case 'house:set':
        return this.setSettings(a[0] || {}, frame);
      case 'house:onboarded':
        state.set({ onboarded: true });
        return this.housePayload();
      // 집중 시간 (1.5.0): 하우스 홈의 버튼
      case 'focus:start':
        this.focusStart(a[0]);
        return this.housePayload();
      case 'focus:stop':
        this.focusStop();
        return this.housePayload();
      case 'focus:break':
        this.breakStart(a[0]);
        return this.housePayload();
      case 'focus:break-stop':
        this.breakStop();
        return this.housePayload();
      // 홈의 할 일 (2.0.0): 플러그인 data 안에서만 만들고 고치고 지운다
      case 'todo:add':
      case 'todo:edit':
      case 'todo:toggle':
      case 'todo:remove':
      case 'todo:move':
      case 'todo:clear': {
        const r = this.todoOp(ch.slice(5), a);
        return { ...r, payload: this.housePayload() };
      }
      // 이미 있는 노트 열기 · 옵시디언 그래프 열기 (홈의 노트 지도 · 최근 노트)
      case 'note:open':
        return this.plugin.openNote ? this.plugin.openNote(String(a[0] || '')) : false;
      case 'graph:open':
        return this.plugin.openGraph ? !!(await this.plugin.openGraph(!!a[0])) : false;
      // '새로 생긴 것' 창을 봤다 (하우스가 창을 여는 순간 부른다. 설정에서 다시 볼 수는 있다)
      case 'house:whats-new-seen':
        state.set({ whatsNew: null });
        return this.housePayload();
      // 리캡 카드 숫자: 'month' 이번 달 · 'last' 지난달 · 'all' 처음부터
      case 'card:recap':
        return this.recapOf(a[0]);
      case 'quest:refresh': {
        const ok = gamify.refreshQuests();
        this.recomputeGrowth();
        return { ok, payload: this.housePayload() };
      }
      case 'card:save':
        return this.plugin.saveCard(String(a[0] || ''), String(a[1] || 'cat'));
      case 'card:copy':
        return this.plugin.copyImage(String(a[0] || ''));
      case 'card:text':
        return this.plugin.copyText(String(a[0] || '').slice(0, 2000));
      case 'app:reset':
        this.plugin.resetAll();
        return true;
      case 'house:preview':
        this.send('pet:action', this.resolveAction(a[0]));
        return true;
      case 'pet:feed':
        return { payload: this.housePayload(), ...this.feed() };
      case 'shop:buy': {
        const [key, from] = a;
        const r = shop.buy(key);
        const placed = null; // 2.0.0: 모션은 사지 않는다 (처음부터 다 열려 있다)
        // 먹이에 쓴 코인 (업적 '큰손 집사'). 개발자 모드의 공짜 구매는 안 센다
        if (r.ok && r.item.kind === 'food' && !shop.dev()) gamify.count('foodSpent', r.item.price);
        if (r.ok) {
          this.sound('achieve');
          this.send('pet:action', 'happy');
          // 밥·간식은 하우스 토스트로 충분해서 말풍선은 한 번 사는 것(코스튬·모션·장난감·털색)에만 띄운다
          if (r.item.kind !== 'food') this.bubble(T.line('bought', { title: r.item.kind === 'fur' ? T.t(`fur.${r.item.fur}`) : T.t(`item.${key}`) }), 'item', 'wardrobe', 'bought');
        }
        return { payload: this.housePayload(), ok: r.ok, reason: r.reason || null, placed };
      }
      case 'shop:use':
        return { ok: this.giveFood(a[0]), payload: this.housePayload() };
      case 'house:play': {
        const key = a[0];
        const was = !!this.playing;
        // 고양이가 권한 장난감을 30초 안에 눌러서 놀기 시작했다 (업적 '기다림의 달인')
        if (this.toyOffer && this.toyOffer.toy === key && Date.now() - this.toyOffer.at < TOY_OFFER_MS + 10_000 && !this.playing) gamify.count('bored');
        this.toyOffer = null;
        if (this.playing && this.playing.toy !== key) this.stopPlay();
        this.startPlay(key);
        return { on: !!this.playing, stopped: was && !this.playing };
      }
      case 'pet:slot': {
        const r = shop.spin();
        if (r.ok) {
          for (const [i, key] of r.prize.entries()) this.later(() => this.dropTreat(key), 1600 + i * 400);
          this.pushHouse();
        }
        return r;
      }
      // 데스크톱판의 자동 실행·Claude Code 연결. 옵시디언판에는 없다 (화면에서도 뺐다)
      case 'login:set':
      case 'hooks:install':
      case 'hooks:uninstall':
        return this.housePayload();
      case 'hooks:reveal':
        return true;
      case 'quiet:set':
        this.setQuiet(a[0]);
        return this.housePayload();
      case 'pet:reset-position':
        this.resetPosition();
        return true;
      case 'app:feedback':
        this.plugin.openFeedback();
        return true;
    }
    return null;
  }

  // 할 일 하나 조작 (todo:add · edit · toggle · remove · move · clear). 끝냈으면 고양이가 폴짝
  todoOp(op, a) {
    const id = String(a[0] || '');
    let r;
    if (op === 'add') r = this.todos.add(a[0]);
    else if (op === 'edit') r = this.todos.edit(id, a[1]);
    else if (op === 'toggle') r = this.todos.toggle(id);
    else if (op === 'remove') r = this.todos.remove(id);
    else if (op === 'move') r = this.todos.move(id, a[1]);
    else if (op === 'clear') r = this.todos.clearDone();
    else r = { ok: false, reason: 'op' };
    if (op === 'toggle' && r.ok && r.item && r.item.done) {
      this.act('done', 'happy');
      this.sound('quest');
    }
    return { ok: !!r.ok, reason: r.reason || null };
  }

  // house:set — 데스크톱판과 같은 규칙으로 설정을 고친다. from = 고친 하우스 창 (나머지 하우스 창·옵시디언 설정 탭에서 고쳤을 때는 하우스를 다시 그린다)
  setSettings(patch, from = null) {
    const { settings, shop, gamify } = this;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return this.housePayload();
    const allowed = {};
    for (const k of Object.keys(patch)) if ((k in DEFAULT_SETTINGS || k === 'replace') && k !== 'position') allowed[k] = patch[k];
    // 값의 모양을 본다 (데스크톱판 0.3.0). 켜고 끄는 건 true/false 만, 시각은 HH:MM 만, 분은 정수로 하우스 입력 칸 범위 안에서
    for (const k of Object.keys(allowed)) {
      if (typeof DEFAULT_SETTINGS[k] === 'boolean' && typeof allowed[k] !== 'boolean') delete allowed[k];
    }
    for (const k of ['lunchTime', 'dinnerTime', 'bedtime']) {
      if (k in allowed && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(allowed[k]))) delete allowed[k];
    }
    const MIN_RANGE = { restAfterMin: [15, 600], sleepyAfterMin: [5, 600], sleepAfterMin: [10, 1440] };
    for (const [k, [lo, hi]] of Object.entries(MIN_RANGE)) {
      if (!(k in allowed)) continue;
      const v = Number(allowed[k]);
      if (!Number.isFinite(v)) delete allowed[k];
      else allowed[k] = Math.max(lo, Math.min(hi, Math.round(v)));
    }
    // 졸기 시작 ≤ 잠들기. 방금 고친 칸은 그대로 두고 다른 칸을 맞춘다
    if ('sleepyAfterMin' in allowed && !('sleepAfterMin' in allowed) && allowed.sleepyAfterMin > settings.get('sleepAfterMin')) allowed.sleepAfterMin = allowed.sleepyAfterMin;
    if ('sleepAfterMin' in allowed && !('sleepyAfterMin' in allowed) && allowed.sleepAfterMin < settings.get('sleepyAfterMin')) allowed.sleepyAfterMin = Math.max(5, allowed.sleepAfterMin);
    if ('sleepyAfterMin' in allowed && 'sleepAfterMin' in allowed && allowed.sleepyAfterMin > allowed.sleepAfterMin) allowed.sleepyAfterMin = allowed.sleepAfterMin;
    if ('excludedProjects' in allowed) {
      if (!Array.isArray(allowed.excludedProjects)) delete allowed.excludedProjects;
      else allowed.excludedProjects = allowed.excludedProjects.filter((x) => typeof x === 'string');
    }
    if ('cardPrefs' in allowed) allowed.cardPrefs = cleanCardPrefs(allowed.cardPrefs);
    if ('theme' in allowed && !THEMES.includes(allowed.theme)) delete allowed.theme;
    // 귀 모양은 정해진 것 중 하나만 (레벨과 상관없이 다 열려 있다)
    if ('ears' in allowed && !EAR_SHAPES.includes(allowed.ears)) delete allowed.ears;
    for (const k of ['outfit', 'motions']) {
      if (k in allowed && (typeof allowed[k] !== 'object' || Array.isArray(allowed[k]))) delete allowed[k];
    }
    if ('accessory' in allowed && typeof allowed.accessory !== 'string') delete allowed.accessory;
    if ('outfitSaves' in allowed) {
      const saves = Array.isArray(allowed.outfitSaves) ? allowed.outfitSaves.slice(0, 3) : [];
      while (saves.length < 3) saves.push(null);
      allowed.outfitSaves = saves.map((o) => (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([s, k]) => COSTUME_SLOTS.includes(s) && typeof k === 'string')) : null));
    }
    if ('scale' in allowed) allowed.scale = scaleStep(allowed.scale);
    // 하루 목표: { on, unit: words | chars, target } 만 (core/goals.js 가 거른다). 집중 시간은 15 · 25 · 50분 중 하나
    if ('goal' in allowed) {
      allowed.goal = cleanGoal(allowed.goal, allowed.language || settings.get('language'));
      if (!allowed.goal) delete allowed.goal;
    }
    if ('focusMin' in allowed) {
      if (FOCUS_LENGTHS.includes(Number(allowed.focusMin))) allowed.focusMin = Number(allowed.focusMin);
      else delete allowed.focusMin;
    }
    if (!settings.get('devUnlocked')) delete allowed.devMode;
    if ('petName' in allowed) allowed.petName = String(allowed.petName).trim().slice(0, 12) || DEFAULT_SETTINGS.petName;
    if ('language' in allowed && !LANGS.includes(allowed.language)) delete allowed.language;
    if ('personality' in allowed && !PERSONAS.includes(allowed.personality)) delete allowed.personality;
    if ('tugLevel' in allowed && !['easy', 'mid', 'hard'].includes(allowed.tugLevel)) delete allowed.tugLevel;
    if ('fur' in allowed) {
      const f = FURS.find((x) => x.key === allowed.fur);
      // 별 전용 털색은 별 상점에서 산 것만 (shop.owned 가 개발자 모드면 전부 연다)
      if (!f || (f.stars ? !shop.owned('fur_' + f.key) : (this.growth ? this.growth.level : 1) < f.level && !settings.get('devMode'))) delete allowed.fur;
    }
    let wore = false;
    if ('accessory' in allowed) {
      const it = ACCESSORIES.find((x) => x.key === allowed.accessory);
      allowed.outfit = allowed.accessory === 'none' ? Object.fromEntries(COSTUME_SLOTS.map((s) => [s, null])) : it ? { [it.slot]: it.key } : {};
      delete allowed.accessory;
    }
    if ('outfit' in allowed) {
      const before = { ...(settings.get('outfit') || {}) };
      const next = allowed.replace ? {} : { ...before };
      for (const [s, k] of Object.entries(allowed.outfit || {})) {
        if (!COSTUME_SLOTS.includes(s)) continue;
        if (!k) {
          delete next[s];
          continue;
        }
        const it = ACCESSORIES.find((x) => x.key === k && x.slot === s);
        if (!it || !shop.owned(k)) continue;
        next[s] = k;
        if (s === 'set') for (const c of it.covers || []) delete next[c];
        else if (next.set) {
          const set = ACCESSORIES.find((x) => x.key === next.set);
          if (set && (set.covers || []).includes(s)) delete next.set;
        }
      }
      allowed.outfit = this.cleanOutfit(next);
      wore = Object.entries(allowed.outfit).some(([s, k]) => before[s] !== k);
      wore = wore && outfitList(allowed.outfit).some((k) => !Object.values(before).includes(k));
    }
    delete allowed.replace;
    if ('motions' in allowed) {
      const next = { ...(settings.get('motions') || {}) };
      for (const [slot, v] of Object.entries(allowed.motions || {})) {
        const s = slotOf(slot);
        if (!s || slot === 'idle') continue;
        if (s.multi) {
          const list = [...new Set(Array.isArray(v) ? v : [v])].filter((k) => shop.canUseMotion(slot, k));
          if (list.length) next[slot] = list;
        } else if (shop.canUseMotion(slot, v)) next[slot] = v;
      }
      allowed.motions = next;
    }
    // 홈 칸 순서 · 보이기 (2.0.1): 아는 칸만, 겹치지 않게
    if ('homeLayout' in allowed) {
      const v = allowed.homeLayout;
      if (v === null) allowed.homeLayout = null;
      else if (!Array.isArray(v)) delete allowed.homeLayout;
      else {
        const seen = new Set();
        allowed.homeLayout = v
          .filter((x) => x && HOME_SECTIONS.includes(x.id) && !seen.has(x.id) && seen.add(x.id))
          .map((x) => ({ id: x.id, on: x.on !== false }));
      }
    }
    // 모션을 끈 상황 (2.0.0): 상황 키 목록만
    if ('motionsOff' in allowed) {
      allowed.motionsOff = Array.isArray(allowed.motionsOff) ? [...new Set(allowed.motionsOff)].filter((k) => !!slotOf(k)) : [];
    }
    if ('idleMotions' in allowed) {
      allowed.idleMotions = Array.isArray(allowed.idleMotions) ? [...new Set(allowed.idleMotions)].filter((k) => shop.canUseMotion('idle', k)) : null;
    }
    const before = this.effScale();
    if ('petName' in allowed && allowed.petName !== settings.get('petName')) gamify.count('rename');
    const showBefore = !!settings.get('showPet');
    const excludedBefore = settings.get('excludedProjects') || [];
    settings.set(allowed);
    if ('outfit' in allowed || allowed.devMode === false) {
      settings.set({ outfit: this.cleanOutfit(settings.get('outfit')) });
      this.syncAccessory();
    }
    if ('showPet' in allowed && !!allowed.showPet !== showBefore) {
      if (allowed.showPet) this.showPet();
      else this.turnOff();
    }
    if (this.effScale() !== before) this.send('pet:config', this.petConfig());
    if ('language' in allowed || 'personality' in allowed) {
      this.syncStrings();
      this.plugin.relabel();
    }
    const wearMotion = wore ? this.motionFor('wear') : null;
    if (['petName', 'outfit', 'fur', 'ears', 'soundEnabled', 'language', 'personality', 'motions', 'idleMotions', 'motionsOff', 'setMotionsOn', 'devMode', 'bubblesEnabled', 'lowPower'].some((k) => k in allowed)) this.send('pet:config', { ...this.petConfig(), wearMotion });
    if (wearMotion) this.send('pet:action', wearMotion);
    if ('excludedProjects' in allowed) {
      // 다시 넣은 폴더는 그동안 안 읽었으니 지금 크기로 기준만 잡는다
      const back = excludedBefore.filter((id) => !(allowed.excludedProjects || []).includes(id));
      if (back.length && this.plugin.rebaseline) this.plugin.rebaseline(back);
      // 누적값이 한꺼번에 바뀌어도 퀘스트 진행도는 그대로 두게 기준값을 같이 민다
      gamify.rebaseQuests(() => this.usage.setExcluded(allowed.excludedProjects));
      this.state.set({ lastLevel: null, lastStage: null });
      this.recomputeGrowth();
    }
    // 목표를 낮추면 오늘 이미 채웠을 수 있다
    if ('goal' in allowed) this.checkGoal();
    this.plugin.updateStatus();
    const payload = this.housePayload();
    for (const h of this.houses) if (h !== from) h.emit('house:data', payload);
    return payload;
  }
}

module.exports = { KitHost, STATE_DEFAULTS, KitFrame, PixelArt, setIcon, Notice };
