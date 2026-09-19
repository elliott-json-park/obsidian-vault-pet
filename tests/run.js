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
  assert.ok(L.d.files['new/a.md'] && L.d.files['new/sub/b.md']);
  assert.ok(!L.d.files['old/a.md']);
  const r = L.observe('new/a.md', { chars: 40, links: 2 }, when);
  assert.deepStrictEqual(r, { dc: 0, dl: 0, dn: 0 });
  L.rename('new/a.md', 'c.md');
  assert.ok(L.d.files['c.md']);
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
  const all = I.computeGrowth(settings({ startMode: 'all' }), tot, () => 500);
  assert.strictEqual(all.xp, 20_000);
  assert.strictEqual(all.stageKey, 'child');
  assert.strictEqual(all.nextStageKey, 'teen');
  assert.ok(all.progress > 0 && all.progress < 1);

  const base = { c: 180_000, l: 1000, n: 300 };
  const fresh = I.computeGrowth(settings({ startMode: 'fresh', baseline: base, baselineAt: 1000 }), tot, (since) => (since === 1000 ? 7 : 999));
  assert.strictEqual(fresh.usageXp, 1000);
  assert.strictEqual(fresh.xp, 1007);
  assert.strictEqual(fresh.stageKey, 'baby');

  const stage = I.computeGrowth(settings({ startMode: 'stage', startStage: 3, baseline: tot, baselineAt: 1 }), tot, () => 0);
  assert.strictEqual(stage.xp, 30_000);
  assert.strictEqual(stage.stageKey, 'teen');
  assert.strictEqual(stage.startXp, 30_000);

  const adult = I.computeGrowth(settings(), { c: 4e6, l: 0, n: 0 }, () => 0);
  assert.strictEqual(adult.stageKey, 'adult');
  assert.strictEqual(adult.nextStageKey, null);
  assert.strictEqual(adult.progress, 1);
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
const KO_ONLY = new Set(['{i}', '{ro}', '{ieyo}']); // 한국어 조사

test('i18n: 모든 문구가 두 언어로 있고 자리표시자가 맞다', () => {
  for (const [k, v] of Object.entries(I.S)) {
    assert.ok(Array.isArray(v) && v.length === 2 && v[0] && v[1], k);
    const ko = [...vars(v[0])].filter((x) => !KO_ONLY.has(x));
    assert.deepStrictEqual(ko, [...vars(v[1])], k);
  }
  for (const [k, v] of Object.entries(I.LINES)) {
    assert.ok(v[0].length && v[1].length, k);
    const all = (arr) => new Set(arr.flatMap((s) => [...vars(s)]));
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

test('i18n: 업적·아이템 참조가 모두 있다', () => {
  const ids = new Set(I.ACHIEVEMENTS.map((a) => a.id));
  assert.strictEqual(ids.size, I.ACHIEVEMENTS.length);
  for (const it of [...I.ITEMS, ...I.COLORS]) if (it.achievement) assert.ok(ids.has(it.achievement), it.key);
  for (const c of I.COLORS) assert.ok(I.PAL[c.key], c.key);
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
