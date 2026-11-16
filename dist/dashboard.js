import {bucketSolves,solveEvents,smoothPath} from './dashboard-model.js?v=upgrade-2';
import {escapeHtml as h} from './community-model.js';
const photo=p=>p?.avatar_url&&/^https:\/\//.test(p.avatar_url)?p.avatar_url:'';
const initial=p=>(p?.display_name||p?.username||'You').trim().charAt(0).toUpperCase();
const avatar=p=>'<span class="chart-avatar">'+(photo(p)?'<img src="'+h(photo(p))+'" alt="" referrerpolicy="no-referrer">':h(initial(p)))+'</span>';
export class Dashboard{
 constructor({cloud,getState,getCatalog,getEvents=null,summary=null,name='You',profile=null,viewerProfile=null,allowCompare=true}){
  Object.assign(this,{cloud,getState,getCatalog,getEvents,summary,name,profile,viewerProfile,allowCompare,epoch:0,accountGeneration:0,loadedFor:null,friends:[],selected:new Set(),cache:new Map()});this.$=id=>document.getElementById(id);
  this.$('graphMonth').value=new Date().toISOString().slice(0,7);this.$('graphYear').value=new Date().getUTCFullYear();
  for(const id of ['graphMode','graphMonth','graphYear','graphTopic'])this.$(id).onchange=()=>this.render();
  const host=this.$('frequencyChart').closest('section'),controls=host.querySelector('.comparison-controls');
  controls.innerHTML='<details class="friend-picker"><summary>Compare with friends <span class="compare-count"></span></summary><div class="friend-picker-panel"><div class="friend-picker-actions"><button type="button" data-all>All friends</button><button type="button" data-clear>Clear</button></div><input class="friend-filter" type="search" placeholder="Filter friends…" aria-label="Filter comparison friends"><div class="friend-checks"></div></div></details>';
  controls.hidden=!this.allowCompare;this.picker=controls.querySelector('.friend-picker');controls.querySelector('[data-all]').onclick=()=>{this.selected=new Set(this.friends.map(p=>p.public_id));this.paintPicker();this.render();};controls.querySelector('[data-clear]').onclick=()=>{this.selected.clear();this.paintPicker();this.render();};controls.querySelector('input').oninput=()=>this.paintPicker();
  this.tooltip=document.createElement('div');this.tooltip.className='chart-tooltip';this.tooltip.hidden=true;this.tooltip.setAttribute('role','status');this.$('frequencyChart').closest('.graph-scroll').append(this.tooltip);this.paintPicker();
 }
 accountChanged(){this.epoch++;this.accountGeneration++;this.loadedFor=null;this.friends=[];this.selected.clear();this.cache.clear();this.paintPicker();}
 paintPicker(){const q=(this.picker.querySelector('input').value||'').toLowerCase(),list=this.picker.querySelector('.friend-checks');this.picker.querySelector('.compare-count').textContent=this.selected.size?'('+this.selected.size+')':'';list.innerHTML=this.friends.length?this.friends.filter(p=>(p.username+' '+p.display_name).toLowerCase().includes(q)).map(p=>'<label>'+avatar(p)+'<span>'+h(p.display_name)+'<small>@'+h(p.username)+'</small></span><input type="checkbox" data-friend="'+h(p.public_id)+'" '+(this.selected.has(p.public_id)?'checked':'')+'></label>').join(''):'<p class="muted">Follow discoverable profiles to compare their activity.</p>';list.querySelectorAll('[data-friend]').forEach(input=>input.onchange=()=>{if(input.checked)this.selected.add(input.dataset.friend);else this.selected.delete(input.dataset.friend);this.picker.querySelector('.compare-count').textContent=this.selected.size?'('+this.selected.size+')':'';this.render();});}
 async open(){
  // Charts render from cached solve data immediately; never await social requests.
  this.render();
  if(!this.allowCompare)return;
  const owner=this.cloud.user?.id,ticket=this.accountGeneration;
  if(!owner||this.loadedFor===owner)return;
  this.loadedFor=owner;
  try{
    // The Profile page already knows the verified viewer. No duplicate self RPC.
    let viewer=this.viewerProfile;
    if(!viewer){
      const own=await this.cloud.request('self');
      if(this.cloud.user?.id!==owner||ticket!==this.accountGeneration)return;
      viewer=own.profile;
    }
    if(viewer?.public_id){
      const r=await this.cloud.request('following',{target:viewer.public_id});
      if(this.cloud.user?.id!==owner||ticket!==this.accountGeneration)return;
      this.friends=(r.users||[]).filter(p=>p.discoverable!==false&&p.public_id!==this.profile?.public_id);
      this.paintPicker();
    }
  }catch(e){
    if(this.cloud.user?.id===owner&&ticket===this.accountGeneration){
      this.$('dashboardMessage').textContent=e.message;
      this.loadedFor=null;
    }
  }
}
async render(){
  const ticket=++this.epoch,$=this.$,catalog=this.getCatalog(),selected=$('graphTopic').value,topics=[...new Set([...catalog.map(p=>p.topic),...(this.getEvents?.()||[]).map(e=>e.topic)])].filter(Boolean).sort();$('graphTopic').replaceChildren(new Option('All topics',''),...topics.map(t=>new Option(t,t)));if(topics.includes(selected))$('graphTopic').value=selected;
  const opts={mode:$('graphMode').value,month:$('graphMonth').value,year:Number($('graphYear').value),topic:$('graphTopic').value};$('graphMonth').hidden=opts.mode!=='daily';$('graphYear').hidden=opts.mode==='daily';let own;
  try{own=bucketSolves(this.getEvents?this.getEvents():solveEvents(this.getState(),catalog),opts);}catch(e){$('dashboardMessage').textContent=e.message;return;}
  const series=[{name:this.name,profile:this.profile,data:own,color:'#16a477'}];this.draw(series);
  $('topicBreakdown').innerHTML=own.topics.length?own.topics.map(([t,n])=>'<div class="topic-mini"><span>'+h(t)+'</span><div><i style="width:'+n/Math.max(...own.topics.map(x=>x[1]))*100+'%"></i></div><b>'+n+'</b></div>').join(''):'<p class="muted">Solve a problem to grow your topic chart.</p>';
  for(const [id,v] of [['dashboardSolved',this.summary?.solved??0],['dashboardActive',this.summary?.active??0],['dashboardPeriod',own.total]])if($(id))$(id).textContent=v;
  if(!this.allowCompare){$('dashboardMessage').textContent='';$('dashboardMessage').hidden=true;return;}
  const ids=[...this.selected];$('dashboardMessage').textContent=ids.length?'Loading friend activity…':this.cloud.user?'Choose any number of followed friends, or compare all.':'Sign in and follow people to compare activity.';
  if(!ids.length)return;
  try{
   const missing=ids.filter(id=>!this.cache.has(id)||Date.now()-this.cache.get(id).at>30000);
   if(missing.length){const result=await this.cloud.request('friend-analytics',{targets:missing});if(ticket!==this.epoch)return;for(const id of missing)this.cache.set(id,{at:Date.now(),user:(result.users||[]).find(p=>p.public_id===id)||null});}
   if(ticket!==this.epoch)return;
   for(const [i,id] of ids.entries()){const p=this.cache.get(id)?.user;if(!p)continue;series.push({name:'@'+p.username,profile:p,data:bucketSolves(p.solves||[],opts),color:'hsl('+((i*137.508+215)%360).toFixed(1)+' 67% 53%)'});}
   this.draw(series);$('dashboardMessage').textContent='Comparing '+(series.length-1)+' friend'+(series.length===2?'':'s')+'. Hover, tap or use arrow keys on the chart to identify every line.'+(series.length!==ids.length+1?' Some profiles are no longer available.':'');
  }catch(e){if(ticket===this.epoch)$('dashboardMessage').textContent=e.message;}
 }
 draw(series){
  const $=this.$,chart=$('frequencyChart'),keys=series[0].data.keys,w=900,left=38,top=20,plotH=175,max=Math.max(1,...series.flatMap(s=>s.data.values)),x=i=>left+i*(w-left-18)/Math.max(1,keys.length-1),y=v=>top+plotH-v/max*plotH;
  this.tooltip.hidden=true;let svg='';
  for(let i=0;i<=4;i++){const v=max*i/4;svg+='<line x1="38" x2="882" y1="'+y(v)+'" y2="'+y(v)+'" class="graph-grid"/><text x="28" y="'+(y(v)+4)+'" text-anchor="end">'+Number(v.toFixed(1))+'</text>';}
  for(const [j,s] of series.entries()){
   svg+='<path class="graph-curve" pathLength="1" fill="none" stroke="'+s.color+'" stroke-width="2.7" d="'+smoothPath(s.data.values.map((v,i)=>[x(i),y(v)]))+'"/>';
   s.data.values.forEach((v,i)=>{if(v)svg+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3" fill="'+s.color+'"><title>'+h(s.name+' · '+keys[i]+': '+v+' solves')+'</title></circle>';});
   if(j<8&&s.data.total){const peak=Math.max(...s.data.values),peaks=s.data.values.map((v,i)=>v===peak?i:-1).filter(i=>i>=0),i=peaks[(j*3)%peaks.length],cx=x(i),cy=Math.max(13,y(peak)-15),clip='spikeClip'+j;svg+='<g class="spike-marker"><title>'+h(s.name+' · '+keys[i]+': '+peak+' solves')+'</title><circle cx="'+cx+'" cy="'+cy+'" r="12" fill="'+s.color+'"/>';
    if(photo(s.profile))svg+='<defs><clipPath id="'+clip+'"><circle cx="'+cx+'" cy="'+cy+'" r="10"/></clipPath></defs><image href="'+h(photo(s.profile))+'" x="'+(cx-10)+'" y="'+(cy-10)+'" width="20" height="20" preserveAspectRatio="xMidYMid slice" clip-path="url(#'+clip+')"/>';
    else svg+='<text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" class="spike-initial">'+h(initial(s.profile))+'</text>';svg+='</g>';
   }
  }
  keys.forEach((key,i)=>{if(i===0||i===keys.length-1||i%Math.ceil(keys.length/7)===0)svg+='<text x="'+x(i)+'" y="221" text-anchor="middle">'+h(key.length===10?key.slice(-2):key.length===7?key.slice(-2):key)+'</text>';});
  svg+='<line id="chartCrosshair" class="chart-crosshair" x1="38" x2="38" y1="16" y2="200" visibility="hidden"/>';chart.innerHTML=svg;chart.setAttribute('tabindex','0');chart.setAttribute('aria-label','Solving activity for '+series.length+' learners. Use left and right arrow keys to inspect periods.');
  $('graphLegend').innerHTML=series.map(s=>'<span class="graph-person" style="--series-color:'+s.color+'">'+avatar(s.profile)+'<i></i>'+h(s.name)+'</span>').join('');
  if($('chartTable'))$('chartTable').innerHTML='<table><thead><tr><th>Period</th>'+series.map(s=>'<th>'+h(s.name)+'</th>').join('')+'</tr></thead><tbody>'+keys.map((key,i)=>'<tr><th>'+key+'</th>'+series.map(s=>'<td>'+s.data.values[i]+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  let active=keys.length-1;const inspect=i=>{active=Math.max(0,Math.min(keys.length-1,i));const cross=chart.querySelector('#chartCrosshair');cross.setAttribute('visibility','visible');cross.setAttribute('x1',x(active));cross.setAttribute('x2',x(active));this.tooltip.hidden=false;this.tooltip.innerHTML='<div class="chart-tooltip-heading"><strong>'+h(keys[active])+'</strong><button type="button" aria-label="Close chart details">×</button></div>'+[...series].sort((a,b)=>b.data.values[active]-a.data.values[active]).map(s=>'<div class="chart-tooltip-row" style="--series-color:'+s.color+'">'+avatar(s.profile)+'<i></i><span>'+h(s.name)+'</span><b>'+s.data.values[active]+'</b></div>').join('');this.tooltip.querySelector('button').onclick=()=>{this.tooltip.hidden=true;cross.setAttribute('visibility','hidden');chart.focus();};};
  chart.onpointermove=e=>{if(e.pointerType==='touch'&&e.buttons===0)return;const rect=chart.getBoundingClientRect();inspect(Math.round(((e.clientX-rect.left)/rect.width*900-left)/(w-left-18)*(keys.length-1)));};
  chart.onclick=e=>{const rect=chart.getBoundingClientRect();inspect(Math.round(((e.clientX-rect.left)/rect.width*900-left)/(w-left-18)*(keys.length-1)));};
  chart.onkeydown=e=>{if(['ArrowRight','ArrowLeft','Home','End','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape'){this.tooltip.hidden=true;chart.querySelector('#chartCrosshair').setAttribute('visibility','hidden');return;}inspect(e.key==='Home'?0:e.key==='End'?keys.length-1:active+(e.key==='ArrowRight'?1:-1));}};
 }
}
