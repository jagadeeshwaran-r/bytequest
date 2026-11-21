// A cloud account is not "unsolved" until its account progress was loaded.
// Never confuse public catalog availability with personal solved status.
export function problemStatusMarkup(solved,{complete=true,failed=false}={}){
  if(solved)return '<span class="problem-status is-solved" aria-label="Solved"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5 10 17.5 19 7.5"/></svg><span>Solved</span></span>';
  if(!complete)return failed
    ? '<span class="problem-status is-pending" aria-label="Solve status unavailable">Status unavailable</span>'
    : '<span class="problem-status is-pending" aria-label="Checking account progress">Checking…</span>';
  return '<span class="problem-status is-unsolved">Unsolved</span>';
}
