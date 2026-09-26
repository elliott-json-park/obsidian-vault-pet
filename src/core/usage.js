// 옵시디언 사용량을 폴더·시간 단위로 집계한다. 킷커밋(데스크톱)의 usage.js 가 Claude Code 대화 기록을 읽던 자리다.
//
// 세는 것 (시간 버킷 하나 = { c, l, n, s, v, e, t })
//  c : 새로 쓴 글자 수 (공백·마크다운 기호·URL 은 빼고. 코드도 글쓰기라 센다)
//  l : 새로 건 링크 수 ([[위키 링크]] · ![[임베드]] · [마크다운](링크))
//  n : 새 노트 수 (10자 넘게 쓴 노트를 한 번만)
//  s : 글쓰기 세션 수 (30분 넘게 쉬었다가 다시 쓰기 시작하면 하나)
//  v : 노트를 연 횟수
//  e : 기록 횟수 (글이 늘어난 저장 한 번 = 하나. 히트맵·출석·시간대 업적이 쓴다)
//  t : 옵시디언 기능 활용 { tag 태그, task 할 일, done 끝낸 할 일, head 제목, embed 임베드, callout 콜아웃, daily 데일리 노트, canvas 캔버스 }
//
// 막는 것 (경험치 농사 방지)
//  - 노트마다 "지금까지 가장 많았던 값"(최고 기록)을 기억해서 그보다 늘어난 만큼만 센다.
//    지웠다가 다시 붙여 넣기 · 되돌리기 · 잘라 붙이기로는 아무것도 오르지 않는다.
//  - 한 번에 크게 늘어난 양(붙여넣기)은 노트 하나에 3,000자 · 링크 30개까지만.
//  - 여러 노트가 한꺼번에 바뀌면(폴더 복사·동기화) 모두 합쳐 6,000자 · 링크 60개 · 새 노트 10개까지만.
//
// 개인정보
//  - 노트 내용은 저장하지 않는다. 경로도 그대로 저장하지 않고 '/' 로 끊어 토막마다 짧은 해시로 바꿔 넣는다.
//  - 폴더(=킷커밋의 '프로젝트')도 해시로만 남기고, 화면에 이름을 보여 줄 때는 지금 볼트의 폴더 이름을 해시해서 맞춰 본다.
const { EventEmitter } = require('events');

const MIN = 60_000;
const LIVE_CHAR_CAP = 3000;
const LIVE_LINK_CAP = 30;
const NOTE_MIN_CHARS = 10;
const FLUSH_BUDGET = { c: 6000, l: 60, n: 10 };
const OFFLINE_BUDGET = { c: 20000, l: 300, n: 40 };
const SESSION_GAP = 30 * MIN;
const FEATURES = ['tag', 'task', 'done', 'head', 'embed', 'callout'];
// 파일 기록 한 줄: [최고 글자, 최고 링크, mtime, 새 노트로 셌나, ...FEATURES 의 최고값]
const F0 = 4;

const pad = (n) => String(n).padStart(2, '0');
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hourKey = (d) => `${dayOf(d)}T${pad(d.getHours())}`;
function hourKeyToMs(key) {
  const [d, h] = key.split('T');
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day, Number(h)).getTime();
}

/* ---------- 세기 ---------- */

function stripFrontmatter(text) {
  const m = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
  return m ? text.slice(m[0].length) : text;
}

const EXCALIDRAW_RE = /(^|\n)excalidraw-plugin\s*:/;
const BLOB_LINE = 1000; // 코드 블록 안에서 이보다 긴 한 줄은 데이터 덩어리로 보고 세지 않는다
const EMPTY = () => ({ chars: 0, links: 0, tag: 0, task: 0, done: 0, head: 0, embed: 0, callout: 0 });

