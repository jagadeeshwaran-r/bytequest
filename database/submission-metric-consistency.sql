alter table public.bytequest_submissions drop constraint bytequest_submissions_test_count_check;
alter table public.bytequest_submissions add constraint bytequest_submissions_test_count_check check(test_count between 1 and 200);
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
 if data->>'language' not in ('java','python','c','cpp') or metric not in ('runtime','memory') then raise exception 'Choose a valid submission language and ranking' using errcode='22023';end if;
 with eligible as materialized (
  select s.*,p.public_id,p.username,p.display_name,p.avatar_url,p.avatar_path,s.owner_id=bytequest_submissions.owner_id as "isYou",
   row_number() over(partition by s.owner_id order by case when metric='runtime' then s.runtime_ms else s.memory_bytes::double precision end asc nulls last,s.runtime_ms asc nulls last,s.memory_bytes asc nulls last,s.created_at) as best
  from public.bytequest_submissions s join public.bytequest_social_profiles p on p.owner_id=s.owner_id and p.discoverable
  where s.problem_id=q.id and s.problem_revision=q.revision and s.language=data->>'language' and s.benchmark_version in ('bq-v1','bq-private-v1') and s.shared and ((metric='runtime' and s.runtime_ms is not null) or (metric='memory' and s.memory_bytes is not null and s.memory_metric='process_peak_rss'))
 ),ranked as (
  select e.*,rank() over(order by case when metric='runtime' then runtime_ms else memory_bytes::double precision end asc nulls last) as rank from eligible e where best=1
 ) select jsonb_build_object('unlocked',true,'revision',q.revision,'total',(select count(*) from ranked),'users',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'rank',t.rank,'public_id',t.public_id,'username',t.username,'display_name',t.display_name,'avatar_url',t.avatar_url,'avatar_path',t.avatar_path,'isYou',t."isYou",'runtime_ms',t.runtime_ms,'memory_bytes',t.memory_bytes,'memory_metric',t.memory_metric,'language',t.language,'compiler',t.compiler,'time_complexity',t.time_complexity,'space_complexity',t.space_complexity,'suite_kind',t.suite_kind) order by t.rank,t.runtime_ms,t.username) from (select * from ranked order by rank,runtime_ms,username limit 25 offset coalesce((data->>'page')::int,0)*25) t),'[]'::jsonb)) into result;
 return result;
end $$;

