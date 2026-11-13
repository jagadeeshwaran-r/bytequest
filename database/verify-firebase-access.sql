begin;
select set_config('bytequest.firebase_test_uid','firebase:bytequest-policy-test:'||gen_random_uuid()::text,true);
set local role service_role;
select public.touch_bytequest_firebase_account(current_setting('bytequest.firebase_test_uid'),'bytequest-policy-test',split_part(current_setting('bytequest.firebase_test_uid'),':',3),'fixture@example.invalid');
do $$declare result record;begin
  select * into result from public.sync_bytequest_firebase_progress(current_setting('bytequest.firebase_test_uid'),'{"version":1,"notes":{"two-sum":"private"}}',0);
  if not result.applied or result.revision<>1 then raise exception 'Firebase progress did not save';end if;
  select * into result from public.sync_bytequest_firebase_progress(current_setting('bytequest.firebase_test_uid'),'{"version":1}',0);
  if result.applied or result.revision<>1 or result.payload->'notes'->>'two-sum'<>'private' then raise exception 'Stale Firebase write overwrote progress';end if;
  begin
    perform public.sync_bytequest_firebase_progress(current_setting('bytequest.firebase_test_uid'),'{"version":"1"}',1);
    raise exception 'String version was accepted';
  exception when invalid_parameter_value then null;end;
end;$$;
set local role anon;
do $$begin
  begin perform 1 from public.bytequest_firebase_profiles;raise exception 'Anonymous profile access';exception when insufficient_privilege then null;end;
  begin perform 1 from public.bytequest_firebase_progress;raise exception 'Anonymous progress access';exception when insufficient_privilege then null;end;
  begin perform public.sync_bytequest_firebase_progress(current_setting('bytequest.firebase_test_uid'),'{"version":1}',0);raise exception 'Anonymous privileged RPC access';exception when insufficient_privilege then null;end;
end;$$;
set local role authenticated;
do $$begin
  begin perform 1 from public.bytequest_firebase_progress;raise exception 'Browser read private Firebase progress';exception when insufficient_privilege then null;end;
  begin insert into public.bytequest_firebase_editors(user_id) values(current_setting('bytequest.firebase_test_uid'));raise exception 'Browser promoted own account';exception when insufficient_privilege then null;end;
  begin perform public.touch_bytequest_firebase_account('firebase:bytequest-policy-test:forged','bytequest-policy-test','forged','forged@example.invalid');raise exception 'Browser forged Firebase identity';exception when insufficient_privilege then null;end;
  begin perform public.sync_bytequest_firebase_progress(current_setting('bytequest.firebase_test_uid'),'{"version":1}',0);raise exception 'Browser called privileged sync';exception when insufficient_privilege then null;end;
end;$$;
rollback;
select 'PASS: Firebase tables and RPCs blocked to browser roles, service-only writes, payload checks, and stale revision protection' as verification;
