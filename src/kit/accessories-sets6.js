// 6차 코스튬 (2026-09-24): 세트 5 + 몸 4. accessories.js 뒤에 읽는다
// 2026-09-24 다듬기: 모든 아이템 음영(밝은 면·그늘)과 외곽선을 정리하고, 야근 요정은 소주병을 든다
(function (root) {
  const { GROUND, sway, heldPaw, wear, hood, isFace, skirt } = root.PetSprite.costumeKit;

  // 머리를 한 칸 크게 감싸는 둥근 후드 (공룡 잠옷·후드티). 귀는 천 속에 숨는다.
  // fill(x, y, dx) 가 null 을 주면 그 칸은 비워 둔다 (얼굴 구멍)
  function roundHood(r, a, c, fill, lift = 0, round = 2) {
    const y0 = a.top - 1 - lift;
    const y1 = a.curled ? GROUND - 1 : a.my + 2;
    const x0 = a.left - 1, x1 = a.right + 1;
    const inside = (x, y) => {
      if (x < x0 || x > x1 || y < y0 || y > y1) return false;
      // 위 모서리는 둥글게 두 칸씩 깎는다
      const cx = Math.min(x - x0, x1 - x);
      const cy = y - y0;
      return !(cx + cy < round);
    };
    r.shape(inside, [x0, y0, x1, y1], (x, y) => fill(x, y, x - a.hx), c.K);
  }
  // 퀭한 눈: 눈 윗줄을 털색 눈꺼풀로 반쯤 덮고, 눈 밑에 두 톤 다크서클
  function tiredEyes(r, g, a) {
    if (a.curled) return;
    for (const x of [a.eyeL, a.eyeR]) {
      for (let i = 0; i < a.ew; i++) {
        r.px(x + i, a.ey, g.c.body);
        r.px(x + i, a.ey + a.eh, i === 0 ? '#9a7ab0' : '#b596c4');
      }
    }
  }
  // 세로로 그린 도트를 오른쪽으로 90도 눕힌다 (윗부분이 오른쪽으로)
  const lay = (rows) => Array.from({ length: rows[0].length }, (_, j) => rows.map((row) => row[j]).reverse().join(''));

  // 초록 소주병: 은색 뚜껑, 초록 유리(왼쪽 빛줄기 · 오른쪽 그늘), 흰 라벨에 빨간 로고
  const SOJU = ['.KKK.', '.KSK.', '.KsK.', '.KnK.', 'KhGgK', 'KhGgK', 'KLLlK', 'KLRlK', 'KLLlK', 'KhGgK', 'KGGgK', '.KKK.'];
  const sojuMap = (c) => ({ K: c.K, S: '#e8edf2', s: '#9aa6b2', n: '#2f9a50', h: '#b8f5c8', G: '#3fb562', g: '#237a3e', L: '#f4faf2', l: '#cfe3d2', R: '#e0303c' });

  // 층층 가지: [윗줄, 아랫줄, 윗줄 반폭, 아랫줄 반폭] 층마다 아래로 갈수록 넓어지고, 아랫단은 톱니, 오른쪽은 그늘
  // 크리스마스트리 알전구: 트리 여기저기 (몸통 쪽은 서 있을 때만). which(dy) 로 모자 쪽(위)·옷 쪽(아래)을 고른다
  function xbulbs(r, a, t, which) {
    const cols = ['#ff4a4a', '#ffd23f', '#5ab8ff', '#ff8fd0', '#8fff8a'];
    const bulbs = a.curled
      ? [[-2, -4], [2, -2], [-4, -1], [3, 1], [-5, 2]]
      : [[0, -7], [-2, -4], [2, -3], [-4, -1], [4, 0], [-7, 3], [7, 4], [-8, 7], [8, 8], [-4, 9], [4, 9]];
    bulbs.forEach(([dx, dy], i) => {
      if (!which(dy)) return;
      const on = Math.floor(t * 2.5 + i * 1.7) % 3 !== 0;
      const col = cols[(i + Math.floor(t * 0.7)) % cols.length];
      r.px(a.hx + dx, a.top + dy, on ? col : '#3a3030');
    });
  }
  function xtree(r, a, c, t, tiers) {
    const G1 = '#2f8f46', G2 = '#1f6b36', G3 = '#4fb060', Gold = '#f0c850', gold = '#b8871a';
    const half = (y) => {
      let h = -1;
      for (const [y0, y1, h0, h1] of tiers) if (y >= y0 && y <= y1) h = Math.max(h, Math.round(h0 + ((h1 - h0) * (y - y0)) / Math.max(1, y1 - y0)));
      return h;
    };
    const inside = (x, y) => {
      const h = half(y);
      if (h < 0) return false;
      const d = Math.abs(x - a.hx);
      if (d > h) return false;
      // 층 아랫단 톱니: 맨 아랫줄 바깥 두 칸 중 하나 건너 하나를 비운다
      const last = tiers.some(([, y1]) => y1 === y) && half(y + 1) < h;
      return !(last && d >= h - 1 && (x + y) % 2 === 0);
    };
    const ys = tiers.map((q) => q[0]), ye = tiers.map((q) => q[1]);
    const box = [a.hx - 11, Math.min(...ys), a.hx + 11, Math.max(...ye)];
    r.shape(inside, box, (x, y) => {
      const dx = x - a.hx, h = half(y);
      // 금빛 반짝이 줄: 왼쪽 위에서 오른쪽 아래로 두 가닥
      const k = (dx + 2 * y) % 13;
      if (Math.abs(dx) < h && (k + 13) % 13 === 0) return (Math.floor(t * 4) + x) % 5 === 0 ? '#fff6c0' : Gold;
      if ((k + 13) % 13 === 1 && Math.abs(dx) < h) return gold;
      if (!inside(x, y + 1)) return G2; // 층마다 아랫단 그늘
      if (dx >= Math.ceil(h / 2)) return G2;
      if (dx <= -h + 1) return G3;
      return G1;
    }, c.K);
  }

  const ACC = {
    // ======================= 세트 =======================
    overtimer: {
      // 야근 요정 김대리: 이마에 넥타이 머리띠, 퀭한 눈에 발그레한 볼, 흰 셔츠에 풀어 헤친 넥타이, 목에 건 사원증,
      // 앞발엔 초록 소주병 (앞발 쓰는 모션 동안은 병만 숨긴다)
      front(g, a, c, t) {
        const Rt = '#d8303b', rt = '#9a1f2a', Rh = '#ff7a7a';
        const J = '#3e4458', j = '#2a2e3c', Jh = '#5a6178', Sh = '#f6f8fb', sh = '#d3dae6';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#2a2d38';
          if (dy === -3) return '#f08a8a'; // 한잔해서 발그레한 볼
          if (a.curled) return adx >= 5 ? j : J;
          if (dy === -2) return adx <= 3 ? '#ffffff' : adx >= 5 ? j : J; // 셔츠 깃 끝
          if (adx <= 2) return dy >= 1 ? sh : Sh;
          if (adx === 3) return Jh; // 재킷 깃 (빛 받는 모서리)
          return adx >= 5 ? j : J;
        });
        tiredEyes(this, g, a);
        // 머리띠 넥타이: 이마를 가로지르는 사선 줄무늬, 왼쪽에서 매듭지어 두 가닥이 휘날린다
        const yb = a.top + 1;
        for (let x = a.left; x <= a.right; x++) this.px(x, yb, (x + yb) % 3 === 0 ? rt : Rt);
        const s = sway(t, 2.4, 1);
        const m = { K: c.K, R: Rt, r: rt, H: Rh };
        // 긴 가닥 (넥타이 넓은 끝, 뾰족한 끝이 아래로)
        this.pattern(['...KK', '..KHK', '.KRrK', 'KRrK.', 'KrRK.', '.KK..'], a.left - 5, yb, m);
        // 짧은 가닥 (위로 팔랑)
        this.pattern(s > 0 ? ['KK...', 'KHKK.', '.KrRK', '..KKK'] : ['.....', 'KKKK.', 'KHrRK', '.KKKK'], a.left - 6, yb - 3, m);
        // 매듭
        this.pattern(['KKK', 'KRK', 'KKK'], a.left - 2, yb - 1, m);
        if (!a.curled) {
          // 풀어 헤친 넥타이: 매듭이 가슴까지 내려오고 비뚤게 늘어진다
          this.px(a.hx, a.my + 3, rt);
          this.px(a.hx, a.my + 4, Rt);
          this.px(a.hx + 1, a.my + 4, Rh);
          this.px(a.hx + 1, a.my + 5, Rt);
          // 사원증: 파란 목줄이 깃에서 내려와 흰 카드 (주황 증명사진 한 칸)
          const L = '#3d6fb0';
          this.px(a.hx - 2, a.my + 2, L);
          this.px(a.hx - 3, a.my + 2, L);
          this.pattern(['WW', 'Ww'], a.hx - 5, a.my + 3, { W: '#ffffff', w: '#e07a3a' });
        }
        // 소주병
        if (this.pawsBusy) return;
        const sm = sojuMap(c);
        if (a.curled) {
          // 잘 때는 옆에 눕혀 둔다 (뚜껑이 오른쪽)
          this.pattern(lay(SOJU), a.right + 1, GROUND - 4, sm);
          return;
        }
        const x0 = a.right;
        const y0 = a.cy - 12;
        this.pattern(SOJU, x0, y0, sm);
        // 병에 맺힌 물방울이 가끔 반짝
        if (t % 2.8 < 0.3) this.px(x0 + 1, y0 + 9, '#ffffff');
        heldPaw(this, g, x0 + 2, a.cy + 1);
      },
    },

    seonbi: {
      // 과거 낙방 7수 선비: 말총으로 엮어 비치는 흑립(갓), 옥색 도포에 흰 동정과 붉은 세조대, 귀 뒤에 꽂은 붓
      front(g, a, c, t) {
        const P = '#e8f1ea', p = '#bcd3c4', pd = '#98b6a4', W = '#ffffff', Sash = '#c23a4a', sash = '#7e2230';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#f7f4ea'; // 버선
          if (dy === -3) return null;
          if (a.curled) return adx >= 5 ? p : P;
          // 동정(흰 깃): 턱 밑 양쪽에서 내려와 오른쪽 깃이 왼쪽 위로 겹친다
          if (adx === 2 && dy <= -1) return W;
          if (dy === 0 && (dx === 0 || dx === 1)) return W;
          if (dy === 1 && dx === -1) return W;
          return adx >= 5 ? pd : adx >= 4 ? p : P;
        });
        skirt(this, a, c, [1, 2], (x, y, k) => {
          const d = Math.abs(x - a.hx);
          return d >= 7 ? pd : d >= 5 ? p : k === 1 && x === a.hx - 1 ? W : P;
        });
        if (!a.curled) {
          // 세조대: 오른쪽 가슴에서 매듭, 술이 늘어진다
          this.px(a.hx + 2, a.my + 3, Sash);
          this.px(a.hx + 3, a.my + 3, sash);
          this.px(a.hx + 2, a.my + 4, Sash);
          this.px(a.hx + 3, a.my + 5, Sash);
          this.px(a.hx + 2, a.my + 5, sash);
        }
        // 붓: 오른쪽 귀 뒤에 비스듬히 꽂았다 (대나무 자루 · 흰 털 · 먹 묻은 끝)
        this.pattern(['......k', '.....kW', '....WW.', '...Kt..', '..tT...', '.t.....'], a.right - 4, a.earTop - 4, { k: '#15151a', W: '#f4f1e6', t: '#b88a4a', T: '#7a5528', K: '#3a3a44' });
        // 갓: 말총이라 속이 비친다 (반투명 몸통·챙), 테두리만 진하게
        const O = '#0e0e12', F = 'rgba(20,20,28,0.45)', Fh = 'rgba(150,150,170,0.45)', Fb = 'rgba(20,20,28,0.6)';
        const brimY = a.earTop + 1;
        const halves = [2, 2, 2, 3];
        halves.forEach((half, i) => {
          const y = brimY - halves.length + i;
          for (let x = a.hx - half; x <= a.hx + half; x++) {
            const edge = Math.abs(x - a.hx) === half || i === 0;
            this.px(x, y, edge ? O : x === a.hx - half + 1 ? Fh : F, false);
          }
        });
        // 윗단 비단 띠 (양태 위 검은 띠)
        for (let x = a.hx - 3; x <= a.hx + 3; x++) this.px(x, brimY - 1, x === a.hx - 3 || x === a.hx + 3 ? O : '#2a2a34');
        // 챙: 가운데는 비치고, 양끝으로 갈수록 진해진다
        for (let x = a.hx - 10; x <= a.hx + 10; x++) {
          const d = Math.abs(x - a.hx);
          this.px(x, brimY, d >= 10 ? O : d >= 8 ? 'rgba(20,20,28,0.8)' : Fb, false);
        }
        // 챙에 스치는 빛
        const ph = (t % 3.4) / 0.8;
        if (ph < 1) this.px(a.hx - 9 + Math.round(ph * 18), brimY, 'rgba(255,255,255,0.8)', false);
        // 갓끈: 호박 구슬이 볼을 타고 내려와 턱 밑에서 모여 가슴까지 늘어진다
        const bead = (i) => (i % 2 ? '#8a5a20' : '#f0b050');
        let i = 0;
        const yEnd = a.curled ? a.my : a.my - 1;
        for (let y = brimY + 1; y <= yEnd; y++, i++) { this.px(a.left + 1, y, bead(i)); this.px(a.right - 1, y, bead(i)); }
        if (!a.curled) {
          for (let k = 1; k <= 3; k++, i++) { this.px(a.left + 1 + k, a.my - 1 + k, bead(i)); this.px(a.right - 1 - k, a.my - 1 + k, bead(i)); }
          this.px(a.left + 5, a.my + 3, '#7fc8a8'); // 옥구슬
        }
      },
    },

    dinosuit: {
      // 크아앙 공룡 잠옷: 머리보다 큰 초록 후드 위로 공룡 눈 두 개, 이마엔 하얀 이빨, 등을 따라 노란 가시, 배는 크림색 줄무늬
      front(g, a, c, t) {
        const G1 = '#5fbf5a', G2 = '#3f9a45', G3 = '#8ad97a', Gd = '#2d7a38';
        const Bel = '#f6e8a6', bel = '#dccb78';
        const faceY = a.curled ? a.ey : a.ey - 1;
        roundHood(this, a, c, (x, y, dx) => {
          const adx = Math.abs(dx);
          if (adx <= 4 && y >= faceY) return null; // 얼굴 구멍
          if (y === faceY - 1 && adx <= 4) return (dx + 10) % 2 ? Gd : '#ffffff'; // 이빨
          if (y <= a.top - 1) return G3; // 정수리 빛
          return adx >= 6 ? G2 : G1;
        }, 1);
        if (!a.curled) for (const s of [-5, 5]) { this.px(a.hx + s, a.ey + 1, '#ffffff'); this.px(a.hx + s, a.ey + 2, Gd); }
        // 콧구멍 두 점
        this.px(a.hx - 1, a.top, Gd);
        this.px(a.hx + 1, a.top, Gd);
        // 공룡 눈: 귀 자리에 볼록 (눈동자가 가끔 옆으로 굴러간다)
        const look = Math.floor(t / 2.3) % 3 === 1 ? 1 : 0;
        const blink = t % 4.1 < 0.15;
        const ey = a.top - 5;
        const eyeRows = ['.KKK.', 'KWWGK', 'KWWWK', 'KGGGK'];
        [[a.hx - 6, eyeRows], [a.hx + 2, eyeRows.map((row) => row.split('').reverse().join(''))]].forEach(([x0, rows], side) => {
          this.pattern(blink ? ['.KKK.', 'KGGGK', 'KKKKK', 'KGGGK'] : rows, x0, ey, { K: c.K, W: '#ffffff', G: G2 });
          // 눈동자 (눈꺼풀 반대쪽 아래칸에서 가끔 옆으로 굴러간다)
          if (!blink) this.px(x0 + (side ? 2 : 2) + look, ey + 2, '#1a1a1a');
        });
        // 등 가시: 정수리 가운데 하나 + 등(오른쪽)을 따라 내려간다
        const Sp = { K: c.K, Y: '#ffd24a', y: '#e09a20' };
        this.pattern(['.K.', 'KYK', 'KyK'], a.hx - 1, a.top - 4, Sp);
        const spikes = a.curled ? [a.top + 1, a.top + 4] : [a.top + 1, a.ey + 1, a.my + 2];
        spikes.forEach((y) => this.pattern(['K..', 'YK.', 'yYK', 'yK.', 'K..'], a.right + 2, y - 2, Sp));
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return adx === 5 || adx === 1 ? '#ffffff' : G2; // 발톱
          if (a.curled) return adx >= 5 ? G2 : G1;
          if (adx <= 2 && dy >= -1) return (dy + 10) % 2 ? bel : Bel; // 줄무늬 배
          return adx >= 5 ? G2 : G1;
        });
      },
    },

    xmasstar: {
      // 크리스마스트리 모자 (2026-09-25 크리스마스트리 세트에서 떼어 냈다): 얼굴 둘레를 감싼 초록 가지 한가운데로 얼굴이 빼꼼,
      // 귀를 덮는 원뿔 꼭대기에 반짝 별, 금빛 반짝이 줄과 알전구가 깜빡
      back(g, a, c, t) {
        if (a.curled) return;
        xtree(this, a, c, t, [[a.top - 2, a.ey + 1, 4, 8]]);
      },
      front(g, a, c, t) {
        const G1 = '#2f8f46', G2 = '#1f6b36', G3 = '#4fb060';
        hood(this, g, a, (dx, y) => (isFace(a, dx, y) ? null : dx >= 3 ? G2 : dx <= -4 ? G3 : G1));
        // 꼭대기 원뿔 (귀를 덮는다)
        const tipY = a.curled ? a.top - 7 : a.top - 9;
        const tiers = a.curled ? [[tipY, a.top - 1, 0, 5]] : [[tipY, a.top - 4, 0, 3], [a.top - 5, a.top - 1, 2, 5]];
        xtree(this, a, c, t, tiers);
        xbulbs(this, a, t, (dy) => dy < 0);
        // 꼭대기 별 (가끔 반짝)
        const tw = Math.floor(t * 3) % 4 === 0;
        const sy = tipY - 4;
        this.pattern(['..K..', '.KYK.', 'KYWYK', '.KYK.', '.K.K.'], a.hx - 2, sy, { K: '#a8770f', Y: '#ffd23f', W: tw ? '#ffffff' : '#fff2a8' });
        if (tw) { this.px(a.hx - 4, sy, '#fff7c8', false); this.px(a.hx + 4, sy, '#fff7c8', false); }
      },
    },
    xmastree: {
      // 알전구 트리 옷 (2026-09-25 크리스마스트리 세트의 몸): 층층이 퍼지는 초록 가지에 알전구가 깜빡, 다리는 나무 기둥
      back(g, a, c, t) {
        if (a.curled) return;
        xtree(this, a, c, t, [[a.ey, GROUND - 1, 6, 10]]);
      },
      front(g, a, c, t) {
        const G1 = '#2f8f46', G2 = '#1f6b36';
        wear(this, g, a, (dx, dy, x, y, leg) => (leg ? (dx % 2 ? '#8a5a30' : '#6a4020') : dx >= 3 ? G2 : G1));
        xbulbs(this, a, t, (dy) => dy >= 0);
      },
    },

    // ======================= 몸 =======================

    schoolwear: {
      // 매점 달리기 1등 교복: 남색 가디건 V넥, 흰 셔츠 깃 사이로 빨간 넥타이, 금색 단추, 가슴에 흰 명찰
      front(g, a, c) {
        const Nv = '#2e3a6a', nv = '#1f2850', Nh = '#44528a', Wt = '#ffffff', wt = '#d6dcea';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#4a4f5c';
          if (dy === -3) return null;
          if (a.curled) return adx >= 5 ? nv : Nv;
          if (dy <= -1 && adx <= 3) return adx === 3 && dy === -1 ? Nh : Wt; // 셔츠 깃
          if (dy >= 0 && adx <= 1) return dy >= 1 ? wt : Wt; // V넥 사이 셔츠
          if (adx === 2) return Nh; // V넥 테두리
          return adx >= 5 ? nv : Nv;
        });
        if (a.curled) return;
        // 넥타이: 매듭 + 아래로 넓어지는 끝
        this.px(a.hx, a.my + 2, '#c8242c');
        this.px(a.hx, a.my + 3, '#e8303a');
        this.px(a.hx, a.my + 4, '#a01c24');
        // 명찰 (이름 줄 한 칸) + 금색 단추
        this.pattern(['WWW', 'WkW'], a.hx + 3, a.my + 3, { W: '#ffffff', k: '#3d6fb0' });
        this.px(a.hx - 2, a.my + 4, '#f0c850');
      },
    },

    aloha: {
      // 휴가 못 간 하와이안 셔츠: 청록 바탕에 큼직한 흰·분홍 히비스커스, 초록 잎, 활짝 연 흰 칼라, 단추 한 줄
      front(g, a, c) {
        const Rd = '#16a3a8', rd = '#0f7c82', Rh = '#3cc4c4';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#f2e6c8';
          if (dy === -3) return null;
          if (a.curled) return adx >= 5 ? rd : Rd;
          if (adx <= 1 && dy <= 0) return null; // 풀어 헤친 앞섶 (털이 보인다)
          if (dy <= -1 && adx <= 3) return adx === 3 && dy === -1 ? '#d8d0b8' : '#fffaf0'; // 칼라
          if (adx <= 1) return Rd;
          return adx >= 5 ? rd : adx === 4 && dy === 0 ? Rh : Rd;
        });
        if (a.curled) return;
        const F = { W: '#ffffff', Y: '#ffd65a', N: '#6fd06a', n: '#3a9a4a', P: '#ff6aa8', p: '#ffe45a', q: '#d83a80' };
        // 왼쪽 흰 히비스커스 + 잎, 오른쪽 분홍 히비스커스 + 잎
        this.pattern(['.W.', 'WYW', 'nW.'], a.hx - 5, a.my + 2, F);
        this.pattern(['.PN', 'PpP', 'qP.'], a.hx + 3, a.my + 2, F);
        this.px(a.hx - 2, a.my + 4, '#ff6aa8');
        this.px(a.hx, a.my + 4, '#fffaf0'); // 단추
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);

