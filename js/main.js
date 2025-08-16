// js/main.js — Knight Runner (single-file build; no imports)
// Renders board/pieces even without CSS (inline sizing/styles).
// Avoids "unexpected '=' after dur" by not using destructured defaults.

'use strict';

/* ===================== DOM refs ===================== */
const els = {
  game: document.getElementById('game'),
  score: document.getElementById('score'),
  speed: document.getElementById('speed'),
  muteBtn: document.getElementById('muteBtn'),
  bShield: document.getElementById('bShield'),
  bSpeed: document.getElementById('bSpeed'),
  bSlow: document.getElementById('bSlow'),
  lbList: document.getElementById('lbList'),
  toggleLB: document.getElementById('toggleLB'),
  resetScores: document.getElementById('resetScores'),
  leaderboard: document.getElementById('leaderboard'),
  hud: document.querySelector('.hud'),
};
const root = document.documentElement;
const SIZE = 8;

/* ===================== Cell size helpers ===================== */
function HUD_HEIGHT(){ return els.hud ? els.hud.getBoundingClientRect().height : 0; }
function CELL(){
  const v = parseFloat(getComputedStyle(root).getPropertyValue('--cell'));
  if (!isNaN(v) && v > 0) return v;
  const r = els.game.getBoundingClientRect();
  if (r.width && r.height) return Math.min(r.width, r.height) / SIZE;
  return Math.min(window.innerWidth||600, (window.innerHeight||600)-HUD_HEIGHT()) * 0.92 / SIZE;
}
function setBoardVars(){
  const c = CELL(); const size = c*SIZE;
  root.style.setProperty('--board', size + 'px');
  root.style.setProperty('--cell', c + 'px');
}

/* ===================== Responsive sizing ===================== */
function installSizing(){
  function setBoardSize(){
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth  || document.documentElement.clientWidth;
    const hudH = HUD_HEIGHT();
    const size = Math.floor(Math.min(Math.max(260, vh - hudH - 24), Math.max(260, vw - 16)));
    root.style.setProperty('--board', size + 'px');
    root.style.setProperty('--cell', (size / SIZE) + 'px');
  }
  window.addEventListener('resize', setBoardSize, {passive:true});
  window.addEventListener('orientationchange', ()=>setTimeout(setBoardSize,120), {passive:true});
  if (!getComputedStyle(root).getPropertyValue('--board').trim()){
    root.style.setProperty('--board', '92vmin');
    root.style.setProperty('--cell', `calc(92vmin / ${SIZE})`);
  }
  setBoardSize(); setTimeout(setBoardSize,200); setTimeout(setBoardSize,800);
}

/* ===================== Audio (SFX + music) ===================== */
const MUTE_KEY = 'KR_mute';
let audio = { ctx:null, enabled:true, unlocked:false };
try{ audio.enabled = localStorage.getItem(MUTE_KEY)!=='true'; }catch{}
function ensureAudio(){ if (!audio.ctx) audio.ctx = new (window.AudioContext||window.webkitAudioContext)(); }
function unlockAudio(){
  ensureAudio(); if (audio.unlocked) return;
  const s = audio.ctx.createBufferSource();
  s.buffer = audio.ctx.createBuffer(1,1,22050);
  s.connect(audio.ctx.destination);
  try{ s.start(0); }catch{}
  audio.unlocked = true; Music.start();
}
function now(){ ensureAudio(); return audio.ctx.currentTime; }

