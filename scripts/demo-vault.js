'use strict';

/*
 * 데모 볼트를 만든다.
 *   node scripts/demo-vault.js [출력 폴더] [--seeded] [--partner=inky] [--plugin-only]
 *
 * - 노트 몇 개와 .obsidian 설정, 플러그인 파일(main.js·manifest.json·styles.css·fonts/)을 넣는다.
 * - --seeded: 설치한 지 3주쯤 된 data.json 을 함께 넣는다 (스크린샷용). 도감에는 친구 셋이 있다.
 *   성장은 설치한 순간부터라서, 기록도 설치한 뒤 3주치만 있다.
 *   --partner 로 지금 파트너를 고른다 (inky·purrl·sprig·ember·dewey).
 *   없으면 플러그인을 처음 켠 상태라 첫 실행 안내(파트너 고르기)부터 나온다.
 * - --plugin-only: 노트는 그대로 두고 플러그인 파일만 새로 복사한다.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const out = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(root, '..', '데모_볼트'));
const seeded = args.includes('--seeded');
const pluginOnly = args.includes('--plugin-only');
const partner = (args.find((a) => a.startsWith('--partner=')) || '--partner=inky').split('=')[1];

const write = (rel, text) => {
  const p = path.join(out, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};

/* ── 플러그인 ── */

const pdir = path.join(out, '.obsidian', 'plugins', 'vault-pet');
fs.mkdirSync(path.join(pdir, 'fonts'), { recursive: true });
for (const f of ['main.js', 'manifest.json', 'styles.css']) fs.copyFileSync(path.join(root, f), path.join(pdir, f));
for (const f of fs.readdirSync(path.join(root, 'fonts'))) fs.copyFileSync(path.join(root, 'fonts', f), path.join(pdir, 'fonts', f));

if (pluginOnly) {
  console.log(`plugin files copied to ${pdir}`);
  process.exit(0);
}

/* ── 설정 ── */

write('.obsidian/app.json', JSON.stringify({ promptDelete: false, alwaysUpdateLinks: true }, null, 2));
// 옵시디언도 컴퓨터 밝기 설정을 따라가게 (플러그인 기본 테마와 같게)
write('.obsidian/appearance.json', JSON.stringify({ theme: 'system', baseFontSize: 16 }, null, 2));
write('.obsidian/community-plugins.json', JSON.stringify(['vault-pet'], null, 2));
write('.obsidian/core-plugins.json', JSON.stringify({ 'file-explorer': true, 'global-search': true, backlink: true, 'page-preview': true, 'daily-notes': true, 'command-palette': true }, null, 2));

/* ── 노트 ── */

const notes = {
  '홈.md': `# 홈

오늘도 한 줄씩. 아래는 같이 쓰는 펫이에요.

\`\`\`vault-pet
\`\`\`

## 요즘 보는 것
- [[독서 - 아주 작은 습관의 힘]]
- [[프로젝트 - 사이드 앱]]
- [[아이디어 모음]]
`,
  '독서 - 아주 작은 습관의 힘.md': `---
tags: [독서]
---
# 아주 작은 습관의 힘

매일 1%씩 나아지면 1년 뒤에는 37배가 된다. 목표보다 **시스템**에 집중하라는 이야기.

- 습관은 정체성에서 시작한다 → [[정체성 기반 습관]]
- 환경을 바꾸면 행동이 바뀐다 → [[환경 설계]]
- 두 번 연속으로 빼먹지 않기

관련: [[아이디어 모음]], [[프로젝트 - 사이드 앱]]
`,
  '정체성 기반 습관.md': `# 정체성 기반 습관

"나는 글을 쓰는 사람이다"라고 믿으면 쓰는 행동이 따라온다.
작은 증거를 매일 쌓는다. 오늘 한 줄을 쓴 것도 증거다.

출처: [[독서 - 아주 작은 습관의 힘]]
`,
  '환경 설계.md': `# 환경 설계

책상 위에는 지금 하는 일 하나만. 휴대폰은 다른 방에.
옵시디언을 켜면 바로 오늘 노트가 열리게 해 두었다.

- [[정체성 기반 습관]]
- [[독서 - 아주 작은 습관의 힘]]
`,
  '프로젝트 - 사이드 앱.md': `# 사이드 앱

## 목표
주말마다 조금씩. 첫 버전은 한 달 안에.

## 할 일
- [x] 기획 정리 → [[아이디어 모음]]
- [ ] 화면 스케치
- [ ] 첫 데모

## 메모
막히면 [[환경 설계]]부터 다시 본다.
`,
  '아이디어 모음.md': `# 아이디어 모음

- 노트를 쓸수록 자라는 펫 🥚
- 읽은 책을 지도처럼 잇는 그래프
- 하루 회고 템플릿

[[프로젝트 - 사이드 앱]]
`,
  'Daily/2026-09-18.md': `# 2026-09-18

- 아침에 [[독서 - 아주 작은 습관의 힘]] 3장 읽음
- 점심 먹고 산책
- 저녁에 [[프로젝트 - 사이드 앱]] 기획 조금
`,
  'Daily/2026-09-19.md': `# 2026-09-19

오늘 할 일
- [ ] 펫 이름 짓기
- [ ] [[환경 설계]] 다시 읽기
`,
  'Templates/일일 노트.md': `# {{date}}

## 오늘 할 일
- [ ]

## 회고
`,
};
for (const [rel, text] of Object.entries(notes)) write(rel, text);

