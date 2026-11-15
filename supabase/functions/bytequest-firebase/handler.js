import {requiresJavaStructures} from './domain/java-structures.js';
import {liveEventResponse} from './live-stream.js';
import {submitSolution} from './submissions.js';
import {avatarBytes} from "./avatar.js";
import {communityActions,validateCommunity} from "./community.js";
import {buildTests} from "./domain/judge.js";
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
export function createHandler({projectId,allowedOrigins,verifyToken,db,privateJudge,onlineJudge,deleteFirebaseAccount,benchmarkJudge}){
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
      if(!["live-events","submission-create","account-delete","account","progress","sync","studio-list","studio-save","hidden-submit","avatar-upload","native-run",...communityActions].includes(action))throw new HttpError(400,"Unknown account action.");
      if(action==="account-delete"){
        if(body.confirmation!=="DELETE")throw new HttpError(400,"Type DELETE to confirm account removal.");
        if(!deleteFirebaseAccount)throw new HttpError(503,"Account deletion is unavailable. Try again later.");
        const status=await db.deletionStatus(identity.id);
        if(!status&&(!Number.isInteger(identity.authTime)||Math.floor(Date.now()/1000)-identity.authTime>300))throw new HttpError(409,"Sign in with Google again before deleting your account.");
        const job=await db.beginDeletion(identity.id);
        if(!job.completed){await db.removeDeletedAvatar(job.avatar_path);await deleteFirebaseAccount(authorization.slice(7));await db.finishDeletion(identity.id);}
        return reply(200,{ok:true,deleted:true});
      }
      // Identity always comes from the verified Firebase token, never from a body field.
      await db.touchAccount(identity);
      if(action==='live-events'){
        if(body.after!==undefined&&body.after!==null&&(!Number.isSafeInteger(body.after)||body.after<0))throw new HttpError(400,'Invalid event cursor.');
        if(body.announcementsAfter!=null&&(!Number.isSafeInteger(body.announcementsAfter)||body.announcementsAfter<0))throw new HttpError(400,'Invalid update cursor.');
        return liveEventResponse({req:new Request(req.url,{method:'POST',headers:req.headers,signal:req.signal,body:JSON.stringify({after:body.after??null,announcementsAfter:body.announcementsAfter??null})}),headers,owner:identity.id,db});
      }
      if(action==='submission-create')return reply(200,await submitSolution({owner:identity.id,body,db,benchmarkJudge,privateJudge}));
      if(action==="avatar-upload"){await db.uploadAvatar(identity.id,avatarBytes(body.image));return reply(200,await db.community(identity.id,"self",{}));}
      if(communityActions.has(action))return reply(200,await db.community(identity.id,action,validateCommunity(action,body)));
      if(action==="native-run"){
        if(!onlineJudge)throw new HttpError(503,"Online compiler unavailable. Your code is saved.");
        if(!['c','cpp','python'].includes(body.language)||typeof body.source!=="string"||body.source.length>60000||typeof body.problemId!=="string"||! /^[a-z][a-z0-9-]{1,63}$/.test(body.problemId))throw new HttpError(400,"Choose a problem, language and source under 60 KB.");
        const row=await db.publicProblem(body.problemId);if(!row)throw new HttpError(404,"Problem not found.");
        if(body.revision!==undefined&&body.revision!==row.revision)throw new HttpError(409,"This problem changed. Reload it before running.");
        if(requiresJavaStructures(row.content))throw new HttpError(400,'Linked-list and tree problems currently support Java only. Select Java 17.');
        const cases=body.cases;if(!Array.isArray(cases)||!cases.length||cases.length>108||JSON.stringify(cases).length>200000)throw new HttpError(400,"Use 1–108 public practice cases under 200 KB.");
        try{buildTests(row.content,cases);}catch{throw new HttpError(400,"Practice cases do not match the function contract.");}
        if(!await db.claimOnlineRun(identity.id))throw new HttpError(429,"Wait 5 seconds between runs. Online compilation allows up to 60 runs per hour.");
        return reply(200,await onlineJudge.run(body.source,row.content,cases,body.language));
      }
      if(action==="hidden-submit"){
        if(!privateJudge?.ready)throw new HttpError(503,"Private Java judging is not connected yet. Use Run for public practice cases. Hidden inputs remain private.");
        if(typeof body.problemId!=="string"||! /^[a-z][a-z0-9-]{1,63}$/.test(body.problemId)||typeof body.source!=="string"||body.source.length>60000)throw new HttpError(400,"Choose a valid problem and Java solution.");
        const row=await db.privateProblem(body.problemId);
        if(!row||!row.hidden?.length)throw new HttpError(404,"No private test suite exists for this published problem.");
        if(body.revision!==row.revision)throw new HttpError(409,"This problem was corrected. Reload it before submitting.");
        if(!await db.claimJudge(identity.id))throw new HttpError(429,"Please wait 30 seconds between private submissions.");
        return reply(200,await privateJudge.run(body.source,row.content,row.hidden));
      }
      if(action==="account"){
        const [progress,admin]=await Promise.all([db.progress(identity.id),db.isEditor(identity.id)]);
        return reply(200,{user:{id:identity.id,email:identity.email},admin,canCreate:true,progress:progress||{payload:blankProgress(),revision:0}});
      }
      if(action==="progress")return reply(200,await db.progress(identity.id)||{payload:blankProgress(),revision:0});
      if(action==="sync"){
        if(!integer(body.revision))throw new HttpError(400,"Invalid progress revision.");
        let payload;try{payload=validateProgress(body.payload);}catch{throw new HttpError(400,"Invalid progress backup.");}
        return reply(200,await db.sync(identity.id,payload,body.revision));
      }
      // Every verified learner can author; only editors can read or change other authors' private suites.
      if(action==="studio-list")return reply(200,{problems:await db.problems(identity.id,await db.isEditor(identity.id))});
      if(typeof body.published!=="boolean"||!integer(body.position,1000000)||!integer(body.revision)||body.revision===Number.MAX_SAFE_INTEGER)throw new HttpError(400,"Invalid problem publishing settings.");
      let problem;try{problem=validateProblem(body.problem);}catch(error){throw new HttpError(400,error.message);}
      let hidden=body.hiddenTests??[];
      if(!Array.isArray(hidden)||hidden.length>100||JSON.stringify(hidden).length>250000)throw new HttpError(400,"Use at most 100 hidden tests under 250 KB.");
      try{buildTests(problem,hidden);}catch{throw new HttpError(400,"Hidden cases do not match the Java contract.");}
      problem.hiddenCount=hidden.length;
      const correction=typeof body.correction==="string"?body.correction.trim():"";
      if(correction.length>1000)throw new HttpError(400,"Keep the correction note under 1,000 characters.");
      return reply(200,{problem:await db.saveProblem(problem,{owner:identity.id,published:body.published,position:body.position,revision:body.revision,hidden,correction})});
    }catch(error){
      if(error instanceof HttpError)return reply(error.status,{error:error.message});
      return reply(503,{error:"Cloud progress is temporarily unavailable. Your local work is kept."});
    }
  };
}
