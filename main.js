'use strict';

/*
 * Vault Pet (vault-pet) — Obsidian plugin
 *
 * 노트를 쓸수록 자라는 도트 펫. Claude Pet 데스크톱 앱의 옵시디언판이다.
 *
 * 친구들
 *  - 처음에 다섯 친구(잉크방울·실타래 고양이·새싹·아기 용·책 부엉이) 중 하나를 파트너로 고른다.
 *  - 파트너만 자란다. 도감에서 다른 친구의 알을 받거나 파트너를 바꿀 수 있고, 쉬는 친구는 자란 만큼 기억한다.
 *  - 친구마다 생김새·성격·대사·특기(경험치 보너스)가 다르다.
 *
 * 경험치
 *  - 새로 쓴 글자 수 ÷ 20 + 새로 건 링크 × 5 + 새 노트 × 15 + 퀘스트·업적·출석 보너스
 *  - 파일마다 "지금까지 가장 많았던 글자 수·링크 수"(최고 기록)를 기억해서 그보다 늘어난 만큼만 센다.
 *    지웠다가 다시 붙여 넣거나 되돌리기를 반복해서는 경험치가 오르지 않는다.
 *  - 한 번에 크게 늘어난 양(붙여넣기)은 3,000자·링크 30개까지만 센다.
 *
 * 저장 규칙
 *  - 볼트 파일은 읽기만 한다. 노트 내용은 어디에도 저장하지 않는다.
 *  - 경로별 숫자(최고 기록)와 날짜별 합계만 플러그인 폴더의 data.json 에 남는다.
 */

const obsidian = require('obsidian');
const {
  ItemView, Modal, Setting, PluginSettingTab, Notice, Menu, TFile, TFolder,
  MarkdownRenderChild, normalizePath, addIcon,
} = obsidian;

const VIEW_TYPE = 'vault-pet-house';
const ICON = 'vault-pet';
const MIN = 60_000;
const GRID = 48;

const CHARS_PER_XP = 20;
const XP_PER_LINK = 5;
const XP_PER_NOTE = 15;
const LIVE_CHAR_CAP = 3000; // 한 번에 늘어난 글자 수 상한 (큰 붙여넣기)
const LIVE_LINK_CAP = 30;
const NOTE_MIN_CHARS = 10; // 이만큼은 써야 새 노트로 친다
// 한꺼번에 여러 파일이 바뀌었을 때 전체로 줄 수 있는 몫. 폴더를 통째로 복사해 넣어도 경험치가 폭발하지 않게
const FLUSH_BUDGET = { c: 6000, l: 60, n: 10 }; // 1.5초 동안 모인 변경
const OFFLINE_BUDGET = { c: 20000, l: 300, n: 40 }; // 옵시디언이 꺼져 있던 동안의 변경
const STREAK_GAP = 20 * MIN; // 이만큼 쉬면 연속 작업 시간이 초기화된다

/* ────────────────────────────── 언어 ────────────────────────────── */
// 항목마다 [한국어, English]. 둘이 나란히 있어야 빠뜨리지 않는다.

const S = {
  pluginName: ['볼트 펫', 'Vault Pet'],
  houseTitle: ['펫 하우스', 'Pet house'],
  openHouse: ['펫 하우스 열기', 'Open pet house'],

  stage_egg: ['알', 'Egg'],
  stage_baby: ['아기', 'Baby'],
  stage_child: ['어린이', 'Kid'],
  stage_teen: ['청소년', 'Teen'],
  stage_adult: ['어른', 'Adult'],

  mood_writing: ['✍️ 같이 쓰는 중', '✍️ Writing with you'],
  mood_active: ['👀 옆에서 구경하는 중', '👀 Watching you work'],
  mood_idle: ['🍃 빈둥빈둥', '🍃 Lazing around'],
  mood_sleepy: ['😪 꾸벅꾸벅 졸려요', '😪 Getting sleepy'],
  mood_sleeping: ['💤 쿨쿨 자는 중', '💤 Fast asleep'],
  quietOn: ['🔕 방해 금지 중', '🔕 Do not disturb'],

  // 탭
  tab_home: ['홈', 'Home'],
  tab_quests: ['퀘스트', 'Quests'],
  tab_dex: ['도감', 'Dex'],
  tab_achievements: ['업적', 'Badges'],
  tab_wardrobe: ['꾸미기', 'Wardrobe'],
  tab_stats: ['통계', 'Stats'],

  // 친구
  traitLabel: ['성격', 'Personality'],
  likesLabel: ['좋아하는 것', 'Likes'],
  perkLabel: ['특기', 'Perk'],
  perk_chars: ['글자 경험치 +{p}%', '+{p}% writing XP'],
  perk_links: ['링크 경험치 +{p}%', '+{p}% link XP'],
  perk_notes: ['새 노트 경험치 +{p}%', '+{p}% new-note XP'],
  perk_attend: ['출석 보너스 +{p}%', '+{p}% streak bonus'],
  perk_quest: ['퀘스트 보상 +{p}%', '+{p}% quest rewards'],
  typeName: ['{type} 타입', '{type} type'],

  // 도감
  dexTitle: ['도감 {a} / {b}', 'Dex {a} / {b}'],
  dexSub: ['파트너는 언제든 바꿀 수 있어요. 쉬는 친구도 자란 만큼 그대로 기억해요.', 'Switch partners any time. Resting friends remember exactly how far they grew.'],
  dexPartner: ['함께하는 중', 'Your partner'],
  dexResting: ['쉬는 중 · Lv.{lv} {stage}', 'Resting · Lv.{lv} {stage}'],
  dexUnmet: ['아직 못 만났어요', 'Not met yet'],
  dexSwitch: ['함께하기', 'Team up'],
  dexAdopt: ['알 받기', 'Take the egg'],
  switchConfirm: ['{name}{wa} 다시 함께할까요? 지금 파트너 {cur}{neun} 도감에서 쉬면서 자란 만큼 기억해요.', 'Team up with {name} again? {cur} will rest in the dex and keep its progress.'],
  adoptConfirm: ['{kind} 알을 받을까요? 알부터 새로 키워요. 지금 파트너 {cur}{neun} 도감에서 쉬면서 자란 만큼 기억해요.', 'Take the {kind} egg? It starts from an egg. {cur} will rest in the dex and keep its progress.'],
  adopted: ['🥚 {kind} 알을 받았어요!', '🥚 You got a {kind} egg!'],

  // 화면 펫에 마우스를 올리면 뜨는 상태 창
  hudHint: ['클릭 쓰다듬기 · 끌어서 옮기기 · 더블클릭 하우스 · 우클릭 메뉴', 'Click to pet · drag to move · double-click for the house · right-click for more'],

  // 상단
  loadingMemory: ['기억을 떠올리는 중… {p}%', 'Remembering your notes… {p}%'],
  readingVault: ['볼트를 읽는 중…', 'Reading your vault…'],
  xpOf: ['{a} / {b} XP', '{a} / {b} XP'],
  streakDays: ['일 연속', 'day streak'],

  // 홈
  todayChars: ['오늘 쓴 글자', 'Written today'],
  todayLinks: ['오늘 건 링크', 'Links today'],
  todayNotes: ['오늘 새 노트', 'New notes today'],
  attendance: ['출석', 'Streak'],
  attendanceSub: ['최고 {b} · 총 {t}일', 'best {b} · {t} days'],
  roadmap: ['성장 로드맵', 'Growth roadmap'],
  toNext: ['{stage}까지 {xp} XP 남았어요', '{xp} XP to {stage}'],
  grownUp: ['다 자랐어요! 🎉', 'All grown up! 🎉'],
  play: ['같이 놀기', 'Play'],
  actPoke: ['🤲 쓰다듬기', '🤲 Pet'],
  actWave: ['👋 인사하기', '👋 Wave'],
  actStretch: ['🙆 같이 스트레칭', '🙆 Stretch together'],
  actQuietOn: ['🔕 방해 금지 1시간', '🔕 Quiet for 1 hour'],
  actQuietOff: ['🔔 방해 금지 끄기', '🔔 End quiet mode'],
  actShow: ['🐾 펫 꺼내기', '🐾 Show pet'],
  actHide: ['🙈 펫 숨기기', '🙈 Hide pet'],
  actPosition: ['📍 위치 초기화', '📍 Reset position'],
  recentXp: ['최근 받은 경험치', 'Recent bonus XP'],
  recentXpEmpty: ['퀘스트와 업적을 달성하면 여기에 쌓여요', 'Quests and badges you earn show up here'],
  cardTipTitle: ['노트에 펫 카드 넣기', 'Put the pet in a note'],
  cardTip: ['노트에 코드 블록 `vault-pet` 을 넣으면 그 자리에 펫 카드가 떠요. 명령어 팔레트의 “펫 카드 넣기”로도 넣을 수 있어요.', 'Add a `vault-pet` code block to any note and a live pet card appears there. Or run “Insert pet card” from the command palette.'],

  // 퀘스트
  questsTitle: ['오늘의 퀘스트', "Today's quests"],
  questsSub: ['매일 자정에 새 퀘스트 3개가 나와요 · 새 퀘스트까지 {h}시간 {m}분', 'Three new quests every midnight · next in {h}h {m}m'],
  allClearDone: ['🎉 오늘 퀘스트 올클리어! 보너스 +{xp} XP를 받았어요', '🎉 All quests cleared! +{xp} XP bonus received'],
  allClearTodo: ['3개 모두 깨면 보너스 +{xp} XP 🎁', 'Clear all three for a +{xp} XP bonus 🎁'],
  questsTip: ['💡 퀘스트는 달성하는 순간 자동으로 보상을 받아요. 지금까지 깬 퀘스트: {n}개', '💡 Rewards are paid the moment a quest is done. Quests cleared so far: {n}'],

  // 업적
  badgesTitle: ['업적 {a} / {b}', 'Badges {a} / {b}'],

  // 꾸미기
  colorsTitle: ['몸 색깔', 'Colors'],
  itemsTitle: ['꾸미기', 'Accessories'],
  wardrobeEgg: ['알에서 깨어나면 입을 수 있어요. 지금은 미리보기만 돼요 🥚', 'Hatch first to wear things. For now you can only look 🥚'],
  wardrobeHint: ['눌러서 입혀 보세요. 레벨과 업적으로 새 아이템이 열려요.', 'Click to try one on. Levels and badges unlock more.'],
  wearing: ['착용 중', 'Wearing'],
  lockedAt: ['🔒 {hint}에 열려요', '🔒 Unlocks at {hint}'],
  eggCantWear: ['🥚 알에서 깨어나면 입을 수 있어요', '🥚 Hatch first to wear accessories'],
  woreItem: ['{icon} {name} 착용!', '{icon} Wearing {name}!'],
  tookOff: ['장식을 벗었어요', 'Accessory removed'],
  paintedColor: ['🎨 {name} 색으로 바꿨어요', '🎨 Switched to {name}'],
  isNew: ['NEW', 'NEW'],
  hintLevel: ['Lv.{n}', 'Lv.{n}'],
  hintBadge: ['업적 「{name}」', 'badge “{name}”'],

  // 통계
  chart14: ['최근 14일 쓴 글자', 'Characters written, last 14 days'],
  chartHours: ['시간대별 작업량', 'When you write'],
  totalsTitle: ['누적 기록', 'All-time'],
  totChars: ['쓴 글자', 'Characters written'],
  totLinks: ['건 링크', 'Links made'],
  totNotes: ['만든 노트', 'Notes created'],
  totPokes: ['쓰다듬은 횟수', 'Times petted'],
  xpTitle: ['경험치 내역', 'Where XP comes from'],
  xpWriting: ['글쓰기 경험치', 'Writing XP'],
  xpBonus: ['보너스 (업적·퀘스트·출석)', 'Bonus (badges, quests, streak)'],
  xpStart: ['시작 단계 보너스', 'Starting stage'],
  xpFrozen: ['쉬기 전에 모은 경험치', 'XP from earlier stints'],
  xpTotal: ['합계', 'Total'],
  xpFormula: ['글자 {c}자 = 1XP · 링크 1개 = {l}XP · 새 노트 1개 = {n}XP. 파일마다 가장 많았던 글자·링크 수보다 늘어난 만큼만 세요. 한 번에 붙여 넣은 양은 {cap}자까지만 들어가요.', '{c} characters = 1 XP · 1 link = {l} XP · 1 new note = {n} XP. Only growth past each file’s previous high counts, and one big paste counts for at most {cap} characters.'],
  hubsTitle: ['허브 노트 (백링크 순)', 'Hub notes (by backlinks)'],
  hubsEmpty: ['아직 링크가 모인 노트가 없어요', 'No note has backlinks yet'],
  backlinks: ['백링크 {n}', '{n} backlinks'],
  chartTip: ['{day} · {c}자 · 링크 {l} · 새 노트 {n}', '{day} · {c} chars · {l} links · {n} new notes'],
  hourTip: ['{h}시', '{h}:00'],

  // 말풍선 링크
  hintAchievements: ['눌러서 업적 보기', 'Click to see badges'],
  hintQuests: ['눌러서 퀘스트 보기', 'Click to see quests'],
  hintWardrobe: ['눌러서 꾸미기', 'Click to dress up'],
  hintDex: ['눌러서 도감 보기', 'Click to open the dex'],

  // 상태 카드
  cardEggLoading: ['알 속에서 준비 중', 'Getting ready in the egg'],
  cardStage: ['{a} → {b} {p}%', '{a} → {b} {p}%'],
  cardGrown: ['{a} · 다 자랐어!', '{a} · all grown up!'],
  cardToday: ['오늘 ✍️{c} · 🔗{l} · 📄{n}', 'Today ✍️{c} · 🔗{l} · 📄{n}'],

  // 반응
  evolving: ['어라…? {name}의 모습이…!', 'Huh…? {name} is changing…!'],
  grew: ['{name}{i} {stage}{ro} 자랐어! 🎉', '{name} grew into a {stage}! 🎉'],
  levelUp: ['레벨 업! Lv.{n} ✨', 'Level up! Lv.{n} ✨'],
  gotBadge: ['🏅 업적 달성! 「{name}」 +{xp}XP', '🏅 Badge earned: “{name}” +{xp} XP'],
  questDone: ['✅ 퀘스트 완료! {text} +{xp}XP', '✅ Quest done: {text} +{xp} XP'],
  allClear: ['🎉 오늘 퀘스트 올클리어! +{xp}XP', '🎉 All quests cleared! +{xp} XP'],
  newItem: ['🎁 새 꾸미기: {icon} {name}! 눌러서 입혀줘', '🎁 New item: {icon} {name}! Click to try it on'],
  newColor: ['🎨 새 색깔: {name}! 눌러서 바꿔 봐', '🎨 New color: {name}! Click to try it'],
  retro: ['지금까지 쓴 노트로 업적 {n}개를 달성했어! 🏅', 'Your notes so far already earned {n} badges! 🏅'],
  attendFirst: ['오늘 첫 출석! +{xp}XP', 'First visit today! +{xp} XP'],
  attendStreak: ['🔥 출석 {n}일째! +{xp}XP', '🔥 {n}-day streak! +{xp} XP'],
  restedMeal: ['맛있게 먹었어? 😋', 'Was it tasty? 😋'],
  restedRest: ['잘 쉬고 왔어? 💚', 'Feeling refreshed? 💚'],
  milestone: ['오늘 {n}자 돌파! ✍️', '{n} characters today! ✍️'],
  attendBonus: ['출석 {n}일째', 'Streak day {n}'],
  badgeBonus: ['업적: {name}', 'Badge: {name}'],
  questBonus: ['퀘스트: {text}', 'Quest: {text}'],
  allClearBonus: ['오늘의 퀘스트 올클리어', 'All quests cleared'],

  // 메뉴·명령
  cmdOpen: ['펫 하우스 열기', 'Open pet house'],
  cmdToggle: ['펫 보이기/숨기기', 'Show or hide the pet'],
  cmdPoke: ['펫 쓰다듬기', 'Pet the pet'],
  cmdQuiet: ['방해 금지 1시간 켜기/끄기', 'Toggle quiet mode for 1 hour'],
  cmdPosition: ['펫 위치 초기화', 'Reset pet position'],
  cmdCard: ['펫 카드 넣기', 'Insert pet card'],
  cmdDex: ['도감 열기 (파트너 바꾸기)', 'Open the dex (change partner)'],
  cmdRoam: ['돌아다니기 켜기/끄기', 'Toggle walking around'],
  menuPoke: ['쓰다듬기', 'Pet'],
  menuHouse: ['펫 하우스 열기', 'Open pet house'],
  menuDex: ['도감 (파트너 바꾸기)', 'Dex (change partner)'],
  menuRoamOn: ['돌아다니기', 'Walk around'],
  menuRoamOff: ['여기 가만히 있기', 'Stay here'],
  roamOnToast: ['🐾 다시 산책할게요', '🐾 Back to strolling'],
  roamOffToast: ['📍 여기 가만히 있을게요', '📍 I’ll stay right here'],
  menuQuietOn: ['방해 금지 1시간', 'Quiet for 1 hour'],
  menuQuietOff: ['방해 금지 끄기', 'End quiet mode'],
  menuPosition: ['위치 초기화', 'Reset position'],
  menuHide: ['펫 숨기기', 'Hide pet'],
  quietToast: ['🔕 1시간 동안 조용히 있을게요', '🔕 I’ll stay quiet for an hour'],
  unquietToast: ['🔔 다시 말할게요', '🔔 Talking again'],
  hiddenToast: ['🙈 펫을 숨겼어요. 명령어 팔레트나 펫 하우스에서 다시 꺼낼 수 있어요', '🙈 Pet hidden. Bring it back from the command palette or the pet house'],
  positionToast: ['📍 오른쪽 아래로 돌아왔어요', '📍 Back in the bottom-right corner'],
  statusTip: ['{name} · Lv.{lv} {stage} · 눌러서 하우스 열기', '{name} · Lv.{lv} {stage} · click to open the house'],

  // 첫 실행
  wNext: ['다음', 'Next'],
  wBack: ['이전', 'Back'],
  wStart: ['시작하기 ✨', 'Let’s go ✨'],
  w0Title: ['노트 세계에 온 걸 환영해요!', 'Welcome to the world of notes!'],
  w0Body: ['여기 다섯 친구가 <b>노트를 먹고 자라요</b>. 글자를 쓰고, 링크를 걸고, 새 노트를 만들 때마다 경험치가 들어와요.', 'Five little friends here <b>grow by eating your notes</b>. Every character you type, link you make and note you create earns XP.'],
  w0b1: ['편집 화면 아래를 산책하다가, 글을 쓰면 옆에 앉아 <b>같이 써요</b>. 점심·휴식·잠잘 시간도 챙겨줘요', 'It strolls along the bottom of the editor and sits down to <b>write with you</b> when you type. It reminds you about lunch, breaks and bedtime too'],
  w0b2: ['<b>일일 퀘스트·업적·출석</b>으로 보너스 경험치를 받아요', '<b>Daily quests, badges and streaks</b> give bonus XP'],
  w0b3: ['알에서 어른까지 자라고, 레벨이 오르면 <b>꾸미기 아이템과 색깔</b>이 열려요', 'Watch it grow from an egg to an adult, and unlock <b>accessories and colors</b> as it levels up'],
  wPickTitle: ['함께할 친구를 골라 주세요', 'Choose your partner'],
  wPickSub: ['모두 노트를 먹고 자라지만 성격과 특기가 달라요. 다른 친구는 나중에 도감에서 만날 수 있어요.', 'They all grow on your notes, but each has its own personality and perk. You can meet the others later in the dex.'],
  wPickGo: ['{name}{ro} 할래요!', 'I choose {name}!'],
  wEvolution: ['자라는 모습', 'How it grows'],
  wMigrateTitle: ['새 친구들이 왔어요!', 'New friends have arrived!'],
  wMigrateBody: ['이제 다섯 친구 중에서 파트너를 고를 수 있어요. 지금까지 키운 성장은 고른 친구가 그대로 이어받아요.', 'You can now pick your partner from five friends. Everything you’ve grown so far carries over to the one you choose.'],
  w1Title: ['이름과 시작 방식', 'Name and starting point'],
  w1TitleName: ['이름을 지어 주세요', 'Give it a name'],
  w1Name: ['이름', 'Name'],
  w1Reading: ['⏳ 지금까지 쓴 노트를 읽는 중이에요… {p}%', '⏳ Reading the notes you already have… {p}%'],
  w1Result: ['지금까지 쓴 노트로 계산하면 <b>Lv.{lv} {stage}</b>{ieyo}.', 'Counting the notes you already have, that’s <b>Lv.{lv} {stage}</b>.'],
  modeAll: ['지금까지 쓴 노트를 전부 반영', 'Count everything I’ve written'],
  modeAllSub: ['써 온 만큼 이미 자란 모습으로 시작해요', 'Start as big as your vault already is'],
  modeFresh: ['알부터 새로 키우기', 'Start from an egg'],
  modeFreshSub: ['지금부터 쓰는 만큼만 자라요', 'Only what you write from now on counts'],
  modeStage: ['원하는 단계에서 시작', 'Start at a stage I pick'],
  modeStageSub: ['고른 단계에서 시작해서, 지금부터 쓰는 만큼 자라요', 'Start at that stage, then grow with what you write'],
  w1Later: ['나중에 설정에서 언제든 바꿀 수 있어요.', 'You can change this later in the settings.'],
  w2Title: ['준비 끝!', 'All set!'],
  w2b1: ['펫을 <b>클릭</b>하면 쓰다듬고, <b>끌어서</b> 옮기고, <b>더블클릭</b>하면 하우스가 열려요', '<b>Click</b> the pet to pet it, <b>drag</b> it around, <b>double-click</b> to open the house'],
  w2b2: ['<b>우클릭</b>하면 방해 금지·산책 끄기·숨기기 메뉴가 나와요', '<b>Right-click</b> for quiet mode, staying put and hiding'],
  w2b3: ['왼쪽 리본의 발바닥 아이콘이나 아래 상태 표시줄에서도 하우스를 열 수 있어요', 'The paw icon in the ribbon and the status bar open the house too'],
  w2b4: ['노트에 <code>vault-pet</code> 코드 블록을 넣으면 펫 카드가 떠요', 'A <code>vault-pet</code> code block shows a pet card inside a note'],
  w2b5: ['하우스의 <b>도감</b>에서 다른 친구의 알을 받거나 파트너를 바꿀 수 있어요', 'In the house <b>dex</b> you can take another friend’s egg or switch partners'],

  // 설정
  sCharacter: ['캐릭터', 'Character'],
  sPartner: ['파트너', 'Partner'],
  sPartnerDesc: ['{icon} {kind} · 특기: {perk}', '{icon} {kind} · Perk: {perk}'],
  sPartnerBtn: ['도감 열기', 'Open dex'],
  sName: ['이름', 'Name'],
  sNameDesc: ['지금 파트너의 이름', 'Your current partner’s name'],
  sLanguage: ['언어', 'Language'],
  sLanguageDesc: ['자동은 옵시디언 언어를 따라가요', 'Auto follows Obsidian’s language'],
  sAuto: ['자동', 'Auto'],
  sShow: ['화면에 펫 띄우기', 'Show the pet on screen'],
  sShowDesc: ['끄면 펫 하우스와 노트 카드에서만 보여요', 'When off, the pet only appears in the house and in note cards'],
  sRoam: ['돌아다니기', 'Walk around'],
  sRoamDesc: ['편집 화면 아래쪽을 산책해요. 글을 쓰는 동안에는 제자리에서 같이 써요.', 'Strolls along the bottom of the editor. While you write it stays put and writes with you.'],
  sScale: ['크기', 'Size'],
  sScaleDesc: ['화면에서 보이는 배율', 'How big the pet is drawn'],
  sStatus: ['상태 표시줄에 레벨 보이기', 'Show level in the status bar'],
  sFont: ['도트 글꼴', 'Pixel font'],
  sFontDesc: ['펫 화면을 갈무리 도트 글꼴로 보여줘요', 'Use the Galmuri pixel font in the pet’s UI'],
  sBubbles: ['말풍선', 'Speech bubbles'],
  sBubblesDesc: ['꺼도 보상 말풍선은 보여요', 'Reward bubbles still show when off'],
  sChatter: ['가끔 수다 떨기', 'Small talk'],
  sChatterDesc: ['쓰는 중에 30분쯤마다 한마디', 'A line every 30 minutes or so while you write'],
  sSound: ['효과음', 'Sound effects'],
  sSoundDesc: ['레벨 업·업적·링크 때 작은 8비트 소리, 쓰다듬으면 친구마다 다른 울음소리', 'Tiny 8-bit sounds for level-ups, badges and links, and each friend’s own cry when petted'],
  sLife: ['생활 알림', 'Reminders'],
  sLunch: ['점심 알림', 'Lunch reminder'],
  sDinner: ['저녁 알림', 'Dinner reminder'],
  sRest: ['휴식 권유 (분)', 'Break reminder (minutes)'],
  sRestDesc: ['쉬지 않고 이만큼 쓰면 쉬자고 해요', 'Suggests a break after this long without one'],
  sSleepy: ['졸기 시작 (분)', 'Gets sleepy after (minutes)'],
  sSleepyDesc: ['아무것도 안 한 지 이만큼 지나면', 'Minutes without any activity'],
  sSleep: ['잠들기 (분)', 'Falls asleep after (minutes)'],
  sLate: ['새벽 잔소리', 'Late-night nagging'],
  sLateDesc: ['새벽 1~5시에 쓰고 있으면 자러 가자고 해요', 'Tells you to go to bed if you write between 1 and 5 AM'],
  sGrowth: ['성장', 'Growth'],
  sMode: ['성장 시작 방식', 'Starting point'],
  sModeDesc: ['지금 파트너에게 적용돼요. 바꾼 뒤 “다시 시작”을 누르면 반영돼요. 업적과 아이템은 그대로 남아요.', 'Applies to your current partner. Press “Restart” to apply. Badges and items are kept.'],
  sStartStage: ['시작 단계', 'Starting stage'],
  sRestart: ['다시 시작', 'Restart'],
  sRestartConfirm: ['{name}{eul} {label} 다시 키울까요? 업적과 꾸미기 아이템은 그대로 남아요.', 'Restart {name} {label}? Badges and items are kept.'],
  sRestartAll: ['지금까지 쓴 노트를 전부 반영해서', 'counting everything written so far'],
  sRestartFresh: ['알부터 새로', 'from an egg'],
  sRestartStage: ['{stage} 단계부터', 'from the {stage} stage'],
  sRestarted: ['✨ 새로 시작했어요', '✨ Restarted'],
  sExclude: ['세지 않을 폴더', 'Folders to ignore'],
  sExcludeDesc: ['한 줄에 하나씩. 이 폴더 안에서 생기는 변화는 경험치에 넣지 않아요 (템플릿·첨부 폴더 등). 이미 센 기록은 그대로 남아요.', 'One per line. Changes inside these folders earn no XP (templates, attachments…). What was already counted stays.'],
  sOther: ['기타', 'Other'],
  sWelcome: ['첫 실행 안내 다시 보기', 'Show the welcome tour again'],
  sOpen: ['열기', 'Open'],
  sPosition: ['펫 위치 초기화', 'Reset pet position'],
  sReset: ['초기화', 'Reset'],
  sRecount: ['처음부터 다시 세기', 'Recount from scratch'],
  sRecountDesc: ['날짜별 기록을 지우고 볼트를 다시 읽어요. 노트 만든 날짜로 기록을 다시 채워요. 업적·아이템·보너스는 그대로 남아요.', 'Clears the daily history and reads the vault again, filing notes under the day they were created. Badges, items and bonus XP are kept.'],
  sRecountConfirm: ['날짜별 기록을 지우고 볼트를 다시 읽을까요?', 'Clear the daily history and read the vault again?'],
  sRecountDone: ['다시 셌어요', 'Recounted'],
  sWipe: ['모든 기록 지우기', 'Erase everything'],
  sWipeDesc: ['친구들, 업적, 아이템, 기록을 모두 지우고 처음부터 시작해요.', 'Deletes every friend, badge, item and all history, and starts over.'],
  sWipeConfirm: ['정말 모든 기록을 지우고 처음부터 다시 시작할까요? 되돌릴 수 없어요.', 'Really erase everything and start over? This can’t be undone.'],
  sWipeDone: ['모두 지웠어요. 새 친구들이 기다리고 있어요 🥚', 'Everything erased. New friends are waiting 🥚'],
  sFormula: ['경험치 계산', 'How XP works'],
  sPrivacy: ['노트 내용은 저장하지도, 어디로 보내지도 않아요. 경로별 글자·링크 수와 날짜별 합계만 이 플러그인 폴더의 data.json 에 남아요.', 'Note contents are never stored or sent anywhere. Only per-file character and link counts and daily totals are kept, in this plugin’s data.json.'],
  confirm: ['확인', 'OK'],
  cancel: ['취소', 'Cancel'],
};

// 무작위로 고르는 대사. [한국어 줄들, English lines]
const LINES = {
  morning: [['좋은 아침! 오늘은 뭐 써 볼까? ☀️', '굿모닝! 커피는 마셨어?', '아침이다! 오늘도 한 줄씩 가 보자'], ['Good morning! What shall we write today? ☀️', 'Morning! Had your coffee yet?', 'A new day, a new page!']],
  back: [['왔구나! 기다렸어', '돌아왔다! 이어서 써 볼까?', '음냐… 어, 왔어?'], ['You’re back! I missed you', 'Welcome back! Shall we keep going?', 'Mmh… oh, you’re here?']],
  lunch: [['점심 먹자! 🍚', '배고파… 밥 먹고 쓰자!', '점심시간이다! 뭐 먹을까?'], ['Lunch time! 🍚', 'I’m hungry… let’s eat first!', 'It’s lunch o’clock! What are we having?']],
  dinner: [['저녁 먹을 시간이야 🍜', '저녁은 먹고 써야지!', '배꼽시계 울린다… 저녁 먹자'], ['Dinner time 🍜', 'Eat something before you write more!', 'My tummy is rumbling… dinner?']],
  rest: [['벌써 {d}째야. 스트레칭 한 번 할까?', '{d} 동안 달렸어! 물 한 잔 마시고 오자 💧', '쉬엄쉬엄 하자~ {d}째 쉬지 않았어'], ['{d} straight already. Stretch with me?', 'You’ve been at it for {d}! Go grab some water 💧', 'Easy does it — {d} without a break']],
  late: [['새벽 {h}시야… 오늘은 여기까지 할까? 🌙', '하암… 나 졸려. 우리 이제 자자', '내일의 내가 써 줄 거야. 자러 가자!'], ['It’s {h} AM… call it a night? 🌙', 'Yawn… I’m sleepy. Bedtime?', 'Tomorrow-you can finish this. Let’s sleep!']],
  chatter: [['오늘 {c}자째! 손가락 괜찮아?', '나도 옆에서 응원하는 중 📣', '막히면 잠깐 산책도 좋아', '이 노트, 다른 노트랑 이어 볼까? 🔗', '생각은 적어 두면 내 거야'], ['{c} characters today! How are your fingers?', 'Cheering for you over here 📣', 'Stuck? A short walk helps', 'Could this note link to another one? 🔗', 'An idea written down is an idea kept']],
  link: [['연결 완료! 🔗', '노트끼리 친구가 됐어!', '지식이 이어진다~', '링크 냠냠 😋'], ['Linked! 🔗', 'Two notes just became friends!', 'The web grows~', 'Yum, a link 😋']],
  note: [['새 노트다! 📄 뭐 쓸 거야?', '빈 페이지는 언제나 설레', '새 노트 탄생! 이름 멋지다'], ['A new note! 📄 What goes in it?', 'Blank pages are exciting', 'A note is born!']],
  poke: [['헤헤', '간지러워!', '♪', '좋아!', '더 써 줘!'], ['Hehe', 'That tickles!', '♪', 'Yay!', 'Write more!']],
  egg: [['(꿈틀꿈틀)', '(톡톡…)', '(따뜻해…)', '(…!)'], ['(wiggle wiggle)', '(tap tap…)', '(so warm…)', '(…!)']],
  eggHungry: [['(꼬르륵…)'], ['(grumble…)']],
  eggRoll: [['(데굴… 데굴…)'], ['(roll… roll…)']],
  hello: [['안녕! 나는 {name}. 같이 써 보자!'], ["Hi! I'm {name}. Let's write together!"]],
};

