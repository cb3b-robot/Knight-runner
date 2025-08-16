import { state } from './state.js';
import { moveKnightTo } from './board.js';
import { drawFirstArrow, clearGuide } from './guide.js';

const DIRS = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
let step=0, first=null;

export function installControls(){
  document.addEventListener('keydown', (e)=>{
    if (!state.running) return;
    const k=e.key.replace('Arrow','').toLowerCase();
    const dir=DIRS[k]; if(!dir) return; e.preventDefault(); process(dir);
  });
}

function process(dir){
  if (step===0){
    const tx2=state.knight.x + dir.x*2, ty2=state.knight.y + dir.y*2;
    const inside = (tx2>=0 && tx2<8 && ty2>=0 && ty2<8);
    drawFirstArrow(dir, !inside);
    if (!inside) return;
    first=dir; step=1; return;
  }
  const dx2=first.x*2, dy2=first.y*2;
  let tx=state.knight.x, ty=state.knight.y;
  if (first.x!==0 && dir.y!==0){ tx+=dx2; ty+=dir.y; }
  else if (first.y!==0 && dir.x!==0){ tx+=dir.x; ty+=dy2; }
  else if (first.x===-dir.x && first.y===-dir.y){ step=0; first=null; clearGuide(); return; }
  else { step=0; first=null; clearGuide(); return; }
  if (tx<0||tx>=8||ty<0||ty>=8){ step=0; first=null; clearGuide(); return; }
  step=0; first=null; clearGuide(); moveKnightTo(tx,ty);
}
