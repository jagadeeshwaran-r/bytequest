-- Accepted submissions are recorded by the verified execution API, never by browser-supplied scores.
create table public.bytequest_submissions (
 id uuid primary key default gen_random_uuid(), owner_id text not null references public.bytequest_firebase_profiles(user_id) on delete cascade,
 problem_id text not null references public.bytequest_problems(id) on delete cascade, problem_revision bigint not null,
 language text not null check(language in ('java','python','c','cpp')), source text not null check(length(source) between 1 and 60000),
 approach text not null default '' check(length(approach)<=5000), time_complexity text not null default '' check(length(time_complexity)<=80), space_complexity text not null default '' check(length(space_complexity)<=80),
 shared boolean not null default false, runtime_ms double precision check(runtime_ms>=0 and runtime_ms<=60000), memory_bytes bigint check(memory_bytes>0 and memory_bytes<2147483648),
 memory_metric text not null default 'process_peak_rss', compiler text not null, benchmark_version text not null, suite_kind text not null check(suite_kind in ('public','private')),
 test_count integer not null check(test_count between 1 and 200), client_nonce uuid not null, created_at timestamptz not null default now(), unique(owner_id,client_nonce)
);
create index bytequest_submissions_owner_problem on public.bytequest_submissions(owner_id,problem_id,problem_revision);
create index bytequest_submissions_ranking on public.bytequest_submissions(problem_id,problem_revision,language,benchmark_version,runtime_ms,memory_bytes) where shared;
alter table public.bytequest_submissions enable row level security;
revoke all on public.bytequest_submissions from public,anon,authenticated;
grant select,insert,update,delete on public.bytequest_submissions to service_role;
create policy private_api_only on public.bytequest_submissions for all to anon,authenticated using(false) with check(false);

create function public.bytequest_submission_record(owner_id text,data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare q public.bytequest_problems;s public.bytequest_submissions;g public.bytequest_firebase_progress;payload jsonb;at_ms numeric:=extract(epoch from clock_timestamp())*1000;today text:=to_char(now() at time zone 'UTC','YYYY-MM-DD');days jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended('submission:'||owner_id,0));
 select * into s from public.bytequest_submissions a where a.owner_id=bytequest_submission_record.owner_id and a.client_nonce=(data->>'nonce')::uuid;
 if found then return to_jsonb(s)-'owner_id'-'source'-'approach';end if;
 select * into q from public.bytequest_problems p where p.id=data->>'problemId' and p.published for share;
 if q.id is null then raise exception 'Problem not found' using errcode='P0002';end if;
 if q.revision<>(data->>'revision')::bigint then raise exception 'This problem changed. Reload it before submitting.' using errcode='40001';end if;
 insert into public.bytequest_submissions(owner_id,problem_id,problem_revision,language,source,approach,time_complexity,space_complexity,shared,runtime_ms,memory_bytes,memory_metric,compiler,benchmark_version,suite_kind,test_count,client_nonce)
 values(owner_id,q.id,q.revision,data->>'language',data->>'source',coalesce(data->>'approach',''),coalesce(data->>'timeComplexity',''),coalesce(data->>'spaceComplexity',''),coalesce((data->>'shared')::boolean,false),(data->>'runtimeMs')::double precision,(data->>'memoryBytes')::bigint,data->>'memoryMetric',data->>'compiler',data->>'benchmarkVersion',data->>'suiteKind',(data->>'testCount')::integer,(data->>'nonce')::uuid) returning * into s;
 select * into g from public.bytequest_firebase_progress p where p.user_id=owner_id for update;
 payload:=coalesce(g.payload,'{"version":1}'::jsonb);
 if not (coalesce(payload->'solved','{}') ? q.id) then payload:=jsonb_set(payload,'{solved}',coalesce(payload->'solved','{}')||jsonb_build_object(q.id,at_ms));end if;
 select coalesce(jsonb_agg(d order by d),'[]') into days from (select distinct d from jsonb_array_elements_text(case when jsonb_typeof(payload->'acceptedDays')='array' then payload->'acceptedDays' else '[]'::jsonb end) d union select today) all_days;
 payload:=jsonb_set(payload,'{acceptedDays}',days);
 insert into public.bytequest_firebase_progress(user_id,payload,revision) values(owner_id,payload,1) on conflict(user_id) do update set payload=excluded.payload,revision=bytequest_firebase_progress.revision+1,updated_at=now();
 return to_jsonb(s)-'owner_id'-'source'-'approach';
