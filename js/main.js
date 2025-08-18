/* Knight Runner — main.js (classic visuals + iPad 8×8 fit, no graphic changes) */
'use strict';

/* ===== DOM ===== */
const root     = document.documentElement;
const game     = document.getElementById('game');
const scoreEl  = document.getElementById('score');
const speedEl  = document.getElementById('speed');
const muteBtn  = document.getElementById('muteBtn');
const lbList   = document.getElementById('lbList');
const resetBtn = document.getElementById('resetScores');
const toggleLB = document.getElementById('toggleLB');
const bShield  = document.getElementById('bShield');
const bSpeed   = document.getElementById('bSpeed');
const bSlow    = document.getElementById('bSlow');

/* ===== Constants / helpers ===== */
const SIZE = 8;
const GLYPHS = { knight:'♞', pawn:'♟', rook:'♜', bishop:'♝', queen:'♛' }; // keep original look
function inside(x,y){ return x>=0 && x<SIZE && y>=0 && y<SIZE; }
function clamp(v,a,b){ return v<a?a : (v>b?b:v); }
function CELL(){ return parseFloat(getComputedStyle(root).getPropertyValue('--cell')) || (game.clientWidth / SIZE); }

/* ===== iPad-friendly fit (no visual changes) ===== */
function vvWidth(){  return (window.visualViewport ? window.visualViewport.width  : (innerWidth  || document.documentElement.clientWidth  || 800)); }
function vvHeight(){ return (window.visualViewport ? window.visualViewport.height : (innerHeight || document.documentElement.clientHeight || 600)); }

function krFitBoard(){
  const vw = Math.floor(vvWidth());
  const vh = Math.floor(vvHeight());
  const hud = document.querySelector('.hud');
  const hudH = hud ? Math.ceil(hud.getBoundingClientRect().height) : 0;

  const availH = Math.max(240, vh - hudH - 8);
  const availW = Math.max(240, vw - 16);
  const size = Math.floor(Math.min(availH, availW));

  root.style.setProperty('--board', size + 'px');
  root.style.setProperty('--cell',  (size/8) + 'px');

  // lock page to avoid accidental scroll shifting layout
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow           = 'hidden';
  document.documentElement.style.height  = '100dvh';
  document.body.style.height             = '100dvh';

  // reflow absolute tiles & pieces
  layoutBoard();
  placeKnight();
  updateDots();
  guide.setAttribute('viewBox', `0 0 ${CELL()*SIZE} ${CELL()*SIZE}`);
}
addEventListener('resize', krFitBoard, {passive:true});
addEventListener('orientationchange', () => setTimeout(krFitBoard, 120), {passive:true});
if (window.visualViewport){
  window.visualViewport.addEventListener('resize', krFitBoard, {passive:true});
  window.visualViewport.addEventListener('scroll', krFitBoard, {passive:true});
}
setTimeout(krFitBoard, 0);
setTimeout(krFitBoard, 250);
setTimeout(krFitBoard, 800);

/* ===== Audio (unchanged style, more reliable unlock) ===== */
const MUTE_KEY = 'KR_mute';
let audio = { ctx:null, enabled:true, unlocked:false };
try{ audio.enabled = (localStorage.getItem(MUTE_KEY) !== 'true'); }catch{}

function ensureAudio(){ if (!audio.ctx) audio.ctx = new (window.AudioContext||window.webkitAudioContext)(); }
function now(){ ensureAudio(); return audio.ctx.currentTime; }
function unlockAudio(){
  if (audio.unlocked) return;
  ensureAudio();
  try { if (audio.ctx.state === 'suspended' && audio.ctx.resume) audio.ctx.resume(); } catch{}
  try { const s=audio.ctx.createBufferSource(); s.buffer=audio.ctx.createBuffer(1,1,22050); s.connect(audio.ctx.destination); s.start(0); } catch{}
  audio.unlocked = true; Music.start();
}
['pointerdown','touchstart','mousedown','keydown','click'].forEach(evt=>{
  document.addEventListener(evt, unlockAudio, {once:true, passive:true});
});

