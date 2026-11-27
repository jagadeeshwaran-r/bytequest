// Browser practice and server verification are separate kinds of evidence.
// The browser cannot execute a private suite, and a counted personal practice
// solve is never proof that the hidden cases passed.
export function practiceVerificationSummary(problem,attempt){
  const publicTotal=Number.isSafeInteger(attempt?.total)&&attempt.total>0?attempt.total:0;
  const publicPassed=Number.isSafeInteger(attempt?.passed)&&attempt.passed>=0?Math.min(attempt.passed,publicTotal):0;
  const hiddenTotal=Number.isSafeInteger(problem?.hiddenCount)&&problem.hiddenCount>=0?problem.hiddenCount:0;
  return {
    title:'Practice accepted · server verification pending',
    tests:publicPassed+'/'+publicTotal+' browser practice cases passed',
    hidden:hiddenTotal>0?'0/'+hiddenTotal+' private hidden cases verified':'No private hidden cases advertised',
    explanation:'This solve is recorded toward personal progress, but no server-verified acceptance has been recorded for it. Community rankings and protected reference solutions require successful server verification.'
  };
}
export function privateJudgeUnavailableSummary(problem){
  const hiddenTotal=Number.isSafeInteger(problem?.hiddenCount)&&problem.hiddenCount>0?problem.hiddenCount:0;
  return {
    title:'Private Java verification unavailable',
    hidden:hiddenTotal?'0/'+hiddenTotal+' hidden cases confirmed by the server':'No server acceptance recorded',
    explanation:'Your source has not been marked server-accepted. The private judge must be configured and available for this problem. You can explicitly run browser practice, but passing it does not establish hidden-case acceptance.'
  };
}
