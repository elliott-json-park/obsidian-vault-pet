// 6차 코스튬 (2026-09-24): 손 17. accessories.js 뒤에 읽는다
// 모두 hand: true — 오른앞발(heldPaw)로 쥐고, 잘 때(a.curled)는 옆 바닥에 내려놓는다
// 색은 밝은 면 → 기본 → 그늘 세 단계 + 하이라이트 한 점, 외곽선은 고양이 외곽선 색(c.K)으로 맞춘다
(function (root) {
  const { GROUND, sway, hash, heldPaw, star } = root.PetSprite.costumeKit;

  // 세워 그리는 그림(draw)을 오른쪽으로 90° 눕혀 바닥에 놓는다. 위쪽 끝이 고양이 반대편(오른쪽)을 향한다.
  // draw 는 쥐는 자리가 (gx, gy) 인 보통 좌표로 그린다. box = 쥐는 자리 기준 [왼, 위, 오른, 아래] 끝.
  // 눕히면 세운 그림의 오른쪽 끝이 바닥에 닿고, 아래쪽 끝(손잡이)이 x0 열에 온다
  function lay(r, a, box, draw, x0) {
    const gx = 24, gy = 30;
    const [, , bx1, by1] = box;
    const X = (x0 == null ? a.right + 2 : x0) + gy + by1, Y = GROUND - gx - bx1;
    const top = r.top;
    r.ctx.save();
    r.ctx.translate(X + 1, Y);
    r.ctx.rotate(Math.PI / 2);
    draw(gx, gy);
    r.ctx.restore();
    r.top = top;
  }

  const ACC = {


    // 3. 호떡 뒤집개: 구멍 뚫린 스텐 뒤집개 + 나무 손잡이. 꿀호떡이 폴짝 뛰어 한 바퀴 뒤집힌다
    hotteokturner: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, H: '#ffffff', S: '#e6ebf2', s: '#a4aebc', k: '#4a525e', T: '#b87a44', t: '#7a4520', o: '#e0e6ee',
          O: '#e2a456', Y: '#ffe29a', b: '#b06a2c', h: '#7a3c14' };
        const blade = ['KKKKKKKK', 'KHSSSSsK', 'KSkSkSkK', 'KSkSkSkK', 'KSkSkSkK', '.KsSSsK.', '..KKKK..', '...KsK..', '...KsK..', '...KTK..', '...KtK..', '...KTK..', '...KoK..', '...KtK..', '...KKK..'];
        const top = ['..KKKKKKK..', '.KOYOOObOK.', 'KObOOYOObOK', '.KbbObbObK.', '..KKKKKKK..'];
        const bot = ['..KKKKKKK..', '.KbhbbhbbK.', 'KhbbhbbhbbK', '.KbbObbObK.', '..KKKKKKK..'];
        const edge = ['.KKKKKKKKK.', 'KbObbObbObK', '.KKKKKKKKK.'];
        if (a.curled) {
          this.pattern(['KKKKKKKKKKKKKKKK', 'KTtTotKsKSSSSSsK', 'KKKKKKKKKKKKKKKK'], a.right + 1, GROUND - 2, m);
          this.pattern(top, a.right + 6, GROUND - 6, m);
          return;
        }
        const x = a.right + 1, y = a.cy + 1;
        const y0 = y - 11;
        this.pattern(blade, x - 4, y0, m);
        heldPaw(this, g, x, y);
        // 2.4초마다 폴짝: 올라가며 옆면 → 뒷면(노릇한 탄 자국) → 옆면 → 앞면으로 한 바퀴
        const ph = (t % 2.4) / 0.7;
        const air = ph < 1;
        const up = air ? Math.round(Math.sin(ph * Math.PI) * 6) : 0;
        let pat = top;
        if (air) pat = ph < 0.2 ? top : ph < 0.35 ? edge : ph < 0.65 ? bot : ph < 0.8 ? edge : top;
        this.pattern(pat, x - 5, y0 - pat.length + 1 - up, m);
        if (!air) {
          for (let i = 0; i < 2; i++) {
            const p = (t * 0.8 + i * 0.5) % 1;
            this.px(x - 2 + i * 4 + Math.round(Math.sin(p * 6 + i)), y0 - 6 - Math.round(p * 5), `rgba(255,255,255,${(0.75 * (1 - p)).toFixed(2)})`, false);
          }
        }
      },
    },

    // 4. 500원어치 컵볶이: 종이컵에 빨간 떡볶이·어묵이 수북, 이쑤시개에 떡 하나 꽂고 김이 모락
    cupbokki: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, W: '#fbfaf5', w: '#d9d3c4', O: '#ff7a2a', o: '#c85418', R: '#e8402a', r: '#a8201a', H: '#ffa080',
          F: '#f4c98e', f: '#c98a4a', G: '#5cbf4a', P: '#ecd6a4' };
        const cup = [
          '.........P',
          '........P.',
          '.......P..',
          '......P...',
          '..KKK.PKK.',
          '.KRHRKRHRrK',
          'KRrRRKRrRRrK',
          'KrRFFfRRGrRK',
          'KRrFffrRrRrK',
          'KKKKKKKKKKKK',
          'KWWWWWWWWWwK',
          '.KOOOOOOOoK.',
          '.KWOWOWOWwK.',
          '.KWWWWWWWwK.',
          '..KWWWWWwK..',
          '..KKKKKKKK..',
        ];
        const steam = (x0, y0) => {
          for (let i = 0; i < 2; i++) {
            const p = (t * 0.7 + i * 0.5) % 1;
            this.px(x0 + 3 + i * 4 + Math.round(Math.sin(p * 7 + i * 2)), y0 + 3 - Math.round(p * 6), `rgba(255,255,255,${(0.75 * (1 - p)).toFixed(2)})`, false);
          }
        };
        if (a.curled) { this.pattern(cup, a.right + 2, GROUND - 15, m); steam(a.right + 2, GROUND - 15); return; }
        const x0 = a.right - 1, y0 = a.cy - 13;
        this.pattern(cup, x0, y0, m);
        heldPaw(this, g, x0 + 2, a.cy + 1);
        steam(x0, y0);
      },
    },



    // 8. 탐정 돋보기: 입체감 있는 금테(위는 밝고 아래는 짙게) + 하늘빛 렌즈 + 나무 자루와 금 고리. 가끔 반짝 빛이 스친다
    magnifier: {
      hand: true,
      front(g, a, c, t) {
        const ringFill = (cx, cy) => (x, y) => {
          const sh = x + 0.5 - cx + (y + 0.5 - cy);
          return sh < -2.5 ? '#ffe690' : sh > 2.5 ? '#b07c1c' : '#e8b440';
        };
        const lensFill = (cx, cy, glint) => (x, y) => {
          const d = x + 0.5 - cx - (y + 0.5 - cy);
          if (glint !== null && Math.abs(d - glint) < 0.8) return '#ffffff';
          const sh = x + 0.5 - cx + (y + 0.5 - cy);
          if (sh < -3) return '#e6f7ff';
          return sh < 1 ? '#aee0f8' : '#7cc0e8';
        };
        const art = (x, y, glint) => {
          const cx = x + 5.5, cy = y - 9.5;
          for (let i = 0; i < 6; i++) {
            const hx = x + Math.floor(i / 2), hy = y + 1 - i;
            this.px(hx - 1, hy, c.K);
            this.px(hx, hy, '#8a5a30');
            this.px(hx + 1, hy, '#5a3418');
            this.px(hx + 2, hy, c.K);
          }
          this.pattern(['KK', 'YY', 'yy'], x + 2, y - 7, { K: c.K, Y: '#ffe690', y: '#b07c1c' });
          this.ellipse(cx, cy, 4.4, 4.4, ringFill(cx, cy), c.K);
          this.ellipse(cx, cy, 3.1, 3.1, lensFill(cx, cy, glint), null);
          this.px(cx - 2, cy - 1, '#ffffff');
        };
        if (a.curled) {
          const cx = a.right + 11.5, cy = GROUND - 4;
          this.pattern(['KKKKKKKK', 'Kddddd YK', 'KKKKKKKK'].map((r) => r.replace(' ', 'Y')), a.right + 1, GROUND - 2, { K: c.K, d: '#8a5a30', Y: '#e8b440' });
          this.ellipse(cx, cy, 4.4, 4.4, ringFill(cx, cy), c.K);
          this.ellipse(cx, cy, 3.1, 3.1, lensFill(cx, cy, null), null);
          this.px(cx - 2, cy - 1, '#ffffff');
          return;
        }
        const x = a.right + 1, y = a.cy + 1;
        const p = (t % 2.6) / 0.5;
        art(x, y, p < 1 ? -4 + p * 8 : null);
        heldPaw(this, g, x, y);
      },
    },

    // 9. 솜사탕: 분홍에서 하늘색으로 번지는 몽실몽실 구름(윗면 밝고 아랫면 그늘) + 줄무늬 종이 막대. 한 입 베어 문 자리
    cottoncandy: {
      hand: true,
      front(g, a, c, t) {
        const fill = (cx, cy) => (x, y) => {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy, h = hash(x * 7 + y * 13);
          if (h > 0.9) return '#ffffff';
          const sh = dx * 0.35 + dy;
          if (dx > 1 + dy * 0.4) return sh < -1.5 ? '#e4f2ff' : sh < 1.2 ? '#b6daff' : '#8cbcf0';
          return sh < -2 ? '#ffe4f2' : sh < 0.8 ? '#ffb6da' : '#ee8ec0';
        };
        const cloud = (cx, cy, cut) => {
          const circles = [[cx - 2.2, cy + 1.2, 2.8], [cx + 2.2, cy + 1.2, 2.8], [cx, cy - 1.8, 3.3], [cx - 3.2, cy - 1.8, 2.2], [cx + 3, cy - 2.4, 2.1]];
          const inC = (x, y, [qx, qy, rr]) => { const dx = x + 0.5 - qx, dy = y + 0.5 - qy; return dx * dx + dy * dy <= rr * rr; };
          const inside = (x, y) => circles.some((q) => inC(x, y, q)) && !(cut && inC(x, y, cut));
          this.shape(inside, [cx - 6, cy - 5, cx + 6, cy + 4], fill(cx, cy), c.K);
        };
        const stick = (x, y0, y1) => { for (let y = y0; y <= y1; y++) this.px(x, y, (y % 3 === 0) ? '#ff8cc0' : '#fbf6ee'); };
        if (a.curled) {
          for (let x = a.right + 1; x <= a.right + 5; x++) this.px(x, GROUND - 1, (x % 3 === 0) ? '#ff8cc0' : '#fbf6ee');
          cloud(a.right + 10.5, GROUND - 3.5, null);
          return;
        }
        const x = a.right + 1, y = a.cy + 1;
        stick(x, y - 6, y + 2);
        const cx = x + 0.5, cy = y - 10 + Math.round(Math.sin(t * 2) * 0.4);
        cloud(cx, cy, [cx + 5, cy - 3.5, 1.9]);
        heldPaw(this, g, x, y);
      },
    },



    // 12. 뿅망치: 빨간 주름 몸통 + 노란 뚜껑 + 줄무늬 자루. 2초마다 콩! 하고 내려치면 주름이 납작
    ppyonghammer: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, R: '#ee3a44', r: '#a81c24', H: '#ff9aa0', Y: '#ffd84a', y: '#d9a21a', W: '#fff4b0' };
        const head = ['.KK.KKKKK.KK.', 'KWYKHRHRHKWYK', 'KYyKRrRrRKYyK', 'KYyKRrRrRKYyK', 'KyyKrrrrrKyyK', '.KK.KKKKK.KK.'];
        const squash = [head[0], head[1], head[3], head[4], head[5]];
        const handle = ['KYK', 'KYK', 'KRK', 'KYK', 'KYK', 'KRK', 'KYK', 'KyK', 'KKK'];
        if (a.curled) {
          this.pattern(['KKKK', 'KRYY', 'KKKK'], a.right + 1, GROUND - 3, m);
          this.pattern(head, a.right + 4, GROUND - 5, m);
          return;
        }
        const bonk = t % 2 < 0.3;
        const x = a.right + 1, y = a.cy + 1;
        this.pattern(handle, x - 1, y - 6, m);
        if (bonk) this.pattern(squash, x - 5, y - 10, m);
        else this.pattern(head, x - 6, y - 12, m);
        heldPaw(this, g, x, y);
        if (bonk) {
          star(this, x + 8, y - 10, '#ffffff');
          this.pattern(['Y.Y', '.Y.', 'Y.Y'], x - 9, y - 10, { Y: '#ffd23f' }, false);
        }
      },
    },

    // 13. 풍성한 꽃다발: 초록 잎 위로 장미 다섯 송이(빨강·분홍·살구·크림)와 노란 소국·흰 안개꽃이 수북.
    //     분홍 포장지가 뒤에서 날개처럼 펼쳐지고 앞에서 고깔로 감싼다. 허리엔 빨간 리본. 꽃이 살랑, 가끔 반짝
    wiltbouquet: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K;
        const rose = (x, y, P) => this.pattern(['.ooo.', 'oLLAo', 'oAdAo', 'oAAdo', '.ooo.'], x, y, { o: P[3], L: P[0], A: P[1], d: P[2] });
        const RED = ['#ff7a86', '#e0283c', '#8e1224', '#5a0612'], PINK = ['#ffd6e6', '#ff8cb8', '#c8487a', '#7a1c44'],
          PEACH = ['#ffe4c4', '#ffac70', '#d0662e', '#7a3410'], CREAM = ['#ffffff', '#fff0c8', '#d8b878', '#8a6a2a'];
        const paper = (u, j) => (u < -1 ? '#ffd8e8' : u < 2 ? '#f7aecb' : '#e28bb0');
        const art = (bx, by, s) => {
          // 1) 뒤쪽 포장지 날개: 위로 갈수록 벌어진다
          this.shape((x, y) => {
            const j = by - y, u = Math.abs(x + 0.5 - (bx + 0.5));
            return j >= 0 && j <= 10 && u <= 5.5 + j * 0.3 && u >= j * 0.62;
          }, [bx - 11, by - 13, bx + 11, by], (x, y) => ((x - bx + by - y) % 5 === 0 ? '#f7aecb' : '#ffe4ef'), K);
          // 2) 초록 잎 덩어리 (아래쪽은 짙게) + 양옆 잎 끝
          this.ellipse(bx + 0.5, by - 4, 7, 5.6, (x, y) => (hash(x * 5 + y * 11) > 0.7 ? '#5cb04c' : y > by - 3 ? '#2c6428' : '#3f8a3a'), K);
          this.pattern(['.KK', 'KNn', 'Kn.'], bx - 9, by - 5, { K, N: '#5cb04c', n: '#3f8a3a' });
          this.pattern(['KK.', 'nNK', '.nK'], bx + 8, by - 6, { K, N: '#5cb04c', n: '#3f8a3a' });
          // 3) 장미 다섯 송이 + 노란 소국 둘
          const f = (x, y, P) => rose(bx + x + s, by + y, P);
          f(-4, -11, PINK);
          f(0, -12, PEACH);
          f(-7, -8, RED);
          f(3, -8, RED);
          f(-2, -7, CREAM);
          for (const [dx, dy] of [[-5, -3], [5, -3]]) this.pattern(['.Y.', 'YoY', '.Y.'], bx + dx - 1 + s, by + dy - 1, { Y: '#ffd84a', o: '#e07a1a' });
          // 4) 흰 안개꽃 알갱이
          for (const [dx, dy] of [[-5, -12], [4, -13], [7, -9], [-8, -3], [0, -2], [7, -3], [-1, -13]]) this.px(bx + dx + s, by + dy, '#ffffff');
          // 5) 앞쪽 포장지 고깔 (윗단은 접힌 흰 속지, 비스듬한 주름)
          this.shape((x, y) => {
            const j = y - by;
            return j >= -1 && j <= 9 && Math.abs(x + 0.5 - (bx + 0.5)) <= 6.2 - (j + 1) * 0.6;
          }, [bx - 7, by - 1, bx + 7, by + 10], (x, y) => {
            const j = y - by, u = x - bx;
            if (j === -1) return '#ffffff';
            if ((u + j + 20) % 4 === 0) return '#d8779e';
            return paper(u, j);
          }, K);
          // 6) 리본: 가운데 매듭 + 양쪽 고리 + 늘어진 끈
          this.pattern(['KK...KK', 'KRK.KRK', 'KrRHRrK', 'KRK.KRK', 'KK.K.KK', '..KrK..'], bx - 3, by + 3, { K, R: '#e0283c', r: '#8e1224', H: '#ff8a96' });
        };
        if (a.curled) { art(a.right + 8, GROUND - 9, 0); return; }
        const s = sway(t, 1.8, 1) > 0 ? 1 : 0;
        const bx = a.right + 3, by = a.cy - 5;
        art(bx, by, s);
        heldPaw(this, g, bx, a.cy + 2);
        if (t % 2.6 < 0.3) star(this, bx + 6, by - 13, '#fff6c0');
      },
    },

    // 14. 우리집 부엌칼: 칼등 쪽이 곧고 날 쪽이 둥글게 뾰족한 스텐 칼날 + 나무 손잡이에 징 두 개. 칼날 따라 반짝이 쓱
    kitchenknife: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, W: '#ffffff', S: '#c9d2de', s: '#8e9cb0', H: '#eef2f7', G: '#8e96a4', T: '#b87a44', t: '#7a4520', o: '#eef2f6' };
        const knife = [
          '...K.',
          '..KSK',
          '..KSK',
          '.KWSK',
          '.KWSK',
          'KWHSK',
          'KWHSK',
          'KWHsK',
          'KWHsK',
          'KWHsK',
          'KKGGK',
          '.KTtK',
          '.KotK',
          '.KTtK',
          '.KotK',
          '.KKKK',
        ];
        const art = (x, y) => this.pattern(knife, x - 2, y - 13, m);
        if (a.curled) { lay(this, a, [-2, -13, 2, 2], art); return; }
        const x = a.right + 1, y = a.cy + 1;
        art(x, y);
        heldPaw(this, g, x, y);
        const p = (t % 2.2) / 0.5;
        if (p < 1) { const yy = y - 4 - Math.round(p * 7); this.px(x, yy, '#ffffff'); this.px(x + 1, yy - 1, '#ffffff'); }
        if (t % 2.2 > 0.5 && t % 2.2 < 0.75) star(this, x + 1, y - 14, '#ffffff');
      },
    },



    // 17. 국산 바나나: 꼭지를 쥐고, 노란 껍질 세 갈래가 양옆으로 축 늘어지고 크림색 속살이 쏙. 껍질엔 작은 스티커
    bananahand: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, C: '#fff8dc', c: '#eedc9e', H: '#ffffff', Y: '#ffe04a', y: '#e0a818', i: '#fff2b8', b: '#6b4a1a', B: '#3d7be0', W: '#ffffff' };
        const ban = [
          '.....KKK.....',
          '....KHCCK....',
          '....KCCcK....',
          '....KCCcK....',
          '....KCCcK....',
          '..KKKCCcKKK..',
          '.KYYKCCcKYYK.',
          'KYiiKYYyKiiYK',
          'KiYKKYYyKKYiK',
          'KYK.KYYyK.KYK',
          'KK..KYByK..KK',
          '....KYyyK....',
          '.....KbK.....',
          '.....KbK.....',
          '.....KKK.....',
        ];
        const art = (x, y) => this.pattern(ban, x - 6, y - 12, m);
        if (a.curled) {
          this.pattern(['....KKKK.......', '...KYiiYK......', 'KKKKKKYiKKKKKK.', 'KbKYYBKCCCCCCHK', 'KbKyYyKCcccccK.', 'KKKKKKKKKKKKKK.'], a.right + 1, GROUND - 5, m);
          return;
        }
        const x = a.right + 1, y = a.cy + 1;
        art(x, y);
        heldPaw(this, g, x, y);
      },
    },

    // 18. 당근이지!: 잎 쪽을 쥐고, 길쭉한 주황 뿌리가 비스듬히 아래·바깥으로 뾰족해진다. 윗면 하이라이트, 가로 주름 세 줄, 잎은 살랑
    carrothand: {
      hand: true,
      front(g, a, c, t) {
        const O = '#ff7a1a', o = '#c0500c', H = '#ffb070', N = '#2f7a2e', n = '#5cb04c', l = '#9ce07a';
        // (x0,y0) 에서 (dx,dy) 방향으로 길이 L 만큼, 굵기가 점점 가늘어지는 뿌리
        const carrot = (x0, y0, dx, dy, L, w0) => {
          const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
          const uv = (x, y) => { const px = x + 0.5 - x0, py = y + 0.5 - y0; return [px * ux + py * uy, -px * uy + py * ux]; };
          const r = (u) => w0 * (1 - u / L) + 0.35;
          const inside = (x, y) => { const [u, v] = uv(x, y); return u >= 0 && u <= L && Math.abs(v) <= r(u); };
          this.shape(inside, [x0 - 3, y0 - 3, x0 + ux * L + 3, y0 + uy * L + 3], (x, y) => {
            const [u, v] = uv(x, y);
            for (const k of [0.28, 0.5, 0.7]) if (Math.abs(u - k * L) < 0.5 && Math.abs(v) < r(u) - 0.3) return o;
            if (v < -r(u) + 1 && u < L * 0.65) return H;
            return v > r(u) - 1 || u > L * 0.8 ? o : O;
          }, c.K);
        };
        const leaves = (x, y, s) => {
          this.pattern(['l...n..', 'Nl.Nn.l', '.NnNnlN'], x - 3 + s, y - 8, { N, n, l });
          this.pattern(['..NNnN.', '...NN..', '...N...'], x - 3, y - 5, { N, n, l });
        };
        if (a.curled) {
          carrot(a.right + 4, GROUND - 1.5, 1, 0, 10, 2);
          this.pattern(['nl.', 'NnN', 'nN.'], a.right + 1, GROUND - 3, { N, n, l });
          return;
        }
        const s = sway(t, 2.4, 1);
        const x0 = a.right + 1, y0 = a.cy - 4;
        leaves(x0, y0 + 1, s);
        heldPaw(this, g, x0, y0 + 1);
        carrot(x0 + 1, y0 - 1.5, 2, 1.3, 13, 2.7);
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);

// ---- 이전 디자인으로 되돌린 것 (2026-09-24 피드백: 다듬은 것보다 이전 게 낫다) ----
// 도우미 이름이 위쪽 새 그림과 겹쳐서 따로 묶는다
(function (root) {
  const { GROUND, sway, hash, heldPaw, star } = root.PetSprite.costumeKit;

  const ACC = {
    // 1. 파리채: 파란 격자 그물 + 흰 철사 손잡이. 파리가 주위를 윙윙 돌다 3초마다 찰싹
    flyswatter: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, B: '#3d8bff', b: '#9cc8ff', W: '#e8ecf2' };
        const head = ['KKKKKKK', 'KBbBbBK', 'KbBbBbK', 'KBbBbBK', 'KbBbBbK', 'KBbBbBK', 'KKKKKKK'];
        if (a.curled) {
          this.pattern(['KKKKKK', 'KBbBbK', 'KbBbBK', 'KKKKKK'], a.right + 7, GROUND - 3, m);
          for (let x = a.right + 1; x <= a.right + 6; x++) this.px(x, GROUND - 1, m.W);
          return;
        }
        const ph = t % 3;
        const swat = ph < 0.25;
        const x = a.right + 1;
        const dy = swat ? 2 : 0;
        for (let y = a.cy - 7 + dy; y <= a.cy + 2; y++) this.px(x, y, m.W);
        this.pattern(head, x - 3, a.cy - 14 + dy, m);
        heldPaw(this, g, x, a.cy + 1);
        if (swat) {
          star(this, x + 5, a.cy - 12, '#ffffff');
        } else {
          // 파리: 채 위쪽을 8자로 윙윙
          const fx = x + 1 + Math.round(Math.sin(t * 3.1) * 5), fy = a.cy - 17 + Math.round(Math.sin(t * 6.2) * 2);
          this.px(fx, fy, '#1a1a1a', false);
          this.px(fx, fy - 1, Math.floor(t * 12) % 2 ? 'rgba(220,235,255,0.9)' : 'rgba(220,235,255,0.4)', false);
        }
      },
    },
    // 2. 노래방 마이크: 은색 그릴 + 빨간 띠 + 까만 몸통. 음표가 둥실둥실
    karaokemic: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, S: '#c9d1dc', s: '#8e9aaa', H: '#ffffff', R: '#ff3d6e', D: '#2b2b33' };
        const mic = ['.KKKK.', 'KSHSsK', 'KsSsSK', 'KSsSsK', 'KsSsSK', '.KKKK.', '.KRRK.', '.KDDK.', '..KDK.', '..KDK.', '..KDK.', '..KK..'];
        if (a.curled) {
          this.pattern(['.KK.......', 'KSHKKKKKK.', 'KsSKRDDDDK', '.KK.KKKKK.'], a.right + 1, GROUND - 3, m);
          return;
        }
        const x = a.right + 1;
        this.pattern(mic, x - 2, a.cy - 10, m);
        heldPaw(this, g, x + 1, a.cy + 1);
        const notes = [['..XX', '..X.', 'XXX.', 'XX..'], ['.XXX', '.X.X', 'XX.X', 'XXXX'.replace(/X$/, '.')]];
        const cols = ['#ff7ab8', '#7ad0ff'];
        for (let i = 0; i < 2; i++) {
          const p = (t * 0.6 + i * 0.5) % 1;
          this.ctx.globalAlpha = Math.min(1, (1 - p) * 1.6);
          this.pattern(notes[i], x + 3 + i * 2 + Math.round(Math.sin(p * 6 + i) * 1.2), a.cy - 11 - Math.round(p * 9), { X: cols[i] }, false);
          this.ctx.globalAlpha = 1;
        }
      },
    },
    // 6. 확성기: 흰 나팔 + 빨간 테. 주기적으로 소리 물결이 퍼져 나간다
    megaphone: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, W: '#f4f2ec', w: '#c9c4b8', R: '#e0443a', D: '#3a3a44' };
        const horn = ['........KKK', '......KKWRK', '....KKWWWRK', 'KKKKWWWWWRK', 'KDDDWWWWWRK', 'KKKKwwwwwRK', '..KDKKwwwRK', '..KDK.KKwRK', '..KKK...KKK'];
        if (a.curled) { this.pattern(horn, a.right + 1, GROUND - 8, m); return; }
        const x0 = a.right - 2, y0 = a.cy - 5;
        this.pattern(horn, x0, y0, m);
        heldPaw(this, g, x0 + 3, a.cy + 3);
        const ph = t % 2;
        if (ph < 1.2) {
          for (let i = 0; i < 3; i++) {
            const k = Math.floor(ph * 5) - i;
            if (k < 0 || k > 3) continue;
            const wx = x0 + 12 + i * 2 + k, h = 1 + i;
            const col = `rgba(255,214,90,${(1 - k / 4).toFixed(2)})`;
            for (let d = -h; d <= h; d++) this.px(wx + (Math.abs(d) === h ? -1 : 0), y0 + 4 + d, col, false);
          }
        }
      },
    },
    // 7. 태극선: 빨강·파랑·노랑 삼태극이 소용돌이치는 둥근 부채. 살랑살랑 부치면 바람 한 줄
    taegeukfan: {
      hand: true,
      front(g, a, c, t) {
        const cols = ['#d8303b', '#2f5fc8', '#ffcc2a'];
        const disk = (cx, cy, rot) => this.ellipse(cx, cy, 4.6, 4.6, (x, y) => {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          const v = Math.atan2(dy, dx) / (Math.PI * 2) + Math.hypot(dx, dy) * 0.11 + rot;
          return cols[Math.floor((((v % 1) + 1) % 1) * 3)];
        }, c.K);
        const B = '#c9a45a', b = '#8a6a2a';
        if (a.curled) {
          disk(a.right + 6, GROUND - 4, 0);
          this.px(a.right + 6, GROUND, B);
          this.px(a.right + 7, GROUND, b);
          return;
        }
        const s = sway(t, 3, 1);
        const x = a.right + 1;
        for (let y = a.cy - 4; y <= a.cy + 3; y++) this.px(x + (y < a.cy - 2 ? s : 0), y, y % 2 ? B : b);
        disk(x + s + 0.5, a.cy - 9, 0);
        heldPaw(this, g, x, a.cy + 1);
        if (s !== 0) {
          for (let i = 0; i < 3; i++) this.px(x - 6 - i, a.cy - 10 + i * 2 - s, 'rgba(210,235,255,0.8)', false);
        }
      },
    },
    // 10. 요요: 앞발에서 줄이 내려가 요요가 오르락내리락, 빙글빙글 돈다
    yoyohand: {
      hand: true,
      front(g, a, c, t) {
        const fr = Math.floor(t * 10) % 2;
        const m = { K: c.K, R: '#e8303b', r: '#9a1a22', W: '#ffffff', Y: '#ffd23f' };
        const yo = fr ? ['.KKK.', 'KRWRK', 'KWYWK', 'KRWRK', '.KKK.'] : ['.KKK.', 'KWRWK', 'KRYRK', 'KWRWK', '.KKK.'];
        if (a.curled) {
          this.pattern(yo, a.right + 5, GROUND - 4, m);
          for (let i = 0; i < 4; i++) this.px(a.right + 1 + i, GROUND - (i % 2), '#f4f0e6', false);
          return;
        }
        const x = a.right + 3, py = a.cy - 6;
        const len = Math.round(3 + Math.abs(Math.sin(t * 2.2)) * 7);
        for (let y = py + 2; y < py + len; y++) this.px(x, y, '#f4f0e6', false);
        this.pattern(yo, x - 2, py + len - 1, m);
        heldPaw(this, g, x, py);
      },
    },
    // 11. 벤티 아이스 아메리카노: 머리만 한 투명컵에 얼음이 동동, 초록 빨대. 컵 옆으로 물방울이 주르륵
    ventiamericano: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, G: '#2e9e5a', L: 'rgba(225,242,250,0.75)', I: '#bfe4f2', C: '#3a2214', c: '#5a3620', S: '#c49a6c', s: '#a0784a' };
        const cup = [
          '......KK.',
          '.....KGK.',
          '.....KGK.',
          '....KGK..',
          'KKKKKGKKK',
          'KLLLLGLLK',
          'KCICCGCIK',
          'KCCCIGCCK',
          'KICCCGCIK',
          'KCCICgCCK',
          'KSSSSSSSK',
          'KSSsSsSSK',
          'KSSSSSSSK',
          'KCCCCCCCK',
          '.KCcCCCK.',
          '.KCCCcCK.',
          '..KKKKK..',
        ];
        if (a.curled) { this.pattern(cup, a.right + 1, GROUND - 16, m); return; }
        const x0 = a.right, y0 = a.cy - 14;
        this.pattern(cup, x0, y0, m);
        heldPaw(this, g, x0 + 1, a.cy);
        // 얼음 달그락: 가끔 얼음 한 칸이 반짝
        if (t % 1.8 < 0.2) this.px(x0 + 2, y0 + 6, '#ffffff');
        const p = (t * 0.35) % 1;
        this.px(x0 + 8, y0 + 5 + Math.round(p * 8), `rgba(170,220,255,${(0.9 * (1 - p)).toFixed(2)})`, false);
      },
    },
    // 16. 횃불: 헝겊 감은 나무 막대 위로 불꽃이 일렁이고 불똥이 튄다
    torchhand: {
      hand: true,
      front(g, a, c, t) {
        const fl = [
          ['..R..', '.RO..', '.ROR.', 'ROYOR', 'ROYOR', '.RYR.'],
          ['...R.', '..OR.', '.ROR.', 'ROYOR', 'RYYOR', '.RYR.'],
          ['.R...', '.RO..', '.ROOR', 'ROYYR', 'ROYOR', '.ROR.'],
        ];
        const m = { R: '#e8402a', O: '#ff9a2a', Y: '#fff0a0' };
        const wood = '#7a4a24', cl = '#c9b48a', cd = '#8a7550';
        if (a.curled) {
          // 자는 동안엔 꺼진 횃불 + 연기 한 줄
          for (let x = a.right + 1; x <= a.right + 7; x++) this.px(x, GROUND - 1, wood);
          for (let x = a.right + 8; x <= a.right + 10; x++) { this.px(x, GROUND - 1, x % 2 ? cl : cd); this.px(x, GROUND - 2, x % 2 ? cd : cl); }
          const p = (t * 0.5) % 1;
          this.px(a.right + 11 + Math.round(Math.sin(p * 6)), GROUND - 3 - Math.round(p * 6), `rgba(200,200,200,${(0.7 * (1 - p)).toFixed(2)})`, false);
          return;
        }
        const x = a.right + 1;
        for (let y = a.cy - 4; y <= a.cy + 3; y++) this.px(x, y, wood);
        for (let y = a.cy - 7; y <= a.cy - 5; y++) for (let d = -1; d <= 1; d++) this.px(x + d, y, (y + d) & 1 ? cl : cd);
        const f = Math.floor(t * 8) % 3;
        const glow = `rgba(255,170,60,${(0.22 + 0.08 * Math.sin(t * 9)).toFixed(2)})`;
        this.ellipse(x + 0.5, a.cy - 10, 4.5, 4.5, glow);
        this.pattern(fl[f], x - 2, a.cy - 13, m);
        heldPaw(this, g, x, a.cy + 1);
        for (let i = 0; i < 2; i++) {
          const p = (t * 0.9 + i * 0.5) % 1;
          this.px(x - 2 + Math.round(hash(Math.floor(t * 0.9 + i * 0.5) * 3 + i) * 4), a.cy - 14 - Math.round(p * 6), `rgba(255,200,80,${(1 - p).toFixed(2)})`, false);
        }
      },
    },
    // 17. 저격총: 몸보다 긴 총신 + 스코프. 스코프 렌즈가 번쩍, 가끔 빨간 조준점이 깜빡
    sniperrifle: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, D: '#2b2d33', d: '#4a4e58', T: '#8a5a32', t: '#6b4424', L: '#6fd0ff', g: '#9aa2b0' };
        const gun = [
          '....KKKKKKKKK..........',
          '...KgDDDDDDDLK.........',
          '....KKKKKKKKK..........',
          '......K....K...........',
          'KKKKKKKKKKKKKKKKKKKKKKK',
          'KTTTTTKDDDDDDDDDDDDDDDD',
          'KTtTTTTKKKKKKdKKKKKKKKK',
          'KTTTTK..KDDK.K.........',
          'KTTK.....KDK...........',
          'KKK......KK............',
        ];
        if (a.curled) { this.pattern(gun.slice(4, 7).map((r) => r.slice(0, 20)), a.right + 1, GROUND - 2, m); return; }
        const x0 = a.right - 8, y0 = a.cy - 6;
        const lens = t % 2.5 < 0.2 ? '#ffffff' : m.L;
        this.pattern(gun, x0, y0, { ...m, L: lens });
        heldPaw(this, g, x0 + 10, a.cy + 2);
        if (t % 3 > 1.5 && Math.floor(t * 6) % 2) this.px(Math.min(47, x0 + 25), y0 + 5, '#ff2a2a', false);
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);
