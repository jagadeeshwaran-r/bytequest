// Recover only server-reported personal solve history, never community stats
// for another user. This is a fallback when direct progress sync is delayed.
// The profile RPC reports up to 25 recent solves, so this augments—not
// replaces—the full owner-scoped progress download.
const validId=/^[a-z][a-z0-9-]{1,79}$/;
export function recoverOwnProfileSolves(progress,profileResponse,expectedPublicId,{now=Date.now()}={}){
  if(!progress||typeof progress!=='object'||!profileResponse||
    profileResponse.isOwn!==true||
    typeof expectedPublicId!=='string'||!expectedPublicId||
    profileResponse.profile?.public_id!==expectedPublicId ||
    !Array.isArray(profileResponse.insights?.recentSolves))return {state:progress,restored:0};

  const solved={...(progress.solved||{})};
  const acceptedDays=new Set(progress.acceptedDays||[]);
  let restored=0,changed=false;
  for(const row of profileResponse.insights.recentSolves.slice(0,25)){
    if(!row||typeof row.problemId!=='string'||!validId.test(row.problemId)||
      typeof row.solvedAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(row.solvedAt))continue;
    const at=Date.parse(row.solvedAt);
    if(!Number.isSafeInteger(at)||at<946684800000||at>now+60000)continue;
    const existing=solved[row.problemId];
    if(!Number.isFinite(existing)||existing<=0||existing>at){
      solved[row.problemId]=at;
      if(!existing)restored++;
      changed=true;
    }
    const day=new Date(at).toISOString().slice(0,10);
    if(!acceptedDays.has(day)){acceptedDays.add(day);changed=true;}
  }
  return changed?{
    state:{...progress,solved,acceptedDays:[...acceptedDays].sort()},
    restored
  }:{state:progress,restored:0};
}
