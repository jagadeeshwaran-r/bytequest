-- SAFE PREPARATION: run BEFORE deploying the new Edge Function or frontend.
-- No public problem rows change here. Existing reference code remains visible
-- until the final redaction migration is applied.
begin;
create table if not exists public.bytequest_problem_references (
  problem_id text primary key references public.bytequest_problems(id) on delete cascade,
  revision bigint not null,
  reference text not null check (length(reference) between 1 and 60000),
  updated_at timestamptz not null default now()
);
alter table public.bytequest_problem_references enable row level security;
revoke all on public.bytequest_problem_references from public,anon,authenticated;
grant select,insert,update,delete on public.bytequest_problem_references to service_role;
drop policy if exists references_service_only on public.bytequest_problem_references;
create policy references_service_only on public.bytequest_problem_references
  for all to service_role using(true) with check(true);
insert into public.bytequest_problem_references(problem_id,revision,reference)
select id,revision,content->>'reference' from public.bytequest_problems
where jsonb_typeof(content->'reference')='string' and length(content->>'reference')>0
on conflict(problem_id) do update set reference=excluded.reference,
 revision=excluded.revision,updated_at=now();
commit;
-- Verify backup: SELECT count(*) FROM public.bytequest_problem_references;
-- Must match SELECT count(*) FROM public.bytequest_problems;
