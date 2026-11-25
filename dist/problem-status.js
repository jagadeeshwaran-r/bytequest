// A cloud account is not "unsolved" until its account progress was loaded.
// Never confuse public catalog availability with personal solved status.
export function problemStatusMarkup(solved,{complete=true,failed=false,compact=false}={}){
  if(compact){
    const label=solved?'Solved':!complete?(failed?'Solve status unavailable':'Checking account progress'):'Unsolved';
    const kind=solved?'is-solved':!complete?'is-pending':'is-unsolved';
    const shape=solved?'<path d="M5 12.5 10 17.5 19 7.5"/>':!complete?(failed?'<path d="M12 8v5m0 3h.01"/><circle cx="12" cy="12" r="9"/>':'<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>'):'<circle cx="12" cy="12" r="7"/>';
    return '<span class="problem-status compact-status '+kind+'" role="img" aria-label="'+label+'" title="'+label+'"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+shape+'</svg></span>';
  }
  if(solved)return '<span class="problem-status is-solved" aria-label="Solved"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5 10 17.5 19 7.5"/></svg><span>Solved</span></span>';
  if(!complete)return failed
    ? '<span class="problem-status is-pending" aria-label="Solve status unavailable">Status unavailable</span>'
    : '<span class="problem-status is-pending" aria-label="Checking account progress">Checking…</span>';
  return '<span class="problem-status is-unsolved">Unsolved</span>';
}
