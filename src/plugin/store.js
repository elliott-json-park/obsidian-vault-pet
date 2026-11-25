// 킷커밋 데스크톱판의 JsonFile(settings.json · state.json) 자리. 옵시디언에서는 플러그인 data.json 한 파일에 같이 둔다.
// get/set/saveSoon/saveNow 와 data 는 JsonFile 과 똑같이 쓴다 (core 모듈들이 그대로 쓴다).

const DEFAULT_SETTINGS = {
  petName: '킷',
  language: 'ko', // 'ko' | 'en' | 'zh' | 'ru'
  personality: 'angel',
  scale: 3, // 1~5 다섯 단계 → 배율 1·1.5·2·2.5·3배
  fur: 'cheese',
  ears: 'perk', // 귀 모양 (core/growth.js 의 EAR_SHAPES). 첫 실행 안내 · 옷장에서 고른다
  theme: 'auto', // 하우스 테마: auto(옵시디언이 어두우면 cocoa) | cream | cocoa | mint | sakura | choco
  accessory: 'none',
  outfit: null,
  outfitSaves: [null, null, null],
  motions: {},
  idleMotions: null,
  motionsOff: [], // 모션을 끈 상황 (2.0.0. 상황 키 목록 — core/shop.js 의 MOTION_SLOTS)
  setMotionsOn: true,
  // 2.2.0 (이슈 #9): 돌아온 두 기능. 끄면 새로 일어나지 않고 탭도 숨지만, 가진 것(보물 · 친밀도 · 만든 옷)은 그대로 남는다
  friendsOn: true, // 동네 친구가 놀러 온다 (kit/house.js 친구 탭 · core/friends.js)
  workshopOn: true, // 깜짝 이벤트 · 보물 · 보물 상자 · 교환소 · 공방 만들기 (core/treasure.js · core/workshop.js)
  homeLayout: null, // 홈 칸 순서 · 보이기 [{ id, on }] (2.0.1). null 이면 기본 순서로 모두 (kit/house.js 의 HOME_SECTIONS) // 세트 옷을 입으면 그 세트 전용 모션을 '심심할 때'에 섞는다 (2.0.0)
  soundEnabled: true,
  bubblesEnabled: true,
  chatter: true,
  aiTips: true, // 가끔 옵시디언 활용 팁
  lowPower: false, // 저전력 모드: 펫 판이 그림을 덜 그리고 덜 돌아다닌다 (kit/pet.js)
  goal: null, // 하루 목표 { on, unit: 'words' | 'chars', target } (1.5.0). null 이면 언어에 맞는 기본값 (core/goals.js)
  focusMin: 25, // 집중 시간 길이 (15 · 25 · 50분)
  focusCycle: false, // 포모도로 반복: 집중 → 5분 쉬기를 4판, 네 번째 쉬기는 15분 (2.8.0, 이슈 #22)
  cardPrefs: null, // 자랑 · 리캡 카드에서 고른 것 (기간 · 칸 · 테마 · 자세 · 한 줄). null 이면 기본 (kit/house.js 의 CARD_DEFAULT)

  lunchEnabled: true,
  lunchTime: '11:50',
  dinnerEnabled: true,
  dinnerTime: '18:30',
  bedtime: '01:00',
  restAfterMin: 120,
  sleepyAfterMin: 30,
  sleepAfterMin: 60,
  lateNightEnabled: true,
  autoFeed: false, // 배가 고파지면 창고의 밥을 하나 꺼내 준다 (2.4.0, 이슈 #13)

  excludedProjects: [], // 경험치에서 뺄 폴더 (폴더 이름의 해시)
  showPet: true, // 화면에 고양이를 띄운다 (끄면 하우스에서만 본다)
  houseInSidebar: false, // 리본·상태 표시줄로 여는 하우스를 오른쪽 사이드바에 띄운다
  position: null, // { x, v: 3 } 고양이 발밑의 가로 자리 (펫 무대 안 좌표)

  tugLevel: 'mid',
  // 2.10.0 LP 플레이어: LP 폴더(볼트 안 경로) · 고른 색 · 무늬 · 음량 · 집중 시간과 같이 틀기
  lpFolder: 'LP',
  lpColor: 'lpc_black',
  lpPattern: 'lpp_plain',
  lpVolume: 0.7,
  lpFocusAuto: false,
  lpRepeat: 'off', // 반복: off | all(선반 전체) | one(한 곡)
  lpOrder: [], // 선반(LP) 순서 (앨범 폴더 이름 배열). 화면이 끌어서 바꾸면 lp:reorder-albums 가 쓴다
  lpTrackOrder: {}, // LP 안 곡 순서 { 앨범: [파일 이름…] } (lp:reorder-tracks)
  lpStyles: {}, // LP별 꾸미기 { 앨범: { color, pattern } }. 없으면 lpColor · lpPattern(기본)을 따른다 (lp:style)
  devMode: false,
};

class Store {
  constructor(data, defaults, onChange) {
    this.data = { ...structuredClone(defaults), ...(data || {}) };
    this.onChange = onChange;
  }

  get(key) {
    return this.data[key];
  }

  set(patch) {
    Object.assign(this.data, patch);
    this.saveSoon();
  }

  saveSoon() {
    this.onChange(false);
  }

  saveNow() {
    this.onChange(true);
  }
}

// 처음 설치할 때 언어에 맞춰 주는 고양이 이름 (한국어는 DEFAULT_SETTINGS 의 '킷')
const DEFAULT_PET_NAME = { en: 'Kit', zh: '奇奇', ru: 'Kit' };

module.exports = { Store, DEFAULT_SETTINGS, DEFAULT_PET_NAME };
