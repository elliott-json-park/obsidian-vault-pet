'use strict';
/*
 * Kit Commit (킷커밋) — Obsidian plugin
 *
 * 옵시디언에 글을 쓸수록 자라는 도트 고양이. 데스크톱 앱 킷커밋의 옵시디언판이다.
 * 고양이·모션·코스튬·장난감·상점·퀘스트·업적은 데스크톱판과 같은 코드(src/kit, src/core)를 쓰고,
 * Claude Code 토큰 대신 옵시디언 사용량(쓴 글자·링크·새 노트·글쓰기 세션)으로 자라고 코인을 번다.
 * 2.0.0: 옵시디언을 잘 쓰게 돕는 고양이. 홈에 집중 타이머 · 할 일 · 노트 지도 · 최근 노트, 퀘스트 · 업적은 옵시디언 습관으로.
 * 동네 친구 · 보물 공방 · 그날의 기분 · 먹고 싶은 것 · 오늘의 소식은 없앴다.
 *
 * 구조
 *  - src/kit   : 데스크톱판 화면 코드 (펫 창·하우스 창). iframe 안에서 돈다 (plugin/frame.js)
 *  - src/core  : 데스크톱판 로직 (성장·상점·퀘스트·업적·게이지) + 옵시디언 사용량 집계(usage.js) · 할 일(todos.js)
 *  - src/plugin: 데스크톱판 main.js·preload.js 자리 (host.js·frame.js·stage.js) 와 옵시디언 연결(이 파일)
 */
const obsidian = require('obsidian');
const { Plugin, ItemView, Modal, PluginSettingTab, Setting, Notice, TFile, TFolder, addIcon, setIcon } = obsidian;
const { Store, DEFAULT_SETTINGS, DEFAULT_PET_NAME } = require('./store');
const { KitHost, STATE_DEFAULTS } = require('./host');
const { KitFrame } = require('./frame');
const { PetStage } = require('./stage');
const { isLegacy, legacySummary, legacySettings, LEGACY_COSTUME } = require('./legacy');
const { loadSafe, backupDaily, readJson } = require('./safedata');
const { SyncBook } = require('./sync');
const vaultmap = require('./vaultmap');
const { VIEWS } = require('../core/skills');
const PixelArt = require('../kit/pixelart');
const { UsageTracker, measure, folderKey, pathKey, inFolders, LIVE_CHAR_CAP, LIVE_LINK_CAP, FLUSH_BUDGET, OFFLINE_BUDGET } = require('../core/usage');
const { goalConfig, GOAL_PRESETS, GOAL_RANGE, FOCUS_LENGTHS } = require('../core/goals');

const VIEW_TYPE = 'kitcommit-house';
const DATA_VERSION = 1;
const FEEDBACK_URL = 'https://github.com/elliott-json-park/obsidian-vault-pet/issues/new/choose'; // 버그·아이디어 (누를 때만 브라우저로 연다)
const MIN = 60_000;
const PASTE_KEEP = MIN; // 붙여 넣은 글을 '세지 않을 몫'으로 들고 있는 시간
const TYPE_STOP = 20_000; // 이만큼 손을 떼면 한 차례 쓰기가 끝난 것 (데스크톱판의 'Claude 가 답을 끝냈다')
const BURST_DONE = 45_000; // 이만큼은 이어서 써야 '다 썼다' 모션을 한다
const EMPTY_WAIT = 25_000; // 새로 만든 빈 노트가 이만큼 비어 있으면 느낌표 (데스크톱판의 '허락을 기다린다')
// 이 기기에서 쓰지 않은 노트 변화(동기화로 온 글 · 다른 앱)는 이만큼 기다렸다 센다. 그 사이 다른 기기의 data.json 이 오면
// 그쪽 노트 기록이 이미 그 글을 덮고 있어서 두 번 세지 않는다 (1.5.1, plugin/sync.js)
const FOREIGN_WAIT = 30_000;
const LOCAL_EDIT = 2 * MIN; // 이 안에 이 기기 편집기에서 손댄 노트는 이 기기에서 쓴 글
const PREMERGE_EVERY = 10 * MIN; // 합치기 전 자료(data.premerge.json)를 남기는 간격
const SUB_MAX = 500; // 설정에 보이는 하위 폴더 수 상한 (1.6.0)
const ORPHAN_FIXED_KEEP = 2000; // 외톨이에서 벗어난 노트를 이만큼 기억한다 (같은 노트로 두 번 세지 않게, 2.0.0)
const HOME_PUSH_WAIT = 1500; // 노트를 열거나 링크가 바뀌면 이만큼 모아서 홈(노트 지도 · 최근 노트)을 다시 그린다

