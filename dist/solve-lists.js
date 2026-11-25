import {buildSolveLists,orderSolveRoadmap,collectionState,nextCollectionProblem} from './solve-lists-model.js?v=roadmap-1';
import {problemStatusMarkup} from './problem-status.js?v=auth-ready-1';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
export function selectedSolveList(hash){try{return hash.startsWith('#solve-lists/')?decodeURIComponent(hash.slice(13)):'';}catch{return '';}}
const linkFor=name=>'#solve-lists/'+encodeURIComponent(name);
function progress(list,ready){
  const box=el('div','solve-list-progress');
  const label=el('span','muted',ready?list.solved+' / '+list.total+' solved':list.solved+' known solved');
  const bar=el('progress');bar.max=list.total;bar.value=list.solved;bar.setAttribute('aria-label',list.name+' completion');
  const meta=el('div','solve-list-progress-meta');meta.append(label,el('span','solve-list-percent',ready?Math.round(list.solved/list.total*100)+'%':'—'));box.append(meta,bar);return box;
}
export function renderSolveLists(root,catalog,solved,status,openProblem,selected=''){
  const lists=orderSolveRoadmap(buildSolveLists(catalog,solved)),ready=status==='ready';
  const chosen=lists.find(list=>list.name===selected);
  const fragment=document.createDocumentFragment();
  const heading=el('div','section-heading solve-list-heading');
  const copy=el('div');copy.append(el('h2','',chosen?chosen.name:'Solve Lists'),el('p','',chosen?chosen.total+' problems · Easy to Hard':lists.length+' collections · Suggested learning order'));
  if(selected){const back=el('a','solve-list-back','← All Solve Lists');back.href='#solve-lists';heading.append(copy,back);}else{const summary=el('div','solve-roadmap-summary');summary.append(el('strong','',ready?lists.filter(l=>collectionState(l,true)==='completed').length+' / '+lists.length:'—'),el('span','muted','Collections completed'));heading.append(copy,summary);}
  fragment.append(heading);
  if(!ready)fragment.append(el('p','muted',status==='failed'?'Account progress unavailable. Known solves are shown.':'Checking account progress…'));
  if(chosen){
    const detail=el('div','solve-roadmap-detail');detail.append(progress(chosen,ready));const next=nextCollectionProblem(chosen,solved,ready);if(next){const button=el('button','solve-roadmap-continue','Continue practice');button.type='button';button.onclick=()=>openProblem(next.id);detail.append(button);}fragment.append(detail);
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
    const roadmap=el('ol','solve-roadmap');
    for(const [index,list] of lists.entries()){
      const state=collectionState(list,ready),item=el('li','solve-roadmap-step');
      item.dataset.state=state;
      const marker=el('span','solve-roadmap-marker',state==='completed'?'✓':String(index+1).padStart(2,'0'));
      marker.setAttribute('aria-hidden','true');
      const card=el('a','solve-roadmap-card');card.href=linkFor(list.name);
      const title=el('div','solve-roadmap-title');title.append(el('strong','',list.name),el('span','solve-roadmap-status',state==='completed'?'Completed':state==='progress'?'In progress':state==='new'?'Not started':'Checking progress'));
      const arrow=el('span','solve-roadmap-arrow','›');arrow.setAttribute('aria-hidden','true');
      card.append(title,progress(list,ready),arrow);item.append(marker,card);roadmap.append(item);
    }
    fragment.append(lists.length?roadmap:el('p','empty-state','No data structure or mathematics collections available yet.'));
  }
  root.replaceChildren(fragment);
}
