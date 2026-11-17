import {MAX_PRACTICE_SOURCE,normalizePracticeSubmissions} from './progress.js?v=practice-history-1';

// This is an account-private practice attempt, NOT a server-verified accepted
// submission. Keep it out of the community ranking / shared-solutions APIs.
export function createPracticeSubmission({problem,source,status,passed=0,total,elapsedMs=null,customCount=0,now=Date.now(),id=crypto.randomUUID()}){
  if(!problem||typeof source!=='string'||!Number.isInteger(total)||total<1)throw new Error('Invalid practice submission');
  return {
    id,problemId:problem.id,revision:Number.isInteger(problem.revision)?problem.revision:0,
    language:'java',status,at:now,
    source:source.slice(0,MAX_PRACTICE_SOURCE),sourceTruncated:source.length>MAX_PRACTICE_SOURCE,
    passed,total,elapsedMs:Number.isFinite(elapsedMs)?elapsedMs:null,
    hiddenSkipped:Number(problem.hiddenCount)>0,customCount
  };
}
export function addPracticeSubmission(progress,entry){
  return normalizePracticeSubmissions([...(progress.practiceSubmissions||[]),entry]);
}
export function recentPracticeSubmissions(progress,problemId,limit=25){
  return (progress?.practiceSubmissions||[]).filter(row=>row.problemId===problemId)
    .sort((a,b)=>b.at-a.at||b.id.localeCompare(a.id)).slice(0,limit);
}
