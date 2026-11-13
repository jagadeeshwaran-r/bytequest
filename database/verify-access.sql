-- A rollback-only integration test: no test users or content remain afterward.
begin;
select set_config('bytequest.test_a',gen_random_uuid()::text,true);
select set_config('bytequest.test_b',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
  (current_setting('bytequest.test_a')::uuid,'bytequest-test-a-'||current_setting('bytequest.test_a')||'@example.invalid'),
  (current_setting('bytequest.test_b')::uuid,'bytequest-test-b-'||current_setting('bytequest.test_b')||'@example.invalid');
insert into public.bytequest_admins(user_id) values(current_setting('bytequest.test_a')::uuid);
insert into public.bytequest_problems(id,content,published) values
 ('policy-test-draft','{"id":"policy-test-draft","tests":[]}'::jsonb,false);

set local role anon;
do $$begin
  if exists(select 1 from public.bytequest_problems where id='policy-test-draft') then raise exception 'Anonymous visitor saw draft'; end if;
  begin perform 1 from public.bytequest_progress; raise exception 'Anonymous visitor read private progress';
  exception when insufficient_privilege then null; end;
end;$$;

set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bytequest.test_b'),'role','authenticated')::text,true);
do $$declare result record; begin
  if exists(select 1 from public.bytequest_problems where id='policy-test-draft') then raise exception 'Learner saw editor draft'; end if;
  begin
    insert into public.bytequest_problems(id,content) values('policy-test-forbidden','{"id":"policy-test-forbidden","tests":[]}'::jsonb);
    raise exception 'Learner published content';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.bytequest_admins(user_id) values(current_setting('bytequest.test_b')::uuid);
    raise exception 'Learner promoted self';
  exception when insufficient_privilege then null; end;
  select * into result from public.sync_bytequest_progress('{"version":1,"notes":{"two-sum":"private"}}'::jsonb,0);
  if not result.applied or result.revision<>1 then raise exception 'Own progress did not sync'; end if;
  select * into result from public.sync_bytequest_progress('{"version":1}'::jsonb,0);
  if result.applied or result.revision<>1 then raise exception 'Stale write overwrote newer progress'; end if;
  begin
    insert into public.bytequest_progress(user_id) values(current_setting('bytequest.test_a')::uuid);
    raise exception 'Learner wrote another user progress';
  exception when insufficient_privilege then null; end;
  begin
    update public.bytequest_progress set user_id=current_setting('bytequest.test_a')::uuid where user_id=(select auth.uid());
    raise exception 'Learner reassigned progress owner';
  exception when insufficient_privilege then null; end;
end;$$;

select set_config('request.jwt.claims',json_build_object('sub',current_setting('bytequest.test_a'),'role','authenticated')::text,true);
do $$begin
  if not exists(select 1 from public.bytequest_problems where id='policy-test-draft') then raise exception 'Editor could not read draft'; end if;
  if exists(select 1 from public.bytequest_progress where user_id=current_setting('bytequest.test_b')::uuid) then raise exception 'Editor saw another user progress through API'; end if;
  update public.bytequest_problems set published=true where id='policy-test-draft';
  if not found then raise exception 'Editor could not publish'; end if;
end;$$;
rollback;
select 'PASS: anonymous isolation, private drafts, private progress, self-promotion denial, editor publishing, and stale-write protection' as verification;
