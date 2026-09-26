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

function makeHost() {
  const saves = [];
  const settings = new Store({}, DEFAULT_SETTINGS, () => saves.push(1));
  const state = new Store({}, STATE_DEFAULTS, () => saves.push(1));
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
