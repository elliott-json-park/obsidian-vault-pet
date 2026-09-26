'use strict';
/*
 * Kit Commit (킷커밋) — Obsidian plugin
 *
 * 옵시디언에 글을 쓸수록 자라는 도트 고양이. 데스크톱 앱 킷커밋의 옵시디언판이다.
 * 고양이·모션·코스튬·장난감·상점·퀘스트·업적·동네 친구·보물 공방은 데스크톱판과 같은 코드(src/kit, src/core)를 쓰고,
 * Claude Code 토큰 대신 옵시디언 사용량(쓴 글자·링크·새 노트·글쓰기 세션)으로 자라고 코인을 번다.
 *
 * 구조
 *  - src/kit   : 데스크톱판 화면 코드 (펫 창·하우스 창). iframe 안에서 돈다 (plugin/frame.js)
 *  - src/core  : 데스크톱판 로직 (성장·상점·퀘스트·업적·친구·보물·게이지·기분) + 옵시디언 사용량 집계(usage.js)
 *  - src/plugin: 데스크톱판 main.js·preload.js 자리 (host.js·frame.js·stage.js) 와 옵시디언 연결(이 파일)
 */
const obsidian = require('obsidian');
const { Plugin, ItemView, PluginSettingTab, Setting, Notice, TFile, TFolder, addIcon, setIcon } = obsidian;
const { Store, DEFAULT_SETTINGS } = require('./store');
const { KitHost, STATE_DEFAULTS } = require('./host');
const { KitFrame } = require('./frame');
const { PetStage } = require('./stage');
const PixelArt = require('../kit/pixelart');
const { UsageTracker, measure, LIVE_CHAR_CAP, LIVE_LINK_CAP, FLUSH_BUDGET, OFFLINE_BUDGET } = require('../core/usage');

const VIEW_TYPE = 'kitcommit-house';
const DATA_VERSION = 1;
const MIN = 60_000;
const TYPE_STOP = 20_000; // 이만큼 손을 떼면 한 차례 쓰기가 끝난 것 (데스크톱판의 'Claude 가 답을 끝냈다')
const BURST_DONE = 45_000; // 이만큼은 이어서 써야 '다 썼다' 모션을 한다
const EMPTY_WAIT = 25_000; // 새로 만든 빈 노트가 이만큼 비어 있으면 느낌표 (데스크톱판의 '허락을 기다린다')

// 사용자가 옵시디언에 설정해 둔 언어 ('ko', 'en', 'ja'…). 처음 설치할 때 고양이 언어를 이걸로 고른다.
// getLanguage() 는 옵시디언 1.8.7 부터 있다. 그 전에는 옵시디언이 쓰는 localStorage 'language'(비어 있으면 영어)를 본다
function obsidianLanguage() {
  try {
    if (typeof obsidian.getLanguage === 'function') return String(obsidian.getLanguage() || 'en').toLowerCase();
  } catch {
    // 옛 옵시디언
  }
  const saved = window.localStorage.getItem('language');
  if (saved) return saved.toLowerCase();
  // 옵시디언 화면 언어를 moment 로케일에 맞춰 둔다
  return String((window.moment && window.moment.locale()) || document.documentElement.lang || 'en').toLowerCase();
}

/* ────────────────────────────── 하우스 (탭) ────────────────────────────── */

