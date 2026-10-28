'use strict';
/*
 * 옵시디언 없이 로직을 검사한다.   node tests/run.js
 *  - core/usage: 글자·링크 세기, 최고 기록(농사 방지), 세션, 폴더
 *  - 성장·코인 공식
 *  - plugin/host: 데스크톱판 main.js 의 IPC 흐름(설정·상점·밥·놀이·퀘스트)이 옵시디언판에서도 도는지
 *  - i18n: 새 업적·퀘스트·옵시디언판 글이 다 있는지
 */
const Module = require('module');
const path = require('path');
const assert = require('assert');

// require('obsidian') 는 가짜를 돌려준다
class FakeMenu {
  constructor() {
    this.items = [];
  }
  addItem(fn) {
    const mi = { title: '', setTitle(t) { this.title = t; return this; }, setIcon() { return this; }, setDisabled(v) { this.disabled = v; return this; }, onClick(f) { this.click = f; return this; }, setSubmenu() { this.sub = new FakeMenu(); return this.sub; } };
    fn(mi);
    this.items.push(mi);
    return this;
  }
  addSeparator() {
    return this;
  }
  showAtPosition() {}
  showAtMouseEvent() {}
}
const fakeObsidian = { Menu: FakeMenu, Notice: class {}, setIcon() {}, Plugin: class {}, ItemView: class {}, Modal: class {}, PluginSettingTab: class {}, Setting: class {}, TFile: class {}, TFolder: class {}, addIcon() {} };
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'obsidian') return fakeObsidian;
  if (request.endsWith('kit-assets')) return { petCss: '', houseCss: '', frameCss: '', petBody: '', houseBody: '', commonScript: '', petScript: '', houseScript: '' };
  return origLoad.call(this, request, parent, isMain);
};

const src = path.join(__dirname, '..', 'src');
const { UsageTracker, measure, SESSION_GAP } = require(path.join(src, 'core/usage'));
const growth = require(path.join(src, 'core/growth'));
const { coinsForDay } = require(path.join(src, 'core/shop'));
const { ACHIEVEMENTS, CATS } = require(path.join(src, 'core/achievements'));
const { Store, DEFAULT_SETTINGS } = require(path.join(src, 'plugin/store'));
const { KitHost, STATE_DEFAULTS } = require(path.join(src, 'plugin/host'));
const I18N = require(path.join(src, 'kit/i18n'));
globalThis.I18N = I18N;
require(path.join(src, 'kit/i18n-obsidian'));
require(path.join(src, 'kit/i18n-goals'));
require(path.join(src, 'kit/i18n-v2'));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* ── 세기 ── */

test('measure: 글자·링크·옵시디언 기능을 센다', () => {
  const m = measure('---\ntags: [x]\n---\n# 제목\n\n안녕 [[노트]] #태그 ![[그림.png]]\n- [ ] 할 일\n- [x] 끝\n> [!note] 콜아웃\n```js\nconst a = "[[가짜]]";\n```');
  assert.strictEqual(m.links, 2);
  assert.strictEqual(m.tag, 1);
  assert.strictEqual(m.task, 2);
  assert.strictEqual(m.done, 1);
  assert.strictEqual(m.head, 1);
  assert.strictEqual(m.embed, 1);
  assert.strictEqual(m.callout, 1);
  assert.ok(m.chars > 10);
  assert.deepStrictEqual(measure(''), { chars: 0, words: 0, links: 0, tag: 0, task: 0, done: 0, head: 0, embed: 0, callout: 0, prop: 0 });
  assert.strictEqual(m.prop, 1, '앞머리 속성 tags (2.0.0)');
});

test('usage: 처음 본 노트는 기준만 잡고, 늘어난 만큼만 센다 (지웠다 다시 쓰기는 0)', () => {
  const u = new UsageTracker();
  u.observe('a/노트.md', measure('가나다라마바사'), new Date(), { baseline: true });
  assert.strictEqual(u.totals().c, 0);
  u.observe('a/노트.md', measure('가나다라마바사아자차'), new Date());
  assert.strictEqual(u.totals().c, 3);
  u.observe('a/노트.md', measure('가나'), new Date());
  u.observe('a/노트.md', measure('가나다라마바사아자차'), new Date());
  assert.strictEqual(u.totals().c, 3, '되돌리기·다시 쓰기는 안 센다');
});

test('usage: 새 노트는 10자 넘으면 한 번만, 붙여넣기는 상한까지만', () => {
  const u = new UsageTracker();
  u.observe('n.md', measure('짧다'), new Date(), { cap: 3000 });
  assert.strictEqual(u.totals().n, 0);
  u.observe('n.md', measure('가'.repeat(5000)), new Date(), { cap: 3000 });
  assert.strictEqual(u.totals().n, 1);
  assert.strictEqual(u.totals().c, 2 + 3000, '짧은 두 글자 + 붙여넣기 상한 3,000');
  u.observe('n.md', measure('가'.repeat(5100)), new Date(), { cap: 3000 });
  assert.strictEqual(u.totals().n, 1);
});

test('usage: 30분 넘게 쉬면 글쓰기 세션이 하나 늘고 알린다', () => {
  const u = new UsageTracker();
  let sessions = 0;
  u.on('session', () => sessions++);
  const t0 = new Date(2026, 8, 26, 10, 0);
  u.observe('s.md', measure('가'.repeat(20)), t0);
  u.observe('s.md', measure('가'.repeat(40)), new Date(t0.getTime() + 5 * 60_000));
  u.observe('s.md', measure('가'.repeat(60)), new Date(t0.getTime() + 5 * 60_000 + SESSION_GAP + 1000));
  assert.strictEqual(sessions, 2);
  assert.strictEqual(u.totals().s, 2);
  // 옵시디언이 꺼져 있던 동안 바뀐 건 세션이 아니다
  u.observe('s.md', measure('가'.repeat(80)), new Date(t0.getTime() + 10 * 3600_000), { offline: true });
  assert.strictEqual(u.totals().s, 2);
});

test('usage: 폴더별로 모이고, 뺀 폴더는 합계에서 빠진다. 경로는 해시로만 남는다', () => {
  const u = new UsageTracker();
  u.observe('일기/오늘.md', measure('가'.repeat(30)), new Date());
  u.observe('업무/회의.md', measure('나'.repeat(50)), new Date());
  u.observe('맨위.md', measure('다'.repeat(20)), new Date());
  const list = u.projects(['일기', '업무']);
  assert.strictEqual(list.length, 3);
  assert.ok(list.find((p) => p.label === '일기').chars === 30);
  assert.ok(list.find((p) => p.root).chars === 20);
  u.setExcluded([list.find((p) => p.label === '업무').id]);
  assert.strictEqual(u.totals().c, 50);
  const raw = JSON.stringify(u.data);
  assert.ok(!raw.includes('일기') && !raw.includes('회의'), '폴더·노트 이름이 저장되면 안 된다');
});

test('usage: 이름 바꾸기·지우기가 최고 기록을 따라간다', () => {
  const u = new UsageTracker();
  u.observe('a/x.md', measure('가'.repeat(30)), new Date());
  u.rename('a', 'b');
  u.observe('b/x.md', measure('가'.repeat(30)), new Date());
  assert.strictEqual(u.totals().c, 30, '옮긴 뒤에도 같은 글은 다시 안 센다');
  u.removeUnder('b');
  assert.strictEqual(u.has('b/x.md'), false);
});

/* ── 성장·코인 ── */

test('growth: 글자 ÷ 10 + 링크 × 10 + 새 노트 × 20 + 세션 × 30', () => {
  assert.strictEqual(growth.xpOf({ c: 1234, l: 3, n: 2, s: 1 }), 123 + 30 + 40 + 30);
  assert.strictEqual(growth.levelOf(0), 1);
  assert.strictEqual(growth.levelOf(25), 2);
});

test('coins: 하루 5,000자까지 5자 = 1코인, 그 뒤로 25자 = 1코인', () => {
  assert.strictEqual(coinsForDay(0), 0);
  assert.strictEqual(coinsForDay(5000), 1000);
  assert.strictEqual(coinsForDay(5250), 1010);
});

/* ── 업적·글 ── */

test('achievements: 아이디가 겹치지 않고, 이름·설명·묶음 이름이 두 언어 다 있다', () => {
  const ids = new Set();
  for (const a of ACHIEVEMENTS) {
    assert.ok(!ids.has(a.id), 'dup ' + a.id);
    ids.add(a.id);
    for (const lang of I18N.LANGS) {
      assert.ok(I18N.UI[lang][`ach.${a.id}.name`], `${lang} ach.${a.id}.name`);
      assert.ok(I18N.UI[lang][`ach.${a.id}.desc`], `${lang} ach.${a.id}.desc`);
    }
  }
  for (const c of CATS) for (const lang of I18N.LANGS) assert.ok(I18N.UI[lang]['ach.cat.' + c], `${lang} ach.cat.${c}`);
});

test('i18n: 퀘스트·홈·설정 글에 Claude·토큰 이야기가 안 남았다', () => {
  const keys = ['quest.chars', 'quest.links', 'quest.notes', 'quest.tags', 'quest.daily', 'quest.orphans', 'home.todayChars', 'shop.sub', 'shop.rate', 'dash.sub', 'mood.thinking', 'mood.waiting', 'slot.workSub', 'slot.doneSub', 'set.projectsSub', 'w.body1', 'w.privacy', 'card.headline', 'card.shareText', 'tray.today'];
  for (const lang of I18N.LANGS) {
    for (const k of keys) {
      const v = I18N.UI[lang][k];
      assert.ok(v, `${lang} ${k}`);
      assert.ok(!/claude|토큰|token/i.test(v.replace(/\{\w+\}/g, '')), `${lang} ${k}: ${v}`);
    }
    for (const kind of ['session', 'stop', 'stopLong', 'notifyIdle', 'notifyAgain', 'tip', 'chatter']) {
      for (const s of I18N.LINE[lang][kind].angel) assert.ok(!/claude|토큰|token|커밋/i.test(s), `${lang} ${kind}: ${s}`);
    }
  }
});

/* ── 호스트 (데스크톱판 main.js 흐름) ── */

function makeHost(pre = {}) {
  const saves = [];
  const settings = new Store(pre.settings || {}, DEFAULT_SETTINGS, () => saves.push(1));
  const state = new Store(pre.state || {}, STATE_DEFAULTS, () => saves.push(1));
  const usage = new UsageTracker();
  const sent = [];
  const plugin = {
    linkStats: () => ({ max: 3, total: 10 }),
    idleSeconds: () => 0,
    topFolders: () => ['일기'],
    vaultNumbers: () => ({ notes: 5, chars: 1234, links: 10 }),
    baselineTotals: () => ({ c: 50000, l: 100, n: 30, s: 0 }),
    updateStatus() {},
    relabel() {},
    openHouse(tab) {
      sent.push(['openHouse', tab]);
    },
    pixelIcon: () => null,
    mountStage() {},
    unmountStage() {},
  };
  const host = new KitHost(plugin, { settings, state, usage });
  host.init();
  const pet = { emit: (ch, p) => sent.push([ch, p]) };
  host.attachPet(pet);
  host.stage = { setInteractive() {}, visible: () => true, setHidden() {}, lastMouse: () => ({ x: 1, y: 1 }) };
  host.ready();
  return { host, settings, state, usage, sent, plugin };
}

test('host: 켜지면 성장·퀘스트가 잡히고 house:get 이 하우스에 필요한 걸 다 준다', async () => {
  const { host } = makeHost();
  const d = await host.onInvoke('house:get');
  for (const k of ['settings', 'growth', 'today', 'game', 'shop', 'stats', 'vault', 'motion', 'gauge', 'todos', 'home', 'skills', 'projects', 'formula']) assert.ok(d[k] !== undefined, k);
  // 2.0.0 에 없앤 것은 하우스에 안 간다
  for (const k of ['treasures', 'workshop', 'friends', 'craving', 'news', 'temper']) assert.strictEqual(d[k], undefined, k);
  assert.strictEqual(d.game.quests.length, 3);
  assert.ok(d.shop.wallet.balance >= 1000, '환영 용돈');
  assert.strictEqual(d.pastLevel, growth.levelOf(growth.xpOf({ c: 50000, l: 100, n: 30, s: 0 })));
  assert.ok(JSON.stringify(d).length > 1000);
});

test('host: 글을 쓰면 XP·코인이 오르고 레벨 업 말풍선이 나간다', () => {
  const { host, usage, sent } = makeHost();
  const before = host.growth.xp;
  usage.observe('일기/a.md', measure('가'.repeat(2500)), new Date(), { cap: 3000 });
  host.onUsage();
  assert.ok(host.growth.xp > before);
  assert.ok(host.shop.wallet().balance >= 1000 + 500);
  assert.ok(sent.some(([ch]) => ch === 'pet:bubble'));
});

test('host: 상점에서 사고 입고, 밥을 사서 먹인다', async () => {
  const { host, settings, sent } = makeHost();
  let r = await host.onInvoke('shop:buy', null, 'sprout');
  assert.ok(r.ok, r.reason);
  const p = await host.onInvoke('house:set', null, { outfit: { head: 'sprout' } });
  assert.strictEqual(p.settings.outfit.head, 'sprout');
  assert.ok(settings.get('accessory').includes('sprout'));
  r = await host.onInvoke('pet:feed');
  assert.strictEqual(r.ok, false, '밥이 없으면 못 준다');
  const meal = host.shop.summary().food.find((x) => x.group === 'meal' && !x.locked);
  await host.onInvoke('shop:buy', null, meal.key);
  r = await host.onInvoke('pet:feed');
  assert.ok(r.ok);
  assert.ok(sent.some(([ch, x]) => ch === 'pet:treat' && x.key === meal.key));
  host.onSend('pet:treat-eaten', null, meal.key);
  assert.ok(host.gamify.st.cnt.fed >= 1);
});

