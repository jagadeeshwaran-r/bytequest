// Solving days and streaks are counted in UTC. Use the same boundary for
// the visible countdown instead of device-local midnight or a drifting timer.
const UTC_DAY_MS=24*60*60*1000;
export function streakCountdownUrgency(now=Date.now()){
 if(!Number.isFinite(now))throw new TypeError('A valid timestamp is required.');
 const elapsed=((Math.floor(now)%UTC_DAY_MS)+UTC_DAY_MS)%UTC_DAY_MS;
 const left=UTC_DAY_MS-elapsed;
 // >= 12h: comfortable; 4h–12h: approaching; < 4h: close to rollover.
 return left>=12*60*60*1000?'green':left>=4*60*60*1000?'orange':'red';
}
export function nextStreakDayCountdown(now=Date.now()){
  if(!Number.isFinite(now))throw new TypeError('A valid timestamp is required.');
  const elapsed=((Math.floor(now)%UTC_DAY_MS)+UTC_DAY_MS)%UTC_DAY_MS;
  const seconds=Math.ceil((UTC_DAY_MS-elapsed)/1000);
  const hours=String(Math.floor(seconds/3600)).padStart(2,'0');
  const minutes=String(Math.floor(seconds%3600/60)).padStart(2,'0');
  const remaining=String(seconds%60).padStart(2,'0');
  return hours+':'+minutes+':'+remaining;
}
export function bindStreakCountdown(root,{now=()=>Date.now(),every=globalThis.setInterval,stop=globalThis.clearInterval,onDayChange=()=>{}}={}){
  const node=root?.querySelector?.('[data-streak-countdown]');
  if(!node)return ()=>{};
  const wrapper=node.closest?.('.streak-reset');
  let timer=null,lastUtcDay=null;
  const update=()=>{
    if(node.isConnected===false){if(timer!==null){stop(timer);timer=null;}return;}
    const stamp=now(),day=new Date(stamp).toISOString().slice(0,10);
    node.textContent=nextStreakDayCountdown(stamp);
    if(wrapper?.dataset)wrapper.dataset.urgency=streakCountdownUrgency(stamp);
    // A true UTC date rollover is also the moment the today marker in the
    // annual heatmap must move. Do not needlessly redraw 365 cells each tick.
    if(lastUtcDay!==null&&lastUtcDay!==day)onDayChange(day);
    lastUtcDay=day;
  };
  // The absolute UTC timestamp is re-read every tick so background-tab
  // throttling and laptop sleep cannot accumulate timer drift.
  update();
  timer=every(update,1000);
  return ()=>{if(timer!==null){stop(timer);timer=null;}};
}
