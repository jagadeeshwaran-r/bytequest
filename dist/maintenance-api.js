import {cloudConfig} from './config.js';
import {validPublicConfig} from './public-config.js';

// Only the public status endpoint is read; this contains no Firebase tokens
// or service-role keys and cannot expose disabled administrator drafts.
export async function fetchMaintenanceStatus({fetchImpl=globalThis.fetch,config=cloudConfig,timeoutMs=6000}={}){
  if(!validPublicConfig(config))throw new Error('ByteQuest status endpoint is not configured.');
  const response=await fetchImpl(config.url+'/functions/v1/bytequest-firebase/maintenance',{
    method:'GET',headers:{apikey:config.publishableKey},
    cache:'no-store',signal:AbortSignal.timeout(timeoutMs)
  });
  if(!response.ok)throw new Error('ByteQuest maintenance status temporarily unavailable.');
  const result=await response.json();
  if(typeof result?.active!=='boolean'||typeof result?.upcoming!=='boolean')
    throw new Error('Invalid maintenance status response.');
  return result;
}
