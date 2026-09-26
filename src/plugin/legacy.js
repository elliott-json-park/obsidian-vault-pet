// Vault Pet 0.x (다섯 친구 펫) 에서 넘어온 data.json 을 알아보고, 기념 선물을 정한다.
// 0.x 의 data.json 은 { schema, settings, state: { party, partner, bonus, … }, ledger: { tot, … } } 모양이고 version 이 없다.
// 새 판(1.1+)은 { version, settings, state, usage, meta } 다. 예전 성장은 새 고양이로 잇지 않고, 쌓은 만큼 코인과 기념 코스튬으로 돌려준다.

const { folderKey } = require('../core/usage');

const DAY = 86_400_000;
// 0.x 의 경험치 공식 (특기 배율은 빼고 센다)
const CHARS_PER_XP = 20;
const XP_PER_LINK = 5;
const XP_PER_NOTE = 15;
// 선물 코인: 기본 500 + 예전 경험치의 절반, 최대 30,000 (10 단위로 반올림)
const BASE_COINS = 500;
const MAX_COINS = 30_000;
const LEGACY_COSTUME = 'vpEggshell';
// 새 판 설정과 뜻이 같아서 그대로 옮기는 것들
const CARRY_SETTINGS = ['soundEnabled', 'bubblesEnabled', 'chatter', 'lunchEnabled', 'lunchTime', 'dinnerEnabled', 'dinnerTime', 'lateNightEnabled'];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const levelOf = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1;

function isLegacy(raw) {
  return !!(raw && typeof raw === 'object' && raw.version === undefined && raw.state && typeof raw.state === 'object');
}

function xpOf(t) {
  return Math.floor(num(t.c) / CHARS_PER_XP) + num(t.l) * XP_PER_LINK + num(t.n) * XP_PER_NOTE;
}

// 예전에 모은 경험치. 파트너는 지금 자라는 몫까지, 쉬는 친구는 얼려 둔 몫(frozen)을 더한다
function legacyXp(raw) {
  const st = raw.state || {};
  const tot = (raw.ledger && raw.ledger.tot) || {};
  const bonus = Array.isArray(st.bonus) ? st.bonus : [];
  const bonusSince = (since) => bonus.reduce((a, b) => a + (b && num(b.at) >= since ? num(b.xp) : 0), 0);
  const party = st.party && typeof st.party === 'object' ? st.party : null;
  if (!party || !party[st.partner]) {
    // 0.1.x: 펫이 하나뿐이었다
    const xp = xpOf(tot) + bonusSince(0);
    return { total: xp, partner: xp };
  }
  let total = 0;
  let partner = 0;
  for (const [key, pet] of Object.entries(party)) {
    if (!pet || typeof pet !== 'object') continue;
    let xp = num(pet.frozen) + num(pet.startXp);
    if (key === st.partner) {
      const b = pet.base;
      const used = b ? { c: Math.max(0, num(tot.c) - num(b.c)), l: Math.max(0, num(tot.l) - num(b.l)), n: Math.max(0, num(tot.n) - num(b.n)) } : tot;
      xp += xpOf(used) + bonusSince(num(pet.since));
      partner = xp;
    }
    total += xp;
  }
  return { total, partner };
}

// 처음 만난 날. 없으면 가장 이른 보너스·업적 시각으로 짐작한다
function firstSeen(st, now) {
  let first = num(st.installedAt) || now;
  for (const b of Array.isArray(st.bonus) ? st.bonus : []) if (b && num(b.at) > 0 && num(b.at) < first) first = num(b.at);
  for (const at of Object.values(st.achievements || {})) if (num(at) > 0 && num(at) < first) first = num(at);
  return first;
}

function coinsFor(xp) {
  return Math.min(MAX_COINS, Math.round((BASE_COINS + Math.max(0, xp) / 2) / 10) * 10);
}

// 선물과 안내 창에 쓸 것들
function legacySummary(raw, now = Date.now()) {
  const st = raw.state || {};
  const xp = legacyXp(raw);
  const pet = st.party && st.party[st.partner];
  const name = (pet && pet.name) || (raw.settings && raw.settings.petName) || '';
  return {
    xp: xp.total,
    level: levelOf(xp.partner),
    days: Math.max(1, Math.ceil((now - firstSeen(st, now)) / DAY)),
    petName: String(name).slice(0, 40),
    coins: coinsFor(xp.total),
    costume: LEGACY_COSTUME,
  };
}

// 새 판 설정으로 옮길 것. language 는 'ko' | 'en' 일 때만 ('auto' 면 옵시디언 언어를 따르게 비워 둔다)
function legacySettings(raw) {
  const old = (raw && raw.settings) || {};
  const out = {};
  for (const k of CARRY_SETTINGS) if (old[k] !== undefined) out[k] = old[k];
  if (old.language === 'ko' || old.language === 'en') out.language = old.language;
  // 경험치에서 뺀 폴더: 0.x 는 폴더 경로를, 새 판은 맨 윗단 폴더 이름의 해시를 쓴다
  if (Array.isArray(old.excludedFolders)) {
    const tops = old.excludedFolders.map((f) => String(f).replace(/^\/+/, '').split('/')[0]).filter(Boolean);
    if (tops.length) out.excludedProjects = [...new Set(tops.map(folderKey))];
  }
  return out;
}

module.exports = { isLegacy, legacyXp, legacySummary, legacySettings, coinsFor, LEGACY_COSTUME };