// 노트 한 개를 잰다. 글자·링크와 옵시디언 기능(태그·할 일·제목·임베드·콜아웃) 개수
function measure(text) {
  const raw = String(text || '');
  const body = stripFrontmatter(raw);
  if (EXCALIDRAW_RE.test(raw.slice(0, raw.length - body.length))) return EMPTY();
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
  const embeds = linkable.match(/!\[\[[^[\]\n]+\]\]/g) || [];
  const tags = linkable.match(/(^|[\s(])#[^\s#.,;:!?()[\]{}"'`\d][^\s#.,;:!?()[\]{}"'`]*/g) || [];
  const tasks = linkable.match(/^\s*[-*+] \[[ xX]\]/gm) || [];
  const done = linkable.match(/^\s*[-*+] \[[xX]\]/gm) || [];
  const heads = linkable.match(/^#{1,6} \S/gm) || [];
  const callouts = linkable.match(/^>\s*\[![\w-]+\]/gm) || [];
  const chars = (text2 + '\n' + code.join('\n'))
    .replace(/\]\([^)\n]*\)/g, ']')
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, '')
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '')
    .replace(/[\s#*_>`~=|[\]!-]+/g, '').length;
  return { chars, links: wiki.length + md.length, tag: tags.length, task: tasks.length, done: done.length, head: heads.length, embed: embeds.length, callout: callouts.length };
}

// 경로 토막 해시 (FNV 두 개를 이어 붙인다)
const SEG_CACHE = new Map();
function hashSeg(s) {
  let h = SEG_CACHE.get(s);
  if (h !== undefined) return h;
  let a = 0x811c9dc5;
  let b = 0x7ee3a2f1;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = Math.imul(b + c + i, 2246822519) >>> 0;
    b = ((b << 13) | (b >>> 19)) >>> 0;
  }
  h = a.toString(36) + b.toString(36);
  if (SEG_CACHE.size > 40000) SEG_CACHE.clear();
  SEG_CACHE.set(s, h);
  return h;
}
const PATH_CACHE = new Map();
function pathKey(path) {
  let k = PATH_CACHE.get(path);
  if (k !== undefined) return k;
  k = path.split('/').map(hashSeg).join('/');
  if (PATH_CACHE.size > 20000) PATH_CACHE.clear();
  PATH_CACHE.set(path, k);
  return k;
}
// 노트가 속한 폴더(맨 윗단). 볼트 맨 위에 있는 노트는 '/'
const ROOT = '/';
function folderOf(path) {
  const i = path.indexOf('/');
  return i < 0 ? ROOT : path.slice(0, i);
}
const folderKey = (name) => (name === ROOT ? ROOT : hashSeg(name));

// 데일리 노트처럼 보이는가 (파일 이름이 날짜)
const DAILY_RE = /(^|\/)\d{4}-\d{2}-\d{2}(\.md)?$/;

function emptyData() {
  return { files: {}, projects: {}, lastEdit: 0, lastBurst: 0, firstAt: 0 };
}

class UsageTracker extends EventEmitter {
  constructor(data) {
    super();
    this.d = Object.assign(emptyData(), data || {});
    this.excluded = new Set();
  }

  get data() {
    return this.d;
  }

  setExcluded(list) {
    this.excluded = new Set(list || []);
  }

  *activeProjects() {
    for (const [id, p] of Object.entries(this.d.projects)) if (!this.excluded.has(id)) yield p;
  }

  get lastActivity() {
    let last = 0;
    for (const p of this.activeProjects()) if (p.last > last) last = p.last;
    return last;
  }

  bucket(fk, when) {
    const proj = (this.d.projects[fk] ||= { buckets: {}, last: 0 });
    const key = hourKey(when);
    return { proj, b: (proj.buckets[key] ||= { c: 0, l: 0, n: 0, s: 0, v: 0, e: 0 }) };
  }

  // ---------- 기록 ----------

  // 노트 하나를 잰 값을 반영한다. 늘어난 만큼(최고 기록 넘은 만큼)만 센다.
  //  opts.baseline : 설치할 때 이미 있던 노트. 지금 크기만 기억하고 아무것도 세지 않는다
  //  opts.cap/linkCap : 한 번에 늘어난 양의 상한 (붙여넣기)
  //  opts.budget : 한꺼번에 여러 노트가 바뀔 때 전체로 줄 수 있는 몫
  //  opts.canvas : 캔버스 파일 (내용은 안 재고, 새로 만든 것만 센다)
  observe(path, m, when = new Date(), opts = {}) {
    const key = pathKey(path);
    const f = this.d.files[key] || null;
    const prev = (i) => (f ? f[i] || 0 : 0);
    const counted = prev(3);
    const fresh = [Math.max(prev(0), m.chars), Math.max(prev(1), m.links), opts.mtime || prev(2), counted || (m.chars >= NOTE_MIN_CHARS ? 1 : 0)];
    FEATURES.forEach((k, i) => (fresh[F0 + i] = Math.max(prev(F0 + i), m[k] || 0)));
    if (opts.baseline) {
      this.d.files[key] = fresh;
      return { dc: 0, dl: 0, dn: 0 };
    }
    let dc = Math.max(0, m.chars - prev(0));
    let dl = Math.max(0, m.links - prev(1));
    if (opts.cap != null) dc = Math.min(dc, opts.cap);
    if (opts.linkCap != null) dl = Math.min(dl, opts.linkCap);
    let dn = !counted && m.chars >= NOTE_MIN_CHARS ? 1 : 0;
    const b = opts.budget;
    if (b) {
      dc = Math.min(dc, Math.max(0, b.c));
      dl = Math.min(dl, Math.max(0, b.l));
      if (b.n <= 0) dn = 0;
      b.c -= dc;
      b.l -= dl;
      b.n -= dn;
    }
    const feat = {};
    FEATURES.forEach((k, i) => {
      const d = Math.max(0, (m[k] || 0) - prev(F0 + i));
      if (d) feat[k] = Math.min(d, 50);
    });
    if (dn && DAILY_RE.test(path)) feat.daily = 1;
    this.d.files[key] = fresh;
    if (dc || dl || dn || Object.keys(feat).length) this.add(path, when, dc, dl, dn, feat, opts);
    return { dc, dl, dn, feat };
  }