function tone(o){
  o=o||{};
  ensureAudio();
  try { if (audio.ctx.state==='suspended' && audio.ctx.resume) audio.ctx.resume(); } catch{}
  if (!audio.enabled) return;
  const t0=now();
  const freq=o.freq||440, type=o.type||'sine', dur=o.dur||0.12, gain=o.gain||0.05, attack=o.attack||0.01, release=o.release||0.12;
  const slideTo=(o.slideTo==null?null:o.slideTo), slideTime=o.slideTime||0.08;
  const osc=audio.ctx.createOscillator(), g=audio.ctx.createGain(), f=audio.ctx.createBiquadFilter();
  f.type='lowpass'; f.frequency.value=9000;
  osc.type=type; osc.frequency.value=freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0+attack);
  if (slideTo!=null) osc.frequency.linearRampToValueAtTime(slideTo, t0+slideTime);
  g.gain.setValueAtTime(gain, t0+dur);
  g.gain.linearRampToValueAtTime(0.0001, t0+dur+release);
  osc.connect(f); f.connect(g); g.connect(audio.ctx.destination);
  osc.start(t0); osc.stop(t0+dur+release+0.02);
}
const SFX = {
  jump(){ tone({freq:620,type:'square',gain:0.05,attack:0.006,release:0.09, slideTo:760, slideTime:0.06}); },
  spawnPower(){ tone({freq:900,type:'triangle',gain:0.035,attack:0.003,release:0.06}); },
  pickupShield(){ tone({freq:520,type:'triangle',gain:0.05}); tone({freq:820,type:'triangle',gain:0.045,slideTo:900}); },
  pickupSpeed(){ tone({freq:760,type:'square',gain:0.05,attack:0.004,release:0.09}); },
  pickupSlow(){ tone({freq:440,type:'sine',gain:0.05,attack:0.004,release:0.2,slideTo:320,slideTime:0.15}); },
  pickupClear(){ tone({freq:320,type:'sawtooth',gain:0.06,attack:0.004,release:0.2,slideTo:140,slideTime:0.22}); },
  shieldHit(){ tone({freq:180,type:'square',gain:0.07,attack:0.003,release:0.23}); },
  gameOver(){ tone({freq:460,type:'sawtooth',gain:0.06,attack:0.004,release:0.28, slideTo:200, slideTime:0.26}); },
  restart(){ tone({freq:660,type:'triangle',gain:0.05,attack:0.003,release:0.12, slideTo:880, slideTime:0.08}); }
};
const Music = (function(){
  let master,padGain,arpGain,delay,feedback,lowpass,timer=null,step=0,playing=false;
  function init(){ ensureAudio(); if(master) return;
    master=audio.ctx.createGain(); padGain=audio.ctx.createGain(); arpGain=audio.ctx.createGain();
    delay=audio.ctx.createDelay(1.0); delay.delayTime.value=0.22;
    feedback=audio.ctx.createGain(); feedback.gain.value=0.22;
    lowpass=audio.ctx.createBiquadFilter(); lowpass.type='lowpass'; lowpass.frequency.value=2200;
    master.gain.value=0.16; padGain.gain.value=0.34; arpGain.gain.value=0.45;
    const bus=audio.ctx.createGain(); padGain.connect(bus); arpGain.connect(bus); bus.connect(lowpass);
    lowpass.connect(delay); delay.connect(feedback); feedback.connect(delay);
    delay.connect(master); lowpass.connect(master); master.connect(audio.ctx.destination);
  }
  function mtof(n){ return 440*Math.pow(2,(n-69)/12); }
  function note(o){ if(!audio.enabled) return; const when=o.when, freq=o.freq, dur=o.dur||0.22, type=o.type||'triangle', gain=o.gain||0.18;
    const osc=audio.ctx.createOscillator(), g=audio.ctx.createGain();
    osc.type=type; osc.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,when); g.gain.linearRampToValueAtTime(gain,when+0.01); g.gain.exponentialRampToValueAtTime(0.0001,when+dur);
    osc.connect(g); g.connect(arpGain); osc.start(when); osc.stop(when+dur+0.02);
  }
  function pad(o){ if(!audio.enabled) return; const when=o.when, freq=o.freq, dur=o.dur||3.6, gain=o.gain||0.10;
    const o1=audio.ctx.createOscillator(), o2=audio.ctx.createOscillator(), g=audio.ctx.createGain();
    o1.type='sine'; o2.type='sine'; o1.frequency.value=freq; o2.frequency.value=freq*Math.pow(2,7/1200);
    g.gain.setValueAtTime(0.0001,when); g.gain.linearRampToValueAtTime(gain,when+0.6); g.gain.linearRampToValueAtTime(0.0001,when+dur);
    o1.connect(g); o2.connect(g); g.connect(padGain);
    o1.start(when); o2.start(when); o1.stop(when+dur+0.1); o2.stop(when+dur+0.1);
  }
  const roots=[57,53,60,55], pattern=[0,7,12,7,0,7,12,14], stepDur=0.5;
  function tick(){ if(!playing||!audio.enabled) return; const t=now(); const bar=Math.floor(step/4); const rootN=roots[bar%roots.length];
    if(step%4===0){ pad({freq:mtof(rootN),when:t+0.01}); pad({freq:mtof(rootN+7),when:t+0.01,gain:0.08}); }
    note({freq:mtof(rootN+pattern[step%pattern.length]), when:t+0.02}); step++; }
  function start(){ init(); if(playing) return; playing=true; tick(); timer=setInterval(tick, stepDur*1000); }
  function stop(){ if(!playing) return; playing=false; clearInterval(timer); timer=null; }
  function setEnabled(on){ if(master) master.gain.value = on?0.16:0.0; }
  return { start, stop, setEnabled };
})();
function applyMuteUI(){ if(!muteBtn) return; muteBtn.textContent = audio.enabled ? '🔊' : '🔇'; muteBtn.setAttribute('aria-pressed', String(!audio.enabled)); Music.setEnabled(audio.enabled); }
applyMuteUI();
if (muteBtn){
  muteBtn.addEventListener('click', ()=>{
    unlockAudio();
    try{ if (audio.ctx.state==='suspended' && audio.ctx.resume) audio.ctx.resume(); }catch{}
    audio.enabled=!audio.enabled;
    try{ localStorage.setItem(MUTE_KEY, String(!audio.enabled)); }catch{}
    applyMuteUI();
  });
}
document.addEventListener('visibilitychange', ()=>{
  if (document.visibilityState==='visible' && audio.ctx){
    try{ if (audio.ctx.state==='suspended' && audio.ctx.resume) audio.ctx.resume(); }catch{}
  }
});

