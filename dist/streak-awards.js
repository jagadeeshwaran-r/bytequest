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
// Recreate a tactile rubber stamp using self-contained, theme-aware vector ink.
// Seeded abrasion creates imperfect physical impressions without network assets.
// Rendered SVG remains lightweight, accessible, and dynamic for every earned tier.
function stampWear(days){
 let seed=(0x9e3779b9^days)>>>0;
 const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const fixed=x=>x.toFixed(1);
 let chips='<g fill="#000">';
 // Torn, inconsistently printed edges around the two circular borders.
 for(let i=0;i<32;i++){
  const angle=rnd()*Math.PI*2,radius=(i%2?82:91)+(rnd()-.5)*5;
  const x=100+radius*Math.cos(angle),y=100+radius*Math.sin(angle);
  const width=1.6+rnd()*6.2,height=.5+rnd()*2.5;
  chips+='<ellipse cx="'+fixed(x)+'" cy="'+fixed(y)+'" rx="'+fixed(width)+'" ry="'+fixed(height)+'" transform="rotate('+fixed(angle*180/Math.PI)+' '+fixed(x)+' '+fixed(y)+')"/>';
 }
 // Fine ink loss; deterministic to avoid re-render flicker.
 for(let i=0;i<124;i++){
  const x=9+rnd()*182,y=9+rnd()*182;
  if(Math.hypot(x-100,y-100)>96)continue;
  chips+='<circle cx="'+fixed(x)+'" cy="'+fixed(y)+'" r="'+fixed(.25+rnd()*.88)+'"/>';
 }
 // Uneven pressure along the angled DAY impression.
 for(let i=0;i<18;i++){
  const x=48+rnd()*104,y=(i%2?110:139)+(rnd()-.5)*4;
  chips+='<ellipse cx="'+fixed(x)+'" cy="'+fixed(y)+'" rx="'+fixed(.5+rnd()*2)+'" ry="'+fixed(.5+rnd()*1.2)+'"/>';
 }
 // Clear room for the bottom lettering without cutting the outer circumference.
 chips+='<rect x="54" y="157" width="92" height="22"/>';
 return chips+'</g>';
}
function awardArtwork(badge){
 const id='bq-stamp-'+badge.days;
 const digits=String(badge.days),size=digits.length===1?95:digits.length===2?82:62;
 const wear=stampWear(badge.days);
 return '<svg viewBox="0 0 200 200" class="streak-award-art streak-award-stamp" aria-hidden="true" focusable="false">'+
  '<defs>'+
   '<path id="'+id+'-arc" d="M37 100 A63 63 0 0 1 163 100"/>'+
   '<mask id="'+id+'-ink" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">'+
    '<rect width="200" height="200" fill="#fff"/>'+wear+
   '</mask>'+
  '</defs>'+
  '<g class="stamp-ink-rings" mask="url(#'+id+'-ink)">'+
   '<circle class="stamp-ring stamp-ring-outer" cx="100" cy="100" r="91"/>'+
   '<circle class="stamp-ring stamp-ring-inner" cx="100" cy="100" r="82"/>'+
  '</g>'+
  '<g class="stamp-impression" mask="url(#'+id+'-ink)">'+
   '<text class="stamp-curve-text"><textPath href="#'+id+'-arc" startOffset="50%" text-anchor="middle">BYTEQUEST</textPath></text>'+
   '<text class="stamp-number" x="100" y="120" text-anchor="middle" style="font-size:'+size+'px">'+digits+'</text>'+
   '<text class="stamp-star" x="35" y="109" text-anchor="middle">★</text>'+
   '<text class="stamp-star" x="165" y="109" text-anchor="middle">★</text>'+
  '</g>'+
  '<g class="stamp-day-band" transform="rotate(-9 100 124)">'+
   '<rect class="stamp-day-ink" x="48" y="110" width="104" height="29" rx="1" mask="url(#'+id+'-ink)"/>'+
   '<text class="stamp-day-text" x="100" y="132" text-anchor="middle">DAY</text>'+
  '</g>'+
  '<text class="stamp-bottom-word" x="100" y="176" text-anchor="middle">STREAK</text>'+
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
    awardArtwork(badge)+'<span class="streak-award-name" aria-hidden="true">'+badge.name+'</span>'+(badge.count>1?'<span class="streak-award-multiplier" aria-label="Earned '+badge.count+' times">×'+badge.count+'</span>':'')+
    '</div>';
  }).join('')+'</div></section>';
}
