// LP 플레이어 (2.10.0). 순수 함수만 둔다 (옵시디언·화면과 무관해서 tests 가 바로 부른다).
//  - 물건 목록: 플레이어 1개 + LP 색 + LP 무늬. 상점 종류는 'lp' (core/shop.js 가 ALL 에 넣는다)
//  - 폴더 → 앨범 묶기: 지정 폴더 아래 하위 폴더 하나가 LP 한 장, 안의 오디오 파일이 곡
//  - 파일 이름 다듬기 · 오디오 확장자 · 설정 값 거르기

// 옵시디언이 오디오로 아는 확장자 (이 밖의 파일은 볼트에 잡히지 않는다)
const AUDIO_EXT = ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'webm', '3gp'];
const DEFAULT_FOLDER = 'LP';
const BASE_COLOR = 'lpc_black'; // 기본 검은 판 (물건이 아니다. 늘 쓸 수 있다)
const BASE_PATTERN = 'lpp_plain';
const PLAYER_KEY = 'lpplayer';
const REPEATS = ['off', 'all', 'one']; // 반복: 끔 · 선반 전체 · 한 곡

// 플레이어: 홈에 LP 칸이 생긴다. 색 · 무늬는 이 플레이어가 있어야 산다
const LP_PLAYER = { key: PLAYER_KEY, price: 700, level: 14 };

// 색: hex 는 판 바탕색 (kit/lp.js 가 가장자리 · 홈 · 반사를 여기서 만든다)
const LP_COLORS = [
  { key: 'lpc_black', hex: '#1c1c22', price: 0, base: true },
  { key: 'lpc_red', hex: '#c0392b', price: 250 },
  { key: 'lpc_blue', hex: '#2e6fbf', price: 250 },
  { key: 'lpc_green', hex: '#2f9e6b', price: 250 },
  { key: 'lpc_pink', hex: '#e87aa8', price: 300 },
  { key: 'lpc_purple', hex: '#7a4fc4', price: 300 },
  { key: 'lpc_yellow', hex: '#e0b830', price: 300 },
  { key: 'lpc_orange', hex: '#e07a2f', price: 300 },
  { key: 'lpc_mint', hex: '#5fcfba', price: 350 },
  { key: 'lpc_white', hex: '#e9e9e2', price: 350 },
  { key: 'lpc_gold', hex: '#d4a017', price: 900 },
];

// 무늬: pat 은 kit/lp.js 가 그리는 방법의 이름
const LP_PATTERNS = [
  { key: 'lpp_plain', pat: 'plain', price: 0, base: true },
  { key: 'lpp_rings', pat: 'rings', price: 350 },
  { key: 'lpp_stripes', pat: 'stripes', price: 400 },
  { key: 'lpp_splatter', pat: 'splatter', price: 450 },
  { key: 'lpp_checker', pat: 'checker', price: 450 },
  { key: 'lpp_stars', pat: 'stars', price: 500 },
  { key: 'lpp_hearts', pat: 'hearts', price: 500 },
  { key: 'lpp_sunburst', pat: 'sunburst', price: 550 },
  // 새 15종 (kit/lp.js 가 그린다)
  { key: 'lpp_dots', pat: 'dots', price: 400 },
  { key: 'lpp_waves', pat: 'waves', price: 450 },
  { key: 'lpp_zigzag', pat: 'zigzag', price: 450 },
  { key: 'lpp_spiral', pat: 'spiral', price: 500 },
  { key: 'lpp_diamonds', pat: 'diamonds', price: 500 },
  { key: 'lpp_paws', pat: 'paws', price: 550 },
  { key: 'lpp_cats', pat: 'cats', price: 600 },
  { key: 'lpp_notes', pat: 'notes', price: 500 },
  { key: 'lpp_flowers', pat: 'flowers', price: 500 },
  { key: 'lpp_marble', pat: 'marble', price: 650 },
  { key: 'lpp_split', pat: 'split', price: 600 },
  { key: 'lpp_galaxy', pat: 'galaxy', price: 800 },
  { key: 'lpp_rainbow', pat: 'rainbow', price: 800 },
  { key: 'lpp_confetti', pat: 'confetti', price: 650 },
  { key: 'lpp_leopard', pat: 'leopard', price: 700 },
];

// 상점에 올릴 물건 (기본 검정 · 무늬 없음은 뺀다)
const LP_ITEMS = [
  { ...LP_PLAYER, lpKind: 'player' },
  ...LP_COLORS.filter((x) => !x.base).map((x) => ({ ...x, lpKind: 'color' })),
  ...LP_PATTERNS.filter((x) => !x.base).map((x) => ({ ...x, lpKind: 'pattern' })),
];

const colorOf = (key) => LP_COLORS.find((x) => x.key === key) || LP_COLORS[0];
const patternOf = (key) => LP_PATTERNS.find((x) => x.key === key) || LP_PATTERNS[0];

const extOf = (name) => {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
};
const isAudio = (name) => AUDIO_EXT.includes(extOf(name));

// 파일·폴더 이름으로 쓸 수 없는 글자를 뺀다 (윈도우 · 맥 · 옵시디언 공통). 비면 ''
function safeName(s, max = 80) {
  const out = String(s == null ? '' : s)
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '');
  return out.slice(0, max).trim();
}

