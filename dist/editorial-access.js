// Spoiler guard for the Editorial reference code.
// This is a presentation lock, not a security boundary: published problem
// data includes its reference and should not be treated as confidential.
export function canRevealEditorialSolution(progress,problemId){
  const solved=progress?.solved;
  return typeof problemId==='string' &&
    !!solved && Object.prototype.hasOwnProperty.call(solved,problemId) &&
    typeof solved[problemId]==='number' && Number.isFinite(solved[problemId]) &&
    solved[problemId]>0;
}

export function editorialSolutionGateMarkup(unlocked){
  if(unlocked){
    return '<section class="reference-unlocked" aria-label="Java reference solution available">'+
      '<div class="reference-gate-icon" aria-hidden="true">✓</div>'+
      '<div class="reference-gate-copy"><strong>Java solution unlocked</strong>'+
      '<p>You solved this problem. Compare your approach with the reference implementation.</p></div>'+
      '<button id="referenceBtn" class="reference-button" type="button">Show Java solution</button>'+
      '</section><div id="referenceContent"></div>';
  }
  return '<section class="reference-lock" role="note" aria-label="Java solution locked">'+
    '<div class="reference-gate-icon" aria-hidden="true">🔒</div>'+
    '<div class="reference-gate-copy"><strong>Java solution locked</strong>'+
    '<p>Submit an accepted solution to unlock the reference code. The explanation and complexity notes remain available above.</p></div>'+
    '<span class="reference-lock-status" aria-label="Locked">Locked</span>'+
    '</section><div id="referenceContent"></div>';
}