class HouseView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.frame = null;
    this.tab = null;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    const p = this.plugin;
    return p.host ? p.host.T.t('obs.houseTitle', { name: p.settings.get('petName') }) : 'Kit Commit';
  }

  getIcon() {
    return this.plugin.pixelIcon('home') || 'home';
  }

  async setState(state, result) {
    if (state && state.tab) {
      this.tab = state.tab;
      if (this.frame) this.frame.emit('house:tab', state.tab);
    }
    return super.setState(state, result);
  }

  getState() {
    return { ...super.getState(), tab: this.tab || null };
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass('kitcommit-house-view');
    this.mountFrame();
  }

  mountFrame() {
    if (this.frame) {
      this.plugin.host.detachHouse(this.frame);
      this.frame.destroy();
    }
    this.frame = new KitFrame(this.plugin.host, 'house');
    this.frame.mount(this.contentEl, { tab: this.tab || 'home', fontCss: this.plugin.fontCss(), dark: this.plugin.isDark() });
    this.plugin.host.attachHouse(this.frame);
  }

  // 탭을 새 창(팝아웃)으로 옮기면 iframe 이 새로 읽히면서 비어 버린다. 그러면 다시 올린다
  onResize() {
    if (this.frame && (!this.frame.win || !this.frame.win.__kcLoaded || this.frame.iframe.ownerDocument !== this.contentEl.ownerDocument)) this.mountFrame();
  }

  async onClose() {
    if (this.frame) {
      this.plugin.host.detachHouse(this.frame);
      this.frame.destroy();
    }
    this.frame = null;
  }
}

/* ────────────────────────────── 설정 탭 (옵시디언) ────────────────────────────── */
// 자세한 설정은 하우스 → 설정 탭에 있다 (데스크톱판과 같다). 여기에는 자주 쓰는 것만

class KitSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const p = this.plugin;
    const t = (k, v) => p.host.T.t(k, v);
    const el = this.containerEl;
    el.empty();
    el.createEl('p', { text: t('obs.settingsIntro'), cls: 'setting-item-description' });
    new Setting(el)
      .setName(t('obs.openHouse'))
      .setDesc(t('obs.openHouseDesc'))
      .addButton((b) => b.setButtonText(t('obs.openHouse')).setCta().onClick(() => p.openHouse('settings')));
    new Setting(el)
      .setName(t('obs.showPet'))
      .setDesc(t('obs.showPetDesc'))
      .addToggle((tg) => tg.setValue(!!p.settings.get('showPet')).onChange((v) => p.host.setSettings({ showPet: v })));
    new Setting(el)
      .setName(t('set.mute'))
      .setDesc(t('set.muteSub'))
      .addToggle((tg) => tg.setValue(!p.settings.get('soundEnabled')).onChange((v) => p.host.setSettings({ soundEnabled: !v })));
    new Setting(el)
      .setName(t('set.language'))
      .addDropdown((d) =>
        d
          .addOption('ko', '한국어')
          .addOption('en', 'English')
          .setValue(p.settings.get('language'))
          .onChange((v) => {
            p.host.setSettings({ language: v });
            this.display();
          }),
      );
    new Setting(el)
      .setName(t('tray.resetPos'))
      .addButton((b) => b.setButtonText(t('tray.resetPos')).onClick(() => p.host.resetPosition()));
    el.createEl('p', { text: t('set.disclaimer'), cls: 'setting-item-description kitcommit-disclaimer' });
  }
}

/* ────────────────────────────── 플러그인 ────────────────────────────── */

