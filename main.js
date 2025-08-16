// js/main.js  (TEMP smoke test — no imports)
console.log('[smoke] main.js loaded');

(function ensureBoardSize(){
  const root = document.documentElement;
  // If external CSS didn't load, --board might be empty.
  let board = getComputedStyle(root).getPropertyValue('--board').trim();
  if (!board) {
    // force a sensible size so the board is visible
    root.style.setProperty('--board', Math.min(window.innerWidth, window.innerHeight) * 0.92 + 'px');
    root.style.setProperty('--cell', 'calc(var(--board)/8)');
  }
})();

const game = document.getElementById('game');

// build 8×8 squares
function buildBoard(){
  const cell = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell')) || (Math.min(innerWidth, innerHeight)*0.92/8);
  game.style.position = 'relative';
  game.style.width  = (cell*8) + 'px';
  game.style.height = (cell*8) + 'px';
  game.innerHTML = '';
  for (let y=0; y<8; y++){
    for (let x=0; x<8; x++){
      const sq = document.createElement('div');
      sq.className = 'square ' + ((x+y)%2 ? 'dark' : 'light');
      sq.style.position = 'absolute';
      sq.style.left = (x*cell) + 'px';
      sq.style.top  = (y*cell) + 'px';
      sq.style.width  = cell + 'px';
      sq.style.height = cell + 'px';
      game.appendChild(sq);
    }
  }
  tag('Board OK: 64 squares');
}
buildBoard();

function tag(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;top:8px;left:8px;background:#2ecc71;color:#111;padding:4px 6px;border-radius:6px;font:600 12px system-ui;z-index:9999';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1800);
}

window.addEventListener('resize', buildBoard, {passive:true});