/* ===== Leaderboard (unchanged) ===== */
const LS_KEY = 'knightRunnerTopScores_v1';
function loadScores(){ try{ const raw=localStorage.getItem(LS_KEY); const a=raw?JSON.parse(raw):[]; return Array.isArray(a)?a:[]; }catch{ return []; } }
function saveScores(a){ try{ localStorage.setItem(LS_KEY, JSON.stringify(a)); }catch{} }
function addScore(name, score){
  const list=loadScores(); list.push({name:(name||'Player').trim(), score:+score, ts:Date.now()});
  list.sort((A,B)=> (B.score-A.score) || (A.ts-B.ts));
  const top=list.slice(0,50); saveScores(top); return top;
}
function renderLeaderboard(myName,myScore){
  lbList.innerHTML='';
  const list=loadScores();
  if(list.length===0){
    const li=document.createElement('li'); const a=document.createElement('div'); a.className='name'; a.textContent='No scores yet';
    const b=document.createElement('div'); b.className='score'; b.textContent='—';
    lbList.appendChild(li); lbList.appendChild(a); lbList.appendChild(b); return;
  }
  list.forEach((e,i)=>{
    const li=document.createElement('li');
    const name=document.createElement('div'); name.className='name'; name.textContent=`${i+1}. ${e.name}`;
    const sc=document.createElement('div'); sc.className='score'; sc.textContent=`${e.score.toFixed(1)}s`;
    if(myName && myScore!=null && e.name===myName && Math.abs(e.score-myScore)<1e-6){ name.style.color='#2ecc71'; sc.style.color='#2ecc71'; }
    lbList.appendChild(li); lbList.appendChild(name); lbList.appendChild(sc);
  });
  krFitBoard();
}
renderLeaderboard();
if (resetBtn){
  resetBtn.addEventListener('click', ()=>{
    if (confirm('Clear all saved scores on this device?')) {
      localStorage.removeItem(LS_KEY);
      renderLeaderboard();
    }
  });
}
if (toggleLB){
  toggleLB.addEventListener('click', ()=>{
    const lb=document.getElementById('leaderboard');
    lb.classList.toggle('expanded');
    toggleLB.textContent = lb.classList.contains('expanded') ? 'Show less' : 'Show more';
    krFitBoard();
  });
}

