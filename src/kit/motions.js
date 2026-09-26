// 모션. sprite.js 의 PetRenderer.play(key) 로 틀거나, 기분마다 계속 반복하게 걸어 둔다.
//  len               : 한 바퀴 길이(초). loop 이면 반복해도 자연스럽게 이어지는 모션
//  pose(p, k, at, r)  : 자세를 정한다. k = 0~1 진행도, at = 시작 후 초
//  back/mid/front(g, a, k, at, c) : 몸 뒤·앞발 밑·맨 앞에 소품을 그린다 (a = 기준점, c = 색)
//  step(r, k, at, dt, a, p)       : 효과를 뿌린다 (화면 좌표. 방향이 뒤집히면 r.scr 로 뒤집는다)
// 어느 상황에 쓰는지·상점 가격은 main/shop.js 의 MOTION_SLOTS / MOTIONS, 이름은 i18n.js 의 'motion.<key>'.
(function (root) {
  const { rand, seg, bump, ease, GROUND } = root.PetSprite.util;
  // 조건이 처음 참이 될 때 한 번만
  const once = (r, tag, cond) => {
    if (cond && !r.ms[tag]) { r.ms[tag] = true; return true; }
    return false;
  };
  // period 초마다 한 번씩
  const every = (r, tag, at, period) => {
    const n = Math.floor(at / period);
    if (r.ms[tag] !== n) { r.ms[tag] = n; return true; }
    return false;
  };
  const CONFETTI = ['#ff6f91', '#ffd35c', '#6fb0ea', '#78c46a', '#b784f5', '#ff9a3c'];
  // 소품 도트
  const SHADES = ['kkkkkkkkkkk', '.kkkk.kkkk.', '.kHkk.kHkk.', '..kk...kk..']; // 선글라스
  const CIG = ['WWWWWo']; // 담배 (끝이 빨갛게 탄다)
  const BOTTLE = ['.KK.', '.KK.', 'KNNK', 'KNWK', 'KNNK', 'KNNK', '.KK.']; // 초록 소주병
  const SHOT = ['KUK', 'KUK', '.K.']; // 소주잔
  const PAD = ['.KKKKK.', 'KDDDDDK', 'KDRDBDK', 'KDDDDDK', 'KK...KK']; // 게임패드
  const FISH = ['.KKKK.K.', 'KkBBBKBK', '.KKKK.K.']; // 모자에서 튀어나오는 생선

  // ---------- 4차 (상황별) 에서 쓰는 것 ----------
  const txt = (r, s, x, y, c, life = 0.8, vy = -4) => r.emit({ type: 'text', s, x, y, vy, life, c });
  // 노트북 앞에 앉아 일하는 기본 자세 (기분 '일하는 중'과 같은 높이)
  const desk = (p, fast) => { p.prop = 'laptop'; p.armL = p.armR = fast ? 'typefast' : 'type'; p.dy = -3; p.mouth = 'flat'; };
  const CROWN = ['.K.K.K.', 'KYKYKYK', 'KYYYYYK', 'KYRYBYK', 'KKKKKKK']; // 대관식 왕관
  const POPPER = ['...KK', '..KYK', '.KYRK', 'KRYK.', 'KKK..']; // 파티 폭죽
  const MONITOR = ['KKKKKKKKK', 'KBBBBBBBK', 'KBWWBBBBK', 'KBBBWWWBK', 'KBBBBBBBK', 'KKKKKKKKK', '....K....', '..KKKKK..'];
  const FISHDREAM = ['..KKKK.K.', '.KOOOOKOK', 'KOHOOOOOK', '.KOOOOKOK', '..KKKK.K.']; // 상상 속 음식들
  const STEAK = ['.KKKKKK.', 'KrRRRRrK', 'KRRWRRRK', 'KrRRRRrK', '.KKKKKK.'];
  const CAKE = ['...Y...', '..KRK..', '.KWWWK.', 'KPPPPPK', 'KWWWWWK', 'KKKKKKK'];

  // ---------- 5차 (2026-09-22) 에서 쓰는 것 ----------
  const MUG = ['KtttK.', 'KWWWKK', 'KWCWKK', 'KWWWK.', '.KKK..'];
  const PHONE = ['KKKK', 'KUUK', 'KUUK', 'KUUK', 'KKKK'];
  const CONF = CONFETTI;

  // ---------- 7차 다듬기 (2026-09-24) 에서 쓰는 것 ----------
  // 고양이에만 색을 덧칠한다. 효과 목록 맨 앞에 끼워서, 먼저 떠 있던 글자·연기·번개는 물들이지 않는다
  const tintUnder = (r, c, a, mode) => {
    const n = r.fx.length;
    r.emit({ type: 'tint', c, a, mode, perFrame: true, fade: false });
    if (r.fx.length > n) r.fx.unshift(r.fx.pop());
  };
  // 번쩍! 캔버스 전체(투명한 바탕화면 위의 흰 네모)가 아니라 고양이만 하얗게 번쩍인다. s = 0(시작)~1(끝)
  const flashCat = (r, s) => { if (s >= 0 && s < 1) tintUnder(r, '#ffffff', 0.9 * (1 - s)); };
  // 가느다란 김 한 가닥 (얼굴을 덮는 뭉게구름 대신 점 몇 개가 하늘하늘 올라간다)
  const steam = (r, x, y, c = 'rgba(255,255,255,0.75)', vx = 0) => r.emit({ type: 'spray', x: x + rand(-0.6, 0.6), y, vx: vx + rand(-1.6, 1.6), vy: -5, life: 1, c });
  // 오프스크린(고양이 그림)에서 이미 칠해진 도트에만 색을 얹는다 — 얼굴만 빨개질 때 (back/mid/front 안에서 this 로 부른다)
  function tintArea(x, y, w, h, c) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    ctx.restore();
  }
  // 몸에서 뻗어 나온 앞다리 하나 (어깨 → 발끝). 2칸 굵기에 외곽선, 끝에 동그란 발. back/mid/front 안에서 this 로 부른다
  function limb(g, x0, y0, x1, y1) {
    const O = g.c.outline, B = g.c.body;
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)]);
    // 어깨쪽 두 점은 몸 안이라 외곽선을 긋지 않는다 (몸통 외곽선이 열리며 다리가 이어져 나온다)
    pts.forEach(([x, y], i) => { if (i >= 2) for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) this.px(x + dx, y + dy, O); });
    for (const [x, y] of pts) { this.px(x, y, B); this.px(x + 1, y, B); this.px(x, y + 1, B); this.px(x + 1, y + 1, B); }
    this.pattern(['.OO.', 'OBBO', 'OBBO', '.OO.'], Math.round(x1) - 1, Math.round(y1) - 1, { O, B });
  }
  root.PetSprite.motionFx = { tintUnder, flashCat, steam, tintArea, limb }; // 뒤쪽 묶음(세트 전용·6차)도 같이 쓴다

  const M = {
    stretch: {
      // 기지개 — 앞발을 쭉 내밀며 상체를 낮추고(엉덩이·꼬리는 번쩍) 쩌억 하품, 이번엔 몸을 위로 쭉 늘인 뒤
      // 부르르 털고 개운한 얼굴 (7차: 납작하게 눌리기만 하던 걸 앞으로 → 위로 두 번 늘이는 기지개로)
      len: 3.8,
      pose(p, k, at) {
        const lo = ease(bump(k, 0.06, 0.48)); // 앞으로 쭉 (상체를 낮춘다)
        const hi = ease(bump(k, 0.46, 0.68)); // 위로 쭉
        p.xf = { sx: 1 + 0.2 * lo - 0.06 * hi, sy: 1 - 0.14 * lo + 0.1 * hi };
        if (lo > 0.2) {
          p.armL = p.armR = 'front'; p.tail = 'up'; p.ear = -1; p.lookY = 1;
          p.eyes = lo > 0.75 ? 'closed' : 'squint';
          if (lo > 0.8) p.mouth = 'big'; // 쩌억 하품
          else if (lo > 0.5) p.mouth = 'o';
        }
        if (hi > 0.2) { p.eyes = 'closed'; p.mouth = 'flat'; p.tail = 'up'; p.ear = -1; p.lookY = -1; }
        if (k > 0.7 && k < 0.84) {
          // 부르르 — 머리부터 꼬리까지 털고 귀가 파닥
          const d = 1 - seg(k, 0.7, 0.84);
          p.xf = { ox: Math.round(Math.sin(at * 50) * 1.4 * d) };
          p.eyes = 'closed'; p.ear = Math.floor(at * 16) % 2 ? 1 : -1; p.tail = 'flick';
        }
        if (k >= 0.84) { p.eyes = 'happy'; p.mouth = 'smile'; p.tail = 'wag'; }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'y', k > 0.3)) txt(r, 'YAWN', r.scr(a.hx + 5), a.top - 6, '#fff', 0.9, -3);
        if (once(r, 's', k > 0.86)) r.emit({ type: 'spark', x: r.scr(a.hx + 8), y: a.top - 2, life: 0.6 });
      },
    },
    loaf: {
      // 식빵 굽기 — 앞발을 몸 밑에 넣고 식빵 자세. 등에서 김이 모락모락(구워지는 중)
      len: 4, loop: true,
      pose(p, k, at) {
        p.curl = true;
        p.eyes = Math.floor(at * 0.7) % 2 ? 'half' : 'happy';
        // 바닥에서 뜨지 않고 등만 부풀었다 가라앉는다 (빵이 부푸는 것처럼)
        p.sy = Math.sin(at * 1.6) > 0.3 ? 1.02 : 1;
        p.tail = 'slow';
      },
      step(r, k, at, dt, a) {
        // 갓 구운 빵 김: 등 위에서 가느다랗게 모락모락
        if (every(r, 'steam', at, 0.22)) steam(r, r.scr(a.hx + [-3, 0, 3][Math.floor(at / 0.22) % 3]), a.top - 1, 'rgba(255,255,255,0.8)');
      },
    },
    nodoff: {
      // 꾸벅꾸벅 — 조는 중… 고개가 스르르 떨어지다가 화들짝!
      len: 4.2, loop: true,
      pose(p, k) {
        if (k < 0.6) {
          const s = seg(k, 0, 0.6);
          // 고개가 스르르 — 시선이 먼저 떨어지고, 몸이 조금씩 가라앉는다
          const e = ease(s);
          p.eyes = s < 0.3 ? 'half' : 'closed';
          p.lookY = s > 0.35 ? 1 : 0;
          p.dy = s > 0.55 ? 1 : 0;
          p.xf = { sy: 1 - e * 0.08, sx: 1 + e * 0.03 };
          p.ear = s > 0.2 ? -1 : 0;
          p.mouth = 'flat';
          p.tail = 'slow';
        } else if (k < 0.7) { p.dy = k < 0.64 ? -2 : -1; p.eyes = 'wide'; p.ear = 1; p.mouth = 'o'; p.tail = 'up'; }
        else { p.eyes = k < 0.8 ? 'open' : 'half'; p.mouth = 'flat'; p.lookX = k < 0.8 ? (k < 0.75 ? -1 : 1) : 0; p.tail = 'slow'; }
      },
      step(r, k, at, dt, a) {
        if (k < 0.55 && every(r, 'z', at, 1.1)) r.emit({ type: 'text', s: 'Z', x: r.scr(a.hx + 6), y: a.top - 6, vy: -4, vx: 2, life: 1.2, c: '#9aa6ff' });
        if (once(r, 'jolt', k > 0.6)) r.emit({ type: 'text', s: '!', x: r.scr(a.hx + 6), y: a.top - 8, vy: -4, life: 0.8, c: '#ffd35c' });
      },
    },
    lick: {
      // 발 핥고 세수 — 앞발을 날름날름 핥은 다음 그 발로 얼굴을 쓱쓱
      len: 3.4, loop: true,
      pose(p, k, at, r) {
        if (k < 0.55) { p.armR = 'lick'; p.mouth = Math.floor(at * 8) % 2 ? 'lick' : 'smile'; p.eyes = 'closed'; }
        else { p.armR = 'groom'; p.eyes = Math.floor(at * 2) % 2 ? 'happy' : 'closed'; p.mouth = 'flat'; }
        p.tail = 'slow';
      },
    },
    bath: {
      // 거품 목욕 — 욕조에 몸 담그고 머리엔 거품, 옆엔 고무 오리
      len: 4.4, loop: true,
      pose(p) { p.dy = 3; p.eyes = 'happy'; p.blush = true; p.noTail = true; },
      back(g, a) {
        for (let x = a.hx - 11; x <= a.hx + 11; x++) this.px(x, 41, x === a.hx - 11 || x === a.hx + 11 ? g.c.outline : '#e8f2fa');
      },
      front(g, a, k, at, c) {
        const L = a.hx - 11;
        this.pattern(
          ['KKKKKKKKKKKKKKKKKKKKKKK', 'KWWWWWWWWWWWWWWWWWWWWWK', 'KWWWWWWWWWWWWWWWWWWWWWK', 'KBBBBBBBBBBBBBBBBBBBBBK', 'KWWWWWWWWWWWWWWWWWWWWWK', '.KKKKKKKKKKKKKKKKKKKKK.', '..KK...............KK..'],
          L, 42, c,
        );
        [[-9, 41], [-7, 40], [-4, 41], [5, 41], [8, 40]].forEach(([dx, y]) => this.ellipse(a.hx + dx, y, 1.3, 1.1, '#fff', '#cfe3f2'));
        this.ellipse(a.hx, a.top - 1, 2.6, 1.4, '#fff', '#cfe3f2');
        this.ellipse(a.hx - 2, a.top - 2, 1.4, 1.2, '#fff', '#cfe3f2');
        const bob = Math.round(Math.sin(at * 3));
        this.pattern(['.KK..', 'KYYK.', 'KYYYOK'.slice(0, 5), '.KKK.'], a.hx + 7, 38 + bob, c);
      },
      step(r, k, at, dt, a) {
        if (every(r, 'bb', at, 0.4)) r.emit({ type: 'bubble', x: r.scr(a.hx + rand(-9, 9)), y: 40, vy: -8, r: rand(0.8, 1.6), life: 1.3 });
      },
    },

    zoomies: {
      // 우다다 — 갑자기 미친 듯이 왔다 갔다. 먼지 폴폴, 귀는 뒤로 착
      len: 2.6,
      pose(p, k, at, r) {
        const pass = Math.min(2, Math.floor(k * 3));
        const ph = k * 3 - pass;
        const dir = pass % 2 === 0 ? 1 : -1;
        r.setFacing(k > 0.98 ? 1 : dir);
        p.xf = { ox: dir > 0 ? -14 + ph * 28 : 14 - ph * 28 };
        if (k > 0.98) p.xf.ox = 0;
        p.step = (at * 5) % 1;
        p.eyes = 'wide';
        p.mouth = 'o';
        p.ear = -1;
        p.tail = 'up';
        p.dy = Math.floor(at * 10) % 2 ? -1 : 0;
      },
      step(r, k, at, dt, a, p) {
        const ox = p.xf ? p.xf.ox || 0 : 0;
        if (every(r, 'dust', at, 0.07)) r.emit({ type: 'dust', x: 24 + ox - r.facing * 8, y: GROUND, vx: -r.facing * 6, vy: -3, life: 0.5 });
        if (every(r, 'ln', at, 0.09)) r.emit({ type: 'line', x: 24 + ox - r.facing * 11 - (r.facing > 0 ? 4 : 0), y: 34 + Math.floor(rand(0, 8)), len: 4, life: 0.22 });
      },
    },
    box: {
      // 박스 들어가기 — 상자만 보면 일단 들어간다. 눈만 빼꼼
      len: 4, reveal: 0.4, loop: true,
      pose(p, k, at) {
        if (k < 0.12) { p.eyes = 'wide'; p.ear = 1; }
        else if (k < 0.3) {
          const s = seg(k, 0.12, 0.3);
          p.dy = Math.round(-7 * Math.sin(s * Math.PI) + s * 3);
          p.eyes = 'wide';
          p.armL = p.armR = 'up';
        } else { p.dy = 3; p.eyes = Math.floor(at * 0.8) % 3 === 0 ? 'happy' : 'open'; p.ear = 1; p.noTail = true; }
      },
      back(g, a, k, at, c) {
        for (let y = 40; y <= 42; y++) for (let x = a.hx - 8; x <= a.hx + 8; x++) this.px(x, y, x === a.hx - 8 || x === a.hx + 8 ? c.K : c.t);
        this.pattern(['KKKK...', '.KTTKK.', '..KKTTK'], a.hx - 11, 39, c);
        this.pattern(['...KKKK', '.KKTTK.', 'KTTKK..'], a.hx + 5, 39, c);
      },
      front(g, a, k, at, c) {
        this.pattern(['KKKKKKKKKKKKKKKKK', 'KTTTTTTYYTTTTTTTK', 'KTTTTTTYYTTTTTTTK', 'KTTtTTTTTTTTTtTTK', 'KKKKKKKKKKKKKKKKK'], a.hx - 8, 42, c);
      },
    },
    coffee: {
      // 커피 한 잔 — 두 발로 머그를 쥐고 호로록… 하아, 볼이 발그레
      len: 4.4, loop: true,
      pose(p, k, at, r) {
        p.armL = p.armR = 'hold';
        if (k < 0.4) p.eyes = r.blinkAt(at) ? 'blink' : 'open';
        else if (k < 0.66) { p.eyes = 'closed'; p.mouth = 'none'; }
        else { p.eyes = 'happy'; p.blush = true; }
      },
      mid(g, a, k, at, c) {
        const lift = k >= 0.4 && k < 0.66 ? -3 : 0;
        this.pattern(['KtttK.', 'KWWWKK', 'KWCWKK', 'KWWWK.', '.KKK..'], a.hx - 2, a.my + 1 + lift, c);
      },
      step(r, k, at, dt, a) {
        // 김은 잔에서 가늘게. 마시는 동안(잔이 입에 붙어 있을 때)은 쉰다 — 얼굴을 덮지 않게
        const sip = k >= 0.4 && k < 0.66;
        if (!sip && every(r, 'st', at, 0.16)) steam(r, r.scr(a.hx + 3), a.my + 1, undefined, r.facing * 5); // 볼 옆으로 비껴 올라간다
        if (once(r, 'ha', k > 0.68)) r.emit({ type: 'puff', x: r.scr(a.fx + 5), y: a.my, vx: r.facing * 8, vy: -2, life: 0.9, c: 'rgba(255,255,255,0.7)' });
      },
    },
    cafe: {
      // 커피 한 잔의 여유 — 작은 카페 탁자에 앉아 김 오르는 잔을 들고 호로록… 후우 한숨 쉬고
      // 잔을 내려놓은 뒤 등을 기대 눈을 감는다. 머리 위로 낙엽이 팔랑
      len: 8, loop: true,
      pose(p, k, at, r) {
        p.tail = 'slow';
        if (k < 0.14) {
          p.lookX = 1;
          p.eyes = r.blinkAt(at) ? 'blink' : 'open';
        } else if (k < 0.5) {
          p.armL = p.armR = 'hold';
          const sip = k > 0.2 && k < 0.36;
          p.eyes = sip ? 'closed' : k < 0.2 ? 'half' : 'happy';
          p.mouth = sip ? 'none' : k > 0.36 && k < 0.44 ? 'o' : 'smile';
          p.blush = k >= 0.36;
        } else if (k < 0.58) {
          p.lookX = 1;
          p.eyes = 'happy';
          p.blush = true;
        } else {
          p.xf = { rot: -0.07 * r.facing, py: 44 };
          p.eyes = Math.floor(at * 0.6) % 3 === 0 ? 'half' : 'closed';
          p.blush = true;
          p.ear = -1;
        }
      },
      back(g, a, k, at, c) {
        // 대리석 윗판에 나무 다리 하나짜리 카페 탁자
        const x = a.hx + 9;
        this.pattern(
          ['.KKKKKKKKK.', 'KWWWWWWWwwK', '.KKKKKKKKK.', '....KTK....', '....KTK....', '....KTK....', '....KtK....', '....KtK....', '..KKKtKKK..', '.KtttttttK.'],
          x, 35, c,
        );
        // 탁자 위 크루아상
        this.pattern(['.KKK.', 'KOoOK', '.KKK.'], x + 6, 32, c);
        // 잔을 들고 있지 않을 때는 받침 위에 놓여 있다
        if (k < 0.14 || k >= 0.5) {
          this.pattern(['KtttK.', 'KWWWKK', 'KWCWKK', 'KWWWK.'], x + 1, 30, c);
          this.pattern(['KwwwwwK'], x, 34, c);
        } else this.pattern(['KwwwwwK'], x, 34, c);
      },
      mid(g, a, k, at, c) {
        if (k < 0.14 || k >= 0.5) return;
        const lift = k > 0.2 && k < 0.36 ? -3 : 0;
        this.pattern(['KtttK.', 'KWWWKK', 'KWCWKK', 'KWWWK.', '.KKK..'], a.hx - 2, a.my + 1 + lift, c);
      },
      step(r, k, at, dt, a) {
        const held = k >= 0.14 && k < 0.5;
        const sip = k > 0.2 && k < 0.36;
        // 김은 가늘게. 들고 있을 땐 볼 옆으로 비껴 오르고, 마시는 동안은 쉰다
        if (!sip && every(r, 'st', at, 0.18)) steam(r, r.scr(held ? a.hx + 3 : a.hx + 12), held ? a.my + 1 : 29, undefined, held ? r.facing * 5 : 0);
        // 후우 — 한숨과 함께 작은 하트
        if (once(r, 'sigh', k > 0.37)) {
          r.emit({ type: 'puff', x: r.scr(a.fx + 5), y: a.my - 1, vx: r.facing * 9, vy: -3, life: 1.3, c: 'rgba(255,255,255,0.9)' });
          r.emit({ type: 'heart', x: r.scr(a.fx + 7), y: a.my - 5, vx: r.facing * 5, vy: -7, life: 1.4 });
        }
        if (k > 0.58 && every(r, 'n', at, 1.4)) r.emit({ type: 'note', x: r.scr(a.hx - 10), y: a.top - 2, vy: -4, vx: -2, life: 1.4, c: '#c48b56' });
        if (every(r, 'leaf', at, 1.7)) r.emit({ type: 'confetti', x: r.scr(a.hx + rand(-14, 16)), y: 2, vx: rand(-5, -1), vy: 7, life: 4.5, c: rand(0, 1) < 0.5 ? '#e8923c' : '#d9a21f' });
      },
    },
    monitors: {
      // 모니터 세 대 — 뒤에 모니터 세 대를 띄워 놓고 왼쪽·가운데·오른쪽을 번갈아 보며 타자. 화면마다 글이 올라간다
      len: 3.6, loop: true,
      pose(p, k) {
        desk(p);
        p.lookX = k < 0.33 ? -1 : k < 0.66 ? 0 : 1;
        p.lookY = k >= 0.33 && k < 0.66 ? -1 : 0;
      },
      back(g, a, k, at, c) {
        const scroll = Math.floor(at * 3) % 3;
        for (const [dx, y] of [[-20, 24], [-4, 18], [12, 24]]) {
          const rows = MONITOR.map((r, j) => (j >= 2 && j <= 4 ? MONITOR[2 + ((j - 2 + scroll) % 3)] : r));
          this.pattern(rows, a.hx + dx, y, c);
        }
      },
    },

    papers: {
      // 서류 산더미 — 양옆으로 서류가 점점 쌓여 산더미. 식은땀 흘리며 타자 치는데 맨 위 종이가 팔랑 날아간다
      len: 4.2, loop: true,
      pose(p) { desk(p, true); p.sweat = true; p.eyes = 'dot'; },
      back(g, a, k, at, c) {
        const n = 3 + Math.floor(k * 8);
        for (const [dx, m] of [[-17, 0], [10, 2]]) {
          const h = Math.max(2, n - m);
          for (let i = 0; i < h; i++) this.pattern([i % 2 ? 'KwwwwwK' : 'KWWWWWK'], a.hx + dx + (i % 4 === 1 ? 1 : 0), GROUND - i, c);
        }
      },
      step(r, k, at, dt, a) {
        if (every(r, 'p', at, 1.1)) r.emit({ type: 'sprite', rows: ['WWW', 'www'], map: { W: '#fffaf3', w: '#d6cfc4' }, x: r.scr(a.hx + 12), y: GROUND - 10, vx: rand(4, 12) * r.facing, vy: -10, ay: 8, life: 1.6 });
      },
    },

    aura: {
      // 초사이언 코딩 — 한계를 넘었다. 금빛 오라가 활활, 번개가 튀고, 눈에 불을 켠 채 신의 속도로 타자
      len: 2.6, loop: true,
      pose(p, k, at) { desk(p, true); p.eyes = 'wide'; p.brow = 'angry'; p.ear = 1; p.tail = 'up'; p.dy = -3 + (Math.floor(at * 16) % 2 ? -1 : 0); },
      back(g, a, k, at) {
        for (let x = a.hx - 11; x <= a.hx + 11; x++) {
          const h = Math.max(0, Math.round(26 - Math.abs(x - a.hx) * 1.6 + Math.sin(at * 16 + x * 2.1) * 2.5));
          for (let i = 0; i < h; i++) {
            const f = i / h;
            this.px(x, GROUND - i, f > 0.8 ? '#fffbd0' : f > 0.45 ? '#ffe45c' : '#ffc21a', false);
          }
        }
      },
      step(r, k, at, dt, a) {
        if (every(r, 's', at, 0.1)) r.emit({ type: 'spark', x: r.scr(a.hx + rand(-12, 12)), y: a.top + rand(-8, 10), life: 0.3, c: '#fff6a0' });
        if (every(r, 'b', at, 0.5)) r.emit({ type: 'vline', x: r.scr(a.hx + (Math.random() < 0.5 ? -13 : 13)), y: a.top + rand(0, 8), len: 5, life: 0.15, c: '#fff6a0' });
      },
    },

    tapfoot: {
      // 발 동동 시계 보기 — 머리 위 시계가 째깍째깍. 발을 동동 구르며 곁눈질, 꼬리는 탁탁
      // (7차: 몸 전체가 통통 튀던 걸, 몸은 가만히 있고 발만 톡톡 구르게)
      len: 3, loop: true,
      pose(p, k, at) {
        const b = at % 0.75;
        p.step = b < 0.1 || (b > 0.2 && b < 0.3) ? 0.25 : 0; // 톡-톡, 쉬고 (바깥 두 발을 들었다 내린다)
        p.mouth = 'flat'; p.tail = 'flick';
        if (k < 0.45) { p.eyes = 'side'; p.sideDir = 1; p.lookY = -1; } // 시계를 곁눈질
        else if (k < 0.58) { p.eyes = 'half'; p.mouth = 'wavy'; p.ear = -1; } // 하아…
        else p.brow = 'sad'; // 빨리 좀… (눈은 평소처럼 깜빡)
      },
      front(g, a, k, at, c) {
        const cx = a.hx + 9;
        const cy = a.top - 6;
        this.ellipse(cx, cy, 3.6, 3.6, '#fffaf3', c.K);
        // 초침이 째깍째깍 한 칸씩 뛴다 (0.5초마다 30도). 시침은 3시 방향
        const ang = Math.floor(at * 2) * (Math.PI / 6);
        this.px(cx, cy, c.K);
        this.px(cx + 1, cy, c.K);
        for (const d of [1, 2]) this.px(Math.round(cx + Math.sin(ang) * d), Math.round(cy - Math.cos(ang) * d), '#e8534a');
        this.px(cx, cy - 1, c.K);
        // 시계가 째깍할 때마다 살짝 들썩
        if (Math.floor(at * 2) % 2 === 0 && (at * 2) % 1 < 0.15) { this.px(cx - 4, cy - 3, c.K); this.px(cx + 4, cy - 3, c.K); }
      },
      step(r, k, at, dt, a) {
        // 발이 바닥에 닿을 때마다 먼지 톡
        const b = at % 0.75;
        const n = Math.floor(at / 0.75) * 2 + (b > 0.2 ? 1 : 0);
        if ((b >= 0.1 && b < 0.2) || b >= 0.3) if (once(r, 'd' + n, true)) for (const s of [-1, 1]) r.emit({ type: 'dust', x: r.scr(a.hx + s * 5), y: GROUND, vx: s * 4, life: 0.3 });
      },
    },

    blanket: {
      // 이불 덮고 쿨쿨 — 나무 침대에 베개 베고 알록달록 이불을 턱밑까지 덮고 새근새근. 숨 쉴 때마다 이불이 오르락내리락
      // (7차: 베개가 머리 양옆 날개처럼 보여서, 침대 머리판을 세우고 이불을 침대 폭만큼 넓혔다)
      len: 4, loop: true,
      pose(p, k, at) {
        p.eyes = 'closed'; p.mouth = 'flat'; p.ear = -1; p.dy = 1; p.noTail = true; p.clipY = 46; p.noShadow = true;
        if (k > 0.55 && k < 0.62) p.ear = 0; // 꿈결에 귀 한 번 씰룩
      },
      back(g, a, k, at, c) {
        // 침대 머리판: 둥근 윗변에 나뭇결, 양 끝에 기둥과 동그란 손잡이. 치즈색 털과 섞이지 않게 짙은 호두나무색
        const x0 = a.hx - 12, top = a.earTop - 3, W = 25;
        const WD = '#6b4428', wd = '#553520', wk = '#2b1a10';
        for (let y = top; y <= GROUND; y++) for (let x = x0; x < x0 + W; x++) {
          const i = x - x0, j = y - top;
          if (j === 0 && (i < 2 || i > W - 3)) continue;
          if (j === 1 && (i === 0 || i === W - 1)) continue;
          const edge = j === 0 || i === 0 || i === W - 1 || (j === 1 && (i === 1 || i === W - 2));
          this.px(x, y, edge ? wk : i % 5 === 2 ? wd : WD);
        }
        for (const x of [x0 - 1, x0 + W]) {
          for (let y = top - 1; y <= GROUND + 1; y++) this.px(x, y, y === top - 1 ? wk : wd);
          this.pattern(['KK', 'tt', 'KK'], x - (x < a.hx ? 1 : 0), top - 3, { K: wk, t: '#c48b56' });
        }
        // 베개 (머리판 폭에 가깝게 넓적하게)
        this.pattern(['.KKKKKKKKKKKKKKKKKKKKK.', 'KWWWWWWWWWWWWWWWWWWWWWK', 'KWWWWWWWWWWWWWWWWWWWWwK', 'KwwwwwwwwwwwwwwwwwwwwwK', '.KKKKKKKKKKKKKKKKKKKKK.'], a.hx - 11, a.ey - 2, c);
      },
      front(g, a, k, at, c) {
        // 숨 쉴 때마다 이불 윗단이 한 칸 오르락내리락 (들숨이 짧고 날숨이 길다)
        const b = Math.sin(at * 1.6) > 0.3 ? -1 : 0;
        const y0 = a.my + 2 + b;
        const W = 25;
        for (let y = y0; y <= GROUND + 2; y++) {
          const j = y - y0;
          let row = '';
          for (let i = 0; i < W; i++) {
            if (i === 0 || i === W - 1 || j === 0) row += 'K';
            else if (j === 1) row += i === W - 2 ? 'w' : 'W'; // 접어 내린 흰 홑청
            else row += (Math.floor(i / 2) + j) % 2 ? 'P' : 'Q'; // 체크무늬 이불
          }
          this.pattern([row], a.hx - 12, y, c);
        }
      },
      step(r, k, at, dt, a) {
        if (every(r, 'z', at, 1.3)) txt(r, 'Z', r.scr(a.hx + 8), a.top - 4, '#9aa6ff', 1.3);
      },
    },

    grumpy: {
      // 짜증 팍 — 귀를 뒤로 착 눕히고 털을 부풀린다. 이마에 빠직 마크, "HISS" 하고 앞발로 휙
      len: 2.4,
      pose(p, k, at) {
        p.ear = -1; p.brow = 'angry'; p.eyes = 'squint'; p.mouth = 'frown'; p.tail = 'flick';
        p.xf = { sx: 1.1, sy: 1.05, ox: k < 0.15 ? Math.sin(at * 50) : 0 };
        if (k > 0.5 && k < 0.65) { p.armR = 'out'; p.mouth = 'big'; }
      },
      step(r, k, at, dt, a) {
        const pulse = Math.floor(at * 5) % 2;
        r.emit({ type: 'sprite', rows: pulse ? ['.R.R.', 'RR.RR', '.....', 'RR.RR', '.R.R.'] : ['R...R', '.R.R.', '.....', '.R.R.', 'R...R'], map: { R: '#e8534a' }, x: r.scr(a.hx + 5) - 2, y: a.top - 4, perFrame: true, fade: false });
        if (once(r, 'h', k > 0.5)) { txt(r, 'HISS', r.scr(a.hx + 6), a.top - 9, '#ff9a9a', 0.8); r.emit({ type: 'line', x: r.scr(a.hx + 11), y: a.ey + 1, len: 5, life: 0.2 }); }
      },
    },


    startle: {
      // 화들짝 — 건드리자마자 털이 쭈뼛 서며 공중으로 펄쩍! 착지하고도 눈이 콩알만 해서 두리번
      len: 2.2,
      pose(p, k) {
        if (k < 0.1) { p.eyes = 'open'; return; }
        if (k < 0.45) {
          const s = seg(k, 0.1, 0.45);
          p.dy = Math.round(-11 * Math.sin(s * Math.PI));
          p.eyes = 'wide'; p.mouth = 'o'; p.ear = 1; p.armL = p.armR = 'up'; p.tail = 'up';
          p.xf = { sy: 1.15, sx: 0.92 };
          p.spiky = true;
        } else if (k < 0.55) { p.xf = { sx: 1.15, sy: 0.85 }; p.eyes = 'dot'; }
        else { p.eyes = 'dot'; p.lookX = k < 0.75 ? -1 : 1; p.sweat = true; p.mouth = 'flat'; }
      },
      front(g, a) {
        if (!this._p || !this._p.spiky) return;
        const O = g.c.outline;
        for (let y = a.top + 2; y < a.cy + 5; y += 3) { this.px(a.left - 2, y, O); this.px(a.left - 3, y - 1, O); this.px(a.right + 2, y, O); this.px(a.right + 3, y - 1, O); }
      },
      step(r, k, at, dt, a) {
        if (once(r, '!', k > 0.1)) { txt(r, '!!', r.scr(a.hx + 6), a.top - 12, '#ffd35c', 1); r.emit({ type: 'shock', x: r.scr(a.hx), y: a.cy, r: 8, life: 0.25 }); }
      },
    },

    melt: {
      // 녹아내리기 — 너무 좋아서 녹는다… 몸이 치즈처럼 바닥으로 주르륵 퍼졌다가, 뿅 하고 다시 모인다
      len: 3.4, reveal: 0.7,
      pose(p, k) {
        p.blush = true; p.eyes = 'happy'; p.mouth = 'wavy'; p.tail = 'slow';
        let s;
        if (k < 0.15) s = 0;
        else if (k < 0.55) s = ease(seg(k, 0.15, 0.55));
        else if (k < 0.8) s = 1;
        else { const q = seg(k, 0.8, 1); s = 1 - q; if (q > 0.6) { p.eyes = 'open'; p.mouth = 'smile'; } }
        p.xf = { sy: 1 - 0.55 * s, sx: 1 + 0.55 * s };
        if (s > 0.8) p.ear = -1;
      },
      step(r, k, at, dt, a) {
        if (k > 0.3 && k < 0.8 && every(r, 'd', at, 0.18)) r.emit({ type: 'drop', x: r.scr(24 + (Math.random() < 0.5 ? -12 : 12)), y: GROUND - 1, vy: 2, life: 0.6, c: '#f4a859' });
        if (every(r, 'h', at, 0.6)) r.emit({ type: 'heart', x: r.scr(24 + rand(-8, 8)), y: 30, vy: -5, life: 1 });
        if (once(r, 'b', k > 0.95)) txt(r, 'POP', r.scr(30), 20, '#fff', 0.5);
      },
    },

    popper: {
      // 폭죽 팡 — 파티 폭죽을 하늘로 겨누고… 팡! 색종이가 우르르 쏟아지고 만세 점프
      len: 2.6,
      pose(p, k) {
        if (k < 0.3) { p.armR = 'hold'; p.eyes = 'squint'; p.mouth = 'flat'; p.ear = -1; }
        else { const s = seg(k, 0.3, 0.7); p.dy = Math.round(-6 * Math.sin(s * Math.PI)); p.armL = p.armR = 'cheer'; p.eyes = 'happy'; p.mouth = 'open'; p.ear = 1; p.tail = 'up'; }
      },
      mid(g, a, k, at, c) { if (k < 0.45) this.pattern(POPPER, a.hx + 4, a.my - 3, c); },
      step(r, k, at, dt, a) {
        if (once(r, 'p', k > 0.3)) {
          txt(r, 'PANG!', r.scr(a.hx + 2), a.top - 12, '#ffd35c', 0.9);
          for (let i = 0; i < 40; i++) r.emit({ type: 'confetti', x: r.scr(a.hx + 7), y: a.top - 2, vx: rand(-30, 30), vy: rand(-40, -12), ay: 45, life: rand(1.2, 2), c: CONFETTI[i % 6] });
        }
      },
    },

    coronation: {
      // 대관식 — 하늘에서 왕관이 반짝이며 스르르 내려와 머리 위에 착. 나팔 소리에 맞춰 가슴을 쭉 편다
      len: 3.4, reveal: 0.52,
      pose(p, k) {
        if (k < 0.5) { p.lookY = -1; p.eyes = 'sparkle'; p.mouth = 'o'; p.ear = 1; }
        else { p.eyes = 'closed'; p.mouth = 'smile'; p.xf = { sy: 1.06 }; p.tail = 'up'; p.blush = true; }
      },
      front(g, a, k, at, c) {
        const y = k < 0.5 ? Math.round(-8 + (a.top - 4 + 8) * ease(seg(k, 0, 0.5))) : a.top - 4;
        this.pattern(CROWN, a.hx - 3, y, c);
      },
      step(r, k, at, dt, a) {
        if (k < 0.5 && every(r, 's', at, 0.08)) r.emit({ type: 'spark', x: r.scr(a.hx + rand(-4, 4)), y: Math.round(-8 + (a.top + 4) * seg(k, 0, 0.5)), vy: -4, life: 0.4 });
        if (once(r, 'f', k > 0.5)) for (let i = 0; i < 10; i++) r.emit({ type: 'star', x: r.scr(a.hx), y: a.top - 2, vx: rand(-18, 18), vy: rand(-18, -4), life: 0.8 });
        if (k > 0.5 && every(r, 'n', at, 0.3)) r.emit({ type: 'note', x: r.scr(a.hx + (Math.random() < 0.5 ? -14 : 12)), y: a.top + 2, vy: -8, life: 0.9, c: '#d9a21f' });
      },
    },

    levelbanner: {
      // LEVEL UP! 게임 화면 — 옛날 게임처럼 머리 위에 반짝이는 "LEVEL UP!" 글자, 동전이 분수처럼 솟고 고양이는 두 번 점프
      len: 3,
      pose(p, k) {
        const j = (k * 2) % 1;
        p.dy = Math.round(-6 * Math.sin(j * Math.PI));
        p.armL = p.armR = 'cheer'; p.eyes = 'star'; p.mouth = 'open'; p.ear = 1; p.tail = 'up';
      },
      step(r, k, at, dt, a) {
        const col = ['#ffd35c', '#ff6f91', '#6fb0ea', '#78c46a'][Math.floor(at * 8) % 4];
        r.emit({ type: 'text', s: 'LEVEL UP!', x: 7, y: 6 + (Math.floor(at * 4) % 2), perFrame: true, fade: false, c: col });
        if (every(r, 'c', at, 0.15)) r.emit({ type: 'coin', x: r.scr(a.hx + rand(-3, 3)), y: GROUND - 2, vx: rand(-14, 14), vy: rand(-36, -24), ay: 60, life: 1.2 });
      },
    },

    hammock: {
      // 해먹 흔들흔들 — 기둥 두 개 사이 해먹에 쏙 들어가 흔들흔들. 눈을 감고 낙엽이 팔랑
      len: 4, loop: true,
      pose(p, k, at) { p.curl = true; p.dy = -4; p.eyes = 'happy'; p.xf = { ox: Math.round(Math.sin(at * 1.6) * 2) }; p.noShadow = true; },
      front(g, a, k, at, c) {
        const ox = Math.round(Math.sin(at * 1.6) * 2);
        for (let x = a.hx - 10; x <= a.hx + 10; x++) {
          const sag = Math.round(3 - (x - a.hx) * (x - a.hx) / 40);
          this.px(x, 38 + sag, c.K);
          this.px(x, 39 + sag, (x & 1) ? '#e8534a' : '#fffaf3');
          this.px(x, 40 + sag, c.K);
        }
        // 기둥 꼭대기에서 해먹 끝까지 줄 (몸이 흔들려도 기둥은 제자리)
        for (const s of [-1, 1]) {
          const px = a.hx + s * 15 - ox;
          for (let i = 0; i <= 5; i++) this.px(Math.round(px + (a.hx + s * 10 - px) * (i / 5)), 31 + Math.round((38 - 31) * (i / 5)), '#8a5a32');
        }
      },
      step(r, k, at, dt, a) {
        for (const s of [-1, 1]) r.emit({ type: 'vline', x: r.scr(a.hx + s * 15), y: 30, len: GROUND - 29, perFrame: true, fade: false, c: '#8a5a32' });
        if (every(r, 'l', at, 1.6)) r.emit({ type: 'confetti', x: r.scr(a.hx + rand(-14, 16)), y: 2, vx: rand(-5, -1), vy: 7, life: 4, c: '#e8923c' });
        if (every(r, 'z', at, 1.5)) txt(r, 'Z', r.scr(a.hx + 6), a.top - 4, '#9aa6ff', 1.2);
      },
    },

    fooddream: {
      // 맛있는 상상 — 허공을 보며 멍… 생각 풍선 속에 스테이크 → 생선구이 → 케이크가 차례로 떠오른다. 침이 주르륵
      len: 4.8, loop: true,
      pose(p) { p.eyes = 'sparkle'; p.lookX = 1; p.lookY = -1; p.mouth = 'open'; p.blush = true; p.tail = 'wag'; },
      front(g, a, k, at, c) {
        const cx = a.hx + 13;
        const cy = 11;
        this.ellipse(cx, cy, 9, 6.5, '#fffaf3', c.K);
        this.ellipse(a.hx + 6, a.top - 3, 1.4, 1.2, '#fffaf3', c.K);
        this.ellipse(a.hx + 8, a.top - 7, 2, 1.6, '#fffaf3', c.K);
        const food = [STEAK, FISHDREAM, CAKE][Math.min(2, Math.floor(k * 3))];
        this.pattern(food, cx - (food[0].length >> 1), cy - (food.length >> 1), c);
      },
      step(r, k, at, dt, a) {
        if (every(r, 'd', at, 0.9)) r.emit({ type: 'drop', x: r.scr(a.fx + 1), y: a.my + 1, vy: 6, ay: 20, life: 0.8, c: '#bfe6ff' });
        if (every(r, 's', at, 0.5)) r.emit({ type: 'spark', x: r.scr(a.hx + 13 + rand(-8, 8)), y: 11 + rand(-5, 5), life: 0.4 });
      },
    },

    // ================= 5차 (2026-09-22 확정) =================
    sipcode: {
      // 한 손 코딩 한 모금 — 타닥타닥 치다가 머그를 들어 홀짝, 다시 타닥. 여유 있는 프로의 코딩
      len: 4, loop: true,
      pose(p, k) { desk(p); if (k > 0.6 && k < 0.85) { p.armL = 'hold'; p.eyes = 'closed'; p.mouth = 'none'; } },
      mid(g, a, k, at, c) { if (k > 0.6 && k < 0.85) this.pattern(MUG, a.hx - 5, a.my, c); else this.pattern(MUG, a.hx + 11, GROUND - 5, c); },
      // 김은 책상 위 머그에서만 가늘게 (들어 마시는 동안은 얼굴을 가리지 않게 쉰다)
      step(r, k, at, dt, a) { if (!(k > 0.6 && k < 0.85) && every(r, 's', at, 0.2)) steam(r, r.scr(a.hx + 13), GROUND - 6); } },
    headbang: {
      // 헤드폰 리듬 코딩 — 헤드폰 쓰고 박자에 맞춰 고개를 까딱까딱. 음표가 둥실
      len: 2, loop: true,
      pose(p, k, at) { desk(p, true); p.xf = { rot: Math.sin(at * 8) * 0.08, py: GROUND }; p.eyes = 'closed'; p.mouth = 'smile'; },
      front(g, a, k, at, c) { this.pattern(['...KKKKKKKKK...', '.KKDDDDDDDDDKK.', 'KKK.........KKK', 'KDK.........KDK', 'KDK.........KDK', 'KKK.........KKK'], a.hx - 7, a.earTop - 3, c); },
      step(r, k, at, dt, a) { if (every(r, 'n', at, 0.5)) r.emit({ type: 'note', x: r.scr(a.hx + rand(-10, 10)), y: a.top - 4, vy: -8, life: 1 }); } },
    eureka: {
      // 유레카! — 턱 괴고 흠… 고민하다 머리 위 전구가 번쩍! 신나서 타다다닥
      len: 4, loop: true,
      pose(p, k) { if (k < 0.45) { p.armR = 'hold'; p.eyes = 'half'; p.mouth = 'flat'; p.lookY = -1; p.prop = 'laptop'; p.dy = -3; } else if (k < 0.55) { p.eyes = 'star'; p.mouth = 'open'; p.ear = 1; p.prop = 'laptop'; p.dy = -4; } else { desk(p, true); p.eyes = 'happy'; } },
      front(g, a, k, at, c) {
        if (k <= 0.45 || k >= 0.72) return;
        // 전구가 딸깍 켜지며 번쩍 — 처음 잠깐은 빛살이 사방으로 퍼진다
        const x = a.hx + 6, y = a.top - 10;
        const on = k < 0.5 || Math.floor(at * 6) % 3;
        this.pattern(['.KKKKK.', 'KYYYYYK', 'KYYWWYK', 'KYYYWYK', '.KYYYK.', '..KgK..', '..KgK..', '..KKK..'], x - 1, y, on ? c : { ...c, Y: '#e8d9a0', W: '#e8d9a0' });
        if (k < 0.56) {
          const L = k < 0.5 ? 2 : 3;
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let i = 1; i <= L; i++) this.px(x + 2 + dx * (3 + i), y + 2 + dy * (2 + i), '#fff6a0', false);
        }
      },
      step(r, k, at, dt, a) { if (k < 0.45 && every(r, 'd', at, 0.6)) txt(r, '...', r.scr(a.hx + 5), a.top - 4, '#ffffff', 0.6, -2); } },
    smokingkeys: {
      // 키보드 과열 — 너무 빨리 쳐서 키보드에서 연기가 모락모락. 그래도 멈추지 않는다
      len: 3, loop: true,
      pose(p) { desk(p, true); p.brow = 'angry'; },
      // 연기는 키보드 양 끝에서 피어올라 바깥으로 흩어진다 (얼굴은 가리지 않는다). 가끔 불티가 톡
      step(r, k, at, dt, a) {
        if (every(r, 's', at, 0.15)) { const s = Math.floor(at / 0.15) % 2 ? 1 : -1; r.emit({ type: 'puff', x: r.scr(a.hx + s * rand(8, 11)), y: GROUND - 3, vy: -9, vx: r.facing * s * rand(5, 9), life: 0.9, c: 'rgba(160,160,160,0.8)' }); }
        if (every(r, 'e', at, 0.35)) r.emit({ type: 'ember', x: r.scr(a.hx + rand(-6, 6)), y: GROUND - 2, vx: rand(-8, 8), vy: -12, ay: 30, life: 0.4 });
      } },
    soulcode: {
      // 영혼 가출 코딩 — 몸은 계속 타자 치는데 영혼은 빠져나와 위에서 둥실. 그래도 손은 멈추지 않는다
      len: 4, loop: true,
      pose(p) { desk(p); p.eyes = 'dot'; p.mouth = 'blep'; },
      step(r, k, at, dt, a) { r.emit({ type: 'soul', x: r.scr(a.hx + Math.round(Math.sin(at * 2) * 3)), y: a.top - 8 - Math.round(bump(k, 0, 1) * 4), perFrame: true, fade: false }); } },
    ivcoffee: {
      // 커피 링거 — 옆에 커피 링거를 꽂고 똑똑 수혈받으며 코딩
      len: 3, loop: true,
      pose(p) { desk(p); p.eyes = 'half'; },
      back(g, a, k, at, c) { this.pattern(['KKKKK', 'KtttK', 'KtttK', 'KtttK', '.KKK.', '..K..'], a.hx + 11, 22, c); for (let y = 28; y < GROUND; y++) this.px(a.hx + 13, y, '#8f95a0'); for (let i = 0; i < 6; i++) this.px(a.hx + 13 - i, a.cy - 2 + Math.round(i * 0.2), '#cfd6de'); },
      step(r, k, at, dt, a) { if (every(r, 'd', at, 0.4)) r.emit({ type: 'drop', x: r.scr(a.hx + 13), y: 28, vy: 8, life: 0.4, c: '#6b4226' }); } },
    overheat: {
      // 머리에서 김 폴폴 — 뇌 과부하. 얼굴이 빨개지고 머리에서 김이 폭폭 솟는다
      len: 3, loop: true,
      pose(p) { desk(p, true); p.blush = true; p.eyes = 'squint'; p.brow = 'angry'; },
      // 얼굴(머리)만 벌겋게 달아오른다 — 노트북·김까지 물들던 전체 tint 대신 머리 영역에만 (7차)
      front(g, a, k, at) { tintArea.call(this, a.left - 1, a.earTop - 1, a.hw * 2 + 3, GROUND - 6 - a.earTop, `rgba(255,70,60,${(0.2 + 0.08 * Math.sin(at * 6)).toFixed(2)})`); },
      step(r, k, at, dt, a) { if (every(r, 's', at, 0.12)) r.emit({ type: 'puff', x: r.scr(a.hx + rand(-4, 4)), y: a.top - 2, vy: -14, vx: rand(-4, 4), life: 0.7, c: 'rgba(255,255,255,0.9)' }); } },
    raisehand: {
      // 저요 저요! — 앞발을 번쩍 들고 흔들며 폴짝폴짝. 선생님 저 좀 봐 주세요
      len: 1.6, loop: true,
      pose(p, k, at) { p.armR = 'cheer'; p.dy = Math.round(-3 * Math.abs(Math.sin(at * 6))); p.eyes = 'sparkle'; p.mouth = 'open'; p.ear = 1; },
      step(r, k, at, dt, a) { if (every(r, 'e', at, 0.8)) txt(r, '!', r.scr(a.hx + 9), a.top - 8, '#ffd35c', 0.6); } },
    pray: {
      // 제발요 기도 — 앞발을 모으고 초롱초롱한 눈으로 "PLZ". 반짝반짝 빛까지
      len: 2.4, loop: true,
      pose(p) { p.armL = p.armR = 'cross'; p.eyes = 'sparkle'; p.mouth = 'o'; p.ear = 1; p.blush = true; },
      step(r, k, at, dt, a) { if (every(r, 's', at, 0.35)) r.emit({ type: 'spark', x: r.scr(a.hx + rand(-12, 12)), y: a.top + rand(-4, 8), life: 0.5 }); if (every(r, 'p', at, 1.2)) txt(r, 'PLZ', r.scr(a.hx + 6), a.top - 7, '#ffd3df', 0.9); } },
    fishdream: {
      // 생선 꿈 — 자면서 생선 먹는 꿈을 꾼다. 꿈 풍선 속 생선, 입가엔 침
      len: 4, loop: true,
      pose(p, k, at) { p.curl = true; p.eyes = 'closed'; p.mouth = Math.floor(at * 3) % 2 ? 'chew' : 'smile'; p.blush = true; },
      front(g, a, k, at, c) { this.ellipse(a.hx + 11, a.top - 7, 6, 4, '#fffaf3', c.K); this.pattern(['.KKKK.K', 'KOHOOKO', '.KKKK.K'], a.hx + 8, a.top - 8, c); this.ellipse(a.hx + 5, a.top - 2, 1, 1, '#fffaf3', c.K); },
      step(r, k, at, dt, a) { if (every(r, 'd', at, 1.2)) r.emit({ type: 'drop', x: r.scr(a.hx - 1), y: a.my, vy: 5, life: 0.6, c: '#bfe6ff' }); } },
    slowblink: {
      // 고양이 키스 (천천히 깜빡) — 눈을 아주 천천히 감았다 뜬다. 고양이 말로 "사랑해"
      len: 3,
      pose(p, k) { p.eyes = k > 0.3 && k < 0.7 ? 'closed' : k > 0.2 && k < 0.8 ? 'half' : 'open'; p.blush = k > 0.3; p.mouth = 'smile'; },
      step(r, k, at, dt, a) { if (once(r, 's', k > 0.75)) r.emit({ type: 'spark', x: r.scr(a.eyeR + 2), y: a.ey - 1, life: 0.6 }); } },
    shinyfur: {
      // 털 윤기 반짝 — 쓰다듬을수록 털에서 광이 난다. 샴푸 광고 고양이. 빛줄기가 털 위를 비스듬히 쓸고 지나간다
      len: 2.4, reveal: 0.5,
      pose(p, k) { p.eyes = 'closed'; p.mouth = 'smile'; p.tail = 'up'; p.xf = { sy: 1.04 }; p.blush = k > 0.3; p.ear = 1; },
      front(g, a, k) {
        // 광택 띠: 왼쪽 위 → 오른쪽 아래로 두 번 스윽 (고양이 털 위에만)
        for (const [t0, t1] of [[0.1, 0.45], [0.5, 0.85]]) {
          const s = seg(k, t0, t1);
          if (s <= 0 || s >= 1) continue;
          const x0 = a.left - 8 + Math.round(s * (a.hw * 2 + 16));
          for (let y = a.earTop; y <= GROUND; y++) {
            const x = x0 + Math.round((y - a.earTop) * 0.5);
            tintArea.call(this, x, y, 2, 1, 'rgba(255,255,255,0.75)');
            tintArea.call(this, x + 2, y, 1, 1, 'rgba(255,255,255,0.35)');
          }
        }
      },
      step(r, k, at, dt, a) { tintUnder(r, '#ffffff', 0.22 * bump(k, 0, 1)); if (every(r, 's', at, 0.2)) r.emit({ type: 'spark', x: r.scr(a.hx + rand(-7, 7)), y: a.cy + rand(-6, 4), life: 0.4 }); } },
    donebanner: {
      // "DONE" 현수막 — 두 앞발로 장대 두 개를 번쩍 들면 그 사이로 "DONE!" 현수막이 촤악 펼쳐진다. 폴짝 뛰고 좌우로 흔들흔들
      // (7차: 글자만 귀 위에 겹쳐 있던 걸 진짜 현수막으로)
      len: 2.8,
      pose(p, k) {
        p.armL = p.armR = 'cheer';
        p.eyes = k < 0.12 ? 'open' : 'happy';
        p.mouth = 'open'; p.ear = 1; p.tail = 'up';
        p.dy = -Math.round(bump(k, 0.14, 0.34) * 3);
        if (k > 0.36 && k < 0.92) p.xf = { ox: Math.round(Math.sin((k - 0.36) * Math.PI * 4)) };
      },
      front(g, a, k, at, c) {
        // 현수막이 가운데서부터 양옆으로 촤악
        const half = Math.max(1, Math.round(11 * ease(seg(k, 0.08, 0.3))));
        const top = a.top - 17, h = 8;
        for (const sd of [-1, 1]) {
          // 앞발에서 현수막 모서리까지 장대
          const x0 = a.hx + sd * 6, y0 = a.top - 3, x1 = a.hx + sd * half, y1 = top + h - 1;
          const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
          for (let i = 0; i <= n; i++) this.px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), '#8a5a32');
          this.pattern(['KK', 'KK'], a.hx + sd * half - (sd < 0 ? 1 : 0), top - 2, c);
        }
        for (let y = top; y < top + h; y++) for (let x = a.hx - half; x <= a.hx + half; x++) {
          const edge = y === top || y === top + h - 1 || x === a.hx - half || x === a.hx + half;
          this.px(x, y, edge ? c.K : y === top + 1 ? '#ffe8a0' : '#fffaf3');
        }
      },
      step(r, k, at, dt, a, p) {
        const ox = p && p.xf ? p.xf.ox || 0 : 0;
        if (k > 0.28) r.emit({ type: 'text', s: 'DONE!', x: r.scr(a.hx) - 8 + ox, y: a.top - 15, perFrame: true, fade: false, c: '#e8534a' });
        if (once(r, 'c', k > 0.3)) for (let i = 0; i < 16; i++) r.emit({ type: 'confetti', x: r.scr(a.hx) + rand(-12, 12), y: a.top - 18, vx: rand(-10, 10), vy: rand(-14, -4), ay: 30, life: rand(1, 1.6), c: CONF[i % 6] });
      },
    },
    bigbutton: {
      // 제출 버튼 꾹 — 커다란 빨간 버튼을 노려보다가 앞발을 높이 치켜들고… 꾹! 버튼이 쑥 들어가고 색종이가 우르르
      // (7차: 앞발이 머리 옆에서 허공을 찌르던 걸, 실제로 버튼 위로 내리찍게)
      len: 2.6,
      pose(p, k, at) {
        p.lookX = 1; p.lookY = 1; p.ear = 1; p.tail = 'up';
        if (k < 0.32) { p.eyes = k < 0.2 ? 'wide' : 'sparkle'; p.mouth = 'o'; }
        else if (k < 0.52) { p.eyes = 'squint'; p.mouth = 'big'; p.xf = { ox: 1 }; p.brow = 'angry'; }
        else { p.eyes = 'happy'; p.mouth = 'open'; p.lookY = 0; if (k > 0.64) { p.armL = p.armR = 'cheer'; p.dy = -Math.round(bump(k, 0.64, 0.84) * 3); } }
      },
      front(g, a, k, at, c) {
        const pressed = k > 0.34 && k < 0.54 ? 1 : 0;
        this.pattern(['..KKKKK..', '.KRRHRRK.', 'KKKKKKKKK', 'KgggggggK', 'KKKKKKKKK'].slice(pressed), a.hx + 7, GROUND - 4 + pressed, c);
        if (k >= 0.64) return;
        // 앞발: 어깨 → 버튼 위 높이 (치켜들기) → 꾹 → 천천히 돌아온다
        const bx = a.hx + 11, press = GROUND - 7 + pressed, high = GROUND - 15;
        let x, y;
        if (k < 0.2) { const e = ease(seg(k, 0.04, 0.2)); x = a.right - 1 + (bx - (a.right - 1)) * e; y = a.cy + (high - a.cy) * e; }
        else if (k < 0.3) { x = bx; y = high + Math.round(Math.sin(at * 30) * 0.6); }
        else if (k < 0.34) { const e = seg(k, 0.3, 0.34); x = bx; y = high + (press - high) * e * e; }
        else if (k < 0.52) { x = bx; y = press; }
        else { const e = ease(seg(k, 0.52, 0.64)); x = bx + (a.right - 1 - bx) * e; y = press + (a.cy - press) * e; }
        limb.call(this, g, a.right - 2, a.cy - 1, x, y);
      },
      step(r, k, at, dt, a) {
        if (once(r, 'c', k > 0.36)) {
          txt(r, 'CLICK', r.scr(a.hx + 4) - 6, a.top - 8, '#fff', 0.7);
          for (let i = 0; i < 26; i++) r.emit({ type: 'confetti', x: r.scr(a.hx + 11), y: GROUND - 6, vx: rand(-26, 26), vy: rand(-36, -12), ay: 45, life: 1.4, c: CONF[i % 6] });
        }
      },
    },
    glowup: {
      // 변신 빛기둥 — 하늘에서 빛기둥이 내려오고 그 안에서 빙글빙글 돌며 반짝 변신
      len: 2.8, reveal: 0.5,
      pose(p, k, at, r) { if (k > 0.2 && k < 0.7) { r.setFacing(Math.floor(at * 10) % 2 ? 1 : -1); p.xf = { oy: -Math.round(bump(k, 0.2, 0.7) * 6) }; p.eyes = 'closed'; } else { p.eyes = 'star'; p.mouth = 'open'; p.armL = p.armR = 'up'; } },
      back(g, a, k) { if (k < 0.75) for (let y = 0; y <= GROUND; y++) for (let x = a.cx - 7; x <= a.cx + 7; x++) this.px(x, y, Math.abs(x - a.cx) < 3 ? 'rgba(255,250,210,0.5)' : 'rgba(255,240,170,0.25)', false); },
      // 번쩍은 캔버스 전체(바탕화면 위 흰 네모)가 아니라 고양이만 (7차)
      step(r, k, at, dt, a) { if (k < 0.75 && every(r, 's', at, 0.12)) r.emit({ type: 'spark', x: r.scr(a.cx + rand(-6, 6)), y: rand(4, 40), life: 0.4 }); if (k > 0.68) flashCat(r, seg(k, 0.68, 0.8)); if (once(r, 'f', k > 0.7)) for (let i = 0; i < 10; i++) { const an = (i / 10) * Math.PI * 2; r.emit({ type: 'star', x: r.scr(a.cx), y: a.cy - 2, vx: Math.cos(an) * 20, vy: Math.sin(an) * 14, life: 0.6 }); } } },
    fireworksbg: {
      // 불꽃놀이 — 양옆에서 폭죽이 꼬리를 끌며 솟아올라 팡! 터질 때마다 불빛이 고양이를 물들이고, 고양이는 넋 놓고 "와아"
      // (7차: 고리만 뿅 생기던 걸, 솟아오르는 꼬리 → 터짐 → 반짝이며 떨어지는 불꽃으로)
      len: 3.2,
      pose(p, k, at, r) {
        p.lookY = -1; p.eyes = 'sparkle'; p.mouth = 'o'; p.ear = 1;
        const since = at - (r.ms.boom || -9);
        if (since < 0.35) { p.mouth = 'open'; p.blush = true; p.dy = since < 0.12 ? -1 : 0; }
        p.lookX = r.ms.lookX || 0;
      },
      step(r, k, at, dt, a) {
        const shells = r.ms.shells || (r.ms.shells = []);
        if (k < 0.8 && every(r, 'f', at, 0.62)) {
          const side = shells.length % 2 ? 1 : -1;
          shells.push({ x: 24 + side * rand(12, 19), yb: rand(5, 14), t0: at, col: CONF[Math.floor(rand(0, 6))], done: false });
        }
        for (const s of shells) {
          const u = (at - s.t0) / 0.45;
          if (u < 1) {
            // 솟아오르는 꼬리
            const y = GROUND - 2 - (GROUND - 2 - s.yb) * (1 - (1 - u) * (1 - u));
            r.emit({ type: 'spray', x: s.x, y, c: '#fff6d0', perFrame: true, fade: false });
            if (every(r, 'tr' + s.t0, at, 0.04)) r.emit({ type: 'ember', x: s.x + rand(-0.5, 0.5), y: y + 1, vy: 4, life: 0.25 });
          } else if (!s.done) {
            s.done = true;
            r.ms.boom = at;
            r.ms.boomCol = s.col;
            r.ms.lookX = s.x < 24 ? -1 : 1;
            for (let i = 0; i < 14; i++) { const an = (i / 14) * Math.PI * 2; r.emit({ type: 'confetti', x: s.x, y: s.yb, vx: Math.cos(an) * 17, vy: Math.sin(an) * 17, ay: 12, life: 1, c: s.col }); }
            r.emit({ type: 'spark', x: s.x, y: s.yb, life: 0.3, c: '#ffffff' });
          }
        }
        // 터진 불빛에 고양이가 잠깐 환해진다
        const since = at - (r.ms.boom || -9);
        if (since < 0.4) tintUnder(r, '#fff6d0', 0.22 * (1 - since / 0.4)); // 색을 입히면 털이 탁해져서 밝게만
      },
    },
    teatime: {
      // 차와 과자 — 따뜻한 차 한 잔에 쿠키 하나. 쿠키를 집어 차에 퐁당퐁당 두 번 찍은 뒤 냠냠, 부스러기가 톡톡
      // (7차: 쿠키가 입으로 순간이동하던 걸, 앞발로 집어 찍고 → 입으로 가져가게)
      len: 4.4, loop: true,
      pose(p, k, at, r) {
        p.tail = 'slow';
        if (k < 0.42) { p.lookX = 1; p.lookY = 1; p.eyes = k < 0.12 ? (r.blinkAt(at) ? 'blink' : 'open') : 'sparkle'; p.mouth = k > 0.3 ? 'o' : 'smile'; }
        else if (k < 0.74) { p.armR = 'hold'; p.eyes = 'happy'; p.blush = true; p.mouth = k > 0.5 ? (Math.floor(at * 6) % 2 ? 'chew' : 'smile') : 'open'; }
        else { p.eyes = 'closed'; p.mouth = 'smile'; p.blush = true; p.tail = 'wag'; }
      },
      front(g, a, k, at, c) {
        const cupX = a.hx + 9, cupY = GROUND - 4;
        // 받침 접시 + 찻잔
        this.pattern(['KKKKKKKK'], a.hx + 3, GROUND, { K: '#c3ccd6' });
        this.pattern(['KWWWK.', 'KWtWKK', 'KWWWK.', '.KKK..'], cupX, cupY, c);
        const soaked = k > 0.3;
        const cookie = (x, y, bite) => this.pattern(bite ? ['KK.', 'KsK', 'KKK'] : ['KKK', soaked ? 'KsK' : 'KOK', 'KKK'], Math.round(x) - 1, Math.round(y) - 1, { K: '#8a5a32', O: '#e8b061', s: '#b07a3e' });
        if (k < 0.12) { cookie(a.hx + 5, GROUND - 1); return; }
        if (k < 0.42) {
          // 앞발이 쿠키를 집어(0.12~0.2) 찻잔 위로(~0.24) → 퐁당 두 번(~0.36) → 들어 올린다
          let x, y;
          if (k < 0.2) { const e = ease(seg(k, 0.12, 0.2)); x = a.right + (a.hx + 5 - a.right) * e; y = a.cy + (GROUND - 3 - a.cy) * e; }
          else if (k < 0.24) { const e = ease(seg(k, 0.2, 0.24)); x = a.hx + 5 + (cupX + 2 - a.hx - 5) * e; y = GROUND - 3 - 5 * e; }
          else if (k < 0.36) { x = cupX + 2; y = GROUND - 8 + Math.round(bump((seg(k, 0.24, 0.36) * 2) % 1, 0, 1) * 3); }
          else { const e = ease(seg(k, 0.36, 0.42)); x = cupX + 2 + (a.right - cupX - 2) * e; y = GROUND - 8 + (a.cy - GROUND + 8) * e; }
          limb.call(this, g, a.right - 2, a.cy - 1, x, y - 2);
          cookie(x, y + 2);
          return;
        }
        if (k < 0.74) cookie(a.fx - 0.5, a.my + 2, k > 0.52);
      },
      step(r, k, at, dt, a) {
        if (every(r, 's', at, 0.25)) steam(r, r.scr(a.hx + 11), GROUND - 5);
        if (k > 0.26 && k < 0.36 && every(r, 'dk', at, 0.26)) r.emit({ type: 'spray', x: r.scr(a.hx + 11), y: GROUND - 5, vx: rand(-6, 6), vy: -8, ay: 30, life: 0.4, c: '#c48b56' });
        if (k > 0.5 && k < 0.74 && every(r, 'cr', at, 0.3)) r.emit({ type: 'spray', x: r.scr(a.fx + rand(-1, 1)), y: a.my + 2, vx: rand(-5, 5), vy: -3, ay: 30, life: 0.5, c: '#e8b061' });
        if (once(r, 'h', k > 0.76)) r.emit({ type: 'heart', x: r.scr(a.hx + 6), y: a.top - 3, vy: -6, life: 1.1 });
      },
    },
    foodsign: {
      // "FOOD" 피켓 시위 — "FOOD" 피켓을 들고 1인 시위. 피켓이 위아래로 흔들린다
      len: 2.4, loop: true,
      pose(p, k) { p.armL = p.armR = 'lift'; p.liftUp = bump(k, 0, 0.5); p.brow = 'angry'; p.mouth = 'big'; },
      front(g, a, k, at, c) { const up = Math.round(bump(k, 0, 0.5) * 4); this.pattern(['KKKKKKKKKKKKKKKKK', 'KWWWWWWWWWWWWWWWK', 'KWWWWWWWWWWWWWWWK', 'KWWWWWWWWWWWWWWWK', 'KWWWWWWWWWWWWWWWK', 'KWWWWWWWWWWWWWWWK', 'KKKKKKKKKKKKKKKKK'], a.hx - 8, a.top - 12 - up, c); },
      step(r, k, at, dt, a) { const up = Math.round(bump(k, 0, 0.5) * 4); r.emit({ type: 'text', s: 'FOOD', x: r.scr(a.hx) - 7, y: a.top - 11 - up, perFrame: true, fade: false, c: '#e8534a' }); } },
    paperplane: {
      // 종이비행기 — 종이비행기를 접어서 슝 날린다. 멀리 날아가는 걸 눈으로 좇음
      len: 3,
      pose(p, k) { p.armR = k < 0.3 ? 'hold' : 'out'; p.lookX = k > 0.3 ? 1 : 0; p.eyes = 'wide'; },
      front(g, a, k, at, c) { if (k < 0.3) this.pattern(['K...', 'KWK.', 'KWWK'], a.fx - 1, a.my, c); },
      step(r, k, at, dt, a) { if (k > 0.3 && k < 0.95) r.emit({ type: 'sprite', rows: ['W...', 'WWW.', 'WWWW'], map: { W: '#fffaf3' }, x: r.scr(a.hx + 4 + (k - 0.3) * 40), y: a.top - (k - 0.3) * 20, perFrame: true, fade: false }); } },
    airpunch: {
      // 허공에 냥펀치 — 아무것도 없는 허공을 노려보다 갑자기 냥냥펀치. 뭐가 보이는 걸까
      len: 2.4,
      pose(p, k, at) { if (k < 0.4) { p.eyes = 'wide'; p.lookY = -1; p.ear = 1; } else { p.armL = Math.floor(at * 10) % 2 ? 'cheer' : 'up'; p.armR = Math.floor(at * 10) % 2 ? 'up' : 'cheer'; p.eyes = 'squint'; p.brow = 'angry'; } },
      step(r, k, at, dt, a) { if (k > 0.4 && every(r, 'l', at, 0.1)) r.emit({ type: 'line', x: r.scr(a.hx + rand(-8, 8)), y: a.top - rand(2, 6), len: 3, life: 0.1 }); } },
    knitting: {
      // 뜨개질 — 두 앞발로 대바늘을 쥐고 딸깍딸깍. 바늘 밑으로 분홍 목도리가 한 단씩 길어지고, 털실 뭉치가 실을 풀며 들썩
      // (7차: 입에서 빨간 줄이 흘러내리는 것처럼 보이던 걸, 바늘·목도리·털실로)
      len: 4.8, loop: true,
      pose(p, k, at) {
        p.armL = p.armR = 'hold';
        p.lookY = 1; p.mouth = 'smile'; p.tail = 'slow';
        p.eyes = k > 0.86 ? 'happy' : Math.floor(at * 0.8) % 4 === 3 ? 'blink' : 'half';
        if (k > 0.86) { p.blush = true; p.lookY = 0; }
      },
      mid(g, a, k, at, c) {
        const cx = a.hx, y0 = a.my + 3;
        // 목도리: 바늘 밑으로 한 단씩 (두 줄마다 무늬가 엇갈린다)
        // 바닥에 닿을 만큼만 길어진다 (땅 밑으로 파고들지 않게)
        const room = Math.max(2, GROUND - (y0 + 2) + 1);
        const len = Math.min(room, 2 + Math.floor(Math.min(1, k / 0.86) * 6));
        for (let i = 0; i < len; i++) this.pattern([i === len - 1 ? 'KKKKK' : i % 2 ? 'KpPpK' : 'KPpPK'], cx - 2, y0 + 2 + i, c);
        // 털실: 목도리 끝 → 바닥의 털실 뭉치
        const bx = a.hx + 10, by = GROUND - 2;
        const n = 10;
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const x = cx + 2 + (bx - cx - 2) * t, y = y0 + 2 + (by - y0 - 2) * t + Math.sin(t * Math.PI) * 2;
          this.px(Math.round(x), Math.round(y), '#ff9bb8');
        }
        const roll = Math.floor(at * 3) % 2;
        this.pattern(roll ? ['.KKK.', 'KPpPK', 'KpPpK', '.KKK.'] : ['.KKK.', 'KpPpK', 'KPpPK', '.KKK.'], bx - 2, by - 1, c);
      },
      front(g, a, k, at, c) {
        // 대바늘 두 개가 X 자로 엇갈린다. 딸깍할 때마다 위아래가 바뀐다
        const click = Math.floor(at * 4) % 2;
        const cx = a.hx, y = a.my;
        const needle = (x0, y0, x1, y1) => {
          const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let i = 0; i <= n; i++) this.px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), i === n ? '#ffd65a' : '#c3ccd6');
        };
        // 바늘 끝은 입 아래까지만 (얼굴을 가리지 않게)
        if (click) { needle(cx + 4, y + 6, cx - 3, y + 3); needle(cx - 4, y + 6, cx + 3, y + 2); }
        else { needle(cx - 4, y + 6, cx + 3, y + 3); needle(cx + 4, y + 6, cx - 3, y + 2); }
      },
      step(r, k, at, dt, a) {
        if (k < 0.86 && every(r, 'c', at, 0.5)) r.emit({ type: 'spray', x: r.scr(a.hx + (Math.floor(at * 2) % 2 ? 3 : -3)), y: a.my, vy: -4, life: 0.25, c: '#ffffff' });
        if (once(r, 'h', k > 0.87)) r.emit({ type: 'heart', x: r.scr(a.hx + 7), y: a.top - 3, vy: -6, life: 1.1 });
      },
    },
    blowkiss: {
      // 하트 날리기 — 앞발로 입맞춤, 쪽! 윙크하며 하트를 날린다
      len: 2.8,
      pose(p, k) {
        if (k < 0.35) { p.armR = 'kiss'; p.mouth = 'kiss'; p.eyes = 'wink'; }
        else if (k < 0.6) { p.armR = 'out'; p.mouth = 'kiss'; p.eyes = 'wink'; }
        else { p.eyes = 'happy'; p.blush = true; }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'h', k > 0.35)) r.emit({ type: 'heart', big: true, x: r.scr(a.fx + 3), y: a.my - 2, vx: 13, vy: -9, life: 1.6 });
      },
    },
    fireup: {
      // 불타오름 — 의욕 활활. 등 뒤로 불꽃이 솟고 눈에 별이 뜬다
      len: 3, loop: true,
      pose(p, k, at) {
        p.eyes = 'star';
        p.brow = 'angry';
        p.mouth = 'open';
        p.armL = p.armR = 'up';
        p.ear = 1;
        p.tail = 'up';
        p.dy = Math.floor(at * 6) % 2 ? -1 : 0;
      },
      back(g, a, k, at) {
        for (let x = a.hx - 13; x <= a.hx + 13; x++) {
          const h = Math.max(0, Math.round(23 - Math.abs(x - a.hx) * 1.05 + Math.sin(at * 12 + x * 1.7) * 2.6));
          for (let i = 0; i < h; i++) {
            const f = i / h;
            this.px(x, GROUND - i, f > 0.78 ? '#ffe27a' : f > 0.45 ? '#ff9a3c' : '#e8534a');
          }
        }
      },
      step(r, k, at, dt, a) {
        if (every(r, 'e', at, 0.08)) r.emit({ type: 'ember', x: r.scr(a.hx + rand(-10, 10)), y: GROUND - 10, vy: -14, vx: rand(-3, 3), life: 0.9 });
      },
    },

    codefrenzy: {
      // 폭풍 코딩 — 눈 부릅뜨고 키보드를 두들긴다. 노트북에서 연기, 특수문자가 튄다
      len: 3.2, loop: true,
      pose(p, k, at) {
        p.prop = 'laptop';
        p.armL = p.armR = 'typefast';
        p.eyes = 'wide';
        p.brow = 'angry';
        p.mouth = 'flat';
        p.sweat = true;
        p.dy = -3;
        p.xf = { ox: Math.floor(at * 24) % 2 ? 1 : 0 };
        p.tail = 'flick';
      },
      step(r, k, at, dt, a) {
        if (every(r, 'c', at, 0.3)) { const side = Math.floor(at / 0.3) % 2 ? 1 : -1; r.emit({ type: 'char', s: '!?#;'[Math.floor(rand(0, 4))], x: r.scr(a.hx + side * 12) - 1, y: GROUND - 8, vy: -14, vx: side * 9, life: 0.7 }); }
        // 노트북 연기는 양 끝에서 바깥으로 (얼굴을 덮지 않게)
        if (every(r, 's', at, 0.3)) { const s = Math.floor(at / 0.3) % 2 ? -1 : 1; r.emit({ type: 'puff', x: r.scr(a.hx + s * 9), y: GROUND - 3, vy: -6, vx: r.facing * s * 6, life: 1, c: 'rgba(180,180,180,0.8)' }); }
      },
    },
    hooray: {
      // 임무 완료 — 빛나는 눈으로 두 발 번쩍 들고 점프, 색종이가 쏟아진다
      len: 2.8,
      pose(p, k) {
        p.dy = -Math.round(bump(k, 0.08, 0.4) * 6);
        p.armL = p.armR = 'cheer';
        p.eyes = 'star';
        p.mouth = 'open';
        p.tail = 'up';
        p.ear = 1;
        if (k > 0.4 && k < 0.5) p.xf = { sx: 1.1, sy: 0.9 };
      },
      step(r, k, at, dt, a) {
        if (once(r, 'go', k > 0.08)) {
          for (let i = 0; i < 26; i++) r.emit({ type: 'confetti', x: 24 + rand(-14, 14), y: rand(2, 12), vx: rand(-6, 6), vy: rand(-4, 6), ay: 14, life: rand(1.4, 2.4), c: CONFETTI[i % CONFETTI.length] });
          r.emit({ type: 'text', s: 'FINISHED!', x: 6, y: 3, vy: -1, life: 1.6, c: '#9fe3c8' });
        }
      },
    },

    sneeze: {
      // 재채기 — 에… 에… 에취! 몸이 튕겨 나가고 콧물 한 방울
      len: 2.6,
      pose(p, k, at) {
        if (k < 0.15) { p.eyes = 'half'; p.mouth = 'o'; }
        else if (k < 0.5) {
          const s = seg(k, 0.15, 0.5);
          p.eyes = s > 0.5 ? 'squint' : 'half';
          p.mouth = s > 0.6 ? 'big' : 'o';
          p.dy = -Math.round(s * 2);
          p.ear = -1;
        } else if (k < 0.62) { p.eyes = 'squint'; p.mouth = 'big'; p.xf = { sx: 1.14, sy: 0.86, oy: 1 }; p.ear = 1; }
        else { p.eyes = 'half'; p.mouth = 'flat'; p.xf = { ox: Math.sin(at * 30) * 0.6 * (1 - seg(k, 0.62, 0.8)) }; }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'a', k > 0.5)) {
          r.emit({ type: 'text', s: 'ACHOO!', x: r.scr(a.hx) + 2, y: a.top - 9, vy: -3, life: 1.1, c: '#fff' });
          for (let i = 0; i < 10; i++) r.emit({ type: 'spray', x: r.scr(a.fx), y: a.my + 2, vx: rand(-18, 18), vy: rand(-10, 6), ay: 30, life: 0.7 });
        }
        if (once(r, 'd', k > 0.7)) r.emit({ type: 'drop', x: r.scr(a.fx + 1), y: a.my + 1, vy: 2, life: 1.2, c: '#bfe6ff' });
      },
    },
    hiccup: {
      // 딸꾹질 — 딸꾹! 할 때마다 몸이 튀어 오르고 눈이 동그래진다
      len: 3.3, loop: true,
      pose(p, k, at) {
        if (at % 1.1 < 0.14) { p.dy = -3; p.eyes = 'wide'; p.mouth = 'o'; p.ear = 1; }
        else { p.eyes = 'half'; p.mouth = 'wavy'; p.brow = 'sad'; }
      },
      step(r, k, at, dt, a) {
        if (every(r, 'h', at, 1.1)) r.emit({ type: 'text', s: 'HIC', x: r.scr(a.hx) + 5, y: a.top - 6, vy: -6, life: 0.9, c: '#fff' });
      },
    },
    snot: {
      // 코풍선 — 자면서 코풍선이 부풀었다 줄었다… 퐁! 터지면 화들짝
      len: 4.6, loop: true,
      pose(p, k) { p.curl = true; p.eyes = k > 0.93 ? 'wide' : 'closed'; p.mouth = 'flat'; p.ear = k > 0.93 ? 1 : -1; },
      front(g, a, k, at) {
        if (k > 0.92) return;
        const rr = 1 + seg(k, 0, 0.9) * 3.3 + Math.sin(at * 3) * 0.35;
        const cx = a.fx + 1.5 + rr;
        const cy = a.my - 0.5;
        this.shape((x, y) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rr * rr, [cx - rr - 1, cy - rr - 1, cx + rr + 1, cy + rr + 1], () => 'rgba(205,232,250,0.55)', 'rgba(130,190,235,0.95)');
        this.px(Math.round(cx - rr * 0.4), Math.round(cy - rr * 0.4), '#fff', false);
      },
      step(r, k, at, dt, a) {
        if (every(r, 'z', at, 1.4) && k < 0.9) r.emit({ type: 'text', s: 'Z', x: r.scr(a.hx - 7), y: a.top - 5, vy: -4, vx: -2, life: 1.3, c: '#9aa6ff' });
        if (once(r, 'pop', k > 0.92)) {
          r.emit({ type: 'text', s: 'POP', x: r.scr(a.fx + 3), y: a.my - 8, vy: -4, life: 0.8, c: '#bfe6ff' });
          for (let i = 0; i < 6; i++) r.emit({ type: 'spray', x: r.scr(a.fx + 4), y: a.my, vx: rand(-14, 14), vy: rand(-12, 2), ay: 30, life: 0.5 });
        }
      },
    },
    fart: {
      // 뿡 — …뿡. 얼어붙었다가 아무 일 없었던 척 눈알만 굴린다
      len: 3,
      pose(p, k, at, r) {
        if (k < 0.25) p.eyes = r.blinkAt(at) ? 'blink' : 'open';
        else if (k < 0.4) { p.eyes = 'wide'; p.ear = 1; p.tail = 'up'; p.mouth = 'o'; p.dy = k < 0.3 ? -1 : 0; }
        else { p.eyes = 'side'; p.sideDir = Math.floor(at * 2.5) % 2 ? 1 : -1; p.sweat = true; p.mouth = 'wavy'; p.tail = 'up'; }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'p', k > 0.25)) {
          for (let i = 0; i < 3; i++) r.emit({ type: 'stink', x: r.scr(a.hx + 9 + i * 2), y: GROUND - 3 - i, vx: 3 + i, vy: -3, life: 1.6 + i * 0.3 });
          r.emit({ type: 'text', s: 'PUU', x: r.scr(a.hx + 9), y: GROUND - 12, vy: -3, life: 1.2, c: '#dfe8b5' });
        }
      },
    },
    soul: {
      // 영혼 가출 — 너무 지쳐서 ×_× 입으로 영혼이 빠져나간다… 퍼뜩 정신 차림
      len: 3.8,
      pose(p, k) {
        if (k < 0.12) p.eyes = 'half';
        else if (k < 0.85) { p.eyes = 'x'; p.mouth = 'o'; p.ear = -1; p.tail = 'slow'; p.xf = { sy: 0.88, sx: 1.06 }; p.dy = 1; }
        else { p.eyes = 'wide'; p.mouth = 'o'; p.ear = 1; }
      },
      step(r, k, at, dt, a) {
        if (once(r, 's', k > 0.15)) r.emit({ type: 'soul', x: r.scr(a.fx), y: a.my - 2, vy: -9, vx: 1.5, life: 2.4 });
        if (k > 0.15 && k < 0.85 && every(r, 'g', at, 0.2)) r.emit({ type: 'vline', x: r.scr(a.hx + Math.floor(rand(-6, 7))), y: a.top - 7, len: 3, life: 0.5 });
        if (once(r, 'w', k > 0.85)) r.emit({ type: 'text', s: '!', x: r.scr(a.hx + 6), y: a.top - 8, vy: -4, life: 0.6, c: '#ffd35c' });
      },
    },
    workout: {
      // 헬스 — 아령을 머리 위로 번쩍번쩍. 땀 뻘뻘, 마지막엔 부들부들
      len: 3.6, loop: true,
      pose(p, k, at) {
        const rep = (Math.sin(at * 7) + 1) / 2;
        p.liftUp = rep;
        p.armL = p.armR = 'lift';
        p.eyes = rep > 0.6 ? 'squint' : 'open';
        p.mouth = rep > 0.6 ? 'wavy' : 'flat';
        p.sweat = true;
        p.brow = 'angry';
        if (k > 0.8) p.xf = { ox: Math.sin(at * 40) * 0.6 };
      },
      front(g, a, k, at, c) {
        const y = Math.round(a.top - 1 - ((Math.sin(at * 7) + 1) / 2) * 4) - 1;
        for (let x = a.hx - 7; x <= a.hx + 7; x++) this.px(x, y, '#8a93a3');
        for (const x of [a.hx - 9, a.hx + 8]) { this.rect(x, y - 2, 2, 5, '#3a3f4b'); this.px(x, y - 2, '#6b7280'); }
      },
    },

    // ================= 상점 B급 (2차) =================
    smoke: {
      // 담배 한 대 — 고단한 하루… 앞발로 담배를 들고 깊~게 들이마신 뒤 후우 연기를 내뿜으며 먼 산을 본다
      len: 5.2, loop: true,
      pose(p, k) {
        p.armR = 'kiss';
        if (k < 0.3) { p.eyes = 'closed'; p.mouth = 'none'; p.xf = { sy: 1 + 0.05 * seg(k, 0, 0.3), sx: 1 + 0.03 * seg(k, 0, 0.3) }; p.ear = -1; }
        else if (k < 0.38) { p.eyes = 'closed'; p.mouth = 'none'; p.xf = { sy: 1.05, sx: 1.03 }; }
        else if (k < 0.75) { p.eyes = 'half'; p.mouth = 'o'; p.lookX = 1; p.brow = 'sad'; p.armR = 'rest'; }
        else { p.eyes = 'half'; p.mouth = 'flat'; p.lookX = 1; p.brow = 'sad'; }
        p.tail = 'slow';
      },
      front(g, a, k) {
        if (k >= 0.38 && k < 0.75) return; // 내뿜을 땐 손을 내린다
        const glow = k < 0.3 && Math.floor(k * 40) % 2 ? '#ffe27a' : '#ff6a2c';
        this.pattern(CIG, a.fx + 1, a.my + 1, { W: '#fffaf3', o: glow });
        this.px(a.fx + 1, a.my + 1, '#d9b27a');
      },
      step(r, k, at, dt, a) {
        if (k < 0.3 && every(r, 'wisp', at, 0.35)) r.emit({ type: 'puff', x: r.scr(a.fx + 7), y: a.my - 1, vy: -5, vx: 1, life: 1.2, c: 'rgba(210,210,210,0.6)' });
        if (k > 0.38 && k < 0.7 && every(r, 'out', at, 0.09)) r.emit({ type: 'puff', x: r.scr(a.fx + 2), y: a.my + 1, vx: r.facing * rand(10, 18), vy: rand(-6, -2), life: 1.6, c: 'rgba(225,225,225,0.85)' });
        if (once(r, 'ring', k > 0.55)) r.emit({ type: 'ring', x: r.scr(a.fx + 6), y: a.my - 3, vx: r.facing * 7, vy: -5, r: 2, grow: 3, life: 1.6 });
        if (once(r, 'sigh', k > 0.75)) r.emit({ type: 'text', s: 'HOO...', x: r.scr(a.hx) + 2, y: a.top - 10, vy: -2, life: 1.4, c: '#e9e4dc' });
      },
    },

    dealwithit: {
      // 선글라스 착 — 하늘에서 선글라스가 천천히 내려와 얼굴에 착. 입꼬리 씩 — 쿨함 그 자체
      len: 4, reveal: 0.46, loop: true,
      pose(p, k) {
        p.eyes = k < 0.45 ? 'open' : 'none';
        p.mouth = k > 0.5 ? 'grin' : 'flat';
        p.tail = k > 0.5 ? 'wag' : 'idle';
        if (k > 0.45 && k < 0.52) p.xf = { sy: 0.94, sx: 1.04 };
      },
      front(g, a, k) {
        const y = Math.round(-6 + (a.ey - 1 + 6) * ease(seg(k, 0.05, 0.45)));
        this.pattern(SHADES, a.eyeL - 2, y, { k: '#1f1c1b', H: '#ffffff' });
      },
      step(r, k) {
        if (once(r, 'c', k > 0.5)) r.emit({ type: 'text', s: 'COOL', x: 16, y: 5, vy: -1, life: 1.6, c: '#9fe3c8' });
        if (once(r, 's', k > 0.47)) r.emit({ type: 'spark', x: r.scr(28), y: 36, vy: -4, life: 0.6 });
      },
    },

    karaoke: {
      // 노래방 열창 — 핀 조명 아래 마이크 꽉 쥐고 고음 발사. 눈 질끈, 하트가 날린다
      len: 4, loop: true,
      pose(p, k, at) {
        p.armR = 'kiss';
        p.eyes = 'closed';
        p.mouth = k > 0.55 ? 'big' : Math.floor(at * 3) % 2 ? 'open' : 'o';
        p.brow = k > 0.55 ? 'sad' : null;
        p.dy = k > 0.55 ? -1 : 0;
        p.xf = k > 0.55 ? { ox: Math.sin(at * 30) * 0.5 } : null;
        p.tail = 'wag';
      },
      back(g, a) {
        for (let y = 0; y <= GROUND; y++) {
          const w = Math.round(2 + y * 0.28);
          for (let x = a.hx - w; x <= a.hx + w; x++) this.px(x, y, 'rgba(255,240,170,0.28)', false);
        }
      },
      front(g, a, k, at, c) {
        this.pattern(['.KK.', 'KggK', 'KggK', '.KK.', '.KD.', '.KD.', '.KD.'], a.fx + 1, a.my - 1, c);
      },
      step(r, k, at, dt, a) {
        if (every(r, 'n', at, 0.3)) r.emit({ type: k > 0.55 ? 'heart' : 'note', x: r.scr(a.hx + rand(-10, 10)), y: a.top - 3, vy: -9, vx: rand(-4, 4), life: 1.1 });
      },
    },

    ninja: {
      // 닌자 변신 — 펑! 연기 속에서 복면 닌자로. 수리검 휙휙 던지고 다시 펑 하고 사라짐
      len: 4.4, reveal: 0.12, loop: true,
      pose(p, k) {
        const hidden = (k > 0.08 && k < 0.16) || k > 0.88;
        p.xf = hidden ? { sx: 0.01, sy: 0.01 } : null;
        p.noShadow = hidden;
        if (k > 0.16 && k < 0.88) { p.brow = 'angry'; p.eyes = 'open'; p.mouth = 'none'; p.armR = k > 0.4 && k < 0.7 ? 'out' : 'rest'; p.tail = 'flick'; }
      },
      front(g, a, k, at, c) {
        if (k < 0.16 || k > 0.88) return;
        // 이마 띠 + 복면 (눈만 보인다)
        this.pattern(['KKKKKKKKKKKKK'], a.hx - 6, a.top + 1, { K: '#2a2f3a' });
        this.pattern(['.K', 'KK', 'K.'], a.hx - 8, a.top + 1, { K: '#2a2f3a' });
        this.rect(a.hx - 5, a.my - 1, 11, 4, '#2a2f3a');
      },
      step(r, k, at, dt, a) {
        for (const [tag, t] of [['p1', 0.08], ['p2', 0.88]]) if (once(r, tag, k > t)) { for (let i = 0; i < 9; i++) r.emit({ type: 'puff', x: 24 + rand(-9, 9), y: 38 + rand(-6, 4), vy: -5, vx: rand(-3, 3), life: 0.8, c: '#e9e4dc' }); r.emit({ type: 'text', s: 'NIN!', x: 17, y: 12, vy: -3, life: 0.8, c: '#fff' }); }
        if (k > 0.4 && k < 0.7 && every(r, 's', at, 0.35)) r.emit({ type: 'shuriken', x: r.scr(a.hx + 9), y: a.ey, vx: r.facing * 40, life: 0.8, fade: false });
      },
    },

    rocket: {
      // 로켓 발사 — 3, 2, 1… 엉덩이에서 불을 뿜으며 하늘로 슝! 잠시 뒤 낙하산 없이 쿵 착지
      len: 5, reveal: 0.58, loop: true,
      pose(p, k, at) {
        let oy = 0;
        if (k < 0.36) { p.eyes = 'wide'; p.xf = { ox: k > 0.26 ? Math.sin(at * 50) * 0.7 : 0 }; p.sweat = true; }
        else if (k < 0.55) { oy = -60 * ease(seg(k, 0.36, 0.55)); p.eyes = 'squint'; p.mouth = 'big'; p.ear = -1; p.armL = p.armR = 'up'; }
        else if (k < 0.8) { oy = -60 * (1 - ease(seg(k, 0.62, 0.8))) ; if (k < 0.62) oy = -60; p.eyes = 'wide'; p.mouth = 'o'; p.armL = p.armR = 'cheer'; }
        else { p.xf = { sy: 1 - 0.2 * (1 - seg(k, 0.8, 0.9)), sx: 1 + 0.15 * (1 - seg(k, 0.8, 0.9)) }; p.eyes = 'x'; p.mouth = 'wavy'; }
        if (oy) p.xf = { oy: Math.round(oy) };
        p.noShadow = oy < -20;
      },
      back(g, a, k, at) {
        if (k < 0.36 || k > 0.58) return;
        for (let y = 0; y < 9; y++) {
          const w = Math.max(0, 3 - Math.floor(y / 3)) + (Math.floor(at * 20 + y) % 2);
          for (let x = a.hx - w; x <= a.hx + w; x++) this.px(x, GROUND + 1 + y, y < 2 ? '#fff4b0' : y < 5 ? '#ffb23c' : '#e8534a');
        }
      },
      step(r, k, at, dt, a) {
        for (const [i, t] of [[3, 0.02], [2, 0.12], [1, 0.22]]) if (once(r, 'c' + i, k > t)) r.emit({ type: 'text', s: String(i), x: 22, y: 8, vy: -2, life: 0.4, c: '#fff' });
        if (k > 0.36 && k < 0.5 && every(r, 'sm', at, 0.05)) r.emit({ type: 'puff', x: 24 + rand(-6, 6), y: GROUND - 1, vx: rand(-14, 14), vy: -3, life: 0.9, c: '#e9e4dc' });
        if (once(r, 'land', k > 0.8)) { r.emit({ type: 'text', s: 'THUD', x: 15, y: 20, vy: -2, life: 0.8, c: '#fff' }); for (let i = 0; i < 6; i++) r.emit({ type: 'dust', x: 24 + rand(-10, 10), y: GROUND, vx: rand(-10, 10), life: 0.5 }); }
      },
    },

    gum: {
      // 풍선껌 비행 — 풍선껌을 부풀리다 너무 커져서 풍선처럼 머리 위로 떠올라 고양이를 둥실 들어 올림… 퐁! 터지고 얼굴에 껌 범벅으로 추락
      // (7차: 풍선이 얼굴을 통째로 가려 표정이 안 보이던 걸, 커질수록 머리 위로 올라가 껌 줄로 입에 매달리게)
      len: 5, loop: true,
      pose(p, k) {
        let oy = 0;
        p.mouth = 'kiss';
        if (k < 0.22) p.eyes = 'closed';
        else if (k < 0.35) { p.eyes = 'wide'; p.ear = 1; } // 어? 풍선이 머리 위로…
        else if (k < 0.62) { oy = -18 * ease(seg(k, 0.35, 0.62)); p.eyes = k < 0.45 ? 'wide' : 'happy'; p.armL = p.armR = 'float'; p.tail = 'wag'; p.noShadow = oy < -8; }
        else if (k < 0.74) { oy = -18 * (1 - seg(k, 0.62, 0.74) ** 2); p.eyes = 'x'; p.mouth = 'o'; p.armL = p.armR = 'up'; p.ear = -1; }
        else if (k < 0.9) { p.eyes = 'x'; p.mouth = 'wavy'; p.ear = -1; p.tail = 'slow'; if (k < 0.8) p.xf = { sx: 1.15, sy: 0.86 }; }
        else { p.eyes = 'half'; p.mouth = 'flat'; p.xf = { ox: Math.round(Math.sin(k * 180) * (1 - seg(k, 0.9, 0.96))) }; } // 도리도리 털어 내고 다시 처음처럼
        if (oy) p.xf = { oy: Math.round(oy) };
      },
      front(g, a, k) {
        if (k < 0.62) {
          const rr = 1 + 6.5 * ease(seg(k, 0, 0.35));
          const rise = ease(seg(k, 0.12, 0.35)); // 입 앞 → 머리 위로
          const cx = a.fx + 0.5;
          const cy = (a.my + 0.5) + (a.top - rr - (a.my + 0.5)) * rise;
          // 입에서 풍선까지 늘어난 껌 줄
          if (rise > 0) for (let y = Math.round(cy + rr); y <= a.my; y++) this.px(a.fx, y, '#ff9bb8');
          this.shape((x, y) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rr * rr, [cx - rr - 1, cy - rr - 1, cx + rr + 1, cy + rr + 1], () => '#ff9bb8', '#d9668b');
          this.px(Math.round(cx - rr * 0.45), Math.round(cy - rr * 0.45), '#fff', false);
        } else if (k > 0.66 && k < 0.9) {
          // 얼굴에 껌 범벅
          for (const [dx, dy] of [[-4, 0], [-3, 1], [3, -1], [4, 1], [0, 2], [1, 3], [-1, 3], [5, 0], [-2, -2], [2, -3]]) this.px(a.fx + dx, a.ey + dy, '#ff9bb8');
        }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'p', k > 0.62)) { r.emit({ type: 'text', s: 'POP!', x: r.scr(a.hx) - 6, y: a.top - 14, vy: -3, life: 0.8, c: '#ff9bb8' }); for (let i = 0; i < 10; i++) r.emit({ type: 'spray', x: r.scr(a.fx), y: a.top - 6, vx: rand(-20, 20), vy: rand(-18, 4), ay: 40, life: 0.6, c: '#ff9bb8' }); }
        if (once(r, 'l', k > 0.74)) for (let i = 0; i < 5; i++) r.emit({ type: 'dust', x: 24 + rand(-10, 10), y: GROUND, vx: rand(-8, 8), life: 0.5 });
      },
    },



    explode: {
      // 스트레스 폭발 — 점점 빨개지고 귀에서 김이 푸슉… 펑! 새까맣게 탄 채 멍. 머리털이 삐죽
      len: 4.6, reveal: 0.47, loop: true,
      pose(p, k, at) {
        if (k < 0.45) { p.brow = 'angry'; p.eyes = 'squint'; p.mouth = 'wavy'; p.xf = { ox: Math.sin(at * 40) * seg(k, 0.1, 0.45), sx: 1 + 0.08 * seg(k, 0, 0.45), sy: 1 + 0.08 * seg(k, 0, 0.45) }; }
        else if (k < 0.5) { p.xf = { sx: 1.25, sy: 1.25 }; p.eyes = 'wide'; p.mouth = 'big'; }
        else { p.eyes = 'dot'; p.mouth = 'o'; p.tail = 'slow'; }
      },
      front(g, a, k) {
        if (k < 0.5) return;
        // 삐죽 선 머리털
        for (const dx of [-3, -1, 1, 3]) { this.px(a.hx + dx, a.top - 1, '#2b1a10'); this.px(a.hx + dx + (dx > 0 ? 1 : -1), a.top - 2, '#2b1a10'); }
      },
      step(r, k, at, dt, a) {
        if (k < 0.45) {
          tintUnder(r, '#ff3b3b', 0.5 * seg(k, 0, 0.45)); // 김(흰 연기)은 물들이지 않게 고양이에만
          if (k > 0.15 && every(r, 's', at, 0.15)) for (const s of [-1, 1]) r.emit({ type: 'puff', x: r.scr(a.hx + s * 5), y: a.top - 3, vy: -12, vx: s * 5, life: 0.6, c: '#ffffff' });
        } else if (k < 0.5) {
          flashCat(r, seg(k, 0.45, 0.5));
          if (once(r, 'b', true)) { r.emit({ type: 'text', s: 'BOOM', x: 15, y: 6, vy: -2, life: 1, c: '#ffd35c' }); for (let i = 0; i < 20; i++) r.emit({ type: 'confetti', x: 24, y: 36, vx: rand(-30, 30), vy: rand(-30, 0), ay: 40, life: rand(0.8, 1.4), c: CONFETTI[i % 6] }); }
        } else {
          tintUnder(r, '#2b2420', 0.55 * (1 - seg(k, 0.85, 1)));
          if (every(r, 'sm', at, 0.4)) r.emit({ type: 'puff', x: r.scr(a.hx + rand(-4, 4)), y: a.top - 3, vy: -5, life: 1, c: 'rgba(90,90,90,0.7)' });
        }
      },
    },

    ghost: {
      // 유령 코스프레 — 하얀 이불 뒤집어쓰고 둥실 떠서 BOO! 반투명하게 스르르
      len: 4, loop: true,
      pose(p, k, at) {
        p.xf = { oy: Math.round(-3 + Math.sin(at * 3) * 2) };
        p.noTail = true;
        p.eyes = 'none';
        p.mouth = 'none';
      },
      front(g, a, k, at, c) {
        const T = a.earTop - 2;
        for (let y = T; y <= GROUND; y++) {
          const w = y < T + 3 ? 5 + (y - T) * 1 : 8;
          for (let x = a.hx - w; x <= a.hx + w; x++) {
            const hem = y === GROUND && (x + Math.floor(at * 6)) % 3 === 0;
            if (hem) continue;
            const edge = x === a.hx - w || x === a.hx + w || y === T;
            this.px(x, y, edge ? '#9fb3c4' : '#fbfdff');
          }
        }
        this.rect(a.eyeL, a.ey, 2, 2, '#2b1a10');
        this.rect(a.eyeR, a.ey, 2, 2, '#2b1a10');
        if (k > 0.4 && k < 0.7) this.rect(a.fx - 1, a.my + 1, 3, 3, '#2b1a10');
      },
      step(r, k, at) {
        tintUnder(r, '#000', 0.25 + 0.15 * Math.sin(at * 3), 'destination-out'); // BOO! 글자는 또렷하게, 유령만 반투명
        if (once(r, 'b', k > 0.4)) r.emit({ type: 'text', s: 'BOO!', x: 16, y: 6, vy: -2, life: 1, c: '#fff' });
      },
    },


    // ================= 상점 B급 (3차) =================
    soju: {
      // 소주 한 잔 — 초록 병 옆에 두고 소주 한 잔 원샷, 크으~! 얼굴 발그레해져서 비틀비틀 딸꾹
      len: 5.4, loop: true,
      pose(p, k, at) {
        if (k < 0.22) { p.armR = 'hold'; p.eyes = 'open'; p.lookX = 1; }
        else if (k < 0.4) { p.armR = 'kiss'; p.eyes = 'closed'; p.mouth = 'none'; p.lookY = -1; p.xf = { rot: -0.07 * ease(seg(k, 0.22, 0.28)), py: GROUND }; } // 고개를 젖혀 원샷 (크게 돌리면 도트가 깨져서 살짝만)
        else if (k < 0.55) { p.eyes = 'squint'; p.mouth = 'big'; p.xf = { ox: Math.sin(at * 40) * 0.6 }; p.ear = -1; }
        else { p.eyes = Math.floor(at * 1.5) % 2 ? 'half' : 'happy'; p.mouth = 'wavy'; p.blush = true; p.xf = { ox: Math.round(Math.sin(at * 2.2) * 1.5), rot: Math.sin(at * 2.2) * 0.05, py: GROUND }; p.tail = 'slow'; } // 비틀비틀: 옆으로 흔들리며 살짝 기운다
      },
      front(g, a, k, at, c) {
        this.pattern(BOTTLE, a.hx + 9, GROUND - 6, c);
        if (k < 0.22) this.pattern(SHOT, a.fx + 3, a.my + 1, c);
        else if (k < 0.4) this.pattern(SHOT, a.fx + 1, a.my - 1, c);
      },
      step(r, k, at, dt, a) {
        if (once(r, 'k', k > 0.4)) r.emit({ type: 'text', s: 'KHAA!', x: r.scr(a.hx) - 7, y: a.top - 10, vy: -2, life: 1, c: '#fff' });
        if (k > 0.55) {
          tintUnder(r, '#ff5a5a', 0.14);
          if (every(r, 'h', at, 1.1)) { r.emit({ type: 'text', s: 'HIC', x: r.scr(a.hx) + 4, y: a.top - 7, vy: -5, life: 0.8, c: '#fff' }); r.emit({ type: 'bubble', x: r.scr(a.fx + 3), y: a.my - 2, vy: -8, r: 1.4, life: 1 }); }
        }
      },
    },

    skullsmoke: {
      // 해골 연기 — 담배를 깊게 빨고… 후우 내뿜은 연기가 해골 모양이 되어 둥실. 본인은 씩 웃는다
      len: 5.6, loop: true,
      pose(p, k) {
        p.armR = k < 0.35 ? 'kiss' : 'rest';
        if (k < 0.35) { p.eyes = 'closed'; p.mouth = 'none'; p.xf = { sy: 1 + 0.05 * seg(k, 0, 0.35), sx: 1 + 0.03 * seg(k, 0, 0.35) }; }
        else if (k < 0.55) { p.eyes = 'half'; p.mouth = 'o'; }
        else { p.eyes = 'half'; p.brow = 'angry'; p.mouth = 'grin'; p.tail = 'flick'; }
      },
      front(g, a, k) {
        if (k >= 0.35) return;
        const glow = Math.floor(k * 40) % 2 ? '#ffe27a' : '#ff6a2c';
        this.pattern(CIG, a.fx + 1, a.my + 1, { W: '#fffaf3', o: glow });
      },
      step(r, k, at, dt, a) {
        if (k > 0.35 && k < 0.5 && every(r, 'p', at, 0.08)) r.emit({ type: 'puff', x: r.scr(a.fx + 2), y: a.my, vx: r.facing * rand(4, 9), vy: -8, life: 0.9, c: 'rgba(225,225,225,0.8)' });
        if (once(r, 's', k > 0.45)) r.emit({ type: 'skull', x: r.scr(a.hx + 6), y: a.top - 8, vx: r.facing * 2, vy: -3, life: 2.6 });
        if (once(r, 'h', k > 0.6)) r.emit({ type: 'text', s: 'HEH', x: r.scr(a.hx) - 14, y: a.top - 4, vy: -2, life: 1.2, c: '#fff' });
      },
    },

    codeflame: {
      // 코딩 불꽃 — Claude가 일하는 동안 등 뒤로 불꽃이 활활. 눈엔 별, 앞발은 초고속 타자. 일할 때 자리에 딱
      len: 3, loop: true,
      pose(p, k, at) {
        p.prop = 'laptop';
        p.armL = p.armR = 'typefast';
        p.eyes = 'star';
        p.brow = 'angry';
        p.mouth = 'grin';
        p.dy = -3;
        p.tail = 'flick';
      },
      back(g, a, k, at) {
        for (let x = a.hx - 14; x <= a.hx + 14; x++) {
          const h = Math.max(0, Math.round(21 - Math.abs(x - a.hx) * 0.8 + Math.sin(at * 13 + x * 1.9) * 3));
          for (let i = 0; i < h; i++) {
            const f = i / h;
            this.px(x, GROUND - i, f > 0.8 ? '#fff1a8' : f > 0.5 ? '#ffb23c' : f > 0.25 ? '#ff7a2c' : '#e8434a');
          }
        }
      },
      step(r, k, at, dt, a) {
        if (every(r, 'e', at, 0.06)) r.emit({ type: 'ember', x: r.scr(a.hx + rand(-13, 13)), y: GROUND - 14, vy: -18, vx: rand(-4, 4), life: 0.9 });
        if (every(r, 'c', at, 0.4)) r.emit({ type: 'char', s: '#;:+%'[Math.floor(rand(0, 5))], x: r.scr(a.hx + rand(-12, 10)), y: 12, vy: -8, life: 0.8, c: '#ffe9a8' });
      },
    },

    spider: {
      // 스파이더냥 — 빨간 복면 쓰고 천장에 거미줄 쭉! 화면을 이리저리 그네 타듯 날아다니다 착지 포즈
      len: 6, loop: true,
      pose(p, k, at, r) {
        const swing = k > 0.15 && k < 0.85;
        const ang = swing ? Math.sin(seg(k, 0.15, 0.85) * Math.PI * 3) * 0.75 : 0;
        r.ms.ang = ang;
        r.ms.lift = swing ? 10 : k < 0.15 ? 0 : 10 * (1 - seg(k, 0.85, 0.92));
        p.xf = { px: 24, py: 2, rot: ang, oy: -Math.round(r.ms.lift) };
        p.noShadow = swing;
        p.eyes = 'none';
        p.armR = k < 0.15 || swing ? 'point' : 'rest';
        p.armL = swing ? 'up' : 'rest';
        p.tail = 'up';
        if (k > 0.9) { p.armL = p.armR = 'cheer'; }
      },
      front(g, a, k, at, c) {
        // 빨간 복면 + 흰 눈 + 거미줄 무늬
        for (let y = a.top + 1; y <= a.my + 2; y++) for (let x = a.hx - 5; x <= a.hx + 5; x++) this.px(x, y, (x + y) % 4 === 0 ? '#8a1e18' : '#e8342a');
        this.pattern(['KWWK', 'KWWK', '.KK.'], a.eyeL - 1, a.ey - 1, { K: c.K, W: '#fff' });
        this.pattern(['KWWK', 'KWWK', '.KK.'], a.eyeR - 1, a.ey - 1, { K: c.K, W: '#fff' });
      },
      step(r, k, at, dt, a) {
        // 거미줄: 천장 한 점 → 머리 위 (몸이 돈 만큼 같이 돌린다)
        const ang = r.ms.ang || 0;
        const hx = r.scr(a.hx + 5) - 24;
        const hy = a.top - 2 - 2 - (r.ms.lift || 0);
        const x2 = 24 + hx * Math.cos(ang) - hy * Math.sin(ang);
        const y2 = 2 + hx * Math.sin(ang) + hy * Math.cos(ang);
        if (k < 0.15) {
          const t = seg(k, 0.03, 0.12);
          if (t > 0) r.emit({ type: 'seg', x: x2, y: y2, x2: x2 + (24 - x2) * t, y2: y2 + (-2 - y2) * t, perFrame: true, fade: false });
        } else if (k < 0.88) r.emit({ type: 'seg', x: 24, y: -2, x2, y2, perFrame: true, fade: false });
        if (once(r, 'tw', k > 0.04)) r.emit({ type: 'text', s: 'THWIP', x: 14, y: 4, vy: -2, life: 0.8, c: '#fff' });
        if (k > 0.2 && k < 0.8 && every(r, 'w', at, 0.18)) r.emit({ type: 'line', x: x2 - 8, y: y2 + 12 + rand(-4, 4), len: 4, life: 0.2 });
        if (once(r, 'l', k > 0.9)) for (let i = 0; i < 5; i++) r.emit({ type: 'dust', x: 24 + rand(-10, 10), y: GROUND, vx: rand(-8, 8), life: 0.5 });
      },
    },



    lightning: {
      // 번개 맞음 — 머리 위 먹구름에서 번쩍! 번개에 맞아 뼈가 보였다가, 새까맣게 탄 뽀글머리로 멍
      len: 4.6, reveal: 0.4, loop: true,
      pose(p, k) {
        if (k < 0.3) { p.eyes = 'side'; p.sideDir = Math.floor(k * 20) % 2 ? 1 : -1; p.sweat = true; p.lookY = -1; }
        else if (k < 0.45) { p.eyes = 'wide'; p.mouth = 'big'; p.armL = p.armR = 'up'; p.xf = { ox: Math.floor(k * 200) % 2 ? 1 : -1 }; }
        else { p.eyes = 'dot'; p.mouth = 'o'; p.ear = -1; p.tail = 'slow'; }
      },
      front(g, a, k, at, c) {
        if (k < 0.45) this.pattern(['...KKK.KKK...', '..KDDDKDDDK..', '.KDgDDDDDgDK.', 'KDDDDDgDDDDDK', '.KKKKKKKKKKK.'], a.hx - 6, a.top - 13, c);
        if (k > 0.45) for (const [dx, dy] of [[-4, -1], [-2, -2], [0, -3], [2, -2], [4, -1], [-3, -3], [3, -3], [-1, -4], [1, -4], [-5, 0], [5, 0]]) this.px(a.hx + dx, a.top + dy, '#2b1a10');
      },
      step(r, k, at, dt, a) {
        // 번개는 먹구름 밑에서 정수리까지만 (7차: 캔버스 꼭대기부터 내려오며 구름을 뚫고, 까만 tint 에 번개·글자까지 물들던 걸 고쳤다)
        if (k > 0.3 && k < 0.45) {
          if (k < 0.34) flashCat(r, seg(k, 0.3, 0.34));
          else { tintUnder(r, '#1a1210', 0.85); r.emit({ type: 'skel', x: r.scr(a.hx), y: a.top + 1, perFrame: true, fade: false }); }
          const zig = Math.floor(at * 20) % 2;
          r.emit({ type: 'sprite', rows: zig ? ['.WY.', 'WY..', '.WY.', '..WY', '.WY.', 'WY..', '.WY.', '..W.'] : ['..WY', '.WY.', 'WY..', '.WY.', '..WY', '.WY.', 'WY..', '.W..'], map: { W: '#fffbd0', Y: '#ffd35c' }, x: r.scr(a.hx) - 2, y: a.top - 8, perFrame: true, fade: false });
        }
        if (once(r, 'z', k > 0.3)) r.emit({ type: 'text', s: 'ZZAP', x: 15, y: 20, vy: -2, life: 0.8, c: '#ffd35c' });
        if (k > 0.45) {
          tintUnder(r, '#2b2420', 0.5 * (1 - seg(k, 0.85, 1)));
          if (every(r, 's', at, 0.35)) r.emit({ type: 'puff', x: r.scr(a.hx + rand(-4, 4)), y: a.top - 5, vy: -5, life: 1, c: 'rgba(90,90,90,0.7)' });
        }
      },
    },

    bubbles: {
      // 비눗방울 놀이 — 비눗방울 막대를 후~ 불면 방울이 둥실둥실. 앞발로 톡톡 터뜨리며 신남
      len: 4.4, loop: true,
      pose(p, k, at) {
        if (k < 0.45) { p.armR = 'kiss'; p.eyes = 'closed'; p.mouth = 'o'; }
        else { p.armL = p.armR = Math.floor(at * 4) % 2 ? 'up' : 'cheer'; p.eyes = 'happy'; p.mouth = 'open'; p.dy = Math.floor(at * 4) % 2 ? -1 : 0; p.tail = 'wag'; }
      },
      front(g, a, k) {
        if (k < 0.45) this.pattern(['.KK.', 'K..K', '.KK.', '..K.', '..K.'], a.fx + 2, a.my - 3, { K: '#b784f5' });
      },
      step(r, k, at, dt, a) {
        if (k < 0.45 && every(r, 'b', at, 0.18)) r.emit({ type: 'bubble', x: r.scr(a.fx + 5), y: a.my - 3, vx: r.facing * rand(6, 14), vy: rand(-8, -2), r: rand(1.2, 2.4), life: 2.2 });
        if (k > 0.5 && every(r, 'p', at, 0.5)) r.emit({ type: 'text', s: 'POP', x: r.scr(a.hx + rand(-10, 6)), y: a.top - 8, vy: -4, life: 0.4, c: '#bfe6ff' });
      },
    },

    ufo: {
      // UFO 납치 — 하늘에서 UFO가 내려와 초록 빛을 쏜다. 고양이가 빙글빙글 빨려 올라갔다가… 퉤 뱉어짐
      len: 5.4, loop: true,
      pose(p, k, at) {
        let oy = 0;
        let rot = 0;
        if (k < 0.25) { p.eyes = 'wide'; p.lookY = -1; p.sweat = k > 0.12; }
        else if (k < 0.55) { const s = ease(seg(k, 0.3, 0.55)); oy = -26 * s; rot = at * 4 * s; p.eyes = 'x'; p.mouth = 'o'; p.armL = p.armR = 'up'; }
        else if (k < 0.72) { oy = -60; }
        else if (k < 0.82) { oy = -60 + 60 * ease(seg(k, 0.72, 0.82)); p.eyes = 'x'; p.mouth = 'big'; }
        else { p.eyes = 'dot'; p.mouth = 'flat'; p.xf = { sy: 0.9 + 0.1 * seg(k, 0.82, 0.9), sx: 1.08 - 0.08 * seg(k, 0.82, 0.9) }; }
        if (oy) { p.xf = { oy: Math.round(oy), rot, px: 24, py: 38 }; p.noShadow = true; }
      },
      step(r, k, at, dt, a) {
        const uy = k < 0.15 ? -8 + 12 * seg(k, 0, 0.15) : k < 0.62 ? 4 : 4 - 20 * seg(k, 0.62, 0.72);
        if (k < 0.72) r.emit({ type: 'ufo', x: 24, y: uy, perFrame: true, fade: false });
        if (k > 0.15 && k < 0.58) r.emit({ type: 'beam', x: 24, y: uy + 6, perFrame: true, fade: false });
        if (once(r, 'p', k > 0.82)) { r.emit({ type: 'text', s: 'PTOO', x: 15, y: 10, vy: -2, life: 0.8, c: '#b7e3a8' }); for (let i = 0; i < 5; i++) r.emit({ type: 'dust', x: 24 + rand(-10, 10), y: GROUND, vx: rand(-8, 8), life: 0.5 }); }
      },
    },
  };

  Object.assign(root.PetSprite.MOTIONS, M);
})(window);

