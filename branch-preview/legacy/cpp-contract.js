import {codeContext} from './code-context.js';
const types={int:'int',boolean:'bool',String:'std::string','int[]':'std::vector<int>'};
function tokens(source){const mask=codeContext(source,'cpp').mask;return[...mask.matchAll(/[A-Za-z_]\w*|\d+(?:\.\d+)?|::|->|&&|\|\||[^\s]/g)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length}));}
function brackets(ts){const stack=[],matches=new Map(),close={')':'(',']':'[','}':'{'};for(let i=0;i<ts.length;i++){const t=ts[i].text;if('([{'.includes(t))stack.push(i);else if(close[t]&&stack.length&&ts[stack.at(-1)].text===close[t]){const from=stack.pop();matches.set(from,i);matches.set(i,from);}}return matches;}
function bodyAfter(ts,from,match){for(let i=from;i<ts.length;i++){if(ts[i].text===';'||ts[i].text==='=')return null;if(ts[i].text==='('||ts[i].text==='['){const end=match.get(i);if(end===undefined)return null;i=end;continue;}if(ts[i].text==='{')return i;if(ts[i].text==='}')return null;}return null;}
function nestedBodies(ts,start,end,match){
 const skip=new Map();
 for(let i=start+1;i<end;i++){
  const t=ts[i].text;
  if(['class','struct','union'].includes(t)){const body=bodyAfter(ts,i+1,match);if(body!==null&&body<end&&match.has(body))skip.set(body,match.get(body));}
  if(t!=='['||!match.has(i))continue;
  const previous=ts[i-1]?.text||'',captureEnd=match.get(i);
  if(previous&&!['=','(',',','{',';',':','?','!','&','|','+','-','*','/','%','^','~','<','>','&&','||','return','co_return','throw'].includes(previous))continue;
  if(previous===']'||ts[i+1]?.text==='[')continue;
  const body=bodyAfter(ts,captureEnd+1,match);if(body!==null&&body<end&&match.has(body))skip.set(body,match.get(body));
 }
 return skip;
}
// ByteQuest's scalar return rule rejects implicit bool/int swaps, while the compiler
// still handles C++ syntax and other standard conversions. Lambdas/local classes are separate functions.
export function cppContract(source,p){
 const expected=types[p.returns];if(!expected)throw new Error('Unsupported C++ return contract');
 const ts=tokens(source),match=brackets(ts),edits=[];let depth=0;
 for(let i=0;i<ts.length;i++){
  const t=ts[i].text;if(t==='{'){depth++;continue;}if(t==='}'){depth--;continue;}
  if(depth!==0||t!==p.method||ts[i+1]?.text!=='('||!match.has(i+1))continue;
  const argsEnd=match.get(i+1),body=bodyAfter(ts,argsEnd+1,match);if(body===null||!match.has(body))continue;const end=match.get(body);
  if(!['int','boolean'].includes(p.returns)){i=end;continue;}
  const nested=nestedBodies(ts,body,end,match);
  for(let at=body+1;at<end;at++){
   if(nested.has(at)){at=nested.get(at);continue;}if(ts[at].text!=='return')continue;
   let last=at+1;for(;last<end;last++){if(ts[last].text===';')break;if('([{'.includes(ts[last].text)&&match.has(last))last=match.get(last);}
   if(last>=end)continue;let from=ts[at].end,to=ts[last].start,expression=source.slice(from,to).trim();if(!expression)continue;
   if(expression.startsWith('{')){
    let first=at+1,final=last-1;
    while(ts[first]?.text==='{'&&match.get(first)===final){first++;final--;}
    if(first>final)continue;
    let multiple=false;for(let n=first;n<=final;n++){if(ts[n].text===',')multiple=true;if('([{'.includes(ts[n].text)&&match.has(n))n=match.get(n);}if(multiple)continue;
    expression=source.slice(ts[first].start,ts[final].end);
   }
   edits.push({from,to,text:' bytequest_contract::value<'+expected+'>(('+expression+'))'});at=last;
  }
  i=end;
 }
 for(const e of edits.sort((a,b)=>b.from-a.from))source=source.slice(0,e.from)+e.text+source.slice(e.to);
 const prelude=`#include <type_traits>\n#include <utility>\nnamespace bytequest_contract { template<class Expected,class Actual> __attribute__((always_inline)) constexpr inline Expected value(Actual&& v){
 static_assert(!(std::is_same<Expected,int>::value && std::is_same<typename std::decay<Actual>::type,bool>::value), "ByteQuest return contract: return an int value, not a boolean; use an explicit int conversion if intended.");
 static_assert(!(std::is_same<Expected,bool>::value && !std::is_same<typename std::decay<Actual>::type,bool>::value), "ByteQuest return contract: return a boolean value, not a number or pointer.");
 return std::forward<Actual>(v); } }\n`;
 const call=p.method+'('+p.params.map(x=>'std::declval<'+types[x.type]+'>()').join(',')+')';
 const check='\nstatic_assert(std::is_same<typename std::decay<decltype('+call+')>::type,'+expected+'>::value,"ByteQuest return contract: '+p.method+' must return '+expected+'.");\n';
 return{source:prelude+'\n#line 1 "solution.cpp"\n'+source+'\n#line 1 "bytequest-checks.cpp"\n'+check,checked:edits.length};
}