test('host: 프리미엄 음식 — 고정·코인·업적 횟수, 먹이에 쓴 코인', async () => {
  const { host } = makeHost();
  host.shop.state.set({ walletBonus: 100000 });
  for (const key of ['royalTable', 'goldMouseChoco', 'mysteryBox']) assert.ok((await host.onInvoke('shop:buy', null, key)).ok, key);
  assert.ok(host.gamify.st.cnt.foodSpent > 0);
  // 꺼내 준(바닥에 떨군) 먹이만 먹은 걸로 친다
  host.onSend('pet:treat-eaten', null, 'royalTable');
  assert.ok(!host.gauge.locked(), '안 꺼낸 먹이는 못 먹는다');
  for (const key of ['royalTable', 'goldMouseChoco', 'mysteryBox']) assert.ok((await host.onInvoke('shop:use', null, key)).ok, key);
  host.onSend('pet:treat-eaten', null, 'royalTable');
  assert.ok(host.gauge.locked(), '수라상은 배부름 8시간 고정');
  // 2.0.0: 황금 쥐 초콜릿은 보물 대신 코인 40~120
  const before = host.shop.wallet().balance;
  host.onSend('pet:treat-eaten', null, 'goldMouseChoco');
  const got = host.shop.wallet().balance - before;
  assert.ok(got >= 40 && got <= 120, String(got));
  host.onSend('pet:treat-eaten', null, 'mysteryBox');
  assert.strictEqual(host.gamify.st.cnt.premium, 3);
  assert.strictEqual(host.gamify.st.cnt.pf_royalTable, 1);
});

test('host: 배고파도 놀고, 한참 쓰다 쉬는 틈에 권한 장난감을 누르면 「기다림의 달인」 횟수가 오른다', async () => {
  const { host, sent, plugin } = makeHost();
  const toy = host.shop.summary().toy.find((x) => !x.locked);
  host.shop.state.set({ walletBonus: 100000 });
  assert.ok((await host.onInvoke('shop:buy', null, toy.key)).ok);
  host.gauge.g.food = 0;
  assert.ok((await host.onInvoke('house:play', null, toy.key)).on, '배고파도 논다 (기운 · 놀이 거부는 없어졌다)');
  host.onSend('pet:caught');
  host.onSend('pet:caught');
  assert.ok(host.playing && !host.playing.ending);
  host.stopPlay();
  // 15분 쭉 쓰고 2분째 손을 놓았다
  host.brain.streakMs = () => 15 * 60e3;
  host.brain.mood = 'active';
  plugin.idleSeconds = () => 120;
  host.toyOfferTick();
  const ask = sent.filter(([ch, x]) => ch === 'pet:bubble' && x.kind === 'toyAsk').pop();
  assert.ok(ask && ask[1].link === 'play:' + toy.key, '장난감을 물고 와서 권한다');
  assert.ok((await host.onInvoke('house:play', null, toy.key)).on);
  assert.strictEqual(host.gamify.st.cnt.bored, 1);
  host.toyOfferTick();
  assert.strictEqual(sent.filter(([ch, x]) => ch === 'pet:bubble' && x.kind === 'toyAsk').length, 1, '노는 중 · 60분 안에는 또 안 권한다');
});

test('host: 쓰다듬기·들기·장난감 놀이 흐름', async () => {
  const { host, sent } = makeHost();
  host.onSend('pet:poke');
  assert.ok(host.gamify.st.pokes >= 1);
  host.onSend('pet:drag', null, 'start');
  host.onSend('pet:drag', null, 'end', { x: 321 });
  assert.deepStrictEqual(host.settings.get('position'), { x: 321, v: 3 });
  assert.strictEqual(host.petConfig().startX, 321);
  const toy = host.shop.summary().toy.find((x) => !x.locked);
  host.shop.state.set({ walletBonus: 100000 });
  assert.ok((await host.onInvoke('shop:buy', null, toy.key)).ok);
  const r = await host.onInvoke('house:play', null, toy.key);
  assert.ok(r.on);
  assert.ok(sent.some(([ch, x]) => ch === 'pet:play' && x.on));
  host.onSend('pet:caught');
  host.onSend('pet:play-stop');
  assert.strictEqual(host.playing, null);
});

test('host: 타이핑 hook 흉내 — 쓰는 동안 thinking, 빈 노트는 waiting', () => {
  const { host } = makeHost();
  const b = host.brain;
  b.hook({ name: 'UserPromptSubmit', at: Date.now(), sessionId: 'obsidian' });
  assert.strictEqual(b.mood, 'thinking');
  b.hook({ name: 'Stop', at: Date.now(), sessionId: 'obsidian' });
  assert.notStrictEqual(b.mood, 'thinking');
  b.hook({ name: 'Notification', at: Date.now(), sessionId: 'obsidian', notificationType: 'idle_prompt', message: '' });
  assert.strictEqual(b.mood, 'waiting');
  b.answered();
  b.tick();
  assert.notStrictEqual(b.mood, 'waiting');
});

test('plugin: 짧게 쓰고 손을 떼면 타이핑을 멈춘다 (이슈 #4)', () => {
  const KitCommitPlugin = require(path.join(src, 'plugin/main'));
  const { host } = makeHost();
  const b = host.brain;
  const now = Date.now();
  b.hook({ name: 'UserPromptSubmit', at: now - 25_000, sessionId: 'obsidian' });
  assert.strictEqual(b.mood, 'thinking');
  // 5초 쓰고 20초 쉼 → typeStop 의 짧은 쓰기 갈래 (Stop hook 없이 끝낸다)
  const self = { host, typing: true, typeStart: now - 25_000, lastType: now - 20_000 };
  KitCommitPlugin.prototype.typeStop.call(self);
  assert.strictEqual(self.typing, false);
  assert.strictEqual(b.gen.size, 0);
  assert.notStrictEqual(b.mood, 'thinking');
});

test('host: 트레이·우클릭 메뉴가 만들어진다', () => {
  const { host } = makeHost();
  const m = host.trayMenu();
  assert.ok(m.items.length >= 8);
  host.petContextMenu({ x: 5, y: 5 });
});

test('host: 뺀 폴더는 성장에서 빠진다', async () => {
  const { host, usage } = makeHost();
  usage.observe('일기/a.md', measure('가'.repeat(1000)), new Date());
  host.onUsage();
  const xp = host.growth.xp;
  const id = usage.projects(['일기']).find((p) => p.label === '일기').id;
  await host.onInvoke('house:set', null, { excludedProjects: [id] });
  assert.ok(host.growth.xp < xp);
});

/* ── Vault Pet 0.x 에서 넘어오기 ── */

const legacyMod = require(path.join(src, 'plugin/legacy'));
const DAY_MS = 86_400_000;
function oldData(now) {
  // 0.4.0 의 data.json 모양 (schema 4, 파트너 잉키 + 쉬는 친구 하나)
  return {
    schema: 4,
    settings: { language: 'en', soundEnabled: false, chatter: false, lunchTime: '12:10', excludedFolders: ['Templates', 'Journal/Private'], theme: 'system', showWidget: true },
    state: {
      partner: 'inky',
      party: { inky: { name: 'Mochi', frozen: 0, startXp: 0, base: { c: 1000, l: 10, n: 2 }, since: now - 5 * DAY_MS }, pip: { name: 'Pip', frozen: 1200, startXp: 0, base: null, since: 0 } },
      bonus: [{ at: now - 20 * DAY_MS, xp: 999, why: ['attend', 0] }, { at: now - 2 * DAY_MS, xp: 100, why: ['badge', 'x'] }],
      achievements: { first_note: now - 30 * DAY_MS },
    },
    ledger: { tot: { c: 21000, l: 110, n: 12 }, files: {}, days: {} },
  };
}

test('legacy: 0.x data.json 만 알아보고, 경험치·레벨·함께한 날·이름을 뽑는다', () => {
  const now = Date.UTC(2026, 8, 26);
  assert.ok(legacyMod.isLegacy(oldData(now)));
  assert.ok(legacyMod.isLegacy({ settings: {}, state: { pokes: 3 } })); // 0.1.x (schema 없음)
  assert.ok(!legacyMod.isLegacy({}));
  assert.ok(!legacyMod.isLegacy({ version: 1, settings: {}, state: {}, usage: {}, meta: {} }));
  const L = legacyMod.legacySummary(oldData(now), now);
  // 잉키: (20000/20) + 100×5 + 10×15 + 최근 보너스 100 = 1750, 쉬는 핍 1200
  assert.strictEqual(L.xp, 2950);
  assert.strictEqual(L.level, Math.floor(Math.sqrt(1750 / 25)) + 1);
  assert.strictEqual(L.days, 30);
  assert.strictEqual(L.petName, 'Mochi');
  assert.strictEqual(L.coins, 1980);
  assert.strictEqual(legacyMod.coinsFor(1e9), 30000);
  assert.strictEqual(legacyMod.coinsFor(0), 500);
});

test('usage: 하위 폴더만 뺄 수 있다 (1.6.0, 이슈 #5)', () => {
  const { inFolders, pathKey, folderKey, ROOT } = require(path.join(src, 'core/usage'));
  const ids = new Set([pathKey('Story/Planning')]);
  assert.ok(inFolders('Story/Planning/outline.md', ids));
  assert.ok(inFolders('Story/Planning/Old/a.md', ids), '더 아래 폴더도 빠진다');
  assert.ok(!inFolders('Story/Chapters/ch1.md', ids), '옆 폴더는 그대로 센다');
  assert.ok(!inFolders('Story/plan.md', ids), '위 폴더에 바로 있는 노트도 센다');
  assert.ok(!inFolders('Story/Planning.md', ids), '이름만 같은 노트는 폴더가 아니다');
  assert.ok(!inFolders('Planning/a.md', ids), '다른 맨 윗단 폴더의 같은 이름');
  // 예전 설정(맨 윗단 해시)과 볼트 맨 위도 그대로
  assert.strictEqual(folderKey('Story'), pathKey('Story'));
  assert.ok(inFolders('Story/Chapters/ch1.md', new Set([folderKey('Story')])));
  assert.ok(inFolders('a.md', new Set([ROOT])) && !inFolders('Story/a.md', new Set([ROOT])));
  assert.ok(!inFolders('Story/a.md', new Set()));
});

test('plugin: 뺀 하위 폴더의 노트는 읽지도 세지도 않고, 설정에는 하위 폴더가 차례로 보인다 (1.6.0, 이슈 #5)', () => {
  const KitCommitPlugin = require(path.join(src, 'plugin/main'));
  const { pathKey, folderKey } = require(path.join(src, 'core/usage'));
  const P = KitCommitPlugin.prototype;
  let ex = [pathKey('Story/Planning')];
  const self = { settings: { get: () => ex } };
  assert.ok(P.isExcludedPath.call(self, 'Story/Planning/outline.md'));
  assert.ok(!P.isExcludedPath.call(self, 'Story/Chapters/ch1.md'));
  assert.ok(P.isExcludedPath.call(self, '.trash/a.md'));
  ex = [folderKey('Story')]; // 설정이 바뀌면 바로 따른다
  assert.ok(P.isExcludedPath.call(self, 'Story/Chapters/ch1.md'));
  const dir = (name, p, children = []) => Object.assign(new fakeObsidian.TFolder(), { name, path: p, children });
  const root = dir('', '/', [dir('Story', 'Story', [dir('Planning', 'Story/Planning'), dir('Chapters', 'Story/Chapters', [dir('Part 1', 'Story/Chapters/Part 1')])]), dir('Inbox', 'Inbox'), dir('.obsidian', '.obsidian', [dir('x', '.obsidian/x')])]);
  const subs = P.subFolders.call({ app: { vault: { getRoot: () => root } } });
  assert.deepStrictEqual(Object.keys(subs), [folderKey('Story')], '하위 폴더 없는 폴더 · 숨김 폴더는 빠진다');
  assert.deepStrictEqual(subs[folderKey('Story')].map((f) => [f.name, f.depth]), [['Chapters', 0], ['Part 1', 1], ['Planning', 0]]);
  assert.strictEqual(subs[folderKey('Story')][1].id, pathKey('Story/Chapters/Part 1'));
});

test('host: 설정 화면에 하위 폴더 목록이 간다 (1.6.0)', () => {
  const { host } = makeHost();
  host.plugin.subFolders = () => ({ x: [{ id: 'x/y', name: 'Chapters', depth: 0 }] });
  assert.deepStrictEqual(host.housePayload().subfolders, { x: [{ id: 'x/y', name: 'Chapters', depth: 0 }] });
  for (const lang of I18N.LANGS) assert.ok(I18N.UI[lang]['set.subMore'].includes('{n}') && I18N.UI[lang]['set.subLess'], lang);
});

test('legacy: 뜻이 같은 설정만 옮기고, 뺀 폴더는 경로 해시로', () => {
  const s = legacyMod.legacySettings(oldData(Date.now()));
  assert.strictEqual(s.language, 'en');
  assert.strictEqual(s.soundEnabled, false);
  assert.strictEqual(s.lunchTime, '12:10');
  assert.ok(!('theme' in s) && !('showWidget' in s));
  const { pathKey } = require(path.join(src, 'core/usage'));
  const u = new UsageTracker();
  const ids = [...u.projects(['Templates']).map((p) => p.id), pathKey('Journal/Private')];
  assert.deepStrictEqual([...s.excludedProjects].sort(), [...ids].sort(), '하위 폴더(Journal/Private)는 그 폴더만 (1.6.0)');
  assert.ok(!('language' in legacyMod.legacySettings({ settings: { language: 'auto' }, state: {} })));
});

test('legacy: 기념 코스튬은 상점에서 못 사고, 받은 사람에게만 보인다', () => {
  const { host } = makeHost();
  const has = () => host.shop.summary().acc.some((x) => x.key === legacyMod.LEGACY_COSTUME);
  assert.ok(!has());
  assert.strictEqual(host.shop.blocker(legacyMod.LEGACY_COSTUME), 'exclusive');
  assert.ok(!host.shop.buy(legacyMod.LEGACY_COSTUME).ok);
  host.shop.give({ item: legacyMod.LEGACY_COSTUME });
  assert.ok(has());
  assert.strictEqual(host.shop.blocker(legacyMod.LEGACY_COSTUME), 'owned');
  for (const lang of I18N.LANGS) {
    assert.ok(I18N.UI[lang]['item.' + legacyMod.LEGACY_COSTUME], lang + ' item name');
    for (const k of ['title', 'thanks', 'body', 'coins', 'costume', 'note', 'ok', 'wear']) assert.ok(I18N.UI[lang]['legacy.' + k], `${lang} legacy.${k}`);
  }
});

