create table public.bytequest_presence_sessions(
 owner_id text not null references public.bytequest_firebase_profiles(user_id) on delete cascade,
 page_id uuid not null,sequence bigint not null check(sequence>=0),active boolean not null default false,
 last_active_at timestamptz,updated_at timestamptz not null default now(),primary key(owner_id,page_id)
);
create index bytequest_presence_owner_updated on public.bytequest_presence_sessions(owner_id,updated_at);
alter table public.bytequest_presence_sessions enable row level security;
revoke all on public.bytequest_presence_sessions from public,anon,authenticated;
grant select,insert,update,delete on public.bytequest_presence_sessions to service_role;
create policy service_api_only on public.bytequest_presence_sessions for all to anon,authenticated using(false) with check(false);
create function public.bytequest_update_presence(owner_id text,page_id uuid,new_sequence bigint,is_active boolean,idle_ms integer)
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
create function public.bytequest_presence_status(owner_id text,viewer_id text)
 returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare p public.bytequest_social_profiles;at_time timestamptz:=clock_timestamp();last_active timestamptz;expires timestamptz;begin
 select * into p from public.bytequest_social_profiles s where s.owner_id=bytequest_presence_status.owner_id;
 if p.owner_id is null or (p.owner_id<>viewer_id and (not p.discoverable or not p.show_presence)) then return '{"visible":false}'::jsonb;end if;
 select max(s.last_active_at),max(s.last_active_at+interval '30 seconds') filter(where s.active and s.last_active_at>at_time-interval '30 seconds') into last_active,expires from public.bytequest_presence_sessions s where s.owner_id=bytequest_presence_status.owner_id;
 return jsonb_build_object('visible',true,'online',expires is not null,'lastSeen',last_active,'expiresAt',expires,'serverNow',at_time);
end $$;
revoke all on function public.bytequest_update_presence(text,uuid,bigint,boolean,integer),public.bytequest_presence_status(text,text) from public,anon,authenticated;
grant execute on function public.bytequest_update_presence(text,uuid,bigint,boolean,integer),public.bytequest_presence_status(text,text) to service_role;

create function public.bytequest_read_presence(viewer_id text,target text)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare target_owner text;begin
 select p.owner_id into target_owner from public.bytequest_social_profiles p where (p.username=lower(target) or p.public_id::text=target) and (p.discoverable or p.owner_id=viewer_id);
 if target_owner is null then raise exception 'Profile not found' using errcode='P0002';end if;
 return jsonb_build_object('presence',public.bytequest_presence_status(target_owner,viewer_id));
end $$;
revoke all on function public.bytequest_read_presence(text,text) from public,anon,authenticated;
grant execute on function public.bytequest_read_presence(text,text) to service_role;