// ================= 6차 (2026-09-23 확정): 세트 전용 모션 =================
// 세트를 입고 있으면 '심심할 때'에 저절로 섞여 나온다 (main/shop.js 의 SET_MOTIONS). 스파이더냥·닌자 변신은 위쪽 원래 자리에 있다
(function (root) {
  const { rand, seg, bump, ease, GROUND } = root.PetSprite.util;
  const once = (r, tag, cond) => { if (cond && !r.ms[tag]) { r.ms[tag] = true; return true; } return false; };
  const every = (r, tag, at, period) => { const n = Math.floor(at / period); if (r.ms[tag] !== n) { r.ms[tag] = n; return true; } return false; };
  const txt = (r, s, x, y, c = '#fff', life = 0.8, vy = -3) => r.emit({ type: 'text', s, x, y, vy, life, c });
  const spr = (r, rows, x, y, map) => r.emit({ type: 'sprite', rows, x: Math.round(x), y: Math.round(y), map, perFrame: true, fade: false });
  const puffs = (r, x, y, n = 8, c = '#e9e4dc') => { for (let i = 0; i < n; i++) r.emit({ type: 'puff', x: x + rand(-8, 8), y: y + rand(-6, 4), vx: rand(-4, 4), vy: -4, life: 0.8, c }); };
  const dusts = (r, n = 5) => { for (let i = 0; i < n; i++) r.emit({ type: 'dust', x: 24 + rand(-10, 10), y: GROUND, vx: rand(-8, 8), life: 0.5 }); };
  const CHURU = ['KKKKKK', 'KOOYOK', 'KKKKKK'];
  const FISH = ['.KKKK.K.', 'KkBBBKBK', '.KKKK.K.'];
  const LEAF = ['.N', 'Nn'];
  const HEART = ['.X.X.', 'XXXXX', '.XXX.', '..X..'];
  const { tintUnder, flashCat } = root.PetSprite.motionFx;

  // 타원 구름 한 덩이 (연기·먼지)
  const blob = (r, cx, cy, rx, ry, c) => {
    const rows = [];
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) { let row = ''; for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) row += (x / rx) ** 2 + (y / ry) ** 2 <= 1 ? 'X' : '.'; rows.push(row); }
    spr(r, rows, cx - Math.ceil(rx), cy - Math.ceil(ry), { X: c });
  };
  root.PetSprite.motionBlob = blob; // 6차 상황별 모션도 같이 쓴다
  const M = {
    // ---------- 친절한 이웃 스파이더냥 ----------
    webhang: {
      // 천장에 거미줄 쏘고 → 발에 줄을 붙인 채 휙 뒤집혀 올라가 대롱대롱 → 줄을 놓고 빙그르 착지
      len: 6,
      pose(p, k, at, r) {
        const L = 14;
        let fx = 24, fy = GROUND, rot = 0;
        if (k < 0.12) { p.armL = p.armR = 'up'; p.eyes = 'wide'; }
        else if (k < 0.3) { const e = ease(seg(k, 0.12, 0.3)); rot = Math.PI * e; fy = GROUND - (GROUND - L) * e; p.eyes = 'closed'; }
        else if (k < 0.8) {
          const amp = 0.35 * Math.min(1, seg(k, 0.3, 0.42)) * (1 - seg(k, 0.7, 0.8));
          const th = Math.sin((at - 1.8) * 2.4) * amp;
          fx = 24 + L * Math.sin(th); fy = L * Math.cos(th); rot = Math.PI - th;
          p.eyes = 'happy'; p.armL = p.armR = 'float'; p.tail = 'up';
        } else if (k < 0.92) { const e = ease(seg(k, 0.8, 0.92)); rot = Math.PI * (1 + e); fy = L + (GROUND - L) * e * e; p.eyes = 'wide'; }
        else { p.xf = { sy: 0.9 + 0.1 * seg(k, 0.92, 1) }; p.armL = p.armR = 'cheer'; }
        if (k >= 0.12 && k < 0.92) { p.xf = { px: 24, py: GROUND, rot, ox: Math.round(fx - 24), oy: Math.round(fy - GROUND) }; p.noShadow = fy < GROUND - 4; }
        r.ms.fx = fx; r.ms.fy = fy;
      },
      step(r, k) {
        if (k < 0.12) { const t = seg(k, 0.02, 0.12); r.emit({ type: 'seg', x: 24, y: 30, x2: 24, y2: Math.round(30 - 30 * t), perFrame: true, fade: false }); }
        else if (k < 0.8) r.emit({ type: 'seg', x: 24, y: 0, x2: Math.round(r.ms.fx), y2: Math.round(r.ms.fy), perFrame: true, fade: false });
        if (once(r, 't', k > 0.02)) txt(r, 'THWIP', 14, 6);
        if (once(r, 'l', k > 0.92)) dusts(r);
      },
    },

    // ---------- 칼퇴 닌자 ----------
    bunshin: {
      // 분신술: 인 맺고 펑펑! 양옆에 분신이 하나씩 → 다시 펑펑 사라진다
      len: 4.4,
      pose(p, k) {
        p.armL = p.armR = 'cross';
        p.eyes = k < 0.2 ? 'closed' : 'open';
        p.brow = 'angry';
        p.tail = 'flick';
      },
      step(r, k, at) {
        if (once(r, 'a', k > 0.2)) { puffs(r, 7, 36); puffs(r, 41, 36); txt(r, 'POOF', 16, 8); }
        if (k > 0.24 && k < 0.78) { r.emit({ type: 'clone', dx: -17, a: 0.85, perFrame: true, fade: false }); r.emit({ type: 'clone', dx: 17, a: 0.85, perFrame: true, fade: false }); }
        if (once(r, 'b', k > 0.78)) { puffs(r, 7, 36); puffs(r, 41, 36); txt(r, 'POOF', 16, 8); }
      },
    },
    leafwarp: {
      // 나뭇잎 순간이동: 나뭇잎에 휩싸여 사라졌다가 옆에서 불쑥 나타나고, 원래 자리로 걸어 돌아온다
      len: 4.6, reveal: 0.38,
      pose(p, k, at) {
        const hidden = k > 0.3 && k < 0.48;
        if (k < 0.3) { p.armL = p.armR = 'cross'; p.eyes = 'closed'; }
        if (hidden) { p.xf = { sx: 0.01, sy: 0.01 }; p.noShadow = true; }
        else if (k >= 0.48 && k < 0.68) { p.xf = { ox: 13 }; p.eyes = 'open'; p.brow = 'angry'; p.armR = 'point'; }
        else if (k >= 0.68) { p.xf = { ox: Math.round(13 * (1 - ease(seg(k, 0.68, 1)))), flipX: true }; p.step = (at * 1.4) % 1; p.eyes = 'happy'; }
      },
      step(r, k, at) {
        if (k < 0.42) for (let i = 0; i < 6; i++) {
          const ang = at * 5 + i * 1.05;
          const rad = 10 + (k > 0.3 ? (k - 0.3) * 60 : 0);
          spr(r, LEAF, 24 + Math.cos(ang) * rad, 36 + Math.sin(ang) * rad * 0.5, { N: '#78c46a', n: '#4b8f43' });
        }
        if (once(r, 'a', k > 0.48)) for (let i = 0; i < 10; i++) r.emit({ type: 'sprite', rows: LEAF, x: 37 + rand(-6, 6), y: 36 + rand(-6, 4), vx: rand(-10, 10), vy: rand(-10, 2), ay: 12, life: 1, map: { N: '#78c46a', n: '#4b8f43' } });
      },
    },

    // ---------- 아이언냥 ----------
    ironflight: {
      // 손바닥에서 불을 뿜으며 로켓처럼 하늘로 슝 → 슈퍼히어로 착지
      len: 5,
      pose(p, k) {
        let oy = 0;
        if (k < 0.2) { p.armL = p.armR = 'out'; p.eyes = 'squint'; p.xf = { ox: Math.sin(k * 300) * 0.5 }; }
        else if (k < 0.5) { oy = -60 * ease(seg(k, 0.2, 0.5)); p.armL = p.armR = 'out'; }
        else if (k < 0.62) oy = -60;
        else if (k < 0.8) { oy = -60 * (1 - ease(seg(k, 0.62, 0.8))); p.armL = p.armR = 'up'; }
        else { p.xf = { sy: 0.85 + 0.15 * seg(k, 0.85, 1), sx: 1.1 - 0.1 * seg(k, 0.85, 1) }; p.armR = 'front'; p.brow = 'angry'; }
        if (oy) { p.xf = { oy: Math.round(oy) }; p.noShadow = oy < -10; }
      },
      back(g, a, k, at) {
        if (k > 0.8) return;
        const f = Math.floor(at * 20) % 2;
        for (const x of [a.left - 1, a.right + 1, a.hx - 3, a.hx + 3]) for (let j = 0; j < 3 + f; j++) this.px(x, (x === a.left - 1 || x === a.right + 1 ? a.cy + 2 : GROUND + 1) + j, j < 1 ? '#ffffff' : j < 2 ? '#7fe8ff' : '#ffb23c');
      },
      step(r, k) {
        if (once(r, 'w', k > 0.2)) txt(r, 'WHOOSH', 12, 8);
        if (once(r, 'l', k > 0.8)) { dusts(r, 8); txt(r, 'THUD', 16, 20); }
      },
    },
    repulsor: {
      // 리펄서 빔: 손바닥에 빛을 모았다가 PEW! 반동에 살짝 밀린다
      len: 3.2,
      pose(p, k) {
        p.armR = 'point';
        p.brow = 'angry';
        p.eyes = k > 0.45 && k < 0.6 ? 'squint' : 'open';
        if (k > 0.45 && k < 0.6) p.xf = { ox: -2 };
      },
      front(g, a, k) {
        if (k < 0.1 || k > 0.6) return;
        const s = Math.min(1, seg(k, 0.1, 0.45));
        this.ellipse(a.right + 4, a.cy - 1, 1 + s * 1.5, 1 + s * 1.5, '#dff6ff', '#7fe8ff');
      },
      step(r, k, at, dt, a) {
        if (k > 0.45 && k < 0.62) for (let x = r.scr(a.right + 6); x < 48 && x >= 0; x += r.facing) { r.emit({ type: 'light', x, y: a.cy - 1, c: 'rgba(127,232,255,0.6)', perFrame: true, fade: false }); }
        if (k > 0.45) flashCat(r, seg(k, 0.45, 0.52)); // 번쩍은 고양이만 (캔버스 전체 흰 네모 X)
        if (once(r, 'p', k > 0.45)) txt(r, 'PEW', 30, 16, '#bff6ff');
      },
    },

    // ---------- 지구 정복 포기한 외계 ----------
    ufoflyby: {
      // 우주선 타고 한 바퀴: 둥실 떠올라 화면을 빙 돌며 손 흔들고 사뿐 착지
      len: 5.2,
      pose(p, k, at) {
        const s = seg(k, 0.08, 0.88);
        if (k > 0.08 && k < 0.88) {
          const lift = Math.min(1, s * 5, (1 - s) * 5);
          p.xf = { ox: Math.round(Math.sin(s * Math.PI * 2) * 14), oy: Math.round(-(8 + 6 * Math.sin(s * Math.PI)) * lift), rot: Math.cos(s * Math.PI * 2) * 0.2 * lift };
          p.noShadow = lift > 0.3;
          p.armR = 'wave'; p.eyes = 'happy'; p.mouth = 'open';
        }
      },
      step(r, k, at) {
        if (k > 0.1 && k < 0.86 && every(r, 's', at, 0.08)) r.emit({ type: 'star', x: 24 + rand(-10, 10), y: 40, vy: 4, life: 0.5, c: ['#ff5aa8', '#ffe45a', '#7fe8ff'][Math.floor(rand(0, 3))] });
        if (once(r, 'w', k > 0.1)) txt(r, 'WHEE', 16, 8, '#b7e3a8');
      },
    },
    ufowarp: {
      // 워프: 불빛이 빨라지다 슝! 오른쪽 위로 사라졌다가 왼쪽 위에서 슝 날아와 흔들흔들 착지
      len: 4.6, reveal: 0.48,
      pose(p, k, at) {
        if (k < 0.3) { p.eyes = 'squint'; p.xf = { ox: Math.round(Math.sin(at * 40) * (k / 0.3)) }; }
        else if (k < 0.42) { const e = ease(seg(k, 0.3, 0.42)); p.xf = { ox: Math.round(30 * e), oy: Math.round(-30 * e), sx: 1 - 0.8 * e, sy: 1 - 0.8 * e }; p.noShadow = true; }
        else if (k < 0.56) { p.xf = { sx: 0.01, sy: 0.01 }; p.noShadow = true; }
        else if (k < 0.72) { const e = ease(seg(k, 0.56, 0.72)); p.xf = { ox: Math.round(-30 * (1 - e)), oy: Math.round(-30 * (1 - e)), sx: 0.2 + 0.8 * e, sy: 0.2 + 0.8 * e }; p.noShadow = e < 0.8; }
        else { p.xf = { rot: Math.sin(at * 12) * 0.15 * (1 - seg(k, 0.72, 1)) }; p.eyes = 'x'; }
      },
      step(r, k, at) {
        if (k > 0.3 && k < 0.44 && every(r, 'l', at, 0.03)) r.emit({ type: 'line', x: 24 + (k - 0.3) * 200 - 6, y: 40 - (k - 0.3) * 200, len: 6, life: 0.25, c: '#dff6ff' });
        if (once(r, 'z', k > 0.3)) txt(r, 'ZOOM', 16, 20, '#7fe8ff');
        if (k > 0.56 && k < 0.72 && every(r, 'm', at, 0.03)) r.emit({ type: 'line', x: 24 - (0.72 - k) * 190, y: 40 - (0.72 - k) * 190, len: 6, life: 0.25, c: '#dff6ff' });
      },
    },
    telekinesis: {
      // 초능력: 눈이 빛나며 물건들이 둥실 떠올라 빙글빙글. 집중이 풀리면 우르르 떨어진다
      len: 4.6,
      pose(p, k) {
        const on = k > 0.1 && k < 0.8;
        p.eyes = on ? 'sparkle' : k >= 0.8 ? 'x' : 'open';
        p.armL = p.armR = on ? 'up' : 'rest';
        p.brow = on ? 'angry' : null;
        if (k >= 0.8) p.sweat = true;
      },
      step(r, k, at) {
        const objs = [[FISH, { K: '#2b1a10', k: '#2b1a10', B: '#6fb0ea' }], [['KKK', 'KWK', 'KKK'], { K: '#2b1a10', W: '#fffaf3' }], [['.YY.', 'YyyY', '.YY.'], { Y: '#ffd65a', y: '#d9a21f' }]];
        objs.forEach(([rows, map], i) => {
          let x, y;
          const gx = [6, 38, 43][i]; // 바닥 자리: 고양이 발 위에 겹치지 않게 양옆으로
          if (k < 0.1) { x = gx; y = GROUND - 3; }
          else if (k < 0.8) { const ang = at * 2 + i * 2.1; const up = ease(seg(k, 0.1, 0.3)); x = 24 + Math.cos(ang) * 14 * up + (gx - 24) * (1 - up); y = GROUND - 3 - up * (18 + Math.sin(ang) * 4); }
          else { x = gx; y = GROUND - 3 - 20 * (1 - seg(k, 0.8, 0.88) ** 2); }
          spr(r, rows, x - 2, y, map);
        });
        if (k > 0.1 && k < 0.8 && every(r, 's', at, 0.15)) r.emit({ type: 'star', x: 24 + rand(-16, 16), y: 20 + rand(-6, 6), c: '#c0a0ff', life: 0.5 });
        if (once(r, 'd', k > 0.88)) { dusts(r); txt(r, 'CLANG', 14, 18); }
      },
    },

    // ---------- 꿀 빠는 꿀벌 ----------
    honeypot: {
      // 꿀통에 빨대 꽂고 쪽쪽: 꿀이 줄어들수록 볼이 발그레
      len: 4.4, loop: true,
      pose(p, k) { p.mouth = 'kiss'; p.eyes = 'happy'; p.blush = k > 0.4; p.lookX = 1; p.lookY = 1; },
      front(g, a, k) {
        const x = a.right + 1, y = GROUND - 7;
        const lvl = Math.round(3 * (1 - k));
        const rows = ['.KKKKK.', 'KtttttK', 'KYYYYYK', 'KYYYYYK', 'KYYYYYK', 'KYYYYYK', '.KKKKK.'].map((row, j) => (j >= 2 && j < 5 - lvl ? row.replace(/Y/g, 'y') : row));
        this.pattern(rows, x, y, { K: '#6b3f1a', t: '#b8783a', Y: '#ffc83a', y: '#ffe8a0' });
        // 빨대: 꿀통 → 입
        const x0 = x + 3, y0 = y, x1 = a.fx + 1, y1 = a.my + 1;
        for (let i = 0; i <= 10; i++) this.px(Math.round(x0 + ((x1 - x0) * i) / 10), Math.round(y0 + ((y1 - y0) * i) / 10), i % 3 ? '#ff5aa8' : '#ffffff');
      },
      step(r, k, at) { if (every(r, 'h', at, 0.8)) r.emit({ type: 'heart', x: 22 + rand(-4, 4), y: 28, vy: -6, life: 1 }); },
    },
    waggle: {
      // 8자 춤: 꿀벌끼리 길 알려 주는 엉덩이 춤. 부웅부웅
      len: 3.6, loop: true,
      pose(p, k, at) {
        const th = k * Math.PI * 2;
        p.xf = { ox: Math.round(Math.sin(th * 2) * 4), oy: Math.round(Math.sin(th) * 2), rot: Math.sin(at * 18) * 0.06 }; // 엉덩이 부르르 (크게 돌리면 도트가 깨져서 살짝만)
        p.eyes = 'happy';
        p.tail = 'wag';
        p.mouth = 'open';
      },
      step(r, k, at) { if (every(r, 'b', at, 0.6)) txt(r, 'BZZ', 28 + rand(-2, 2), 18, '#ffd65a', 0.6); },
    },

    // ---------- 야옹나라 냥냥공주 ----------
    heartbeam: {
      // 요술봉 하트 빔: 윙크하며 손끝에서 하트가 줄줄이 날아간다
      len: 3.6,
      pose(p, k) { p.armR = 'point'; p.eyes = 'wink'; p.mouth = 'kiss'; p.blush = true; },
      step(r, k, at, dt, a) {
        if (k > 0.15 && k < 0.75 && every(r, 'h', at, 0.12)) r.emit({ type: 'heart', x: r.scr(a.right + 4), y: a.cy - 3, vx: r.facing * 26, vy: rand(-2, 2), life: 1, c: '#ff5aa8' });
        if (k > 0.15 && k < 0.75 && every(r, 's', at, 0.2)) r.emit({ type: 'star', x: r.scr(a.right + 6), y: a.cy - 1 + rand(-3, 3), vx: r.facing * 20, life: 0.8, c: '#fff6a0' });
      },
    },
    starcall: {
      // 별똥별 소환: 두 손을 모아 빌면 반짝이는 별이 꼬리를 끌며 떨어진다
      len: 4.4,
      pose(p, k) {
        if (k < 0.5) { p.armL = p.armR = 'cross'; p.eyes = 'closed'; }
        else { p.armL = p.armR = 'cheer'; p.eyes = 'star'; p.mouth = 'open'; }
      },
      step(r, k, at) {
        const t = seg(k, 0.3, 0.6);
        if (t > 0 && t < 1) {
          const x = 44 - 20 * t, y = 2 + 26 * t;
          spr(r, ['..Y..', '.YYY.', 'YYWYY', '.YYY.', '.Y.Y.'], x - 2, y - 2, { Y: '#ffd65a', W: '#ffffff' });
          r.emit({ type: 'ember', x: x + 3, y: y - 3, vx: 4, vy: -2, life: 0.5 });
        }
        if (once(r, 'b', k > 0.6)) for (let i = 0; i < 12; i++) r.emit({ type: 'star', x: 24 + rand(-3, 3), y: 28, vx: rand(-16, 16), vy: rand(-16, 6), life: 1, c: '#fff6a0' });
      },
    },



    // ---------- K팝 악마 사냥꾼 ----------
    namebook: {
      // 명부를 펼쳐 이름을 훑다가… 찾았다!
      len: 4,
      pose(p, k, at) { p.armL = p.armR = 'hold'; p.lookY = 1; p.lookX = k < 0.6 ? Math.sin(at * 3) * 0.6 : 0; if (k > 0.65) { p.eyes = 'wide'; p.lookY = 0; } },
      front(g, a) { this.pattern(['KKKKKKKKK', 'KWWWKWWWK', 'KWkWKWkWK', 'KWWWKWWWK', 'KKKKKKKKK'], a.hx - 4, a.my + 1, { K: '#2b1a10', W: '#f2ead8', k: '#6a6a72' }); },
      step(r, k) { if (once(r, 'f', k > 0.65)) txt(r, 'FOUND', 15, 14, '#dff0ff'); },
    },
    kpopdance: {
      // 칼군무: 박자마다 딱딱 끊어지는 포즈, 알록달록 조명이 번쩍
      len: 4, loop: true,
      pose(p, k, at) {
        const beat = Math.floor(at * 4) % 4;
        const poses = [['up', 'rest'], ['point', 'point'], ['cross', 'cross'], ['rest', 'up']];
        [p.armL, p.armR] = poses[beat];
        p.xf = { ox: [-2, 2, 0, 0][beat], oy: beat === 2 ? -2 : 0 };
        p.eyes = beat === 2 ? 'wink' : 'open';
        p.brow = 'angry';
        p.tail = 'flick';
      },
      step(r, k, at) {
        const c = ['rgba(255,90,168,0.25)', 'rgba(127,232,255,0.25)', 'rgba(255,214,90,0.25)', 'rgba(192,160,255,0.25)'][Math.floor(at * 4) % 4];
        tintUnder(r, c, 1); // 조명은 고양이에만 (음표는 물들이지 않게)
        if (every(r, 'n', at, 0.5)) r.emit({ type: 'note', x: 24 + rand(-14, 14), y: 20, vy: -6, life: 1, c: '#fff' });
      },
    },

    // ---------- 테슬라 애완전투 고양이 ----------
    recharge: {
      // 충전: 꼬리 대신 플러그를 꽂고 눈을 감으면 배터리가 한 칸씩 차오른다
      len: 5,
      pose(p, k) { p.eyes = k < 0.85 ? 'closed' : 'star'; p.mouth = k < 0.85 ? 'flat' : 'open'; },
      step(r, k, at, dt, a) {
        r.emit({ type: 'seg', x: r.scr(a.left - 1), y: a.cy + 3, x2: r.scr(a.left - 8), y2: GROUND, perFrame: true, fade: false, c: '#454b57' });
        const n = Math.min(4, Math.floor(seg(k, 0.1, 0.85) * 5));
        spr(r, ['KKKKKKK.', 'K' + 'G'.repeat(n) + '.'.repeat(4 - n) + 'KK', 'K' + 'G'.repeat(n) + '.'.repeat(4 - n) + 'KK', 'KKKKKKK.'].map((row) => row.replace(/\./g, '.')), 20, 20, { K: '#dfe5ee', G: '#7dff9a' });
        if (once(r, 'f', k > 0.85)) txt(r, 'FULL', 17, 12, '#7dff9a');
      },
    },
    rocketpunch: {
      // 로켓 펀치: 주먹이 불꽃을 달고 슝 날아갔다가 부메랑처럼 돌아온다
      len: 3.6,
      pose(p, k) { p.armR = k < 0.2 ? 'point' : 'rest'; p.brow = 'angry'; p.eyes = k > 0.2 && k < 0.8 ? 'squint' : 'open'; },
      step(r, k, at, dt, a) {
        const out = k < 0.5 ? ease(seg(k, 0.2, 0.5)) : 1 - ease(seg(k, 0.55, 0.85));
        if (k > 0.2 && k < 0.85) {
          const x = r.scr(a.right + 2) + r.facing * out * 11; // 화면 밖으로 사라지지 않을 만큼만 날아간다
          spr(r, ['KKKK.', 'KggKK', 'KggKK', 'KKKK.'], x - 2, a.cy - 2, { K: '#454b57', g: '#c3ccd6' });
          r.emit({ type: 'ember', x: x - r.facing * 3, y: a.cy, vx: -r.facing * 10, life: 0.3 });
        }
        if (once(r, 'p', k > 0.22)) txt(r, 'PUNCH!', 16, 12, '#ffd65a');
        if (once(r, 'hit', k > 0.5)) for (let i = 0; i < 5; i++) r.emit({ type: 'spark', x: r.scr(a.right + 15), y: a.cy + rand(-3, 3), vx: r.facing * rand(4, 14), vy: rand(-10, 4), life: 0.35 });
        if (once(r, 'back', k > 0.85)) r.emit({ type: 'text', s: 'CLICK', x: r.scr(a.right) - 6, y: a.cy - 12, vy: -3, life: 0.6, c: '#c3ccd6' });
      },
    },
    reboot: {
      // 에러! 머리에서 연기, 화면이 까매졌다가 BOOT 하고 다시 켜진다
      len: 5, reveal: 0.48,
      pose(p, k, at) {
        if (k < 0.35) { p.eyes = 'x'; p.xf = { ox: Math.round(Math.sin(at * 60)) }; p.sweat = true; }
        else if (k < 0.6) { p.eyes = 'none'; p.mouth = 'none'; }
        else { p.eyes = k < 0.7 ? 'half' : 'open'; }
      },
      step(r, k, at) {
        if (once(r, 'e', k > 0.05)) txt(r, 'ERROR', 14, 14, '#ff5a5a', 1.2, -1);
        if (k < 0.35 && every(r, 's', at, 0.12)) r.emit({ type: 'puff', x: 24 + rand(-4, 4), y: 28, vy: -8, life: 0.8, c: '#9aa0a8' });
        if (k > 0.35 && k < 0.6) tintUnder(r, '#101418', 0.8);
        if (once(r, 'b', k > 0.6)) txt(r, 'BOOT', 17, 14, '#7dff9a', 1, -1);
      },
    },

  };

  Object.assign(root.PetSprite.MOTIONS, M);
})(window);

