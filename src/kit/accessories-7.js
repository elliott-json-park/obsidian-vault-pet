// 7차 코스튬 (2026-09-24 확정): 세트 6 · 얼굴 22 · 몸 11 · 손 6 · 효과 14. accessories.js 뒤에 읽는다
// 칸마다 따로 묶어 둔다 (도구 함수 이름이 겹쳐도 서로 안 부딪히게)


// ================= 세트 6종 =================
(function (root) {
  const { GROUND, sway, hash, mirror, heldPaw, rowsAt, cells, isBody, wear, hood, isFace, star, skirt } = root.PetSprite.costumeKit;

  // 위로 떠오르는 입자
  function rise(r, t, n, x0, x1, yb, h, col, speed = 0.5, seed = 0) {
    for (let i = 0; i < n; i++) {
      const p = (t * speed + hash(i + seed)) % 1;
      const x = Math.round(x0 + hash(i * 5 + seed) * (x1 - x0) + Math.sin(t * 2 + i) * 0.8);
      r.px(x, Math.round(yb - p * h), typeof col === 'function' ? col(i, p) : col, false);
    }
  }
  // 작은 불꽃 (w 폭, h 높이). 아래는 흰·노랑, 끝은 빨강. 한 줄씩 일렁인다
  function flame(r, t, cx, by, w, h, pal = ['#ffffff', '#ffe36a', '#ffa22a', '#ff5a1a', '#d8261a'], seed = 0) {
    for (let j = 0; j < h; j++) {
      const q = j / h;
      const half = Math.max(0, Math.round((w / 2) * (1 - q * q) + Math.sin(t * 9 + j + seed) * 0.4));
      const off = Math.round(Math.sin(t * 7 + j * 0.9 + seed) * q * 1.2);
      for (let dx = -half; dx <= half; dx++) {
        const edge = Math.abs(dx) / Math.max(1, half);
        const k = Math.min(pal.length - 1, Math.floor(q * (pal.length - 1) + edge * 1.6));
        r.px(cx + dx + off, by - j, pal[k], false);
      }
    }
  }
  // 펄럭이는 망토 (몸 뒤). y0 줄부터 바닥까지 아래로 갈수록 넓어지고, 바람에 한쪽으로 날린다.
  // 주름은 가로 물결로, 밑단은 물결 모양으로 들쭉날쭉
  function cape(r, a, t, main, dark, light, trim) {
    if (a.curled) return;
    const y0 = a.my - 1, y1 = GROUND;
    for (let y = y0; y <= y1; y++) {
      const d = y - y0;
      const wave = Math.sin(t * 3.2 - d * 0.7);
      const blow = Math.round(d * 0.35 + wave * (0.4 + d * 0.12));
      const w = 7 + Math.round(d * 0.9);
      const xl = a.hx - w - blow, xr = a.hx + w - Math.round(blow * 0.4);
      for (let x = xl; x <= xr; x++) {
        const fold = Math.sin((x - a.hx) * 0.9 + t * 2.4 - d * 0.4);
        let col = fold > 0.55 ? light : fold < -0.55 ? dark : main;
        if (x === xl || x === xr) col = trim;
        if (y === y1 && Math.sin(x * 1.3 + t * 4) > 0.3) continue; // 밑단 물결
        if (y === y1) col = trim;
        r.px(x, y, col);
      }
    }
  }
  // 둥실 뜬 물건 (살짝 흔들림)
  const bob = (t, s = 0, amp = 1.2, f = 1.8) => Math.round(Math.sin(t * f + s) * amp);

  const LAB = {
    // 3. 빗자루 면허 없는 냥그와트 1학년: 까만 로브 · 목도리 · 동그란 안경 · 번개 흉터 · 손에 빗자루 · 빨간 촛불
    nyangwarts: {
      back(g, a, c, t) {
        for (let i = 0; i < 3; i++) {
          const x = a.hx - 12 + i * 12, y = a.earTop - 6 + bob(t, i * 2) + (i === 1 ? -3 : 0);
          const fl = Math.floor(t * 6 + i) % 2;
          // 빨간 초에 빨간 불꽃 (위는 붉게 일렁, 심지 쪽은 노랗게)
          this.pattern(['F', 'f', 'R', 'R', 'r'], x, y - 1 + (fl ? 0 : 0), { F: fl ? '#ff2a1a' : '#e81a1a', f: fl ? '#ffb02a' : '#ff6a1a', R: '#c8202c', r: '#8a1420' }, false);
          if (fl) this.px(x, y - 2, 'rgba(255,40,20,0.55)', false);
          this.px(x - 1, y - 1, 'rgba(255,50,30,0.3)', false);
          this.px(x + 1, y - 1, 'rgba(255,50,30,0.3)', false);
        }
      },
      front(g, a, c, t) {
        const Bk = '#1c1c24', bk = '#30303c', Rd = '#9a1c26', Gd = '#e0b43a';
        wear(this, g, a, (dx, dy, x, y, leg) => (leg ? Bk : Math.abs(dx) === 1 && dy >= 0 ? Rd : Math.abs(dx) >= 5 ? bk : Bk));
        skirt(this, a, c, [1, 2], (x) => (Math.abs(x - a.hx) <= 1 ? Rd : Bk));
        for (let x = a.hx - 5; x <= a.hx + 5; x++) this.px(x, a.my + 2, Math.floor((x - a.hx + 20) / 2) % 2 ? Rd : Gd);
        for (let k = 0; k < 3; k++) this.px(a.hx - 3, a.my + 3 + k, k % 2 ? Gd : Rd);
        this.pattern(['.r', 'r.', '.r'], a.hx + 1, a.top, { r: '#c0303a' });
        // 빗자루: 오른앞발로 세워 쥔다. 위는 자루, 아래는 끈으로 묶은 짚
        const St = '#8a5a2a', st = '#5e3a18', Z = '#e8c86a', z = '#b8923a';
        if (a.curled) {
          for (let x = a.right + 1; x <= a.right + 10; x++) this.px(x, GROUND - 1, St);
          this.pattern(['ZZZ', 'ZzZ', 'zZz'], a.right + 11, GROUND - 3, { Z, z });
          return;
        }
        // 앞발을 쓰는 동안(빗자루를 타는 모션 등)은 손에 든 빗자루를 뺀다
        if (this.pawsBusy) return;
        const x = a.right + 2;
        for (let y = a.cy - 12; y <= GROUND - 4; y++) this.px(x, y, y % 3 ? St : st);
        this.px(x, GROUND - 4, '#c0303a');
        this.pattern(['.ZZZ.', 'ZZzZZ', 'ZzZzZ', 'zZ.Zz'], x - 2, GROUND - 3, { Z, z });
        heldPaw(this, g, x - 1, a.cy + 1);
        // 빗자루 끝에서 반짝 궤적 (마법 연습 중)
        const s = (t * 1.1) % 1;
        if (s < 0.6) this.px(x + Math.round(s * 8), a.cy - 12 - Math.round(Math.sin(s * 5) * 2), '#fff4b0', false);
      },
    },

    // 4. 와이파이 훔쳐 쓰는 사이버펑크 해커: 귀 구멍 난 테크웨어 후드 · X자 스트랩과 버클 · 어깨 LED · 네온 바이저 · 인이어 마이크 · 앞에 노트북
    cyberhacker: {
      back(g, a, c, t) {
        rise(this, t, 10, a.left - 8, a.right + 8, a.my + 2, 18, (i, p) => (i % 3 ? `rgba(80,255,160,${(1 - p).toFixed(2)})` : `rgba(255,80,220,${(1 - p).toFixed(2)})`), 0.6, 4);
      },
      front(g, a, c, t) {
        const Bk = '#15151e', bk = '#262636', gr = '#3a3a4e', Cy = '#3ef2ff', Mg = '#ff4fd8', Buck = '#c8ccd6';
        const neon = (y) => (Math.floor(t * 4 + y) % 5 ? Cy : Mg);
        hood(this, g, a, (dx, y, x, j) => {
          if (j <= 1) return null; // 귀는 구멍으로
          if (isFace(a, dx, y) && Math.abs(dx) <= 4) return null;
          if (Math.abs(dx) === 5 && y >= a.ey - 2) return neon(y);
          return Math.abs(dx) >= 6 ? bk : y === a.top ? gr : Bk;
        });
        // 후드 챙 (이마 위 한 줄)
        for (let x = a.hx - 5; x <= a.hx + 5; x++) this.px(x, a.ey - 2, x === a.hx ? Cy : bk);
        // 재킷: 높은 칼라, 가운데 지퍼, X자 스트랩과 버클, 어깨 LED
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return Bk;
          if (dy <= -2 && adx >= 5) return (Math.floor(t * 6) + adx) % 3 ? Cy : '#ffffff'; // 어깨 LED
          if (dx === 0) return (y + Math.floor(t * 3)) % 2 ? Buck : gr; // 지퍼
          if (adx === 2 + dy || adx === 2 - dy) return '#4a4a60'; // 스트랩
          return adx >= 5 ? bk : Bk;
        });
        if (!a.curled) this.pattern(['BB', 'BB'], a.hx + 2, a.my + 3, { B: Buck });
        // 바이저: 눈 줄을 가로지르는 네온 띠, 스캔 불빛이 왔다 갔다
        const scan = Math.round((Math.sin(t * 3) * 0.5 + 0.5) * 8);
        for (let x = a.hx - 4; x <= a.hx + 4; x++) this.px(x, a.ey, x - (a.hx - 4) === scan ? '#ffffff' : Mg);
        for (let x = a.hx - 4; x <= a.hx + 4; x++) this.px(x, a.ey + 1, 'rgba(255,79,216,0.55)');
        // 인이어 마이크
        this.px(a.left - 1, a.ey, gr); this.px(a.left - 1, a.ey + 1, gr); this.px(a.left, a.ey + 2, gr); this.px(a.left + 1, a.ey + 2, Cy);
        // 노트북: 오른쪽 앞 바닥에 펼쳐 놓았다. 화면에 초록 코드가 흘러가고, 그 빛이 얼굴에 비친다
        const glow = 0.2 + 0.12 * Math.sin(t * 4);
        for (let y = a.ey + 1; y <= a.my + 1; y++) this.px(a.right, y, `rgba(62,242,255,${glow.toFixed(2)})`, false);
        const lx = a.curled ? a.right + 3 : a.right + 2, ly = GROUND - 8;
        for (let j = 0; j < 7; j++) for (let i = 0; i < 9; i++) {
          const edge = i === 0 || i === 8 || j === 0 || j === 6;
          let col = edge ? '#3a3f4e' : '#0e1a20';
          if (!edge && j >= 1 && j <= 5) {
            const len = 2 + Math.floor(hash(j * 7 + Math.floor(t * 3 + j)) * 5);
            if (i >= 1 && i <= len) col = j === 5 && Math.floor(t * 3) % 2 ? '#ffffff' : (j + Math.floor(t * 3)) % 4 ? '#50ff9a' : Mg;
          }
          this.px(lx + i, ly + j, col);
        }
        // 키보드 판 (앞으로 기울어진 받침)
        for (let i = -1; i <= 9; i++) { this.px(lx + i, GROUND - 1, '#8a90a0'); this.px(lx + i, GROUND, i === -1 || i === 9 ? '#5a6070' : '#b8bec8'); }
        for (let i = 0; i <= 8; i += 2) this.px(lx + i, GROUND - 1, '#5a6070');
        // 와이파이 신호 (훔쳐 쓰는 중)
        const w = Math.floor(t * 3) % 4;
        for (let k = 1; k <= w; k++) this.px(lx + 9 + k, ly - k, Cy, false);
      },
    },

    // 5. 츄르를 수호하는 신의 기사단: 은 투구에 금 테와 흰 깃 · 흰 겉옷에 금 십자 · 펄럭이는 파란 망토 · 방패와 성검
    holyknight: {
      back(g, a, c, t) {
        // 바닥에서 옅게 올라오는 성광: 발밑이 은은히 밝고, 빛 알갱이가 천천히 떠오른다
        for (let x = a.hx - 12; x <= a.hx + 12; x++) {
          const k = 1 - Math.abs(x - a.hx) / 13;
          const pu = 0.18 + 0.08 * Math.sin(t * 2 + x * 0.4);
          for (let j = 0; j < 6; j++) this.px(x, GROUND - j, `rgba(255,236,170,${(pu * k * (1 - j / 6)).toFixed(3)})`, false);
        }
        rise(this, t, 8, a.hx - 11, a.hx + 11, GROUND, 16, (i, p) => `rgba(255,244,200,${(0.7 * (1 - p)).toFixed(2)})`, 0.3, 81);
        cape(this, a, t, '#2f4f9e', '#1f3570', '#4a6ec0', '#e8c24a');
      },
      front(g, a, c, t) {
        const S = '#dfe4ec', s2 = '#9aa4b4', sh = '#ffffff', Gd = '#f0c24a', gd = '#b8861a', W = '#fbf8f0';
        hood(this, g, a, (dx, y, x, j) => {
          const adx = Math.abs(dx);
          if (isFace(a, dx, y) && adx <= 3 && y > a.ey - 2) return null;
          if (y === a.ey - 2) return adx <= 4 ? Gd : s2;
          if (adx === 4 && y >= a.ey - 1) return Gd;
          if (dx === 0 && y < a.ey - 2) return Gd; // 정수리 금 능선
          return dx <= -3 && y < a.ey - 2 ? sh : adx >= 5 ? s2 : S;
        });
        // 깃털 장식
        const f = sway(t, 2.4, 1);
        this.pattern(['....WW', '..WWWw', '.WWWw.', 'WWw...', 'Gg....'], a.hx - 1 + f, a.earTop - 5, { W: '#ffffff', w: '#c8d4ea', G: Gd, g: gd });
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (leg) return s2;
          const adx = Math.abs(dx);
          if (adx >= 5) return dy <= -2 ? Gd : S; // 어깨 금 판
          if (dx === 0 || (dy === 0 && adx <= 2)) return Gd;
          return W;
        });
        // 성검 (오른쪽): 넓은 은빛 칼날에 금 십자 코등이, 빛이 칼날을 타고 오른다
        const sx = a.right + 1;
        if (!a.curled) {
          for (let y = a.cy - 15; y <= a.cy - 3; y++) { this.px(sx - 1, y, '#f4f8ff'); this.px(sx, y, '#c4cedc'); this.px(sx + 1, y, '#8e9aaa'); }
          this.px(sx, a.cy - 16, '#f4f8ff');
          for (let d = -3; d <= 3; d++) this.px(sx + d, a.cy - 2, Math.abs(d) === 3 ? gd : Gd);
          this.px(sx, a.cy - 1, '#3a5ab0'); this.px(sx, a.cy, '#3a5ab0');
          this.px(sx, a.cy + 2, '#ff5a6a');
          heldPaw(this, g, sx, a.cy + 1);
          const p = (t % 2.4) / 0.6;
          if (p < 1) { const yy = a.cy - 3 - Math.round(p * 12); this.px(sx - 1, yy, '#ffffff'); this.px(sx, yy, '#ffffff'); }
        } else {
          for (let x = a.right + 3; x <= a.right + 13; x++) { this.px(x, GROUND - 2, '#f4f8ff'); this.px(x, GROUND - 1, '#8e9aaa'); }
          for (let d = -2; d <= 1; d++) this.px(a.right + 2, GROUND - 1 + d, Gd);
        }
        // 방패 (왼쪽): 흰 바탕 · 금 테 · 파란 십자, 가운데 보석이 반짝
        const bx = a.curled ? a.left - 9 : a.left - 7, by = a.curled ? GROUND - 9 : a.my - 4;
        const gem = Math.sin(t * 3) > 0.6 ? '#ffffff' : '#ff5a6a';
        this.pattern([
          'GGGGGGGGG',
          'GWWWBWWWG',
          'GWWWBWWWG',
          'GBBBRBBBG',
          'GWWWBWWWG',
          '.GWWBWWG.',
          '..GWBWG..',
          '...GGG...',
        ], bx, by, { G: Gd, W: '#f8f6f0', B: '#2f4f9e', R: gem });
        this.px(bx + 1, by + 1, '#ffffff');
      },
    },

    // 6. 근두운 할부 중인 제천대성: 정교한 긴고아 · 봉황 깃 · 금 비늘 갑옷 · 펄럭이는 붉은 망토 · 손에 여의봉 · 근두운
    sunwukong: {
      back(g, a, c, t) {
        cape(this, a, t, '#c0282c', '#7e141c', '#e04a3a', '#f0c24a');
      },
      front(g, a, c, t) {
        const Gd = '#f0c24a', gd = '#a8761a', gh = '#fff0b0', R = '#c0282c';
        // 봉황 깃털 두 가닥
        for (const side of [-1, 1]) {
          for (let k = 0; k < 14; k++) {
            const x = a.hx + side * (2 + Math.round(k * 0.6 + Math.sin(t * 2 + k * 0.3) * (k / 10)));
            const y = a.top - 1 - Math.round(k * 0.9 - (k * k) / 40);
            this.px(x, y, k % 4 === 3 ? '#1a1a22' : k > 10 ? '#e06a2a' : '#b3222c');
          }
        }
        // 긴고아: 머리 둘레를 넘치게 두르는 세 줄 금테 (위 하이라이트 · 가운데 띠 · 아래 그림자)
        // 앞 가운데는 소용돌이 장식이 솟고, 가끔 빛이 테를 따라 돈다
        const y0 = a.top;
        const shine = Math.floor((t * 10) % 40) - 10;
        for (let x = a.left - 1; x <= a.right + 1; x++) {
          const edge = x === a.left - 1 || x === a.right + 1;
          const hot = Math.abs(x - a.left - shine) <= 0;
          this.px(x, y0, edge ? gd : hot ? '#ffffff' : gh);
          this.px(x, y0 + 1, edge ? gd : hot ? gh : (x - a.hx) % 3 === 0 ? gd : Gd);
          this.px(x, y0 + 2, gd);
        }
        this.pattern(['.GGG.', 'GgRgG', 'GRhRG', '.GgG.'], a.hx - 2, y0 - 2, { G: Gd, g: gd, R, h: '#ffe8e8' });
        // 금 비늘 갑옷
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (leg) return '#3a2a1a';
          if (Math.abs(dx) >= 5) return dy <= -2 ? R : gd;
          return (x + (y % 2)) % 2 ? Gd : gh;
        });
        if (!a.curled) this.pattern(['.R.', 'RGR', '.R.'], a.hx - 1, a.my + 2, { R, G: '#ffffff' });
        // 여의봉: 오른앞발로 세워 쥔다. 붉은 봉 양끝 금테
        const sx = a.right + 1;
        if (!a.curled) {
          for (let y = a.cy - 17; y <= GROUND - 1; y++) {
            const cap = y < a.cy - 14 || y > GROUND - 4;
            this.px(sx, y, cap ? Gd : '#c0282c');
            this.px(sx + 1, y, cap ? gd : '#7e141c');
          }
          heldPaw(this, g, sx, a.cy + 1);
          if (t % 2 < 0.2) star(this, sx, a.cy - 18, gh);
        } else {
          for (let x = a.right + 1; x <= a.right + 14; x++) { this.px(x, GROUND - 1, x < a.right + 4 || x > a.right + 11 ? Gd : R); }
        }
        // 근두운
        // 근두운은 바닥에 딱 붙어 있다 (위아래로 들썩이지 않고 구름결만 흐른다)
        const cy = GROUND - 1;
        for (let x = a.left - 5; x <= a.right + 5; x++) {
          const h = 1 + Math.round((Math.sin((x + t * 3) * 0.9) + 1) * 0.8);
          for (let j = 0; j < h; j++) this.px(x, cy - j + 1, j === h - 1 ? '#fff6c8' : '#f2d46a', false);
        }
        this.px(a.right + 6, cy, 'rgba(242,212,106,0.6)', false);
        this.px(a.left - 6, cy + 1, 'rgba(242,212,106,0.4)', false);
      },
    },

    // 7. 츄르신 내린 전투 무당: 흰 깃 전립 · 색동 소매 붉은 쾌자 · 왼손 방울 · 오른손 신칼(오방색 술) · 빙빙 도는 부적
    mudang: {
      front(g, a, c, t) {
        const R = '#c8202c', r2 = '#8a1420', Bk = '#1a1a22';
        this.pattern(['...WW..', '..W....', '.KKRKK.', 'KKKKKKK'], a.hx - 3, a.earTop - 2, { K: Bk, R, W: '#ffffff' });
        for (let x = a.hx - 8; x <= a.hx + 8; x++) this.px(x, a.earTop + 2, Math.abs(x - a.hx) === 8 ? Bk : '#2c2c38');
        const SD = ['#d8303b', '#f0c24a', '#3aa04a', '#2a6ad0', '#ffffff'];
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (leg) return '#f4f0e6';
          if (Math.abs(dx) >= 5) return SD[(y + 10) % 5];
          if (dx === 0) return '#2a6ad0';
          return Math.abs(dx) >= 4 ? r2 : R;
        });
        // 부적 세 장
        for (let i = 0; i < 3; i++) {
          const ang = t * 1.6 + (i * Math.PI * 2) / 3;
          const x = Math.round(a.hx + Math.cos(ang) * 13), y = Math.round(a.ey - 3 + Math.sin(ang) * 5);
          this.pattern(['YYY', 'YrY', 'rYr', 'YrY'], x - 1, y - 2, { Y: '#f6e27a', r: '#c8202c' }, Math.sin(ang) > 0);
        }
        if (a.curled) return;
        // 방울 (왼앞발): 금 방울 세 개가 흔들리며 울린다
        const ring = Math.floor(t * 8) % 2;
        const lx = a.left - 1;
        for (let y = a.cy - 3; y <= a.cy; y++) this.px(lx, y, '#8a5a2a');
        this.pattern(['Y.Y', '.Y.'], lx - 1 + (ring ? 1 : 0) - 1, a.cy - 6, { Y: '#f0c24a' });
        this.pattern(['YY', 'yy'], lx - 1 + ring, a.cy - 5, { Y: '#ffe07a', y: '#b8861a' });
        heldPaw(this, g, lx, a.cy + 1);
        // 신칼 (오른앞발): 은빛 날 · 나무 자루 · 자루 끝의 오방색 술이 휘날린다
        const sx = a.right + 1;
        for (let y = a.cy - 11; y <= a.cy - 3; y++) { this.px(sx, y, '#eef3fa'); this.px(sx + 1, y, y < a.cy - 9 ? null || '#eef3fa' : '#a8b6c8'); }
        this.px(sx, a.cy - 12, '#eef3fa');
        for (let d = -1; d <= 2; d++) this.px(sx + d, a.cy - 2, '#b8861a');
        this.px(sx, a.cy - 1, '#6b3f1a'); this.px(sx, a.cy, '#6b3f1a');
        const tas = ['#2a6ad0', '#d8303b', '#f0c24a', '#ffffff', '#3aa04a'];
        tas.forEach((col, i) => {
          for (let k = 0; k < 7; k++) {
            const x = sx + 1 + k + Math.round(Math.sin(t * 5 + k * 0.7 + i) * 0.6);
            const y = a.cy + 1 + Math.round((i - 2) * 0.6 + k * 0.3 + Math.sin(t * 4 + k + i) * 0.8);
            this.px(x, y, col);
          }
        });
        heldPaw(this, g, sx, a.cy + 1);
        const fl = t % 1.8 < 0.15;
        if (fl) this.px(sx, a.cy - 10, '#ffffff');
      },
    },

    // 8. 월요병 퇴마 엑소시스트: 수단과 로만 칼라 · 보라 영대 · 은 십자 · 등 뒤 불타는 십자가 · 금빛 결계 · 떠 있는 성경 · 번쩍이는 눈
    exorcist: {
      back(g, a, c, t) {
        // 불타는 십자가: 뒤에 크게. 나무 십자가가 불길에 휩싸이고 불똥이 튄다
        const cx = a.hx, top = a.earTop - 13, arm = a.earTop - 8;
        const Wd = '#3a1a0e', wd = '#5a2a14';
        // fireOut (0~1): '악마 강림' 모션이 불을 끄는 정도. 1 이면 까맣게 그을린 십자가에서 연기만 피어오른다
        const out = this.fireOut || 0;
        for (let y = top; y <= a.my; y++) for (let d = -1; d <= 1; d++) this.px(cx + d, y, d === 1 ? wd : Wd);
        for (let x = cx - 8; x <= cx + 8; x++) for (let d = 0; d <= 2; d++) this.px(x, arm + d, d === 2 ? wd : Wd);
        // 불길: 십자가 선을 따라 촘촘히 타오른다
        const pts = [];
        for (let y = top; y <= a.earTop; y += 2) pts.push([cx, y]);
        for (let x = cx - 8; x <= cx + 8; x += 2) pts.push([x, arm]);
        const fh = Math.round((1 - out) * 4);
        if (fh > 0) pts.forEach(([x, y], i) => flame(this, t, x, y + 1, 3, fh + (i % 3) * (1 - out), ['#fff6d0', '#ffd24a', '#ff8a1a', '#e8401a', 'rgba(200,30,20,0.7)'], i * 1.7));
        if (out < 0.3) rise(this, t, 12, cx - 12, cx + 12, arm + 2, 16, (i, p) => (i % 2 ? `rgba(255,200,60,${(1 - p).toFixed(2)})` : `rgba(255,90,30,${(1 - p).toFixed(2)})`), 0.7, 61);
        if (out > 0.2) {
          // 꺼진 자리: 그을린 불씨가 깜빡이고 회색 연기가 가늘게 피어오른다
          pts.forEach(([x, y], i) => { if (i % 2 === 0 && Math.floor(t * 4 + i) % 3 === 0) this.px(x, y, '#ff6a2a', false); });
          rise(this, t, 10, cx - 9, cx + 9, arm, 18, (i, p) => `rgba(150,145,155,${(out * 0.7 * (1 - p)).toFixed(2)})`, 0.35, 83);
        }
        // 떠 있는 성경
        const y = a.ey - 2 + bob(t, 0, 1.2);
        const pg = Math.floor(t * 3) % 2;
        this.pattern(['KKKKKKK', 'KWWKWWK', pg ? 'KWwKwWK' : 'KwWKWwK', 'KKKGKKK'], a.left - 9, y, { K: '#3a1a2a', W: '#fbf6e8', w: '#d8cfb8', G: '#e8b73a' }, false);
      },
      front(g, a, c, t) {
        const Bk = '#16161c', bk = '#2a2a34', W = '#ffffff', Pu = '#6a2a9a', Gd = '#e8b73a', Sv = '#dfe6f0';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (leg) return Bk;
          if (dy === -1 && Math.abs(dx) <= 1) return W;
          if (Math.abs(dx) === 3 || Math.abs(dx) === 4) return dy === 0 ? Gd : Pu;
          return Math.abs(dx) >= 6 ? bk : Bk;
        });
        skirt(this, a, c, [0, 1], (x) => (Math.abs(x - a.hx) === 3 || Math.abs(x - a.hx) === 4 ? Pu : Bk));
        this.pattern(['.S.', 'SSS', '.S.', '.S.'], a.hx - 1, a.my + 2, { S: Sv });
        // 눈: 주기적으로 금빛으로 타오른다
        if (t % 3 < 0.6) for (const x of [a.eyeL, a.eyeR]) { this.px(x, a.ey, '#ffd24a'); this.px(x + 1, a.ey, '#ffffff'); this.px(x, a.ey - 1, 'rgba(255,160,40,0.6)', false); }
        // 바닥에서 옅게 피어오르는 악마의 연기: 검보라 연기가 몇 가닥 느리게 올라가며 흩어진다
        for (let i = 0; i < 7; i++) {
          const p = (t * 0.22 + hash(i + 71)) % 1;
          const x0 = a.hx - 11 + Math.round(hash(i * 3 + 70) * 22);
          const x = x0 + Math.round(Math.sin(t * 1.4 + i * 2 + p * 5) * (1 + p * 2));
          const y = Math.round(GROUND - p * 9);
          const al = (0.42 * (1 - p)).toFixed(2);
          this.px(x, y, `rgba(60,20,70,${al})`, false);
          if (p < 0.6) this.px(x + 1, y, `rgba(110,30,60,${(al * 0.6).toFixed(2)})`, false);
        }
        for (let x = a.hx - 11; x <= a.hx + 11; x++) if (Math.sin(x * 1.7 + t * 1.3) > 0.2) this.px(x, GROUND, 'rgba(50,15,60,0.35)', false);
      },
    },
  };
  Object.assign(root.PetSprite.ACCESSORIES, LAB);
})(window);