  add(path, when, dc, dl, dn, feat, opts = {}) {
    const fk = folderKey(folderOf(path));
    const t = when.getTime();
    const { proj, b } = this.bucket(fk, when);
    b.c += dc;
    b.l += dl;
    b.n += dn;
    if (dc || dl || dn) {
      b.e++;
      // 30분 넘게 쉬었다가 다시 쓰기 시작하면 세션 하나 (옵시디언이 꺼져 있던 동안 바뀐 건 세션으로 안 친다)
      if (!opts.offline && (!this.d.lastEdit || t - this.d.lastEdit > SESSION_GAP)) {
        b.s++;
        this.emit('session', { at: t });
      }
      if (!opts.offline) this.d.lastEdit = Math.max(this.d.lastEdit || 0, t);
    }
    for (const [k, v] of Object.entries(feat || {})) (b.t ||= {})[k] = (b.t[k] || 0) + v;
    if (t > proj.last) proj.last = t;
  }

  // 캔버스를 새로 만들었다
  canvas(path, when = new Date()) {
    const key = pathKey(path);
    if (this.d.files[key]) return;
    this.d.files[key] = [0, 0, 0, 1];
    const { b } = this.bucket(folderKey(folderOf(path)), when);
    (b.t ||= {}).canvas = (b.t.canvas || 0) + 1;
  }

  // 노트를 열었다
  open(path, when = new Date()) {
    const { proj, b } = this.bucket(folderKey(folderOf(path)), when);
    b.v++;
    if (when.getTime() > proj.last) proj.last = when.getTime();
  }

  mtimeOf(path) {
    const f = this.d.files[pathKey(path)];
    return f ? f[2] : null;
  }

  has(path) {
    return Object.prototype.hasOwnProperty.call(this.d.files, pathKey(path));
  }

  remove(path) {
    delete this.d.files[pathKey(path)];
  }

  removeUnder(folder) {
    const prefix = pathKey(folder) + '/';
    for (const k of Object.keys(this.d.files)) if (k.startsWith(prefix)) delete this.d.files[k];
  }

  keepOnly(paths) {
    const live = new Set();
    for (const p of paths) live.add(pathKey(p));
    for (const k of Object.keys(this.d.files)) if (!live.has(k)) delete this.d.files[k];
  }

  rename(from, to) {
    const a = pathKey(from);
    const b = pathKey(to);
    if (this.d.files[a]) {
      this.d.files[b] = this.d.files[a];
      delete this.d.files[a];
    }
    const prefix = a + '/';
    for (const k of Object.keys(this.d.files)) {
      if (k.startsWith(prefix)) {
        this.d.files[b + '/' + k.slice(prefix.length)] = this.d.files[k];
        delete this.d.files[k];
      }
    }
  }

  // ---------- 읽기 (킷커밋 usage.js 와 같은 모양) ----------

  *eachBucket(sinceMs = 0) {
    const floor = sinceMs ? hourKeyToMs(hourKey(new Date(sinceMs))) : 0;
    for (const p of this.activeProjects()) {
      for (const [key, b] of Object.entries(p.buckets)) {
        if (floor && hourKeyToMs(key) < floor) continue;
        yield [key, b];
      }
    }
  }

  // sinceMs 이후의 합계
  totals(sinceMs = 0) {
    const sum = { c: 0, l: 0, n: 0, s: 0, v: 0, e: 0 };
    for (const [, b] of this.eachBucket(sinceMs)) {
      sum.c += b.c;
      sum.l += b.l;
      sum.n += b.n;
      sum.s += b.s;
      sum.v += b.v || 0;
      sum.e += b.e || 0;
    }
    return sum;
  }

