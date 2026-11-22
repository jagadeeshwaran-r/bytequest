// Browser-safe configuration validation shared with the maintenance preflight.
// Keep this module dependency-free so page navigation never loads auth,
// account, catalog or progress code before checking maintenance.
export function validPublicConfig(config){
  try{
    const url=new URL(config.url);
    if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")return false;
    return /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  }catch{return false;}
}