// 사용자가 옵시디언에 설정해 둔 언어 ('ko', 'en', 'ja'…). 처음 설치할 때 고양이 언어를 이걸로 고른다.
// getLanguage() 는 옵시디언 1.8.7 부터 있다. 그 전에는 옵시디언이 화면 언어에 맞춰 둔 moment 로케일을 본다
function obsidianLanguage() {
  try {
    if (typeof obsidian.getLanguage === 'function') return String(obsidian.getLanguage() || 'en').toLowerCase();
  } catch {
    // 옛 옵시디언
  }
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
    return p.host ? p.host.T.t('obs.houseTitle', { name: p.settings.get('petName') }) : 'Vault Pet';
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
    this.hookKeys();
  }

  // 하우스(iframe)를 누르면 키보드가 iframe 으로 가서 옵시디언 단축키(Ctrl+P·Ctrl+O·Ctrl+W…)가 안 먹었다.
  // 하우스를 누르면 이 탭을 지금 탭으로 삼고, 단축키는 옵시디언 쪽으로 넘겨준다
  hookKeys() {
    const fw = this.frame && this.frame.win;
    if (!fw) return;
    const ws = this.app.workspace;
    fw.addEventListener('mousedown', () => {
      if (ws.getActiveViewOfType(HouseView) !== this) ws.setActiveLeaf(this.leaf, { focus: false });
    }, { capture: true });
    fw.addEventListener('keydown', (e) => {
      if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;
      if (!(e.ctrlKey || e.metaKey || e.altKey) && !/^F\d+$/.test(e.key)) return;
      const t = e.target;
      const typing = t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
      // 글자 칸 안의 전체 선택·복사·붙여넣기·되돌리기는 그 칸에서
      if (typing && !e.altKey && /^[acvxyz]$/i.test(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const doc = this.contentEl.ownerDocument;
      const win = doc.defaultView;
      if (!this.frame) return;
      this.frame.iframe.blur();
      win.focus();
      const init = { key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey, repeat: e.repeat, bubbles: true, cancelable: true };
      const target = doc.activeElement && doc.activeElement !== this.frame.iframe ? doc.activeElement : doc.body;
      target.dispatchEvent(new win.KeyboardEvent('keydown', init));
    }, { capture: true });
  }

  // 탭을 새 창(팝아웃)이나 다른 분할 창으로 옮기면 iframe 이 새로 읽히면서 비어 버린다. 그러면 다시 올린다
  // (같은 창 안에서 옮기면 문서는 같지만 iframe 안 창이 새것으로 바뀐다)
  onResize() {
    const fr = this.frame;
    if (!fr) return;
    const stale = !fr.win || !fr.iframe || fr.iframe.contentWindow !== fr.win || fr.iframe.ownerDocument !== this.contentEl.ownerDocument;
    // 화면 코드가 터져서 못 올라온 거면 크기가 바뀔 때마다 다시 만들지 않는다 (한 번 실패하면 그대로)
    if (stale || (!fr.win.__kcLoaded && !fr.failed)) this.mountFrame();
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
      .setName(t('obs.houseSide'))
      .setDesc(t('obs.houseSideDesc'))
      .addToggle((tg) =>
        tg.setValue(!!p.settings.get('houseInSidebar')).onChange((v) => {
          p.settings.set({ houseInSidebar: v });
          p.openHouse(null, v ? 'side' : 'tab');
        }),
      );
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
          .addOption('zh', '中文')
          .setValue(p.settings.get('language'))
          .onChange((v) => {
            p.host.setSettings({ language: v });
            this.display();
          }),
      );
    new Setting(el)
      .setName(t('tray.resetPos'))
      .addButton((b) => b.setButtonText(t('tray.resetPos')).onClick(() => p.host.resetPosition()));
    new Setting(el)
      .setName(t('obs.feedback'))
      .setDesc(t('obs.feedbackDesc'))
      .addButton((b) => b.setButtonText(t('obs.feedbackBtn')).onClick(() => p.openFeedback()));

    // 하루 목표 · 집중 시간 (1.5.0). 하우스 설정과 같은 값을 바꾼다. 일반 설정 뒤 두 번째 묶음이라 제목을 단다
    new Setting(el).setName(t('goal.setHead')).setHeading();
    const g = goalConfig(p.settings.get('goal'), p.settings.get('language'));
    const setGoal = (patch) => {
      p.host.setSettings({ goal: { ...goalConfig(p.settings.get('goal'), p.settings.get('language')), ...patch } });
      this.display();
    };
    new Setting(el)
      .setName(t('goal.setOn'))
      .setDesc(t('goal.setOnDesc', { coins: 100 }))
      .addToggle((tg) => tg.setValue(g.on).onChange((v) => setGoal({ on: v })));
    if (g.on) {
      new Setting(el)
        .setName(t('goal.setUnit'))
        .setDesc(t('goal.setUnitDesc'))
        .addDropdown((d) =>
          d
            .addOption('words', t('goal.unit.words'))
            .addOption('chars', t('goal.unit.chars'))
            .setValue(g.unit)
            .onChange((v) => setGoal({ unit: v, target: v === g.unit ? g.target : GOAL_PRESETS[v][1] })),
        );
      const [lo, hi] = GOAL_RANGE[g.unit];
      new Setting(el)
        .setName(t('goal.setTarget'))
        .setDesc(t(g.unit === 'words' ? 'goal.setTargetDescW' : 'goal.setTargetDescC'))
        .addText((tx) => {
          tx.inputEl.type = 'number';
          tx.inputEl.min = String(lo);
          tx.inputEl.max = String(hi);
          tx.inputEl.addClass('vaultpet-goal-input');
          tx.setValue(String(g.target));
          tx.inputEl.addEventListener('change', () => {
            const n = Number(tx.getValue());
            if (Number.isFinite(n) && n > 0) setGoal({ target: n });
            else tx.setValue(String(g.target));
          });
        });
    }
    new Setting(el)
      .setName(t('focus.setLen'))
      .setDesc(t('focus.setLenDesc'))
      .addDropdown((d) => {
        for (const m of FOCUS_LENGTHS) d.addOption(String(m), t('focus.menuLen', { m }));
        d.setValue(String(p.host.goals.focusLength())).onChange((v) => p.host.setSettings({ focusMin: Number(v) }));
      });

    el.createEl('p', { text: t('set.disclaimer'), cls: 'setting-item-description kitcommit-disclaimer' });
  }
}

/* ────────────────────────────── Vault Pet 0.x 사용자 안내 (한 번만) ────────────────────────────── */

class LegacyModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const p = this.plugin;
    const t = (k, v) => p.host.T.t(k, v);
    const L = p.meta.legacy;
    const fmt = (n) => Number(n).toLocaleString(p.host.T.locale);
    this.modalEl.addClass('vaultpet-legacy');
    this.titleEl.setText(t('legacy.title'));
    const el = this.contentEl;
    el.empty();
    el.createEl('p', { text: t('legacy.thanks', { days: fmt(L.days), lv: L.level }) });
    el.createEl('p', { text: t('legacy.body') });
    const gifts = el.createDiv({ cls: 'vaultpet-legacy-gifts' });
    const row = (icon, text) => {
      const r = gifts.createDiv({ cls: 'vaultpet-legacy-gift' });
      const id = p.pixelIcon(icon);
      if (id) setIcon(r.createSpan({ cls: 'vaultpet-legacy-icon' }), id);
      r.createSpan({ text });
    };
    row('coin', t('legacy.coins', { coins: fmt(L.coins) }));
    row(LEGACY_COSTUME, t('legacy.costume'));
    el.createEl('p', { text: t('legacy.note'), cls: 'setting-item-description' });
    new Setting(el)
      .addButton((b) => b.setButtonText(t('legacy.ok')).onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText(t('legacy.wear'))
          .setCta()
          .onClick(() => {
            p.host.setSettings({ outfit: { head: LEGACY_COSTUME } });
            this.close();
            p.openHouse('wardrobe');
          }),
      );
  }

  onClose() {
    this.contentEl.empty();
    const L = this.plugin.meta.legacy;
    if (L && !L.shown) {
      L.shown = true;
      this.plugin.saveSoon();
    }
  }
}

/* ────────────────────────────── 플러그인 ────────────────────────────── */

class KitCommitPlugin extends Plugin {
  async onload() {
    // 깨진 data.json 은 백업으로 되살린다 (safedata.js). 되살렸는지는 start() 에서 알린다
    const loaded = await loadSafe(this.app.vault.adapter, this.manifest.dir);
    this.diskStamp = await this.statData(); // 마지막으로 읽거나 쓴 data.json (밖에서 바뀌었나 볼 때)
    this.loadSource = loaded.source;
    let raw = loaded.raw || {};
    // 백업할 것: 방금 잘 읽힌 자료 (0.x 자료는 곧 새 형식으로 바뀌니 빼 둔다)
    this.loadedRaw = loaded.source === 'data' && !isLegacy(raw) ? raw : null;
    // Vault Pet 0.x 에서 업데이트했다: 예전 기록은 선물로 바꾸고, 새 고양이는 처음부터 (설정 몇 가지·이름만 옮긴다)
    const legacy = isLegacy(raw) ? legacySummary(raw) : null;
    if (legacy) raw = { settings: legacySettings(raw) };
    const firstInstall = !raw.settings || !!legacy;
    const saveHook = (now) => (now ? this.saveNow() : this.saveSoon());
    this.settings = new Store(raw.settings, DEFAULT_SETTINGS, saveHook);
    this.state = new Store(raw.state, STATE_DEFAULTS, saveHook);
    this.meta = { scanned: false, baseline: { c: 0, l: 0, n: 0, s: 0 }, ...(raw.meta || {}) };
    // 여러 기기 합치기의 판 장부 (plugin/sync.js)
    this.sync = new SyncBook(this.deviceId(), raw);
    // 지난번에 마지막으로 저장한 때. 그 뒤로 안 바뀐 노트는 꺼져 있던 동안 쓴 글이 아니다 (scan)
    this.prevSeen = this.meta.lastSeen || 0;
    this.usage = new UsageTracker(raw.usage);
    this.usage.on('session', ({ at }) => this.onSession(at));
    // 처음 설치하면 옵시디언 언어를 따른다
    if (firstInstall) {
      if (!(raw.settings || {}).language) {
        const lang = obsidianLanguage();
        this.settings.data.language = lang.startsWith('ko') ? 'ko' : lang.startsWith('zh') ? 'zh' : 'en';
      }
      if (legacy && legacy.petName) this.settings.data.petName = legacy.petName;
      else if (DEFAULT_PET_NAME[this.settings.data.language]) this.settings.data.petName = DEFAULT_PET_NAME[this.settings.data.language];
    }
    this.pending = new Set();
    this.typed = new Map(); // 노트 경로 → 이 기기 편집기에서 마지막으로 손댄 때
    this.foreign = new Map(); // 노트 경로 → 이 기기에서 쓰지 않은 변화를 처음 본 때 (FOREIGN_WAIT)
    this.pasted = new Map(); // 노트 경로 → 붙여넣기·끌어다 놓기로 들어온 글 { c, l, at } (세지 않는다)
    this.icons = new Set();
    this.lastInput = Date.now();
    this.loadingProgress = null;

    this.host = new KitHost(this, { settings: this.settings, state: this.state, usage: this.usage });
    this.host.init();
    this.stage = null;
    if (legacy) {
      // 선물: 코인은 지갑 보너스로, 기념 코스튬은 옷장에. 새 형식으로 바로 저장해서 두 번 받지 않게 한다
      this.state.set({ walletBonus: (this.state.get('walletBonus') || 0) + legacy.coins });
      this.host.shop.give({ item: LEGACY_COSTUME });
      this.meta.legacy = { ...legacy, at: Date.now(), shown: false };
      await this.saveNow();
    }

    this.registerView(VIEW_TYPE, (leaf) => new HouseView(leaf, this));
    this.ribbon = this.addRibbonIcon(this.pixelIcon('catface', true) || 'cat', this.host.T.t('obs.openHouse'), () => this.openHouse());
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
    window.clearTimeout(this.homeTimer);
    window.clearInterval(this.focusTimer);
    // 바닥에 떨어진 채 안 먹은 먹이는 창고로 돌려 둔 뒤 저장한다
    if (this.host) this.host.refundTreats();
    this.unloading = true;
    this.saveNow();
    this.unmountStage();
    if (this.host) this.host.destroy();
  }

