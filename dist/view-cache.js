// Account-scoped, short-lived page view cache. Chat, notifications, online
// presence, Firebase identity, and private progress never pass through this module.
export const LEADERBOARD_TTL_MS=5*60*1000;
export const PROFILE_TTL_MS=2*60*1000;
export const ACCOUNT_TTL_MS=2*60*1000;
export const STALE_VIEW_MAX_MS=24*60*60*1000;
const PREFIX="bytequest.views.v1:";
const MAX_ENTRY_BYTES=750000;
// Private avatar links are signed by the server for 600 seconds; old cache
// snapshots must fall back to initials rather than display expired image URLs.
const SIGNED_AVATAR_SAFE_AGE_MS=8*60*1000;
function avatarStillValid(row,age){
  if(!row||age<SIGNED_AVATAR_SAFE_AGE_MS||typeof row.avatar_url!=="string"
    ||!row.avatar_url.includes("/storage/v1/object/sign/bytequest-avatars/"))return row;
  return {...row,avatar_url:""};
}
function safeCachedImages(kind,value,age){
  if(age<SIGNED_AVATAR_SAFE_AGE_MS)return value;
  if(kind==="board")return {
    ...value,
    users:value.users.map(row=>avatarStillValid(row,age)),
    me:avatarStillValid(value.me,age)
  };
  if(kind==="profile")return {...value,profile:avatarStillValid(value.profile,age)};
  return value;
}
function browserSession(){
  try{return globalThis.sessionStorage||null;}catch{return null;}
}
function validBoard(value){
  return !!value&&typeof value==="object"&&Array.isArray(value.users)
    &&Number.isFinite(value.total)&&value.total>=0;
}
function validProfile(value){
  return !!value&&typeof value==="object"&&!!value.profile
    &&typeof value.profile.public_id==="string"
    &&typeof value.profile.username==="string"
    &&value.stats&&typeof value.stats==="object";
}
function validAccount(value){
  return !!value&&typeof value==="object"&&typeof value.admin==="boolean"
    &&(value.profile===null||
      !!value.profile&&typeof value.profile==="object"
      &&typeof value.profile.public_id==="string"
      &&typeof value.profile.username==="string");
}
export function createViewCache({storage=browserSession(),now=()=>Date.now()}={}){
  const key=(owner,kind,identity)=>owner&&typeof identity==="string"
    ?PREFIX+encodeURIComponent(owner)+":"+kind+":"+encodeURIComponent(identity):null;
  function read(owner,kind,identity,ttl,validate,allowStale=false){
    const id=key(owner,kind,identity);
    if(!id||!storage)return null;
    try{
      const raw=storage.getItem(id);
      if(!raw||raw.length>MAX_ENTRY_BYTES)return null;
      const entry=JSON.parse(raw),age=now()-entry.at;
      if(entry.version!==1||!Number.isFinite(age)||age<0||age>=(allowStale?STALE_VIEW_MAX_MS:ttl)||!validate(entry.value))return null;
      return safeCachedImages(kind,entry.value,age);
    }catch{return null;}
  }
  function write(owner,kind,identity,value,validate){
    const id=key(owner,kind,identity);
    if(!id||!storage||!validate(value))return;
    try{
      const raw=JSON.stringify({version:1,at:now(),value});
      if(raw.length<=MAX_ENTRY_BYTES)storage.setItem(id,raw);
    }catch{} // Storage restrictions and quota limits must never interrupt navigation.
  }
  function remove(owner,kind,identity){
    try{const id=key(owner,kind,identity);if(id)storage?.removeItem(id);}catch{}
  }
  function clearOwner(owner){
    if(!owner||!storage)return;
    try{
      const prefix=PREFIX+encodeURIComponent(owner)+":",items=[];
      for(let i=0;i<storage.length;i++){
        const item=storage.key(i);
        if(typeof item==="string"&&item.startsWith(prefix))items.push(item);
      }
      for(const item of items)storage.removeItem(item);
    }catch{}
  }
  const boardId=({scope="global",period="all",page=0}={})=>scope+":"+period+":"+page;
  return {
    board(owner,query,{allowStale=false}={}){return read(owner,"board",boardId(query),LEADERBOARD_TTL_MS,validBoard,allowStale);},
    self(owner){return read(owner,"self","current",ACCOUNT_TTL_MS,validAccount);},
    saveSelf(owner,response){
      if(!response||typeof response!=="object")return;
      // Only the fields required for immediate profile navigation, never tokens,
      // progress, notifications, messages, or live presence.
      write(owner,"self","current",{admin:response.admin===true,profile:response.profile??null},validAccount);
    },
    saveBoard(owner,query,value){write(owner,"board",boardId(query),value,validBoard);},
    invalidateBoard(owner,query){remove(owner,"board",boardId(query));},
    profile(owner,target,{allowStale=false}={}){return read(owner,"profile",String(target||"").toLowerCase(),PROFILE_TTL_MS,validProfile,allowStale);},
    saveProfile(owner,target,value){
      if(!validProfile(value))return;
      // Do not persist presence: live online and last-seen are fetched independently.
      const {presence,...stable}=value;
      write(owner,"profile",String(target||"").toLowerCase(),stable,validProfile);
    },
    invalidateProfile(owner,target){remove(owner,"profile",String(target||"").toLowerCase());},
    clearOwner
  };
}

/** Warm only the initial public-facing ranking and the user's own profile.
 * This is optional: any network failure leaves normal on-demand fetch intact.
 * Never prefetch chat, notifications, presence, tokens, or private progress.
 */
export async function prefetchCommunityViews(cloud,{owner,profile,cache=createViewCache()}={}){
  if(!owner||cloud?.user?.id!==owner)return [];
  const jobs=[];
  const defaultBoard={scope:"global",period:"all",page:0};
  if(!cache.board(owner,defaultBoard,{allowStale:true})){
    jobs.push(cloud.request("leaderboard",defaultBoard,owner).then(result=>{
      if(cloud.user?.id===owner)cache.saveBoard(owner,defaultBoard,result);
    }));
  }
  const username=profile?.username;
  if(typeof username==="string"&&username&&!cache.profile(owner,username,{allowStale:true})){
    jobs.push(cloud.request("profile",{target:username},owner).then(result=>{
      if(cloud.user?.id===owner)cache.saveProfile(owner,username,result);
    }));
  }
  return Promise.allSettled(jobs);
}
