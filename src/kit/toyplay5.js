// 4차 장난감 (2026-10-17): 여섯 가지.
//  지켜보는 장난감 — 햇살 조각 · 어항
//  같이 하는 놀이(최고 기록) — 이불 속 손 · 고양이 찾기(야바위) · 비치볼 배구 · 냥냥 피아노(따라 치기)
// 앞의 장난감들처럼 pet.js 의 놀이 틀(start·step·draw·click·down·up·end)에 꽂히고, toyplay.js 의 ToyKit 을 같이 쓴다.
// 놀이 자세(toyBask·toyStare·toyHidden…)는 하우스 미리보기도 쓸 수 있게 toys.js 에 둔다.
// 최고 기록은 toyplay4.js 처럼 window.TOY_RECORDS + pet.toyRecord 로 남긴다 (main 의 RECORD_KEYS 에 키가 있어야 저장된다)
(function (root) {
  const K = root.ToyKit;
  const FT = PetToys;
  const { stamp, ftext, disc, pop, burst, commonStep, commonDraw, sfx, H } = K;
  const C = {};

  // ---------- 공통 ----------
  const W = () => window.innerWidth;
  const dotPx = () => Math.max(2, Math.round(cellPx()));
  const REC = () => (root.TOY_RECORDS = root.TOY_RECORDS || {});
  // 더 높으면 새 기록. 새 기록이면 true
  function best(key, v) {
    const r = REC();
    if (!(v > (r[key] || 0))) return false;
    r[key] = v;
    if (pet.toyRecord) pet.toyRecord(key, v);
    return true;
  }
  const played = () => (pet.played ? pet.played() : pet.caught());
  const busy = (o, now) => now < (o.busyUntil || 0);
  const big = (ctx, s, x, y, D, fill) => ftext(ctx, s, x, y, D * 2, fill);
  // 고양이가 쳐다보는 쪽 (toys.js 의 toyStare 가 읽는다)
  const look = (x, y) => {
    FT.look.x = clamp(x, -1, 1);
    FT.look.y = clamp(y, -1, 1);
  };
  // 고양이 머리 꼭대기 (글자 띄울 높이)
  const catTop = () => K.catTop();

  // 사각파 한 음. PetSound 에는 음계가 없어서 피아노·배구는 여기서 직접 낸다. 놀이를 치우면 장치를 쉬게 한다
  let actx = null;
  function tone(freq, len = 0.16, vol = 0.03, type = 'square', slide = 0) {
    if (!soundOn) return;
    try {
      actx = actx || new AudioContext();
      if (actx.state === 'suspended') actx.resume().catch(() => {});
      const t = actx.currentTime + 0.01;
      const osc = actx.createOscillator();
      const g = actx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + len);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(g).connect(actx.destination);
      osc.start(t);
      osc.stop(t + len + 0.02);
    } catch {}
  }
  const hush = () => {
    if (actx && actx.state === 'running') actx.suspend().catch(() => {});
  };

  // 도트 타원 (가로 반지름 rx, 세로 ry 칸). color(dx, dy, 테두리인가) 가 칸마다 색을 고른다 (null 이면 건너뜀)
  function oval(ctx, cx, cy, rx, ry, D, color) {
    const x0 = Math.round(cx / D) * D;
    const y0 = Math.round(cy / D) * D;
    const half = (dy) => (Math.abs(dy) > ry ? -1 : Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2))));
    for (let dy = -ry; dy <= ry; dy++) {
      const w = half(dy);
      for (let dx = -w; dx <= w; dx++) {
        const edge = Math.abs(dx) === w || Math.abs(dx) > half(dy - 1) || Math.abs(dx) > half(dy + 1);
        const c = color(dx, dy, edge);
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x0 + dx * D, y0 + dy * D, D, D);
      }
    }
  }
  // 놀이 끝 화면: 큰 점수 · 최고 기록 · 한 판 더
  function results(ctx, o, x, y, D, now, head, line) {
    big(ctx, head, x, y - 16 * D, D, '#ffd35c');
    ftext(ctx, line, x, y - 6 * D, D, '#ffffff');
    ftext(ctx, o.isBest ? 'NEW BEST!' : `BEST ${o.bestShown}`, x, y + 1 * D, D, o.isBest ? '#9fe3c8' : '#ffffff');
    if (now - o.overAt > 1200) ftext(ctx, 'CLICK TO PLAY', x, y + 8 * D, D, Math.floor(now / 500) % 2 ? '#ffffff' : '#ffd35c');
  }
  function finish(o, key, value, now) {
    o.isBest = best(key, value);
    o.bestShown = REC()[key] || 0;
    o.overAt = now;
    sfx(o.isBest ? 'win' : 'quest', 0.03);
    if (o.isBest) burst(o, catX, catTop() - 10, 18, ['#ffd35c', '#9fe3c8', '#ff9bb8', '#ffffff'], 220, 1000);
  }

  // ================= N1 햇살 조각 =================
  // 창으로 들어온 햇살 한 조각을 바닥에 깔아 둔다. 고양이가 와서 앉아 눈을 가늘게 뜨고 → 벌러덩 배를 굽고 → 동그랗게 말아 잠든다.
  // 햇살을 끌어서 옮기면 졸린 눈으로 어슬렁어슬렁 따라온다. 톡 누르면: 자면 하품하며 깨고, 앉아 있으면 벌러덩, 배를 보일 때 누르면… 덥석 (함정)
  // 오래 자면 가끔 나비가 날아와 코끝에 앉는다 → 에취!
  const BUTTERFLY = [
    ['V...V', 'VVKVV', 'QVKVQ', '.V.V.'],
    ['..K..', '.VKV.', '.QKQ.', '..K..'],
  ];
  const SUN = (a) => `rgba(255,226,128,${a.toFixed(3)})`;
  C.sunbeam = {
    start(o, side) {
      const P = petPx();
      Object.assign(o, { bx: clamp(catX + side * P * 1.4, P, W() - P), st: 'go', at: performance.now(), motes: [], bf: null, drag: null, naps: 0 });
      for (let i = 0; i < 12; i++) o.motes.push({ u: Math.random(), v: Math.random(), ph: Math.random() * 6, sp: 0.02 + Math.random() * 0.04 });
    },
    bw: () => Math.max(petPx() * 1.5, 96),
    wantsMouse(o, e) {
      return Math.abs(e.clientX - o.bx) < this.bw() / 2 + 8 && e.clientY > floorY() - petPx() * 1.2 && e.clientY < floorY() + 6;
    },
    down(o, e) {
      o.drag = { dx: o.bx - e.clientX, x0: e.clientX, moved: false };
    },
    up(o) {
      o.dragMoved = !!(o.drag && o.drag.moved);
      o.drag = null;
    },
    go(o, st, now) {
      o.st = st;
      o.at = now;
    },
    click(o) {
      if (o.dragMoved) return;
      const now = performance.now();
      if (busy(o, now) || catLift > 0) return;
      if (o.st === 'nap' || o.st === 'watch') {
        // 깨웠다: 하품 한 번 하고 다시 햇볕 쬐기
        sprite.setToyPose(null);
        sprite.play('yawn');
        o.busyUntil = now + 2400;
        this.go(o, 'bask', now + 2400);
      } else if (o.st === 'bask') this.go(o, 'belly', now);
      else if (o.st === 'belly') {
        // 배를 보여 주는 건 함정이다. 덥석!
        sprite.setToyPose(null);
        sprite.play('toyTrap');
        sfx('bonk', 0.02);
        o.busyUntil = now + 1800;
        this.go(o, 'belly', now + 1800);
        played();
      }
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      const bw = this.bw();
      if (o.drag) {
        if (Math.abs(mouseX - o.drag.x0) > 6) o.drag.moved = true;
        if (o.drag.moved) o.bx = clamp(mouseX + o.drag.dx, bw / 2, W() - bw / 2);
      }
      for (const m of o.motes) {
        m.v += m.sp * dt;
        if (m.v > 1) {
          m.v = 0;
          m.u = Math.random();
        }
      }
      this.stepFly(o, dt, now);
      if (catLift > 0 || busy(o, now)) return sprite.setMove(0);
      const inSun = Math.abs(catX - o.bx) < bw * 0.3;
      if (!['go', 'wake'].includes(o.st) && !inSun) {
        // 햇살이 옮겨 갔다. 자고 있었으면 좀 더 뜸을 들인다
        sprite.setToyPose(null);
        pop(o, '...', catX, catTop() - 10, '#ffffff', 900);
        o.wakeMs = o.st === 'nap' ? 1600 : 700;
        this.go(o, 'wake', now);
      }
      const t = now - o.at;
      switch (o.st) {
        case 'wake':
          sprite.setMove(0);
          face(o.bx);
          if (t > o.wakeMs) this.go(o, 'go', now);
          break;
        case 'go':
          if (walkTo(o.bx, dt, 0.55, 3) <= 3) {
            sprite.setFacing(Math.random() < 0.5 ? -1 : 1);
            this.go(o, 'bask', now);
          }
          break;
        case 'bask':
          sprite.setMove(0);
          if (t < 0) break;
          sprite.setToyPose('toyBask');
          if (t > 7000) this.go(o, 'belly', now);
          break;
        case 'belly':
          sprite.setMove(0);
          if (t < 0) break;
          sprite.setToyPose('toyBelly');
          if (t > 4500) {
            this.go(o, 'nap', now);
            if (++o.naps % 2 === 1) played();
          }
          break;
        case 'nap':
          sprite.setMove(0);
          sprite.setToyPose('toySunNap');
          // 오래 자면 가끔 나비가 날아온다
          if (!o.bf && t > 5000 && Math.random() < dt / 16) this.butterfly(o, now);
          break;
        case 'watch':
          // 나비를 눈으로 쫓으며 깍깍
          sprite.setMove(0);
          if (t < 0) break;
          sprite.setToyPose('toyChatter');
          if (t > 2600) this.go(o, 'bask', now);
          break;
      }
    },
    butterfly(o, now) {
      // 고양이 옆 조금 떨어진 하늘에서 팔랑팔랑 내려온다
      const from = Math.random() < 0.5 ? -1 : 1;
      o.bf = { x: clamp(catX + from * petPx() * rand(3, 5), 10, W() - 10), y: H() - petPx() * rand(2.2, 3), st: 'in', t: now, dir: -from };
    },
    stepFly(o, dt, now) {
      const b = o.bf;
      if (!b) return;
      const head = { x: catX + sprite.facing * cellPx() * 3, y: catTop() - 2 };
      if (b.st === 'in') {
        const dx = head.x - b.x;
        const dy = head.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        b.x += (dx / d) * 80 * dt;
        b.y += (dy / d) * 80 * dt + Math.sin(now / 110) * 50 * dt;
        b.dir = Math.sign(dx) || b.dir;
        if (o.st !== 'nap') b.st = 'out'; // 앉기 전에 깼으면 그냥 지나간다
        else if (d < 5) {
          b.st = 'sit';
          b.t = now;
        }
      } else if (b.st === 'sit') {
        Object.assign(b, head);
        if (now - b.t > 1600) {
          // 에… 에취!
          sprite.setToyPose(null);
          sprite.play('toyAchoo');
          o.busyUntil = now + 1500;
          this.go(o, 'watch', now + 1500);
          b.st = 'out';
          b.t = now + 750;
        }
      } else {
        if (now < b.t) return Object.assign(b, head);
        b.y -= 70 * dt;
        b.x += b.dir * 55 * dt + Math.sin(now / 120) * 30 * dt;
        if (b.y < -20 || b.x < -30 || b.x > W() + 30) o.bf = null;
      }
    },
    draw(ctx, o, D, now) {
      const P = petPx();
      const bw = this.bw();
      const fy = floorY();
      const t = now / 1000;
      const half = Math.round(bw / 2 / D) * D;
      const x0 = Math.round(o.bx / D) * D - half;
      const pane = half - D; // 창살 사이 유리 한 칸 폭
      // 바닥에 비친 창문: 유리 두 칸 사이에 창살 그림자, 가운데 가로 창살. 고양이가 그 위에 앉으니 고양이 뒤에
      FT.underCat(ctx, (g) => {
        for (let j = 0; j < 5; j++) {
          const y = fy - (j + 1) * D;
          const sx = x0 - j * D;
          g.fillStyle = SUN(j === 2 ? 0.18 : j === 4 ? 0.7 : 0.5);
          g.fillRect(sx, y, pane, D);
          g.fillRect(sx + pane + 2 * D, y, pane, D);
        }
      }, [x0 - 6 * D, fy - 6 * D, half * 2 + 8 * D, 7 * D]);
      // 비스듬히 내려오는 빛줄기 (고양이 위로 겹쳐서 햇볕에 데워진 것처럼 보인다)
      const rows = Math.round((P * 1.7) / D);
      const breathe = 0.85 + 0.15 * Math.sin(t * 1.3);
      for (let j = 0; j < rows; j += 1) {
        const a = 0.12 * (1 - j / rows) * breathe;
        if (a < 0.008) break;
        const y = fy - (6 + j) * D;
        const sx = x0 - Math.round((5 + j) * 0.55) * D;
        ctx.fillStyle = SUN(a);
        ctx.fillRect(sx, y, pane, D);
        ctx.fillRect(sx + pane + 2 * D, y, pane, D);
      }
      // 빛 속을 떠다니는 먼지
      for (const m of o.motes) {
        const j = m.v * rows;
        const x = x0 - (5 + j) * 0.55 * D + m.u * half * 2 + Math.sin(t + m.ph) * 3;
        const y = fy - (6 + j) * D;
        const a = (0.35 + 0.45 * Math.sin(t * 2.4 + m.ph)) * (1 - m.v);
        if (a > 0.05) FT.dotAt(ctx, x, y, D, `rgba(255,250,215,${a.toFixed(2)})`);
      }
      const b = o.bf;
      if (b) stamp(ctx, BUTTERFLY[b.st === 'sit' ? Math.floor(t * 2) % 2 : Math.floor(t * 9) % 2], b.x, b.y, D, b.dir > 0);
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= N2 어항 =================
  // 금붕어 두 마리가 사는 동그란 어항. 고양이는 옆에 앉아 눈알을 굴리며 물고기를 따라 보다가 — 유리를 톡톡, 앞발을 물에 쏙 (첨벙).
  // 앞발에 걸린 물고기가 바닥으로 튀어나오면 고양이는 화들짝 놀라 킁킁… 톡 누르면 어항에 돌려보내 준다 (가만두면 고양이가 툭 쳐서 돌려보낸다).
  // 어항을 누르면 밥을 뿌린다: 물고기가 몰려들고 고양이는 깍깍깍. 아주 가끔은 머리를 통째로 넣었다가 홀딱 젖는다
  const FISH = {
    O: ['.KKKK.K', 'KOKOOKO', 'KOOOOKO', '.KKKK.K'],
    B: ['.KKKK.K', 'KBKBBKB', 'KBBBBKB', '.KKKK.K'],
  };
  C.fishbowl = {
    start(o, side) {
      const P = petPx();
      const bx = clamp(catX + side * P * 1.2, P, W() - P);
      const now = performance.now();
      Object.assign(o, { bx, side: -side, st: 'go', at: now, wait: 3000, flakes: [], bubbles: [], flop: null, shake: 0, dips: 0 });
      o.fish = ['O', 'B'].map((c, i) => ({ c, x: (i ? 1 : -1) * 6, y: 2, vx: 0, vy: 0, tx: 0, ty: 0, next: 0, scared: 0, dir: i ? 1 : -1 }));
    },
    // 어항 반지름 (도트 칸)
    R: () => Math.max(7, Math.round((petPx() * 0.22) / itemDot())),
    geo(o) {
      const D = itemDot();
      const R = this.R();
      const cx = Math.round(o.bx / D) * D;
      const cy = Math.round((floorY() - (R + 1) * D) / D) * D;
      return { D, R, cx, cy, r: R * D, wt: cy - Math.round(R * 0.3) * D, sd: cy + Math.round(R * 0.55) * D };
    },
    standX(o) {
      return o.bx + o.side * ((this.R() + 1) * itemDot() + petPx() * 0.2);
    },
    wantsMouse(o, e) {
      const g = this.geo(o);
      if (o.flop && Math.hypot(e.clientX - o.flop.x, e.clientY - o.flop.y) < 18) return true;
      return Math.abs(e.clientX - g.cx) < g.r + 6 && e.clientY > g.cy - g.r - 8 && e.clientY < floorY() + 4;
    },
    down() {},
    click(o) {
      const now = performance.now();
      const g = this.geo(o);
      // 바닥에서 파닥이는 물고기 → 어항으로 돌려보내기
      if (o.flop && o.flop.st !== 'home' && Math.hypot(mouseX - o.flop.x, mouseY - o.flop.y) < 22) {
        this.sendHome(o);
        pop(o, 'SAVED', o.flop.x, o.flop.y - 16, '#9fe3c8', 800);
        return;
      }
      // 밥 주기: 물 위에 톡톡 뿌린다
      if (o.flakes.length > 10) return;
      for (let i = 0; i < 5; i++) o.flakes.push({ x: rand(-g.r * 0.5, g.r * 0.5), y: g.wt - g.cy + rand(0, 2) });
      sfx('pop', 0.015);
      o.chatterUntil = now + 2200;
      if (o.st === 'watch' && !busy(o, now) && catLift <= 0) pop(o, '!', catX, catTop() - 10, '#ffd35c', 600);
    },
    // 물고기를 반대쪽으로 쫓는다
    scare(o, now) {
      const g = this.geo(o);
      const xr = (g.R - 3) * g.D;
      for (const f of o.fish) {
        f.scared = now + 900;
        f.tx = -o.side * xr * rand(0.5, 1);
        f.ty = rand(g.wt - g.cy + 2 * g.D, g.sd - g.cy - 2 * g.D);
      }
    },
    stepFish(o, dt, now) {
      const g = this.geo(o);
      const xr = (g.R - 3) * g.D;
      const y0 = g.wt - g.cy + 2 * g.D;
      const y1 = g.sd - g.cy - 2 * g.D;
      for (const f of o.fish) {
        if (f.out) continue;
        let food = null;
        for (const fl of o.flakes) if (!food || Math.hypot(fl.x - f.x, fl.y - f.y) < Math.hypot(food.x - f.x, food.y - f.y)) food = fl;
        if (food && now > f.scared) {
          f.tx = food.x;
          f.ty = food.y;
        } else if (now > f.next || Math.hypot(f.tx - f.x, f.ty - f.y) < 2) {
          f.tx = rand(-xr, xr);
          f.ty = rand(y0, y1);
          f.next = now + rand(1500, 4000);
        }
        const sp = now < f.scared ? 90 : food ? 38 : 16;
        const dx = f.tx - f.x;
        const dy = f.ty - f.y;
        const d = Math.hypot(dx, dy) || 1;
        f.vx += ((dx / d) * sp - f.vx) * Math.min(1, dt * 3);
        f.vy += ((dy / d) * sp * 0.6 - f.vy) * Math.min(1, dt * 3);
        f.x = clamp(f.x + f.vx * dt, -xr, xr);
        f.y = clamp(f.y + f.vy * dt, y0, y1);
        if (Math.abs(f.vx) > 4) f.dir = Math.sign(f.vx);
        for (const fl of o.flakes)
          if (Math.hypot(f.x - fl.x, f.y - fl.y) < 2.5 * g.D) {
            fl.eaten = true;
            o.bubbles.push({ x: f.x, y: f.y - g.D });
          }
      }
      for (const fl of o.flakes) fl.y = Math.min(fl.y + 5 * dt, y1);
      o.flakes = o.flakes.filter((fl) => !fl.eaten);
      if (Math.random() < dt * 0.7) o.bubbles.push({ x: rand(-xr, xr), y: y1 });
      for (const b of o.bubbles) b.y -= 14 * dt;
      o.bubbles = o.bubbles.filter((b) => b.y > g.wt - g.cy);
    },
    stepFlop(o, dt, now) {
      const fl = o.flop;
      if (!fl) return;
      const g = this.geo(o);
      fl.vy += 1300 * dt;
      fl.x += fl.vx * dt;
      fl.y += fl.vy * dt;
      if (fl.st === 'home') {
        // 포물선을 그리며 어항 속으로 퐁당
        if (fl.vy > 0 && fl.y >= g.wt) {
          Object.assign(fl.f, { out: false, x: clamp(fl.x - g.cx, -(g.R - 3) * g.D, (g.R - 3) * g.D), y: g.wt - g.cy + 2 * g.D });
          o.flop = null;
          burst(o, fl.x, g.wt, 8, ['#9fd8f5', '#cfe8f7', '#ffffff'], 140, 500);
          pop(o, 'PLOP', g.cx, g.cy - g.r - 14, '#bfe6ff', 700);
          sfx('splash', 0.02);
          this.scare(o, now);
        }
        return;
      }
      const lo = floorY() - 2 * g.D;
      fl.x = clamp(fl.x, 10, W() - 10);
      if (fl.y >= lo) {
        fl.y = lo;
        fl.vy = 0;
        fl.vx *= 0.7;
        // 파닥파닥
        if (now > fl.hop) {
          fl.vy = -rand(130, 230);
          fl.vx = rand(-40, 40);
          fl.hop = now + rand(260, 520);
          fl.flip = !fl.flip;
          sfx('tick', 0.01);
        }
      }
    },
    // 바닥의 물고기를 어항으로 던져 넣는다 (0.55초 동안 날아가 어항 입구에 떨어지게)
    sendHome(o) {
      const fl = o.flop;
      const g = this.geo(o);
      const T = 0.55;
      fl.vx = (g.cx - fl.x) / T;
      fl.vy = (g.wt - fl.y - 0.5 * 1300 * T * T) / T;
      fl.st = 'home';
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      this.stepFish(o, dt, now);
      this.stepFlop(o, dt, now);
      const g = this.geo(o);
      const P = petPx();
      // 눈알은 제일 가까운 물고기를 따라간다 (바닥에 튀어나온 물고기가 있으면 그쪽)
      let fx = null;
      let fy = null;
      if (o.flop) {
        fx = o.flop.x;
        fy = o.flop.y;
      } else {
        const f = o.fish.reduce((a, b) => (b.out ? a : !a || Math.abs(g.cx + b.x - catX) < Math.abs(g.cx + a.x - catX) ? b : a), null);
        if (f) {
          fx = g.cx + f.x;
          fy = g.cy + f.y;
        }
      }
      if (fx != null) look(((fx - catX) * sprite.facing) / 14, (fy - (catTop() + P * 0.14)) / 10);
      if (catLift > 0 || busy(o, now)) return sprite.setMove(0);
      if (o.flop) return this.stepRescue(o, dt, now);
      const sx = this.standX(o);
      if (o.st === 'go' || Math.abs(catX - sx) > 10) {
        o.st = 'go';
        if (walkTo(sx, dt, 0.8, 3) <= 3) {
          o.st = 'watch';
          o.at = now;
          o.wait = rand(2000, 4000);
        }
        return;
      }
      sprite.setMove(0);
      face(o.bx);
      sprite.setToyPose(now < (o.chatterUntil || 0) ? 'toyChatter' : 'toyStare');
      if (now - o.at > o.wait) this.act(o, now);
    },
    act(o, now) {
      const r = Math.random();
      o.at = now;
      o.wait = rand(2500, 5500);
      if (r < 0.2) {
        o.chatterUntil = now + 2000; // 그냥 더 뚫어지게 본다
        return;
      }
      sprite.setToyPose(null);
      if (o.dips >= 3 && r > 0.93) return this.headIn(o, now);
      if (r < 0.55) {
        // 유리를 톡톡
        sprite.setToyPose('toySwipe');
        o.busyUntil = now + 1300;
        K.later(o, 350, () => this.tap(o));
        K.later(o, 850, () => this.tap(o));
        K.later(o, 1300, () => toy === o && sprite.setToyPose(null));
      } else {
        // 앞발을 쏙
        sprite.play('toyPawDip');
        o.busyUntil = now + 1400;
        K.later(o, 600, () => this.splash(o));
      }
    },
    tap(o) {
      const g = this.geo(o);
      const now = performance.now();
      o.shake = now + 160;
      sfx('tick', 0.02);
      pop(o, 'TAP', g.cx + o.side * g.r, g.cy - g.r * 0.3, '#ffffff', 500);
      this.scare(o, now);
    },
    splash(o) {
      const g = this.geo(o);
      const now = performance.now();
      const x = g.cx + o.side * (g.r - 3 * g.D);
      burst(o, x, g.wt, 9, ['#9fd8f5', '#cfe8f7', '#ffffff'], 150, 600);
      sfx('splash', 0.025);
      o.dips++;
      played();
      // 가끔은 앞발에 물고기가 걸려 바닥으로 휙
      const f = o.fish.find((x) => !x.out && Math.sign(x.x) === o.side) || o.fish.find((x) => !x.out);
      if (f && !o.flop && Math.random() < 0.22) {
        f.out = true;
        o.flop = { f, x, y: g.wt, vx: o.side * rand(90, 150), vy: -rand(320, 380), hop: 0, flip: o.side > 0, st: 'air', t: now };
        pop(o, 'FLOP', x, g.wt - 18, '#ffd35c', 800);
        K.later(o, 450, () => {
          if (toy !== o || catLift > 0) return;
          sprite.play('startle');
          o.busyUntil = performance.now() + 900;
        });
      } else {
        pop(o, 'SPLISH', x, g.wt - 16, '#bfe6ff', 600);
        this.scare(o, now);
      }
    },
    // 머리를 통째로 쏙 → 홀딱 젖었다
    headIn(o, now) {
      const g = this.geo(o);
      sprite.play('toySniff');
      o.busyUntil = now + 3000;
      K.later(o, 800, () => {
        burst(o, g.cx + o.side * g.r * 0.5, g.wt, 16, ['#9fd8f5', '#cfe8f7', '#ffffff'], 220, 800);
        pop(o, 'SPLOOSH', g.cx, g.cy - g.r - 16, '#bfe6ff', 900);
        sfx('splash', 0.04);
        this.scare(o, performance.now());
        sprite.play('toyWet');
      });
      K.later(o, 2300, () => toy === o && pop(o, 'HMPH', catX, catTop() - 12, '#ffb0b0', 800));
    },
    // 바닥에 튀어나온 물고기: 다가가 킁킁… 한참 지나도 그대로면 툭 쳐서 돌려보낸다
    stepRescue(o, dt, now) {
      const fl = o.flop;
      if (fl.st === 'home') return sprite.setMove(0);
      const sx = fl.x + (Math.sign(catX - fl.x) || 1) * petPx() * 0.32;
      if (walkTo(sx, dt, 1.1, 4) > 4) return;
      face(fl.x);
      if (!fl.sniffed) {
        fl.sniffed = true;
        sprite.play('toySniff');
        o.busyUntil = now + 1200;
        return;
      }
      if (now > fl.t + 4500) {
        sprite.setToyPose(null);
        sprite.play('pounce');
        this.sendHome(o);
        pop(o, 'HUP', fl.x, fl.y - 18, '#ffffff', 700);
        o.busyUntil = now + 900;
        o.st = 'go';
      } else sprite.setToyPose('toyStare');
    },
    draw(ctx, o, D, now) {
      const g = this.geo(o);
      const t = now / 1000;
      const shake = now < o.shake ? (Math.floor(now / 40) % 2 ? D : -D) : 0;
      const cx = g.cx + shake;
      const { cy, r } = g;
      // 유리 (속이 살짝 비친다)
      disc(ctx, cx, cy, r, D, 'rgba(207,232,247,0.22)');
      // 물 (수면 아래만)
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - r - D, g.wt, 2 * r + 2 * D, 2 * r);
      ctx.clip();
      disc(ctx, cx, cy, r - D, D, 'rgba(96,166,232,0.5)');
      ctx.restore();
      // 수면: 반짝이는 밝은 줄이 살랑
      const hw = Math.floor(Math.sqrt(Math.max(0, (r - D) ** 2 - (g.wt - cy) ** 2)) / D);
      for (let i = -hw; i <= hw; i++) if ((i + Math.floor(t * 4)) % 3) FT.dotAt(ctx, cx + i * D, g.wt, D, 'rgba(214,240,255,0.95)');
      // 모래와 조약돌
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - r - D, g.sd, 2 * r + 2 * D, 2 * r);
      ctx.clip();
      disc(ctx, cx, cy, r - D, D, '#f6d7a2');
      ctx.restore();
      for (const [i, c] of [[-3, '#c48b56'], [-2, '#e3b877'], [2, '#e3b877'], [4, '#8a5a32']]) FT.dotAt(ctx, cx + i * D, g.sd + D, D, c);
      // 수초 두 가닥 (살랑살랑)
      for (const [bx, n] of [[-Math.round(g.R * 0.45), 5], [Math.round(g.R * 0.35), 4]])
        for (let j = 0; j < n; j++) FT.dotAt(ctx, cx + (bx + Math.round(Math.sin(t * 2 + j * 0.9 + bx) * (j / n) * 1.4)) * D, g.sd - j * D, D, j % 2 ? '#4a8c42' : '#79c46b');
      // 물방울
      for (const b of o.bubbles) FT.dotAt(ctx, cx + b.x, cy + b.y, D, 'rgba(255,255,255,0.85)');
      // 밥알
      for (const fl of o.flakes) FT.dotAt(ctx, cx + fl.x, cy + fl.y, D, '#e0a764');
      // 물고기
      for (const f of o.fish) if (!f.out) stamp(ctx, FISH[f.c], cx + f.x, cy + f.y, D, f.dir > 0);
      // 유리 테두리와 반짝이 · 입구 테
      FT.ring(ctx, cx, cy, r, D, '#2b1a10');
      for (const [a, b] of [[-0.62, -0.5], [-0.72, -0.3], [-0.76, -0.1]]) FT.dotAt(ctx, cx + a * r, cy + b * r, D, '#ffffff');
      const lw = Math.max(3, Math.round(g.R * 0.55));
      for (let i = -lw - 1; i <= lw + 1; i++) {
        FT.dotAt(ctx, cx + i * D, cy - r - D, D, '#2b1a10');
        FT.dotAt(ctx, cx + i * D, cy - r, D, Math.abs(i) === lw + 1 ? '#2b1a10' : '#cfe8f7');
      }
      // 바닥에서 파닥이는 물고기
      if (o.flop) stamp(ctx, FISH[o.flop.f.c], o.flop.x, o.flop.y, D, o.flop.flip);
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= N3 이불 속 손 =================
  // 바닥에 이불을 깐다. 이불 위로 마우스를 가져가면 이불 속에서 손이 꼼지락 (볼록). 고양이가 살금살금 다가와 엉덩이를 씰룩씰룩하다가 덮친다.
  // 덮치는 순간 손을 옆으로 빼면 피한다. 얼마나 오래 버티나가 기록. 오래 버틸수록 빨라지고, 딴청 피우다 기습하는 속임수도 섞는다.
  // 이불 밖으로 손을 빼면 시간이 멈추고 고양이는 두리번. 잡히면 손을 끌어안고 뒷발 팡팡
  const QUILT = ['#f4a6b8', '#fcd6de', '#d0577f']; // 분홍 체크 이불 (밝은 칸 · 어두운 칸 · 옆면)
  C.quilt = {
    overCat: true,
    start(o, side) {
      const P = petPx();
      const bw = Math.round(Math.max(P * 4.2, 300));
      const bx = clamp(catX + side * (bw / 2 + P * 0.15), bw / 2 + 10, W() - bw / 2 - 10);
      Object.assign(o, { bx, bw, side });
      this.reset(o);
    },
    reset(o) {
      Object.assign(o, { phase: 'ready', t: 0, hand: null, st: 'stalk', at: performance.now(), dodges: 0, feints: 0, caughtAt: 0 });
    },
    over(o, x, y) {
      return x != null && Math.abs(x - o.bx) < o.bw / 2 - 4 && y > floorY() - petPx() * 1.1 && y < floorY() + 6;
    },
    wantsMouse(o, e) {
      return this.over(o, e.clientX, e.clientY);
    },
    down(o) {
      const now = performance.now();
      if (o.phase === 'over' && now - o.overAt > 1200) this.reset(o);
    },
    click() {},
    pounce(o, now, sneaky) {
      const P = petPx();
      const k = this.k(o);
      const h = o.hand;
      const lead = 0.12 + 0.25 * k;
      const tx = h ? h.x + clamp(h.vx, -600, 600) * lead : catX + sprite.facing * P;
      const vy = 400 + 120 * k;
      const T = (2 * vy) / 1500;
      sprite.setToyPose(null);
      sprite.play('pounce');
      catVy = -vy;
      catVx = clamp((tx - catX) / T, -720, 720);
      catLift = 1;
      o.st = 'air';
      o.at = now;
      if (sneaky) pop(o, '!!', catX, catTop() - 14, '#ff9a9a', 500);
      sfx('pop', 0.015);
    },
    k: (o) => Math.min(1, o.t / 45), // 어려움 (45초면 끝까지)
    step(o, dt, now) {
      commonStep(o, dt, now);
      const P = petPx();
      // 손: 이불 위에 마우스가 있으면 이불 속에 손이 있다
      if (o.phase === 'over') {
        if (o.hand) o.hand.vx = 0;
      } else if (this.over(o, mouseX, mouseY)) {
        if (!o.hand) o.hand = { x: mouseX, vx: 0, moveAt: now };
        const vx = (mouseX - o.hand.x) / Math.max(dt, 0.001);
        o.hand.vx += (vx - o.hand.vx) * Math.min(1, dt * 8);
        if (Math.abs(mouseX - o.hand.x) > 0.5) o.hand.moveAt = now;
        o.hand.x = mouseX;
      } else o.hand = null;
      document.body.classList.toggle('no-cursor', !!o.hand && o.phase !== 'over');
      if (o.phase === 'ready' && o.hand) {
        o.phase = 'play';
        o.st = 'stalk';
        sfx('quest', 0.02);
      }
      if (o.phase === 'play' && o.hand) o.t += dt;
      const k = this.k(o);
      // 잡혔다: 손을 끌어안고 팡팡
      if (o.phase === 'over') {
        if (catLift <= 0 && now - o.overAt > 1900 && !sprite.action) {
          sprite.setToyPose('toyWatch');
          face(mouseX != null ? mouseX : o.bx);
        }
        return;
      }
      if (o.st === 'air') {
        if (catLift > 0) return;
        // 착지: 손 위에 떨어졌나
        const h = o.hand;
        if (h && Math.abs(h.x - catX) < P * 0.3 && o.phase === 'play') return this.caught(o, now);
        if (o.phase === 'play') {
          o.dodges++;
          pop(o, o.dodges % 5 === 0 ? `DODGE ${o.dodges}` : 'MISS', catX, catTop() - 12, o.dodges % 5 === 0 ? '#9fe3c8' : '#ffffff', 700);
          if (o.dodges % 5 === 0) sfx('quest', 0.02);
        }
        // 오래 버틸수록 가끔 바로 한 번 더 덮친다
        if (h && k > 0.3 && Math.random() < 0.18 + 0.2 * k) {
          sprite.setToyPose(null);
          face(h.x);
          o.st = 'again';
          o.at = now;
          return;
        }
        sprite.play('toyPeek');
        o.busyUntil = now + 900 - 400 * k;
        o.st = 'stalk';
        return;
      }
      if (busy(o, now) || catLift > 0) return sprite.setMove(0);
      const h = o.hand;
      if (o.st === 'again') {
        if (now - o.at > 160) this.pounce(o, now, true);
        return;
      }
      if (!h) {
        // 손이 사라졌다: 멈춰서 두리번
        sprite.setMove(0);
        sprite.setToyPose('toyChatter');
        if (o.st !== 'stalk') o.st = 'stalk';
        return;
      }
      const dir = Math.sign(h.x - catX) || 1;
      const reach = P * (0.75 - 0.15 * k);
      if (o.st === 'stalk') {
        // 살금살금 (가까워질수록 느리게)
        const goal = h.x - dir * reach;
        // 손 앞까지 오면 걸음을 멈추고 납작 엎드린다 (walkTo 는 걸을 때마다 놀이 자세를 지우니 멈춘 뒤에는 부르지 않는다)
        const near = Math.abs(goal - catX) <= P * 0.22;
        if (!near) walkTo(goal, dt, Math.abs(goal - catX) > P ? 1.2 + 0.4 * k : 0.7 + 0.5 * k, 4);
        if (near) {
          sprite.setMove(0);
          face(h.x);
          sprite.setToyPose(k > 0.5 ? 'toyHunt' : 'toyCrouch');
          if (!o.crouchAt) o.crouchAt = now;
          if (now - o.crouchAt > 500 - 250 * k) {
            o.crouchAt = 0;
            o.st = 'wiggle';
            o.at = now;
            sprite.setToyPose(null);
            sprite.play('toyWiggle');
          }
        } else o.crouchAt = 0;
        return;
      }
      sprite.setMove(0);
      face(h.x);
      const t = now - o.at;
      if (o.st === 'wiggle') {
        // 손이 멀리 달아나면 다시 살금살금
        if (Math.abs(h.x - catX) > reach * 1.9) {
          o.st = 'stalk';
          return;
        }
        if (t > 900 - 380 * k) {
          // 가끔 딴청 피우다 기습
          if (o.feints < 3 && Math.random() < 0.1 + 0.25 * k) {
            o.feints++;
            o.st = 'feint';
            o.at = now;
            o.feintMs = rand(500, 1100);
            sprite.setToyPose('toyDeadpan');
            sprite.setFacing(-dir);
            return;
          }
          this.pounce(o, now, false);
        }
        return;
      }
      if (o.st === 'feint') {
        if (t > o.feintMs) {
          face(h.x);
          this.pounce(o, now, true);
        }
      }
    },
    caught(o, now) {
      o.phase = 'over';
      o.hand = o.hand || { x: catX, vx: 0 };
      o.hand.x = catX;
      document.body.classList.remove('no-cursor');
      sprite.setToyPose(null);
      sprite.play('toyTrap');
      sfx('bonk', 0.03);
      burst(o, catX, floorY() - 6, 10, QUILT.concat(['#ffffff']), 160, 600);
      o.final = Math.floor(o.t * 10) / 10;
      finish(o, 'quilt', Math.floor(o.t), now);
      played();
    },
    end() {
      document.body.classList.remove('no-cursor');
    },
    draw(ctx, o, D, now) {
      const t = now / 1000;
      const fy = floorY();
      const n = Math.round(o.bw / D);
      const x0 = Math.round((o.bx - o.bw / 2) / D) * D;
      const h = o.hand;
      // 손이 꼼지락거리면 볼록한 데가 들썩인다
      const wig = h && now - (h.moveAt || 0) < 200 ? Math.round(Math.sin(t * 24)) : 0;
      const amp = h ? (o.phase === 'over' ? 3 : 7 + wig) : 0;
      const hs = [];
      for (let i = 0; i < n; i++) {
        let v = i < 2 || i >= n - 2 ? 2 : 3 + (Math.sin(i * 0.13 + 1) > 0.88 ? 1 : 0);
        if (h) {
          const u = (x0 + i * D - h.x) / (6 * D);
          v += Math.round(amp * Math.exp(-u * u));
        }
        hs.push(v);
      }
      FT.underCat(ctx, (g) => {
        for (let i = 0; i < n; i++) {
          const x = x0 + i * D;
          const v = hs[i];
          const lo = Math.min(i ? hs[i - 1] : 0, i < n - 1 ? hs[i + 1] : 0); // 옆 칸이 낮으면 그만큼 옆면 테두리
          for (let j = 1; j <= v; j++) {
            const edge = i === 0 || i === n - 1 || j > lo;
            g.fillStyle = edge && (i === 0 || i === n - 1) ? '#2b1a10' : edge ? QUILT[2] : (Math.floor(i / 4) + Math.floor(j / 2)) % 2 ? QUILT[0] : QUILT[1];
            if (!edge && i % 4 === 2 && j === 1) g.fillStyle = '#fffaf3'; // 누빈 바늘땀
            g.fillRect(x, fy - j * D, D, D);
          }
          g.fillStyle = '#2b1a10';
          g.fillRect(x, fy - (v + 1) * D, D, D);
        }
      }, [x0 - D, fy - 16 * D, n * D + 2 * D, 17 * D]);
      // 머리 위 점수판
      const hx = o.bx;
      const hy = fy - petPx() * 1.55;
      if (o.phase === 'ready') {
        big(ctx, 'READY?', hx, hy, D, '#ffd35c');
        ftext(ctx, 'HAND UNDER BLANKET', hx, hy + 9 * D, D, '#ffffff');
      } else if (o.phase === 'play') {
        ftext(ctx, `TIME ${o.t.toFixed(1)}`, hx - 22 * D, hy, D, o.hand ? '#ffffff' : '#9aa6ff');
        ftext(ctx, `DODGE ${o.dodges}`, hx + 22 * D, hy, D, '#ffd35c');
        if (this.k(o) > 0.5 && Math.floor(t * 2) % 2) ftext(ctx, 'SERIOUS MODE', hx, hy - 8 * D, D, '#ff9a9a');
      } else results(ctx, o, hx, hy, D, now, 'GOTCHA!', `TIME ${o.final.toFixed(1)}S`);
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= N4 고양이 찾기 (야바위) =================
  // 엎어 둔 상자 셋. 고양이가 한 상자 밑으로 쏙 들어가면 상자가 이리저리 섞인다. 고양이가 든 상자를 누르면 성공 (연속 성공 기록).
  // 맞힐수록 더 많이 · 더 빨리 섞는다. 틀리면 엉뚱한 게 나오고 고양이는 다른 상자에서 메롱.
  // 아주 가끔(연속 3번 넘게 맞히면) 고양이가 반칙을 한다: 상자 셋이 다 비었고, 고양이는 저만치에서 시치미 뚝 떼고 걸어온다 (연속 기록은 그대로)
  const CRATE = [
    '.KKKKKKKKKKKKKK.',
    'KSSSSSSSSSSSSSSK',
    'KTTTTTTwwTTTTTtK',
    'KTTTTTTwwTTTTTtK',
    'KTTTTTTwwTTTTTtK',
    'KTTTTTTTTTTTTTtK',
    'KTTCTTTTTTTTTTtK',
    'KTCCCTTTTTTTTTtK',
    'KTTCTTTTTTTTTTtK',
    'KTTTTTTTTTTTTTtK',
    'KttttttttttttttK',
    'KKKKKKKKKKKKKKKK',
  ];
  const JUNK = [
    { s: 'SOCK?', rows: ['.KKK..', '.KRK..', '.KWK..', '.KRK..', '.KWKK.', '.KWWWK', '..KKKK'] },
    { s: 'BONES', rows: ['..K.K.K...', '.KWKWKWK.K', 'KWWWWWWWKW', '.KWKWKWK.K', '..K.K.K...'] },
    { s: 'YARN', rows: ['.KKKK.', 'KPPpPK', 'KPpPPK', 'KpPPpK', 'KPPpPK', '.KKKK.'] },
    { s: 'EMPTY', rows: null },
  ];
  C.shellgame = {
    overCat: true,
    start(o, side) {
      const P = petPx();
      const d = this.d();
      const gap = Math.max(CRATE[0].length * d * 1.6, P * 0.9);
      const cx = clamp(catX + side * gap * 1.4, gap * 1.6, W() - gap * 1.6);
      const now = performance.now();
      o.cx = cx;
      o.gap = gap;
      o.boxes = [0, 1, 2].map((i) => ({ slot: i, x: cx + (i - 1) * gap, lift: 0, drop: now + i * 140, cat: false, junk: null }));
      Object.assign(o, { phase: 'enter', at: now, streak: 0, swaps: [], cheat: false });
    },
    d: () => Math.max(2, Math.round(cellPx() * 1.9)),
    boxH() {
      return CRATE.length * this.d();
    },
    slotX(o, i) {
      return o.cx + (i - 1) * o.gap;
    },
    boxAt(o, x, y) {
      const w = (CRATE[0].length * this.d()) / 2 + 6;
      return o.boxes.find((b) => Math.abs(x - b.x) < w && y > floorY() - this.boxH() - 8 + b.lift && y < floorY() + 4) || null;
    },
    wantsMouse(o, e) {
      return !!this.boxAt(o, e.clientX, e.clientY);
    },
    down(o, e) {
      const now = performance.now();
      const b = this.boxAt(o, e.clientX, e.clientY);
      if (!b) return;
      if (o.phase === 'pick') return this.reveal(o, b, now);
      if (o.phase === 'over' && now - o.overAt > 1200) {
        // 한 판 더: 고양이는 가운데 상자로
        o.streak = 0;
        for (const x of o.boxes) Object.assign(x, { lift: 0, junk: null, cat: false });
        this.go(o, 'walk', now);
      }
    },
    click() {},
    go(o, phase, now) {
      o.phase = phase;
      o.at = now;
    },
    catBox: (o) => o.boxes.find((b) => b.cat),
    step(o, dt, now) {
      commonStep(o, dt, now);
      const t = now - o.at;
      const lift = this.boxH() * 1.3;
      const liftTo = (b, v, sp = 9) => (b.lift += (v - b.lift) * Math.min(1, dt * sp));
      switch (o.phase) {
        case 'enter':
          // 상자 셋이 하늘에서 툭툭 떨어진다
          if (t > 900) this.go(o, 'walk', now);
          break;
        case 'walk': {
          // 가운데 상자 앞으로 가서 → 상자가 들리면 쏙
          for (const b of o.boxes) liftTo(b, 0);
          const mid = o.boxes.reduce((a, b) => (Math.abs(b.x - o.cx) < Math.abs(a.x - o.cx) ? b : a));
          if (catLift > 0 || busy(o, now)) return sprite.setMove(0);
          if (walkTo(mid.x, dt, 1, 3) <= 3) {
            for (const b of o.boxes) b.cat = b === mid;
            this.go(o, 'hide', now);
            pop(o, `ROUND ${o.streak + 1}`, o.cx, floorY() - this.boxH() * 2.4, '#ffffff', 900);
          }
          break;
        }
        case 'hide': {
          const b = this.catBox(o);
          sprite.setMove(0);
          if (t < 380) liftTo(b, -lift, 14);
          else {
            liftTo(b, 0, 18);
            if (!o.hidden) {
              o.hidden = true;
              sprite.setToyPose('toyHidden');
              sfx('pop', 0.02);
              burst(o, b.x, floorY() - 2, 6, ['#d6cfc4', '#ffffff'], 90, 400);
            }
          }
          if (t > 900) this.shuffle(o, now);
          break;
        }
        case 'shuffle': {
          const s = o.swaps[0];
          if (!s) {
            this.go(o, 'pick', now);
            break;
          }
          if (now < s.t0) break;
          // 바꾸기를 시작할 때 그 두 자리에 있는 상자를 잡는다
          if (!s.boxes) Object.assign(s, { boxes: s.pair.map((sl) => o.boxes.find((x) => x.slot === sl)), ax: this.slotX(o, s.pair[0]), bx: this.slotX(o, s.pair[1]) });
          const k = Math.min(1, (now - s.t0) / s.ms);
          const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
          const [a, b] = s.boxes;
          a.x = s.ax + (s.bx - s.ax) * e;
          b.x = s.bx + (s.ax - s.bx) * e;
          a.lift = -Math.sin(Math.PI * k) * this.boxH() * 0.45; // 하나는 위로 넘고 하나는 바닥으로 미끄러진다
          b.lift = 0;
          if (k >= 1) {
            [a.slot, b.slot] = [b.slot, a.slot];
            a.lift = 0;
            o.swaps.shift();
            if (o.swaps[0]) o.swaps[0].t0 = now;
            sfx('tick', 0.015);
          }
          const cb = this.catBox(o);
          if (cb) {
            catX = cb.x;
            placeCat();
          }
          break;
        }
        case 'pick':
          sprite.setMove(0);
          break;
        case 'reveal':
          for (const b of o.boxes) liftTo(b, b.open ? -lift : 0, 12);
          break;
        case 'cheat': {
          // 반칙! 화면 끝에서 휘파람 불며 걸어온다
          for (const b of o.boxes) liftTo(b, -lift, 10);
          if (t < 900) break;
          if (!o.cheatShown) {
            o.cheatShown = true;
            sprite.setToyPose(null);
            const [min, max] = lane();
            catX = clamp(o.cx + (o.cx < W() / 2 ? 1 : -1) * petPx() * 5, min, max);
            placeCat();
            pop(o, 'CHEATER!', o.cx, floorY() - this.boxH() * 2.6, '#ff9a9a', 1400);
          }
          if (walkTo(o.cx, dt, 0.7, 3) <= 3) {
            sprite.play('toyPretend');
            o.busyUntil = now + 2400;
            for (const b of o.boxes) b.open = false;
            this.go(o, 'walk', now);
          }
          break;
        }
        case 'over':
          for (const b of o.boxes) liftTo(b, b.open ? -lift : 0, 12);
          if (catLift <= 0 && !sprite.action) {
            sprite.setToyPose(null);
            sprite.setMove(0);
          }
          break;
      }
    },
    shuffle(o, now) {
      o.hidden = false;
      const n = Math.min(4 + o.streak, 14);
      const ms = Math.max(170, 480 - o.streak * 32);
      o.swaps = [];
      let last = -1;
      for (let i = 0; i < n; i++) {
        let pair;
        do pair = [[0, 1], [1, 2], [0, 2]][Math.floor(Math.random() * 3)];
        while (pair.join() === last);
        last = pair.join();
        o.swaps.push({ pair, ms: pair[0] === 0 && pair[1] === 2 ? ms * 1.25 : ms });
      }
      o.swaps[0].t0 = now + 250;
      // 반칙은 연속 3번 넘게 맞혔을 때 가끔
      o.cheat = o.streak >= 3 && Math.random() < 0.12;
      this.go(o, 'shuffle', now);
    },
    reveal(o, b, now) {
      for (const x of o.boxes) x.x = this.slotX(o, x.slot);
      if (o.cheat) {
        // 고른 상자도, 나머지도 텅. 고양이는 어디로?
        o.cheat = false;
        o.cheatShown = false;
        for (const x of o.boxes) Object.assign(x, { open: true, cat: false, junk: null });
        pop(o, '?!', o.cx, floorY() - this.boxH() * 2, '#ffd35c', 900);
        sfx('lose', 0.02);
        this.go(o, 'cheat', now);
        return;
      }
      b.open = true;
      this.go(o, 'reveal', now);
      if (b.cat) {
        // 찾았다!
        o.streak++;
        sprite.setToyPose(null);
        sprite.play('toyYay');
        sfx(o.streak % 5 === 0 ? 'win' : 'quest', 0.03);
        pop(o, o.streak > 1 ? `FOUND! X${o.streak}` : 'FOUND!', b.x, floorY() - this.boxH() * 2.2, '#9fe3c8', 1000);
        burst(o, b.x, floorY() - this.boxH(), 12, ['#ffd35c', '#9fe3c8', '#ffffff'], 180, 700);
        if (best('shellgame', o.streak)) pop(o, 'NEW BEST', b.x, floorY() - this.boxH() * 2.9, '#ffd35c', 1200);
        if (o.streak % 2 === 1) played();
        K.later(o, 1800, () => {
          if (toy !== o) return;
          b.open = false;
          this.go(o, 'walk', performance.now());
        });
        return;
      }
      // 꽝: 엉뚱한 게 나오고, 진짜 상자에서 고양이가 메롱
      b.junk = JUNK[Math.floor(Math.random() * JUNK.length)];
      pop(o, b.junk.s, b.x, floorY() - this.boxH() * 2.2, '#cccccc', 900);
      sfx('lose', 0.025);
      K.later(o, 650, () => {
        if (toy !== o) return;
        const cb = this.catBox(o);
        cb.open = true;
        sprite.setToyPose(null);
        face(b.x);
        sprite.play('toyBlep');
        o.final = o.streak;
        this.go(o, 'over', performance.now());
        finish(o, 'shellgame', o.streak, performance.now());
        o.isBest = false; // 기록은 맞힐 때마다 이미 남겼다
        played();
      });
    },
    draw(ctx, o, D, now) {
      const d = this.d();
      const bh = this.boxH();
      const fy = floorY();
      for (const b of o.boxes) {
        // 하늘에서 툭: 떨어지는 동안 위에서
        let y = fy - bh / 2 + b.lift;
        if (o.phase === 'enter') {
          const k = clamp((now - b.drop) / 420, 0, 1);
          y -= (1 - k * k) * fy * 0.5;
          if (k >= 1 && !b.landed) {
            b.landed = true;
            sfx('tick', 0.02);
          }
        }
        if (b.junk && b.junk.rows && b.lift < -2) stamp(ctx, b.junk.rows, b.x, fy - b.junk.rows.length * D * 0.5 - D, D);
        // 들린 상자 밑 그림자
        if (b.lift < -2) for (let i = -5; i <= 5; i++) FT.dotAt(ctx, b.x + i * d, fy - d, d, 'rgba(30,15,8,0.18)');
        stamp(ctx, CRATE, b.x, y, d);
      }
      const hy = fy - bh * 3.2;
      if (o.phase === 'pick') big(ctx, 'WHERE?', o.cx, hy, D, Math.floor(now / 400) % 2 ? '#ffd35c' : '#ffffff');
      else if (o.phase === 'shuffle') ftext(ctx, 'WATCH CLOSELY', o.cx, hy, D, '#ffffff');
      if (o.phase !== 'over' && o.streak) ftext(ctx, `STREAK ${o.streak}`, o.cx, hy + 9 * D, D, '#9fe3c8');
      if (o.phase === 'over') results(ctx, o, o.cx, hy, D, now, `STREAK ${o.final}`, 'NOT THERE!');
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= N5 비치볼 배구 =================
  // 고양이 앞에 작은 네트. 공이 내 쪽으로 넘어오면 공을 눌러서 넘긴다. 고양이는 공 밑으로 달려가 뛰어올라 앞발로 받아넘긴다.
  // 랠리가 길어질수록 공이 빨라지고(10번부터 금빛, 20번부터 불꽃), 고양이도 가끔 헛손질한다. 바닥에 떨어진 쪽이 진다. 기록은 가장 긴 랠리
  const BALL_COL = ['#e8534a', '#ffffff', '#6fb0ea', '#ffffff', '#ffd65a', '#ffffff'];
  C.volley = {
    cursor: true,
    overCat: true,
    start(o, side) {
      const P = petPx();
      const netX = clamp(catX + side * P * 1.5, P * 2.5, W() - P * 2.5);
      Object.assign(o, { dir: side, netX, trail: [] });
      this.serve(o);
    },
    r: () => Math.max(8, Math.round(petPx() * 0.16)),
    netH: () => petPx() * 0.9,
    serve(o) {
      const P = petPx();
      o.ball = { x: o.netX + o.dir * P * 1.4, y: floorY() - P * 2.4, vx: 0, vy: 0, spin: 0 };
      Object.assign(o, { phase: 'serve', rally: 0, at: performance.now(), willMiss: false, jumped: false, catSide: false });
    },
    speed: (o) => Math.min(1.9, 1 + o.rally * 0.045),
    // 사람이 공을 친다 (공 근처를 누르면)
    down(o, e) {
      const now = performance.now();
      if (o.phase === 'over') {
        if (now - o.overAt > 1000) this.serve(o);
        return;
      }
      const b = o.ball;
      const mine = Math.sign(b.x - o.netX) === o.dir;
      if (!mine || Math.hypot(e.clientX - b.x, e.clientY - b.y) > this.r() * 1.6 + 16) {
        sfx('tick', 0.01);
        return;
      }
      const s = this.speed(o);
      // 누른 자리가 공 아래쪽일수록 높이 뜬다
      const under = clamp((e.clientY - b.y) / (this.r() * 2), -0.5, 1);
      b.vx = -o.dir * rand(170, 230) * s;
      b.vy = -(340 + under * 90) * Math.sqrt(s);
      b.spin = -o.dir * 8;
      o.phase = 'play';
      o.rally++;
      o.willMiss = Math.random() < (o.rally < 6 ? 0.02 : Math.min(0.45, 0.03 + (o.rally - 6) * 0.035));
      o.jumped = false;
      tone(330 + Math.min(o.rally, 20) * 18, 0.08, 0.03);
      burst(o, b.x, b.y, 6, ['#ffffff', '#ffd35c'], 140, 400);
      this.cheer(o, b);
    },
    // 랠리 몇 번째마다 한마디
    cheer(o, b) {
      if (o.rally === 10) pop(o, 'GOLDEN!', b.x, b.y - 24, '#ffd35c', 900);
      else if (o.rally === 20) pop(o, 'ON FIRE!', b.x, b.y - 24, '#ff9a3c', 900);
      else if (o.rally % 5 === 0) pop(o, `RALLY ${o.rally}`, b.x, b.y - 24, '#9fe3c8', 800);
    },
    click() {},
    // 공이 고양이 키 높이까지 떨어질 자리
    landing(o) {
      const b = o.ball;
      const g = 520;
      const hitY = floorY() - petPx() * 0.6;
      let { x, y, vx, vy } = b;
      for (let i = 0; i < 240 && !(vy > 0 && y >= hitY); i++) {
        vy += g / 60;
        x += vx / 60;
        y += vy / 60;
        if (x < 20 || x > W() - 20) vx = -vx * 0.7;
      }
      return x;
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      const P = petPx();
      const b = o.ball;
      const r = this.r();
      const fy = floorY();
      const netTop = fy - this.netH();
      // 공: 가볍게 둥실 (서브 전에는 천천히 내려온다)
      const g = o.phase === 'serve' ? 140 : 520;
      const px = b.x;
      b.vy += g * dt;
      b.vx *= Math.pow(0.995, dt * 60);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.spin *= Math.pow(0.6, dt);
      if (b.x < r || b.x > W() - r) {
        b.x = clamp(b.x, r, W() - r);
        b.vx = -b.vx * 0.7;
      }
      // 네트에 걸리면 튕겨 나온다
      if (Math.sign(px - o.netX) !== Math.sign(b.x - o.netX) && b.y + r > netTop) {
        b.x = o.netX + Math.sign(px - o.netX) * (r + 2);
        b.vx = -b.vx * 0.4;
        sfx('tick', 0.02);
      }
      if (o.phase === 'serve') {
        // 서브 공은 손 닿는 높이에 둥실둥실
        b.vy = (fy - P * 1.1 + Math.sin(now / 300) * 6 - b.y) * 3;
        b.vx = 0;
      }
      if (o.rally >= 10 && o.phase === 'play') {
        o.trail.push({ x: b.x, y: b.y, t: now });
        if (o.trail.length > 10) o.trail.shift();
      } else o.trail = [];
      // 바닥에 닿았다 → 한 판 끝
      if (b.y + r >= fy) {
        b.y = fy - r;
        if (o.phase === 'play') this.point(o, now);
        b.vy = -Math.abs(b.vy) * 0.35;
        b.vx *= 0.6;
      }
      if (o.phase === 'over') {
        if (catLift <= 0 && now - o.overAt > 1800 && !sprite.action) {
          sprite.setToyPose('toyWatch');
          face(b.x);
        }
        return;
      }
      // 고양이: 제 쪽 코트에서만 움직인다
      if (catLift > 0) {
        if (o.phase === 'play' && !o.willMiss && Math.sign(b.x - o.netX) === -o.dir && canReach(b)) this.bop(o, now);
        return;
      }
      if (busy(o, now)) return sprite.setMove(0);
      const [min, max] = lane();
      const lo = o.dir > 0 ? min : o.netX + P * 0.35;
      const hi = o.dir > 0 ? o.netX - P * 0.35 : max;
      const coming = o.phase === 'play' && (Math.sign(b.x - o.netX) === -o.dir || Math.sign(b.vx) === -o.dir);
      if (!coming) {
        // 기다리는 자리: 네트에서 조금 떨어져 공을 본다
        const home = o.netX - o.dir * P * 1.1;
        if (walkTo(clamp(home, lo, hi), dt, 0.8, 4) <= 4) {
          face(b.x);
          sprite.setToyPose('toyWatch');
        }
        return;
      }
      let tx = clamp(this.landing(o), lo, hi);
      if (o.willMiss) tx = clamp(tx + o.dir * P * 0.7, lo, hi); // 헛다리
      const d = walkTo(tx, dt, 1.8, 3);
      if (d <= 3) face(b.x);
      // 공이 내려오면 폴짝
      const h = fy - b.y;
      if (!o.jumped && b.vy > 0 && Math.sign(b.x - o.netX) === -o.dir && h < P * 1.7 && Math.abs(b.x - catX) < P * 0.5) {
        o.jumped = true;
        leap(h - P * 0.45);
      }
      // 낮게 떨어지면 서서 톡
      if (!o.willMiss && Math.sign(b.x - o.netX) === -o.dir && canReach(b)) this.bop(o, now);
    },
    bop(o, now) {
      const b = o.ball;
      const s = this.speed(o);
      b.vx = o.dir * rand(150, 220) * s;
      b.vy = -rand(350, 410) * Math.sqrt(s);
      b.spin = o.dir * 8;
      o.rally++;
      o.jumped = false;
      o.willMiss = false;
      sfx('bonk', 0.02);
      tone(392 + Math.min(o.rally, 20) * 18, 0.07, 0.025);
      pop(o, Math.random() < 0.5 ? 'BOP' : 'PAT', b.x, b.y - 18, '#ffffff', 500);
      this.cheer(o, b);
    },
    point(o, now) {
      const b = o.ball;
      const catLost = Math.sign(b.x - o.netX) === -o.dir;
      o.phase = 'over';
      o.final = o.rally;
      o.catLost = catLost;
      burst(o, b.x, floorY() - 3, 8, ['#d6cfc4', '#ffffff'], 120, 500);
      finish(o, 'volley', o.rally, now);
      sprite.setToyPose(null);
      if (catLift <= 0) {
        if (catLost) sprite.play(Math.random() < 0.5 ? 'toyTrip' : 'toySulk');
        else sprite.play('toyYay');
      }
      o.busyUntil = now + 1600;
      if (o.rally >= 3) played();
    },
    draw(ctx, o, D, now) {
      const P = petPx();
      const fy = floorY();
      const t = now / 1000;
      const b = o.ball;
      const r = this.r();
      const R = Math.max(3, Math.round(r / D));
      // 네트: 기둥 + 그물 + 흰 띠 (고양이가 네트 뒤로 지나가지는 않는다)
      const nh = Math.round(this.netH() / D);
      const nx = Math.round(o.netX / D) * D;
      for (let j = 0; j <= nh; j++) {
        const y = fy - j * D;
        FT.dotAt(ctx, nx - 2 * D, y, D, '#2b1a10');
        FT.dotAt(ctx, nx - D, y, D, '#8f95a0');
        if (j > nh * 0.4) {
          const tape = j >= nh - 1;
          const mesh = (i) => (tape ? '#ffffff' : (i + j) % 2 ? '#2b1a10' : 'rgba(255,255,255,0.35)');
          for (let i = 0; i < 3; i++) FT.dotAt(ctx, nx + i * D, y, D, mesh(i));
        }
      }
      for (let i = -2; i < 3; i++) FT.dotAt(ctx, nx + i * D, fy - (nh + 1) * D, D, '#2b1a10');
      for (let i = -3; i <= 0; i++) FT.dotAt(ctx, nx + i * D, fy, D, '#2b1a10'); // 받침
      // 공 그림자 (높이 뜰수록 작다)
      const sh = Math.max(1, Math.round(R * (1 - Math.min(0.8, (fy - b.y) / (P * 3)))));
      for (let i = -sh; i <= sh; i++) FT.dotAt(ctx, b.x + i * D, fy - D, D, 'rgba(30,15,8,0.2)');
      // 금빛 · 불꽃 꼬리
      for (const [i, p] of o.trail.entries()) {
        const a = (i + 1) / o.trail.length;
        FT.dotAt(ctx, p.x + rand(-2, 2), p.y + rand(-2, 2), D, o.rally >= 20 ? `rgba(255,${120 + i * 10},60,${a * 0.8})` : `rgba(255,214,90,${a * 0.7})`);
      }
      // 비치볼: 여섯 조각이 돌아간다
      o.ballRot = (o.ballRot || 0) + (b.spin || 0) * 0.016;
      const spans = FT.discSpans(R);
      const x0 = Math.round(b.x / D) * D;
      const y0 = Math.round(b.y / D) * D;
      const gold = o.rally >= 10 && o.phase !== 'over';
      for (const [dy, l, rr] of spans)
        for (let dx = l; dx <= rr; dx++) {
          const edge = dx === l || dx === rr || Math.abs(dy) === R || !spans.some(([y2, l2, r2]) => y2 === dy - Math.sign(dy) && dx >= l2 && dx <= r2);
          let c;
          if (edge) c = '#2b1a10';
          else if (dx * dx + dy * dy <= 1) c = '#ffffff';
          else {
            const seg = Math.floor((((Math.atan2(dy, dx) + o.ballRot) / (Math.PI * 2)) % 1 + 1) % 1 * 6);
            c = gold ? (seg % 2 ? '#ffd65a' : '#fff3bf') : BALL_COL[seg];
          }
          ctx.fillStyle = c;
          ctx.fillRect(x0 + dx * D, y0 + dy * D, D, D);
        }
      FT.dotAt(ctx, x0 - Math.round(R * 0.45) * D, y0 - Math.round(R * 0.5) * D, D, '#ffffff');
      // 점수판
      const hx = o.netX;
      const hy = fy - this.netH() - 18 * D;
      if (o.phase === 'serve') {
        ftext(ctx, 'CLICK THE BALL', hx + o.dir * P * 1.4, b.y - r - 10 * D, D, Math.floor(t * 2) % 2 ? '#ffd35c' : '#ffffff');
        if (REC().volley) ftext(ctx, `BEST ${REC().volley}`, hx, hy, D, '#ffffff');
      } else if (o.phase === 'play') big(ctx, String(o.rally), hx, hy, D, o.rally >= 20 ? '#ff9a3c' : o.rally >= 10 ? '#ffd35c' : '#ffffff');
      else results(ctx, o, hx, hy, D, now, o.catLost ? 'YOU WIN' : 'CAT WINS', `RALLY ${o.final}`);
      commonDraw(ctx, o, D, now);
    },
  };

  // ================= N6 냥냥 피아노 (따라 치기) =================
  // 바닥에 동그란 소리판 넷 (도·미·솔·도). 고양이가 폴짝폴짝 밟아 가락을 들려주면, 같은 순서로 판을 눌러 따라 친다.
  // 맞히면 한 음씩 늘어나고 점점 빨라진다 (기록 = 가장 긴 가락). 8음부터는 가끔 고양이가 신나서 앙코르 연주
  const PADS = [
    { c: '#e8534a', d: '#a8322c', l: '#ffb0a8', f: 523.25 },
    { c: '#ffd65a', d: '#d9a21f', l: '#fff3bf', f: 659.25 },
    { c: '#78c46a', d: '#4b8f43', l: '#c8f0bf', f: 783.99 },
    { c: '#6fb0ea', d: '#3d6fb0', l: '#cfe8f7', f: 1046.5 },
  ];
  const PAWPRINT = ['.K.K.', 'K.K.K', '.KKK.', '.KKK.'];
  C.simon = {
    overCat: true,
    start(o, side) {
      const P = petPx();
      const gap = Math.max(P * 0.6, 48);
      const cx = clamp(catX + side * gap * 2.2, gap * 2.2, W() - gap * 2.2);
      Object.assign(o, { cx, gap, seq: [], i: 0, lit: [0, 0, 0, 0], notes: [], hop: null });
      this.go(o, 'intro', performance.now());
    },
    go(o, phase, now) {
      o.phase = phase;
      o.at = now;
    },
    padX(o, i) {
      return o.cx + (i - 1.5) * o.gap;
    },
    padAt(o, x, y) {
      if (y == null || y < floorY() - petPx() * 0.6 || y > floorY() + 6) return -1;
      for (let i = 0; i < 4; i++) if (Math.abs(x - this.padX(o, i)) < o.gap * 0.46) return i;
      return -1;
    },
    wantsMouse(o, e) {
      return this.padAt(o, e.clientX, e.clientY) >= 0;
    },
    down(o, e) {
      const now = performance.now();
      const i = this.padAt(o, e.clientX, e.clientY);
      if (i < 0) return;
      if (o.phase === 'over') {
        if (now - o.overAt > 1000) {
          o.seq = [];
          this.go(o, 'intro', now);
        }
        return;
      }
      this.light(o, i, now);
      if (o.phase !== 'input') return;
      face(this.padX(o, i));
      if (i !== o.seq[o.i]) return this.wrong(o, i, now);
      o.i++;
      if (o.i < o.seq.length) return;
      // 한 가락을 다 따라 쳤다
      const n = o.seq.length;
      const isBest = best('simon', n);
      pop(o, isBest && n > 2 ? 'NEW BEST' : n % 5 === 0 ? `${n} NOTES!` : 'NICE', o.cx, floorY() - petPx() * 1.5, isBest ? '#ffd35c' : '#9fe3c8', 900);
      if (catLift <= 0) {
        sprite.setToyPose(null);
        sprite.play('toyYay');
      }
      if (n % 2 === 0) played();
      this.go(o, 'wait', now);
      o.encore = n >= 8 && Math.random() < 0.3;
    },
    click() {},
    light(o, i, now) {
      o.lit[i] = now;
      tone(PADS[i].f, 0.22, 0.03);
      o.notes.push({ x: this.padX(o, i) + rand(-6, 6), y: floorY() - 8 * itemDot(), t: now, c: PADS[i].c });
    },
    wrong(o, i, now) {
      tone(150, 0.45, 0.035, 'sawtooth', 0.7);
      o.bad = { i, t: now };
      o.final = o.seq.length - 1;
      sprite.setToyPose(null);
      if (catLift <= 0) sprite.play('toyDeadpan');
      this.go(o, 'over', now);
      finish(o, 'simon', o.final, now);
      o.isBest = false; // 기록은 다 따라 칠 때마다 이미 남겼다
      o.bestShown = REC().simon || 0;
      played();
    },
    // 고양이가 i 번 판으로 폴짝
    hopTo(o, i, now, quick) {
      const tx = this.padX(o, i);
      const T = quick ? 0.22 : Math.min(0.34, this.beat(o) / 1000 * 0.62);
      const vy = (1500 * T) / 2;
      sprite.setToyPose(null);
      sprite.play('toyLeap');
      catVy = -vy;
      catLift = 1;
      catVx = (tx - catX) / T;
      o.hop = { i, t: now };
    },
    beat: (o) => Math.max(240, 620 - o.seq.length * 28),
    step(o, dt, now) {
      commonStep(o, dt, now);
      o.notes = o.notes.filter((n) => now - n.t < 900);
      const t = now - o.at;
      // 폴짝 → 착지하면 판이 울린다
      if (o.hop) {
        if (catLift > 0) return;
        const i = o.hop.i;
        o.hop = null;
        catX = this.padX(o, i);
        placeCat();
        this.light(o, i, now);
        burst(o, catX, floorY() - 2, 4, [PADS[i].c, '#ffffff'], 90, 350);
        o.nextAt = now + this.beat(o) * 0.55;
      }
      if (catLift > 0) return;
      switch (o.phase) {
        case 'intro':
          if (walkTo(o.cx, dt, 1, 4) <= 4 || t > 2500) {
            face(this.padX(o, 0));
            this.go(o, 'wait', now);
          }
          break;
        case 'wait':
          // 잠깐 쉬고 다음 가락 (앙코르면 먼저 신나는 연주)
          sprite.setMove(0);
          if (t < 1100) break;
          if (o.encore) {
            o.encore = false;
            o.flourish = [0, 1, 2, 3, 2, 1, 0];
            pop(o, 'ENCORE!', o.cx, floorY() - petPx() * 1.7, '#ff9bb8', 1100);
            this.go(o, 'flourish', now);
            break;
          }
          o.seq.push(Math.floor(Math.random() * 4));
          o.i = 0;
          o.nextAt = now + 300;
          this.go(o, 'show', now);
          break;
        case 'flourish':
          if (now < (o.nextAt || 0)) break;
          if (!o.flourish.length) {
            o.seq.push(Math.floor(Math.random() * 4));
            o.i = 0;
            o.nextAt = now + 500;
            this.go(o, 'show', now);
            break;
          }
          this.hopTo(o, o.flourish.shift(), now, true);
          break;
        case 'show':
          sprite.setMove(0);
          if (now < (o.nextAt || 0)) break;
          if (o.i >= o.seq.length) {
            // 다 들려줬다. 이제 내 차례 — 고양이는 판 뒤로 물러나 지켜본다
            o.i = 0;
            this.go(o, 'input', now);
            break;
          }
          this.hopTo(o, o.seq[o.i++], now, false);
          break;
        case 'input': {
          const off = o.cx + (catX < o.cx ? -1 : 1) * o.gap * 2.4;
          if (walkTo(off, dt, 1.2, 4) <= 4) {
            face(o.cx);
            sprite.setToyPose('toyWatch');
          }
          break;
        }
        case 'over':
          sprite.setMove(0);
          break;
      }
    },
    end() {
      hush();
    },
    draw(ctx, o, D, now) {
      const P = petPx();
      const fy = floorY();
      const rx = Math.max(5, Math.round((o.gap * 0.4) / D));
      const ry = Math.max(2, Math.round(rx * 0.32));
      const box = [o.cx - o.gap * 2.1, fy - (ry * 2 + 4) * D, o.gap * 4.2, (ry * 2 + 5) * D];
      FT.underCat(ctx, (g) => {
        for (let i = 0; i < 4; i++) {
          const p = PADS[i];
          const x = this.padX(o, i);
          const on = now - o.lit[i] < 260;
          const bad = o.bad && o.bad.i === i && now - o.bad.t < 900;
          const hint = o.phase === 'over' && o.final >= 0 && o.seq[o.i] === i && Math.floor((now - o.overAt) / 220) % 2 === 0 && now - o.overAt < 1800;
          const top = fy - (ry + 2) * D - (on ? 0 : D);
          // 옆면 (두께)
          oval(g, x, fy - (ry + 1) * D, rx, ry, D, (dx, dy, edge) => (edge ? '#2b1a10' : p.d));
          // 윗면: 누르면 한 칸 내려가며 밝게
          oval(g, x, top, rx, ry, D, (dx, dy, edge) => (edge ? '#2b1a10' : bad ? '#ff5a5a' : on || hint ? p.l : dy < 0 && dx < -rx * 0.3 ? p.l : p.c));
          stamp(g, PAWPRINT, x, top, D);
        }
      }, box);
      // 울릴 때 퍼지는 음표
      for (const n of o.notes) {
        const k = (now - n.t) / 900;
        ctx.globalAlpha = Math.max(0, 1 - k);
        FT.stampAt(ctx, ['.KK', '.K.', 'KK.'], n.x + Math.sin(k * 6) * 4, n.y - k * 40, D, { K: n.c });
      }
      ctx.globalAlpha = 1;
      const hy = fy - P * 1.25;
      if (o.phase === 'show' || o.phase === 'flourish') ftext(ctx, 'LISTEN', o.cx, hy, D, '#ffffff');
      else if (o.phase === 'input') {
        big(ctx, 'YOUR TURN', o.cx, hy - 2 * D, D, '#ffd35c');
        // 몇 음째인가: 친 만큼 점이 켜진다
        const n = o.seq.length;
        for (let k = 0; k < n; k++) FT.dotAt(ctx, o.cx + (k - (n - 1) / 2) * 3 * D, hy + 8 * D, 2 * D, k < o.i ? '#ffd35c' : 'rgba(255,255,255,0.45)');
      } else if (o.phase === 'over') results(ctx, o, o.cx, hy - 6 * D, D, now, `NOTES ${o.final}`, 'OOPS');
      if (o.seq.length && o.phase !== 'over') ftext(ctx, `NOTES ${o.seq.length}`, o.cx, hy - 14 * D, D, '#9fe3c8');
      commonDraw(ctx, o, D, now);
    },
  };

  root.TOY_CUSTOM = Object.assign(root.TOY_CUSTOM || {}, C);
})(window);
