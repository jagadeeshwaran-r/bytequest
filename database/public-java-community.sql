-- Separate opt-in public-test results from private/full-suite community rankings.
-- The verified Firebase owner is supplied only by the service-role Edge Function.
-- NEVER publish an existing private accepted submission without an explicit click.
create or replace function public.bytequest_public_submissions(owner_id text, action text, data jsonb)
returns jsonb language plpgsql set search_path to '' as $function$
#variable_conflict use_column
declare
 q public.bytequest_problems;
 attempt public.bytequest_submissions;
 result jsonb;
 metric text:=coalesce(data->>'sort','runtime');
begin
 if action='share' then
  if jsonb_typeof(data->'shared')<>'boolean'
    then raise exception 'Choose whether to share your accepted public solution' using errcode='22023';end if;
  select * into attempt from public.bytequest_submissions s
    where s.id::text=data->>'id' and s.owner_id=bytequest_public_submissions.owner_id
    for update;
  if attempt.id is null then raise exception 'Submission not found' using errcode='P0002';end if;
  select * into q from public.bytequest_problems p
    where p.id=attempt.problem_id and p.published;
  if q.id is null or q.revision<>attempt.problem_revision
    then raise exception 'This problem changed. Re-submit the current revision before sharing.' using errcode='40001';end if;
  if attempt.benchmark_version<>'bq-public-only-v1'
    or attempt.suite_kind<>'public' or attempt.language<>'java'
    then raise exception 'Only accepted public-only Java solutions can join the public-test board.' using errcode='22023';end if;
  update public.bytequest_submissions s set shared=(data->>'shared')::boolean
    where s.id=attempt.id and s.owner_id=bytequest_public_submissions.owner_id;
  return jsonb_build_object('ok',true,'id',attempt.id,'shared',(data->>'shared')::boolean);
 end if;
 if action<>'list' then raise exception 'Choose a valid public submission action' using errcode='22023';end if;
 if metric not in ('runtime','memory') then raise exception 'Choose runtime or peak memory' using errcode='22023';end if;
 select * into q from public.bytequest_problems p
  where p.id=data->>'problemId' and p.published;
 if q.id is null then raise exception 'Problem not found' using errcode='P0002';end if;
 if not exists(select 1 from public.bytequest_submissions s
   where s.owner_id=bytequest_public_submissions.owner_id
     and s.problem_id=q.id and s.problem_revision=q.revision)
 then return jsonb_build_object('unlocked',false,'board','public','users','[]'::jsonb,'total',0);end if;

 with eligible as materialized (
  select s.id,s.owner_id,s.language,s.compiler,s.runtime_ms,s.memory_bytes,s.memory_metric,
    s.time_complexity,s.space_complexity,s.suite_kind,
    p.public_id,p.username,p.display_name,p.avatar_url,p.avatar_path,
    (s.owner_id=bytequest_public_submissions.owner_id) as is_you,
    row_number() over (
      partition by s.owner_id,s.compiler
      order by case when metric='runtime' then s.runtime_ms else s.memory_bytes::double precision end asc nulls last,
        s.runtime_ms asc nulls last,s.created_at asc
    ) as best
  from public.bytequest_submissions s
  join public.bytequest_social_profiles p on p.owner_id=s.owner_id and p.discoverable
  where s.problem_id=q.id and s.problem_revision=q.revision
    and s.language='java' and s.suite_kind='public'
    and s.benchmark_version='bq-public-only-v1'
    and s.shared
    and s.compiler in ('judge0-java-17','openjdk-jdk-21+35')
    and s.test_count=pg_catalog.jsonb_array_length(q.content->'tests')
    and ((metric='runtime' and s.runtime_ms is not null)
      or (metric='memory' and s.memory_bytes is not null and s.memory_metric='process_peak_rss'))
 ), ranked as (
  select e.*,
    rank() over (partition by e.compiler order by
      case when metric='runtime' then e.runtime_ms else e.memory_bytes::double precision end asc nulls last) as rank
  from eligible e where e.best=1
 )
 select jsonb_build_object(
   'unlocked',true,'board','public','revision',q.revision,'total',(select count(*) from ranked),
   'yourRank',(select jsonb_build_object('rank',r.rank,'compiler',r.compiler,
     'peers',(select count(*) from ranked r2 where r2.compiler=r.compiler))
    from ranked r where r.is_you order by r.rank limit 1),
   'users',coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'rank',t.rank,'public_id',t.public_id,'username',t.username,
      'display_name',t.display_name,'avatar_url',t.avatar_url,'avatar_path',t.avatar_path,
      'isYou',t.is_you,'runtime_ms',t.runtime_ms,'memory_bytes',t.memory_bytes,
      'memory_metric',t.memory_metric,'language',t.language,'compiler',t.compiler,
      'time_complexity',t.time_complexity,'space_complexity',t.space_complexity,
      'suite_kind',t.suite_kind
    ) order by t.compiler,t.rank,t.username)
    from (select * from ranked order by compiler,rank,username
      limit 25 offset coalesce((data->>'page')::int,0)*25) t),'[]'::jsonb)
  ) into result;
 return result;
end $function$;

-- The RPC is called ONLY with a verified Firebase owner through the service-role
-- Edge Function. Browser clients cannot forge owner_id to list or share records.
revoke all on function public.bytequest_public_submissions(text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.bytequest_public_submissions(text,text,jsonb) to service_role;
