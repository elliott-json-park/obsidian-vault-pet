// 8비트 효과음. 파일 없이 WebAudio 사각파로 만든다.
(function (global) {
  let ctx = null;

  const NOTES = { C4: 261.63, E4: 329.63, G4: 392, A4: 440, C5: 523.25, F5: 698.46, B5: 987.77, D6: 1174.66, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1567.98 };

  const SONGS = {
    levelup: [['C5', 0.08], ['E5', 0.08], ['G5', 0.08], ['C6', 0.18]],
    achieve: [['G5', 0.07], ['C6', 0.07], ['E6', 0.07], ['G6', 0.22]],
    quest: [['E5', 0.07], ['A5', 0.14]],
    evolve: [['C5', 0.06], ['D5', 0.06], ['E5', 0.06], ['G5', 0.06], ['A5', 0.06], ['C6', 0.06], ['E6', 0.06], ['G6', 0.3]],
    pop: [['A5', 0.04]],
    jingle: [['E6', 0.03], ['G6', 0.05]], // 방울공이 구를 때
    bubble: [['G6', 0.025]], // 비눗방울이 톡
    squeak: [['G6', 0.03], ['E6', 0.04]], // 쥐돌이가 찍
    // 2차 장난감
    tick: [['E6', 0.015]], // 수류탄 타이머·줄넘기·타자
    boom: [['G4', 0.05], ['C4', 0.08], ['E4', 0.06], ['C4', 0.22]], // 수류탄 펑
    bonk: [['C6', 0.03], ['G4', 0.07]], // 뿅망치·눈덩이 퍽
    splash: [['D6', 0.02], ['B5', 0.02], ['G5', 0.03]], // 물총
    spin: [['C5', 0.025], ['E5', 0.025], ['G5', 0.025], ['C6', 0.03]], // 레버·부스터·빔
    win: [['C5', 0.06], ['E5', 0.06], ['G5', 0.06], ['C6', 0.06], ['G5', 0.06], ['C6', 0.06], ['E6', 0.24]], // 잭팟
    lose: [['G5', 0.1], ['F5', 0.1], ['E5', 0.1], ['C5', 0.26]], // 꽝
  };

  function play(name, volume = 0.05) {
    const song = SONGS[name];
    if (!song) return;
    ctx = ctx || new AudioContext();
    let t = ctx.currentTime + 0.02;
    for (const [note, len] of song) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = NOTES[note];
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + len + 0.02);
      t += len * 0.9;
    }
  }

  global.PetSound = { play };
})(window);
