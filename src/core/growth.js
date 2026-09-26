// 사용량 → 경험치 → 레벨과 성장 단계. (옵시디언판: 쓴 글자·링크·새 노트·글쓰기 세션)

// 고양이는 한 마리뿐이다. 2026-09-21 에 아기·어른을 접고 이 한 마리로 간다.
// 단계 장치(STAGES 배열·stageIndex·nextStage)는 그대로 남겨 뒀다 — 반응을 보고 다시 늘리려면
// 여기에 줄만 더하면 되고, 화면은 STAGES.length 가 1 이면 단계 얘기를 알아서 숨긴다.
const STAGES = [{ key: 'cat', name: '고양이', min: 0 }];

// 옛 인덱스(알0 아기1 어린이2 청소년3 어른4 / 아기0 청소년1 어른2) → 전부 0
const STAGE_FOLD = [0, 0, 0, 0, 0];
const foldStage = (old) => STAGE_FOLD[Math.max(0, Math.min(STAGE_FOLD.length - 1, old | 0))];

// 털색: 경험치(레벨)가 오를수록 하나씩 열린다. 그림(팔레트·무늬)은 renderer/sprite.js 의 FURS, 이름은 i18n 'fur.<key>'
// 2026-09-24: Lv.50 에 다 열려서 너무 쉬웠다. Lv.100 까지 벌렸다가, 최대 레벨을 80 으로 잡으면서 Lv.80 안으로 다시 당겼다.
// 이미 입고 있는 털색은 잠겨도 그대로 입고 있다 (main.js 의 house:set 은 새로 고를 때만 막는다)
const FURS = [
  { key: 'cheese', level: 1 },
  { key: 'cream', level: 4 },
  { key: 'gray', level: 8 },
  { key: 'white', level: 12 },
  { key: 'black', level: 16 },
  { key: 'ginger', level: 20 },
  { key: 'socks', level: 24 },
  { key: 'silver', level: 29 },
  { key: 'choco', level: 34 },
  { key: 'blue', level: 39 },
  { key: 'calico', level: 44 },
  { key: 'lilac', level: 50 },
  { key: 'peach', level: 55 },
  { key: 'mint', level: 61 },
  { key: 'gold', level: 67 },
  { key: 'galaxy', level: 74 },
  { key: 'rainbow', level: 80 },
];

// 경험치 = 쓴 글자 ÷ 10 + 링크 × 10 + 새 노트 × 20 + 글쓰기 세션 × 30 (+ 업적·퀘스트·출석 보너스)
const CHARS_PER_XP = 10;
const XP_PER_LINK = 10;
const XP_PER_NOTE = 20;
const XP_PER_SESSION = 30;

function xpOf(t) {
  return Math.floor((t.c || 0) / CHARS_PER_XP) + (t.l || 0) * XP_PER_LINK + (t.n || 0) * XP_PER_NOTE + (t.s || 0) * XP_PER_SESSION;
}

function levelOf(xp) {
  return Math.floor(Math.sqrt(xp / 25)) + 1;
}

function stageIndexOf(xp) {
  let i = 0;
  while (i + 1 < STAGES.length && xp >= STAGES[i + 1].min) i++;
  return i;
}

// since = 처음 만난 시각 (state.startedAt). 그 뒤에 쓴 만큼만 자란다. 이전 기록은 누적 기록에서 구경만 한다
// bonusXp(since) = 업적·퀘스트·출석으로 받은 보너스 경험치
function computeGrowth(since, usage, bonusXp = () => 0) {
  const usageXp = xpOf(usage.totals(since));
  const bonus = bonusXp(since);
  const xp = usageXp + bonus;

  const si = stageIndexOf(xp);
  const stage = STAGES[si];
  const next = STAGES[si + 1];
  const progress = next ? (xp - stage.min) / (next.min - stage.min) : 1;

  const level = levelOf(xp);
  return {
    xp,
    usageXp,
    bonusXp: bonus,
    level,
    levelFloor: 25 * (level - 1) ** 2,
    levelCeil: 25 * level ** 2,
    stageIndex: si,
    stageKey: stage.key,
    stageName: stage.name,
    nextStageKey: next ? next.key : null,
    nextStageName: next ? next.name : null,
    xpToNext: next ? next.min - xp : 0,
    progress: Math.max(0, Math.min(1, progress)),
  };
}

module.exports = { FURS, STAGES, STAGE_FOLD, foldStage, computeGrowth, xpOf, levelOf, CHARS_PER_XP, XP_PER_LINK, XP_PER_NOTE, XP_PER_SESSION };