// ================= 얼굴 1 =================
(function (root) {
  const { GROUND, sway, hash, rowsAt, cells, isBody, star } = root.PetSprite.costumeKit;

  // 머리 전체 + 입 둘레(턱 줄)까지 덮는 복면용. 숨 쉬며 늘어난 줄도 따라가게 도트 맵 줄(j)로 자른다. paint(dx, y, x, j) — j 0·1 은 귀
  const mask = (r, g, a, paint) => cells(r, g, a, (dx, y, x, leg, j) => (!isBody(a, dx, y) || (a.curled ? y <= a.my && Math.abs(dx) <= 6 : j <= a.my + 2 - a.earTop && Math.abs(dx) <= 5) ? paint(dx, y, x, j) : null));

  // 눈 칸 안쪽인지 (고양이 눈 2×2)
  const inEye = (a, x, y) => y >= a.ey && y < a.ey + a.eh && ((x >= a.eyeL && x < a.eyeL + a.ew) || (x >= a.eyeR && x < a.eyeR + a.ew));
  // 두 점 사이 직선 (브레젠험)
  function line(r, x0, y0, x1, y1, col) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, i = 0;
    for (;;) {
      const cc = typeof col === 'function' ? col(i++, x0, y0) : col;
      if (cc) r.px(x0, y0, cc, false);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }

  const LAB = {
    // 1. 파티 셔터 쉐이드: 네온 핑크 테에 가로 블라인드 살. 가끔 살 사이로 빛이 비스듬히 스친다
    shuttershades: {
      front(g, a, c, t) {
        const pu = 0.5 + 0.5 * Math.sin(t * 4);
        const m = { P: '#ff2e9a', p: pu > 0.5 ? '#ff8fd0' : '#ff6ab8', T: 'rgba(40,8,36,0.6)' };
        const x0 = a.eyeL - 2, y0 = a.ey - 2;
        this.pattern(['.PPPP.PPPP.', 'PTTTPpPTTTP', 'PppppPppppP', 'PTTTP.PTTTP', '.PPPP.PPPP.'], x0, y0, m);
        this.px(x0 - 1, y0 + 1, m.P); this.px(x0 + 11, y0 + 1, m.P);
        // 테 둘레 네온 번짐
        const gl = `rgba(255,46,154,${(0.12 + pu * 0.18).toFixed(2)})`;
        for (let x = x0; x <= x0 + 10; x++) { this.px(x, y0 - 1, gl, false); this.px(x, y0 + 5, gl, false); }
        // 빛 한 줄기가 살을 따라 비스듬히 스친다
        const s = (t % 2.6) / 0.55;
        if (s < 1) {
          const sx = x0 - 2 + Math.round(s * 15);
          for (let j = 0; j < 5; j++) {
            const x = sx - j;
            if (x < x0 || x > x0 + 10) continue;
            this.px(x, y0 + j, j % 2 ? 'rgba(255,255,255,0.55)' : '#ffffff');
          }
        }
      },
    },

    // 2. 용접 고글: 가죽 끈에 동그란 쇠테 렌즈 두 개, 어두운 초록 유리. 가끔 불꽃이 튀고 렌즈가 번쩍
    weldgoggles: {
      front(g, a, c, t) {
        const Br = '#6b4424', br = '#4a2c14';
        const ph = t % 2.4, arc = ph < 0.9;
        const flash = arc && Math.floor(t * 14) % 3 === 0;
        const m = { B: '#e0b050', b: '#8a6420', G: flash ? '#7aff9a' : '#1a3a22', g: flash ? '#d8ffe0' : '#2f7a42', H: '#e8fff0' };
        // 가죽 끈: 머리 양옆으로 나간다
        for (let x = a.left - 1; x <= a.right + 1; x++) { this.px(x, a.ey, Br); this.px(x, a.ey + 1, br); }
        // 놋쇠 테 둥근 렌즈 (5×5), 초록 유리 위쪽에 빛
        for (const cx of [a.eyeL, a.eyeR + 1]) this.pattern(['.bBb.', 'bgHgb', 'BGgGB', 'bGGGb', '.bBb.'], cx - 2, a.ey - 2, m);
        if (!arc) return;
        // 불꽃: 앞발 옆에서 튀어 올라 포물선으로 떨어진다
        const ox = a.right + 3, oy = a.curled ? GROUND - 1 : a.cy + 1;
        const on = Math.floor(t * 20) % 2;
        this.px(ox, oy, on ? '#ffffff' : '#bff4ff', false);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.px(ox + dx, oy + dy, `rgba(190,240,255,${on ? 0.7 : 0.35})`, false);
        const p = ph / 0.9, n = Math.floor(t / 2.4);
        for (let i = 0; i < 10; i++) {
          const vx = (hash(i + n * 9) - 0.3) * 16, vy = 4 + hash(i * 3 + n) * 8;
          const q = Math.min(1, p * (0.8 + hash(i * 5) * 0.5));
          const x = Math.round(ox + vx * q), y = Math.round(oy - vy * q + 16 * q * q);
          if (y > GROUND || q >= 1) continue;
          this.px(x, y, q < 0.3 ? '#ffffff' : q < 0.6 ? '#fff27a' : '#ffb02a', false);
          if (q < 0.5) this.px(Math.round(ox + vx * q * 0.8), Math.round(oy - vy * q * 0.8 + 16 * q * q * 0.64), 'rgba(255,230,120,0.5)', false);
        }
      },
    },

    // 3. 무지개 반사 스키 고글: 두 눈을 한 번에 덮는 넓은 렌즈에 무지개 미러가 흐르고, 머리 둘레로 밴드가 돈다
    skigoggles: {
      front(g, a, c, t) {
        const F = '#1a1a22', f = '#3a3a48';
        const x0 = a.fx - 6, y0 = a.ey - 2;
        // 밴드: 고글 옆으로 머리를 감싸고 나간다 (검정 바탕에 하늘색 줄)
        for (const x of [x0 - 1, x0 + 13]) { this.px(x, y0 + 1, '#3ef2ff'); this.px(x, y0 + 2, F); this.px(x, y0 + 3, F); }
        this.pattern(['.FFFFFFFFFFF.', 'F...........F', 'F...........F', 'F...........F', '.FFFFf.fFFFF.'], x0, y0, { F, f });
        for (let j = 1; j <= 3; j++)
          for (let i = 1; i <= 11; i++) {
            if (j === 3 && (i === 6)) continue;
            const h = (i * 22 + j * 34 - t * 110) % 360;
            const l = 52 + (j === 1 ? 14 : 0);
            this.px(x0 + i, y0 + j, `hsl(${((h % 360) + 360) % 360},95%,${l}%)`);
          }
        this.px(x0 + 6, y0 + 3, f);
        // 비스듬한 흰 반사 한 줄이 렌즈를 가로질러 흐른다
        const s = ((t * 0.8) % 1.6) * 10 - 2;
        for (let j = 1; j <= 3; j++) {
          const x = Math.round(s) + (3 - j);
          if (x >= 1 && x <= 11 && !(j === 3 && x === 6)) this.px(x0 + x, y0 + j, 'rgba(255,255,255,0.85)');
        }
        this.px(x0 + 2, y0 + 1, '#ffffff');
      },
    },


    // 5. 조종사 보잉 선글라스: 가는 금테 물방울 렌즈, 위는 진하고 아래는 옅은 그라데이션. 비스듬히 반짝
    aviators: {
      front(g, a, c, t) {
        const m = { G: '#ffd966', g: '#b8902a', D: '#17151c', M: '#34303c', L: '#6a6070', H: '#ffffff' };
        const x0 = a.fx - 5, y0 = a.ey - 1;
        this.pattern(['.GGGGgGGGG.', 'GDDDG.GDDDG', 'GMMMG.GMMMG', 'GLLG...GLLG', '.GG.....GG.'], x0, y0, m);
        this.px(x0 - 1, y0, m.g); this.px(x0 + 11, y0, m.g);
        // 반사 빛: 렌즈 위를 비스듬히 미끄러진다
        const s = (t % 3) / 0.5;
        for (const bx of [x0 + 1, x0 + 7]) {
          if (s < 1) {
            const k = Math.floor(s * 4);
            if (k < 3) { this.px(bx + 2 - k, y0 + 1 + k, '#ffffff'); if (k > 0) this.px(bx + 3 - k, y0 + k, 'rgba(255,255,255,0.5)'); }
          } else this.px(bx, y0 + 1, 'rgba(255,255,255,0.6)');
        }
        if (t % 3 > 2.55) star(this, x0 + 11, y0 - 1, '#fff2b0');
      },
    },

    // 6. 하회탈: 나무 양반탈. 결이 보이는 나뭇빛 얼굴에 이마 주름 세 줄, 초승달처럼 휜 웃는 눈과 눈 밑 웃음 주름,
    //    발그레한 볼, 입꼬리가 치켜 오른 함박웃음. 턱은 끈으로 따로 매달려 가끔 껄껄 들썩인다. 고양이 귀는 위로 보인다
    hahoe: {
      front(g, a, c, t) {
        const m = { o: '#5e3212', W: '#e8bc80', H: '#f8dcac', g: '#d6a468', w: '#c48c52', d: '#9e6a36', k: '#3a1c08', r: '#ea8a70', n: '#b27a42' };
        const x0 = a.fx - 5, y0 = a.ey - 2;
        const face = [
          '.ooooooooo.', // 이마 테
          'oHgdWdWdgWo', // 이마 주름 세 줄 · 나뭇결
          'oWkkWHWkkWo', // 초승달 눈 윗줄
          'okgdkWkdgko', // 눈꼬리 · 눈 밑 웃음 주름
          'owrWWnWWrwo', // 볼 · 코
          'okkWWnWWkko', // 입꼬리가 올라간 웃음
          '.ogkkkkkgo.', // 웃는 입 = 턱이 갈라지는 선
        ];
        const chin = ['..owwgwwo..', '...ooooo...'];
        if (a.curled) {
          // 식빵 자세: 이마 주름 줄을 빼고 한 줄 낮춘 납작한 탈, 턱은 바닥 위에 살짝
          this.pattern([face[0], face[2], face[3], face[4], face[5], face[6]], x0, y0, m);
          this.pattern([chin[0]], x0, Math.min(y0 + 6, GROUND - 1), m);
          return;
        }
        const nod = Math.floor(t * 1.2) % 4 === 0 ? 1 : 0; // 턱이 가끔 들썩 (껄껄)
        this.pattern(face, x0, y0, m);
        // 턱을 매단 끈 두 가닥 (들썩일 때만 보인다)
        if (nod) { this.px(x0 + 3, y0 + 7, m.d); this.px(x0 + 7, y0 + 7, m.d); }
        this.pattern(chin, x0, y0 + 7 + nod, m);
        // 이마 윤기
        if (t % 3.4 < 0.3) this.px(x0 + 2, y0 + 1, '#fff4dc');
      },
    },

    // 7. 각시탈: 하얗게 분칠한 얼굴에 가르마 탄 검은 머리선, 가늘게 뜬 긴 눈과 먹선 눈썹, 이마의 곤지 · 두 볼의 연지,
    //    앵두 같은 작은 입술. 옆으로 옅은 그늘이 져 둥근 얼굴이 도드라진다
    gaksital: {
      front(g, a, c, t) {
        const m = { o: '#8a7e70', W: '#fcf9f2', w: '#ece4d6', s: '#d8ccbc', H: '#141418', h: '#3c3c4c', R: '#e0283a', r: '#f7b0b4', b: '#4a3a3a', k: '#241a1a', L: '#c81e30' };
        const x0 = a.fx - 5;
        const hair = ['..HHHhHHH..', '.HHHhWhHHH.'];
        const face = [
          'oHWWWRWWWHo', // 머리선 · 곤지
          'owbbWWWbbwo', // 가는 먹선 눈썹
          'okkkWWWkkko', // 가늘고 긴 눈
          'owRWWsWWRwo', // 연지 · 콧날 그늘
          '.osWWLWWso.', // 작은 입술
          '..osssss o..'.replace(' ', ''),
        ];
        const rows = a.curled ? [hair[1], ...face] : [...hair, ...face];
        const y0 = a.curled ? a.ey - 2 : a.ey - 3;
        this.pattern(rows, x0, y0, m);
        const fy = y0 + (a.curled ? 1 : 2); // 머리선 줄
        // 눈꼬리가 살짝 올라간다
        this.px(x0 + 1, fy + 1, m.k); this.px(x0 + 9, fy + 1, m.k);
        // 연지가 가끔 발그레 번진다
        if (Math.floor(t * 1.5) % 5 === 0) for (const dx of [1, 3, 7, 9]) this.px(x0 + dx, fy + 3, m.r);
        // 머리 윤기가 가르마를 따라 반짝
        if (t % 3 < 0.25) this.px(x0 + (a.curled ? 4 : 5), y0, '#8a8aa0');
      },
    },

    // 8. 여우 축제 가면: 흰 여우 가면을 머리 옆에 비스듬히 걸쳤다. 뾰족한 귀 테두리 안은 붉게, 이마엔 붉은 불꽃 무늬,
    //    눈매는 붉게 치켜 올라가고 입가는 붉은 선. 붉은 끈이 이마를 가로지르고, 귀 옆에 금 방울 달린 붉은 술이 달랑
    foxmask: {
      front(g, a, c, t) {
        const m = { o: '#6e645c', W: '#fffdf8', w: '#e4dccf', R: '#e0283a', r: '#a8141e', K: '#1a1a1e', G: '#ffd24a', g: '#c8961a' };
        // 붉은 끈: 왼쪽 관자놀이에서 이마를 비스듬히 넘어 가면 쪽으로 (웅크리면 한 줄 짧게)
        let x = a.left - 1, y = a.curled ? a.ey - 1 : a.ey;
        while (x < a.eyeR - 1) { this.px(x, y, (x + y) % 3 ? m.R : m.r); x++; if ((x - a.left) % 3 === 0 && y > a.top + 1) y--; }
        const x0 = a.eyeR - 2, y0 = a.top - 4;
        const rows = [
          'o.......o',
          'oo.....oo',
          'oRo...oRo', // 귀: 흰 테 안쪽이 붉다
          'oRWoooWRo',
          'oWWWRWWWo', // 이마 불꽃
          'owRWRWRwo',
          'oRRKWKRRo', // 붉게 치켜 오른 눈매와 가는 눈구멍
          '.owWWWwo.',
          '..owRwo..', // 입가 붉은 선
          '...oKo...', // 코끝
          '....o....',
        ];
        // 오른쪽으로 기울여 걸친다 (위는 오른쪽, 아래는 왼쪽으로 한 칸씩)
        rowsAt(this, rows, x0, y0, m, [1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1]);
        // 금 방울 달린 붉은 술: 오른쪽 귀밑에서 달랑달랑
        const s = sway(t, 3, 1);
        const tx = x0 + 9, ty = y0 + 4;
        this.px(tx, ty, m.R);
        this.px(tx + (s > 0 ? 1 : 0), ty + 1, m.R);
        this.pattern(['.G.', 'GgG'], tx - 1 + s, ty + 2, m);
        for (const dx of [-1, 0, 1]) { this.px(tx + s + dx, ty + 4, m.R); this.px(tx + s + dx, ty + 5, dx === 0 ? m.r : m.R); }
        this.px(tx + s, ty + 6, m.r);
        if (t % 2.8 < 0.2) this.px(x0 + 3, y0 + 4, '#ffffff');
      },
    },

    // 10. 루차 레슬러 마스크: 머리 전체를 감싼 빨강 마스크에 금 불꽃 무늬, 눈 · 입 둘레 흰 테. 금 무늬에 빛이 흐른다
    luchamask: {
      front(g, a, c, t) {
        const Rd = '#d8202c', rd = '#9a1420', Gd = '#ffd23f', gd = '#d89a1a', W = '#ffffff';
        const shine = Math.floor(t * 8) % 16;
        const gold = (x, y) => ((x + y + 32 - shine) % 16 === 0 ? '#fffbe0' : Gd);
        mask(this, g, a, (dx, y, x, j) => {
          const adx = Math.abs(dx), ex = x - a.fx;
          if (inEye(a, x, y)) return null;
          if (y >= a.my + 1 && Math.abs(ex) <= 1) return null; // 입 구멍
          if ((y >= a.my + 1 && Math.abs(ex) === 2) || (y === a.my && Math.abs(ex) <= 1)) return W; // 입 둘레 흰 테
          if (j === 0) return gold(x, y);
          if (j <= 1) return Rd;
          // 눈 둘레 흰 테: 위와 바깥쪽을 감싼다
          const inL = x >= a.eyeL - 1 && x <= a.eyeL + a.ew - 1, inR = x >= a.eyeR && x <= a.eyeR + a.ew;
          if (y === a.ey - 1 && (inL || inR)) return W;
          if (y >= a.ey - 1 && y < a.ey + a.eh && (x === a.eyeL - 1 || x === a.eyeR + a.ew)) return W;
          if (y === a.ey + a.eh && (x === a.eyeL - 1 || x === a.eyeR + a.ew)) return gold(x, y);
          // 금 불꽃: 이마 가운데 줄기와 흰 테 위로 솟는 불꽃
          if (dx === 0 && y < a.ey + a.eh) return gold(x, y);
          if (y === a.ey - 2 && (adx === 2 || adx === 3)) return gold(x, y);
          if (y === a.ey - 3 && adx === 1) return gold(x, y);
          if (adx >= 5) return (y + Math.floor(t * 3)) % 3 ? rd : gd;
          return Rd;
        });
        if (t % 2.2 < 0.3) star(this, a.right + 1, a.top - 1, '#ffe07a');
      },
    },

    // 11. 방독면: 올리브 고무에 둥근 렌즈 두 개, 입 앞 정화통. 숨 쉴 때마다 렌즈에 김이 서렸다 걷힌다
    gasmask: {
      front(g, a, c, t) {
        const m = { O: '#5e6b3c', o: '#3c4726', K: '#1c1e18', G: '#9fc2ba', g: '#5a7a74', F: 'rgba(235,245,240,0.8)', H: '#ffffff', S: '#9aa0a6', s: '#5e646a', d: '#3a3e44' };
        // 머리끈: 양옆에서 귀 뒤로 넘어간다
        for (const sd of [-1, 1]) {
          const ex = sd < 0 ? a.left : a.right;
          this.px(ex, a.ey - 1, m.o); this.px(ex, a.ey - 2, m.o); this.px(ex - sd, a.ey - 3, m.o); this.px(ex - sd, a.top, m.o);
        }
        const x0 = a.fx - 5, y0 = a.ey - 1;
        this.pattern(['.OOOOOOOOO.', 'OKKKOOOKKKO', 'OKGKOOOKGKO', 'OKKKOoOKKKO', '.OOOOoOOOO.'], x0, y0, m);
        // 유리: 숨 쉴 때 김이 서린다
        const br = (Math.sin(t * 2.4) + 1) / 2;
        for (const lx of [x0 + 1, x0 + 7]) {
          this.rect(lx, y0 + 1, 3, 3, m.g);
          this.px(lx, y0 + 1, m.G); this.px(lx + 1, y0 + 1, m.G); this.px(lx, y0 + 2, m.G);
          if (br > 0.55) for (let i = 0; i < 3; i++) this.px(lx + i, y0 + 3, m.F, false);
          if (br > 0.8) for (let i = 0; i < 3; i++) this.px(lx + i, y0 + 2, 'rgba(235,245,240,0.55)', false);
          if (t % 3 < 0.2) this.px(lx, y0 + 1, m.H);
        }
        // 정화통: 입 앞에 둥근 캔 (골 무늬)
        this.pattern(['.ooo.', 'dSSSd', 'sSsSs', 'dSSSd', '.sss.'], a.fx - 2, a.my + 1, m);
        this.px(a.fx - 1, a.my + 2, '#d0d6dc');
      },
    },

    // 12. 강도 복면: 검정 니트가 머리를 통째로 덮고 눈 구멍만 뚫렸다. 골지 무늬, 눈 구멍 테는 한 코 밝다
    robbermask: {
      front(g, a, c, t) {
        const B = '#1c1c22', b = '#2c2c38', e = '#50506a';
        const hole = (x, y) => y >= a.ey && y < a.ey + a.eh && x >= a.eyeL - 1 && x <= a.eyeR + a.ew;
        mask(this, g, a, (dx, y, x, j) => {
          if (hole(x, y)) return null;
          if ((y === a.ey - 1 || y === a.ey + a.eh) && x >= a.eyeL - 1 && x <= a.eyeR + a.ew) return e;
          return (x + (j <= 1 ? 1 : 0)) % 2 ? B : b;
        });
        // 눈알이 좌우로 두리번 (흰자 한 칸)
        const look = Math.floor(t * 0.8) % 3;
        if (look !== 1) for (const x of [a.eyeL, a.eyeR]) this.px(look === 0 ? x - 1 : x + a.ew, a.ey, '#f4f4f4');
      },
    },

    // 13. 오페라의 유령 반가면: 얼굴 오른쪽 절반(보는 쪽 왼편)을 덮는 매끈한 흰 가면. 광택이 천천히 흐른다
    phantommask: {
      front(g, a, c, t) {
        const m = { o: '#7e7e88', W: '#fdfdfb', w: '#d6d6d0', s: '#b0b0ac' };
        const x0 = a.fx - 5, y0 = a.ey - 2;
        // 얼굴 오른쪽 절반: 이마에서 코 옆 · 광대까지. 눈 구멍 안쪽엔 옅은 그림자
        this.pattern(['.WWWWo', 'WWWWWo', 'Ws..wo', 'Ws..wo', 'WWwwwo', '.Wwwo.', '..oo..'], x0, y0, m);
        // 광택이 이마에서 볼로 천천히 흐른다
        const s = (t % 3.5) / 0.9;
        if (s < 1) { const pts = [[1, 0], [1, 1], [0, 4], [1, 4]]; const q = pts[Math.floor(s * 4)]; this.px(x0 + q[0], y0 + q[1], '#ffffff'); }
      },
    },

    // 14. 도깨비 탈: 붉은 얼굴에 두 뿔, 부리부리한 노란 눈, 굵은 눈썹, 이빨 드러낸 큰 입. 눈알이 데굴데굴
    dokkaebimask: {
      front(g, a, c, t) {
        const m = { h: '#fff0c4', H: '#c89a48', o: '#4a0a08', R: '#d42a22', r: '#9a1812', Y: '#ffd23f', k: '#141210', B: '#1e2a20', M: '#3a0606', T: '#ffffff', n: '#6a0e0a' };
        const x0 = a.fx - 6, y0 = a.top - 5;
        const look = Math.round(Math.sin(t * 1.8));
        this.pattern([
          '..h.......h..',
          '..hH.....Hh..',
          '...hH...Hh...',
          '...hH...Hh...',
          '...hH...Hh...',
          '.ooRRRRRRRoo.',
          'oRBBBRRRBBBRo',
          'oRYYYRRRYYYRo',
          'oRYYYRrRYYYRo',
          'orRRRnRnRRRro',
          'oRTMMMMMMMTRo',
          'orMTTTTTTTMro',
          '.orrrrrrrrro.',
          '..ooooooooo..',
        ], x0, y0, m);
        for (const ex of [x0 + 3, x0 + 9]) this.px(ex + look, y0 + 7 + (look === 0 ? 1 : 0), m.k);
        if (Math.floor(t * 2) % 5 === 0) for (const ex of [x0 + 2, x0 + 8]) this.rect(ex, y0 + 7, 3, 1, m.R); // 끔뻑
      },
    },

    // 15. 반짝 별눈: 눈이 노란 별이 되어 두근두근 커졌다 작아지고, 둘레에 반짝이가 톡톡 터진다
    stareyes: {
      front(g, a, c, t) {
        const beat = Math.floor(t * 2.5) % 4;
        const m = { Y: beat === 0 ? '#fff27a' : '#ffd83a', y: '#ffb01a', W: '#ffffff', K: '#6a3208' };
        const BIG = ['...K...', '..KYK..', 'KKYYYKK', 'KyYWYyK', '.KYYYK.', '.KyKyK.', '.KK.KK.'];
        const SMALL = ['..K..', '.KYK.', 'KYWYK', '.KYK.', '..K..'];
        for (const cx of [a.eyeL, a.eyeR + 1]) {
          if (beat !== 3) this.pattern(BIG, cx - 3, a.ey - 3, m);
          else this.pattern(SMALL, cx - 2, a.ey - 1, m);
        }
        // 둘레에 반짝이가 톡톡
        for (let i = 0; i < 3; i++) {
          const k = Math.floor(t * 0.9 + i / 3), p = (t * 0.9 + i / 3) % 1;
          if (p > 0.35) continue;
          const x = a.fx + Math.round((hash(i + k * 3) - 0.5) * 22);
          const y = a.ey - 3 - Math.round(hash(i * 7 + k) * 5);
          if (p < 0.12 || p > 0.28) this.px(x, y, '#ffffff', false); else star(this, x, y, '#ffe36a');
        }
      },
    },


    // 17. 밈 레이저 눈: 눈이 새빨갛게 달아오르고 가로 렌즈 플레어, 빨간 레이저가 앞 바닥으로 쭉 뻗어 번쩍인다
    lasereyes: {
      front(g, a, c, t) {
        const pu = 0.5 + 0.5 * Math.sin(t * 9);
        const burst = t % 1.8 < 0.15;
        // 가로 렌즈 플레어
        for (const cx of [a.eyeL, a.eyeR]) {
          for (let d = 1; d <= 5; d++) {
            const al = (0.45 - d * 0.08) * (0.6 + pu * 0.4);
            this.px(cx - d, a.ey, `rgba(255,40,40,${al.toFixed(2)})`, false);
            this.px(cx + a.ew - 1 + d, a.ey, `rgba(255,40,40,${al.toFixed(2)})`, false);
          }
          for (const [dx, dy] of [[-1, -1], [a.ew, -1], [-1, a.eh], [a.ew, a.eh], [0, -1], [1, -1], [0, a.eh], [1, a.eh]]) this.px(cx + dx, a.ey + dy, `rgba(255,60,40,${(0.35 + pu * 0.3).toFixed(2)})`, false);
          this.rect(cx, a.ey, a.ew, a.eh, '#ff2a1a');
          this.px(cx, a.ey, burst ? '#ffffff' : '#ffd0c0');
        }
        // 레이저 빔: 두 눈에서 양옆 아래 바닥으로 V자로 쭉. 가운데는 흰 심, 옆은 붉은 번짐, 빛 덩어리가 빔을 타고 흐른다
        const hot = pu > 0.5 ? '#ff5a4a' : '#ff2a1a';
        for (const [ex, tx] of [[a.eyeL, a.left - 9], [a.eyeR + a.ew - 1, a.right + 9]]) {
          line(this, ex, a.ey + a.eh, tx, GROUND, (i) => (i < 1 ? null : burst || (i + Math.floor(t * 24)) % 6 === 0 ? '#ffffff' : hot));
          line(this, ex + (tx < ex ? 1 : -1), a.ey + a.eh, tx + (tx < ex ? 1 : -1), GROUND, (i) => (i < 2 ? null : `rgba(255,50,40,${(0.25 + pu * 0.2).toFixed(2)})`));
          // 바닥에 탄 자국과 불티
          for (let dx = -2; dx <= 2; dx++) this.px(tx + dx, GROUND + 1, `rgba(255,${120 + Math.round(pu * 100)},40,${(0.6 - Math.abs(dx) * 0.15).toFixed(2)})`, false);
          for (let i = 0; i < 3; i++) {
            const k = Math.floor(t * 1.6 + i / 3), p = (t * 1.6 + i / 3) % 1;
            this.px(tx + Math.round((hash(i + k + ex) - 0.5) * 5), GROUND - Math.round(p * 5), p < 0.5 ? '#ffe36a' : '#ff6a2a', false);
          }
        }
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, LAB);
})(window);


// ================= 얼굴 2 =================
(function (root) {
  const { GROUND, hash, cells, star } = root.PetSprite.costumeKit;
  // 두 색을 k 만큼 섞는다 (#rrggbb)
  const mix = (c1, c2, k) => {
    const p = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
    return '#' + [0, 1, 2].map((i) => Math.round(p(c1, i) * (1 - k) + p(c2, i) * k).toString(16).padStart(2, '0')).join('');
  };

  // 눈을 뜨고 있을 때만 눈동자를 바꿔 그린다 (깜빡·감은 눈·^^ 는 원래 그림 그대로)
  const OPEN = new Set(['open', 'wide', 'sparkle', 'teary']);
  const eyeOpen = (g, side) => {
    const k = g.p && g.p.eyes;
    if (k === 'wink') return side < 0;
    return !k || OPEN.has(k);
  };
  const eyeX = (a, side) => (side < 0 ? a.eyeL : a.eyeR);
  // 눈 한가운데 열 (왼눈은 왼쪽 칸, 오른눈은 오른쪽 칸 — 둘이 얼굴 가운데를 두고 대칭)
  const eyeC = (a, side) => (side < 0 ? a.eyeL : a.eyeR + a.ew - 1);
  const rgba = (r, g, b, al) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, al)).toFixed(2)})`;

  const LAB = {
    // 1. 터미네이터 LED 눈: 오른눈 둘레에 리벳 박힌 금속 판, 빨간 LED 가 맥박처럼
    cybereye: {
      front(g, a, c, t) {
        const x0 = a.eyeR - 1, y0 = a.ey - 2;
        this.pattern(
          ['.dHHHd', 'dHMMrd', 'M..MMd', 'm..Mrd', 'dMrMmd', '.ddmd.'],
          x0, y0,
          { M: '#a9b1bd', m: '#78808e', H: '#dfe5ec', r: '#454b56', d: '#5a616e' },
        );
        // 판 가장자리 찢어진 털 자국
        this.px(x0 - 1, a.ey - 1, '#5a616e');
        this.px(x0 - 1, a.ey + 2, '#78808e');
        const p = 0.5 + 0.5 * Math.sin(t * 4.2);
        const on = eyeOpen(g, 1);
        const ex = a.eyeR, ey = a.ey;
        if (on) {
          const core = p > 0.45 ? '#ff2a18' : '#c0140c';
          this.rect(ex, ey, a.ew, a.eh, core);
          this.px(ex + a.ew - 1, ey + a.eh - 1, '#8a0a06');
          this.px(ex, ey, p > 0.6 ? '#ffe0d0' : '#ff7a60');
          // 소켓 둘레로 번지는 붉은 빛
          const al = 0.18 + 0.42 * p;
          for (const [dx, dy] of [[-1, 0], [-1, 1], [a.ew, 0], [a.ew, 1], [0, -1], [1, -1], [0, a.eh], [1, a.eh]]) this.px(ex + dx, ey + dy, rgba(255, 40, 20, al), false);
          if (p > 0.7) for (const [dx, dy] of [[-2, 0], [a.ew + 1, 1], [0, -2], [1, a.eh + 1]]) this.px(ex + dx, ey + dy, rgba(255, 60, 30, (p - 0.7) * 1.2), false);
        } else {
          this.rect(ex, ey, a.ew, a.eh, '#2a0a08');
          this.px(ex, ey + a.eh - 1, '#6a100a');
        }
        // 4초마다 조준선이 눈앞을 한 번 훑는다
        const s = t % 4;
        if (on && s < 0.5) {
          const x = ex + a.ew + 1 + Math.round(s * 10);
          this.px(x, ey, rgba(255, 50, 30, 0.8 - s), false);
          this.px(x, ey + 1, rgba(255, 50, 30, 0.5 - s * 0.6), false);
        }
      },
    },

    // 3. Claude 스타버스트 눈동자: 눈이 주황 ✳ 로. 천천히 반짝이며 빛살이 바뀐다
    claudeeyes: {
      front(g, a, c, t) {
        // 진한 Claude 주황 빛살 8개, 가운데는 크림빛. 가끔 + 모양으로 바뀌며 가운데가 번쩍
        const star8 = ['O.O.O', '.OCO.', 'OCWCO', '.OCO.', 'O.O.O'];
        const plus = ['..O..', '..O..', 'OOWOO', '..O..', '..O..'];
        for (const side of [-1, 1]) {
          if (!eyeOpen(g, side)) continue;
          const ph = (t * 0.8 + (side < 0 ? 0 : 0.15)) % 2;
          const big = ph < 1.4;
          const flash = ph > 1.25 && ph < 1.55;
          const cx = eyeC(a, side), cy = a.ey + (a.eh > 1 ? 1 : 0) - 1;
          this.pattern(big ? star8 : plus, cx - 2, cy - 1, { O: '#b8401c', C: '#d95f34', W: flash ? '#ffffff' : '#ffe6d2' });
          if (flash) {
            this.px(cx, cy - 3 + 1, 'rgba(255,220,190,0.7)', false);
            this.px(cx, cy + 4 - 1, 'rgba(255,220,190,0.7)', false);
            this.px(cx - 3, cy + 1, 'rgba(255,220,190,0.7)', false);
            this.px(cx + 3, cy + 1, 'rgba(255,220,190,0.7)', false);
          }
        }
      },
    },

    // 7. 풍선껌: 입에서 분홍 풍선이 점점 부풀다 펑! 터지고 다시 (3초 주기)
    bubblegum: {
      front(g, a, c, t) {
        const T = 3, s = t % T;
        const Pk = '#ff94c6', pk = '#ff6fae', hi = '#ffd6ea', ol = '#d94a8a';
        const cx = a.fx + 0.5;
        if (s < 0.35) {
          // 오물오물 씹는 중
          this.px(a.fx, a.my + 2, Math.floor(s * 12) % 2 ? Pk : pk);
          return;
        }
        if (s < 2.45) {
          const k = (s - 0.35) / 2.1;
          const r = 0.9 + 3.3 * (1 - (1 - k) * (1 - k));
          const cy = a.my + 1.6 + r * 0.35;
          this.ellipse(cx, cy, r, r * 0.85, (x, y) => {
            const nx = x + 0.5 - cx, ny = y + 0.5 - cy;
            if (nx < -r * 0.25 && ny < -r * 0.25) return hi;
            if (nx > r * 0.3 && ny > r * 0.2) return pk;
            return Pk;
          }, r > 1.5 ? ol : null);
          if (r > 2) this.px(Math.round(cx - r * 0.45), Math.round(cy - r * 0.45), '#ffffff');
          // 터지기 직전 부들부들
          if (k > 0.9) this.px(Math.round(cx + r + 1), Math.round(cy - 1), 'rgba(255,255,255,0.8)', false);
          return;
        }
        // 펑! 조각이 사방으로 튀고 얼굴에 붙는다
        const k = (s - 2.45) / (T - 2.45);
        const cy = a.my + 2.5;
        if (k < 0.45) {
          const R = 3 + k * 6;
          for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * Math.PI * 2 + 0.3;
            this.px(Math.round(cx + Math.cos(ang) * R), Math.round(cy + Math.sin(ang) * R * 0.8), i % 2 ? Pk : pk, false);
          }
          if (k < 0.15) this.pattern(['W.W', '.W.', 'W.W'], a.fx - 1, a.my + 1, { W: '#ffffff' }, false);
        }
        // 얼굴에 붙은 껌 (코·볼·입)
        for (const [dx, dy] of [[-1, 1], [0, 1], [1, 1], [0, 2], [-3, 0], [-4, 1], [3, 0], [4, 1], [2, -1], [-2, 2]]) this.px(a.fx + dx, a.my + dy, (dx + dy) % 2 ? Pk : pk);
      },
    },

    // 8. 뻐드렁 토끼 이빨: 입 아래로 하얀 앞니 두 개. 가끔 오독오독
    buckteeth: {
      front(g, a, c, t) {
        const s = t % 2.6;
        const up = s < 0.5 && Math.floor(s * 10) % 2 ? 1 : 0;
        this.pattern(['KWKWK', 'KWKWK', 'KwKwK', '.K.K.'], a.fx - 2, a.my + 2 - up, { K: c.K, W: '#ffffff', w: '#e6ded0', g: '#c9c0b4' });
        if (up) this.px(a.fx - 3, a.my + 2, 'rgba(255,255,255,0.7)', false);
        if (s > 1.4 && s < 1.6) this.px(a.fx - 1, a.my + 2, '#fffbd0');
      },
    },

    // 9. 코피 주륵: 콧구멍에서 빨간 코피가 주르륵 흐르다 똑 떨어진다 (하찮게)
    nosebleed: {
      front(g, a, c, t) {
        const R = '#d8141e', h = '#ff5a5a';
        const T = 3.2, s = t % T;
        const x = a.fx - 1;
        this.px(x, a.my, R);
        const len = Math.min(4, Math.floor((s / 1.8) * 5));
        for (let i = 1; i <= len; i++) this.px(x - 1, a.my + i, i === len ? h : R);
        if (len >= 1) this.px(x - 1, a.my, R);
        // 방울이 떨어져 바닥에 톡
        if (s > 1.8 && s < 2.5) {
          const k = (s - 1.8) / 0.7;
          const y0 = a.my + 5;
          this.px(x - 1, Math.round(y0 + k * k * (GROUND - y0)), R, false);
        }
        // 바닥 자국은 조금씩 커진다
        const pool = s > 2.5 ? 2 : 1;
        for (let i = 0; i < pool; i++) this.px(x - 1 + i, GROUND, 'rgba(200,20,30,0.75)', false);
        // 반대쪽은 한 방울만 찔끔
        if (s > 1 ) this.px(a.fx + 1, a.my + 1, s > 2 ? R : 'rgba(216,20,30,0.6)');
      },
    },

    // 12. 산신령 흰 수염: 턱 아래로 길게 늘어진 흰 수염에 흰 콧수염·눈썹. 바람에 살랑
    sagebeard: {
      front(g, a, c, t) {
        const W = '#fbfbf5', s = '#e0e0d6', d = '#b8b8ae', o = '#8e8e86';
        const y0 = a.my + 1;
        const bottom = a.curled ? GROUND - 1 : GROUND;
        const widths = [3, 4, 4, 3, 2, 1, 1];
        for (let y = y0; y <= bottom; y++) {
          const k = y - y0;
          const w = widths[Math.min(k, widths.length - 1)];
          const off = Math.round(Math.sin(t * 1.8 - k * 0.7) * k * 0.28);
          for (let dx = -w; dx <= w; dx++) {
            const x = a.fx + dx + off;
            const edge = Math.abs(dx) === w;
            const strand = (dx + k + 20) % 3 === 0;
            this.px(x, y, edge ? o : strand ? s : dx < 0 ? W : k > 2 ? d : W);
          }
        }
        this.px(a.fx + Math.round(Math.sin(t * 1.8 - 6 * 0.7) * 6 * 0.28), bottom + 1, o);
        // 콧수염: 코 양옆에서 아래로 흘러내린다
        this.pattern(['WWs.', 'sWWW', '...W'], a.fx - 4, a.my, { W, s });
        this.pattern(['.sWW', 'WWWs', 'W...'], a.fx + 1, a.my, { W, s });
        this.px(a.fx, a.my, c.K);
        // 덥수룩 흰 눈썹 (바깥으로 처진다)
        this.pattern(['WWW', 's..'], a.eyeL - 1, a.ey - 2, { W, s });
        this.pattern(['WWW', '..s'], a.eyeR, a.ey - 2, { W, s });
      },
    },

    // 13. 군인 위장 페인트: 눈 밑 검정 줄, 볼과 이마에 초록·갈색 줄무늬
    camopaint: {
      front(g, a, c, t) {
        const G = '#4f7f30', gd = '#2f5220', B = '#1a1e14', Br = '#6e5a2c';
        for (const side of [-1, 1]) {
          const x = eyeX(a, side);
          // 눈 밑 검정 (바깥쪽으로 한 칸 더)
          for (let i = 0; i < a.ew; i++) this.px(x + i, a.my, B);
          // 볼 줄무늬 (바깥쪽 아래로 비스듬히)
          const ox = side < 0 ? x - 1 : x + a.ew;
          this.px(ox, a.my + 1, G); this.px(ox + side, a.my + 1, G); this.px(ox + side * 2, a.my, gd);
          this.px(ox - side, a.my + 2, gd); this.px(ox, a.my + 2, G);
          this.px(ox + side * 2, a.ey, Br); this.px(ox + side * 2, a.ey + 1, Br);
        }
        // 이마: 비스듬한 초록·검정 두 줄
        this.pattern(['...GG', '.GGB.', 'GBB..', 'B....'], a.fx - 3, a.ey - 3, { G, B });
        this.pattern(['Br', 'G.'], a.fx + 2, a.ey - 3, { B: Br, r: Br, G: gd });
      },
    },

    // 16. 물안경 자국 탄 얼굴: 얼굴은 까맣게 탔는데 물안경 자리만 원래 색, 둘레에 하얀 테 자국
    goggletan: {
      front(g, a, c, t) {
        const T = '#8a5230', Td = '#6e3e22', Tl = '#a0643c';
        const Wm = '#fff2e2';
        // 물안경 렌즈 자리 (눈 둘레 4×4, 모서리 뺀 것) 는 원래 털색, 그 바깥 한 칸 테는 하얀 자국
        const lens = (x, y) => [-1, 1].some((side) => {
          const dx = x - (eyeX(a, side) - 1), dy = y - (a.ey - 1);
          if (dx < 0 || dx > a.ew + 1 || dy < 0 || dy > a.eh + 1) return false;
          return !((dx === 0 || dx === a.ew + 1) && (dy === 0 || dy === a.eh + 1));
        });
        const rim = (x, y) => !lens(x, y) && (lens(x - 1, y) || lens(x + 1, y) || lens(x, y - 1) || lens(x, y + 1));
        // 끈 자국: 눈 줄을 따라 머리 양옆으로
        const strap = (x, y) => y === a.ey && (x < a.eyeL - 1 || x > a.eyeR + a.ew);
        cells(this, g, a, (dx, y, x) => {
          if (lens(x, y)) return null;
          if (rim(x, y) || strap(x, y)) return Wm;
          return Math.abs(dx) >= 5 ? Td : y <= a.top ? Tl : T;
        });
        // 눈·코·입은 다시 그 위에
        this.drawFace(g);
        // 반짝이는 땀 한 방울 (뜨거운 여름)
        if (t % 3 < 1.2) this.px(a.right, a.top + 1 + Math.floor((t % 3) * 3), '#bfe6ff', false);
      },
    },
  };
  Object.assign(root.PetSprite.ACCESSORIES, LAB);
})(window);


// ================= 몸 =================
(function (root) {
  const { GROUND, sway, hash, wear, skirt, star } = root.PetSprite.costumeKit;

  // 몸 양옆으로 w 칸 부풀린다 (롱패딩·퍼프 소매·어깨 판). col(s, i, y) → 색, 바깥은 외곽선
  function bulge(r, a, c, y0, y1, w, col) {
    for (const s of [-1, 1]) {
      const edge = s < 0 ? a.left : a.right;
      for (let y = y0; y <= y1; y++) {
        for (let i = 0; i < w; i++) r.px(edge + s * i, y, col(s, i, y));
        r.px(edge + s * w, y, c.K);
      }
      for (let i = 1; i < w; i++) { r.px(edge + s * i, y0 - 1, c.K); r.px(edge + s * i, y1 + 1, c.K); }
    }
  }

  const LAB = {
    // 신입 사원증 목걸이 셔츠: 흰 셔츠 칼라 + 파란 넥타이, 빨간 목줄에 매달린 사원증이 살랑
    idcardshirt: {
      front(g, a, c, t) {
        const W = '#fbfbf6', w = '#d6dbe6', B = '#3d7fe0', b = '#2a5cb0', Rd = '#e0404a';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#353a48';
          if (a.curled) return adx >= 5 ? w : W;
          if (dx === 0 && dy >= -1) return dy === 0 ? B : b; // 넥타이
          if (dy === -2 && adx <= 3) return W; // 칼라
          if (dy === -1 && adx === 1) return w; // 칼라 끝 그림자
          return adx >= 5 ? w : W;
        });
        const card = { B, W: '#cfe6ff', p: '#f2b27a', w: '#5a6a88' };
        if (a.curled) { this.pattern(['BBB', 'WpW', 'Www'], a.right + 2, GROUND - 3, card); return; }
        // 사원증: V자 빨간 목줄 끝, 넥타이 매듭 아래 가슴에 매달려 살랑 흔들린다
        const s = Math.round(Math.sin(t * 2.6) * 0.6);
        for (const k of [-1, 1]) { this.px(a.hx + k * 3, a.my + 1, Rd); this.px(a.hx + k * 2, a.my + 2, Rd); }
        this.pattern(['BBB', 'WpW', 'BwB'], a.hx - 1 + s, a.my + 3, card);
        this.px(a.hx + s, a.my + 3, '#c8ccd6'); // 클립
        if (t % 3 < 0.2) this.px(a.hx + 1 + s, a.my + 4, '#ffffff'); // 카드 반짝
      },
    },

    // 검정 터틀넥: 턱 밑까지 올라온 두툼한 골지 목, 몸통도 세로 골지
    turtleneck: {
      front(g, a, c) {
        const B = '#1e1e24', b = '#2c2c34', d = '#131317';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          if (leg) return '#4a4a56';
          const adx = Math.abs(dx);
          if (adx >= 5) return d;
          return (x % 2 && dy >= 0) ? b : B;
        });
        if (a.curled) return;
        // 목: 턱 밑 두 줄을 가로질러 감싼다 (접힌 선이 한 줄)
        for (let x = a.hx - 4; x <= a.hx + 4; x++) {
          this.px(x, a.my + 1, x % 2 ? '#34343e' : B);
          this.px(x, a.my + 2, x % 2 ? b : d);
        }
        this.px(a.hx - 4, a.my + 1, d); this.px(a.hx + 4, a.my + 1, d);
      },
    },

    // 분홍 퍼프 공주 드레스: 둥근 퍼프 소매, 흰 레이스 목선, 허리 리본, 퍼지는 치마에 반짝
    princessdress: {
      front(g, a, c, t) {
        const P = '#ffadd0', p = '#e8829e', L = '#ffd6e8', Rb = '#e0306a';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return P;
          if (a.curled) return adx >= 5 ? p : P;
          if (dy === -2 && adx <= 4) return '#ffffff'; // 레이스
          if (adx >= 5 && dy <= -1) return L; // 퍼프
          return adx >= 4 ? p : P;
        });
        if (a.curled) return;
        bulge(this, a, c, a.my + 1, a.my + 2, 1, (s, i, y) => (y === a.my + 1 ? '#ffffff' : L));
        skirt(this, a, c, [2, 3], (x, y, k) => {
          if (hash(x * 3 + k * 11 + Math.floor(t * 3)) > 0.9) return '#ffffff';
          return (x + 40) % 3 === 0 ? p : k ? L : P;
        });
        // 허리 리본
        this.pattern(['RkR', 'r.r'], a.hx - 1, a.my + 2, { R: Rb, k: '#a01c4a', r: '#b82456' });
      },
    },

    // 금박 스팽글 무대 드레스: 끈 두 줄, 스팽글이 번갈아 반짝, 물고기 꼬리처럼 퍼지는 밑단
    sequindress: {
      front(g, a, c, t) {
        const S = ['#f0c040', '#ffe27a', '#c8961a', '#fff6c8'];
        const f = Math.floor(t * 5);
        const seq = (x, y) => {
          const h = hash(x * 7 + y * 13 + f * 3.1);
          return h > 0.93 ? '#ffffff' : S[((x + y + f) % 2) * 2 + (h > 0.5 ? 1 : 0)];
        };
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return seq(x, y);
          if (!a.curled) {
            if (dy === -3) return null;
            if (dy === -2) return adx === 3 ? '#c8961a' : null; // 가는 끈
            if (dy === -1 && adx <= 1) return null; // 하트 목선
          }
          return seq(x, y);
        });
        if (a.curled) return;
        skirt(this, a, c, [1, 2], (x, y) => seq(x, y));
        if (t % 1.6 < 0.3) star(this, a.hx + (Math.floor(t / 1.6) % 2 ? 5 : -5), a.my + 3, '#fff6c8');
      },
    },

    // 세일러복: 남색 세일러 칼라에 흰 줄, 빨간 스카프 리본, 남색 주름 치마
    sailor: {
      front(g, a, c, t) {
        const N = '#23306a', W = '#fbfbf6', w = '#d8dce8', R = '#e0303a';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#fbfbf6';
          if (a.curled) return adx >= 5 ? N : W;
          const b = 2 + (dy + 2); // 칼라 V 경계
          if (dy <= -1 && adx >= b) return adx === b + 1 ? W : N; // 칼라 + 흰 줄
          if (dy === -3) return N;
          return adx >= 5 ? w : W;
        });
        if (a.curled) return;
        skirt(this, a, c, [1, 2], (x, y, k) => ((x + 40) % 2 && k ? '#1a2450' : N));
        // 스카프 리본: 매듭과 늘어진 두 자락
        const s = sway(t, 2.4, 0.6);
        this.pattern(['RrR'], a.hx - 1, a.my + 2, { R, r: '#a01c24' });
        this.px(a.hx - 1, a.my + 3, R); this.px(a.hx + 1 + s, a.my + 3, R);
      },
    },

    // 바리스타 앞치마: 흰 셔츠 위 초록 앞치마, 목끈, 가슴에 흰 컵 로고, 주머니에 펜
    baristaapron: {
      front(g, a, c) {
        const G = '#1f7a4e', gd = '#15583a', W = '#fbfbf6', w = '#d8dce2';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return G;
          if (a.curled) return adx >= 5 ? w : G;
          if (dy === -2 && adx === 3) return G; // 목끈
          if (dy === -1 && adx <= 3) return G; // 가슴받이
          if (dy >= 0 && adx <= 4) return adx === 4 ? gd : G;
          return adx >= 5 ? w : W;
        });
        if (a.curled) return;
        // 컵 로고 (흰 동그라미에 초록 점)
        this.pattern(['.W.', 'WgW', '.W.'], a.hx - 1, a.my + 2, { W: '#ffffff', g: '#0f4a30' });
        this.px(a.hx + 3, a.my + 3, '#ff8a3a'); // 주머니 펜
        this.px(a.hx + 3, a.my + 4, gd);
      },
    },

    // 용 문양 황금 흉갑: 금빛 판에 붉은 용이 꿈틀, 둥근 어깨 판, 빛이 스쳐 반짝
    goldcuirass: {
      front(g, a, c, t) {
        const Y = '#e8b83a', y = '#b0801a', L = '#ffe79a', R = '#c8202c';
        const p = (t % 2.4) / 0.6;
        const shine = (x, yy) => p < 1 && Math.abs((x - a.hx) + (yy - a.my) - (Math.round(p * 16) - 8)) < 1;
        wear(this, g, a, (dx, dy, x, yy, leg) => {
          const adx = Math.abs(dx);
          if (leg) return '#7a1a20';
          if (shine(x, yy)) return '#ffffff';
          if (dy === -2 && adx <= 4) return L; // 목 테
          return adx >= 5 ? y : Y;
        });
        if (a.curled) return;
        // 붉은 용: 똬리 튼 몸 + 머리
        this.pattern(['.RR.r', 'R..R.', '.RR..'], a.hx - 2, a.my + 2, { R, r: '#ff5a3a' });
        // 어깨 판
        bulge(this, a, c, a.my + 1, a.my + 2, 1, (s, i, yy) => (yy === a.my + 1 ? L : y));
        if (t % 2.4 > 2.1) star(this, a.right + 1, a.my, '#fff4b0');
      },
    },

    // 흑기사 갑옷: 검은 판금에 붉은 선, 뾰족 어깨, 선이 은은하게 붉게 달아오른다
    blackknight: {
      front(g, a, c, t) {
        const B = '#26262e', b = '#16161b', L = '#44444f';
        const glow = 0.5 + 0.5 * Math.sin(t * 2);
        const Rl = glow > 0.6 ? '#ff4a4a' : '#c8202c';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return b;
          if (a.curled) return adx >= 5 ? b : B;
          if (dy === -2) return adx <= 4 ? L : B; // 목가리개
          if (dx === 0 && dy >= -1) return Rl; // 가운데 붉은 선
          if (dy === 1 && adx <= 4) return '#8a1a22'; // 붉은 허리띠
          if (adx === 4 && dy === 0) return Rl;
          return adx >= 5 ? b : (dy === -1 && adx <= 2 ? L : B);
        });
        if (a.curled) return;
        // 뾰족 어깨: 바깥 위로 솟은 가시
        const P = ['.K..', 'KLK.', 'KLLK', 'KBRB', '.KKK'];
        for (const s of [-1, 1]) {
          const x = s < 0 ? a.left - 3 : a.right;
          this.pattern(s < 0 ? P : P.map((r) => r.split('').reverse().join('')), x, a.my - 2, { K: c.K, L, B, R: Rl });
          // 가시 끝에 붉은 기운
          this.px(x + (s < 0 ? 1 : 2), a.my - 3, `rgba(255,60,60,${(0.2 + glow * 0.4).toFixed(2)})`, false);
        }
      },
    },

    // 높은 깃 뱀파이어 망토: 머리 뒤로 솟은 붉은 안감 깃, 검은 망토, 붉은 보석 브로치
    vampcape: {
      back(g, a, c, t) {
        const Bk = '#15141a', R = '#b01c2a', r = '#7a1020';
        if (a.curled) return; // 식빵 자세에선 깃을 눕혀 몸 옷만
        const y0 = a.ey - 2;
        for (const s of [-1, 1]) {
          const x = s < 0 ? a.left : a.right;
          for (let y = y0; y <= a.my + 1; y++) {
            const flare = y <= y0 + 1 ? 2 : 1; // 위로 갈수록 벌어진다
            for (let i = 1; i <= flare; i++) this.px(x + s * i, y, i === flare ? Bk : R);
            this.px(x + s * (flare + 1), y, c.K);
          }
          this.px(x + s, y0 - 1, c.K); this.px(x + s * 2, y0 - 1, c.K);
          this.px(x + s, a.my - 1, r);
        }
        // 망토 자락 (몸 뒤로 넓게, 바닥까지)
        for (let y = a.my + 2; y <= GROUND - 1; y++) {
          const w = 2 + Math.floor((y - a.my - 2) / 2) + (y === GROUND - 1 ? Math.round(Math.sin(t * 2) * 0.5) : 0);
          for (const s of [-1, 1]) {
            const x = s < 0 ? a.left : a.right;
            for (let i = 1; i <= w; i++) this.px(x + s * i, y, i === 1 ? R : Bk);
            this.px(x + s * (w + 1), y, c.K);
          }
        }
      },
      front(g, a, c, t) {
        const Bk = '#15141a', bk = '#26242e', R = '#b01c2a';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return Bk;
          if (a.curled) return adx >= 5 ? R : Bk;
          if (adx <= 1 && dy >= -1) return '#f4f0ea'; // 셔츠 앞
          if (adx === 4 && dy >= -1) return R; // 망토 안감 자락
          return adx >= 5 ? bk : Bk;
        });
        if (a.curled) return;
        // 브로치: 금 테 붉은 보석, 가끔 반짝
        this.pattern(['.G.', 'GRG', '.G.'], a.hx - 1, a.my + 1, { G: '#e0b43a', R: t % 2.5 < 0.2 ? '#ff9aa0' : '#d81c30' });
      },
    },

    // 드래곤 비늘 슈트: 초록 비늘이 층층, 배는 연두 비늘판, 비늘 위로 빛이 흘러간다
    dragonscale: {
      front(g, a, c, t) {
        const G = '#3a9a48', gd = '#24683a', gl = '#6ad06a', Bl = '#d8e08a', bl = '#b8c068';
        const wave = (t * 5) % 16 - 3;
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          const off = (y % 2) ? 1 : 0;
          const u = (x + off + 40) % 2;
          let col = u ? G : gd;
          if (!u && (y + 40) % 2 === 0) col = gl; // 비늘 윗머리 빛
          if (!a.curled && adx <= 1 && dy >= -1 && !leg) col = y % 2 ? Bl : bl; // 배 비늘판
          if (Math.abs((x - a.hx + 8) - wave - (y - a.my)) < 1 && u) col = '#c8ffa8'; // 흘러가는 빛
          return col;
        });
        if (a.curled) return;
        // 어깨에 작은 가시
        this.px(a.left, a.my, '#e8d060'); this.px(a.right, a.my, '#e8d060');
      },
    },

    // 수박 옷: 초록 줄무늬 껍질 칼라, 연두 속껍질, 빨간 과육 몸통에 검은 씨
    melonsuit: {
      front(g, a, c) {
        const G = '#2e9a40', gd = '#16602a', W = '#d8f0a8', R = '#f0404e', r = '#ff6a78';
        wear(this, g, a, (dx, dy, x, y, leg) => {
          const adx = Math.abs(dx);
          if (leg) return (x + 40) % 2 ? G : gd;
          if (a.curled) return adx >= 5 ? ((y + 40) % 2 ? G : gd) : R;
          if (dy <= -2) return (x + 40) % 2 ? G : gd; // 껍질 칼라
          if (dy === -1) return adx >= 5 ? gd : W; // 속껍질
          if (adx >= 5) return (y + 40) % 2 ? G : gd;
          if (adx === 4) return W;
          if ((x * 3 + y * 5) % 7 === 0) return '#1a1414'; // 씨
          return (x + y) % 5 === 0 ? r : R;
        });
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, LAB);
})(window);


// ================= 손 =================
// 색은 밝은 면 → 기본 → 그늘 세 단계 + 하이라이트 한 점, 외곽선은 고양이 외곽선 색(c.K)
(function (root) {
  const { GROUND, sway, hash, heldPaw, star } = root.PetSprite.costumeKit;

  // 왼쪽 위가 밝고 오른쪽 아래가 어두운 공 칠하기
  const ballFill = (cx, cy, [L, M, D], hl) => (x, y) => {
    const sh = x + 0.5 - cx + (y + 0.5 - cy);
    if (hl && x === Math.floor(cx - 1) && y === Math.floor(cy - 1)) return hl;
    return sh < -1.6 ? L : sh > 1.2 ? D : M;
  };

  const LAB = {
    // 1. 탕후루 꼬치: 나무 꼬치에 귤·청포도·딸기. 유리처럼 반짝이는 설탕 코팅, 광택이 과일을 타고 차례로 반짝
    tanghulu: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K;
        const STICK = '#e6c68a', stick = '#b08a50';
        const glint = Math.floor(t * 2.5) % 4; // 차례로 반짝이는 과일 번호 (3 = 쉼)
        const GRAPE = ['#eaffb8', '#a8dc4a', '#6a9e24'], TANG = ['#ffd890', '#ff9a2a', '#d0601a'];
        // 설탕 코팅 과일: 왼쪽 위 하얀 광택 두 칸 + 오른쪽 아래 반사 한 점, 아래엔 굳은 설탕 한 방울
        const fruit = (cx, cy, rx, ry, pal, on, seg) => {
          const base = ballFill(cx, cy, pal, null);
          this.ellipse(cx, cy, rx, ry, (x, y) => (seg && x === Math.floor(cx) && y > Math.floor(cy - ry + 0.5) ? pal[2] : base(x, y)), K);
          const lx = Math.floor(cx - rx + 0.8), ly = Math.floor(cy - ry + 0.8);
          this.px(lx, ly, on ? '#ffffff' : 'rgba(255,255,255,0.85)');
          if (on) this.px(lx + 1, ly, 'rgba(255,255,255,0.7)');
          this.px(Math.floor(cx + rx - 0.8), Math.floor(cy + ry - 0.8), 'rgba(255,255,255,0.55)');
          this.px(Math.floor(cx + rx - 0.3), Math.floor(cy + ry + 0.6), 'rgba(255,236,190,0.7)', false);
        };
        const straw = (x, y, on) => this.pattern([
          '.KNKNK.',
          'KgNgNgK',
          'KHRRyrK',
          'KRyRRrK',
          '.KRRyK.',
          '..KrK..',
        ], x - 3, y, { K, N: '#5cb84a', g: '#2f7a26', H: on ? '#ffffff' : '#ffc0c8', R: '#ee3a4a', r: '#b01c2c', y: '#ffe08a' });
        const art = (x, yb, on) => {
          // yb = 맨 아래 과일(귤) 아래끝. 위로 쌓는다
          fruit(x + 0.5, yb - 2.3, 2.4, 2.2, TANG, on === 0, true);
          fruit(x + 0.5, yb - 7.5, 2.1, 2.1, GRAPE, on === 1, false);
          straw(x, yb - 16, on === 2);
          if (on === 2) this.px(x - 1, yb - 13, '#ffffff');
        };
        if (a.curled) {
          // 바닥에 눕혀 둔 꼬치
          const y = GROUND - 2;
          for (let x = a.right + 1; x <= a.right + 12; x++) this.px(x, y, x % 2 ? STICK : stick);
          const P = (cx, pal) => { this.ellipse(cx, y - 0.5, 1.6, 1.6, ballFill(cx, y - 0.5, pal, '#ffffff'), K); };
          P(a.right + 3.5, TANG); P(a.right + 6.8, GRAPE); P(a.right + 10.1, ['#ff9aa4', '#ee3a4a', '#b01c2c']);
          return;
        }
        const x = a.right + 1, y = a.cy + 1;
        for (let yy = y - 3; yy <= y + 3; yy++) this.px(x, yy, yy === y + 3 ? stick : STICK);
        this.px(x, y - 20, STICK);
        art(x, y - 3, glint);
        heldPaw(this, g, x, y);
        if (t % 2.2 < 0.25) star(this, x + 4, y - 15, '#fffbe0');
        // 녹은 설탕 시럽이 똑 (반투명 한 방울)
        const p = (t % 3) / 3;
        if (p < 0.4) this.px(x + 2, y - 3 + Math.round(p * 7), 'rgba(255,236,190,0.85)', false);
      },
    },

    // 2. 서예 붓: 대나무 붓대에 빨간 술, 검은 붓 끝에 먹물이 맺혔다가 한 방울씩 뚝, 바닥에 먹 자국이 번진다
    seoyebut: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K, L = '#eed79a', M = '#caa65a', N = '#8a6a2a', F = '#c9a45a', f = '#8a6a2a', B = '#15151a', b = '#34343e', H = '#7a7a8a';
        const INK = '#0c0c12';
        const spot = (cx, k) => {
          // 바닥 먹 자국: 조금씩 번지다가 마르며 옅어진다
          const w = 1.4 + k * 1.8;
          this.ellipse(cx, GROUND + 0.5, w, 0.7, `rgba(12,12,20,${(0.75 - k * 0.35).toFixed(2)})`);
        };
        if (a.curled) {
          const y = GROUND - 1;
          this.px(a.right + 1, y, '#d8303b'); this.px(a.right + 2, y + 1, '#d8303b');
          for (let x = a.right + 3; x <= a.right + 7; x++) { this.px(x, y, (x - a.right) % 4 === 0 ? N : M); this.px(x, y - 1, L); }
          this.pattern(['Ff...', 'fBBb.', 'FBBbB', 'fBb..'], a.right + 8, y - 2, { F, f, B, b });
          spot(a.right + 11, (t % 6) / 6);
          return;
        }
        // 몸 옆으로 비켜 들고 붓끝을 아래로
        const x = a.right + 5, y = a.cy - 6;
        const top = y - 5;
        // 걸개 고리 + 살랑이는 빨간 술
        this.pattern(['.K.', 'K.K'], x, top - 3, { K: '#d8303b' });
        const s = sway(t, 2, 0.8);
        this.px(x - 1 + s, top, '#d8303b', false);
        this.px(x - 1 + s, top + 1, '#ff6a70', false);
        for (let i = -1; i <= 2; i++) this.px(x + i, top - 1, K);
        for (let yy = top; yy <= y + 1; yy++) {
          const node = (yy - top) % 4 === 3;
          this.px(x - 1, yy, K);
          this.px(x, yy, node ? N : L);
          this.px(x + 1, yy, node ? N : M);
          this.px(x + 2, yy, K);
        }
        // 금속 테 + 붓털: 가운데가 불룩했다가 뾰족하게 모인다. 외곽선이 붓털을 감싼다
        this.pattern([
          '.KFfK.',
          'KBBbHK',
          'KBBbbK',
          '.KBbK.',
          '..KbK.',
          '...K..',
        ], x - 2, y + 2, { K, F, f, B, b, H });
        heldPaw(this, g, x - 1, y);
        // 먹물: 붓끝에 맺혀 부풀다가 뚝 떨어진다 (떨어질 땐 꼬리 달린 물방울)
        const tipX = x + 1, tipY = y + 8;
        const ph = t % 1.8;
        if (ph < 1) {
          if (ph > 0.35) this.px(tipX, tipY, INK);
          if (ph > 0.7) { this.px(tipX, tipY + 1, INK); this.px(tipX - 1, tipY + 1, 'rgba(12,12,20,0.45)'); this.px(tipX + 1, tipY + 1, 'rgba(12,12,20,0.45)'); }
        } else {
          const p = (ph - 1) / 0.3;
          if (p < 1) {
            const dy = tipY + 1 + Math.round(p * (GROUND - tipY - 1));
            this.px(tipX, dy, INK, false);
            this.px(tipX, dy - 1, 'rgba(12,12,20,0.5)', false);
          } else if (p < 1.8) {
            this.px(tipX - 2, GROUND - 1, 'rgba(12,12,20,0.75)', false);
            this.px(tipX + 2, GROUND - 1, 'rgba(12,12,20,0.75)', false);
          }
        }
        spot(tipX + 0.5, ((t % 1.8) / 1.8) * 0.4);
      },
    },

    // 3. 황금 검: 번쩍이는 황금 장검. 하얀 하이라이트가 흐르는 금빛 칼날, 루비·사파이어 박힌 코등이, 붉은 감개 손잡이.
    //    빛줄기가 칼날을 타고 오르고, 칼끝에서 가끔 반짝. 둘레에 금빛 기운이 은은히
    goldsword: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K, H = '#fffbe0', h = '#ffe98a', M = '#ffc83a', D = '#d08a14';
        const ruby = Math.floor(t * 2) % 2 ? '#ff5a78' : '#e0203c';
        const m = { K, G: '#ffd24a', g: '#b8820e', Y: '#fff2a0', R: ruby, b: '#3a8aff', r: '#c0202c', q: '#7a1018' };
        if (a.curled) {
          // 옆 바닥에 눕혀 둔 검: 손잡이는 고양이 쪽, 칼끝은 바깥. 빛이 칼날을 천천히 훑는다
          const y = GROUND - 1, x0 = a.right + 1;
          this.pattern(['KK', 'rq', 'KK'], x0, y - 2, m);
          this.pattern(['.K.', 'KGK', 'KRK', 'KGK', '.K.'], x0 + 2, y - 3, m);
          const gl = Math.floor(((t * 0.6) % 1) * 14) - 2;
          for (let i = 5; i <= 11; i++) {
            const lit = i - 5 === gl;
            this.px(x0 + i, y - 2, K);
            this.px(x0 + i, y - 1, lit ? '#ffffff' : h);
            this.px(x0 + i, y, lit ? H : i % 3 ? M : D);
          }
          this.px(x0 + 12, y - 1, K); this.px(x0 + 12, y, K);
          if (t % 2.6 < 0.2) star(this, x0 + 9, y - 4, '#fff6c0');
          return;
        }
        const x = a.right + 2, y = a.cy - 1;
        const bladeTop = y - 18, bladeBot = y - 4;
        // 금빛 기운 (칼날 양옆으로 은은히 숨쉰다)
        for (let yy = bladeTop + 1; yy <= bladeBot; yy++) {
          const au = (0.1 + 0.18 * Math.max(0, Math.sin(t * 3 - yy * 0.5))).toFixed(2);
          this.px(x - 3, yy, `rgba(255,226,120,${au})`, false);
          this.px(x + 3, yy, `rgba(255,226,120,${au})`, false);
        }
        // 칼날: 왼쪽 하이라이트, 가운데 홈, 오른쪽 그늘. 빛줄기가 아래에서 위로 쓱
        const ph = (t % 2.4) / 1.1;
        const band = ph < 1 ? Math.round(bladeBot - ph * (bladeBot - bladeTop + 2)) : -99;
        for (let yy = bladeTop; yy <= bladeBot; yy++) {
          const lit = Math.abs(yy - band) <= 1;
          const core = yy === band;
          this.px(x - 2, yy, K);
          this.px(x - 1, yy, lit ? '#ffffff' : H);
          this.px(x, yy, core ? '#ffffff' : lit ? H : (yy - bladeTop) % 5 === 2 ? h : M);
          this.px(x + 1, yy, core ? H : lit ? h : D);
          this.px(x + 2, yy, K);
        }
        // 칼끝
        this.pattern(['..K..', '.KHK.', 'KHhDK'], x - 2, bladeTop - 3, { K, H, h, D });
        // 코등이: 양끝이 위로 말린 금 장식 + 가운데 루비, 양옆 사파이어
        this.pattern([
          'KK.......KK',
          'KGK.....KGK',
          'KYGGGRGGGgK',
          '.KgbgKgbgK.',
          '..KK...KK..',
        ], x - 5, y - 4, m);
        // 손잡이: 붉은 감개가 비스듬히 감겼다
        this.pattern(['KrK', 'KqK', 'KrK', 'KqK'], x - 1, y, m);
        // 폼멜: 금 구슬에 작은 루비
        this.pattern(['.KKK.', 'KGRgK', '.KKK.'], x - 2, y + 4, m);
        heldPaw(this, g, x, y + 1);
        // 칼끝에서 가끔 반짝 + 금빛 가루가 떠오른다
        if (t % 1.9 < 0.3) star(this, x, bladeTop - 5, '#fff6c0');
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.6 + i / 3) % 1;
          const px = x - 3 + Math.round(hash(i + Math.floor(t * 0.6 + i / 3) * 3) * 6);
          this.px(px, bladeBot - Math.round(p * 14), `rgba(255,230,120,${(1 - p).toFixed(2)})`, false);
        }
      },
    },

    // 4. 청사초롱: 막대 끝 고리에 매달린 청·홍 비단 초롱. 안의 촛불이 은은히 일렁이고 초롱이 살랑 흔들린다
    chorong: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K;
        const f = 0.5 + 0.5 * Math.sin(t * 7) * Math.sin(t * 2.3 + 1);
        const mix = (c1, c2, k) => {
          const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
          const A = p(c1), B = p(c2);
          return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
        };
        const lantern = (x, y) => {
          // 은은한 빛 번짐
          for (let j = -3; j <= 12; j++) for (let i = -4; i <= 11; i++) {
            const d = Math.hypot(i - 3.5, (j - 4.5) * 1.1);
            if (d < 7.5) this.px(x + i, y + j, `rgba(255,214,120,${((0.1 + 0.12 * f) * (1 - d / 7.5)).toFixed(3)})`, false);
          }
          const m = {
            K, G: '#e8b440', g: '#a87a1c', W: '#6b3f1a',
            B: mix('#2f5fc8', '#8ab8ff', 0.25 + 0.3 * f), b: '#1c3a86', C: mix('#4f7fe0', '#d8ecff', 0.4 + 0.5 * f),
            R: mix('#d8303b', '#ff9a7a', 0.25 + 0.3 * f), r: '#8e1a24', Q: mix('#ee5050', '#ffe0a0', 0.4 + 0.5 * f),
            T: '#e8303b', t: '#a81c24',
          };
          this.pattern([
            '..KKKK..',
            '.KGGGgK.',
            'KbBBBBbK',
            'KbBCCBbK',
            'KgGGGGgK',
            'KrRQQRrK',
            'KrRRRRrK',
            '.KgGGgK.',
            '..KKKK..',
            '...TT...',
            '..TtTt..',
            '..T..t..',
          ], x, y, m);
        };
        if (a.curled) {
          // 바닥에 내려놓은 초롱 + 옆에 눕힌 막대
          for (let x = a.right + 1; x <= a.right + 12; x++) this.px(x, GROUND, '#7a4a24');
          lantern(a.right + 3, GROUND - 11);
          return;
        }
        const x = a.right + 1, y = a.cy + 1;
        // 막대: 앞발에서 오른쪽 위로 비스듬히
        // 막대: 앞발에서 위로 조금 기울어 올라가고, 끝의 가로 팔에 초롱이 매달린다
        const topX = x + 3, topY = y - 17;
        for (let k = 0; k <= 19; k++) {
          const px = x + Math.round((k * 3) / 19), py = y + 2 - k;
          this.px(px, py, k % 6 === 0 ? '#5a3418' : '#8a5a2a');
          this.px(px - 1, py, k % 6 === 0 ? '#3a2010' : '#5a3418');
        }
        for (let i = 1; i <= 5; i++) this.px(topX + i, topY + (i === 5 ? 1 : 0), i % 2 ? '#8a5a2a' : '#5a3418');
        this.px(topX + 6, topY + 1, '#5a3418');
        // 끈이 흔들리며 초롱이 살랑
        const s = Math.sin(t * 1.7) * 1.3;
        const hx = topX + 6;
        const lx = Math.round(hx - 3.5 + s), ly = topY + 4;
        this.px(hx, topY + 2, '#e8b440', false);
        this.px(Math.round(hx + s * 0.5), topY + 3, '#e8b440', false);
        lantern(lx, ly);
        heldPaw(this, g, x, y);
      },
    },

    // 5. 마녀 빗자루: 구불구불 휘어진 나무 자루, 보라 끈으로 묶은 짚. 빗자루 끝에서 보라 마법 반짝이가 피어오른다
    witchbroom: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K, W = '#9a6434', w = '#6b3f1a', Z = '#f0d27a', z = '#c49a3a', q = '#8a6a24', P = '#9a4ae8', p = '#6a24b0';
        const sparkle = (cx, cy, spread) => {
          for (let i = 0; i < 6; i++) {
            const ph = (t * 0.7 + i / 6) % 1;
            const n = Math.floor(t * 0.7 + i / 6) * 7 + i;
            const sx = Math.round(cx + (hash(n) - 0.5) * spread + Math.sin(ph * 6 + i) * 1.2);
            const sy = Math.round(cy - ph * 8);
            const col = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#d8a8ff' : '#ff9ae8';
            this.ctx.globalAlpha = 1 - ph;
            if (i % 2 === 0 && ph < 0.5) this.pattern(['.X.', 'XXX', '.X.'], sx - 1, sy - 1, { X: col }, false);
            else this.px(sx, sy, col, false);
            this.ctx.globalAlpha = 1;
          }
        };
        if (a.curled) {
          const y = GROUND - 1;
          for (let x = a.right + 1; x <= a.right + 5; x++) this.px(x, y + (x % 4 === 0 ? -1 : 0), x % 2 ? W : w);
          this.pattern(['.PZZZZ.', 'PpZzZzZ', 'PpzZzZz', '.PZ.Z.Z'], a.right + 6, y - 2, { P, p, Z, z });
          sparkle(a.right + 9, y - 1, 5);
          return;
        }
        const x = a.right + 3, y = a.cy - 5;
        const top = y - 11, bot = GROUND - 8;
        // 구불구불한 자루
        const bend = (yy) => Math.round(Math.sin((yy - top) * 0.45) * 0.9);
        for (let yy = top + 2; yy <= bot; yy++) {
          this.px(x + bend(yy), yy, (yy % 3) ? W : w);
          this.px(x + 1 + bend(yy), yy, w);
        }
        // 위쪽 끝은 고리처럼 말렸다
        this.pattern(['.WW', 'W.w', 'Ww.'], x - 1 + bend(top), top - 1, { W, w });
        // 짚: 보라 끈 두 줄로 묶고 아래로 퍼진다
        const bx = x + bend(bot);
        this.pattern([
          '...PPP...',
          '...pPp...',
          '..ZZzZZ..',
          '.ZZzZzZq.',
          '.ZzZzZzZq',
          'ZZzZzZzZq',
          'zZ.Z.Z.zq',
        ], bx - 3, bot + 1, { P, p, Z, z, q });
        heldPaw(this, g, x, y);
        sparkle(bx + 1, GROUND - 1, 9);
        if (t % 1.9 < 0.2) star(this, x + 1, top - 3, '#e8c8ff');
      },
    },

    // 6. 빛나는 마법서: 가죽 표지·금장 모서리의 두꺼운 책을 펼쳐 든다. 페이지가 빛나고 룬 문자가 떠오른다
    spellbook: {
      hand: true,
      front(g, a, c, t) {
        const K = c.K;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3);
        const m = {
          K, P: pulse > 0.6 ? '#fffbe8' : '#f6ecd0', p: '#e0cfa4', t: `rgb(${Math.round(90 + 110 * pulse)},${Math.round(180 + 60 * pulse)},255)`,
          e: '#cfc3a4', C: '#7a2a3a', c: '#4e1624', G: '#ffd65a', g: '#b8861c', R: '#d8303b',
        };
        const RUNES = [['X.X', '.X.', 'X.X'], ['XXX', 'X..', 'XXX'], ['.X.', 'XXX', '.X.'], ['X..', 'XXX', '..X'], ['XX.', 'X.X', '.XX']];
        if (a.curled) {
          // 덮어서 옆에 눕혀 둔 책: 가죽 표지 + 금장 모서리 + 책장 결 + 빨간 끈갈피. 틈새로 빛이 샌다
          const x0 = a.right + 1, y0 = GROUND - 4;
          this.pattern([
            'KKKKKKKKKKKK',
            'KGCCCCCCCGCK',
            'KeeeeeeeeeeK',
            'KgccccccccgK',
            'KKKKKKKKKKKK',
          ], x0, y0, m);
          this.px(x0 + 8, y0 + 5, m.R);
          this.px(x0 + 8, y0 + 6 > GROUND ? GROUND : y0 + 5, m.R);
          for (let i = 1; i <= 10; i++) if ((i + Math.floor(t * 4)) % 5 === 0) this.px(x0 + i, y0 + 2, '#fffbe0');
          return;
        }
        const x0 = a.right - 1, y0 = a.cy - 7;
        // 페이지에서 위로 번지는 빛
        for (let j = 1; j <= 7; j++) {
          const al = (0.3 * (1 - j / 8) * (0.6 + 0.4 * pulse)).toFixed(2);
          for (let i = 1 + Math.floor(j / 3); i <= 11 - Math.floor(j / 3); i++) this.px(x0 + i, y0 - j, `rgba(255,245,190,${al})`, false);
        }
        this.pattern([
          '.KKKKK.KKKKK.',
          'KPPPPPKPPPPPK',
          'KPttPPKPtttPK',
          'KPPPPPKPPPPPK',
          'KPtttPKPPtPPK',
          'KPPPPPKPPPPPK',
          'KeeeeeKeeeeeK',
          'GCCCCCCCCCCCG',
          'gcKKKKKKKKKcg',
        ], x0, y0, m);
        // 가운데 끈갈피
        this.px(x0 + 6, y0 + 9, m.R);
        this.px(x0 + 7, y0 + 10, m.R);
        heldPaw(this, g, x0 + 3, a.cy + 2);
        // 룬 문자가 페이지에서 떠올라 흐려진다
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.5 + i / 3) % 1;
          const n = Math.floor(t * 0.5 + i / 3) * 3 + i;
          const rx = x0 + 1 + Math.round(hash(n) * 8) + Math.round(Math.sin(ph * 5 + i));
          const ry = y0 - 2 - Math.round(ph * 11);
          this.ctx.globalAlpha = ph < 0.15 ? ph / 0.15 : 1 - (ph - 0.15) / 0.85;
          this.pattern(RUNES[n % RUNES.length], rx, ry, { X: i % 2 ? '#ffe28a' : '#8ff0ff' }, false);
          this.ctx.globalAlpha = 1;
        }
        if (t % 2.4 < 0.25) star(this, x0 + 12, y0 - 3, '#fff6c0');
      },
    },
  };

  Object.assign(root.PetSprite.ACCESSORIES, LAB);
})(window);


// ================= 효과 =================
// 얼굴을 가리지 않게: 넓은 빛·연기는 back(몸 뒤), front 는 얼굴 상자(faceBox) 밖에서만 그린다
(function (root) {
  const { GROUND, hash, mirror } = root.PetSprite.costumeKit;
  const A = (v) => Math.max(0, Math.min(1, v)).toFixed(2);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const rgba = (rgb, al) => `rgba(${rgb},${A(al)})`;
  const lerp = (p, q, k) => p.map((v, i) => Math.round(v + (q[i] - v) * k)).join(',');

  // 얼굴 둘레 상자 (귀 끝 ~ 입 아래 한 줄, 머리 폭 +1)
  const inFace = (a, x, y, pad = 0) => x >= a.left - 1 - pad && x <= a.right + 1 + pad && y >= a.earTop - pad && y <= a.my + 1 + pad;

  function faded(r, al, fn) {
    const ctx = r.ctx;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * clamp01(al);
    fn();
    ctx.globalAlpha = prev;
  }
  const upright = (r, rows) => (r.facing < 0 ? mirror(rows) : rows);

  // 위로 떠오르는 입자
  function rise(r, t, n, x0, x1, yb, h, col, speed = 0.5, seed = 0, skip) {
    for (let i = 0; i < n; i++) {
      const p = (t * speed + hash(i + seed)) % 1;
      const x = Math.round(x0 + hash(i * 5 + seed) * (x1 - x0) + Math.sin(t * 2 + i) * 0.8);
      const y = Math.round(yb - p * h);
      if (skip && skip(x, y)) continue;
      r.px(x, y, typeof col === 'function' ? col(i, p) : col, false);
    }
  }
  // 작은 불꽃 (lab.js 와 같은 꼴)
  function flame(r, t, cx, by, w, h, pal, seed = 0, skip) {
    for (let j = 0; j < h; j++) {
      const q = j / h;
      const half = Math.max(0, Math.round((w / 2) * (1 - q * q) + Math.sin(t * 9 + j + seed) * 0.4));
      const off = Math.round(Math.sin(t * 7 + j * 0.9 + seed) * q * 1.2);
      for (let dx = -half; dx <= half; dx++) {
        const edge = Math.abs(dx) / Math.max(1, half);
        const k = Math.min(pal.length - 1, Math.floor(q * (pal.length - 1) + edge * 1.6));
        const x = cx + dx + off, y = by - j;
        if (skip && skip(x, y)) continue;
        r.px(x, y, pal[k], false);
      }
    }
  }
  // 두 점 사이 들쭉날쭉 번개 선 (가운데를 옆으로 밀어 쪼개기 3번)
  function jag(x0, y0, x1, y1, seed, disp) {
    let pts = [[x0, y0], [x1, y1]];
    for (let lv = 0; lv < 3; lv++) {
      const nx = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const o = (hash(seed * 13 + lv * 7 + i * 3) - 0.5) * disp * 2 * (1 - lv * 0.25);
        nx.push(pts[i], [(ax + bx) / 2 - ((by - ay) / len) * o, (ay + by) / 2 + ((bx - ax) / len) * o]);
      }
      nx.push(pts[pts.length - 1]);
      pts = nx;
    }
    return pts;
  }
  // 점 목록을 이어 그린다. col(k, 전체 비율) → 색
  function poly(r, pts, col, skip) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let s = 0; s < n; s++) out.push([Math.round(ax + ((bx - ax) * s) / n), Math.round(ay + ((by - ay) * s) / n)]);
    }
    out.push(pts[pts.length - 1].map(Math.round));
    out.forEach(([x, y], k) => { if (!(skip && skip(x, y))) r.px(x, y, col(k, k / out.length), false); });
    return out;
  }
  const twinkle = (r, x, y, on, core, arm) => {
    if (!on) return;
    r.px(x, y, core, false);
    if (on > 1) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) r.px(x + dx, y + dy, arm, false);
  };

  const LAB = {
    // 1. 나만 무지개: 머리 위 일곱 빛 아치. 빛 한 줄기가 아치를 따라 스쳐 가고, 양 끝엔 뭉게구름
    rainbowarc: {
      back(g, a, c, t) {
        const cx = a.hx + 0.5, cy = a.earTop - 2 + Math.round(Math.sin(t * 1.3) * 0.6);
        const RO = 12.6;
        const COL = [[255, 84, 84], [255, 158, 48], [255, 226, 64], [86, 214, 96], [64, 170, 255], [88, 96, 228], [168, 96, 228]];
        const sweep = Math.PI * (1.15 - ((t * 0.45) % 1.3));
        for (let y = Math.floor(cy - RO * 0.9) - 1; y < cy; y++)
          for (let x = Math.floor(cx - RO) - 1; x <= cx + RO + 1; x++) {
            const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) / 0.86;
            const d = Math.hypot(dx, dy);
            const band = Math.floor(RO - d);
            if (band < 0 || band > 6) continue;
            const ang = Math.atan2(-dy, dx);
            const sh = Math.max(0, 1 - Math.abs(ang - sweep) / 0.28);
            const base = COL[band];
            this.px(x, y, `rgba(${lerp(base, [255, 255, 255], sh * 0.65)},${A(0.82 + sh * 0.18)})`, false);
          }
        // 반짝이: 아치 위 여기저기 톡톡
        for (let k = 0; k < 3; k++) {
          const P = 1.1, tt = t + k * 0.37, n = Math.floor(tt / P), ph = (tt % P) / P;
          const ang = 0.35 + hash(n * 3 + k) * 2.4, rr = RO + 1 - hash(n * 7 + k) * 9;
          const x = Math.round(cx + Math.cos(ang) * rr), y = Math.round(cy - Math.sin(ang) * rr * 0.86);
          twinkle(this, x, y, ph < 0.2 ? 1 : ph < 0.45 ? 2 : ph < 0.6 ? 1 : 0, '#ffffff', 'rgba(255,255,255,0.6)');
        }
        // 양 끝 구름 (둥실 따로 흔들린다)
        const CL = ['..WWW...', '.WWHWWW.', 'WWHHWWWW', 'WWWWWWWS', '.SSSSSS.'];
        const m = { W: '#ffffff', H: '#ffffff', S: '#d4e0ee' };
        this.pattern(CL, Math.round(cx - 9.5) - 4, cy - 3 + Math.round(Math.sin(t * 1.7) * 0.5), m, false);
        this.pattern(mirror(CL), Math.round(cx + 9.5) - 4, cy - 3 + Math.round(Math.sin(t * 1.7 + 2) * 0.5), m, false);
      },
    },

    // 2. 나만 천둥번개: 머리 위 먹구름에서 빗줄기. 가끔 번개가 옆으로 내리꽂히며 번쩍 (구름·둘레가 환해진다)
    thunderstorm: {
      back(g, a, c, t) {
        const bob = Math.round(Math.sin(t * 1.4) * 0.6);
        const x0 = a.hx - 7, y0 = a.top - 14 + bob;
        const P = 2.7, ph = t % P, n = Math.floor(t / P);
        const flash = ph < 0.07 || (ph > 0.14 && ph < 0.22);
        // 번쩍: 고양이 둘레가 잠깐 환해진다
        if (flash) {
          for (let y = y0 - 2; y <= GROUND; y++)
            for (let x = a.cx - 17; x <= a.cx + 17; x++) {
              const e = Math.hypot((x - a.cx) / 17, (y - (a.cy - 6)) / 17);
              if (e < 1) this.px(x, y, `rgba(236,244,255,${A(0.3 * (1 - e * e))})`, false);
            }
        }
        // 빗줄기 (몸 뒤로 지나간다)
        const yb = y0 + 7;
        for (let i = 0; i < 12; i++) {
          const span = GROUND - yb;
          const y = yb + ((t * 26 + hash(i) * span) % span);
          const x = x0 - 2 + ((i * 7) % 19) - Math.round((y - yb) * 0.15);
          this.px(x, y, 'rgba(150,190,232,0.9)', false);
          this.px(x, y + 1, 'rgba(200,226,250,0.65)', false);
          this.px(x + 1, y - 1, 'rgba(150,190,232,0.35)', false);
        }
        // 번개: 구름 모서리에서 고양이 옆으로 지그재그
        if (ph < 0.3) {
          const side = n % 2 ? 1 : -1;
          const sx = side < 0 ? x0 + 2 : x0 + 12, ex = side < 0 ? a.left - 5 : a.right + 5;
          const pts = jag(sx, yb - 1, ex, GROUND - 1, n * 3 + 1, 2.2).map(([x, y]) => [side < 0 ? Math.min(x, a.left - 2 + (y < a.earTop ? 3 : 0)) : Math.max(x, a.right + 2 - (y < a.earTop ? 3 : 0)), y]);
          const fade = ph < 0.22 ? 1 : (0.3 - ph) / 0.08;
          const drawn = poly(this, pts, () => `rgba(255,255,255,${A(fade)})`);
          for (const [x, y] of drawn) { this.px(x - 1, y, `rgba(160,200,255,${A(0.5 * fade)})`, false); this.px(x + 1, y, `rgba(255,246,170,${A(0.6 * fade)})`, false); }
          // 곁가지 하나
          const [bx, by] = drawn[Math.floor(drawn.length * 0.4)];
          poly(this, jag(bx, by, bx + side * 4, by + 5, n * 5 + 2, 1), () => `rgba(230,240,255,${A(0.8 * fade)})`);
        }
        // 먹구름 (번쩍일 땐 속이 하얗게)
        const CLOUD = [
          '.....KKKK......',
          '...KKggggKKK...',
          '..KgggHHgggggK.',
          '.KggHHggggggggK',
          'KgggggggggGgggK',
          'KGgggGGggggGGGK',
          '.KGGGGGGGGGGGK.',
          '..KKKKKKKKKKK..',
        ];
        const lit = flash ? { K: '#6a7288', g: '#d4dcec', H: '#ffffff', G: '#a8b2c8' } : { K: '#2a2d38', g: '#5a6070', H: '#7c8494', G: '#434856' };
        this.pattern(CLOUD, x0, y0, lit, false);
      },
      front(g, a, c, t) {
        // 발치 물웅덩이와 튀는 빗방울
        for (let x = a.cx - 11; x <= a.cx + 11; x++) this.px(x, GROUND + 1, 'rgba(143,194,227,0.55)', false);
        for (let i = 0; i < 4; i++) {
          const P = 0.6, tt = t + i * 0.15, n = Math.floor(tt / P), ph = (tt % P) / P;
          if (ph > 0.5) continue;
          const x = Math.round(a.cx - 11 + hash(n * 5 + i) * 22);
          if (x >= a.left && x <= a.right) continue;
          this.px(x - 1, GROUND - Math.round(ph * 2), 'rgba(200,226,250,0.85)', false);
          this.px(x + 1, GROUND - Math.round(ph * 2), 'rgba(200,226,250,0.85)', false);
        }
      },
    },

    // 3. 반딧불: 연두 불빛이 느리게 떠다니며 제각각 깜빡인다. 앞뒤로 오가며 깊이가 생긴다
    fireflies: {
      back(g, a, c, t) { this._ffly(a, t, false); },
      front(g, a, c, t) { this._ffly(a, t, true); },
    },

    // 4. 오로라 커튼: 뒤쪽 하늘에 초록→보라 커튼이 물결치고, 세로 빛살이 흘러간다
    aurora: {
      back(g, a, c, t) {
        const GRN = [90, 255, 170], TEAL = [80, 220, 230], PUR = [180, 100, 255];
        const layer = (base, hgt, amp, sp, al0, shift) => {
          for (let x = a.cx - 20; x <= a.cx + 20; x++) {
            const yb = base + Math.sin(x * 0.23 + t * sp + shift) * amp + Math.sin(x * 0.09 - t * 0.5 + shift) * 1.8;
            const h = hgt + Math.sin(x * 0.17 + t * 0.7 + shift) * 3;
            const ray = 0.45 + 0.55 * Math.max(0, Math.sin(x * 1.1 + t * 2.2 + Math.sin(x * 0.3 + t) * 2));
            const edgeX = 1 - Math.pow(Math.abs(x - a.cx) / 21, 3);
            for (let j = -1; j < h; j++) {
              const q = Math.max(0, j) / h;
              const col = q < 0.4 ? lerp(GRN, TEAL, q / 0.4) : lerp(TEAL, PUR, (q - 0.4) / 0.6);
              let al = (j < 0 ? 0.18 : j === 0 ? 0.95 : Math.pow(1 - q, 0.8) * 0.72) * ray * edgeX * al0;
              if (j === 0) { this.px(x, Math.round(yb), `rgba(${lerp(GRN, [230, 255, 240], 0.5)},${A(al)})`, false); continue; }
              this.px(x, Math.round(yb - j), `rgba(${col},${A(al)})`, false);
            }
          }
        };
        layer(18, 7, 1.5, 0.7, 0.7, 2); // 뒤 커튼 (높고 옅게)
        layer(27, 11, 2.4, 0.9, 1, 0);
        // 별
        for (let k = 0; k < 6; k++) {
          const x = Math.round(a.cx - 18 + hash(k + 40) * 36), y = Math.round(10 + hash(k + 50) * 8);
          const on = Math.floor(t * 2 + hash(k) * 6) % 4;
          if (on) this.px(x, y, on === 3 ? '#ffffff' : 'rgba(255,255,255,0.55)', false);
        }
      },
    },

    // 5. 유성우: 별똥별이 대각선으로 꼬리를 그으며 떨어지고, 작은 별이 반짝
    meteorshower: {
      back(g, a, c, t) {
        for (let k = 0; k < 10; k++) {
          const x = Math.round(a.cx - 19 + hash(k + 11) * 38), y = Math.round(10 + hash(k + 23) * 20);
          if (inFace(a, x, y, 1)) continue;
          const on = (Math.floor(t * 3 + hash(k + 5) * 9) + k) % 5;
          if (!on) continue;
          if (on === 4) twinkle(this, x, y, 2, '#ffffff', 'rgba(200,220,255,0.55)');
          else this.px(x, y, on === 1 ? 'rgba(220,230,255,0.45)' : 'rgba(240,244,255,0.8)', false);
        }
        const TAIL = ['#ffffff', '#ffffff', '#fff6c8', '#ffe29a', 'rgba(255,214,150,0.85)', 'rgba(255,190,130,0.7)', 'rgba(255,170,120,0.55)', 'rgba(255,150,130,0.42)', 'rgba(255,140,150,0.3)', 'rgba(240,140,190,0.2)', 'rgba(220,150,220,0.12)'];
        for (let k = 0; k < 5; k++) {
          const P = 1.3 + k * 0.21, tt = t + k * 0.47, n = Math.floor(tt / P), ph = (tt % P) / P;
          if (ph > 0.75) continue;
          const q = ph / 0.75;
          const sx = a.cx - 2 + hash(n * 3 + k) * 26, sy = 6 + hash(n * 5 + k) * 10;
          const L = 24 + hash(n + k * 9) * 8;
          const hx = sx - q * L, hy = sy + q * L * 0.62;
          const fade = q > 0.8 ? (1 - q) / 0.2 : 1;
          const len = Math.min(TAIL.length, 3 + Math.round(q * 16));
          faded(this, fade, () => {
            for (let j = len - 1; j >= 0; j--) { this.px(hx + j, hy - j * 0.62, TAIL[j], false); if (j > 1 && j < 6) this.px(hx + j, hy - j * 0.62 + 1, 'rgba(255,200,150,0.25)', false); }
            if (Math.floor(t * 12 + k) % 2) for (const [dx, dy] of [[-1, 0], [0, 1], [0, -1]]) this.px(hx + dx, hy + dy, 'rgba(255,250,210,0.7)', false);
          });
        }
      },
    },

    // 6. 나만 바람: 옆으로 휙휙 부는 바람 선(끝이 돌돌 말림), 날리는 털 뭉치와 나뭇잎
    windblown: {
      back(g, a, c, t) { this._wind(g, a, c, t, false); },
      front(g, a, c, t) { this._wind(g, a, c, t, true); },
    },

    // 7. 라이브 방송 하트: 오른쪽 아래 하트 버튼이 톡톡 눌릴 때마다 빨간 하트(가끔 엄지)가 퐁 커지며 줄지어 떠오른다.
    // 머리 왼쪽 위엔 둥근 LIVE 뱃지와 깜빡이는 녹화 점, 시청자 수 막대
    livehearts: {
      front(g, a, c, t) {
        // 하트 세 크기 (외곽선 K · 몸 X · 그늘 D · 윤기 H · 반짝 W)
        const H_L = ['.KK.KK.', 'KHWKXXK', 'KHXXXXK', 'KXXXXDK', '.KXXDK.', '..KDK..', '...K...'];
        const H_M = ['.K.K.', 'KWKXK', 'KHXXK', '.KXDK', '..K..'];
        const H_S = ['K.K', 'XHX', '.X.'];
        const THUMB = ['..KK...', '.KYK...', '.KYKKKK', 'KKYYYYK', 'KBKYYHK', 'KBKYYYK', 'KBKYYDK', '.K.KKK.'];
        const REDS = [
          { K: '#8e0f22', X: '#ff2a44', D: '#c8142e', H: '#ff8a98', W: '#ffffff' },
          { K: '#7a0c1c', X: '#e8182f', D: '#a80d22', H: '#ff6f80', W: '#ffe4e8' },
          { K: '#9a1a14', X: '#ff3b2f', D: '#cc2018', H: '#ff9a8a', W: '#ffffff' },
        ];
        const TH = { K: '#8a5a10', Y: '#ffd24a', H: '#fff4c0', D: '#e0a020', B: '#3a8ef0' };
        const N = 6, P = 2.9;
        const bx = a.right + 6;
        const up = (rows) => upright(this, rows);
        for (let i = 0; i < N; i++) {
          const tt = t + (i * P) / N, n = Math.floor(tt / P), p = (tt % P) / P;
          const thumb = i % 3 === 1 && hash(n * 7 + i) < 0.4;
          const big = hash(n * 3 + i + 1) < 0.45;
          // 태어날 때 작은 하트 → 퐁 커졌다가 → 제 크기
          let sh;
          if (thumb) sh = p < 0.06 ? H_S : up(THUMB);
          else sh = p < 0.05 ? H_S : p < 0.1 ? (big ? H_L : H_M) : p > 0.8 ? (big ? H_M : H_S) : big ? H_L : H_M;
          const pal = thumb ? TH : REDS[(n + i) % REDS.length];
          const w = sh[0].length, h = sh.length;
          const drift = Math.sin(tt * 2.2 + i * 2.3) * (1.2 + p * 2.8) + (i % 2 ? 1.5 : -1.5) * p;
          const x = Math.round(bx - w / 2 + drift - p * 4);
          const y = Math.round(GROUND - 5 - p * 29 - h / 2);
          const al = p < 0.05 ? 0.7 : p > 0.7 ? (1 - p) / 0.3 : 1;
          faded(this, al, () => this.pattern(sh, x, y, pal, false));
          // 퐁 할 때 둘레 작은 반짝
          if (p > 0.05 && p < 0.12) for (const [dx, dy] of [[-2, -1], [w + 1, -1], [-1, h], [w, h]]) this.px(x + dx, y + dy, 'rgba(255,190,200,0.85)', false);
        }
        // 하트 버튼: 흰 동그라미에 빨간 하트. 눌릴 때 쏙 들어가고 둘레에 빛 고리
        const tap = (t * 2.2) % 1;
        const press = tap < 0.12 ? 1 : 0;
        const btn = ['..OOOOO..', '.OWWWWWO.', 'OWKK.KKWO', 'OWKXKXKWO', 'OWKXXXKWO', 'OWWKXKWWO', '.OWWKWWO.', '..OOOOO..'].map((r) => r.replace(/\./g, '.'));
        this.pattern(btn, bx - 4, GROUND - 7 + press, { O: '#d8c8cc', W: '#ffffff', K: '#b80f28', X: '#ff2a44' }, false);
        if (tap < 0.3) {
          const rr = 5 + tap * 10, al = 1 - tap / 0.3;
          for (let k = 0; k < 16; k++) {
            const ang = (k / 16) * Math.PI * 2;
            this.px(bx + 0.5 + Math.cos(ang) * rr, GROUND - 3.5 + Math.sin(ang) * rr * 0.8, `rgba(255,120,140,${A(al * 0.7)})`, false);
          }
        }
        // LIVE 뱃지 (둥근 모서리) + 녹화 점 + 시청자 막대
        const LET = { L: ['X..', 'X..', 'X..', 'X..', 'XXX'], I: ['X', 'X', 'X', 'X', 'X'], V: ['X.X', 'X.X', 'X.X', 'X.X', '.X.'], E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'] };
        const blink = Math.floor(t * 1.6) % 2;
        const rows = [];
        const Wd = 20;
        for (let j = 0; j < 9; j++) rows.push(Array(Wd).fill(j === 0 || j === 8 ? 'R' : 'R'));
        rows[0][0] = rows[0][Wd - 1] = rows[8][0] = rows[8][Wd - 1] = '.';
        for (let j = 0; j < 9; j++) rows[j][Wd - 1] = rows[j][Wd - 1] === '.' ? '.' : 'r';
        for (let i = 1; i < Wd - 1; i++) rows[8][i] = 'r';
        // 녹화 점 (2×2, 깜빡)
        for (const [dx, dy] of [[2, 3], [3, 3], [2, 4], [3, 4]]) rows[dy][dx] = blink ? 'W' : 'p';
        let cx = 6;
        for (const ch of 'LIVE') {
          const gl = LET[ch];
          gl.forEach((line, j) => { for (let k = 0; k < line.length; k++) if (line[k] === 'X') rows[2 + j][cx + k] = 'W'; });
          cx += gl[0].length + 1;
        }
        const badge = rows.map((r) => r.join(''));
        const lx = a.left - 10, ly = a.top - 12;
        this.pattern(up(badge), lx, ly, { R: '#e8263a', r: '#b0162a', W: '#ffffff', p: '#ff9aa6' }, false);
        // 시청자 수 막대: 눈 모양 + 올라가는 막대
        const vy = ly - 4;
        const vx = this.facing < 0 ? lx + Wd - 3 : lx;
        this.pattern(['.KK.', 'KWWK', '.KK.'], vx, vy, { K: 'rgba(40,30,40,0.7)', W: '#ffffff' }, false);
        const lv = 3 + (Math.floor(t * 3) % 5);
        for (let k = 0; k < 8; k++) this.px(this.facing < 0 ? vx - 2 - k : vx + 5 + k, vy + 1, k < lv ? 'rgba(255,255,255,0.9)' : 'rgba(40,30,40,0.35)', false);
      },
    },

    // 8. 불꽃 오라: 뒤로 활활 타오르는 큰 불꽃(위로 갈수록 높게 넘실), 앞 발밑엔 낮은 불씨, 불똥이 튄다
    fireaura: {
      back(g, a, c, t) {
        const PAL = ['#fff6d0', '#ffe36a', '#ffb02a', '#ff6a1a', '#e0301a', 'rgba(170,30,20,0.7)'];
        // 열기: 불꽃 뒤로 옅은 붉은 빛 (테두리 없이 가운데서 번진다)
        const ox = a.cx - 0.5, oy = a.cy - 5;
        for (let y = a.top - 14; y <= GROUND; y++)
          for (let x = a.left - 9; x <= a.right + 9; x++) {
            const d = Math.hypot((x + 0.5 - ox) / 13, (y + 0.5 - oy) / 14);
            if (d > 1) continue;
            this.px(x, y, `rgba(255,120,40,${A(0.22 * (1 - d) * (0.8 + 0.2 * Math.sin(t * 6 + y * 0.5)))})`, false);
          }
        // 큰 불꽃: 가운데(머리 뒤)가 가장 높고 옆으로 갈수록 낮다. 바깥 줄 먼저, 안쪽 줄이 위에
        const xs = [-11, 11, -8, 8, -5, 5, -2, 2];
        xs.forEach((dx, i) => {
          const h = Math.round(24 - Math.abs(dx) * 1.1 + Math.sin(t * 5 + i * 1.9) * 3);
          flame(this, t, a.cx + dx, GROUND, 7 - Math.abs(dx) / 4, h, PAL, i * 1.7);
        });
        // 머리 위로 솟는 혀 셋
        for (let k = -1; k <= 1; k++) flame(this, t, a.hx + k * 4, a.top + 2, 4, Math.round(7 + Math.sin(t * 6 + k * 2) * 2 - Math.abs(k) * 2), PAL, k * 3 + 1);
        rise(this, t, 7, a.left - 7, a.right + 7, GROUND - 4, 24, (i, p) => (p < 0.4 ? '#fff0a0' : `rgba(255,${Math.round(160 - p * 100)},40,${A(1 - p)})`), 0.8, 3);
      },
      front(g, a, c, t) {
        const PAL = ['#ffffff', '#ffe36a', '#ffa22a', '#ff5a1a', 'rgba(216,38,26,0.8)'];
        // 발밑 불씨: 낮게 깜빡이는 작은 불 (발을 다 덮지 않게 듬성듬성)
        for (let x = a.left - 4; x <= a.right + 4; x += 3) {
          const h = Math.round(1.5 + Math.sin(t * 9 + x * 1.7) * 1.2);
          if (h > 0) flame(this, t, x, GROUND + 1, 1, h, PAL, x * 0.7);
        }
        rise(this, t, 6, a.left - 8, a.right + 8, GROUND, 20, (i, p) => (i % 2 ? '#ffe36a' : '#ff7a2a'), 1.1, 17, (x, y) => inFace(a, x, y));
      },
    },

    // 9. 얼음 결정 오라: 뾰족뾰족 서리 오라, 떠도는 눈 결정, 발밑 얼음판과 고드름 가시
    iceaura: {
      back(g, a, c, t) {
        const ox = a.cx - 0.5, oy = a.cy - 3;
        for (let y = a.top - 11; y <= GROUND; y++)
          for (let x = a.left - 7; x <= a.right + 7; x++) {
            const dx = (x + 0.5 - ox) / 11, dy = (y + 0.5 - oy) / 11;
            const ang = Math.atan2(dy, dx);
            // 결정 모양 가시 (각도에 따라 뾰족하게 솟는다)
            const spike = Math.pow(Math.abs(Math.sin(ang * 6 + 0.4)), 8) * 0.28 * (0.85 + 0.15 * Math.sin(t * 2 + ang * 3));
            const d = Math.hypot(dx, dy) / (1 + spike);
            if (d > 1 || d < 0.74) continue;
            const sh = 0.5 + 0.5 * Math.sin(t * 3 - ang * 2);
            this.px(x, y, d > 0.92 ? `rgba(${lerp([150, 215, 255], [255, 255, 255], sh * 0.6)},0.7)` : 'rgba(190,230,255,0.28)', false);
          }
        this._snowflakes(a, t, false);
      },
      front(g, a, c, t) {
        // 얼음판: 옅은 하늘 판 + 흰 반사 + 좌우 얼음 가시
        for (let x = a.cx - 12; x <= a.cx + 12; x++) {
          const e = Math.abs(x - a.cx) / 12;
          this.px(x, GROUND + 1, `rgba(200,236,255,${A(0.85 - e * 0.4)})`, false);
          if (e < 0.85) this.px(x, GROUND + 2, `rgba(140,200,240,${A(0.6 - e * 0.4)})`, false);
        }
        const glint = Math.round(a.cx - 12 + ((t * 10) % 30));
        this.px(glint, GROUND + 1, '#ffffff', false);
        const SPK = ['..W..', '.WB..', '.WBB.', 'WBBBb'];
        const m = { W: '#ffffff', B: '#a8dcff', b: '#6fb0ea' };
        this.pattern(SPK, a.left - 7, GROUND - 3, m, false);
        this.pattern(mirror(SPK), a.right + 3, GROUND - 3, m, false);
        this.pattern(['.W.', 'WBb'], a.left - 3, GROUND - 1, m, false);
        this.pattern(['.W.', 'bBW'], a.right + 1, GROUND - 1, m, false);
        this._snowflakes(a, t, true);
      },
    },

    // 10. 뇌신 번개 오라: 몸 둘레를 파지직 감는 파랑·흰 전기. 2.4초마다 하늘에서 크게 번쩍
    thunderaura: {
      back(g, a, c, t) {
        const ox = a.cx - 0.5, oy = a.cy - 3, RX = 11, RY = 11;
        const P = 2.4, ph = t % P, n = Math.floor(t / P);
        const big = ph < 0.35;
        const bf = big ? (ph < 0.25 ? 1 : (0.35 - ph) / 0.1) : 0;
        // 은은한 전기 테두리
        for (let y = a.top - 10; y <= GROUND; y++)
          for (let x = a.left - 7; x <= a.right + 7; x++) {
            const d = Math.hypot((x + 0.5 - ox) / RX, (y + 0.5 - oy) / RY);
            if (d > 1 || d < 0.8) continue;
            this.px(x, y, d > 0.93 ? `rgba(110,180,255,${A(0.35 + bf * 0.4)})` : `rgba(180,220,255,${A(0.12 + bf * 0.25)})`, false);
          }
        // 몸 둘레 전기 줄기: 0.08초마다 새로 튄다
        const f = Math.floor(t * 12);
        const arcs = big ? 6 : 4;
        for (let k = 0; k < arcs; k++) {
          const a1 = hash(f * 7 + k) * Math.PI * 2, a2 = a1 + 0.5 + hash(f * 3 + k) * 0.7;
          const r1 = 0.9 + hash(f + k * 5) * 0.15, r2 = 0.9 + hash(f * 2 + k) * 0.15;
          const pts = jag(ox + Math.cos(a1) * RX * r1, oy + Math.sin(a1) * RY * r1, ox + Math.cos(a2) * RX * r2, oy + Math.sin(a2) * RY * r2, f * 11 + k, 1.6);
          const drawn = poly(this, pts, (i, q) => (q > 0.35 && q < 0.65 ? '#ffffff' : '#bfe6ff'));
          for (const [x, y] of drawn) if (hash(x * 3 + y + f) > 0.5) this.px(x, y + 1, 'rgba(70,140,255,0.55)', false);
        }
        // 크게 번쩍: 머리 위 하늘에서 내리꽂히는 벼락
        if (big) {
          const bx = a.hx + (n % 2 ? 7 : -7);
          const pts = jag(bx + (n % 2 ? 5 : -5), 6, bx, oy - RY + 1, n * 17, 2.5);
          const drawn = poly(this, pts, () => `rgba(255,255,255,${A(bf)})`);
          for (const [x, y] of drawn) { this.px(x - 1, y, `rgba(120,190,255,${A(0.7 * bf)})`, false); this.px(x + 1, y, `rgba(120,190,255,${A(0.7 * bf)})`, false); }
        }
      },
      front(g, a, c, t) {
        // 앞은 발 쪽만 파지직 (얼굴 밑으로만)
        const f = Math.floor(t * 10);
        for (let k = 0; k < 2; k++) {
          if (hash(f * 5 + k) < 0.35) continue;
          const side = k ? 1 : -1;
          const x0 = side < 0 ? a.left - 1 : a.right + 1;
          const y0 = a.my + 3 + Math.round(hash(f + k) * 2);
          const pts = jag(x0, y0, x0 + side * (2 + Math.round(hash(f * 3 + k) * 2)), GROUND, f * 9 + k, 1.2);
          poly(this, pts, (i) => (i % 2 ? '#ffffff' : '#9fd4ff'));
        }
        // 튀는 불똥
        for (let k = 0; k < 3; k++) {
          const x = Math.round(a.cx - 13 + hash(f * 4 + k) * 26), y = Math.round(a.top - 4 + hash(f * 6 + k) * (GROUND - a.top + 3));
          if (inFace(a, x, y, 1)) continue;
          this.px(x, y, k % 2 ? '#ffffff' : '#8fd0ff', false);
        }
      },
    },

    // 11. 암흑 보라 오라: 검보라 연기가 몸에서 뭉게뭉게 피어오르고, 눈가에 붉은 안광이 흐른다
    darkaura: {
      back(g, a, c, t) {
        const ox = a.cx - 0.5, oy = a.cy - 3;
        // 일렁이는 검보라 테두리
        for (let y = a.top - 10; y <= GROUND; y++)
          for (let x = a.left - 7; x <= a.right + 7; x++) {
            const dx = (x + 0.5 - ox) / 10.5, dy = (y + 0.5 - oy) / 10.5;
            const ang = Math.atan2(dy, dx);
            const up = Math.max(0, -Math.sin(ang));
            const d = Math.hypot(dx, dy) / (1 + up * (0.3 + 0.25 * Math.sin(t * 5 + ang * 8)) + 0.07 * Math.sin(t * 3.3 - ang * 11));
            if (d > 1 || d < 0.66) continue;
            this.px(x, y, d > 0.92 ? 'rgba(150,70,210,0.6)' : d > 0.8 ? 'rgba(80,24,110,0.5)' : 'rgba(40,10,56,0.3)', false);
          }
        // 연기 뭉치: 몸 가장자리에서 태어나 커지며 위로 흩어진다
        for (let i = 0; i < 11; i++) {
          const p = (t * 0.42 + hash(i + 3)) % 1;
          const ang = Math.PI * (0.95 + hash(i * 7) * 1.1);
          const x = ox + Math.cos(ang) * 10 * (1 + p * 0.25) + Math.sin(t * 1.8 + i) * 1.3;
          const y = oy + Math.sin(ang) * 9 + 4 - p * 15;
          const rr = 0.9 + p * 1.8;
          const al = (p < 0.12 ? p / 0.12 : 1 - p) * 0.75;
          for (let yy = Math.floor(y - rr); yy <= y + rr; yy++)
            for (let xx = Math.floor(x - rr); xx <= x + rr; xx++) {
              const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / rr;
              if (d > 1) continue;
              this.px(xx, yy, d < 0.55 ? `rgba(34,8,48,${A(al)})` : `rgba(110,40,160,${A(al * 0.8)})`, false);
            }
        }
        // 붉은 불티
        rise(this, t, 5, a.left - 6, a.right + 6, GROUND - 2, 22, (i, p) => `rgba(255,${40 + i * 10},70,${A(1 - p)})`, 0.55, 29);
      },
      front(g, a, c, t) {
        // 안광: 두 눈 바깥 꼬리에서 붉은 빛이 옆·위로 흐른다 (눈은 덮지 않는다)
        const fl = 0.75 + 0.25 * Math.sin(t * 6);
        const trail = (x, dir) => {
          for (let k = 0; k < 4; k++) {
            const y = a.ey - Math.round(k * 0.7 + Math.sin(t * 5 + k) * 0.4);
            this.px(x + dir * k, y, `rgba(255,${k ? 40 : 110},${k ? 60 : 110},${A(fl * (0.95 - k * 0.22))})`, false);
          }
        };
        trail(a.eyeL - 1, -1);
        trail(a.eyeR + a.ew, 1);
        // 발치를 기는 낮은 연기
        for (let i = 0; i < 8; i++) {
          const p = (t * 0.6 + hash(i + 40)) % 1;
          const x = Math.round(a.cx - 13 + hash(i * 3 + 1) * 26 + p * 3);
          const y = Math.round(GROUND + 1 - p * 3);
          const al = 0.55 * (1 - p);
          this.px(x, y, `rgba(40,10,56,${A(al)})`, false);
          this.px(x + 1, y, `rgba(120,50,170,${A(al * 0.7)})`, false);
        }
      },
    },

    // 12. 발밑 마법진: 원근감 있는 타원 마법진이 빙글 돌고, 룬이 차례로 빛나며, 빛 입자가 솟는다
    magiccircle: {
      back(g, a, c, t) {
        const cx = a.cx - 0.5, cy = GROUND - 0.5;
        for (let y = GROUND - 5; y <= GROUND + 4; y++)
          for (let x = a.cx - 14; x <= a.cx + 14; x++) {
            const d = Math.hypot((x + 0.5 - cx) / 14, (y + 0.5 - cy) / 4);
            if (d < 1) this.px(x, y, `rgba(150,110,255,${A((0.2 - d * 0.1) * (0.8 + 0.2 * Math.sin(t * 3)))})`, false);
          }
        this._circle(a, t, false);
        // 가장자리에서 솟는 빛 기둥 조각
        for (let k = 0; k < 6; k++) {
          const ang = t * 0.6 + (k * Math.PI) / 3;
          if (Math.sin(ang) > 0) continue;
          const x = Math.round(cx + Math.cos(ang) * 14), y0 = Math.round(cy + Math.sin(ang) * 4);
          const h = 3 + Math.round(2 * Math.sin(t * 4 + k));
          for (let j = 1; j <= h; j++) this.px(x, y0 - j, `rgba(190,160,255,${A(0.55 * (1 - j / (h + 1)))})`, false);
        }
        rise(this, t, 8, a.cx - 12, a.cx + 12, GROUND, 22, (i, p) => (i % 3 ? `rgba(200,180,255,${A(1 - p)})` : `rgba(140,250,255,${A(1 - p)})`), 0.5, 7);
      },
      front(g, a, c, t) {
        this._circle(a, t, true);
        rise(this, t, 5, a.cx - 12, a.cx + 12, GROUND + 2, 18, (i, p) => (p < 0.3 ? '#ffffff' : `rgba(170,240,255,${A(1 - p)})`), 0.7, 31, (x, y) => inFace(a, x, y) || (x > a.left && x < a.right));
      },
    },

    // 13. 천국 빛기둥: 위에서 황금 빛기둥이 내려오고, 빛 알갱이가 떠오르며, 흰 깃털이 팔랑 내려온다
    heavenbeam: {
      back(g, a, c, t) {
        const cx = a.cx - 0.5;
        for (let y = 0; y <= GROUND; y++) {
          const half = 7.5 + y * 0.07;
          for (let x = Math.floor(cx - half) - 1; x <= cx + half + 1; x++) {
            const e = Math.abs(x + 0.5 - cx) / half;
            if (e > 1) continue;
            const ray = 0.75 + 0.25 * Math.sin(x * 1.6 + t * 1.8 + Math.sin(y * 0.15 - t) * 1.5);
            const al = (0.1 + 0.32 * (1 - e * e)) * ray * (0.85 + 0.15 * Math.sin(t * 2.2));
            this.px(x, y, `rgba(${lerp([255, 214, 100], [255, 252, 225], 1 - e)},${A(al)})`, false);
          }
          // 가장자리 금빛 선
          if (y % 3 !== Math.floor(t * 6) % 3) {
            this.px(Math.round(cx - half) - 1, y, 'rgba(255,210,90,0.3)', false);
            this.px(Math.round(cx + half) + 1, y, 'rgba(255,210,90,0.3)', false);
          }
        }
        // 발밑 빛 웅덩이
        for (let x = a.cx - 13; x <= a.cx + 13; x++) {
          const e = Math.abs(x - a.cx) / 13;
          this.px(x, GROUND + 1, `rgba(255,226,130,${A(0.7 - e * 0.5)})`, false);
          if (e < 0.7) this.px(x, GROUND + 2, `rgba(255,226,130,${A(0.4 - e * 0.4)})`, false);
        }
        rise(this, t, 9, a.cx - 9, a.cx + 9, GROUND - 1, 34, (i, p) => (i % 3 ? `rgba(255,236,150,${A(1 - p * 0.7)})` : '#ffffff'), 0.35, 5);
      },
      front(g, a, c, t) {
        const FEATHER = [['.WW.', 'WWws', '.ws.'], ['..W', '.Ww', 'Wws', 's..'], ['WWW.', '.wws']];
        for (let k = 0; k < 2; k++) {
          const P = 5.2, tt = t + k * 2.6, p = (tt % P) / P;
          const side = k ? 1 : -1;
          const sway = Math.sin(tt * 1.6) * 2.5;
          const x = Math.round((side < 0 ? a.left - 5 : a.right + 3) + sway);
          const y = Math.round(10 + p * (GROUND - 12));
          const fr = FEATHER[Math.cos(tt * 1.6) > 0.3 ? 0 : Math.cos(tt * 1.6) < -0.3 ? 2 : 1];
          const al = p > 0.85 ? (1 - p) / 0.15 : p < 0.08 ? p / 0.08 : 1;
          faded(this, al, () => this.pattern(side < 0 ? fr : mirror(fr), x, y, { W: '#ffffff', w: '#efe8da', s: '#c8b89a' }, false));
        }
        rise(this, t, 4, a.cx - 12, a.cx + 12, GROUND, 26, (i, p) => `rgba(255,244,190,${A(1 - p)})`, 0.45, 13, (x, y) => inFace(a, x, y, 1) || (x >= a.left && x <= a.right));
      },
    },

    // 14. 휘감는 용 기운: 금빛 동양 용이 고양이 뒤를 S자로 감아 돈다. 앞으로 올 땐 몸 아래쪽을 지나간다. 머리엔 뿔·긴 수염
    dragonaura: {
      back(g, a, c, t) { this._dragon(a, t, false); },
      front(g, a, c, t) { this._dragon(a, t, true); },
    },

  };

  const P = root.PetSprite.PetRenderer.prototype;

  // 반딧불: back/front 에서 같은 계산, 깊이로 나눈다
  P._ffly = function (a, t, front) {
    for (let i = 0; i < 13; i++) {
      const wx = 0.28 + hash(i) * 0.25, wy = 0.4 + hash(i + 5) * 0.3;
      const pos = (tt) => [
        Math.round(a.cx + Math.sin(tt * wx + i * 2.1) * (9 + hash(i + 3) * 9) + Math.sin(tt * 1.3 + i) * 1),
        Math.round(a.cy - 8 + Math.sin(tt * wy + i * 1.3) * (7 + hash(i + 7) * 4) - hash(i + 9) * 6),
      ];
      const [x, y] = pos(t);
      const depth = Math.cos(t * wx + i * 2.1);
      const isFront = depth > 0 && !inFace(a, x, y, 1);
      if (isFront !== front) continue;
      const b = 0.5 + 0.5 * Math.sin(t * (1.4 + hash(i + 2) * 1.6) + i * 3);
      const far = !isFront ? 0.7 : 1;
      if (b > 0.35) {
        const [tx, ty] = pos(t - 0.35);
        this.px(tx, ty, `rgba(190,255,90,${A(0.25 * b * far)})`, false);
      }
      if (b < 0.15) { this.px(x, y, `rgba(150,200,80,${A(0.5 * far)})`, false); continue; }
      if (b > 0.3) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.px(x + dx, y + dy, `rgba(190,255,90,${A((b - 0.2) * 0.75 * far)})`, false);
      if (b > 0.7) for (const [dx, dy] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) this.px(x + dx, y + dy, `rgba(210,255,120,${A(0.28 * far)})`, false);
      this.px(x, y, b > 0.65 ? '#f6ffc0' : '#c8f25a', false);
    }
  };

  // 바람: 바람 선(끝이 돌돌) · 털 뭉치 · 나뭇잎. 앞에 오는 건 얼굴 상자를 피한다
  P._wind = function (g, a, c, t, front) {
    const skip = (x, y) => front && inFace(a, x, y);
    const LINES = 8;
    for (let i = 0; i < LINES; i++) {
      const isFront = i % 3 === 1;
      if (isFront !== front) continue;
      const y = Math.round(a.top - 10 + i * 2.7 + hash(i + 2) * 2);
      const sp = 26 + hash(i) * 14, span = 62;
      const hx = Math.round(((t * sp + hash(i + 8) * span) % span) - 8);
      const len = 5 + Math.round(hash(i + 4) * 5);
      for (let q = 0; q < len; q++) {
        const x = hx - q;
        const yy = y + Math.round(Math.sin((x + t * 20) * 0.35) * 0.6);
        if (skip(x, yy)) continue;
        this.px(x, yy, `rgba(255,255,255,${A(0.85 - (q / len) * 0.7)})`, false);
      }
      // 끝 말림
      if (i % 2 === 0) for (const [dx, dy] of [[1, -1], [1, -2], [0, -3], [-1, -2]]) if (!skip(hx + dx, y + dy)) this.px(hx + dx, y + dy, 'rgba(255,255,255,0.7)', false);
    }
    // 날아가는 것들
    const FUR = [['.L.', 'LBS', '.S.'], ['LB', 'BS'], ['.L', 'BS', 'S.']];
    const LEAF = [['.NN', 'Nn.'], ['NN', 'nN'], ['N.', 'Nn', '.n']];
    for (let i = 0; i < 5; i++) {
      const isFront = i % 2 === 0;
      if (isFront !== front) continue;
      const sp = 14 + hash(i + 30) * 10, span = 60;
      const x = Math.round(((t * sp + hash(i + 31) * span) % span) - 6);
      const y = Math.round(a.top - 6 + hash(i + 33) * 18 + Math.sin(t * 3 + i * 2) * 2.5);
      if (front && inFace(a, x, y, 2)) continue;
      const fr = Math.floor(t * 6 + i) % 3;
      if (i < 3) this.pattern(FUR[fr], x, y, { L: c.light || '#fbe8c6', B: c.body || '#f5a524', S: c.shade || '#e08a1a' }, false);
      else this.pattern(LEAF[fr], x, y, { N: i === 3 ? '#7cc85a' : '#e8a13a', n: i === 3 ? '#3f8a2e' : '#b0621c' }, false);
    }
    // 정수리 털이 바람에 파르르
    if (front) {
      const fl = Math.floor(t * 10) % 2;
      this.px(a.hx + 2 + fl, a.top - 1, c.body || '#f5a524', false);
      this.px(a.hx + 3 + fl, a.top - 1 - fl, c.light || '#fbe8c6', false);
    }
  };

  // 눈 결정: 떠돌며 천천히 돌고 반짝. 앞/뒤를 번갈아
  P._snowflakes = function (a, t, front) {
    const FL = [['..W..', 'W.B.W', '.BWB.', 'W.B.W', '..W..'], ['W.W.W', '.BBB.', 'WBWBW', '.BBB.', 'W.W.W']];
    for (let i = 0; i < 6; i++) {
      const isFront = i % 2 === 1;
      if (isFront !== front) continue;
      const tt = t * 0.5 + i * 1.7;
      const x = Math.round(a.cx - 16 + hash(i + 60) * 30 + Math.sin(tt * 1.4) * 2) - 2;
      const y = Math.round(a.top - 10 + ((tt * 4 + hash(i + 70) * 30) % 30)) - 2;
      if (front && inFace(a, x + 2, y + 2, 3)) continue;
      const big = i < 3;
      const al = 0.75 + 0.25 * Math.sin(t * 3 + i);
      if (big) faded(this, al, () => this.pattern(FL[Math.floor(t * 1.5 + i) % 2], x, y, { W: '#ffffff', B: '#9fd6ff' }, false));
      else twinkle(this, x + 2, y + 2, Math.floor(t * 3 + i) % 3, '#ffffff', 'rgba(170,220,255,0.75)');
    }
  };

  // 마법진: 바깥 고리·안 고리·룬 점·육망성. 뒤쪽 반은 back, 앞쪽 반은 front
  P._circle = function (a, t, front) {
    const cx = a.cx - 0.5, cy = GROUND - 0.5, RX = 14, RY = 4;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    const seen = new Set();
    const put = (x, y, col) => {
      const X = Math.round(x), Y = Math.round(y);
      if ((Y > cy - 0.5) !== front) return;
      const k = X + ',' + Y;
      if (seen.has(k)) return;
      seen.add(k);
      this.px(X, Y, col, false);
    };
    const rot = t * 0.7;
    // 룬 점 (바깥 고리와 안 고리 사이), 차례로 밝아진다
    for (let k = 0; k < 12; k++) {
      const ang = -rot * 1.3 + (k * Math.PI * 2) / 12;
      const lit = (Math.floor(t * 6) - k + 120) % 12 < 2;
      const rx = cx + Math.cos(ang) * RX * 0.88, ry = cy + Math.sin(ang) * RY * 0.88;
      put(rx, ry, lit ? '#ffffff' : '#7ff0ff');
      if (lit) { put(rx - 1, ry, 'rgba(160,250,255,0.8)'); put(rx + 1, ry, 'rgba(160,250,255,0.8)'); }
    }
    for (let s = 0; s < 96; s++) {
      const ang = (s / 96) * Math.PI * 2;
      const shine = Math.max(0, Math.cos(ang - rot * 2));
      put(cx + Math.cos(ang) * RX, cy + Math.sin(ang) * RY, shine > 0.92 ? '#ffffff' : `rgba(${lerp([196, 160, 255], [240, 228, 255], pulse)},1)`);
    }
    for (let s = 0; s < 72; s++) {
      const ang = (s / 72) * Math.PI * 2;
      if (s % 2) put(cx + Math.cos(ang) * RX * 0.72, cy + Math.sin(ang) * RY * 0.72, 'rgba(180,140,255,0.6)');
    }
    // 육망성 (두 삼각형이 도는 방향으로)
    for (let tri = 0; tri < 2; tri++) {
      for (let k = 0; k < 3; k++) {
        const a1 = rot + tri * Math.PI / 3 + (k * Math.PI * 2) / 3, a2 = a1 + (Math.PI * 2) / 3;
        const x1 = cx + Math.cos(a1) * RX * 0.72, y1 = cy + Math.sin(a1) * RY * 0.72;
        const x2 = cx + Math.cos(a2) * RX * 0.72, y2 = cy + Math.sin(a2) * RY * 0.72;
        const n = Math.ceil(Math.abs(x2 - x1)) + 1;
        for (let s = 0; s <= n; s++) put(x1 + ((x2 - x1) * s) / n, y1 + ((y2 - y1) * s) / n, `rgba(140,240,255,${A(0.3 + pulse * 0.25)})`);
      }
    }
  };

  // 용: 꼬리(아래)에서 머리(위)까지 나선으로 감아 오른다. 깊이 z>0 이고 얼굴 상자 밖이면 앞에 그린다
  P._dragon = function (a, t, front) {
    const N = 64;
    const yTail = GROUND - 1, yHead = a.top - 8;
    const at = (s) => {
      const ph = s * Math.PI * 2.3 + t * 1.7;
      const R = 7 + s * 3;
      return [a.cx - 0.5 + Math.sin(ph) * R, yTail + (yHead - yTail) * s + Math.sin(t * 2 + s * 6) * 0.6, Math.cos(ph)];
    };
    const PAL = { m: '#f2c040', l: '#fff1a8', d: '#b87a18', f: '#e8761e' };
    const halo = [];
    const body = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const [x, y, z] = at(s);
      const rr = 0.5 + s * 1.1;
      for (let yy = Math.floor(y - rr - 1); yy <= y + rr + 1; yy++)
        for (let xx = Math.floor(x - rr - 1); xx <= x + rr + 1; xx++) {
          const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
          const isF = z > 0 && !inFace(a, xx, yy, 1);
          if (isF !== front) continue;
          if (d <= rr + 0.35) body.push([xx, yy, d / (rr + 0.35), yy + 0.5 - y, i, z]);
          else if (d <= rr + 1.2) halo.push([xx, yy]);
        }
    }
    for (const [x, y] of halo) this.px(x, y, 'rgba(255,214,100,0.2)', false);
    const done = new Set();
    // 머리 쪽이 나중에 오게 (i 큰 게 위로 덮는다)
    for (const [x, y, d, dy, i, z] of body) {
      let col = d > 0.82 && dy > 0 ? '#9a5e12' : dy < -0.4 ? PAL.l : dy > 0.5 ? PAL.d : i % 4 === 0 ? '#ffe07a' : PAL.m;
      if (d < 0.5 && (i + Math.floor(t * 10)) % 7 === 0) col = '#ffffff'; // 비늘 반짝
      if (z < -0.3) col = col === PAL.l ? PAL.m : col === PAL.m ? '#d8a22c' : '#9a6412'; // 뒤로 돌면 어둡게
      this.px(x, y, col, false);
      done.add(x + ',' + y);
    }
    // 등 지느러미 (위쪽 가시)
    for (let i = 6; i < N - 6; i += 5) {
      const [x, y, z] = at(i / N);
      const isF = z > 0 && !inFace(a, Math.round(x), Math.round(y - 2), 1);
      if (isF !== front) continue;
      const rr = 0.5 + (i / N) * 1.1;
      this.px(x, y - rr - 1, PAL.f, false);
    }
    // 머리: 끝점 방향을 본다
    const [hx, hy, hz] = at(1);
    const [px0] = at(1 - 1 / N);
    const dir = hx >= px0 ? 1 : -1;
    const headFront = hz > 0 && !inFace(a, Math.round(hx), Math.round(hy), 3);
    if (headFront !== front) return;
    const HEAD = [
      'h...h...',
      '.hh.hh..',
      '.mmmmm..',
      'mmmEmmmm',
      'mmmmmmmW',
      'dfddddd.',
      '.f.WdW..',
    ];
    const rows = dir > 0 ? HEAD : mirror(HEAD);
    const ox = Math.round(hx) - (dir > 0 ? 2 : 5), oy = Math.round(hy) - 4;
    this.pattern(rows, ox, oy, { h: '#fff1a8', m: PAL.m, d: PAL.d, f: PAL.f, W: '#ffffff', E: Math.floor(t * 3) % 6 ? '#e8261a' : '#ffffff' }, false);
    // 긴 수염 두 가닥: 주둥이에서 뒤로 물결치며 흐른다
    const sx = dir > 0 ? ox + 7 : ox, sy = oy + 4;
    for (let w = 0; w < 2; w++)
      for (let k = 1; k <= 7; k++) {
        const x = sx - dir * k * 1.1 + dir * 1;
        const y = sy + (w ? 2 : -1) + Math.sin(t * 5 - k * 0.8 + w) * 1.2 + (w ? k * 0.25 : -k * 0.2);
        this.px(x, y, `rgba(255,236,150,${A(0.95 - k * 0.1)})`, false);
      }
    // 여의주 반짝
    if ((t * 1.5) % 1 < 0.5) twinkle(this, ox + (dir > 0 ? 10 : -3), oy + 2, 2, '#ffffff', 'rgba(255,220,120,0.7)');
  };

  Object.assign(root.PetSprite.ACCESSORIES, LAB);
})(window);
