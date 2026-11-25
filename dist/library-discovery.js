// Pure catalog discovery helpers. Never infer unsolved status while account history is pending.
const order={Easy:0,Medium:1,Hard:2};
export function sortCatalog(rows,sort,numbers,recent=[]){
 const rank=new Map(recent.map((id,i)=>[id,i]));
 const cmp=(a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='difficulty'?(order[a.difficulty]??9)-(order[b.difficulty]??9):sort==='recent'?(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity):sort==='number-desc'?numbers.get(b.id)-numbers.get(a.id):0;
 return [...rows].sort((a,b)=>cmp(a,b)||numbers.get(a.id)-numbers.get(b.id));
}
export function catalogPage(rows,page,size=25){
 const totalPages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(totalPages,Math.max(1,Math.trunc(page)||1));
 return {rows:rows.slice((current-1)*size,current*size),page:current,totalPages,start:rows.length?(current-1)*size+1:0,end:Math.min(current*size,rows.length)};
}
export function pickUnsolved(rows,solved,ready,random=Math.random){
 if(!ready)return null;
 const candidates=rows.filter(p=>!Object.hasOwn(solved,p.id)||!solved[p.id]);
 return candidates[Math.floor(random()*candidates.length)]||null;
}
export function readBookmarks(storage,key){
 try{const values=JSON.parse(storage.getItem(key)||'[]');return new Set(Array.isArray(values)?values.filter(v=>typeof v==='string'&&/^[a-z][a-z0-9-]{1,79}$/.test(v)).slice(0,4000):[]);}catch{return new Set();}
}
export function recentAttempts(activity){
 return [...new Set((Array.isArray(activity)?[...activity]:[]).reverse().filter(a=>a&&typeof a.id==='string').map(a=>a.id))];
}
