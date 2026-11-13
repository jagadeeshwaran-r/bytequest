import {createClient} from "@supabase/supabase-js";
import {HttpError} from "./handler.js";
export function createDatabase(url,serviceKey,{fetchImpl=fetch}={}){
  // This privileged client exists only in the Edge Function. Never bundle it into dist/.
  const client=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchImpl}});
  const checked=({data,error})=>{if(error)throw new Error("Database request failed");return data;};
  return {
    async touchAccount(identity){checked(await client.rpc("touch_bytequest_firebase_account",{owner_id:identity.id,firebase_project:identity.projectId,firebase_subject:identity.uid,account_email:identity.email}));},
    async progress(owner){return checked(await client.from("bytequest_firebase_progress").select("payload,revision").eq("user_id",owner).maybeSingle());},
    async isEditor(owner){return !!checked(await client.from("bytequest_firebase_editors").select("user_id").eq("user_id",owner).maybeSingle());},
    async sync(owner,payload,revision){const rows=checked(await client.rpc("sync_bytequest_firebase_progress",{owner_id:owner,new_payload:payload,expected_revision:revision}));if(!rows?.[0])throw new Error("Missing progress result");return rows[0];},
    async problems(){return checked(await client.from("bytequest_problems").select("*").order("position").order("id").limit(1000));},
    async saveProblem(problem,{published,position,revision}){
      const row={id:problem.id,content:problem,published,position,revision:revision+1,updated_at:new Date().toISOString()};
      const query=revision?client.from("bytequest_problems").update(row).eq("id",problem.id).eq("revision",revision).select("id,revision"):client.from("bytequest_problems").insert(row).select("id,revision");
      const {data,error}=await query;
      if(error?.code==="23505")throw new HttpError(409,"This problem ID already exists. Choose a new ID or reload the existing problem.");
      if(error)throw new Error("Database request failed");
      if(!data?.length)throw new HttpError(409,"This problem changed in another window. Reload it before saving.");
      return data[0];
    }
  };
}