// 친구마다 말투가 다르다. 여기 있는 키는 LINES 대신 이걸 쓴다
const SPECIES_LINES = {
  inky: {
    hello: [['안, 안녕…! 나는 {name}. 오늘부터 같이 써 줄래?'], ['H-hi…! I’m {name}. Will you write with me from today?']],
    poke: [['헤헤… 간지러워요', '잉… 부끄러워', '♪', '한 방울만큼 더 힘낼게요!', '(볼이 조금 진해졌다)'], ['Hehe… that tickles', 'Eep… so shy', '♪', 'I’ll try one drop harder!', '(its cheeks turned a shade darker)']],
    link: [['잉크 선으로 이었어요! 🔗', '노트끼리 손잡았다…!', '연결 완료… 뿌듯해요'], ['Joined with a line of ink! 🔗', 'The notes are holding hands…!', 'Linked… I’m proud']],
    note: [['새 페이지…! 첫 글자는 뭘로 할까요?', '하얀 종이 냄새… 좋아요'], ['A new page…! What will the first letter be?', 'That fresh-paper smell… I love it']],
    morning: [['좋은 아침이에요… 잉크 채워 뒀어요 ☀️', '오늘도 한 줄씩, 천천히 가요'], ['Good morning… I refilled the ink ☀️', 'One line at a time again today']],
    back: [['아, 왔다…! 기다리고 있었어요', '돌아왔네요. 이어서 써 볼까요?'], ['Oh, you’re back…! I was waiting', 'Welcome back. Shall we keep going?']],
    chatter: [['오늘 {c}자째… 손목은 괜찮아요?', '저, 조용히 응원하고 있어요 📣', '잉크는 아직 넉넉해요!', '막히면 한 문장만 더 써 봐요'], ['{c} characters today… how’s your wrist?', 'I’m cheering quietly over here 📣', 'Plenty of ink left!', 'Stuck? Just one more sentence']],
    rest: [['벌써 {d}째예요… 펜 잠깐 내려놓을까요?'], ['{d} straight… put the pen down for a bit?']],
    egg: [['(찰랑찰랑)', '(톡톡…)', '(잉크 냄새가 난다…)'], ['(slosh slosh)', '(tap tap…)', '(it smells like ink…)']],
  },
  purrl: {
    hello: [['냥! 나는 {name}. 같이 노트를 엮어 보자냥!'], ['Mew! I’m {name}. Let’s knit some notes together!']],
    poke: [['냐앙~', '골골골… ♪', '거기 거기! 더 긁어줘냥', '냥냥펀치! 🐾', '(꼬리가 살랑살랑)'], ['Mrrrow~', 'Purrrr… ♪', 'Right there! More scritches', 'Paw punch! 🐾', '(tail swish swish)']],
    link: [['실 한 가닥 이었다냥! 🧶', '골골골… 링크는 최고야', '노트끼리 꽁꽁 묶었다냥', '또 이어 줘! 또!'], ['Tied another thread! 🧶', 'Purrr… links are the best', 'Knotted those notes together', 'Again! Link another!']],
    note: [['새 노트다냥! 킁킁', '빈 페이지 위에서 뒹굴어도 돼?'], ['A new note! *sniff sniff*', 'Can I roll around on the blank page?']],
    morning: [['냐아암… 좋은 아침이냥 ☀️', '아침이다! 실타래 풀 시간이야'], ['Mrrawn… good morning ☀️', 'Morning! Time to unravel some yarn']],
    back: [['어디 갔다 왔냥! 기다렸잖아', '왔다냥! 쓰다듬어 줘'], ['Where were you?! I waited', 'You’re back! Pet me, pet me']],
    chatter: [['오늘 {c}자째냥! 대단해', '이 노트, 저 노트랑 이어 보면 어때냥? 🔗', '키보드 위에 앉아도 돼…?', '졸리다냥… 아니 안 졸려!'], ['{c} characters today! Impressive', 'What if this note linked to that one? 🔗', 'Can I sit on your keyboard…?', 'So sleepy… no wait, not sleepy!']],
    rest: [['{d}째 달렸다냥. 기지개 쭉~ 같이 켜자'], ['{d} straight. A big stretch with me~']],
    lunch: [['츄르… 아니 점심 먹자냥! 🍚', '배고프다냥… 밥 먹고 하자'], ['Treats… I mean, lunch time! 🍚', 'So hungry… let’s eat first']],
    dinner: [['저녁 먹을 시간이다냥 🐟', '생선… 아니 저녁 먹자!'], ['Dinner time 🐟', 'Fish… I mean, dinner!']],
    egg: [['(꼬물꼬물)', '(…냥?)', '(데굴데굴)'], ['(wriggle wriggle)', '(…mew?)', '(roll roll)']],
  },
  sprig: {
    hello: [['안녕~ 나는 {name}. 매일 조금씩 같이 자라자~'], ['Hi~ I’m {name}. Let’s grow a little every day~']],
    poke: [['헤헤~ 쑥쑥 자라는 기분', '잎사귀 간지러워~', '♪ (살랑살랑)', '물 준 거야? 고마워~', '천천히~ 꾸준히~'], ['Hehe~ I can feel myself growing', 'My leaves tickle~', '♪ (sway sway)', 'Did you water me? Thanks~', 'Slow~ and steady~']],
    link: [['뿌리끼리 이어졌다~ 🔗', '노트 숲이 조금 더 우거졌어'], ['Our roots just connected~ 🔗', 'The note forest grew a little thicker']],
    note: [['새싹 노트다~ 🌱', '작은 씨앗 하나 심었네~'], ['A sprout of a note~ 🌱', 'You planted a tiny seed~']],
    morning: [['좋은 아침~ 햇볕이 좋다 ☀️', '오늘도 조금씩만 하자~'], ['Good morning~ lovely sunshine ☀️', 'Just a little today, like always~']],
    back: [['왔구나~ 물 주러 왔어?', '기다렸어~ 천천히 해도 돼'], ['You’re here~ came to water me?', 'I waited~ take your time']],
    chatter: [['오늘 {c}자째~ 꾸준함이 최고야', '물 한 잔 마셔~ 나도 마실게 💧', '급할 거 없어~', '한 줄이라도 쓰면 자란 거야'], ['{c} characters today~ steady wins', 'Drink some water~ I will too 💧', 'No rush~', 'Even one line is growth']],
    rest: [['{d}째야~ 햇볕 쬐러 잠깐 나가자'], ['{d} already~ let’s go catch some sun']],
    egg: [['(쑥…)', '(따뜻해…)', '(새싹이 삐죽)'], ['(sprout…)', '(so warm…)', '(a sprout peeks out)']],
  },
  ember: {
    hello: [['크앙! 나는 {name}! 아이디어를 활활 태워 보자!'], ['Rawr! I’m {name}! Let’s set some ideas on fire!']],
    poke: [['화르륵! 🔥', '헤헤, 따뜻하지?', '더 불태우자!', '크아앙! …놀랐어?', '(콧김이 폴폴)'], ['Fwoosh! 🔥', 'Hehe, warm, right?', 'Let’s burn brighter!', 'RAWR! …did I scare you?', '(little puffs of smoke)']],
    link: [['불꽃처럼 번졌다! 🔗', '연결! 연결! 더 해!'], ['It spread like wildfire! 🔗', 'Linked! Linked! More!']],
    note: [['새 노트다!! 🔥 뭐 쓸 거야, 뭐 쓸 거야?', '빈 노트는 못 참지!', '아이디어 점화 완료!'], ['A new note!! 🔥 What’s in it, what’s in it?', 'I can’t resist a blank note!', 'Idea: ignited!']],
    morning: [['좋은 아침! 오늘도 불태우자! ☀️', '일어났다! 꼬리 불꽃 충전 완료'], ['Morning! Let’s burn bright today! ☀️', 'Up and ready! Tail flame fully charged']],
    back: [['왔다! 불씨 지키고 있었어!', '늦었잖아! 빨리 쓰자!'], ['You’re back! I kept the fire going!', 'You’re late! Let’s write, quick!']],
    chatter: [['오늘 {c}자! 기세 좋아! 🔥', '번뜩! 새 아이디어 없어?', '불태워! 근데 너무 무리는 말고', '다음 노트는 뭐야? 궁금해!'], ['{c} characters today! On fire! 🔥', 'Flash! Got a new idea?', 'Burn bright! But don’t burn out', 'What’s the next note? Tell me!']],
    rest: [['{d}째 불태웠어! 잠깐 식히자 🧊'], ['{d} of burning! Let’s cool down a bit 🧊']],
    egg: [['(따끈따끈)', '(퐁! 연기가 났다)', '(…!)'], ['(warm, warm)', '(poof! a puff of smoke)', '(…!)']],
  },
  dewey: {
    hello: [['부엉. 나는 {name}. 오늘부터 네 기록을 함께 정리하지.'], ['Hoo. I am {name}. From today, I shall help you keep your records.']],
    poke: [['부엉! 🦉', '흠흠, 학자에게 무례하군… 한 번 더', '깃털 고르던 중이었는데…', '부엉부엉 ♪', '(고개를 갸웃)'], ['Hoo! 🦉', 'Ahem, how undignified… again, please', 'I was preening…', 'Hoo-hoo ♪', '(tilts its head)']],
    link: [['참고 문헌 추가! 🔗', '흥미롭군, 두 지식이 이어졌어', '색인이 풍성해지는군'], ['Reference added! 🔗', 'Fascinating, two ideas connected', 'The index grows richer']],
    note: [['새 항목 등록! 📄', '분류 번호를 붙여 줄까?'], ['New entry catalogued! 📄', 'Shall I give it a call number?']],
    morning: [['좋은 아침… 하암, 난 원래 야행성이야 ☀️', '아침 공부는 효율이 좋지'], ['Good morning… yawn, I’m nocturnal, you know ☀️', 'Morning study is the most efficient']],
    back: [['돌아왔군. 어디까지 읽었더라?', '기다리는 동안 책 세 권 읽었어'], ['You’re back. Where were we?', 'I read three books while I waited']],
    chatter: [['오늘 {c}자. 훌륭한 기록이야', '그 노트, 출처를 적어 두면 좋겠어', '밤이 깊을수록 머리가 맑아지지 🌙', '오늘 퀘스트는 확인했나? 부엉'], ['{c} characters today. A fine record', 'That note could use a source', 'The deeper the night, the clearer my mind 🌙', 'Checked today’s quests? Hoo']],
    late: [['새벽 {h}시… 나야 좋지만, 넌 자야 해 🌙'], ['{h} AM… fine for me, but you need sleep 🌙']],
    rest: [['{d}째 집중했군. 눈을 좀 쉬게 하렴'], ['{d} of focus. Rest your eyes a little']],
    egg: [['(부…엉?)', '(똑똑…)', '(사각사각)'], ['(hoo…?)', '(knock knock…)', '(scratch scratch)']],
  },
};

let LANG = 'en';
let CUR = 'inky'; // 지금 파트너. 대사를 고를 때 쓴다

function detectLang(pref) {
  if (pref === 'ko' || pref === 'en') return pref;
  // 옵시디언이 언어를 따로 저장하지 않으면 시스템 언어를 쓴다. 그 결과가 <html lang> 에 들어간다
  let sys = '';
  try {
    if (typeof obsidian.getLanguage === 'function') sys = obsidian.getLanguage();
    if (!sys && typeof document !== 'undefined') sys = document.documentElement.lang || '';
    if (!sys && typeof navigator !== 'undefined') sys = navigator.language || '';
  } catch {
    // 못 읽으면 영어
  }
  return String(sys).toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

const li = () => (LANG === 'ko' ? 0 : 1);

function fill(s, vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

function t(key, vars) {
  const e = S[key];
  return fill(e ? e[li()] : key, vars);
}

// 무작위 대사. 지금 파트너만의 대사가 있으면 그걸 쓴다
function tl(key, vars, species = CUR) {
  const own = SPECIES_LINES[species] && SPECIES_LINES[species][key];
  const arr = (own || LINES[key])[li()];
  return fill(arr[Math.floor(Math.random() * arr.length)], vars);
}

// [한국어, English] 쌍에서 지금 언어를 고른다
const tr = (pair) => (Array.isArray(pair) ? pair[li()] : pair);

// 받침이 있으면 a, 없으면 b
function josa(word, a, b) {
  const c = String(word).charCodeAt(String(word).length - 1) - 0xac00;
  return c >= 0 && c < 11172 && c % 28 ? a : b;
}
// '로' 는 ㄹ 받침 뒤에서도 '로'
function josaRo(word) {
  const c = String(word).charCodeAt(String(word).length - 1) - 0xac00;
  return c >= 0 && c < 11172 && c % 28 && c % 28 !== 8 ? '으로' : '로';
}

const locale = () => (LANG === 'ko' ? 'ko-KR' : 'en-US');
const fmt = (n) => Math.round(n).toLocaleString(locale());
const compact = (n) => new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n);

function formatDuration(ms) {
  const total = Math.round(ms / MIN);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (LANG === 'ko') {
    if (h === 0) return `${m}분`;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
  }
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* ────────────────────────────── 세기 ────────────────────────────── */

function stripFrontmatter(text) {
  const m = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
  return m ? text.slice(m[0].length) : text;
}

// 노트 한 개의 글자 수와 링크 수.
// 글자: 공백·마크다운 기호·URL 을 뺀 글자. 코드도 글쓰기라 센다.
// 링크: [[위키 링크]], ![[임베드]], [마크다운](링크). 코드 블록·인라인 코드 안의 것은 뺀다.
// Excalidraw 그림도 .md 로 저장되지만 속은 압축된 데이터라 글쓰기가 아니다
const EXCALIDRAW_RE = /(^|\n)excalidraw-plugin\s*:/;
const BLOB_LINE = 1000; // 코드 블록 안에서 이보다 긴 한 줄은 데이터 덩어리로 보고 세지 않는다

function measure(text) {
  const raw = String(text || '');
  const body = stripFrontmatter(raw);
  if (EXCALIDRAW_RE.test(raw.slice(0, raw.length - body.length))) return { chars: 0, links: 0 };
  const prose = [];
  const code = [];
  let fence = null;
  for (const line of body.split('\n')) {
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (!fence) prose.push(line);
    else if (line.length <= BLOB_LINE) code.push(line);
  }
  const text2 = prose.join('\n');
  const linkable = text2.replace(/`[^`\n]*`/g, ' ').replace(/%%[\s\S]*?%%/g, ' ');
  const wiki = linkable.match(/\[\[[^[\]\n]+\]\]/g) || [];
  const md = linkable.match(/\[[^[\]\n]*\]\([^()\s][^()\n]*\)/g) || [];
  const chars = (text2 + '\n' + code.join('\n'))
    .replace(/\]\([^)\n]*\)/g, ']')
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, '')
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '')
    .replace(/[\s#*_>`~=|[\]!-]+/g, '').length;
  return { chars, links: wiki.length + md.length };
}

const pad = (n) => String(n).padStart(2, '0');
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function emptyLedger() {
  return { files: {}, days: {}, hours: new Array(24).fill(0), tot: { c: 0, l: 0, n: 0 } };
}

// 파일별 최고 기록과 날짜별 합계.
// files[path] = [최고 글자 수, 최고 링크 수, 마지막으로 읽은 mtime, 새 노트로 셌는지(0/1)]
// days[YYYY-MM-DD] = { c: 글자, l: 링크, n: 새 노트, o: 노트 연 횟수 }
class Ledger {
  constructor(d) {
    this.d = Object.assign(emptyLedger(), d || {});
    if (!Array.isArray(this.d.hours) || this.d.hours.length !== 24) this.d.hours = new Array(24).fill(0);
  }

  bucket(day) {
    return (this.d.days[day] ||= { c: 0, l: 0, n: 0, o: 0 });
  }

  observe(path, m, when = new Date(), opts = {}) {
    const f = this.d.files[path];
    const prevC = f ? f[0] : 0;
    const prevL = f ? f[1] : 0;
    const counted = f ? f[3] : 0;
    let dc = Math.max(0, m.chars - prevC);
    let dl = Math.max(0, m.links - prevL);
    if (opts.cap != null) dc = Math.min(dc, opts.cap);
    if (opts.linkCap != null) dl = Math.min(dl, opts.linkCap);
    let dn = !counted && m.chars >= NOTE_MIN_CHARS ? 1 : 0;
    // budget: 한꺼번에 여러 파일이 바뀔 때(폴더 통째 복사, 동기화) 전체로 줄 수 있는 몫
    const b = opts.budget;
    if (b) {
      dc = Math.min(dc, Math.max(0, b.c));
      dl = Math.min(dl, Math.max(0, b.l));
      if (b.n <= 0) dn = 0;
      b.c -= dc;
      b.l -= dl;
      b.n -= dn;
    }
    this.d.files[path] = [Math.max(prevC, m.chars), Math.max(prevL, m.links), opts.mtime || (f ? f[2] : 0), counted || (m.chars >= NOTE_MIN_CHARS ? 1 : 0)];
    if (dc || dl || dn) this.add(when, dc, dl, dn);
    return { dc, dl, dn };
  }

  add(when, dc, dl, dn) {
    const b = this.bucket(dayOf(when));
    b.c += dc;
    b.l += dl;
    b.n += dn;
    this.d.hours[when.getHours()] += dc + dl + dn;
    const t = this.d.tot;
    t.c += dc;
    t.l += dl;
    t.n += dn;
  }

  open(when = new Date()) {
    this.bucket(dayOf(when)).o++;
  }

  mtimeOf(path) {
    const f = this.d.files[path];
    return f ? f[2] : null;
  }

  remove(path) {
    delete this.d.files[path];
  }

  rename(from, to) {
    if (this.d.files[from]) {
      this.d.files[to] = this.d.files[from];
      delete this.d.files[from];
    }
    const prefix = from + '/';
    for (const p of Object.keys(this.d.files)) {
      if (p.startsWith(prefix)) {
        this.d.files[to + '/' + p.slice(prefix.length)] = this.d.files[p];
        delete this.d.files[p];
      }
    }
  }

  totals() {
    return { ...this.d.tot };
  }

  today(now = new Date()) {
    const b = this.d.days[dayOf(now)];
    return b ? { ...b } : { c: 0, l: 0, n: 0, o: 0 };
  }

  activeDays() {
    const s = new Set();
    for (const [k, b] of Object.entries(this.d.days)) if (b.c || b.l || b.n || b.o) s.add(k);
    return s;
  }

  // 오늘을 포함해 최근 n 일
  daily(n, now = new Date()) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const day = dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
      const b = this.d.days[day] || {};
      out.push({ day, c: b.c || 0, l: b.l || 0, n: b.n || 0 });
    }
    return out;
  }

  hours() {
    return this.d.hours.slice();
  }

  maxDay() {
    let m = 0;
    for (const b of Object.values(this.d.days)) if (b.c > m) m = b.c;
    return m;
  }
}

/* ────────────────────────────── 성장 ────────────────────────────── */

const STAGES = [
  { key: 'egg', min: 0 },
  { key: 'baby', min: 1_000 },
  { key: 'child', min: 8_000 },
  { key: 'teen', min: 30_000 },
  { key: 'adult', min: 100_000 },
];
const stageName = (key) => t('stage_' + key);

// species 를 주면 그 친구의 특기(글자·링크·새 노트)를 곱한다
function xpOf(tot, species) {
  const m = (k) => (species ? perkMult(species, k) : 1);
  return Math.floor((tot.c / CHARS_PER_XP) * m('chars')) + Math.round(tot.l * XP_PER_LINK * m('links')) + Math.round(tot.n * XP_PER_NOTE * m('notes'));
}

function levelOf(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1;
}

function stageIndexOf(xp) {
  let i = 0;
  while (i + 1 < STAGES.length && xp >= STAGES[i + 1].min) i++;
  return i;
}

// 경험치 → 레벨·단계·진행률
function growthOf(xp, parts = {}) {
  const si = stageIndexOf(xp);
  const stage = STAGES[si];
  const next = STAGES[si + 1];
  const level = levelOf(xp);
  return {
    xp,
    usageXp: 0,
    bonusXp: 0,
    startXp: 0,
    frozenXp: 0,
    ...parts,
    level,
    levelFloor: 25 * (level - 1) ** 2,
    levelCeil: 25 * level ** 2,
    stageIndex: si,
    stageKey: stage.key,
    nextStageKey: next ? next.key : null,
    xpToNext: next ? next.min - xp : 0,
    progress: next ? Math.max(0, Math.min(1, (xp - stage.min) / (next.min - stage.min))) : 1,
  };
}

// 친구 한 마리의 기록. 파트너일 때만 자란다.
//  mode: all = 볼트 전체 / fresh = 알부터 / stage = 고른 단계부터 (설정의 "다시 시작"에서 고른다)
//  base: 파트너가 된 순간의 누적 글자·링크·노트. null 이면 볼트 전체를 센다
//  since: 이 시각 뒤에 받은 보너스만 더한다
//  startXp: 고른 단계에서 시작할 때 미리 주는 몫
//  frozen: 예전에 파트너였던 동안 모은 경험치. 쉬다가 돌아오면 여기서 이어 간다
function newPet(species, o = {}) {
  return {
    name: tr(speciesOf(species).name),
    mode: 'fresh',
    startStage: 0,
    base: null,
    since: 0,
    startXp: 0,
    frozen: 0,
    color: 'natural',
    accessory: 'none',
    metAt: Date.now(),
    best: 0,
    ...o,
  };
}

function computeGrowth(pet, species, totals, bonusXp = () => 0) {
  const b = pet.base;
  const used = b ? { c: Math.max(0, totals.c - b.c), l: Math.max(0, totals.l - b.l), n: Math.max(0, totals.n - b.n) } : totals;
  const usageXp = xpOf(used, species);
  const bonus = bonusXp(pet.since || 0);
  const startXp = pet.startXp || 0;
  const frozenXp = pet.frozen || 0;
  return growthOf(frozenXp + usageXp + startXp + bonus, { usageXp, bonusXp: bonus, startXp, frozenXp });
}
/* ────────────────────────────── 작은 도구 ────────────────────────────── */

class Emitter {
  constructor() {
    this._h = {};
  }
  on(e, f) {
    (this._h[e] ||= []).push(f);
  }
  emit(e, ...a) {
    for (const f of this._h[e] || []) f(...a);
  }
}

const clone = (v) => JSON.parse(JSON.stringify(v));

