import {createClient} from "@supabase/supabase-js";
import {HttpError} from "./handler.js";
export function createDatabase(url,serviceKey,{fetchImpl=fetch}={}){
  // This privileged client exists only in the Edge Function. Never bundle it into dist/.
  const client=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchImpl}});
  const checked=({data,error})=>{if(error)throw new Error("Database request failed");return data;};
  const rpcError=error=>{if(!error)return;if(error.code==="23505")throw new HttpError(409,"That username or problem ID is already taken.");if(error.code==="42501")throw new HttpError(403,"Library administrator access required.");if(error.code==="P0002")throw new HttpError(404,"Profile not found.");if(error.code==="40001")throw new HttpError(409,"This problem changed. Reload it before saving.");if(error.code==="22023")throw new HttpError(400,error.message);throw new Error("Database request failed");};
  return {
    async touchAccount(identity){checked(await client.rpc("touch_bytequest_firebase_account",{owner_id:identity.id,firebase_project:identity.projectId,firebase_subject:identity.uid,account_email:identity.email}));},
    async progress(owner){return checked(await client.from("bytequest_firebase_progress").select("payload,revision").eq("user_id",owner).maybeSingle());},
    async isEditor(owner){const [editor,admin]=await Promise.all([client.from("bytequest_firebase_editors").select("user_id").eq("user_id",owner).maybeSingle(),client.from("bytequest_library_admins").select("user_id").eq("user_id",owner).maybeSingle()]);return !!checked(editor)||!!checked(admin);},
    async community(owner,action,data){const {data:result,error}=await client.rpc("bytequest_community",{owner_id:owner,action,data});rpcError(error);return result;},
    async sync(owner,payload,revision){const rows=checked(await client.rpc("sync_bytequest_firebase_progress",{owner_id:owner,new_payload:payload,expected_revision:revision}));if(!rows?.[0])throw new Error("Missing progress result");return rows[0];},
    async claimJudge(owner){return checked(await client.rpc("bytequest_claim_judge",{owner_id:owner}));},
    async privateProblem(id){const row=checked(await client.from("bytequest_problems").select("content,revision").eq("id",id).eq("published",true).maybeSingle());if(!row)return null;const suite=checked(await client.from("bytequest_problem_private").select("hidden_tests").eq("problem_id",id).maybeSingle());return {...row,hidden:suite?.hidden_tests||[]};},
    async problems(){const rows=checked(await client.from("bytequest_problems").select("*").order("position").order("id").limit(1000));const hidden=checked(await client.from("bytequest_problem_private").select("problem_id,hidden_tests"));return rows.map(r=>({...r,hiddenTests:hidden.find(h=>h.problem_id===r.id)?.hidden_tests||[]}));},
    async saveProblem(problem,{owner,published,position,revision,hidden,correction}){
      const {data,error}=await client.rpc("bytequest_save_problem",{owner_id:owner,problem,hidden_cases:hidden,publish:published,position_number:position,expected_revision:revision,correction});rpcError(error);return data;
    }
  };
}
