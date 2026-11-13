begin;
insert into public.bytequest_firebase_profiles(user_id,project_id,firebase_uid,email) values('firebase:minimal-fixture:a','minimal-fixture','a','fixture@example.invalid');
set local role service_role;
select public.bytequest_community('firebase:minimal-fixture:a','profile-save','{"username":"minimal_fixture","display_name":"Fixture","bio":"","avatar_url":"","discoverable":true}');
select public.sync_bytequest_firebase_progress('firebase:minimal-fixture:a','{"version":1,"solved":{"two-sum":1767225600000},"drafts":{"two-sum":"PRIVATE_DRAFT"},"notes":{"two-sum":"PRIVATE_NOTE"},"days":["2026-01-01"]}',0);
do $$declare result jsonb;begin
 result=public.bytequest_community('firebase:minimal-fixture:a','profile','{"target":"minimal_fixture"}');
 if result#>>'{stats,solves,0,day}'<>'2026-01-01' then raise exception 'Comparison date wrong';end if;
 if result#>>'{stats,solves,0,topic}'<>'Hash maps' then raise exception 'Topic missing';end if;
 if result::text like '%PRIVATE_%' or result::text like '%fixture@example%' or result::text like '%owner_id%' then raise exception 'Private data leaked';end if;
end $$;
rollback;
