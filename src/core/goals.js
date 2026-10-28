// 하루 목표 · 집중 시간 (1.5.0, 옵시디언판에만 있다).
//
// 하루 목표: "오늘 300단어" 처럼 날마다 쓸 양을 정해 두면, 다 채운 순간 고양이가 축하하고 코인 · 경험치를 준다.
//  - 영어는 단어, 한국어 · 중국어는 글자로 센다 (settings.goal.unit). 세는 기준은 경험치와 같다 (새로 쓴 글만, 붙여넣기 빼고)
//  - 채운 날은 state.goalLog 에 남는다. 이어서 채운 날 수(목표 연속)는 출석과 따로 센다
// 집중 시간: 15 · 25 · 50분 타이머. 그동안 고양이는 말을 아끼고(방해 금지) 머리 위에 남은 시간을 띄운다.
//  다 마치면 축하 + 코인 · 경험치. 중간에 그만둬도 벌은 없다
// 쉬는 시간 (2.0.0): 집중을 마치면 홈에서 5분 · 10분 쉬기를 이어서 켤 수 있다 (상은 없다. 끝나면 고양이가 다시 하자고 한다)
const { dayOf } = require('./usage');

const MIN = 60_000;
const DAY = 86_400_000;
const UNITS = ['words', 'chars'];
// 처음 정해 주는 목표 (언어마다). 부담 없이 첫날부터 채울 수 있는 양으로
const GOAL_DEFAULT = {
  en: { unit: 'words', target: 300 },
  ko: { unit: 'chars', target: 1000 },
  zh: { unit: 'chars', target: 500 },
};
// 하우스 · 첫 실행 · 설정에서 고르는 목표 (단위마다)
const GOAL_PRESETS = { words: [100, 300, 500, 1000, 1667], chars: [300, 1000, 2000, 5000] };
const GOAL_RANGE = { words: [10, 20_000], chars: [30, 100_000] };
const GOAL_COINS = 100;
const GOAL_XP = 50;
const GOAL_LOG_KEEP = 400; // 날짜 기록은 400일치까지

const FOCUS_LENGTHS = [15, 25, 50];
const BREAK_LENGTHS = [5, 10];
const FOCUS_COINS_PER_MIN = 2; // 25분 = 50코인
const FOCUS_XP_PER_MIN = 1; // 25분 = 25 XP
// 옵시디언을 껐다 켰는데 끝날 시각이 이만큼 넘게 지났으면 (끝까지 했는지 모르니) 상 없이 조용히 접는다
const FOCUS_STALE = 10 * MIN;

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

// settings.goal 을 고른다. null(예전 사용자 · 처음 설치)이면 언어에 맞는 기본값. 모양이 이상하면 기본값으로
function goalConfig(raw, lang) {
  const def = GOAL_DEFAULT[lang] || GOAL_DEFAULT.en;
  const g = raw && typeof raw === 'object' ? raw : {};
  const unit = UNITS.includes(g.unit) ? g.unit : def.unit;
  const [lo, hi] = GOAL_RANGE[unit];
  const target = Number.isFinite(Number(g.target)) && Number(g.target) > 0 ? clampInt(Number(g.target), lo, hi) : unit === def.unit ? def.target : GOAL_DEFAULT[unit === 'words' ? 'en' : 'ko'].target;
  return { on: g.on !== false, unit, target };
}

// 하우스 · 설정이 보내온 goal 값을 거른다 (모르는 키 · 이상한 값은 버린다). 못 쓰면 null
function cleanGoal(raw, lang) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return goalConfig(raw, lang);
}

class Goals {
  // state/settings 는 Store, usage 는 UsageTracker
  constructor(state, settings, usage) {
    this.state = state;
    this.settings = settings;
    this.usage = usage;
  }

  config() {
    return goalConfig(this.settings.get('goal'), this.settings.get('language'));
  }

  log() {
    return this.state.get('goalLog') || {};
  }

  // 오늘 쓴 양 (목표 단위로)
  todayValue(cfg = this.config()) {
    const t = this.usage.today();
    return cfg.unit === 'words' ? t.w || 0 : t.c || 0;
  }

  // 목표를 채운 날이 이어진 수. 오늘 아직 못 채웠으면 어제까지로 센다 (출석과 같은 셈)
  streaks(now = new Date()) {
    const log = this.log();
    const back = (n) => dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
    let current = 0;
    let i = log[back(0)] ? 0 : 1;
    while (log[back(i)]) {
      current++;
      i++;
    }
    let best = 0;
    let run = 0;
    let prev = null;
    for (const d of Object.keys(log).sort()) {
      const [y, m, dd] = d.split('-').map(Number);
      const t = new Date(y, m - 1, dd).getTime();
      run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = t;
    }
    return { current, best, total: Object.keys(log).length };
  }

