// 하우스 창: 펫 상태, 퀘스트, 업적, 꾸미기, 통계, 설정, 첫 실행 안내.
// 2.0.0: 홈은 옵시디언을 쓰는 데 도움이 되는 것들(목표 · 집중 타이머 · 할 일 · 퀘스트 · 노트 지도 · 최근 노트).
//  동네 친구 · 보물 공방 탭, 먹고 싶은 것 · 오늘의 소식 칸, 그날의 기분 딱지, 상점의 모션 페이지는 없앴다.
// (옵시디언판: 데스크톱판 house.js 사본. 옵시디언 탭 속 iframe 에서 돈다. 바꾼 곳에는 [옵시디언] 표시)
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const T = new I18N.Strings();
const t = (key, vars) => T.t(key, vars);
const locale = () => T.locale;
const fmt = (n) => Math.round(n).toLocaleString(locale());
const compact = (n) => new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
// 단계 이름은 i18n 이 갖는다 (growth.js 는 key 만 보낸다)
const stageName = (key) => (key ? t('stage.' + key) : '');
// 경험치 내역의 이유. 예전 버전이 저장한 건 그냥 문자열이라 그대로 보여준다
const why = (b) => (b.why && typeof b.why === 'object' ? t(b.why.k, b.why.v) : String(b.why || ''));
// 크기는 1~5 다섯 단계 (배율 1~3배를 0.5배씩. main/main.js 의 effScale)
const scaleStep = (v) => Math.max(1, Math.min(5, Math.round(Number(v) || 5)));
// 아이콘은 전부 도트다 (renderer/pixelart.js). 이모지는 기기마다 모양이 달라서 안 쓴다
const icon = (name, px = 16) => PixelArt.svg(name, px);
// 먹이 카드의 배부름: 도트 아이콘 + 숫자 한 줄. 뜻은 마우스를 올리면
const foodGain = (it) => `<div class="food-gain" title="${esc(t('shop.gainFood', { n: it.fill }))}"><span>${icon('ricebowl', 11)}+${it.fill}</span></div>`;
// 먹었을 때 특별한 일이 있는 먹이(프리미엄)는 그 밑에 효과를 짧게 한 줄 (i18n 'foodFx.<키>', 긴 설명은 'foodFxTip.<키>'. 없으면 줄도 없다)
const FOOD_FX_ICON = { otoroOmakase: 'lock', royalTable: 'lock', dragonKingFeast: 'lock', afternoonTea: 'lock', dragonCandy: 'lock', cloudMallow: 'sparkle', roomService: 'sparkle', goldMouseChoco: 'gem', fortuneCookie: 'star', mysteryBox: 'gift' };
const foodFx = (key) => {
  const k = 'foodFx.' + key;
  const s = t(k);
  if (s === k) return '';
  const tip = t('foodFxTip.' + key);
  return `<div class="food-fx" title="${esc(tip === 'foodFxTip.' + key ? s : tip)}">${FOOD_FX_ICON[key] ? icon(FOOD_FX_ICON[key], 11) : ''}${esc(s)}</div>`;
};
// 움직이는 먹이(프리미엄)는 data-anim 을 달아 두면 아래 루프가 프레임을 바꿔 그린다
// [옵시디언] iframe 이라 숨긴 고양이·뒤에 깔린 탭·접은 사이드바에서도 document.hidden 이 false 다. 화면에 안 보이면 쉰다
const offscreen = () => document.hidden || !!(window.frameElement && !window.frameElement.getClientRects().length);
const foodArt = (key, px) => `<div class="art"${PixelArt.FOOD_ANIM[key] ? ` data-anim="${key}" data-px="${px}"` : ''}>${icon(key, px)}</div>`;
setInterval(() => {
  if (offscreen()) return;
  const now = Date.now();
  for (const el of document.querySelectorAll('[data-anim]')) {
    const a = PixelArt.FOOD_ANIM[el.dataset.anim];
    const f = Math.floor(now / a.ms) % a.frames;
    if (el.dataset.f === String(f)) continue;
    el.dataset.f = f;
    el.innerHTML = PixelArt.svg(el.dataset.anim, +el.dataset.px, '', f);
  }
}, 60);
// 어려운 말 옆에 붙는 (i). 마우스를 올리면 설명이 뜬다 (아래 '설명 말풍선')
const info = (key) => `<span class="info" tabindex="0" data-tip="${esc(t('tip.' + key))}">i</span>`;
// 큰 토큰 수는 Claude Code 화면처럼 영어 줄임(7.1B)으로
const bigTok = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
const hourName = (h) =>
  h == null ? '-'
  : T.lang === 'en' ? `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
  : T.lang === 'zh' ? (h === 0 ? '凌晨0点' : h === 12 ? '中午12点' : `${h < 6 ? '凌晨' : h < 12 ? '上午' : h < 18 ? '下午' : '晚上'}${h % 12}点`)
  : `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시`;
const coins = (n, px = 14) => `${icon('coin', px)}<span>${t('shop.coin', { n: fmt(n) })}</span>`;
// [옵시디언 2.0.0] 옵시디언 습관 퀘스트 (core/gamify.js 의 QUEST_POOL)
const QUEST_ICON = { chars: 'scroll', links: 'pin', tags: 'pin', heads: 'scroll', daily: 'calendar', tasks: 'check', props: 'gear', embeds: 'eye', organize: 'home', orphans: 'paw', notes: 'map', focus: 'hourglass', todos: 'check', graph: 'map' };
// 고양이가 한 마리뿐이면 단계 얘기(로드맵·시작 단계 고르기)를 통째로 숨긴다
const oneStage = () => !D || !D.stages || D.stages.length < 2;
const MOOD_ICON = { thinking: 'laptop', waiting: 'bang', active: 'eye', idle: 'leaf', sleepy: 'doze', sleeping: 'zzz', hungry: 'ricebowl' };

let D = null;
// [옵시디언] 처음 열 탭은 플러그인이 window.KC_TAB 으로 넣어 준다 (iframe 이라 주소 # 을 못 쓴다)
let tab = (window.KC_TAB ? '#' + window.KC_TAB : location.hash || '#home').slice(1) || 'home';
let minis = [];
// 통계 맨 위에서 고양이가 건네는 위로 한마디. 탭에 들어올 때마다 새로 고른다 (데이터가 바뀔 때마다 바뀌면 읽다가 사라진다)
let insightLine = null;
// 누적 기록 아래 책 비교 한 줄. 처음 쓴 날부터의 출력 토큰으로 센다. 위로 한마디처럼 탭에 들어올 때마다 새로 고른다
let bookLine = null;

// 유명한 책의 단어 수 (영어판 기준, 여러 단어 수 집계 사이트에서 공통으로 쓰는 값).
// [옵시디언] 쓴 글자(공백 뺀 글자)로 빗댄다. 영어는 단어 하나가 공백 빼고 4~5자쯤이라 단어 수 × 4.5 로 어림한다
const TOKENS_PER_WORD = 4.5;
const BOOKS = [
  { key: 'littlePrince', words: 16_535 },
  { key: 'gatsby', words: 47_094 },
  { key: 'nineteen84', words: 88_942 },
  { key: 'hobbit', words: 95_022 },
  { key: 'mobyDick', words: 206_052 },
  { key: 'crime', words: 211_591 },
  { key: 'anna', words: 349_736 },
  { key: 'lotr', words: 455_125 },
  { key: 'lesMis', words: 565_728 },
  { key: 'warPeace', words: 587_287 },
  { key: 'bible', words: 783_137 },
  { key: 'harryPotter', words: 1_084_625 },
  { key: 'proust', words: 1_267_069 },
  { key: 'iceFire', words: 1_736_054 },
];
// 지금까지 쓴 글자를 책에 빗댄 한 줄. 1배 넘는 책 중에서 하나를 골라 몇 배인지 말한다.
// 아직 가장 얇은 책보다 적으면 그 책의 몇 %인지
function bookCompare(tokens) {
  const tok = (b) => b.words * TOKENS_PER_WORD;
  const over = BOOKS.filter((b) => tokens >= tok(b));
  if (!over.length) return t('book.part', { book: t('book.' + BOOKS[0].key), p: Math.max(1, Math.round((tokens / tok(BOOKS[0])) * 100)) });
  // 너무 큰 배수(수천 배)는 와닿지 않으니 두꺼운 책 쪽에서 고른다
  const pool = over.slice(-4);
  const b = pool[Math.floor(Math.random() * pool.length)];
  const x = tokens / tok(b);
  const times = x >= 10 ? fmt(x) : (Math.round(x * 10) / 10).toLocaleString(locale());
  return t('book.times', { book: t('book.' + b.key), x: times, words: fmt(b.words) });
}
// 가계부: 통계 화면에 항목마다 보여 줄 줄 수, 팝업에 넣을 전체 가계부
const LEDGER_SHOWN = 3;
let ledgerFull = '';

// ---------- 설명 말풍선 ----------
// (i) 에 마우스를 올리거나 키보드로 가면 그 옆에 설명이 뜬다. 패널 밖으로 잘리지 않게 화면에 띄운다
const tipEl = document.createElement('div');
tipEl.className = 'tip';
tipEl.hidden = true;
document.body.appendChild(tipEl);
function showTip(el) {
  tipEl.textContent = el.dataset.tip;
  tipEl.hidden = false;
  const r = el.getBoundingClientRect();
  const w = tipEl.offsetWidth;
  const h = tipEl.offsetHeight;
  tipEl.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  tipEl.style.top = `${r.top - h - 6 < 8 ? r.bottom + 6 : r.top - h - 6}px`;
}
const hideTip = () => (tipEl.hidden = true);
for (const [ev, on] of [['mouseover', true], ['focusin', true], ['mouseout', false], ['focusout', false]]) {
  document.addEventListener(ev, (e) => {
    const el = e.target.closest && e.target.closest('.info');
    if (!el) return;
    on ? showTip(el) : hideTip();
  });
}
document.addEventListener('scroll', hideTip, true);

// ---------- 팝업 ----------
// 바깥을 누르거나 Esc 를 누르거나 닫기 버튼을 누르면 닫힌다. onClose 는 닫힐 때 한 번
let modalClose = null;
function openModal(html, cls = '', onClose = null) {
  const el = $('#modal');
  el.className = 'modal ' + cls;
  el.innerHTML = `<div class="panel modal-box">${html}</div>`;
  el.hidden = false;
  modalClose = onClose;
  $$('[data-close]', el).forEach((b) => b.addEventListener('click', closeModal));
  return el;
}
function closeModal() {
  const el = $('#modal');
  if (el.hidden) return;
  el.hidden = true;
  el.innerHTML = '';
  minis = minis.filter((m) => document.body.contains(m.canvas));
  const f = modalClose;
  modalClose = null;
  if (f) f();
}
$('#modal').addEventListener('mousedown', (e) => {
  if (e.target.id === 'modal') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ---------- 스프라이트 ----------

const hero = new PetSprite.PetRenderer($('#hero'));

function mini(canvas) {
  const r = new PetSprite.PetRenderer(canvas);
  r.setStage(canvas.dataset.stage || 'cat');
  r.setAccessory(canvas.dataset.acc || 'none');
  if (canvas.dataset.fur) r.fur = PetSprite.GUEST_FURS[Number(canvas.dataset.fur)];
  // 내 고양이 털색. data-furkey 로 따로 정하거나(털색 고르기), data-plain 이면 기본 치즈(장난감 시연)
  else if (canvas.dataset.furkey) r.setFur(canvas.dataset.furkey);
  else if (!canvas.dataset.plain && D && D.settings) r.setFur(D.settings.fur);
  // 내 고양이 귀 모양. data-ears 로 따로 정하거나(귀 고르기). 손님 고양이 · 장난감 시연(data-plain)은 기본 귀
  if (canvas.dataset.ears) r.setEars(canvas.dataset.ears);
  else if (canvas.dataset.fur == null && !canvas.dataset.plain && D && D.settings) r.setEars(D.settings.ears);
  r.setMood(canvas.dataset.mood || 'idle');
  r.demo = canvas.dataset.motion || null;
  r.demoGap = 0;
  return r;
}

// ---------- 자랑 카드 · 리캡 카드 ----------
// 데스크톱판 8차 (2026-10-09): 한 장짜리 자랑 카드를 '내가 고르는 카드'로 바꿨다.
//  기간(이번 달 · 지난달 · 처음부터) · 넣을 칸(최대 6) · 색 테마 · 고양이 자세 · 이름/레벨/잔디 · 한 줄 문구를 고른다.
//  고른 것은 settings.cardPrefs 에 남아 다음에 열어도 그대로다 (호스트가 core/recap.js 의 cleanCardPrefs 로 거른다).
//  [옵시디언] 숫자는 core/recap.js 가 글쓰기 기록(쓴 글자 · 링크 · 새 노트 · 세션 · 폴더)으로 센다.
//  1080×1350 (게시물 4:5) · 1080×1920 (스토리 9:16) PNG
const CARD_CELLS = ['written', 'links', 'notes', 'sessions', 'days', 'streak', 'busiest', 'peak', 'folder', 'coins', 'achievements', 'level', 'xp', 'folders'];
const CARD_MAX = 6;
const CARD_DEFAULT = { format: 'post', period: 'month', cells: ['written', 'days', 'streak', 'busiest', 'peak', 'links'], theme: 'cream', pose: 'idle', grass: true, name: true, level: true, caption: '' };
const CARD_THEMES = {
  cream: { bg: '#fbf5ec', band: '#f3e3d1', ink: '#3a2118', muted: '#8b6f60', accent: '#d97757', cell: '#f1e6d6', off: '#ece1d2', on: [217, 119, 87], frame: '#3a2118' },
  night: { bg: '#1c1a33', band: '#2a2550', ink: '#f4ecff', muted: '#a99cc9', accent: '#ffd84a', cell: '#2f2a55', off: '#2a2648', on: [255, 216, 74], frame: '#0d0b20' },
  mint: { bg: '#f1fbf6', band: '#d7f2e5', ink: '#1f3a30', muted: '#5f8a79', accent: '#2f9e75', cell: '#e2f5ec', off: '#dcefe6', on: [47, 158, 117], frame: '#1f3a30' },
  sakura: { bg: '#fff5f7', band: '#ffe0e8', ink: '#4a2430', muted: '#a06a7a', accent: '#e8638a', cell: '#ffe9ef', off: '#f7e3e8', on: [232, 99, 138], frame: '#4a2430' },
};
const CARD_POSES = ['idle', 'thinking', 'waiting', 'sleeping'];
let cardPrefs = null; // 지금 편집 중인 카드 설정
let cardData = {}; // 기간별 recap 숫자 (열 때마다 새로 받는다)

function cardPrefsNow() {
  const p = { ...CARD_DEFAULT, ...(D.settings.cardPrefs || {}) };
  if (!Array.isArray(p.cells)) p.cells = CARD_DEFAULT.cells.slice();
  return p;
}

// 기간 이름: '2026년 10월' · 'October 2026' · '지금까지'
function cardPeriodName(R) {
  if (R.kind === 'all') return t('rc.periodAll');
  return new Date(R.year, R.month - 1, 1).toLocaleDateString(locale(), { year: 'numeric', month: 'long' });
}

// [옵시디언] 데스크톱판은 '처음부터'를 Claude Code 통계 화면 숫자로 덮었다. 옵시디언판은 recap 숫자 그대로
function cardNumbers(R) {
  return R;
}

// 칸 하나 → [이름, 값]
function cardCell(id, R) {
  const day = (k) => {
    if (!k) return '-';
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
  };
  switch (id) {
    case 'written': return [t('vc.written'), compact(R.written || 0)];
    case 'links': return [t('vc.links'), fmt(R.links)];
    case 'notes': return [t('rc.notes'), fmt(R.notes)];
    case 'sessions': return [t('vc.sessions'), fmt(R.sessions)];
    case 'days': return [t('cc.days'), t('rc.nDays', { n: fmt(R.activeDays) })];
    case 'streak': return [t('rc.streak'), t('rc.nDays', { n: fmt(R.streak) })];
    case 'busiest': return [t('rc.busiest'), R.busiest ? day(R.busiest.day) : '-'];
    case 'peak': return [t('cc.peak'), hourName(R.peakHour)];
    case 'folder': return [t('vc.folder'), R.favFolder || '-'];
    case 'coins': return [t('rc.coins'), fmt(R.coins)];
    case 'achievements': return [t('rc.achievements'), fmt(R.achievements)];
    case 'level': return [t('rc.level'), R.levelFrom === R.levelTo ? `Lv.${R.levelTo}` : `Lv.${R.levelFrom} → ${R.levelTo}`];
    case 'xp': return [t('rc.xp'), '+' + fmt(R.xp)];
    case 'folders': return [t('rc.folders'), fmt(R.folders)];
  }
  return [id, '-'];
}

function drawCard(P = cardPrefsNow(), raw = cardData[P.period]) {
  const R = cardNumbers(raw || { kind: P.period, daily: {}, year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const TH = CARD_THEMES[P.theme] || CARD_THEMES.cream;
  // post = 1080×1350 (인스타 게시물 4:5), story = 1080×1920 (스토리 9:16). 스토리는 고양이 띠와 고양이를 키운다
  const story = P.format === 'story';
  const W = 540;
  const Hh = story ? 960 : 675;
  const BAND = story ? 400 : 250;
  const S = 2;
  const cv = document.createElement('canvas');
  cv.width = W * S;
  cv.height = Hh * S;
  const g = cv.getContext('2d');
  g.scale(S, S);
  g.imageSmoothingEnabled = false;
  // 중국어는 프리텐다드에 없는 한자를 중국어 글꼴로 (맑은 고딕의 한자로 섞여 나오지 않게)
  const cjk = T.lang === 'zh' ? "'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC', 'Source Han Sans SC', " : '';
  const font = (w, px) => `${w} ${px}px Pretendard, ${cjk}'Malgun Gothic', sans-serif`;
  const text = (s, x, y, f, color = TH.ink, align = 'center') => {
    g.font = f;
    g.fillStyle = color;
    g.textAlign = align;
    g.fillText(s, x, y);
  };
  // 너무 긴 글은 줄여서 넣는다
  const fit = (s, max, f) => {
    g.font = f;
    let v = String(s);
    while (v.length > 1 && g.measureText(v).width > max) v = v.slice(0, -2) + '…';
    return v;
  };

  // 바탕과 도트 테두리
  g.fillStyle = TH.bg;
  g.fillRect(0, 0, W, Hh);
  g.fillStyle = TH.band;
  g.fillRect(0, 0, W, BAND);
  g.fillStyle = TH.frame;
  for (const [x, y, w, h] of [[12, 12, W - 24, 4], [12, Hh - 16, W - 24, 4], [12, 12, 4, Hh - 24], [W - 16, 12, 4, Hh - 24]]) g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(16, Hh - 12, W - 24, 4);
  g.fillRect(W - 12, 16, 4, Hh - 24);
  // 밤 테마는 띠에 별을 몇 개 뿌린다
  if (P.theme === 'night') {
    g.fillStyle = 'rgba(255,246,200,0.8)';
    for (let i = 0; i < 26; i++) g.fillRect(24 + ((i * 97) % (W - 48)), 24 + ((i * 53) % (BAND - 40)), i % 4 ? 2 : 3, i % 4 ? 2 : 3);
  }

  text('VAULT PET', 36, 48, font(700, 14), TH.accent, 'left');
  text(cardPeriodName(R), W - 36, 48, font(700, 13), TH.muted, 'right');

  // 고양이 (지금 입은 꾸미기 · 털색 그대로, 고른 자세로)
  const cat = document.createElement('canvas');
  const r = new PetSprite.PetRenderer(cat);
  r.setStage(D.growth ? D.growth.stageKey : 'cat');
  r.setAccessory(D.settings.accessory || 'none');
  r.setFur(D.settings.fur);
  r.setEars(D.settings.ears);
  r.setMood(CARD_POSES.includes(P.pose) ? P.pose : 'idle');
  r.frame();
  const CAT = story ? 480 : 320;
  g.drawImage(cat, (W - CAT) / 2, story ? -90 : -92, CAT, CAT);

  // 이름 · 레벨 · 한 줄
  let y = BAND + 38;
  if (P.name) {
    text(fit(D.settings.petName, W - 80, font(700, 30)), W / 2, y, font(700, 30));
    y += 26;
  }
  if (P.level) {
    const gr = D.growth;
    const lvText = gr && gr.maxed && gr.stars ? `Lv.${gr.level} ★${fmt(gr.stars)}` : `Lv.${gr ? gr.level : 1}`;
    text(lvText, W / 2, y, font(700, 16), TH.accent);
    y += 30;
  } else y += 6;
  const head = P.caption && P.caption.trim()
    ? P.caption.trim()
    : R.kind === 'all'
      ? t('card.headline', { tokens: compact(R.written || 0) })
      : t('rc.headline', { period: cardPeriodName(R), tokens: compact(R.written || 0) });
  text(fit(head, W - 70, font(400, 15)), W / 2, y, font(400, 15), TH.ink);

  // 고른 칸 (최대 6). 셋씩 한 줄, 모자라면 가운데로
  const ids = (P.cells || []).slice(0, CARD_MAX);
  const cw = 150;
  const ch = 58;
  const top = y + 20;
  ids.forEach((id, i) => {
    const row = Math.floor(i / 3);
    const inRow = Math.min(3, ids.length - row * 3);
    const gx = (W - cw * inRow - 12 * (inRow - 1)) / 2;
    const x = gx + (i % 3) * (cw + 12);
    const yy = top + row * (ch + 10);
    const [k, v] = cardCell(id, R);
    g.fillStyle = TH.cell;
    g.fillRect(x, yy, cw, ch);
    text(fit(k, cw - 20, font(400, 11)), x + 12, yy + 22, font(400, 11), TH.muted, 'left');
    text(fit(v, cw - 20, font(700, 18)), x + 12, yy + 46, font(700, 18), TH.ink, 'left');
  });
  const afterCells = top + Math.ceil(ids.length / 3) * (ch + 10) + (ids.length ? 6 : 0);

  // 잔디: 달 카드는 그달 달력(요일 × 주), 처음부터 카드는 최근 20주
  if (P.grass) {
    const daily = R.daily || {};
    const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const cellsArr = [];
    let cols;
    if (R.kind === 'all') {
      cols = 20;
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - (cols - 1) * 7);
      for (let i = 0; i < cols * 7; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        cellsArr.push(d > today ? null : daily[key(d)] || 0);
      }
    } else {
      const first = new Date(R.year, R.month - 1, 1);
      const lastDay = new Date(R.year, R.month, 0).getDate();
      const lead = first.getDay();
      cols = Math.ceil((lead + lastDay) / 7);
      // 달력은 열 = 주, 줄 = 요일 (잔디와 같은 방향)
      for (let i = 0; i < cols * 7; i++) cellsArr.push(null);
      for (let dn = 1; dn <= lastDay; dn++) {
        const idx = lead + dn - 1;
        const col = Math.floor(idx / 7);
        const row = idx % 7;
        const d = new Date(R.year, R.month - 1, dn);
        cellsArr[col * 7 + row] = d > today ? -1 : daily[key(d)] || 0; // -1 = 아직 안 온 날 (흐린 칸)
      }
    }
    const room = Hh - 66 - afterCells;
    const cell = Math.max(8, Math.min(R.kind === 'all' ? (story ? 18 : 13) : story ? 26 : 18, Math.floor((room - 6 * 3) / 7)));
    const gap = 3;
    const max = Math.max(1, ...cellsArr.filter((v) => v != null && v >= 0));
    const hx = (W - cols * (cell + gap) + gap) / 2;
    const hy = afterCells + Math.max(0, (room - 7 * (cell + gap)) / 2);
    cellsArr.forEach((v, i) => {
      if (v == null) return;
      const col = Math.floor(i / 7);
      const row = i % 7;
      g.globalAlpha = v < 0 ? 0.4 : 1;
      g.fillStyle = v > 0 ? `rgba(${TH.on.join(',')},${(0.25 + (v / max) * 0.75).toFixed(2)})` : TH.off;
      g.fillRect(hx + col * (cell + gap), hy + row * (cell + gap), cell, cell);
    });
    g.globalAlpha = 1;
  }

  // 처음부터 카드는 책에 빗대기 한 줄을 남긴다
  if (R.kind === 'all') {
    const bookLine = cardBook(R.written || 0);
    if (bookLine) text(bookLine, W / 2, Hh - 61, font(400, 12), TH.muted);
  }
  text(t('card.footer'), W / 2, Hh - 37, font(700, 12), TH.accent);
  return cv;
}

// 카드용 책 비교: 가장 두꺼운 책보다 몇 배인지
function cardBook(tokens) {
  const b = BOOKS[BOOKS.length - 1];
  const x = tokens / (b.words * TOKENS_PER_WORD);
  return x >= 1 ? t('card.book', { book: t('book.' + b.key), x: fmt(x) }) : '';
}

// 자랑 문구: 기간에 맞춰
function cardShareText(P, raw) {
  const R = cardNumbers(raw || {});
  const lv = D.growth ? D.growth.level : 1;
  if (P.period === 'all' || !raw) return t('card.shareText', { name: D.settings.petName, lv, tokens: fmt(D.vault.written), days: fmt(D.vault.activeDays) });
  return t('rc.shareText', { name: D.settings.petName, lv, period: cardPeriodName(R), tokens: fmt(R.written || 0), days: fmt(R.activeDays) });
}

async function openCard() {
  cardPrefs = cardPrefsNow();
  cardData = {};
  cardData[cardPrefs.period] = await pet.recap(cardPrefs.period);
  const chip = (attr, v, on, label) => `<button class="chip ${on ? 'on' : ''}" ${attr}="${v}">${label}</button>`;
  const el = openModal(
    `<div class="modal-top"><h2>${t('card.title')}</h2><button class="btn ghost small" data-close>${t('modal.close')}</button></div>
    <p class="muted" style="margin:0 0 10px;font-size:12px">${t('card.sub')}</p>
    <div class="card-edit">
      <div class="card-slot"></div>
      <div class="card-opts"></div>
    </div>
    <div class="modal-foot card-actions">
      <button class="btn" id="card-text">${t('card.copyText')}</button>
      <button class="btn" id="card-copy">${t('card.copyImage')}</button>
      <button class="btn primary" id="card-save">${t('card.save')}</button>
    </div>`,
    'modal-card',
  );
  let saveTimer = null;
  const remember = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => pet.set({ cardPrefs }).then(apply), 500);
  };
  const paint = () => {
    const cv = drawCard(cardPrefs);
    cv.className = 'card-img';
    // 미리보기는 그린 캔버스를 그대로 붙인다 (창의 보안 정책이 data: 이미지를 막아서 <img> 로는 안 보인다)
    $('.card-slot', el).replaceChildren(cv);
    return cv;
  };
  const opts = () => {
    const P = cardPrefs;
    const n = P.cells.length;
    $('.card-opts', el).innerHTML = `
      <div class="copt"><b>${t('rc.optFormat')}</b><div class="chips">${['post', 'story'].map((k) => chip('data-cp-format', k, (P.format || 'post') === k, t('rc.format.' + k))).join('')}</div></div>
      <div class="copt"><b>${t('rc.optPeriod')}</b><div class="chips">${['month', 'last', 'all'].map((k) => chip('data-cp-period', k, P.period === k, t('rc.period.' + k))).join('')}</div></div>
      <div class="copt"><b>${t('rc.optCells', { n, max: CARD_MAX })}</b><div class="chips">${CARD_CELLS.map((k) => chip('data-cp-cell', k, P.cells.includes(k), cardCell(k, {}).at(0))).join('')}</div></div>
      <div class="copt"><b>${t('rc.optTheme')}</b><div class="chips">${Object.keys(CARD_THEMES).map((k) => `<button class="chip swatch ${P.theme === k ? 'on' : ''}" data-cp-theme="${k}"><i style="background:${CARD_THEMES[k].band};border-color:${CARD_THEMES[k].accent}"></i>${t('rc.theme.' + k)}</button>`).join('')}</div></div>
      <div class="copt"><b>${t('rc.optPose')}</b><div class="chips">${CARD_POSES.map((k) => chip('data-cp-pose', k, P.pose === k, t('rc.pose.' + k))).join('')}</div></div>
      <div class="copt"><b>${t('rc.optShow')}</b><div class="chips">${['name', 'level', 'grass'].map((k) => chip('data-cp-show', k, P[k], t('rc.show.' + k))).join('')}</div></div>
      <div class="copt"><b>${t('rc.optCaption')}</b><input type="text" id="cp-caption" maxlength="40" value="${esc(P.caption || '')}" placeholder="${esc(t('rc.captionPh'))}"></div>`;
    $$('[data-cp-period]', el).forEach((b) =>
      b.addEventListener('click', async () => {
        P.period = b.dataset.cpPeriod;
        if (!cardData[P.period]) cardData[P.period] = await pet.recap(P.period);
        opts();
        paint();
        remember();
      }),
    );
    $$('[data-cp-cell]', el).forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.cpCell;
        if (P.cells.includes(k)) P.cells = P.cells.filter((x) => x !== k);
        else if (P.cells.length < CARD_MAX) P.cells = [...P.cells, k];
        else return toast(t('rc.cellsFull', { max: CARD_MAX }), 'bang');
        opts();
        paint();
        remember();
      }),
    );
    for (const [attr, key] of [['data-cp-theme', 'theme'], ['data-cp-pose', 'pose'], ['data-cp-format', 'format']])
      $$(`[${attr}]`, el).forEach((b) =>
        b.addEventListener('click', () => {
          P[key] = b.getAttribute(attr);
          opts();
          paint();
          remember();
        }),
      );
    $$('[data-cp-show]', el).forEach((b) =>
      b.addEventListener('click', () => {
        P[b.dataset.cpShow] = !P[b.dataset.cpShow];
        opts();
        paint();
        remember();
      }),
    );
    const cap = $('#cp-caption', el);
    cap.addEventListener('input', () => {
      P.caption = cap.value.slice(0, 40);
      paint();
      remember();
    });
  };
  opts();
  paint();
  const url = () => drawCard(cardPrefs).toDataURL('image/png');
  $('#card-save', el).onclick = async () => {
    if (await pet.saveCard(url(), D.settings.petName)) toast(t('card.saved'), 'check');
  };
  $('#card-copy', el).onclick = async () => {
    await pet.copyCard(url());
    toast(t('card.copied'), 'check');
  };
  $('#card-text', el).onclick = async () => {
    await pet.copyText(cardShareText(cardPrefs, cardData[cardPrefs.period]));
    toast(t('card.textCopied'), 'check');
  };
}

// ---------- 모션 카드와 편집 창 ----------

// 이 모션을 작은 캔버스로 보여 줄 때 붙일 속성. type·curl·wait 는 기분 자세라 그 기분으로
const motionCanvasAttr = (key) => (PEEK_MOOD[key] ? `data-mood="${PEEK_MOOD[key]}"` : `data-motion="${key}"`);
const stageNow = () => (D.growth ? D.growth.stageKey : 'cat');
// 이 상황의 모션을 껐나 (2.0.0, 설정 motionsOff)
const motionOff = (key) => !!(D.motion && (D.motion.off || []).includes(key));

// 이 자리에 지금 골라 둔 모션들
function motionsIn(sl) {
  if (!sl.multi) return [D.motion.chosen[sl.key]].filter(Boolean);
  return sl.key === 'idle' ? D.motion.idle : (D.motion.lists || {})[sl.key] || [];
}

function motionCard(sl) {
  const on = motionsIn(sl);
  const off = motionOff(sl.key);
  const thumbs = off
    ? `<p class="muted mcard-empty">${t('mot.offNote')}</p>`
    : on.length
    ? on
        .map(
          (k) => `<div class="mthumb on" data-motion-key="${k}" title="${esc(t('set.peekHint'))}">
            <canvas class="pixel" data-stage="${stageNow()}" data-acc="${esc(D.settings.accessory || 'none')}" ${motionCanvasAttr(k)}></canvas>
            <span>${esc(t('motion.' + k))}</span></div>`,
        )
        .join('')
    : `<p class="muted mcard-empty">${t('mot.off')}</p>`;
  // 2.0.0: 상황마다 켜고 끄는 스위치. 끄면 그 상황엔 모션 없이 (고양이가 머무는 상황은 기본 자세로)
  return `<div class="panel mcard ${sl.multi ? 'multi' : ''} ${off ? 'off' : ''}">
    <div class="mcard-top"><b>${t('slot.' + sl.key)}</b><label class="switch mini" title="${esc(t(off ? 'mot.turnOn' : 'mot.turnOff'))}"><input type="checkbox" data-moff="${sl.key}" ${off ? '' : 'checked'}><span></span></label></div>
    <small class="muted">${t('slot.' + sl.key + 'Sub')}</small>
    <div class="mstrip">${thumbs}</div>
    ${off ? '' : `<div class="mcard-foot"><span class="mtag">${!sl.multi ? t('mot.one') : on.length > 1 ? t('mot.many', { n: on.length }) : t('mot.count', { n: on.length })}</span><button class="btn ghost small mcard-btn" data-medit="${sl.key}">${icon('gear', 12)}${t('mot.edit')}</button></div>`}
  </div>`;
}

// 설정의 모션 칸 12개를 4묶음으로 보여 준다 (2026-10-10). 안쪽 칸 구조는 그대로 (main/shop.js MOTION_SLOTS)
const MOTION_GROUPS = [
  ['work', ['work', 'workLong', 'workHour']],
  ['claude', ['waiting', 'done']],
  ['rest', ['idle', 'hungry', 'rest', 'sleep']],
  ['joy', ['levelup', 'wear', 'poke']],
];
const mgroupOpen = new Set(); // 펼쳐 둔 묶음 (창을 다시 그려도 그대로)
function motionGroups() {
  return MOTION_GROUPS.map(([g, keys]) => {
    const slots = keys.map((k) => D.shop.slots.find((x) => x.key === k)).filter(Boolean);
    const n = new Set(slots.flatMap((sl) => motionsIn(sl))).size;
    return `<details class="mgroup" data-mgroup="${g}" ${mgroupOpen.has(g) ? 'open' : ''}>
      <summary><b>${t('mgroup.' + g)}</b><span class="muted small">${t('mgroup.sub.' + g)}</span><span class="mtag">${t('mgroup.count', { s: slots.length, n })}</span></summary>
      <div class="mcards">${slots.map(motionCard).join('')}</div>
    </details>`;
  }).join('');
}

// 끌어다 놓는 모션 편집 창.
//  위: 미리보기(마우스를 올린 모션을 크게) · 고른 모션 칸(여기로 끌어다 놓는다)
//  아래: 권장 모션 → 다른 모션. 2.0.0 부터 모션은 모두 열려 있다 (산 것 · 잠긴 것이 없다)
//  끌어다 놓기 말고 눌러도 넣고 뺄 수 있다. 저장을 눌러야 적용된다
function openMotionEditor(slotKey) {
  const sl = D.shop.slots.find((x) => x.key === slotKey);
  if (!sl) return;
  let picked = motionsIn(sl).slice();
  let query = '';
  const more = D.shop.motion;
  const BASIC = new Set(['type', 'curl', 'wait', 'happy', 'levelup', 'wave']);
  // 이 자리에 끼울 수 있는 것 전부: 이 자리의 기본 모션 + 다른 기본 모션(기본 자세 빼고) + 나머지 모션
  const freeAll = [...new Set(D.shop.slots.flatMap((x) => x.free))].filter((k) => !BASIC.has(k));
  const all = [...new Set([...sl.free, ...freeAll, ...more.map((m) => m.key)])];
  const info = (k) => {
    const m = more.find((x) => x.key === k);
    return { key: k, rec: sl.free.includes(k) || (!!m && m.slots.includes(sl.key)) };
  };
  const rec = all.map(info).filter((x) => x.rec);
  const others = all.map(info).filter((x) => !x.rec);

  const chip = (x, where) => `<div class="mchip ${where === 'pool' && picked.includes(x.key) ? 'picked' : ''}" data-k="${x.key}" data-where="${where}" draggable="true">
      ${where === 'sel' ? icon('check', 11) : ''}<span>${esc(t('motion.' + x.key))}</span>
      ${where === 'sel' && sl.multi ? '<i class="mx">×</i>' : ''}</div>`;
  const match = (x) => !query || t('motion.' + x.key).toLowerCase().includes(query);

  const el = openModal(
    `<div class="modal-top"><h2>${t('slot.' + sl.key)}</h2><button class="btn ghost small" data-close>${t('modal.close')}</button></div>
    <p class="muted medit-sub">${t('slot.' + sl.key + 'Sub')}<br>${sl.multi ? t('mot.hintMany') : t('mot.hintOne')}</p>
    <div class="medit-top">
      <div class="medit-preview"><canvas class="pixel" id="mprev"></canvas><span id="mprev-nm"></span></div>
      <div class="mzone-wrap"><div class="mzone-lbl">${t('mot.selected')}</div><div class="mzone" id="mz-sel"></div></div>
    </div>
    <input type="text" id="msearch" class="msearch" placeholder="${esc(t('mot.search'))}" autocomplete="off" spellcheck="false">
    <div class="mpool" id="mz-pool"></div>
    <div class="modal-foot"><button class="btn ghost" data-close>${t('mot.cancel')}</button><button class="btn primary" id="msave">${t('mot.save')}</button></div>`,
    'modal-motion',
  );

  // 미리보기 캔버스 하나를 모션만 갈아 끼우며 쓴다
  const prevCanvas = $('#mprev', el);
  let prev = null;
  const preview = (k) => {
    if (prev && prev.key === k) return;
    minis = minis.filter((m) => m !== (prev && prev.r));
    prevCanvas.dataset.stage = stageNow();
    prevCanvas.dataset.acc = D.settings.accessory || 'none';
    delete prevCanvas.dataset.motion;
    delete prevCanvas.dataset.mood;
    if (PEEK_MOOD[k]) prevCanvas.dataset.mood = PEEK_MOOD[k];
    else prevCanvas.dataset.motion = k;
    const r = mini(prevCanvas);
    if (r.demo) r.play(r.demo);
    minis.push(r);
    prev = { key: k, r };
    $('#mprev-nm', el).textContent = t('motion.' + k);
  };

  const add = (k) => {
    if (sl.multi) {
      if (!picked.includes(k)) picked.push(k);
    } else picked = [k];
    preview(k);
    draw();
  };
  const remove = (k) => {
    if (!sl.multi) return; // 하나만 고르는 자리는 빼지 않고 다른 걸 놓아서 바꾼다
    if (picked.length <= 1 && sl.key !== 'idle') return toast(t('mot.needOne'), 'bang');
    picked = picked.filter((x) => x !== k);
    draw();
  };

  function draw() {
    $('#mz-sel', el).innerHTML = picked.length
      ? picked.map((k) => chip(info(k), 'sel')).join('')
      : `<span class="mzone-empty">${t('mot.drop')}</span>`;
    const sec = (title, list) => {
      const shown = list.filter(match);
      return shown.length ? `<div class="mpool-lbl">${title}</div><div class="mpool-row">${shown.map((x) => chip(x, 'pool')).join('')}</div>` : '';
    };
    $('#mz-pool', el).innerHTML = sec(t('mot.rec'), rec) + sec(t('mot.other'), others) || `<p class="muted">${t('mot.noMatch')}</p>`;
    bindChips();
  }

  function bindChips() {
    $$('.mchip', el).forEach((c) => {
      const k = c.dataset.k;
      c.addEventListener('mouseenter', () => preview(k));
      c.addEventListener('click', (e) => {
        if (c.dataset.where === 'sel') remove(k);
        else if (sl.multi && picked.includes(k)) remove(k);
        else add(k);
        e.stopPropagation();
      });
      c.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ k, from: c.dataset.where }));
        e.dataTransfer.effectAllowed = 'move';
        c.classList.add('dragging');
        preview(k);
      });
      c.addEventListener('dragend', () => c.classList.remove('dragging'));
    });
  }

  // 놓는 곳: 고른 모션 칸에 놓으면 넣고, 목록 쪽에 놓으면 뺀다
  const zone = (id, onDrop) => {
    const z = $(id, el);
    z.addEventListener('dragover', (e) => {
      e.preventDefault();
      z.classList.add('over');
    });
    z.addEventListener('dragleave', () => z.classList.remove('over'));
    z.addEventListener('drop', (e) => {
      e.preventDefault();
      z.classList.remove('over');
      try {
        onDrop(JSON.parse(e.dataTransfer.getData('text/plain')));
      } catch {
        // 모르는 걸 끌어왔다
      }
    });
  };
  zone('#mz-sel', (d) => d.from === 'pool' && add(d.k));
  zone('#mz-pool', (d) => d.from === 'sel' && remove(d.k));

  $('#msearch', el).addEventListener('input', (e) => {
    query = e.target.value.trim().toLowerCase();
    draw();
  });

  $('#msave', el).addEventListener('click', async () => {
    const before = motionsIn(sl);
    const patch = !sl.multi ? { motions: { [sl.key]: picked[0] } } : sl.key === 'idle' ? { idleMotions: picked } : { motions: { [sl.key]: picked } };
    await apply(await pet.set(patch));
    // 새로 넣은 모션은 바탕화면 고양이와 여기 고양이가 한 번 해 보인다
    const added = picked.find((k) => !before.includes(k));
    if (added) {
      pet.preview(added);
      hero.play(added);
    }
    closeModal();
    toast(t('toast.motionsSaved', { slot: t('slot.' + sl.key) }), 'check');
    const y = $('#view').scrollTop;
    renderView();
    $('#view').scrollTop = y;
  });

  draw();
  preview(picked[0] || rec[0].key);
}

// ---------- 모션 미리보기 창 ----------
// 설정의 모션 칩을 우클릭하면 마우스 옆에 뜬다. 바깥을 누르거나 Esc·스크롤하면 닫힌다.
// type·curl·wait 는 모션이 아니라 기분 자세라서 그 기분으로 보여 준다
const PEEK_MOOD = { type: 'thinking', curl: 'sleeping', wait: 'waiting' };
let peek = null;

function showMotionPeek(el, e) {
  closeMotionPeek();
  const key = el.dataset.motionKey;
  const stage = D.growth ? D.growth.stageKey : 'cat';
  const mood = PEEK_MOOD[key];
  const state = el.dataset.locked ? t('set.peekLocked') : el.classList.contains('on') ? t('set.peekOn') : t('set.peekOff');
  const box = document.createElement('div');
  box.className = 'motion-peek';
  box.innerHTML = `<canvas class="pixel" data-stage="${stage}" data-acc="${esc(D.settings.accessory || 'none')}" ${mood ? `data-mood="${mood}"` : `data-motion="${key}"`}></canvas>
    <div class="nm">${esc(t('motion.' + key))}</div>
    <div class="st">${state}</div>`;
  document.body.appendChild(box);
  const r = box.getBoundingClientRect();
  box.style.left = `${Math.max(8, Math.min(window.innerWidth - r.width - 8, e.clientX + 14))}px`;
  box.style.top = `${Math.max(8, Math.min(window.innerHeight - r.height - 8, e.clientY + 14))}px`;
  const m = mini(box.querySelector('canvas'));
  if (m.demo) m.play(m.demo);
  minis.push(m);
  peek = { box, m };
}

function closeMotionPeek() {
  if (!peek) return;
  peek.box.remove();
  minis = minis.filter((x) => x !== peek.m);
  peek = null;
}

// 상점의 장난감 카드를 우클릭하면 고양이가 그 장난감을 갖고 노는 모습을 보여 준다.
// 장난감마다 놀이 자세(toys.js)를 차례로 돌린다. 'carry' 는 쥐돌이를 물고 총총
const TOY_PEEK = {
  // 4차 장난감 (자세는 toys.js)
  sunbeam: ['toyBask', 'toyBelly', 'toySunNap'],
  quilt: ['toyCrouch', 'toyWiggle', 'pounce', 'toyTrap'],
  fishbowl: ['toyStare', 'toyPawDip', 'toyWet'],
  shellgame: ['toyWatch', 'toyYay', 'toyBlep'],
  volley: ['toyWatch', 'toyLeap', 'toyYay'],
  simon: ['toyLeap', 'toyWatch', 'toyYay'],
  ball: ['toyWiggle', 'pounce', 'toyBat'],
  jingle: ['pounce', 'toyBat', 'toyWiggle'],
  yarn: ['toyYarn', 'toyTangle'],
  catnip: ['toyKick', 'toyHigh'],
  windup: ['toyWiggle', 'toyPin'],
  wand: ['toyChatter', 'toyLeap', 'toySwipe'],
  bubbles: ['toyLeap', 'toyPop'],
  laser: ['toyWiggle', 'pounce', 'toyPeek'],
  box: ['toyBoxIn', 'toyBoxHide', 'toyBoxPeek', 'toyBoxCozy'],
  bag: ['toyBagIn', 'toyBag', 'toyBagPeek'],
  scratcher: ['toyScratch', 'toyScratchLoaf'],
  // 2차 장난감
  grenade: ['toyBat', 'toyBlown', 'toySoot'],
  squirtgun: ['toyChatter', 'toyWet', 'toySulk'],
  balloon: ['toyLeap', 'toySwipe', 'startle'],
  yoyo: ['toyChatter', 'toySwipe'],
  cup: ['toyDeadpan', 'toySwipe', 'toyDeadpan'],
  bananapeel: ['toySlip', 'toyPretend'],
  catwheel: ['toyWheel', 'toySlip', 'toyDizzy'],
  vacuum: ['toyHide', 'toyPeek', 'toyHiss', 'toyRide'],
  boxtower: ['toyLeap', 'toyPerch', 'toyKing'],
  magichat: ['toyWatch', 'pounce', 'toyProud', 'toyAchoo'],
  slotmachine: ['toyWatch', 'toyYay', 'toyWatch', 'toyPunch'],
  snowball: ['toySnowman', 'toyBat'],
  rccar: ['toyWiggle', 'pounce', 'toySitOn', 'toyRide'],
  ufotoy: ['toyFloat', 'toyLeap'],
  ballshooter: ['pounce', 'toyBat', 'pounce'],
  jumprope: ['toyLeap', 'toyLeap', 'toyTrip'],
  catlaptop: ['toyLaptopNap', 'toyTypeFast'],
  // 함께 하는 놀이
  whackcat: ['toyPeek', 'toyDizzy'],
  rps: ['toyWatch', 'toyYay', 'toySulk'],
  domino: ['toyWatch', 'toySwipe', 'toyYay'],
  tugrope: ['toyChatter', 'toyYay'],
  trampoline: ['toyLeap', 'toyLeap', 'toyYay'],
};
// 고양이가 직접 그리는 큰 장난감은 따로 아이콘을 띄우지 않는다
const TOY_DRAWN = new Set(['box', 'bag', 'scratcher', 'yarn', 'catnip', 'catwheel', 'catlaptop']);

// 함께 하는 놀이 카드에 붙는 것: 최고 기록, 줄다리기 난이도 (가진 것만)
const TOY_RECORD = { whackcat: 'whackcat', rps: 'rps', trampoline: 'trampoline', jumprope: 'jumprope', quilt: 'quilt', shellgame: 'shellgame', volley: 'volley', simon: 'simon' };
// 장난감 카드 정보 칸: 하는 일 태그 + 기록·난이도. [옵시디언] 기록·난이도 줄이 붙으면 태그는 한 줄만 (tags-1, house.css)
function toyTags(it, inShop = false) {
  const extra = toyExtra(it, inShop);
  return `<div class="tags${extra ? ' tags-1' : ''}"><span>${esc(t('toyDo.' + it.key))}</span></div>${extra}`;
}
// inShop: 상점 카드에서는 줄다리기 난이도 버튼을 빼고 기록만 (카드 규격을 맞추려고. 난이도는 인벤토리 카드에서 고른다)
function toyExtra(it, inShop = false) {
  if (!it.owned) return '';
  const rec = TOY_RECORD[it.key];
  const n = rec ? (D.toyRecords || {})[rec] || 0 : 0;
  let s = n ? `<div class="toy-rec">${icon('trophy', 11)}${esc(t('game.rec.' + it.key, { n }))}</div>` : '';
  if (it.key === 'tugrope' && !inShop) {
    const lv = D.settings.tugLevel || 'mid';
    s += `<div class="tug-lv" title="${esc(t('game.tugLevel'))}">${['easy', 'mid', 'hard'].map((k) => `<button class="${k === lv ? 'on' : ''}" data-tug-lv="${k}">${t('game.tugLv.' + k)}</button>`).join('')}</div>`;
  }
  return s;
}

function showToyPeek(key, e) {
  closeMotionPeek();
  const stage = D.growth ? D.growth.stageKey : 'cat';
  const box = document.createElement('div');
  box.className = 'motion-peek toy-peek';
  box.innerHTML = `<div class="stagebox"><canvas class="pixel" data-stage="${stage}" data-acc="${esc(D.settings.accessory || 'none')}"></canvas>${TOY_DRAWN.has(key) ? '' : `<span class="toyart">${icon(key, 34)}</span>`}</div>
    <div class="nm">${esc(t('item.' + key))}</div>
    <div class="st">${esc(t('toyHow.' + key))}</div>`;
  document.body.appendChild(box);
  const r = box.getBoundingClientRect();
  box.style.left = `${Math.max(8, Math.min(window.innerWidth - r.width - 8, e.clientX + 14))}px`;
  box.style.top = `${Math.max(8, Math.min(window.innerHeight - r.height - 8, e.clientY + 14))}px`;
  const m = mini(box.querySelector('canvas'));
  m.seq = TOY_PEEK[key] || ['pounce'];
  m.seqAt = 0;
  minis.push(m);
  peek = { box, m };
}

// 장난감 미리보기: 동작이 끝나면 다음 자세로
function stepToySeq(m) {
  if (m.action && !(m.carryUntil && performance.now() < m.carryUntil)) return;
  if (m.carryUntil && performance.now() < m.carryUntil) return;
  if (m.carryUntil) {
    m.carryUntil = 0;
    m.carry = null;
    m.setMove(0);
  }
  const k = m.seq[m.seqAt++ % m.seq.length];
  if (k === 'carry') {
    m.carry = 'mouse';
    m.setMove(40);
    m.carryUntil = performance.now() + 1800;
    return;
  }
  m.play(k, { times: 1 });
}

document.addEventListener('mousedown', (e) => peek && !peek.box.contains(e.target) && closeMotionPeek());
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeMotionPeek());
document.addEventListener('scroll', closeMotionPeek, true);

function animate() {
  const off = offscreen();
  if (!off) {
    hero.frame();
    for (const m of minis) {
      if (m.seq) stepToySeq(m);
      // 미리보기 모션은 끝나면 잠깐 쉬었다가 다시 한다
      if (m.demo && !m.action && (m.demoGap += 1) > 12) {
        m.demoGap = 0;
        m.play(m.demo);
      }
      m.frame();
    }
  }
  setTimeout(animate, off ? 250 : 70);
}

// 7차 업적 카드의 한 줄 팁 ("이런 기능이 있었구나"). 팁이 없는 업적은 비운다
function achTip(id) {
  const key = 'ach.' + id + '.tip';
  const v = t(key);
  return v && v !== key ? `<div class="ach-tip">${icon('bulb', 11)}<span>${esc(v)}</span></div>` : '';
}

// ---------- 털색 고르기 ----------
// 레벨이 닿은 털색만 고를 수 있다. 잠긴 건 '레벨 N에 열려요'
function openFurPicker() {
  const lv = D.growth ? D.growth.level : 1;
  const now = D.settings.fur || 'cheese';
  const stage = D.growth ? D.growth.stageKey : 'cat';
  const cells = (D.furs || [])
    .map((f) => {
      // 별 전용 털색은 별 상점에서 산 것만 (8차)
      const starRow = f.stars ? (D.shop.star || []).find((x) => x.key === 'fur_' + f.key) : null;
      const open = f.stars ? !!(starRow && starRow.owned) : lv >= f.level || D.settings.devMode;
      return `<button class="fur-cell ${f.key === now ? 'on' : ''} ${open ? '' : 'locked'}" ${open ? `data-fur-pick="${f.key}"` : 'disabled'}>
        <span class="fur-view"><canvas class="pixel" data-stage="${stage}" data-acc="none" data-furkey="${f.key}"></canvas></span>
        <span class="nm">${esc(t('fur.' + f.key))}</span>
        <span class="lv">${f.key === now ? t('ward.wearing') : open ? '' : f.stars ? icon('star', 10) + t('ward.furStar', { n: f.stars }) : icon('lock', 10) + t('ward.furLocked', { n: f.level })}</span>
      </button>`;
    })
    .join('');
  const el = openModal(
    `<div class="modal-top"><h2>${t('ward.fur')}</h2><button class="btn ghost small" data-close>${t('modal.close')}</button></div>
    <p class="muted" style="margin-top:-4px">${t('ward.furSub')}</p>
    <div class="fur-grid">${cells}</div>`,
    'fur-modal',
  );
  minis.push(...$$('canvas[data-stage]', el).map(mini));
  $$('[data-fur-pick]', el).forEach((b) =>
    b.addEventListener('click', async () => {
      await apply(await pet.set({ fur: b.dataset.furPick }));
      closeModal();
      renderView();
      toast(t('toast.saved'));
    }),
  );
}

// ---------- 귀 모양 고르기 (2026-10-10) ----------
// 레벨과 상관없이 13가지가 다 열려 있다. 첫 실행 안내(이름 짓기)와 옷장이 같은 칸을 쓴다
function earCells(now) {
  const stage = D.growth ? D.growth.stageKey : 'cat';
  return PetSprite.EAR_KEYS.map(
    (k) => `<button class="fur-cell ${k === now ? 'on' : ''}" data-ear-pick="${k}">
        <span class="fur-view"><canvas class="pixel" data-stage="${stage}" data-acc="none" data-ears="${k}"></canvas></span>
        <span class="nm">${esc(t('ear.' + k))}</span>
      </button>`,
  ).join('');
}
function openEarPicker() {
  const el = openModal(
    `<div class="modal-top"><h2>${t('ward.ears')}</h2><button class="btn ghost small" data-close>${t('modal.close')}</button></div>
    <p class="muted" style="margin-top:-4px">${t('ward.earsSub')}</p>
    <div class="fur-grid">${earCells(D.settings.ears || 'perk')}</div>`,
    'fur-modal',
  );
  minis.push(...$$('canvas[data-stage]', el).map(mini));
  $$('[data-ear-pick]', el).forEach((b) =>
    b.addEventListener('click', async () => {
      await apply(await pet.set({ ears: b.dataset.earPick }));
      closeModal();
      renderView();
      toast(t('toast.saved'));
    }),
  );
}

// ---------- 세트 전용 모션 ----------
// 세트 카드에 붙는 버튼. 전용 모션이 있는 세트만
function setMoBtn(key) {
  const list = D.shop.setMotions && D.shop.setMotions[key];
  return list && list.length ? `<button class="btn ghost small setmo" data-setmo="${key}">${icon('sparkle', 11)}${t('shop.setMotions')}</button>` : '';
}
// 그 세트를 입은 고양이가 전용 모션 셋을 차례로 해 보인다
function openSetMotions(key) {
  const list = (D.shop.setMotions && D.shop.setMotions[key]) || [];
  const stage = D.growth ? D.growth.stageKey : 'cat';
  // 레벨이 모자라 잠긴 세트는 상점 카드처럼 모션도 그림자로만 (가진 건 가진 것)
  const it = (D.shop.acc || []).find((x) => x.key === key);
  const locked = !!it && it.locked && !it.owned;
  const cells = list
    .map((m) => `<div class="setmo-cell ${locked ? 'locked' : ''}"><canvas class="pixel" data-stage="${stage}" data-acc="${key}" data-motion="${m}"></canvas><div class="nm">${esc(t('motion.' + m))}</div></div>`)
    .join('');
  const el = openModal(
    `<div class="modal-top"><h2>${esc(t('item.' + key))} · ${t('shop.setMotions')}</h2><button class="btn ghost small" data-close>${t('modal.close')}</button></div>
    <p class="muted" style="margin-top:-4px">${locked ? `${icon('lock', 11)}${t('shop.needLevel', { n: it.level })} · ` : ''}${t('shop.setMotionsSub')}</p>
    <div class="setmo-grid">${cells}</div>`,
    'setmo-modal',
  );
  minis.push(...$$('canvas[data-stage]', el).map(mini));
}

// ---------- 장난감 사용법 ----------
// 예전엔 기본 고양이가 갖고 노는 장면을 움직여 보여 줬다(시연). 2026-09-24 부터 글로만 설명한다:
// 꺼내는 법 · 노는 법(toyHow) · 고양이 반응(toyDo) · 끝내는 법. 보고 바로 살 수도 있다
function openToyDemo(key) {
  // 산 거나 못 사는 건 버튼 대신 카드와 같은 안내
  const it = D.shop.toy.find((x) => x.key === key);
  const buyRow = !it
    ? ''
    : it.owned
      ? `<span class="own">${t('shop.owned')}</span>`
      : it.locked
        ? `<span class="muted">${t('shop.needLevel', { n: it.level })}</span>`
        : it.blocker === 'coins'
          ? `<span class="muted">${t('shop.needCoins')}</span>`
          : `<button class="btn primary" id="toy-buy">${D.shop.dev ? icon('coin', 13) + t('shop.free') : coins(it.price, 13)} · ${t('shop.buy')}</button>`;
  const step = (ic, title, body) => `<li>${icon(ic, 16)}<div><b>${title}</b><p>${esc(body)}</p></div></li>`;
  const el = openModal(
    `<div class="modal-top"><h2>${esc(t('item.' + key))} · ${t('shop.guide')}</h2><button class="btn ghost small" data-close>${t('modal.close')}</button></div>
    <div class="toy-guide-head">${icon(key, 48)}<p class="muted">${esc(t('toyDo.' + key))}</p></div>
    <ol class="toy-guide">
      ${step('paw', t('guide.take'), t('guide.takeBody'))}
      ${step('sparkle', t('guide.play'), t('toyHow.' + key))}
      ${step('check', t('guide.stop'), t('guide.stopBody'))}
    </ol>
    ${buyRow ? `<div class="modal-foot">${buyRow}</div>` : ''}`,
    'toy-modal',
  );
  // 사기는 상점 카드의 '사기' 버튼을 그대로 누른다 (살 때 하는 일·알림을 한 군데서만)
  const tb = $('#toy-buy', el);
  if (tb)
    tb.onclick = () => {
      closeModal();
      const b = $(`#view [data-buy="${key}"]`);
      if (b) b.click();
    };
}

