import {escapeHtml as h} from './community-model.js';
export const pointValues=Object.freeze({Easy:10,Medium:25,Hard:50});
export const pointsFor=difficulty=>pointValues[difficulty]||0;
export function totalPoints(progress,catalog,now=Date.now()){return catalog.reduce((sum,p)=>{const at=progress.solved?.[p.id];return sum+(Number.isFinite(at)&&at>0&&at<=now?pointsFor(p.difficulty):0);},0);}
export function rankCup(rank){const name=({1:'Gold',2:'Silver',3:'Bronze'})[rank];if(!name)return '';return '<svg class="rank-cup '+name.toLowerCase()+'" viewBox="0 0 32 32" role="img" aria-label="'+name+' cup, rank '+h(rank)+'"><title>'+name+' · Rank '+h(rank)+'</title><path fill="currentColor" d="M9 4h14v9a7 7 0 0 1-6 6.93V24h5v4H10v-4h5v-4.07A7 7 0 0 1 9 13V4Z"/><path d="M9 7H5v4a6 6 0 0 0 6 6m12-10h4v4a6 6 0 0 1-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 6v6" stroke="white" stroke-opacity=".45" stroke-width="1.5" stroke-linecap="round"/></svg>';}

const ribbonPalette=Object.freeze({
  gold:{rim:'#f2ae16',edge:'#ffda55',face:'#ffd22e',inner:'#ffe679',star:'#e99b00'},
  silver:{rim:'#8795a5',edge:'#c9d5df',face:'#aebfce',inner:'#dce5ed',star:'#7c8fa4'},
  bronze:{rim:'#9c451f',edge:'#d88d4d',face:'#bf6536',inner:'#e6a565',star:'#87401e'}
});
function shapePoints(cx,cy,outer,inner,count=32,shift=-Math.PI/2){
 return Array.from({length:count},(_,i)=>{
  const angle=shift+i*Math.PI*2/count,rad=i%2?inner:outer;
  return (cx+Math.cos(angle)*rad).toFixed(1)+','+(cy+Math.sin(angle)*rad).toFixed(1);
 }).join(' ');
}
const ribbonSeal=shapePoints(34,29,27,24.8);
const ribbonStar=shapePoints(34,29,15.2,7.1,10);
// Profile-only medal: keep the existing rankCup for leaderboard screens.
export function rankRibbonBadge(rank){
 const tier=({1:'gold',2:'silver',3:'bronze'})[rank];
 if(!tier)return '';
 const colors=ribbonPalette[tier],name=tier[0].toUpperCase()+tier.slice(1);
 return '<span class="rank-ribbon tier-'+tier+'" role="img" aria-label="'+name+' ribbon badge, global rank '+rank+'" title="'+name+' ribbon · global rank '+rank+'">'+
  '<svg viewBox="0 0 68 78" aria-hidden="true" focusable="false">'+
   '<path d="M15 45 6 73 21 67 29 77 37 45Z" fill="#bd2033"/>'+
   '<path d="M34 44 41 76 48 66 64 71 52 43Z" fill="#ed3043"/>'+
   '<path d="M15 45 12 59 21 55 28 69 28 44Z" fill="#f15454" opacity=".8"/>'+
   '<path d="M42 45 47 65 53 57 56 67 51 44Z" fill="#a51b31" opacity=".6"/>'+
   '<polygon points="'+ribbonSeal+'" fill="'+colors.rim+'" stroke="'+colors.edge+'" stroke-width="2" stroke-linejoin="round"/>'+
   '<circle cx="34" cy="29" r="21.1" fill="'+colors.face+'" stroke="'+colors.inner+'" stroke-width="2.7"/>'+
   '<circle cx="34" cy="29" r="17.5" fill="'+colors.inner+'" opacity=".75"/>'+
   '<path d="M19 23c-4 8-2 16 4 21m26-21c4 8 2 16-4 21" fill="none" stroke="'+colors.rim+'" stroke-width="1.6" stroke-linecap="round" opacity=".72"/>'+
   '<polygon points="'+ribbonStar+'" fill="'+colors.star+'" stroke="'+colors.rim+'" stroke-width=".7" stroke-linejoin="round"/>'+
   '<circle cx="25" cy="13" r="1.3" fill="'+colors.edge+'" opacity=".9"/>'+
   '<circle cx="44" cy="13" r="1.3" fill="'+colors.edge+'" opacity=".9"/>'+
  '</svg></span>';
}
