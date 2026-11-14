create or replace function public.bytequest_update_presence(owner_id text,page_id uuid,new_sequence bigint,is_active boolean,idle_ms integer)
 returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare at_time timestamptz:=clock_timestamp();begin
 if new_sequence<1 or new_sequence>9007199254740991 or idle_ms<0 or idle_ms>30000 then raise exception 'Invalid presence update' using errcode='22023';end if;
 insert into public.bytequest_presence_sessions as s(owner_id,page_id,sequence,active,last_active_at,updated_at)
 values(bytequest_update_presence.owner_id,bytequest_update_presence.page_id,new_sequence,is_active and idle_ms<30000,case when is_active then at_time-idle_ms*interval '1 millisecond' else null end,at_time)
 on conflict(owner_id,page_id) do update set sequence=excluded.sequence,active=excluded.active,
 last_active_at=case when excluded.active or (s.active and s.last_active_at>at_time-interval '30 seconds') then greatest(s.last_active_at,at_time-idle_ms*interval '1 millisecond') else s.last_active_at end,updated_at=at_time
 where s.sequence<excluded.sequence;
 delete from public.bytequest_presence_sessions s where s.owner_id=bytequest_update_presence.owner_id and s.updated_at<at_time-interval '1 day' and s.page_id<>'00000000-0000-0000-0000-000000000000'::uuid;
end $$;
