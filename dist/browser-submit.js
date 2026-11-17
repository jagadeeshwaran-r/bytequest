// Java Submit deliberately uses the same CheerpJ execution path as Java Run.
// These browser-owned practice results are not server-verified submissions.
export function usesRemoteSubmit(language, signedIn, submitting) {
  return Boolean(submitting && signedIn && language !== 'java');
}
export function browserSubmissionCases(problem, customCases = []) {
  if (!Array.isArray(problem?.tests) || !Array.isArray(customCases)) throw new Error('Invalid practice cases.');
  return [...problem.tests, ...customCases];
}
export function browserSubmissionVerdict(problem, passed, total, customCount = 0) {
  const accepted = Number.isInteger(passed) && Number.isInteger(total) && total > 0 && passed === total;
  const hiddenSkipped = Number(problem?.hiddenCount) > 0;
  return {
    accepted, status: accepted ? 'practice_accepted' : 'wrong_answer',
    passed, total, verified: false,
    message: accepted
      ? 'All '+total+' browser test cases passed'+(customCount ? ' (including '+customCount+' custom)' : '')+'. Your progress counts as a practice solve.'+
        (hiddenSkipped ? ' Hidden cases were not checked.' : '')+
        ' No verified server submission or shared-solution benchmark was recorded.'
      : passed+' / '+total+' browser test cases passed. Fix the failed cases and submit again.'
  };
}
