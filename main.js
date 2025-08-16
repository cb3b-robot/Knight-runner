import { els, state, CELL } from './state.js';
import { installSizing } from './sizing.js';
import { buildBoard, updateDots, relayoutAll } from './board.js';
import { setupGuide } from './guide.js';
import { installControls } from './controls.js';
import { spawnEnemyOrPower, stepEnemies } from './enemies.js';
import { installLeaderboard, addScore, renderLeaderboard } from './leaderboard.js';

(function errorCatcher(){
  const overlay = document.getElementById('errorOverlay');
  const text = document.getElementById('errorText');
  function show(msg){ overlay.style.display='flex'; text.textContent = 'JavaScript error:\n\n' + msg + '\n\n(Hard refresh after fixing)'; }
  addEventListener('error', e=>show((e.message||'Unknown error')));
  addEventListener('unhandledrejection', e=>show('Unhandled promise rejection: '+(e.reason && e.reason.message ? e.reason.message : String(e.reason))));
})();

installSizing();
buildBoard();
setupGuide();
installControls();
installLeaderboard();
updateDots();

// Resize-aware relayout
let lastCell = CELL();
if (window.ResizeObserver){
  new ResizeObserver(()=>{
    const newCell = CELL();
    relayoutAll(lastCell);
    lastCell = newCell;
  }).observe(els.game);
}

// Spawning & difficulty
function scheduleSpawn(){
  const baseSpawnDelay=1500;
  const next=Math.max(60, baseSpawnDelay / (state.speedMult*(state.slowFactor||1)));
  state.timers.spawn = setTimeout(function tick(){
    if (!state.running) return;
    spawnEnemyOrPower();
    scheduleSpawn();
  }, next);
}
function scheduleDifficulty(){
  state.timers.diff = setInterval(()=>{
    if (!state.running) return;
    state.speedMult += 0.4;
    document.getElementById('speed').textContent = (state.speedMult*(state.slowFactor||1)).toFixed(1)+'×';
    clearTimeout(state.timers.spawn);
    scheduleSpawn();
  }, 6000);
}

window.__gameOver = function(){
  if (!state.running) return;
  state.running=false; clearTimeout(state.timers.spawn); clearInterval(state.timers.diff);
  document.getElementById('game').classList.add('shake'); setTimeout(()=>document.getElementById('game').classList.remove('shake'),350);

  const over=document.createElement('div'); over.id='over';
  const finalScore=parseFloat(document.getElementById('score').textContent)||0;
  over.innerHTML = `
    <h2>Game Over</h2>
    <p>You survived <strong>${finalScore.toFixed(1)}s</strong></p>
    <div id="saveRow">
      <input id="playerName" maxlength="16" placeholder="Your name">
      <button id="saveBtn">Save Score</button>
    </div>
    <button id="restart">Play Again</button>`;
  document.getElementById('game').appendChild(over); over.style.display='flex';

  const nameInput=over.querySelector('#playerName');
  const saveBtn=over.querySelector('#saveBtn');
  const restartBtn=over.querySelector('#restart');
  const lastName=localStorage.getItem('knightRunner_lastName')||''; if (lastName) nameInput.value=lastName;

  saveBtn.addEventListener('click', ()=>{
    const name=(nameInput.value||'Player').trim();
    localStorage.setItem('knightRunner_lastName', name);
    addScore(name, finalScore);
    saveBtn.disabled=true; renderLeaderboard(name, finalScore);
  });
  restartBtn.addEventListener('click', ()=>{
    location.reload(); // simplest restart in modular setup
  });
};

// Game loop
function loop(t){
  if (!state.running) return;
  const dt = t - state.lastTime; state.lastTime = t;
  stepEnemies(dt);
  document.getElementById('score').textContent = ((t - state.startTime)/1000).toFixed(1);
  requestAnimationFrame(loop);
}

// Go!
scheduleSpawn(); scheduleDifficulty(); requestAnimationFrame(t=>{ state.lastTime=t; requestAnimationFrame(loop); });