// ---------- 공통 ----------

// 레벨이 올라 새로 살 수 있게 된 상점 물건 (코스튬·모션·장난감). 상점 탭 빨간 점 · 카드의 NEW · '새로 열림' 칩이 쓴다.
// 해금 알림은 말풍선 없이 이것만 한다. 처음 켰을 때는 이미 열려 있던 것을 다 본 걸로 친다 (한꺼번에 NEW 가 뜨지 않게)
let seenUnlocks = null;
try {
  const raw = window.KC_STORE.get('seenUnlocks');
  if (raw) seenUnlocks = new Set(JSON.parse(raw));
} catch {
  // 저장소를 못 쓰면 켤 때마다 지금 열린 것부터 센다
}
function saveUnlocks() {
  try {
    window.KC_STORE.set('seenUnlocks', JSON.stringify([...seenUnlocks]));
  } catch {
    // 무시
  }
}
function newUnlocks() {
  if (!D || !D.shop) return [];
  const open = [...D.shop.acc, ...D.shop.toy].filter((x) => x.level && !x.locked && !x.owned);
  if (!seenUnlocks) {
    seenUnlocks = new Set(open.map((x) => x.key));
    saveUnlocks();
  }
  return open.filter((x) => !seenUnlocks.has(x.key));
}
function markUnlocksSeen(keys) {
  if (!keys.length) return;
  for (const k of keys) seenUnlocks.add(k);
  saveUnlocks();
  $('#dot-shop').hidden = !newUnlocks().length;
}

