// 킷커밋 데스크톱판 main.js 의 옵시디언판.
// 창·트레이·IPC 로 하던 일을 옵시디언의 오버레이(펫 무대)·상태 표시줄·메뉴·iframe 다리로 옮겼다.
// 성장·상점·퀘스트·업적·친구·보물·게이지는 core/* (데스크톱판과 같은 코드)가 그대로 한다.
const { Menu, Notice, setIcon } = require('obsidian');
const { computeGrowth, xpOf, levelOf, FURS, STAGES, foldStage, CHARS_PER_XP, XP_PER_LINK, XP_PER_NOTE, XP_PER_SESSION } = require('../core/growth');
const { Brain } = require('../core/brain');
const { Gamify } = require('../core/gamify');
const { SET_MOTIONS, COSTUME_SLOTS, outfitList, fillOf, Shop, ACCESSORIES, FOODS, TOYS, MOTION_SLOTS, slotOf, find: findItem } = require('../core/shop');
const stats = require('../core/stats');
const { Treasures } = require('../core/treasure');
const { Workshop } = require('../core/workshop');
const { Friends, FRIENDS, FRIEND_STEPS } = require('../core/friends');
const { Gauge } = require('../core/gauge');
const { Strings, LANGS, PERSONAS } = require('../kit/i18n');
const PixelArt = require('../kit/pixelart');
const { DEFAULT_SETTINGS } = require('./store');
const { KitFrame } = require('./frame');

