// 사람 손길에 대한 반응 모션. 설정·상점에는 안 나오고, 상황에 따라 pet.js · main.js 가 튼다.
//  stir        : 자다가 건드리면 뒤척 (안 깬다)
//  wakeGrumpy  : 자꾸 건드려서 결국 깼다. 부스스 일어나 하품하고 째려본다
//  purr        : 문질러 쓰다듬으면 골골. 자고 있었으면 웅크린 채로
//  land        : 높은 데서 떨어져 쿵 착지. 납작해졌다가 먼지 폴폴, 한 번 째려본다
//  huntCrouch  : 커서를 노리고 몸을 낮춰 살금살금 (걸으면서 쓰는 자세)
//  backflip · levitate : 아주 가끔만 나오는 진짜 드문 모션 (깜짝 이벤트 rare)
(function (root) {
  const { rand, GROUND } = root.PetSprite.util;
  const every = (r, tag, at, period) => {
    const n = Math.floor(at / period);
    if (r.ms[tag] !== n) {
      r.ms[tag] = n;
      return true;
    }
    return false;
  };
  const once = (r, tag, cond) => {
    if (cond && !r.ms[tag]) {
      r.ms[tag] = true;
      return true;
    }
    return false;
  };
  const CONF = ['#ff6f91', '#ffd35c', '#6fb0ea', '#78c46a', '#b784f5'];

  const M = {
    stir: {
      len: 1.3,
      pose(p, k, at) {
        p.curl = true;
        p.eyes = 'closed';
        p.mouth = 'flat';
        p.ear = -1;
        // 몸을 한 번 꿈틀, 귀 한쪽 씰룩
        if (k > 0.15 && k < 0.45) {
          p.xf = { sx: 1.05, sy: 0.95 };
          p.dy = -1;
        }
        if (k > 0.5 && k < 0.65) p.ear = 1;
        void at;
      },
      step(r, k, at, dt, a) {
        if (once(r, 'dots', k > 0.3)) r.emit({ type: 'text', s: '...', x: r.scr(a.hx + 4), y: a.top - 4, vy: -2, life: 1, c: '#8b6f60' });
      },
    },
    wakeGrumpy: {
      len: 2.6,
      pose(p, k) {
        p.tail = 'slow';
        if (k < 0.25) {
          p.curl = true;
          p.eyes = 'half';
          p.mouth = 'flat';
          p.ear = -1;
        } else if (k < 0.55) {
          // 일어나서 크게 하품 (몸을 쭉 늘였다가 제자리로)
          const s = Math.sin(Math.PI * (k - 0.25) / 0.3);
          p.eyes = 'closed';
          p.mouth = s > 0.5 ? 'big' : 'o';
          p.xf = { sx: 1 - 0.05 * s, sy: 1 + 0.08 * s };
          p.ear = -1;
        } else {
          // 반쯤 뜬 눈으로 째려본다. 꼬리를 탁 치고 귀는 옆으로 눕힌 채
          p.eyes = 'half';
          p.mouth = 'flat';
          p.brow = 'angry';
          p.ear = -1;
          p.tail = k > 0.7 && k < 0.8 ? 'flick' : 'slow';
        }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'hm', k > 0.6)) r.emit({ type: 'text', s: 'HMPH', x: r.scr(a.hx + 6), y: a.top - 5, vy: -2, life: 1.2, c: '#f0ddd0' });
      },
    },
    purr: {
      len: 2.2,
      pose(p, k, at, r) {
        // 자고 있었으면 웅크린 채로, 아니면 앉은 채로 눈을 감고 골골
        p.curl = r.mood === 'sleeping';
        p.eyes = p.curl ? 'closed' : 'happy';
        p.mouth = 'smile';
        p.blush = true;
        p.tail = 'wag';
        p.ear = 0;
        // 골골 떨림: 아주 살짝 들썩
        p.dy = Math.floor(at * 18) % 2 ? -1 : 0;
      },
      step(r, k, at, dt, a) {
        if (every(r, 'h', at, 0.45)) r.emit({ type: 'heart', x: r.scr(a.hx + rand(-6, 6)), y: a.top - 2, vy: -6, life: 1.1 });
        if (once(r, 'prr', k > 0.1)) r.emit({ type: 'text', s: 'prr', x: r.scr(a.hx + 7), y: a.top - 6, vy: -2, life: 1.3, c: '#d97757' });
      },
    },
    land: {
      len: 1.9,
      pose(p, k) {
        p.tail = 'up';
        if (k < 0.12) {
          // 쿵! 납작
          p.xf = { sx: 1.25, sy: 0.72 };
          p.eyes = 'closed';
          p.mouth = 'o';
          p.ear = -1;
        } else if (k < 0.35) {
          p.xf = { sx: 0.95, sy: 1.06 };
          p.eyes = 'wide';
          p.mouth = 'o';
          p.ear = 1;
        } else {
          // 째려본다
          p.eyes = 'half';
          p.mouth = 'flat';
          p.ear = -1;
          p.tail = 'flick';
        }
      },
      step(r, k, at, dt) {
        if (once(r, 'dust', true)) {
          for (let i = 0; i < 6; i++) {
            const side = i % 2 ? 1 : -1;
            r.emit({ type: 'dust', x: 24 + side * rand(6, 12), y: GROUND, vx: side * rand(8, 18), vy: -rand(2, 6), life: 0.6 });
          }
        }
        void dt;
      },
    },
    swat: {
      // 쓰다듬기 싫은 날: 귀를 뒤로 젖히고 앞발로 탁! (살살)
      len: 1.1,
      pose(p, k) {
        p.ear = -1;
        p.tail = 'flick';
        p.brow = 'angry';
        if (k < 0.3) {
          // 앞발을 번쩍 치켜들고
          p.armL = 'up';
          p.eyes = 'squint';
          p.mouth = 'flat';
          p.xf = { sx: 0.97, sy: 1.04 };
        } else if (k < 0.55) {
          // 앞으로 탁! 내리친다
          p.armL = 'front';
          p.eyes = 'squint';
          p.mouth = 'open';
          p.dy = 1;
          p.xf = { sx: 1.06, sy: 0.94 };
        } else {
          p.eyes = 'half';
          p.mouth = 'flat';
        }
      },
      step(r, k, at, dt, a) {
        if (once(r, 'tak', k > 0.32)) r.emit({ type: 'text', s: '!', x: r.scr(a.hx - 1), y: a.top - 9, vy: -4, life: 0.8, c: '#e8534a' });
      },
    },
    huntCrouch: {
      len: 1, loop: true,
      pose(p, k, at) {
        // 엉덩이 씰룩씰룩 (덮치기 직전 고양이) — 몸 아래쪽만 좌우로 살짝
        const wig = Math.floor(at * 8) % 4;
        p.xf = { sx: 1.1, sy: 0.84, rot: wig === 1 ? 0.03 : wig === 3 ? -0.03 : 0, px: 24, py: 30 };
        p.dy = 1;
        p.eyes = 'wide';
        p.mouth = 'flat';
        p.ear = 1;
        p.tail = Math.floor(at * 3) % 2 ? 'flick' : 'idle';
      },
    },
    backflip: {
      len: 1.7,
      pose(p, k) {
        p.tail = 'up';
        p.ear = 1;
        if (k < 0.2) {
          p.xf = { sx: 1.12, sy: 0.84 };
          p.dy = 1;
          p.eyes = 'squint';
        } else if (k < 0.75) {
          const j = (k - 0.2) / 0.55;
          p.dy = -Math.sin(j * Math.PI) * 13;
          p.xf = { rot: -j * Math.PI * 2, px: 24, py: 34 };
          p.eyes = 'closed';
          p.armL = p.armR = 'up';
        } else {
          p.eyes = 'happy';
          p.mouth = 'open';
          p.armL = p.armR = 'up';
        }
      },
      step(r, k) {
        if (once(r, 'ta', k > 0.78)) for (let i = 0; i < 12; i++) r.emit({ type: 'confetti', x: 24 + rand(-10, 10), y: 30, vx: rand(-20, 20), vy: rand(-26, -8), ay: 40, life: 1, c: CONF[i % CONF.length] });
      },
    },
    levitate: {
      len: 3.4,
      pose(p, k, at) {
        // 식빵 자세 그대로 스르르 떠올라 명상. 반짝이가 맴돈다
        p.curl = true;
        p.eyes = 'closed';
        p.mouth = 'smile';
        const up = Math.sin(Math.min(1, k / 0.3) * Math.PI * 0.5) * (k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1);
        p.dy = -Math.round(up * 7 + Math.sin(at * 3) * up);
        p.noShadow = up > 0.3;
      },
      step(r, k, at) {
        if (every(r, 's', at, 0.18)) r.emit({ type: 'confetti', x: 24 + Math.cos(at * 4) * 12, y: 32 + Math.sin(at * 4) * 4, vx: 0, vy: -4, ay: 0, life: 0.6, c: '#ffd35c' });
      },
    },
  };

  Object.assign(root.PetSprite.MOTIONS, M);
})(window);