// No destructured defaults (older engines safe)
function tone(opts){
  if (!audio.enabled) return;
  opts = opts || {};
  const freq      = (opts.freq != null) ? opts.freq : 440;
  const type      = opts.type || 'sine';
  const dur       = (opts.dur  != null) ? opts.dur  : 0.12;
  const gainVal   = (opts.gain != null) ? opts.gain : 0.05;
  const attack    = (opts.attack  != null) ? opts.attack  : 0.002;
  const release   = (opts.release != null) ? opts.release : 0.08;
  const slideTo   = (opts.slideTo != null) ? opts.slideTo : null;
  const slideTime = (opts.slideTime != null) ? opts.slideTime : 0.08;

  ensureAudio();
  const t0 = now();
  const osc = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  const f = audio.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=8000;

  osc.type = type; osc.frequency.value=freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gainVal, t0+attack);
  if (slideTo != null){
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.linearRampToValueAtTime(slideTo, t0+slideTime);
  }
  g.gain.setValueAtTime(gainVal, t0+dur);
  g.gain.linearRampToValueAtTime(0.0001, t0+dur+release);

  osc.connect(f); f.connect(g); g.connect(audio.ctx.destination);
  osc.start(t0); osc.stop(t0+dur+release+0.02);
}
const SFX = {
  jump(){ tone({freq:600,type:'square',gain:0.045,attack:0.003,release:0.08, slideTo:760, slideTime:0.06}); },
  pickupShield(){ tone({freq:520,type:'triangle',gain:0.05,attack:0.004,release:0.12}); tone({freq:780,type:'triangle',gain:0.04,attack:0.004,release:0.12, slideTo:880, slideTime:0.08}); },
  pickupSpeed(){ tone({freq:750,type:'square',gain:0.05,attack:0.003,release:0.09}); },
  pickupSlow(){ tone({freq:420,type:'sine',gain:0.05,attack:0.003,release:0.18, slideTo:320, slideTime:0.14}); },
  pickupClear(){ tone({freq:300,type:'sawtooth',gain:0.06,attack:0.004,release:0.18, slideTo:120, slideTime:0.2}); },
  spawnPower(){ tone({freq:880,type:'triangle',gain:0.035,attack:0.002,release:0.06}); },
  shieldHit(){ tone({freq:180,type:'square',gain:0.07,attack:0.002,release:0.2}); },
  gameOver(){ tone({freq:440,type:'sawtooth',gain:0.06,attack:0.004,release:0.25, slideTo:180, slideTime:0.25}); },
  restart(){ tone({freq:660,type:'triangle',gain:0.05,attack:0.003,release:0.12, slideTo:880, slideTime:0.08}); }
};

const Music = (() => {
  let master, padGain, arpGain, delay, feedback, lowpass, timer=null, step=0, playing=false;
  function init(){
    ensureAudio(); if (master) return;
    master = audio.ctx.createGain(); padGain = audio.ctx.createGain(); arpGain = audio.ctx.createGain();
    delay = audio.ctx.createDelay(1.0); delay.delayTime.value=0.22;
    feedback = audio.ctx.createGain(); feedback.gain.value=0.25;
    lowpass = audio.ctx.createBiquadFilter(); lowpass.type='lowpass'; lowpass.frequency.value=2000;
    master.gain.value = audio.enabled ? 0.18 : 0.0;
    padGain.gain.value=0.35; arpGain.gain.value=0.45;
    const bus = audio.ctx.createGain();
    padGain.connect(bus); arpGain.connect(bus); bus.connect(lowpass);
    lowpass.connect(delay); delay.connect(feedback); feedback.connect(delay);
    delay.connect(master); lowpass.connect(master); master.connect(audio.ctx.destination);
  }
  function mtof(n){ return 440*Math.pow(2,(n-69)/12); }
  function playNote(opts){
    if (!audio.enabled) return;
    opts = opts || {};
    const freq   = opts.freq;
    const when   = (opts.when != null) ? opts.when : now();
    const dur    = (opts.dur  != null) ? opts.dur  : 0.22;
    const type   = opts.type || 'triangle';
    const gainV  = (opts.gain != null) ? opts.gain : 0.18;
    const target = opts.target || arpGain;
    const osc=audio.ctx.createOscillator(), g=audio.ctx.createGain();
    osc.type=type; osc.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,when);
    g.gain.linearRampToValueAtTime(gainV,when+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,when+dur);
    osc.connect(g); g.connect(target); osc.start(when); osc.stop(when+dur+0.02);
  }
  function playPad(opts){
    if (!audio.enabled) return;
    opts = opts || {};
    const freq = opts.freq;
    const when = (opts.when != null) ? opts.when : now();
    const dur  = (opts.dur  != null) ? opts.dur  : 3.8;
    const gAmt = (opts.gain != null) ? opts.gain : 0.10;
    const o1=audio.ctx.createOscillator(), o2=audio.ctx.createOscillator(), g=audio.ctx.createGain();
    o1.type='sine'; o2.type='sine'; o1.frequency.value=freq; o2.frequency.value=freq*Math.pow(2, 7/1200);
    g.gain.setValueAtTime(0.0001,when);
    g.gain.linearRampToValueAtTime(gAmt,when+0.8);
    g.gain.linearRampToValueAtTime(0.0001,when+dur);
    o1.connect(g); o2.connect(g); g.connect(padGain);
    o1.start(when); o2.start(when); o1.stop(when+dur+0.1); o2.stop(when+dur+0.1);
  }
  const roots=[57,53,60,55]; const arpPattern=[0,7,12,7,0,7,12,14]; const stepDur=0.5;
  function tick(){
    if (!playing || !audio.enabled) return;
    const t=now(); const bar=Math.floor(step/4); const root=roots[Math.floor(bar%roots.length)];
    if (step%4===0){ playPad({freq:mtof(root),when:t+0.01,dur:3.8}); playPad({freq:mtof(root+7),when:t+0.01,dur:3.8,gain:0.08}); }
    const intv=arpPattern[step%arpPattern.length];
    playNote({freq:mtof(root+intv),when:t+0.02,dur:0.24,type:'triangle',gain:0.18});
    step++;
  }
  function start(){ init(); if (playing) return; playing=true; tick(); timer=setInterval(()=>tick(), stepDur*1000); }
  function stop(){ if (!playing) return; playing=false; if (timer){clearInterval(timer); timer=null;} }
  function setEnabled(on){ init(); master.gain.value = on?0.18:0.0; }
  return { start, stop, setEnabled };
})();
function applyMuteUI(){
  if (!els.muteBtn) return;
  els.muteBtn.textContent = audio.enabled ? '🔊' : '🔇';
  els.muteBtn.setAttribute('aria-pressed', String(!audio.enabled));
  Music.setEnabled(audio.enabled);
}
if (els.muteBtn){
  els.muteBtn.addEventListener('click', ()=>{ unlockAudio(); audio.enabled=!audio.enabled; try{localStorage.setItem(MUTE_KEY, String(!audio.enabled));}catch{} applyMuteUI(); });
}
['pointerdown','keydown'].forEach(evt=>document.addEventListener(evt, unlockAudio, {once:true}));
applyMuteUI();

