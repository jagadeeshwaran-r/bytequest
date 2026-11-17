export const languageNames={java:'Java',python:'Python',c:'C',cpp:'C++'};
function https(value,label){if(typeof value!=='string'||value.length>1000)throw new Error(label+' must be an HTTPS link under 1,000 characters.');const raw=value.trim();if(!raw)return '';let u;try{u=new URL(raw);}catch{}if(!u||u.protocol!=='https:'||u.username||u.password||/[\u0000-\u001f]/.test(raw))throw new Error(label+' must be a valid HTTPS link.');return u.href;}
export function profileDetails(body){
 const keys=['organization_type','organization_name','organization_url','linkedin_url','github_url'];if(!keys.some(k=>Object.hasOwn(body,k)))return{};
 for(const k of keys)if(typeof (body[k]??'')!=='string')throw new Error('Check your optional profile details.');
 let type=(body.organization_type||'').trim(),name=(body.organization_name||'').trim();if(!['','company','organization','university'].includes(type)||name.length>100)throw new Error('Choose an organization type and a name under 100 characters.');
 const url=name?https(body.organization_url||'','Organization website'):'';if(!name)type='';else if(!type)type='organization';
 let linkedin=https(body.linkedin_url||'','LinkedIn profile');if(linkedin){const u=new URL(linkedin);if(!['linkedin.com','www.linkedin.com'].includes(u.hostname.toLowerCase())||u.port||!/^\/in\/[a-zA-Z0-9%_.~-]+\/?$/.test(u.pathname))throw new Error('Use a LinkedIn profile link such as https://www.linkedin.com/in/your-name/.');u.search='';u.hash='';linkedin=u.href;}
 let github=https(body.github_url||'','GitHub profile');
 if(github){const u=new URL(github);if(!['github.com','www.github.com'].includes(u.hostname.toLowerCase())||u.port||!/^\/[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?\/?$/.test(u.pathname))throw new Error('Use a GitHub profile link such as https://github.com/your-username.');u.hostname='github.com';u.search='';u.hash='';github=u.href;}
 return{organization_type:type,organization_name:name,organization_url:url,linkedin_url:linkedin,github_url:github};
}