/* ===== Build board (absolute squares; classic look) ===== */
const squaresFrag=document.createDocumentFragment();
for (let y=0;y<SIZE;y++){
  for (let x=0;x<SIZE;x++){
    const sq=document.createElement('div');
    sq.className='square ' + ((x+y)%2 ? 'dark' : 'light');
    sq.style.position='absolute';
    squaresFrag.appendChild(sq);
  }
}
game.appendChild(squaresFrag);
function layoutBoard(){
  const squares = game.querySelectorAll('.square');
  const cell = CELL();
  squares.forEach((sq, i) => {
    const x = i % SIZE, y = (i / SIZE) | 0;
    sq.style.left   = `${x*cell}px`;
    sq.style.top    = `${y*cell}px`;
    sq.style.width  = `${cell}px`;
    sq.style.height = `${cell}px`;
  });
}

/* ===== Knight (Unicode glyph, unchanged visuals) ===== */
let knight = { x:3, y:6 };
const knightEl = document.createElement('div');
knightEl.className = 'piece knight';
knightEl.textContent = GLYPHS.knight; // render text directly (no ::before trick)
game.appendChild(knightEl);
function placeKnight(){ const c=CELL(); knightEl.style.left=`${knight.x*c}px`; knightEl.style.top=`${knight.y*c}px`; }
placeKnight();

/* ===== SVG arrow guide (unchanged) ===== */
const svgNS='http://www.w3.org/2000/svg';
const guide=document.createElementNS(svgNS,'svg');
guide.setAttribute('id','guideLayer');
guide.setAttribute('viewBox', `0 0 ${CELL()*SIZE} ${CELL()*SIZE}`);
guide.style.position='absolute'; guide.style.inset='0'; guide.style.pointerEvents='none'; guide.style.zIndex='140';
game.appendChild(guide);
const defs=document.createElementNS(svgNS,'defs');
function mkMarker(id,color){
  const m=document.createElementNS(svgNS,'marker');
  m.setAttribute('id',id); m.setAttribute('markerWidth','10'); m.setAttribute('markerHeight','10');
  m.setAttribute('refX','6'); m.setAttribute('refY','3'); m.setAttribute('orient','auto-start-reverse');
  const p=document.createElementNS(svgNS,'path'); p.setAttribute('d','M0,0 L6,3 L0,6 Z'); p.setAttribute('fill',color);
  m.appendChild(p); return m;
}
defs.appendChild(mkMarker('headPrimary','#2ecc71'));
defs.appendChild(mkMarker('headHint','#00d2ff'));
defs.appendChild(mkMarker('headInvalid','#e74c3c'));
guide.appendChild(defs);
function clearGuide(){ while (guide.lastChild && guide.lastChild!==defs) guide.removeChild(guide.lastChild); }
function drawFirstArrow(dir){
  clearGuide();
  const cell=CELL();
  const cx=knight.x*cell+cell/2, cy=knight.y*cell+cell/2;
  const tx=knight.x+dir.x*2, ty=knight.y+dir.y*2;
  const ok=inside(tx,ty);
  const ex=clamp(tx*cell+cell/2,0,(SIZE-1)*cell), ey=clamp(ty*cell+cell/2,0,(SIZE-1)*cell);

  const prim=document.createElementNS(svgNS,'line');
  prim.setAttribute('x1',cx); prim.setAttribute('y1',cy);
  prim.setAttribute('x2',ex); prim.setAttribute('y2',ey);
  prim.setAttribute('class','ga-primary'+(ok?'':' ga-invalid'));
  prim.setAttribute('marker-end', ok?'url(#headPrimary)':'url(#headInvalid)');
  guide.appendChild(prim);

  const label=document.createElementNS(svgNS,'text');
  label.setAttribute('x', ex + (dir.x===1?10: dir.x===-1?-10:0));
  label.setAttribute('y', ey + (dir.y===1?18: dir.y===-1?-10:-12));
  label.setAttribute('text-anchor', dir.x===-1 ? 'end':'start');
  label.setAttribute('class','ga-label');
  label.textContent = ok ? 'then choose ⟂' : 'out of bounds';
  guide.appendChild(label);

  if(!ok) return;
  const hints=[];
  if(dir.x!==0){ hints.push({hx:tx,hy:ty+1}); hints.push({hx:tx,hy:ty-1}); }
  else         { hints.push({hx:tx+1,hy:ty}); hints.push({hx:tx-1,hy:ty}); }
  for (const h of hints){
    if(!inside(h.hx,h.hy)) continue;
    const hx=h.hx*cell+cell/2, hy=h.hy*cell+cell/2;
    const line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1',ex); line.setAttribute('y1',ey);
    line.setAttribute('x2',hx); line.setAttribute('y2',hy);
    line.setAttribute('class','ga-hint');
    line.setAttribute('marker-end','url(#headHint)');
    guide.appendChild(line);
  }
}

