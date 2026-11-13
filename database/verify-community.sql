begin;
insert into public.bytequest_firebase_profiles(user_id,project_id,firebase_uid,email) values
('firebase:bytequest-fixture:social-a','bytequest-fixture','social-a','fixture-a@example.invalid'),
('firebase:bytequest-fixture:social-b','bytequest-fixture','social-b','fixture-b@example.invalid');
set local role service_role;
select public.bytequest_community('firebase:bytequest-fixture:social-a','profile-save','{"username":"fixture_community_a","display_name":"Fixture A","bio":"","avatar_url":"","discoverable":true}');
select public.bytequest_community('firebase:bytequest-fixture:social-b','profile-save','{"username":"fixture_community_b","display_name":"Fixture B","bio":"","avatar_url":"","discoverable":true}');
select public.bytequest_community('firebase:bytequest-fixture:social-a','search','{"query":"fixture_community"}');
select public.bytequest_community('firebase:bytequest-fixture:social-a','follow','{"target":"fixture_community_b","following":true}');
select public.bytequest_community('firebase:bytequest-fixture:social-b','followers','{"target":"fixture_community_b"}');
select public.bytequest_community('firebase:bytequest-fixture:social-a','notifications');
do $$begin
 begin perform public.bytequest_community('firebase:bytequest-fixture:social-a','role-set','{"target":"fixture_community_b","creator":true}');raise exception 'role escalation allowed';exception when insufficient_privilege then null;end;
 begin perform public.bytequest_save_problem('firebase:bytequest-fixture:social-a','{}','[]',false,0,0,'');raise exception 'unauthorized publish allowed';exception when insufficient_privilege then null;end;
end $$;
select public.bytequest_community('firebase:bytequest-fixture:social-b','profile-save','{"username":"fixture_community_b","display_name":"Fixture B","bio":"","avatar_url":"","discoverable":false}');
do $$begin
 begin perform public.bytequest_community('firebase:bytequest-fixture:social-a','profile','{"target":"fixture_community_b"}');raise exception 'private profile leaked';exception when no_data_found then null;end;
end $$;
set local role anon;
do $$begin
 begin perform * from public.bytequest_problem_private;raise exception 'hidden tests leaked';exception when insufficient_privilege then null;end;
 begin perform public.bytequest_community('firebase:bytequest-fixture:social-a','self');raise exception 'public RPC access allowed';exception when insufficient_privilege then null;end;
end $$;
rollback;
-- Exercise publication, correction, hidden storage, notifications and rate limits
-- with transaction-only fixture identities; never grants a real account access.
begin;
insert into public.bytequest_firebase_profiles(user_id,project_id,firebase_uid,email) values('firebase:bytequest-fixture:publisher','bytequest-fixture','publisher','fixture@example.invalid');
insert into public.bytequest_firebase_editors(user_id) values('firebase:bytequest-fixture:publisher');
set local role service_role;
select public.bytequest_save_problem('firebase:bytequest-fixture:publisher',jsonb_set((select content from public.bytequest_problems where id='two-sum'),'{id}','"fixture-publish-check"'),'[{"args":[[1,2],3],"expected":[0,1]}]',true,99999,0,'');
do $$begin
 if not exists(select 1 from public.bytequest_announcements where problem_id='fixture-publish-check' and kind='new') then raise exception 'New announcement missing';end if;
 if (select jsonb_array_length(hidden_tests) from public.bytequest_problem_private where problem_id='fixture-publish-check')<>1 then raise exception 'Hidden cases missing';end if;
 begin perform public.bytequest_save_problem('firebase:bytequest-fixture:publisher',jsonb_set((select content from public.bytequest_problems where id='two-sum'),'{id}','"fixture-publish-check"'),'[]',true,99999,1,'');raise exception 'Missing correction accepted';exception when invalid_parameter_value then null;end;
 begin perform public.bytequest_save_problem('firebase:bytequest-fixture:publisher',jsonb_set((select content from public.bytequest_problems where id='two-sum'),'{id}','"fixture-publish-check"'),'[]',true,99999,0,'stale');raise exception 'Stale revision overwritten';exception when serialization_failure then null;end;
end $$;
select public.bytequest_save_problem('firebase:bytequest-fixture:publisher',jsonb_set((select content from public.bytequest_problems where id='two-sum'),'{id}','"fixture-publish-check"'),'[]',true,99999,1,'Clarified distinct indices.');
do $$begin
 if not exists(select 1 from public.bytequest_announcements where problem_id='fixture-publish-check' and kind='correction' and revision=2) then raise exception 'Correction announcement missing';end if;
 if not public.bytequest_claim_judge('firebase:bytequest-fixture:publisher') then raise exception 'First submission denied';end if;
 if public.bytequest_claim_judge('firebase:bytequest-fixture:publisher') then raise exception 'Rate limit bypassed';end if;
end $$;
rollback;
