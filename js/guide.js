import { els, SIZE, CELL, state } from './state.js';
const svgNS='http://www.w3.org/2000/svg';
let guide, defs;
export function setupGuide(){
  guide = document.createElementNS(svgNS, 'svg');
  guide.setAttribute('id','guideLayer');
  guide.setAttribute('viewBox', `0 0 ${CELL()*SIZE} ${CELL()*SIZE}`);
  els.game.appendChild(guide);
  defs = document.createElementNS(svgNS,'defs');
  function mk(id,color){ const m=document.createElementNS(svgNS,'marker'); m.setAttribute('id',id); m.setAttribute('markerWidth','10'); m.setAttribute('markerHeight','10'); m.setAttribute('refX','6'); m.setAttribute('refY','3'); m.setAttribute('orient','auto-start-reverse'); const p=document.createElementNS(svgNS,'path'); p.setAttribute('d','M0,0 L6,3 L0,6 Z'); p.setAttribute('fill',color); m.appendChild(p); return m; }
  defs.appendChild(mk('headPrimary','#2ecc71'));
  defs.appendChild(mk('headHint','#00d2ff'));
  defs.appendChild(mk('headInvalid','#e74c3c'));
  guide.appendChild(defs);
}
export function clearGuide(){ while (guide.lastChild && guide.lastChild!==defs) guide.removeChild(guide.lastChild); }
export function drawFirstArrow(dir, invalid=false){
  clearGuide();
  const cell=CELL(), cx=state.knight.x*cell+cell/2, cy=state.knight.y*cell+cell/2;
  const tx=state.knight.x+dir.x*2, ty=state.knight.y+dir.y*2;
  const inside=(tx>=0&&tx<SIZE&&ty>=0&&ty<SIZE);
  const ex = Math.max(0, Math.min((SIZE-1)*cell, tx*cell + cell/2));
  const ey = Math.max(0, Math.min((SIZE-1)*cell, ty*cell + cell/2));
  const prim = document.createElementNS(svgNS,'line');
  prim.setAttribute('x1',cx); prim.setAttribute('y1',cy); prim.setAttribute('x2',ex); prim.setAttribute('y2',ey);
  const bad = invalid || !inside;
  prim.setAttribute('class','ga-primary' + (bad ? ' ga-invalid':'')); prim.setAttribute('marker-end', `url(#${bad?'headInvalid':'headPrimary'})`);
  guide.appendChild(prim);
  const label = document.createElementNS(svgNS,'text');
  label.setAttribute('x', ex + (dir.x===1? 10 : dir.x===-1? -10 : 0));
  label.setAttribute('y', ey + (dir.y===1? 18 : dir.y===-1? -10 : -12));
  label.setAttribute('text-anchor', dir.x===-1 ? 'end' : 'start');
  label.setAttribute('class','ga-label');
  label.textContent = bad ? 'out of bounds' : 'then choose ⟂';
  guide.appendChild(label);
  if (bad){ els.game.classList.add('shake'); setTimeout(()=>els.game.classList.remove('shake'),220); return; }
  const hints = dir.x!==0 ? [{hx:tx,hy:ty+1},{hx:tx,hy:ty-1}] : [{hx:tx+1,hy:ty},{hx:tx-1,hy:ty}];
  for (const h of hints){
    if (h.hx<0||h.hx>=SIZE||h.hy<0||h.hy>=SIZE) continue;
    const hx=h.hx*cell+cell/2, hy=h.hy*cell+cell/2;
    const line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1',ex); line.setAttribute('y1',ey); line.setAttribute('x2',hx); line.setAttribute('y2',hy);
    line.setAttribute('class','ga-hint'); line.setAttribute('marker-end','url(#headHint)');
    guide.appendChild(line);
  }
}
export function resizeGuide(){ guide.setAttribute('viewBox', `0 0 ${CELL()*SIZE} ${CELL()*SIZE}`); }
