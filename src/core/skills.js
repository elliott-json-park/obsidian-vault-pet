// 옵시디언 기술 목록 (2.0.0). 퀘스트 · 업적 · 홈이 같은 이름표를 쓴다.
// 다음 단계(고양이가 회차별로 옵시디언 쓰는 법을 안내하는 교육 자료)가 "이 기술을 해 봤나"를 여기서 그대로 읽는다.
//  how  : 처음 해 보는 사람을 위한 안내 문구 키 (i18n 'skill.<key>.how')
//  used : gamify 의 context(c) 로 지금까지 몇 번 했는지

// 옵시디언 화면(뷰) 중 열어 본 걸 세는 것. 키 = 옵시디언 뷰 종류 (plugin/main.js 가 view_<종류> 로 센다)
const VIEWS = ['graph', 'localgraph', 'search', 'backlink', 'outgoing-link', 'outline', 'tag', 'bookmarks'];

const cnt = (c, k) => (c.st && c.st.cnt && c.st.cnt[k]) || 0;
const feat = (c, k) => ((c.use && c.use.feat) || {})[k] || 0;

const SKILLS = [
  { key: 'write', used: (c) => c.all.c },
  { key: 'link', used: (c) => c.all.l },
  { key: 'tag', used: (c) => feat(c, 'tag') },
  { key: 'heading', used: (c) => feat(c, 'head') },
  { key: 'task', used: (c) => feat(c, 'done') },
  { key: 'daily', used: (c) => feat(c, 'daily') + feat(c, 'dailyc') },
  { key: 'property', used: (c) => feat(c, 'prop') },
  { key: 'embed', used: (c) => feat(c, 'embed') },
  { key: 'callout', used: (c) => feat(c, 'callout') },
  { key: 'canvas', used: (c) => feat(c, 'canvas') },
  { key: 'organize', used: (c) => cnt(c, 'move') + cnt(c, 'retitle') },
  { key: 'orphan', used: (c) => cnt(c, 'orphanFix') },
  { key: 'graph', used: (c) => cnt(c, 'view_graph') + cnt(c, 'view_localgraph') },
  { key: 'search', used: (c) => cnt(c, 'view_search') },
  { key: 'backlink', used: (c) => cnt(c, 'view_backlink') + cnt(c, 'view_outgoing-link') },
  { key: 'outline', used: (c) => cnt(c, 'view_outline') },
];

// 해 본 기술 키 목록
const triedSkills = (c) => SKILLS.filter((s) => s.used(c) > 0).map((s) => s.key);

module.exports = { VIEWS, SKILLS, triedSkills };
