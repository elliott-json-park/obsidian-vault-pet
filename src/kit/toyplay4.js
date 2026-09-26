// 3차 장난감 (2026-09-24): 사람과 고양이가 같이 하는 놀이 다섯 가지.
//  두더지 잡기(역할 반전) · 가위바위보 · 도미노 · 줄다리기 · 트램펄린
// 앞의 장난감들처럼 pet.js 의 놀이 틀(start·step·draw·click·down·up·end)에 꽂힌다. toyplay.js 의 ToyKit 을 같이 쓴다.
//
// 최고 기록은 main 이 state.toyRecords 에 모아 둔다 (놀이를 꺼낼 때 window.TOY_RECORDS 로 받아 온다).
// 이 놀이들은 '잡았다!' 말풍선이 어울리지 않아서 pet.caught() 대신 pet.played() 로 배부름·기운만 깎는다.
(function (root) {
  const K = root.ToyKit;
  const FT = PetToys;
  const { ftext, pop, burst, commonStep, commonDraw, sfx, H } = K;
  const { GROUND, seg, ease } = PetSprite.util;
  const PAL = FT.palOf('#2b1a10');
  const C = {};

  // ---------- 공통 ----------
  const cell = () => cellPx();
  // 고양이 발이 닿는 바닥 줄 (화면 y). 바닥 물건의 floorY 와는 몇 px 다르다 — 고양이와 같이 놓이는 건 이 줄에 맞춘다
  const ground = () => H() - (PetSprite.GRID - GROUND) * cell();
  // 고양이 키 (발에서 정수리까지, px). headTop 은 지금 프레임에서 제일 위에 찍힌 줄이라 구멍에 들어가 있거나
  // 자세가 바뀌면 달라진다. 서 있을 때 잰 값을 기억해 두고 쓴다 (모자를 쓰면 더 크다)
  let standRows = 14;
  const catRows = () => {
    if (!G.sink && !sprite.action && !G.flip) standRows = clamp(GROUND - sprite.headTop(), 10, 30);
    return standRows;
  };
  const catH = () => catRows() * cell();
  const dotPx = () => Math.max(2, Math.round(cell()));

  const REC = () => (root.TOY_RECORDS = root.TOY_RECORDS || {});
  // 더 높으면 새 기록. 새 기록이면 true
  function best(key, v) {
    const r = REC();
    if (v <= (r[key] || 0)) return false;
    r[key] = v;
    if (pet.toyRecord) pet.toyRecord(key, v);
    return true;
  }
  const played = () => (pet.played ? pet.played() : pet.caught());
  const say = (key, vars) => T.t(key, vars);

  // 놀이판 위에 뜨는 버튼·말풍선 (DOM). 치울 때 같이 치운다
  function ui(o, cls, html = '') {
    const el = document.createElement('div');
    el.className = 'toygame ' + cls;
    el.innerHTML = html;
    document.body.appendChild(el);
    (o.ui = o.ui || []).push(el);
    return el;
  }
  function clearUi(o) {
    for (const el of o.ui || []) el.remove();
    o.ui = [];
  }
  const inRect = (r, x, y, pad = 0) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  const overUi = (o, e) => (o.ui || []).some((el) => !el.hidden && el.offsetWidth && inRect(el.getBoundingClientRect(), e.clientX, e.clientY, 4));
  const fromUi = (e) => !!(e && e.target && e.target.closest && e.target.closest('.toygame'));
  // x = 가운데, y = 아랫변. 화면 밖으로 안 나가게
  function put(el, x, y) {
    const w = el.offsetWidth;
    el.style.left = `${Math.round(clamp(x - w / 2, 6, window.innerWidth - w - 6))}px`;
    el.style.top = `${Math.round(Math.max(6, y - el.offsetHeight))}px`;
  }
  // 도트 그림을 작은 캔버스로 (버튼·말풍선 안에 넣는다)
  function art(rows, px, pal = PAL) {
    const c = document.createElement('canvas');
    c.width = rows[0].length;
    c.height = rows.length;
    c.style.width = `${c.width * px}px`;
    c.style.height = `${c.height * px}px`;
    c.className = 'pix';
    const ctx = c.getContext('2d');
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
      if (!pal[ch]) return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(i, j, 1, 1);
    }));
    return c;
  }
  // 큰 도트 글자 (READY · GO · WIN …)
  const big = (ctx, s, x, y, D, fill, outline) => ftext(ctx, s, x, y, D * 2, fill, outline);

  // 놀이마다 고양이 자세를 이 값들로 움직인다 (자세 함수는 매 프레임 여기서 읽는다)
  const G = { sink: 0, look: 0, paw: null, lean: 0, strain: 0, flip: 0, squash: 0, side: 1 };

  // ================= 두더지 잡기 (역할 반전) =================
  // 바닥에 구멍 세 개. 고양이가 아무 구멍에서나 쏙 튀어나오면 뿅망치로 뿅! 30초 동안 몇 번 맞히나.
  // 뒤로 갈수록 빨리 들어간다. 헛손질해도 감점은 없다. 끝나면 아무 데나 눌러서 한 판 더
  const WHACK_SECS = 30;
  const HAMMER = [
    '.KKKKKKK.',
    'KRRRRRRRK',
    'KRHRRRRRK',
    'KRRRRRRRK',
    'KrrrrrrrK',
    '.KKKKKKK.',
    '....KYK..',
    '....KYK..',
    '....KYK..',
    '....KyK..',
    '....KYK..',
    '....KKK..',
  ].map((r) => r.padEnd(9, '.'));
  C.whackcat = {
    cursor: true,
    overCat: true, // 고양이 위를 눌러도 쓰다듬기가 아니라 뿅망치
    start(o) {
      const P = petPx();
      const gap = P * 0.72;
      const [min, max] = lane();
      const mid = clamp(catX, min + gap, max - gap);
      Object.assign(o, {
        holes: [mid - gap, mid, mid + gap],
        phase: 'intro', t0: performance.now(), score: 0, at: 1, state: 'dive', stateAt: performance.now(), swing: 0,
      });
      G.sink = 0;
      document.body.classList.add('no-cursor');
      // 고양이는 가운데 구멍으로 쏙 들어가면서 시작한다
      walkHole(o, 1);
      sprite.setToyPose('toyMole');
    },
    down(o, e) {
      const now = performance.now();
      o.swing = now;
      if (o.phase === 'over') {
        if (now - o.overAt > 1200) this.start(o);
        return;
      }
      if (o.phase !== 'play') return;
      if (o.state !== 'up' && o.state !== 'rise') {
        sfx('tick', 0.015);
        return;
      }
      // 보이는 고양이 머리·몸 위를 맞혔나
      const top = ground() - catH() + G.sink * cell();
      const lip = ground() - 2 * cell();
      if (Math.abs(e.clientX - catX) < cell() * 9 && e.clientY > top - cell() * 3 && e.clientY < lip + cell()) {
        o.score++;
        o.state = 'bonk';
        o.stateAt = now;
        sfx('bonk', 0.03);
        pop(o, o.score % 5 === 0 ? `${o.score}!` : 'POP', catX, top - 10, '#ffd35c', 600);
        burst(o, e.clientX, e.clientY, 6, ['#ffd35c', '#ffffff'], 140, 450);
      } else sfx('tick', 0.015);
    },
    step(o, dt, now) {
      commonStep(o, dt, now);
      sprite.setMove(0);
      const P = petPx();
      const full = (o.full = catRows() + 2); // 이만큼 내려가면 머리끝까지 숨는다
      const low = 2; // 다 나와도 발은 구멍 속에
      const since = now - o.stateAt;
      if (o.phase === 'intro' && now - o.t0 > 1600) {
        o.phase = 'play';
        o.t0 = now;
      }
      if (o.phase === 'play' && now - o.t0 > WHACK_SECS * 1000) {
        o.phase = 'over';
        o.overAt = now;
        o.isBest = best('whackcat', o.score);
        played();
        o.state = 'show';
        o.stateAt = now;
        sfx(o.isBest ? 'win' : 'quest', 0.03);
      }
      // 고양이 하나가 구멍을 오간다: 숨음 → 쏙 → 두리번 → 쏙 들어감
      const k = o.phase === 'play' ? (now - o.t0) / (WHACK_SECS * 1000) : 0;
      const upMs = 1150 - 600 * k; // 뒤로 갈수록 빨리 들어간다
      switch (o.state) {
        case 'dive':
          G.sink = Math.min(full, G.sink + dt * 60);
          if (G.sink >= full && o.phase === 'play') next(o, now);
          break;
        case 'wait':
          G.sink = full;
          if (since > o.waitMs) {
            o.state = 'rise';
            o.stateAt = now;
          }
          break;
        case 'rise':
          G.sink = Math.max(low, full - (full - low) * ease(Math.min(1, since / 130)));
          if (since > 130) {
            o.state = 'up';
            o.stateAt = now;
          }
          break;
        case 'up':
          G.sink = low;
          G.look = Math.floor(since / 280) % 2 ? 1 : -1;
          if (since > upMs) {
            o.state = 'dive';
            o.stateAt = now;
          }
          break;
        case 'bonk':
          // 뿅! 별이 핑핑 돌다가 들어간다
          G.sink = low + 2;
          if (since > 520) {
            o.state = 'dive';
            o.stateAt = now;
          }
          break;
        case 'show':
          // 끝나면 가운데 구멍에서 나와서 결과를 본다
          if (Math.abs(catX - o.holes[1]) > 1) {
            G.sink = Math.min(full, G.sink + dt * 60);
            if (G.sink >= full) walkHole(o, 1);
          } else G.sink = Math.max(low, G.sink - dt * 40);
          break;
      }
      if (o.phase === 'over') face(mouseX);
      return true;
    },
    end(o) {
      G.sink = 0;
      document.body.classList.remove('no-cursor');
      sprite.setToyPose(null);
    },
    draw(ctx, o, D, now) {
      const P = petPx();
      const d = dotPx();
      const gy = ground();
      // 구멍: 앞쪽 흙 둔덕만 그린다 (고양이 캔버스는 clipY 로 구멍 입구 아래가 잘린다)
      for (const x of o.holes) drawHole(ctx, x, gy, d, Math.abs(catX - x) < 1 && G.sink < (o.full || 99) - 1);
      // 윗줄 점수판
      const hy = gy - catH() - 12 * D;
      if (o.phase === 'intro') big(ctx, now - o.t0 < 1000 ? 'READY' : 'GO!', o.holes[1], hy, D, '#ffd35c');
      else if (o.phase === 'play') {
        const left = Math.max(0, Math.ceil(WHACK_SECS - (now - o.t0) / 1000));
        ftext(ctx, `TIME ${left}`, o.holes[0], hy, D, left <= 5 ? '#ff9a9a' : '#ffffff');
        ftext(ctx, `SCORE ${o.score}`, o.holes[2], hy, D, '#ffd35c');
      } else {
        big(ctx, `SCORE ${o.score}`, o.holes[1], hy - 16 * D, D, '#ffd35c');
        ftext(ctx, o.isBest ? 'NEW BEST!' : `BEST ${REC().whackcat || 0}`, o.holes[1], hy - 6 * D, D, o.isBest ? '#9fe3c8' : '#ffffff');
        if (now - o.overAt > 1200) ftext(ctx, 'CLICK TO PLAY', o.holes[1], hy + 1 * D, D, '#ffffff');
      }
      if (o.phase === 'play' && o.state === 'bonk') {
        // 머리 위에 빙글빙글 별
        const top = gy - catH() + G.sink * cell();
        for (let i = 0; i < 3; i++) {
          const a = now / 110 + (i * Math.PI * 2) / 3;
          FT.dotAt(ctx, catX + Math.cos(a) * cell() * 7, top - 6 + Math.sin(a) * 4, D, '#ffd35c');
        }
      }
      // 뿅망치 커서. 누른 순간 앞으로 휙 기운다
      if (mouseX != null) {
        const sw = now - o.swing < 140;
        ctx.save();
        ctx.translate(Math.round(mouseX), Math.round(mouseY));
        ctx.rotate(sw ? -0.9 : -0.25);
        FT.stampAt(ctx, HAMMER, 0, (HAMMER.length * D) / 2 - 3 * D, D, PAL);
        ctx.restore();
      }
      commonDraw(ctx, o, D, now);
    },
  };
  // 숨은 채로 i 번째 구멍으로 옮긴다
  function walkHole(o, i) {
    o.hole = i;
    catX = o.holes[i];
    placeCat();
  }
  // 다음에 튀어나올 구멍을 고른다 (같은 구멍이 연달아 나올 때도 있다)
  function next(o, now) {
    const i = Math.random() < 0.25 ? o.hole : [0, 1, 2].filter((x) => x !== o.hole)[Math.floor(Math.random() * 2)];
    walkHole(o, i);
    sprite.setFacing(Math.random() < 0.5 ? -1 : 1);
    o.state = 'wait';
    o.stateAt = now;
    o.waitMs = 250 + Math.random() * 650;
  }
  // 구멍 하나. 가운데가 x, 바닥 줄이 gy. 뒤쪽 어두운 입구는 고양이 몸이 가리니 입구 양 끝만 살짝 보인다
  function drawHole(ctx, x, gy, d, inside) {
    const w = 21;
    const rows = [
      '...KKKKKKKKKKKKKKK...',
      '.KKXXXXXXXXXXXXXXXKK.',
      'KcCCCCCCCCCCCCCCCCCcK',
      'KcCTCCCCCCtCCCCCTCCcK',
      'KccCCCtCCCCCCCtCCCccK',
      '.KKcccccccccccccccKK.',
    ];
    // 입구 뒤쪽 테두리(첫 두 줄)는 고양이가 나와 있으면 가운데를 비워 둔다 — 고양이 몸이 가리는 것처럼
    const r = inside ? rows.map((s, j) => (j < 2 ? s.slice(0, 3) + '.'.repeat(w - 6) + s.slice(w - 3) : s)) : rows;
    FT.stampAt(ctx, r, x, gy - 2 * d + (rows.length * d) / 2 - 2 * d, d, PAL);
  }

  // ================= 가위바위보 =================
  // 버튼으로 내면 고양이도 앞발로 낸다. 서로 낸 건 말풍선으로. 연승 기록이 남는다 (비기면 이어진다)
  const HANDS = ['rock', 'scissors', 'paper'];
  const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
  // 사람 손 (살구색)
  const HAND_ART = {
    rock: [
      '...KKKKKK...',
      '..KSSKSSKK..',
      '.KSSSKSSKSK.',
      '.KSSSKSSKSK.',
      'KSKKKKKSKSK.',
      'KSSSSSKSSSK.',
      'KsSSSSSSSSK.',
      '.KsSSSSSSsK.',
      '..KssSSssK..',
      '...KKKKKK...',
    ],
    scissors: [
      '.KK....KK...',
      'KSSK..KSSK..',
      'KSSK..KSSK..',
      '.KSSK.KSSK..',
      '.KSSKKSSK...',
      '..KSSSSSKKK.',
      '.KKKKSSKSSK.',
      'KSSSSKSSSSK.',
      'KsSSSSSSSsK.',
      '.KssSSSssK..',
      '..KKKKKKK...',
    ],
    paper: [
      '..K.KK.KK...',
      '.KSKSSKSSK..',
      '.KSKSSKSSKK.',
      '.KSKSSKSSKSK',
      '.KSKSSKSSKSK',
      'KKSSSSSSSKSK',
      'KSKSSSSSSSSK',
      'KSSKSSSSSSK.',
      '.KsSSSSSSsK.',
      '..KssSSssK..',
      '...KKKKKK...',
    ],
  };
  // 고양이 앞발 (주황 털 + 분홍 젤리)
  // 고양이 앞발 (주황 털 + 분홍 젤리). 바위 = 오므린 발등, 가위 = 발가락 둘만 쫙, 보 = 발가락을 활짝 편 발바닥
  const PAW_ART = {
    rock: [
      '..KKKKKKKKK..',
      '.KOOKOOKOOOK.',
      'KOOOKOOKOOOOK',
      'KOOOOOOOOOOOK',
      'KOOOOOOOOOOOK',
      'KOOoOOOOOoOOK',
      'KOOOOOOOOOOOK',
      '.KOOOOOOOOOK.',
      '..KKKKKKKKK..',
    ],
    scissors: [
      '.KK.....KK.',
      'KPOK...KOPK',
      'KOOK...KOOK',
      '.KOOK.KOOK.',
      '.KOOKKKOOK.',
      'KOOOOOOOOOK',
      'KOKOKOOOOOK',
      'KOOOOOOOOOK',
      '.KOOOOOOOK.',
      '..KKKKKKK..',
    ],
    paper: [
      '.KKK.KKK.KKK.',
      'KOPOKOPOKOPOK',
      'KOOOKOOOKOOOK',
      '.KOOOOOOOOOK.',
      'KOOOPPPPPOOOK',
      'KOOPPPPPPPOOK',
      'KOOPPPPPPPOOK',
      '.KOOPPPPPOOK.',
      '..KOOOOOOOK..',
      '...KKKKKKK...',
    ],
  };
  C.rps = {
    wantsMouse: (o, e) => overUi(o, e),
    start(o) {
      const side = catX > window.innerWidth / 2 ? -1 : 1;
      Object.assign(o, { side, phase: 'idle', at: 0 });
      const pad = ui(o, 'rps-pad', `<div class="rps-rec"></div><div class="rps-btns"></div>`);
      const btns = pad.querySelector('.rps-btns');
      for (const h of HANDS) {
        const b = document.createElement('button');
        b.className = 'tg-btn';
        b.dataset.h = h;
        b.appendChild(art(HAND_ART[h], 3));
        const s = document.createElement('span');
        s.textContent = say('game.' + h);
        b.appendChild(s);
        b.addEventListener('click', () => throwHand(o, h));
        btns.appendChild(b);
      }
      o.pad = pad;
      o.me = ui(o, 'rps-bubble me');
      o.cat = ui(o, 'rps-bubble cat');
      o.result = ui(o, 'rps-result');
      o.me.hidden = o.cat.hidden = o.result.hidden = true;
      recText(o);
      G.paw = null;
      sprite.setToyPose('toyRps');
    },
    click() {},
    step(o, dt, now) {
      commonStep(o, dt, now);
      sprite.setMove(0);
      if (catLift > 0) return true;
      const P = petPx();
      // 버튼판은 고양이 옆 (화면 가운데 쪽)
      put(o.pad, catX + o.side * (cell() * 12 + 110), H() - 10);
      const padR = o.pad.getBoundingClientRect();
      put(o.me, padR.left + padR.width / 2, padR.top - 8);
      put(o.result, padR.left + padR.width / 2, padR.top - 8 - (o.me.hidden ? 0 : o.me.offsetHeight + 8));
      put(o.cat, catX, ground() - catH() - 10);
      face(catX + o.side);
      if (o.phase !== 'chant') return true;
      const t = now - o.at;
      // 가위… 바위… 보! (앞발을 세 번 까딱)
      const chant = say('game.chant').split('|');
      const beat = Math.min(2, Math.floor(t / 330));
      if (t < 990) {
        G.paw = 'shake';
        setCatText(o, chant[beat] || '');
      } else if (!o.shown) {
        o.shown = true;
        G.paw = o.catHand;
        o.cat.innerHTML = '';
        o.cat.appendChild(art(PAW_ART[o.catHand], 3));
        o.me.innerHTML = '';
        o.me.appendChild(art(HAND_ART[o.mine], 3));
        o.me.hidden = false;
        sfx('pop', 0.03);
      } else if (!o.judged && t > 1350) {
        o.judged = true;
        judge(o, now);
      } else if (t > 1700) {
        o.phase = 'idle';
        for (const b of o.pad.querySelectorAll('button')) b.disabled = false;
      }
      return true;
    },
    end(o) {
      clearUi(o);
      G.paw = null;
      sprite.setToyPose(null);
    },
    draw(ctx, o, D, now) {
      commonDraw(ctx, o, D, now);
    },
  };
  function setCatText(o, s) {
    if (o.cat.dataset.s === s) return;
    o.cat.dataset.s = s;
    o.cat.textContent = s;
    o.cat.hidden = false;
  }
  function recText(o) {
    const r = REC();
    o.pad.querySelector('.rps-rec').textContent = say('game.rpsRec', { n: r.rpsStreak || 0, best: r.rps || 0 });
  }
  function throwHand(o, h) {
    if (o.phase !== 'idle') return;
    Object.assign(o, { phase: 'chant', at: performance.now(), mine: h, catHand: HANDS[Math.floor(Math.random() * 3)], shown: false, judged: false });
    o.cat.dataset.s = '';
    o.me.hidden = true;
    o.result.hidden = true;
    for (const b of o.pad.querySelectorAll('button')) {
      b.disabled = true;
      b.classList.toggle('picked', b.dataset.h === h);
    }
    sprite.cancel();
    sprite.setToyPose('toyRps');
    sfx('tick', 0.02);
  }
  function judge(o, now) {
    const r = REC();
    const res = o.mine === o.catHand ? 'draw' : BEATS[o.mine] === o.catHand ? 'win' : 'lose';
    let streak = r.rpsStreak || 0;
    if (res === 'win') streak++;
    if (res === 'lose') streak = 0;
    r.rpsStreak = streak;
    if (pet.toyRecord) pet.toyRecord('rpsStreak', streak, true);
    const isBest = res === 'win' && best('rps', streak);
    o.result.textContent = say('game.' + res) + (res === 'win' && streak > 1 ? ` · ${say('game.streak', { n: streak })}` : '') + (isBest && streak > 1 ? ` · ${say('game.newBest')}` : '');
    o.result.className = `toygame rps-result ${res}`;
    o.result.hidden = false;
    recText(o);
    played();
    // 고양이 반응: 이기면 신나고, 지면 삐지고, 비기면 멀뚱
    sprite.setToyPose(null);
    G.paw = null;
    if (res === 'lose') {
      sprite.play('toyYay');
      sfx('lose', 0.025);
    } else if (res === 'win') {
      sprite.play('toySulk');
      sfx(isBest ? 'win' : 'quest', 0.03);
    } else {
      sprite.play('toyDeadpan');
      sfx('pop', 0.02);
    }
    K.later(o, 1500, () => { if (toy === o && o.phase !== 'chant') sprite.setToyPose('toyRps'); });
  }

  // ================= 도미노 =================
  // 고양이 뒤쪽(화면 가장자리 쪽)에 쌓인 도미노 더미에서 하나씩 끌어다 바닥에 세운다. 고양이 머리 위 시작 버튼을 누르면
  // 고양이가 가까운 쪽 끝으로 가서 첫 번째를 톡 → 와르르. 간격이 너무 넓으면 거기서 멈춘다
  const DOM_MAX = 14;
  C.domino = {
    wantsMouse: (o, e) => !!o.drag || overUi(o, e) || !!pickAt(o, e.clientX, e.clientY),
    start(o) {
      const P = petPx();
      const side = catX > window.innerWidth / 2 ? -1 : 1;
      Object.assign(o, { side, list: [], run: null, drag: null, pileX: clamp(catX - side * cell() * 20, 30, window.innerWidth - 30) });
      o.btn = ui(o, 'dom-btn', '');
      const b = document.createElement('button');
      b.className = 'tg-btn wide';
      b.addEventListener('click', () => (o.run && o.run.done ? restand(o) : startRun(o)));
      o.btn.appendChild(b);
      o.btnEl = b;
      btnText(o);
    },
    down(o, e) {
      if (fromUi(e) || o.run && !o.run.done) return;
      const hit = pickAt(o, e.clientX, e.clientY);
      if (!hit) return;
      if (hit === 'pile') {
        if (o.list.length >= DOM_MAX) return;
        const d = { x: e.clientX, ang: 0, av: 0, lean: null, dir: 1 };
        o.list.push(d);
        o.drag = d;
      } else o.drag = hit;
      o.drag.lifted = true;
      sfx('tick', 0.015);
    },
    up(o) {
      const d = o.drag;
      o.drag = null;
      if (!d) return;
      d.lifted = false;
      // 더미 위에 놓으면 다시 넣는다
      if (Math.abs(d.x - o.pileX) < cell() * 6) {
        o.list = o.list.filter((x) => x !== d);
        return;
      }
      // 고양이 몸과 겹치지 않게, 화면 밖으로 안 나가게
      const R = cell() * 10;
      if (Math.abs(d.x - catX) < R) d.x = catX + (Math.sign(d.x - catX) || 1) * R;
      d.x = clamp(d.x, 12, window.innerWidth - 12);
      // 다른 도미노와 딱 붙으면 넘어질 틈이 없다. 한 칸 반은 띄운다
      for (const x of o.list) if (x !== d && Math.abs(x.x - d.x) < dW() * 1.5) d.x = x.x + (Math.sign(d.x - x.x) || 1) * dW() * 1.5;
      Object.assign(d, { ang: 0, av: 0, lean: null, fell: false });
      sfx('pop', 0.015);
      btnText(o);
    },
    click() {},
    step(o, dt, now) {
      commonStep(o, dt, now);
      const P = petPx();
      if (o.drag) o.drag.x = mouseX;
      put(o.btn, catX, ground() - catH() - 8);
      const run = o.run;
      if (!run || run.done) {
        sprite.setMove(0);
        if (o.drag) face(mouseX);
        return true;
      }
      // 첫 도미노 옆으로 걸어가서 톡
      if (run.phase === 'walk') {
        const first = run.chain[0];
        const at = first.x - run.dir * (cell() * 8 + dW());
        if (walkTo(at, dt, 1, 3) <= 3) {
          face(first.x);
          sprite.play('toySwipe');
          run.phase = 'tap';
          run.at = now;
        }
        return true;
      }
      sprite.setMove(0);
      if (run.phase === 'tap' && now - run.at > 280) {
        run.phase = 'fall';
        run.chain[0].av = 2.2;
        run.chain[0].falling = true;
        sfx('tick', 0.02);
      }
      if (run.phase === 'fall') stepChain(o, run, dt, now);
      return true;
    },
    end(o) {
      clearUi(o);
    },
    draw(ctx, o, D, now) {
      const d = D;
      const gy = ground();
      // 더미: 누운 도미노가 차곡차곡
      const left = DOM_MAX - o.list.length;
      for (let i = 0; i < Math.min(5, left); i++) drawDomino(ctx, o.pileX - dH() / 2 + (i % 2 ? d : -d), gy - i * dW(), Math.PI / 2, 1, d);
      if (left > 0) ftext(ctx, `X${left}`, o.pileX, gy - Math.min(5, left) * dW() - 5 * D, D, '#ffffff');
      for (const x of o.list) {
        if (x === o.drag) drawDomino(ctx, x.x, mouseY + dH() / 2, 0, 1, d, true);
        else drawDomino(ctx, x.x, gy, x.ang, x.dir, d);
      }
      if (o.run && o.run.done && o.run.shownAt && now - o.run.shownAt < 2600) {
        const n = o.run.chain.filter((x) => x.fell).length;
        big(ctx, n === o.run.chain.length ? 'PERFECT!' : `${n}/${o.run.chain.length}`, catX, gy - catH() - 30 * D, D, n === o.run.chain.length ? '#ffd35c' : '#ffffff');
      }
      commonDraw(ctx, o, D, now);
    },
  };
  const dW = () => dotPx() * 3;
  const dH = () => dotPx() * 11;
  function btnText(o) {
    const done = o.run && o.run.done;
    o.btnEl.textContent = done ? say('game.restand') : say('game.start');
    o.btnEl.disabled = !done && o.list.length < 2;
  }
  // 마우스 밑의 도미노 (세워진 것·넘어진 것) 또는 더미
  function pickAt(o, x, y) {
    const gy = ground();
    if (Math.abs(x - o.pileX) < dH() * 0.6 && y > gy - dH() && y < gy + 6 && o.list.length < DOM_MAX) return 'pile';
    for (let i = o.list.length - 1; i >= 0; i--) {
      const d = o.list[i];
      const reach = d.ang > 0.6 ? dH() * 0.8 : dW();
      const cx = d.x + (d.ang > 0.6 ? d.dir * dH() * 0.45 : 0);
      if (Math.abs(x - cx) < reach && y > gy - dH() - 6 && y < gy + 6) return d;
    }
    return null;
  }
  function startRun(o) {
    const up = o.list.filter((d) => d.ang === 0);
    if (up.length < 2) return;
    up.sort((a, b) => a.x - b.x);
    // 고양이에서 가까운 끝부터, 먼 쪽으로 넘어뜨린다
    const fromLeft = Math.abs(catX - up[0].x) <= Math.abs(catX - up[up.length - 1].x);
    const chain = fromLeft ? up : up.reverse();
    const dir = fromLeft ? 1 : -1;
    for (const d of chain) Object.assign(d, { dir, falling: false, av: 0, lean: null, fell: false });
    o.run = { chain, dir, phase: 'walk', at: performance.now(), idx: 0, quietAt: 0 };
    o.btn.hidden = true;
  }
  function restand(o) {
    for (const d of o.list) Object.assign(d, { ang: 0, av: 0, lean: null, fell: false, falling: false });
    o.run = null;
    o.btn.hidden = false;
    btnText(o);
    sfx('pop', 0.02);
  }
  // 넘어지는 도미노: 기울수록 빨라진다. 윗모서리가 다음 도미노에 닿으면 기대 서고, 다음 게 넘어간다
  function stepChain(o, run, dt, now) {
    const h = dH();
    const w = dW();
    let moving = false;
    run.chain.forEach((d, i) => {
      if (!d.falling) return;
      const nx = run.chain[i + 1];
      const gap = nx ? Math.abs(nx.x - d.x) - w : Infinity;
      const stop = gap < h ? Math.asin(Math.max(0, gap) / h) : Math.PI / 2;
      d.av += 16 * Math.sin(d.ang + 0.12) * dt;
      d.ang = Math.min(stop, d.ang + d.av * dt);
      if (d.ang >= stop) {
        if (!d.fell) {
          d.fell = true;
          sfx('tick', 0.02);
          if (nx && gap < h && !nx.falling) {
            nx.falling = true;
            nx.av = Math.max(1.2, d.av * 0.75);
          }
          if (!nx || gap >= h) burst(o, d.x + run.dir * h * 0.8, ground() - 2, 4, ['#fffaf3', '#d3cabb'], 90, 400);
        }
        d.av = 0;
        d.falling = false;
      } else moving = true;
    });
    if (moving) run.quietAt = now;
    else if (now - run.quietAt > 500 && !run.done) {
      run.done = true;
      run.shownAt = now;
      const all = run.chain.every((d) => d.fell);
      sprite.play(all ? 'toyYay' : 'toyDeadpan');
      sfx(all ? 'win' : 'pop', 0.03);
      played();
      o.btn.hidden = false;
      btnText(o);
    }
  }
  // 도미노 하나: 흰 몸통, 까만 테두리, 가운데 줄과 점 둘. 아래 모서리(넘어지는 쪽)를 축으로 ang 만큼 돈다
  function drawDomino(ctx, x, gy, ang, dir, d, held) {
    const W = 3;
    const Hh = 11;
    const px = x + (dir * W * d) / 2;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    for (let v = 0; v < Hh; v++)
      for (let u = 0; u < W; u++) {
        const edge = u === 0 || u === W - 1 || v === 0 || v === Hh - 1;
        const mid = v === 5 && !edge;
        const pip = !edge && (v === 2 || v === 8);
        const col = edge || mid ? '#2b1a10' : pip ? '#e5463f' : held ? '#fffdf8' : '#fffaf3';
        // 축에서 본 자리 (dx: 넘어지는 쪽이 +, dy: 위가 -)
        const dx = (u - W + 0.5) * d;
        const dy = -(v + 0.5) * d;
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        FT.dotAt(ctx, px + dir * rx - d / 2, gy + ry - d / 2, d, col);
      }
  }

  // ================= 줄다리기 =================
  // 꺼내면 5초 준비. 그동안 줄 끝(손잡이)에 마우스를 올려 둔다. 시작하면 줄 끝을 연타해서 당긴다.
  // 가운데 리본이 한쪽으로 충분히 넘어가면 승부. 고양이가 지면 LOSE, 이기면 WIN 이 고양이 머리 위에 뜬다.
  // 고양이 힘은 하우스 장난감 카드에서 고르는 난이도(하·중·상)를 따른다
  const TUG_CPS = { easy: 3.2, mid: 5, hard: 7 }; // 고양이 힘을 버티려면 1초에 몇 번 눌러야 하나
  const TUG_READY = 5000;
  C.tugrope = {
    cursor: true,
    start(o) {
      const P = petPx();
      const W = window.innerWidth;
      const side = catX > W / 2 ? -1 : 1; // 사람 쪽 (줄이 뻗는 쪽)
      const len = cell() * 34;
      const [min, max] = lane();
      // 고양이가 이겨서 뒤로 물러나도, 져서 끌려가도 화면 안에 있게
      const m = cell() * 16;
      const baseX = side > 0 ? clamp(catX, min + m, max - len - m) : clamp(catX, min + len + m, max - m);
      Object.assign(o, { side, len, baseX, pos: 0, phase: 'ready', at: performance.now(), level: root.TUG_LEVEL || 'mid', clicks: [] });
      catX = baseX;
      placeCat();
      sprite.setFacing(side);
      G.side = side;
      G.lean = 0;
      G.strain = 0;
      sprite.setToyPose('toyTug');
    },
    down(o, e) {
      const now = performance.now();
      if (o.phase === 'over') {
        if (now - o.at > 1500) this.start(o);
        return;
      }
      if (o.phase !== 'pull') return;
      // 줄의 사람 쪽 절반 근처면 당긴 걸로 친다 (손잡이가 끌려다녀도 놓치지 않게 넉넉하게)
      const y = ropeY();
      const mid = handleX(o) - o.side * o.len * 0.5;
      if ((e.clientX - mid) * o.side > -cell() * 4 && Math.abs(e.clientY - y) < cell() * 16) {
        o.pos += cell() * 0.8;
        o.clicks.push(now);
        o.yank = now;
        sfx('tick', 0.012);
      }
    },
    click() {},
    step(o, dt, now) {
      commonStep(o, dt, now);
      sprite.setMove(0);
      const P = petPx();
      const t = now - o.at;
      const limit = cell() * 14;
      if (o.phase === 'ready' && t > TUG_READY) {
        o.phase = 'go';
        o.at = now;
        sfx('spin', 0.03);
      }
      if (o.phase === 'go' && t > 500) {
        o.phase = 'pull';
        o.at = now;
      }
      if (o.phase === 'pull') {
        const secs = (now - o.at) / 1000;
        // 고양이는 파도처럼 영차영차 당긴다. 시간이 갈수록 조금씩 세진다
        const cps = (TUG_CPS[o.level] || TUG_CPS.mid) * (1 + 0.025 * secs);
        const surge = 1 + 0.35 * Math.sin(secs * 4.2) + 0.15 * Math.sin(secs * 9.7);
        o.pos -= cell() * 0.8 * cps * surge * dt;
        G.strain = surge;
        if (Math.abs(o.pos) >= limit) finish(o, now, o.pos > 0 ? 'lose' : 'win');
      }
      if (o.phase === 'over') {
        // 진 쪽으로 쭉 끌려간다
        o.pos += (o.catWon ? -1 : 1) * cell() * 20 * dt * Math.max(0, 1 - (now - o.at) / 700);
      }
      catX = o.baseX + o.side * o.pos;
      placeCat();
      G.lean = clamp(-o.pos / limit, -1, 1);
      return true;
    },
    end() {
      G.lean = G.strain = 0;
      sprite.setToyPose(null);
    },
    draw(ctx, o, D, now) {
      const P = petPx();
      const y = ropeY();
      const x0 = catX + o.side * cell() * 6; // 고양이 앞발
      const x1 = handleX(o);
      const d = dotPx();
      // 바닥 가운데 선 (처음 리본 자리)
      const lineX = o.baseX + o.side * (cell() * 6 + o.len / 2);
      for (let i = -1; i <= 1; i++) FT.dotAt(ctx, lineX + i * d * 2, ground() + d, d, 'rgba(255,255,255,0.85)');
      // 줄: 팽팽하면 곧게, 느슨하면 살짝 처진다. 연타하면 부르르
      const shake = now - (o.yank || 0) < 80 ? d : 0;
      const n = Math.max(8, Math.round(Math.abs(x1 - x0) / d));
      const sag = o.phase === 'pull' ? d * 0.5 : d * 3;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const x = x0 + (x1 - x0) * k;
        const yy = y + Math.sin(k * Math.PI) * (sag + shake);
        FT.dotAt(ctx, x, yy, d, i % 4 < 2 ? '#e0a764' : '#b07436');
      }
      // 가운데 리본
      const rx = (x0 + x1) / 2;
      FT.stampAt(ctx, ['KRK', 'KRK', 'RRR', '.R.'], rx, y + d * 3, d, PAL);
      // 손잡이 (사람 쪽 끝)
      FT.stampAt(ctx, ['.KK.', 'KTtK', 'KTtK', 'KTtK', '.KK.'], x1 + o.side * d * 2, y, d, PAL);
      // 준비·시작·결과
      const top = ground() - catH() - 14 * D;
      if (o.phase === 'ready') {
        const left = Math.ceil((TUG_READY - (now - o.at)) / 1000);
        big(ctx, String(left), rx, y - cell() * 18, D, '#ffd35c');
        ftext(ctx, { easy: 'EASY', mid: 'NORMAL', hard: 'HARD' }[o.level] || 'NORMAL', rx, y - cell() * 18 + 12 * D, D, '#ffffff');
      } else if (o.phase === 'go') big(ctx, 'GO!', rx, y - cell() * 18, D, '#9fe3c8');
      else if (o.phase === 'over') {
        big(ctx, o.catWon ? 'WIN' : 'LOSE', catX, top, D, o.catWon ? '#ffd35c' : '#ff9a9a');
        if (now - o.at > 1500) ftext(ctx, 'CLICK TO PLAY', rx, y - cell() * 18, D, '#ffffff');
      }
      commonDraw(ctx, o, D, now);
    },
  };
  const ropeY = () => ground() - catH() * 0.42;
  const handleX = (o) => catX + o.side * (cell() * 6 + o.len);
  function finish(o, now, res) {
    o.phase = 'over';
    o.at = now;
    o.catWon = res === 'win';
    played();
    sprite.setToyPose(null);
    if (o.catWon) {
      sprite.play('toyYay');
      sfx('win', 0.03);
    } else {
      sprite.play('toyTrip');
      sfx('lose', 0.025);
      K.later(o, 1700, () => { if (toy === o) sprite.play('toySulk'); });
    }
  }

  // ================= 트램펄린 =================
  // 고양이가 트램펄린 위에서 통통 튄다. 발이 닿는 순간에 맞춰 누르면 더 높이 (콤보!).
  // 놓치면 콤보가 끊기고 높이가 줄어든다. 콤보 5부터는 공중제비
  const TRAMP = [
    '.KXXXXXXXXXXXXXXXXXXXXXXK.',
    'KBBBBBBBBBBBBBBBBBBBBBBBBK',
    'KbHbbbbbbbbbbbbbbbbbbbbHbK',
    '.KKKKKKKKKKKKKKKKKKKKKKKK.',
    '..KgK................KgK..',
    '.KgK..................KgK.',
    'KKKK..................KKKK',
  ];
  const TRAMP_WIN = 190; // 발이 닿기 전후 이 ms 안에 누르면 성공
  C.trampoline = {
    cursor: true,
    start(o) {
      Object.assign(o, { tx: catX, combo: 0, height: 0, lastClick: 0, landAt: 0, boosted: false, falling: false, missed: 0 });
      o.height = baseHeight();
      // 폴짝 올라탄다
      catVy = -Math.sqrt(2 * 1500 * o.height);
      catLift = matLift();
      placeCat();
      sprite.setToyPose('toyTramp');
    },
    down(o) {
      const now = performance.now();
      o.lastClick = now;
      // 방금 착지했으면 (착지 뒤 늦게 누른 것도 봐준다) 바로 더 높이
      if (!o.boosted && now - o.landAt < TRAMP_WIN && o.landAt) boost(o, now, now - o.landAt < 90 ? 'PERFECT' : 'GOOD');
    },
    click() {},
    step(o, dt, now) {
      commonStep(o, dt, now);
      sprite.setMove(0);
      const base = matLift();
      catX = o.tx;
      // 떨어지다가 매트에 닿았다 (pet.js 의 중력이 바닥까지 내렸어도 매트 높이에서 받는다)
      if (o.falling && catLift <= base) {
        o.falling = false;
        o.landAt = now;
        o.boosted = false;
        G.squash = 1;
        // 착지 직전에 미리 눌렀으면 성공
        if (now - o.lastClick < TRAMP_WIN) boost(o, now, now - o.lastClick < 90 ? 'PERFECT' : 'GOOD');
        else bounce(o);
        catLift = base + 1;
        sfx('pop', 0.015);
      }
      // 착지 뒤 창이 지나도록 못 눌렀으면 콤보 끊김
      if (o.landAt && !o.boosted && !o.missed && now - o.landAt > TRAMP_WIN) {
        o.missed = now;
        if (o.combo >= 3) pop(o, 'MISS', catX, ground() - catH() - catLift - 20, '#ff9a9a', 600);
        o.combo = 0;
      }
      if (catVy > 0) o.falling = true;
      if (catLift < base && !o.falling) catLift = base;
      G.squash = Math.max(0, G.squash - dt * 6);
      // 높이 뜬 동안의 공중제비 (콤보 5부터)
      const air = o.height > 0 ? clamp((catLift - base) / o.height, 0, 1) : 0;
      G.flip = o.combo >= 5 && catVy !== 0 ? (catVy < 0 ? (1 - air) * 0.5 : 0.5 + (1 - air) * 0.5) : 0;
      placeCat();
      face(mouseX);
      return true;
    },
    end() {
      G.flip = G.squash = 0;
      sprite.setToyPose(null);
    },
    draw(ctx, o, D, now) {
      const d = dotPx();
      const gy = ground();
      // 매트가 눌리면 가운데가 한 칸 내려간다 (검은 매트 줄과 앞 테두리가 같이)
      const sag = now - o.landAt < 120 ? 1 : 0;
      const y0 = gy - (TRAMP.length * d) / 2;
      if (!sag) FT.stampAt(ctx, TRAMP, o.tx, y0, d, PAL);
      else {
        FT.stampAt(ctx, TRAMP.map((r, j) => (j < 3 ? r.slice(0, 5) + '.'.repeat(16) + r.slice(21) : r)), o.tx, y0, d, PAL);
        FT.stampAt(ctx, TRAMP.slice(0, 3).map((r) => r.slice(5, 21)), o.tx, gy - (TRAMP.length - 1.5) * d + d, d, PAL);
      }
      const top = gy - catH() - catLift - 10 * D;
      if (o.combo > 1) big(ctx, String(o.combo), catX, top, D, o.combo >= 5 ? '#ffd35c' : '#ffffff');
      ftext(ctx, `BEST ${REC().trampoline || 0}`, o.tx + (o.tx > window.innerWidth / 2 ? -1 : 1) * cell() * 26, gy - 3 * d, D, '#ffffff');
      commonDraw(ctx, o, D, now);
    },
  };
  // 매트 위에 선 고양이의 높이: 발이 앞 테두리 뒤로 두 줄 들어간다
  const matLift = () => (TRAMP.length - 2) * dotPx();
  const baseHeight = () => cell() * 10;
  const maxHeight = () => Math.max(baseHeight(), window.innerHeight - cell() * 34);
  function bounce(o) {
    // 그냥 튀면 점점 낮아진다 (바닥 높이까지)
    o.height = Math.max(baseHeight(), o.height * 0.7);
    catVy = -Math.sqrt(2 * 1500 * o.height);
  }
  function boost(o, now, word) {
    o.boosted = true;
    o.missed = 0;
    o.combo++;
    o.height = Math.min(maxHeight(), baseHeight() * (1 + 0.45 * o.combo));
    catVy = -Math.sqrt(2 * 1500 * o.height);
    catLift = Math.max(catLift, matLift() + 1);
    pop(o, word, catX + (Math.random() < 0.5 ? -1 : 1) * cell() * 14, ground() - catH() * 0.8 - catLift, word === 'PERFECT' ? '#ffd35c' : '#9fe3c8', 600);
    sfx(o.combo % 5 === 0 ? 'win' : 'spin', 0.02);
    if (best('trampoline', o.combo) && o.combo >= 3) pop(o, 'NEW BEST', o.tx, ground() - catH() - catLift - 30, '#9fe3c8', 900);
    if (o.combo % 5 === 0) played();
    void now;
  }

  // ---------- 놀이 자세 ----------
  const TP = {
    // 두더지: 구멍 속에서 G.sink 칸만큼 내려가 있다. 구멍 입구(바닥 두 줄 위) 아래로는 잘린다
    toyMole: {
      len: 1, loop: true,
      pose(p, k, at) {
        p.dy = Math.round(G.sink);
        p.clipY = GROUND - 2;
        p.noShadow = true;
        p.noTail = true;
        p.lookX = G.look;
        const st = toy && toy.key === 'whackcat' ? toy.state : '';
        if (st === 'bonk') {
          p.eyes = 'x'; p.mouth = 'wavy'; p.ear = -1;
        } else if (st === 'up' || st === 'rise') {
          p.eyes = 'wide'; p.mouth = Math.floor(at * 3) % 3 === 0 ? 'blep' : 'grin'; p.ear = 1;
        } else if (st === 'show') {
          p.eyes = 'happy'; p.mouth = 'open'; p.armL = p.armR = 'cheer'; p.ear = 1;
        }
      },
    },
    // 가위바위보: 앞발을 까딱까딱 흔들다가(shake) 낸다
    toyRps: {
      len: 1, loop: true,
      pose(p, k, at) {
        p.ear = 1;
        p.tail = 'wag';
        if (G.paw === 'shake') {
          p.armR = Math.floor(at * 6) % 2 ? 'up' : 'cheer';
          p.eyes = 'squint'; p.mouth = 'flat'; p.brow = 'angry';
        } else if (G.paw) {
          p.armR = 'point';
          p.eyes = 'wide'; p.mouth = 'o';
        } else {
          p.eyes = 'open'; p.mouth = 'smile';
          p.armL = p.armR = 'knead';
        }
      },
    },
    // 줄다리기: 앞발로 줄을 꽉 잡고 뒤로 버틴다. 밀리면 몸이 앞으로 쏠리고 식은땀
    toyTug: {
      len: 1, loop: true,
      pose(p, k, at) {
        p.armL = p.armR = 'hold';
        // 사람 반대쪽으로 몸을 젖힌다 (xf 는 화면 기준이라 사람이 어느 쪽인지로 부호를 정한다). 밀리면 앞으로 쏠린다
        // 너무 기울이면 도트가 깨져 보인다. 살짝만
        p.xf = { rot: -G.side * ((0.06 + 0.03 * G.strain) - 0.1 * Math.max(0, -G.lean)), py: GROUND };
        p.eyes = G.lean < -0.5 ? 'squint' : 'open';
        p.mouth = G.lean < -0.5 ? 'wavy' : 'grin';
        p.brow = 'angry';
        p.ear = -1;
        p.tail = 'flick';
        if (G.lean < -0.4) p.sweat = true;
        p.step = G.strain > 1.2 ? (at * 3) % 1 : null; // 세게 당길 땐 뒷발로 버틴다
      },
    },
    // 트램펄린: 착지하면 찌그러지고, 떠 있으면 만세. 콤보 5부터 공중제비
    toyTramp: {
      len: 1, loop: true,
      pose(p, k, at, r) {
        p.noShadow = true;
        if (G.squash > 0.3) {
          p.xf = { sx: 1 + 0.18 * G.squash, sy: 1 - 0.2 * G.squash, py: GROUND };
          p.eyes = 'squint'; p.mouth = 'grin'; p.ear = -1;
          return;
        }
        p.armL = p.armR = 'cheer';
        p.eyes = 'happy'; p.mouth = 'open'; p.ear = 1; p.tail = 'up';
        if (G.flip) p.xf = { rot: G.flip * Math.PI * 2 * (r ? r.facing : 1), px: 24, py: 30 };
      },
    },
  };
  root.PetSprite.TOY_POSES = Object.assign(root.PetSprite.TOY_POSES || {}, TP);
  root.TOY_CUSTOM = Object.assign(root.TOY_CUSTOM || {}, C);
})(window);
