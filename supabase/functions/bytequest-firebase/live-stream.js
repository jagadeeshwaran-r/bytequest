// Authenticated POST/SSE keeps tokens out of URLs and replays durable per-user events.
// Adaptive polling reduces quiet-room DB and UI work while preserving fast updates.
export function nextLivePollDelay(idlePolls,baseMs=1000){
 const ms=Number.isFinite(baseMs)&&baseMs>=0?baseMs:1000;
 return idlePolls<3?ms:Math.min(idlePolls<6?ms*2:ms*3,Math.max(ms,2500));
}
export function liveEventResponse({req,headers,owner,db,durationMs=50000,intervalMs=1000}){
 let cancelled=false;const encoder=new TextEncoder();req.signal.addEventListener('abort',()=>{cancelled=true;},{once:true});
 const stream=new ReadableStream({async start(controller){
  const emit=batch=>{if(!cancelled)controller.enqueue(encoder.encode('data: '+JSON.stringify(batch)+'\n\n'));};
  let cursor=null,announcementCursor=null,lastUnread,lastUpdatesUnread,idlePolls=0,first=true;const until=Date.now()+durationMs;
  try{
   const body=await req.json();cursor=body.after??null;announcementCursor=body.announcementsAfter??null;
   if(cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<0))throw new Error('Invalid cursor');
   if(announcementCursor!==null&&(!Number.isSafeInteger(announcementCursor)||announcementCursor<0))throw new Error('Invalid update cursor');
   while(!cancelled&&Date.now()<until){
    const oldCursor=cursor,oldAnnouncements=announcementCursor;
    const batch=await db.liveEvents(owner,cursor,announcementCursor);
    cursor=batch.cursor;announcementCursor=batch.announcementCursor??announcementCursor;
    const changed=first||(batch.events?.length||0)>0||(batch.announcements?.length||0)>0
      ||cursor!==oldCursor||announcementCursor!==oldAnnouncements
      ||batch.unread!==lastUnread||batch.updatesUnread!==lastUpdatesUnread;
    lastUnread=batch.unread;lastUpdatesUnread=batch.updatesUnread;first=false;
    idlePolls=changed?0:idlePolls+1;
    emit(batch);
    await new Promise(resolve=>setTimeout(resolve,nextLivePollDelay(idlePolls,intervalMs)));
   }
  }catch{try{emit({error:'Live updates paused. Reconnecting.'});}catch{}}
  finally{if(!cancelled)try{controller.close();}catch{}}
 },cancel(){cancelled=true;}});
 return new Response(stream,{headers:{...headers,'Content-Type':'text/event-stream','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'}});
}
