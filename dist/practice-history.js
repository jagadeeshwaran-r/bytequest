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


// Recover personal solve credit if an accepted browser attempt was durably
// saved but the subsequent solve/sync step was interrupted (tab close, stale
// bundle, slow account initialization). This NEVER grants server verification
// or access to shared submissions.
export function reconcilePracticeProgress(progress){
  if(!progress||!Array.isArray(progress.practiceSubmissions))return progress;
  const solved={...(progress.solved||{})},days=new Set(progress.acceptedDays||[]);
  let changed=false;
  for(const attempt of progress.practiceSubmissions){
    if(attempt?.status!=='practice_accepted'||!Number.isSafeInteger(attempt.at)||
      attempt.at<946684800000||attempt.at>Date.now()||
      !Number.isInteger(attempt.total)||attempt.total<1||attempt.passed!==attempt.total||
      typeof attempt.problemId!=='string'||!/^[a-z][a-z0-9-]{1,79}$/.test(attempt.problemId))continue;
    if(!solved[attempt.problemId]||solved[attempt.problemId]>attempt.at){
      solved[attempt.problemId]=attempt.at;changed=true;
    }
    const day=new Date(attempt.at).toISOString().slice(0,10);
    if(!days.has(day)){days.add(day);changed=true;}
  }
  return changed?{...progress,solved,acceptedDays:[...days].sort()}:progress;
}
