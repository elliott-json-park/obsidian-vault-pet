// LP 판 그림 (2.10.0). 48×48 도트로 판 한 장을 canvas 에 찍는다.
//  draw(canvas, { hex, pat, label })  hex = 판 바탕색, pat = 무늬 이름 (core/lp.js 의 LP_PATTERNS.pat), label = 라벨 색
//  같은 입력이면 늘 같은 그림이다 (무늬 위치는 고정된 씨앗에서 나온다). 돌리는 것은 CSS 가 한다
(function (root) {
  const N = 48, C = 24;
  const rgb = (hex) => { const h = String(hex || '#000').replace('#', ''); return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0]; };
  const mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  const lum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const hue = (h, s, l) => { // hsl -> rgb
    const a = s * Math.min(l, 1 - l); const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  };
  const spots = (seed, n, rMin, rMax, pad) => { const r = rng(seed); const o = []; for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2; const d = rMin + pad + r() * (rMax - rMin - pad * 2); o.push([C + Math.cos(a) * d, C + Math.sin(a) * d, r()]); } return o; };
  const bmp = (rows, at, x, y, ox = 0, oy = 0) => { const w = rows[0].length, h = rows.length; const dx = Math.round(x - at[0]) + (w >> 1) + ox; const dy = Math.round(y - at[1]) + (h >> 1) + oy; return dx >= 0 && dx < w && dy >= 0 && dy < h ? rows[dy][dx] : '.'; };

  const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'];
  const PAW = ['#.#.#.#', '.......', '..###..', '.#####.', '.#####.', '..#.#..'];
  const FLOWER = ['.#.', '#o#', '.#.'];
  const NOTE = ['..##', '..#.', '..#.', '..#.', '###.', '###.'];
  const CAT = ['#.....#', '##...##', '#######', '##.#.##', '.#####.'];
  const CONFETTI = ['#e8736c', '#f2c14e', '#6cc3d5', '#9dc96a', '#c38be0', '#f08fb4'];
  const RAIN = [[232, 90, 90], [240, 160, 70], [240, 215, 80], [110, 200, 110], [90, 170, 230], [130, 110, 220], [200, 110, 210]];

  // 무늬 하나 = { name, prep(ctx) -> state, at(x,y,dx,dy,r,ang,ctx,st) -> [r,g,b] | null }
  const P = {
    plain: { at: () => null },
    rings: { at: (x, y, dx, dy, r, a, c) => (((r - 10.4) | 0) % 6 < 2 ? mix(c.base, c.pc, 0.55) : null) },
    stripes: { at: (x, y, dx, dy, r, a, c) => ((((x + y) >> 2) % 2 === 0) ? mix(c.base, c.pc, 0.55) : null) },
    checker: { at: (x, y, dx, dy, r, a, c) => ((((x >> 2) + (y >> 2)) % 2 === 0) ? mix(c.base, c.pc, 0.55) : null) },
    sunburst: { at: (x, y, dx, dy, r, a, c) => (Math.floor(((a + Math.PI) / (Math.PI / 8)) % 16) % 2 === 0 ? mix(c.base, c.pc, 0.55) : null) },
    splatter: { prep: () => spots(7, 16, 10, 22, 1).map((p) => [p[0], p[1], 1 + p[2] * 1.7]), at: (x, y, dx, dy, r, a, c, st) => (st.some((b) => Math.hypot(x + 0.5 - b[0], y + 0.5 - b[1]) < b[2]) ? c.pc : null) },
    stars: { prep: () => spots(11, 9, 10, 22, 2), at: (x, y, dx, dy, r, a, c, st) => (st.some((s) => (x === Math.round(s[0]) && Math.abs(y - Math.round(s[1])) <= 2) || (y === Math.round(s[1]) && Math.abs(x - Math.round(s[0])) <= 2)) ? c.pc : null) },
    hearts: { prep: () => spots(23, 6, 10, 22, 3), at: (x, y, dx, dy, r, a, c, st) => (st.some((h) => bmp(HEART, h, x, y) === '#') ? c.pc : null) },
    // ---- 새 무늬 ----
    dots: { at: (x, y, dx, dy, r, a, c) => ((((x % 6) - 2.5) ** 2 + ((y % 6) - 2.5) ** 2) < 2.6 ? c.pc : null) },
    waves: { at: (x, y, dx, dy, r, a, c) => (Math.floor((r + Math.sin(a * 8) * 1.4) / 2.4) % 2 === 0 ? mix(c.base, c.pc, 0.55) : null) },
    zigzag: { at: (x, y, dx, dy, r, a, c) => ((((y + Math.abs((x % 8) - 4)) >> 2) % 2) === 0 ? mix(c.base, c.pc, 0.55) : null) },
    spiral: { at: (x, y, dx, dy, r, a, c) => { const v = (((r / 2.4 - (a / (Math.PI * 2)) * 3) % 1) + 1) % 1; return v < 0.5 ? mix(c.base, c.pc, 0.6) : null; } },
    marble: { at: (x, y, dx, dy, r, a, c) => { const v = Math.sin(x * 0.28 + Math.sin(y * 0.23) * 2.4) + Math.sin(y * 0.31 + Math.sin(x * 0.19) * 2.1); return v > 0.55 ? mix(c.base, c.pc, 0.7) : v < -1.35 ? c.pc2 : null; } },
    split: { at: (x, y, dx, dy, r, a, c) => ((dx * 0.8 + dy * 0.6 > 0) ? mix(c.base, c.pc2, 0.9) : null) },
    galaxy: { prep: () => ({ neb: spots(5, 5, 8, 20, 2).map((p) => [p[0], p[1], 5 + p[2] * 5]), st: spots(31, 22, 10, 22, 1) }), at: (x, y, dx, dy, r, a, c, s) => { if (s.st.some((q) => x === Math.round(q[0]) && y === Math.round(q[1]))) return [255, 255, 255]; let t = 0; for (const n of s.neb) { const d = Math.hypot(x - n[0], y - n[1]); if (d < n[2]) t = Math.max(t, 1 - d / n[2]); } return t > 0.12 ? mix(c.base, c.pc2, Math.min(0.85, t)) : null; } },
    paws: { prep: () => spots(41, 6, 11, 21, 3), at: (x, y, dx, dy, r, a, c, st) => (st.some((p) => bmp(PAW, p, x, y) === '#') ? c.pcs : null) },
    flowers: { prep: () => spots(53, 11, 10, 22, 2), at: (x, y, dx, dy, r, a, c, st) => { for (const f of st) { const b = bmp(FLOWER, f, x, y); if (b === '#') return c.pcs; if (b === 'o') return [240, 200, 70]; } return null; } },
    notes: { prep: () => spots(61, 8, 11, 21, 3), at: (x, y, dx, dy, r, a, c, st) => (st.some((n) => bmp(NOTE, n, x, y) === '#') ? c.pcs : null) },
    diamonds: { at: (x, y, dx, dy, r, a, c) => { const u = Math.abs((x % 8) - 4) + Math.abs((y % 8) - 4); return u < 2.2 ? c.pc : u > 5.6 ? mix(c.base, c.pc2, 0.5) : null; } },
    confetti: { prep: () => { const q = rng(71); const o = []; for (let i = 0; i < 30; i++) { const a = q() * 6.283; const d = 11 + q() * 10; o.push([Math.round(C + Math.cos(a) * d), Math.round(C + Math.sin(a) * d), q() < 0.5, Math.floor(q() * CONFETTI.length)]); } return o; }, at: (x, y, dx, dy, r, a, c, st) => { for (const k of st) { if (k[2] ? (y === k[1] && x >= k[0] && x <= k[0] + 2) : (x === k[0] && y >= k[1] && y <= k[1] + 2)) return rgb(CONFETTI[k[3]]); } return null; } },
    rainbow: { at: (x, y, dx, dy, r, a, c) => { const i = Math.floor((r - 10.4) / 1.7); return i >= 0 && i < 7 ? mix(c.base, RAIN[i], 0.8) : null; } },
    leopard: { prep: () => spots(83, 15, 10, 22, 2).map((p) => [p[0], p[1], 1.7 + p[2] * 1.2]), at: (x, y, dx, dy, r, a, c, st) => { for (const s of st) { const d = Math.hypot(x + 0.5 - s[0], y + 0.5 - s[1]); if (c.light) { if (d < s[2] * 0.55) return mix(c.base, c.pc, 0.2); if (d < s[2]) return mix(c.base, [0, 0, 0], 0.62); } else { if (d < s[2] * 0.5) return mix(c.base, [0, 0, 0], 0.4); if (d < s[2]) return [214, 160, 80]; } } return null; } },
    cats: { prep: () => spots(97, 6, 11, 21, 3), at: (x, y, dx, dy, r, a, c, st) => (st.some((q) => bmp(CAT, q, x, y) === '#') ? c.pcs : null) },
  };

  function draw(canvas, o) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = N; canvas.height = N;
    const base = rgb(o.hex || '#1c1c22'); const patName = P[o.pat] ? o.pat : 'plain'; const label = rgb(o.label || '#f2c14e');
    const light = lum(base) > 0.6;
    const c = { base, pc: light ? mix(base, [0, 0, 0], 0.32) : mix(base, [255, 255, 255], 0.5), light };
    c.pcs = light ? mix(base, [0, 0, 0], 0.55) : mix(base, [255, 255, 255], 0.8); // 작은 그림용(더 또렷하게)
    c.pc2 = light ? mix(base, [70, 90, 200], 0.55) : mix(base, hue((((Math.atan2(base[1] - 128, base[0] - 128) * 180) / Math.PI) + 150 + 360) % 360, 0.65, 0.58), 0.8);
    const edge = mix(base, [0, 0, 0], 0.45), groove = mix(base, [0, 0, 0], light ? 0.14 : 0.3), hi = mix(base, [255, 255, 255], light ? 0.25 : 0.12);
    const pat = P[patName]; const st = pat.prep ? pat.prep() : null;
    const img = ctx.createImageData(N, N);
    const put = (x, y, col) => { const i = (y * N + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - C, dy = y + 0.5 - C, r = Math.hypot(dx, dy);
      if (r > 23.6) continue;
      if (r < 1.5) { put(x, y, [14, 14, 18]); continue; }
      if (r < 8.6) { put(x, y, r > 7.5 ? mix(label, [0, 0, 0], 0.35) : r < 3 ? mix(label, [0, 0, 0], 0.18) : label); continue; }
      if (r > 22.4) { put(x, y, edge); continue; }
      let col = base;
      if (r < 10.4) col = groove; else if (Math.floor(r) % 3 === 0) col = groove; else if (Math.floor(r) % 7 === 0) col = hi;
      if (r > 10.4) { const v = pat.at(x, y, dx, dy, r, Math.atan2(dy, dx), c, st); if (v) col = v; }
      const ang = Math.atan2(dy, dx); const a1 = Math.abs(((ang + Math.PI * 2 - 0.5) % Math.PI) - 0.2);
      if (r > 10.4 && a1 < 0.16) col = mix(col, [255, 255, 255], 0.16);
      put(x, y, col);
    }
    ctx.putImageData(img, 0, 0);
  }
  root.LpArt = { draw, N, PATTERNS: Object.keys(P) };
  if (typeof module === 'object' && module.exports) module.exports = root.LpArt;
})(typeof globalThis !== 'undefined' ? globalThis : this);
