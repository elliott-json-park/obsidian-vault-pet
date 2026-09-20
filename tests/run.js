'use strict';

/*
 * 옵시디언 없이 main.js 의 순수 로직을 검사한다.
 *   node tests/run.js
 */

const Module = require('module');
const path = require('path');
const assert = require('assert');

// main.js 가 require('obsidian') 하는 순간 가짜를 돌려준다.
const Fake = class {};
const fake = {
  Plugin: Fake, ItemView: Fake, Modal: Fake, Setting: Fake, PluginSettingTab: Fake, Notice: Fake, Menu: Fake,
  TFile: Fake, TFolder: Fake, MarkdownRenderChild: Fake, normalizePath: (p) => p, addIcon: () => {},
};
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'obsidian') return fake;
  return origLoad.call(this, request, parent, isMain);
};
global.window = { localStorage: { getItem: () => 'ko' } };

const I = require(path.join(__dirname, '..', 'main.js')).__internals;
I.setLang('ko');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const settings = (over = {}) => ({ ...I.DEFAULT_SETTINGS, petName: '잉키', ...over });

/* ── 세기 ── */

test('measure: 공백·마크다운 기호를 빼고 글자를 센다', () => {
  assert.deepStrictEqual(I.measure('# 제목\n\n안녕 하세요 **굵게**'), { chars: 9, links: 0 });
  assert.deepStrictEqual(I.measure(''), { chars: 0, links: 0 });
  assert.deepStrictEqual(I.measure(null), { chars: 0, links: 0 });
});

test('measure: 프런트매터는 세지 않는다', () => {
  const m = I.measure('---\ntags: [a, b]\naliases: 긴별명\n---\n본문');
  assert.strictEqual(m.chars, 2);
  // 닫히지 않은 --- 는 본문이다
  assert.ok(I.measure('---\n그냥 글').chars > 2);
});

test('measure: 위키 링크·임베드·마크다운 링크를 센다', () => {
  const m = I.measure('[[노트 A]] 와 [[노트 B|별명]] 그리고 ![[그림.png]] [사이트](https://example.com) ![alt](a.png)');
  assert.strictEqual(m.links, 5);
});

test('measure: 코드 안의 링크는 세지 않지만 코드 글자는 센다', () => {
  const m = I.measure('```js\nconst a = "[[가짜]]";\n```\n`[[인라인]]` [[진짜]]');
  assert.strictEqual(m.links, 1);
  assert.ok(m.chars > 10);
  const tilde = I.measure('~~~\n[[x]]\n~~~\n[[y]]');
  assert.strictEqual(tilde.links, 1);
});

test('measure: URL 은 글자로 치지 않는다', () => {
  const a = I.measure('보기 https://example.com/a/very/long/path?x=1');
  assert.strictEqual(a.chars, 2);
  const b = I.measure('[여기](https://example.com/zzzzzzzzzzzzzzzz)');
  assert.strictEqual(b.chars, 2);
  assert.strictEqual(b.links, 1);
});

test('measure: 주석(%%)의 링크는 세지 않는다', () => {
  assert.strictEqual(I.measure('%% [[숨김]] %% [[보임]]').links, 1);
});

test('measure: Excalidraw 그림·이미지 데이터·코드 속 데이터 덩어리는 세지 않는다', () => {
  const ex = '---\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n---\n# Text Elements\n[[링크]]\n```compressed-json\nN4KAkARALgngDgUwgLgAQQQDwMYEMA2AlgCYBOuA7hADTgQBuCpAzoQPYB2KqATLZMzYBXUtiRoIACyhQ4zZAHoFAc0JRJQgEYA6bGwC2CgF7N6hbEcK4OCtptbErHALRY8RMpWdx\n```';
  assert.deepStrictEqual(I.measure(ex), { chars: 0, links: 0 });
  // 본문에서 excalidraw 를 말하는 것은 괜찮다
  assert.ok(I.measure('excalidraw-plugin: 이라고 쓰는 노트').chars > 5);
  const img = I.measure('그림 ![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==)');
  assert.strictEqual(img.chars, 2);
  const blob = I.measure('```json\n' + '{"a":1,'.repeat(400) + '\n```\n본문');
  assert.strictEqual(blob.chars, 2);
});

test('measure: 큰 노트도 빠르게 센다', () => {
  const para = '오늘은 [[노트]]를 쓰고 [링크](https://example.com) 도 걸었다. 아주 긴 문장이 계속 이어진다.\n';
  const big = para.repeat(20000); // 약 1.3MB
  const t0 = Date.now();
  const m = I.measure(big);
  const ms = Date.now() - t0;
  assert.strictEqual(m.links, 40000);
  assert.ok(ms < 1500, `${ms}ms`);
});

/* ── 장부 ── */

const when = new Date(2026, 8, 19, 14, 30);

test('Ledger: 새 노트는 10자 이상일 때 한 번만 센다', () => {
  const L = new I.Ledger();
  let r = L.observe('a.md', { chars: 3, links: 0 }, when);
  assert.deepStrictEqual(r, { dc: 3, dl: 0, dn: 0 });
  r = L.observe('a.md', { chars: 12, links: 1 }, when);
  assert.deepStrictEqual(r, { dc: 9, dl: 1, dn: 1 });
  r = L.observe('a.md', { chars: 30, links: 1 }, when);
  assert.deepStrictEqual(r, { dc: 18, dl: 0, dn: 0 });
  assert.deepStrictEqual(L.totals(), { c: 30, l: 1, n: 1 });
});

test('Ledger: 최고 기록보다 늘어난 만큼만 센다 (지우고 다시 쓰기로는 안 오른다)', () => {
  const L = new I.Ledger();
  L.observe('a.md', { chars: 100, links: 5 }, when);
  let r = L.observe('a.md', { chars: 20, links: 1 }, when);
  assert.deepStrictEqual(r, { dc: 0, dl: 0, dn: 0 });
  r = L.observe('a.md', { chars: 100, links: 5 }, when);
  assert.deepStrictEqual(r, { dc: 0, dl: 0, dn: 0 });
  r = L.observe('a.md', { chars: 130, links: 7 }, when);
  assert.deepStrictEqual(r, { dc: 30, dl: 2, dn: 0 });
});

