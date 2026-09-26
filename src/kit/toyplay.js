// 2차 장난감 21종의 동작 (1/3). pet.js 의 놀이 틀에 꽂힌다:
//  start(o, side)     꺼냈을 때                      step(o, dt, now)  매 프레임 (고양이가 뭘 할지)
//  draw(ctx, o, D, t) 놀이판(화면 전체 캔버스)에 그리기  click(o, item)    톡 눌렀을 때
//  down(o, e) / up(o, quick, e)  마우스를 누르고 뗄 때 (cursor: true 인 장난감만 화면 어디서나)
//  grab(o, item) / release(o, item)  바닥 물건을 집고 놓을 때    end(o)  치울 때
// pet.js 의 전역(catX, catLift, sprite, walkTo, leap, scored, fieldFx…)을 그대로 쓴다. pet.js 다음에 읽는다.
(function (root) {
  const FT = PetToys;
  const PAL = FT.palOf('#2b1a10');
  const stamp = (ctx, rows, x, y, D, flip) => FT.stampAt(ctx, rows, x, y, D, PAL, flip);
  const H = () => window.innerHeight;
  const sfx = (name, v = 0.03) => soundOn && PetSound.play(name, v);

  // 놀이판에 도트 글자 (3×5 글꼴을 D 배로 키워서)
  const textCache = {};
  function ftext(ctx, s, cx, cy, D, fill = '#ffffff', outline = '#2b1a10') {
    const key = s + fill + outline;
    let c = textCache[key];
    if (!c) {
      c = document.createElement('canvas');
      c.width = PetSprite.util.textWidth(s) + 2;
      c.height = 7;
      PetSprite.util.drawText(c.getContext('2d'), s, 1, 1, fill, outline);
      textCache[key] = c;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, Math.round(cx - (c.width * D) / 2), Math.round(cy - (c.height * D) / 2), c.width * D, c.height * D);
  }

  // 도트 원 (채우기·테두리). 둘레가 빈틈 없이 이어지는 중점 원 (toys.js)
  const disc = (ctx, cx, cy, r, D, fill, edge) => FT.disc(ctx, cx, cy, r, D, fill, edge);

  // 도트 타원 (가로 반지름 rx, 세로 ry 칸). 칸마다 color(nx, ny, 테두리인가) 가 색을 고른다 (null 이면 건너뜀)
  function blob(ctx, cx, cy, rx, ry, D, color) {
    const x0 = Math.floor(cx / D) * D;
    const y0 = Math.floor(cy / D) * D;
    const half = (dy) => (Math.abs(dy) > ry ? -1 : Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2))));
    for (let dy = -ry; dy <= ry; dy++) {
      const w = half(dy);
      for (let dx = -w; dx <= w; dx++) {
        // 테두리: 줄 끝이거나, 위·아래 줄이 여기까지 안 닿는 칸
        const edge = Math.abs(dx) === w || Math.abs(dx) > half(dy - 1) || Math.abs(dx) > half(dy + 1);
        const c = color(dx / (rx + 0.5), dy / (ry + 0.5), edge);
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x0 + dx * D, y0 + dy * D, D, D);
      }
    }
  }

  // 고양이 몸 기준
  const catTop = () => H() - catLift - (PetSprite.GRID - sprite.headTop()) * cellPx();
  const catMidY = () => H() - catLift - petPx() * 0.28;
  const hitsCat = (x, y, pad = 0) => Math.abs(x - catX) < petPx() * 0.3 + pad && y > catTop() - pad && y < H() - catLift + pad;

  // 목표 지점을 쫓는 기본 사냥: 걸어가서, 낮으면 덮치고, 높으면 뛰어오르고, 너무 높으면 올려다보며 턱을 딱딱
  function chase(o, tg, dt, now, onCatch, opt = {}) {
    const P = petPx();
    if (catLift > 0) {
      sprite.setMove(0);
      if (!lifted && !opt.noAir) {
        const dx = tg.x - catX;
        catX = clamp(catX + Math.sign(dx) * Math.min(220 * dt, Math.abs(dx)), ...lane());
        placeCat();
        if (!o.airCaught && canReach(tg)) {
          o.airCaught = true;
          onCatch(true);
        }
      }
      return;
    }
    o.airCaught = false;
    if (now < (o.busyUntil || 0)) {
      sprite.setMove(0);
      return;
    }
    const h = floorY() - tg.y;
    const dist = walkTo(tg.x, dt, opt.fast || 1, 24);
    sprite.setLook(Math.min(1, dist / 60));
    if (dist > 24) return;
    face(tg.x);
    if (h < P * 0.5) {
      sprite.setToyPose(null);
      if (now > o.pounceUntil) {
        o.pounceUntil = now + (opt.every || 1100);
        sprite.play('pounce');
        onCatch(false);
      }
    } else if (h < P * 2 && !opt.noLeap) {
      if (now > o.pounceUntil) {
        o.pounceUntil = now + 1500;
        leap(h - P * 0.55);
      } else sprite.setToyPose('toyChatter');
    } else sprite.setToyPose('toyChatter');
  }

  // 펑! 고양이가 반대쪽으로 날아간다. 착지하면 그을린 채 멍하니 (landed 에서)
  function blast(o, fromX, power) {
    catVx = (Math.sign(catX - fromX) || 1) * 380 * power;
    catVy = -950 * power;
    catLift = 1;
    sprite.setToyPose(null);
    sprite.play('toyBlown', { times: 4 });
    o.blown = true;
  }
  // 날아갔다 착지했나 → 그을린 자세
  function landed(o, now) {
    if (!o.blown || catLift > 0) return false;
    o.blown = false;
    sprite.cancel();
    sprite.play('toySoot');
    o.busyUntil = now + 2700;
    return true;
  }

  // 바닥 물건 하나 더 (장난감이 내놓는 것). rows 를 주면 그 도트로, 아니면 도트 이름(key)으로 찍는다
  function extra(o, key, x, y, rows) {
    const it = rows ? paintRowsItem(rows) : spawnItem(key);
    Object.assign(it, { key, x, y, vx: 0, vy: 0 });
    toy.extras.push(it);
    placeItem(it);
    return it;
  }
  function paintRowsItem(rows) {
    const el = document.createElement('canvas');
    el.className = 'toy';
    const w = rows[0].length;
    el.width = w;
    el.height = rows.length;
    const d = itemDot();
    el.style.width = `${w * d}px`;
    el.style.height = `${rows.length * d}px`;
    const ctx = el.getContext('2d');
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (PAL[ch]) { ctx.fillStyle = PAL[ch]; ctx.fillRect(i, j, 1, 1); } }));
    document.body.appendChild(el);
    return { el, half: (Math.max(w, rows.length) * d) / 2 };
  }
  function dropItem(o, it) {
    it.el.remove();
    o.extras = o.extras.filter((x) => x !== it);
  }

  // 톡 튀는 작은 파편·가루 (놀이판에 그린다)
  function burst(o, x, y, n, colors, speed = 180, life = 700) {
    const now = performance.now();
    (o.bits ||= []);
    for (let i = 0; i < n; i++) {
      const an = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      o.bits.push({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - speed * 0.5, c: colors[i % colors.length], t: now, life });
    }
  }
  function stepBits(o, dt, now) {
    if (!o.bits) return;
    for (const b of o.bits) {
      b.vy += 900 * dt;
      b.x += b.vx * dt;
      b.y = Math.min(floorY() - 2, b.y + b.vy * dt);
      if (b.y >= floorY() - 2) b.vx *= 0.9;
    }
    o.bits = o.bits.filter((b) => now - b.t < b.life);
  }
  function drawBits(ctx, o, D, now) {
    for (const b of o.bits || []) {
      ctx.globalAlpha = Math.max(0, 1 - (now - b.t) / b.life);
      FT.dotAt(ctx, b.x, b.y, D, b.c);
    }
    ctx.globalAlpha = 1;
  }
  // 떠오르는 글자 (BONK·KABOOM…)
  function pop(o, s, x, y, color, life = 800) {
    (o.words ||= []).push({ s, x, y, color, t: performance.now(), life });
  }
  function drawWords(ctx, o, D, now) {
    o.words = (o.words || []).filter((w) => now - w.t < w.life);
    for (const w of o.words) {
      ctx.globalAlpha = Math.min(1, 2 * (1 - (now - w.t) / w.life));
      ftext(ctx, w.s, w.x, w.y - (now - w.t) * 0.03, D, w.color);
    }
    ctx.globalAlpha = 1;
  }
  // 잠시 뒤에 할 일. setTimeout 대신 놀이 프레임에 맞춰 돈다 (놀이를 치우면 같이 사라진다)
  function later(o, ms, fn) {
    (o.later ||= []).push({ t: performance.now() + ms, fn });
  }
  function runLater(o, now) {
    if (!o.later || !o.later.length) return;
    const due = o.later.filter((x) => now >= x.t);
    o.later = o.later.filter((x) => now < x.t);
    for (const x of due) x.fn();
  }
  const commonStep = (o, dt, now) => {
    stepBits(o, dt, now);
    runLater(o, now);
  };
  const commonDraw = (ctx, o, D, now) => {
    drawBits(ctx, o, D, now);
    drawWords(ctx, o, D, now);
  };

  // ================= 도트 =================
  const ART = {
    // 물총: 상점 그림처럼 파란 몸통 위에 노란 물통, 아래로 손잡이. 총구가 오른쪽 (고양이가 왼쪽이면 뒤집는다)
    squirt: [
      '....KKKK......',
      '...KYYYYK.....',
      '...KYHYyK.....',
      '.KKKKKKKKKKKK.',
      'KBBBBBBBBBBBBK',
      'KBHHBBBBBBBBKK',
      'KbBBBBKKKKKKK.',
      'KbBBBKK.K.....',
      'KbBBBK.KK.....',
      'KbBBBK........',
      '.KKKK.........',
    ],
    hammerDown: ['...KK...', '..KYYK..', 'KKKYYKKK'.slice(0, 8)],
    yoyo: ['..KKKK..', '.KRRRRK.', 'KRRKKRRK', 'KRKWWKRK', 'KRKWWKRK', 'KRRKKRRK', '.KRRRRK.', '..KKKK..'],
    shard: ['KW', 'WK'],
  };

  const C = {};

  // ================= T1 수류탄 =================
  // 집어 드는 순간 핀이 빠지고 5초 타이머. 던져 놓으면 시간이 되면 펑! 가까이 있던 고양이는 날아가서 그을린다
  C.grenade = {
    start(o, side) {
      Object.assign(o, spawnItem('grenade'));
      o.x = clamp(catX + side * 120, o.half, window.innerWidth - o.half);
      o.y = H() - petPx() - 120;
    },
    grab(o, it) {
      if (it === o) this.arm(o);
    },
    click(o, it) {
      if (it === o) this.arm(o);
    },
    arm(o) {
      if (o.lit || o.el.hidden) return;
      o.lit = true;
      o.boomAt = performance.now() + 5000;
      o.nextTick = 0;
      sfx('tick', 0.03);
    },
    boom(o, now) {
      const P = petPx();
      o.lit = false;
      o.el.hidden = true;
      if (held && held.o === o) held = null;
      o.boom = { x: o.x, y: o.y, t: now };
      o.respawnAt = now + 2600;
      sfx('boom', 0.06);
      pop(o, 'KABOOM', o.x, o.y - 30, '#ffd35c', 1000);
      burst(o, o.x, o.y, 26, ['#ff9a3c', '#ffd35c', '#e8534a', '#555555'], 320);
      const d = Math.hypot(o.x - catX, o.y - catMidY());
      if (d < P * 1.4 && catLift <= 0) blast(o, o.x, 1 - (d / (P * 1.4)) * 0.45);
      else if (d < P * 3.5 && catLift <= 0) {
        sprite.play('startle');
        o.fleeTo = catX + (Math.sign(catX - o.x) || 1) * P * 1.5;
        o.busyUntil = now + 900;
      }
      pet.caught();
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      if (landed(o, now)) return;
      if (o.lit) {
        if (now > o.nextTick) {
          o.nextTick = now + (o.boomAt - now < 1500 ? 250 : 1000);
          sfx('tick', 0.025);
        }
        if (now >= o.boomAt) this.boom(o, now);
      }
      if (o.el.hidden && now > o.respawnAt && !o.blown) {
        // 새 수류탄이 톡 떨어진다
        o.el.hidden = false;
        const side = catX > window.innerWidth / 2 ? -1 : 1;
        Object.assign(o, { x: clamp(catX + side * 150, o.half, window.innerWidth - o.half), y: 40, vx: 0, vy: 0 });
        placeItem(o);
      }
      if (catLift > 0 || now < (o.busyUntil || 0)) return sprite.setMove(0);
      if (o.fleeTo != null) {
        // 놀라서 저만치 도망갔다가 돌아본다
        if (walkTo(o.fleeTo, dt, 1.6, 4) <= 4) o.fleeTo = null;
        return;
      }
      if (o.el.hidden) return sprite.setMove(0);
      chase(o, { x: o.x, y: o.y }, dt, now, () => {
        // 앞발로 톡 — 굴러간다
        o.vy = -220;
        o.vx += (Math.sign(o.x - catX) || 1) * 160;
      }, { noLeap: true });
    },
    draw(ctx, o, D, now) {
      const t = now / 1000;
      if (o.lit && !o.el.hidden) {
        // 심지 불꽃과 남은 초
        const sx = o.x + o.half * 0.4;
        const sy = o.y - o.half - D;
        stamp(ctx, Math.floor(t * 12) % 2 ? ['.Y.', 'YWY', '.Y.'] : ['R.R', '.Y.', 'R.R'], sx, sy, D);
        const left = Math.max(0, Math.ceil((o.boomAt - now) / 1000));
        ftext(ctx, String(left), o.x, o.y - o.half - 9 * D, D + 1, left <= 1 ? '#ff5a5a' : '#ffffff');
      }
      if (o.boom) {
        // 펑: 하얀 섬광 → 주황 불덩이가 부풀며 가운데부터 꺼지고, 충격파 고리는 퍼지면서 점점 성겨진다. 뒤이어 회색 연기가 몽글몽글
        const k = (now - o.boom.t) / 800;
        if (k < 1) {
          const { x, y } = o.boom;
          const e = 1 - Math.pow(1 - k, 3);
          const r = 3 * D + e * petPx() * 0.6;
          if (k < 0.5) {
            disc(ctx, x, y, r * (0.75 - k * 0.6), D, k < 0.08 ? '#fff8d8' : '#ff9a3c');
            if (k < 0.35) disc(ctx, x, y, r * (0.5 - k), D, '#fff3a0');
          }
          const gap = k < 0.35 ? 99 : k < 0.65 ? 3 : 2;
          FT.ring(ctx, x, y, r, D, (a) => (Math.floor(a * 48) % gap ? (k < 0.5 ? '#ffd35c' : '#ff9a3c') : null));
          if (k > 0.35) {
            ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
            for (let i = 0; i < 6; i++) {
              const an = (i / 6) * Math.PI * 2 + 0.5;
              const d = r * 0.5;
              disc(ctx, x + Math.cos(an) * d, y + Math.sin(an) * d * 0.6 - k * 24, (2 + (i % 2)) * D * (0.7 + k * 0.6), D, i % 2 ? '#a39d98' : '#8a847f');
            }
            ctx.globalAlpha = 1;
          }
        } else o.boom = null;
      }
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T2 물총 =================
  // 물총이 마우스를 따라온다. 클릭하면 물줄기 슝, 꾹 누르면 연사. 맞으면 부르르, 세 번 맞으면 삐진다
  C.squirtgun = {
    cursor: true,
    start(o) {
      o.drops = [];
      o.hits = 0;
    },
    down(o) {
      o.firing = true;
    },
    up(o) {
      o.firing = false;
    },
    click(o) {
      for (let i = 0; i < 5; i++) this.shoot(o, i * 0.02);
    },
    shoot(o, delay = 0) {
      const D = itemDot();
      const dir = catX >= mouseX ? 1 : -1;
      // 총구 (그림에서 손잡이를 마우스에 맞췄을 때 오른쪽 끝 넷째 줄)
      const mx = mouseX + dir * 12 * D;
      const my = mouseY - 3 * D;
      const tx = catX;
      const ty = catMidY();
      const dist = Math.max(40, Math.hypot(tx - mx, ty - my));
      const sp = 720;
      o.drops.push({ x: mx, y: my, vx: ((tx - mx) / dist) * sp + rand(-30, 30), vy: ((ty - my) / dist) * sp - 90 + rand(-30, 30), t: performance.now() + delay * 1000 });
      sfx('splash', 0.01);
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      if (o.firing && now > (o.nextShot || 0)) {
        o.nextShot = now + 70;
        this.shoot(o);
      }
      for (const d of o.drops) {
        if (now < d.t) continue;
        d.vy += 600 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (hitsCat(d.x, d.y, 4)) {
          d.dead = true;
          this.hit(o, now);
        } else if (d.y >= floorY() - 2) {
          d.dead = true;
          burst(o, d.x, floorY() - 3, 3, ['#9fd8f5', '#cfe8f7'], 90, 350);
        }
      }
      o.drops = o.drops.filter((d) => !d.dead && d.x > -20 && d.x < window.innerWidth + 20);
      if (catLift > 0) return sprite.setMove(0);
      if (now < (o.sulkUntil || 0)) {
        sprite.setMove(0);
        sprite.setFacing(Math.sign(catX - mouseX) || 1); // 등 돌리고 삐짐
        return;
      }
      if (o.sulkUntil) {
        o.sulkUntil = 0;
        sprite.setToyPose(null);
      }
      if (now < (o.busyUntil || 0)) return sprite.setMove(0);
      // 물총을 경계하며 노려본다. 너무 가까우면 조금 물러선다
      sprite.setMove(0);
      face(mouseX);
      if (Math.abs(mouseX - catX) < petPx() * 0.7 && now > (o.stepBackAt || 0)) {
        o.stepBackAt = now + 1500;
        o.backTo = catX + (Math.sign(catX - mouseX) || 1) * 60;
      }
      if (o.backTo != null && walkTo(o.backTo, dt, 0.8, 3) <= 3) {
        o.backTo = null;
        face(mouseX);
      }
      sprite.setToyPose(o.backTo == null ? 'toyChatter' : null);
    },
    hit(o, now) {
      if (now < (o.wetUntil || 0) || now < (o.sulkUntil || 0)) return;
      o.wetUntil = now + 1500;
      o.hits++;
      sprite.setToyPose(null);
      sprite.play('toyWet');
      o.busyUntil = now + 1400;
      pop(o, 'SPLASH', catX, catTop() - 10, '#bfe6ff', 600);
      pet.caught();
      if (o.hits >= 3) {
        o.hits = 0;
        o.sulkUntil = now + 1500 + 4000;
        later(o, 1400, () => sprite.setToyPose('toySulk'));
      }
    },
    draw(ctx, o, D, now) {
      const flip = catX < mouseX;
      stamp(ctx, ART.squirt, mouseX + (flip ? -5 : 5) * D, mouseY - 2 * D, D, flip);
      // 물줄기: 방울마다 지나온 길을 옅은 꼬리로 그어 한 줄기로 이어 보이게
      for (const d of o.drops) if (now >= d.t) {
        FT.line(ctx, d.x - d.vx * 0.022, d.y - d.vy * 0.022, d.x, d.y, D, 'rgba(191,230,255,0.85)');
        FT.dotAt(ctx, d.x, d.y, D, '#6fb0ea');
      }
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T6 풍선 =================
  // 꾹 누르는 만큼 풍선이 부푼다. 놓으면 둥실 떠오르고, 고양이가 뛰어올라 발톱으로 펑!
  // [겉, 그림자·매듭]. 가끔(4개 중 1개꼴) 물방울무늬가 들어간다 (dots = 무늬 색)
  const BALLOON_COLORS = [
    ['#e8534a', '#a8322c'], ['#6fb0ea', '#3d6fb0'], ['#ffd35c', '#d9a21f'], ['#b784f5', '#8456c6'], ['#78c46a', '#4b8f43'],
    ['#ff8fb8', '#d0577f'], ['#ff9a3c', '#c8661b'], ['#4fd1c5', '#2a9187'], ['#a8e6a1', '#6bb463'], ['#f4f1ea', '#bdb6a8'],
    ['#2f4b8f', '#1c2e5c'], ['#ffc7de', '#e08cb0'], ['#c9b8ff', '#8f7ad6'], ['#f3c84b', '#b8860b'], ['#ef3b7a', '#a51f52'],
  ];
  const DOT_COLORS = ['#ffffff', '#ffd35c', '#ff8fb8', '#6fb0ea'];
  let lastBalloon = -1;
  // 바로 전과 같은 색은 안 나오게
  const pickBalloon = () => {
    let i;
    do i = Math.floor(Math.random() * BALLOON_COLORS.length);
    while (i === lastBalloon);
    lastBalloon = i;
    const col = BALLOON_COLORS[i];
    return Math.random() < 0.25 ? [...col, DOT_COLORS.filter((d) => d !== col[0])[Math.floor(Math.random() * 3)]] : col;
  };
  C.balloon = {
    cursor: true,
    start(o) {
      o.list = [];
    },
    down(o) {
      if (o.list.length >= 4) return;
      o.pump = { x: mouseX, y: mouseY, r: 4, col: pickBalloon() };
      sfx('pop', 0.01);
    },
    up(o) {
      const b = o.pump;
      o.pump = null;
      if (!b || b.r < petPx() * 0.07) return;
      // 둥실 떠올라서 고양이 앞발이 닿을락 말락 한 높이에 머문다. 한참 지나면 하늘로
      const P = petPx();
      Object.assign(b, { vx: rand(-15, 15), vy: -30, born: performance.now(), wob: Math.random() * 6, taps: 0, hover: floorY() - P * (0.75 + Math.random() * 0.5) });
      o.list.push(b);
    },
    click() {},
    step(o, dt, now) {
      commonStep(o, dt, now);
      if (o.pump) {
        o.pump.r = Math.min(petPx() * 0.16, o.pump.r + 16 * dt); // 다 불어도 고양이 머리만 하게
        o.pump.x = mouseX;
        o.pump.y = mouseY - o.pump.r;
      }
      for (const b of o.list) {
        const ay = now - b.born < 12000 ? (b.hover - b.y) * 1.5 - b.vy * 1.2 : -40;
        b.vy += ay * dt;
        b.vx *= Math.pow(0.5, dt);
        b.x += (b.vx + Math.sin(now / 500 + b.wob) * 10) * dt;
        b.y += b.vy * dt;
        b.x = clamp(b.x, b.r, window.innerWidth - b.r);
      }
      o.list = o.list.filter((b) => b.y + b.r > -10);
      if (landed(o, now)) return;
      // 제일 낮은 풍선의 실 끝(또는 풍선)을 노린다
      const tgt = o.list.reduce((best, b) => (!best || b.y > best.y ? b : best), null);
      if (!tgt) {
        sprite.setMove(0);
        return;
      }
      chase(o, { x: tgt.x, y: tgt.y + tgt.r }, dt, now, () => {
        // 톡톡 치다가… 발톱에 걸리면 펑
        if (tgt.taps >= 2 || Math.random() < 0.3) return this.popIt(o, tgt, now);
        tgt.taps++;
        tgt.vy = -140;
        tgt.vx = (Math.sign(tgt.x - catX) || 1) * rand(50, 100);
        sfx('bubble', 0.02);
        pop(o, 'TAP', tgt.x, tgt.y - tgt.r - 6, '#ffffff', 500);
      });
    },
    popIt(o, b, now) {
      o.list = o.list.filter((x) => x !== b);
      sfx('boom', 0.02);
      pop(o, 'POP', b.x, b.y - b.r, '#ffffff', 600);
      burst(o, b.x, b.y, 12, [b.col[0], b.col[1]], 200, 600);
      if (catLift <= 0) {
        sprite.play('startle');
        o.busyUntil = now + 2200;
      } else o.startleOnLand = true;
      scored(o, now);
    },
    draw(ctx, o, D, now) {
      // 풍선: 세로로 살짝 긴 타원, 오른쪽 아래는 한 톤 어둡게, 왼쪽 위엔 반짝이는 광택. 아래에 묶은 매듭과 하늘거리는 끈
      const draw1 = (b) => {
        const rx = Math.max(2, Math.round(b.r / D));
        const ry = rx + Math.max(1, Math.round(rx * 0.18));
        const dots = b.col[2] && rx > 4 ? [[0.35, 0.1], [-0.4, 0.3], [0.05, -0.4], [0.15, 0.55], [-0.2, -0.05]].map(([fx, fy]) => [Math.round(fx * rx), Math.round(fy * ry)]) : [];
        blob(ctx, b.x, b.y, rx, ry, D, (nx, ny, edge) => {
          if (edge) return '#2b1a10';
          const lx = Math.round(nx * (rx + 0.5));
          const ly = Math.round(ny * (ry + 0.5));
          if (dots.some(([a, c]) => a === lx && c === ly)) return b.col[2];
          return nx * 0.6 + ny > 0.62 ? b.col[1] : b.col[0];
        });
        // 광택: 왼쪽 위에 짧은 사선 두세 칸
        const x0 = Math.floor(b.x / D) * D;
        const y0 = Math.floor(b.y / D) * D;
        const hx = -Math.round(rx * 0.5);
        const hy = -Math.round(ry * 0.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x0 + hx * D, y0 + hy * D, D, D);
        ctx.fillRect(x0 + hx * D, y0 + (hy + 1) * D, D, D);
        if (rx > 3) ctx.fillRect(x0 + (hx + 1) * D, y0 + (hy - 1) * D, D, D);
        // 매듭 (작은 삼각형)
        ctx.fillStyle = b.col[1];
        ctx.fillRect(x0, y0 + (ry + 1) * D, D, D);
        ctx.fillRect(x0 - D, y0 + (ry + 2) * D, 3 * D, D);
        // 끈: 매듭에서 아래로 하늘하늘 (이어진 선)
        let px = x0 + D / 2;
        let py = y0 + (ry + 3) * D;
        for (let i = 1; i <= 7; i++) {
          const nx2 = x0 + D / 2 + Math.round(Math.sin(now / 320 + (b.wob || 0) + i * 0.8) * 1.4) * D;
          const ny2 = y0 + (ry + 3 + i * 2) * D;
          FT.line(ctx, px, py, nx2, ny2, D, '#8a5a32');
          px = nx2;
          py = ny2;
        }
      };
      for (const b of o.list) draw1(b);
      if (o.pump) draw1(o.pump);
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T7 요요 =================
  // 요요가 손(마우스)에 매달려 있다. 마우스를 휙 내리거나 클릭하면 쭉 내려갔다 감겨 올라온다
  C.yoyo = {
    cursor: true,
    start(o) {
      Object.assign(o, { len: 20, vlen: 0, lastY: mouseY, spin: 0 });
    },
    click(o) {
      o.vlen += 900;
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      const vy = (mouseY - o.lastY) / Math.max(dt, 0.001);
      o.lastY = mouseY;
      if (vy > 300) o.vlen += vy * 0.35 * dt * 10;
      const maxLen = Math.max(24, floorY() - mouseY - 8);
      o.vlen += (-(o.len - 20) * 14 - o.vlen * 2.2) * dt;
      o.len += o.vlen * dt;
      if (o.len > maxLen) {
        o.len = maxLen;
        o.vlen = -Math.abs(o.vlen) * 0.6;
      }
      if (o.len < 16) {
        o.len = 16;
        o.vlen = 0;
      }
      o.spin += (o.vlen / 10) * dt;
      if (landed(o, now)) return;
      chase(o, { x: mouseX, y: mouseY + o.len }, dt, now, () => {
        // 앞발에 채였다! 요요가 휙 감겨 올라간다
        o.vlen = -700;
        scored(o, now);
      });
    },
    draw(ctx, o, D, now) {
      const x = mouseX;
      const y = mouseY + o.len;
      FT.line(ctx, mouseX, mouseY, x, y - 4 * D, D, '#7a5c3e');
      const frame = Math.floor(o.spin * 4) % 2;
      stamp(ctx, frame ? ART.yoyo : ART.yoyo.map((r) => [...r].reverse().join('')), x, y, D);
      stamp(ctx, ['KKK', 'KSK', 'KKK'], mouseX, mouseY - D, D); // 손가락 고리
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= T14 책상 위 컵 =================
  // 컵을 끌어서 허공(선반이라 치자) 아무 데나 올려 두면 거기 그대로 있다.
  // 고양이가 천천히 다가가 뛰어올라 앞발로… 툭. 떨어진 컵은 와장창, 고양이는 무표정
  C.cup = {
    start(o, side) {
      Object.assign(o, spawnItem('cup'));
      Object.assign(o, { x: clamp(catX + side * petPx() * 1.1, o.half, window.innerWidth - o.half), y: H() - petPx() * 1.5, noPhysics: true });
      this.shelfUnder(o);
    },
    // 컵이 허공에 떠 있지 않게, 컵을 올려 둔 자리에 벽 선반을 단다. 컵이 떨어져도 선반은 그 자리에 남는다
    shelfUnder(o) {
      const D = itemDot();
      o.shelf = floorY() - (o.y + o.half) > 3 * D ? { x: o.x, y: o.y + o.half - 2 * D, w: Math.round((o.half * 2) / D) + 8 } : null;
    },
    release(o, it) {
      if (it !== o) return;
      Object.assign(o, { vx: 0, vy: 0, noPhysics: true, falling: false });
      this.shelfUnder(o);
    },
    click() {},
    step(o, dt, now) {
      commonStep(o, dt, now);
      const P = petPx();
      if (landed(o, now)) return;
      if (o.el.hidden) {
        if (now > o.respawnAt) {
          // 새 컵이 선반 위에
          o.el.hidden = false;
          const side = Math.random() < 0.5 ? -1 : 1;
          Object.assign(o, { x: clamp(catX + side * P * 1.3, o.half, window.innerWidth - o.half), y: H() - P * (1.2 + Math.random() * 0.8), vx: 0, vy: 0, noPhysics: true });
          placeItem(o);
          this.shelfUnder(o);
        }
        return sprite.setMove(0);
      }
      if (!o.noPhysics) {
        // 떨어지는 중 → 바닥에 닿으면 와장창
        if (o.vy === 0 && onFloor(o)) {
          o.el.hidden = true;
          o.respawnAt = now + 2500;
          sfx('boom', 0.02);
          pop(o, 'CRASH', o.x, o.y - 20, '#ffffff', 800);
          burst(o, o.x, o.y, 14, ['#fffaf3', '#e8534a', '#d6cfc4'], 220, 900);
          sprite.setToyPose(null);
          if (catLift <= 0) sprite.play('toyDeadpan');
          o.busyUntil = now + 2000;
        } else if (o.vy > 0) face(o.x);
        return sprite.setMove(0);
      }
      if (held && held.o === o) return sprite.setMove(0);
      if (catLift > 0) {
        // 뛰어오른 채 앞발이 닿으면 툭
        if (canReach({ x: o.x, y: o.y })) this.push(o, now);
        return;
      }
      if (now < (o.busyUntil || 0)) return sprite.setMove(0);
      const side = Math.sign(catX - o.x) || 1;
      const standX = o.x + side * P * 0.18; // 앞발이 닿는 거리
      if (walkTo(standX, dt, 0.5, 3) > 3) return; // 천천히 다가간다
      face(o.x);
      const h = floorY() - o.y;
      if (h < P * 0.55) {
        if (now > o.pounceUntil) {
          o.pounceUntil = now + 1500;
          o.busyUntil = now + 600;
          sprite.play('pounce');
          later(o, 300, () => this.push(o));
        }
      } else if (h < P * 2.2) {
        if (now > o.pounceUntil) {
          o.pounceUntil = now + 2200;
          o.busyUntil = now + 800;
          sprite.setToyPose('toyDeadpan'); // 올려다보며 한 번 째려보고
          later(o, 700, () => catLift <= 0 && leap(h - P * 0.25));
        }
      } else sprite.setToyPose('toyChatter');
    },
    push(o) {
      if (!o.noPhysics) return;
      o.noPhysics = false;
      o.vx = (Math.sign(o.x - catX) || sprite.facing) * 160;
      o.vy = -60;
      pet.caught();
    },
    draw(ctx, o, D, now) {
      const s = o.shelf;
      if (s && !(held && held.o === o)) {
        // 나무 선반 판 + 양쪽 까치발. 뛰어오른 고양이가 선반 앞에 보이게 고양이 뒤에 그린다
        const w = s.w;
        const rows = [
          'K'.repeat(w),
          'K' + 'S'.repeat(w - 2) + 'K',
          'K' + 't'.repeat(w - 2) + 'K',
          'K'.repeat(w),
          '..KtK' + '.'.repeat(w - 10) + 'KtK..',
          '...KK' + '.'.repeat(w - 10) + 'KK...',
          '....K' + '.'.repeat(w - 10) + 'K....',
        ];
        const x0 = s.x - (w * D) / 2;
        FT.underCat(ctx, (g) => FT.stampAt(g, rows, s.x, s.y + (rows.length * D) / 2, D, PAL), [x0 - D, s.y - D, (w + 2) * D, (rows.length + 2) * D]);
      }
      commonDraw(ctx, o, D, now);
    },
  };

  root.TOY_CUSTOM = Object.assign(root.TOY_CUSTOM || {}, C);
  root.ToyKit = { later, stamp, ftext, disc, chase, blast, landed, extra, paintRowsItem, dropItem, burst, stepBits, drawBits, pop, drawWords, commonStep, commonDraw, catTop, catMidY, hitsCat, sfx, H };
})(window);
