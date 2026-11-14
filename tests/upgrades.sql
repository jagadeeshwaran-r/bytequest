-- Operator validation. Disposable fixture data only; every write is rolled back.
begin;
insert into public.bytequest_firebase_profiles(user_id,project_id,firebase_uid,email)
 select 'firebase:fixture:upgrade-'||n,'fixture','upgrade-'||n,'upgrade-'||n||'@example.invalid' from generate_series(1,4) n;
insert into public.bytequest_social_profiles(owner_id,username,display_name,discoverable,avatar_path)
 select 'firebase:fixture:upgrade-'||n,'zz_up_fixture_'||n,'Upgrade fixture '||n,n<>3,case when n=1 then '11111111-1111-4111-8111-111111111111/avatar.jpg' else '' end from generate_series(1,4) n;
insert into public.bytequest_problems(id,content,published,position)
 select 'zz-upgrade-hard',jsonb_set(jsonb_set(content,'{id}','"zz-upgrade-hard"'),'{difficulty}','"Hard"'),true,999998 from public.bytequest_problems where id='two-sum';
insert into public.bytequest_problems(id,content,published,position)
 select 'zz-upgrade-draft',jsonb_set(content,'{id}','"zz-upgrade-draft"'),false,999999 from public.bytequest_problems where id='two-sum';
insert into public.bytequest_problem_authors(problem_id,user_id) values ('zz-upgrade-hard','firebase:fixture:upgrade-1'),('zz-upgrade-draft','firebase:fixture:upgrade-1');
insert into public.bytequest_problem_history(problem_id,revision,content,changed_by,correction_note)
 select id,1,content,'firebase:fixture:upgrade-1','Disposable deletion fixture' from public.bytequest_problems where id='zz-upgrade-hard';
insert into public.bytequest_library_admins(user_id) values('firebase:fixture:upgrade-1');
insert into public.bytequest_follows(follower,following)
 select me.public_id,p.public_id from public.bytequest_social_profiles me join public.bytequest_social_profiles p on p.owner_id in ('firebase:fixture:upgrade-2','firebase:fixture:upgrade-3') where me.owner_id='firebase:fixture:upgrade-1';
insert into public.bytequest_firebase_progress(user_id,payload) values
 ('firebase:fixture:upgrade-1',jsonb_build_object('version',1,'solved',jsonb_build_object('zz-upgrade-hard',extract(epoch from now())*1000-1000))),
 ('firebase:fixture:upgrade-2',jsonb_build_object('version',1,'solved',jsonb_build_object('two-sum',1,'binary-search',2,'contains-duplicate',3,'max-subarray','bad timestamp','count-primes',extract(epoch from now())*1000+86400000,'zz-upgrade-draft',1,'unknown-problem',1))),
 ('firebase:fixture:upgrade-3',jsonb_build_object('version',1,'solved',jsonb_build_object('count-primes',1)));