test('Ledger: 큰 붙여넣기는 상한까지만, 나머지는 다시 세지 않는다', () => {
  const L = new I.Ledger();
  L.observe('a.md', { chars: 50, links: 0 }, when);
  let r = L.observe('a.md', { chars: 20050, links: 100 }, when, { cap: 3000, linkCap: 30 });
  assert.deepStrictEqual(r, { dc: 3000, dl: 30, dn: 0 });
  r = L.observe('a.md', { chars: 20060, links: 100 }, when, { cap: 3000, linkCap: 30 });
  assert.deepStrictEqual(r, { dc: 10, dl: 0, dn: 0 });
});

test('Ledger: 한꺼번에 들어온 변경은 전체 몫(budget)까지만', () => {
  const L = new I.Ledger();
  const budget = { ...I.FLUSH_BUDGET };
  let got = { c: 0, l: 0, n: 0 };
  for (let i = 0; i < 50; i++) {
    const r = L.observe(`imported/${i}.md`, { chars: 2000, links: 5 }, when, { cap: 3000, linkCap: 30, budget });
    got.c += r.dc; got.l += r.dl; got.n += r.dn;
  }
  assert.deepStrictEqual(got, { c: I.FLUSH_BUDGET.c, l: I.FLUSH_BUDGET.l, n: I.FLUSH_BUDGET.n });
  // 몫을 넘긴 파일도 최고 기록은 갱신돼서 나중에 다시 세지 않는다
  const r = L.observe('imported/49.md', { chars: 2000, links: 5 }, when);
  assert.deepStrictEqual(r, { dc: 0, dl: 0, dn: 0 });
});

test('Ledger: 이름을 바꿔도 기록이 따라간다 (폴더 포함)', () => {
  const L = new I.Ledger();
  L.observe('old/a.md', { chars: 40, links: 2 }, when);
  L.observe('old/sub/b.md', { chars: 40, links: 0 }, when);
  L.rename('old', 'new');
  assert.ok(L.has('new/a.md') && L.has('new/sub/b.md'));
  assert.ok(!L.has('old/a.md'));
  const r = L.observe('new/a.md', { chars: 40, links: 2 }, when);
  assert.deepStrictEqual(r, { dc: 0, dl: 0, dn: 0 });
  L.rename('new/a.md', 'c.md');
  assert.ok(L.has('c.md'));
});

test('Ledger: 폴더를 지우면 그 아래 기록만 지운다', () => {
  const L = new I.Ledger();
  for (const p of ['보관/a.md', '보관/깊이/b.md', '보관함.md', '일기.md']) L.observe(p, { chars: 40, links: 0 }, when);
  L.removeUnder('보관');
  assert.ok(!L.has('보관/a.md') && !L.has('보관/깊이/b.md'));
  assert.ok(L.has('보관함.md') && L.has('일기.md'));
});

test('Ledger: 남은 파일만 남기고 지워진 파일 기록을 치운다', () => {
  const L = new I.Ledger();
  for (const p of ['a.md', 'b.md', 'c/d.md']) L.observe(p, { chars: 40, links: 0 }, when);
  L.keepOnly(['a.md', 'c/d.md']);
  assert.ok(L.has('a.md') && L.has('c/d.md') && !L.has('b.md'));
});

test('Ledger: 저장한 데이터에는 볼트 경로가 남지 않는다', () => {
  const L = new I.Ledger();
  L.observe('비밀 폴더/올해 연봉 협상.md', { chars: 400, links: 2 }, when);
  const saved = JSON.stringify(L.d);
  assert.ok(!saved.includes('비밀 폴더'), saved);
  assert.ok(!saved.includes('올해 연봉 협상'), saved);
  assert.ok(!saved.includes('.md'), saved);
  // 같은 경로는 언제나 같은 열쇠로, 다른 경로는 다른 열쇠로
  assert.strictEqual(I.pathKey('a/b.md'), I.pathKey('a/b.md'));
  assert.notStrictEqual(I.pathKey('a/b.md'), I.pathKey('a/c.md'));
  // 해시한 뒤에도 경로 구조(깊이)만큼은 이어져 이름 바꾸기가 된다
  assert.strictEqual(I.pathKey('a/b/c.md').split('/').length, 3);
});

test('Ledger: 날짜·시간대·출석일', () => {
  const L = new I.Ledger();
  const d1 = new Date(2026, 8, 17, 2, 0);
  const d2 = new Date(2026, 8, 18, 9, 0);
  L.observe('a.md', { chars: 500, links: 3 }, d1);
  L.observe('b.md', { chars: 200, links: 0 }, d2);
  L.open(new Date(2026, 8, 19, 10, 0));
  assert.strictEqual(L.d.hours[2], 504);
  assert.strictEqual(L.maxDay(), 500);
  assert.deepStrictEqual([...L.activeDays()].sort(), ['2026-09-17', '2026-09-18', '2026-09-19']);
  const daily = L.daily(3, new Date(2026, 8, 19, 12));
  assert.deepStrictEqual(daily.map((d) => d.c), [500, 200, 0]);
  assert.deepStrictEqual(L.today(new Date(2026, 8, 18, 23)), { c: 200, l: 0, n: 1, o: 0 });
});

test('Ledger: 저장했다 불러와도 같다', () => {
  const L = new I.Ledger();
  L.observe('a.md', { chars: 500, links: 3 }, when);
  const L2 = new I.Ledger(JSON.parse(JSON.stringify(L.d)));
  assert.deepStrictEqual(L2.totals(), L.totals());
  assert.strictEqual(L2.observe('a.md', { chars: 500, links: 3 }, when).dc, 0);
  // 망가진 데이터도 받아준다
  const L3 = new I.Ledger({ hours: 'x' });
  assert.strictEqual(L3.hours().length, 24);
});

/* ── 성장 ── */

test('xpOf·levelOf', () => {
  assert.strictEqual(I.xpOf({ c: 1000, l: 10, n: 2 }), 50 + 50 + 30);
  assert.strictEqual(I.levelOf(0), 1);
  assert.strictEqual(I.levelOf(24), 1);
  assert.strictEqual(I.levelOf(25), 2);
  assert.strictEqual(I.levelOf(100), 3);
});

