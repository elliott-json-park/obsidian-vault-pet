// 게임 요소: 업적, 일일 퀘스트, 출석 스트릭, 꾸미기 아이템, 보너스 경험치.
const { EventEmitter } = require('events');
const { dayOf } = require('./usage');

const MIN = 60_000;

// 꾸미기 아이템 목록은 상점이 갖는다 (가격·레벨 조건 포함).
// 이름은 renderer/i18n.js 의 'item.<key>' 에 있다
const { ACCESSORIES: ITEMS } = require('./shop');

// 업적 100여 개는 achievements.js 에 묶음·난이도·보상과 함께 있다
const { ACHIEVEMENTS, CATS, TIERS } = require('./achievements');

// 퀘스트 풀. 한 번에 3개가 나오는데 상(hard)·중(normal)·하(easy)가 하나씩이고 종류는 서로 다르다.
//  metric(c) : 지금까지의 누적값. 퀘스트를 받은 순간 값을 적어 두고(base), 거기서 늘어난 만큼이 진행도다
//              (그래서 새로 받자마자 아까 한 일로 깨지는 일이 없다)
//  tiers     : 난이도별 [목표, 경험치]. 없는 난이도 칸에는 뽑히지 않는다
//  needs(c)  : false 면 아직 못 하는 퀘스트라 뽑지 않는다 (장난감이 없는데 장난감 퀘스트 등)
//  vars      : 문구에 넣을 값. 없으면 { n: 목표, name: 고양이 이름 }
// 문구는 renderer/i18n.js 의 'quest.<type>'
const cntOf = (c, k) => (c.st.cnt || {})[k] || 0;
const QUEST_POOL = [
  { type: 'chars', metric: (c) => c.all.c, tiers: { easy: [300, 30], normal: [1000, 60], hard: [3000, 120] } },
  { type: 'links', metric: (c) => c.all.l, tiers: { easy: [3, 30], normal: [10, 60], hard: [25, 120] } },
  { type: 'notes', metric: (c) => c.all.n, tiers: { easy: [1, 30], normal: [3, 60], hard: [6, 120] } },
  { type: 'sessions', metric: (c) => c.all.s, tiers: { easy: [1, 30], normal: [2, 60], hard: [4, 120] } },
  { type: 'opens', metric: (c) => c.all.v, tiers: { easy: [5, 25], normal: [15, 50], hard: [40, 100] } },
  { type: 'xp', metric: (c) => c.xp, tiers: { easy: [60, 30], normal: [200, 60], hard: [500, 120] } },
  { type: 'poke', metric: (c) => c.st.pokes || 0, tiers: { easy: [3, 25], normal: [10, 50], hard: [25, 100] } },
  { type: 'lift', metric: (c) => cntOf(c, 'lift'), tiers: { easy: [2, 25], normal: [5, 50] } },
  { type: 'fed', metric: (c) => cntOf(c, 'fed'), tiers: { easy: [1, 30], normal: [2, 60], hard: [4, 110] } },
  { type: 'snack', metric: (c) => cntOf(c, 'snack'), tiers: { easy: [1, 25], normal: [3, 55], hard: [6, 100] } },
  { type: 'catch', metric: (c) => cntOf(c, 'catch'), tiers: { easy: [3, 30], normal: [10, 60], hard: [25, 120] }, needs: (c) => c.toys > 0 },
  { type: 'rest', metric: (c) => c.st.restsTaken || 0, tiers: { normal: [1, 70], hard: [2, 130] } },
  { type: 'spend', metric: (c) => c.st.walletSpent || 0, tiers: { easy: [20, 25], normal: [80, 55], hard: [250, 110] } },
];
const QUEST_TIERS = ['hard', 'normal', 'easy']; // 화면에 놓는 순서도 상·중·하
const QUEST_REFRESH_MS = 3 * 60 * MIN; // 새 퀘스트로 바꿀 수 있기까지. 시간이 지나도 저절로 바뀌지는 않는다
const ALL_CLEAR_XP = 100;

const DEFAULT_STATE = {
  pokes: 0,
  pokesDay: null,
  pokesToday: 0,
  mealsTaken: 0,
  restsTaken: 0,
  mealDay: null,
  restDay: null,
  earlyDay: null,
  maxStreakMin: 0,
  pending: null, // { kind: 'meal' | 'rest', at }
  bonus: [], // { at, xp, why }
  achievements: {}, // id → 달성 시각
  items: ['none'],
  questSet: null, // 지금 퀘스트 3개 { id, at, list: [{ type, tier, target, xp, base }], claimed: [id] }
  questsDone: 0,
  attendDay: null,
  initialized: false,
  cnt: {}, // 업적용 횟수: fed snack play catch lift spam bored giant box allclear hook rename quiet quickok
  rewarded: {}, // 업적 보상을 이미 준 것: id → true
  achRetro: {}, // 첫 실행 때 예전 기록으로 소급 달성한 업적: id → true. 경험치·물건은 주지만 코인 보상은 없다
  achNoCoins: {}, // 그래서 코인 보상을 실제로 건너뛴 업적: id → true (업적 탭 표시용)
};

