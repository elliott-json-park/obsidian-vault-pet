// 보물 공방 코스튬 (2026-09-24) A: 머리 6 + 얼굴 2. 주운 보물을 재료로 만든다. accessories.js 뒤에 읽는다
// 색은 보물 도트(pixelart.js TREASURE)와 같은 FOOD_PALETTE 값을 그대로 써서, 어느 보물로 만들었는지 한눈에 보이게 한다
(function (root) {
  const { sway, star, rowsAt } = root.PetSprite.costumeKit;
  // 보물 도트 색 (pixelart.js FOOD_PALETTE)
  const T = {
    R: '#e5463f', r: '#a52e2a', H: '#ffffff', W: '#fffaf3',
    Y: '#ffd65a', y: '#e0a91e', O: '#f59232', o: '#c8661b',
    C: '#8a5a34', c: '#5c3a1f', t: '#b07436', A: '#e0a764',
    G: '#d3cabb', g: '#9aa0aa', D: '#565d69', X: '#2f3a33',
    B: '#72b3ea', b: '#3a6fb0', N: '#79c46b', n: '#4a8c42',
  };
  const pal = (c, extra) => Object.assign({ K: c.K }, T, extra || {});

  // 옆에서 본 병뚜껑 하나 (보물 bottlecap 을 줄인 것: 윗면 + 아래 톱니 주름). 5칸 × 4줄
  function capSide(r, x, y, m) {
    r.pattern(['.KKK.', 'KRHRK', 'KrRrK', 'KKKKK'], x, y, m);
  }
  // 고무줄 링: 외곽선 사이에 색 줄. 보물 rubberband 처럼 진한 색이 드문드문 꼬였다
  function band(r, x, y, w, m, colors) {
    const dark = { Y: 'y', N: 'n' };
    r.pattern(['K'.repeat(w)], x, y, m);
    colors.forEach((col, j) => {
      let row = 'K';
      for (let i = 1; i < w - 1; i++) row += (i + j * 2) % 4 === 1 ? dark[col] : col;
      r.pattern([row + 'K'], x, y + 1 + j, m);
    });
    r.pattern(['.' + 'K'.repeat(w - 2) + '.'], x, y + 1 + colors.length, m);
  }

  const ACC = {
    // ======================= 머리 =======================
    capcrown: {
      // 빨간 병뚜껑 네 개를 노란 고무줄 링 위에 세웠다. 가운데는 두 개를 포개 한 칸 높인 게 왕관 꼭대기.
      // 뚜껑 아래 톱니 주름까지 보물 병뚜껑 그대로. 링이 귀를 다 덮는다
      front(g, a, c, t) {
        const m = pal(c);
        const y = a.earTop + 1;
        capSide(this, a.hx - 7, y - 3, m);
        capSide(this, a.hx + 3, y - 3, m);
        capSide(this, a.hx - 2, y - 3, m);
        capSide(this, a.hx - 2, y - 6, m);
        band(this, a.hx - 7, y, 15, m, ['Y']);
      },
    },
    leafwreath: {
      // 바삭하게 마른 낙엽을 잔가지 링에 엮은 화관. 주황·노랑·갈색 잎이 위아래로 삐죽빼죽, 오른쪽엔 솔방울.
      // 가끔 잎 부스러기가 떨어진다
      front(g, a, c, t) {
        const m = pal(c);
        const y = a.earTop + 1;
        const cols = [T.O, T.Y, T.r, T.C, T.O, T.y];
        // 잔가지 링
        for (let x = a.hx - 8; x <= a.hx + 8; x++) { this.px(x, y + 1, T.c); this.px(x, y + 2, c.K); }
        for (let i = 0; i < 6; i++) {
          const x = a.hx - 8 + i * 3;
          const up = i % 2 === 0;
          const rows = up ? ['..KK', '.KFK', 'KFfK', 'KfK.'] : ['.KfK', 'KfFK', 'KFK.', 'KK..'];
          this.pattern(rows, x, up ? y - 3 : y + 1, { K: c.K, F: cols[i], f: i === 3 ? T.c : T.o });
        }
        // 가운데 큰 잎 한 장 (잎맥)
        this.pattern(['..K..', '.KOK.', 'KOYOK', 'KOYOK', '.KoK.'], a.hx - 2, y - 4, m);
        // 솔방울
        this.pattern(['.KK.', 'KCtK', 'KtCK', 'KCtK', 'KtCK', '.KK.'], a.hx + 8, y - 2, m);
        const p = (t % 3.5) / 1.2;
        if (p < 1) this.px(a.hx - 9, y + 3 + Math.round(p * 6), T.o, false);
      },
    },
    pigeonhat: {
      // 회색 펠트 쪼가리로 만든 작은 모자. 띠엔 해바라기씨 껍질을 줄줄이 붙이고, 공원에서 주운 비둘기 깃털 두 개를 꽂았다.
      // 깃털이 살랑살랑, 모자챙이 귀를 덮는다
      front(g, a, c, t) {
        const m = pal(c, { F: '#5d6472', f: '#474d59', h: '#7c8494' });
        const s = sway(t, 2.4, 1);
        // 깃털 (모자 뒤로 꽂혀 위로 솟는다)
        rowsAt(this, ['...KK', '..KGK', '.KGgK', 'KGgK.', 'KgK..', 'KD...'], a.hx, a.earTop - 9, m, [s, s, s, 0, 0, 0]);
        rowsAt(this, ['KK..', 'KGK.', 'KgGK', '.KgK', '..DK'], a.hx - 4, a.earTop - 7, m, [-s, -s, 0, 0, 0]);
        this.pattern(
          ['.KKKKKKKKK.', '.KhFFFFFFK.', '.KFFFFFFfK.', '.KXWXWXWXK.', 'KKKKKKKKKKKKK', 'KhFFFFFFFFFfK', '.KKKKKKKKKKK.'],
          a.hx - 5, a.earTop - 3, m,
        );
      },
    },
    legohelm: {
      // 레고 조각을 쌓아 만든 헬멧. 빨강·파랑·노랑·초록 짝짝이 브릭에 윗면 스터드가 뽈록. 귀는 헬멧 속에 쏙
      front(g, a, c, t) {
        const m = pal(c, { E: '#ffe98a', e: '#c9981f', L: '#ff8a80', l: '#b8dcff', M: '#a8e098' });
        this.pattern(
          ['..KK..KK.KK..KK..', '.KRRKKRRKBBKKBBK.', 'KRLRRRRRKBlBBBBbK', 'KrrrrrrrKbbbbbbbK', 'KKKKKKKKKKKKKKKKK', 'KYEYKNMNNNKRLRRRK', 'KyyyKnnnnnKrrrrrK', 'KKKKKKKKKKKKKKKKK'],
          a.hx - 8, a.earTop - 4, m,
        );
      },
    },
    legendcapcrown: {
      // 두세 달 걸려 완성한 진짜 전설의 병뚜껑 왕관. 빨간 병뚜껑을 층층이 쌓아 올리고, 꼭대기엔 유난히 반짝이는
      // 그 금색 병뚜껑을 보석처럼 얹었다. 고무줄 링은 노랑·초록 두 겹. 금뚜껑 둘레로 빛이 번지고 윤이 스치며 반짝이가 돈다
      front(g, a, c, t) {
        const m = pal(c);
        const y = a.earTop;
        // 금뚜껑 뒤로 번지는 빛
        const gc = Math.sin(t * 3) > 0 ? '#fff2a0' : '#ffe06a';
        for (const [dx, dy] of [[0, -11], [0, -12], [-3, -11], [3, -11], [-5, -9], [5, -9], [-6, -7], [6, -7]]) this.px(a.hx + dx, y + dy, gc, false);
        // 양옆 두 층, 가운데 받침
        capSide(this, a.hx - 8, y - 3, m);
        capSide(this, a.hx + 4, y - 3, m);
        capSide(this, a.hx - 7, y - 6, m);
        capSide(this, a.hx + 3, y - 6, m);
        capSide(this, a.hx - 2, y - 3, m);
        // 금뚜껑 (보물 shinycap 과 같은 모양·색)
        this.pattern(['.KKKKKKK.', 'KYYYYYYyK', 'KYHYYYYyK', 'KYYYYYYyK', 'KyYyYyYyK', '.KKKKKKK.'], a.hx - 4, y - 9, m);
        const sh = Math.floor((t % 2.2) * 6); // 윤이 왼쪽에서 오른쪽으로 스친다
        if (sh >= 1 && sh <= 7) { this.px(a.hx - 4 + sh, y - 8, '#ffffff'); this.px(a.hx - 4 + sh, y - 7, '#fff6c0'); }
        band(this, a.hx - 8, y, 17, m, ['Y', 'N']);
        // 링에 박은 빨간 뚜껑 조각
        for (const dx of [-5, 0, 5]) this.px(a.hx + dx, y + 1, T.R);
        // 반짝이: 금뚜껑 둘레를 돈다 (보물 shinycap 의 십자 반짝이)
        const k = Math.floor(t * 2.5) % 4;
        const pts = [[a.hx - 6, y - 11], [a.hx + 6, y - 11], [a.hx + 8, y - 8], [a.hx - 8, y - 8]];
        star(this, pts[k][0], pts[k][1], '#fff6c0');
        star(this, pts[(k + 2) % 4][0], pts[(k + 2) % 4][1], 'rgba(255,240,170,0.6)', false);
      },
    },
    usbantenna: {
      // 파란 USB 뚜껑을 머리에 세워 쓰고, 휘어 편 클립 두 가닥에 이어폰 고무 팁을 꽂아 안테나로 세웠다.
      // 가운데 위로 와이파이 호가 하나씩 차오르며 깜빡인다 (잘 잡힌다)
      front(g, a, c, t) {
        const m = pal(c);
        const tipY = a.earTop - 11;
        // 클립 철사 안테나 (바깥으로 비스듬히)
        for (let j = 0; j < 5; j++) {
          const o = j >= 3 ? 1 : 0;
          this.px(a.hx - 2 - o, a.earTop - 3 - j, T.g);
          this.px(a.hx + 2 + o, a.earTop - 3 - j, T.g);
        }
        // 이어폰 고무 팁 (보물 eartip 모양)
        this.pattern(['.KKK.', 'KDgDK', 'KDDDK', '.KDK.'], a.hx - 5, tipY, m);
        this.pattern(['.KKK.', 'KgDDK', 'KDDDK', '.KDK.'], a.hx + 1, tipY, m);
        // USB 뚜껑 (세로로 세움, 쇠 끝이 위)
        this.pattern(['.KKKKK.', '.KgXgK.', 'KKKKKKK', 'KBHBBbK', 'KBHBBbK', 'KBBBBbK', 'KbbbbbK', 'KKKKKKK'], a.hx - 3, a.earTop - 4, m);
        // 와이파이 호: 0 → 1 → 2 → 3 칸 차오른다
        const n = Math.floor(t * 2.5) % 4;
        const on = '#8ff0b4';
        if (n >= 1) this.px(a.hx, a.earTop - 6, on, false);
        if (n >= 2) this.pattern(['X.X', '.X.'], a.hx - 1, a.earTop - 8, { X: on }, false);
        if (n >= 3) this.pattern(['X...X', '.XXX.'], a.hx - 2, a.earTop - 10, { X: on }, false);
      },
    },

    // ======================= 얼굴 =======================
    strawglasses: {
      // 빨강·흰 줄무늬 구부러지는 빨대를 휘어 만든 안경. 코 위 다리는 빨대 주름 부분, 양옆 경첩은 클립
      front(g, a, c, t) {
        const ring = (x0, y0) => {
          // 4×4 테, 모서리는 둥글게 비우고 두 칸씩 빨강·흰 줄무늬
          const pts = [];
          for (let i = 0; i < 4; i++) pts.push([x0 + i, y0]);
          for (let j = 1; j < 3; j++) pts.push([x0 + 3, y0 + j]);
          for (let i = 3; i >= 0; i--) pts.push([x0 + i, y0 + 3]);
          for (let j = 2; j > 0; j--) pts.push([x0, y0 + j]);
          pts.forEach(([x, y], k) => {
            if ((x === x0 || x === x0 + 3) && (y === y0 || y === y0 + 3)) return;
            this.px(x, y, (k >> 1) % 2 ? T.W : T.R);
          });
        };
        ring(a.eyeL - 1, a.ey - 1);
        ring(a.eyeR - 1, a.ey - 1);
        // 주름진 코다리
        for (let x = a.eyeL + a.ew + 1; x < a.eyeR - 1; x++) { this.px(x, a.ey - 1, T.R); this.px(x, a.ey - 2, T.G); }
        // 클립 경첩 + 다리
        this.px(a.eyeL - 2, a.ey, T.g);
        this.px(a.eyeR + a.ew + 1, a.ey, T.g);
        this.px(a.eyeL - 3, a.ey, T.R);
        this.px(a.eyeR + a.ew + 2, a.ey, T.R);
      },
    },
    acorncheeks: {
      // 도토리를 볼 가득 넣어서 양 볼이 빵빵하게 부풀었다. 입에 도토리 하나를 물었고, 입가엔 해바라기씨 껍질. 가끔 우물우물
      front(g, a, c, t) {
        const body = g.c.body, out = g.c.outline;
        const puff = Math.sin(t * 2) > 0.85 ? 0.3 : 0;
        const cy = a.my + 0.5;
        this.ellipse(a.left - 0.5, cy, 2.6 + puff, 2.2 + puff, body, out);
        this.ellipse(a.right + 1.5, cy, 2.6 + puff, 2.2 + puff, body, out);
        this.px(a.left - 1, cy - 0.5, 'rgba(255,143,163,0.8)');
        this.px(a.right + 1, cy - 0.5, 'rgba(255,143,163,0.8)');
        // 입에 문 도토리
        this.pattern(['KcK', 'cCc', 'KAK'], a.fx - 1, a.my + 1, pal(c));
        // 입가 씨앗 껍질
        this.pattern(['KX', 'XW'], a.fx - 5, a.my + 2, pal(c));
        this.px(a.fx + 4, a.my + 2, T.X);
        this.px(a.fx + 5, a.my + 3, T.W);
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);