  today() {
    const d = new Date();
    return this.totals(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
  }

  // 글을 쓰거나 노트를 연 날 ('YYYY-MM-DD')
  activeDays(sinceMs = 0) {
    const days = new Set();
    for (const [key, b] of this.eachBucket(sinceMs)) if (b.e || b.v) days.add(key.slice(0, 10));
    return days;
  }

  daily(n) {
    const out = [];
    const now = new Date();
    const index = {};
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const row = { day: dayOf(d), c: 0, l: 0, n: 0, s: 0, e: 0 };
      index[row.day] = row;
      out.push(row);
    }
    for (const [key, b] of this.eachBucket(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n + 1).getTime())) {
      const row = index[key.slice(0, 10)];
      if (row) {
        row.c += b.c;
        row.l += b.l;
        row.n += b.n;
        row.s += b.s;
        row.e += b.e || 0;
      }
    }
    return out;
  }

  // sinceMs 이후 시간대별 기록 횟수 (0~23시)
  hours(sinceMs = 0) {
    const h = new Array(24).fill(0);
    for (const [key, b] of this.eachBucket(sinceMs)) h[Number(key.slice(11, 13))] += b.e || 0;
    return h;
  }

  // 업적용 옵시디언 활용 기록 (킷커밋의 claudeUse 자리)
  //  feat: 기능별 누적 · folders: 글을 쓴 폴더 수 · dayFolderMax: 하루에 가장 많이 쓴 폴더 수
  //  weeksFull/weeks5/months20: 한 주 7일·5일, 한 달 20일 넘게 쓴 횟수 · busyDays: 3,000자 넘게 쓴 날
  obsidianUse(sinceMs = 0) {
    const floor = sinceMs ? hourKeyToMs(hourKey(new Date(sinceMs))) : 0;
    const feat = {};
    const dayFold = {};
    const dayChars = {};
    let folders = 0;
    for (const [id, p] of Object.entries(this.d.projects)) {
      if (this.excluded.has(id)) continue;
      let used = false;
      for (const [key, b] of Object.entries(p.buckets)) {
        if (floor && hourKeyToMs(key) < floor) continue;
        if (b.t) for (const [k, v] of Object.entries(b.t)) feat[k] = (feat[k] || 0) + v;
        if (b.e) {
          used = true;
          const d = key.slice(0, 10);
          (dayFold[d] ||= new Set()).add(id);
          dayChars[d] = (dayChars[d] || 0) + b.c;
        }
      }
      if (used) folders++;
    }
    const weekOf = (d) => {
      const x = new Date(d + 'T00:00:00');
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      return dayOf(x);
    };
    const weeks = {};
    const months = {};
    for (const d of Object.keys(dayChars)) {
      weeks[weekOf(d)] = (weeks[weekOf(d)] || 0) + 1;
      months[d.slice(0, 7)] = (months[d.slice(0, 7)] || 0) + 1;
    }
    return {
      feat,
      folders,
      dayFolderMax: Math.max(0, ...Object.values(dayFold).map((x) => x.size)),
      weeksFull: Object.values(weeks).filter((n) => n >= 7).length,
      weeks5: Object.values(weeks).filter((n) => n >= 5).length,
      months20: Object.values(months).filter((n) => n >= 20).length,
      busyDays: Object.values(dayChars).filter((n) => n >= 3000).length,
    };
  }

  // 날짜별 쓴 글자 (자랑 카드의 잔디)
  dailyChars(sinceMs = 0) {
    const out = {};
    for (const [key, b] of this.eachBucket(sinceMs)) if (b.c) out[key.slice(0, 10)] = (out[key.slice(0, 10)] || 0) + b.c;
    return out;
  }

  // 설정의 '경험치에 넣을 폴더'. names = 지금 볼트 맨 윗단 폴더 이름들 (해시를 이름으로 되돌린다)
  projects(names = []) {
    const label = { [ROOT]: null };
    for (const n of names) label[folderKey(n)] = n;
    const ids = new Set([...Object.keys(this.d.projects), ...names.map(folderKey)]);
    return [...ids]
      .map((id) => {
        const p = this.d.projects[id] || { buckets: {}, last: 0 };
        let c = 0;
        for (const b of Object.values(p.buckets)) c += b.c;
        return { id, label: label[id] !== undefined ? label[id] : undefined, root: id === ROOT, chars: c, last: p.last, excluded: this.excluded.has(id) };
      })
      .filter((p) => p.label !== undefined || p.root || p.chars)
      .sort((a, b) => b.last - a.last || (a.label || '').localeCompare(b.label || ''));
  }
}

module.exports = {
  UsageTracker, measure, pathKey, folderKey, folderOf, dayOf, hourKey, hourKeyToMs,
  LIVE_CHAR_CAP, LIVE_LINK_CAP, FLUSH_BUDGET, OFFLINE_BUDGET, NOTE_MIN_CHARS, SESSION_GAP, ROOT,
};
