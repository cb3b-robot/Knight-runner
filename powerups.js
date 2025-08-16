import { state, els, CELL } from './state.js';

export function spawnPowerUp(){
  const SIZE=8; let tries=20;
  while(tries-- >0){
    const x=Math.floor(Math.random()*SIZE);
    const y=Math.floor(Math.random()*(SIZE-1));
    if (x===state.knight.x && y===state.knight.y) continue;
    if (state.enemies.some(e => Math.round(e.px/CELL())===x && Math.round(e.py/CELL())===y)) continue;
    const types=['shield','speed','slow','clear'];
    const glyph={shield:'🛡',speed:'⚡',slow:'🕒',clear:'💥'};
    const type=types[Math.floor(Math.random()*types.length)];
    const el=document.createElement('div'); el.className='power';
    el.style.left=(x*CELL())+'px'; el.style.top=(y*CELL())+'px';
    el.innerHTML=`<div class="glyph">${glyph[type]}</div><div class="ring"></div>`;
    els.game.appendChild(el);
    state.powerups.push({el,type,x,y,expiresAt:performance.now()+5500});
    break;
  }
}
export function pickupAt(x,y){
  for (let i=state.powerups.length-1;i>=0;i--){
    const p=state.powerups[i];
    if (p.x===x && p.y===y){
      applyPower(p.type); p.el.classList.add('fade'); setTimeout(()=>p.el.remove(),450);
      state.powerups.splice(i,1);
    }
  }
}
function applyPower(type){
  if (type==='shield'){ state.shield=1; els.bShield.classList.add('active'); }
  if (type==='speed'){ state.speedMoves=3; els.bSpeed.classList.add('active'); }
  if (type==='slow'){ state.slowUntil=performance.now()+5000; state.slowFactor=0.5; els.bSlow.classList.add('active'); }
  if (type==='clear'){ state.enemies.forEach(e=>e.el.remove()); state.enemies=[]; }
}
export function expirePowerups(){
  const now=performance.now();
  for (let i=state.powerups.length-1;i>=0;i--){
    if (now>state.powerups[i].expiresAt){
      state.powerups[i].el.classList.add('fade'); setTimeout(()=>state.powerups[i].el.remove(),450);
      state.powerups.splice(i,1);
    }
  }
  if (state.slowUntil && now>state.slowUntil){ state.slowUntil=0; state.slowFactor=1.0; els.bSlow.classList.remove('active'); }
}
export function checkCollisionsNow(){
  const hit = state.enemies.some(e=>Math.round(e.px/CELL())===state.knight.x && Math.round(e.py/CELL())===state.knight.y);
  if (hit){
    if (state.shield>0){ state.shield=0; els.bShield.classList.remove('active'); state.enemies=state.enemies.filter(e=>!(Math.round(e.px/CELL())===state.knight.x && Math.round(e.py/CELL())===state.knight.y)); }
    else window.__gameOver && window.__gameOver();
  }
}
