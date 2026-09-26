'use strict';
/*
 * main.js 를 만든다.   node scripts/build.js
 *
 * - src/core, src/plugin 모듈(CommonJS)을 작은 require 표로 묶는다 (옵시디언은 main.js 한 파일만 읽는다)
 * - src/kit 의 화면 코드(데스크톱판 킷커밋 렌더러)는 글자로 넣어 두었다가 iframe 안에 올린다 (plugin/frame.js)
 * - styles.css 는 src/plugin/styles.css 를 그대로 복사한다
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const read = (rel) => fs.readFileSync(path.join(src, rel), 'utf8');

// 펫 창·하우스 창이 읽는 스크립트 (데스크톱판 pet.html · house.html 의 <script> 순서 그대로)
const COMMON = [
  'kit/i18n.js',
  'kit/i18n-obsidian.js',
  'kit/pixelart.js',
  'kit/sprite.js',
  'kit/friends.js',
  'kit/accessories.js',
  'kit/accessories-workshop-b.js',
  'kit/accessories-workshop-c.js',
  'kit/accessories-workshop-a.js',
  'kit/accessories-back6.js',
  'kit/accessories-fx6.js',
  'kit/accessories-hand6.js',
  'kit/accessories-head6.js',
  'kit/accessories-sets6.js',
  'kit/accessories-7.js',
  'kit/motions.js',
  'kit/reactions.js',
  'kit/toys.js',
];
const PET = ['kit/sound.js', 'kit/pet.js', 'kit/toyplay.js', 'kit/toyplay2.js', 'kit/toyplay3.js', 'kit/toyplay4.js'];
const HOUSE = ['kit/house.js'];

const join = (list) => list.map((f) => `/* ${f} */\n${read(f)}`).join('\n;\n');

// 데스크톱판 house.css 는 컴퓨터의 밝기 설정(prefers-color-scheme)을 따른다.
// 옵시디언판은 옵시디언 테마를 따르게 html.theme-dark 규칙으로 바꾼다
function themeCss(css) {
  const head = '@media (prefers-color-scheme: dark)';
  let out = '';
  let i = 0;
  for (;;) {
    const at = css.indexOf(head, i);
    if (at < 0) break;
    out += css.slice(i, at);
    const open = css.indexOf('{', at);
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const inner = css.slice(open + 1, j - 1);
    out += inner.replace(/([^{}]+)\{([^{}]*)\}/g, (_m, sel, body) => {
      const s = sel
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => (x.startsWith(':root') ? 'html.theme-dark' + x.slice(5) : x.startsWith('html') ? x.replace(/^html/, 'html.theme-dark') : 'html.theme-dark ' + x))
        .join(',\n');
      return `\n${s} {${body}}`;
    });
    i = j;
  }
  return out + css.slice(i);
}

// pet.html · house.html 의 <body> 속 (스크립트 빼고)
const PET_BODY = `
    <div id="bubble" class="bubble" hidden>
      <span class="ico"></span>
      <span class="text"></span>
      <span class="hint"></span>
    </div>
    <div id="loading" class="loading" hidden></div>
    <div id="playhint" class="playhint" hidden></div>
    <canvas id="pet"></canvas>
    <canvas id="field"></canvas>`;
const HOUSE_BODY = `
    <header class="top">
      <button id="dev" class="dev-toggle" type="button"></button>
      <div class="hero">
        <canvas id="hero" class="pixel"></canvas>
        <div class="hero-info">
          <div class="hero-name"><b id="h-name"></b> <span id="h-lv" class="lv"></span></div>
          <div id="h-mood" class="mood"></div>
          <div class="xp">
            <div class="xp-bar"><i id="h-xpbar"></i></div>
            <span id="h-xptext"></span>
          </div>
        </div>
        <div class="hero-streak" id="h-streak"></div>
      </div>
      <nav class="tabs" id="tabs">
        <button data-tab="home" data-icon="home"><span class="tx"></span></button>
        <button data-tab="achievements" data-icon="medal"><span class="tx"></span></button>
        <button data-tab="wardrobe" data-icon="ribbon"><span class="tx"></span><span class="dot" id="dot-wardrobe" hidden></span></button>
        <button data-tab="shop" data-icon="coin"><span class="tx"></span><span class="dot" id="dot-shop" hidden></span></button>
        <button data-tab="friends" data-icon="paw"><span class="tx"></span><span class="dot" id="dot-friends" hidden></span></button>
        <button data-tab="workshop" data-icon="gem"><span class="tx"></span></button>
        <button data-tab="stats" data-icon="chart"><span class="tx"></span></button>
        <button data-tab="settings" data-icon="gear"><span class="tx"></span></button>
      </nav>
    </header>
    <main id="view"></main>
    <div id="welcome" class="welcome" hidden></div>
    <div id="modal" class="modal" hidden></div>
    <div id="toast" class="toast" hidden></div>`;

// iframe 안에만 더하는 스타일 (옵시디언판)
const FRAME_CSS = read('plugin/frame.css');

const assets = {
  petBody: PET_BODY,
  houseBody: HOUSE_BODY,
  petCss: read('kit/pet.css'),
  houseCss: themeCss(read('kit/house.css')),
  frameCss: FRAME_CSS,
};

// ---------- 모듈 묶기 ----------
const modules = {};
function add(id, code) {
  modules[id] = code;
}
const walk = (dir) => {
  for (const f of fs.readdirSync(path.join(src, dir))) {
    if (!f.endsWith('.js')) continue;
    const id = `${dir}/${f.slice(0, -3)}`;
    add(id, read(`${dir}/${f}`));
  }
};
walk('core');
walk('plugin');
// 호스트(플러그인) 쪽에서도 쓰는 화면 코드: 글(i18n + 옵시디언판 글)과 도트 아이콘
add('kit/i18n', read('kit/i18n.js') + '\n;\n' + read('kit/i18n-obsidian.js'));
add('kit/pixelart', read('kit/pixelart.js'));
// 화면 코드는 글자로 넣었다가 iframe 에 스크립트로 꽂지 않고, 보통 함수로 묶어 둔다 (옵시디언 자동 리뷰가 런타임 스크립트 주입을 막는다).
// run(window, document, pet, kind) 를 부르면 iframe 의 window·document 를 쥐고 데스크톱판 화면 코드가 그대로 돈다.
// 전역처럼 쓰던 이름(타이머·storage·모듈 이름)은 함수 안 변수로 iframe 쪽 것을 가리키게 한다
const EXPORTS = ['PetSprite', 'PixelArt', 'I18N', 'PetFriends', 'PetToys', 'PetSound', 'ToyKit'];
const sync = EXPORTS.map((n) => `if (window.${n} !== undefined) ${n} = window.${n};`).join(' ');
const wrap = (list) => list.map((f) => `/* ${f} */
${read(f)}
;${sync}`).join('\n');
const RUN = `function run(window, document, pet, kind) {
  var module, exports, require;
  var globalThis = window, self = window;
  var setTimeout = window.setTimeout.bind(window), clearTimeout = window.clearTimeout.bind(window);
  var setInterval = window.setInterval.bind(window), clearInterval = window.clearInterval.bind(window);
  var requestAnimationFrame = window.requestAnimationFrame.bind(window), cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  var getComputedStyle = window.getComputedStyle.bind(window), confirm = window.confirm.bind(window);
  var performance = window.performance, history = window.history, location = window.location;
  var AudioContext = window.AudioContext;
  var ${EXPORTS.join(', ')};
${wrap(COMMON)}
  if (kind === 'pet') {
${wrap(PET)}
  } else {
${wrap(HOUSE)}
  }
}`;
add('plugin/kit-assets', `module.exports = ${JSON.stringify(assets)};
module.exports.run = ${RUN};`);

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
let out = `/*
 * Kit Commit ${manifest.version} — Obsidian plugin (built ${new Date().toISOString().slice(0, 10)})
 * 옵시디언에 글을 쓸수록 자라는 도트 고양이. 소스: src/ (node scripts/build.js 로 이 파일을 만든다)
 * 비공식 팬메이드. Anthropic 과 관련이 없습니다.
 */
