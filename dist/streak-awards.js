// Profile awards are derived from historical UTC accepted-solve days returned
// by the authenticated profile API. A tier is earned once per uninterrupted
// streak run, not once every N days in the same run. Repeated runs award x2+.
// No mutable browser counter or localStorage is needed.
export const STREAK_BADGE_TIERS=Object.freeze([
 {days:7,name:'STREAKER',color:'silver'},
 {days:30,name:'CONSISTENT',color:'blue'},
 {days:100,name:'DEDICATED',color:'gold'},
 {days:200,name:'ELITE',color:'purple'},
 {days:365,name:'LEGENDARY',color:'red'}
]);
const MS_DAY=86400000;
function utcDayMillis(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const at=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(at)&&new Date(at).toISOString().slice(0,10)===value?at:null;
}
export function earnedStreakBadges(days=[],serverDay=new Date().toISOString().slice(0,10)){
 const cutoff=utcDayMillis(serverDay)??Date.now();
 const unique=new Set();
 if(Array.isArray(days))for(const date of days){
  const at=utcDayMillis(date);
  if(at!==null&&at<=cutoff)unique.add(at);
 }
 const sorted=[...unique].sort((a,b)=>a-b);
 const awards=STREAK_BADGE_TIERS.map(tier=>({...tier,count:0,lastEarned:null}));
 function finishRun(start,end,length){
  if(!length)return;
  for(const badge of awards){
   if(length<badge.days)continue;
   badge.count++;
   const earnedAt=new Date(start+(badge.days-1)*MS_DAY).toISOString().slice(0,10);
   if(!badge.lastEarned||earnedAt>badge.lastEarned)badge.lastEarned=earnedAt;
  }
 }
 let start=0,previous=0,length=0;
 for(const day of sorted){
  if(length&&day-previous!==MS_DAY){
   finishRun(start,previous,length);length=0;
  }
  if(!length)start=day;
  length++;previous=day;
 }
 finishRun(start,previous,length);
 return awards.filter(badge=>badge.count>0);
}
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
// Ink-stamped circular seal inspired by real approval rubber stamps.
// The mask has deterministic, tiny irregular gaps to suggest imperfect ink;
// no image requests or randomly moving decorations are needed.
function awardArtwork(badge){
 const id='bq-stamp-'+badge.days;
 const digits=String(badge.days);
 const size=digits.length===1?69:digits.length===2?61:46;
 const texture='<g fill="#000" stroke="#000" stroke-linecap="round">'+
  '<path d="M18 39l7 2-2 3-8-3zM130 28l7-3 1 3-7 4zM17 101l7-1-1 3-7 1zM134 111l9 2-2 3-8-2z"/>'+
  '<path d="M44 12l4 3-1 2-4-3zM108 146l6-2 1 2-5 3zM39 125l3 4-2 2-3-4z"/>'+
  '<path d="M51 66l5 1-1 2-5-1zM104 90l4-2 1 2-4 3zM70 99l3 2-2 2-3-3z"/>'+
  '<circle cx="106" cy="19" r="1.7"/><circle cx="32" cy="133" r="1.8"/>'+
  '<circle cx="141" cy="65" r="1.5"/><circle cx="21" cy="73" r="1.1"/>'+
  '</g>';
 return '<svg viewBox="0 0 160 160" class="streak-award-art streak-award-stamp" aria-hidden="true" focusable="false">'+
  '<defs>'+
   '<path id="'+id+'-top" d="M30 80 A50 50 0 0 1 130 80"/>'+
   '<path id="'+id+'-bottom" d="M27 80 A53 53 0 0 0 133 80"/>'+
   '<mask id="'+id+'-ink" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="160">'+
    '<rect width="160" height="160" fill="#fff"/>'+texture+
   '</mask>'+
  '</defs>'+
  '<g mask="url(#'+id+'-ink)" class="stamp-impression">'+
   '<circle class="stamp-ring stamp-ring-outer" cx="80" cy="80" r="71"/>'+
   '<circle class="stamp-ring stamp-ring-middle" cx="80" cy="80" r="63"/>'+
   '<circle class="stamp-ring stamp-ring-inner" cx="80" cy="80" r="47"/>'+
   '<text class="stamp-curve-text"><textPath href="#'+id+'-top" startOffset="50%" text-anchor="middle">BYTEQUEST</textPath></text>'+
   '<text class="stamp-curve-text stamp-bottom"><textPath href="#'+id+'-bottom" startOffset="50%" text-anchor="middle">DAY STREAK</textPath></text>'+
   '<text class="stamp-stars" x="80" y="58" text-anchor="middle">&#9733; &#9733; &#9733;</text>'+
   '<g transform="rotate(-11 80 86)">'+
    '<text class="stamp-number" x="80" y="102" text-anchor="middle" style="font-size:'+size+'px">'+digits+'</text>'+
   '</g>'+
   '<path class="stamp-rule" d="M54 113H106"/>'+
   '<text class="stamp-tier" x="80" y="125" text-anchor="middle">'+badge.name+'</text>'+
   '<circle class="stamp-mark" cx="20" cy="80" r="2.4"/><circle class="stamp-mark" cx="140" cy="80" r="2.4"/>'+
  '</g></svg>';
}
export function earnedStreakBadgesMarkup(days,serverDay){
 const earned=earnedStreakBadges(days,serverDay);
 if(!earned.length)return '';
 return '<section class="streak-awards" aria-labelledby="streakAwardsTitle">'+
  '<div class="streak-awards-heading"><div><span class="eyebrow">ACHIEVEMENTS</span>'+
  '<h3 id="streakAwardsTitle">Streak badges</h3></div>'+
  '<p>Lifetime milestones · earned from consecutive UTC solve days</p></div>'+
  '<div class="streak-awards-list" role="list">'+earned.map(badge=>{
   const description=badge.days+'-day '+badge.name.toLowerCase()+' streak badge earned '+badge.count+
    (badge.count===1?' time':' times')+', last earned '+badge.lastEarned;
   return '<div class="streak-award tier-'+badge.color+'" role="listitem" data-days="'+badge.days+
    '" data-count="'+badge.count+'" aria-label="'+esc(description)+'" title="'+esc(description)+'">'+
    awardArtwork(badge)+(badge.count>1?'<span class="streak-award-multiplier" aria-label="Earned '+badge.count+' times">×'+badge.count+'</span>':'')+
    '</div>';
  }).join('')+'</div></section>';
}
