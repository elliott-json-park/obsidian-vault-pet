// 동네 친구 동물 그림 (7차, 2026-09-23 확정 · 2026-09-24 디자인 2차). 고양이 친구(먼지·연탄이·두부·최번개·돈돈까스)은 sprite.js 의 GUEST_FURS 로 그린다.
// 고양이와 같은 48칸 캔버스에, 같은 바닥 줄(GROUND)에 앞모습 치비로 그린다. 펫 창·하우스 도감이 같이 쓴다.
//  half : 왼쪽 절반 + 가운데 열(마지막 글자). 오른쪽은 거울로 채운다
//  rows : 좌우가 다른 친구는 통째로
//  patch: [[x, y, 글자], ...] 다 짠 그림에서 몇 칸만 바꾼다
//  extra: [{ x, y, rows, behind }] 몸 왼쪽 위 기준으로 덧찍는 조각 (꼬리 등). behind 면 몸보다 먼저
//         show(t, mode) 가 있으면 참일 때만, off(t, mode) → [dx, dy] 만큼 옮겨서, still 이면 몸이 들썩여도 제자리
//  alt  : [{ when(t, mode), half | rows | patch }] 조건이 맞으면 몸 그림을 갈아 끼운다 (몸 말기 등). patch 만 있으면 원래 그림에서 몇 칸만
//  move : [{ from, to, off(t, mode) → [dx, dy] }] 몸의 몇 줄만 따로 움직인다 (고개 까딱)
//  noLegs: 다리가 없는 친구(달팽이). 맨 아랫줄이 발처럼 따로 놀지 않고 몸과 같이 움직인다
// 글자: O 외곽선 · E 눈 · H 눈 반짝 · 나머지는 친구마다 pal
(function (root) {
  const EYE = '#1b1410';
  const ART = {};
  const add = (key, pal, spec) => (ART[key] = { pal: { E: EYE, H: '#ffffff', ...pal }, ...spec });
  // every 초마다 len 초 동안 참
  const per = (t, every, len, ph = 0) => (t + ph) % every < len;
  const step = (t) => Math.floor(t * 6) % 2;

  // 구구단: 통통한 가슴 + 초록·보라 무지갯빛 목 + 주황 눈테. 서 있어도 고개를 까딱까딱 (걸을 땐 걸음마다)
  add('pigeon', { O: '#2d2f38', B: '#a3abbb', D: '#6f7686', L: '#c9cfd9', G: '#5fa67f', V: '#9a6fb5', W: '#f2f2f2', Y: '#3d3f47', R: '#f08a2a', P: '#ee8f98' }, {
    half: ['.....OOO', '....OBBB', '...OBBBB', '...OREBB', '...OBEBW', '...OBBBY', '..OGVGGG', '.OGGVGVG', 'OBBGGGGL', 'ODBBBLLL', 'ODDBBLLL', 'ODBDBBLL', '.OBBBBBB', '..OOOOOO', '....PP..'],
    move: [{ from: 0, to: 6, off: (t, m) => [0, m === 'walk' ? step(t) : per(t, 1.3, 0.22) || per(t, 1.3, 0.22, 0.45) ? 1 : 0] }],
  });
  // 고도리: 밤송이처럼 동그란 공에 얼굴이 빼꼼. 긴장하면(가끔) 쏙 말려서 얼굴이 사라진다
  add('hedgehog', { O: '#2f2218', S: '#6b4e36', s: '#9a7656', t: '#d2b48c', F: '#f3dfc3', N: '#2a1a12', C: '#f2a2a0', P: '#e6b89a' }, {
    half: ['....t.t.t', '..t.OtOtO', '.tOSSsSSs', '..OSsSSsS', 'tOSSSSsSS', '.OsSSsSSS', 'tOSSSSFFF', '.OSsSFFFF', 'tOSSFEHFF', '.OSSFEEFF', '.tOSFCFFN', '..OSSFFFF', '...OOPPOO'],
    alt: [{
      when: (t, m) => m !== 'walk' && per(t, 6, 1.4, 3),
      half: ['....t.t.t', '..t.OtOtO', '.tOSSsSSs', '..OSsSSsS', 'tOSSSSsSS', '.OsSSsSSS', 'tOSSSSSsS', '.OSsSSsSS', 'tOSSSsSSs', '.OSsSSSsS', '.tOSSSSSN', '..OSsSSSS', '...OOOOOO'],
    }],
  });
  // 라면이: 빈 컵라면 용기를 모자처럼 뒤집어 쓴 반짝이 수집가. 한 손에 주운 금색 병뚜껑을 가끔 번쩍 들어 보이며 씨익 (2026-09-24 디자인 3차)
  const peek = (t, m) => m !== 'walk' && per(t, 3.6, 1.2, 0.5);
  add('raccoon', {
    O: '#2b2320', B: '#a39585', D: '#6e6157', L: '#e2d8ca', K: '#3d322c', k: '#5b4c43', W: '#f8f3eb', N: '#1a1412', P: '#eaa0a0',
    R: '#d8343a', r: '#a3242a', G: '#f2c14e', g: '#c98f12', h: '#fff6c8',
  }, {
    half: ['..OO....', '.OKPO...', '.OBBBBBD', 'OBBWWWBD', 'OBkkEEkL', 'OBkkEEkL', 'OWWkkLLN', '.OWWWLLL', '..OBBWWW', '.OBBBWWW', 'OBBBBWWW', 'ODBBBWWW', '.ODBBBWW', '..OKKOOO', '...OO...'],
    patch: [[7, 7, 'O'], [8, 7, 'O'], [9, 6, 'O']], // 씨익 웃는 입
    extra: [
      // 줄무늬 꼬리 (오른쪽 아래, 살랑)
      { x: 12, y: 8, behind: true, off: (t, m) => [m !== 'walk' && Math.sin(t * 2.6) > 0.3 ? 1 : 0, 0], rows: ['....OO', '...OKKO', '..OBBBO', '.OKKKO.', 'OBBBO..', 'OKKO...'] },
      // 컵라면 모자 (뒤집어 씀)
      { x: 4, y: -3, rows: ['.OOOOO.', '.ORRRO.', 'OrRWRrO', 'ORRRRRO', 'OOOOOOO'] },
      // 병뚜껑 든 손 (살짝 들어 올렸다 내렸다)
      { x: 12, y: 4, off: (t, m) => [0, peek(t, m) ? -1 : 0], rows: ['.OOO.', 'OGhGO', 'OgGgO', '.OOO.', 'OKKO', 'OKKO', '.OBO'] },
      // 번쩍
      { x: 15, y: 1, show: (t, m) => peek(t, m) && step(t), rows: ['.h.', 'hHh', '.h.'] },
      { x: 17, y: 3, show: (t, m) => peek(t, m) && !step(t), rows: ['H'] },
      // 반대 앞발
      { x: 1, y: 9, rows: ['OK', 'OK'] },
    ],
  });

  // 한 장 짜기: 거울로 펴고, 폭을 맞추고, patch 를 찍는다. base = alt 가 patch 만 있을 때의 원래 그림
  function build(d, base) {
    let rows = d.rows;
    if (!rows && d.half) {
      const w = Math.max(...d.half.map((r) => r.length));
      rows = d.half.map((h) => {
        const s = h.padStart(w, '.');
        return s + [...s.slice(0, -1)].reverse().join('');
      });
    }
    rows = rows || base;
    const w = Math.max(...rows.map((r) => r.length));
    const out = rows.map((r) => [...r.padEnd(w, '.')]);
    for (const [x, y, ch] of d.patch || []) if (out[y]) out[y][x] = ch;
    return out.map((r) => r.join(''));
  }
  function full(def) {
    return def._rows || (def._rows = build(def));
  }

  // 48칸 캔버스에 친구 하나. mode: idle · walk · hop · eat · held
  //  facing -1 이면 왼쪽을 본다 (그림을 뒤집는다)
  function draw(ctx, key, t, mode = 'idle', facing = 1, G = 48, GROUND = 44) {
    const def = ART[key];
    if (!def) return;
    const base = full(def);
    let rows = base;
    for (const a of def.alt || []) if (a.when(t, mode)) { rows = a._rows || (a._rows = build(a, base)); break; }
    const w = base[0].length, h = base.length;
    const bh = rows.length;
    const x0 = Math.round(G / 2 - w / 2);
    const blink = t % 3.3 < 0.14 && mode !== 'eat';
    const k = Math.floor(t * 6) % 2;
    const walking = mode === 'walk';
    let bob = walking ? (k ? -1 : 0) : Math.sin(t * 2.2) > 0.6 ? -1 : 0;
    if (mode === 'hop') bob = -Math.round(Math.abs(Math.sin(t * 7)) * 4);
    if (mode === 'eat') bob = Math.floor(t * 5) % 2;
    const y0 = GROUND - h + 1;
    const X = (x) => (facing < 0 ? G - 1 - x : x);
    const px = (x, y, c) => {
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(X(x), y, 1, 1);
    };
    const col = (ch) => (ch === '.' ? null : def.pal[ch] || def.pal.B || '#f0f');
    // 그림자 (들려 있으면 없다)
    if (mode !== 'held') {
      ctx.fillStyle = 'rgba(30,15,8,0.22)';
      for (let x = x0 + 1; x < x0 + w - 1; x++) ctx.fillRect(X(x), GROUND + 1, 1, 1);
    }
    const stamp = (s) => {
      if (s.show && !s.show(t, mode)) return;
      const [ox, oy] = s.off ? s.off(t, mode) : [0, 0];
      const dy = (s.still && mode !== 'hop' ? 0 : bob) + oy;
      s.rows.forEach((r, j) => [...r].forEach((ch, i) => px(x0 + s.x + i + ox, y0 + s.y + j + dy, col(ch))));
    };
    for (const s of def.extra || []) if (s.behind) stamp(s);
    rows.forEach((r, j) => {
      const last = j === bh - 1;
      let mx = 0, my = 0;
      for (const m of def.move || []) if (j >= m.from && j < m.to) { const o = m.off(t, mode); mx += o[0]; my += o[1]; }
      [...r].forEach((ch, i) => {
        let c = ch;
        // 눈 깜빡: 두 줄짜리 눈의 윗줄(과 반짝)을 옆 털색으로 덮는다
        if (blink && (c === 'E' || c === 'H')) {
          const below = rows[j + 1] ? rows[j + 1][i] : '.';
          if (c === 'H' || below === 'E' || below === 'H') c = [r[i - 1], r[i + 1], r[i - 2], r[i + 2]].find((q) => q && !'OEH.'.includes(q)) || 'B';
        }
        let dy = bob;
        if (last) dy = mode === 'hop' || def.noLegs ? bob : walking && (i < w / 2) === !!k ? -1 : mode === 'held' ? 1 : 0;
        px(x0 + i + mx, y0 + j + dy + my + (h - bh), col(c));
        // 몸이 들썩여 발(맨 아랫줄)보다 높이 뜨면 사이가 비어 다리가 떨어져 보인다. 빈 줄을 발 그림으로 이어 붙인다
        if (last) for (let gy = bob; gy < dy; gy++) px(x0 + i + mx, y0 + j + gy + my + (h - bh), col(c));
      });
    });
    for (const s of def.extra || []) if (!s.behind) stamp(s);
  }

  // 그림에서 몸이 차지하는 칸인가 (마우스로 집기·더블 클릭)
  function hit(key, gx, gy, G = 48, GROUND = 44) {
    const def = ART[key];
    if (!def) return false;
    const rows = full(def);
    const w = rows[0].length, h = rows.length;
    const x0 = Math.round(G / 2 - w / 2), y0 = GROUND - h + 1;
    return gx >= x0 - 1 && gx <= x0 + w && gy >= y0 - 1 && gy <= GROUND + 1;
  }

  root.PetFriends = { ART, draw, hit };
})(typeof window !== 'undefined' ? window : globalThis);