test('host: 그날의 기분이 없다 — 쓰다듬으면 늘 고른 모션 (2.0.0, 이슈 #7)', () => {
  const { host, sent } = makeHost({ state: { temper: { day: new Date().toDateString(), key: 'grumpy', said: true } } });
  assert.strictEqual(host.temper, undefined);
  assert.strictEqual(host.petConfig().temper, undefined);
  assert.strictEqual(host.state.get('temper'), undefined, '옮길 때 지운다');
  sent.length = 0;
  host.poke();
  const acts = sent.filter(([ch]) => ch === 'pet:action').map(([, a]) => a);
  assert.ok(acts.length && !acts.includes('swat') && !acts.includes('perk'), acts.join());
});
test('stage: 떠 있는 작은 상태 표시줄 위가 아니라 작업 영역 맨 아래가 바닥이다', () => {
  const { PetStage } = require(path.join(src, 'plugin/stage'));
  const box = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
  const prev = globalThis.document;
  const run = (sb) => {
    globalThis.document = { querySelector: (q) => (q === '.workspace' ? { getBoundingClientRect: () => box(0, 0, 1024, 800) } : { offsetParent: {}, getBoundingClientRect: () => sb }) };
    return new PetStage({}, {}).rect().bottom;
  };
  try {
    assert.strictEqual(run(box(685, 771, 1024, 800)), 800); // 1.14 기본: 오른쪽 아래 알약
    assert.strictEqual(run(box(0, 771, 1024, 800)), 771);   // 가로로 꽉 찬 상태 표시줄 (테마)
  } finally {
    globalThis.document = prev;
  }
});

/* ── 저장 파일 ── */

const safe = require(path.join(src, 'plugin/safedata'));
const fakeAdapter = (files) => ({
  files,
  exists: async (f) => f in files,
  read: async (f) => files[f],
  write: async (f, text) => void (files[f] = text),
});

test('safedata: 멀쩡한 파일·처음 설치는 그대로 읽는다', async () => {
  const good = { settings: { petName: 'Mochi' }, state: {} };
  const a = fakeAdapter({ 'p/data.json': JSON.stringify(good) });
  assert.deepStrictEqual(await safe.loadSafe(a, 'p'), { raw: good, source: 'data' });
  assert.deepStrictEqual(await safe.loadSafe(fakeAdapter({}), 'p'), { raw: null, source: 'none' });
  assert.deepStrictEqual(Object.keys(a.files), ['p/data.json']);
});

test('safedata: 깨진 파일은 백업으로 되살리고, 깨진 원본을 남긴다', async () => {
  const good = { settings: { petName: 'Mochi' }, state: { coins: 5 } };
  for (const broken of ['', '   ', '{"settings":{"petN', 'null', '[1,2]']) {
    const a = fakeAdapter({ 'p/data.json': broken, 'p/data.backup.json': JSON.stringify(good) });
    const r = await safe.loadSafe(a, 'p', 123);
    assert.strictEqual(r.source, 'backup', JSON.stringify(broken));
    assert.deepStrictEqual(r.raw, good);
    assert.strictEqual(a.files['p/data.broken-123.json'], broken);
  }
  // 백업도 없거나 백업도 깨졌으면 처음부터
  const b = fakeAdapter({ 'p/data.json': '{oops', 'p/data.backup.json': '{oops too' });
  assert.deepStrictEqual(await safe.loadSafe(b, 'p', 7), { raw: null, source: 'lost' });
  assert.strictEqual(b.files['p/data.broken-7.json'], '{oops');
});

test('safedata: 파일을 못 읽으면 던진다 (새 고양이로 덮어쓰지 않게)', async () => {
  const a = fakeAdapter({ 'p/data.json': '{}' });
  a.read = async () => {
    throw new Error('EBUSY');
  };
  await assert.rejects(() => safe.loadSafe(a, 'p'), /EBUSY/);
  // 깨진 원본을 남기지 못해도 던진다
  const b = fakeAdapter({ 'p/data.json': '{oops' });
  b.write = async () => {
    throw new Error('EACCES');
  };
  await assert.rejects(() => safe.loadSafe(b, 'p'), /EACCES/);
});

test('safedata: 백업은 하루에 한 번, 고양이가 있는 자료만', async () => {
  const a = fakeAdapter({});
  const good = { settings: { petName: 'Mochi' } };
  assert.strictEqual(await safe.backupDaily(a, 'p', good, undefined, '2026-9-30'), true);
  assert.deepStrictEqual(JSON.parse(a.files['p/data.backup.json']), good);
  assert.strictEqual(await safe.backupDaily(a, 'p', { settings: { petName: 'X' } }, '2026-9-30', '2026-9-30'), false);
  assert.strictEqual(await safe.backupDaily(a, 'p', null, undefined, '2026-10-1'), false);
  assert.strictEqual(await safe.backupDaily(a, 'p', {}, undefined, '2026-10-1'), false);
  assert.deepStrictEqual(JSON.parse(a.files['p/data.backup.json']), good);
});

test('i18n: 의견 보내기·저장 파일 안내·자랑 카드에 플러그인 이름', () => {
  for (const lang of I18N.LANGS) {
    for (const k of ['obs.feedback', 'obs.feedbackDesc', 'obs.feedbackBtn', 'obs.dataRestored', 'obs.dataLost']) assert.ok(I18N.UI[lang][k], lang + ' ' + k);
    for (const k of ['card.footer', 'card.shareText']) assert.ok(I18N.UI[lang][k].includes('Vault Pet'), lang + ' ' + k);
  }
});

/* ── 1.2.3 ── */

test('usage: 노트를 지웠다 다시 만들어도(휴지통 복원·동기화·git) 같은 글은 다시 안 센다', () => {
  const u = new UsageTracker();
  u.observe('a/x.md', measure('가'.repeat(500)), new Date());
  assert.strictEqual(u.totals().c, 500);
  assert.strictEqual(u.totals().n, 1);
  u.remove('a/x.md');
  assert.strictEqual(u.has('a/x.md'), false);
  assert.strictEqual(u.known('a/x.md'), true, '지운 노트의 기록은 남겨 둔다');
  u.observe('a/x.md', measure('가'.repeat(500)), new Date(), { cap: 3000 });
  assert.strictEqual(u.totals().c, 500, '되살린 노트는 다시 안 센다');
  assert.strictEqual(u.totals().n, 1, '새 노트로도 다시 안 센다');
  u.keepOnly([]);
  u.observe('a/x.md', measure('가'.repeat(600)), new Date(), { cap: 3000 });
  assert.strictEqual(u.totals().c, 600, '꺼진 동안 지워졌다 돌아와도 늘어난 만큼만');
  u.canvas('c.canvas');
  u.remove('c.canvas');
  u.canvas('c.canvas');
  let cv = 0;
  for (const [, b] of u.eachBucket()) cv += (b.t && b.t.canvas) || 0;
  assert.strictEqual(cv, 1, '캔버스를 지웠다 만들어도 한 번');
});

test('usage: 붙여넣기·끌어다 놓기로 들어온 글은 세지 않는다', () => {
  const u = new UsageTracker();
  u.observe('n.md', measure('가'.repeat(20)), new Date());
  const skip = { c: 1000, l: 2 };
  const m = measure('가'.repeat(1050) + ' [[a]] [[b]] [[c]]');
  const r = u.observe('n.md', m, new Date(), { cap: 3000, linkCap: 30, skip });
  assert.strictEqual(r.dc, m.chars - 20 - 1000, '늘어난 글자에서 붙여 넣은 1,000자를 뺀 만큼만');
  assert.strictEqual(r.skipped.c, 1000);
  assert.strictEqual(r.skipped.l, 2);
  assert.strictEqual(r.dl, 1, '붙여 넣지 않은 링크만');
  assert.strictEqual(u.totals().c, 20 + r.dc);
});

test('host: 비눗방울 — 장난감과 모션이 키를 나눠 쓴다 (예전 보유자는 모션도 그대로)', async () => {
  const shop = require(path.join(src, 'core/shop'));
  assert.strictEqual(shop.find('bubbles').kind, 'toy');
  assert.strictEqual(shop.find('bubbleplay').kind, 'motion');
  const keys = [...shop.ACCESSORIES, ...shop.FOODS, ...shop.TOYS, ...shop.MOTIONS].map((x) => x.key);
  assert.strictEqual(new Set(keys).size, keys.length, '상점 키가 겹치지 않는다');
  for (const lang of I18N.LANGS) assert.ok(I18N.UI[lang]['motion.bubbleplay'], lang);
  // 예전 저장: 장난감 'bubbles' 를 샀고 모션 자리에 'bubbles' 를 끼워 뒀다
  const { host, settings, state } = makeHost({ state: { items: ['bubbles'] }, settings: { idleMotions: ['bubbles', 'loaf'], motions: { done: ['bubbles'] } } });
  assert.ok(state.get('items').includes('bubbleplay'));
  assert.deepStrictEqual(settings.get('idleMotions').slice(0, 1), ['bubbleplay']);
  assert.deepStrictEqual(settings.get('motions').done, ['bubbleplay']);
  // 2.0.0: 모션은 사지 않는다 (처음부터 다 열려 있다). 장난감이 따라 생기지도 않는다
  const fresh = makeHost();
  fresh.host.shop.state.set({ walletBonus: 100000 });
  assert.strictEqual(fresh.host.shop.blocker('bubbleplay'), 'motion');
  assert.ok(!(await fresh.host.onInvoke('shop:buy', null, 'bubbleplay')).ok);
  assert.ok(fresh.host.shop.canUseMotion('idle', 'bubbleplay'));
  assert.strictEqual(fresh.host.shop.owned('bubbles'), false);
  assert.ok(host);
});

/* ── 1.2.4 ── */

test('gauge: 고정 음식을 먹고 오래 꺼 둬도, 고정이 끝난 뒤의 시간만큼은 준다 (24시간 상한)', () => {
  const { Gauge } = require(path.join(src, 'core/gauge'));
  const HOUR = 3600e3;
  const t0 = Date.UTC(2026, 9, 1);
  // 1.3.0: 기운 게이지는 없어졌다 (예전 저장의 energy 값은 무시한다). tick(now)
  const st = new Store({ gauge: { food: 100, energy: 100, at: t0, foodLockUntil: t0 + 24 * HOUR, energyLockUntil: t0 + 24 * HOUR } }, {}, () => {});
  const g = new Gauge(st);
  g.tick(t0 + 48 * HOUR);
  assert.ok(g.get().food < 100, '고정이 끝난 24시간 동안은 줄어야 한다');
  assert.strictEqual(g.get().energy, undefined, '기운은 없다');
  const free = new Gauge(new Store({ gauge: { food: 100, at: t0 } }, {}, () => {}));
  free.tick(t0 + 24 * HOUR);
  assert.strictEqual(g.get().food, free.get().food, '고정 뒤 24시간 = 고정 없이 24시간');
  const locked = new Gauge(new Store({ gauge: { food: 100, at: t0, foodLockUntil: t0 + 24 * HOUR } }, {}, () => {}));
  locked.tick(t0 + 10 * HOUR);
  assert.strictEqual(locked.get().food, 100, '고정 동안은 그대로');
  assert.ok(locked.get().full, '고정 중이면 든든');
});

test('achievements: 보상 코스튬이 두 업적에 겹치지 않는다', () => {
  const items = ACHIEVEMENTS.map((a) => a.reward && a.reward.item).filter(Boolean);
  assert.strictEqual(new Set(items).size, items.length, items.filter((x, i) => items.indexOf(x) !== i).join(','));
});

/* ── 1.2.5 ── */

