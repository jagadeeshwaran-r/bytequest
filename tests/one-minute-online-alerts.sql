-- Disposable fixtures; never mutate production users or persistent messages.
begin;
do $test$
declare
 actor_id text:='firebase:fixture:arrival-actor';
 viewer_id text:='firebase:fixture:arrival-viewer';
 offline_id text:='firebase:fixture:arrival-offline';
 actor uuid;viewer uuid;other uuid;
 actor_page uuid:=gen_random_uuid();viewer_page uuid:=gen_random_uuid();
 n integer;result jsonb;
begin
 insert into public.bytequest_firebase_profiles(user_id,project_id,firebase_uid,email)
 values(actor_id,'fixture','arrival-actor','arrival-actor@example.invalid'),
       (viewer_id,'fixture','arrival-viewer','arrival-viewer@example.invalid'),
       (offline_id,'fixture','arrival-offline','arrival-offline@example.invalid');
 insert into public.bytequest_social_profiles(owner_id,username,display_name,discoverable,show_presence)
 values(actor_id,'zz_arrival_actor_fixture','Actor fixture',true,true),
       (viewer_id,'zz_arrival_viewer_fixture','Viewer fixture',true,true),
       (offline_id,'zz_arrival_offline_fixture','Offline fixture',true,true);
 select public_id into actor from public.bytequest_social_profiles where owner_id=actor_id;
 select public_id into viewer from public.bytequest_social_profiles where owner_id=viewer_id;
 select public_id into other from public.bytequest_social_profiles where owner_id=offline_id;
 insert into public.bytequest_follows(follower,following) values(viewer,actor),(other,actor);

 perform public.bytequest_update_presence_live(actor_id,actor_page,1,true,0);
 assert not exists(select 1 from public.bytequest_live_events e where e.kind='friend_online' and e.actor=actor),
  'An offline follower must not have queued alerts when actor logs in';

 perform public.bytequest_update_presence_live(viewer_id,viewer_page,1,true,0);
 perform public.bytequest_update_presence_live(actor_id,actor_page,2,false,0);
 perform public.bytequest_update_presence_live(actor_id,actor_page,3,true,0);
 assert not exists(select 1 from public.bytequest_live_events e where e.kind='friend_online' and e.actor=actor),
  'Immediate reconnect must not alert anyone';

 perform public.bytequest_update_presence_live(actor_id,actor_page,4,false,0);
 -- Simulate a genuine 70+ second absence without sleeping.
 update public.bytequest_presence_sessions set last_active_at=clock_timestamp()-interval '70 seconds'
  where owner_id=actor_id;
 update public.bytequest_online_announcements set last_announced=clock_timestamp()-interval '70 seconds'
  where owner_id=actor_id;
 perform public.bytequest_update_presence_live(actor_id,actor_page,5,true,0);
 assert (select count(*) from public.bytequest_live_events e where e.actor=actor and e.kind='friend_online' and e.owner_id=viewer_id)=1,
  'After one minute offline, a currently online follower receives exactly one alert';
 assert not exists(select 1 from public.bytequest_live_events e where e.actor=actor and e.kind='friend_online' and e.owner_id=offline_id),
  'An offline follower must never receive online notification history';

 for n in 1..10 loop
  perform public.bytequest_update_presence_live(actor_id,actor_page,4+n*2,false,0);
  perform public.bytequest_update_presence_live(actor_id,actor_page,5+n*2,true,0);
 end loop;
 assert (select count(*) from public.bytequest_live_events e where e.actor=actor and e.kind='friend_online' and e.owner_id=viewer_id)=1,
  'Ten reconnects must not create ten online notifications';

 result:=public.bytequest_live_events_read(viewer_id,0);
 assert jsonb_array_length(result->'events')=1,'Online viewer sees one fresh arrival';
 perform public.bytequest_update_presence_live(viewer_id,viewer_page,2,false,0);
 result:=public.bytequest_live_events_read(viewer_id,0);
 assert jsonb_array_length(result->'events')=0,'Offline viewer receives no online toasts';
 perform public.bytequest_update_presence_live(viewer_id,viewer_page,3,true,0);
 update public.bytequest_live_events as e set created_at=clock_timestamp()-interval '2 minutes'
  where e.actor=actor and e.kind='friend_online';
 result:=public.bytequest_live_events_read(viewer_id,0);
 assert jsonb_array_length(result->'events')=0,'Old online alerts cannot reappear upon reconnect';

 assert not has_function_privilege('anon','public.bytequest_update_presence_live(text,uuid,bigint,boolean,integer)','EXECUTE');
 assert not has_function_privilege('authenticated','public.bytequest_live_events_read(text,bigint)','EXECUTE');
end $test$;
rollback;
select 'PASS: one-minute genuine arrivals, ten reconnects, online recipients only, no stale alerts; all fixtures rolled back' as result;
