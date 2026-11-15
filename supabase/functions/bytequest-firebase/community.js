import {profileDetails} from './domain/profile-fields.js';
import {HttpError} from './handler.js';
const actions=new Set(['problem-authors','chat-list','chat-thread','chat-send','chat-read','live-events-poll','submission-list','submission-read','submission-history','friend-analytics','leaderboard','presence','profile-presence','friend-presence','self','profile-save','search','profile','follow','followers','following','notifications','notifications-read','roles','role-set']);
export const communityActions=actions;
export function validateCommunity(action,body){
 const data={};
 if(['chat-thread','chat-send','chat-read'].includes(action)){
  if(typeof body.target!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(body.target))throw new HttpError(400,'Choose a friend.');data.target=body.target.toLowerCase();
  for(const key of ['after','before','through'])if(body[key]!==undefined){if(!Number.isSafeInteger(body[key])||body[key]<0)throw new HttpError(400,'Invalid conversation cursor.');data[key]=body[key];}
  if(action==='chat-send'){if(typeof body.body!=='string'||!body.body.trim()||body.body.length>2000||typeof body.nonce!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.nonce))throw new HttpError(400,'Write a message under 2,000 characters.');data.body=body.body.trim();data.nonce=body.nonce;}
 }
 if(action==='problem-authors'){if(typeof body.problemId!=='string'||!/^[a-z][a-z0-9-]{1,63}$/.test(body.problemId))throw new HttpError(400,'Choose a valid problem.');data.problemId=body.problemId;}
 if(action==='live-events-poll'){if(body.after!==null&&body.after!==undefined&&(!Number.isSafeInteger(body.after)||body.after<0))throw new HttpError(400,'Invalid event cursor.');data.after=body.after??null;if(body.announcementsAfter!=null&&(!Number.isSafeInteger(body.announcementsAfter)||body.announcementsAfter<0))throw new HttpError(400,'Invalid update cursor.');data.announcementsAfter=body.announcementsAfter??null;}
 if(['submission-list','submission-history'].includes(action)){
  if(typeof body.problemId!=='string'||!/^[a-z][a-z0-9-]{1,63}$/.test(body.problemId))throw new HttpError(400,'Choose a problem.');data.problemId=body.problemId;
  if(action==='submission-list'){if(!['all','java','python','c','cpp'].includes(body.language??'all')||!['runtime','memory'].includes(body.sort??'runtime')||!Number.isSafeInteger(body.page??0)||(body.page??0)<0||(body.page??0)>1000000)throw new HttpError(400,'Choose a valid submission filter.');Object.assign(data,{language:body.language??'all',sort:body.sort??'runtime',page:body.page??0});}
 }
 if(action==='submission-read'){if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id))throw new HttpError(400,'Choose a valid submission.');data.id=body.id.toLowerCase();}

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
  try{Object.assign(data,profileDetails(body));}catch(e){throw new HttpError(400,e.message);}
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