test('computeGrowth: 모드별', () => {
  const tot = { c: 200_000, l: 1000, n: 300 }; // 10,000 + 5,000 + 4,500 = 19,500
  const all = I.computeGrowth(I.newPet('inky', { mode: 'all' }), null, tot, () => 500);
  assert.strictEqual(all.xp, 20_000);
  assert.strictEqual(all.stageKey, 'child');
  assert.strictEqual(all.nextStageKey, 'teen');
  assert.ok(all.progress > 0 && all.progress < 1);

  const base = { c: 180_000, l: 1000, n: 300 };
  const fresh = I.computeGrowth(I.newPet('inky', { base, since: 1000 }), null, tot, (since) => (since === 1000 ? 7 : 999));
  assert.strictEqual(fresh.usageXp, 1000);
  assert.strictEqual(fresh.xp, 1007);
  assert.strictEqual(fresh.stageKey, 'baby');

  const stage = I.computeGrowth(I.newPet('inky', { mode: 'stage', base: tot, since: 1, startXp: 30_000 }), null, tot, () => 0);
  assert.strictEqual(stage.xp, 30_000);
  assert.strictEqual(stage.stageKey, 'teen');
  assert.strictEqual(stage.startXp, 30_000);

  const adult = I.computeGrowth(I.newPet('inky', { mode: 'all' }), null, { c: 4e6, l: 0, n: 0 }, () => 0);
  assert.strictEqual(adult.stageKey, 'adult');
  assert.strictEqual(adult.nextStageKey, null);
  assert.strictEqual(adult.progress, 1);

  // 쉬기 전에 모은 경험치(frozen)에 이어서 자란다
  const back = I.computeGrowth(I.newPet('inky', { frozen: 5000, base: base, since: 1 }), null, tot, () => 0);
  assert.strictEqual(back.frozenXp, 5000);
  assert.strictEqual(back.xp, 6000);
});

test('xpOf: 친구마다 특기 경험치가 붙는다', () => {
  const tot = { c: 20_000, l: 100, n: 10 }; // 1,000 + 500 + 150
  assert.strictEqual(I.xpOf(tot), 1650);
  assert.strictEqual(I.xpOf(tot, 'inky'), 1200 + 500 + 150); // 글자 +20%
  assert.strictEqual(I.xpOf(tot, 'purrl'), 1000 + 650 + 150); // 링크 +30%
  assert.strictEqual(I.xpOf(tot, 'ember'), 1000 + 500 + 225); // 새 노트 +50%
  assert.strictEqual(I.xpOf(tot, 'sprig'), 1650); // 출석은 보너스 쪽
  assert.strictEqual(I.xpOf(tot, 'dewey'), 1650); // 퀘스트도 보너스 쪽
});

test('swapPartner: 쉬는 친구는 자란 만큼 기억하고, 새 친구는 알부터', () => {
  const st = JSON.parse(JSON.stringify(I.DEFAULT_STATE));
  I.migrateParty(st, {});
  assert.strictEqual(st.partner, 'inky');
  const L = new I.Ledger();
  const bonus = () => 0;
  const grow = () => I.computeGrowth(st.party[st.partner], st.partner, L.totals(), bonus);
  L.observe('a.md', { chars: 40_000, links: 0 }, when); // 잉키: 2,000 × 1.2 + 새 노트 15
  assert.strictEqual(grow().xp, 2415);

  // 모닥이 알을 받는다
  let known = I.swapPartner(st, 'ember', grow(), L.totals(), 5000);
  assert.strictEqual(known, false);
  assert.strictEqual(st.partner, 'ember');
  assert.strictEqual(st.party.inky.frozen, 2415);
  assert.strictEqual(st.party.inky.best, 1);
  assert.strictEqual(grow().xp, 0);
  assert.strictEqual(grow().stageKey, 'egg');
  L.observe('b.md', { chars: 2000, links: 0 }, when); // 100XP + 새 노트 15 × 1.5
  assert.strictEqual(grow().xp, 100 + 23);

  // 잉키에게 돌아가면 2,415 에서 이어서 자란다
  known = I.swapPartner(st, 'inky', grow(), L.totals(), 6000);
  assert.strictEqual(known, true);
  assert.strictEqual(st.party.ember.frozen, 123);
  assert.strictEqual(grow().xp, 2415);
  L.observe('b.md', { chars: 4000, links: 0 }, when);
  assert.strictEqual(grow().xp, 2415 + 120);
  // 보너스는 다시 파트너가 된 뒤의 것만
  const g2 = I.computeGrowth(st.party.inky, 'inky', L.totals(), (since) => (since === 6000 ? 30 : 999));
  assert.strictEqual(g2.xp, 2415 + 120 + 30);
});

test('migrateParty: 0.1.x 데이터를 첫 친구로 옮긴다', () => {
  const st = JSON.parse(JSON.stringify(I.DEFAULT_STATE));
  st.colors = ['violet', 'clay', 'mint'];
  I.migrateParty(st, { petName: '몽글', color: 'violet', accessory: 'glasses', startMode: 'fresh', baseline: { c: 10, l: 1, n: 1 }, baselineAt: 1234 });
  assert.strictEqual(st.partner, 'inky');
  const p = st.party.inky;
  assert.strictEqual(p.name, '몽글');
  assert.strictEqual(p.color, 'natural');
  assert.strictEqual(p.accessory, 'glasses');
  assert.strictEqual(p.mode, 'fresh');
  assert.deepStrictEqual(p.base, { c: 10, l: 1, n: 1 });
  assert.strictEqual(p.since, 1234);
  assert.deepStrictEqual(st.colors, ['natural', 'clay', 'mint']);
  assert.strictEqual(st.picked, false);

  const st2 = JSON.parse(JSON.stringify(I.DEFAULT_STATE));
  I.migrateParty(st2, { startMode: 'stage', startStage: 3 });
  assert.strictEqual(st2.party.inky.startXp, 30_000);
  assert.strictEqual(st2.party.inky.name, '잉키');

  // 망가진 기록도 받아준다
  const st3 = { ...JSON.parse(JSON.stringify(I.DEFAULT_STATE)), partner: 'dragon', party: { ghost: {}, dewey: { name: '부' } }, colors: 'x' };
  I.migrateParty(st3, {});
  assert.strictEqual(st3.partner, 'dewey');
  assert.ok(!st3.party.ghost);
  assert.strictEqual(st3.party.dewey.color, 'natural');
  assert.strictEqual(st3.party.dewey.frozen, 0);
  assert.deepStrictEqual(st3.colors, ['natural']);
});
/* ── 저장 데이터 읽기: 설치한 순간부터 성장, 업데이트해도 그대로 ── */