function minutesOfDay(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/* ────────────────────────────── 기분 ────────────────────────────── */
// 입력: 타이핑·노트 열기 시각, 지금 시각, 설정. 출력: 기분, 동작, 말풍선.

class Brain extends Emitter {
  constructor(getSettings, getToday) {
    super();
    this.getSettings = getSettings;
    this.getToday = getToday;
    this.lastActivity = 0;
    this.lastTypeAt = 0;
    this.streakStart = 0;
    this.mood = 'idle';
    this.daily = {}; // 하루에 한 번만 하는 말: key → dayOf
    this.cooldown = {}; // key → 다시 말할 수 있는 시각
    this.nextChatter = Date.now() + 20 * MIN;
  }

  // 지금 이어지고 있는 연속 작업 시간(ms)
  streakMs(now = Date.now()) {
    return this.streakStart && now - this.lastActivity < 10 * MIN ? now - this.streakStart : 0;
  }

  // kind: 'type' (타이핑) | 'open' (노트 열기·옵시디언 켜기)
  activity(kind = 'open', at = Date.now()) {
    if (kind === 'type') this.lastTypeAt = at;
    if (at <= this.lastActivity) return;
    const wasAsleep = this.mood === 'sleeping' || this.mood === 'sleepy';
    if (!this.lastActivity || at - this.lastActivity > STREAK_GAP) this.streakStart = at;
    this.lastActivity = at;
    this.greet(wasAsleep);
    if (wasAsleep || (kind === 'type' && this.mood !== 'writing')) this.tick();
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
    const d = dayOf(date);
    if (this.daily[key] === d) return false;
    this.daily[key] = d;
    return true;
  }

  greet(fromSleep) {
    const now = new Date();
    const h = now.getHours();
    if (h >= 5 && h < 11 && this.once('morning', now)) {
      this.emit('action', 'wave');
      this.say(tl('morning'), 'greet');
    } else if (fromSleep && this.ready('greet', 30 * MIN)) {
      this.emit('action', 'wave');
      this.say(tl('back'), 'greet');
    }
  }

  // 글을 쓴 결과에 반응한다. r = { dc, dl, dn }
  wrote(r, todayChars) {
    if (r.dl) {
      this.emit('action', 'link');
      if (this.ready('link', 3 * MIN) && Math.random() < 0.6) this.say(tl('link'), 'link');
    }
    if (r.dn) {
      this.emit('action', 'wave');
      if (this.ready('note', 8 * MIN)) this.say(tl('note'), 'note');
    }
    const before = todayChars - r.dc;
    if (r.dc && Math.floor(todayChars / 1000) > Math.floor(before / 1000)) {
      this.emit('action', 'happy');
      this.say(t('milestone', { n: fmt(Math.floor(todayChars / 1000) * 1000) }), 'milestone');
    }
  }

  // 5초마다 불린다
  tick() {
    const s = this.getSettings();
    const now = Date.now();
    const d = new Date(now);
    const idle = this.lastActivity ? now - this.lastActivity : Infinity;

    let mood;
    if (now - this.lastTypeAt < 20_000) mood = 'writing';
    else if (idle < 5 * MIN) mood = 'active';
    else if (idle < s.sleepyAfterMin * MIN) mood = 'idle';
    else if (idle < s.sleepAfterMin * MIN) mood = 'sleepy';
    else mood = 'sleeping';

    if (mood !== this.mood) {
      this.mood = mood;
      this.emit('mood', mood);
    }

    const present = idle < 30 * MIN;
    const minute = d.getHours() * 60 + d.getMinutes();

    for (const meal of [
      { key: 'lunch', on: s.lunchEnabled, at: s.lunchTime },
      { key: 'dinner', on: s.dinnerEnabled, at: s.dinnerTime },
    ]) {
      const start = minutesOfDay(meal.at);
      if (meal.on && present && minute >= start && minute < start + 70 && this.once(meal.key, d)) {
        this.emit('action', 'eat');
        this.say(tl(meal.key), meal.key);
        return;
      }
    }

    const streak = this.streakMs(now);
    if (streak >= s.restAfterMin * MIN && this.ready('rest', 60 * MIN)) {
      this.emit('action', 'stretch');
      this.say(tl('rest', { d: formatDuration(streak) }), 'rest');
      return;
    }

    const h = d.getHours();
    if (s.lateNightEnabled && h >= 1 && h < 5 && idle < 10 * MIN && this.ready('late', 50 * MIN)) {
      this.emit('action', 'yawn');
      this.say(tl('late', { h }), 'late');
      return;
    }

    if (s.chatter && (mood === 'active' || mood === 'writing') && now > this.nextChatter) {
      this.nextChatter = now + (25 + Math.random() * 25) * MIN;
      this.say(tl('chatter', { c: fmt(this.getToday().c) }), 'chatter');
    }
  }
}

/* ────────────────────────────── 게임 요소 ────────────────────────────── */

// 꾸미기 아이템. level 로 열리거나 achievement 로 열린다
const ITEMS = [
  { key: 'none', name: ['없음', 'None'], icon: '·', level: 1 },
  { key: 'sprout', name: ['새싹 핀', 'Sprout pin'], icon: '🌱', level: 3 },
  { key: 'ribbon', name: ['리본', 'Ribbon'], icon: '🎀', level: 8 },
  { key: 'glasses', name: ['동그란 안경', 'Round glasses'], icon: '👓', level: 14 },
  { key: 'headphones', name: ['헤드폰', 'Headphones'], icon: '🎧', level: 20 },
  { key: 'beanie', name: ['비니', 'Beanie'], icon: '🧢', level: 28 },
  { key: 'scarf', name: ['목도리', 'Scarf'], icon: '🧣', level: 36 },
  { key: 'quill', name: ['깃펜', 'Quill'], icon: '🪶', achievement: 'chars_100k' },
  { key: 'nightcap', name: ['수면 모자', 'Nightcap'], icon: '🌙', achievement: 'night_owl' },
  { key: 'party', name: ['파티 모자', 'Party hat'], icon: '🥳', achievement: 'streak_7' },
  { key: 'chef', name: ['요리사 모자', 'Chef hat'], icon: '🍳', achievement: 'lunch_5' },
  { key: 'crown', name: ['왕관', 'Crown'], icon: '👑', achievement: 'stage_adult' },
];

// 몸 색깔. natural 은 친구마다 타고난 색
const COLORS = [
  { key: 'natural', name: ['타고난 색', 'Natural'], level: 1 },
  { key: 'clay', name: ['클레이', 'Clay'], level: 5 },
  { key: 'mint', name: ['민트', 'Mint'], level: 12 },
  { key: 'peach', name: ['복숭아', 'Peach'], level: 18 },
  { key: 'snow', name: ['눈송이', 'Snow'], level: 24 },
  { key: 'midnight', name: ['한밤', 'Midnight'], achievement: 'links_1000' },
  { key: 'gold', name: ['황금', 'Gold'], achievement: 'chars_1m' },
];

// c = { all, bestStreak, hours, level, stageIndex, st, maxDay, maxBacklinks }
const ACHIEVEMENTS = [
  { id: 'first_note', icon: '📄', name: ['첫 페이지', 'First page'], desc: ['노트를 처음 썼다', 'Write your first note'], xp: 50, check: (c) => c.all.n >= 1 },
  { id: 'chars_10k', icon: '✏️', name: ['끄적끄적', 'Scribbler'], desc: ['1만 자 쓰기', 'Write 10,000 characters'], xp: 100, check: (c) => c.all.c >= 1e4, progress: (c) => [c.all.c, 1e4] },
  { id: 'chars_100k', icon: '📝', name: ['작가 지망생', 'Aspiring author'], desc: ['10만 자 쓰기 · 깃펜', 'Write 100,000 characters · Quill'], xp: 300, check: (c) => c.all.c >= 1e5, progress: (c) => [c.all.c, 1e5] },
  { id: 'chars_1m', icon: '📚', name: ['백만 글자', 'A million letters'], desc: ['100만 자 쓰기 · 황금 색', 'Write 1,000,000 characters · Gold color'], xp: 1000, check: (c) => c.all.c >= 1e6, progress: (c) => [c.all.c, 1e6] },
  { id: 'links_100', icon: '🔗', name: ['연결의 시작', 'Connected'], desc: ['링크 100개 걸기', 'Make 100 links'], xp: 100, check: (c) => c.all.l >= 100, progress: (c) => [c.all.l, 100] },
  { id: 'links_1000', icon: '🕸️', name: ['거미줄', 'Web weaver'], desc: ['링크 1,000개 걸기 · 한밤 색', 'Make 1,000 links · Midnight color'], xp: 400, check: (c) => c.all.l >= 1000, progress: (c) => [c.all.l, 1000] },
  { id: 'links_5000', icon: '🧠', name: ['세컨드 브레인', 'Second brain'], desc: ['링크 5,000개 걸기', 'Make 5,000 links'], xp: 1000, check: (c) => c.all.l >= 5000, progress: (c) => [c.all.l, 5000] },
  { id: 'notes_50', icon: '🗂️', name: ['노트 수집가', 'Collector'], desc: ['노트 50개 만들기', 'Create 50 notes'], xp: 150, check: (c) => c.all.n >= 50, progress: (c) => [c.all.n, 50] },
  { id: 'notes_500', icon: '🏛️', name: ['나만의 도서관', 'Personal library'], desc: ['노트 500개 만들기', 'Create 500 notes'], xp: 600, check: (c) => c.all.n >= 500, progress: (c) => [c.all.n, 500] },
  { id: 'hub', icon: '🌟', name: ['허브 노트', 'Hub note'], desc: ['백링크가 20개 모인 노트 만들기', 'Have a note with 20 backlinks'], xp: 200, check: (c) => c.maxBacklinks >= 20, progress: (c) => [c.maxBacklinks, 20] },
  { id: 'focus_day', icon: '🔥', name: ['몰입의 날', 'In the zone'], desc: ['하루에 3,000자 쓰기', 'Write 3,000 characters in one day'], xp: 200, check: (c) => c.maxDay >= 3000, progress: (c) => [c.maxDay, 3000] },
  { id: 'streak_3', icon: '📆', name: ['작심삼일 돌파', 'Three in a row'], desc: ['3일 연속 출석', 'Show up 3 days in a row'], xp: 100, check: (c) => c.bestStreak >= 3, progress: (c) => [c.bestStreak, 3] },
  { id: 'streak_7', icon: '📅', name: ['일주일 개근', 'Perfect week'], desc: ['7일 연속 출석 · 파티 모자', 'Show up 7 days in a row · Party hat'], xp: 250, check: (c) => c.bestStreak >= 7, progress: (c) => [c.bestStreak, 7] },
  { id: 'streak_30', icon: '🏆', name: ['한 달 개근', 'Perfect month'], desc: ['30일 연속 출석', 'Show up 30 days in a row'], xp: 1000, check: (c) => c.bestStreak >= 30, progress: (c) => [c.bestStreak, 30] },
  { id: 'night_owl', icon: '🦉', name: ['올빼미', 'Night owl'], desc: ['새벽 1~5시에 글쓰기 · 수면 모자', 'Write between 1 and 5 AM · Nightcap'], xp: 100, check: (c) => c.hours.slice(1, 5).some((n) => n > 0) },
  { id: 'early_bird', icon: '🐤', name: ['얼리버드', 'Early bird'], desc: ['아침 5~8시에 글쓰기', 'Write between 5 and 8 AM'], xp: 100, check: (c) => c.hours.slice(5, 8).some((n) => n > 0) },
  { id: 'marathon', icon: '🏃', name: ['마라토너', 'Marathoner'], desc: ['2시간 연속 작업하기', 'Work 2 hours in one stretch'], xp: 150, check: (c) => c.st.maxStreakMin >= 120, progress: (c) => [c.st.maxStreakMin, 120] },
  { id: 'lunch_5', icon: '🍚', name: ['밥심', 'Well fed'], desc: ['밥 알림 받고 먹고 오기 5번 · 요리사 모자', 'Take 5 meal breaks when reminded · Chef hat'], xp: 200, check: (c) => c.st.mealsTaken >= 5, progress: (c) => [c.st.mealsTaken, 5] },
  { id: 'rest_10', icon: '🧘', name: ['쉼표의 미학', 'The art of pausing'], desc: ['휴식 알림 받고 쉬기 10번', 'Take 10 breaks when reminded'], xp: 200, check: (c) => c.st.restsTaken >= 10, progress: (c) => [c.st.restsTaken, 10] },
  { id: 'pet_50', icon: '🤲', name: ['쓰담쓰담', 'Pat pat'], desc: ['펫 50번 쓰다듬기', 'Pet your pet 50 times'], xp: 100, check: (c) => c.st.pokes >= 50, progress: (c) => [c.st.pokes, 50] },
  { id: 'quest_10', icon: '📜', name: ['퀘스트 헌터', 'Quest hunter'], desc: ['일일 퀘스트 10개 완료', 'Clear 10 daily quests'], xp: 200, check: (c) => c.st.questsDone >= 10, progress: (c) => [c.st.questsDone, 10] },
  { id: 'quest_50', icon: '🗺️', name: ['모험가', 'Adventurer'], desc: ['일일 퀘스트 50개 완료', 'Clear 50 daily quests'], xp: 600, check: (c) => c.st.questsDone >= 50, progress: (c) => [c.st.questsDone, 50] },
  { id: 'lv_10', icon: '⭐', name: ['레벨 10', 'Level 10'], desc: ['Lv.10 달성', 'Reach Lv.10'], xp: 100, check: (c) => c.level >= 10, progress: (c) => [c.level, 10] },
  { id: 'lv_30', icon: '🌟', name: ['레벨 30', 'Level 30'], desc: ['Lv.30 달성', 'Reach Lv.30'], xp: 300, check: (c) => c.level >= 30, progress: (c) => [c.level, 30] },
  { id: 'stage_child', icon: '🌿', name: ['쑥쑥', 'Growing up'], desc: ['어린이로 자라기', 'Grow into a kid'], xp: 150, check: (c) => c.stageIndex >= 2 },
  { id: 'stage_adult', icon: '👑', name: ['다 컸다!', 'All grown up'], desc: ['어른으로 자라기 · 왕관', 'Grow into an adult · Crown'], xp: 1000, check: (c) => c.stageIndex >= 4 },
  { id: 'friends_3', icon: '🤝', name: ['삼총사', 'Three friends'], desc: ['도감에서 친구 3마리 만나기', 'Meet 3 friends in the dex'], xp: 150, check: (c) => c.met >= 3, progress: (c) => [c.met, 3] },
  { id: 'friends_5', icon: '📖', name: ['도감 완성', 'Dex complete'], desc: ['다섯 친구 모두 만나기', 'Meet all five friends'], xp: 400, check: (c) => c.met >= 5, progress: (c) => [c.met, 5] },
  { id: 'raise_2', icon: '🌈', name: ['육성 달인', 'Master raiser'], desc: ['두 친구를 어린이까지 키우기', 'Raise two friends to the kid stage'], xp: 300, check: (c) => c.raised >= 2, progress: (c) => [c.raised, 2] },
];

// 일일 퀘스트 풀. target 은 난이도(0~2)에 따라 고른다
const QUEST_POOL = [
  { type: 'chars', icon: '✍️', xp: [40, 60, 90], target: [300, 800, 1500], text: ['{n}자 쓰기', 'Write {n} characters'], value: (q) => q.today.c },
  { type: 'links', icon: '🔗', xp: [40, 60, 90], target: [3, 6, 10], text: ['링크 {n}개 걸기', 'Make {n} links'], value: (q) => q.today.l },
  { type: 'notes', icon: '📄', xp: [30, 50, 80], target: [1, 2, 3], text: ['새 노트 {n}개 만들기', 'Create {n} new notes'], value: (q) => q.today.n },
  { type: 'read', icon: '📖', xp: [20, 30, 40], target: [3, 6, 10], text: ['노트 {n}개 둘러보기', 'Open {n} different notes'], value: (q) => q.readToday },
  { type: 'poke', icon: '🤲', xp: [20, 30, 40], target: [3, 5, 8], text: ['{name} {n}번 쓰다듬기', 'Pet {name} {n} times'], value: (q) => q.pokesToday },
  { type: 'rest', icon: '🧘', xp: [50, 50, 50], target: [1, 1, 1], text: ['휴식 알림 받고 쉬고 오기', 'Take a break when reminded'], value: (q) => q.restToday },
  { type: 'meal', icon: '🍚', xp: [50, 50, 50], target: [1, 1, 1], text: ['밥 알림 받고 밥 먹고 오기', 'Go eat when reminded'], value: (q) => q.mealToday, needs: (s) => s.lunchEnabled || s.dinnerEnabled },
  { type: 'early', icon: '🌅', xp: [40, 40, 40], target: [1, 1, 1], text: ['오전 10시 전에 시작하기', 'Start before 10 AM'], value: (q) => q.earlyToday },
];
const ALL_CLEAR_XP = 100;

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const DEFAULT_STATE = {
  pokes: 0,
  pokesDay: null,
  pokesToday: 0,
  mealsTaken: 0,
  restsTaken: 0,
  mealDay: null,
  restDay: null,
  earlyDay: null,
  readDay: null,
  readPaths: [],
  maxStreakMin: 0,
  pending: null, // { kind: 'meal' | 'rest', at }
  bonus: [], // { at, xp, why }
  achievements: {}, // id → 달성 시각
  items: ['none'],
  colors: ['natural'],
  // 친구들
  partner: null, // 지금 함께하는 친구 (SPECIES key)
  party: {}, // key → newPet() 기록. 만난 친구만 있다
  picked: false, // 첫 실행(또는 업데이트) 때 파트너를 직접 골랐는지
  questDay: null,
  questClaimed: [],
  questsDone: 0,
  attendDay: null,
  initialized: false,
  // 플러그인
  onboarded: false,
  scanned: false,
  lastLevel: null,
  lastStage: null,
  quietUntil: 0,
  brainDaily: {},
  seen: [], // 하우스에서 이미 본 아이템·색깔
};

class Gamify extends Emitter {
  // st: 저장되는 상태 객체, extra(): { maxBacklinks }
  constructor(st, ledger, getSettings, save, extra = () => ({ maxBacklinks: 0 })) {
    super();
    this.st = st;
    this.ledger = ledger;
    this.getSettings = getSettings;
    this.save = save;
    this.extra = extra;
    for (const [k, v] of Object.entries(DEFAULT_STATE)) if (st[k] === undefined) st[k] = clone(v);
  }

  bonusXp(sinceMs) {
    let sum = 0;
    for (const b of this.st.bonus) if (b.at >= sinceMs) sum += b.xp;
    return sum;
  }

  // 지금 파트너의 특기 배율 (attend·quest)
  perk(kind) {
    return perkMult(this.st.partner, kind);
  }

  petName() {
    const pet = this.st.party && this.st.party[this.st.partner];
    return pet ? pet.name : '';
  }

  grant(xp, why) {
    this.st.bonus.push({ at: Date.now(), xp, why });
    this.save();
  }

  streaks(now = new Date()) {
    const days = this.ledger.activeDays();
    const back = (n) => dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
    let current = 0;
    let i = days.has(back(0)) ? 0 : 1; // 오늘 아직 안 했으면 어제까지로 센다
    while (days.has(back(i))) {
      current++;
      i++;
    }
    let best = 0;
    let run = 0;
    let prev = null;
    for (const d of [...days].sort()) {
      const tm = new Date(d + 'T00:00:00').getTime();
      run = prev !== null && Math.round((tm - prev) / 86_400_000) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = tm;
    }
    return { current, best, total: days.size };
  }

  poke() {
    const today = dayOf(new Date());
    if (this.st.pokesDay !== today) {
      this.st.pokesDay = today;
      this.st.pokesToday = 0;
    }
    this.st.pokes++;
    this.st.pokesToday++;
    this.save();
    this.evaluate();
  }

  noteOpen(path) {
    const today = dayOf(new Date());
    if (this.st.readDay !== today) {
      this.st.readDay = today;
      this.st.readPaths = [];
    }
    if (!this.st.readPaths.includes(path)) {
      this.st.readPaths.push(path);
      this.save();
    }
  }

  // 밥/휴식 말풍선이 뜨면, 그 뒤 실제로 쉬고 왔는지 지켜본다
  noteBubble(kind) {
    if (kind === 'lunch' || kind === 'dinner') this.st.pending = { kind: 'meal', at: Date.now() };
    else if (kind === 'rest') this.st.pending = { kind: 'rest', at: Date.now() };
    else return;
    this.save();
  }

  // 1분마다: 쉬고 왔는지, 연속 작업 최고 기록, 출석 보너스
  tick(lastActivity, streakMs, now = Date.now()) {
    const today = dayOf(new Date(now));
    const streakMin = Math.floor(streakMs / MIN);
    if (streakMin > this.st.maxStreakMin) this.st.maxStreakMin = streakMin;

    const p = this.st.pending;
    if (p) {
      const need = p.kind === 'meal' ? 20 * MIN : 5 * MIN;
      const window = p.kind === 'meal' ? 150 * MIN : 60 * MIN;
      const idle = now - lastActivity;
      if (idle >= need && lastActivity <= p.at + 10 * MIN) {
        if (p.kind === 'meal') {
          this.st.mealsTaken++;
          this.st.mealDay = today;
        } else {
          this.st.restsTaken++;
          this.st.restDay = today;
        }
        this.st.pending = null;
        this.emit('rested', p.kind);
      } else if (now - p.at > window) {
        this.st.pending = null;
      }
    }

    const recent = lastActivity && now - lastActivity < 5 * MIN && dayOf(new Date(lastActivity)) === today;
    if (recent && this.st.attendDay !== today) {
      const { current } = this.streaks(new Date(now));
      const xp = Math.round((20 + Math.min(current, 14) * 5) * this.perk('attend'));
      this.st.attendDay = today;
      if (new Date(now).getHours() < 10) this.st.earlyDay = today;
      this.grant(xp, ['attend', current]);
      if (this.st.initialized) this.emit('attend', { streak: current, xp });
    }
    this.save();
    this.evaluate();
  }

  quests(now = new Date()) {
    const s = this.getSettings();
    const today = dayOf(now);
    if (this.st.questDay !== today) {
      this.st.questDay = today;
      this.st.questClaimed = [];
    }
    const rnd = seeded(Number(today.replace(/-/g, '')));
    const pool = QUEST_POOL.filter((q) => !q.needs || q.needs(s));
    const picked = [];
    while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);

    const ctx = {
      today: this.ledger.today(now),
      pokesToday: this.st.pokesDay === today ? this.st.pokesToday : 0,
      readToday: this.st.readDay === today ? this.st.readPaths.length : 0,
      restToday: this.st.restDay === today ? 1 : 0,
      mealToday: this.st.mealDay === today ? 1 : 0,
      earlyToday: this.st.earlyDay === today ? 1 : 0,
    };
    return picked.map((q) => {
      const lv = Math.floor(rnd() * 3);
      const target = q.target[lv];
      const value = Math.min(q.value(ctx), target);
      const id = `${today}:${q.type}`;
      return {
        id,
        type: q.type,
        icon: q.icon,
        text: fill(tr(q.text), { n: fmt(target), name: this.petName() }),
        xp: Math.round(q.xp[lv] * this.perk('quest')),
        value,
        target,
        done: value >= target,
        claimed: this.st.questClaimed.includes(id),
      };
    });
  }

  context(extra) {
    const pets = Object.values(this.st.party || {});
    return {
      all: this.ledger.totals(),
      hours: this.ledger.hours(),
      bestStreak: this.streaks().best,
      maxDay: this.ledger.maxDay(),
      met: pets.length,
      raised: pets.filter((p) => (p.best || 0) >= 2).length,
      st: this.st,
      ...this.extra(),
      ...extra,
    };
  }

  // growth = { level, stageIndex }. silent 이면 알림 없이 조용히 달성만 기록한다 (첫 실행 소급 적용)
  evaluate(growth = this.lastGrowth, silent = !this.st.initialized) {
    if (!growth) return;
    this.lastGrowth = growth;
    const c = this.context({ level: growth.level, stageIndex: growth.stageIndex });
    const events = [];

    for (const a of ACHIEVEMENTS) {
      if (this.st.achievements[a.id] || !a.check(c)) continue;
      this.st.achievements[a.id] = Date.now();
      this.grant(a.xp, ['badge', a.id]);
      events.push({ type: 'achievement', achievement: a });
    }

    for (const q of this.quests()) {
      if (!q.done || q.claimed) continue;
      this.st.questClaimed.push(q.id);
      this.st.questsDone++;
      this.grant(q.xp, ['quest', q.type, q.target]);
      events.push({ type: 'quest', quest: q });
      if (this.st.questClaimed.length === 3) {
        const xp = Math.round(ALL_CLEAR_XP * this.perk('quest'));
        this.grant(xp, ['allclear']);
        events.push({ type: 'allclear', xp });
      }
    }

    const opened = (it) => (it.level ? growth.level >= it.level : !!this.st.achievements[it.achievement]);
    for (const it of ITEMS) {
      if (this.st.items.includes(it.key) || !opened(it)) continue;
      this.st.items.push(it.key);
      events.push({ type: 'item', item: it });
    }
    for (const col of COLORS) {
      if (this.st.colors.includes(col.key) || !opened(col)) continue;
      this.st.colors.push(col.key);
      events.push({ type: 'color', color: col });
    }

    if (events.length) this.save();
    if (silent) {
      (this.retroEvents ||= []).push(...events);
      return;
    }
    for (const e of events) this.emit('unlock', e);
  }

  finishInit() {
    if (this.st.initialized) return;
    this.st.initialized = true;
    this.save();
    if (this.retroEvents && this.retroEvents.length) this.emit('retro', this.retroEvents);
    this.retroEvents = [];
  }
}

// 보너스 내역의 why 는 언어와 상관없이 저장하고, 보여줄 때 글로 바꾼다
function bonusText(why, petName) {
  if (!Array.isArray(why)) return String(why);
  switch (why[0]) {
    case 'attend':
      return t('attendBonus', { n: why[1] });
    case 'badge': {
      const a = ACHIEVEMENTS.find((x) => x.id === why[1]);
      return t('badgeBonus', { name: a ? tr(a.name) : why[1] });
    }
    case 'quest': {
      const q = QUEST_POOL.find((x) => x.type === why[1]);
      return t('questBonus', { text: q ? fill(tr(q.text), { n: fmt(why[2]), name: petName }) : why[1] });
    }
    case 'allclear':
      return t('allClearBonus');
    default:
      return String(why[0]);
  }
}

function unlockHint(it) {
  if (it.level) return t('hintLevel', { n: it.level });
  const a = ACHIEVEMENTS.find((x) => x.id === it.achievement);
  return t('hintBadge', { name: a ? tr(a.name) : it.achievement });
}

/* ────────────────────────────── 친구들 ────────────────────────────── */
// 처음에 다섯 친구 중 하나를 파트너로 고른다. 생김새·성격·대사·특기가 다르다.
// perk 는 특기. chars·links·notes 는 그 경험치에, attend·quest 는 받는 보너스에 곱한다.

const SPECIES = [
  {
    key: 'inky', icon: '✒️', typeColor: '#7b61ff',
    name: ['잉키', 'Inky'], kind: ['잉크방울', 'Ink drop'], type: ['잉크', 'Ink'],
    trait: ['성실하고 조금 수줍어요', 'Diligent and a little shy'],
    likes: ['빈 페이지, 만년필', 'Blank pages, fountain pens'],
    dex: ['만년필에서 떨어진 잉크 한 방울에서 태어났다. 글자를 먹을수록 빛깔이 깊어진다.', 'Born from a drop of fountain-pen ink. The more letters it eats, the deeper its color grows.'],
    perk: { kind: 'chars', mult: 1.2 },
    palette: { body: '#9a82f0', shade: '#735bd1', light: '#c9baff', outline: '#2b1d5c', cheek: '#f59ac0', mouth: '#4a1a3a' },
    prop: 'book', happy: 'drop',
  },
  {
    key: 'purrl', icon: '🧶', typeColor: '#e8793a',
    name: ['냥타래', 'Purrl'], kind: ['실타래 고양이', 'Yarn cat'], type: ['실타래', 'Yarn'],
    trait: ['호기심 많은 장난꾸러기', 'A curious little troublemaker'],
    likes: ['실타래, 노트 잇기', 'Yarn balls, linking notes'],
    dex: ['엉킨 실타래 속에서 낮잠을 자던 고양이. 두 노트를 이을 때마다 골골송을 부른다.', 'A cat that napped inside a tangle of yarn. It purrs every time you link two notes.'],
    perk: { kind: 'links', mult: 1.3 },
    palette: { body: '#f7b267', shade: '#d98c43', light: '#ffe2b8', outline: '#4a2a12', cheek: '#ff8fa3', mouth: '#5a2a1a' },
    prop: 'laptop', happy: 'heart',
  },
  {
    key: 'sprig', icon: '🌱', typeColor: '#3f9a45',
    name: ['새록이', 'Sprig'], kind: ['새싹 요정', 'Seedling'], type: ['새싹', 'Sprout'],
    trait: ['느긋하지만 꾸준해요', 'Easygoing but steady'],
    likes: ['햇볕, 매일 조금씩', 'Sunshine, a little every day'],
    dex: ['매일 조금씩 물을 주면 어느 날 머리에 꽃을 피운다. 서두르지 않는 것이 비결이다.', 'Water it a little every day and one morning a flower blooms on its head. The secret is not to hurry.'],
    perk: { kind: 'attend', mult: 1.5 },
    palette: { body: '#a8dc86', shade: '#7fbb61', light: '#dbf5c6', outline: '#22452a', cheek: '#ff9fb2', mouth: '#2f4a25' },
    prop: 'pad', happy: 'leaf',
  },
  {
    key: 'ember', icon: '🔥', typeColor: '#e0482c',
    name: ['모닥이', 'Ember'], kind: ['아기 용', 'Baby dragon'], type: ['불꽃', 'Flame'],
    trait: ['열정 넘치는 아이디어 뱅크', 'A fired-up idea machine'],
    likes: ['새 노트, 번뜩이는 영감', 'Fresh notes, sudden sparks'],
    dex: ['새 아이디어가 떠오르면 꼬리 불꽃이 활활 타오른다. 빈 노트를 보면 참지 못한다.', 'Its tail flame flares up whenever an idea strikes. It can’t resist a blank note.'],
    perk: { kind: 'notes', mult: 1.5 },
    palette: { body: '#f26d5b', shade: '#c94c43', light: '#ffa596', outline: '#4f1616', cheek: '#ffc1a8', mouth: '#5a1616' },
    prop: 'scroll', happy: 'flame',
  },
  {
    key: 'dewey', icon: '📚', typeColor: '#8a5d3b',
    name: ['듀이', 'Dewey'], kind: ['책 부엉이', 'Book owl'], type: ['지혜', 'Wisdom'],
    trait: ['밤샘 독서가, 척척박사', 'A night-owl bookworm'],
    likes: ['두꺼운 책, 퀘스트', 'Thick books, quests'],
    dex: ['도서관 맨 꼭대기 선반에 산다. 밤이 깊을수록 눈이 초롱초롱해진다.', 'Lives on the top shelf of the library. The later it gets, the brighter its eyes shine.'],
    perk: { kind: 'quest', mult: 1.3 },
    palette: { body: '#b88b62', shade: '#8f6643', light: '#dcb68d', outline: '#3a2213', cheek: '#f4a0a0', mouth: '#3a2213' },
    prop: 'tome', happy: 'star',
  },
];
const SPECIES_BY = Object.fromEntries(SPECIES.map((s) => [s.key, s]));
const speciesOf = (key) => SPECIES_BY[key] || SPECIES[0];
const perkMult = (key, kind) => {
  const s = SPECIES_BY[key];
  return s && s.perk.kind === kind ? s.perk.mult : 1;
};

/* ────────────────────────────── 도트 캐릭터 ────────────────────────────── */
// 48×48 도트 캔버스에 코드로 그리고, CSS 로 정수배 확대한다.
// 공통 뼈대(몸·얼굴·팔·소품·장식)는 PetRenderer 가, 친구마다 다른 부분은 ART 가 그린다.

const GROUND = 43;

const BASE_COLORS = {
  eye: '#1d1430', white: '#ffffff', tongue: '#f07a7a',
  shadow: 'rgba(20,12,40,0.22)',
  shell: '#f7f0e4', shellShade: '#e2d3bd', shellOutline: '#5b4a3d', crack: '#5b4a3d',
  paper: '#fbf7ee', paperShade: '#ddd2bd', inkLine: '#8f8574', pencil: '#f2c94c', pencilTip: '#3a2a20',
  heart: '#ff6f91', spark: '#ffd35c', z: '#7d8bff', bowl: '#f4f1ea', bowlShade: '#c9c1b3', bowlBand: '#d97757', rice: '#ffffff',
  link: '#57a6ff',
  leaf: '#5fb85a', leafDark: '#3c8a3a', leafLight: '#9be08a',
  ribbon: '#ff6f91', ribbonDark: '#c94668',
  glass: '#2b2b2b', lens: 'rgba(210,240,255,0.55)',
  phone: '#3b3f4a', phonePad: '#ff8a5c',
  beanie: '#4a7bd1', beanieDark: '#35599a', pom: '#f4f1ea',
  scarf: '#3fa37a', scarfDark: '#2d7a5a',
  crown: '#ffd35c', crownDark: '#c99a1e', gem: '#ff4f6d',
  nightcap: '#7d8bff', nightcapDark: '#5160c9',
  chef: '#ffffff', chefShade: '#d9d4ca',
  party: '#ff9f43', partyDark: '#d9772a',
  feather: '#fdfbf7', featherShade: '#d8d2c6', shaft: '#8a6d3b',
  // 친구마다 타고난 부위 색. 몸 색깔을 바꿔도 그대로다
  nib: '#f2c94c', nibDark: '#a8801e',
  earIn: '#ffb3c1', collar: '#e84a5f', bell: '#ffd35c', bellDark: '#b8912a',
  petal: '#ffa8c8', petalCore: '#ffd84d', root: '#9c6b43',
  belly: '#ffe2a8', bellyShade: '#f0c47a', horn: '#fff3dc', wing: '#ffb38a', flameR: '#ff5a2a', flameO: '#ff9d2e', flameY: '#ffe066',
  face: '#f7e8cb', faceShade: '#e2c9a0', beak: '#f5a623', beakDark: '#b8741a',
  laptop: '#c3c9d4', laptopDark: '#7d8594', logo: '#ff7fa8',
  parchment: '#f6e7c1', parchmentShade: '#d9c08a', tome: '#b0413e', tomeDark: '#7a2826', gold: '#f2c94c',
  pad: '#c89f6c', check: '#3fa37a',
  smoke: 'rgba(130,130,140,0.75)',
};

// 몸 색깔. natural 은 친구마다 타고난 색이고, 나머지는 몸·그늘·외곽선만 바꾼다
const VARIANTS = {
  natural: {},
  clay: { body: '#d97757', shade: '#b35a3c', light: '#f5ad8f', outline: '#4a2418', cheek: '#f28b86', mouth: '#7a2a24' },
  mint: { body: '#63c9a2', shade: '#43a07f', light: '#a7ecd0', outline: '#17463a', cheek: '#f59a9a', mouth: '#1f4d3f' },
  peach: { body: '#f497b6', shade: '#d4708f', light: '#ffc6d9', outline: '#5c2238', cheek: '#ff6f91', mouth: '#6a1f3a' },
  snow: { body: '#eef1f7', shade: '#c5ccdb', light: '#ffffff', outline: '#39405a', cheek: '#f7a8c0', mouth: '#4a5068', ui: '#8e98b3' },
  midnight: { body: '#5a73d9', shade: '#3f55b0', light: '#9fb2ff', outline: '#151c45', cheek: '#e58bc4', mouth: '#1f2a66' },
  gold: { body: '#f0c24b', shade: '#c99a22', light: '#ffe596', outline: '#5a3d0a', cheek: '#f59a6a', mouth: '#6a3a0a' },
};

const PAL_CACHE = new Map();
function paletteOf(species, color) {
  const key = `${species}:${color}`;
  let p = PAL_CACHE.get(key);
  if (!p) {
    p = { ...BASE_COLORS, ...speciesOf(species).palette, ...(VARIANTS[color] || {}) };
    p.accent = p.ui || p.body;
    PAL_CACHE.set(key, p);
  }
  return p;
}
let C = paletteOf('inky', 'natural');

const STAGE_SHAPE = {
  egg: { rx: 8, ry: 10, si: 0 },
  baby: { rx: 8.5, ry: 7.5, si: 1 },
  child: { rx: 10.5, ry: 9, arms: true, feet: true, si: 2 },
  teen: { rx: 12.5, ry: 10.5, arms: true, feet: true, si: 3 },
  adult: { rx: 14, ry: 11.5, arms: true, feet: true, si: 4 },
};

const HATS = new Set(['beanie', 'nightcap', 'chef', 'party', 'crown']);

const ACTION_LEN = { happy: 0.9, link: 1.1, levelup: 2.2, evolve: 3.2, wave: 1.8, eat: 7, stretch: 4, yawn: 2.5, achieve: 2.4, fidget: 2.4 };

const PATTERNS = {
  heart: ['.X.X.', 'XXXXX', '.XXX.', '..X..'],
  sparkle: ['.X.', 'XWX', '.X.'],
  z: ['XXXX', '..X.', '.X..', 'XXXX'],
  zs: ['XXX', '.X.', 'XXX'],
  note: ['.XX', '.X.', 'XX.'],
  link: ['XXXX...', 'X..XXXX', 'XXXX..X', '...XXXX'],
  drop: ['.O.', 'OXO', 'XWX', '.X.'],
  leaf: ['..XX', '.XXD', 'XXD.', 'D...'],
  flame: ['.Y.', 'YYO', 'OYR', '.R.'],
  feather: ['..X', '.XS', 'XS.', 'S..'],
  smoke: ['.X.', 'XXX', '.X.'],
  key: ['XX', 'XX'],
  check: ['..X', 'X.X', '.X.'],
  question: ['XX.', '..X', '.X.', '...', '.X.'],
};
const GLYPHS = [
  ['XXX', 'X..', 'XXX'],
  ['X.X', 'XXX', 'X.X'],
  ['.X.', 'X.X', 'XXX'],
  ['XX.', 'X.X', 'XX.'],
  ['XXX', '..X', '..X'],
  ['X..', 'X..', 'XXX'],
];

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

// 기본 몸: 타원. widen(ny) 로 위아래 폭을 조금씩 바꾼다
function inEllipse(g, widen) {
  return (x, y) => {
    const ny = (y + 0.5 - g.cy) / g.ry;
    const nx = (x + 0.5 - g.cx - g.sh(y)) / (g.rx * (widen ? widen(ny) : 1));
    return nx * nx + ny * ny <= 1;
  };
}

// 기본 몸 색: 오른쪽 아래는 그늘, 왼쪽 위는 반짝. extra 가 색을 돌려주면 그걸 쓴다
function tone(g, x, y, extra) {
  if (g.flash) return C.white;
  const nx = (x + 0.5 - g.cx - g.sh(y)) / g.rx;
  const ny = (y + 0.5 - g.cy) / g.ry;
  const c = extra && extra(nx, ny, x, y);
  if (c) return c;
  if (nx * 0.5 + ny * 0.8 > 0.6) return C.shade;
  if ((nx + 0.42) ** 2 + (ny + 0.52) ** 2 < 0.045) return C.light;
  return C.body;
}

// 삼각형 귀·깃털. 꼭짓점 (ax, ay) 에서 밑변 가운데 (bx, by) 까지, 밑변 반폭 w
function spike(r, ax, ay, bx, by, w, fill, inner) {
  const at = (x, y) => {
    const k = (y + 0.5 - ay) / (by - ay);
    return { k, d: Math.abs(x + 0.5 - (ax + (bx - ax) * k)) };
  };
  r.shape(
    (x, y) => {
      const { k, d } = at(x, y);
      return k >= 0 && k <= 1.3 && d <= w * k + 0.3;
    },
    [Math.min(ax, bx) - w - 1, ay - 1, Math.max(ax, bx) + w + 1, ay + (by - ay) * 1.3 + 1],
    (x, y) => {
      if (!inner) return fill;
      const { k, d } = at(x, y);
      return k > 0.45 && k < 1.05 && d <= w * k - 1.2 ? inner : fill;
    },
    C.outline,
  );
}

