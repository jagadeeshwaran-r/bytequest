-- Private, audited adjustment for historic sync gaps. No fabricated solves.
-- A correction is visible in the profile but does not create acceptedDays,
-- solved timestamps, activity events or streak badges.
begin;
create table if not exists public.bytequest_streak_corrections(
 owner_id text primary key,
 base_streak integer not null check(base_streak between 1 and 3650),
 anchor_day date not null,
 reason text not null check(length(trim(reason))>0),
 created_at timestamptz not null default now()
);
alter table public.bytequest_streak_corrections enable row level security;
revoke all on table public.bytequest_streak_corrections from public,anon,authenticated;
grant select on table public.bytequest_streak_corrections to service_role;
create policy streak_corrections_service_select on public.bytequest_streak_corrections
 for select to service_role using(true);

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
