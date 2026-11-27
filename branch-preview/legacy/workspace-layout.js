// Accessible, persisted desktop workspace splitters. No execution or editor state is stored.
export const DEFAULT_WORKSPACE_LAYOUT=Object.freeze({left:42,editor:60});
export const WORKSPACE_LAYOUT_KEY='bytequest.workspace.layout.v1';

export function normalizeWorkspaceLayout(input){
 const finite=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const data=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 return {
  left:clamp(finite(data.left,DEFAULT_WORKSPACE_LAYOUT.left),35,55),
  editor:clamp(finite(data.editor,DEFAULT_WORKSPACE_LAYOUT.editor),44,66)
 };
}
export function readWorkspaceLayout(storage){
 try{return normalizeWorkspaceLayout(JSON.parse(storage?.getItem(WORKSPACE_LAYOUT_KEY)||'null'));}
 catch{return {...DEFAULT_WORKSPACE_LAYOUT};}
}
export function mountWorkspaceLayout(root,{storage}={}){
 const doc=root.ownerDocument;
 const lab=root.querySelector('.lab');
 const vertical=root.querySelector('.pane-resizer');
 const horizontal=root.querySelector('.editor-resizer');
 const pane=root.querySelector('.editor-pane');
 const toolbar=root.querySelector('.editor-top');
 const expand=root.querySelector('#toggleEditorFocus');
 if(!lab||!vertical||!horizontal||!pane||!toolbar||!expand)return null;
 const store=storage===undefined?(()=>{try{return globalThis.localStorage;}catch{return null;}})():storage;
 let state=readWorkspaceLayout(store),dragging=null;
 const apply=()=>{
  lab.style.setProperty('--pane-left',state.left+'%');
  lab.style.setProperty('--editor-split',state.editor+'%');
  vertical.setAttribute('aria-valuenow',String(Math.round(state.left)));
  horizontal.setAttribute('aria-valuenow',String(Math.round(state.editor)));
 };
 const persist=()=>{try{store?.setItem(WORKSPACE_LAYOUT_KEY,JSON.stringify(state));}catch{/* Storage can be disabled; resizing still works. */}};
 const update=(axis,event)=>{
  if(axis==='left'){
   const bounds=lab.getBoundingClientRect();
   if(!bounds.width)return;
   state=normalizeWorkspaceLayout({...state,left:100*(event.clientX-bounds.left)/bounds.width});
  }else{
   const bounds=pane.getBoundingClientRect();
   if(!bounds.height)return;
   state=normalizeWorkspaceLayout({...state,editor:100*(event.clientY-bounds.top-toolbar.getBoundingClientRect().height)/bounds.height});
  }
  apply();
 };
 const mountGrip=(handle,axis,keys)=>{
  handle.addEventListener('pointerdown',event=>{
   if(event.button!==0||dragging||lab.classList.contains('editor-focus')||globalThis.innerWidth<=900)return;
   event.preventDefault();
   dragging={handle,axis,pointerId:event.pointerId};
   handle.setPointerCapture(event.pointerId);
   doc.body.classList.add(axis==='left'?'bq-dragging-pane':'bq-dragging-editor');
   update(axis,event);
  });
  handle.addEventListener('pointermove',event=>{
   if(dragging?.handle===handle&&dragging.pointerId===event.pointerId)update(axis,event);
  });
  const finish=event=>{
   if(dragging?.handle!==handle||dragging.pointerId!==event.pointerId)return;
   dragging=null;
   doc.body.classList.remove('bq-dragging-pane','bq-dragging-editor');
   if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
   persist();
  };
  handle.addEventListener('pointerup',finish);
  handle.addEventListener('pointercancel',finish);
  handle.addEventListener('lostpointercapture',()=>{
   if(dragging?.handle!==handle)return;
   dragging=null;
   doc.body.classList.remove('bq-dragging-pane','bq-dragging-editor');
   persist();
  });
  handle.addEventListener('keydown',event=>{
   const step=event.shiftKey?5:2;
   let next=null;
   if(event.key===keys.decrease)next=state[axis]-step;
   if(event.key===keys.increase)next=state[axis]+step;
   if(event.key==='Home')next=axis==='left'?35:44;
   if(event.key==='End')next=axis==='left'?55:66;
   if(next===null)return;
   event.preventDefault();
   state=normalizeWorkspaceLayout({...state,[axis]:next});
   apply();persist();
  });
  handle.addEventListener('dblclick',()=>{
   state=normalizeWorkspaceLayout({...state,[axis]:DEFAULT_WORKSPACE_LAYOUT[axis]});
   apply();persist();
  });
 };
 mountGrip(vertical,'left',{decrease:'ArrowLeft',increase:'ArrowRight'});
 mountGrip(horizontal,'editor',{decrease:'ArrowUp',increase:'ArrowDown'});
 expand.addEventListener('click',()=>{
  const focus=lab.classList.toggle('editor-focus');
  expand.textContent=focus?'Exit focus':'Expand editor';
  expand.setAttribute('aria-pressed',String(focus));
  expand.setAttribute('aria-label',focus?'Show description and code editor':'Expand code editor');
 });
 apply();
 return {getLayout:()=>({...state}),restoreDefaults:()=>{
  state={...DEFAULT_WORKSPACE_LAYOUT};apply();persist();
 }};
}
