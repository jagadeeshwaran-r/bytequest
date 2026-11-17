const idPattern=/^[a-z][a-z0-9-]{1,79}$/;
const maps=["drafts","solved","notes","confidence","reviews","attempts","modified"];
const object=value=>value&&typeof value==="object"&&!Array.isArray(value);
// Browser Java Submit history is private, owner-scoped, self-reported progress.
// Never use it to unlock verified shared submissions or benchmark rankings.
// Bound records and source sizes below the existing 1 MB progress payload cap.
export const MAX_PRACTICE_SUBMISSIONS=35;
export const MAX_PRACTICE_SOURCE=20000;
const practiceStatus=new Set(["practice_accepted","wrong_answer","compile_error","runtime_error","time_limit_exceeded","unavailable"]);
const practiceId=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function normalizePractice(row){
  if(!object(row)||!practiceId.test(row.id)||!idPattern.test(row.problemId)||row.language!=="java"||
     !practiceStatus.has(row.status)||!Number.isSafeInteger(row.revision)||row.revision<0||row.revision>1000000000||
     !Number.isSafeInteger(row.at)||row.at<946684800000||row.at>7258118400000||
     typeof row.source!=="string"||row.source.length>60000||!Number.isSafeInteger(row.total)||row.total<1||row.total>500||
     !Number.isSafeInteger(row.passed)||row.passed<0||row.passed>row.total)return null;
  const elapsed=Number.isFinite(row.elapsedMs)&&row.elapsedMs>=0&&row.elapsedMs<=86400000?row.elapsedMs:null;
  return {id:row.id.toLowerCase(),problemId:row.problemId,revision:row.revision,language:"java",
    status:row.status,at:row.at,source:row.source.slice(0,MAX_PRACTICE_SOURCE),
    sourceTruncated:row.sourceTruncated===true||row.source.length>MAX_PRACTICE_SOURCE,
    passed:row.passed,total:row.total,elapsedMs:elapsed,
    hiddenSkipped:row.hiddenSkipped===true,customCount:Number.isInteger(row.customCount)&&row.customCount>=0&&row.customCount<=8?row.customCount:0};
}
export function normalizePracticeSubmissions(rows){
 const byId=new Map();
 if(Array.isArray(rows))for(const row of rows.slice(-250)){
  const entry=normalizePractice(row);if(entry)byId.set(entry.id,entry);
 }
 return [...byId.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-MAX_PRACTICE_SUBMISSIONS);
}

const time=value=>Number.isFinite(value)&&value>=0?value:0;
export function blankProgress(){return{version:1,current:"two-sum",currentUpdated:0,drafts:{},solved:{},notes:{},confidence:{},activity:[],days:[],acceptedDays:[],reviews:{},attempts:{},modified:{},practiceSubmissions:[]};}
export function validateProgress(value) {
  if(!object(value)||value.version!==1)throw new Error("This is not a ByteQuest progress backup.");
  const clean=blankProgress();
  const ids=new Set(maps.flatMap(m=>object(value[m])?Object.keys(value[m]):[]).filter(id=>idPattern.test(id)).slice(0,4000));
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
  clean.practiceSubmissions=normalizePracticeSubmissions(value.practiceSubmissions);
  clean.acceptedDays=[...new Set([...(Array.isArray(value.acceptedDays)?value.acceptedDays:[]),...Object.values(clean.solved).map(utcDay),...clean.activity.filter(a=>['solved','review'].includes(a.type)).map(a=>utcDay(a.at))].filter(validDay))].sort().slice(-1000);
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
  out.acceptedDays=[...new Set([...a.acceptedDays,...b.acceptedDays])].sort().slice(-1000);
  out.activity=[...new Map([...a.activity,...b.activity].map(e=>[e.id+"-"+e.type+"-"+e.at,e])).values()].sort((x,y)=>x.at-y.at).slice(-200);
  out.practiceSubmissions=normalizePracticeSubmissions([...a.practiceSubmissions,...b.practiceSubmissions]);
  out.current=b.currentUpdated>a.currentUpdated?b.current:a.current;
  out.currentUpdated=Math.max(a.currentUpdated,b.currentUpdated);
  return out;
}

const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
function utcDay(at){return Number.isFinite(at)&&at>0&&at<7258118400000?new Date(at).toISOString().slice(0,10):null;}
export function solveStreak(progress,now=Date.now()){
 const days=new Set((progress.acceptedDays||[]).filter(d=>validDay(d)&&d<=utcDay(now))),cursor=new Date(utcDay(now)+'T00:00:00Z');let count=0;
 if(!days.has(cursor.toISOString().slice(0,10)))cursor.setUTCDate(cursor.getUTCDate()-1);
 while(days.has(cursor.toISOString().slice(0,10))){count++;cursor.setUTCDate(cursor.getUTCDate()-1);}return count;
}
