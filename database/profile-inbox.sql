-- Optional public profile details, solve-derived insights, author credit, and a shared announcement feed.
create table public.bytequest_profile_details (
 owner_id text primary key references public.bytequest_firebase_profiles(user_id) on delete cascade,
 organization_type text not null default '' check(organization_type in ('','company','organization','university')),
 organization_name text not null default '' check(length(organization_name)<=100),
 organization_url text not null default '' check(length(organization_url)<=1000 and (organization_url='' or organization_url~'^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$')),
 linkedin_url text not null default '' check(length(linkedin_url)<=1000 and (linkedin_url='' or linkedin_url~*'^https://(www\.)?linkedin\.com/in/[a-z0-9%_.~-]+/?$')),
 updated_at timestamptz not null default now()
);
alter table public.bytequest_profile_details enable row level security;
revoke all on public.bytequest_profile_details from public,anon,authenticated;
grant select,insert,update,delete on public.bytequest_profile_details to service_role;
create policy private_api_only on public.bytequest_profile_details for all to anon,authenticated using(false) with check(false);

create function public.bytequest_save_profile(owner_id text,data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare result jsonb;begin
 result:=public.bytequest_community(owner_id,'profile-save',data);
 if data ?| array['organization_type','organization_name','organization_url','linkedin_url'] then
  insert into public.bytequest_profile_details(owner_id,organization_type,organization_name,organization_url,linkedin_url)
  values(owner_id,coalesce(data->>'organization_type',''),coalesce(data->>'organization_name',''),coalesce(data->>'organization_url',''),coalesce(data->>'linkedin_url',''))
  on conflict(owner_id) do update set organization_type=excluded.organization_type,organization_name=excluded.organization_name,organization_url=excluded.organization_url,linkedin_url=excluded.linkedin_url,updated_at=now();
 end if;
 return result;
end $$;

create function public.bytequest_profile_insights(viewer_id text,target text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.bytequest_social_profiles;payload jsonb;skills jsonb;languages jsonb;details jsonb;begin
 select * into p from public.bytequest_social_profiles s where (s.public_id::text=target or s.username=lower(target)) and (s.discoverable or s.owner_id=viewer_id);
 if p.owner_id is null then raise exception 'Profile not found' using errcode='P0002';end if;
 select g.payload into payload from public.bytequest_firebase_progress g where g.user_id=p.owner_id;
 with solved as (
  select x.key as id from jsonb_each(case when jsonb_typeof(payload->'solved')='object' then payload->'solved' else '{}'::jsonb end) x
  where case when jsonb_typeof(x.value)='number' then (x.value::text)::numeric>0 and (x.value::text)::numeric<=extract(epoch from now())*1000 else false end
  union select s.problem_id from public.bytequest_submissions s where s.owner_id=p.owner_id and s.created_at<=now()
 ),topics as (
  select q.content->>'topic' as topic,count(*) as solved from solved s join public.bytequest_problems q on q.id=s.id and q.published where coalesce(q.content->>'topic','')<>'' group by q.content->>'topic'
 ) select coalesce(jsonb_agg(jsonb_build_object('name',topic,'solved',solved) order by solved desc,topic),'[]'::jsonb) into skills from topics;
 select coalesce(jsonb_agg(jsonb_build_object('language',t.language,'solved',t.solved) order by t.solved desc,t.language),'[]'::jsonb) into languages from (
  select s.language,count(distinct s.problem_id) as solved from public.bytequest_submissions s join public.bytequest_problems q on q.id=s.problem_id and q.published where s.owner_id=p.owner_id and s.created_at<=now() group by s.language
 ) t;
 select to_jsonb(d)-'owner_id'-'updated_at' into details from public.bytequest_profile_details d where d.owner_id=p.owner_id;
 return jsonb_build_object('details',coalesce(details,'{}'::jsonb),'skills',skills,'languages',languages);
end $$;

create function public.bytequest_problem_credits(viewer_id text,problem text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 if not exists(select 1 from public.bytequest_problems q where q.id=problem and q.published) then raise exception 'Problem not found' using errcode='P0002';end if;
 select jsonb_build_object('hasAuthor',exists(select 1 from public.bytequest_problem_authors a where a.problem_id=problem),'users',coalesce(jsonb_agg(jsonb_build_object('public_id',p.public_id,'username',p.username,'display_name',p.display_name,'avatar_url',p.avatar_url,'avatar_path',p.avatar_path)),'[]'::jsonb)) into result
 from public.bytequest_problem_authors a join public.bytequest_social_profiles p on p.owner_id=a.user_id and (p.discoverable or p.owner_id=viewer_id) where a.problem_id=problem;
 return result;
end $$;

create function public.bytequest_updates(owner_id text,after_id bigint default null,include_history boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;cursor_id bigint;last_read_id bigint;items jsonb:='[]'::jsonb;events jsonb:='[]'::jsonb;unread_count bigint;begin
 if not exists(select 1 from public.bytequest_firebase_profiles f where f.user_id=owner_id) then raise exception 'Account not found' using errcode='28000';end if;
 select coalesce((select n.last_read from public.bytequest_notification_reads n where n.user_id=owner_id),0) into last_read_id;
 select count(*) into unread_count from public.bytequest_announcements a join public.bytequest_problems q on q.id=a.problem_id and q.published where a.id>last_read_id;
 if include_history then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id desc),'[]'::jsonb) into items from (select a.* from public.bytequest_announcements a join public.bytequest_problems q on q.id=a.problem_id and q.published order by a.id desc limit 50) t;
 end if;
 if after_id is null then select coalesce(max(a.id),0) into cursor_id from public.bytequest_announcements a;
 else
  with pending as materialized(select a.* from public.bytequest_announcements a where a.id>after_id order by a.id limit 100)
  select coalesce((select max(id) from pending),after_id),coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from pending t join public.bytequest_problems q on q.id=t.problem_id and q.published),'[]'::jsonb) into cursor_id,events;
 end if;
 return jsonb_build_object('cursor',cursor_id,'items',items,'events',events,'unread',unread_count,'lastRead',last_read_id);
