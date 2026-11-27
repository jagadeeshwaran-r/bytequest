import {codeContext} from './code-context.js?v=workbench-1';
const pairs={'(':')','[':']','{':'}','<':'>'};
const genericTypes=/\b(?:[A-Z][\w$]*|(?:std::)?(?:vector|array|map|unordered_map|multimap|set|unordered_set|multiset|pair|tuple|optional|variant|function|deque|queue|stack|priority_queue|list|forward_list|shared_ptr|unique_ptr|weak_ptr|numeric_limits|bitset|string_view|span|less|greater))$/;
export function bracketEdit(value,start,end,key,language='java'){
 const context=codeContext(value.slice(0,start),language);if(!context.codeAtEnd)return null;
 const next=value[start],selected=value.slice(start,end),angle=key==='<'||key==='>';
 const genericAt=at=>at>=0&&['java','cpp'].includes(language)&&genericTypes.test(value.slice(0,at).trimEnd())&&!/\s$/.test(value.slice(0,at));
 if(key==='Backspace'){
  if(start!==end||!start)return null;const before=value[start-1];if(pairs[before]===next&&(before!=='<'||genericAt(start-1)))return{value:value.slice(0,start-1)+value.slice(end+1),start:start-1,end:start-1};return null;
 }
 if(pairs[key]){
  if(angle&&!genericAt(start))return null;
  if(!selected&&next&&!/[\s\])};,>]/.test(next))return null;
  return{value:value.slice(0,start)+key+selected+pairs[key]+value.slice(end),start:start+1,end:selected?end+1:start+1};
 }
 if(')]}>'.includes(key)&&start===end&&next===key){
  if(key==='>'&&!genericAt(context.mask.lastIndexOf('<')))return null;
  return{value,start:start+1,end:start+1};
 }
 return null;
}
