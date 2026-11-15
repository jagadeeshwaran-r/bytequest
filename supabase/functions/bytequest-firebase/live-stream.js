// Authenticated POST/SSE keeps tokens out of URLs and replays durable per-user events.
export function liveEventResponse({req,headers,owner,db,durationMs=50000,intervalMs=1000}){
 let cancelled=false;const encoder=new TextEncoder();req.signal.addEventListener('abort',()=>{cancelled=true;},{once:true});
 const stream=new ReadableStream({async start(controller){
  const emit=batch=>{if(!cancelled)controller.enqueue(encoder.encode('data: '+JSON.stringify(batch)+'\n\n'));};
  let cursor=null,announcementCursor=null;const until=Date.now()+durationMs;
  try{
   const body=await req.json();cursor=body.after??null;announcementCursor=body.announcementsAfter??null;
   if(cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<0))throw new Error('Invalid cursor');
   if(announcementCursor!==null&&(!Number.isSafeInteger(announcementCursor)||announcementCursor<0))throw new Error('Invalid update cursor');
   while(!cancelled&&Date.now()<until){const batch=await db.liveEvents(owner,cursor,announcementCursor);cursor=batch.cursor;announcementCursor=batch.announcementCursor??announcementCursor;emit(batch);await new Promise(resolve=>setTimeout(resolve,intervalMs));}
  }catch{try{emit({error:'Live updates paused. Reconnecting.'});}catch{}}
  finally{if(!cancelled)try{controller.close();}catch{}}
 },cancel(){cancelled=true;}});
 return new Response(stream,{headers:{...headers,'Content-Type':'text/event-stream','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'}});
}
