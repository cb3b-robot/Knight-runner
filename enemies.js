import { state, els, CELL } from './state.js';
import { spawnPowerUp, expirePowerups } from './powerups.js';

const BASE_SPEED = { pawn:1.15, bishop:2.20, rook:3.00, queen:1.35 };

export function spawnEnemyOrPower(){
  const next = Math.random()<0.12 ? spawnPowerUp : spawnEnemy;
  next();
}
export function spawnEnemy(){
  const SIZE=8; const r=Math.random();
  let type = (r>0.85)?'queen' : (r>0.65)?'rook' : (r>0.40)?'bishop' : 'pawn';
  const x=Math.floor(Math.random()*SIZE), y=-1;
  const el=document.createElement('div'); el.className='piece enemy'; el.textContent=({pawn:'♟',rook:'♜',bishop:'♝',queen:'♛'})[type]+'\uFE0E';
  els.game.appendChild(el);
  const px=x*CELL(), py=y*CELL();

  if (type==='queen'){
    const e={el,type,px,py,qx:x,qy:y,qtx:x,qty:0,qtpX:x*CELL(),qtpY:0,stepSpeed:BASE_SPEED.queen};
    pickNextQueenTarget(e); e.qtpX=e.qtx*CELL(); e.qtpY=e.qty*CELL(); el.style.left=px+'px'; el.style.top=py+'px'; state.enemies.push(e); return;
  }
  if (type==='bishop'){
    const dirX=(Math.random()<0.5)?-1:1;
    const e={el,type,px,py,bx:x,by:y,bdir:dirX,btx:x+dirX,bty:0,btpX:(x+dirX)*CELL(),btpY:0,stepSpeed:BASE_SPEED.bishop};
    if (e.btx<0||e.btx>=SIZE){ e.bdir=-e.bdir; e.btx=e.bx+e.bdir; e.btpX=e.btx*CELL(); }
    el.style.left=px+'px'; el.style.top=py+'px'; state.enemies.push(e); return;
  }
  let vxCells=0, vyCells=BASE_SPEED[type];
  if (type==='rook'){ vxCells=0; vyCells=BASE_SPEED.rook; }
  const e={el,type,px,py,vxCells,vyCells}; el.style.left=px+'px'; el.style.top=py+'px'; state.enemies.push(e);
}
function pickNextQueenTarget(e){
  const SIZE=8; const cx=e.qx, cy=e.qy, ny=cy+1; const options=[];
  for (let di=-1; di<=1; di++){ const nx=cx+di; if (nx>=0&&nx<SIZE) options.push(nx); }
  const nx = options.length ? options[Math.floor(Math.random()*options.length)] : cx;
  e.qtx=nx; e.qty=ny;
}
function pickNextBishopTarget(e){
  const SIZE=8; const cx=e.bx, cy=e.by; let nx=cx+e.bdir; const ny=cy+1;
  if (nx<0||nx>=SIZE){ e.bdir=-e.bdir; nx=cx+e.bdir; }
  e.btx=nx; e.bty=ny;
}

export function stepEnemies(dt){
  const dtSec=dt/1000;
  expirePowerups();
  const mult = state.speedMult * (state.slowFactor||1);

  for (let i=state.enemies.length-1;i>=0;i--){
    const e=state.enemies[i];
    if (e.type==='queen' || e.type==='bishop'){
      const speedPx=(e.stepSpeed||1)*CELL()*mult;
      const dx=(e.qtpX??e.btpX)-e.px, dy=(e.qtpY??e.btpY)-e.py;
      const dist=Math.hypot(dx,dy), step=speedPx*dtSec;
      if (dist<=step || dist===0){
        e.px=(e.qtpX??e.btpX); e.py=(e.qtpY??e.btpY); e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px';
        if (e.type==='queen'){ e.qx=e.qtx; e.qy=e.qty; if (e.qy>=8){ e.el.remove(); state.enemies.splice(i,1); continue; } pickNextQueenTarget(e); e.qtpX=e.qtx*CELL(); e.qtpY=e.qty*CELL(); }
        else { e.bx=e.btx; e.by=e.bty; if (e.by>=8){ e.el.remove(); state.enemies.splice(i,1); continue; } pickNextBishopTarget(e); e.btpX=e.btx*CELL(); e.btpY=e.bty*CELL(); }
      }else{
        const ux=dx/dist, uy=dy/dist; e.px+=ux*step; e.py+=uy*step; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px';
      }
    } else {
      const vx=(e.vxCells||0)*CELL()*mult, vy=(e.vyCells||0)*CELL()*mult;
      e.px=Math.max(0, Math.min((8-1)*CELL(), e.px + vx*dtSec)); e.py+=vy*dtSec;
      e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px';
    }
    if (e.py>8*CELL()){ e.el.remove(); state.enemies.splice(i,1); }
  }
}