/* ===== Knight move dots (always visible) ===== */
const knightOffsets = [
  {x:2,y:1},{x:2,y:-1},{x:-2,y:1},{x:-2,y:-1},
  {x:1,y:2},{x:1,y:-2},{x:-1,y:2},{x:-1,y:-2}
];
let dots=[];
function updateDots(){
  dots.forEach(d=>d.remove()); dots=[];
  if (!running) return;
  const cell=CELL();
  for (const o of knightOffsets){
    const tx=knight.x+o.x, ty=knight.y+o.y;
    if (!inside(tx,ty)) continue;
    const dot=document.createElement('div'); dot.className='dot';
    dot.style.position='absolute'; dot.style.left=`${tx*cell}px`; dot.style.top=`${ty*cell}px`;
    dot.style.width=`${cell}px`; dot.style.height=`${cell}px`;
    const inner=document.createElement('span'); dot.appendChild(inner);
    dot.addEventListener('click', ()=> moveKnightTo(tx,ty));
    game.appendChild(dot); dots.push(dot);
  }
}

/* ===== Power-ups (unchanged visuals) ===== */
let powerups=[];
const POWER_TYPES=['shield','speed','slow','clear'];
const POWER_GLYPH={ shield:'🛡', speed:'⚡', slow:'🕒', clear:'💥' };
let shield=0, speedMoves=0, slowUntil=0, slowFactor=1.0;

function spawnPowerUp(){
  let tries=20;
  while(tries-- > 0){
    const x=(Math.random()*SIZE)|0, y=(Math.random()*(SIZE-1))|0;
    if (x===knight.x && y===knight.y) continue;
    if (enemies.some(e=> Math.round(e.px/CELL())===x && Math.round(e.py/CELL())===y )) continue;
    const type=POWER_TYPES[(Math.random()*POWER_TYPES.length)|0];
    const el=document.createElement('div'); el.className='power';
    el.style.position='absolute';
    el.style.left=`${x*CELL()}px`; el.style.top=`${y*CELL()}px`;
    el.style.width=`${CELL()}px`; el.style.height=`${CELL()}px`;
    el.innerHTML=`<div class="glyph">${POWER_GLYPH[type]}</div><div class="ring"></div>`;
    game.appendChild(el);
    const expiresAt=performance.now()+5500;
    powerups.push({el,type,x,y,expiresAt});
    SFX.spawnPower(); break;
  }
}
function applyPower(type,x,y){
  sparkle(x,y);
  if (type==='shield'){ shield=1; bShield.classList.add('active'); SFX.pickupShield(); }
  if (type==='speed'){ speedMoves=3; bSpeed.classList.add('active'); SFX.pickupSpeed(); }
  if (type==='slow'){ slowUntil=performance.now()+5000; slowFactor=0.5; bSlow.classList.add('active'); SFX.pickupSlow(); }
  if (type==='clear'){ enemies.forEach(e=>e.el && e.el.remove()); enemies=[]; SFX.pickupClear(); }
}
function pickupAt(x,y){
  for (let i=powerups.length-1;i>=0;i--){
    const p=powerups[i];
    if(!p || !p.el){ powerups.splice(i,1); continue; }
    if(p.x===x && p.y===y){
      applyPower(p.type,x,y);
      p.el.classList.add('fade'); setTimeout(()=>{ if(p.el) p.el.remove(); },450);
      powerups.splice(i,1);
    }
  }
}
function sparkle(x,y){
  const cell=CELL();
  for(let i=0;i<6;i++){
    const s=document.createElement('div'); s.className='sparkle';
    s.style.left=`${x*cell + cell*0.37 + Math.random()*cell*0.26}px`;
    s.style.top =`${y*cell + cell*0.37 + Math.random()*cell*0.26}px`;
    s.style.background = (i%2? '#2ecc71':'#fff');
    game.appendChild(s); setTimeout(()=>s.remove(),600);
  }
}

