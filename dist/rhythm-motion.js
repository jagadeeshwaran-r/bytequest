// Viewport-driven animation, independent of chart data and interpolation.
export function createRhythmMotion(chart,{Observer=globalThis.IntersectionObserver,reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true}={}){
 let visible=!Observer,animation=null,disposed=false;
 function stop(){animation?.cancel();animation=null;}
 function replay(){
  stop();
  if(disposed||!visible||reduced())return;
  const layer=chart.querySelector('.rhythm-series');
  if(layer?.animate)animation=layer.animate([
   {clipPath:'inset(0 100% 0 0)',opacity:.45},
   {clipPath:'inset(0 0 0 0)',opacity:1}
  ],{duration:1200,easing:'cubic-bezier(.4,0,.2,1)',fill:'none'});
 }
 const observer=Observer?new Observer(entries=>{
  if(disposed)return;
  for(const entry of entries){
   if(entry.target!==chart)continue;
   if(!entry.isIntersecting||entry.intersectionRatio<=.05){visible=false;stop();}
   else if(!visible&&entry.intersectionRatio>=.25){visible=true;replay();}
  }
 },{threshold:[0,.05,.25]}):null;
 observer?.observe(chart);
 return {updated(){replay();},dispose(){disposed=true;stop();observer?.disconnect();}};
}
