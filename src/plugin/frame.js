// 킷커밋 데스크톱판의 창(BrowserWindow) + preload + IPC 자리.
//
// 펫 창과 하우스 창의 화면 코드(src/kit/*)는 데스크톱판 것을 거의 그대로 쓴다. 옵시디언 안에서는 그걸 각각 iframe 에 띄운다:
//  - 스타일이 옵시디언과 섞이지 않고(house.css 가 3천 줄), 전역 이름(window.PetSprite 등)도 서로 안 부딪힌다
//  - window.innerWidth·document.body 처럼 '창 하나를 통째로 쓴다'는 가정이 그대로 맞는다
// preload.js 가 contextBridge 로 넣어 주던 window.pet 을 여기서 똑같은 이름으로 넣어 준다.
const ASSETS = require('./kit-assets');

// preload.js 의 표. [이름, 종류, 채널]. 종류: send = 보내기만, invoke = 답을 기다림, on = 알림 받기
const API = [
  // 펫 창
  ['ready', 'send', 'pet:ready'],
  ['hover', 'send', 'pet:hover'],
  ['drag', 'send', 'pet:drag'],
  ['poke', 'send', 'pet:poke'],
  ['stopPlay', 'send', 'pet:play-stop'],
  ['caught', 'send', 'pet:caught'],
  ['played', 'send', 'pet:played'],
  ['toyRecord', 'send', 'pet:toy-record'],
  ['bored', 'send', 'pet:bored'],
  ['stat', 'send', 'pet:stat'],
  ['treatEaten', 'send', 'pet:treat-eaten'],
  ['treasure', 'send', 'pet:treasure'],
  ['rub', 'send', 'pet:rub'],
  ['onFriend', 'on', 'pet:friend'],
  ['onFriendLeave', 'on', 'pet:friend-leave'],
  ['onFriendWear', 'on', 'pet:friend-wear'],
  ['friendInfo', 'invoke', 'pet:friend-info'],
  ['friendTrade', 'invoke', 'pet:friend-trade'],
  ['friendFeed', 'invoke', 'pet:friend-feed'],
  ['friendBye', 'invoke', 'pet:friend-bye'],
  ['eventSay', 'send', 'pet:event-say'],
  ['onEvent', 'on', 'pet:event'],
  ['slot', 'invoke', 'pet:slot'],
  ['onPlay', 'on', 'pet:play'],
  ['onTreat', 'on', 'pet:treat'],
  ['open', 'send', 'pet:open'],
  ['context', 'send', 'pet:context'],
  ['onConfig', 'on', 'pet:config'],
  ['onState', 'on', 'pet:state'],
  ['onBubble', 'on', 'pet:bubble'],
  ['onAction', 'on', 'pet:action'],
  ['onSound', 'on', 'pet:sound'],
  ['onLoading', 'on', 'pet:loading'],
  ['onQuiet', 'on', 'pet:quiet'],
  ['onReset', 'on', 'pet:reset'],
  // 하우스 창
  ['get', 'invoke', 'house:get'],
  ['set', 'invoke', 'house:set'],
  ['onboarded', 'invoke', 'house:onboarded'],
  ['refreshQuests', 'invoke', 'quest:refresh'],
  ['friendCall', 'invoke', 'house:friend-call'],
  ['friendGift', 'invoke', 'house:friend-gift'],
  ['devEvent', 'invoke', 'dev:event'],
  ['saveCard', 'invoke', 'card:save'],
  ['copyCard', 'invoke', 'card:copy'],
  ['copyText', 'invoke', 'card:text'],
  ['resetAll', 'invoke', 'app:reset'],
  ['preview', 'invoke', 'house:preview'],
  ['feed', 'invoke', 'pet:feed'],
  ['buy', 'invoke', 'shop:buy'],
  ['craft', 'invoke', 'workshop:craft'],
  ['useFood', 'invoke', 'shop:use'],
  ['play', 'invoke', 'house:play'],
  ['setLogin', 'invoke', 'login:set'],
  ['installHooks', 'invoke', 'hooks:install'],
  ['uninstallHooks', 'invoke', 'hooks:uninstall'],
  ['revealHooks', 'invoke', 'hooks:reveal'],
  ['setQuiet', 'invoke', 'quiet:set'],
  ['resetPosition', 'invoke', 'pet:reset-position'],
  ['onData', 'on', 'house:data'],
  ['onMood', 'on', 'house:mood'],
  ['onTab', 'on', 'house:tab'],
];

class KitFrame {
  // kind: 'pet' | 'house'. host 는 plugin/host.js 의 KitHost (ipcMain 자리)
  constructor(host, kind) {
    this.host = host;
    this.kind = kind;
    this.listeners = {};
    this.iframe = null;
    this.win = null;
    this.dead = false;
  }

