// 보물 공방 코스튬 (2026-09-24) C: 손 4 + 효과 4. 주운 보물을 재료로 만든다. accessories.js 뒤에 읽는다
// 손(hand: true)은 오른앞발(heldPaw)로 쥐고, 잘 때(a.curled)는 옆 바닥에 내려놓는다.
// 효과 입자는 solid=false 로 찍고, 펫 창이 투명하니 넓은 면은 칠하지 않는다.
// 색은 pixelart.js TREASURE(FOOD_PALETTE) 도트와 맞췄다
(function (root) {
  const { GROUND, sway, hash, heldPaw, star } = root.PetSprite.costumeKit;
  const A = (v) => Math.max(0, Math.min(1, v)).toFixed(2);

  // 보물 도트 색 (FOOD_PALETTE)
  const P = {
    W: '#fffaf3', w: '#f1e6d2', G: '#d3cabb', g: '#9aa0aa', D: '#565d69',
    R: '#e5463f', r: '#a52e2a', Pk: '#ff9bb8', pk: '#e0668f', O: '#f59232',
    Y: '#ffd65a', y: '#e0a91e', N: '#79c46b', n: '#4a8c42', B: '#72b3ea', b: '#3a6fb0',
    T: '#e0a764', t: '#b07436', S: '#f6d7a2', s: '#e3b877', C: '#8a5a34', c: '#5c3a1f',
    V: '#b683f2', v: '#8454c4', M: '#9fe3c8', m: '#5cb895', H: '#ffffff', I: '#fbf7ee', X: '#2f3a33',
  };

  // 두 점 사이 도트 줄
  function lineTo(r, x0, y0, x1, y1, col, solid = true) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) r.px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col, solid);
  }
  // 여러 점을 잇는 도트 경로 (중복 없이)
  function pathPts(pts) {
    const out = [];
    const seen = new Set();
    for (let k = 0; k + 1 < pts.length; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
        const key = x + ',' + y;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push([x, y]);
      }
    }
    return out;
  }

  // ---------- 크레용 낙서 모양 (가운데 0,0 기준 도트 경로) ----------
  const DOODLES = (() => {
    const starV = [];
    for (let i = 0; i <= 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? 1.6 : 4;
      starV.push([Math.round(Math.cos(ang) * rr), Math.round(Math.sin(ang) * rr)]);
    }
    const spiral = [];
    for (let k = 0; k <= 16; k++) {
      const ang = k * 0.8;
      const rr = 0.2 + k * 0.24;
      spiral.push([Math.round(Math.cos(ang) * rr), Math.round(Math.sin(ang) * rr)]);
    }
    const sun = [];
    for (let k = 0; k <= 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      sun.push([Math.round(Math.cos(ang) * 2), Math.round(Math.sin(ang) * 2)]);
    }
    const sunPts = pathPts(sun);
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const [x0, y0, x1, y1] = [Math.cos(ang) * 3.3, Math.sin(ang) * 3.3, Math.cos(ang) * 4.4, Math.sin(ang) * 4.4].map(Math.round);
      for (const p of pathPts([[x0, y0], [x1, y1]])) sunPts.push(p);
    }
    const heart = pathPts([[0, 2], [-2, 0], [-2, -1], [-1, -2], [0, -1], [1, -2], [2, -1], [2, 0], [0, 2]]);
    const squiggle = pathPts([[-4, 0], [-3, -1], [-2, 0], [-1, 1], [0, 0], [1, -1], [2, 0], [3, 1], [4, 0]]);
    return { star: pathPts(starV), spiral: pathPts(spiral), sun: sunPts, heart, squiggle };
  })();

  // 주인공 클로버 9×9 (가운데 4,4). 잎 셋은 왼위·오른위·오른아래, 왼아래가 4번째 잎 자리. 줄기는 가운데서 아래로
  const LEAF_TL = [[1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3], [3, 3]];
  const mirX = (l) => l.map(([x, y]) => [8 - x, y]);
  const mirY = (l) => l.map(([x, y]) => [x, 8 - y]);
  const LEAF_TR = mirX(LEAF_TL), LEAF_BR = mirY(LEAF_TR);
  // 4번째 잎은 가운데 쪽부터 한 칸씩 돋는다 (마지막 한 칸 [1,7] 은 끝내 못 채운다)
  const LEAF_BL = [[3, 5], [2, 5], [3, 6], [2, 6], [1, 6], [2, 7]];
  const STEM = [[4, 5], [4, 6], [4, 7], [5, 8]];

  // 칸 목록을 채우고 둘레에 진한 테를 두른다 (solid=false)
  function leafy(r, x0, y0, cells, fill, rim, hi) {
    const on = new Set(cells.map(([x, y]) => x + ',' + y));
    for (const [x, y] of cells) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!on.has(x + dx + ',' + (y + dy))) r.px(x0 + x + dx, y0 + y + dy, rim, false);
      }
    }
    for (const [x, y] of cells) r.px(x0 + x, y0 + y, hi && hi.has(x + ',' + y) ? '#c8f5b0' : fill, false);
  }
  const MINI = ['.N.', 'NnN', '..n'];

  const ACC = {
    // ================= 손 =================

    // 1. 고무줄 새총: 둥지 짓다 만 나뭇가지 Y자 + 노란 고무줄. 가끔 고무줄을 쭉 당겼다가 과자 부스러기를 퉁
    rubberslingshot: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, C: P.C, c: P.c, N: P.N, Y: P.Y, y: P.y };
        if (a.curled) {
          // 옆으로 눕힌 Y자
          this.pattern(['.......KK', '......KCK', 'KKKKKKCK.', 'KCCcCCK..', 'KKKKKKCK.', '......KCK', '.......KK'], a.right + 1, GROUND - 6, m);
          for (let y = GROUND - 5; y <= GROUND - 1; y++) this.px(a.right + 9, y, y === GROUND - 3 ? P.y : P.Y);
          return;
        }
        const x = a.right + 3, y0 = a.cy - 12;
        // 가지: 줄기 + 두 갈래. 왼쪽 갈래에 새순 하나
        this.pattern(
          ['KK...KK', 'KCK.KCK', 'KCK.KcK', '.KCKCK.', '.KcCCK.', '..KCK..', '..KCK..', '..KcK..', '..KCK..', '..KCK..', '..KKK..'],
          x - 3, y0, m,
        );
        this.px(x - 4, y0 + 2, P.N);
        this.px(x - 5, y0 + 1, P.N);
        // 당기기: 3.2초에 한 번 (0~0.9 당김, 0.9~1.1 퉁)
        const ph = t % 3.2;
        const L = [x - 3, y0 + 1], Rt = [x + 3, y0 + 1];
        if (ph < 0.9) {
          const k = Math.min(1, ph / 0.6);
          const px = Math.round(x - k * 1.5), py = Math.round(y0 + 2 + k * 4);
          lineTo(this, L[0], L[1], px, py, P.Y);
          lineTo(this, Rt[0], Rt[1], px, py, P.Y);
          // 걸어 둔 부스러기 알
          this.pattern(['TT', 'Tt'], px - 1, py - 1, { T: P.T, t: P.t });
          if (k >= 1 && Math.floor(t * 14) % 2) this.px(px - 2, py, P.y, false);
        } else {
          const wob = ph < 1.4 ? (Math.floor(t * 20) % 2 ? 1 : -1) : 0;
          for (let i = L[0] + 1; i < Rt[0]; i++) this.px(i, y0 + 1 + (i === x ? 1 : 0) + (i === x ? wob : 0), P.Y);
          // 날아가는 부스러기
          if (ph < 1.6) {
            const q = (ph - 0.9) / 0.7;
            const bx = Math.round(x + 1 + q * 9), by = Math.round(y0 - q * 6 + q * q * 3);
            this.px(bx, by, P.T, false);
            this.px(bx - 1, by + 1, `rgba(224,167,100,${A(0.6 * (1 - q))})`, false);
          }
        }
        heldPaw(this, g, x, a.cy + 1);
      },
    },

    // 2. 이쑤시개 레이피어: 양끝 뾰족한 이쑤시개 칼날, 반창고 둘둘 감은 손잡이, 클립 구부린 날밑. 가끔 휙 찌르기
    toothpickrapier: {
      hand: true,
      front(g, a, c, t) {
        const T = P.T, tt = P.t, S = P.S, s = P.s, gr = P.g;
        if (a.curled) {
          const y = GROUND - 1;
          for (let x = a.right + 5; x <= a.right + 12; x++) this.px(x, y, x === a.right + 12 ? tt : T);
          for (let x = a.right + 2; x <= a.right + 4; x++) { this.px(x, y, x === a.right + 3 ? S : s); this.px(x, y - 1, c.K); }
          this.px(a.right + 1, y, T);
          this.px(a.right + 5, y - 1, gr);
          this.px(a.right + 5, y - 2, gr);
          return;
        }
        const x = a.right + 1;
        const ph = t % 2.6;
        const lunge = ph < 0.45;
        const base = a.cy - 3;
        // 칼날: 평소엔 곧게 위로, 찌를 땐 오른쪽 위로 눕는다
        const len = 13;
        let tipX = x, tipY = base - len;
        for (let i = 1; i <= len; i++) {
          const bx = lunge ? Math.round(x + i * 0.8) : x;
          const by = lunge ? Math.round(base - i * 0.6) : base - i;
          this.px(bx, by, i >= len - 1 ? tt : T);
          if (!lunge && i < len - 1) this.px(bx + 1, by, 'rgba(176,116,54,0.55)', false);
          tipX = bx; tipY = by;
        }
        // 날밑: 펴서 구부린 클립 (은색 고리)
        this.pattern(['.GG.GG.', 'G..G..G', '.GG.GG.'], x - 3, base - 1, { G: gr });
        // 반창고 손잡이 (가운데 패드에 구멍 두 개)
        this.pattern(['KsK', 'KSK', 'KsK', 'KSK', 'KsK'], x - 1, base + 1, { K: c.K, S, s });
        this.px(x, base + 2, P.t);
        // 반대쪽 뾰족 끝
        this.px(x, base + 6, T);
        heldPaw(this, g, x, a.cy + 1);
        if (lunge) {
          star(this, tipX + 2, tipY - 1, '#fff6d0');
          for (let i = 0; i < 3; i++) this.px(x - 2 - i, base - 4 - i * 2, 'rgba(255,255,255,0.6)', false);
        } else if (ph > 2.3) {
          this.px(tipX, tipY - 1, '#ffffff', false);
        }
      },
    },

    // 3. 짝짝이 양말 인형: 짝 잃은 양말에 굴러다니던 눈알 두 개(짝짝이 크기). 앞발에 끼고 뻐끔뻐끔
    socksock: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, W: P.W, w: P.w, R: P.R, r: P.r, d: '#5a1a1a', p: P.Pk };
        const googly = (x, y, big, off) => {
          if (big) {
            this.pattern(['.KKK.', 'KHHHK', 'KHHHK', 'KHHHK', '.KKK.'], x, y, { K: c.K, H: P.H });
            this.px(x + 2 + off[0], y + 2 + off[1], '#1a1410');
          } else {
            this.pattern(['KKKK', 'KHHK', 'KHHK', 'KKKK'], x, y, { K: c.K, H: P.H });
            this.px(x + 1 + (off[0] > 0 ? 1 : 0), y + 1 + (off[1] > 0 ? 1 : 0), '#1a1410');
          }
        };
        const wob = (k) => {
          const n = Math.floor(t * 3 + k * 7);
          return [Math.round((hash(n) - 0.5) * 2.2), Math.round((hash(n + 11) - 0.5) * 2.2)];
        };
        if (a.curled) {
          // 옆에 벌러덩 누워 같이 잔다
          const x0 = a.right + 1, y0 = GROUND - 4;
          this.pattern(['.KKKKKKKKKK.', 'KRWRWWWWWWRK', 'KRWRWWWWWWRK', '.KKKKKKKKKK.'], x0, y0, m);
          this.pattern(['KKKK', 'KHHK', 'KKKK'], x0 + 7, y0 - 2, { K: c.K, H: P.H });
          this.px(x0 + 8, y0 - 1, '#1a1410');
          return;
        }
        // 3초 중 1.6초 동안 떠든다
        const talking = t % 3 < 1.6;
        const open = talking && Math.floor(t * 5) % 2 === 0;
        const bob = talking ? 0 : sway(t, 2, 1) > 0 ? -1 : 0;
        const x0 = a.right - 1, yb = a.cy + 3;
        const upper = ['..KKKKK...', '.KRRRRRK..', 'KWWWWWWWK.', 'KWWWWWWWWK'];
        const lower = open
          ? ['KWWWWWKKKK', 'KWWWWKdddd', 'KWWWWKpppK', 'KWWWWWKKKK', '.KWWWWWWK.']
          : ['KWWWWWKKKK', 'KWWWWWWWWK', '.KWWWWWWK.'];
        const body = ['..KWWwWK..', '..KRRRRK..', '..KWWWWK..', '..KRRRRK..', '..KKKKKK..'];
        const rows = [...upper, ...lower, ...body];
        const y0 = yb - rows.length + 1 + bob;
        this.pattern(rows, x0, y0, m);
        // 뒤꿈치 구멍으로 앞발 털이 빼꼼
        this.px(x0 + 3, y0 + upper.length + lower.length, g.c.body);
        googly(x0 + 1, y0 + 1, true, wob(1));
        googly(x0 + 5, y0 + 2, false, wob(2));
      },
    },

    // 4. 다음 주엔 된다 복권 부채: 꽝 복권과 영수증을 접어 클립으로 묶은 부채. 살랑살랑 부친다
    lotteryfan: {
      hand: true,
      front(g, a, c, t) {
        const N = 5;
        const fan = (px, py, off, spread, R) => {
          const slipW = (spread * 2) / N;
          this.shape(
            (x, y) => {
              const dx = x + 0.5 - px, dy = y + 0.5 - py;
              const rr = Math.hypot(dx, dy);
              const ang = Math.atan2(dx, -dy) - off;
              return rr <= R && rr >= 2.2 && Math.abs(ang) <= spread && dy < 1;
            },
            [px - R - 1, py - R - 1, px + R + 1, py + 1],
            (x, y) => {
              const dx = x + 0.5 - px, dy = y + 0.5 - py;
              const rr = Math.hypot(dx, dy);
              const ang = Math.atan2(dx, -dy) - off + spread;
              const k = Math.min(N - 1, Math.floor(ang / slipW));
              const u = ang / slipW - k;
              if (u < 0.16) return '#8f8a80'; // 접힌 선
              const lotto = k % 2 === 0;
              const ri = Math.round(rr);
              if (lotto) {
                // 복권: 빨간 숫자 점, 끝 줄은 분홍 띠
                if (ri >= Math.round(R)) return P.Pk;
                if (ri <= 3) return P.Pk;
                if ((ri === 5 || ri === 7) && u > 0.35 && u < 0.85 && hash(k * 9 + ri) > 0.25) return P.R;
                return P.W;
              }
              // 영수증: 회색 글줄
              if ((ri === 4 || ri === 6 || ri === 8) && u > 0.3 && u < 0.9) return P.g;
              return P.I;
            },
            c.K,
          );
          // 사북: 은색 클립
          this.px(px, py, P.g);
          this.px(px - 1, py, P.D);
        };
        if (a.curled) {
          // 접은 부채를 바닥에 눕혀 둔다
          const y = GROUND - 3;
          this.pattern(['.KKKKKKKKK', 'KgWIWIWPWK', 'KgWRWgWPWK', '.KKKKKKKKK'], a.right + 1, y, { K: c.K, g: P.g, W: P.W, I: P.G, R: P.R, P: P.Pk });
          return;
        }
        const px = a.right + 2, py = a.cy - 1;
        const off = 0.25 + Math.sin(t * 3) * 0.28;
        fan(px, py, off, 0.95, 9.2);
        heldPaw(this, g, px - 1, a.cy + 1);
        // 부칠 때 바람 한 줄 (왼쪽으로 크게 넘어갈 때만)
        const v = Math.cos(t * 3);
        if (v < -0.6) {
          for (let i = 0; i < 3; i++) this.px(px - 11 - i, a.cy - 9 + i * 3, 'rgba(210,235,255,0.75)', false);
        }
        // 가끔 "다음 주엔 된다" 반짝
        if (t % 4 < 0.25) star(this, px + 6, py - 11, '#fff3b0');
      },
    },

    // ================= 효과 =================

    // 5. 사탕 껍질 반짝이: 반짝이는 사탕 껍질 조각이 뒤집히며 팔랑팔랑 내려오고, 과자 부스러기 몇 톨
    candysparkle: {
      front(g, a, c, t) {
        const foils = [
          [P.Pk, P.pk], [P.M, P.m], [P.Y, P.y], [P.V, P.v], [P.B, P.b], [P.Pk, P.pk], [P.O, '#c8661b'],
        ];
        const lanes = [a.left - 7, a.left - 3, a.hx - 4, a.hx + 3, a.right + 3, a.right + 7, a.left - 5];
        for (let i = 0; i < foils.length; i++) {
          const span = GROUND - a.earTop + 12;
          const sp = 3.2 + hash(i + 4) * 2.4;
          const yy = ((t * sp + hash(i) * span) % span) + a.earTop - 10;
          const x = Math.round(lanes[i] + Math.sin(t * 1.7 + i * 1.9) * 2);
          const y = Math.round(yy);
          // 얼굴 위는 지나가지 않는다
          if (x > a.left && x < a.right && y > a.top) continue;
          const [col, dk] = foils[i];
          const flip = Math.floor(t * 5 + i * 1.3) % 3;
          const fade = y > GROUND - 4 ? A((GROUND - y) / 4) : '1';
          this.ctx.globalAlpha = +fade;
          if (flip === 0) this.pattern(['X.X', 'XHX', 'X.X'], x - 1, y - 1, { X: col, H: '#ffffff' }, false);
          else if (flip === 1) this.pattern(['X.D', '.X.', 'D.X'], x - 1, y - 1, { X: col, D: dk }, false);
          else this.pattern(['.X.', '.D.', '.X.'], x - 1, y - 1, { X: dk, D: col }, false);
          this.ctx.globalAlpha = 1;
          // 은박이 번쩍
          if (Math.floor(t * 3 + hash(i + 20) * 9) % 7 === 0) this.px(x + 1, y - 2, '#ffffff', false);
        }
        // 바닥 부스러기 (가끔 하나씩 톡 떨어진다)
        const crumbs = [[a.left - 4, 0], [a.right + 2, 1], [a.right + 6, 0], [a.left - 1, 1]];
        crumbs.forEach(([x, big], i) => {
          this.px(x, GROUND - 1, i % 2 ? P.t : P.T, false);
          if (big) this.px(x + 1, GROUND - 1, P.t, false);
        });
        const q = (t % 2.8) / 2.8;
        if (q < 0.5) this.px(a.right + 4, Math.round(a.cy - 2 + q * 2 * (GROUND - a.cy + 1)), P.T, false);
      },
    },

    // 6. 크레용 낙서: 부러진 크레용으로 별·해·소용돌이·하트가 한 획씩 그려졌다 사라진다. 포스트잇 한 장이 허공에 붙어 있다
    crayondoodle: {
      front(g, a, c, t) {
        const slots = [
          { k: 'sun', x: a.left - 4, y: a.earTop - 6, col: P.O, lite: P.Y },
          { k: 'star', x: a.right + 4, y: a.earTop - 7, col: P.B, lite: '#b8dcff' },
          { k: 'spiral', x: a.left - 6, y: a.cy + 1, col: P.V, lite: '#dcc4ff' },
          { k: 'heart', x: a.right + 7, y: a.cy - 2, col: P.R, lite: P.Pk },
          { k: 'squiggle', x: a.hx + 7, y: a.earTop - 15, col: P.N, lite: '#c4f0b8' },
        ];
        const PER = 6.5;
        slots.forEach((s, i) => {
          const tt = t + i * 1.3;
          const p = (tt % PER) / PER;
          const pts = DOODLES[s.k];
          let n = pts.length, al = 1;
          if (p < 0.35) n = Math.max(1, Math.floor((p / 0.35) * pts.length));
          else if (p > 0.85) al = (1 - p) / 0.15;
          const cyc = Math.floor(tt / PER);
          this.ctx.globalAlpha = al;
          for (let j = 0; j < n; j++) {
            const [dx, dy] = pts[j];
            // 크레용 결: 군데군데 연하게
            const h = hash(j * 13 + i * 7 + cyc);
            this.px(s.x + dx, s.y + dy, h > 0.8 ? s.lite : s.col, false);
          }
          this.ctx.globalAlpha = 1;
          // 그리는 중이면 끝에 크레용 토막
          if (p < 0.35) {
            const [dx, dy] = pts[n - 1];
            this.px(s.x + dx + 1, s.y + dy - 1, s.col, false);
            this.px(s.x + dx + 2, s.y + dy - 2, '#fffaf3', false);
          }
        });
        // 포스트잇: 왼쪽 위 허공에 붙어서 살짝 팔랑. 끄적인 글줄 두 줄
        const flap = Math.floor(t * 1.5) % 4 === 0;
        const px = a.hx - 4, py = a.earTop - 15 + (Math.floor(t * 0.8) % 2);
        this.pattern(
          flap ? ['YYYYy', 'YbbYY', 'YYYYY', 'YbYbY', 'YYYy.'] : ['YYYYY', 'YbbYY', 'YYYYY', 'YbYbY', 'YYYYy'],
          px, py, { Y: P.Y, y: P.y, b: '#6a7280' }, false,
        );
      },
    },

    // 7. 찌릿찌릿 정전기: 털끝마다 노란 스파크가 튀고 잔털이 쭈뼛. 가끔 귀 사이로 큰 번개가 치고 클립이 끌려온다
    staticshock: {
      front(g, a, c, t) {
        const Yc = '#ffe65a', Wc = '#fffbe0';
        // 머리 둘레 털끝 (귀 끝, 이마 양옆, 볼 양옆)
        const tips = [
          [a.left + 1, a.earTop], [a.right - 1, a.earTop],
          [a.left - 1, a.top + 3], [a.right + 1, a.top + 3],
          [a.left - 1, a.ey + 1], [a.right + 1, a.ey + 1],
          [a.hx, a.top - 1],
        ];
        const tick = Math.floor(t * 9);
        tips.forEach(([x, y], i) => {
          const dir = x < a.hx ? -1 : x > a.hx ? 1 : 0;
          // 쭈뼛 선 잔털 (옅게, 항상)
          this.px(x + dir, y - 1, 'rgba(255,245,200,0.55)', false);
          // 짧은 지그재그 스파크 (번갈아 켜진다)
          if (hash(tick * 3 + i * 17) > 0.62) {
            const up = dir === 0 ? [[0, -1], [1, -2], [0, -3]] : [[dir, -1], [dir * 2, 0], [dir * 3, -1]];
            up.forEach(([dx, dy], k) => this.px(x + dx, y + dy, k === 1 ? Wc : Yc, false));
          }
        });
        // 큰 번개: 2.7초마다 귀 끝과 귀 끝 사이가 번쩍
        const ph = t % 2.7;
        const L = tips[0], Rt = tips[1];
        if (ph < 0.35) {
          const n = Rt[0] - L[0];
          for (let i = 0; i <= n; i++) {
            const zig = Math.floor((i + tick) / 2) % 2 ? -1 : 0;
            const y = L[1] - 3 + zig - Math.round(Math.sin((i / n) * Math.PI) * 2);
            this.px(L[0] + i, y, ph < 0.12 ? Wc : Yc, false);
          }
          star(this, L[0], L[1] - 2, Yc);
          star(this, Rt[0], Rt[1] - 2, Yc);
        }
        // 정전기에 끌려온 클립: 오른쪽 볼 옆에 붙어서 달달 떨고, 큰 번개 때 튕긴다
        const jump = ph < 0.35 ? -2 : 0;
        const jit = Math.floor(t * 12) % 2;
        const cx = a.right + 3 + (jit && ph < 1 ? 1 : 0), cy = a.earTop - 6 + jump;
        this.pattern(['.ss.', 'sLLs', 's.Ls', 'sL.s', 'sLs.', '.s..'], cx, cy, { s: '#5d6470', L: '#dfe3ea' }, false);
        this.px(cx - 1, cy + 6, 'rgba(255,230,90,0.8)', false);
        // 다 쓴 건전지: 발치에 작게 누워 있다 (가끔 +극이 찌릿)
        const bx = a.left - 6, by = GROUND - 2;
        this.pattern(['DDDDO', 'DDDDO'], bx, by, { D: P.D, O: P.O }, false);
        this.px(bx + 5, by, '#c9ccd2', false);
        if (hash(tick + 99) > 0.8) this.px(bx + 6, by - 1, Yc, false);
      },
    },

  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);