// 친구마다 다른 부분.
// size: 단계 크기 보정 · inside: 몸 모양 · fill: 몸 색 · feet: 발 · behind: 몸 뒤 머리 장식(귀·뿔)
// back: 몸 뒤 (꼬리·날개) · crown: 머리 위 장식 (모자를 쓰면 가린다) · front: 얼굴 뒤에 얹는 무늬
// mouth: 입 · arm: 팔 · top/hatY: 머리 끝과 모자 자리
const ART = {
  inky: {
    size: (s) => ({ rx: s.rx - 0.4, ry: s.ry - 0.5 }),
    inside(g) {
      const H = g.ry * 1.45;
      return (x, y) => {
        const Y = y + 0.5 - g.cy;
        const X = x + 0.5 - g.cx - g.sh(y);
        if (Y >= 0) return (X / g.rx) ** 2 + (Y / g.ry) ** 2 <= 1;
        const k = -Y / H;
        if (k > 1) return false;
        const hw = g.rx * Math.sqrt(Math.max(0, 1 - k ** 1.8)) * (1 - k) ** 0.35;
        return Math.abs(X - k * k * 1.8) <= hw;
      };
    },
    top: (g) => g.cy - g.ry * 1.45,
    hatY: (g) => g.cy - g.ry * 1.02,
    fill: (g) => (x, y) => tone(g, x, y, (nx, ny) => ((nx + 0.12) ** 2 + (ny + 1.05) ** 2 < 0.02 ? C.light : null)),
    // 발 대신 잉크 웅덩이
    feet(r, g) {
      if (-g.p.dy > 2.5) return;
      r.ellipse(g.cx, GROUND + 0.6, g.rx * 0.95, 1.3, g.skin(C.shade), C.outline);
    },
    crown(r, g) {
      const tx = Math.round(g.cx + g.sh(g.top) + 1.8);
      const ty = Math.round(g.top);
      if (g.si <= 2) {
        // 끝이 동그랗게 말린다
        r.px(tx + 1, ty, C.outline);
        r.px(tx + 2, ty + 1, C.outline);
        r.px(tx + 1, ty + 1, g.skin(C.body));
      } else if (g.si === 3) {
        // 금빛 펜촉
        r.pattern(['..O..', '.ONO.', '.NDN.', 'ONDNO', 'ONDNO', '.OOO.'], tx - 2, ty - 3, { O: C.outline, N: C.nib, D: C.nibDark });
      } else {
        // 어른: 더 큰 펜촉과 반짝임
        r.pattern(['...O...', '..ONO..', '.ONDNO.', '.NNDNN.', 'ONNDNNO', 'ONNONNO', '.OOOOO.'], tx - 3, ty - 4, { O: C.outline, N: C.nib, D: C.nibDark });
        if (g.tm % 2.6 < 0.9) r.pattern(PATTERNS.sparkle, tx + 3, ty - 6, { X: C.spark, W: C.white }, false);
      }
    },
  },

  purrl: {
    size: (s) => ({ rx: s.rx + 0.6, ry: s.ry - 0.4 }),
    inside: (g) => inEllipse(g),
    fill: (g) => (x, y) => tone(g, x, y, (nx, ny, px) => {
      // 이마 줄무늬
      if (g.si >= 2) {
        const dx = Math.round(px - g.cx - g.sh(y));
        if (dx === 0 && ny < -0.58) return C.shade;
        if ((dx === -2 || dx === 2) && ny < -0.7) return C.shade;
      }
      // 입가 흰 털
      if ((nx / 0.4) ** 2 + ((ny - 0.36) / 0.28) ** 2 < 1) return C.light;
      return null;
    }),
    behind(r, g) {
      const h = [0, 3.5, 4.5, 5.5, 6.5][g.si];
      const w = [0, 2.6, 3.1, 3.6, 4.1][g.si];
      const twitch = g.tm % 6.1 < 0.14 ? 1 : 0;
      for (const side of [-1, 1]) {
        const bx = g.cx + g.sh(g.top) + side * g.rx * 0.52;
        const by = g.top + g.ry * 0.4;
        spike(r, bx + side * 1.4, g.top - h + 1 + (side > 0 ? twitch : 0), bx, by, w, g.skin(C.body), g.flash ? null : C.earIn);
      }
    },
    back(r, g) {
      // 꼬리. 걸을 때와 신날 때 빨리 흔든다
      const len = [0, 5, 8, 10, 12][g.si];
      const bx = g.cx + g.rx * 0.72;
      const by = g.cy + g.ry * 0.5;
      const speed = g.p.wag ? 11 : g.p.walk ? 7 : 2.4;
      const thick = g.si >= 3 ? 1.9 : 1.5;
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        pts.push([bx + u * 3.5 + Math.sin(g.tm * speed + u * 2.4) * u * 2.2, by - u * len, thick * (1 - u * 0.2)]);
      }
      r.tube(pts, (k) => {
        if (g.flash) return C.white;
        if (g.si >= 2 && k > 0.8) return C.light;
        return g.si >= 2 && Math.floor(k * 9) % 3 === 2 ? C.shade : C.body;
      }, C.outline);
    },
    front(r, g) {
      // 방울 목걸이
      if (g.si < 3 || r.accessory === 'scarf' || g.flash) return;
      const y0 = Math.round(g.cy + g.ry * 0.52);
      for (let y = y0; y < y0 + 2; y++) {
        const ny = (y + 0.5 - g.cy) / g.ry;
        const half = g.rx * Math.sqrt(Math.max(0, 1 - ny * ny)) - 0.6;
        for (let x = Math.round(g.cx - half); x <= Math.round(g.cx + half); x++) r.px(x + g.sh(y), y, C.collar);
      }
      r.pattern(['.B.', 'BBB', 'BDB'], Math.round(g.cx + g.sh(y0)) - 1, y0 + 1, { B: C.bell, D: C.bellDark });
    },
    whiskers(r, g, ey) {
      for (const side of [-1, 1]) {
        const x0 = Math.round(g.cx + g.sh(ey) + side * (g.rx - 1.5));
        for (let i = 0; i < 3; i++) {
          r.px(x0 + side * i, ey + 2 - (i === 2 ? 1 : 0), C.outline);
          r.px(x0 + side * i, ey + 4 + (i === 2 ? 1 : 0), C.outline);
        }
      }
    },
    mouth(r, g, mx, my, m) {
      r.px(mx, my - 1, C.cheek);
      const w = () => {
        r.px(mx - 2, my, C.mouth); r.px(mx - 1, my + 1, C.mouth); r.px(mx, my, C.mouth); r.px(mx + 1, my + 1, C.mouth); r.px(mx + 2, my, C.mouth);
      };
      if (m === 'open' || m === 'o') {
        r.rect(mx - 1, my, 3, m === 'o' ? 3 : 2, C.mouth);
        r.px(mx, my + (m === 'o' ? 1 : 1), C.tongue);
      } else if (m === 'flat') r.rect(mx - 1, my, 3, 1, C.mouth);
      else if (m === 'chew') r.rect(mx - 1, my + 1, 3, 1, C.mouth);
      else w();
    },
  },

  sprig: {
    size: (s) => ({ rx: s.rx + 0.2, ry: s.ry - 0.2 }),
    inside: (g) => inEllipse(g, (ny) => 1 + 0.1 * ny),
    fill: (g) => (x, y) => tone(g, x, y),
    // 뿌리 발
    feet(r, g) {
      for (const side of [-1, 1]) {
        const lift = g.p.walk && side * (g.p.step || 0) > 0 ? 1 : 0;
        r.ellipse(g.cx + side * g.rx * 0.42, GROUND - 0.2 + Math.min(0, g.p.dy * 0.3) - lift, g.si >= 2 ? 2.1 : 1.6, 1.2, g.skin(C.root), C.outline);
      }
    },
    crown(r, g) {
      const hx = Math.round(g.cx + g.sh(g.top));
      const ty = Math.round(g.top);
      const droop = r.mood === 'sleeping' ? 0.55 : r.mood === 'sleepy' ? 0.3 : 0;
      const sway = Math.sin(g.tm * 1.6) * 0.16 + (g.p.wag ? Math.sin(g.tm * 12) * 0.3 : 0);
      const stem = g.si >= 3 ? 3 : 2;
      const lx = hx + 0.5;
      const ly = ty - stem + 1.5;
      const leaf = (side, len, wid) => {
        const a = 0.55 - droop + side * sway;
        const cxL = lx + side * Math.cos(a) * len * 0.85;
        const cyL = ly - Math.sin(a) * len * 0.85;
        r.blob(cxL, cyL, len, wid, -side * a, (x, y) => {
          if (g.flash) return C.white;
          // 잎맥 아래쪽은 짙게
          const v = (-(x + 0.5 - cxL) * Math.sin(-side * a) + (y + 0.5 - cyL) * Math.cos(-side * a));
          return v > 0.4 ? C.leafDark : C.leaf;
        }, C.outline);
      };
      const sizes = [null, [[1, 2.8, 1.4]], [[-1, 3.2, 1.6], [1, 3.2, 1.6]], [[-1, 4, 1.9], [1, 4, 1.9]], [[-1, 4.5, 2.1], [1, 4.5, 2.1]]][g.si];
      for (const [side, len, wid] of sizes) leaf(side, len, wid);
      r.rect(hx, ty - stem + 1, 1, stem, g.skin(C.leafDark));
      if (g.si === 3) {
        // 꽃봉오리. 잎 위로 쏙 올라온다
        r.rect(hx, ty - stem - 1, 1, 2, g.skin(C.leafDark));
        r.pattern(['.OO.', 'OPPO', 'OPPO', '.OO.'], hx - 1, ty - stem - 5, { O: C.outline, P: g.skin(C.petal) });
      } else if (g.si >= 4) {
        // 활짝 핀 꽃
        const fx = hx + 0.5;
        const fy = ty - stem - 1.5;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + g.tm * 0.4;
          r.ellipse(fx + Math.cos(a) * 2.3 - 0.5, fy + Math.sin(a) * 2.3 - 0.5, 1.5, 1.5, g.skin(C.petal), C.outline);
        }
        r.rect(Math.round(fx) - 1, Math.round(fy) - 1, 2, 2, C.petalCore);
      }
    },
  },

  ember: {
    size: (s) => ({ rx: s.rx, ry: s.ry - 0.3 }),
    inside: (g) => inEllipse(g),
    fill: (g) => (x, y) => tone(g, x, y, (nx, ny) => {
      // 배 비늘 (입 아래부터)
      if ((nx / 0.52) ** 2 + ((ny - 0.78) / 0.42) ** 2 > 1) return null;
      if (nx * 0.5 + ny * 0.8 > 0.85) return C.bellyShade;
      return (y - Math.round(g.cy)) % 3 === 1 ? C.bellyShade : C.belly;
    }),
    behind(r, g) {
      if (g.si < 2) return;
      const h = [0, 0, 2.4, 3.4, 4.4][g.si];
      for (const side of [-1, 1]) {
        const bx = g.cx + g.sh(g.top) + side * g.rx * 0.42;
        const by = g.top + 1.6;
        r.tube([[bx, by, 1.4], [bx + side * 0.9, by - h * 0.6, 1.05], [bx + side * 2, by - h, 0.6]], () => g.skin(C.horn), C.outline);
      }
    },
    back(r, g) {
      // 박쥐 날개: 뾰족한 끝과 물결 모양 아랫단
      const flap = g.p.wag || g.p.flapFast ? Math.sin(g.tm * 16) * 0.3 : Math.sin(g.tm * 3) * 0.08;
      const L = [0, 3.2, 4.6, 5.6, 6.6][g.si];
      const shape = [[0, 0], [1.0, -0.95], [1.45, -0.15], [1.12, -0.02], [1.18, 0.38], [0.8, 0.24], [0.6, 0.6], [0, 0.45]];
      for (const side of [-1, 1]) {
        const sx = g.cx + side * g.rx * 0.7;
        const sy = g.cy - g.ry * 0.3;
        const c = Math.cos(flap);
        const s = Math.sin(flap);
        const pts = shape.map(([dx, dy]) => [sx + side * (dx * c + dy * s) * L, sy + (-dx * s + dy * c) * L]);
        r.poly(pts, g.skin(C.wing), C.outline);
      }
      // 끝에 불꽃이 달린 꼬리
      const n = 5;
      const tl = 3 + g.si * 1.6;
      const bx = g.cx - g.rx * 0.7;
      const by = GROUND - 2.5;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const wig = Math.sin(g.tm * (g.p.walk ? 7 : 2.2) + u * 2) * u * 0.9;
        pts.push([bx - u * tl, by - u * u * (2 + g.si * 0.9) + wig, (1.3 + g.si * 0.22) * (1 - u * 0.55)]);
      }
      r.tube(pts, () => g.skin(C.body), C.outline);
      const [tx, ty] = pts[n];
      const big = g.si >= 3 || g.p.wag;
      const f = Math.floor(g.tm * 7) % 2;
      const rows = big
        ? (f ? ['.Y..', '.YY.', 'YYOY', 'OYOR', '.OR.'] : ['..Y.', '.YY.', 'YOYY', 'ROYO', '.RO.'])
        : (f ? ['.Y.', 'YOY', '.R.'] : ['Y..', 'YOY', '.R.']);
      r.pattern(rows, Math.round(tx) - (big ? 2 : 1), Math.round(ty) - rows.length + 1, { Y: C.flameY, O: C.flameO, R: C.flameR }, false);
    },
    mouth(r, g, mx, my, m, def) {
      def();
      // 삐죽 나온 송곳니 하나
      if (m === 'smile' || m === 'flat') r.px(mx + 1, my + 1, C.white);
      else if (m === 'open') r.px(mx + 1, my, C.white);
    },
  },

  dewey: {
    size: (s) => ({ rx: s.rx - 0.4, ry: s.ry + 0.6 }),
    inside: (g) => inEllipse(g, (ny) => 1 + 0.08 * ny),
    eyeGap: 0.4,
    bigEyes: true,
    fill: (g) => (x, y) => tone(g, x, y, (nx, ny, px, py) => {
      // 두 눈을 감싸는 얼굴판
      const fy = g.ey0 + 1;
      let d = Infinity;
      for (const side of [-1, 1]) d = Math.min(d, Math.hypot(px + 0.5 - (g.cx + g.sh(py) + side * (g.ex + 0.5)), py + 0.5 - fy));
      if (d <= g.faceR) return d > g.faceR - 1 ? C.faceShade : C.face;
      // 배: 비늘 같은 깃털 무늬
      if ((nx / 0.6) ** 2 + ((ny - 0.56) / 0.46) ** 2 <= 1) {
        const row = py - Math.round(g.cy);
        return row % 3 === 1 && (px - Math.round(g.cx) + (row % 2 ? 1 : 0) + 30) % 3 === 0 ? C.faceShade : C.face;
      }
      return null;
    }),
    behind(r, g) {
      if (g.si < 2) {
        // 아기 부엉이는 정수리에 솜털 한 가닥
        r.pattern(['X.', '.X', 'X.'], Math.round(g.cx + g.sh(g.top)), Math.round(g.top) - 3, { X: C.outline });
        return;
      }
      const h = [0, 0, 3.2, 4.2, 5.2][g.si];
      const w = [0, 0, 1.6, 2, 2.3][g.si];
      for (const side of [-1, 1]) {
        const bx = g.cx + g.sh(g.top) + side * g.rx * 0.55;
        spike(r, bx + side * 2.2, g.top - h + 1.5, bx, g.top + g.ry * 0.35, w, g.skin(C.shade));
      }
    },
    feet(r, g) {
      for (const side of [-1, 1]) {
        const lift = g.p.walk && side * (g.p.step || 0) > 0 ? 1 : 0;
        const fx = Math.round(g.cx + side * g.rx * 0.4);
        const fy = GROUND + Math.min(0, Math.round(g.p.dy * 0.3)) - lift;
        r.pattern(['.D.', 'BBB'], fx - 1, fy - 1, { B: g.skin(C.beak), D: g.skin(C.beakDark) });
      }
    },
    // 날개가 팔 노릇을 한다
    arm(r, g, side, mode) {
      const sx = g.cx + side * (g.rx - 0.8);
      const sy = g.cy - g.ry * 0.12;
      let phi = 0.3;
      if (mode === 'up') phi = 2.3;
      else if (mode === 'high') phi = 2.9;
      else if (mode === 'wave') phi = 2.1 + Math.sin(g.tm * 16) * 0.45;
      else if (mode === 'swing') phi = 0.3 + (g.p.step || 0) * side * 0.3;
      else if (mode !== 'rest') phi = -0.55;
      const len = [0, 2.6, 3.2, 3.8, 4.4][g.si];
      const wid = [0, 1.5, 1.8, 2.1, 2.4][g.si];
      r.blob(sx + side * Math.sin(phi) * len, sy + Math.cos(phi) * len, wid, len, -side * phi, g.skin(C.shade), C.outline);
    },
    mouth(r, g, mx, my, m) {
      // 부리
      const by = g.ey0 + 3;
      if (m === 'open' || m === 'o') r.pattern(['BBB', 'DMD', '.B.'], mx - 1, by, { B: C.beak, D: C.beakDark, M: C.mouth });
      else if (m === 'chew') r.pattern(['BBB', '.D.'], mx - 1, by, { B: C.beak, D: C.beakDark });
      else r.pattern(['BBB', '.B.'], mx - 1, by, { B: C.beak });
    },
  },
};

// 알 무늬. 친구마다 껍질 색과 무늬가 다르다
const EGG_SPOTS = [[-3, -3], [3, 1], [-2, 5], [4, -6], [0, -1]];
const MOON = new Set(['-3,-6', '-4,-5', '-4,-4', '-4,-3', '-3,-2']);
const EGG = {
  inky: { shell: '#f7f0e4', mark: (dx, dy) => (EGG_SPOTS.some(([sx, sy]) => (dx - sx) ** 2 + (dy - sy) ** 2 < 2.2) ? C.body : null) },
  purrl: {
    shell: '#fff5e8',
    mark: (dx, dy) => {
      const w = Math.sin(dx * 0.9) * 0.8;
      const a = dy + 5 - w;
      const b = dy - 1 - w;
      return (a >= 0 && a < 2) || (b >= 0 && b < 2) ? C.body : null;
    },
  },
  sprig: {
    shell: '#f1f7e3',
    mark: (dx, dy) => ([[-3, -4], [3, -1], [-2, 3], [3, 5]].some(([sx, sy]) => (dx - sx) ** 2 + ((dy - sy) * 1.4) ** 2 < 2.4) ? C.leaf : null),
    // 부화가 가까우면 새싹이 삐죽
    after(r, x, y, progress) {
      if (progress < 0.4) return;
      const hx = Math.round(x);
      r.px(hx, y - 1, C.leafDark);
      r.pattern(['XX.XX', '.XXX.'], hx - 2, y - 3, { X: C.leaf });
    },
  },
  ember: {
    shell: '#fff0df',
    mark: (dx, dy) => {
      const z = ((Math.round(dx) % 4) + 4) % 4;
      const d = Math.round(dy) - (z < 2 ? z : 4 - z);
      if (d === 0 || d === 1) return C.body;
      return (dx - 2) ** 2 + (dy + 6) ** 2 < 1.6 || (dx + 3) ** 2 + (dy - 5) ** 2 < 1.6 ? C.flameO : null;
    },
  },
  dewey: {
    shell: '#f6eee3',
    mark: (dx, dy) => {
      const X = Math.round(dx);
      const Y = Math.round(dy);
      if (MOON.has(`${X},${Y}`)) return C.gold;
      return (X * 7 + Y * 13 + 200) % 9 === 0 && Y > -7 ? C.shade : null;
    },
  },
};

class PetRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = GRID;
    canvas.height = GRID;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.species = 'inky';
    this.stage = 'egg';
    this.mood = 'idle';
    this.accessory = 'none';
    this.color = 'natural';
    this.progress = 0;
    this.walking = false;
    this.action = null;
    this.actionAt = 0;
    this.fx = new Set();
    this.particles = [];
    this.last = performance.now() / 1000;
    this.spawnClock = 0;
    this.top = GROUND - 20;
  }

  setSpecies(s) { this.species = SPECIES_BY[s] ? s : 'inky'; }
  setStage(s) { if (STAGE_SHAPE[s]) this.stage = s; }
  setMood(m) { this.mood = m; }
  setAccessory(a) { this.accessory = a || 'none'; }
  setColor(c) { this.color = VARIANTS[c] ? c : 'natural'; }
  setProgress(p) { this.progress = p || 0; }
  setWalking(w) { this.walking = !!w; }

  play(action) {
    if (!ACTION_LEN[action]) return;
    this.action = action;
    this.actionAt = performance.now() / 1000;
    this.fx = new Set();
    const { cx, cy, rx, ry } = this.geom();
    const kind = speciesOf(this.species).happy;
    if (action === 'happy') {
      for (let i = 0; i < 3; i++) {
        const type = i === 0 || this.stage === 'egg' ? 'heart' : kind === 'star' ? 'sparkle' : kind;
        this.spawn(type, cx + rand(-rx, rx), cy - ry, rand(-4, 4), type === 'drop' ? rand(-10, -6) : rand(-14, -8), 1.2);
      }
    }
    if (action === 'link') for (let i = 0; i < 2; i++) this.spawn('link', cx + rand(-rx, rx) - 3, cy - ry, rand(-5, 5), rand(-14, -9), 1.3);
    if (action === 'levelup' || action === 'achieve') for (let i = 0; i < 10; i++) this.spawn('sparkle', cx + rand(-rx - 4, rx + 4), cy + rand(-ry, ry), rand(-8, 8), rand(-16, -4), 1.6);
  }

  // 한 액션 동안 한 번만 하는 일 (입자 뿜기 등)
  once(key, fn) {
    if (this.fx.has(key)) return;
    this.fx.add(key);
    fn();
  }

  geom() {
    const s = STAGE_SHAPE[this.stage];
    const b = this.stage === 'egg' ? s : { ...s, ...ART[this.species].size(s) };
    return { cx: GRID / 2, cy: GROUND - b.ry, rx: b.rx, ry: b.ry };
  }

  spawn(type, x, y, vx, vy, life, v = 0) {
    if (this.particles.length > 60) return;
    this.particles.push({ type, x, y, vx, vy, life, max: life, v });
  }

  // 지금 그려진 캐릭터 위쪽 끝(도트 좌표). 말풍선 위치를 잡는 데 쓴다
  headTop() { return this.top; }

  hit(px, py) {
    const x = Math.floor(px);
    const y = Math.floor(py);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return false;
    return this.ctx.getImageData(x, y, 1, 1).data[3] > 160;
  }

  // ---------- 자세 ----------

  pose(tm) {
    const p = {
      dy: 0, sx: 1, sy: 1, shear: 0, eyes: 'open', mouth: 'smile', lookX: 0, lookY: 0,
      armL: 'rest', armR: 'rest', prop: null, flash: 0, walk: false, step: 0, wag: false, wink: false,
    };
    const blink = tm % 4.3 < 0.13 || (tm + 1.7) % 11 < 0.12;
    const breathe = Math.sin(tm * 2.2);
    const egg = this.stage === 'egg';

    switch (this.mood) {
      case 'writing': {
        p.dy = -Math.abs(Math.sin(tm * 6)) * 0.6;
        const prop = speciesOf(this.species).prop;
        p.prop = egg || this.stage === 'baby' ? null : prop;
        if (prop === 'laptop') p.armL = p.armR = 'type';
        else if (prop === 'tome') p.armL = p.armR = 'tome';
        else if (prop === 'pad') { p.armL = 'pad'; p.armR = 'write'; }
        else { p.armL = 'book'; p.armR = 'write'; }
        p.lookY = 1;
        p.mouth = Math.floor(tm * 0.7) % 3 === 0 ? 'smile' : 'flat';
        if (blink) p.eyes = 'blink';
        if (egg) p.shear = Math.sin(tm * 14) * 0.7;
        break;
      }
      case 'sleepy': {
        p.shear = Math.sin(tm * 1.2) * (egg ? 0.4 : 0.7);
        p.eyes = 'half';
        p.mouth = 'flat';
        if (tm % 9 < 1.5) { p.mouth = 'o'; p.eyes = 'closed'; p.sy = 1.05; }
        break;
      }
      case 'sleeping':
        p.eyes = 'closed';
        p.mouth = 'flat';
        if (!egg) { p.sy = 0.86 + Math.sin(tm * 1.3) * 0.03; p.sx = 1.1; }
        break;
      case 'active':
        p.dy = -Math.abs(Math.sin(tm * 2.5)) * 1.2;
        p.sy = 1 + breathe * 0.025;
        if (blink) p.eyes = 'blink';
        p.lookX = Math.sin(tm * 0.37) > 0.85 ? 1 : Math.sin(tm * 0.29) < -0.9 ? -1 : 0;
        if (egg) { p.dy = 0; p.shear = Math.sin(tm * 3) * 0.5; }
        break;
      default: // idle
        p.sy = 1 + breathe * 0.035;
        if (blink) p.eyes = 'blink';
        p.lookX = Math.sin(tm * 0.37) > 0.8 ? 1 : Math.sin(tm * 0.29) < -0.85 ? -1 : 0;
        if (egg) p.shear = Math.sin(tm * 0.8) > 0.93 ? Math.sin(tm * 20) * 0.6 : 0;
    }

    // 산책: 통통 튀면서 발을 번갈아 든다. 기본 방향은 왼쪽이고, 오른쪽으로 갈 때는 화면에서 뒤집는다
    if (this.walking && !egg && !this.action && (this.mood === 'idle' || this.mood === 'active')) {
      const ph = Math.sin(tm * 9);
      p.walk = true;
      p.step = ph;
      p.dy = -Math.abs(ph) * 1.3;
      p.sy = 1;
      p.shear = -0.3;
      p.lookX = -1;
      p.armL = p.armR = 'swing';
      p.eyes = blink ? 'blink' : 'open';
      p.mouth = 'smile';
    }

    // 액션은 기분보다 우선한다
    if (this.action) {
      const at = tm - this.actionAt;
      const len = ACTION_LEN[this.action];
      if (at > len) this.action = null;
      else {
        const k = at / len;
        p.prop = null;
        p.walk = false;
        p.armL = p.armR = 'rest';
        switch (this.action) {
          case 'happy':
          case 'link': {
            const hop = this.action === 'link' ? 4 : 6;
            p.dy = -Math.sin(k * Math.PI) * hop;
            if (k > 0.85) { p.sy = 0.88; p.sx = 1.1; }
            p.eyes = 'happy'; p.mouth = 'open'; p.armL = p.armR = 'up'; p.wag = true;
            if (egg) { p.dy = -Math.sin(k * Math.PI) * 2; p.shear = Math.sin(at * 20) * 0.8; }
            break;
          }
          case 'levelup':
          case 'achieve': {
            const j = (k * 2) % 1;
            p.dy = -Math.sin(j * Math.PI) * 7;
            if (j > 0.88) { p.sy = 0.86; p.sx = 1.12; }
            p.eyes = 'happy'; p.mouth = 'open'; p.armL = p.armR = 'up'; p.wag = true;
            break;
          }
          case 'evolve': {
            const freq = 4 + k * 26;
            p.flash = k < 0.92 ? (Math.sin(at * freq) > 0 ? 1 : 0) : 1 - (k - 0.92) / 0.08;
            p.eyes = 'closed'; p.mouth = 'flat'; p.dy = -k * 3;
            if (k > 0.9) {
              this.once('burst', () => {
                const { cx, cy } = this.geom();
                for (let i = 0; i < 18; i++) {
                  const a = (i / 18) * Math.PI * 2;
                  this.spawn('sparkle', cx, cy, Math.cos(a) * 26, Math.sin(a) * 26, 1.4);
                }
              });
            }
            break;
          }
          case 'wave':
            p.armR = 'wave'; p.eyes = 'happy'; p.mouth = 'open';
            if (egg) p.shear = Math.sin(at * 8) * 0.8;
            break;
          case 'eat':
            p.prop = 'bowl'; p.armL = p.armR = 'hold';
            p.mouth = Math.floor(at * 5) % 2 ? 'chew' : 'open';
            p.eyes = Math.floor(at * 0.8) % 2 ? 'happy' : 'open';
            break;
          case 'stretch': {
            const s = Math.sin(k * Math.PI);
            p.sy = 1 + s * 0.14; p.sx = 1 - s * 0.08;
            p.armL = p.armR = 'high'; p.eyes = 'closed'; p.mouth = 'o';
            break;
          }
          case 'yawn':
            p.sy = 1.06; p.eyes = 'closed'; p.mouth = 'o';
            break;
          case 'fidget':
            this.fidget(p, k, at);
            break;
        }
      }
    }
    return p;
  }

  // 한가할 때 가끔 하는 버릇. 친구마다 다르다
  fidget(p, k, at) {
    const { cx, cy, rx, ry } = this.geom();
    if (this.stage === 'egg') {
      p.shear = Math.sin(at * 12) * 0.7 * (1 - k);
      return;
    }
    switch (this.species) {
      case 'inky': // 몸을 출렁이다 잉크 한 방울을 똑
        p.sy = 1 + Math.sin(k * Math.PI * 4) * 0.08 * (1 - k);
        p.sx = 1 - Math.sin(k * Math.PI * 4) * 0.05 * (1 - k);
        p.eyes = k > 0.2 && k < 0.7 ? 'happy' : 'open';
        if (k > 0.3) this.once('drip', () => this.spawn('drop', cx + rx * 0.85, cy + 1, 0, 2, 1.6));
        break;
      case 'purrl': // 꼬리를 살랑살랑, 콧노래
        p.wag = true;
        p.eyes = 'happy';
        p.mouth = k < 0.6 ? 'open' : 'smile';
        if (k > 0.2) this.once('note', () => this.spawn('note', cx + rx, cy - ry, 4, -8, 1.3));
        break;
      case 'sprig': // 잎을 흔들며 기지개
        p.wag = true;
        p.shear = Math.sin(at * 6) * 0.5 * (1 - k);
        p.eyes = 'happy';
        if (k > 0.25) this.once('leaf', () => this.spawn('leaf', cx + rand(-3, 3), cy - ry - 4, rand(-4, 4), -7, 1.6));
        break;
      case 'ember': // 콧김 퐁, 작은 불꽃
        p.mouth = k > 0.3 && k < 0.75 ? 'o' : 'smile';
        p.eyes = k > 0.3 && k < 0.75 ? 'closed' : 'open';
        p.flapFast = k > 0.3 && k < 0.75;
        if (k > 0.35) this.once('puff', () => {
          this.spawn('flame', cx - 1, cy + ry * 0.1, rand(-2, 2), -12, 0.9);
          this.spawn('smoke', cx + 2, cy - 1, 3, -8, 1.4);
        });
        break;
      case 'dewey': // 고개를 갸웃, 윙크
        p.shear = Math.sin(Math.min(1, k * 4) * Math.PI / 2) * 0.9 * (k < 0.8 ? 1 : (1 - k) * 5);
        p.wink = k > 0.2 && k < 0.8;
        if (k > 0.3) this.once('q', () => this.spawn('question', cx + rx + 1, cy - ry - 2, 2, -6, 1.3));
        break;
    }
  }

  // ---------- 그리기 ----------

  frame() {
    const tm = performance.now() / 1000;
    const dt = Math.min(0.2, tm - this.last);
    this.last = tm;
    C = paletteOf(this.species, this.color);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, GRID, GRID);
    this.top = GRID;

    const p = this.pose(tm);
    const s = STAGE_SHAPE[this.stage];
    const A = ART[this.species];
    const b = this.stage === 'egg' ? s : { ...s, ...A.size(s) };
    const rx = b.rx * p.sx;
    const ry = b.ry * p.sy;
    const cx = GRID / 2;
    const cy = GROUND - ry + p.dy;
    const g = { cx, cy, rx, ry, p, s, si: s.si, tm, flash: p.flash > 0.5 };
    g.sh = this.stage === 'egg' ? (y) => p.shear * ((GROUND - y) / ry) : (y) => p.shear * ((GROUND - y) / (ry * 2));
    g.skin = (c) => (g.flash ? C.white : c);
    g.hat = HATS.has(this.accessory);

    this.drawShadow(cx, rx, -p.dy);
    if (this.stage === 'egg') this.drawEgg(g);
    else this.drawCreature(g, A);
    this.ambient(g, dt);
    this.drawParticles(dt);
  }

  px(x, y, c, solid = true) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(x, y, 1, 1);
    if (solid && y < this.top) this.top = y;
  }

  rect(x, y, w, h, c) {
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  pattern(rows, x, y, map, solid = true) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch !== '.' && map[ch]) this.px(x + i, y + j, map[ch], solid);
      }
    });
  }

  // pattern 에 1도트 외곽선을 두른다 (모자처럼 몸 위에 얹는 것)
  outlined(rows, x, y, map) {
    const on = (i, j) => j >= 0 && j < rows.length && i >= 0 && i < rows[j].length && rows[j][i] !== '.';
    for (let j = -1; j <= rows.length; j++) {
      for (let i = -1; i <= rows[0].length; i++) {
        if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) this.px(x + i, y + j, C.outline);
      }
    }
    this.pattern(rows, x, y, map);
  }

  // inside(x, y) 로 정의한 모양을 칠하고 1도트 외곽선을 두른다
  shape(inside, box, fill, outline) {
    const [x0, y0, x1, y1] = box.map(Math.round);
    for (let y = y0 - 1; y <= y1 + 1; y++) {
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        if (inside(x, y)) {
          const c = fill(x, y);
          if (c) this.px(x, y, c);
        } else if (outline && (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1))) {
          this.px(x, y, outline);
        }
      }
    }
  }

  ellipse(cx, cy, rx, ry, fillC, outline, shear = () => 0) {
    this.shape(
      (x, y) => {
        const nx = (x + 0.5 - cx - shear(y)) / rx;
        const ny = (y + 0.5 - cy) / ry;
        return nx * nx + ny * ny <= 1;
      },
      [cx - rx - 2, cy - ry, cx + rx + 2, cy + ry],
      typeof fillC === 'function' ? fillC : () => fillC,
      outline,
    );
  }

  // 기울어진 타원 (잎·날개)
  blob(cx, cy, rx, ry, angle, fillC, outline) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const R = Math.max(rx, ry) + 1;
    this.shape(
      (x, y) => {
        const X = x + 0.5 - cx;
        const Y = y + 0.5 - cy;
        const u = (X * c + Y * s) / rx;
        const v = (-X * s + Y * c) / ry;
        return u * u + v * v <= 1;
      },
      [cx - R, cy - R, cx + R, cy + R],
      typeof fillC === 'function' ? fillC : () => fillC,
      outline,
    );
  }

  // 다각형 (날개)
  poly(pts, fillC, outline) {
    const inside = (x, y) => {
      const X = x + 0.5;
      const Y = y + 0.5;
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > Y !== yj > Y && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    this.shape(inside, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], typeof fillC === 'function' ? fillC : () => fillC, outline);
  }

  // 점 [x, y, 굵기] 를 잇는 관 (꼬리·뿔). fill(k) 의 k 는 뿌리 0 → 끝 1
  tube(pts, fill, outline) {
    const along = (x, y) => {
      const X = x + 0.5;
      const Y = y + 0.5;
      let best = null;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0, r0] = pts[i];
        const [x1, y1, r1] = pts[i + 1];
        const dx = x1 - x0;
        const dy = y1 - y0;
        let u = ((X - x0) * dx + (Y - y0) * dy) / (dx * dx + dy * dy || 1);
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        if (Math.hypot(X - (x0 + dx * u), Y - (y0 + dy * u)) <= r0 + (r1 - r0) * u) {
          const k = (i + u) / (pts.length - 1);
          if (best === null || k > best) best = k;
        }
      }
      return best;
    };
    const R = Math.max(...pts.map((q) => q[2]));
    this.shape(
      (x, y) => along(x, y) !== null,
      [Math.min(...pts.map((q) => q[0])) - R, Math.min(...pts.map((q) => q[1])) - R, Math.max(...pts.map((q) => q[0])) + R, Math.max(...pts.map((q) => q[1])) + R],
      (x, y) => fill(along(x, y)),
      outline,
    );
  }

  drawShadow(cx, rx, height) {
    const w = Math.max(3, rx * (0.95 - Math.min(height, 8) * 0.05));
    for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
      this.px(x, GROUND + 1, C.shadow, false);
      if (Math.abs(x - cx) < w - 2) this.px(x, GROUND + 2, C.shadow, false);
    }
  }

  drawEgg({ cx, cy, rx, ry, p, sh, tm }) {
    const E = EGG[this.species] || EGG.inky;
    const inside = (x, y) => {
      const ny = (y + 0.5 - cy) / ry;
      const w = ny < 0 ? rx * (0.78 + 0.22 * (1 + ny)) : rx;
      const nx = (x + 0.5 - cx - sh(y)) / w;
      return nx * nx + ny * ny <= 1;
    };
    this.shape(inside, [cx - rx - 3, cy - ry, cx + rx + 3, cy + ry],
      (x, y) => {
        if (p.flash > 0.5) return C.white;
        const dx = x - cx - sh(y);
        const dy = y - cy;
        const m = E.mark(dx, dy, tm);
        if (m) return m;
        if ((dx / rx) * 0.5 + (dy / ry) * 0.8 > 0.55) return C.shellShade;
        if ((dx / rx + 0.45) ** 2 + (dy / ry + 0.5) ** 2 < 0.05) return C.white;
        return E.shell;
      },
      C.shellOutline);

    // 부화가 가까워지면 금이 간다
    const s0 = sh(cy);
    if (this.progress > 0.5) this.pattern(['X.X', '.X.'], cx - 5 + s0, cy - 3, { X: C.crack });
    if (this.progress > 0.8) this.pattern(['.X..X', 'X.XX.', '....X'], cx + 1 + s0, cy - 1, { X: C.crack });
    if (this.progress > 0.93 && Math.floor(tm * 3) % 2) this.px(cx + 3 + s0, cy - 6, C.white);
    if (E.after && p.flash <= 0.5) E.after(this, cx + sh(cy - ry), Math.round(cy - ry), this.progress, tm);
  }

  drawCreature(g, A) {
    const { cx, cy, rx, ry, p } = g;
    g.top = A.top ? A.top(g) : cy - ry;
    g.hatY = A.hatY ? A.hatY(g) : g.top;
    g.ex = Math.max(3, Math.round(rx * (A.eyeGap || 0.42)));
    g.ey0 = Math.round(cy - ry * 0.08);
    g.faceR = g.ex * 0.78 + 0.8;

    if (A.back) A.back(this, g);
    if (A.feet) A.feet(this, g);
    else this.drawFeet(g);
    if (A.behind) A.behind(this, g);

    this.shape(A.inside(g), [cx - rx - 3, g.top - 1, cx + rx + 3, cy + ry], A.fill(g), C.outline);

    if (A.front) A.front(this, g);
    if (this.accessory === 'scarf') this.drawScarf(g);
    if (!g.flash) this.drawFace(g, A);
    if (A.crown && !g.hat) A.crown(this, g);

    // 소품 (팔보다 뒤)
    if (p.prop) this.drawProp(p.prop, g);

    if (g.s.arms) {
      for (const [side, mode] of [[-1, p.armL], [1, p.armR]]) {
        if (A.arm) A.arm(this, g, side, mode);
        else this.drawArm(g, side, mode);
      }
    }
    if (!g.flash) this.drawAccessory(g);
  }

  drawFeet(g) {
    const { cx, rx, p } = g;
    if (g.s.feet) {
      for (const side of [-1, 1]) {
        const lift = p.walk && side * p.step > 0 ? 1 : 0;
        this.ellipse(cx + side * rx * 0.5, GROUND - 1 + Math.min(0, p.dy * 0.3) - lift, 2.6, 1.6, g.skin(C.shade), C.outline);
      }
    } else {
      for (const side of [-1, 1]) {
        const lift = p.walk && side * p.step > 0 ? 1 : 0;
        this.px(cx + side * 3, GROUND + Math.min(0, p.dy) - lift, g.skin(C.shade));
      }
    }
  }

  drawFace(g, A) {
    const { cy, ry, p, sh } = g;
    const ex = g.ex;
    const ey = g.ey0 + p.lookY;
    const mx = Math.round(g.cx + sh(ey) + p.lookX);
    const baby = this.stage === 'baby';
    const big = !!A.bigEyes;

    for (const side of [-1, 1]) {
      const x = mx + side * ex - (side < 0 ? 1 : 0);
      let eyes = p.eyes;
      if (p.wink && side > 0 && eyes === 'open') eyes = 'happy';
      switch (eyes) {
        case 'blink':
        case 'half':
          this.rect(x - (big && side < 0 ? 1 : 0), ey + 1, big ? 3 : 2, 1, C.eye);
          if (eyes === 'half') this.px(x + (side < 0 ? 0 : 1), ey + 2, C.eye);
          break;
        case 'closed':
          this.px(x - 1, ey + 1, C.eye); this.px(x, ey + 2, C.eye); this.px(x + 1, ey + 2, C.eye); this.px(x + 2, ey + 1, C.eye);
          break;
        case 'happy':
          this.px(x - 1, ey + 2, C.eye); this.px(x, ey + 1, C.eye); this.px(x + 1, ey + 1, C.eye); this.px(x + 2, ey + 2, C.eye);
          break;
        default:
          if (big) {
            const bx = side < 0 ? x - 1 : x;
            this.rect(bx, ey - 1, 3, baby ? 4 : 3, C.eye);
            this.px(bx, ey - 1, C.white);
            if (!baby) this.px(bx + 2, ey + 1, C.white);
          } else {
            this.rect(x, ey - (baby ? 1 : 0), 2, baby ? 4 : 3, C.eye);
            this.px(x, ey - (baby ? 1 : 0), C.white);
          }
      }
      // 볼터치
      this.rect(mx + side * (ex + 2) - (side < 0 ? 1 : 0), ey + 3, 2, 1, C.cheek);
    }
    if (A.whiskers) A.whiskers(this, g, ey);

    const my = Math.round(cy + ry * 0.3 + p.lookY * 0.5);
    const def = () => this.drawMouth(mx, my, p.mouth);
    if (A.mouth) A.mouth(this, g, mx, my, p.mouth, def);
    else def();
  }

  drawMouth(mx, my, m) {
    switch (m) {
      case 'open':
        this.rect(mx - 1, my, 3, 2, C.mouth); this.px(mx, my + 1, C.tongue);
        break;
      case 'o':
        this.rect(mx - 1, my - 1, 3, 3, C.mouth); this.px(mx, my, C.tongue);
        break;
      case 'chew':
        this.rect(mx - 1, my, 3, 1, C.mouth);
        break;
      case 'flat':
        this.rect(mx - 1, my, 2, 1, C.mouth);
        break;
      default:
        this.px(mx - 2, my, C.mouth); this.px(mx - 1, my + 1, C.mouth); this.px(mx, my + 1, C.mouth); this.px(mx + 1, my, C.mouth);
    }
  }

  drawArm(g, side, mode) {
    const { cx, cy, rx, ry, tm } = g;
    let x = cx + side * (rx + 0.3);
    let y = cy + ry * 0.25;
    const propY = g.propY != null ? g.propY : cy + ry * 0.32;
    switch (mode) {
      case 'swing':
        y += (g.p.step || 0) * side * 1.2;
        break;
      case 'type':
        x = cx + side * 5;
        y = GROUND - 10 + (Math.floor(tm * 10 + (side > 0 ? 1 : 0)) % 2 ? -1 : 0);
        break;
      case 'book': // 공책 왼쪽 끝을 잡는다
        x = cx - 10;
        y = propY + 2;
        break;
      case 'pad':
        x = cx - 7;
        y = propY + 4;
        break;
      case 'tome':
        x = cx + side * 7.5;
        y = propY + 3;
        break;
      case 'write': // 오른쪽 위에서 연필을 움직인다
        x = cx + 5 + Math.round(Math.sin(tm * 9) * 1.5);
        y = propY + 2 + (Math.floor(tm * 8) % 2 ? -1 : 0);
        break;
      case 'up':
        x = cx + side * (rx + 1.2);
        y = cy - ry * 0.55;
        break;
      case 'high':
        x = cx + side * rx * 0.45;
        y = cy - ry - 2;
        break;
      case 'wave':
        x = cx + side * (rx + 1.5) + Math.round(Math.sin(tm * 16));
        y = cy - ry * 0.6;
        break;
      case 'hold':
        x = cx + side * rx * 0.42;
        y = cy + ry * 0.55;
        break;
    }
    const big = g.si >= 3;
    if (mode === 'write') {
      const hx = Math.round(x);
      const hy = Math.round(y);
      if (this.species === 'inky') {
        // 잉키는 깃펜
        this.px(hx + 1, hy - 2, C.feather); this.px(hx + 2, hy - 3, C.feather); this.px(hx + 3, hy - 4, C.feather); this.px(hx + 2, hy - 4, C.featherShade);
      } else {
        this.px(hx + 1, hy - 2, C.pencil); this.px(hx + 2, hy - 3, C.pencil); this.px(hx + 3, hy - 4, C.pencilTip);
      }
      this.px(hx, hy - 1, C.pencilTip);
    }
    this.ellipse(x, y, big ? 2.5 : 2.1, big ? 1.9 : 1.6, g.skin(C.body), C.outline);
  }

  // ---------- 소품 ----------

  drawProp(kind, g) {
    const { cx, cy, ry, tm } = g;
    // 소품이 눈을 가리지 않게 눈 아래에서 시작한다
    const below = (y, gap = 4) => Math.max(Math.round(y), g.ey0 + g.p.lookY + gap);
    switch (kind) {
      case 'book': { // 펼친 공책. 오른쪽 쪽에 줄이 한 줄씩 늘어난다
        const y0 = (g.propY = below(cy + ry * 0.32));
        const h = Math.max(5, GROUND - y0 - 1);
        const w = 18;
        const x0 = Math.round(cx - w / 2);
        this.rect(x0 - 1, y0 - 1, w + 2, h + 2, C.outline);
        this.rect(x0, y0, w, h, C.paper);
        this.rect(x0 + 8, y0, 2, h, C.paperShade);
        for (let r = 1; r < h - 1; r += 2) this.rect(x0 + 1, y0 + r, 6, 1, C.inkLine);
        const rows = Math.floor((h - 1) / 2);
        const shown = Math.floor(tm * 1.4) % (rows + 1);
        for (let i = 0; i < shown; i++) this.rect(x0 + 11, y0 + 1 + i * 2, i === shown - 1 ? 3 + (Math.floor(tm * 6) % 4) : 6, 1, C.inkLine);
        this.rect(x0 - 2, GROUND, w + 4, 1, C.shade);
        break;
      }
      case 'scroll': { // 두루마리. 양끝이 말려 있다
        const y0 = (g.propY = below(cy + ry * 0.32));
        const h = Math.max(5, GROUND - y0 - 1);
        const w = 14;
        const x0 = Math.round(cx - w / 2);
        this.rect(x0 - 1, y0, w + 2, h, C.outline);
        this.rect(x0, y0, w, h, C.parchment);
        for (const ex of [x0 - 3, x0 + w]) {
          this.rect(ex, y0 - 1, 3, h + 2, C.outline);
          this.rect(ex + 1, y0, 1, h, C.parchmentShade);
        }
        const rows = Math.floor((h - 1) / 2);
        const shown = Math.floor(tm * 1.6) % (rows + 1);
        for (let i = 0; i < shown; i++) this.rect(x0 + 2, y0 + 1 + i * 2, i === shown - 1 ? 2 + (Math.floor(tm * 6) % 7) : 10, 1, i % 2 ? C.flameR : C.inkLine);
        break;
      }
      case 'pad': { // 체크리스트 클립보드
        const y0 = (g.propY = below(cy + ry * 0.28, 6));
        const h = Math.max(6, GROUND - y0);
        const w = 12;
        const x0 = Math.round(cx - w / 2) - 1;
        this.rect(x0 - 1, y0 - 1, w + 2, h + 1, C.outline);
        this.rect(x0, y0, w, h, C.pad);
        this.rect(x0 + 1, y0 + 2, w - 2, h - 3, C.paper);
        this.rect(Math.round(cx) - 3, y0 - 2, 4, 2, C.laptopDark);
        const rows = Math.max(1, Math.floor((h - 4) / 3));
        const done = Math.floor(tm * 0.9) % (rows + 1);
        for (let i = 0; i < rows; i++) {
          const yy = y0 + 3 + i * 3;
          if (yy + 1 >= y0 + h - 1) break;
          if (i < done) this.pattern(['.X', 'X.'], x0 + 2, yy, { X: C.check });
          else this.rect(x0 + 2, yy, 2, 2, C.paperShade);
          this.rect(x0 + 5, yy + 1, 4, 1, C.inkLine);
        }
        break;
      }
      case 'laptop': { // 노트북 뒷면. 가운데에 하트 로고
        const w = 16;
        const h = 9;
        const x0 = Math.round(cx - w / 2);
        const y0 = (g.propY = GROUND - h);
        this.rect(x0 - 1, y0 - 1, w + 2, h + 1, C.outline);
        this.rect(x0, y0, w, h - 1, C.laptop);
        this.rect(x0, y0 + h - 2, w, 1, C.laptopDark);
        this.pattern(['X.X', 'XXX', '.X.'], Math.round(cx) - 2, y0 + 3, { X: Math.floor(tm * 2) % 2 ? C.logo : C.white });
        this.rect(x0 - 2, GROUND, w + 4, 1, C.laptopDark);
        break;
      }
      case 'tome': { // 두 날개로 받쳐 든 두꺼운 책. 표지가 보인다
        const w = 14;
        const x0 = Math.round(cx - w / 2);
        const y0 = (g.propY = below(cy + ry * 0.22, 3));
        const h = GROUND - y0;
        this.rect(x0 - 1, y0 - 1, w + 2, h + 1, C.outline);
        this.rect(x0, y0, w, h, C.tome);
        this.rect(x0, y0, 2, h, C.tomeDark);
        this.rect(x0 + 3, y0 - 1, w - 4, 1, C.paper);
        this.pattern(['.G.', 'GGG', '.G.'], Math.round(cx), y0 + Math.max(1, Math.floor(h / 2) - 1), { G: C.gold });
        this.rect(x0 + 4, y0 + 1, w - 6, 1, C.gold);
        if (tm % 3.4 < 0.35) this.rect(x0 + w - 3, y0 - 2, 2, 2, C.paper);
        break;
      }
      case 'bowl': {
        const y0 = GROUND - 4;
        this.ellipse(cx, y0 - 0.5, 5, 1.8, C.rice, C.bowlShade);
        this.shape(
          (x, y) => { const nx = (x + 0.5 - cx) / 6.5; const ny = (y + 0.5 - y0) / 4; return ny >= 0 && nx * nx + ny * ny <= 1; },
          [cx - 7, y0, cx + 7, y0 + 4],
          (x, y) => (y === y0 + 1 ? C.bowlBand : C.bowl),
          C.outline,
        );
        if (Math.random() < 0.25) this.spawn('steam', cx + rand(-3, 3), y0 - 4, rand(-1, 1), -6, 1.1);
        break;
      }
    }
  }

  // ---------- 꾸미기 ----------

  drawScarf({ cx, cy, rx, ry, sh }) {
    const y0 = Math.round(cy + ry * 0.5);
    for (let y = y0; y < y0 + 3; y++) {
      const ny = (y + 0.5 - cy) / ry;
      const half = rx * Math.sqrt(Math.max(0, 1 - ny * ny));
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) this.px(x + sh(y), y, y === y0 + 2 ? C.scarfDark : C.scarf);
    }
    this.rect(Math.round(cx + rx * 0.45), y0 + 3, 2, 4, C.scarf);
    this.rect(Math.round(cx + rx * 0.45), y0 + 6, 2, 1, C.scarfDark);
  }

  drawAccessory(g) {
    const { cx, cy, rx, ry, sh } = g;
    const top = Math.round(g.hatY);
    const hx = Math.round(cx + sh(top));
    const ex = g.ex;
    const ey = g.ey0;
    switch (this.accessory) {
      case 'sprout':
        this.px(hx - 4, top, C.leafDark);
        this.pattern(['XX.XX', '.XXX.'], hx - 6, top - 2, { X: C.leaf });
        break;
      case 'ribbon':
        this.pattern(['AA.AA', 'AABAA', 'AA.AA'], hx + Math.round(rx * 0.35) - 2, top - 1, { A: C.ribbon, B: C.ribbonDark });
        break;
      case 'quill':
        this.pattern([
          '....WW',
          '...WWS',
          '..WWS.',
          '.WWS..',
          '.WS...',
          'S.....',
        ], hx + Math.round(rx * 0.3), top - 5, { W: C.feather, S: C.shaft });
        this.px(hx + Math.round(rx * 0.3) + 4, top - 4, C.featherShade);
        break;
      case 'glasses': {
        const wide = ART[this.species].bigEyes ? 1 : 0;
        for (const side of [-1, 1]) {
          const x = hx + side * ex - (side < 0 ? 1 : 0) - 2 - (wide && side < 0 ? 1 : 0);
          const w = 6 + wide;
          for (let i = 0; i < w; i++) {
            for (let j = 0; j < 5; j++) {
              const edge = i === 0 || i === w - 1 || j === 0 || j === 4;
              if (edge && !((i === 0 || i === w - 1) && (j === 0 || j === 4))) this.px(x + i, ey - 1 + j, C.glass);
              else if (!edge) this.px(x + i, ey - 1 + j, C.lens, false);
            }
          }
        }
        this.rect(hx - ex + 4, ey, 2 * ex - 7, 1, C.glass);
        break;
      }
      case 'headphones': {
        for (let a = Math.PI * 1.08; a <= Math.PI * 1.92; a += 0.04) {
          this.px(cx + Math.cos(a) * (rx + 1), cy + Math.sin(a) * (ry + 1.5), C.phone);
        }
        for (const side of [-1, 1]) {
          const x = Math.round(cx + side * (rx + 0.5)) - 1;
          this.rect(x, Math.round(cy - ry * 0.35), 3, 5, C.phone);
          this.rect(x + (side < 0 ? 2 : 0), Math.round(cy - ry * 0.35) + 1, 1, 3, C.phonePad);
        }
        break;
      }
      case 'beanie': {
        // 머리에 얹는 둥근 털모자. 몸 모양과 상관없이 같은 모양이다
        const rw = Math.min(rx * 0.82 + 1, 11);
        const rh = 5 + (g.si >= 3 ? 1 : 0);
        const band = top + rh - 2;
        this.shape(
          (x, y) => { const nx = (x + 0.5 - hx - 0.5) / rw; const ny = (y + 0.5 - band) / rh; return y <= band + 1 && nx * nx + ny * ny <= 1; },
          [hx - rw - 1, band - rh - 1, hx + rw + 1, band + 1],
          (x, y) => (y >= band ? C.beanieDark : (x + y) % 3 === 0 ? C.beanieDark : C.beanie),
          C.outline,
        );
        this.ellipse(hx + 0.5, band - rh - 0.5, 2, 1.6, C.pom, C.outline);
        break;
      }
      case 'nightcap':
        this.outlined([
          '.......XX',
          '.....XXXX',
          '...XXXXX.',
          '.XXXXXXX.',
          'DDDDDDDDD',
        ], hx - 5, top - 3, { X: C.nightcap, D: C.nightcapDark });
        this.ellipse(hx + 5, top - 4, 1.5, 1.3, C.pom, C.outline);
        break;
      case 'chef':
        this.ellipse(hx, top - 5, 5.5, 3.2, C.chef, C.outline);
        this.rect(hx - 4, top - 3, 9, 3, C.chef);
        this.rect(hx - 4, top - 1, 9, 1, C.chefShade);
        this.rect(hx - 5, top - 3, 1, 3, C.outline);
        this.rect(hx + 5, top - 3, 1, 3, C.outline);
        break;
      case 'party':
        this.outlined([
          '...S...',
          '...A...',
          '..ABA..',
          '..BAB..',
          '.ABABA.',
          '.BABAB.',
          'ABABABA',
        ], hx - 3, top - 6, { A: C.party, B: C.partyDark, S: C.spark });
        break;
      case 'crown':
        this.pattern([
          'O..O..O',
          'YO.Y.OY',
          'YYYGYYY',
          'DDDDDDD',
        ], hx - 3, top - 3, { Y: C.crown, D: C.crownDark, G: C.gem, O: C.crownDark });
        break;
    }
  }

  // 기분에 따라 알아서 생기는 입자들
  ambient({ cx, cy, rx, ry, p }, dt) {
    this.spawnClock += dt;
    if (this.mood === 'sleeping' && !this.action && this.spawnClock > 1.6) {
      this.spawnClock = 0;
      this.spawn(Math.random() < 0.5 ? 'z' : 'zs', cx + rx * 0.5, cy - ry - 2, rand(3, 6), -5, 2.4);
    }
    if (this.mood === 'writing' && !this.action && this.spawnClock > 1.1) {
      this.spawnClock = 0;
      const prop = speciesOf(this.species).prop;
      if (prop === 'laptop') this.spawn('key', cx + rand(-6, 6), GROUND - 12, rand(-3, 3), rand(-12, -8), 0.9);
      else if (prop === 'tome' && this.stage !== 'egg' && this.stage !== 'baby') {
        if (Math.random() < 0.4) this.spawn('sparkle', cx + rand(-rx, rx), cy - ry - 2, 0, -6, 1.1);
      } else if (prop === 'scroll' && Math.random() < 0.5) this.spawn('flame', cx + rand(-rx * 0.6, rx * 0.8), cy + ry * 0.2, rand(-2, 2), rand(-12, -8), 0.8);
      else this.spawn('glyph', cx + rand(-rx * 0.6, rx * 0.8), cy + ry * 0.2, rand(-3, 3), rand(-12, -8), 1.3, Math.floor(Math.random() * GLYPHS.length));
    }
    if (this.action === 'evolve' && Math.random() < 0.5) {
      this.spawn('sparkle', cx + rand(-rx - 5, rx + 5), cy + rand(-ry - 4, ry), 0, rand(-10, -4), 0.8);
    }
    if (p.mouth === 'open' && this.action === 'wave' && this.spawnClock > 0.9) {
      this.spawnClock = 0;
      this.spawn('note', cx + rx + 3, cy - ry, 4, -8, 1.2);
    }
  }

  drawParticles(dt) {
    const map = {
      heart: { X: C.heart },
      sparkle: { X: C.spark, W: C.white },
      z: { X: C.z },
      zs: { X: C.z },
      note: { X: C.outline },
      glyph: { X: C.outline },
      link: { X: C.link },
      drop: { O: C.outline, X: C.body, W: C.light },
      leaf: { X: C.leaf, D: C.leafDark },
      flame: { Y: C.flameY, O: C.flameO, R: C.flameR },
      feather: { X: C.light, S: C.shade },
      smoke: { X: C.smoke },
      key: { X: C.laptopDark },
      question: { X: C.outline },
    };
    this.particles = this.particles.filter((q) => (q.life -= dt) > 0);
    for (const q of this.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.type === 'sparkle') { q.vx *= 0.94; q.vy *= 0.94; }
      if (q.type === 'drop') q.vy += 26 * dt;
      if (q.type === 'leaf') q.vx = Math.sin(q.life * 4) * 5;
      if (q.type === 'z' || q.type === 'zs') q.vx = Math.sin(q.life * 3) * 3;
      const fade = q.life / q.max;
      this.ctx.globalAlpha = clampN(fade * 1.5, 0, 1);
      if (q.type === 'steam') this.px(q.x, q.y, 'rgba(255,255,255,0.9)', false);
      else {
        const rows = q.type === 'glyph' ? GLYPHS[q.v] : PATTERNS[q.type];
        this.pattern(rows, Math.round(q.x), Math.round(q.y), map[q.type], false);
      }
      this.ctx.globalAlpha = 1;
    }
  }

  busy() {
    return !!this.action || this.particles.length > 0;
  }
}
/* ────────────────────────────── 효과음 ────────────────────────────── */
// 파일 없이 WebAudio 로 만든다. 음표는 [이름, 길이] 이거나 미끄러지는 [시작Hz, 끝Hz, 길이].

const PetSound = (() => {
  let ctx = null;
  const NOTES = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1567.98 };
  const SONGS = {
    levelup: [['C5', 0.08], ['E5', 0.08], ['G5', 0.08], ['C6', 0.18]],
    achieve: [['G5', 0.07], ['C6', 0.07], ['E6', 0.07], ['G6', 0.22]],
    quest: [['E5', 0.07], ['A5', 0.14]],
    link: [['E6', 0.04], ['G6', 0.08]],
    evolve: [['C5', 0.06], ['D5', 0.06], ['E5', 0.06], ['G5', 0.06], ['A5', 0.06], ['C6', 0.06], ['E6', 0.06], ['G6', 0.3]],
    pop: [['A5', 0.04]],
    // 친구들 울음소리
    cry_inky: { wave: 'triangle', notes: [[520, 780, 0.07], [780, 640, 0.1]] },
    cry_purrl: { wave: 'triangle', notes: [[700, 1150, 0.09], [1150, 760, 0.16]] },
    cry_sprig: { wave: 'triangle', notes: [[880, 880, 0.05], [1175, 1320, 0.09]] },
    cry_ember: { wave: 'square', notes: [[196, 330, 0.08], [330, 170, 0.18]] },
    cry_dewey: { wave: 'triangle', notes: [[415, 392, 0.12], [0, 0, 0.05], [415, 370, 0.2]] },
  };
  function play(name, volume = 0.05) {
    const song = SONGS[name];
    if (!song) return;
    const notes = Array.isArray(song) ? song : song.notes;
    const wave = Array.isArray(song) ? 'square' : song.wave;
    try {
      ctx = ctx || new AudioContext();
      let at = ctx.currentTime + 0.02;
      for (const n of notes) {
        const [f0, f1, len] = n.length === 2 ? [NOTES[n[0]], NOTES[n[0]], n[1]] : n;
        if (f0) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = wave;
          osc.frequency.setValueAtTime(f0, at);
          if (f1 !== f0) osc.frequency.linearRampToValueAtTime(f1, at + len);
          gain.gain.setValueAtTime(volume * (wave === 'triangle' ? 2 : 1), at);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
          osc.connect(gain).connect(ctx.destination);
          osc.start(at);
          osc.stop(at + len + 0.02);
        }
        at += len * 0.9;
      }
    } catch {
      // 소리를 못 내는 환경이면 조용히 넘어간다
    }
  }
  function close() {
    if (ctx) ctx.close().catch(() => {});
    ctx = null;
  }
  return { play, close };
})();

/* ────────────────────────────── 설정값 ────────────────────────────── */
// 이름·색깔·장식·성장 시작점은 친구마다 따로라서 state.party 에 있다

const DEFAULT_SETTINGS = {
  language: 'auto',
  showWidget: true,
  roam: true, // 편집 화면 아래쪽을 산책한다
  scale: 2,
  widgetPos: null, // { right, bottom } px. 산책할 때 돌아오는 자리
  showStatusBar: true,
  pixelFont: true,
  bubblesEnabled: true,
  chatter: true,
  soundEnabled: true,
  lunchEnabled: true,
  lunchTime: '11:50',
  dinnerEnabled: true,
  dinnerTime: '18:30',
  restAfterMin: 90,
  sleepyAfterMin: 20,
  sleepAfterMin: 45,
  lateNightEnabled: true,
  excludedFolders: [],
};
// 0.1.x 에서 설정에 있던 펫 정보. 불러올 때 첫 친구 기록으로 옮기고 지운다
const LEGACY_PET_KEYS = ['petName', 'accessory', 'color', 'startMode', 'startStage', 'baselineAt', 'baseline'];

const DEFAULT_POS = { right: 24, bottom: 36 };

// 보상·알림 말풍선은 "말풍선 끄기"와 상관없이 보인다
const REWARD_KINDS = new Set(['grow', 'achieve', 'item', 'color', 'quest', 'attend', 'retro', 'milestone']);
// 알이어도 알아듣게 말하는 말풍선
const EGG_OK = new Set([...REWARD_KINDS, 'hello']);
// 밀려 있으면 버려도 되는 말풍선
const CHATTY = new Set(['chatter', 'poke', 'link', 'note']);

const STAGE_EMOJI = { egg: '🥚', baby: '🐣', child: '🌿', teen: '✨', adult: '👑' };

const ICON_ROWS = [
  '....XX....',
  '...X..X...',
  '..XXXXXX..',
  '.XXXXXXXX.',
  'XX.XXXX.XX',
  'XX.XXXX.XX',
  'XXXXXXXXXX',
  'XXXXXXXXXX',
  '.XXXXXXXX.',
  '.XX....XX.',
];
const ICON_SVG = ICON_ROWS.map((row, y) => [...row].map((ch, x) => (ch === 'X' ? `<rect x="${x * 10}" y="${y * 10}" width="10" height="10" fill="currentColor"/>` : '')).join('')).join('');

/* ────────────────────────────── DOM 도구 ────────────────────────────── */

