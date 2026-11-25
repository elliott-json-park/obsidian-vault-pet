// LP 플레이어 (2.10.0). 음악 재생은 호스트(플러그인 쪽)가 들고 있다.
//  홈 화면(iframe)은 명령만 보내고 상태를 받아 그린다 → 홈을 닫아도 음악은 이어진다.
//  - 오디오 파일은 볼트 안 LP 폴더에서만 읽는다 (getResourcePath 로 받은 주소를 <audio> 에 넣는다. 네트워크 없음)
//  - 곡 목록은 저장하지 않는다. 열 때마다 폴더를 읽는다. 저장하는 것은 설정(폴더 · 색 · 무늬 · 음량 · 반복 · LP 순서 · 곡 순서 ·
//    LP별 꾸미기)과 마지막에 튼 앨범 이름, 곡 길이 캐시(경로의 짧은 해시 → 초)뿐
//  - 선반(LP) 순서대로 한 장이 끝나면 다음 LP 로 이어 튼다. 반복: 끔 / 전체(선반 전체) / 한 곡
//  - 파일 추가: 홈의 «음악 파일 추가» 에서 고른 파일을 호스트가 읽어 LP 폴더 안 앨범 폴더에 복사한다
const LP = require('../core/lp');

const MAX_FILE = 400 * 1024 * 1024; // 한 파일 400MB 까지
const CACHE_MS = 2000;
const DUR_KEEP = 4000; // 곡 길이 캐시는 이만큼까지만 (오래된 것부터 버린다)

class LpPlayer {
  constructor(host) {
    this.host = host;
    this.audio = null;
    this.now = null; // { album, idx, file }
    this.cache = null; // { at, folder, base }
    this.focusStarted = false; // 집중 시작으로 튼 음악인가 (쉬거나 끝나면 같이 멈춘다)
    this.lastError = '';
    this.durQueue = [];
    this.durPending = new Set();
    this.durBusy = false;
    this.pushTimer = null;
  }

  get app() {
    return this.host.plugin.app;
  }

  owned() {
    return this.host.shop.owned(LP.PLAYER_KEY);
  }

  folder() {
    return LP.cleanFolder(this.host.settings.get('lpFolder'));
  }

  volume() {
    const v = Number(this.host.settings.get('lpVolume'));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.7;
  }

  repeat() {
    const r = this.host.settings.get('lpRepeat');
    return LP.REPEATS.includes(r) ? r : 'off';
  }

  // ---------- 폴더 → 앨범 (저장된 순서대로) ----------

  dirty() {
    this.cache = null;
  }

  // 폴더 아래 모든 파일 경로. TFolder 인지는 children 이 있는지로 본다
  listPaths() {
    const vault = this.app && this.app.vault;
    if (!vault) return [];
    const root = vault.getAbstractFileByPath(this.folder());
    const out = [];
    const walk = (node, depth) => {
      if (!node || depth > 6) return;
      if (Array.isArray(node.children)) for (const c of node.children) walk(c, depth + 1);
      else if (typeof node.path === 'string') out.push(node.path);
    };
    walk(root, 0);
    return out;
  }

  baseAlbums() {
    const t = Date.now();
    if (this.cache && t - this.cache.at < CACHE_MS && this.cache.folder === this.folder()) return this.cache.base;
    const base = LP.buildAlbums(this.listPaths(), this.folder());
    this.cache = { at: t, folder: this.folder(), base };
    return base;
  }

  // 선반 순서(lpOrder)와 곡 순서(lpTrackOrder)를 입힌 앨범 목록
  albums() {
    const s = this.host.settings;
    const trackOrder = s.get('lpTrackOrder') || {};
    const albums = LP.sortBySaved(this.baseAlbums(), (a) => a.key, s.get('lpOrder'));
    return albums.map((a) => ({ ...a, tracks: LP.sortBySaved(a.tracks, (t) => t.file, trackOrder[a.key]) }));
  }

  findAlbum(key) {
    return this.albums().find((a) => a.key === key) || null;
  }

  // ---------- 곡 길이 (파일 머리글을 늦게 읽어 캐시한다) ----------