let seenItems = new Set();
try {
  seenItems = new Set(JSON.parse(window.KC_STORE.get('seenItems') || '[]'));
} catch {
  // 저장소를 못 쓰면 매번 새로 본다
}
function markItemsSeen() {
  for (const it of D.game.items) if (it.unlocked) seenItems.add(it.key);
  try {
    window.KC_STORE.set('seenItems', JSON.stringify([...seenItems]));
  } catch {
    // 무시
  }
  renderTop();
}

// 아래쪽 알림. 저절로 사라지거나 누르면 바로 스르륵 사라진다
function toast(text, name) {
  const el = $('#toast');
  el.innerHTML = (name ? icon(PixelArt.has(name) ? name : 'gift', 15) : '') + `<span>${esc(text)}</span>`;
  clearTimeout(toast.t);
  clearTimeout(toast.t2);
  el.classList.remove('out');
  el.hidden = false;
  toast.t = setTimeout(hideToast, 2200);
}
function hideToast() {
  const el = $('#toast');
  if (el.hidden || el.classList.contains('out')) return;
  clearTimeout(toast.t);
  el.classList.add('out');
  toast.t2 = setTimeout(() => {
    el.hidden = true;
    el.classList.remove('out');
  }, 320);
}
$('#toast').addEventListener('click', hideToast);