// <b>, <code>, `코드` 만 허용하는 작은 서식. innerHTML 을 쓰지 않는다
function rich(el, s) {
  const re = /<(b|code)>(.*?)<\/\1>|`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) el.appendText(s.slice(last, m.index));
    if (m[3] !== undefined) el.createEl('code', { text: m[3] });
    else el.createEl(m[1], { text: m[2] });
    last = re.lastIndex;
  }
  if (last < s.length) el.appendText(s.slice(last));
  return el;
}

function bar(parent, frac, kind) {
  const b = parent.createDiv({ cls: 'vp-bar' + (kind ? ' is-' + kind : '') });
  b.createEl('i').style.width = `${clampN(frac, 0, 1) * 100}%`;
  return b;
}

function button(parent, text, onClick, cls = '') {
  const b = parent.createEl('button', { cls: 'vp-btn ' + cls, text });
  b.addEventListener('click', onClick);
  return b;
}

// 타입 딱지: "✒️ 잉크"
function typeChip(parent, sp) {
  const el = parent.createSpan({ cls: 'vp-type', text: `${sp.icon} ${tr(sp.type)}` });
  el.style.setProperty('--vp-type', sp.typeColor);
  el.setAttr('aria-label', t('typeName', { type: tr(sp.type) }));
  return el;
}

function perkText(sp) {
  return t('perk_' + sp.perk.kind, { p: Math.round((sp.perk.mult - 1) * 100) });
}

// 친구가 사는 곳을 배경으로 까는 작은 무대. 안에 캔버스를 넣는다
function habitat(parent, species, cls = '') {
  return parent.createDiv({ cls: 'vp-habitat ' + cls, attr: { 'data-species': species } });
}

// 강조색을 지금 파트너 몸 색에 맞춘다
function paintAccent(el, species, color) {
  const p = paletteOf(species, color);
  el.style.setProperty('--vp-accent', p.accent);
  el.style.setProperty('--vp-accent-2', p.light);
}

/* ────────────────────────────── 애니메이션 루프 ────────────────────────────── */
// 펫 캔버스 여러 개(떠 있는 펫, 하우스, 노트 카드)를 한 타이머로 그린다.

class Animator {
  constructor() {
    this.items = new Map();
    this.timer = null;
  }

  add(r, opts = {}) {
    this.items.set(r, { every: opts.every || 70, after: opts.after, at: 0 });
    this.kick();
  }

  remove(r) {
    this.items.delete(r);
  }

  kick() {
    if (this.timer == null) this.timer = window.setTimeout(() => this.run(), 16);
  }

  run() {
    this.timer = null;
    if (!this.items.size) return;
    const now = performance.now();
    let slow = true;
    // 창이 가려져 있으면 쉬지만, 한 번도 안 그린 캔버스는 첫 장면만 그려 둔다
    const hidden = document.hidden;
    {
      for (const [r, o] of this.items) {
        const cv = r.canvas;
        if (hidden && o.at) continue;
        if (!cv.isConnected || cv.offsetParent === null) continue;
        if (!(r.mood === 'sleeping' && !r.busy())) slow = false;
        if (now - o.at < o.every) continue;
        o.at = now;
        r.frame();
        if (o.after) o.after();
      }
    }
    this.timer = window.setTimeout(() => this.run(), slow ? 160 : 50);
  }

  stop() {
    window.clearTimeout(this.timer);
    this.timer = null;
    this.items.clear();
  }
}

/* ────────────────────────────── 화면에 떠 있는 펫 ────────────────────────────── */
// 편집 화면 오른쪽 아래가 집이다. 한가하면 편집 화면 아래쪽을 산책하고, 글을 쓰면 그 자리에 앉아 같이 쓴다.

class PetWidget {
  constructor(plugin) {
    this.plugin = plugin;
    this.el = null;
    this.queue = [];
    this.current = null;
    this.stageKey = null;
    this.hatchPending = false;
    this.dx = 0; // 집에서 왼쪽으로 떨어진 거리(px). 산책하면 바뀐다
  }

  get P() {
    return this.plugin;
  }

  mount() {
    if (this.el) return;
    const el = (this.el = document.body.createDiv({ cls: 'vault-pet-widget' }));
    this.canvas = el.createEl('canvas', { cls: 'vault-pet-canvas' });
    this.bubbleEl = el.createDiv({ cls: 'vault-pet-bubble' });
    this.bubbleName = this.bubbleEl.createSpan({ cls: 'vp-bubble-name' });
    this.bubbleText = this.bubbleEl.createSpan({ cls: 'vp-text' });
    this.bubbleHint = this.bubbleEl.createSpan({ cls: 'vp-hint' });
    this.bubbleEl.createSpan({ cls: 'vp-more', text: '▼' });
    this.bubbleEl.hide();
    this.cardEl = el.createDiv({ cls: 'vault-pet-hud' });
    this.cardEl.hide();
    this.loadingEl = el.createDiv({ cls: 'vault-pet-loading' });
    this.loadingEl.hide();
    this.sprite = new PetRenderer(this.canvas);
    this.stageKey = null;
    this.speciesKey = null;
    this.dx = 0;
    this.walk = null;
    this.nextWalk = performance.now() + 8000;
    this.applyScale();
    this.applyPosition();
    this.bind();
    this.P.anim.add(this.sprite, {
      every: 60,
      after: () => {
        this.stepWalk();
        this.place();
      },
    });
    if (this.P.loading != null) this.setLoading(this.P.loading);
    this.update();
  }

  unmount() {
    if (!this.el) return;
    this.P.anim.remove(this.sprite);
    document.removeEventListener('mousemove', this.onDocMove);
    window.clearTimeout(this.hideTimer);
    window.clearInterval(this.typeTimer);
    window.clearTimeout(this.hoverTimer);
    window.clearTimeout(this.stageTimer);
    this.el.remove();
    this.el = null;
    this.walk = null;
    this.queue = [];
    this.current = null;
  }

  bind() {
    const cv = this.canvas;
    this.onDocMove = (e) => {
      if (this.press) return;
      const over = this.isOverPet(e);
      cv.style.pointerEvents = over ? 'auto' : 'none';
      this.setOver(over);
    };
    document.addEventListener('mousemove', this.onDocMove);

    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.pointerType === 'mouse' && !this.isOverPet(e)) return;
      e.preventDefault();
      this.press = { x: e.clientX, y: e.clientY, pos: { ...(this.curPos || this.pos()) } };
      this.dragging = false;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        // 캡처를 못 해도 끌기만 조금 덜 매끄러울 뿐이다
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.press) return;
      const dx = e.clientX - this.press.x;
      const dy = e.clientY - this.press.y;
      if (!this.dragging && Math.hypot(dx, dy) > 4) {
        this.dragging = true;
        this.el.addClass('is-dragging');
        this.cardEl.hide();
      }
      if (this.dragging) this.setPos({ right: this.press.pos.right - dx, bottom: this.press.pos.bottom - dy });
    });
    const end = (e, cancelled) => {
      if (!this.press) return;
      if (this.dragging) {
        // 내려놓은 곳이 새 집이 된다
        this.el.removeClass('is-dragging');
        this.P.settings.widgetPos = { ...this.curPos };
        this.dx = 0;
        this.P.saveSoon();
      } else if (!cancelled) {
        this.P.poke();
      }
      this.press = null;
      this.dragging = false;
    };
    cv.addEventListener('pointerup', (e) => end(e, false));
    cv.addEventListener('pointercancel', (e) => end(e, true));
    cv.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.P.openHouse();
    });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.P.petMenu(e);
    });
    this.bubbleEl.addEventListener('click', () => {
      if (this.current && this.current.link) this.P.openHouse(this.current.link);
      this.nextBubble();
    });
  }

  isOverPet(e) {
    const r = this.canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return false;
    let x = ((e.clientX - r.left) / r.width) * GRID;
    if (this.flip) x = GRID - x;
    return this.sprite.hit(x, ((e.clientY - r.top) / r.height) * GRID);
  }

  setOver(v) {
    if (v === this.over) return;
    this.over = v;
    window.clearTimeout(this.hoverTimer);
    if (v && !this.current) {
      this.hoverTimer = window.setTimeout(() => {
        if (this.current || !this.el) return;
        this.renderCard();
        this.cardEl.show();
      }, 350);
    } else this.cardEl.hide();
  }

  // ---------- 위치·크기 ----------

  size() {
    return GRID * this.P.settings.scale;
  }

  applyScale() {
    if (!this.el) return;
    const s = this.size();
    this.canvas.style.width = `${s}px`;
    this.canvas.style.height = `${s}px`;
    this.el.style.width = `${s}px`;
    this.el.style.height = `${s}px`;
    this.clamp();
  }

  // 집 자리
  pos() {
    const p = this.P.settings.widgetPos || this.defaultPos();
    return { right: p.right, bottom: p.bottom };
  }

  // 기본 자리: 편집 영역의 오른쪽 아래 (오른쪽 사이드바를 가리지 않게)
  defaultPos() {
    const root = document.querySelector('.workspace-split.mod-root');
    if (!root) return DEFAULT_POS;
    const r = root.getBoundingClientRect();
    if (!r.width) return DEFAULT_POS;
    return {
      right: Math.max(DEFAULT_POS.right, window.innerWidth - r.right + 28),
      bottom: Math.max(DEFAULT_POS.bottom, window.innerHeight - r.bottom + 36),
    };
  }

  setPos(p) {
    const s = this.size();
    const right = clampN(Math.round(p.right), 0, Math.max(0, window.innerWidth - s));
    const bottom = clampN(Math.round(p.bottom), 0, Math.max(0, window.innerHeight - s));
    this.el.style.right = `${right}px`;
    this.el.style.bottom = `${bottom}px`;
    this.curPos = { right, bottom };
  }

  // 집 + 산책한 거리
  applyPosition() {
    if (!this.el) return;
    const home = this.pos();
    const [lo, hi] = this.walkRange();
    this.dx = clampN(this.dx, lo, hi);
    this.setPos({ right: home.right + this.dx, bottom: home.bottom });
  }

  clamp() {
    this.applyPosition();
  }

  // 산책할 수 있는 거리 [lo, hi] (집 기준, 왼쪽이 +)
  walkRange() {
    const s = this.size();
    const home = this.pos();
    let minR = 0;
    let maxR = window.innerWidth - s;
    const root = document.querySelector('.workspace-split.mod-root');
    if (root) {
      const r = root.getBoundingClientRect();
      const left = window.innerWidth - home.right - s;
      // 집이 편집 영역 안에 있으면 그 폭 안에서만 걷는다
      if (r.width > s * 2 && left >= r.left - 8 && left + s <= r.right + 8) {
        minR = window.innerWidth - r.right + 8;
        maxR = window.innerWidth - r.left - s - 8;
      }
    }
    const reach = clampN(window.innerWidth * 0.3, 90, 360);
    const lo = Math.max(minR, home.right - reach) - home.right;
    const hi = Math.min(maxR, home.right + reach) - home.right;
    return [Math.min(lo, 0), Math.max(hi, 0)];
  }

  setFlip(v) {
    this.flip = v;
    if (this.el) this.el.toggleClass('is-flip', v);
  }

  // 한가하면 가끔 걸어서 자리를 옮긴다. 마우스를 올리거나, 말하거나, 글을 쓰면 멈춘다
  stepWalk() {
    const now = performance.now();
    const dt = Math.min(0.25, (now - (this.lastStep || now)) / 1000);
    this.lastStep = now;
    const P = this.P;
    const g = P.growth;
    const mood = P.brain.mood;
    const free = P.settings.roam && g && g.stageKey !== 'egg' && this.stageKey !== 'egg' && !this.press && !this.over && !this.current
      && !this.sprite.action && (mood === 'idle' || mood === 'active') && !document.hidden;
    if (!free) {
      if (this.walk) this.stopWalk(now, false);
      return;
    }
    if (!this.walk) {
      if (now < this.nextWalk) return;
      if (Math.random() < 0.3) {
        // 걷는 대신 버릇을 부린다
        this.sprite.play('fidget');
        this.nextWalk = now + rand(7000, 14000);
        return;
      }
      const [lo, hi] = this.walkRange();
      if (hi - lo < 30) {
        this.nextWalk = now + 15000;
        return;
      }
      let target = rand(lo, hi);
      if (Math.abs(target - this.dx) < 40) target = clampN(this.dx + (target > this.dx ? 1 : -1) * rand(50, 110), lo, hi);
      if (Math.abs(target - this.dx) < 16) {
        this.nextWalk = now + 5000;
        return;
      }
      this.walk = { target, speed: rand(16, 24) * Math.sqrt(P.settings.scale / 2) };
      // 기본 그림은 왼쪽을 본다. 오른쪽(dx 가 줄어드는 쪽)으로 갈 때만 뒤집는다
      this.setFlip(target < this.dx);
      this.sprite.setWalking(true);
    }
    const w = this.walk;
    const d = w.target - this.dx;
    const step = w.speed * dt;
    this.dx = Math.abs(d) <= step ? w.target : this.dx + Math.sign(d) * step;
    const home = this.pos();
    this.setPos({ right: home.right + this.dx, bottom: home.bottom });
    if (this.dx === w.target) this.stopWalk(now, true);
  }

  stopWalk(now, arrived) {
    this.walk = null;
    this.sprite.setWalking(false);
    this.nextWalk = now + (arrived ? rand(6000, 16000) : rand(3000, 6000));
    if (arrived && Math.random() < 0.2) this.sprite.play('fidget');
  }

  // 말풍선·상태 창이 캐릭터 머리 위에 붙어 있고, 창 밖으로 나가지 않게
  place() {
    const scale = this.P.settings.scale;
    const bottom = (GRID - this.sprite.headTop()) * scale + 8;
    const rect = this.el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    for (const e of [this.bubbleEl, this.cardEl]) {
      e.style.bottom = `${bottom}px`;
      if (!e.isShown()) continue;
      const w = e.offsetWidth;
      const left = clampN(center - w / 2, 8, Math.max(8, window.innerWidth - w - 8));
      e.style.left = `${Math.round(left - rect.left)}px`;
      e.style.setProperty('--vp-tail', `${Math.round(center - left)}px`);
    }
  }

  // ---------- 상태 ----------

  setLoading(p) {
    if (!this.el) return;
    if (p === null || p === undefined) {
      this.loadingEl.hide();
      return;
    }
    this.hatchPending = true;
    this.loadingEl.show();
    this.loadingEl.setText(t('loadingMemory', { p: Math.round(p * 100) }));
  }

  update() {
    if (!this.el) return;
    const P = this.P;
    const s = this.sprite;
    const g = P.growth;
    const pet = P.pet;
    s.setMood(P.brain.mood);
    s.setAccessory(pet.accessory);
    s.setColor(pet.color);
    paintAccent(this.el, P.species, pet.color);
    if (this.speciesKey !== P.species) {
      this.speciesKey = P.species;
      s.setSpecies(P.species);
      this.stageKey = null;
    }
    this.el.toggleClass('is-quiet', P.isQuiet());
    if (g) {
      s.setProgress(g.progress);
      // 첫 실행: 안내를 마칠 때까지 알로 있다가, 마치면 지금 단계로 부화한다
      if (this.hatchPending && !P.st.onboarded) {
        s.setStage('egg');
      } else if (this.stageKey !== g.stageKey) {
        this.stageKey = g.stageKey;
        window.clearTimeout(this.stageTimer);
        const later = () => {
          this.stageTimer = window.setTimeout(() => s.setStage(this.stageKey), 1900);
        };
        if (s.action === 'evolve') later();
        else if (this.hatchPending && g.stageKey !== 'egg') {
          s.play('evolve');
          P.sound('evolve');
          later();
        } else s.setStage(g.stageKey);
        this.hatchPending = false;
      }
    }
    if (this.cardEl.isShown()) this.renderCard();
  }

  action(a) {
    if (this.el) this.sprite.play(a);
  }

  // 마우스를 올리면 뜨는 상태 창. 게임 속 상태 창처럼 이름·레벨·EXP 막대
  renderCard() {
    const P = this.P;
    const g = P.growth;
    const sp = speciesOf(P.species);
    const c = this.cardEl;
    c.empty();
    const head = c.createDiv({ cls: 'vp-hud-head' });
    head.createSpan({ cls: 'vp-hud-name', text: P.pet.name + (P.isQuiet() ? ' 🔕' : '') });
    if (g) head.createSpan({ cls: 'vp-hud-lv', text: `Lv.${g.level}` });
    const sub = c.createDiv({ cls: 'vp-hud-sub' });
    typeChip(sub, sp);
    sub.createSpan({ text: g ? `${STAGE_EMOJI[g.stageKey]} ${stageName(g.stageKey)}` : t('cardEggLoading') });
    if (!g) return;
    const exp = c.createDiv({ cls: 'vp-hud-exp' });
    exp.createSpan({ cls: 'vp-hud-label', text: 'EXP' });
    bar(exp, (g.xp - g.levelFloor) / (g.levelCeil - g.levelFloor), 'exp');
    c.createDiv({
      cls: 'vp-hud-line',
      text: g.nextStageKey
        ? t('cardStage', { a: stageName(g.stageKey), b: stageName(g.nextStageKey), p: Math.floor(g.progress * 100) })
        : t('cardGrown', { a: stageName(g.stageKey) }),
    });
    c.createDiv({ cls: 'vp-hud-line', text: t('mood_' + P.brain.mood) });
    const td = P.ledger.today();
    const streak = P.game.streaks().current;
    c.createDiv({ cls: 'vp-hud-today', text: t('cardToday', { c: compact(td.c), l: td.l, n: td.n }) + (streak ? ` · 🔥${streak}` : '') });
    c.createDiv({ cls: 'vp-hud-hint', text: t('hudHint') });
  }

  // ---------- 말풍선 ----------

  say(b) {
    if (!this.el) return;
    if (this.current && CHATTY.has(b.kind) && this.queue.length) return; // 수다는 밀려 있으면 버린다
    if (b.kind === 'grow') {
      // 진화·레벨 업은 줄 맨 앞으로 (먼저 온 성장 말풍선 뒤)
      const i = this.queue.findIndex((q) => q.kind !== 'grow');
      this.queue.splice(i < 0 ? this.queue.length : i, 0, b);
    } else this.queue.push(b);
    while (this.queue.length > 5) {
      const i = this.queue.findIndex((q) => CHATTY.has(q.kind));
      this.queue.splice(i >= 0 ? i : this.queue.length - 1, 1);
    }
    if (!this.current) this.nextBubble();
  }

  nextBubble() {
    window.clearTimeout(this.hideTimer);
    window.clearInterval(this.typeTimer);
    this.current = this.queue.shift() || null;
    const el = this.bubbleEl;
    if (!this.current) {
      el.removeClass('is-shown');
      this.hideTimer = window.setTimeout(() => !this.current && el.hide(), 150);
      return;
    }
    const cur = this.current;
    el.toggleClass('is-reward', REWARD_KINDS.has(cur.kind));
    el.removeClass('is-done');
    this.bubbleName.setText(this.P.pet.name);
    const hints = { achievements: 'hintAchievements', quests: 'hintQuests', wardrobe: 'hintWardrobe', dex: 'hintDex' };
    this.bubbleHint.setText(cur.link && hints[cur.link] ? t(hints[cur.link]) : '');
    el.show();
    this.cardEl.hide();
    // requestAnimationFrame 은 창이 가려져 있으면 멈춰서 타이머로 연다
    window.setTimeout(() => this.current === cur && el.addClass('is-shown'), 20);

    // 한 글자씩 타이핑. 다 쓰면 ▼ 가 깜빡인다
    const chars = [...cur.text];
    let i = 0;
    this.bubbleText.setText('');
    this.typeTimer = window.setInterval(() => {
      this.bubbleText.setText(chars.slice(0, ++i).join(''));
      if (i >= chars.length) {
        window.clearInterval(this.typeTimer);
        el.addClass('is-done');
      }
    }, 28);
    if (!REWARD_KINDS.has(cur.kind) && cur.kind !== 'poke') this.P.sound('pop', 0.015);

    const ms = Math.max(3500, Math.min(9000, 2200 + chars.length * 110)) + (cur.link ? 2500 : 0);
    this.hideTimer = window.setTimeout(() => {
      el.removeClass('is-shown');
      this.hideTimer = window.setTimeout(() => this.nextBubble(), 220);
    }, ms);
  }

  // 경험치가 들어오면 머리 위로 "+12 XP" 가 떠오른다
  floatXp(n) {
    if (!this.el || n <= 0) return;
    const f = this.el.createDiv({ cls: 'vault-pet-xp', text: `+${fmt(n)} XP` });
    f.style.bottom = `${(GRID - this.sprite.headTop()) * this.P.settings.scale}px`;
    window.setTimeout(() => f.remove(), 1400);
  }
}

/* ────────────────────────────── 펫 하우스 (사이드바) ────────────────────────────── */

const TABS = ['home', 'quests', 'dex', 'achievements', 'wardrobe', 'stats'];
const TAB_ICON = { home: '🏠', quests: '📜', dex: '📖', achievements: '🏅', wardrobe: '🎀', stats: '📊' };

class HouseView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = 'home';
    this.minis = [];
    this.lastBody = 0;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return t('houseTitle');
  }

  getIcon() {
    return ICON;
  }

  async onOpen() {
    this.build();
  }

  async onClose() {
    if (this.hero) this.plugin.anim.remove(this.hero);
    this.clearMinis();
  }

  clearMinis() {
    for (const m of this.minis) this.plugin.anim.remove(m);
    this.minis = [];
  }

  mini(parent, o) {
    const P = this.plugin;
    const cv = parent.createEl('canvas', { cls: 'vp-pixel ' + (o.cls || '') });
    const r = new PetRenderer(cv);
    r.setSpecies(o.species || P.species);
    r.setStage(o.stage || 'egg');
    r.setAccessory(o.acc || 'none');
    r.setColor(o.color || P.pet.color);
    r.setMood(o.mood || 'idle');
    r.setProgress(o.progress || 0);
    r.frame();
    this.minis.push(r);
    P.anim.add(r, { every: o.every || 180 });
    return r;
  }

  build() {
    const root = this.contentEl;
    root.empty();
    root.addClass('vault-pet-house');
    this.plugin.addFontsTo(root.ownerDocument);
    const top = root.createDiv({ cls: 'vp-top' });
    const hero = top.createDiv({ cls: 'vp-hero' });
    this.heroStage = habitat(hero, this.plugin.species, 'vp-hero-stage');
    const cv = this.heroStage.createEl('canvas', { cls: 'vp-pixel vp-hero-canvas' });
    this.hero = new PetRenderer(cv);
    cv.addEventListener('click', () => {
      this.plugin.poke();
      this.hero.play('happy');
    });
    this.plugin.anim.add(this.hero, { every: 80 });
    const info = hero.createDiv({ cls: 'vp-hero-info' });
    const nameRow = info.createDiv({ cls: 'vp-hero-name' });
    this.nameEl = nameRow.createEl('button', { cls: 'vp-name-btn' });
    this.nameEl.addEventListener('click', () => new RenameModal(this.plugin).open());
    this.typeEl = nameRow.createSpan();
    this.lvEl = info.createDiv({ cls: 'vp-lv' });
    this.moodEl = info.createDiv({ cls: 'vp-mood' });
    const xp = info.createDiv({ cls: 'vp-xp' });
    xp.createSpan({ cls: 'vp-hud-label', text: 'EXP' });
    this.xpBar = bar(xp, 0, 'exp');
    this.xpText = xp.createSpan();
    const streak = hero.createDiv({ cls: 'vp-hero-streak' });
    this.streakEl = streak.createEl('b');
    streak.createSpan({ text: t('streakDays') });

    this.tabsEl = top.createDiv({ cls: 'vp-tabs' });
    this.tabBtns = {};
    for (const key of TABS) {
      const b = this.tabsEl.createEl('button');
      b.addEventListener('click', () => this.setTab(key));
      this.tabBtns[key] = b;
    }
    this.body = root.createDiv({ cls: 'vp-body' });
    this.update(true);
  }

  setTab(tab) {
    if (!TABS.includes(tab)) tab = 'home';
    this.tab = tab;
    this.update(true);
    this.contentEl.scrollTop = 0;
  }

  // 데이터가 바뀔 때마다 불린다. 본문은 너무 자주 다시 그리지 않는다
  update(force) {
    if (!this.body) return;
    const P = this.plugin;
    const g = P.growth;
    const pet = P.pet;
    const sp = speciesOf(P.species);
    paintAccent(this.contentEl, P.species, pet.color);
    this.heroStage.setAttr('data-species', P.species);
    this.hero.setSpecies(P.species);
    this.hero.setAccessory(pet.accessory);
    this.hero.setColor(pet.color);
    this.hero.setMood(P.brain.mood);
    this.nameEl.setText(pet.name);
    this.nameEl.setAttr('aria-label', t('sName'));
    this.typeEl.empty();
    typeChip(this.typeEl, sp);
    if (g) {
      this.hero.setStage(g.stageKey);
      this.hero.setProgress(g.progress);
      this.lvEl.setText(`Lv.${g.level} · ${stageName(g.stageKey)}`);
      const into = g.xp - g.levelFloor;
      const need = g.levelCeil - g.levelFloor;
      this.xpBar.firstElementChild.style.width = `${(into / need) * 100}%`;
      this.xpText.setText(t('xpOf', { a: fmt(into), b: fmt(need) }));
    } else {
      this.hero.setStage('egg');
      this.lvEl.setText(tr(sp.kind));
      this.xpText.setText(P.loading != null ? t('loadingMemory', { p: Math.round(P.loading * 100) }) : t('readingVault'));
    }
    this.moodEl.setText((P.isQuiet() ? t('quietOn') + ' · ' : '') + t('mood_' + P.brain.mood));
    this.streakEl.setText(`🔥${P.game.streaks().current}`);

    const q = P.game.quests();
    const done = q.filter((x) => x.done).length;
    for (const key of TABS) {
      const b = this.tabBtns[key];
      b.empty();
      b.setAttr('aria-label', t('tab_' + key));
      b.createSpan({ cls: 'vp-tab-icon', text: TAB_ICON[key] });
      b.createSpan({ cls: 'vp-tab-label', text: t('tab_' + key) });
      if (key === 'quests') b.createSpan({ cls: 'vp-tab-count', text: `${done}/${q.length}` });
      if (key === 'dex') b.createSpan({ cls: 'vp-tab-count', text: `${Object.keys(P.st.party).length}/${SPECIES.length}` });
      b.toggleClass('is-active', key === this.tab);
      if (key === 'wardrobe' && this.hasNew()) b.createSpan({ cls: 'vp-dot' });
    }

    const now = Date.now();
    if (!force && (now - this.lastBody < 2500 || !this.contentEl.isShown())) {
      this.dirty = true;
      window.clearTimeout(this.bodyTimer);
      this.bodyTimer = window.setTimeout(() => this.dirty && this.update(false), 2600);
      return;
    }
    this.dirty = false;
    this.lastBody = now;
    const y = this.contentEl.scrollTop;
    this.clearMinis();
    this.body.empty();
    this['render_' + this.tab](this.body);
    this.contentEl.scrollTop = y;
  }

  hasNew() {
    const st = this.plugin.st;
    return st.items.some((k) => k !== 'none' && !st.seen.includes('i:' + k)) || st.colors.some((k) => k !== 'natural' && !st.seen.includes('c:' + k));
  }

  // ---------- 홈 ----------

  render_home(b) {
    const P = this.plugin;
    const g = P.growth;
    const td = P.ledger.today();
    const st = P.game.streaks();
    const sp = speciesOf(P.species);

    if (P.loading != null) b.createDiv({ cls: 'vp-banner', text: t('loadingMemory', { p: Math.round(P.loading * 100) }) });

    const cards = b.createDiv({ cls: 'vp-cards' });
    const stat = (k, v, d) => {
      const c = cards.createDiv({ cls: 'vp-panel vp-stat' });
      c.createDiv({ cls: 'vp-k', text: k });
      c.createDiv({ cls: 'vp-v', text: v });
      c.createDiv({ cls: 'vp-d', text: d });
    };
    const xpOfPart = (tot) => xpOf(tot, P.species);
    stat(t('todayChars'), fmt(td.c), `+${fmt(xpOfPart({ c: td.c, l: 0, n: 0 }))} XP`);
    stat(t('todayLinks'), fmt(td.l), `+${fmt(xpOfPart({ c: 0, l: td.l, n: 0 }))} XP`);
    stat(t('todayNotes'), fmt(td.n), `+${fmt(xpOfPart({ c: 0, l: 0, n: td.n }))} XP`);
    stat(t('attendance'), `🔥${st.current}`, t('attendanceSub', { b: st.best, t: st.total }));

    // 파트너 소개
    const about = b.createDiv({ cls: 'vp-panel vp-about' });
    const aboutHead = about.createDiv({ cls: 'vp-about-head' });
    aboutHead.createSpan({ cls: 'vp-strong', text: `${tr(sp.kind)}` });
    typeChip(aboutHead, sp);
    about.createDiv({ cls: 'vp-muted vp-small', text: tr(sp.dex) });
    const facts = about.createDiv({ cls: 'vp-facts' });
    const fact = (k, v) => {
      const f = facts.createDiv();
      f.createSpan({ cls: 'vp-muted', text: k });
      f.createSpan({ text: v });
    };
    fact(t('traitLabel'), tr(sp.trait));
    fact(t('likesLabel'), tr(sp.likes));
    fact(t('perkLabel'), perkText(sp));

    b.createEl('h3', { text: t('roadmap') });
    const panel = b.createDiv({ cls: 'vp-panel' });
    const road = panel.createDiv({ cls: 'vp-road' });
    STAGES.forEach((s, i) => {
      const cls = !g ? 'is-locked' : i < g.stageIndex ? 'is-done' : i === g.stageIndex ? 'is-now' : 'is-locked';
      const step = road.createDiv({ cls: 'vp-step ' + cls });
      this.mini(step, { stage: s.key, progress: i === 0 && g && g.stageIndex === 0 ? g.progress : 0, mood: i === (g ? g.stageIndex : -1) ? P.brain.mood : 'idle', acc: 'none' });
      step.createDiv({ text: stageName(s.key) });
      step.createDiv({ cls: 'vp-muted', text: compact(s.min) });
    });
    bar(panel, g ? g.progress : 0).addClass('vp-gap');
    panel.createDiv({
      cls: 'vp-center vp-muted vp-gap',
      text: g ? (g.nextStageKey ? t('toNext', { stage: stageName(g.nextStageKey), xp: fmt(g.xpToNext) }) : t('grownUp')) : t('readingVault'),
    });

    b.createEl('h3', { text: t('play') });
    const acts = b.createDiv({ cls: 'vp-actions' });
    button(acts, t('actPoke'), () => {
      P.poke();
      this.hero.play('happy');
    });
    button(acts, t('actWave'), () => {
      P.widget.action('wave');
      this.hero.play('wave');
    });
    button(acts, t('actStretch'), () => {
      P.widget.action('stretch');
      this.hero.play('stretch');
    });
    button(acts, P.isQuiet() ? t('actQuietOff') : t('actQuietOn'), () => {
      P.toggleQuiet();
      this.update(true);
    });
    button(acts, P.settings.showWidget ? t('actHide') : t('actShow'), () => {
      P.setWidgetVisible(!P.settings.showWidget);
      this.update(true);
    });
    if (P.settings.showWidget) {
      button(acts, P.settings.roam ? t('menuRoamOff') : t('menuRoamOn'), () => {
        P.toggleRoam();
        this.update(true);
      }, 'is-ghost');
      button(acts, t('actPosition'), () => P.resetPosition(), 'is-ghost');
    }

    b.createEl('h3', { text: t('recentXp') });
    const feed = b.createDiv({ cls: 'vp-panel' });
    const recent = P.st.bonus.slice(-8).reverse();
    if (recent.length) {
      const ul = feed.createEl('ul', { cls: 'vp-feed' });
      for (const x of recent) {
        const li2 = ul.createEl('li');
        li2.createSpan({ text: bonusText(x.why, P.pet.name) });
        li2.createSpan({ cls: 'vp-plus', text: `+${fmt(x.xp)} XP` });
      }
    } else feed.createDiv({ cls: 'vp-muted vp-center', text: t('recentXpEmpty') });

    b.createEl('h3', { text: t('cardTipTitle') });
    rich(b.createDiv({ cls: 'vp-panel vp-muted vp-small' }), t('cardTip'));
  }

  // ---------- 퀘스트 ----------

  render_quests(b) {
    const P = this.plugin;
    const q = P.game.quests();
    const done = q.filter((x) => x.done).length;
    const now = new Date();
    const left = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    const sp = speciesOf(P.species);
    b.createEl('h3', { text: t('questsTitle') });
    b.createDiv({ cls: 'vp-muted vp-small vp-sub', text: t('questsSub', { h: Math.floor(left / 3.6e6), m: Math.floor((left % 3.6e6) / 6e4) }) });
    if (sp.perk.kind === 'quest') b.createDiv({ cls: 'vp-perk-note', text: `${sp.icon} ${P.pet.name} · ${perkText(sp)}` });
    for (const x of q) {
      const p = b.createDiv({ cls: 'vp-panel vp-quest' + (x.done ? ' is-done' : '') });
      p.createDiv({ cls: 'vp-icon', text: x.icon });
      const body = p.createDiv({ cls: 'vp-qbody' });
      const row = body.createDiv({ cls: 'vp-row' });
      row.createSpan({ text: x.text });
      row.createSpan({ cls: 'vp-reward', text: `${x.done ? '✔ ' : ''}+${x.xp} XP` });
      bar(body, x.value / x.target, x.done ? 'good' : '');
      body.createDiv({ cls: 'vp-muted vp-small', text: `${fmt(x.value)} / ${fmt(x.target)}` });
    }
    const allXp = Math.round(ALL_CLEAR_XP * P.game.perk('quest'));
    const all = b.createDiv({ cls: 'vp-panel vp-allclear' + (done === q.length ? ' is-done' : '') });
    all.setText(done === q.length ? t('allClearDone', { xp: allXp }) : t('allClearTodo', { xp: allXp }));
    b.createDiv({ cls: 'vp-muted vp-small vp-gap', text: t('questsTip', { n: fmt(P.st.questsDone) }) });
  }

  // ---------- 도감 ----------

  render_dex(b) {
    const P = this.plugin;
    const party = P.st.party;
    b.createEl('h3', { text: t('dexTitle', { a: Object.keys(party).length, b: SPECIES.length }) });
    b.createDiv({ cls: 'vp-muted vp-small vp-sub', text: t('dexSub') });
    const grid = b.createDiv({ cls: 'vp-dex' });
    SPECIES.forEach((sp, i) => {
      const rec = party[sp.key];
      const partner = P.species === sp.key;
      const g = rec ? (partner && P.growth ? P.growth : growthOf(rec.frozen || 0)) : null;
      const card = grid.createDiv({ cls: 'vp-panel vp-dex-card' + (partner ? ' is-partner' : '') + (rec ? '' : ' is-unmet') });
      card.style.setProperty('--vp-type', sp.typeColor);
      const stage = habitat(card, sp.key, 'vp-dex-stage');
      this.mini(stage, {
        species: sp.key,
        stage: g ? g.stageKey : 'egg',
        color: rec ? rec.color : 'natural',
        acc: rec ? rec.accessory : 'none',
        mood: partner ? P.brain.mood : 'idle',
        progress: g ? g.progress : 0.2,
        every: 160,
      });
      const info = card.createDiv({ cls: 'vp-dex-info' });
      const top = info.createDiv({ cls: 'vp-dex-top' });
      top.createSpan({ cls: 'vp-dex-no', text: `No.${String(i + 1).padStart(3, '0')}` });
      typeChip(top, sp);
      const name = info.createDiv({ cls: 'vp-dex-name' });
      name.createSpan({ text: rec ? rec.name : tr(sp.name) });
      name.createSpan({ cls: 'vp-muted', text: tr(sp.kind) });
      info.createDiv({ cls: 'vp-dex-perk', text: `${tr(sp.trait)} · ${perkText(sp)}` });
      info.createDiv({ cls: 'vp-ds', text: tr(sp.dex) });
      const foot = info.createDiv({ cls: 'vp-dex-foot' });
      if (partner) {
        foot.createSpan({ cls: 'vp-dex-badge', text: '★ ' + t('dexPartner') });
        if (g) foot.createSpan({ cls: 'vp-muted', text: `Lv.${g.level} · ${stageName(g.stageKey)}` });
      } else if (rec) {
        foot.createSpan({ cls: 'vp-muted', text: t('dexResting', { lv: g.level, stage: stageName(g.stageKey) }) });
        button(foot, t('dexSwitch'), () => {
          const cur = P.pet.name;
          new ConfirmModal(this.app, t('switchConfirm', { name: rec.name, wa: josa(rec.name, '과', '와'), cur, neun: josa(cur, '은', '는') }), () => P.switchPartner(sp.key)).open();
        }, 'mod-cta');
      } else {
        foot.createSpan({ cls: 'vp-muted', text: t('dexUnmet') });
        button(foot, '🥚 ' + t('dexAdopt'), () => {
          const cur = P.pet.name;
          new ConfirmModal(this.app, t('adoptConfirm', { kind: tr(sp.kind), cur, neun: josa(cur, '은', '는') }), () => P.switchPartner(sp.key)).open();
        });
      }
    });
  }

  // ---------- 업적 ----------

  render_achievements(b) {
    const P = this.plugin;
    const c = P.game.context({ level: P.growth ? P.growth.level : 1, stageIndex: P.growth ? P.growth.stageIndex : 0 });
    const list = ACHIEVEMENTS.map((a) => ({ a, at: P.st.achievements[a.id] || null, p: a.progress ? a.progress(c) : null }));
    const got = list.filter((x) => x.at).length;
    const prog = (x) => (x.p ? Math.min(1, x.p[0] / x.p[1]) : 0);
    list.sort((x, y) => !!y.at - !!x.at || prog(y) - prog(x));
    b.createEl('h3', { text: t('badgesTitle', { a: got, b: list.length }) });
    bar(b, got / list.length, 'gold').addClass('vp-gapb');
    const grid = b.createDiv({ cls: 'vp-badges' });
    for (const x of list) {
      const el = grid.createDiv({ cls: 'vp-panel vp-badge' + (x.at ? '' : ' is-locked') });
      el.createDiv({ cls: 'vp-ic', text: x.a.icon });
      el.createDiv({ cls: 'vp-nm', text: tr(x.a.name) });
      el.createDiv({ cls: 'vp-ds', text: tr(x.a.desc) });
      el.createDiv({ cls: 'vp-xpb', text: `+${fmt(x.a.xp)} XP` });
      if (!x.at && x.p) {
        bar(el, x.p[0] / x.p[1]);
        el.createDiv({ cls: 'vp-muted vp-tiny', text: `${compact(Math.min(x.p[0], x.p[1]))} / ${compact(x.p[1])}` });
      }
      if (x.at) el.createDiv({ cls: 'vp-when', text: `✔ ${new Date(x.at).toLocaleDateString(locale())}` });
    }
  }

  // ---------- 꾸미기 ----------

  render_wardrobe(b) {
    const P = this.plugin;
    const g = P.growth;
    const stage = g ? g.stageKey : 'egg';
    const egg = stage === 'egg';
    const st = P.st;
    const pet = P.pet;

    b.createEl('h3', { text: t('colorsTitle') });
    const colors = b.createDiv({ cls: 'vp-wardrobe' });
    for (const col of COLORS) {
      const open = st.colors.includes(col.key);
      const on = pet.color === col.key;
      const el = colors.createDiv({ cls: 'vp-panel vp-item' + (on ? ' is-on' : '') + (open ? '' : ' is-locked') });
      this.mini(el, { stage: egg ? 'baby' : stage, color: col.key, acc: pet.accessory });
      const nm = el.createDiv({ cls: 'vp-nm', text: open ? tr(col.name) : '🔒 ???' });
      if (open && col.key !== 'natural' && !st.seen.includes('c:' + col.key)) nm.createSpan({ cls: 'vp-new', text: t('isNew') });
      el.createDiv({ cls: 'vp-hint', text: on ? t('wearing') : open ? '' : unlockHint(col) });
      el.addEventListener('click', () => {
        if (!open) return new Notice(t('lockedAt', { hint: unlockHint(col) }));
        pet.color = col.key;
        P.saveSoon();
        P.updateUI();
        new Notice(t('paintedColor', { name: tr(col.name) }));
        this.update(true);
      });
    }

    b.createEl('h3', { text: t('itemsTitle') });
    b.createDiv({ cls: 'vp-muted vp-small vp-sub', text: egg ? t('wardrobeEgg') : t('wardrobeHint') });
    const items = b.createDiv({ cls: 'vp-wardrobe' });
    for (const it of ITEMS) {
      const open = st.items.includes(it.key);
      const on = pet.accessory === it.key;
      const el = items.createDiv({ cls: 'vp-panel vp-item' + (on ? ' is-on' : '') + (open ? '' : ' is-locked') });
      this.mini(el, { stage: egg ? 'baby' : stage, acc: it.key });
      const nm = el.createDiv({ cls: 'vp-nm', text: open ? `${it.icon} ${tr(it.name)}` : '🔒 ???' });
      if (open && it.key !== 'none' && !st.seen.includes('i:' + it.key)) nm.createSpan({ cls: 'vp-new', text: t('isNew') });
      el.createDiv({ cls: 'vp-hint', text: on ? t('wearing') : open ? '' : unlockHint(it) });
      el.addEventListener('click', () => {
        if (!open) return new Notice(t('lockedAt', { hint: unlockHint(it) }));
        if (egg) return new Notice(t('eggCantWear'));
        pet.accessory = it.key;
        P.saveSoon();
        P.updateUI();
        new Notice(it.key === 'none' ? t('tookOff') : t('woreItem', { icon: it.icon, name: tr(it.name) }));
        this.update(true);
      });
    }

    // 잠깐 보고 나면 NEW 표시를 지운다
    window.clearTimeout(this.seenTimer);
    this.seenTimer = window.setTimeout(() => {
      let changed = false;
      for (const k of st.items) if (!st.seen.includes('i:' + k)) { st.seen.push('i:' + k); changed = true; }
      for (const k of st.colors) if (!st.seen.includes('c:' + k)) { st.seen.push('c:' + k); changed = true; }
      if (changed) {
        P.saveSoon();
        for (const key of TABS) this.tabBtns[key].querySelectorAll('.vp-dot').forEach((d) => d.remove());
      }
    }, 1500);
  }

  // ---------- 통계 ----------

  render_stats(b) {
    const P = this.plugin;
    const g = P.growth;
    const days = P.ledger.daily(14);
    const max = Math.max(1, ...days.map((d) => d.c));
    const wd = LANG === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    b.createEl('h3', { text: t('chart14') });
    const chart = b.createDiv({ cls: 'vp-panel' }).createDiv({ cls: 'vp-chart' });
    days.forEach((d, i) => {
      const dt = new Date(d.day + 'T00:00:00');
      const col = chart.createDiv({ cls: 'vp-col' });
      col.setAttr('title', t('chartTip', { day: d.day, c: fmt(d.c), l: d.l, n: d.n }));
      // 좁은 사이드바에서 숫자가 겹치지 않게 오늘과 최고 기록에만 숫자를 단다
      const label = d.c && (i === days.length - 1 || d.c === max);
      col.createSpan({ cls: 'vp-n', text: label ? compact(d.c) : '' });
      const bb = col.createDiv({ cls: 'vp-b' + (i === days.length - 1 ? ' is-today' : '') + (d.c ? '' : ' is-zero') });
      bb.style.height = `${(d.c / max) * 100}%`;
      const lab = col.createSpan({ cls: 'vp-lab', text: String(dt.getDate()) });
      lab.createEl('br');
      lab.appendText(wd[dt.getDay()]);
    });

    b.createEl('h3', { text: t('chartHours') });
    const hours = P.ledger.hours();
    const hmax = Math.max(1, ...hours);
    const hc = b.createDiv({ cls: 'vp-panel' }).createDiv({ cls: 'vp-chart is-hours' });
    hours.forEach((n, h) => {
      const col = hc.createDiv({ cls: 'vp-col' });
      col.setAttr('title', t('hourTip', { h }));
      const bb = col.createDiv({ cls: 'vp-b' + (n ? '' : ' is-zero') });
      bb.style.height = `${(n / hmax) * 100}%`;
      col.createSpan({ cls: 'vp-lab', text: h % 6 === 0 ? String(h) : '' });
    });

    const table = (parent, rows) => {
      const tb = parent.createEl('table', { cls: 'vp-table' });
      for (const [k, v, strong] of rows) {
        const tr2 = tb.createEl('tr');
        tr2.createEl('td', { text: k }).toggleClass('vp-strong', !!strong);
        tr2.createEl('td', { text: v });
      }
    };
    const all = P.ledger.totals();
    b.createEl('h3', { text: t('totalsTitle') });
    table(b.createDiv({ cls: 'vp-panel' }), [
      [t('totChars'), fmt(all.c)],
      [t('totLinks'), fmt(all.l)],
      [t('totNotes'), fmt(all.n)],
      [t('totPokes'), fmt(P.st.pokes)],
    ]);

    b.createEl('h3', { text: t('xpTitle') });
    const xpPanel = b.createDiv({ cls: 'vp-panel' });
    const rows = [[t('xpWriting'), fmt(g ? g.usageXp : 0)], [t('xpBonus'), fmt(g ? g.bonusXp : 0)]];
    if (g && g.startXp) rows.push([t('xpStart'), fmt(g.startXp)]);
    if (g && g.frozenXp) rows.push([t('xpFrozen'), fmt(g.frozenXp)]);
    rows.push([t('xpTotal'), fmt(g ? g.xp : 0), true]);
    table(xpPanel, rows);
    xpPanel.createDiv({ cls: 'vp-muted vp-tiny vp-gap', text: t('xpFormula', { c: CHARS_PER_XP, l: XP_PER_LINK, n: XP_PER_NOTE, cap: fmt(LIVE_CHAR_CAP) }) });

    b.createEl('h3', { text: t('hubsTitle') });
    const hubs = b.createDiv({ cls: 'vp-panel' });
    const top = P.linkStats(true).top;
    if (!top.length) hubs.createDiv({ cls: 'vp-muted vp-center', text: t('hubsEmpty') });
    else {
      const ul = hubs.createEl('ul', { cls: 'vp-feed' });
      for (const h of top) {
        const li2 = ul.createEl('li');
        const a = li2.createEl('a', { cls: 'vp-link', text: h.path.replace(/\.md$/, '').split('/').pop() });
        a.setAttr('title', h.path);
        a.addEventListener('click', (e) => {
          e.preventDefault();
          this.app.workspace.openLinkText(h.path, '', false);
        });
        li2.createSpan({ cls: 'vp-plus', text: t('backlinks', { n: h.n }) });
      }
    }
  }
}

/* ────────────────────────────── 노트 속 펫 카드 ────────────────────────────── */
// ```vault-pet``` 코드 블록 자리에 살아 있는 펫 카드를 그린다.

class PetCard extends MarkdownRenderChild {
  constructor(el, plugin) {
    super(el);
    this.plugin = plugin;
  }

  onload() {
    const P = this.plugin;
    P.cards.add(this);
    const root = (this.root = this.containerEl.createDiv({ cls: 'vault-pet-card-block' }));
    P.addFontsTo(root.ownerDocument);
    this.stage = habitat(root, P.species, 'vp-card-stage');
    const cv = this.stage.createEl('canvas', { cls: 'vp-pixel' });
    this.r = new PetRenderer(cv);
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    cv.addEventListener('mousedown', stop);
    cv.addEventListener('click', (e) => {
      stop(e);
      P.poke();
      this.r.play('happy');
    });
    const info = root.createDiv({ cls: 'vp-card-info' });
    const row = info.createDiv({ cls: 'vp-row' });
    this.nameEl = row.createSpan({ cls: 'vp-name' });
    this.typeEl = row.createSpan();
    this.lvEl = row.createSpan({ cls: 'vp-lv' });
    this.stageEl = info.createDiv({ cls: 'vp-muted vp-small' });
    this.barEl = bar(info, 0, 'exp');
    this.todayEl = info.createDiv({ cls: 'vp-muted vp-small' });
    P.anim.add(this.r, { every: 90 });
    this.update();
  }

  onunload() {
    this.plugin.cards.delete(this);
    this.plugin.anim.remove(this.r);
  }

  update() {
    const P = this.plugin;
    const g = P.growth;
    const pet = P.pet;
    paintAccent(this.root, P.species, pet.color);
    this.stage.setAttr('data-species', P.species);
    this.r.setSpecies(P.species);
    this.r.setMood(P.brain.mood);
    this.r.setColor(pet.color);
    this.r.setAccessory(pet.accessory);
    this.nameEl.setText(pet.name);
    this.typeEl.empty();
    typeChip(this.typeEl, speciesOf(P.species));
    if (!g) {
      this.stageEl.setText(t('cardEggLoading'));
      return;
    }
    this.r.setStage(g.stageKey);
    this.r.setProgress(g.progress);
    this.lvEl.setText(`Lv.${g.level}`);
    this.stageEl.setText(`${t('mood_' + P.brain.mood)} · ${g.nextStageKey ? t('cardStage', { a: stageName(g.stageKey), b: stageName(g.nextStageKey), p: Math.floor(g.progress * 100) }) : t('cardGrown', { a: stageName(g.stageKey) })}`);
    this.barEl.firstElementChild.style.width = `${g.progress * 100}%`;
    const td = P.ledger.today();
    this.todayEl.setText(`${t('cardToday', { c: fmt(td.c), l: td.l, n: td.n })} · 🔥${P.game.streaks().current}`);
  }
}

/* ────────────────────────────── 첫 실행 안내 ────────────────────────────── */
// 처음: 인사 → 파트너 고르기 → 이름·시작 방식 → 준비 끝.
// 0.1.x 에서 올라온 사람(migrate): 파트너 고르기 → 이름 → 준비 끝. 지금까지의 성장은 고른 친구가 이어받는다.

class WelcomeModal extends Modal {
  constructor(plugin, opts = {}) {
    super(plugin.app);
    this.plugin = plugin;
    this.migrate = !!opts.migrate;
    this.steps = this.migrate ? ['pick', 'name', 'ready'] : ['intro', 'pick', 'name', 'ready'];
    this.step = 0;
    const pet = plugin.pet;
    this.choice = { species: plugin.species, name: pet.name, mode: pet.mode, stage: pet.startStage | 0 };
    // 이름을 직접 고친 적이 없으면 친구를 바꿀 때 이름도 따라 바뀐다
    this.nameTouched = !SPECIES.some((sp) => sp.name.includes(pet.name));
    this.minis = [];
  }

  onOpen() {
    this.plugin.modal = this;
    this.modalEl.addClass('vault-pet-modal');
    this.plugin.addFontsTo(this.containerEl.ownerDocument);
    this.render();
  }

  onClose() {
    this.plugin.modal = null;
    for (const m of this.minis) this.plugin.anim.remove(m);
    this.contentEl.empty();
    // 사용자가 도중에 닫으면 고른 데까지 저장하고 마친다. 플러그인이 꺼지면서 닫힐 때는 다음에 다시 보여준다
    if (!this.finished && !this.unloading) this.finish();
  }

  mini(parent, o) {
    const cv = parent.createEl('canvas', { cls: 'vp-pixel ' + (o.cls || 'vp-welcome-canvas') });
    const r = new PetRenderer(cv);
    r.setSpecies(o.species || this.choice.species);
    r.setStage(o.stage);
    r.setMood(o.mood || 'idle');
    r.setProgress(o.progress || 0);
    r.setColor(o.color || 'natural');
    r.setAccessory(o.acc || 'none');
    r.frame();
    this.minis.push(r);
    this.plugin.anim.add(r, { every: 80 });
    return r;
  }

  save() {
    const n = this.contentEl.querySelector('.vp-w-name');
    if (n && n.value.trim()) this.choice.name = n.value.trim().slice(0, 16);
    const m = this.contentEl.querySelector('input[name="vp-wmode"]:checked');
    if (m) this.choice.mode = m.value;
    const s = this.contentEl.querySelector('.vp-w-stage');
    if (s) this.choice.stage = Number(s.value);
  }

  pick(key) {
    if (this.choice.species === key) return;
    this.choice.species = key;
    if (!this.nameTouched) this.choice.name = tr(speciesOf(key).name);
    this.plugin.sound('cry_' + key, 0.04);
    this.render();
    const r = this.cards && this.cards[key];
    if (r) r.play('happy');
  }

  render() {
    for (const m of this.minis) this.plugin.anim.remove(m);
    this.minis = [];
    this.cards = {};
    this.infoEl = null;
    const el = this.contentEl;
    el.empty();
    el.addClass('vault-pet-house');
    paintAccent(el, this.choice.species, 'natural');
    const dots = el.createDiv({ cls: 'vp-steps' });
    for (let i = 0; i < this.steps.length; i++) dots.createEl('i', { cls: i <= this.step ? 'is-on' : '' });
    const kind = this.steps[this.step];
    const sp = speciesOf(this.choice.species);

    if (kind === 'intro') {
      const eggs = el.createDiv({ cls: 'vp-w-eggs' });
      for (const s of SPECIES) this.mini(eggs, { species: s.key, stage: 'egg', progress: 0.6, mood: 'active', cls: 'vp-w-egg' });
      el.createEl('h2', { text: t('w0Title') });
      rich(el.createEl('p'), t('w0Body'));
      const ul = el.createEl('ul');
      for (const k of ['w0b1', 'w0b2', 'w0b3']) rich(ul.createEl('li'), t(k));
    } else if (kind === 'pick') {
      if (this.migrate) {
        el.createEl('h2', { text: t('wMigrateTitle') });
        el.createDiv({ cls: 'vp-muted vp-small vp-center vp-gapb', text: t('wMigrateBody') });
      } else {
        el.createEl('h2', { text: t('wPickTitle') });
        el.createDiv({ cls: 'vp-muted vp-small vp-center vp-gapb', text: t('wPickSub') });
      }
      const grid = el.createDiv({ cls: 'vp-pick', attr: { role: 'radiogroup', 'aria-label': t('wPickTitle') } });
      SPECIES.forEach((s, i) => {
        const on = s.key === this.choice.species;
        const card = grid.createEl('button', { cls: 'vp-pick-card' + (on ? ' is-selected' : ''), attr: { role: 'radio', 'aria-checked': String(on), 'aria-label': `${tr(s.name)} · ${tr(s.kind)}` } });
        card.style.setProperty('--vp-type', s.typeColor);
        const stage = habitat(card, s.key, 'vp-pick-stage');
        this.cards[s.key] = this.mini(stage, { species: s.key, stage: 'child', mood: on ? 'active' : 'idle', cls: 'vp-pick-canvas' });
        card.createDiv({ cls: 'vp-pick-name', text: tr(s.name) });
        typeChip(card, s);
        card.addEventListener('click', () => this.pick(s.key));
        card.addEventListener('keydown', (e) => {
          const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          const next = SPECIES[(i + d + SPECIES.length) % SPECIES.length].key;
          this.pick(next);
          const btn = this.contentEl.querySelectorAll('.vp-pick-card')[SPECIES.findIndex((x) => x.key === next)];
          if (btn) btn.focus();
        });
        if (on) window.setTimeout(() => card.isConnected && card.focus(), 0);
      });

      // 고른 친구 소개
      const d = el.createDiv({ cls: 'vp-panel vp-pick-detail' });
      d.style.setProperty('--vp-type', sp.typeColor);
      const head = d.createDiv({ cls: 'vp-about-head' });
      head.createSpan({ cls: 'vp-strong', text: `${tr(sp.name)} · ${tr(sp.kind)}` });
      typeChip(head, sp);
      d.createDiv({ cls: 'vp-muted vp-small', text: tr(sp.dex) });
      const facts = d.createDiv({ cls: 'vp-facts' });
      for (const [k, v] of [[t('traitLabel'), tr(sp.trait)], [t('likesLabel'), tr(sp.likes)], [t('perkLabel'), perkText(sp)]]) {
        const f = facts.createDiv();
        f.createSpan({ cls: 'vp-muted', text: k });
        f.createSpan({ text: v });
      }
      d.createDiv({ cls: 'vp-muted vp-tiny vp-gap', text: t('wEvolution') });
      const road = d.createDiv({ cls: 'vp-road vp-w-road' });
      STAGES.forEach((s, i) => {
        const step = road.createDiv({ cls: 'vp-step ' + (i < 2 ? 'is-done' : 'is-locked') });
        this.mini(step, { stage: s.key, progress: 0.3, cls: 'vp-road-canvas' });
        step.createDiv({ text: i < 2 ? stageName(s.key) : '???' });
      });
    } else if (kind === 'name') {
      el.createEl('h2', { text: this.migrate ? t('w1TitleName') : t('w1Title') });
      const f = el.createDiv({ cls: 'vp-field' });
      const who = f.createDiv({ cls: 'vp-field-who' });
      this.mini(who, { stage: 'baby', mood: 'active', cls: 'vp-field-canvas' });
      who.createSpan({ text: t('w1Name') });
      const input = f.createEl('input', { cls: 'vp-w-name', attr: { type: 'text', maxlength: '16' } });
      input.value = this.choice.name;
      input.addEventListener('input', () => (this.nameTouched = true));
      window.setTimeout(() => input.isConnected && input.focus(), 0);
      if (!this.migrate) {
        this.infoEl = el.createDiv({ cls: 'vp-muted vp-small vp-gapb' });
        this.updateInfo();
        const radio = (value, title, sub, extra) => {
          const lab = el.createEl('label', { cls: 'vp-radio' });
          const r = lab.createEl('input', { attr: { type: 'radio', name: 'vp-wmode', value } });
          r.checked = this.choice.mode === value;
          lab.toggleClass('is-checked', r.checked);
          // 고른 항목 강조. CSS :has() 는 느려서 클래스로 한다
          r.addEventListener('change', () => {
            el.querySelectorAll('.vp-radio').forEach((x) => x.toggleClass('is-checked', x.contains(r)));
          });
          lab.appendText(' ' + title + ' ');
          if (extra) extra(lab);
          lab.createEl('small', { text: sub });
        };
        radio('all', t('modeAll'), t('modeAllSub'));
        radio('fresh', t('modeFresh'), t('modeFreshSub'));
        radio('stage', t('modeStage'), t('modeStageSub'), (lab) => {
          const sel = lab.createEl('select', { cls: 'vp-w-stage dropdown' });
          STAGES.forEach((s, i) => {
            const o = sel.createEl('option', { text: stageName(s.key), attr: { value: String(i) } });
            if (i === this.choice.stage) o.selected = true;
          });
        });
        el.createDiv({ cls: 'vp-muted vp-tiny', text: t('w1Later') });
      }
    } else {
      const g = this.plugin.growth;
      const stage = habitat(el, this.choice.species, 'vp-w-ready');
      this.mini(stage, { stage: g ? g.stageKey : 'baby', mood: 'active', acc: this.plugin.pet.accessory, color: this.plugin.pet.color });
      el.createEl('h2', { text: t('w2Title') });
      const ul = el.createEl('ul');
      for (const k of ['w2b1', 'w2b2', 'w2b5', 'w2b3', 'w2b4']) rich(ul.createEl('li'), t(k));
    }

    const nav = el.createDiv({ cls: 'vp-nav' });
    if (this.step > 0) {
      button(nav, t('wBack'), () => {
        this.save();
        this.step--;
        this.render();
      }, 'is-ghost');
    } else nav.createSpan();
    const last = this.step === this.steps.length - 1;
    const label = last ? t('wStart') : kind === 'pick' ? t('wPickGo', { name: tr(sp.name), ro: josaRo(tr(sp.name)) }) : t('wNext');
    button(nav, label, async () => {
      this.save();
      if (!last) {
        this.step++;
        this.render();
        return;
      }
      this.finished = true;
      this.close();
      await this.finish();
    }, 'mod-cta');
  }

  // 이름 단계에서 지금까지의 노트로 계산한 레벨을 보여준다
  updateInfo() {
    if (!this.infoEl) return;
    const P = this.plugin;
    this.infoEl.empty();
    if (P.loading != null || !P.st.scanned) {
      this.infoEl.setText(t('w1Reading', { p: Math.round((P.loading || 0) * 100) }));
      return;
    }
    const g = computeGrowth({ base: null, since: 0 }, this.choice.species, P.ledger.totals(), (s) => P.game.bonusXp(s));
    const stage = stageName(g.stageKey);
    rich(this.infoEl, t('w1Result', { lv: g.level, stage, ieyo: josa(stage, '이에요', '예요') }));
  }

  async finish() {
    this.finished = true;
    const P = this.plugin;
    const c = this.choice;
    if (c.species !== P.species) P.choosePartner(c.species);
    const pet = P.pet;
    if (c.name) pet.name = c.name;
    P.st.onboarded = true;
    P.st.picked = true;
    if (!this.migrate && (c.mode !== pet.mode || (c.mode === 'stage' && c.stage !== pet.startStage))) await P.restartGrowth(c.mode, c.stage, true);
    await P.saveNow();
    P.updateUI();
    window.setTimeout(() => {
      P.widget.action('wave');
      P.sound('cry_' + P.species, 0.04);
      P.bubble(tl('hello', { name: P.pet.name }), 'hello');
    }, 2600);
  }
}

// 하우스에서 이름을 눌러 바로 바꾼다
class RenameModal extends Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    const P = this.plugin;
    this.modalEl.addClass('vault-pet-modal');
    this.contentEl.addClass('vault-pet-house');
    this.contentEl.createEl('h2', { text: t('w1TitleName') });
    const input = this.contentEl.createEl('input', { cls: 'vp-w-name vp-rename', attr: { type: 'text', maxlength: '16' } });
    input.value = P.pet.name;
    const ok = () => {
      const v = input.value.trim().slice(0, 16);
      if (v) {
        P.pet.name = v;
        P.saveSoon();
        P.updateUI();
      }
      this.close();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ok();
    });
    const nav = this.contentEl.createDiv({ cls: 'modal-button-container' });
    nav.createEl('button', { text: t('confirm'), cls: 'mod-cta' }).addEventListener('click', ok);
    nav.createEl('button', { text: t('cancel') }).addEventListener('click', () => this.close());
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ConfirmModal extends Modal {
  constructor(app, text, onOk, danger) {
    super(app);
    this.text = text;
    this.onOk = onOk;
    this.danger = danger;
  }

  onOpen() {
    this.contentEl.createEl('p', { text: this.text });
    const nav = this.contentEl.createDiv({ cls: 'modal-button-container' });
    const ok = nav.createEl('button', { text: t('confirm'), cls: this.danger ? 'mod-warning' : 'mod-cta' });
    ok.addEventListener('click', () => {
      this.close();
      this.onOk();
    });
    nav.createEl('button', { text: t('cancel') }).addEventListener('click', () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ────────────────────────────── 설정 탭 ────────────────────────────── */

class PetSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const P = this.plugin;
    const s = P.settings;
    const el = this.containerEl;
    el.empty();
    el.addClass('vault-pet-settings');
    const save = () => {
      P.saveSoon();
      P.updateUI();
    };
    const num = (setting, key, min, max) =>
      setting.addText((tx) => {
        tx.inputEl.type = 'number';
        tx.inputEl.min = String(min);
        tx.inputEl.max = String(max);
        tx.setValue(String(s[key])).onChange((v) => {
          const n = Number(v);
          if (!Number.isFinite(n) || n < min || n > max) return;
          s[key] = Math.round(n);
          save();
        });
      });
    const time = (setting, key, onKey) => {
      setting.addText((tx) => {
        tx.inputEl.type = 'time';
        tx.setValue(s[key]).onChange((v) => {
          if (!/^\d{1,2}:\d{2}$/.test(v)) return;
          s[key] = v;
          save();
        });
      });
      setting.addToggle((tg) => tg.setValue(s[onKey]).onChange((v) => {
        s[onKey] = v;
        save();
      }));
    };

    const sp = speciesOf(P.species);
    new Setting(el).setName(t('sCharacter')).setHeading();
    new Setting(el)
      .setName(`${t('sPartner')}: ${P.pet.name}`)
      .setDesc(t('sPartnerDesc', { icon: sp.icon, kind: tr(sp.kind), perk: perkText(sp) }))
      .addButton((b) => b.setButtonText(t('sPartnerBtn')).onClick(() => P.openHouse('dex')));
    new Setting(el).setName(t('sName')).setDesc(t('sNameDesc')).addText((tx) => tx.setValue(P.pet.name).onChange((v) => {
      if (!v.trim()) return;
      P.pet.name = v.trim().slice(0, 16);
      save();
    }));
    new Setting(el).setName(t('sLanguage')).setDesc(t('sLanguageDesc')).addDropdown((d) => d
      .addOption('auto', t('sAuto'))
      .addOption('ko', '한국어')
      .addOption('en', 'English')
      .setValue(s.language)
      .onChange((v) => {
        s.language = v;
        LANG = detectLang(v);
        save();
        P.relabel();
        this.display();
      }));
    new Setting(el).setName(t('sShow')).setDesc(t('sShowDesc')).addToggle((tg) => tg.setValue(s.showWidget).onChange((v) => P.setWidgetVisible(v)));
    new Setting(el).setName(t('sRoam')).setDesc(t('sRoamDesc')).addToggle((tg) => tg.setValue(s.roam).onChange((v) => P.toggleRoam(v, true)));
    new Setting(el).setName(t('sScale')).setDesc(t('sScaleDesc')).addSlider((sl) => sl
      .setLimits(1, 5, 1)
      .setValue(s.scale)
      .setDynamicTooltip()
      .onChange((v) => {
        s.scale = v;
        P.widget.applyScale();
        save();
      }));
    new Setting(el).setName(t('sStatus')).addToggle((tg) => tg.setValue(s.showStatusBar).onChange((v) => {
      s.showStatusBar = v;
      save();
    }));
    new Setting(el).setName(t('sFont')).setDesc(t('sFontDesc')).addToggle((tg) => tg.setValue(s.pixelFont).onChange(async (v) => {
      s.pixelFont = v;
      save();
      await P.loadFonts();
    }));
    new Setting(el).setName(t('sBubbles')).setDesc(t('sBubblesDesc')).addToggle((tg) => tg.setValue(s.bubblesEnabled).onChange((v) => {
      s.bubblesEnabled = v;
      save();
    }));
    new Setting(el).setName(t('sChatter')).setDesc(t('sChatterDesc')).addToggle((tg) => tg.setValue(s.chatter).onChange((v) => {
      s.chatter = v;
      save();
    }));
    new Setting(el).setName(t('sSound')).setDesc(t('sSoundDesc')).addToggle((tg) => tg.setValue(s.soundEnabled).onChange((v) => {
      s.soundEnabled = v;
      save();
      if (v) PetSound.play('quest');
    }));

    new Setting(el).setName(t('sLife')).setHeading();
    time(new Setting(el).setName(t('sLunch')), 'lunchTime', 'lunchEnabled');
    time(new Setting(el).setName(t('sDinner')), 'dinnerTime', 'dinnerEnabled');
    num(new Setting(el).setName(t('sRest')).setDesc(t('sRestDesc')), 'restAfterMin', 15, 600);
    num(new Setting(el).setName(t('sSleepy')).setDesc(t('sSleepyDesc')), 'sleepyAfterMin', 5, 600);
    num(new Setting(el).setName(t('sSleep')), 'sleepAfterMin', 10, 1440);
    new Setting(el).setName(t('sLate')).setDesc(t('sLateDesc')).addToggle((tg) => tg.setValue(s.lateNightEnabled).onChange((v) => {
      s.lateNightEnabled = v;
      save();
    }));

    new Setting(el).setName(t('sGrowth')).setHeading();
    let mode = P.pet.mode;
    let stage = P.pet.startStage | 0;
    const modeSetting = new Setting(el).setName(t('sMode')).setDesc(t('sModeDesc'));
    modeSetting.addDropdown((d) => d
      .addOption('all', t('modeAll'))
      .addOption('fresh', t('modeFresh'))
      .addOption('stage', t('modeStage'))
      .setValue(mode)
      .onChange((v) => {
        mode = v;
        stageSetting.settingEl.toggle(v === 'stage');
      }));
    const stageSetting = new Setting(el).setName(t('sStartStage')).addDropdown((d) => {
      STAGES.forEach((st, i) => d.addOption(String(i), stageName(st.key)));
      d.setValue(String(stage)).onChange((v) => (stage = Number(v)));
    });
    stageSetting.settingEl.toggle(mode === 'stage');
    modeSetting.addButton((b) => b.setButtonText(t('sRestart')).setCta().onClick(() => {
      const label = mode === 'all' ? t('sRestartAll') : mode === 'fresh' ? t('sRestartFresh') : t('sRestartStage', { stage: stageName(STAGES[stage].key) });
      const name = P.pet.name;
      new ConfirmModal(this.app, t('sRestartConfirm', { name, eul: josa(name, '을', '를'), label }), async () => {
        await P.restartGrowth(mode, stage);
        new Notice(t('sRestarted'));
      }).open();
    }));
    const formula = el.createDiv({ cls: 'setting-item-description vp-setting-note' });
    formula.setText(t('xpFormula', { c: CHARS_PER_XP, l: XP_PER_LINK, n: XP_PER_NOTE, cap: fmt(LIVE_CHAR_CAP) }));

    new Setting(el).setName(t('sExclude')).setDesc(t('sExcludeDesc')).addTextArea((ta) => {
      ta.setPlaceholder('Templates');
      ta.setValue((s.excludedFolders || []).join('\n'));
      ta.inputEl.rows = 4;
      ta.onChange((v) => {
        s.excludedFolders = v.split('\n').map((x) => normalizePath(x.trim()).replace(/\/+$/, '')).filter((x) => x && x !== '/');
        save();
      });
    });

    new Setting(el).setName(t('sOther')).setHeading();
    new Setting(el).setName(t('sWelcome')).addButton((b) => b.setButtonText(t('sOpen')).onClick(() => new WelcomeModal(P).open()));
    new Setting(el).setName(t('sPosition')).addButton((b) => b.setButtonText(t('sReset')).onClick(() => P.resetPosition()));
    new Setting(el).setName(t('sRecount')).setDesc(t('sRecountDesc')).addButton((b) => b.setButtonText(t('sRecount')).onClick(() => {
      new ConfirmModal(this.app, t('sRecountConfirm'), async () => {
        await P.recount();
        new Notice(t('sRecountDone'));
      }).open();
    }));
    new Setting(el).setName(t('sWipe')).setDesc(t('sWipeDesc')).addButton((b) => b.setButtonText(t('sWipe')).setWarning().onClick(() => {
      new ConfirmModal(this.app, t('sWipeConfirm'), async () => {
        await P.wipe();
        new Notice(t('sWipeDone'));
        this.display();
      }, true).open();
    }));
    el.createDiv({ cls: 'setting-item-description vp-setting-note', text: t('sPrivacy') });
  }
}

/* ────────────────────────────── 플러그인 ────────────────────────────── */

// 파트너를 key 로 바꾼다. 지금 파트너는 모은 경험치(g.xp)를 frozen 에 얼려 두고 쉰다.
// 만난 적 있는 친구는 지금부터 다시 자라고, 처음 만나는 친구는 알부터 시작한다. 만난 적 있었는지를 돌려준다
function swapPartner(st, key, g, totals, now = Date.now()) {
  const cur = st.party[st.partner];
  Object.assign(cur, { frozen: g.xp, base: null, since: 0, startXp: 0, best: Math.max(cur.best || 0, g.stageIndex) });
  const known = !!st.party[key];
  if (known) Object.assign(st.party[key], { base: { ...totals }, since: now, startXp: 0 });
  else st.party[key] = newPet(key, { mode: 'fresh', base: { ...totals }, since: now });
  st.partner = key;
  st.lastLevel = null;
  return known;
}

// 친구 기록을 정리한다. 0.1.x 데이터(펫 하나, 설정에 이름·색깔·시작점)는 첫 친구 기록으로 옮긴다
function migrateParty(st, legacy = {}) {
  if (!st.party || typeof st.party !== 'object' || Array.isArray(st.party)) st.party = {};
  for (const [k, v] of Object.entries(st.party)) if (!SPECIES_BY[k] || !v || typeof v !== 'object') delete st.party[k];
  if (!st.partner || !st.party[st.partner]) {
    const key = SPECIES_BY[st.partner] ? st.partner : Object.keys(st.party)[0] || 'inky';
    if (!st.party[key]) {
      const mode = ['all', 'fresh', 'stage'].includes(legacy.startMode) ? legacy.startMode : 'all';
      const si = clampN(legacy.startStage | 0, 0, STAGES.length - 1);
      st.party[key] = newPet(key, {
        name: legacy.petName || tr(speciesOf(key).name),
        mode,
        startStage: si,
        base: mode === 'all' ? null : legacy.baseline || null,
        since: mode === 'all' ? 0 : legacy.baselineAt || 0,
        startXp: mode === 'stage' ? STAGES[si].min : 0,
        color: legacy.color && legacy.color !== 'violet' ? legacy.color : 'natural',
        accessory: legacy.accessory || 'none',
      });
    }
    st.partner = key;
  }
  for (const [k, pet] of Object.entries(st.party)) {
    const d = newPet(k);
    for (const f of Object.keys(d)) if (pet[f] === undefined) pet[f] = d[f];
    if (!VARIANTS[pet.color]) pet.color = 'natural';
    if (!ITEMS.some((it) => it.key === pet.accessory)) pet.accessory = 'none';
  }
  // 0.1.x 의 기본 몸 색 violet 은 이제 잉키의 타고난 색이다
  const colors = (Array.isArray(st.colors) ? st.colors : []).map((c) => (c === 'violet' ? 'natural' : c)).filter((c) => VARIANTS[c]);
  st.colors = [...new Set(['natural', ...colors])];
}

class VaultPetPlugin extends obsidian.Plugin {
  async onload() {
    const raw = (await this.loadData()) || {};
    const legacy = raw.settings || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, legacy);
    for (const k of LEGACY_PET_KEYS) delete this.settings[k];
    LANG = detectLang(this.settings.language);
    this.st = Object.assign(clone(DEFAULT_STATE), raw.state || {});
    migrateParty(this.st, legacy);
    CUR = this.st.partner;
    this.ledger = new Ledger(raw.ledger);
    this.growth = null;
    this.loading = null;
    this.pending = new Set();
    this.cards = new Set();
    this.modal = null;
    this.fonts = [];
    this.fontSources = [];
    this.fontDocs = new Set();
    this.anim = new Animator();

    this.brain = new Brain(() => this.settings, () => this.ledger.today());
    this.brain.daily = this.st.brainDaily || {};
    this.game = new Gamify(this.st, this.ledger, () => this.settings, () => this.saveSoon(), () => ({ maxBacklinks: this.linkStats().max }));
    // 지난번 모습으로 바로 보이게. 정확한 값은 볼트를 다시 확인한 뒤 refresh() 가 채운다
    if (this.st.scanned) this.growth = this.growthNow();
    this.widget = new PetWidget(this);
    this.wireBrain();
    this.wireGame();

    addIcon(ICON, ICON_SVG);
    this.registerView(VIEW_TYPE, (leaf) => new HouseView(leaf, this));
    this.ribbon = this.addRibbonIcon(ICON, t('openHouse'), () => this.openHouse());
    this.addCommands();
    this.addSettingTab(new PetSettingTab(this.app, this));
    this.registerMarkdownCodeBlockProcessor('vault-pet', (_src, el, ctx) => ctx.addChild(new PetCard(el, this)));

    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass('vault-pet-status');
    this.statusEl.addEventListener('click', () => this.openHouse());

    this.loadFonts();
    this.app.workspace.onLayoutReady(() => this.start());
  }

  onunload() {
    window.clearTimeout(this.saveTimer);
    window.clearTimeout(this.flushTimer);
    if (this.dirty) this.saveNow();
    if (this.modal) {
      this.modal.unloading = true;
      this.modal.close();
    }
    this.widget.unmount();
    this.anim.stop();
    this.unloadFonts();
    PetSound.close();
  }

  addCommands() {
    this.addCommand({ id: 'open-house', name: t('cmdOpen'), callback: () => this.openHouse() });
    this.addCommand({ id: 'toggle-pet', name: t('cmdToggle'), callback: () => this.setWidgetVisible(!this.settings.showWidget) });
    this.addCommand({ id: 'pet-the-pet', name: t('cmdPoke'), callback: () => this.poke() });
    this.addCommand({ id: 'toggle-quiet', name: t('cmdQuiet'), callback: () => this.toggleQuiet() });
    this.addCommand({ id: 'reset-position', name: t('cmdPosition'), callback: () => this.resetPosition() });
    this.addCommand({ id: 'open-dex', name: t('cmdDex'), callback: () => this.openHouse('dex') });
    this.addCommand({ id: 'toggle-roam', name: t('cmdRoam'), callback: () => this.toggleRoam() });
    this.addCommand({
      id: 'insert-card',
      name: t('cmdCard'),
      editorCallback: (editor) => editor.replaceSelection('```vault-pet\n```\n'),
    });
  }

  async start() {
    this.started = true;
    const { vault, workspace } = this.app;
    if (this.settings.showWidget) this.widget.mount();

    this.registerEvent(vault.on('modify', (f) => this.queue(f)));
    this.registerEvent(vault.on('create', (f) => this.queue(f)));
    this.registerEvent(vault.on('delete', (f) => {
      if (f instanceof TFolder) {
        const pre = f.path + '/';
        for (const p of Object.keys(this.ledger.d.files)) if (p.startsWith(pre)) this.ledger.remove(p);
      } else this.ledger.remove(f.path);
      this.saveSoon();
    }));
    this.registerEvent(vault.on('rename', (f, old) => {
      this.ledger.rename(old, f.path);
      this.saveSoon();
    }));
    // 열린 노트가 밖에서 바뀌어도 editor-change 가 온다. 편집기에 포커스가 있을 때만 타이핑으로 본다
    this.registerEvent(workspace.on('editor-change', (editor) => {
      if (editor && typeof editor.hasFocus === 'function' && !editor.hasFocus()) return;
      this.onType();
    }));
    this.registerEvent(workspace.on('file-open', (f) => f && this.onOpen(f)));
    // 옮긴 적이 없으면 사이드바를 열고 닫을 때마다 편집 영역 구석을 따라간다
    const follow = () => {
      if (!this.settings.widgetPos) this.widget.curPos = null;
      this.widget.clamp();
    };
    this.registerDomEvent(window, 'resize', follow);
    this.registerEvent(workspace.on('layout-change', follow));
    this.registerEvent(workspace.on('resize', follow));
    this.registerInterval(window.setInterval(() => this.brain.tick(), 5000));
    this.registerInterval(window.setInterval(() => this.minuteTick(), MIN));

    this.brain.activity('open');
    this.brain.tick();
    if (!this.st.onboarded) new WelcomeModal(this).open();
    else if (!this.st.picked) new WelcomeModal(this, { migrate: true }).open();
    this.scanPromise = this.scan();
    await this.scanPromise;
    this.refresh();
    this.minuteTick();
  }

  // 지금 파트너
  get species() {
    return this.st.partner;
  }

  get pet() {
    return this.st.party[this.st.partner];
  }

  growthNow() {
    return computeGrowth(this.pet, this.species, this.ledger.totals(), (since) => this.game.bonusXp(since));
  }

  // 열려 있는 펫 하우스들. 참조를 들고 있지 않고 그때그때 찾는다
  views() {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view).filter((v) => v instanceof HouseView && v.body);
  }

  isExcluded(path) {
    return (this.settings.excludedFolders || []).some((f) => path === f || path.startsWith(f + '/'));
  }

  // 처음 켰을 때는 볼트 전체를 읽어 노트 만든 날짜로 기록을 채운다.
  // 그다음부터는 옵시디언이 꺼져 있던 동안 바뀐 파일만 다시 읽는다.
  async scan() {
    const { vault } = this.app;
    const L = this.ledger;
    const files = vault.getMarkdownFiles().filter((f) => !this.isExcluded(f.path));
    if (!this.st.scanned) {
      this.setLoading(0);
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        try {
          const m = measure(await vault.cachedRead(f));
          L.observe(f.path, m, new Date(f.stat.ctime || f.stat.mtime || Date.now()), { mtime: f.stat.mtime });
        } catch {
          // 못 읽는 파일은 건너뛴다
        }
        if (i % 40 === 39) {
          this.setLoading((i + 1) / files.length);
          await new Promise((r) => window.setTimeout(r, 0));
        }
      }
      this.st.scanned = true;
    } else {
      const budget = { ...OFFLINE_BUDGET };
      for (const p of Object.keys(L.d.files)) if (!vault.getAbstractFileByPath(p)) L.remove(p);
      for (const f of files) {
        const seen = L.mtimeOf(f.path);
        if (seen !== null && seen >= f.stat.mtime) continue;
        try {
          const m = measure(await vault.cachedRead(f));
          L.observe(f.path, m, new Date(f.stat.mtime), { mtime: f.stat.mtime, cap: LIVE_CHAR_CAP, linkCap: LIVE_LINK_CAP, budget });
        } catch {
          // 다음 기회에
        }
      }
    }
    this.setLoading(null);
    this.saveSoon();
  }

  setLoading(p) {
    this.loading = p;
    this.widget.setLoading(p);
    if (this.modal) this.modal.updateInfo();
    for (const v of this.views()) v.update(false);
  }

  queue(f) {
    if (!(f instanceof TFile) || f.extension !== 'md' || this.isExcluded(f.path)) return;
    this.pending.add(f.path);
    window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => this.flush(), 1500);
  }

  async flush() {
    if (this.scanPromise) await this.scanPromise;
    const paths = [...this.pending];
    this.pending.clear();
    const sum = { dc: 0, dl: 0, dn: 0 };
    const budget = { ...FLUSH_BUDGET };
    for (const path of paths) {
      const f = this.app.vault.getAbstractFileByPath(path);
      if (!(f instanceof TFile)) continue;
      let text;
      try {
        text = await this.app.vault.cachedRead(f);
      } catch {
        continue;
      }
      const r = this.ledger.observe(path, measure(text), new Date(), { mtime: f.stat.mtime, cap: LIVE_CHAR_CAP, linkCap: LIVE_LINK_CAP, budget });
      sum.dc += r.dc;
      sum.dl += r.dl;
      sum.dn += r.dn;
    }
    this.saveSoon();
    if (!sum.dc && !sum.dl && !sum.dn) return;
    const before = this.growth ? this.growth.xp : null;
    if (sum.dl) this.sound('link');
    this.brain.wrote(sum, this.ledger.today().c);
    this.refresh();
    if (before !== null && this.growth && this.growth.xp > before) this.widget.floatXp(this.growth.xp - before);
  }

  onType() {
    const now = Date.now();
    if (now - (this.lastType || 0) < 1000) return;
    this.lastType = now;
    this.brain.activity('type', now);
  }

  onOpen(f) {
    this.brain.activity('open');
    if (f.extension !== 'md') return;
    this.game.noteOpen(f.path);
    this.ledger.open();
    window.clearTimeout(this.openTimer);
    this.openTimer = window.setTimeout(() => this.refresh(), 800);
  }

  minuteTick() {
    if (this.loading != null) return;
    this.game.tick(this.brain.lastActivity, this.brain.streakMs());
    this.refresh();
  }

  // 백링크가 가장 많은 노트들. 2분 동안 기억한다
  linkStats(fresh) {
    const now = Date.now();
    if (!fresh && this._links && now - this._links.at < 2 * MIN) return this._links;
    const counts = {};
    const resolved = this.app.metadataCache.resolvedLinks || {};
    for (const [src, targets] of Object.entries(resolved)) {
      for (const dst of Object.keys(targets)) if (dst !== src) counts[dst] = (counts[dst] || 0) + 1;
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, n]) => ({ path, n }));
    this._links = { at: now, max: top.length ? top[0].n : 0, top };
    return this._links;
  }

  refresh() {
    if (this.loading != null || !this.st.scanned) return;
    const silent = !this.st.initialized;
    const pet = this.pet;
    let g = this.growthNow();
    // 업적 보너스로 레벨이 오르면 레벨 업적이 또 풀릴 수 있어서 몇 번 반복한다
    for (let i = 0; i < 4; i++) {
      pet.best = Math.max(pet.best || 0, g.stageIndex);
      this.game.evaluate(g, silent);
      const next = this.growthNow();
      if (next.xp === g.xp) break;
      g = next;
    }
    pet.best = Math.max(pet.best || 0, g.stageIndex);
    if (silent) this.game.finishInit();
    this.growth = g;

    const { lastLevel, lastStage } = this.st;
    if (lastLevel !== null && lastLevel !== undefined) {
      const name = pet.name;
      if (g.stageIndex > lastStage) {
        this.widget.action('evolve');
        this.sound('evolve');
        this.bubble(t('evolving', { name }), 'grow');
        const stage = stageName(g.stageKey);
        window.setTimeout(() => this.bubble(t('grew', { name, i: josa(name, '이', '가'), stage, ro: josaRo(stage) }), 'grow'), 3200);
      } else if (g.level > lastLevel) {
        this.widget.action('levelup');
        this.sound('levelup');
        this.bubble(t('levelUp', { n: g.level }), 'grow');
      }
    }
    this.st.lastLevel = g.level;
    this.st.lastStage = g.stageIndex;
    this.saveSoon();
    this.updateUI();
  }

  updateUI() {
    this.widget.update();
    this.updateStatus();
    for (const v of this.views()) v.update(false);
    for (const c of this.cards) c.update();
  }

  updateStatus() {
    const el = this.statusEl;
    if (!el) return;
    const g = this.growth;
    el.toggle(!!this.settings.showStatusBar);
    if (!g) {
      el.setText('🥚 …');
      return;
    }
    const pct = Math.floor(((g.xp - g.levelFloor) / (g.levelCeil - g.levelFloor)) * 100);
    const icon = this.brain.mood === 'sleeping' ? '💤' : g.stageKey === 'egg' ? '🥚' : speciesOf(this.species).icon;
    el.setText(`${icon} Lv.${g.level} · ${pct}%`);
    el.setAttr('aria-label', t('statusTip', { name: this.pet.name, lv: g.level, stage: stageName(g.stageKey) }));
    el.setAttr('data-tooltip-position', 'top');
  }

  // 언어를 바꾸면 보이는 글자를 다시 쓴다
  relabel() {
    LANG = detectLang(this.settings.language);
    if (this.ribbon) this.ribbon.setAttr('aria-label', t('openHouse'));
    for (const v of this.views()) v.build();
    this.updateUI();
  }

  // ---------- 반응 ----------

  wireBrain() {
    this.brain.on('mood', () => {
      this.widget.update();
      this.updateStatus();
      for (const v of this.views()) v.update(false);
      for (const c of this.cards) c.update();
    });
    this.brain.on('action', (a) => this.widget.action(a));
    this.brain.on('bubble', (b) => this.bubble(b.text, b.kind));
  }

  wireGame() {
    const g = this.game;
    g.on('unlock', (e) => {
      if (e.type === 'achievement') {
        this.widget.action('achieve');
        this.sound('achieve');
        this.bubble(t('gotBadge', { name: tr(e.achievement.name), xp: e.achievement.xp }), 'achieve', 'achievements');
      } else if (e.type === 'quest') {
        this.widget.action('happy');
        this.sound('quest');
        this.bubble(t('questDone', { text: e.quest.text, xp: e.quest.xp }), 'quest', 'quests');
      } else if (e.type === 'allclear') {
        this.widget.action('levelup');
        this.sound('achieve');
        this.bubble(t('allClear', { xp: e.xp }), 'quest', 'quests');
      } else if (e.type === 'item') {
        this.widget.action('wave');
        this.bubble(t('newItem', { icon: e.item.icon, name: tr(e.item.name) }), 'item', 'wardrobe');
      } else if (e.type === 'color') {
        this.widget.action('wave');
        this.bubble(t('newColor', { name: tr(e.color.name) }), 'color', 'wardrobe');
      }
    });
    g.on('retro', (events) => {
      const n = events.filter((e) => e.type === 'achievement').length;
      if (!n) return;
      window.setTimeout(() => {
        this.widget.action('achieve');
        this.bubble(t('retro', { n }), 'retro', 'achievements');
      }, 6000);
    });
    g.on('attend', ({ streak, xp }) => {
      this.widget.action('wave');
      this.bubble(streak > 1 ? t('attendStreak', { n: streak, xp }) : t('attendFirst', { xp }), 'attend');
    });
    g.on('rested', (kind) => this.bubble(kind === 'meal' ? t('restedMeal') : t('restedRest'), 'rested'));
  }

  bubble(text, kind, link) {
    if (!this.settings.bubblesEnabled && !REWARD_KINDS.has(kind)) return;
    if (this.isQuiet()) return;
    const g = this.growth;
    if (g && g.stageKey === 'egg' && !EGG_OK.has(kind)) {
      text = kind === 'lunch' || kind === 'dinner' ? tl('eggHungry') : kind === 'rest' || kind === 'late' ? tl('eggRoll') : tl('egg');
    }
    this.widget.say({ text, kind, link });
    if (kind === 'lunch' || kind === 'dinner' || kind === 'rest') this.game.noteBubble(kind);
    this.st.brainDaily = this.brain.daily;
    this.saveSoon();
  }

  sound(name, volume) {
    if (this.settings.soundEnabled && !this.isQuiet()) PetSound.play(name, volume);
  }

  // ---------- 조작 ----------

  poke() {
    this.game.poke();
    this.widget.action('happy');
    this.brain.activity('open');
    if (Math.random() < 0.4) this.sound('cry_' + this.species, 0.03);
    if (Math.random() < 0.35) this.bubble(tl('poke'), 'poke');
    this.refresh();
  }

  isQuiet() {
    return (this.st.quietUntil || 0) > Date.now();
  }

  toggleQuiet() {
    const on = !this.isQuiet();
    this.st.quietUntil = on ? Date.now() + 60 * MIN : 0;
    if (on) {
      this.widget.queue = [];
      this.widget.nextBubble();
    }
    new Notice(on ? t('quietToast') : t('unquietToast'));
    this.saveSoon();
    this.updateUI();
  }

  setWidgetVisible(show) {
    this.settings.showWidget = show;
    if (show) this.widget.mount();
    else {
      this.widget.unmount();
      new Notice(t('hiddenToast'));
    }
    this.saveSoon();
    this.updateUI();
  }

  // 산책 켜기/끄기. 끄면 지금 선 자리가 집이 된다
  toggleRoam(v = !this.settings.roam, quiet = false) {
    this.settings.roam = v;
    const w = this.widget;
    if (!v && w.el && w.curPos) {
      if (w.walk) w.stopWalk(performance.now(), false);
      if (w.dx) {
        this.settings.widgetPos = { ...w.curPos };
        w.dx = 0;
      }
    }
    if (!quiet) new Notice(v ? t('roamOnToast') : t('roamOffToast'));
    this.saveSoon();
    this.updateUI();
  }

  resetPosition() {
    this.settings.widgetPos = null;
    this.widget.dx = 0;
    this.widget.curPos = null;
    this.widget.applyPosition();
    this.saveSoon();
    if (this.settings.showWidget) new Notice(t('positionToast'));
  }

  petMenu(e) {
    const m = new Menu();
    m.addItem((i) => i.setTitle(t('menuPoke')).setIcon('heart').onClick(() => this.poke()));
    m.addItem((i) => i.setTitle(t('menuHouse')).setIcon(ICON).onClick(() => this.openHouse()));
    m.addItem((i) => i.setTitle(t('menuDex')).setIcon('book-open').onClick(() => this.openHouse('dex')));
    m.addSeparator();
    m.addItem((i) => i.setTitle(this.settings.roam ? t('menuRoamOff') : t('menuRoamOn')).setIcon(this.settings.roam ? 'map-pin' : 'footprints').onClick(() => this.toggleRoam()));
    m.addItem((i) => i.setTitle(this.isQuiet() ? t('menuQuietOff') : t('menuQuietOn')).setIcon(this.isQuiet() ? 'bell' : 'bell-off').onClick(() => this.toggleQuiet()));
    m.addItem((i) => i.setTitle(t('menuPosition')).setIcon('move').onClick(() => this.resetPosition()));
    m.addItem((i) => i.setTitle(t('menuHide')).setIcon('eye-off').onClick(() => this.setWidgetVisible(false)));
    m.showAtMouseEvent(e);
  }

  async openHouse(tab) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) || workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
    if (tab && leaf.view instanceof HouseView) leaf.view.setTab(tab);
  }

  // 처음 고를 때(첫 실행·업데이트): 지금까지의 기록을 고른 친구가 그대로 이어받는다
  choosePartner(key) {
    const st = this.st;
    if (!SPECIES_BY[key] || key === st.partner) return;
    const pet = st.party[st.partner];
    delete st.party[st.partner];
    if (SPECIES.some((sp) => sp.name.includes(pet.name))) pet.name = tr(speciesOf(key).name);
    pet.metAt = Date.now();
    st.party[key] = pet;
    st.partner = key;
    CUR = key;
    st.lastLevel = null;
    this.refresh();
    this.updateUI();
  }

  // 도감에서 파트너를 바꾼다. 처음 만나는 친구는 알부터, 만난 적 있는 친구는 쉬기 전 모습 그대로
  async switchPartner(key) {
    if (!SPECIES_BY[key] || key === this.species) return;
    if (this.scanPromise) await this.scanPromise;
    const known = swapPartner(this.st, key, this.growthNow(), this.ledger.totals());
    CUR = key;
    this.refresh();
    this.updateUI();
    this.widget.action(known ? 'wave' : 'happy');
    this.sound('cry_' + key, 0.04);
    if (!known) new Notice(t('adopted', { kind: tr(speciesOf(key).kind) }));
    this.bubble(known ? tl('back') : tl('hello', { name: this.pet.name }), 'hello');
    await this.saveNow();
  }

  // mode: all | fresh | stage. fresh·stage 는 지금까지의 누적을 기준점으로 삼는다
  async restartGrowth(mode, stage, quiet) {
    if (this.scanPromise) await this.scanPromise;
    const pet = this.pet;
    const si = clampN(stage | 0, 0, STAGES.length - 1);
    Object.assign(pet, {
      mode,
      startStage: si,
      frozen: 0,
      base: mode === 'all' ? null : this.ledger.totals(),
      since: mode === 'all' ? 0 : Date.now(),
      startXp: mode === 'stage' ? STAGES[si].min : 0,
    });
    const before = this.growth;
    this.st.lastLevel = null;
    this.refresh();
    if (!quiet && before && this.growth && this.growth.stageKey !== before.stageKey) {
      this.widget.action('evolve');
      this.sound('evolve');
    }
    await this.saveNow();
  }

  // 날짜별 기록을 지우고 볼트를 다시 읽는다. 업적·아이템·보너스는 남는다
  async recount() {
    if (this.scanPromise) await this.scanPromise;
    this.ledger.d = emptyLedger();
    this.st.scanned = false;
    this.scanPromise = this.scan();
    await this.scanPromise;
    if (this.pet.base) this.pet.base = this.ledger.totals();
    this.refresh();
    await this.saveNow();
  }

  // 모든 것을 지우고 새 알부터
  async wipe() {
    if (this.scanPromise) await this.scanPromise;
    for (const k of Object.keys(this.st)) delete this.st[k];
    Object.assign(this.st, clone(DEFAULT_STATE));
    this.game.retroEvents = [];
    this.brain.daily = {};
    this.ledger.d = emptyLedger();
    migrateParty(this.st, {});
    CUR = this.st.partner;
    this.growth = null;
    this.widget.stageKey = null;
    this.widget.queue = [];
    this.widget.nextBubble();
    this.updateUI();
    this.scanPromise = this.scan();
    await this.scanPromise;
    this.refresh();
    await this.saveNow();
    new WelcomeModal(this).open();
  }

  // ---------- 글꼴 ----------

  // 플러그인 폴더에 fonts/ 가 있으면 갈무리 도트 글꼴을 쓴다. 없으면 테마 글꼴 그대로
  async loadFonts() {
    this.unloadFonts();
    if (!this.settings.pixelFont || !this.manifest.dir) return;
    const adapter = this.app.vault.adapter;
    for (const [file, weight] of [['Galmuri11.woff2', '400'], ['Galmuri11-Bold.woff2', '700']]) {
      const p = normalizePath(`${this.manifest.dir}/fonts/${file}`);
      try {
        if (await adapter.exists(p)) this.fontSources.push([adapter.getResourcePath(p), weight]);
      } catch {
        // 글꼴을 못 불러오면 테마 글꼴로
      }
    }
    await this.addFontsTo(document);
  }

  // 설정 창·팝아웃 창은 문서가 따로라서 글꼴도 따로 넣어야 한다
  async addFontsTo(doc) {
    if (!doc || !this.fontSources.length || this.fontDocs.has(doc)) return;
    this.fontDocs.add(doc);
    const Face = (doc.defaultView && doc.defaultView.FontFace) || FontFace;
    let ok = 0;
    for (const [url, weight] of this.fontSources) {
      try {
        const face = new Face('VaultPetPixel', `url("${url}")`, { weight });
        await face.load();
        doc.fonts.add(face);
        this.fonts.push([doc, face]);
        ok++;
      } catch {
        // 이 창은 테마 글꼴로
      }
    }
    if (ok) doc.body.addClass('vault-pet-pixel');
  }

  unloadFonts() {
    for (const [doc, face] of this.fonts || []) {
      try {
        doc.fonts.delete(face);
        doc.body.removeClass('vault-pet-pixel');
      } catch {
        // 창이 이미 닫혔다
      }
    }
    this.fonts = [];
    this.fontSources = [];
    this.fontDocs = new Set();
  }

  // ---------- 저장 ----------

  saveSoon() {
    this.dirty = true;
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), 2000);
  }

  async saveNow() {
    window.clearTimeout(this.saveTimer);
    this.dirty = false;
    this.st.brainDaily = this.brain.daily;
    await this.saveData({ settings: this.settings, state: this.st, ledger: this.ledger.d });
  }
}

module.exports = VaultPetPlugin;
module.exports.__internals = {
  measure, stripFrontmatter, Ledger, emptyLedger, computeGrowth, xpOf, levelOf, STAGES,
  Brain, Gamify, ACHIEVEMENTS, QUEST_POOL, ITEMS, COLORS, DEFAULT_STATE, DEFAULT_SETTINGS,
  S, LINES, SPECIES_LINES, t, tl, josa, josaRo, bonusText, unlockHint, dayOf, formatDuration,
  SPECIES, SPECIES_BY, VARIANTS, paletteOf, perkMult, newPet, growthOf, migrateParty, swapPartner, PetRenderer, ART, EGG, STAGE_SHAPE,
  setLang: (l) => { LANG = l; },
  setCur: (k) => { CUR = k; },
  CHARS_PER_XP, XP_PER_LINK, XP_PER_NOTE, LIVE_CHAR_CAP, FLUSH_BUDGET,
};
