create table public.bytequest_problem_authors(problem_id text primary key references public.bytequest_problems(id) on delete cascade,user_id text not null references public.bytequest_firebase_profiles(user_id) on delete cascade);
create index bytequest_problem_authors_user on public.bytequest_problem_authors(user_id);
alter table public.bytequest_problem_authors enable row level security;
revoke all on public.bytequest_problem_authors from public,anon,authenticated;
grant select,insert,update,delete on public.bytequest_problem_authors to service_role;
create policy service_api_only on public.bytequest_problem_authors for all to anon,authenticated using(false) with check(false);
create table public.bytequest_online_limits(user_id text primary key references public.bytequest_firebase_profiles(user_id) on delete cascade,last_run timestamptz not null default now(),hour_start timestamptz not null default now(),runs integer not null default 1);
alter table public.bytequest_online_limits enable row level security;
revoke all on public.bytequest_online_limits from public,anon,authenticated;
grant select,insert,update,delete on public.bytequest_online_limits to service_role;
create policy service_api_only on public.bytequest_online_limits for all to anon,authenticated using(false) with check(false);
create function public.bytequest_claim_online_run(owner_id text) returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;begin
 insert into public.bytequest_online_limits(user_id) values(owner_id) on conflict(user_id) do update set last_run=now(),hour_start=case when bytequest_online_limits.hour_start<now()-interval '1 hour' then now() else bytequest_online_limits.hour_start end,runs=case when bytequest_online_limits.hour_start<now()-interval '1 hour' then 1 else bytequest_online_limits.runs+1 end where bytequest_online_limits.last_run<now()-interval '5 seconds' and (bytequest_online_limits.hour_start<now()-interval '1 hour' or bytequest_online_limits.runs<60);
 get diagnostics changed=row_count;return changed=1;
end $$;
revoke all on function public.bytequest_claim_online_run(text) from public,anon,authenticated;
grant execute on function public.bytequest_claim_online_run(text) to service_role;
CREATE OR REPLACE FUNCTION public.bytequest_save_problem(owner_id text, problem jsonb, hidden_cases jsonb, publish boolean, position_number integer, expected_revision bigint, correction text)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $function$
declare old public.bytequest_problems; next_revision bigint; kind text; elevated boolean; begin
 if not exists(select 1 from public.bytequest_firebase_profiles f where f.user_id=owner_id) then raise exception 'Sign in to create a problem' using errcode='42501';end if;
 select exists(select 1 from public.bytequest_firebase_editors e where e.user_id=owner_id) or exists(select 1 from public.bytequest_library_admins a where a.user_id=owner_id) into elevated;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(problem->>'id',0));
 select * into old from public.bytequest_problems p where p.id=problem->>'id' for update;
 if old.id is not null and not elevated and not exists(select 1 from public.bytequest_problem_authors a where a.problem_id=old.id and a.user_id=owner_id) then raise exception 'You can edit only your own problems' using errcode='42501';end if;
 if coalesce(old.revision,0)<>expected_revision then raise exception 'Revision conflict' using errcode='40001';end if;
 if old.published and publish and length(trim(correction))=0 then raise exception 'Describe the correction before publishing' using errcode='22023';end if;
 next_revision=expected_revision+1;
 insert into public.bytequest_problems(id,content,published,position,revision) values(problem->>'id',problem,publish,position_number,next_revision)
 on conflict(id) do update set content=excluded.content,published=excluded.published,position=excluded.position,revision=excluded.revision,updated_at=now();
 if old.id is null then insert into public.bytequest_problem_authors(problem_id,user_id) values(problem->>'id',owner_id);end if;
 insert into public.bytequest_problem_private(problem_id,hidden_tests) values(problem->>'id',hidden_cases) on conflict(problem_id) do update set hidden_tests=excluded.hidden_tests;
 insert into public.bytequest_problem_history(problem_id,revision,content,changed_by,correction_note) values(problem->>'id',next_revision,problem,owner_id,correction);
 if publish then
  kind=case when old.published then 'correction' else 'new' end;
  insert into public.bytequest_announcements(problem_id,revision,kind,title,message) values(problem->>'id',next_revision,kind,problem->>'title',case when kind='new' then 'New problem: '||(problem->>'title') else correction end);
 end if;
 return jsonb_build_object('id',problem->>'id','revision',next_revision);
end $function$;
