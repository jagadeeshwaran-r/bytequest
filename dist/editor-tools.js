import {comparisonEdit} from './code-operators.js?v=operators-1';
const words={
 java:'abstract boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new null private protected public return short static String super switch synchronized this throw throws true try void volatile while false System.out.println Arrays.sort Arrays.fill Arrays.copyOf Math.max Math.min Math.abs HashMap HashSet ArrayList List Map Set StringBuilder Integer.parseInt Collections.sort',
 python:'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield len range enumerate sorted reversed zip sum min max abs int str list dict set tuple print append collections.Counter collections.defaultdict',
 c:'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while malloc calloc realloc free printf scanf strlen strcmp memcpy memset qsort NULL',
 cpp:'auto bool break case catch char class const constexpr continue default delete do double else enum explicit false float for if int long namespace new nullptr private protected public return short signed sizeof static std::vector std::string std::unordered_map std::unordered_set std::sort std::lower_bound std::max std::min std::cout struct switch template this throw true try typedef typename unsigned using virtual void while'};
export function completions(source,caret,language,problem={}){
 const before=source.slice(0,caret),match=before.match(/[A-Za-z_][\w.:]*$/);if(!match||match[0].length<2)return [];
 const line=before.slice(before.lastIndexOf('\n')+1);if(/^\s*(?:\/\/|#(?!include))/.test(line))return [];
 const prefix=match[0],local=source.match(/\b[A-Za-z_]\w*\b/g)||[];
 const candidates=new Set([...(words[language]||words.java).split(' '),problem.method,...(problem.params||[]).map(p=>p.name),...local]);
 return [...candidates].filter(w=>typeof w==='string'&&w!==prefix&&w.toLowerCase().startsWith(prefix.toLowerCase())).sort((a,b)=>a.localeCompare(b)).slice(0,8).map(label=>({label,start:caret-prefix.length,end:caret,language}));
}
export function newlineEdit(value,start,end,language){
 const line=value.slice(0,start).split('\n').pop(),indent=line.match(/^\s*/)[0],opens=language==='python'?/:\s*(?:#.*)?$/.test(line):/\{\s*$/.test(line),extra=opens?'    ':'';
 const closes=language!=='python'&&opens&&/^\s*}/.test(value.slice(end));
 const insert='\n'+indent+extra+(closes?'\n'+indent:'');
 return{value:value.slice(0,start)+insert+value.slice(end),start:start+1+indent.length+extra.length,end:start+1+indent.length+extra.length};
}
export class EditHistory{
 constructor(snapshot={value:'',start:0,end:0}){this.reset(snapshot);}
 reset(snapshot){this.items=[{...snapshot}];this.index=0;}
 selection(start,end){Object.assign(this.items[this.index],{start,end});}
 record(snapshot){if(snapshot.value===this.items[this.index].value){this.selection(snapshot.start,snapshot.end);return;}this.items.splice(this.index+1);this.items.push({...snapshot});if(this.items.length>150)this.items.shift();this.index=this.items.length-1;}
 undo(){if(this.index>0)this.index--;return{...this.items[this.index]};}
 redo(){if(this.index<this.items.length-1)this.index++;return{...this.items[this.index]};}
}
export function mountEditorTools(editor,{getLanguage,getProblem,notify=()=>{}}){
 let context=null,applying=false,choices=[],selected=0;const snapshot=()=>({value:editor.value,start:editor.selectionStart,end:editor.selectionEnd}),history=new EditHistory(snapshot());
 const popup=document.createElement('div');popup.className='editor-completions';popup.id='codeCompletions';popup.hidden=true;popup.setAttribute('role','listbox');popup.setAttribute('aria-label','Code suggestions');editor.parentElement.append(popup);editor.setAttribute('aria-controls',popup.id);editor.setAttribute('aria-autocomplete','list');editor.spellcheck=false;
 function close(){popup.hidden=true;choices=[];editor.removeAttribute('aria-activedescendant');}
 function position(){const style=getComputedStyle(editor),lineHeight=parseFloat(style.lineHeight)||22,fontSize=parseFloat(style.fontSize)||14,before=editor.value.slice(0,editor.selectionStart),lines=before.split('\n');popup.style.top=Math.max(6,Math.min(editor.clientHeight-80,lines.length*lineHeight-editor.scrollTop+parseFloat(style.paddingTop||0)))+'px';popup.style.left=Math.max(8,Math.min(editor.clientWidth-230,(lines.at(-1).length*fontSize*.6)-editor.scrollLeft+parseFloat(style.paddingLeft||0)))+'px';}
 function paint(){popup.replaceChildren(...choices.map((c,i)=>{const b=document.createElement('button');b.id='codeSuggestion'+i;b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===selected));b.textContent=c.label;b.onmousedown=e=>e.preventDefault();b.onclick=()=>accept(i);return b;}));popup.hidden=!choices.length;if(choices.length){editor.setAttribute('aria-activedescendant','codeSuggestion'+selected);position();}}
 function suggest(){if(editor.readOnly||editor.selectionStart!==editor.selectionEnd){close();return;}choices=completions(editor.value,editor.selectionStart,getLanguage(),getProblem());selected=0;paint();}
 function apply(s,record=true,focus=true){applying=true;editor.value=s.value;editor.setSelectionRange(s.start,s.end);if(record)history.record(s);editor.dispatchEvent(new Event('input',{bubbles:true}));applying=false;close();if(focus)editor.focus();}
 function replace(text,start=editor.selectionStart,end=editor.selectionEnd){history.selection(editor.selectionStart,editor.selectionEnd);apply({value:editor.value.slice(0,start)+text+editor.value.slice(end),start:start+text.length,end:start+text.length});}
 function accept(i=selected){const c=choices[i];if(c)replace(c.label,c.start,c.end);}
 const block=e=>{e.preventDefault();close();notify('Clipboard actions are disabled in the coding editor. Type your solution; undo is available.');};
 for(const event of ['copy','cut','paste','drop'])editor.addEventListener(event,block);
 editor.addEventListener('beforeinput',e=>{if(/^(insertFromPaste|insertFromDrop|insertFromYank|deleteByCut)/.test(e.inputType)){block(e);return;}history.selection(editor.selectionStart,editor.selectionEnd);});
 editor.addEventListener('input',()=>{if(applying)return;history.record(snapshot());suggest();});
 editor.addEventListener('keydown',e=>{
  const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
  if(mod&&(['c','x','v'].includes(key))){block(e);return;}
  if(mod&&(key==='z'||key==='y')){e.preventDefault();if(editor.readOnly)return;history.selection(editor.selectionStart,editor.selectionEnd);apply(key==='y'||e.shiftKey?history.redo():history.undo(),false);return;}
  if(mod&&e.code==='Space'){e.preventDefault();suggest();return;}
  if(e.key==='Escape'){close();return;}
  if(editor.readOnly||mod||e.altKey)return;
  if(!popup.hidden&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();selected=(selected+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;paint();return;}
  if(!popup.hidden&&['Tab','Enter'].includes(e.key)&&!e.shiftKey){e.preventDefault();accept();return;}
  if(e.key==='Enter'){e.preventDefault();history.selection(editor.selectionStart,editor.selectionEnd);apply(newlineEdit(editor.value,editor.selectionStart,editor.selectionEnd,getLanguage()));return;}
  if(e.key==='Tab'){e.preventDefault();close();if(!e.shiftKey){replace('    ');return;}const start=editor.value.lastIndexOf('\n',editor.selectionStart-1)+1,count=Math.min(4,(editor.value.slice(start).match(/^ */)||[''])[0].length);if(count){const s=editor.selectionStart,end=editor.selectionEnd;history.selection(s,end);apply({value:editor.value.slice(0,start)+editor.value.slice(start+count),start:Math.max(start,s-count),end:Math.max(start,end-count)});}return;}
  if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key))close();
 });
 editor.addEventListener('blur',()=>setTimeout(close,120));editor.addEventListener('scroll',close);editor.addEventListener('click',close);
 return{prepare(){const before=snapshot(),fixed=comparisonEdit(before.value,before.start,before.end,getLanguage());if(fixed.count){history.record(before);apply({value:fixed.value,start:fixed.start,end:fixed.end},true,false);notify('Converted '+fixed.count+' comparison '+(fixed.count===1?'symbol':'symbols')+' to code operators. Undo is available.');}return editor.value;},load(key,value){const s={value,start:Math.min(editor.selectionStart,value.length),end:Math.min(editor.selectionEnd,value.length)};editor.value=value;if(key!==context){context=key;history.reset(s);}else history.record(s);close();},history};
}
