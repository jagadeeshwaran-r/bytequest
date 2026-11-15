-- All records below are fixture-only and rolled back; no real announcements or messages are published.
begin;
do $$
declare a uuid;b uuid;c uuid;result jsonb;r jsonb;problem jsonb;sid text:='fixture-profile-inbox';baseline bigint;before_b bigint;s jsonb;begin
 insert into public.bytequest_firebase_profiles(user_id,project_id,firebase_uid,email) select 'firebase:fixture:profile-'||x,'fixture','profile-'||x,'profile-'||x||'@example.invalid' from unnest(array['a','b','c','d']) x;
 r:=public.bytequest_save_profile('firebase:fixture:profile-a','{"username":"fixture_profile_a","display_name":"Fixture A","bio":"","avatar_url":"","discoverable":true,"show_presence":true,"organization_type":"university","organization_name":"Example University","organization_url":"https://example.edu/","linkedin_url":"https://www.linkedin.com/in/fixture-a/"}');a:=(r->'profile'->>'public_id')::uuid;
 r:=public.bytequest_save_profile('firebase:fixture:profile-b','{"username":"fixture_profile_b","display_name":"Fixture B","bio":"","avatar_url":"","discoverable":true,"show_presence":true}');b:=(r->'profile'->>'public_id')::uuid;
 r:=public.bytequest_save_profile('firebase:fixture:profile-c','{"username":"fixture_profile_c","display_name":"Fixture C","bio":"","avatar_url":"","discoverable":true,"show_presence":true}');c:=(r->'profile'->>'public_id')::uuid;
 r:=public.bytequest_profile_insights('firebase:fixture:profile-b',a::text);assert r->'details'->>'organization_name'='Example University','Optional details visible on discoverable profile';assert not(r->'details'?'owner_id'),'No owner identifier in details';
 begin perform public.bytequest_save_profile('firebase:fixture:profile-a','{"username":"fixture_bad_change","display_name":"Fixture A","bio":"","avatar_url":"","discoverable":true,"show_presence":true,"linkedin_url":"javascript:alert(1)"}');raise exception 'Unsafe URL accepted';exception when check_violation then null;end;
 assert (select username from public.bytequest_social_profiles where public_id=a)='fixture_profile_a','Profile and optional details save atomically';
 baseline:=(public.bytequest_updates('firebase:fixture:profile-a',null,false)->>'cursor')::bigint;before_b:=(public.bytequest_updates('firebase:fixture:profile-b',null,false)->>'unread')::bigint;
 select content into problem from public.bytequest_problems where id='two-sum';problem:=problem||jsonb_build_object('id',sid,'title','Fixture: profile inbox','hiddenCount',0);
 perform public.bytequest_save_problem('firebase:fixture:profile-a',problem,'[]',true,999999,0,'Fixture publish');
 r:=public.bytequest_problem_credits('firebase:fixture:profile-b',sid);assert (r->>'hasAuthor')::boolean and r->'users'->0->>'username'='fixture_profile_a','Original author saved and linked';assert not(r->'users'->0?'owner_id'),'Credits expose only public profile fields';
 begin perform public.bytequest_save_problem('firebase:fixture:profile-b',problem,'[]',true,999999,1,'Unauthorized correction');raise exception 'Another learner changed the author problem';exception when insufficient_privilege then null;end;
 perform public.bytequest_save_problem('firebase:fixture:profile-a',problem,'[]',true,999999,1,'Fixture correction');
 r:=public.bytequest_problem_credits('firebase:fixture:profile-b',sid);assert r->'users'->0->>'username'='fixture_profile_a','Author retained through corrections';
 r:=public.bytequest_activity_feed('firebase:fixture:profile-b',null,baseline);assert jsonb_array_length(r->'announcements')=2,'Every learner receives new problem and correction events';assert (r->>'updatesUnread')::bigint=before_b+2,'Unread announcements count';
 r:=public.bytequest_activity_feed('firebase:fixture:profile-d',null,baseline);assert jsonb_array_length(r->'announcements')=2,'Accounts without a community profile also receive updates';
 perform public.bytequest_community('firebase:fixture:profile-a','notifications-read',jsonb_build_object('id',(r->>'announcementCursor')::bigint));
 assert (public.bytequest_updates('firebase:fixture:profile-a',null,true)->>'unread')::bigint=0,'Independent read cursor';assert (public.bytequest_updates('firebase:fixture:profile-b',null,false)->>'unread')::bigint=before_b+2,'Other learners remain unread';
 s:=jsonb_build_object('problemId',sid,'revision',2,'language','java','source','class Solution {}','shared',true,'runtimeMs',2,'memoryBytes',20000000,'memoryMetric','process_peak_rss','compiler','fixture','benchmarkVersion','bq-v1','suiteKind','public','testCount',5,'nonce',gen_random_uuid());
 perform public.bytequest_submission_record('firebase:fixture:profile-a',s);perform public.bytequest_submission_record('firebase:fixture:profile-a',s||jsonb_build_object('nonce',gen_random_uuid(),'runtimeMs',1.8));perform public.bytequest_submission_record('firebase:fixture:profile-a',s||jsonb_build_object('nonce',gen_random_uuid(),'language','python','runtimeMs',1));perform public.bytequest_submission_record('firebase:fixture:profile-b',s||jsonb_build_object('nonce',gen_random_uuid(),'language','c','runtimeMs',0.5));
 r:=public.bytequest_submissions('firebase:fixture:profile-a','submission-list',jsonb_build_object('problemId',sid,'language','all','sort','runtime'));
 assert jsonb_array_length(r->'users')=3,'Best result per learner and language';assert r->'users'->0->>'language'='c' and r->'users'->1->>'language'='python','All-language runtime order';
 r:=public.bytequest_submissions('firebase:fixture:profile-a','submission-list',jsonb_build_object('problemId',sid,'language','java','sort','runtime'));assert jsonb_array_length(r->'users')=1 and (r->'users'->0->>'runtime_ms')::numeric=1.8,'Specific-language filter remains available';
 insert into public.bytequest_firebase_progress(user_id,payload) values('firebase:fixture:profile-c',jsonb_build_object('version',1,'solved',jsonb_build_object(sid,extract(epoch from now())*1000)));
 r:=public.bytequest_submissions('firebase:fixture:profile-c','submission-list',jsonb_build_object('problemId',sid,'language','all','sort','runtime'));assert not(r->>'unlocked')::boolean,'Combined board retains server-acceptance gate';
 r:=public.bytequest_profile_insights('firebase:fixture:profile-b',a::text);assert jsonb_array_length(r->'languages')=2,'Languages come from accepted submissions';assert (r->'languages'->0->>'solved')::int=1,'Repeated submissions do not inflate language counts';assert jsonb_array_length(r->'skills')=1 and (r->'skills'->0->>'solved')::int=1,'Skills derive from distinct solved problems';
 update public.bytequest_social_profiles set discoverable=false where public_id=a;
 begin perform public.bytequest_profile_insights('firebase:fixture:profile-b',a::text);raise exception 'Private insights leaked';exception when no_data_found then null;end;
 r:=public.bytequest_problem_credits('firebase:fixture:profile-b',sid);assert jsonb_array_length(r->'users')=0 and (r->>'hasAuthor')::boolean,'Private author hidden without losing stored authorship';
 r:=public.bytequest_profile_insights('firebase:fixture:profile-a',a::text);assert r->'details'->>'organization_name'='Example University','Private owner retains own details';
 assert not has_function_privilege('anon','public.bytequest_profile_insights(text,text)','execute'),'Service-only insights';assert not has_table_privilege('authenticated','public.bytequest_profile_details','select'),'Private details table';
end $$;
rollback;
select 'PASS: profile privacy, atomic details, authorship, all-user announcements, independent reads, all-language rankings, solve-derived skills/languages and service-only access' as result;
