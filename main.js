// js/main.js
console.log('[main] boot');

// Visual canary so you know main.js ran
(() => {
  const tag = document.createElement('div');
  tag.textContent = 'main.js loaded';
  tag.style.cssText = 'position:fixed;top:8px;left:8px;background:#2ecc71;color:#111;padding:4px 6px;border-radius:6px;font:600 12px system-ui;z-index:9999';
  document.body.appendChild(tag);
  setTimeout(() => tag.remove(), 1500);
})();

// ---- Imports (filenames/case must match exactly) ----
import { els, state, CELL } from './state.js';
import { installSizing } from './sizing.js';
import { buildBoard, updateDots, relayoutAll } from './board.js';
import { setupGuide } from './guide.js';
import { installControls } from './controls.js';
import { spawnEnemyOrPower, stepEnemies } from './enemies.js';
import { installLeaderboard, addScore, renderLeaderboard } from './leaderboard.js';

// Reuse the error overlay
function showError(msg){
  const o=document.getElementById('errorOverlay'), t=document.getElementById('errorText');
  if (!o || !t) { console.error(msg); return; }
  o.style.display='flex'; t.textContent = 'JavaScript error:\n\n' + msg;
}

try {
  // Layout & UI
  installSizing();
  buildBoard();
  setupGuide();
  installControls();
  installLeaderboard();
  updateDots();

  // Resize-aware relayout
  let lastCell = CELL();
  if (window.ResizeObserver){
    new ResizeObserver(() => {
      const newCell = CELL();
      relayoutAll(lastCell);
      lastCell = newCell;
    }).observe(els.game);
  }

  // Spawning & difficulty
  function scheduleSpawn(){
    const baseSpawnDelay = 1500;
    const mult = state.speedMult * (state.slowFactor || 1);
    const next = Math.max(60, baseSpawnDelay / mult);
    state.timers = state.timers || {};
    state.timers.spawn = setTimeout(function tick(){
      if (!state.running) return;
      spawnEnemyOrPower();
      scheduleSpawn();
    }, next);
  }
  function scheduleDifficulty(){
    state.timers = state.timers || {};
    state.timers.diff = setInterval(() => {
      if (!state.running) return;
      state.speedMult += 0.4;
      els.speed.textContent = (state.speedMult * (state.slowFactor || 1)).toFixed(1) + '×';
      clearTimeout(state.timers.spawn);
      scheduleSpawn();
    }, 6000);
  }

  // Game over flow (called by other modules as window.__gameOver())
  window.__gameOver = function(){
    if (!state.running) return;
    state.running = false;
    if (state.timers){ clearTimeout(state.timers.spawn); clearInterval(state.timers.diff); }

    els.game.classList.add('shake');
    setTimeout(() => els.game.classList.remove('shake'), 350);

    const over = document.createElement('div');
    over.id = 'over';
    const finalScore = parseFloat(els.score.textContent) || 0;
    over.innerHTML = `
      <h2>Game Over</h2>
      <p>You survived <strong>${finalScore.toFixed(1)}s</strong></p>
      <div id="saveRow">
        <input id="playerName" maxlength="16" placeholder="Your name">
        <button id="saveBtn">Save Score</button>
      </div>
      <button id="restart">Play Again</button>`;
    els.game.appendChild(over);
    over.style.display = 'flex';

    const nameInput = over.querySelector('#playerName');
    const saveBtn   = over.querySelector('#saveBtn');
    const restartBtn= over.querySelector('#restart');
    const lastName  = localStorage.getItem('knightRunner_lastName') || '';
    if (lastName) nameInput.value = lastName;

    saveBtn.addEventListener('click', () => {
      const name = (nameInput.value || 'Player').trim();
      localStorage.setItem('knightRunner_lastName', name);
      addScore(name, finalScore);
      saveBtn.disabled = true;
      renderLeaderboard(name, finalScore);
    });

    restartBtn.addEventListener('click', () => location.reload());
  };

  // Main loop
  function loop(ts){
    if (!state.running) return;
    const dt = ts - state.lastTime; state.lastTime = ts;
    stepEnemies(dt);
    els.score.textContent = ((ts - state.startTime) / 1000).toFixed(1);
    requestAnimationFrame(loop);
  }

  // Go!
  scheduleSpawn();
  scheduleDifficulty();
  requestAnimationFrame(t => { state.lastTime = t; requestAnimationFrame(loop); });

} catch (err) {
  console.error(err);
  showError(err && err.stack ? err.stack : String(err));
}