// 저장 → 다시 읽기 (옵시디언이 data.json 을 쓰고 읽는 것과 같게 JSON 으로)
const roundTrip = (r) => I.loadSaved(JSON.parse(JSON.stringify({ schema: I.DATA_SCHEMA, settings: r.settings, state: r.st, ledger: r.ledger.d })));
const growthOfLoaded = (r) => I.computeGrowth(r.st.party[r.st.partner], r.st.partner, r.ledger.totals(), (since) => r.st.bonus.filter((b) => b.at >= since).reduce((a, b) => a + b.xp, 0));

test('loadSaved: 새로 설치하면 알부터, 설치한 순간부터 센다', () => {
  const r = I.loadSaved(null, 5000);
  assert.strictEqual(r.fresh, true);
  assert.strictEqual(r.st.installedAt, 5000);
  assert.strictEqual(r.settings.theme, 'system');
  const pet = r.st.party[r.st.partner];
  assert.strictEqual(r.st.partner, 'inky');
  assert.strictEqual(pet.mode, 'fresh');
  assert.strictEqual(pet.since, 5000);
  assert.strictEqual(pet.name, '잉키');
  assert.strictEqual(r.st.picked, false);
  assert.strictEqual(r.st.onboarded, false);

  // 설치할 때 이미 있던 노트: 크기만 기억하고 세지 않는다
  const L = r.ledger;
  assert.deepStrictEqual(L.observe('old.md', { chars: 50_000, links: 120 }, when, { baseline: true }), { dc: 0, dl: 0, dn: 0 });
  assert.deepStrictEqual(L.observe('short.md', { chars: 5, links: 0 }, when, { baseline: true }), { dc: 0, dl: 0, dn: 0 });
  assert.deepStrictEqual(L.totals(), { c: 0, l: 0, n: 0 });
  assert.strictEqual(Object.keys(L.d.days).length, 0);
  const g0 = growthOfLoaded(r);
  assert.strictEqual(g0.xp, 0);
  assert.strictEqual(g0.stageKey, 'egg');
  // 그 노트에 이어 쓰면 늘어난 만큼만 센다. 이미 있던 노트는 새 노트가 아니다
  assert.deepStrictEqual(L.observe('old.md', { chars: 50_200, links: 121 }, when), { dc: 200, dl: 1, dn: 0 });
  // 짧던 노트가 10자를 넘으면 그때 새 노트로 센다
  assert.deepStrictEqual(L.observe('short.md', { chars: 30, links: 0 }, when), { dc: 25, dl: 0, dn: 1 });
  assert.strictEqual(growthOfLoaded(r).xp, Math.floor((225 / 20) * 1.2) + 5 + 15);
});

test('loadSaved: 0.1 데이터를 읽어도 성장·업적·아이템·기록이 하나도 줄지 않는다', () => {
  const days = { '2026-09-01': { c: 3000, l: 5, n: 1, o: 3 }, '2026-09-18': { c: 1200, l: 2, n: 0, o: 1 } };
  const v01 = {
    settings: {
      petName: '몽글', language: 'ko', showWidget: true, scale: 3, widgetPos: { right: 375, bottom: 557 }, accessory: 'quill', color: 'midnight',
      startMode: 'all', startStage: 0, baselineAt: 0, baseline: null, excludedFolders: ['Templates'], lunchTime: '12:10',
    },
    state: {
      pokes: 64, questsDone: 17, maxStreakMin: 150, onboarded: true, initialized: true, scanned: true, lastLevel: 40, lastStage: 3,
      achievements: { first_note: 3000, chars_100k: 9000 }, bonus: [{ at: 2000, xp: 50, why: ['badge', 'first_note'] }, { at: 8000, xp: 300, why: ['badge', 'chars_100k'] }],
      items: ['none', 'sprout', 'quill'], colors: ['violet', 'clay', 'midnight'], seen: ['i:quill'],
    },
    ledger: { files: { 'a.md': [494442, 1266, 1, 1] }, days, hours: new Array(24).fill(1), tot: { c: 494_442, l: 1266, n: 166 } },
  };
  const before = JSON.parse(JSON.stringify(v01));
  const oldXp = I.xpOf(v01.ledger.tot) + 350; // 0.1 이 보여 주던 경험치
  const r = I.loadSaved(JSON.parse(JSON.stringify(v01)), 99_000);
  assert.strictEqual(r.fresh, false);
  // 설정: 펫 정보만 친구 기록으로 옮기고 나머지는 그대로
  assert.deepStrictEqual(r.settings.widgetPos, { right: 375, bottom: 557 });
  assert.strictEqual(r.settings.scale, 3);
  assert.strictEqual(r.settings.lunchTime, '12:10');
  assert.deepStrictEqual(r.settings.excludedFolders, ['Templates']);
  for (const k of ['petName', 'color', 'accessory', 'startMode', 'baseline']) assert.ok(!(k in r.settings), k);
  // 펫
  const pet = r.st.party.inky;
  assert.strictEqual(pet.name, '몽글');
  assert.strictEqual(pet.color, 'midnight');
  assert.strictEqual(pet.accessory, 'quill');
  assert.strictEqual(pet.mode, 'all');
  assert.strictEqual(pet.base, null);
  // 기록·업적·아이템
  assert.deepStrictEqual(r.ledger.totals(), before.ledger.tot);
  assert.deepStrictEqual(r.ledger.d.days, before.ledger.days);
  assert.deepStrictEqual(r.ledger.d.files, { [I.pathKey('a.md')]: before.ledger.files['a.md'] });
  assert.ok(!('a.md' in r.ledger.d.files)); // 예전 데이터의 경로도 해시로 옮긴다
  assert.strictEqual(r.ledger.mtimeOf('a.md'), 1);
  assert.deepStrictEqual(r.st.achievements, before.state.achievements);
  assert.deepStrictEqual(r.st.bonus, before.state.bonus);
  assert.deepStrictEqual(r.st.items, before.state.items);
  assert.deepStrictEqual(r.st.colors, ['natural', 'clay', 'midnight']);
  assert.strictEqual(r.st.pokes, 64);
  assert.strictEqual(r.st.questsDone, 17);
  assert.strictEqual(r.st.scanned, true);
  assert.strictEqual(r.st.onboarded, true);
  assert.strictEqual(r.st.installedAt, 2000); // 처음 받은 보너스 때로 짐작
  // 성장: 줄지 않는다 (잉키 특기로 오히려 조금 늘어난다)
  const g = growthOfLoaded(r);
  assert.ok(g.xp >= oldXp, `${g.xp} < ${oldXp}`);
  // 한 번 더 저장하고 읽어도 똑같다
  const r2 = roundTrip(r);
  assert.deepStrictEqual(r2.st, r.st);
  assert.deepStrictEqual(r2.settings, r.settings);
  assert.strictEqual(growthOfLoaded(r2).xp, g.xp);
});

