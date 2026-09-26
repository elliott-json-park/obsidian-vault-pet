// 업적. 킷커밋 데스크톱판의 업적표를 옵시디언에 맞게 옮겼다 (대화·세션·토큰·Claude 활용 → 글쓰기·링크·새 노트·세션·옵시디언 활용).
// 보상 아이템은 데스크톱판과 똑같이 둬서, 모든 코스튬·모션을 여기서도 얻을 수 있다.
//  tier   : easy · normal · hard · legend
//  reward : { food: { 키: 개수 } } · { item: 키 } · { coins: n }. 이미 갖고 있는 아이템이면 그 값만큼 코인으로 준다
//  c 는 gamify.js 의 context(): c.all{c,l,n,s,v,e} 누적 · c.today 오늘 · c.hours[0..23] 시각별 기록 횟수 · c.use(usage.obsidianUse) · c.maxBacklinks
// 이름·설명은 i18n 의 ach.<id>.name / ach.<id>.desc, icon 은 pixelart.js 의 도트 이름.
const { TREASURES } = require('./treasure');

const XP = { easy: 50, normal: 150, hard: 400, legend: 1000 };
const n = (c, k) => (c.st.cnt && c.st.cnt[k]) || 0;
// 옵시디언 활용 기록 (usage.obsidianUse)
const U = (c) => c.use || {};
const feat = (c, ...keys) => keys.reduce((a, k) => a + ((U(c).feat || {})[k] || 0), 0);
// 써 본 옵시디언 기능 가짓수: 링크 · 태그 · 할 일 끝내기 · 제목 · 임베드 · 콜아웃 · 데일리 노트 · 캔버스
const FEATURES8 = (c) => [c.all.l > 0, ...['tag', 'done', 'head', 'embed', 'callout', 'daily', 'canvas'].map((k) => feat(c, k) > 0)].filter(Boolean).length;
const COIN = { normal: { coins: 250 }, hard: { coins: 700 }, legend: { coins: 2000 } };

