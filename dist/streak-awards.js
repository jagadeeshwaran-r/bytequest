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
// Clean rubber-stamp seal: only outer rings carry ink wear. Curved lettering
// stays in the top rim; the center day number and caption never cross a ring.
// Avoid competing curved text or a third inner circle below the number.
function awardArtwork(badge){
 const id='bq-stamp-'+badge.days;
 const digits=String(badge.days);
 const size=digits.length===1?74:digits.length===2?62:45;
 const inkGaps='<g fill="#000">'+
  '<path d="M17 39l5 2-1 2-6-2zM135 40l6-2 1 2-6 3zM22 115l5-1 1 2-6 2zM125 127l7 2-1 3-7-3z"/>'+
  '<path d="M51 11l4 1-1 2-4-1zM101 148l4-2 1 2-4 2z"/>'+
  '<circle cx="11" cy="78" r="1.1"/><circle cx="145" cy="74" r="1.5"/>'+
  '</g>';
 return '<svg viewBox="0 0 160 160" class="streak-award-art streak-award-stamp" aria-hidden="true" focusable="false">'+
  '<defs>'+
   '<path id="'+id+'-top" d="M27 80 A53 53 0 0 1 133 80"/>'+
   '<mask id="'+id+'-ink" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="160">'+
    '<rect width="160" height="160" fill="#fff"/>'+inkGaps+
   '</mask>'+
  '</defs>'+
  '<g class="stamp-ink-rings" mask="url(#'+id+'-ink)">'+
   '<circle class="stamp-ring stamp-ring-outer" cx="80" cy="80" r="72"/>'+
   '<circle class="stamp-ring stamp-ring-middle" cx="80" cy="80" r="64"/>'+
  '</g>'+
  '<g class="stamp-crisp-lettering">'+
   '<text class="stamp-curve-text"><textPath href="#'+id+'-top" startOffset="50%" text-anchor="middle">BYTEQUEST</textPath></text>'+
   '<circle class="stamp-mark" cx="21" cy="80" r="1.8"/><circle class="stamp-mark" cx="139" cy="80" r="1.8"/>'+
   '<text class="stamp-number" x="80" y="103" text-anchor="middle" style="font-size:'+size+'px">'+digits+'</text>'+
   '<text class="stamp-day-label" x="80" y="127" text-anchor="middle">DAY STREAK</text>'+
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
    awardArtwork(badge)+'<span class="streak-award-name" aria-hidden="true">'+badge.name+'</span>'+(badge.count>1?'<span class="streak-award-multiplier" aria-label="Earned '+badge.count+' times">×'+badge.count+'</span>':'')+
    '</div>';
  }).join('')+'</div></section>';
}