// ================= 6차 (2026-09-23 확정): 상황별 새 모션 =================
(function (root) {
  const { rand, seg, bump, ease, GROUND } = root.PetSprite.util;
  const once = (r, tag, cond) => { if (cond && !r.ms[tag]) { r.ms[tag] = true; return true; } return false; };
  const every = (r, tag, at, period) => { const n = Math.floor(at / period); if (r.ms[tag] !== n) { r.ms[tag] = n; return true; } return false; };
  const txt = (r, s, x, y, c = '#fff', life = 0.8, vy = -3) => r.emit({ type: 'text', s, x, y, vy, life, c });
  const spr = (r, rows, x, y, map) => r.emit({ type: 'sprite', rows, x: Math.round(x), y: Math.round(y), map, perFrame: true, fade: false });
  const dusts = (r, n = 5) => { for (let i = 0; i < n; i++) r.emit({ type: 'dust', x: 24 + rand(-10, 10), y: GROUND, vx: rand(-8, 8), life: 0.5 }); };
  const desk = (p, fast) => { p.prop = 'laptop'; p.armL = p.armR = fast ? 'typefast' : 'type'; p.dy = -3; p.mouth = 'flat'; };
  const CONF = ['#ff6f91', '#ffd35c', '#6fb0ea', '#78c46a', '#b784f5', '#ff9a3c'];
  // 생각 풍선 (머리 위 오른쪽) + 안에 든 그림
  const BUBBLE = ['..KKKKKKK..', '.KWWWWWWWK.', 'KWWWWWWWWWK', 'KWWWWWWWWWK', 'KWWWWWWWWWK', '.KWWWWWWWK.', '..KKKKKKK..'];
  const thought = (r, rows, map) => {
    spr(r, BUBBLE, 28, 12, { K: '#2b1a10', W: '#ffffff' });
    spr(r, ['K'], 29, 21, { K: '#2b1a10' });
    spr(r, ['K'], 27, 23, { K: '#2b1a10' });
    spr(r, rows, 33 - (rows[0].length >> 1), 15 - (rows.length >> 1) + 1, map);
  };
  const FISHT = { rows: ['.KKK.K', 'KBBBKB', '.KKK.K'], map: { K: '#2b1a10', B: '#6fb0ea' } };
  const MUGT = { rows: ['.s.s.', 'KWWWK', 'KWCWKK', 'KWWWK'], map: { K: '#2b1a10', W: '#fffaf3', C: '#8a5a32', s: '#c8ced6' } };
  const STEAKT = { rows: ['.KKKKK.', 'KRRWRRK', 'KrRRRrK', '.KKKKK.'], map: { K: '#2b1a10', R: '#c8403a', r: '#8a2a20', W: '#fffaf3' } };
  const TOMB = ['..KKKKK..', '.KGGGGGK.', 'KGGgGgGGK', 'KGGGgGGGK', 'KGGgGgGGK', 'KGGGGGGGK', 'KGGGGGGGK', 'KKKKKKKKK'];

  const blob = (r, cx, cy, rx, ry, c) => root.PetSprite.motionBlob(r, cx, cy, rx, ry, c);
  const { limb, tintUnder, flashCat } = root.PetSprite.motionFx;
  // 줄넘기 줄: 두 앞발 사이로 둥글게. ph 0 = 발밑(바닥), 0.5 = 머리 위
  function ropeArc(a, ph) {
    const hy = a.my + 1, L = a.hx - 6, R = a.hx + 6;
    const ym = (GROUND + 1 + (a.top - 9)) / 2 + Math.cos(ph * Math.PI * 2) * (GROUND + 1 - (a.top - 9)) / 2;
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const t = i / n, b = Math.sin(Math.PI * t);
      this.px(Math.round(L + (R - L) * t + b * (2 * t - 1)), Math.round(hy + (ym - hy) * b), '#e8534a');
    }
  }
  // 가로 w 칸짜리 노트북 (멀리 날아갈수록 작아진다)
  const laptopRows = (w) => { const h = Math.max(1, Math.round(w * 0.5)); return Array.from({ length: h }, (_, j) => (j === 0 || j === h - 1 || w < 4 ? 'K'.repeat(w) : 'K' + 'g'.repeat(w - 2) + 'K')); };
  const M = {
    // ---------- 15분·1시간 넘게 일할 때 ----------
    giantfist: {
      // 거대 주먹: 타자 치다 열받아서… 앞발이 뿅 커지더니 번쩍 치켜들어 노트북 모서리를 쾅! 쾅! 쾅!
      // (7차: 커다란 주먹이 얼굴을 통째로 가리던 걸, 어깨에서 뻗은 앞발이 옆쪽 노트북 모서리를 내리치게.
      //  털색을 따라가고, 내리칠 때마다 몸이 들썩)
      len: 5.4,
      pose(p, k, at) {
        desk(p, k < 0.4);
        if (k > 0.2) p.brow = 'angry';
        if (k > 0.3 && k < 0.4) p.sweat = true;
        if (k >= 0.4) {
          p.armL = 'type'; p.armR = 'rest'; p.eyes = 'squint'; p.mouth = 'big'; p.ear = -1; p.tail = 'flick';
          const ph = (at * 3) % 1;
          if (k > 0.5 && ph > 0.7 && ph < 0.82) p.xf = { sx: 1.04, sy: 0.96 }; // 쾅 — 반동에 몸이 눌린다
          else p.xf = { ox: 0 };
        }
        if (k > 0.92) { p.eyes = 'happy'; p.mouth = 'smile'; p.brow = null; p.ear = 0; p.armL = p.armR = 'type'; }
      },
      front(g, a, k, at) {
        if (k < 0.4 || k > 0.92) return;
        const grow = ease(seg(k, 0.4, 0.5));
        const ph = (at * 3) % 1;
        // 치켜들기(0~0.5) → 멈칫(0.5~0.6) → 내리꽂기(0.6~0.7) → 박힌 채(0.7~1)
        const hitY = GROUND - 5, highY = a.top - 6;
        let y;
        if (k < 0.5) y = a.cy + (highY - a.cy) * grow;
        else if (ph < 0.5) y = hitY + (highY - hitY) * ease(ph / 0.5);
        else if (ph < 0.6) y = highY;
        else if (ph < 0.7) y = highY + (hitY - highY) * ((ph - 0.6) / 0.1) ** 2;
        else y = hitY;
        const x = a.right + 3; // 노트북 오른쪽 모서리
        limb.call(this, g, a.right - 2, a.cy - 1, x - 1, y);
        const O = g.c.outline, B = g.c.body, P = '#ff9bb8';
        const rows = grow > 0.5
          ? ['..KKKKK..', '.KBBBBBK.', 'KBBBBBBBK', 'KBBBBBBBK', 'KBPBPBPBK', 'KBBBBBBBK', 'KBBPPPBBK', '.KBBBBBK.', '..KKKKK..']
          : ['.KKK.', 'KBBBK', 'KBPBK', '.KKK.'];
        this.pattern(rows, Math.round(x - (rows[0].length >> 1)), Math.round(y - rows.length + 2), { K: O, B, P });
      },
      step(r, k, at, dt, a) {
        if (k < 0.5 || k > 0.92) return;
        const n = Math.floor(at * 3);
        const ph = (at * 3) % 1;
        if (ph > 0.7 && once(r, 'b' + n, true)) {
          const x = r.scr(a.right + 3);
          txt(r, ['BANG', 'BONK', 'SMASH'][n % 3], x - 8 + rand(-2, 2), a.top - 12, '#ffd65a', 0.4);
          for (let i = 0; i < 3; i++) r.emit({ type: 'dust', x: x + rand(-4, 4), y: GROUND, vx: rand(-10, 10), life: 0.4 });
          for (let i = 0; i < 3; i++) r.emit({ type: 'spark', x: x + rand(-5, 5), y: GROUND - 4, vx: rand(-16, 16), vy: -12, ay: 40, life: 0.35 });
        }
      },
    },

    // ---------- 허락을 기다릴 때 ----------

    // ---------- 답이 끝났을 때 ----------
    trophy: {
      // 트로피 번쩍: 살짝 웅크렸다가 금빛 트로피를 두 앞발로 머리 위까지 번쩍! 들어 올린 채 통통 뛰며 반짝반짝
      // (7차: 트로피가 머리 위에 혼자 떠 있던 걸, 두 앞발이 받침을 쥐고 들어 올리게)
      len: 3.6,
      pose(p, k, at) {
        p.armL = p.armR = 'lift';
        const up = ease(seg(k, 0.08, 0.26));
        p.liftUp = up + (k > 0.3 ? Math.round(Math.abs(Math.sin(at * 6))) * 0.25 : 0);
        p.eyes = k < 0.08 ? 'closed' : 'star'; p.mouth = k < 0.08 ? 'flat' : 'open'; p.tail = 'up'; p.ear = 1;
        if (k < 0.08) p.xf = { sx: 1.06, sy: 0.94 }; // 영차 — 들기 전에 살짝 웅크린다
        else if (k > 0.3 && k < 0.9) p.dy = -Math.round(Math.abs(Math.sin(at * 6)));
        p.blush = k > 0.3;
      },
      front(g, a, k, at) {
        const p = this._p || {};
        const pawY = Math.round(a.top - 1 - (p.liftUp || 0) * 4);
        this.pattern(['KKKKKKKKK', 'KYKYYHKYK', 'KKKYYYKKK', '..KYYYK..', '...KYK...', '...KYK...', '..KKKKK..', '..KyyyK..', '..KKKKK..'], a.hx - 4, pawY - 8, { K: '#2b1a10', Y: '#ffd65a', y: '#d9a21f', H: '#fff6c0' });
      },
      step(r, k, at, dt, a) {
        if (k > 0.26 && every(r, 's', at, 0.2)) r.emit({ type: 'spark', x: r.scr(a.hx + rand(-7, 7)), y: a.top - 14 + rand(-4, 4), life: 0.4 });
        if (once(r, 't', k > 0.26)) { txt(r, 'NO.1', 17, 3, '#ffd65a', 1.4, -1); for (let i = 0; i < 8; i++) r.emit({ type: 'star', x: r.scr(a.hx), y: a.top - 14, vx: rand(-16, 16), vy: rand(-14, 2), life: 0.6 }); }
      },
    },

    // ---------- 쉬자고 할 때 ----------
    laptoptoss: {
      // 노트북 날려 버리기: 번쩍 들어 머리 위로 → 뒤로 젖혔다가 휙! 노트북이 점점 작아지며 날아가다 뿅. 손 탁탁 털고 개운
      len: 4.8,
      pose(p, k) {
        if (k < 0.18) { desk(p); p.brow = 'angry'; }
        // 회전을 크게 걸면 도트가 깨져서, 젖히기·던지기는 몸을 늘이고 옆으로 옮기는 걸로 (7차)
        else if (k < 0.3) { const e = ease(seg(k, 0.18, 0.3)); p.armL = p.armR = 'up'; p.brow = 'angry'; p.eyes = 'squint'; p.xf = { ox: Math.round(2 * e), sy: 1 + 0.06 * e, sx: 1 - 0.03 * e }; }
        else if (k < 0.38) { const e = ease(seg(k, 0.3, 0.38)); p.armL = p.armR = 'up'; p.xf = { ox: Math.round(2 - 4 * e), sy: 1.06 - 0.12 * e, sx: 0.97 + 0.08 * e }; p.mouth = 'big'; p.brow = 'angry'; }
        else if (k < 0.8) { const e = ease(seg(k, 0.38, 0.5)); p.armL = p.armR = 'front'; p.lookX = -1; p.lookY = -1; p.eyes = 'wide'; p.mouth = 'o'; p.xf = { ox: Math.round(-2 * (1 - e)), sy: 0.94 + 0.06 * e, sx: 1.05 - 0.05 * e }; }
        else { p.armL = p.armR = 'clap'; p.eyes = 'happy'; p.mouth = 'open'; p.tail = 'wag'; }
      },
      step(r, k, at) {
        if (k >= 0.18 && k < 0.38) {
          const t = ease(seg(k, 0.18, 0.28));
          spr(r, laptopRows(9), 20, Math.round(37 - 14 * t), { K: '#23262e', g: '#5a6270' });
        }
        const t = seg(k, 0.38, 0.8);
        if (t > 0 && t < 1) {
          const w = Math.max(1, Math.round(9 - 8 * t));
          const x = 24 - 18 * t, y = 23 - 16 * Math.sin(t * Math.PI * 0.75);
          spr(r, laptopRows(w), x - (w >> 1), y, { K: '#23262e', g: '#5a6270' });
          if (every(r, 'l', at, 0.06)) r.emit({ type: 'line', x: x + 2, y: y + 1, len: 2, life: 0.2, c: 'rgba(255,255,255,0.7)' });
        }
        if (once(r, 'p', k > 0.8)) { r.emit({ type: 'spark', x: 6, y: 10, life: 0.5 }); txt(r, 'POP', 2, 14, '#fff', 0.7); }
      },
    },

    // ---------- 코스튬 입을 때 ----------
    smokereveal: {
      // 연기 펑: 발밑에서 연기가 뭉게뭉게 차올라 고양이를 통째로 덮었다가, 부드럽게 걷히며 새 코스튬으로 짠.
      // 군장·큰 날개·우주선처럼 부피가 큰 코스튬도 가리도록 화면을 거의 꽉 채운다
      len: 3.8, reveal: 0.36,
      pose(p, k) { if (k > 0.6) { p.armL = p.armR = 'cheer'; p.eyes = 'star'; p.mouth = 'open'; } },
      step(r, k, at) {
        // 차오름(0~0.24) → 덮음(0.24~0.5, 이 사이에 갈아입는다) → 걷힘(0.5~0.78)
        const cover = k < 0.24 ? ease(seg(k, 0.02, 0.24)) : k < 0.5 ? 1 : 1 - ease(seg(k, 0.5, 0.78));
        if (cover > 0) {
          const w1 = Math.sin(at * 9) * 0.9;
          const w2 = Math.cos(at * 7) * 0.9;
          const A = 'rgba(236,232,224,0.97)';
          const B = 'rgba(246,244,238,0.97)';
          // 바닥에서부터 뭉게뭉게 — 아래가 넓고 위로 갈수록 작은 덩이들이 얹힌다
          blob(r, 24, GROUND - 1 + 6 * (1 - cover), 25 * cover + w1, 11 * cover, A);
          blob(r, 24, GROUND - 13 * cover, 22 * cover - w2, 14 * cover, A);
          blob(r, 10, GROUND - 15 * cover, 12 * cover + w2, 10 * cover, B);
          blob(r, 38, GROUND - 14 * cover, 12 * cover - w1, 10 * cover, B);
          blob(r, 24, GROUND - 27 * cover, 17 * cover + w1, 10 * cover, B);
          blob(r, 16, GROUND - 34 * cover, 8 * cover - w2, 6 * cover, B);
          blob(r, 33, GROUND - 33 * cover, 7 * cover + w2, 6 * cover, B);
        }
        // 차오를 때도, 걷힐 때도 연기가 뭉클뭉클 새어 나온다
        if (k < 0.24 && every(r, 'u', at, 0.06)) r.emit({ type: 'puff', x: 24 + rand(-16, 16), y: GROUND - rand(0, 8), vx: rand(-10, 10), vy: -10, life: 0.8, c: '#ece8e0' });
        if (k > 0.5 && k < 0.8 && every(r, 'p', at, 0.04)) r.emit({ type: 'puff', x: 24 + rand(-18, 18), y: 30 + rand(-14, 10), vx: rand(-20, 20), vy: -5, life: 0.8, c: '#ece8e0' });
        if (once(r, 'b', k > 0.12)) txt(r, 'POOF', 16, 8);
        if (once(r, 's', k > 0.6)) for (let i = 0; i < 10; i++) r.emit({ type: 'spark', x: 24 + rand(-14, 14), y: 32 + rand(-10, 8), life: 0.6 });
      },
    },
    curtainreveal: {
      // 무대 커튼: 빨간 커튼이 촥! 닫혀 고양이를 가렸다가 촥! 열리면 새 코스튬으로 짠.
      // 커튼은 봉부터 바닥까지 — 키 큰 모자·날개가 커튼 위로 삐져나오지 않게 한다
      len: 3.2, reveal: 0.24,
      pose(p, k) { if (k > 0.45) { p.armL = p.armR = 'cheer'; p.eyes = 'star'; p.mouth = 'open'; } },
      step(r, k) {
        // 닫힘(0~0.1) → 가림(0.1~0.38, 이 사이에 갈아입는다) → 열림(0.38~0.48)
        const close = k < 0.1 ? ease(seg(k, 0, 0.1)) : k < 0.38 ? 1 : 1 - ease(seg(k, 0.38, 0.48));
        const w = Math.round(close * 22);
        if (w > 0) {
          const panel = (flip) => Array.from({ length: GROUND - 1 }, (_, j) => Array.from({ length: w }, (_, i) => { const x = flip ? w - 1 - i : i; return x === w - 1 ? 'k' : (x + j) % 4 === 0 ? 'r' : 'R'; }).join(''));
          spr(r, panel(false), 2, 3, { R: '#c8242c', r: '#8a1a22', k: '#5a0a12' });
          spr(r, panel(true), 46 - w, 3, { R: '#c8242c', r: '#8a1a22', k: '#5a0a12' });
        }
        spr(r, ['Y'.repeat(44), 'y'.repeat(44)], 2, 1, { Y: '#e8b83a', y: '#b8862a' });
        if (once(r, 't', k > 0.48)) { txt(r, 'TA-DA', 14, 14, '#ffd65a', 1); for (let i = 0; i < 12; i++) r.emit({ type: 'confetti', x: 24 + rand(-12, 12), y: rand(10, 18), vx: rand(-6, 6), vy: 2, ay: 12, life: 1.5, c: CONF[i % 6] }); }
      },
    },

    // ---------- 배고플 때 ----------
    fishthink: {
      // 생선 상상하기: 머릿속 생선이 파닥파닥, 침 꼴깍, 꼬리 살랑
      len: 4, loop: true,
      pose(p, k) { p.eyes = 'half'; p.mouth = 'open'; p.lookY = -1; p.lookX = 1; p.tail = 'wag'; p.blush = true; },
      step(r, k, at) {
        const flap = Math.floor(at * 4) % 2;
        thought(r, flap ? FISHT.rows : ['.KKKK.', 'KBBBKB', '.KKKK.'], FISHT.map);
        if (every(r, 'd', at, 1.4)) r.emit({ type: 'drop', x: 25, y: 41, vy: 6, life: 0.6 });
      },
    },

    // ---------- 심심할 때 ----------
    drums: {
      // 드럼: 고양이 양옆에 하이햇·스네어(왼쪽), 베이스 드럼·크래시 심벌(오른쪽). 스틱으로 두둥탁, 심벌이 찰랑
      len: 3.2, loop: true,
      pose(p, k, at) { const b = Math.floor(at * 6) % 2; p.armL = b ? 'up' : 'front'; p.armR = b ? 'front' : 'up'; p.eyes = 'happy'; p.mouth = 'open'; p.dy = -Math.round(Math.abs(Math.sin(at * 6))); },
      front(g, a, k, at) {
        const b = Math.floor(at * 6) % 2;
        const M = { K: '#2b1a10', W: '#f2ead8', R: '#c8242c', r: '#8a1a22', g: '#c3ccd6', Y: '#ffd65a', y: '#d9a21f', s: '#8e9aaa' };
        // 하이햇 (왼쪽 위) + 스탠드
        for (let y = 27; y <= GROUND; y++) this.px(4, y, '#454b57');
        this.pattern(['YYYYYYY', '.yyyyy.', b ? '.YYYYY.' : 'YYYYYYY'], 1, 24 + (b ? 1 : 0), M);
        // 스네어 (왼쪽) + 삼각 스탠드
        this.pattern(['KKKKKKKKK', 'KgWWWWWgK', 'KRRRRRRRK', 'KgRRRRRgK', 'KKKKKKKKK', '....s....', '....s....', '....s....', '...s.s...', '..s...s..', '.s.....s.', 's.......s'], 5, 33, M);
        // 크래시 심벌 (오른쪽 위, 비스듬히) + 스탠드
        for (let y = 26; y <= 33; y++) this.px(41, y, '#454b57');
        this.pattern(b ? ['...YYYYYY', '.YYYYYYYY', 'yyyyyy...'] : ['..YYYYYYY', 'YYYYYYYYy', '.yyyyy...'], 35, 22 + (b ? 0 : 1), M);
        // 베이스 드럼 (오른쪽 아래): 흰 앞면에 빨간 테와 로고, 크롬 러그
        this.pattern(['...KKKKKKK...', '.KKgWWWWWgKK.', 'KWWWWWWWWWWWK', 'KgWWRRRRRWWgK', 'KWWRKKKKKRWWK', 'KWWRKWWWKRWWK', 'KWWRKKKKKRWWK', 'KgWWRRRRRWWgK', 'KWWWWWWWWWWWK', '.KKgWWWWWgKK.', '..s.KKKKK.s..'], 32, 34, M);
        // 스틱 (앞발 → 스네어 / 심벌)
        const L = b ? [[a.left, a.cy - 1], [12, 31]] : [[a.left, a.cy + 1], [11, 34]];
        const R = b ? [[a.right, a.cy + 1], [34, 27]] : [[a.right, a.cy - 1], [35, 23]];
        const STICK = 9;
        for (const [[x0, y0], [tx, ty]] of [L, R]) {
          const d = Math.hypot(tx - x0, ty - y0) || 1;
          const x1 = x0 + ((tx - x0) / d) * STICK, y1 = y0 + ((ty - y0) / d) * STICK;
          const n = STICK * 2;
          for (let i = 0; i <= n; i++) {
            const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
            this.px(x, y, i > n - 3 ? '#fff6d8' : '#c48b56');
            if (i < n - 2) this.px(x, y + 1, '#8a5a32');
          }
          // 스틱을 쥔 앞발
          this.pattern(['.OO.', 'OBBO', '.OO.'], x0 - 2, y0 - 1, { O: g.c.outline, B: g.c.body });
        }
      },
      step(r, k, at) {
        if (every(r, 'n', at, 1 / 3)) r.emit({ type: 'note', x: 24 + rand(-14, 14), y: 16, vy: -6, life: 1 });
        if (Math.floor(at * 6) % 2 && every(r, 'c', at, 1 / 3)) r.emit({ type: 'spark', x: 40, y: 23, life: 0.2 });
      },
    },
    piano: {
      // 피아노: 의자에 앉아 건반 위로 앞발을 콩콩. 건반은 고양이 아래라 가리지 않는다. 음표가 둥실
      len: 3.4, loop: true,
      pose(p, k, at) { p.armL = p.armR = 'front'; p.eyes = 'closed'; p.mouth = 'smile'; p.tail = 'slow'; p.dy = -5; p.lookX = Math.sin(at * 2) * 0.5; },
      back() {
        // 의자
        this.pattern(['KKKKKKKKKKK', 'KtttttttttK', 'KKKKKKKKKKK', '.K.......K.', '.K.......K.', '.K.......K.'], 19, 38, { K: '#2b1a10', t: '#8a5a32' });
      },
      front(g, a, k, at) {
        const M = { K: '#15151a', k: '#34343e', W: '#fffaf3', b: '#2b1a10', L: '#7dff9a', R: '#ff5a5a', g: '#8a8a94' };
        // 키보드 본체 + 건반 + 스탠드
        this.pattern(['KKKKKKKKKKKKKKKKKKKKKKK', 'KkLkRkkgkgkgkgkkkkkkkkK', 'KWbWbWWbWbWbWWbWbWWbWbK', 'KWbWbWWbWbWbWWbWbWWbWbK', 'KWWWWWWWWWWWWWWWWWWWWWK', 'KKKKKKKKKKKKKKKKKKKKKKK'], 12, 39, M);
        // 누르는 앞발: 박자마다 다른 건반 위로 콩
        const beat = Math.floor(at * 8);
        for (const side of [-1, 1]) {
          const x = 23 + side * (3 + ((beat + (side > 0 ? 1 : 0)) % 3) * 2);
          const down = (beat + (side > 0 ? 1 : 0)) % 2 === 0;
          this.pattern(['.OO.', 'OBBO'], x - 2, 39 - (down ? 0 : 2), { O: g.c.outline, B: g.c.body });
          if (down) this.px(x, 41, '#c6e4f7');
        }
      },
      step(r, k, at) { if (every(r, 'n', at, 0.3)) r.emit({ type: 'note', x: 24 + rand(-12, 12), y: 18, vy: -6, vx: rand(-3, 3), life: 1.2, c: ['#2b1a10', '#b784f5', '#6fb0ea'][Math.floor(rand(0, 3))] }); },
    },
    electricjam: {
      // 일렉 기타 + 앰프: 고양이 옆에 세워 든 빨간 일렉을 오른발로 긁으며 헤드뱅잉. 앰프는 왼쪽 바닥에 고정
      len: 3.4, loop: true,
      pose(p, k, at) { p.armR = 'rest'; p.armL = 'rest'; p.dy = -Math.round(Math.abs(Math.sin(at * 10)) * 2); p.lookY = Math.sin(at * 10) > 0 ? 1 : 0; p.lookX = 1; p.eyes = 'closed'; p.mouth = 'big'; p.tail = 'flick'; },
      back() {
        // 앰프: 까만 통에 금색 노브, 가운데 스피커 그릴
        this.pattern(['KKKKKKKKK', 'KkYkYkYkK', 'KKKKKKKKK', 'KgggggggK', 'KgKKKKKgK', 'KgKgggKgK', 'KgKgWgKgK', 'KgKgggKgK', 'KgKKKKKgK', 'KgggggggK', 'KKKKKKKKK'], 1, GROUND - 10, { K: '#15151a', k: '#34343e', Y: '#ffd65a', g: '#4a4a54', W: '#8a8a94' });
        // 케이블: 앰프 → 기타 (고양이 뒤 바닥)
        // 앰프 잭 → 바닥으로 축 늘어졌다가 → 기타 아래 잭까지 (2차 곡선)
        const P0 = [9, GROUND - 3], P1 = [22, GROUND + 3], P2 = [36, GROUND - 1];
        for (let i = 0; i <= 60; i++) {
          const t = i / 60, u = 1 - t;
          const x = u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0];
          const y = Math.min(GROUND, u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]);
          this.px(Math.round(x), Math.round(y), '#1f1c1b');
        }
        this.px(9, GROUND - 3, '#c3ccd6');
      },
      front(g, a, k, at) {
        const M = { K: '#2b1a10', R: '#e8303a', r: '#a81a22', H: '#ff9a9a', W: '#fffaf3', k: '#1f1c1b', g: '#c3ccd6', y: '#f2c14e' };
        const x0 = 30, y0 = 32;
        // 넥: 두 칸 굵기 메이플에 프렛·점, 살짝 오른쪽으로 기운다
        for (let i = 0; i < 12; i++) {
          const x = x0 + 4 + Math.round(i * 0.25), y = y0 - 1 - i;
          this.px(x, y, i % 3 === 1 ? '#8a6a40' : '#f0d49a');
          this.px(x + 1, y, '#c8a068');
        }
        // 헤드: 한쪽에 줄감개 여섯 개
        const hx = x0 + 7, hy = y0 - 17;
        this.pattern(['.KK.', 'KkkK', 'KkkK', 'KkkK', '.KkK'], hx - 1, hy, { K: '#2b1a10', k: '#e8303a' });
        for (let j = 0; j < 3; j++) this.px(hx + 3, hy + 1 + j, '#c3ccd6');
        // 몸통: 뿔 둘 달린 더블 컷어웨이, 흰 픽가드, 픽업 셋(폴피스 점), 브리지, 노브 둘, 잭
        this.pattern([
          '.KK....KK.',
          'KRRK..KRRK',
          'KRHRKKRRRK',
          'KRRWWWWRRK',
          '.KRWkkWRK.',
          '.KRWggWRK.',
          'KRRWkkWRRK',
          'KRRWggWyRK',
          'KRRWkkWRyK',
          'KRRRggRRRK',
          'KrRRRRRRrK',
          '.KrrRRrrK.',
          '..KKKKKK..',
        ], x0, y0, M);
        // 줄을 긁는 오른발 (박자마다 위아래)
        const up = Math.floor(at * 8) % 2;
        this.pattern(['.OO.', 'OBBO', '.OO.'], x0 - 2, y0 + 5 + up, { O: g.c.outline, B: g.c.body });
      },
      step(r, k, at) {
        if (every(r, 'w', at, 0.25)) r.emit({ type: 'ring', x: 5, y: GROUND - 4, r: 2, grow: 6, life: 0.6, c: 'rgba(255,214,90,0.8)' });
        if (every(r, 'n', at, 0.4)) r.emit({ type: 'note', x: 24 + rand(-10, 10), y: 18, vy: -6, life: 1, c: '#ff5a5a' });
      },
    },
    ropeskip: {
      // 줄넘기: 양 앞발로 줄을 돌리고, 줄이 발밑을 지나는 순간 폴짝. 뒤로 넘어갈 땐 몸 뒤로, 앞으로 올 땐 몸 앞으로 돈다
      // (7차: 줄이 바닥을 지날 때 고양이가 땅에 서 있던 박자를 바로잡고, 줄 끝을 앞발에 붙였다. 3초에 딱 다섯 번이라 이어 돌려도 매끄럽다)
      len: 3, loop: true,
      pose(p, k) {
        const ph = (k * 5) % 1; // 0 = 줄이 발밑, 0.5 = 머리 위
        const air = Math.max(0, Math.cos(ph * Math.PI * 2));
        p.dy = -Math.round(air * 4);
        if (ph > 0.25 && ph < 0.32) p.xf = { sx: 1.06, sy: 0.94 }; // 착지 — 살짝 눌린다
        p.armL = p.armR = 'clap'; p.clapK = 1;
        p.eyes = 'squint'; p.mouth = air > 0.5 ? 'open' : 'smile'; p.ear = 1; p.tail = air > 0.3 ? 'up' : 'wag';
      },
      back(g, a, k) { const ph = (k * 5) % 1; if (ph < 0.5) ropeArc.call(this, a, ph); }, // 뒤로 넘어가는 줄
      front(g, a, k) { const ph = (k * 5) % 1; if (ph >= 0.5) ropeArc.call(this, a, ph); }, // 앞으로 내려오는 줄
      step(r, k, at, dt, a) {
        const n = Math.floor(k * 5);
        if (once(r, 'c' + n, (k * 5) % 1 < 0.1)) txt(r, String(n + 1), r.scr(a.hx + 11), a.top - 6, '#fff', 0.5);
      },
    },
  };

  Object.assign(root.PetSprite.MOTIONS, M);
})(window);

