import {codeContext} from './code-context.js?v=workbench-1';

// Return the positions of a matching curly-brace pair near the caret.
// Only code is searched: strings, character literals and comments are masked.
export function matchingCurlyBraces(source,caret,language='java',selectionEnd=caret){
 if(typeof source!=='string'||!Number.isInteger(caret)||caret<0||caret>source.length||selectionEnd!==caret)return null;
 const mask=codeContext(source,language).mask;
 // Prefer the brace immediately before the caret (including auto-inserted "{}").
 const at=[caret-1,caret].find(index=>mask[index]==='{'||mask[index]==='}');
 if(at===undefined)return null;
 let depth=0;
 if(mask[at]==='{'){
  for(let i=at;i<mask.length;i++){
   if(mask[i]==='{')depth++;
   else if(mask[i]==='}'&&--depth===0)return{open:at,close:i};
  }
 }else{
  for(let i=at;i>=0;i--){
   if(mask[i]==='}')depth++;
   else if(mask[i]==='{'&&--depth===0)return{open:i,close:at};
  }
 }
 return null;
}
