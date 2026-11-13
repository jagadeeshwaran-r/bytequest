import {verifyFirebaseToken} from "./auth.js";
import {createHandler} from "./handler.js";
import {createDatabase} from "./database.js";
const projectId="bytequest-7b841";
const db=createDatabase(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
Deno.serve(createHandler({
  projectId,db,
  allowedOrigins:["https://jagadeeshwaran-r.github.io","https://bytequest-java-lab-c409851b.mossylyric512.chatgpt.site"],
  verifyToken:token=>verifyFirebaseToken(token,{projectId})
}));
