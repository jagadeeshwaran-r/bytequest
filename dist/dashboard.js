import {bucketSolves,solveEvents,chartValues,chartDomain,straightPath,visiblePeriodCount,topicProgress,forecastSolvePace,smoothPath} from './dashboard-model.js?v=forecast-1';
import {escapeHtml as h} from './community-model.js';
const photo=p=>p?.avatar_url&&/^https:\/\//.test(p.avatar_url)?p.avatar_url:'';
const initial=p=>(p?.display_name||p?.username||'You').trim().charAt(0).toUpperCase();
const avatar=p=>'<span class="chart-avatar">'+(photo(p)?'<img src="'+h(photo(p))+'" alt="" referrerpolicy="no-referrer">':h(initial(p)))+'</span>';
export class Dashboard{
 constructor({cloud,getState,getCatalog,getEvents=null,summary=null,name='You',profile=null,viewerProfile=null,topicInsights=[],allowCompare=true}){
  Object.assign(this,{cloud,getState,getCatalog,getEvents,summary,name,profile,viewerProfile,topicInsights,allowCompare,topicsExpanded:false,epoch:0,accountGeneration:0,loadedFor:null,friends:[],selected:new Set(),cache:new Map()});this.$=id=>document.getElementById(id);
  this.$('graphMonth').value=new Date().toISOString().slice(0,7);this.$('graphYear').value=new Date().getUTCFullYear();
  // Profile has graphMeasure; the legacy problem-library dashboard doesn't.
  // Optional controls must not prevent the entire problem page from booting.
  for(const id of ['graphMode','graphMeasure','graphForecast','graphMonth','graphYear','graphTopic']){
   const control=this.$(id);
   if(control)control.onchange=()=>this.render();
  }
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
  const events=this.getEvents?this.getEvents():solveEvents(this.getState(),catalog);
  try{own=bucketSolves(events,opts);this.paintTopics(topicProgress(catalog,this.topicInsights,events,opts));}catch(e){$('dashboardMessage').textContent=e.message;return;}
  const series=[{name:this.name,profile:this.profile,data:own,events,color:'#16a477'}];this.draw(series);
  for(const [id,v] of [['dashboardSolved',this.summary?.solved??0],['dashboardActive',this.summary?.active??0],['dashboardPeriod',own.total]])if($(id))$(id).textContent=v;
  if(!this.allowCompare){$('dashboardMessage').textContent='';$('dashboardMessage').hidden=true;return;}
  const ids=[...this.selected];$('dashboardMessage').textContent=ids.length?'Loading friend activity…':this.cloud.user?'Choose any number of followed friends, or compare all.':'Sign in and follow people to compare activity.';
  if(!ids.length)return;
  try{
   const missing=ids.filter(id=>!this.cache.has(id)||Date.now()-this.cache.get(id).at>30000);
   if(missing.length){const result=await this.cloud.request('friend-analytics',{targets:missing});if(ticket!==this.epoch)return;for(const id of missing)this.cache.set(id,{at:Date.now(),user:(result.users||[]).find(p=>p.public_id===id)||null});}
   if(ticket!==this.epoch)return;
   for(const [i,id] of ids.entries()){const p=this.cache.get(id)?.user;if(!p)continue;series.push({name:'@'+p.username,profile:p,data:bucketSolves(p.solves||[],opts),events:p.solves||[],color:'hsl('+((i*137.508+215)%360).toFixed(1)+' 52% 58%)'});}
   this.draw(series);$('dashboardMessage').textContent='Comparing '+(series.length-1)+' friend'+(series.length===2?'':'s')+'. Hover, tap or use arrow keys on the chart to identify every line.'+(series.length!==ids.length+1?' Some profiles are no longer available.':'');
  }catch(e){if(ticket===this.epoch)$('dashboardMessage').textContent=e.message;}
 }
 paintTopics(rows){
  const $=this.$,host=$('topicBreakdown');
  if(!rows.length){
   host.innerHTML='<p class="topic-unavailable">Topic totals are unavailable until the published problem catalog loads.</p>';
   return;
  }
  const shown=this.topicsExpanded?rows:rows.slice(0,5);
  host.innerHTML='<p class="topic-progress-caption">Solved / available in the current catalog · Growth in the selected period</p>'+
   shown.map(t=>'<div class="topic-progress-row"><div class="topic-progress-heading"><span>'+h(t.name)+'</span><strong>'+t.solved+' / '+t.total+'</strong></div>'+
    '<div class="topic-progress-bar" role="progressbar" aria-label="'+h(t.name)+' completion" aria-valuemin="0" aria-valuemax="'+t.total+'" aria-valuenow="'+t.solved+'"><i style="width:'+t.percent+'%"></i></div>'+
    '<div class="topic-progress-meta"><span>'+t.percent+'% complete</span><span>'+(t.period?'<b>+'+t.period+'</b> this period':'No new solves this period')+'</span></div></div>').join('')+
   (rows.length>5?'<button id="toggleTopicGrowth" class="topic-progress-toggle" type="button" aria-expanded="'+this.topicsExpanded+'">'+(this.topicsExpanded?'Show fewer topics':'Show all '+rows.length+' topics')+'</button>':'');
  const toggle=host.querySelector('#toggleTopicGrowth');
  if(toggle)toggle.onclick=()=>{this.topicsExpanded=!this.topicsExpanded;this.paintTopics(rows);};
 }
 draw(series){
  const $=this.$,chart=$('frequencyChart'),keys=series[0].data.keys,w=900,left=38,top=20,plotH=175;
  const mode=$('graphMode').value,measure=$('graphMeasure')?.value==='cumulative'?'cumulative':'period';
  const visible=visiblePeriodCount(keys,mode),today=new Date().toISOString().slice(0,10);
  const toggle=$('graphForecast'),toggleLabel=toggle?.closest('.graph-forecast-toggle');
  const inCurrentMonth=mode==='daily'&&visible>0&&visible<keys.length&&keys[visible-1]===today;
  if(toggleLabel)toggleLabel.hidden=!inCurrentMonth;
  const requested=!!toggle?.checked&&inCurrentMonth;
  const horizon=requested?Math.min(7,keys.length-visible):0;
  const selectedTopic=$('graphTopic').value;
  const lines=series.map(s=>{
   const values=chartValues(s.data.values,measure);
   const raw=horizon?forecastSolvePace(s.events||[],{today,topic:selectedTopic,horizon}):{values:[],sample:0};
   let total=values[visible-1]||0;
   const forecast=raw.values.map(value=>{
    if(measure==='cumulative'){total+=value;return Number(total.toFixed(2));}
    return value;
   });
   return {...s,values,forecast,forecastSample:raw.sample};
  });
  const projectionDays=Math.max(0,...lines.map(s=>s.forecast.length));
  const allNumbers=lines.flatMap(s=>[...s.values.slice(0,visible),...s.forecast]);
  const domain=chartDomain(Math.max(0,...allNumbers));
  const x=i=>left+i*(w-left-18)/Math.max(1,keys.length-1);
  const y=v=>top+plotH-v/domain.max*plotH;
  this.tooltip.hidden=true;
  let svg='';
  for(let i=0;i<=domain.ticks;i++){
   const v=i*domain.step;
   svg+='<line x1="38" x2="882" y1="'+y(v)+'" y2="'+y(v)+'" class="graph-grid"/><text x="28" y="'+(y(v)+4)+'" text-anchor="end">'+v+'</text>';
  }
  for(const s of lines){
   const historical=s.values.slice(0,visible).map((v,i)=>[x(i),y(v)]);
   if(historical.length)svg+='<path class="graph-curve graph-precise-line" fill="none" stroke="'+s.color+'" stroke-width="2.3" stroke-linejoin="round" d="'+straightPath(historical)+'"/>';
   s.values.slice(0,visible).forEach((v,i)=>{
    if(v>0)svg+='<circle class="graph-actual-point" cx="'+x(i)+'" cy="'+y(v)+'" r="3.3" fill="'+s.color+'"><title>'+h(s.name+' · '+keys[i]+': '+v+' actual solves')+'</title></circle>';
   });
   // Prediction is a distinct dotted path, beginning at the last actual
   // point; only this illustrative line uses curved interpolation.
   if(s.forecast.length){
    const path=[[x(visible-1),y(s.values[visible-1])],...s.forecast.map((v,i)=>[x(visible+i),y(v)])];
    svg+='<path class="graph-forecast-line" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 6" d="'+smoothPath(path)+'"><title>'+h(s.name)+': estimated solve pace, not guaranteed</title></path>';
    for(const i of [0,s.forecast.length-1]){
     svg+='<circle class="graph-forecast-point" cx="'+x(visible+i)+'" cy="'+y(s.forecast[i])+'" r="3" fill="var(--surface)" stroke="'+s.color+'" stroke-width="1.8"><title>'+h(s.name+' · '+keys[visible+i]+': about '+s.forecast[i].toFixed(1)+' predicted solves')+'</title></circle>';
    }
   }
  }
  keys.forEach((key,i)=>{if(i===0||i===keys.length-1||i%Math.ceil(keys.length/7)===0)svg+='<text x="'+x(i)+'" y="221" text-anchor="middle">'+h(key.length===10?key.slice(-2):key.length===7?key.slice(-2):key)+'</text>';});
  if(!visible)svg+='<text x="460" y="105" text-anchor="middle" class="graph-no-data">This period is in the future</text>';
  svg+='<line id="chartCrosshair" class="chart-crosshair" x1="38" x2="38" y1="16" y2="200" visibility="hidden"/>';
  chart.innerHTML=svg;
  chart.setAttribute('tabindex','0');
  chart.setAttribute('aria-label','Solving activity for '+lines.length+' learners. Solid lines are actual accepted solves. Dotted lines are illustrative forecasts, when available. Use left and right arrow keys to inspect.');
  $('graphLegend').innerHTML=lines.map(s=>'<span class="graph-person" style="--series-color:'+s.color+'">'+avatar(s.profile)+'<i></i>'+h(s.name)+'</span>').join('');
  const note=$('graphForecastNote');
  if(note){
   note.hidden=!requested;
   if(requested)note.textContent=projectionDays
    ?'Dotted = rough estimate from the past 14 UTC days (3+ recent solves required). Solid = actual. Forecasts are not guaranteed.'
    :'No forecast yet: at least 3 accepted solves in the past 14 days are needed for you or a selected friend.';
  }
  if($('chartTable'))$('chartTable').innerHTML='<table><thead><tr><th>Period</th>'+lines.map(s=>'<th>'+h(s.name)+'</th>').join('')+'</tr></thead><tbody>'+
   keys.slice(0,visible+projectionDays).map((key,i)=>{
    const future=i>=visible;
    return '<tr><th>'+h(key)+(future?' (estimate)':'')+'</th>'+lines.map(s=>{
     const value=future?s.forecast[i-visible]:s.values[i];
     return '<td>'+(value===undefined?'—':future?'≈'+value.toFixed(1):value)+'</td>';
    }).join('')+'</tr>';
   }).join('')+'</tbody></table>';
  const cross=chart.querySelector('#chartCrosshair');
  const hide=()=>{this.tooltip.hidden=true;cross.setAttribute('visibility','hidden');};
  const last=visible+projectionDays-1;
  let active=Math.max(0,visible-1);
  const inspect=i=>{
   if(i<0||i>last){hide();return;}
   active=i;
   cross.setAttribute('visibility','visible');
   cross.setAttribute('x1',x(i));cross.setAttribute('x2',x(i));
   this.tooltip.hidden=false;
   const future=i>=visible;
   const read=s=>future?s.forecast[i-visible]:s.values[i];
   this.tooltip.innerHTML='<div class="chart-tooltip-heading"><strong>'+h(keys[i])+' · '+(future?'Forecast (estimate)':measure==='cumulative'?'Cumulative actual':'Actual solves')+'</strong><button type="button" aria-label="Close chart details">×</button></div>'+
    [...lines].sort((a,b)=>(read(b)??-1)-(read(a)??-1)).map(s=>{
     const value=read(s);
     return '<div class="chart-tooltip-row" style="--series-color:'+s.color+'">'+avatar(s.profile)+'<i></i><span>'+h(s.name)+'</span><b>'+(value===undefined?'—':future?'≈'+value.toFixed(1):value)+'</b></div>';
    }).join('');
   this.tooltip.querySelector('button').onclick=()=>{hide();chart.focus();};
  };
  const position=e=>{
   const rect=chart.getBoundingClientRect();
   return Math.round(((e.clientX-rect.left)/rect.width*w-left)/(w-left-18)*(keys.length-1));
  };
  chart.onpointermove=e=>{if(e.pointerType==='touch'&&e.buttons===0)return;inspect(position(e));};
  chart.onclick=e=>inspect(position(e));
  chart.onpointerleave=hide;
  chart.onkeydown=e=>{
   if(!['ArrowRight','ArrowLeft','Home','End','Escape'].includes(e.key))return;
   e.preventDefault();
   if(e.key==='Escape'){hide();return;}
   if(last<0){hide();return;}
   inspect(e.key==='Home'?0:e.key==='End'?last:Math.max(0,Math.min(last,active+(e.key==='ArrowRight'?1:-1))));
  };
 }
}
