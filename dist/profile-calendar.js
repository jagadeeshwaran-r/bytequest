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
