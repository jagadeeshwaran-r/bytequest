// UI hint only. Private Java source is never bundled; Edge Function validates
// the signed-in owner, problem ID and revision on every reference-read request.
export function canRevealEditorialSolution(progress,problemId){
  const solved=progress?.solved;
  return typeof problemId==='string'&&
    !!solved&&Object.prototype.hasOwnProperty.call(solved,problemId)&&
    typeof solved[problemId]==='number'&&Number.isFinite(solved[problemId])&&
    solved[problemId]>0;
}

export function editorialSolutionGateMarkup(unlocked){
  if(unlocked){
    return '<div class="reference-unlocked" aria-label="Java answer available after verification">'+
      '<button id="referenceBtn" class="reference-button" type="button">View Java answer</button>'+
      '</div><div id="referenceContent"></div>';
  }
  return '<div class="reference-lock" role="note" aria-label="Java answer locked">'+
    '<span class="reference-gate-copy">Java answer <span class="reference-inline-note">· Unlock after an accepted public submission</span></span>'+
    '</div><div id="referenceContent"></div>';
}