/* ===== Enemies (unchanged visuals) ===== */
let enemies=[];
const BASE_SPEED={ pawn:1.15, bishop:2.30, rook:3.20, queen:1.40 }; // cells/sec

function spawnEnemy(){
  const r=Math.random(); const type=(r>0.85)?'queen' : (r>0.65)?'rook' : (r>0.40)?'bishop' : 'pawn';
  const x=(Math.random()*SIZE)|0, y=-1;
  const el=document.createElement('div'); el.className='piece enemy'; el.textContent=GLYPHS[type];
  el.style.position='absolute';
  game.appendChild(el);
  const px=x*CELL(), py=y*CELL();

  if (type==='queen'){
    const e={el,type,px,py,qx:x,qy:y,qtx:x,qty:0,qtpX:x*CELL(),qtpY:0,stepSpeed:BASE_SPEED.queen};
    pickNextQueenTarget(e); e.qtpX=e.qtx*CELL(); e.qtpY=e.qty*CELL();
    el.style.left=px+'px'; el.style.top=py+'px'; enemies.push(e); return;
  }
  if (type==='bishop'){
    const dirX=(Math.random()<0.5)?-1:1;
    const e={el,type,px,py,bx:x,by:y,bdir:dirX,btx:x+dirX,bty:0,btpX:(x+dirX)*CELL(),btpY:0,stepSpeed:BASE_SPEED.bishop};
    if (e.btx<0||e.btx>=SIZE){ e.bdir=-e.bdir; e.btx=e.bx+e.bdir; e.btpX=e.btx*CELL(); }
    el.style.left=px+'px'; el.style.top=py+'px'; enemies.push(e); return;
  }
  let vxCells=0, vyCells=BASE_SPEED[type]; if (type==='rook'){ vxCells=0; vyCells=BASE_SPEED.rook; }
  const e={el,type,px,py,vxCells,vyCells}; el.style.left=px+'px'; el.style.top=py+'px'; enemies.push(e);
}
function pickNextQueenTarget(e){
  const cx=e.qx, cy=e.qy, ny=cy+1; const opts=[];
  for (let dx=-1; dx<=1; dx++){ const nx=cx+dx; if(nx>=0&&nx<SIZE) opts.push(nx); }
  const nx=opts.length ? opts[(Math.random()*opts.length)|0] : cx;
  e.qtx=nx; e.qty=ny;
}
function pickNextBishopTarget(e){
  const cx=e.bx, cy=e.by; let nx=cx+e.bdir; const ny=cy+1;
  if (nx<0||nx>=SIZE){ e.bdir=-e.bdir; nx=cx+e.bdir; }
  e.btx=nx; e.bty=ny;
}

/* ===== Difficulty / Spawns ===== */
let running=true, startTime=performance.now(), lastTime=startTime, speedMult=1.0;
let spawnTimer=null, difficultyTimer=null;
const baseSpawnDelay=1500;

function scheduleSpawn(){
  const next=Math.max(80, baseSpawnDelay/(speedMult*(slowFactor||1)));
  spawnTimer=setTimeout(function tick(){
    if (!running) return;
    (Math.random()<0.12)?spawnPowerUp():spawnEnemy();
    scheduleSpawn();
  }, next);
}
function scheduleDifficulty(){
  difficultyTimer=setInterval(()=>{
    if (!running) return;
    speedMult += 0.4;
    speedEl.textContent = (speedMult*(slowFactor||1)).toFixed(1)+'×';
    clearTimeout(spawnTimer);
    scheduleSpawn();
  }, 6000);
}

