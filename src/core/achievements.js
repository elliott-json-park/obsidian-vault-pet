// 업적. 킷커밋 데스크톱판의 업적표를 옵시디언에 맞게 옮겼다 (대화·세션·토큰·Claude 활용 → 글쓰기·링크·새 노트·세션·옵시디언 활용).
// 2.0.0: 옵시디언을 잘 쓰게 돕는 쪽으로 (정리 습관 · 화면 열어 보기 · 할 일). 보물 · 모션 · 먹고 싶은 것 · 친구 업적은 뺐고, 모션 보상은 코인으로 바꿨다.
//  tier   : easy · normal · hard · legend
//  reward : { food: { 키: 개수 } } · { item: 키 } · { coins: n }. 이미 갖고 있는 아이템이면 그 값만큼 코인으로 준다
//  c 는 gamify.js 의 context(): c.all{c,l,n,s,v,e} 누적 · c.today 오늘 · c.hours[0..23] 시각별 기록 횟수 · c.use(usage.obsidianUse) · c.maxBacklinks
// 이름·설명은 i18n 의 ach.<id>.name / ach.<id>.desc, icon 은 pixelart.js 의 도트 이름.
const { PREMIUM_FOODS } = require('./shop');
const { VIEWS } = require('./skills');

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
  ['write_30k', 'write', 'normal', 'scroll', (c) => c.all.c, 3e4, { coins: 300 }],
  ['write_100k', 'write', 'hard', 'map', (c) => c.all.c, 1e5, { item: 'glasses' }],
  ['write_300k', 'write', 'hard', 'heart', (c) => c.all.c, 3e5, { coins: 450 }],
  ['write_1m', 'write', 'hard', 'heart', (c) => c.all.c, 1e6, { item: 'headphones' }],
  ['write_3m', 'write', 'legend', 'trophy', (c) => c.all.c, 3e6, { coins: 1150 }],
  ['write_10m', 'write', 'legend', 'trophy', (c) => c.all.c, 1e7, { item: 'crown' }],
  ['day_write_3k', 'write', 'normal', 'fire', (c) => c.today.c, 3000, { coins: 1000 }],
  ['day_write_10k', 'write', 'legend', 'fire', (c) => c.today.c, 1e4, { coins: 1100 }],
  ['day_write_20k', 'write', 'legend', 'moneybag', (c) => c.today.c, 2e4, COIN.legend],
  ['edit_10000', 'write', 'hard', 'chats', (c) => c.all.e || 0, 10000, COIN.hard],
  ['edit_50000', 'write', 'legend', 'chats', (c) => c.all.e || 0, 50000, COIN.legend],

  // ---------- 하루 목표 · 집중 시간 (1.5.0) ----------
  // 목표 날 수 · 이어서 채운 최고 기록 · 마친 집중 시간 횟수 (host.checkGoal · focusTick 이 gamify 횟수로 올린다)
  ['goal_1', 'focus', 'easy', 'star', (c) => n(c, 'goal'), 1, { food: { churu: 3 } }],
  ['goal_10', 'focus', 'normal', 'star', (c) => n(c, 'goal'), 10, COIN.normal],
  ['goal_50', 'focus', 'hard', 'star', (c) => n(c, 'goal'), 50, COIN.hard],
  ['goal_200', 'focus', 'legend', 'trophy', (c) => n(c, 'goal'), 200, COIN.legend],
  ['goalrun_3', 'focus', 'normal', 'fire', (c) => n(c, 'goalStreak'), 3, COIN.normal],
  ['goalrun_7', 'focus', 'hard', 'fire', (c) => n(c, 'goalStreak'), 7, COIN.hard],
  ['goalrun_30', 'focus', 'legend', 'fire', (c) => n(c, 'goalStreak'), 30, COIN.legend],
  ['focus_1', 'focus', 'easy', 'hourglass', (c) => n(c, 'focus'), 1, { food: { milk: 3 } }],
  ['focus_10', 'focus', 'normal', 'hourglass', (c) => n(c, 'focus'), 10, COIN.normal],
  ['focus_50', 'focus', 'hard', 'hourglass', (c) => n(c, 'focus'), 50, COIN.hard],
  ['focus_200', 'focus', 'legend', 'hourglass', (c) => n(c, 'focus'), 200, COIN.legend],
  // 2.0.0: 홈의 할 일 (플러그인 안에만 있는 목록. host.todoDone 이 센다)
  ['todo_1', 'focus', 'easy', 'check', (c) => n(c, 'todoDone'), 1, { food: { churu: 2 } }],
  ['todo_50', 'focus', 'normal', 'check', (c) => n(c, 'todoDone'), 50, COIN.normal],
  ['todo_300', 'focus', 'hard', 'check', (c) => n(c, 'todoDone'), 300, COIN.hard],
  ['todo_1000', 'focus', 'legend', 'trophy', (c) => n(c, 'todoDone'), 1000, COIN.legend],

  // ---------- 링크 ----------
  ['link_1', 'link', 'easy', 'pin', (c) => c.all.l, 1, { food: { churu: 3 } }],
  ['link_30', 'link', 'easy', 'pin', (c) => c.all.l, 30, { food: { chicken: 2 } }],
  ['link_100', 'link', 'normal', 'pin', (c) => c.all.l, 100, { item: 'nerd' }],
  ['link_300', 'link', 'normal', 'map', (c) => c.all.l, 300, { coins: 600 }],
  ['link_1000', 'link', 'hard', 'map', (c) => c.all.l, 1000, { item: 'magnifier' }], // 1.2.4: 'chef' 는 premium_all(프리미엄 음식 다 먹이기)과 겹쳐서 돋보기로
  ['link_3000', 'link', 'hard', 'gem', (c) => c.all.l, 3000, { coins: 900 }],
  ['link_10000', 'link', 'legend', 'gem', (c) => c.all.l, 1e4, { item: 'halo' }],
  ['link_30000', 'link', 'legend', 'gem', (c) => c.all.l, 3e4, { coins: 1200 }],
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
  ['sess_100', 'session', 'normal', 'door', (c) => c.all.s, 100, { coins: 750 }],
  ['sess_300', 'session', 'hard', 'home', (c) => c.all.s, 300, { item: 'tophat' }],
  ['sess_700', 'session', 'hard', 'home', (c) => c.all.s, 700, { coins: 1050 }],
  ['sess_1500', 'session', 'legend', 'home', (c) => c.all.s, 1500, { item: 'wizard' }],
  ['day_sess_5', 'session', 'normal', 'door', (c) => c.today.s, 5, { coins: 950 }],

  // ---------- 코인 ----------
  ['coins_10k', 'token', 'normal', 'coin', (c) => c.earned, 10000, { coins: 800 }],
  ['coins_100k', 'token', 'legend', 'moneybag', (c) => c.earned, 100000, { item: 'santa' }],

  // ---------- 출석·꾸준함 ----------
  ['streak_3', 'streak', 'easy', 'fire', (c) => c.best, 3, { food: { fishgrill: 2 } }],
  ['streak_7', 'streak', 'normal', 'calendar', (c) => c.best, 7, { item: 'bandana' }],
  ['streak_14', 'streak', 'normal', 'calendar', (c) => c.best, 14, { coins: 550 }],
  ['streak_30', 'streak', 'hard', 'trophy', (c) => c.best, 30, { item: 'bunny' }],
  ['streak_60', 'streak', 'hard', 'fire', (c) => c.best, 60, COIN.hard],
  ['streak_100', 'streak', 'legend', 'trophy', (c) => c.best, 100, { item: 'wings' }],
  ['streak_365', 'streak', 'legend', 'trophy', (c) => c.best, 365, { coins: 1200 }],
  ['days_10', 'streak', 'easy', 'calendar', (c) => c.days, 10, { food: { omurice: 2 } }],
  ['days_50', 'streak', 'normal', 'calendar', (c) => c.days, 50, { item: 'mikan' }],
  ['days_100', 'streak', 'hard', 'calendar', (c) => c.days, 100, { coins: 1100 }],
  ['days_200', 'streak', 'legend', 'calendar', (c) => c.days, 200, COIN.legend],
  ['days_365', 'streak', 'legend', 'calendar', (c) => c.days, 365, { item: 'antlers' }],
  ['weekend_5', 'streak', 'normal', 'sunrise', (c) => c.weekend, 5, { coins: 900 }],
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
  ['dawn_3', 'rhythm', 'normal', 'moon', (c) => (c.hours[3] > 0 ? 1 : 0), 1, { coins: 1050 }],
  ['night_100', 'rhythm', 'hard', 'moon', (c) => c.hours.slice(1, 5).reduce((a, x) => a + x, 0), 100, { coins: 1150 }],
  ['every_hour', 'rhythm', 'legend', 'clock', (c) => c.hours.filter((x) => x > 0).length, 24, { coins: 350 }],
  ['hours_18', 'rhythm', 'hard', 'clock', (c) => c.hours.filter((x) => x > 0).length, 18, COIN.hard],
  ['morning_300', 'rhythm', 'hard', 'sunrise', (c) => c.hours.slice(6, 9).reduce((a, x) => a + x, 0), 300, COIN.hard],
  ['marathon', 'rhythm', 'normal', 'clock', (c) => c.st.maxStreakMin, 180, { coins: 1050 }],
  ['marathon_6h', 'rhythm', 'hard', 'clock', (c) => c.st.maxStreakMin, 360, { item: 'beanie' }],
  ['marathon_12h', 'rhythm', 'legend', 'clock', (c) => c.st.maxStreakMin, 720, { coins: 950 }],
  ['rest_10', 'rhythm', 'normal', 'pillow', (c) => c.st.restsTaken, 10, { coins: 600 }],
  ['rest_50', 'rhythm', 'hard', 'pillow', (c) => c.st.restsTaken, 50, { item: 'fedora' }],
  ['rest_150', 'rhythm', 'legend', 'pillow', (c) => c.st.restsTaken, 150, COIN.legend],

  // ---------- 고양이와 교감 ----------
  ['pet_1', 'bond', 'easy', 'paw', (c) => c.st.pokes, 1, { food: { churu: 1 } }],
  ['pet_300', 'bond', 'normal', 'paw', (c) => c.st.pokes, 300, { item: 'bellcollar' }],
  ['pet_1000', 'bond', 'hard', 'heart', (c) => c.st.pokes, 1000, { coins: 900 }],
  ['lift_1', 'bond', 'easy', 'paw', (c) => n(c, 'lift'), 1, { food: { churu: 2 } }],
  ['fed_1', 'bond', 'easy', 'ricebowl', (c) => n(c, 'fed'), 1, { food: { milk: 2 } }],
  ['fed_30', 'bond', 'normal', 'ricebowl', (c) => n(c, 'fed'), 30, { item: 'toast' }],
  ['snack_10', 'bond', 'easy', 'gift', (c) => n(c, 'snack'), 10, { food: { churu: 2 } }],
  // 4차 (2026-09-26): 프리미엄 밥·간식. 먹은 종류는 cnt 의 'pf_<키>' 로 센다 (main.js premiumEaten)
  ['premium_1', 'bond', 'easy', 'ricebowl', (c) => n(c, 'premium'), 1, { food: { fortuneCookie: 1 } }],
  ['premium_all', 'collect', 'legend', 'star', (c) => PREMIUM_FOODS.filter((k) => n(c, 'pf_' + k) > 0).length, PREMIUM_FOODS.length, { item: 'chef' }],
  ['foodspend_10k', 'collect', 'hard', 'moneybag', (c) => n(c, 'foodSpent'), 10000, { food: { goldMouseChoco: 1 } }],
  ['play_1', 'bond', 'easy', 'paw', (c) => n(c, 'play'), 1, { food: { churu: 2 } }],
  ['catch_100', 'bond', 'normal', 'star', (c) => n(c, 'catch'), 100, { item: 'frog' }],

  // ---------- 쇼핑·수집 ----------
  ['buy_1', 'collect', 'easy', 'coin', (c) => c.bought, 1, { food: { tempura: 1 } }],
  ['buy_20', 'collect', 'normal', 'coin', (c) => c.bought, 20, { item: 'bee' }],
  ['buy_100', 'collect', 'hard', 'moneybag', (c) => c.bought, 100, { coins: 850 }],
  ['spend_10k', 'collect', 'hard', 'moneybag', (c) => c.spent, 10000, { item: 'party' }],
  ['acc_5', 'collect', 'normal', 'ribbon', (c) => c.owned.acc, 5, { coins: 400 }],
  // 한 번이라도 가졌던 코스튬 수 (공방 코스튬을 친구에게 선물해도 줄지 않는다. gamify.js 의 lifetimeSide)
  ['acc_all', 'collect', 'legend', 'ribbon', (c) => (c.accEver != null ? c.accEver : c.owned.acc), (c) => c.totalAcc, { coins: 1100 }],
  ['toy_5', 'collect', 'normal', 'paw', (c) => c.owned.toy, 5, { item: 'bearhood' }],
  ['toy_all', 'collect', 'hard', 'paw', (c) => c.owned.toy, (c) => c.totalToy, { coins: 1050 }],
  ['rich_5k', 'collect', 'normal', 'moneybag', (c) => c.balance, 5000, { coins: 1100 }],
  ['rich_50k', 'collect', 'legend', 'gem', (c) => c.balance, 50000, { item: 'scarf' }],

  // ---------- 성장·퀘스트 ----------
  ['lv_5', 'growth', 'easy', 'star', (c) => c.level, 5, { food: { sushi: 1 } }],
  ['lv_10', 'growth', 'normal', 'star', (c) => c.level, 10, { item: 'police' }],
  ['lv_20', 'growth', 'normal', 'star', (c) => c.level, 20, { coins: 1050 }],
  ['lv_30', 'growth', 'hard', 'sparkle', (c) => c.level, 30, { coins: 1100 }],
  ['lv_50', 'growth', 'legend', 'sparkle', (c) => c.level, 50, { coins: 350 }],
  ['quest_1', 'growth', 'easy', 'scroll', (c) => c.st.questsDone, 1, { food: { churu: 3 } }],
  ['quest_10', 'growth', 'normal', 'scroll', (c) => c.st.questsDone, 10, { coins: 550 }],
  ['quest_50', 'growth', 'hard', 'map', (c) => c.st.questsDone, 50, { item: 'nightcap' }],
  ['quest_200', 'growth', 'legend', 'map', (c) => c.st.questsDone, 200, { coins: 1050 }],
  ['quest_500', 'growth', 'legend', 'map', (c) => c.st.questsDone, 500, COIN.legend],
  ['allclear_10', 'growth', 'hard', 'check', (c) => n(c, 'allclear'), 10, { coins: 950 }],
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
  // 2.0.0: 데일리 노트에 쓴 글자 · 옵시디언 화면 열어 보기 (plugin/main.js 가 뷰 종류마다 view_<종류> 로 센다)
  ['dailyc_1k', 'obsidian', 'normal', 'calendar', (c) => feat(c, 'dailyc'), 1000, COIN.normal],
  ['dailyc_10k', 'obsidian', 'hard', 'calendar', (c) => feat(c, 'dailyc'), 10000, COIN.hard],
  ['graph_1', 'obsidian', 'easy', 'map', (c) => n(c, 'view_graph') + n(c, 'view_localgraph'), 1, { food: { milk: 2 } }],
  ['search_1', 'obsidian', 'easy', 'eye', (c) => n(c, 'view_search'), 1, { food: { churu: 2 } }],
  ['backlink_1', 'obsidian', 'easy', 'pin', (c) => n(c, 'view_backlink') + n(c, 'view_outgoing-link'), 1, { food: { tuna: 1 } }],
  ['outline_1', 'obsidian', 'easy', 'scroll', (c) => n(c, 'view_outline'), 1, { food: { milk: 2 } }],
  ['views_all', 'obsidian', 'hard', 'gear', (c) => VIEWS.filter((v) => n(c, 'view_' + v) > 0).length, VIEWS.length, COIN.hard],

  // ---------- 정리 습관 (2.0.0): 속성 달기 · 노트 옮기기 · 이름 다듬기 · 외톨이 노트 이어 주기 ----------
  ['prop_1', 'organize', 'easy', 'pin', (c) => feat(c, 'prop'), 1, { food: { churu: 2 } }],
  ['prop_50', 'organize', 'normal', 'pin', (c) => feat(c, 'prop'), 50, COIN.normal],
  ['prop_300', 'organize', 'hard', 'pin', (c) => feat(c, 'prop'), 300, COIN.hard],
  ['move_1', 'organize', 'easy', 'home', (c) => n(c, 'move'), 1, { food: { tuna: 1 } }],
  ['move_50', 'organize', 'normal', 'home', (c) => n(c, 'move'), 50, COIN.normal],
  ['move_300', 'organize', 'hard', 'home', (c) => n(c, 'move'), 300, COIN.hard],
  ['retitle_10', 'organize', 'normal', 'scroll', (c) => n(c, 'retitle'), 10, COIN.normal],
  ['orphan_1', 'organize', 'easy', 'paw', (c) => n(c, 'orphanFix'), 1, { food: { salmon: 1 } }],
  ['orphan_30', 'organize', 'hard', 'heart', (c) => n(c, 'orphanFix'), 30, COIN.hard],
  ['orphan_100', 'organize', 'legend', 'heart', (c) => n(c, 'orphanFix'), 100, COIN.legend],

  // ---------- 여러 폴더 (데스크톱판의 '여러 프로젝트' 자리) ----------
  ['folder_3', 'project', 'normal', 'home', (c) => U(c).folders || 0, 3, COIN.normal],
  ['folder_10', 'project', 'hard', 'home', (c) => U(c).folders || 0, 10, COIN.hard],
  ['folder_30', 'project', 'legend', 'home', (c) => U(c).folders || 0, 30, COIN.legend],
  ['day_folder_3', 'project', 'normal', 'door', (c) => U(c).dayFolderMax || 0, 3, COIN.normal],
  ['day_folder_5', 'project', 'hard', 'door', (c) => U(c).dayFolderMax || 0, 5, COIN.hard],

  // ---------- 비밀·잡동사니 ----------
  ['house_1', 'secret', 'easy', 'home', (c) => n(c, 'house'), 1, { food: { churu: 2 } }],
  ['rename', 'secret', 'easy', 'paw', (c) => n(c, 'rename'), 1, { food: { milk: 1 } }],
  ['mystery_jackpot', 'secret', 'normal', 'gift', (c) => n(c, 'mysteryPremium'), 1, { food: { fortuneCookie: 2 } }],
  ['quiet_10', 'secret', 'normal', 'bellOff', (c) => n(c, 'quiet'), 10, { coins: 900 }],
];

// 데스크톱판의 'Claude Code 에서만 깰 수 있는 업적' 표. 옵시디언판에는 그런 업적이 없다
const CLAUDE_ONLY = new Set();

const CATS = ['write', 'focus', 'link', 'note', 'session', 'obsidian', 'organize', 'project', 'token', 'streak', 'rhythm', 'bond', 'collect', 'growth', 'secret'];
const TIERS = ['easy', 'normal', 'hard', 'legend'];

const ACHIEVEMENTS = RAW.map(([id, cat, tier, icon, value, goal, reward]) => {
  const target = (c) => (typeof goal === 'function' ? goal(c) : goal);
  return {
    id, cat, tier, icon, reward, xp: XP[tier],
    claudeOnly: CLAUDE_ONLY.has(id),
    check: (c) => value(c) >= Math.max(1, target(c)),
    progress: (c) => [Math.min(value(c), target(c)), target(c)],
  };
});

module.exports = { ACHIEVEMENTS, CATS, TIERS, CLAUDE_ONLY };