class KitCommitPlugin extends Plugin {
  async onload() {
    const raw = (await this.loadData()) || {};
    const firstInstall = !raw.settings;
    const saveHook = (now) => (now ? this.saveNow() : this.saveSoon());
    this.settings = new Store(raw.settings, DEFAULT_SETTINGS, saveHook);
    this.state = new Store(raw.state, STATE_DEFAULTS, saveHook);
    this.meta = { scanned: false, baseline: { c: 0, l: 0, n: 0, s: 0 }, ...(raw.meta || {}) };
    this.usage = new UsageTracker(raw.usage);
    this.usage.on('session', ({ at }) => this.onSession(at));
    // 처음 설치하면 옵시디언 언어를 따른다
    if (firstInstall) {
      const lang = obsidianLanguage();
      this.settings.data.language = lang.startsWith('ko') ? 'ko' : 'en';
      if (this.settings.data.language === 'en') this.settings.data.petName = 'Kit';
    }
    this.pending = new Set();
    this.icons = new Set();
    this.lastInput = Date.now();
    this.loadingProgress = null;

    this.host = new KitHost(this, { settings: this.settings, state: this.state, usage: this.usage });
    this.host.init();
    this.stage = null;

    this.registerView(VIEW_TYPE, (leaf) => new HouseView(leaf, this));
    this.ribbon = this.addRibbonIcon(this.pixelIcon('paw') || 'cat', this.host.T.t('obs.openHouse'), () => this.openHouse());
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass('kitcommit-status', 'mod-clickable');
    this.registerDomEvent(this.statusEl, 'click', (e) => this.host.trayMenu(e));
    this.addCommands();
    this.addSettingTab(new KitSettingTab(this.app, this));

    // 키보드·마우스를 마지막으로 만진 때 (데스크톱판의 powerMonitor.getSystemIdleTime 자리)
    const touch = () => (this.lastInput = Date.now());
    for (const ev of ['keydown', 'mousedown', 'wheel']) this.registerDomEvent(document, ev, touch, { capture: true, passive: true });
    this.registerDomEvent(document, 'mousemove', () => {
      const now = Date.now();
      if (now - this.lastInput > 2000) this.lastInput = now;
    }, { capture: true, passive: true });

    // 밝기: 옵시디언 테마를 따라간다
    this.registerEvent(this.app.workspace.on('css-change', () => this.applyTheme()));
    this.app.workspace.onLayoutReady(() => this.start());
  }

  onunload() {
    window.clearTimeout(this.saveTimer);
    window.clearTimeout(this.flushTimer);
    window.clearTimeout(this.stopTimer);
    window.clearTimeout(this.emptyTimer);
    this.saveNow();
    this.unmountStage();
    if (this.host) this.host.destroy();
  }

  addCommands() {
    const T = () => this.host.T;
    const cmd = (id, key, callback) => this.addCommand({ id, name: T().t(key), callback });
    cmd('open-house', 'obs.cmd.house', () => this.openHouse());
    cmd('open-quests', 'obs.cmd.quests', () => this.openHouse('quests'));
    cmd('open-shop', 'obs.cmd.shop', () => this.openHouse('shop'));
    cmd('open-wardrobe', 'obs.cmd.wardrobe', () => this.openHouse('wardrobe'));
    cmd('feed', 'obs.cmd.feed', () => {
      const r = this.host.feed();
      if (!r.ok) {
        new Notice(T().t('toast.noMeal'));
        this.openHouse('shop');
      }
    });
    cmd('pet', 'obs.cmd.pet', () => this.host.poke());
    cmd('toggle-mute', 'obs.cmd.mute', () => {
      const on = !this.settings.get('soundEnabled');
      this.host.setSettings({ soundEnabled: on });
      new Notice(T().t(on ? 'toast.unmuted' : 'toast.muted'));
    });
    cmd('toggle-quiet', 'obs.cmd.quiet', () => this.host.setQuiet(this.host.isQuiet() ? 0 : 60));
    cmd('toggle-pet', 'obs.cmd.toggle', () => (this.settings.get('showPet') ? this.host.turnOff() : this.host.showPet()));
    cmd('hide-hour', 'obs.cmd.hide', () => this.host.hideFor(60 * MIN));
    cmd('reset-position', 'obs.cmd.position', () => this.host.resetPosition());
    cmd('stop-play', 'obs.cmd.stopPlay', () => this.host.stopPlay());
  }

