export const IDLE_MS=30000;
export function isActive({visible,focused,lastInput,now}){return visible&&focused&&now-lastInput>=0&&now-lastInput<IDLE_MS;}
export function presenceOnline(p,now=Date.now()){
 if(!p?.visible||!p.online)return false;
 return Number.isFinite(p.expiresAtMs)?now<p.expiresAtMs:true;
}
export function receivedPresence(p,now=Date.now()){
 if(!p)return{visible:false};const server=Date.parse(p.serverNow),expires=Date.parse(p.expiresAt),last=Date.parse(p.lastSeen);
 return {...p,expiresAtMs:Number.isFinite(server)&&Number.isFinite(expires)?now+expires-server:undefined,lastSeenMs:Number.isFinite(last)?Number.isFinite(server)?now+last-server:last:undefined};
}
export function relativeTime(value,now=Date.now()){
 const at=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(at))return null;
 const seconds=Math.max(0,Math.floor((now-at)/1000));if(!seconds)return 'just now';
 for(const [size,singular,plural] of [[31536000,'yr','yrs'],[2592000,'month','months'],[86400,'day','days'],[3600,'hr','hrs'],[60,'minute','minutes'],[1,'sec','sec']]){
  if(seconds>=size){const n=Math.floor(seconds/size);return n+' '+(n===1?singular:plural)+' ago';}
 }
}
export function profilePreferences(profile){return{discoverable:profile?.discoverable??true,show_presence:profile?.show_presence??true};}
export function accountCard(user,profile,previous){
 if(!user)return null;const same=previous?.owner===user.id;
 const name=profile?.display_name||(same?previous.name:null)||user.user_metadata?.full_name||'Account';
 const freshAvatar=profile?profile.avatar_url||'':same?previous.avatar||'':'';
 const avatarKey=profile?.uploadedAvatar?'upload:'+profile.public_id+':'+profile.updated_at:profile?freshAvatar:same?previous.avatarKey:freshAvatar;
 const oldCapture=previous?.capturedAt||previous?.storedAt||0;
 const reuse=same&&previous.avatarKey===avatarKey&&Date.now()-oldCapture<300000;
 const avatar=reuse?previous.avatar:freshAvatar;
 const capturedAt=same&&previous.avatar===avatar?(previous.capturedAt||previous.storedAt):Date.now();
 return{owner:user.id,name,avatar,avatarKey:profile?avatarKey:same?previous.avatarKey:avatarKey,capturedAt,storedAt:Date.now()};
}
