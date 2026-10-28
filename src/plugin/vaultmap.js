// 홈이 보여 주는 볼트 모습 (2.0.0): 노트 지도(미니 그래프) · 최근 노트 · 외톨이 노트 · 데일리 노트 알아보기.
// 모두 읽기만 한다. 노트를 만들거나 고치지 않는다 (홈에서 누르면 이미 있는 노트를 열 뿐이다).
// app 은 옵시디언 App. isExcluded(path) 는 설정에서 뺀 폴더 · 숨김 폴더 (plugin/main.js 의 isExcludedPath)
const GRAPH_MAX = 36; // 지도에 그리는 노트 수 (사이드바에서도 알아볼 만큼)
const ORPHAN_SHOWN = 6;
const RECENT_MAX = 6;

const nameOf = (path) => {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.replace(/\.md$/, '');
};

// 옵시디언이 알아낸 링크로 이웃 표를 만든다. out: 노트 → 거기서 건 노트들, inn: 노트 → 그 노트를 건 노트들 (자기 자신 · 없는 노트는 뺀다)
function linkTable(app) {
  const resolved = app.metadataCache.resolvedLinks || {};
  const out = new Map();
  const inn = new Map();
  for (const [src, targets] of Object.entries(resolved)) {
    for (const dst of Object.keys(targets || {})) {
      if (dst === src) continue;
      if (!out.has(src)) out.set(src, new Set());
      out.get(src).add(dst);
      if (!inn.has(dst)) inn.set(dst, new Set());
      inn.get(dst).add(src);
    }
  }
  return { out, inn };
}

// 지금 노트 둘레의 지도: 가운데 노트에서 링크 두 걸음까지, 가까운 것부터 GRAPH_MAX 개.
// { center, nodes: [{ path, name, hop, deg, missing }], edges: [[i, j]], more } (center 가 없으면 null)
function localGraph(app, center, isExcluded = () => false, max = GRAPH_MAX) {
  if (!center || !app.vault.getAbstractFileByPath(center)) return null;
  const { out, inn } = linkTable(app);
  const near = (p) => new Set([...(out.get(p) || []), ...(inn.get(p) || [])]);
  const hop = new Map([[center, 0]]);
  let ring = [center];
  let more = 0;
  for (let h = 1; h <= 2 && ring.length; h++) {
    const next = [];
    // 이웃이 많은 노트부터 (허브가 먼저 보이게)
    const cand = [...new Set(ring.flatMap((p) => [...near(p)]))].filter((p) => !hop.has(p) && !isExcluded(p));
    cand.sort((a, b) => near(b).size - near(a).size || a.localeCompare(b));
    for (const p of cand) {
      if (hop.size >= max) {
        more++;
        continue;
      }
      hop.set(p, h);
      next.push(p);
    }
    ring = next;
  }
  const paths = [...hop.keys()];
  const index = new Map(paths.map((p, i) => [p, i]));
  const edges = [];
  for (const p of paths) for (const q of out.get(p) || []) if (index.has(q)) edges.push([index.get(p), index.get(q)]);
  const nodes = paths.map((p) => ({ path: p, name: nameOf(p), hop: hop.get(p), deg: near(p).size }));
  return { center, nodes, edges, more };
}

// 외톨이 노트: 거는 링크도 받는 링크도 없는 노트 (뺀 폴더는 안 본다). 경로 목록
function orphanNotes(app, isExcluded = () => false) {
  const { out, inn } = linkTable(app);
  return app.vault
    .getMarkdownFiles()
    .filter((f) => !isExcluded(f.path) && !(out.get(f.path) || new Set()).size && !(inn.get(f.path) || new Set()).size)
    .map((f) => f.path);
}

// 외톨이 노트 요약: 수와 최근에 고친 것부터 몇 개 (퀘스트 카드의 '어떤 노트?')
function orphanSummary(app, paths) {
  const files = paths.map((p) => app.vault.getAbstractFileByPath(p)).filter((f) => f && f.stat);
  files.sort((a, b) => b.stat.mtime - a.stat.mtime);
  return { n: paths.length, list: files.slice(0, ORPHAN_SHOWN).map((f) => ({ path: f.path, name: nameOf(f.path) })) };
}

// 최근 연 노트 (옵시디언이 기억하는 순서). 지금 있는 파일만
function recentNotes(app, isExcluded = () => false, n = RECENT_MAX) {
  const list = typeof app.workspace.getLastOpenFiles === 'function' ? app.workspace.getLastOpenFiles() : [];
  const out = [];
  for (const p of list) {
    if (out.length >= n) break;
    const f = app.vault.getAbstractFileByPath(p);
    if (!f || !f.stat || isExcluded(p) || !/\.(md|canvas)$/.test(p)) continue;
    out.push({ path: p, name: nameOf(p).replace(/\.canvas$/, ''), canvas: p.endsWith('.canvas'), mtime: f.stat.mtime });
  }
  return out;
}

// 오늘 고친 노트 수
function editedToday(app, isExcluded = () => false, now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return app.vault.getMarkdownFiles().filter((f) => f.stat.mtime >= from && !isExcluded(f.path)).length;
}

// 코어 '데일리 노트' 설정(폴더 · 날짜 형식)으로 데일리 노트를 알아본다. 설정이 없거나 읽을 수 없으면 null (이름이 YYYY-MM-DD 인 노트로 본다)
function dailyMatcher(app) {
  try {
    const dn = app.internalPlugins && app.internalPlugins.getPluginById && app.internalPlugins.getPluginById('daily-notes');
    const opt = dn && dn.enabled && dn.instance && dn.instance.options;
    const moment = typeof window !== 'undefined' && window.moment;
    if (!opt || !moment) return null;
    const format = (opt.format || 'YYYY-MM-DD').trim();
    const folder = String(opt.folder || '').replace(/^\/+|\/+$/g, '');
    return (path) => {
      if (!path.endsWith('.md')) return false;
      const slash = path.lastIndexOf('/');
      const dir = slash < 0 ? '' : path.slice(0, slash);
      // 형식에 '/' 가 들어 있으면(YYYY/MM/YYYY-MM-DD) 폴더 아래 경로 전체를 날짜로 읽는다
      const rest = folder ? (path.startsWith(folder + '/') ? path.slice(folder.length + 1) : null) : path;
      if (rest == null) return false;
      const stem = format.includes('/') ? rest.replace(/\.md$/, '') : rest.slice(rest.lastIndexOf('/') + 1).replace(/\.md$/, '');
      if (!format.includes('/') && folder && dir !== folder) return false;
      return moment(stem, format, true).isValid();
    };
  } catch (e) {
    return null;
  }
}

module.exports = { localGraph, orphanNotes, orphanSummary, recentNotes, editedToday, dailyMatcher, linkTable, GRAPH_MAX };
