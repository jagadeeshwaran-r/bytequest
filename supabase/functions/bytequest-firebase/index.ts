import {makeBenchmarkJudge} from './benchmark.js';
import {makeAccountDeletion} from './account-deletion.js';
import {firebaseConfig} from './domain/firebase-config.js';
import {makeOnlineJudge} from './online-judge.js';
import {makePrivateJudge} from "./private-judge.js";
import {verifyFirebaseToken} from "./auth.js";
import {createHandler} from "./handler.js";
import {createDatabase} from "./database.js";
const projectId="bytequest-7b841";
const db=createDatabase(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
// Hidden suites must stay on a trusted private judge by default.
// Explicitly setting BYTEQUEST_ALLOW_EXTERNAL_HIDDEN_JUDGE=true permits sending
// private cases to Wandbox, a third-party service (save:false). Use only after
// the project owner deliberately accepts that data-disclosure trade-off.
const externalHiddenJudgeOptIn = Deno.env.get('BYTEQUEST_ALLOW_EXTERNAL_HIDDEN_JUDGE') === 'true';
Deno.serve(createHandler({
  projectId,db,allowExternalHiddenJudge:externalHiddenJudgeOptIn,benchmarkJudge:makeBenchmarkJudge(),deleteFirebaseAccount:makeAccountDeletion({apiKey:firebaseConfig.apiKey}),onlineJudge:makeOnlineJudge(),privateJudge:makePrivateJudge({url:Deno.env.get("BYTEQUEST_JUDGE0_URL"),apiKey:Deno.env.get("BYTEQUEST_JUDGE0_KEY")||"",languageId:Number(Deno.env.get("BYTEQUEST_JAVA_LANGUAGE_ID"))}),
  allowedOrigins:["https://jagadeeshwaran-r.github.io","https://bytequest-java-lab-c409851b.mossylyric512.chatgpt.site"],
  verifyToken:token=>verifyFirebaseToken(token,{projectId})
}));
