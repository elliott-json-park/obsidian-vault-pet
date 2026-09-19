'use strict';

/*
 * 데모 볼트를 만든다.
 *   node scripts/demo-vault.js [출력 폴더] [--seeded] [--plugin-only]
 *
 * - 노트 몇 개와 .obsidian 설정, 플러그인 파일(main.js·manifest.json·styles.css·fonts/)을 넣는다.
 * - --seeded: 3주쯤 키운 펫의 data.json 을 함께 넣는다 (스크린샷용).
 *   없으면 플러그인을 처음 켠 상태라 첫 실행 안내부터 나온다.
 * - --plugin-only: 노트는 그대로 두고 플러그인 파일만 새로 복사한다.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const out = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(root, '..', '데모_볼트'));
const seeded = args.includes('--seeded');
const pluginOnly = args.includes('--plugin-only');

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
write('.obsidian/appearance.json', JSON.stringify({ theme: 'obsidian', baseFontSize: 16 }, null, 2));
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

// 22일치 기록. 주말엔 조금, 평일엔 많이
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const days = {};
const hours = new Array(24).fill(0);
const tot = { c: 0, l: 0, n: 0 };
for (let i = 21; i >= 1; i--) {
  if (i === 9 || i === 15) continue; // 쉰 날
  const d = ago(i);
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const c = Math.round((weekend ? 600 : 1500) + rnd() * 2200);
  const l = Math.round(3 + rnd() * 12);
  const n = Math.round(rnd() * 3);
  days[dayOf(d)] = { c, l, n, o: Math.round(4 + rnd() * 10) };
  for (const h of [9, 10, 14, 15, 21, 22]) hours[h] += Math.round((c + l + n) / 6);
  tot.c += c;
  tot.l += l;
  tot.n += n;
}
hours[1] += 80; // 올빼미 한 번
// 플러그인을 깔기 전부터 써 온 노트들 (첫 실행 때 만든 날짜로 채워진 몫)
for (const [n, c, l, k] of [[140, 180_000, 420, 60], [95, 150_000, 380, 45], [50, 120_000, 300, 30]]) {
  days[dayOf(ago(n))] = { c, l, n: k, o: 0 };
  hours[11] += c + l + k;
  tot.c += c;
  tot.l += l;
  tot.n += k;
}
// 오늘
days[dayOf(now)] = { c: 820, l: 5, n: 1, o: 6 };
tot.c += 820;
tot.l += 5;
tot.n += 1;
hours[now.getHours()] += 826;

const files = {};
for (const [rel, text] of Object.entries(notes)) files[rel] = [text.replace(/\s/g, '').length, (text.match(/\[\[/g) || []).length, Date.now() + 60_000, 1];

const at = (n) => ago(n, 20).getTime();
const achievements = { first_note: at(21), chars_10k: at(16), streak_3: at(18), streak_7: at(13), links_100: at(5), night_owl: at(12), early_bird: at(19), focus_day: at(10), pet_50: at(4), quest_10: at(3), lv_10: at(7), stage_child: at(8), marathon: at(6), chars_100k: at(50), links_1000: at(50), notes_50: at(95), lv_30: at(2) };
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
const ACH_XP = { first_note: 50, chars_10k: 100, streak_3: 100, streak_7: 250, links_100: 100, night_owl: 100, early_bird: 100, focus_day: 200, pet_50: 100, quest_10: 200, lv_10: 100, stage_child: 150, marathon: 150, chars_100k: 300, links_1000: 400, notes_50: 150, lv_30: 300 };
for (const [id, t] of Object.entries(achievements)) bonus.unshift({ at: t, xp: ACH_XP[id], why: ['badge', id] });
// 매일 출석·퀘스트 보너스를 조금씩
for (let i = 21; i >= 4; i--) if (days[dayOf(ago(i))]) bonus.unshift({ at: at(i), xp: 110, why: ['attend', 21 - i] });

const data = {
  settings: {
    petName: '잉키', language: 'ko', showWidget: true, scale: 2, accessory: 'glasses', color: 'violet',
    startMode: 'all', excludedFolders: ['Templates'],
  },
  state: {
    pokes: 64, pokesDay: dayOf(now), pokesToday: 5, mealsTaken: 3, restsTaken: 6, maxStreakMin: 150,
    bonus: bonus.sort((a, b) => a.at - b.at), achievements,
    items: ['none', 'sprout', 'ribbon', 'glasses', 'headphones', 'beanie', 'scarf', 'quill', 'nightcap', 'party'], colors: ['violet', 'clay', 'mint', 'peach', 'midnight'],
    questsDone: 17, attendDay: dayOf(now), initialized: true, onboarded: true, scanned: true,
    lastLevel: null, lastStage: null, seen: ['i:sprout', 'i:ribbon', 'i:glasses', 'i:headphones', 'i:beanie', 'i:scarf', 'i:nightcap', 'i:party', 'c:clay', 'c:mint', 'c:peach'],
  },
  ledger: { files, days, hours, tot },
};
fs.writeFileSync(dataFile, JSON.stringify(data));
console.log(`demo vault (seeded: ${Object.keys(days).length} days, ${tot.c} chars) at ${out}`);
