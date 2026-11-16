// Small, account-scoped cache for avatars served by ByteQuest's private Supabase
// bucket. It stores image bytes, never Firebase tokens or signed URLs. A cached
// image can still render after its short-lived signed download link has expired.
// Cross-origin/CORS/storage failures are nonfatal: the existing letter fallback stays.
const PREFIX="bytequest-avatar-images.v1:";
const MARKER="/storage/v1/object/sign/bytequest-avatars/";
const MAX_AGE_MS=24*60*60*1000;
const MAX_IMAGE_BYTES=256*1024;
const KEY_PATTERN=/^[a-zA-Z0-9_-]{1,128}\/avatar\.(?:jpg|jpeg|png|webp)$/i;
const fallbackStorage=()=>{try{return globalThis.caches||null;}catch{return null;}};
const cacheName=owner=>PREFIX+encodeURIComponent(owner);
const requestFor=key=>new Request("https://bytequest-avatar-cache.invalid/media/"+encodeURIComponent(key));

export function avatarKeyFromSignedUrl(value){
  if(typeof value!=="string"||!value)return "";
  try{
    const url=new URL(value);
    if(url.protocol!=="https:"||!url.hostname.endsWith(".supabase.co")
      ||!url.pathname.startsWith(MARKER))return "";
    const path=decodeURIComponent(url.pathname.slice(MARKER.length));
    return KEY_PATTERN.test(path)?path:"";
  }catch{return "";}
}
export function avatarKeyFromRow(row){
  const signed=avatarKeyFromSignedUrl(row?.avatar_url);
  const key=row?.avatar_cache_key;
  return signed||(typeof key==="string"&&KEY_PATTERN.test(key)?key:"");
}
export async function readCachedAvatar(owner,key,{cacheStorage=fallbackStorage(),now=()=>Date.now()}={}){
  if(!owner||!KEY_PATTERN.test(key)||!cacheStorage)return null;
  try{
    const cache=await cacheStorage.open(cacheName(owner));
    const response=await cache.match(requestFor(key));
    if(!response)return null;
    const saved=Number(response.headers.get("x-bytequest-cached-at"));
    const age=now()-saved;
    if(!Number.isFinite(saved)||!Number.isFinite(age)||age<0||age>=MAX_AGE_MS)return null;
    const blob=await response.blob();
    return blob.size>0&&blob.size<=MAX_IMAGE_BYTES&&/^image\/(jpeg|png|webp)$/.test(blob.type)?blob:null;
  }catch{return null;}
}

export async function warmAvatarImages(owner,rows,{cacheStorage=fallbackStorage(),
  fetchImpl=globalThis.fetch,now=()=>Date.now(),max=30}={}){
  if(!owner||!cacheStorage||typeof fetchImpl!=="function"||!Array.isArray(rows))return;
  const targets=new Map();
  for(const row of rows){
    const url=row?.avatar_url,key=avatarKeyFromSignedUrl(url);
    if(key&&!targets.has(key))targets.set(key,url);
    if(targets.size>=max)break;
  }
  if(!targets.size)return;
  let cache;
  try{cache=await cacheStorage.open(cacheName(owner));}catch{return;}
  const items=[...targets];
  let index=0;
  async function worker(){
    while(index<items.length){
      const [key,url]=items[index++];
      try{
        const req=requestFor(key);
        const cached=await readCachedAvatar(owner,key,{cacheStorage,now});
        if(cached)continue;
        // Network download is lower priority than the ranking text already shown.
        // The existing img element can still use the signed URL directly.
        const response=await fetchImpl(url,{mode:"cors",credentials:"omit",cache:"force-cache"});
        if(!response.ok)continue;
        const blob=await response.blob();
        if(!blob.size||blob.size>MAX_IMAGE_BYTES||!/^image\/(jpeg|png|webp)$/.test(blob.type))continue;
        const keys=await cache.keys();
        if(keys.length>=40&&!await cache.match(req))await cache.delete(keys[0]);
        await cache.put(req,new Response(blob,{headers:{
          "Content-Type":blob.type,"x-bytequest-cached-at":String(now())
        }}));
      }catch{} // CORS, private storage policy, quota or offline: use initials.
    }
  }
  await Promise.all([worker(),worker(),worker()]);
}
export async function clearAvatarImages(owner,{cacheStorage=fallbackStorage()}={}){
  if(!owner||!cacheStorage)return;
  try{await cacheStorage.delete(cacheName(owner));}catch{}
}

// Page-scoped object URLs are revoked on rerenders. Cached bytes survive
// navigation in CacheStorage, but never get embedded in HTML or sessionStorage.
const createdUrls=new Set();
export function releaseAvatarObjectUrls(){
  for(const url of createdUrls)try{URL.revokeObjectURL(url);}catch{}
  createdUrls.clear();
}
export async function hydrateLeaderboardAvatars(container,owner,{cacheStorage=fallbackStorage()}={}){
  if(!owner||!container||!cacheStorage)return;
  const nodes=[...container.querySelectorAll(".leader-avatar[data-avatar-key]")];
  await Promise.all(nodes.map(async node=>{
    const key=node.dataset.avatarKey;if(!KEY_PATTERN.test(key))return;
    const blob=await readCachedAvatar(owner,key,{cacheStorage});
    if(!blob||!node.isConnected||!container.contains(node))return;
    let url;
    try{url=URL.createObjectURL(blob);}catch{return;}
    createdUrls.add(url);
    let img=node.querySelector("img");
    if(!img){img=document.createElement("img");img.alt="";img.decoding="async";node.append(img);}
    img.loading="eager";
    img.onerror=()=>{img.remove();URL.revokeObjectURL(url);createdUrls.delete(url);};
    img.src=url;
  }));
}