test('loadSaved: 0.2 데이터는 친구들과 성장이 그대로 이어진다', () => {
  const st = JSON.parse(JSON.stringify(I.DEFAULT_STATE));
  I.migrateParty(st, {});
  const L = new I.Ledger();
  L.observe('a.md', { chars: 40_000, links: 20 }, when);
  const grow = () => I.computeGrowth(st.party[st.partner], st.partner, L.totals(), () => 0);
  I.swapPartner(st, 'purrl', grow(), L.totals(), 5000);
  L.observe('b.md', { chars: 8000, links: 30 }, when);
  st.party.purrl.accessory = 'scarf';
  st.onboarded = st.picked = st.scanned = st.initialized = true;
  delete st.installedAt;
  const v02 = JSON.parse(JSON.stringify({ settings: { language: 'ko', roam: false, scale: 2 }, state: st, ledger: L.d }));
  const xpBefore = grow().xp;
  const r = I.loadSaved(v02, 99_000);
  assert.strictEqual(r.st.partner, 'purrl');
  assert.deepStrictEqual(r.st.party, v02.state.party);
  assert.strictEqual(r.settings.roam, false);
  assert.strictEqual(r.settings.theme, 'system');
  assert.strictEqual(growthOfLoaded(r).xp, xpBefore);
  assert.strictEqual(r.st.party.inky.frozen, v02.state.party.inky.frozen);
  assert.strictEqual(roundTrip(r).st.party.purrl.accessory, 'scarf');
});

test('loadSaved: 이상한 값도 받아준다', () => {
  const r = I.loadSaved({ settings: { theme: 'neon' }, state: { party: 'x', colors: null }, ledger: { hours: 'x' } }, 7);
  assert.strictEqual(r.settings.theme, 'system');
  assert.strictEqual(r.st.partner, 'inky');
  assert.deepStrictEqual(r.st.colors, ['natural']);
  assert.strictEqual(r.ledger.hours().length, 24);
  assert.ok(I.THEMES.includes(I.DEFAULT_SETTINGS.theme));
});

/* ── 게임 ── */

function newGame(over = {}) {
  const st = JSON.parse(JSON.stringify(I.DEFAULT_STATE));
  const L = new I.Ledger();
  const s = settings(over);
  let saves = 0;
  const g = new I.Gamify(st, L, () => s, () => saves++, () => ({ maxBacklinks: 0 }));
  return { st, L, s, g, saves: () => saves };
}

test('quests: 날마다 3개, 같은 날엔 같은 퀘스트', () => {
  const { g } = newGame();
  const d = new Date(2026, 8, 19, 12);
  const a = g.quests(d);
  const b = g.quests(d);
  assert.strictEqual(a.length, 3);
  assert.deepStrictEqual(a.map((q) => q.id), b.map((q) => q.id));
  assert.strictEqual(new Set(a.map((q) => q.type)).size, 3);
  // 밥 알림을 다 끄면 밥 퀘스트는 안 나온다
  const { g: g2 } = newGame({ lunchEnabled: false, dinnerEnabled: false });
  for (let i = 0; i < 60; i++) {
    const qs = g2.quests(new Date(2026, 0, 1 + i, 12));
    assert.ok(!qs.some((q) => q.type === 'meal'));
  }
});

test('quests: 오늘 쓴 만큼 진행되고, 달성하면 자동으로 보상', () => {
  // 글자 퀘스트가 나오는 날을 찾는다
  let day = null;
  for (let i = 0; i < 60 && !day; i++) {
    const d = new Date(2026, 8, 1 + i, 12);
    const { g } = newGame();
    if (g.quests(d).some((q) => q.type === 'chars')) day = d;
  }
  assert.ok(day, '60일 안에 글자 퀘스트가 한 번은 나와야 한다');
  const { g, L, st } = newGame();
  const q = g.quests(day).find((x) => x.type === 'chars');
  L.observe('a.md', { chars: q.target + 5, links: 0 }, day);
  const q2 = g.quests(day).find((x) => x.type === 'chars');
  assert.strictEqual(q2.value, q.target);
  assert.ok(q2.done);
  assert.ok(q2.text.includes('자 쓰기'));
  // evaluate 는 오늘 날짜로 판단하므로 오늘 날짜로 다시 만든다
  const today = new Date();
  const t2 = newGame();
  const qt = t2.g.quests(today);
  const target = qt.find((x) => x.type === 'chars');
  if (target) {
    t2.L.observe('a.md', { chars: target.target, links: 0 }, today);
    t2.st.initialized = true;
    const events = [];
    t2.g.on('unlock', (e) => events.push(e));
    t2.g.evaluate({ level: 1, stageIndex: 0 });
    assert.ok(events.some((e) => e.type === 'quest' && e.quest.type === 'chars'));
    assert.strictEqual(t2.st.questsDone, 1);
  }
  assert.ok(st.questClaimed.length === 0);
});

