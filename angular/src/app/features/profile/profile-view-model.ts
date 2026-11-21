/** Server-backed rendering helpers shared by native profile and its regression tests.
 * No synthetic solves, statuses or achievement counters are generated here. */
export interface SolveEvent{readonly day:string;readonly topic?:string|null}
export interface CalendarCell{readonly date:string;readonly active:boolean;readonly future:boolean}
export interface CalendarMonth{readonly index:number;readonly name:string;readonly cells:readonly (CalendarCell|null)[]}
export interface StreakAward{readonly days:number;readonly name:string;readonly color:string;readonly count:number;readonly lastEarned:string}
export interface GraphPoint{readonly x:number;readonly y:number;readonly label:string;readonly value:number}
export interface GraphSeries{readonly id:string;readonly label:string;readonly color:string;readonly d:string;readonly points:readonly GraphPoint[]}
export interface GraphData{readonly series:readonly GraphSeries[];readonly yTicks:readonly {value:number;y:number}[];readonly xTicks:readonly {x:number;label:string}[];readonly note:string}
export type GraphMode='daily'|'monthly'|'yearly';
export type GraphMeasure='period'|'cumulative';
export interface ChartSettings{readonly mode:GraphMode;readonly measure:GraphMeasure;readonly month:string;readonly year:number;readonly topic:string;readonly showForecast:boolean;readonly today:string}
export interface GraphUser{readonly id:string;readonly label:string;readonly color:string;readonly solves:readonly SolveEvent[]}
const DAY=86400000;
export const utcISO=(date:Date)=>date.toISOString().slice(0,10);
export const validUTC=(value:unknown):value is string=>
  typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
  Number.isFinite(Date.parse(value+'T00:00:00Z'))&&utcISO(new Date(value+'T00:00:00Z'))===value;