// ---- 이전 디자인으로 되돌린 것 (2026-09-24 피드백: 다듬은 것보다 이전 게 낫다) ----
// 도우미 이름이 위쪽 새 그림과 겹쳐서 따로 묶는다
(function (root) {
  const { GROUND, wear, hood, isFace, hash } = root.PetSprite.costumeKit;
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
  // 퀭한 눈: 눈 윗줄을 털색 눈꺼풀로 덮고, 눈 밑에 보랏빛 다크서클
  function tiredEyes(r, g, a) {
    if (a.curled) return;
    for (const x of [a.eyeL, a.eyeR]) for (let i = 0; i < a.ew; i++) {
      r.px(x + i, a.ey, g.c.body);
      r.px(x + i, a.ey + a.eh, '#8a6a9a');
    }
  }

  const ACC = {

    mondaydev: {
      // 2026-09-25 디벨롭: 머리 위 로딩 링 · 뒤에 뜬 콘솔 창(에러 로그) · 얼음컵 물방울
      // 월요일 배포 개발자: 후드 뒤집어쓰고 다크서클, 옆엔 빨간 경고가 깜빡이는 노트북과 얼음 녹은 아이스 아메리카노
      back(g, a, c, t) {
        // 노트북 (왼쪽 바닥)
        const x0 = a.left - 11, yb = GROUND;
        const err = Math.floor(t * 2) % 2 === 0;
        this.pattern(
          ['KKKKKKKK', 'KsssssK.', 'KsGsssK.', 'KsssssK.', 'KsGGssK.', 'KKKKKKK.', 'KgggggggK', 'KKKKKKKKK'],
          x0, yb - 7, { K: '#1f1c24', s: '#23303a', G: '#5ad07a', g: '#a8b0bc' },
        );
        if (!a.curled) {
          this.px(x0 + 4, yb - 5, err ? '#ff4a4a' : '#23303a');
          this.px(x0 + 4, yb - 4, err ? '#ff4a4a' : '#23303a');
          this.px(x0 + 4, yb - 3, '#23303a');
        }
        // 아이스 아메리카노 (오른쪽 바닥): 투명 컵, 녹은 얼음, 초록 빨대
        const cx = a.right + 3;
        this.pattern(['...N', '..N.', 'KKNKK', 'KUuUK', 'KuwuK', 'KuuuK', '.KKK.'], cx, yb - 6, { K: '#6a7078', N: '#4b8f43', U: '#c6e4f7', u: '#6b4a32', w: '#d6ecf7' });
        // 콘솔 창 (2026-09-25): 노트북·컵과 이름이 겹치지 않게 블록으로 감싼다
        if (!a.curled) {
          // 콘솔 창: 오른쪽 위에 떠 있고(왼쪽 아래 노트북과 대각선), 안에서 빨간 에러 줄이 위로 밀려 올라간다
          const x0 = a.right - 1, y0 = a.top - 13, W = 11, H = 8;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
            this.px(x0 + x, y0 + y, edge ? '#1f1c24' : y === 1 ? '#454b5c' : '#262b36', false);
          }
          this.px(x0 + 2, y0 + 1, '#ff5f57', false); this.px(x0 + 4, y0 + 1, '#febc2e', false); this.px(x0 + 6, y0 + 1, '#28c840', false);
          const s = Math.floor(t * 3);
          for (let row = 0; row < 4; row++) {
            const n = s + row;
            const len = 2 + Math.floor(hash(n * 13) * 6);
            const err = hash(n * 7) > 0.45;
            for (let i = 0; i < len; i++) this.px(x0 + 2 + i, y0 + 3 + row, i === 0 ? (err ? '#ff8080' : '#8fd08a') : err ? '#e05050' : '#9aa0b0', false);
          }
        }
      },
      front(g, a, c, t) {
        const H = '#6b7080', h = '#50546a';
        hood(this, g, a, (dx, y) => (isFace(a, dx, y) ? null : Math.abs(dx) === 5 && y >= a.ey - 1 ? h : H));
        bigHood(this, a, c, H);
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#2e3140';
          if (dy >= 2 && adx <= 3) return h; // 캥거루 주머니
          return adx >= 5 ? h : H;
        });
        tiredEyes(this, g, a);
        if (a.curled) return;
        // 후드 끈
        for (const s of [-2, 2]) { this.px(a.hx + s, a.my + 3, '#fffaf3'); this.px(a.hx + s, a.my + 4, '#fffaf3'); }
        // 스티커 두 장
        this.px(a.hx - 4, a.my + 4, '#ff9bd5');
        this.px(a.hx + 4, a.my + 3, '#ffd23f');
        // 머리 위 로딩 링: 여덟 칸이 빙글, 머리는 밝고 꼬리는 흐리게
        const ring = [[-1, -2], [1, -2], [2, -1], [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1]];
        const on = Math.floor(t * 10) % 8;
        ring.forEach(([dx, dy], i) => {
          const d = (on - i + 8) % 8;
          this.px(a.hx + dx, a.top - 6 + dy, d === 0 ? '#ffffff' : d === 1 ? '#c8ccd8' : d === 2 ? '#8a90a0' : 'rgba(80,84,106,0.55)', false);
        });
        // 얼음컵에 맺혀 흘러내리는 물방울
        const p = (t % 2) / 2;
        this.px(a.right + 4 + (Math.floor(t / 2) % 3), GROUND - 5 + Math.round(p * 4), `rgba(198,228,247,${(1 - p * 0.7).toFixed(2)})`, false);
      },
    },

    baseballuni: {
      // 야구 유니폼: 흰 바탕 핀 스트라이프, 남색 래글런 어깨, 가슴에 빨간 필기체 팀 이름
      front(g, a, c) {
        const Nv = '#223a78';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#f4f4f0';
          if (adx >= 5) return Nv;
          if (dy === -2 && adx === 2) return Nv;
          return (x + 100) % 2 === 0 ? '#b8c4e4' : '#fbfbf6';
        });
        if (a.curled) return;
        const R = '#d8303b';
        for (const [dx, dy] of [[-4, 2], [-3, 1], [-2, 2], [2, 2], [3, 1], [4, 2], [3, 3]]) this.px(a.hx + dx, a.my + dy, R);
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, ACC);
})(window);