test('achievements: 첫 실행은 조용히 소급하고 한 번에 알려준다', () => {
  const { g, L, st } = newGame();
  L.observe('a.md', { chars: 20_000, links: 150 }, new Date(2026, 8, 1, 3));
  const unlocks = [];
  let retro = null;
  g.on('unlock', (e) => unlocks.push(e));
  g.on('retro', (e) => (retro = e));
  g.evaluate({ level: 12, stageIndex: 2 }, true);
  assert.strictEqual(unlocks.length, 0);
  for (const id of ['first_note', 'chars_10k', 'links_100', 'night_owl', 'lv_10', 'stage_child']) assert.ok(st.achievements[id], id);
  assert.ok(!st.achievements.chars_100k);
  g.finishInit();
  assert.ok(st.initialized);
  assert.ok(retro && retro.some((e) => e.type === 'achievement'));
  // 레벨로 열리는 아이템·색깔
  assert.ok(st.items.includes('sprout') && st.items.includes('ribbon'));
  assert.ok(!st.items.includes('glasses'));
  assert.ok(st.colors.includes('clay'));
  assert.ok(st.colors.includes('mint')); // Lv.12
  assert.ok(!st.colors.includes('peach')); // Lv.18
  // 업적으로 열리는 아이템
  assert.ok(st.items.includes('nightcap'));
  // 보너스가 쌓였다
  assert.ok(g.bonusXp(0) >= 50 + 100 + 100 + 100 + 100 + 150);
  // 두 번째부터는 알림이 온다
  L.observe('b.md', { chars: 100_000, links: 0 }, new Date());
  g.evaluate({ level: 12, stageIndex: 2 });
  assert.ok(unlocks.some((e) => e.type === 'achievement' && e.achievement.id === 'chars_100k'));
  assert.ok(unlocks.some((e) => e.type === 'item' && e.item.key === 'quill'));
});

test('achievements: 허브 노트는 백링크 수로', () => {
  const st = JSON.parse(JSON.stringify(I.DEFAULT_STATE));
  const g = new I.Gamify(st, new I.Ledger(), () => settings(), () => {}, () => ({ maxBacklinks: 21 }));
  g.evaluate({ level: 1, stageIndex: 0 }, true);
  assert.ok(st.achievements.hub);
});

test('streaks: 연속 출석 계산', () => {
  const { g, L } = newGame();
  const now = new Date(2026, 8, 19, 12);
  for (const d of [15, 16, 17, 18]) L.open(new Date(2026, 8, d, 9));
  L.open(new Date(2026, 8, 10, 9));
  let s = g.streaks(now);
  assert.strictEqual(s.current, 4); // 오늘은 아직이라 어제까지
  assert.strictEqual(s.best, 4);
  assert.strictEqual(s.total, 5);
  L.open(new Date(2026, 8, 19, 9));
  s = g.streaks(now);
  assert.strictEqual(s.current, 5);
});

test('tick: 출석 보너스는 하루 한 번, 쉬고 오면 휴식으로 센다', () => {
  const { g, st } = newGame();
  st.initialized = true;
  const attends = [];
  const rested = [];
  g.on('attend', (a) => attends.push(a));
  g.on('rested', (k) => rested.push(k));
  const now = Date.now();
  g.tick(now - 1000, 0, now);
  g.tick(now - 1000, 0, now + 1000);
  assert.strictEqual(attends.length, 1);
  assert.strictEqual(attends[0].xp, 20);
  st.pending = { kind: 'rest', at: now - 8 * 60_000 };
  g.tick(now - 7 * 60_000, 0, now);
  assert.deepStrictEqual(rested, ['rest']);
  assert.strictEqual(st.restsTaken, 1);
  // 알림 뒤에도 계속 일했으면 휴식이 아니다
  st.pending = { kind: 'meal', at: now - 30 * 60_000 };
  g.tick(now - 60_000, 0, now);
  assert.strictEqual(st.mealsTaken, 0);
  assert.ok(st.pending);
});

test('poke·noteOpen 은 오늘 기록으로 쌓인다', () => {
  const { g, st } = newGame();
  g.poke();
  g.poke();
  assert.strictEqual(st.pokes, 2);
  assert.strictEqual(st.pokesToday, 2);
  g.noteOpen('a.md');
  g.noteOpen('a.md');
  g.noteOpen('b.md');
  assert.strictEqual(st.readPaths.length, 2);
  // 몇 개를 열었는지만 세고, 어떤 노트였는지는 남기지 않는다
  g.noteOpen('비밀 폴더/올해 연봉 협상.md');
  assert.strictEqual(st.readPaths.length, 3);
  assert.ok(!JSON.stringify(st.readPaths).includes('연봉'), JSON.stringify(st.readPaths));
  assert.ok(!JSON.stringify(st.readPaths).includes('a.md'));
});

test('bonusText: 언어에 맞게 보여준다', () => {
  assert.strictEqual(I.bonusText(['attend', 3], '잉키'), '출석 3일째');
  assert.strictEqual(I.bonusText(['badge', 'first_note'], '잉키'), '업적: 첫 페이지');
  assert.strictEqual(I.bonusText(['quest', 'poke', 5], '잉키'), '퀘스트: 잉키 5번 쓰다듬기');
  I.setLang('en');
  assert.strictEqual(I.bonusText(['quest', 'chars', 800], 'Inky'), 'Quest: Write 800 characters');
  assert.strictEqual(I.unlockHint({ achievement: 'streak_7' }), 'badge “Perfect week”');
  I.setLang('ko');
  assert.strictEqual(I.unlockHint({ level: 8 }), 'Lv.8');
});

/* ── 기분 ── */

function newBrain(over = {}) {
  const s = settings({ chatter: false, lateNightEnabled: false, lunchEnabled: false, dinnerEnabled: false, ...over });
  const b = new I.Brain(() => s, () => ({ c: 1234 }));
  const out = { moods: [], bubbles: [], actions: [] };
  b.on('mood', (m) => out.moods.push(m));
  b.on('bubble', (x) => out.bubbles.push(x));
  b.on('action', (a) => out.actions.push(a));
  return { b, s, out };
}

