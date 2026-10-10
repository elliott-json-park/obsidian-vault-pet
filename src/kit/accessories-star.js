// 별 상점 코스튬 (8차, 2026-10-09): Lv80 뒤 쌓이는 별로만 사는 '끝판왕' 코스튬.
// 칸마다 시안을 그려 사용자가 고른 것 그대로다 (claude-pet-costume-lab 방식). 상점 목록 · 별 값은 main/shop.js 의 ACCESSORIES 에서 stars 가 붙은 것,
// 이름은 i18n.js 의 'item.<key>'. 그림 도구는 accessories.js 끝의 PetSprite.costumeKit 을 쓴다

// ---------- set ----------
// 별 상점 "끝판왕" 세트 시안 5안 (2026-10-09). 머리(hood)+몸(wear)을 한 벌로 칠하고 소품·광채·움직임까지
(function (root) {
  const { GROUND, sway, hash, mirror, heldPaw, wear, hood, isFace, star } = root.PetSprite.costumeKit;

  // ---------- 도우미 ----------
  const tw = (t, i, sp = 2) => 0.5 + 0.5 * Math.sin(t * sp + i * 1.7); // 반짝 세기 0~1
  const hsl = (h, s, l, al = 1) => `hsla(${(((h % 360) + 360) % 360).toFixed(0)},${s}%,${l.toFixed(0)}%,${al})`;
  // 오른손 소품 자리. 앞발 쓰는 모션 동안은 null
  const hand = (r, a) => (r.pawsBusy ? null : a.curled ? { x: a.right + 2, y: GROUND - 1, curled: true } : { x: a.right + 1, y: a.cy + 1 });
  // 두 점을 잇는 선. col(u, i) 함수면 칸마다 색을 고른다
  function seg(r, x0, y0, x1, y1, col, solid = true) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const cc = typeof col === 'function' ? col(u, i) : col;
      if (cc) r.px(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), cc, solid);
    }
  }
  // 둥근 반투명 광채 (가운데가 가장 진하다)
  function glow(r, cx, cy, rx, ry, rgb, peak) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (e < 1) r.px(x, y, `rgba(${rgb},${(peak * (1 - e)).toFixed(3)})`, false);
      }
  }
  function inPoly(x, y, pts) {
    let ins = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }
  // 위로 떠오르는 입자
  function rise(r, t, n, x0, x1, yb, h, col, speed = 0.5, seed = 0) {
    for (let i = 0; i < n; i++) {
      const p = (t * speed + hash(i + seed)) % 1;
      const x = Math.round(x0 + hash(i * 5 + seed) * (x1 - x0) + Math.sin(t * 2 + i) * 0.8);
      r.px(x, Math.round(yb - p * h), typeof col === 'function' ? col(i, p) : col, false);
    }
  }
  // 작은 불꽃 (w 폭, h 높이). 아래는 희고 끝은 붉다
  function flame(r, t, cx, by, w, h, pal, seed = 0) {
    for (let j = 0; j < h; j++) {
      const q = j / h;
      const half = Math.max(0, Math.round((w / 2) * (1 - q * q) + Math.sin(t * 9 + j + seed) * 0.4));
      const off = Math.round(Math.sin(t * 7 + j * 0.9 + seed) * q * 1.2);
      for (let dx = -half; dx <= half; dx++) {
        const edge = Math.abs(dx) / Math.max(1, half);
        const k = Math.min(pal.length - 1, Math.floor(q * (pal.length - 1) + edge * 1.6));
        r.px(cx + dx + off, by - j, pal[k], false);
      }
    }
  }
  const FIRE = ['#ffffff', '#fff0a0', '#ffd24a', '#ff8a1a', '#e8401a', 'rgba(200,30,20,0.7)'];
  // 펄럭이는 망토 (몸 뒤). 아래로 갈수록 넓어지고 바람에 날린다
  function cape(r, a, t, main, dark, light, trim) {
    if (a.curled) return;
    const y0 = a.my - 1, y1 = GROUND;
    for (let y = y0; y <= y1; y++) {
      const d = y - y0;
      const wave = Math.sin(t * 3.2 - d * 0.7);
      const blow = Math.round(d * 0.35 + wave * (0.4 + d * 0.12));
      const w = 7 + Math.round(d * 0.9);
      const xl = a.hx - w - blow, xr = a.hx + w - Math.round(blow * 0.4);
      for (let x = xl; x <= xr; x++) {
        const fold = Math.sin((x - a.hx) * 0.9 + t * 2.4 - d * 0.4);
        let col = fold > 0.55 ? light : fold < -0.55 ? dark : main;
        if (x === xl || x === xr) col = trim;
        if (y === y1 && Math.sin(x * 1.3 + t * 4) > 0.3) continue;
        if (y === y1) col = trim;
        r.px(x, y, col);
      }
    }
  }
  // 반짝이 별 몇 개가 정해진 자리에서 번갈아 켜진다
  function twinkles(r, t, pts, col = '#ffffff', sp = 2.2) {
    pts.forEach(([x, y], i) => {
      const k = tw(t, i * 2.3, sp);
      if (k > 0.82) star(r, x, y, col);
      else if (k > 0.55) r.px(x, y, col, false);
    });
  }

  // 숲 정령 빛: 몸 둘레를 타원으로 돈다. 뒤쪽 반바퀴는 back, 앞쪽 반바퀴는 front 에서 그린다
  function wispDraw(a, t, front) {
    for (let i = 0; i < 5; i++) {
      const an = t * 0.9 + (i / 5) * Math.PI * 2;
      if (Math.sin(an) > 0 !== front) continue;
      const x = a.cx + Math.cos(an) * 15, y = a.cy - 6 + Math.sin(an) * 9 + Math.sin(t * 3 + i) * 0.8;
      glow(this, x + 0.5, y + 0.5, 2.5, 2.5, '200,255,160', 0.55);
      this.px(Math.round(x), Math.round(y), '#f4ffe0', false);
      const tx = a.cx + Math.cos(an - 0.15) * 15, ty = a.cy - 6 + Math.sin(an - 0.15) * 9;
      this.px(Math.round(tx), Math.round(ty), 'rgba(200,255,160,0.5)', false);
    }
  }

  const LAB = {
    // =====================================================================
    // 1. 천상의 황제 갑옷 — 백금 투구에 날개 장식, 사파이어 박힌 황금 대관, 등 뒤로 도는 황금 후광 바퀴,
    //    흰 비단 망토, 황금 견갑, 손에는 사파이어 구슬 왕홀
    xcelestialemperor: {
      back(g, a, c, t) {
        const cx = a.hx, cy = a.ey - 4;
        const R = a.curled ? 9 : 11;
        glow(this, cx, cy, R + 5, R + 4, '255,236,170', 0.3 + 0.1 * Math.sin(t * 2));
        // 바퀴 살: 열두 줄기 빛이 천천히 돈다 (긴 것·짧은 것 번갈아, 숨 쉬듯 늘었다 줄었다)
        for (let k = 0; k < 12; k++) {
          const an = (k / 12) * Math.PI * 2 + t * 0.4;
          const len = k % 2 ? 2 : 3 + Math.round(tw(t, k, 3) * 2);
          for (let s = 1; s <= len; s++) this.px(Math.round(cx + Math.cos(an) * (R + s)), Math.round(cy + Math.sin(an) * (R + s)), `rgba(255,232,140,${(0.95 - (s / (len + 1)) * 0.7).toFixed(2)})`, false);
        }
        // 금 바퀴 (빛이 테를 따라 한 바퀴 돈다) + 안쪽 가는 테
        for (let i = 0; i < 80; i++) {
          const an = (i / 80) * Math.PI * 2;
          const d = (((an - t * 1.6) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const col = d < 0.3 ? '#ffffff' : d < 0.8 ? '#fff2b0' : i % 10 === 0 ? '#b8861a' : '#f4c84a';
          this.px(Math.round(cx + Math.cos(an) * R), Math.round(cy + Math.sin(an) * R), col);
          this.px(Math.round(cx + Math.cos(an) * (R - 1)), Math.round(cy + Math.sin(an) * (R - 1)), d < 0.5 ? '#fff2b0' : '#c8962a');
          if (i % 2 === 0) this.px(Math.round(cx + Math.cos(an) * (R - 3)), Math.round(cy + Math.sin(an) * (R - 3)), 'rgba(255,230,150,0.45)', false);
        }
        // 바퀴에 박힌 사파이어 넷 (살과 같이 돈다)
        for (let k = 0; k < 4; k++) {
          const an = (k / 4) * Math.PI * 2 + t * 0.4 + Math.PI / 4;
          this.pattern(['.S.', 'SWS', '.S.'], Math.round(cx + Math.cos(an) * R) - 1, Math.round(cy + Math.sin(an) * R) - 1, { S: '#3a5cf0', W: '#c8d8ff' });
        }
        cape(this, a, t, '#f4f2ff', '#c8c4e4', '#ffffff', '#f4c84a');
      },
      front(g, a, c, t) {
        const P = '#eef1f8', p = '#b4bccd', Wt = '#ffffff', G = '#f4c84a', gd = '#b8861a', gh = '#fff0b0', Sa = '#3a5cf0';
        // 백금 투구: 금 이마띠에 사파이어, 금 능선, 볼 가리개 금테, 왼쪽 위 빛
        hood(this, g, a, (dx, y, x, j) => {
          const adx = Math.abs(dx);
          if (isFace(a, dx, y)) return null;
          if (j <= 1) return adx >= 4 ? G : gh;
          if (y === a.ey - 2) return adx % 3 === 0 ? Sa : G;
          if (dx === 0 && y < a.ey - 2) return G;
          if (adx === 5 && y >= a.ey - 1) return G;
          if (dx <= -3 && y < a.ey - 2) return Wt;
          return adx >= 5 ? p : P;
        });
        // 흰 깃털 날개 장식 (관자놀이에서 위로 솟아 살랑)
        const f = Math.round(Math.sin(t * 3) * 0.8);
        const wing = ['W......', 'WW.....', 'wWW....', '.wWWW..', '..wWWWK', '...wwWK', '.....KK'];
        const wm = { W: '#ffffff', w: '#c8d0ea', K: '#8a93b0' };
        const dxs = [-f, -f, -f, 0, 0, 0, 0];
        wing.forEach((row, j) => this.pattern([row], a.left - 7 + dxs[j], a.top - 5 + j, wm));
        mirror(wing).forEach((row, j) => this.pattern([row], a.right + 1 - dxs[j], a.top - 5 + j, wm));
        // 황금 대관: 다섯 봉우리, 가운데 큰 사파이어가 맥동, 진주 줄과 보석 띠
        const pulse = tw(t, 0, 3);
        const big = pulse > 0.75 ? '#c8d8ff' : '#3a5cf0';
        this.pattern(
          ['.......X.......', '......XGX......', '......GSG......', '..X...GSG...X..', '.XGX..KGK..XGX.', '.GRG.GGGGG.GRG.', 'KGGGGGhhhGGGGGK', 'KGHGHGHGHGHGHGK', 'KsGsGSGsGSGsGsK', 'KgggggggggggggK'],
          a.hx - 7, a.top - 10, { X: gh, G, g: gd, h: gh, H: '#ffffff', K: '#8a5a10', S: big, s: Sa, R: '#e0304a' },
        );
        if (pulse > 0.85) star(this, a.hx, a.top - 11, '#ffffff');
        glow(this, a.hx + 0.5, a.top - 7.5, 3, 3, '140,170,255', 0.5 * pulse);
        // 갑옷: 백금 가슴판에 금 십자, 금 견갑, 다리는 금 테 정강이받이
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return adx % 3 === 0 ? G : p;
          if (dy === -3) return gh;
          if (adx >= 5) return dy === -2 ? gh : dy <= -1 ? G : gd;
          if (dx === 0 || (dy === 0 && adx <= 2)) return G;
          return dx < 0 ? P : p;
        });
        if (!a.curled) {
          // 층층 견갑 (어깨 밖으로 퍼진다)
          const pa = ['..KKK', '.KhGG', 'KGhGG', 'KgGGg', '.Kggk'];
          const pm = { K: '#8a5a10', G, g: gd, h: '#ffffff', k: '#8a5a10' };
          this.pattern(pa, a.left - 4, a.my + 1, pm);
          this.pattern(mirror(pa), a.right, a.my + 1, pm);
          // 가슴 사파이어: 빛이 맥동
          this.pattern(['.S.', 'SWS', '.S.'], a.hx - 1, a.my + 2, { S: Sa, W: pulse > 0.6 ? '#ffffff' : '#9ab0ff' });
          glow(this, a.hx + 0.5, a.my + 3.5, 3.5, 3, '140,170,255', 0.45 * pulse);
        }
        // 왕홀: 금 자루 끝에 사파이어 구슬, 그 둘레로 빛 고리
        const h = hand(this, a);
        if (h) {
          const orb = (cx, cy) => {
            glow(this, cx, cy, 5, 5, '130,160,255', 0.25 + 0.3 * pulse);
            this.ellipse(cx, cy, 2.5, 2.5, (x, y) => (x + 0.5 < cx - 0.6 && y + 0.5 < cy - 0.6 ? '#c8d8ff' : y + 0.5 > cy + 1 ? '#1e34a8' : '#3a5cf0'), '#14206a');
            this.px(Math.floor(cx) - 1, Math.floor(cy) - 1, '#ffffff');
          };
          if (h.curled) {
            for (let x = h.x; x <= h.x + 5; x++) { this.px(x, GROUND - 1, x % 3 ? G : gh); this.px(x, GROUND, gd); }
            orb(h.x + 8.5, GROUND - 1.5);
          } else {
            const sx = h.x + 1;
            for (let y = a.cy - 13; y <= a.cy + 3; y++) { this.px(sx, y, y % 4 === 0 ? gh : G); this.px(sx + 1, y, gd); }
            // 구슬 받침 날개
            this.pattern(['W.....W', 'WG...GW', '.GGGGG.'], sx - 3 + 0, a.cy - 15, { W: '#ffffff', G });
            orb(sx + 1, a.cy - 17.5);
            heldPaw(this, g, sx, a.cy + 1);
            // 구슬에서 떨어지는 빛가루
            for (let i = 0; i < 3; i++) {
              const q = (t * 0.8 + i / 3) % 1;
              this.px(Math.round(sx + Math.sin(i * 2.1 + t) * 3), Math.round(a.cy - 16 + q * 14), `rgba(200,215,255,${(1 - q).toFixed(2)})`, false);
            }
          }
        }
        twinkles(this, t, [[a.left - 9, a.top - 8], [a.right + 9, a.top - 2], [a.left - 6, a.my + 4], [a.right + 6, a.top - 12]], '#fff6c8');
      },
    },

    // =====================================================================
    // 2. 성운 용기사 — 흑요석 용린 투구에 휘어 오른 두 뿔, 이마 결의 빛줄이 성운색으로 흐르고,
    //    등 뒤엔 별이 박힌 성운 막의 용 날개가 펄럭, 손엔 성운 수정 창
    xnebuladragoon: {
      back(g, a, c, t) {
        // 성운 먼지
        rise(this, t, 12, a.hx - 16, a.hx + 16, GROUND, 26, (i, p) => hsl(250 + i * 17 + t * 30, 90, 70, (0.9 * (1 - p)).toFixed(2)), 0.25, 13);
        if (a.curled) return;
        for (const s of [-1, 1]) {
          const rx = a.hx + s * 4, ry = a.ey + 1;
          const fl = Math.sin(t * 2.2);
          const T = [[9, -14, 1], [13, -8, 0.7], [13, -1, 0.45]].map(([x, y, k]) => [rx + s * x, ry + y + fl * 2 * k]);
          const B = [rx + s * 8, ry + 6];
          const mid = (p, q, k) => [rx + ((p[0] + q[0]) / 2 - rx) * k, ry + ((p[1] + q[1]) / 2 - ry) * k];
          const poly = [[rx, ry], T[0], mid(T[0], T[1], 0.8), T[1], mid(T[1], T[2], 0.82), T[2], mid(T[2], B, 0.85), B];
          const xs = poly.map((q) => q[0]), ys = poly.map((q) => q[1]);
          const ins = (x, y) => inPoly(x + 0.5, y + 0.5, poly);
          for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
            for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
              if (!ins(x, y)) continue;
              const edge = !ins(x - 1, y) || !ins(x + 1, y) || !ins(x, y - 1) || !ins(x, y + 1);
              let col;
              if (edge) col = '#7a5ad0';
              else if (hash(x * 31 + y * 17) > 0.9 && tw(t, x + y * 3, 3) > 0.55) col = '#ffffff';
              else col = hsl(255 + 55 * Math.sin(x * 0.3 + y * 0.2 - t * 1.4), 72, 30 + 16 * (0.5 + 0.5 * Math.sin(x * 0.25 - y * 0.35 + t * 1.1)));
              this.px(x, y, col);
            }
          // 뼈대: 흑요석 뼈에 보랏빛 윤, 끝은 은빛 발톱
          T.forEach((q, i) => {
            seg(this, rx, ry, q[0], q[1], (u) => (u > 0.9 ? '#e8e0ff' : '#1a1230'));
            if (i === 0) seg(this, rx, ry - 1, q[0], q[1] - 1, (u) => (u > 0.15 && u < 0.85 ? '#7a5ad0' : null));
          });
        }
      },
      front(g, a, c, t) {
        const hue = 250 + 60 * Math.sin(t * 1.3);
        // 흑요석 투구: 비늘 결, 이마엔 성운빛 줄이 흐른다
        hood(this, g, a, (dx, y, x, j) => {
          const adx = Math.abs(dx);
          if (isFace(a, dx, y)) return null;
          if (j <= 1) return '#2a1f48';
          if (y === a.ey - 2) return hsl(hue + dx * 12, 95, 62);
          if (adx === 5 && y >= a.ey - 1) return '#9a8ad0';
          const sc = (x + (y % 2) * 2) % 4 === 0;
          if (adx >= 5) return sc ? '#2e2350' : '#140e24';
          if (dx <= -2 && y < a.ey - 2) return sc ? '#7a64c8' : '#3b2d66';
          return sc ? '#4a3a80' : '#261d44';
        });
        // 휘어 오른 두 뿔 (뿌리는 흑요석, 끝으로 갈수록 성운빛)
        const hk = a.curled ? 0.6 : 1; // 웅크리면 뿔을 짧게 (머리 위로 떠 보이지 않게)
        for (const s of [-1, 1]) {
          for (let k = 0; k <= 12; k++) {
            const u = k / 12;
            const x = Math.round(a.hx + s * (3 + (7 * u - 2 * u * u) * hk));
            const y = Math.round(a.top + (a.curled ? 1 : -1) - (10 * u - 2 * u * u) * hk);
            const col = u < 0.3 ? '#5a46a0' : u < 0.75 ? '#b8a8f0' : u < 0.95 ? hsl(hue + 40, 95, 78) : '#ffffff';
            this.px(x, y, col);
            if (u < 0.6) this.px(x + s, y, u < 0.3 ? '#3b2d66' : '#7a64c8');
            if (u > 0.1 && u < 0.85) this.px(x, y - 1, '#120c20');
          }
          glow(this, a.hx + s * (3 + 5 * hk), a.top - 8 * hk, 2.5, 2.5, '180,140,255', 0.5 * tw(t, s, 2.5));
        }
        // 이마 지느러미
        this.pattern(['.N.', 'KNK', 'KnK'], a.hx - 1, a.top - 3, { K: '#120c20', N: hsl(hue, 90, 70), n: '#5a46a0' });
        // 용린 갑옷: 비늘이 엇갈려 박히고, 어깨는 보랏빛 판
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#1a1230';
          if (dy === -3) return '#2e2350';
          if (adx >= 5) return dy <= -1 ? '#5a3fa0' : '#2e2350';
          const sc = (x + (y % 2)) % 2 === 0;
          return sc ? '#3b2d66' : '#241a44';
        });
        if (!a.curled) {
          // 어깨 가시 (바깥으로 뻗는다)
          for (const s of [-1, 1]) {
            const ex = s < 0 ? a.left : a.right;
            seg(this, ex, a.my + 2, ex + s * 4, a.my - 1, (u) => (u > 0.75 ? '#c8b8ff' : '#1a1230'));
            seg(this, ex, a.my + 3, ex + s * 5, a.my + 2, (u) => (u > 0.75 ? '#c8b8ff' : '#1a1230'));
            this.px(ex + s, a.my + 2, '#5a3fa0');
          }
          // 가슴의 성운 핵: 색이 흐르며 맥동
          const pu = tw(t, 1, 4);
          this.pattern(['.N.', 'NWN', '.N.'], a.hx - 1, a.my + 2, { N: hsl(hue + 30, 95, 60), W: pu > 0.6 ? '#ffffff' : hsl(hue + 30, 95, 85) });
          glow(this, a.hx + 0.5, a.my + 3.5, 4, 3, '170,120,255', 0.5 * pu);
        }
        // 비늘을 스치는 별빛 (3.5초마다 비스듬히)
        const ph = (t % 3.5) / 0.6;
        if (ph < 1) {
          const x0 = Math.round(a.left - 3 + ph * (a.right - a.left + 8));
          for (let y = a.top - 1; y <= GROUND - 2; y++) {
            const x = x0 - Math.round((y - a.top) * 0.5);
            if (x >= a.left && x <= a.right && !(Math.abs(x - a.hx) <= 4 && y >= a.ey - 1 && y <= a.my + 1)) this.px(x, y, 'rgba(220,200,255,0.55)', false);
          }
        }
        // 성운 수정 창
        const h = hand(this, a);
        if (!h) return;
        if (h.curled) {
          for (let x = h.x; x <= h.x + 5; x++) this.px(x, GROUND - 1, x % 3 ? '#2a1f48' : '#7a5ad0');
          this.pattern(['KNN.', 'NWNN', 'KNN.'], h.x + 6, GROUND - 2, { K: '#120c20', N: hsl(hue, 90, 62), W: '#ffffff' });
          return;
        }
        const sx = h.x + 1, tipY = a.cy - 23;
        for (let y = tipY + 7; y <= GROUND - 1; y++) { this.px(sx, y, y % 3 === 0 ? '#7a5ad0' : '#2a1f48'); this.px(sx + 1, y, '#120c20'); }
        // 용 날개꼴 코등이
        this.pattern(['K.....K', 'NK...KN', '.NKKKN.'], sx - 3, tipY + 5, { K: '#120c20', N: '#9a8ad0' });
        // 수정 날: 성운색이 위로 흐른다
        const blade = ['..W..', '.WNn.', '.NNn.', 'KNNnK', 'KNNnK', '.KNK.'];
        blade.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '.') continue;
            const col = ch === 'K' ? '#120c20' : ch === 'W' ? '#ffffff' : hsl(hue - j * 18 + t * 60, 92, ch === 'N' ? 66 : 48);
            this.px(sx - 1 + i, tipY + j, col);
          }
        });
        glow(this, sx + 1, tipY + 2, 5, 6, '190,150,255', 0.25 + 0.25 * tw(t, 3, 3));
        // 창끝에서 흘러나오는 성운 꼬리
        for (let i = 0; i < 6; i++) {
          const q = (t * 0.7 + i / 6) % 1;
          this.px(Math.round(sx + 2 + q * 7 + Math.sin(t * 3 + i) * 0.8), Math.round(tipY + 1 + q * 3 + Math.sin(q * 6 + i) * 1.2), hsl(hue + i * 25, 95, 72, (1 - q).toFixed(2)), false);
        }
        heldPaw(this, g, sx, a.cy + 1);
      },
    },

    // =====================================================================
    // 3. 태양 신전의 수호신 — 청금석·황금 줄무늬 두건이 어깨까지 퍼지고, 머리 위 태양 원반이 빛살을 돌리며,
    //    양옆엔 룬이 차례로 켜지는 신전 기둥, 가슴엔 겹겹 보석 칼라, 손엔 생명의 열쇠 지팡이
    xsunguardian: {
      back(g, a, c, t) {
        const Sd = '#d8b878', sd = '#a8884a', sk = '#6a5228', Tq = '#3fe0d0';
        if (!a.curled) {
          // 신전 기둥 둘 (금 머리장식, 룬이 아래에서 위로 차례로 켜진다)
          for (const s of [-1, 1]) {
            const x0 = a.hx + s * 14 - 1;
            for (let y = a.top - 12; y <= GROUND; y++) {
              this.px(x0 - 1, y, sk);
              this.px(x0, y, Sd);
              this.px(x0 + 1, y, (y % 3 === 0) ? sd : Sd);
              this.px(x0 + 2, y, sd);
              this.px(x0 + 3, y, sk);
            }
            this.pattern(['KGGGGGK', '.KgggK.'], x0 - 2, a.top - 14, { K: sk, G: '#f4c84a', g: '#b8861a' });
            this.pattern(['KgggggK'], x0 - 2, GROUND, { K: sk, g: sd });
            const lit = Math.floor(t * 4) % 8;
            for (let k = 0; k < 6; k++) {
              const y = GROUND - 3 - k * 3;
              const on = (k === lit || k === lit - 1);
              this.px(x0 + 1, y, on ? Tq : '#7a6a40');
              if (on) glow(this, x0 + 1.5, y + 0.5, 2.5, 2, '63,224,208', 0.5);
            }
          }
        }
        // 태양 원반: 열여섯 빛살이 돌고, 원반은 숨 쉬듯 밝아진다
        const cx = a.hx + 0.5, cy = a.top - 6.5;
        const pu = tw(t, 0, 2);
        glow(this, cx, cy, 13, 12, '255,210,90', 0.25 + 0.12 * pu);
        for (let k = 0; k < 16; k++) {
          const an = (k / 16) * Math.PI * 2 + t * 0.5;
          const len = k % 2 ? 3 : 5 + Math.round(tw(t, k, 4) * 1.5);
          for (let s = 0; s < len; s++) this.px(Math.floor(cx + Math.cos(an) * (6 + s)), Math.floor(cy + Math.sin(an) * (6 + s)), `rgba(255,${200 + s * 8},${90 + s * 20},${(0.95 - (s / len) * 0.75).toFixed(2)})`, false);
        }
        this.ellipse(cx, cy, 4.6, 4.6, (x, y) => {
          const d = Math.hypot(x + 0.5 - cx + 1, y + 0.5 - cy + 1);
          return d < 1.6 ? '#ffffff' : d < 3 ? '#fff0a0' : d < 4.3 ? '#ffd24a' : '#f0a020';
        }, '#a8601a');
        // 금빛 모래알이 떠오른다
        rise(this, t, 10, a.hx - 12, a.hx + 12, GROUND, 22, (i, p) => `rgba(255,220,120,${(0.85 * (1 - p)).toFixed(2)})`, 0.3, 41);
      },
      front(g, a, c, t) {
        const Gd = '#f4c84a', gd = '#c8962a', La = '#2a4fa8', la = '#1a347a', Tq = '#3fe0d0', Cn = '#d8402a', OL = '#5a3a10';
        const stripe = (y, outer) => (y % 2 === 0 ? (outer ? gd : Gd) : outer ? la : La);
        // 줄무늬 두건 (귀까지 덮어 두건 꼭대기가 된다)
        hood(this, g, a, (dx, y, x, j) => {
          const adx = Math.abs(dx);
          if (isFace(a, dx, y)) return null;
          if (y === a.ey - 2) return adx % 2 ? Tq : Gd;
          return stripe(y, adx >= 5);
        });
        // 두건 양옆이 어깨까지 넓게 퍼진다
        const y0 = a.ey - 3, y1 = a.curled ? GROUND - 1 : a.my + 3;
        for (let y = a.top + 1; y <= y1; y++) {
          const w = y < y0 ? 1 : 1 + Math.floor((y - y0) / 2);
          for (const s of [-1, 1]) {
            const ex = s < 0 ? a.left : a.right;
            for (let i = 1; i <= w; i++) this.px(ex + s * i, y, stripe(y, i === w));
            this.px(ex + s * (w + 1), y, OL);
          }
        }
        for (const s of [-1, 1]) {
          const ex = s < 0 ? a.left : a.right;
          this.px(ex + s, a.top, OL);
          const w = 1 + Math.floor((y1 - y0) / 2);
          for (let i = 1; i <= w; i++) this.px(ex + s * i, y1 + 1, OL);
        }
        // 이마의 태양 보석 (붉은 홍옥수가 맥동)
        const pu = tw(t, 0, 3);
        this.pattern(['.G.', 'GRG', '.G.'], a.hx - 1, a.top - 1, { G: Gd, R: pu > 0.7 ? '#ff9a7a' : Cn });
        // 눈꼬리 금빛 아이라인 (눈은 그대로)
        if (!a.curled) {
          this.px(a.eyeL - 1, a.ey, '#1a1a3a'); this.px(a.eyeL - 2, a.ey - 1, '#1a1a3a');
          this.px(a.eyeR + a.ew, a.ey, '#1a1a3a'); this.px(a.eyeR + a.ew + 1, a.ey - 1, '#1a1a3a');
        }
        // 흰 아마포 + 겹겹 보석 칼라
        wear(this, g, a, (dx, dy, x, y, leg) => (leg ? '#f4ecd8' : dy === -3 ? null : '#f4ecd8'));
        if (!a.curled) {
          const cx = a.hx + 0.5, cy = a.my - 0.5;
          const ins = (x, y) => {
            if (y < a.my + 2 || y > a.my + 6) return false;
            const n = ((x + 0.5 - cx) / 9.5) ** 2 + ((y + 0.5 - cy) / 6.2) ** 2;
            return n <= 1;
          };
          const sh = Math.floor(t * 8) % 24;
          for (let y = a.my + 2; y <= a.my + 6; y++)
            for (let x = a.hx - 10; x <= a.hx + 10; x++) {
              if (!ins(x, y)) continue;
              const n = Math.sqrt(((x + 0.5 - cx) / 9.5) ** 2 + ((y + 0.5 - cy) / 6.2) ** 2);
              let col = n < 0.6 ? Gd : n < 0.72 ? Tq : n < 0.83 ? La : n < 0.93 ? (x % 2 ? Cn : Gd) : (x % 2 ? Gd : null);
              if (col && x - (a.hx - 10) === sh && n < 0.93) col = '#ffffff';
              if (col) this.px(x, y, col);
              else continue;
              if (!ins(x, y + 1) && y + 1 > a.my + 2) this.px(x, y + 1, x % 2 ? OL : null || OL);
            }
        }
        // 생명의 열쇠 지팡이
        const h = hand(this, a);
        if (!h) return;
        const km = { K: OL, G: Gd, g: gd, T: Tq };
        if (h.curled) {
          for (let x = h.x; x <= h.x + 4; x++) { this.px(x, GROUND - 1, x % 3 ? Gd : Tq); this.px(x, GROUND, gd); }
          this.pattern(['.KK.', 'KG.K', 'KG.K', '.KK.'], h.x + 5, GROUND - 3, km);
          return;
        }
        const sx = h.x + 1;
        for (let y = a.cy - 11; y <= GROUND - 1; y++) { this.px(sx, y, y % 4 === 0 ? Tq : Gd); this.px(sx + 1, y, gd); }
        this.pattern(['.KGGK.', 'KG..gK', 'KG..gK', '.KGgK.', 'KGGGggK', '..KTK..'], sx - 2, a.cy - 17, km);
        glow(this, sx + 1, a.cy - 15, 5, 5, '255,220,110', 0.2 + 0.35 * pu);
        if (pu > 0.85) star(this, sx + 1, a.cy - 19, '#fff6c8');
        heldPaw(this, g, sx, a.cy + 1);
      },
    },

    // =====================================================================
    // 4. 불사조 왕 — 깃털 투구 위로 불꽃 볏이 타오르고, 등 뒤로 불꽃 날개가 퍼덕,
    //    금 깃 칼라·불꽃 깃털 망토, 손엔 불꽃 홀. 6초마다 '부활의 불꽃 고리'가 터져 퍼진다
    xphoenixking: {
      back(g, a, c, t) {
        // 부활의 불꽃 고리
        const p = (t % 6) / 1.3;
        if (p < 1) {
          const R = 3 + p * 17, al = 1 - p;
          for (let i = 0; i < 90; i++) {
            const an = (i / 90) * Math.PI * 2;
            const x = Math.round(a.cx + Math.cos(an) * R), y = Math.round(a.cy - 2 + Math.sin(an) * R * 0.75);
            if (y > GROUND + 1) continue;
            this.px(x, y, `rgba(255,${150 + Math.round(80 * (1 - p))},40,${(0.9 * al).toFixed(2)})`, false);
            if (i % 3 === 0) this.px(x, y - 1, `rgba(255,240,180,${(0.7 * al).toFixed(2)})`, false);
          }
        }
        rise(this, t, 14, a.hx - 15, a.hx + 15, GROUND, 28, (i, q) => (i % 3 ? `rgba(255,${120 + i * 8},30,${(1 - q).toFixed(2)})` : `rgba(255,240,160,${(1 - q).toFixed(2)})`), 0.55, 23);
        if (a.curled) return;
        const beat = Math.sin(t * 2.6);
        for (const s of [-1, 1]) {
          const rx = a.hx + s * 5, ry = a.my;
          glow(this, rx + s * 6, ry - 6, 10, 9, '255,110,40', 0.28 + 0.1 * beat);
          for (let f = 0; f < 7; f++) {
            const phi = ((80 - f * 14 + beat * 8 * (1 - f / 8)) * Math.PI) / 180;
            const L = 8 + 5 * Math.sin(((f + 0.5) / 7) * Math.PI);
            const dx = s * Math.cos(phi), dy = -Math.sin(phi);
            const ex = rx + dx * L, ey = ry + dy * L;
            seg(this, rx, ry, ex, ey, (u) => (u < 0.2 ? null : u < 0.45 ? '#a8141c' : u < 0.7 ? '#e8401a' : u < 0.9 ? '#ff8a1a' : '#ffd24a'));
            const ox = -dy * s, oy = dx * s; // 깃 아래쪽으로 한 칸 두껍게
            seg(this, rx + ox, ry + oy, rx + ox + dx * L * 0.8, ry + oy + dy * L * 0.8, (u) => (u < 0.25 ? null : u < 0.6 ? '#7e1218' : '#c0281c'));
            flame(this, t, Math.round(ex), Math.round(ey), 2, 2 + Math.round(tw(t, f + s, 7) * 2), FIRE, f * 3 + s);
          }
        }
      },
      front(g, a, c, t) {
        const R = '#c0202a', r2 = '#7e1218', Rh = '#ff5a2a', Gd = '#f4c84a', gd = '#c8962a';
        // 깃털 투구: 비늘처럼 겹친 붉은 깃, 귀 끝은 불꽃색
        hood(this, g, a, (dx, y, x, j) => {
          const adx = Math.abs(dx);
          if (isFace(a, dx, y)) return null;
          if (j <= 1) return j === 0 ? '#ffd24a' : '#ff8a1a';
          if (y === a.ey - 2) return adx <= 1 ? '#fff0b0' : Gd;
          if (adx >= 5) return (x + y) % 3 === 0 ? R : r2;
          const fe = (x + (y % 2) * 2) % 4 === 0;
          return fe ? Rh : dx < -2 ? '#e0302a' : R;
        });
        // 볼에서 뒤로 뻗는 깃 (웅크리면 눈 옆이라 뺀다)
        if (!a.curled) for (const s of [-1, 1]) {
          const ex = s < 0 ? a.left : a.right;
          seg(this, ex, a.ey, ex + s * 4, a.ey - 3, (u) => (u < 0.5 ? '#ff8a1a' : '#ffd24a'));
          seg(this, ex, a.ey + 1, ex + s * 4, a.ey - 1, (u) => (u < 0.5 ? '#e8401a' : '#ff8a1a'));
        }
        // 불꽃 볏: 금관 위로 세 갈래 불꽃
        const fy = a.curled ? a.top - 2 : a.top - 3;
        flame(this, t, a.hx - 3, fy, 3, 6 + Math.round(tw(t, 1, 5) * 2), FIRE, 1);
        flame(this, t, a.hx + 3, fy, 3, 6 + Math.round(tw(t, 2, 5) * 2), FIRE, 2);
        flame(this, t, a.hx, fy - 1, 5, 10 + Math.round(tw(t, 0, 4) * 2), FIRE, 0);
        glow(this, a.hx + 0.5, fy - 5, 6, 7, '255,150,40', 0.3);
        const pu = tw(t, 0, 3);
        this.pattern(['G...G...G', 'GG.GRG.GG', 'KGGGGGGGK'], a.hx - 4, a.top - 3, { G: Gd, R: pu > 0.7 ? '#ffb0a0' : '#e0102a', K: '#7a4a10' });
        // 불꽃 깃털 망토: 금 깃 칼라 아래로 깃이 층층이
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return r2;
          if (dy === -3) return gd;
          if (dy <= -2) return adx >= 5 ? gd : Gd;
          const sc = (x + (dy % 2 === 0 ? 0 : 1)) % 3;
          return sc === 0 ? '#ffb030' : sc === 1 ? '#e8401a' : '#a8141c';
        });
        if (!a.curled) {
          // 어깨에서 아래 바깥으로 늘어진 깃
          for (const s of [-1, 1]) {
            const ex = s < 0 ? a.left : a.right;
            seg(this, ex, a.my + 1, ex + s * 4, a.my + 4, (u) => (u < 0.5 ? Gd : '#ff8a1a'));
            seg(this, ex, a.my + 2, ex + s * 3, a.my + 5, (u) => (u < 0.5 ? '#e8401a' : '#ffd24a'));
            seg(this, ex - s, a.my + 3, ex + s * 2, a.my + 6, (u) => (u < 0.5 ? '#a8141c' : '#ff8a1a'));
          }
          // 가슴 불꽃 보석
          this.pattern(['.Y.', 'YRY', '.R.'], a.hx - 1, a.my + 2, { Y: pu > 0.5 ? '#ffffff' : '#ffd24a', R: '#e0102a' });
          glow(this, a.hx + 0.5, a.my + 3.5, 3.5, 3, '255,140,40', 0.4 * pu);
        }
        // 불꽃 홀
        const h = hand(this, a);
        if (!h) return;
        if (h.curled) {
          for (let x = h.x; x <= h.x + 5; x++) { this.px(x, GROUND - 1, x % 3 ? Gd : '#e8401a'); this.px(x, GROUND, gd); }
          flame(this, t, h.x + 7, GROUND - 1, 3, 5, FIRE, 4);
          return;
        }
        const sx = h.x + 1;
        for (let y = a.cy - 12; y <= a.cy + 3; y++) { this.px(sx, y, y % 4 === 0 ? '#e8401a' : Gd); this.px(sx + 1, y, gd); }
        this.pattern(['KG...GK', '.KGRGK.', '..KGK..'], sx - 2, a.cy - 15, { K: '#7a4a10', G: Gd, R: '#e0102a' });
        flame(this, t, sx + 1, a.cy - 16, 5, 8 + Math.round(tw(t, 5, 6) * 2), FIRE, 5);
        glow(this, sx + 1, a.cy - 19, 5, 6, '255,150,40', 0.35);
        heldPaw(this, g, sx, a.cy + 1);
      },
    },

    // =====================================================================
    // 5. 서리 군주 — 얼음 결정 투구에 길이가 다른 얼음 첨탑 왕관(빛이 첨탑을 타고 건너간다),
    //    등 뒤로 부채처럼 펼친 얼음 수정과 오로라 장막, 흰 털 칼라와 서리 갑옷, 눈꽃 지팡이, 내리는 눈
    xfrostmonarch: {
      back(g, a, c, t) {
        // 오로라 장막
        for (let x = a.hx - 18; x <= a.hx + 18; x++) {
          const yc = a.top - 17 + Math.sin(x * 0.3 + t * 1.5) * 2.2 + Math.sin(x * 0.11 - t * 0.7) * 1.5;
          const hue = 150 + 70 * Math.sin(x * 0.12 - t * 0.8);
          const amp = 0.5 + 0.5 * Math.sin(x * 0.2 + t * 1.1);
          for (let j = 0; j < 6; j++) this.px(x, Math.round(yc + j), hsl(hue + j * 10, 85, 68, ((1 - j / 6) * (0.12 + 0.3 * amp)).toFixed(2)), false);
        }
        // 얼음 수정 부채 (머리 뒤에서 위로 펼쳐진다)
        const bx = a.hx + 0.5, by = a.ey + 0.5;
        const sh = [[-170, 12], [-146, 15], [-120, 17], [-90, 20], [-60, 17], [-34, 15], [-10, 12]];
        const n = a.curled ? [2, 3, 4] : [0, 1, 2, 3, 4, 5, 6];
        n.forEach((i) => {
          const [deg, L0] = sh[i];
          const L = a.curled ? L0 - 4 : L0;
          const an = (deg * Math.PI) / 180, dx = Math.cos(an), dy = Math.sin(an), qx = -dy, qy = dx;
          const wv = (t * 0.7 + i * 0.13) % 1.6;
          for (let y = Math.floor(by - L - 3); y <= Math.ceil(by + 3); y++)
            for (let x = Math.floor(bx - L - 3); x <= Math.ceil(bx + L + 3); x++) {
              const vx = x + 0.5 - bx, vy = y + 0.5 - by;
              const k = vx * dx + vy * dy, o = vx * qx + vy * qy;
              if (k < 0 || k > L) continue;
              const u = k / L;
              const hw = 2.1 * Math.min(1, (1 - u) * 2.2) * Math.min(1, 0.6 + u);
              if (Math.abs(o) > hw) continue;
              const edge = Math.abs(o) > hw - 0.9;
              const shine = Math.abs(u - wv) < 0.07;
              this.px(x, y, shine ? '#ffffff' : edge ? '#3a78b8' : o < 0 ? '#e8f8ff' : '#94d0f2');
            }
        });
        glow(this, bx, by - 8, 14, 12, '170,230,255', 0.22 + 0.08 * Math.sin(t * 2));
        cape(this, a, t, '#bfe4f8', '#8cc0e4', '#e8f8ff', '#ffffff');
      },
      front(g, a, c, t) {
        // 얼음 결정 투구 (빛이 깎인 면에 따라 갈라진다)
        hood(this, g, a, (dx, y, x, j) => {
          const adx = Math.abs(dx);
          if (isFace(a, dx, y)) return null;
          if (j <= 1) return '#ffffff';
          if (y === a.ey - 2) return adx % 3 === 0 ? '#5ad8ff' : '#e8f8ff';
          const f = (((x * 2 + y * 3) % 7) + 7) % 7;
          if (adx >= 5) return f < 2 ? '#a8d8f4' : '#6aa8d4';
          return f < 2 ? '#ffffff' : f < 4 ? '#d4f0ff' : '#a8d8f4';
        });
        // 얼음 첨탑 왕관
        const hs = a.curled ? [2, 3, 3, 5, 3, 3, 2] : [3, 5, 4, 8, 4, 5, 3];
        const wave = (t * 6) % 14 - 3;
        hs.forEach((h, i) => {
          const x = a.hx - 6 + i * 2;
          for (let k = 0; k < h; k++) {
            const y = a.top - 1 - k;
            const hot = Math.abs(i - wave) < 0.8;
            this.px(x, y, k === h - 1 ? '#ffffff' : hot ? '#ffffff' : '#a8e0fa');
            if (k < h - 2) this.px(x + 1, y, hot ? '#e8f8ff' : '#5aa8dc');
            if (k < h - 1) this.px(x - 1, y, i === 0 || k >= hs[i - 1] ? '#2a5a90' : '#c8ecff');
          }
        });
        this.pattern(['K' + 'e'.repeat(13) + 'K'], a.hx - 7, a.top - 1, { K: '#2a5a90', e: '#e8f8ff' });
        // 가운데 금강석: 맥동
        const pu = tw(t, 0, 3);
        this.pattern(['.D.', 'DWD', '.D.'], a.hx - 1, a.top - 3, { D: '#5ad8ff', W: pu > 0.6 ? '#ffffff' : '#bff0ff' });
        glow(this, a.hx + 0.5, a.top - 1.5, 4, 3.5, '150,230,255', 0.5 * pu);
        // 흰 털 칼라 + 서리 갑옷
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (leg) return '#9ac8e8';
          if (dy <= -1) return (x * 7 + y * 3) % 5 === 0 ? '#d8e4ee' : '#ffffff';
          return (x + y) % 3 === 0 ? '#e8f8ff' : (x + y) % 3 === 1 ? '#8cc8ee' : '#6aa8d4';
        });
        if (!a.curled) {
          // 털 칼라가 어깨 밖으로 복슬복슬 (얼굴 줄은 피한다)
          for (const s of [-1, 1]) {
            const ex = s < 0 ? a.left : a.right;
            this.pattern(s < 0 ? ['.KWW', 'KWWw', 'KWwW', '.KKK'] : ['WWK.', 'wWWK', 'WwWK', 'KKK.'], s < 0 ? ex - 3 : ex, a.my + 1, { K: '#8aa4c0', W: '#ffffff', w: '#d8e4ee' });
          }
          // 눈꽃 브로치
          this.pattern(['D.D', '.W.', 'D.D'], a.hx - 1, a.my + 3, { D: '#5ad8ff', W: pu > 0.5 ? '#ffffff' : '#bff0ff' });
        }
        // 내리는 눈 (앞쪽 몇 송이)
        for (let i = 0; i < 9; i++) {
          const y = Math.round(((t * 3.2 + hash(i + 5) * 40) % 38) + 8);
          const x = Math.round(a.hx - 17 + hash(i * 7 + 3) * 34 + Math.sin(t * 1.5 + i) * 1.2);
          if (Math.abs(x - a.hx) <= 7 && y >= a.top - 1 && y <= GROUND) continue; // 고양이 몸 위엔 안 그린다
          if (i % 3 === 0) this.pattern(['.W.', 'WwW', '.W.'], x - 1, y - 1, { W: 'rgba(255,255,255,0.8)', w: '#ffffff' }, false);
          else this.px(x, y, 'rgba(255,255,255,0.85)', false);
        }
        // 눈꽃 지팡이
        const h = hand(this, a);
        if (!h) return;
        const flakeA = ['W..W..W', '.W.W.W.', '..WDW..', 'WWDCDWW', '..WDW..', '.W.W.W.', 'W..W..W'];
        const flakeB = ['...W...', '.W.W.W.', '..WDW..', 'WWDCDWW', '..WDW..', '.W.W.W.', '...W...'];
        const fm = { W: '#e8f8ff', D: '#5ad8ff', C: '#ffffff' };
        if (h.curled) {
          for (let x = h.x; x <= h.x + 5; x++) this.px(x, GROUND - 1, x % 2 ? '#cfefff' : '#7ab4dc');
          this.pattern(['.W.', 'WCW', '.W.'], h.x + 6, GROUND - 2, fm);
          return;
        }
        const sx = h.x + 1;
        for (let y = a.cy - 12; y <= GROUND - 1; y++) { this.px(sx, y, y % 3 === 0 ? '#ffffff' : '#cfefff'); this.px(sx + 1, y, '#7ab4dc'); }
        const fy = a.cy - 19;
        glow(this, sx + 1, fy + 3.5, 6, 6, '150,230,255', 0.25 + 0.3 * pu);
        this.pattern(Math.floor(t * 2) % 2 ? flakeA : flakeB, sx - 2, fy, fm);
        // 눈꽃 둘레를 도는 서리 알갱이
        for (let i = 0; i < 3; i++) {
          const an = t * 2.4 + (i * Math.PI * 2) / 3;
          this.px(Math.round(sx + 1 + Math.cos(an) * 5), Math.round(fy + 3 + Math.sin(an) * 4), '#ffffff', false);
        }
        heldPaw(this, g, sx, a.cy + 1);
      },
    },

    // =====================================================================
    // 6. 심해의 바다 군주 — 청록 비늘 투구에 볼 지느러미가 하늘하늘, 산호 가지 왕관 끝마다 진주,
    //    등 뒤로 물빛 광선이 일렁이고 빛나는 해파리 둘이 떠다닌다. 조개 견갑 · 진주 갑옷 · 소용돌이 삼지창
    xabyssking: {
      back(g, a, c, t) {
        // 위에서 비쳐 드는 물빛 광선
        for (let i = 0; i < 4; i++) {
          const x0 = a.hx - 15 + i * 9 + Math.sin(t * 0.8 + i) * 2;
          for (let y = 9; y <= GROUND; y++) {
            const x = Math.round(x0 + (y - 9) * 0.35);
            const al = 0.16 * (1 - (y - 9) / 42) * (0.6 + 0.4 * Math.sin(t * 1.5 + i * 2));
            this.px(x, y, `rgba(150,255,235,${al.toFixed(3)})`, false);
            this.px(x + 1, y, `rgba(150,255,235,${(al * 0.6).toFixed(3)})`, false);
          }
        }
        // 빛나는 해파리 둘: 갓이 오므렸다 폈다 하며 둥실
        if (!a.curled) for (const s of [-1, 1]) {
          const jx = a.hx + s * 14, jy = a.top - 9 + Math.round(Math.sin(t * 1.6 + s) * 1.5);
          const open = Math.sin(t * 3 + s) > 0;
          glow(this, jx + 0.5, jy + 2, 4.5, 5, '255,140,220', 0.3);
          const jm = { P: 'rgba(255,150,225,0.85)', p: 'rgba(205,95,205,0.8)', W: '#ffffff' };
          this.pattern(open ? ['.PPP.', 'PPWPP', 'PpppP'] : ['.PPP.', '.PWP.', '.ppp.'], jx - 2, jy, jm, false);
          for (let k = 0; k < 3; k++) for (let j = 1; j <= 5; j++)
            this.px(jx - 1 + k + Math.round(Math.sin(t * 3 + j * 0.8 + k) * 0.6), jy + 2 + j, `rgba(255,170,230,${(0.75 * (1 - j / 6)).toFixed(2)})`, false);
        }
        // 거품 (작은 알갱이 + 동그란 방울)
        rise(this, t, 12, a.hx - 15, a.hx + 15, GROUND, 30, (i, p) => (i % 4 === 0 ? `rgba(255,255,255,${(0.9 * (1 - p)).toFixed(2)})` : `rgba(170,250,240,${(0.7 * (1 - p)).toFixed(2)})`), 0.35, 57);
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.22 + i / 3) % 1;
          const x = Math.round(a.hx - 13 + i * 12 + Math.sin(t * 2 + i * 2) * 1.2), y = Math.round(GROUND - 2 - p * 30);
          this.pattern(['.B.', 'BwB', '.B.'], x - 1, y - 1, { B: `rgba(200,255,250,${(0.8 * (1 - p)).toFixed(2)})`, w: `rgba(255,255,255,${(0.35 * (1 - p)).toFixed(2)})` }, false);
        }
        cape(this, a, t, '#0e5a6a', '#0a3a4a', '#1a7a86', '#5ae0c0');
      },
      front(g, a, c, t) {
        const T1 = '#127080', T2 = '#0a4a58', Th = '#3ab0b0', Sf = '#5ae0c0', Pl = '#f4eef8', pl = '#c8b8d8', Co = '#ff6a7a', co = '#c83a5a';
        // 비늘 투구 (진주 이마띠)
        hood(this, g, a, (dx, y, x, j) => {
          const adx = Math.abs(dx);
          if (isFace(a, dx, y)) return null;
          if (j <= 1) return j === 0 ? Sf : Th;
          if (y === a.ey - 2) return adx % 2 ? Pl : pl;
          const sc = (x + (y % 2)) % 2 === 0;
          if (adx >= 5) return sc ? T2 : '#073440';
          if (dx <= -2 && y < a.ey - 2) return sc ? Sf : Th;
          return sc ? Th : T1;
        });
        // 볼 지느러미: 살랑살랑 (막은 반투명)
        const f = Math.round(Math.sin(t * 4) * 0.7);
        const fin = ['S....', 'mSS..', 'mmmSS', 'mSS..', 'S....'];
        const fm = { S: Sf, m: 'rgba(90,224,192,0.5)' };
        const fdx = [f, 0, 0, 0, -f];
        fin.forEach((row, j) => {
          this.pattern([row], a.left - 5 + fdx[j], a.ey - 2 + j, fm);
          this.pattern([mirror([row])[0]], a.right + 1 - fdx[j], a.ey - 2 + j, fm);
        });
        // 산호 왕관: 가지 다섯, 가지 끝마다 진주가 반짝
        const br = [[-5, 4, -1], [-3, 6, 1], [0, 8, 0], [3, 6, -1], [5, 4, 1]];
        br.forEach(([dx, h, bend], i) => {
          let x = a.hx + dx;
          for (let k = 0; k < h; k++) {
            if (k === Math.ceil(h / 2)) x += bend;
            this.px(x, a.top - 1 - k, k % 2 ? Co : co);
            if (k === Math.floor(h / 2) && bend) this.px(x - bend, a.top - 2 - k, Co);
          }
          this.px(x, a.top - 1 - h, tw(t, i, 3) > 0.8 ? '#ffffff' : Pl);
        });
        for (let x = a.hx - 6; x <= a.hx + 6; x++) this.px(x, a.top - 1, x % 2 ? Pl : pl);
        const pu = tw(t, 0, 2.5);
        this.pattern(['.P.', 'PWP', '.p.'], a.hx - 1, a.top - 3, { P: Pl, W: '#ffffff', p: pl });
        glow(this, a.hx + 0.5, a.top - 1.5, 4, 3.5, '220,255,250', 0.45 * pu);
        // 진주 비늘 갑옷
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return T2;
          if (dy === -3) return Th;
          if (adx >= 5) return dy <= -1 ? Pl : pl;
          return (x + (y % 2)) % 2 === 0 ? Th : T1;
        });
        if (!a.curled) {
          // 조개 견갑
          const sh = ['.KPK.', 'KPpPK', 'PpPpP', 'KpPpK'];
          const sm = { K: '#8a6a9a', P: Pl, p: '#ffc8d8' };
          this.pattern(sh, a.left - 4, a.my + 1, sm);
          this.pattern(sh, a.right, a.my + 1, sm);
          // 가슴 아쿠아마린 + 갑옷에 깜빡이는 발광점
          this.pattern(['.A.', 'AWA', '.A.'], a.hx - 1, a.my + 2, { A: Sf, W: pu > 0.5 ? '#ffffff' : '#c8fff0' });
          glow(this, a.hx + 0.5, a.my + 3.5, 3.5, 3, '90,224,192', 0.5 * pu);
          [[-4, 4], [4, 3], [-3, 2], [3, 5]].forEach(([dx, dy], i) => { if (tw(t, i * 3, 2.6) > 0.6) this.px(a.hx + dx, a.my + dy, '#c8fff0'); });
        }
        // 소용돌이 삼지창
        const h = hand(this, a);
        if (!h) return;
        const tm = { S: '#d8f4f4', s: Sf, W: '#ffffff', K: '#3a8a90' };
        if (h.curled) {
          for (let x = h.x; x <= h.x + 5; x++) this.px(x, GROUND - 1, x % 3 ? '#b8e8e8' : Sf);
          this.pattern(['S.', 'SS', 'SW', 'SS', 'S.'], h.x + 6, GROUND - 3, tm);
          return;
        }
        const sx = h.x + 1;
        for (let y = a.cy - 14; y <= GROUND - 1; y++) { this.px(sx, y, y % 3 ? '#b8e8e8' : Sf); this.px(sx + 1, y, '#3a8a90'); }
        this.pattern(['W..W..W', 'S..S..S', 'Ss.S.sS', '.SsSsS.', '..SSS..', '...K...'], sx - 3, a.cy - 20, tm);
        glow(this, sx + 0.5, a.cy - 17, 6, 5, '120,255,230', 0.25 + 0.25 * pu);
        // 창머리를 감도는 물소용돌이 (앞쪽 반바퀴만 진하게)
        for (let i = 0; i < 8; i++) {
          const an = t * 3 + (i / 8) * Math.PI * 2;
          const fr = Math.sin(an) > 0;
          this.px(Math.round(sx + 0.5 + Math.cos(an) * 5), Math.round(a.cy - 16 + Math.sin(an) * 1.6 - i * 0.25), fr ? 'rgba(200,255,250,0.9)' : 'rgba(90,224,192,0.45)', false);
        }
        heldPaw(this, g, sx, a.cy + 1);
      },
    },

    // =====================================================================
    // 7. 천둥 군주 — 강철 투구 양옆으로 번개 날개가 솟고, 머리 위 먹구름이 속에서 번쩍,
    //    몇 초마다 벼락이 양옆 땅에 내리꽂힌다. 몸 둘레엔 전기가 지직, 손엔 번개 룬이 새겨진 전쟁 망치
    xthunderlord: {
      back(g, a, c, t) {
        const fl1 = t % 2.7 < 0.14, fl2 = (t + 1.1) % 4.1 < 0.1;
        const flash = fl1 || fl2;
        // 벼락: 2.7초마다 왼쪽·오른쪽 번갈아 땅으로 내리꽂힌다
        if (fl1 && !a.curled) {
          const s = Math.floor(t / 2.7) % 2 ? -1 : 1;
          const n = Math.floor(t / 2.7);
          let x = a.hx + s * 12, y = a.top - 12;
          const pts = [[x, y]];
          while (y < GROUND) { y = Math.min(GROUND, y + 3); x += Math.round((hash(n * 9 + y) - 0.5) * 4) + s * 0.4; pts.push([x, y]); }
          glow(this, pts[pts.length - 1][0] + 0.5, GROUND, 6, 2.5, '255,240,120', 0.7);
          for (let i = 0; i < pts.length - 1; i++) {
            const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
            seg(this, x0 + 1, y0, x1 + 1, y1, 'rgba(255,232,74,0.8)', false);
            seg(this, x0, y0, x1, y1, '#ffffff', false);
          }
        }
        // 먹구름: 뭉게뭉게 흐르고, 번쩍일 땐 속이 하얗게
        const cyc = a.curled ? a.top - 9 : a.top - 15;
        glow(this, a.hx + 0.5, cyc + 1, 18, 7, flash ? '220,225,255' : '60,70,100', flash ? 0.5 : 0.35);
        for (let i = 0; i < 9; i++) {
          const cx = a.hx - 16 + i * 4 + Math.sin(t * 0.6 + i) * 1.2 + 0.5;
          const cy = cyc + (i % 2 ? -1 : 1) + Math.sin(t * 0.9 + i * 1.3) * 0.8;
          const rr = 2.6 + (i % 3 === 1 ? 1 : 0);
          this.ellipse(cx, cy, rr + 0.6, rr - 0.2, (x, y) => (y + 0.5 < cy - 1.6 ? (flash ? '#ffffff' : '#9aa2b8') : y + 0.5 < cy ? (flash ? '#e0e0ff' : '#727a92') : y + 0.5 < cy + 1.4 ? (flash ? '#a8a8d0' : '#4e5468') : '#363b4c'), null);
        }
        // 구름 속 잔번개
        if (Math.floor(t * 9) % 5 === 0) {
          const k = Math.floor(t * 9);
          const x0 = Math.round(a.hx - 12 + hash(k) * 24);
          seg(this, x0, cyc - 1, x0 + 2, cyc + 1, '#ffe84a', false);
          seg(this, x0 + 2, cyc + 1, x0 + 1, cyc + 3, '#ffe84a', false);
        }
        cape(this, a, t, '#3a4250', '#252a34', '#566070', '#ffe84a');
      },
      front(g, a, c, t) {
        const St = '#5a6478', st = '#3a4250', sd = '#252a34', Sh = '#a8b4c8', Y = '#ffe84a', y2 = '#d8a820';
        const fl = Math.floor(t * 12) % 7 === 0;
        // 강철 투구 (이마에 전기 띠가 지직)
        hood(this, g, a, (dx, y, x, j) => {
          const adx = Math.abs(dx);
          if (isFace(a, dx, y)) return null;
          if (j <= 1) return j === 0 ? Sh : St;
          if (y === a.ey - 2) return fl && adx % 2 ? '#ffffff' : Y;
          if (dx === 0 && y < a.ey - 2) return Sh;
          if (adx >= 5) return y % 2 ? sd : st;
          if (dx <= -3) return Sh;
          return St;
        });
        // 번개 날개 (투구 양옆에서 위로 솟는다)
        const bolt = ['YY....', '.YY...', '..YY..', '.YYYY.', '...YY.', '....YY', '.....Y', '.....Y'];
        const bm = { Y: fl ? '#ffffff' : Y };
        this.pattern(bolt, a.left - 5, a.top - 7, bm);
        this.pattern(mirror(bolt), a.right, a.top - 7, bm);
        // 날개 윤곽 그늘 (한 칸 아래)
        bolt.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'Y' && (bolt[j + 1] || '')[i] !== 'Y') { this.px(a.left - 5 + i, a.top - 6 + j, y2); this.px(a.right + 5 - i, a.top - 6 + j, y2); } });
        glow(this, a.left - 2, a.top - 3, 4, 5, '255,232,74', 0.25 + (fl ? 0.3 : 0));
        glow(this, a.right + 3, a.top - 3, 4, 5, '255,232,74', 0.25 + (fl ? 0.3 : 0));
        this.pattern(['.S.', 'SYS'], a.hx - 1, a.top - 2, { S: Sh, Y });
        // 강철 갑옷 + 가슴 번개 문장
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return sd;
          if (dy === -3) return st;
          if (adx >= 5) return dy <= -1 ? Sh : st;
          if (dx === 0) return st;
          return (x + y) % 4 === 0 ? Sh : St;
        });
        if (!a.curled) {
          const pa = ['..KKK', '.KSSY', 'KSShS', 'KsSSs', '.KKKK'];
          const pm = { K: sd, S: Sh, s: St, h: '#ffffff', Y };
          this.pattern(pa, a.left - 4, a.my + 1, pm);
          this.pattern(mirror(pa), a.right, a.my + 1, pm);
          this.pattern(['.Y', 'YY', 'Y.'], a.hx - 1, a.my + 3, { Y: fl ? '#ffffff' : Y });
          glow(this, a.hx, a.my + 4, 3, 2.5, '255,232,74', 0.4);
        }
        // 몸 둘레를 타고 튀는 전기 (머리 바깥 둘레만)
        const k = Math.floor(t * 8);
        if (hash(k * 3) > 0.35) {
          const a0 = -Math.PI + hash(k * 5) * Math.PI * 1.2;
          let px0 = a.hx + 0.5 + Math.cos(a0) * 9, py0 = a.ey - 1 + Math.sin(a0) * 8;
          for (let i = 1; i <= 4; i++) {
            const an = a0 + i * 0.18;
            const r = 9 + (hash(k * 7 + i) - 0.5) * 2.5;
            const px1 = a.hx + 0.5 + Math.cos(an) * r, py1 = a.ey - 1 + Math.sin(an) * r * 0.9;
            seg(this, px0, py0, px1, py1, i % 2 ? '#ffffff' : Y, false);
            px0 = px1; py0 = py1;
          }
        }
        // 전쟁 망치
        const h = hand(this, a);
        if (!h) return;
        const hm = { K: sd, S: Sh, s: St, Y: fl ? '#ffffff' : Y };
        if (h.curled) {
          for (let x = h.x; x <= h.x + 4; x++) this.px(x, GROUND - 1, x % 2 ? '#6a4a2a' : '#c8a060');
          this.pattern(['KKKK', 'KSsK', 'KYsK', 'KSsK', 'KKKK'], h.x + 5, GROUND - 4, hm);
          return;
        }
        const sx = h.x + 1;
        for (let y = a.cy - 14; y <= a.cy + 3; y++) { this.px(sx, y, y % 3 ? '#6a4a2a' : '#c8a060'); this.px(sx + 1, y, '#3a2a1a'); }
        this.pattern(['.KKKKKK.', 'KWSSSSsK', 'KYYYYYYK', 'KSSYSSsK', 'KYYYYYYK', 'KSSSSssK', '.KKKKKK.'], sx - 3, a.cy - 20, Object.assign({ W: '#ffffff' }, hm, { S: '#d0d8e8', s: '#8a94a8', Y: fl ? '#ffffff' : Y }));
        glow(this, sx + 1, a.cy - 17, 6, 4.5, '255,232,74', 0.2 + 0.3 * tw(t, 4, 5));
        for (let i = 0; i < 3; i++) {
          const q = hash(Math.floor(t * 10) * 3 + i);
          if (q > 0.5) this.px(Math.round(sx - 4 + q * 9), Math.round(a.cy - 20 - hash(i + Math.floor(t * 10)) * 3), '#fff6a0', false);
        }
        if (fl) {
          seg(this, sx + 5, a.cy - 18, sx + 8, a.cy - 21, '#ffffff', false);
          seg(this, sx + 8, a.cy - 21, sx + 7, a.cy - 23, '#ffe84a', false);
        }
        heldPaw(this, g, sx, a.cy + 1);
      },
    },

    // =====================================================================
    // 8. 세계수의 숲 군주 — 나뭇잎 두건 뒤로 세계수 가지 같은 큰 뿔이 뻗고, 가지 끝마다 잎과 꽃이 피었다 진다.
    //    발밑엔 풀과 꽃이 흔들리고 숲 정령 빛이 둘레를 돌며, 나뭇잎이 흩날린다. 손엔 빛나는 씨앗 지팡이
    xforestking: {
      back(g, a, c, t) {
        // 숲 정령 빛 (뒤쪽 반바퀴)
        wispDraw.call(this, a, t, false);
        // 세계수 뿔
        const leaves = [];
        const sw = Math.sin(t * 1.2) * 0.05;
        const branch = (x, y, ang, len, d, s) => {
          const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
          seg(this, x, y, ex, ey, d === 0 ? '#5a3a1e' : d === 1 ? '#7a5228' : '#9a6a38');
          if (d === 0) seg(this, x - s, y, ex - s, ey, '#4a301a');
          if (d < 2) {
            branch(ex, ey, ang - 0.5 * s + sw * (d + 1), len * 0.78, d + 1, s);
            branch(ex, ey, ang + 0.42 * s + sw * (d + 1), len * 0.72, d + 1, s);
          } else leaves.push([ex, ey]);
        };
        const base = a.curled ? 4 : 5;
        for (const s of [-1, 1]) branch(a.hx + 0.5 + s * 3, a.top + 1, -Math.PI / 2 + s * 0.45, base, 0, s);
        // 가지 끝: 잎 뭉치, 몇 곳은 꽃이 봉오리 → 활짝 → 지는 순서로
        leaves.forEach(([x, y], i) => {
          const lx = Math.round(x), ly = Math.round(y);
          this.ellipse(lx + 0.5, ly + 0.5, 2, 1.6, (px, py) => (py < ly ? '#7ac850' : px > lx ? '#1f6a3c' : '#2f9a5a'), '#14462a');
          if (i % 2 === 0) {
            const ph = (t * 0.25 + i * 0.19) % 1;
            if (ph < 0.25) this.px(lx, ly - 1, '#ff8ab8');
            else if (ph < 0.85) this.pattern(['.P.', 'PYP', '.P.'], lx - 1, ly - 2, { P: ph > 0.7 ? '#ffd0e4' : '#ffb0d0', Y: '#ffe07a' });
          }
        });
        // 발밑 풀과 꽃 (바람에 흔들)
        if (!a.curled) for (let x = a.hx - 13; x <= a.hx + 13; x += 2) {
          const h = 2 + Math.round(hash(x) * 2);
          const b = Math.round(Math.sin(t * 2 + x * 0.5) * 0.6);
          for (let j = 0; j < h; j++) this.px(x + (j === h - 1 ? b : 0), GROUND - j, j === h - 1 ? '#7ac850' : '#2f9a5a');
          if (hash(x * 3) > 0.7) this.px(x + b, GROUND - h, hash(x * 5) > 0.5 ? '#ffb0d0' : '#fff6a0');
        }
        cape(this, a, t, '#2f7a46', '#1f5a32', '#4a9a5a', '#c8e070');
      },
      front(g, a, c, t) {
        const L1 = '#2f9a5a', L2 = '#1f6a3c', Lh = '#7ac850', Bk = '#6a4a2a', bk = '#4a321c', Am = '#ffc84a';
        // 나뭇잎 두건 + 나무 머리띠
        hood(this, g, a, (dx, y, x, j) => {
          const adx = Math.abs(dx);
          if (isFace(a, dx, y)) return null;
          if (j <= 1) return j === 0 ? Lh : L1;
          if (y === a.ey - 2) return dx === 0 ? Am : adx % 3 === 0 ? Lh : Bk;
          const k = (((x * 3 + y * 5) % 6) + 6) % 6;
          if (adx >= 5) return k < 2 ? L1 : L2;
          if (dx <= -2 && y < a.ey - 2) return k < 3 ? Lh : L1;
          return k < 2 ? Lh : k < 4 ? L1 : L2;
        });
        const pu = tw(t, 0, 2.2);
        glow(this, a.hx + 0.5, a.ey - 1.5, 3, 2, '255,210,90', 0.5 * pu);
        // 나무껍질 갑옷에 덩굴
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return bk;
          if (dy === -3) return L2;
          if (adx >= 5) return dy <= -1 ? L1 : L2;
          if ((((dx + dy * 2) % 5) + 5) % 5 === 0) return Lh;
          return x % 3 === 0 ? bk : Bk;
        });
        if (!a.curled) {
          // 잎 칼라 (어깨 밖으로 늘어진다)
          const lc = ['..LL', '.LlL', 'LlL.', 'lL..'];
          const lm = { L: Lh, l: L2 };
          this.pattern(lc, a.left - 4, a.my + 1, lm);
          this.pattern(mirror(lc), a.right + 1, a.my + 1, lm);
          // 가슴 씨앗 보석
          this.pattern(['.A.', 'AWA', '.A.'], a.hx - 1, a.my + 2, { A: '#9ae860', W: pu > 0.5 ? '#ffffff' : '#e8ffc8' });
          glow(this, a.hx + 0.5, a.my + 3.5, 3.5, 3, '180,255,120', 0.45 * pu);
        }
        // 흩날리는 나뭇잎·꽃잎 (얼굴 위로는 안 지나간다)
        for (let i = 0; i < 6; i++) {
          const p = (t * 0.18 + hash(i + 11)) % 1;
          const x = Math.round(a.hx + 17 - p * 34 + Math.sin(t * 2 + i) * 1.5);
          const y = Math.round(9 + hash(i * 3 + 2) * 12 + p * 22);
          if (Math.abs(x - a.hx) <= 8 && y >= a.top - 1) continue;
          this.pattern(i % 3 ? ['LL'] : ['P'], x, y, { L: i % 2 ? '#7ac850' : '#c8e070', P: '#ffb0d0' }, false);
        }
        // 숲 정령 빛 (앞쪽 반바퀴)
        wispDraw.call(this, a, t, true);
        // 씨앗 지팡이: 비틀린 나무 자루, 가지 요람에 빛나는 씨앗
        const h = hand(this, a);
        if (!h) return;
        if (h.curled) {
          for (let x = h.x; x <= h.x + 5; x++) this.px(x, GROUND - 1, x % 2 ? '#7a5228' : '#5a3a1e');
          glow(this, h.x + 7.5, GROUND - 1.5, 3, 3, '200,255,140', 0.5);
          this.pattern(['.A.', 'AWA', '.A.'], h.x + 6, GROUND - 3, { A: '#c8ff8a', W: '#ffffff' });
          return;
        }
        const sx = h.x + 1;
        for (let y = a.cy - 13; y <= GROUND - 1; y++) { this.px(sx + (y % 4 < 2 ? 0 : 1), y, '#7a5228'); this.px(sx + (y % 4 < 2 ? 1 : 0), y, '#4a301a'); }
        this.pattern(['K...K', 'K...K', '.K.K.', '..K..'], sx - 2, a.cy - 17, { K: '#7a5228' });
        glow(this, sx + 0.5, a.cy - 17.5, 5, 5, '200,255,140', 0.3 + 0.3 * pu);
        this.pattern(['.A.', 'AWA', '.A.'], sx - 1, a.cy - 19, { A: '#c8ff8a', W: pu > 0.5 ? '#ffffff' : '#f0ffd8' });
        const lf = Math.round(Math.sin(t * 2.5) * 0.6);
        this.pattern(['LL'], sx - 4 + lf, a.cy - 18, { L: '#7ac850' });
        this.pattern(['LL'], sx + 3 - lf, a.cy - 18, { L: '#2f9a5a' });
        heldPaw(this, g, sx, a.cy + 1);
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, LAB);

  const LAB_ITEMS = [
    ['xcelestialemperor', 'set', '천상의 황제 갑옷'],
    ['xnebuladragoon', 'set', '성운 용기사'],
    ['xsunguardian', 'set', '태양 신전의 수호신'],
    ['xphoenixking', 'set', '불사조 왕'],
    ['xfrostmonarch', 'set', '서리 군주'],
    ['xabyssking', 'set', '심해의 바다 군주'],
    ['xthunderlord', 'set', '천둥 군주'],
    ['xforestking', 'set', '세계수의 숲 군주'],
  ];
  const LAB_COMBOS = [];
})(window);

