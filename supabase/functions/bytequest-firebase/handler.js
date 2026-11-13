import {validateProblem} from "./domain/catalog.js";
import {validateProgress,blankProgress} from "./domain/progress.js";
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
async function readBody(req){
  if(!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw new HttpError(415,"Send JSON data.");
  const declared=Number(req.headers.get("content-length"));if(declared>1200000)throw new HttpError(413,"The request is too large.");
  const reader=req.body?.getReader();if(!reader)throw new HttpError(400,"Send a request body.");
  const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1200000){await reader.cancel();throw new HttpError(413,"The request is too large.");}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,"Send valid JSON data.");}
  if(!body||typeof body!=="object"||Array.isArray(body))throw new HttpError(400,"Send a JSON object.");return body;
}
function integer(value,max=Number.MAX_SAFE_INTEGER){return Number.isSafeInteger(value)&&value>=0&&value<=max;}
export function createHandler({projectId,allowedOrigins,verifyToken,db}){
  return async req=>{
    const origin=req.headers.get("origin");
    const headers={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
    if(origin&&allowedOrigins.includes(origin))Object.assign(headers,{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Max-Age":"600"});
    const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers});
    if(origin&&!allowedOrigins.includes(origin))return reply(403,{error:"This website is not allowed."});
    if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
    if(req.method==="GET"&&new URL(req.url).pathname.endsWith("/health"))return reply(200,{provider:"firebase",projectId});
    if(req.method!=="POST")return reply(405,{error:"Use POST for account requests."});
    const authorization=req.headers.get("authorization")||"";
    if(!authorization.startsWith("Bearer "))return reply(401,{error:"Sign in with Google to continue."});
    let identity;try{identity=await verifyToken(authorization.slice(7));}catch{return reply(401,{error:"Your sign-in expired or could not be verified. Please sign in again."});}
    try{
      const body=await readBody(req),action=body.action;
      if(!["account","progress","sync","studio-list","studio-save"].includes(action))throw new HttpError(400,"Unknown account action.");
      // Identity always comes from the verified Firebase token, never from a body field.
      await db.touchAccount(identity);
      if(action==="account"){
        const [progress,admin]=await Promise.all([db.progress(identity.id),db.isEditor(identity.id)]);
        return reply(200,{user:{id:identity.id,email:identity.email},admin,progress:progress||{payload:blankProgress(),revision:0}});
      }
      if(action==="progress")return reply(200,await db.progress(identity.id)||{payload:blankProgress(),revision:0});
      if(action==="sync"){
        if(!integer(body.revision))throw new HttpError(400,"Invalid progress revision.");
        let payload;try{payload=validateProgress(body.payload);}catch{throw new HttpError(400,"Invalid progress backup.");}
        return reply(200,await db.sync(identity.id,payload,body.revision));
      }
      // Recheck the database allowlist for every editor request; profile data cannot grant this role.
      if(!await db.isEditor(identity.id))throw new HttpError(403,"Publishing is reserved for problem-library editors.");
      if(action==="studio-list")return reply(200,{problems:await db.problems()});
      if(typeof body.published!=="boolean"||!integer(body.position,1000000)||!integer(body.revision)||body.revision===Number.MAX_SAFE_INTEGER)throw new HttpError(400,"Invalid problem publishing settings.");
      let problem;try{problem=validateProblem(body.problem);}catch(error){throw new HttpError(400,error.message);}
      return reply(200,{problem:await db.saveProblem(problem,{published:body.published,position:body.position,revision:body.revision})});
    }catch(error){
      if(error instanceof HttpError)return reply(error.status,{error:error.message});
      return reply(503,{error:"Cloud progress is temporarily unavailable. Your local work is kept."});
    }
  };
}