test('Brain: 타이핑 → 쓰는 중, 시간이 지나면 졸다가 잔다', () => {
  const { b, out } = newBrain();
  const now = Date.now();
  b.activity('type', now);
  assert.strictEqual(b.mood, 'writing');
  b.lastTypeAt = now - 60_000;
  b.lastActivity = now - 60_000;
  b.tick();
  assert.strictEqual(b.mood, 'active');
  b.lastActivity = now - 10 * 60_000;
  b.tick();
  assert.strictEqual(b.mood, 'idle');
  b.lastActivity = now - 30 * 60_000;
  b.tick();
  assert.strictEqual(b.mood, 'sleepy');
  b.lastActivity = now - 90 * 60_000;
  b.tick();
  assert.strictEqual(b.mood, 'sleeping');
  assert.deepStrictEqual(out.moods, ['writing', 'active', 'idle', 'sleepy', 'sleeping']);
});

test('Brain: 밥 시간이면 하루 한 번 밥 먹자고 한다', () => {
  const d = new Date();
  const hhmm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const { b, out } = newBrain({ lunchEnabled: true, lunchTime: hhmm });
  b.lastActivity = Date.now();
  b.tick();
  b.tick();
  const lunch = out.bubbles.filter((x) => x.kind === 'lunch');
  assert.strictEqual(lunch.length, 1);
  assert.ok(out.actions.includes('eat'));
});

test('Brain: 오래 쉬지 않으면 휴식을 권한다', () => {
  const { b, out } = newBrain({ restAfterMin: 90 });
  const now = Date.now();
  b.streakStart = now - 100 * 60_000;
  b.lastActivity = now - 1000;
  b.tick();
  const rest = out.bubbles.find((x) => x.kind === 'rest');
  assert.ok(rest && /1시간 40분/.test(rest.text), rest && rest.text);
  assert.ok(out.actions.includes('stretch'));
});

test('Brain: 링크·새 노트·천 자 돌파에 반응한다', () => {
  const { b, out } = newBrain();
  b.wrote({ dc: 30, dl: 1, dn: 1 }, 1010);
  assert.ok(out.actions.includes('link'));
  assert.ok(out.actions.includes('wave'));
  assert.ok(out.bubbles.some((x) => x.kind === 'milestone' && x.text.includes('1,000')));
  assert.ok(out.bubbles.some((x) => x.kind === 'note'));
  out.bubbles.length = 0;
  b.wrote({ dc: 30, dl: 0, dn: 0 }, 1040);
  assert.ok(!out.bubbles.some((x) => x.kind === 'milestone'));
});

test('formatDuration', () => {
  assert.strictEqual(I.formatDuration(45 * 60_000), '45분');
  assert.strictEqual(I.formatDuration(120 * 60_000), '2시간');
  I.setLang('en');
  assert.strictEqual(I.formatDuration(135 * 60_000), '2h 15m');
  I.setLang('ko');
});

/* ── 언어 ── */

const vars = (s) => new Set((s.match(/\{(\w+)\}/g) || []).sort());
const KO_ONLY = new Set(['{i}', '{ro}', '{ieyo}', '{wa}', '{neun}', '{eul}']); // 한국어 조사

test('i18n: 모든 문구가 두 언어로 있고 자리표시자가 맞다', () => {
  for (const [k, v] of Object.entries(I.S)) {
    assert.ok(Array.isArray(v) && v.length === 2 && v[0] && v[1], k);
    const ko = [...vars(v[0])].filter((x) => !KO_ONLY.has(x));
    assert.deepStrictEqual(ko, [...vars(v[1])], k);
  }
  const all = (arr) => new Set(arr.flatMap((s) => [...vars(s)]));
  for (const [k, v] of Object.entries(I.LINES)) {
    assert.ok(v[0].length && v[1].length, k);
    assert.deepStrictEqual([...all(v[0])].sort(), [...all(v[1])].sort(), k);
  }
  for (const list of [I.ACHIEVEMENTS, I.ITEMS, I.COLORS]) {
    for (const x of list) {
      assert.ok(x.name[0] && x.name[1], x.id || x.key);
      if (x.desc) assert.ok(x.desc[0] && x.desc[1], x.id);
    }
  }
  for (const q of I.QUEST_POOL) assert.ok(q.text[0] && q.text[1], q.type);
});

test('i18n: 친구마다 대사가 두 언어로 있고, 기본 대사와 같은 자리표시자만 쓴다', () => {
  const all = (arr) => new Set(arr.flatMap((s) => [...vars(s)]));
  for (const [sp, lines] of Object.entries(I.SPECIES_LINES)) {
    assert.ok(I.SPECIES_BY[sp], sp);
    for (const [k, v] of Object.entries(lines)) {
      const id = `${sp}.${k}`;
      assert.ok(I.LINES[k], `${id}: 기본 대사가 없는 키`);
      assert.ok(v[0].length && v[1].length && v[0].every(Boolean) && v[1].every(Boolean), id);
      assert.deepStrictEqual([...all(v[0])].sort(), [...all(v[1])].sort(), id);
      const base = all([...I.LINES[k][0], ...I.LINES[k][1]]);
      for (const x of all(v[0])) assert.ok(base.has(x), `${id}: ${x}`);
    }
    // 성격이 드러나는 대사는 친구마다 꼭 있다
    for (const k of ['hello', 'poke', 'link', 'note', 'chatter', 'egg']) assert.ok(lines[k], `${sp}.${k}`);
  }
  // 파트너 대사를 고른다
  I.setCur('purrl');
  const said = new Set(Array.from({ length: 40 }, () => I.tl('poke')));
  assert.ok([...said].every((x) => I.SPECIES_LINES.purrl.poke[0].includes(x)));
  assert.ok(I.LINES.lunch[0].includes(I.tl('lunch', {}, 'inky')));
  I.setCur('inky');
});

test('i18n: 업적·아이템 참조가 모두 있다', () => {
  const ids = new Set(I.ACHIEVEMENTS.map((a) => a.id));
  assert.strictEqual(ids.size, I.ACHIEVEMENTS.length);
  for (const it of [...I.ITEMS, ...I.COLORS]) if (it.achievement) assert.ok(ids.has(it.achievement), it.key);
  for (const c of I.COLORS) assert.ok(I.VARIANTS[c.key], c.key);
  assert.strictEqual(I.COLORS[0].key, 'natural');
});

/* ── 친구들 ── */

