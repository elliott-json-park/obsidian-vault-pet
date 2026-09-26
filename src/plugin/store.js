// 킷커밋 데스크톱판의 JsonFile(settings.json · state.json) 자리. 옵시디언에서는 플러그인 data.json 한 파일에 같이 둔다.
// get/set/saveSoon/saveNow 와 data 는 JsonFile 과 똑같이 쓴다 (core 모듈들이 그대로 쓴다).

const DEFAULT_SETTINGS = {
  petName: '킷',
  language: 'ko', // 'ko' | 'en'
  personality: 'angel',
  scale: 3, // 1~5 다섯 단계 → 배율 1·1.5·2·2.5·3배
  fur: 'cheese',
  accessory: 'none',
  outfit: null,
  outfitSaves: [null, null, null],
  motions: {},
  idleMotions: null,
  soundEnabled: true,
  bubblesEnabled: true,
  chatter: true,
  aiTips: true, // 가끔 옵시디언 활용 팁

  lunchEnabled: true,
  lunchTime: '11:50',
  dinnerEnabled: true,
  dinnerTime: '18:30',
  bedtime: '01:00',
  restAfterMin: 120,
  sleepyAfterMin: 30,
  sleepAfterMin: 60,
  lateNightEnabled: true,

  excludedProjects: [], // 경험치에서 뺄 폴더 (폴더 이름의 해시)
  showPet: true, // 화면에 고양이를 띄운다 (끄면 하우스에서만 본다)
  houseInSidebar: false, // 리본·상태 표시줄로 여는 하우스를 오른쪽 사이드바에 띄운다
  position: null, // { x, v: 3 } 고양이 발밑의 가로 자리 (펫 무대 안 좌표)

  tugLevel: 'mid',
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

module.exports = { Store, DEFAULT_SETTINGS };