  // parent 안에 iframe 을 만들고 화면 코드를 올린다. opts.tab = 하우스가 처음 열 탭, opts.fontCss = 글꼴, opts.dark
  mount(parent, opts = {}) {
    const doc = parent.ownerDocument;
    const iframe = doc.createElement('iframe');
    iframe.className = `kitcommit-frame kitcommit-frame-${this.kind}`;
    iframe.setAttribute('title', 'Kit Commit');
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('scrolling', 'no');
    parent.appendChild(iframe);
    this.iframe = iframe;
    const win = iframe.contentWindow;
    this.win = win;
    const d = win.document;
    const css = (this.kind === 'pet' ? ASSETS.petCss : ASSETS.houseCss) + '\n' + (opts.fontCss || '') + '\n' + ASSETS.frameCss;
    const body = this.kind === 'pet' ? ASSETS.petBody : ASSETS.houseBody;
    // 빈 iframe(about:blank) 문서에 화면 뼈대를 넣는다. 글은 전부 이 플러그인이 가진 고정 HTML 이다
    const parsed = new win.DOMParser().parseFromString(`<!doctype html><html><head><meta charset="utf-8"><title>Kit Commit</title></head><body>${body}</body></html>`, 'text/html');
    d.replaceChild(d.importNode(parsed.documentElement, true), d.documentElement);
    d.documentElement.lang = 'ko';
    d.documentElement.className = `${opts.dark ? 'theme-dark' : 'theme-light'} kc-${this.kind}`;
    const style = d.createElement('style');
    style.textContent = css;
    d.head.appendChild(style);
    // preload 가 넣어 주던 window.pet (+ 하우스가 처음 열 탭)
    win.pet = this.api();
    if (opts.tab) win.KC_TAB = opts.tab;
    // 하우스가 '이미 본 것'(새로 열림·NEW 표시)을 기억하는 곳. 플러그인 data.json 에 둔다
    win.KC_STORE = { get: (k) => this.host.uiGet(k), set: (k, v) => this.host.uiSet(k, v) };
    win.KC_OBSIDIAN = true;
    this.run();
    return iframe;
  }

  // 화면 코드를 돌린다. 데스크톱판 스크립트들을 빌드할 때 한 함수로 묶어 두었고(scripts/build.js 의 run),
  // iframe 의 window·document·window.pet 을 넘겨서 부른다. 런타임에 스크립트를 꽂거나 eval 하지 않는다
  run() {
    const win = this.win;
    try {
      ASSETS.run(win, win.document, win.pet, this.kind);
      win.__kcLoaded = true;
    } catch (e) {
      console.error('[Kit Commit] screen', e);
    }
  }

  // 부모 쪽 값을 iframe 쪽 값으로 옮긴다 (배열·객체가 iframe 안에서도 제 것으로 보이게. IPC 가 복사해 주던 것과 같다)
  clone(v) {
    if (v === undefined || v === null || typeof v !== 'object') return v;
    try {
      return this.win.structuredClone(v);
    } catch {
      try {
        return this.win.JSON.parse(JSON.stringify(v));
      } catch {
        return v;
      }
    }
  }

  api() {
    const api = {};
    for (const [name, type, ch] of API) {
      if (type === 'on') {
        api[name] = (fn) => {
          (this.listeners[ch] ||= new Set()).add(fn);
          return () => this.listeners[ch] && this.listeners[ch].delete(fn);
        };
      } else if (type === 'send') {
        // IPC 처럼 한 박자 늦게 보낸다 (보내는 쪽 코드가 끝난 다음에 받는다)
        api[name] = (...args) => {
          const a = args.map((x) => (x && typeof x === 'object' ? JSON.parse(JSON.stringify(x)) : x));
          setTimeout(() => !this.dead && this.host.onSend(ch, this, ...a), 0);
        };
      } else {
        api[name] = (...args) => {
          const a = args.map((x) => (x && typeof x === 'object' ? JSON.parse(JSON.stringify(x)) : x));
          const P = this.win.Promise;
          return new P((resolve, reject) => {
            setTimeout(async () => {
              try {
                const r = await this.host.onInvoke(ch, this, ...a);
                resolve(this.clone(r));
              } catch (e) {
                console.error('[Kit Commit]', ch, e);
                reject(e);
              }
            }, 0);
          });
        };
      }
    }
    return api;
  }

  // main 의 webContents.send 자리
  emit(ch, payload) {
    if (this.dead || !this.win) return;
    const set = this.listeners[ch];
    if (!set || !set.size) return;
    const p = this.clone(payload);
    for (const fn of [...set]) {
      try {
        fn(p);
      } catch (e) {
        console.error('[Kit Commit]', ch, e);
      }
    }
  }

  setDark(dark) {
    if (!this.win) return;
    const el = this.win.document.documentElement;
    el.classList.toggle('theme-dark', !!dark);
    el.classList.toggle('theme-light', !dark);
  }

  destroy() {
    this.dead = true;
    this.listeners = {};
    if (this.iframe) this.iframe.remove();
    this.iframe = null;
    this.win = null;
  }
}

module.exports = { KitFrame, API };