do $$ declare r jsonb;score jsonb;targets jsonb;job jsonb;sig text;begin
 r:=public.bytequest_leaderboard('firebase:fixture:upgrade-1','friends','all',0);
 if (r->'me'->>'points')::int<>50 or (r->'me'->>'solved')::int<>1 or (r->'me'->>'rank')::int<>1 then raise exception 'Hard solve must outrank three easy solves';end if;
 if not exists(select 1 from jsonb_array_elements(r->'users') u where u->>'username'='zz_up_fixture_2' and (u->>'points')::int=30 and (u->>'solved')::int=3) then raise exception 'Published/valid solve scoring failed';end if;
 score:=public.bytequest_profile_rank('firebase:fixture:upgrade-1','zz_up_fixture_1');
 r:=public.bytequest_leaderboard('firebase:fixture:upgrade-1','global','all',0);
 if score->'rank'<>r->'me'->'rank' or (score->>'points')::int<>50 or not (score->>'isAdmin')::boolean then raise exception 'Profile/global rank or admin badge failed';end if;
 score:=public.bytequest_profile_rank('firebase:fixture:upgrade-3','zz_up_fixture_3');
 if score->'rank'<>'null'::jsonb or (score->>'points')::int<>25 then raise exception 'Private own profile must have points but no rank';end if;
 begin perform public.bytequest_profile_rank('firebase:fixture:upgrade-1','zz_up_fixture_3');raise exception 'Private profile was readable';exception when no_data_found then null;end;
 select jsonb_agg(public_id::text) into targets from public.bytequest_social_profiles where owner_id in ('firebase:fixture:upgrade-2','firebase:fixture:upgrade-3','firebase:fixture:upgrade-4');
 r:=public.bytequest_friend_analytics('firebase:fixture:upgrade-1',targets);
 if jsonb_array_length(r->'users')<>1 or jsonb_array_length(r->'users'->0->'solves')<>3 then raise exception 'Friend comparison must filter unfollowed/private/malformed/future/draft data';end if;
 if r::text like '%owner_id%' or r::text like '%email%' or r::text like '%firebase:fixture:%' then raise exception 'Private identity leaked';end if;
 job:=public.bytequest_begin_account_deletion('firebase:fixture:upgrade-1');
 if job->>'avatar_path'<>'11111111-1111-4111-8111-111111111111/avatar.jpg' or (job->>'completed')::boolean then raise exception 'Pending photo cleanup failed';end if;
 if exists(select 1 from public.bytequest_firebase_profiles where user_id='firebase:fixture:upgrade-1') or exists(select 1 from public.bytequest_social_profiles where owner_id='firebase:fixture:upgrade-1') or exists(select 1 from public.bytequest_firebase_progress where user_id='firebase:fixture:upgrade-1') or exists(select 1 from public.bytequest_library_admins where user_id='firebase:fixture:upgrade-1') or exists(select 1 from public.bytequest_problem_authors where user_id='firebase:fixture:upgrade-1') then raise exception 'Removal cascade failed';end if;
 if exists(select 1 from public.bytequest_problems where id='zz-upgrade-draft') or not exists(select 1 from public.bytequest_problems where id='zz-upgrade-hard') or not exists(select 1 from public.bytequest_problem_history where problem_id='zz-upgrade-hard' and changed_by='Deleted account') then raise exception 'Published anonymization/unpublished removal failed';end if;
 if not exists(select 1 from public.bytequest_firebase_progress where user_id='firebase:fixture:upgrade-2') then raise exception 'Another learner was modified';end if;
 begin perform public.bytequest_touch_active_account('firebase:fixture:upgrade-1','fixture','upgrade-1','upgrade-1@example.invalid');raise exception 'Deleted identity was recreated';exception when invalid_authorization_specification then null;end;
 if public.bytequest_begin_account_deletion('firebase:fixture:upgrade-1')<>job then raise exception 'Pending deletion retry is not idempotent';end if;
 perform public.bytequest_finish_account_deletion('firebase:fixture:upgrade-1');job:=public.bytequest_begin_account_deletion('firebase:fixture:upgrade-1');
 if not (job->>'completed')::boolean or job->>'avatar_path'<>'' then raise exception 'Completed deletion retry or photo path cleanup failed';end if;
 foreach sig in array array['bytequest_profile_rank(text,text)','bytequest_friend_analytics(text,jsonb)','bytequest_begin_account_deletion(text)','bytequest_finish_account_deletion(text)','bytequest_touch_active_account(text,text,text,text)'] loop
  if has_function_privilege('anon','public.'||sig,'EXECUTE') or has_function_privilege('authenticated','public.'||sig,'EXECUTE') or not has_function_privilege('service_role','public.'||sig,'EXECUTE') then raise exception 'Service-only RPC grants failed: %',sig;end if;
 end loop;
 if has_table_privilege('anon','public.bytequest_account_deletions','SELECT') or has_table_privilege('authenticated','public.bytequest_account_deletions','SELECT') then raise exception 'Deletion jobs exposed';end if;
end $$;
rollback;
select 'PASS: weighted ranks, profile/admin badges, comparison privacy, deletion cascades, anonymization, idempotence, tombstones and grants; all fixtures rolled back' as verification;
