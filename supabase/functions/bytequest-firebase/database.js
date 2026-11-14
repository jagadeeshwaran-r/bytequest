import {createClient} from "@supabase/supabase-js";
import {HttpError} from "./handler.js";
export function createDatabase(url,serviceKey,{fetchImpl=fetch}={}){
  // This privileged client exists only in the Edge Function. Never bundle it into dist/.
  const client=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchImpl}});
  const checked=({data,error})=>{if(error)throw new Error("Database request failed");return data;};
  const rpcError=error=>{if(!error)return;if(error.code==="23505")throw new HttpError(409,"That username or problem ID is already taken.");if(error.code==="42501")throw new HttpError(403,"You can edit only your own problems. Library administration requires administrator access.");if(error.code==="P0002")throw new HttpError(404,"Profile not found.");if(error.code==="40001")throw new HttpError(409,"This problem changed. Reload it before saving.");if(error.code==="22023")throw new HttpError(400,error.message);throw new Error("Database request failed");};
  async function enrich(result){const profiles=[result.profile,...(result.users||[]),...(result.creators||[])].filter(Boolean);const paths=[...new Set(profiles.map(p=>p.avatar_path).filter(Boolean))];let urls=[];if(paths.length){const signed=await client.storage.from("bytequest-avatars").createSignedUrls(paths,600);urls=signed.data||[];}for(const p of profiles){if(p.avatar_path){p.uploadedAvatar=true;p.avatar_url=urls.find(u=>u.path===p.avatar_path)?.signedUrl||"";}delete p.avatar_path;}return result;}
  return {
    async uploadAvatar(owner,bytes){const profile=checked(await client.from("bytequest_social_profiles").select("public_id").eq("owner_id",owner).maybeSingle());if(!profile)throw new HttpError(400,"Save your profile before uploading a photo.");const bucket=await client.storage.getBucket("bytequest-avatars");if(bucket.error){const made=await client.storage.createBucket("bytequest-avatars",{public:false,fileSizeLimit:196608,allowedMimeTypes:["image/jpeg"]});if(made.error&&String(made.error.statusCode)!=="409")throw new Error("Photo storage unavailable");}else if(bucket.data.public)throw new Error("Photo storage must be private");const path=profile.public_id+"/avatar.jpg";const uploaded=await client.storage.from("bytequest-avatars").upload(path,bytes,{contentType:"image/jpeg",cacheControl:"0",upsert:true});if(uploaded.error)throw new Error("Photo upload failed");checked(await client.from("bytequest_social_profiles").update({avatar_path:path,avatar_url:"",updated_at:new Date().toISOString()}).eq("owner_id",owner));},
    async touchAccount(identity){checked(await client.rpc("touch_bytequest_firebase_account",{owner_id:identity.id,firebase_project:identity.projectId,firebase_subject:identity.uid,account_email:identity.email}));},
    async progress(owner){return checked(await client.from("bytequest_firebase_progress").select("payload,revision").eq("user_id",owner).maybeSingle());},
    async isEditor(owner){const [editor,admin]=await Promise.all([client.from("bytequest_firebase_editors").select("user_id").eq("user_id",owner).maybeSingle(),client.from("bytequest_library_admins").select("user_id").eq("user_id",owner).maybeSingle()]);return !!checked(editor)||!!checked(admin);},
    async community(owner,action,data){
      if(action==="presence"){const {error}=await client.rpc("bytequest_update_presence",{owner_id:owner,page_id:data.page,new_sequence:data.sequence,is_active:data.active,idle_ms:data.idleForMs});rpcError(error);return{ok:true};}
      if(action==="profile-presence"){const {data:result,error}=await client.rpc("bytequest_read_presence",{viewer_id:owner,target:data.target});rpcError(error);return result;}
      const {data:result,error}=await client.rpc("bytequest_community",{owner_id:owner,action,data});rpcError(error);
      if(result.profile&&['profile','follow'].includes(action)){const presence=await client.rpc("bytequest_read_presence",{viewer_id:owner,target:result.profile.public_id});rpcError(presence.error);result.presence=presence.data.presence;}
      return enrich(result);
    },
    async sync(owner,payload,revision){const rows=checked(await client.rpc("sync_bytequest_firebase_progress",{owner_id:owner,new_payload:payload,expected_revision:revision}));if(!rows?.[0])throw new Error("Missing progress result");return rows[0];},
    async publicProblem(id){return checked(await client.from("bytequest_problems").select("content,revision").eq("id",id).eq("published",true).maybeSingle());},
    async claimOnlineRun(owner){return checked(await client.rpc("bytequest_claim_online_run",{owner_id:owner}));},
    async claimJudge(owner){return checked(await client.rpc("bytequest_claim_judge",{owner_id:owner}));},
    async privateProblem(id){const row=checked(await client.from("bytequest_problems").select("content,revision").eq("id",id).eq("published",true).maybeSingle());if(!row)return null;const suite=checked(await client.from("bytequest_problem_private").select("hidden_tests").eq("problem_id",id).maybeSingle());return {...row,hidden:suite?.hidden_tests||[]};},
    async problems(owner,all=false){let ids=null;if(!all){ids=checked(await client.from("bytequest_problem_authors").select("problem_id").eq("user_id",owner).limit(1000)).map(r=>r.problem_id);if(!ids.length)return [];}let q=client.from("bytequest_problems").select("*").order("position").order("id").limit(1000);if(ids)q=q.in("id",ids);const rows=checked(await q);if(!rows.length)return [];const hidden=checked(await client.from("bytequest_problem_private").select("problem_id,hidden_tests").in("problem_id",rows.map(r=>r.id)));return rows.map(r=>({...r,hiddenTests:hidden.find(h=>h.problem_id===r.id)?.hidden_tests||[]}));},
    async saveProblem(problem,{owner,published,position,revision,hidden,correction}){
      const {data,error}=await client.rpc("bytequest_save_problem",{owner_id:owner,problem,hidden_cases:hidden,publish:published,position_number:position,expected_revision:revision,correction});rpcError(error);return data;
    }
  };
}