/* ===================== Leaderboard (local) ===================== */
const LS_KEY = 'knightRunnerTopScores_v1';
function loadScores(){ try{const raw=localStorage.getItem(LS_KEY);const a=raw?JSON.parse(raw):[];return Array.isArray(a)?a:[]}catch{ return [] } }
function saveScores(arr){ try{localStorage.setItem(LS_KEY, JSON.stringify(arr));}catch{} }
function addScore(name, score){
  const list = loadScores();
  list.push({ name:(name||'Player').trim(), score:+score, ts:Date.now() });
  list.sort((a,b)=> b.score - a.score || a.ts - b.ts);
  const top = list.slice(0,50); saveScores(top); return top;
}
function renderLeaderboard(myName=null, myScore=null){
  if (!els.lbList) return;
  els.lbList.innerHTML='';
  const list = loadScores();
  if(list.length===0){
    const li=document.createElement('li'); const a=document.createElement('div'); a.className='name'; a.textContent='No scores yet';
    const b=document.createElement('div'); b.className='score'; b.textContent='—';
    els.lbList.appendChild(li); els.lbList.appendChild(a); els.lbList.appendChild(b); return;
  }
  list.forEach((e,i)=>{
    const li=document.createElement('li');
    const name=document.createElement('div'); name.className='name'; name.textContent=`${i+1}. ${e.name}`;
    const sc=document.createElement('div'); sc.className='score'; sc.textContent=`${e.score.toFixed(1)}s`;
    if(myName && myScore!=null && e.name===myName && Math.abs(e.score-myScore)<1e-6){ name.style.color='#2ecc71'; sc.style.color='#2ecc71'; }
    els.lbList.appendChild(li); els.lbList.appendChild(name); els.lbList.appendChild(sc);
  });
}
renderLeaderboard();
if (els.toggleLB){
  els.toggleLB.addEventListener('click', ()=>{
    const expanded = !els.leaderboard.classList.contains('expanded');
    els.leaderboard.classList.toggle('expanded', expanded);
    els.toggleLB.textContent = expanded ? 'Show less' : 'Show more';
  });
}
if (els.resetScores){
  els.resetScores.addEventListener('click', ()=>{
    if (confirm('Clear all saved scores on this device?')){ localStorage.removeItem(LS_KEY); renderLeaderboard(); }
  });
}

/* ===================== Build chessboard (SAFE: only squares) ===================== */
function buildBoard(){
  const cell = CELL(); const size = cell * SIZE;
  els.game.style.position = 'relative';
  els.game.style.width  = size + 'px';
  els.game.style.height = size + 'px';

  // Remove ONLY existing squares (keep knight, enemies, dots, guide)
  els.game.querySelectorAll('.square').forEach(n => n.remove());

  // Rebuild squares
  for (let y = 0; y < SIZE; y++){
    for (let x = 0; x < SIZE; x++){
      const sq = document.createElement('div');
      sq.className = 'square ' + ((x + y) % 2 ? 'dark' : 'light');
      Object.assign(sq.style, {
        position: 'absolute',
        left: (x * cell) + 'px',
        top:  (y * cell) + 'px',
        width: cell + 'px',
        height: cell + 'px',
        background: ((x + y) % 2 ? '#b58863' : '#f0d9b5')
      });
      els.game.appendChild(sq);
    }
  }
}

