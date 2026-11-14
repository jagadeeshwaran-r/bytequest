-- Run through the service SQL tool. All fixture writes are rolled back.
begin;
insert into public.bytequest_firebase_profiles(user_id,project_id,firebase_uid,email)
 select 'firebase:fixture:leader-'||n,'fixture','leader-'||n,'leader-'||n||'@example.invalid' from generate_series(1,32) n;
insert into public.bytequest_social_profiles(owner_id,username,display_name,discoverable)
 select 'firebase:fixture:leader-'||n,'zz_lb_fixture_'||lpad(n::text,2,'0'),'Leaderboard fixture '||n,n<>4 from generate_series(1,32) n;
insert into public.bytequest_follows(follower,following)
 select me.public_id,p.public_id from public.bytequest_social_profiles me join public.bytequest_social_profiles p
 on p.owner_id in ('firebase:fixture:leader-2','firebase:fixture:leader-3','firebase:fixture:leader-4') where me.owner_id='firebase:fixture:leader-1';
insert into public.bytequest_problems(id,content,published,position)
 select 'zz-leader-draft',jsonb_set(content,'{id}','"zz-leader-draft"'::jsonb),false,999999 from public.bytequest_problems where id='two-sum';
insert into public.bytequest_firebase_progress(user_id,payload)
 select 'firebase:fixture:leader-1',jsonb_build_object('version',1,'solved',jsonb_build_object(
 'two-sum',extract(epoch from now())*1000-1000,
 'binary-search',extract(epoch from (date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'))*1000-1,
 'max-subarray',extract(epoch from (date_trunc('week',now() at time zone 'UTC') at time zone 'UTC'))*1000-1,
 'valid-anagram',extract(epoch from now())*1000+86400000,
 'move-zeroes','not a timestamp','nonexistent-problem',1,'zz-leader-draft',1));
insert into public.bytequest_firebase_progress(user_id,payload)
 select 'firebase:fixture:leader-2',jsonb_build_object('version',1,'solved',jsonb_build_object('two-sum',extract(epoch from now())*1000-1000,'binary-search',1));
insert into public.bytequest_firebase_progress(user_id,payload)
 select 'firebase:fixture:leader-3',jsonb_build_object('version',1,'solved',jsonb_build_object('two-sum',extract(epoch from now())*1000-1000,'contains-duplicate',extract(epoch from now())*1000-1000));
do $$ declare r jsonb;other_page jsonb;tie_rank bigint;month_expected integer;begin
 r:=public.bytequest_leaderboard('firebase:fixture:leader-1','friends','all',0);
 if (r->>'total')::int<>3 or (r->'me'->>'solved')::int<>3 or (r->'me'->>'rank')::int<>1 then raise exception 'Friends scope, self rank or published first solves failed';end if;
 if not (r->'me'->>'isYou')::boolean or (r->'me'->>'easy')::int<>2 or (r->'me'->>'medium')::int<>1 then raise exception 'Difficulty or self marker failed';end if;
 select (u->>'rank')::bigint into tie_rank from jsonb_array_elements(r->'users') u where u->>'username'='zz_lb_fixture_02';
 if tie_rank<>2 or not exists(select 1 from jsonb_array_elements(r->'users') u where u->>'username'='zz_lb_fixture_03' and (u->>'rank')::int=2) then raise exception 'Equal solve counts must share rank';end if;
 if r::text like '%owner_id%' or r::text like '%email%' or r::text like '%firebase:fixture:%' then raise exception 'Private fields leaked';end if;
 r:=public.bytequest_leaderboard('firebase:fixture:leader-1','friends','week',0);
 if (r->'me'->>'solved')::int<>1 then raise exception 'UTC week window failed';end if;
 month_expected:=1+case when date_trunc('week',now() at time zone 'UTC')-interval '1 millisecond'>=date_trunc('month',now() at time zone 'UTC') then 1 else 0 end;
 r:=public.bytequest_leaderboard('firebase:fixture:leader-1','friends','month',0);
 if (r->'me'->>'solved')::int<>month_expected then raise exception 'UTC month window failed';end if;
 r:=public.bytequest_leaderboard('firebase:fixture:leader-1','global','all',0);other_page:=public.bytequest_leaderboard('firebase:fixture:leader-1','global','all',1);
 if jsonb_array_length(r->'users')<>25 or jsonb_array_length(other_page->'users')<6 then raise exception 'Pagination failed';end if;
 if exists(select 1 from jsonb_array_elements(r->'users') a join jsonb_array_elements(other_page->'users') b on a->>'public_id'=b->>'public_id') then raise exception 'Pages overlap';end if;
 if other_page->'me'->>'username'<>'zz_lb_fixture_01' then raise exception 'Own rank must survive pagination';end if;
 if exists(select 1 from jsonb_array_elements(r->'users') u where u->>'username'='zz_lb_fixture_04') or exists(select 1 from jsonb_array_elements(other_page->'users') u where u->>'username'='zz_lb_fixture_04') then raise exception 'Private profile appeared';end if;
 r:=public.bytequest_leaderboard('firebase:fixture:leader-4','friends','all',0);if r->'me'<>'null'::jsonb or r->'users'<>'[]'::jsonb then raise exception 'Private self opted into ranks';end if;
 r:=public.bytequest_leaderboard('no-profile-fixture','friends','all',0);if r->'users'<>'[]'::jsonb or (r->>'hasProfile')::boolean then raise exception 'Missing profile handling failed';end if;
 begin perform public.bytequest_leaderboard('fixture','invalid','all',0);raise exception 'Invalid scope accepted';exception when invalid_parameter_value then null;end;
 if has_function_privilege('anon','public.bytequest_leaderboard(text,text,text,integer)','EXECUTE') or has_function_privilege('authenticated','public.bytequest_leaderboard(text,text,text,integer)','EXECUTE') or not has_function_privilege('service_role','public.bytequest_leaderboard(text,text,text,integer)','EXECUTE') then raise exception 'Service-only grants failed';end if;
end $$;
rollback;
select 'PASS: global/friends, shared ranks, UTC windows, malformed/future/draft exclusion, privacy, own rank, pagination and RPC grants; all fixtures rolled back' as verification;
