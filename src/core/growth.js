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
  // 별 전용 털색 (8차): 레벨이 아니라 Lv80 뒤 별로 산다 (main/shop.js 의 'fur_<key>'). 움직이는 털이다
  { key: 'aurora', stars: 3 },
  { key: 'neon', stars: 5 },
  { key: 'holo', stars: 8 },
];

// 귀 모양 (2026-10-10): 처음 시작할 때 · 옷장에서 고른다. 레벨과 상관없이 다 열려 있다.
// 그림은 kit/sprite.js 의 EARS, 이름은 i18n 'ear.<key>' (키가 셋 다 같아야 한다)
const EAR_SHAPES = ['perk', 'round', 'pointy', 'small', 'fold', 'outtilt', 'intilt', 'darktip', 'whitetip', 'tnr', 'mismatch', 'lynx', 'fox'];

// 경험치 = 쓴 글자 ÷ 10 + 링크 × 10 + 새 노트 × 20 + 글쓰기 세션 × 30 (+ 업적·퀘스트·출석 보너스)
const CHARS_PER_XP = 10;
const XP_PER_LINK = 10;
const XP_PER_NOTE = 20;
const XP_PER_SESSION = 30;

function xpOf(t) {
  return Math.floor((t.c || 0) / CHARS_PER_XP) + (t.l || 0) * XP_PER_LINK + (t.n || 0) * XP_PER_NOTE + (t.s || 0) * XP_PER_SESSION;
}

// 최대 레벨 (2026-09-24 확정). 그 뒤로 쌓이는 경험치는 별(프레스티지)이 된다
const MAX_LEVEL = 80;
const XP_AT_MAX = 25 * (MAX_LEVEL - 1) ** 2; // Lv80 이 되는 경험치 (156,025)
// 별 하나 = Lv80 뒤로 경험치 2,000. 데스크톱판은 8,000 이지만(많이 쓰는 사람 기준 2~3일에 하나),
// 글쓰기로 버는 경험치는 하루 수백~천 남짓이라 같은 속도(3일 안팎에 하나)가 되게 낮췄다
const STAR_XP = 2_000;
const STAR_COINS = 500; // 별 하나에 주는 코인 (gamify.js 의 payStars)

function levelOf(xp) {
  return Math.min(MAX_LEVEL, Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1);
}

// 별: Lv80 뒤로 쌓인 경험치. { stars 딴 별 수, starProgress 다음 별까지 0~1, starNext 다음 별까지 남은 경험치 }
function starsOf(xp) {
  const over = Math.max(0, xp - XP_AT_MAX);
  const stars = xp >= XP_AT_MAX ? Math.floor(over / STAR_XP) : 0;
  const into = xp >= XP_AT_MAX ? over - stars * STAR_XP : 0;
  return { stars, starProgress: into / STAR_XP, starNext: xp >= XP_AT_MAX ? STAR_XP - into : XP_AT_MAX - xp + STAR_XP, starXp: STAR_XP };
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
  const st = starsOf(xp);
  // Lv80 에서는 레벨 막대가 다음 별까지를 보여 준다 (화면은 levelFloor~levelCeil 로 막대를 그린다)
  const maxed = level >= MAX_LEVEL;
  const starFloor = XP_AT_MAX + st.stars * STAR_XP;
  return {
    xp,
    usageXp,
    bonusXp: bonus,
    level,
    maxLevel: MAX_LEVEL,
    maxed,
    ...st,
    levelFloor: maxed ? starFloor : 25 * (level - 1) ** 2,
    levelCeil: maxed ? starFloor + STAR_XP : 25 * level ** 2,
    stageIndex: si,
    stageKey: stage.key,
    stageName: stage.name,
    nextStageKey: next ? next.key : null,
    nextStageName: next ? next.name : null,
    xpToNext: next ? next.min - xp : 0,
    progress: Math.max(0, Math.min(1, progress)),
  };
}

module.exports = { FURS, EAR_SHAPES, STAGES, STAGE_FOLD, foldStage, computeGrowth, xpOf, levelOf, starsOf, MAX_LEVEL, XP_AT_MAX, STAR_XP, STAR_COINS, CHARS_PER_XP, XP_PER_LINK, XP_PER_NOTE, XP_PER_SESSION };