// ================= 8차 (2026-09-24 확정): 6차 새 세트의 전용 모션 =================
// 야근 요정 김대리 · 7수 선비 · 크아앙 공룡 잠옷 · 월요일 배포 개발자 (크리스마스트리는 2026-09-25 세트에서 빠졌다). 세트를 입고 있으면 '심심할 때'에 섞여 나온다
(function (root) {
  const { rand, seg, bump, ease, GROUND } = root.PetSprite.util;
  const { tintUnder, flashCat, tintArea } = root.PetSprite.motionFx;
  const once = (r, tag, cond) => { if (cond && !r.ms[tag]) { r.ms[tag] = true; return true; } return false; };
  const every = (r, tag, at, period) => { const n = Math.floor(at / period); if (r.ms[tag] !== n) { r.ms[tag] = n; return true; } return false; };
  const txt = (r, s, x, y, c = '#fff', life = 0.8, vy = -3) => r.emit({ type: 'text', s, x, y, vy, life, c });
  const spr = (r, rows, x, y, map) => r.emit({ type: 'sprite', rows, x: Math.round(x), y: Math.round(y), map, perFrame: true, fade: false });
  const dusts = (r, n = 5, x = 24) => { for (let i = 0; i < n; i++) r.emit({ type: 'dust', x: x + rand(-10, 10), y: GROUND, vx: rand(-8, 8), life: 0.5 }); };
  // 두 점을 잇는 굵은 막대 (기울어진 소주병·붓대). back/mid/front 안에서 this 로 부른다
  function stick(x0, y0, x1, y1, col, w = 1) {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      for (let d = 0; d < w; d++) this.px(x + d, y, typeof col === 'function' ? col(i / n) : col);
    }
  }
  const SOJU = { K: '#1d4a2a', N: '#3fae62', n: '#2c8a4a', W: '#ffffff', B: '#3d6fb0' };
  const SOJU_UP = ['.KK.', '.KK.', '.KNK', 'KNNK', 'KWWK', 'KWBK', 'KNnK', 'KKKK'];
  const BIRD = [['.KK..', 'KBWKY', '.KBBK', '..KK.'], ['K...K', 'KBKBK', '.KBWKY', '..KK.']];
  const BIRD_MAP = { K: '#2b1a10', B: '#e8534a', W: '#ffffff', Y: '#ffd65a' };
  const GIFT_COL = [['#e8534a', '#ffd65a'], ['#5ab8ff', '#ffffff'], ['#b784f5', '#ffd65a'], ['#78c46a', '#e8534a']];
  const giftRows = (w) => ['K'.repeat(w + 2), ...Array.from({ length: w }, (_, j) => 'K' + [...Array(w)].map((_, i) => (i === Math.floor(w / 2) || j === Math.floor(w / 2) ? 'Y' : 'R')).join('') + 'K'), 'K'.repeat(w + 2)];

  const M = {
    // 퇴근길 소주 원샷 (overtimer): 초록 병 뚜껑을 똑 따고 고개를 젖혀 꿀꺽꿀꺽. 얼굴이 빨개지며 딸꾹, 비틀비틀
    sojushot: { len: 4.8,
      pose(p, k, at) {
        if (k < 0.3) { p.armL = p.armR = 'hold'; p.lookY = 1; p.eyes = 'half'; p.mouth = 'flat'; }
        else if (k < 0.58) { p.armR = 'kiss'; p.eyes = 'closed'; p.mouth = 'o'; p.xf = { rot: -0.18, py: GROUND }; p.ear = 1; }
        else {
          p.armL = 'hold'; p.eyes = 'squint'; p.mouth = Math.floor(at * 2) % 2 ? 'wavy' : 'grin'; p.blush = true;
          p.xf = { rot: Math.sin(at * 3.2) * 0.12, py: GROUND };
          if (Math.floor(at * 10) % 13 === 0) p.dy = -2;
        }
      },
      front(g, a, k, at, c) {
        if (k < 0.3) this.pattern(SOJU_UP, a.hx - 2, a.my, SOJU);
        else if (k < 0.58) { // 병 주둥이를 입에 대고 하늘로
          stick.call(this, a.fx + 1, a.my, a.fx + 3, a.my - 2, SOJU.K, 1);
          stick.call(this, a.fx + 3, a.my - 2, a.fx + 7, a.my - 6, (t) => (t > 0.4 && t < 0.7 ? SOJU.W : SOJU.N), 2);
          this.px(a.fx + 2, a.my - 1, SOJU.N);
        } else this.pattern(SOJU_UP, a.hx - 5, a.my + 1, SOJU);
        if (k > 0.58) tintArea.call(this, a.left + 1, a.ey - 1, a.right - a.left - 1, 4, 'rgba(255,70,70,0.28)');
      },
      step(r, k, at, dt, a) {
        if (once(r, 'p', k > 0.12)) txt(r, 'POP', r.scr(a.hx - 4), a.my - 8, '#bff0c8', 0.6);
        if (k > 0.32 && k < 0.56 && every(r, 'g', at, 0.45)) txt(r, 'GLUG', r.scr(a.hx + 3), a.top - 9, '#ffffff', 0.5, -2);
        if (k > 0.62 && every(r, 'h', at, 0.7)) txt(r, 'HIC', r.scr(a.hx + 5 + rand(-2, 2)), a.top - 8, '#ffb0b0', 0.6);
        if (k > 0.62 && every(r, 'b', at, 0.35)) r.emit({ type: 'bubble', x: r.scr(a.hx + rand(-6, 6)), y: a.top - 2, vy: -5, r: 1, life: 0.9 });
      } },
    // 칼퇴 시도… 실패 (overtimer): 6시 땡! 신나서 퇴근하다 전화가 따르릉. 터덜터덜 돌아와 영혼 없이 다시 타자
    nightcall: { len: 5.6,
      pose(p, k, at) {
        if (k < 0.12) { p.armL = p.armR = 'cheer'; p.eyes = 'star'; p.mouth = 'open'; p.ear = 1; p.dy = -Math.round(3 * bump(k, 0, 0.12)); }
        else if (k < 0.4) { p.step = (at * 1.6) % 1; p.xf = { ox: Math.round(12 * seg(k, 0.12, 0.4)) }; p.eyes = 'happy'; p.mouth = 'open'; p.tail = 'wag'; }
        else if (k < 0.55) { p.xf = { ox: 12 + (Math.floor(at * 20) % 2) }; p.eyes = 'x'; p.mouth = 'o'; p.sweat = true; p.ear = -1; p.armR = 'kiss'; }
        else if (k < 0.8) { p.step = (at * 0.9) % 1; p.xf = { ox: Math.round(12 * (1 - seg(k, 0.55, 0.8))), flipX: true }; p.eyes = 'teary'; p.mouth = 'frown'; p.ear = -1; p.tail = 'slow'; }
        else { p.prop = 'laptop'; p.armL = p.armR = 'type'; p.dy = -3; p.eyes = 'dot'; p.mouth = 'flat'; p.ear = -1; }
      },
      front(g, a, k) {
        if (k >= 0.4 && k < 0.55) this.pattern(['KKK', 'KUK', 'KUK', 'KKK'], a.fx + 1, a.ey - 1, { K: '#2b1a10', U: Math.floor(k * 60) % 2 ? '#7fe8ff' : '#ffffff' });
      },
      step(r, k, at, dt, a) {
        if (once(r, 's', k > 0.02)) txt(r, '6PM', 17, 12, '#ffd65a', 1);
        if (k > 0.14 && k < 0.4 && every(r, 'n', at, 0.3)) r.emit({ type: 'note', x: r.scr(a.hx + rand(-6, 6)), y: a.top - 4, vy: -8, life: 0.8, c: '#fff' });
        if (k > 0.4 && k < 0.55 && every(r, 'r', at, 0.3)) txt(r, 'RING', 26 + rand(-2, 2), 16, '#ff9a9a', 0.35, -2);
        if (k > 0.58 && k < 0.8 && every(r, 't', at, 0.25)) r.emit({ type: 'drop', x: 24 + rand(-3, 3), y: 34, vy: 10, life: 0.35 });
        if (once(r, 'p', k > 0.8)) dusts(r, 4);
        if (k > 0.82) r.emit({ type: 'soul', x: 24 + Math.round(Math.sin(at * 2) * 2), y: 22 - Math.round(seg(k, 0.82, 1) * 4), perFrame: true, fade: false });
      } },
    // 넥타이 질끈, 파이팅… 기절 (overtimer): 머리띠를 질끈 동여매고 불타는 타자! …는 1분 만에 키보드에 얼굴 박고 쿨쿨
    fighting: { len: 5.2,
      pose(p, k, at) {
        if (k < 0.22) { p.armL = p.armR = 'up'; p.brow = 'angry'; p.eyes = 'squint'; p.mouth = 'grin'; if (k > 0.12) p.xf = { ox: Math.floor(at * 24) % 2 }; }
        else if (k < 0.62) { p.prop = 'laptop'; p.armL = p.armR = 'typefast'; p.dy = -3; p.brow = 'angry'; p.eyes = 'squint'; p.mouth = 'grin'; }
        else if (k < 0.74) { p.prop = 'laptop'; p.armL = p.armR = 'type'; p.dy = -3; p.eyes = 'half'; p.mouth = 'flat'; p.xf = { rot: 0.1 * Math.max(0, Math.sin(at * 7)), py: GROUND }; }
        else { p.prop = 'laptop'; p.dy = 1; p.xf = { rot: 0.25, py: GROUND }; p.eyes = 'closed'; p.mouth = 'blep'; p.ear = -1; }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'f', k > 0.12)) txt(r, 'FIGHT', 14, 12, '#ff9a3c', 1);
        if (k > 0.22 && k < 0.62) {
          if (every(r, 'e', at, 0.06)) r.emit({ type: 'ember', x: r.scr(a.hx + rand(-7, 7)), y: GROUND - 6, vx: rand(-6, 6), vy: -rand(8, 16), life: 0.5 });
          tintUnder(r, 'rgba(255,120,40,0.15)', 1);
        }
        if (k > 0.78 && every(r, 'z', at, 0.55)) txt(r, 'Z', r.scr(a.hx + 6 + rand(0, 3)), a.top - 4, '#b8c4ff', 0.9, -5);
      } },
    // 방 보고 털썩 (seonbi): 합격자 방을 위에서부터 한 줄씩 짚어 내려가다… 내 이름이 없다. 일곱 번째 털썩
    examboard: { len: 5.4,
      pose(p, k, at) {
        if (k < 0.58) { p.lookX = 1; p.lookY = -1 + 2 * seg(k, 0.05, 0.55); p.eyes = 'wide'; p.mouth = 'o'; p.ear = 1; p.armR = 'out'; }
        else if (k < 0.66) { p.lookX = 1; p.lookY = 1; p.eyes = 'dot'; p.mouth = 'flat'; }
        else {
          const s = ease(seg(k, 0.66, 0.74));
          p.xf = { sy: 1 - 0.18 * s, sx: 1 + 0.12 * s, py: GROUND }; p.eyes = 'teary'; p.mouth = 'wavy'; p.ear = -1; p.tail = 'slow'; p.brow = 'sad';
        }
      },
      back(g, a, k) {
        // 방(합격자 명단): 나무 기둥 두 개에 흰 종이, 이름 줄 다섯
        const x = a.right + 4, y = GROUND - 17;
        for (let j = 0; j < 17; j++) { this.px(x, y + j, '#8a5a32'); this.px(x + 11, y + j, '#8a5a32'); }
        this.pattern(['KKKKKKKKKKKK', 'KWWWWWWWWWWK', 'KWkkkkkWkkWK', 'KWWWWWWWWWWK', 'KWkkWkkkkWWK', 'KWWWWWWWWWWK', 'KWkkkWkkkkWK', 'KWWWWWWWWWWK', 'KWkkkkWkkWWK', 'KWWWWWWWWWWK', 'KWkkWkkkkkWK', 'KWWWWWWWWWWK', 'KKKKKKKKKKKK'], x, y, { K: '#2b1a10', W: '#f4f1e6', k: '#4a4a52' });
        // 짚어 내려가는 빨간 줄
        if (k > 0.05 && k < 0.62) { const row = Math.min(4, Math.floor(seg(k, 0.05, 0.58) * 5)); for (let i = 1; i < 11; i++) this.px(x + i, y + 3 + row * 2, 'rgba(232,83,74,0.55)'); }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'f', k > 0.66)) txt(r, 'FAIL X7', 4, 4, '#ff9a9a', 1.4, -1);
        if (k > 0.7 && every(r, 't', at, 0.2)) { r.emit({ type: 'drop', x: r.scr(a.eyeL), y: a.ey + 2, vy: 12, life: 0.35 }); r.emit({ type: 'drop', x: r.scr(a.eyeR + 1), y: a.ey + 2, vy: 12, life: 0.35 }); }
        if (k > 0.78 && k < 0.99) { const s = seg(k, 0.78, 0.99); spr(r, Math.floor(at * 8) % 2 ? ['K...K', '.KKK.', '..KK.'] : ['.....', 'KKKKK', '..KK.'], -5 + s * 56, 18 - Math.sin(s * Math.PI) * 4, { K: '#1a1a1a' }); }
        if (once(r, 'w', k > 0.84)) txt(r, 'CAW', 20, 12, '#dddddd', 0.7, -2);
      } },
    // 일필휘지… 먹물 참사 (seonbi): 눈을 감고 붓을 휘둘러 한 획 한 획 멋지게. 마지막에 붓을 탁! 튕기다 먹물이 얼굴로
    calligraphy: { len: 5.4,
      pose(p, k, at) {
        if (k < 0.14) { p.armR = 'hold'; p.lookY = 1; p.eyes = 'half'; p.mouth = 'flat'; }
        else if (k < 0.62) { p.armR = 'front'; p.eyes = 'closed'; p.mouth = 'flat'; p.brow = 'angry'; p.xf = { rot: Math.sin(at * 5) * 0.05, py: GROUND }; }
        else if (k < 0.74) { p.armR = 'point'; p.eyes = 'happy'; p.mouth = 'grin'; p.ear = 1; }
        else { p.armR = 'rest'; p.eyes = 'dot'; p.mouth = 'o'; p.ear = -1; }
      },
      front(g, a, k, at) {
        // 바닥에 편 한지
        const x0 = a.hx - 10, y0 = GROUND - 4;
        this.pattern(['KKKKKKKKKKKKKKKKKKKKK', 'KWWWWWWWWWWWWWWWWWWWK', 'KWWWWWWWWWWWWWWWWWWWK', 'KWWWWWWWWWWWWWWWWWWWK', 'KWWWWWWWWWWWWWWWWWWWK', 'KKKKKKKKKKKKKKKKKKKKK'], x0, y0, { K: '#b8a888', W: '#fbf6e8' });
        // 획: 쓴 만큼만 보인다
        const strokes = [[2, 2, 7, 1], [5, 1, 3, 4], [5, 2, 7, 4], [10, 1, 10, 4], [9, 2, 13, 2], [15, 1, 18, 1], [16, 1, 16, 4], [15, 4, 18, 4]];
        const done = k < 0.14 ? 0 : seg(k, 0.14, 0.6) * strokes.length;
        let tip = [a.hx + 2, a.my + 3];
        strokes.forEach(([xa, ya, xb, yb], i) => {
          const f = Math.max(0, Math.min(1, done - i));
          if (f > 0) { stick.call(this, x0 + xa, y0 + ya, x0 + xa + (xb - xa) * f, y0 + ya + (yb - ya) * f, '#1a1a1a', 1); tip = [x0 + xa + (xb - xa) * f, y0 + ya + (yb - ya) * f]; }
        });
        // 붓: 앞발에서 붓끝까지
        if (k < 0.14) stick.call(this, a.hx + 3, a.my + 3, a.hx + 6, a.my - 4, (t) => (t < 0.25 ? '#1a1a1a' : t < 0.4 ? '#f4f1e6' : '#8a5a32'));
        else if (k < 0.62) stick.call(this, Math.round(tip[0]), Math.round(tip[1]) - 1, Math.round(tip[0]) + 4, Math.round(tip[1]) - 11, (t) => (t < 0.15 ? '#1a1a1a' : t < 0.3 ? '#f4f1e6' : '#8a5a32'), 2);
        else if (k < 0.74) stick.call(this, a.right + 2, a.top - 1, a.right + 4, a.top - 8, (t) => (t < 0.2 ? '#8a5a32' : t < 0.8 ? '#8a5a32' : '#1a1a1a'));
        // 얼굴에 튄 먹물
        if (k > 0.74) for (const [dx, dy] of [[-4, -1], [-3, 0], [-4, 0], [-1, 2], [0, -2], [1, -2], [2, 1], [3, -1], [4, 2], [4, 1], [1, 3], [-2, -3], [-2, 3], [0, 0]]) this.px(a.hx + dx, a.ey + dy, '#141414');
      },
      step(r, k, at, dt, a) {
        if (k > 0.14 && k < 0.6 && every(r, 'w', at, 0.4)) r.emit({ type: 'line', x: r.scr(a.hx + rand(-8, 4)), y: a.top - rand(0, 4), len: 3, life: 0.2, c: 'rgba(255,255,255,0.8)' });
        if (once(r, 'h', k > 0.62)) txt(r, 'HMM', r.scr(a.hx - 12), a.top - 8, '#fff', 0.7);
        if (once(r, 's', k > 0.74)) { txt(r, 'SPLAT', 13, 10, '#9a9aa8', 1.2, -1); for (let i = 0; i < 8; i++) r.emit({ type: 'drop', x: r.scr(a.hx + rand(-6, 6)), y: a.top + rand(-4, 2), vx: rand(-10, 10), vy: rand(-12, 0), ay: 40, life: 0.5, c: '#141414' }); }
      } },
    // 글 읽다 꾸벅 (seonbi): 책을 펴고 고개를 흔들흔들 소리 내어 읽다가 스르르 꾸벅… 화들짝 깨서 모른 척
    dozebook: { len: 5.6,
      pose(p, k, at) {
        p.armL = p.armR = 'hold'; p.lookY = 1;
        if (k < 0.4) { p.xf = { rot: Math.sin(at * 4) * 0.08, py: GROUND }; p.mouth = Math.floor(at * 4) % 2 ? 'o' : 'flat'; p.eyes = 'half'; }
        else if (k < 0.78) { const d = ease(seg(k, 0.4, 0.74)); p.xf = { rot: 0.05 + d * 0.22, py: GROUND }; p.eyes = d > 0.3 ? 'closed' : 'half'; p.mouth = 'blep'; p.ear = -1; }
        else if (k < 0.86) { p.dy = -3; p.eyes = 'wide'; p.mouth = 'o'; p.ear = 1; p.armL = p.armR = 'up'; }
        else { p.eyes = 'squint'; p.brow = 'angry'; p.mouth = 'flat'; p.xf = { rot: Math.sin(at * 4) * 0.08, py: GROUND }; }
      },
      front(g, a, k) {
        if (k >= 0.78 && k < 0.86) return; // 화들짝 할 땐 책을 놓쳤다
        this.pattern(['KKKKKKKKKKK', 'KWWWWKWWWWK', 'KWkkWKWkkWK', 'KWWWWKWWWWK', 'KWkkWKWkkWK', 'KKKKKKKKKKK'], a.hx - 5, a.my + 1, { K: '#6b3f1a', W: '#f2ead8', k: '#a8a0a0' });
      },
      step(r, k, at, dt, a) {
        if (k < 0.4 && every(r, 'n', at, 0.5)) r.emit({ type: 'note', x: r.scr(a.hx + rand(-8, 8)), y: a.top - 4, vy: -6, life: 0.9, c: '#4a4a52' });
        if (k > 0.5 && k < 0.78 && every(r, 'z', at, 0.5)) txt(r, 'Z', r.scr(a.hx + 7 + rand(0, 3)), a.top - 5, '#b8c4ff', 0.9, -5);
        if (k > 0.5 && k < 0.78) { const s = seg(k, 0.5, 0.76); r.emit({ type: 'bubble', x: r.scr(a.fx), y: a.my + 1, r: 0.8 + s * 1.8, perFrame: true, fade: false }); }
        if (once(r, 'x', k > 0.78)) { txt(r, '!', r.scr(a.hx + 1), a.top - 12, '#ffd65a', 0.6); r.emit({ type: 'sprite', rows: ['KKKKKKKKK', 'KWWWKWWWK', 'KKKKKKKKK'], map: { K: '#6b3f1a', W: '#f2ead8' }, x: r.scr(a.hx - 4), y: a.my, vy: -14, ay: 60, life: 0.4 }); }
      } },
    // 짧은 팔 간식 사냥 (dinosuit): 위에 매달린 생선이 짧은 팔로는 안 닿는다. 폴짝폴짝 실패… 결국 빙글 돌아 꼬리로 탁!
    shortarms: { len: 5.6,
      pose(p, k, at, r) {
        if (k < 0.5) { const h = Math.abs(Math.sin(at * Math.PI * 1.4)); p.dy = -Math.round(5 * h); p.armL = p.armR = 'up'; p.eyes = 'wide'; p.lookY = -1; p.lookX = 1; p.mouth = 'open'; p.ear = 1; }
        else if (k < 0.6) { p.eyes = 'squint'; p.brow = 'angry'; p.lookX = 1; p.lookY = -1; p.mouth = 'frown'; p.sweat = true; }
        else if (k < 0.74) { const s = seg(k, 0.6, 0.74); p.xf = { rot: -Math.PI * 2 * ease(s), px: 24, py: 36, oy: -Math.round(8 * Math.sin(s * Math.PI)) }; p.noShadow = true; p.tail = 'flick'; p.eyes = 'closed'; }
        else { p.eyes = 'happy'; p.mouth = 'chew'; p.tail = 'wag'; p.ear = 1; if (Math.floor(at * 6) % 2) p.mouth = 'flat'; }
      },
      front(g, a, k) {
        if (k > 0.8) this.pattern(['.KKKKK.K.', 'KWBBBBKBK', 'KBBBBBKBK', '.KKKKK.K.'], a.fx + 1, a.my - 1, { K: '#2b1a10', W: '#ffffff', B: '#6fb0ea' });
      },
      step(r, k, at, dt, a) {
        const fx = 32;
        if (k < 0.68) {
          r.emit({ type: 'seg', x: fx + 3, y: 0, x2: fx + 3, y2: 16, perFrame: true, fade: false, c: '#bba68a' });
          spr(r, ['..K..', '.KBK.', 'KBBBK', 'KBWBK', 'KBBBK', '.KBK.', 'K.K.K'], fx + 1, 17 + Math.round(Math.sin(at * 3)), { K: '#2b1a10', B: '#6fb0ea', W: '#ffffff' });
        } else if (k < 0.8) {
          const s = seg(k, 0.68, 0.8);
          r.emit({ type: 'seg', x: fx + 3, y: 0, x2: fx + 3, y2: 16 - Math.round(s * 10), perFrame: true, fade: false, c: '#bba68a' });
          spr(r, ['.KKKK.K.', 'KkBBBKBK', '.KKKK.K.'], fx + 1 - s * 10, 17 + s * 17, { K: '#2b1a10', k: '#2b1a10', B: '#6fb0ea' });
        }
        if (k < 0.5 && every(r, 'm', at, 0.72)) txt(r, 'MISS', 5, 14, '#ffffff', 0.5, -2);
        if (once(r, 'w', k > 0.68)) txt(r, 'WHAP', 26, 6, '#ffcf4a', 0.8);
        if (once(r, 'l', k > 0.74)) dusts(r, 4);
      } },
    // 공룡알 부화 (dinosuit): 커다란 알이 흔들흔들, 쩍쩍 금이 가더니 뿅! 튀어나온 아기 공룡 머리엔 알 껍데기 모자
    eggpop: { len: 5.4,
      pose(p, k, at) {
        if (k < 0.4) { p.xf = { rot: Math.sin(at * 9) * 0.12 * seg(k, 0, 0.3), py: GROUND }; p.eyes = 'closed'; }
        else if (k < 0.52) { p.dy = -Math.round(4 * bump(k, 0.4, 0.52)); p.armL = p.armR = 'cheer'; p.eyes = 'wide'; p.mouth = 'big'; p.ear = 1; }
        else { p.armL = p.armR = Math.floor(at * 4) % 2 ? 'cheer' : 'up'; p.eyes = 'happy'; p.mouth = 'open'; p.tail = 'wag'; }
      },
      front(g, a, k, at) {
        const ex = a.hx, ey = GROUND - 8, rx = 10, ry = 11.5;
        const W = '#f4f1e6', w = '#d8d2c0', Sp = '#8fd08a', O = '#6a6250';
        const fill = (x, y) => ([[-5, -5], [-4, -5], [-5, -4], [3, -7], [4, -7], [5, 2], [5, 3], [6, 3], [-3, 5], [-2, 5], [1, -1], [0, 7], [1, 7]].some(([dx, dy]) => x === ex + dx && y === ey + dy) ? Sp : x > ex + 4 ? w : W);
        if (k < 0.4) {
          this.ellipse(ex, ey, rx, ry, fill, O);
          // 금: 조금씩 자란다
          const n = Math.floor(seg(k, 0.12, 0.4) * 10);
          const zig = [[-8, 0], [-6, -1], [-4, 1], [-2, -1], [0, 1], [2, -1], [4, 1], [6, -1], [8, 0], [9, 1]];
          for (let i = 0; i < n; i++) { this.px(ex + zig[i][0], ey + zig[i][1], '#2b1a10'); this.px(ex + zig[i][0] + 1, ey + zig[i][1], '#2b1a10'); }
        } else {
          // 아랫껍데기만 남는다 (윗가장자리 톱니)
          this.ellipse(ex, ey, rx, ry, (x, y) => (y > ey + ((x + 40) % 2) ? fill(x, y) : null), null);
          for (let x = ex - rx; x <= ex + rx; x++) { const yy = ey + 1 + ((x + 40) % 2); const nx = (x + 0.5 - ex) / rx; if (nx * nx < 1) this.px(x, yy, O); }
          for (let y = ey + 1; y <= GROUND + 3; y++) for (const x of [ex - rx - 1, ex + rx]) { const nx = (x + 0.5 - ex) / rx, ny = (y + 0.5 - ey) / ry; if (nx * nx + ny * ny <= 1.25) this.px(x, y, O); }
          // 껍데기 모자: 날아갔다가 머리에 턱
          if (k > 0.62) { const s = ease(seg(k, 0.62, 0.72)); this.pattern(['..KKKKK..', '.KWWWWWK.', 'KWWsWWWWK', 'K.K.K.K.K'], a.hx - 4, a.earTop - 5 - Math.round((1 - s) * 14), { K: O, W, s: Sp }); }
        }
      },
      step(r, k, at, dt, a) {
        if (k > 0.12 && k < 0.4 && every(r, 'c', at, 0.4)) txt(r, 'CRK', 30, 18 + rand(-2, 2), '#ffffff', 0.4, -2);
        if (once(r, 'p', k > 0.4)) { txt(r, 'POP', 32, 18, '#ffcf4a', 1); for (let i = 0; i < 8; i++) r.emit({ type: 'sprite', rows: ['WW', 'W.'], map: { W: '#f4f1e6' }, x: 24 + rand(-8, 8), y: 30, vx: rand(-20, 20), vy: rand(-24, -8), ay: 60, life: 0.8 }); }
        if (k > 0.4 && k < 0.62) spr(r, ['..KKKKK..', '.KWWWWWK.', 'KWWsWWWWK', 'K.K.K.K.K'], 20, 10 - Math.round(bump(k, 0.4, 0.62) * 8), { K: '#6a6250', W: '#f4f1e6', s: '#8fd08a' });
        if (once(r, 'h', k > 0.72)) txt(r, 'RAWR', 30, 14, '#8fd08a', 0.8);
      } },
    // 월요일 아침 배포 버튼 (mondaydev): 심호흡하고 배포 버튼 쾅! 진행바가 99%에서 멈추더니… 노트북에서 불이. 동동 발 구르기
    deployfire: { len: 5.6,
      pose(p, k, at) {
        if (k < 0.14) { p.lookX = -1; p.eyes = 'closed'; p.mouth = 'o'; p.sy = 1 + 0.06 * Math.sin(seg(k, 0, 0.14) * Math.PI); }
        else if (k < 0.2) { p.lookX = -1; p.armL = 'up'; p.brow = 'angry'; p.eyes = 'squint'; }
        else if (k < 0.26) { p.lookX = -1; p.armL = 'front'; p.brow = 'angry'; p.eyes = 'squint'; p.mouth = 'grin'; }
        else if (k < 0.6) { p.lookX = -1; p.eyes = k > 0.44 ? 'wide' : 'open'; p.mouth = k > 0.44 ? 'o' : 'smile'; p.sweat = k > 0.46; }
        else { p.lookX = -1; p.eyes = 'x'; p.mouth = 'big'; p.sweat = true; p.armL = p.armR = Math.floor(at * 8) % 2 ? 'cheer' : 'up'; p.dy = -(Math.floor(at * 8) % 2) * 2; p.step = (at * 3) % 1; }
      },
      front(g, a, k, at) {
        // 뒤에 그려진 코스튬 노트북 화면(왼쪽 바닥)에 덧칠
        const x0 = a.left - 11, yb = GROUND;
        if (k > 0.26 && k < 0.6) {
          const f = Math.min(0.99, ease(seg(k, 0.26, 0.44)) * 0.99);
          const bx = x0 - 1, by = yb - 12;
          this.pattern(['KKKKKKKKKKK', 'K.........K', 'KKKKKKKKKKK'], bx, by, { K: '#1f1c24' });
          for (let i = 0; i < Math.round(9 * f); i++) this.px(bx + 1 + i, by + 1, '#5ad07a');
        }
        if (k >= 0.6) {
          const red = Math.floor(at * 6) % 2 ? '#ff4a4a' : '#8a1a22';
          for (let y = yb - 6; y <= yb - 3; y++) for (let x = x0 + 1; x <= x0 + 5; x++) this.px(x, y, red);
        }
      },
      step(r, k, at, dt, a) {
        const lx = r.scr(a.left - 8);
        if (once(r, 'd', k > 0.2)) { txt(r, 'DEPLOY', 14, 8, '#7fe8ff', 0.9); r.emit({ type: 'shock', x: r.scr(a.hx - 3), y: GROUND - 1, r: 2, life: 0.15 }); }
        if (once(r, '9', k > 0.44)) txt(r, '99%', r.scr(a.left - 10), 20, '#ffffff', 0.8, 0);
        if (once(r, 'e', k > 0.6)) txt(r, 'ERROR', 10, 6, '#ff5a5a', 1.8, -1);
        if (k > 0.6) {
          if (every(r, 'fl', at, 0.05)) r.emit({ type: 'ember', x: lx + rand(-4, 4), y: GROUND - 8, vx: rand(-3, 3), vy: -rand(8, 18), life: 0.6 });
          if (every(r, 'sm', at, 0.2)) r.emit({ type: 'puff', x: lx + rand(-3, 3), y: GROUND - 10, vy: -8, vx: rand(-2, 2), life: 0.9, c: 'rgba(80,80,90,0.7)' });
          spr(r, Math.floor(at * 8) % 2 ? ['..Y..', '.YOY.', 'YOROY', '.ORO.'] : ['.Y...', '.YY.Y', 'YOROY', '.ORO.'], lx - 2, GROUND - 11, { Y: '#ffd65a', O: '#ff9a3c', R: '#e8534a' });
        }
      } },
    // 아아 수혈 (mondaydev): 반쯤 감긴 눈으로 아이스 아메리카노를 쭈우욱. 바닥까지 비우자 눈이 번쩍, 카페인에 덜덜덜
    icedrip: { len: 5,
      pose(p, k, at) {
        if (k < 0.62) { p.mouth = 'kiss'; p.eyes = k < 0.4 ? 'half' : 'open'; p.lookX = 1; p.lookY = 1; p.ear = k > 0.4 ? 0 : -1; }
        else if (k < 0.7) { p.eyes = 'wide'; p.mouth = 'o'; p.ear = 1; }
        else { p.eyes = 'star'; p.mouth = 'grin'; p.ear = 1; p.dy = -(Math.floor(at * 20) % 2); p.armL = p.armR = Math.floor(at * 14) % 2 ? 'cheer' : 'up'; p.tail = 'flick'; }
      },
      front(g, a, k) {
        const cx = a.right + 3, yb = GROUND;
        // 컵 안: 마신 만큼 위에서부터 비운다 (색은 코스튬 그대로, 빈 칸만 유리색)
        const empty = Math.min(3, Math.floor(seg(k, 0.05, 0.6) * 4));
        for (let j = 0; j < empty; j++) for (let i = 1; i <= 3; i++) this.px(cx + i, yb - 3 + j, j === empty - 1 && k > 0.6 ? '#b7d7ea' : '#dcefff');
        if (k < 0.62) {
          // 빨대: 컵 → 입
          const x0 = cx + 2, y0 = yb - 5, x1 = a.fx + 2, y1 = a.my + 1;
          for (let i = 0; i <= 8; i++) this.px(Math.round(x0 + ((x1 - x0) * i) / 8), Math.round(y0 + ((y1 - y0) * i) / 8), '#4b8f43');
        }
      },
      step(r, k, at, dt, a) {
        if (k < 0.6 && every(r, 'd', at, 0.12)) {
          const t = (at * 3) % 1;
          r.emit({ type: 'spray', x: r.scr(Math.round(a.right + 5 + (a.fx + 2 - a.right - 5) * t)), y: Math.round(GROUND - 5 + (a.my + 1 - GROUND + 5) * t), life: 0.1, c: '#6b4a32' });
        }
        if (once(r, 's', k > 0.5)) txt(r, 'SLURP', 22, 12, '#d6ecf7', 0.9);
        if (once(r, 'z', k > 0.7)) { txt(r, 'ZING', 6, 10, '#ffd65a', 1); r.emit({ type: 'bolt', x: 24, y: 22, life: 0.15 }); }
        if (k > 0.7 && every(r, 'v', at, 0.08)) r.emit({ type: 'line', x: r.scr(a.left - 3 - Math.floor(rand(0, 3))), y: a.cy + rand(-4, 4), len: 2, life: 0.1, c: '#ffffff' });
        if (k > 0.7) tintUnder(r, 'rgba(255,230,80,0.12)', 1);
      } },
  };

  Object.assign(root.PetSprite.MOTIONS, M);
})(window);