/* ── 키워 둔 펫 (--seeded) ── */

const dataFile = path.join(pdir, 'data.json');
if (!seeded) {
  fs.rmSync(dataFile, { force: true });
  console.log(`demo vault (fresh) at ${out}`);
  process.exit(0);
}

const pad = (n) => String(n).padStart(2, '0');
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const ago = (n, h = 12) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, h);

// 설치한 지 21일. 주말엔 조금, 평일엔 많이
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const days = {};
const hours = new Array(24).fill(0);
const tot = { c: 0, l: 0, n: 0 };
for (let i = 21; i >= 1; i--) {
  if (i === 9 || i === 15) continue; // 쉰 날
  const d = ago(i);
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const c = Math.round((weekend ? 1400 : 3000) + rnd() * 3000);
  const l = Math.round(6 + rnd() * 14);
  const n = Math.round(rnd() * 3);
  days[dayOf(d)] = { c, l, n, o: Math.round(4 + rnd() * 10) };
  for (const h of [9, 10, 14, 15, 21, 22]) hours[h] += Math.round((c + l + n) / 6);
  tot.c += c;
  tot.l += l;
  tot.n += n;
}
hours[1] += 80; // 올빼미 한 번
// 오늘
days[dayOf(now)] = { c: 820, l: 5, n: 1, o: 6 };
tot.c += 820;
tot.l += 5;
tot.n += 1;
hours[now.getHours()] += 826;

const files = {};
for (const [rel, text] of Object.entries(notes)) files[rel] = [text.replace(/\s/g, '').length, (text.match(/\[\[/g) || []).length, Date.now() + 60_000, 1];

const at = (n) => ago(n, 20).getTime();
const installedAt = ago(21, 9).getTime();
const achievements = { friends_3: at(6), first_note: at(21), chars_10k: at(18), streak_3: at(18), streak_7: at(14), links_100: at(9), night_owl: at(12), early_bird: at(19), focus_day: at(17), pet_50: at(4), quest_10: at(3), lv_10: at(10), stage_child: at(5), marathon: at(6) };
const bonus = [
  { at: at(3), xp: 60, why: ['quest', 'chars', 800] },
  { at: at(3), xp: 100, why: ['allclear'] },
  { at: at(2), xp: 80, why: ['attend', 12] },
  { at: at(1), xp: 85, why: ['attend', 13] },
  { at: at(1), xp: 40, why: ['quest', 'links', 3] },
  { at: at(0), xp: 90, why: ['attend', 14] },
  { at: at(0), xp: 30, why: ['quest', 'poke', 5] },
];
// 업적 보너스도 넣는다
const ACH_XP = { friends_3: 150, first_note: 50, chars_10k: 100, streak_3: 100, streak_7: 250, links_100: 100, night_owl: 100, early_bird: 100, focus_day: 200, pet_50: 100, quest_10: 200, lv_10: 100, stage_child: 150, marathon: 150 };
for (const [id, t] of Object.entries(achievements)) bonus.unshift({ at: t, xp: ACH_XP[id], why: ['badge', id] });
// 매일 출석·퀘스트 보너스를 조금씩
for (let i = 21; i >= 4; i--) if (days[dayOf(ago(i))]) bonus.unshift({ at: at(i), xp: 110, why: ['attend', 21 - i] });

// 도감: 지금 파트너는 설치한 날부터 자랐고, 나머지 둘은 쉬는 중
const NAMES = { inky: '잉키', purrl: '냥타래', sprig: '새록이', ember: '모닥이', dewey: '듀이' };
const pet = (o) => ({ mode: 'fresh', startStage: 0, base: null, since: 0, startXp: 0, frozen: 0, color: 'natural', accessory: 'none', metAt: at(21), best: 0, ...o });
const party = { [partner]: pet({ name: NAMES[partner], since: installedAt, metAt: installedAt, accessory: 'glasses', best: 2 }) };
for (const [k, o] of [['purrl', { frozen: 2400, accessory: 'scarf', best: 1, metAt: at(9) }], ['ember', { frozen: 320, best: 0, metAt: at(3) }], ['inky', { frozen: 1100, best: 1, metAt: at(12) }]]) {
  if (Object.keys(party).length < 3 && !party[k]) party[k] = pet({ name: NAMES[k], ...o });
}

const data = {
  schema: 3,
  settings: { language: 'ko', theme: 'system', showWidget: true, roam: true, scale: 2, excludedFolders: ['Templates'] },
  state: {
    partner, party, picked: true, installedAt,
    pokes: 64, pokesDay: dayOf(now), pokesToday: 5, mealsTaken: 3, restsTaken: 6, maxStreakMin: 150,
    bonus: bonus.sort((a, b) => a.at - b.at), achievements,
    items: ['none', 'sprout', 'ribbon', 'glasses', 'headphones', 'quill', 'nightcap', 'party'], colors: ['natural', 'clay', 'mint'],
    questsDone: 17, attendDay: dayOf(now), initialized: true, onboarded: true, scanned: true,
    lastLevel: null, lastStage: null, seen: ['i:sprout', 'i:ribbon', 'i:glasses', 'i:headphones', 'i:nightcap', 'i:party', 'c:clay', 'c:mint'],
  },
  ledger: { files, days, hours, tot },
};
fs.writeFileSync(dataFile, JSON.stringify(data));
console.log(`demo vault (seeded: ${Object.keys(days).length} days, ${tot.c} chars, partner ${partner}) at ${out}`);