// ---------- headface ----------
// 별 상점 "끝판왕" 시안 — 머리 5 · 얼굴 5
(function (root) {
  const { GROUND, sway, hash, mirror, hood, isFace, star } = root.PetSprite.costumeKit;
  const tw = (t, i, sp = 2) => 0.5 + 0.5 * Math.sin(t * sp + i * 1.7); // 반짝 세기 0~1
  const rgba = (r, g, b, al) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, al)).toFixed(2)})`;
  const hsl = (h, s, l) => `hsl(${Math.round(((h % 360) + 360) % 360)},${s}%,${l}%)`;
  const hsla = (h, s, l, al) => `hsla(${Math.round(((h % 360) + 360) % 360)},${s}%,${l}%,${Math.max(0, Math.min(1, al)).toFixed(2)})`;
  // 눈 칸 · 코와 입 칸 (얼굴 칸 소품이 비워 둘 자리)
  const inEyeOrMouth = (a, x, y) =>
    (y >= a.ey && y < a.ey + a.eh && ((x >= a.eyeL && x < a.eyeL + a.ew) || (x >= a.eyeR && x < a.eyeR + a.ew))) || (Math.abs(x - a.fx) <= 1 && y >= a.my && y <= a.my + 2);
  const OPEN = new Set(['open', 'wide', 'sparkle', 'teary']);
  const eyesOpen = (g) => !(g.p && g.p.eyes) || OPEN.has(g.p.eyes);

  // 둥근 빛 번짐 (반투명)
  function glow(r, cx, cy, rad, rgb, al) {
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++)
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= rad) r.px(x, y, rgba(rgb[0], rgb[1], rgb[2], al * (1 - d / rad)), false);
      }
  }
  function line(r, x1, y1, x2, y2, col, solid = true) {
    const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let s = 0; s <= n; s++) {
      const c = typeof col === 'function' ? col(s / n, s) : col;
      if (c) r.px(Math.round(x1 + ((x2 - x1) * s) / n), Math.round(y1 + ((y2 - y1) * s) / n), c, solid);
    }
  }
  // 굽은 관(뿔·지느러미): P(u) = [x, y], W(u) = 반폭. 외곽선 K 를 먼저 두르고 속을 fill(x, y, u, side) 로
  function tube(r, P, W, fill, K, N = 40) {
    const pts = [];
    for (let k = 0; k <= N; k++) pts.push([...P(k / N), k / N]);
    let x0 = 99, x1 = -99, y0 = 99, y1 = -99;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const inner = [];
    for (let y = Math.floor(y0 - 4); y <= Math.ceil(y1 + 4); y++)
      for (let x = Math.floor(x0 - 4); x <= Math.ceil(x1 + 4); x++) {
        let best = null;
        for (let k = 0; k < pts.length; k++) {
          const d = Math.hypot(x + 0.5 - pts[k][0], y + 0.5 - pts[k][1]);
          if (!best || d < best.d) best = { d, k };
        }
        const u = pts[best.k][2];
        const w = W(u);
        if (best.d <= w) inner.push([x, y, u, best]);
        else if (K && best.d <= w + 1 && !(u >= 0.999 && best.d > w + 0.5) && u > 0.02) r.px(x, y, K);
      }
    for (const [x, y, u, b] of inner) {
      const k = Math.min(pts.length - 2, b.k);
      const tx = pts[k + 1][0] - pts[k][0], ty = pts[k + 1][1] - pts[k][1];
      const side = Math.sign(tx * (y + 0.5 - pts[b.k][1]) - ty * (x + 0.5 - pts[b.k][0])); // 관의 어느 쪽인가
      const c = fill(x, y, u, side, b.d / Math.max(0.01, W(u)));
      if (c) r.px(x, y, c);
    }
  }
  // 큰 4갈래 별 (가운데 W, 길이 len)
  function bigStar(r, x, y, len, col, core = '#ffffff', solid = true) {
    for (let i = 1; i <= len; i++) {
      const c = i === len ? rgba(255, 255, 255, 0.55) : col;
      r.px(x + i, y, c, solid); r.px(x - i, y, c, solid); r.px(x, y + i, c, solid); r.px(x, y - i, c, solid);
    }
    r.px(x, y, core, solid);
  }

  // 얼굴 소품이 찍는 점: 눈 · 코 · 입 칸은 건너뛴다
  const fpx = (r, a, x, y, col, solid = false) => {
    x = Math.round(x); y = Math.round(y);
    if (!inEyeOrMouth(a, x, y)) r.px(x, y, col, solid);
  };
  // 타원 빛 번짐 (반투명)
  function glowE(r, cx, cy, rx, ry, rgb, al) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (e < 1) r.px(x, y, rgba(rgb[0], rgb[1], rgb[2], al * (1 - e)), false);
      }
  }
  // 혜성 꼬리 색: 흰 → 금 → 살구 → 하늘 → 파랑 → 보라 (초록을 거치지 않게 칸마다 끊어 고른다). u = 0~1, lift = 밝게 더할 값
  const TAIL = [[255, 252, 236], [255, 232, 128], [255, 206, 160], [190, 232, 255], [130, 200, 255], [170, 150, 255], [215, 150, 255]];
  const tailCol = (u, al = 1, lift = 0) => {
    const c = TAIL[Math.min(TAIL.length - 1, Math.floor(Math.max(0, Math.min(0.999, u)) * TAIL.length))];
    return rgba(Math.min(255, c[0] + lift), Math.min(255, c[1] + lift), Math.min(255, c[2] + lift), al);
  };
  // 혼불 안광의 도깨비불 셋: 몸 둘레 비스듬한 궤도. 앞쪽 반바퀴(front)는 발치로, 뒤쪽 반바퀴는 머리 뒤로 지나간다
  function soulOrbs(r, a, t, front) {
    for (let i = 0; i < 3; i++) {
      const an = t * 1.1 + (i * Math.PI * 2) / 3;
      if (Math.sin(an) > 0 !== front) continue;
      const pos = (b) => [a.hx + 0.5 + Math.cos(b) * 14, a.ey + 1 + Math.sin(b) * 6.5];
      const [x, y] = pos(an);
      const hue = 190 + 40 * Math.sin(t * 1.5 + i * 2);
      // 꼬리: 지나온 길을 따라
      for (let k = 1; k <= 7; k++) {
        const [tx, ty] = pos(an - k * 0.09);
        const al = (front ? 0.85 : 0.55) * (1 - k / 8);
        const yy = ty - k * 0.35 + Math.sin(t * 8 + k) * 0.4;
        if (front) fpx(r, a, tx, yy, hsla(hue + k * 12, 100, 70, al));
        else r.px(tx, yy, hsla(hue + k * 12, 100, 70, al), false);
      }
      glow(r, x, y, front ? 3.5 : 2.5, [120, 230, 255], front ? 0.55 : 0.35);
      const bx = Math.round(x - 0.5), by = Math.round(y - 0.5);
      const fl = Math.round(Math.sin(t * 9 + i) * 0.6);
      if (front) r.pattern(['..w..', '.wCw.', 'wCWCw', 'wCWCw', '.wCw.'], bx - 2 + fl, by - 3, { W: '#ffffff', C: hsl(hue - 10, 100, 82), w: hsla(hue + 20, 100, 62, 0.9) }, false);
      else r.pattern(['.w.', 'wWw', '.w.'], bx - 1, by - 1, { W: hsla(hue, 100, 88, 0.85), w: hsla(hue + 20, 100, 62, 0.6) }, false);
    }
  }

  const LAB = {
    // ======================= 머리 =======================

    // 1. 천상의 왕관 — 백금 아치에 금띠, 루비·사파이어·에메랄드. 머리 위에 큰 별 보석이 떠서 숨 쉬듯 빛나고,
    //    금띠를 따라 빛줄기가 훑고 지나가며, 작은 별 셋이 왕관 둘레를 돈다
    xcelestialcrown: {
      back(g, a, c, t) {
        const pu = tw(t, 0, 2.2);
        glow(this, a.hx + 0.5, a.top - 7, 11, [255, 240, 190], 0.28 + 0.12 * pu);
        // 뒤쪽 반바퀴를 도는 별
        for (let i = 0; i < 3; i++) {
          const an = t * 1.3 + (i * Math.PI * 2) / 3;
          if (Math.sin(an) > 0) continue;
          this.px(Math.round(a.hx + Math.cos(an) * 11), Math.round(a.top - 5 + Math.sin(an) * 2.5), rgba(255, 236, 170, 0.7), false);
        }
      },
      front(g, a, c, t) {
        const m = {
          K: '#1c1530', W: '#ffffff', P: '#f4f6fb', p: '#c3cad8', q: '#8a93a8',
          Y: '#ffd84a', y: '#d19a1c', o: '#8a5a0c', R: '#ff3b5c', r: '#a8143a', B: '#4a8dff', E: '#3ee8a0', V: '#c58bff',
        };
        this.pattern(
          [
            '.......K.......',
            '......KYK......',
            '..K..KYWYK..K..',
            '.KBK.KYYYK.KEK.',
            '.KPK..KYK..KPK.',
            'KKPKKKPYPKKKPKK',
            'KPpPKPPpPPKPpPK',
            'KPpPPPpRpPPPpqK',
            'KYYYYYYYYYYYYYK',
            'KYBYEYRWRYEYBYK',
            'KyoyyyyyyyyyoyK',
            'KKKKKKKKKKKKKKK',
          ],
          a.hx - 7, a.top - 11, m,
        );
        // 금띠를 훑는 빛
        const sx = Math.floor((t * 9) % 26) - 5;
        for (const d of [0, 1]) {
          const x = a.hx - 6 + sx - d;
          if (x >= a.hx - 6 && x <= a.hx + 6) this.px(x, a.top - 3, d ? '#fff6c8' : '#ffffff');
        }
        // 보석 반짝 (차례로)
        const gi = Math.floor(t * 2) % 5;
        this.px(a.hx + [-5, -3, -1, 3, 5][gi], a.top - 2, '#ffffff');
        // 떠 있는 별 보석: 위아래로 둥실, 숨 쉬듯 커진다
        const by = a.top - 17 + Math.round(Math.sin(t * 2) * 1);
        const pu = tw(t, 0, 2.2);
        glow(this, a.hx + 0.5, by + 0.5, 5, [255, 230, 140], 0.55 * pu + 0.2);
        this.pattern(['...K...', '..KYK..', 'KKYYYKK', 'KYYWYyK', '.KYYyK.', 'KYyKyyK', 'KK...KK'], a.hx - 3, by - 3, { K: '#6a4208', Y: '#ffe36a', y: '#e0a91c', W: '#ffffff' });
        if (pu > 0.6) bigStar(this, a.hx, by, pu > 0.85 ? 6 : 5, rgba(255, 246, 200, 0.85), '#ffffff', false);
        // 별 보석과 왕관 꼭대기를 잇는 빛기둥
        for (let y = by + 4; y < a.top - 11; y++) this.px(a.hx, y, rgba(255, 240, 180, 0.35 + 0.3 * pu), false);
        // 앞쪽 반바퀴를 도는 별
        for (let i = 0; i < 3; i++) {
          const an = t * 1.3 + (i * Math.PI * 2) / 3;
          if (Math.sin(an) <= 0) continue;
          star(this, Math.round(a.hx + Math.cos(an) * 11), Math.round(a.top - 5 + Math.sin(an) * 2.5), i === 1 ? '#a8d8ff' : '#ffe27a');
        }
      },
    },

    // 2. 성운 뿔 — 이마 양옆에서 크게 휘어 오르는 뿔이 성운 가스로 되어 있다. 보라·분홍·청록이 뿌리에서 끝으로 흘러가고,
    //    속에 별이 깜빡이며, 뿔 끝에서 별가루 연기가 피어오른다
    xnebulahorns: {
      back(g, a, c, t) {
        for (const s of [-1, 1]) glow(this, a.hx + s * 9, a.top - 9, 7, [170, 110, 255], 0.22 + 0.1 * tw(t, s, 1.6));
      },
      front(g, a, c, t) {
        for (const s of [-1, 1]) {
          const bx = a.hx + s * 3.5, by = a.top + 0.5;
          // 뿌리 → 바깥 위로 크게 휘었다가 끝이 안쪽으로 말린다 (3차 베지어)
          const P = (u) => {
            const p0 = [bx, by], p1 = [bx + s * 9, by - 2], p2 = [bx + s * 9, by - 13], p3 = [bx + s * 3, by - 15];
            const v = 1 - u;
            return [0, 1].map((i) => v * v * v * p0[i] + 3 * v * v * u * p1[i] + 3 * v * u * u * p2[i] + u * u * u * p3[i]);
          };
          const W = (u) => 2.3 * (1 - u) + 0.35;
          tube(this, P, W, (x, y, u, side, d) => {
            const h = 270 + 70 * Math.sin(u * 5 - t * 2.2) + 20 * side * s;
            const l = 46 + 20 * (1 - d) + (side * s < 0 ? 10 : -6);
            if (hash(x * 13 + y * 7) > 0.88 && tw(t, x * 3 + y, 3) > 0.55) return '#ffffff';
            return hsl(h, 85, Math.min(88, l));
          }, '#1a0f33');
          // 뿔을 따라 흘러가는 빛
          const q = (t * 0.6 + (s > 0 ? 0.5 : 0)) % 1;
          const [qx, qy] = P(q);
          this.px(Math.round(qx), Math.round(qy), '#ffffff');
          glow(this, qx, qy, 2.5, [255, 220, 255], 0.5);
          // 뿔 끝 별가루 연기
          const [tx, ty] = P(1);
          for (let i = 0; i < 4; i++) {
            const p = (t * 0.5 + i / 4) % 1;
            const x = tx + Math.sin(p * 6 + i * 2) * 1.5 - s * p * 2, y = ty - 1 - p * 7;
            this.px(Math.round(x), Math.round(y), i % 2 ? rgba(255, 200, 255, 0.8 * (1 - p)) : rgba(150, 230, 255, 0.8 * (1 - p)), false);
          }
        }
        // 이마의 작은 성운석
        this.pattern(['.K.', 'KVK', '.K.'], a.hx - 1, a.top, { K: '#1a0f33', V: hsl(290 + 40 * Math.sin(t * 2), 90, 72) });
      },
    },

    // 3. 별무리 후광 관 — 머리 뒤 커다란 이중 후광 고리를 열두 별이 천천히 돌고, 이마엔 백금 띠관과 푸른 별 보석.
    //    머리 위엔 비스듬한 별 궤도가 하나 더 돌아서 앞으로 올 땐 머리 앞을, 뒤로 갈 땐 머리 뒤를 지난다
    xstarhalo: {
      back(g, a, c, t) {
        const cx = a.hx + 0.5, cy = a.ey - 3;
        const pu = tw(t, 0, 1.8);
        for (let y = Math.floor(cy - 14); y <= cy + 14; y++)
          for (let x = Math.floor(cx - 14); x <= cx + 14; x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            if (y > a.ey + 3) continue;
            if (d <= 10) this.px(x, y, rgba(200, 220, 255, (0.1 + 0.12 * pu) * (d / 10)), false);
            else if (d <= 11) this.px(x, y, (Math.floor(Math.atan2(y - cy, x - cx) * 6 + t * 3) % 3 === 0 ? '#ffffff' : '#ffd65a'), false);
            else if (d <= 12) this.px(x, y, rgba(255, 220, 120, 0.35 + 0.2 * pu), false);
            else if (d <= 13.4 && d > 12.6) this.px(x, y, rgba(170, 200, 255, 0.55), false);
          }
        // 고리를 도는 열두 별
        for (let i = 0; i < 12; i++) {
          const an = (i / 12) * Math.PI * 2 + t * 0.35;
          const x = Math.round(cx - 0.5 + Math.cos(an) * 13), y = Math.round(cy - 0.5 + Math.sin(an) * 13);
          if (y > a.ey + 3) continue;
          if (i % 3 === 0) star(this, x, y, tw(t, i, 3) > 0.5 ? '#fff3a0' : '#a8c8ff', false);
          else this.px(x, y, '#ffffff', false);
        }
        this._xhaloOrbit(a, t, false);
      },
      front(g, a, c, t) {
        // 이마 띠관 (백금 + 금 테)
        const m = { K: '#1c1530', P: '#f4f6fb', p: '#b8c0d0', Y: '#ffd84a', B: '#5aa0ff', b: '#2a52c8', W: '#ffffff' };
        this.pattern(['.......K.......', '......KBK......', '..K..KPBPK..K..', '.KYK.KPbPK.KYK.', 'KPPpKPPPPPKpPPK', 'KYYYYYYYYYYYYYK'], a.hx - 7, a.top - 4, m);
        if (tw(t, 1, 3) > 0.7) this.px(a.hx, a.top - 3, '#ffffff');
        const sx = Math.floor((t * 8) % 20) - 3;
        if (sx >= 1 && sx <= 13) this.px(a.hx - 7 + sx, a.top + 1, '#ffffff');
        this._xhaloOrbit(a, t, true);
      },
    },

    // 4. 용왕의 투구 장식 — 청옥 용비늘 투구가 정수리를 덮고, 양옆으로 금 살대의 지느러미 날개가 물결친다.
    //    이마엔 금빛 용머리, 그 위엔 여의주가 불꽃을 두르고 돌며, 금 수염 두 가닥이 바람에 휘날린다
    xdragonhelm: {
      back(g, a, c, t) {
        // 지느러미 날개: 금 살대 넷 사이에 반투명 청옥 막
        for (const s of [-1, 1]) {
          const x0 = s < 0 ? a.left + 1 : a.right - 1, y0 = a.ey - 2;
          const ribs = [];
          for (let k = 0; k < 5; k++) {
            const wave = Math.sin(t * 3 - k * 0.6) * 0.07 * (k + 1);
            const an = -1.35 + k * 0.36 + wave; // 위 → 옆
            const len = 11 - k * 1.3;
            ribs.push([x0 + s * Math.cos(an) * len, y0 + Math.sin(an) * len]);
          }
          // 막: 살대 사이 삼각형을 채운다 (안쪽은 짙게, 끝은 밝게)
          for (let k = 0; k < 4; k++) {
            const [ax, ay] = ribs[k], [bx, by] = ribs[k + 1];
            for (let u = 0; u <= 1; u += 0.05) for (let v = 0; v <= 1 - u; v += 0.05) {
              const x = x0 + (ax - x0) * u + (bx - x0) * v, y = y0 + (ay - y0) * u + (by - y0) * v;
              const e = u + v;
              this.px(Math.round(x), Math.round(y), e > 0.9 ? rgba(170, 255, 236, 0.85) : rgba(30 + e * 60, 190 + e * 50, 170 + e * 40, 0.55 + 0.25 * e), false);
            }
          }
          ribs.forEach(([rx, ry]) => line(this, x0, y0, rx, ry, (u) => (u > 0.9 ? '#fff4b0' : u > 0.45 ? '#ffd84a' : '#c9921c')));
          // 지느러미 끝 물방울 빛
          const p = (t * 0.7 + (s > 0 ? 0.5 : 0)) % 1;
          const [tx, ty] = ribs[Math.floor(p * 5) % 5];
          glow(this, tx, ty, 2.5, [170, 255, 236], 0.6 * (1 - p));
        }
      },
      front(g, a, c, t) {
        const S = '#1fb59a', s2 = '#0d6e63', H = '#8ff5dc', D = '#06463f';
        // 비늘 투구: 눈썹 위 두 줄까지 (귀도 덮는다)
        hood(this, g, a, (dx, y, x) => {
          if (y > a.ey - 2) return null;
          if (y === a.ey - 2) return Math.abs(dx) % 2 ? '#ffd84a' : '#c9921c';
          const sc = (x + (y % 2) * 2) % 4;
          if (sc === 0) return D;
          if (sc === 1 && y % 2 === 0) return H;
          return Math.abs(dx) >= 5 ? s2 : S;
        });
        // 금빛 용머리 장식: 정수리 위에 앞을 보고 앉았다. 갈래진 금뿔 둘, 붉은 눈, 벌린 입에 이빨
        const m = { K: '#0b2a26', Y: '#ffd84a', y: '#c9921c', H: '#8ff5dc', G: '#2fd0a8', g: '#14907a', R: '#ff3b3b', r: '#a8142a', W: '#f4fbff' };
        this.pattern(
          [
            'K.K.......K.K',
            'KYK.K...K.KYK',
            '.KYKYK.KYKYK.',
            '..KYYK.KYYK..',
            '...KYKKKYK...',
            '..KYGGGGGYK..',
            '.KGRHGGGHRGK.',
            'WKGGGgHgGGGKW',
            'WWKgGKGKGgKWW',
            '.WKKWKKKWKKW.',
            '....KrRrK....',
            '.....KKK.....',
          ],
          a.hx - 6, a.earTop - 10, m,
        );
        // 붉은 눈이 이따금 번뜩
        if (t % 2.8 < 0.25) for (const dx of [-3, 3]) glow(this, a.hx + dx + 0.5, a.earTop - 3.5, 2, [255, 80, 60], 0.8);
        // 금 수염: 용머리 입가에서 바깥으로 휘날린다
        for (const s of [-1, 1]) {
          for (let i = 0; i < 13; i++) {
            const x = a.hx + s * (6 + i), y = a.earTop - 3 + Math.round(i * 0.3 + Math.sin(t * 3 - i * 0.5) * (i / 5));
            this.px(x, y, i > 10 ? rgba(255, 230, 140, 1 - (i - 10) / 3) : i % 3 ? '#ffd84a' : '#fff0a0', i <= 10);
          }
        }
        // 여의주: 둥실 떠서 빛나고 불꽃이 둘레를 돈다
        const py = a.earTop - 16 + Math.round(Math.sin(t * 2.2));
        const pu = tw(t, 0, 2.5);
        glow(this, a.hx + 0.5, py + 1, 5.5, [120, 255, 230], 0.35 + 0.25 * pu);
        this.pattern(['.KKK.', 'KWHCK', 'KHCcK', 'KCccK', '.KKK.'], a.hx - 2, py - 1, { K: '#0b3a46', W: '#ffffff', H: '#d8fff6', C: '#5ae8d8', c: '#22a8b8' });
        for (let i = 0; i < 3; i++) {
          const an = t * 3 + (i * Math.PI * 2) / 3;
          const x = a.hx + Math.cos(an) * 4, y = py + 1 + Math.sin(an) * 3.2;
          this.px(Math.round(x), Math.round(y), i % 2 ? '#ffb02a' : '#ff6a2a', false);
          this.px(Math.round(x - Math.cos(an + 1.57) * 1), Math.round(y - Math.sin(an + 1.57) * 1), 'rgba(255,200,80,0.55)', false);
        }
      },
    },

    // 5. 신의 월계관 — 이마의 금띠(가운데 태양석)에서 관자놀이 양쪽으로 금 월계 가지가 날개처럼 뻗고, 머리 뒤로 거대한 태양이 빛살을 돌린다.
    //    잎을 따라 빛이 흘러가고(띠에도 빛이 지나간다), 금빛 티끌이 위로 피어오른다
    xdivinelaurel: {
      back(g, a, c, t) {
        const cx = a.hx + 0.5, cy = a.top - 3;
        const pu = tw(t, 0, 2);
        glow(this, cx, cy, 9, [255, 210, 110], 0.5 + 0.15 * pu);
        // 길고 짧은 빛살이 번갈아 천천히 돈다
        for (let i = 0; i < 16; i++) {
          const an = (i / 16) * Math.PI * 2 + t * 0.4;
          if (Math.sin(an) > 0.45) continue;
          const len = i % 2 ? 12 : 16 + Math.round(pu * 2);
          for (let r = 6; r < len; r++) {
            const al = (i % 2 ? 0.45 : 0.75) * (1 - (r - 6) / (len - 6));
            this.px(Math.round(cx - 0.5 + Math.cos(an) * r), Math.round(cy - 0.5 + Math.sin(an) * r), rgba(255, 220, 120, al), false);
          }
        }
        // 태양 원판 테
        for (let i = 0; i < 48; i++) {
          const an = (i / 48) * Math.PI * 2;
          if (Math.sin(an) > 0.6) continue;
          this.px(Math.round(cx - 0.5 + Math.cos(an) * 7.5), Math.round(cy - 0.5 + Math.sin(an) * 7.5), rgba(255, 246, 200, 0.6 + 0.3 * pu), false);
        }
      },
      front(g, a, c, t) {
        const flow = (t * 6) % 12;
        // 관자놀이에서 바깥 위로 뻗는 월계 가지 (잎이 가지 양쪽에 청어뼈처럼). 왼쪽을 그리고 오른쪽은 거울로
        const cells = new Map();
        const put = (x, y, col) => { x = Math.round(x); y = Math.round(y); if (!isFace(a, x - a.hx, y)) cells.set(x + ',' + y, [x, y, col]); };
        let sx = a.left - 0.5, sy = a.top + 0.5;
        for (let k = 0; k < 9; k++) {
          const an = 0.62 + k * 0.1; // 0 = 옆, π/2 = 위
          const dx = -Math.cos(an), dy = -Math.sin(an);
          sx += dx * 1.25; sy += dy * 1.25;
          const lit = Math.abs(k - flow) < 1.2;
          const Y = lit ? '#ffffff' : '#ffd84a', T = lit ? '#fff6c8' : '#fff0a0', D = '#d9a11e';
          put(sx, sy, '#a8740e');
          if (k === 0) continue;
          const side = k % 2 ? 1 : -1; // 가지 위쪽 · 아래쪽 번갈아
          const nx = -dy * side, ny = dx * side;
          put(sx + nx * 1 + dx * 0.4, sy + ny * 1 + dy * 0.4, side > 0 ? Y : D);
          put(sx + nx * 1.6 + dx * 1.3, sy + ny * 1.6 + dy * 1.3, T);
        }
        put(sx + Math.cos(1.5) * -1, sy - 1, '#fff6c8'); // 가지 끝 새순
        for (const [x, y, col] of [...cells.values()]) cells.set((2 * a.hx - x) + ',' + y, [2 * a.hx - x, y, col]);
        // 이마 금띠
        for (let x = a.left - 1; x <= a.right + 1; x++) {
          cells.set(x + ',' + a.top, [x, a.top, (x + Math.floor(t * 6)) % 7 === 0 ? '#ffffff' : '#ffd84a']);
          cells.set(x + ',' + (a.top + 1), [x, a.top + 1, '#c9921c']);
        }
        for (const [x, y] of cells.values())
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
            if (!cells.has(x + ox + ',' + (y + oy)) && !isFace(a, x + ox - a.hx, y + oy)) this.px(x + ox, y + oy, '#4a2c04');
        for (const [x, y, col] of cells.values()) this.px(x, y, col);
        // 가운데 태양석 (띠 위로 솟은 금 받침)
        const pu = tw(t, 0, 2.5);
        glow(this, a.hx + 0.5, a.top - 1.5, 4.5, [255, 240, 160], 0.6 * pu + 0.2);
        this.pattern(['..K..', '.KYK.', 'KYWYK', 'KRYyK', 'KyRyK', '.KKK.'], a.hx - 2, a.top - 4, { K: '#4a2c04', Y: '#ffd84a', y: '#c9921c', W: '#ffffff', R: '#ff8a2a' });
        if (pu > 0.75) bigStar(this, a.hx, a.top - 2, 3, rgba(255, 250, 210, 0.8), '#ffffff', false);
        // 금빛 티끌
        for (let i = 0; i < 5; i++) {
          const p = (t * 0.45 + i / 5) % 1;
          const x = a.hx + Math.round((hash(i * 9 + Math.floor(t * 0.45 + i / 5)) - 0.5) * 22);
          this.px(x, Math.round(a.top - 2 - p * 14), rgba(255, 226, 120, 0.9 * (1 - p)), false);
        }
      },
    },

    // ======================= 얼굴 =======================

    // 6. 별빛 눈동자 고글 — 두툼한 백금 원형 테(위는 빛, 아래는 그늘)에 금 리벳, 렌즈 속은 밤하늘(눈은 비쳐 보인다).
    //    렌즈 안에서 별이 흘러가고 이따금 빛줄기가 렌즈를 비스듬히 스친다. 눈동자에 별빛이 켜지고, 끈 끝 발광석이 숨 쉰다
    xstargoggles: {
      front(g, a, c, t) {
        const cy = a.ey + a.eh / 2;
        const L = [a.eyeL + a.ew / 2, a.eyeR + a.ew / 2];
        const rl = 2.15, rr = 3.3, ro = 4;
        const pu = tw(t, 0, 2);
        // 끈: 테 바깥에서 머리 옆까지 두 줄, 끝에 발광석
        for (const s of [-1, 1]) {
          const xe = s < 0 ? a.left - 1 : a.right + 1;
          for (let x = Math.round(L[s < 0 ? 0 : 1] + s * 3.5); s < 0 ? x >= xe : x <= xe; x += s) {
            this.px(x, a.ey, '#3a3450'); this.px(x, a.ey + 1, x % 2 ? '#24203a' : '#4a4466');
          }
          this.pattern(['KK', 'BC', 'Cb', 'KK'], s < 0 ? xe - 1 : xe, a.ey - 1, { K: '#1c1530', B: '#d8f4ff', C: '#7ad8ff', b: '#3a8ad8' });
          glow(this, (s < 0 ? xe - 1 : xe) + 1, a.ey + 1, 3.5, [120, 210, 255], 0.3 + 0.35 * pu);
        }
        for (const cx of L) glow(this, cx, cy, 5, [140, 190, 255], 0.22 + 0.15 * pu);
        const sweep = (t % 3.5) / 0.6; // 0~1 동안 빛줄기가 지나간다
        for (let y = Math.floor(cy - ro); y <= cy + ro; y++)
          for (let x = Math.floor(L[0] - ro); x <= L[1] + ro; x++) {
            if (inEyeOrMouth(a, x, y)) continue;
            let d = 99, k = 0;
            L.forEach((cx, i) => { const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (dd < d) { d = dd; k = i; } });
            const dy = y + 0.5 - cy, dx = x + 0.5 - L[k];
            if (d < rl) {
              const st = (x * 3 + y * 5 + Math.floor(t * 2.5)) % 11 === 0;
              const gl = sweep < 1 && Math.abs(dx + dy - (sweep * 8 - 4)) < 0.8;
              this.px(x, y, gl ? 'rgba(255,255,255,0.85)' : st ? 'rgba(255,248,210,0.95)' : rgba(24, 36 + (dy + 2) * 10, 130 + (dy + 2) * 18, 0.62), false);
            } else if (d < rr) {
              const an = Math.atan2(dy, dx);
              const rivet = Math.abs(dy) < 0.6 && Math.abs(dx) > 2;
              this.px(x, y, rivet ? '#ffd84a' : dy < -1.2 ? (dx < 0 ? '#ffffff' : '#eef1f8') : dy < 0.8 ? '#c3cad8' : an > 1.2 && an < 1.9 ? '#ffd84a' : '#8a93a8');
            } else if (d < ro) this.px(x, y, '#1c1530');
          }
        // 콧등 다리 위 별 보석
        this.pattern(['.K.', 'KBK', '.K.'], Math.round((L[0] + L[1]) / 2) - 1, a.ey - 2, { K: '#1c1530', B: tw(t, 1, 3) > 0.6 ? '#ffffff' : '#5aa0ff' });
        // 눈동자 별빛
        if (eyesOpen(g)) for (const [ex, s] of [[a.eyeL, -1], [a.eyeR, 1]]) {
          const k = tw(t, s, 2.6), x = ex + (s < 0 ? 0 : a.ew - 1);
          this.px(x, a.ey, k > 0.5 ? '#ffffff' : '#bfe0ff');
          if (k > 0.82) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) this.px(x + dx, a.ey + dy, rgba(255, 250, 220, 0.75), false);
        }
      },
    },
    // 7. 성흔 문양 — 성흔이 깨어나 이마에서 하늘로 빛기둥이 솟는다. 기둥을 타고 빛 고리가 올라가고 별가루가 떠오른다.
    //    이마의 여덟 갈래 별은 금 → 장미 → 보랏빛으로 색이 돌며 3초마다 가로로 긴 섬광을 낸다.
    //    눈꼬리 무늬는 얼굴 밖 허공까지 뻗어 두 갈래 빛 날개가 되어 펄럭이고, 눈물선 끝엔 하늘빛 보석이 맺힌다 (눈 칸은 그대로)
    xstarsigil: {
      back(g, a, c, t) {
        const bx = a.hx, by = a.ey - 5;
        glow(this, a.hx + 0.5, a.ey - 2, 12, [255, 200, 170], 0.3 + 0.1 * tw(t, 1, 2));
        // 빛기둥
        for (let y = 0; y <= by; y++) {
          const u = y / Math.max(1, by);
          const k = 0.75 + 0.25 * Math.sin(y * 0.6 + t * 8);
          const fade = 0.35 + 0.65 * u;
          this.px(bx, y, rgba(255, 255, 245, 0.9 * k * fade), false);
          for (const s of [-1, 1]) {
            this.px(bx + s, y, rgba(255, 220, 120, 0.6 * k * fade), false);
            this.px(bx + 2 * s, y, rgba(255, 170, 150, 0.25 * k * fade), false);
            this.px(bx + 3 * s, y, rgba(255, 170, 150, 0.08 * fade), false);
          }
        }
        // 기둥을 타고 오르는 빛 고리
        for (let i = 0; i < 3; i++) {
          const q = (t * 0.45 + i / 3) % 1;
          const y = by - 2 - q * (by - 2);
          const rx = 2.5 + q * 3.5;
          for (let k = 0; k < 20; k++) {
            const an = (k / 20) * Math.PI * 2;
            this.px(bx + Math.cos(an) * rx, y + Math.sin(an) * 1.1, hsla(45 - q * 110, 100, 82, 0.85 * (1 - q)), false);
          }
        }
        // 기둥 둘레로 떠오르는 별가루
        for (let i = 0; i < 6; i++) {
          const q = (t * 0.5 + i / 6) % 1;
          const x = bx + Math.sin(q * 9 + i * 2) * (3 + (i % 3));
          const y = by - q * by;
          if (i % 2) star(this, Math.round(x), Math.round(y), hsla(45 - i * 20, 100, 80, 1 - q));
          else this.px(x, y, rgba(255, 250, 220, 1 - q), false);
        }
      },
      front(g, a, c, t) {
        const h = 45 - 110 * (0.5 + 0.5 * Math.sin(t * 0.9)) ** 1.5; // 금 → 장미 → 보랏빛
        const col = (i, l = 70, al = 1) => hsla(h - i * 18, 100, l, al);
        const flow = (i) => {
          const k = (Math.sin(t * 5 - i * 0.8) + 1) / 2;
          return k > 0.8 ? '#ffffff' : col(i, 62 + 14 * k);
        };
        const sx = a.hx, sy = a.ey - 5;
        const pu = tw(t, 0, 3);
        glow(this, sx + 0.5, sy + 0.5, 5.5, [255, 236, 200], 0.4 + 0.35 * pu);
        this.pattern(['...Y...', '.y.Y.y.', '..YWY..', 'YYWWWYY', '..YWY..', '.y.Y.y.', '...Y...'], sx - 3, sy - 3, { Y: col(0, 66), y: col(2, 78), W: '#ffffff' }, false);
        // 가로 섬광 (3초마다 잠깐)
        const ph = t % 3;
        if (ph < 0.5) {
          const fl = Math.sin((ph / 0.5) * Math.PI);
          for (let k = 4; k <= 18; k++) {
            const v = fl * (1 - (k - 4) / 15);
            this.px(sx + k, sy, rgba(255, 255, 250, v), false);
            this.px(sx - k, sy, rgba(255, 255, 250, v), false);
          }
        }
        for (const s of [-1, 1]) {
          // 빛 날개: 눈꼬리에서 얼굴 밖 허공으로 휘어 오른다 (긴 갈래 · 짧은 갈래)
          const ox = s < 0 ? a.eyeL - 1 : a.eyeR + a.ew;
          for (const [len, lift, ph2] of [[11, 8, 0], [8, 3.5, 1.3]]) {
            for (let k = 0; k <= len; k++) {
              const u = k / len;
              const x = ox + s * k;
              const y = a.ey - u * lift - Math.sin(u * Math.PI) * 1.5 + Math.sin(t * 3 - k * 0.5 + ph2) * u * 1.2;
              const fade = k > len - 3 ? (len - k + 1) / 4 : 1;
              const cc = flow(k);
              fpx(this, a, x, y, k < 6 ? cc : cc === '#ffffff' ? rgba(255, 255, 255, fade) : col(k, 70, fade), k < 6);
              if (k > 3 && k % 3 === 0) fpx(this, a, x, y + 1, col(k + 2, 80, 0.6 * fade));
            }
          }
          // 눈물선 + 보석
          const tx = s < 0 ? a.eyeL : a.eyeR + a.ew - 1;
          [[0, a.eh], [s, a.eh + 1]].forEach(([dx, dy], i) => fpx(this, a, tx + dx, a.ey + dy, flow(i), true));
          this.pattern(['.G.', 'GWG', '.G.'], tx + s - 1, a.ey + a.eh + 2, { G: '#7fd8ff', W: pu > 0.4 ? '#ffffff' : '#d8f6ff' });
          glow(this, tx + s + 0.5, a.ey + a.eh + 3.5, 2.6, [255, 230, 220], 0.35 * pu);
        }
      },
    },

    // 8. 홀로그램 바이저 — 눈을 가로지르는 반투명 홀로 띠(눈은 비친다)가 무지갯빛으로 흐르고, 위아래로 주사선이 훑는다.
    //    양옆 귀 자리엔 검은 금속 발신기, 바깥엔 홀로 계기판(막대 그래프 · 도는 조준경)이 떠 있다. 가끔 지직 흔들린다
    xholovisor: {
      front(g, a, c, t) {
        const gl = t % 4.2 < 0.12 ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0; // 지직
        const x0 = a.left - 1, x1 = a.right + 1, y0 = a.ey - 1, y1 = a.ey + 2;
        const scan = y0 + Math.floor((t * 4) % 4);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const h = 180 + 70 * Math.sin((x - x0) * 0.35 - t * 2.5) + (y - y0) * 8;
          const isEye = (x >= a.eyeL && x < a.eyeL + a.ew || x >= a.eyeR && x < a.eyeR + a.ew) && y >= a.ey && y < a.ey + a.eh;
          if (isEye) continue;
          const al = y === y0 || y === y1 ? 0.92 : y === scan ? 0.6 : 0.3;
          const l = y === y0 ? 80 : y === y1 ? 52 : 66;
          const c2 = hsl(h, 95, l);
          this.px(x + (y === y0 + 1 ? gl : 0), y, c2.replace('hsl(', 'hsla(').replace(')', `,${al})`), false);
        }
        // 띠 끝 발신기 (검은 금속 + LED)
        const pu = tw(t, 0, 4);
        for (const [x, s] of [[x0 - 1, -1], [x1 + 1, 1]]) {
          this.pattern(['K', 'M', 'M', 'K'], x, y0, { K: '#14141c', M: '#3a3f52' });
          this.px(x, y0 + 1, pu > 0.5 ? '#5affea' : '#ff5ad8');
          glow(this, x + 0.5, y0 + 1.5, 2.6, [90, 255, 234], 0.3 + 0.3 * pu);
        }
        // 왼쪽 계기판: 오르내리는 막대 넷
        const L = x0 - 7, B = a.ey - 3;
        for (let y = B - 4; y <= B + 1; y++) for (let x = L - 1; x <= L + 4; x++) {
          const edge = y === B - 4 || y === B + 1 || x === L - 1 || x === L + 4;
          this.px(x, y, edge ? 'rgba(90,255,234,0.75)' : 'rgba(10,40,60,0.3)', false);
        }
        for (let i = 0; i < 4; i++) {
          const h = 1 + Math.round(2 * tw(t, i * 2, 3 + i));
          for (let j = 0; j < h; j++) this.px(L + i, B - j, j === h - 1 ? '#ffffff' : i % 2 ? 'rgba(255,110,220,0.9)' : 'rgba(90,255,234,0.95)', false);
        }
                // 오른쪽: 도는 조준경
        const rx = x1 + 5, ry = a.ey - 4;
        for (let i = 0; i < 12; i++) {
          const an = (i / 12) * Math.PI * 2 + t * 1.8;
          if (i % 4 === 3) continue;
          this.px(Math.round(rx + Math.cos(an) * 2.6), Math.round(ry + Math.sin(an) * 2.6), rgba(255, 110, 220, 0.85), false);
        }
        this.px(rx, ry, t % 1 < 0.5 ? '#ffffff' : 'rgba(255,110,220,0.9)', false);
        // 데이터 점이 띠 위로 흘러간다
        const dx = Math.floor((t * 7) % (x1 - x0 + 1));
        this.px(x0 + dx, y0, '#ffffff');
      },
    },

    // 9. 신의 가면 — 흰 자기에 금 세공을 두른 윗얼굴 가면(눈구멍으로 눈이 보인다). 이마 위로 금빛 햇살 볏이 솟고,
    //    가운데 셋째 눈 보석이 이따금 떠지며 빛을 뿜는다. 눈 아래 금 눈물 무늬
    xdivinemask: {
      back(g, a, c, t) {
        const pu = tw(t, 0, 1.8);
        glow(this, a.hx + 0.5, a.top - 4, 10, [255, 236, 170], 0.25 + 0.15 * pu);
      },
      front(g, a, c, t) {
        const m = { K: '#3a2408', W: '#fdfbf6', w: '#e4dccd', G: '#ffd84a', g: '#c9921c', e: '#2a1a10' };
        // 햇살 볏: 가운데가 가장 긴 금 창끝 일곱 개가 부채꼴로
        const pu = tw(t, 0, 2);
        for (let i = -3; i <= 3; i++) {
          const an = -Math.PI / 2 + i * 0.32;
          const len = 10 - Math.abs(i) * 1.6 + (i === 0 ? 2 : 0);
          const bx = a.hx + 0.5 + i * 1.3, by = a.ey - 3.5;
          for (let r = 0; r < len; r++) {
            const x = Math.round(bx - 0.5 + Math.cos(an) * r), y = Math.round(by - 0.5 + Math.sin(an) * r);
            this.px(x, y, r >= len - 1 ? (pu > 0.5 ? '#ffffff' : '#fff0a0') : r % 2 ? m.G : '#ffe58a');
            if (r < len - 2) this.px(x + (i < 0 ? -1 : 1) * (i === 0 ? 0 : 1), y, i === 0 ? m.G : m.g);
          }
          this.px(Math.round(bx - 0.5 + Math.cos(an) * len), Math.round(by - 0.5 + Math.sin(an) * len), rgba(255, 250, 200, 0.6 * pu), false);
        }
        // 가면 판: 눈썹 위 세 줄 ~ 눈 아래 한 줄, 눈 둘레는 구멍(짙은 테만)
        const y0 = a.ey - 3, y1 = a.ey + a.eh;
        for (let y = y0; y <= y1; y++) for (let x = a.left - 1; x <= a.right + 1; x++) {
          const dx = x - a.hx, adx = Math.abs(dx);
          const half = y === y0 ? 4 : y === y1 ? 7 : 8;
          if (adx > half) continue;
          const inEye = (ex) => x >= ex && x < ex + a.ew && y >= a.ey && y < a.ey + a.eh;
          if (inEye(a.eyeL) || inEye(a.eyeR)) continue;
          const nearEye = (ex) => x >= ex - 1 && x <= ex + a.ew && y >= a.ey - 1 && y <= a.ey + a.eh;
          if (y === y1 && adx <= 1) continue; // 콧등 자리는 비운다
          let col = adx >= half ? m.K : y === y0 ? m.G : nearEye(a.eyeL) || nearEye(a.eyeR) ? m.g : adx >= half - 1 ? m.w : m.W;
          if (y === y1 && adx < half) col = adx % 2 ? m.G : m.g;
          if (y === a.ey - 1 && (adx === 6 || adx === 7)) col = m.G; // 옆 금 덩굴
          this.px(x, y, col);
        }
        // 셋째 눈 보석: 4초마다 떠서 빛을 뿜는다
        const open = t % 4 < 1.6;
        const jx = a.hx, jy = a.ey - 2;
        if (open) {
          this.pattern(['.KKK.', 'KRWRK', '.KKK.'], jx - 2, jy - 1, { K: m.K, R: '#ff3b5c', W: '#ffffff' });
          glow(this, jx + 0.5, jy + 0.5, 4, [255, 120, 140], 0.5);
          for (const d of [3, 4, 5]) { this.px(jx - d, jy, rgba(255, 180, 190, 0.7 - d * 0.1), false); this.px(jx + d, jy, rgba(255, 180, 190, 0.7 - d * 0.1), false); }
        } else {
          this.pattern(['.KKK.', 'KgggK', '.KKK.'], jx - 2, jy - 1, m);
        }
        // 금 눈물 무늬
        for (const ex of [a.eyeL, a.eyeR + a.ew - 1]) {
          this.px(ex, a.ey + a.eh + 1, m.G);
          this.px(ex, a.ey + a.eh + 2, tw(t, ex, 3) > 0.6 ? '#ffffff' : m.g);
        }
      },
    },

    // 10. 우주 모노클 — 오른눈을 크게 감싼 백금 외알 안경. 렌즈 속엔 은하가 소용돌이치고(눈은 비쳐 보인다), 바깥에 금 톱니 고리가
    //     천천히 돌며, 꼭대기엔 별 장식이 빛난다. 고리 달린 행성이 렌즈 둘레 큰 궤도를 돌고(뒤로 가면 테 뒤에 숨는다),
    //     렌즈를 빛줄기가 스치고, 두 줄 금 사슬 끝의 별 장식이 크게 흔들린다
    xcosmicmonocle: {
      back(g, a, c, t) {
        const cx = a.eyeR + a.ew / 2 + 0.5, cy = a.ey + a.eh / 2;
        glow(this, cx, cy - 1, 10, [170, 120, 255], 0.28 + 0.12 * tw(t, 0, 1.8));
      },
      front(g, a, c, t) {
        const cx = a.eyeR + a.ew / 2 + 0.5, cy = a.ey + a.eh / 2;
        const rl = 3, rr = 4, rg = 5, ro = 5.6;
        const an0 = t * 1.1;
        const orb = (an) => [Math.round(cx - 0.5 + Math.cos(an) * 9), Math.round(cy - 7.5 + Math.sin(an) * 2.2 + Math.cos(an) * 1.5)];
        const planet = (front) => {
          if ((Math.sin(an0) > 0) !== front) return;
          const [px, py] = orb(an0);
          glow(this, px + 0.5, py + 0.5, 3.5, [255, 190, 110], 0.35);
          this.pattern(['.KKK.', 'KOHOK', 'KOOoK', 'KOooK', '.KKK.'], px - 2, py - 2, { K: '#3a1f10', O: '#ffb05a', o: '#d86a1a', H: '#fff0d0' });
          for (const s of [-1, 1]) { this.px(px + s * 3, py, '#ffe0a0'); this.px(px + s * 4, py + (s > 0 ? 1 : -1), 'rgba(255,224,160,0.75)', false); }
          // 행성 꼬리 빛
          for (let k = 1; k <= 4; k++) { const [qx, qy] = orb(an0 - k * 0.12); this.px(qx, qy, rgba(255, 220, 160, 0.5 - k * 0.1), false); }
        };
        planet(false);
        const sweep = (t % 3) / 0.5;
        for (let y = Math.floor(cy - ro); y <= cy + ro; y++)
          for (let x = Math.floor(cx - ro); x <= cx + ro; x++) {
            if (inEyeOrMouth(a, x, y)) continue;
            if (y >= a.ey && y < a.ey + a.eh && x >= a.eyeL - 1 && x <= a.eyeL + a.ew) continue; // 왼눈 둘레는 비운다
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
            const an = Math.atan2(dy, dx);
            if (d < rl) {
              const arm = Math.sin(an * 2 - d * 1.7 + t * 2.4);
              const gl = sweep < 1 && Math.abs(dx - dy - (sweep * 8 - 4)) < 0.9;
              this.px(x, y, gl ? 'rgba(255,255,255,0.9)' : arm > 0.55 ? rgba(255, 200, 250, 0.85) : arm > 0 ? rgba(160, 110, 255, 0.65) : rgba(30, 20, 96, 0.6), false);
            } else if (d < rr) {
              this.px(x, y, dy < -1.2 ? (dx < 0 ? '#ffffff' : '#eef1f8') : dy < 1 ? '#c3cad8' : '#7a8398');
            } else if (d < rg) {
              const tooth = Math.floor(((an + t * 0.9) / (Math.PI * 2)) * 20 + 20) % 2 === 0;
              this.px(x, y, tooth ? (dy < 0 ? '#ffe36a' : '#e0a91c') : '#2a1a40');
            } else if (d < ro) {
              const tooth = Math.floor(((an + t * 0.9) / (Math.PI * 2)) * 20 + 20) % 2 === 0;
              if (tooth && dx > -3.5) this.px(x, y, dy < 0 ? '#ffd84a' : '#a8740e');
            }
          }
        // 꼭대기 별 장식 (테 위로 솟는다)
        const sy = Math.round(cy - ro - 3), sx = Math.round(cx - 0.5);
        const pu = tw(t, 0, 2.6);
        glow(this, sx + 0.5, sy + 0.5, 4, [255, 230, 140], 0.4 + 0.3 * pu);
        this.pattern(['...K...', '..KYK..', 'KKYWYKK', '.KYYyK.', 'KYyKyyK', 'K.....K', '...K...'], sx - 3, sy - 3, { K: '#5a3a06', Y: '#ffe36a', y: '#d19a1c', W: '#ffffff' });
        this.px(sx, sy + 4, '#ffd84a');
        if (pu > 0.8) bigStar(this, sx, sy, 5, rgba(255, 250, 210, 0.75), '#ffffff', false);
        planet(true);
        // 두 줄 금 사슬: 테 오른쪽 아래에서 늘어지고, 끝에 큰 별 장식
        const sw = Math.sin(t * 2.2) * 2;
        const ax = Math.round(cx + 4), ay = Math.round(cy + 3);
        const endY = Math.min(GROUND - 5, a.my + 3);
        let ex = ax, ey = ay;
        for (let i = 1; i <= 7; i++) {
          const u = i / 7;
          ex = Math.round(ax + 1 + u * 3 + sw * u * u);
          ey = Math.round(ay + u * (endY - ay));
          this.px(ex, ey, i % 2 ? '#ffd84a' : '#a8740e');
          this.px(ex + 1, ey, i % 2 ? '#a8740e' : '#fff0a0');
        }
        glow(this, ex + 1, ey + 4, 4, [255, 230, 140], 0.45);
        this.pattern(['...K...', '..KYK..', 'KKYWYKK', '.KYYyK.', 'KYyKyyK', 'KK...KK'], ex - 2, ey + 1, { K: '#6a4208', Y: tw(t, 1, 3) > 0.5 ? '#fff3a0' : '#ffd84a', y: '#e0a91c', W: '#ffffff' });
      },
    },
  };

  // 별무리 궤도: 비스듬한 타원을 도는 별 다섯 (앞 반바퀴는 front, 뒤 반바퀴는 back)
  const R = root.PetSprite.PetRenderer;
  R.prototype._xhaloOrbit = function (a, t, front) {
    for (let i = 0; i < 5; i++) {
      const an = t * 0.9 + (i * Math.PI * 2) / 5;
      const isFront = Math.sin(an) > 0;
      if (isFront !== front) continue;
      const x = Math.round(a.hx + Math.cos(an) * 10), y = Math.round(a.top - 4 + Math.sin(an) * 2 - Math.cos(an) * 2);
      if (front) star(this, x, y, i % 2 ? '#a8d0ff' : '#fff0a0');
      else this.px(x, y, 'rgba(220,230,255,0.65)', false);
      // 꼬리 빛
      const pa = an - 0.25;
      this.px(Math.round(a.hx + Math.cos(pa) * 10), Math.round(a.top - 4 + Math.sin(pa) * 2 - Math.cos(pa) * 2), 'rgba(220,230,255,0.4)', false);
    }
  };

  Object.assign(root.PetSprite.ACCESSORIES, LAB);

  // ================= 2차 (머리 3 · 얼굴 3) =================
  const LAB2 = {
    // 11. 불사조 깃 관 — 금 머리띠(루비) 위로 불꽃 깃털 일곱 장이 부채처럼 솟는다. 깃은 뿌리의 진홍에서 주황 · 금 · 흰 끝으로
    //     타오르며 일렁이고, 길이가 숨 쉬듯 늘었다 줄었다 하며, 불티가 위로 날린다
    xphoenixcrest: {
      back(g, a, c, t) {
        glow(this, a.hx + 0.5, a.top - 7, 12, [255, 130, 50], 0.3 + 0.12 * tw(t, 0, 3));
      },
      front(g, a, c, t) {
        for (const i of [-3, 3, -2, 2, -1, 1, 0]) {
          const ang = i * 0.32 + Math.sin(t * 3 + i) * 0.05;
          const len = 14 - Math.abs(i) * 1.6 + Math.sin(t * 5 + i * 2) * 0.7;
          const bx = a.hx + 0.5 + i * 0.8, by = a.top - 0.5;
          const bend = i * 0.12;
          const P = (u) => [bx + Math.sin(ang + bend * u) * len * u, by - Math.cos(ang + bend * u) * len * u];
          const W = (u) => (u < 0.12 ? 0.7 : 1.55 * Math.pow(Math.sin(Math.PI * Math.min(1, (u - 0.04) / 0.96)), 0.7) + 0.3);
          tube(this, P, W, (x, y, u, side, d) => {
            const f = u + 0.1 * Math.sin(t * 8 + x * 1.3 + y);
            if (f > 0.88) return '#fff6c0';
            if (d < 0.35 && u > 0.15) return f > 0.6 ? '#fff0a0' : '#ffd23a'; // 깃대
            if (f > 0.68) return side > 0 ? '#ffd23a' : '#ffe680';
            if (f > 0.42) return side > 0 ? '#ff8a1f' : '#ffb03a';
            if (f > 0.2) return side > 0 ? '#e8401a' : '#ff6a2a';
            return '#b8180f';
          }, '#4a0c04', 30);
        }
        // 금 머리띠와 루비
        this.pattern(['.KKKKKKKKKKK.', 'KYHYYKRKYYHYK', 'KyyyyKrKyyyyK', '.KKKKKKKKKKK.'], a.hx - 6, a.top - 2, { K: '#3a1404', Y: '#ffd84a', y: '#c9921c', H: '#fff4b0', R: tw(t, 0, 4) > 0.6 ? '#ff8a8a' : '#ff2a3a', r: '#a8142a' });
        // 불티
        for (let i = 0; i < 6; i++) {
          const p = (t * 0.7 + i / 6) % 1;
          const x = a.hx + (hash(i * 7 + Math.floor(t * 0.7 + i / 6)) - 0.5) * 18 + Math.sin(p * 9 + i) * 1.2;
          this.px(Math.round(x), Math.round(a.top - 4 - p * 16), p < 0.4 ? rgba(255, 240, 160, 1 - p) : rgba(255, 110, 40, 1 - p), false);
        }
      },
    },

    // 12. 심연의 흑요석 관 — 이마엔 흑요석 띠관(보랏빛 보석), 머리 둘레로 흑요석 파편 일곱 개가 떠서 천천히 돈다(뒤로 가면 머리 뒤로).
    //     머리 위엔 작은 블랙홀이 떠 있어 보랏빛 강착 원반이 돌고, 빛 알갱이가 소용돌이치며 빨려 들어간다
    xvoidcrown: {
      back(g, a, c, t) {
        glow(this, a.hx + 0.5, a.top - 8, 12, [120, 40, 200], 0.3 + 0.12 * tw(t, 0, 1.6));
        this._xvoid(a, t, false);
      },
      front(g, a, c, t) {
        const m = { K: '#05020a', d: '#1a0f2a', D: '#2e1a48', V: '#c890ff', v: '#7a3ad8' };
        this.pattern(['......K......', '..K..KVK..K..', '.KDK.KvK.KDK.', 'KDdDKDdDKDdDK', 'KvKvKvKvKvKvK', '.KKKKKKKKKKK.'], a.hx - 6, a.top - 4, m);
        this.px(a.hx, a.top - 3, tw(t, 0, 3) > 0.6 ? '#ffffff' : '#c890ff');
        this._xvoid(a, t, true);
        // 블랙홀
        const bx = a.hx + 0.5, by = a.top - 13 + Math.sin(t * 1.5) * 0.6;
        glow(this, bx, by, 6, [190, 110, 255], 0.35);
        const disc = (front) => {
          for (let i = 0; i < 40; i++) {
            const an = (i / 40) * Math.PI * 2;
            if ((Math.sin(an) > 0) !== front) continue;
            const hot = Math.sin(an * 2 - t * 4) > 0.3;
            this.px(Math.round(bx - 0.5 + Math.cos(an) * 6), Math.round(by - 0.5 + Math.sin(an) * 1.6), hot ? '#ffd8ff' : i % 2 ? '#c06aff' : '#8a3ae0');
          }
        };
        disc(false);
        // 검은 핵 + 빛 고리 (핵은 원반보다 위로 솟아 보인다)
        const ox = Math.round(bx - 0.5), oy = Math.round(by - 0.5) - 1;
        this.pattern(['..LLL..', '.LKKKL.', 'LKKKKKL', 'LKKKKKL', 'LKKKKKL', '.LKKKL.', '..LLL..'], ox - 3, oy - 3, { K: '#000000', L: tw(t, 2, 3) > 0.5 ? '#f0d8ff' : '#c890ff' });
        disc(true);
        // 빨려 드는 빛 알갱이
        for (let i = 0; i < 5; i++) {
          const p = (t * 0.5 + i / 5) % 1;
          const r = 8 * (1 - p), an = p * 7 + i * 1.3;
          this.px(Math.round(bx - 0.5 + Math.cos(an) * r), Math.round(by - 0.5 + Math.sin(an) * r * 0.5), rgba(230, 200, 255, 0.4 + 0.6 * p), false);
        }
      },
    },

    // 13. 서리 결정관 — 얼음 띠 위로 들쭉날쭉한 얼음 결정 일곱 개가 솟는다(가운데가 가장 높다). 결정을 따라 무지갯빛 굴절이
    //     하나씩 타고 오르고, 끝이 반짝이며, 머리 둘레로 눈송이가 흩날리고 띠에서 서릿김이 피어난다
    xfrostcrown: {
      back(g, a, c, t) {
        glow(this, a.hx + 0.5, a.top - 6, 12, [150, 220, 255], 0.28 + 0.1 * tw(t, 0, 1.8));
      },
      front(g, a, c, t) {
        const spikes = [[-6, 5], [-3, 8], [0, 12], [3, 8], [6, 5]];
        const cells = new Map();
        const base = a.top - 2;
        spikes.forEach(([dx, h]) => {
          const cx = a.hx + dx;
          for (let y = base - h + 1; y <= base; y++) {
            const k = (y - (base - h + 1)) / h;
            const half = Math.round(k * (h > 8 ? 1.5 : 1.1));
            for (let x = cx - half; x <= cx + half; x++) cells.set(x + ',' + y, [x, y, x < cx ? '#f2fdff' : x === cx ? '#c8f0ff' : '#7fc8ee']);
          }
        });
        for (let x = a.hx - 7; x <= a.hx + 7; x++) {
          cells.set(x + ',' + (base + 1), [x, base + 1, x % 3 === 0 ? '#5aa0ff' : '#d8f6ff']);
          cells.set(x + ',' + (base + 2), [x, base + 2, '#8fd0f0']);
        }
        for (const [x, y] of cells.values())
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
            if (!cells.has(x + ox + ',' + (y + oy))) this.px(x + ox, y + oy, '#1e3a6a');
        for (const [x, y, col] of cells.values()) this.px(x, y, col);
        // 무지갯빛 굴절: 결정 하나씩 차례로 타고 오른다
        const si = Math.floor(t * 1.2) % spikes.length, q = (t * 1.2) % 1;
        const [sdx, sh] = spikes[si];
        const gy = Math.round(base - q * (sh - 1));
        this.px(a.hx + sdx, gy, hsl(t * 300, 90, 75));
        if (gy + 1 <= base) this.px(a.hx + sdx, gy + 1, hsl(t * 300 + 60, 90, 80));
        // 끝 반짝
        spikes.forEach(([dx, h], i) => { if (tw(t, i * 2, 3) > 0.9) star(this, a.hx + dx, base - h, '#e8fbff'); });
        // 눈송이
        for (let i = 0; i < 6; i++) {
          const p = (t * 0.25 + i / 6) % 1;
          const x = a.hx + (hash(i * 5 + Math.floor(t * 0.25 + i / 6)) - 0.5) * 26 + Math.sin(p * 8 + i) * 1.5;
          const y = a.top - 16 + p * 22;
          if (i % 2) this.pattern(['W.W', '.W.', 'W.W'], Math.round(x) - 1, Math.round(y) - 1, { W: rgba(240, 250, 255, 0.85 * (1 - p * 0.6)) }, false);
          else this.px(Math.round(x), Math.round(y), rgba(255, 255, 255, 0.9 * (1 - p * 0.5)), false);
        }
        // 서릿김
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.6 + i / 3) % 1;
          this.px(Math.round(a.hx + (i - 1) * 6 + Math.sin(p * 6) * 1), Math.round(base - p * 4), rgba(230, 248, 255, 0.6 * (1 - p)), false);
        }
      },
    },

    // 14. 혼불 안광 — 두 눈에 푸른 혼불이 깃들어 눈 둘레가 빛나고, 눈꼬리에서 굵고 긴 혼불 꼬리가 바깥 위로 휘날린다
    //     (흰 심 → 하늘 → 파랑 → 보라, 색이 천천히 돈다). 도깨비불 셋이 꼬리를 끌며 몸 둘레를 비스듬히 돌고(soulOrbs),
    //     불티가 흩어진다 (눈 칸은 그대로)
    xsoulflare: {
      back(g, a, c, t) {
        glow(this, a.hx + 0.5, a.ey + 0.5, 12, [80, 170, 255], 0.22 + 0.08 * tw(t, 0, 3));
        soulOrbs(this, a, t, false);
      },
      front(g, a, c, t) {
        const open = eyesOpen(g);
        const hs = 20 * Math.sin(t * 1.2) - 10;
        for (const s of [-1, 1]) {
          const ex = s < 0 ? a.eyeL : a.eyeR;
          glow(this, ex + a.ew / 2, a.ey + a.eh / 2, 3, [110, 235, 255], open ? 0.3 + 0.12 * tw(t, s, 4) : 0.12);
          if (open) this.px(ex + (s < 0 ? 0 : a.ew - 1), a.ey, '#e8ffff');
          const ox = s < 0 ? a.eyeL - 1 : a.eyeR + a.ew;
          // 불꽃 꼬리: 심 한 줄 + 아래 · 위 겹
          for (let k = 0; k < 16; k++) {
            const x = ox + s * k;
            const y = a.ey - Math.round(k * 0.62 + Math.sin(t * 7 - k * 0.7) * (k / 7));
            const hue = 188 + k * 5 + hs;
            const al = k > 11 ? (16 - k) / 5 : 1;
            const core = k < 2 ? '#ffffff' : k < 5 ? hsl(hue, 100, 88) : hsla(hue, 100, 78 - k * 0.6, al);
            fpx(this, a, x, y, core, k < 8);
            if (k >= 1 && k < 13) fpx(this, a, x, y + 1, hsla(hue + 20, 100, 66, 0.75 * al));
            if (k >= 2 && k < 10) fpx(this, a, x, y - 1, hsla(hue - 10, 100, 80, 0.6 * al));
            if (k >= 5 && k < 9) fpx(this, a, x, y + 2, hsla(hue + 40, 100, 60, 0.35 * al));
          }
          // 흩어지는 불티
          for (let i = 0; i < 5; i++) {
            const p = (t * 1.3 + i / 5) % 1;
            const x = ox + s * (3 + p * 13), y = a.ey - 2 - p * 9 + Math.sin(p * 9 + i) * 1.3;
            this.px(Math.round(x), Math.round(y), p < 0.5 ? rgba(190, 250, 255, 1 - p) : hsla(270, 100, 75, 1 - p), false);
          }
        }
        soulOrbs(this, a, t, true);
      },
    },

    // 15. 프리즘 광대 보석 — 양 볼 바깥에 금 받침으로 박힌 큼직한 다이아몬드. 위에서 흰 빛줄기가 보석에 꽂히면
    //     바깥 아래로 무지개 부채(빨주노초파보)가 펼쳐져 길어졌다 짧아지고, 보석 속 면이 무지갯빛으로 돌며,
    //     작은 결정 조각이 보석 둘레를 돌고 별 반짝이가 튄다
    xprismcheeks: {
      back(g, a, c, t) {
        for (const s of [-1, 1]) {
          const gx = s < 0 ? a.left - 1 : a.right + 1, gy = a.ey + 2;
          // 무지개 부채 (머리 뒤로 깔린다)
          const SPEC = [[255, 70, 70], [255, 160, 50], [255, 230, 70], [80, 230, 120], [70, 160, 255], [170, 100, 255]];
          const pu = tw(t, s, 1.8);
          SPEC.forEach(([r, gg, b], i) => {
            const an = (s < 0 ? Math.PI : 0) + s * (-0.15 + i * 0.16);
            const len = 9 + Math.round(4 * pu) + (i % 2);
            for (let k = 3; k <= len; k++) {
              const fl = 0.85 + 0.15 * Math.sin(t * 6 - k * 0.7 + i);
              const al = (1 - (k - 3) / (len - 2)) * fl;
              this.px(Math.round(gx + Math.cos(an) * k), Math.round(gy + Math.sin(an) * k), rgba(r, gg, b, al), false);
            }
          });
          // 위에서 꽂히는 흰 빛줄기
          for (let k = 3; k <= 9; k++) this.px(Math.round(gx + s * k * 0.45), gy - k, rgba(255, 255, 255, 0.75 - k * 0.06), false);
        }
      },
      front(g, a, c, t) {
        for (const s of [-1, 1]) {
          const gx = s < 0 ? a.left - 1 : a.right + 1, gy = a.ey + 2;
          const h = t * 100 + s * 70;
          glow(this, gx + 0.5, gy + 0.5, 5, [220, 240, 255], 0.35 + 0.2 * tw(t, s * 2, 3));
          // 큰 다이아몬드: 윗면(테이블) · 옆 면 · 아래 뾰족
          const G = ['..KKKKK..', '.KWWAWwK.', 'KWWAAawbK', 'KKKKKKKKK', '.KWAabcK.', '..KAbcK..', '...KcK...', '....K....'];
          this.pattern(s < 0 ? G : mirror(G), gx - 4, gy - 3, {
            K: '#14244a', W: '#ffffff', w: '#d8f4ff', A: hsl(h, 95, 82), a: hsl(h + 60, 95, 70), b: hsl(h + 140, 90, 64), c: hsl(h + 220, 85, 52),
          });
          // 반짝: 보석 위 별
          if (tw(t, s * 5, 3.2) > 0.75) bigStar(this, gx + s * 2, gy - 3, 3, rgba(255, 255, 255, 0.85), '#ffffff', false);
          // 둘레를 도는 작은 결정 조각 둘
          for (let i = 0; i < 2; i++) {
            const an = t * 1.8 * s + i * Math.PI;
            const x = Math.round(gx + Math.cos(an) * 6), y = Math.round(gy + Math.sin(an) * 3);
            if (isFace(a, x - a.hx, y) || inEyeOrMouth(a, x, y)) continue;
            this.pattern(['.K.', 'KCK', '.K.'], x - 1, y - 1, { K: '#14244a', C: hsl(h + i * 180, 90, 75) });
          }
        }
      },
    },

    // 16. 혜성 수염 — 대혜성: 볼 양쪽 수염 세 가닥이 화면 끝까지 길게 뻗어 바깥 위로 휜다. 뿌리는 큰 흰 별,
    //     흰 → 금 → 살구 → 하늘 → 보라로 흐려지며(tailCol) 빛 물결이 바깥으로 달린다. 수염마다 혜성 머리 둘이
    //     쏜살같이 달려 나가고, 별가루가 흩날려 떨어진다. 볼 양옆으로 푸른 빛이 번진다
    xcometwhiskers: {
      back(g, a, c, t) {
        for (const s of [-1, 1]) glowE(this, (s < 0 ? a.left : a.right + 1) + s * 9, a.my - 1, 12, 4.5, [140, 210, 255], 0.22 + 0.08 * tw(t, s, 2));
      },
      front(g, a, c, t) {
        for (const s of [-1, 1]) {
          const x0 = s < 0 ? a.left + 2 : a.right - 2;
          const n = s < 0 ? Math.min(20, x0 - 1) : Math.min(20, 46 - x0); // 화면 끝까지
          for (let w = 0; w < 3; w++) {
            const y0 = a.my + w - 1, slope = (w - 1) * 0.3;
            const pts = [];
            for (let k = 0; k <= n; k++) pts.push([x0 + s * k, Math.round(y0 + k * slope - (k / n) ** 2 * 3 + Math.sin(t * 3 - k * 0.42 + w) * (k / 11))]);
            pts.forEach(([x, y], k) => {
              const u = k / n;
              const wave = ((k - t * 14 + w * 5) % 11 + 11) % 11 < 1.4;
              const al = u > 0.7 ? (1 - u) / 0.3 : 1;
              fpx(this, a, x, y, k < 3 ? '#ffffff' : wave ? rgba(255, 255, 255, al) : tailCol(u, al), k < 8);
              if (k > 4 && k < n - 3 && k % 2 === 0) this.px(x, y + (w === 2 ? 1 : -1), tailCol(u, 0.3 * al), false);
            });
            // 혜성 머리 둘이 수염을 따라 바깥으로
            for (let hd = 0; hd < 2; hd++) {
              const p = (t * 0.75 + w / 3 + hd * 0.5 + (s > 0 ? 0.25 : 0)) % 1;
              const k = Math.floor(p * (n + 1));
              if (k < 2 || k >= pts.length) continue;
              const [hx, hy] = pts[k];
              glow(this, hx + 0.5, hy + 0.5, 3, [255, 245, 200], 0.75 * (1 - p * 0.7));
              star(this, hx, hy, rgba(255, 245, 190, 1 - p * 0.5));
              for (let q = 1; q <= 3; q++) if (k - q * 2 > 0) this.px(pts[k - q * 2][0], pts[k - q * 2][1] - 1, rgba(255, 240, 180, 0.6 * (1 - q / 4)), false);
            }
          }
          // 흩날려 떨어지는 별가루
          for (let i = 0; i < 6; i++) {
            const p = (t * 0.6 + i / 6) % 1;
            const k = 4 + Math.floor(hash(i * 7 + (s > 0 ? 50 : 0) + Math.floor(t * 0.6 + i / 6)) * (n - 4));
            const x = x0 + s * k + Math.sin(p * 6 + i) * 0.8, y = a.my + p * 6;
            if (i % 3 === 0 && p < 0.5) star(this, Math.round(x), Math.round(y), tailCol(k / n, 1 - p, 30));
            else this.px(x, y, tailCol(k / n, 1 - p, 30), false);
          }
          // 볼의 별 뿌리
          const pu = tw(t, s, 3);
          glow(this, x0 + 0.5, a.my + 0.5, 3.5, [255, 250, 210], 0.5 + 0.3 * pu);
          bigStar(this, x0, a.my, pu > 0.5 ? 3 : 2, '#fff3a0', '#ffffff', true);
        }
      },
    },
  };
  root.PetSprite.PetRenderer.prototype._xvoid = function (a, t, front) {
    // 흑요석 파편 일곱 개: 머리 둘레 타원 궤도, 앞쪽은 크고 밝게 · 뒤쪽은 작고 어둡게
    for (let i = 0; i < 7; i++) {
      const an = t * 0.6 + (i * Math.PI * 2) / 7;
      const isFront = Math.sin(an) > 0;
      if (isFront !== front) continue;
      const x = Math.round(a.hx + Math.cos(an) * 11), y = Math.round(a.top - 3 + Math.sin(an) * 2.5 + Math.sin(t * 2 + i) * 0.8);
      if (front) {
        glow(this, x + 0.5, y + 0.5, 3, [180, 90, 255], 0.35);
        this.pattern(['..K..', '.KVK.', '.KVvK', 'KVvdK', 'KvddK', '.KdK.', '..K..'], x - 2, y - 4, { K: '#05020a', V: '#d8a8ff', v: '#7a3ad8', d: '#1a0f2a' });
      } else {
        this.pattern(['.K.', 'KvK', 'KdK', '.K.'], x - 1, y - 2, { K: 'rgba(5,2,10,0.8)', v: 'rgba(122,58,216,0.8)', d: 'rgba(26,15,42,0.8)' }, false);
      }
    }
  };
  Object.assign(root.PetSprite.ACCESSORIES, LAB2);

  const LAB_ITEMS = [
    ['xcelestialcrown', 'head', '천상의 왕관'],
    ['xnebulahorns', 'head', '성운 뿔'],
    ['xstarhalo', 'head', '별무리 후광관'],
    ['xdragonhelm', 'head', '용왕의 투구 장식'],
    ['xdivinelaurel', 'head', '신의 월계관'],
    ['xstargoggles', 'face', '별빛 눈동자 고글'],
    ['xstarsigil', 'face', '성흔 문양'],
    ['xholovisor', 'face', '홀로그램 바이저'],
    ['xdivinemask', 'face', '신의 가면'],
    ['xcosmicmonocle', 'face', '우주 모노클'],
    ['xphoenixcrest', 'head', '불사조 깃 관'],
    ['xvoidcrown', 'head', '심연의 흑요석 관'],
    ['xfrostcrown', 'head', '서리 결정관'],
    ['xsoulflare', 'face', '혼불 안광'],
    ['xprismcheeks', 'face', '프리즘 광대 보석'],
    ['xcometwhiskers', 'face', '혜성 수염'],
  ];
  const LAB_COMBOS = [['기준선: crown · aureole', 'crown,aureole'], ['기준선: unicorn', 'unicorn']];
})(window);

// ---------- neckback ----------
// 별 상점 끝판왕 시안 — 몸(neck) 5 + 등(back) 5
(function (root) {
  const { GROUND, hash, mirror, wear, star } = root.PetSprite.costumeKit;
  const tw = (t, i, sp = 2) => 0.5 + 0.5 * Math.sin(t * sp + i * 1.7); // 반짝 세기 0~1
  const h2 = (x, y) => hash(x * 31.7 + y * 17.3);
  const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hsl = (h, s, l, al) => (al == null ? `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(cl(l, 0, 100))}%)` : `hsla(${Math.round(h)},${Math.round(s)}%,${Math.round(cl(l, 0, 100))}%,${cl(al, 0, 1).toFixed(2)})`);
  const rgba = (r, g, b, al) => `rgba(${r | 0},${g | 0},${b | 0},${cl(al, 0, 1).toFixed(2)})`;

  // 영역 칠하기 (반투명 아님, 그러나 머리 위 표시 높이(top)는 안 건드린다) + 외곽선
  function area(r, inside, box, fill, outline) {
    const [x0, y0, x1, y1] = box.map(Math.round);
    for (let y = y0 - 1; y <= y1 + 1; y++)
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        if (inside(x, y)) {
          const col = fill(x, y);
          if (col) r.px(x, y, col, false);
        } else if (outline && (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1))) r.px(x, y, outline, false);
      }
  }
  // 굵기가 변하는 관. fill(L, x, y), L = { u, side, d }
  function tube(r, pts, rad, fill, outline) {
    const seg = [];
    let tot = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const L = Math.hypot(x1 - x0, y1 - y0) || 1e-6;
      seg.push({ x0, y0, dx: (x1 - x0) / L, dy: (y1 - y0) / L, L, s0: tot });
      tot += L;
    }
    const R = typeof rad === 'function' ? rad : () => rad;
    let maxR = 0;
    for (let k = 0; k <= 20; k++) maxR = Math.max(maxR, R(k / 20));
    let last = null;
    const inside = (x, y) => {
      const px = x + 0.5, py = y + 0.5;
      let best = null;
      for (const s of seg) {
        const u = Math.max(0, Math.min(s.L, (px - s.x0) * s.dx + (py - s.y0) * s.dy));
        const qx = s.x0 + s.dx * u, qy = s.y0 + s.dy * u;
        const uu = (s.s0 + u) / tot;
        const m = Math.hypot(px - qx, py - qy) - R(uu);
        if (!best || m < best.m) best = { m, u: uu, d: s.s0 + u, side: (px - qx) * -s.dy + (py - qy) * s.dx };
      }
      last = best;
      return best.m <= 0;
    };
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    area(r, inside, [Math.min(...xs) - maxR, Math.min(...ys) - maxR, Math.max(...xs) + maxR, Math.max(...ys) + maxR], (x, y) => { inside(x, y); return fill(last, x, y); }, outline);
  }
  function line(r, x0, y0, x1, y1, col, solid = false) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.5));
    for (let k = 0; k <= n; k++) r.px(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, typeof col === 'function' ? col(k / n) : col, solid);
  }
  // 성운 색: 보라 ~ 분홍 ~ 남색이 흘러간다
  const nebN = (x, y, t) => Math.sin(x * 0.42 + y * 0.21 - t * 1.3) + Math.sin(x * 0.16 - y * 0.36 + t * 0.85);
  const neb = (x, y, t, dl = 0) => { const n = nebN(x, y, t); return hsl(262 + n * 34, 78, 38 + n * 9 + dl); };
  // 얼굴(눈·코·입) 근처인가 — 빛줄기가 여길 지나가면 건너뛴다
  const nearFace = (a, x, y) => Math.abs(x - a.hx) <= a.hw + 1 && y >= a.earTop && y <= a.my + 1;

  const LAB = {
    // ======================= 몸 =======================

    // 백금 성갑 (2차 다듬음): 견장을 어깨 위에 얹었다 — 둥근 돔이 몸 외곽선을 덮고 금테 두 겹이 아래로 겹친다.
    // 견장 위엔 연기 대신 단단한 백금 날개깃이 돋았다
    xplatpauldron: {
      front(g, a, c, t) {
        const W = '#ffffff', P = '#dfe6f2', p = '#a3afc4', d = '#6c7890', Y = '#ffd65a', y = '#c08a24', B = '#2f6bff', b = '#a8d0ff';
        const sw = (t % 3.2) / 0.8;
        const xs = a.left - 6 + sw * 26;
        const lit = (x, yy) => sw < 1 && Math.abs(x - xs - (yy - a.my) * 0.8) < 0.9;
        const gemOn = tw(t, 0, 3.5) > 0.6;
        wear(this, g, a, (dx, dy, x, yy, leg) => {
          const adx = Math.abs(dx);
          if (lit(x, yy)) return W;
          if (leg) return d;
          if (a.curled) return adx >= 5 ? p : P;
          if (dy <= -2) return adx >= 6 ? y : Y;
          if (adx === 0) return gemOn ? b : B;
          if (adx === 1) return Y;
          if (adx >= 5) return p;
          return dy === -1 ? W : P;
        });
        if (a.curled) return;
        this.pattern(['.Y.', 'YBY', '.Y.'], a.hx - 1, a.my + 2, { Y, B: gemOn ? '#ffffff' : B });
        const put = (x, yy, col) => { x = Math.round(x); yy = Math.round(yy); this.px(x, yy, col); this.px(2 * a.hx - x, yy, col); };
        // 견장 위 백금 날개깃 (작은 깃 셋이 위·바깥으로, 끝은 금)
        const bx = a.left - 2, by = a.my - 1;
        const cells = [];
        [[0.56, 5], [0.68, 6.5], [0.8, 5.5]].forEach(([th0, L], f) => {
          const th = Math.PI * th0 + Math.sin(t * 2.2 - f * 0.5) * 0.04;
          for (let k = 0.5; k <= L; k += 0.5) cells.push([bx + Math.cos(th) * k, by - Math.sin(th) * k, k > L - 1.2 ? (tw(t, f, 3) > 0.6 ? '#fff4b8' : Y) : f === 1 ? W : '#e6ecf8']);
        });
        for (const [x, yy] of cells) for (const [ex, ey] of [[-1, 0], [1, 0], [0, -1]]) put(x + ex, yy + ey, '#6f7aa8');
        for (const [x, yy, col] of cells) put(x, yy, col);
        // 견장: 몸 외곽선 위에 얹힌 둥근 돔 + 금테 + 판 한 겹 (오른쪽은 거울)
        const PL = [
          '..KKK..',
          '.KWWPK.',
          'KWPBPpp',
          'KYYYYYY',
          'KPPPPpp',
          '.KK....',
        ];
        const m = { K: c.K, W, P, p, Y, B: gemOn ? '#ffffff' : B };
        this.pattern(PL, a.left - 4, a.my - 1, m);
        this.pattern(mirror(PL), a.right - 2, a.my - 1, m);
        // 견장 위를 지나는 빛
        if (sw < 1) for (let yy = a.my - 1; yy <= a.my + 3; yy++) {
          const x = Math.round(xs + (yy - a.my) * 0.8);
          if (x < a.left - 3 || x > a.right + 3 || (x > a.left + 2 && x < a.right - 2)) continue;
          this.px(x, yy, 'rgba(255,255,255,0.85)', false);
        }
        const ga = 0.15 + 0.4 * tw(t, 0, 3.5);
        for (const gx of [a.left - 1, a.right + 1]) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.px(gx + ox, a.my + 1 + oy, rgba(120, 180, 255, ga), false);
      },
    },

    // 성운 목도리 (3차 디벨롭): 턱 아래를 한 바퀴 두르고 양옆은 볼 옆까지 도톰하게 말려 올라간다 (머리보다 두 칸씩 넓게).
    // 윗면 빛 → 아랫면 그늘 + 비스듬한 꼬임 줄로 두툼한 천, 성운 색이 천천히 흐르고 별이 박혀 깜빡, 빛 한 줄기가 목도리를 따라 훑는다.
    // 왼쪽 매듭에서 긴 자락·짧은 자락이 바닥까지 늘어져 살랑이고, 끝엔 금 술과 별가루
    xnebulastole: {
      front(g, a, c, t) {
        const O = '#1a0b33';
        const cu = a.curled;
        const yC = cu ? a.my + 1 : a.my + 2;
        const W = a.hw + 2;
        const hue = 278 + 22 * Math.sin(t * 0.6);
        const HI = hsl(hue + 35, 95, 80), LT = hsl(hue + 10, 85, 62), MD = hsl(hue - 8, 72, 44), DK = hsl(hue - 25, 72, 27);
        const top = (adx) => (adx <= 3 ? yC : adx === 4 ? yC - 1 : adx <= 6 ? yC - 2 : adx === 7 ? yC - 3 : yC - 2);
        const bot = yC + 1;
        const inside = (x, y) => { const adx = Math.abs(x - a.hx); return adx <= W && y >= top(adx) && y <= bot; };
        const sweep = a.hx - W - 4 + ((t * 9) % (2 * W + 12));
        if (!cu) for (let x = a.hx - 6; x <= a.hx + 6; x++) this.px(x, bot + 1, 'rgba(20,8,40,0.38)', false);
        for (let y = yC - 4; y <= bot + 1; y++)
          for (let x = a.hx - W - 1; x <= a.hx + W + 1; x++) {
            const adx = Math.abs(x - a.hx);
            if (inside(x, y)) {
              const v = (y - top(adx)) / Math.max(1, bot - top(adx));
              let col = v < 0.2 ? HI : v < 0.55 ? LT : v < 0.85 ? MD : DK;
              if ((x + y * 2 + 80) % 4 === 0 && v > 0.1) col = DK; // 꼬임 줄
              if (h2(x, y) > 0.86 && tw(t, x * 5 + y, 3.2) > 0.5) col = '#ffffff';
              if (Math.abs(x - sweep - (y - yC) * 0.5) < 0.8) col = '#fff0ff';
              this.px(x, y, col);
            } else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) {
              if (y <= a.my + 1 && adx <= 4) continue; // 입은 안 가린다
              this.px(x, y, O);
            }
          }
        if (cu) return;
        // 늘어진 두 자락 (왼쪽): [윗자리 x, 길이, 바깥으로 기우는 정도, 박자, 너비]
        const ENDS = [[a.hx - 8, 4, -0.5, 1.1, 2], [a.hx - 5, 5, 0, 0, 3]];
        for (const [ex, len, lean, ph, w] of ENDS) {
          let lx = ex;
          for (let i = 0; i < len; i++) {
            const y = yC + 1 + i;
            const x = Math.round(ex + lean * i + Math.sin(t * 2.2 + ph) * 0.9 * (i / len));
            lx = x;
            this.px(x - 1, y, O); this.px(x + w, y, O);
            for (let k = 0; k < w; k++) this.px(x + k, y, (x + k + y * 2 + 80) % 4 === 0 ? DK : k === 0 ? LT : k === w - 1 ? DK : MD);
          }
          // 금 술 + 별가루
          const fy = yC + 1 + len;
          for (let k = 0; k < w; k++) this.px(lx + k, fy, (k + Math.floor(t * 4)) % 2 ? '#ffd65a' : '#fff6c8');
          for (let k = -1; k <= w; k++) if ((k + 40) % 2) this.px(lx + k, fy + 1, 'rgba(255,214,90,0.7)', false);
          const q = (t * 0.6 + ph) % 1;
          this.px(lx + Math.sin(q * 6 + ph) * 2, fy + 1 - q * 6, hsl(hue + 40, 95, 82, 1 - q), false);
        }
        // 매듭: 도톰한 동그라미 + 빛
        this.pattern(['.KKK.', 'KHLMK', 'KLMDK', '.KKK.'], a.hx - 7, yC - 1, { K: O, H: HI, L: LT, M: MD, D: DK });
      },
    },

    // 천상의 프리즘 목걸이: 남보라 벨벳 위로 금·진주 사슬, 가운데 무지개빛이 도는 다이아 펜던트. 옆으로 긴 빛줄기가 숨 쉬듯 번지고, 작은 보석 셋이 펜던트 둘레를 돈다. 바닥엔 무지개 빛 조각
    xdivinependant: {
      // 몸 뒤로 펜던트에서 퍼지는 후광 빛살 (천천히 돈다)
      back(g, a, c, t) {
        const gx = a.hx + 0.5, gy = a.curled ? GROUND - 0.5 : a.my + 4.5;
        const pu = 0.6 + 0.4 * Math.sin(t * 2.6);
        for (let i = 0; i < 14; i++) {
          const an = Math.PI * (i / 13) + Math.sin(t * 0.5) * 0.12;
          const L = i % 2 ? 15 : 20;
          for (let r = 6; r < L; r += 0.6) {
            const al = 0.42 * pu * (1 - (r - 6) / (L - 6));
            this.px(gx - 0.5 + Math.cos(an) * r, gy - 0.5 - Math.sin(an) * r, i % 2 ? rgba(255, 236, 170, al) : hsl((t * 70 + i * 26) % 360, 90, 80, al), false);
          }
        }
      },
      front(g, a, c, t) {
        const V = '#2b2470', v = '#1b164e', Y = '#ffd65a';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return v;
          if (a.curled) return adx >= 5 ? v : V;
          if (dy <= -2) return adx >= 6 ? '#e0b040' : '#fff3c8'; // 금실 깃
          return adx >= 5 ? v : V;
        });
        const hue = (t * 70) % 360;
        const gx = a.hx, gy = a.curled ? GROUND - 1 : a.my + 4;
        // 넓은 보석 깃목걸이 (몸 밖으로 퍼진다): 금 줄 · 보석 줄 · 진주 술
        if (!a.curled) {
          const glint = Math.floor(t * 10) % 26 - 4;
          const W = a.hw + 3;
          for (let dx = -W; dx <= W; dx++) {
            const y = a.my + 1 + Math.round(2 * (1 - (dx / W) ** 2));
            const i = dx + W;
            const gl = Math.abs(i - glint) < 1;
            const edge = Math.abs(dx) === W;
            this.px(a.hx + dx, y - 1, edge ? c.K : gl ? '#ffffff' : Y);
            this.px(a.hx + dx, y, edge ? c.K : (dx + 40) % 2 ? hsl(hue + dx * 28, 90, 60) : '#fff8ec');
            this.px(a.hx + dx, y + 1, edge || (dx + 40) % 2 ? c.K : gl ? '#ffffff' : '#e0b040');
          }
        }
        // 빛줄기 (옆으로 길게) — 펜던트 뒤에 먼저
        const pu = 0.55 + 0.45 * Math.sin(t * 2.6);
        for (let d = 1; d <= 17; d++) {
          const al = 0.85 * pu * Math.pow(1 - d / 18, 1.4);
          for (const s of [-1, 1]) {
            this.px(gx + s * d, gy, rgba(255, 250, 230, al), false);
            if (d < 7) { this.px(gx + s * d, gy - 1, rgba(255, 240, 200, al * 0.35), false); this.px(gx + s * d, gy + 1, rgba(255, 240, 200, al * 0.35), false); }
          }
        }
        for (let d = 1; d <= 3; d++) this.px(gx, gy + 2 + d, rgba(255, 250, 230, 0.6 * pu * (1 - d / 4)), false);
        // 펜던트: 무지개빛 다이아
        const C = hsl(hue, 95, 68), cc = hsl(hue + 50, 95, 48), W = '#ffffff';
        this.pattern(['..KYK..', '.KCWCK.', 'KCcWcCK', '.KcCcK.', '..KcK..', '...K...'], gx - 3, gy - 2, { K: c.K, Y, C, c: cc, W });
        if (tw(t, 1, 3) > 0.85) this.pattern(['.W.', 'W.W', '.W.'], gx - 1, gy - 1, { W: 'rgba(255,255,255,0.9)' }, false);
        // 둘레를 도는 보석 셋
        for (let i = 0; i < 3; i++) {
          const an = t * 1.6 + (i * Math.PI * 2) / 3;
          const x = gx + Math.cos(an) * 10, y = gy - 0.5 + Math.sin(an) * 2.2;
          const col = hsl(hue + i * 120, 95, Math.sin(an) > 0 ? 72 : 52);
          if (Math.sin(an) < 0 && nearFace(a, Math.round(x), Math.round(y))) continue;
          this.px(x, y, col, false);
          if (Math.sin(an) > 0.3) { this.px(x - 1, y, hsl(hue + i * 120, 95, 72, 0.45), false); this.px(x + 1, y, hsl(hue + i * 120, 95, 72, 0.45), false); }
        }
        // 바닥 무지개 조각
        if (!a.curled) for (let i = 0; i < 7; i++) for (const s of [-1, 1]) this.px(gx + s * (4 + i), GROUND + 2, hsl(i * 48 + hue * 0.3, 90, 65, 0.55 * pu), false);
      },
    },

    // 흑요룡 흉갑: 흑요석 비늘 사이로 용암 금이 맥동하고, 가슴엔 용의 심장. 양어깨엔 뿔 달린 용 두개골 견장 — 눈이 이글거리고 가끔 불을 뿜는다. 불티가 피어오른다
    xobsidiandrake: {
      back(g, a, c, t) {
        if (a.curled) return;
        const pu = 0.5 + 0.5 * Math.sin(t * 3);
        for (const s of [-1, 1]) {
          const cx = s < 0 ? a.left - 4 : a.right + 4, cy = a.my - 1;
          for (let y = cy - 6; y <= cy + 5; y++)
            for (let x = cx - 7; x <= cx + 7; x++) {
              const d = Math.hypot((x - cx) / 7, (y - cy) / 5.5);
              if (d < 1) this.px(x, y, rgba(255, 90, 30, (0.1 + 0.18 * pu) * (1 - d)), false);
            }
        }
      },
      front(g, a, c, t) {
        const S = '#3b3346', s = '#221d29', hl = '#6c5f80';
        const lava = (x, y) => { const p = 0.5 + 0.5 * Math.sin(t * 3.2 - (x + y) * 0.7); return `rgb(255,${Math.round(70 + 160 * p)},${Math.round(20 + 70 * p)})`; };
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#16121b';
          if ((x * 2 + y * 3 + 60) % 7 === 0 || (adx === 3 && dy >= -1 && !a.curled)) return lava(x, y);
          const u = (x + (y % 2) + 40) % 3;
          return u === 0 ? hl : u === 1 ? S : s;
        });
        const hy = a.curled ? GROUND - 1 : a.my + 3;
        const pu = tw(t, 0, 4);
        this.pattern(['.K.', 'KOK', '.K.'], a.hx - 1, hy - 1, { K: '#16121b', O: pu > 0.6 ? '#fff0b0' : '#ff8a2a' });
        for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) this.px(a.hx + ox, hy + oy, rgba(255, 140, 40, 0.25 + 0.45 * pu), false);
        if (a.curled) return;
        // 용 두개골 견장 (왼쪽은 왼쪽을 본다)
        const eye = tw(t, 1, 5) > 0.5 ? '#ffe070' : '#ff4a1a';
        const DL = [
          '........KK',
          '.......KHK',
          '......KHhK',
          '...KKKHhK.',
          '..KhhhhSK.',
          '.KhSSEESSK',
          'KSSSSKSSSK',
          'KTKTKTSSsK',
          '.K.K.KSSsK',
          '.KTKTKsSK.',
          '..KKKKKK..',
        ];
        const m = { K: '#120e16', H: '#efe4c8', h: '#8a7aa0', S: '#4a4058', s: '#2c2535', E: eye, T: '#f0e8d8' };
        const y0 = a.my - 6;
        this.pattern(DL, a.left - 9, y0, m);
        this.pattern(mirror(DL), a.right, y0, m);
        for (const ex of [a.left - 5, a.right + 4]) for (const [ox, oy] of [[-1, 0], [2, 0], [0, -1], [1, -1]]) this.px(ex + ox, y0 + 5 + oy, rgba(255, 120, 30, 0.2 + 0.4 * tw(t, 1, 5)), false);
        // 3.5초마다 두 용이 바깥으로 불을 뿜는다
        const q = (t % 3.5) / 0.9;
        if (q < 1) {
          const len = Math.round(2 + Math.sin(q * Math.PI) * 6);
          for (let i = 0; i < len; i++) {
            const k = i / Math.max(1, len - 1);
            const col = k < 0.3 ? '#fff3a0' : k < 0.65 ? '#ffb43a' : '#ff5a3a';
            const wob = Math.round(Math.sin(i * 1.3 + t * 25) * 0.6);
            for (const sd of [-1, 1]) {
              const x = sd < 0 ? a.left - 10 - i : a.right + 10 + i;
              this.px(x, y0 + 8 + wob, col, false);
              if (i > 1 && i < len - 1) this.px(x, y0 + 7 + wob, rgba(255, 150, 60, 0.55), false);
            }
          }
        }
        // 불티
        for (let i = 0; i < 6; i++) {
          const p = (t * 0.55 + i / 6) % 1;
          const sd = i % 2 ? 1 : -1;
          const x = a.hx + sd * (8 + hash(i) * 6) + Math.sin(t * 3 + i) * 1.2, y = a.my + 1 - p * 13;
          this.px(x, y, rgba(255, 200 - p * 120, 60, 1 - p), false);
        }
      },
    },

    // 별자리 망토 깃: 머리 뒤로 부채처럼 솟은 거대한 우주 깃. 금 살 사이 칸마다 밤하늘이 흐르고 별자리가 차례로 그어진다. 가장자리 레이스 끝엔 빛 구슬. 가슴엔 초승달·별 브로치
    xastralcollar: {
      back(g, a, c, t) {
        if (a.curled) return;
        const cx = a.hx + 0.5, cy = a.my + 2.5, RX = 14.5, RY = 15.5, N = 9;
        const info = (x, y) => {
          const nx = (x + 0.5 - cx) / RX, ny = (cy - (y + 0.5)) / RY;
          if (ny < 0) return null;
          const r = Math.hypot(nx, ny), an = Math.atan2(ny, nx);
          const ph = (an / Math.PI) * N, fr = ph - Math.floor(ph);
          const rmax = 0.92 + 0.08 * Math.sin(Math.PI * fr);
          return r <= rmax ? { r, an, fr, rmax, lobe: Math.floor(ph) } : null;
        };
        area(this, (x, y) => !!info(x, y), [cx - RX - 1, cy - RY - 1, cx + RX + 1, cy], (x, y) => {
          const q = info(x, y);
          const edge = q.r > q.rmax - 0.075;
          if (edge) {
            if (q.fr > 0.4 && q.fr < 0.6) return tw(t, q.lobe, 3) > 0.5 ? '#ffffff' : '#bfe6ff'; // 레이스 끝 빛 구슬
            return (x + y) % 2 ? '#ffd65a' : '#eef2ff';
          }
          if (q.fr < 0.07 || q.fr > 0.93) return q.r > 0.5 ? '#ffe28a' : '#c8962a'; // 금 살
          if (q.r > q.rmax - 0.16) return '#5a4aa8'; // 안쪽 테
          if (h2(x, y) > 0.92 && tw(t, x * 3 + y * 7, 2.5) > 0.45) return '#fffbe0';
          const wave = Math.abs(q.r - (0.6 + 0.12 * Math.sin(q.an * 4 - t * 1.6)));
          if (wave < 0.05) return hsl(255 + 55 * Math.sin(t * 0.7 + q.an * 2), 85, 62);
          if (wave < 0.1) return hsl(250 + 50 * Math.sin(t * 0.7 + q.an * 2), 70, 30);
          return hsl(238 + 22 * Math.sin(q.an * 3 + t * 0.8), 70, 9 + q.r * 12);
        }, '#0b0a1e');
        // 별자리: 칸마다 하나씩, 점을 차례로 이어 긋는다
        const CONS = [
          [[0.83, 0.86], [0.78, 0.72], [0.7, 0.8], [0.66, 0.66]],
          [[0.5, 0.86], [0.44, 0.74], [0.56, 0.68], [0.5, 0.58]],
          [[0.3, 0.84], [0.22, 0.74], [0.3, 0.66], [0.18, 0.62]],
        ];
        const P = (an, r) => [cx + Math.cos(an * Math.PI) * r * RX - 0.5, cy - Math.sin(an * Math.PI) * r * RY - 0.5];
        CONS.forEach((pts, ci) => {
          const prog = ((t * 0.9 + ci * 1.3) % 5) - 0.5; // 이은 선 수
          for (let i = 0; i < pts.length - 1; i++) {
            const k = cl(prog - i, 0, 1);
            if (k <= 0) continue;
            const [x0, y0] = P(...pts[i]), [x1, y1] = P(...pts[i + 1]);
            line(this, x0, y0, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 'rgba(255,214,120,0.75)');
          }
          pts.forEach((pt, i) => { const [x, y] = P(...pt); this.px(x, y, prog > i - 0.5 ? '#ffe9a0' : '#8a7ac8', false); });
        });
      },
      front(g, a, c, t) {
        const N = '#1d1a4a', n = '#12102e', Y = '#ffd65a';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return n;
          if (a.curled) return adx >= 5 ? n : N;
          if (dy <= -2) return adx >= 6 ? '#c8962a' : Y; // 금 깃
          if (h2(x, y) > 0.85 && tw(t, x + y * 3, 3) > 0.6) return '#fffbe0';
          return adx >= 5 ? n : N;
        });
        if (a.curled) return;
        // 초승달 + 별 브로치
        const sh = tw(t, 2, 3) > 0.75;
        this.pattern(['.YY..W.', 'Y...WWW', '.YY..W.'], a.hx - 3, a.my + 2, { Y: sh ? '#fff2b0' : Y, W: sh ? '#ffffff' : '#fff6c8' });
      },
    },

    // ======================= 등 =======================

    // 여섯 장 천사 날개: 위·옆·아래로 세 쌍. 쌍마다 박자를 달리해 너울거리고, 깃 끝은 금빛. 뒤로 은은한 빛, 빛나는 깃털이 흩날린다
    xseraphwings: {
      back(g, a, c, t) {
        const cu = a.curled;
        const ox = a.hx - 4, oy = cu ? a.cy - 3 : a.top + 4;
        const sc = cu ? 0.75 : 1;
        // 날개 뒤 빛 번짐
        const pu = 0.7 + 0.3 * Math.sin(t * 2);
        for (let y = oy - 18; y <= oy + 8; y++)
          for (let x = a.hx - 20; x <= a.hx + 20; x++) {
            const d = Math.hypot((x - a.hx) / 19, (y - oy + 3) / 15);
            if (d < 1) this.px(x, y, rgba(255, 246, 210, 0.22 * pu * (1 - d) * (1 - d)), false);
          }
        const put = (x, y, col) => { x = Math.round(x); y = Math.round(y); this.px(x, y, col, false); this.px(2 * a.hx - x, y, col, false); };
        const PAIRS = [
          // [가운데 각(π 단위), 펼친 폭, 길이, 깃 수, 박자, 뿌리 높이]
          [1.22, 0.16, 9, 4, 2.1, 3],
          [0.9, 0.2, 14, 5, 1.05, 0],
          [0.58, 0.24, 18, 6, 0, -2],
        ];
        for (const [th0, spread, L0, n, ph, oyd] of PAIRS) {
          const flap = Math.sin(t * 2.4 - ph) * 0.07;
          // 날개 하나 = 깃 여럿. 깃마다 한쪽 가장자리에 그늘 줄을 넣어 깃이 갈라져 보이게, 외곽선은 날개 둘레에만
          const cells = [];
          for (let f = n - 1; f >= 0; f--) {
            const u = f / (n - 1);
            const th = Math.PI * (th0 - spread / 2 + spread * u + flap * (0.6 + u));
            const L = L0 * sc * (0.7 + 0.3 * Math.sin(Math.PI * (0.2 + 0.8 * u)));
            const nx = -Math.sin(th), ny = -Math.cos(th);
            const body = f % 2 ? '#ffffff' : '#eef3fd';
            for (let k = 1.5; k <= L; k += 0.5) {
              const x = ox + Math.cos(th) * k, y = oy + oyd - Math.sin(th) * k;
              const tip = k >= L - 2;
              cells.push([x, y, tip ? (k >= L - 0.8 ? '#fff4b8' : '#ffd65a') : body]);
              if (k < L - 1) cells.push([x + nx, y + ny, tip ? '#d89a20' : k < 4 ? '#e8eefa' : '#aebbd8']);
            }
          }
          // 같은 칸을 여러 번 찍지 않게 칸마다 한 번만 (반 칸 걸음이라 겹침이 많다 — 예전엔 프레임마다 9ms 넘게 들었다)
          const fill = new Map();
          for (const [x, y, col] of cells) fill.set(Math.round(x) + ',' + Math.round(y), col);
          const rim = new Set();
          for (const k of fill.keys()) {
            const [x, y] = k.split(',').map(Number);
            for (const [ex, ey] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const n = x + ex + ',' + (y + ey);
              if (!fill.has(n)) rim.add(n);
            }
          }
          for (const k of rim) {
            const [x, y] = k.split(',').map(Number);
            put(x, y, '#7c86b4');
          }
          for (const [k, col] of fill) {
            const [x, y] = k.split(',').map(Number);
            put(x, y, col);
          }
        }
        // 흩날리는 빛 깃털
        for (let i = 0; i < 4; i++) {
          const p = (t * 0.22 + i / 4) % 1;
          const x = a.hx + (i % 2 ? 1 : -1) * (9 + i * 2.5) + Math.sin(p * 7 + i) * 2, y = oy - 14 + p * 22;
          this.px(x, y, rgba(255, 255, 255, 1 - p), false);
          this.px(x + 1, y + 1, rgba(255, 214, 90, 1 - p), false);
        }
      },
    },

    // 우주 용의 날개: 뼈대 사이 막이 우주로 뚫린 창 — 성운이 흐르고 별이 지나간다. 가장자리는 청록 빛, 손목엔 갈고리 발톱. 날갯짓 끝에서 별가루가 떨어진다
    xvoidwings: {
      back(g, a, c, t) {
        const cu = a.curled;
        const fl = Math.sin(t * 2.2);
        const sy = cu ? a.cy - 3 : a.top + 4;
        const sh = [3, sy], wr = [10, sy - 12 - fl * 2];
        const tips = [[16, wr[1] - 6 - fl * 1.5], [18, wr[1] + 3 - fl], [16, wr[1] + 11 - fl * 0.5], [11, GROUND - 1]];
        const tri = (p, A, B, C) => {
          const s1 = (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]);
          const s2 = (C[0] - B[0]) * (p[1] - B[1]) - (C[1] - B[1]) * (p[0] - B[0]);
          const s3 = (A[0] - C[0]) * (p[1] - C[1]) - (A[1] - C[1]) * (p[0] - C[0]);
          return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
        };
        const cuts = [];
        for (let i = 0; i < tips.length - 1; i++) {
          const A = tips[i], B = tips[i + 1];
          const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
          let dx = mx - wr[0], dy = my - wr[1];
          const dl = Math.hypot(dx, dy) || 1;
          const rad = Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.42;
          cuts.push([mx + (dx / dl) * rad * 0.75, my + (dy / dl) * rad * 0.75, rad]);
        }
        const inMem = (u, y) => {
          const p = [u, y];
          let ok = tri(p, sh, wr, tips[3]);
          for (let i = 0; i < tips.length - 1 && !ok; i++) ok = tri(p, wr, tips[i], tips[i + 1]);
          if (!ok) return false;
          for (const [qx, qy, r] of cuts) if (Math.hypot(u - qx, y - qy) < r) return false;
          return true;
        };
        const rimC = tw(t, 0, 3) > 0.5 ? '#9ff2ff' : '#4fd0f0';
        for (const s of [-1, 1]) {
          const X = (u) => a.hx + s * u;
          for (let y = Math.floor(wr[1] - 9); y <= GROUND; y++)
            for (let u = 2; u <= 19; u++) {
              if (!inMem(u, y)) continue;
              const edge = !inMem(u + 1, y) || !inMem(u - 1, y) || !inMem(u, y + 1) || !inMem(u, y - 1);
              let col;
              if (edge) col = rimC;
              else if (hash(Math.floor(u + t * 1.6) * 7.1 + y * 13.3 + s * 3) > 0.93) col = '#ffffff';
              else {
                const n = Math.sin(u * 0.35 + y * 0.28 - t * 1.1) + Math.sin(u * 0.12 - y * 0.4 + t * 0.6);
                col = hsl(270 + n * 30, 65, 12 + (n + 2) * 5);
              }
              this.px(X(u), y, col, false);
            }
          // 뼈대
          line(this, X(sh[0]), sh[1], X(wr[0]), wr[1], '#3a2458');
          line(this, X(sh[0]), sh[1] - 1, X(wr[0]), wr[1] - 1, '#8a6ac0');
          for (const tp of tips) line(this, X(wr[0]), wr[1], X(tp[0]), tp[1], '#4a3070');
          for (const tp of tips.slice(0, 3)) this.px(X(tp[0]), tp[1], '#efe6ff', false);
          // 손목 발톱
          this.pattern(s < 0 ? ['.W', 'WK', 'KK'] : ['W.', 'KW', 'KK'], X(wr[0]) - (s < 0 ? 1 : 0), Math.round(wr[1]) - 2, { W: '#efe6ff', K: '#3a2458' }, false);
          // 별가루
          for (let i = 0; i < 3; i++) {
            const p = (t * 0.6 + i / 3) % 1;
            const tp = tips[i];
            this.px(X(tp[0] + p * 2), tp[1] + p * 7, rgba(160, 235, 255, 1 - p), false);
          }
        }
      },
    },

    // 성운 망토 (2차 다듬음): 어깨 보석 고리에 걸린 망토가 몸 뒤로 늘어지고, 바람에 왼쪽으로 날린다.
    // 위 가장자리로 분홍 안감이 뒤집혀 보이고, 결 따라 주름이 물결치고, 밑단엔 금실 테. 날리는 끝에서 별가루가 흩어진다
    xnebulacloak: {
      back(g, a, c, t) {
        const cu = a.curled;
        const yS = cu ? a.top + 2 : a.my - 3;
        const yB = GROUND + 1;
        const len = cu ? 9 : 13;
        const xl = a.left - 1, xr = a.right + 1;
        const span = (x) => {
          if (x >= xl) {
            const over = x - xr;
            if (over > 0) { const tp = yS + 2 + over * 2; return tp <= yB ? [tp, yB, 0] : null; }
            return [yS, yB, 0];
          }
          const u = (xl - x) / len;
          if (u > 1) return null;
          const tp = yS + 1 + 2 * u + Math.sin(t * 3 - u * 6) * 1.4 * u;
          const bt = yB - 6 * Math.pow(u, 1.2) + Math.sin(t * 3 - u * 6 - 0.8) * 1.2 * u;
          return bt - tp >= 0.5 ? [tp, bt, u] : null;
        };
        const inside = (x, y) => { const s = span(x); return !!s && y >= Math.round(s[0]) && y <= Math.round(s[1]); };
        area(this, inside, [xl - len - 1, yS - 2, xr + 4, yB + 1], (x, y) => {
          const [tp, bt, u] = span(x);
          const T = Math.round(tp), Bt = Math.round(bt);
          if (y === Bt) return (x + Math.floor(t * 6)) % 5 === 0 ? '#ffffff' : '#ffd65a'; // 금실 밑단
          if (u > 0.12 && y === T) return hsl(325 + 20 * Math.sin(t + u * 4), 90, 76); // 뒤집힌 안감
          if (h2(x, y) > 0.92 && tw(t, x * 3 + y, 2.8) > 0.45) return '#ffffff';
          const v = (y - tp) / Math.max(1, bt - tp);
          const fold = Math.sin(v * Math.PI * 3 + u * 5 - t * 2.5);
          const n = nebN(x, y, t);
          if (Math.abs(n) < 0.12) return hsl(320 + n * 60, 80, 60);
          return hsl(252 + n * 32, 72, 24 + (n + 2) * 4.5 + fold * 7);
        }, '#0a0620');
        // 날리는 끝에서 별가루
        for (let i = 0; i < 7; i++) {
          const p = (t * 0.45 + i / 7) % 1;
          const x = xl - len * (0.55 + 0.45 * hash(i + 2)) - p * 6, y = yS + 4 + hash(i) * 4 - p * 6 + Math.sin(p * 6 + i);
          this.px(x, y, hsl(270 + hash(i + 7) * 90, 95, 80, 0.95 * (1 - p)), false);
        }
      },
      front(g, a, c, t) {
        if (a.curled) return;
        const hue = (t * 60) % 360;
        // 어깨 보석 고리 (망토가 여기 걸린다)
        for (const s of [-1, 1]) {
          const x = s < 0 ? a.left - 1 : a.right + 1;
          this.pattern(['.Y.', 'YGY', '.Y.'], x - 1, a.my - 1, { Y: '#ffd65a', G: hsl(hue + (s > 0 ? 180 : 0), 95, 65) });
        }
        // 가슴 금 사슬
        for (let dx = -6; dx <= 6; dx++) {
          const y = a.my + 1 + Math.round(2 * (1 - (dx / 6) ** 2));
          if ((dx + 40) % 2) this.px(a.hx + dx, y, '#ffd65a');
        }
        star(this, a.hx, a.my + 3, hsl(hue, 95, 70), true);
      },
    },

    // 천구 원환: 머리 뒤에 금빛 대원환이 룬을 새기며 돌고, 은청·장미금 두 고리가 자이로처럼 뒤집히며 몸을 앞뒤로 감싸 돈다. 고리마다 보석이 미끄러지고, 가운데선 빛이 숨 쉰다
    xcelestialrings: {
      back(g, a, c, t) { ringsDraw.call(this, a, t, false); },
      front(g, a, c, t) { ringsDraw.call(this, a, t, true); },
    },

    // 별의 왕좌: 첨탑이 솟은 금빛 왕좌 등받이. 보랏빛 벨벳에 금실 격자와 별, 머리 뒤엔 빛살이 도는 태양 문장, 첨탑 끝 보석이 맥동한다. 팔걸이까지 놓인 진짜 왕좌. 금테를 따라 빛이 흐른다
    xstarthrone: {
      back(g, a, c, t) {
        const H = a.hx;
        const arch = (dx) => 15 + Math.round(6 * Math.pow(dx / 9, 1.6));
        const kind = (x, y) => {
          const dx = Math.abs(x - H);
          if (y > GROUND) return null;
          if (dx <= 9 && y >= arch(dx)) return dx >= 8 || y - arch(dx) < 1 ? 'trim' : 'panel';
          if (dx >= 10 && dx <= 11 && y >= 19) return 'post';
          if (dx === 0 && y >= 9 && y < 15) return 'spire';
          if (dx === 5 && y >= arch(5) - 3 && y < arch(5)) return 'spire';
          if (dx >= 9 && dx <= 14 && y >= 38 && y <= 39) return 'arm';
          if (dx >= 13 && dx <= 14 && y >= 40) return 'post';
          return null;
        };
        const glint = Math.floor(t * 12) % 30;
        const mx = H + 0.5, my = 25.5;
        area(this, (x, y) => !!kind(x, y), [H - 15, 8, H + 15, GROUND], (x, y) => {
          const k = kind(x, y), dx = Math.abs(x - H);
          if (k === 'trim' || k === 'post' || k === 'arm' || k === 'spire') {
            if (k !== 'spire' && (y + dx + 40 - glint) % 30 === 0) return '#ffffff';
            if (k === 'post') return dx === 11 || dx === 14 ? '#b07e20' : '#ffd65a';
            if (k === 'arm') return y === 38 ? '#ffe9a0' : '#c8962a';
            return k === 'spire' ? '#ffe28a' : dx >= 9 ? '#b07e20' : '#ffd65a';
          }
          // 벨벳 판 + 태양 문장
          const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
          if (d <= 4.6) {
            if (d > 3.7) return '#ffd65a';
            if (d < 1.4) return hsl((t * 60) % 360, 80, 70 + 20 * tw(t, 0, 4));
            const an = Math.atan2(y + 0.5 - my, x + 0.5 - mx) + t * 1.2;
            return Math.sin(an * 6) > 0 ? '#fff6c8' : '#e8a82a';
          }
          if ((x + y) % 4 === 0 || (x - y + 80) % 4 === 0) return h2(x, y) > 0.8 && tw(t, x + y * 2, 3) > 0.6 ? '#ffffff' : '#8a6a2a';
          return dx >= 6 ? '#24103a' : '#3a1658';
        }, '#1a0f08');
        // 태양 문장 바깥 빛살
        for (let i = 0; i < 12; i++) {
          const an = (i / 12) * Math.PI * 2 - t * 0.6;
          for (let r = 5.2; r < (i % 2 ? 6.6 : 7.6); r += 0.7) this.px(mx - 0.5 + Math.cos(an) * r, my - 0.5 + Math.sin(an) * r, rgba(255, 220, 120, 0.55), false);
        }
        // 첨탑 끝 보석 (가운데 다이아, 왼쪽 루비, 오른쪽 사파이어) + 팔걸이 끝 구슬
        const pu = tw(t, 0, 3);
        this.pattern(['.K.', 'KWK', 'KDK', '.K.'], H - 1, 6, { K: '#1a0f08', W: '#ffffff', D: pu > 0.5 ? '#bff0ff' : '#7fc8ff' }, false);
        for (const s of [-1, 1]) {
          const G = s < 0 ? (tw(t, 1, 3) > 0.5 ? '#ff7a8a' : '#d81c3a') : tw(t, 2, 3) > 0.5 ? '#9ac8ff' : '#2f6bff';
          this.pattern(['.K.', 'KGK', 'KGK', '.K.'], H + s * 10.5 - 1 + (s > 0 ? 0 : 0), 15, { K: '#1a0f08', G }, false);
          this.pattern(['KK', 'GK'].map((r) => (s < 0 ? r : r.split('').reverse().join(''))), H + s * 15 - (s < 0 ? 0 : 1), 37, { K: '#1a0f08', G }, false);
          this.px(H + s * 5, arch(5) - 4, '#fff6c8', false);
        }
        // 빛 고리 + 반짝이
        for (let r = 0; r < 8; r++) { const an = (r / 8) * Math.PI * 2 + t; this.px(H + Math.cos(an) * 2.2, 7.5 + Math.sin(an) * 2.2, rgba(190, 240, 255, 0.35 + 0.4 * pu), false); }
        if (t % 1.8 < 0.3) star(this, H - 8, 12, '#fff2b0');
        if ((t + 0.9) % 1.8 < 0.3) star(this, H + 8, 13, '#fff2b0');
      },
    },

    // ======================= 몸 2차 =======================

    // 만년설 수정 망토깃: 어깨를 덮은 흰 눈여우 털, 그 밑에서 얼음 수정이 바깥으로 솟는다. 수정마다 빛이 미끄러지고, 냉기와 눈송이가 내려앉는다
    xfrostmantle: {
      back(g, a, c, t) {
        if (a.curled) return;
        const pu = 0.6 + 0.4 * Math.sin(t * 2);
        for (const s of [-1, 1]) {
          const cx = s < 0 ? a.left - 4 : a.right + 4, cy = a.my - 1;
          for (let y = cy - 8; y <= cy + 6; y++)
            for (let x = cx - 8; x <= cx + 8; x++) {
              const d = Math.hypot((x - cx) / 8, (y - cy) / 7);
              if (d < 1) this.px(x, y, rgba(170, 225, 255, 0.22 * pu * (1 - d)), false);
            }
        }
      },
      front(g, a, c, t) {
        const cu = a.curled;
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#2a5a98';
          if (cu) return adx >= 5 ? '#ffffff' : '#5a9ad8';
          if (dy <= -1 || (dy === 0 && h2(x, y) > 0.45)) return h2(x, y) > 0.7 ? '#dfe8f4' : '#ffffff'; // 털 (아랫단이 들쭉날쭉)
          return adx <= 1 ? '#9ad4ff' : '#5a9ad8';
        });
        if (cu) return;
        // 얼음 수정: 어깨 털 밑에서 바깥으로
        const SH = [[100, 6], [126, 9], [152, 7.5], [176, 5]];
        SH.forEach(([deg, L], i) => {
          for (const s of [-1, 1]) {
            const th = ((s < 0 ? deg : 180 - deg) * Math.PI) / 180;
            const bx = (s < 0 ? a.left - 0.5 : a.right + 1.5), by = a.my + 1.5;
            const ex = bx + Math.cos(th) * L, ey = by - Math.sin(th) * L;
            tube(this, [[bx, by], [ex, ey]], (u) => 1.5 * (1 - u) + 0.25, (Lq) => (Lq.side * s > 0.45 ? '#7cc4f0' : Lq.side * s < -0.45 ? '#f2fdff' : '#c4eeff'), '#1e4a78');
            const k = (t * 0.8 + i * 0.37 + (s > 0 ? 0.5 : 0)) % 1.6;
            if (k < 1) this.px(bx + (ex - bx) * k, by + (ey - by) * k, '#ffffff', false);
          }
        });
        // 털 가장자리 (수정 밑동을 덮는다)
        for (const s of [-1, 1]) {
          const x0 = s < 0 ? a.left : a.right;
          [[0, -1], [1, 0], [1, 1], [2, 1], [1, 2], [2, 2], [1, 3]].forEach(([o, dy]) => this.px(x0 - s * o, a.my + dy, (o + dy) % 2 ? '#ffffff' : '#e6eef8'));
          this.px(x0 - s * 3, a.my + 2, '#c8d6ea');
        }
        // 눈꽃 브로치
        const on = tw(t, 0, 3) > 0.6;
        this.pattern(['W.W', '.C.', 'W.W'], a.hx - 1, a.my + 2, { W: on ? '#ffffff' : '#bfe8ff', C: on ? '#ffffff' : '#6ac8ff' });
        // 냉기 · 눈송이
        for (let i = 0; i < 6; i++) {
          const p = (t * 0.3 + i / 6) % 1;
          const s = i % 2 ? 1 : -1;
          const x = a.hx + s * (a.hw + 3 + hash(i) * 7) + Math.sin(p * 7 + i) * 1.3, y = a.top - 4 + p * 14;
          if (i < 3) this.pattern(['.W.', 'W.W', '.W.'], Math.round(x) - 1, Math.round(y) - 1, { W: rgba(240, 250, 255, 0.85 * (1 - p)) }, false);
          else this.px(x, y, rgba(220, 240, 255, 0.9 * (1 - p)), false);
        }
      },
    },

    // 시간의 톱니 흉갑: 놋쇠 판갑에 리벳, 양어깨에서 크고 작은 톱니바퀴가 맞물려 돈다. 가슴의 시간 핵은 똑딱똑딱 한 칸씩 켜지고, 몸 뒤엔 커다란 반투명 시계판의 바늘이 돈다
    xchronoplate: {
      back(g, a, c, t) {
        const cx = a.hx + 0.5, cy = a.curled ? a.cy - 6 : a.top - 4, R = 14;
        for (let i = 0; i < 110; i++) {
          const an = (i / 110) * Math.PI * 2;
          this.px(cx - 0.5 + Math.cos(an) * R, cy - 0.5 + Math.sin(an) * R, 'rgba(232,184,96,0.55)', false);
          if (i % 2) this.px(cx - 0.5 + Math.cos(an) * (R - 1.6), cy - 0.5 + Math.sin(an) * (R - 1.6), 'rgba(232,184,96,0.22)', false);
        }
        for (let i = 0; i < 12; i++) {
          const an = (i / 12) * Math.PI * 2;
          const big = i % 3 === 0;
          for (let r = R - (big ? 4 : 3); r <= R - 2; r += 0.7) this.px(cx - 0.5 + Math.cos(an) * r, cy - 0.5 + Math.sin(an) * r, big ? 'rgba(255,233,160,0.85)' : 'rgba(232,184,96,0.6)', false);
        }
        const hand = (an, L, col) => { for (let r = 0; r <= L; r += 0.6) this.px(cx - 0.5 + Math.cos(an) * r, cy - 0.5 + Math.sin(an) * r, col, false); };
        hand(t * 0.08 - Math.PI / 2, 7, 'rgba(255,214,120,0.75)');
        hand(t * 0.9 - Math.PI / 2, 11, 'rgba(255,240,190,0.8)');
        hand(t * 6 - Math.PI / 2, 12, 'rgba(120,230,255,0.45)');
      },
      front(g, a, c, t) {
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#4a2e12';
          if (adx === 4 && (y + 40) % 2 === 0 && !a.curled) return '#ffe9a0'; // 리벳
          if (dy <= -2) return '#e8b860';
          return adx >= 5 ? '#7a4e1e' : '#b07a34';
        });
        const cy = a.curled ? GROUND - 1 : a.my + 3;
        // 시간 핵: 둘레 8칸이 한 칸씩 똑딱
        const ring = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
        const on = Math.floor(t * 2) % 8;
        this.px(a.hx - 2, cy, '#ffd65a'); this.px(a.hx + 2, cy, '#ffd65a');
        ring.forEach(([ox, oy], i) => this.px(a.hx + ox, cy + oy, i === on ? '#ffffff' : (i + 1) % 8 === on ? '#9af0ff' : '#2a8aa8'));
        this.px(a.hx, cy, tw(t, 0, 6) > 0.5 ? '#e8ffff' : '#7fe8ff');
        if (a.curled) return;
        // 맞물린 톱니바퀴
        const gear = (gx, gy, R, teeth, rot) => {
          const inside = (x, y) => {
            const dx = x + 0.5 - gx, dy = y + 0.5 - gy, r = Math.hypot(dx, dy);
            if (r < 0.9) return false;
            return r <= R - 0.7 + (Math.cos(teeth * (Math.atan2(dy, dx) - rot)) > 0.25 ? 1 : 0);
          };
          area(this, inside, [gx - R - 1, gy - R - 1, gx + R + 1, gy + R + 1], (x, y) => {
            const dx = x + 0.5 - gx, dy = y + 0.5 - gy, r = Math.hypot(dx, dy);
            if (r < 1.8) return '#ffe9a0';
            if (R > 3.5 && r < R - 1.6 && Math.abs(Math.sin(2 * (Math.atan2(dy, dx) - rot))) > 0.55) return '#3a2410'; // 살 사이 구멍
            const sh = -(dx + dy) / R;
            return sh > 0.35 ? '#ffd890' : sh < -0.35 ? '#9a6a2a' : '#d8a050';
          }, '#2a1a08');
        };
        for (const s of [-1, 1]) {
          const bx = s < 0 ? a.left - 2.5 : a.right + 3.5;
          gear(bx, a.my + 1.5, 3.8, 8, s * t * 1.2);
          gear(bx + s * 2.4, a.my - 3.4, 2.5, 6, -s * t * 1.2 * 1.5 + 0.3);
        }
        // 증기 한 줄기
        for (let i = 0; i < 2; i++) {
          const p = (t * 0.5 + i / 2) % 1;
          const s = i ? 1 : -1;
          this.px(a.hx + s * (a.hw + 7) + Math.sin(p * 6) * 0.8, a.my - 6 - p * 7, rgba(240, 240, 245, 0.7 * (1 - p)), false);
        }
      },
    },

    // 뇌신의 먹구름 견갑: 양어깨에 뭉게 먹구름이 걸려 둥실, 남빛 예복 밑단엔 금 번개 무늬. 몇 초마다 구름 사이로 번개가 가슴을 가로지르고 땅에도 내리꽂힌다. 구름 밑으론 빗방울
    xstormmantle: {
      front(g, a, c, t) {
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#151a2a';
          if ((dy === -1 && (x + 40) % 4 === 0) || (dy === 0 && (x + 40) % 4 === 2)) return '#ffd84a';
          if (dy <= -2) return '#8a96c0';
          return adx >= 5 ? '#1c2236' : '#28304a';
        });
        if (a.curled) return;
        const cyc = t % 2.4;
        const bolt = cyc < 0.32 && Math.floor(t * 28) % 3 !== 0;
        const strike = (t + 1.2) % 2.4 < 0.22;
        const flash = bolt || strike;
        const bob = Math.round(Math.sin(t * 1.3) * 0.6);
        const PUFF = [[-2, 0, 2.6], [-4.6, 1.6, 2.3], [-0.6, 2.2, 2.1], [-3.2, -1.8, 2.1], [-6.3, 2.6, 1.7]];
        for (const s of [-1, 1]) {
          const base = s < 0 ? a.left + 0.5 : a.right + 0.5;
          const P = PUFF.map(([dx, dy, r]) => [base + (s < 0 ? dx : -dx), a.my + dy + bob, r]);
          const inside = (x, y) => P.some(([px, py, r]) => Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r);
          // 구름 덩이마다 왼쪽 위는 밝고 아래는 어둡게 → 뭉게뭉게 겹친 볼록함이 보인다
          area(this, inside, [base - 9, a.my - 5, base + 9, a.my + 6], (x, y) => {
            let best = null;
            for (const [px, py, r] of P) { const m = r - Math.hypot(x + 0.5 - px, y + 0.5 - py); if (m >= 0 && (!best || py > best[1])) best = [px, py, r, m]; }
            const [px, py, r, m] = best;
            const lx = (x + 0.5 - px) / r, ly = (y + 0.5 - py) / r;
            const L = -lx * 0.5 - ly;
            if (flash) return L > 0.3 ? '#ffffff' : L > -0.3 ? '#dfe6ff' : '#a8b4e0';
            if (L > 0.55 && m < 1.2) return '#eef1fa';
            if (L > 0.15) return '#b6bed6';
            if (L > -0.4) return '#7c87a6';
            return '#4e5874';
          }, '#1c2236');
          // 빗방울
          for (let i = 0; i < 3; i++) {
            const q = ((t * 1.8 + i / 3 + (s > 0 ? 0.5 : 0)) % 1);
            this.px(base + (s < 0 ? -2 - i * 2 : 2 + i * 2), a.my + 4 + q * 5, rgba(150, 190, 255, 0.85 * (1 - q)), false);
          }
          // 잔 불꽃
          if (Math.floor(t * 7 + s) % 5 === 0) this.px(base + (s < 0 ? -5 : 5), a.my - 2 + bob, '#bff4ff');
        }
        // 가슴을 가로지르는 번개
        if (bolt) {
          const seed = Math.floor(t / 2.4) * 13;
          let px0 = a.left + 1, py0 = a.my + 3;
          const pts = [[px0, py0]];
          for (let x = a.left + 3; x < a.right; x += 2) pts.push([x, a.my + 2 + Math.round(hash(seed + x) * 2.4)]);
          pts.push([a.right - 1, a.my + 3]);
          for (let i = 0; i < pts.length - 1; i++) {
            const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
            line(this, x0, y0 + 1, x1, y1 + 1, 'rgba(140,200,255,0.55)');
            line(this, x0, y0, x1, y1, '#ffffff', true);
          }
        }
        // 땅으로 내리꽂는 번개 (좌우 번갈아)
        if (strike) {
          const s = Math.floor((t + 1.2) / 2.4) % 2 ? 1 : -1;
          const x0 = s < 0 ? a.left - 4 : a.right + 4;
          const pts = [[x0, a.my + 4], [x0 - s, a.my + 6], [x0 + s, a.my + 7], [x0, GROUND + 1]];
          for (let i = 0; i < pts.length - 1; i++) line(this, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#fff8c0', true);
          for (let k = -2; k <= 2; k++) this.px(x0 + k, GROUND + 2, 'rgba(255,248,200,0.6)', false);
        }
      },
    },

    // ======================= 등 2차 =======================

    // 세계수 (3차 디벨롭): 고양이 뒤에 굵은 거목이 서 있다 — 줄기가 고양이보다 넓어 양옆으로 나무껍질이 보이고, 머리 위 몇 칸은 맨 줄기, 그 위로 굵은 가지 셋이 갈라져 넓은 우산 같은 잎 지붕이 된다.
    // 잎 지붕은 바스락이며 빛나고 아랫면은 그늘, 황금 열매가 맥동, 반딧불이 맴돌고 잎이 떨어진다. 줄기의 빛 룬이 타고 오르고, 뿌리가 바닥에 퍼진다
    xworldtree: {
      back(g, a, c, t) {
        const H = a.hx + 0.5, base = GROUND + 1;
        const sw = Math.sin(t * 0.9) * 0.5;
        const BK = '#24140a';
        // 줄기 반폭: 밑동은 넓게 퍼지고 위로 갈수록 가늘다
        const half = (y) => (y > base - 3 ? 9 + (y - (base - 3)) * 1.5 : 8.5 - Math.max(0, base - 3 - y) * 0.12);
        const trunkTop = 24;
        area(this, (x, y) => y >= trunkTop && y <= base && Math.abs(x + 0.5 - H) <= half(y), [H - 14, trunkTop, H + 14, base], (x, y) => {
          const d = (x + 0.5 - H) / half(y); // -1 왼쪽 ~ 1 오른쪽
          if (Math.round(x + 0.5 - H + 40) % 3 === 0 && h2(x, Math.floor(y / 3)) > 0.3) return d < -0.3 ? '#7a5230' : '#3e2612'; // 세로 껍질 골
          return d < -0.55 ? '#b0804a' : d < 0 ? '#8a5e34' : d < 0.55 ? '#6a4524' : '#4a2e16';
        }, BK);
        // 줄기 양옆의 빛 룬 (아래에서 위로 타고 오른다)
        for (const s of [-1, 1]) {
          const rx = Math.round(H - 0.5 + s * 7);
          const q = (t * 7 + (s > 0 ? 6 : 0)) % 26;
          for (let y = trunkTop + 2; y <= base - 1; y++) {
            if ((y + 40) % 3 === 1) continue;
            const on = Math.abs(base - y - q) < 2.5;
            this.px(rx + ((y + 40) % 6 < 3 ? 0 : s), y, on ? '#dfffe8' : 'rgba(120,255,190,0.45)', false);
          }
        }
        // 뿌리
        const bark = (L) => (L.side < -0.6 ? '#9a6a3a' : L.side > 0.6 ? '#4a2e16' : '#6e4a28');
        for (const s of [-1, 1]) for (const [L, dy] of [[9, 0], [6, -1.2]]) {
          const pts = [];
          for (let k = 0; k <= 5; k++) { const u = k / 5; pts.push([H + s * (8 + u * L), base - 0.5 - Math.sin(u * Math.PI) * 1.2 + dy * u]); }
          tube(this, pts, (u) => 1.6 * (1 - u) + 0.35, bark, BK);
        }
        // 굵은 가지 셋 (줄기 위에서 갈라져 잎 지붕 속으로)
        tube(this, [[H - 3, trunkTop + 2], [H - 7, 22], [H - 13 + sw, 18.5]], (u) => 2.4 - u * 1.4, bark, BK);
        tube(this, [[H + 3, trunkTop + 2], [H + 7, 22], [H + 13 + sw, 18.5]], (u) => 2.4 - u * 1.4, bark, BK);
        tube(this, [[H, trunkTop + 1], [H + sw, 16]], (u) => 2.6 - u * 1.5, bark, BK);
        // 잎 지붕: 넓은 우산꼴 (가운데 아래는 비워 가지가 보이게)
        const C = [[0, 12.5, 6], [-8, 13.5, 5.5], [8, 13.5, 5.5], [-14.5, 16.5, 4], [14.5, 16.5, 4], [-4, 11, 5], [4, 11, 5], [-11, 18, 3.2], [11, 18, 3.2]];
        const inLeaf = (x, y) => y <= 23 && C.some(([cx, cy, r]) => Math.hypot(x + 0.5 - (H + cx + sw), y + 0.5 - cy - 3.5) <= r);
        const LV = ['#163f22', '#1e5a30', '#2e7a3a', '#4a9a40', '#7ac04a', '#c8e070'];
        area(this, inLeaf, [H - 20, 8, H + 20, 24], (x, y) => {
          if (!inLeaf(x, y + 1)) return '#163f22'; // 아랫면 그늘 테
          const lit = (-(x + 0.5 - H) * 0.15 - (y - 15.5)) / 5;
          const n = hash(x * 3.3 + y * 7.1 + Math.floor(t * 2.5 + h2(x, y) * 4) * 0.37);
          if (n > 0.975) return '#fff8c0';
          return LV[cl(Math.round(2.6 + lit * 1.4 + (n - 0.5) * 1.6), 0, 5)];
        }, '#123a1e');
        // 황금 열매
        [[-9, 15], [6, 12], [-2, 9], [12, 16], [-14, 17], [2, 16]].forEach(([ox, y], i) => {
          const k = tw(t, i, 2.5);
          const x = Math.round(H - 0.5 + ox + sw);
          this.pattern(['.Y.', 'YWY', '.y.'], x - 1, y + 2, { Y: '#ffc83a', W: k > 0.6 ? '#ffffff' : '#fff0a0', y: '#c88a1a' }, false);
          if (k > 0.5) for (const [px, py] of [[-2, 0], [2, 0], [0, -2]]) this.px(x + px, y + 3 + py, rgba(255, 230, 120, 0.4 * k), false);
        });
        // 반딧불 (잎 지붕 아래·옆을 맴돈다)
        for (let i = 0; i < 6; i++) {
          const x = H + Math.sin(t * 0.7 + i * 2.1) * 17, y = 25 + Math.sin(t * 1.1 + i * 1.3) * 5;
          const k = tw(t, i * 3, 4);
          this.px(x, y, rgba(220, 255, 140, 0.5 + 0.5 * k), false);
          for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.px(x + ox, y + oy, rgba(200, 255, 120, 0.25 * k), false);
        }
        // 떨어지는 잎
        for (let i = 0; i < 4; i++) {
          const p = (t * 0.18 + i / 4) % 1;
          const x = H + (i - 1.5) * 11 + Math.sin(p * 8 + i) * 2, y = 23 + p * 21;
          this.px(x, y, hsl(70 + i * 15, 75, 55, 1 - p * 0.6), false);
          this.px(x + 1, y, hsl(90 + i * 15, 70, 40, 1 - p * 0.6), false);
        }
      },
    },

    // 심해 빛 지느러미: 등 뒤로 반투명한 빛 지느러미 세 쌍이 물속처럼 하늘거린다. 청록에서 자홍으로 물들고, 지느러미 살을 따라 빛이 흘러가며, 가장자리는 주름져 일렁인다. 물방울이 오른다
    xabyssveil: {
      back(g, a, c, t) {
        const oy = (a.curled ? a.cy - 2 : a.top + 5) + 0.5;
        const FINS = [[98, 150, 15, 0], [158, 212, 14, 1.3], [220, 252, 10, 2.4]];
        for (const s of [-1, 1]) {
          const ox = a.hx + s * 3 + 0.5;
          for (const [d0r, d1r, R0, ph] of FINS) {
            const swd = Math.sin(t * 1.5 + ph) * 6;
            const d0 = d0r + swd, d1 = d1r + swd;
            for (let y = Math.floor(oy - R0 - 3); y <= Math.min(GROUND + 1, oy + R0 + 3); y++)
              for (let x = Math.floor(ox - R0 - 3); x <= ox + R0 + 3; x++) {
                const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
                const lx = s < 0 ? dx : -dx;
                let th = (Math.atan2(-dy, lx) * 180) / Math.PI;
                if (th < 0) th += 360;
                if (th < d0 || th > d1) continue;
                const f = (th - d0) / (d1 - d0);
                const R = R0 * (0.72 + 0.28 * Math.sin(Math.PI * f)) + 1.2 * Math.sin((th * Math.PI) / 180 * 14 + t * 3 + ph);
                const r = Math.hypot(dx, dy);
                if (r > R || r < 2) continue;
                const q = r / R;
                let col;
                const ray = ((f * 6) % 1) < 0.2;
                if (r > R - 1) col = hsl(305, 100, 82, 0.9);
                else if (ray && Math.abs(r - ((t * 9 + ph * 5) % (R0 + 4))) < 1) col = 'rgba(255,255,255,0.95)';
                else if (ray) col = hsl(185 + 100 * q, 100, 72, 0.7);
                else col = hsl(190 + 110 * q, 85, 48 + 18 * q, 0.32 + 0.4 * q);
                this.px(x, y, col, false);
              }
          }
        }
        // 물방울 · 플랑크톤 빛
        for (let i = 0; i < 6; i++) {
          const p = (t * 0.35 + i / 6) % 1;
          const x = a.hx + (i % 2 ? 1 : -1) * (7 + i * 2) + Math.sin(p * 9 + i) * 1.5, y = GROUND - p * 30;
          if (i < 3) this.pattern(['.o.', 'o.o', '.o.'], Math.round(x) - 1, Math.round(y) - 1, { o: rgba(200, 250, 255, 0.8 * (1 - p)) }, false);
          else this.px(x, y, rgba(150, 255, 240, 0.9 * (1 - p)), false);
        }
      },
    },

    // 일식 코로나: 머리 뒤에 검은 해가 떠 있다. 둘레로 진주빛 코로나가 천천히 흐르듯 뻗고, 붉은 홍염 고리가 솟았다 가라앉는다. 테를 따라 빛 구슬이 돌고, 다이아몬드 반지 섬광이 번쩍인다
    xeclipse: {
      back(g, a, c, t) {
        const cx = a.hx + 0.5, cy = a.curled ? a.cy - 6 : a.top - 4, R = 8.5;
        // 코로나
        for (let y = Math.floor(cy - 21); y <= cy + 21; y++)
          for (let x = Math.floor(cx - 21); x <= cx + 21; x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
            if (d <= R) continue;
            const an = Math.atan2(dy, dx);
            const L = 4 + 3.5 * (0.5 + 0.5 * Math.sin(an * 5 + t * 0.6)) + 2.5 * (0.5 + 0.5 * Math.sin(an * 11 - t * 0.9)) + 1.5 * Math.sin(an * 3 + t * 0.3);
            const q = (d - R) / L;
            if (q > 1) { if (d < R + 13) this.px(x, y, rgba(255, 230, 200, 0.06), false); continue; }
            this.px(x, y, rgba(255, 248 - q * 30, 230 - q * 110, 0.85 * Math.pow(1 - q, 1.5)), false);
          }
        // 검은 해 + 붉은 채층 테
        for (let y = Math.floor(cy - R - 1); y <= cy + R + 1; y++)
          for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            if (d > R) continue;
            this.px(x, y, d > R - 0.9 ? '#ff7a9a' : d > R - 1.8 ? '#2a0a18' : '#07060c', false);
          }
        // 홍염 고리 셋
        [-2.3, -0.75, 2.5].forEach((an0, i) => {
          const gr = 0.5 + 0.5 * Math.sin(t * 0.8 + i * 2.1);
          const bx = cx + Math.cos(an0) * (R + 0.5), by = cy + Math.sin(an0) * (R + 0.5);
          const rr = 1.2 + gr * 1.6;
          for (let k = 0; k <= 10; k++) {
            const u = (k / 10) * Math.PI;
            const ox = Math.cos(an0) * Math.sin(u) * rr * 1.4, oy = Math.sin(an0) * Math.sin(u) * rr * 1.4;
            const tx = -Math.sin(an0) * Math.cos(u) * rr, ty = Math.cos(an0) * Math.cos(u) * rr;
            this.px(bx + ox + tx - 0.5, by + oy + ty - 0.5, hsl(350, 100, 62 + 15 * gr, 0.95), false);
          }
        });
        // 테를 도는 빛 구슬
        for (let i = 0; i < 5; i++) {
          const an = t * 0.4 + (i * Math.PI * 2) / 5;
          this.px(cx - 0.5 + Math.cos(an) * (R - 0.4), cy - 0.5 + Math.sin(an) * (R - 0.4), '#ffffff', false);
        }
        // 다이아몬드 반지 섬광
        const dr = -0.95 + Math.sin(t * 0.2) * 0.3;
        const fx = Math.round(cx - 0.5 + Math.cos(dr) * (R + 0.3)), fy = Math.round(cy - 0.5 + Math.sin(dr) * (R + 0.3));
        const fl = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.1), 3);
        for (let k = 1; k <= 7; k++) {
          const al = fl * (1 - k / 8);
          for (const [ox, oy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) this.px(fx + ox, fy + oy, rgba(255, 255, 255, al), false);
        }
        this.pattern(['.W.', 'WWW', '.W.'], fx - 1, fy - 1, { W: '#ffffff' }, false);
        // 하늘의 별
        [[-15, -8], [14, -10], [-12, 6], [16, 4], [3, -16]].forEach(([ox, oy], i) => {
          if (tw(t, i * 2, 2.2) > 0.45) this.px(cx + ox, cy + oy, '#fff6e0', false);
        });
      },
    },
  };

  // 천구 원환: 고리는 앞뒤로 나눠 그린다 (앞쪽 반은 몸 앞, 머리 부분만 머리 뒤로)
  function ringsDraw(a, t, front) {
    const cx = a.hx + 0.5, cy = a.curled ? a.cy - 4 : a.top - 2;
    const pu = 0.7 + 0.3 * Math.sin(t * 2.3);
    if (!front) {
      // 가운데 빛
      for (let y = Math.floor(cy - 10); y <= cy + 10; y++)
        for (let x = Math.floor(cx - 10); x <= cx + 10; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d < 9.5) this.px(x, y, rgba(255, 240, 190, 0.4 * pu * (1 - d / 9.5) ** 2), false);
        }
      // 금빛 대원환 (정면) + 룬 눈금
      const R = 12.5;
      const ns = Math.ceil(R * 7);
      for (let i = 0; i < ns; i++) {
        const an = (i / ns) * Math.PI * 2;
        const x = cx - 0.5 + Math.cos(an) * R, y = cy - 0.5 + Math.sin(an) * R;
        this.px(x, y, '#ffd65a', false);
        this.px(cx - 0.5 + Math.cos(an) * (R - 1), cy - 0.5 + Math.sin(an) * (R - 1), '#a8741a', false);
      }
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * Math.PI * 2 + t * 0.45;
        const col = i % 3 ? '#fff2b0' : '#ffffff';
        this.px(cx - 0.5 + Math.cos(an) * (R + 1), cy - 0.5 + Math.sin(an) * (R + 1), col, false);
        if (i % 3 === 0) this.px(cx - 0.5 + Math.cos(an) * (R + 2), cy - 0.5 + Math.sin(an) * (R + 2), rgba(255, 240, 180, 0.7), false);
      }
      // 안쪽 점선 원 (반대로 돈다)
      for (let i = 0; i < 24; i++) {
        const an = (i / 24) * Math.PI * 2 - t * 0.8;
        if (i % 2) this.px(cx - 0.5 + Math.cos(an) * 10, cy - 0.5 + Math.sin(an) * 10, rgba(255, 220, 140, 0.6), false);
      }
    }
    // 자이로 고리 둘: [가로 반지름, 세로 반지름, 기울기, 뒤집힘 위상, 색, 그늘, 보석 색]
    const RINGS = [
      [17, 6, 0.28, 0, '#d8f4ff', '#5aa0d8', '#7fe8ff'],
      [15, 5.5, -0.42, 1.9, '#ffd8bc', '#c8704a', '#ff8ab0'],
    ];
    for (const [rx, ry0, rho, ph, col, shd, gem] of RINGS) {
      const fp = t * 0.7 + ph;
      const cr = Math.cos(rho), sr = Math.sin(rho);
      const P = (th) => {
        const lx = Math.cos(th) * rx, ly = Math.sin(th) * ry0 * Math.cos(fp);
        return [cx - 0.5 + lx * cr - ly * sr, cy + 3 - 0.5 + lx * sr + ly * cr, Math.sin(th) * Math.sin(fp)];
      };
      const ok = (x, y, z) => (front ? z > 0 && !nearFace(a, Math.round(x), Math.round(y)) : z <= 0 || nearFace(a, Math.round(x), Math.round(y)));
      const ns = Math.ceil(rx * 7);
      for (let i = 0; i < ns; i++) {
        const [x, y, z] = P((i / ns) * Math.PI * 2);
        if (!ok(x, y, z)) continue;
        this.px(x, y + 1, shd, false);
        this.px(x, y, col, false);
      }
      for (let i = 0; i < 3; i++) {
        const [x, y, z] = P(t * 1.3 + (i * Math.PI * 2) / 3);
        if (!ok(x, y, z)) continue;
        this.pattern(['.G.', 'GWG', '.G.'], Math.round(x) - 1, Math.round(y) - 1, { G: gem, W: '#ffffff' }, false);
      }
    }
  }

  Object.assign(root.PetSprite.ACCESSORIES, LAB);

  const LAB_ITEMS = [
    ['xplatpauldron', 'neck', '백금 성갑'],
    ['xnebulastole', 'neck', '성운 목도리'],
    ['xdivinependant', 'neck', '천상의 프리즘 목걸이'],
    ['xobsidiandrake', 'neck', '흑요룡 흉갑'],
    ['xastralcollar', 'neck', '별자리 망토 깃'],
    ['xseraphwings', 'back', '여섯 장 천사 날개'],
    ['xvoidwings', 'back', '우주 용의 날개'],
    ['xnebulacloak', 'back', '성운 망토'],
    ['xcelestialrings', 'back', '천구 원환'],
    ['xstarthrone', 'back', '별의 왕좌'],
    ['xfrostmantle', 'neck', '만년설 수정 망토깃'],
    ['xchronoplate', 'neck', '시간의 톱니 흉갑'],
    ['xstormmantle', 'neck', '뇌신의 먹구름 견갑'],
    ['xworldtree', 'back', '세계수'],
    ['xabyssveil', 'back', '심해 빛 지느러미'],
    ['xeclipse', 'back', '일식 코로나'],
  ];
})(window);

// ---------- handfx ----------
// 별 상점 "끝판왕" 시안 — 손 5 · 효과 5 (2026-10-09, 시안 전용)
(function (root) {
  const { GROUND, hash, mirror, heldPaw } = root.PetSprite.costumeKit;
  const A = (v) => Math.max(0, Math.min(1, v)).toFixed(2);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const tw = (t, i, sp = 2) => 0.5 + 0.5 * Math.sin(t * sp + i * 1.7);
  const mix = (p, q, k) => p.map((v, i) => Math.round(v + (q[i] - v) * clamp01(k)));
  const rgb = (c, al) => `rgba(${c[0]},${c[1]},${c[2]},${A(al)})`;
  const hex = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  // 여러 색 사이를 k(0~1)로 고른다
  const ramp = (stops, k) => {
    k = clamp01(k) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(k));
    return mix(stops[i], stops[i + 1], k - i);
  };
  // 얼굴 둘레 상자 (귀 끝 ~ 입 아래 한 줄)
  const inFace = (a, x, y, pad = 0) => x >= a.left - 1 - pad && x <= a.right + 1 + pad && y >= a.earTop - pad && y <= a.my + 1 + pad;
  // 십자 반짝이: 가운데 흰 점 + 팔 len 칸
  function glint(r, x, y, len, al = 1, col = [255, 240, 180]) {
    x = Math.round(x); y = Math.round(y);
    for (let k = 1; k <= len; k++) {
      const f = al * (1 - k / (len + 1));
      for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) r.px(x + dx, y + dy, rgb(col, f), false);
    }
    if (len >= 2) for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) r.px(x + dx, y + dy, rgb(col, al * 0.35), false);
    r.px(x, y, rgb([255, 255, 255], al), false);
  }
  // 반투명 원 모양 빛무리
  function glow(r, cx, cy, r0, r1, col, al, skip) {
    for (let y = Math.floor(cy - r1); y <= cy + r1; y++)
      for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d < r0 || d > r1) continue;
        if (skip && skip(x, y)) continue;
        r.px(x, y, rgb(col, al * (1 - (d - r0) / (r1 - r0 + 0.001))), false);
      }
  }

  const LAB = {
    // ============ 손 ============

    // 1. 성좌의 성검: 백금 날 가운데 밤하늘 홈에 별자리가 박혀 반짝이고, 빛이 날을 훑어 내려간다.
    //    날개 모양 금 가드 · 색이 도는 홀로그램 보석 · 칼끝 큰 십자광 · 날 둘레를 나선으로 도는 별가루
    xastralblade: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K, S = '#f6f8ff', s = '#b9c4de', N = '#1c1f5c', n = '#2c3590';
        const gem = `hsl(${Math.round((t * 70) % 360)},95%,66%)`;
        const m = { K, Y: '#ffd65a', y: '#c98f1c', W: '#fff6c8', R: gem, V: '#4a2a7a' };
        if (a.curled) {
          const y = GROUND - 2, x0 = a.right + 2;
          this.pattern(['.K', 'KY', 'RY', 'KY', '.K'], x0, y - 2, m); // 가드 (세로)
          this.px(x0 - 1, y, m.V);
          for (let x = x0 + 2; x <= x0 + 9; x++) {
            const tip = x === x0 + 9;
            this.px(x, y - 1, tip ? K : S);
            this.px(x, y, tip ? S : (x + Math.floor(t * 3)) % 4 === 0 ? '#ffffff' : N);
            this.px(x, y + 1, tip ? K : s);
            if (!tip) { this.px(x, y - 2, K); this.px(x, y + 2, K); }
          }
          this.px(x0 + 10, y, K);
          for (let x = x0 + 2; x <= x0 + 9; x++) this.px(x, y - 3, `rgba(180,210,255,${A(0.25 + 0.15 * Math.sin(t * 3 + x))})`, false);
          if (t % 1.6 < 0.5) glint(this, x0 + 10, y - 1, 2, 0.9);
          return;
        }
        const x = a.right + 4, tipY = a.my - 23, bot = a.my + 1, len = bot - tipY;
        const spiral = (front) => {
          for (let i = 0; i < 4; i++) {
            const p = (t * 0.45 + i / 4) % 1;
            const an = t * 3 + i * 1.6;
            if ((Math.cos(an) > 0) !== front) continue;
            const yy = Math.round(bot - p * len), xx = Math.round(x + Math.sin(an) * 4);
            const al = (p < 0.15 ? p / 0.15 : 1 - p) * (front ? 1 : 0.55);
            if (front && al > 0.5) glint(this, xx, yy, 1, al, [200, 225, 255]);
            else this.px(xx, yy, rgb([220, 235, 255], al), false);
          }
        };
        // 날 둘레 푸른 빛
        const pulse = 0.75 + 0.25 * Math.sin(t * 3);
        for (let y = tipY + 1; y <= bot; y++) {
          const k = Math.min(1, (y - tipY) / 4);
          for (const [d, f] of [[3, 0.32], [4, 0.14]]) {
            this.px(x - d, y, `rgba(170,205,255,${A(f * k * pulse)})`, false);
            this.px(x + d, y, `rgba(170,205,255,${A(f * k * pulse)})`, false);
          }
        }
        spiral(false);
        // 날
        const sweep = (t % 2.4) / 0.9;
        const sy = tipY + sweep * len;
        const stars = [5, 9, 12, 16, 20];
        for (let y = tipY; y <= bot; y++) {
          const j = y - tipY;
          const lit = sweep < 1 && Math.abs(y - sy) <= 1;
          if (j === 0) { this.px(x, y, K); continue; }
          if (j === 1) { this.px(x - 1, y, K); this.px(x, y, lit ? '#ffffff' : S); this.px(x + 1, y, K); continue; }
          this.px(x - 2, y, K);
          this.px(x - 1, y, lit ? '#ffffff' : S);
          this.px(x + 1, y, lit ? '#e8f0ff' : s);
          this.px(x + 2, y, K);
          const si = stars.indexOf(j);
          if (j === 2) this.px(x, y, '#ffffff');
          else if (si >= 0) this.px(x, y, tw(t, si * 2, 3.2) > 0.55 ? '#ffffff' : '#9fc4ff');
          else this.px(x, y, stars.includes(j - 1) || stars.includes(j + 1) ? n : N);
        }
        // 별자리 점이 밝을 때 홈 밖으로 빛이 샌다
        stars.forEach((j, i) => {
          const b = tw(t, i * 2, 3.2);
          if (b > 0.8) { this.px(x - 3, tipY + j, `rgba(220,235,255,${A(b - 0.3)})`, false); this.px(x + 3, tipY + j, `rgba(220,235,255,${A(b - 0.3)})`, false); }
        });
        // 날개 가드 · 손잡이 · 별 머리
        this.pattern(['KY.......YK', 'KYYK...KYYK', '.KyYYRYYyK.', '..KKyyyKK..'], x - 5, a.my, m);
        this.pattern(['.KVK.', '.KYK.', '.KVK.', 'K.Y.K', '.YWY.', '..Y..'], x - 2, a.my + 4, m);
        heldPaw(this, g, x, a.my + 5);
        spiral(true);
        // 칼끝 큰 십자광 (늘 켜져 있고 숨 쉬듯 커졌다 작아진다)
        const fl = tw(t, 0, 2.6);
        glint(this, x, tipY - 1, 2 + Math.round(fl * 2), 0.75 + 0.25 * fl, [200, 225, 255]);
      },
    },

    // 2. 은하의 지팡이: 흑요석 지팡이 끝 금빛 초승달 고리 안에서 나선 은하가 빙글빙글 돈다.
    //    은하 팔 색이 분홍↔하늘로 흐르고, 별가루가 지팡이를 타고 흘러내린다
    xgalaxystaff: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K;
        const galaxy = (cx, cy, R, solid) => {
          for (let y = Math.floor(cy - R); y <= cy + R; y++)
            for (let x = Math.floor(cx - R); x <= cx + R; x++) {
              const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
              const rr = Math.hypot(dx, dy) / R;
              if (rr > 1) continue;
              const ang = Math.atan2(dy, dx);
              const arm = Math.pow(Math.max(0, Math.cos(2 * (ang + rr * 4.4 - t * 1.5))), 2) * (1 - rr * 0.55);
              const core = Math.exp(-rr * rr * 9);
              const armCol = mix([255, 110, 210], [110, 210, 255], 0.5 + 0.5 * Math.sin(ang + t * 0.8));
              let col = mix([12, 8, 36], armCol, arm * 1.25);
              col = mix(col, [255, 250, 225], core * 1.2);
              this.px(x, y, hex(col), solid);
            }
        };
        if (a.curled) {
          const y = GROUND - 1, x0 = a.right + 2;
          for (let x = x0; x <= x0 + 4; x++) { this.px(x, y - 1, K); this.px(x, y, x % 3 === 0 ? '#ffd65a' : '#3a2a5e'); this.px(x, y + 1, K); }
          glow(this, x0 + 7.5, y - 2, 2.6, 5, [180, 130, 255], 0.3);
          galaxy(x0 + 7.5, y - 2, 2.6, true);
          for (let k = 0; k < 10; k++) {
            const an = (k / 10) * Math.PI * 2;
            if (Math.sin(an) > 0.5) continue;
            this.px(Math.round(x0 + 7.5 + Math.cos(an) * 3.3), Math.round(y - 2 + Math.sin(an) * 3.3), k % 2 ? '#c98f1c' : '#ffd65a');
          }
          return;
        }
        const x = a.right + 3, ox = x + 0.5, oy = a.top - 17, R = 5.2;
        // 바깥 빛무리 · 소용돌이 먼지
        const br = 0.8 + 0.2 * Math.sin(t * 2.2);
        glow(this, ox, oy, R + 0.8, R + 4.5, [190, 120, 255], 0.35 * br);
        for (let i = 0; i < 10; i++) {
          const rr = R + 1.8 + hash(i) * 2.6;
          const an = hash(i + 7) * 6.28 + t * (1.6 - hash(i) * 0.6);
          const b = tw(t, i, 4);
          this.px(Math.round(ox + Math.cos(an) * rr), Math.round(oy + Math.sin(an) * rr * 0.9), i % 3 ? `rgba(255,190,240,${A(0.3 + b * 0.6)})` : `rgba(170,230,255,${A(0.3 + b * 0.6)})`, false);
        }
        // 지팡이 (흑요석 + 금띠)
        const top = a.top - 11;
        for (let y = top; y <= GROUND - 1; y++) {
          const band = (y - top) % 6 === 0;
          this.px(x - 1, y, K);
          this.px(x, y, band ? '#ffd65a' : (y + Math.floor(t * 6)) % 9 === 0 ? '#b89cff' : '#4a3678');
          this.px(x + 1, y, band ? '#c98f1c' : '#1c1336');
          this.px(x + 2, y, K);
        }
        this.pattern(['KYYK', '.KK.'], x - 1, GROUND - 1, { K, Y: '#ffd65a' });
        // 은하
        galaxy(ox, oy, R, true);
        // 금빛 초승달 고리 (위가 트였다)
        for (let y = Math.floor(oy - R - 2); y <= oy + R + 2; y++)
          for (let xx = Math.floor(ox - R - 2); xx <= ox + R + 2; xx++) {
            const dx = xx + 0.5 - ox, dy = y + 0.5 - oy;
            const d = Math.hypot(dx, dy);
            const ang = Math.atan2(dy, dx);
            const open = Math.abs(ang + Math.PI / 2) < 0.62;
            if (open) continue;
            if (d > R + 0.3 && d <= R + 1.3) this.px(xx, y, dx + dy < 0 ? '#ffe9a0' : dy > 2 ? '#c98f1c' : '#ffd65a');
            else if (d > R + 1.3 && d <= R + 2.1) this.px(xx, y, K);
          }
        // 고리 끝 보석
        for (const sx of [-1, 1]) {
          const an = -Math.PI / 2 + sx * 0.7;
          const gx = Math.round(ox + Math.cos(an) * (R + 1.2) - 0.5), gy = Math.round(oy + Math.sin(an) * (R + 1.2) - 0.5);
          this.pattern(['.K.', 'KPK', '.K.'], gx - 1, gy - 1, { K, P: sx < 0 ? '#ff7ad8' : '#6fdcff' });
        }
        // 은하 한가운데 반짝
        glint(this, ox - 0.5, oy - 0.5, 1 + Math.round(tw(t, 1, 3) * 2), 0.9, [255, 230, 250]);
        // 별가루가 지팡이를 타고 흘러내린다
        for (let i = 0; i < 5; i++) {
          const p = (t * 0.55 + i / 5) % 1;
          this.px(Math.round(x + 0.5 + Math.sin(t * 2 + i * 2.3) * 2.5), Math.round(oy + R + 2 + p * 16), i % 2 ? `rgba(255,200,245,${A(1 - p)})` : `rgba(180,235,255,${A(1 - p)})`, false);
        }
        heldPaw(this, g, x, a.cy + 1);
      },
    },

    // 3. 천상의 창: 빛나는 수정 창날 · 금빛 날개 장식 · 휘날리는 진홍 리본. 창날 둘레로 광륜이 돌고 빛살이 뻗는다
    xheavenspear: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K;
        const m = { K, W: '#ffffff', c: '#bfe4ff', b: '#7fb8f0', Y: '#ffd65a', y: '#c98f1c', F: '#ffffff', f: '#cfd8ea' };
        if (a.curled) {
          const y = GROUND - 1, x0 = a.right + 2;
          for (let x = x0; x <= x0 + 2; x++) { this.px(x, y - 1, K); this.px(x, y, x % 3 === 0 ? "#ffd65a" : "#fff1c0"); this.px(x, y + 1, K); }
          // 날개 장식 + 수정 창날 (오른쪽을 향해 누웠다)
          this.pattern(["F.", "fF", ".Y", "fF", "F."], x0 + 2, y - 2, m);
          this.pattern(['..KKK..', '.KWWWK.', 'KWWWWcK', '.KccbK.', '..KKK..'], x0 + 4, y - 2, m);
          this.px(x0 + 11, y, K);
          if (t % 1.4 < 0.45) glint(this, x0 + 11, y, 2, 0.9, [200, 230, 255]);
          return;
        }
        const x = a.right + 3, tipY = a.top - 21, sock = tipY + 10;
        const hy = tipY + 6;
        // 빛살 (창날 가운데서 8방향, 돌면서 길이가 출렁)
        for (let k = 0; k < 8; k++) {
          const an = (k * Math.PI) / 4 + t * 0.4;
          const L = 6 + 2.5 * Math.sin(t * 3 + k * 1.9) + (k % 2 ? 0 : 2);
          for (let d = 3; d <= L; d++) this.px(Math.round(x + Math.cos(an) * d), Math.round(hy + Math.sin(an) * d), `rgba(255,240,170,${A(0.45 * (1 - d / (L + 1)))})`, false);
        }
        const halo = (front) => {
          for (let i = 0; i < 28; i++) {
            const an = (i / 28) * Math.PI * 2 + t * 1.2;
            if ((Math.sin(an) > 0) !== front) continue;
            const b = 0.5 + 0.5 * Math.cos(an * 2 - t * 3);
            this.px(Math.round(x + Math.cos(an) * 6), Math.round(hy + 1 + Math.sin(an) * 1.6), `rgba(255,232,140,${A(0.35 + 0.6 * b)})`, false);
          }
        };
        halo(false);
        // 리본 (창목에서 왼쪽으로 펄럭)
        for (let k = 0; k <= 10; k++) {
          const rx = x - 1 - k, ry = Math.round(sock + 2 + k * 0.35 + Math.sin(t * 4.5 - k * 0.7) * (0.3 + k * 0.12));
          const fork = k === 10;
          this.px(rx, ry, fork ? '#ffd65a' : '#ff5a6e');
          this.px(rx, ry + 1, fork ? '#ffd65a' : '#c81e3a');
          if (k > 1 && !fork) this.px(rx, ry + 2, k % 2 ? '#7a0e20' : '#c81e3a');
          if (fork) { this.px(rx - 1, ry - 1, '#ff5a6e'); this.px(rx - 1, ry + 2, '#c81e3a'); }
        }
        // 자루
        for (let y = sock; y <= GROUND; y++) {
          this.px(x - 1, y, K);
          this.px(x, y, (y - sock) % 5 === 4 ? '#ffd65a' : (y + Math.floor(t * 8)) % 11 === 0 ? '#ffffff' : '#fff1c0');
          this.px(x + 1, y, K);
        }
        // 창날 (수정 · 가운데 줄이 맥동)
        const core = tw(t, 0, 4) > 0.5 ? '#ffffff' : '#e8f6ff';
        this.pattern(['...K...', '..KWK..', '..KWcK.', '.KWWcK.', '.KWWcbK', 'KWWWccK', 'KWWWcbK', '.KWWcK.', '..KWcK.', '...K...'], x - 3, tipY, m);
        for (let j = 1; j <= 8; j++) this.px(x, tipY + j, core);
        // 금빛 날개 장식
        const fl = Math.round(Math.sin(t * 3));
        this.pattern(['F...........F', 'fF.........Ff', '.fFF.....FFf.', '..ffFYKYFff..', '....fYYYf....', '.....KyK.....'], x - 6, sock - 1 + 0, m);
        this.px(x - 6, sock - 2 + fl, '#ffffff');
        this.px(x + 6, sock - 2 + fl, '#ffffff');
        halo(true);
        heldPaw(this, g, x, a.cy + 1);
        glint(this, x, tipY - 1, 2 + Math.round(tw(t, 2, 2.8) * 2), 0.95, [255, 240, 190]);
      },
    },

    // 4. 시간의 모래시계: 앞발 위에 떠 있는 금·백금 모래시계. 금모래가 흐르고, 다 흐르면 빙글 뒤집힌다.
    //    둘레엔 12눈금 시계 고리가 천천히 돌고, 빛 한 점이 초침처럼 고리를 돈다
    xchronoglass: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K;
        const P = 6, ph = t % P, flipping = ph > P - 0.45;
        const topAmt = clamp01(1 - ph / (P - 0.45));
        const drawGlass = (cx, cy, amt, small) => {
          // 판 · 기둥
          const H = small ? 4 : 6, W = small ? 3 : 4;
          for (let dx = -W; dx <= W; dx++) {
            const e = Math.abs(dx) === W;
            this.px(cx + dx, cy - H, e ? K : '#ffd65a');
            this.px(cx + dx, cy - H + 1, e ? K : '#c98f1c');
            this.px(cx + dx, cy + H - 1, e ? K : '#ffd65a');
            this.px(cx + dx, cy + H, e ? K : '#c98f1c');
          }
          for (let dx = -W + 1; dx <= W - 1; dx++) { this.px(cx + dx, cy - H - 1, K); this.px(cx + dx, cy + H + 1, K); }
          for (let dy = -H + 2; dy <= H - 2; dy++) {
            this.px(cx - W, cy + dy, dy === 0 ? '#ffd65a' : '#eef2fa');
            this.px(cx + W, cy + dy, dy === 0 ? '#ffd65a' : '#9aa4ba');
          }
          // 유리 + 모래
          const rows = H - 2; // 위 칸 수
          const half = (dy) => Math.max(0, Math.round(((Math.abs(dy)) / rows) * (W - 1.4)));
          const topRows = Math.round(amt * (rows - 1));
          const botRows = Math.round((1 - amt) * (rows - 1));
          for (let dy = -rows; dy <= rows; dy++) {
            const w = half(dy);
            for (let dx = -w; dx <= w; dx++) {
              let col = 'rgba(200,240,255,0.35)';
              const edge = Math.abs(dx) === w && w > 0;
              if (dy < 0 && -dy <= topRows) col = edge ? '#e0a020' : '#ffd65a';
              if (dy > 0 && dy > rows - botRows) col = edge ? '#e0a020' : '#ffd65a';
              if (dy > 0 && dy === rows - botRows && Math.abs(dx) <= 0 && botRows > 0) col = '#ffd65a';
              if (col[0] === 'r' && edge) col = 'rgba(220,250,255,0.85)';
              this.px(cx + dx, cy + dy, col, col[0] !== 'r');
            }
          }
          // 흐르는 모래줄기 · 반짝
          if (amt > 0.02 && !small) for (let dy = 0; dy <= rows - botRows; dy++) this.px(cx, cy + dy, (dy + Math.floor(t * 12)) % 3 ? '#ffd65a' : '#ffffff');
          this.px(cx - W + 1, cy - rows + 1, '#ffffff');
        };
        if (a.curled) {
          const cx = a.right + 6, cy = GROUND - 5;
          drawGlass(cx, cy, topAmt, true);
          return;
        }
        const cx = a.right + 5, cy = a.top - 9;
        // 시계 고리
        const RR = 8.5;
        glow(this, cx + 0.5, cy + 0.5, 6.5, RR + 2, [255, 214, 120], 0.16 + 0.06 * Math.sin(t * 2));
        for (let i = 0; i < 60; i++) {
          const an = (i / 60) * Math.PI * 2;
          this.px(Math.round(cx + Math.cos(an) * RR), Math.round(cy + Math.sin(an) * RR), 'rgba(255,225,150,0.35)', false);
        }
        const hand = t * 1.3;
        for (let k = 0; k < 12; k++) {
          const an = (k / 12) * Math.PI * 2 + t * 0.25;
          const lit = Math.max(0, Math.cos(an - hand));
          const x = Math.round(cx + Math.cos(an) * RR), y = Math.round(cy + Math.sin(an) * RR);
          const big = k % 3 === 0;
          this.px(x, y, lit > 0.9 ? '#ffffff' : big ? '#ffd65a' : '#e8c27a', false);
          if (big) this.px(Math.round(cx + Math.cos(an) * (RR + 1)), Math.round(cy + Math.sin(an) * (RR + 1)), lit > 0.8 ? '#fff6c8' : 'rgba(255,214,90,0.7)', false);
        }
        for (let q = 0; q < 6; q++) {
          const an = hand - q * 0.13;
          this.px(Math.round(cx + Math.cos(an) * RR), Math.round(cy + Math.sin(an) * RR), q ? `rgba(180,240,255,${A(0.9 - q * 0.15)})` : '#ffffff', false);
        }
        // 모래시계 (뒤집힐 땐 옆으로 누운 한 장면)
        const by = cy + Math.round(Math.sin(t * 1.8) * 0.6);
        if (flipping) {
          this.pattern(['KK.........KK', 'KYKKKKKKKKKYK', 'KYcc.....ccYK', 'KYccc...cccYK', 'KYcccc.ccccYK', 'KYccc...cccYK', 'KYcc.....ccYK', 'KYKKKKKKKKKYK', 'KK.........KK'], cx - 6, by - 4, { K, Y: '#ffd65a', c: 'rgba(200,240,255,0.5)' });
          glow(this, cx + 0.5, by + 0.5, 0, 7, [255, 255, 255], 0.4 * (1 - (ph - (P - 0.45)) / 0.45));
        } else drawGlass(cx, by, topAmt, false);
        // 앞발에서 모래시계로 오르는 빛 알갱이
        const px = a.right + 2;
        for (let i = 0; i < 4; i++) {
          const p = (t * 0.8 + i / 4) % 1;
          this.px(Math.round(px + (cx - px) * p + Math.sin(t * 4 + i) * 0.8), Math.round(a.cy - 1 - (a.cy - 1 - (by + 8)) * p), `rgba(255,228,140,${A(1 - p * 0.6)})`, false);
        }
        heldPaw(this, g, px, a.cy + 1);
        if (topAmt < 0.08 && !flipping) glint(this, cx, by, 3, 0.9);
      },
    },

    // 5. 행성 구슬: 금 받침 위에 떠 있는 수정 구슬. 구슬 속 깊은 우주에 고리 행성이 돌고,
    //    바깥으로 달 두 개가 기울어진 궤도를 앞뒤로 돈다
    xplanetorb: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K;
        const orb = (ox, oy, R, solid) => {
          for (let y = Math.floor(oy - R); y <= oy + R; y++)
            for (let x = Math.floor(ox - R); x <= ox + R; x++) {
              const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
              const d = Math.hypot(dx, dy) / R;
              if (d > 1) continue;
              let col = mix([30, 20, 80], [6, 6, 26], d);
              if (d > 0.78) col = dx + dy < 0 ? [190, 235, 255] : [130, 90, 220];
              this.px(x, y, hex(col), solid);
            }
          // 속 별
          for (let i = 0; i < 6; i++) {
            const an = hash(i) * 6.28 + t * 0.2, rr = (0.3 + hash(i + 4) * 0.4) * R;
            if (tw(t, i * 3, 2.5) > 0.6) this.px(Math.round(ox - 0.5 + Math.cos(an) * rr), Math.round(oy - 0.5 + Math.sin(an) * rr), '#ffffff', solid);
          }
        };
        const planet = (px, py, big) => {
          const tilt = 0.32 + Math.sin(t * 0.6) * 0.12;
          const ring = (front) => {
            for (let dx = -(big ? 4 : 3); dx <= (big ? 4 : 3); dx++) {
              if (Math.abs(dx) < 2) continue;
              if ((dx > 0) !== front) continue;
              this.px(px + dx, Math.round(py + dx * tilt), Math.abs(dx) === (big ? 4 : 3) ? '#ffe9b0' : '#e0b870');
            }
          };
          ring(false);
          const band = Math.floor(t * 3);
          this.pattern(['.OO.', 'OooO', 'OOOo', '.oo.'], px - 2, py - 2, { O: (band % 2 ? '#ffb45a' : '#ffc878'), o: '#c8742a' });
          this.px(px - 1, py - 1, '#fff0c8');
          ring(true);
        };
        if (a.curled) {
          const ox = a.right + 6.5, oy = GROUND - 3.5;
          glow(this, ox, oy, 3.5, 6, [150, 200, 255], 0.25);
          orb(ox, oy, 3.6, true);
          this.pattern(['K.....K', 'KYYYYYK', '.KKKKK.'], Math.round(ox - 3.5), GROUND - 1, { K, Y: '#ffd65a' });
          if (tw(t, 0, 2) > 0.7) this.px(Math.round(ox - 1.5), Math.round(oy - 1.5), '#ffffff');
          return;
        }
        const ox = a.right + 4.5, oy = a.top - 8 + Math.sin(t * 1.6) * 0.7, R = 5;
        const moons = (front) => {
          const list = [{ sp: 1.3, ph: 0, rx: 9, ry: 2.6, s: 2 }, { sp: 2.1, ph: 2.4, rx: 7, ry: 2, s: 1 }];
          for (const mo of list) {
            const an = t * mo.sp + mo.ph;
            if ((Math.sin(an) > 0) !== front) continue;
            const mx = Math.round(ox - 0.5 + Math.cos(an) * mo.rx), my = Math.round(oy - 0.5 + Math.sin(an) * mo.ry - Math.cos(an) * 1.2);
            for (let q = 1; q <= 3; q++) {
              const ta = an - q * 0.18;
              this.px(Math.round(ox - 0.5 + Math.cos(ta) * mo.rx), Math.round(oy - 0.5 + Math.sin(ta) * mo.ry - Math.cos(ta) * 1.2), `rgba(200,230,255,${A((front ? 0.6 : 0.3) - q * 0.15)})`, false);
            }
            if (mo.s === 2) this.pattern(['WS', 'Ss'], mx, my, { W: front ? '#ffffff' : '#c8ccd8', S: front ? '#c8ccd8' : '#8a90a0', s: front ? '#8a90a0' : '#5a6070' });
            else this.px(mx, my, front ? '#ff8a6a' : '#b05a48');
          }
        };
        // 궤도선 (뒤 반)
        for (let i = 0; i < 40; i++) {
          const an = (i / 40) * Math.PI * 2;
          if (Math.sin(an) > 0 || i % 2) continue;
          this.px(Math.round(ox - 0.5 + Math.cos(an) * 9), Math.round(oy - 0.5 + Math.sin(an) * 2.6 - Math.cos(an) * 1.2), 'rgba(200,230,255,0.3)', false);
        }
        glow(this, ox, oy, R - 0.2, R + 3.5, [140, 200, 255], 0.3 + 0.12 * Math.sin(t * 2.5));
        moons(false);
        // 받침 · 자루
        const sx = Math.round(ox - 0.5);
        for (let y = Math.round(oy + R + 1); y <= a.cy; y++) { this.px(sx - 1, y, K); this.px(sx, y, y % 2 ? '#ffd65a' : '#c98f1c'); this.px(sx + 1, y, K); }
        orb(ox, oy, R, true);
        planet(Math.round(ox - 0.5), Math.round(oy - 0.5), true);
        // 하이라이트
        this.pattern(['.W', 'WW', 'W.'], Math.round(ox - R + 1), Math.round(oy - R + 1.5), { W: '#ffffff' });
        // 금 받침 (아래 반달)
        for (let y = Math.floor(oy); y <= oy + R + 2; y++)
          for (let x = Math.floor(ox - R - 2); x <= ox + R + 2; x++) {
            const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
            if (y + 0.5 - oy < 1.5) continue;
            if (d > R && d <= R + 1) this.px(x, y, x + 0.5 < ox ? '#ffe9a0' : '#ffd65a');
            else if (d > R + 1 && d <= R + 1.8) this.px(x, y, K);
          }
        moons(true);
        heldPaw(this, g, sx, a.cy + 1);
        if (tw(t, 5, 1.7) > 0.85) glint(this, ox + 2, oy - R, 2, 0.9, [200, 230, 255]);
      },
    },

    // ============ 효과 ============

    // 6. 성운 소용돌이: 고양이 뒤로 세 갈래 나선 성운이 천천히 휘감아 돌고, 색이 보라·분홍·청록으로 흐른다.
    //    성운 속 별들이 소용돌이를 따라 돌며 반짝
    xnebulaaura: {
      back(g, a, c, t) {
        const ox = a.cx - 0.5, oy = a.cy - 8, RX = 18, RY = 15;
        const V = [130, 70, 255], M = [255, 80, 200], C = [70, 220, 255];
        for (let y = Math.floor(oy - RY); y <= GROUND + 1; y++)
          for (let x = Math.floor(ox - RX); x <= ox + RX; x++) {
            const nx = (x + 0.5 - ox) / RX, ny = (y + 0.5 - oy) / RY;
            const r = Math.hypot(nx, ny);
            if (r > 1) continue;
            const ang = Math.atan2(ny, nx);
            const sw = ang + r * 5.5 - t * 0.9;
            const arm = 0.5 + 0.5 * Math.cos(3 * sw);
            const fine = 0.5 + 0.5 * Math.sin(sw * 7 + r * 9 + t * 1.3);
            const v = Math.pow(arm, 2.2) * (0.7 + 0.3 * fine);
            const al = v * Math.pow(1 - r, 0.5) * 0.85 + (1 - r) * 0.08;
            if (al < 0.07) continue;
            const hk = 0.5 + 0.5 * Math.sin(ang + r * 3 - t * 0.6);
            let col = ramp([V, M, C], hk);
            if (r < 0.3) col = mix(col, [255, 240, 255], (0.3 - r) / 0.3);
            this.px(x, y, rgb(col, al), false);
          }
        for (let i = 0; i < 18; i++) {
          const r0 = 0.3 + hash(i) * 0.65;
          const an = hash(i + 20) * Math.PI * 2 + t * (0.5 / (0.4 + r0));
          const x = ox + Math.cos(an) * r0 * RX, y = oy + Math.sin(an) * r0 * RY;
          const b = tw(t, i * 3, 1.5 + hash(i + 2) * 2);
          if (b > 0.82) glint(this, x, y, 1 + (i % 3 === 0 ? 1 : 0), b, [220, 200, 255]);
          else this.px(Math.round(x), Math.round(y), `rgba(255,255,255,${A(0.3 + b * 0.5)})`, false);
        }
      },
      front(g, a, c, t) {
        // 몸 앞을 스쳐 지나가는 별먼지 (얼굴은 피한다)
        for (let i = 0; i < 6; i++) {
          const an = t * 0.9 + (i * Math.PI * 2) / 6;
          if (Math.sin(an) < 0.1) continue;
          const x = Math.round(a.cx - 0.5 + Math.cos(an) * 13), y = Math.round(a.cy - 2 + Math.sin(an) * 4 + Math.cos(an * 2) * 2);
          if (inFace(a, x, y, 1)) continue;
          const col = i % 2 ? [255, 160, 230] : [140, 230, 255];
          glint(this, x, y, 1, 0.85, col);
        }
      },
    },

    // 7. 태양이 된 고양이: 머리 둘레 얇은 금빛 고리와 또렷한 빛살(태양 문장), 행성 셋이 기울어진 궤도를 앞뒤로 돈다
    //    (붉은 별 · 구름 낀 푸른 별과 달 · 고리 행성)
    xsolarsystem: {
      back(g, a, c, t) { this._xsolar(a, t, false); },
      front(g, a, c, t) { this._xsolar(a, t, true); },
    },

    // 8. 신성 강림: 3초마다 하늘이 열리며 하얀 빛기둥이 쾅 내려꽂히고, 발밑 이중 룬 고리가 서로 반대로 돌며
    //    충격파가 퍼진다. 룬 글자들이 빛을 내며 떠오른다
    xdivinepillar: {
      back(g, a, c, t) { this._xpillar(a, t, false); },
      front(g, a, c, t) { this._xpillar(a, t, true); },
    },

    // 9. 블랙홀: 머리 위에 검은 사건의 지평선과 불타는 강착원반. 원반이 회전하며 왼쪽이 더 밝고,
    //    위로 푸른 제트가 뿜어지며, 주변 빛 알갱이가 나선으로 빨려 들어간다. 중력파가 주기적으로 퍼진다
    xblackhole: {
      back(g, a, c, t) { this._xbh(a, t, false); },
      front(g, a, c, t) { this._xbh(a, t, true); },
    },

    // 10. 별의 왕관: 하늘 사방에서 별이 모여들어 머리 위 빛의 왕관이 번쩍 빛나고, 위로 빛기둥이 솟으며
    //     별무리가 왕관 둘레를 돈다 (6초 한 바퀴, 자세한 건 PR._xcrown)
    xstarcrownfall: {
      back(g, a, c, t) { this._xcrown(a, t, false); },
      front(g, a, c, t) { this._xcrown(a, t, true); },
    },

    // ============ 2차 시안 (2026-10-09): 손 3 · 효과 3 ============

    // 11. 달의 낫: 흑요석 자루 끝에 은빛 초승달 날. 날 뒤로 나머지 달이 유령처럼 희미하게 비치고,
    //     빛 한 점이 날 끝을 따라 미끄러지며, 날끝에서 달빛 안개가 흘러내린다
    xmoonscythe: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K;
        if (a.curled) {
          const y = GROUND - 1, x0 = a.right + 2;
          for (let x = x0; x <= x0 + 5; x++) { this.px(x, y - 1, K); this.px(x, y, x % 3 === 0 ? '#c8d4ee' : '#2a2440'); this.px(x, y + 1, K); }
          this.pattern(['..KKK', '.KWWK', 'KWcK.', 'KWcK.', '.KWWK', '..KKK'], x0 + 6, y - 4, { K, W: '#ffffff', c: '#9fb6ea' });
          glow(this, x0 + 8, y - 1, 2, 5, [170, 200, 255], 0.25);
          return;
        }
        const x = a.right + 3, by = a.top - 12;
        const c1 = [x - 5, by + 1.6], r1 = 6.6, c2 = [x - 5.4, by + 4.7], r2 = 6.1;
        const inside = (px, py) => {
          const X = px + 0.5, Y = py + 0.5;
          return Math.hypot(X - c1[0], Y - c1[1]) <= r1 && Math.hypot(X - c2[0], Y - c2[1]) > r2 && X <= x + 0.9;
        };
        // 나머지 달 (희미한 원판) + 달무리
        glow(this, c1[0], c1[1], r1 - 0.5, r1 + 3, [170, 200, 255], 0.28 + 0.08 * Math.sin(t * 2));
        for (let y = Math.floor(c1[1] - r1); y <= c1[1] + r1; y++)
          for (let xx = Math.floor(c1[0] - r1); xx <= c1[0] + r1; xx++)
            if (Math.hypot(xx + 0.5 - c1[0], y + 0.5 - c1[1]) <= r1 - 0.3 && !inside(xx, y)) this.px(xx, y, rgb([200, 218, 255], 0.16 + 0.1 * (1 - Math.hypot(xx + 0.5 - c1[0], y + 0.5 - c1[1]) / r1)), false);
        // 자루
        for (let y = by; y <= GROUND; y++) {
          this.px(x - 1, y, K);
          this.px(x, y, (y - by) % 5 === 4 ? '#c8d4ee' : (y + Math.floor(t * 7)) % 10 === 0 ? '#6a5aa8' : '#2a2440');
          this.px(x + 1, y, K);
        }
        // 초승달 날
        const sh = (t * 0.7) % 1.6; // 0~1 동안 빛이 날 끝을 미끄러진다
        this.shape(inside, [x - 13, by - 6, x + 1, by + 6], (px, py) => {
          const d = Math.hypot(px + 0.5 - c2[0], py + 0.5 - c2[1]) - r2;
          const an = Math.atan2(py + 0.5 - c1[1], px + 0.5 - c1[0]);
          const k = (an + Math.PI) / Math.PI; // 왼쪽 끝 0 → 오른쪽 1 (위 반원)
          if (sh < 1 && Math.abs(k - sh) < 0.07) return '#ffffff';
          if (hash(px * 13 + py * 7) > 0.86 && d > 0.8) return '#b4c6ee';
          return d > 1.6 ? '#ffffff' : d > 0.8 ? '#dce8ff' : '#9fb6ea';
        }, K);
        // 자루 끝 보석
        this.pattern(['.K.', 'KPK', '.K.'], x - 1, by - 1, { K, P: `hsl(${Math.round(250 + 30 * Math.sin(t * 2))},90%,72%)` });
        // 날끝에서 흘러내리는 달빛 안개
        const tipX = c1[0] - r1 + 0.8, tipY = c1[1] + 0.5;
        for (let i = 0; i < 6; i++) {
          const p = (t * 0.45 + i / 6) % 1;
          this.px(Math.round(tipX + Math.sin(t * 1.5 + i * 2) * 1.5 - p * 2), Math.round(tipY + p * 9), rgb([200, 220, 255], 0.65 * (1 - p)), false);
        }
        if (tw(t, 3, 1.9) > 0.8) glint(this, tipX, tipY - 1, 2, 0.9, [200, 220, 255]);
        heldPaw(this, g, x, a.cy + 1);
      },
    },

    // 12. 천상의 리라 (디벨롭 2026-10-09): 몸집만 한 큰 금빛 리라. 바깥으로 말린 두 뿔 · 보석 줄감개 가로대 ·
    //     진주빛 울림통. 빛 줄 셋이 차례로 튕겨져 떨리면 울림통 구멍이 빛나고 음파 고리가 퍼지며,
    //     색색의 음표(8분·16분·잇단)가 나선으로 피어오른다. 뒤로는 금빛 빛살이 은은하게 돈다
    xcelestiallyre: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K;
        const pl = Math.floor(t / 0.42) % 3, env = 1 - (t % 0.42) / 0.42;
        const m = { K, Y: '#ffd65a', y: '#c98f1c', L: '#fff0b0', W: '#fff6e4', w: '#efd7a6', H: rgb(mix([70, 40, 20], [255, 225, 120], env * 0.8), 1) };
        // 15칸 × 19줄: 바깥으로 말린 뿔 · 가로대 · 아래로 갈수록 벌어지는 두 팔 · 진주빛 울림통
        const LYRE = [
          'LL...........yy',
          'KLK.........KyK',
          '.KLK.......KyK.',
          '.KLKKKKKKKKKyK.',
          '.KLYYYYYYYYYyK.',
          '.KLKKKKKKKKKyK.',
          '..KLK.....KyK..',
          '..KLK.....KyK..',
          '.KLK.......KyK.',
          '.KLK.......KyK.',
          'KLK.........KyK',
          'KLK.........KyK',
          'KLK.........KyK',
          'KKKKKKKKKKKKKKK',
          'KWWWWWWWWWWWWwK',
          'KWWwwwHHHwwwwwK',
          'KWwwwwHHHwwwwwK',
          '.KwwwwwwwwwwwK.',
          '..KKKKKKKKKKK..',
        ];
        const SMALL = ['YK.........KY', '.YK.......KY.', '.KYK.....KYK.', '.KYYYYYYYYYK.', 'KYKKKKKKKKKYK', 'KYK.......KYK', 'KYK.......KYK', '.KYK.....KYK.', '..KYK...KYK..', '...KYYRYYK...', '....KKKKK....'];
        if (a.curled) {
          this.pattern(SMALL, a.right + 1, GROUND - 10, { K, Y: '#ffd65a', R: '#ff7ad8' });
          for (let j = 5; j <= 7; j++) for (const sx of [4, 6, 8]) this.px(a.right + 1 + sx, GROUND - 10 + j, 'rgba(220,250,255,0.85)', false);
          if (tw(t, 0, 1.5) > 0.75) glint(this, a.right + 2, GROUND - 11, 1, 0.9);
          return;
        }
        const x0 = a.right - 1, y0 = a.my - 20, cx = x0 + 7.5, cy = y0 + 9;
        // 뒤 빛: 빛무리 + 천천히 도는 가는 금빛 빛살
        glow(this, cx, cy, 5, 13, [255, 226, 140], 0.17 + 0.05 * Math.sin(t * 2));
        for (let k = 0; k < 10; k++) {
          const an = (k / 10) * Math.PI * 2 + t * 0.3;
          const L = 13 + (k % 2 ? -3 : 0) + 1.5 * Math.sin(t * 2.5 + k);
          for (let d = 9; d <= L; d++) {
            const x = Math.round(cx - 0.5 + Math.cos(an) * d), y = Math.round(cy - 0.5 + Math.sin(an) * d);
            if (inFace(a, x, y, 1) || y > GROUND - 1) continue;
            this.px(x, y, rgb([255, 236, 160], 0.4 * (1 - (d - 9) / (L - 8))), false);
          }
        }
        // 음파 고리 (튕길 때마다 울림통 구멍에서 퍼진다)
        const q = 1 - env;
        for (let i = 0; i < 48; i++) {
          const an = (i / 48) * Math.PI * 2;
          const R = 3 + q * 10;
          const x = Math.round(x0 + 7 + Math.cos(an) * R), y = Math.round(y0 + 15.5 + Math.sin(an) * R * 0.7);
          if (inFace(a, x, y, 1)) continue;
          this.px(x, y, rgb([255, 240, 190], 0.55 * env), false);
        }
        this.pattern(LYRE, x0, y0, m);
        // 줄 셋: 가로대에서 울림통까지 살짝 벌어지며 내려온다. 사이 칸은 비워 둔다
        const STR = [[5, 4], [7, 7], [9, 10]];
        const GEMS = ['#6fdcff', '#ff7ad8', '#b89cff'];
        STR.forEach(([top, bot], si) => {
          const hit = pl === si && env > 0.15;
          for (let j = 6; j <= 12; j++) {
            const sx = Math.round(top + ((bot - top) * (j - 6)) / 6);
            const wave = hit && (j + Math.floor(t * 20)) % 2 === 0;
            this.px(x0 + sx, y0 + j, hit ? (wave ? '#ffffff' : '#d8faff') : '#8fe4ff');
          }
          this.px(x0 + top, y0 + 4, GEMS[si]);
          this.px(x0 + bot, y0 + 13, '#ffd65a');
          if (hit && env > 0.6) glint(this, x0 + Math.round((top + bot) / 2), y0 + 9, 1, env, [200, 245, 255]);
        });
        // 울림통 반짝 · 뿔 끝 보석
        if (env > 0.7) glint(this, x0 + 7, y0 + 15, 2, env, [255, 230, 150]);
        for (const [hx, n] of [[x0 + 0.5, 0], [x0 + 13.5, 1]]) {
          const b = tw(t, n * 3, 2.4);
          if (b > 0.55) glint(this, hx, y0 - 1, 1 + (b > 0.85 ? 1 : 0), b, n ? [190, 170, 255] : [120, 220, 255]);
        }
        heldPaw(this, g, a.right + 2, a.my);
        // 음표가 나선으로 피어오른다
        const N8 = ['.XH.', '.X.X', '.X..', 'XX..', 'DX..'];
        const N16 = ['.XH.', '.XXH', '.X.X', 'XX..', 'DX..'];
        const BM = ['.HHHHX', '.XXXXX', '.X...X', 'XX..XX', 'DX..DX'];
        const NOTES = [N8, BM, N16, N8, N16, BM];
        const NC = [[255, 214, 90], [120, 220, 255], [255, 130, 205], [180, 150, 255], [140, 240, 190], [255, 170, 110]];
        for (let i = 0; i < 6; i++) {
          const p = (t * 0.32 + i / 6) % 1;
          const side = i % 2 ? 1 : -1;
          const nx = Math.round(cx + side * (3 + p * 9) + Math.sin(t * 2.2 + i * 2) * 2);
          const ny = Math.round(y0 - 2 - p * 18);
          const al = p < 0.12 ? p / 0.12 : 1 - p * p;
          if (inFace(a, nx, ny, 2)) continue;
          const rows = this.facing < 0 ? mirror(NOTES[i]) : NOTES[i];
          const col = NC[i];
          this.pattern(rows, nx - 2, ny - 2, { X: rgb(col, al), D: rgb(mix(col, [60, 30, 80], 0.45), al), H: rgb([255, 255, 255], al) }, false);
          if (tw(t, i * 1.3, 5) > 0.75) glint(this, nx + (side > 0 ? 3 : -2), ny - 3, 1, al, col);
        }
      },
    },

    // 13. 불사조 깃털: 끝으로 갈수록 붉은빛→금빛→흰빛으로 타오르는 큰 깃털. 가장자리에 불꽃이 너울대고,
    //     깃털 위쪽에 청록 눈무늬, 끝에서 작은 불꽃이 일며 불티가 솟는다
    xphoenixplume: {
      hand: true,
      front(g, a, c, t) {
        const RAMP = [[140, 20, 30], [220, 50, 30], [255, 130, 40], [255, 200, 70], [255, 246, 205]];
        const vane = (s, e) => ramp(RAMP, s * 0.8 + (1 - e) * 0.2);
        if (a.curled) {
          const y = GROUND - 2, x0 = a.right + 2, L = 11;
          for (let xx = x0; xx <= x0 + L; xx++) {
            const s = (xx - x0) / L;
            const w = s < 0.2 ? 0 : 1.8 * Math.pow(Math.sin(Math.PI * Math.min(1, (s - 0.2) / 0.85)), 0.6);
            for (let dy = -2; dy <= 2; dy++) {
              const e = Math.abs(dy) / (w || 1);
              if (w > 0 && e <= 1) this.px(xx, y + dy, hex(vane(s, e)));
              else if (w > 0 && Math.abs(dy) <= w + 1) this.px(xx, y + dy, '#6a1418');
            }
            this.px(xx, y, '#fff1c0');
          }
          for (let i = 0; i < 3; i++) { const p = (t * 0.6 + i / 3) % 1; this.px(Math.round(x0 + 4 + i * 3 + Math.sin(t * 3 + i)), Math.round(y - 3 - p * 6), rgb([255, 160, 60], 1 - p), false); }
          return;
        }
        const x = a.right + 2, base = a.cy, L = 21;
        glow(this, x + 2.5, base - 13, 2, 11, [255, 140, 60], 0.22 + 0.08 * Math.sin(t * 3));
        let eye = null;
        for (let y = base - L; y <= base; y++) {
          const s = (base - y) / L;
          const cxs = x + 0.5 + 3 * s * s;
          const w = s < 0.2 ? 0 : 3.6 * Math.pow(Math.sin(Math.PI * Math.min(1, (s - 0.2) / 0.85)), 0.55);
          if (w > 0) {
            for (let xx = Math.floor(cxs - w - 1.5); xx <= cxs + w + 1.5; xx++) {
              const dx = xx + 0.5 - cxs, e = Math.abs(dx) / w;
              if (e <= 1) {
                let col = vane(s, e);
                if ((xx * 2 + y + (dx > 0 ? 1 : 0)) % 4 === 0) col = mix(col, [110, 15, 20], 0.22);
                if (Math.sin(y * 0.8 + t * 6) > 0.85) col = mix(col, [255, 250, 220], 0.35);
                this.px(xx, y, hex(col));
              } else if (Math.abs(dx) <= w + 1) {
                const fl = Math.sin(t * 12 + y * 1.7 + (dx > 0 ? 0 : 2.1));
                this.px(xx, y, fl > 0.15 ? rgb([255, 170, 60], 0.55 + 0.4 * fl) : '#6a1418', fl <= 0.15);
              }
            }
          }
          this.px(Math.round(cxs - 0.5), y, s < 0.2 ? '#e8d8b0' : '#fff1c0');
          if (!eye && s >= 0.74) eye = [Math.round(cxs - 0.5), y];
        }
        // 눈무늬
        if (eye) this.pattern(['.GG.', 'GCCG', 'GCWG', '.GG.'], eye[0] - 1, eye[1] - 1, { G: '#ffe070', C: '#22c8b8', W: '#c8fff4' });
        // 끝 불꽃
        const tx = x + 3.5, ty = base - L - 1;
        for (let j = 0; j < 5; j++) {
          const q = j / 5;
          const half = Math.max(0, Math.round(1.6 * (1 - q) + Math.sin(t * 11 + j) * 0.5));
          const off = Math.round(Math.sin(t * 8 + j * 0.9) * q * 1.3);
          for (let dx = -half; dx <= half; dx++) this.px(Math.round(tx + dx + off - 0.5), ty - j, rgb(ramp([[255, 255, 230], [255, 210, 80], [255, 110, 40]], q + Math.abs(dx) * 0.25), 0.95 - q * 0.4), false);
        }
        // 불티
        for (let i = 0; i < 7; i++) {
          const p = (t * 0.55 + hash(i + 40)) % 1;
          const sx = x + 1 + hash(i + 41) * 5;
          this.px(Math.round(sx + Math.sin(t * 3 + i) * 1.5 + p * 2), Math.round(base - 8 - hash(i + 42) * 10 - p * 12), rgb(mix([255, 220, 120], [230, 50, 40], p), 1 - p), false);
        }
        heldPaw(this, g, x, a.cy + 1);
      },
    },

    // 14. 차원의 균열: 고양이 뒤 허공이 유리처럼 비스듬히 갈라지고, 틈 사이로 무지갯빛 다른 우주가 흐른다.
    //     가장자리는 흰빛으로 달아오르고 잔금이 뻗으며, 프리즘 파편들이 빙글 돌며 떠다닌다
    xdimensionrift: {
      back(g, a, c, t) { this._xrift(a, t, false); },
      front(g, a, c, t) { this._xrift(a, t, true); },
    },

    // 15. 수정 성역: 발밑에서 자수정·얼음·장밋빛 수정 기둥이 솟아 고양이를 둘러싼다. 뒤에는 거대한 수정 한 개,
    //     안쪽 빛이 위로 흐르고 광택이 대각선으로 훑고 지나가며, 끝마다 무지갯빛 반짝임
    xcrystalsanctum: {
      back(g, a, c, t) { this._xcrystal(a, t, false); },
      front(g, a, c, t) { this._xcrystal(a, t, true); },
    },

    // 16. 영혼의 잉어: 빛나는 비단잉어 두 마리(홍백 · 황금)가 머리 뒤를 넘어 턱 아래로 고양이 둘레를 헤엄쳐 돈다.
    //     지느러미가 하늘하늘, 꼬리 뒤로 빛 자취와 물방울. 발밑엔 물결이 번진다
    xspiritkoi: {
      back(g, a, c, t) { this._xkoi(a, t, false); },
      front(g, a, c, t) { this._xkoi(a, t, true); },
    },
  };

  const PR = root.PetSprite.PetRenderer.prototype;

  // ---- 태양계 ----
  // (다듬음 2026-10-09) 머리 = 태양. 코로나는 불 얼룩 대신 얇은 금빛 고리 + 짧고 또렷한 빛살 12개(문장처럼).
  // 행성은 셋으로 줄이고 궤도를 화면 안쪽으로 당겼다. 궤도선은 흐린 실선 하나
  PR._xsolar = function (a, t, front) {
    const ox = a.cx - 0.5, oy = a.cy - 3;
    const sun = [a.hx + 0.5, a.ey - 1.5];
    if (!front) {
      glow(this, sun[0], sun[1], 7.5, 12.5, [255, 214, 110], 0.2 + 0.06 * Math.sin(t * 2.4), (x, y) => y > GROUND);
      for (let i = 0; i < 80; i++) {
        const an = (i / 80) * Math.PI * 2;
        const x = Math.round(sun[0] - 0.5 + Math.cos(an) * 9), y = Math.round(sun[1] - 0.5 + Math.sin(an) * 9);
        if (y > GROUND) continue;
        const b = 0.5 + 0.5 * Math.sin(an * 3 - t * 2);
        this.px(x, y, rgb(mix([255, 196, 70], [255, 250, 215], b), 0.85), false);
      }
      for (let k = 0; k < 12; k++) {
        const an = (k / 12) * Math.PI * 2 + t * 0.2;
        const L = (k % 2 ? 1.5 : 3) + Math.max(0, Math.sin(t * 2.5 + k * 1.3)) * 1.5;
        for (let d = 0; d <= L; d++) {
          const r = 10.5 + d;
          const x = Math.round(sun[0] - 0.5 + Math.cos(an) * r), y = Math.round(sun[1] - 0.5 + Math.sin(an) * r);
          if (y > GROUND - 1) continue;
          this.px(x, y, rgb(k % 2 ? [255, 236, 160] : [255, 210, 80], 0.95 * (1 - d / (L + 1.5))), false);
        }
      }
    }
    const pos = (an, R) => [ox + Math.cos(an) * R, oy + Math.sin(an) * R * 0.28 - Math.cos(an) * R * 0.1, Math.sin(an)];
    const ORB = [
      { R: 10.5, sp: 1.3, ph: 0.5, r: 1.6, c: [[255, 226, 160], [250, 120, 70], [150, 45, 40]] },
      { R: 13, sp: 0.85, ph: 2.8, r: 2.1, c: [[215, 255, 245], [70, 165, 235], [25, 65, 130]], moon: true, cloud: true },
      { R: 15.5, sp: 0.55, ph: 4.6, r: 2.3, c: [[250, 238, 255], [190, 150, 235], [90, 60, 140]], ring: true },
    ];
    for (const o of ORB) {
      const n = Math.round(o.R * 7);
      for (let i = 0; i < n; i++) {
        const [x, y, z] = pos((i / n) * Math.PI * 2, o.R);
        const isF = z > 0 && !inFace(a, Math.round(x), Math.round(y));
        if (isF !== front) continue;
        this.px(x, y, `rgba(255,240,200,${front ? 0.22 : 0.14})`, false);
      }
    }
    for (const o of ORB) {
      const an = t * o.sp + o.ph;
      const [px, py, z] = pos(an, o.R);
      const rr = o.r * (1 + z * 0.12);
      const lx = sun[0] - px, ly = sun[1] - py, ll = Math.hypot(lx, ly) || 1;
      const ring = (frontPart) => {
        if (!o.ring) return;
        for (let dx = -4; dx <= 4; dx++) {
          if (Math.abs(dx) < 2) continue;
          if ((dx > 0) !== frontPart) continue;
          const x = Math.round(px - 0.5 + dx), y = Math.round(py - 0.5 + dx * 0.3);
          // 앞쪽 반바퀴의 행성 · 고리는 얼굴 앞으로도 지나간다 (사용자 요청 10-09). 궤도선만 얼굴을 피한다
          if ((z > 0) !== front) continue;
          this.px(x, y, Math.abs(dx) === 4 ? '#fff0c0' : z > 0 ? '#f0c878' : '#b0905a', false);
        }
      };
      ring(false);
      for (let y = Math.floor(py - rr - 1); y <= py + rr + 1; y++)
        for (let x = Math.floor(px - rr - 1); x <= px + rr + 1; x++) {
          const dx = (x + 0.5 - px) / rr, dy = (y + 0.5 - py) / rr;
          const d = Math.hypot(dx, dy);
          if (d > 1) continue;
          if ((z > 0) !== front) continue;
          const lit = (dx * lx + dy * ly) / ll;
          let col = lit > 0.3 ? o.c[0] : lit > -0.4 ? o.c[1] : o.c[2];
          if (o.cloud && Math.floor(x * 1.7 + t * 3) % 4 === 0 && lit > -0.2) col = [245, 250, 255];
          if (z < 0) col = mix(col, [50, 45, 90], 0.25);
          this.px(x, y, hex(col), false);
        }
      ring(true);
      if (o.moon) {
        const ma = t * 3.2;
        const mx = Math.round(px - 0.5 + Math.cos(ma) * 3.4), my = Math.round(py - 0.5 + Math.sin(ma) * 1.3);
        const isF = z > 0 && Math.sin(ma) > -0.6;
        if (isF === front) this.px(mx, my, '#e8ecf5', false);
      }
    }
  };

  // ---- 신성 강림 ----
  const RUNES = [
    ['X.X', 'XXX', '.X.', '.X.'], ['XX.', 'X.X', 'XX.', 'X.X'], ['X..', 'XX.', 'X.X', 'X..'],
    ['.X.', 'X.X', '.X.', 'X.X'], ['XXX', '.X.', 'X.X', 'X.X'], ['X.X', '.X.', 'X.X', 'X..'],
  ];
  PR._xpillar = function (a, t, front) {
    const cx = a.cx - 0.5, gy = GROUND + 0.5;
    const P = 3.2, ph = t % P;
    const dropT = 0.45;
    const yd = ph < dropT ? -2 + (ph / dropT) * (GROUND + 3) : GROUND + 2;
    const hit = ph >= dropT ? Math.exp(-(ph - dropT) * 2.5) : 0;
    // 바닥 타원 위의 점: 뒤 반(위쪽) / 앞 반(아래쪽)
    const ell = (an, rx, ry) => [cx + Math.cos(an) * rx, gy + Math.sin(an) * ry, Math.sin(an) > 0];
    const ringDots = (rx, ry, rot, n, colFn) => {
      for (let i = 0; i < n; i++) {
        const an = (i / n) * Math.PI * 2 + rot;
        const [x, y, f] = ell(an, rx, ry);
        if (f !== front) continue;
        const col = colFn(i);
        if (col) this.px(x, y, col, false);
      }
    };
    if (!front) {
      // 열린 하늘
      glow(this, cx, 11, 0, 11, [255, 250, 225], 0.35 + 0.35 * hit);
      for (let k = 0; k < 10; k++) {
        const an = Math.PI * (0.05 + (k / 9) * 0.9);
        const L = 9 + 3 * Math.sin(t * 2 + k * 1.3);
        for (let d = 3; d <= L; d++) this.px(Math.round(cx + Math.cos(an) * d * 1.4), Math.round(11 - Math.sin(an) * d * 0.5), `rgba(255,240,190,${A(0.4 * (1 - d / (L + 1)))})`, false);
      }
      // 빛기둥
      for (let y = 0; y <= Math.min(GROUND, yd); y++) {
        const half = 5 + y * 0.1 + hit * 2;
        for (let x = Math.floor(cx - half); x <= cx + half; x++) {
          const e = Math.abs(x + 0.5 - cx) / half;
          if (e > 1) continue;
          const core = 1 - e * e;
          const streak = 0.65 + 0.35 * Math.sin(x * 2.3 + y * 0.55 + t * 9);
          const lead = ph < dropT && yd - y < 3 ? 0.5 : 0;
          const al = (0.07 + 0.36 * Math.pow(core, 1.5)) * streak * (1 + hit * 0.7) + lead * core;
          this.px(x, y, rgb(mix([140, 215, 255], [255, 255, 255], core), al), false);
        }
        if (y % 2 === Math.floor(t * 8) % 2) {
          this.px(Math.round(cx - half) - 1, y, 'rgba(160,230,255,0.35)', false);
          this.px(Math.round(cx + half) + 1, y, 'rgba(160,230,255,0.35)', false);
        }
      }
      // 바닥 빛
      for (let y = GROUND - 3; y <= GROUND + 4; y++)
        for (let x = Math.floor(cx - 16); x <= cx + 16; x++) {
          const d = Math.hypot((x + 0.5 - cx) / 15, (y + 0.5 - gy) / 3.6);
          if (d < 1) this.px(x, y, `rgba(150,225,255,${A((0.18 - d * 0.1) * (1 + hit))})`, false);
        }
    }
    // 이중 룬 고리 (서로 반대로 돈다)
    ringDots(15, 3.6, t * 0.5, 60, (i) => (i % 5 === 0 ? '#ffffff' : i % 5 === 2 ? null : 'rgba(150,230,255,0.85)'));
    ringDots(10.5, 2.5, -t * 0.8, 40, (i) => (i % 4 === 0 ? 'rgba(255,240,170,0.95)' : i % 4 === 1 ? 'rgba(255,220,120,0.6)' : null));
    // 충격파
    if (ph >= dropT && ph < dropT + 1) {
      const q = (ph - dropT) / 1;
      ringDots(4 + q * 16, 1 + q * 4, 0, 70, () => `rgba(230,250,255,${A(0.9 * (1 - q))})`);
    }
    // 떠오르는 룬 글자 (몸 양옆)
    if (front) {
      for (let i = 0; i < 6; i++) {
        const per = 3.6, p = ((t + hash(i + 3) * per) % per) / per;
        const side = i % 2 ? 1 : -1;
        const x = Math.round(side < 0 ? a.left - 6 - hash(i + 8) * 5 : a.right + 3 + hash(i + 8) * 5);
        const y = Math.round(GROUND - 3 - p * 28);
        const al = p < 0.15 ? p / 0.15 : 1 - Math.pow(p, 2);
        const R = RUNES[i];
        if (inFace(a, x, y, 1) || inFace(a, x + 2, y + 3, 1)) continue;
        for (let j = 0; j < 4; j++)
          for (let k = 0; k < 3; k++) {
            if (R[j][k] !== 'X') continue;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.px(x + k + dx, y + j + dy, `rgba(120,215,255,${A(al * 0.3)})`, false);
          }
        this.pattern(R, x, y, { X: p < 0.25 ? '#ffffff' : `rgba(200,245,255,${A(al)})` }, false);
      }
      // 기둥 안을 오르는 빛 알갱이 (얼굴은 피한다)
      for (let i = 0; i < 8; i++) {
        const p = (t * 0.6 + hash(i)) % 1;
        const x = Math.round(cx - 7 + hash(i + 11) * 14), y = Math.round(GROUND - p * 30);
        if (inFace(a, x, y, 1) || (x >= a.left && x <= a.right && y > a.my)) continue;
        this.px(x, y, `rgba(230,250,255,${A(1 - p)})`, false);
      }
    }
  };

  // ---- 블랙홀 ----
  PR._xbh = function (a, t, front) {
    const bx = a.cx - 0.5, by = a.top - 12;
    const RX = 14, RY = 3.4, H = 3.3, tilt = -0.12;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const disk = (wantFront) => {
      for (let y = Math.floor(by - 6); y <= by + 6; y++)
        for (let x = Math.floor(bx - RX - 2); x <= bx + RX + 2; x++) {
          const dx = x + 0.5 - bx, dy = y + 0.5 - by;
          const u = dx * ct + dy * st, v = -dx * st + dy * ct;
          const e = Math.hypot(u / RX, v / RY);
          if (e > 1 || e < 0.3) continue;
          if ((v >= 0) !== wantFront) continue;
          if (!wantFront && Math.hypot(dx, dy) < H + 0.2) continue;
          const ang = Math.atan2(v / RY, u / RX);
          const streak = 0.55 + 0.45 * Math.sin(ang * 6 - t * 5 + e * 11);
          const dop = 1 - 0.45 * Math.cos(ang);
          const k = (e - 0.3) / 0.7;
          const col = ramp([[255, 252, 230], [255, 200, 90], [240, 100, 40], [130, 30, 60]], k);
          this.px(x, y, rgb(col, Math.pow(1 - k, 0.4) * streak * dop * 0.95), false);
        }
    };
    if (!front) {
      // 중력 렌즈 빛무리 + 주기적인 중력파
      glow(this, bx, by, H, H + 5, [160, 110, 255], 0.22);
      const q = (t % 2.8) / 2.8;
      for (let i = 0; i < 64; i++) {
        const an = (i / 64) * Math.PI * 2;
        this.px(Math.round(bx - 0.5 + Math.cos(an) * (5 + q * 15)), Math.round(by - 0.5 + Math.sin(an) * (5 + q * 15) * 0.75), `rgba(190,150,255,${A(0.45 * (1 - q))})`, false);
      }
      // 제트 (위로 길게, 아래로 짧게)
      for (let j = 4; j <= 16; j++) {
        const w = Math.sin(t * 13 + j * 0.9) * 0.6;
        const al = 0.85 * (1 - j / 17);
        this.px(Math.round(bx - 0.5 + w), Math.round(by - 0.5 - j), rgb([200, 235, 255], al), false);
        if (j < 10) { this.px(Math.round(bx - 1.5 + w), Math.round(by - 0.5 - j), rgb([120, 180, 255], al * 0.5), false); this.px(Math.round(bx + 0.5 + w), Math.round(by - 0.5 - j), rgb([120, 180, 255], al * 0.5), false); }
      }
      for (let j = 4; j <= 7; j++) this.px(Math.round(bx - 0.5), Math.round(by - 0.5 + j), rgb([200, 235, 255], 0.6 * (1 - (j - 3) / 5)), false);
      disk(false);
      // 렌즈로 휘어 보이는 원반 뒷면 (구멍 위로 넘어가는 띠)
      for (let i = 0; i < 40; i++) {
        const an = Math.PI + (i / 40) * Math.PI;
        const rr = H + 1.4;
        this.px(Math.round(bx - 0.5 + Math.cos(an) * rr), Math.round(by - 0.5 + Math.sin(an) * rr), rgb([255, 200, 120], 0.55 + 0.35 * Math.sin(an * 3 + t * 4)), false);
      }
      // 사건의 지평선 + 광자 고리
      for (let y = Math.floor(by - H - 1); y <= by + H + 1; y++)
        for (let x = Math.floor(bx - H - 1); x <= bx + H + 1; x++) {
          const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
          if (d <= H) this.px(x, y, '#000000', false);
          else if (d <= H + 0.8) this.px(x, y, rgb([255, 240, 200], 0.75 + 0.25 * Math.sin(Math.atan2(y - by, x - bx) * 2 - t * 6)), false);
        }
      disk(true);
    }
    // 빨려 드는 빛 알갱이 (나선)
    for (let i = 0; i < 16; i++) {
      const p = (t * 0.3 + hash(i)) % 1;
      const R = 4 + 17 * (1 - p);
      const an = hash(i + 9) * 6.28 + p * 7;
      const x = Math.round(bx - 0.5 + Math.cos(an) * R), y = Math.round(by - 0.5 + Math.sin(an) * R * 0.8);
      const isF = i % 2 === 0 && y > a.top - 4 && !inFace(a, x, y, 1);
      if (isF !== front) continue;
      const col = mix([255, 140, 60], [255, 255, 255], p);
      this.px(x, y, rgb(col, 0.4 + 0.6 * p), false);
      const ta = an - 0.25, tr = R + 1.2;
      this.px(Math.round(bx - 0.5 + Math.cos(ta) * tr), Math.round(by - 0.5 + Math.sin(ta) * tr * 0.8), rgb(col, 0.25 + 0.3 * p), false);
    }
  };

  // ---- 별의 왕관 (디벨롭 2026-10-09) ----
  // 6초 한 바퀴: 하늘 사방에서 별들이 꼬리를 끌며 모여들고(0~1.2초) → 번쩍이며 왕관이 다시 빛나고 고리가 퍼진다 →
  // 위로 빛기둥이 솟고 왕관 둘레를 별무리가 기울어진 고리로 돈다. 뒤로는 8방향 별빛살이 천천히 돈다.
  // 면을 넓게 칠하지 않는다: 왕관만 채우고 나머지는 가는 선·점으로 (철창·탁한 면 금지)
  const CROWN = [
    '..........W..........',
    '.O........O........O.',
    '.OO......OOO......OO.',
    '.OFO....OFFFO....OFO.',
    '.OFFO..OFFFFFO..OFFO.',
    '.OFFFOOFFFFFFFOOFFFO.',
    '.OFFFFFFFFFFFFFFFFFO.',
    '.DDDDDDDDDDDDDDDDDDD.',
    '.DBBGBBBBBRBBBBBGBBD.',
    '.DDDDDDDDDDDDDDDDDDD.',
  ];
  PR._xcrown = function (a, t, front) {
    if (front) return; // 전부 머리 위 허공이라 몸 뒤에 그려도 가리는 게 없다
    const P = 6, ph = t % P;
    const FORM = 1.2;
    const flash = ph >= FORM ? Math.exp(-(ph - FORM) * 3) : 0;
    const bob = Math.round(Math.sin(t * 1.4) * 0.8);
    const x0 = a.hx - 10, y0 = a.top - 18 + bob;
    const ccx = a.hx + 0.5, ccy = y0 + 5;
    // 1) 뒤 별빛살 8방향 (가로·세로는 길게, 대각은 짧게), 가는 선만
    for (let k = 0; k < 8; k++) {
      const an = (k / 8) * Math.PI * 2 + t * 0.15;
      const L = (k % 2 ? 9 : 15) + 2 * Math.sin(t * 2 + k) + flash * 6;
      for (let d = 8; d <= L; d++) {
        const x = Math.round(ccx - 0.5 + Math.cos(an) * d), y = Math.round(ccy - 0.5 + Math.sin(an) * d * 0.85);
        if (inFace(a, x, y, 1)) continue;
        this.px(x, y, rgb([255, 236, 170], (0.5 + flash * 0.4) * (1 - (d - 8) / (L - 7))), false);
      }
    }
    glow(this, ccx, ccy, 0, 12, [255, 224, 140], 0.13 + 0.1 * flash);
    // 2) 위로 솟는 빛기둥
    const bw = 1 + Math.round(flash * 2);
    for (let y = 0; y < y0; y++) {
      const k = y / Math.max(1, y0);
      for (let dx = -bw - 1; dx <= bw + 1; dx++) {
        const core = Math.abs(dx) <= bw - 1 ? 1 : Math.abs(dx) <= bw ? 0.55 : 0.2;
        const shimmer = 0.75 + 0.25 * Math.sin(y * 0.7 + t * 10 + dx);
        this.px(Math.round(ccx - 0.5) + dx, y, rgb(core === 1 ? [255, 255, 240] : [255, 230, 150], core * shimmer * (0.25 + 0.6 * k) * (0.7 + 0.5 * flash)), false);
      }
    }
    // 3) 별무리 고리 — 뒤 반
    const ring = (frontHalf) => {
      for (let i = 0; i < 16; i++) {
        const an = (i / 16) * Math.PI * 2 + t * 0.7;
        if ((Math.sin(an) > 0) !== frontHalf) continue;
        const x = Math.round(ccx - 0.5 + Math.cos(an) * 15), y = Math.round(ccy + 3.5 + Math.sin(an) * 3.2 - Math.cos(an) * 1.2);
        const b = tw(t, i * 1.7, 3);
        const dim = frontHalf ? 1 : 0.6;
        if (i % 4 === 0 && frontHalf) glint(this, x, y, 1 + (b > 0.8 ? 1 : 0), dim * (0.6 + 0.4 * b), i % 8 ? [150, 210, 255] : [255, 220, 130]);
        else this.px(x, y, rgb(i % 3 ? [255, 240, 190] : [180, 220, 255], dim * (0.45 + 0.5 * b)), false);
      }
    };
    ring(false);
    // 4) 왕관 (번쩍일 때 흰빛으로 물들었다가 금빛으로)
    const sweep = ((t * 10) % 44) - 10;
    CROWN.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        const x = x0 + i, y = y0 + j;
        const sh = Math.abs(i + j - sweep) < 1.5;
        let col;
        if (ch === 'O') col = j < 3 ? [255, 228, 120] : [255, 208, 74];
        else if (ch === 'D') col = [217, 162, 42];
        else if (ch === 'B') col = [255, 233, 160];
        else if (ch === 'G') col = [111, 200, 255];
        else if (ch === 'R') col = [255, 79, 120];
        else if (ch === 'W') col = [255, 255, 255];
        else col = [255, 242, 190];
        if (sh && ch !== 'G' && ch !== 'R') col = mix(col, [255, 255, 255], 0.75);
        col = mix(col, [255, 255, 255], flash * 0.8);
        this.px(x, y, ch === 'F' ? rgb(col, 0.82) : hex(col), false);
      }
    });
    // 꼭짓점 보석 · 맨 위 별
    [[1, [110, 200, 255]], [19, [110, 200, 255]]].forEach(([i, col], n) => {
      const b = tw(t, n * 2, 2.6);
      this.pattern(['.X.', 'XWX', '.X.'], x0 + i - 1, y0, { X: hex(col), W: '#ffffff' }, false);
      glint(this, x0 + i, y0 + 1, 1 + Math.round(b), 0.6 + 0.4 * b, col);
    });
    glint(this, x0 + 10, y0 - 1, 2 + Math.round(tw(t, 5, 2.2) * 2 + flash * 3), 1, [255, 240, 180]);
    // 3') 별무리 고리 — 앞 반 (왕관 위로 지나간다)
    ring(true);
    // 5) 별이 모여든다 (위쪽 반원에서 꼬리를 끌며 안으로)
    if (ph < FORM) {
      const q = ph / FORM, e = q * q;
      for (let i = 0; i < 12; i++) {
        const an = Math.PI * (0.85 + hash(i + 90) * 1.3);
        const R0 = 22 + hash(i + 91) * 8;
        const r = R0 * (1 - e) + 2;
        const x = ccx - 0.5 + Math.cos(an) * r, y = ccy - 0.5 + Math.sin(an) * r * 0.85;
        for (let k = 1; k <= 4; k++) {
          const tx = Math.round(x + Math.cos(an) * k * (0.6 + e * 1.4)), ty = Math.round(y + Math.sin(an) * k * 0.85 * (0.6 + e * 1.4));
          if (!inFace(a, tx, ty, 1)) this.px(tx, ty, rgb([255, 235, 170], 0.75 * (1 - k / 5)), false);
        }
        if (!inFace(a, Math.round(x), Math.round(y), 1)) {
          if (i % 3 === 0) glint(this, x, y, 1, 1, [255, 230, 150]);
          else this.px(x, y, '#ffffff', false);
        }
      }
    }
    // 6) 번쩍 — 고리가 퍼진다
    if (flash > 0.05) {
      const R = 3 + (1 - flash) * 16;
      for (let i = 0; i < 64; i++) {
        const an = (i / 64) * Math.PI * 2;
        const x = Math.round(ccx - 0.5 + Math.cos(an) * R), y = Math.round(ccy - 0.5 + Math.sin(an) * R * 0.6);
        if (!inFace(a, x, y, 1)) this.px(x, y, rgb([255, 250, 220], flash), false);
      }
    }
    // 7) 왕관에서 머리로 내려앉는 축복 빛가루
    for (let i = 0; i < 5; i++) {
      const p = (t * 0.5 + i / 5) % 1;
      const x = Math.round(x0 + 4 + hash(i + 70) * 13 + Math.sin(t * 2 + i) * 0.8), y = Math.round(y0 + 10 + p * 5);
      this.px(x, y, rgb([255, 240, 180], 0.8 * (1 - p)), false);
    }
  };

  // ---- 차원의 균열 ----
  const SHARD = [['X..', 'XX.', 'XXX'], ['XXX', '.XX', '..X'], ['..X', '.XX', 'XXX'], ['XXX', 'XX.', 'X..']];
  PR._xrift = function (a, t, front) {
    const P0 = [a.cx - 14, a.top - 23], P1 = [a.cx + 14, a.top - 3];
    const dX = P1[0] - P0[0], dY = P1[1] - P0[1], len = Math.hypot(dX, dY);
    const N = 9;
    const jag = (s) => { const f = s * N, k = Math.floor(f), u = f - k; return ((hash(k + 11) - 0.5) * (1 - u) + (hash(k + 12) - 0.5) * u) * 2.4; };
    const width = (s) => 4.2 * Math.pow(Math.max(0, Math.sin(Math.PI * s)), 0.8) * (0.86 + 0.14 * Math.sin(t * 2.2));
    if (!front) {
      for (let y = 2; y <= GROUND; y++)
        for (let x = 2; x <= 46; x++) {
          const rx = x + 0.5 - P0[0], ry = y + 0.5 - P0[1];
          const s = (rx * dX + ry * dY) / (len * len);
          if (s < 0 || s > 1) continue;
          const q = (dX * ry - dY * rx) / len - jag(s);
          const w = width(s), aq = Math.abs(q);
          if (aq > w + 2.4) continue;
          const hue = Math.round((s * 300 + q * 25 - t * 80) % 360 + 360) % 360;
          if (aq > w) { this.px(x, y, `hsla(${hue},90%,78%,${A(0.42 * (1 - (aq - w) / 2.4))})`, false); continue; }
          const d = aq / Math.max(0.6, w);
          if (d > 0.74) { this.px(x, y, d > 0.9 ? '#ffffff' : 'rgba(225,245,255,0.95)', false); continue; }
          const band = 0.5 + 0.5 * Math.sin(s * 30 - t * 4 + q);
          this.px(x, y, `hsl(${hue},85%,${Math.round(16 + 26 * (1 - d) * band)}%)`, false);
          if (hash(x * 31 + y * 17) > 0.92 && tw(t, x + y, 3) > 0.5) this.px(x, y, '#ffffff', false);
        }
      // 가장자리에서 뻗는 잔금
      for (let k = 0; k < 7; k++) {
        const s = 0.15 + (k / 6) * 0.7, side = k % 2 ? 1 : -1;
        const w = width(s) + 0.5;
        const nx = -dY / len, ny = dX / len; // q 가 커지는 쪽
        const bx = P0[0] + dX * s + nx * (jag(s) + side * w), by = P0[1] + dY * s + ny * (jag(s) + side * w);
        const L = 2 + Math.round(hash(k + 30) * 3);
        const ang = Math.atan2(ny * side, nx * side) + (hash(k + 31) - 0.5) * 1.2;
        for (let d = 0; d < L; d++) this.px(Math.round(bx + Math.cos(ang) * d - 0.5), Math.round(by + Math.sin(ang) * d - 0.5), `rgba(235,250,255,${A(0.75 * (1 - d / L))})`, false);
      }
    }
    // 프리즘 파편
    const mx = a.cx - 0.5, my = a.top - 13;
    for (let i = 0; i < 9; i++) {
      const an = t * 0.35 + i * 0.7;
      const R = 1 + 0.08 * Math.sin(t * 1.3 + i);
      const x = Math.round(mx + Math.cos(an) * 16 * R), y = Math.round(my + Math.sin(an) * 10 * R + Math.sin(t * 2 + i) * 1);
      const isF = i % 3 === 0 && !inFace(a, x, y, 2);
      if (isF !== front) continue;
      const fr = SHARD[(Math.floor(t * 3) + i) % 4];
      const hue = Math.round(t * 80 + i * 40) % 360;
      this.pattern(fr, x - 1, y - 1, { X: `hsla(${hue},90%,${front ? 78 : 70}%,${front ? 0.95 : 0.8})` }, false);
      const hl = fr.map((r) => r.indexOf('X')).findIndex((v) => v >= 0);
      this.px(x - 1 + fr[hl].indexOf('X'), y - 1 + hl, '#ffffff', false);
    }
  };

  // ---- 수정 성역 ----
  const GEM = {
    am: { L: '#f3e6ff', M: '#c79bff', D: '#8a5ad8', O: '#3a1f6a' },
    ice: { L: '#effcff', M: '#9fe6ff', D: '#4aa8d8', O: '#1f4a6a' },
    rose: { L: '#fff0f6', M: '#ff9fd0', D: '#d85a9a', O: '#6a1f45' },
  };
  PR._xcrystal = function (a, t, front) {
    const cx = a.cx - 0.5;
    const BACK = [
      { dx: 0, w: 9, h: 30, lean: 0, c: 'am' },
      { dx: -11, w: 5, h: 17, lean: -3, c: 'ice' },
      { dx: 11, w: 5, h: 19, lean: 3, c: 'rose' },
      { dx: -16, w: 3, h: 9, lean: -3, c: 'am' },
      { dx: 16, w: 3, h: 11, lean: 2, c: 'ice' },
      { dx: -7, w: 4, h: 12, lean: -2, c: 'rose' },
      { dx: 7, w: 4, h: 13, lean: 2, c: 'am' },
    ];
    const FRONT = [
      { dx: -10, w: 3, h: 6, lean: -1, c: 'am' },
      { dx: 10, w: 4, h: 7, lean: 1, c: 'ice' },
      { dx: -13, w: 2, h: 4, lean: -1, c: 'rose' },
    ];
    const sweep = ((t % 3.2) / 3.2) * 80 - 15;
    const tips = [];
    const draw = (cr) => {
      const P = GEM[cr.c];
      const taper = Math.max(2, cr.w * 0.8);
      for (let r = 0; r <= cr.h; r++) {
        const y = GROUND - r, k = r / cr.h;
        const ccx = cx + cr.dx + cr.lean * k;
        const half = (cr.w / 2) * Math.min(1, (cr.h - r) / taper);
        if (half <= 0.15) { this.px(Math.round(ccx - 0.5), y, P.O, false); continue; }
        for (let x = Math.floor(ccx - half - 1); x <= ccx + half + 1; x++) {
          const u = (x + 0.5 - ccx) / half;
          if (Math.abs(u) > 1 + 1 / half) continue;
          if (Math.abs(u) > 1) { this.px(x, y, P.O, false); continue; }
          let col = u < -0.33 ? P.L : u < 0.33 ? P.M : P.D;
          if (Math.sin(r * 0.55 - t * 3 + cr.dx) > 0.82 && u < 0.33) col = '#ffffff';
          if (Math.abs(x + y * 0.6 - sweep) < 1) col = '#ffffff';
          this.px(x, y, col, false);
        }
      }
      tips.push([Math.round(cx + cr.dx + cr.lean - 0.5), GROUND - cr.h - 1]);
    };
    if (!front) {
      // 바닥 빛
      for (let y = GROUND - 2; y <= GROUND + 3; y++)
        for (let x = Math.floor(cx - 19); x <= cx + 19; x++) {
          const d = Math.hypot((x + 0.5 - cx) / 18, (y + 0.5 - GROUND - 0.5) / 3);
          if (d < 1) this.px(x, y, `rgba(210,170,255,${A((0.24 - d * 0.16) * (0.85 + 0.15 * Math.sin(t * 2)))})`, false);
        }
      glow(this, cx, GROUND - 22, 2, 10, [220, 190, 255], 0.16 + 0.05 * Math.sin(t * 1.8));
      BACK.forEach(draw);
    } else FRONT.forEach(draw);
    // 끝마다 무지갯빛 반짝
    tips.forEach(([x, y], i) => {
      const b = tw(t, i * 2.3 + (front ? 5 : 0), 2.2);
      if (b < 0.7) return;
      const col = [[255, 160, 220], [160, 230, 255], [255, 240, 160], [190, 255, 200]][(i + Math.floor(t)) % 4];
      glint(this, x, y, 1 + Math.round((b - 0.7) * 6), b, col);
    });
    // 떠오르는 빛 결정
    if (front)
      for (let i = 0; i < 6; i++) {
        const p = (t * 0.4 + hash(i + 80)) % 1;
        const x = Math.round(cx - 17 + hash(i + 81) * 34), y = Math.round(GROUND - 2 - p * 26);
        if (inFace(a, x, y, 1) || (x >= a.left && x <= a.right && y > a.my)) continue;
        this.px(x, y, rgb(i % 2 ? [230, 200, 255] : [200, 245, 255], 1 - p), false);
      }
  };

  // ---- 영혼의 잉어 ----
  const KOI = [
    { ph: 0, b: [255, 255, 255], p: [240, 70, 50], f: [255, 205, 195], patch: [1, 2, 5, 6] },
    { ph: Math.PI, b: [255, 214, 90], p: [255, 140, 40], f: [255, 240, 170], patch: [0, 3, 4] },
  ];
  const KR = [1.9, 2.3, 2.3, 2.1, 1.9, 1.6, 1.4, 1.1, 0.9, 0.6];
  PR._xkoi = function (a, t, front) {
    const cx = a.cx - 0.5, cy = a.cy - 4, RX = 15, RY = 8.5;
    const path = (an) => [cx + Math.cos(an) * RX, cy + Math.sin(an) * RY + Math.sin(an * 3 + t) * 0.8, Math.sin(an)];
    const layer = (x, y, z) => z > 0 && !inFace(a, Math.round(x), Math.round(y), 1);
    // 물결 고리 (발밑, 번진다)
    for (let w = 0; w < 2; w++) {
      const q = ((t / 2.2) + w * 0.5) % 1;
      for (let i = 0; i < 60; i++) {
        const an = (i / 60) * Math.PI * 2;
        if ((Math.sin(an) > 0) !== front) continue;
        this.px(Math.round(cx + Math.cos(an) * (6 + q * 11)), Math.round(GROUND + 0.5 + Math.sin(an) * (1.4 + q * 2.4)), rgb([190, 235, 255], 0.6 * (1 - q)), false);
      }
    }
    for (const F of KOI) {
      const an = t * 0.9 + F.ph;
      const pts = [];
      for (let k = 0; k < 16; k++) pts.push(path(an - k * 0.1));
      // 빛 자취
      for (let k = 11; k < 16; k++) {
        const [x, y, z] = pts[k];
        if (layer(x, y, z) !== front) continue;
        this.px(x, y, rgb(F.f, 0.5 * (1 - (k - 10) / 6)), false);
      }
      // 꼬리 (두 갈래 지느러미)
      const [tx, ty, tz] = pts[9], [ux, uy] = pts[10];
      const dl = Math.hypot(ux - tx, uy - ty) || 1, dx = (ux - tx) / dl, dy = (uy - ty) / dl;
      for (let q = 1; q <= 5; q++)
        for (const sd of [-1, 1]) {
          const sw = Math.sin(t * 8) * q * 0.25;
          const x = tx + dx * q - dy * (q * 0.65 * sd + sw), y = ty + dy * q + dx * (q * 0.65 * sd + sw);
          if (layer(x, y, tz) !== front) continue;
          this.px(x, y, rgb(F.f, 0.9 - q * 0.12), false);
          this.px(tx + dx * q - dy * sw * 0.5, ty + dy * q + dx * sw * 0.5, rgb(F.f, 0.35), false);
        }
      // 몸통 (꼬리 쪽부터 그려 머리가 위에)
      for (let k = KR.length - 1; k >= 0; k--) {
        const [x, y, z] = pts[k];
        const r = KR[k];
        for (let yy = Math.floor(y - r - 1); yy <= y + r + 1; yy++)
          for (let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx++) {
            const ddx = xx + 0.5 - x, ddy = yy + 0.5 - y;
            if (Math.hypot(ddx, ddy) > r + 0.3) continue;
            if (layer(xx, yy, z) !== front) continue;
            let col = F.patch.includes(k) ? F.p : F.b;
            if (ddy < -0.5) col = mix(col, [255, 255, 255], 0.35);
            else if (ddy > 0.6) col = mix(col, [120, 60, 60], 0.22);
            if (z < 0) col = mix(col, [110, 130, 180], 0.3);
            this.px(xx, yy, rgb(col, 0.95), false);
          }
        // 가슴지느러미
        if (k === 2) {
          const [nx, ny] = pts[3];
          const l = Math.hypot(nx - x, ny - y) || 1, px = -(ny - y) / l, py = (nx - x) / l;
          const fl = 2 + Math.round(Math.sin(t * 6 + F.ph));
          for (const sd of [-1, 1]) {
            const fx = x + px * sd * fl + (nx - x) * 0.6, fy = y + py * sd * fl + (ny - y) * 0.6;
            if (layer(fx, fy, z) === front) this.px(fx, fy, rgb(F.f, 0.7), false);
          }
        }
      }
      // 눈 · 머리 반짝
      const [hx, hy, hz] = pts[0], [qx, qy] = pts[1];
      const ex = hx + (hx - qx) * 0.6, ey = hy + (hy - qy) * 0.6 - 0.6;
      if (layer(ex, ey, hz) === front) this.px(ex, ey, '#1c1c3a', false);
      // 물방울
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.7 + i / 3 + F.ph) % 1;
        const bx = hx + Math.sin(t * 3 + i) * 1.2, by = hy - 2 - p * 7;
        if (layer(bx, by, hz) !== front) continue;
        this.px(bx, by, rgb([220, 245, 255], 0.75 * (1 - p)), false);
      }
    }
  };

  Object.assign(root.PetSprite.ACCESSORIES, LAB);

  const LAB_ITEMS = [
    ['xastralblade', 'hand', '성좌의 성검'],
    ['xgalaxystaff', 'hand', '은하의 지팡이'],
    ['xheavenspear', 'hand', '천상의 창'],
    ['xchronoglass', 'hand', '시간의 모래시계'],
    ['xplanetorb', 'hand', '행성 구슬'],
    ['xnebulaaura', 'effect', '성운 소용돌이'],
    ['xsolarsystem', 'effect', '태양이 된 고양이'],
    ['xdivinepillar', 'effect', '신성 강림'],
    ['xblackhole', 'effect', '블랙홀'],
    ['xstarcrownfall', 'effect', '별의 왕관'],
    ['xmoonscythe', 'hand', '달의 낫'],
    ['xcelestiallyre', 'hand', '천상의 리라'],
    ['xphoenixplume', 'hand', '불사조 깃털'],
    ['xdimensionrift', 'effect', '차원의 균열'],
    ['xcrystalsanctum', 'effect', '수정 성역'],
    ['xspiritkoi', 'effect', '영혼의 잉어'],
  ];
})(window);
