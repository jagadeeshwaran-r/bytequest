// First standalone editor slice. This code is pure so it can be tested independently.
// Later phases will move all languages and the complete legacy editor toolkit.
export interface Pair {readonly open:number;readonly close:number;}
function codeMask(source:string):string {
  const output=source.split('');
  let state:'code'|'line'|'block'|'single'|'double'|'triple'='code';
  for(let i=0;i<source.length;i++){
    const ch=source[i], next=source[i+1];
    if(state==='code'){
      if(ch==='/'&&next==='/'){output[i]=output[i+1]=' ';i++;state='line';continue;}
      if(ch==='/'&&next==='*'){output[i]=output[i+1]=' ';i++;state='block';continue;}
      if(source.slice(i,i+3)==='"""'){output[i]=output[i+1]=output[i+2]=' ';i+=2;state='triple';continue;}
      if(ch==='"'||ch==="'"){output[i]=' ';state=ch==='"'?'double':'single';}
      continue;
    }
    if(ch!=='\n')output[i]=' ';
    if(state==='line'){
      if(ch==='\n')state='code';
      continue;
    }
    if(state==='block'){
      if(ch==='*'&&next==='/'){output[i+1]=' ';i++;state='code';}
      continue;
    }
    if(ch==='\\'&&state!=='triple'&&next){output[i+1]=' ';i++;continue;}
    if(state==='triple'&&source.slice(i,i+3)==='"""'){
      output[i+1]=output[i+2]=' ';i+=2;state='code';continue;
    }
    if(state==='single'&&ch==="'")state='code';
    if(state==='double'&&ch==='"')state='code';
  }
  return output.join('');
}

export function matchingCurly(source:string,caret:number,selectionEnd=caret):Pair|null{
  if(caret<0||caret>source.length||caret!==selectionEnd)return null;
  const mask=codeMask(source);
  const at=[caret-1,caret].find(i=>mask[i]==='{'||mask[i]==='}');
  if(at===undefined)return null;
  let depth=0;
  if(mask[at]==='{'){
    for(let i=at;i<mask.length;i++){
      if(mask[i]==='{')depth++;
      if(mask[i]==='}'&&--depth===0)return {open:at,close:i};
    }
  }else{
    for(let i=at;i>=0;i--){
      if(mask[i]==='}')depth++;
      if(mask[i]==='{'&&--depth===0)return {open:i,close:at};
    }
  }
  return null;
}
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
const syntax=/((?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(public|private|protected|class|static|return|throw|new|for|while|if|else|int|long|boolean|double|char|void|final|true|false|null|import|try|catch)\b|\b(String|Integer|Math|Arrays|List|Map|HashMap|HashSet|Set|Solution)\b|\b(\d+(?:\.\d+)?)\b/g;
export function syntaxHighlight(source:string,pair:Pair|null):string{
  const paint=(fragment:string,offset:number)=>{
    if(!pair)return escapeHtml(fragment);
    let output='',last=0;
    for(const p of [pair.open,pair.close]){
      const index=p-offset;
      if(index<last||index>=fragment.length)continue;
      output+=escapeHtml(fragment.slice(last,index))+'<span class="matching-brace">'+escapeHtml(fragment[index])+'</span>';
      last=index+1;
    }
    return output+escapeHtml(fragment.slice(last));
  };
  let out='',last=0;
  for(const match of source.matchAll(syntax)){
    out+=paint(source.slice(last,match.index),last);
    const token=match[1]?'comment':match[2]?'string':match[3]?'keyword':match[4]?'type':'number';
    out+='<span class="token-'+token+'">'+paint(match[0],match.index)+'</span>';
    last=match.index+match[0].length;
  }
  return out+paint(source.slice(last),last)+'\n';
}