end $$;

create function public.bytequest_submissions(owner_id text,action text,data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
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

create function public.bytequest_valid_solve_day(d text) returns date language sql immutable strict security invoker set search_path='' as $$
 select case when d~'^[12][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then case when to_char(make_date(substring(d,1,4)::int,substring(d,6,2)::int,1)+(substring(d,9,2)::int-1),'YYYY-MM-DD')=d then make_date(substring(d,1,4)::int,substring(d,6,2)::int,1)+(substring(d,9,2)::int-1) else null end else null end;
$$;
create function public.bytequest_profile_activity(viewer_id text,target text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.bytequest_social_profiles;payload jsonb;days jsonb;solves jsonb;streak integer:=0;cursor_day date:=(now() at time zone 'UTC')::date;today date:=(now() at time zone 'UTC')::date;begin
 select * into p from public.bytequest_social_profiles s where (s.username=lower(target) or s.public_id::text=target) and (s.discoverable or s.owner_id=viewer_id);
 if p.owner_id is null then raise exception 'Profile not found' using errcode='P0002';end if;
 select g.payload into payload from public.bytequest_firebase_progress g where g.user_id=p.owner_id;
 payload:=coalesce(payload,'{}'::jsonb);
 with first_solves as (
  select x.key as id,(x.value::text)::numeric as at_ms from jsonb_each(case when jsonb_typeof(payload->'solved')='object' then payload->'solved' else '{}'::jsonb end) x
  join public.bytequest_problems q on q.id=x.key and q.published
  where case when jsonb_typeof(x.value)='number' then (x.value::text)::numeric>0 and (x.value::text)::numeric<=extract(epoch from now())*1000 else false end
 ) select coalesce(jsonb_agg(jsonb_build_object('day',to_char(to_timestamp(f.at_ms::double precision/1000) at time zone 'UTC','YYYY-MM-DD'),'topic',q.content->>'topic')),'[]'::jsonb) into solves from first_solves f join public.bytequest_problems q on q.id=f.id;
 with accepted_days as (
  select public.bytequest_valid_solve_day(x#>>'{}') as day from jsonb_array_elements(case when jsonb_typeof(payload->'acceptedDays')='array' then payload->'acceptedDays' else '[]'::jsonb end) x where jsonb_typeof(x)='string'
  union select public.bytequest_valid_solve_day(x->>'day') from jsonb_array_elements(solves) x
  union select (s.created_at at time zone 'UTC')::date from public.bytequest_submissions s join public.bytequest_problems q on q.id=s.problem_id and q.published where s.owner_id=p.owner_id
  union select (to_timestamp((x->>'at')::double precision/1000) at time zone 'UTC')::date from jsonb_array_elements(case when jsonb_typeof(payload->'activity')='array' then payload->'activity' else '[]'::jsonb end) x join public.bytequest_problems q on q.id=x->>'id' and q.published where x->>'type' in ('solved','review') and case when jsonb_typeof(x->'at')='number' then (x->>'at')::numeric>0 and (x->>'at')::numeric<=extract(epoch from now())*1000 else false end
 ) select coalesce(jsonb_agg(to_char(day,'YYYY-MM-DD') order by day),'[]'::jsonb) into days from accepted_days where day is not null and day<=today;
 if not (days ? to_char(cursor_day,'YYYY-MM-DD')) then cursor_day:=cursor_day-1;end if;
 while days ? to_char(cursor_day,'YYYY-MM-DD') loop streak:=streak+1;cursor_day:=cursor_day-1;end loop;
 return jsonb_build_object('days',days,'streak',streak,'serverDay',to_char(today,'YYYY-MM-DD'),'total',(select count(*) from public.bytequest_problems q where q.published),'solves',solves);
end $$;
revoke all on function public.bytequest_submission_record(text,jsonb),public.bytequest_submissions(text,text,jsonb),public.bytequest_valid_solve_day(text),public.bytequest_profile_activity(text,text) from public,anon,authenticated;
grant execute on function public.bytequest_submission_record(text,jsonb),public.bytequest_submissions(text,text,jsonb),public.bytequest_valid_solve_day(text),public.bytequest_profile_activity(text,text) to service_role;