/* ===================== Knight, Dots & Guide ===================== */
const GLYPHS = {
  knight:'\u265E\uFE0E', // ♞ (rendered white via CSS/inline color)
  pawn:'\u265F\uFE0E',   // ♟
  rook:'\u265C\uFE0E',   // ♜
  bishop:'\u265D\uFE0E', // ♝
  queen:'\u265B\uFE0E'   // ♛
};
let state = {
  running: true,
  startTime: performance.now(),
  lastTime: performance.now(),
  speedMult: 1.0,
  slowFactor: 1.0,
  slowUntil: 0,
  shield: 0,
  speedMoves: 0,
  enemies: [],
  powerups: [],
  knight: { x:3, y:6 },
  timers: {}
};

let knightEl = null;
function ensureKnightEl(){
  if (knightEl && knightEl.isConnected) return knightEl;
  knightEl = document.createElement('div');
  knightEl.className = 'piece knight';
  knightEl.textContent = GLYPHS.knight;
  els.game.appendChild(knightEl);
  return knightEl;
}
function styleKnightInline(){
  const c = CELL();
  Object.assign(knightEl.style, {
    position: 'absolute',
    width: c + 'px',
    height: c + 'px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: (c * 0.86) + 'px',
    color: '#fff',
    textShadow: '0 2px 6px rgba(0,0,0,0.7)',
    zIndex: '110',
    pointerEvents: 'none',
    userSelect: 'none'
  });
}
function placeKnight(){
  ensureKnightEl();
  styleKnightInline();
  const c = CELL();
  knightEl.style.left = (state.knight.x*c)+'px';
  knightEl.style.top  = (state.knight.y*c)+'px';
}

/* SVG Guide (two-step arrow) */
const svgNS = 'http://www.w3.org/2000/svg';
const guide = document.createElementNS(svgNS, 'svg');
guide.setAttribute('id','guideLayer');
function setGuideViewBox(){ const c = CELL(); guide.setAttribute('viewBox', `0 0 ${c*SIZE} ${c*SIZE}`); }
setGuideViewBox();
els.game.appendChild(guide);
const defs = document.createElementNS(svgNS,'defs');
function mkMarker(id,color){
  const m=document.createElementNS(svgNS,'marker'); m.setAttribute('id',id); m.setAttribute('markerWidth','10'); m.setAttribute('markerHeight','10');
  m.setAttribute('refX','6'); m.setAttribute('refY','3'); m.setAttribute('orient','auto-start-reverse');
  const p=document.createElementNS(svgNS,'path'); p.setAttribute('d','M0,0 L6,3 L0,6 Z'); p.setAttribute('fill',color);
  m.appendChild(p); return m;
}
defs.appendChild(mkMarker('headPrimary','#2ecc71'));
defs.appendChild(mkMarker('headHint','#00d2ff'));
defs.appendChild(mkMarker('headInvalid','#e74c3c'));
guide.appendChild(defs);
function clearGuide(){ while (guide.lastChild && guide.lastChild!==defs) guide.removeChild(guide.lastChild); }

