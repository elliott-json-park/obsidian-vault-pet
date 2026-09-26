// 2차 장난감 동작 (3/3): 눈덩이, RC 쥐 자동차, UFO, 방울 달린 막대 새, 공 발사기, 줄넘기, 고양이 전용 노트북
(function (root) {
  const K = root.ToyKit;
  const FT = PetToys;
  const { stamp, ftext, disc, chase, pop, burst, commonStep, commonDraw, sfx, H } = K;
  const C = {};
  const inBox = (e, x, y, w, h) => e.clientX >= x - w / 2 && e.clientX <= x + w / 2 && e.clientY >= y - h && e.clientY <= y;

  // ================= T28 눈덩이 =================
  // 아무 데나 꾹 누르면 눈을 뭉친다(누를수록 커진다). 휙 던지듯 놓으면 날아간다.
  // 고양이가 맞으면 눈사람이 됐다가 부르르. 바닥에 떨어진 눈덩이는 고양이가 사람(마우스) 쪽으로 되받아 찬다
  C.snowball = {
    cursor: true,
    start(o) {
      o.balls = [];
      o.hist = [];
    },
    down(o) {
      o.pack = { r: 3 };
    },
    up(o) {
      const p = o.pack;
      o.pack = null;
      if (!p) return;
      // 최근 마우스 움직임으로 던지는 힘을 잰다. 가만히 놓으면 고양이 쪽으로 살짝 던진다
      const h = o.hist;
      const a = h[0] || { x: mouseX, y: mouseY, t: performance.now() - 100 };
      const b = h[h.length - 1] || { x: mouseX, y: mouseY, t: performance.now() };
      const secs = Math.max(0.03, (b.t - a.t) / 1000);
      let vx = ((b.x - a.x) / secs) * 0.8;
      let vy = ((b.y - a.y) / secs) * 0.8;
      if (Math.hypot(vx, vy) < 120) {
        vx = (Math.sign(catX - mouseX) || 1) * 380;
        vy = -260;
      }
      o.balls.push({ x: mouseX, y: mouseY, vx: clamp(vx, -1400, 1400), vy: clamp(vy, -1400, 1400), r: p.r, flying: true, t: performance.now() });
      sfx('pop', 0.02);
    },
    click() {},
    step(o, dt, now) {
      commonStep(o, dt, now);
      o.hist.push({ x: mouseX, y: mouseY, t: now });
      while (o.hist.length && now - o.hist[0].t > 120) o.hist.shift();
      if (o.pack) o.pack.r = Math.min(petPx() * 0.16, o.pack.r + 14 * dt);
      for (const b of o.balls) {
        if (!b.flying) continue;
        b.vy += 1300 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < b.r || b.x > window.innerWidth - b.r) b.vx = -b.vx * 0.5;
        if (!b.kicked && K.hitsCat(b.x, b.y, b.r) && now > (o.snowUntil || 0)) {
          // 퍽! 눈사람
          b.dead = true;
          sfx('bonk', 0.03);
          pop(o, 'THWUMP', catX, K.catTop() - 18, '#ffffff', 700);
          burst(o, b.x, b.y, 14, ['#ffffff', '#dfeaf5'], 200, 700);
          sprite.setToyPose(null);
          if (catLift <= 0) sprite.play('toySnowman');
          o.snowUntil = now + 2400;
          o.busyUntil = now + 2400;
          pet.caught();
        } else if (b.y + b.r >= floorY()) {
          b.y = floorY() - b.r;
          b.flying = false;
          b.t = now;
          if (Math.abs(b.vy) > 400) burst(o, b.x, b.y + b.r, 5, ['#ffffff'], 100, 400);
        }
      }
      o.balls = o.balls.filter((b) => !b.dead && (b.flying || now - b.t < 6000));
      if (catLift > 0 || now < (o.busyUntil || 0)) return sprite.setMove(0);
      // 바닥에 떨어진 눈덩이를 앞발로 톡 쳐서 부순다. 없으면 사람(마우스) 쪽을 경계
      const ground = o.balls.find((b) => !b.flying);
      if (ground) {
        chase(o, { x: ground.x, y: ground.y }, dt, now, () => {
          // 뻥! 마우스 쪽으로 되받아 찬다. 두 번째로 차인 건 부서진다
          if (ground.kicked) {
            ground.dead = true;
            burst(o, ground.x, ground.y, 10, ['#ffffff', '#dfeaf5'], 160, 600);
          } else {
            Object.assign(ground, { kicked: true, flying: true, vx: clamp((mouseX - ground.x) * 1.4, -700, 700), vy: -560 });
            pop(o, 'KICK', ground.x, ground.y - 20, '#bfe6ff', 600);
          }
          sfx('pop', 0.02);
          scored(o, now);
        }, { noLeap: true, every: 800 });
      } else {
        sprite.setMove(0);
        face(mouseX);
        sprite.setToyPose(o.pack ? 'toyHide' : null);
      }
    },
    draw(ctx, o, D, now) {
      const ball = (x, y, r) => {
        disc(ctx, x, y, r, D, '#ffffff', '#9fb4c8');
        FT.dotAt(ctx, x - r * 0.35, y - r * 0.35, D, '#dfeaf5');
      };
      for (const b of o.balls) ball(b.x, b.y, b.r);
      if (o.pack) ball(mouseX, mouseY, o.pack.r);
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T31 RC 쥐 자동차 =================
  // 쥐 모양 자동차가 마우스 쪽으로 달려간다. 클릭하면 부스터! 고양이가 덮치면 뒤집혀서 바퀴만 헛돈다
  const CAR = ['....KK.......', '...KPPK......', '..KKGGKKKK...', '.KGGGGGGGGKK.', 'KGGGGGGGGKGGK', 'KGGGGGGGGGGGP', 'KKKKKKKKKKKKK', '.KDK....KDK..'];
  C.rccar = {
    cursor: true,
    start(o, side) {
      Object.assign(o, { cx: clamp(catX + side * petPx() * 1.5, 30, window.innerWidth - 30), cv: 0, flipped: 0, boost: 0 });
    },
    click(o) {
      if (o.flipped) return;
      o.boost = performance.now() + 900;
      sfx('spin', 0.02);
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      const W = window.innerWidth;
      if (o.flipped && now > o.flipped) o.flipped = 0;
      if (!o.flipped) {
        const want = mouseX == null ? o.cx : mouseX;
        const top = now < o.boost ? 420 : 170;
        const acc = Math.sign(want - o.cx) * 900;
        o.cv = clamp(o.cv + acc * dt, -top, top);
        if (Math.abs(want - o.cx) < 12) o.cv *= Math.pow(0.02, dt);
        o.cx = clamp(o.cx + o.cv * dt, 16, W - 16);
      }
      if (K.landed(o, now)) return;
      if (o.flipped) {
        // 뒤집힌 차 위에 앉아 의기양양
        if (catLift <= 0 && walkTo(o.cx, dt, 1, 4) <= 4) {
          sprite.setMove(0);
          sprite.setToyPose('toySitOn');
        }
        return;
      }
      sprite.setToyPose(null);
      chase(o, { x: o.cx, y: floorY() - 6 }, dt, now, () => {
        o.flipped = now + 2800;
        o.cv = 0;
        sfx('bonk', 0.03);
        pop(o, 'FLIP', o.cx, floorY() - 40, '#ffd35c', 700);
        burst(o, o.cx, floorY() - 6, 6, ['#d3cabb', '#565d69'], 140, 500);
        scored(o, now);
      }, { fast: 1.3, noLeap: true, every: 900 });
    },
    draw(ctx, o, D, now) {
      const t = now / 1000;
      const flip = o.cv < 0;
      if (o.flipped) {
        // 뒤집힌 차 위에 고양이가 올라앉으니 차는 고양이 뒤(아래)로
        const up = [...CAR].reverse();
        const w = (CAR[0].length + 2) * D;
        FT.underCat(ctx, (g) => stamp(g, up, o.cx, floorY() - 4 * D, D, flip), [o.cx - w / 2, floorY() - 10 * D, w, 11 * D]);
        if (Math.floor(t * 20) % 2) {
          FT.dotAt(ctx, o.cx - 4 * D, floorY() - 9 * D, D, '#8f95a0');
          FT.dotAt(ctx, o.cx + 4 * D, floorY() - 9 * D, D, '#8f95a0');
        }
      } else {
        const bump = Math.abs(o.cv) > 50 && Math.floor(t * 16) % 2 ? D : 0;
        stamp(ctx, CAR, o.cx, floorY() - 4 * D - bump, D, flip);
        // 꼬리 (안테나 겸용)
        const back = flip ? 1 : -1;
        const wag = Math.round(Math.sin(t * 12)) * D;
        FT.line(ctx, o.cx + back * 6 * D, floorY() - 5 * D - bump, o.cx + back * 9 * D, floorY() - 9 * D - bump + wag, D, '#ff9bb8');
        if (now < o.boost) for (let i = 0; i < 3; i++) FT.dotAt(ctx, o.cx - Math.sign(o.cv) * (7 + i * 3) * D, floorY() - (3 + (i % 2)) * D, D, i ? '#ffd35c' : '#ff9a3c');
      }
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T32 UFO 장난감 =================
  // UFO가 마우스를 따라 난다. 꾹 누르면 초록 빔. 빔에 걸린 고양이는 둥실 빨려 올라갔다가, 떼면 떨어진다
  // 하늘색 유리 돔(안테나·광택), 회색 접시, 둘레에 번갈아 켜지는 불빛, 아래 빔 구멍
  const UFO = [
    '......K......',
    '.....KYK.....',
    '....KKKKK....',
    '...KUUUUUK...',
    '..KUHUUUUUK..',
    '.KGGGGGGGGGK.',
    'KgYgRgYgRgYgK',
    '.KgggggggggK.',
    '...KKMMMKK...',
  ];
  C.ufotoy = {
    cursor: true,
    start(o) {
      Object.assign(o, { ux: mouseX, uy: mouseY, beam: false });
    },
    down(o) {
      o.beam = true;
      sfx('spin', 0.02);
    },
    up(o) {
      o.beam = false;
      if (o.lifting) {
        o.lifting = false;
        floating = false;
        catVy = 0;
        sprite.setToyPose(null);
      }
    },
    click() {},
    step(o, dt, now) {
      commonStep(o, dt, now);
      const P = petPx();
      o.ux += (mouseX - o.ux) * Math.min(1, dt * 4);
      o.uy += (Math.min(mouseY, floorY() - P * 0.8) - o.uy) * Math.min(1, dt * 4);
      const under = Math.abs(catX - o.ux) < P * 0.45;
      if (o.beam && under && (catLift <= 0 || o.lifting)) {
        // 빔에 걸렸다! 둥실둥실 빨려 올라간다
        if (!o.lifting) {
          o.lifting = true;
          floating = true;
          sprite.cancel();
          sprite.setToyPose('toyFloat');
          pet.caught();
        }
        const topLift = Math.max(0, floorY() - o.uy - P * 0.9);
        catLift = Math.min(topLift, catLift + 90 * dt);
        catX += (o.ux - catX) * Math.min(1, dt * 3);
        placeCat();
        return;
      }
      if (o.lifting) {
        o.lifting = false;
        floating = false;
        catVy = 0;
        sprite.setToyPose(null);
      }
      if (K.landed(o, now)) return;
      chase(o, { x: o.ux, y: o.uy + 4 * itemDot() }, dt, now, () => {
        // 앞발에 맞은 UFO가 휘청 도망
        o.uy -= 60;
        pop(o, 'BZZT', o.ux, o.uy - 20, '#b7e3a8', 600);
        scored(o, now);
      });
    },
    end(o) {
      if (o.lifting) floating = false;
    },
    draw(ctx, o, D, now) {
      const t = now / 1000;
      if (o.beam) {
        // 아래로 퍼지는 초록 빔. 빛줄기는 고양이 뒤에 깔고(고양이가 초록으로 물들지 않게), 반짝이 알갱이만 앞에서 빨려 올라간다
        const top = o.uy + 5 * (D + 1);
        const bottom = floorY();
        const wMax = 5 * D + (bottom - top) * 0.22;
        FT.underCat(ctx, (g) => {
          for (let y = top; y < bottom; y += D) {
            const w = Math.round((5 * D + (y - top) * 0.22) / D) * D;
            g.fillStyle = `rgba(170,255,170,${0.2 + (Math.floor(t * 10 - y / 8) % 3 === 0 ? 0.08 : 0)})`;
            g.fillRect(Math.floor(o.ux / D) * D - w, Math.floor(y / D) * D, w * 2, D);
          }
        }, [o.ux - wMax - D, top, wMax * 2 + 3 * D, bottom - top + D]);
        for (let i = 0; i < 7; i++) {
          const k = (t * 0.8 + i / 7) % 1;
          const y = bottom - k * (bottom - top);
          const w = 5 * D + (y - top) * 0.22;
          FT.dotAt(ctx, o.ux + Math.sin(i * 2.3 + t * 3) * w * 0.7, y, D, `rgba(230,255,220,${0.9 - k * 0.6})`);
        }
      }
      const lights = UFO.map((r, j) => (j === 6 && Math.floor(t * 6) % 2 ? r.replace(/Y/g, 'P') : r));
      // 장난감이라도 고양이 머리보다는 크게 (한 눈금 큰 도트)
      stamp(ctx, o.beam ? lights : lights.map((r, j) => (j === 8 ? r.replace(/M/g, 'g') : r)), o.ux, o.uy + Math.round(Math.sin(t * 3) * 2), D + 1);
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T36 공 발사기 =================
  // 3초마다 공이 퐁! 기계를 누르면 한 번 더. 고양이는 공마다 쫓아가느라 정신없다 (공은 최대 6개)
  // 상점 그림처럼 회색 돔: 꼭대기에 빨간 테를 두른 공 구멍, 가운데 노란 불빛(쏠 때 켜진다), 검은 받침과 발
  const LAUNCHER = [
    '....KKKKK....',
    '...KRcccRK...',
    '..KKRRRRRKK..',
    '..KgGGGGGgK..',
    '.KgGHGGGGGgK.',
    'KgGHGGGGGGGgK',
    'KgGGGGGGGGGgK',
    'KgGGGYYYGGGgK',
    'KKKKKKKKKKKKK',
    'KDDDDDDDDDDDK',
    'KKKKKKKKKKKKK',
    '.KDK.....KDK.',
  ];
  // 발사기가 쏘는 작은 공 (고양이 앞발만 한 크기). 빨강·파랑·노랑이 번갈아
  const MINI_BALL = ['..KKK..', '.KRHRK.', 'KRHRRRK', 'KRRRRrK', 'KRRRrrK', '.KrrrK.', '..KKK..'];
  const BALL_TINT = [['R', 'r'], ['B', 'b'], ['Y', 'y']];
  C.ballshooter = {
    start(o, side) {
      Object.assign(o, { sx: clamp(catX + side * petPx() * 1.3, 40, window.innerWidth - 40), next: performance.now() + 1200, puff: 0, bats: 0 });
    },
    wantsMouse(o, e) {
      const S = itemDot() + 1;
      return inBox(e, o.sx, floorY(), LAUNCHER[0].length * S + 10, LAUNCHER.length * S + 10);
    },
    down() {},
    click(o) {
      this.fire(o);
    },
    fire(o) {
      const now = performance.now();
      o.next = now + 3000;
      o.puff = now;
      burst(o, o.sx, floorY() - LAUNCHER.length * (itemDot() + 1), 5, ['#ffffff', '#d3cabb'], 120, 400);
      const D = itemDot();
      const [c1, c2] = BALL_TINT[(o.shots = (o.shots || 0) + 1) % BALL_TINT.length];
      const rows = MINI_BALL.map((r) => r.replace(/R/g, c1).replace(/r/g, c2));
      const it = K.extra(o, 'ball', o.sx, floorY() - LAUNCHER.length * (D + 1), rows);
      it.vx = rand(-260, 260);
      it.vy = rand(-760, -520);
      if (o.extras.length > 6) K.dropItem(o, o.extras[0]);
      sfx('pop', 0.03);
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      if (now > o.next) this.fire(o);
      if (catLift > 0 || now < (o.busyUntil || 0)) return sprite.setMove(0);
      // 공이 잔뜩 쌓였으면 공 더미에 다이빙! 공이 사방으로 튄다
      const onFloor = o.extras.filter((b) => b.y >= floorY() - b.half - 2);
      if (onFloor.length >= 5 && now > (o.diveAt || 0)) {
        const mid = onFloor.reduce((a, b) => a + b.x, 0) / onFloor.length;
        if (walkTo(mid, dt, 1.2, 20) > 20) return;
        o.diveAt = now + 8000;
        leap(petPx() * 0.4);
        K.later(o, 380, () => {
          for (const b of o.extras) Object.assign(b, { vx: rand(-420, 420), vy: rand(-700, -350) });
          burst(o, catX, floorY() - 6, 10, ['#ffffff', '#e5463f', '#72b3ea'], 220, 700);
          pop(o, 'SPLOOSH', catX, K.catTop() - 20, '#ffd35c', 800);
          sfx('bonk', 0.03);
        });
        scored(o, now);
        return;
      }
      // 가장 가까운 공
      let best = null;
      for (const b of o.extras) if (!best || Math.abs(b.x - catX) < Math.abs(best.x - catX)) best = b;
      if (!best) return sprite.setMove(0);
      chase(o, { x: best.x, y: best.y }, dt, now, () => {
        // 톡 쳐 낸다. 벽에 붙은 공은 가운데 쪽으로 (벽에 끼어 계속 치는 일이 없게)
        const W = window.innerWidth;
        const dir = best.x < 90 ? 1 : best.x > W - 90 ? -1 : Math.sign(best.x - catX) || 1;
        best.vy = -rand(260, 420);
        best.vx = dir * rand(160, 320);
        // 공마다 다 세면 금방 질린다. 세 번 칠 때 한 번만 센다
        if (++o.bats % 3 === 0) scored(o, now);
      }, { noLeap: true, every: 700 });
    },
    draw(ctx, o, D, now) {
      const S = D + 1; // 기계는 공보다 크게
      const kick = now - o.puff < 150 ? -S : 0;
      const lit = now - o.puff < 300 || now > o.next - 400; // 쏘기 직전·직후엔 불이 반짝
      // 공을 쫓던 고양이가 기계 앞을 지나가면 기계가 고양이 뒤로 보이게
      const w = (LAUNCHER[0].length + 2) * S;
      const h = (LAUNCHER.length + 2) * S;
      FT.underCat(ctx, (g) => stamp(g, lit ? LAUNCHER : LAUNCHER.map((r) => r.replace(/Y/g, 'y')), o.sx, floorY() - (LAUNCHER.length * S) / 2 + kick, S), [o.sx - w / 2, floorY() - h, w, h + S]);
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T37 줄넘기 =================
  // 클릭할 때마다 줄이 한 바퀴. 박자에 맞춰 누르면 고양이가 폴짝 넘고(콤보!), 박자가 어긋나면 걸려 넘어진다
  C.jumprope = {
    cursor: true,
    start(o) {
      Object.assign(o, { phase: 1, combo: 0, lastClick: 0, lastGap: 0 });
    },
    click(o) {
      const now = performance.now();
      if (now < (o.busyUntil || 0) || o.phase < 1) return;
      const gap = o.lastClick ? (now - o.lastClick) / 1000 : 0;
      // 첫 번째거나, 간격이 적당하고 지난번과 비슷하면 성공
      const fresh = !gap || gap >= 1.8;
      const ok = fresh || !o.lastGap || Math.abs(gap - o.lastGap) / o.lastGap < 0.35;
      if (fresh) o.combo = 0;
      o.lastGap = fresh ? 0 : gap;
      o.lastClick = now;
      o.phase = 0;
      o.success = ok;
      o.jumped = false;
      sfx('tick', 0.02);
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      if (o.phase < 1) {
        o.phase = Math.min(1, o.phase + dt / 0.7);
        // 줄이 발밑에 올 때 폴짝 (또는 걸림)
        if (!o.jumped && o.phase > (o.success ? 0.3 : 0.5)) {
          o.jumped = true;
          if (o.success && catLift <= 0) {
            sprite.setToyPose(null);
            catVy = -440;
            catLift = 1;
            sprite.play('toyLeap');
            o.combo++;
            if (o.combo % 5 === 0) {
              sfx('win', 0.03);
              pop(o, `COMBO ${o.combo}`, catX, K.catTop() - 40, '#ffd35c', 900);
            }
            if (o.combo % 3 === 0) scored(o, now);
          } else if (!o.success) {
            o.combo = 0;
            sprite.play('toyTrip');
            o.busyUntil = now + 1600;
            pop(o, 'OOPS', catX, K.catTop() - 20, '#ff9a9a', 800);
          }
        }
      }
      if (catLift > 0) return;
      sprite.setMove(0);
      if (now > (o.busyUntil || 0)) face(mouseX);
    },
    draw(ctx, o, D, now) {
      const P = petPx();
      // 고양이 몸에 맞춘다 (뛰어도 줄은 제자리): 손잡이는 몸 가운데 높이, 줄은 머리 위에서 발밑까지
      const bodyH = (PetSprite.GRID - sprite.headTop()) * cellPx();
      const hy = H() - bodyH * 0.5;
      const lx = catX - P * 0.34;
      const rx = catX + P * 0.34;
      // 줄: 손잡이 둘을 잇는 반원. phase 에 따라 머리 위 → 앞 → 발밑 → 뒤로 돈다.
      // 이어진 선으로 긋고, 고양이 뒤로 넘어가는 동안은 고양이 뒤에 그린다
      const ang = o.phase < 1 ? o.phase * Math.PI * 2 : 0;
      const ry = bodyH * 0.5 + 8 * D;
      const n = 16;
      const rope = (g) => {
        let px = lx;
        let py = hy;
        for (let i = 1; i <= n; i++) {
          const k = i / n;
          const x = lx + (rx - lx) * k;
          const y = Math.min(floorY() - D, hy - Math.cos(ang) * ry * Math.sin(k * Math.PI));
          FT.line(g, px, py, x, y, D, '#e8534a');
          px = x;
          py = y;
        }
      };
      if (Math.sin(ang) > 0.05) rope(ctx);
      else FT.underCat(ctx, rope, [lx - 2 * D, hy - ry - 2 * D, rx - lx + 4 * D, ry * 2 + 4 * D]);
      // 양 손잡이: 나무 자루에 빨간 손잡이 (줄이 자루 끝에 달렸다)
      stamp(ctx, ['KK', 'KC', 'RK', 'RK', 'RK', 'KK'], lx, hy + 2 * D, D);
      stamp(ctx, ['KK', 'CK', 'KR', 'KR', 'KR', 'KK'], rx, hy + 2 * D, D);
      if (o.combo > 1) ftext(ctx, String(o.combo), catX, H() - bodyH - 14 * D, D, '#ffd35c');
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T40 고양이 전용 노트북 =================
  // 작은 노트북을 꺼내 두면 고양이가 키보드 위에 드러누워 버린다. 화면엔 asdfjkl;;;; 가 계속 쳐진다.
  // 누르면 깨어나서 미친 듯이 타자 (가끔 고양이 말이 섞인다)
  // 상점 그림처럼 민트색 화면에 고양이 얼굴, 회색 자판
  const MINI = [
    '.KKKKKKKKKKK.',
    '.KMMMMMMMMMK.',
    '.KMKMMMMMKMK.',
    '.KMMMMPMMMMK.',
    '.KMMMMMMMMMK.',
    '.KKKKKKKKKKK.',
    'KGgGgGgGgGgGK',
    'KKKKKKKKKKKKK',
  ];
  const GIB = ['asdf;;', 'jkl;;;;', 'qqqqqq', 'zzzzz', ';;;;;;;;', 'meow', 'churu plz', 'purrrr', 'ctrl+z', 'git push -f'];
  C.catlaptop = {
    cursor: true,
    start(o, side) {
      Object.assign(o, { lx: clamp(catX + side * petPx() * 1.1, 40, window.innerWidth - 40), lines: [], on: false, typeUntil: 0 });
    },
    click(o) {
      if (!o.on) return;
      const now = performance.now();
      o.typeUntil = now + 2600;
      sprite.setToyPose('toyTypeFast');
      pop(o, '!', catX, K.catTop() - 16, '#ffd35c', 500);
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      if (catLift > 0) return sprite.setMove(0);
      if (!o.on) {
        if (walkTo(o.lx + cellPx() * 0.5, dt, 0.8, 3) <= 3) {
          o.on = true;
          catX = o.lx + cellPx() * 0.5;
          placeCat();
          sprite.setToyPose('toyLaptopNap');
        }
        return;
      }
      sprite.setMove(0);
      const typing = now < o.typeUntil;
      if (!typing && sprite.toyPose !== 'toyLaptopNap') sprite.setToyPose('toyLaptopNap');
      // 글자가 쌓인다 (자면 느릿느릿 같은 글자, 깨우면 우다다)
      if (now > (o.nextKey || 0)) {
        o.nextKey = now + (typing ? 70 : 380);
        if (!o.lines.length || o.lines[o.lines.length - 1].length > 12 || (typing && Math.random() < 0.08)) o.lines.push('');
        const src = typing ? GIB[Math.floor(Math.random() * GIB.length)] : ';;;;zzzz';
        o.lines[o.lines.length - 1] += src[Math.floor(Math.random() * src.length)];
        if (typing && Math.random() < 0.05) o.lines.push(GIB[5 + Math.floor(Math.random() * 5)]);
        while (o.lines.length > 4) o.lines.shift();
        if (typing && Math.random() < 0.3) sfx('tick', 0.01);
      }
    },
    end() {
      sprite.setToyPose(null);
    },
    draw(ctx, o, D, now) {
      const P = petPx();
      if (!o.on) stamp(ctx, MINI, o.lx, floorY() - (MINI.length * D) / 2, D);
      // 말풍선처럼 뜬 화면 (쳐진 글자)
      if (o.on && o.lines.length) {
        const top = H() - (PetSprite.GRID - sprite.headTop()) * cellPx();
        const x = clamp(catX + sprite.facing * P * 0.2, 60, window.innerWidth - 60);
        const y = top - 12 * D; // 쿨쿨 Z 가 가리지 않게 조금 위
        // 글자 한 칸 = 도트 4개 × d. 12글자 4줄이 들어가는 검은 화면
        const d = Math.max(1, D - 1);
        const w = (12 * 4 + 4) * d;
        const h = (4 * 6 + 3) * d;
        ctx.fillStyle = '#2b1a10';
        ctx.fillRect(Math.round(x - w / 2 - d), Math.round(y - h - d), w + 2 * d, h + 2 * d);
        ctx.fillStyle = '#1f2a24';
        ctx.fillRect(Math.round(x - w / 2), Math.round(y - h), w, h);
        const x0 = x - w / 2 + 2 * d;
        o.lines.forEach((ln, i) => {
          const s = ln.toUpperCase().slice(-12);
          const tw = PetSprite.util.textWidth(s) + 2;
          ftext(ctx, s, x0 + (tw * d) / 2, y - h + 2 * d + (i * 6 + 3.5) * d, d, '#9fe3c8', '#1f2a24');
        });
        // 깜빡이는 커서
        if (Math.floor(now / 400) % 2) FT.dotAt(ctx, x0 + (PetSprite.util.textWidth((o.lines[o.lines.length - 1] || '').slice(-12)) + 1) * d, y - h + 2 * d + ((o.lines.length - 1) * 6 + 4) * d, d, '#9fe3c8');
      }
      commonDraw(ctx, o, D, now);
    },
  };

  root.TOY_CUSTOM = Object.assign(root.TOY_CUSTOM || {}, C);
})(window);
