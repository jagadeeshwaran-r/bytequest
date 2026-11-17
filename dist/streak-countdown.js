// Solving days and streaks are counted in UTC. Use the same boundary for
// the visible countdown instead of device-local midnight or a drifting timer.
const UTC_DAY_MS=24*60*60*1000;
export function nextStreakDayCountdown(now=Date.now()){
  if(!Number.isFinite(now))throw new TypeError('A valid timestamp is required.');
  const elapsed=((Math.floor(now)%UTC_DAY_MS)+UTC_DAY_MS)%UTC_DAY_MS;
  const seconds=Math.ceil((UTC_DAY_MS-elapsed)/1000);
  const hours=String(Math.floor(seconds/3600)).padStart(2,'0');
  const minutes=String(Math.floor(seconds%3600/60)).padStart(2,'0');
  const remaining=String(seconds%60).padStart(2,'0');
  return hours+':'+minutes+':'+remaining;
}
export function bindStreakCountdown(root,{now=()=>Date.now(),every=globalThis.setInterval,stop=globalThis.clearInterval}={}){
  const node=root?.querySelector?.('[data-streak-countdown]');
  if(!node)return ()=>{};
  const update=()=>{
    if(node.isConnected===false){stop(timer);return;}
    node.textContent=nextStreakDayCountdown(now());
  };
  // The absolute UTC timestamp is re-read every tick so background-tab
  // throttling and laptop sleep cannot accumulate timer drift.
  update();
  const timer=every(update,1000);
  return ()=>stop(timer);
}
