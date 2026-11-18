// Presentation gate only. The Edge Function enforces Firebase identity and a
// server-verified accepted submission, independently of local progress.
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
      '<div class="reference-gate-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg></div>'+
      '<div class="reference-gate-copy"><strong>Java reference access</strong>'+
      '<p>Reference code is served only after a server-verified accepted submission.</p></div>'+
      '<button id="referenceBtn" class="reference-button" type="button">Check verified Java solution</button>'+
      '</section><div id="referenceContent"></div>';
  }
  return '<section class="reference-lock" role="note" aria-label="Java solution locked">'+
    '<div class="reference-gate-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg></div>'+
    '<div class="reference-gate-copy"><strong>Java solution locked</strong>'+
    '<p>Submit a server-verified accepted solution to unlock this reference. Browser-only practice does not grant access; explanations remain available.</p></div>'+
    '<span class="reference-lock-status" aria-label="Locked">Locked</span>'+
    '</section><div id="referenceContent"></div>';
}