// ================= 9차 (2026-09-25 확정): 7차 새 세트의 전용 모션 =================
// 냥그와트 1학년 · 사이버펑크 해커 · 신의 기사단 · 제천대성 · 전투 무당 · 엑소시스트. 세트를 입고 있으면 '심심할 때'에 섞여 나온다
(function (root) {
  const { rand, seg, bump, ease, GROUND } = root.PetSprite.util;
  const once = (r, tag, cond) => { if (cond && !r.ms[tag]) { r.ms[tag] = true; return true; } return false; };
  const every = (r, tag, at, period) => { const n = Math.floor(at / period); if (r.ms[tag] !== n) { r.ms[tag] = n; return true; } return false; };
  const txt = (r, s, x, y, c = '#fff', life = 0.8, vy = -3) => r.emit({ type: 'text', s, x, y, vy, life, c });
  const spr = (r, rows, x, y, map) => r.emit({ type: 'sprite', rows, x: Math.round(x), y: Math.round(y), map, perFrame: true, fade: false });
  const puffs = (r, x, y, n = 5, c) => { for (let i = 0; i < n; i++) r.emit({ type: 'puff', x: x + rand(-4, 4), y: y + rand(-3, 3), vx: rand(-10, 10), vy: rand(-8, 2), life: 0.6, c }); };
  const sparks = (r, x, y, n = 5, c) => { for (let i = 0; i < n; i++) r.emit({ type: 'spark', x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-12, 12), vy: rand(-14, 4), life: 0.7, c }); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const mirror = (rows) => rows.map((row) => row.split('').reverse().join(''));
  // 풍성한 연기: 몸 둘레를 크게 감싸며 부풀었다 흩어진다
  const bigSmoke = (r, cx, cy, n = 16, c = '#ecebea', c2 = '#c9c6c2') => {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const d = rand(3, 9);
      r.emit({ type: 'puff', x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d * 0.8, vx: Math.cos(ang) * rand(8, 20), vy: Math.sin(ang) * rand(6, 14) - 4, life: rand(0.6, 1), c: i % 3 ? c : c2 });
    }
    r.emit({ type: 'ring', x: cx, y: cy + 4, r: 4, grow: 10, life: 0.5, c: 'rgba(235,235,235,0.9)' });
  };
  // 두 점을 잇는 막대. back/mid/front 안에서 this 로 부른다
  function stick(x0, y0, x1, y1, col, w = 1) {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      for (let d = 0; d < w; d++) this.px(x + d, y, typeof col === 'function' ? col(i / n) : col);
    }
  }
  // 한 바퀴 비행 (빗자루·근두운): k0~k1 동안 옆으로 멀리 나갔다가 뒤(작고 높게)를 지나 반대편에서 돌아온다
  //  ox: 화면 가로 이동, back: 0 앞 · 1 가장 뒤, s: 크기 (뒤로 갈수록 작다)
  function loopPath(k, at, k0, k1, amp, lift, shrink) {
    const th = k < k0 || k > k1 ? 0 : ease(seg(k, k0, k1)) * Math.PI * 2;
    const back = (1 - Math.cos(th)) / 2;
    const hover = Math.round(Math.sin(at * 2.4) * 1);
    return { ox: Math.round(Math.sin(th) * amp), oy: hover - Math.round(back * lift), s: 1 - shrink * back, back, moving: th > 0 };
  }

  const M = {
    // ---------- 빗자루 면허 없는 냥그와트 1학년 ----------
    // 빗자루 비행 한 바퀴: 늘 들고 있던 빗자루에 올라타 부웅 떠올라, 옆으로 휙 나갔다가 뒤로 작게 한 바퀴 돌아 사뿐 착지.
    // 화면 밖으로는 안 나간다 (빗자루 끝까지 창 안). 솔 끝에서 마법 가루가 흩날린다
    broomloop: { len: 6.2,
      pose(p, k, at) {
        p.armL = p.armR = 'hold'; p.noShadow = k > 0.14 && k < 0.9; p.tail = 'up';
        const L = loopPath(k, at, 0.22, 0.82, 10, 11, 0.5);
        const lift = k < 0.14 ? -Math.round(seg(k, 0.06, 0.14) * 4) : k > 0.88 ? -Math.round((1 - seg(k, 0.88, 0.96)) * 4) : -4;
        p.xf = { ox: L.ox, oy: lift + L.oy, sx: L.s, sy: L.s, py: GROUND, rot: L.moving ? Math.sin(at * 6) * 0.05 : 0 };
        p.eyes = L.back > 0.3 ? 'happy' : k < 0.1 ? 'closed' : 'wide';
        p.mouth = L.back > 0.3 ? 'open' : 'grin'; p.ear = k > 0.14 ? 1 : 0;
      },
      mid(g, a) {
        // 빗자루: 세트에서 세워 들고 있던 것과 같은 크기 (자루 15칸 + 짚 솔 5×4). 눕혀서 몸 밑을 가로지르고, 솔은 뒤쪽
        const St = '#8a5a2a', st = '#5e3a18', y = GROUND - 1, x0 = a.hx - 7;
        for (let x = x0; x < x0 + 15; x++) this.px(x, y, (x - x0) % 3 ? St : st);
        this.px(x0, y, '#c0303a');
        this.pattern(['zZZ.', 'ZzZZ', '.ZzZ', 'ZzZZ', 'zZZ.'], x0 - 4, y - 2, { Z: '#e8c86a', z: '#b8923a' });
      },
      step(r, k, at, dt, a) {
        const L = loopPath(k, at, 0.22, 0.82, 10, 11, 0.5);
        if (once(r, 'go', k > 0.1)) { txt(r, 'UP!', 20, 8, '#ffd65a', 0.7); for (let i = 0; i < 5; i++) r.emit({ type: 'dust', x: 24 + rand(-10, 10), y: GROUND, vx: rand(-10, 10), life: 0.5 }); }
        // 솔 끝 마법 가루 (보라·금빛)
        if (k > 0.12 && k < 0.9 && every(r, 't', at, 0.05)) {
          const bx = 24 + L.ox + (r.facing < 0 ? 1 : -1) * Math.round(11 * L.s);
          r.emit({ type: 'spark', x: bx + rand(-1, 1), y: GROUND - 4 + L.oy + rand(-1, 1), vx: rand(-6, 6), vy: rand(-4, 6), life: 0.5, c: rand(0, 1) < 0.5 ? '#c79cff' : '#ffd65a' });
        }
        if (once(r, 'w', k > 0.24)) txt(r, 'WHEE', 14, 4, '#c79cff', 0.9);
        if (once(r, 'land', k > 0.95)) for (let i = 0; i < 4; i++) r.emit({ type: 'dust', x: 24 + rand(-8, 8), y: GROUND, vx: rand(-8, 8), life: 0.5 });
      } },
    // 투명 망토 숨기: 은빛 망토가 위에서 스르르 내려와 덮이면 물결이 훑고 지나가며 몸이 사라진다.
    // 보이지 않는 동안엔 꼬리 끝까지 완전히 투명하고, 바닥에 발자국만 콩콩 찍히다가 망토를 휙 걷으면 짠
    invischloak: { len: 6,
      pose(p, k, at) {
        // 망토가 다 덮인 뒤(0.2~)엔 몸을 감춘다. 망토만 물결에 녹아 사라진다
        if (k < 0.2) { p.armL = p.armR = 'up'; p.eyes = k < 0.14 ? 'happy' : 'closed'; p.mouth = 'grin'; }
        else if (k < 0.82) { p.xf = { sx: 0.01, sy: 0.01 }; p.noShadow = true; }
        else { p.armL = p.armR = 'cheer'; p.eyes = 'star'; p.mouth = 'open'; p.dy = -Math.round(2 * bump(k, 0.82, 0.96)); }
      },
      step(r, k, at, dt, a) {
        if (k < 0.3) {
          // 망토: 머리 위에서 내려와 몸을 덮는다. 뾰족한 두건 → 어깨 → 아래로 살짝 퍼지는 자락, 목엔 금빛 걸쇠.
          // 은빛 천에 세로 주름과 별 무늬, 테두리는 짙은 남색. 덮인 뒤(0.2~)엔 위에서 아래로 물결이 지나가며 녹아 없어진다
          // (몸은 그동안 숨어 있으니 효과 층에 따로 그린다. 좌우 대칭이라 방향이 뒤집혀도 같다)
          const cover = Math.min(1, seg(k, 0.02, 0.2));
          const y0 = a.top - 16 + Math.round(cover * 13), y1 = y0 + Math.round(5 + cover * (GROUND - a.top - 2));
          const H = Math.max(1, y1 - y0), W = a.hw + 4, cx = r.scr(a.hx);
          const rows = [];
          for (let y = y0; y <= Math.min(y1, GROUND); y++) {
            const row = y - y0;
            const hw = row < 1 ? 1 : row < 3 ? 3 : row < 5 ? 5 : row < 7 ? a.hw + 1 : a.hw + 1 + Math.round(((row - 7) / Math.max(1, H - 7)) * 3);
            const wave = k > 0.2 ? seg(k, 0.2, 0.3) * (H + 6) - row : -1;
            let line = '';
            for (let dx = -W; dx <= W; dx++) {
              const x = cx + dx, adx = Math.abs(dx);
              if (adx > hw || wave > 3) { line += '.'; continue; }
              const edge = adx === hw || y === y0 || y === y1;
              line += wave > 0 ? 'G' : edge ? 'K' : row === 6 && adx <= 1 ? 'Y' : row >= 2 && row <= 4 && adx <= 2 ? 'h' : (x * 7 + y * 13) % 29 === 0 ? 'W' : row >= 7 && (dx + 40) % 3 === 0 ? 'f' : 'C';
            }
            rows.push(line);
          }
          spr(r, rows, cx - W, y0, { K: '#2a3050', C: '#bcc6e2', f: '#9aa6c8', h: '#6a7498', W: '#ffffff', Y: '#ffd65a', G: '#e8f4ff' });
        }
        if (once(r, 'sw', k > 0.2)) txt(r, 'SHHH', 16, 6, '#bfe6ff', 0.9);
        if (k >= 0.3 && k < 0.82) {
          // 발자국이 콩콩 (투명한 채로 살금살금 걷는다)
          const n = Math.floor(seg(k, 0.4, 0.78) * 6);
          for (let i = 0; i < n; i++) {
            const x = r.scr(a.hx - 10 + i * 4), al = Math.max(0.15, 0.8 - (n - i) * 0.12);
            spr(r, ['P.P', '.P.'], x - 1, GROUND - (i % 2) , { P: `rgba(110,90,80,${al.toFixed(2)})` });
          }
        }
        if (once(r, 'ta', k > 0.82)) {
          // 망토를 휙 걷어 던진다
          r.emit({ type: 'sprite', rows: ['..KKKK..', '.KbbbbK.', 'KbBbbBbK', 'KbbBbbbK', '.KbbbbK.', '..KKKK..'], x: r.scr(a.hx) - 4, y: a.top - 4, vx: r.facing < 0 ? -40 : 40, vy: -40, ay: 30, life: 0.8, map: { K: '#2a3050', b: '#bcc6e2', B: '#ffffff' } });
          sparks(r, 24, 30, 8, '#dff0ff'); txt(r, 'TA-DA', 14, 6, '#ffd65a', 1);
        }
      } },

    // ---------- 와이파이 훔쳐 쓰는 사이버펑크 해커 ----------
    // 해킹 타이핑: 노트북을 미친 듯이 두드리면 고양이 뒤로 작은 초록 숫자들이 비처럼 떨어진다. 끝에 와이파이 한 칸 획득
    hacktype: { len: 4.8,
      pose(p, k, at) {
        p.prop = 'laptop'; p.armL = p.armR = 'typefast'; p.dy = -3;
        p.eyes = k < 0.85 ? 'squint' : 'star'; p.brow = k < 0.85 ? 'angry' : undefined; p.mouth = k < 0.85 ? 'flat' : 'grin';
        if (k < 0.85) p.xf = { ox: Math.floor(at * 20) % 2 };
      },
      back(g, a, k, at) {
        // 작은 숫자 비 (3×3 글자): 열마다 속도가 다르고, 맨 앞 글자는 밝게, 뒤로 갈수록 흐리게
        const D = { 0: ['GGG', 'G.G', 'GGG'], 1: ['GG.', '.G.', 'GGG'] };
        const fade = k > 0.88 ? 1 - seg(k, 0.88, 1) : Math.min(1, k / 0.08);
        for (let col = 0; col < 12; col++) {
          const x = 1 + col * 4;
          const sp = 14 + hash(col) * 16;
          const head = ((at * sp + hash(col * 3) * 60) % 64) - 10;
          for (let i = 0; i < 4; i++) {
            const y = Math.round(head - i * 4);
            if (y < -3 || y > GROUND - 2) continue;
            const glyph = D[Math.floor(hash(col * 7 + i + Math.floor(at * 2)) * 2)];
            const al = (i === 0 ? 0.95 : i === 1 ? 0.7 : i === 2 ? 0.45 : 0.25) * fade;
            this.pattern(glyph, x, y, { G: i === 0 ? `rgba(200,255,215,${al.toFixed(2)})` : `rgba(60,220,110,${al.toFixed(2)})` }, false);
          }
        }
      },
      step(r, k, at, dt, a) {
        if (k < 0.85 && every(r, 'k', at, 0.45)) txt(r, 'TAK', r.scr(a.hx + rand(-10, 2)), a.top - 8, '#9fe3c8', 0.3, -4);
        if (once(r, 'w', k > 0.86)) { txt(r, 'WIFI+1', 12, 8, '#5aff8a', 1.2); sparks(r, 24, 12, 5, '#5aff8a'); }
      } },
    // 글리치: 몸이 픽셀 단위로 좌우로 찢어졌다가 (분홍·하늘 잔상) 치익 하고 복구
    glitch: { len: 3.8,
      pose(p, k, at) {
        const on = (k > 0.1 && k < 0.3) || (k > 0.45 && k < 0.7);
        p.eyes = on ? (Math.floor(at * 12) % 2 ? 'x' : 'wide') : k > 0.75 ? 'half' : 'open';
        p.mouth = on ? 'wavy' : 'flat';
        if (on) p.xf = { ox: [0, 3, -2, 1, -3][Math.floor(at * 18) % 5], sy: Math.floor(at * 14) % 3 === 0 ? 0.85 : 1 };
      },
      step(r, k, at, dt, a) {
        const on = (k > 0.1 && k < 0.3) || (k > 0.45 && k < 0.7);
        if (on) {
          const d = 2 + (Math.floor(at * 16) % 3);
          r.emit({ type: 'clone', dx: -d, a: 0.45, perFrame: true, fade: false });
          r.emit({ type: 'clone', dx: d, a: 0.45, perFrame: true, fade: false });
          r.emit({ type: 'tint', c: Math.floor(at * 10) % 2 ? '#ff4fd8' : '#4ff0ff', a: 0.28, perFrame: true, fade: false });
          if (every(r, 'l', at, 0.05)) r.emit({ type: 'line', x: Math.round(rand(6, 30)), y: Math.round(rand(20, 44)), len: Math.round(rand(6, 14)), life: 0.08, c: rand(0, 1) < 0.5 ? 'rgba(255,79,216,0.8)' : 'rgba(79,240,255,0.8)' });
        }
        if (once(r, 'e', k > 0.3)) txt(r, 'ERR', r.scr(a.hx + 4), a.top - 8, '#ff4fd8', 0.6);
        if (once(r, 'f', k > 0.75)) txt(r, 'FIXED', 14, 8, '#4ff0ff', 0.9);
      } },

    // ---------- 츄르를 수호하는 신의 기사단 ----------
    // ---------- 츄르를 수호하는 신의 기사단 ----------
    // 방패 막기: 방패를 번쩍 들자 날아온 생선뼈가 팅! 튕겨 나간다. 늠름하게 방패를 내리고 씨익
    shieldblock: { len: 4.4,
      pose(p, k, at) {
        if (k < 0.2) { p.eyes = 'wide'; p.ear = 1; p.lookX = -1; }
        else if (k < 0.62) { p.armL = p.armR = 'front'; p.eyes = 'squint'; p.brow = 'angry'; p.mouth = 'flat'; p.xf = k > 0.38 && k < 0.44 ? { ox: 2 } : undefined; }
        else { p.eyes = 'happy'; p.mouth = 'smile'; p.tail = 'wag'; }
      },
      front(g, a, k) {
        if (k < 0.2 || k >= 0.62) return;
        // 커다란 은빛 방패, 가운데 금빛 십자
        this.pattern(
          ['.KKKKKKK.', 'KSSSYSSSK', 'KSsSYSsSK', 'KYYYYYYYK', 'KSsSYSsSK', 'KSSSYSSSK', '.KSSYSSK.', '..KSYSK..', '...KKK...'],
          a.left - 5, a.ey - 2, { K: '#3a4250', S: '#dfe5ee', s: '#aab4c4', Y: '#f2c14e' },
        );
      },
      step(r, k, at, dt, a) {
        // 왼쪽에서 생선뼈가 날아온다 (방패 방향)
        if (k > 0.2 && k < 0.4) {
          const x = Math.round(-6 + seg(k, 0.2, 0.4) * (r.scr(a.left - 6) + 6));
          spr(r, ['K.K.K.KK', 'KKKKKKKW', 'K.K.K.KK'], r.facing < 0 ? 48 - x - 8 : x, a.ey, { K: '#e8e2d6', W: '#2b1a10' });
        }
        if (once(r, 'ting', k > 0.4)) { txt(r, 'TING', 4, a.top - 10, '#ffffff', 0.7); sparks(r, r.scr(a.left - 3), a.ey + 2, 6, '#ffffff'); r.emit({ type: 'sprite', rows: ['K.K.K.KK', 'KKKKKKKW', 'K.K.K.KK'], x: r.scr(a.left - 10), y: a.ey, vx: r.facing < 0 ? 30 : -30, vy: -30, ay: 90, life: 0.8, map: { K: '#e8e2d6', W: '#2b1a10' } }); }
      } },
    // 축복의 날개: 눈을 감자 하늘에서 빛기둥이 내리고, 등 뒤로 빛의 날개가 활짝. 빛기둥을 타고 두둥실 떠올랐다가 사뿐 내려온다
    holywings: { len: 6.4,
      pose(p, k, at) {
        p.eyes = k < 0.62 ? 'closed' : k < 0.9 ? 'sparkle' : 'happy'; p.mouth = 'smile'; p.tail = 'slow'; p.ear = k > 0.3 ? 1 : 0;
        p.noShadow = k > 0.32 && k < 0.9;
        p.xf = { oy: holyLift(k, at), py: GROUND };
      },
      back(g, a, k, at) {
        const oy = holyLift(k, at);
        // 빛기둥: 몸이 떠올라도 제자리 (떠오른 만큼 되돌려 그린다). 가운데가 밝고 가장자리는 옅은 금빛 선
        const on = k < 0.12 ? 0 : k > 0.92 ? 1 - seg(k, 0.92, 1) : Math.min(1, seg(k, 0.12, 0.24));
        if (on > 0) for (let y = -4 - oy; y <= GROUND - oy; y++) {
          const yy = y + oy;
          const top = Math.min(1, (yy + 4) / 10);
          for (let dx = -8; dx <= 8; dx++) {
            const e = Math.abs(dx) / 8;
            const al = on * top * (Math.abs(dx) === 8 ? 0.35 : 0.08 + 0.22 * (1 - e * e));
            this.px(a.hx + dx, y, Math.abs(dx) === 8 ? `rgba(242,193,78,${al.toFixed(2)})` : `rgba(255,248,215,${al.toFixed(2)})`, false);
          }
        }
        // 날개: 접힌 날개가 펼쳐지고, 떠 있는 동안 천천히 퍼덕
        if (k < 0.18) return;
        const FULL = ['.......KKK.', '.....KKWWWK', '...KKWWWWWK', '.KKWWWwWWWK', 'KWWWwWWWWK.', 'KWWwWWWwWK.', '.KWWWwWWK..', '..KWwWWK...', '...KKKK....'];
        const UP = ['KK.........', 'KWKK.......', 'KWWWKK.....', '.KWwWWKK...', '.KWWWwWWKK.', '..KWWWWwWWK', '...KWwWWWWK', '....KKWWWK.', '......KKK..'];
        const FOLD = ['...KK', '..KWK', '.KWwK', 'KWWK.', 'KwK..', '.K...'];
        const flap = Math.floor(at * (k > 0.35 && k < 0.8 ? 2.2 : 3.2)) % 2;
        const w = k < 0.26 ? FOLD : flap ? UP : FULL;
        const m = { K: '#c9a030', W: '#ffffff', w: '#ffe9a8' };
        const wy = a.top - (w === FOLD ? -3 : 1);
        this.pattern(w, a.left - w[0].length + 1, wy, m, false);
        this.pattern(mirror(w), a.right, wy, m, false);
      },
      step(r, k, at, dt, a) {
        if (once(r, 'o', k > 0.24)) { r.emit({ type: 'flash', life: 0.2 }); txt(r, 'BLESS', 14, 2, '#fff6a0', 1.2); }
        // 빛기둥을 타고 올라가는 빛 알갱이 + 하늘하늘 떨어지는 깃털
        if (k > 0.14 && k < 0.92 && every(r, 'l', at, 0.1)) r.emit({ type: 'star', x: 24 + rand(-7, 7), y: GROUND - rand(0, 6), vy: -rand(14, 24), life: 1.2, c: rand(0, 1) < 0.5 ? '#fff6a0' : '#ffffff' });
        if (k > 0.3 && k < 0.9 && every(r, 'f', at, 0.35)) r.emit({ type: 'sprite', rows: ['.W', 'WW', 'Wy'], x: Math.round(rand(8, 40)), y: 2, vx: rand(-4, 4), vy: 8, life: 2, map: { W: '#ffffff', y: '#e8c050' } });
        if (once(r, 'land', k > 0.9)) for (let i = 0; i < 6; i++) r.emit({ type: 'star', x: 24 + rand(-9, 9), y: GROUND, vx: rand(-10, 10), vy: -rand(2, 8), life: 0.6, c: '#fff6a0' });
      } },

    // ---------- 근두운 할부 중인 제천대성 ----------
    // 먼지로 둔갑술: 인을 맺자 펑! 풍성한 연기 속에서 동네 친구 '먼지'로 둔갑해 꾸벅꾸벅… 다시 펑! 연기와 함께 원래대로
    dustdisguise: { len: 6,
      start(r) {
        const fur = r.fur, acc = r.accessories.slice();
        r._undo = () => { r.fur = fur; r.accessories = acc; r.accessory = acc[0] || 'none'; };
      },
      pose(p, k, at, r) {
        const G = root.PetSprite.GUEST_FURS;
        const disguised = k >= 0.26 && k < 0.76;
        if (disguised && r && r._undo && G) { if (!r._dg) { r._dg = true; r.fur = G[0]; r.accessories = []; r.accessory = 'none'; } }
        else if (r && r._dg) { r._dg = false; const u = r._undo; if (u) u(); r._undo = u; }
        if (k < 0.18) { p.armL = p.armR = 'cross'; p.eyes = 'closed'; p.brow = 'angry'; p.mouth = 'flat'; p.xf = { ox: Math.floor(at * 16) % 2 }; }
        else if ((k >= 0.18 && k < 0.26) || (k >= 0.7 && k < 0.8)) { p.xf = { sx: 0.01, sy: 0.01 }; p.noShadow = true; }
        else if (disguised) { p.eyes = 'half'; p.mouth = Math.floor(at * 0.8) % 3 === 0 ? 'o' : 'flat'; p.ear = -1; p.tail = 'slow'; p.xf = { rot: Math.sin(at * 1.6) * 0.06, py: GROUND }; }
        else { p.eyes = 'wink'; p.mouth = 'grin'; p.tail = 'wag'; p.dy = -Math.round(2 * bump(k, 0.8, 0.95)); }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'c', k > 0.05)) txt(r, 'HENSHIN', 10, 4, '#ffd65a', 0.9);
        if (once(r, 'p1', k > 0.18)) { bigSmoke(r, 24, 34, 18); txt(r, 'POOF', 16, 10, '#ffffff', 0.8); }
        if (k > 0.18 && k < 0.3 && every(r, 's1', at, 0.06)) puffs(r, 24, 34, 2, '#ecebea');
        if (k > 0.34 && k < 0.7 && every(r, 'z', at, 0.9)) txt(r, 'Z', r.scr(a.hx + 5), a.top - 4, '#c9d6e3', 1, -5);
        if (once(r, 'p2', k > 0.7)) { bigSmoke(r, 24, 34, 18); txt(r, 'POOF', 16, 10, '#ffffff', 0.8); }
        if (k > 0.7 && k < 0.82 && every(r, 's2', at, 0.06)) puffs(r, 24, 34, 2, '#ecebea');
      } },
    // 여의봉 늘리기: 봉이 쭉쭉 늘어나 화면 밖까지 → 다시 줄어들어 귀에 쏙
    ruyistaff: { len: 5,
      pose(p, k, at) {
        if (k < 0.8) { p.armR = 'up'; p.eyes = k > 0.12 && k < 0.55 ? 'star' : 'open'; p.mouth = k > 0.12 && k < 0.55 ? 'open' : 'smile'; p.lookY = -1; }
        else { p.armR = 'kiss'; p.eyes = 'wink'; p.mouth = 'grin'; p.tail = 'wag'; }
      },
      front(g, a, k) {
        const R = '#c8242c', r2 = '#8a1018', Y = '#ffd65a';
        // 봉 길이: 8 → 화면 밖(위) → 3 → 귀 속으로
        const len = k < 0.12 ? 8 : k < 0.4 ? Math.round(8 + seg(k, 0.12, 0.4) * 40) : k < 0.55 ? 48 : k < 0.8 ? Math.round(48 - seg(k, 0.55, 0.8) * 45) : 3;
        if (k < 0.8) {
          const x = a.right + 1, yb = a.cy - 1;
          for (let i = 0; i < len; i++) { const y = yb - i; this.px(x, y, i < 2 || i > len - 3 ? Y : R); this.px(x + 1, y, i < 2 || i > len - 3 ? '#c98f12' : r2); }
        } else {
          // 귀에 쏙: 귀 옆에 금빛 끝만 살짝
          this.px(a.right - 1, a.earTop + 1, Y);
          this.px(a.right - 1, a.earTop + 2, R);
        }
      },
      step(r, k, at, dt, a) {
        if (k > 0.12 && k < 0.4 && every(r, 'g', at, 0.3)) txt(r, 'GROW', r.scr(a.hx - 12), a.top - 4 - Math.round(seg(k, 0.12, 0.4) * 8), '#ffd65a', 0.4);
        if (once(r, 's', k > 0.4)) { r.emit({ type: 'shock', x: r.scr(a.right + 1), y: 2, r: 2, life: 0.4 }); txt(r, 'BOING', 4, 10, '#ffffff', 0.8); }
        if (once(r, 'e', k > 0.8)) r.emit({ type: 'spark', x: r.scr(a.right), y: a.earTop, life: 0.6, c: '#ffd65a' });
      } },
    // 근두운 한 바퀴: 소용돌이 꼬리가 달린 금빛 뭉게구름을 타고, 옆으로 휙 나갔다가 뒤로 작게 한 바퀴 돌아온다 (구름 끝까지 창 안)
    cloudloop: { len: 6.6,
      pose(p, k, at) {
        p.noShadow = true; p.tail = 'wag';
        const L = loopPath(k, at, 0.22, 0.84, 11, 13, 0.55);
        p.xf = { ox: L.ox, oy: -5 + L.oy, sx: L.s, sy: L.s, py: GROUND };
        p.eyes = L.back > 0.3 ? 'happy' : 'open'; p.mouth = L.back > 0.3 ? 'open' : 'smile'; p.ear = L.back > 0.3 ? 1 : 0;
      },
      back(g, a, k, at) {
        // 뭉게구름: 봉긋한 윗머리 셋, 흰 하이라이트 · 금빛 그늘 · 짙은 금빛 외곽선. 뒤쪽엔 돌돌 말린 소용돌이 꼬리가 살랑
        const x0 = a.cx - 11, y0 = GROUND - 4;
        const K = '#b8861a', W = '#fffdf4', Y = '#ffe89a', y = '#f2c14e';
        this.pattern(
          ['......KKK....KKKK.....', '....KKWWWK..KWWWWKK...', '..KKWWWWWWKKWWWWWWWK..', '.KWWWWYWWWWWWWWWYWWWKK', 'KWWYYYYYWWWWYYYYYYWWYK', 'KYYyyYYYYYYYYyyYYYYyyK', '.KyyKKyyyKKyyyyKKyyyK.', '..KK..KKK..KKKK..KKK..'],
          x0, y0, { K, W, Y, y },
        );
        // 소용돌이 꼬리 (살짝 흔들린다)
        const sw = Math.floor(at * 3) % 2;
        this.pattern(sw ? ['.KKK.', 'KYWYK', 'KY.KK', 'KYK..', '.K...'] : ['..KKK', '.KYWK', 'KY.YK', 'KYKK.', '.K...'], x0 - 4, y0 + 1, { K, Y, W });
      },
      step(r, k, at, dt, a) {
        const L = loopPath(k, at, 0.22, 0.84, 11, 13, 0.55);
        if (L.moving && every(r, 't', at, 0.05)) r.emit({ type: 'puff', x: 24 + L.ox - Math.sign(Math.cos(seg(k, 0.22, 0.84) * Math.PI * 2) || 1) * 8 + rand(-2, 2), y: GROUND - 6 + L.oy + rand(-2, 2), life: 0.5, c: rand(0, 1) < 0.5 ? 'rgba(255,232,154,0.85)' : 'rgba(255,253,244,0.9)' });
        if (once(r, 'w', k > 0.22)) txt(r, 'WHOOSH', 10, 4, '#ffd65a', 0.9);
      } },

    // ---------- 츄르신 내린 전투 무당 ----------
    // ---------- 츄르신 내린 전투 무당 ----------
    // 방울 흔들기: 방울 꾸러미를 짤랑짤랑 흔들면 오색천이 휘날리고 금빛 소리가 퍼진다
    bellshake: { len: 4.4,
      pose(p, k, at) {
        p.armR = 'up'; p.eyes = 'closed'; p.mouth = Math.floor(at * 3) % 2 ? 'o' : 'flat';
        p.xf = { rot: Math.sin(at * 6) * 0.07, py: GROUND };
      },
      front(g, a, k, at) {
        const x = a.right + 2, y = a.top - 6;
        const sh = Math.floor(at * 12) % 2;
        // 방울 꾸러미 (금빛 방울 다섯) + 손잡이
        this.pattern(['.B.B.', 'BbBbB', '.B.B.', '..K..', '..K..'], x - 2 + sh, y, { B: '#ffd65a', b: '#c98f12', K: '#6a4020' });
        // 오색천: 손잡이 끝에서 다섯 가닥이 물결치며 휘날린다
        const cols = ['#e0303c', '#ffd65a', '#3f7fe0', '#ffffff', '#3fae62'];
        cols.forEach((col, i) => {
          for (let j = 0; j < 8; j++) this.px(x + 1 + j - (i > 2 ? 0 : 0), y + 5 + i + Math.round(Math.sin(at * 8 + j * 0.7 + i) * 1.2), col);
        });
      },
      step(r, k, at, dt, a) {
        if (every(r, 'j', at, 0.3)) { r.emit({ type: 'ring', x: r.scr(a.right + 2), y: a.top - 5, r: 2, grow: 6, life: 0.5, c: 'rgba(255,214,90,0.8)' }); }
        if (every(r, 't', at, 0.9)) txt(r, 'JING', r.scr(a.hx - 8), a.top - 10, '#ffd65a', 0.5);
      } },
    // 부채 굿: 오른손의 합죽선을 촤르륵 펼치고 빙글빙글 돌면 꽃잎이 흩날린다. 부채 끝의 빨간 술이 흔들린다
    fandance: { len: 5.4,
      pose(p, k, at) {
        p.armR = 'up'; p.eyes = 'happy'; p.mouth = 'smile'; p.tail = 'wag';
        const spin = k > 0.3 && k < 0.7 ? Math.floor(seg(k, 0.3, 0.7) * 8) % 2 === 1 : false;
        p.xf = { flipX: spin, rot: Math.sin(at * 3) * 0.06, py: GROUND };
        p.dy = k > 0.3 && k < 0.7 ? -1 : 0;
      },
      front(g, a, k, at) {
        // 합죽선: 손잡이(사북)를 중심으로 부챗살이 퍼진다. 처음엔 접혀 있다가 촤르륵 펼쳐진다
        const open = k < 0.06 ? 0.15 : Math.min(1, 0.15 + seg(k, 0.06, 0.16) * 0.85);
        const px0 = a.right + 2, py0 = a.top - 1;
        const tilt = Math.sin(at * 4) * 0.12;
        const a0 = -Math.PI / 2 - open * 1.15 + tilt, a1 = -Math.PI / 2 + open * 1.15 + tilt;
        const R = 9;
        for (let y = py0 - R - 1; y <= py0; y++) for (let x = px0 - R - 1; x <= px0 + R + 1; x++) {
          const dx = x - px0, dy = y - py0;
          const d = Math.hypot(dx, dy);
          if (d < 2 || d > R + 0.5) continue;
          const ang = Math.atan2(dy, dx);
          if (ang < a0 - 0.05 || ang > a1 + 0.05) continue;
          const t01 = (ang - a0) / Math.max(0.01, a1 - a0);
          const rib = Math.abs(((t01 * 10) % 1) - 0.5) > 0.42;
          const edge = ang < a0 + 0.08 || ang > a1 - 0.08 || d > R - 0.6;
          let col;
          if (edge) col = '#5a1a10';
          else if (d > R - 2) col = '#e0303c'; // 위쪽 빨간 띠
          else if (d < 4) col = '#b07a44'; // 아래쪽 대나무 살
          else if (rib) col = '#e8d8b8';
          else col = '#fffaf0'; // 한지
          // 매화 무늬 두 송이
          if (!edge && d >= 5 && d <= 6.2 && (Math.abs(t01 - 0.3) < 0.05 || Math.abs(t01 - 0.7) < 0.05)) col = '#ff7aa8';
          this.px(x, y, col);
        }
        // 사북(금빛 못) + 빨간 술
        this.px(px0, py0, '#ffd65a');
        const sw = Math.round(Math.sin(at * 5) * 1);
        this.pattern(['Y', 'R', 'R', 'r'], px0 + sw, py0 + 1, { Y: '#ffd65a', R: '#e0303c', r: '#9a1a24' });
      },
      step(r, k, at, dt, a) {
        if (every(r, 'p', at, 0.14)) r.emit({ type: 'sprite', rows: ['PP', 'Pp'], x: Math.round(rand(2, 44)), y: -2, vx: rand(-6, 6), vy: rand(10, 16), life: 2, map: { P: rand(0, 1) < 0.5 ? '#ff9bb8' : '#ffd0e0', p: '#ffffff' } });
        if (once(r, 's', k > 0.3)) txt(r, 'SPIN', 16, 6, '#ff9bb8', 0.8);
      } },
    // 츄르신 강림: 부르르 떨다가 번쩍! 눈동자가 사라지고 흰자만 남은 채(신내림) 둥실 떠오르고, 등 뒤로 거대한 고양이 신이 은은하게 비친다
    // 고양이 신: 금빛 외곽선 · 연분홍 귓속과 귀 끝 털 · 이마의 호랑이 줄무늬와 츄르 보석 · 지그시 감은 눈과 속눈썹 · 분홍 코와 ω 입 ·
    // 수염 · 볼 털 · 목의 복슬 갈기. 뒤로 광배(둥근 테)와 빛살이 천천히 돈다
    churugod: { len: 5.6,
      pose(p, k, at) {
        if (k < 0.22) { p.eyes = 'closed'; p.mouth = 'flat'; p.xf = { ox: Math.floor(at * 18) % 2 }; }
        else { p.eyes = 'wide'; p.mouth = 'o'; p.ear = 1; p.tail = 'up'; p.dy = -Math.round(4 * bump(k, 0.22, 0.95)); p.noShadow = k > 0.3 && k < 0.9; }
      },
      back(g, a, k, at) {
        if (k < 0.24) return;
        const on = Math.min(1, seg(k, 0.24, 0.42)) * (k > 0.88 ? 1 - seg(k, 0.88, 1) : 1);
        const br = 0.85 + 0.15 * Math.sin(at * 3);
        const A = (x) => (x * on * br).toFixed(2);
        // 고양이 신은 머리 위로 크게: 감은 눈 줄이 고양이 정수리 바로 위에 오도록 (얼굴이 고양이에 가려지지 않게)
        const cx = a.hx, cy = a.top - 4;
        // 광배: 둥근 테 + 길고 짧은 빛살이 번갈아 천천히 돈다
        for (let i = 0; i < 48; i++) {
          const ang = (i / 48) * Math.PI * 2;
          this.px(Math.round(cx + Math.cos(ang) * 17), Math.round(cy + 1 + Math.sin(ang) * 15), `rgba(255,214,90,${A(0.4)})`, false);
        }
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2 + at * 0.3;
          const len = i % 2 ? 3 : 6;
          for (let j = 0; j < len; j++) this.px(Math.round(cx + Math.cos(ang) * (18 + j)), Math.round(cy + 1 + Math.sin(ang) * (16 + j)), `rgba(255,214,90,${A(0.32 * (1 - j / len))})`, false);
        }
        // 고양이 신 얼굴 (왼쪽 절반을 그리고 거울로 편다. 가운데 열 = 16번째 글자)
        const half = [
          '...O............',
          '...OO...........',
          '...OtO..........',
          '...OPtO.........',
          '...OPPFO........',
          '...OPPPFO.......',
          '..OPPPPFFOOOOOOO',
          '..OPPPFFFFFFFFFF',
          '.OFPPFFFFFFLFFFW',
          '.OFFFFFFFFFLFFGG',
          'OFFFFFFFFFFFFFFG',
          'OFFFFFFFFFFFFFFF',
          'OFFFFLFFFLFFFFFF',
          'OFFFFFLLLFFFFFFF',
          'OfFFFFlFFFFFFFFF',
          'OfLLLFFFFFFFFFNN',
          'OfFFFFFFFFFFFFFL',
          'OfLLLFFFFFFFFLLF',
          'OffFFFFFFFFFFFFF',
          '.OffFFFFFFFFFFFF',
          'OffffFFFFFFFFFFF',
          '.OOffffFFFFFFFFF',
          'OfffffffFFFFFFFF',
          '.OOOffffffffffff',
          '....OOOOOOOOOOOO',
        ];
        const rows = half.map((h) => h + h.slice(0, 15).split('').reverse().join(''));
        const tw = Math.floor(at * 3) % 3 === 0;
        const map = {
          O: `rgba(242,176,36,${A(0.8)})`, F: `rgba(255,238,180,${A(0.26)})`, f: `rgba(245,205,120,${A(0.34)})`,
          P: `rgba(255,165,160,${A(0.5)})`, t: `rgba(255,240,200,${A(0.7)})`, L: `rgba(185,115,20,${A(0.85)})`, l: `rgba(185,115,20,${A(0.5)})`,
          N: `rgba(255,120,150,${A(0.85)})`, G: `rgba(255,90,160,${A(0.9)})`, W: tw ? '#ffffff' : `rgba(255,224,240,${A(0.9)})`,
        };
        this.pattern(rows, cx - 15, cy - 13, map, false);
      },
      front(g, a, k, at) {
        if (k < 0.22) return;
        // 신내림: 눈동자는 사라지고 흰자만 하얗게, 둘레가 옅게 빛난다
        for (const x0 of [a.eyeL, a.eyeR]) {
          for (let i = 0; i < a.ew; i++) for (let j = 0; j < a.eh; j++) this.px(x0 + i, a.ey + j, '#ffffff');
          const gl = (0.25 + 0.2 * Math.sin(at * 6)).toFixed(2);
          for (let i = -1; i <= a.ew; i++) { this.px(x0 + i, a.ey - 1, `rgba(255,255,255,${gl})`, false); this.px(x0 + i, a.ey + a.eh, `rgba(255,255,255,${gl})`, false); }
        }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'f', k > 0.22)) { r.emit({ type: 'flash', life: 0.3 }); txt(r, 'CHURU', 14, 2, '#ffd65a', 1.4, -1); }
        if (k > 0.3 && k < 0.9 && every(r, 'e', at, 0.18)) r.emit({ type: 'ember', x: 24 + rand(-14, 14), y: GROUND - rand(0, 4), vy: -14, life: 1 });
      } },

    // ---------- 월요병 퇴마 엑소시스트 ----------
    // ---------- 월요병 퇴마 엑소시스트 ----------
    // 성수 뿌리기: 옆에 떠 있던 검은 악령에게 성수를 휙! 맞은 악령이 비명을 지르며 흩어진다
    holywater: { len: 4.8,
      pose(p, k, at) {
        if (k < 0.3) { p.armR = 'hold'; p.eyes = 'squint'; p.brow = 'angry'; p.lookX = 1; p.mouth = 'flat'; }
        else if (k < 0.45) { p.armR = 'out'; p.eyes = 'wide'; p.brow = 'angry'; p.mouth = 'open'; p.xf = { ox: 1 }; }
        else { p.eyes = 'happy'; p.mouth = 'smile'; p.tail = 'wag'; }
      },
      front(g, a, k) {
        if (k >= 0.45) return;
        // 성수병: 파란 물이 든 유리병 + 은빛 십자 뚜껑
        const x = a.right + (k < 0.3 ? 1 : 3), y = a.cy - (k < 0.3 ? 4 : 7);
        this.pattern(['.S.', 'SSS', '.S.', 'KWK', 'KBK', 'KBK', '.K.'], x, y, { S: '#dfe5ee', K: '#3a4250', W: '#e8f4ff', B: '#5ab8ff' });
      },
      step(r, k, at, dt, a) {
        // 악령: 오른쪽 위에 둥실. 맞기 전까지 이죽이죽
        const gx = r.scr(a.right + 11) - 2, gy = a.top - 2 + Math.round(Math.sin(at * 3) * 1.5);
        const GH = ['.KKK.', 'KKKKK', 'KRKRK', 'KKKKK', 'KkKkK', 'K.K.K'];
        const GM = { K: '#1c1424', k: '#3a2a4a', R: '#ff3a4a' };
        if (k < 0.5) spr(r, Math.floor(at * 4) % 2 ? GH : GH.map((row, j) => (j === 5 ? '.K.K.' : row)), gx, gy, GM);
        if (k > 0.3 && k < 0.45 && every(r, 'w', at, 0.03)) r.emit({ type: 'spray', x: r.scr(a.right + 4), y: a.cy - 7, vx: (r.facing < 0 ? -1 : 1) * rand(20, 40), vy: rand(-26, -8), ay: 60, life: 0.5, c: rand(0, 1) < 0.5 ? '#5ab8ff' : '#dff0ff' });
        if (once(r, 'hit', k > 0.45)) {
          txt(r, 'EEK', gx - 2, gy - 8, '#ff9aa0', 0.8);
          // 흩어진다: 검은 조각이 사방으로 튀며 사라진다
          for (let i = 0; i < 10; i++) r.emit({ type: 'sprite', rows: ['KK', 'K.'], x: gx + 2, y: gy + 2, vx: rand(-30, 30), vy: rand(-30, 10), life: rand(0.5, 0.9), map: { K: i % 3 ? '#1c1424' : '#3a2a4a' } });
          for (let i = 0; i < 4; i++) r.emit({ type: 'spark', x: gx + rand(-3, 6), y: gy + rand(-3, 6), life: 0.6, c: '#dff0ff' });
        }
      } },
    // 악마 강림: 등 뒤 십자가의 불이 프스슥 꺼지며 연기가 피어오르고, 검보라 연기에 휩싸인 고양이가 사악한 악마로 변한다
    // (붉게 물든 몸 · 굽은 뿔 · 박쥐 날개 · 빨갛게 타는 눈 · 끝이 뾰족한 꼬리). 다시 연기가 걷히면 불이 화르륵 붙고 시치미
    demonturn: { len: 6.4,
      start(r) { r._undo = () => { r.fireOut = 0; }; },
      pose(p, k, at, r) {
        if (r) r.fireOut = k < 0.05 ? 0 : k < 0.2 ? seg(k, 0.05, 0.2) : k < 0.86 ? 1 : 1 - seg(k, 0.86, 0.96);
        if (k < 0.24) { p.eyes = 'wide'; p.mouth = 'o'; p.sweat = k > 0.12; p.lookY = -1; }
        else if (k < 0.34) { p.eyes = 'closed'; p.mouth = 'flat'; p.xf = { ox: Math.floor(at * 20) % 2 }; }
        else if (k < 0.84) { p.eyes = 'squint'; p.brow = 'angry'; p.mouth = 'grin'; p.ear = -1; p.tail = 'flick'; p.dy = -Math.round(2 * bump(k, 0.34, 0.84)); }
        else { p.eyes = 'side'; p.mouth = 'flat'; p.sweat = true; }
      },
      back(g, a, k, at) {
        if (k < 0.34 || k >= 0.84) return;
        // 박쥐 날개: 뼈대 셋 + 막, 천천히 퍼덕
        const up = Math.floor(at * 3) % 2;
        const W = up
          ? ['K.........', 'KK....K...', 'KmK..KmK..', 'KmmKKmmmK.', 'KmmmmmmmmK', '.KmmKmmmK.', '..KK.KKK..']
          : ['..........', 'K.........', 'KKK...K...', 'KmmKKKmK..', 'KmmmmmmmKK', '.KmmmKmmmK', '..KKK.KKK.'];
        const m = { K: '#1a0a14', m: '#5a1030' };
        this.pattern(W, a.left - 10, a.top, m);
        this.pattern(mirror(W), a.right + 1, a.top, m);
      },
      front(g, a, k, at) {
        if (k < 0.34 || k >= 0.84) return;
        // 굽은 뿔 (끝은 붉게)
        this.pattern(['R...', 'KK..', '.KK.', '.KK.'], a.hx - 6, a.top - 4, { K: '#1a0a14', R: '#c8202c' });
        this.pattern(['...R', '..KK', '.KK.', '.KK.'], a.hx + 3, a.top - 4, { K: '#1a0a14', R: '#c8202c' });
        // 빨갛게 타는 눈
        const fl = Math.floor(at * 8) % 2;
        for (const x0 of [a.eyeL, a.eyeR]) { for (let i = 0; i < a.ew; i++) this.px(x0 + i, a.ey, fl ? '#ff3a3a' : '#ff8a5a'); this.px(x0, a.ey - 1, 'rgba(255,40,40,0.5)', false); }
        // 뾰족한 꼬리 끝 (몸 옆으로)
        this.pattern(['.K.', 'KRK', '.K.', '.K.'], a.right + 2, a.cy - 2, { K: '#1a0a14', R: '#c8202c' });
      },
      step(r, k, at, dt, a) {
        if (once(r, 'ps', k > 0.08)) txt(r, 'PSSST', 12, 2, '#c9c6c2', 1);
        if (once(r, 'sm', k > 0.24)) bigSmoke(r, 24, 34, 20, 'rgba(70,30,80,0.9)', 'rgba(40,15,45,0.9)');
        if (k > 0.24 && k < 0.34 && every(r, 's', at, 0.05)) puffs(r, 24, 34, 2, 'rgba(70,30,80,0.85)');
        if (k >= 0.34 && k < 0.84) {
          r.emit({ type: 'tint', c: '#7a0a20', a: 0.38, perFrame: true, fade: false });
          if (every(r, 'd', at, 0.12)) r.emit({ type: 'puff', x: 24 + rand(-12, 12), y: GROUND - rand(0, 3), vy: -rand(8, 14), life: 0.9, c: 'rgba(60,15,40,0.7)' });
        }
        if (once(r, 'mu', k > 0.4)) txt(r, 'MUHAHA', 12, 2, '#ff5a5a', 1.4, -2);
        if (once(r, 'back', k > 0.84)) { bigSmoke(r, 24, 34, 14, 'rgba(70,30,80,0.9)', '#c9c6c2'); txt(r, 'FWOOSH', 10, 2, '#ffb02a', 0.9); }
      } },
  };
  // 축복의 날개: 떠오르는 높이 (0.3~0.55 올라감 · 떠서 둥실 · 0.72~0.92 사뿐 내려옴)
  function holyLift(k, at) {
    if (k < 0.3 || k > 0.92) return 0;
    const up = k < 0.55 ? ease(seg(k, 0.3, 0.55)) : k < 0.72 ? 1 : 1 - ease(seg(k, 0.72, 0.92));
    return -Math.round(up * 12 + (k > 0.5 && k < 0.75 ? Math.sin(at * 2.5) * 1 : 0));
  }
  Object.assign(root.PetSprite.MOTIONS, M);
})(window);
