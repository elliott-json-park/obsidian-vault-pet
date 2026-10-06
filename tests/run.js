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
const fakeObsidian = { Menu: FakeMenu, Notice: class {}, setIcon() {}, Plugin: class {}, ItemView: class {}, PluginSettingTab: class {}, Setting: class {}, TFile: class {}, TFolder: class {}, addIcon() {} };
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
  assert.deepStrictEqual(measure(''), { chars: 0, links: 0, tag: 0, task: 0, done: 0, head: 0, embed: 0, callout: 0 });
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
    for (const lang of ['ko', 'en']) {
      assert.ok(I18N.UI[lang][`ach.${a.id}.name`], `${lang} ach.${a.id}.name`);
      assert.ok(I18N.UI[lang][`ach.${a.id}.desc`], `${lang} ach.${a.id}.desc`);
    }
  }
  for (const c of CATS) for (const lang of ['ko', 'en']) assert.ok(I18N.UI[lang]['ach.cat.' + c], `${lang} ach.cat.${c}`);
});

test('i18n: 퀘스트·홈·설정 글에 Claude·토큰 이야기가 안 남았다', () => {
  const keys = ['quest.chars', 'quest.links', 'quest.notes', 'quest.sessions', 'quest.opens', 'home.todayChars', 'shop.sub', 'shop.rate', 'dash.sub', 'mood.thinking', 'mood.waiting', 'slot.workSub', 'slot.doneSub', 'set.projectsSub', 'w.body1', 'w.privacy', 'card.headline', 'card.shareText', 'tray.today'];
  for (const lang of ['ko', 'en']) {
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
  for (const k of ['settings', 'growth', 'today', 'game', 'shop', 'stats', 'vault', 'motion', 'gauge', 'treasures', 'workshop', 'friends', 'projects', 'formula']) assert.ok(d[k] !== undefined, k);
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

test('host: 프리미엄 음식 — 고정·보물·업적 횟수, 먹이에 쓴 코인', async () => {
  const { host } = makeHost();
  host.shop.state.set({ walletBonus: 100000 });
  for (const key of ['royalTable', 'goldMouseChoco', 'mysteryBox']) assert.ok((await host.onInvoke('shop:buy', null, key)).ok, key);
  assert.ok(host.gamify.st.cnt.foodSpent > 0);
  host.onSend('pet:treat-eaten', null, 'royalTable');
  assert.ok(host.gauge.locked('food') && host.gauge.locked('energy'), '수라상은 배부름·기운 8시간 고정');
  const before = host.treasures.summary().kinds;
  host.onSend('pet:treat-eaten', null, 'goldMouseChoco');
  assert.ok(host.treasures.summary().kinds >= before);
  host.onSend('pet:treat-eaten', null, 'mysteryBox');
  assert.strictEqual(host.gamify.st.cnt.premium, 3);
  assert.strictEqual(host.gamify.st.cnt.pf_royalTable, 1);
});

test('host: 놀다가 기운이 10 이하로 떨어지면 한 번만 세고 놀이를 접는다', async () => {
  const { host } = makeHost();
  const toy = host.shop.summary().toy.find((x) => !x.locked);
  host.shop.state.set({ walletBonus: 100000 });
  assert.ok((await host.onInvoke('shop:buy', null, toy.key)).ok);
  assert.ok((await host.onInvoke('house:play', null, toy.key)).on);
  host.gauge.g.energy = 11;
  host.gauge.g.food = 100;
  host.onSend('pet:caught');
  host.onSend('pet:caught');
  assert.strictEqual(host.gamify.st.cnt.bored, 1, '지쳐서 그만둔 횟수는 한 번만');
  assert.ok(host.playing && host.playing.ending);
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

test('legacy: 뜻이 같은 설정만 옮기고, 뺀 폴더는 맨 윗단 해시로', () => {
  const s = legacyMod.legacySettings(oldData(Date.now()));
  assert.strictEqual(s.language, 'en');
  assert.strictEqual(s.soundEnabled, false);
  assert.strictEqual(s.lunchTime, '12:10');
  assert.ok(!('theme' in s) && !('showWidget' in s));
  const u = new UsageTracker();
  const ids = u.projects(['Templates']).map((p) => p.id);
  assert.deepStrictEqual([...s.excludedProjects].sort(), [...ids].sort(), '하위 폴더(Journal/Private)만 뺀 것은 맨 윗단 전체로 넓히지 않는다');
  assert.strictEqual(legacyMod.legacySummary(oldData(Date.now())).partialFolders, 1);
  for (const lang of ['ko', 'en']) assert.ok(I18N.UI[lang]['legacy.folders'].includes('{n}'), lang);
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
  for (const lang of ['ko', 'en']) {
    assert.ok(I18N.UI[lang]['item.' + legacyMod.LEGACY_COSTUME], lang + ' item name');
    for (const k of ['title', 'thanks', 'body', 'coins', 'costume', 'note', 'ok', 'wear']) assert.ok(I18N.UI[lang]['legacy.' + k], `${lang} legacy.${k}`);
  }
});

test('host: 처음 만난 날은 쓰다듬기 싫은 날이 아니다', () => {
  const orig = Math.random;
  Math.random = () => 0.999; // 평소라면 맨 끝(grumpy)을 뽑는 값
  try {
    const { host, state } = makeHost();
    state.data.temper = undefined;
    assert.notStrictEqual(host.temper(), 'grumpy');
    state.data.temper = { day: 'Mon Jan 01 2001', key: 'calm', said: true };
    assert.strictEqual(host.temper(), 'grumpy');
  } finally {
    Math.random = orig;
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
  for (const lang of ['ko', 'en']) {
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
  for (const lang of ['ko', 'en']) assert.ok(I18N.UI[lang]['motion.bubbleplay'], lang);
  // 예전 저장: 장난감 'bubbles' 를 샀고 모션 자리에 'bubbles' 를 끼워 뒀다
  const { host, settings, state } = makeHost({ state: { items: ['bubbles'] }, settings: { idleMotions: ['bubbles', 'loaf'], motions: { done: ['bubbles'] } } });
  assert.ok(state.get('items').includes('bubbleplay'));
  assert.deepStrictEqual(settings.get('idleMotions').slice(0, 1), ['bubbleplay']);
  assert.deepStrictEqual(settings.get('motions').done, ['bubbleplay']);
  // 새로 사는 사람은 장난감만
  const fresh = makeHost();
  fresh.host.shop.state.set({ walletBonus: 100000 });
  assert.strictEqual(fresh.host.shop.blocker('bubbleplay'), null, '모션은 레벨 제한 없이 350코인');
  const before = fresh.host.shop.wallet().balance;
  assert.ok((await fresh.host.onInvoke('shop:buy', null, 'bubbleplay')).ok);
  assert.strictEqual(before - fresh.host.shop.wallet().balance, 350);
  assert.strictEqual(fresh.host.shop.owned('bubbles'), false, '모션을 사도 장난감은 안 생긴다');
  fresh.host.migrateShop();
  assert.strictEqual(fresh.host.shop.owned('bubbles'), false);
  assert.ok(host);
});

/* ── 1.2.4 ── */

test('gauge: 고정 음식을 먹고 오래 꺼 둬도, 고정이 끝난 뒤의 시간만큼은 준다 (24시간 상한)', () => {
  const { Gauge } = require(path.join(src, 'core/gauge'));
  const HOUR = 3600e3;
  const t0 = Date.UTC(2026, 9, 1);
  const st = new Store({ gauge: { food: 100, energy: 100, at: t0, foodLockUntil: t0 + 24 * HOUR, energyLockUntil: t0 + 24 * HOUR } }, {}, () => {});
  const g = new Gauge(st);
  g.tick(false, t0 + 48 * HOUR);
  assert.ok(g.get().food < 100, '고정이 끝난 24시간 동안은 줄어야 한다');
  const free = new Gauge(new Store({ gauge: { food: 100, energy: 100, at: t0 } }, {}, () => {}));
  free.tick(false, t0 + 24 * HOUR);
  assert.strictEqual(g.get().food, free.get().food, '고정 뒤 24시간 = 고정 없이 24시간');
  const locked = new Gauge(new Store({ gauge: { food: 100, energy: 100, at: t0, foodLockUntil: t0 + 24 * HOUR } }, {}, () => {}));
  locked.tick(false, t0 + 10 * HOUR);
  assert.strictEqual(locked.get().food, 100, '고정 동안은 그대로');
});

test('achievements: 보상 코스튬이 두 업적에 겹치지 않는다', () => {
  const items = ACHIEVEMENTS.map((a) => a.reward && a.reward.item).filter(Boolean);
  assert.strictEqual(new Set(items).size, items.length, items.filter((x, i) => items.indexOf(x) !== i).join(','));
});

/* ── 1.2.5 ── */

test('styles: 테마가 iframe 에 칠하는 배경·테두리·그림자를 펫 iframe 이 이긴다 (Retroma, 이슈 #3)', () => {
  const css = require('fs').readFileSync(path.join(src, 'plugin/styles.css'), 'utf8');
  const m = css.match(/iframe\.kitcommit-frame\s*\{([^}]*)\}/);
  assert.ok(m, 'iframe.kitcommit-frame 규칙이 있어야 한다');
  for (const p of ['background: transparent', 'border: 0', 'border-radius: 0', 'box-shadow: none']) {
    assert.ok(m[1].includes(`${p} !important`), p);
  }
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