// 앱 테마 (데스크톱판 8차 후속): auto = 어두우면 코코아, 아니면 크림. 색은 house.css 의 토큰.
// [옵시디언] auto 는 옵시디언 테마의 밝기를 따른다 (plugin/frame.js 가 <html> 에 theme-dark · theme-light 를 단다)
const THEMES = ['auto', 'cream', 'cocoa', 'mint', 'sakura', 'choco'];
const THEME_SWATCH = { cream: ['#faf6ef', '#d97757'], cocoa: ['#1e1814', '#d97757'], mint: ['#eef7f2', '#2f9e7e'], sakura: ['#fdf2f4', '#e0708c'], choco: ['#f3e7da', '#8b4f2c'] };
const darkMq = matchMedia('(prefers-color-scheme: dark)');
const themeOf = (k) => (THEMES.includes(k) ? k : 'auto');
function applyTheme() {
  const k = themeOf(D && D.settings.theme);
  const dark = window.KC_OBSIDIAN ? document.documentElement.classList.contains('theme-dark') : darkMq.matches;
  const eff = k === 'auto' ? (dark ? 'cocoa' : 'cream') : k;
  document.documentElement.dataset.theme = eff;
  document.documentElement.classList.toggle('dark', eff === 'cocoa');
}
darkMq.addEventListener('change', () => D && applyTheme());
// [옵시디언] 옵시디언 테마를 바꾸면 frame.js 가 <html> 의 theme-dark 를 바꾼다. 그때 다시 칠한다
if (window.KC_OBSIDIAN && window.MutationObserver) {
  let wasDark = document.documentElement.classList.contains('theme-dark');
  new MutationObserver(() => {
    const now = document.documentElement.classList.contains('theme-dark');
    if (now === wasDark) return;
    wasDark = now;
    if (D) applyTheme();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

function renderTop() {
  const g = D.growth;
  const s = D.settings;
  applyTheme();
  T.set(s.language, s.personality);
  document.documentElement.lang = T.locale;
  document.title = t('top.title', { name: s.petName });
  $('#h-name').textContent = s.petName;
  hero.setAccessory(s.accessory);
  hero.setFur(s.fur);
  hero.setEars(s.ears);
  hero.setMood(D.mood);
  hero.setMoodMotions(D.motion ? D.motion.mood : {});
  if (g) {
    hero.setStage(g.stageKey);
    // 만렙(Lv80) 뒤 별: 레벨 옆에 별 도트와 개수 (main/growth.js 의 stars · starNext · maxed)
    const stars = Number(g.stars) > 0 ? Math.floor(Number(g.stars)) : 0;
    $('#h-lv').innerHTML =
      esc(oneStage() ? `Lv.${g.level}` : `Lv.${g.level} · ${stageName(g.stageKey)}`) +
      (stars ? ` <span class="lv-stars" title="${esc(t('top.stars', { n: stars }))}">${icon('star', 11)}${stars}</span>` : '');
    // 만렙이면 levelFloor~levelCeil 이 다음 별까지의 구간이라 막대는 그대로 그리면 된다
    const into = g.xp - g.levelFloor;
    const need = g.levelCeil - g.levelFloor;
    $('#h-xpbar').style.width = `${need > 0 ? (into / need) * 100 : 100}%`;
    $('#h-xptext').textContent = `${fmt(into)} / ${fmt(need)} XP`;
    if (g.maxed) $('.xp').title = t('top.starTip', { left: fmt(g.starNext), n: stars });
    else $('.xp').removeAttribute('title');
  } else {
    $('#h-lv').textContent = '';
    $('#h-xptext').textContent = t('top.reading');
  }
  // 지금 상태 (2.0.0: 그날의 기분 딱지는 없앴다)
  $('#h-mood').innerHTML =
    (D.quiet ? icon('bellOff', 13) + `<span>${esc(t('mood.quiet'))}</span>` : '') +
    icon(MOOD_ICON[D.mood] || 'leaf', 13) +
    `<span>${esc(t('mood.' + D.mood))}</span>`;
  const st = D.game.streak;
  // 개발자 모드 버튼. 배포 전에 house.html 의 #dev 와 함께 지운다
  $('#dev').classList.toggle('on', !!s.devMode);
  $('#dev').textContent = s.devMode ? t('dev.on') : t('dev.off');
  $('#dev').title = t('dev.title');
  $('#dev').hidden = !!D.release; // 배포판에는 버튼 자체가 없다
  $('#h-streak').innerHTML = t('top.streak', { n: icon('fire', 17) + st.current });
  $('#h-streak').title = t('top.streakTitle');

  const q = D.game.quests;
  const done = q.filter((x) => x.done).length;
  // [옵시디언] 사이드바처럼 좁을 때는 탭 이름을 숨기므로, 마우스를 올리면 이름이 보이게
  for (const b of $$('#tabs button')) {
    $('.tx', b).textContent = t('tab.' + b.dataset.tab);
    b.title = t('tab.' + b.dataset.tab);
  }
  $('#dot-wardrobe').hidden = !D.game.items.some((it) => it.unlocked && !seenItems.has(it.key));
  $('#dot-shop').hidden = !newUnlocks().length;
  $$('#tabs button').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === tab);
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    b.tabIndex = b.dataset.tab === tab ? 0 : -1;
    if (b.dataset.tab === tab) $('#view').setAttribute('aria-label', $('.tx', b).textContent);
    // 영어처럼 글이 길어지면 탭 줄이 넘치니, 고른 탭은 항상 보이게 끌어온다
    if (b.dataset.tab === tab) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}

// ---------- 탭 ----------

// 배부름 게이지. 벌이 아니라 덤 (core/gauge.js)
const gaugeRow = (key, v, ic) =>
  `<div class="gauge ${v < 25 ? 'low' : ''}"><span class="gl">${icon(ic, 16)}${t('gauge.' + key)}</span><div class="bar"><i style="width:${v}%"></i></div><b>${v}</b></div>`;
const gaugeNote = (g) => (g.full ? t('gauge.fullNote') : g.food < 25 ? t('gauge.hungryNote') : t('gauge.okNote'));
function gaugePanel() {
  const g = D.gauge || { food: 100, full: true };
  const row = gaugeRow;
  const note = gaugeNote(g);
  // 배고프면 여기서 바로 밥을 준다 (창고에 밥이 없으면 act('feed') 가 상점 밥 페이지로 보낸다)
  return `<div class="h2-row"><h2>${t('gauge.title')}</h2><button class="btn head-act ${g.food < 50 ? 'alert' : ''}" data-act="feed">${icon('ricebowl', 12)}${t('home.feed')}</button></div>
      <div class="panel">${row('food', g.food, 'ricebowl')}<p class="muted gauge-note">${g.full ? icon('sparkle', 12) + ' ' : ''}${note}</p></div>`;
}

// [옵시디언 1.5.0] 오늘의 목표 + 집중 시간 (호스트의 D.goal · D.focus = core/goals.js)
// 2.0.1: 한 장짜리 카드로 다시 짰다. 위는 오늘 쓴 양(큰 숫자 · 얇은 막대 · 남은 양 · 최근 7일 · 연속),
// 아래는 집중 타이머 한 줄(길이 고르기 · 시작 → 남은 시간 · 막대 → 마친 뒤 쉬기 제안 → 쉬는 중)
const focusLeft = (end) => {
  const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const spanPct = (start, end) => Math.max(0, Math.min(100, ((Date.now() - start) / Math.max(1, end - start)) * 100));
const BREAK_OFFER_MS = 30 * 60_000; // 집중을 마친 뒤 이만큼은 '잠깐 쉴까요?' 를 보여 준다
function focusRow() {
  const f = D.focus || { on: false, min: 25 };
  const tot = f.total || {};
  // 진행 중 (집중 · 쉬기): 큰 남은 시간 + 지난 만큼 차는 막대
  const running = (ic, cls, start, end, label, btns) => `<div class="fz on ${cls}">
      <span class="fz-ic">${icon(ic, 15)}</span>
      <div class="fz-main"><div class="fz-top"><b class="fz-time" data-left="${end}">${focusLeft(end)}</b><span class="muted small">${label}</span></div>
      <div class="fz-bar"><i data-span="${start}|${end}" style="width:${spanPct(start, end)}%"></i></div></div>
      <div class="fz-btns">${btns}</div></div>`;
  if (f.on) return running('hourglass', '', f.start, f.end, esc(t('home.focusRunning', { m: f.min })), `<button class="btn ghost small" data-act="focusStop">${t('home.focusStop')}</button>`);
  if (f.brk)
    return running('pillow', 'brk', f.brk.end - f.brk.min * 60_000, f.brk.end, esc(t('home.breakRunning', { m: f.brk.min })),
      `<button class="btn primary small" data-act="focusStart">${t('home.focusAgain')}</button><button class="btn ghost small" data-act="breakStop">${t('home.breakStop')}</button>`);
  const seg = (f.lengths || [15, 25, 50]).map((m) => `<button class="${m === f.min ? 'on' : ''}" data-focus-min="${m}" aria-pressed="${m === f.min}">${t('home.focusMin', { m })}</button>`).join('');
  const sub = tot.today ? t('home.focusToday', { n: fmt(tot.today), m: fmt(tot.todayMin || 0) }) : t('home.focusSub', { coins: fmt(f.min * 2) });
  const offer = tot.lastAt && Date.now() - tot.lastAt < BREAK_OFFER_MS
    ? `<div class="fz-offer"><span>${icon('pillow', 12)}${t('home.breakAsk')}</span>${(f.breaks || [5, 10]).map((m) => `<button class="btn ghost small" data-act="breakStart" data-min="${m}">${t('home.breakBtn', { m })}</button>`).join('')}</div>`
    : '';
  return `<div class="fz">
      <span class="fz-ic">${icon('hourglass', 15)}</span>
      <div class="fz-main"><div class="fz-top"><b>${t('home.focusLabel')}</b></div><span class="muted small">${esc(sub)}</span></div>
      <div class="fz-btns"><div class="seg-mini" role="group" aria-label="${esc(t('focus.setLen'))}">${seg}</div><button class="btn primary small" data-act="focusStart">${icon('hourglass', 11)}${t('home.focusGo')}</button></div>
    </div>${offer}`;
}
function goalPanel() {
  const g = D.goal;
  const edit = `<button class="btn head-act" data-act="goalEdit">${icon('gear', 12)}${t(g && g.on ? 'home.goalEdit' : 'home.goalSet')}</button>`;
  let top = '';
  if (g && !g.on) top = `<p class="muted small gc-off">${t('home.goalOffDesc', { coins: fmt(g.coins) })}</p>`;
  else if (g) {
    const W = g.unit === 'words' ? 'W' : 'C';
    const pct = Math.round(g.pct * 100);
    const week = g.week.map((d, i) => `<i class="${d.done ? 'on' : ''} ${i === g.week.length - 1 ? 'today' : ''}"></i>`).join('');
    const streak = g.current ? `<span class="gc-streak">${icon('fire', 11)}${t('home.goalStreak', { d: g.current })}</span>` : g.best ? `<span class="muted">${t('home.goalBest', { d: g.best })}</span>` : '';
    top = `<div class="gc ${g.done ? 'done' : ''}">
        <div class="gc-row"><div class="gc-v"><b>${fmt(g.value)}</b><span>${t('home.goalSlash' + W, { target: fmt(g.target) })}</span></div>
          <span class="gc-pct">${g.done ? icon('check', 13) + t('home.goalDoneShort') : pct + '%'}</span></div>
        <div class="gc-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
        <div class="gc-meta"><span>${g.done ? t('home.goalDone', { coins: fmt(g.coins) }) : t('home.goalLeft' + W, { n: fmt(g.left) })}</span>
          <span class="gc-week" title="${esc(t('home.goalWeek'))}"><span class="dots" aria-hidden="true">${week}</span>${streak}</span></div>
      </div>`;
  }
  return homeSec('goal', t('home.goalTitle'), edit, `<div class="panel goal-card">${top}${top ? '<div class="gc-sep"></div>' : ''}${focusRow()}</div>`);
}
// 집중 · 쉬기 남은 시간과 막대를 1초마다 (호스트는 끝 시각만 준다)
setInterval(() => {
  for (const el of $$('[data-left]')) el.textContent = focusLeft(Number(el.dataset.left));
  for (const el of $$('[data-span]')) {
    const [a, b] = el.dataset.span.split('|').map(Number);
    el.style.width = spanPct(a, b) + '%';
  }
}, 1000);
// ---------- 홈 (2.0.0) ----------
// 칸마다 접을 수 있다. 접은 칸은 하우스 저장소(KC_STORE)에 남는다 (기기마다)
let homeFold = new Set();
try {
  homeFold = new Set(JSON.parse(window.KC_STORE.get('homeFold') || '[]'));
} catch {
  // 저장소를 못 쓰면 다 펼친 채로
}
function toggleFold(id) {
  if (homeFold.has(id)) homeFold.delete(id);
  else homeFold.add(id);
  try {
    window.KC_STORE.set('homeFold', JSON.stringify([...homeFold]));
  } catch {
    // 무시
  }
}
// 홈 칸 순서 · 보이기 (2.0.1, 설정 homeLayout = [{ id, on }]. 없으면 기본 순서로 모두 보인다)
const HOME_SECTIONS = ['goal', 'today', 'map', 'todo', 'cat', 'quests', 'recent'];
function homeLayout() {
  const raw = Array.isArray(D.settings.homeLayout) ? D.settings.homeLayout : [];
  const out = raw.filter((x) => x && HOME_SECTIONS.includes(x.id)).map((x) => ({ id: x.id, on: x.on !== false }));
  for (const id of HOME_SECTIONS) if (!out.some((x) => x.id === id)) out.push({ id, on: true });
  return out;
}
const homeSecName = (id) =>
  ({ goal: t('home.goalTitle'), today: t('home.today'), map: t('home.mapTitle'), todo: t('todo.title'), cat: t('home.secCat', { name: D.settings.petName }), quests: t('quests.title'), recent: t('home.recentTitle') })[id];

// 홈 꾸미기 창: 끌어서 순서, 스위치로 보이기. 바꾸면 바로 저장
function openHomeLayout() {
  let list = homeLayout();
  const el = openModal(
    `<div class="modal-top"><h2>${t('home.layoutTitle')}</h2><button class="btn ghost small" data-close>${t('modal.close')}</button></div>
    <p class="muted" style="margin-top:-4px">${t('home.layoutSub')}</p>
    <ul class="hl-list" id="hl-list"></ul>
    <div class="modal-foot"><button class="btn ghost" id="hl-reset">${t('home.layoutReset')}</button><button class="btn primary" data-close>${t('wn.ok')}</button></div>`,
    'hl-modal',
  );
  const save = async () => {
    await apply(await pet.set({ homeLayout: list }));
    renderView();
  };
  const draw = () => {
    $('#hl-list', el).innerHTML = list
      .map((x, i) => `<li class="hl-row ${x.on ? '' : 'off'}" draggable="true" data-hl="${x.id}">
        <span class="grip" tabindex="0" role="button" data-hl-grip="${i}" aria-label="${esc(t('home.layoutGrip'))}" title="${esc(t('home.layoutGrip'))}">⠿</span>
        <span class="nm">${esc(homeSecName(x.id))}</span>
        <label class="switch mini"><input type="checkbox" data-hl-on="${x.id}" ${x.on ? 'checked' : ''} aria-label="${esc(homeSecName(x.id))}"><span></span></label></li>`)
      .join('');
    $$('[data-hl-on]', el).forEach((c) =>
      c.addEventListener('change', () => {
        list = list.map((x) => (x.id === c.dataset.hlOn ? { ...x, on: c.checked } : x));
        draw();
        save();
      }),
    );
    // 키보드: 손잡이에서 ↑↓
    $$('[data-hl-grip]', el).forEach((g) =>
      g.addEventListener('keydown', (e) => {
        const i = Number(g.dataset.hlGrip);
        const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
        if (to < 0 || to >= list.length) return;
        e.preventDefault();
        const [x] = list.splice(i, 1);
        list.splice(to, 0, x);
        draw();
        save();
        const n = $(`[data-hl-grip="${to}"]`, el);
        if (n) n.focus();
      }),
    );
    dragList($('#hl-list', el), '[data-hl]', (from, to) => {
      const [x] = list.splice(from, 1);
      list.splice(to, 0, x);
      draw();
      save();
    });
  };
  draw();
  $('#hl-reset', el).addEventListener('click', () => {
    list = HOME_SECTIONS.map((id) => ({ id, on: true }));
    draw();
    save();
  });
}

// 목록 끌어다 놓기 (할 일 · 홈 꾸미기). 놓을 자리에 줄이 보이고, 놓으면 onMove(원래 순번, 새 순번)
function dragList(ul, rowSel, onMove) {
  let from = -1;
  const rows = () => $$(rowSel, ul);
  const clear = () => rows().forEach((r) => r.classList.remove('drop-before', 'drop-after', 'dragging'));
  const target = (y) => {
    const list = rows();
    for (let i = 0; i < list.length; i++) {
      const r = list[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return list.length;
  };
  rows().forEach((r, i) => {
    r.addEventListener('dragstart', (e) => {
      from = i;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
      r.classList.add('dragging');
    });
    r.addEventListener('dragend', () => {
      from = -1;
      clear();
    });
  });
  ul.addEventListener('dragover', (e) => {
    if (from < 0) return;
    e.preventDefault();
    const to = target(e.clientY);
    const list = rows();
    list.forEach((r) => r.classList.remove('drop-before', 'drop-after'));
    if (to < list.length) list[to].classList.add('drop-before');
    else if (list.length) list[list.length - 1].classList.add('drop-after');
  });
  ul.addEventListener('drop', (e) => {
    if (from < 0) return;
    e.preventDefault();
    let to = target(e.clientY);
    if (to > from) to--;
    const f = from;
    from = -1;
    clear();
    if (to !== f) onMove(f, to);
  });
}

// 홈 칸 하나: 제목 줄(오른쪽에 그 칸의 버튼 + 접기) + 내용
function homeSec(id, title, acts, body) {
  const folded = homeFold.has(id);
  return `<section class="hsec ${folded ? 'folded' : ''}" id="hs-${id}">
    <div class="h2-row"><h2>${title}</h2><div class="hsec-acts">${folded ? '' : acts}<button class="btn ghost fold" data-fold="${id}" aria-expanded="${!folded}" title="${esc(t(folded ? 'home.unfold' : 'home.fold'))}">${folded ? '+' : '−'}</button></div></div>
    ${folded ? '' : body}
  </section>`;
}

// 할 일: 플러그인 안에만 있는 목록. 노트를 만들지 않는다 (core/todos.js)
let todoDoneOpen = false;
let todoEditing = null; // 고치는 중인 할 일 id
function todoPanel() {
  const T2 = D.todos || { open: [], done: [] };
  // 2.0.1: 안 끝낸 할 일은 손잡이(⠿)를 끌어 순서를 바꾼다. 손잡이에서 ↑↓ 키로도
  const row = (x, i) =>
    todoEditing === x.id
      ? `<li class="todo editing"><input type="text" class="todo-edit" data-todo-edit="${x.id}" value="${esc(x.text)}" maxlength="${T2.maxText || 200}" aria-label="${esc(t('todo.editLbl'))}"></li>`
      : `<li class="todo ${x.done ? 'done' : ''}" ${x.done ? '' : `data-todo-row="${x.id}"`}>
        ${x.done ? '' : `<span class="todo-grip" tabindex="0" role="button" data-todo-grip="${x.id}" data-i="${i}" aria-label="${esc(t('todo.dragHint'))}" title="${esc(t('todo.dragHint'))}">⠿</span>`}
        <label class="todo-check"><input type="checkbox" data-todo-toggle="${x.id}" ${x.done ? 'checked' : ''}><span class="box">${x.done ? icon('check', 11) : ''}</span></label>
        <span class="todo-t" data-todo-text="${x.id}" title="${esc(t('todo.editHint'))}">${esc(x.text)}</span>
        <span class="todo-acts"><button class="ic" data-todo-del="${x.id}" aria-label="${esc(t('todo.del'))}">×</button></span>
      </li>`;
  const open = T2.open.length ? `<ul class="todos" id="todo-open">${T2.open.map((x, i) => row(x, i)).join('')}</ul>` : `<p class="muted small todo-empty">${t('todo.empty')}</p>`;
  const done = T2.done.length
    ? `<button class="btn ghost small todo-more" data-act="todoDoneOpen">${t(todoDoneOpen ? 'todo.doneHide' : 'todo.doneShow', { n: fmt(T2.done.length) })}</button>
      ${todoDoneOpen ? `<ul class="todos done-list">${T2.done.map((x, i) => row(x, i)).join('')}</ul><button class="btn ghost small" data-act="todoClear">${t('todo.clear')}</button>` : ''}`
    : '';
  const full = T2.open.length + T2.done.length >= (T2.max || 100);
  const body = `<div class="panel todo-panel">
      <form class="todo-add" autocomplete="off"><input type="text" id="todo-new" maxlength="${T2.maxText || 200}" placeholder="${esc(t('todo.placeholder'))}" ${full ? 'disabled' : ''} aria-label="${esc(t('todo.placeholder'))}"><button class="btn primary small" type="submit" ${full ? 'disabled' : ''}>${t('todo.add')}</button></form>
      ${open}${done}
      <p class="muted todo-note">${icon('lock', 10)}${t('todo.note')}</p>
    </div>`;
  const n = T2.open.length;
  return homeSec('todo', `${t('todo.title')}${n ? ` <span class="muted">${fmt(n)}</span>` : ''}`, '', body);
}

// ---------- 노트 지도 (2.0.1): 옵시디언 그래프 뷰처럼 움직이는 그래프 ----------
// 노드끼리 서로 밀어내고(전하), 링크는 용수철처럼 당기고, 모두 가운데로 살짝 끌린다(중력). 처음엔 흩어졌다가 자리를 잡으며
// 천천히 멈춘다(알파가 식는다). 노드를 끌면 다시 살아나고, 놓으면 제자리를 찾아간다. 마우스를 올리면 그 노드와 이웃만 밝게.
// 빈 곳을 끌면 화면 이동, Ctrl(⌘)+휠이면 확대, 빈 곳 두 번 누르면 원래대로. 노드를 누르면(끌지 않고) 그 노트를 연다.
// 홈을 다시 그려도(데이터가 와도) 같은 노드는 그 자리 · 속도 그대로 이어서 움직인다 (graphSim 에 남겨 둔다)
const GRAPH_W = 320;
const GRAPH_H = 210;
const SVGNS = 'http://www.w3.org/2000/svg';
const graphSim = { key: '', nodes: [], links: [], nbr: [], byPath: new Map(), alpha: 0, alphaTarget: 0, svg: null, zoom: null, raf: 0, timer: 0, view: { x: 0, y: 0, k: 1 }, hover: -1, drag: null, pan: null };
window.VP_GRAPH = graphSim; // 확인용 (테스트 · 실제 앱 점검에서 시뮬레이션 상태를 본다)
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// 문자열마다 정해진 0~1 값 (새 노드가 처음 나타나는 자리. 같은 노트면 늘 같은 자리에서 나온다)
function hashUnit(s, salt) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10007) / 10007;
}
const graphKey = (G) => (G && G.nodes.length ? `${G.nodes.length}.${G.edges.length}.${Math.floor(hashUnit(G.nodes.map((n) => n.path).join('\n'), 7) * 1e9)}` : '');
const shortName = (s) => (s.length > 16 ? s.slice(0, 15) + '…' : s);

function graphPanel() {
  const H = D.home;
  const acts = `<button class="btn head-act" data-act="localGraph">${icon('map', 12)}${t('home.localGraph')}</button><button class="btn head-act" data-act="graph">${icon('map', 12)}${t('home.graphView')}</button>`;
  if (!H) return homeSec('map', t('home.mapTitle'), acts, `<div class="panel"><p class="muted small">${t('home.reading')}</p></div>`);
  const G = H.graph;
  const sum = `<p class="muted small map-sum">${t('home.mapSum', { n: fmt(H.notes), l: fmt(H.links), o: fmt((H.orphans && H.orphans.n) || 0) })}</p>`;
  if (!G || !G.nodes.length)
    return homeSec('map', t('home.mapTitle'), acts, `<div class="panel map-panel"><p class="muted small">${t('home.mapNone')}</p>${sum}</div>`);
  const more = G.more ? `<span class="muted small">${t('home.mapMore', { n: fmt(G.more) })}</span>` : '';
  // 그림은 mountGraph 가 그린다 (여기 글은 그래프가 바뀔 때만 달라져서, 데이터가 와도 다시 그리지 않는다)
  const body = `<div class="panel map-panel">
      <div class="mini-graph-wrap" data-graph="${graphKey(G)}"><svg class="mini-graph" viewBox="0 0 ${GRAPH_W} ${GRAPH_H}" role="group" aria-label="${esc(t('home.mapTitle'))}"></svg></div>
      <div class="map-foot"><span class="small">${icon('pin', 11)}<b>${esc(G.nodes[0].name)}</b> · ${t('home.mapNear', { n: fmt(G.nodes.length - 1) })}</span>${more}</div>
      <p class="muted map-hint">${t('map.hint')}</p>
      ${sum}
    </div>`;
  return homeSec('map', t('home.mapTitle'), acts, body);
}

// 홈을 그린 뒤 그래프를 붙인다 (paintView → bindView)
function mountGraph(root) {
  const S = graphSim;
  const wrap = $('.mini-graph-wrap', root);
  const G = D.home && D.home.graph;
  if (!wrap || !G || !G.nodes.length) {
    stopGraph();
    S.svg = null;
    return;
  }
  const key = wrap.dataset.graph;
  const fresh = key !== S.key;
  const prev = S.byPath;
  const cx = GRAPH_W / 2;
  const cy = GRAPH_H / 2;
  const nodes = G.nodes.map((nd, i) => {
    const old = prev.get(nd.path);
    return { i, path: nd.path, name: nd.name, hop: nd.hop, deg: nd.deg, r: nd.hop === 0 ? 6.5 : 3 + Math.min(4, nd.deg * 0.45), x: old ? old.x : NaN, y: old ? old.y : NaN, vx: old ? old.vx : 0, vy: old ? old.vy : 0, fx: null, fy: null };
  });
  const seen = new Set();
  const links = [];
  for (const [a, b] of G.edges) {
    const k = a < b ? a + '-' + b : b + '-' + a;
    if (a === b || seen.has(k) || !nodes[a] || !nodes[b]) continue;
    seen.add(k);
    links.push({ s: nodes[a], t: nodes[b] });
  }
  const nbr = nodes.map(() => new Set());
  for (const l of links) {
    nbr[l.s.i].add(l.t.i);
    nbr[l.t.i].add(l.s.i);
  }
  // 새 노드는 자리를 이미 가진 이웃 곁에서 (없으면 가운데 둘레에서) 나온다
  const placed = (n) => !isNaN(n.x);
  for (let pass = 0; pass < 3; pass++)
    for (const n of nodes) {
      if (placed(n)) continue;
      const base = [...nbr[n.i]].map((j) => nodes[j]).find(placed);
      if (!base && pass < 2 && n.hop > 0) continue;
      const a = hashUnit(n.path, 1) * Math.PI * 2;
      const d = n.hop === 0 && !base ? 0 : 18 + hashUnit(n.path, 2) * 26;
      n.x = (base ? base.x : cx) + Math.cos(a) * d;
      n.y = (base ? base.y : cy) + Math.sin(a) * d;
    }
  Object.assign(S, { key, nodes, links, nbr, byPath: new Map(nodes.map((n) => [n.path, n])), hover: -1, drag: null, pan: null });
  if (fresh) S.alpha = prev.size ? 0.6 : 1;
  buildGraph(wrap.querySelector('svg'));
  if (reduceMotion()) {
    for (let i = 0; i < 300 && S.alpha > 0.004; i++) graphTick();
    renderGraph();
    return;
  }
  renderGraph();
  startGraph();
}

function buildGraph(svg) {
  const S = graphSim;
  const mk = (tag, cls) => {
    const el = document.createElementNS(SVGNS, tag);
    if (cls) el.setAttribute('class', cls);
    return el;
  };
  S.svg = svg;
  svg.innerHTML = '';
  const zoom = mk('g', 'g-zoom');
  const ge = mk('g', 'ge');
  const gn = mk('g', 'gns');
  zoom.append(ge, gn);
  svg.append(zoom);
  S.zoom = zoom;
  applyView();
  for (const l of S.links) {
    l.el = mk('line');
    ge.append(l.el);
  }
  const few = S.nodes.length <= 12;
  for (const n of S.nodes) {
    const g = mk('g', `gn h${Math.min(2, n.hop)}`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', n.name);
    const title = mk('title');
    title.textContent = n.name;
    const c = mk('circle');
    c.setAttribute('r', n.r);
    const tx = mk('text');
    tx.textContent = shortName(n.name);
    g.append(title, c, tx);
    n.base = n.hop === 0 || (few && n.hop === 1); // 늘 이름을 보이는 노드
    n.el = g;
    n.c = c;
    n.tx = tx;
    gn.append(g);
    g.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      svg.setPointerCapture(e.pointerId);
      S.drag = { n, x: e.clientX, y: e.clientY, moved: false };
      n.fx = n.x;
      n.fy = n.y;
      S.alphaTarget = 0.25;
      wakeGraph(0.25);
    });
    g.addEventListener('pointerenter', () => setHover(n.i));
    g.addEventListener('pointerleave', () => !S.drag && setHover(-1));
    g.addEventListener('focus', () => setHover(n.i));
    g.addEventListener('blur', () => setHover(-1));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openGraphNote(n);
      }
    });
  }
  setHover(-1);
  // 화면 좌표 → 그래프 좌표 (확대 · 이동을 거슬러)
  const toGraph = (e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(zoom.getScreenCTM().inverse());
  };
  const toView = (e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || S.drag) return;
    svg.setPointerCapture(e.pointerId);
    const q = toView(e);
    S.pan = { qx: q.x, qy: q.y, x: S.view.x, y: S.view.y };
    svg.classList.add('panning');
  });
  svg.addEventListener('pointermove', (e) => {
    if (S.drag) {
      const d = S.drag;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
      if (!d.moved) return;
      const p = toGraph(e);
      d.n.fx = p.x;
      d.n.fy = p.y;
      wakeGraph(0.25);
    } else if (S.pan) {
      const q = toView(e);
      S.view.x = S.pan.x + (q.x - S.pan.qx);
      S.view.y = S.pan.y + (q.y - S.pan.qy);
      applyView();
    }
  });
  const end = () => {
    const d = S.drag;
    S.drag = null;
    S.pan = null;
    svg.classList.remove('panning');
    if (!d) return;
    d.n.fx = null;
    d.n.fy = null;
    S.alphaTarget = 0;
    wakeGraph(0.15);
    if (!d.moved) openGraphNote(d.n);
    else setHover(-1);
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('dblclick', (e) => {
    if (e.target.closest && e.target.closest('.gn')) return;
    S.view = { x: 0, y: 0, k: 1 };
    applyView();
  });
  // Ctrl(⌘)+휠 · 트랙패드 오므리기로 확대. 그냥 휠은 홈을 스크롤한다
  svg.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const q = toView(e);
    const k = Math.max(0.5, Math.min(3, S.view.k * Math.exp(-e.deltaY * 0.002)));
    const gx = (q.x - S.view.x) / S.view.k;
    const gy = (q.y - S.view.y) / S.view.k;
    S.view = { k, x: q.x - gx * k, y: q.y - gy * k };
    applyView();
  }, { passive: false });
}

function applyView() {
  const v = graphSim.view;
  if (graphSim.zoom) graphSim.zoom.setAttribute('transform', `translate(${v.x.toFixed(1)} ${v.y.toFixed(1)}) scale(${v.k.toFixed(3)})`);
}

async function openGraphNote(n) {
  const ok = await pet.openNote(n.path);
  if (!ok) toast(t('home.noteGone'), 'bang');
}

// 마우스를 올린 노드와 그 이웃만 밝게, 나머지는 흐리게. 이름은 늘 보이는 노드 + 밝은 노드
function setHover(i) {
  const S = graphSim;
  S.hover = i;
  const on = i >= 0 ? new Set([i, ...S.nbr[i]]) : null;
  for (const n of S.nodes) {
    if (!n.el) continue;
    n.el.classList.toggle('hl', !!on && on.has(n.i));
    n.el.classList.toggle('dim', !!on && !on.has(n.i));
    n.el.classList.toggle('lbl', n.base || (!!on && on.has(n.i)));
    n.el.classList.toggle('me', n.i === i);
  }
  for (const l of S.links) {
    if (!l.el) continue;
    const hot = !!on && (l.s.i === i || l.t.i === i);
    l.el.classList.toggle('hl', hot);
    l.el.classList.toggle('dim', !!on && !hot);
  }
}

// 한 걸음 (d3-force 와 같은 방식: 전하 · 링크 · 중력, 속도 감쇠 0.4)
function graphTick() {
  const S = graphSim;
  const N = S.nodes;
  const n = N.length;
  S.alpha += (S.alphaTarget - S.alpha) * 0.0228;
  const a = S.alpha;
  const charge = n > 16 ? -70 : n > 8 ? -120 : -170;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const A = N[i];
      const B = N[j];
      let dx = B.x - A.x;
      let dy = B.y - A.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        dx = (hashUnit(A.path, 3) - 0.5) * 0.1;
        dy = (hashUnit(B.path, 3) - 0.5) * 0.1;
        d2 = dx * dx + dy * dy + 0.01;
      }
      d2 = Math.max(d2, 25);
      const w = (charge * a) / d2;
      A.vx += dx * w;
      A.vy += dy * w;
      B.vx -= dx * w;
      B.vy -= dy * w;
    }
  const dist = n > 16 ? 34 : n > 8 ? 46 : 58;
  for (const l of S.links) {
    const cs = S.nbr[l.s.i].size || 1;
    const ct = S.nbr[l.t.i].size || 1;
    const bias = cs / (cs + ct);
    let x = l.t.x + l.t.vx - l.s.x - l.s.vx;
    let y = l.t.y + l.t.vy - l.s.y - l.s.vy;
    const len = Math.hypot(x, y) || 0.01;
    const k = ((len - dist) / len) * a * (1 / Math.min(cs, ct));
    x *= k;
    y *= k;
    l.t.vx -= x * bias;
    l.t.vy -= y * bias;
    l.s.vx += x * (1 - bias);
    l.s.vy += y * (1 - bias);
  }
  const cx = GRAPH_W / 2;
  const cy = GRAPH_H / 2;
  for (const p of N) {
    p.vx += (cx - p.x) * 0.035 * a;
    p.vy += (cy - p.y) * 0.06 * a;
    if (p.fx != null) {
      p.x = Math.max(12, Math.min(GRAPH_W - 12, p.fx));
      p.y = Math.max(16, Math.min(GRAPH_H - 8, p.fy));
      p.vx = 0;
      p.vy = 0;
      continue;
    }
    p.vx *= 0.6;
    p.vy *= 0.6;
    // 상자 밖으로는 못 나간다 (위는 이름 자리를 남긴다). 확대 · 이동은 보는 자리만 바꾼다
    p.x = Math.max(12, Math.min(GRAPH_W - 12, p.x + p.vx));
    p.y = Math.max(16, Math.min(GRAPH_H - 8, p.y + p.vy));
  }
}

function renderGraph() {
  const S = graphSim;
  for (const l of S.links) {
    if (!l.el) continue;
    l.el.setAttribute('x1', l.s.x.toFixed(1));
    l.el.setAttribute('y1', l.s.y.toFixed(1));
    l.el.setAttribute('x2', l.t.x.toFixed(1));
    l.el.setAttribute('y2', l.t.y.toFixed(1));
  }
  for (const n of S.nodes) {
    if (!n.c) continue;
    n.c.setAttribute('cx', n.x.toFixed(1));
    n.c.setAttribute('cy', n.y.toFixed(1));
    n.tx.setAttribute('x', n.x.toFixed(1));
    n.tx.setAttribute('y', (n.y - n.r - 3).toFixed(1));
  }
}

function stopGraph() {
  cancelAnimationFrame(graphSim.raf);
  clearTimeout(graphSim.timer);
  graphSim.raf = 0;
  graphSim.timer = 0;
}