test('styles: 테마가 iframe 에 칠하는 배경·테두리·그림자를 펫 iframe 이 이긴다 (Retroma, 이슈 #3)', () => {
  const css = require('fs').readFileSync(path.join(src, 'plugin/styles.css'), 'utf8');
  const m = css.match(/iframe\.kitcommit-frame:not\(#[\w-]+\)\s*\{([^}]*)\}/);
  assert.ok(m, 'iframe.kitcommit-frame:not(#…) 규칙이 있어야 한다 (ID 우선순위로 테마 규칙을 이긴다)');
  for (const p of ['background: transparent', 'border: 0', 'border-radius: 0', 'box-shadow: none']) {
    assert.ok(m[1].includes(p), p);
  }
  assert.ok(!css.includes('!important'), '!important 없이 (옵시디언 자동 리뷰 CSS lint)');
});

/* ── 1.3.0 (킷커밋 데스크톱 0.3.0 ~ 0.4.0 반영) ── */

test('growth: 레벨은 80에서 멈추고, 그 뒤 2,000 XP 마다 별 하나 (별마다 500코인은 한 번만)', () => {
  assert.strictEqual(growth.levelOf(growth.XP_AT_MAX + 999999), 80);
  assert.strictEqual(growth.STAR_XP, 2000);
  const s = growth.starsOf(growth.XP_AT_MAX + 4500);
  assert.strictEqual(s.stars, 2);
  assert.strictEqual(s.starNext, 1500);
  const { host } = makeHost();
  const before = host.shop.wallet().balance;
  const g = { ...host.growth, xp: growth.XP_AT_MAX + 4500, stars: 2, maxed: true };
  assert.strictEqual(host.gamify.payStars(g), 2);
  assert.strictEqual(host.gamify.payStars(g), 0, '이미 준 별은 다시 안 준다');
  assert.strictEqual(host.shop.wallet().balance - before, 1000);
});

test('star shop: 별 코스튬 · 별 털색은 별로만 사고, 코스튬 개수 업적에는 안 들어간다', async () => {
  const shop = require(path.join(src, 'core/shop'));
  const stars = shop.ACCESSORIES.filter((x) => x.stars);
  assert.strictEqual(stars.length, 56);
  for (const lang of I18N.LANGS) for (const it of stars) assert.ok(I18N.UI[lang]['item.' + it.key], `${lang} item.${it.key}`);
  const { host } = makeHost();
  const sum = host.shop.summary();
  assert.ok(sum.star.length === 59 && !sum.acc.some((x) => x.stars), '별 물건은 코인 상점에 없다');
  host.shop.state.set({ walletBonus: 1e6 });
  const cheap = sum.star[0];
  assert.strictEqual((await host.onInvoke('shop:buy', null, cheap.key)).reason, 'stars', 'Lv80 전에는 별이 없다');
  // 별 5개를 땄다고 치고 털색(오로라, 별 3)을 산다
  host.growth = { ...host.growth, stars: 5, maxed: true };
  const r = await host.onInvoke('shop:buy', null, 'fur_aurora');
  assert.ok(r.ok, r.reason);
  assert.strictEqual(host.shop.starWallet().balance, 2);
  assert.strictEqual((await host.onInvoke('house:set', null, { fur: 'aurora' })).settings.fur, 'aurora');
  assert.strictEqual((await host.onInvoke('house:set', null, { fur: 'neon' })).settings.fur, 'aurora', '안 산 별 털색은 못 입는다');
  assert.ok(!(host.state.get('purchases') || []).some((p) => p.key === 'fur_aurora'), '별 물건은 코인 장부에 안 적는다');
  assert.ok(host.gamify.extra().totalAcc < shop.ACCESSORIES.length - 56);
});

test('ears: 귀 모양은 정해진 13가지만, 고르면 펫 판에 바로 간다', async () => {
  const { host, sent } = makeHost();
  assert.strictEqual(growth.EAR_SHAPES.length, 13);
  for (const lang of I18N.LANGS) for (const k of growth.EAR_SHAPES) assert.ok(I18N.UI[lang]['ear.' + k], `${lang} ear.${k}`);
  assert.strictEqual((await host.onInvoke('house:set', null, { ears: 'fox' })).settings.ears, 'fox');
  assert.strictEqual((await host.onInvoke('house:set', null, { ears: 'wings' })).settings.ears, 'fox');
  assert.ok(sent.some(([ch, x]) => ch === 'pet:config' && x.ears === 'fox'));
});

test('house:set: 켜고 끄기는 true/false 만, 시각은 HH:MM 만, 테마 · 카드 설정은 아는 값만', async () => {
  const { host } = makeHost();
  let p = await host.onInvoke('house:set', null, { chatter: 'yes', lunchTime: '25:99', theme: 'neon', sleepyAfterMin: 999 });
  assert.strictEqual(p.settings.chatter, true);
  assert.strictEqual(p.settings.lunchTime, '11:50');
  assert.strictEqual(p.settings.theme, 'auto');
  assert.ok(p.settings.sleepyAfterMin <= p.settings.sleepAfterMin, '졸기 시작은 잠들기보다 늦을 수 없다');
  p = await host.onInvoke('house:set', null, { theme: 'mint', cardPrefs: { period: 'last', cells: ['written', 'tokens', 'links', 'written'], theme: 'night', caption: 'a'.repeat(80), x: 1 } });
  assert.strictEqual(p.settings.theme, 'mint');
  assert.deepStrictEqual(p.settings.cardPrefs, { period: 'last', cells: ['written', 'links'], theme: 'night', caption: 'a'.repeat(40) });
});

test('recap: 이번 달 · 지난달 · 처음부터 글쓰기 카드 숫자 (뺀 폴더는 빼고)', () => {
  const { recap, longestStreak } = require(path.join(src, 'core/recap'));
  const usage = new UsageTracker();
  const day = (d, h) => new Date(2026, 9, d, h);
  usage.add('일기/a.md', day(1, 9), 1000, 3, 1, {});
  usage.add('일기/a.md', day(2, 21), 300, 1, 0, {});
  usage.add('일기/b.md', day(3, 21), 2500, 0, 1, {});
  usage.add('비밀/c.md', day(3, 22), 9000, 9, 1, {});
  usage.add('일기/a.md', new Date(2026, 8, 20, 10), 700, 0, 0, {});
  usage.setExcluded([require(path.join(src, 'core/usage')).folderKey('비밀')]);
  const now = new Date(2026, 9, 10, 12).getTime();
  const R = recap(usage, 'month', { now, folderName: () => '일기' });
  assert.strictEqual(R.written, 3800);
  assert.strictEqual(R.links, 4);
  assert.strictEqual(R.notes, 2);
  assert.strictEqual(R.activeDays, 3);
  assert.strictEqual(R.streak, 3);
  assert.strictEqual(R.busiest.day, '2026-10-03');
  assert.strictEqual(R.peakHour, 21);
  assert.strictEqual(R.favFolder, '일기');
  assert.strictEqual(R.folders, 1);
  assert.strictEqual(recap(usage, 'last', { now }).written, 700);
  assert.strictEqual(recap(usage, 'all', { now }).written, 4500);
  assert.strictEqual(longestStreak(['2026-10-01', '2026-10-03', '2026-10-04']), 2);
});

test('host: 리캡 카드 숫자는 card:recap 으로, 카드에 Claude · 토큰 이야기는 없다', async () => {
  const { host } = makeHost();
  const r = await host.onInvoke('card:recap', null, 'all');
  for (const k of ['written', 'links', 'notes', 'sessions', 'activeDays', 'streak', 'coins', 'daily', 'levelTo']) assert.ok(r[k] !== undefined, k);
  for (const lang of I18N.LANGS) {
    for (const k of ['rc.headline', 'rc.shareText', 'rc.notes', 'rc.folders', 'card.headline', 'card.shareText', 'mgroup.claude', 'mgroup.sub.claude', 'set.themeSub', 'shop.starRoad', 'ach.bored_10.desc', 'wn.bubble.d', 'wn.streak.t', 'wn.streak.d']) {
      const v = I18N.UI[lang][k];
      assert.ok(v, `${lang} ${k}`);
      assert.ok(!/claude|토큰|token|윈도우|windows|8,000|kitcommit/i.test(v.replace(/[{][a-zA-Z]+[}]/g, '')), `${lang} ${k}: ${v}`);
    }
    for (const kind of ['memory', 'toyOffer']) for (const s of I18N.LINE[lang][kind].angel) assert.ok(!/claude|메시지|message/i.test(s), `${lang} ${kind}: ${s}`);
  }
});

test('bubbles: 수다는 한 시간에 한 번, 업적 · 보상은 한 말풍선 (오늘의 소식은 2.0.0 에 없앴다)', async () => {
  const { host, sent } = makeHost();
  const n0 = sent.filter(([ch]) => ch === 'pet:bubble').length;
  host.bubble('수다 하나', 'chatter');
  host.bubble('수다 둘', 'chatter');
  assert.strictEqual(sent.filter(([ch]) => ch === 'pet:bubble').length - n0, 1);
  host.queueNews({ achievement: { id: 'write_1', xp: 50 }, reward: { coins: 250 } });
  host.queueNews({ achievement: { id: 'link_1', xp: 50 }, reward: { food: { churu: 2 } } });
  host.flushNews();
  const last = sent.filter(([ch]) => ch === 'pet:bubble').pop()[1];
  assert.strictEqual(last.kind, 'achieve');
  assert.ok(/2/.test(last.text) && last.text.includes('250'), last.text);
  assert.strictEqual(host.state.get('news'), undefined);
});

/* ── 2.0.0: 모션 · 퀘스트 · 할 일 · 홈 · 옮기기 ── */

test('motions: 모두 처음부터 열려 있고 상점에 안 나오며, 지운 모션을 산 값은 한 번만 돌려준다', async () => {
  const shop = require(path.join(src, 'core/shop'));
  const { host, state, settings } = makeHost({ state: { items: ['none', 'soju', 'trophy'], walletSpent: 2000 }, settings: { motions: { rest: ['soju', 'cafe'] } } });
  assert.strictEqual(shop.MOTIONS.length, 44);
  for (const m of shop.MOTIONS) for (const slot of m.rec) assert.ok(host.shop.canUseMotion(slot, m.key), m.key);
  assert.ok(!shop.MOTIONS.some((m) => 'price' in m || 'level' in m), '값 · 레벨이 없다');
  // 지운 모션(소주 850)은 돌려주고 옷장에서 뺀다. 남은 모션(트로피)은 공짜가 됐으니 안 돌려준다
  assert.ok(!state.get('items').includes('soju'));
  assert.strictEqual(state.get('walletSpent'), 2000 - 850);
  assert.ok(state.get('retiredPaid').includes('soju'));
  assert.deepStrictEqual(host.motionList('rest'), ['cafe'], '지운 모션은 상황 칸에서도 빠진다');
  // 다른 기기(옛 버전)의 옷장이 합쳐져 되살아나도 두 번 돌려주지 않는다
  state.set({ items: [...state.get('items'), 'soju'] });
  host.migrateShop();
  assert.strictEqual(state.get('walletSpent'), 2000 - 850);
  assert.ok(!state.get('items').includes('soju'));
  assert.ok(!(await host.onInvoke('shop:buy', null, 'trophy')).ok, '모션은 살 수 없다');
  assert.ok(settings);
});

test('motions: 상황마다 끌 수 있다 — 잠깐 하는 상황은 모션 없이, 머무는 상황은 기본 자세로', async () => {
  const { host, sent } = makeHost();
  await host.onInvoke('house:set', null, { motionsOff: ['levelup', 'work', 'nope', 'poke'] });
  assert.deepStrictEqual(host.settings.get('motionsOff'), ['levelup', 'work', 'poke'], '모르는 상황 키는 버린다');
  assert.strictEqual(host.motionFor('levelup'), null);
  assert.deepStrictEqual(host.motionList('work'), ['type']);
  sent.length = 0;
  host.act('levelup');
  assert.ok(!sent.some(([ch]) => ch === 'pet:action'), '끈 상황은 아무 모션도 안 보낸다');
  host.brain.mood = 'active';
  host.poke();
  assert.ok(sent.some(([ch, a]) => ch === 'pet:action' && a === 'purr'), '쓰다듬기를 꺼도 가르릉은 한다');
  const p = host.housePayload();
  assert.deepStrictEqual(p.motion.off.sort(), ['levelup', 'poke', 'work']);
  // 세트 옷 전용 모션 섞기 끄기
  host.cleanOutfit = () => ({ set: 'ninjaset' });
  assert.ok(host.setMotions().length > 0);
  await host.onInvoke('house:set', null, { setMotionsOn: false });
  assert.deepStrictEqual(host.setMotions(), []);
});

test('quests: 옵시디언 습관만 — 고양이 돌보기 퀘스트가 없고, 종류마다 글 · 안내가 세 언어로 있다', () => {
  const { QUEST_POOL } = require(path.join(src, 'core/gamify'));
  const types = QUEST_POOL.map((q) => q.type);
  for (const gone of ['poke', 'lift', 'fed', 'snack', 'catch', 'rest', 'spend', 'xp', 'opens', 'sessions']) assert.ok(!types.includes(gone), gone);
  for (const want of ['tags', 'daily', 'props', 'organize', 'orphans', 'todos', 'graph']) assert.ok(types.includes(want), want);
  for (const lang of I18N.LANGS) {
    for (const q of QUEST_POOL) {
      assert.ok(I18N.UI[lang]['quest.' + q.type], `${lang} quest.${q.type}`);
      assert.ok(I18N.UI[lang]['skill.' + q.skill + '.how'], `${lang} skill.${q.skill}.how`);
    }
  }
});

test('quests: 예전 퀘스트 묶음(쓰다듬기 등)은 새로 뽑고, 태그 퀘스트는 단 태그만큼 오른다', () => {
  const { host, state, usage } = makeHost({ state: { questSet: { id: 'old', at: Date.now(), list: [{ type: 'poke', tier: 'easy', target: 3, xp: 25, base: 0 }], claimed: [] } } });
  let q = host.gamify.quests();
  assert.ok(q.length === 3 && !q.some((x) => x.type === 'poke'));
  // 태그 퀘스트 하나로 바꿔 놓고 태그를 단다
  state.set({ questSet: { id: 'x', at: Date.now(), list: [{ type: 'tags', tier: 'easy', target: 2, xp: 30, base: 0 }], claimed: [] } });
  usage.observe('일기/t.md', measure('가'.repeat(20)), new Date(), { baseline: true });
  usage.observe('일기/t.md', measure('가'.repeat(20) + ' #하나 #둘'), new Date());
  q = host.gamify.quests();
  assert.strictEqual(q[0].value, 2);
  assert.ok(q[0].done && q[0].skill === 'tag');
  // 외톨이 노트가 없으면 외톨이 퀘스트는 안 뽑힌다
  for (let i = 0; i < 30; i++) assert.ok(!host.gamify.newQuestSet().list.some((x) => x.type === 'orphans'));
  host.plugin.orphanList = () => ['a.md'];
  let seen = false;
  for (let i = 0; i < 200 && !seen; i++) seen = host.gamify.newQuestSet().list.some((x) => x.type === 'orphans');
  assert.ok(seen);
});

test('achievements: 보물 · 모션 수집 · 먹고 싶은 것 · 친구 업적이 없고, 정리 습관 묶음이 있다. 모션 보상은 코인으로', () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  for (const gone of ['treasure_1', 'treasure_all', 'motion_10', 'motion_30', 'craving_1', 'invite_ok', 'smoke_break']) assert.ok(!ids.has(gone), gone);
  for (const want of ['prop_1', 'move_1', 'orphan_1', 'graph_1', 'views_all', 'todo_1', 'dailyc_1k']) assert.ok(ids.has(want), want);
  assert.ok(CATS.includes('organize'));
  const shop = require(path.join(src, 'core/shop'));
  for (const a of ACHIEVEMENTS) if (a.reward && a.reward.item) assert.ok(!shop.find(a.reward.item, 'motion'), `${a.id}: 모션 보상`);
});

test('usage: 속성 · 데일리 노트 글자를 센다. 예전 기록은 속성 기준만 잡는다 (2.0.0)', () => {
  const u = new UsageTracker();
  u.observe('2026-10-28.md', { chars: 0, words: 0, links: 0, prop: 0 }, new Date(), { baseline: true });
  u.observe('2026-10-28.md', measure('---\nstatus: draft\ndate: x\n---\n' + '가'.repeat(30)), new Date());
  assert.strictEqual(u.totals().f.prop, 2);
  assert.strictEqual(u.totals().f.dailyc, 30);
  // 1.6.1 기록(속성 칸 없음)은 처음 볼 때 기준만
  const old = new UsageTracker({ files: {} });
  old.observe('a.md', measure('가'.repeat(20)), new Date(), { baseline: true });
  old.d.files[Object.keys(old.d.files)[0]].length = 11; // [.., 단어] 까지만
  old.observe('a.md', measure('---\na: 1\nb: 2\n---\n' + '가'.repeat(20)), new Date());
  assert.ok(!old.totals().f.prop, '이미 달아 둔 속성은 안 센다');
  // 플러그인이 데일리 노트 알아보기를 바꿔 끼운다 (코어 데일리 노트 설정)
  const d = new UsageTracker();
  d.dailyTest = (p) => p.startsWith('Journal/');
  d.observe('Journal/오늘.md', measure('가'.repeat(15)), new Date());
  d.observe('2026-10-28.md', measure('가'.repeat(15)), new Date());
  assert.strictEqual(d.totals().f.dailyc, 15);
});

test('todos: 플러그인 안에서만 만들고 고치고 지운다. 끝내면 한 번만 센다 (만든 지 1분 넘은 것만)', async () => {
  const { Todos, COUNT_AFTER_MS } = require(path.join(src, 'core/todos'));
  const { host, state } = makeHost();
  let r = await host.onInvoke('todo:add', null, '  보고서   초안  ');
  assert.ok(r.ok);
  assert.strictEqual(r.payload.todos.open[0].text, '보고서 초안');
  assert.ok(!(await host.onInvoke('todo:add', null, '   ')).ok, '빈 글은 안 된다');
  await host.onInvoke('todo:add', null, '둘째');
  const [a, b] = state.get('todos');
  await host.onInvoke('todo:move', null, b.id, 0);
  assert.deepStrictEqual(state.get('todos').map((x) => x.text), ['둘째', '보고서 초안']);
  await host.onInvoke('todo:edit', null, a.id, '보고서 끝내기');
  assert.strictEqual(state.get('todos').find((x) => x.id === a.id).text, '보고서 끝내기');
  // 만들자마자 끝내면 안 센다
  await host.onInvoke('todo:toggle', null, b.id);
  assert.ok(!(host.gamify.st.cnt || {}).todoDone);
  // 1분 지난 할 일은 한 번만
  state.set({ todos: state.get('todos').map((x) => ({ ...x, at: x.at - COUNT_AFTER_MS - 1 })) });
  await host.onInvoke('todo:toggle', null, a.id);
  await host.onInvoke('todo:toggle', null, a.id);
  await host.onInvoke('todo:toggle', null, a.id);
  assert.strictEqual(host.gamify.st.cnt.todoDone, 1);
  r = await host.onInvoke('todo:clear', null);
  assert.strictEqual(r.payload.todos.done.length, 0);
  assert.deepStrictEqual(state.get('todoTomb').sort(), [a.id, b.id].sort());
  // 100개까지
  const t = new Todos(new Store({}, {}, () => {}));
  for (let i = 0; i < 100; i++) t.add('x' + i);
  assert.strictEqual(t.add('넘침').reason, 'full');
  assert.strictEqual(t.add('가'.repeat(500)).reason, 'full');
  assert.strictEqual(new Todos(new Store({}, {}, () => {})).add('가'.repeat(500)).item.text.length, 200);
});

test('sync: 할 일은 id 로 합치고, 늦게 고친 쪽 · 어느 기기에서든 지운 건 빠진다', () => {
  const base = devData();
  base.state.todos = [{ id: 'a', text: 'A', done: false, at: 1, up: 1 }, { id: 'b', text: 'B', done: false, at: 1, up: 1 }];
  const mine = clone(base);
  const theirs = clone(base);
  mine.state.todos = [{ id: 'a', text: 'A2', done: false, at: 1, up: 5 }, { id: 'b', text: 'B', done: false, at: 1, up: 1 }, { id: 'c', text: 'C', done: false, at: 6, up: 6 }];
  theirs.state.todos = [{ id: 'a', text: 'A', done: true, at: 1, up: 9 }, { id: 'd', text: 'D', done: false, at: 7, up: 7 }];
  theirs.state.todoTomb = ['b'];
  const m = mergeData(sharedOf(base), mine, theirs, { now: SYNC_T0 });
  assert.deepStrictEqual(m.state.todos.map((x) => x.id), ['a', 'c', 'd']);
  assert.strictEqual(m.state.todos[0].done, true, '늦게 고친 쪽');
  assert.deepStrictEqual(m.state.todoTomb, ['b']);
});

test('migrate v2: 보물은 코인으로, 공방 코스튬은 옷장에, 없앤 기능의 기록은 지운다 (한 번만)', () => {
  const { migrateV2 } = require(path.join(src, 'core/migrate2'));
  const st = new Store({ treasures: { bottlecap: 3, worm: 1, oldkey: 1 }, eventLoot: [{ key: 'receipt' }], workshopMade: [{ key: 'capcrown', at: 1 }, { key: 'gatekeeper', at: 2 }], items: ['none', 'capcrown'], friends: { list: {} }, craving: {}, temper: {}, news: {}, walletBonus: 10 }, {}, () => {});
  const r = migrateV2(st);
  assert.strictEqual(r.treasures, 6);
  assert.strictEqual(r.coins, 3 * 15 + 40 + 120 + 15);
  assert.strictEqual(st.get('walletBonus'), 10 + r.coins);
  assert.deepStrictEqual(r.restored, ['gatekeeper'], '선물해서 옷장에 없던 공방 코스튬을 돌려준다');
  assert.ok(st.get('items').includes('gatekeeper'));
  for (const k of ['treasures', 'eventLoot', 'workshopMade', 'friends', 'craving', 'temper', 'news']) assert.strictEqual(st.get(k), undefined, k);
  assert.strictEqual(migrateV2(st), null, '두 번은 안 한다');
  // 공방 코스튬은 이제 상점에서 판다
  const shop = require(path.join(src, 'core/shop'));
  const gk = shop.find('gatekeeper');
  assert.ok(gk.price > 0 && !gk.workshop);
  // 초대장 쿠키는 상점에서 빠지고 창고분은 돌려준다
  const { host, state } = makeHost({ state: { pantry: { inviteCookie: 2 }, walletSpent: 5000 } });
  assert.ok(!state.get('pantry').inviteCookie);
  assert.strictEqual(state.get('walletSpent'), 4000);
  assert.ok(host);
});

test('focus: 마친 뒤 쉬는 시간을 켜고, 끝나면 다시 하자고 한다 (2.0.0)', async () => {
  const { host, sent } = makeHost();
  const t0 = Date.now();
  host.focusStart(25);
  assert.strictEqual(host.goals.breakStart(5, t0), null, '집중 중에는 쉬기를 못 켠다');
  host.focusTick(t0 + 25 * 60_000 + 1000);
  const p = await host.onInvoke('focus:break', null, 10);
  assert.strictEqual(p.focus.brk.min, 10);
  assert.strictEqual(p.focus.total.today, 1);
  sent.length = 0;
  assert.strictEqual(host.breakTick(Date.now() + 5 * 60_000), null, '아직');
  assert.strictEqual(host.breakTick(Date.now() + 10 * 60_000 + 1000).min, 10);
  assert.ok(sent.some(([ch, x]) => ch === 'pet:bubble' && x.kind === 'focus'));
  assert.strictEqual(host.goals.focusInfo().brk, null);
  // 쉬다가 다시 집중하면 쉬기는 끝난다
  host.breakStart(5);
  host.focusStart(15);
  assert.strictEqual(host.goals.focusInfo().brk, null);
});

test('vaultmap: 노트 지도 · 외톨이 노트 · 최근 노트는 읽기만 하고, 없는 노트는 열지(만들지) 않는다', async () => {
  const vm = require(path.join(src, 'plugin/vaultmap'));
  const KitCommitPlugin = require(path.join(src, 'plugin/main'));
  const mk = (p, mtime = 1) => Object.assign(new fakeObsidian.TFile(), { path: p, extension: p.split('.').pop(), stat: { mtime } });
  const files = ['a.md', 'b.md', 'c.md', 'lonely.md', 'x/d.md', 'secret/e.md'].map((p, i) => mk(p, i));
  const opened = [];
  const app = {
    vault: { getMarkdownFiles: () => files, getAbstractFileByPath: (p) => files.find((f) => f.path === p) || null, create: () => assert.fail('노트를 만들면 안 된다') },
    metadataCache: { resolvedLinks: { 'a.md': { 'b.md': 1 }, 'b.md': { 'c.md': 1, 'b.md': 1 }, 'c.md': {}, 'lonely.md': {}, 'x/d.md': { 'a.md': 2 }, 'secret/e.md': { 'a.md': 1 } } },
    workspace: { getLastOpenFiles: () => ['b.md', 'gone.md', 'secret/e.md', 'a.md'], getLeaf: () => ({ openFile: (f) => opened.push(f.path) }), openLinkText: () => assert.fail('openLinkText 는 없는 노트를 만든다') },
  };
  const ex = (p) => p.startsWith('secret/');
  const g = vm.localGraph(app, 'a.md', ex);
  assert.strictEqual(g.nodes[0].path, 'a.md');
  assert.deepStrictEqual(g.nodes.map((n) => n.path).sort(), ['a.md', 'b.md', 'c.md', 'x/d.md'], '두 걸음까지 · 뺀 폴더 빼고');
  assert.ok(g.edges.length >= 3);
  assert.strictEqual(vm.localGraph(app, 'nope.md'), null);
  assert.deepStrictEqual(vm.orphanNotes(app, ex), ['lonely.md']);
  assert.deepStrictEqual(vm.recentNotes(app, ex).map((x) => x.path), ['b.md', 'a.md']);
  // 플러그인의 노트 열기: 있는 것만
  const self = { app };
  assert.strictEqual(await KitCommitPlugin.prototype.openNote.call(self, 'nope.md'), false);
  assert.strictEqual(await KitCommitPlugin.prototype.openNote.call(self, 'b.md'), true);
  assert.deepStrictEqual(opened, ['b.md']);
  // 코어 데일리 노트 설정으로 알아보기
  const prevMoment = globalThis.window && globalThis.window.moment;
  globalThis.window = globalThis.window || {};
  globalThis.window.moment = (s, f) => ({ isValid: () => f === 'YYYY-MM-DD' && /^\d{4}-\d{2}-\d{2}$/.test(s) });
  const dapp = { internalPlugins: { getPluginById: () => ({ enabled: true, instance: { options: { folder: 'Daily', format: 'YYYY-MM-DD' } } }) } };
  const isDaily = vm.dailyMatcher(dapp);
  assert.ok(isDaily('Daily/2026-10-28.md') && !isDaily('2026-10-28.md') && !isDaily('Daily/메모.md'));
  assert.strictEqual(vm.dailyMatcher({}), null);
  globalThis.window.moment = prevMoment;
});

test('plugin: 노트 옮기기 · 이름 바꾸기 · 화면 열어 보기 · 외톨이 이어 주기를 센다 (2.0.0)', () => {
  const KitCommitPlugin = require(path.join(src, 'plugin/main'));
  const P = KitCommitPlugin.prototype;
  const got = [];
  const host = { loading: false, noteSkill: (k, n = 1) => got.push([k, n]) };
  const mk = (p) => Object.assign(new fakeObsidian.TFile(), { path: p, extension: 'md' });
  const self = { host, isExcludedPath: (p) => p.startsWith('.') };
  P.noteRename.call(self, mk('정리/a.md'), 'a.md');
  P.noteRename.call(self, mk('정리/b2.md'), '정리/b.md');
  P.noteRename.call(self, mk('.trash/c.md'), 'c.md');
  assert.deepStrictEqual(got.splice(0), [['move', 1], ['retitle', 1]]);
  const leaf = (type) => ({ view: { getViewType: () => type } });
  P.noteView.call(self, leaf('graph'));
  P.noteView.call(self, leaf('graph'));
  P.noteView.call(self, leaf('markdown'));
  P.noteView.call(self, leaf('search'));
  assert.deepStrictEqual(got.splice(0), [['view_graph', 1], ['view_search', 1]]);
  // 외톨이: 링크를 얻은 노트만, 한 노트는 한 번만
  const data = {};
  let orphans = ['a.md', 'b.md'];
  const o = { host, state: { get: (k) => data[k], set: (p) => Object.assign(data, p) }, orphanList: () => orphans, app: { vault: { getAbstractFileByPath: (p) => (p === 'gone.md' ? null : {}) } } };
  P.orphanTick.call(o);
  orphans = ['b.md'];
  P.orphanTick.call(o);
  orphans = ['a.md', 'b.md'];
  P.orphanTick.call(o);
  orphans = ['b.md'];
  P.orphanTick.call(o);
  assert.deepStrictEqual(got, [['orphanFix', 1]]);
});

test('house · 펫 화면: 없앤 기능(친구 · 보물 · 공방 · 기분 · 먹고 싶은 것 · 소식)의 통로를 부르지 않는다', () => {
  const fs = require('fs');
  const house = fs.readFileSync(path.join(src, 'kit/house.js'), 'utf8');
  for (const n of ['pet.friend', 'pet.craft', 'pet.exchange', 'pet.fillRecipe', 'pet.devEvent', 'PetFriends', 'D.treasures', 'D.workshop', 'D.friends', 'D.craving', 'D.news', 'D.temper', 'data-crave', 'data-ws-']) assert.ok(!house.includes(n), 'house ' + n);
  const code = ['kit/pet.js', 'kit/toyplay.js', 'kit/toyplay2.js', 'kit/toyplay3.js', 'kit/toyplay4.js', 'kit/toyplay5.js'].map((f) => fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
  for (const n of ['pet.onEvent', 'pet.treasure', 'pet.eventSkip', 'pet.onFriend', 'pet.friend', 'PetFriends', 'temper']) assert.ok(!code.includes(n), n);
  const frame = fs.readFileSync(path.join(src, 'plugin/frame.js'), 'utf8');
  const bridge = new Set([...frame.matchAll(/\['(\w+)', '(?:send|invoke|on)'/g)].map((m) => m[1]));
  for (const used of new Set([...house.matchAll(/\bpet\.(\w+)\(/g)].map((m) => m[1]))) assert.ok(bridge.has(used), 'bridge ' + used);
  for (const f of ['core/friends.js', 'core/treasure.js', 'core/workshop.js', 'core/craving.js', 'kit/friends.js']) assert.ok(!fs.existsSync(path.join(src, f)), f);
});

test('home: 칸 순서 · 보이기 설정은 아는 칸만 겹치지 않게, 기본 순서는 목표 · 오늘 · 노트 지도 · 할 일 · 고양이 · 퀘스트 · 최근 노트 (2.0.1)', async () => {
  const fs = require('fs');
  const house = fs.readFileSync(path.join(src, 'kit/house.js'), 'utf8');
  const order = (code) => JSON.parse(code.match(/const HOME_SECTIONS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
  const want = ['goal', 'today', 'map', 'todo', 'cat', 'quests', 'recent'];
  assert.deepStrictEqual(order(house), want);
  assert.deepStrictEqual(order(fs.readFileSync(path.join(src, 'plugin/host.js'), 'utf8')), want, '호스트와 같은 목록');
  const { host, settings } = makeHost();
  assert.strictEqual(settings.get('homeLayout'), null);
  await host.onInvoke('house:set', null, { homeLayout: [{ id: 'map', on: true }, { id: 'nope' }, { id: 'map', on: false }, { id: 'todo', on: false }, 'x'] });
  assert.deepStrictEqual(settings.get('homeLayout'), [{ id: 'map', on: true }, { id: 'todo', on: false }]);
  await host.onInvoke('house:set', null, { homeLayout: 'bad' });
  assert.deepStrictEqual(settings.get('homeLayout'), [{ id: 'map', on: true }, { id: 'todo', on: false }], '모양이 틀리면 그대로');
  await host.onInvoke('house:set', null, { homeLayout: null });
  assert.strictEqual(settings.get('homeLayout'), null, '기본으로 되돌리기');
  for (const lang of I18N.LANGS) for (const k of ['home.customize', 'home.layoutSub', 'home.secCat', 'home.goalSlashW', 'home.goalSlashC', 'home.focusLabel', 'home.breakAsk', 'todo.dragHint', 'map.hint']) assert.ok(I18N.UI[lang][k], `${lang} ${k}`);
});

test('shop: 장난감 36종 — 4차 6종까지 아이콘 · 이름 · 노는 법 · 반응 글이 다 있다', () => {
  const shop = require(path.join(src, 'core/shop'));
  const PixelArt = require(path.join(src, 'kit/pixelart'));
  assert.strictEqual(shop.TOYS.length, 36);
  for (const k of ['sunbeam', 'quilt', 'fishbowl', 'shellgame', 'volley', 'simon']) assert.ok(shop.TOYS.some((x) => x.key === k), k);
  for (const it of shop.TOYS) {
    assert.ok(PixelArt.has(it.key), 'icon ' + it.key);
    for (const lang of ['ko', 'en', 'zh']) for (const p of ['item.', 'toyHow.', 'toyDo.']) assert.ok(I18N.UI[lang][p + it.key], `${lang} ${p}${it.key}`);
  }
  for (const lang of ['ko', 'en', 'zh']) for (const k of ['whackcat', 'rps', 'trampoline', 'jumprope', 'quilt', 'shellgame', 'volley', 'simon']) assert.ok(I18N.UI[lang]['game.rec.' + k], `${lang} game.rec.${k}`);
});

test('host: 줄넘기 · 4차 장난감 최고 기록이 저장된다 (RECORD_KEYS)', () => {
  const { host, state } = makeHost();
  for (const k of ['jumprope', 'quilt', 'shellgame', 'volley', 'simon']) {
    host.onSend('pet:toy-record', null, k, 7);
    assert.strictEqual((state.get('toyRecords') || {})[k], 7, k);
  }
  host.onSend('pet:toy-record', null, 'nope', 7);
  assert.strictEqual((state.get('toyRecords') || {}).nope, undefined);
});

// 같은 창에 올라가는 스크립트들에 같은 맨 바깥 이름이 두 번 있으면 뒤의 것이 앞의 것을 소리 없이 덮어쓴다
// (Kit Commit 10-18: 장난감 쫓기 stepHunt 가 커서 사냥 stepHunt 에 덮여 레이저 · 비눗방울을 켜도 고양이가 거의 안 쫓았다)
test('펫 · 하우스 화면: 함께 올라가는 스크립트에 같은 맨 바깥 이름이 두 번 없다', () => {
  const fs = require('fs');
  const build = fs.readFileSync(path.join(__dirname, '..', 'scripts/build.js'), 'utf8');
  const list = (name) => new Function('return ' + build.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);`))[1])();
  const COMMON = list('COMMON');
  const PET = list('PET');
  const HOUSE = list('HOUSE');
  assert.ok(PET.includes('kit/toyplay5.js'), 'toyplay5');
  assert.ok(COMMON.includes('kit/i18n-v2.js'), 'i18n-v2');
  assert.ok(!COMMON.includes('kit/friends.js'), 'friends.js 는 뺐다');
  const NAME = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)|^(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/gm;
  for (const [page, files] of [['pet', [...COMMON, ...PET]], ['house', [...COMMON, ...HOUSE]]]) {
    const seen = new Map();
    const dups = [];
    for (const f of files) {
      for (const m of fs.readFileSync(path.join(src, f), 'utf8').matchAll(NAME)) {
        const n = m[1] || m[2];
        if (seen.has(n)) dups.push(`${n} (${seen.get(n)} · ${f})`);
        else seen.set(n, f);
      }
    }
    assert.deepStrictEqual(dups, [], page);
  }
});

test('whats new: 업데이트한 사람에게만 한 번 (처음 설치한 사람은 첫 실행 안내)', async () => {
  const old = makeHost({ state: { onboarded: true, lastVersion: '1.2.5' } });
  old.plugin.manifest = { version: '1.3.0' };
  old.host.checkVersion();
  assert.strictEqual((await old.host.onInvoke('house:get')).whatsNew, '1.3.0');
  await old.host.onInvoke('house:whats-new-seen');
  assert.strictEqual((await old.host.onInvoke('house:get')).whatsNew, null);
  const fresh = makeHost();
  fresh.plugin.manifest = { version: '1.3.0' };
  fresh.host.checkVersion();
  assert.strictEqual((await fresh.host.onInvoke('house:get')).whatsNew, null);
});

test('house.css: 빌드하면 중첩 · :has · !important 가 없다 (옵시디언 자동 리뷰)', () => {
  const fs = require('fs');
  const build = fs.readFileSync(path.join(__dirname, '..', 'scripts/build.js'), 'utf8');
  const fn = build.match(/function flattenDark[\s\S]*?\n}\n/)[0];
  const flattenDark = new Function(fn + '; return flattenDark;')();
  const css = flattenDark(fs.readFileSync(path.join(src, 'kit/house.css'), 'utf8'));
  assert.ok(!css.includes(':has('), ':has');
  assert.ok(!css.includes('!important'), '!important');
  let i = 0;
  while ((i = css.indexOf(':root.dark', i)) >= 0) {
    const open = css.indexOf('{', i);
    const close = css.indexOf('}', open + 1);
    const again = css.indexOf('{', open + 1);
    assert.ok(!(again >= 0 && again < close), 'nested block at ' + css.slice(i, i + 60));
    i = open + 1;
  }
});

/* ── 중국어 (zh) ── */
// 빠진 글은 한국어로 나온다 (Strings.t · lines 가 ko 로 떨어진다). 그래서 영어에 있는 건 중국어에도 다 있어야 한다
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)/g)].map((m) => m[1]);
test('i18n zh: 영어에 있는 화면 글 · 대사 종류가 중국어에도 다 있고, {자리}가 같다', () => {
  assert.ok(I18N.LANGS.includes('zh'), 'LANGS');
  const en = I18N.UI.en;
  const zh = I18N.UI.zh;
  const missing = Object.keys(en).filter((k) => !(k in zh));
  assert.deepStrictEqual(missing, [], 'zh UI 빠짐');
  for (const k of Object.keys(en)) {
    assert.strictEqual(typeof zh[k], 'string', k);
    assert.deepStrictEqual([...new Set(placeholders(zh[k]))].sort(), [...new Set(placeholders(en[k]))].sort(), `UI ${k}: ${zh[k]}`);
    assert.strictEqual((zh[k].match(/\|\|/g) || []).length, (en[k].match(/\|\|/g) || []).length, `UI || ${k}`);
    assert.ok(!/[\uac00-\ud7a3]/.test(zh[k]), `UI 한글 ${k}: ${zh[k]}`);
  }
  const kinds = Object.keys(I18N.LINE.en);
  assert.deepStrictEqual(kinds.filter((k) => !I18N.LINE.zh[k] || !Array.isArray(I18N.LINE.zh[k].angel)), [], 'zh LINE 빠짐');
  for (const kind of kinds) {
    const enLines = I18N.LINE.en[kind].angel;
    const zhLines = I18N.LINE.zh[kind].angel;
    if (enLines.length) assert.ok(zhLines.length, `LINE ${kind} 비었다`);
    const enPh = new Set(enLines.flatMap(placeholders));
    const zhPh = new Set(zhLines.flatMap(placeholders));
    for (const p of enPh) assert.ok(zhPh.has(p), `LINE ${kind}: {${p}} 없음`);
    for (const p of zhPh) assert.ok(enPh.has(p), `LINE ${kind}: 영어에 없는 {${p}}`);
    for (const s of zhLines) {
      assert.ok(!/[\uac00-\ud7a3]/.test(s), `LINE 한글 ${kind}: ${s}`);
      assert.ok(!/\{\w+#/.test(s), `LINE 조사 문법 ${kind}: ${s}`);
    }
  }
});

test('i18n zh: 물건 · 모션 이름이 다 있고, 로케일은 zh-CN', () => {
  const shop = require(path.join(src, 'core/shop'));
  for (const it of [...shop.ACCESSORIES, ...shop.FOODS, ...shop.TOYS]) assert.ok(I18N.UI.zh['item.' + it.key], `item.${it.key}`);
  for (const m of shop.MOTIONS) assert.ok(I18N.UI.zh['motion.' + m.key], `motion.${m.key}`);
  const T = new I18N.Strings('zh');
  assert.strictEqual(T.lang, 'zh');
  assert.strictEqual(T.locale, 'zh-CN');
  assert.strictEqual(new I18N.Strings('en').locale, 'en-US');
  assert.strictEqual(new I18N.Strings('ko').locale, 'ko-KR');
  assert.ok(T.line('hello', { name: '奇奇' }).includes('奇奇'));
});

test('legacy · 설정: 언어 zh 를 받아들인다', async () => {
  assert.strictEqual(legacyMod.legacySettings({ settings: { language: 'zh' } }).language, 'zh');
  const { host } = makeHost();
  await host.onInvoke('house:set', null, { language: 'zh' });
  assert.strictEqual(host.settings.get('language'), 'zh');
  assert.strictEqual(host.T.lang, 'zh');
  await host.onInvoke('house:set', null, { language: 'fr' });
  assert.strictEqual(host.settings.get('language'), 'zh', '모르는 언어는 무시');
});

/* ── 1.5.0: 단어 · 끝낸 할 일 · 하루 목표 · 집중 시간 ── */

const goalsMod = require(path.join(src, 'core/goals'));

test('measure: 단어를 센다 (중국어 · 일본어 글자는 한 글자 = 한 단어, 할 일 표시 x 는 빼고)', () => {
  assert.strictEqual(measure("Hello world, it's me — 3 cats").words, 6);
  assert.strictEqual(measure('今天写作').words, 4);
  assert.strictEqual(measure('안녕 친구야 반가워').words, 3);
  assert.strictEqual(measure('- [x] Buy milk\n- [ ] Call mom').words, 4);
  assert.strictEqual(measure('See [docs](https://example.com/a-b-c) now').words, 3, 'URL 은 단어가 아니다');
});

test('usage: 단어도 늘어난 만큼만, 예전(1.4) 기록은 처음 볼 때 기준만 잡는다', () => {
  const u = new UsageTracker();
  // 1.4 때 만든 기록: 단어 칸이 없다
  u.observe('a.md', measure('one two three four five'), new Date(), { baseline: true });
  u.data.files[Object.keys(u.data.files)[0]].length = 10;
  u.observe('a.md', measure('one two three four five six'), new Date());
  assert.strictEqual(u.totals().w, 0, '단어 기준이 없던 노트는 이번엔 기준만');
  assert.ok(u.totals().c > 0, '글자는 그대로 센다');
  u.observe('a.md', measure('one two three four five six seven eight'), new Date());
  assert.strictEqual(u.totals().w, 2);
  // 새 노트는 0 에서 센다
  u.observe('b.md', measure('alpha beta gamma'), new Date());
  assert.strictEqual(u.totals().w, 5);
  // 붙여넣기 몫은 단어에서도 빠진다
  u.observe('c.md', measure('pasted words here typed'), new Date(), { skip: { c: 17, l: 0, w: 3 } });
  assert.strictEqual(u.totals().w, 6);
  assert.strictEqual(u.today().w, 6);
  assert.strictEqual(u.daily(1)[0].w, 6);
});

test('growth · coins: 끝낸 할 일 하나 = 5 XP · 5코인, 체크를 풀었다 다시 해도 한 번', () => {
  assert.strictEqual(growth.xpOf({ k: 3 }), 15);
  const { host, usage } = makeHost();
  const xp0 = host.growth.xp;
  const coins0 = host.shop.wallet().balance;
  usage.observe('일기/할 일.md', measure('- [ ] a\n- [ ] b'), new Date(), { baseline: true });
  usage.observe('일기/할 일.md', measure('- [x] a\n- [x] b'), new Date());
  usage.observe('일기/할 일.md', measure('- [ ] a\n- [ ] b'), new Date());
  usage.observe('일기/할 일.md', measure('- [x] a\n- [x] b'), new Date());
  host.onUsage();
  assert.strictEqual(usage.totals().k, 2);
  assert.ok(host.growth.xp >= xp0 + 10, 'XP');
  assert.strictEqual(host.shop.wallet().balance - coins0, 10, '코인');
});

test('goal: 오늘 목표를 채우면 한 번만 축하 · 코인 100 · XP 50 · 업적 횟수, 상태 표시줄 줄', () => {
  const { host, usage, sent, settings } = makeHost({ settings: { language: 'en' } });
  assert.deepStrictEqual(host.goals.config(), { on: true, unit: 'words', target: 300 }, '영어는 300단어');
  assert.ok(/0 \/ 300 words/.test(host.goalLine()));
  const coins0 = host.shop.wallet().balance;
  usage.observe('일기/draft.md', measure('word '.repeat(150)), new Date());
  host.onUsage();
  assert.strictEqual(host.goals.progress().done, false);
  usage.observe('일기/draft.md', measure('word '.repeat(320)), new Date());
  host.onUsage();
  const p = host.goals.progress();
  assert.strictEqual(p.done, true);
  assert.strictEqual(p.current, 1);
  assert.ok(sent.some(([ch, x]) => ch === 'pet:bubble' && x.kind === 'goal'), '말풍선');
  const coins1 = host.shop.wallet().balance;
  assert.ok(coins1 - coins0 >= 100, '목표 코인');
  assert.ok(host.gamify.st.bonus.some((b) => b.why && b.why.k === 'bonus.goalW' && b.xp === 50));
  assert.strictEqual(host.gamify.st.cnt.goal, 1);
  const n = sent.filter(([ch, x]) => ch === 'pet:bubble' && x.kind === 'goal').length;
  usage.observe('일기/draft.md', measure('word '.repeat(400)), new Date());
  host.onUsage();
  assert.strictEqual(sent.filter(([ch, x]) => ch === 'pet:bubble' && x.kind === 'goal').length, n, '하루 한 번');
  assert.ok(/reached/.test(host.goalLine()));
  // 끄면 세지 않는다
  settings.set({ goal: { on: false, unit: 'words', target: 300 } });
  assert.strictEqual(host.goals.check(), null);
});

test('goal: 이어서 채운 날 · 최고 기록, 한국어 기본은 1,000자', () => {
  const { host, state } = makeHost();
  assert.deepStrictEqual(host.goals.config(), { on: true, unit: 'chars', target: 1000 });
  const now = new Date(2026, 9, 19, 12);
  const d = (n) => goalsMod.GOAL_DEFAULT && require(path.join(src, 'core/usage')).dayOf(new Date(2026, 9, 19 - n));
  state.set({ goalLog: { [d(1)]: 1000, [d(2)]: 1000, [d(4)]: 1000 } });
  const s = host.goals.streaks(now);
  assert.strictEqual(s.current, 2, '오늘 아직이면 어제까지');
  assert.strictEqual(s.best, 2);
  assert.strictEqual(s.total, 3);
});

test('focus: 시작하면 방해 금지 + 머리 위 시간, 끝나면 축하 · 코인 · XP, 방해 금지는 풀린다', () => {
  const { host, sent, state } = makeHost();
  const t0 = Date.now();
  host.focusStart(25);
  assert.ok(host.isQuiet(), '집중하는 동안 방해 금지');
  assert.ok(sent.some(([ch, x]) => ch === 'pet:focus' && x && x.min === 25));
  assert.strictEqual(host.focusTick(t0 + 10 * 60_000), null, '아직');
  const coins0 = host.shop.wallet().balance;
  const r = host.focusTick(t0 + 25 * 60_000 + 1000);
  assert.strictEqual(r.min, 25);
  assert.strictEqual(host.shop.wallet().balance - coins0, 50);
  assert.ok(!host.isQuiet(), '끝나면 방해 금지도 끝');
  assert.ok(sent.some(([ch, x]) => ch === 'pet:bubble' && x.kind === 'focus' && /25/.test(x.text)), '끝 말풍선은 방해 금지여도 나온다');
  assert.ok(sent.some(([ch, x]) => ch === 'pet:focus' && x === null));
  assert.strictEqual(host.gamify.st.cnt.focus, 1);
  assert.deepStrictEqual(host.goals.focusTotal(), { sessions: 1, minutes: 25, today: 1, todayMin: 25, lastAt: host.goals.focusTotal().lastAt });
  assert.strictEqual(state.get('focus'), null);
});

test('focus: 그만두면 벌 없이 끝, 원래 켜 둔 방해 금지는 그대로 · 꺼져 있던 동안 끝난 건 상 없이 접는다', () => {
  const { host } = makeHost();
  host.setQuiet(180);
  host.focusStart(15);
  host.focusStop();
  assert.ok(host.isQuiet(), '원래 3시간 방해 금지는 남는다');
  host.setQuiet(0);
  const t0 = Date.now();
  host.focusStart(15);
  const coins0 = host.shop.wallet().balance;
  const r = host.focusTick(t0 + 15 * 60_000 + goalsMod.FOCUS_STALE + 60_000);
  assert.ok(r.stale);
  assert.strictEqual(host.shop.wallet().balance, coins0, '상 없음');
  assert.ok(!host.isQuiet());
  // 집중이 켠 방해 금지는 끝 시각이 어긋나도(시계 · 꺼졌다 켜짐) 집중과 함께 끝난다
  host.focusStart(25);
  const f = host.state.get('focus');
  host.state.set({ focus: { ...f, end: Date.now() - 1000 } });
  host.focusTick();
  assert.ok(!host.isQuiet(), '방해 금지도 같이 끝');
});

test('house:set: 목표 · 집중 시간은 아는 모양만', async () => {
  const { host, settings } = makeHost({ settings: { language: 'en' } });
  let p = await host.onInvoke('house:set', null, { goal: { on: true, unit: 'words', target: 500 } });
  assert.deepStrictEqual(p.goal.target, 500);
  await host.onInvoke('house:set', null, { goal: { unit: 'pages', target: -3, hack: 1 } });
  assert.deepStrictEqual(settings.get('goal'), { on: true, unit: 'words', target: 300 }, '모르는 단위 · 이상한 값은 기본으로');
  await host.onInvoke('house:set', null, { goal: { unit: 'chars', target: 10_000_000 } });
  assert.strictEqual(settings.get('goal').target, 100000, '상한');
  await host.onInvoke('house:set', null, { goal: 'lots' });
  assert.strictEqual(settings.get('goal').unit, 'chars', '객체가 아니면 무시');
  await host.onInvoke('house:set', null, { focusMin: 50 });
  assert.strictEqual(settings.get('focusMin'), 50);
  await host.onInvoke('house:set', null, { focusMin: 7 });
  assert.strictEqual(settings.get('focusMin'), 50, '15 · 25 · 50 만');
  p = await host.onInvoke('focus:start', null, 15);
  assert.strictEqual(p.focus.on, true);
  assert.strictEqual(p.focus.min, 15);
  p = await host.onInvoke('focus:stop');
  assert.strictEqual(p.focus.on, false);
});

test('첫날: 처음 만난 지 2시간 안에는 밥 알림 · 배고프다 조르기를 쉰다', () => {
  const { host, sent, settings } = makeHost();
  const now = new Date();
  const hh = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  settings.set({ lunchTime: hh(now), dinnerEnabled: false });
  host.brain.activity(Date.now());
  host.brain.tick();
  assert.ok(!sent.some(([ch, x]) => ch === 'pet:bubble' && x.kind === 'lunch'), '첫날 2시간은 조용');
  // 오래된 사용자는 그대로 알린다
  const old = makeHost({ state: { startedAt: Date.now() - 3 * 86_400_000 } });
  old.settings.set({ lunchTime: hh(now), dinnerEnabled: false });
  old.host.brain.activity(Date.now());
  old.host.brain.tick();
  assert.ok(old.sent.some(([ch, x]) => ch === 'pet:bubble' && x.kind === 'lunch'), '평소엔 점심 알림');
});

test('achievements: 목표 · 집중 · 할 일 업적 15개가 있고 묶음 이름이 세 언어 다 있다', () => {
  const ids = ACHIEVEMENTS.filter((a) => a.cat === 'focus').map((a) => a.id);
  assert.strictEqual(ids.length, 15);
  assert.ok(CATS.includes('focus'));
  for (const lang of ['ko', 'en', 'zh']) {
    assert.ok(I18N.UI[lang]['ach.cat.focus'], lang);
    for (const id of ids) assert.ok(I18N.UI[lang][`ach.${id}.name`] && I18N.UI[lang][`ach.${id}.desc`], `${lang} ${id}`);
  }
});

/* ── 여러 기기 합치기 (1.5.1, plugin/sync.js) ── */

const { SyncBook, mergeData, sharedOf, same } = require(path.join(src, 'plugin/sync'));
const SYNC_T0 = new Date(2026, 9, 19, 10).getTime();
const HOUR_MS = 3600_000;
const clone = (x) => structuredClone(x);
function devData() {
  const u = new UsageTracker();
  u.observe('일기/a.md', measure('a'.repeat(100)), new Date(SYNC_T0 - HOUR_MS), { baseline: true });
  return {
    version: 1,
    settings: { ...clone(DEFAULT_SETTINGS), petName: 'Kit', position: { x: 100, v: 3 } },
    state: {
      ...clone(STATE_DEFAULTS), walletSpent: 1000, walletBonus: 50, items: ['none', 'scarf'], pantry: { churu: 5 }, cnt: { goal: 3 },
      achievements: { write_1: 111 }, rewarded: { write_1: true }, lastLevel: 10, lastStage: 1,
      gauge: { food: 50, at: SYNC_T0, foodLockUntil: 0 }, life: { hungrySince: 0, fedAt: SYNC_T0 - HOUR_MS }, purchases: [{ at: 1, key: 'scarf', price: 500 }],
    },
    usage: u.data,
    meta: { scanned: true },
  };
}
// 노트를 쓴다 (기기 하나의 사용량에)
function write(data, file, chars, at) {
  const u = new UsageTracker(data.usage);
  u.observe(file, measure('a'.repeat(chars)), new Date(at));
  data.usage = u.data;
}

test('sync: 쉬던 기기는 다른 기기에서 한 것을 그대로 받고, 기기마다 따로인 칸(자리 · 방해 금지)은 그대로', () => {
  const A = new SyncBook('A', null);
  const a1 = A.stamp(devData(), SYNC_T0);
  // B 는 A 의 파일을 받아 이어서 썼다: 물건 · 코인 · 먹이 · 업적 · 글 · 옷
  const B = new SyncBook('B', clone(a1));
  const b1 = clone(a1);
  b1.state.items.push('wizard');
  b1.state.walletSpent += 500;
  b1.state.pantry.churu = 7;
  b1.state.achievements.write_100 = 222;
  b1.settings.outfit = { head: 'wizard' };
  b1.settings.position = { x: 900, v: 3 };
  write(b1, '일기/b.md', 300, SYNC_T0 + 60_000);
  B.stamp(b1, SYNC_T0 + 90_000);
  // A 는 그동안 쉬었다 (고양이 자리 · 방해 금지만 이 기기에서 바뀜)
  const local = clone(a1);
  local.settings.position = { x: 40, v: 3 };
  local.state.quietUntil = SYNC_T0 + HOUR_MS;
  const r = A.incoming(local, b1, SYNC_T0 + 100_000);
  assert.ok(r.exact, '공통 조상(A 의 판)을 안다');
  assert.ok(r.changed);
  assert.ok(same(sharedOf(r.merged), sharedOf(b1)), '공유 칸은 B 와 같다');
  assert.deepStrictEqual(r.merged.settings.position, { x: 40, v: 3 });
  assert.strictEqual(r.merged.state.quietUntil, SYNC_T0 + HOUR_MS);
  assert.strictEqual(new UsageTracker(r.merged.usage).totals().c, 300);
});

test('sync: 두 기기가 같이 바뀌면 코인 · 먹이 · 횟수 · 글은 양쪽 몫을 더하고, 물건 · 업적은 합집합, 노트 기록은 큰 쪽', () => {
  const A = new SyncBook('A', null);
  const a1 = A.stamp(devData(), SYNC_T0);
  const B = new SyncBook('B', clone(a1));
  const a2 = clone(a1);
  a2.state.walletSpent += 100;
  a2.state.items.push('glasses');
  a2.state.cnt.goal = 4;
  write(a2, '일기/a.md', 150, SYNC_T0 + 60_000); // a.md 100 → 150 (+50)
  A.stamp(a2, SYNC_T0 + 70_000);
  const b1 = clone(a1);
  b1.state.walletSpent += 300;
  b1.state.items.push('wizard');
  b1.state.cnt.goal = 5;
  b1.state.pantry.churu = 2; // 먹였다 (5 → 2)
  b1.state.achievements.goal_1 = 333;
  write(b1, '일기/b.md', 200, SYNC_T0 + 65_000); // 새 노트 200자
  B.stamp(b1, SYNC_T0 + 80_000);
  const r = A.incoming(clone(a2), b1, SYNC_T0 + 90_000);
  assert.ok(r.exact);
  const s = r.merged.state;
  assert.strictEqual(s.walletSpent, 1400, '1000 + 100 + 300');
  assert.deepStrictEqual(s.items, ['none', 'scarf', 'glasses', 'wizard']);
  assert.strictEqual(s.cnt.goal, 6, '3 + 1 + 2');
  assert.strictEqual(s.pantry.churu, 2, 'A 는 안 건드렸으니 B 값');
  assert.strictEqual(s.achievements.goal_1, 333);
  const u = new UsageTracker(r.merged.usage);
  assert.strictEqual(u.totals().c, 250, 'A 50자 + B 200자');
  assert.strictEqual(u.totals().n, 1);
  // 노트 기록이 둘 다 남아서, 어느 기기에서 다시 봐도 또 세지 않는다
  assert.strictEqual(u.observe('일기/a.md', measure('a'.repeat(150)), new Date()).dc, 0);
  assert.strictEqual(u.observe('일기/b.md', measure('a'.repeat(200)), new Date()).dc, 0);
});

test('sync: 공통 조상을 모르면(오래 오프라인 · 1.5.0 기기) 잃지 않는 쪽 — 횟수는 큰 쪽, 물건은 합집합, 설정은 내 것', () => {
  const local = devData();
  local.state.walletSpent = 1100;
  local.state.items.push('glasses');
  write(local, '일기/a.md', 150, SYNC_T0 + 60_000);
  // 1.5.0 기기: meta.sync 가 없다 → 사용량은 섞지 않는다 (그 기기는 이 기기의 글을 자기 것으로 다시 세었다)
  const old = devData();
  old.state.walletSpent = 1200;
  old.state.items.push('wizard');
  old.settings.petName = 'Mochi';
  write(old, '일기/a.md', 150, SYNC_T0 + 3 * HOUR_MS);
  const A = new SyncBook('A', null);
  A.stamp(clone(local), SYNC_T0);
  const r = A.incoming(clone(local), old);
  assert.ok(!r.exact && r.legacy);
  assert.strictEqual(r.merged.state.walletSpent, 1200);
  assert.deepStrictEqual(r.merged.state.items, ['none', 'scarf', 'glasses', 'wizard']);
  assert.strictEqual(r.merged.settings.petName, 'Kit');
  assert.ok(same(r.merged.usage, local.usage), '1.5.0 기기의 사용량은 안 섞는다');
  // 1.5.1 기기인데 내 판을 모른다 → 사용량은 시간대마다 큰 쪽 (더하면 같은 글을 두 번 셀 수 있다)
  const far = devData();
  write(far, '일기/c.md', 70, SYNC_T0 + 120_000); // 같은 10시대에 70자
  write(far, '일기/b.md', 200, SYNC_T0 + 3 * HOUR_MS); // 13시대에 200자
  far.meta = { sync: { A: 12345, C: 1 }, syncBy: 'C' };
  const r2 = A.incoming(clone(local), far);
  assert.ok(!r2.exact && !r2.legacy);
  assert.strictEqual(new UsageTracker(r2.merged.usage).totals().c, 270, '10시 max(50, 70) + 13시 200');
});

test('sync: 두 기기가 따로 같은 보상(업적 · 하루 목표)을 줬으면 보너스 XP 는 한 줄만, 집중 시간은 둘 다', () => {
  const l = devData();
  const r = devData();
  const ach = (at) => ({ at, xp: 50, why: { k: 'bonus.ach', v: { name: 'First letter' } } });
  const goal = (at) => ({ at, xp: 50, why: { k: 'bonus.goalW', v: { n: '300' } } });
  const focus = (at) => ({ at, xp: 25, why: { k: 'bonus.focus', v: { m: 25 } } });
  l.state.bonus = [ach(SYNC_T0), goal(SYNC_T0 + 1000), focus(SYNC_T0 + 2000)];
  r.state.bonus = [ach(SYNC_T0 + 500), goal(SYNC_T0 + 1500), focus(SYNC_T0 + 3000), goal(SYNC_T0 + 24 * HOUR_MS)];
  const m = mergeData(null, l, { ...r, meta: { sync: { B: 1 } } }, { now: SYNC_T0 });
  const kinds = m.state.bonus.map((x) => x.why.k);
  assert.strictEqual(kinds.filter((k) => k === 'bonus.ach').length, 1);
  assert.strictEqual(kinds.filter((k) => k === 'bonus.goalW').length, 2, '다른 날 목표는 따로');
  assert.strictEqual(kinds.filter((k) => k === 'bonus.focus').length, 2);
});

test('sync: 판 번호는 공유 칸이 바뀔 때만 오르고, 내 파일이 다시 와도(메아리) 아무것도 안 바뀐다', () => {
  const A = new SyncBook('A', null);
  const d = devData();
  A.stamp(d, 1000);
  assert.strictEqual(d.meta.sync.A, 1000);
  assert.strictEqual(d.meta.syncBy, 'A');
  A.stamp(d, 2000);
  d.settings.position = { x: 5, v: 3 };
  d.state.quietUntil = 99;
  d.state.gauge = { food: 10, at: 3000, foodLockUntil: 0 };
  A.stamp(d, 3000);
  assert.strictEqual(d.meta.sync.A, 1000, '자리 · 방해 금지 · 밥 게이지로는 안 오른다');
  d.state.items.push('x');
  A.stamp(d, 4000);
  assert.strictEqual(d.meta.sync.A, 4000);
  assert.strictEqual(A.incoming(clone(d), clone(d)).changed, false);
  // 켤 때: 내가 쓴 파일이면 그 판을 기억하고, 남이 쓴 파일이면 내용이 같아도 다음 저장에 새 판
  const mine = new SyncBook('A', clone(d));
  assert.strictEqual(mine.stamp(clone(d), 5000).meta.sync.A, 4000);
  const theirs = clone(d);
  theirs.meta.syncBy = 'B';
  assert.strictEqual(new SyncBook('A', theirs).stamp(clone(d), 6000).meta.sync.A, 6000);
});

test('sync: 밥 게이지는 지금 시각까지 줄여 많은 쪽, 마지막 끼니는 늦은 쪽, 하루 횟수는 늦은 날 쪽', () => {
  const l = devData();
  const r = devData();
  l.state.gauge = { food: 40, at: SYNC_T0, foodLockUntil: 0 };
  r.state.gauge = { food: 90, at: SYNC_T0 - HOUR_MS, foodLockUntil: 0 }; // 한 시간 전에 먹였다 → 지금 65
  l.state.life = { hungrySince: 0, fedAt: SYNC_T0 - 3 * HOUR_MS };
  r.state.life = { hungrySince: 0, fedAt: SYNC_T0 - HOUR_MS };
  Object.assign(l.state, { pokesDay: '2026-10-18', pokesToday: 9 });
  Object.assign(r.state, { pokesDay: '2026-10-19', pokesToday: 2 });
  const m = mergeData(null, l, { ...r, meta: { sync: { B: 1 } } }, { now: SYNC_T0 });
  assert.strictEqual(m.state.gauge.food, 65);
  assert.strictEqual(m.state.life.fedAt, SYNC_T0 - HOUR_MS);
  assert.strictEqual(m.state.pokesDay, '2026-10-19');
  assert.strictEqual(m.state.pokesToday, 2);
});

test('plugin: 다른 기기의 data.json 을 합치면 지갑 · 성장 · 밥 게이지가 바로 바뀌고, 이미 축하한 레벨 업은 다시 안 한다', async () => {
  const KitCommitPlugin = require(path.join(src, 'plugin/main'));
  // 두 시간 전에 만난 고양이 (정각 직후에 돌려도 30초 전 글이 '만나기 전'이 되지 않게)
  const { host, settings, state, usage, sent } = makeHost({ state: { startedAt: Date.now() - 2 * HOUR_MS } });
  const P = Object.create(KitCommitPlugin.prototype);
  Object.assign(P, { settings, state, usage, host, meta: { scanned: true }, started: true, manifest: { dir: 'p' }, saved: 0 });
  P.saveSoon = () => P.saved++;
  P.sync = new SyncBook('A', null);
  const mine = P.snapshot();
  P.sync.stamp(mine, Date.now() - 60_000);
  P.meta = mine.meta;
  // B: A 의 파일을 받아 3만 자를 쓰고, 마법사 모자를 사고, 밥을 먹였다. 레벨 업 축하는 B 에서 이미 했다
  const b = clone(mine);
  write(b, '일기/b.md', 30000, Date.now() - 30_000);
  b.state.items = [...(b.state.items || []), 'wizard'];
  b.state.walletSpent = (b.state.walletSpent || 0) + 500;
  b.state.gauge = { food: 95, at: Date.now(), foodLockUntil: 0 };
  b.state.lastLevel = 80;
  b.state.lastStage = 99;
  b.meta = { sync: { ...mine.meta.sync, B: Date.now() }, syncBy: 'B' };
  P.app = { vault: { adapter: fakeAdapter({ 'p/data.json': JSON.stringify(b) }) } };
  const before = { spent: host.shop.wallet().spent, xp: host.growth.xp };
  sent.length = 0;
  await P.onExternalSettingsChange();
  assert.ok(state.get('items').includes('wizard'));
  assert.strictEqual(host.shop.wallet().spent, before.spent + 500);
  assert.ok(host.growth.xp >= before.xp + 3000, '3만 자 = 3,000 XP');
  assert.ok(host.gauge.get().food >= 94);
  assert.ok(sent.some(([ch]) => ch === 'pet:config'));
  assert.ok(!sent.some(([ch, x]) => ch === 'pet:bubble' && x && x.kind === 'grow'), '레벨 업 축하를 다시 안 한다');
  assert.strictEqual(P.saved, 1);
  assert.ok('p/data.premerge.json' in P.app.vault.adapter.files, '합치기 전 자료를 남긴다');
  // 내가 저장한 파일이 다시 오면(메아리) 아무것도 안 한다
  const echo = P.snapshot();
  P.sync.stamp(echo);
  P.meta = echo.meta;
  P.app.vault.adapter.files['p/data.json'] = JSON.stringify(echo);
  await P.onExternalSettingsChange();
  assert.strictEqual(P.saved, 1);
});

test('plugin: 다른 기기의 data.json 을 아직 못 합쳤으면 저장이 덮어쓰지 않고 먼저 합친다', async () => {
  const KitCommitPlugin = require(path.join(src, 'plugin/main'));
  const hadWindow = 'window' in globalThis;
  globalThis.window = globalThis;
  try {
    const { host, settings, state, usage } = makeHost();
    const files = {};
    const ver = {};
    const adapter = {
      files,
      exists: async (f) => f in files,
      read: async (f) => files[f],
      write: async (f, t) => {
        files[f] = t;
        ver[f] = (ver[f] || 0) + 1;
      },
      stat: async (f) => (f in files ? { mtime: ver[f], size: files[f].length } : null),
    };
    const P = Object.create(KitCommitPlugin.prototype);
    Object.assign(P, { settings, state, usage, host, meta: { scanned: true }, started: true, manifest: { dir: 'p' }, app: { vault: { adapter } } });
    P.saveSoon = () => {};
    P.saveData = (d) => adapter.write('p/data.json', JSON.stringify(d));
    P.sync = new SyncBook('A', null);
    await P.saveNow();
    // 다른 기기가 물건을 사고 data.json 을 썼다. 이 기기에는 아직 소식(onExternalSettingsChange)이 안 왔다
    const b = JSON.parse(files['p/data.json']);
    b.state.items = [...(b.state.items || []), 'wizard'];
    b.meta = { ...b.meta, sync: { ...b.meta.sync, B: Date.now() }, syncBy: 'B' };
    await adapter.write('p/data.json', JSON.stringify(b));
    await P.saveNow();
    const disk = JSON.parse(files['p/data.json']);
    assert.ok(disk.state.items.includes('wizard'), '저장하기 전에 합쳤다');
    assert.strictEqual(disk.meta.syncBy, 'A');
    assert.ok(disk.meta.sync.B, '상대 판도 적었다');
    // 켜는 중(볼트 읽는 중)이면 합칠 수 없으니 저장을 미룬다
    await adapter.write('p/data.json', JSON.stringify({ ...b, state: { ...b.state, items: ['none', 'crown'] } }));
    host.loading = true;
    let again = 0;
    P.saveSoon = () => again++;
    await P.saveNow();
    assert.strictEqual(again, 1);
    assert.ok(JSON.parse(files['p/data.json']).state.items.includes('crown'), '덮어쓰지 않았다');
    host.loading = false;
  } finally {
    if (!hadWindow) delete globalThis.window;
  }
});

test('plugin: 이 기기에서 쓰지 않은 노트 변화는 30초 기다렸다 세고, 그 사이 다른 기기 기록이 오면 다시 안 센다', () => {
  const KitCommitPlugin = require(path.join(src, 'plugin/main'));
  const self = { typed: new Map(), foreign: new Map() };
  const wait = (p, t) => KitCommitPlugin.prototype.foreignWait.call(self, p, t);
  const t0 = 1_000_000;
  assert.strictEqual(wait('a.md', t0), 30_000);
  assert.strictEqual(wait('a.md', t0 + 10_000), 20_000);
  assert.strictEqual(wait('a.md', t0 + 30_000), 0);
  assert.strictEqual(self.foreign.size, 0);
  self.typed.set('b.md', t0);
  assert.strictEqual(wait('b.md', t0 + 1000), 0, '이 기기 편집기에서 쓴 노트는 바로');
  assert.strictEqual(wait('b.md', t0 + 3 * 60_000), 30_000, '오래전에 손댄 노트면 다시 기다린다');
  // 기다리는 동안 다른 기기의 data.json 이 와서 합쳐졌다 → 그 기기가 센 300자는 여기서 0
  const mine = { settings: {}, state: {}, usage: new UsageTracker().data };
  new UsageTracker(mine.usage).observe('일기/a.md', measure('a'.repeat(100)), new Date(), { baseline: true });
  const other = clone(mine);
  write(other, '일기/a.md', 400, Date.now());
  const merged = mergeData(null, mine, { ...other, meta: { sync: { B: 1 } } });
  const u = new UsageTracker(merged.usage);
  assert.strictEqual(u.observe('일기/a.md', measure('a'.repeat(400)), new Date(), { cap: 3000 }).dc, 0);
  assert.strictEqual(u.totals().c, 300, '다른 기기가 센 300자를 한 번만');
});

(async () => {
  let fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('✓', t.name);
    } catch (e) {
      fail++;
      console.log('✗', t.name, '\n   ', e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n    ') : e);
    }
  }
  console.log(`\n${tests.length - fail} / ${tests.length} passed`);
  process.exit(fail ? 1 : 0);
})();