  durOf(path) {
    const d = (this.host.state.get('lpDur') || {})[LP.hashPath(path)];
    return Number.isFinite(d) && d > 0 ? d : 0;
  }

  putDur(path, sec) {
    if (!(Number.isFinite(sec) && sec > 0) || this.durOf(path)) return false;
    const cur = { ...(this.host.state.get('lpDur') || {}), [LP.hashPath(path)]: Math.round(sec) };
    const keys = Object.keys(cur);
    if (keys.length > DUR_KEEP) for (const k of keys.slice(0, keys.length - DUR_KEEP)) delete cur[k];
    this.host.state.set({ lpDur: cur });
    return true;
  }

  // 앨범의 길이를 아직 모르는 곡들을 한 곡씩 읽는다 (읽는 동안 홈에 조금씩 채워진다)
  queueDurations(album) {
    if (!album) return;
    for (const t of album.tracks) {
      if (this.durOf(t.path) || this.durPending.has(t.path)) continue;
      this.durPending.add(t.path);
      this.durQueue.push(t.path);
    }
    if (this.durQueue.length && !this.durBusy) this.runDurations().catch((e) => console.error('[Vault Pet] lp durations', e));
  }

  async runDurations() {
    this.durBusy = true;
    let n = 0;
    try {
      while (this.durQueue.length) {
        const path = this.durQueue.shift();
        const sec = await this.probe(path);
        this.durPending.delete(path);
        if (sec && this.putDur(path, sec)) n++;
        if (n && (n % 4 === 0 || !this.durQueue.length)) this.pushSoon();
        await new Promise((r) => setTimeout(r, 30));
      }
    } finally {
      this.durBusy = false;
      if (n) this.pushSoon();
    }
  }