function startGraph() {
  const S = graphSim;
  if (S.raf || S.timer) return;
  const step = () => {
    S.raf = 0;
    S.timer = 0;
    if (!S.svg || !S.svg.isConnected) return;
    // 화면에 안 보이면(뒤에 깔린 탭 · 접은 사이드바) 쉬다가 다시 본다
    if (offscreen()) {
      S.timer = setTimeout(step, 500);
      return;
    }
    graphTick();
    renderGraph();
    if (S.alpha > 0.004 || S.alphaTarget > 0) S.raf = requestAnimationFrame(step);
  };
  S.raf = requestAnimationFrame(step);
}

function wakeGraph(a) {
  graphSim.alpha = Math.max(graphSim.alpha, a);
  startGraph();
}
// 최근 노트: 옵시디언이 기억하는 최근에 연 노트. 누르면 연다 (이미 있는 노트만)
function ago(ms) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (m < 1) return t('home.agoNow');
  if (m < 60) return t('home.agoMin', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('home.agoHour', { n: h });
  return new Date(ms).toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
}
function recentPanel() {
  const H = D.home;
  const list = (H && H.recent) || [];
  const rows = list.length
    ? `<ul class="recent">${list.map((x) => `<li><button class="recent-btn" data-open-note="${esc(x.path)}">${icon(x.canvas ? 'map' : 'scroll', 13)}<span class="nm">${esc(x.name)}</span><span class="muted small">${esc(ago(x.mtime))}</span></button></li>`).join('')}</ul>`
    : `<p class="muted small">${t('home.recentNone')}</p>`;
  const edited = H && H.editedToday ? `<p class="muted small recent-sum">${t('home.editedToday', { n: fmt(H.editedToday) })}</p>` : '';
  return homeSec('recent', t('home.recentTitle'), '', `<div class="panel recent-panel">${rows}${edited}</div>`);
}

// 하루 목표 고르기 (홈의 '바꾸기' · '목표 정하기'). 단위 · 미리 정한 양 · 직접 입력 · 끄기
const GOAL_PRESETS = { words: [100, 300, 500, 1000, 1667], chars: [300, 1000, 2000, 5000] };
const GOAL_MAX = { words: 20000, chars: 100000 };
function goalChips(unit, target) {
  return GOAL_PRESETS[unit]
    .map((n) => `<button class="chip ${n === target ? 'on' : ''}" data-goal-n="${n}">${t(unit === 'words' ? 'goal.presetW' : 'goal.presetC', { n: fmt(n) })}${n === 1667 ? `<small>${t('goal.nano')}</small>` : ''}</button>`)
    .join('');
}
function openGoalPicker() {
  const g = D.goal || { unit: 'words', target: 300, on: true };
  let unit = g.unit;
  let target = g.target;
  const el = openModal(
    `<div class="modal-top"><h2>${t('goal.pickTitle')}</h2><button class="btn ghost small" data-close>${t('modal.close')}</button></div>
    <p class="muted" style="margin-top:-4px">${t('goal.pickSub')}</p>
    <div class="goal-pick">
      <div class="seg">${['words', 'chars'].map((u) => `<button class="chip ${u === unit ? 'on' : ''}" data-goal-unit="${u}">${t('goal.unit.' + u)}</button>`).join('')}</div>
      <div class="chips" id="goal-chips">${goalChips(unit, target)}</div>
      <div class="field"><div class="lbl">${t('goal.pickCustom')}</div><input type="number" id="goal-n" min="10" max="${GOAL_MAX[unit]}" value="${target}"></div>
    </div>
    <div class="nav"><button class="btn ghost" data-goal-off>${t('goal.pickOff')}</button><button class="btn primary" data-goal-save>${t('goal.pickSave')}</button></div>`,
    'goal-modal',
  );
  const paint = () => {
    $('#goal-chips', el).innerHTML = goalChips(unit, target);
    $$('[data-goal-unit]', el).forEach((b) => b.classList.toggle('on', b.dataset.goalUnit === unit));
    $('#goal-n', el).value = target;
    $('#goal-n', el).max = GOAL_MAX[unit];
    bindChips();
  };
  const bindChips = () =>
    $$('[data-goal-n]', el).forEach((b) =>
      b.addEventListener('click', () => {
        target = Number(b.dataset.goalN);
        paint();
      }),
    );
  bindChips();
  $$('[data-goal-unit]', el).forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.goalUnit === unit) return;
      unit = b.dataset.goalUnit;
      target = GOAL_PRESETS[unit][1];
      paint();
    }),
  );
  $('#goal-n', el).addEventListener('input', (e) => {
    const n = Math.round(Number(e.target.value));
    if (n > 0) target = Math.min(GOAL_MAX[unit], n);
    $$('[data-goal-n]', el).forEach((b) => b.classList.toggle('on', Number(b.dataset.goalN) === target));
  });
  $('[data-goal-save]', el).addEventListener('click', async () => {
    closeModal();
    await apply(await pet.set({ goal: { on: true, unit, target } }));
    renderView();
    toast(t('toast.saved'), 'check');
  });
  $('[data-goal-off]', el).addEventListener('click', async () => {
    closeModal();
    await apply(await pet.set({ goal: { on: false, unit, target } }));
    renderView();
    toast(t('toast.saved'));
  });
}

// 업적 탭 거르기 (all · todo · done)
let achFilter = 'todo'; // 업적 탭은 아직 못 한 것부터 보여 준다

// 상점에서 지금 보는 페이지 (meal · snack · acc · toy · star. 2.0.0: 모션은 상점에서 뺐다)
let shopPage = 'meal';
let freshSnap = null; // '새로 열림' 페이지를 연 순간의 목록 (보는 동안 NEW 가 꺼져도 페이지에서 안 사라지게)
// 코스튬 칸 (main/shop.js 의 COSTUME_TABS 와 같은 순서). 옷장 인벤토리 탭·상점 코스튬 분류가 쓴다
const COSTUME_TABS = ['set', 'head', 'face', 'neck', 'back', 'hand', 'effect'];
let wardTab = 'all';
// 인벤토리 큰 분류. 코스튬 밑에만 칸 분류(wardTab)가 한 줄 더 붙는다
const INV_PAGES = ['costume', 'meal', 'snack', 'toy'];
let invPage = 'costume';
let shopCostumeTab = 'set'; // 처음 열면 세트부터 (2026-09-29)
let shopStarTab = 'set'; // 별 상점도 코스튬처럼 칸으로 거른다. 처음 열면 세트부터 (2026-10-09). 털색은 맨 끝 '털색' 칩


// 설정의 '경험치에 넣을 프로젝트' 목록을 처음에 몇 줄만 보여 줄지
const PROJECTS_SHOWN = 6;
let projectsOpen = false;
const subOpen = new Set(); // 하위 폴더를 펼쳐 둔 맨 윗단 폴더 (1.6.0)