  async start() {
    this.started = true;
    const { vault, workspace } = this.app;
    if (this.settings.get('showPet')) this.mountStage();

    this.registerEvent(vault.on('modify', (f) => this.queue(f)));
    this.registerEvent(vault.on('create', (f) => this.onCreate(f)));
    this.registerEvent(vault.on('delete', (f) => {
      if (f instanceof TFolder) this.usage.removeUnder(f.path);
      else this.usage.remove(f.path);
      this.saveSoon();
    }));
    this.registerEvent(vault.on('rename', (f, old) => {
      this.usage.rename(old, f.path);
      this.saveSoon();
    }));
    // 열린 노트가 밖에서 바뀌어도 editor-change 가 온다. 편집기에 포커스가 있을 때만 타이핑으로 본다
    this.registerEvent(workspace.on('editor-change', (editor) => {
      if (editor && typeof editor.hasFocus === 'function' && !editor.hasFocus()) return;
      this.onType();
    }));
    this.registerEvent(workspace.on('file-open', (f) => f && this.onOpen(f)));
    this.registerInterval(window.setInterval(() => this.host.fastTick(), 5000));
    this.registerInterval(window.setInterval(() => {
      this.host.minuteTick();
      this.saveSoon();
    }, MIN));

    this.host.brain.activity(Date.now());
    this.host.brain.tick();
    this.updateStatus();
    // 처음이면 하우스에서 안내부터 (데스크톱판처럼)
    if (!this.state.get('onboarded')) this.openHouse('home');
    await this.scan();
    this.host.ready();
    this.updateStatus();
    this.saveSoon();
  }

  /* ── 펫 무대 ── */

  mountStage() {
    if (this.stage || !this.started) return;
    this.stage = new PetStage(this, this.host);
    this.host.stage = this.stage;
    this.stage.mount();
  }

  unmountStage() {
    if (!this.stage) return;
    this.stage.unmount();
    this.stage = null;
    if (this.host) this.host.stage = null;
  }

  /* ── 하우스 ── */

