'use strict';

/*
 * 데모 볼트를 만든다.
 *   node scripts/demo-vault.js [출력 폴더] [--seeded] [--plugin-only] [--enable]
 *
 * - 노트 몇 개와 .obsidian 설정, 플러그인 파일(main.js·manifest.json·styles.css·fonts/)을 넣는다.
 * - --seeded: 킷커밋을 켠 지 3주쯤 된 data.json 을 함께 넣는다 (스크린샷용). 레벨·코인·코스튬·밥이 조금 있다.
 *   없으면 플러그인을 처음 켠 상태라 첫 실행 안내부터 나온다.
 * - --plugin-only: 노트는 그대로 두고 플러그인 파일만 새로 복사한다 (data.json 은 건드리지 않는다).
 *   --enable 을 같이 주면 커뮤니티 플러그인 목록에서 킷커밋을 켜고 예전 vault-pet 은 끈다.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const out = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(root, '..', '데모_볼트'));
const seeded = args.includes('--seeded');
const pluginOnly = args.includes('--plugin-only');
const enable = args.includes('--enable');
const ID = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).id;

const write = (rel, text) => {
  const p = path.join(out, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};

/* ── 플러그인 ── */

const pdir = path.join(out, '.obsidian', 'plugins', ID);
fs.mkdirSync(path.join(pdir, 'fonts'), { recursive: true });
for (const f of ['main.js', 'manifest.json', 'styles.css']) fs.writeFileSync(path.join(pdir, f), fs.readFileSync(path.join(root, f)));
for (const f of fs.readdirSync(path.join(root, 'fonts'))) if (/^(Pretendard|OFL-Pretendard)/.test(f)) fs.writeFileSync(path.join(pdir, 'fonts', f), fs.readFileSync(path.join(root, 'fonts', f)));

if (pluginOnly) {
  if (enable) {
    const file = path.join(out, '.obsidian', 'community-plugins.json');
    let list = [];
    try {
      list = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      // 없으면 새로
    }
    list = [...new Set([...list.filter((x) => x !== 'vault-pet'), ID])];
    fs.writeFileSync(file, JSON.stringify(list, null, 2));
  }
  console.log(`plugin files copied to ${pdir}${enable ? ' (enabled)' : ''}`);
  process.exit(0);
}

/* ── 설정 ── */

write('.obsidian/app.json', JSON.stringify({ promptDelete: false, alwaysUpdateLinks: true }, null, 2));
write('.obsidian/appearance.json', JSON.stringify({ theme: 'system', baseFontSize: 16 }, null, 2));
write('.obsidian/community-plugins.json', JSON.stringify([ID], null, 2));
write('.obsidian/core-plugins.json', JSON.stringify({ 'file-explorer': true, 'global-search': true, backlink: true, 'page-preview': true, 'daily-notes': true, 'command-palette': true, canvas: true }, null, 2));

/* ── 노트 ── */

const notes = {
  '홈.md': `# 홈

오늘도 한 줄씩. 작업 영역 바닥에서 고양이가 같이 써요.

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

> [!tip] 메모
> 막히면 [[환경 설계]]부터 다시 본다.
`,
  '아이디어 모음.md': `# 아이디어 모음

- 글을 쓸수록 자라는 도트 고양이
- 읽은 책을 지도처럼 잇는 그래프
- 하루 회고 템플릿

[[프로젝트 - 사이드 앱]] #아이디어
`,
  'Daily/2026-09-18.md': `# 2026-09-18

- 아침에 [[독서 - 아주 작은 습관의 힘]] 3장 읽음
- 점심 먹고 산책
- 저녁에 [[프로젝트 - 사이드 앱]] 기획 조금
`,
  'Daily/2026-09-19.md': `# 2026-09-19

오늘 할 일
- [ ] 고양이 이름 짓기
- [ ] [[환경 설계]] 다시 읽기
`,
  'Templates/일일 노트.md': `# {{date}}

## 오늘 할 일
- [ ]

## 회고
`,
};
for (const [rel, text] of Object.entries(notes)) write(rel, text);

/* ── 키워 둔 고양이 (--seeded) ── */

const dataFile = path.join(pdir, 'data.json');
if (!seeded) {
  if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
  console.log(`demo vault (fresh) at ${out}`);
  process.exit(0);
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const startedAt = now - 21 * DAY;
const pad = (n) => String(n).padStart(2, '0');
const hourKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}`;
// 볼트 맨 위('/') 한 곳에 3주치 기록. 평일 저녁과 주말 오전에 조금씩
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const buckets = {};
const tot = { c: 0, l: 0, n: 0, s: 0 };
for (let d = 20; d >= 0; d--) {
  if (rnd() < 0.2) continue;
  const base = new Date(now - d * DAY);
  const hours = base.getDay() % 6 === 0 ? [10, 11, 14] : [20, 21];
  for (const h of hours) {
    const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h);
    if (at.getTime() > now) continue;
    const c = Math.round(300 + rnd() * 1400);
    const l = Math.round(rnd() * 6);
    const n = rnd() < 0.4 ? 1 : 0;
    const s = h === hours[0] ? 1 : 0;
    buckets[hourKey(at)] = { c, l, n, s, v: Math.round(2 + rnd() * 6), e: Math.round(8 + rnd() * 30), t: rnd() < 0.3 ? { tag: 1, done: 1 } : undefined };
    Object.assign(tot, { c: tot.c + c, l: tot.l + l, n: tot.n + n, s: tot.s + s });
  }
}
const data = {
  version: 1,
  settings: { petName: '킷', language: 'ko', scale: 3, outfit: { neck: 'scarf', face: 'glasses' }, accessory: 'glasses,scarf' },
  state: {
    startedAt, onboarded: true, greeted: true, lastLevel: null, lastStage: null,
    items: ['none', 'glasses', 'scarf', 'sprout', 'ball', 'yarn'],
    pantry: { churu: 3, tuna: 2, milk: 1 },
    walletSpent: 900,
    purchases: [{ at: now - 5 * DAY, key: 'glasses', price: 200 }, { at: now - 3 * DAY, key: 'ball', price: 400 }, { at: now - DAY, key: 'churu', price: 25 }],
  },
  usage: { files: {}, projects: { '/': { buckets, last: now - DAY } }, lastEdit: now - DAY },
  meta: { scanned: false, baseline: { c: 0, l: 0, n: 0, s: 0 } },
};
fs.writeFileSync(dataFile, JSON.stringify(data));
console.log(`demo vault (seeded: ${tot.c} chars, ${tot.l} links, ${tot.n} notes, ${tot.s} sessions) at ${out}`);
