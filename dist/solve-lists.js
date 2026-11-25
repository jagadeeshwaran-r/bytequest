import {buildSolveLists} from './solve-lists-model.js?v=2';
import {problemStatusMarkup} from './problem-status.js?v=auth-ready-1';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const symbols={'Mathematics':'∑','Arrays':'[ ]','Strings':'Aa','Linked Lists':'→','Trees':'T','Graphs':'G','Hash Maps & Sets':'#','Stacks':'≡','Queues':'⇥','Matrices':'▦','Heaps':'H','Tries':'Tr','Disjoint Sets':'DS'};
export function selectedSolveList(hash){try{return hash.startsWith('#solve-lists/')?decodeURIComponent(hash.slice(13)):'';}catch{return '';}}
const linkFor=name=>'#solve-lists/'+encodeURIComponent(name);
function progress(list,ready){
  const box=el('div','solve-list-progress');
  const label=el('span','muted',ready?list.solved+' of '+list.total+' solved':list.solved+' known solved · progress pending');
  const bar=el('progress');bar.max=list.total;bar.value=list.solved;bar.setAttribute('aria-label',list.name+' completion');
  box.append(label,bar);return box;
}
export function renderSolveLists(root,catalog,solved,status,openProblem,selected=''){
  const lists=buildSolveLists(catalog,solved),ready=status==='ready';
  const chosen=lists.find(list=>list.name===selected);
  const fragment=document.createDocumentFragment();
  const heading=el('div','section-heading solve-list-heading');
  const copy=el('div');copy.append(el('h2','',chosen?chosen.name:'Solve Lists'),el('p','',chosen?chosen.total+' problems · Easy to Hard':'Practice collections by data structure and mathematics'));
  if(selected){const back=el('a','solve-list-back','← All Solve Lists');back.href='#solve-lists';heading.append(copy,back);}else heading.append(copy);
  fragment.append(heading);
  if(!ready)fragment.append(el('p','muted',status==='failed'?'Account progress unavailable. Known solves are shown.':'Checking account progress…'));
  if(chosen){
    fragment.append(progress(chosen,ready));
    const wrap=el('div','solve-list-table-wrap'),table=el('table','problem-table');
    const head=table.createTHead().insertRow();
    for(const title of ['No.','Title','Difficulty','Status']){const th=el('th','',title);th.scope='col';head.append(th);}
    const body=table.createTBody(),numbers=new Map(catalog.map((p,i)=>[p.id,i+1]));
    for(const p of chosen.problems){
      const row=body.insertRow(),done=Boolean(Object.hasOwn(solved,p.id)&&solved[p.id]);
      row.insertCell().textContent=String(numbers.get(p.id)).padStart(2,'0');
      const button=el('button','problem-title'+(done?' is-solved':''),p.title);button.type='button';button.onclick=()=>openProblem(p.id);row.insertCell().append(button);
      const difficulty=String(p.difficulty||'');row.insertCell().append(el('span','difficulty '+(['Easy','Medium','Hard'].includes(difficulty)?difficulty.toLowerCase():''),difficulty));
      row.insertCell().innerHTML=problemStatusMarkup(done,{complete:ready,failed:status==='failed'});
    }
    wrap.append(table);fragment.append(wrap);
  }else{
    if(selected)fragment.append(el('p','muted','This collection is not in the current catalog. Browse the available lists below.'));
    const grid=el('div','solve-list-grid');
    for(const list of lists){
      const card=el('a','solve-list-card');card.href=linkFor(list.name);
      const cover=el('div','solve-list-cover',symbols[list.name]||list.name.slice(0,2).toUpperCase());cover.setAttribute('aria-hidden','true');
      card.append(cover,el('strong','',list.name),el('span','muted',list.total+' '+(list.total===1?'problem':'problems')),progress(list,ready));
      grid.append(card);
    }
    fragment.append(lists.length?grid:el('p','empty-state','No data structure or mathematics collections available yet.'));
  }
  root.replaceChildren(fragment);
}
