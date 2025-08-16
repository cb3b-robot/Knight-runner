export const SIZE = 8;
export const els = {
  root: document.documentElement,
  game: document.getElementById('game'),
  score: document.getElementById('score'),
  speed: document.getElementById('speed'),
  bShield: document.getElementById('bShield'),
  bSpeed: document.getElementById('bSpeed'),
  bSlow: document.getElementById('bSlow'),
  muteBtn: document.getElementById('muteBtn'),
  lbList: document.getElementById('lbList'),
  resetScores: document.getElementById('resetScores'),
  toggleLB: document.getElementById('toggleLB'),
};

export const state = {
  running: true,
  speedMult: 1.0,
  slowFactor: 1.0,
  slowUntil: 0,
  shield: 0,
  speedMoves: 0,
  enemies: [],
  powerups: [],
  knight: { x: 3, y: 6 },
  timers: { spawn: null, diff: null },
  startTime: performance.now(),
  lastTime: performance.now(),
};

export const GLYPHS = (() => {
  const VS = '\uFE0E';
  return { knight:'♞'+VS, pawn:'♟'+VS, rook:'♜'+VS, bishop:'♝'+VS, queen:'♛'+VS };
})();
export const CELL = () => els.game.getBoundingClientRect().width / SIZE;
export const clampCell = (n)=> Math.max(0, Math.min(SIZE-1, n|0));