const TABS = {
  // 2.0.0 홈: 옵시디언을 쓰는 데 도움이 되는 것들. 2.0.1: 칸 순서 · 보이기는 '홈 꾸미기'에서 (homeLayout)
  home() {
    const g = D.growth;
    const u = D.today;
    const st = D.game.streak;
    // [옵시디언] Claude Code 연결 안내 대신: 펫을 꺼 뒀으면 다시 켜는 줄
    const hook = D.petShown === false
      ? `<div class="banner">${icon('paw', 22)}<p><b>${t('obs.petOffTitle')}</b><br><span class="muted">${t('obs.petOffDesc')}</span></p><button class="btn primary" data-act="petOn">${t('obs.petOn')}</button></div>`
      : '';
    const into = g ? g.xp - g.levelFloor : 0;
    const need = g ? g.levelCeil - g.levelFloor : 1;
    const parts = {
      goal: goalPanel,
      // 오늘 숫자: 한 줄짜리 작은 칸들. 목표를 단어로 세면 첫 칸도 단어로
      today: () => {
        const words = D.goal && D.goal.unit === 'words';
        const cell = (k, v, tipKey) => `<div class="tcell2"><span class="k">${k}${tipKey ? info(tipKey) : ''}</span><b>${v}</b></div>`;
        const body = `<div class="panel today-row">
          ${words ? cell(t('home.todayWords'), fmt(u.w || 0), 'words') : cell(t('home.todayChars'), fmt(u.c), 'chars')}
          ${cell(t('home.todayLinks'), fmt(u.l), 'links')}
          ${cell(t('home.todayNotes'), fmt(u.n), 'notes')}
          ${cell(t('home.todayTasks'), fmt(u.k || 0), 'tasks')}
          ${cell(t('home.attendance'), `${icon('fire', 13)}${st.current}`)}
        </div>`;
        const quietBtn = `<button class="btn head-act ${D.quiet ? 'alert' : ''}" data-act="quiet">${icon(D.quiet ? 'bellOff' : 'bell', 12)}${t(D.quiet ? 'home.quietOff' : 'home.quietOn')}</button>`;
        return homeSec('today', t('home.today'), quietBtn, body);
      },
      map: graphPanel,
      todo: todoPanel,
      // 고양이: 레벨 한 줄 + 배부름 한 줄 (밥 주기)
      cat: () => {
        const gg = D.gauge || { food: 100, full: true };
        const body = `<div class="panel cat-panel">
          <div class="lvline"><b class="lvtag">Lv.${g ? g.level : 1}</b><div class="bar"><i style="width:${g ? (into / need) * 100 : 0}%"></i></div>
          <span class="muted">${!g ? t('home.reading') : g.maxed ? `${t('home.stars', { n: g.stars || 0 })} · ${t('home.toStar', { xp: fmt(g.starNext) })}` : t('home.toLevel', { lv: g.level + 1, xp: fmt(g.levelCeil - g.xp) })}</span></div>
          ${gaugeRow('food', gg.food, 'ricebowl')}
          <p class="muted gauge-note">${gaugeNote(gg)}</p>
        </div>`;
        const feedBtn = `<button class="btn head-act ${gg.food < 50 ? 'alert' : ''}" data-act="feed">${icon('ricebowl', 12)}${t('home.feed')}</button>`;
        return homeSec('cat', esc(D.settings.petName), feedBtn, body);
      },
      quests: () => TABS.__questsBody(),
      recent: recentPanel,
    };
    const shown = homeLayout().filter((x) => x.on);
    return `
      ${hook}
      ${shown.map((x) => parts[x.id]()).join('')}
      ${shown.length ? '' : `<p class="muted center">${t('home.allHidden')}</p>`}
      <div class="home-foot"><button class="btn ghost small" data-act="homeLayout">${icon('gear', 12)}${t('home.customize')}</button></div>`;
  },  // 퀘스트는 탭이 아니라 홈 안의 한 칸이다 (7차: 홈에 통합)
  __questsBody() {
    const q = D.game.quests;
    const done = q.filter((x) => x.done).length;
    // 새로고침은 받은 지 3시간이 지나야 된다. 시간이 지나도 저절로 바뀌지는 않고 버튼을 눌러야 바뀐다
    const qi = D.game.questInfo || { canRefresh: false, nextAt: 0 };
    // 분 단위로 올림한 뒤 시·분으로 나눈다 ('1시간 60분' 이 안 나오게). 한 시간이 안 남았으면 분만
    const mins = Math.max(1, Math.ceil(Math.max(0, qi.nextAt - Date.now()) / 6e4));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    // 2.0.1: 다른 홈 칸처럼 접을 수 있게 homeSec 으로
    const refresh = `<button class="btn head-act ${qi.canRefresh ? 'alert' : ''}" data-act="questRefresh" ${qi.canRefresh ? '' : 'disabled'}>${icon('hourglass', 12)}${t('quests.refresh')}</button>`;
    return homeSec('quests', t('quests.title'), refresh, `
      <p class="muted quest-sub">${qi.canRefresh ? t('quests.subReady') : h ? t('quests.subWait', { h, m }) : t('quests.subWaitMin', { m })}</p>
      ${q
        .map((x) => {
          // 2.0.0: 처음 해 보는 사람을 위한 '어떻게' 한 줄 (core/skills.js 의 기술 이름표). 외톨이 노트 퀘스트는 그 노트들을 바로 열 수 있게
          const howKey = x.skill ? 'skill.' + x.skill + '.how' : '';
          const how = howKey && t(howKey) !== howKey ? `<div class="quest-how">${icon('bulb', 11)}<span>${esc(t(howKey))}</span></div>` : '';
          const orphans = x.type === 'orphans' && !x.done && D.home && D.home.orphans && D.home.orphans.list.length
            ? `<div class="quest-notes">${D.home.orphans.list.map((o) => `<button class="chip" data-open-note="${esc(o.path)}">${esc(o.name)}</button>`).join('')}</div>`
            : '';
          return `
        <div class="panel quest ${x.done ? 'done' : ''}">
          <div class="icon">${icon(QUEST_ICON[x.type] || 'star', 26)}</div>
          <div class="body">
            <div class="row"><span><span class="qtier qtier-${x.tier}">${t('quests.tier.' + x.tier)}</span>${esc(x.text)}</span><span class="reward">${x.done ? icon('check', 11) : ''}+${x.xp} XP</span></div>
            <div class="bar ${x.done ? 'good' : ''}"><i style="width:${(x.value / x.target) * 100}%"></i></div>
            <div class="muted" style="font-size:11px;margin-top:3px">${fmt(x.value)} / ${fmt(x.target)}</div>
            ${x.done ? '' : how}${orphans}
          </div>
        </div>`;
        })
        .join('')}
      ${q.length ? '' : `<p class="muted center">${t('home.reading')}</p>`}
      <div class="panel allclear ${q.length && done === q.length ? 'done' : ''}" ${q.length ? '' : 'hidden'}>
        ${icon(done === q.length ? 'sparkle' : 'gift', 15)} ${done === q.length ? t('quests.allClearDone', { xp: D.game.allClearXp }) : t('quests.allClearTodo', { xp: D.game.allClearXp })}
      </div>
      <p class="muted ico-row" style="margin-top:14px;font-size:12px">${icon('bulb', 14)}<span>${t('quests.tip', { n: fmt(D.game.questsDone) })}</span></p>`);
  },

  achievements() {
    // Codex 모드에서는 Claude Code 에서만 되는 업적(claudeOnly)을 빼고 센다
    const list = D.mode === 'codex' ? D.game.achievements.filter((a) => !a.claudeOnly) : D.game.achievements;
    const got = list.filter((a) => a.unlockedAt).length;
    const cats = D.game.achCats || [...new Set(list.map((a) => a.cat))];
    const TIER_ORDER = { easy: 0, normal: 1, hard: 2, legend: 3 };
    const show = (a) => (achFilter === 'done' ? !!a.unlockedAt : achFilter === 'todo' ? !a.unlockedAt : true);
    // 보상 한 줄: 밥·간식은 "이름 ×개수", 악세사리·모션은 도트 아이콘과 이름
    // noCoins = 예전 기록으로 소급 달성해서 코인 보상을 건너뛴 업적
    const rewardOf = (r, noCoins) => {
      if (!r) return '';
      if (r.food) return Object.entries(r.food).map(([k, n]) => `${icon(k, 14)}<span>${esc(t('item.' + k))} ×${n}</span>`).join(' ');
      if (r.coins && noCoins) return `${icon('coin', 14)}<span><s>${t('ach.coinsN', { n: fmt(r.coins) })}</s></span><small>${t('ach.coinsRetro')}</small>`;
      if (r.coins) return `${icon('coin', 14)}<span>${t('ach.coinsN', { n: fmt(r.coins) })}</span>`;
      const isMotion = D.shop.motion.some((m) => m.key === r.item);
      return `${icon(isMotion ? 'sparkle' : PixelArt.has(r.item) ? r.item : 'ribbon', 14)}<span>${esc(t((isMotion ? 'motion.' : 'item.') + r.item))}</span><small>${t(isMotion ? 'shop.motion' : 'shop.acc')}</small>`;
    };
    const card = (a) => {
      const p = a.progress;
      const bar = !a.unlockedAt && p ? `<div class="bar"><i style="width:${Math.min(100, (p[0] / Math.max(1, p[1])) * 100)}%"></i></div><div class="muted prog">${compact(p[0])} / ${compact(p[1])}</div>` : '';
      const when = a.unlockedAt ? `<div class="when">${icon('check', 11)}${new Date(a.unlockedAt).toLocaleDateString(locale())}</div>` : '';
      return `<div class="panel badge ${a.unlockedAt ? '' : 'locked'} tier-${a.tier}">
        <span class="tier">${t('ach.tier.' + a.tier)}</span>
        <div class="ic">${icon(a.icon, 30)}</div>
        <div class="nm">${esc(a.name)}</div>
        <div class="ds">${esc(a.desc)}</div>
        ${achTip(a.id)}
        <div class="reward" title="${t('ach.reward')}">${rewardOf(a.reward, a.noCoins)}</div>
        <div class="xpb">+${fmt(a.xp)} XP</div>${bar}${when}
      </div>`;
    };
    const groups = cats
      .map((cat) => {
        const all = list.filter((a) => a.cat === cat);
        const items = all.filter(show).sort((x, y) => TIER_ORDER[x.tier] - TIER_ORDER[y.tier] || (!!y.unlockedAt - !!x.unlockedAt));
        if (!items.length) return '';
        const done = all.filter((a) => a.unlockedAt).length;
        return `<h3 class="ach-cat" id="ach-${cat}">${t('ach.cat.' + cat)}<span class="muted">${done} / ${all.length}</span></h3>
        <div class="badges">${items.map(card).join('')}</div>`;
      })
      .join('');
    const chip = (k) => `<button class="chip ${achFilter === k ? 'on' : ''}" data-ach-filter="${k}">${t('ach.filter' + k[0].toUpperCase() + k.slice(1))}</button>`;
    // 업적이 150개가 넘어서 아주 길다. 묶음으로 바로 가는 목록을 거르기 줄 오른쪽에 붙인다 (스크롤해도 따라 붙는다)
    const jumpOpts = cats
      .filter((cat) => list.some((a) => a.cat === cat && show(a)))
      .map((cat) => {
        const all = list.filter((a) => a.cat === cat);
        return `<option value="${cat}">${esc(t('ach.cat.' + cat))} (${all.filter((a) => a.unlockedAt).length}/${all.length})</option>`;
      })
      .join('');
    return `
      <h2>${t('ach.title', { got, total: list.length })}</h2>
      <div class="bar gold" style="margin-bottom:10px"><i style="width:${(got / list.length) * 100}%"></i></div>
      <nav class="shop-jump ach-filter">${chip('all')}${chip('todo')}${chip('done')}
        <select class="jump-select" id="ach-jump" aria-label="${esc(t('ach.jump'))}"><option value="">${t('ach.jump')}</option>${jumpOpts}</select></nav>
      ${groups}`;
  },

  // 옷장: 왼쪽에 지금 입은 모습과 칸별 착용 목록·코디 저장, 오른쪽에 가진 코스튬 인벤토리 (분류 탭).
  // 누르면 그 칸에 입고, 입은 걸 다시 누르면 벗는다. 칸마다 하나씩, 세트는 여러 칸을 한꺼번에 차지한다
  wardrobe() {
    const g = D.growth;
    const stage = g ? g.stageKey : 'cat';
    const outfit = D.settings.outfit || {};
    const worn = new Set(Object.values(outfit));
    const mine = D.game.items.filter((it) => it.unlocked && it.key !== 'none');
    const tab = COSTUME_TABS.includes(wardTab) ? wardTab : 'all';
    const list = tab === 'all' ? mine : mine.filter((it) => it.slot === tab);
    const setOn = outfit.set && D.game.items.find((x) => x.key === outfit.set);
    // 칸별 착용 목록. 세트가 덮은 칸은 '세트가 차지함'
    const slotRows = COSTUME_TABS.map((s) => {
      const k = outfit[s];
      const it = k && D.game.items.find((x) => x.key === k);
      const covered = !it && setOn && (setOn.covers || []).includes(s);
      return `<div class="wslot ${it ? 'on' : ''}"><span class="wslot-k">${t('cslot.' + s)}</span>
        <span class="wslot-v" ${it ? `title="${esc(it.name)}"` : ''}>${it ? esc(it.name) : covered ? `<i>${t('ward.bySet')}</i>` : '-'}</span>
        ${it ? `<button class="wslot-x" data-unwear="${s}" title="${esc(t('ward.takeOff'))}">×</button>` : ''}</div>`;
    }).join('');
    const saves = (D.settings.outfitSaves || [null, null, null])
      .map((o, i) => {
        const n = o ? Object.keys(o).length : 0;
        return `<div class="wsave"><span>${t('ward.save', { n: i + 1 })}<small>${o ? t('ward.saveCount', { n }) : t('ward.saveEmpty')}</small></span>
          <button class="btn small" data-outfit-load="${i}" ${o ? '' : 'disabled'}>${t('ward.load')}</button>
          <button class="btn ghost small" data-outfit-save="${i}">${t('ward.store')}</button>
          <button class="btn ghost small wsave-del" data-outfit-del="${i}" ${o ? '' : 'disabled'} title="${esc(t('ward.del'))}" aria-label="${esc(t('ward.del'))}">×</button></div>`;
      })
      .join('');
    const chips = ['all', ...COSTUME_TABS]
      .map((k) => {
        const n = k === 'all' ? mine.length : mine.filter((it) => it.slot === k).length;
        return `<button class="chip ${k === tab ? 'on' : ''} ${n ? '' : 'empty'}" data-ward-tab="${k}">${t(k === 'all' ? 'ward.all' : 'cslot.' + k)}<small>${n}</small></button>`;
      })
      .join('');
    const cards = list
      .map((it) => {
        const on = worn.has(it.key);
        const isNew = !seenItems.has(it.key);
        return `<div class="panel item witem ${on ? 'on' : ''}" data-item="${it.key}" title="${esc(it.name)}">
          <span class="wtag">${t('cslot.' + it.slot)}</span>
          <div class="pv"><span class="acc-view"><canvas class="pixel" data-stage="${stage}" data-acc="${it.key}"></canvas></span></div>
          <div class="nm">${esc(it.name)} ${isNew ? '<span class="new">NEW</span>' : ''}</div>
          <div class="fx">${setMoBtn(it.key)}</div>
          <div class="hint">${on ? t('ward.wearing') : ''}</div>
        </div>`;
      })
      .join('');
    // ---- 밥 · 간식 · 장난감: 지금 가진 것만. 다 먹은 건 카드가 사라진다 ----
    const page = INV_PAGES.includes(invPage) ? invPage : 'costume';
    const pantry = (grp) => D.shop.food.filter((x) => x.group === grp && x.stock > 0);
    const have = {
      costume: mine,
      meal: pantry('meal'),
      snack: pantry('snack'),
      toy: D.shop.toy.filter((x) => x.owned),
    };
    const pageChips = INV_PAGES.map(
      (k) => `<button class="chip ${k === page ? 'on' : ''} ${have[k].length ? '' : 'empty'}" data-inv-page="${k}">${t('inv.' + k)}<small>${have[k].length}</small></button>`,
    ).join('');
    const foodCard = (it) => `<div class="panel item inv-item">
        <div class="pv">${foodArt(it.key, 62)}</div>
        <div class="nm">${esc(t('item.' + it.key))}</div>
        <div class="fx">${foodGain(it)}${foodFx(it.key)}</div>
        <div class="hint"><span class="own">${t('shop.stock', { n: it.stock })}</span><button class="btn primary buy" data-give="${it.key}">${t('shop.give')}</button></div>
      </div>`;
    const toyCard = (it) => `<div class="panel item inv-item">
        <div class="pv"><div class="art">${icon(it.key, 62)}</div></div>
        <div class="nm">${esc(t('item.' + it.key))}</div>
        <div class="fx">${toyTags(it)}</div>
        <div class="hint"><button class="btn primary buy" data-play="${it.key}">${t('inv.play')}</button><button class="btn ghost buy" data-toy-demo="${it.key}">${t('shop.guide')}</button></div>
      </div>`;

    const cat = `<canvas class="pixel closet-cat" data-stage="${stage}" data-acc="${esc(D.settings.accessory || 'none')}" data-mood="active"></canvas>`;
    // 왼쪽 패널: 코스튬은 입은 칸·코디 저장, 밥·간식·장난감은 배부름 게이지
    const gg = D.gauge || { food: 100, full: true };
    const left =
      page === 'costume'
        ? `${cat}
          <div class="wslots">${slotRows}</div>
          <button class="btn small wide" data-act="furPick">${icon('paw', 12)}${t('ward.fur')} · ${esc(t('fur.' + (D.settings.fur || 'cheese')))}</button>
          <button class="btn small wide" data-act="earPick">${icon('heart', 12)}${t('ward.ears')} · ${esc(t('ear.' + (D.settings.ears || 'perk')))}</button>
          <button class="btn ghost small wide" data-act="undress" ${worn.size ? '' : 'disabled'}>${t('ward.undress')}</button>
          <div class="wsaves-title">${t('ward.saves')}</div>
          <div class="wsaves">${saves}</div>`
        : `${cat}<div class="inv-gauge">${gaugeRow('food', gg.food, 'ricebowl')}</div>
            <p class="muted inv-note">${gaugeNote(gg)}</p>`;
    const right =
      page === 'costume'
        ? `<nav class="shop-jump ward-tabs">${chips}</nav>
          ${list.length ? `<div class="wardrobe inv-grid inv-uni inv-cos">${cards}</div>` : `<p class="muted center">${t(mine.length ? 'ward.emptyTab' : 'ward.empty')}</p>`}`
        : !have[page].length
          ? `<p class="muted center">${t('inv.empty.' + page)}</p>`
          : `<div class="wardrobe inv-grid inv-uni">${have[page].map(page === 'toy' ? toyCard : foodCard).join('')}</div>`;
    const html = `
      <div class="h2-row"><h2>${t('ward.title')}</h2><button class="btn head-act" data-act="card">${icon('sparkle', 12)}${t('card.open')}</button></div>
      <p class="muted" style="margin-top:-4px">${t(page === 'costume' ? 'ward.sub' : 'inv.sub.' + page)}</p>
      <nav class="shop-jump inv-pages">${pageChips}</nav>
      <div class="closet">
        <div class="closet-left panel">${left}</div>
        <div class="closet-right">${right}</div>
      </div>
`;
    if (page === 'costume') setTimeout(markItemsSeen, 1500);
    return html;
  },

  shop() {
    const w = D.shop.wallet;
    const s = D.settings;

    // 레벨이 올라 새로 열린 것. '새로 열림' 페이지에서는 연 순간의 목록을 그대로 보여 준다
    const freshNow = newUnlocks();
    if (shopPage === 'new' && !freshSnap) freshSnap = freshNow.map((x) => x.key);
    if (shopPage !== 'new') freshSnap = null;
    const freshKeys = new Set(freshNow.map((x) => x.key));
    if (freshSnap) for (const k of freshSnap) freshKeys.add(k);

    // 악세사리는 고양이가 쓴 모습으로, 먹이·장난감은 물건 도트 그대로 보여 준다
    const stage = D.growth ? D.growth.stageKey : 'cat';
    const card = (it) => {
      const name = it.kind === 'fur' ? t('fur.' + it.fur) : t('item.' + it.key);
      const fresh = freshKeys.has(it.key) ? '<span class="new">NEW</span>' : '';
      const preview =
        it.kind === 'acc'
          ? `<span class="acc-view"><canvas class="pixel" data-stage="${stage}" data-acc="${it.key}"></canvas></span>`
          : it.kind === 'fur'
              ? `<span class="acc-view"><canvas class="pixel" data-stage="${stage}" data-acc="none" data-furkey="${it.fur}"></canvas></span>`
              : it.kind === 'food'
              ? foodArt(it.key, 62)
              : `<div class="art">${icon(it.key, 62)}</div>`;
      let foot;
      // 산 코스튬은 옷장까지 안 가도 여기서 바로 입고 벗는다
      if (it.kind === 'acc' && it.owned && it.slot) {
        const on = (D.settings.outfit || {})[it.slot] === it.key;
        foot = `<button class="btn ${on ? '' : 'primary'} buy" data-shop-wear="${it.key}">${t(on ? 'shop.takeOff' : 'shop.wear')}</button>`;
      }
      // 별 털색은 산 뒤 여기서 바로 입는다
      else if (it.kind === 'fur' && it.owned) {
        const on = (D.settings.fur || 'cheese') === it.fur;
        foot = `<button class="btn ${on ? '' : 'primary'} buy" data-star-fur="${on ? 'cheese' : it.fur}">${t(on ? 'shop.takeOff' : 'shop.wear')}</button>`;
      }
      // 가진 건 가격 자리에 '가짐' 표시가 대신 들어간다 (아래 price)
      else if (it.kind !== 'food' && it.owned) foot = '';
      else if (it.blocker === 'stars') foot = `<span class="need">${t(D.shop.wallet.stars.maxed ? 'shop.needStars' : 'shop.needMax')}</span>`;
      else if (it.locked) foot = `<span class="need">${t('shop.needLevel', { n: it.level })}</span>`;
      else if (it.blocker === 'coins') foot = `<span class="need">${t('shop.needCoins')}</span>`;
      else foot = `<button class="btn buy" data-buy="${it.key}">${t('shop.buy')}</button>`;
      // 장난감은 사기 전에 사용법을 볼 수 있다 (글로 된 설명)
      if (it.kind === 'toy') foot += ` <button class="btn ghost buy" data-toy-demo="${it.key}">${t('shop.guide')}</button>`;
      // 먹이는 가진 만큼 바로 꺼내 줄 수도 있다
      if (it.kind === 'food' && it.stock) foot += ` <button class="btn ghost buy" data-give="${it.key}">${t('shop.give')}</button>`;
      const have = it.kind === 'food' && it.stock ? `<span class="own">${t('shop.stock', { n: it.stock })}</span>` : '';
      // 장난감은 꺼내면 고양이가 뭘 하는지 한 줄로
      const slot = it.kind === 'toy' ? toyTags(it, true) : '';
      // 먹이는 하나 먹으면 배부름이 얼마나 차는지
      const gauge = it.kind === 'food'
        ? `${foodGain(it)}${foodFx(it.key)}`
        : '';
      const slotTag = it.kind === 'acc' && it.slot ? `<span class="wtag">${t('cslot.' + it.slot)}</span>` : '';
      // 이미 가진 물건(먹이 빼고)은 가격 대신 '가짐'. 버튼 줄은 한 줄로 (사기·입기·적용 | 사용법)
      const price =
        it.kind !== 'food' && it.owned
          ? `<span class="own">${icon('check', 11)}${t('shop.owned')}</span>`
          : D.shop.dev
            ? `${icon('coin', 13)}<span>${t('shop.free')}</span>`
            : it.stars
              ? `<span class="star-price">${icon('star', 13)}<b>${fmt(it.stars)}</b></span>`
              : coins(it.price, 13);
      // 업적 보상으로 레벨보다 먼저 받은 건 잠김 그림자로 보이지 않게 (가진 건 가진 것)
      // 카드는 늘 다섯 줄 (그림 · 이름 · 효과 · 가격 · 버튼). 같은 줄의 카드끼리 줄 높이를 맞춰서 간격이 똑같다 (house.css .shop-grid)
      // 아직 못 여는 것(레벨이 모자람 · Lv80 전의 별 물건)은 반투명 그림 + 자물쇠 딱지 (10-10)
      const starShut = !!it.stars && !it.owned && !D.shop.dev && !(D.shop.wallet.stars || {}).maxed;
      const shut = (it.locked && !it.owned) || starShut;
      const lvTag = shut ? `<span class="lv-tag">${icon('lock', 9)}Lv.${starShut ? 80 : it.level}</span>` : '';
      return `<div class="panel item k-${it.kind} ${it.stars ? 'k-star' : ''} ${it.owned || it.stock ? 'on' : ''} ${shut ? 'locked' : ''} ${it.premium ? 'premium' : ''}" ${it.kind === 'toy' ? `data-toy-card="${it.key}" title="${esc(t('shop.toyPeekHint'))}"` : ''}>
        ${slotTag}${lvTag}<div class="pv">${preview}</div>
        <div class="nm">${esc(name)} ${have}${fresh}</div>
        <div class="fx">${slot}${gauge}${setMoBtn(it.key)}</div>
        <div class="price ico-row">${price}</div>
        <div class="hint">${foot}</div>
      </div>`;
    };

    // 지금 살 수 있는 것(레벨이 되거나 이미 가진 것)부터 원래 순서대로, 레벨이 모자라 잠긴 것은 뒤로 필요 레벨 오름차순
    const lockRank = (x) => (x.locked && !x.owned ? x.level || 0 : -1);
    const ordered = (list) => list.map((x, i) => [x, i]).sort((a, b) => lockRank(a[0]) - lockRank(b[0]) || a[1] - b[1]).map(([x]) => x);
    const grid = (list) => `<div class="wardrobe shop-grid">${ordered(list.filter((x) => x.key !== 'none')).map(card).join('')}</div>`;
    // 상점은 밥·간식·악세사리·장난감을 한 페이지씩 따로 보여 준다 (다 이어 붙이면 너무 길다)
    const pageList = { meal: D.shop.food.filter((x) => x.group === 'meal'), snack: D.shop.food.filter((x) => x.group === 'snack'), acc: D.shop.acc, toy: D.shop.toy, star: D.shop.star || [] };
    if (freshSnap) pageList.new = [...D.shop.acc, ...D.shop.toy].filter((x) => freshSnap.includes(x.key));
    const page = pageList[shopPage] ? shopPage : 'meal';
    // 코스튬 페이지는 옷장과 같은 분류(세트·머리·얼굴·목·등·손·효과)로 거를 수 있다
    const costumeTab = COSTUME_TABS.includes(shopCostumeTab) ? shopCostumeTab : 'all';
    const costumeChips =
      page === 'acc'
        ? `<nav class="shop-jump costume-tabs">${['all', ...COSTUME_TABS]
            .map((k) => `<button class="chip ${k === costumeTab ? 'on' : ''}" data-shop-costume="${k}">${t(k === 'all' ? 'ward.all' : 'cslot.' + k)}<small>${k === 'all' ? D.shop.acc.length - 1 : D.shop.acc.filter((x) => x.slot === k).length}</small></button>`)
            .join('')}</nav>`
        : '';
    // 별 상점도 같은 칸으로 거른다. 털색은 맨 끝 '털색' 칩
    const starList = pageList.star;
    const STAR_TABS = [...COSTUME_TABS, 'fur'];
    const starIn = (x, k) => (k === 'fur' ? x.kind === 'fur' : x.kind === 'acc' && x.slot === k);
    const starTab = STAR_TABS.includes(shopStarTab) ? shopStarTab : 'all';
    const starChips =
      page === 'star'
        ? `<nav class="shop-jump costume-tabs">${['all', ...STAR_TABS]
            .map((k) => `<button class="chip ${k === starTab ? 'on' : ''}" data-shop-star="${k}">${t(k === 'all' ? 'ward.all' : k === 'fur' ? 'ward.fur' : 'cslot.' + k)}<small>${k === 'all' ? starList.length : starList.filter((x) => starIn(x, k)).length}</small></button>`)
            .join('')}</nav>`
        : '';
    const pageItems =
      page === 'acc' && costumeTab !== 'all' ? pageList.acc.filter((x) => x.slot === costumeTab)
      : page === 'star' && starTab !== 'all' ? starList.filter((x) => starIn(x, starTab))
      : pageList[page];
    // 별 상점: Lv80 뒤 별로만 산다. 별이 아직 없으면 무엇을 향해 가는지 보여 주는 진열장이 된다
    const sw = w.stars || { total: 0, balance: 0, maxed: false };
    const g = D.growth;
    const starHead =
      page === 'star'
        ? `<div class="panel star-wallet ico-row">${icon('star', 22)}<b class="pix">${fmt(sw.balance)}</b>
          <span class="muted small">${sw.maxed ? t('shop.starHave', { total: fmt(sw.total), next: fmt(g ? g.starNext : 0) }) : t('shop.starRoad', { lv: g ? g.level : 1 })}</span></div>`
        : '';
    const pageBody = `
      <p class="muted shop-page-sub">${t('shop.' + page + 'Sub')}</p>
      ${starHead}
      ${grid(pageItems)}`;

    // 처음 만난 날. 코인은 이 순간부터 앞으로 일한 만큼만 쌓인다
    const opened = w.since ? new Date(w.since) : null;
    const isToday = opened && opened.toDateString() === new Date().toDateString();
    const sinceNote = !opened
      ? ''
      : isToday
        ? t('shop.walletSinceToday')
        : t('shop.walletSince', { date: opened.toLocaleDateString(locale()) });

    // 맨 위 페이지 버튼 (스크롤해도 따라 붙는다). 개수도 같이
    const count = (k) => (k === 'new' ? (freshSnap ? freshSnap.length : freshNow.length) : pageList[k].filter((x) => x.key !== 'none').length);
    // '새로 열림' 은 새로 열린 게 있을 때만 맨 앞에
    const jumps = [...(freshNow.length || page === 'new' ? ['new'] : []), 'meal', 'snack', 'acc', 'toy', ...(pageList.star.length ? ['star'] : [])]
      .map((k) => `<button class="chip ${k === page ? 'on' : ''} ${k === 'new' ? 'chip-new' : ''}" data-shop-page="${k}">${t('shop.' + k)}<small>${count(k)}</small></button>`)
      .join('');
    // 이 페이지에 보인 새로 열린 것은 잠깐 뒤 본 걸로 (다음에 그릴 때 NEW 가 꺼진다)
    const seenNow = pageItems.filter((x) => freshKeys.has(x.key)).map((x) => x.key);
    if (seenNow.length) setTimeout(() => markUnlocksSeen(seenNow), 1500);
    // 지갑은 맨 위에 한 줄로, 분류 버튼과 칸 거르기는 한 덩어리로 묶어 스크롤해도 따라 붙게 한다.
    // (예전엔 지갑 상자가 분류 버튼과 물건 사이에 끼어 있어서 첫 화면에 물건이 거의 안 보였고,
    //  칸 거르기 줄이 분류 버튼 줄 위를 덮었다). 따라 붙는 줄 오른쪽에 지금 가진 코인
    return `
      <h2>${t('shop.title')}</h2>
      <p class="muted" style="margin-top:-4px">${t('shop.sub')}</p>
      <div class="panel wallet">
        <div class="coins ico-row">${coins(w.balance, 24)}</div>
        <div class="wallet-meta">
          <div>${t('shop.earned')} ${fmt(w.earned)} · ${t('shop.spent')} ${fmt(w.spent)}</div>
          <div class="small">${t('shop.rate', { a: fmt(w.rate.first), cap: fmt(w.rate.cap), b: fmt(w.rate.after), w: fmt(w.welcome) })}</div>
          ${sinceNote ? `<div class="small">${esc(sinceNote)}</div>` : ''}
        </div>
      </div>
      <div class="shop-sticky">
        <nav class="shop-jump">${jumps}<span class="jump-coins ico-row" title="${esc(t('shop.balanceNow'))}">${coins(w.balance, 13)}</span></nav>
        ${costumeChips}${starChips}
      </div>

      ${pageBody}`;
  },

  stats() {
    const g = D.growth;
    const S = D.stats;
    const wd = (i) => t('weekday.' + i);

    // 대시보드: 처음 만난 뒤로 지금까지·이번 달·오늘의 출력 토큰과 번 코인
    const dash = S.dash;
    const dashRow = (key, v) => `
        <div class="dash-row">
          <div class="dash-when">${t('dash.' + key)}</div>
          <div class="dash-cell"><span class="dash-k">${t('dash.tokens')}${info('chars')}</span><span class="dash-v" title="${fmt(v.o)}">${fmt(v.o)}</span></div>
          <div class="dash-cell"><span class="dash-k">${t('dash.coins')}</span><span class="dash-v coin ico-row">${coins(v.coins, 18)}</span></div>
        </div>`;

    // 고양이의 가계부: 식비 · 품위 유지비 · 유흥비 (· 기타)
    const L = S.ledger;
    const CAT_ICON = { food: 'ricebowl', dignity: 'ribbon', fun: 'paw', etc: 'gift' };
    // '?' = 구매 목록이 잘려 어디 썼는지 모르는 예전 코인 (main/stats.js 의 untracked)
    const itemName = (it) => (it.key === '?' ? t('ledger.untracked') : it.kind === 'motion' ? t('motion.' + it.key) : it.kind ? t('item.' + it.key) : t('ledger.gone', { key: it.key })); // 2.0.0 전에 산 모션도 가계부에는 남는다
    // 통계 화면에는 항목마다 LEDGER_SHOWN 줄까지만 보이고 나머지는 '… 외 N개'. 전부는 '자세히 보기' 팝업에서
    const ledgerLi = (it) => `<li><span class="ledger-nm">${esc(itemName(it))}</span>${it.count > 1 ? `<span class="ledger-x">×${it.count}</span>` : ''}<span class="ledger-dots"></span><span class="ledger-amt">${fmt(it.total)}</span></li>`;
    const ledgerCatsOf = (all) => L.cats
      .map(
        (c) => `
        <div class="ledger-cat">
          <div class="ledger-head">${icon(PixelArt.has(CAT_ICON[c.cat]) ? CAT_ICON[c.cat] : 'gift', 18)}<b>${t('ledger.' + c.cat)}</b><span class="muted">${t('ledger.' + c.cat + 'Sub')}</span><span class="ledger-sum">${fmt(c.total)}</span></div>
          <ul>${(all ? c.items : c.items.slice(0, LEDGER_SHOWN)).map(ledgerLi).join('')}${
            !all && c.items.length > LEDGER_SHOWN ? `<li class="ledger-more">${t('ledger.more', { n: c.items.length - LEDGER_SHOWN })}</li>` : ''
          }</ul>
        </div>`,
      )
      .join('');
    const ledgerCats = ledgerCatsOf(false);
    const ledgerTotal = `<div class="ledger-total"><b>${t('ledger.total')}</b><span class="muted">${t('ledger.count', { n: L.count })}</span><span class="ledger-sum">${fmt(L.total)}</span></div>`;
    // 팝업에 넣을 전체 가계부
    ledgerFull = L.count ? `<div class="panel ledger">${ledgerCatsOf(true)}${ledgerTotal}</div>` : '';

    // 요일 × 시간 히트맵
    const heat = S.heat;
    const heatCells = heat.max
      ? heat.grid
          .map(
            (row, w) => `<div class="lab">${wd(w)}</div>` +
              row
                .map((n, h) => {
                  const a = n ? 0.15 + (n / heat.max) * 0.85 : 0;
                  return `<div class="cell" style="--a:${a.toFixed(2)}" title="${t('stats.heatCell', { day: wd(w), hour: h, n })}"></div>`;
                })
                .join(''),
          )
          .join('')
      : '';

    // 순서: 글쓰기 기록(대시보드·누적 기록·요일×시간) → 게임 쪽 기록(가계부·경험치 내역)
    return `
      <div class="panel insight" data-act="comfort" title="${esc(t('stats.comfortHint'))}">
        <canvas class="pixel" data-stage="${D.growth ? D.growth.stageKey : 'cat'}" data-acc="${esc(D.settings.accessory || 'none')}" data-mood="active"></canvas>
        <div class="insight-txt"><p>${esc(insightLine || (insightLine = T.line('comfort')))}</p></div>
      </div>

      <h2>${t('dash.title')}</h2>
      <p class="muted" style="margin-top:-4px">${t('dash.sub', { a: fmt(D.shop.wallet.rate.first), cap: fmt(D.shop.wallet.rate.cap), b: fmt(D.shop.wallet.rate.after) })}</p>
      <div class="panel dash">
        ${dashRow('all', dash.all)}
        ${dashRow('month', dash.month)}
        ${dashRow('today', dash.today)}
      </div>

      <div class="h2-row"><h2>${t('stats.cumulative')}</h2><button class="btn head-act" data-act="card">${icon('sparkle', 12)}${t('card.open')}</button></div>
      <p class="muted" style="margin-top:-4px">${t('stats.cumulativeSub')}</p>
      <div class="panel">
        <table class="table">
          <tr><td>${t('vc.notes')}${info('vaultNotes')}</td><td>${fmt(D.vault.notes)}</td></tr>
          <tr><td>${t('vc.vaultChars')}${info('vaultChars')}</td><td>${fmt(D.vault.vaultChars)} <span class="muted">(${compact(D.vault.vaultChars)})</span></td></tr>
          <tr><td>${t('vc.vaultLinks')}</td><td>${fmt(D.vault.vaultLinks)}</td></tr>
          <tr><td>${t('cc.days')}</td><td>${fmt(D.vault.activeDays)}</td></tr>
          <tr><td>${t('cc.peak')}</td><td>${hourName(D.vault.peakHour)}</td></tr>
          <tr><td>${t('vc.folder')}</td><td>${esc(D.vault.favFolder || '-')}</td></tr>
        </table>
        <p class="muted" style="margin:10px 0 0">${esc(bookLine || (bookLine = bookCompare(D.all.c)))}</p>
      </div>

      <h2>${t('stats.heatmap')}</h2>
      <p class="muted" style="margin-top:-4px">${t('stats.heatmapSub')}</p>
      <div class="panel">
        ${heat.max ? `<div class="heat">${heatCells}</div>
        <div class="heathours"><span></span>${Array.from({ length: 24 }, (_, h) => `<span>${h % 6 === 0 ? h : ''}</span>`).join('')}</div>`
          : `<p class="muted center" style="margin:0">${t('stats.heatEmpty')}</p>`}
      </div>

      <div class="h2-row"><h2>${t('ledger.title')}</h2>${L.count ? `<button class="btn head-act" data-act="ledgerMore">${t('ledger.detail')}</button>` : ''}</div>
      <p class="muted" style="margin-top:-4px">${t('ledger.sub')}</p>
      <div class="panel ledger">
        ${L.count
          ? `${ledgerCats}
        ${ledgerTotal}`
          : `<p class="muted center" style="margin:0">${t('ledger.empty')}</p>`}
      </div>

      <h2>${t('stats.xpBreakdown')}</h2>
      <div class="panel">
        <table class="table">
          <tr><td>${t('stats.usageXp')}</td><td>${fmt(g ? g.usageXp : 0)}</td></tr>
          <tr><td>${t('stats.bonusXp')}</td><td>${fmt(g ? g.bonusXp : 0)}</td></tr>
          <tr><td><b>${t('stats.total')}</b></td><td>${fmt(g ? g.xp : 0)}</td></tr>
        </table>
        <p class="muted" style="font-size:11px;margin:8px 0 0">${t('stats.formula', { c: D.formula.CHARS_PER_XP, l: D.formula.XP_PER_LINK, n: D.formula.XP_PER_NOTE, s: D.formula.XP_PER_SESSION })}</p>
      </div>

      <h2>${t('home.recentXp')}</h2>
      <div class="panel">
        ${D.game.recentBonus.length ? `<ul class="feed">${D.game.recentBonus.map((b) => `<li><span>${esc(why(b))}</span><span class="xp-plus">+${fmt(b.xp)} XP</span></li>`).join('')}</ul>` : `<p class="muted center" style="margin:0">${t('home.recentXpEmpty')}</p>`}
      </div>`;
  },

  settings() {
    const s = D.settings;
    const sw = (key, on) => `<label class="switch"><input type="checkbox" data-key="${key}" ${on ? 'checked' : ''}><span></span></label>`;
    // 프로젝트가 많으면 처음 몇 개만 보이고 나머지는 '더보기'로 접어 둔다
    // [옵시디언] 프로젝트 = 볼트 맨 윗단 폴더 (맨 위에 있는 노트는 '볼트 맨 위')
    // [옵시디언] 하위 폴더는 펼쳐서 따로 뺄 수 있다 (1.6.0). 위 폴더가 빠져 있으면 아래는 손댈 수 없게 둔다
    const ex = new Set(s.excludedProjects || []);
    const subRows = (p) => {
      const off = [p.excluded];
      return ((D.subfolders && D.subfolders[p.id]) || [])
        .map((f) => {
          const parentOff = off[f.depth];
          off[f.depth + 1] = parentOff || ex.has(f.id);
          return `<label class="sub" style="padding-left:${14 + f.depth * 14}px"><input type="checkbox" data-project="${esc(f.id)}" ${ex.has(f.id) ? '' : 'checked'} ${parentOff ? 'disabled' : ''}><span>${esc(f.name)}</span></label>`;
        })
        .join('');
    };
    const subToggle = (p) => {
      const n = ((D.subfolders && D.subfolders[p.id]) || []).length;
      if (!n) return '';
      const open = subOpen.has(p.id);
      return `<button class="btn ghost sub-toggle" data-act="subfolders" data-id="${esc(p.id)}">${open ? t('set.subLess') : t('set.subMore', { n: fmt(n) })}</button>` + (open ? subRows(p) : '');
    };
    const projRow = (p) => `<label><input type="checkbox" data-project="${esc(p.id)}" ${p.excluded ? '' : 'checked'}><span>${esc(p.root ? t('set.rootFolder') : p.label || t('set.goneFolder'))}</span><small>${t('set.projectItem', { n: fmt(p.chars), date: p.last ? new Date(p.last).toLocaleDateString(locale()) : '-' })}</small></label>` + subToggle(p);
    const shown = projectsOpen ? D.projects : D.projects.slice(0, PROJECTS_SHOWN);
    const more = D.projects.length - PROJECTS_SHOWN;
    const projects = D.projects.length
      ? shown.map(projRow).join('') +
        (more > 0 ? `<button class="btn ghost more" data-act="projectsMore">${projectsOpen ? t('set.projectsLess') : t('set.projectsMore', { n: more })}</button>` : '')
      : `<p class="muted">${t('set.noProjects')}</p>`;
    // 모션: 상황마다 카드 한 장. 지금 고른 모션이 움직이는 그림으로 보이고(여러 개면 옆으로 넘겨 본다),
    // 아래 '모션 설정하기' 로 끌어다 놓는 편집 창을 연다 (openMotionEditor)
    const motionCards = motionGroups();
    // 순서: 자주 만지는 것(캐릭터·말·생활 알림) → 모션 → 연결·프로젝트 → 가끔 쓰는 것·되돌릴 수 없는 것(초기화).
    // 설정이 길어서 맨 위에 섹션 바로 가기를 둔다
    const goal = D.goal || { on: true, unit: 'words', target: 300 };
    const focusMin = (D.focus && D.focus.min) || 25;
    const toc = [['set-goal', 'goal.setHead'], ['set-voice', 'set.voice'], ['set-life', 'set.life'], ['set-motions', 'set.motions'], ['set-projects', 'set.projects'], ['set-misc', 'set.misc'], ['set-reset', 'set.reset']]
      .map(([id, key]) => `<button class="chip" data-jump="${id}">${t(key)}</button>`)
      .join('');
    return `
      <nav class="set-toc">${toc}</nav>
      <h2>${t('set.character')}</h2>
      <div class="panel">
        <div class="field"><div class="lbl">${t('set.name')}</div><input type="text" data-key="petName" value="${esc(s.petName)}" maxlength="12"></div>
        <div class="field"><div class="lbl">${t('set.size')}<small>${t('set.sizeSub')}</small></div>
          <div class="inline"><input type="range" list="scale-ticks" min="1" max="5" step="1" data-key="scale" value="${scaleStep(s.scale)}"><b class="pix" id="scale-v">${t('set.sizeStep', { n: scaleStep(s.scale) })}</b></div>
          <datalist id="scale-ticks"><option value="1"></option><option value="2"></option><option value="3"></option><option value="4"></option><option value="5"></option></datalist></div>
        <div class="field"><div class="lbl">${t('set.mute')}<small>${t('set.muteSub')}</small></div>${sw('__mute', !s.soundEnabled)}</div>
        <div class="field theme-field"><div class="lbl">${t('set.theme')}<small>${t('set.themeSub')}</small></div>
          <div class="theme-picks">${THEMES.map((k) => `<button class="theme-pick ${themeOf(s.theme) === k ? 'on' : ''}" data-theme-pick="${k}" aria-pressed="${themeOf(s.theme) === k}">${k === 'auto' ? `<i class="sw sw-auto"></i>` : `<i class="sw" style="background:${THEME_SWATCH[k][0]}"><b style="background:${THEME_SWATCH[k][1]}"></b></i>`}${t('theme.' + k)}</button>`).join('')}</div></div>
        <div class="field"><div class="lbl">${t('obs.showPet')}<small>${t('obs.showPetDesc')}</small></div>${sw('showPet', s.showPet !== false)}</div>
      </div>

      <h2 id="set-goal">${t('goal.setHead')}</h2>
      <div class="panel">
        <div class="field"><div class="lbl">${t('goal.setOn')}<small>${t('goal.setOnDesc', { coins: 100 })}</small></div><label class="switch"><input type="checkbox" data-goal-on ${goal.on ? 'checked' : ''}><span></span></label></div>
        ${
          goal.on
            ? `<div class="field"><div class="lbl">${t('goal.setUnit')}<small>${t('goal.setUnitDesc')}</small></div>
          <select data-goal-unit-sel><option value="words" ${goal.unit === 'words' ? 'selected' : ''}>${t('goal.unit.words')}</option><option value="chars" ${goal.unit === 'chars' ? 'selected' : ''}>${t('goal.unit.chars')}</option></select></div>
        <div class="field"><div class="lbl">${t('goal.setTarget')}<small>${t(goal.unit === 'words' ? 'goal.setTargetDescW' : 'goal.setTargetDescC')}</small></div>
          <div class="inline"><input type="number" min="10" max="${goal.unit === 'words' ? 20000 : 100000}" step="10" data-goal-target value="${goal.target}">${t('goal.unit.' + goal.unit)}</div></div>`
            : ''
        }
        <div class="field"><div class="lbl">${t('focus.setLen')}<small>${t('focus.setLenDesc')}</small></div>
          <select data-key="focusMin">${[15, 25, 50].map((m) => `<option value="${m}" ${m === focusMin ? 'selected' : ''}>${t('focus.menuLen', { m })}</option>`).join('')}</select></div>
      </div>

      <h2 id="set-voice">${t('set.voice')}</h2>
      <div class="panel">
        <div class="field"><div class="lbl">${t('set.language')}<small>${t('set.languageSub')}</small></div>
          <select data-key="language">
            <option value="ko" ${s.language === 'ko' ? 'selected' : ''}>한국어</option>
            <option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option>
            <option value="zh" ${s.language === 'zh' ? 'selected' : ''}>中文</option>
          </select></div>
        <div class="field"><div class="lbl">${t('set.bubbles')}<small>${t('set.bubblesSub')}</small></div>${sw('bubblesEnabled', s.bubblesEnabled)}</div>
        <div class="field"><div class="lbl">${t('set.chatter')}<small>${t('set.chatterSub')}</small></div>${sw('chatter', s.chatter)}</div>
        <div class="field"><div class="lbl">${t('set.aiTips')}<small>${t('set.aiTipsSub')}</small></div>${sw('aiTips', s.aiTips !== false)}</div>
      </div>

      <h2 id="set-life">${t('set.life')}</h2>
      <div class="panel">
        <div class="field"><div class="lbl">${t('set.lunch')}</div><div class="inline"><input type="time" data-key="lunchTime" value="${esc(s.lunchTime)}">${sw('lunchEnabled', s.lunchEnabled)}</div></div>
        <div class="field"><div class="lbl">${t('set.dinner')}</div><div class="inline"><input type="time" data-key="dinnerTime" value="${esc(s.dinnerTime)}">${sw('dinnerEnabled', s.dinnerEnabled)}</div></div>
        <div class="field"><div class="lbl">${t('set.rest')}<small>${t('set.restSub')}</small></div><div class="inline"><input type="number" min="15" max="600" step="5" data-key="restAfterMin" value="${s.restAfterMin}">${t('set.minutes')}</div></div>
        <div class="field"><div class="lbl">${t('set.sleepy')}<small>${t('set.sleepySub')}</small></div><div class="inline"><input type="number" min="5" max="600" step="5" data-key="sleepyAfterMin" value="${s.sleepyAfterMin}">${t('set.minutes')}</div></div>
        <div class="field"><div class="lbl">${t('set.sleep')}</div><div class="inline"><input type="number" min="10" max="1440" step="5" data-key="sleepAfterMin" value="${s.sleepAfterMin}">${t('set.minutes')}</div></div>
        <div class="field"><div class="lbl">${t('set.bedtime')}<small>${t('set.bedtimeSub')}</small></div><div class="inline"><input type="time" data-key="bedtime" value="${esc(s.bedtime)}"></div></div>
        <div class="field"><div class="lbl">${t('set.lateNight')}<small>${t('set.lateNightSub')}</small></div>${sw('lateNightEnabled', s.lateNightEnabled)}</div>
      </div>

      <h2 id="set-motions">${t('set.motions')}</h2>
      <p class="muted" style="margin-top:-4px">${t('set.motionsSub')}</p>
      <div class="panel mset-row"><div class="field"><div class="lbl">${t('set.setMotions')}<small>${t('set.setMotionsSub')}</small></div>${sw('setMotionsOn', s.setMotionsOn !== false)}</div></div>
      <div class="mgroups">${motionCards}</div>

      <h2 id="set-projects">${t('set.projects')}</h2>
      <div class="panel">
        <p class="muted" style="margin-top:0;font-size:12px">${t('set.projectsSub')}</p>
        <div class="projects">${projects}</div>
      </div>

      <h2 id="set-misc">${t('set.misc')}</h2>
      <div class="panel">
        <div class="field"><div class="lbl">${t('tray.resetPos')}</div><button class="btn ghost" data-act="position">${t('obs.resetPosBtn')}</button></div>
        ${'lowPower' in s ? `<div class="field"><div class="lbl">${t('set.lowPower')}<small>${t('set.lowPowerSub')}</small></div>${sw('lowPower', s.lowPower)}</div>` : ''}
        <div class="field"><div class="lbl">${t('set.showWelcome')}</div><button class="btn ghost" data-act="welcome">${t('set.open')}</button></div>
        <div class="field"><div class="lbl">${t('set.showNews')}</div><button class="btn ghost" data-act="whatsNew">${t('set.open')}</button></div>
        <div class="field"><div class="lbl">${t('obs.feedback')}<small>${t('obs.feedbackDesc')}</small></div><button class="btn ghost" data-act="feedback">${t('obs.feedbackBtn')}</button></div>
      </div>

      <h2 id="set-reset">${t('set.reset')}</h2>
      <div class="panel danger">
        <div class="field"><div class="lbl">${t('set.resetLbl')}<small>${t('set.resetSub')}</small></div><button class="btn danger" data-act="resetAsk">${t('set.resetBtn')}</button></div>
        <div id="reset-box" hidden>
          <p class="muted" style="font-size:12px;margin:8px 0 6px">${t('set.resetType', { phrase: esc(t('set.resetPhrase')) })}</p>
          <input type="text" id="reset-input" autocomplete="off" spellcheck="false" placeholder="${esc(t('set.resetPhrase'))}">
        </div>
      </div>

      <p class="muted" style="font-size:11px;text-align:center;margin:18px 0 4px">${t('set.disclaimer')}</p>`;
  },
};

