import {escapeHtml as h} from './community-model.js';
import {profileAvatar} from './profile-view.js?v=workbench-1';
export function mountCreatorAccess(cloud,{refresh,notify=()=>{},isActive=()=>true}={}){
 const $=id=>document.getElementById(id),input=$('creatorQuery'),results=$('creatorResults'),status=$('creatorSearchStatus'),selection=$('creatorSelection'),grant=$('creatorGrant');let generation=0,timer,selected=null;
 const valid=(ticket,owner)=>ticket===generation&&cloud.user?.id===owner&&isActive();
 function reset(){generation++;clearTimeout(timer);selected=null;input.value='';results.replaceChildren();status.textContent='Search by username, profile ID or exact Firebase user ID.';selection.textContent='';grant.disabled=true;$('creatorId').value='';}
 input.addEventListener('input',()=>{
  clearTimeout(timer);const ticket=++generation,owner=cloud.user?.id,query=input.value.trim();selected=null;grant.disabled=true;$('creatorId').value='';selection.textContent='';results.replaceChildren();
  if(query.length<2){status.textContent='Type at least two characters, or paste an exact user ID.';return;}status.textContent='Searching…';
  timer=setTimeout(async()=>{try{const r=await cloud.request('creator-search',{query},owner);if(!valid(ticket,owner))return;const users=r.users||[];status.textContent=users.length?'Choose the intended learner.':r.needsProfile?'This account exists. Ask the learner to create a ByteQuest profile first.':'No matching accounts found.';
   results.innerHTML=users.map((p,i)=>'<button type="button" class="creator-result" data-creator-choice="'+i+'">'+profileAvatar(p)+'<span><strong>'+h(p.display_name)+'</strong><small>@'+h(p.username)+(p.private_profile?' · private profile':'')+(p.creator?' · already a creator':'')+'</small></span></button>').join('');
   results.querySelectorAll('[data-creator-choice]').forEach(button=>button.onclick=()=>{selected=users[Number(button.dataset.creatorChoice)];$('creatorId').value=selected.public_id;results.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b===button));selection.textContent=selected.display_name+' · @'+selected.username;grant.disabled=selected.creator===true;status.textContent=selected.creator?'This learner already has creator access. Manage it below.':'Ready to grant access to this learner.';});
  }catch(e){if(valid(ticket,owner))status.textContent=e.message;}},250);
 });
 $('creatorForm').onsubmit=async e=>{e.preventDefault();if(!selected||grant.disabled||!isActive())return;const owner=cloud.user?.id,ticket=generation,target=selected.public_id;
  if(!confirm('Grant '+selected.display_name+' permission to create, change and publish all library problems and access private tests?'))return;grant.disabled=true;
  try{await cloud.request('role-set',{target,creator:true},owner);if(!valid(ticket,owner))return;await refresh();if(!valid(ticket,owner))return;reset();notify('Creator access granted.');}catch(error){if(valid(ticket,owner)){grant.disabled=false;status.textContent=error.message;notify(error.message,true);}}
 };
 return{reset};
}
