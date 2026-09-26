// 악세사리 그림. sprite.js 의 PetRenderer 가 이걸 꺼내 그린다.
//  front(g, a, c, t) : 몸 위에 그린다        back(g, a, c, t) : 몸보다 먼저(뒤에) 그린다
//  ears: true        : 모자를 그린 뒤 귀를 다시 찍어서 귀가 구멍으로 쏙 나온 것처럼 보이게 한다
// 기준점 a: hx(머리 가운데 열) top(정수리 줄) earTop(귀 맨 윗줄) ey(눈 줄) eyeL/eyeR(눈 왼쪽 열) ew/eh(눈 크기)
//          fx(얼굴 가운데 열) my(코 줄) left/right(머리 양끝) neck
// 색 c: sprite.js 의 PAL 글자 하나 = 색 하나. K 는 고양이 외곽선 색
// 상점 목록·가격은 main/shop.js, 이름은 i18n.js 의 'item.<key>' 에 있다.
(function (root) {
  const GROUND = root.PetSprite.GROUND;
  const sway = (t, f = 2.2, a = 0.9) => Math.round(Math.sin(t * f) * a);

  // 무기를 쥔 오른앞발
  function heldPaw(r, g, x, y) {
    r.ellipse(x, y, 2, 1.6, g.c.body, g.c.outline);
  }

  // 줄마다 가로로 밀어서(dx) 찍는다 — 비스듬한 모자용
  function rowsAt(r, rows, x, y, map, dxs) {
    rows.forEach((row, j) => r.pattern([row], x + (dxs ? dxs[j] || 0 : 0), y + j, map));
  }

  const ACC = {
    // ================= 원래 있던 것 (다듬은 버전) =================
    sprout: {
      // 잎 두 장 달린 새싹이 정수리에서 자라고 살랑살랑 흔들린다
      front(g, a, c, t) {
        const s = sway(t, 2.2, 0.9);
        this.pattern(['.KK...KK.', 'KNNK.KNNK', 'KNnNKNnNK', '.KNNnNNK.', '..KKnKK..'], a.hx - 4 + s, a.top - 7, c);
        this.px(a.hx, a.top - 2, c.n);
        this.px(a.hx, a.top - 1, c.n);
      },
    },
    vpEggshell: {
      // Vault Pet 기념: 다섯 친구가 태어난 알의 껍데기를 모자처럼 쓴다. 톱니처럼 깨진 윗단, 민트 반점, 가끔 톡 기울어진다
      front(g, a, c, t) {
        const m = { K: c.K || '#2b1a10', E: '#fff6e0', e: '#ecd9b0', S: '#8fd3c1' };
        const tilt = t % 4 < 0.35 ? 1 : 0;
        this.pattern(['.K...K...K.', 'KEK.KEK.KEK', 'KEEKESEKEEK', 'KSEEEEEEeSK', 'KEEeEEEeEEK'], a.hx - 5 + tilt, a.top - 4, m);
      },
    },
    bowtie: {
      // 입 아래 매듭이 있는 나비넥타이. 하이라이트로 광택
      front(g, a, c) {
        this.pattern(['KKK...KKK', 'KHRKKKRRK', 'KRrKRKrRK', 'KKKKKKKKK'], a.hx - 4, Math.min(a.my + 2, GROUND - 3), c);
      },
    },
    glasses: {
      // 고죠 사토루처럼 작고 동그란 까만 선글라스. 가는 은테 다리, 렌즈 위쪽에 빛 한 점
      front(g, a, c, t) {
        const m = { F: '#3a3a44', L: '#15151c', H: '#8a94b0' };
        for (const x of [a.eyeL, a.eyeR]) this.pattern(['.FF.', 'FHLF', 'FLLF', '.FF.'], x - 1, a.ey - 1, m);
        // 코걸이: 렌즈 윗줄끼리 가늘게 잇는다
        for (let x = a.eyeL + a.ew + 1; x < a.eyeR - 1; x++) this.px(x, a.ey - 1, m.F);
        this.px(a.eyeL - 2, a.ey, m.F);
        this.px(a.eyeR + a.ew + 1, a.ey, m.F);
        // 가끔 렌즈를 스치는 반짝
        if (t % 3.2 < 0.18) this.px(a.eyeR + 1, a.ey, '#ffffff');
      },
    },
    headphones: {
      // 진짜 헤드폰처럼: 밴드가 귀 위로 머리를 넘어가고, 이어컵은 머리 양옆에 볼록 튀어나온다.
      // 컵 안쪽 가장자리가 머리 외곽선에 겹치고, 주황 쿠션이 머리를 누른다
      front(g, a, c) {
        this.pattern(
          [
            '......KKKKKKKKK......',
            '....KKDDDDDDDDDKK....',
            '...KDDKKKKKKKKKDDK...',
            '..KDK...........KDK..',
            '..KDK...........KDK..',
            'KKKKK...........KKKKK',
            'KDDDK...........KDDDK',
            'KDHCK...........KCHDK',
            'KDDCK...........KCDDK',
            'KDDDK...........KDDDK',
            '.KKK.............KKK.',
          ],
          a.hx - 10, a.earTop - 4, c,
        );
      },
    },
    nightcap: {
      // 푹 눌러쓴 헐렁한 수면 모자 (2026-09-24: 귀가 양옆으로 삐져나와서 산타 모자처럼 머리 폭을 다 덮게 넓혔다).
      // 비스듬한 줄무늬, 끝은 옆으로 축 늘어져 볼 옆까지 내려오고 방울이 대롱대롱
      front(g, a, c, t) {
        this.pattern(
          ['....KKKK........', '...KEEEEKK......', '..KEeEEEEeKK....', '.KEEEeEEEEeEK...', '.KEEEEeEEEEeEK..',
            'KWWWWWWWWWWWKEK.', 'KWHWWWWWWWWWKeK.', '.KKKKKKKKKKKKEK.', '............KeK.', '............KK..'],
          a.hx - 6, a.top - 5, c,
        );
        this.ellipse(a.hx + 7.5, a.top + 5 + sway(t, 3, 1), 1.7, 1.4, c.W, c.K);
      },
    },
    beanie: {
      // 머리 폭을 다 덮는 뜨개 비니. 골지 접단에 방울, 귀가 구멍으로 쏙 나온다
      ears: true,
      front(g, a, c) {
        this.pattern(
          ['....KKKKK....', '..KKBBBBBKK..', '.KBBbBBBbBBK.', 'KBBBBBBBBBBBK', 'KBbBBBbBBBbBK', 'KBBBBBBBBBBBK', 'KbBbBbBbBbBbK', 'KbBbBbBbBbBbK', 'KKKKKKKKKKKKK'],
          a.hx - 6, a.top - 6, c,
        );
        this.ellipse(a.hx, a.top - 7, 1.8, 1.4, c.W, c.K);
      },
    },
    party: {
      // 살짝 기울어진 고깔에 별 방울, 노란 땡땡이
      front(g, a, c, t) {
        rowsAt(this, ['...K...', '..KYK..', '..KVK..', '.KVYVK.', '.KvVvK.', 'KVVYVVK', 'KKKKKKK'], a.hx - 3, a.top - 7, c, [2, 2, 1, 1, 0, 0, 0]);
        this.pattern(['.Y.', 'YWY', '.Y.'], a.hx + 1, a.top - 10 + sway(t, 4, 1), { Y: c.Y, W: c.W });
      },
    },
    scarf: {
      // 코 밑까지 끌어올린 뜨개 목도리. 눈만 빼꼼
      front(g, a, c) {
        const y = Math.min(a.my + 1, GROUND - 4);
        this.pattern(['.KKKKKKKKKKKKK.', 'KRRrRRrRRrRRrRK', 'KRRRRRRRRRRRRRK', '.KKKKKKKKKKKKK.'], a.hx - 7, y, c);
        this.pattern(['KRK', 'KrK', 'WKW'], a.hx + 4, y + 2, c);
      },
    },
    chef: {
      // 뭉게뭉게 부푼 윗단 + 주름진 띠
      front(g, a, c) {
        this.pattern(['..KKK.KKK..', '.KWWWKWWWK.', 'KWWHWWWWWWK', 'KWWWWWWWWWK', '.KWWWWWWWK.', '.KWGWGWGWK.', '.KWGWGWGWK.', '.KKKKKKKKK.'], a.hx - 5, a.top - 7, c);
      },
    },
    santa: {
      // 털 띠 밑으로 끝이 오른쪽 볼 옆까지 축 늘어지고 방울이 대롱
      front(g, a, c, t) {
        this.pattern(
          ['....KKKK........', '...KRRRRKK......', '..KRRRRRRRKK....', '.KRRrRRRRRRRK...', '.KRRRRRRRRRRRK..',
            'KWWWWWWWWWWWKRK.', 'KWGWWGWWGWWWKRK.', '.KKKKKKKKKKKKRK.', '............KK..'],
          a.hx - 6, a.top - 5, c,
        );
        this.ellipse(a.hx + 7.5, a.top + 4 + sway(t, 3, 1), 1.7, 1.4, c.W, c.K);
      },
    },
    halo: {
      // 얇은 금빛 고리가 머리 위에서 둥실둥실. 뒤쪽 테는 어둡게, 앞쪽 테는 밝게. 반짝이가 앞 테를 따라 돈다
      front(g, a, c, t) {
        const y = a.top - 7 + sway(t, 2, 1);
        for (let x = a.hx - 5; x <= a.hx + 5; x++) this.px(x, y + 3, 'rgba(255,236,150,0.3)', false);
        this.pattern(['..yyyyyyy..', '.y.......y.', 'Y.........Y', '.YYYYYYYYY.'], a.hx - 5, y, { y: '#d9a21f', Y: '#ffd65a' });
        const tw = Math.floor(t * 5) % 9;
        this.px(a.hx - 4 + tw, y + 3, '#fff6c0');
      },
    },
    crown: {
      // 귀 사이에 올린 작은 금관. 루비·사파이어, 반짝
      front(g, a, c, t) {
        this.pattern(['K..K..K', 'KYKYKYK', 'KYYYYYK', 'KYRYBYK', 'KyyyyyK'], a.hx - 3, a.top - 5, c);
        if (Math.floor(t * 1.5) % 3 === 0) this.pattern(['.W.', 'WWW', '.W.'], a.hx + 3, a.top - 7, { W: '#fff' });
      },
    },

    // ================= 새로 들어온 것 =================
    frog: {
      // 머리 위에 개구리 눈알 두 개. 후드가 얼굴을 폭 감싼다
      front(g, a, c) {
        this.pattern(
          ['..KKK.....KKK..', '.KWWWK...KWWWK.', '.KWkWKKKKKWkWK.', '.KNNNNNNNNNNNK.', 'KNNNNNNNNNNNNNK', 'KNNnNNNNNNNnNNK', 'KNNNNNNNNNNNNNK',
            'KNNKKKKKKKKKNNK', 'KNNK.......KNNK', 'KNNK.......KNNK', 'KNNK.......KNNK', '.KKK.......KKK.'],
          a.hx - 7, a.top - 6, c,
        );
      },
    },
    bunny: {
      // 분홍 속귀가 있는 토끼 귀 머리띠. 오른쪽 귀는 살짝 기울었다
      front(g, a, c) {
        const ear = ['.KK.', 'KWWK', 'KWPK', 'KWPK', 'KWPK', 'KWPK', 'KWWK', 'KWWK'];
        rowsAt(this, ear, a.hx - 5, a.top - 9, c);
        rowsAt(this, ear, a.hx + 2, a.top - 9, c, [2, 2, 1, 1, 1, 0, 0, 0]);
        this.pattern(['KPPPPPPPPPK'], a.hx - 5, a.top - 1, c);
      },
    },
    bee: {
      // 끝에 노란 방울이 달린 더듬이가 통통 튄다
      front(g, a, c, t) {
        for (const side of [-1, 1]) {
          const path = [[0, 0], [0, -1], [1, -2], [1, -3], [2, -4], [2, -5]];
          for (const [dx, dy] of path) this.px(a.hx + side * (2 + dx), a.top - 1 + dy, c.k);
          const bob = Math.round(Math.sin(t * 7 + side) * 1);
          this.pattern(['.KK.', 'KYWK', 'KYyK', '.KK.'], a.hx + side * 4 - (side < 0 ? 2 : 1), a.top - 10 + bob, c);
        }
      },
    },
    straw: {
      // 챙이 넓은 여름 밀짚모자에 빨간 리본 띠
      front(g, a, c) {
        this.pattern(['.....KKKKKKK.....', '....KYyYYyYYK....', '....KRRRRRRRK....', '.KKKKYYyYYYYKKKK.', 'KYyYYYyYYYyYYYyYK', '.KKKKKKKKKKKKKKK.'], a.hx - 8, a.top - 4, c);
      },
    },
    flowercrown: {
      // 초록 덩굴에 작은 꽃 다섯 송이
      front(g, a, c) {
        for (let x = a.hx - 7; x <= a.hx + 7; x++) this.px(x, a.top, (x + a.hx) % 2 ? c.n : c.N);
        const cols = [c.P, c.Y, c.W, c.P, c.B];
        [-6, -3, 0, 3, 6].forEach((dx, i) => this.pattern(['.X.', 'XcX', '.X.'], a.hx + dx - 1, a.top - 2, { X: cols[i], c: i === 1 ? c.O : c.Y }));
      },
    },
    mikan: {
      // 귤 하나 올리고 균형 잡는 중
      front(g, a, c) {
        this.pattern(['...KNNK', '.KKnKK.', 'KMMMMMK', 'KMHMMMK', 'KMMMMmK', 'KMMMmmK', '.KKKKK.'], a.hx - 3, a.top - 7, c);
      },
    },
    toast: {
      // 식빵 굽는 고양이가 식빵을 이고 있다. 윗면이 볼록한 식빵 모양, 노릇한 테두리에 녹는 버터 한 조각
      front(g, a, c) {
        this.pattern(
          ['.KKKKKKKKK.', 'KThTTTTTTTK', 'KTSSSSSSSTK', '.KTSSYYSTK.', '.KTSSyYSTK.', '.KTSSSySTK.', '.KTTTTTTTK.', '..KKKKKKK..'],
          a.hx - 5, a.top - 7, { K: c.K, T: '#c48b56', h: '#e0ae78', S: '#f6e2bd', Y: '#ffe680', y: '#f0c94a' },
        );
      },
    },
    propeller: {
      // 알록달록 모자 위 프로펠러가 뱅글뱅글 돈다
      front(g, a, c, t) {
        this.pattern(['...KKKKK...', '..KRRYBBK..', '.KRRRYBBBK.', 'KKKKKKKKKKK'], a.hx - 5, a.top - 3, c);
        this.px(a.hx, a.top - 4, c.K);
        const frames = ['.RRRKBBB.', '....K....', '.BBBKRRR.', '....K....'];
        this.pattern([frames[Math.floor(t * 16) % 4]], a.hx - 4, a.top - 5, c);
      },
    },
    wizard: {
      // 끝이 꺾인 보라 고깔에 반짝이는 별
      front(g, a, c, t) {
        const star = Math.floor(t * 3) % 2 ? '#fff' : c.Y;
        this.pattern(
          ['........KK...', '.......KVK...', '......KVVK...', '.....KVVVK...', '....KVVYVK...', '....KVVVVVK..', '...KVYVVVVK..', '...KVVVVVVVK.', 'KKKKKKKKKKKKK', 'KvvvvvvvvvvvK', '.KKKKKKKKKKK.'],
          a.hx - 6, a.top - 9, Object.assign({}, c, { Y: star }),
        );
        // 꼭대기에 작은 반짝별 (반짝일 때 한 칸 커진다)
        const tw = Math.floor(t * 2.5) % 3;
        const sx = a.hx + 2, sy = a.top - 11;
        this.px(sx, sy, tw ? '#ffe98a' : '#ffffff');
        if (tw !== 1) { this.px(sx - 1, sy, '#ffd65a'); this.px(sx + 1, sy, '#ffd65a'); this.px(sx, sy - 1, '#ffd65a'); this.px(sx, sy + 1, '#ffd65a'); }
      },
    },
    antlers: {
      // 갈색 뿔 머리띠 + 빨간 코. 코가 반짝 빛난다
      front(g, a, c, t) {
        this.pattern(['t.t...', 't.t.t.', '.tt.t.', '..ttt.', '...t..', '...t..'], a.hx - 7, a.top - 6, c);
        this.pattern(['...t.t', '.t.t.t', '.t.tt.', '.ttt..', '..t...', '..t...'], a.hx + 2, a.top - 6, c);
        this.pattern(['.R.', 'RRR'], a.fx - 1, a.my, c);
        if (Math.floor(t * 2) % 2) this.px(a.fx - 1, a.my + 1, '#fff');
      },
    },
    mustache: {
      // 끝이 동그랗게 말려 올라간 신사 콧수염
      front(g, a, c) {
        this.pattern(['K.......K', 'KK.KKK.KK', '.KKK.KKK.'], a.fx - 4, a.my, { K: c.k });
      },
    },
    nerd: {
      // 멋쟁이 썬구리: 굵은 검정 뿔테에 까만 렌즈, 비스듬한 빛줄기. 가끔 테 끝이 번쩍
      front(g, a, c, t) {
        this.pattern(['kkkkkkkkkkk', 'kdHdd.ddHdk', 'kddHd.dddHk', '.kkkk.kkkk.'], a.eyeL - 2, a.ey - 1, { k: '#141418', d: '#2a2a34', H: '#6a7088' });
        if (t % 2.8 < 0.3) star(this, a.eyeR + a.ew + 2, a.ey - 2, '#fff6c0');
      },
    },
    eyepatch: {
      // 왼쪽 눈에 까만 안대, 끈이 이마를 비스듬히 가로지른다
      front(g, a, c) {
        this.pattern(['.kk.', 'kkkk', 'kkkk', '.kk.'], a.eyeL - 1, a.ey - 1, c);
        let x = a.eyeL + 3;
        let y = a.ey - 1;
        while (y >= a.top && x <= a.right) { this.px(x, y, c.k); x++; if ((x - a.eyeL) % 2 === 0) y--; }
        this.px(a.eyeL - 2, a.ey, c.k);
      },
    },
    mask: {
      // 주름 잡힌 흰 마스크에 귀걸이 끈
      front(g, a, c) {
        const y = Math.min(a.my, GROUND - 4);
        // 테두리는 까만 선 대신 회색이라 얼굴 위에서 무겁지 않다. 가운데에 주름 한 줄
        this.pattern(['.ggggggg.', 'gWWWWWWWg', 'gGGGGGGGg', 'gWWWWWWWg', '.ggggggg.'], a.fx - 4, y, { g: '#8f95a0', W: '#ffffff', G: '#dfe3ea' });
        for (let i = 1; i <= 3; i++) { this.px(a.fx - 4 - (i > 1 ? 1 : 0), y + 1 - i, '#dfe3ea'); this.px(a.fx + 4 + (i > 1 ? 1 : 0), y + 1 - i, '#dfe3ea'); }
      },
    },
    bellcollar: {
      // 빨간 목줄에 금방울. 움직이면 방울이 달랑
      front(g, a, c, t) {
        const y = Math.min(a.my + 3, GROUND - 2);
        this.pattern(['KRRRRRRRRRRRK'], a.hx - 6, y, c);
        const s = Math.round(Math.sin(t * 5) * 0.6);
        this.pattern(['KYWYK', 'KYYYK', '.KyK.'], a.hx - 2 + s, y, c);
      },
    },
    wings: {
      // 어깨 뒤에서 위로 솟은 작고 동그란 아기 천사 날개. 아래 끝은 깃털이 톡톡 갈라지고, 파닥파닥
      back(g, a, c, t) {
        const up = Math.sin(t * 3) > 0 ? 1 : 0;
        const L = ['....KKKK..', '..KKWWWWKK', '.KWWWWWWWK', 'KWWWGWWWWK', 'KWGWWGWWK.', '.KWKWGWK..', '..K.KWK...', '.....K....'];
        const m = { K: c.K, W: '#ffffff', G: '#d6dbe6' };
        const y = a.top - 3 - up;
        this.pattern(L, a.left - 8 + up, y, m);
        this.pattern(mirror(L), a.right - 1 - up, y, m);
      },
    },
    tube: {
      // 빨강·하양 수영 튜브를 끼고 있다. 여름 휴가 고양이
      front(g, a, c) {
        const y = Math.min(a.my + 2, GROUND - 3);
        this.pattern(['.KKKKKKKKKKKKKKK.', 'KRRRWWWRRRWWWRRRK', 'KRHRWWWRRRWWWRRRK', '.KKKKKKKKKKKKKKK.'], a.hx - 8, y, c);
      },
    },

    // ================= 2차 (2026-09-22 확정) =================
    // --- 무기: 오른앞발로 쥔다. 잘 때(식빵 자세)는 옆 바닥에 내려놓는다 ---
    pistol: {
      hand: true, // 손에 든다: 앞발 쓰는 모션 동안 숨긴다
      // 은빛 슬라이드가 두툼한 데저트 이글. 가끔 총구에서 불꽃이 번쩍
      front(g, a, c, t) {
        const m = { K: c.K, S: '#d3dbe4', s: '#8e9aaa', H: '#ffffff', D: '#3a3f4a' };
        if (a.curled) return this.pattern(['.KKKKKKKK', 'KSHSSSSsK', 'KDDKKKKKK', 'KKK......'], a.right + 1, GROUND - 3, m);
        this.pattern(['.KKKKKKKKK', 'KSHSSSSSsK', 'KssssssssK', 'KDDKKKKKKK', 'KDDKsK....', 'KDDKK.....', 'KKKK......'], a.right - 1, a.cy - 3, m);
        heldPaw(this, g, a.right, a.cy + 2);
        if (t % 3 < 0.15) this.pattern(['.Y.', 'YWY', '.Y.'], a.right + 9, a.cy - 3, c);
      },
    },
    watergun: {
      hand: true, // 손에 든다: 앞발 쓰는 모션 동안 숨긴다
      // 알록달록 장난감 물총. 위에 물이 찰랑이는 투명 물탱크, 노란 총구에서 물방울이 똑똑
      front(g, a, c, t) {
        const m = { K: c.K, B: '#3aa8ff', b: '#1f78c8', Y: '#ffd23f', P: '#ff7ab8', U: 'rgba(200,236,255,0.9)', u: '#6fc4ff' };
        if (a.curled) return this.pattern(['..KKK....', '.KuuuK...', 'KKKKKKKKK', 'KBBBBBBYK', 'KKKKKKKKK'], a.right + 1, GROUND - 4, m);
        const slosh = Math.floor(t * 3) % 2;
        this.pattern(['..KKKK....', '.KU' + (slosh ? 'Uu' : 'uU') + 'K....', '.KuuuK....', 'KKKKKKKKK.', 'KBBBBBBBYK', 'KbbKKKKKKK', '.KPPK.....', '.KPPK.....', '..KK......'], a.right - 1, a.cy - 5, m);
        heldPaw(this, g, a.right + 1, a.cy + 2);
        this.px(a.right + 9, a.cy - 1 + (Math.floor(t * 3) % 4), '#8fd0ff');
      },
    },
    lightsaber: {
      hand: true, // 손에 든다: 앞발 쓰는 모션 동안 숨긴다
      // 웅— 하는 광선검. 날 색이 파랑·빨강·초록으로 바뀌고 둘레가 은은하게 번진다
      front(g, a, c, t) {
        const col = ['#6fe3ff', '#ff5a5a', '#7dff7a'][Math.floor(t / 2) % 3];
        const glow = ['rgba(111,227,255,0.35)', 'rgba(255,90,90,0.35)', 'rgba(125,255,122,0.35)'][Math.floor(t / 2) % 3];
        if (a.curled) {
          this.pattern(['KKKKK', 'KgDgK', 'KKKKK'], a.right + 1, GROUND - 2, c);
          return;
        }
        const x0 = a.right;
        for (let i = 0; i < 14; i++) {
          const y = a.cy - 3 - i;
          this.px(x0, y, glow, false);
          this.px(x0 + 4, y, glow, false);
          this.px(x0 + 1, y, Math.sin(t * 40 + i) > 0.85 ? '#ffffff' : col);
          this.px(x0 + 2, y, '#ffffff');
          this.px(x0 + 3, y, col);
        }
        this.pattern(['KKKKK', 'KgDgK', 'KgDgK', 'KDRDK', 'KKKKK'], x0, a.cy - 3, c);
        heldPaw(this, g, x0 + 2, a.cy + 2);
      },
    },

    // --- B급 ---
    bananahat: {
      // 먹고 남은 바나나 껍질을 머리에. 꼭지가 위로 서고, 껍질 네 장이 양옆과 앞으로 축 늘어진다 (안쪽은 크림색)
      front(g, a, c) {
        this.pattern(
          ['......KK.....', '.....KtK.....', '....KYYYK....', '..KKYWYWYKK..', '.KYYKYWYKYYK.', 'KYWK.KYWK.KWYK', 'KYK..KYYK..KYK', 'KtK...KtK..KtK', '.K.....K....K.'],
          a.hx - 6, a.top - 6, { K: c.K, Y: '#ffd84a', W: '#fff3c4', t: '#6b4a20' },
        );
      },
    },
    socks: {
      // 빨래통에서 꺼낸 짝짝이 양말을 귀에 씌웠다. 발목은 귀를 감싸고, 발 부분은 바깥으로 축 꺾였다
      front(g, a, c) {
        // 왼쪽 귀 양말: 발끝이 왼쪽. 골지 발목(줄무늬) → 뒤꿈치(h) → 발가락(T). 오른쪽은 색이 다른 짝짝이
        const L = ['.KKKKKKK.', 'KTWWWWhhK', 'KTWWWWWhK', '.KKKKWWWK', '....KRRRK', '....KWWWK', '....KRRRK'];
        this.pattern(L, a.left - 4, a.earTop - 4, { K: c.K, W: '#fffaf3', R: '#e8534a', h: '#ffd3df', T: '#ffd3df' });
        this.pattern(mirror(L), a.right - 4, a.earTop - 4, { K: c.K, W: '#6fb0ea', R: '#3d6fb0', h: '#ffd65a', T: '#ffd65a' });
      },
    },
    sheetmask: {
      // 하얀 마스크팩 한 장. 눈·코만 뚫려 있다. 피부 관리 중이니 말 걸지 마
      front(g, a, c) {
        for (let y = a.top + 1; y <= a.my + 2; y++)
          for (let x = a.left + 1; x <= a.right - 1; x++) {
            const eye = y >= a.ey && y < a.ey + a.eh && ((x >= a.eyeL && x < a.eyeL + a.ew) || (x >= a.eyeR && x < a.eyeR + a.ew));
            if (!eye && !(y === a.my - 1 && x === a.fx)) this.px(x, y, 'rgba(250,250,255,0.92)');
          }
      },
    },
    boxhelm: {
      // 택배 상자를 뒤집어써서 투구로. 눈 구멍만 뚫었다
      front(g, a, c) {
        const x0 = a.left - 1;
        const w = a.right - a.left + 3;
        for (let y = a.earTop - 2; y <= a.ey + 3; y++)
          for (let x = x0; x < x0 + w; x++) {
            const edge = y === a.earTop - 2 || y === a.ey + 3 || x === x0 || x === x0 + w - 1;
            const hole = y >= a.ey && y < a.ey + a.eh && ((x >= a.eyeL - 1 && x <= a.eyeL + a.ew) || (x >= a.eyeR - 1 && x <= a.eyeR + a.ew));
            if (!hole) this.px(x, y, edge ? c.K : y === a.earTop ? c.t : c.T);
          }
        this.pattern(['KWK'], a.hx - 1, a.earTop - 1, c);
      },
    },
    snorkel: {
      // 물안경에 스노클까지. 여긴 바다가 아니라 책상인데
      front(g, a, c) {
        this.pattern(['KKKKKKKKKKK', 'KUUUKKKUUUK', 'KULUK.KULUK', 'KKKKK.KKKKK'], a.fx - 5, a.ey - 1, c);
        for (let j = 0; j < 8; j++) this.px(a.right + 1, a.ey - 6 + j, j < 2 ? c.O : c.Y);
        this.px(a.right, a.ey + 1, c.Y);
      },
    },

    // --- 귀여움 ---
    clover: {
      // 오른쪽 귀 밑에 꽂은 네잎클로버 머리핀. 오늘은 버그가 없을 거야
      front(g, a, c) {
        this.pattern(['.K.K.', 'KNKNK', '.KnK.', 'KNKNK', '.K.K.'], a.right - 3, a.top - 4, c);
        this.px(a.right - 2, a.top, c.n);
      },
    },
    police: {
      // 금색 배지가 달린 경찰 모자. 버그 체포하겠습니다
      front(g, a, c) {
        this.pattern(['...KKKKKKK...', '..KbbbbbbbK..', '.KbbbbYbbbbK.', 'KbbbbYYYbbbbK', 'KKKKKKKKKKKKK', '.KkkkkkkkkkK.', '..KKKKKKKKK..'], a.hx - 6, a.earTop - 4, c);
      },
    },

    // --- 고급: 비싸고 화려한 것 ---
    phoenix: {
      // 등 뒤로 활활 타오르는 불꽃 날개가 펄럭인다
      back(g, a, c, t) {
        const flap = Math.sin(t * 5);
        for (const s of [-1, 1]) {
          for (let i = 0; i < 12; i++) {
            const h = Math.round(10 - i * 0.6 + flap * 2 + Math.sin(t * 14 + i) * 1.2);
            for (let j = 0; j < h; j++) {
              const f = j / Math.max(1, h);
              this.px(a.cx + s * (5 + i), a.cy - 4 + j - Math.round(i * 0.4), f < 0.3 ? '#fff3a0' : f < 0.65 ? '#ffb43a' : '#ff5a3a', false);
            }
          }
        }
      },
    },
    spacehelm: {
      // 금붕어 어항 돔 (2026-09-25 세트 → 머리): 물빛 도는 유리 돔 안에서 금붕어가 머리 위를 왔다 갔다, 뽀글뽀글 물방울. 목에는 빨간 불이 깜빡이는 금속 링
      front(g, a, c, t) {
        const cx = a.hx + 0.5;
        const cy = a.ey - 1;
        const r = 8.5;
        for (let y = Math.floor(cy - r); y <= cy + r; y++)
          for (let x = Math.floor(cx - r); x <= cx + r; x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            if (d > r || y > a.neck) continue;
            if (d > r - 1) this.px(x, y, '#c8e2f0');
            // 물빛은 고양이 둘레 빈 곳에만 (얼굴 위에 덮으면 털색이 탁해진다)
            else if (x < a.left || x > a.right || y < a.earTop) this.px(x, y, 'rgba(140,210,255,0.18)', false);
          }
        // 금붕어: 머리 위 빈 곳을 좌우로 헤엄친다. 돌아설 때 방향을 바꾼다
        const fx = Math.round(cx + Math.sin(t * 0.9) * 4.5);
        const fy = Math.round(cy - r + 2.4 + Math.sin(t * 2.3) * 0.6);
        const fish = ['m.MM.', '.mMMk', 'm.MM.'];
        const dir = Math.cos(t * 0.9) >= 0;
        this.pattern(dir ? fish : mirror(fish), fx - 2, fy - 1, { M: '#ff8c1a', m: '#d96608', k: '#1f1c1b' });
        // 물방울: 금붕어 입에서 하나씩 올라간다
        const p = (t % 1.6) / 1.6;
        this.px(fx + (dir ? 3 : -3), fy - 1 - Math.round(p * 3), `rgba(235,248,255,${(0.9 * (1 - p)).toFixed(2)})`, false);
        this.pattern(['.W.', 'W..'], Math.round(cx - 6), Math.round(cy - 5), { W: '#ffffff' });
        const ringY = Math.min(a.neck, Math.round(cy + r));
        this.pattern(['KKKKKKKKKKKKKKKKK', 'KgggggggRgggggggK'].map((row, j) => (j === 1 && t % 1 < 0.5 ? row.replace('R', 'g') : row)), Math.round(cx - 8.5), ringY, c);
      },
    },
    goldaura: {
      // 온몸에서 금빛 기운이 불꽃처럼 일렁이며 피어오르고 반짝이가 떠다닌다 (위쪽으로 갈수록 길게 넘실)
      back(g, a, c, t) {
        const ox = a.cx - 0.5, oy = a.cy - 2;
        for (let y = a.top - 10; y <= GROUND; y++)
          for (let x = a.left - 5; x <= a.right + 5; x++) {
            const dx = (x + 0.5 - ox) / 10, dy = (y + 0.5 - oy) / 9;
            const ang = Math.atan2(dy, dx);
            const up = Math.max(0, -Math.sin(ang));
            const flick = 1 + up * (0.25 + 0.2 * Math.sin(t * 7 + ang * 9)) + Math.sin(t * 5 + ang * 6) * 0.05;
            const d = Math.hypot(dx, dy) / flick;
            if (d > 1 || d < 0.72) continue;
            this.px(x, y, d > 0.9 ? 'rgba(255,214,90,0.6)' : 'rgba(255,240,170,0.28)', false);
          }
        for (let i = 0; i < 4; i++) {
          const p = (t * 0.6 + i / 4) % 1;
          this.pattern(['.Y.', 'YWY', '.Y.'], Math.round(a.cx - 9 + i * 6), Math.round(GROUND - p * 18), { Y: '#ffd35c', W: '#ffffff' }, false);
        }
      },
    },
    spotlight: {
      // 어디 있든 위에서 조명이 비춘다. 발밑엔 레드카펫. 주인공은 나야
      back(g, a, c, t) {
        // 빛기둥: 가운데가 밝고 가장자리로 갈수록 흐려져서 계단 모양 테두리가 덜 보인다
        // 맨 위 몇 줄은 흐리게 시작해서 창·패널 윗변에 딱 잘린 선이 안 보이게 한다
        for (let y = 3; y <= GROUND; y++) {
          const half = 3 + y * 0.28;
          const top = Math.min(1, (y - 2) / 5);
          for (let x = Math.floor(a.cx - half); x <= Math.ceil(a.cx + half); x++) {
            const e = Math.abs(x - a.cx) / half;
            if (e > 1.05) continue;
            const al = top * (0.08 + 0.26 * (1 - e * e) * (0.55 + 0.45 * (y / GROUND)));
            this.px(x, y, `rgba(255,248,210,${al.toFixed(2)})`, false);
          }
        }
        for (let x = a.cx - 14; x <= a.cx + 14; x++) {
          this.px(x, GROUND + 1, c.R, false);
          this.px(x, GROUND + 2, c.r, false);
        }
        if (t % 1.5 < 0.25) this.pattern(['.W.', 'WWW', '.W.'], a.cx + 9, a.top - 4, { W: '#ffffff' });
      },
    },
  };

  // ================= 3차 (2026-09-22 확정) =================
  // 세트·얼굴·머리·몸·등·손·효과 칸마다 새로 들어온 것. 고양이 도트 맵의 털 칸을 직접 칠하는 옷(wear/hood)이 많다.
  // hand: true 는 손에 드는 것 — 앞발을 쓰는 모션 동안은 안 그린다 (sprite.js 의 drawAccessory)
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const mirror = (rows) => rows.map((r) => r.split('').reverse().join(''));

  // 고양이 도트 맵의 털 칸(외곽선 빼고)을 하나씩 돌며 칠한다. 숨 쉬기로 들린 줄도 따라간다
  function cells(r, g, a, paint) {
    const rows = g.m.rows;
    const last = rows.length - 2;
    for (let j = 0; j <= last; j++) {
      const y = Math.round(g.y0 + j + g.lift(j));
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === 'O') continue;
        const x = Math.round(g.x0 + i);
        const col = paint(x - a.hx, y, x, j === last, j);
        if (!col) continue;
        r.px(x, y, col);
        // 숨 들이쉴 때 몸이 한 줄 늘어나며 생기는 틈도 같은 색으로 메운다
        if (j > 0 && g.lift(j) < g.lift(j - 1)) r.px(x, y + 1, col);
        if (j > 0 && g.lift(j) > g.lift(j - 1)) r.px(x, y - 1, col);
      }
    }
  }
  // 몸(옷) 자리: 입 아래 두 줄 + 어깨. 식빵 자세면 옆구리와 아랫줄
  function isBody(a, dx, y) {
    const adx = Math.abs(dx);
    if (a.curled) return (y > a.my && adx >= 3) || (y >= a.ey + 1 && adx >= 5);
    const dy = y - (a.my + 3);
    return dy >= 0 || (dy >= -2 && adx >= 2) || (dy === -3 && adx >= 5);
  }
  // 옷: paint(dx, dy, x, y, leg) — dy 0 = 가슴 줄, 음수 = 어깨, leg = 다리 줄
  const wear = (r, g, a, paint) => cells(r, g, a, (dx, y, x, leg) => (isBody(a, dx, y) ? paint(dx, y - (a.my + 3), x, y, leg && !a.curled) : null));
  // 머리 전체(옷 자리 뺀 곳): paint(dx, y, x, j) — j 0·1 은 귀
  const hood = (r, g, a, paint) => cells(r, g, a, (dx, y, x, leg, j) => (isBody(a, dx, y) ? null : paint(dx, y, x, j)));
  // 얼굴 구멍 (눈·코·입 둘레)
  const isFace = (a, dx, y) => Math.abs(dx) <= 4 && y >= a.ey - 1;
  const star = (r, x, y, col, solid = false) => r.pattern(['.X.', 'XWX', '.X.'], x - 1, y - 1, { X: col, W: '#ffffff' }, solid);
  // 치마: 다리 줄까지 덮고 양옆으로 퍼진다
  function skirt(r, a, c, spread, fill) {
    if (a.curled) return;
    for (let k = 0; k < 2; k++) {
      const y = a.my + 3 + k;
      const x0 = a.left - spread[k];
      const x1 = a.right + spread[k];
      for (let x = x0; x <= x1; x++) r.px(x, y, x === x0 || x === x1 ? c.K : fill(x, y, k));
    }
  }

  const BEAR = { T: '#9a6a43', shade: '#855a37', trim: '#e8c9a0', belly: '#e8c9a0' };

  // 세트 디벨롭 (2026-09-25) 에서 쓰는 도우미
  const every = (t, n, len, ph = 0) => (t + ph) % n < len; // n 초마다 len 초 동안 참
  // 오른손에 든 소품 자리. 앞발 쓰는 모션 동안은 null (소품을 숨긴다)
  const setHand = (r, a) => (r.pawsBusy ? null : a.curled ? { x: a.right + 2, y: GROUND - 2, curled: true } : { x: a.right + 1, y: a.cy + 1 });
  // 두 점 사이를 한 칸 굵기로 잇는다. n 을 주면 앞에서 n 칸까지만 (쭉 뻗어 나가는 줄)
  const dotLine = (r, x0, y0, x1, y1, col, n = null) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= (n == null ? steps : n); i++) r.px(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), col, false);
  };

  const ACC3 = {
    // ======================= 세트 =======================
    spidercat: {
      // 2026-09-25 디벨롭: 손목 거미줄 발사 · 눈 렌즈 찡긋
      front(g, a, c, t) {
        const R = '#d9303b', D = '#7e1720', U = '#2c5cc0';
        hood(this, g, a, (dx, y) => {
          const k = a.my + 1 - y;
          return dx === 0 || Math.abs(dx) === k || (k === 5 && Math.abs(dx) < 6) ? D : R;
        });
        wear(this, g, a, (dx, dy, x, y, leg) => (leg || Math.abs(dx) >= 5 ? U : dy === 0 && Math.abs(dx) <= 1 ? c.k : R));
        this.pattern(['KKK.', 'KWWK', 'KWWK', '.KKK'], a.eyeL - 1, a.ey - 1, c);
        this.pattern(['.KKK', 'KWWK', 'KWWK', 'KKK.'], a.eyeR - 1, a.ey - 1, c);
        // 2026-09-25 디벨롭으로 더한 것 (원래 그림과 이름이 겹치지 않게 블록으로)
        {
          // 눈 렌즈가 가끔 가늘어진다 (윗줄을 덮는다)
          if (every(t, 4.2, 0.35)) for (const x0 of [a.eyeL - 1, a.eyeR - 1]) for (let i = 0; i < 4; i++) this.px(x0 + i, a.ey, c.K);
          const h = setHand(this, a);
          if (!h) return;
          heldPaw(this, g, h.x, h.y);
          // 손목 발사기: 빨간 밴드에 은빛 노즐
          this.pattern(['KRRK', 'KSSK'], h.x - 2, h.y - 3, { K: c.K, R: '#d9303b', S: '#c8d0dc' });
          // 3초마다 거미줄이 쭉 나갔다가 끝에서 팍 퍼진다
          const p = (t % 3) / 3;
          const len = p < 0.2 ? p / 0.2 : p < 0.5 ? 1 : 0;
          if (len > 0) {
            const n = Math.round(len * 10);
            dotLine(this, h.x, h.y - 4, h.x + 10, h.y - 14, '#9aa3b2', n);
            dotLine(this, h.x - 1, h.y - 4, h.x + 9, h.y - 14, '#f4f6ff', n);
            if (len === 1) this.pattern(['W.K.W', '.WKW.', 'KKWKK', '.WKW.', 'W.K.W'], h.x + 8, h.y - 17, { W: '#f4f6ff', K: '#9aa3b2' }, false);
          }
        }
      },
    },
    ironcat: {
      // 2026-09-25 디벨롭: 리펄서 장갑(빛 원반 · 4초마다 빔) · 몸을 스치는 금속 광택
      front(g, a, c, t) {
        const R = '#c8202c', r = '#8a1018', Y = '#f2c14e', y2 = '#c8962a';
        hood(this, g, a, (dx, y) => {
          const adx = Math.abs(dx);
          if (adx <= 3 && y >= a.ey - 2) return adx === 3 ? y2 : Y;
          return adx >= 5 ? r : R;
        });
        wear(this, g, a, (dx, dy, x, y, leg) => (Math.abs(dx) >= 5 ? Y : leg ? y2 : R));
        const glow = t % 3 < 0.12 ? '#ffffff' : '#aef3ff';
        for (let i = -1; i <= a.ew; i++) { this.px(a.eyeL + i, a.ey, glow); this.px(a.eyeR + i, a.ey, glow); }
        for (let d = -1; d <= 1; d++) this.px(a.hx + d, a.my + 1, y2);
        // 가슴의 아크 원자로: 두근두근 빛난다
        const pu = 0.5 + 0.5 * Math.sin(t * 5);
        const cy = a.curled ? GROUND - 2 : a.my + 3;
        this.pattern(['.C.', 'CWC', '.C.'], a.hx - 1, cy - 1, { C: '#7fe8ff', W: '#ffffff' });
        const halo = `rgba(127,232,255,${(0.25 + pu * 0.5).toFixed(2)})`;
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) this.px(a.hx + dx, cy + dy, halo, false);
        // 투구에 스치는 반짝 빛
        const p = (t % 2.6) / 0.5;
        if (p < 1) this.px(a.hx - 3 + Math.round(p * 6), a.ey - 2, '#ffffff');
        if (t % 2.6 > 2.3) star(this, a.right + 2, a.top - 2, '#ffe07a');
        // 2026-09-25 디벨롭으로 더한 것 (원래 그림과 이름이 겹치지 않게 블록으로)
        {
          // 금속 광택: 비스듬한 빛줄기가 3초마다 몸을 스윽
          const p = (t % 3.2) / 0.6;
          if (p < 1) {
            const x0 = Math.round(a.left - 4 + p * (a.right - a.left + 10));
            for (let y = a.top + 1; y <= GROUND - 2; y++) {
              const x = x0 - Math.round((y - a.top) * 0.5);
              if (x > a.left && x < a.right) { this.px(x, y, 'rgba(255,255,255,0.55)', false); this.px(x + 1, y, 'rgba(255,255,255,0.25)', false); }
            }
          }
          const h = setHand(this, a);
          if (!h) return;
          // 장갑: 빨간 손등에 금빛 손목, 손바닥 가운데 리펄서 원반
          this.pattern(['.KKK.', 'KRYRK', 'KYCYK', 'KRYRK', '.KKK.'], h.x - 1, h.y - 3, { K: '#3a0a10', R: '#c8202c', C: '#e8fdff', Y: '#f2c14e' });
          const q = (t % 4) / 4;
          if (q > 0.82) {
            // 발사: 오른쪽으로 빔이 뻗고 원반이 하얗게
            const k = (q - 0.82) / 0.18;
            const len = Math.round(4 + k * 8);
            const al = (1 - k * 0.6).toFixed(2);
            for (let i = 0; i < len; i++) {
              this.px(h.x + 4 + i, h.y - 1, `rgba(255,255,255,${al})`, false);
              this.px(h.x + 4 + i, h.y - 2, `rgba(174,243,255,${(al * 0.6).toFixed(2)})`, false);
              this.px(h.x + 4 + i, h.y, `rgba(174,243,255,${(al * 0.6).toFixed(2)})`, false);
            }
            this.pattern(['.W.', 'WWW', '.W.'], h.x, h.y - 2, { W: '#ffffff' });
          } else {
            // 평소엔 원반 둘레가 숨 쉬듯 빛난다
            const pu = (0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 5))).toFixed(2);
            for (const [dx, dy] of [[-2, -1], [4, -1], [1, -4], [1, 2]]) this.px(h.x + dx, h.y + dy, `rgba(174,243,255,${pu})`, false);
          }
        }
      },
    },
    aliencat: {
      back(g, a, c, t) { this._saucer(a, t, false); },
      front(g, a, c, t) {
        const G1 = '#8fdc6a', G2 = '#5aa844', S1 = '#d3dbe4', S2 = '#8e9aaa';
        hood(this, g, a, (dx, y) => (Math.abs(dx) >= 5 && y > a.ey ? G2 : G1));
        wear(this, g, a, (dx, dy, x, y, leg) => (leg ? S2 : dy === 0 && Math.abs(dx) <= 1 ? '#ff5aa8' : S1));
        const E = { K: '#141414', H: '#ffffff' };
        this.pattern(['KKK.', 'KHKK', '.KKK'], a.eyeL - 1, a.ey - 1, E);
        this.pattern(['.KKK', 'KKHK', 'KKK.'], a.eyeR - 1, a.ey - 1, E);
        this.px(a.fx, a.my + 1, '#2f6b24');
        this._saucer(a, t, true);
        for (const s of [-1, 1]) {
          const bob = Math.round(Math.sin(t * 4 + s) * 1);
          this.px(a.hx + s * 2, a.top - 1, G2);
          this.px(a.hx + s * 2, a.top - 2, G2);
          this.px(a.hx + s * 3, a.top - 3 + bob, G2);
          const on = Math.floor(t * 2 + (s > 0 ? 1 : 0)) % 2;
          this.pattern(['.X.', 'XWX', '.X.'], a.hx + s * 3 - 1, a.top - 6 + bob, { X: on ? '#ff5aa8' : '#ffe45a', W: '#ffffff' });
        }
      },
    },
    beesuit: {
      // 2026-09-25 디벨롭: 맥 있는 날개 한 쌍 · 꿀 국자(꿀이 뚝뚝) · 꽃가루 반짝
      back(g, a, c, t) {
        if (a.curled) return;
        const up = Math.floor(t * 14) % 2 === 0;
        const m = { K: 'rgba(70,80,100,0.9)', W: 'rgba(232,246,255,0.8)', w: 'rgba(160,195,230,0.9)' };
        const wing = up
          ? ['..KKK..', '.KWWWK.', 'KWWwWWK', 'KWwWWK.', '.KWWK..', '..KK...']
          : ['.......', '..KKKK.', '.KWWwWK', 'KWwWWK.', '.KKKK..', '.......'];
        this.pattern(wing, a.left - 6, a.top - 1, m, false);
        this.pattern(mirror(wing), a.right, a.top - 1, m, false);
      },
      front(g, a, c, t) {
        const Y = '#ffd23f', K2 = '#2a2320';
        hood(this, g, a, (dx, y, x, j) => (isFace(a, dx, y) ? null : j <= 1 ? K2 : Y));
        wear(this, g, a, (dx, dy) => (dy === 0 ? K2 : Y));
        for (const side of [-1, 1]) {
          for (const [dx, dy] of [[0, 0], [0, -1], [1, -2], [1, -3]]) this.px(a.hx + side * (2 + dx), a.top - 1 + dy, K2);
          const bob = Math.round(Math.sin(t * 7 + side));
          this.pattern(['.KK.', 'KYWK', 'KYYK', '.KK.'], a.hx + side * 3 - (side < 0 ? 2 : 1), a.top - 8 + bob, c);
        }
        // 2026-09-25 디벨롭으로 더한 것 (원래 그림과 이름이 겹치지 않게 블록으로)
        {
          // 꽃가루: 몸 둘레를 둥실
          for (let i = 0; i < 4; i++) {
            const ang = t * 1.3 + i * 1.57;
            const col = every(t, 1.2, 0.3, i * 0.3) ? '#ffffff' : '#ffe27a';
            this.px(Math.round(a.cx + Math.cos(ang) * 12), Math.round(a.cy - 4 + Math.sin(ang * 1.7) * 6), col, false);
          }
          const h = setHand(this, a);
          if (!h) return;
          // 꿀 국자: 홈이 층층이 파인 호박색 머리 + 나무 자루
          this.pattern(['.KK.', 'KHHK', 'KhhK', 'KHHK', '.KK.', '.T..', '.T..', '.T..'], h.x - 1, h.y - 9, { K: '#9a6414', H: '#ffd36a', h: '#e8961e', T: '#b07a4a' });
          heldPaw(this, g, h.x, h.y);
          // 꿀이 한 방울씩 늘어졌다 떨어진다
          const p = (t % 1.6) / 1.6;
          const dx = h.x, dy = h.y - 5;
          if (p < 0.5) this.px(dx + 2, dy, '#e0901a');
          else this.px(dx + 2, dy + Math.round((p - 0.5) * 12), `rgba(240,160,30,${(1.4 - p).toFixed(2)})`, false);
        }
      },
    },
    ninjaset: {
      // 2026-09-25 디벨롭: 머리 뒤로 비스듬히 멘 닌자도 · 손에서 도는 수리검 · 발밑 연기 퐁
      back(g, a, c, t) {
        if (a.curled) return;
        // 칼자루가 왼쪽 귀 뒤에서 비스듬히 솟는다 (아래쪽은 머리에 가려진다). 빨강·검정 마름모 감개, 금빛 코등이
        this.pattern(
          ['KK......', 'KRK.....', '.KRK....', '..KRK...', '...KRK..', '..YYYYK.', '....KSSK', '.....KSS'],
          a.left - 5, a.top - 8, { R: '#c8242c', K: '#1a1a20', Y: '#e0b050', S: '#c8d0dc' }, false,
        );
      },
      front(g, a, c, t) {
        const Bk = '#26262e', bk = '#3a3a46', Rd = '#c8242c';
        hood(this, g, a, (dx, y) => (y >= a.ey - 1 && y <= a.ey + a.eh && Math.abs(dx) <= 4 ? null : Bk));
        wear(this, g, a, (dx, dy, x, y, leg) => (dy === 0 ? Rd : leg ? Bk : bk));
        const yb = a.ey - 2;
        for (let x = a.left; x <= a.right; x++) this.px(x, yb, Rd);
        for (let d = -1; d <= 1; d++) this.px(a.hx + d, yb, '#b8c0cc');
        const f = Math.floor(t * 7) % 2;
        for (let i = 1; i <= 5; i++) {
          this.px(a.left - i, yb + Math.floor(i / 2) + (i > 2 ? f : 0), Rd);
          this.px(a.left - i, yb + 1 + Math.floor(i / 2) + (i > 2 ? 1 - f : 0), Rd);
        }
        // 2026-09-25 디벨롭으로 더한 것 (원래 그림과 이름이 겹치지 않게 블록으로)
        {
          const h = setHand(this, a);
          if (h) {
            // 수리검: 마름모 ↔ X 로 번갈아 빙글
            const f = Math.floor(t * 10) % 2;
            this.pattern(f ? ['..K..', '.KSK.', 'KSkSK', '.KSK.', '..K..'] : ['K...K', '.KSK.', '.SkS.', '.KSK.', 'K...K'], h.x - 1, h.y - 7, { K: '#4a5260', S: '#dfe5ee', k: '#1a1a20' });
            heldPaw(this, g, h.x, h.y);
          }
          // 5초마다 발밑에서 연기 퐁
          const p = (t % 5) / 0.8;
          if (p < 1 && !a.curled) {
            const r0 = Math.round(p * 4);
            const al = (0.85 * (1 - p)).toFixed(2);
            for (const s of [-1, 1]) this.pattern(['.SS.', 'SWWS', '.SS.'], a.hx + s * (6 + r0) - 2, GROUND - 2 - Math.round(p * 2), { S: `rgba(170,170,185,${al})`, W: `rgba(235,235,245,${al})` }, false);
          }
        }
      },
    },
    magicalgirl: {
      // 2026-09-25 디벨롭: 하트 요술봉 · 분홍 나비 날개 · 떠오르는 하트 · 치마 레이스
      back(g, a, c, t) { this._mgStars(a, t, false); },
      back(g, a, c, t) {
        // 2026-09-25 디벨롭으로 더한 것 (원래 그림과 이름이 겹치지 않게 블록으로)
        {
          if (a.curled) return;
          const f = Math.floor(t * 4) % 2;
          // 분홍 나비 날개: 큰 윗날개 + 작은 아랫날개, 흰 무늬 한 점. 활짝 ↔ 반쯤 접힘으로 팔랑
          const open = ['KKK.....', 'KPPKK...', 'KPWPPKK.', '.KPPpPPK', '..KKPpPK', '...KPPK.', '..KPpPK.', '.KPPPK..', '..KKK...'];
          const half = ['.KK.....', '.KPKK...', '.KPWPKK.', '..KPpPPK', '...KKpPK', '....KPK.', '...KPpK.', '..KPPK..', '...KK...'];
          const w = f ? half : open;
          const m = { K: '#c2407e', P: '#ff8fc4', p: '#ffc4e0', W: '#ffffff' };
          this.pattern(w, a.left - 8, a.top - 1, m);
          this.pattern(mirror(w), a.right + 1, a.top - 1, m);
        }
      },
      front(g, a, c, t) {
        const Pk = '#ff8fc4', pk = '#e25c9c', Gd = '#ffd65a';
        wear(this, g, a, (dx, dy) => (dy < 0 ? Pk : a.curled ? pk : null));
        skirt(this, a, c, [1, 2], (x, y, k) => {
          if (hash(x * 3 + Math.floor(t * 5)) > 0.85) return '#ffffff';
          return k === 0 ? Pk : x % 2 ? '#ffffff' : '#ffd3ea';
        });
        if (!a.curled) this.pattern(['PPYPP', 'P.K.P'], a.hx - 2, a.my + 3, { P: pk, Y: Gd, K: c.K });
        const gem = Math.floor(t * 3) % 2 ? '#ffffff' : '#ff5aa8';
        this.pattern(['K..K..K', 'KYKPKYK', 'KYYYYYK'], a.hx - 3, a.top - 2, { K: c.K, Y: Gd, P: gem });
        this._mgStars(a, t, true);
        // 2026-09-25 디벨롭으로 더한 것 (원래 그림과 이름이 겹치지 않게 블록으로)
        {
          // 치마 레이스 한 단
          if (!a.curled) for (let x = a.left - 3; x <= a.right + 3; x++) this.px(x, a.my + 5, x % 2 ? '#ffffff' : '#ff8fc4');
          // 떠오르는 하트
          for (let i = 0; i < 3; i++) {
            const p = (t * 0.45 + i / 3) % 1;
            const x = Math.round(a.cx - 10 + i * 10 + Math.sin(t * 2 + i) * 1.5);
            const y = Math.round(a.cy + 2 - p * 18);
            this.ctx.globalAlpha = Math.min(1, (1 - p) * 1.6);
            this.pattern(['H.H', 'HHH', '.H.'], x - 1, y, { H: '#ff5aa8' }, false);
            this.ctx.globalAlpha = 1;
          }
          const h = setHand(this, a);
          if (!h) return;
          // 하트 요술봉: 금빛 자루 + 외곽선 있는 하트 + 하이라이트, 끝에서 반짝이
          for (let i = 3; i <= 8; i++) this.px(h.x + 1, h.y - i, i % 2 ? '#ffd65a' : '#e0a820');
          this.pattern(['.KK.KK.', 'KPPKPPK', 'KPWPPPK', 'KPPPPPK', '.KPPPK.', '..KPK..', '...K...'], h.x - 2, h.y - 15, { K: '#b0306e', P: '#ff5aa8', W: '#ffffff' });
          heldPaw(this, g, h.x, h.y);
          for (let i = 0; i < 3; i++) {
            const q = (t * 0.9 + i / 3) % 1;
            const x = Math.round(h.x + 5 + q * 6 + Math.sin(t * 5 + i) * 1);
            const y = Math.round(h.y - 14 + q * 4 + i * 2);
            if (q < 0.8) star(this, x, y, ['#fff6a0', '#9fe8ff', '#ffffff'][i]);
          }
        }
      },
    },

    // ======================= 얼굴 =======================
    gungye: {
      front(g, a, c, t) {
        // 궁예의 금 안대: 테두리 있는 둥근 금판(가운데 붉은 보석)을 까만 끈으로 비스듬히 맨다
        const Y = '#ffd24a', y = '#b8871a';
        let x = a.eyeL + 3;
        let yy = a.ey - 2;
        while (yy >= a.top && x <= a.right) { this.px(x, yy, c.k); x++; if ((x - a.eyeL) % 2 === 0) yy--; }
        for (let xx = a.left; xx < a.eyeL - 2; xx++) this.px(xx, a.ey, c.k);
        this.pattern(['.KKK.', 'KYHYK', 'KyRyK', 'KyyyK', '.KKK.'], a.eyeL - 2, a.ey - 2, { K: c.K, Y, y, H: '#fff7c8', R: '#d8303b' });
        if (Math.floor(t * 3) % 6 === 0) this.px(a.eyeL - 1, a.ey - 1, '#ffffff');
        if (t % 2.5 < 0.35) star(this, a.eyeL - 3, a.ey - 3, Y);
      },
    },
    rudolph: {
      front(g, a, c, t) {
        const on = Math.sin(t * 3) > 0;
        if (on) for (const [dx, dy] of [[-3, 1], [3, 1], [0, -2], [0, 3], [-2, -1], [2, -1], [-2, 3], [2, 3]]) this.px(a.fx + dx, a.my + dy, 'rgba(255,90,90,0.45)', false);
        this.pattern(['.KKK.', 'KRHRK', 'KRRRK', 'KrRrK', '.KKK.'], a.fx - 2, a.my - 1, { K: '#6a1010', R: on ? '#ff3b3b' : '#c8202c', r: on ? '#e02020' : '#9a1818', H: on ? '#ffffff' : '#ff8a8a' });
      },
    },
    pinocchio: {
      front(g, a, c, t) {
        // 거짓말할수록 코가 쭉쭉 자란다 (4초마다 다시 짧아진다). 뿌리는 두툼하고 끝으로 갈수록 가늘다
        const len = 3 + Math.floor((t % 4) * 1.6);
        const W = '#fbe3bf', w = '#e0b47e', E = '#5a3418';
        for (let i = 0; i < len; i++) {
          const x = a.fx + 1 + i;
          const thick = i < 2;
          this.px(x, a.my - 1, E);
          this.px(x, a.my, i === len - 1 ? w : W);
          if (thick) this.px(x, a.my + 1, w);
          this.px(x, a.my + (thick ? 2 : 1), E);
        }
        this.px(a.fx + 1 + len, a.my, E);
        this.px(a.fx, a.my, W);
        if (len > 8 && Math.floor(t * 4) % 2) this.pattern(['N.', 'Nn'], a.fx + len - 2, a.my - 3, { N: '#78c46a', n: '#4b8f43' });
      },
    },
    vampeyes: {
      front(g, a, c, t) {
        const glow = 0.5 + 0.5 * Math.sin(t * 2.5);
        for (const x0 of [a.eyeL, a.eyeR]) {
          this.rect(x0, a.ey, a.ew, a.eh, '#d8182e');
          this.px(x0 + (x0 === a.eyeL ? 1 : 0), a.ey, '#ff8a9a');
          for (let i = -1; i <= a.ew; i++) this.px(x0 + i, a.ey + a.eh, 'rgba(90,40,120,0.55)', false);
          for (const [dx, dy] of [[-1, 0], [a.ew, 0], [-1, 1], [a.ew, 1]]) this.px(x0 + dx, a.ey + dy, `rgba(255,40,60,${(0.15 + glow * 0.35).toFixed(2)})`, false);
        }
        // 치켜 올라간 눈썹
        this.px(a.eyeL - 1, a.ey - 2, c.K); this.px(a.eyeL, a.ey - 2, c.K); this.px(a.eyeL + 1, a.ey - 1, c.K);
        this.px(a.eyeR + a.ew, a.ey - 2, c.K); this.px(a.eyeR + a.ew - 1, a.ey - 2, c.K); this.px(a.eyeR, a.ey - 1, c.K);
      },
    },
    vampfang: {
      front(g, a) {
        const nx = a.fx - 1;
        this.pattern(['KWK.KWK', '.W...W.'], nx - 2, a.my + 2, { K: '#c9485e', W: '#ffffff' });
      },
    },
    pignose: {
      front(g, a, c) {
        this.pattern(['.KKK.', 'KPPPK', 'KpPpK', '.KKK.'], a.fx - 2, a.my - 1, { K: c.K, P: '#ffb3c7', p: '#b94a6a' });
      },
    },
    bearhood: {
      front(g, a, c) {
        const T = BEAR.T, Tr = BEAR.trim;
        hood(this, g, a, (dx, y) => {
          const adx = Math.abs(dx);
          if (isFace(a, dx, y)) return null;
          if ((adx === 5 && y >= a.ey - 1) || (y === a.ey - 2 && adx <= 5)) return Tr;
          return T;
        });
        // 머리 둘레보다 한 칸 크게 씌운다: 옆면과 정수리를 후드 천으로 덮고 바깥에 새 외곽선
        const bottom = a.curled ? GROUND - 1 : a.my + 2;
        for (let y = a.top; y <= bottom; y++) {
          this.px(a.left, y, T);
          this.px(a.right, y, T);
          this.px(a.left - 1, y, c.K);
          this.px(a.right + 1, y, c.K);
        }
        for (let x = a.left; x <= a.right; x++) { this.px(x, a.top, T); this.px(x, a.top - 1, c.K); }
        this.px(a.left, a.top - 1, c.K);
        this.px(a.right, a.top - 1, c.K);
        // 동그란 곰 귀를 고양이 귀 위에 딱 덮어 씌운다
        const m = { K: c.K, T, P: '#e8a0a0' };
        this.pattern(['.KK.', 'KTTK', 'KTPK', 'KTTK'], a.hx - 5, a.earTop - 2, m);
        this.pattern(['.KK.', 'KTTK', 'KPTK', 'KTTK'], a.hx + 2, a.earTop - 2, m);
      },
    },
    melonhelm: {
      front(g, a, c) {
        this.pattern(
          ['....KKKKKKK....', '..KKNnNNnNNKK..', '.KNnNNnNNnNNnK.', 'KNNnNNnNNnNNnNK', 'KNnNNnNNnNNnNNK', 'KWWWWWWWWWWWWWK', 'KRRkRRRRRkRRRRK', '.KKKKKKKKKKKKK.'],
          a.hx - 7, a.earTop - 3, { K: c.K, N: '#4f9a3a', n: '#2f6b2a', W: '#f4f8e8', R: '#ff5a5a', k: '#1a1a1a' },
        );
      },
    },
    arrowhit: {
      front(g, a, c) {
        const y0 = a.top + 1;
        const m = { R: '#e8534a', W: '#fffaf3', t: '#8a5a32', g: '#a8b0ba' };
        this.pattern(['RR.....', 'WRttttt', 'RR.....'], a.left - 7, y0 - 1, m);
        this.pattern(['..g..', 'ttggg', '..g..'], a.right + 1, y0 - 1, m);
      },
    },
    sheeptowel: {
      front(g, a, c) {
        this.pattern(
          ['.....KKKKKKK.....', '...KKQQQQQQQKK...', '.KKQQQqQQQqQQQKK.', 'KQQKQQQQQQQQQKQQK', 'KQqQKKKKKKKKKQqQK', 'KQQQK.......KQQQK', '.KKK.........KKK.'],
          a.hx - 8, a.earTop - 2, { K: c.K, Q: '#ffd3df', q: '#ff9bb8' },
        );
      },
    },
    combatcap: {
      front(g, a, c) {
        // 개구리 무늬(얼룩 초록) 전투모. 챙까지 무늬로 꽉 채우고, 가운데 이등병 작대기
        const P = ['#6b7d3a', '#3f5a2a', '#8f9a52', '#2f3a22', '#556b30'];
        const rows = ['..KKKKKKKKK..', '.KcccccccccK.', 'KcccccccccccK', 'KcccccccccccK', 'KcccccccccccK', '.KKKKKKKKKKK.'];
        const x0 = a.hx - 6;
        const y0 = a.earTop - 2;
        rows.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '.') continue;
            const col = ch === 'K' ? c.K : P[Math.floor(hash(Math.floor((x0 + i) * 0.7) * 9.1 + Math.floor((y0 + j) * 0.6) * 5.3) * P.length)];
            this.px(x0 + i, y0 + j, col);
          }
        });
        this.px(a.hx, y0 + 2, '#1f1c1b');
        this.px(a.hx, y0 + 3, '#1f1c1b');
      },
    },
    clownhat: {
      front(g, a, c, t) {
        const bob = sway(t, 5, 1);
        // 빨강·노랑 줄무늬 고깔 앞쪽에 작은 방울 둘, 아래는 흰 주름 칼라. 꼭대기 방울이 통통
        rowsAt(this, ['..KRK..', '..KYK..', '.KRGRK.', '.KYYYK.', 'KRRBRRK', 'KWKWKWK'], a.hx - 3, a.top - 6, { K: c.K, R: '#ff5a5a', Y: '#ffd65a', W: '#ffffff', G: '#78c46a', B: '#5aa0ff' }, [1, 1, 1, 0, 0, 0]);
        this.pattern(['.B.', 'BWB', '.B.'], a.hx - 1 + 1, a.top - 9 + bob, { B: '#5aa0ff', W: '#ffffff' });
      },
    },
    softcone: {
      front(g, a, c, t) {
        this.pattern(['...K...', '..KTK..', '.KTHTK.', '.KttttK', 'KTTTTTK', 'KtttttK', 'KKKKKKK'], a.hx - 3, a.top - 6, { K: c.K, T: '#8b5a2b', t: '#6b3f1a', H: '#c89060' });
        // 꼭대기에서 모락모락 올라오는 작은 김 두 줄기
        for (const [dx, ph] of [[-1, 0], [1, 0.8]]) {
          const p = ((t + ph) % 1.6) / 1.6;
          const y = a.top - 7 - Math.round(p * 4);
          const x = a.hx + dx + Math.round(Math.sin(p * 6 + ph) * 0.8);
          this.px(x, y, `rgba(255,255,255,${(0.75 * (1 - p)).toFixed(2)})`, false);
        }
      },
    },
    potnoodle: {
      front(g, a, c, t) {
        this.pattern(['...KKKKKKKKK...', '..KYHYYYYYYYK..', 'KKKYYYYYYYYYKKK', 'KYKYYYYYYYYYKYK', 'KKKyyyyyyyyyKKK', '..KKKKKKKKKKK..'], a.hx - 7, a.earTop - 3, { K: c.K, Y: '#e8c66a', H: '#fff3c0', y: '#b8963e' });
        const N = '#fff0a8';
        const s = sway(t, 3, 1);
        for (const [x, n] of [[a.hx - 3, 3], [a.hx + 3, 2], [a.hx, 1]]) for (let i = 0; i < n; i++) this.px(x + (i % 2 ? s : 0), a.top + 1 + i, N);
        const p = (t % 2.5) / 1.2;
        if (p < 1) this.px(a.hx + 2 + Math.round(Math.sin(p * 6)), a.earTop - 4 - Math.round(p * 5), `rgba(255,255,255,${(0.8 * (1 - p)).toFixed(2)})`, false);
      },
    },
    unicorn: {
      front(g, a, c, t) {
        const hue = (k) => `hsl(${Math.round((k * 50 + t * 160) % 360)},90%,70%)`;
        const yb = a.top;
        for (let i = 0; i < 10; i++) {
          const y = yb - i;
          const w = i < 5 ? 1 : 0;
          for (let dx = -w; dx <= w; dx++) this.px(a.hx + dx, y, hue(i + dx));
          this.px(a.hx - w - 1, y, i > 0 ? c.K : c.K);
          this.px(a.hx + w + 1, y, c.K);
          if (i % 2) for (const s of [-1, 1]) this.px(a.hx + s * (w + 2), y, 'rgba(255,255,255,0.3)', false);
        }
        this.px(a.hx, yb - 10, c.K);
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.9 + i / 3) % 1;
          if (p < 0.5) star(this, a.hx + [-4, 4, 1][i], yb - 9 + [0, 2, -3][i], hue(i * 3));
        }
      },
    },

    // ======================= 몸 (옷) =======================
    santasuit: {
      front(g, a, c, t) {
        // 흰 털 칼라 → 빨간 옷 → 까만 허리띠와 금빛 버클 → 까만 장화. 배가 나와서 옆구리가 한 칸씩 볼록
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#26262e';
          if (dy <= -2) return '#fffaf3';
          if (dy === 0 && !a.curled) return adx <= 1 ? (dx === 0 ? '#b8871a' : '#ffd65a') : '#1f1c1b';
          return adx >= 5 ? '#a8322c' : '#e8534a';
        });
        if (a.curled) return;
        for (const s of [-1, 1]) {
          const x = s < 0 ? a.left : a.right;
          this.px(x, a.my + 2, '#e8534a');
          this.px(x + s, a.my + 2, c.K);
          this.px(x, a.my + 3, '#1f1c1b');
          this.px(x + s, a.my + 3, c.K);
        }
      },
    },
    bearsuit: {
      front(g, a, c) {
        // 후드와 같은 갈색. 배는 밝게, 가운데 단추 두 개, 발끝까지 덮는다
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (!leg && adx <= 2 && dy >= -1) return dx === 0 && (dy === 0 || dy === -1) && !a.curled ? '#6b4428' : BEAR.belly;
          return adx >= 5 ? BEAR.shade : BEAR.T;
        });
        // 옆구리도 한 칸 크게 (후드 옆면과 이어진다)
        if (!a.curled) for (let y = a.my + 3; y <= GROUND - 1; y++) { this.px(a.left, y, BEAR.T); this.px(a.right, y, BEAR.T); this.px(a.left - 1, y, c.K); this.px(a.right + 1, y, c.K); }
      },
    },
    archmage: {
      back(g, a, c) {
        if (a.curled) return;
        for (const s of [-1, 1]) {
          const x = s < 0 ? a.left - 1 : a.right + 1;
          this.pattern(['K', 'V', 'V', 'Y'], x, a.my - 1, { K: c.K, V: '#3b2f7a', Y: '#ffd65a' });
        }
      },
      front(g, a, c, t) {
        const V = '#3b2f7a', v = '#2a2159', Gd = '#ffd65a';
        const rune = `hsl(${Math.round(45 + 140 * (0.5 + 0.5 * Math.sin(t * 2)))},100%,72%)`;
        const R = { '-4,0': 1, '3,0': 1, '-2,1': 1, '5,-1': 1, '-5,-1': 1 };
        wear(this, g, a, (dx, dy) => (dx === 0 ? Gd : R[dx + ',' + dy] ? rune : Math.abs(dx) >= 5 ? v : V));
        skirt(this, a, c, [0, 1], (x, y, k) => (k === 1 ? (x % 2 ? Gd : v) : x === a.hx ? Gd : V));
        for (let i = 0; i < 2; i++) {
          const p = (t * 0.5 + i / 2) % 1;
          this.px(a.hx + (i ? 5 : -5) + Math.round(Math.sin(p * 8)), a.my + 2 - Math.round(p * 12), `hsla(${Math.round(45 + 140 * p)},100%,72%,${(1 - p).toFixed(2)})`, false);
        }
      },
    },
    pierrot: {
      front(g, a, c) {
        wear(this, g, a, (dx, dy, x, y) => {
          if (dx === 0) return '#ffd65a';
          const dot = hash(x * 11 + y * 3) < 0.25;
          return dx < 0 ? (dot ? '#ffffff' : '#ff5a5a') : dot ? '#ffd65a' : '#5aa0ff';
        });
        if (a.curled) return;
        for (let x = a.left - 2; x <= a.right + 2; x++) {
          if (Math.abs(x - a.fx) <= 1) continue;
          const col = Math.floor(x / 2) % 2 ? '#ffffff' : '#ffd65a';
          this.px(x, a.my + 2, col);
          if (x % 2 === 0 && Math.abs(x - a.fx) >= 3) this.px(x, a.my + 1, col);
        }
      },
    },
    reservist: {
      front(g, a) {
        const P = ['#5b6b3a', '#3e4a28', '#8a7a4a', '#2e2a1e'];
        wear(this, g, a, (dx, dy, x, y) => P[Math.floor(hash(Math.floor(x / 2) * 9.1 + Math.floor(y / 2) * 5.3) * 4)]);
        if (!a.curled) for (let d = -4; d <= -2; d++) this.px(a.hx + d, a.my + 3, d === -3 ? '#1f1c1b' : '#e8e2c8');
      },
    },
    prisoner: {
      front(g, a, c) {
        wear(this, g, a, (dx, dy, x, y) => (y % 2 ? '#26262a' : '#f4f4f0'));
        if (a.curled) return;
        for (let i = 0; i < 3; i++) this.px(a.right + i, GROUND - (i % 2), '#9aa0a8');
        this.pattern(['.KK.', 'KkWK', 'KkkK', '.KK.'], a.right + 3, GROUND - 3, { K: c.K, k: '#3a3a40', W: '#8a8a94' });
      },
    },
    discosuit: {
      back(g, a, c, t) {
        const pal = ['#ffd65a', '#ff9bd5', '#9fe8ff', '#c0a0ff', '#ffffff'];
        for (let i = 0; i < 7; i++) {
          const ang = t * 1.4 + i * 0.9;
          const x = a.cx + Math.cos(ang) * (13 + (i % 3) * 3);
          const y = a.cy - 8 + Math.sin(ang * 1.3 + i) * 10;
          this.px(x, y, pal[i % pal.length], false);
          if (i % 2) this.px(x + 1, y, 'rgba(255,255,255,0.5)', false);
        }
      },
      front(g, a, c, t) {
        const pal = ['#ffd65a', '#fff4c2', '#dfe6ff', '#ff9bd5', '#9fe8ff', '#c0a0ff'];
        const f = Math.floor(t * 6);
        wear(this, g, a, (dx, dy, x, y) => (Math.abs(dx) === 1 && dy === 0 ? '#ffffff' : pal[Math.floor(hash(x * 13 + y * 7 + f * 3.7) * pal.length)]));
        if (t % 1.2 < 0.25) star(this, a.hx + (Math.floor(t / 1.2) % 2 ? 4 : -4), a.my + 3, '#ffffff');
      },
    },

    // ======================= 등 =======================
    devilwings: {
      back(g, a, c, t) {
        const f = Math.round(Math.sin(t * 4) * 1.2);
        const pu = 0.5 + 0.5 * Math.sin(t * 3);
        const L = ['.........E', '.......EEK', '.....EEMMK', '...EEMMMMK', '.EEMMmMMMK', 'EMMMMMmMMK', 'KMKMMKMMmK', 'K.K.KK.KKK'];
        const m = { K: '#1a0a14', M: '#6a1a3a', m: '#3a0a20', E: `rgb(255,${Math.round(40 + pu * 70)},90)` };
        this.pattern(L, a.hx - 15, a.top - 3 + f, m);
        this.pattern(mirror(L), a.hx + 6, a.top - 3 + f, m);
        // 가느다란 악마 꼬리: 왼쪽 엉덩이에서 바닥을 따라 뻗어 날개 아래로 나오고, 끝은 뾰족한 스페이드 촉. 살랑살랑
        let tx = 0, ty = 0;
        for (let i = 0; i <= 24; i++) {
          const s = i / 24;
          tx = a.left + 2 - 9 * s;
          ty = GROUND - 1 - 2.5 * Math.sin(Math.PI * s * 0.85) + Math.sin(t * 3.5 - s * 5) * s * 0.9;
          this.px(tx, ty + 1, m.K);
          this.px(tx, ty, '#c8305a');
        }
        this.pattern(['..KK', '.KEK', 'KEEM', '.KEK', '..KK'], Math.round(tx) - 4, Math.round(ty) - 2, { K: m.K, E: '#ff4a6a', M: '#c8305a' });
        for (let i = 0; i < 2; i++) {
          const p = (t * 0.7 + i / 2) % 1;
          this.px(a.hx + (i ? 10 : -11), a.top - 3 - Math.round(p * 8), `rgba(255,${Math.round(90 + p * 100)},60,${(1 - p).toFixed(2)})`, false);
        }
      },
    },
    aureole: {
      back(g, a, c, t) {
        // 머리 뒤에만 조그맣게 빛나는 금빛 원판
        const cx = a.hx + 0.5;
        const cy = a.ey - 1;
        const pu = 0.75 + 0.25 * Math.sin(t * 2.5);
        for (let y = Math.floor(cy - 9); y <= cy + 9; y++)
          for (let x = Math.floor(cx - 9); x <= cx + 9; x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            if (d <= 7.5) this.px(x, y, `rgba(255,236,150,${(0.35 * pu).toFixed(2)})`, false);
            else if (d <= 8.5) this.px(x, y, '#ffd65a', false);
          }
        for (let i = 0; i < 20; i++) {
          const ang = (i / 20) * Math.PI * 2 + t * 0.5;
          if (Math.sin(ang) > 0.55) continue; // 몸 쪽(아래)으로는 빛살을 안 뻗는다
          const len = i % 2 ? 10.5 : 11.5;
          for (let r = 9.5; r < len; r++) this.px(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, `rgba(255,214,90,${(0.7 * pu).toFixed(2)})`, false);
        }
      },
    },
    ghostpal: {
      back(g, a, c, t) {
        const bob = Math.round(Math.sin(t * 2) * 1.5);
        const boo = t % 5 < 0.8;
        this.pattern(['..KKKK..', '.KWWWWK.', 'KWWWWWWK', 'KWkWWkWK', boo ? 'KWWkkWWK' : 'KWWWWWWK', 'KWWWWWWK', 'KWWWWWWK', 'KWKWWKWK', '.K.KK.K.'], a.right - 3, a.top - 6 + bob, {
          K: 'rgba(70,80,120,0.85)', W: 'rgba(242,246,255,0.9)', k: '#2a2f4a',
        }, false);
        const p = (t * 0.6) % 1;
        this.pattern(['.B.', 'BWB', '.B.'], a.right + 6 + Math.round(Math.cos(p * 6.28) * 2), a.top - 8 + Math.round(Math.sin(p * 6.28) * 2), { B: 'rgba(110,170,255,0.7)', W: '#dff0ff' }, false);
      },
      front(g, a) {
        if (a.curled) return;
        this.px(a.right - 1, a.my + 1, 'rgba(242,246,255,0.95)');
        this.px(a.right - 2, a.my + 1, 'rgba(242,246,255,0.95)');
      },
    },
    flywings: {
      back(g, a, c, t) {
        const up = Math.floor(t * 24) % 2 === 0;
        const m = { V: 'rgba(70,80,100,0.85)', W: 'rgba(215,235,255,0.6)' };
        const L = up ? ['..VVVV.', '.VWWWWV', 'VWWVWWV', 'VWVWWV.', 'VWWWV..', '.VVV...'] : ['.VVVVVV.', 'VWWVWWWV', 'VWVWWVV.', '.VVVV...'];
        const y = a.top - (up ? 3 : 0);
        // 날개 뿌리가 몸 뒤에 숨도록 어깨에 딱 붙인다
        this.pattern(L, a.left - L[0].length + 3, y + 2, m, false);
        this.pattern(mirror(L), a.right - 2, y + 2, m, false);
      },
    },
    butterfly: {
      back(g, a, c, t) {
        // 날개를 접을 때도 막대처럼 가늘어지지 않게 최소 폭을 둔다
        const s = 0.72 + 0.28 * Math.abs(Math.sin(t * 2.2));
        const inside = (u, v) => {
          const X = u / s;
          return ((X - 6) / 6) ** 2 + ((v + 4) / 5.5) ** 2 <= 1 || ((X - 4) / 4.2) ** 2 + ((v - 3) / 3.5) ** 2 <= 1;
        };
        const f = Math.floor(t * 5);
        for (const side of [-1, 1])
          for (let u = 0; u <= 13; u++)
            for (let v = -10; v <= 7; v++) {
              if (!inside(u, v)) continue;
              const edge = !inside(u + 1, v) || !inside(u - 1, v) || !inside(u, v + 1) || !inside(u, v - 1);
              const X = u / s;
              let col = edge ? '#2a1a4a' : X < 3 ? '#ff7ad9' : X < 7.5 ? '#9b6bff' : '#4fb0ff';
              if (!edge && ((Math.abs(X - 8) < 1.2 && Math.abs(v + 5) < 1.2) || (Math.abs(X - 4) < 1 && Math.abs(v - 3) < 1))) col = '#ffffff';
              if (!edge && hash(u * 13 + v * 7 + side * 3 + f) > 0.93) col = '#fff6b0';
              this.px(a.hx + side * (3 + u), a.top + 1 + v, col, false);
            }
      },
    },
    jetpack: {
      back(g, a, c, t) {
        const m = { K: c.K, M: '#c3ccd6', m: '#7a8694', H: '#ffffff', R: '#e8534a' };
        const tank = ['.KKK.', 'KMHMK', 'KMMMK', 'KRRRK', 'KMMMK', 'KmmmK', '.KgK.'];
        m.g = '#454b57';
        const y0 = a.top + 1;
        const xs = [a.left - 4, a.right];
        for (const x of xs) this.pattern(tank, x, y0, m);
        for (const x of xs) {
          const n = 2 + Math.floor(hash(Math.floor(t * 14) + x) * 3);
          for (let j = 0; j < n; j++) {
            const col = j === 0 ? '#ffffff' : j === 1 ? '#ffd65a' : j === 2 ? '#ff9a3c' : '#ff5a3a';
            this.px(x + 2, y0 + 7 + j, col, false);
            if (j < 2) { this.px(x + 1, y0 + 7 + j, 'rgba(255,190,80,0.6)', false); this.px(x + 3, y0 + 7 + j, 'rgba(255,190,80,0.6)', false); }
          }
          const p = (t * 1.2 + (x & 1) * 0.5) % 1;
          this.px(x + 2 + Math.round((x < a.hx ? -1 : 1) * p * 4), GROUND + 1 - Math.round(p * 2), `rgba(210,210,215,${(0.7 * (1 - p)).toFixed(2)})`, false);
        }
      },
    },
    herocape: {
      // 무늬 없는 새빨간 히어로 망토 (2026-09-24: 생선 무늬를 빼고 깔끔하게). 어깨에서 양옆으로 퍼지며 펄럭이고,
      // 바깥쪽 끝은 어둡게, 안쪽 어깨는 밝게. 세로 주름이 물결 따라 흐른다. 턱 밑에 금색 걸쇠
      back(g, a, c, t) {
        const R = '#e8403a', r = '#a8262a', H = '#ff7a64';
        if (a.curled) {
          this.ellipse(a.cx - 1, a.cy, 9.5, 5.5, (x, y) => (x < a.cx - 6 ? r : y < a.cy - 2 ? H : R), c.K);
          return;
        }
        for (let y = a.top + 2; y <= GROUND; y++) {
          const k = y - a.top - 1;
          const wave = Math.round(Math.sin(t * 5 - k * 0.6) * 1.2);
          const x0 = a.left - Math.floor(k * 0.9) + (k > 2 ? wave : 0);
          const x1 = a.right + 1 + Math.floor(k * 0.5) + (k > 3 ? Math.round(Math.sin(t * 5 - k * 0.6 + 1.5)) : 0);
          const fold = a.left - 3 - Math.floor(k * 0.45) + (k > 2 ? wave : 0);
          for (let x = x0; x <= x1; x++) {
            const col = x === x0 || x === x1 || y === GROUND ? c.K : x <= x0 + 1 || x >= x1 - 1 ? r : x === fold ? r : k <= 2 ? H : R;
            this.px(x, y, col);
          }
        }
      },
      front(g, a, c) {
        if (a.curled) return;
        // 턱 밑 망토 끈 + 금색 걸쇠
        this.pattern(['R.....R', '.RRYRR.'], a.hx - 3, a.my + 2, { R: '#e8403a', Y: '#ffd65a' });
      },
    },

    // ======================= 손 =======================
    trident: {
      hand: true,
      front(g, a, c, t) {
        const D = '#4a1414', R = '#b0242a';
        const glow = `rgb(255,${Math.round(110 + Math.sin(t * 6) * 60)},60)`;
        if (a.curled) {
          for (let x = a.right + 1; x <= a.right + 11; x++) this.px(x, GROUND - 1, D);
          this.pattern(['G..', 'RRR', 'G..', 'RRR', 'G..'].map((r) => r), a.right + 12, GROUND - 3, { G: glow, R });
          return;
        }
        const x = a.right + 1;
        for (let y = a.cy - 9; y <= a.cy + 4; y++) this.px(x, y, D);
        this.pattern(['G.G.G', 'R.R.R', 'R.R.R', 'RRRRR', '..R..'], x - 2, a.cy - 14, { G: glow, R });
        heldPaw(this, g, x, a.cy + 1);
        const p = (t * 0.8) % 1;
        this.px(x - 2 + Math.floor(hash(Math.floor(t * 0.8)) * 5), a.cy - 15 - Math.round(p * 5), `rgba(255,120,60,${(1 - p).toFixed(2)})`, false);
      },
    },
    dualpistol: {
      hand: true,
      front(g, a, c, t) {
        const R = ['.KKKKKKKK', 'KDDgDDDDK', 'KDDDDKKKK', 'KDDKDK...', 'KDDKK....', 'KKKK.....'];
        if (a.curled) {
          this.pattern(['.KKKKKKK', 'KDDgDDDK', 'KKKKKKKK'], a.right + 1, GROUND - 2, c);
          this.pattern(mirror(['.KKKKKKK', 'KDDgDDDK', 'KKKKKKKK']), a.left - 8, GROUND - 2, c);
          return;
        }
        this.pattern(R, a.right - 1, a.cy - 2, c);
        heldPaw(this, g, a.right, a.cy + 2);
        this.pattern(mirror(R), a.left - 7, a.cy - 2, c);
        heldPaw(this, g, a.left, a.cy + 2);
        const ph = t % 2.4;
        if (ph < 0.8 && ph % 0.2 < 0.08) {
          const right = Math.floor(ph / 0.2) % 2 === 0;
          this.pattern(['.Y.', 'YWY', '.Y.'], right ? a.right + 8 : a.left - 10, a.cy - 3, c);
        }
      },
    },
    excalibur: {
      hand: true,
      front(g, a, c, t) {
        const S = '#eef3fa', s = '#a8b6c8', Gd = '#ffd65a';
        const gem = Math.floor(t * 2) % 2 ? '#9fd8ff' : '#4fa3ff';
        if (a.curled) {
          const y = GROUND - 1;
          for (let x = a.right + 4; x <= a.right + 14; x++) { this.px(x, y - 1, S); this.px(x, y, s); }
          for (let d = -2; d <= 1; d++) this.px(a.right + 3, y + d, Gd);
          this.px(a.right + 1, y, '#6b3f1a');
          this.px(a.right + 2, y, '#6b3f1a');
          return;
        }
        const x = a.right + 1;
        for (let y = a.cy - 16; y <= a.cy - 2; y++) {
          this.px(x - 2, y, 'rgba(190,230,255,0.35)', false);
          this.px(x + 2, y, 'rgba(190,230,255,0.35)', false);
          this.px(x - 1, y, S);
          this.px(x, y, s);
          this.px(x + 1, y, S);
        }
        this.px(x, a.cy - 17, S);
        for (let d = -3; d <= 3; d++) this.px(x + d, a.cy - 1, Math.abs(d) === 3 ? c.K : Gd);
        this.px(x, a.cy, '#6b3f1a');
        this.px(x, a.cy + 1, '#6b3f1a');
        this.px(x, a.cy + 2, gem);
        heldPaw(this, g, x, a.cy + 1);
        const p = (t % 2.2) / 0.5;
        if (p < 1) { const yy = a.cy - 2 - Math.round(p * 14); for (let d = -1; d <= 1; d++) this.px(x + d, yy, '#ffffff'); }
        if (t % 1.1 < 0.35) star(this, x, a.cy - 20, '#fff6c0');
      },
    },
    fryingpan: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, D: '#2b2b30', W: '#fffaf3', Y: '#ffb020', t: '#6b3f1a' };
        if (a.curled) {
          this.pattern(['.KKKKK.', 'KDWYWDKttt', '.KKKKK.'], a.right + 1, GROUND - 2, m);
          return;
        }
        this.pattern(['.KKKKK.', 'KDDDDDK', 'KDWWWDK', 'KDWYWDK', 'KDWWWDK', 'KDDDDDK', '.KKKKK.', '...K...', '..KtK..', '..KtK..'], a.right, a.cy - 9, m);
        heldPaw(this, g, a.right + 3, a.cy + 1);
        const p = (t % 2) / 1;
        if (p < 1) this.px(a.right + 3 + Math.round(Math.sin(p * 7)), a.cy - 10 - Math.round(p * 5), `rgba(255,255,255,${(0.8 * (1 - p)).toFixed(2)})`, false);
      },
    },
    whip: {
      hand: true,
      front(g, a, c, t) {
        const B = '#6b3f1a';
        if (a.curled) {
          for (let i = 0; i < 10; i++) this.px(a.right + 2 + i, GROUND - 1 - (i % 3 === 1 ? 1 : 0), B);
          return;
        }
        const ph = t % 3;
        const crack = ph < 0.35;
        const k = ph / 0.35;
        for (let i = 0; i < 14; i++) {
          let x, y;
          if (!crack) { x = a.right + 3 + i * 0.7; y = a.cy - 1 + Math.sin(i * 0.55 + t * 2) * 1.5 + i * 0.35; }
          else { x = a.right + 3 + i; y = a.cy - 2 - Math.sin((i / 13) * Math.PI) * 3 * (1 - k); }
          if (x < 48) this.px(x, y, B);
        }
        this.px(a.right + 1, a.cy, '#3a2010');
        this.px(a.right + 2, a.cy - 1, '#3a2010');
        heldPaw(this, g, a.right + 1, a.cy + 1);
        if (crack && k > 0.5) this.pattern(['Y.Y', '.W.', 'Y.Y'], Math.min(45, a.right + 15), a.cy - 3, { Y: '#ffd65a', W: '#ffffff' }, false);
      },
    },
    starwand: {
      hand: true,
      front(g, a, c, t) {
        const Y = Math.floor(t * 4) % 2 ? '#fff6a0' : '#ffd65a';
        const m = { K: c.K, Y, W: '#ffffff' };
        const starRows = ['...K...', '..KYK..', 'KKYYYKK', 'KYYWYYK', '.KYYYK.', 'KYK.KYK', 'KK...KK'];
        if (a.curled) {
          for (let x = a.right + 1; x <= a.right + 6; x++) this.px(x, GROUND - 1, x % 2 ? '#ff9bb8' : '#ffffff');
          this.pattern(starRows, a.right + 7, GROUND - 6, m);
          return;
        }
        const x = a.right + 1;
        for (let y = a.cy - 6; y <= a.cy + 1; y++) this.px(x, y, y % 2 ? '#ff9bb8' : '#ffffff');
        this.pattern(starRows, x - 3, a.cy - 13, m);
        heldPaw(this, g, x, a.cy + 1);
        const cols = ['#ff9bd5', '#9fe8ff', '#fff6a0', '#c0a0ff'];
        for (let i = 0; i < 4; i++) {
          const p = (t * 0.8 + i / 4) % 1;
          const px = x - 4 + Math.round(hash(i + Math.floor(t * 0.8 + i / 4) * 4) * 8);
          const py = a.cy - 10 + Math.round(p * 12);
          this.ctx.globalAlpha = 1 - p;
          this.pattern(['.X.', 'X.X', '.X.'], px - 1, py - 1, { X: cols[i] }, false);
          this.ctx.globalAlpha = 1;
        }
      },
    },
    greenonion: {
      hand: true,
      front(g, a, c, t) {
        const Wt = '#f6f4ea', wt = '#dcd8c6', Lg = '#b8e08a', Dg = '#4b8f43', dg = '#78c46a';
        if (a.curled) {
          const y = GROUND - 1;
          let x = a.right + 1;
          for (let i = 0; i < 4; i++) { this.px(x, y, Wt); this.px(x++, y - 1, wt); }
          for (let i = 0; i < 2; i++) { this.px(x, y, Lg); this.px(x++, y - 1, Lg); }
          for (let i = 0; i < 6; i++) { this.px(x + i, y - Math.floor(i / 3), Dg); this.px(x + i, y + (i > 3 ? 0 : 0) - 1 - Math.floor(i / 2), dg); }
          return;
        }
        const x = a.right + 1;
        for (const d of [-1, 0, 1]) this.px(x + d, a.cy + 4, '#c9b48a');
        for (let y = a.cy - 3; y <= a.cy + 3; y++) { this.px(x, y, Wt); this.px(x + 1, y, wt); }
        for (let y = a.cy - 6; y <= a.cy - 4; y++) { this.px(x, y, Lg); this.px(x + 1, y, Lg); }
        const s = sway(t, 2, 1);
        for (let i = 0; i < 9; i++) {
          const y = a.cy - 7 - i;
          this.px(x - Math.floor(i / 4) + (i > 5 ? s : 0), y, Dg);
          if (i < 8) this.px(x + 1 + Math.floor(i / 3) + (i > 5 ? s : 0), y, dg);
        }
        heldPaw(this, g, x, a.cy + 1);
      },
    },
    shuriken: {
      hand: true,
      front(g, a, c, t) {
        const fr = Math.floor(t * 8) % 2;
        const m = { K: c.K, S: '#c3ccd6', s: '#7a8694', H: '#ffffff' };
        const rows = fr ? ['..K..', '.KSK.', 'KSsSK', '.KSK.', '..K..'] : ['K...K', '.KSK.', '.SsS.', '.KSK.', 'K...K'];
        if (a.curled) { this.pattern(rows, a.right + 2, GROUND - 4, m); return; }
        this.pattern(rows, a.right + 1, a.cy - 4, m);
        heldPaw(this, g, a.right + 1, a.cy + 1);
        if (t % 1.6 < 0.2) this.px(a.right + 3, a.cy - 4, '#ffffff');
      },
    },
    sojubottle: {
      hand: true,
      front(g, a, c, t) { this._bottle(g, a, c, t, false); },
    },
    brokensoju: {
      hand: true,
      front(g, a, c, t) { this._bottle(g, a, c, t, true); },
    },
    handgrenade: {
      hand: true,
      front(g, a, c, t) {
        // 동그란 고리 안전핀 + 옆으로 붙은 손잡이(레버) + 칸칸이 나뉜 초록 몸통. 앞발은 아랫부분만 쥔다
        const m = { K: c.K, N: '#5b7a3a', n: '#3e5628', H: '#8fae6a', g: '#b8c0cc', G: '#8e9aaa' };
        const rows = ['.gg.....', 'g..g....', '.gg.KKK.', '...KGGGK', '..KNNNKG', '.KNHNnNK', '.KnNnNnK', '.KNnNnNK', '..KNNNK.', '...KKK..'];
        if (a.curled) { this.pattern(rows, a.right + 1, GROUND - 9, m); return; }
        const shake = t % 2 < 0.3 ? sway(t, 40, 1) : 0;
        this.pattern(rows, a.right - 2 + shake, a.cy - 9, m);
        heldPaw(this, g, a.right + 1, a.cy + 1);
      },
    },
    cigesse: { hand: true, front(g, a, c, t) { this._cig(g, a, c, t, CIG.esse); } },
    cigmarlboro: { hand: true, front(g, a, c, t) { this._cig(g, a, c, t, CIG.marlboro); } },
    cigdevil: { hand: true, front(g, a, c, t) { this._cig(g, a, c, t, CIG.devil); } },

    // ======================= 효과 =======================
    saiyan: {
      back(g, a, c, t) {
        const cx = a.cx;
        const cy = a.cy - 2;
        for (let y = a.top - 9; y <= GROUND; y++) {
          const k = (y - cy) / 12;
          const w = 10 * Math.sqrt(Math.max(0, 1 - k * k * 0.8)) + Math.sin(t * 20 + y * 1.3) * 1.2;
          if (w < 1) continue;
          for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
            const e = Math.abs(x - cx) / w;
            this.px(x, y, e > 0.8 ? 'rgba(255,225,70,0.85)' : e > 0.55 ? 'rgba(255,240,140,0.45)' : 'rgba(255,250,200,0.2)', false);
          }
        }
        for (let i = -1; i <= 1; i++) {
          const h = 4 + Math.round(Math.sin(t * 15 + i * 2) * 2);
          for (let j = 0; j < h; j++) this.px(cx + i * 4, a.top - 10 - j, 'rgba(255,230,90,0.8)', false);
        }
      },
    },
    tipsy: {
      front(g, a, c, t) {
        const B = 'rgba(255,50,80,0.75)';
        for (const [x, y] of [[a.eyeL - 2, a.ey + 2], [a.eyeL - 1, a.ey + 2], [a.eyeL - 2, a.ey + 3], [a.eyeL - 1, a.ey + 3], [a.eyeR + a.ew, a.ey + 2], [a.eyeR + a.ew + 1, a.ey + 2], [a.eyeR + a.ew, a.ey + 3], [a.eyeR + a.ew + 1, a.ey + 3]]) this.px(x, y, B, false);
        // 방울: 머리 둘레 여기저기서 부풀었다가 톡 터진다
        for (let i = 0; i < 5; i++) {
          const P = 1.6;
          const tt = t + i * 0.37;
          const n = Math.floor(tt / P);
          const ph = (tt % P) / P;
          const ang = hash(n * 5 + i) * Math.PI * 2;
          const r = 9 + hash(n * 3 + i) * 3;
          const x = Math.round(a.hx + Math.cos(ang) * r);
          const y = Math.round(a.ey - 3 + Math.sin(ang) * r * 0.6);
          const col = `hsla(${Math.round((i * 70 + t * 60) % 360)},80%,85%,0.9)`;
          if (ph < 0.3) this.px(x, y, col, false);
          else if (ph < 0.75) this.pattern(['.X.', 'XWX', '.X.'].map((row, j) => (j === 1 ? 'X.X' : row)), x - 1, y - 1, { X: col }, false);
          else if (ph < 0.9) for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1]]) this.px(x + dx, y + dy, col, false);
        }
      },
    },
    stinky: {
      back(g, a, c, t) {
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.5 + i / 3) % 1;
          const bx = a.cx - 6 + i * 6;
          for (let j = 0; j < 6; j++) {
            const y = Math.round(a.top - 1 - p * 8 - j);
            this.px(bx + Math.round(Math.sin(j * 0.9 + t * 3 + i) * 1.3), y, `rgba(130,180,70,${(0.85 * (1 - p)).toFixed(2)})`, false);
          }
        }
      },
      front(g, a, c, t) {
        for (let i = 0; i < 2; i++) {
          const ang = t * (2.2 + i * 0.7) + i * 3;
          const x = Math.round(a.hx + Math.cos(ang) * (10 - i * 2) + Math.sin(t * 9 + i));
          const y = Math.round(a.top - 3 + Math.sin(ang * 2) * 3);
          this.px(x, y, '#1a1a1a', false);
          this.px(x + 1, y, '#1a1a1a', false);
          if (Math.floor(t * 20 + i) % 2) { this.px(x, y - 1, 'rgba(220,230,255,0.9)', false); this.px(x + 1, y - 1, 'rgba(220,230,255,0.9)', false); }
        }
      },
    },
    snowfall: {
      front(g, a, c, t) {
        // 창·카드 밖으로 안 나가게 고양이 둘레 30칸 폭, 위에서 4칸 아래부터 스르르 나타난다
        const ctx = this.ctx;
        const prev = ctx.globalAlpha;
        for (let i = 0; i < 16; i++) {
          const sp = 5 + hash(i) * 4;
          const y = 4 + ((t * sp + hash(i + 50) * 44) % 44);
          if (y > GROUND + 1) continue;
          const x = a.cx - 15 + hash(i + 100) * 30 + Math.sin(t * 1.5 + i) * 1.5;
          const col = i % 3 ? '#ffffff' : '#dff0ff';
          ctx.globalAlpha = prev * Math.min(1, (y - 3) / 4);
          this.px(x, y, col, false);
          if (i % 4 === 0) { this.px(x + 1, y, col, false); this.px(x - 1, y, col, false); this.px(x, y - 1, col, false); this.px(x, y + 1, col, false); }
        }
        ctx.globalAlpha = prev;
        this.pattern(['.WWW.', 'WWWWW'], a.hx - 2, a.top - 1, { W: '#ffffff' });
        for (let x = a.cx - 12; x <= a.cx + 12; x++) if (hash(x) > 0.35) this.px(x, GROUND + 1, '#ffffff', false);
      },
    },
    raincloud: {
      front(g, a, c, t) {
        const bob = Math.round(Math.sin(t * 1.5));
        const x0 = a.hx - 5;
        const y0 = a.top - 13 + bob;
        this.pattern(['...KKK.....', '..KgggK.KK.', '.KggHggKggK', 'KgggggggggK', 'KGGGGGGGGGK', '.KKKKKKKKK.'], x0, y0, { K: '#4a4f5a', g: '#9aa2ae', G: '#7a828e', H: '#c8ced6' }, false);
        for (let i = 0; i < 7; i++) {
          const span = GROUND - (y0 + 6);
          const y = y0 + 6 + ((t * 22 + hash(i) * span) % span);
          const x = x0 + 1 + ((i * 3) % 9);
          this.px(x, y, '#8fc2e3', false);
          this.px(x, y + 1, '#c6e4f7', false);
        }
        for (let x = x0 - 2; x <= x0 + 13; x++) this.px(x, GROUND + 1, 'rgba(143,194,227,0.6)', false);
      },
    },
    sakura: {
      front(g, a, c, t) {
        // 고양이 둘레 32칸 폭 안에서만 흩날린다. 양 끝과 맨 위에선 흐려져서 튀어나오거나 사라지는 게 안 보인다
        const ctx = this.ctx;
        const prev = ctx.globalAlpha;
        for (let i = 0; i < 10; i++) {
          const sp = 4 + hash(i) * 3;
          const y = 4 + (((t * sp) / 44 + hash(i + 9)) % 1) * 44;
          const u = (((hash(i + 30) * 32 + t * 6 + Math.sin(t * 2 + i) * 3) % 32) + 32) % 32;
          const x = a.cx - 16 + u;
          const col = i % 2 ? '#ffc2d6' : '#ff9bb8';
          // 꽃잎: 빙글 돌며 떨어진다 (세 칸짜리 잎 모양 셋을 번갈아)
          const rot = Math.floor(t * 4 + i) % 3;
          ctx.globalAlpha = prev * Math.min(1, Math.min(u, 31 - u) / 3, (y - 3) / 4);
          this.pattern([['XX', '.x'], ['X.', 'xX'], ['.X', 'Xx']][rot], x, y, { X: col, x: '#ff7aa2' }, false);
        }
        ctx.globalAlpha = prev;
      },
    },
    moneyrain: {
      front(g, a, c, t) {
        const ctx = this.ctx;
        const prev = ctx.globalAlpha;
        for (let i = 0; i < 11; i++) {
          const sp = 7 + hash(i) * 5;
          // 고양이 둘레 28칸 폭, 위에서 3칸 아래부터 스르르 나타난다 (창·카드 밖으로 안 나가게)
          const y = Math.round(3 + ((t * sp + hash(i + 3) * 52) % 52));
          const x = Math.round(a.cx - 16 + hash(i + 7) * 28 + Math.sin(t * 2 + i) * 2);
          if (y > GROUND) continue;
          ctx.globalAlpha = prev * Math.min(1, (y - 2) / 4);
          if (i % 3 === 0) {
            const flip = Math.floor(t * 8 + i) % 3;
            this.pattern([['.YY.', 'YyyY', '.YY.'], ['.Y.', 'YyY', '.Y.'], ['Y', 'y', 'Y']][flip], x, y, { Y: '#ffd65a', y: '#e8a21f' }, false);
          } else {
            const m = i % 2 ? { B: '#7cc26a', b: '#3f7a38' } : { B: '#f0c870', b: '#b8903a' };
            const tilt = Math.floor(t * 3 + i) % 2;
            this.pattern(tilt ? ['BBBB', 'BbbB'] : ['BB..', 'BbbB', '..BB'], x, y, m, false);
          }
        }
        ctx.globalAlpha = prev;
        if (t % 0.8 < 0.2) star(this, Math.round(a.cx - 14 + hash(Math.floor(t / 0.8)) * 28), Math.round(a.top - 6 + hash(Math.floor(t / 0.8) + 5) * 10), '#fff6a0');
        this.pattern(['.YY.', 'YyyY'], a.right + 2, GROUND - 1, { Y: '#ffd65a', y: '#e8a21f' }, false);
        this.pattern(['.YY..', 'YyyYY'], a.left - 6, GROUND - 1, { Y: '#ffd65a', y: '#e8a21f' }, false);
      },
    },
    mosquito: {
      front(g, a, c, t) {
        const x = Math.round(a.hx + Math.sin(t * 1.7) * 10 + Math.sin(t * 5.3) * 3);
        const y = Math.round(a.ey - 7 + Math.sin(t * 2.3) * 4 + Math.sin(t * 7.1) * 2);
        const d = Math.cos(t * 1.7) > 0 ? 1 : -1;
        this.px(x, y, '#2a2a2a', false);
        this.px(x - d, y, '#2a2a2a', false);
        this.px(x + d, y + 1, '#2a2a2a', false);
        this.px(x - d, y + 1, 'rgba(40,40,40,0.6)', false);
        if (Math.floor(t * 25) % 2) { this.px(x, y - 1, 'rgba(230,240,255,0.9)', false); this.px(x - d, y - 1, 'rgba(230,240,255,0.9)', false); }
        this.px(a.hx + 3, a.top + 2, '#ff6f86');
      },
    },
    fireworks: {
      back(g, a, c, t) {
        for (let k = 0; k < 3; k++) {
          const P = 2.4;
          const tt = t + k * 0.8;
          const idx = Math.floor(tt / P);
          const ph = (tt % P) / P;
          // 가장 크게 퍼져도(반지름 8) 창·카드 안에 들어오게 가운데 쪽에서 터뜨린다
          const bx = Math.round(16 + hash(idx * 3 + k) * 16);
          const by = Math.round(12 + hash(idx * 5 + k) * 8);
          const hue = Math.floor(hash(idx * 7 + k) * 360);
          if (ph < 0.25) {
            const y = GROUND - (GROUND - by) * (ph / 0.25);
            this.px(bx, y, '#fff3c0', false);
            this.px(bx, y + 1, 'rgba(255,200,120,0.6)', false);
          } else {
            const q = (ph - 0.25) / 0.75;
            const R = 2 + q * 6;
            for (let i = 0; i < 12; i++) {
              const ang = (i / 12) * Math.PI * 2;
              this.px(bx + Math.cos(ang) * R, by + Math.sin(ang) * R + q * q * 3, `hsla(${hue},100%,70%,${(1 - q).toFixed(2)})`, false);
              if (i % 2) this.px(bx + Math.cos(ang) * R * 0.5, by + Math.sin(ang) * R * 0.5 + q * q * 2, `rgba(255,255,255,${(0.9 * (1 - q)).toFixed(2)})`, false);
            }
          }
        }
      },
    },
    soapbubble: {
      front(g, a, c, t) {
        for (let i = 0; i < 6; i++) {
          const sp = 5 + hash(i) * 4;
          const life = 36 / sp;
          const p = ((t + hash(i + 4) * life) % life) / life;
          const y = Math.round(GROUND - 2 - p * 36);
          const x = Math.round(a.cx - 12 + hash(i + 11) * 24 + Math.sin(t * 2 + i) * 2);
          const col = `hsl(${Math.round((t * 80 + i * 60) % 360)},90%,80%)`;
          if (p > 0.92) { for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) this.px(x + dx, y + dy, col, false); continue; }
          if (hash(i + 20) > 0.5) this.pattern(['.XX.', 'X.WX', 'X..X', '.XX.'], x - 1, y - 1, { X: col, W: '#ffffff' }, false);
          else this.pattern(['.X.', 'XWX', '.X.'].map((r, j) => (j === 1 ? 'X.X' : r)), x - 1, y - 1, { X: col }, false);
        }
      },
    },
  };

  // 담배 세 종류 (피우지 않고 발에 들고만 있다. 불붙은 끝에서 가끔 연기가 조금 피어오른다)
  const CIG = {
    esse: { len: 8, h: 1, paper: '#f7f7f2', filter: '#ecebe4', band: '#6fb0ea', fl: 2, smoke: { n: 2, rise: 6, wide: 0 } },
    marlboro: { len: 6, h: 1, paper: '#fafafa', filter: '#d99a4e', band: '#e8c86a', fl: 2, smoke: { n: 3, rise: 9, wide: 1 } },
    devil: { len: 6, h: 1, paper: '#1e1b1b', filter: '#2e2a2a', band: '#d4af37', fl: 2, smoke: { n: 4, rise: 12, wide: 2 } },
  };
  root.PetSprite.PetRenderer.prototype._cig = function (g, a, c, t, S) {
    let x0, y0;
    if (a.curled) {
      // 잘 때는 옆 재떨이에 걸쳐 둔다
      this.pattern(['KgggggggK', '.KKKKKKK.'], a.right + 1, GROUND - 1, { K: c.K, g: '#8f95a0' });
      x0 = a.right + 2;
      y0 = GROUND - 1 - S.h;
    } else {
      x0 = a.right + 1;
      y0 = a.cy + 1;
    }
    const edge = 'rgba(49,32,15,0.5)';
    for (let i = 0; i <= S.len; i++) { this.px(x0 + i, y0 - 1, edge, false); this.px(x0 + i, y0 + S.h, edge, false); }
    for (let i = 0; i < S.len; i++) {
      const col = i < S.fl ? S.filter : i === S.fl ? S.band : i === S.len - 1 ? '#8a8a8a' : S.paper;
      for (let j = 0; j < S.h; j++) this.px(x0 + i, y0 + j, col);
    }
    const ember = Math.sin(t * 5) > 0 ? '#ff5a1a' : '#ffa040';
    for (let j = 0; j < S.h; j++) this.px(x0 + S.len, y0 + j, ember);
    if (!a.curled) heldPaw(this, g, a.right, a.cy + 2);
    // 연기: 3.4초마다 1.5초 동안 몇 가닥
    const tipX = x0 + S.len;
    const tipY = y0 - 1;
    const Sm = S.smoke;
    for (let k = 0; k < Sm.n; k++) {
      const p = ((t % 3.4) - k * 0.3) / 1.5;
      if (p < 0 || p > 1) continue;
      const x = tipX + Math.round(p * 2 + Math.sin(p * 7 + k));
      const y = tipY - Math.round(p * Sm.rise);
      const col = `rgba(205,205,210,${(0.75 * (1 - p)).toFixed(2)})`;
      this.px(x, y, col, false);
      // 연기가 올라갈수록 퍼진다 (블랙 데빌이 가장 넓게)
      const spread = Math.round(p * Sm.wide);
      for (let d = 1; d <= spread; d++) { this.px(x - d, y, col, false); this.px(x + d, y + (d % 2), col, false); }
    }
  };
  // 소주병 (초록 병에 흰 상표). broken 이면 목을 쥐고 깨진 쪽을 위로 든다
  root.PetSprite.PetRenderer.prototype._bottle = function (g, a, c, t, broken) {
    const G = '#3fae6a', g2 = '#2a8a50', H = '#aef0c8', L = '#ffffff', Cap = '#2e6b3a';
    const m = { K: c.K, G, g: g2, H, L, C: Cap, n: '#4b8f43' };
    const whole = ['.KK.', '.CC.', '.KK.', '.GK.', '.GK.', 'KGHK', 'KGHK', 'KLLK', 'KLnK', 'KLLK', 'KGgK', 'KGgK', '.KK.'];
    const shard = ['K.K.K', 'KGKGK', 'KGGHK', 'KGGHK', 'KLLLK', 'KLnLK', 'KLLLK', 'KGggK', '.KGK.', '.KGK.', '.KGK.', '..K..'];
    if (a.curled) {
      this.pattern(broken ? ['KKKKKKK.', 'KGLLGGGK', 'KKKKKKK.'] : ['.KKKKKKKK', 'CKGLLGGGK', '.KKKKKKKK'], a.right + 1, GROUND - 2, m);
      return;
    }
    if (broken) {
      this.pattern(shard, a.right - 1, a.cy - 9, m);
      heldPaw(this, g, a.right + 1, a.cy + 1);
      if (t % 1.3 < 0.25) this.px(a.right - 1 + (Math.floor(t / 1.3) % 3) * 2, a.cy - 10, '#ffffff');
    } else {
      this.pattern(whole, a.right, a.cy - 9, m);
      heldPaw(this, g, a.right + 1, a.cy + 2);
    }
  };
  // 1인용 우주선: 머리를 덮는 유리 돔 + 몸 둘레를 두른 원반. 원반 뒤쪽 반은 몸 뒤에 그린다
  root.PetSprite.PetRenderer.prototype._saucer = function (a, t, front) {
    const cx = a.hx + 0.5;
    const cy = a.curled ? GROUND - 2 : a.my + 3;
    const rx = 12;
    const ry = 2.6;
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const k = (x + 0.5 - cx) / rx;
      if (Math.abs(k) > 1) continue;
      const h = Math.sqrt(1 - k * k) * ry;
      for (let y = Math.floor(cy - h); y <= cy + h; y++) {
        const up = y < cy;
        if (up === front) continue;
        const edge = y <= cy - h + 1 || y >= cy + h - 1;
        this.px(x, y, edge ? '#454b57' : y === Math.round(cy) ? '#dfe5ee' : up ? '#b8c2cc' : '#8e9aaa');
      }
    }
    if (!front) return;
    // 원반 불빛: 번갈아 깜빡
    for (let i = -3; i <= 3; i++) {
      const on = (i + Math.floor(t * 6)) % 2 === 0;
      this.px(cx + i * 3, cy + 1, on ? ['#ff5aa8', '#ffe45a', '#7fe8ff'][(i + 3) % 3] : '#5a6270');
    }
    // 유리 돔
    const dy = a.ey - 1;
    const r = 8.5;
    for (let y = Math.floor(dy - r); y <= dy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - dy);
        if (d > r || y >= cy - 1) continue;
        if (d > r - 1) this.px(x, y, 'rgba(200,240,255,0.9)');
        else this.px(x, y, 'rgba(170,230,255,0.18)', false);
      }
    this.pattern(['.W.', 'W..'], Math.round(cx - 6), Math.round(dy - 6), { W: '#ffffff' });
  };
  // 마법소녀 별: 몸 둘레를 도는 별 셋. 뒤쪽 반바퀴는 몸 뒤에 그린다
  root.PetSprite.PetRenderer.prototype._mgStars = function (a, t, front) {
    const cols = ['#ff9bd5', '#fff6a0', '#9fe8ff'];
    for (let i = 0; i < 3; i++) {
      const ang = t * 2 + i * 2.09;
      if (Math.sin(ang) > 0 !== front) continue;
      star(this, Math.round(a.cx + Math.cos(ang) * 12), Math.round(a.cy - 2 + Math.sin(ang) * 5), cols[i]);
    }
  };

  Object.assign(ACC, ACC3);

  // ================= 4차 (2026-09-22 확정) =================
  // 해적·미라·저승사자·로봇·택배 세트, 코찔찔이, 한복·튀튀·우비·도복, 배낭·통기타·화살통·풍선, 노랑 우산
  const K0 = '#1f1c1b';
  const ACC4 = {
    // ======================= 세트 =======================
    piratecap: {
      // 해골 해적 선장 모자 (2026-09-25 해적 선장 세트에서 떼어 냈다): 금테 두른 까만 삼각모
      front(g, a, c, t) {
        this.pattern(['.KK.........KK.', 'KkkKK.....KKkkK', 'KkkkkKKKKKkkkkK', 'KkkkkkkWkkkkkkK', 'KyyyyyyyyyyyyyK', '.KKKKKKKKKKKKK.'], a.hx - 7, a.earTop - 3, { K: c.K, k: '#2a2320', y: '#ffd65a', W: '#ffffff' });
      },
    },
    piratecoat: {
      // 빨간 선장 코트: 가운데 흰 셔츠, 금단추, 어깨 쪽은 짙은 빨강
      front(g, a, c, t) {
        wear(this, g, a, (dx, dy) => (Math.abs(dx) <= 1 ? '#fffaf3' : dy === 0 && Math.abs(dx) === 3 ? '#ffd65a' : Math.abs(dx) >= 5 ? '#7e1a1a' : '#b52a2a'));
      },
    },
    piratehook: {
      front(g, a, c, t) {
        // 오른손 갈고리 (앞발 쓰는 모션 동안은 숨긴다)
        if (this.pawsBusy) return;
        const H = { W: '#dfe5ee', w: '#8e9aaa', T: '#6b3f1a', K: c.K };
        if (a.curled) { this.pattern(['.WW.', 'W..W', '...W', 'TTW.'], a.right + 1, GROUND - 4, H); return; }
        this.pattern(['.WW.', 'W..W', '...w', '..w.', '.KK.', 'KTTK', 'KTTK', '.KK.'], a.right, a.cy - 5, H);
      },
    },
    mummycat: {
      // 미라 붕대 두건 (2026-09-25 미라 세트에서 떼어 냈다): 눈만 뚫린 붕대 두건, 풀린 끝자락이 살랑
      front(g, a, c, t) {
        const B = (y) => (y % 2 ? '#efe6cf' : '#d8cba8');
        hood(this, g, a, (dx, y) => (y >= a.ey && y < a.ey + a.eh && Math.abs(dx) >= 1 && Math.abs(dx) <= 4 ? null : B(y)));
        for (let i = 1; i <= 5; i++) this.px(a.right + i, a.top + 2 + Math.round(Math.sin(t * 4 + i * 0.8) * (i / 3)), B(i));
      },
    },
    mummywrap: {
      // 칭칭 미라 붕대: 몸을 층층이 감은 붕대 (한 칸씩 어긋나게)
      front(g, a, c, t) {
        const B = (y) => (y % 2 ? '#efe6cf' : '#d8cba8');
        wear(this, g, a, (dx, dy, x, y) => B(y + (dx > 2 ? 1 : 0)));
      },
    },
    reaper: {
      // 2026-09-25 디벨롭: 도깨비불 셋(꼬리) · 빛나는 신검(금 코등이 + 빨간 술) · 갓끈 구슬 반짝
      back(g, a, c, t) {
        for (let i = 0; i < 3; i++) {
          const ang = t * 1.4 + (i * Math.PI * 2) / 3;
          const x = Math.round(a.cx + Math.cos(ang) * 13);
          const y = Math.round(a.cy - 6 + Math.sin(ang * 1.5) * 4);
          for (let k = 1; k <= 3; k++) {
            const b = ang - k * 0.2;
            this.px(Math.round(a.cx + Math.cos(b) * 13), Math.round(a.cy - 6 + Math.sin(b * 1.5) * 4) + 1, `rgba(90,160,255,${(0.55 - k * 0.14).toFixed(2)})`, false);
          }
          const f = Math.floor(t * 8 + i) % 2;
          this.pattern(f ? ['.B.', 'BWB', 'BBB', '.B.'] : ['..B', '.BW', 'BBB', '.B.'], x - 1, y - 2, { B: 'rgba(90,160,255,0.85)', W: '#dff0ff' }, false);
        }
      },
      front(g, a, c, t) {
        hood(this, g, a, () => 'rgba(236,236,255,0.55)');
        wear(this, g, a, (dx) => (Math.abs(dx) <= 1 ? '#3a3a44' : '#15151a'));
        // 갓을 푹 눌러 쓴다: 갓 몸통이 귀까지 덮고, 챙은 이마 바로 위
        // 검정 갓: 위가 좁은 사다리꼴 몸통이 귀를 누르고, 반듯하고 긴 챙이 한 줄로 쭉 뻗는다
        const O = '#0e0e12', F = '#1c1c24', H = '#2e2e3a';
        const brimY = a.earTop + 1;
        const halves = [2, 2, 3, 3, 4, 4];
        halves.forEach((half, i) => {
          const y = brimY - halves.length + i;
          for (let x = a.hx - half; x <= a.hx + half; x++) this.px(x, y, Math.abs(x - a.hx) === half || i === 0 ? O : x === a.hx - half + 1 ? H : F);
        });
        for (let x = a.hx - 13; x <= a.hx + 13; x++) this.px(x, brimY, Math.abs(x - a.hx) === 13 ? O : 'rgba(20,20,26,0.88)');
        // 갓끈: 호박 구슬이 볼 옆으로 대롱대롱
        for (let y = brimY + 1; y <= a.my + 2; y++) for (const x of [a.hx - 7, a.hx + 7]) this.px(x, y, (y - brimY) % 2 ? '#d9a044' : '#6a4a20');
        // 2026-09-25 디벨롭으로 더한 것 (원래 그림과 이름이 겹치지 않게 블록으로)
        {
          const brimY = a.earTop + 1;
          // 갓끈 구슬이 위에서 아래로 차례로 반짝
          const k = Math.floor(t * 3) % 8;
          if (k < 6) for (const x of [a.hx - 7, a.hx + 7]) this.px(x, brimY + 1 + k, '#fff2b0');
          const h = setHand(this, a);
          if (!h) return;
          // 신검: 가늘고 끝이 뾰족한 날(가운데 흰 심 + 푸른 날), 은은한 빛이 숨 쉬듯
          const bx = h.x, top = h.y - 15;
          const glow = (0.18 + 0.2 * (0.5 + 0.5 * Math.sin(t * 4))).toFixed(2);
          for (let y = top + 1; y <= h.y - 4; y++) { this.px(bx - 1, y, `rgba(140,200,255,${glow})`, false); this.px(bx + 2, y, `rgba(140,200,255,${glow})`, false); }
          this.px(bx, top, '#dff0ff'); this.px(bx + 1, top, '#ffffff');
          for (let y = top + 1; y <= h.y - 4; y++) { this.px(bx, y, '#8ec4f2'); this.px(bx + 1, y, '#ffffff'); }
          // 날을 타고 흐르는 빛
          const q = (t % 2.2) / 0.5;
          if (q < 1) this.px(bx + 1, h.y - 4 - Math.round(q * 11), '#fffbe0');
          this.pattern(['KYYYK', '.KRK.'], bx - 2, h.y - 3, { K: '#3a2a10', Y: '#e8c050', R: '#5a1a1a' });
          heldPaw(this, g, h.x, h.y);
          // 빨간 술 (노리개): 코등이 옆에서 대롱대롱
          const sw = Math.round(Math.sin(t * 3) * 1);
          this.pattern(['Y', 'R', 'R', 'r'], bx + 3 + sw, h.y - 2, { Y: '#e8c050', R: '#d9303b', r: '#9a1a24' });
        }
      },
    },
    robocat: {
      front(g, a, c, t) {
        const S = '#c3ccd6', s2 = '#8e9aaa';
        hood(this, g, a, (dx, y) => (Math.abs(dx) <= 4 && y >= a.ey - 2 && y <= a.my + 1 ? '#14262c' : Math.abs(dx) >= 5 ? s2 : S));
        wear(this, g, a, (dx, dy) => (dy === 0 && Math.abs(dx) <= 3 ? ['#ff5a5a', '#ffe45a', '#7dff9a', '#7fe8ff'][(Math.abs(dx) + Math.floor(t * 4)) % 4] : Math.abs(dx) >= 5 ? s2 : S));
        const blink = t % 3 < 0.15;
        const G = '#7dff9a';
        if (!blink) { this.rect(a.eyeL, a.ey, a.ew, a.eh, G); this.rect(a.eyeR, a.ey, a.ew, a.eh, G); }
        else { this.rect(a.eyeL, a.ey + 1, a.ew, 1, G); this.rect(a.eyeR, a.ey + 1, a.ew, 1, G); }
        for (let d = -1; d <= 1; d++) this.px(a.fx + d, a.my + 1, G);
        this.px(a.hx, a.top - 1, s2); this.px(a.hx, a.top - 2, s2);
        this.px(a.hx, a.top - 3, Math.floor(t * 2) % 2 ? '#ff3b3b' : '#6a1010');
        // 다리 대신 탱크 무한궤도: 바퀴 위로 궤도 무늬가 굴러간다
        const y0 = a.curled ? GROUND - 1 : GROUND - 2;
        const x0 = a.left - 1, x1 = a.right + 1;
        const roll = Math.floor(t * 8);
        for (let x = x0; x <= x1; x++) {
          const end = x === x0 || x === x1;
          this.px(x, y0, end ? '#1f1c1b' : (x + roll) % 2 ? '#3a3f4a' : '#5a6270');
          this.px(x, y0 + 1, end ? '#3a3f4a' : (x - x0) % 3 === 1 ? '#b8c2cc' : '#454b57');
          this.px(x, y0 + 2, end ? '#1f1c1b' : (x - roll) % 2 ? '#3a3f4a' : '#5a6270');
        }
        // 가는 로봇 팔에 레고 손 (앞발 쓰는 모션 동안은 숨긴다)
        if (this.pawsBusy || a.curled) return;
        const Y = { Y: '#ffd23f', y: '#d9a21f' };
        for (const side of [-1, 1]) {
          const bx = side < 0 ? a.left - 1 : a.right + 1;
          this.px(bx, a.cy - 1, s2);
          this.px(bx + side, a.cy, s2);
          this.px(bx + side, a.cy + 1, s2);
          const hand = side < 0 ? ['YYY', '..Y', 'yyY'] : ['YYY', 'Y..', 'Yyy'];
          this.pattern(hand, side < 0 ? bx - 3 : bx + 1, a.cy + 1, Y);
        }
      },
    },

    // ======================= 얼굴 =======================
    // ======================= 손 =======================
    umbrella: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, R: '#ffd23f', W: '#e0a91c', t: '#6b3f1a' }; // 노란 우비와 같은 노랑·그늘색
        if (a.curled) {
          // 접어서 옆에 눕혀 둔다
          this.pattern(['....KKKKKKK.', 'tttKRWRWRWRK', '....KKKKKKK.'], a.right + 1, GROUND - 2, m);
          return;
        }
        const cx = a.hx + 4;
        const top = a.top - 9 + sway(t, 1.5, 0.6);
        // 왼쪽 천에 구멍이 뻥: 구멍 둘레는 너덜너덜하고, 구멍으로 물방울이 뚝뚝 떨어져 머리에 맞는다
        this.pattern(['......K......', '....KKRKK....', '..KKRWRWRKK..', '.KRK.KRWRWRK.', 'KRWRKRWRWRWRK', 'KK.KK.K.KK.KK'], cx - 6, top, m);
        const p = (t % 1.1) / 1.1;
        const dy = Math.round(p * Math.max(1, a.top - top - 3));
        this.px(cx - 2, top + 4 + dy, '#8fd0ff', false);
        if (p > 0.85) { this.px(cx - 3, a.top - 1, 'rgba(143,208,255,0.8)', false); this.px(cx - 1, a.top - 1, 'rgba(143,208,255,0.8)', false); }
        // 손잡이: 우산 가운데에서 앞발까지, 끝은 J 모양
        const x2 = a.right + 1;
        const y1 = top + 6;
        const y2 = a.cy + 1;
        for (let y = y1; y <= y2; y++) this.px(Math.round(cx + ((x2 - cx) * (y - y1)) / (y2 - y1)), y, '#3a3a44');
        this.px(x2, y2 + 1, '#6b3f1a');
        this.px(x2 - 1, y2 + 2, '#6b3f1a');
        heldPaw(this, g, x2, y2);
      },
    },

    snotdrip: {
      front(g, a, c, t) {
        const n = 1 + Math.round((Math.sin(t * 1.5) + 1) * 1.2);
        for (let i = 0; i < n; i++) this.px(a.fx - 1, a.my + 1 + i, '#bfe6ff');
        this.px(a.fx - 1, a.my + n, '#8fcfff');
        if (t % 5 < 1.2) { const r = (t % 5) / 1.2; this.pattern(r > 0.5 ? ['.UU.', 'U..U', '.UU.'] : ['.U.', 'U.U', '.U.'], a.fx + 1, a.my - 1, { U: '#bfe6ff' }, false); }
      },
    },

    // ======================= 몸 =======================
    hanbok: {
      front(g, a, c) {
        const S = ['#e8534a', '#ffd65a', '#78c46a', '#6fb0ea', '#ff9bd5'];
        wear(this, g, a, (dx, dy, x) => (Math.abs(dx) >= 4 && dy < 0 ? S[(x + 50) % 5] : dy < 0 ? '#ffe9a8' : null));
        skirt(this, a, c, [1, 2], (x, y, k) => (k === 0 && (x === a.hx + 1 || x === a.hx + 2) ? '#c8242c' : '#e8534a'));
        if (!a.curled) { this.px(a.hx + 1, a.my + 2, '#c8242c'); this.px(a.hx + 2, a.my + 2, '#c8242c'); }
      },
    },
    tutu: {
      front(g, a, c, t) {
        wear(this, g, a, (dx, dy) => (dy < 0 ? '#ffb3d9' : a.curled ? '#ffd3ea' : null));
        skirt(this, a, c, [3, 4], (x, y, k) => (hash(x * 3 + Math.floor(t * 4)) > 0.88 ? '#ffffff' : (x + k) % 2 ? '#ffd3ea' : '#ffb3d9'));
      },
    },
    raincoat: {
      front(g, a, c) {
        wear(this, g, a, (dx, dy) => (dx === 0 && dy >= -1 ? '#e0a91c' : Math.abs(dx) === 4 && dy === -1 ? '#fff6b0' : '#ffd23f'));
        skirt(this, a, c, [1, 1], (x, y, k) => (x === a.hx ? '#e0a91c' : '#ffd23f'));
      },
    },
    dobok: {
      front(g, a, c) {
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (dy === 0) return K0;
          if (dy <= -1 && Math.abs(dx) === 2) return '#26262e';
          return Math.abs(dx) >= 5 ? '#e4e4dc' : '#fbfbf6';
        });
        if (a.curled) return;
        // 검은띠 매듭 꼬리 + 띠에 금실 '단' 줄 (63단이라 잔뜩)
        this.px(a.hx - 1, a.my + 4, K0); this.px(a.hx + 1, a.my + 4, K0);
        for (const dx of [-5, -4, 4, 5]) this.px(a.hx + dx, a.my + 3, '#d4af37');
      },
    },

    // ======================= 등 =======================
    guitar: {
      back(g, a, c) {
        const x = a.right + 3;
        const W = '#d99a58', w = '#b8783a';
        const cy = a.curled ? GROUND - 4 : a.cy;
        // 몸통: 줄마다 반폭 (위에서 아래로)
        const halves = [2, 3, 3, 2, 3, 4, 4, 4, 3];
        halves.forEach((h, j) => {
          const y = cy - 4 + j;
          for (let d = -h; d <= h; d++) this.px(x + d, y, Math.abs(d) === h ? c.K : d < 0 ? W : w);
        });
        for (let d = -1; d <= 1; d++) { this.px(x + d, cy - 5, c.K); this.px(x + d, cy + 5, c.K); }
        this.px(x - 2, cy - 5, c.K); this.px(x + 2, cy - 5, c.K); this.px(x - 3, cy + 5, c.K); this.px(x + 3, cy + 5, c.K);
        this.px(x, cy - 1, '#3a2010'); this.px(x, cy, '#3a2010');
        for (let d = -1; d <= 1; d++) this.px(x + d, cy + 2, '#5a3418');
        // 목과 헤드
        for (let y = cy - 9; y <= cy - 5; y++) this.px(x, y, '#6b3f1a');
        this.pattern(['KKK', 'KtK', 'KKK'], x - 1, cy - 12, { K: c.K, t: '#4a2a10' });
        this.px(x - 2, cy - 11, '#dfe5ee'); this.px(x + 2, cy - 11, '#dfe5ee');
      },
    },
    quiver: {
      back(g, a, c) {
        const x = a.right - 2;
        for (const [dx, col] of [[0, '#e8534a'], [2, '#fffaf3'], [4, '#e8534a']]) {
          for (let y = a.top - 6; y <= a.top; y++) this.px(x + dx, y, '#8a5a32');
          this.pattern(['X.X', '.X.'], x + dx - 1, a.top - 8, { X: col });
        }
        this.pattern(['KKKKKKK', 'KTTTTTK', 'KTtTTTK', 'KTTTTTK', 'KTTTtTK', 'KTTTTTK', 'KKKKKKK'], x - 1, a.top + 1, { K: c.K, T: '#9a6a43', t: '#7a4f2e' });
      },
    },
    balloons: {
      back(g, a, c, t) {
        const cols = ['#ff5a5a', '#ffd65a', '#6fb0ea'];
        [[-5, -17], [1, -20], [6, -16]].forEach(([dx, dy], i) => {
          const b = Math.round(Math.sin(t * 1.8 + i * 2) * 1);
          const bx = a.hx + dx + b;
          const by = a.top + dy;
          this.pattern(['.XXX.', 'XWXXX', 'XXXXX', 'XXXXX', '.XXX.', '..X..'], bx - 2, by - 3, { X: cols[i], W: '#ffffff' });
          for (let y = by + 3; y < a.top + 2; y++) this.px(Math.round(bx + (a.hx - bx) * ((y - by - 3) / (a.top + 2 - by - 3))), y, 'rgba(60,60,60,0.7)', false);
        });
      },
    },
  };
  Object.assign(ACC, ACC4);
  // ================= 5차 (2026-09-23 확정) =================
  // 머리 8 · 몸 6 · 등 10 · 손 5 새로, 다시 그린 것 8 (마술사 모자·뚫어뻥 뿔·용의 뿔·결사 반대 머리띠·그사세 턱시도·50kg 군장·토끼 발·곰 앞발)
  const LETTER = { L: ['X..', 'X..', 'X..', 'X..', 'XXX'], I: ['XXX', '.X.', '.X.', '.X.', 'XXX'], F: ['XXX', 'X..', 'XX.', 'X..', 'X..'], E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'] };

  // 챙 넓은 모자: 가운데가 눌린 몸통 + 띠 + 양옆으로 길게 나온 챙
  function brimHat(r, a, c, k, band) {
    r.pattern(['.....KKKKKKK.....', '....KkkkKkkkK....', '....KkkkkkkkK....', '....KrrrrrrrK....', 'KKKKkkkkkkkkkKKKK', 'KkkkkkkkkkkkkkkkK', '.KKKKKKKKKKKKKKK.'], a.hx - 8, a.earTop - 3, { K: c.K, k, r: band });
  }
  // 선 긋기 (촘촘하게)
  function line(r, x0, y0, x1, y1, col, solid = true) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.5));
    for (let k = 0; k <= n; k++) r.px(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, typeof col === 'function' ? col(k / n) : col, solid);
  }
  // 번개: 지그재그 줄기 + 가지. seed 가 같으면 같은 모양
  function bolt(r, x, y, dx, len, seed) {
    for (let i = 0; i < len; i++) {
      const h = hash(seed * 13 + i);
      x += dx + (h < 0.33 ? -1 : h > 0.66 ? 1 : 0) * 0.8;
      y -= 1;
      r.px(x, y, '#ffffff', false);
      r.px(x - 1, y, 'rgba(140,220,255,0.55)', false);
      r.px(x + 1, y, 'rgba(140,220,255,0.55)', false);
      if (i === Math.floor(len / 2) && len > 4) bolt(r, x, y, -dx, Math.floor(len / 2), seed + 7);
    }
  }

  const ACC5 = {
    // ======================= 머리 =======================
    fedora: {
      front(g, a, c) { brimHat(this, a, c, '#22222a', '#5a5a66'); },
    },
    deerstalker: {
      // 셜록 홈즈 사냥 모자: 체크무늬 둥근 몸통, 양옆 귀덮개를 위로 올려 정수리에서 리본으로 묶고, 이마 위로 짧은 앞챙
      front(g, a, c) {
        const rows = ['.....KrrK.....', '...KKrKKrKK...', '..KccccccccK..', '.KcccccccccccK.', 'KfKcccccccccKfK', 'KfKcccccccccKfK', 'KffKKKKKKKKKffK', '.KK.KcccccK.KK.', '.....KKKKK.....'];
        const x0 = a.hx - 7;
        const y0 = a.earTop - 4;
        const B = '#c9ad7a', D = '#8a6a40', F = '#a8895a';
        rows.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '.') continue;
            const x = x0 + i, y = y0 + j;
            // 체크: 두 칸 간격 가로·세로 줄이 겹치는 곳이 진하다
            const col = ch === 'K' ? c.K : ch === 'r' ? '#6b4a28' : ch === 'f' ? F : x % 3 === 0 && y % 3 === 0 ? '#6b4a28' : x % 3 === 0 || y % 3 === 0 ? D : B;
            this.px(x, y, col);
          }
        });
      },
    },
    realdevilhorns: {
      front(g, a, c, t) {
        const pu = 0.5 + 0.5 * Math.sin(t * 3);
        const h = `rgb(255,${Math.round(60 + pu * 90)},40)`;
        const L = ['K......', 'KK.....', 'KdK....', '.KdK...', '.KhdK..', '..KddK.', '...KdhK', '....KdK'];
        const m = { K: '#120a10', d: '#3a1a2a', h };
        this.pattern(L, a.hx - 9, a.top - 6, m);
        this.pattern(mirror(L), a.hx + 3, a.top - 6, m);
        const p = (t * 0.8) % 1;
        this.px(a.hx - 8 + Math.round(Math.sin(p * 6)), a.top - 7 - Math.round(p * 5), `rgba(255,120,60,${(1 - p).toFixed(2)})`, false);
      },
    },
    blackbeanie: {
      front(g, a, c) {
        this.pattern(['...KKKKKKK...', '.KKkkkkkkkKK.', 'KkkkkkkkkkkkK', 'KgkgkgkgkgkgK', 'KKKKKKKKKKKKK'], a.hx - 6, a.earTop - 2, { K: c.K, k: '#26262e', g: '#3a3a46' });
      },
    },
    hiphopbeanie: {
      front(g, a, c) {
        // 눈 바로 위까지 푹 눌러쓴 슬라우치 비니 (귀 사이 빈 곳 없이 꽉)
        const k = '#1e1e26', g2 = '#34343e';
        hood(this, g, a, (dx, y) => (y <= a.ey - 1 ? (y >= a.ey - 2 ? (Math.abs(dx) % 2 ? g2 : k) : k) : null));
        this.pattern(['..KKKKKKKK...', '.KkkkkkkkkKK.', 'KkkkkkkkkkkkK', 'KkkkkkkkkkkkK', 'KkkkkkkkkkkkK', 'KkkkkkkkkkkkK'], a.hx - 6, a.earTop - 3, { K: c.K, k });
        for (let x = a.left; x <= a.right; x++) this.px(x, a.ey - 3, c.K);
        this.px(a.hx + 4, a.ey - 2, '#ffffff');
        this.px(a.hx + 5, a.ey - 2, '#ffffff');
      },
    },
    newsboy: {
      front(g, a, c) {
        this.pattern(['.....KK......', '..KKKggKKK...', '.KgGgggGggKK.', 'KgggGgggGgggK', 'KKKKKKKKKKKKK', '...KbbbbbbK..'], a.hx - 6, a.earTop - 2, { K: c.K, g: '#8a7f70', G: '#6a6054', b: '#4a4238' });
      },
    },
    knighthelm: {
      front(g, a, c, t) {
        const S = '#b8c0cc', s2 = '#8a94a4', rust = '#b8783a';
        hood(this, g, a, (dx, y, x) => {
          const adx = Math.abs(dx);
          if (y === a.ey && adx <= 4 && adx >= 1) return '#14141a';
          if (y === a.ey + 2 && adx <= 3 && x % 2) return '#14141a';
          if (hash(x * 3 + y * 5) < 0.08) return rust;
          return dx === 0 ? s2 : adx >= 5 ? s2 : S;
        });
        for (let x = a.left; x <= a.right; x++) this.px(x, a.top, s2);
        this.px(a.hx, a.top - 1, s2);
        if (t % 3 < 0.3) this.px(a.hx - 3, a.top + 2, '#ffffff');
      },
    },

    // ======================= 몸 =======================
    chefuniform: {
      front(g, a) {
        // 흰 더블 조리복: 빨간 스카프, 흰 단추 두 줄 (단추 둘레만 살짝 회색)
        wear(this, g, a, (dx, dy) => {
          const adx = Math.abs(dx);
          if (dy <= -2 && adx <= 3) return '#e8534a';
          if (adx === 2 && dy >= -1) return '#ffffff';
          if (adx === 3 && dy >= -1) return '#d8d6ce';
          return adx >= 5 ? '#dedad0' : '#efece4';
        });
      },
    },
    trenchcoat: {
      front(g, a, c) {
        const B = '#c8a878', b = '#a8885a';
        wear(this, g, a, (dx, dy) => {
          const adx = Math.abs(dx);
          if (dy === 0) return adx <= 1 ? '#6b4a28' : b;
          if (adx === 2) return b;
          return adx === 3 && dy === -1 ? '#3a2a18' : B;
        });
        skirt(this, a, c, [0, 1], (x, y, k) => (k === 0 ? (Math.abs(x - a.hx) <= 1 ? '#6b4a28' : b) : B));
        if (!a.curled) for (const x of [a.left - 1, a.right + 1]) { this.px(x, a.my, B); this.px(x, a.my + 1, B); this.px(x, a.my - 1, c.K); }
      },
    },
    boxsuit: {
      // 택배 상자에 쏙 들어가 앉았다: 뒤로는 상자 안벽과 양옆으로 벌어진 날개, 앞으로는 테이프 붙은 앞면과 초록 재활용 표시
      back(g, a, c) {
        const T = '#c8955a', t2 = '#8a5a32';
        const y0 = a.curled ? a.ey : a.my - 1;
        for (let y = y0; y <= GROUND; y++)
          for (let x = a.left - 2; x <= a.right + 2; x++) {
            const edge = x === a.left - 2 || x === a.right + 2 || y === y0;
            this.px(x, y, edge ? c.K : t2);
          }
        // 벌어진 날개: 윗모서리에서 바깥 위로 비스듬히
        this.pattern(['KK...', 'KTTK.', '.KTTK', '..KTK'], a.left - 6, y0 - 3, { K: c.K, T });
        this.pattern(mirror(['KK...', 'KTTK.', '.KTTK', '..KTK']), a.right + 2, y0 - 3, { K: c.K, T });
      },
      front(g, a, c) {
        const T = '#c8955a', t2 = '#a8773e';
        const y0 = a.curled ? GROUND - 1 : a.my + 3;
        for (let y = y0; y <= GROUND + 1; y++)
          for (let x = a.left - 2; x <= a.right + 2; x++) {
            const edge = x === a.left - 2 || x === a.right + 2 || y === GROUND + 1;
            this.px(x, y, edge ? c.K : y === y0 ? t2 : Math.abs(x - a.hx) <= 1 ? '#e8cf9a' : T);
          }
        if (!a.curled) this.pattern(['.N.', 'N.N'], a.left + 1, y0 + 1, { N: '#4b8f43' });
      },
    },
    hanbokman: {
      front(g, a) {
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (leg) return '#f4f2ea';
          if (dx === -(dy + 1) || dx === -(dy + 2)) return '#ffffff';
          if (dx === 1 && dy === 0) return '#2a3a6a';
          return Math.abs(dx) >= 5 ? '#88c0b8' : '#a8d8d0';
        });
      },
    },
    hanbokwoman: {
      front(g, a, c) {
        // 초록 저고리에 알록달록 색동 깃, 빨간 치마
        const S = ['#e8534a', '#ffd65a', '#78c46a', '#6fb0ea', '#ff9bd5'];
        wear(this, g, a, (dx, dy, x) => (dy < 0 ? (Math.abs(dx) <= 3 || (dy === -3 && Math.abs(dx) <= 6) ? S[(Math.abs(dx) + dy + 60) % 5] : '#6fbf6a') : a.curled ? '#d8303b' : null));
        skirt(this, a, c, [1, 2], (x, y, k) => (k === 0 && x === a.hx + 1 ? '#8a1a22' : (x + k) % 3 === 0 ? '#b8242c' : '#d8303b'));
        if (!a.curled) { this.px(a.hx + 1, a.my + 2, '#8a1a22'); this.px(a.hx + 2, a.my + 2, '#8a1a22'); }
      },
    },
    knightarmor: {
      front(g, a, c, t) {
        const S = '#c8d0da', s2 = '#8a94a4';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (adx <= 2 && !leg) return dx === 0 || (dy === -1 && adx <= 1) ? '#ffd65a' : '#b52a2a';
          return leg || adx >= 5 ? s2 : S;
        });
        if (!a.curled) for (const x of [a.left - 1, a.right + 1]) { this.px(x, a.my + 1, S); this.px(x, a.my + 2, s2); this.px(x, a.my, c.K); }
        if (t % 2.5 < 0.2) this.px(a.hx - 4, a.my + 2, '#ffffff');
      },
    },

    // ======================= 등 =======================
    bluephoenix: {
      back(g, a, c, t) {
        const flap = Math.sin(t * 5);
        for (const s of [-1, 1])
          for (let i = 0; i < 12; i++) {
            const h = Math.round(10 - i * 0.6 + flap * 2 + Math.sin(t * 14 + i) * 1.2);
            for (let j = 0; j < h; j++) {
              const f = j / Math.max(1, h);
              this.px(a.cx + s * (5 + i), a.cy - 4 + j - Math.round(i * 0.4), f < 0.3 ? '#e8fbff' : f < 0.65 ? '#7fd8ff' : '#3a7bff', false);
            }
          }
        if (t % 0.7 < 0.2) star(this, Math.round(a.cx + (hash(Math.floor(t / 0.7)) > 0.5 ? 12 : -12)), a.cy - 6, '#dff6ff');
      },
    },
    bigangel: {
      back(g, a, c, t) {
        // 커다란 깃털 날개: 어깨에서 부채꼴로 뻗는 긴 깃 9장 + 어깨를 덮는 작은 깃
        const flap = Math.sin(t * 2.2) * 0.07;
        const ox = a.left + 1, oy = a.top + 4;
        const W = '#ffffff', S = '#e4e8f0', O = 'rgba(140,150,170,0.95)';
        const put = (x, y, col) => { this.px(x, y, col, false); this.px(2 * a.hx + 1 - x, y, col, false); };
        for (let f = 0; f < 9; f++) {
          const th = Math.PI * (1.02 - f * 0.045) + flap;
          const L = 8 + f * 0.9;
          for (let k = 0; k <= L; k++) {
            const x = Math.round(ox + Math.cos(th) * k);
            const y = Math.round(oy - Math.sin(th) * k * 0.95);
            put(x, y, k >= L - 1 ? O : W);
            put(x, y + 1, k >= L - 1 ? O : S);
          }
        }
        for (let f = 0; f < 5; f++) {
          const th = Math.PI * (0.9 - f * 0.08) + flap;
          for (let k = 0; k <= 4; k++) put(Math.round(ox + Math.cos(th) * k), Math.round(oy - Math.sin(th) * k), k === 4 ? S : W);
        }
        if (t % 2 < 0.25) star(this, a.hx - 14, a.top - 6, '#fff6c0');
      },
    },
    redelectric: {
      back(g, a, c) {
        const x0 = a.right - 1;
        const y0 = a.curled ? GROUND - 9 : a.cy - 4;
        for (let y = y0 - 7; y < y0; y++) this.px(x0 + 3, y, '#e8c890');
        this.pattern(['KRK', 'KRK', 'KKK'], x0 + 2, y0 - 10, { K: c.K, R: '#e8303a' });
        this.pattern(['.K...K.', 'KRK.KRK', 'KRRRRRK', 'KRWWRRK', '.KRWRK.', 'KRRWRRK', 'KRRkRRK', 'KRRRRRK', '.KKKKK.'], x0, y0, { K: c.K, R: '#e8303a', W: '#fffaf3', k: '#1f1c1b' });
      },
    },
    blackbass: {
      back(g, a, c) {
        const x0 = a.right - 1;
        const y0 = a.curled ? GROUND - 9 : a.cy - 4;
        for (let y = y0 - 10; y < y0; y++) this.px(x0 + 3, y, '#6b3f1a');
        this.pattern(['gKg', 'gKg', 'KKK'], x0 + 2, y0 - 13, { K: c.K, g: '#c3ccd6' });
        this.pattern(['.K...K.', 'KBK.KBK', 'KBBBBBK', 'KBggBBK', '.KBgBK.', 'KBBgBBK', 'KBkBkBK', 'KBBBBBK', '.KKKKK.'], x0, y0, { K: c.K, B: '#1f1f28', g: '#8a8a94', k: '#c3ccd6' });
      },
    },
    gundamwings: {
      back(g, a, c, t) {
        // 깃이 살아 있는 기계 날개: 흰 판금 깃 6장에 파란 테, 끝은 빨강. 어깨 뿌리에 미니 부스터
        const ox = a.left + 1, oy = a.top + 3;
        const flap = Math.sin(t * 1.8) * 0.05;
        const put = (x, y, col) => { this.px(x, y, col, false); this.px(2 * a.hx + 1 - x, y, col, false); };
        for (let f = 0; f < 6; f++) {
          const th = Math.PI * (1.02 - f * 0.075) + flap;
          const L = 9 + f * 1.1;
          for (let k = 1; k <= L; k++) {
            const x = Math.round(ox + Math.cos(th) * k);
            const y = Math.round(oy - Math.sin(th) * k);
            put(x, y, k >= L - 1 ? '#e8303a' : k <= 3 ? '#3d6fe0' : '#f2f4f8');
            if (k > 2 && f === 0) put(x, y + 1, k >= L - 1 ? '#a8202a' : '#8e9aaa');
          }
        }
        // 프레임
        for (let k = 0; k <= 4; k++) put(ox - k, oy - Math.round(k * 0.5), '#6a7280');
        // 미니 부스터 + 불꽃
        const on = Math.floor(t * 12) % 2;
        put(ox - 1, oy + 2, '#454b57'); put(ox - 2, oy + 2, '#454b57'); put(ox - 1, oy + 3, '#8e9aaa'); put(ox - 2, oy + 3, '#8e9aaa');
        put(ox - 1, oy + 4, on ? '#7fe8ff' : '#dff6ff'); put(ox - 2, oy + 4, on ? '#dff6ff' : '#7fe8ff');
        put(ox - 1, oy + 5 + on, 'rgba(127,232,255,0.5)'); put(ox - 2, oy + 5 + (1 - on), 'rgba(127,232,255,0.5)');
      },
    },
    spiderlegs: {
      back(g, a, c, t) {
        // 등에서 나온 기계 다리 넷: 굵은 윗마디(빨강 + 금 테), 금 관절, 가는 아랫마디, 금 발톱
        const R = '#c8202c', r = '#8a1018', Gd = '#f2c14e';
        for (const s of [-1, 1])
          for (let i = 0; i < 2; i++) {
            const tw = Math.sin(t * 3 + i * 2 + s) * 0.8;
            const bx = a.hx + s * 3, by = a.top + 3;
            const jx = a.hx + s * (8 + i * 3), jy = a.top - 6 + i * 3 + tw;
            const fx = a.hx + s * (12 + i * 3), fy = a.my + 2 + i * 2;
            line(this, bx, by, jx, jy, R);
            line(this, bx, by + 1, jx, jy + 1, r);
            line(this, bx, by - 1, jx, jy - 1, (k) => (k > 0.2 ? Gd : R));
            line(this, jx, jy, fx - s, fy - 1, R);
            this.pattern(['GG', 'GW'], Math.round(jx) - (s < 0 ? 1 : 0), Math.round(jy) - 1, { G: Gd, W: '#fff6c0' });
            this.px(fx, fy, Gd);
            this.px(fx - s, fy - 1, Gd);
          }
      },
    },
    swallowtail: {
      back(g, a, c, t) {
        const s = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.2));
        const inside = (u, v) => {
          const X = u / s;
          return ((X - 6) / 6) ** 2 + ((v + 4) / 5.5) ** 2 <= 1 || ((X - 4) / 4.2) ** 2 + ((v - 3) / 3.5) ** 2 <= 1 || (X > 4.5 && X < 6.5 && v > 5 && v < 9);
        };
        for (const side of [-1, 1])
          for (let u = 0; u <= 13; u++)
            for (let v = -10; v <= 9; v++) {
              if (!inside(u, v)) continue;
              const edge = !inside(u + 1, v) || !inside(u - 1, v) || !inside(u, v + 1) || !inside(u, v - 1);
              const X = u / s;
              let col = edge ? '#1a1410' : Math.floor(X + v * 0.35) % 3 === 0 ? '#1a1410' : '#ffd84a';
              if (!edge && v >= 3 && v <= 5 && X > 5) col = X > 7 ? '#3d6fe0' : '#e8303a';
              this.px(a.hx + side * (3 + u), a.top + 1 + v, col, false);
            }
      },
    },
    katanaback: {
      back(g, a, c) {
        const x0 = a.left - 2, y0 = a.my + 3, x1 = a.right + 4, y1 = a.top - 6;
        const n = 20;
        for (let k = 0; k <= n; k++) {
          const x = x0 + ((x1 - x0) * k) / n;
          const y = y0 + ((y1 - y0) * k) / n;
          const hilt = k > 15;
          this.px(x, y, hilt ? (k % 2 ? '#fffaf3' : K0) : '#1a1a22');
          this.px(x + 1, y, hilt ? (k % 2 ? K0 : '#fffaf3') : '#3a2030');
          if (k === 15) for (let d = -1; d <= 1; d++) this.px(x + d, y + d, '#d4af37');
        }
      },
    },
    knightsword: {
      back(g, a, c, t) {
        const x0 = a.right + 3, y0 = GROUND, x1 = a.left - 4, y1 = a.top - 9;
        const n = 26;
        for (let k = 0; k <= n; k++) {
          const x = x0 + ((x1 - x0) * k) / n;
          const y = y0 + ((y1 - y0) * k) / n;
          const blade = k < 20;
          this.px(x, y, blade ? '#e8eef6' : '#6b3f1a');
          this.px(x + 1, y, blade ? '#a8b6c8' : '#4a2a10');
          if (k === 20) for (let d = -3; d <= 3; d++) this.px(x + d, y + d * -1, '#ffd65a');
        }
        this.pattern(['.Y.', 'YRY', '.Y.'], x1 - 1, y1 - 2, { Y: '#ffd65a', R: '#e8303a' });
        const p = (t % 2.8) / 0.6;
        if (p < 1) { const k = Math.round(p * 18); this.px(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, '#ffffff'); }
      },
    },
    lifeburden: {
      back(g, a, c) {
        const cx = a.hx - 1, cy = a.top - 4;
        this.ellipse(cx, cy, 11, 8, (x, y) => (hash(x * 7 + y * 3) < 0.12 ? '#6a6a72' : hash(x * 5 + y * 11) < 0.05 ? '#6f8f5a' : '#8a8a92'), c.K);
        let x = cx - 7;
        for (const ch of 'LIFE') { this.pattern(LETTER[ch], x, cy - 3, { X: '#2a2a30' }); x += 4; }
      },
      front(g, a, c, t) {
        if (a.curled) return;
        for (const dx of [-4, 4]) for (let y = a.my + 1; y <= a.my + 3; y++) this.px(a.hx + dx, y, '#8a5a32');
        const p = (t % 2.5) / 1;
        if (p < 1) this.pattern(['.U.', 'UUU', 'UWU', '.U.'], a.right + 1, a.top + 1 + Math.round(p * 3), { U: '#8fd0f5', W: '#fff' }, false);
      },
    },
    // ---- 기존 코스튬 디자인 수정 ----
    tuxedo: {
      front(g, a, c) {
        wear(this, g, a, (dx) => (Math.abs(dx) <= 1 ? '#fffaf3' : Math.abs(dx) === 2 ? '#3a3a44' : '#1f1c24'));
        if (a.curled) return;
        const y = a.my + 3;
        this.pattern(['KK.KK', 'RRKRR', 'KK.KK'].map((r) => r), a.hx - 2, y - 1, { K: '#6a0a12', R: '#e8303a' });
        this.px(a.hx, y, '#a8202a');
        this.px(a.hx - 4, y, '#fffaf3');
      },
    },
    bandana: {
      front(g, a, c) {
        // 빨간 띠에 하얀 붓글씨 네 자 (결·사·반·대 느낌만), 오른쪽에 질끈 묶은 매듭
        this.pattern(['.KKKKKKKKKKK.', 'KWWRWRWWRWRWK', 'KRWRWWRWRWWRK', '.KKKKKKKKKKK.'], a.hx - 6, a.top - 1, { K: c.K, R: '#d8303b', W: '#ffffff' });
        this.pattern(['.KK..', 'KRRKK', 'KRRRK', '.KKRK', '...KK'], a.hx + 5, a.top - 1, { K: c.K, R: '#d8303b' });
      },
    },
    tophat: {
      front(g, a, c) {
        // 마술사 모자: 높고 반듯한 실크햇을 귀까지 푹 눌러쓴다. 빨간 띠, 챙은 이마 위
        this.pattern(['..KKKKKKKKKKK..', '..KkkHkkkkkkK..', '..KkkHkkkkkkK..', '..KkkHkkkkkkK..', '..KkkkkkkkkkK..', '..KkkkkkkkkkK..', '..KkkkkkkkkkK..', '..KRRRRRRRRRK..', '..KRRRRRRRRRK..', '..KkkkkkkkkkK..', 'KKKKKKKKKKKKKKK', '.KKKKKKKKKKKKK.'], a.hx - 7, a.top - 9, { K: c.K, k: '#22222a', H: '#4a4a56', R: '#c8202c' });
      },
    },
    plunger: {
      front(g, a, c) {
        // 이마에 딱 붙어서 움직이지 않는다
        this.pattern(['.KKK.', '.KTK.', '.KTK.', '.KTK.', '.KTK.', 'KKKKK', 'KRRRK', 'KrrrK'], a.hx - 2, a.top - 6, { K: c.K, T: '#c48b56', R: '#d8303b', r: '#9a1a22' });
      },
    },
    dragonhorns: {
      front(g, a, c, t) {
        // 이마에 딱 붙은 용의 뿔: 뿌리가 이마 줄에 박힌다
        const m = { K: c.K, V: '#b784f5', v: '#8456c6' };
        this.pattern(['KK......', 'KvK.....', '.KvK....', '.KVvK...', '..KVVK..'], a.hx - 8, a.top - 3, m);
        this.pattern(['......KK', '.....KvK', '....KvK.', '...KvVK.', '..KVVK..'], a.hx + 1, a.top - 3, m);
        if (t % 1.2 < 0.6) { this.px(a.hx - 7, a.top - 2, '#e6c8ff'); this.px(a.hx + 7, a.top - 2, '#e6c8ff'); }
      },
    },
    // 50kg 군장 (캠핑 배낭을 다시 그림)
    campingpack: {
      back(g, a, c, t) {
        const O = '#5b6b3a', o = '#44522a';
        // 위에 말아 올린 판초 우의
        this.pattern(['.KKKKKKKKKKK.', 'KkkKkkkKkkkkK', '.KKKKKKKKKKK.'], a.hx - 6, a.top - 11, { K: c.K, k: '#8a7a4a' });
        for (let y = a.top - 8; y <= a.my + 1; y++) for (let x = a.hx - 8; x <= a.hx + 8; x++) {
          const edge = x === a.hx - 8 || x === a.hx + 8 || y === a.top - 8;
          this.px(x, y, edge ? c.K : y === a.top - 5 || y === a.top - 1 ? '#2e3a1e' : (x * 3 + y) % 7 === 0 ? o : O);
        }
        // 옆에 매단 방탄모와 반합, 야전삽
        this.pattern(['.KKKK.', 'KhhhhK', 'KhHhhK', 'KKKKKK'], a.left - 5, a.top - 3, { K: c.K, h: '#3e4a28', H: '#5b6b3a' });
        this.pattern(['KKK', 'KgK', 'KgK', 'KKK'], a.right + 1, a.top - 2, { K: c.K, g: '#8a8a70' });
        for (let y = a.top - 12; y <= a.top - 4; y++) this.px(a.right + 3, y, '#6b3f1a');
        this.pattern(['KKK', 'KsK', '.K.'], a.right + 2, a.top - 4, { K: c.K, s: '#8e9aaa' });
      },
      front(g, a, c, t) {
        if (a.curled) return;
        for (const dx of [-4, 4]) for (let y = a.my + 1; y <= a.my + 3; y++) this.px(a.hx + dx, y, '#2e3a1e');
        if (t % 3 < 0.8) this.pattern(['.U.', 'UUU', '.U.'], a.left - 1, a.top + 2 + Math.round((t % 3) * 3), { U: '#8fd0f5' }, false);
      },
    },

    // ======================= 손 =======================
    k2rifle: {
      hand: true,
      front(g, a, c) {
        const m = { K: c.K, D: '#2b2d33', g: '#6a6e78' };
        const R = ['......KK......', 'KKKKKKKKKKKKKKK', 'KDDDDDDDDDDDDgg', 'KDDKKKDDKKKKKKK', '.KK..KDK.......', '.....KDK.......', '......KK.......'];
        if (a.curled) { this.pattern(R.slice(1, 4), a.right + 1, GROUND - 3, m); return; }
        this.pattern(R, a.right - 4, a.cy - 2, m);
        heldPaw(this, g, a.right + 2, a.cy + 2);
      },
    },
    thorhammer: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, S: '#a8b0ba', s: '#7a828e', R: '#dfe5ee', t: '#6b3f1a' };
        const Hm = ['KKKKKKK', 'KSSRSSK', 'KSsSsSK', 'KSSSSSK', 'KKKKKKK', '...K...', '..KtK..', '..KtK..', '...K...'];
        if (a.curled) { this.pattern(Hm, a.right + 1, GROUND - 9, m); return; }
        const x0 = a.right - 2, y0 = a.cy - 7;
        // 번개: 0.2초마다 모양이 바뀌고, 켜질 때 망치 둘레가 푸르게 번진다
        const n = Math.floor(t * 5);
        const on = hash(n) > 0.35;
        if (on) for (let y = y0 - 1; y <= y0 + 5; y++) { this.px(x0 - 1, y, 'rgba(140,220,255,0.35)', false); this.px(x0 + 7, y, 'rgba(140,220,255,0.35)', false); }
        this.pattern(Hm, x0, y0, m);
        heldPaw(this, g, a.right + 1, a.cy + 1);
        if (on) {
          bolt(this, x0 + 1, y0, -0.6, 5 + Math.floor(hash(n + 1) * 4), n);
          bolt(this, x0 + 5, y0, 0.6, 5 + Math.floor(hash(n + 2) * 4), n + 3);
          if (hash(n + 4) > 0.5) this.px(x0 + 3 + Math.round((hash(n + 5) - 0.5) * 6), y0 + 2, '#ffffff');
        }
      },
    },
    elfbow: {
      hand: true,
      front(g, a, c, t) {
        const x = a.right + 2;
        if (a.curled) { for (let i = 0; i < 12; i++) this.px(a.right + 1 + i, GROUND - 1 - Math.round(Math.sin((i / 11) * Math.PI) * 2), i % 3 ? '#ffd65a' : '#78c46a'); return; }
        const y0 = a.cy - 7;
        const glow = `rgba(180,255,200,${(0.5 + 0.4 * Math.sin(t * 4)).toFixed(2)})`;
        for (let i = 0; i <= 14; i++) {
          const bx = x + Math.round(Math.sin((i / 14) * Math.PI) * 4);
          this.px(bx, y0 + i, i % 4 === 0 ? '#78c46a' : '#ffd65a');
          this.px(x, y0 + i, glow, false);
        }
        this.pattern(['.N', 'NN'], x + 3, y0 + 2, { N: '#78c46a' });
        this.pattern(['NN', '.N'], x + 3, y0 + 11, { N: '#78c46a' });
        heldPaw(this, g, x + 3, a.cy);
        if (t % 2.6 < 1) { for (let i = -6; i <= 1; i++) this.px(x + i + 1, a.cy, i === -6 ? '#ffffff' : '#bfffd0', false); }
        if (t % 1.2 < 0.3) star(this, x + 5, y0 - 1, '#dfffe8');
      },
    },
    plungerhand: {
      hand: true,
      front(g, a, c) {
        // 빨간 고무 컵을 위로 치켜든 전투 자세. 나무 손잡이는 털색과 섞이지 않게 진한 갈색 + 외곽선
        const m = { K: c.K, R: '#d8303b', r: '#9a1a22', H: '#ff8a8a', t: '#8a5a32', T: '#b8834e' };
        if (a.curled) { this.pattern(['.KKKKKKKKK', 'KTTTTTKRRK', '.KKKKKKRRK', '.......KKK'], a.right + 1, GROUND - 3, m); return; }
        this.pattern(['..KKKKK..', '.KRRHRRK.', 'KRRRRRRRK', 'KrrrrrrrK', '.KKKKKKK.', '...KTK...', '...KtK...', '...KtK...', '...KtK...', '...KtK...', '...KKK...'], a.right - 3, a.cy - 10, m);
        heldPaw(this, g, a.right + 1, a.cy + 1);
      },
    },
    supersoaker: {
      hand: true,
      front(g, a, c, t) {
        const m = { K: c.K, G: '#4fd06a', H: '#b8ffc8', O: '#ff8a2a', Y: '#ffe23a', P: '#a45cf0', B: '#3aa8ff' };
        const gun = ['...KKKKK.....', '..KGGGGGK....', '..KGHGGGK....', 'KKKKKKKKKKKKK', 'KOOOOOOOOOYYK', 'KPPKKKBOKKKKK', '.KKK.KPK.....', '.....KPK.....', '.....KK......'];
        if (a.curled) { this.pattern(gun.slice(3, 6), a.right + 1, GROUND - 3, m); return; }
        const x0 = a.right - 5, y0 = a.cy - 5;
        this.pattern(gun, x0, y0, m);
        heldPaw(this, g, x0 + 6, a.cy + 2);
        // 2.5초마다 초고압 물줄기가 쭉
        const ph = t % 2.5;
        if (ph < 0.6) {
          const len = Math.min(48, Math.round(ph * 90));
          for (let i = 0; i < len; i++) {
            const x = x0 + 13 + i;
            this.px(x, y0 + 4, i % 3 ? '#8fd8ff' : '#ffffff', false);
            this.px(x, y0 + 5, 'rgba(143,216,255,0.5)', false);
            if (i % 5 === 2) this.px(x, y0 + 3 - (i % 2), 'rgba(200,240,255,0.8)', false);
          }
        }
      },
    },
    // 진짜 토끼 발 · 곰돌이 발 (손 인형을 다시 그림)
    bunnymitt: {
      hand: true,
      front(g, a, c, t) {
        const P = ['.KKK.', 'KWWWK', 'KWWWK', 'KWPWK', 'KPWPK', '.KKK.'];
        const m = { K: '#b8b0a8', W: '#ffffff', P: '#ffb3c7' };
        if (a.curled) return;
        const bob = Math.round(Math.sin(t * 3));
        this.pattern(P, a.right - 1, a.cy - 1 + bob, m);
        this.pattern(P, a.left - 3, a.cy - 1 - bob, m);
      },
    },
    bearmitt: {
      hand: true,
      front(g, a, c, t) {
        const P = ['W.W.W', 'KTTTK', 'KTTTK', 'KTPTK', 'KPPPK', '.KKK.'];
        const m = { K: c.K, T: '#8a5a38', P: '#e8a0a0', W: '#fffaf0' };
        if (a.curled) return;
        const bob = Math.round(Math.sin(t * 3 + 1));
        this.pattern(P, a.right - 1, a.cy - 1 + bob, m);
        this.pattern(P, a.left - 3, a.cy - 1 - bob, m);
      },
    },
  };
  Object.assign(ACC, ACC5);

  root.PetSprite.costumeKit = { GROUND, sway, hash, mirror, heldPaw, rowsAt, cells, isBody, wear, hood, isFace, star, skirt };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);
