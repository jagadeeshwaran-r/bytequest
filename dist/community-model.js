export function dateKey(date){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
export function activityStats(days,now=new Date()){
 const valid=new Set((Array.isArray(days)?days:[]).filter(s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&dateKey(new Date(s+'T12:00:00'))===s&&s<=dateKey(now)));
 const cursor=new Date(now);cursor.setHours(12,0,0,0);let streak=0;
 if(!valid.has(dateKey(cursor)))cursor.setDate(cursor.getDate()-1);
 while(valid.has(dateKey(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
 const end=new Date(now);end.setHours(12,0,0,0);const start=new Date(end);start.setDate(start.getDate()-364);start.setDate(start.getDate()-start.getDay());
 const cells=[];for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const key=dateKey(d);cells.push({date:key,active:valid.has(key)});}
 return {streak,activeDays:valid.size,cells};
}
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
