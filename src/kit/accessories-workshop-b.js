// 보물 공방 코스튬 (2026-09-24) B: 몸 5 + 등 2 + 세트 2. 주운 보물을 재료로 만든다. accessories.js 뒤에 읽는다
// 색은 pixelart.js TREASURE(뽁뽁이·먼지 뭉치·단추·빵 봉지 끈·Esc 키캡·클립·10원·영수증·딱지·구슬·매미 허물·지렁이·도토리·열쇠) 그림에서 가져왔다
// 고양이는 거의 머리라 입(my) 아래로 몸이 세 줄뿐이다: 목걸이 펜던트는 바닥 줄까지 내려와 앞에 놓이고, 망토는 옷깃처럼 머리 옆으로 솟게 했다
(function (root) {
  const { GROUND, sway, hash, wear, hood, isFace } = root.PetSprite.costumeKit;

  // 보물 그림과 같은 재료 색
  const TIE = { Y: '#ffd65a', y: '#e0a91e', d: '#8a5a20' }; // 빵 봉지 끈 (금색 꼬임)
  const PAPER = { W: '#fbf7ee', old: '#f1e6d2', ink: '#8a8f99', crease: '#c9bda8' };

  // 빵 봉지 끈을 X 자로 비틀어 묶은 매듭 (3×3)
  function twist(r, x, y) {
    r.pattern(['Y.y', '.d.', 'y.Y'], x - 1, y - 1, TIE);
  }
  // 딱지 한 장 (5×5): 네 귀퉁이를 접어 대각선이 X 로 보인다. 위아래 u, 양옆 v
  function ddakji(r, x, y, u, v, K) {
    r.pattern(['KUUUK', 'VKUKV', 'VVKVV', 'VKUKV', 'KUUUK'], x, y, { K, U: u, V: v });
  }
  // 구슬 (4×4): 유리알에 초록 소용돌이, 흰 하이라이트
  function marble(r, x, y, K) {
    r.pattern(['.KK.', 'KHMK', 'KmbK', '.KK.'], x, y, { K, H: '#ffffff', M: '#bfe6f5', m: '#5cb895', b: '#3a6fb0' });
  }
  // 머리 둘레보다 한 칸 크게 씌우는 후드 천 (sets6 와 같은 방식)
  function bigHood(r, a, c, col) {
    const bottom = a.curled ? GROUND - 1 : a.my + 2;
    for (let y = a.top; y <= bottom; y++) {
      r.px(a.left, y, col);
      r.px(a.right, y, col);
      r.px(a.left - 1, y, c.K);
      r.px(a.right + 1, y, c.K);
    }
    for (let x = a.left; x <= a.right; x++) { r.px(x, a.top, col); r.px(x, a.top - 1, c.K); }
    r.px(a.left, a.top - 1, c.K);
    r.px(a.right, a.top - 1, c.K);
  }
  // 망토 자리: 머리 옆에서 옷깃처럼 솟았다가 바깥으로 비스듬히 내려와 바닥에 끌린다.
  // 아랫자락은 물결(wave)을 따라 옆으로 흔들린다. 반환값 inside(x, y) 와 그 줄의 흔들림 shift(y)
  function capeArea(a, t, o) {
    const hw = a.hx - a.left;
    const shift = (y) => {
      const k = y - a.top;
      return k > 3 ? Math.round(Math.sin(t * o.speed - k * 0.6) * o.amp * Math.min(1, (k - 3) / 5)) : 0;
    };
    const topAt = (e) => (e <= 0 ? a.top + 2 : e <= o.collar ? a.top + 2 - e * o.rise : a.top + 2 - o.collar * o.rise + (e - o.collar) * o.fall);
    const inside = (x, y) => {
      if (y > GROUND) return false;
      const dx = x - a.hx;
      const s = shift(y);
      const e = Math.abs(dx - s) - hw;
      const ee = dx - s < 0 ? e : e + o.rightCut;
      return y >= topAt(ee) && (!o.bottom || y <= o.bottom(x, y));
    };
    return { inside, shift, box: [a.left - 20, a.top - 8, a.right + 20, GROUND] };
  }

  const ACC = {
    // ======================= 몸 =======================
    bubblearmor: {
      // 뽁뽁이 갑옷: 몸을 뽁뽁이로 칭칭 감고 어깨엔 부푼 뽁뽁이 견갑. 가운데를 빵 봉지 끈으로 X 자로 묶었다.
      // 몇 알은 이미 터져서 납작하고, 가끔 한 알이 '뽁' 터진다
      front(g, a, c, t) {
        const U = '#d6ecf8', u = '#9cc4e0', H = '#ffffff', P = '#b4bec6';
        const popAt = Math.floor(t / 1.6);
        const popPh = (t % 1.6) / 1.6;
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (leg) return null;
          if ((x + y) % 2) return u;
          const h = hash(x * 3 + y * 17);
          if (h < 0.18) return P;
          return h > 0.7 ? H : U;
        });
        if (a.curled) {
          twist(this, a.hx, GROUND - 2);
          return;
        }
        // 어깨 견갑: 양옆으로 불룩한 뽁뽁이 덩어리 (알마다 하이라이트, 한 알은 터졌다)
        const m = { K: c.K, U, u, H, P };
        this.pattern(['.KKK.', 'KHuHK', 'KuPuK', 'KHuHK', '.KKK.'], a.left - 3, a.my, m);
        this.pattern(['.KKK.', 'KHuHK', 'KuHuK', 'KPuHK', '.KKK.'], a.right - 1, a.my, m);
        // 견갑을 묶은 끈 + 가슴 매듭
        this.px(a.left - 1, a.my + 2, TIE.Y);
        this.px(a.right + 1, a.my + 2, TIE.Y);
        twist(this, a.hx, a.my + 3);
        // 뽁! 한 알이 터지며 작은 파편
        const spots = [[-4, 2], [3, 1], [5, 3], [-2, 1]];
        const [sx, sy] = spots[popAt % spots.length];
        if (popPh < 0.25) {
          this.px(a.hx + sx, a.my + sy, P);
          const k = popPh < 0.12 ? 1 : 2;
          for (const [ox, oy] of [[-k, -k], [k, -k], [0, -k - 1]]) this.px(a.hx + sx + ox, a.my + sy + oy, 'rgba(255,255,255,0.9)', false);
        }
      },
    },

    dustscarf: {
      // 먼지 목도리: 소파 밑 먼지 뭉치를 줄줄이 엮어 목에 둘렀다. 보송한 잔털이 삐죽삐죽, 까만 티끌이 콕콕.
      // 한쪽 끝은 축 늘어져 달랑. 가끔 먼지가 코를 간지럽혀 '에취' 먼지 구름이 퐁
      front(g, a, c, t) {
        const D1 = '#d6d1c9', D2 = '#aaa59d', D3 = '#f0ece4', Ol = '#5e5a55', sp = '#4a4640';
        const tone = (x, y) => {
          const h = hash(x * 11 + y * 5);
          return h < 0.1 ? sp : h < 0.3 ? D2 : h > 0.8 ? D3 : D1;
        };
        // 먼지 뭉치 하나: 윗줄은 좁고 아래 두 줄은 넓은 동글동글 덩어리, 가장자리는 진회색, 잔털 삐죽
        const ball = (cx, y0, seed, rows = [1, 2, 2]) => {
          rows.forEach((w, j) => {
            for (let d = -w; d <= w; d++) this.px(cx + d, y0 + j, Math.abs(d) === w ? Ol : tone(cx + d, y0 + j));
          });
          for (let k = 0; k < 3; k++) {
            const h = hash(seed * 13 + k + Math.floor(t * 0.8) * 0.37);
            const side = k === 0 ? -1 : k === 1 ? 1 : h < 0.5 ? -1 : 1;
            const yy = y0 + Math.min(rows.length - 1, 1 + Math.floor(h * 2));
            this.px(cx + side * (rows[yy - y0] + 1), yy, k === 2 ? Ol : D2, false);
          }
        };
        if (a.curled) {
          for (let i = 0; i < 4; i++) ball(a.hx - 5 + i * 3, GROUND - 3, i, [1, 2, 1]);
          return;
        }
        const y0 = a.my + 1;
        // 뒤쪽 뭉치부터 (가운데가 맨 앞)
        for (const [dx, i] of [[-6, 0], [6, 1], [-2, 2], [2, 3]]) ball(a.hx + dx, y0, i);
        // 오른쪽으로 늘어진 끝자락: 작은 먼지 뭉치 두 개가 대롱대롱
        const s = sway(t, 2, 1);
        ball(a.right + 2 + Math.round(s * 0.5), a.my + 2, 9, [1, 1, 1]);
        ball(a.right + 3 + s, GROUND - 1, 12, [1, 1]);
        // 에취: 3.8초마다 먼지 구름이 퐁
        const p = (t % 3.8) / 3.8;
        if (p > 0.82) {
          const q = (p - 0.82) / 0.18;
          const r = 1 + q * 3;
          for (let k = 0; k < 5; k++) {
            const ang = Math.PI + (k - 2) * 0.55;
            this.px(a.left - 1 + Math.cos(ang) * r * 1.3, a.my + 1 + Math.sin(ang) * r, `rgba(210,206,198,${(0.95 * (1 - q)).toFixed(2)})`, false);
          }
        }
      },
    },

    buttonnecklace: {
      // 짝짝이 단추 목걸이: 빵 봉지 끈에 여기저기서 주운 단추를 꿰었다. 색도 크기도 구멍 수도 다 다르다
      front(g, a, c, t) {
        const K = c.K;
        const btns = [
          // [dx, 무늬, 색] — 보라 사구 단추, 빨간 꼬마 단추, 큼직한 초록 단추, 와이셔츠 단추, 반쯤 깨진 나무 단추
          [-5, ['VkV', 'VVV'], { V: '#b683f2', k: '#5a3490' }],
          [-2, ['RR', 'rR'], { R: '#e5463f', r: '#a52e2a' }],
          [1, ['NNN', 'NkN', 'NNN'], { N: '#79c46b', k: '#2f5a2a' }],
          [4, ['WW', 'Wg'], { W: '#fffaf3', g: '#9aa0aa' }],
          [6, ['T.', 'tT'], { T: '#e0a764', t: '#8a5a34' }],
        ];
        const draw = (x0, yAt, list) => list.forEach(([dx, rows, map]) => {
          const w = rows[0].length;
          const x = x0 + dx - Math.floor(w / 2);
          const y = yAt(dx) + 1;
          for (let j = -1; j <= rows.length; j++) for (let i = -1; i <= w; i++) this.px(x + i, y + j, K);
          this.pattern(rows, x, y, map);
        });
        if (a.curled) {
          draw(a.hx, () => GROUND - 3, btns.slice(0, 4));
          return;
        }
        const yAt = (dx) => (Math.abs(dx) >= 4 ? a.my : a.my + 1);
        // 끈: 금색 꼬임이 번갈아
        for (let dx = -6; dx <= 6; dx++) this.px(a.hx + dx, yAt(dx), (dx + 20) % 2 ? TIE.Y : TIE.y);
        draw(a.hx, yAt, btns);
        // 끈 끝 매듭이 목 옆에 삐죽
        this.px(a.left - 1, a.my - 1, TIE.Y);
        this.px(a.left - 2, a.my - 2, TIE.y);
        // 큰 초록 단추에 반짝
        if (t % 2.8 < 0.2) this.px(a.hx, a.my + 2, '#ffffff');
      },
    },

    esckeycap: {
      // Esc 키캡 목걸이: 알록달록 코팅 클립을 이어 만든 줄에 빠진 Esc 키 하나. 도망치고 싶은 날 목에 건다
      front(g, a, c, t) {
        const clips = ['#ff9bb8', '#c8ccd4', '#72b3ea', '#ffd65a', '#c8ccd4', '#79c46b'];
        const km = { K: c.K, W: '#fbf7ee', D: '#3a3f4a', s: '#8a8f99', G: '#b8bcc6' };
        // E 한 글자 + 작은 sc 두 점. 아랫단은 회색 키 옆면. 바닥 앞에 살짝 놓인다
        const cap = ['.KKKKK.', 'KWDDWWK', 'KWDWssK', 'KWDDWWK', '.KGGGK.'];
        if (a.curled) {
          this.pattern(cap, a.right + 1, GROUND - 4, km);
          return;
        }
        const top = a.my + 1;
        const s = Math.round(Math.sin(t * 2) * 0.6);
        const kx = a.hx - 3 + s;
        // 클립 줄: 목 양옆에서 키캡 어깨로. 클립 한 개 = 같은 색 두 칸
        for (const side of [-1, 1]) {
          const pts = side < 0
            ? [[a.left + 1, a.my - 1], [a.left + 1, a.my], [a.left + 2, a.my], [a.left + 3, a.my + 1], [kx, top + 1], [kx, top]]
            : [[a.right - 1, a.my - 1], [a.right - 1, a.my], [a.right - 2, a.my], [a.right - 3, a.my + 1], [kx + 6, top + 1], [kx + 6, top]];
          pts.forEach(([x, y], k) => this.px(x, y, clips[(Math.floor(k / 2) + (side > 0 ? 3 : 0)) % clips.length]));
        }
        this.pattern(cap, kx, top, km);
        // 키캡 윗면에 스치는 빛
        if (t % 3 < 0.2) this.px(kx + 5, top + 1, '#ffffff');
      },
    },

    coinmedal: {
      // 10원짜리 금메달: 빨강·파랑 리본에 구리 10원 동전을 달았다. 본인은 금메달인 줄 안다 (가끔 뿌듯한 반짝)
      front(g, a, c, t) {
        const cm = { K: '#5c3a1f', T: '#d98a4a', H: '#ffd0a0', d: '#8a4a1e' };
        const coin = ['.KKKKK.', 'KdHdddK', 'KdTdTdK', 'KdTdddK', '.KKKKK.'];
        if (a.curled) {
          this.pattern(coin, a.right + 1, GROUND - 4, cm);
          return;
        }
        const top = a.my + 1;
        // 리본: 왼쪽 빨강, 오른쪽 파랑이 목 옆에서 동전으로 모인다 (두 칸 폭)
        const Rb = [['#e5463f', '#a52e2a'], ['#72b3ea', '#3a6fb0']];
        [-1, 1].forEach((s, i) => {
          const [L, D] = Rb[i];
          for (const [dx, dy, col] of [[6, -2, D], [6, -1, L], [5, -1, D], [5, 0, L], [4, 0, D], [4, 1, L], [3, 1, D]]) this.px(a.hx + s * dx, a.my + dy, col);
        });
        const sw = Math.round(Math.sin(t * 2.2) * 0.5);
        this.pattern(coin, a.hx - 3 + sw, top, cm);
        // 뿌듯한 반짝
        const p = t % 3.2;
        if (p < 0.35) this.pattern(['.X.', 'XWX', '.X.'], a.hx + 4 + sw, top - 1, { X: '#ffe07a', W: '#ffffff' }, false);
      },
    },

    // ======================= 등 =======================
    receiptcape: {
      // 영수증 망토: 길쭉한 영수증을 줄줄이 이어 붙였다. 머리 옆으로 빳빳이 선 옷깃, 줄마다 흐린 인쇄 글자와 구김,
      // 끝은 찢긴 채 제각각 길이로 펄럭이고, 한 장은 롤 끝을 알리는 분홍 줄까지 나왔다
      back(g, a, c, t) {
        const strip = (x) => Math.floor((x + 300) / 3);
        const len = (x) => GROUND - Math.floor(hash(strip(x) * 7 + 1) * 3);
        const paint = (x, y, sh) => {
          const xx = x - sh;
          const u = (xx + 300) % 3, st = strip(xx);
          if (u === 2) return PAPER.crease; // 영수증 사이 틈
          const L = len(xx);
          if (st % 5 === 2 && y >= L - 1) return '#ff9bb8'; // 롤 끝 분홍 줄
          if (y % 2 === 0 && hash(st * 13 + y) < 0.7 && !(u === 1 && hash(st + y * 3) < 0.4)) return PAPER.ink; // 인쇄 글자
          if (hash(xx * 5 + y * 3) < 0.15) return PAPER.crease; // 구김
          return st % 2 ? PAPER.W : PAPER.old;
        };
        if (a.curled) {
          this.ellipse(a.cx - 1, a.cy - 1, 10, 6, (x, y) => paint(x, y, 0), c.K);
          return;
        }
        const area = capeArea(a, t, { speed: 5, amp: 1.3, collar: 2, rise: 1.6, fall: 1.7, rightCut: 2, bottom: (x, y) => len(x - area.shift(y)) });
        this.shape(area.inside, area.box, (x, y) => paint(x, y, area.shift(y)), c.K);
      },
      front(g, a, c) {
        if (a.curled) return;
        // 목 앞 여밈: 영수증 두 가닥을 은색 클립으로 집었다
        this.pattern(['W.....W', '.WWgWW.'], a.hx - 3, a.my + 1, { W: PAPER.W, g: '#8a8f99' });
      },
    },

    ddakjicape: {
      // 동네 딱지왕 망토: 보라 망토에 동네 애들한테 딴 딱지를 핀으로 꽂았다. 빳빳한 옷깃, 금색 단, 목엔 구슬 걸쇠
      back(g, a, c, t) {
        const V = '#6a3a9a', v = '#4a2470', Au = '#ffd65a';
        if (a.curled) {
          this.ellipse(a.cx - 1, a.cy - 1, 10, 6, (x, y) => (y >= a.cy + 3 ? Au : x < a.cx - 6 ? v : V), c.K);
          ddakji(this, a.cx - 13, a.cy - 2, '#3a6fb0', '#e5463f', c.K);
          return;
        }
        const area = capeArea(a, t, { speed: 4, amp: 1, collar: 2, rise: 1.2, fall: 1.5, rightCut: 2 });
        this.shape(area.inside, area.box, (x, y) => {
          const xx = x - area.shift(y);
          if (y === GROUND) return Au;
          if (!area.inside(x, y - 1)) return '#9a6ac8'; // 옷깃·어깨 윗선에 비치는 빛
          return (xx + 300) % 4 === 0 ? v : V;
        }, c.K);
        // 핀으로 꽂은 딱지: 망토 자락과 같이 흔들린다
        const tiles = [
          [a.left - 9, a.top + 5, '#3a6fb0', '#e5463f'],
          [a.right + 3, a.top + 4, '#ff9bb8', '#8454c4'],
        ];
        tiles.forEach(([x, y, u, w]) => {
          const s = area.shift(y + 2);
          ddakji(this, x + (x < a.hx ? -s : s), y, u, w, c.K);
          this.px(x + 2 + (x < a.hx ? -s : s), y - 1, '#e4e8ee'); // 핀 머리
        });
      },
      front(g, a, c, t) {
        if (a.curled) return;
        // 목 끈 + 구슬 걸쇠
        this.pattern(['V......V', '.VV..VV.'], a.hx - 4, a.my + 1, { V: '#6a3a9a' });
        marble(this, a.hx - 2, a.my + 1, c.K);
        if (t % 2.6 < 0.2) this.px(a.hx - 1, a.my + 2, '#ffffff');
      },
    },

    // ======================= 세트 =======================
    cicadasuit: {
      // 여름 한정 매미 허물 슈트: 속이 비치는 호박색 허물을 통째로 뒤집어썼다. 마디마다 진한 줄, 머리 양옆엔
      // 불룩한 겹눈, 정수리는 매미가 빠져나간 자리처럼 쩍 갈라졌다. 옆구리엔 갈고리 다리, 허리엔 말라붙은 지렁이 벨트와 도토리 버클
      front(g, a, c, t) {
        const A = 'rgba(206,140,56,0.8)', Seg = '#7a4618', Hi = 'rgba(255,232,176,0.85)', Thin = 'rgba(200,140,70,0.5)';
        hood(this, g, a, (dx, y, x, j) => {
          if (isFace(a, dx, y)) return null;
          if (j <= 1) return Seg;
          if ((y - a.top) % 2 === 1) return Seg;
          if (Math.abs(dx) === 4 && y < a.ey) return Hi;
          if (Math.abs(dx) >= 5 && y >= a.ey) return Thin; // 얇아서 속 털이 비친다
          return A;
        });
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (leg) return A;
          if (!a.curled && dy === 0) return Math.abs(dx) % 2 ? '#d49088' : '#9a5a50'; // 말라붙은 지렁이 벨트
          if ((dy + 10) % 2 === 1) return Seg;
          return Math.abs(dx) === 3 ? Hi : A;
        });
        // 얼굴 둘레 테 (허물 가장자리)
        for (let dx = -4; dx <= 4; dx++) this.px(a.hx + dx, a.ey - 2, Seg);
        // 겹눈: 머리 양옆으로 불룩 튀어나왔다
        const eye = { K: '#2b1a10', E: '#3a2410', e: '#6a4020', H: '#fff0c8' };
        this.pattern(['.KK.', 'KHEK', 'KEeK', '.KK.'], a.left - 3, a.top, eye);
        this.pattern(['.KK.', 'KEHK', 'KeEK', '.KK.'], a.right, a.top, eye);
        // 정수리 갈라진 틈 (지그재그로 쩍)
        const cr = '#fff2d0';
        for (const [dx, dy] of [[0, -1], [0, 0], [1, 1], [0, 2]]) this.px(a.hx + dx, a.top + dy, cr);
        if (a.curled) return;
        // 갈고리 다리: 옆구리 양쪽에 두 개씩, 끝이 위로 굽었다
        const L = '#9a6430', Lk = '#4a2a10';
        for (const s of [-1, 1]) {
          const x = s < 0 ? a.left - 1 : a.right + 1;
          for (const dy of [1, 3]) {
            this.px(x, a.my + dy, L);
            this.px(x + s, a.my + dy, L);
            this.px(x + s * 2, a.my + dy - 1, Lk);
          }
        }
        // 도토리 버클
        this.pattern(['cCc', '.T.'], a.hx - 1, a.my + 3, { c: '#8a5a34', C: '#5c3a1f', T: '#e0a764' });
        // 여름 햇빛에 허물이 반짝
        const p = (t % 3) / 0.6;
        if (p < 1) this.px(a.left + 2 + Math.round(p * 8), a.top + 1, '#fff6d8');
      },
    },

    gatekeeper: {
      // 비밀의 문지기: 깊게 눌러쓴 남보라 두건과 바닥까지 끌리는 망토(안감은 검붉다). 가슴엔 짝짝이 구슬 단추와 딱지 배지,
      // 허리 열쇠 꾸러미엔 짝짝이 열쇠들 사이로 '어느 문 열쇠인지 모를' 금빛 옛 열쇠가 은은하게 빛나며 짤랑인다
      back(g, a, c, t) {
        const D = '#2a2438', d = '#1a1624', L = '#7a2a3a';
        if (a.curled) {
          this.ellipse(a.cx - 1, a.cy - 1, 10.5, 6.5, (x, y) => (x < a.cx - 7 ? L : (x + 300) % 4 === 0 ? d : D), c.K);
          return;
        }
        const area = capeArea(a, t, { speed: 1.6, amp: 1, collar: 2, rise: 1.2, fall: 1.25, rightCut: 1 });
        this.shape(area.inside, area.box, (x, y) => {
          const xx = x - area.shift(y);
          const dx = x - a.hx;
          // 바깥 자락 끝은 뒤집혀 검붉은 안감이 보인다
          if (!area.inside(x + (dx < 0 ? -1 : 1), y) || !area.inside(x + (dx < 0 ? -2 : 2), y)) return L;
          return (xx + 300) % 4 === 1 ? d : D;
        }, c.K);
        // 두건 끝: 귀 사이로 뾰족하게 솟았다
        this.pattern(['..K..', '.KDK.', 'KDDDK'], a.hx - 2, a.top - 3, { K: c.K, D });
      },
      front(g, a, c, t) {
        const D = '#2a2438', d = '#1a1624', Au = '#ffd65a';
        hood(this, g, a, (dx, y) => (isFace(a, dx, y) ? null : Math.abs(dx) >= 5 && y > a.ey ? d : D));
        bigHood(this, a, c, D);
        // 얼굴 둘레 금실 + 이마 그늘 (두건이 눈 위로 드리운다)
        for (let dx = -4; dx <= 4; dx++) {
          this.px(a.hx + dx, a.ey - 2, (dx + 20) % 2 ? '#8a6a2a' : D);
          this.px(a.hx + dx, a.ey - 1, 'rgba(20,16,30,0.5)', false);
        }
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (leg) return d;
          if (dy === 0 && !a.curled) return '#5a3a22'; // 가죽 허리띠
          return Math.abs(dx) >= 5 ? d : D;
        });
        if (a.curled) {
          this.pattern(['KKK...', 'K.KYYY', 'KKKY.Y'], a.right + 1, GROUND - 3, { K: '#c8ccd4', Y: Au });
          return;
        }
        // 짝짝이 구슬 단추 (색이 다 다르다) + 딱지 배지
        this.px(a.hx + 1, a.my + 1, '#bfe6f5');
        this.px(a.hx + 1, a.my + 3, '#ff9bb8');
        this.pattern(['RBR', 'BKB', 'RBR'], a.hx + 3, a.my + 1, { R: '#e5463f', B: '#3a6fb0', K: c.K });
        // 열쇠 꾸러미: 허리 왼쪽 고리에 매달려 망토 위에서 짤랑. 2.8초마다 크게 흔들린다
        const jingle = t % 2.8 < 0.7;
        const amp = jingle ? 1.2 : 0.4;
        const rs = (i) => Math.round(Math.sin(t * (jingle ? 14 : 3) + i * 2) * amp);
        const rx = a.left - 2, ry = a.my;
        this.pattern(['.g.', 'g.g', '.g.'], rx, ry, { g: '#c8ccd4' });
        // 짝짝이 작은 열쇠 셋 (은, 놋쇠, 파란 고무 머리)
        const small = [
          [0, { S: '#c8ccd4', s: '#6a707c' }, ['S', 'S', 's']],
          [2, { S: '#e0a764', s: '#8a5a20' }, ['S', 'S', 'Ss']],
          [1, { S: '#72b3ea', s: '#8a8f99' }, ['S', 's', 's']],
        ];
        small.forEach(([ox, m, rows], i) => this.pattern(rows, rx + ox + rs(i), ry + 3, m));
        // 옛 열쇠: 제일 크고 금빛, 고리에서 바깥으로 누워 있다. 숨 쉬듯 은은하게 빛난다
        const glow = 0.5 + 0.5 * Math.sin(t * 2.5);
        const ok = { K: '#8a5a10', Y: Au, y: '#e0a91e', H: '#fff6c0' };
        const oy = ry + 1 + (jingle && Math.floor(t * 14) % 2 ? 1 : 0);
        const ox = rx - 8;
        for (const [dx, dy] of [[-1, 1], [3, -1], [6, 3], [9, 1]]) this.px(ox + dx, oy + dy, `rgba(255,220,120,${(0.2 + glow * 0.45).toFixed(2)})`, false);
        this.pattern(['.KK..KKK.', 'KYYKKYHYK', 'KyKyYYKYK', '.K.KKKYYK', '......KK.'], ox, oy - 1, ok);
        // 짤랑일 때 반짝이 두 점
        if (jingle && Math.floor(t * 10) % 2) {
          this.px(rx + 4, ry, '#fff6c0', false);
          this.px(ox - 1, oy - 2, '#fff6c0', false);
        }
        // 주변에 떠도는 금빛 먼지 (비밀스러운 분위기)
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.25 + i / 3) % 1;
          const x = a.left - 4 + Math.round(hash(i * 9 + Math.floor(t * 0.25 + i / 3)) * (a.right - a.left + 8));
          this.px(x, a.my + 2 - Math.round(p * 10), `rgba(255,214,90,${(0.7 * Math.sin(p * Math.PI)).toFixed(2)})`, false);
        }
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);
