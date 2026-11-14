import {HttpError} from './handler.js';
const actions=new Set(['friend-analytics','leaderboard','presence','profile-presence','friend-presence','self','profile-save','search','profile','follow','followers','following','notifications','notifications-read','roles','role-set']);
export const communityActions=actions;
export function validateCommunity(action,body){
 const data={};
 if(action==='friend-analytics'){
  if(!Array.isArray(body.targets)||body.targets.length>100||body.targets.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))throw new HttpError(400,'Choose up to 100 followed profiles.');
  data.targets=[...new Set(body.targets.map(id=>id.toLowerCase()))];
 }
 if(action==='leaderboard'){
  const scope=body.scope??'global',period=body.period??'all',page=body.page??0;
  if(!['global','friends'].includes(scope)||!['all','week','month'].includes(period)||!Number.isSafeInteger(page)||page<0||page>1000000)throw new HttpError(400,'Choose a valid leaderboard, period and page.');
  Object.assign(data,{scope,period,page});
 }
 if(action==='presence'){
  if(typeof body.page!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.page)||typeof body.active!=='boolean'||!Number.isSafeInteger(body.sequence)||body.sequence<1||!Number.isInteger(body.idleForMs)||body.idleForMs<0||body.idleForMs>30000)throw new HttpError(400,'Invalid presence update.');
  Object.assign(data,{page:body.page,active:body.active,sequence:body.sequence,idleForMs:body.idleForMs});
 }

 if(action==='profile-save'){
  if(!/^[a-z][a-z0-9_]{2,23}$/.test(body.username||''))throw new HttpError(400,'Username: 3–24 lowercase letters, numbers or underscores; start with a letter.');
  if(typeof body.display_name!=='string'||!body.display_name.trim()||body.display_name.trim().length>60)throw new HttpError(400,'Add a name under 60 characters.');
  if(typeof body.bio!=='string'||body.bio.length>280||['discoverable','show_presence'].some(key=>body[key]!==undefined&&typeof body[key]!=='boolean'))throw new HttpError(400,'Check your profile settings.');
  if(typeof body.avatar_url!=='string'||body.avatar_url.length>1000)throw new HttpError(400,'Use an HTTPS image URL.');
  if(body.avatar_url){let u;try{u=new URL(body.avatar_url);}catch{}if(!u||u.protocol!=='https:'||u.username||u.password)throw new HttpError(400,'Use an HTTPS image URL.');}
  Object.assign(data,{username:body.username,display_name:body.display_name.trim(),bio:body.bio,avatar_url:body.avatar_url});
  for(const key of ['discoverable','show_presence'])if(typeof body[key]==='boolean')data[key]=body[key];
 }
 if(action==='search'){
  if(typeof body.query!=='string'||body.query.length<2||body.query.length>50||!/^[a-zA-Z0-9_-]+$/.test(body.query))throw new HttpError(400,'Search with at least two username characters, or an exact profile ID.');data.query=body.query.toLowerCase();
 }
 if(['profile-presence','profile','follow','followers','following','role-set'].includes(action)){
  if(typeof body.target!=='string'||body.target.length>50||!/^[a-zA-Z0-9_-]+$/.test(body.target))throw new HttpError(400,'Choose a valid username or profile ID.');data.target=body.target.toLowerCase();
 }
 if(action==='follow'){if(typeof body.following!=='boolean')throw new HttpError(400,'Choose follow or unfollow.');data.following=body.following;}
 if(action==='role-set'){if(typeof body.creator!=='boolean')throw new HttpError(400,'Choose the creator permission.');data.creator=body.creator;}
 if(action==='notifications-read'){if(!Number.isSafeInteger(body.id)||body.id<0)throw new HttpError(400,'Invalid notification.');data.id=body.id;}
 return data;
}