/* Knight move dots */
const knightOffsets = [
  {x:2,y:1},{x:2,y:-1},{x:-2,y:1},{x:-2,y:-1},
  {x:1,y:2},{x:1,y:-2},{x:-1,y:2},{x:-1,y:-2}
];
let dots=[];
function updateDots(){
  dots.forEach(d=>d.remove()); dots=[];
  if (!state.running) return;
  const cell = CELL();
  for (const o of knightOffsets){
    const tx=state.knight.x+o.x, ty=state.knight.y+o.y;
    if (tx<0||tx>=SIZE||ty<0||ty>=SIZE) continue;

    const dot=document.createElement('div');
    dot.className='dot';
    Object.assign(dot.style, {
      position: 'absolute',
      left: (tx*cell)+'px',
      top:  (ty*cell)+'px',
      width: cell+'px',
      height: cell+'px',
      zIndex: '120',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    const inner=document.createElement('span');
    Object.assign(inner.style, {
      width: (cell*0.24)+'px',
      height: (cell*0.24)+'px',
      borderRadius: '50%',
      background: '#2ecc71',
      boxShadow: '0 0 0 3px rgba(46,204,113,0.27), 0 2px 6px rgba(0,0,0,0.44)'
    });
    dot.appendChild(inner);

    dot.addEventListener('click', ()=> moveKnightTo(tx,ty));

    els.game.appendChild(dot); dots.push(dot);
  }
}

/* ===================== Power-ups ===================== */
const POWER_TYPES = ['shield','speed','slow','clear'];
const POWER_GLYPH = { shield:'🛡', speed:'⚡', slow:'🕒', clear:'💥' };

function spawnPowerUp(){
  let tries = 20;
  const cell = CELL();
  while (tries-- > 0){
    const x = Math.floor(Math.random()*SIZE);
    const y = Math.floor(Math.random()*(SIZE-1));
    if (x === state.knight.x && y === state.knight.y) continue;
    if (state.enemies.some(e => Math.round(e.px/cell) === x && Math.round(e.py/cell) === y)) continue;

    const type = POWER_TYPES[Math.floor(Math.random()*POWER_TYPES.length)];
    const el = document.createElement('div');
    el.className = 'power';
    Object.assign(el.style, {
      position:'absolute',
      left: (x*cell)+'px',
      top:  (y*cell)+'px',
      width: cell+'px',
      height: cell+'px',
      zIndex: '80',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      pointerEvents:'none'
    });
    el.innerHTML = `<div class="glyph">${POWER_GLYPH[type]}</div><div class="ring"></div>`;
    els.game.appendChild(el);

    const expiresAt = performance.now() + 5500;
    state.powerups.push({ el, type, x, y, expiresAt });
    SFX.spawnPower();
    break;
  }
}
function pickupAt(x,y){
  for (let i = state.powerups.length - 1; i >= 0; i--){
    const p = state.powerups[i];
    if (p.x === x && p.y === y){
      applyPower(p.type, x, y);
      if (p.el){ p.el.classList.add('fade'); setTimeout(()=>p.el && p.el.remove(), 450); }
      state.powerups.splice(i, 1);
    }
  }
}
function applyPower(type,x,y){
  sparkle(x,y);
  if (type === 'shield'){ state.shield = 1; els.bShield && els.bShield.classList.add('active'); SFX.pickupShield(); }
  if (type === 'speed'){ state.speedMoves = 3; els.bSpeed  && els.bSpeed.classList.add('active'); SFX.pickupSpeed(); }
  if (type === 'slow'){  state.slowUntil = performance.now()+5000; state.slowFactor = 0.5; els.bSlow && els.bSlow.classList.add('active'); SFX.pickupSlow(); }
  if (type === 'clear'){ state.enemies.forEach(e=>e.el.remove()); state.enemies = []; SFX.pickupClear(); }
}
function sparkle(x,y){
  const cell = CELL();
  for (let i=0;i<6;i++){
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.style.left = `${x*cell + cell*0.37 + Math.random()*cell*0.26}px`;
    s.style.top  = `${y*cell + cell*0.37 + Math.random()*cell*0.26}px`;
    s.style.background = i%2? '#2ecc71' : '#fff';
    els.game.appendChild(s);
    setTimeout(()=>s.remove(), 600);
  }
}

/* ===================== Enemies ===================== */
const BASE_SPEED = { pawn:1.15, bishop:2.20, rook:3.00, queen:1.35 }; // cells/sec
function spawnEnemy(){
  const r=Math.random();
  const type = (r>0.85)?'queen' : (r>0.65)?'rook' : (r>0.40)?'bishop' : 'pawn';
  const x=Math.floor(Math.random()*SIZE), y=-1;

  const c = CELL();
  const el=document.createElement('div');
  el.className='piece enemy';
  el.textContent=GLYPHS[type];

  // Inline styles so they show even without CSS
  Object.assign(el.style, {
    position: 'absolute',
    width: c + 'px',
    height: c + 'px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: (c * 0.78) + 'px',
    color: '#000',
    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.6))',
    zIndex: '90',
    pointerEvents: 'none',
    userSelect: 'none',
    left: (x*c) + 'px',
    top:  (y*c) + 'px'
  });

  els.game.appendChild(el);

  const px=x*c, py=y*c;

  if (type==='queen'){
    const e={el,type,px,py,qx:x,qy:y,qtx:x,qty:0,qtpX:x*c,qtpY:0,stepSpeed:BASE_SPEED.queen};
    pickNextQueenTarget(e); e.qtpX=e.qtx*c; e.qtpY=e.qty*c;
    state.enemies.push(e); return;
  }
  if (type==='bishop'){
    const dirX=(Math.random()<0.5)?-1:1;
    const e={el,type,px,py,bx:x,by:y,bdir:dirX,btx:x+dirX,bty:0,btpX:(x+dirX)*c,btpY:0,stepSpeed:BASE_SPEED.bishop};
    if (e.btx<0||e.btx>=SIZE){ e.bdir=-e.bdir; e.btx=e.bx+e.bdir; e.btpX=e.btx*c; }
    state.enemies.push(e); return;
  }
  // pawns/rooks
  const vxCells=0;
  const vyCells=(type==='rook')? BASE_SPEED.rook : BASE_SPEED.pawn;
  const e={el,type,px,py,vxCells,vyCells};
  state.enemies.push(e);
}
function pickNextQueenTarget(e){
  const cx=e.qx, cy=e.qy, ny=cy+1; const options=[];
  for (let dx=-1; dx<=1; dx++){ const nx=cx+dx; if (nx>=0&&nx<SIZE) options.push(nx); }
  const nx=options.length? options[(Math.random()*options.length)|0] : cx; e.qtx=nx; e.qty=ny;
}
function pickNextBishopTarget(e){
  const cx=e.bx, cy=e.by; let nx=cx+e.bdir; const ny=cy+1;
  if (nx<0||nx>=SIZE){ e.bdir=-e.bdir; nx=cx+e.bdir; }
  e.btx=nx; e.bty=ny;
}
function stepEnemies(dt){
  const dtSec=dt/1000, nowT=performance.now();
  // expire powerups (safe even if el already gone)
  for (let i = state.powerups.length - 1; i >= 0; i--){
    const p = state.powerups[i];
    if (!p){ state.powerups.splice(i,1); continue; }
    if (nowT > p.expiresAt){
      if (p.el){ p.el.classList.add('fade'); setTimeout(()=>p.el && p.el.remove(), 450); }
      state.powerups.splice(i,1);
    }
  }
  if (state.slowUntil && nowT>state.slowUntil){ state.slowUntil=0; state.slowFactor=1.0; els.bSlow && els.bSlow.classList.remove('active'); }
  els.speed && (els.speed.textContent = (state.speedMult*(state.slowFactor||1)).toFixed(1)+'×');
  const mult=state.speedMult*(state.slowFactor||1);
  const cell=CELL(), maxX=(SIZE-1)*cell;

  for (let i=state.enemies.length-1;i>=0;i--){
    const e=state.enemies[i];
    if (e.type==='queen'){
      const speedPx=e.stepSpeed*cell*mult, dx=e.qtpX-e.px, dy=e.qtpY-e.py;
      const dist=Math.hypot(dx,dy), step=speedPx*dtSec;
      if (dist<=step || dist===0){
        e.px=e.qtpX; e.py=e.qtpY; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px';
        e.qx=e.qtx; e.qy=e.qty; if (e.qy>=SIZE){ e.el.remove(); state.enemies.splice(i,1); continue; }
        pickNextQueenTarget(e); e.qtpX=e.qtx*cell; e.qtpY=e.qty*cell;
      }else{ const ux=dx/dist, uy=dy/dist; e.px+=ux*step; e.py+=uy*step; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px'; }
    } else if (e.type==='bishop'){
      const speedPx=e.stepSpeed*cell*mult, dx=e.btpX-e.px, dy=e.btpY-e.py;
      const dist=Math.hypot(dx,dy), step=speedPx*dtSec;
      if (dist<=step || dist===0){
        e.px=e.btpX; e.py=e.btpY; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px';
        e.bx=e.btx; e.by=e.bty; if (e.by>=SIZE){ e.el.remove(); state.enemies.splice(i,1); continue; }
        pickNextBishopTarget(e); e.btpX=e.btx*cell; e.btpY=e.bty*cell;
      }else{ const ux=dx/dist, uy=dy/dist; e.px+=ux*step; e.py+=uy*step; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px'; }
    } else {
      // pawns & rooks
      const vx=(e.vxCells||0)*cell*mult, vy=(e.vyCells||0)*cell*mult;
      let newPx = e.px + vx*dtSec; if (newPx<0) newPx=0; if (newPx>maxX) newPx=maxX;
      e.px = newPx; e.py += vy*dtSec; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px';
    }

    // collision
    const ex=Math.round(e.px/cell), ey=Math.round(e.py/cell);
    if (ex===state.knight.x && ey===state.knight.y){
      if (state.shield>0){ state.shield=0; els.bShield && els.bShield.classList.remove('active'); e.el.remove(); state.enemies.splice(i,1); els.game.classList.add('shake'); setTimeout(()=>els.game.classList.remove('shake'),220); SFX.shieldHit(); }
      else { gameOver(); return; }
    }
    if (e.py>SIZE*cell){ e.el.remove(); state.enemies.splice(i,1); }
  }

  // danger glow if an enemy is one knight-move away
  let danger=false;
  for (const o of knightOffsets){
    const tx=state.knight.x+o.x, ty=state.knight.y+o.y;
    if (tx<0||tx>=SIZE||ty<0||ty>=SIZE) continue;
    if (state.enemies.some(e=>Math.round(e.px/cell)===tx && Math.round(e.py/cell)===ty)){ danger=true; break; }
  }
  if (knightEl) knightEl.classList.toggle('danger', danger);
}

/* ===================== Knight movement ===================== */
function moveKnightTo(tx,ty){
  if (tx<0||tx>=SIZE||ty<0||ty>=SIZE) return; // stay on board
  state.knight.x=tx; state.knight.y=ty; placeKnight();
  SFX.jump(); pickupAt(tx,ty); checkCollision(); updateDots(); clearGuide();
  if (state.speedMoves>0){ state.speedMoves--; if (state.speedMoves===0 && els.bSpeed) els.bSpeed.classList.remove('active'); }
}
function checkCollision(){
  const cell=CELL();
  const hit = state.enemies.find(e => Math.round(e.px/cell)===state.knight.x && Math.round(e.py/cell)===state.knight.y);
  if (hit){ if (state.shield>0){ state.shield=0; els.bShield && els.bShield.classList.remove('active'); hit.el.remove(); state.enemies=state.enemies.filter(e=>e!==hit); SFX.shieldHit(); } else gameOver(); }
}

// Two-step arrow keys
const DIRS = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
let arrowStep=0, firstArrow=null;
function drawFirstArrow(dir){
  clearGuide();
  const cell = CELL();
  const cx = state.knight.x*cell + cell/2;
  const cy = state.knight.y*cell + cell/2;
  const tx = state.knight.x + dir.x*2;
  const ty = state.knight.y + dir.y*2;
  const inside = (tx>=0 && tx<SIZE && ty>=0 && ty<SIZE);
  const ex = Math.max(0, Math.min((SIZE-1)*cell, tx*cell + cell/2));
  const ey = Math.max(0, Math.min((SIZE-1)*cell, ty*cell + cell/2));
  const prim = document.createElementNS(svgNS,'line');
  prim.setAttribute('x1', cx); prim.setAttribute('y1', cy);
  prim.setAttribute('x2', ex); prim.setAttribute('y2', ey);
  prim.setAttribute('class','ga-primary' + (inside ? '' : ' ga-invalid'));
  prim.setAttribute('marker-end', `url(#${inside?'headPrimary':'headInvalid'})`);
  guide.appendChild(prim);
  const label = document.createElementNS(svgNS,'text');
  label.setAttribute('x', ex + (dir.x===1? 10 : dir.x===-1? -10 : 0));
  label.setAttribute('y', ey + (dir.y===1? 18 : dir.y===-1? -10 : -12));
  label.setAttribute('text-anchor', dir.x===-1 ? 'end' : 'start');
  label.setAttribute('class','ga-label');
  label.textContent = inside ? 'then choose ⟂' : 'out of bounds';
  guide.appendChild(label);
  if (!inside){ els.game.classList.add('shake'); setTimeout(()=>els.game.classList.remove('shake'), 220); return; }
  const hints=[];
  if (dir.x!==0){ hints.push({hx:tx,hy:ty+1}); hints.push({hx:tx,hy:ty-1}); }
  else { hints.push({hx:tx+1,hy:ty}); hints.push({hx:tx-1,hy:ty}); }
  for (const h of hints){
    if (h.hx<0||h.hx>=SIZE||h.hy<0||h.hy>=SIZE) continue;
    const hx=h.hx*cell + cell/2, hy=h.hy*cell + cell/2;
    const line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1', ex); line.setAttribute('y1', ey);
    line.setAttribute('x2', hx); line.setAttribute('y2', hy);
    line.setAttribute('class','ga-hint'); line.setAttribute('marker-end','url(#headHint)');
    guide.appendChild(line);
  }
}
function processArrow(dir){
  if (arrowStep===0){ firstArrow=dir; arrowStep=1; drawFirstArrow(dir); return; }
  const dx2=firstArrow.x*2, dy2=firstArrow.y*2;
  let tx=state.knight.x, ty=state.knight.y;
  if (firstArrow.x!==0 && dir.y!==0){ tx+=dx2; ty+=dir.y; }
  else if (firstArrow.y!==0 && dir.x!==0){ tx+=dir.x; ty+=dy2; }
  else if (firstArrow.x===-dir.x && firstArrow.y===-dir.y){ arrowStep=0; firstArrow=null; clearGuide(); return; }
  else { arrowStep=0; firstArrow=null; clearGuide(); return; }
  if (tx<0||tx>=SIZE||ty<0||ty>=SIZE){ arrowStep=0; firstArrow=null; clearGuide(); return; }
  arrowStep=0; firstArrow=null; clearGuide(); moveKnightTo(tx,ty);
}
document.addEventListener('keydown', (e)=>{
  if (!state.running) return;
  const k=e.key.replace('Arrow','').toLowerCase();
  const dir=DIRS[k]; if (!dir) return; processArrow(dir);
});

/* ===================== Difficulty & spawns ===================== */
const baseSpawnDelay=1500;
function scheduleSpawn(){
  const next=Math.max(60, baseSpawnDelay / (state.speedMult*(state.slowFactor||1)));
  state.timers.spawn=setTimeout(function tick(){
    if (!state.running) return;
    Math.random()<0.12 ? spawnPowerUp() : spawnEnemy();
    scheduleSpawn();
  }, next);
}
function scheduleDifficulty(){
  state.timers.diff=setInterval(()=>{
    if (!state.running) return;
    state.speedMult += 0.4;
    els.speed && (els.speed.textContent = (state.speedMult*(state.slowFactor||1)).toFixed(1)+'×');
    clearTimeout(state.timers.spawn);
    scheduleSpawn();
  }, 6000);
}

/* ===================== Game over & restart ===================== */
function gameOver(){
  if (!state.running) return;
  state.running=false; clearTimeout(state.timers.spawn); clearInterval(state.timers.diff);
  dots.forEach(d=>d.remove()); dots=[]; clearGuide();
  els.game.classList.add('shake'); setTimeout(()=>els.game.classList.remove('shake'),350);
  SFX.gameOver(); Music.stop();

  const over=document.createElement('div'); over.id='over';
  const finalScore=parseFloat(els.score && els.score.textContent || '0')||0;
  over.innerHTML=`
    <h2>Game Over</h2>
    <p>You survived <strong>${finalScore.toFixed(1)}s</strong></p>
    <div id="saveRow">
      <input id="playerName" maxlength="16" placeholder="Your name">
      <button id="saveBtn">Save Score</button>
    </div>
    <button id="restart">Play Again</button>`;
  els.game.appendChild(over); over.style.display='flex';

  const nameInput=over.querySelector('#playerName');
  const saveBtn=over.querySelector('#saveBtn');
  const restartBtn=over.querySelector('#restart');
  const lastName=localStorage.getItem('knightRunner_lastName')||''; if (lastName) nameInput.value=lastName;

  if (saveBtn){
    saveBtn.addEventListener('click', ()=>{
      const name=(nameInput && nameInput.value || 'Player').trim();
      localStorage.setItem('knightRunner_lastName', name);
      addScore(name, finalScore);
      saveBtn.disabled=true; renderLeaderboard(name, finalScore);
    });
  }
  if (restartBtn){
    restartBtn.addEventListener('click', restart);
  }
}
function restart(){
  state.enemies.forEach(e=>e.el.remove()); state.enemies=[];
  state.powerups.forEach(p=>p.el.remove()); state.powerups=[];
  const over=document.getElementById('over'); if (over) over.remove();
  state.speedMult=1.0; state.slowFactor=1.0; state.slowUntil=0; state.shield=0; state.speedMoves=0;
  els.bShield && els.bShield.classList.remove('active'); els.bSpeed && els.bSpeed.classList.remove('active'); els.bSlow && els.bSlow.classList.remove('active');
  els.speed && (els.speed.textContent='1.0×');
  state.startTime=performance.now(); state.lastTime=state.startTime;
  state.knight={x:3,y:6}; placeKnight();
  arrowStep=0; firstArrow=null; clearGuide();
  state.running=true; updateDots(); clearTimeout(state.timers.spawn); clearInterval(state.timers.diff);
  scheduleSpawn(); scheduleDifficulty(); requestAnimationFrame(loop);
  SFX.restart();
  if (audio.ctx && audio.ctx.state === 'running') Music.start();
}

/* ===================== Relayout on resize ===================== */
function relayoutAll(){
  const cell = CELL(); const size = cell * SIZE;
  els.game.style.width  = size + 'px';
  els.game.style.height = size + 'px';
  els.game.querySelectorAll('.square').forEach((sq, i) => {
    const x = i % SIZE, y = (i / SIZE) | 0;
    sq.style.left   = (x * cell) + 'px';
    sq.style.top    = (y * cell) + 'px';
    sq.style.width  = cell + 'px';
    sq.style.height = cell + 'px';
  });
  placeKnight();
  setGuideViewBox();
  updateDots();
}
if (window.ResizeObserver){
  new ResizeObserver(()=>{ setBoardVars(); relayoutAll(); }).observe(els.game);
}else{
  window.addEventListener('resize', ()=>{ setBoardVars(); relayoutAll(); }, {passive:true});
}

/* ===================== Main loop & start ===================== */
function loop(now){
  if (!state.running) return;
  const dt=now-state.lastTime; state.lastTime=now;
  stepEnemies(dt);
  els.score && (els.score.textContent=((now-state.startTime)/1000).toFixed(1));
  requestAnimationFrame(loop);
}
(function start(){
  installSizing();
  setBoardVars();
  buildBoard();     // build squares first
  placeKnight();    // then ensure knight is attached and visible
  updateDots();
  // spawnEnemy();  // (optional) uncomment to spawn one immediately for visibility
  scheduleSpawn();
  scheduleDifficulty();
  requestAnimationFrame(t=>{ state.lastTime=t; requestAnimationFrame(loop); });

  // Only start music if context is running; otherwise first tap/keypress unlocks.
  if (audio.ctx && audio.ctx.state === 'running') {
    Music.start();
  }
})();
