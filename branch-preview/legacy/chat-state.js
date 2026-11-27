import {receivedPresence,presenceOnline} from './presence-model.js?v=social-1';
export function createChatState(now=Date.now){
 let presence=new Map(),receipts=new Map();
 return{reset(){presence.clear();receipts.clear();},apply(signals){
  if(!signals)return;
  if(Array.isArray(signals.presence)){presence=new Map(signals.presence.filter(p=>typeof p.public_id==='string').map(p=>[p.public_id,receivedPresence(p.presence,now())]));}
  for(const r of signals.receipts||[])if(typeof r.public_id==='string'&&Number.isSafeInteger(r.through)&&r.through>=0)receipts.set(r.public_id,Math.max(receipts.get(r.public_id)||0,r.through));
 },online(id){return presenceOnline(presence.get(id),now());},seen(message,peer){return message.read===true||message.isOwn===true&&Number.isSafeInteger(message.id)&&message.id<=(receipts.get(peer)||0);}};
}