  async openHouse(tab) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (leaf) {
      if (tab) {
        const v = leaf.view;
        if (v instanceof HouseView && v.frame) {
          v.tab = tab;
          v.frame.emit('house:tab', tab);
        } else await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { tab } });
      }
    } else {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { tab: tab || 'home' } });
    }
    workspace.revealLeaf(leaf);
  }

  houseViews() {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view).filter((v) => v instanceof HouseView);
  }

  /* ── 볼트 읽기 ── */

  isExcludedPath(path) {
    return path.startsWith('.') || path.split('/').some((x) => x.startsWith('.'));
  }

  // 처음 설치했을 때는 볼트 전체를 한 번 읽어, 이미 있던 노트의 크기만 기억한다 (이미 써 둔 글은 세지 않는다).
  // 그다음부터는 옵시디언이 꺼져 있던 동안 바뀐 노트만 다시 읽는다.
  async scan() {
    const { vault } = this.app;
    const U = this.usage;
    const all = vault.getMarkdownFiles();
    const files = all.filter((f) => !this.isExcludedPath(f.path));
    if (!this.meta.scanned) {
      this.setLoading(0);
      const base = { c: 0, l: 0, n: 0, s: 0 };
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        try {
          const m = measure(await vault.cachedRead(f));
          U.observe(f.path, m, new Date(), { mtime: f.stat.mtime, baseline: true });
          base.c += m.chars;
          base.l += m.links;
          if (m.chars >= 10) base.n++;
        } catch {
          // 못 읽는 파일은 건너뛴다
        }
        if (i % 40 === 39) {
          this.setLoading((i + 1) / files.length);
          await new Promise((r) => window.setTimeout(r, 0));
        }
      }
      for (const f of vault.getFiles()) if (f.extension === 'canvas') U.observe(f.path, { chars: 0, links: 0 }, new Date(), { baseline: true, mtime: f.stat.mtime });
      this.meta.baseline = base;
      this.meta.scanned = true;
    } else {
      const budget = { ...OFFLINE_BUDGET };
      U.keepOnly(vault.getFiles().map((f) => f.path));
      for (const f of files) {
        const seen = U.mtimeOf(f.path);
        if (seen !== null && seen >= f.stat.mtime) continue;
        try {
          const m = measure(await vault.cachedRead(f));
          U.observe(f.path, m, new Date(f.stat.mtime), { mtime: f.stat.mtime, cap: LIVE_CHAR_CAP, linkCap: LIVE_LINK_CAP, budget, offline: true });
        } catch {
          // 다음 기회에
        }
      }
    }
    this.setLoading(null);
    this.saveSoon();
  }

  setLoading(p) {
    this.loadingProgress = p;
    this.host.send('pet:loading', p);
  }

  baselineTotals() {
    return this.meta.baseline || { c: 0, l: 0, n: 0, s: 0 };
  }

  onCreate(f) {
    if (!(f instanceof TFile) || this.isExcludedPath(f.path)) return;
    if (f.extension === 'canvas') {
      this.usage.canvas(f.path);
      this.saveSoon();
      this.host.onUsage();
      return;
    }
    if (f.extension !== 'md') return;
    // 빈 노트를 새로 만들었다. 한참 비어 있으면 고양이가 느낌표를 띄우고 기다린다
    if (!f.stat.size) {
      this.emptyNote = f.path;
      this.armEmptyWait();
    }
    this.queue(f);
  }

  armEmptyWait() {
    window.clearTimeout(this.emptyTimer);
    this.emptyTimer = window.setTimeout(() => {
      const f = this.emptyNote && this.app.vault.getAbstractFileByPath(this.emptyNote);
      const active = this.app.workspace.getActiveFile();
      if (!(f instanceof TFile) || f.stat.size || !active || active.path !== f.path || this.typing) return;
      this.host.brain.hook({ name: 'Notification', at: Date.now(), sessionId: 'obsidian', notificationType: 'idle_prompt', message: '' });
    }, EMPTY_WAIT);
  }

  queue(f) {
    if (!(f instanceof TFile) || f.extension !== 'md' || this.isExcludedPath(f.path)) return;
    this.pending.add(f.path);
    window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => this.flush(), 1500);
  }

  async flush() {
    if (!this.meta.scanned) {
      this.flushTimer = window.setTimeout(() => this.flush(), 2000);
      return;
    }
    const paths = [...this.pending];
    this.pending.clear();
    const sum = { dc: 0, dl: 0, dn: 0, feat: 0 };
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
      const r = this.usage.observe(path, measure(text), new Date(), { mtime: f.stat.mtime, cap: LIVE_CHAR_CAP, linkCap: LIVE_LINK_CAP, budget });
      sum.dc += r.dc;
      sum.dl += r.dl;
      sum.dn += r.dn;
      sum.feat += Object.keys(r.feat || {}).length;
      if (path === this.emptyNote && f.stat.size) {
        this.emptyNote = null;
        this.host.brain.answered();
      }
    }
    this.saveSoon();
    if (!sum.dc && !sum.dl && !sum.dn && !sum.feat) return;
    this.host.onUsage();
  }

  // 편집기에서 글을 쓰는 중 (데스크톱판에서 Claude 가 답을 쓰는 동안 = 노트북 꺼내 같이 타이핑)
  onType() {
    const now = Date.now();
    const brain = this.host.brain;
    if (!this.typing) {
      this.typing = true;
      this.typeStart = now;
      brain.hook({ name: 'UserPromptSubmit', at: now, sessionId: 'obsidian' });
    } else if (now - (this.lastType || 0) > 1000) brain.activity(now);
    this.lastType = now;
    window.clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => this.typeStop(), TYPE_STOP);
  }

  // 한 차례 쓰기를 마쳤다. 오래 썼으면 '다 썼다' 모션 (데스크톱판의 Stop hook)
  typeStop() {
    this.typing = false;
    const brain = this.host.brain;
    const long = this.lastType - this.typeStart >= BURST_DONE;
    if (long) brain.hook({ name: 'Stop', at: Date.now(), sessionId: 'obsidian' });
    else {
      brain.generating = 0;
      brain.tick();
    }
  }

  onOpen(f) {
    const brain = this.host.brain;
    brain.activity(Date.now());
    // 다른 노트로 가면 빈 노트를 기다리던 건 그만
    if (this.emptyNote && f.path !== this.emptyNote) {
      this.emptyNote = null;
      brain.answered();
    } else if (this.emptyNote === f.path) this.armEmptyWait();
    if (f.extension !== 'md' || this.isExcludedPath(f.path)) return;
    this.usage.open(f.path);
    this.saveSoon();
    window.clearTimeout(this.openTimer);
    this.openTimer = window.setTimeout(() => this.host.onUsage(), 800);
  }

  // 글쓰기 세션이 새로 열렸다 (usage 가 알려 준다)
  onSession(at) {
    this.host.brain.hook({ name: 'SessionStart', at, sessionId: 'obsidian', source: 'startup' });
  }

  idleSeconds() {
    return Math.max(0, (Date.now() - this.lastInput) / 1000);
  }

  // 볼트 맨 윗단 폴더 이름들 (설정의 '경험치에 넣을 폴더')
  topFolders() {
    return this.app.vault.getRoot().children.filter((x) => x instanceof TFolder && !x.name.startsWith('.')).map((x) => x.name);
  }

  // 백링크가 가장 많은 노트의 백링크 수. 2분 동안 기억한다
  linkStats() {
    const now = Date.now();
    if (this._links && now - this._links.at < 2 * MIN) return this._links;
    const counts = {};
    let total = 0;
    const resolved = this.app.metadataCache.resolvedLinks || {};
    for (const [src, targets] of Object.entries(resolved)) {
      for (const [dst, n] of Object.entries(targets)) {
        total += n;
        if (dst !== src) counts[dst] = (counts[dst] || 0) + 1;
      }
    }
    this._links = { at: now, max: Math.max(0, ...Object.values(counts)), total };
    return this._links;
  }

  // 볼트 전체 숫자 (통계의 누적 기록 · 자랑 카드)
  vaultNumbers() {
    let chars = 0;
    for (const f of Object.values(this.usage.data.files)) chars += f[0] || 0;
    return { notes: this.app.vault.getMarkdownFiles().length, chars, links: this.linkStats().total };
  }

  /* ── 자랑 카드 ── */

  async saveCard(dataUrl, name) {
    try {
      const b64 = dataUrl.split(',')[1] || '';
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const file = `kitcommit-${String(name).replace(/[\\/:*?"<>|#^[\]]/g, '') || 'cat'}.png`;
      const active = this.app.workspace.getActiveFile();
      const path = await this.app.fileManager.getAvailablePathForAttachment(file, active ? active.path : '');
      await this.app.vault.createBinary(path, buf.buffer);
      new Notice(this.host.T.t('obs.cardSaved', { path }));
      return true;
    } catch (e) {
      console.error('[Kit Commit] card', e);
      new Notice(String(e && e.message ? e.message : e));
      return false;
    }
  }

  async copyImage(dataUrl) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch (e) {
      console.error('[Kit Commit] copy', e);
      return false;
    }
  }

  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  // 처음부터 다시 키우기. 고양이·지갑·업적·퀘스트·창고를 지우고 플러그인을 다시 켠다.
  // 언어·뺀 폴더·고양이 자리는 남긴다. 노트마다 최고 기록은 남겨서 이미 쓴 글이 다시 세지지 않고,
  // 시간별 기록은 비운다 (데스크톱판은 Claude 기록이 따로 있어서 남겼지만, 옵시디언판은 이 기록이 전부라 같은 시간대 글이 다시 세지지 않게)
  resetAll() {
    const keep = ['language', 'excludedProjects', 'position', 'showPet'];
    this.settings.data = { ...structuredClone(DEFAULT_SETTINGS), ...Object.fromEntries(keep.map((k) => [k, this.settings.get(k)])) };
    this.state.data = structuredClone(STATE_DEFAULTS);
    this.usage.data.projects = {};
    this.usage.data.lastEdit = 0;
    this.saveNow();
    window.setTimeout(async () => {
      const id = this.manifest.id;
      const plugins = this.app.plugins;
      await plugins.disablePlugin(id);
      await plugins.enablePlugin(id);
    }, 300);
  }

  /* ── 모양 ── */

  isDark() {
    return document.body.classList.contains('theme-dark');
  }

  applyTheme() {
    const dark = this.isDark();
    if (this.stage && this.stage.frame) this.stage.frame.setDark(dark);
    for (const v of this.houseViews()) if (v.frame) v.frame.setDark(dark);
  }

  // 글꼴: 플러그인 폴더에 fonts/ 가 있으면 프리텐다드를 쓴다 (없으면 설치된 글꼴 → 시스템 글꼴)
  fontCss() {
    if (this._fontCss !== undefined) return this._fontCss;
    const dir = this.manifest.dir;
    const url = (f) => this.app.vault.adapter.getResourcePath(`${dir}/fonts/${f}`);
    let css = '';
    try {
      css = `@font-face{font-family:'Pretendard';font-weight:400;font-display:swap;src:local('Pretendard Variable'),local('Pretendard Regular'),local('Pretendard'),url('${url('Pretendard-Regular.otf')}') format('opentype');}
@font-face{font-family:'Pretendard';font-weight:700;font-display:swap;src:local('Pretendard Variable'),local('Pretendard Bold'),url('${url('Pretendard-Bold.otf')}') format('opentype');}`;
    } catch {
      css = '';
    }
    this._fontCss = css;
    return css;
  }

  // 도트 아이콘을 옵시디언 아이콘으로 등록하고 이름을 돌려준다 (메뉴·리본·탭 아이콘)
  pixelIcon(name) {
    if (!PixelArt.has(name)) return null;
    const id = 'kitcommit-' + name;
    if (!this.icons.has(id)) {
      const svg = PixelArt.svg(name, 100);
      const w = Number((svg.match(/width="(\d+)"/) || [])[1]) || 100;
      const h = Number((svg.match(/height="(\d+)"/) || [])[1]) || 100;
      addIcon(id, svg.replace(/^<svg class="[^"]*"/, `<svg x="${(100 - w) / 2}" y="${(100 - h) / 2}" style="stroke:none"`));
      this.icons.add(id);
    }
    return id;
  }

  // 상태 표시줄: 발바닥 · 이름 · 레벨 (데스크톱판의 트레이 아이콘 자리). 누르면 트레이 메뉴
  updateStatus() {
    const el = this.statusEl;
    if (!el || !this.host) return;
    const g = this.host.growth;
    const name = this.settings.get('petName');
    const text = g ? `${name} Lv.${g.level}` : name;
    const key = `${text}|${this.host.isQuiet()}|${this.host.petVisible()}`;
    if (this._status === key) return;
    this._status = key;
    el.empty();
    const ic = el.createSpan({ cls: 'kitcommit-status-icon' });
    ic.innerHTML = PixelArt.svg(this.host.isQuiet() ? 'bellOff' : 'paw', 14);
    el.createSpan({ text });
    el.setAttribute('aria-label', this.host.T.t('obs.statusTip'));
  }

  // 언어가 바뀌면 탭 이름·리본 설명을 다시
  relabel() {
    this._status = null;
    this.updateStatus();
    if (this.ribbon) this.ribbon.setAttribute('aria-label', this.host.T.t('obs.openHouse'));
    for (const v of this.houseViews()) if (v.leaf && typeof v.leaf.updateHeader === 'function') v.leaf.updateHeader();
  }

  /* ── 저장 ── */

  saveSoon() {
    this.dirty = true;
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), 1500);
  }

  saveNow() {
    window.clearTimeout(this.saveTimer);
    if (!this.settings) return;
    this.dirty = false;
    return this.saveData({ version: DATA_VERSION, settings: this.settings.data, state: this.state.data, usage: this.usage.data, meta: this.meta }).catch((e) => console.error('[Kit Commit] save', e));
  }
}

module.exports = KitCommitPlugin;
module.exports.default = KitCommitPlugin;
