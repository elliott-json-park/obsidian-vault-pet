// 2차 장난감 동작 (2/3): 바나나 껍질, 캣휠, 진공청소기, 박스 탑, 마술 모자, 슬롯머신
(function (root) {
  const K = root.ToyKit;
  const FT = PetToys;
  const { stamp, ftext, chase, pop, burst, commonStep, commonDraw, sfx, H } = K;
  const C = {};
  const inBox = (e, x, y, w, h) => e.clientX >= x - w / 2 && e.clientX <= x + w / 2 && e.clientY >= y - h && e.clientY <= y;

  // ================= T17 바나나 껍질 =================
  // 껍질을 바닥 아무 데나 놓아 두면 끝. 고양이는 마우스 쪽으로 걸어오다가… 밟고 주르륵 한 바퀴.
  // 일어나서는 아무 일 없었던 척 휘파람
  // 4차 다듬기 (2026-10-17): 한 번 미끄러지면 한동안 조심한다 — 껍질 앞에서 멈춰 킁킁, 폴짝 넘어가서 의기양양.
  // 그래도 발밑에 휙 던져 넣으면 피할 틈이 없다. 넘어지는 모양도 여러 가지 (한 바퀴 · 두 바퀴 + 어질어질 · 화나서 껍질 걷어차기).
  // 껍질을 톡 누르면 통 튀어 오르고, 고양이는 미심쩍게 째려본다
  C.bananapeel = {
    start(o, side) {
      // 바닥에 놓는 건 껍질 그림 (상점 그림은 반쯤 깐 바나나라 따로 둔다. pixelart.js 의 bananapeelFloor)
      Object.assign(o, spawnItem('bananapeelFloor'));
      o.x = clamp(catX + side * petPx() * 1.2, o.half, window.innerWidth - o.half);
      o.y = H() - petPx() - 60;
      o.slips = 0;
      o.wary = 0;
    },
    click(o, it) {
      if (it !== o || !onFloor(o)) return;
      // 톡 — 껍질이 통 튀어 오른다
      o.vy = -260;
      o.vx = rand(-40, 40);
      sfx('pop', 0.02);
      if (catLift <= 0 && !o.slide && performance.now() > (o.busyUntil || 0)) {
        face(o.x);
        sprite.setToyPose(null);
        sprite.play('toyDeadpan');
        o.busyUntil = performance.now() + 1200;
      }
    },
    slip(o, now, dir, before) {
      // 빨리 걷다 밟을수록 크게 미끄러진다
      const fast = Math.abs(catX - before) > 3.5 || Math.random() < 0.25;
      o.slips++;
      o.cool = now + 5000;
      o.wary = now + 20000; // 한동안은 조심
      o.slide = { v: dir * (fast ? 360 : 260), until: now + (fast ? 1500 : 1100), fast };
      o.vx = -dir * 140;
      sprite.setToyPose(null);
      sprite.play('toySlip', { times: fast ? 2 : 1 });
      sfx('spin', 0.03);
      pop(o, o.slips > 1 ? `WHOOPS X${o.slips}` : 'WHOOPS', catX, K.catTop() - 20, '#ffd35c', 900);
      scored(o, now);
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      const P = petPx();
      if (o.slide) {
        // 미끄러지는 중
        catX = clamp(catX + o.slide.v * dt, ...lane());
        o.slide.v *= Math.pow(0.08, dt);
        placeCat();
        if (now > o.slide.until) {
          const big = o.slide.fast;
          o.slide = null;
          const r = Math.random();
          if (big) {
            // 두 바퀴 돌고 어질어질
            sprite.play('toyDizzy');
            o.busyUntil = now + 2000;
          } else if (r < 0.35 && o.slips > 1) {
            // 또 너냐! 껍질을 걷어찬다
            face(o.x);
            sprite.play('toyPunch');
            K.later(o, 500, () => {
              if (toy !== o || !onFloor(o)) return;
              o.vx = (Math.sign(o.x - catX) || 1) * 520;
              o.vy = -320;
              pop(o, 'HMPH', catX, K.catTop() - 14, '#ff9a9a', 800);
            });
            o.busyUntil = now + 1400;
          } else {
            // 아무 일 없었던 척 휘파람
            sprite.play('toyPretend');
            o.busyUntil = now + 2400;
          }
        }
        return sprite.setMove(0);
      }
      if (catLift > 0 || now < (o.busyUntil || 0) || (held && held.o === o)) return sprite.setMove(0);
      // 마우스(사람) 쪽으로 어슬렁어슬렁. 가까우면 멈춰서 올려다본다
      const goal = mouseX == null ? catX : mouseX;
      const dir0 = Math.sign(goal - catX);
      // 조심하는 중이면 길 앞의 껍질을 보고 멈춘다 → 킁킁 → 폴짝 넘어간다. 너무 가까우면(발밑에 던져 넣으면) 피할 틈이 없다
      const ahead = (o.x - catX) * dir0;
      if (now < o.wary && dir0 && onFloor(o) && ahead > P * 0.28 && ahead < P * 0.75 && Math.abs(goal - catX) > ahead) {
        sprite.setMove(0);
        face(o.x);
        if (!o.sniffed) {
          o.sniffed = true;
          sprite.setToyPose(null);
          sprite.play('toySniff');
          pop(o, '?', catX, K.catTop() - 12, '#ffd35c', 700);
          o.busyUntil = now + 1300;
          return;
        }
        // 폴짝! 껍질 너머로
        o.sniffed = false;
        catVy = -480;
        catVx = dir0 * (ahead + P * 0.45) / 0.64;
        catLift = 1;
        sprite.play('toyLeap');
        K.later(o, 750, () => {
          if (toy !== o || catLift > 0) return;
          sprite.play('toyProud');
          pop(o, 'HEH', catX, K.catTop() - 12, '#ffffff', 700);
        });
        o.busyUntil = now + 2400;
        return;
      }
      const before = catX;
      if (walkTo(goal, dt, 0.55, P * 0.3) <= P * 0.3) {
        face(goal);
        sprite.setToyPose('toyChatter');
      } else sprite.setToyPose(null);
      // 껍질을 밟았나 (지나가는 길에 껍질 한가운데가 있으면)
      const lo = Math.min(before, catX) - 3;
      const hi = Math.max(before, catX) + 3;
      if (onFloor(o) && o.x >= lo && o.x <= hi && now > (o.cool || 0)) this.slip(o, now, Math.sign(catX - before) || sprite.facing, before);
    },
    draw(ctx, o, D, now) {
      if (o.slips > 0 && now < o.wary) ftext(ctx, `SLIP ${o.slips}`, o.x, o.y - o.half - 7 * D, D, 'rgba(255,211,92,0.85)');
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T19 캣휠 =================
  // 바닥에 커다란 쳇바퀴. 고양이가 들어가 알아서 달린다. 바퀴를 누를 때마다 빨라지고,
  // 너무 빨라지면 빙글 돌다 밖으로 튕겨 나온다
  const cellP = () => cellPx();
  C.catwheel = {
    start(o, side) {
      Object.assign(o, { wx: clamp(catX + side * petPx() * 1.2, petPx(), window.innerWidth - petPx()), speed: 1, inside: false, spin: 0 });
    },
    wantsMouse(o, e) {
      const R = 15 * cellP();
      return inBox(e, o.wx, floorY(), R * 2, R * 2);
    },
    down() {},
    click(o) {
      if (!o.inside) return;
      o.speed += 0.6; // 네 번쯤 연달아 누르면 튕겨 나간다
      sfx('tick', 0.02);
      pop(o, 'FASTER', o.wx, floorY() - 32 * cellP(), '#ffffff', 500);
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      o.spin += o.speed * dt * (o.inside ? 5 : 0.3);
      if (K.landed(o, now)) return;
      if (o.flung && catLift <= 0) {
        o.flung = false;
        sprite.cancel();
        sprite.play('toyDizzy');
        o.busyUntil = now + 2100;
        o.backAt = now + 3500;
        return;
      }
      if (catLift > 0) return sprite.setMove(0);
      if (o.inside) {
        o.speed = Math.max(1, o.speed - 0.25 * dt);
        sprite.wheelSpeed = o.speed;
        sprite.setToyPose('toyWheel');
        sprite.setMove(0);
        if (o.speed > 3.4) {
          // 빨려서 한 바퀴 돌고 밖으로 휙
          o.inside = false;
          o.speed = 1.2;
          sprite.setToyPose(null);
          // 폭발이 아니니 그을린 모습(toyBlown) 대신 한 바퀴 휙 도는 자세
          catVx = (Math.random() < 0.5 ? -1 : 1) * 240;
          catVy = -620;
          catLift = 1;
          sprite.play('toySlip');
          o.flung = true;
          sfx('spin', 0.04);
          pop(o, 'WHEEE', catX, K.catTop() - 20, '#ffd35c', 900);
          pet.caught();
        }
        return;
      }
      if (now < (o.busyUntil || 0) || now < (o.backAt || 0)) return sprite.setMove(0);
      // 바퀴로 걸어가 쏙 들어간다
      if (walkTo(o.wx + cellP() * 0.5, dt, 0.8, 3) <= 3) {
        o.inside = true;
        o.speed = 1.3;
        catX = o.wx + cellP() * 0.5;
        placeCat();
      }
    },
    end() {
      sprite.wheelSpeed = 1;
    },
    draw(ctx, o, D, now) {
      if (!o.inside) {
        // 비어 있는 캣휠: 고양이가 안에서 달릴 때 고양이 캔버스가 그리는 것과 똑같은 그림·높이.
        // 고양이가 앞을 지나가거나 들어가는 중이면 고양이 뒤에 보이게 그린다
        const cp = cellP();
        const G = PetSprite.GRID;
        const X0 = Math.round(o.wx - cp / 2);
        const Y0 = Math.round(H() - (G - (PetSprite.util.GROUND - 13)) * cp);
        const R = FT.WHEEL_R + 2;
        const pal = FT.palOf('#2b1a10');
        const s = Math.ceil(cp);
        FT.underCat(ctx, (g) => {
          for (const [dx, dy, ch] of FT.wheelDots(o.spin)) {
            g.fillStyle = pal[ch];
            g.fillRect(Math.round(X0 + dx * cp), Math.round(Y0 + dy * cp), s, s);
          }
        }, [X0 - R * cp, Y0 - R * cp, R * 2 * cp, R * 2 * cp]);
      }
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T22 진공청소기 =================
  // 빨간 캐니스터 몸통: 광택, 먼지 보이는 창, 검은 범퍼, 바퀴 둘. 호스 구멍이 왼쪽(흡입구 쪽)
  const VAC_BODY = [
    '...KKKKKKKK...',
    '..KRRRRRRRRK..',
    '.KRHHRRRRRRRK.',
    'KKRHRRRRRRRRRK',
    'KDKRRKKKKRRRRK',
    'KKKRKUUUUKRRRK',
    '.KRRKUGgUKRRRK',
    '.KrrrKKKKrrrrK',
    'KKKKKKKKKKKKKK',
    '.KDDK....KDDK.',
    '..KK......KK..',
  ];
  // 클릭하면 위이잉 켜지고 마우스를 따라 바닥을 누빈다. 끄면 조심조심 다가와 킁킁.
  // 자꾸 켜면 고양이가 조금씩 용감해진다 (4차 다듬기, 2026-10-17):
  //  겁쟁이(처음 두 번) — 털을 곤두세우고 반대편 구석으로 줄행랑
  //  버티기(셋째·넷째) — 등을 세우고 하악! 너무 가까이 오면 한 발 물러선다
  //  용감(다섯째부터) — 몸통 위에 폴짝 올라타 청소기를 타고 다닌다. 끄면 잠깐 더 앉았다가 뿌듯하게 내려온다
  C.vacuum = {
    cursor: true,
    start(o) {
      Object.assign(o, { on: false, vx0: mouseX, brave: 0, ride: false, boarding: false });
    },
    click(o) {
      o.on = !o.on;
      sfx(o.on ? 'spin' : 'pop', 0.03);
      pop(o, o.on ? 'VRRRR' : 'CLICK', mouseX, floorY() - 60, '#ffffff', 600);
      if (o.on) {
        o.brave++;
        if (o.brave === 3 || o.brave === 5) pop(o, o.brave === 3 ? 'GRR' : 'BRAVE!', catX, K.catTop() - 14, '#ffd35c', 900);
      } else if (o.ride) K.later(o, 900, () => this.hopOff(o));
    },
    // 몸통 가운데 (흡입구에서 몸통 쪽으로 19칸)
    bodyX(o) {
      return o.vx0 + (o.side || 1) * 19 * itemDot();
    },
    // 몸통 위에 앉았을 때 고양이 높이 (발이 몸통 윗면에 닿게)
    rideLift() {
      return (VAC_BODY.length - 1) * itemDot() + (H() - floorY()) - (PetSprite.GRID - PetSprite.util.GROUND - 1) * cellPx();
    },
    hopOff(o) {
      if (!o.ride || toy !== o) return;
      o.ride = false;
      floating = false;
      sprite.setToyPose(null);
      catVy = -330;
      catVx = (o.side || 1) * 120;
      sprite.play('toyLeap');
      K.later(o, 900, () => toy === o && catLift <= 0 && sprite.play('toyProud'));
      o.busyUntil = performance.now() + 2800;
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      o.vx0 += (mouseX - o.vx0) * Math.min(1, dt * 6);
      const P = petPx();
      if (o.ride) {
        // 청소기를 타고 간다 (꺼져 있으면 그 위에 얌전히 앉아 있다)
        catX = this.bodyX(o);
        catLift = this.rideLift();
        catVy = 0;
        placeCat();
        sprite.setMove(0);
        sprite.setToyPose(o.on ? 'toyRide' : 'toySitOn');
        return;
      }
      if (o.boarding) {
        // 폴짝 뛰어올라 몸통 위로
        const bx = this.bodyX(o);
        catX += (bx - catX) * Math.min(1, dt * 10);
        placeCat();
        if (catVy > 0 && catLift <= this.rideLift() + 6) {
          o.boarding = false;
          o.ride = true;
          floating = true;
          sprite.cancel();
          pop(o, 'RIDE!', bx, floorY() - P * 1.2, '#ffd35c', 900);
          sfx('win', 0.03);
          scored(o, now);
        } else if (catLift <= 0) o.boarding = false;
        return;
      }
      if (catLift > 0) return sprite.setMove(0);
      if (now < (o.busyUntil || 0)) return sprite.setMove(0);
      if (o.on) {
        if (o.brave >= 5) {
          // 용감해졌다: 몸통 쪽으로 쫓아가 폴짝 올라탄다
          const bx = this.bodyX(o);
          if (walkTo(bx, dt, 1.6, 4) <= P * 0.3 && Math.abs(bx - catX) <= P * 0.3) {
            o.boarding = true;
            sprite.setToyPose(null);
            sprite.play('toyLeap');
            catVy = -Math.sqrt(2 * 1500 * (this.rideLift() + P * 0.25));
            catLift = 1;
          }
          return;
        }
        // 털 뭉치가 빨려 들어간다
        if (Math.random() < dt * 12) (o.fur ||= []).push({ x: catX + rand(-P * 0.3, P * 0.3), y: K.catMidY() + rand(-10, 10), t: now });
        if (o.brave >= 3) {
          // 버틴다: 등을 세우고 하악. 너무 가까우면 한 발 물러선다
          const away = Math.sign(catX - o.vx0) || 1;
          if (Math.abs(catX - o.vx0) < P * 0.95) {
            walkTo(catX + away * 40, dt, 1.3, 2);
            return;
          }
          sprite.setMove(0);
          face(o.vx0);
          if (now > (o.hissAt || 0)) {
            o.hissAt = now + 2400;
            sprite.setToyPose(null);
            sprite.play('toyHiss');
          } else if (!sprite.action) sprite.setToyPose('toyHunt');
          return;
        }
        const [min, max] = lane();
        const far = o.vx0 < window.innerWidth / 2 ? max : min;
        if (Math.abs(catX - o.vx0) < P * 3 || Math.abs(catX - far) > 4) {
          sprite.setToyPose(null);
          if (walkTo(far, dt, 1.9, 3) <= 3) {
            face(o.vx0);
            sprite.setToyPose('toyHide');
          }
        } else {
          face(o.vx0);
          sprite.setToyPose('toyHide');
        }
        return;
      }
      // 꺼졌다… 슬금슬금 다가가 냄새를 맡는다. 용감해졌으면 흡입구를 앞발로 톡톡
      o.fur = [];
      if (walkTo(o.vx0, dt, 0.45 + Math.min(0.6, o.brave * 0.12), P * 0.55) <= P * 0.55) {
        face(o.vx0);
        if (now > (o.sniffAt || 0)) {
          o.sniffAt = now + 3500;
          sprite.setToyPose(null);
          const pat = o.brave >= 3 && Math.random() < 0.5;
          sprite.play(pat ? 'toyBat' : 'toySniff');
          if (pat) pop(o, 'PAT', o.vx0, floorY() - 24, '#ffffff', 500);
          o.busyUntil = now + 1200;
        } else sprite.setToyPose(null);
      }
    },
    end(o) {
      if (o.ride) floating = false;
    },
    // 캐니스터 청소기 (상점 그림처럼): 바닥을 훑는 흡입구 → 금속 대 → 손잡이 → 주름 호스 → 바퀴 달린 빨간 몸통.
    // 흡입구가 마우스를 따라가고 몸통은 고양이 반대쪽에서 끌려온다. 켜면 몸통이 달달 떨고 흡입구 앞 공기가 빨려 든다.
    // 몸통은 고양이 뒤에 그린다 (올라타 있을 때 고양이가 몸통 위에 보이게)
    draw(ctx, o, D, now) {
      const t = now / 1000;
      const x = o.vx0;
      const fy = floorY();
      const want = Math.sign(x - catX) || 1;
      if (!o.ride && !o.boarding && (o.side == null || Math.abs(x - catX) > petPx() * 0.6)) o.side = want;
      const s = o.side; // 몸통이 있는 쪽
      const shake = o.on ? (Math.floor(t * 30) % 2 ? D : 0) : 0;
      // 몸통 (바퀴가 바닥에 닿게)
      const bx = x + s * 19 * D;
      const bw = (VAC_BODY[0].length + 2) * D;
      const bh = (VAC_BODY.length + 2) * D;
      FT.underCat(ctx, (g) => stamp(g, VAC_BODY, bx, fy - (VAC_BODY.length * D) / 2 - shake, D, s < 0), [bx - bw / 2, fy - bh, bw, bh + D]);
      // 호스: 손잡이 아래에서 처지며 몸통 옆구리로
      const hx = x + s * 7 * D;
      const hy = fy - 17 * D;
      const ex = bx - s * 7 * D;
      const ey = fy - 7 * D - shake;
      let px = hx;
      let py = hy;
      for (let i = 1; i <= 8; i++) {
        const k = i / 8;
        const nx = hx + (ex - hx) * k;
        const ny = hy + (ey - hy) * k + Math.sin(k * Math.PI) * 5 * D;
        FT.line(ctx, px, py, nx, ny, D, i % 2 ? '#565d69' : '#3e434c');
        FT.line(ctx, px, py + D, nx, ny + D, D, '#2b1a10');
        px = nx;
        py = ny;
      }
      // 금속 대와 손잡이
      FT.line(ctx, x + s * D, fy - 3 * D, hx, hy, D, '#b9bec6');
      FT.line(ctx, x + s * 2 * D, fy - 3 * D, hx + s * D, hy, D, '#8f95a0');
      stamp(ctx, ['KKK', 'KRK', 'KRK', 'KKK'], hx + s * D, hy - 2 * D, D);
      // 흡입구 (솔이 바닥에 닿는다)
      stamp(ctx, ['.KKKKKKKK.', 'KDDDDDDDDK', 'KgKgKgKgKK'], x, fy - 1.5 * D, D);
      if (o.on) {
        // 흡입구 앞(몸통 반대쪽)에서 빨려 드는 바람
        const f = -s;
        const ph = (t * 3) % 1;
        for (let i = 0; i < 3; i++) {
          const d = (8 + ((i * 4 + ph * 12) % 12)) * D;
          FT.line(ctx, x + f * d, fy - (2 + i * 2) * D, x + f * (d - 3 * D), fy - (2 + i * 1.5) * D, D, 'rgba(120,110,100,0.55)');
        }
        for (const fu of o.fur || []) {
          const k = Math.min(1, (now - fu.t) / 600);
          FT.dotAt(ctx, fu.x + (x - fu.x) * k, fu.y + (fy - 2 * D - fu.y) * k, D, '#f4a859');
        }
        o.fur = (o.fur || []).filter((fu) => now - fu.t < 600);
      }
      // 용감 단계: 고양이 머리 위에 작은 별 (몇 번 더 켜면 올라탄다)
      if (o.brave >= 3 && o.brave < 5 && o.on && !o.ride) ftext(ctx, o.brave === 3 ? '!' : '!!', catX, K.catTop() - 8 * D, D, '#ffd35c');
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T23 박스 탑 쌓기 =================
  // 상자 탑을 누를 때마다 상자가 한 층씩 (최대 7층). 두 층이 넘으면 고양이가 꼭대기로 뛰어올라 앉았다가… 와르르.
  // 4차 다듬기 (2026-10-17): 네 층부터 탑이 살랑살랑 흔들리고, 다섯 층부터는 뛰다가 모자라 미끄러질 때도 있다 (꼭대기 상자가 툭).
  // 일곱 층 꼭대기에 성공하면 왕관을 쓰고 뿌듯. 가끔은 와르르 대신 멋지게 뛰어내린다
  // 골판지 상자 옆면: 위 모서리가 밝고, 날개 이음매에서 테이프가 내려오고, 한쪽에 '이쪽 위로' 화살표 도장
  const BOX = ['KKKKKKKKKKKKKK', 'KSSSSSwwSSSSSK', 'KTTTTTwwTTTTtK', 'KTTTTTwwTTTTtK', 'KTTTTTTTTTTTtK', 'KTTCTTTTTTTTtK', 'KTCCCTTTTTTTtK', 'KTTCTTTTTTTTtK', 'KttttttttttttK', 'KKKKKKKKKKKKKK'];
  // 층마다 조금씩 삐뚤게 쌓는다 (손으로 대충 올린 느낌). 칸 수
  const BOX_JIT = [0, 1, -1, 1, 0, -1, 1];
  const BOX_MAX = 7;
  C.boxtower = {
    start(o, side) {
      Object.assign(o, { bx: clamp(catX + side * petPx() * 1.1, 40, window.innerWidth - 40), n: 1, tumble: [], wobAt: 0 });
    },
    // 위아래 상자는 테두리 한 줄을 겹쳐 쌓는다 (이음매가 두 줄로 굵어지지 않게)
    boxH: () => (BOX.length - 1) * itemDot(),
    boxW: () => BOX[0].length * itemDot(),
    // 고양이 캔버스 맨 아래 몇 줄은 발 밑(그림자 자리)이라, 발이 탑 꼭대기에 딱 닿게 그만큼 내려 앉힌다
    perchLift(top) {
      return top + (H() - floorY()) - (PetSprite.GRID - PetSprite.util.GROUND - 1) * cellPx();
    },
    // i 층이 옆으로 흔들린 칸 수 (네 층부터 위로 갈수록 크게. 툭 쳐서 흔들리면 잠깐 크게)
    sway(o, i, now) {
      const big = now - o.wobAt < 900 ? 2.2 * (1 - (now - o.wobAt) / 900) : 0;
      const amp = Math.max(0, o.n - 3) * 0.45 + big;
      return amp ? Math.round(Math.sin(now / 380 + i * 0.3) * amp * (i / Math.max(1, o.n - 1))) : 0;
    },
    wantsMouse(o, e) {
      return inBox(e, o.bx, floorY(), this.boxW() + 8, this.boxH() * o.n + 8);
    },
    down() {},
    click(o) {
      const now = performance.now();
      if (o.perched) {
        // 앉아 있는데 탑을 건드리면 흔들흔들
        o.wobAt = now;
        sfx('tick', 0.02);
        return;
      }
      if (o.tumble.length || o.n >= BOX_MAX) return;
      o.n++;
      o.wobAt = now;
      sfx('pop', 0.02);
      if (o.n === BOX_MAX) pop(o, 'MAX!', o.bx, floorY() - this.boxH() * o.n - 24, '#ffd35c', 800);
    },
    // 와르르: 위에서부터 from 층까지 상자가 무너진다
    crumble(o, now, from = 0) {
      for (let i = from; i < o.n; i++) o.tumble.push({ x: o.bx, y: floorY() - this.boxH() * (i + 0.5), vx: rand(-220, 220), vy: rand(-300, -80), rot: 0, vr: rand(-8, 8) });
      if (from === 0) {
        o.resetAt = now + 2600;
        o.n = 0; // 다 무너졌다. 잠시 뒤 바닥 상자 하나부터 다시
      } else {
        o.n = from;
        o.resetAt = now + 1600;
      }
      o.fall = from > 0;
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      const P = petPx();
      const top = this.boxH() * o.n + itemDot();
      // 무너지는 상자들
      for (const b of o.tumble) {
        b.vy += 1500 * dt;
        b.x += b.vx * dt;
        b.y = Math.min(floorY() - (BOX.length * itemDot()) / 2, b.y + b.vy * dt);
        b.rot += b.vr * dt;
      }
      if (o.tumble.length && now > o.resetAt) {
        o.tumble = [];
        if (!o.fall) o.n = 1;
        o.fall = false;
      }
      if (o.perched) {
        catLift = this.perchLift(top);
        catX = o.bx + this.sway(o, o.n, now) * itemDot();
        placeCat();
        if (now > o.perched) this.endPerch(o, now, top);
        return sprite.setMove(0);
      }
      if (catLift > 0) {
        // 뛰어오르는 중: 탑 위로 끌려간다. 꼭대기보다 높이 올라갔으면 거기 앉는다
        sprite.setMove(0);
        if (o.climbing) catX = clamp(catX + Math.sign(o.bx - catX) * Math.min(260 * dt, Math.abs(o.bx - catX)), ...lane());
        placeCat();
        const perch = this.perchLift(top);
        if (o.climbing && !o.miss && catVy > 0 && catLift <= perch + 6 && catLift >= perch - 12 && Math.abs(catX - o.bx) < 8) {
          o.climbing = false;
          const king = o.n === BOX_MAX;
          o.perched = now + (king ? 5000 : 3500 + Math.random() * 2000);
          o.king = king;
          floating = true;
          sprite.setToyPose(king ? 'toyKing' : 'toyPerch');
          if (king) {
            sfx('win', 0.04);
            pop(o, 'KING!', o.bx, floorY() - top - P - 10, '#ffd35c', 1400);
            burst(o, o.bx, floorY() - top - P * 0.6, 20, ['#ffd35c', '#fff3bf', '#ff9bb8'], 220, 1000);
            scored(o, now);
          }
        }
        return;
      }
      if (o.climbing && o.miss) {
        // 모자랐다: 탑 옆구리에 부딪혀 주르륵 → 어질어질, 탑이 흔들리고 꼭대기 상자가 툭
        o.climbing = false;
        o.miss = false;
        sprite.setToyPose(null);
        sprite.play('toyDizzy');
        sfx('bonk', 0.03);
        pop(o, 'OOF', catX, K.catTop() - 16, '#ff9a9a', 800);
        o.wobAt = now;
        o.busyUntil = now + 2200;
        if (o.n >= 5 && Math.random() < 0.6) this.crumble(o, now, o.n - 1);
        return;
      }
      o.climbing = false;
      if (now < (o.busyUntil || 0) || o.tumble.length || o.n < 2) {
        if (!o.tumble.length && o.n < 2 && walkTo(o.bx + (Math.sign(catX - o.bx) || 1) * P * 0.6, dt, 0.6, 3) <= 3) face(o.bx);
        return sprite.setMove(0);
      }
      // 탑 옆에 서서 올려다보다가 폴짝 (높을수록 오래 망설인다)
      if (walkTo(o.bx + (Math.sign(catX - o.bx) || 1) * P * 0.5, dt, 0.8, 3) > 3) return;
      face(o.bx);
      if (!o.eyeAt) o.eyeAt = now;
      const think = 400 + Math.max(0, o.n - 3) * 450;
      if (now > o.pounceUntil && now - o.eyeAt > think) {
        o.pounceUntil = now + 2000;
        o.eyeAt = 0;
        o.climbing = true;
        o.miss = o.n >= 5 && Math.random() < (o.n - 4) * 0.15;
        if (o.miss) {
          leap(top * 0.55);
          // 모자라게 뛰면 탑 쪽으로 반만 다가간다
          catVx = Math.sign(o.bx - catX) * 60;
        } else {
          // leap() 은 고양이 키의 1.6배까지만 뛴다. 높은 탑은 그 이상 뛰어야 해서 직접 띄운다
          catVy = -Math.sqrt(2 * 1500 * (top + P * 0.2));
          catLift = 0.5;
          sprite.setToyPose(null);
          sprite.setMove(0);
          sprite.play('toyLeap');
        }
      } else sprite.setToyPose(o.n >= 5 && now - (o.eyeAt || now) > think * 0.5 ? 'toyWiggle' : 'toyChatter');
    },
    // 앉아 있다가: 와르르, 또는 탑은 그대로 두고 멋지게 뛰어내리기
    endPerch(o, now, top) {
      o.perched = 0;
      floating = false;
      catVy = 0;
      sprite.setToyPose(null);
      // 왕관이면 반쯤은, 아니면 가끔은 무너뜨리지 않고 멋지게 뛰어내린다
      if (Math.random() < (o.king ? 0.5 : 0.25)) {
        const side = Math.sign(catX - window.innerWidth / 2) || 1;
        catVy = -260;
        catVx = -side * 150;
        sprite.play('toyLeap');
        K.later(o, 900, () => toy === o && catLift <= 0 && sprite.play('toyProud'));
        pop(o, o.king ? 'TA-DA' : 'HUP', o.bx, floorY() - top - 30, '#ffd35c', 900);
        o.busyUntil = now + 3200;
        scored(o, now);
        return;
      }
      // 와르르!
      sprite.play('startle');
      sfx('boom', 0.03);
      pop(o, 'CRASH', o.bx, floorY() - top - 20, '#ffffff', 900);
      burst(o, o.bx, floorY() - top / 2, 14, ['#c48b56', '#f3d9b1', '#d6cfc4'], 220, 900);
      this.crumble(o, now, 0);
      o.busyUntil = now + 2800;
      scored(o, now);
    },
    end(o) {
      if (o.perched) floating = false;
    },
    draw(ctx, o, D, now) {
      const bh = this.boxH();
      const full = BOX.length * D;
      // 쌓인 탑: 층마다 살짝 삐뚤게, 홀수 층은 좌우를 뒤집어 도장 위치가 번갈아. 네 층부터는 살랑살랑.
      // 고양이가 탑 옆·앞에 서면 고양이 뒤로 보인다
      if (o.n) {
        const w = this.boxW() + 10 * D;
        FT.underCat(ctx, (g) => {
          for (let i = 0; i < o.n; i++) stamp(g, BOX, o.bx + (BOX_JIT[i % BOX_JIT.length] + this.sway(o, i, now)) * D, floorY() - bh * i - full / 2, D, i % 2 === 1);
        }, [o.bx - w / 2, floorY() - bh * o.n - full, w, bh * o.n + full + D]);
      }
      for (const b of o.tumble) {
        ctx.save();
        ctx.translate(Math.round(b.x), Math.round(b.y));
        ctx.rotate(b.rot);
        stamp(ctx, BOX, 0, 0, D);
        ctx.restore();
      }
      if (o.n >= 2 && !o.perched && !o.tumble.length) ftext(ctx, `${o.n}F`, o.bx, floorY() - bh * o.n - full / 2 - 6 * D, D, o.n === BOX_MAX ? '#ffd35c' : 'rgba(255,255,255,0.8)');
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T25 마술 모자 =================
  // 모자를 누를 때마다 뭔가 튀어나온다: 생선(낚아채 먹는다)·토끼(쫓아간다)·비둘기(뛰어오른다)·꽝(실망)
  const HAT = ['...KKKKKKK...', '...KXDXXXK...', '...KXDXXXK...', '...KXXXXXK...', '...KRRRRRK...', '...KrrrrrK...', 'KKKKKKKKKKKKK', 'KXXXXXXXXXXXK', '.KKKKKKKKKKK.'];
  const RABBIT = ['.KK.KK.', '.KWKWK.', '.KWKWK.', 'KWWWWWK', 'KWKWKWK', 'KWWPWWK', '.KWWWK.', 'KWWWWWK', '.KK.KK.'];
  // 마술사의 하얀 비둘기 (오른쪽을 본다). 날개를 번쩍 들었다 내렸다. 둥근 머리·노란 부리·부채꼴 꼬리
  const PIGEON = [
    [
      '...KK.......',
      '..KWWK......',
      '..KWGWK..KK.',
      '...KWGWKKWWK',
      'KK..KWWWWKWY',
      'KWKKWWWWWWWK',
      '.KWWWWWWWKK.',
      '..KKKKKKK...',
      '............',
    ],
    [
      '............',
      '............',
      '.........KK.',
      '........KWWK',
      'KK.KKKKKKKWY',
      'KWKWWWWWWWWK',
      '.KWWWGWWWKK.',
      '..KKWGGWK...',
      '....KKKK....',
    ],
  ];
  const FISH = ['..KKKK.K.', '.KBBBBKBK', 'KBWKBBBBK', '.KbbbbKBK', '..KKKK.K.'];
  // 4차 다듬기 (2026-10-17): 모자에서 나오는 것이 늘었다 — 태엽 쥐 · 꽃다발 · 용수철 뱀 · 색종이 · 아주 가끔 황금 물고기
  const GOLD_FISH = ['..KKKK.K.', '.KYYYYKYK', 'KYWKYYYYK', '.KyyyyKYK', '..KKKK.K.'];
  const HAT_MOUSE = ['....KK...', '...KPGK..', '.KKKGGKK.', 'KGGGGGKGK', 'KGGGGGGGP', '.KKKKKKK.'];
  const FLOWERS = ['.R.Y.P.', 'RYRPYPR', '.RNYNP.', '..NNN..', '...N...', '..KNK..', '..KTK..', '..KKK..'];
  const SNAKE_HEAD = ['.KKKKK.', 'KNWKNWK', 'KNNNNNK', 'KNRRRNK', '.KKKKK.'];
  // [무엇, 확률]
  const HAT_ODDS = [['fish', 0.22], ['rabbit', 0.15], ['pigeon', 0.14], ['mouse', 0.12], ['flowers', 0.1], ['snake', 0.08], ['confetti', 0.07], ['dud', 0.08], ['gold', 0.04]];
  C.magichat = {
    start(o, side) {
      Object.assign(o, { hx: clamp(catX + side * petPx() * 1.1, 40, window.innerWidth - 40), actor: null, bounce: 0, last: null });
    },
    wantsMouse(o, e) {
      return inBox(e, o.hx, floorY(), HAT[0].length * (itemDot() + 1) + 8, HAT.length * (itemDot() + 1) + 10);
    },
    down() {},
    // 무엇이 나올까. 꽝은 두 번 연달아 안 나온다
    pick(o) {
      for (;;) {
        let r = Math.random();
        let k = HAT_ODDS[0][0];
        for (const [kind, p] of HAT_ODDS) {
          if (r < p) {
            k = kind;
            break;
          }
          r -= p;
        }
        if (!(k === 'dud' && o.last === 'dud')) return k;
      }
    },
    click(o) {
      if (o.actor) return;
      const now = performance.now();
      o.bounce = now;
      const D = itemDot();
      const y = floorY() - HAT.length * (D + 1);
      const kind = this.pick(o);
      o.last = kind;
      const away = Math.sign(o.hx - catX) || 1;
      switch (kind) {
        case 'fish':
        case 'gold':
          o.actor = { kind, x: o.hx, y, vx: rand(-120, 120), vy: -620 };
          if (kind === 'gold') {
            sfx('win', 0.03);
            pop(o, 'WOW', o.hx, y - 30, '#ffd35c', 900);
          }
          break;
        case 'rabbit':
          o.actor = { kind, x: o.hx, y: floorY() - 9 * D, dir: Math.random() < 0.5 ? -1 : 1, hop: 0 };
          break;
        case 'pigeon':
          o.actor = { kind, x: o.hx, y, vx: (Math.random() < 0.5 ? -1 : 1) * 140, vy: -140 };
          break;
        case 'mouse':
          // 태엽 쥐가 툭 떨어져 고양이 반대쪽으로 쪼르르
          o.actor = { kind, x: o.hx, y, vx: away * 230, vy: -260, turn: now + rand(600, 1400) };
          break;
        case 'flowers':
          // 꽃다발이 모자 옆에 툭. 고양이가 킁킁… 에취!
          o.actor = { kind, x: o.hx, y, vx: -away * 90, vy: -360, t: now };
          break;
        case 'snake':
          // 용수철 뱀이 뾰옹! 깜짝 놀라 뒤로 펄쩍
          o.actor = { kind, t: now };
          pop(o, 'BOING', o.hx, y - 50, '#9fe3c8', 800);
          sfx('spin', 0.03);
          if (catLift <= 0 && Math.abs(catX - o.hx) < petPx() * 1.6) {
            sprite.setToyPose(null);
            sprite.play('startle');
            catVx = -away * 260;
            catVy = -380;
            catLift = 1;
          }
          o.busyUntil = now + 1600;
          break;
        case 'confetti':
          // 짜잔! 색종이가 펑
          o.actor = { kind, t: now };
          pop(o, 'TA-DA', o.hx, y - 30, '#ffd35c', 1000);
          burst(o, o.hx, y, 34, ['#e8534a', '#ffd65a', '#6fb0ea', '#78c46a', '#ff9bb8', '#b784f5'], 300, 1300);
          sfx('win', 0.03);
          if (catLift <= 0) {
            sprite.setToyPose(null);
            sprite.play('toyYay');
          }
          o.busyUntil = now + 1400;
          break;
        default:
          o.actor = { kind: 'dud', t: now };
          pop(o, 'POOF', o.hx, y - 20, '#cccccc', 800);
          burst(o, o.hx, y, 10, ['#d6cfc4', '#ffffff'], 120, 700);
          // 꽝이면 실망하거나, 모자 속을 기웃기웃
          if (catLift <= 0) sprite.play(Math.random() < 0.5 ? 'toyDeadpan' : 'toySniff');
          o.busyUntil = now + 1800;
      }
      if (!['dud', 'snake', 'confetti'].includes(kind)) {
        sfx('pop', 0.03);
        burst(o, o.hx, y, 8, kind === 'gold' ? ['#ffd35c', '#fff3bf', '#ffffff'] : ['#ffd35c', '#ffffff'], 160, 600);
      }
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      const a = o.actor;
      if (K.landed(o, now)) return;
      if (!a) {
        // 모자 옆에 앉아 뭐가 나오나 기다린다
        if (catLift <= 0 && now > (o.busyUntil || 0) && walkTo(o.hx + (Math.sign(catX - o.hx) || 1) * petPx() * 0.55, dt, 0.7, 3) <= 3) {
          face(o.hx);
          sprite.setToyPose('toyWatch');
        }
        return;
      }
      if (a.kind === 'dud' || a.kind === 'confetti' || a.kind === 'snake') {
        if (now - a.t > (a.kind === 'snake' ? 1500 : 1800)) o.actor = null;
        return sprite.setMove(0);
      }
      const fall = (drag) => {
        a.vy += 1500 * dt;
        a.x = clamp(a.x + a.vx * dt, 8, window.innerWidth - 8);
        a.y = Math.min(floorY() - 4, a.y + a.vy * dt);
        if (a.y >= floorY() - 4) a.vx *= drag;
      };
      if (a.kind === 'fish' || a.kind === 'gold') fall(0.8);
      else if (a.kind === 'flowers') fall(0.6);
      else if (a.kind === 'mouse') {
        // 바닥에 닿으면 쪼르르. 가끔 방향을 홱 바꾼다
        a.vy += 1500 * dt;
        a.y = Math.min(floorY() - 4, a.y + a.vy * dt);
        if (a.y >= floorY() - 4 && now > a.turn) {
          a.vx = (Math.random() < 0.5 ? -1 : 1) * rand(180, 260);
          a.turn = now + rand(500, 1300);
        }
        a.x += a.vx * dt;
        if (a.x < 10 || a.x > window.innerWidth - 10) a.vx = -a.vx;
        a.x = clamp(a.x, 10, window.innerWidth - 10);
      } else if (a.kind === 'rabbit') {
        // 깡충깡충 도망
        a.x += a.dir * 150 * dt;
        a.hop += dt * 8;
        if (a.x < 10 || a.x > window.innerWidth - 10) a.dir = -a.dir;
      } else {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.vy -= 20 * dt;
        if (a.y < -30 || a.x < -30 || a.x > window.innerWidth + 30) o.actor = null;
      }
      if (catLift > 0 || now < (o.busyUntil || 0)) return sprite.setMove(0);
      if (a.kind === 'flowers') {
        // 꽃다발: 다가가 킁킁 → 에취
        if (a.y < floorY() - 5) return sprite.setMove(0);
        if (walkTo(a.x + (Math.sign(catX - a.x) || 1) * petPx() * 0.3, dt, 0.7, 3) > 3) return;
        face(a.x);
        sprite.setToyPose(null);
        sprite.play('toyAchoo');
        o.busyUntil = now + 1600;
        K.later(o, 900, () => {
          if (o.actor !== a) return;
          burst(o, a.x, a.y - 6, 12, ['#e8534a', '#ffd65a', '#ff9bb8', '#78c46a'], 200, 900);
          o.actor = null;
        });
        scored(o, now);
        return;
      }
      const tg = { x: a.x, y: a.kind === 'rabbit' ? floorY() - 10 - Math.abs(Math.sin(a.hop)) * 16 : a.y };
      chase(o, tg, dt, now, () => {
        o.actor = null;
        if (a.kind === 'fish' || a.kind === 'gold') {
          sprite.play('nibble');
          o.busyUntil = now + 1300;
          pop(o, a.kind === 'gold' ? 'GOLDEN!' : 'YUM', catX, K.catTop() - 16, '#ffd35c', 900);
          if (a.kind === 'gold') {
            // 황금 물고기는 한 번 더 신나게
            burst(o, catX, K.catTop(), 24, ['#ffd35c', '#fff3bf', '#ffffff'], 240, 1100);
            K.later(o, 1300, () => toy === o && catLift <= 0 && sprite.play('toyYay'));
            o.busyUntil = now + 2600;
            scored(o, now);
          }
        } else if (a.kind === 'mouse') {
          sprite.setToyPose(null);
          sprite.play('toyPin');
          o.busyUntil = now + 1600;
          sfx('squeak', 0.03);
          pop(o, 'SQUEAK', tg.x, tg.y - 16, '#ffffff', 700);
        } else {
          burst(o, tg.x, tg.y, 10, a.kind === 'rabbit' ? ['#ffffff', '#ff9bb8'] : ['#8f95a0', '#ffffff'], 160, 600);
          pop(o, 'POOF', tg.x, tg.y - 16, '#ffffff', 700);
        }
        scored(o, now);
      }, { fast: a.kind === 'rabbit' || a.kind === 'mouse' ? 1.4 : 1, noLeap: a.kind === 'mouse' });
    },
    draw(ctx, o, D, now) {
      const t = now / 1000;
      const b = now - o.bounce < 250 ? -2 * D : 0;
      const S = D + 1; // 모자는 조금 크게
      // 고양이가 모자 옆에 바짝 붙어 앉으면 모자가 고양이 뒤로 보이게
      const hw = (HAT[0].length + 2) * S;
      const hh = (HAT.length + 4) * S;
      const a = o.actor;
      // 용수철 뱀: 모자에서 지그재그 용수철이 쭉 솟았다가 출렁출렁 들어간다
      if (a && a.kind === 'snake') {
        const k = (now - a.t) / 1500;
        const h = Math.round((k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1 + Math.sin((k - 0.12) * 30) * 0.12 * (1 - k)) * 22);
        const y0 = floorY() - HAT.length * S + S;
        for (let i = 0; i < h; i++) {
          const c = i % 4 < 2 ? -1 : 1; // 지그재그 용수철 (세 칸 굵기, 줄마다 밝게·어둡게)
          for (let dx = -1; dx <= 1; dx++) FT.dotAt(ctx, o.hx + (c + dx) * D, y0 - i * D, D, Math.abs(dx) === 1 && i % 2 ? '#2b1a10' : i % 2 ? '#4b8f43' : '#78c46a');
        }
        stamp(ctx, SNAKE_HEAD, o.hx, y0 - h * D - 2 * D, D);
      }
      FT.underCat(ctx, (g) => stamp(g, HAT, o.hx, floorY() - (HAT.length * S) / 2 + b, S), [o.hx - hw / 2, floorY() - hh, hw, hh + S]);
      if (a && a.kind === 'fish') stamp(ctx, FISH, a.x, a.y, D, a.vx < 0);
      if (a && a.kind === 'gold') {
        stamp(ctx, GOLD_FISH, a.x, a.y, D, a.vx < 0);
        if (Math.floor(t * 8) % 2) FT.dotAt(ctx, a.x + Math.sin(t * 13) * 8, a.y + Math.cos(t * 9) * 6, D, '#fff3bf');
      }
      if (a && a.kind === 'rabbit') stamp(ctx, RABBIT, a.x, a.y - Math.abs(Math.sin(a.hop)) * 16, D, a.dir < 0);
      if (a && a.kind === 'pigeon') stamp(ctx, PIGEON[Math.floor(t * 8) % 2], a.x, a.y, D, a.vx < 0);
      if (a && a.kind === 'mouse') {
        stamp(ctx, HAT_MOUSE, a.x, a.y - 2 * D, D, a.vx < 0);
        const back = a.vx < 0 ? 1 : -1;
        FT.line(ctx, a.x + back * 5 * D, a.y - D, a.x + back * 8 * D, a.y - (Math.floor(t * 10) % 2 ? 3 : 1) * D, D, '#ff9bb8');
      }
      if (a && a.kind === 'flowers') stamp(ctx, FLOWERS, a.x, a.y - 3 * D, D);
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T26 고양이 슬롯머신 =================
  // 레버(기계)를 누르면 10코인을 넣고 릴 세 개가 돌아간다. 같은 그림 셋이면 간식이 우르르!
  // 꽝이면 고양이가 기계를 걷어찬다
  const SYM = [
    ['.KKK.', 'KOOOK', 'KOHOK', 'KOOOK', '.KKK.'], // 동전
    ['.KK.K', 'KBBKB', 'KBBBK', '.KK.K', '.....'], // 생선
    ['.K.K.', 'KPKPK', 'KPPPK', '.KPK.', '..K..'], // 하트
    ['..K..', '.KYK.', 'KYYYK', '.KYK.', '..K..'], // 별
    ['.KKK.', 'KWKWK', 'KWWWK', 'KWKWK', '.KKK.'], // 해골(꽝)
  ];
  // 상점 그림처럼 노란 몸통에 빨간 머리띠(전구 셋), 하얀 릴 창, 동전 받이, 오른쪽에 레버 받침
  const MACHINE = [
    '.KKKKKKKKKKKKKKKKK.',
    'KRRRRRRRRRRRRRRRRRK',
    'KRHRRYRRRYRRRYRRRrK',
    'KKKKKKKKKKKKKKKKKKKK',
    'KYKWWWWWWWWWWWWKYyKY',
    'KYKWWWWWWWWWWWWKYyKK',
    'KYKWWWWWWWWWWWWKYyK',
    'KYKWWWWWWWWWWWWKYyK',
    'KYKKKKKKKKKKKKKKYyK',
    'KYYYYYYKKKKKYYYYYyK',
    'KYHYYYYYYYYYYYYYYyK',
    'KyyyyyyyyyyyyyyyyyK',
    'KKKKKKKKKKKKKKKKKKK',
  ].map((r) => r.padEnd(20, '.'));
  const REEL_ROW = 6; // 릴 창 가운데 (위에서 몇 칸)
  const REEL_COL = [5, 9, 13]; // 릴 셋의 가운데 (왼쪽에서 몇 칸)
  C.slotmachine = {
    start(o, side) {
      Object.assign(o, { mx: clamp(catX + side * petPx() * 1.2, 50, window.innerWidth - 50), reels: [0, 1, 2], spinning: 0, shake: 0 });
    },
    wantsMouse(o, e) {
      const D = itemDot();
      return inBox(e, o.mx, floorY(), MACHINE[0].length * D * 1.5 + 8, MACHINE.length * D * 1.5 + 8);
    },
    down() {},
    async click(o) {
      if (o.spinning) return;
      o.spinning = performance.now();
      o.pull = performance.now();
      sfx('spin', 0.03);
      let r;
      try {
        r = await pet.slot();
      } catch {
        r = { ok: false };
      }
      if (toy !== o) return;
      const wait = Math.max(0, 1300 - (performance.now() - o.spinning));
      K.later(o, wait, () => {
        o.spinning = 0;
        const now = performance.now();
        if (!r || !r.ok) {
          pop(o, r && r.reason === 'coins' ? 'NO COIN' : 'ERROR', o.mx, floorY() - 70, '#ff9a9a', 1000);
          return;
        }
        o.reels = r.reels;
        if (r.win) {
          sfx('win', 0.05);
          pop(o, 'JACKPOT', o.mx, floorY() - 80, '#ffd35c', 1400);
          burst(o, o.mx, floorY() - 50, 30, ['#ffd35c', '#ff6f91', '#6fb0ea', '#78c46a'], 280, 1200);
          sprite.setToyPose(null);
          if (catLift <= 0) sprite.play('toyYay');
          o.busyUntil = now + 1300;
        } else {
          sfx('lose', 0.04);
          pop(o, '-10', o.mx, floorY() - 70, '#ff9a9a', 800);
          // 발로 쾅
          sprite.setToyPose(null);
          face(o.mx);
          if (catLift <= 0) sprite.play('toyPunch');
          o.shake = now + 500;
          o.busyUntil = now + 1300;
        }
      });
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      if (catLift > 0 || now < (o.busyUntil || 0)) return sprite.setMove(0);
      if (walkTo(o.mx - (Math.sign(o.mx - catX) || 1) * petPx() * 0.6, dt, 0.8, 3) <= 3) {
        face(o.mx);
        sprite.setToyPose(o.spinning ? 'toyWatch' : null);
      }
    },
    draw(ctx, o, D, now) {
      const S = D + 1; // 기계는 조금 크게
      const shake = now < o.shake ? (Math.floor(now / 40) % 2 ? S : -S) : 0;
      const h = MACHINE.length * S;
      const x = o.mx + shake;
      const y = floorY() - h / 2;
      stamp(ctx, MACHINE, x, y, S);
      // 릴 세 칸
      const x0 = Math.floor((x - (MACHINE[0].length / 2) * S) / S) * S; // stamp 이 찍은 왼쪽 위
      const y0 = Math.floor((y - h / 2) / S) * S;
      const reelY = y0 + REEL_ROW * S;
      const t = now / 1000;
      for (let i = 0; i < 3; i++) {
        const sym = o.spinning ? SYM[Math.floor(t * 14 + i * 2) % SYM.length] : SYM[o.reels[i]];
        stamp(ctx, sym, x0 + REEL_COL[i] * S, reelY, Math.max(1, S - 1));
      }
      // 머리띠 전구: 돌아가는 동안·방금 끝났을 때 번갈아 깜빡
      if (o.spinning || now < (o.busyUntil || 0)) {
        const on = Math.floor(t * 8) % 2;
        for (let i = 0; i < 3; i++) if ((i + on) % 2) FT.dotAt(ctx, x0 + REEL_COL[i] * S, y0 + 2 * S, S, '#fff6c8');
      }
      // 레버: 받침에서 올라온 막대 끝에 빨간 손잡이. 당기면 아래로 젖혀진다
      const pulled = now - (o.pull || 0) < 300;
      const lx = x0 + 19 * S;
      const ky = y0 + (pulled ? 7 : 1) * S;
      FT.line(ctx, lx, y0 + 4 * S, lx, ky, S, '#8f95a0');
      FT.dotAt(ctx, lx, ky - S, S, '#e8534a');
      FT.dotAt(ctx, lx, ky, S, '#a52e2a');
      ftext(ctx, '10C', x - 0.5 * S, y - h / 2 - 5 * D, D, '#ffd35c'); // 한 판 값
      commonDraw(ctx, o, D, now);
    },
  };

  root.TOY_CUSTOM = Object.assign(root.TOY_CUSTOM || {}, C);
})(window);