// [id, 묶음, 난이도, 아이콘, 조건, 목표치(진행 막대), 보상]
const RAW = [
  // ---------- 글쓰기 (쓴 글자) ----------
  ['write_1', 'write', 'easy', 'scroll', (c) => c.all.c, 1, { food: { milk: 2 } }],
  ['write_100', 'write', 'easy', 'scroll', (c) => c.all.c, 100, { food: { churu: 2 } }],
  ['write_1k', 'write', 'easy', 'scroll', (c) => c.all.c, 1000, { food: { tuna: 2 } }],
  ['write_10k', 'write', 'normal', 'scroll', (c) => c.all.c, 1e4, { item: 'sprout' }],
  ['write_30k', 'write', 'normal', 'scroll', (c) => c.all.c, 3e4, { item: 'hiccup' }],
  ['write_100k', 'write', 'hard', 'map', (c) => c.all.c, 1e5, { item: 'glasses' }],
  ['write_300k', 'write', 'hard', 'heart', (c) => c.all.c, 3e5, { item: 'karaoke' }],
  ['write_1m', 'write', 'hard', 'heart', (c) => c.all.c, 1e6, { item: 'headphones' }],
  ['write_3m', 'write', 'legend', 'trophy', (c) => c.all.c, 3e6, { item: 'aura' }],
  ['write_10m', 'write', 'legend', 'trophy', (c) => c.all.c, 1e7, { item: 'crown' }],
  ['day_write_3k', 'write', 'normal', 'fire', (c) => c.today.c, 3000, { item: 'trophy' }],
  ['day_write_10k', 'write', 'legend', 'fire', (c) => c.today.c, 1e4, { item: 'explode' }],
  ['day_write_20k', 'write', 'legend', 'moneybag', (c) => c.today.c, 2e4, COIN.legend],
  ['edit_10000', 'write', 'hard', 'chats', (c) => c.all.e || 0, 10000, COIN.hard],
  ['edit_50000', 'write', 'legend', 'chats', (c) => c.all.e || 0, 50000, COIN.legend],

  // ---------- 링크 ----------
  ['link_1', 'link', 'easy', 'pin', (c) => c.all.l, 1, { food: { churu: 3 } }],
  ['link_30', 'link', 'easy', 'pin', (c) => c.all.l, 30, { food: { chicken: 2 } }],
  ['link_100', 'link', 'normal', 'pin', (c) => c.all.l, 100, { item: 'nerd' }],
  ['link_300', 'link', 'normal', 'map', (c) => c.all.l, 300, { item: 'codefrenzy' }],
  ['link_1000', 'link', 'hard', 'map', (c) => c.all.l, 1000, { item: 'chef' }],
  ['link_3000', 'link', 'hard', 'gem', (c) => c.all.l, 3000, { item: 'levelbanner' }],
  ['link_10000', 'link', 'legend', 'gem', (c) => c.all.l, 1e4, { item: 'halo' }],
  ['link_30000', 'link', 'legend', 'gem', (c) => c.all.l, 3e4, { item: 'rocket' }],
  ['day_link_50', 'link', 'hard', 'fire', (c) => c.today.l, 50, { item: 'propeller' }],
  ['hub_20', 'link', 'hard', 'home', (c) => c.maxBacklinks || 0, 20, COIN.hard],
  ['hub_50', 'link', 'legend', 'home', (c) => c.maxBacklinks || 0, 50, COIN.legend],

  // ---------- 새 노트 ----------
  ['note_1', 'note', 'easy', 'scroll', (c) => c.all.n, 1, { food: { pouch: 2 } }],
  ['note_10', 'note', 'easy', 'scroll', (c) => c.all.n, 10, { food: { tuna: 1 } }],
  ['note_50', 'note', 'normal', 'scroll', (c) => c.all.n, 50, COIN.normal],
  ['note_200', 'note', 'hard', 'map', (c) => c.all.n, 200, COIN.hard],
  ['note_1000', 'note', 'legend', 'map', (c) => c.all.n, 1000, COIN.legend],
  ['day_note_10', 'note', 'hard', 'fire', (c) => c.today.n, 10, COIN.hard],

  // ---------- 글쓰기 세션 ----------
  ['first_session', 'session', 'easy', 'wave', (c) => c.all.s, 1, { food: { milk: 3 } }],
  ['sess_10', 'session', 'easy', 'door', (c) => c.all.s, 10, { food: { pouch: 2 } }],
  ['sess_50', 'session', 'normal', 'door', (c) => c.all.s, 50, { item: 'tuxedo' }],
  ['sess_100', 'session', 'normal', 'door', (c) => c.all.s, 100, { item: 'monitors' }],
  ['sess_300', 'session', 'hard', 'home', (c) => c.all.s, 300, { item: 'tophat' }],
  ['sess_700', 'session', 'hard', 'home', (c) => c.all.s, 700, { item: 'codeflame' }],
  ['sess_1500', 'session', 'legend', 'home', (c) => c.all.s, 1500, { item: 'wizard' }],
  ['day_sess_5', 'session', 'normal', 'door', (c) => c.today.s, 5, { item: 'papers' }],

  // ---------- 코인 ----------
  ['coins_10k', 'token', 'normal', 'coin', (c) => c.earned, 10000, { item: 'popper' }],
  ['coins_100k', 'token', 'legend', 'moneybag', (c) => c.earned, 100000, { item: 'santa' }],

  // ---------- 출석·꾸준함 ----------
  ['streak_3', 'streak', 'easy', 'fire', (c) => c.best, 3, { food: { fishgrill: 2 } }],
  ['streak_7', 'streak', 'normal', 'calendar', (c) => c.best, 7, { item: 'bandana' }],
  ['streak_14', 'streak', 'normal', 'calendar', (c) => c.best, 14, { item: 'tapfoot' }],
  ['streak_30', 'streak', 'hard', 'trophy', (c) => c.best, 30, { item: 'bunny' }],
  ['streak_60', 'streak', 'hard', 'fire', (c) => c.best, 60, COIN.hard],
  ['streak_100', 'streak', 'legend', 'trophy', (c) => c.best, 100, { item: 'wings' }],
  ['streak_365', 'streak', 'legend', 'trophy', (c) => c.best, 365, { item: 'ufo' }],
  ['days_10', 'streak', 'easy', 'calendar', (c) => c.days, 10, { food: { omurice: 2 } }],
  ['days_50', 'streak', 'normal', 'calendar', (c) => c.days, 50, { item: 'mikan' }],
  ['days_100', 'streak', 'hard', 'calendar', (c) => c.days, 100, { item: 'coronation' }],
  ['days_200', 'streak', 'legend', 'calendar', (c) => c.days, 200, COIN.legend],
  ['days_365', 'streak', 'legend', 'calendar', (c) => c.days, 365, { item: 'antlers' }],
  ['weekend_5', 'streak', 'normal', 'sunrise', (c) => c.weekend, 5, { item: 'hammock' }],
  ['weekend_20', 'streak', 'hard', 'sunrise', (c) => c.weekend, 20, { item: 'tube' }],
  ['weekend_50', 'streak', 'legend', 'sunrise', (c) => c.weekend, 50, COIN.legend],
  ['week_full', 'streak', 'normal', 'calendar', (c) => U(c).weeksFull || 0, 1, COIN.normal],
  ['week_5x8', 'streak', 'hard', 'calendar', (c) => U(c).weeks5 || 0, 8, COIN.hard],
  ['month_20x3', 'streak', 'hard', 'calendar', (c) => U(c).months20 || 0, 3, COIN.hard],
  ['busy_days_20', 'streak', 'hard', 'fire', (c) => U(c).busyDays || 0, 20, COIN.hard],
  ['busy_days_100', 'streak', 'legend', 'fire', (c) => U(c).busyDays || 0, 100, COIN.legend],

  // ---------- 생활 리듬 ----------
  ['night_owl', 'rhythm', 'easy', 'moon', (c) => (c.hours.slice(1, 5).some((x) => x > 0) ? 1 : 0), 1, { food: { ramen: 1 } }],
  ['early_bird', 'rhythm', 'easy', 'sunrise', (c) => (c.hours.slice(5, 8).some((x) => x > 0) ? 1 : 0), 1, { food: { milk: 2 } }],
  ['dawn_3', 'rhythm', 'normal', 'moon', (c) => (c.hours[3] > 0 ? 1 : 0), 1, { item: 'piano' }],
  ['night_100', 'rhythm', 'hard', 'moon', (c) => c.hours.slice(1, 5).reduce((a, x) => a + x, 0), 100, { item: 'soul' }],
  ['every_hour', 'rhythm', 'legend', 'clock', (c) => c.hours.filter((x) => x > 0).length, 24, { item: 'ghost' }],
  ['hours_18', 'rhythm', 'hard', 'clock', (c) => c.hours.filter((x) => x > 0).length, 18, COIN.hard],
  ['morning_300', 'rhythm', 'hard', 'sunrise', (c) => c.hours.slice(6, 9).reduce((a, x) => a + x, 0), 300, COIN.hard],
  ['marathon', 'rhythm', 'normal', 'clock', (c) => c.st.maxStreakMin, 180, { item: 'workout' }],
  ['marathon_6h', 'rhythm', 'hard', 'clock', (c) => c.st.maxStreakMin, 360, { item: 'beanie' }],
  ['marathon_12h', 'rhythm', 'legend', 'clock', (c) => c.st.maxStreakMin, 720, { item: 'skullsmoke' }],
  ['rest_10', 'rhythm', 'normal', 'pillow', (c) => c.st.restsTaken, 10, { item: 'cafe' }],
  ['rest_50', 'rhythm', 'hard', 'pillow', (c) => c.st.restsTaken, 50, { item: 'fedora' }],
  ['rest_150', 'rhythm', 'legend', 'pillow', (c) => c.st.restsTaken, 150, COIN.legend],

  // ---------- 고양이와 교감 ----------
  ['pet_1', 'bond', 'easy', 'paw', (c) => c.st.pokes, 1, { food: { churu: 1 } }],
  ['pet_50', 'bond', 'easy', 'paw', (c) => c.st.pokes, 50, { food: { salmon: 1 } }],
  ['pet_300', 'bond', 'normal', 'paw', (c) => c.st.pokes, 300, { item: 'bellcollar' }],
  ['pet_1000', 'bond', 'hard', 'heart', (c) => c.st.pokes, 1000, { item: 'melt' }],
  ['pet_5000', 'bond', 'legend', 'heart', (c) => c.st.pokes, 5000, { item: 'flowercrown' }],
  ['spam_1', 'bond', 'easy', 'bang', (c) => n(c, 'spam'), 1, { food: { anchovy: 2 } }],
  ['spam_20', 'bond', 'normal', 'bang', (c) => n(c, 'spam'), 20, { item: 'grumpy' }],
  ['lift_1', 'bond', 'easy', 'paw', (c) => n(c, 'lift'), 1, { food: { churu: 2 } }],
  ['lift_50', 'bond', 'normal', 'paw', (c) => n(c, 'lift'), 50, { item: 'startle' }],
  ['lift_300', 'bond', 'hard', 'paw', (c) => n(c, 'lift'), 300, { item: 'mask' }],
  ['fed_1', 'bond', 'easy', 'ricebowl', (c) => n(c, 'fed'), 1, { food: { milk: 2 } }],
  ['fed_30', 'bond', 'normal', 'ricebowl', (c) => n(c, 'fed'), 30, { item: 'toast' }],
  ['fed_200', 'bond', 'hard', 'ricebowl', (c) => n(c, 'fed'), 200, { item: 'fooddream' }],
  ['snack_10', 'bond', 'easy', 'gift', (c) => n(c, 'snack'), 10, { food: { churu: 2 } }],
  ['snack_100', 'bond', 'hard', 'gift', (c) => n(c, 'snack'), 100, { item: 'mustache' }],
  ['play_1', 'bond', 'easy', 'paw', (c) => n(c, 'play'), 1, { food: { churu: 2 } }],
  ['play_30', 'bond', 'normal', 'paw', (c) => n(c, 'play'), 30, { item: 'sneeze' }],
  ['catch_100', 'bond', 'normal', 'star', (c) => n(c, 'catch'), 100, { item: 'frog' }],
  ['catch_1000', 'bond', 'hard', 'star', (c) => n(c, 'catch'), 1000, { item: 'ropeskip' }],
  ['giant_1', 'bond', 'normal', 'sparkle', (c) => n(c, 'giant'), 1, { item: 'bubbles' }],
  ['box_10', 'bond', 'normal', 'gift', (c) => n(c, 'box'), 10, { item: 'snot' }],
  ['bored_10', 'bond', 'normal', 'doze', (c) => n(c, 'bored'), 10, { item: 'gum' }],

  // ---------- 쇼핑·수집 ----------
  ['buy_1', 'collect', 'easy', 'coin', (c) => c.bought, 1, { food: { tempura: 1 } }],
  ['buy_20', 'collect', 'normal', 'coin', (c) => c.bought, 20, { item: 'bee' }],
  ['buy_100', 'collect', 'hard', 'moneybag', (c) => c.bought, 100, { item: 'soju' }],
  ['spend_10k', 'collect', 'hard', 'moneybag', (c) => c.spent, 10000, { item: 'party' }],
  ['acc_5', 'collect', 'normal', 'ribbon', (c) => c.owned.acc, 5, { item: 'dealwithit' }],
  ['acc_all', 'collect', 'legend', 'ribbon', (c) => c.owned.acc, (c) => c.totalAcc, { item: 'electricjam' }],
  ['motion_10', 'collect', 'normal', 'sparkle', (c) => c.owned.motion, 10, { item: 'eyepatch' }],
  ['motion_30', 'collect', 'hard', 'sparkle', (c) => c.owned.motion, 30, { item: 'lightning' }],
  ['toy_5', 'collect', 'normal', 'paw', (c) => c.owned.toy, 5, { item: 'bearhood' }],
  ['toy_all', 'collect', 'hard', 'paw', (c) => c.owned.toy, (c) => c.totalToy, { item: 'drums' }],
  ['treasure_1', 'collect', 'easy', 'gift', (c) => c.treasureKinds || 0, 1, { food: { churu: 2 } }],
  ['treasure_10', 'collect', 'normal', 'gift', (c) => c.treasureKinds || 0, 10, { item: 'clover' }],
  ['treasure_all', 'collect', 'legend', 'gem', (c) => c.treasureKinds || 0, TREASURES.length, { item: 'goldaura' }],
  ['rich_5k', 'collect', 'normal', 'moneybag', (c) => c.balance, 5000, { item: 'giantfist' }],
  ['rich_50k', 'collect', 'legend', 'gem', (c) => c.balance, 50000, { item: 'scarf' }],

  // ---------- 성장·퀘스트 ----------
  ['lv_5', 'growth', 'easy', 'star', (c) => c.level, 5, { food: { sushi: 1 } }],
  ['lv_10', 'growth', 'normal', 'star', (c) => c.level, 10, { item: 'police' }],
  ['lv_20', 'growth', 'normal', 'star', (c) => c.level, 20, { item: 'laptoptoss' }],
  ['lv_30', 'growth', 'hard', 'sparkle', (c) => c.level, 30, { item: 'glowup' }],
  ['lv_50', 'growth', 'legend', 'sparkle', (c) => c.level, 50, { item: 'fart' }],
  ['quest_1', 'growth', 'easy', 'scroll', (c) => c.st.questsDone, 1, { food: { churu: 3 } }],
  ['quest_10', 'growth', 'normal', 'scroll', (c) => c.st.questsDone, 10, { item: 'blanket' }],
  ['quest_50', 'growth', 'hard', 'map', (c) => c.st.questsDone, 50, { item: 'nightcap' }],
  ['quest_200', 'growth', 'legend', 'map', (c) => c.st.questsDone, 200, { item: 'curtainreveal' }],
  ['quest_500', 'growth', 'legend', 'map', (c) => c.st.questsDone, 500, COIN.legend],
  ['allclear_10', 'growth', 'hard', 'check', (c) => n(c, 'allclear'), 10, { item: 'smokereveal' }],
  ['allclear_30', 'growth', 'legend', 'check', (c) => n(c, 'allclear'), 30, COIN.legend],

  // ---------- 옵시디언 활용 (데스크톱판의 'Claude 활용' 자리) ----------
  ['tag_1', 'obsidian', 'normal', 'pin', (c) => feat(c, 'tag'), 1, COIN.normal],
  ['tag_100', 'obsidian', 'hard', 'pin', (c) => feat(c, 'tag'), 100, COIN.hard],
  ['tag_500', 'obsidian', 'legend', 'pin', (c) => feat(c, 'tag'), 500, COIN.legend],
  ['task_10', 'obsidian', 'normal', 'check', (c) => feat(c, 'done'), 10, COIN.normal],
  ['task_100', 'obsidian', 'hard', 'check', (c) => feat(c, 'done'), 100, COIN.hard],
  ['task_1000', 'obsidian', 'legend', 'check', (c) => feat(c, 'done'), 1000, COIN.legend],
  ['head_50', 'obsidian', 'normal', 'scroll', (c) => feat(c, 'head'), 50, COIN.normal],
  ['head_500', 'obsidian', 'hard', 'scroll', (c) => feat(c, 'head'), 500, COIN.hard],
  ['embed_1', 'obsidian', 'normal', 'eye', (c) => feat(c, 'embed'), 1, COIN.normal],
  ['embed_100', 'obsidian', 'hard', 'eye', (c) => feat(c, 'embed'), 100, COIN.hard],
  ['callout_1', 'obsidian', 'normal', 'bulb', (c) => feat(c, 'callout'), 1, COIN.normal],
  ['callout_50', 'obsidian', 'hard', 'bulb', (c) => feat(c, 'callout'), 50, COIN.hard],
  ['daily_1', 'obsidian', 'normal', 'calendar', (c) => feat(c, 'daily'), 1, COIN.normal],
  ['daily_30', 'obsidian', 'hard', 'calendar', (c) => feat(c, 'daily'), 30, COIN.hard],
  ['daily_100', 'obsidian', 'legend', 'calendar', (c) => feat(c, 'daily'), 100, COIN.legend],
  ['canvas_1', 'obsidian', 'normal', 'map', (c) => feat(c, 'canvas'), 1, COIN.normal],
  ['canvas_10', 'obsidian', 'hard', 'map', (c) => feat(c, 'canvas'), 10, COIN.hard],
  ['open_100', 'obsidian', 'normal', 'door', (c) => c.all.v || 0, 100, COIN.normal],
  ['open_1000', 'obsidian', 'hard', 'door', (c) => c.all.v || 0, 1000, COIN.hard],
  ['open_10000', 'obsidian', 'legend', 'door', (c) => c.all.v || 0, 10000, COIN.legend],
  ['features_8', 'obsidian', 'legend', 'gear', FEATURES8, 8, COIN.legend],

  // ---------- 여러 폴더 (데스크톱판의 '여러 프로젝트' 자리) ----------
  ['folder_3', 'project', 'normal', 'home', (c) => U(c).folders || 0, 3, COIN.normal],
  ['folder_10', 'project', 'hard', 'home', (c) => U(c).folders || 0, 10, COIN.hard],
  ['folder_30', 'project', 'legend', 'home', (c) => U(c).folders || 0, 30, COIN.legend],
  ['day_folder_3', 'project', 'normal', 'door', (c) => U(c).dayFolderMax || 0, 3, COIN.normal],
  ['day_folder_5', 'project', 'hard', 'door', (c) => U(c).dayFolderMax || 0, 5, COIN.hard],

  // ---------- 비밀·잡동사니 ----------
  ['house_1', 'secret', 'easy', 'home', (c) => n(c, 'house'), 1, { food: { churu: 2 } }],
  ['rename', 'secret', 'easy', 'paw', (c) => n(c, 'rename'), 1, { food: { milk: 1 } }],
  ['quiet_10', 'secret', 'normal', 'bellOff', (c) => n(c, 'quiet'), 10, { item: 'teatime' }],
  ['smoke_break', 'secret', 'normal', 'pillow', (c) => n(c, 'lift') >= 1 && c.st.restsTaken >= 3 ? 1 : 0, 1, { item: 'smoke' }],
];

const CATS = ['write', 'link', 'note', 'session', 'obsidian', 'project', 'token', 'streak', 'rhythm', 'bond', 'collect', 'growth', 'secret'];
const TIERS = ['easy', 'normal', 'hard', 'legend'];

const ACHIEVEMENTS = RAW.map(([id, cat, tier, icon, value, goal, reward]) => {
  const target = (c) => (typeof goal === 'function' ? goal(c) : goal);
  return {
    id, cat, tier, icon, reward, xp: XP[tier],
    check: (c) => value(c) >= Math.max(1, target(c)),
    progress: (c) => [Math.min(value(c), target(c)), target(c)],
  };
});

module.exports = { ACHIEVEMENTS, CATS, TIERS };