  probe(path) {
    return new Promise((resolve) => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!file || typeof Audio === 'undefined') return resolve(0);
      const a = new Audio();
      let done = false;
      const end = (v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          a.removeAttribute('src');
          a.load();
        } catch {
          // 무시
        }
        resolve(Number.isFinite(v) ? v : 0);
      };
      const timer = setTimeout(() => end(0), 5000);
      a.preload = 'metadata';
      a.addEventListener('loadedmetadata', () => end(a.duration));
      a.addEventListener('error', () => end(0));
      a.src = this.app.vault.getResourcePath(file);
    });
  }

  pushSoon() {
    if (this.pushTimer) return;
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.changed();
    }, 150);
  }

  // ---------- 재생 ----------

  ensureAudio() {
    if (this.audio) return this.audio;
    const a = new Audio();
    a.preload = 'metadata';
    a.volume = this.volume();
    a.addEventListener('ended', () => this.onEnded());
    a.addEventListener('pause', () => this.changed());
    a.addEventListener('play', () => this.changed());
    a.addEventListener('loadedmetadata', () => {
      // 틀고 있는 곡은 길이를 공짜로 알 수 있다
      const al = this.now && this.findAlbum(this.now.album);
      const tr = al && al.tracks[this.now.idx];
      if (tr) this.putDur(tr.path, a.duration);
      this.changed();
    });
    a.addEventListener('error', () => {
      this.lastError = 'play';
      this.now = null;
      this.changed();
    });
    this.audio = a;
    return a;
  }

  changed() {
    this.host.pushHouse();
  }

  // 앨범 album 의 idx 번째 곡을 튼다. 되면 true
  play(albumKey, idx = 0, byFocus = false) {
    if (!this.owned()) return false;
    const al = this.findAlbum(albumKey);
    const tr = al && al.tracks[idx];
    if (!tr) return false;
    const file = this.app.vault.getAbstractFileByPath(tr.path);
    if (!file) return false;
    const a = this.ensureAudio();
    this.lastError = '';
    this.now = { album: al.key, idx, file: tr.file };
    this.focusStarted = byFocus;
    a.loop = this.repeat() === 'one';
    a.src = this.app.vault.getResourcePath(file);
    a.volume = this.volume();
    this.host.state.set({ lpLast: al.key });
    const p = a.play();
    if (p && p.catch) p.catch(() => this.changed());
    this.changed();
    return true;
  }

  toggle() {
    const a = this.audio;
    if (!a || !this.now) return false;
    this.focusStarted = false; // 직접 만졌으면 집중과 상관없이 둔다
    if (a.paused) {
      const p = a.play();
      if (p && p.catch) p.catch(() => this.changed());
    } else a.pause();
    return true;
  }

  // 지금 곡 다음에 올 곡 { album, idx }. 한 LP 가 끝나면 선반의 다음 LP 로, 선반이 끝났으면 «전체 반복»일 때만 처음으로
  trackAfter() {
    if (!this.now) return null;
    const albums = this.albums();
    const ai = albums.findIndex((a) => a.key === this.now.album);
    if (ai < 0) return null;
    if (this.now.idx + 1 < albums[ai].tracks.length) return { album: albums[ai].key, idx: this.now.idx + 1 };
    for (let k = 1; k <= albums.length; k++) {
      const j = ai + k;
      if (j >= albums.length && this.repeat() !== 'all') return null;
      const al = albums[j % albums.length];
      if (al.tracks.length) return { album: al.key, idx: 0 };
    }
    return null;
  }

  // 다음 곡 버튼: 끝까지 가면 선반의 다음 LP 로 (맨 끝이면 처음 LP 로 돌아간다)
  next() {
    if (!this.now) return false;
    const albums = this.albums();
    const ai = albums.findIndex((a) => a.key === this.now.album);
    if (ai < 0) return this.stop();
    if (this.now.idx + 1 < albums[ai].tracks.length) return this.play(albums[ai].key, this.now.idx + 1);
    for (let k = 1; k <= albums.length; k++) {
      const al = albums[(ai + k) % albums.length];
      if (al.tracks.length) return this.play(al.key, 0);
    }
    return this.stop();
  }

  // 3초 넘게 들었으면 곡 처음으로, 아니면 앞 곡 (LP 의 첫 곡이면 앞 LP 의 마지막 곡)
  prev() {
    if (!this.now || !this.audio) return false;
    const albums = this.albums();
    const ai = albums.findIndex((a) => a.key === this.now.album);
    if (this.audio.currentTime > 3 || ai < 0) {
      this.audio.currentTime = 0;
      this.changed();
      return true;
    }
    if (this.now.idx > 0) return this.play(this.now.album, this.now.idx - 1);
    for (let k = 1; k <= albums.length; k++) {
      const al = albums[(ai - k + albums.length * 2) % albums.length];
      if (al.tracks.length) return this.play(al.key, al.tracks.length - 1);
    }
    this.audio.currentTime = 0;
    this.changed();
    return true;
  }

  seek(sec) {
    const a = this.audio;
    const s = Number(sec);
    if (!a || !this.now || !Number.isFinite(s) || !Number.isFinite(a.duration)) return false;
    a.currentTime = Math.max(0, Math.min(a.duration, s));
    this.changed();
    return true;
  }

  setVolume(v) {
    const x = Math.max(0, Math.min(1, Number(v)));
    if (!Number.isFinite(x)) return false;
    this.host.settings.set({ lpVolume: Math.round(x * 100) / 100 });
    if (this.audio) this.audio.volume = x;
    return true;
  }

  setRepeat(mode) {
    if (!LP.REPEATS.includes(mode)) return false;
    this.host.settings.set({ lpRepeat: mode });
    if (this.audio) this.audio.loop = mode === 'one'; // 한 곡 반복은 오디오가 스스로 되감는다
    this.changed();
    return true;
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    this.now = null;
    this.focusStarted = false;
    this.changed();
    return true;
  }

  onEnded() {
    if (!this.now) return;
    const nx = this.trackAfter();
    if (nx) this.play(nx.album, nx.idx, this.focusStarted);
    else this.stop();
  }

  destroy() {
    clearTimeout(this.pushTimer);
    this.durQueue.length = 0;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio = null;
    }
    this.now = null;
  }

  // ---------- 순서 · LP별 꾸미기 ----------

  // 선반 순서를 바꾼다. keys = 화면이 본 새 순서(앨범 키 배열)
  reorderAlbums(keys) {
    const order = LP.cleanOrder(keys, this.baseAlbums().map((a) => a.key));
    if (!order) return false;
    this.host.settings.set({ lpOrder: order });
    this.changed();
    return true;
  }

  // 한 LP 안의 곡 순서. files = 파일 이름 배열. 틀고 있는 곡은 이름으로 따라간다
  reorderTracks(albumKey, files) {
    const base = this.baseAlbums().find((a) => a.key === albumKey);
    if (!base) return false;
    const order = LP.cleanOrder(files, base.tracks.map((t) => t.file));
    if (!order) return false;
    const all = { ...(this.host.settings.get('lpTrackOrder') || {}), [albumKey]: order };
    this.host.settings.set({ lpTrackOrder: all });
    if (this.now && this.now.album === albumKey) {
      const al = this.findAlbum(albumKey);
      const i = al ? al.tracks.findIndex((t) => t.file === this.now.file) : -1;
      if (i >= 0) this.now.idx = i;
    }
    this.changed();
    return true;
  }

  // 판 색 · 무늬는 LP마다 따로. patch = { color?, pattern? } (산 것만) · null 이면 기본 꾸미기를 따른다
  setStyle(albumKey, patch) {
    if (!this.baseAlbums().some((a) => a.key === albumKey)) return false;
    const all = { ...(this.host.settings.get('lpStyles') || {}) };
    if (patch === null) delete all[albumKey];
    else if (patch && typeof patch === 'object') {
      const cur = { ...(all[albumKey] || {}) };
      const shop = this.host.shop;
      const c = LP.LP_COLORS.find((x) => x.key === patch.color);
      const p = LP.LP_PATTERNS.find((x) => x.key === patch.pattern);
      if (c && (c.base || shop.owned(c.key))) cur.color = c.key;
      if (p && (p.base || shop.owned(p.key))) cur.pattern = p.key;
      if (!cur.color && !cur.pattern) return false;
      all[albumKey] = cur;
    } else return false;
    this.host.settings.set({ lpStyles: all });
    this.changed();
    return true;
  }

  // 한 LP 의 실제 판 모양: 따로 정한 것 → 없으면 기본 꾸미기(lpColor · lpPattern) → 없으면 검정 · 무늬 없음
  styleOf(albumKey) {
    const s = this.host.settings;
    const shop = this.host.shop;
    const mine = (s.get('lpStyles') || {})[albumKey] || null;
    const usable = (list, key) => {
      const x = list.find((y) => y.key === key);
      return x && (x.base || shop.owned(x.key)) ? x : null;
    };
    const color = (mine && usable(LP.LP_COLORS, mine.color)) || usable(LP.LP_COLORS, s.get('lpColor')) || LP.colorOf(null);
    const pat = (mine && usable(LP.LP_PATTERNS, mine.pattern)) || usable(LP.LP_PATTERNS, s.get('lpPattern')) || LP.patternOf(null);
    return { color: color.key, hex: color.hex, pattern: pat.key, pat: pat.pat, own: !!mine };
  }

  // ---------- 집중 시간과 같이 (설정 lpFocusAuto, 기본 꺼짐) ----------
  // 집중이 켜지면 마지막 앨범(없으면 첫 앨범)을 틀거나 멈춘 곡을 잇고, 집중이 끝나거나 쉬는 시간이면 멈춘다. 직접 켠 음악은 건드리지 않는다
  focusSync(info) {
    if (!this.owned() || this.host.settings.get('lpFocusAuto') !== true) return;
    if (info && info.on) {
      if (this.audio && this.now) {
        if (this.audio.paused && !this.focusStarted) return; // 직접 멈춘 음악은 이어 주지 않는다
        if (this.audio.paused) {
          const p = this.audio.play();
          if (p && p.catch) p.catch(() => {});
        }
        return;
      }
      const albums = this.albums().filter((a) => a.tracks.length);
      if (!albums.length) return;
      const last = this.host.state.get('lpLast');
      const al = albums.find((x) => x.key === last) || albums[0];
      this.play(al.key, 0, true);
    } else if (this.focusStarted && this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  // ---------- 파일 추가 ----------
  // 홈(iframe)이 고른 파일을 frame.win.__lpPick 에 두고 부른다 (브리지가 인자를 JSON 으로 복사해서 파일 내용은 못 넘긴다).
  // albumName 폴더(없으면 만든다)에 오디오 파일만 복사한다. 같은 이름은 « (2)» 를 붙인다
  async add(frame, albumName) {
    if (!this.owned()) return { ok: false, reason: 'locked' };
    const pick = frame && frame.win ? frame.win.__lpPick : null;
    if (frame && frame.win) frame.win.__lpPick = null;
    const files = pick ? Array.from(pick) : [];
    if (!files.length) return { ok: false, reason: 'none' };
    const album = LP.safeName(albumName, 60);
    if (!album) return { ok: false, reason: 'name' };
    const dir = `${this.folder()}/${album}`;
    const vault = this.app.vault;
    try {
      await this.ensureFolder(this.folder());
      await this.ensureFolder(dir);
    } catch (e) {
      console.error('[Vault Pet] lp folder', e);
      return { ok: false, reason: 'folder' };
    }
    const exists = (p) => !!vault.getAbstractFileByPath(p);
    let added = 0;
    let skipped = 0;
    for (const f of files) {
      const name = LP.safeName(f && f.name, 120);
      if (!name || !LP.isAudio(name) || !(f.size <= MAX_FILE)) {
        skipped++;
        continue;
      }
      try {
        const src = new Uint8Array(await f.arrayBuffer());
        const copy = new Uint8Array(src.length); // 호스트 쪽 버퍼로 옮긴다
        copy.set(src);
        const finalName = LP.freeName(dir, name, exists);
        await vault.createBinary(`${dir}/${finalName}`, copy.buffer);
        added++;
      } catch (e) {
        console.error('[Vault Pet] lp add', e);
        skipped++;
      }
    }
    this.dirty();
    this.changed();
    return { ok: added > 0, reason: added ? null : 'skipped', added, skipped, album };
  }

  async ensureFolder(path) {
    const vault = this.app.vault;
    if (vault.getAbstractFileByPath(path)) return;
    const parts = path.split('/');
    let cur = '';
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      if (!vault.getAbstractFileByPath(cur)) await vault.createFolder(cur);
    }
  }

  // ---------- 홈으로 보내는 상태 ----------
  payload() {
    const owned = this.owned();
    const s = this.host.settings;
    const def = this.styleOf('\u0000default'); // 따로 정한 LP 가 없을 때의 기본 꾸미기
    const out = {
      owned,
      folder: this.folder(),
      vol: this.volume(),
      repeat: this.repeat(),
      focusAuto: s.get('lpFocusAuto') === true,
      style: { color: def.color, hex: def.hex, pat: def.pat, pattern: def.pattern },
      albums: [],
      view: '',
      now: null,
      error: this.lastError || '',
    };
    if (!owned) return out;
    const albums = this.albums();
    out.albums = albums.map((a) => {
      const st = this.styleOf(a.key);
      return {
        key: a.key,
        name: a.name,
        label: LP.labelColor(a.name),
        tracks: a.tracks.map((t) => ({ title: t.title, file: t.file, dur: this.durOf(t.path) })),
        style: { color: st.color, hex: st.hex, pat: st.pat, pattern: st.pattern, own: st.own },
      };
    });
    // 목록으로 보여 줄 LP: 틀고 있는 LP, 아니면 마지막에 들은 LP, 아니면 첫 LP
    const last = this.host.state.get('lpLast');
    out.view = this.now && albums.some((a) => a.key === this.now.album) ? this.now.album : (albums.find((a) => a.key === last) || albums[0] || { key: '' }).key;
    const viewAlbum = albums.find((a) => a.key === out.view);
    if (viewAlbum) this.queueDurations(viewAlbum);
    if (this.now && this.audio) {
      const a = this.audio;
      out.now = {
        album: this.now.album,
        idx: this.now.idx,
        playing: !a.paused,
        pos: Number.isFinite(a.currentTime) ? a.currentTime : 0,
        dur: Number.isFinite(a.duration) ? a.duration : 0,
        at: Date.now(),
      };
      const nx = this.trackAfter();
      out.next = nx ? (albums.find((x) => x.key === nx.album) || {}).name : null; // 다음에 이어질 LP 이름 (같은 LP 안이면 null)
      if (nx && nx.album === this.now.album) out.next = null;
    }
    return out;
  }
}

module.exports = { LpPlayer };
