// A durable cursor recovers transitions that snapshot polling can miss. Tokens stay in headers.
export function mountLiveEvents(cloud,{onBatch=()=>{},onResume=()=>{},win=window,doc=document}={}){
 let owner=null,cursor=null,generation=0,controller=null,retry=null,disposed=false,failures=0;
 const visible=()=>doc.visibilityState==='visible'&&doc.hasFocus()&&!cloud.deletionPending;
 const key=id=>'bytequest.live.'+id;
 function stop(){generation++;controller?.abort();controller=null;win.clearTimeout(retry);retry=null;}
 function remember(value){if(!Number.isSafeInteger(value)||value<0)return;cursor=value;try{win.sessionStorage.setItem(key(owner),String(value));}catch{}}
 function consume(batch,ticket,user){if(ticket!==generation||user!==owner||!visible())return;const previous=cursor;remember(batch.cursor);onBatch({...batch,events:(batch.events||[]).filter(e=>previous===null||e.id>previous)});}
 async function connect(){
  if(disposed||!owner||!visible()||controller)return;const ticket=generation,user=owner;controller=new AbortController();const signal=controller.signal;
  try{
   if(failures>=2){const batch=await cloud.request('live-events-poll',{after:cursor},user);consume(batch,ticket,user);}
   else await cloud.openLive({after:cursor,signal,onBatch:batch=>consume(batch,ticket,user)},user);
   if(ticket!==generation)return;failures=failures>=2?failures+1:0;if(failures>=8)failures=0;
  }catch(e){if(ticket!==generation||signal.aborted)return;failures++;}
  finally{if(ticket===generation){controller=null;if(visible()&&owner)retry=win.setTimeout(connect,failures>=2?2000:failures?1500:300);}}
 }
 function visibility(){if(visible()){onResume();connect();}else stop();}
 win.addEventListener('focus',visibility);win.addEventListener('blur',visibility);win.addEventListener('online',visibility);doc.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',stop);
 return{setOwner(user){const next=user?.id||null;if(next===owner){if(cloud.deletionPending)stop();return;}stop();owner=next;cursor=null;failures=0;try{const saved=win.sessionStorage.getItem(key(next));if(next&&saved!==null&&Number.isSafeInteger(Number(saved))&&Number(saved)>=0)cursor=Number(saved);}catch{}if(owner)connect();},dispose(){disposed=true;stop();owner=null;win.removeEventListener('focus',visibility);win.removeEventListener('blur',visibility);win.removeEventListener('online',visibility);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',stop);}};
}
