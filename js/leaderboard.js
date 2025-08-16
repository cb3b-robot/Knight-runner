import { els } from './state.js';
const LS_KEY='knightRunnerTopScores_v1';
export function loadScores(){ try{const raw=localStorage.getItem(LS_KEY);const a=raw?JSON.parse(raw):[];return Array.isArray(a)?a:[];}catch(e){return [];} }
function saveScores(a){ try{ localStorage.setItem(LS_KEY, JSON.stringify(a)); }catch(e){} }
export function addScore(name, score){
  const list=loadScores(); list.push({name:(name||'Player').trim(), score:+score, ts:Date.now()});
  list.sort((a,b)=> b.score - a.score || a.ts - b.ts);
  saveScores(list.slice(0,500)); return list.slice(0,500);
}
export function renderLeaderboard(myName=null,myScore=null){
  els.lbList.innerHTML='';
  const list = loadScores();
  if (list.length===0){
    const li=document.createElement('li'); const a=document.createElement('div'); a.className='name'; a.textContent='No scores yet';
    const b=document.createElement('div'); b.className='score'; b.textContent='—';
    els.lbList.appendChild(li); els.lbList.appendChild(a); els.lbList.appendChild(b); return;
  }
  list.forEach((e,i)=>{
    const li=document.createElement('li');
    const name=document.createElement('div'); name.className='name'; name.textContent=`${i+1}. ${e.name}`;
    const sc=document.createElement('div'); sc.className='score'; sc.textContent=`${e.score.toFixed(1)}s`;
    els.lbList.appendChild(li); els.lbList.appendChild(name); els.lbList.appendChild(sc);
  });
}
export function installLeaderboard(){
  renderLeaderboard();
  els.resetScores.addEventListener('click', ()=>{
    if (confirm('Clear all saved scores on this device?')){ localStorage.removeItem(LS_KEY); renderLeaderboard(); }
  });
  const lb = document.getElementById('leaderboard');
  els.toggleLB.addEventListener('click', ()=>{
    lb.classList.toggle('expanded');
    els.toggleLB.textContent = lb.classList.contains('expanded') ? 'Show less' : 'Show more';
  });
}
