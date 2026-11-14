export const IDLE_MS=30000;
export function isActive({visible,focused,lastInput,now}){return visible&&focused&&now-lastInput>=0&&now-lastInput<IDLE_MS;}
export function presenceOnline(p,now=Date.now()){
 if(!p?.visible||!p.online)return false;
 return Number.isFinite(p.expiresAtMs)?now<p.expiresAtMs:true;
}
export function receivedPresence(p,now=Date.now()){
 if(!p)return{visible:false};const server=Date.parse(p.serverNow),expires=Date.parse(p.expiresAt);
 return {...p,expiresAtMs:Number.isFinite(server)&&Number.isFinite(expires)?now+expires-server:undefined};
}
export function accountCard(user,profile,previous){
 if(!user)return null;const same=previous?.owner===user.id;
 const name=profile?.display_name||(same?previous.name:null)||user.user_metadata?.full_name||'Account';
 const avatar=profile?profile.avatar_url||'':same?previous.avatar||'':'';
 const avatarKey=profile?.uploadedAvatar?'upload:'+profile.public_id+':'+profile.updated_at:avatar;
 const capturedAt=same&&previous.avatar===avatar?(previous.capturedAt||previous.storedAt):Date.now();
 return{owner:user.id,name,avatar,avatarKey:profile?avatarKey:same?previous.avatarKey:avatarKey,capturedAt,storedAt:Date.now()};
}
