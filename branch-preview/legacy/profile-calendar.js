const iso=d=>d.toISOString().slice(0,10);
function validDay(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&iso(d)===s;}
export function monthCalendar(days,serverDay=new Date().toISOString().slice(0,10)){
 const today=validDay(serverDay)?new Date(serverDay+'T12:00:00Z'):new Date();today.setUTCHours(12,0,0,0);const end=iso(today),active=new Set((Array.isArray(days)?days:[]).filter(d=>validDay(d)&&d<=end)),months=[];
 for(let offset=-11;offset<=0;offset++){
  const start=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()+offset,1,12)),last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0,12));if(iso(last)>end)last.setTime(today.getTime());
  const cells=Array.from({length:start.getUTCDay()},()=>null);for(let at=new Date(start);at<=last;at.setUTCDate(at.getUTCDate()+1)){const day=iso(at);cells.push({date:day,active:active.has(day)});}while(cells.length%7)cells.push(null);
  months.push({key:iso(start).slice(0,7),label:start.toLocaleDateString('en',{month:'short',timeZone:'UTC'})+(offset===-11||start.getUTCMonth()===0?' '+String(start.getUTCFullYear()).slice(-2):''),title:start.toLocaleDateString('en',{month:'long',year:'numeric',timeZone:'UTC'}),cells});
 }
 return{months,start:months[0].key+'-01',end};
}

/* Selectable full-year heatmap. Accepted days remain UTC and historical data is
   derived from the profile API; no estimates or generated solves are added. */
function utcToday(serverDay){
 const day=validDay(serverDay)?serverDay:iso(new Date());
 return {day,year:Number(day.slice(0,4))};
}
export function calendarYears(days,serverDay=new Date().toISOString().slice(0,10)){
 const {day,year}=utcToday(serverDay);
 let oldest=year-5;
 for(const value of Array.isArray(days)?days:[]){
  if(validDay(value)&&value<=day)oldest=Math.min(oldest,Number(value.slice(0,4)));
 }
 return Array.from({length:year-Math.max(2000,oldest)+1},(_,index)=>year-index);
}
export function yearCalendar(days,serverDay=new Date().toISOString().slice(0,10),selectedYear=null){
 const {day,year:currentYear}=utcToday(serverDay);
 const year=Number.isInteger(selectedYear)&&selectedYear>=2000&&selectedYear<=currentYear?selectedYear:currentYear;
 const active=new Set((Array.isArray(days)?days:[]).filter(value=>validDay(value)&&value<=day));
 const months=[];
 for(let monthIndex=0;monthIndex<12;monthIndex++){
  const first=new Date(Date.UTC(year,monthIndex,1,12));
  const last=new Date(Date.UTC(year,monthIndex+1,0,12));
  const cells=Array.from({length:first.getUTCDay()},()=>null);
  let count=0;
  for(let at=new Date(first);at<=last;at.setUTCDate(at.getUTCDate()+1)){
   const date=iso(at),future=date>day,solved=!future&&active.has(date);
   if(solved)count++;
   cells.push({date,active:solved,future});
  }
  while(cells.length%7)cells.push(null);
  months.push({
   key:iso(first).slice(0,7),
   label:first.toLocaleDateString('en',{month:'short',timeZone:'UTC'}),
   title:first.toLocaleDateString('en',{month:'long',year:'numeric',timeZone:'UTC'}),
   cells,solves:count
  });
 }
 return {year,start:year+'-01-01',end:year===currentYear?day:year+'-12-31',activeCount:months.reduce((total,month)=>total+month.solves,0),months};
}
// Show accepted UTC solve days without a special today border or animation.
export function calendarMonthsMarkup(calendar){
 return calendar.months.map(month=>
  '<section class="calendar-month" aria-label="'+month.title+'">'+
  '<span class="calendar-month-label">'+month.label+'</span>'+
  '<div class="calendar-month-grid">'+month.cells.map(cell=>{
   if(!cell)return '<span class="calendar-padding" aria-hidden="true"></span>';
   const label=cell.date+(cell.active?': accepted solve':cell.future?': upcoming':': no solve');
   return '<span class="calendar-day'+(cell.active?' solved':'')+(cell.future?' future':'')+
    '" data-calendar-date="'+cell.date+'" title="'+label+'"></span>';
  }).join('')+'</div></section>'
 ).join('');
}
// Repaint only when switching years or crossing UTC midnight. The server's
// accepted days are never fabricated by the visual indicator.
export function refreshProfileCalendar(root,days,serverDay,now=Date.now()){
 const picker=root?.querySelector?.('#profileCalendarYear'),
  grid=root?.querySelector?.('#profileCalendarMonths'),
  range=root?.querySelector?.('#profileCalendarRange'),
  activity=root?.querySelector?.('#profileCalendarActivity');
 if(!picker||!grid||!range||!activity)return false;
 const actualUtc=iso(new Date(now));
 const effectiveDay=validDay(serverDay)&&serverDay>actualUtc?serverDay:actualUtc;
 const year=Number(picker.value);
 const knownYears=Array.from(picker.options||[]).map(option=>Number(option.value));
 const newestKnownYear=Math.max(year,...knownYears);
 if(knownYears.length&&Number(actualUtc.slice(0,4))>newestKnownYear){
  // The page may stay open across New Year's Eve. Add the new year without
  // discarding the user's past-year selection on ordinary refreshes.
  if(typeof picker.add==='function'){
   const option=(picker.ownerDocument||root.ownerDocument)?.createElement?.('option')||{value:'',textContent:''};
   option.value=actualUtc.slice(0,4);option.textContent=actualUtc.slice(0,4);
   picker.add(option,0);
  }
  picker.value=actualUtc.slice(0,4);
 }
 const calendar=yearCalendar(days,effectiveDay,Number(picker.value));
 grid.innerHTML=calendarMonthsMarkup(calendar);
 grid.setAttribute('aria-label','Accepted solve days in '+calendar.year);
 range.textContent=calendar.start+' → '+calendar.end;
 activity.textContent=calendar.activeCount+' '+(calendar.activeCount===1?'solve day':'solve days');
 return true;
}
export function bindProfileCalendar(root,days,serverDay){
 const picker=root?.querySelector?.('#profileCalendarYear');
 if(!picker||!root.querySelector?.('#profileCalendarMonths')||!root.querySelector?.('#profileCalendarRange')||!root.querySelector?.('#profileCalendarActivity'))return false;
 picker.addEventListener('change',()=>refreshProfileCalendar(root,days,serverDay));
 return true;
}