end $$;

create function public.bytequest_activity_feed(owner_id text,after_id bigint default null,announcements_after bigint default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare chat jsonb;updates jsonb;begin
 chat:=public.bytequest_live_events_read(owner_id,after_id);updates:=public.bytequest_updates(owner_id,announcements_after,false);
 return chat||jsonb_build_object('announcements',updates->'events','announcementCursor',updates->'cursor','updatesUnread',updates->'unread');
end $$;
revoke all on function public.bytequest_save_profile(text,jsonb),public.bytequest_profile_insights(text,text),public.bytequest_problem_credits(text,text),public.bytequest_updates(text,bigint,boolean),public.bytequest_activity_feed(text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.bytequest_save_profile(text,jsonb),public.bytequest_profile_insights(text,text),public.bytequest_problem_credits(text,text),public.bytequest_updates(text,bigint,boolean),public.bytequest_activity_feed(text,bigint,bigint) to service_role;

create or replace function public.bytequest_submissions(owner_id text,action text,data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare q public.bytequest_problems;s public.bytequest_submissions;author public.bytequest_social_profiles;unlocked boolean;result jsonb;metric text:=coalesce(data->>'sort','runtime');begin
 if action='submission-read' then
  select * into s from public.bytequest_submissions t where t.id::text=data->>'id';
  if s.id is null then raise exception 'Submission not found' using errcode='P0002';end if;
  select * into q from public.bytequest_problems p where p.id=s.problem_id and p.published;
 else select * into q from public.bytequest_problems p where p.id=data->>'problemId' and p.published;end if;
 if q.id is null then raise exception 'Problem not found' using errcode='P0002';end if;
 unlocked:=exists(select 1 from public.bytequest_submissions t where t.owner_id=bytequest_submissions.owner_id and t.problem_id=q.id and t.problem_revision=q.revision);
 if action='submission-read' then
  select * into author from public.bytequest_social_profiles p where p.owner_id=s.owner_id;
  if s.owner_id<>bytequest_submissions.owner_id and (not unlocked or not s.shared or not coalesce(author.discoverable,false) or s.problem_revision<>q.revision) then raise exception 'Submit an accepted solution to unlock shared solutions for this revision' using errcode='42501';end if;
  return jsonb_build_object('submission',to_jsonb(s)-'owner_id'-'client_nonce','author',case when author.owner_id is not null then jsonb_build_object('public_id',author.public_id,'username',author.username,'display_name',author.display_name,'avatar_url',author.avatar_url,'avatar_path',author.avatar_path) else jsonb_build_object('display_name','You') end);
 end if;
 if action='submission-history' then
  return jsonb_build_object('unlocked',unlocked,'users',coalesce((select jsonb_agg(to_jsonb(t)-'owner_id'-'source'-'approach'-'client_nonce' order by t.created_at desc) from (select * from public.bytequest_submissions s where s.owner_id=bytequest_submissions.owner_id and s.problem_id=q.id order by created_at desc limit 25) t),'[]'::jsonb));
 end if;
 if not unlocked then return jsonb_build_object('unlocked',false,'users','[]'::jsonb,'total',0);end if;
 if coalesce(data->>'language','all') not in ('all','java','python','c','cpp') or metric not in ('runtime','memory') then raise exception 'Choose a valid submission language and ranking' using errcode='22023';end if;
 with eligible as materialized (
  select s.*,p.public_id,p.username,p.display_name,p.avatar_url,p.avatar_path,s.owner_id=bytequest_submissions.owner_id as "isYou",
   row_number() over(partition by s.owner_id,s.language order by case when metric='runtime' then s.runtime_ms else s.memory_bytes::double precision end asc nulls last,s.runtime_ms asc nulls last,s.memory_bytes asc nulls last,s.created_at) as best
  from public.bytequest_submissions s join public.bytequest_social_profiles p on p.owner_id=s.owner_id and p.discoverable
  where s.problem_id=q.id and s.problem_revision=q.revision and (coalesce(data->>'language','all')='all' or s.language=data->>'language') and s.benchmark_version in ('bq-v1','bq-private-v1') and s.shared and ((metric='runtime' and s.runtime_ms is not null) or (metric='memory' and s.memory_bytes is not null and s.memory_metric='process_peak_rss'))
 ),ranked as (
  select e.*,rank() over(order by case when metric='runtime' then runtime_ms else memory_bytes::double precision end asc nulls last) as rank from eligible e where best=1
 ) select jsonb_build_object('unlocked',true,'revision',q.revision,'language',coalesce(data->>'language','all'),'total',(select count(*) from ranked),'users',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'rank',t.rank,'public_id',t.public_id,'username',t.username,'display_name',t.display_name,'avatar_url',t.avatar_url,'avatar_path',t.avatar_path,'isYou',t."isYou",'runtime_ms',t.runtime_ms,'memory_bytes',t.memory_bytes,'memory_metric',t.memory_metric,'language',t.language,'compiler',t.compiler,'time_complexity',t.time_complexity,'space_complexity',t.space_complexity,'suite_kind',t.suite_kind) order by t.rank,t.runtime_ms,t.username) from (select * from ranked order by rank,runtime_ms,username limit 25 offset coalesce((data->>'page')::int,0)*25) t),'[]'::jsonb)) into result;
 return result;
end $$;

