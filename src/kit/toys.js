// 장난감 놀이. 세 가지를 담는다.
//  1) 놀이 전용 자세 (PetSprite.TOY_POSES) — 상자에 숨기, 봉투 속 부스럭, 털실 끌어안고 뒷발 차기…
//     모양은 모션(motions.js)과 같지만 상점·설정에는 안 나온다. pet.js 가 상황에 맞춰 튼다
//  2) 고양이가 직접 그리는 큰 장난감 (상자·종이봉투·스크래처). 고양이가 들어가 있을 때는 고양이 캔버스에,
//     바닥에 놓여 있을 때는 같은 도트를 따로 찍은 캔버스로 보여 준다 (PetToys.paintPlaced)
//  3) 놀이판(화면 전체 캔버스)에 그리는 것 — 낚싯줄, 깃털 막대, 비눗방울, 레이저 점, 털실 가닥 (PetToys.field)
(function (root) {
  const { rand, seg, bump, ease, GROUND } = root.PetSprite.util;
  const FP = root.PixelArt.FOOD_PALETTE;
  const once = (r, tag, cond) => {
    if (cond && !r.ms[tag]) { r.ms[tag] = true; return true; }
    return false;
  };
  const every = (r, tag, at, period) => {
    const n = Math.floor(at / period);
    if (r.ms[tag] !== n) { r.ms[tag] = n; return true; }
    return false;
  };

  // ---------- 큰 장난감 도트 ----------
  // x = 가운데에서 왼쪽 끝까지 칸 수(음수), y = 첫 줄의 도트 높이. 바닥(맨 아랫줄)은 46
  const PLACED = {
    // 종이 상자. 뒤판·뒷날개는 고양이 뒤에, 앞판·옆날개는 고양이 앞에 찍어서 고양이가 상자 '안'에 들어간다
    box: {
      back: {
        x: -12, y: 31,
        rows: [
          // 뒤판 안쪽 면은 그늘이 져서 어둡고, 윗모서리만 밝다. 바닥은 더 어둡다 → 뚜껑이 아니라 열린 상자 속으로 보인다
          '....KKKKKKKKKKKKKKKKK....',
          '....KSSSSSSSSSSSSSSSK....',
          '....KtttttttttttttttK....',
          '....KtttttttttttttttK....',
          '..KKKcccccccccccccccKKK..',
          '..KcccccccccccccccccccK..',
          '..KcCCCCCCCCCCCCCCCCCcK..',
          '..KcCCCCCCCCCCCCCCCCCcK..',
        ],
      },
      front: {
        x: -12, y: 33,
        rows: [
          'KKKK.................KKKK',
          'KSSSK...............KSSSK',
          '.KSTSK.............KSTSK.',
          '.KSTTK.............KTTSK.',
          '..KSTTK...........KTTSK..',
          '..KKKKKKKKKKKKKKKKKKKKK..',
          '..KSSSSSSSSwwwSSSSSSSSK..',
          '..KTTTTTTTTwwwTTTTTTTtK..',
          '..KTTCTTTTTwwwTTTTTTTtK..',
          '..KTCCCTTTTTTTTTTCTCTtK..',
          '..KTTCTTTTTTTTTTTTCCTtK..',
          '..KTTCTTTTTTTTTTTTTTTtK..',
          '..KtttttttttttttttttttK..',
          '..KKKKKKKKKKKKKKKKKKKKK..',
        ],
      },
    },
    // 옆으로 누운 종이봉투. 왼쪽이 입구(어두운 속)
    bag: {
      front: {
        x: -11, y: 35,
        rows: [
          '....KKKKKKKKKKKKKKKKKK',
          '..KKwKSSSSSsSSSSSSsSSK',
          '.KcccKSSSSSsSSSSSSsSSK',
          'KccccKSSSSSsSSSSSSsSSK',
          'KccccKSSSSSsSSSSSSsSsK',
          'KccccKSSSSSsSSSSSSsSsK',
          'KccccKSSSSSsSSSSSSsSsK',
          'KccccKsSSSSsSSSSSSsSsK',
          '.KcccKssssssssssssssK.',
          '..KKwKssssssssssssssK.',
          '....KKKKKKKKKKKKKKKK..',
          '......................',
        ],
      },
    },
    // 물결 모양 골판지 스크래처. 가운데가 오목해서 올라앉기 좋다
    scratcher: {
      back: {
        x: -13, y: 41,
        rows: [
          'KKK.....................KKK',
          'KTtKK.................KKtTK',
          'KtTtTKKKKKKKKKKKKKKKKKTtTtK',
          'KTtTtTtTtTtTtTtTtTtTtTtTtTK',
          'KCCCCCCnNCCCCCCCCCCCCCCCCCK',
          'KKKKKKKKKKKKKKKKKKKKKKKKKKK',
        ],
      },
    },
  };

  // 팔레트: 먹이 팔레트를 쓰되 외곽선은 고양이 선 색을 따른다
  const palCache = {};
  const palOf = (K) => palCache[K] || (palCache[K] = Object.assign({}, FP, { K }));

  // 고양이 캔버스에 큰 장난감 한 겹을 찍는다. off = 고양이 가운데에서 떨어진 칸(화면 기준), dx·dy = 흔들림
  function drawPlaced(r, key, layer, a, c, dx = 0, dy = 0) {
    const art = PLACED[key] && PLACED[key][layer];
    if (!art) return;
    const off = Math.round((r.toyOff || 0) * r.facing);
    // 고양이가 왼쪽을 보면 캔버스가 통째로 뒤집힌다. 장난감은 바닥에 놓였던 모습 그대로 보이게 미리 뒤집어 둔다
    if (r.facing < 0) {
      const w = art.rows[0].length;
      const rows = flipped[key + layer] || (flipped[key + layer] = art.rows.map((s) => [...s].reverse().join('')));
      r.pattern(rows, a.hx + off - art.x - w + 1 - dx, art.y + dy, palOf(c.K), false);
      return;
    }
    r.pattern(art.rows, a.hx + off + art.x + dx, art.y + dy, palOf(c.K), false);
  }
  const flipped = {};

  // 바닥에 놓인 큰 장난감을 캔버스 하나로 찍는다. cell = 도트 한 칸의 화면 크기
  function paintPlaced(canvas, key, cell) {
    const art = PLACED[key];
    if (!art) return null;
    const layers = [art.back, art.front].filter(Boolean);
    const x0 = Math.min(...layers.map((l) => l.x));
    const x1 = Math.max(...layers.map((l) => l.x + l.rows[0].length));
    const y0 = Math.min(...layers.map((l) => l.y));
    const y1 = Math.max(...layers.map((l) => l.y + l.rows.length));
    const w = x1 - x0;
    const h = y1 - y0;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w * cell}px`;
    canvas.style.height = `${h * cell}px`;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    for (const l of layers)
      l.rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const col = FP[row[i]];
          if (!col) continue;
          ctx.fillStyle = col;
          ctx.fillRect(l.x - x0 + i, l.y - y0 + j, 1, 1);
        }
      });
    // 가운데 열이 캔버스의 어디쯤인지 (고양이 캔버스와 줄을 맞출 때 쓴다)
    return { w, h, cx: -x0 };
  }

  // ---------- 작은 소품 도트 ----------
  // 안고 있는 털실: 상점 그림처럼 동그란 분홍 실뭉치에 감긴 결이 비스듬히
  const YARN = ['.KKKK.', 'KPPpPK', 'KPpPPK', 'KpPPpK', 'KPPpPK', '.KKKK.'];
  const NIP = ['..KKKKK.K.', '.KNNnNNKNK', 'KHNnNNNNNK', '.KNNnNNKNK', '..KKKKK.K.'];

  // 입에 물고 다니는 쥐돌이. 꼬리가 대롱대롱
  const CARRY = {
    // 깜짝 이벤트에서 물어 온 보물. 12×12 도트를 반으로 줄여 입에 문다 (2×2 칸에서 처음 보이는 색)
    treasure(g, a, c) {
      const PA = root.PixelArt;
      const art = PA && PA.TREASURE[this.carryKey];
      if (!art) return;
      const x0 = a.fx - 2;
      const y0 = a.my;
      for (let j = 0; j < art.length; j += 2) {
        for (let i = 0; i < art[0].length; i += 2) {
          const ch = [art[j][i], art[j][i + 1], art[j + 1] && art[j + 1][i], art[j + 1] && art[j + 1][i + 1]].find((x) => x && x !== '.');
          if (!ch) continue;
          this.px(x0 + i / 2, y0 + j / 2, ch === 'K' ? c.K : PA.FOOD_PALETTE[ch]);
        }
      }
    },
    mouse(g, a, c, t) {
      const x = a.fx - 1;
      const y = a.my + 1;
      this.pattern(['.KK.KK.', 'KPGKGPK', 'KGGGGGK', 'KGKGGGK', '.KKKKK.'], x, y, palOf(c.K));
      const sw = Math.round(Math.sin(t * 5));
      this.px(x + 6, y + 4, c.K);
      this.px(x + 7, y + 5 + sw, c.K);
      this.px(x + 8, y + 5, c.K);
    },
  };

  // ---------- 놀이 자세 ----------
  const TP = {
    // 공중으로 뛰어올라 앞발로 휙휙
    toyLeap: {
      len: 0.9,
      pose(p, k, at) {
        const b = Math.floor(at * 10) % 2;
        p.armL = b ? 'cheer' : 'up';
        p.armR = b ? 'up' : 'cheer';
        p.eyes = 'wide'; p.mouth = 'open'; p.ear = 1; p.tail = 'up';
        p.xf = { sy: 1.1, sx: 0.94 };
        p.noShadow = true;
      },
    },
    // 앞발로 톡톡 — 공을 이쪽저쪽으로 굴린다
    toyBat: {
      len: 1.3,
      pose(p, k, at) {
        p.xf = { sx: 1.1, sy: 0.9 };
        p.armL = p.armR = 'knead';
        p.lookY = 1; p.eyes = 'wide'; p.mouth = 'flat'; p.ear = 1; p.tail = 'wag';
      },
    },
    // 털실을 끌어안고 벌러덩 — 뒷발로 팡팡팡
    toyYarn: {
      len: 2.4,
      pose(p, k, at) {
        lieDown(p, at, 16);
        p.armL = p.armR = 'hold';
        p.eyes = Math.floor(at * 3) % 3 ? 'wide' : 'happy';
        p.mouth = 'open';
      },
      front(g, a, k, at, c) { this.pattern(YARN, a.hx - 3, a.my, palOf(c.K)); },
      step(r, k, at, dt, a) {
        if (every(r, 'f', at, 0.2)) r.emit({ type: 'dust', x: r.scr(a.hx + rand(-6, 6)), y: GROUND - rand(0, 6), vx: rand(-8, 8), vy: -6, life: 0.4, c: '#ffc6d6' });
      },
    },
    // 실이 몸에 칭칭 감겼다. 버둥버둥
    toyTangle: {
      len: 2.6,
      pose(p, k, at) {
        p.xf = { ox: Math.round(Math.sin(at * 22)), rot: Math.sin(at * 11) * 0.06 };
        p.eyes = k < 0.7 ? 'squint' : 'teary';
        p.mouth = 'wavy';
        p.sweat = true;
        p.ear = -1;
        p.tail = 'flick';
      },
      front(g, a, k, at, c) {
        // 몸통을 비스듬히 두 번 감은 실 (몸 윤곽 안에서만), 이마를 지나 귀 사이로 한 번 더,
        // 옆구리로 풀린 실 끝이 버둥거릴 때마다 흔들린다. 실 아래 한 칸은 진한 분홍 그림자라 몸에 감긴 느낌
        const P = '#ff8fb0';
        const S = '#d9577f';
        const rx = Math.max(4, Math.round(g.body.rx) - 1);
        const bx = Math.round(g.cx);
        const strand = (y0, slope, from, to) => {
          for (let i = from; i <= to; i++) {
            const y = y0 + Math.round(i * slope);
            this.px(bx + i, y, P);
            if (i > from && i < to) this.px(bx + i, y + 1, S);
          }
        };
        strand(a.cy - 1, 0.3, -rx, rx);
        strand(a.cy + 3, -0.25, -rx + 1, rx - 1);
        strand(a.ey - 3, 0.2, -a.hw + 2, a.hw - 2);
        // 풀린 끝
        const sw = Math.round(Math.sin(at * 11) * 1.5);
        const ex = bx + rx;
        const ey = a.cy - 1 + Math.round(rx * 0.3);
        for (let i = 1; i <= 4; i++) this.px(ex + i, ey + i + (i > 2 ? sw : 0), P);
      },
    },
    // 물어 온 쥐돌이를 내려놓고 뿌듯
    toyProud: {
      len: 1.8,
      pose(p, k) {
        p.xf = { sy: 1.05 };
        p.eyes = k < 0.7 ? 'closed' : 'happy';
        p.mouth = 'smile'; p.tail = 'up'; p.ear = 1; p.blush = true;
      },
      step(r, k, at, dt, a) {
        if (every(r, 's', at, 0.3)) r.emit({ type: 'spark', x: r.scr(a.hx + rand(-10, 10)), y: a.top + rand(-4, 4), vy: -6, life: 0.7 });
      },
    },
    // 캣닢 인형을 끌어안고 뒷발 차기
    toyKick: {
      len: 2.8,
      pose(p, k, at) {
        lieDown(p, at, 20);
        p.armL = p.armR = 'hold';
        p.eyes = Math.floor(at * 4) % 2 ? 'wide' : 'squint';
        p.mouth = 'open';
        p.blush = true;
      },
      front(g, a, k, at, c) { this.pattern(NIP, a.hx - 5, a.my + 1, palOf(c.K)); },
      step(r, k, at, dt, a) {
        if (every(r, 'f', at, 0.15)) r.emit({ type: 'dust', x: r.scr(a.hx + rand(-8, 8)), y: GROUND - rand(0, 8), vx: rand(-10, 10), vy: -8, life: 0.4, c: '#f7bd7f' });
      },
    },
    // 캣닢에 취했다. 하트 눈으로 데굴데굴, 마지막엔 벌러덩 헤롱헤롱.
    // 구르기는 옆으로 눕기 → 배 보이며 뒤집기 → 반대쪽으로 눕기… 90° 단위로만 돌려서 도트가 뭉개지지 않는다
    toyHigh: {
      len: 3.6,
      pose(p, k, at) {
        if (k < 0.72) {
          const step = Math.floor(at * 4.2) % 4;
          p.xf = [
            { rot: -Math.PI / 2, px: 24, py: 38, oy: 1 },
            { rot: Math.PI, px: 24, py: 38, oy: 0 },
            { rot: Math.PI / 2, px: 24, py: 38, oy: 1 },
            { rot: Math.PI, px: 24, py: 38, oy: 0 },
          ][step];
          p.noShadow = true;
          p.eyes = 'heart'; p.mouth = 'open'; p.tail = 'wag'; p.blush = true; p.ear = 0;
          p.dangle = step % 2 ? 2 : -2;
        } else {
          lieDown(p, at, 0);
          p.eyes = 'half'; p.mouth = 'blep'; p.blush = true;
        }
      },
      step(r, k, at, dt, a) {
        if (every(r, 'h', at, 0.35)) r.emit({ type: 'heart', x: r.scr(a.hx + rand(-10, 8)), y: a.top - 2, vx: rand(-4, 4), vy: -9, life: 1.1 });
        if (every(r, 's', at, 0.25)) r.emit({ type: 'star', x: r.scr(a.hx + rand(-12, 12)), y: a.top + rand(-6, 6), vy: -3, life: 0.6, c: '#b784f5' });
      },
    },
    // 태엽 쥐를 앞발로 꾹 누른다. 쥐는 발밑에서 부르르
    toyPin: {
      len: 1.6,
      pose(p, k) {
        p.xf = { sx: 1.1, sy: 0.88 };
        p.dy = 1;
        p.armL = p.armR = 'front';
        p.lookY = 1;
        p.eyes = k < 0.6 ? 'wide' : 'happy';
        p.mouth = k < 0.6 ? 'flat' : 'smile';
        p.ear = 1; p.tail = 'wag';
      },
    },
    // 깃털을 향해 뒷발로 서서 앞발 휙휙
    toySwipe: {
      len: 0.7, loop: true,
      pose(p, k, at) {
        const b = k < 0.5;
        p.xf = { sy: 1.16, sx: 0.94 };
        p.armL = b ? 'cheer' : 'up';
        p.armR = b ? 'up' : 'cheer';
        p.eyes = 'wide'; p.mouth = 'open'; p.ear = 1; p.tail = 'wag';
      },
    },
    // 닿지 않는 걸 올려다보며 '깍깍깍' (사냥감을 보면 턱을 떤다)
    toyChatter: {
      len: 1.2, loop: true,
      pose(p, k, at) {
        p.lookY = -1;
        p.eyes = 'wide';
        p.mouth = Math.floor(at * 12) % 2 ? 'o' : 'flat';
        p.ear = 1; p.tail = 'flick';
      },
    },
    // 레이저를 덮쳤는데… 어라? 발밑에 없다
    toyPeek: {
      len: 1.4,
      pose(p, k) {
        p.xf = { sx: 1.06, sy: 0.92 };
        p.lookY = 1;
        if (k < 0.45) { p.eyes = 'wide'; p.armL = p.armR = 'front'; }
        else { p.eyes = 'side'; p.armR = 'lift'; p.liftUp = 0; }
        p.mouth = 'flat'; p.ear = k < 0.45 ? 1 : 0;
      },
      step(r, k, at, dt, a) {
        if (once(r, 'q', k > 0.45)) r.emit({ type: 'text', s: '?', x: r.scr(a.hx + 6), y: a.top - 8, vy: -3, life: 1, c: '#ffd35c' });
      },
    },
    // 덮치기 직전 엉덩이 씰룩씰룩
    toyWiggle: {
      len: 0.9,
      pose(p, k, at, r) {
        p.xf = { sx: 1.1, sy: 0.86, rot: Math.sin(at * 32) * 0.07, px: 24 + r.facing * 6 };
        p.dy = 1;
        p.eyes = 'wide'; p.mouth = 'flat'; p.ear = 1; p.tail = 'flick';
      },
    },
    // 비눗방울이 코앞에서 톡 — 깜짝
    toyPop: {
      len: 0.7,
      pose(p, k) {
        if (k < 0.3) { p.eyes = 'closed'; p.xf = { sx: 1.06, sy: 0.94 }; p.ear = -1; }
        else { p.eyes = 'wide'; p.mouth = 'o'; p.ear = 1; }
      },
    },
    // 킁킁 — 몸을 앞으로 쭉 빼고 냄새를 맡는다
    toySniff: {
      len: 1.2,
      pose(p, k, at, r) {
        p.xf = { rot: 0.12 * r.facing, py: 44 };
        p.lookX = 1;
        p.eyes = 'half'; p.mouth = 'flat'; p.ear = 1; p.tail = 'slow';
      },
      step(r, k, at, dt, a) {
        if (every(r, 'n', at, 0.3)) r.emit({ type: 'spray', x: r.scr(a.fx + 5), y: a.my - 1, vx: 4, vy: -2, life: 0.3, c: '#e9e4dc' });
      },
    },

    // 큰 비눗방울에 갇혀 둥실. 처음엔 놀라서 벽을 짚다가 곧 즐긴다
    toyFloat: {
      len: 2.4, loop: true,
      pose(p, k, at) {
        p.noShadow = true;
        p.armL = p.armR = 'lift';
        p.liftUp = 0.3 + Math.sin(at * 3) * 0.2;
        p.eyes = at % 4 < 1.2 ? 'wide' : 'happy';
        p.mouth = at % 4 < 1.2 ? 'o' : 'open';
        p.blush = at % 4 >= 1.2;
        p.tail = 'wag';
        p.xf = { rot: Math.sin(at * 1.6) * 0.18, py: 38 };
        p.dangle = Math.round(Math.sin(at * 4));
      },
    },

    // ----- 2차 장난감용 자세 (toyplay*.js) -----
    // 펑! 날아가는 중. 새까맣게 그을려 빙글빙글
    toyBlown: {
      len: 1.2, loop: true,
      pose(p, k, at) {
        p.eyes = 'x'; p.mouth = 'o'; p.ear = -1; p.tail = 'up'; p.noShadow = true;
        p.armL = p.armR = 'up';
        // 빙글빙글: 90° 씩 끊어 돌려서 도트가 뭉개지지 않게 (빠르게 돌아서 끊긴 느낌은 안 난다)
        p.xf = { rot: (Math.floor(at * 7) * Math.PI) / 2, py: 38 };
        p.dangle = 2;
      },
      step(r) { r.emit({ type: 'tint', c: 'rgba(30,25,25,0.6)', perFrame: true, fade: false }); },
    },
    // 그을린 채 멍하니. 털이 부스스하고 머리에서 연기가 폴폴, 콜록
    toySoot: {
      len: 2.6,
      pose(p, k, at) {
        p.eyes = k < 0.7 ? 'dot' : 'blink'; p.mouth = k > 0.5 && k < 0.6 ? 'o' : 'flat'; p.ear = -1; p.tail = 'slow';
        p.xf = k > 0.8 ? { ox: Math.floor(at * 30) % 2 ? 1 : -1 } : null;
      },
      step(r, k, at, dt, a) {
        r.emit({ type: 'tint', c: `rgba(30,25,25,${k > 0.8 ? 0.55 * (1 - (k - 0.8) / 0.2) : 0.55})`, perFrame: true, fade: false });
        if (every(r, 's', at, 0.3)) r.emit({ type: 'puff', x: r.scr(a.hx + rand(-4, 4)), y: a.top - 2, vy: -8, life: 0.8, c: 'rgba(90,90,90,0.8)' });
        if (once(r, 'c', k > 0.5)) r.emit({ type: 'text', s: 'COUGH', x: r.scr(a.hx + 6), y: a.top - 7, vy: -3, life: 0.7, c: '#cccccc' });
        if (k > 0.8 && every(r, 'd', at, 0.05)) r.emit({ type: 'spray', x: r.scr(a.hx + rand(-8, 8)), y: a.cy + rand(-5, 5), vx: rand(-20, 20), vy: rand(-10, 4), life: 0.3, c: '#3a3030' });
      },
    },
    // 물 맞고 부르르르 — 사방으로 물방울
    toyWet: {
      len: 1.4,
      pose(p, k, at) {
        // 눈을 질끈 감고 좌우로 한 칸씩 부르르 (기울이면 도트가 뭉개져서 옆으로만 떤다)
        p.eyes = 'closed'; p.mouth = 'wavy'; p.ear = -1; p.tail = 'slow';
        p.xf = { ox: Math.floor(at * 36) % 2 ? 1 : -1 };
      },
      step(r, k, at, dt, a) {
        r.emit({ type: 'tint', c: 'rgba(80,140,225,0.2)', perFrame: true, fade: false });
        if (every(r, 'd', at, 0.04)) r.emit({ type: 'drop', x: r.scr(a.hx + rand(-8, 8)), y: a.cy + rand(-6, 2), vx: rand(-30, 30), vy: rand(-20, -4), ay: 60, life: 0.5 });
      },
    },
    // 단단히 삐졌다. 눈 감고 고개 홱
    toySulk: {
      len: 2, loop: true,
      pose(p) { p.eyes = 'closed'; p.brow = 'angry'; p.mouth = 'frown'; p.ear = -1; p.tail = 'flick'; p.lookX = -1; },
      step(r, k, at, dt, a) { if (every(r, 'h', at, 1.5)) r.emit({ type: 'text', s: 'HMPH', x: r.scr(a.hx - 12), y: a.top - 5, vy: -3, life: 0.8, c: '#ffb0b0' }); },
    },
    // 뿅! 맞고 어질어질. 머리 위로 별이 빙글빙글
    toyDizzy: {
      len: 2,
      pose(p, k, at) { p.eyes = 'x'; p.mouth = 'wavy'; p.ear = -1; p.xf = { rot: Math.sin(at * 6) * 0.12, py: 44 }; },
      step(r, k, at, dt, a) {
        for (let i = 0; i < 3; i++) {
          const an = at * 6 + (i * Math.PI * 2) / 3;
          r.emit({ type: 'star', x: r.scr(a.hx + Math.round(Math.cos(an) * 7)), y: a.top - 3 + Math.round(Math.sin(an) * 2), perFrame: true, fade: false });
        }
      },
    },
    // 발끈해서 냥냥펀치
    toyPunch: {
      len: 1.2,
      pose(p, k, at) {
        const b = Math.floor(at * 12) % 2;
        p.armL = b ? 'cheer' : 'out'; p.armR = b ? 'out' : 'cheer';
        p.brow = 'angry'; p.eyes = 'squint'; p.mouth = 'big'; p.ear = -1; p.tail = 'flick';
      },
      step(r, k, at, dt, a) { if (every(r, 'l', at, 0.08)) r.emit({ type: 'line', x: r.scr(a.right + 2), y: a.ey + rand(-3, 3), len: 4, life: 0.1 }); },
    },
    // 뭔가를 깔고 앉아 의기양양 (드론·자동차)
    toySitOn: {
      len: 2, loop: true,
      pose(p, k, at) { p.dy = -3; p.eyes = Math.floor(at) % 3 ? 'happy' : 'closed'; p.mouth = 'smile'; p.tail = 'wag'; p.noShadow = true; p.blush = true; },
    },
    // 휴지를 발기발기
    toyShred: {
      len: 1.6,
      pose(p, k, at) { p.armL = p.armR = 'knead'; p.eyes = 'wide'; p.mouth = 'open'; p.ear = 1; p.lookY = 1; p.xf = { sx: 1.08, sy: 0.92 }; },
      step(r, k, at, dt, a) { if (every(r, 's', at, 0.06)) r.emit({ type: 'confetti', x: r.scr(a.hx + rand(-6, 6)), y: GROUND - 3, vx: rand(-30, 30), vy: rand(-30, -10), ay: 40, life: 0.9, c: '#fffaf3' }); },
    },
    // 바나나 껍질 밟고 주르륵 한 바퀴
    toySlip: {
      len: 1.1,
      pose(p, k) {
        p.noShadow = true;
        // 한 바퀴를 90° 씩 끊어 돈다 (비스듬한 각도에선 도트가 뭉개져서)
        p.xf = { rot: (Math.round(ease(seg(k, 0, 0.8)) * 4) * Math.PI) / 2, px: 24, py: 38, oy: -Math.round(bump(k, 0, 0.8) * 6) };
        p.eyes = k < 0.8 ? 'wide' : 'x'; p.mouth = 'o'; p.ear = 1; p.armL = p.armR = 'up'; p.dangle = 2;
      },
    },
    // 아무 일 없었던 척. 가슴 펴고 딴청, 휘파람
    toyPretend: {
      len: 2.4,
      pose(p) { p.eyes = 'closed'; p.lookX = -1; p.mouth = 'o'; p.xf = { sy: 1.05 }; p.tail = 'up'; },
      step(r, k, at, dt, a) { if (every(r, 'n', at, 0.5)) r.emit({ type: 'note', x: r.scr(a.fx + 5), y: a.my - 3, vx: 6, vy: -6, life: 0.9 }); },
    },
    // 쳇바퀴 안에서 전력 질주. 바퀴는 r.wheelSpeed 만큼 빨리 돈다
    toyWheel: {
      len: 0.6, loop: true,
      pose(p, k, at, r) {
        const sp = r.wheelSpeed || 1;
        p.step = (at * (2 + sp * 2)) % 1;
        p.dy = -1 + (Math.floor(at * 10 * sp) % 2 ? -1 : 0);
        p.eyes = sp > 2.5 ? 'x' : sp > 1.6 ? 'wide' : 'open'; p.mouth = sp > 1.6 ? 'o' : 'open'; p.ear = sp > 1.6 ? -1 : 1; p.tail = 'up';
        p.noShadow = true;
      },
      back(g, a, k, at, c) {
        const sp = this.wheelSpeed || 1;
        const pal = palOf(c.K);
        const cx = a.cx;
        const cy = GROUND - 13; // 바닥 받침에 딱 얹히는 높이
        for (const [dx, dy, ch] of wheelDots(at * sp * 5)) this.px(cx + dx, cy + dy, pal[ch], false);
      },
    },
    // 공포! 귀는 뒤로 착, 몸은 납작, 식은땀
    toyHide: {
      len: 1.6, loop: true,
      pose(p, k, at) { p.xf = { sx: 1.1, sy: 0.8, ox: Math.floor(at * 20) % 2 ? 0.5 : 0 }; p.eyes = 'wide'; p.ear = -1; p.sweat = true; p.mouth = 'wavy'; p.tail = 'slow'; },
    },
    // 떨어지는 컵을 무표정하게 내려다본다
    toyDeadpan: {
      len: 2,
      pose(p) { p.eyes = 'half'; p.mouth = 'flat'; p.lookY = 1; p.tail = 'flick'; },
    },
    // 높은 데 올라앉아 뿌듯
    toyPerch: {
      len: 2, loop: true,
      pose(p, k, at) { p.eyes = Math.floor(at * 0.8) % 3 ? 'happy' : 'open'; p.mouth = 'smile'; p.tail = 'wag'; p.noShadow = true; },
    },
    // 눈덩이 맞고 눈사람. 끝에 부르르 털어 낸다
    toySnowman: {
      len: 2.4,
      pose(p, k, at) {
        p.eyes = 'dot'; p.mouth = 'o'; p.ear = -1; p.tail = 'slow';
        if (k > 0.72) { p.xf = { ox: Math.floor(at * 36) % 2 ? 1 : -1 }; p.eyes = 'squint'; }
      },
      // 머리엔 소복한 눈 모자, 양 볼·배엔 눈 뭉치가 척척 붙었다 (몸은 하얗게 얼었지만 윤곽은 보이게)
      front(g, a, k) {
        if (k > 0.72) return;
        const S = { K: '#9fb4c8', W: '#ffffff', U: '#dfeaf5' };
        this.pattern(['...KKKKKK....', '.KKWWWWWWKK..', 'KWWWWUWWWWWK.', 'KUWWWWWWUWWUK'], a.hx - 6, a.earTop - 3, S);
        const lump = ['.KK.', 'KWWK', 'KUWK', '.KK.'];
        this.pattern(lump, a.left - 1, a.cy - 3, S);
        this.pattern(lump, a.right - 2, a.cy, S);
        this.pattern(['.KKK.', 'KWWUK', '.KKK.'], a.hx - 2, a.cy + 3, S);
      },
      step(r, k, at, dt, a) {
        if (k < 0.72) r.emit({ type: 'tint', c: 'rgba(240,248,255,0.45)', perFrame: true, fade: false });
        else if (every(r, 's', at, 0.03)) r.emit({ type: 'spray', x: r.scr(a.hx + rand(-8, 8)), y: a.cy + rand(-6, 4), vx: rand(-30, 30), vy: rand(-20, 0), ay: 40, life: 0.5, c: '#ffffff' });
      },
    },
    // 줄에 걸려 앞으로 콰당
    toyTrip: {
      len: 1.6,
      pose(p, k, at, r) {
        const s = ease(seg(k, 0, 0.3));
        p.xf = { rot: 1.3 * s * r.facing, px: 24 + 6 * r.facing, py: 44 };
        p.eyes = k < 0.3 ? 'wide' : 'x'; p.mouth = 'o'; p.ear = -1; p.noShadow = true; p.dangle = 1;
      },
    },
    // 작은 노트북 위에 드러누워 버렸다
    toyLaptopNap: {
      len: 3, loop: true,
      pose(p, k, at) { p.curl = true; p.dy = -3; p.eyes = 'closed'; p.mouth = 'flat'; p.noShadow = true; },
      // 뚜껑을 연 노트북: 고양이 뒤로 민트색 화면(쳐진 ;;;; 글자)이 서 있고, 고양이는 자판 위에 드러눕는다
      back(g, a, k, at, c) {
        const pal = palOf(c.K);
        const x = a.hx - 8;
        const blink = Math.floor(at * 2) % 2;
        // 화면은 몸보다 좁고 높게 세워서, 웅크린 고양이 머리 위로 쳐진 글자 줄과 깜빡이는 커서가 보인다
        this.pattern([
          '.KKKKKKKKKKK.',
          '.KDDDDDDDDDK.',
          '.KDMMMMMMMDK.',
          '.KDMmmMmmMDK.',
          '.KDMMMMMMMDK.',
          '.KDMmMm' + (blink ? 'H' : 'M') + 'MMDK.',
          '.KDMMMMMMMDK.',
          '.KDMMMMMMMDK.',
          '.KDMMMMMMMDK.',
          '.KDMMMMMMMDK.',
          '.KDMMMMMMMDK.',
          '.KDMMMMMMMDK.',
          '.KDMMMMMMMDK.',
          '.KDDDDDDDDDK.',
          '.KKKKKKKKKKK.',
        ].map((r) => '..' + r), x, GROUND - 17, pal, false);
        this.pattern(['KKKKKKKKKKKKKKKKK', 'KGgGgGgGgGgGgGgGK', 'KgGgGgGgGgGgGgGgK', 'KKKKKKKKKKKKKKKKK'], x, GROUND - 2, pal, false);
      },
      step(r, k, at, dt, a) { if (every(r, 'z', at, 1.3)) r.emit({ type: 'text', s: 'Z', x: r.scr(a.hx + 7), y: a.top - 3, vy: -4, life: 1.2, c: '#9aa6ff' }); },
    },
    // 깨워서 노트북을 두드리게 하면 미친 듯이 타자
    toyTypeFast: {
      len: 1, loop: true,
      // 놀이용 고양이 노트북이라 은색 업무용 노트북이 아니라 같은 민트 고양이 노트북으로 그린다 (sprite.js 의 drawLaptop)
      pose(p) { p.prop = 'laptop'; p.laptopSkin = 'cat'; p.armL = p.armR = 'typefast'; p.dy = -3; p.eyes = 'star'; p.mouth = 'open'; p.ear = 1; },
    },
    // 뭔가를 넋 놓고 바라본다 (슬롯머신 릴)
    toyWatch: {
      len: 1.2, loop: true,
      pose(p, k, at) { p.lookX = 1; p.eyes = 'wide'; p.mouth = 'o'; p.ear = 1; p.tail = 'flick'; p.dy = Math.floor(at * 4) % 2 ? -1 : 0; },
    },
    // 신나서 폴짝폴짝 (잭팟·줄넘기 성공)
    toyYay: {
      len: 1.2,
      pose(p, k) { p.dy = Math.round(-6 * Math.sin(((k * 2) % 1) * Math.PI)); p.armL = p.armR = 'cheer'; p.eyes = 'happy'; p.mouth = 'open'; p.tail = 'up'; p.ear = 1; },
      step(r, k, at, dt, a) { if (every(r, 'h', at, 0.25)) r.emit({ type: 'heart', x: r.scr(a.hx + rand(-8, 8)), y: a.top - 2, vy: -8, life: 0.8 }); },
    },

    // ----- 상자 -----
    // 상자로 폴짝 뛰어든다 (상자는 pet.js 가 고양이 쪽으로 당겨 준다)
    toyBoxIn: {
      len: 1.1,
      pose(p, k) {
        p.noTail = true;
        p.noShadow = true;
        if (k >= 0.55) p.clipY = 46; // 상자 밑으로 발이 삐져나오지 않게
        if (k < 0.25) { p.xf = { sx: 1.1, sy: 0.88 }; p.eyes = 'wide'; p.ear = 1; return; }
        const s = seg(k, 0.25, 0.8);
        p.dy = Math.round(-10 * Math.sin(s * Math.PI) + 4 * s);
        p.armL = p.armR = k < 0.8 ? 'up' : 'rest';
        p.eyes = k < 0.8 ? 'wide' : 'happy';
        p.ear = 1;
      },
      back(g, a, k, at, c) { drawPlaced(this, 'box', 'back', a, c); },
      front(g, a, k, at, c) { drawPlaced(this, 'box', 'front', a, c); },
    },
    // 귀만 빼꼼. 가끔 상자가 들썩
    toyBoxHide: {
      len: 2.4, loop: true,
      pose(p, k, at) {
        p.dy = 4; p.noTail = true; p.noShadow = true; p.clipY = 46; p.eyes = 'closed';
        p.ear = k > 0.55 && k < 0.65 ? 1 : 0;
      },
      back(g, a, k, at, c) { drawPlaced(this, 'box', 'back', a, c, wob(k)); },
      front(g, a, k, at, c) { drawPlaced(this, 'box', 'front', a, c, wob(k)); },
    },
    // 눈만 내놓고 두리번두리번
    toyBoxPeek: {
      len: 3.2, loop: true,
      pose(p, k, at, r) {
        p.dy = 0; p.noTail = true; p.noShadow = true; p.clipY = 46;
        p.lookX = k < 0.35 ? -1 : k < 0.7 ? 1 : 0;
        p.eyes = k > 0.85 ? 'blink' : 'wide';
        p.ear = 1;
      },
      back(g, a, k, at, c) { drawPlaced(this, 'box', 'back', a, c); },
      front(g, a, k, at, c) { drawPlaced(this, 'box', 'front', a, c); },
    },
    // 턱을 상자 끝에 괴고 아늑~ 골골골
    toyBoxCozy: {
      len: 4, loop: true,
      pose(p, k, at) {
        p.dy = -2; p.noTail = true; p.noShadow = true; p.clipY = 46;
        p.eyes = k < 0.5 ? 'happy' : k < 0.8 ? 'half' : 'happy';
        p.mouth = 'smile'; p.blush = true; p.ear = 0;
      },
      back(g, a, k, at, c) { drawPlaced(this, 'box', 'back', a, c); },
      front(g, a, k, at, c) {
        drawPlaced(this, 'box', 'front', a, c);
        // 상자 끝에 걸친 두 앞발
        for (const s of [-1, 1]) this.ellipse(a.hx + s * 4, 38, 2, 1.4, g.c.body, g.c.outline);
      },
      step(r, k, at, dt, a) {
        if (every(r, 'h', at, 1.3)) r.emit({ type: 'heart', x: r.scr(a.hx + rand(-8, 8)), y: a.top - 3, vy: -6, vx: rand(-2, 2), life: 1.3 });
        if (every(r, 'n', at, 0.9)) r.emit({ type: 'note', x: r.scr(a.hx - 12), y: 34, vy: -5, vx: -2, life: 1, c: '#c48b56' });
      },
    },
    // 상자 속에서 새근새근
    toyBoxNap: {
      len: 4, loop: true,
      pose(p, k, at) {
        p.dy = Math.sin(at * 1.2) > 0.4 ? 1 : 0;
        p.noTail = true; p.noShadow = true; p.clipY = 46;
        p.eyes = 'closed'; p.mouth = 'flat'; p.ear = -1;
      },
      back(g, a, k, at, c) { drawPlaced(this, 'box', 'back', a, c); },
      front(g, a, k, at, c) { drawPlaced(this, 'box', 'front', a, c); },
      step(r, k, at, dt, a) {
        if (every(r, 'z', at, 1.4)) r.emit({ type: 'text', s: 'Z', x: r.scr(a.hx + 8), y: a.top - 4, vy: -4, vx: 2, life: 1.3, c: '#9aa6ff' });
      },
    },
    // 상자 속에서 톡 건드리면 쏙 튀어나왔다 다시 들어간다
    toyBoxPop: {
      len: 0.9,
      pose(p, k) {
        p.noTail = true; p.noShadow = true; p.clipY = 46;
        p.dy = Math.round(-5 * bump(k, 0, 0.8));
        p.eyes = 'wide'; p.mouth = 'o'; p.ear = 1;
        p.armL = p.armR = k < 0.7 ? 'up' : 'rest';
      },
      back(g, a, k, at, c) { drawPlaced(this, 'box', 'back', a, c); },
      front(g, a, k, at, c) { drawPlaced(this, 'box', 'front', a, c); },
      step(r, k, at, dt, a) {
        if (once(r, '!', k > 0.1)) r.emit({ type: 'text', s: '!', x: r.scr(a.hx + 7), y: a.top - 9, vy: -4, life: 0.7, c: '#ffd35c' });
      },
    },

    // ----- 종이봉투 -----
    // 봉투 입구로 쏙
    toyBagIn: {
      len: 0.9,
      pose(p, k, at, r) {
        p.noShadow = true;
        if (k < 0.3) { p.xf = { sx: 1.1, sy: 0.88 }; p.eyes = 'wide'; p.ear = 1; return; }
        if (k > 0.7) { p.hide = true; return; }
        const s = seg(k, 0.3, 0.7);
        p.xf = { rot: 0.5 * r.facing * s, ox: Math.round(r.facing * 8 * s), oy: Math.round(3 * s), py: 40 };
        p.eyes = 'closed'; p.ear = -1; p.noTail = false;
      },
      front(g, a, k, at, c) { drawPlaced(this, 'bag', 'front', a, c); },
    },
    // 봉투 속에서 부스럭부스럭. 입구로 꼬리가 삐죽
    toyBag: {
      len: 3, loop: true,
      pose(p) { p.hide = true; p.noShadow = true; },
      front(g, a, k, at, c) {
        const rustle = Math.floor(at * 9) % 4 === 0 && k < 0.6 ? 1 : 0;
        drawPlaced(this, 'bag', 'front', a, c, 0, -rustle);
        if (k > 0.3 && k < 0.8) {
          // 입구 밖으로 나온 꼬리
          const off = Math.round((this.toyOff || 0) * this.facing);
          const x0 = a.hx + off - 11;
          const sw = Math.round(Math.sin(at * 6));
          for (let i = 0; i < 4; i++) {
            const y = 42 - i + (i > 1 ? sw : 0);
            this.px(x0 - i, y, g.c.body);
            this.px(x0 - i, y - 1, g.c.outline);
            this.px(x0 - i, y + 1, g.c.outline);
          }
          this.px(x0 - 4, 38 + sw, g.c.outline);
        }
      },
      step(r, k, at, dt, a) {
        const off = Math.round((r.toyOff || 0) * r.facing);
        if (k < 0.6 && every(r, 'c', at, 0.35)) r.emit({ type: 'line', x: r.scr(a.hx + off + rand(-6, 8)), y: 32 + rand(0, 3), len: 2, life: 0.25, c: 'rgba(120,90,60,0.8)' });
      },
    },
    // 어두운 봉투 입구 속에서 눈만 반짝
    toyBagPeek: {
      len: 2.4, loop: true,
      pose(p) { p.hide = true; p.noShadow = true; },
      front(g, a, k, at, c) {
        drawPlaced(this, 'bag', 'front', a, c);
        const off = Math.round((this.toyOff || 0) * this.facing);
        const x0 = a.hx + off - 11;
        const blink = k > 0.45 && k < 0.52;
        if (!blink) {
          const look = k < 0.3 ? 0 : 1;
          this.px(x0 + 1 + look, 40, '#ffe27a');
          this.px(x0 + 3 + look, 40, '#ffe27a');
        }
      },
    },

    // ----- 스크래처 -----
    // 스크래처 위에서 벅벅. 엉덩이를 들고 앞으로 쭉 기울인 채 앞발을 번갈아 높이 뻗었다가 끝까지 긁어내린다.
    // 벅벅벅 몰아서 긁다가 잠깐 멈추고 또 긁는다. 발톱이 닿을 때마다 스크래처가 들썩이고, 긁힌 자국이 남고, 골판지 부스러기가 뒤로 튄다
    toyScratch: {
      len: 2.6, loop: true,
      start(r) {
        r.ms.marks = [];
      },
      pose(p, k, at, r) {
        const RUN = 1.9; // 이만큼 긁고 나머지는 숨 고르기
        const P = 0.3; // 한 발이 한 번 긁는 데 걸리는 시간
        p.mouth = 'flat';
        p.tail = 'up';
        if (at < RUN) {
          // 앞발 둘이 반 박자씩 엇갈린다. 올릴 때는 빠르게(0→35%), 긁어내릴 때는 힘주어 천천히
          const claw = [0, 1].map((i) => {
            const ph = (at / P + i * 0.5) % 1;
            return ph < 0.35 ? 1 - ph / 0.35 : (ph - 0.35) / 0.65;
          });
          p.armL = p.armR = 'claw';
          p.claw = claw;
          // 앞으로 기울여 몸이 길어지고, 긁어내릴 때마다 어깨가 따라 내려간다
          const pull = Math.max(claw[0], claw[1]);
          // 긁어내리는 발 쪽으로 몸이 한 칸씩 쏠린다 (힘이 실리는 느낌)
          const lean = claw[0] > claw[1] ? -1 : 1;
          p.xf = { sx: 1.1, sy: 0.9 + (1 - pull) * 0.05, ox: lean, rot: lean * 0.04 };
          p.dy = -2 + Math.round(pull);
          p.ear = -1;
          p.eyes = 'squint';
        } else {
          // 숨 고르기: 앞발을 내리고 만족스럽게 한 번 깜빡
          p.armL = p.armR = 'knead';
          p.xf = { sx: 1.04, sy: 0.97 };
          p.dy = -2;
          p.ear = 1;
          p.eyes = at < RUN + 0.3 ? 'happy' : 'open';
        }
      },
      // 스크래처는 발톱이 바닥에 닿는 순간 한 칸 들썩인다
      back(g, a, k, at, c) {
        const P = 0.3;
        const hit = at < 1.9 && [0, 1].some((i) => {
          const ph = (at / P + i * 0.5) % 1;
          return ph > 0.93 || ph < 0.04;
        });
        drawPlaced(this, 'scratcher', 'back', a, c, hit ? (Math.floor(at * 40) % 2 ? 1 : -1) : 0);
      },
      // 긁힌 자국: 발이 지나간 자리에 밝은 줄이 생겼다가 천천히 사라진다
      front(g, a, k, at, c) {
        for (const m of this.ms.marks || []) {
          const life = at - m.at;
          if (life < 0 || life > 1.6) continue;
          // 골판지 윗면(44·45줄)에 밝은 발톱 자국 세 줄
          this.pattern(life < 1 ? ['W.W.W', '.S.S.'] : ['S.S.S'], a.hx + m.dx - 2, 44, palOf(c.K), false);
        }
      },
      step(r, k, at, dt, a) {
        const P = 0.3;
        if (at >= 1.9) return;
        for (const i of [0, 1]) {
          const ph = (at / P + i * 0.5) % 1;
          // 한 번 긁어내리고 끝나는 순간: 자국 하나, 부스러기 한 움큼
          if (ph > 0.9 && once(r, 'hit' + i + Math.floor(at / P + i * 0.5), true)) {
            const dx = (i ? 2 : -3) + Math.round(rand(-1, 1));
            r.ms.marks = [...(r.ms.marks || []).slice(-5), { at, dx }];
            for (let j = 0; j < 7; j++) {
              r.emit({
                type: 'confetti', x: r.scr(a.hx + dx + rand(-1, 1)), y: 42,
                vx: rand(-40, 40), vy: rand(-34, -12), ay: 80, life: rand(0.5, 0.9),
                c: ['#e0a764', '#b07436', '#f6d7a2'][Math.floor(rand(0, 3))],
              });
            }
          }
        }
      },
    },
    // 다 긁고 나서 그 위에 식빵
    toyScratchLoaf: {
      len: 4, loop: true,
      pose(p, k, at) {
        p.curl = true;
        p.dy = -2 + (Math.sin(at * 1.4) > 0.3 ? -1 : 0);
        p.eyes = Math.floor(at * 0.6) % 2 ? 'half' : 'happy';
        p.noShadow = true;
      },
      back(g, a, k, at, c) { drawPlaced(this, 'scratcher', 'back', a, c); },
    },
  };

  // 캣휠: 두꺼운 나무 테(바깥 선·밝은 나무·발판 결), 여섯 바큇살, 가운데 축, A 자로 벌어진 받침 다리.
  // 축 기준 칸 단위 [dx, dy, 색 글자] 목록 — 고양이가 안에서 달릴 때(고양이 캔버스)와 비어 있을 때(놀이판)가 같은 그림을 쓴다.
  // spin = 바퀴가 돈 각도. 발판 결과 바큇살이 같이 돈다
  const WHEEL_R = 14;
  function wheelDots(spin) {
    const R = WHEEL_R;
    const out = [];
    const seg = (x1, y1, ch, from = 0) => {
      // 축에서 (x1, y1) 까지 브레젠험
      let x = 0, y = 0, n = 0;
      const dx = Math.abs(x1), dy = -Math.abs(y1), sx = Math.sign(x1) || 1, sy = Math.sign(y1) || 1;
      let err = dx + dy;
      for (;;) {
        if (n++ >= from) out.push([x, y, ch]);
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
    };
    // 받침 다리와 바닥 판
    seg(-8, R, 'c', 1);
    seg(8, R, 'c', 1);
    for (let x = -10; x <= 10; x++) out.push([x, R, 'c']);
    // 바큇살
    for (let s = 0; s < 6; s++) {
      const an = spin + (s * Math.PI) / 3;
      seg(Math.round(Math.cos(an) * (R - 3)), Math.round(Math.sin(an) * (R - 3)), 't', 2);
    }
    // 축
    out.push([0, 0, 'K'], [-1, 0, 'C'], [1, 0, 'C'], [0, -1, 'C'], [0, 1, 'C']);
    // 테: 바깥 선 → 밝은 나무 → 발판 (돌아가는 결)
    for (const [x, y] of circlePts(R)) out.push([x, y, 'K']);
    for (const [x, y] of circlePts(R - 1)) out.push([x, y, 'T']);
    const turn = spin / (Math.PI * 2);
    for (const [x, y] of circlePts(R - 2)) {
      const a = Math.atan2(y, x) / (Math.PI * 2);
      out.push([x, y, (((a - turn) * 18) % 1 + 1) % 1 < 0.3 ? 'C' : 't']);
    }
    return out;
  }

  // 상자 들썩 (한 바퀴 중 잠깐)
  function wob(k) {
    return k > 0.6 && k < 0.72 ? (Math.floor(k * 60) % 2 ? 1 : -1) : 0;
  }

  // 옆으로 벌러덩 누워 뒷발을 팡팡. kick = 발차기 빠르기(0 이면 늘어져 있다)
  function lieDown(p, at, kick) {
    p.xf = { rot: -Math.PI / 2, px: 24, py: 38, oy: 1 };
    p.dangle = kick ? (Math.floor(at * kick) % 2 ? 2 : -2) : 1;
    p.noShadow = true;
    p.tail = 'wag';
    p.ear = 0;
  }

  // ---------- 놀이판 ----------
  // 화면 전체 캔버스에 도트 한 칸(D px) 단위로 찍는다
  const snap = (v, D) => Math.floor(v / D) * D;
  function dotAt(ctx, x, y, D, col) {
    ctx.fillStyle = col;
    ctx.fillRect(snap(x, D), snap(y, D), D, D);
  }
  // 도트 격자 위의 한 칸 굵기 선 (브레젠험). 계단이 두 겹으로 겹치거나 끊기지 않는다
  function line(ctx, x0, y0, x1, y1, D, col) {
    let gx = Math.floor(x0 / D);
    let gy = Math.floor(y0 / D);
    const ex = Math.floor(x1 / D);
    const ey = Math.floor(y1 / D);
    const dx = Math.abs(ex - gx);
    const dy = -Math.abs(ey - gy);
    const sx = gx < ex ? 1 : -1;
    const sy = gy < ey ? 1 : -1;
    let err = dx + dy;
    ctx.fillStyle = col;
    for (let n = 0; n < 4000; n++) {
      ctx.fillRect(gx * D, gy * D, D, D);
      if (gx === ex && gy === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; gx += sx; }
      if (e2 <= dx) { err += dx; gy += sy; }
    }
  }
  // 반지름 R 칸짜리 도트 원 둘레 (중점 원). 빈틈도 겹침도 없다. [dx, dy] 목록, 반지름마다 한 번만 만든다
  const circCache = {};
  function circlePts(R) {
    R = Math.max(0, Math.round(R));
    if (circCache[R]) return circCache[R];
    const seen = new Set();
    const pts = [];
    const add = (x, y) => {
      const k = x + ',' + y;
      if (!seen.has(k)) { seen.add(k); pts.push([x, y]); }
    };
    let x = R;
    let y = 0;
    let d = 1 - R;
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) add(a, b);
      y++;
      if (d < 0) d += 2 * y + 1;
      else { x--; d += 2 * (y - x) + 1; }
    }
    // 둘레를 도는 순서로 정렬 (각도 순) — 무지갯빛처럼 둘레를 따라 색을 바꿀 때 쓴다
    pts.sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
    return (circCache[R] = pts);
  }
  // 둘레가 circlePts 와 딱 맞는 꽉 찬 원: 줄마다 [dy, 왼쪽 dx, 오른쪽 dx]
  const spanCache = {};
  function discSpans(R) {
    R = Math.max(0, Math.round(R));
    if (spanCache[R]) return spanCache[R];
    const m = {};
    for (const [x, y] of circlePts(R)) m[y] = Math.max(m[y] || 0, Math.abs(x));
    return (spanCache[R] = Object.keys(m).map((y) => [+y, -m[y], m[y]]));
  }
  // 도트 원 칠하기. fill 은 속, edge 는 둘레 한 칸 (없으면 fill)
  function disc(ctx, cx, cy, r, D, fill, edge) {
    const R = Math.round(r / D);
    const x0 = snap(cx, D);
    const y0 = snap(cy, D);
    if (fill) {
      ctx.fillStyle = fill;
      for (const [y, a, b] of discSpans(R)) ctx.fillRect(x0 + a * D, y0 + y * D, (b - a + 1) * D, D);
    }
    if (edge) {
      ctx.fillStyle = edge;
      for (const [x, y] of circlePts(R)) ctx.fillRect(x0 + x * D, y0 + y * D, D, D);
    }
  }
  // 도트 그림을 가운데(cx, cy)에 찍는다. flip 이면 좌우로 뒤집는다
  function stampAt(ctx, rows, cx, cy, D, pal, flip = false) {
    const w = rows[0].length;
    const x0 = snap(cx - (w * D) / 2, D);
    const y0 = snap(cy - (rows.length * D) / 2, D);
    rows.forEach((row, j) => {
      for (let i = 0; i < w; i++) {
        const col = pal[row[flip ? w - 1 - i : i]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x0 + i * D, y0 + j * D, D, D);
      }
    });
  }
  // 도트 원 둘레. col 이 함수면 둘레의 각도(0~1)마다 색을 고른다
  function ring(ctx, cx, cy, r, D, col) {
    const x0 = snap(cx, D);
    const y0 = snap(cy, D);
    if (typeof col !== 'function') ctx.fillStyle = col;
    for (const [x, y] of circlePts(r / D)) {
      if (typeof col === 'function') {
        const c = col((Math.atan2(y, x) / (Math.PI * 2) + 1) % 1, x, y);
        if (!c) continue;
        ctx.fillStyle = c;
      }
      ctx.fillRect(x0 + x * D, y0 + y * D, D, D);
    }
  }
  // 고양이 뒤에 그리기: fn 이 그린 것 중 고양이(펫 캔버스)와 겹치는 곳을 지우고 놀이판에 얹는다.
  // 놀이판은 고양이 위에 깔려 있어서, 바퀴·상자처럼 고양이 뒤에 있어야 할 것을 그릴 때 쓴다. box = [x, y, w, h] (그릴 범위)
  let behind = null;
  function underCat(ctx, fn, box) {
    const W = ctx.canvas.width;
    const Hc = ctx.canvas.height;
    if (!behind) behind = document.createElement('canvas');
    if (behind.width !== W || behind.height !== Hc) {
      behind.width = W;
      behind.height = Hc;
    }
    const [bx, by, bw, bh] = box ? box.map(Math.round) : [0, 0, W, Hc];
    const g = behind.getContext('2d');
    g.clearRect(bx, by, bw, bh);
    fn(g);
    const pet = document.getElementById('pet');
    if (pet && !pet.hidden && pet.width) {
      const r = pet.getBoundingClientRect();
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.imageSmoothingEnabled = false;
      g.drawImage(pet, r.left, r.top, r.width, r.height);
      g.restore();
    }
    ctx.drawImage(behind, bx, by, bw, bh, bx, by, bw, bh);
  }

  const LURE = ['..KKKK...K', '.KBBBBK.KBK', 'KBHBBBBKKBK', 'KBBBBBBBKBK', '.KbbbbK..KK', '..KKKK....'].map((r) => r.padEnd(11, '.'));
  const FEATHER = [
    '....KK.',
    '...KPPK',
    '..KPPPK',
    '.KPPPK.',
    '.KBBK..',
    'KBBBK..',
    'KYYK...',
    '.KK....',
  ];
  const GRIP = ['KKK', 'KRK', 'KrK', 'KRK', 'KrK', 'KKK'];
  const WAND = ['.KKKK.', 'K....K', 'K....K', 'K....K', '.KKKK.'];
  const NOTE = ['.KK', '.K.', 'KK.'];
  const LASER_DOT = ['.R.', 'RWR', '.R.'];
  const LASER_PAL = { R: '#ff2a2a', W: '#fff0ec' };

  // 비눗방울 한 알 (R = 반지름 칸 수). 테두리는 둘레를 따라 무지갯빛이 천천히 돌고, 왼쪽 위에 반짝이는 하이라이트.
  // 속은 거의 투명하게 살짝만
  const SOAP = ['rgba(143,207,245,0.95)', 'rgba(185,166,245,0.95)', 'rgba(245,176,214,0.95)', 'rgba(250,226,160,0.9)', 'rgba(160,232,204,0.95)', 'rgba(143,207,245,0.95)'];
  function soap(ctx, x, y, R, D, phase, fillA = 0.1) {
    R = Math.max(1, R);
    if (R > 1) disc(ctx, x, y, (R - 1) * D, D, `rgba(215,238,255,${fillA})`);
    ring(ctx, x, y, R * D, D, (a) => SOAP[Math.floor(((a + phase) % 1) * 6)]);
    const x0 = snap(x, D);
    const y0 = snap(y, D);
    ctx.fillStyle = '#ffffff';
    if (R <= 2) {
      ctx.fillRect(x0 - D, y0 - D, D, D);
      return;
    }
    // 왼쪽 위 안쪽으로 짧은 호 모양 하이라이트, 오른쪽 아래엔 작은 반사광 한 점
    for (const [px, py] of circlePts(R - 1)) {
      const a = (Math.atan2(py, px) / (Math.PI * 2) + 1) % 1;
      if (a > 0.59 && a < 0.7 + (R > 5 ? 0.04 : 0)) ctx.fillRect(x0 + px * D, y0 + py * D, D, D);
    }
    if (R > 4) {
      const [px, py] = circlePts(R - 1).find(([qx, qy]) => qx > 0 && qy > 0 && Math.abs(qx - qy) <= 1) || [0, 0];
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(x0 + px * D, y0 + py * D, D, D);
    }
  }

  const field = {
    // 낚싯대: 손잡이는 마우스, 장대 끝에서 줄이 늘어지고 줄 끝에 물고기 미끼
    rod(ctx, rod, D) {
      const pal = palOf('#2b1a10');
      line(ctx, rod.hx, rod.hy, rod.tx, rod.ty, D, '#5c3a1f');
      line(ctx, rod.hx + D, rod.hy, rod.tx + D, rod.ty, D, '#b07436');
      stampAt(ctx, GRIP, rod.hx, rod.hy + 2 * D, D, pal);
      const pts = rod.pts;
      for (let i = 1; i < pts.length; i++) line(ctx, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, D, '#7a5c3e');
      const end = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      stampAt(ctx, LURE, end.x, end.y + 2 * D, D, pal, end.x - prev.x < 0);
    },
    // 깃털 막대: 휘청이는 철사 끝에 알록달록 깃털
    teaser(ctx, tz, D) {
      const pal = palOf('#2b1a10');
      const mx = (tz.hx + tz.tx) / 2 + (tz.bx || 0);
      const my = (tz.hy + tz.ty) / 2 + (tz.by || 0);
      // 손잡이 쪽은 곧고 끝으로 갈수록 휜다 (두 번 꺾어 그린다)
      line(ctx, tz.hx, tz.hy, mx, my, D, '#454b57');
      line(ctx, mx, my, tz.tx, tz.ty, D, '#454b57');
      stampAt(ctx, GRIP, tz.hx, tz.hy + 2 * D, D, pal);
      stampAt(ctx, FEATHER, tz.tx + 2 * D, tz.ty + 3 * D, D, pal, tz.vx < 0);
      dotAt(ctx, tz.tx, tz.ty, D, '#ffd65a');
    },
    // 비눗방울 막대(동그란 고리)와 떠다니는 방울들, 터지는 순간
    bubbles(ctx, st, D, mx, my, t) {
      const pal = palOf('#2b1a10');
      if (mx != null) {
        line(ctx, mx, my, mx + 5 * D, my - 6 * D, D, '#6fb0ea');
        stampAt(ctx, WAND, mx + 7 * D, my - 9 * D, D, { K: '#3a6fb0' });
      }
      for (const b of st.list) soap(ctx, b.x, b.y, Math.round(b.r), D, t * 0.35 + b.wob);
      for (const p of st.pops) {
        const k = p.age / 0.3;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          dotAt(ctx, p.x + Math.cos(a) * p.r * D * (1 + k), p.y + Math.sin(a) * p.r * D * (1 + k), D, `rgba(170,215,245,${1 - k})`);
        }
      }
      void pal;
    },
    // 레이저 점: 하얗게 달아오른 한가운데, 새빨간 십자, 둘레로 번지는 붉은 빛이 두근두근
    laser(ctx, x, y, D, t, big = 1) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 14);
      const R = Math.round((2 + pulse) * big);
      disc(ctx, x, y, R * D, D, 'rgba(255,50,50,0.16)');
      disc(ctx, x, y, Math.max(1, R - 1) * D, D, 'rgba(255,50,50,0.2)');
      stampAt(ctx, LASER_DOT, x + D / 2, y + D / 2, D, LASER_PAL);
    },
    // 꾹 눌러 만든 큰 비눗방울. 무지갯빛 테두리와 반짝이는 하이라이트
    giant(ctx, g, D, t) {
      soap(ctx, g.x, g.y, Math.round(g.r / D), D, t * 0.35, 0.12);
    },
    // 캣닢 가루
    nip(ctx, x, y, D, alpha) {
      dotAt(ctx, x, y, D, `rgba(120,196,106,${alpha})`);
      dotAt(ctx, x + D, y - D, D, `rgba(180,240,160,${alpha})`);
    },
    // 털실이 굴러간 자리에 남는 가닥. 풀린 실은 바닥에 눕고, 맨 끝만 털실(또는 안고 있는 고양이)까지 올라간다
    thread(ctx, pts, D) {
      const n = pts.length;
      if (n < 2) return;
      const floor = snap(ctx.canvas.height - 4, D) - D;
      const lay = pts.map((p, i) => (i === n - 1 ? p : { x: p.x, y: floor }));
      // 끝 가닥: 바닥에서 한 칸 옆에서 올라가게 (수직으로 뚝 서지 않게)
      const end = pts[n - 1];
      const prev = lay[n - 2];
      const foot = { x: end.x + Math.sign(prev.x - end.x || 1) * 3 * D, y: floor };
      for (let i = 1; i < n - 1; i++) line(ctx, lay[i - 1].x, lay[i - 1].y, lay[i].x, lay[i].y, D, '#ff8fb0');
      line(ctx, prev.x, prev.y, foot.x, foot.y, D, '#ff8fb0');
      line(ctx, foot.x, foot.y, end.x, end.y, D, '#ff8fb0');
    },
    // 방울공이 구르며 내는 소리 (음표)
    note(ctx, x, y, D, alpha) {
      stampAt(ctx, NOTE, x, y, D, { K: `rgba(217,162,31,${alpha})` });
    },
  };

  root.PetSprite.TOY_POSES = Object.assign(root.PetSprite.TOY_POSES || {}, TP);
  root.PetSprite.CARRY = Object.assign(root.PetSprite.CARRY || {}, CARRY);
  root.PetToys = { PLACED, paintPlaced, field, dotAt, line, stampAt, ring, disc, circlePts, discSpans, underCat, wheelDots, WHEEL_R, palOf };
})(window);