  addCommands() {
    const T = () => this.host.T;
    const cmd = (id, key, callback) => this.addCommand({ id, name: T().t(key), callback });
    cmd('open-house', 'obs.cmd.house', () => this.openHouse());
    cmd('open-house-sidebar', 'obs.cmd.houseSide', () => this.openHouse(null, 'side'));
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
    // 집중 시간 (1.5.0)
    cmd('focus-start', 'focus.cmdStart', () => this.host.focusStart(this.host.goals.focusLength()));
    cmd('focus-stop', 'focus.cmdStop', () => this.host.focusStop());
    cmd('goal-show', 'goal.cmdShow', () => new Notice(this.host.goalLine()));
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
      // 기록 없는 노트(뺀 폴더에 있던 노트 등)가 옮겨 들어오면 지금 크기를 기준으로만 잡는다 (옮긴 건 새로 쓴 글이 아니다)
      const fresh = (f instanceof TFolder ? this.app.vault.getMarkdownFiles().filter((x) => x.path.startsWith(f.path + '/')) : [f])
        .filter((x) => x instanceof TFile && x.extension === 'md' && !this.usage.known(old + x.path.slice(f.path.length)));
      this.usage.rename(old, f.path);
      for (const x of fresh) this.baselineFile(x);
      this.noteRename(f, old);
      this.saveSoon();
    }));
    // 붙여넣기·끌어다 놓기로 들어온 글은 경험치·코인이 되지 않는다 (README '공정하게')
    this.registerEvent(workspace.on('editor-paste', (evt, editor, info) => this.notePasted(info && info.file, evt.clipboardData)));
    this.registerEvent(workspace.on('editor-drop', (evt, editor, info) => this.notePasted(info && info.file, evt.dataTransfer)));
    // 열린 노트가 밖에서 바뀌어도 editor-change 가 온다. 편집기에 포커스가 있을 때만 타이핑으로 본다
    this.registerEvent(workspace.on('editor-change', (editor, info) => {
      if (editor && typeof editor.hasFocus === 'function' && !editor.hasFocus()) return;
      this.markTyped(info && info.file);
      this.onType();
    }));
    this.registerEvent(workspace.on('file-open', (f) => f && this.onOpen(f)));
    // 옵시디언 화면(그래프 · 검색 · 백링크 · 개요 …)을 열어 본 것 (2.0.0 퀘스트 · 업적 · 다음 단계 안내)
    this.registerEvent(workspace.on('active-leaf-change', (leaf) => this.noteView(leaf)));
    // 링크가 바뀌면 외톨이 노트 · 노트 지도를 다시 본다
    this.registerEvent(this.app.metadataCache.on('resolved', () => {
      this.linksDirty = true;
      this._links = null;
      this.homeSoon();
    }));
    this.usage.dailyTest = vaultmap.dailyMatcher(this.app);
    this.registerInterval(window.setInterval(() => this.host.fastTick(), 5000));
    this.registerInterval(window.setInterval(() => {
      this.host.minuteTick();
      this.orphanTick();
      // 데일리 노트 설정을 바꿨을 수 있다
      this.usage.dailyTest = vaultmap.dailyMatcher(this.app);
      this.saveSoon();
    }, MIN));

    this.host.brain.activity(Date.now());
    this.host.brain.tick();
    this.updateStatus();
    // 처음이면 하우스에서 안내부터 (데스크톱판처럼)
    if (!this.state.get('onboarded')) this.openHouse('home');
    if (this.meta.legacy && !this.meta.legacy.shown) new LegacyModal(this.app, this).open();
    if (this.loadSource === 'backup' || this.loadSource === 'lost') new Notice(this.host.T.t(this.loadSource === 'backup' ? 'obs.dataRestored' : 'obs.dataLost'), 15000);
    this.backup();
    await this.scan();
    this.host.ready();
    // 껐다 켜는 동안 집중 시간이 이어지고 있었으면 이어서 센다 (이미 끝났으면 host.focusTick 이 정리한다)
    this.host.focusTick();
    this.focusChanged();
    this.updateStatus();
    this.saveSoon();
    // 켜는 동안 다른 기기의 data.json 이 왔으면 이제 합친다
    if (this.mergeLater) {
      this.mergeLater = false;
      this.onExternalSettingsChange();
    }
  }

  // 집중하는 동안만 상태 표시줄의 남은 시간을 1초마다 고친다
  focusChanged() {
    const on = this.host && this.host.goals.focusInfo().on;
    if (on && !this.focusTimer) this.focusTimer = window.setInterval(() => this.updateStatus(), 1000);
    else if (!on && this.focusTimer) {
      window.clearInterval(this.focusTimer);
      this.focusTimer = null;
    }
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

  // where: 'side' = 오른쪽 사이드바, 'tab' = 가운데 탭. 안 주면 설정(houseInSidebar)을 따른다.
  // 이미 열린 하우스가 있으면 그 자리를 그대로 쓴다 (다른 자리로 열어 달라고 했으면 옮긴다)
  async openHouse(tab, where) {
    const { workspace } = this.app;
    const side = (where || (this.settings.get('houseInSidebar') ? 'side' : 'tab')) === 'side';
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (leaf && where && (leaf.getRoot() === workspace.rightSplit) !== side) {
      leaf.detach();
      leaf = null;
    }
    if (leaf) {
      if (tab) {
        const v = leaf.view;
        if (v instanceof HouseView && v.frame) {
          v.tab = tab;
          v.frame.emit('house:tab', tab);
        } else await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { tab } });
      }
    } else {
      leaf = side ? workspace.getRightLeaf(false) : workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { tab: tab || 'home' } });
    }
    workspace.revealLeaf(leaf);
  }

  houseViews() {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view).filter((v) => v instanceof HouseView);
  }

  /* ── 볼트 읽기 ── */

  // 숨김 폴더와, 설정에서 뺀 폴더(맨 윗단 또는 하위 폴더, 1.6.0)는 읽지도 세지도 않는다
  isExcludedPath(path) {
    if (path.startsWith('.') || path.split('/').some((x) => x.startsWith('.'))) return true;
    const ex = this.settings.get('excludedProjects') || [];
    if (this._exList !== ex) {
      this._exList = ex;
      this._exSet = new Set(ex);
    }
    return inFolders(path, this._exSet);
  }

  // 이 기기 편집기에서 손댄 노트 (FOREIGN_WAIT 없이 바로 센다)
  markTyped(file) {
    if (!file || !file.path) return;
    this.typed.set(file.path, Date.now());
    if (this.typed.size > 200) for (const [p, at] of this.typed) if (Date.now() - at > LOCAL_EDIT) this.typed.delete(p);
  }

  notePasted(file, data) {
    this.markTyped(file);
    if (!file || !data || typeof data.getData !== 'function') return;
    const m = measure(data.getData('text/plain') || '');
    if (!m.chars && !m.links) return;
    const p = this.pasted.get(file.path);
    const fresh = p && Date.now() - p.at < PASTE_KEEP;
    this.pasted.set(file.path, { c: (fresh ? p.c : 0) + m.chars, l: (fresh ? p.l : 0) + m.links, w: (fresh ? p.w || 0 : 0) + m.words, at: Date.now() });
  }

  async baselineFile(f) {
    if (this.isExcludedPath(f.path)) return;
    try {
      this.usage.observe(f.path, measure(await this.app.vault.cachedRead(f)), new Date(), { mtime: f.stat.mtime, baseline: true });
      this.saveSoon();
    } catch {
      // 못 읽으면 다음 기회에 (그때는 상한 안에서 센다)
    }
  }

  // 뺐던 폴더를 다시 넣었다. 그동안 안 읽었으니, 지금 크기를 기준으로만 잡는다 (뺀 동안 쓴 글이 한꺼번에 세지지 않게)
  async rebaseline(ids) {
    const want = new Set(ids);
    for (const f of this.app.vault.getMarkdownFiles()) {
      // 하위 폴더만 다시 넣었는데 위 폴더가 아직 빠져 있으면 그대로 둔다
      if (!inFolders(f.path, want) || this.isExcludedPath(f.path)) continue;
      try {
        this.usage.observe(f.path, measure(await this.app.vault.cachedRead(f)), new Date(), { mtime: f.stat.mtime, baseline: true });
      } catch {
        // 못 읽으면 다음 기회에
      }
    }
    this.saveSoon();
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
        // 기록이 없는데 지난번 저장 전부터 그대로인 노트 = 뺀 폴더에서 옮겨 왔거나 밖에서 들어온 노트. 기준만 잡는다
        const moved = seen === null && !U.known(f.path) && this.prevSeen && f.stat.mtime <= this.prevSeen;
        try {
          const m = measure(await vault.cachedRead(f));
          if (moved) U.observe(f.path, m, new Date(), { mtime: f.stat.mtime, baseline: true });
          else U.observe(f.path, m, new Date(f.stat.mtime), { mtime: f.stat.mtime, cap: LIVE_CHAR_CAP, linkCap: LIVE_LINK_CAP, budget, offline: true });
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
    const now = Date.now();
    let hold = 0;
    for (const path of paths) {
      // 이 기기에서 쓰지 않은 변화는 조금 기다린다 (다른 기기의 data.json 이 따라오면 그쪽 노트 기록으로 걸러진다)
      const wait = this.foreignWait(path, now);
      if (wait > 0) {
        this.pending.add(path);
        hold = hold ? Math.min(hold, wait) : wait;
        continue;
      }
      const f = this.app.vault.getAbstractFileByPath(path);
      if (!(f instanceof TFile)) continue;
      let text;
      try {
        text = await this.app.vault.cachedRead(f);
      } catch {
        continue;
      }
      const paste = this.pasted.get(path);
      if (paste && Date.now() - paste.at > PASTE_KEEP) this.pasted.delete(path);
      const skip = this.pasted.get(path);
      const r = this.usage.observe(path, measure(text), new Date(), { mtime: f.stat.mtime, cap: LIVE_CHAR_CAP, linkCap: LIVE_LINK_CAP, budget, skip });
      if (skip) {
        // 붙여 넣은 글이 아직 파일에 다 안 들어왔을 수 있다. 남은 몫은 조금 더 들고 있는다
        skip.c -= r.skipped.c;
        skip.l -= r.skipped.l;
        skip.w = (skip.w || 0) - (r.skipped.w || 0);
        if (skip.c <= 0 && skip.l <= 0) this.pasted.delete(path);
      }
      sum.dc += r.dc;
      sum.dl += r.dl;
      sum.dn += r.dn;
      sum.feat += Object.keys(r.feat || {}).length;
      if (path === this.emptyNote && f.stat.size) {
        this.emptyNote = null;
        this.host.brain.answered();
      }
    }
    if (hold) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = window.setTimeout(() => this.flush(), hold + 50);
    }
    this.saveSoon();
    if (!sum.dc && !sum.dl && !sum.dn && !sum.feat) return;
    this.host.onUsage();
  }

  // 이 기기에서 쓰지 않은 노트 변화면 더 기다릴 시간(ms), 이 기기에서 썼거나 다 기다렸으면 0
  foreignWait(path, now = Date.now()) {
    if (now - (this.typed.get(path) || 0) < LOCAL_EDIT) {
      this.foreign.delete(path);
      return 0;
    }
    if (!this.foreign.has(path)) this.foreign.set(path, now);
    const left = FOREIGN_WAIT - (now - this.foreign.get(path));
    if (left > 0) return left;
    this.foreign.delete(path);
    return 0;
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
      // generating 은 이제 읽기 전용(세션별 gen) — 대입하면 strict 모드에서 던지고 고양이가 계속 타이핑한다 (이슈 #4)
      brain.clearSession('obsidian');
      brain.tick();
    }
  }

  onOpen(f) {
    const brain = this.host.brain;
    brain.activity(Date.now());
    if (f.extension === 'md') this.lastNote = f.path;
    this.homeSoon();
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

  // 맨 윗단 폴더마다 그 아래 하위 폴더들, 위에서부터 차례로 (설정에서 하위 폴더만 뺄 수 있게, 1.6.0).
  // { 맨 윗단 해시: [{ id: 경로 해시, name, depth }] }. 폴더가 아주 많은 볼트를 위해 SUB_MAX 개까지만
  subFolders() {
    const out = {};
    let n = 0;
    const kids = (folder) => folder.children.filter((x) => x instanceof TFolder && !x.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name));
    const walk = (folder, list, depth) => {
      for (const x of kids(folder)) {
        if (n >= SUB_MAX) return;
        n++;
        list.push({ id: pathKey(x.path), name: x.name, depth });
        walk(x, list, depth + 1);
      }
    };
    for (const top of kids(this.app.vault.getRoot())) {
      const list = [];
      walk(top, list, 0);
      if (list.length) out[folderKey(top.name)] = list;
    }
    return out;
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

  /* ── 홈 (2.0.0): 노트 지도 · 최근 노트 · 외톨이 노트. 읽고 열기만 한다 ── */

  // 노트 지도의 가운데: 지금 연 노트, 없으면 마지막으로 연 노트, 그것도 없으면(막 켰을 때) 옵시디언이 기억하는 최근 노트
  graphCenter() {
    const { workspace, vault } = this.app;
    const f = workspace.getActiveFile && workspace.getActiveFile();
    if (f && f.extension === 'md') return f.path;
    if (this.lastNote && vault.getAbstractFileByPath(this.lastNote)) return this.lastNote;
    const recent = typeof workspace.getLastOpenFiles === 'function' ? workspace.getLastOpenFiles() : [];
    return recent.find((p) => p.endsWith('.md') && vault.getAbstractFileByPath(p) && !this.isExcludedPath(p)) || null;
  }

  homeData() {
    const ex = (p) => this.isExcludedPath(p);
    const orphans = this.orphanList();
    return {
      graph: vaultmap.localGraph(this.app, this.graphCenter(), ex),
      recent: vaultmap.recentNotes(this.app, ex),
      orphans: vaultmap.orphanSummary(this.app, orphans),
      editedToday: vaultmap.editedToday(this.app, ex),
      notes: this.app.vault.getMarkdownFiles().length,
      links: this.linkStats().total,
    };
  }

  // 노트를 열거나 링크가 바뀌면 열린 홈을 조금 뒤에 한 번 다시 그린다
  homeSoon() {
    if (!this.host || !this.host.houses.size) return;
    window.clearTimeout(this.homeTimer);
    this.homeTimer = window.setTimeout(() => this.host.pushHouse(), HOME_PUSH_WAIT);
  }

  // 이미 있는 노트만 연다 (없는 경로를 openLinkText 로 열면 새 노트가 생기니 쓰지 않는다).
  // 하우스 탭을 덮지 않게 편집기 탭에서 연다: 그 노트가 열린 탭 → 아무 편집기 탭 → 새 탭
  async openNote(path) {
    const f = typeof path === 'string' && this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) return false;
    const { workspace } = this.app;
    const editors = typeof workspace.getLeavesOfType === 'function' ? workspace.getLeavesOfType('markdown') : [];
    const leaf = editors.find((l) => l.view && l.view.file && l.view.file.path === f.path) || editors[0] || workspace.getLeaf('tab');
    if (!(leaf.view && leaf.view.file && leaf.view.file.path === f.path)) await leaf.openFile(f);
    if (typeof workspace.setActiveLeaf === 'function') workspace.setActiveLeaf(leaf, { focus: true });
    return true;
  }

  // 옵시디언 그래프 뷰 · 로컬 그래프 열기 (코어 그래프 플러그인의 명령. 꺼져 있으면 false)
  async openGraph(local) {
    const id = local ? 'graph:open-local' : 'graph:open';
    const cmds = this.app.commands;
    if (!cmds || !cmds.commands || !cmds.commands[id]) return false;
    // 로컬 그래프는 지금 노트가 있어야 열린다. 하우스가 앞에 있으면 노트 지도의 가운데 노트를 먼저 앞으로
    if (local && !(this.app.workspace.getActiveFile && this.app.workspace.getActiveFile())) {
      const center = this.graphCenter();
      if (!center || !(await this.openNote(center))) return false;
    }
    return cmds.executeCommandById(id);
  }

  // 외톨이 노트 (링크가 바뀐 뒤에만 다시 센다)
  orphanList() {
    if (!this._orphans || this.linksDirty) {
      this._orphans = vaultmap.orphanNotes(this.app, (p) => this.isExcludedPath(p));
      this.linksDirty = false;
    }
    return this._orphans;
  }

  // 1분마다: 외톨이였던 노트가 링크를 얻었으면 '외톨이 노트 이어 주기'. 한 노트는 한 번만 센다 (state.orphanFixed 에 경로 해시)
  orphanTick() {
    if (!this.host || this.host.loading) return;
    const before = this._orphanSeen;
    const now = new Set(this.orphanList());
    this._orphanSeen = now;
    if (!before) return;
    const fixed = new Set(this.state.get('orphanFixed') || []);
    let n = 0;
    for (const p of before) {
      if (now.has(p) || !this.app.vault.getAbstractFileByPath(p)) continue;
      const k = pathKey(p);
      if (fixed.has(k)) continue;
      fixed.add(k);
      n++;
    }
    if (!n) return;
    this.state.set({ orphanFixed: [...fixed].slice(-ORPHAN_FIXED_KEEP) });
    this.host.noteSkill('orphanFix', n);
  }

  // 노트 이름 바꾸기 · 다른 폴더로 옮기기 (뺀 폴더 · 숨김 폴더는 안 센다). 폴더째 옮기면 한 번
  noteRename(f, old) {
    if (!this.host || this.host.loading || this.isExcludedPath(f.path)) return;
    if (f instanceof TFile && !['md', 'canvas'].includes(f.extension)) return;
    const dir = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
    this.host.noteSkill(dir(old) !== dir(f.path) ? 'move' : 'retitle');
  }

  // 옵시디언 화면을 열어 봤다 (VIEWS 에 있는 것만. 같은 화면을 다시 누른 건 안 센다)
  noteView(leaf) {
    const type = leaf && leaf.view && typeof leaf.view.getViewType === 'function' ? leaf.view.getViewType() : null;
    if (!type || type === this._lastView) return;
    this._lastView = type;
    if (this.host && !this.host.loading && VIEWS.includes(type)) this.host.noteSkill('view_' + type);
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
      const file = `vault-pet-${String(name).replace(/[\\/:*?"<>|#^[\]]/g, '') || 'cat'}.png`;
      const active = this.app.workspace.getActiveFile();
      const path = await this.app.fileManager.getAvailablePathForAttachment(file, active ? active.path : '');
      await this.app.vault.createBinary(path, buf.buffer);
      new Notice(this.host.T.t('obs.cardSaved', { path }));
      return true;
    } catch (e) {
      console.error('[Vault Pet] card', e);
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
      console.error('[Vault Pet] copy', e);
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
  // mono: 색을 빼고 글자색(currentColor)으로 — 리본처럼 옵시디언 기본 아이콘들 사이에 놓이는 곳
  pixelIcon(name, mono = false) {
    if (!PixelArt.has(name)) return null;
    const id = 'kitcommit-' + name + (mono ? '-mono' : '');
    if (!this.icons.has(id)) {
      // 한 색 아이콘은 옵시디언 기본 아이콘(가장자리 여백이 있다)과 크기가 맞게 조금 작게
      let svg = PixelArt.svg(name, mono ? 84 : 100);
      if (mono) svg = svg.replace(/fill="#[0-9a-fA-F]+"/g, 'fill="currentColor"');
      const w = Number((svg.match(/width="(\d+)"/) || [])[1]) || 100;
      const h = Number((svg.match(/height="(\d+)"/) || [])[1]) || 100;
      addIcon(id, svg.replace(/^<svg class="[^"]*"/, `<svg x="${(100 - w) / 2}" y="${(100 - h) / 2}" style="stroke:none"`));
      this.icons.add(id);
    }
    return id;
  }

  // 상태 표시줄: 발바닥 · 이름 · 레벨 + 오늘의 목표 막대 (데스크톱판의 트레이 아이콘 자리). 누르면 트레이 메뉴.
  // 집중하는 동안은 목표 자리에 모래시계와 남은 시간
  updateStatus() {
    const el = this.statusEl;
    if (!el || !this.host) return;
    const H = this.host;
    const g = H.growth;
    const name = this.settings.get('petName');
    const text = g ? `${name} Lv.${g.level}` : name;
    const focus = H.goals ? H.goals.focusInfo() : { on: false };
    const goal = H.goals && !H.loading ? H.goals.progress() : null;
    const goalText = goal && goal.on ? `${goal.value.toLocaleString()}/${goal.target.toLocaleString()}` : '';
    const right = focus.on ? 'f' + H.focusLeftText(focus.left) : goal && goal.on ? `g${goalText}|${Math.round(goal.pct * 100)}|${goal.done}` : '';
    const key = `${text}|${H.isQuiet()}|${H.petVisible()}|${right}`;
    if (this._status === key) return;
    this._status = key;
    el.empty();
    const pix = (name, size) => {
      const svg = new DOMParser().parseFromString(PixelArt.svg(name, size).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '), 'image/svg+xml').documentElement;
      return document.importNode(svg, true);
    };
    el.createSpan({ cls: 'kitcommit-status-icon' }).appendChild(pix(H.isQuiet() && !focus.on ? 'bellOff' : 'paw', 14));
    el.createSpan({ text });
    if (focus.on) {
      const f = el.createSpan({ cls: 'vaultpet-status-focus' });
      f.createSpan({ cls: 'kitcommit-status-icon' }).appendChild(pix('hourglass', 12));
      f.createSpan({ text: H.focusLeftText(focus.left) });
    } else if (goal && goal.on) {
      const box = el.createSpan({ cls: 'vaultpet-status-goal' + (goal.done ? ' is-done' : '') });
      if (goal.done) box.createSpan({ cls: 'kitcommit-status-icon' }).appendChild(pix('check', 12));
      else box.createSpan({ cls: 'vaultpet-status-bar' }).createSpan().style.setProperty('--vaultpet-goal', `${Math.round(goal.pct * 100)}%`);
      box.createSpan({ text: goalText });
    }
    el.setAttribute('aria-label', `${H.goalLine()}\n${H.T.t('obs.statusTip')}`);
  }

  // 언어가 바뀌면 탭 이름·리본 설명을 다시
  relabel() {
    this._status = null;
    this.updateStatus();
    if (this.ribbon) this.ribbon.setAttribute('aria-label', this.host.T.t('obs.openHouse'));
    for (const v of this.houseViews()) if (v.leaf && typeof v.leaf.updateHeader === 'function') v.leaf.updateHeader();
  }

  /* ── 여러 기기 (1.5.1, plugin/sync.js) ── */

  // 이 기기 이름 (볼트마다). 동기화되지 않는 이 기기의 localStorage 에 둔다
  deviceId() {
    const KEY = 'vault-pet-device';
    const app = this.app;
    const local = `${KEY}-${app.appId || ''}`;
    let id = null;
    try {
      id = typeof app.loadLocalStorage === 'function' ? app.loadLocalStorage(KEY) : window.localStorage.getItem(local);
    } catch {
      id = null;
    }
    if (typeof id === 'string' && id) return id;
    id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      if (typeof app.saveLocalStorage === 'function') app.saveLocalStorage(KEY, id);
      else window.localStorage.setItem(local, id);
    } catch {
      // 못 남기면 켤 때마다 새 기기로 본다 (합치기가 조금 덜 정확할 뿐)
    }
    return id;
  }

  // 다른 기기(옵시디언 Sync · iCloud …)가 data.json 을 바꿨다. 다시 읽어 지금 것과 합친다
  async onExternalSettingsChange() {
    if (!this.sync || !this.host) return;
    if (!this.started || this.host.loading || this.merging) {
      this.mergeLater = true;
      return;
    }
    this.merging = true;
    try {
      // 내가 방금 쓴 그대로면 볼 것 없다
      const stamp = await this.statData();
      if (stamp && stamp === this.diskStamp) return;
      const { raw } = await readJson(this.app.vault.adapter, `${this.manifest.dir}/data.json`);
      // 깨졌거나 아직 다 안 써졌으면 다음 소식을 기다린다 (지금 것은 그대로, 다음 저장이 덮는다)
      if (!raw || !raw.settings || !raw.state) return;
      this.diskStamp = stamp;
      const local = this.snapshot();
      const r = this.sync.incoming(local, raw);
      // 상대가 어느 판까지 봤는지는 바뀐 게 없어도 적어 둔다 (다음 합치기의 공통 조상)
      this.meta.sync = r.merged.meta.sync;
      if (!r.changed) return;
      this.keepPremerge(local);
      this.applyData(r.merged);
      this.host.reloadShared();
      this.saveSoon();
    } catch (e) {
      console.error('[Vault Pet] sync', e);
    } finally {
      this.merging = false;
      if (this.mergeLater && this.started && !this.host.loading) {
        this.mergeLater = false;
        window.setTimeout(() => this.onExternalSettingsChange(), 0);
      }
    }
  }

  // data.json 의 '수정 시각|크기'. 못 읽으면 null
  async statData() {
    try {
      const st = await this.app.vault.adapter.stat(`${this.manifest.dir}/data.json`);
      return st ? `${st.mtime}|${st.size}` : null;
    } catch {
      return null;
    }
  }

  // 지금 메모리의 자료 (합치기 재료). 밥 게이지는 따로 들고 있어서 먼저 적어 둔다
  snapshot() {
    if (this.host && this.host.gauge) this.host.gauge.save();
    return structuredClone({ version: DATA_VERSION, settings: this.settings.data, state: this.state.data, usage: this.usage.data, meta: this.meta });
  }

  // 합친 자료를 메모리에 넣는다. core 모듈들이 같은 객체를 들고 있어서 갈아 끼우지 않고 안을 바꾼다
  applyData(m) {
    const put = (target, src) => {
      for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
      Object.assign(target, src);
    };
    put(this.settings.data, m.settings || {});
    put(this.state.data, m.state || {});
    put(this.usage.data, m.usage || {});
    this.meta.sync = m.meta.sync;
  }

  // 합치기 전 이 기기 자료를 data.premerge.json 으로 남긴다 (10분에 한 번까지). 합치기가 잘못돼도 되돌릴 수 있게
  keepPremerge(local) {
    const now = Date.now();
    if (now - (this.premergeAt || 0) < PREMERGE_EVERY) return;
    this.premergeAt = now;
    this.app.vault.adapter.write(`${this.manifest.dir}/data.premerge.json`, JSON.stringify(local)).catch((e) => console.error('[Vault Pet] premerge', e));
  }

  /* ── 저장 ── */

  // 하루에 한 번, 방금 잘 읽힌 data.json 을 data.backup.json 으로 남긴다
  backup() {
    const raw = this.loadedRaw;
    this.loadedRaw = null;
    const d = new Date();
    const today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    backupDaily(this.app.vault.adapter, this.manifest.dir, raw, this.meta.backupDay, today)
      .then((done) => {
        if (!done) return;
        this.meta.backupDay = today;
        this.saveSoon();
      })
      .catch((e) => console.error('[Vault Pet] backup', e));
  }

  openFeedback() {
    window.open(FEEDBACK_URL);
  }

  saveSoon() {
    this.dirty = true;
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), 1500);
  }

  async saveNow() {
    window.clearTimeout(this.saveTimer);
    if (!this.settings) return;
    // 다른 기기가 쓴 data.json 을 아직 못 합쳤으면 덮어쓰지 않는다. 먼저 합치고, 합칠 수 없는 때(켜는 중)면 뒤로 미룬다
    if (this.sync && !this.unloading && (this.merging || this.mergeLater || (await this.diskChanged()))) {
      if (!this.started || !this.host || this.host.loading || this.merging) return this.saveSoon();
      await this.onExternalSettingsChange();
    }
    this.dirty = false;
    this.meta.lastSeen = Date.now();
    const data = { version: DATA_VERSION, settings: this.settings.data, state: this.state.data, usage: this.usage.data, meta: this.meta };
    // 공유하는 칸이 바뀌었으면 새 판 번호 (plugin/sync.js)
    if (this.sync) this.meta = this.sync.stamp(data).meta;
    try {
      await this.saveData(data);
      this.diskStamp = await this.statData();
    } catch (e) {
      console.error('[Vault Pet] save', e);
    }
  }

  // 마지막으로 읽거나 쓴 뒤 data.json 이 밖에서 바뀌었나
  async diskChanged() {
    const s = await this.statData();
    return !!s && s !== this.diskStamp;
  }
}

module.exports = KitCommitPlugin;
module.exports.default = KitCommitPlugin;
