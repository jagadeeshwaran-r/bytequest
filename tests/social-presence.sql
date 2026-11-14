begin;
insert into public.bytequest_firebase_profiles(user_id,project_id,firebase_uid,email)
 select 'firebase:fixture:social-'||n,'fixture','social-'||n,'fixture-'||n||'@example.invalid' from generate_series(1,7) n;
insert into public.bytequest_social_profiles(owner_id,username,display_name,discoverable,show_presence)
 select 'firebase:fixture:social-'||n,'zz_social_fixture_'||n,'Social fixture '||n,n<>4,n<>5 from generate_series(1,6) n;
insert into public.bytequest_social_profiles(owner_id,username,display_name)
 values('firebase:fixture:social-7','zz_social_fixture_7','Default fixture');
insert into public.bytequest_follows(follower,following)
 select me.public_id,p.public_id from public.bytequest_social_profiles me
 join public.bytequest_social_profiles p on p.owner_id in ('firebase:fixture:social-2','firebase:fixture:social-3','firebase:fixture:social-4','firebase:fixture:social-5')
 where me.owner_id='firebase:fixture:social-1';
insert into public.bytequest_presence_sessions(owner_id,page_id,sequence,active,last_active_at)
 select 'firebase:fixture:social-'||n,gen_random_uuid(),1,true,clock_timestamp()-case when n=3 then interval '5 minutes' else interval '2 seconds' end from generate_series(2,6) n;
do $$ declare r jsonb; begin
 r:=public.bytequest_friend_presence('firebase:fixture:social-1');
 if jsonb_array_length(r->'users')<>2 then raise exception 'Privacy/follow filter failed';end if;
 if not exists(select 1 from jsonb_array_elements(r->'users') u where u->>'username'='zz_social_fixture_2' and (u->'presence'->>'online')::boolean) then raise exception 'Active friend missing';end if;
 if not exists(select 1 from jsonb_array_elements(r->'users') u where u->>'username'='zz_social_fixture_3' and not (u->'presence'->>'online')::boolean and u->'presence'->>'lastSeen' is not null) then raise exception 'Offline friend status failed';end if;
 if r::text like '%firebase:fixture:%' or r::text like '%email%' then raise exception 'Private identity leaked';end if;
 if public.bytequest_friend_presence('firebase:fixture:social-6')->'users'<>'[]'::jsonb then raise exception 'Unrelated viewer received friends';end if;
 if not exists(select 1 from public.bytequest_social_profiles where owner_id='firebase:fixture:social-7' and discoverable and show_presence) then raise exception 'New profile defaults failed';end if;
 if has_function_privilege('anon','public.bytequest_friend_presence(text)','EXECUTE') or has_function_privilege('authenticated','public.bytequest_friend_presence(text)','EXECUTE') or not has_function_privilege('service_role','public.bytequest_friend_presence(text)','EXECUTE') then raise exception 'Function grants failed';end if;
end $$;
rollback;
select 'PASS: followed users only, private/hidden status excluded, active/expired status, new defaults and service-only grants; fixtures rolled back' as verification;