function progressOf(a) {
  return a.progress ? Math.min(1, a.progress[0] / a.progress[1]) : 0;
}

function renderView() {
  paintView(isTab(tab) ? TABS[tab]() : '');
}

// 지금 화면에 그려 둔 탭과 그 글. 데이터가 와도 이 탭이 보여 주는 게 그대로면 다시 그리지 않는다
let viewHtml = null;
let viewTab = null;
let viewStale = false; // 입력하는 중이라 미뤄 둔 다시 그리기가 있다

function paintView(html) {
  const view = $('#view');
  view.innerHTML = html;
  view.dataset.tab = tab;
  viewHtml = html;
  viewTab = tab;
  viewStale = false;
  // 팝업·미리보기·첫 화면처럼 #view 밖에서 아직 붙어 있는 그림은 계속 움직이게 둔다 (방금 지운 탭 그림만 뺀다)
  minis = [...$$('canvas[data-stage]', view).map(mini), ...minis.filter((m) => m.canvas.isConnected && !view.contains(m.canvas))];
  bindView(view);
  labelFields(view);
  mountGraph(view);
}

const typingIn = (root) => {
  const a = document.activeElement;
  return !!a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName) && (!root || root.contains(a));
};

// 새 데이터가 왔을 때: 지금 탭의 글이 바뀌었을 때만 다시 그린다 (깜빡임·움직이던 그림·떠 있던 설명을 지키려고)
function refreshView() {
  if (!isTab(tab)) return;
  const html = TABS[tab]();
  if (html === viewHtml && viewTab === tab) {
    viewStale = false;
    return;
  }
  // 무언가 입력하는 중이면 끝날 때(포커스가 빠질 때)까지 미룬다
  if (typingIn()) {
    viewStale = true;
    return;
  }
  const y = $('#view').scrollTop;
  paintView(html);
  $('#view').scrollTop = y;
}
$('#view').addEventListener('focusout', () => {
  setTimeout(() => viewStale && !typingIn() && D && refreshView(), 0);
});

// 설정 줄(.field)의 이름표를 그 줄의 입력칸·스위치·슬라이더 이름으로 이어 준다 (화면 읽기 프로그램용)
let fieldSeq = 0;
function labelFields(root) {
  for (const f of $$('.field', root)) {
    const lbl = $('.lbl', f);
    if (!lbl) continue;
    if (!lbl.id) lbl.id = 'fl-' + ++fieldSeq;
    for (const el of $$('input, select', f)) if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) el.setAttribute('aria-labelledby', lbl.id);
  }
}

// 탭이 아닌 속 함수 (__ 로 시작) 는 탭으로 치지 않는다
const isTab = (t) => typeof TABS[t] === 'function' && !t.startsWith('__');

function setTab(t) {
  // '새로 생긴 것' 말풍선 링크: 홈을 열고 창을 띄운다
  if (t === 'whatsnew') {
    setTab('home');
    return showWhatsNew();
  }
  // 퀘스트는 홈 안으로 들어갔다 (트레이 메뉴·말풍선 링크가 'quests' 로 부른다)
  const jump = t === 'quests' ? 'hs-quests' : null;
  if (jump) t = 'home';
  if (!isTab(t)) t = 'home';
  tab = t;
  insightLine = null;
  bookLine = null;
  try {
    history.replaceState(null, '', '#' + t);
  } catch {
    // [옵시디언] iframe(about:blank)에서는 주소를 못 바꿀 수 있다
  }
  renderTop();
  renderView();
  $('#view').scrollTop = 0;
  if (jump) { const el = document.getElementById(jump); if (el) el.scrollIntoView({ block: 'start' }); }
}

// ---------- 동작 ----------

async function apply(p) {
  if (p && p.error) toast(p.error, 'bang');
  if (p) D = p;
  renderTop();
}

// 설정 숫자 칸 값 고르기. 못 쓰는 값이면 null (칸은 저장된 값으로 되돌린다)
// 졸림은 잠보다 늦을 수 없다: 졸림을 잠보다 길게 치면 잠 시간으로, 잠을 졸림보다 짧게 치면 졸림 시간으로 맞춘다
function checkNumber(el, key) {
  const raw = String(el.value).trim();
  const n = Number(raw);
  if (!raw || !isFinite(n)) {
    el.value = D.settings[key];
    return null;
  }
  const min = el.min !== '' ? Number(el.min) : -Infinity;
  const max = el.max !== '' ? Number(el.max) : Infinity;
  let v = Math.round(Math.max(min, Math.min(max, n)));
  if (key === 'sleepyAfterMin' && isFinite(D.settings.sleepAfterMin)) v = Math.min(v, D.settings.sleepAfterMin);
  if (key === 'sleepAfterMin' && isFinite(D.settings.sleepyAfterMin)) v = Math.max(v, D.settings.sleepyAfterMin);
  el.value = v;
  return v === D.settings[key] ? null : v;
}

function bindView(view) {
  $$('[data-act]', view).forEach((b) => b.addEventListener('click', () => act(b.dataset.act, b)));
  // 누르는 카드(옷장 코스튬)는 키보드로도 고르고 Enter·Space 로 누른다
  $$('[data-item]', view).forEach((el) => {
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === el) {
        e.preventDefault();
        el.click();
      }
    });
  });

  const keepScroll = () => {
    const y = $('#view').scrollTop;
    renderView();
    $('#view').scrollTop = y;
  };
  // 상점에서 분류·칸을 바꾸면 목록 길이가 달라진다. 이미 목록 안으로 내려와 있었으면 새 목록의 맨 처음으로 (따라 붙는 줄 바로 아래)
  const keepShopTop = () => {
    const v = $('#view');
    const y = v.scrollTop;
    renderView();
    const bar = $('.shop-sticky', v);
    // 따라 붙는 줄은 붙어 있는 자리를 돌려주니, 맨 위에서 잰다
    v.scrollTop = 0;
    const top = bar ? bar.getBoundingClientRect().top - v.getBoundingClientRect().top : 0;
    v.scrollTop = bar && y > top ? top : y;
  };
  // 누르면 그 칸에 입고, 이미 입은 걸 누르면 벗는다
  $$('[data-item]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      const it = D.game.items.find((x) => x.key === el.dataset.item);
      if (!it || !it.slot) return;
      const wearing = (D.settings.outfit || {})[it.slot] === it.key;
      await apply(await pet.set({ outfit: { [it.slot]: wearing ? null : it.key } }));
      if (!wearing) hero.play((D.motion.lists.wear || [])[0] || 'happy');
      toast(wearing ? t('ward.tookOff', { name: it.name }) : t('ward.worn', { name: it.name }), wearing ? 'check' : it.key);
      keepScroll();
    }),
  );
  $$('[data-ward-tab]', view).forEach((el) =>
    el.addEventListener('click', () => {
      wardTab = el.dataset.wardTab;
      keepScroll();
    }),
  );
  $$('[data-inv-page]', view).forEach((el) =>
    el.addEventListener('click', () => {
      invPage = el.dataset.invPage;
      keepScroll();
    }),
  );
  // 인벤토리 장난감 꺼내기. 이미 놀고 있으면 main 쪽 startPlay 가 놀이를 끝낸다
  $$('[data-play]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      const key = el.dataset.play;
      const r = await pet.play(key);
      if (r && r.on) toast(t('inv.played', { name: t('item.' + key) }), key);
      else if (r && r.stopped) toast(t('inv.stopped'), 'check');
      else toast(t('inv.noPlay'), 'paw');
    }),
  );
  $$('[data-unwear]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      await apply(await pet.set({ outfit: { [el.dataset.unwear]: null } }));
      keepScroll();
    }),
  );
  $$('[data-outfit-save]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      const i = Number(el.dataset.outfitSave);
      const saves = [...(D.settings.outfitSaves || [null, null, null])];
      saves[i] = { ...(D.settings.outfit || {}) };
      await apply(await pet.set({ outfitSaves: saves }));
      toast(t('ward.saved', { n: i + 1 }), 'check');
      keepScroll();
    }),
  );
  // 저장한 코디 지우기 (그 칸이 다시 비어 있음이 된다)
  $$('[data-outfit-del]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      const i = Number(el.dataset.outfitDel);
      const saves = [...(D.settings.outfitSaves || [null, null, null])];
      if (!saves[i]) return;
      saves[i] = null;
      await apply(await pet.set({ outfitSaves: saves }));
      toast(t('ward.deleted', { n: i + 1 }), 'check');
      keepScroll();
    }),
  );
  $$('[data-outfit-load]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      const o = (D.settings.outfitSaves || [])[Number(el.dataset.outfitLoad)];
      if (!o) return;
      // 저장한 코디로 통째로 갈아입는다 (그사이 못 입게 된 건 빠진다)
      await apply(await pet.set({ outfit: o, replace: true }));
      hero.play((D.motion.lists.wear || [])[0] || 'happy');
      toast(t('ward.loaded', { n: Number(el.dataset.outfitLoad) + 1 }), 'sparkle');
      keepScroll();
    }),
  );
  // 세트 카드의 '전용 모션' 버튼 (옷장 카드를 눌러 입는 것과 겹치지 않게 막는다)
  $$('[data-setmo]', view).forEach((el) =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openSetMotions(el.dataset.setmo);
    }),
  );
  $$('[data-toy-demo]', view).forEach((el) => el.addEventListener('click', () => openToyDemo(el.dataset.toyDemo)));
  $$('[data-shop-costume]', view).forEach((el) =>
    el.addEventListener('click', () => {
      shopCostumeTab = el.dataset.shopCostume;
      keepShopTop();
    }),
  );
  $$('[data-theme-pick]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      D.settings.theme = el.dataset.themePick;
      applyTheme();
      await apply(await pet.set({ theme: el.dataset.themePick }));
      refreshView(); // 고른 테마 단추를 바로 칠한다
    }),
  );
  $$('[data-shop-star]', view).forEach((el) =>
    el.addEventListener('click', () => {
      shopStarTab = el.dataset.shopStar;
      keepShopTop();
    }),
  );

  $$('input[data-key]', view).forEach((el) => {
    const key = el.dataset.key;
    const ev = el.type === 'range' || el.type === 'text' ? 'input' : 'change';
    el.addEventListener(ev, async () => {
      if (key === 'scale') $('#scale-v').textContent = t('set.sizeStep', { n: el.value });
      if (key === '__login') return apply(await pet.setLogin(el.checked));
      if (key === '__mute') {
        await apply(await pet.set({ soundEnabled: !el.checked }));
        return toast(t(el.checked ? 'toast.muted' : 'toast.unmuted'), el.checked ? 'bellOff' : 'bell');
      }
      let value = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? Number(el.value) : el.value;
      if (key === 'petName' && !String(value).trim()) return;
      // 숫자 칸: 비웠거나 숫자가 아니면 원래 값으로 되돌리고, 칸의 최소·최대 안으로 맞춘다
      if (el.type === 'number') {
        value = checkNumber(el, key);
        if (value == null) return;
      }
      // 시각 칸: 'HH:MM' 이 아니면(지웠거나 덜 쳤으면) 원래 값으로
      if (el.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        el.value = D.settings[key] || '';
        return;
      }
      // 슬라이더는 끄는 동안 계속 바뀌니까 조금 모았다가 보낸다 (창 크기까지 따라 바뀐다)
      const wait = el.type === 'text' ? 400 : el.type === 'range' ? 150 : 0;
      clearTimeout(el._t);
      el._t = setTimeout(async () => {
        await apply(await pet.set({ [key]: value }));
        if (el.type !== 'text' && el.type !== 'range') toast(t('toast.saved'));
      }, wait);
    });
  });

  $$('[data-star-fur]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      await apply(await pet.set({ fur: el.dataset.starFur }));
      renderView();
      toast(t('toast.saved'));
    }),
  );
  $$('[data-buy]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      const key = el.dataset.buy;
      const it = [...D.shop.acc, ...D.shop.food, ...D.shop.toy, ...(D.shop.star || [])].find((x) => x.key === key);
      const r = await pet.buy(key);
      if (r.payload) await apply(r.payload);
      if (r.ok) {
        hero.play('happy');
        const name = it && it.kind === 'fur' ? t('fur.' + it.fur) : t('item.' + key);
        toast(t('toast.bought', { name }), it && it.stars ? 'star' : key);
      } else if (r.reason === 'level') toast(t('toast.needLevel', { n: it.level }), 'lock');
      else if (r.reason === 'coins') toast(t('toast.needCoins'), 'coin');
      else if (r.reason === 'stars') toast(t('toast.needStars'), 'star');
      renderView();
    }),
  );

  // 업적 거르기
  $$('[data-ach-filter]', view).forEach((el) =>
    el.addEventListener('click', () => {
      achFilter = el.dataset.achFilter;
      renderView();
    }),
  );
  // 업적 묶음으로 바로 가기. 고르고 나면 다시 '묶음으로 가기' 로 돌려 둔다
  const achJump = $('#ach-jump', view);
  if (achJump)
    achJump.addEventListener('change', () => {
      const el = document.getElementById('ach-' + achJump.value);
      if (el) el.scrollIntoView({ block: 'start' });
      achJump.value = '';
    });
  // 설정 섹션으로 바로 가기
  $$('[data-jump]', view).forEach((el) =>
    el.addEventListener('click', () => {
      const to = document.getElementById(el.dataset.jump);
      if (to) to.scrollIntoView({ block: 'start' });
    }),
  );
  // 설정의 모션 그림은 눌러도 크게 보인다 (우클릭과 같다)
  $$('.mthumb[data-motion-key]', view).forEach((el) =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showMotionPeek(el, e);
    }),
  );

  // 상점 페이지 바꾸기
  $$('[data-shop-page]', view).forEach((el) =>
    el.addEventListener('click', () => {
      shopPage = el.dataset.shopPage;
      keepShopTop();
    }),
  );

  // 상점 코스튬 카드의 입기·벗기
  $$('[data-shop-wear]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      const it = D.shop.acc.find((x) => x.key === el.dataset.shopWear);
      if (!it || !it.slot) return;
      const wearing = (D.settings.outfit || {})[it.slot] === it.key;
      const name = t('item.' + it.key);
      await apply(await pet.set({ outfit: { [it.slot]: wearing ? null : it.key } }));
      toast(wearing ? t('ward.tookOff', { name }) : t('ward.worn', { name }), wearing ? 'check' : it.key);
      renderView();
    }),
  );

  // 모션 묶음을 펼치고 접은 걸 기억한다
  $$('details[data-mgroup]', view).forEach((el) =>
    el.addEventListener('toggle', () => (el.open ? mgroupOpen.add(el.dataset.mgroup) : mgroupOpen.delete(el.dataset.mgroup))),
  );
  $$('[data-give]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      const key = el.dataset.give;
      const r = await pet.useFood(key);
      if (r.payload) await apply(r.payload);
      if (r.ok) toast(t('toast.served', { name: t('item.' + key) }), key);
      renderView();
    }),
  );

  // 줄다리기 난이도 (고양이 힘 하·중·상)
  $$('[data-tug-lv]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      await apply(await pet.set({ tugLevel: el.dataset.tugLv }));
      renderView();
    }),
  );

  // 장난감 카드를 우클릭하면 고양이가 갖고 노는 모습이 뜬다
  $$('[data-toy-card]', view).forEach((el) =>
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showToyPeek(el.dataset.toyCard, e);
    }),
  );

  // 우클릭하면 그 모션을 크게 해 보이는 작은 창이 뜬다
  $$('[data-motion-key]', view).forEach((el) =>
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showMotionPeek(el, e);
    }),
  );

  // 상황마다 모션 켜고 끄기 (2.0.0)
  $$('[data-moff]', view).forEach((el) =>
    el.addEventListener('change', async () => {
      const k = el.dataset.moff;
      const off = new Set((D.motion && D.motion.off) || []);
      if (el.checked) off.delete(k);
      else off.add(k);
      await apply(await pet.set({ motionsOff: [...off] }));
      toast(t(el.checked ? 'toast.motionOn' : 'toast.motionOff', { slot: t('slot.' + k) }), el.checked ? 'sparkle' : 'check');
      const y = $('#view').scrollTop;
      renderView();
      $('#view').scrollTop = y;
    }),
  );  $$('[data-medit]', view).forEach((el) => el.addEventListener('click', () => openMotionEditor(el.dataset.medit)));

  // ---------- 홈 (2.0.0) ----------
  $$('[data-fold]', view).forEach((el) =>
    el.addEventListener('click', () => {
      toggleFold(el.dataset.fold);
      const y = $('#view').scrollTop;
      renderView();
      $('#view').scrollTop = y;
    }),
  );
  // 집중 길이 고르기 (설정의 집중 시간 길이와 같은 값)
  $$('[data-focus-min]', view).forEach((el) =>
    el.addEventListener('click', async () => {
      await apply(await pet.set({ focusMin: Number(el.dataset.focusMin) }));
      renderView();
    }),
  );
  // 이미 있는 노트 열기 (노트 지도 · 최근 노트 · 외톨이 노트). 없는 노트면 아무것도 안 만든다
  $$('[data-open-note]', view).forEach((el) => {
    const go = async () => {
      const ok = await pet.openNote(el.dataset.openNote);
      if (!ok) toast(t('home.noteGone'), 'bang');
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });
  // 할 일 (플러그인 안 목록)
  const todoRun = async (p, keepFocus = false) => {
    const r = await p;
    if (r && r.payload) await apply(r.payload);
    if (r && !r.ok && r.reason === 'full') toast(t('todo.full'), 'bang');
    const y = $('#view').scrollTop;
    renderView();
    $('#view').scrollTop = y;
    if (keepFocus) {
      const inp = $('#todo-new');
      if (inp) inp.focus();
    }
    return r;
  };
  const addForm = $('.todo-add', view);
  if (addForm)
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('#todo-new', addForm);
      const text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      todoRun(pet.todoAdd(text), true);
    });
  $$('[data-todo-toggle]', view).forEach((el) =>
    el.addEventListener('change', async () => {
      const r = await todoRun(pet.todoToggle(el.dataset.todoToggle));
      if (r && r.ok && el.checked) hero.play((D.motion.lists.done || [])[0] || 'happy');
    }),
  );
  $$('[data-todo-del]', view).forEach((el) => el.addEventListener('click', () => todoRun(pet.todoRemove(el.dataset.todoDel))));
  // 할 일 순서: 손잡이를 끌어다 놓기, 손잡이에서 ↑↓ 키 (2.0.1)
  const openUl = $('#todo-open', view);
  if (openUl) {
    $$('[data-todo-row]', openUl).forEach((li) => {
      const grip = $('.todo-grip', li);
      // 손잡이를 잡았을 때만 끌린다 (글 고르기 · 체크와 안 부딪히게)
      grip.addEventListener('pointerdown', () => (li.draggable = true));
      li.addEventListener('dragend', () => (li.draggable = false));
      li.addEventListener('pointerup', () => (li.draggable = false));
    });
    dragList(openUl, '[data-todo-row]', (from, to) => {
      const id = $$('[data-todo-row]', openUl)[from].dataset.todoRow;
      todoRun(pet.todoMove(id, to));
    });
    $$('[data-todo-grip]', openUl).forEach((g) =>
      g.addEventListener('keydown', async (e) => {
        const i = Number(g.dataset.i);
        const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
        if (to < 0 || to >= $$('[data-todo-row]', openUl).length) return;
        e.preventDefault();
        const id = g.dataset.todoGrip;
        await todoRun(pet.todoMove(id, to));
        const n = $(`[data-todo-grip="${id}"]`);
        if (n) n.focus();
      }),
    );
  }
  // 글을 두 번 누르면 고친다. Enter 저장 · Esc 그만
  $$('[data-todo-text]', view).forEach((el) =>
    el.addEventListener('dblclick', () => {
      todoEditing = el.dataset.todoText;
      renderView();
      const inp = $('[data-todo-edit]');
      if (inp) {
        inp.focus();
        inp.select();
      }
    }),
  );
  $$('[data-todo-edit]', view).forEach((el) => {
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const id = todoEditing;
      todoEditing = null;
      if (save && el.value.trim()) todoRun(pet.todoEdit(id, el.value));
      else renderView();
    };
    el.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') {
        e.stopPropagation();
        finish(false);
      }
    });
    el.addEventListener('blur', () => finish(true));
  });

  $$('select[data-key]', view).forEach((el) =>
    el.addEventListener('change', async () => {
      await apply(await pet.set({ [el.dataset.key]: el.value }));
      renderView();
      toast(t('toast.saved'));
    }),
  );


  // [옵시디언 1.5.0] 하루 목표 (켜기 · 단위 · 양). 다른 칸은 그대로 두고 바꾼 것만 보낸다
  const goalNow = () => ({ ...(D.goal ? { on: D.goal.on, unit: D.goal.unit, target: D.goal.target } : {}) });
  $$('[data-goal-on]', view).forEach((el) =>
    el.addEventListener('change', async () => {
      await apply(await pet.set({ goal: { ...goalNow(), on: el.checked } }));
      renderView();
      toast(t('toast.saved'));
    }),
  );
  $$('[data-goal-unit-sel]', view).forEach((el) =>
    el.addEventListener('change', async () => {
      await apply(await pet.set({ goal: { ...goalNow(), unit: el.value, target: GOAL_PRESETS[el.value][1] } }));
      renderView();
      toast(t('toast.saved'));
    }),
  );
  $$('[data-goal-target]', view).forEach((el) =>
    el.addEventListener('change', async () => {
      const n = Math.round(Number(el.value));
      if (!(n > 0)) {
        el.value = D.goal ? D.goal.target : '';
        return;
      }
      await apply(await pet.set({ goal: { ...goalNow(), target: n } }));
      el.value = D.goal ? D.goal.target : n;
      toast(t('toast.saved'));
    }),
  );

  $$('input[data-project]', view).forEach((el) =>
    el.addEventListener('change', async () => {
      // 화면에 없는 폴더(접어 둔 프로젝트·하위 폴더)와 손댈 수 없는 칸은 지금 설정을 그대로 둔다
      const shown = $$('input[data-project]', view).filter((x) => !x.disabled);
      const ids = new Set(shown.map((x) => x.dataset.project));
      const excluded = [...(D.settings.excludedProjects || []).filter((id) => !ids.has(id)), ...shown.filter((x) => !x.checked).map((x) => x.dataset.project)];
      await apply(await pet.set({ excludedProjects: excluded }));
      toast(t('toast.applied'));
    }),
  );
}

