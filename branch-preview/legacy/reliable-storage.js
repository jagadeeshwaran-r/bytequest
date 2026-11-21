// Never overwrite an unreadable progress record. Use a separate recovery slot
// so a malformed JSON value or an incompatible backup remains recoverable.
export function readSafeProgress(storage,key,validate,blank){
  const recoveryKey=key+'.recovery';
  try{
    const recovery=storage.getItem(recoveryKey);
    if(recovery!==null){
      try{return {state:validate(JSON.parse(recovery)),saveKey:recoveryKey,warning:'The original damaged progress record is preserved.'};}
      catch{return {state:blank(),saveKey:null,warning:'The recovery record is unreadable. Neither copy will be overwritten.'};}
    }
    const raw=storage.getItem(key);
    if(raw===null)return {state:blank(),saveKey:key,warning:null};
    try{return {state:validate(JSON.parse(raw)),saveKey:key,warning:null};}
    catch{
      return {state:blank(),saveKey:recoveryKey,warning:'An unreadable original progress record was preserved. New work will use a separate recovery copy.'};
    }
  }catch{
    return {state:blank(),saveKey:null,warning:'Browser storage could not be read. Export your work before closing this page.'};
  }
}
export function writeSafeProgress(storage,saveKey,state){
  if(!saveKey)throw new Error('Storage is unavailable or the recovery record needs attention.');
  storage.setItem(saveKey,JSON.stringify(state));
}
