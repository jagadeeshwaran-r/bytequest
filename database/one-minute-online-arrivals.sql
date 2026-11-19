-- Online notifications are ephemeral presence signals, never durable inbox messages.
-- Genuine re-entry requires a full minute away; repeated tabs, heartbeats,
-- rapid reconnects and background recipients must not create alerts.
begin;

create or replace function public.bytequest_update_presence_live(
 owner_id text,page_id uuid,new_sequence bigint,is_active boolean,idle_ms integer
) returns void language plpgsql security invoker set search_path='' as $function$
#variable_conflict use_column
declare
 actor public.bytequest_social_profiles;
 at_time timestamptz:=clock_timestamp();
 was_online boolean;
 is_online boolean;
 previous_activity timestamptz;
 last_notice timestamptz;
begin
 -- Serialize all tabs of an actor before deciding whether to emit an arrival.
 perform pg_advisory_xact_lock(hashtextextended('presence-live:'||owner_id,0));
 was_online:=coalesce((public.bytequest_presence_status(owner_id,owner_id)->>'online')::boolean,false);
 select max(s.last_active_at) into previous_activity
 from public.bytequest_presence_sessions s
 where s.owner_id=bytequest_update_presence_live.owner_id;
 perform public.bytequest_update_presence(owner_id,page_id,new_sequence,is_active,idle_ms);
 is_online:=coalesce((public.bytequest_presence_status(owner_id,owner_id)->>'online')::boolean,false);
 if was_online or not is_online then return;end if;
 -- A one-minute minimum offline period means blur/focus, page reload,
 -- opening extra tabs, and short network gaps never look like new arrivals.
 if previous_activity is not null and previous_activity>at_time-interval '1 minute' then return;end if;
 select * into actor from public.bytequest_social_profiles p
 where p.owner_id=bytequest_update_presence_live.owner_id
 and p.discoverable and p.show_presence;
 if actor.owner_id is null then return;end if;
 select a.last_announced into last_notice from public.bytequest_online_announcements a
 where a.owner_id=actor.owner_id;
 if last_notice is not null and last_notice>at_time-interval '1 minute' then return;end if;

 -- An announcement is made once per genuine re-entry, even if no follower
 -- happens to be online. Offline recipients do not get queued online events.
 insert into public.bytequest_online_announcements(owner_id,last_announced)
 values(actor.owner_id,at_time)
 on conflict(owner_id) do update set last_announced=excluded.last_announced;

 insert into public.bytequest_live_events(owner_id,actor,kind)
 select recipient.owner_id,actor.public_id,'friend_online'
 from public.bytequest_follows f
 join public.bytequest_social_profiles recipient on recipient.public_id=f.follower
 where f.following=actor.public_id
 and recipient.owner_id<>actor.owner_id
 and coalesce((public.bytequest_presence_status(recipient.owner_id,recipient.owner_id)->>'online')::boolean,false);
end $function$;

create or replace function public.bytequest_live_events_read(
 owner_id text,after_id bigint default null
) returns jsonb language plpgsql security invoker set search_path='' as $function$
#variable_conflict use_column
declare
 me public.bytequest_social_profiles;
 result jsonb;
 cursor_id bigint;
 reader_online boolean;
 at_time timestamptz:=clock_timestamp();
begin
 select * into me from public.bytequest_social_profiles p where p.owner_id=bytequest_live_events_read.owner_id;
 reader_online:=coalesce((public.bytequest_presence_status(owner_id,owner_id)->>'online')::boolean,false);
 if after_id is null then
  delete from public.bytequest_live_events e
    where e.owner_id=bytequest_live_events_read.owner_id
    and e.created_at<at_time-interval '7 days';
  select coalesce(max(e.id),0) into cursor_id
    from public.bytequest_live_events e where e.owner_id=bytequest_live_events_read.owner_id;
  return jsonb_build_object('cursor',cursor_id,'events','[]'::jsonb,
    'unread',(select count(*) from public.bytequest_chat_messages m
              where m.recipient=me.public_id and m.read_at is null));
 end if;
 with pending as materialized (
  select e.* from public.bytequest_live_events e
  where e.owner_id=bytequest_live_events_read.owner_id
    and e.id>after_id
  order by e.id limit 100
 ), visible as (
  select e.*,p.public_id,p.username,p.display_name,p.avatar_url,
   p.avatar_path,p.discoverable,m.body
  from pending e
  join public.bytequest_social_profiles p on p.public_id=e.actor
  left join public.bytequest_chat_messages m on m.id=e.message_id
  where e.kind='message'
   or (
    reader_online
    and e.kind='friend_online'
    and e.created_at>=at_time-interval '1 minute'
    and p.discoverable and p.show_presence
    and exists(select 1 from public.bytequest_follows f
      where f.follower=me.public_id and f.following=p.public_id)
    and coalesce((public.bytequest_presence_status(p.owner_id,me.owner_id)->>'online')::boolean,false)
   )
 )
 select jsonb_build_object(
  'cursor',coalesce((select max(id) from pending),after_id),
  'events',coalesce((select jsonb_agg(jsonb_build_object(
   'id',v.id,'kind',v.kind,'actor',jsonb_build_object(
    'public_id',v.public_id,'username',case when v.discoverable then v.username else null end,
    'display_name',case when v.discoverable then v.display_name else 'A friend' end,
    'avatar_url',case when v.discoverable then v.avatar_url else '' end,
    'avatar_path',case when v.discoverable then v.avatar_path else '' end),
   'messageId',v.message_id,
   'preview',case when v.kind='message' then left(v.body,100) else null end
  ) order by v.id) from visible v),'[]'::jsonb),
  'unread',(select count(*) from public.bytequest_chat_messages m
    where m.recipient=me.public_id and m.read_at is null)
 ) into result;
 return result;
end $function$;

-- These are transient toasts, not messages. Remove accumulated stale signals.
delete from public.bytequest_live_events
 where kind='friend_online' and created_at<clock_timestamp()-interval '1 minute';

revoke all on function public.bytequest_update_presence_live(text,uuid,bigint,boolean,integer),
 public.bytequest_live_events_read(text,bigint) from public,anon,authenticated;
grant execute on function public.bytequest_update_presence_live(text,uuid,bigint,boolean,integer),
 public.bytequest_live_events_read(text,bigint) to service_role;
commit;