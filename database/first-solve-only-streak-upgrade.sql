-- Run once in the ByteQuest Supabase SQL editor after merging the first-solve streak update.
-- This is an in-place function upgrade: no user records are overwritten or deleted.
-- Re-running is safe: both functions use CREATE OR REPLACE.
begin;

CREATE OR REPLACE FUNCTION public.bytequest_submission_record(owner_id text,data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare q public.bytequest_problems;s public.bytequest_submissions;g public.bytequest_firebase_progress;payload jsonb;at_ms numeric:=extract(epoch from clock_timestamp())*1000;first_at numeric;credited_day text;days jsonb;begin
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
 -- Repeat submissions are saved without crediting another streak day.
 -- If a synced first solve was lost, recover the earliest verified submission.
 if not (coalesce(payload->'solved','{}') ? q.id) then
  select min(extract(epoch from t.created_at)*1000) into first_at
  from public.bytequest_submissions t where t.owner_id=bytequest_submission_record.owner_id and t.problem_id=q.id;
  first_at:=coalesce(first_at,at_ms);
  payload:=jsonb_set(payload,'{solved}',coalesce(payload->'solved','{}')||jsonb_build_object(q.id,first_at));
  credited_day:=to_char(to_timestamp(first_at::double precision/1000) at time zone 'UTC','YYYY-MM-DD');
  select coalesce(jsonb_agg(d order by d),'[]') into days from
   (select distinct d from jsonb_array_elements_text(case when jsonb_typeof(payload->'acceptedDays')='array' then payload->'acceptedDays' else '[]'::jsonb end) d
    union select credited_day) first_days;
  payload:=jsonb_set(payload,'{acceptedDays}',days);
 end if;
 insert into public.bytequest_firebase_progress(user_id,payload,revision) values(owner_id,payload,1) on conflict(user_id) do update set payload=excluded.payload,revision=bytequest_firebase_progress.revision+1,updated_at=now();
 return to_jsonb(s)-'owner_id'-'source'-'approach';
end $$;

CREATE OR REPLACE FUNCTION public.bytequest_profile_activity(viewer_id text, target text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.bytequest_social_profiles;payload jsonb;days jsonb;solves jsonb;streak integer:=0;cursor_day date:=(now() at time zone 'UTC')::date;today date:=(now() at time zone 'UTC')::date;correction_base integer;correction_anchor date;correction_cursor date;corrected boolean:=false;begin
 select * into p from public.bytequest_social_profiles s where (s.username=lower(target) or s.public_id::text=target) and (s.discoverable or s.owner_id=viewer_id);
 if p.owner_id is null then raise exception 'Profile not found' using errcode='P0002';end if;
 select g.payload into payload from public.bytequest_firebase_progress g where g.user_id=p.owner_id;
 payload:=coalesce(payload,'{}'::jsonb);
 -- The first accepted solve for each distinct published problem earns one day.
 -- Keep the earliest known browser progress or verified server acceptance.
 -- Repeat submissions, review events and legacy acceptedDays do not qualify.
 with earliest as (
  select x.key as id,(x.value::text)::numeric as at_ms from jsonb_each(case when jsonb_typeof(payload->'solved')='object' then payload->'solved' else '{}'::jsonb end) x
  join public.bytequest_problems q on q.id=x.key and q.published
  where case when jsonb_typeof(x.value)='number' then (x.value::text)::numeric>0 and (x.value::text)::numeric<=extract(epoch from now())*1000 else false end
  union all
  select s.problem_id as id,extract(epoch from min(s.created_at))*1000 as at_ms
  from public.bytequest_submissions s
  join public.bytequest_problems q on q.id=s.problem_id and q.published
  where s.owner_id=p.owner_id and s.created_at<=now()
  group by s.problem_id
 ),first_solves as (
  select id,min(at_ms) as at_ms from earliest group by id
 ) select coalesce(jsonb_agg(jsonb_build_object('day',to_char(to_timestamp(f.at_ms::double precision/1000) at time zone 'UTC','YYYY-MM-DD'),'topic',q.content->>'topic')),'[]'::jsonb) into solves from first_solves f join public.bytequest_problems q on q.id=f.id;
 with accepted_days as (
  select public.bytequest_valid_solve_day(x->>'day') as day from jsonb_array_elements(solves) x
 ) select coalesce(jsonb_agg(to_char(day,'YYYY-MM-DD') order by day),'[]'::jsonb) into days from accepted_days where day is not null and day<=today;
 if not (days ? to_char(cursor_day,'YYYY-MM-DD')) then cursor_day:=cursor_day-1;end if;
 while days ? to_char(cursor_day,'YYYY-MM-DD') loop streak:=streak+1;cursor_day:=cursor_day-1;end loop;
 -- Administrative correction restores a lost streak baseline, not missing
 -- accepted solves. Calendar days and earned badges remain evidence-backed.
 select c.base_streak,c.anchor_day into correction_base,correction_anchor
 from public.bytequest_streak_corrections c where c.owner_id=p.owner_id;
 if correction_base is not null and correction_anchor<=today then
   correction_cursor:=correction_anchor;
   while correction_cursor<today and days ? to_char(correction_cursor+1,'YYYY-MM-DD') loop
     correction_cursor:=correction_cursor+1;
     correction_base:=correction_base+1;
   end loop;
   -- Standard yesterday grace rule. Expire if the correction loses continuity.
   if correction_cursor>=today-1 and correction_base>streak then
     streak:=correction_base;
     corrected:=true;
   end if;
 end if;
 return jsonb_build_object('streakAdjusted',corrected,'days',days,'streak',streak,'serverDay',to_char(today,'YYYY-MM-DD'),'total',(select count(*) from public.bytequest_problems q where q.published),'solves',solves);
end $function$
;

commit;
