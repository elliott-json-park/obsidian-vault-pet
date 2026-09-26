// 6차 코스튬 (2026-09-24): 등 10. accessories.js 뒤에 읽는다
(function (root) {
  const { GROUND } = root.PetSprite.costumeKit;

  // 선 긋기 (촘촘하게). col 이 함수면 col(0~1)
  function line(r, x0, y0, x1, y1, col, solid = true) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.5));
    for (let k = 0; k <= n; k++) r.px(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, typeof col === 'function' ? col(k / n) : col, solid);
  }
  // 굵기가 변하는 관(꼬리·보드·막대 등). pts 를 따라 rad(u) 두께로 채우고 외곽선을 두른다.
  // fill(L) 의 L = { u: 0(시작)~1(끝), side: 중심선에서 옆으로 떨어진 거리(부호 있음), d: 시작점부터 잰 길이 }
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
    r.shape(inside, [Math.min(...xs) - maxR, Math.min(...ys) - maxR, Math.max(...xs) + maxR, Math.max(...ys) + maxR], () => fill(last), outline);
  }
  // 고양이 제 꼬리(sprite.js drawTail)와 똑같이 흔들리는 자리. 꼬리를 다른 색으로 덧칠할 때 쓴다
  function tailRows(g) {
    const { p, t, m } = g;
    const T = m.tail;
    if (!T || p.noTail) return null;
    const SPEED = { up: 0, wag: 6.5, flick: 9, slow: 0.8, idle: 1.6 };
    const AMP = { up: 0, wag: 2, flick: 2, slow: 1, idle: 1 };
    const speed = SPEED[p.tail] != null ? SPEED[p.tail] : SPEED.idle;
    const amp = AMP[p.tail] != null ? AMP[p.tail] : AMP.idle;
    const ph = t * speed;
    const swing = p.tail === 'flick' ? (Math.sin(ph) > 0.82 ? -amp : 0) : Math.sin(ph) * amp;
    const rise = p.tail === 'up' ? -1 : p.tail === 'slow' ? 1 : 0;
    const last = Math.max(1, T.rows.length - 1);
    return T.rows.map((row, j) => ({ row, x: g.x0 + T.x + Math.round(swing * (1 - j / last)), y: g.y0 + T.y + j + rise + g.lift(T.y) }));
  }
  // 제 꼬리를 덧칠한다: paint(j, i, w) → 털 칸 색 (j 0 = 꼬리 끝 줄, i = 가로 칸, w = 줄 너비)
  function recolorTail(r, g, K, paint) {
    const rows = tailRows(g);
    if (!rows) return null;
    rows.forEach(({ row, x, y }, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        r.px(x + i, y, ch === 'O' ? K : paint(j, i, row.length));
      }
    });
    return rows;
  }
  // 밝기 사다리에서 한 칸 고르기 (넘치면 끝에 붙는다)
  const pick = (lad, i) => lad[Math.max(0, Math.min(lad.length - 1, Math.round(i)))];

  // 원숭이 꼬리 색 (원숭이 잠옷과 같은 갈색). 어두운 쪽 → 밝은 쪽
  const MONK = ['#4e3018', '#6e4626', '#855a37', '#9a6a43', '#b88556', '#e8c9a0'];

  const ACC = {
    snailhouse: {
      // 달팽이네 전세 집: 소용돌이 껍데기(왼쪽 위가 밝고 오른쪽 아래가 어둡다, 홈 바깥 결은 볼록하게 반짝),
      // 꼭대기엔 벽돌 굴뚝이 서 있고 연기가 모락모락
      back(g, a, c, t) {
        const cu = a.curled;
        const R = cu ? 7.5 : 8.5;
        const cx = (cu ? a.cx - 3 : a.hx - 4) + 0.5, cy = cu ? a.top - 3 : a.top - 4;
        const S = ['#4a2410', '#7a4220', '#a8622e', '#c98446', '#e6ab6a', '#f7d49a', '#fff0c8'];
        const B = cu ? 3.3 : 3.8;
        // 굴뚝 (껍데기 뒤에 먼저 그려서 밑동이 껍데기에 박힌 것처럼)
        const chx = Math.round(cx + 2), chy = Math.round(cy - R - 4);
        this.pattern(
          ['KKKKKKK', 'KGGGGgK', 'KKKKKKK', '.KbBbK.', '.KmmmK.', '.KBbBK.', '.KmmmK.', '.KbBbK.'],
          chx - 1, chy - 3, { K: c.K, G: '#8c8f99', g: '#5f626c', b: '#c4603e', B: '#9a4228', m: '#e0b89a' },
        );
        this.ellipse(cx, cy, R, R, (x, y) => {
          const px = x + 0.5 - cx, py = y + 0.5 - cy;
          const r = Math.hypot(px, py);
          if (r < 1.3) return S[1];
          const u = r - (Math.atan2(py, px) / (2 * Math.PI)) * B;
          const f = ((u % B) + B) % B;
          const lt = (-px - py * 1.2) / R;
          const L = lt > 0.5 ? 1 : lt < -0.35 ? -1 : 0;
          if (f < (r < 3.5 ? 0.5 : 0.75)) return S[1]; // 소용돌이 홈
          let k = 3 + L;
          if (f < 1.45) k += 1; // 홈 바로 바깥 볼록한 결
          else if (f > B - 0.6) k -= 1; // 다음 홈으로 말려 들어가는 그늘
          return pick(S, k);
        }, c.K);
        // 연기: 동글동글한 뭉게구름이 커지면서 흐려진다
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.45 + i / 3) % 1;
          const sx = chx + 2 + Math.round(Math.sin(p * 7 + i) * 1.2 + p * 3);
          const sy = chy - 4 - Math.round(p * 7);
          const al = (0.9 * (1 - p)).toFixed(2);
          const col = `rgba(236,236,242,${al})`, sh = `rgba(170,172,186,${al})`;
          if (p < 0.3) this.px(sx, sy, col, false);
          else if (p < 0.65) this.pattern(['cc', 'cs'], sx, sy - 1, { c: col, s: sh }, false);
          else this.pattern(['.cc.', 'cccs', '.ss.'], sx - 1, sy - 1, { c: col, s: sh }, false);
        }
      },
    },
    shieldkite: {
      // 정월대보름 방패연: 빨간 꼭지, 가운데 뚫린 방구멍, 파란 치마. 종이 너머로 대살(대나무 살)이 비친다.
      // 목줄 두 가닥이 연 아래 한 점에 모여 연줄이 되어 등까지 늘어진다
      back(g, a, c, t) {
        const W = 13, H = 16;
        const kx = a.hx - 16 + Math.round(Math.sin(t * 1.1) * 1.5), ky = a.top - 23 + Math.round(Math.sin(t * 1.7));
        const hc = [6, 8.5], kc = [6, 3.5];
        const ox = kx + 6, oy = ky + H + 3;
        // 목줄 (연 뒤에 먼저 그려서 연 아래로 나온 부분만 보인다)
        const TH = 'rgba(90,76,60,0.8)';
        line(this, kx + 2, ky + H - 3, ox, oy, TH, false);
        line(this, kx + W - 3, ky + H - 3, ox, oy, TH, false);
        for (let j = 0; j < H; j++)
          for (let i = 0; i < W; i++) {
            const x = kx + i, y = ky + j;
            const dh = Math.hypot(i - hc[0], (j - hc[1]) * 1.05);
            if (dh < 1.9) continue; // 방구멍: 뚫려 있다
            let col;
            if (i === 0 || i === W - 1 || j === 0 || j === H - 1) col = c.K;
            else if (j >= H - 5) col = j === H - 5 ? '#6f9ae8' : j === H - 2 ? '#1f4598' : i >= W - 3 ? '#2552a8' : '#2f63c8';
            else if (Math.hypot(i - kc[0], j - kc[1]) < 2.5) {
              const hi = i - kc[0] + (j - kc[1]) < -1.3;
              col = hi ? '#ff8a80' : j > kc[1] + 0.5 ? '#b8202a' : '#e8303a';
            } else if (dh < 2.7) col = '#b99462'; // 방구멍 둘레 대살
            else {
              col = i >= W - 4 ? '#ece2c6' : i <= 2 ? '#fffdf4' : '#f8f2e0';
              if (i === 6 || j === 1 || j === Math.round(hc[1])) col = i >= W - 4 ? '#cfb07c' : '#dcc292'; // 장살·머릿살·허릿살
            }
            this.px(x, y, col);
          }
        // 연줄: 등 뒤까지 느슨하게
        const bx = a.left + 2, by = a.top + 2;
        const n = 40;
        for (let i = 0; i <= n; i++) {
          const s = i / n;
          this.px(ox + (bx - ox) * s, oy + (by - oy) * s + Math.sin(Math.PI * s) * 2.5, '#6a5a48', false);
        }
      },
    },
    surfboard: {
      // 등에 비스듬히 멘 서핑보드: 뾰족한 코, 네모난 꼬리. 가운데 나무 결(스트링어) 양옆에 빨강·민트 띠,
      // 한쪽 가장자리는 그늘, 반대쪽은 반짝. 꼬리엔 핀과 발목 줄, 코 쪽엔 히비스커스 스티커. 물이 뚝뚝
      back(g, a, c, t) {
        const cu = a.curled;
        const x0 = cu ? a.cx - 14 : a.hx - 12, y0 = cu ? GROUND : GROUND + 1;
        const x1 = cu ? a.cx + 11 : a.hx + 10, y1 = cu ? a.top - 12 : a.top - 14;
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
        const nx = -dy / len, ny = dx / len; // 보드 옆 방향
        // 핀: 꼬리 옆으로 삐죽 (보드 뒤)
        const fu = 0.16;
        tube(this, [[x0 + dx * fu + nx * 1.5, y0 + dy * fu + ny * 1.5], [x0 + dx * (fu - 0.04) + nx * 3.6, y0 + dy * (fu - 0.04) + ny * 3.6]], (u) => 0.9 - u * 0.4, () => '#2a4a80', c.K);
        tube(
          this, [[x0, y0], [x1, y1]],
          (u) => 0.6 + 2.2 * Math.pow(Math.sin(Math.PI * Math.min(0.98, Math.max(0.12, u * 0.9 + 0.1))), 0.55),
          (L) => {
            const s = L.side;
            if (L.u > 0.22 && L.u < 0.3) return s > 1.3 ? '#1f8a86' : '#2fb5b0'; // 민트 띠
            if (L.u > 0.9) return s > 0.6 ? '#c43a34' : '#e8534a'; // 빨간 코
            if (Math.abs(s) < 0.5) return '#e8534a'; // 가운데 빨간 줄
            if (s > 1.6) return '#d6ccb0';
            if (s < -1.6) return '#ffffff';
            return s > 0 ? '#efe8d4' : '#fbf8ee';
          },
          c.K,
        );
        // 히비스커스 스티커
        const su = 0.74;
        const sx = Math.round(x0 + dx * su - nx * 1.2), sy = Math.round(y0 + dy * su - ny * 1.2);
        this.pattern(['.PP.', 'PpYP', 'PYpP', '.PP.'], sx - 1, sy - 1, { P: '#ff5fa2', p: '#d8307a', Y: '#ffd65a' });
        // 물방울
        const p = (t * 0.8) % 1;
        this.px(x0 + 1, y0 - 2 + Math.round(p * 3), `rgba(120,200,255,${(1 - p).toFixed(2)})`, false);
        const q = (t * 0.8 + 0.5) % 1;
        this.px(x0 + 3, y0 - 3 + Math.round(q * 3), `rgba(120,200,255,${(0.8 * (1 - q)).toFixed(2)})`, false);
      },
    },
    ninetails: {
      // 구미호 꼬리 아홉 개가 부채처럼 펼쳐져 하늘하늘. 꼬리마다 볕 드는 쪽은 밝고 반대쪽은 짙은 주황,
      // 끝은 크림빛 흰 털. 푸른 여우불 두 개가 맴돈다
      back(g, a, c, t) {
        const cu = a.curled;
        const bx = a.hx + 0.5, by = cu ? a.cy + 1 : a.top + 6;
        const L = cu ? 12 : 16;
        const O = ['#b8581a', '#e0842c', '#f4a83e', '#ffcb66'];
        for (const i of [0, 8, 1, 7, 2, 6, 3, 5, 4]) {
          const th = Math.PI * (1.08 + (0.84 * i) / 8) + Math.sin(t * 1.6 + i * 0.7) * 0.07;
          const curl = (0.45 * (i - 4)) / 4;
          const pts = [];
          for (let k = 0; k <= 6; k++) {
            const s = k / 6;
            const an = th + curl * s * s;
            pts.push([bx + Math.cos(an) * L * s, by + Math.sin(an) * L * s]);
          }
          const lit = i >= 4 ? -1 : 1; // 부채 왼쪽 꼬리는 오른쪽 옆이, 오른쪽 꼬리는 왼쪽 옆이 안쪽(그늘)
          tube(this, pts, (u) => 0.6 + 2.5 * Math.sin(Math.PI * Math.pow(u, 1.25)), (Lq) => {
            const s = Lq.side * lit;
            if (Lq.u > 0.86) return s < 0.5 ? '#fffaf0' : '#eadcc4';
            if (Lq.u > 0.8) return s > 0.3 ? O[2] : '#ffe9c0';
            if (s > 1.1) return O[0];
            if (s > 0.2) return O[1];
            if (s < -1.1) return O[3];
            return O[2];
          }, c.K);
        }
        for (let i = 0; i < 2; i++) {
          const an = t * 1.2 + i * Math.PI;
          const fx = Math.round(bx + Math.cos(an) * (cu ? 13 : 15)), fy = Math.round(by - 4 + Math.sin(an) * 5);
          const fl = Math.floor(t * 8 + i) % 2;
          this.pattern([fl ? '.b..' : '..b.', fl ? '.bb.' : '.bb.', 'bBWb', 'bWWb', '.bb.'], fx - 1, fy - 3, { b: 'rgba(90,170,255,0.8)', B: 'rgba(170,225,255,0.95)', W: '#eaffff' }, false);
        }
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);

// ---- 이전 디자인으로 되돌린 것 (2026-09-24 피드백: 다듬은 것보다 이전 게 낫다) ----
// 도우미 이름이 위쪽 새 그림과 겹쳐서 따로 묶는다
(function (root) {
  const { GROUND } = root.PetSprite.costumeKit;
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
        if (!best || m < best.m) best = { m, u: uu, side: (px - qx) * -s.dy + (py - qy) * s.dx };
      }
      last = best;
      return best.m <= 0;
    };
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    r.shape(inside, [Math.min(...xs) - maxR, Math.min(...ys) - maxR, Math.max(...xs) + maxR, Math.max(...ys) + maxR], () => fill(last), outline);
  }
  // 고양이 제 꼬리(sprite.js drawTail)와 똑같이 흔들리는 자리. 꼬리를 다른 색으로 덧칠할 때 쓴다
  function tailRows(g) {
    const { p, t, m } = g;
    const T = m.tail;
    if (!T || p.noTail) return null;
    const SPEED = { up: 0, wag: 6.5, flick: 9, slow: 0.8, idle: 1.6 };
    const AMP = { up: 0, wag: 2, flick: 2, slow: 1, idle: 1 };
    const speed = SPEED[p.tail] != null ? SPEED[p.tail] : SPEED.idle;
    const amp = AMP[p.tail] != null ? AMP[p.tail] : AMP.idle;
    const ph = t * speed;
    const swing = p.tail === 'flick' ? (Math.sin(ph) > 0.82 ? -amp : 0) : Math.sin(ph) * amp;
    const rise = p.tail === 'up' ? -1 : p.tail === 'slow' ? 1 : 0;
    const last = Math.max(1, T.rows.length - 1);
    return T.rows.map((row, j) => ({ row, x: g.x0 + T.x + Math.round(swing * (1 - j / last)), y: g.y0 + T.y + j + rise + g.lift(T.y) }));
  }
  // 제 꼬리를 덧칠한다: paint(j, i) → 털 칸 색 (j 0 = 꼬리 끝 줄, i = 가로 칸)
  function recolorTail(r, g, K, paint) {
    const rows = tailRows(g);
    if (!rows) return null;
    rows.forEach(({ row, x, y }, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        r.px(x + i, y, ch === 'O' ? K : paint(j, i));
      }
    });
    return rows;
  }

  // 털 칸 전부(머리+몸): paint(dx, y, x, j) — j = 도트 맵 줄
  const BEAR = { T: '#9a6a43', shade: '#855a37', trim: '#e8c9a0' };

  const ACC = {
    monkeytail: {
      // 곰돌이 잠옷과 같은 갈색 원숭이 꼬리: 제 꼬리 자리에서 길게 올라가 끝이 동글게 말린다 (잘 때는 바닥을 따라 말린다)
      back(g, a, c, t) {
        if (!a.curled) return;
        const x0 = a.cx + 5, y0 = GROUND - 2;
        const pts = [[x0, y0], [x0 + 4, y0 + 1], [x0 + 8, y0 - 1]];
        const C = [x0 + 8, y0 - 4];
        for (let k = 0; k <= 12; k++) {
          const s = k / 12;
          const an = Math.PI / 2 - s * Math.PI * 1.6;
          const R = 3 - s * 1.6;
          pts.push([C[0] + Math.cos(an) * R, C[1] + Math.sin(an) * R]);
        }
        tube(this, pts, 0.9, (L) => (L.side > 0.3 ? BEAR.shade : BEAR.T), c.K);
      },
      front(g, a, c, t) {
        if (a.curled) return;
        const rows = recolorTail(this, g, c.K, (j, i) => (i === 2 ? BEAR.shade : BEAR.T));
        if (!rows) return;
        const tx = rows[0].x + 2, ty = rows[0].y + 1;
        const w = Math.sin(t * 1.4) * 0.8;
        const pts = [[tx, ty], [tx + 0.5, ty - 3], [tx + 2 + w, ty - 6]];
        const C = [tx + 5 + w, ty - 8];
        for (let k = 0; k <= 14; k++) {
          const s = k / 14;
          const an = Math.PI * 0.95 + s * Math.PI * 1.7;
          const R = 3.3 - s * 1.7;
          pts.push([C[0] + Math.cos(an) * R, C[1] + Math.sin(an) * R]);
        }
        tube(this, pts, 0.95, (L) => (L.side > 0.3 ? BEAR.shade : BEAR.T), c.K);
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);
