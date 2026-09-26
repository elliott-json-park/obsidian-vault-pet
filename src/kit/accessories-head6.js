// 6차 코스튬 (2026-09-24): 머리 6 + 얼굴 5. accessories.js 뒤에 읽는다
(function (root) {
  const { GROUND, sway, hood, mirror, rowsAt } = root.PetSprite.costumeKit;
  // 곰돌이 잠옷(bearsuit)·후드(bearhood)와 같은 천. 원숭이 후드가 그 잠옷과 세트로 어울리게 그대로 쓴다
  const BEAR = { T: '#9a6a43', shade: '#855a37', trim: '#e8c9a0', hi: '#b5835a', deep: '#d4ab7c' };

  // 둥지 짚: 두 방향으로 엇갈린 가닥이 엮인 결. 아래로 갈수록 그늘
  const NEST = { d: '#5e3b1e', b: '#8a5a32', l: '#b07a45', h: '#dcae6e' };
  function straw(x, y, j) {
    const u = (((x + y * 2) % 5) + 5) % 5;
    const v = (((x - y) % 4) + 4) % 4;
    let col = v === 0 ? NEST.d : u === 0 ? NEST.h : u < 3 ? NEST.b : NEST.l;
    if (j >= 6 && col === NEST.h) col = NEST.l; // 밑단은 그늘이라 밝은 가닥이 한 단 어둡다
    else if (j >= 6 && col === NEST.l) col = NEST.b;
    return col;
  }

  // 깃털 한 가닥: 뿌리(bx, by)에서 ang(라디안, 0 = 위, + = 오른쪽) 방향으로 len 칸, bend 만큼 휘며 뻗는다.
  // 아래 1/4 은 금 깃대, 위는 흰 깃(오른쪽 반은 그늘). 깃마다 자기 외곽선을 둘러서 겹쳐도 한 가닥씩 보인다
  function feather(r, bx, by, ang, len, wid, bend, K, tip) {
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const u = k / 24, th = ang + bend * u;
      pts.push([bx + Math.sin(ang + bend * u * 0.5) * len * u, by - Math.cos(ang + bend * u * 0.5) * len * u, u, th]);
    }
    const near = (x, y) => {
      let best = null;
      for (const p of pts) {
        const d = Math.hypot(x - p[0], y - p[1]);
        if (!best || d < best.d) best = { d, u: p[2], th: p[3], side: Math.cos(p[3]) * (x - p[0]) + Math.sin(p[3]) * (y - p[1]) };
      }
      return best;
    };
    const w = (u) => (u < 0.28 ? 0.45 : wid * Math.pow(Math.sin(Math.PI * Math.min(1, (u - 0.28) / 0.72)), 0.6) + 0.35);
    const x0 = Math.floor(bx - len - 2), x1 = Math.ceil(bx + len + 2), y0 = Math.floor(by - len - 2);
    const cells = [];
    for (let y = y0; y <= by; y++)
      for (let x = x0; x <= x1; x++) {
        const n = near(x + 0.5, y + 0.5);
        if (n.u >= 0.999 && n.d > 0.6) continue;
        if (n.d <= w(n.u)) cells.push([x, y, n]);
        else if (n.u >= 0.28 && n.d <= w(n.u) + 1) r.px(x, y, K);
      }
    for (const [x, y, n] of cells) {
      let col = n.u < 0.28 ? '#c9981f' : n.side > 0.35 ? '#ddd3c4' : '#fbf8f2';
      if (tip && n.u > 0.82) col = n.side > 0.35 ? '#e0b030' : '#ffd65a';
      r.px(x, y, col);
    }
  }

  const ACC = {
    // ======================= 머리 =======================
    birdnest: {
      // 나뭇가지 둥지를 머리에 얹었다. 크림 알 · 하늘색 알이 하나씩 들어 있고, 가끔 하늘색 알이 깨지며 아기 새가 빼꼼
      front(g, a, c, t) {
        const x0 = a.hx - 8, y0 = a.top - 7;
        const K = c.K;
        // 둥지 모양: x = 짚, i = 속(어두운 안쪽). 알은 뒷테두리(0~2줄)와 앞테두리(3줄~) 사이에 끼워 그린다
        const N = [
          '....KKKKKKKKK....',
          '..KKxxxxxxxxxKK..',
          '.KxxiiiiiiiiixxK.',
          'KxxxxxxxxxxxxxxxK',
          'KxxxxxxxxxxxxxxxK',
          '.KxxxxxxxxxxxxxK.',
          '..KKxxxxxxxxxKK..',
          '....KKKKKKKKK....',
        ];
        const paint = (from, to) => {
          for (let j = from; j <= to; j++) {
            const row = N[j];
            for (let i = 0; i < row.length; i++) {
              const ch = row[i], x = x0 + i, y = y0 + j;
              if (ch === 'K') this.px(x, y, K);
              else if (ch === 'i') this.px(x, y, (i * 7 + j) % 5 === 0 ? '#5a3a1c' : '#3a2412');
              else if (ch === 'x') this.px(x, y, j === 1 && (i + j) % 3 === 0 ? NEST.h : straw(x, y, j));
            }
          }
        };
        paint(0, 2);
        const m = { K, H: '#ffffff', W: '#f6eedb', w: '#d8cab0', s: '#9a8468', U: '#a8dcf0', u: '#6fa8c4', Y: '#ffd65a', y: '#e8a82a', O: '#ff8c1a', k: '#1f1c1b' };
        // 크림 알 (갈색 점박이)
        this.pattern(['.KK.', 'KHWK', 'KWsK', 'KwWK'], a.hx - 4, y0 - 1, m);
        const peek = t % 7 < 2.2;
        if (peek) {
          // 알 윗부분이 톱니 모양으로 깨지고 노란 아기 새가 쏙. 부리를 벌렸다 다물었다
          const beak = Math.floor(t * 6) % 2 ? 'O' : 'y';
          this.pattern(['.KKK..', 'KYHYK.', 'KYkY' + beak + 'K', 'KYYYK.', 'KUKUK.', 'KUuUK.'], a.hx + 1, y0 - 3, m);
        } else {
          this.pattern(['.KK.', 'KHUK', 'KUuK', 'KuUK'], a.hx + 1, y0 - 1, m);
        }
        paint(3, 7);
        // 삐져나온 잔가지와 작은 잎사귀
        for (const [dx, dy, col] of [[-1, 4, NEST.l], [-2, 3, NEST.h], [17, 4, NEST.b], [18, 5, NEST.l], [15, 1, NEST.h], [16, 0, NEST.l], [5, 8, NEST.b]]) this.px(x0 + dx, y0 + dy, col);
        this.pattern(['NN', 'nN'], x0 + 1, y0 + 1, { N: '#78c46a', n: '#4b8f43' });
      },
    },
    glovecomb: {
      // 분홍 고무장갑을 머리에 뒤집어써서 빵빵하게 부푼 손가락 네 개가 닭볏처럼 섰다.
      // 반들반들한 고무 광택, 말린 소매 끝, 옆으로 삐죽 나온 엄지. 손가락이 하나씩 말랑말랑 흔들린다
      front(g, a, c, t) {
        const K = c.K;
        const m = { K, P: '#ff7fb0', p: '#d9528a', H: '#ffc2dc', W: '#ffffff', C: '#ffa3c8', c: '#e0689a' };
        const x0 = a.hx - 6, base = a.top;
        const tops = [3, 0, 1, 4];
        tops.forEach((tf, f) => {
          const wob = Math.floor(t * 2.5 + f * 1.7) % 6 === 0 ? 1 : 0;
          const top = base - 11 + tf - wob;
          const x = x0 + 3 * f;
          this.px(x + 1, top, K); this.px(x + 2, top, K);
          for (let y = top + 1; y <= base - 5; y++) {
            this.px(x, y, K); this.px(x + 3, y, K);
            const k = y - top;
            this.px(x + 1, y, k === 1 ? m.H : k === 2 ? m.W : m.P);
            this.px(x + 2, y, k === 1 ? m.P : m.p);
          }
        });
        this.pattern(['KHPPPPPPPPPpK', 'KPPPPPPPPPppK'], x0, base - 4, m);
        this.pattern(['KcccccccccccccK', 'KCWCCCCCCCCCCcK', '.KKKKKKKKKKKKK.'], x0 - 1, base - 2, m);
        // 엄지: 왼쪽으로 비스듬히 삐죽
        this.pattern(['.KK..', 'KHPK.', 'KPpK.', '.KPpK', '..KPP', '...K.'], x0 - 4, base - 8, m);
      },
    },
    shrimpband: {
      // 빨간 머리띠 위에 바삭한 새우튀김이 꼿꼿이 섰다. 빨간 꼬리 지느러미가 위, 튀김옷은 울퉁불퉁 노릇노릇. 꼬리가 탱글탱글
      front(g, a, c, t) {
        const K = c.K;
        // 머리띠: 정수리 줄을 두 겹 빨간 띠로 (귀는 띠 위로 솟는다)
        this.pattern(['KRRHHRRRRRRRK', 'KrrrrrrrrrrdK'], a.left, a.top, { K, R: '#e8343a', r: '#b0222a', H: '#ff8a80', d: '#861a22' });
        for (const x of [a.hx - 1, a.hx, a.hx + 1]) this.px(x, a.top - 1, K);
        const s = sway(t, 3, 1);
        const m = { K, R: '#ff5a4a', r: '#c0322a', F: '#ffb0a0', Y: '#f0b44a', H: '#ffe08a', y: '#c98a2e', d: '#a86a20', W: '#fff6d0' };
        const rows = [
          'KK...KK',
          'KFK.KRK',
          'KRRKRrK',
          '.KRRrK.',
          '..KrK..',
          '.KKYKK.',
          'KHWYYyK',
          'KHYYHyK',
          '.KHYYyK',
          'KYHYYyK',
          'KHYYYdK',
          '.KHYyK.',
          '..KKK..',
        ];
        const dx = rows.map((_, j) => (j < 5 ? s : j < 8 ? Math.round(s / 2) : 0));
        rowsAt(this, rows, a.hx - 3, a.top - 13, m, dx);
        // 튀김 부스러기가 옷 밖으로 톡톡
        this.px(a.hx - 4, a.top - 5, m.y);
        this.px(a.hx + 4, a.top - 4, m.Y);
      },
    },
    mushcap: {
      // 빨간 바탕에 흰 점박이 광대버섯 갓. 위는 반들반들, 오른쪽 아래로 그늘. 점도 입체라 아래쪽이 살짝 어둡고, 갓 밑엔 크림색 주름살
      front(g, a, c, t) {
        const m = { K: c.K, R: '#e8343a', H: '#ff7b6e', r: '#b0222a', d: '#861a22', W: '#fffaf0', w: '#e3d5c0', S: '#f3e2c0', s: '#c9ae82' };
        this.pattern(
          [
            '.....KKKKKKK.....',
            '...KKRHHRRRRKK...',
            '..KRHHWWRRRWWrK..',
            '.KRHRWWWwRRWwrrK.',
            '.KRRRWwwRRRRRrrK.',
            'KRWWRRRRRRWWRRrrK',
            'KWWwRRRRRRWwwRrdK',
            'KrwrRRRWWRRRRrddK',
            'KKKKKKKKKKKKKKKKK',
            '.KSsSsSsSsSsSsSK.',
            '..KKKKKKKKKKKKK..',
          ],
          a.hx - 8, a.earTop - 6, m,
        );
      },
    },
    gradcap: {
      // 졸업 학사모. 비스듬히 보이는 네모판(윗면 밝게 · 앞 모서리 두께) + 머리에 맞는 모자, 가운데 금단추에서 술이 판 끝으로 넘어가 대롱대롱
      front(g, a, c, t) {
        const m = { K: c.K, k: '#262a40', h: '#3f4668', l: '#565e88', d: '#15172a', Y: '#ffd65a', y: '#c9981f' };
        this.pattern(
          ['KkkkkkkkkkkkK', 'KhkkkkkkkkkdK', 'KhkkkkkkkkkdK', 'KKKKKKKKKKKKK'],
          a.hx - 6, a.earTop, m,
        );
        this.pattern(
          [
            '........KKK........',
            '.....KKKlllKKK.....',
            '..KKKllhhhhhllKKK..',
            'KKlhhhhhhYhhhhhhhKK',
            '.dKKKkkkkkkkkkKKKd.',
            '...ddKKKkkkKKKdd...',
            '......ddKKKdd......',
          ],
          a.hx - 9, a.earTop - 5, m,
        );
        // 술: 단추에서 판 오른쪽 모서리까지 가서 아래로 늘어진다. 꼬인 끈이라 금색이 번갈아
        for (let x = a.hx + 1; x <= a.hx + 8; x++) this.px(x, a.earTop - 2, x % 2 ? m.Y : m.y);
        const s = sway(t, 3.5, 1);
        for (let j = 0; j < 3; j++) this.px(a.hx + 9 + (j === 2 ? s : 0), a.earTop - 1 + j, j % 2 ? m.y : m.Y);
        this.pattern(['.K.', 'KyK', 'KYK', 'YyY', 'Y.Y'], a.hx + 8 + s, a.earTop + 2, m);
      },
    },
    monkeyhood: {
      // 곰돌이 잠옷과 같은 갈색 천의 원숭이 후드. 얼굴 구멍이 원숭이 얼굴 모양(위가 하트처럼 두 번 볼록)이고,
      // 머리 양옆에 커다란 C 자 원숭이 귀(안쪽은 배 색), 정수리엔 곱슬 앞머리 한 가닥. 고양이 귀는 후드 속에 쏙 들어간다
      front(g, a, c) {
        const T = BEAR.T, Tr = BEAR.trim, S = BEAR.shade, K = c.K;
        const face = (dx, y) => {
          const adx = Math.abs(dx);
          if (y >= a.ey - 1) return adx <= 4;
          if (y === a.ey - 2) return adx >= 1 && adx <= 3;
          return false;
        };
        hood(this, g, a, (dx, y) => {
          if (face(dx, y)) return null;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (face(dx + ox, y + oy)) return Tr;
          return Math.abs(dx) >= 6 ? S : T;
        });
        const bottom = a.curled ? GROUND - 1 : a.my + 2;
        for (let y = a.top; y <= bottom; y++) {
          this.px(a.left, y, S);
          this.px(a.right, y, S);
          this.px(a.left - 1, y, K);
          this.px(a.right + 1, y, K);
        }
        // 귀를 덮는 둥근 정수리 (왼쪽 위에 천 광택)
        const m = { K, T, S, H: BEAR.hi, P: Tr, p: BEAR.deep };
        this.pattern(['....KKKKKKK....', '..KKTHHTTTTKK..', '.KTHHTTTTTTTSK.', 'KSTTTTTTTTTTTSK'], a.hx - 7, a.earTop - 1, m);
        // 곱슬 앞머리
        this.pattern(['..KK.', '.KHTK', 'KTK..', '.K...'], a.hx - 2, a.earTop - 4, m);
        // 커다란 원숭이 귀: 머리 옆면에 붙어 바깥으로 둥글게. 안쪽은 배 색, 가운데는 한 톤 짙게
        const EAR = ['..KKKK', '.KHTTT', 'KHTPPT', 'KTPppT', 'KTPppT', 'KTTPPT', '.KSTTT', '..KKKK'];
        const ey = a.ey - 4;
        this.pattern(EAR, a.left - 6, ey, m);
        this.pattern(mirror(EAR), a.right + 1, ey, m);
      },
    },

    // ======================= 얼굴 =======================
    grannyspecs: {
      // 콧등까지 흘러내린 동그란 금테 돋보기. 눈은 안경 너머로 치켜뜨고(눈썹 번쩍), 양옆엔 진주·금 구슬 안경줄이 축 늘어진다
      front(g, a, c, t) {
        const y = a.ey + 1;
        const m = { G: '#ffd65a', F: '#a87818', f: '#6e4a10', L: '#c6e6f5', l: '#9cc8e0', H: '#ffffff' };
        // 동그란 렌즈 (위 테는 밝은 금, 옆 · 아래는 짙은 금). 웅크려 자면 한 줄 낮은 납작 렌즈
        const glint = t % 3.4 < 0.25;
        const LENS = a.curled ? ['.GG.', 'fHlf', '.ff.'] : ['.GG.', 'f' + (glint ? 'L' : 'H') + 'Lf', 'fLlf', '.ff.'];
        for (const x of [a.eyeL, a.eyeR]) this.pattern(LENS, x - 1, y, m);
        this.px(a.eyeL + 2, y + 1, m.F); this.px(a.eyeR - 1, y + 1, m.F);
        for (let x = a.eyeL + 3; x < a.eyeR - 1; x++) this.px(x, y + 1, m.G);
        // 구슬 안경줄: 안경다리 끝에서 머리 바깥으로 나가 아래로 처진다 (진주·금 번갈아)
        const beads = ['#fffaf0', '#ffd65a'];
        const bottom = Math.min(GROUND - 1, a.my + 5);
        for (const s of [-1, 1]) {
          const x0 = s < 0 ? a.eyeL - 2 : a.eyeR + a.ew + 1;
          this.px(x0, y + 1, m.f);
          let k = 0;
          for (let yy = y + 2; yy <= bottom; yy++, k++) this.px(x0 + s * (1 + (k >= 2 ? 1 : 0)), yy, beads[k % 2]);
        }
        // 안경 너머로 치켜뜬 눈썹
        this.px(a.eyeL, a.ey - 2, c.K); this.px(a.eyeL + 1, a.ey - 2, c.K);
        this.px(a.eyeR, a.ey - 2, c.K); this.px(a.eyeR + 1, a.ey - 2, c.K);
      },
    },
    cucumbereyes: {
      // 팩 하는 중. 두 눈 위에 동글동글 오이 한 조각씩 (진초록 껍질 · 연두 과육 · 가운데 씨). 물기에 반짝, 가끔 물방울이 또르르
      front(g, a, c, t) {
        const m = { D: '#2f6b2a', d: '#4f8f3a', L: '#cdeaa0', n: '#a8d884', s: '#f2fbd8', H: '#ffffff' };
        for (const x of [a.eyeL, a.eyeR]) this.pattern(['.DdD.', 'DHLLD', 'dLsLD', 'DLLnD', '.DDD.'], x - 1, a.ey - 1, m);
        const p = (t % 4) / 1.2;
        if (p < 1) this.px(a.eyeR + 2, a.ey + 4 + Math.round(p * 2), 'rgba(170,220,255,0.9)', false);
      },
    },
    caterbrows: {
      // 짱구 눈썹: 새까맣고 두툼한 눈썹 두 줄기. 가끔 한쪽씩 꿈틀 치켜 올라간다
      front(g, a, c, t) {
        // 두툼한 먹색 눈썹 두 줄기: 둥근 윗면에 윤기 한 점, 바깥 끝이 눈 옆으로 축 처진다
        const m = { X: '#121214', h: '#3a3a46' };
        const BROW = ['.hXXX', 'XXXXX', 'XX...'];
        const n = Math.floor(t * 1.4);
        const upL = n % 5 === 0 ? 1 : 0, upR = n % 5 === 2 ? 1 : 0;
        // 웅크려 자면 정수리가 한 줄 낮아서 눈썹도 따라 내린다 (머리 밖으로 뜨지 않게)
        const y = a.curled ? a.ey - 2 : a.ey - 3;
        this.pattern(BROW, a.eyeL - 2, y - upL, m);
        this.pattern(mirror(BROW), a.eyeR - 1, y - upR, m);
      },
    },
    foggyglasses: {
      // 라면 먹다 김이 서린 뿔테 안경. 렌즈가 하얗게 뿌옇다가 위에서부터 서서히 걷히고, 김이 모락모락
      front(g, a, c, t) {
        const m = { k: '#141418', h: '#4a4a58' };
        const x0 = a.eyeL - 2, y0 = a.ey - 1;
        this.pattern(['.hhk...hhk.', 'k...kkk...k', 'k...k.k...k', '.kkk...kkk.'], x0, y0, m);
        this.px(x0 - 1, a.ey, m.k);
        this.px(x0 + 11, a.ey, m.k);
        // 김: 4.5초 주기로 가득 → 위에서부터 걷힘 → 다시 서림
        const p = (t % 4.5) / 4.5;
        const clear = p < 0.55 ? 0 : p < 0.85 ? Math.floor(((p - 0.55) / 0.3) * 3) : 0;
        for (const lx of [x0 + 1, x0 + 7]) {
          for (let j = 0; j < 2; j++) {
            if (j < clear) continue;
            for (let i = 0; i < 3; i++) {
              const al = 0.8 + 0.16 * Math.sin(i * 1.7 + j * 2.3 + t * 2);
              this.px(lx + i, y0 + 1 + j, `rgba(246,249,252,${al.toFixed(2)})`, false);
            }
          }
        }
        // 모락모락 김: 구불구불 올라가며 흐려진다
        for (const [dx, ph] of [[1, 0], [5, 0.7], [9, 1.4]]) {
          const q = ((t + ph) % 2.1) / 2.1;
          const yy = y0 - 1 - Math.round(q * 5);
          const xx = x0 + dx + Math.round(Math.sin(q * 7 + ph) * 0.9);
          const al = 0.85 * (1 - q);
          this.px(xx, yy, `rgba(255,255,255,${al.toFixed(2)})`, false);
          this.px(xx + (Math.sin(q * 7 + ph) > 0 ? 1 : -1), yy - 1, `rgba(255,255,255,${(al * 0.6).toFixed(2)})`, false);
        }
      },
    },
    masquerade: {
      // 흰 바탕에 금 세공 테를 두른 가면무도회 가면. 바깥 끝이 날개처럼 치켜 올라가고, 뺨엔 금 덩굴 무늬.
      // 오른쪽 위 금 장식(진주 박힘)에 흰 깃털 세 가닥이 부채처럼 꽂혀 머리 위로 솟아 살랑인다
      front(g, a, c, t) {
        const m = { K: c.K, W: '#fbf8f2', w: '#dcd2c2', G: '#ffd65a', g: '#c9981f', Y: '#fff0a8', o: '#8a6410', P: '#fff4f8' };
        const bx = a.fx + 5, by = a.ey - 2;
        // 깃털 세 가닥이 부채처럼: 왼쪽으로 기운 것, 오른쪽으로 기운 짧은 것, 가운데 가장 긴 금빛 끝 깃털을 맨 앞에
        const sw = Math.sin(t * 2.2) * 0.12;
        feather(this, bx + 0.5, by + 0.5, -0.3 + sw, 8.5, 1.05, -0.4, m.K, false);
        feather(this, bx + 1.5, by + 0.5, 0.6 + sw, 7, 1, 0.35, m.K, false);
        feather(this, bx + 1, by + 0.5, 0.12 + sw, 11, 1.15, 0.25, m.K, true);
        this.pattern(
          [
            'Y.............Y',
            'GYK....Y....KYG',
            'KgGYGgGGGgGYGgK',
            'KWWW..WWW..WWWK',
            'KWgW..WwW..WgWK',
            '.KWgWWwKwWWgWK.',
            '..KKKKK.KKKKK..',
          ],
          a.fx - 7, a.ey - 3, m,
        );
        // 깃털 뿌리를 감싼 금 장식 + 진주
        this.pattern(['.KK.', 'KGgK', 'gPGg', '.oo.'], bx - 1, by - 2, m);
        if (Math.floor(t * 1.3) % 4 === 0) this.px(a.fx - 4, a.ey - 1, '#ffffff');
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);