  // 하우스 · 상태 표시줄이 그리는 오늘의 목표
  progress(now = new Date()) {
    const cfg = this.config();
    const value = this.todayValue(cfg);
    const done = !!this.log()[dayOf(now)];
    // 최근 7일: 채운 날 표시 (하우스의 작은 점 일곱 개)
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
      week.push({ day: d, done: !!this.log()[d] });
    }
    return { ...cfg, value, pct: Math.min(1, value / cfg.target), done, left: Math.max(0, cfg.target - value), ...this.streaks(now), week, coins: GOAL_COINS, xp: GOAL_XP, presets: GOAL_PRESETS[cfg.unit] };
  }

  // 오늘 목표를 막 채웠으면 기록하고 { streak, target, unit } 을 돌려준다. 이미 채웠거나 아직이면 null
  check(now = new Date()) {
    const cfg = this.config();
    if (!cfg.on) return null;
    const day = dayOf(now);
    const log = this.log();
    if (log[day] || this.todayValue(cfg) < cfg.target) return null;
    const next = { ...log, [day]: cfg.target };
    const keys = Object.keys(next).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - GOAL_LOG_KEEP))) delete next[k];
    this.state.set({ goalLog: next });
    return { ...cfg, streak: this.streaks(now).current };
  }

  /* ── 집중 시간 ── */

  focusLength() {
    const m = Number(this.settings.get('focusMin'));
    return FOCUS_LENGTHS.includes(m) ? m : 25;
  }

  // 지금 집중 중이면 { on, min, start, end, left(ms) }
  focusInfo(now = Date.now()) {
    const f = this.state.get('focus');
    const b = this.state.get('focusBreak');
    const brk = b && b.end > now ? { min: b.min, end: b.end, left: b.end - now } : null;
    const base = { lengths: FOCUS_LENGTHS, breaks: BREAK_LENGTHS, total: this.focusTotal(now), brk };
    if (!f || !f.end) return { on: false, min: this.focusLength(), ...base };
    return { on: true, min: f.min, start: f.start, end: f.end, left: Math.max(0, f.end - now), ...base };
  }

  // 지금까지 마친 집중 시간 + 오늘 마친 횟수 · 분 (2.0.0)
  focusTotal(now = Date.now()) {
    const st = this.state.get('focusStats') || {};
    const today = st.day === dayOf(new Date(now));
    return { sessions: st.n || 0, minutes: st.min || 0, today: today ? st.todayN || 0 : 0, todayMin: today ? st.todayMin || 0 : 0, lastAt: st.last || 0 };
  }

  // 쉬는 시간 시작 · 그만두기 · 끝났나 (2.0.0). 집중 중이면 쉬기를 켜지 않는다
  breakStart(min, now = Date.now()) {
    if (this.focusInfo(now).on) return null;
    const m = BREAK_LENGTHS.includes(Number(min)) ? Number(min) : BREAK_LENGTHS[0];
    const b = { min: m, start: now, end: now + m * MIN };
    this.state.set({ focusBreak: b });
    return b;
  }

  breakStop() {
    const b = this.state.get('focusBreak');
    this.state.set({ focusBreak: null });
    return b && b.end ? b : null;
  }

  // 쉬는 시간이 막 끝났으면 { min } (너무 오래 지났으면 조용히 접어서 null)
  breakTick(now = Date.now()) {
    const b = this.state.get('focusBreak');
    if (!b || !b.end || now < b.end) return null;
    this.state.set({ focusBreak: null });
    return now - b.end > FOCUS_STALE ? null : { min: b.min };
  }

  focusStart(min, now = Date.now()) {
    const m = FOCUS_LENGTHS.includes(Number(min)) ? Number(min) : this.focusLength();
    const f = { min: m, start: now, end: now + m * MIN };
    this.state.set({ focus: f, focusBreak: null });
    return f;
  }

  // 그만두기. 집중 중이었으면 그 기록을 돌려준다
  focusStop() {
    const f = this.state.get('focus');
    this.state.set({ focus: null });
    return f && f.end ? f : null;
  }

  // 끝날 시각이 됐으면 마치고 { min, coins, xp } 를 돌려준다. 너무 오래 지났으면(꺼져 있던 동안) { stale: true }
  focusTick(now = Date.now()) {
    const f = this.state.get('focus');
    if (!f || !f.end || now < f.end) return null;
    this.state.set({ focus: null });
    if (now - f.end > FOCUS_STALE) return { stale: true, min: f.min };
    const st = this.state.get('focusStats') || {};
    const day = dayOf(new Date(now));
    const same = st.day === day;
    this.state.set({ focusStats: { ...st, n: (st.n || 0) + 1, min: (st.min || 0) + f.min, last: now, day, todayN: (same ? st.todayN || 0 : 0) + 1, todayMin: (same ? st.todayMin || 0 : 0) + f.min } });
    return { min: f.min, coins: f.min * FOCUS_COINS_PER_MIN, xp: f.min * FOCUS_XP_PER_MIN };
  }
}

module.exports = { Goals, goalConfig, cleanGoal, GOAL_DEFAULT, GOAL_PRESETS, GOAL_RANGE, GOAL_COINS, GOAL_XP, FOCUS_LENGTHS, BREAK_LENGTHS, FOCUS_COINS_PER_MIN, FOCUS_XP_PER_MIN, FOCUS_STALE, UNITS };
