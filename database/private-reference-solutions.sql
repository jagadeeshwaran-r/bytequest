-- SECURITY MIGRATION: run after deploying a frontend that accepts redacted
-- public catalog entries and deploying the matching Edge Function.
-- Transactionally move all reference solutions to a service-role-only table.
-- Public problem content and all problem-history snapshots must not retain code.
begin;

create table if not exists public.bytequest_problem_references (
  problem_id text primary key references public.bytequest_problems(id) on delete cascade,
  revision bigint not null,
  reference text not null check (length(reference) between 1 and 60000),
  updated_at timestamptz not null default now()
);
alter table public.bytequest_problem_references enable row level security;
revoke all on public.bytequest_problem_references from public, anon, authenticated;
grant select, insert, update, delete on public.bytequest_problem_references to service_role;
drop policy if exists references_service_only on public.bytequest_problem_references;
create policy references_service_only on public.bytequest_problem_references
  for all to service_role using (true) with check (true);

-- Backfill BEFORE removing reference from the public row. Do not change problem
-- revisions or the accepted-submission unlock state.
insert into public.bytequest_problem_references(problem_id, revision, reference)
select id, revision, content->>'reference'
from public.bytequest_problems
where jsonb_typeof(content->'reference')='string' and length(content->>'reference')>0
on conflict (problem_id) do update
set reference=excluded.reference, revision=excluded.revision, updated_at=now();

-- Reject partial migrations instead of silently losing a reference solution.
do $$
begin
  if exists(
    select 1 from public.bytequest_problems p
    left join public.bytequest_problem_references r on r.problem_id=p.id
    where r.problem_id is null or r.revision<>p.revision
  ) then
    raise exception 'Reference migration incomplete: missing or stale private reference';
  end if;
end $$;

update public.bytequest_problems
set content=content-'reference'
where content ? 'reference';

-- Keep historical snapshots from leaking solutions if permissions change.
update public.bytequest_problem_history
set content=content-'reference'
where content ? 'reference';

-- Keep future authoring atomic: private reference + public redacted
-- problem + revision + hidden cases and history in one transaction.
create or replace function public.bytequest_save_problem(
 owner_id text, problem jsonb, hidden_cases jsonb, publish boolean,
 position_number integer, expected_revision bigint, correction text
) returns jsonb language plpgsql set search_path to '' as $function$
declare old public.bytequest_problems; next_revision bigint; kind text; elevated boolean;
begin
 if not exists(select 1 from public.bytequest_firebase_profiles f where f.user_id=owner_id)
 then raise exception 'Sign in to create a problem' using errcode='42501';end if;
 if jsonb_typeof(problem)<>'object' or
    jsonb_typeof(problem->'reference')<>'string' or
    length(coalesce(problem->>'reference','')) not between 1 and 60000
 then raise exception 'A private Java reference solution is required' using errcode='22023';end if;
 select exists(select 1 from public.bytequest_firebase_editors e where e.user_id=owner_id) or
        exists(select 1 from public.bytequest_library_admins a where a.user_id=owner_id)
 into elevated;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(problem->>'id',0));
 select * into old from public.bytequest_problems p where p.id=problem->>'id' for update;
 if old.id is not null and not elevated and not exists(
   select 1 from public.bytequest_problem_authors a where a.problem_id=old.id and a.user_id=owner_id
 ) then raise exception 'You can edit only your own problems' using errcode='42501';end if;
 if coalesce(old.revision,0)<>expected_revision
 then raise exception 'Revision conflict' using errcode='40001';end if;
 if old.published and publish and length(trim(correction))=0
 then raise exception 'Describe the correction before publishing' using errcode='22023';end if;
 next_revision=expected_revision+1;
 insert into public.bytequest_problems(id,content,published,position,revision)
 values(problem->>'id',problem-'reference',publish,position_number,next_revision)
 on conflict(id) do update
 set content=excluded.content,published=excluded.published,
 position=excluded.position,revision=excluded.revision,updated_at=now();
 insert into public.bytequest_problem_references(problem_id,revision,reference)
 values(problem->>'id',next_revision,problem->>'reference')
 on conflict(problem_id) do update
 set revision=excluded.revision,reference=excluded.reference,updated_at=now();
 if old.id is null then
   insert into public.bytequest_problem_authors(problem_id,user_id)
   values(problem->>'id',owner_id);
 end if;
 insert into public.bytequest_problem_private(problem_id,hidden_tests)
 values(problem->>'id',hidden_cases)
 on conflict(problem_id) do update set hidden_tests=excluded.hidden_tests;
 insert into public.bytequest_problem_history(problem_id,revision,content,changed_by,correction_note)
 values(problem->>'id',next_revision,problem-'reference',owner_id,correction);
 if publish then
   kind=case when old.published then 'correction' else 'new' end;
   insert into public.bytequest_announcements(problem_id,revision,kind,title,message)
   values(problem->>'id',next_revision,kind,problem->>'title',
     case when kind='new' then 'New problem: '||(problem->>'title') else correction end);
 end if;
 return jsonb_build_object('id',problem->>'id','revision',next_revision);
end $function$;

commit;

-- Read-only verification AFTER deployment:
-- select count(*) from public.bytequest_problems where content ? 'reference'; -- 0
-- select count(*) from public.bytequest_problem_history where content ? 'reference'; -- 0
-- select count(*) from public.bytequest_problem_references; -- equals problems count
