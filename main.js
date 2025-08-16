// js/main.js  (TEMP smoke test)
window.__MAIN_LOADED__ = true;
console.log('[smoke] main.js loaded');

(function ensureBoardSize(){
  const root = document.documentElement;
  let board = getComputedStyle(root).getPropertyValue('--board').trim();
  if (!board) {
    // If external CSS didn't load, set a safe size so it's visible
    const size = Math.min(window.innerWidth || 600, window.innerHeight || 600) * 0.92;
    root.style.setProperty('--board', size + 'px');
    root.style.setProperty('--cell', 'calc(var(--board)/8)');
  }
})();

const game = document.getElementById('game');
if (!game) {
  alert('#game not found in HTML'); // safety
}

// Build a visible 8×8 board
function buildBoard(){
  const cellStr = getComputedStyle(document.documentElement).getPropertyValue('--cell');
  let cell = parseFloat(cellStr);
  if (!cell || isNaN(cell)) cell = (Math.min(innerWidth, innerHeight) * 0.92) / 8;

  game.style.position = 'relative';
  game.style.width  = (cell*8) + 'px';
  game.style.height = (cell*8) + 'px';
  game.innerHTML = '';

  for (let y=0; y<8; y++){
    for (let x=0; x<8; x++){
      const sq = document.createElement('div');
      sq.className = 'square ' + ((x+y)%2 ? 'dark' : 'light');
      sq.style.left = (x*cell) + 'px';
      sq.style.top  = (y*cell) + 'px';
      game.appendChild(sq);
    }
  }

  // green “OK” badge
  const tag = document.createElement('div');
  tag.textContent = 'Board OK (64 squares)';
  tag.style.cssText = 'position:fixed;top:8px;left:8px;background:#2ecc71;color:#111;padding:4px 6px;border-radius:6px;font:600 12px system-ui;z-index:9999';
  document.body.appendChild(tag);
  setTimeout(()=>tag.remove(), 1800);
}

buildBoard();
addEventListener('resize', buildBoard, {passive:true});

// If external CSS did load, remove the inline fallback to avoid double rules
(function removeFallbackIfCSSLoaded(){
  const test = getComputedStyle(document.documentElement).getPropertyValue('--board');
  if (test && test.trim() !== '') {
    const fb = document.getElementById('board-fallback');
    if (fb) fb.remove();
  }
})();