const MIN = 60_000;
const WORK_TIERS = [
  { slot: 'workHour', ms: 60 * MIN },
  { slot: 'workLong', ms: 15 * MIN },
];
const STATE_DEFAULTS = { lastLevel: null, lastStage: null, stageScheme: 0, greeted: false, onboarded: false, quietUntil: 0, brainDaily: {}, life: { hungrySince: 0, fedAt: 0 }, walletSpent: 0, startedAt: 0, pantry: {}, purchases: [] };
const BORED_REST = 10 * MIN;
const MOTION_HOLD = 5 * MIN;
const ALWAYS = new Set(['notify']);
const REWARD = new Set(['grow', 'achieve', 'item', 'quest', 'attend', 'retro']);
const TEMPERS = [
  { key: 'calm', w: 35 },
  { key: 'playful', w: 35 },
  { key: 'grumpy', w: 30 },
];
const EVENT_LINES = new Set(['eventFetchOut', 'eventFetchBack', 'eventBird', 'eventGuest', 'eventGuestBye', 'eventRare', 'heldLong', 'heldEscape', 'dropHigh', 'huntCatch', 'huntMiss']);
const RECORD_KEYS = new Set(['whackcat', 'rps', 'rpsStreak', 'trampoline']);
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
    this.grumpyPokes = [];
    this.hideTimer = null;
    this.timers = [];
  }

  // ---------- 시작 ----------

  init() {
    const { settings, state, usage } = this;
    usage.setExcluded(settings.get('excludedProjects'));
    this.syncStrings();
    this.gamify = new Gamify(state, usage, () => settings.data, () => this.T);
    this.shop = new Shop(state, usage, () => settings.data, () => this.growth);
    this.treasures = new Treasures(state);
    this.workshop = new Workshop(state, this.treasures, this.shop);
    this.friends = new Friends(state);
    this.gamify.extra = () => {
      const w = this.shop.wallet();
      const items = state.get('items') || [];
      const kinds = { acc: 0, motion: 0, toy: 0 };
      for (const k of items) {
        const it = findItem(k);
        if (it && it.kind in kinds && k !== 'none') kinds[it.kind]++;
      }
      return {
        owned: kinds, totalAcc: ACCESSORIES.filter((a) => a.key !== 'none').length, totalToy: TOYS.length,
        bought: (state.get('purchases') || []).length, spent: w.spent, earned: w.earned, balance: w.balance,
        treasureKinds: this.treasures.summary().kinds,
        maxBacklinks: this.plugin.linkStats().max,
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
    this.gauge = new Gauge(state);

    const brain = new Brain(() => settings.data, () => ({ today: usage.today() }), () => this.T);
    this.brain = brain;
    brain.daily = state.get('brainDaily') || {};
    brain.life = state.get('life') || { hungrySince: 0, fedAt: 0 };
    brain.systemIdle = () => this.plugin.idleSeconds();
    // 옵시디언판은 타이핑을 hook 처럼 늘 알려 준다 (plugin/main.js 의 onType). 그래서 '같이 쓰는 중'은 타이핑할 때만이다
    brain.lastHookAt = Date.now();
    brain.on('bubble', ({ text, kind }) => this.bubble(text, kind));
    brain.on('life', (life) => {
      state.set({ life });
      this.pushState();
      this.pushHouse();
    });
    brain.on('action', (a) => this.send('pet:action', this.resolveAction(a)));
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

  // ---------- 글·성격 ----------

  syncStrings() {
    const { settings } = this;
    this.T.set(settings.get('language'), settings.get('personality'));
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

  openHouse(tab) {
    this.plugin.openHouse(tab);
  }

  attachHouse(frame) {
    this.houses.add(frame);
    this.gamify.count('house');
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
      { title: T.t('tray.gauges', { food: gaugeBar(g.food), energy: gaugeBar(g.energy) }), disabled: true },
      { title: T.t('tray.today', { m: t.c.toLocaleString(), s: t.s, streak: this.gamify.streaks().current }), disabled: true },
    ];
  }

  commonMenu() {
    const T = this.T;
    const visible = this.petVisible();
    return [
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
    const menu = this.buildMenu([
      ...this.menuHeader(),
      { sep: true },
      foodMenu('meal', 'tray.feed', 'tray.noMeals', 'ricebowl'),
      foodMenu('snack', 'tray.treats', 'tray.noTreats', 'churu'),
      ...toyMenu,
      { sep: true },
      ...this.commonMenu(),
    ]);
    menu.showAtPosition(pos || { x: 100, y: 100 });
  }

  // ---------- 장난감 놀이 ----------

  isResting() {
    return !!this.brain && (this.brain.mood === 'sleeping' || this.brain.mood === 'sleepy');
  }

  startPlay(toy) {
    if (this.playing) return this.stopPlay();
    if (!this.shop.owned(toy)) return this.openHouse('shop');
    if (!this.pet) this.showPet();
    if ((this.state.get('boredUntil') || 0) > Date.now()) {
      this.send('pet:action', 'bored');
      this.bubble(this.T.line('stillBored'), 'play');
      return;
    }
    this.gauge.tick(this.isResting());
    const no = this.gauge.playBlocker();
    if (no === 'hungry') {
      this.send('pet:action', this.resolveAction('slot:hungry'));
      this.bubble(this.T.line('playHungry'), 'play');
      return;
    }
    if (no === 'tired') {
      this.send('pet:action', 'yawn');
      this.bubble(this.T.line('playTired'), 'play');
      return;
    }
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
    this.send('pet:treat', { key });
    this.sound('pop');
    return true;
  }

  feed() {
    const wasHungry = this.brain.hungry();
    const pantry = this.state.get('pantry') || {};
    const meal = FOODS.find((x) => x.group === 'meal' && pantry[x.key] > 0);
    if (!meal) return { ok: false, wasHungry };
    this.giveFood(meal.key);
    return { ok: true, wasHungry, key: meal.key };
  }

  // ---------- 모션 ----------

  motionList(slot) {
    const s = slotOf(slot);
    if (!s) return [];
    const raw = slot === 'idle' ? this.settings.get('idleMotions') : (this.settings.get('motions') || {})[slot];
    const list = (Array.isArray(raw) ? raw : raw ? [raw] : slot === 'idle' ? s.free : [s.free[0]]).filter((k) => this.shop.canUseMotion(slot, k));
    return list.length || slot === 'idle' ? list : [s.free[0]];
  }

  motionFor(slot) {
    const s = slotOf(slot);
    if (!s) return slot;
    const list = this.motionList(slot);
    if (!list.length) return s.free[0];
    const now = Date.now();
    const st = this.motionTurn[slot] || (this.motionTurn[slot] = { i: 0, at: now });
    if (list.length > 1 && now - st.at >= MOTION_HOLD) {
      st.i++;
      st.at = now;
    }
    return list[st.i % list.length];
  }

  setMotions() {
    const set = this.cleanOutfit(this.settings.get('outfit')).set;
    return (set && SET_MOTIONS[set]) || [];
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

  // ---------- 깜짝 이벤트·동네 친구 ----------

  maybeEvent(force = false, type = null) {
    if (!this.pet || !this.petVisible() || this.loading) return null;
    if (!force && this.plugin.idleSeconds() > 5 * 60) return null;
    const busy = !!this.playing || this.isQuiet();
    const still = ['sleeping', 'sleepy', 'thinking', 'waiting'].includes(this.brain.mood);
    const ev = this.treasures.roll({ busy, asleep: still, force, type });
    if (ev) this.send('pet:event', ev);
    return ev;
  }

  friendTick() {
    if (!this.friends || !this.pet || this.loading) return;
    const v0 = this.friends.st().visit;
    if (v0 && v0.until + MIN <= Date.now()) {
      this.friends.finish();
      this.send('pet:friend-leave');
      this.pushHouse();
    }
    const away = this.plugin.idleSeconds() > 5 * 60;
    const v = this.friends.tick({ away, busy: this.isQuiet() || !this.petVisible() });
    if (v) this.friendArrive(v);
  }

  friendArrive(v) {
    const f = FRIENDS.find((x) => x.id === v.id);
    this.send('pet:friend', { id: v.id, fur: f.fur != null ? f.fur : null, art: f.art || null, kind: v.kind, until: v.until, wear: this.friends.wearList(v.id) });
    if (v.up && v.level > 0) this.later(() => this.bubble(this.T.line('guestFriend', { guest: this.T.t('fr.' + v.id + '.name'), level: this.T.t('friend.' + v.level) }), 'event'), 9000);
    this.pushHouse();
  }

  friendInfo() {
    const v = this.friends.current();
    if (!v) return null;
    const f = FRIENDS.find((x) => x.id === v.id);
    const one = this.friends.summary().list.find((x) => x.id === v.id);
    const box = this.state.get('treasures') || {};
    const pantry = Object.entries(this.state.get('pantry') || {})
      .filter(([k, n]) => n > 0 && FOODS.find((x) => x.key === k))
      .map(([k, n]) => ({ key: k, n, group: FOODS.find((x) => x.key === k).group }));
    return { id: v.id, fur: f.fur, art: f.art, kind: v.kind, until: v.until, level: one.level, pts: one.pts, prev: FRIEND_STEPS[one.level], next: one.next, want: { ...v.want, have: box[v.want.key] || 0 }, gift: v.gift, traded: v.traded, feeds: v.feeds, maxFeeds: 3, pantry };
  }

  friendResult(r) {
    if (r && r.ok && r.up && r.level > 0) this.later(() => this.bubble(this.T.line('guestFriend', { guest: this.T.t('fr.' + r.id + '.name'), level: this.T.t('friend.' + r.level) }), 'event'), 2500);
    this.pushState();
    this.pushHouse();
    return r;
  }

  // ---------- 그날의 기분 ----------

  temper() {
    const today = new Date().toDateString();
    let t = this.state.get('temper');
    if (!t || t.day !== today) {
      let r = Math.random() * TEMPERS.reduce((a, x) => a + x.w, 0);
      const key = (TEMPERS.find((x) => (r -= x.w) < 0) || TEMPERS[0]).key;
      t = { day: today, key, said: false };
      this.state.set({ temper: t });
    }
    return t.key;
  }

  announceTemper() {
    const key = this.temper();
    const t = this.state.get('temper');
    if (t.said || this.loading) return;
    this.state.set({ temper: { ...t, said: true } });
    this.later(() => this.bubble(this.T.line('temper_' + key), 'hello'), 3000);
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
      bubbles: s.get('bubblesEnabled'),
      sound: s.get('soundEnabled'),
      language: s.get('language'),
      personality: s.get('personality'),
      moodMotions: this.moodMotions(),
      idleMotions: this.idlePool(),
      temper: this.temper(),
    };
  }

  pushState() {
    this.send('pet:state', { mood: this.brain.mood, growth: this.growth, quiet: this.isQuiet(), streak: this.gamify.streaks().current });
  }

  bubble(text, kind, link) {
    if (!text) return;
    if (!ALWAYS.has(kind)) {
      if (!this.settings.get('bubblesEnabled') && !REWARD.has(kind)) return;
      if (this.isQuiet()) return;
    }
    const [first, ...rest] = String(text).split('||');
    this.send('pet:bubble', { text: first, kind, link });
    for (const more of rest) this.send('pet:bubble', { text: more, kind: 'follow' });
    if (['lunch', 'dinner', 'rest'].includes(kind)) this.gamify.noteBubble(kind);
    this.state.set({ brainDaily: this.brain.daily });
  }

  sound(type) {
    if (this.settings.get('soundEnabled') && !this.isQuiet()) this.send('pet:sound', type);
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
        this.send('pet:action', this.motionFor('levelup'));
        this.sound('levelup');
        this.bubble(this.T.line('levelup', { lv: g.level }), 'grow');
        const opened = FURS.filter((f) => f.level > lastLevel && f.level <= g.level);
        if (opened.length) this.later(() => this.bubble(this.T.t('fur.unlocked', { name: this.T.t('fur.' + opened[opened.length - 1].key) }), 'item', 'wardrobe'), 2500);
      }
    }
    state.set({ lastLevel: g.level, lastStage: g.stageIndex });
    this.pushState();
    this.plugin.updateStatus();
    this.pushHouse();
    return before !== null ? g.xp - before : 0;
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
      stages: STAGES,
      furs: FURS,
      formula: { CHARS_PER_XP, XP_PER_LINK, XP_PER_NOTE, XP_PER_SESSION },
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
      quiet: this.isQuiet(),
      petShown: !!settings.get('showPet'),
      firstRun: !state.get('onboarded'),
      vault: this.vaultStats(),
      temper: this.temper(),
      treasures: this.treasures.summary(),
      workshop: this.workshop.summary(),
      friends: this.friends.summary(),
      toyRecords: state.get('toyRecords') || {},
    };
  }

  // ---------- 게임 이벤트 → 펫 반응 ----------

  wireGame() {
    const { gamify } = this;
    const T = () => this.T;
    gamify.on('unlock', (e) => {
      if (e.type === 'achievement') {
        const lv = this.motionFor('levelup');
        this.send('pet:action', lv === 'levelup' ? 'achieve' : lv);
        this.sound('achieve');
        this.bubble(T().line('achieve', { title: T().t(`ach.${e.achievement.id}.name`), xp: e.achievement.xp }), 'achieve', 'achievements');
        const r = e.reward;
        if (r && r.food) this.bubble(T().t('ach.gotFood', { what: Object.entries(r.food).map(([k, n]) => T().t('ach.foodN', { name: T().t('item.' + k), n })).join(', ') }), 'item', 'achievements');
        else if (r && r.kind === 'coins') this.bubble(T().t('ach.gotCoinsOnly', { n: r.coins.toLocaleString() }), 'item', 'achievements');
        else if (r && r.coins) this.bubble(T().t('ach.gotCoins', { name: T().t((r.kind === 'motion' ? 'motion.' : 'item.') + r.item), n: r.coins }), 'item', 'achievements');
        else if (r && r.item) this.bubble(T().t(r.kind === 'motion' ? 'ach.gotMotion' : 'ach.gotAcc', { name: T().t((r.kind === 'motion' ? 'motion.' : 'item.') + r.item) }), 'item', r.kind === 'motion' ? 'achievements' : 'wardrobe');
      } else if (e.type === 'quest') {
        this.send('pet:action', 'happy');
        this.sound('quest');
        this.bubble(T().line('quest', { text: e.quest.text, xp: e.quest.xp }), 'quest', 'quests');
      } else if (e.type === 'allclear') {
        this.send('pet:action', this.motionFor('levelup'));
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
    gamify.on('rested', (kind) => {
      if (kind === 'rest') this.bubble(T().line('restedRest'), 'rested');
    });
  }

  // ---------- 옵시디언에서 온 활동 (plugin 이 부른다) ----------

  // 1분마다
  minuteTick() {
    if (this.loading) return;
    const day = this.state.get('temper') && this.state.get('temper').day;
    if (day !== new Date().toDateString()) {
      this.temper();
      this.send('pet:config', this.petConfig());
    }
    this.announceTemper();
    this.maybeEvent();
    this.friendTick();
    this.gamify.tick(this.brain.lastActivity, this.brain.streakMs());
    this.recomputeGrowth();
  }

  // 5초마다
  fastTick() {
    if (!this.brain) return;
    this.brain.lastHookAt = Date.now();
    this.brain.tick();
    this.gauge.tick(this.isResting());
    if (this.gauge.get().food < 25 && !this.brain.hungry()) this.brain.getHungry();
    this.checkWorkTier();
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
    if (this.brain) clearTimeout(this.brain.groomTimer);
  }

  // ---------- IPC: 보내기만 하는 것 (ipcMain.on) ----------

  onSend(ch, frame, ...a) {
    const { state, gamify, brain, T } = this;
    switch (ch) {
      case 'pet:ready': {
        this.send('pet:config', this.petConfig());
        this.pushState();
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
        if (!it) return;
        state.set({ lastFood: key });
        this.sound('quest');
        if (it.group === 'meal') {
          this.bubble(T.line('treat', { name: T.t(`item.${key}`) }), 'fed');
          this.gauge.eat('meal', fillOf(it), it.energy);
          gamify.count('fed');
          brain.meal();
        } else {
          this.bubble(T.line('treat', { name: T.t(`item.${key}`) }), 'treat');
          this.gauge.eat('snack', fillOf(it), it.energy);
          gamify.count('snack');
          brain.treat();
        }
        return;
      }
      case 'pet:stat':
        if (['giant', 'box'].includes(a[0])) gamify.count(a[0]);
        return;
      case 'pet:bored':
        if (!this.playing) return;
        state.set({ boredUntil: Date.now() + BORED_REST });
        gamify.count('bored');
        this.bubble(T.line('bored'), 'play');
        this.later(() => this.stopPlay(), 3800);
        return;
      case 'pet:played':
      case 'pet:caught': {
        if (!this.playing) return;
        this.gauge.play();
        gamify.count('catch');
        const no = this.gauge.playBlocker();
        if (no) {
          this.bubble(T.line(no === 'hungry' ? 'playHungry' : 'playTired'), 'play');
          this.later(() => this.stopPlay(), 2500);
          return;
        }
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
        gamify.poke();
        gamify.count('rub');
        if (a[0] === 'swat') {
          if (brain.ready('rubSwat', 10_000)) this.bubble(T.line('rubSwat'), 'poke');
        } else if (brain.ready('rub', 12_000)) this.bubble(T.line(brain.mood === 'sleeping' ? 'rubSleep' : 'rub'), 'poke');
        this.recomputeGrowth();
        return;
      }
      case 'pet:treasure': {
        const key = a[0];
        const r = this.treasures.add(key);
        if (!r) return;
        const item = T.t('treasure.' + key);
        this.bubble(T.line(r.fresh ? 'treasureNew' : 'treasureGot', { item, n: r.kinds, total: r.total }), 'item', 'workshop');
        this.sound('quest');
        gamify.count('treasure');
        this.pushHouse();
        return;
      }
      case 'pet:event-say': {
        const [kind, vars] = a;
        if (!EVENT_LINES.has(kind)) return;
        if (['dropHigh', 'huntMiss', 'heldLong'].includes(kind) && !brain.ready('say:' + kind, 30_000)) return;
        const v = {};
        if (vars && vars.item) v.item = T.t('treasure.' + vars.item);
        if (vars && vars.friend && FRIENDS.some((x) => x.id === vars.friend)) v.guest = T.t('fr.' + vars.friend + '.name');
        this.bubble(T.line(kind, v), 'event');
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
      gamify.poke();
      if (this.sleepPokes.length >= 3) {
        this.sleepPokes.length = 0;
        brain.wake(now);
        this.send('pet:action', 'wakeGrumpy');
        this.bubble(T.line('pokeWake'), 'poke');
      } else {
        this.send('pet:action', 'stir');
        if (brain.ready('pokeSleep', 20_000)) this.bubble(T.line('pokeSleep'), 'poke');
      }
      this.recomputeGrowth();
      return;
    }
    const tp = this.temper();
    if (tp === 'grumpy') {
      const now = Date.now();
      this.grumpyPokes.push(now);
      while (this.grumpyPokes.length && now - this.grumpyPokes[0] > 20_000) this.grumpyPokes.shift();
      gamify.poke();
      if (this.grumpyPokes.length >= 2) {
        this.send('pet:action', 'swat');
        if (brain.ready('pokeSwat', 8_000)) this.bubble(T.line('pokeSwat'), 'poke');
      } else {
        this.send('pet:action', 'perk');
        if (brain.ready('pokeGrumpy', 15_000)) this.bubble(T.line('pokeGrumpy'), 'poke');
      }
      this.recomputeGrowth();
      return;
    }
    this.send('pet:action', tp === 'calm' && Math.random() < 0.5 ? 'purr' : this.motionFor('poke'));
    if (tp === 'playful' && Math.random() < 0.3) this.later(() => this.send('pet:action', 'zoomies'), 1400);
    gamify.poke();
    const now = Date.now();
    this.pokes.push(now);
    while (this.pokes.length && now - this.pokes[0] > 20_000) this.pokes.shift();
    if (this.pokes.length >= 4 && brain.ready('pokeMany', 15_000)) {
      this.bubble(T.line('pokeMany'), 'poke');
      gamify.count('spam');
    } else if (this.growth && brain.ready('poke', 8_000)) {
      this.bubble(T.line('poke', { lv: this.growth ? this.growth.level : 1 }), 'poke');
    }
    this.recomputeGrowth();
  }

  // ---------- IPC: 답을 돌려주는 것 (ipcMain.handle) ----------

  async onInvoke(ch, frame, ...a) {
    const { settings, state, gamify, shop, friends, T } = this;
    switch (ch) {
      case 'house:get':
        return this.housePayload();
      case 'house:set':
        return this.setSettings(a[0] || {}, frame);
      case 'house:onboarded':
        state.set({ onboarded: true });
        return this.housePayload();
      case 'quest:refresh': {
        const ok = gamify.refreshQuests();
        this.recomputeGrowth();
        return { ok, payload: this.housePayload() };
      }
      case 'house:friend-call': {
        const v = friends.call(String(a[0]));
        if (v && !v.error) {
          this.showPet();
          this.friendArrive(v);
        }
        return { result: v, data: this.housePayload() };
      }
      case 'house:friend-gift': {
        const r = friends.gift(String(a[0]), String(a[1]));
        if (r.ok) {
          settings.set({ outfit: this.cleanOutfit(settings.get('outfit')) });
          this.syncAccessory();
          this.sound('achieve');
          const v = friends.current();
          if (v && v.id === r.id) this.send('pet:friend-wear', { id: r.id, wear: friends.wearList(r.id) });
          this.pushState();
        }
        return { result: r, data: this.housePayload() };
      }
      case 'dev:event': {
        if (!settings.get('devMode')) return null;
        const type = a[0];
        if (type === 'guest' || type === 'friend') {
          if (friends.current()) {
            friends.finish();
            this.send('pet:friend-leave');
          }
          const v = friends.start(FRIENDS[Math.floor(Math.random() * FRIENDS.length)].id, 'visit');
          if (v) this.friendArrive(v);
          return v;
        }
        return this.maybeEvent(true, type);
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
        const key = a[0];
        const r = shop.buy(key);
        if (r.ok) {
          this.sound('achieve');
          this.send('pet:action', 'happy');
          this.bubble(T.line('bought', { title: T.t(`item.${key}`) }), 'item', 'wardrobe');
        }
        return { payload: this.housePayload(), ok: r.ok, reason: r.reason || null };
      }
      case 'workshop:craft': {
        const key = a[0];
        const r = this.workshop.craft(key);
        if (r.ok) {
          this.sound('achieve');
          this.send('pet:action', 'happy');
          this.bubble(T.t('workshop.crafted', { name: T.t(`item.${key}`) }), 'item', 'wardrobe');
        }
        return { payload: this.housePayload(), ok: r.ok, reason: r.reason || null };
      }
      case 'shop:use':
        return { ok: this.giveFood(a[0]), payload: this.housePayload() };
      case 'house:play': {
        const key = a[0];
        const was = !!this.playing;
        if (this.playing && this.playing.toy !== key) this.stopPlay();
        this.startPlay(key);
        return { on: !!this.playing, stopped: was && !this.playing };
      }
      case 'pet:slot': {
        const r = shop.spin();
        if (r.ok) {
          for (const [i, key] of r.prize.entries()) this.later(() => this.send('pet:treat', { key }), 1600 + i * 400);
          this.pushHouse();
        }
        return r;
      }
      case 'pet:friend-info':
        return this.friendInfo();
      case 'pet:friend-trade': {
        const v = friends.current();
        const r = friends.trade();
        if (r && r.ok && v) this.bubble(T.t('fr.gotGift', { name: T.t('fr.' + v.id + '.name'), food: T.t('item.' + r.gift.key), n: r.gift.n }), 'item');
        return this.friendResult(r);
      }
      case 'pet:friend-feed': {
        const it = FOODS.find((x) => x.key === a[0]);
        if (!it) return { error: 'none' };
        return this.friendResult(friends.feed(a[0], it.group));
      }
      case 'pet:friend-bye': {
        const r = friends.finish();
        this.pushHouse();
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
    }
    return null;
  }

  // house:set — 데스크톱판과 같은 규칙으로 설정을 고친다. from = 고친 하우스 창 (나머지 하우스 창·옵시디언 설정 탭에서 고쳤을 때는 하우스를 다시 그린다)
  setSettings(patch, from = null) {
    const { settings, shop, gamify } = this;
    const allowed = {};
    for (const k of Object.keys(patch)) if ((k in DEFAULT_SETTINGS || k === 'replace') && k !== 'position') allowed[k] = patch[k];
    if ('outfitSaves' in allowed) {
      const saves = Array.isArray(allowed.outfitSaves) ? allowed.outfitSaves.slice(0, 3) : [];
      while (saves.length < 3) saves.push(null);
      allowed.outfitSaves = saves.map((o) => (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([s, k]) => COSTUME_SLOTS.includes(s) && typeof k === 'string')) : null));
    }
    if ('scale' in allowed) allowed.scale = scaleStep(allowed.scale);
    if (!settings.get('devUnlocked')) delete allowed.devMode;
    if ('petName' in allowed) allowed.petName = String(allowed.petName).trim().slice(0, 12) || DEFAULT_SETTINGS.petName;
    if ('language' in allowed && !LANGS.includes(allowed.language)) delete allowed.language;
    if ('personality' in allowed && !PERSONAS.includes(allowed.personality)) delete allowed.personality;
    if ('tugLevel' in allowed && !['easy', 'mid', 'hard'].includes(allowed.tugLevel)) delete allowed.tugLevel;
    if ('fur' in allowed) {
      const f = FURS.find((x) => x.key === allowed.fur);
      if (!f || ((this.growth ? this.growth.level : 1) < f.level && !settings.get('devMode'))) delete allowed.fur;
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
    if ('idleMotions' in allowed) {
      allowed.idleMotions = Array.isArray(allowed.idleMotions) ? [...new Set(allowed.idleMotions)].filter((k) => shop.canUseMotion('idle', k)) : null;
    }
    const before = this.effScale();
    if ('petName' in allowed && allowed.petName !== settings.get('petName')) gamify.count('rename');
    const showBefore = !!settings.get('showPet');
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
    if (['petName', 'outfit', 'fur', 'soundEnabled', 'language', 'personality', 'motions', 'idleMotions', 'devMode', 'bubblesEnabled'].some((k) => k in allowed)) this.send('pet:config', { ...this.petConfig(), wearMotion });
    if (wearMotion) this.send('pet:action', wearMotion);
    if ('excludedProjects' in allowed) {
      this.usage.setExcluded(allowed.excludedProjects);
      this.state.set({ lastLevel: null, lastStage: null });
      this.recomputeGrowth();
    }
    this.plugin.updateStatus();
    const payload = this.housePayload();
    for (const h of this.houses) if (h !== from) h.emit('house:data', payload);
    return payload;
  }
}

module.exports = { KitHost, STATE_DEFAULTS, KitFrame, PixelArt, setIcon, Notice };
