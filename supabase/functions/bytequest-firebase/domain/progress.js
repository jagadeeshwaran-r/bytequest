const idPattern=/^[a-z][a-z0-9-]{1,63}$/;
const maps=["drafts","solved","notes","confidence","reviews","attempts","modified"];
const object=value=>value&&typeof value==="object"&&!Array.isArray(value);
const time=value=>Number.isFinite(value)&&value>=0?value:0;
export function blankProgress(){return{version:1,current:"two-sum",currentUpdated:0,drafts:{},solved:{},notes:{},confidence:{},activity:[],days:[],reviews:{},attempts:{},modified:{}};}
export function validateProgress(value) {
  if(!object(value)||value.version!==1)throw new Error("This is not a ByteQuest progress backup.");
  const clean=blankProgress();
  const ids=new Set(maps.flatMap(m=>object(value[m])?Object.keys(value[m]):[]).filter(id=>idPattern.test(id)).slice(0,1000));
  for(const id of ids){
    if(typeof value.drafts?.[id]==="string"&&value.drafts[id].length<=60000)clean.drafts[id]=value.drafts[id];
    if(typeof value.notes?.[id]==="string")clean.notes[id]=value.notes[id].slice(0,4000);
    if([1,2,3].includes(value.confidence?.[id]))clean.confidence[id]=value.confidence[id];
    if(time(value.solved?.[id]))clean.solved[id]=value.solved[id];
    const r=value.reviews?.[id];if(r&&time(r.anchor)&&Number.isInteger(r.step)&&r.step>=0&&r.step<=3)clean.reviews[id]={anchor:r.anchor,step:r.step};
    const a=value.attempts?.[id];if(Number.isInteger(a)&&a>=0&&a<=100000)clean.attempts[id]=a;
    if(object(value.modified?.[id]))clean.modified[id]=Object.fromEntries(["drafts","notes","confidence"].map(field=>[field,time(value.modified[id][field])]));
  }
  clean.days=Array.isArray(value.days)?[...new Set(value.days.filter(d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(-1000):[];
  clean.activity=Array.isArray(value.activity)?value.activity.filter(a=>a&&idPattern.test(a.id)&&time(a.at)&&["attempt","solved","review"].includes(a.type)).slice(-200).map(a=>({id:a.id,at:a.at,type:a.type,passed:Math.max(0,Math.min(100,Number(a.passed)||0)),total:Math.max(0,Math.min(100,Number(a.total)||0))})):[];
  if(idPattern.test(value.current))clean.current=value.current;
  clean.currentUpdated=time(value.currentUpdated);
  return clean;
}
export function mergeProgress(first,second) {
  const a=validateProgress(first),b=validateProgress(second),out=blankProgress();
  const ids=new Set(maps.flatMap(m=>[...Object.keys(a[m]),...Object.keys(b[m])]));
  for(const id of ids){
    out.modified[id]={};
    for(const field of ["drafts","notes","confidence"]){
      const at=time(a.modified[id]?.[field]),bt=time(b.modified[id]?.[field]);
      const takeB=b[field][id]!==undefined&&(a[field][id]===undefined||bt>at);
      if((takeB?b:a)[field][id]!==undefined)out[field][id]=(takeB?b:a)[field][id];
      out.modified[id][field]=Math.max(at,bt);
    }
    const solved=[a.solved[id],b.solved[id]].filter(Boolean);if(solved.length)out.solved[id]=Math.min(...solved);
    const reviews=[a.reviews[id],b.reviews[id]].filter(Boolean);if(reviews.length)out.reviews[id]={anchor:Math.min(...reviews.map(r=>r.anchor)),step:Math.max(...reviews.map(r=>r.step))};
    if(a.attempts[id]||b.attempts[id])out.attempts[id]=Math.max(a.attempts[id]||0,b.attempts[id]||0);
  }
  out.days=[...new Set([...a.days,...b.days])].sort().slice(-1000);
  out.activity=[...new Map([...a.activity,...b.activity].map(e=>[e.id+"-"+e.type+"-"+e.at,e])).values()].sort((x,y)=>x.at-y.at).slice(-200);
  out.current=b.currentUpdated>a.currentUpdated?b.current:a.current;
  out.currentUpdated=Math.max(a.currentUpdated,b.currentUpdated);
  return out;
}
