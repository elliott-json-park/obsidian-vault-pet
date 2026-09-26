// 펫의 기분(애니메이션 상태)과 말풍선을 정한다.
// 입력: 옵시디언 활동 시각(글쓰기 기록 + 플러그인이 흉내 내는 hook 이벤트), 현재 시각, 설정.
// 옵시디언판에서 hook 이벤트는 이렇게 온다 (plugin/host.js):
//  SessionStart     = 30분 넘게 쉬었다가 다시 쓰기 시작
//  UserPromptSubmit = 타이핑 시작 (그동안 노트북을 꺼내 같이 쓴다)
//  Stop             = 한 차례 쓰기를 마치고 20초 넘게 손을 뗌
//  Notification     = 새로 만든 빈 노트가 한참 비어 있음 (느낌표를 띄우고 기다린다)
const { EventEmitter } = require('events');

const MIN = 60_000;
const STREAK_GAP = 20 * MIN; // 이만큼 쉬면 연속 작업 시간이 초기화된다

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function minutesOfDay(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// 하루는 동그라니까 자정을 넘는 구간도 재야 한다.
// start 부터 len 분 동안의 구간에 now 가 들어 있나?
function inWindow(now, start, len) {
  const d = (now - start + 1440) % 1440;
  return d >= 0 && d < len;
}

// 몇 시인지 말로: 한국어는 '새벽 1'·'밤 11', 영어는 '1 AM'·'11 PM' (뒤에 '시'·'…' 는 대사에서 붙인다)
function hourLabel(lang, h) {
  if (lang === 'ko') return h === 0 ? '밤 12' : h < 6 ? `새벽 ${h}` : h < 12 ? `아침 ${h}` : h < 18 ? `오후 ${h === 12 ? 12 : h - 12}` : `밤 ${h - 12}`;
  return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
}

function formatDuration(T, ms) {
  const total = Math.round(ms / MIN);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return T.t('dur.m', { m });
  return m === 0 ? T.t('dur.h', { h }) : T.t('dur.hm', { h, m });
}

class Brain extends EventEmitter {
  // getStrings() → renderer/i18n.js 의 Strings. 언어·성격이 바뀌면 그때그때 새 값을 준다
  constructor(getSettings, getStats, getStrings) {
    super();
    this.getSettings = getSettings;
    this.getStats = getStats;
    this.getStrings = getStrings;
    this.lastActivity = 0;
    this.streakStart = 0;
    this.generating = 0;
    this.waiting = 0;
    this.lastHookAt = 0;
    this.mood = 'idle';
    this.daily = {}; // 하루에 한 번만 하는 말: key → dayKey
    this.cooldown = {}; // key → 다시 말할 수 있는 시각
    this.nextChatter = Date.now() + 20 * MIN;
    this.promptAt = {}; // 세션 → 질문을 보낸 시각 (답이 얼마나 걸렸나 재려고)
    this.waitNagged = false; // Claude 가 기다린 지 5분 넘었다고 한 번 더 말했나
    this.systemIdle = () => 0; // 키보드·마우스를 안 만진 초. main 이 electron powerMonitor 로 넣어 준다

    // 하루 리듬. life 는 main 이 state.json 에서 넣어 주고, 바뀌면 'life' 이벤트로 알린다
    this.life = { hungrySince: 0, fedAt: 0 };
  }

  // 배고픈가? 밥때 알림이 떴는데 아직 안 먹였으면 배고프다 (4시간 지나면 스스로 포기한다)
  hungry(now = Date.now()) {
    const h = this.life.hungrySince;
    return !!h && now - h < 4 * 60 * MIN;
  }

  // 방금 밥을 먹었나? (먹고 나서 잠깐은 배부른 티를 낸다)
  justFed(now = Date.now()) {
    return !!this.life.fedAt && now - this.life.fedAt < 3 * MIN;
  }

  // 밥때가 됐다고 표시한다 (알림이 떴을 때)
  getHungry(at = Date.now()) {
    if (this.hungry(at)) return;
    this.life = { ...this.life, hungrySince: at };
    this.emit('life', this.life);
  }

  // 바닥에 떨어진 밥을 주워 먹었다. 배를 채우고, 조금 있다가 발 핥고 세수한다.
  // 먹을 때 대사는 main 이 먹은 것 이름을 넣어서 띄운다
  meal(at = Date.now()) {
    const T = this.getStrings();
    this.life = { hungrySince: 0, fedAt: at };
    this.emit('life', this.life);
    clearTimeout(this.groomTimer);
    this.groomTimer = setTimeout(() => {
      this.emit('action', 'lick');
      this.say(T.line('groom'), 'groom');
    }, 5200);
  }

  // 간식을 주워 먹었다. 배는 거의 안 차지만(배고픔은 그대로) 기분이 확 좋아져서
  // 한동안은 밥 달라고 조르지 않는다
  treat(at = Date.now()) {
    this.emit('action', 'happy');
    if (this.hungry(at)) this.cooldown.hungry = Math.max(this.cooldown.hungry || 0, at + 20 * MIN);
  }

  // 설정한 취침 시간을 분으로. 없으면 새벽 1시
  bedMinutes() {
    const s = this.getSettings();
    return minutesOfDay(s.bedtime || '01:00');
  }

  // 지금 이어지고 있는 연속 작업 시간(ms)
  streakMs(now = Date.now()) {
    return this.streakStart && now - this.lastActivity < 10 * MIN ? now - this.streakStart : 0;
  }

  // 자는데 자꾸 건드려서 깼다. 5분은 깨어 있는다
  wake(at = Date.now()) {
    this.wokenUntil = at + 5 * MIN;
    this.tick();
  }

  // 사용자가 Claude Code 를 쓰고 있다는 신호
  activity(t = Date.now()) {
    if (t <= this.lastActivity) return;
    const wasAsleep = this.mood === 'sleeping' || this.mood === 'sleepy';
    // 얼마나 안 왔었는지. greet 이 '오랜만'인지 판단하는 데 쓴다
    this.awayMs = this.lastActivity ? t - this.lastActivity : 0;
    if (!this.lastActivity || t - this.lastActivity > STREAK_GAP) this.streakStart = t;
    this.lastActivity = t;
    if (Date.now() - t < 5 * MIN) this.greet(wasAsleep);
  }

  hook(evt) {
    this.lastHookAt = evt.at;
    const s = this.getSettings();
    const T = this.getStrings();
    switch (evt.name) {
      case 'SessionStart': {
        this.activity(evt.at);
        this.emit('action', 'wave');
        // 새 세션 · 이어 하기 · /clear · 대화 압축을 구분해서 늘 말한다. 세션 여러 개가 한꺼번에 열려도 1분에 한 번만
        const kind = { resume: 'sessionResume', clear: 'sessionClear', compact: 'sessionCompact' }[evt.source] || 'session';
        if (this.ready('session', MIN)) this.say(T.line(kind, { name: s.petName }), 'session');
        break;
      }
      case 'UserPromptSubmit':
        this.activity(evt.at);
        this.generating = evt.at;
        this.waiting = 0;
        this.waitNagged = false;
        this.promptAt[evt.sessionId || '-'] = evt.at;
        break;
      case 'Stop': {
        this.activity(evt.at);
        this.generating = 0;
        this.waiting = 0;
        this.emit('action', 'slot:done'); // 설정에서 고른 '답을 끝냈을 때' 모션
        // 10분 넘게 쭉 썼으면 그 시간을 말해 준다. 아니면 가끔만 한마디
        const from = this.promptAt[evt.sessionId || '-'];
        delete this.promptAt[evt.sessionId || '-'];
        const took = from ? evt.at - from : 0;
        if (took >= 10 * MIN && this.ready('stopLong', 30 * MIN)) this.say(T.line('stopLong', { dur: formatDuration(T, took) }), 'stop');
        else if (Math.random() < 0.08 && this.ready('stop', 10 * MIN)) this.say(T.line('stop'), 'stop');
        break;
      }
      case 'Notification': {
        // 알림 내용으로 허락 요청(어떤 도구인지)과 입력 기다림을 나눈다. 로그인 성공 같은 알림은 조용히
        const msg = evt.message || '';
        const type = evt.notificationType || (/permission/i.test(msg) ? 'permission_prompt' : /waiting for your input/i.test(msg) ? 'idle_prompt' : '');
        if (type === 'auth_success') break;
        this.waiting = evt.at;
        this.waitNagged = false;
        this.emit('action', 'wave');
        const tool = (msg.match(/permission to use ([\w.:-]+)/i) || [])[1];
        const kind = type === 'permission_prompt' ? 'notifyPermission' : type === 'idle_prompt' ? 'notifyIdle' : 'notify';
        if (this.ready('notify:' + (evt.sessionId || '-'), 30_000)) this.say(T.line(kind, { tool }), 'notify');
        break;
      }
      case 'SessionEnd':
        this.generating = 0;
        this.waiting = 0;
        if (Math.random() < 0.5) this.say(T.line('end'), 'end');
        break;
    }
    this.tick();
  }

  // 허락한 도구가 돌기 시작했다 (대화 기록에 도구 결과가 붙었다) = 더는 기다리는 게 아니다
  answered() {
    this.waiting = 0;
    this.waitNagged = false;
  }

  say(text, kind) {
    this.emit('bubble', { text, kind });
  }

  ready(key, cooldownMs) {
    const now = Date.now();
    if ((this.cooldown[key] || 0) > now) return false;
    this.cooldown[key] = now + cooldownMs;
    return true;
  }

  once(key, date = new Date()) {
    const d = dayKey(date);
    if (this.daily[key] === d) return false;
    this.daily[key] = d;
    return true;
  }

  greet(fromSleep) {
    const T = this.getStrings();
    const now = new Date();
    const h = now.getHours();
    // 하루 넘게 안 왔다가 돌아왔으면 그게 제일 먼저다
    if (this.awayMs > 20 * 60 * MIN && this.ready('welcomeBack', 6 * 60 * MIN)) {
      this.awayMs = 0;
      this.emit('action', 'happy');
      this.say(T.line('welcomeBack'), 'greet');
      return;
    }
    if (h >= 5 && h < 11 && this.once('morning', now)) {
      this.emit('action', 'wave');
      this.say(T.line('greetMorning'), 'greet');
    } else if (fromSleep && this.ready('greet', 30 * MIN)) {
      this.emit('action', 'wave');
      this.say(T.line('greetWake'), 'greet');
    }
  }

  // 5초마다 불린다
  tick() {
    const s = this.getSettings();
    const T = this.getStrings();
    const now = Date.now();
    const d = new Date(now);
    const idle = this.lastActivity ? now - this.lastActivity : Infinity;
    const hooksLive = now - this.lastHookAt < 6 * 60 * MIN;

    const minuteNow = d.getHours() * 60 + d.getMinutes();
    const bed = this.bedMinutes();
    // 잘 시간 30분 전부터 취침 시간까지는 꾸벅꾸벅
    const drowsyHour = inWindow(minuteNow, (bed - 30 + 1440) % 1440, 30);
    // 취침 시간이 지나고도 4시간 안이면 '이 시간까지 안 자?' 구간
    const pastBed = inWindow(minuteNow, bed, 4 * 60);

    let mood;
    // 자꾸 건드려서 깨웠으면 한동안은 졸거나 자지 않는다 (wake())
    const woken = now < (this.wokenUntil || 0);
    if (this.waiting && now - this.waiting < 10 * MIN) mood = 'waiting';
    else if (hooksLive ? this.generating && now - this.generating < 20 * MIN : idle < 45_000) mood = 'thinking';
    else if (this.justFed(now)) mood = 'idle';
    else if (this.hungry(now) && idle < 30 * MIN) mood = 'hungry';
    else if (idle < 5 * MIN) mood = drowsyHour ? 'sleepy' : 'active';
    else if (idle < s.sleepyAfterMin * MIN) mood = drowsyHour ? 'sleepy' : 'idle';
    else if (idle < s.sleepAfterMin * MIN) mood = 'sleepy';
    else mood = 'sleeping';
    if (woken && (mood === 'sleepy' || mood === 'sleeping')) mood = 'idle';

    if (mood !== this.mood) {
      this.mood = mood;
      this.emit('mood', mood);
    }

    const present = idle < 30 * MIN;
    const minute = d.getHours() * 60 + d.getMinutes();

    // Claude 가 5분 넘게 대답을 기다리고 있으면 한 번 더 부른다 (10분이 지나면 기다리는 표정도 끝나니 그만)
    if (this.waiting && !this.waitNagged && now - this.waiting > 5 * MIN && now - this.waiting < 10 * MIN) {
      this.waitNagged = true;
      this.emit('action', 'wave');
      this.say(T.line('notifyAgain'), 'notify');
      return;
    }

    for (const meal of [
      { key: 'lunch', on: s.lunchEnabled, at: s.lunchTime },
      { key: 'dinner', on: s.dinnerEnabled, at: s.dinnerTime },
    ]) {
      const start = minutesOfDay(meal.at);
      if (meal.on && present && minute >= start && minute < start + 70 && this.once(meal.key, d)) {
        this.getHungry(now);
        this.emit('action', 'eat');
        this.say(T.line(meal.key), meal.key);
        return;
      }
    }

    // 배고픈 채로 방치되면 20분마다 한 번씩 조른다. 한 시간을 넘기면 더 처절해진다
    if (this.hungry(now) && present && this.ready('hungry', 20 * MIN)) {
      const starving = now - this.life.hungrySince > 60 * MIN;
      this.emit('action', 'slot:hungry');
      this.say(T.line(starving ? 'starving' : 'hungry'), 'hungry');
      return;
    }

    const streak = this.streakMs(now);
    if (streak >= s.restAfterMin * MIN && this.ready('rest', 60 * MIN)) {
      this.emit('action', 'slot:rest');
      this.say(T.line('rest', { dur: formatDuration(T, streak) }), 'rest');
      return;
    }

    const h = d.getHours();
    if (s.lateNightEnabled && pastBed && idle < 10 * MIN && this.ready('late', 50 * MIN)) {
      this.emit('action', 'yawn');
      this.say(T.line('late', { h, hl: hourLabel(T.lang, h) }), 'late');
      return;
    }

    // 잘 시간이 가까워지면 하품하며 슬슬 접자고 한다
    if (s.lateNightEnabled && drowsyHour && idle < 10 * MIN && this.ready('drowsy', 40 * MIN)) {
      this.emit('action', 'yawn');
      this.say(T.line('drowsy'), 'drowsy');
      return;
    }

    // AI 활용 팁: 하루 5번까지, 90분에 한 번. 20분쯤 이어서 일하고 있을 때 (설정 '가끔 AI 활용 팁'으로 끈다)
    const [tipDay, tipN] = String(this.daily.tips || '').split('|');
    const tipsToday = tipDay === dayKey(d) ? Number(tipN) || 0 : 0;
    if (s.aiTips !== false && mood === 'active' && streak >= 20 * MIN && tipsToday < 5 && this.ready('tip', 90 * MIN)) {
      this.daily.tips = `${dayKey(d)}|${tipsToday + 1}`;
      this.say(T.line('tip'), 'tip'); // 말풍선 앞에 Claude 생각 중 아이콘 (renderer/pet.js BUBBLE_ICON)
      return;
    }

    if (s.chatter && mood === 'active' && now > this.nextChatter) {
      this.nextChatter = now + (25 + Math.random() * 25) * MIN;
      // 하루 한 번, 밤늦게까지 일하거나 한 시간 반 넘게 달렸으면 위로 한마디 (두세 번에 나눠 말한다)
      if ((h >= 21 || h < 5 || streak >= 90 * MIN) && this.once('comfort', d)) {
        this.say(T.line('comfortTalk'), 'chatter');
        return;
      }
      const t = this.getStats().today;
      // 일 얘기만 하면 뻔하다. 절반쯤은 딴생각을 말한다
      this.say(T.line(Math.random() < 0.45 ? 'muse' : 'chatter', { m: (t.c || 0).toLocaleString() }), 'chatter');
    }
  }
}

module.exports = { Brain };
