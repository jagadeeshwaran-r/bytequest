export type OrgType=''|'company'|'organization'|'university';
export interface ProfileEdit{
 username:string;display_name:string;bio:string;avatar_url:string;
 discoverable:boolean;show_presence:boolean;
 organization_type:OrgType;organization_name:string;organization_url:string;
 linkedin_url:string;github_url:string;
}
const https=(value:string,label:string):string=>{
 if(value.length>1000)throw new Error(label+' is too long.');
 const raw=value.trim();
 if(!raw)return '';
 let url:URL;
 try{url=new URL(raw);}catch{throw new Error(label+' must be a valid HTTPS URL.');}
 if(url.protocol!=='https:'||url.username||url.password)
   throw new Error(label+' must be a secure HTTPS URL.');
 return url.href;
};
export function validateProfileEdit(input:ProfileEdit):ProfileEdit{
 const username=input.username.trim().toLowerCase();
 const display_name=input.display_name.trim();
 if(!/^[a-z][a-z0-9_]{2,23}$/.test(username))
   throw new Error('Username must be 3–24 letters, digits or underscores, beginning with a letter.');
 if(!display_name||display_name.length>60)throw new Error('Display name must be under 60 characters.');
 if(input.bio.length>280)throw new Error('Biography exceeds 280 characters.');
 if(input.organization_name.length>100)throw new Error('Organization name exceeds 100 characters.');
 if(!['','company','organization','university'].includes(input.organization_type))
   throw new Error('Choose a valid organization category.');
 const avatar_url=https(input.avatar_url,'Avatar');
 const organization_url=input.organization_name?https(input.organization_url,'Organization website'):'';
 const linkedin_url=https(input.linkedin_url,'LinkedIn');
 const github_url=https(input.github_url,'GitHub');
 if(linkedin_url){
   const u=new URL(linkedin_url);
   if(!['linkedin.com','www.linkedin.com'].includes(u.hostname)||!/^\/in\/[a-zA-Z0-9%_.~-]+\/?$/.test(u.pathname))
     throw new Error('Use a LinkedIn personal profile URL.');
 }
 if(github_url){
   const u=new URL(github_url);
   if(!['github.com','www.github.com'].includes(u.hostname)||!/^\/[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?\/?$/.test(u.pathname))
     throw new Error('Use a GitHub account profile URL.');
 }
 return {...input,username,display_name,avatar_url,
   organization_name:input.organization_name.trim(),organization_url,
   organization_type:input.organization_name
     ?(input.organization_type||'organization'):'',
   linkedin_url,github_url};
}