class Gamify extends EventEmitter {
  constructor(state, usage, getSettings, getStrings) {
    super();
    this.state = state;
    this.usage = usage;
    this.getSettings = getSettings;
    this.getStrings = getStrings;
    for (const [k, v] of Object.entries(DEFAULT_STATE)) if (state.get(k) === undefined) state.set({ [k]: structuredClone(v) });
  }

  get st() {
    return this.state.data;
  }

  // 처음 만난 시각. 출석·업적은 이 뒤의 기록만 센다 (그 전 기록은 누적 기록에서 구경만 한다)
  get since() {
    return this.st.startedAt || 0;
  }

  // 오늘 0시와 처음 만난 시각 중 늦은 쪽
  todayFrom() {
    const now = new Date();
    return Math.max(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), this.since);
  }

  // 업적용 횟수 하나 올리기
  count(key, by = 1) {
    const cnt = { ...(this.st.cnt || {}) };
    cnt[key] = (cnt[key] || 0) + by;
    this.state.set({ cnt });
    this.evaluate();
  }

  // sinceMs 이후에 받은 보너스 경험치 합계
  bonusXp(sinceMs) {
    return this.st.bonus.filter((b) => b.at >= sinceMs).reduce((a, b) => a + b.xp, 0);
  }

  // why 는 { k: i18n 키, v: 채울 값 }. 예전에 저장된 문자열도 그대로 읽힌다
  grant(xp, why) {
    this.st.bonus.push({ at: Date.now(), xp, why });
    this.state.saveSoon();
  }

  // ---------- 출석 ----------

  streaks() {
    const days = this.usage.activeDays(this.since);
    const today = new Date();
    const back = (n) => dayOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
    let current = 0;
    let i = days.has(back(0)) ? 0 : 1; // 오늘 아직 안 했으면 어제까지로 센다
    while (days.has(back(i))) {
      current++;
      i++;
    }
    let best = 0, run = 0, prev = null;
    for (const d of [...days].sort()) {
      const t = new Date(d + 'T00:00:00').getTime();
      run = prev !== null && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = t;
    }
    return { current, best, total: days.size };
  }

  // ---------- 이벤트 ----------

  poke() {
    const today = dayOf(new Date());
    if (this.st.pokesDay !== today) this.state.set({ pokesDay: today, pokesToday: 0 });
    this.state.set({ pokes: this.st.pokes + 1, pokesToday: this.st.pokesToday + 1 });
    this.evaluate();
  }

  // 밥/휴식 말풍선이 뜨면, 그 뒤 실제로 쉬고 왔는지 지켜본다
  noteBubble(kind) {
    // 밥 먹으러 갔는지는 자리 비운 시간으로 짐작할 뿐이라 세지 않는다 (2026-09-24 밥심·삼시 세끼 업적 삭제)
    if (kind === 'rest') this.state.set({ pending: { kind: 'rest', at: Date.now() } });
  }

  // 1분마다: 쉬고 왔는지, 연속 작업 최고 기록, 출석 보너스
  tick(lastActivity, streakMs) {
    const now = Date.now();
    const today = dayOf(new Date());
    const streakMin = Math.floor(streakMs / MIN);
    if (streakMin > this.st.maxStreakMin) this.state.set({ maxStreakMin: streakMin });

    const p = this.st.pending;
    if (p) {
      const need = p.kind === 'meal' ? 20 * MIN : 5 * MIN;
      const window = p.kind === 'meal' ? 150 * MIN : 60 * MIN;
      const idle = now - lastActivity;
      if (idle >= need && lastActivity <= p.at + 10 * MIN) {
        // 알림 뒤 충분히 자리를 비웠다
        if (p.kind === 'meal') this.state.set({ mealsTaken: this.st.mealsTaken + 1, mealDay: today, pending: null });
        else this.state.set({ restsTaken: this.st.restsTaken + 1, restDay: today, pending: null });
        this.emit('rested', p.kind);
      } else if (now - p.at > window) {
        this.state.set({ pending: null });
      }
    }

    const recent = lastActivity && now - lastActivity < 5 * MIN && dayOf(new Date(lastActivity)) === today;
    if (recent && this.st.attendDay !== today) {
      const { current } = this.streaks();
      const xp = 20 + Math.min(current, 14) * 5;
      this.state.set({ attendDay: today });
      if (new Date().getHours() < 10) this.state.set({ earlyDay: today });
      this.grant(xp, { k: 'bonus.attend', v: { d: current } });
      if (this.st.initialized) this.emit('attend', { streak: current, xp });
    }
    this.evaluate();
  }

  // ---------- 퀘스트 ----------

  // 퀘스트 진행도를 재는 값들 (전부 누적값)
  questCtx() {
    const x = this.extra ? this.extra() : {};
    return { all: this.usage.totals(0), st: this.st, xp: this.lastGrowth ? this.lastGrowth.xp : 0, toys: x.owned ? x.owned.toy : 0 };
  }

  // 새 퀘스트 3개: 상·중·하 하나씩, 종류는 겹치지 않게
  newQuestSet() {
    const c = this.questCtx();
    const pool = QUEST_POOL.filter((q) => !q.needs || q.needs(c));
    const used = new Set();
    const list = [];
    for (const tier of QUEST_TIERS) {
      const cand = pool.filter((q) => q.tiers[tier] && !used.has(q.type));
      if (!cand.length) continue;
      const q = cand[Math.floor(Math.random() * cand.length)];
      used.add(q.type);
      const [target, xp] = q.tiers[tier];
      list.push({ type: q.type, tier, target, xp, base: q.metric(c) });
    }
    const set = { id: Date.now().toString(36), at: Date.now(), list, claimed: [] };
    this.state.set({ questSet: set });
    return set;
  }

  // 새로고침 버튼. 받은 지 3시간이 안 됐으면 안 바꾼다
  refreshQuests() {
    if (!this.lastGrowth) return false; // 아직 기록을 읽는 중
    const set = this.st.questSet;
    if (set && Date.now() - set.at < QUEST_REFRESH_MS) return false;
    this.newQuestSet();
    this.evaluate();
    return true;
  }

  questInfo() {
    const set = this.st.questSet;
    const nextAt = set ? set.at + QUEST_REFRESH_MS : 0;
    return { at: set ? set.at : 0, nextAt, canRefresh: !!set && Date.now() >= nextAt };
  }

  quests() {
    const s = this.getSettings();
    const T = this.getStrings();
    let set = this.st.questSet;
    if (!set || !Array.isArray(set.list)) {
      // 첫 실행에 기록을 아직 읽는 중이면 기준값이 틀려서(곧 늘어날 과거 기록이 진행도로 잡힌다) 다 읽은 뒤에 뽑는다.
      // lastGrowth 는 기록을 다 읽고 나서 첫 evaluate 때 생긴다
      if (!this.lastGrowth) return [];
      set = this.newQuestSet();
    }
    const c = this.questCtx();
    return set.list.map((q) => {
      const def = QUEST_POOL.find((d) => d.type === q.type);
      const raw = def ? def.metric(c) - q.base : 0;
      const value = Math.max(0, Math.min(raw, q.target));
      const id = `${set.id}:${q.type}`;
      return {
        id,
        type: q.type,
        tier: q.tier,
        text: T.t(`quest.${q.type}`, def && def.vars ? def.vars(q.target) : { n: q.target, name: s.petName }),
        xp: q.xp,
        value,
        target: q.target,
        done: value >= q.target,
        claimed: set.claimed.includes(id),
      };
    });
  }

  // ---------- 판정 ----------

  // 업적 판정에 쓰는 값들. 상점 쪽 값(갖고 있는 것·코인)은 main 이 extra() 로 넣어 준다
  context(extra) {
    const st = this.streaks();
    const since = this.since;
    const today = this.usage.totals(this.todayFrom());
    const weekend = [...this.usage.activeDays(since)].filter((d) => [0, 6].includes(new Date(d + 'T00:00:00').getDay())).length;
    const shopSide = this.extra ? this.extra() : {};
    return {
      all: this.usage.totals(since), today, hours: this.usage.hours(since), bestStreak: st.best, best: st.best, days: st.total, weekend,
      use: this.usage.obsidianUse ? this.usage.obsidianUse(since) : {},
      st: this.st, owned: { acc: 0, motion: 0, toy: 0 }, totalAcc: 1, totalToy: 1, bought: 0, spent: 0, earned: 0, balance: 0,
      ...shopSide, ...extra,
    };
  }

  // growth = { level, stageIndex }. silent 이면 알림 없이 조용히 달성만 기록한다 (첫 실행 소급 적용)
  evaluate(growth = this.lastGrowth, silent = !this.st.initialized) {
    if (!growth) return;
    this.lastGrowth = growth;
    const T = this.getStrings();
    const c = this.context({ level: growth.level, stageIndex: growth.stageIndex });
    const events = [];

    for (const a of ACHIEVEMENTS) {
      if (this.st.achievements[a.id] || !a.check(c)) continue;
      this.st.achievements[a.id] = Date.now();
      if (silent) this.state.set({ achRetro: { ...(this.st.achRetro || {}), [a.id]: true } });
      this.grant(a.xp, { k: 'bonus.ach', v: { name: T.t(`ach.${a.id}.name`) } });
      events.push({ type: 'achievement', achievement: a, reward: this.payReward(a) });
    }
    // 예전 버전에서 이미 달성했던 업적도 보상은 챙겨 준다
    for (const a of ACHIEVEMENTS) if (this.st.achievements[a.id] && !(this.st.rewarded || {})[a.id]) this.payReward(a);

    for (const q of this.quests()) {
      if (!q.done || q.claimed) continue;
      const set = this.st.questSet;
      set.claimed.push(q.id);
      this.state.set({ questsDone: this.st.questsDone + 1 });
      this.grant(q.xp, { k: 'bonus.quest', v: { text: q.text } });
      events.push({ type: 'quest', quest: q });
      if (set.claimed.length === set.list.length) {
        this.state.set({ cnt: { ...(this.st.cnt || {}), allclear: ((this.st.cnt || {}).allclear || 0) + 1 } });
        this.grant(ALL_CLEAR_XP, { k: 'bonus.allclear', v: {} });
        events.push({ type: 'allclear', xp: ALL_CLEAR_XP });
      }
    }

    if (events.length) this.state.saveSoon();
    if (silent) {
      (this.retroEvents ||= []).push(...events);
      return;
    }
    // 한꺼번에 여러 개 풀리면 (업데이트 뒤 지난 기록을 다시 읽었을 때 등) 말풍선 폭탄 대신 한 번에 묶어 알린다
    const achs = events.filter((e) => e.type === 'achievement');
    if (achs.length > 3) {
      this.emit('retro', achs);
      for (const e of events) if (e.type !== 'achievement') this.emit('unlock', e);
      return;
    }
    for (const e of events) this.emit('unlock', e);
  }

  // 소급 달성한 업적인가. 첫 실행 때 조용히 풀린 것 + 처음 만난 시각보다 먼저 풀린 것
  isRetro(id) {
    const at = this.st.achievements[id];
    return !!(this.st.achRetro || {})[id] || (!!at && at < this.since);
  }

  // 업적 보상 주기 (한 번만). 실제로 창고·옷장에 넣는 건 main 이 건네준 rewarder 가 한다
  // 소급 달성한 업적의 코인 보상은 주지 않는다 (받은 걸로만 표시). 이미 받은 코인은 그대로 둔다
  payReward(a) {
    if ((this.st.rewarded || {})[a.id] || !this.rewarder) return null;
    this.state.set({ rewarded: { ...(this.st.rewarded || {}), [a.id]: true } });
    if (a.reward && a.reward.coins && this.isRetro(a.id)) {
      this.state.set({ achNoCoins: { ...(this.st.achNoCoins || {}), [a.id]: true } });
      return null;
    }
    return this.rewarder(a.reward);
  }

  finishInit() {
    if (this.st.initialized) return;
    this.state.set({ initialized: true });
    if (this.retroEvents && this.retroEvents.length) this.emit('retro', this.retroEvents);
    this.retroEvents = [];
  }

  summary() {
    const T = this.getStrings();
    const c = this.lastGrowth ? this.context({ level: this.lastGrowth.level, stageIndex: this.lastGrowth.stageIndex }) : null;
    return {
      achCats: CATS,
      achTiers: TIERS,
      achievements: ACHIEVEMENTS.map((a) => ({
        id: a.id, icon: a.icon, xp: a.xp, cat: a.cat, tier: a.tier, reward: a.reward,
        name: T.t(`ach.${a.id}.name`),
        desc: T.t(`ach.${a.id}.desc`),
        unlockedAt: this.st.achievements[a.id] || null,
        // 소급 달성이라 코인 보상을 못 받았다 (예전에 이미 받은 사람은 받은 것으로 친다)
        noCoins: !!(this.st.achNoCoins || {})[a.id],
        progress: c && a.progress ? a.progress(c) : null,
      })),
      items: ITEMS.map((it) => ({
        key: it.key,
        price: it.price,
        slot: it.slot || null,
        covers: it.covers || null,
        name: T.t(`item.${it.key}`),
        unlocked: this.st.items.includes(it.key) || !!this.getSettings().devMode, // 개발자 모드면 전부 (배포 전에 지운다)
      })),
      quests: this.quests(),
      questInfo: this.questInfo(),
      allClearXp: ALL_CLEAR_XP,
      streak: this.streaks(),
      pokes: this.st.pokes,
      questsDone: this.st.questsDone,
      recentBonus: this.st.bonus.slice(-8).reverse(),
    };
  }
}

module.exports = { Gamify, ITEMS, ACHIEVEMENTS, CATS, TIERS };
