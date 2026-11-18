import {createClient} from "@supabase/supabase-js";
import {HttpError} from "./handler.js";
export function createDatabase(url,serviceKey,{fetchImpl=fetch}={}){
  // This privileged client exists only in the Edge Function. Never bundle it into dist/.
  const client=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchImpl}});
  const checked=({data,error})=>{if(error)throw new Error("Database request failed");return data;};
  const rpcError=error=>{if(!error)return;if(error.code==="P0001"&&error.message?.startsWith("Please slow"))throw new HttpError(429,error.message);if(error.code==="28000")throw new HttpError(403,"This account was removed. Sign out to finish.");if(error.code==="23505")throw new HttpError(409,"That username or problem ID is already taken.");if(error.code==="42501")throw new HttpError(403,"You do not have access to this action. Friend chat requires mutual follows; shared solutions require an accepted submission. Library changes require author or administrator access.");if(error.code==="P0002")throw new HttpError(404,"Profile not found.");if(error.code==="40001")throw new HttpError(409,"This problem changed. Reload it before saving.");if(error.code==="22023")throw new HttpError(400,error.message);throw new Error("Database request failed");};
  async function enrich(result){const profiles=[result.profile,result.me,result.peer,result.author,...(result.events||[]).map(e=>e.actor),...(result.users||[]),...(result.creators||[])].filter(Boolean);const paths=[...new Set(profiles.map(p=>p.avatar_path).filter(Boolean))];let urls=[];if(paths.length){const signed=await client.storage.from("bytequest-avatars").createSignedUrls(paths,600);urls=signed.data||[];}for(const p of profiles){if(p.avatar_path){p.uploadedAvatar=true;p.avatar_url=urls.find(u=>u.path===p.avatar_path)?.signedUrl||"";}delete p.avatar_path;}return result;}
  return {
    // The only maintenance row is private to the service-role client.
    async maintenance(){
      const {data,error}=await client.from('bytequest_site_maintenance').select('*').eq('key','site').maybeSingle();
      if(error||!data)throw new HttpError(503,'Maintenance configuration unavailable. Deploy database/site-maintenance.sql before the Edge Function.');
      return data;
    },
    async isLibraryAdmin(owner){
      const {data,error}=await client.from('bytequest_library_admins').select('user_id').eq('user_id',owner).maybeSingle();
      if(error)throw new HttpError(503,'Administrator role verification unavailable.');
      return !!data;
    },
    async saveMaintenance(owner,settings){
      if(!await this.isLibraryAdmin(owner))throw new HttpError(403,'Only library administrators can configure site maintenance.');
      // Optimistic concurrency protects against two admins silently overwriting
      // one another, including the safety-critical enabled flag.
      const {data,error}=await client.from('bytequest_site_maintenance').update({
        enabled:settings.enabled,mode:settings.mode,
        starts_at:settings.startsAt,ends_at:settings.endsAt,
        message:settings.message,revision:settings.revision+1,
        updated_at:new Date().toISOString(),updated_by:owner
      }).eq('key','site').eq('revision',settings.revision).select('*').maybeSingle();
      if(error)throw new HttpError(503,'Could not save maintenance settings. Your previous settings remain in effect.');
      if(!data)throw new HttpError(409,'Another administrator updated maintenance. Reload the current settings and try again.');
      return data;
    },
    async liveEvents(owner,after,announcementsAfter=null){const r=await client.rpc('bytequest_activity_feed',{owner_id:owner,after_id:after,announcements_after:announcementsAfter});rpcError(r.error);return enrich(r.data);},
    async existingSubmission(owner,nonce){return checked(await client.from('bytequest_submissions').select('*').eq('owner_id',owner).eq('client_nonce',nonce).maybeSingle());},
    async recordSubmission(owner,data){const r=await client.rpc('bytequest_submission_record',{owner_id:owner,data});rpcError(r.error);return r.data;},
    async deletionStatus(owner){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner)))).map(b=>b.toString(16).padStart(2,'0')).join('');return checked(await client.from('bytequest_account_deletions').select('completed_at').eq('owner_hash',hash).maybeSingle());},
    async beginDeletion(owner){const r=await client.rpc('bytequest_begin_account_deletion',{owner_id:owner});rpcError(r.error);return r.data;},
    async removeDeletedAvatar(path){if(!path)return;const r=await client.storage.from('bytequest-avatars').remove([path]);if(r.error&&String(r.error.statusCode)!=='404')throw new HttpError(503,'Your account data was removed. Retry to finish photo cleanup.');},
    async finishDeletion(owner){const r=await client.rpc('bytequest_finish_account_deletion',{owner_id:owner});rpcError(r.error);},
    async uploadAvatar(owner,bytes){const profile=checked(await client.from("bytequest_social_profiles").select("public_id").eq("owner_id",owner).maybeSingle());if(!profile)throw new HttpError(400,"Save your profile before uploading a photo.");const bucket=await client.storage.getBucket("bytequest-avatars");if(bucket.error){const made=await client.storage.createBucket("bytequest-avatars",{public:false,fileSizeLimit:196608,allowedMimeTypes:["image/jpeg"]});if(made.error&&String(made.error.statusCode)!=="409")throw new Error("Photo storage unavailable");}else if(bucket.data.public)throw new Error("Photo storage must be private");const path=profile.public_id+"/avatar.jpg";const uploaded=await client.storage.from("bytequest-avatars").upload(path,bytes,{contentType:"image/jpeg",cacheControl:"0",upsert:true});if(uploaded.error)throw new Error("Photo upload failed");checked(await client.from("bytequest_social_profiles").update({avatar_path:path,avatar_url:"",updated_at:new Date().toISOString()}).eq("owner_id",owner));},
    async touchAccount(identity){const r=await client.rpc("bytequest_touch_active_account",{owner_id:identity.id,firebase_project:identity.projectId,firebase_subject:identity.uid,account_email:identity.email});rpcError(r.error);},
    async progress(owner){return checked(await client.from("bytequest_firebase_progress").select("payload,revision").eq("user_id",owner).maybeSingle());},
    async isEditor(owner){const [editor,admin]=await Promise.all([client.from("bytequest_firebase_editors").select("user_id").eq("user_id",owner).maybeSingle(),client.from("bytequest_library_admins").select("user_id").eq("user_id",owner).maybeSingle()]);return !!checked(editor)||!!checked(admin);},
    async community(owner,action,data){
      if(action==='creator-search'){const r=await client.rpc('bytequest_creator_search',{owner_id:owner,query_text:data.query});rpcError(r.error);return enrich(r.data);}
      if(action==='role-set'){const r=await client.rpc('bytequest_set_creator',{owner_id:owner,target_ref:data.target,allow_creator:data.creator});rpcError(r.error);return enrich(r.data);}
      if(action==='notifications'){const r=await client.rpc('bytequest_updates',{owner_id:owner,after_id:null,include_history:true});rpcError(r.error);return r.data;}
      if(action==='problem-authors'){const r=await client.rpc('bytequest_problem_credits',{viewer_id:owner,problem:data.problemId});rpcError(r.error);return enrich(r.data);}
      if(action.startsWith('chat-')){const r=await client.rpc('bytequest_chat_view',{owner_id:owner,action,data});rpcError(r.error);return enrich(r.data);}
      if(action==='live-events-poll'){const r=await client.rpc('bytequest_activity_feed',{owner_id:owner,after_id:data.after,announcements_after:data.announcementsAfter});rpcError(r.error);return enrich(r.data);}
      if(action.startsWith('submission-')){const r=await client.rpc('bytequest_submissions',{owner_id:owner,action,data});rpcError(r.error);return enrich(r.data);}
      if(action==="friend-analytics"){const {data:result,error}=await client.rpc("bytequest_friend_analytics",{viewer_id:owner,targets:data.targets});rpcError(error);return enrich(result);}
      if(action==="leaderboard"){const {data:result,error}=await client.rpc("bytequest_leaderboard",{viewer_id:owner,board_scope:data.scope,ranking_period:data.period,page_number:data.page});rpcError(error);return enrich(result);}
      if(action==="presence"){const {error}=await client.rpc("bytequest_update_presence_live",{owner_id:owner,page_id:data.page,new_sequence:data.sequence,is_active:data.active,idle_ms:data.idleForMs});rpcError(error);return{ok:true};}
      if(action==="profile-presence"){const {data:result,error}=await client.rpc("bytequest_read_presence",{viewer_id:owner,target:data.target});rpcError(error);return result;}
      if(action==="friend-presence"){const {data:result,error}=await client.rpc("bytequest_friend_presence",{viewer_id:owner});rpcError(error);return enrich(result);}
      if(action==="profile-save"&&(data.discoverable===undefined||data.show_presence===undefined)){
        const current=checked(await client.from("bytequest_social_profiles").select("discoverable,show_presence").eq("owner_id",owner).maybeSingle());
        data={...data,discoverable:data.discoverable??current?.discoverable??true,show_presence:data.show_presence??current?.show_presence??true};
      }
      const {data:result,error}=action==="profile-save"?await client.rpc("bytequest_save_profile",{owner_id:owner,data}):await client.rpc("bytequest_community",{owner_id:owner,action,data});rpcError(error);
      if(result.profile&&['profile','follow'].includes(action)){const presence=await client.rpc("bytequest_read_presence",{viewer_id:owner,target:result.profile.public_id});rpcError(presence.error);result.presence=presence.data.presence;const ranking=await client.rpc("bytequest_profile_rank",{viewer_id:owner,target:result.profile.public_id});rpcError(ranking.error);result.ranking=ranking.data;result.profile.is_admin=ranking.data.isAdmin;result.stats.solved=ranking.data.solved;result.stats.points=ranking.data.points;const activity=await client.rpc("bytequest_profile_activity",{viewer_id:owner,target:result.profile.public_id});rpcError(activity.error);Object.assign(result.stats,activity.data);}
      if(result.profile&&["self","profile-save"].includes(action))result.profile.is_admin=result.admin===true;
      if(result.profile&&["self","profile-save","profile","follow"].includes(action)){const insights=await client.rpc("bytequest_profile_insights",{viewer_id:owner,target:result.profile.public_id});rpcError(insights.error);result.insights=insights.data;Object.assign(result.profile,insights.data.details);}
      return enrich(result);
    },
    async sync(owner,payload,revision){const rows=checked(await client.rpc("sync_bytequest_firebase_progress",{owner_id:owner,new_payload:payload,expected_revision:revision}));if(!rows?.[0])throw new Error("Missing progress result");return rows[0];},
    // Reference source is never fetched from a public catalog row. The owner
    // comes from a verified Firebase token, not a request parameter.
    async reference(owner,id,revision){
      const row=checked(await client.from("bytequest_problems").select("id,revision,published").eq("id",id).eq("published",true).maybeSingle());
      if(!row)throw new HttpError(404,"Problem not found.");
      if(revision!==row.revision)throw new HttpError(409,"This problem changed. Reload before opening its reference.");
      const [accepted,author,admin]=await Promise.all([
        client.from("bytequest_submissions").select("id").eq("owner_id",owner).eq("problem_id",id).eq("problem_revision",revision).limit(1),
        client.from("bytequest_problem_authors").select("problem_id").eq("user_id",owner).eq("problem_id",id).limit(1),
        client.from("bytequest_library_admins").select("user_id").eq("user_id",owner).limit(1)
      ]);
      if(!checked(accepted).length&&!checked(author).length&&!checked(admin).length)
        throw new HttpError(403,"Submit a server-verified accepted solution to unlock the reference. Browser practice does not unlock it.");
      const secret=checked(await client.from("bytequest_problem_references").select("revision,reference").eq("problem_id",id).maybeSingle());
      if(!secret||secret.revision!==revision)throw new HttpError(503,"The private reference is unavailable for this revision. Try again later.");
      return {reference:secret.reference,revision};
    },
    async publicProblem(id){return checked(await client.from("bytequest_problems").select("content,revision").eq("id",id).eq("published",true).maybeSingle());},
    async claimOnlineRun(owner){return checked(await client.rpc("bytequest_claim_online_run",{owner_id:owner}));},
    async claimJudge(owner){return checked(await client.rpc("bytequest_claim_judge",{owner_id:owner}));},
    async privateProblem(id){const row=checked(await client.from("bytequest_problems").select("content,revision").eq("id",id).eq("published",true).maybeSingle());if(!row)return null;const suite=checked(await client.from("bytequest_problem_private").select("hidden_tests").eq("problem_id",id).maybeSingle());return {...row,hidden:suite?.hidden_tests||[]};},
    async problems(owner,all=false){let ids=null;if(!all){ids=checked(await client.from("bytequest_problem_authors").select("problem_id").eq("user_id",owner).limit(1000)).map(r=>r.problem_id);if(!ids.length)return [];}let q=client.from("bytequest_problems").select("*").order("position").order("id").limit(1000);if(ids)q=q.in("id",ids);const rows=checked(await q);if(!rows.length)return [];const hidden=checked(await client.from("bytequest_problem_private").select("problem_id,hidden_tests").in("problem_id",rows.map(r=>r.id)));const refs=checked(await client.from("bytequest_problem_references").select("problem_id,revision,reference").in("problem_id",rows.map(r=>r.id)));
      return rows.map(r=>({...r,content:{...r.content,reference:refs.find(x=>x.problem_id===r.id&&x.revision===r.revision)?.reference||""},hiddenTests:hidden.find(h=>h.problem_id===r.id)?.hidden_tests||[]}));},
    async saveProblem(problem,{owner,published,position,revision,hidden,correction}){
      const {data,error}=await client.rpc("bytequest_save_problem",{owner_id:owner,problem,hidden_cases:hidden,publish:published,position_number:position,expected_revision:revision,correction});rpcError(error);return data;
    }
  };
}