const __ext = require;
const __defs = {};
const __cache = {};
function __resolve(from, req) {
  if (req === 'events') return 'plugin/events';
  if (!req.startsWith('.')) return null;
  const parts = from.split('/').slice(0, -1);
  for (const p of req.replace(/\\.js$/, '').split('/')) {
    if (p === '.') continue;
    if (p === '..') parts.pop();
    else parts.push(p);
  }
  return parts.join('/');
}
function __require(from) {
  return (req) => {
    const id = __resolve(from, req);
    if (id === null) return __ext(req);
    if (!__defs[id]) throw new Error('Kit Commit: module not found ' + req + ' from ' + from);
    if (__cache[id]) return __cache[id].exports;
    const m = { exports: {} };
    __cache[id] = m;
    __defs[id].call(m.exports, m, m.exports, __require(id));
    return m.exports;
  };
}
`;
for (const [id, code] of Object.entries(modules)) {
  out += `\n__defs[${JSON.stringify(id)}] = function (module, exports, require) {\n${code}\n};\n`;
}
out += `\nmodule.exports = __require('plugin/main')('./main');\n`;

fs.writeFileSync(path.join(root, 'main.js'), out);
fs.writeFileSync(path.join(root, 'styles.css'), read('plugin/styles.css'));
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`main.js ${kb(out.length)}`);
