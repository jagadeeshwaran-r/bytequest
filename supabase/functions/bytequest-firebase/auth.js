import {jwtVerify,decodeProtectedHeader,importX509} from "jose";
const certificateUrl="https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
export function certificateResolver(fetchImpl=fetch){
  let cache=null,expires=0,lastFetch=0,pending=null;
  return async header=>{
    if(header.alg!=="RS256"||typeof header.kid!=="string"||!header.kid||header.kid.length>200)throw new Error("Invalid token header");
    const now=Date.now();
    if(!cache||now>=expires||(!cache[header.kid]&&now-lastFetch>30000)){
      if(!pending)pending=(async()=>{
        lastFetch=Date.now();
        const response=await fetchImpl(certificateUrl,{signal:AbortSignal.timeout(5000)});
        if(!response.ok)throw new Error("Identity verification temporarily unavailable");
        const certs=await response.json();
        if(!certs||typeof certs!=="object"||Array.isArray(certs))throw new Error("Invalid identity keys");
        cache=certs;
        const maxAge=Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1]||300);
        expires=Date.now()+Math.max(30,Math.min(maxAge,86400))*1000;
      })().finally(()=>{pending=null;});
      await pending;
    }
    const certificate=cache?.[header.kid];
    if(typeof certificate!=="string")throw new Error("Unknown token signing key");
    return importX509(certificate,"RS256");
  };
}
const resolveCertificate=certificateResolver();
export async function verifyFirebaseToken(token,{projectId,keyResolver=resolveCertificate,now=new Date()}={}){
  if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId||""))throw new Error("Firebase project is not configured");
  if(typeof token!=="string"||token.length>16384||token.split(".").length!==3)throw new Error("Invalid identity token");
  const header=decodeProtectedHeader(token);
  if(header.alg!=="RS256"||typeof header.kid!=="string"||!header.kid)throw new Error("Invalid identity token");
  const {payload}=await jwtVerify(token,keyResolver,{
    issuer:"https://securetoken.google.com/"+projectId,audience:projectId,algorithms:["RS256"],
    requiredClaims:["sub","exp","iat","auth_time"],currentDate:now,clockTolerance:5,maxTokenAge:"65m"
  });
  const seconds=Math.floor(now.getTime()/1000);
  if(typeof payload.sub!=="string"||!payload.sub.length||payload.sub.length>128||/[\x00-\x1f\x7f]/.test(payload.sub))throw new Error("Invalid account identity");
  if(!Number.isInteger(payload.iat)||payload.iat>seconds+5||!Number.isInteger(payload.auth_time)||payload.auth_time>seconds+5||payload.auth_time<0)throw new Error("Invalid token time");
  if(payload.firebase?.sign_in_provider!=="google.com"||payload.email_verified!==true||typeof payload.email!=="string"||payload.email.length>320)throw new Error("Sign in with a verified Google account");
  return {id:"firebase:"+projectId+":"+payload.sub,projectId,uid:payload.sub,email:payload.email};
}
