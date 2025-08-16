import { els, state, SIZE, CELL, GLYPHS, clampCell } from './state.js';
import { pickupAt, checkCollisionsNow } from './powerups.js';

let knightEl;
export function buildBoard(){
  // squares
  for (let y=0;y<SIZE;y++){
    for (let x=0;x<SIZE;x++){
      const sq = document.createElement('div');
      sq.className = 'square ' + ((x+y)%2 ? 'dark':'light');
      sq.style.left = (x*CELL())+'px';
      sq.style.top  = (y*CELL())+'px';
      els.game.appendChild(sq);
    }
  }
  // knight
  knightEl = document.createElement('div');
  knightEl.className = 'piece knight';
  knightEl.textContent = GLYPHS.knight;
  els.game.appendChild(knightEl);
  placeKnight();
}

export function placeKnight(){
  state.knight.x = clampCell(state.knight.x);
  state.knight.y = clampCell(state.knight.y);
  knightEl.style.left = (state.knight.x*CELL())+'px';
  knightEl.style.top  = (state.knight.y*CELL())+'px';
}

const offsets = [{x:2,y:1},{x:2,y:-1},{x:-2,y:1},{x:-2,y:-1},{x:1,y:2},{x:1,y:-2},{x:-1,y:2},{x:-1,y:-2}];
let dots=[];
export function updateDots(){
  dots.forEach(d=>d.remove()); dots=[];
  if (!state.running) return;
  for (const o of offsets){
    const tx=state.knight.x+o.x, ty=state.knight.y+o.y;
    if (tx<0||tx>=SIZE||ty<0||ty>=SIZE) continue;
    const dot=document.createElement('div'); dot.className='dot';
    dot.style.left=(tx*CELL())+'px'; dot.style.top=(ty*CELL())+'px';
    const inner=document.createElement('span'); dot.appendChild(inner);
    dot.addEventListener('click', ()=> moveKnightTo(tx,ty));
    els.game.appendChild(dot); dots.push(dot);
  }
}

export function moveKnightTo(tx,ty){
  if (tx<0||tx>=SIZE||ty<0||ty>=SIZE) return;
  state.knight.x=tx; state.knight.y=ty; placeKnight();
  pickupAt(tx,ty);
  checkCollisionsNow();
  updateDots();
}

export function relayoutAll(prevCell){
  const cell = CELL();
  document.querySelectorAll('.square').forEach((sq,i)=>{
    const x=i%SIZE, y=(i/SIZE)|0;
    sq.style.left=(x*cell)+'px';
    sq.style.top =(y*cell)+'px';
  });
  placeKnight();
  if (prevCell && prevCell>0){
    const s=cell/prevCell;
    state.enemies.forEach(e=>{
      e.px*=s; e.py*=s; e.el.style.left=e.px+'px'; e.el.style.top=e.py+'px';
      if (e.qtpX!=null){ e.qtpX*=s; e.qtpY*=s; }
      if (e.btpX!=null){ e.btpX*=s; e.btpY*=s; }
    });
    state.powerups.forEach(p=>{ p.el.style.left=(p.x*cell)+'px'; p.el.style.top=(p.y*cell)+'px'; });
    updateDots();
  }
}
export function getKnightEl(){ return knightEl; }
