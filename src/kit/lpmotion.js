// LP 테이블 놀이 (2.10.0). 고양이 우클릭 → 장난감 → LP 테이블을 누르면, 옆에 나무 LP 테이블을 두고
// 헤드폰을 낀 채 식빵 자세로 엎드려 음악을 듣는다. 실제 음악은 틀지 않는다 (음악은 홈의 LP 플레이어에서 따로).
//  - 처음 0.7초: 헤드폰이 위에서 내려와 착 / 마지막 0.6초: 헤드폰을 벗어 올려 보낸다
//  - 판이 돌며 반짝이가 한 바퀴씩 돌고, 톤암은 판 위에. 음표가 천천히, 가끔 하트
// 펫 창에서만 읽는다 (scripts/build.js 의 PET 목록). PetSprite.TOY_POSES 에 'lplisten' 으로 건다
(function (root) {
  const { rand, seg, ease } = root.PetSprite.util;
  const LISTEN_LEN = 40; // 초. 호스트(plugin/host.js 의 LP_LISTEN_MS)와 같게

  const every = (r, tag, at, period) => {
    const n = Math.floor(at / period);
    if (r.ms[tag] !== n) {
      r.ms[tag] = n;
      return true;
    }
    return false;
  };

  // 나무 LP 테이블 (가로 16 · 세로 12). playing 이면 판 위 반짝이가 돌고 톤암이 판 위로
  const C = { dark: '#2b1a10', top: '#c79a66', top2: '#d6ad7c', front: '#8a6238', plat: '#2a2a33', ring: '#454553', label: '#e0574a', spindle: '#fff7d0', arm: '#d3cabb', head: '#e9e2d3', knob: '#e9b93a', glint: '#9aa0b5', glint2: '#6a6e80' };
  function tableOps(t, playing) {
    const ops = [];
    const P = (x, y, c) => ops.push([x, y, c]);
    const line = (x0, y0, x1, y1, c) => {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let e = dx - dy;
      for (;;) {
        P(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 > -dy) {
          e -= dy;
          x0 += sx;
        }
        if (e2 < dx) {
          e += dx;
          y0 += sy;
        }
      }
    };
    for (let y = 4; y <= 11; y++) {
      for (let x = 0; x <= 15; x++) {
        const corner = (y === 4 || y === 11) && (x === 0 || x === 15);
        if (corner) continue;
        const edge = x === 0 || x === 15 || y === 4 || y === 11;
        P(x, y, edge ? C.dark : y === 5 ? C.top2 : y <= 8 ? C.top : C.front);
      }
    }
    for (let y = 5; y <= 8; y++) {
      for (let x = 0; x <= 12; x++) {
        const d = ((x - 6) / 5.4) ** 2 + ((y - 6.5) / 2.7) ** 2;
        if (d <= 1) P(x, y, d > 0.7 ? C.ring : C.plat);
      }
    }
    P(5, 6, C.label);
    P(6, 6, C.spindle);
    if (playing) {
      const ring = [[2, 6], [3, 5], [5, 5], [8, 5], [10, 6], [9, 8], [7, 8], [3, 8]];
      const f = Math.floor(t * 9) % ring.length;
      P(ring[f][0], ring[f][1], C.glint);
      const g = (f + 4) % ring.length;
      P(ring[g][0], ring[g][1], C.glint2);
    }
    const tip = playing ? [8, 7] : [13, 9];
    P(13, 5, C.knob);
    line(13, 6, tip[0], tip[1], C.arm);
    P(tip[0], tip[1], C.head);
    P(14, 10, C.knob);
    P(13, 10, C.dark);
    return ops;
  }

  // 헤드폰 (옷장의 헤드폰과 같은 그림)
  const HP = ['......KKKKKKKKK......', '....KKDDDDDDDDDKK....', '...KDDKKKKKKKKKDDK...', '..KDK...........KDK..', '..KDK...........KDK..', 'KKKKK...........KKKKK', 'KDDDK...........KDDDK', 'KDHCK...........KCHDK', 'KDDCK...........KCDDK', 'KDDDK...........KDDDK', '.KKK.............KKK.'];
  const HPC = { K: '#2b2a33', D: '#565a6c', H: '#9aa0b5', C: '#e8863c' };

  const TP = {
    lplisten: {
      len: LISTEN_LEN,
      pose(p, k, at) {
        p.curl = true;
        p.eyes = at < 0.8 ? 'open' : Math.floor(at * 0.8) % 2 ? 'half' : 'happy';
        p.tail = 'slow';
        p.sy = Math.sin(at * 1.6) > 0.3 ? 1.02 : 1; // 숨 쉴 때 등이 부푼다
        p.blush = at > 2;
      },
      back(g, a, k, at) {
        for (const [x, y, c] of tableOps(at, at > 0.6)) this.px(31 + x, 33 + y, c, false);
      },
      front(g, a, k, at) {
        const on = ease(seg(at, 0, 0.7));
        const off = ease(seg(at, LISTEN_LEN - 0.6, LISTEN_LEN));
        const dy = Math.round(-16 * (1 - on) - 16 * off);
        this.pattern(HP, a.hx - 10, a.earTop - 4 + dy, HPC);
      },
      step(r, k, at, dt, a) {
        if (at < 1 || at > LISTEN_LEN - 0.8) return;
        if (every(r, 'n', at, 1.1)) r.emit({ type: Math.random() < 0.3 ? 'heart' : 'note', x: r.scr(a.hx + rand(-8, 8)), y: a.top - 3, vy: -9, vx: rand(-4, 4), life: 1.2 });
      },
    },
  };

  root.PetSprite.TOY_POSES = Object.assign(root.PetSprite.TOY_POSES || {}, TP);
  root.PetSprite.LP_TABLE = tableOps; // 시안 · 테스트용
})(typeof globalThis !== 'undefined' ? globalThis : this);
