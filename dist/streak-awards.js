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
function awardArtwork(badge){
 const id='bq-award-'+badge.days;
 return '<svg viewBox="0 0 136 174" class="streak-award-art" aria-hidden="true" focusable="false">'+
  '<defs><linearGradient id="'+id+'-edge" x1="0" y1="0" x2="1" y2="1">'+
   '<stop offset="0" stop-color="var(--badge-light)"/><stop offset=".55" stop-color="var(--badge-edge)"/><stop offset="1" stop-color="var(--badge-shadow)"/></linearGradient>'+
   '<linearGradient id="'+id+'-ribbon" x1="0" y1="0" x2="1" y2="1">'+
   '<stop offset="0" stop-color="var(--badge-light)"/><stop offset=".55" stop-color="var(--badge-edge)"/><stop offset="1" stop-color="var(--badge-shadow)"/></linearGradient></defs>'+
  '<path d="M20 112 5 166 28 154 44 168 53 112Z" fill="var(--badge-shadow)" stroke="var(--badge-edge)" stroke-width="1.1"/>'+
  '<path d="M83 112 92 168 108 154 131 166 116 112Z" fill="var(--badge-shadow)" stroke="var(--badge-edge)" stroke-width="1.1"/>'+
  '<path d="M68 5 119 32 119 109 68 139 17 109 17 32Z" fill="var(--badge-dark)" stroke="url(#'+id+'-edge)" stroke-width="6" stroke-linejoin="round"/>'+
  '<path d="M68 15 109 37 109 104 68 128 27 104 27 37Z" fill="none" stroke="var(--badge-light)" stroke-width="1" opacity=".45"/>'+
  '<g fill="none" stroke="var(--badge-light)" stroke-width="2" stroke-linecap="round">'+
   '<rect x="60" y="28" width="16" height="15" rx="1.5"/><path d="M60 33h16M64 26v5M72 26v5M64 37h2M69 37h2"/></g>'+
  '<g fill="none" stroke="var(--badge-edge)" stroke-width="1.4" stroke-linecap="round" opacity=".8">'+
   '<path d="M44 104Q26 87 34 56"/><path d="M92 104Q110 87 102 56"/></g>'+
  '<g fill="var(--badge-light)" opacity=".87">'+
   '<ellipse cx="31" cy="64" rx="2.2" ry="6" transform="rotate(-24 31 64)"/>'+
   '<ellipse cx="35" cy="77" rx="2.2" ry="6" transform="rotate(-45 35 77)"/>'+
   '<ellipse cx="40" cy="88" rx="2.2" ry="6" transform="rotate(-62 40 88)"/>'+
   '<ellipse cx="43" cy="96" rx="2.2" ry="5" transform="rotate(-70 43 96)"/>'+
   '<ellipse cx="105" cy="64" rx="2.2" ry="6" transform="rotate(24 105 64)"/>'+
   '<ellipse cx="101" cy="77" rx="2.2" ry="6" transform="rotate(45 101 77)"/>'+
   '<ellipse cx="96" cy="88" rx="2.2" ry="6" transform="rotate(62 96 88)"/>'+
   '<ellipse cx="93" cy="96" rx="2.2" ry="5" transform="rotate(70 93 96)"/></g>'+
  '<text x="68" y="81" class="streak-art-number" text-anchor="middle">'+badge.days+'</text>'+
  '<text x="68" y="96" class="streak-art-days" text-anchor="middle">DAYS</text>'+
  '<path d="M11 114H125L132 129 121 143H15L4 129Z" fill="url(#'+id+'-ribbon)" stroke="var(--badge-light)" stroke-width="1" stroke-linejoin="round"/>'+
  '<text x="68" y="133" class="streak-art-name" text-anchor="middle">'+badge.name+'</text>'+
  '<path d="m61 149 7 6 7-6" fill="none" stroke="var(--badge-light)" stroke-width="2" stroke-linecap="round" opacity=".8"/>'+
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
