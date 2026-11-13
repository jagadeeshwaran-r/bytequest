import {makeOnlineJudge} from './online-judge.js';
import {makePrivateJudge} from "./private-judge.js";
import {verifyFirebaseToken} from "./auth.js";
import {createHandler} from "./handler.js";
import {createDatabase} from "./database.js";
const projectId="bytequest-7b841";
const db=createDatabase(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
Deno.serve(createHandler({
  projectId,db,onlineJudge:makeOnlineJudge(),privateJudge:makePrivateJudge({url:Deno.env.get("BYTEQUEST_JUDGE0_URL"),apiKey:Deno.env.get("BYTEQUEST_JUDGE0_KEY")||"",languageId:Number(Deno.env.get("BYTEQUEST_JAVA_LANGUAGE_ID"))}),
  allowedOrigins:["https://jagadeeshwaran-r.github.io","https://bytequest-java-lab-c409851b.mossylyric512.chatgpt.site"],
  verifyToken:token=>verifyFirebaseToken(token,{projectId})
}));