// 사용자가 적은 LP 폴더 경로를 볼트 안 상대 경로로 다듬는다. 이상하면 기본값
function cleanFolder(s) {
  if (typeof s !== 'string') return DEFAULT_FOLDER;
  const parts = s
    .replace(/\\/g, '/')
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p && p !== '.' && p !== '..');
  if (!parts.length || parts.some((p) => p.startsWith('.'))) return DEFAULT_FOLDER; // 숨김 폴더(.obsidian 등)는 못 쓴다
  const clean = parts.map((p) => safeName(p, 60)).filter(Boolean);
  if (!clean.length) return DEFAULT_FOLDER;
  return clean.join('/');
}

// 곡 이름: 확장자와 앞의 «01 - » 같은 번호를 뗀다. 다 떼면 원래 이름
function trackTitle(fileName) {
  const base = String(fileName || '').replace(/\.[A-Za-z0-9]+$/, '');
  const t = base.replace(/^\d{1,3}\s*[-._)\]]*\s+/, '').trim();
  return t || base;
}

const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// 폴더 안 파일들(경로 목록)을 앨범으로 묶는다. folder 바로 아래 하위 폴더 하나 = 앨범 하나
//  paths : 볼트 안 파일 경로들 · folder : cleanFolder 를 거친 LP 폴더
//  폴더 바로 밑에 놓인 낱개 파일은 name '' 앨범 하나(낱장)로 모은다
function buildAlbums(paths, folder) {
  const prefix = folder.replace(/\/+$/, '') + '/';
  const map = new Map();
  for (const p of paths || []) {
    if (typeof p !== 'string' || !p.startsWith(prefix) || !isAudio(p)) continue;
    const rest = p.slice(prefix.length).split('/');
    const album = rest.length > 1 ? rest[0] : '';
    const file = rest[rest.length - 1];
    if (!map.has(album)) map.set(album, []);
    map.get(album).push({ path: p, file, title: trackTitle(file) });
  }
  const albums = [...map.entries()].map(([name, tracks]) => ({
    key: name, // 앨범 키 = 폴더 이름 ('' 은 낱장)
    name,
    tracks: tracks.sort((a, b) => natural(a.path, b.path)),
  }));
  // 이름순, 낱장은 맨 끝
  albums.sort((a, b) => (a.name === '' ? 1 : b.name === '' ? -1 : natural(a.name, b.name)));
  return albums;
}

// 저장된 순서(이름 배열)대로 항목을 늘어놓는다. 저장에 없는 새 항목은 원래 순서 그대로 맨 뒤에
//  items : 아무 배열 · nameOf(x) → 문자열 · saved : 이름 배열 (없거나 이상하면 그대로)
function sortBySaved(items, nameOf, saved) {
  if (!Array.isArray(saved) || !saved.length) return items.slice();
  const rank = new Map();
  saved.forEach((n, i) => {
    if (typeof n === 'string' && !rank.has(n)) rank.set(n, i);
  });
  const known = items.filter((x) => rank.has(nameOf(x))).sort((a, b) => rank.get(nameOf(a)) - rank.get(nameOf(b)));
  const fresh = items.filter((x) => !rank.has(nameOf(x)));
  return [...known, ...fresh];
}

// 화면이 보낸 새 순서를 실제 이름 목록과 맞춘다: 모르는 이름은 버리고, 빠진 이름은 원래 순서대로 뒤에 붙인다. 하나도 못 맞추면 null
function cleanOrder(wanted, actual) {
  if (!Array.isArray(wanted)) return null;
  const have = new Set(actual);
  const seen = new Set();
  const out = [];
  for (const n of wanted) {
    if (typeof n === 'string' && have.has(n) && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  if (!out.length) return null;
  for (const n of actual) if (!seen.has(n)) out.push(n);
  return out;
}

// 경로의 짧은 해시 (곡 길이 캐시 키. 경로 글자를 data.json 에 그대로 두지 않는다)
function hashPath(p) {
  let h = 2166136261;
  for (const ch of String(p || '')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// 같은 이름이 있으면 « (2)» 를 붙여 비어 있는 파일 이름을 찾는다. exists(path) → boolean
function freeName(dir, file, exists) {
  const m = /^(.*?)(\.[A-Za-z0-9]+)?$/.exec(file);
  const stem = m[1] || file;
  const ext = m[2] || '';
  let name = file;
  for (let i = 2; exists(`${dir}/${name}`) && i < 500; i++) name = `${stem} (${i})${ext}`;
  return name;
}

// 앨범 이름으로 라벨 색을 정한다 (이름이 같으면 늘 같은 색)
const LABEL_HUES = ['#f2c14e', '#e8736c', '#6cc3d5', '#9dc96a', '#c38be0', '#f29b4b', '#f08fb4', '#7fa8f0'];
function labelColor(name) {
  let h = 5381;
  for (const ch of String(name || '')) h = ((h << 5) + h + ch.codePointAt(0)) | 0;
  return LABEL_HUES[Math.abs(h) % LABEL_HUES.length];
}

module.exports = {
  AUDIO_EXT,
  DEFAULT_FOLDER,
  BASE_COLOR,
  BASE_PATTERN,
  PLAYER_KEY,
  REPEATS,
  sortBySaved,
  cleanOrder,
  hashPath,
  LP_COLORS,
  LP_PATTERNS,
  LP_ITEMS,
  colorOf,
  patternOf,
  extOf,
  isAudio,
  safeName,
  cleanFolder,
  trackTitle,
  buildAlbums,
  freeName,
  labelColor,
};
