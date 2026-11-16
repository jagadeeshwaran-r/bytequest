// Keep completion indicators tied to accepted solves, not visits or sample runs.
export function problemStatusMarkup(solved){
  return solved
    ? '<span class="problem-status is-solved" aria-label="Solved"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5 10 17.5 19 7.5"/></svg><span>Solved</span></span>'
    : '<span class="problem-status is-unsolved">Unsolved</span>';
}