const TIERS=[
 {days:7,name:'STREAKER',color:'silver'},
 {days:30,name:'CONSISTENT',color:'blue'},
 {days:100,name:'DEDICATED',color:'gold'},
 {days:200,name:'ELITE',color:'purple'},
 {days:365,name:'LEGENDARY',color:'red'}
] as const;
export function earnedStreakAwards(days:readonly string[],serverDay:string):readonly StreakAward[]{
 const cutoff=validUTC(serverDay)?serverDay:utcISO(new Date());
 const unique=[...new Set(days.filter(d=>validUTC(d)&&d<=cutoff).map(d=>Date.parse(d+'T00:00:00Z')))].sort((a,b)=>a-b);
 const awards:StreakAward[]=TIERS.map(t=>({...t,count:0,lastEarned:''}));
 let first=0,last=0,length=0;
 const closeRun=()=>{
   for(let i=0;i<awards.length;i++){
     const award=awards[i];if(length<award.days)continue;
     awards[i]={...award,count:award.count+1,lastEarned:utcISO(new Date(first+(award.days-1)*DAY))};
   }
 };
 for(const day of unique){
   if(length&&day-last!==DAY){closeRun();length=0;}
   if(!length)first=day;
   last=day;length++;
 }
 if(length)closeRun();
 return awards.filter(a=>a.count>0);
}
export function profileCalendar(year:number,days:readonly string[],serverDay:string):readonly CalendarMonth[]{
 const active=new Set(days.filter(validUTC)),cutoff=validUTC(serverDay)?serverDay:utcISO(new Date());
 const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 return names.map((name,index)=>{
   const first=new Date(Date.UTC(year,index,1));
   const last=new Date(Date.UTC(year,index+1,0));
   const cells:(CalendarCell|null)[]=Array.from({length:first.getUTCDay()},()=>null);
   for(let at=new Date(first);at<=last;at.setUTCDate(at.getUTCDate()+1)){
     const date=utcISO(at);
     cells.push({date,active:date<=cutoff&&active.has(date),future:date>cutoff});
   }
   while(cells.length%7)cells.push(null);
   return {index,name,cells};
 });
}
export function countdownToUTC(ms:number):string{
 const sec=Math.ceil((DAY-(ms%DAY))/1000);
 return [Math.floor(sec/3600),Math.floor((sec%3600)/60),sec%60]
   .map(n=>String(n).padStart(2,'0')).join(':');
}
export function solveRelativeTime(value:string|undefined,now:number):string{
 if(!value)return 'Solved';
 const at=Date.parse(value);if(!Number.isFinite(at))return 'Solved';
 const seconds=Math.max(0,Math.floor((now-at)/1000));
 if(seconds<60)return 'just now';
 if(seconds<3600)return Math.floor(seconds/60)+' minutes ago';
 if(seconds<86400)return Math.floor(seconds/3600)+' hrs ago';
 if(seconds<2592000)return Math.floor(seconds/86400)+' days ago';
 return new Date(at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function smoothPath(points:readonly GraphPoint[]):string{
 if(!points.length)return '';
 let path='M'+points[0].x+' '+points[0].y;
 for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],mid=(a.x+b.x)/2;
   path+=' C'+mid+' '+a.y+' '+mid+' '+b.y+' '+b.x+' '+b.y;
 }
 return path;
}
export function solvingGraph(users:readonly GraphUser[],settings:ChartSettings):GraphData{
 const empty:GraphData={series:[],yTicks:[{value:0,y:216}],xTicks:[],note:'No accepted solve records yet.'};
 if(!validUTC(settings.today))return empty;
 const mode=settings.mode,measure=settings.measure;
 let keys:string[]=[],labels:string[]=[],allowed:boolean[]=[];
 if(mode==='daily'){
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(settings.month))return empty;
   const [y,m]=settings.month.split('-').map(Number);
   const total=new Date(Date.UTC(y,m,0)).getUTCDate();
   keys=Array.from({length:total},(_,i)=>settings.month+'-'+String(i+1).padStart(2,'0'));
   labels=keys.map(k=>k.slice(5));
   allowed=keys.map(k=>k<=settings.today);
 }else if(mode==='monthly'){
   keys=Array.from({length:12},(_,i)=>settings.year+'-'+String(i+1).padStart(2,'0'));
   labels=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
   allowed=keys.map(k=>k<=settings.today.slice(0,7));
 }else{
   const end=Number(settings.today.slice(0,4));
   keys=Array.from({length:6},(_,i)=>String(end-5+i));
   labels=[...keys];allowed=keys.map(k=>Number(k)<=end);
 }
 const keyOf=(day:string)=>mode==='daily'?day:mode==='monthly'?day.slice(0,7):day.slice(0,4);
 const values=users.map(user=>{
   const grouped=new Map<string,number>();
   for(const event of user.solves){
     if(!validUTC(event.day)||event.day>settings.today||(settings.topic&&event.topic!==settings.topic))continue;
     const key=keyOf(event.day);grouped.set(key,(grouped.get(key)||0)+1);
   }
   let cumulative=0;
   const counts=keys.map((key,i)=>{
     if(!allowed[i])return null;
     const period=grouped.get(key)||0;cumulative+=period;
     return measure==='period'?period:cumulative;
   });
   return {...user,counts};
 });
 const top=Math.max(1,...values.flatMap(v=>v.counts.filter((n):n is number=>n!==null)));
 const scaleY=(v:number)=>216-v/top*191;
 const scaleX=(i:number)=>45+(keys.length>1?i*865/(keys.length-1):0);
 const series=values.map(v=>{
   const points=v.counts.flatMap((num,i)=>num===null?[]:[{x:scaleX(i),y:scaleY(num),label:keys[i],value:num}]);
   return {id:v.id,label:v.label,color:v.color,points,d:smoothPath(points)};
 });
 const yTicks=Array.from({length:4},(_,i)=>({value:Number((i*top/3).toFixed(1)),y:scaleY(i*top/3)}));
 const xTicks=keys.flatMap((key,i)=>(mode==='daily'&&i%5!==0&&i!==keys.length-1)?[]:[{x:scaleX(i),label:labels[i]}]);
 const real=users[0]?.solves.filter(x=>validUTC(x.day)&&x.day<=settings.today&&(!settings.topic||x.topic===settings.topic))||[];
 const active=new Set(real.map(s=>s.day)).size;
 const oldest=real.reduce((earliest,e)=>Math.min(earliest,Date.parse(e.day+'T00:00:00Z')),Infinity);
 const history=Number.isFinite(oldest)?Math.round((Date.parse(settings.today+'T00:00:00Z')-oldest)/DAY)+1:0;
 const qualified=history>=56&&real.length>=10&&active>=7;
 const note=!settings.showForecast?'Forecast hidden.':
   !qualified?'No forecast yet: each learner needs at least 56 days of solving history, 10 accepted problems and 7 distinct solve days. Historical outcomes cannot guarantee the future.':
   'Forecast requires validated backtesting before displaying estimates; historical activity never guarantees future solves.';
 // The source model is backtested; do not invent a projection with an arbitrary trend line.
 return {series,yTicks,xTicks,note};
}