async function act(name, el) {
  if (name === 'subfolders') {
    const id = el && el.dataset.id;
    if (subOpen.has(id)) subOpen.delete(id);
    else subOpen.add(id);
    const y = $('#view').scrollTop;
    renderView();
    $('#view').scrollTop = y;
    return;
  }
  if (name === 'projectsMore') {
    projectsOpen = !projectsOpen;
    const y = $('#view').scrollTop;
    renderView();
    $('#view').scrollTop = y;
    return;
  }
  switch (name) {
    case 'poke':
      pet.poke();
      hero.play('happy');
      break;
    case 'feed': {
      const r = await pet.feed();
      if (r && r.payload) await apply(r.payload);
      if (!r || !r.ok) {
        toast(t('toast.noMeal'), 'ricebowl');
        shopPage = 'meal';
        setTab('shop');
        break;
      }
      hero.play('nibble');
      toast(t('toast.served', { name: t('item.' + r.key) }), r.key);
      renderView();
      break;
    }
    case 'wave':
      pet.preview(name);
      hero.play(name);
      break;
    case 'stretch':
      // 설정에서 고른 '쉬자고 할 때' 모션으로
      pet.preview('slot:rest');
      hero.play((D.motion && (D.motion.lists.rest || [])[0]) || 'stretch');
      break;
    case 'toMotions':
      setTab('settings');
      setTimeout(() => {
        const el = $('.mgroups');
        if (el) el.scrollIntoView({ block: 'center' });
      }, 30);
      break;
    // [옵시디언 1.5.0] 집중 시간 · 하루 목표
    case 'focusStart':
      await apply(await pet.focusStart((D.focus && D.focus.min) || 25));
      renderView();
      break;
    case 'focusStop':
      await apply(await pet.focusStop());
      renderView();
      break;
    // 2.0.0: 쉬는 시간 · 집중 길이 고르기
    case 'breakStart':
      await apply(await pet.breakStart(Number(el && el.dataset.min) || 5));
      renderView();
      break;
    case 'breakStop':
      await apply(await pet.breakStop());
      renderView();
      break;
    case 'graph':
    case 'localGraph': {
      const ok = await pet.openGraph(name === 'localGraph');
      if (!ok) toast(t(name === 'localGraph' ? 'home.graphNeedNote' : 'home.graphOff'), 'bang');
      break;
    }
    case 'todoClear':
      await apply((await pet.todoClear()).payload);
      renderView();
      break;
    case 'homeLayout':
      openHomeLayout();
      break;
    case 'todoDoneOpen':
      todoDoneOpen = !todoDoneOpen;
      renderView();
      break;
    case 'goalEdit':
      openGoalPicker();
      break;
    case 'quiet':
      await apply(await pet.setQuiet(D.quiet ? 0 : 60));
      renderView();
      toast(D.quiet ? t('toast.quietOn') : t('toast.quietOff'), D.quiet ? 'bellOff' : 'bell');
      break;
    case 'petOn':
      // [옵시디언] 꺼 둔 펫 다시 켜기
      await apply(await pet.set({ showPet: true }));
      renderView();
      break;
    case 'position':
      await pet.resetPosition();
      toast(t('toast.posReset'), 'pin');
      break;
    case 'hooks':
      await apply(await pet.installHooks());
      if (D.hooks.installed) {
        hero.play('levelup');
        toast(t('toast.hooked'), 'plug');
      }
      renderView();
      break;
    case 'unhooks':
      if (!confirm(t('confirm.unhooks'))) return;
      await apply(await pet.uninstallHooks());
      renderView();
      toast(t('toast.unhooked'), 'plug');
      break;
    case 'reveal':
      pet.revealHooks();
      break;
    case 'card':
      openCard();
      break;
    case 'furPick':
      openFurPicker();
      break;
    case 'earPick':
      openEarPicker();
      break;
    case 'undress': {
      await apply(await pet.set({ outfit: {}, replace: true }));
      toast(t('ward.removed'), 'check');
      const y = $('#view').scrollTop;
      renderView();
      $('#view').scrollTop = y;
      break;
    }
    case 'ledgerMore':
      openModal(`<div class="modal-top"><h2>${t('ledger.title')}</h2><button class="btn ghost small" data-close>${t('modal.close')}</button></div>${ledgerFull}`, 'modal-ledger');
      break;
    case 'questRefresh': {
      const r = await pet.refreshQuests();
      await apply(r.payload);
      renderView();
      if (r.ok) toast(t('toast.questsNew'), 'scroll');
      break;
    }
    case 'comfort':
      insightLine = null;
      renderView();
      break;
    case 'resetAsk': {
      const box = $('#reset-box');
      box.hidden = false;
      const inp = $('#reset-input');
      inp.value = '';
      inp.focus();
      box.scrollIntoView({ block: 'center' });
      // 문장을 그대로 치고 엔터를 눌러야 지운다 (끝의 마침표·앞뒤 빈칸은 봐준다)
      inp.onkeydown = async (e) => {
        if (e.key !== 'Enter' || e.isComposing) return;
        const norm = (x) => x.trim().replace(/[.。]$/, '').toLowerCase();
        if (norm(inp.value) !== norm(t('set.resetPhrase'))) {
          toast(t('toast.resetWrong'), 'bang');
          return;
        }
        inp.disabled = true;
        toast(t('toast.resetting'), 'sparkle');
        await pet.resetAll();
      };
      break;
    }
    case 'dev':
      await apply(await pet.set({ devMode: !D.settings.devMode }));
      renderView();
      toast(t(D.settings.devMode ? 'toast.devOn' : 'toast.devOff'), D.settings.devMode ? 'coin' : 'lock');
      break;
    case 'welcome':
      showWelcome();
      break;
    case 'feedback': // [옵시디언]
      pet.feedback();
      break;
    case 'whatsNew':
      showWhatsNew();
      break;
  }
}

// ---------- 첫 실행 안내 ----------

let wStep = 0;
const wChoice = { name: null };

function showWelcome() {
  wStep = 0;
  wChoice.name = D.settings.petName;
  renderWelcome();
}

function renderWelcome() {
  const el = $('#welcome');
  el.hidden = false;
  const g = D.growth;
  const steps = [
    () => `
      <canvas class="pixel" data-stage="cat" data-mood="idle"></canvas>
      <h2>${t('w.title1')}</h2>
      <p>${t('w.body1')}</p>
      <div class="privacy">${icon('lock', 18)}<p><b>${t('w.privacyTitle')}</b><br>${t('w.privacy')}</p></div>
      <ul style="padding-left:18px">
        <li>${t('w.b1a')}</li>
        <li>${t('w.b1b')}</li>
        <li>${t('w.b1c')}</li>
        <li>${t('w.b1d')}</li>
      </ul>`,
    () => `
      <h2>${t('w.title2')}</h2>
      <div class="field"><div class="lbl">${t('set.name')}</div><input type="text" id="w-name" value="${esc(wChoice.name)}" maxlength="12"></div>
      <div class="lbl" style="margin-top:8px">${t('ward.ears')}<small class="muted"> · ${t('w.earsNote')}</small></div>
      <div class="fur-grid w-ears">${earCells(D.settings.ears || 'perk')}</div>
      <p>${t('w.fresh')}</p>
      <p class="muted" style="font-size:12px">${D.loading ? t('w.loading') : t('w.past', { lv: fmt(D.pastLevel || 1) })}</p>`,
    // [옵시디언 1.5.0] 어떻게 자라는지 + 하루 목표 고르기
    () => {
      const unit = wChoice.goal ? wChoice.goal.unit : (D.goal && D.goal.unit) || 'words';
      const cur = wChoice.goal ? wChoice.goal : D.goal || { on: true, unit, target: GOAL_PRESETS[unit][1] };
      const chip = (n) => `<button class="chip ${cur.on && cur.target === n ? 'on' : ''}" data-w-goal="${n}">${t(unit === 'words' ? 'goal.presetW' : 'goal.presetC', { n: fmt(n) })}</button>`;
      return `
      <h2>${t('w.goalTitle')}</h2>
      <p>${t('w.goalBody')}</p>
      <div class="chips w-goal">${GOAL_PRESETS[unit].slice(0, 4).map(chip).join('')}<button class="chip ${cur.on ? '' : 'on'}" data-w-goal="0">${t('w.goalOff')}</button></div>
      <ul style="padding-left:18px">
        <li>${t('w.b3a')}</li>
        <li>${t('w.b3c')}</li>
      </ul>
      <p class="muted" style="font-size:12px">${t('w.goalNote')}</p>`;
    },
    () => `
      <canvas class="pixel" data-stage="${g ? g.stageKey : 'cat'}" data-mood="active" data-acc="${esc(D.settings.accessory)}"></canvas>
      <h2>${t('w.title4')}</h2>
      <ul style="padding-left:18px">
        <li>${t('w.b4a')}</li>
        <li>${t('w.b4b')}</li>
        <li>${t('w.b4c')}</li>
        ${window.KC_OBSIDIAN ? `<li>${t('w.b4focus')}</li>` : ''}
      </ul>
      <p class="muted" style="font-size:12px">${t('w.trayNote')}</p>`,
  ];
  const dots = steps.map((_, i) => `<i class="${i <= wStep ? 'on' : ''}"></i>`).join('');
  el.innerHTML = `<div class="panel"><div class="steps">${dots}</div>${steps[wStep]()}
    <div class="nav">
      ${wStep > 0 ? `<button class="btn ghost" id="w-back">${t('w.back')}</button>` : '<span></span>'}
      <button class="btn primary" id="w-next">${wStep === steps.length - 1 ? t('w.start') : t('w.next')}</button>
    </div></div>`;

  minis = minis.filter((m) => document.body.contains(m.canvas));
  minis.push(...$$('canvas[data-stage]', el).map(mini));
  labelFields(el);

  const save = () => {
    const n = $('#w-name');
    if (n) wChoice.name = n.value.trim() || wChoice.name;
  };
  const back = $('#w-back');
  if (back) back.onclick = () => { save(); wStep--; renderWelcome(); };
  const hk = $('#w-hooks');
  if (hk) hk.onclick = async () => { await apply(await pet.installHooks()); renderWelcome(); };
  const lg = $('#w-login');
  if (lg) lg.onchange = async () => apply(await pet.setLogin(lg.checked));
  // 하루 목표 고르기 (1.5.0): 누르면 바로 저장한다 (0 = 목표 없이)
  $$('[data-w-goal]', el).forEach((b) =>
    b.addEventListener('click', async () => {
      const n = Number(b.dataset.wGoal);
      const unit = (D.goal && D.goal.unit) || 'words';
      wChoice.goal = { on: n > 0, unit, target: n > 0 ? n : (D.goal && D.goal.target) || GOAL_PRESETS[unit][1] };
      await apply(await pet.set({ goal: wChoice.goal }));
      $$('[data-w-goal]', el).forEach((x) => x.classList.toggle('on', x === b));
    }),
  );
  // 귀 고르기: 누르는 즉시 바탕화면 고양이도 바뀐다
  $$('[data-ear-pick]', el).forEach((b) =>
    b.addEventListener('click', async () => {
      save();
      await apply(await pet.set({ ears: b.dataset.earPick }));
      $$('[data-ear-pick]', el).forEach((x) => x.classList.toggle('on', x === b));
    }),
  );
  $('#w-next').onclick = async () => {
    save();
    if (wStep === 2) await apply(await pet.set({ petName: wChoice.name }));
    if (wStep < steps.length - 1) {
      wStep++;
      renderWelcome();
      return;
    }
    await apply(await pet.onboarded());
    el.hidden = true;
    renderView();
  };
}

// ---------- 새로 생긴 것 (업데이트 뒤 처음 열 때 한 번) ----------
// 기존 사용자가 눈치채기 어려운 새 기능을 한 장으로. 줄마다 그 기능이 있는 곳으로 가는 단추가 붙는다.
// 버전이 바뀌면 이 목록과 i18n 'wn.<id>.t/.d' 를 새로 쓴다 (호스트가 state.whatsNew 에 버전을 넣는다).
// [옵시디언] 글은 i18n-obsidian.js 에서 Vault Pet 1.3.0 기준으로 덮는다 (기록 옮기기 대신 연속 출석 선물)
const WHATS_NEW = [
  ['star', 'star', 'shop'],
  ['ears', 'heart', 'ears'],
  ['card', 'sparkle', 'card'],
  ['theme', 'gear', 'settings'],
  ['bubble', 'chat', 'home'],
  ['art', 'gift', 'shop'],
  ['streak', 'fire', 'home'],
];
// [옵시디언 1.5.0] 하루 목표 · 집중 시간 · 끝낸 할 일 · 단어 · 새 업적
const WHATS_NEW_OBS = [
  ['home2', 'home', 'home'],
  ['todo2', 'check', 'home'],
  ['map2', 'map', 'home'],
  ['quest2', 'scroll', 'home'],
  ['motion2', 'sparkle', 'motions'],
  ['toys2', 'yarn', 'shop'],
  ['gone2', 'gift', 'wardrobe'],
];
function showWhatsNew() {
  const v = D.version || '';
  const rows = (window.KC_OBSIDIAN ? WHATS_NEW_OBS : WHATS_NEW).map(
    ([id, ic, go]) => `<li class="wn-row">${icon(ic, 18)}<div><b>${t('wn.' + id + '.t')}</b><div class="muted">${t('wn.' + id + '.d')}</div></div>
      <button class="btn ghost small" data-wn-go="${go}">${t('wn.go')}</button></li>`,
  ).join('');
  const el = openModal(
    `<div class="modal-top"><h2>${t('wn.title', { v: esc(v) })}</h2><button class="btn ghost small" data-close>${t('modal.close')}</button></div>
    <p class="muted" style="margin-top:-4px">${t('wn.sub')}</p>
    <ul class="wn-list">${rows}</ul>
    <div class="center"><button class="btn primary" data-close>${t('wn.ok')}</button></div>`,
    'wn-modal',
  );
  $$('[data-wn-go]', el).forEach((b) =>
    b.addEventListener('click', () => {
      const go = b.dataset.wnGo;
      closeModal();
      if (go === 'ears') {
        setTab('wardrobe');
        openEarPicker();
      } else if (go === 'goal') {
        setTab('home');
        openGoalPicker();
      } else if (go === 'card') openCard();
      else if (go === 'motions') {
        setTab('settings');
        setTimeout(() => {
          const m = document.getElementById('set-motions');
          if (m) m.scrollIntoView({ block: 'start' });
        }, 30);
      } else setTab(go);
    }),
  );
  if (D.whatsNew) pet.whatsNewSeen().then((d) => d && (D = d));
}

// ---------- 시작 ----------

$('#dev').addEventListener('click', () => act('dev'));
$$('#tabs button').forEach((b) => {
  b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon, 15));
  b.addEventListener('click', () => setTab(b.dataset.tab));
});
// 탭 줄은 Tab 키로 한 번만 들어가고, 안에서는 화살표·Home·End 로 옮긴다
$('#tabs').addEventListener('keydown', (e) => {
  const list = $$('#tabs button');
  const i = list.indexOf(document.activeElement);
  if (i < 0) return;
  const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 }[e.key];
  if (to == null) return;
  e.preventDefault();
  const b = list[(to + list.length) % list.length];
  setTab(b.dataset.tab);
  b.focus();
});

pet.onData((d) => {
  D = d;
  renderTop();
  // 머리 부분만 늘 고치고, 탭은 보여 주는 내용이 바뀌었을 때만 다시 그린다 (입력 중이면 미룬다)
  refreshView();
});
pet.onMood((m) => {
  if (!D) return;
  D.mood = m;
  renderTop();
});
// [옵시디언] 탭이 열리자마자 탭 이름이 먼저 올 수 있다. 데이터를 받기 전이면 적어 두기만 한다
pet.onTab((t) => (D ? setTab(t) : (tab = t)));
// 호스트가 보내는 알림 (별 · 출석 선물 · 리캡 카드)
if (pet.onToast) pet.onToast((x) => x && toast(x.text, x.icon));

(async () => {
  D = await pet.get();
  if (tab === 'welcome') tab = 'home';
  setTab(tab);
  if (D.firstRun) showWelcome();
  else if (D.whatsNew) showWhatsNew();
  animate();
})();