test('SPECIES: 다섯 친구, 이름·설명·특기·그림이 다 있다', () => {
  assert.strictEqual(I.SPECIES.length, 5);
  assert.strictEqual(new Set(I.SPECIES.map((s) => s.key)).size, 5);
  const perks = new Set();
  for (const s of I.SPECIES) {
    for (const f of ['name', 'kind', 'type', 'trait', 'likes', 'dex']) assert.ok(s[f][0] && s[f][1], `${s.key}.${f}`);
    assert.ok(['chars', 'links', 'notes', 'attend', 'quest'].includes(s.perk.kind), s.key);
    assert.ok(s.perk.mult > 1 && s.perk.mult <= 1.5, s.key);
    perks.add(s.perk.kind);
    assert.ok(/^#[0-9a-f]{6}$/i.test(s.typeColor), s.key);
    assert.ok(I.ART[s.key] && I.EGG[s.key], s.key);
    assert.ok(I.S['perk_' + s.perk.kind], s.key);
    for (const c of I.COLORS) assert.ok(I.paletteOf(s.key, c.key).body, `${s.key}:${c.key}`);
  }
  assert.strictEqual(perks.size, 5, '특기가 서로 겹치지 않는다');
  assert.strictEqual(I.perkMult('dewey', 'quest'), 1.3);
  assert.strictEqual(I.perkMult('dewey', 'chars'), 1);
  assert.strictEqual(I.perkMult(null, 'chars'), 1);
});

test('Gamify: 부엉이는 퀘스트 보상, 새싹은 출석 보너스가 늘어난다', () => {
  const d = new Date(2026, 8, 19, 12);
  const base = newGame().g.quests(d).map((q) => q.xp);
  const owl = newGame();
  owl.st.partner = 'dewey';
  owl.st.party = { dewey: I.newPet('dewey') };
  assert.deepStrictEqual(owl.g.quests(d).map((q) => q.xp), base.map((x) => Math.round(x * 1.3)));
  assert.ok(owl.g.quests(d)[0].text);

  const sprout = newGame();
  sprout.st.initialized = true;
  sprout.st.partner = 'sprig';
  sprout.st.party = { sprig: I.newPet('sprig') };
  const got = [];
  sprout.g.on('attend', (a) => got.push(a.xp));
  const now = Date.now();
  sprout.g.tick(now - 1000, 0, now);
  assert.deepStrictEqual(got, [30]); // 20 × 1.5
});

test('achievements: 도감 친구 수와 키운 친구 수', () => {
  const { g, st } = newGame();
  st.party = { inky: I.newPet('inky', { best: 3 }), purrl: I.newPet('purrl', { best: 2 }), ember: I.newPet('ember') };
  g.evaluate({ level: 1, stageIndex: 0 }, true);
  assert.ok(st.achievements.friends_3);
  assert.ok(st.achievements.raise_2);
  assert.ok(!st.achievements.friends_5);
});

/* ── 그림 ── */

// 옵시디언 없이 캔버스 흉내만 내서 모든 조합을 한 번씩 그려 본다
function fakeCanvas() {
  const drawn = new Map();
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    clearRect: () => drawn.clear(),
    fillRect: (x, y, w, h) => {
      assert.ok(Number.isInteger(x) && Number.isInteger(y), `정수 좌표가 아니다: ${x},${y}`);
      assert.ok(typeof ctx.fillStyle === 'string' && ctx.fillStyle, '색이 비었다');
      assert.ok(!/undefined|NaN/.test(ctx.fillStyle), `잘못된 색: ${ctx.fillStyle}`);
      drawn.set(`${x},${y}`, ctx.fillStyle);
    },
    getImageData: (x, y) => ({ data: [0, 0, 0, drawn.has(`${x},${y}`) ? 255 : 0] }),
  };
  return { width: 0, height: 0, getContext: () => ctx, drawn };
}

test('PetRenderer: 친구 × 단계 × 기분 × 동작 × 장식을 모두 그릴 수 있다', () => {
  const stages = ['egg', 'baby', 'child', 'teen', 'adult'];
  const moods = ['idle', 'active', 'writing', 'sleepy', 'sleeping'];
  const actions = [null, 'happy', 'link', 'levelup', 'evolve', 'wave', 'eat', 'stretch', 'yawn', 'achieve', 'fidget'];
  let frames = 0;
  for (const sp of I.SPECIES) {
    for (const stage of stages) {
      for (const mood of moods) {
        for (const action of actions) {
          const cv = fakeCanvas();
          const r = new I.PetRenderer(cv);
          r.setSpecies(sp.key);
          r.setStage(stage);
          r.setMood(mood);
          r.setProgress(0.95);
          r.setWalking(action === null && mood === 'active');
          if (action) r.play(action);
          r.frame();
          frames++;
          assert.ok(cv.drawn.size > 40, `${sp.key}/${stage}/${mood}/${action}: 거의 안 그려졌다`);
          assert.ok(r.headTop() >= 0 && r.headTop() < 43, `${sp.key}/${stage}: 머리 위치 ${r.headTop()}`);
        }
      }
      for (const it of I.ITEMS) {
        for (const c of I.COLORS) {
          const r = new I.PetRenderer(fakeCanvas());
          r.setSpecies(sp.key);
          r.setStage(stage);
          r.setAccessory(it.key);
          r.setColor(c.key);
          r.frame();
          frames++;
        }
      }
    }
  }
  assert.ok(frames > 2000);
  // 모르는 값은 기본으로
  const r = new I.PetRenderer(fakeCanvas());
  r.setSpecies('dragon');
  r.setColor('violet');
  assert.strictEqual(r.species, 'inky');
  assert.strictEqual(r.color, 'natural');
});

test('josa', () => {
  assert.strictEqual(I.josa('잉키', '이', '가'), '가');
  assert.strictEqual(I.josa('몽글', '이', '가'), '이');
  assert.strictEqual(I.josaRo('어른'), '으로');
  assert.strictEqual(I.josaRo('아기'), '로');
  assert.strictEqual(I.josaRo('청소년'), '으로');
  assert.strictEqual(I.josaRo('알'), '로'); // ㄹ 받침
  assert.strictEqual(I.t('grew', { name: '잉키', i: '가', stage: '어른', ro: '으로' }), '잉키가 어른으로 자랐어! 🎉');
});

/* ── 실행 ── */

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n    ${e.stack.split('\n').slice(0, 3).join('\n    ')}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
