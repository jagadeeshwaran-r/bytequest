// Account-scoped, short-lived page view cache. Chat, notifications, online
// presence, Firebase identity, and private progress never pass through this module.
export const LEADERBOARD_TTL_MS=5*60*1000;
export const PROFILE_TTL_MS=2*60*1000;
const PREFIX="bytequest.views.v1:";
const MAX_ENTRY_BYTES=750000;
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
export function createViewCache({storage=browserSession(),now=()=>Date.now()}={}){
  const key=(owner,kind,identity)=>owner&&typeof identity==="string"
    ?PREFIX+encodeURIComponent(owner)+":"+kind+":"+encodeURIComponent(identity):null;
  function read(owner,kind,identity,ttl,validate){
    const id=key(owner,kind,identity);
    if(!id||!storage)return null;
    try{
      const raw=storage.getItem(id);
      if(!raw||raw.length>MAX_ENTRY_BYTES)return null;
      const entry=JSON.parse(raw),age=now()-entry.at;
      if(entry.version!==1||!Number.isFinite(age)||age<0||age>=ttl||!validate(entry.value))return null;
      return entry.value;
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
    board(owner,query){return read(owner,"board",boardId(query),LEADERBOARD_TTL_MS,validBoard);},
    saveBoard(owner,query,value){write(owner,"board",boardId(query),value,validBoard);},
    invalidateBoard(owner,query){remove(owner,"board",boardId(query));},
    profile(owner,target){return read(owner,"profile",String(target||"").toLowerCase(),PROFILE_TTL_MS,validProfile);},
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
