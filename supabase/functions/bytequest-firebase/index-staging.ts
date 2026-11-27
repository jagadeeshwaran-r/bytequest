// ByteQuest isolated Angular E2E backend. NEVER deploy to the production
// Supabase project. Firebase is used only to validate a Google account token;
// all account data, progress, follows, and submissions live in the separate
// staging PostgreSQL database. Identity Toolkit account deletion is disabled.
import {makeBenchmarkJudge} from './benchmark.js';
import {makeOnlineJudge} from './online-judge.js';
import {makePrivateJudge} from './private-judge.js';
import {verifyFirebaseToken} from './auth.js';
import {createHandler} from './handler.js';
import {createDatabase} from './database.js';

const expectedRef='ainsxwxvfybhwdennsvh';
const projectId='bytequest-7b841';
const endpoint=Deno.env.get('SUPABASE_URL')||'';
if(new URL(endpoint).hostname!==expectedRef+'.supabase.co')
  throw new Error('ByteQuest staging backend MUST NOT run in production Supabase');
const db=createDatabase(endpoint,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');

// Keep private suites off all third-party hosts unless the test project gets
// a dedicated trusted private judge. Do not copy production judge credentials.
Deno.serve(createHandler({
  projectId,
  db,
  benchmarkJudge:makeBenchmarkJudge(),
  onlineJudge:makeOnlineJudge(),
  privateJudge:makePrivateJudge(),
  allowExternalHiddenJudge:false,
  // Intentionally omit deleteFirebaseAccount: staging must NEVER delete
  // identities from the shared production Firebase Authentication project.
  allowedOrigins:['https://bytequest-angular-staging.vercel.app'],
  verifyToken:token=>verifyFirebaseToken(token,{projectId})
}));
