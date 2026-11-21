// UI hint only. Private Java source is never bundled; Edge Function validates
// the signed-in owner, problem ID and revision on every reference-read request.
export function canRevealEditorialSolution(progress,problemId){
  const solved=progress?.solved;
  return typeof problemId==='string'&&
    !!solved&&Object.prototype.hasOwnProperty.call(solved,problemId)&&
    typeof solved[problemId]==='number'&&Number.isFinite(solved[problemId])&&
    solved[problemId]>0;
}

export function editorialSolutionGateMarkup(unlocked,canCheck=false){
  if(unlocked||canCheck){
    return '<div class="reference-unlocked" aria-label="Check Java answer access after server acceptance">'+
      '<button id="referenceBtn" class="reference-button" type="button">'+(unlocked?'View Java answer':'Check Java answer access')+'</button>'+
      '</div><div id="referenceContent"></div>';
  }
  return '<div class="reference-lock" role="note" aria-label="Java answer locked">'+
    '<span class="reference-gate-copy">Java answer <span class="reference-inline-note">· Sign in and pass public tests to unlock</span></span>'+
    '</div><div id="referenceContent"></div>';
}
