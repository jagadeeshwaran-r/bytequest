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
// Compact premium digital emblem. No ribbons, shields-with-laurels, or fake 3D.
// All tier artwork is inline SVG so it stays crisp at small sizes and needs no assets.
function awardArtwork(badge){
 const id='bq-award-'+badge.days;
 const count=String(badge.days).padStart(2,'0');
 return '<svg viewBox="0 0 120 132" class="streak-award-art" aria-hidden="true" focusable="false">'+
  '<defs><linearGradient id="'+id+'-metal" x1="0%" y1="0%" x2="100%" y2="100%">'+
   '<stop offset="0%" stop-color="var(--badge-metal)"/>'+
   '<stop offset="48%" stop-color="var(--badge-outline)"/>'+
   '<stop offset="100%" stop-color="var(--badge-metal)"/></linearGradient></defs>'+
  '<path class="streak-art-plate" d="M60 7 97 19 110 43 110 94 60 123 10 94 10 43 23 19Z" fill="var(--badge-dark)" stroke="url(#'+id+'-metal)" stroke-width="1.75" stroke-linejoin="round"/>'+
  '<path class="streak-art-inset" d="M60 15 92 25 102 45 102 90 60 114 18 90 18 45 28 25Z" fill="none" stroke="var(--badge-outline)" stroke-width="1" stroke-linejoin="round"/>'+
  '<path d="M43 35H77" fill="none" stroke="var(--badge-accent)" stroke-width="1.4" stroke-linecap="round" opacity=".85"/>'+
  '<circle cx="60" cy="26" r="2.4" fill="var(--accent, #26c695)"/>'+
  '<text x="60" y="79" class="streak-art-number" text-anchor="middle">'+count+'</text>'+
  '<text x="60" y="95" class="streak-art-days" text-anchor="middle">DAYS</text>'+
  '<path d="M35 103H85" fill="none" stroke="var(--badge-outline)" stroke-width="1"/>'+
  '<text x="60" y="113" class="streak-art-name" text-anchor="middle">'+badge.name+'</text>'+
  '</svg>';
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
