// 6차 코스튬 (2026-09-24): 효과 10. accessories.js 뒤에 읽는다
// 전부 효과 칸. 입자는 solid=false 로 찍어서 머리 위치·클릭 판정에 안 끼게 한다.
// 펫 창은 투명하니 넓은 면을 칠하지 않는다 (작은 점·짧은 줄만)
(function (root) {
  const { GROUND, hash, mirror } = root.PetSprite.costumeKit;
  const G = 48;
  const A = (v) => Math.max(0, Math.min(1, v)).toFixed(2);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (x) => 1 - (1 - x) * (1 - x);

  // 잠깐 투명도를 걸고 그린다
  function faded(r, al, fn) {
    const ctx = r.ctx;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * clamp01(al);
    fn();
    ctx.globalAlpha = prev;
  }
  // 캔버스가 좌우로 뒤집혀 있어도(왼쪽을 볼 때) 글자·음표는 똑바로 보이게 한 번 더 뒤집어 찍는다
  const upright = (r, rows) => (r.facing < 0 ? mirror(rows) : rows);

  // ---------- 흥얼흥얼: 음표 ----------
  const N8 = ['.XH.', '.X.X', '.X..', 'XX..', 'DX..'];
  const N16 = ['.XH.', '.XXH', '.X.X', 'XX..', 'DX..'];
  const BEAM = ['.HHHHX', '.XXXXX', '.X...X', 'XX..XX', 'DX..DX'];
  const NOTE_PAL = [
    { X: '#8a6ad8', D: '#56399e', H: '#cbb8ff' },
    { X: '#ff6f9a', D: '#c23d67', H: '#ffc3d6' },
    { X: '#48a3e8', D: '#2a68a8', H: '#bde4ff' },
    { X: '#35c08a', D: '#1d7d57', H: '#b0f0d2' },
  ];

  // ---------- 콤퓨타 세계: 코드 글자 (2×3) ----------
  const GLYPH = [
    ['XX', '.X', 'XX'], ['X.', 'XX', 'X.'], ['XX', 'X.', '.X'], ['.X', 'XX', '.X'],
    ['X.', '.X', 'X.'], ['XX', 'XX', '.X'], ['X.', 'X.', 'XX'], ['.X', 'X.', 'XX'],
    ['XX', '..', 'XX'], ['.X', '.X', '.X'], ['XX', 'X.', 'XX'], ['X.', 'XX', 'XX'],
  ];

  // ---------- 가을 낙엽 ----------
  const rot90 = (rows) => {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const out = [];
    for (let x = 0; x < w; x++) {
      let s = '';
      for (let y = h - 1; y >= 0; y--) s += rows[y][x] || '.';
      out.push(s);
    }
    return out;
  };
  const MAPLE = ['..X..', 'X.X.X', 'XXHXX', '.XHX.', '..s..'];
  const MAPLE_T = ['.X...', '.XX.X', 'XXHXX', '.XXHs', '.X...'];
  const OVAL = ['.XXX', 'XXHX', 'XHXD', 'sXD.'];
  // 잎 하나의 세 모습: 앞면 · 옆으로 선 모습(얇게) · 기울어 뒤집힌 면
  const LEAF = [
    [MAPLE, ['XXHXX', '.DsD.'], mirror(MAPLE_T)],
    [OVAL, ['.XXH', 'sXD.'], rot90(OVAL)],
  ];
  const LEAF_PAL = [
    { X: '#ee8a2c', H: '#ffc561', D: '#c0621c', s: '#7a3a14' },
    { X: '#d8432e', H: '#ff8a62', D: '#a02a1c', s: '#6a1a10' },
    { X: '#f2b632', H: '#ffe38e', D: '#c98a18', s: '#8a5a12' },
    { X: '#a8703a', H: '#d6a062', D: '#7e5024', s: '#4e3018' },
  ];

  // ---------- 파리 ----------
  function fly(r, x, y, d, t, i, perched) {
    const flap = perched ? -1 : Math.floor(t * 26 + i * 3) % 2;
    // 날개 (몸 뒤에 먼저)
    if (flap === 0) {
      r.px(x - d, y - 1, 'rgba(232,244,255,0.95)', false);
      r.px(x, y - 1, 'rgba(232,244,255,0.8)', false);
      r.px(x - d, y - 2, 'rgba(232,244,255,0.5)', false);
    } else if (flap === 1) {
      r.px(x - d, y - 1, 'rgba(232,244,255,0.55)', false);
      r.px(x - 2 * d, y - 1, 'rgba(232,244,255,0.75)', false);
    } else {
      r.px(x - d, y - 1, 'rgba(232,244,255,0.7)', false);
      r.px(x - 2 * d, y, 'rgba(232,244,255,0.55)', false);
    }
    r.px(x - d, y, '#2d5560', false); // 초록빛 도는 엉덩이
    r.px(x, y, '#16181d', false);
    r.px(x + d, y, '#b8392d', false); // 빨간 겹눈
    if (perched) {
      // 앉아서 앞발을 싹싹 비빈다
      if (Math.floor(t * 8) % 2) r.px(x + d, y + 1, '#16181d', false);
      else r.px(x + 2 * d, y, '#16181d', false);
    } else if (Math.floor(t * 6 + i) % 3 === 0) r.px(x, y + 1, 'rgba(22,24,29,0.6)', false);
  }

  // ---------- 핑글핑글 별 ----------
  const STAR5 = ['..X..', '.XHX.', 'XXHXX', '.XXX.', '.D.D.'];
  const TWINK5 = ['..H..', '..X..', 'HXWXH', '..X..', '..H..'];
  const STAR_PAL = [
    { X: '#ffd23f', H: '#fff7c2', D: '#e0921a', W: '#ffffff' },
    { X: '#ffb238', H: '#ffe7a0', D: '#d9741a', W: '#ffffff' },
    { X: '#ffe86a', H: '#fffbe0', D: '#e0b020', W: '#ffffff' },
  ];
  // 머리 둘레 비스듬한 타원 궤도. 앞쪽 반(sin>0)은 front, 뒤쪽 반은 back 에서 그린다
  function dizzy(r, a, t, front) {
    const cx = a.hx + 0.5, cy = a.earTop - 1.5 + Math.sin(t * 2.3) * 0.5;
    const rx = a.hw + 4, ry = 2.4;
    const at = (ang) => [cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry + Math.cos(ang) * 0.9];
    const W = 3.4;
    // 별 셋 + 그 사이 작은 반짝이 셋
    for (let i = 0; i < 6; i++) {
      const big = i % 2 === 0;
      const ang = t * W + (i * Math.PI * 2) / 6;
      const s = Math.sin(ang);
      if ((s > 0) !== front) continue;
      const [x, y] = at(ang);
      const X = Math.round(x), Y = Math.round(y);
      const pal = STAR_PAL[(i / 2) | 0] || STAR_PAL[0];
      if (!front) {
        // 머리 뒤로 돌아갈 땐 작고 흐리게
        r.px(X, Y, big ? 'rgba(255,214,90,0.75)' : 'rgba(255,240,170,0.5)', false);
        continue;
      }
      if (!big) {
        const on = Math.floor(t * 8 + i) % 3;
        if (on) r.px(X, Y, '#fff6c8', false);
        if (on === 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) r.px(X + dx, Y + dy, 'rgba(255,226,120,0.7)', false);
        continue;
      }
      // 꼬리: 궤도를 따라 흐려지는 점 둘
      for (let k = 1; k <= 2; k++) {
        const [tx, ty] = at(ang - k * 0.32);
        r.px(tx, ty, `rgba(255,220,110,${A(0.6 - k * 0.22)})`, false);
      }
      if (s > 0.45) r.pattern(Math.floor(t * 7 + i) % 3 ? STAR5 : TWINK5, X - 2, Y - 2, pal, false);
      else r.pattern(['.X.', 'XHX', '.X.'], X - 1, Y - 1, pal, false);
    }
  }

  // 슬로우모션 잔상: 도트 맵을 옆으로 밀어서 반투명하게 한 겹 더 찍는다. scan 이면 한 줄 걸러 찍는다
  function ghost(r, g, dx, fill, line, tint, scan) {
    const rows = g.m.rows;
    for (let j = 0; j < rows.length; j++) {
      if (scan && (j + scan) % 2) continue;
      const y = Math.round(g.y0 + j + g.lift(j));
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        r.px(Math.round(g.x0 + i + dx), y, `rgba(${tint},${A(ch === 'O' ? line : fill)})`, false);
      }
    }
  }

  // 화면 좌표 → 캔버스 원본 좌표 (뒤집힌 상태면 좌우 반전)
  const scrX = (r, x) => (r.facing < 0 ? G - 1 - x : x);

  const ACC = {
    humming: {
      // 콧노래: 입가에서 음표가 톡 생겨나 흔들흔들 떠오르다 스르르 사라진다. 입가엔 작은 소리 물결
      front(g, a, c, t) {
        const K = 4, P = 2.8;
        for (let i = 0; i < K; i++) {
          const tt = t + (i * P) / K;
          const n = Math.floor(tt / P);
          const p = (tt % P) / P;
          const e = easeOut(p);
          const side = hash(n * 7 + i) < 0.62 ? 1 : -1;
          const pal = NOTE_PAL[(n * 3 + i) % NOTE_PAL.length];
          const hv = hash(n * 5 + i);
          const sh = hv > 0.62 ? BEAM : hv > 0.3 ? N8 : N16;
          const w = sh[0].length;
          const x0 = side > 0 ? a.right + 1 : a.left - w;
          const x = Math.round(x0 + side * e * 3 + Math.sin(tt * 3.4 + i) * 1.4);
          const y = Math.round(a.my - 3 - e * 17);
          const al = p < 0.1 ? p / 0.1 : p > 0.7 ? (1 - p) / 0.3 : 1;
          faded(this, al, () => {
            if (p < 0.09) {
              // 막 생겨난 음표: 작은 점
              this.px(x + 1, y + 3, pal.X, false);
              this.px(x + 1, y + 4, pal.D, false);
            } else this.pattern(upright(this, sh), x, y, pal, false);
            // 한가운데쯤에서 반짝
            if (p > 0.4 && p < 0.52) this.px(x + (side > 0 ? w : -1), y - 1, '#ffffff', false);
          });
        }
        // 입가 소리 물결 ~
        const wv = (t * 1.6) % 1;
        if (wv < 0.6) {
          const al = wv < 0.15 ? wv / 0.15 : (0.6 - wv) / 0.45;
          const bx = a.right + 1;
          for (let j = 0; j < 4; j++) this.px(bx + j, a.my - 1 + (j % 2 ? -1 : 0), `rgba(255,150,190,${A(al * 0.85)})`, false);
        }
      },
    },
    matrixrain: {
      // 콤퓨타 세계: 뒤로 초록 코드 글자가 칸칸이 쏟아지고(맨 앞 글자는 하얗게, 꼬리는 흐리게),
      // 바닥엔 초록 격자, 고양이 둘레엔 조준 괄호. 가끔 스캔 빛줄기가 고양이를 훑고 지나간다
      back(g, a, c, t) {
        // 줄은 화면에 못 박아 둔다: 고양이가 돌아서도(캔버스 좌우 반전) 같은 자리로 일자로 내려온다.
        // 글자도 칸마다 천천히만 바뀐다 (2칸 폭 글자가 빨리 바뀌면 좌우로 떨리는 것처럼 보였다)
        const CELL = 4, TOP = 5;
        const nCells = Math.floor((GROUND - 1 - TOP) / CELL);
        for (let i = 0; i < 8; i++) {
          const sx = 9 + i * 4;
          const x = this.facing < 0 ? G - 2 - sx : sx;
          const sp = 4 + hash(i) * 6;
          const len = 4 + Math.floor(hash(i + 3) * 5);
          const cyc = nCells + len + 2 + Math.floor(hash(i + 5) * 8);
          const head = Math.floor(t * sp + hash(i + 17) * cyc) % cyc;
          for (let k = 0; k <= len; k++) {
            const ci = head - k;
            if (ci < 0 || ci >= nCells) continue;
            const y = TOP + ci * CELL;
            const gi = Math.floor(hash(i * 37 + ci * 11 + Math.floor(t * 0.8 + hash(ci + i * 3) * 4)) * GLYPH.length);
            let col;
            if (k === 0) col = '#eafff0';
            else if (k === 1) col = '#8dffab';
            else col = `rgba(40,${Math.round(215 - k * 12)},96,${A(0.85 * (1 - (k - 1) / len))})`;
            this.pattern(upright(this, GLYPH[gi]), x, y, { X: col }, false);
            // 맨 앞 글자 바로 아래 초록 번짐
            if (k === 0) { this.px(x, y + 3, 'rgba(120,255,160,0.35)', false); this.px(x + 1, y + 3, 'rgba(120,255,160,0.35)', false); }
          }
        }
        // 바닥 격자: 밝은 가로줄 한 줄 + 퍼져 나가는 세로 금. 빛 한 점이 가로줄을 따라 달린다
        const cx = a.cx;
        for (let x = cx - 16; x <= cx + 16; x++) {
          const d = Math.abs(x - cx);
          this.px(x, GROUND + 1, `rgba(60,230,120,${A(0.55 - d * 0.025)})`, false);
        }
        for (let k = -4; k <= 4; k++) {
          const al = 0.45 - Math.abs(k) * 0.06;
          this.px(cx + k * 4, GROUND + 2, `rgba(60,230,120,${A(al)})`, false);
          if (Math.abs(k) <= 3) this.px(cx + k * 5, GROUND + 3, `rgba(60,230,120,${A(al * 0.7)})`, false);
        }
        const run = cx - 16 + ((t * 18) % 33);
        this.px(run, GROUND + 1, '#d8ffe4', false);
        this.px(run - 1, GROUND + 1, 'rgba(160,255,190,0.7)', false);
      },
      front(g, a, c, t) {
        // 조준 괄호: 고양이 둘레 네 귀퉁이 (살짝 숨 쉬듯 벌어졌다 좁혀진다)
        const pad = 2 + (Math.sin(t * 3) > 0.6 ? 1 : 0);
        const x0 = a.left - pad - 1, x1 = a.right + pad + 1;
        const y0 = a.earTop - pad, y1 = GROUND - 1;
        const col = Math.floor(t * 2) % 5 === 0 ? 'rgba(200,255,215,0.95)' : 'rgba(80,240,130,0.8)';
        for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
          this.px(x, y, col, false);
          this.px(x + dx, y, col, false);
          this.px(x, y + dy, col, false);
        }
        // 스캔 빛줄기: 2.6초마다 위에서 아래로 한 번, 고양이 도트만 초록으로 물든다
        const ph = (t % 2.6) / 1.1;
        if (ph < 1) {
          const sy = Math.round(a.earTop + ph * (GROUND - a.earTop));
          const ctx = this.ctx;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          for (let k = 0; k < 2; k++) {
            const y = sy - k;
            if (y < 0 || y >= G) continue;
            const d = ctx.getImageData(0, y, G, 1).data;
            ctx.fillStyle = k ? 'rgba(90,255,140,0.3)' : 'rgba(150,255,185,0.6)';
            for (let x = 0; x < G; x++) if (d[x * 4 + 3] > 120) ctx.fillRect(x, y, 1, 1);
          }
          ctx.restore();
        }
      },
    },
    loadspin: {
      // 머리 위 로딩 스피너: 흐린 고리 위로 밝은 꼬리가 늘었다 줄었다 하며 빙글빙글 돈다. 끝나지 않는다
      front(g, a, c, t) {
        const cx = a.hx + 0.5, cy = a.earTop - 7 + Math.round(Math.sin(t * 1.7) * 0.6);
        const R = 4.2;
        const best = new Map();
        const put = (ang, w) => {
          const x = Math.round(cx + Math.cos(ang) * R - 0.5);
          const y = Math.round(cy + Math.sin(ang) * R);
          const k = x + ',' + y;
          if (!best.has(k) || best.get(k)[2] < w) best.set(k, [x, y, w]);
        };
        for (let s = 0; s < 48; s++) put((s / 48) * Math.PI * 2, 0);
        const head = t * 5.2 + Math.sin(t * 2.4) * 0.7;
        const L = 1.3 + (Math.sin(t * 2.4 - 1) * 0.5 + 0.5) * 2.4;
        for (let s = 0; s <= 40; s++) put(head - (s / 40) * L, 1 - s / 40 + 0.001);
        for (const [x, y, w] of best.values()) {
          const col = w === 0 ? 'rgba(90,110,150,0.35)' : w > 0.85 ? '#ffffff' : w > 0.6 ? '#bfe7ff' : w > 0.3 ? '#62b6ff' : 'rgba(64,128,230,0.8)';
          this.px(x, y, col, false);
        }
      },
    },
    autumnleaf: {
      // 가을 낙엽: 단풍잎·둥근 잎이 시계추처럼 흔들리며 팔랑 뒤집히고 떨어진다. 머리와 바닥엔 몇 장 쌓여 있다
      front(g, a, c, t) {
        for (let i = 0; i < 9; i++) {
          const sp = 4.5 + hash(i) * 3.5;
          const y = Math.round(((t * sp + hash(i + 40) * 50) % 50) + 3);
          if (y > GROUND - 2) continue;
          const ph = t * (1.6 + hash(i + 3) * 0.6) + i * 1.7;
          const x = Math.round(a.cx - 15 + hash(i + 70) * 25 + Math.sin(ph) * 2.5);
          const cs = Math.cos(ph);
          const kind = LEAF[i % 2 === 0 ? 0 : 1];
          const fr = cs > 0.35 ? 0 : cs < -0.35 ? 2 : 1;
          const pal = LEAF_PAL[(i * 3) % LEAF_PAL.length];
          // 위에서 스르르 나타나고, 바닥 가까이 오면 스르르 옅어진다
          const al = y > GROUND - 8 ? (GROUND - 2 - y) / 6 : Math.min(1, (y - 2) / 5);
          faded(this, al, () => this.pattern(kind[fr], x, y, pal, false));
        }
        // 쌓인 잎: 머리 위 한 장, 발치 양옆에 소복이
        const P = LEAF_PAL;
        this.pattern(['X.X', 'XHX', '.s.'], a.hx + 1, a.top - 2, P[1], false);
        const pile = (x, rows) => rows.forEach((row, j) => {
          for (let k = 0; k < row.length; k++) {
            const ch = row[k];
            if (ch === '.') continue;
            const pp = P['0123'.indexOf(ch) >= 0 ? +ch : 0];
            this.px(x + k, GROUND - rows.length + 1 + j, (k + j) % 3 ? pp.X : pp.H, false);
          }
        });
        pile(a.left - 8, ['..1..', '.0223', '32110']);
        pile(a.right + 3, ['.2...', '10.3.', '3021.']);
      },
    },
    afterimage: {
      // 잔상: 가는 쪽 뒤로 하늘·보라·분홍빛 반투명 고양이 세 겹이 늦게 따라온다. 맨 뒤 겹은 줄무늬로 흩어진다
      back(g, a, c, t) {
        // 창·카드 밖으로 안 나가게 겹 간격은 2칸 남짓, 맨 뒤 겹도 몸에서 7칸 안쪽
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.8);
        const pp = Math.round(pulse);
        const scan = 1 + (Math.floor(t * 10) % 2);
        ghost(this, g, -6 - pp, 0.04, 0.3, '255,120,220', scan);
        ghost(this, g, -4 - pp, 0.07, 0.42, '170,125,255', 0);
        ghost(this, g, -2 - pp, 0.16, 0.55, '100,205,255', 0);
        // 속도선: 몸 뒤로 길이가 다른 줄 넷이 흘러간다
        for (let k = 0; k < 4; k++) {
          const y = a.cy - 5 + k * 3 + (k > 1 ? 1 : 0);
          if (y > GROUND) continue;
          const len = 2 + Math.round(hash(k + 4) * 2 + pulse);
          const x0 = a.left - 3 - Math.floor((t * 9 + hash(k) * 6) % 4);
          for (let q = 0; q < len; q++) this.px(x0 - q, y, `rgba(${q < 2 ? '255,255,255' : '170,220,255'},${A(0.8 - (q / len) * 0.7)})`, false);
        }
        // 흩날리는 반짝이
        const sp = Math.floor(t * 3);
        if ((t * 3) % 1 < 0.5) {
          const x = Math.round(a.left - 5 - hash(sp) * 4);
          const y = Math.round(a.top + hash(sp + 3) * (GROUND - a.top - 2));
          this.px(x, y, '#ffffff', false);
          this.px(x - 1, y, 'rgba(190,160,255,0.6)', false);
          this.px(x + 1, y, 'rgba(190,160,255,0.6)', false);
          this.px(x, y - 1, 'rgba(190,160,255,0.6)', false);
          this.px(x, y + 1, 'rgba(190,160,255,0.6)', false);
        }
      },
    },
    frostbreath: {
      // 호~ 입김: 입에서 뭉게구름 같은 하얀 김이 호— 하고 퍼지며 앞으로 흘러가 흩어진다.
      // 둘레엔 작은 얼음 결정이 반짝, 볼은 추워서 발그레
      front(g, a, c, t) {
        const P = 2.4;
        for (let i = 0; i < 2; i++) {
          const tt = t + i * P * 0.5;
          const p = (tt % P) / P;
          if (p > 0.82) continue;
          const q = p / 0.82;
          const e = easeOut(q);
          const n = Math.floor(tt / P);
          const x = a.fx + 3 + e * 9;
          const y = a.my + 1 - e * 4 + Math.sin(q * 5) * 0.5;
          const rr = 0.9 + e * 2.6;
          const blobs = [[0, 0, rr], [-rr * 0.7, 0.5, rr * 0.72], [rr * 0.75, -0.4, rr * 0.7]];
          const al = (q < 0.08 ? q / 0.08 : q > 0.5 ? (1 - q) / 0.5 : 1) * 0.95;
          const R = Math.ceil(rr * 1.8) + 1;
          for (let dy = -R; dy <= R; dy++)
            for (let dx = -R; dx <= R; dx++) {
              const px = Math.round(x + dx), py = Math.round(y + dy);
              let dmin = 9;
              for (const [bx, by, br] of blobs) dmin = Math.min(dmin, Math.hypot(px - (x + bx), (py - (y + by)) * 1.05) / br);
              if (dmin > 1) continue;
              // 흩어질수록 구멍이 숭숭
              if (q > 0.45 && hash(px * 7 + py * 13 + n * 5) < (q - 0.45) * 1.3) continue;
              const col = dmin < 0.5 ? `rgba(255,255,255,${A(al)})` : dmin < 0.8 ? `rgba(236,246,255,${A(al * 0.85)})` : `rgba(190,222,248,${A(al * 0.7)})`;
              this.px(px, py, col, false);
            }
        }
        // 얼음 결정
        for (let k = 0; k < 3; k++) {
          const tt = t * 0.7 + k * 1.3;
          const x = Math.round(a.cx - 12 + hash(k + 20) * 24 + Math.sin(tt * 1.6) * 2);
          const y = Math.round(a.top - 4 + ((tt * 3 + hash(k) * 16) % 16));
          const tw = Math.floor(t * 4 + k) % 4;
          if (tw === 0) continue;
          this.px(x, y, tw === 2 ? '#ffffff' : '#cfeaff', false);
          if (tw === 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.px(x + dx, y + dy, 'rgba(180,220,255,0.75)', false);
        }
        // 발그레한 볼
        const B = 'rgba(255,112,136,0.6)';
        const by = a.ey + a.eh + 1;
        this.px(a.eyeL - 1, by, B, false);
        this.px(a.eyeL, by, 'rgba(255,112,136,0.35)', false);
        this.px(a.eyeR + a.ew, by, B, false);
        this.px(a.eyeR + a.ew - 1, by, 'rgba(255,112,136,0.35)', false);
      },
    },
    dizzystars: {
      // 머리가 핑글핑글: 별 셋과 작은 반짝이 셋이 비스듬한 궤도로 머리 둘레를 돈다.
      // 앞으로 올 땐 크게 반짝, 뒤로 돌아가면 작게 머리에 가려진다
      back(g, a, c, t) { dizzy(this, a, t, false); },
      front(g, a, c, t) { dizzy(this, a, t, true); },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);

// ---- 이전 디자인으로 되돌린 것 (2026-09-24 피드백: 다듬은 것보다 이전 게 낫다) ----
// 도우미 이름이 위쪽 새 그림과 겹쳐서 따로 묶는다
(function (root) {
  const { GROUND, hash } = root.PetSprite.costumeKit;
  const G = 48;
  const A = (v) => Math.max(0, Math.min(1, v)).toFixed(2);

  // 음표 ♪ ♫
  function fly(r, x, y, d, on) {
    r.px(x, y, '#1c1c1c', false);
    r.px(x - d, y, '#1c1c1c', false);
    r.px(x + d, y, '#3a2a2a', false);
    if (on) {
      r.px(x, y - 1, 'rgba(225,235,255,0.95)', false);
      r.px(x - d, y - 1, 'rgba(225,235,255,0.75)', false);
    } else {
      r.px(x - d, y - 1, 'rgba(225,235,255,0.5)', false);
    }
  }

  // 빙글 별 궤도: 앞쪽 반(sin>0)은 front, 뒤쪽 반은 back 에서 그린다

  const ACC = {
    flytrio: {
      // 파리 세 마리: 머리 둘레를 8자로 윙윙. 지나간 자리엔 점선 궤적이 잠깐 남는다
      front(g, a, c, t) {
        const pos = (i, tt) => {
          const w = 2.1 + i * 0.45;
          const ang = tt * w + i * 2.1;
          return [
            a.hx + Math.sin(ang) * (8 + i * 2) + Math.sin(tt * 11 + i) * 0.8,
            a.ey - 6 + Math.sin(ang * 2) * (2.5 + i) + Math.cos(tt * 9 + i) * 0.6,
            Math.cos(ang) >= 0 ? 1 : -1,
          ];
        };
        for (let i = 0; i < 3; i++) {
          for (let k = 2; k <= 6; k += 2) {
            const [tx, ty] = pos(i, t - k * 0.035);
            this.px(tx, ty, `rgba(40,40,40,${A(0.35 - k * 0.04)})`, false);
          }
          const [x, y, d] = pos(i, t);
          fly(this, Math.round(x), Math.round(y), d, Math.floor(t * 24 + i) % 2 === 0);
        }
      },
    },
    glitchfx: {
      // 도트 깨짐: 가끔 치직 — 가로 줄 몇 개가 옆으로 밀리고 가장자리에 빨강/하늘 번짐, 죽은 픽셀이 튄다
      front(g, a, c, t) {
        const P = 1.7;
        const ph = (t + 0.4) % P;
        const n = Math.floor((t + 0.4) / P);
        const on = ph < 0.22 || (ph > 0.34 && ph < 0.46);
        if (!on) {
          // 평소엔 죽은 픽셀 하나만 가끔 깜빡
          if (Math.floor(t * 3) % 4 === 0) this.px(a.right + 3, a.ey - 4 + (n % 3), '#ff3df0', false);
          return;
        }
        const f = Math.floor(t * 20);
        const ctx = this.ctx;
        const y0 = a.earTop, y1 = GROUND;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const bands = 2 + (f % 2);
        for (let b = 0; b < bands; b++) {
          const h = 1 + Math.floor(hash(f * 5 + b) * 3);
          const y = Math.round(y0 + hash(f * 3 + b * 7 + n) * (y1 - y0 - h));
          const sh = (hash(f + b * 11) > 0.5 ? 1 : -1) * (1 + Math.floor(hash(f * 7 + b) * 3));
          const img = ctx.getImageData(0, y, G, h);
          ctx.clearRect(0, y, G, h);
          ctx.putImageData(img, sh, y);
          // 밀린 줄 가장자리에 RGB 번짐
          const d = img.data;
          for (let j = 0; j < h; j++) {
            let lo = -1, hi = -1;
            for (let x = 0; x < G; x++) if (d[(j * G + x) * 4 + 3] > 40) { if (lo < 0) lo = x; hi = x; }
            if (lo < 0) continue;
            ctx.fillStyle = 'rgba(255,40,80,0.85)';
            ctx.fillRect(lo + sh - 1, y + j, 1, 1);
            ctx.fillStyle = 'rgba(40,230,255,0.85)';
            ctx.fillRect(hi + sh + 1, y + j, 1, 1);
          }
        }
        ctx.restore();
        // 튀는 죽은 픽셀
        const NC = ['#ff3df0', '#3dfff0', '#b6ff3d', '#ffffff'];
        for (let k = 0; k < 4; k++) {
          const x = Math.round(a.cx - 13 + hash(f * 9 + k) * 26);
          const y = Math.round(a.top - 4 + hash(f * 4 + k * 3) * (GROUND - a.top + 2));
          const col = NC[(f + k) % NC.length];
          this.px(x, y, col, false);
          if (k % 2) this.px(x + 1, y, col, false);
        }
      },
    },
    thinkbubble: {
      // 'Claude가 생각 중…': 말풍선 속에서 주황 반짝이가 빙글 돌고 점 세 개가 차례로 통통 뛴다
      front(g, a, c, t) {
        const W = 15, H = 7;
        const x0 = a.hx + 1, y0 = a.top - 11 + Math.round(Math.sin(t * 1.8) * 0.6);
        const K = c.K || '#3b2a20';
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const corner = (x === 0 || x === W - 1) && (y === 0 || y === H - 1);
            if (corner) continue;
            const edge = x === 0 || x === W - 1 || y === 0 || y === H - 1;
            this.px(x0 + x, y0 + y, edge ? K : '#fffaf2', false);
          }
        // 꼬리: 작은 동그라미 둘
        this.px(x0 + 1, y0 + H, K, false);
        this.px(x0 - 1, y0 + H + 2, K, false);
        // Claude 반짝이 (+ 와 × 를 번갈아)
        const O = '#d97757';
        const sx = x0 + 3, sy = y0 + 3;
        this.px(sx, sy, O, false);
        if (Math.floor(t * 4) % 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.px(sx + dx, sy + dy, O, false);
        else for (const [dx, dy] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) this.px(sx + dx, sy + dy, O, false);
        // 점 셋: 차례로 한 칸 뛰어오른다
        for (let i = 0; i < 3; i++) {
          const k = Math.floor(t * 5) % 5;
          const up = k === i ? 1 : 0;
          this.px(x0 + 7 + i * 2, y0 + 4 - up, k > 3 || i <= k ? '#6b5a4c' : '#c8bcae', false);
        }
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);
