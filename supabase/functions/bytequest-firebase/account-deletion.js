import {HttpError} from './handler.js';
export function makeAccountDeletion({apiKey,fetchImpl=fetch}){
 return async token=>{
  let response;try{response=await fetchImpl('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(15000)});}catch{throw new HttpError(503,'Your ByteQuest data was removed. Retry to finish account removal.');}
  if(response.ok)return;let reason;try{reason=(await response.json()).error?.message;}catch{}
  if(reason==='USER_NOT_FOUND')return;
  throw new HttpError(503,'Your ByteQuest data was removed. Retry to finish Google sign-in cleanup.');
 };
}
