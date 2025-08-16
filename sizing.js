import { els } from './state.js';

const getVH = () => (visualViewport ? visualViewport.height : innerHeight || 600);
const getVW = () => (visualViewport ? visualViewport.width  : innerWidth  || 600);
const rectH  = el => el ? el.getBoundingClientRect().height || 0 : 0;
const bodyVPad = () => {
  const cs = getComputedStyle(document.body);
  return (parseFloat(cs.paddingTop)||0) + (parseFloat(cs.paddingBottom)||0);
};

export function installSizing() {
  function setBoardSize(){
    const vh=getVH(), vw=getVW();
    const titleH = rectH(document.querySelector('h1'));
    const hudH   = rectH(document.querySelector('.hud'));
    const padV   = bodyVPad();
    const isPortrait = vh >= vw;
    const extra = isPortrait ? 28 : 12;
    const maxByH = Math.max(240, vh - titleH - hudH - padV - extra);
    const maxByW = Math.max(240, vw - 12);
    const size = Math.floor(Math.min(maxByH, maxByW));
    els.root.style.setProperty('--board', size + 'px');
  }
  addEventListener('resize', setBoardSize, {passive:true});
  addEventListener('orientationchange', ()=>setTimeout(setBoardSize,120), {passive:true});
  if (visualViewport){
    visualViewport.addEventListener('resize', setBoardSize, {passive:true});
    visualViewport.addEventListener('scroll', setBoardSize, {passive:true});
  }
  setBoardSize(); setTimeout(setBoardSize,200); setTimeout(setBoardSize,800);
}