/* ===== Movement & Collisions ===== */
function clampX(px){ const max=(SIZE-1)*CELL(); return px<0?0:(px>max?max:px); }
function moveEnemiesSmooth(dt){
  const dtSec=dt/1000, nowT=performance.now();

  for (let i=powerups.length-1;i>=0;i--){
    const p=powerups[i];
    if (!p || !p.el){ powerups.splice(i,1); continue; }
    if (nowT>p.expiresAt){ p.el.classList.add('fade'); setTimeout(()=>{ if(p.el) p.el.remove(); },450); powerups.splice(i,1); }
  }
  if (slowUntil && nowT>slowUntil){ slowUntil=0; slowFactor=1.0; bSlow.classList.remove('active'); }
  const mult=speedMult*(slowFactor||1); speedEl.textContent=mult.toFixed(1)+'×';

  for (let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    if (e.type==='queen'){
      const speedPx=e.stepSpeed*CELL()*mult, dx=e.qtpX-e.px, dy=e.qtpY-e.py, dist=Math.hypot(dx,dy), step=speedPx*dtSec;
      if (dist<=step || dist===0){
        e.px=e.qtpX; e.py=e.qtpY; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px';
        e.qx=e.qtx; e.qy=e.qty;
        if (e.qy>=SIZE){ e.el.remove(); enemies.splice(i,1); continue; }
        pickNextQueenTarget(e); e.qtpX=e.qtx*CELL(); e.qtpY=e.qty*CELL();
      }else{ const ux=dx/dist, uy=dy/dist; e.px+=ux*step; e.py+=uy*step; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px'; }
    } else if (e.type==='bishop'){
      const speedPx=e.stepSpeed*CELL()*mult, dx=e.btpX-e.px, dy=e.btpY-e.py, dist=Math.hypot(dx,dy), step=speedPx*dtSec;
      if (dist<=step || dist===0){
        e.px=e.btpX; e.py=e.btpY; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px';
        e.bx=e.btx; e.by=e.bty;
        if (e.by>=SIZE){ e.el.remove(); enemies.splice(i,1); continue; }
        pickNextBishopTarget(e); e.btpX=e.btx*CELL(); e.btpY=e.bty*CELL();
      }else{ const ux=dx/dist, uy=dy/dist; e.px+=ux*step; e.py+=uy*step; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px'; }
    } else {
      const vx=(e.vxCells||0)*CELL()*mult, vy=(e.vyCells||0)*CELL()*mult;
      e.px=clampX(e.px + vx*dtSec); e.py+=vy*dtSec; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px';
    }

    const ex=Math.round(e.px/CELL()), ey=Math.round(e.py/CELL());
    if (ex===knight.x && ey===knight.y){
      if (shield>0){ shield=0; bShield.classList.remove('active'); e.el.remove(); enemies.splice(i,1); game.classList.add('shake'); setTimeout(()=>game.classList.remove('shake'),220); SFX.shieldHit(); }
      else { gameOver(); return; }
    }
    if (e.py>SIZE*CELL()){ e.el.remove(); enemies.splice(i,1); }
  }

  let danger=false;
  for (const o of knightOffsets){
    const tx=knight.x+o.x, ty=knight.y+o.y;
    if (!inside(tx,ty)) continue;
    if (enemies.some(e=>Math.round(e.px/CELL())===tx && Math.round(e.py/CELL())===ty)){ danger=true; break; }
  }
  knightEl.classList.toggle('danger', danger);
}
function checkCollision(){
  if (enemies.some(e=>Math.round(e.px/CELL())===knight.x && Math.round(e.py/CELL())===knight.y)){
    if (shield>0){
      shield=0; bShield.classList.remove('active');
      enemies = enemies.filter(e=>!(Math.round(e.px/CELL())===knight.x && Math.round(e.py/CELL())===knight.y));
      SFX.shieldHit();
    } else { gameOver(); }
  }
}

/* ===== Knight movement (unchanged rules) ===== */
function moveKnightTo(tx,ty){
  if (!inside(tx,ty)) return;
  knight.x=tx; knight.y=ty; placeKnight();
  SFX.jump(); pickupAt(tx,ty); checkCollision(); updateDots(); clearGuide();
  if (speedMoves>0){ speedMoves--; if (speedMoves===0) bSpeed.classList.remove('active'); }
}
const DIRS={ up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
let arrowStep=0, firstArrow=null;
document.addEventListener('keydown', (e)=>{
  if (!running) return;
  const k=e.key.replace('Arrow','').toLowerCase();
  const dir=DIRS[k]; if (!dir) return;
  e.preventDefault();
  if (arrowStep===0){ firstArrow=dir; arrowStep=1; drawFirstArrow(dir); return; }
  const dx2=firstArrow.x*2, dy2=firstArrow.y*2;
  let tx=knight.x, ty=knight.y;
  if (firstArrow.x!==0 && dir.y!==0){ tx+=dx2; ty+=dir.y; }
  else if (firstArrow.y!==0 && dir.x!==0){ tx+=dir.x; ty+=dy2; }
  else if (firstArrow.x===-dir.x && firstArrow.y===-dir.y){ arrowStep=0; firstArrow=null; clearGuide(); return; }
  else { arrowStep=0; firstArrow=null; clearGuide(); return; }
  if (!inside(tx,ty)){ arrowStep=0; firstArrow=null; clearGuide(); return; }
  arrowStep=0; firstArrow=null; clearGuide(); moveKnightTo(tx,ty);
}, {passive:false});

/* ===== Loop / Start / Restart ===== */
function loop(t){
  if (!running) return;
  const dt=t-lastTime; lastTime=t;
  moveEnemiesSmooth(dt);
  scoreEl.textContent=((t-startTime)/1000).toFixed(1);
  requestAnimationFrame(loop);
}
function startGame(){
  updateDots(); scheduleSpawn(); scheduleDifficulty(); requestAnimationFrame(loop);
  applyMuteUI(); Music.setEnabled(audio.enabled); krFitBoard();
}
startGame();

function gameOver(){
  if (!running) return;
  running=false; clearTimeout(spawnTimer); clearInterval(difficultyTimer);
  dots.forEach(d=>d.remove()); dots=[]; clearGuide();
  game.classList.add('shake'); setTimeout(()=>game.classList.remove('shake'),350);
  SFX.gameOver(); Music.stop();

  const over=document.createElement('div'); over.id='over';
  const finalScore=parseFloat(scoreEl.textContent)||0;
  over.innerHTML=
    `<h2>Game Over</h2>
     <p>You survived <strong>${finalScore.toFixed(1)}s</strong></p>
     <div id="saveRow">
       <input id="playerName" maxlength="16" placeholder="Your name">
       <button id="saveBtn">Save Score</button>
     </div>
     <button id="restart">Play Again</button>`;
  game.appendChild(over); over.style.display='flex';

  const nameInput=over.querySelector('#playerName');
  const saveBtn=over.querySelector('#saveBtn');
  const restartBtn=over.querySelector('#restart');
  const lastName=localStorage.getItem('knightRunner_lastName')||''; if (lastName) nameInput.value=lastName;

  saveBtn.addEventListener('click', ()=>{
    const name=(nameInput.value||'Player').trim();
    localStorage.setItem('knightRunner_lastName', name);
    addScore(name, finalScore);
    saveBtn.disabled=true; renderLeaderboard(name, finalScore);
    krFitBoard();
  });
  restartBtn.addEventListener('click', restart);
}
function restart(){
  enemies.forEach(e=>e.el && e.el.remove()); enemies=[];
  powerups.forEach(p=>p && p.el && p.el.remove()); powerups.length=0;
  const over=document.getElementById('over'); if (over) over.remove();

  speedMult=1.0; slowFactor=1.0; slowUntil=0; shield=0; speedMoves=0;
  bShield.classList.remove('active'); bSpeed.classList.remove('active'); bSlow.classList.remove('active');
  speedEl.textContent='1.0×';

  startTime=performance.now(); lastTime=startTime;
  knight={x:3,y:6}; placeKnight(); arrowStep=0; firstArrow=null; clearGuide();

  running=true; updateDots(); clearTimeout(spawnTimer); clearInterval(difficultyTimer);
  scheduleSpawn(); scheduleDifficulty(); requestAnimationFrame(loop);

  SFX.restart(); Music.start(); krFitBoard();
}

/* ===== Resize observer to keep absolute layout perfect ===== */
if (typeof ResizeObserver!=='undefined'){
  const ro=new ResizeObserver(()=>{
    layoutBoard();
    placeKnight();
    updateDots();
    guide.setAttribute('viewBox', `0 0 ${CELL()*SIZE} ${CELL()*SIZE}`);
  });
  ro.observe(game);
}
