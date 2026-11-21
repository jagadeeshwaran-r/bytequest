// Local visual effects only. Learning state and account data are untouched.
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const precise=matchMedia('(hover: hover) and (pointer: fine)');
// Limit entrance motion to small headings. Large tables, profile cards and
// analytics should appear immediately, not animate into view while scrolling.
const revealSelector='#mapView>.section-heading,.leader-heading,#studioView>.section-heading';
const spotlightSelector='#questGrid,.white-card,.leader-summary,.leader-signed-out,.leader-table-wrap';
const seen=new WeakSet();let observer,refreshFrame=0,pointerFrame=0,scrollFrame=0,hovered=null,point=null;
const header=document.querySelector('.minimal-header');
function reveal(el,index=0){
 if(reduced.matches||!el.animate)return;
 el.animate([{opacity:0.86,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:220,delay:0,easing:'ease-out'});
}
function refresh(){
 refreshFrame=0;
 document.querySelectorAll(spotlightSelector).forEach(el=>el.classList.add('bq-spotlight'));
 document.querySelectorAll(revealSelector).forEach(el=>{if(seen.has(el)||el.closest('[hidden]'))return;seen.add(el);if(observer)observer.observe(el);});
}
function queueRefresh(){if(!refreshFrame)refreshFrame=requestAnimationFrame(refresh);}
function configure(){
 observer?.disconnect();observer=null;
 if(!reduced.matches&&'IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{let i=0;for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);reveal(entry.target,i++);}},{threshold:.07});}
 if(reduced.matches){document.getAnimations().filter(a=>a.effect?.target?.closest?.('main')&&a.effect.getKeyframes().some(k=>k.transform==='translateY(15px)')).forEach(a=>a.cancel());}
 queueRefresh();
}
function paintPointer(){pointerFrame=0;if(!hovered||!point||reduced.matches||!precise.matches)return;const rect=hovered.getBoundingClientRect();hovered.style.setProperty('--mouse-x',point.x-rect.left+'px');hovered.style.setProperty('--mouse-y',point.y-rect.top+'px');}
if(document.body){
 configure();
 const mutations=new MutationObserver(records=>{
  const changed=records.some(r=>{
   if(r.target.nodeType===1&&r.target.closest('#frequencyChart,#graphLegend,#chartTable,.chart-tooltip,.editor-completions,#codeHighlight,#lineNumbers'))return false;
   if(r.type==='attributes'){
    if(r.attributeName==='open'&&r.target.matches('dialog[open]'))reveal(r.target);
    return r.attributeName==='hidden';
   }
   return [...r.addedNodes].some(n=>n.nodeType===1&&(n.matches(revealSelector+','+spotlightSelector)||n.querySelector(revealSelector+','+spotlightSelector)));
  });if(changed)queueRefresh();
 });
 mutations.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open']});
 document.addEventListener('pointermove',e=>{if(reduced.matches||!precise.matches)return;hovered=e.target.closest?.('.bq-spotlight');if(!hovered)return;point={x:e.clientX,y:e.clientY};if(!pointerFrame)pointerFrame=requestAnimationFrame(paintPointer);},{passive:true});
 const updateScroll=()=>{scrollFrame=0;header?.classList.toggle('bq-scrolled',scrollY>20);};
 addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(updateScroll);},{passive:true});
 addEventListener('hashchange',queueRefresh);addEventListener('pageshow',queueRefresh);
 reduced.addEventListener('change',configure);updateScroll();
}
