-- Private friend chat and durable live event delivery. Firebase-verified service API only.
create table public.bytequest_chat_messages (
 id bigint generated always as identity primary key,
 sender uuid not null references public.bytequest_social_profiles(public_id) on delete cascade,
 recipient uuid not null references public.bytequest_social_profiles(public_id) on delete cascade,
 client_nonce uuid not null,
 body text not null check(length(body) between 1 and 2000),
 created_at timestamptz not null default now(), read_at timestamptz,
 check(sender<>recipient), unique(sender,client_nonce)
);
create index bytequest_chat_recipient_unread on public.bytequest_chat_messages(recipient,id) where read_at is null;
create index bytequest_chat_thread on public.bytequest_chat_messages(sender,recipient,id desc);
create index bytequest_chat_reverse on public.bytequest_chat_messages(recipient,sender,id desc);
create table public.bytequest_chat_limits (
 owner_id text primary key references public.bytequest_firebase_profiles(user_id) on delete cascade,
 last_sent timestamptz not null default now(), window_start timestamptz not null default now(), sent integer not null default 1
);
create table public.bytequest_live_events (
 id bigint generated always as identity primary key,
 owner_id text not null references public.bytequest_firebase_profiles(user_id) on delete cascade,
 actor uuid not null references public.bytequest_social_profiles(public_id) on delete cascade,
 kind text not null check(kind in ('message','friend_online')),
 message_id bigint references public.bytequest_chat_messages(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index bytequest_live_events_owner_cursor on public.bytequest_live_events(owner_id,id);
create table public.bytequest_online_announcements (
 owner_id text primary key references public.bytequest_firebase_profiles(user_id) on delete cascade,
 last_announced timestamptz not null default now()
);
do $$ declare tab text;begin
 foreach tab in array array['bytequest_chat_messages','bytequest_chat_limits','bytequest_live_events','bytequest_online_announcements'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated',tab);
 execute format('grant select,insert,update,delete on public.%I to service_role',tab);
 execute format('create policy private_api_only on public.%I for all to anon,authenticated using(false) with check(false)',tab);
 end loop;
end $$;
grant usage,select on sequence public.bytequest_chat_messages_id_seq,public.bytequest_live_events_id_seq to service_role;
revoke all on sequence public.bytequest_chat_messages_id_seq,public.bytequest_live_events_id_seq from public,anon,authenticated;

create function public.bytequest_chat(owner_id text,action text,data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare me public.bytequest_social_profiles;peer public.bytequest_social_profiles;item public.bytequest_chat_messages;result jsonb;allowed boolean;lim public.bytequest_chat_limits;at_time timestamptz:=clock_timestamp();begin
 select * into me from public.bytequest_social_profiles s where s.owner_id=bytequest_chat.owner_id;
 if me.owner_id is null then raise exception 'Create a profile to use friend chat' using errcode='22023';end if;
 if action='chat-list' then
  with partners as (select p.*,exists(select 1 from public.bytequest_follows a join public.bytequest_follows b on b.follower=a.following and b.following=a.follower where a.follower=me.public_id and a.following=p.public_id) as mutual
   from public.bytequest_social_profiles p where p.public_id<>me.public_id and (exists(select 1 from public.bytequest_chat_messages m where (m.sender=me.public_id and m.recipient=p.public_id) or (m.recipient=me.public_id and m.sender=p.public_id)) or exists(select 1 from public.bytequest_follows a join public.bytequest_follows b on b.follower=a.following and b.following=a.follower where a.follower=me.public_id and a.following=p.public_id)))
  select jsonb_build_object('users',coalesce(jsonb_agg(jsonb_build_object('public_id',p.public_id,'username',case when p.discoverable then p.username else null end,'display_name',case when p.discoverable then p.display_name else 'Unavailable profile' end,'avatar_url',case when p.discoverable then p.avatar_url else '' end,'avatar_path',case when p.discoverable then p.avatar_path else '' end,'canMessage',p.mutual and p.discoverable and me.discoverable,'unread',(select count(*) from public.bytequest_chat_messages m where m.sender=p.public_id and m.recipient=me.public_id and m.read_at is null),'lastMessageAt',(select max(m.created_at) from public.bytequest_chat_messages m where (m.sender=me.public_id and m.recipient=p.public_id) or (m.recipient=me.public_id and m.sender=p.public_id))) order by p.display_name),'[]'::jsonb)) into result from partners p;
  return result;
 end if;
 select * into peer from public.bytequest_social_profiles p where p.public_id::text=data->>'target' and p.public_id<>me.public_id;
 if peer.owner_id is null then raise exception 'Friend not found' using errcode='P0002';end if;
 allowed:=me.discoverable and peer.discoverable and exists(select 1 from public.bytequest_follows a join public.bytequest_follows b on b.follower=a.following and b.following=a.follower where a.follower=me.public_id and a.following=peer.public_id);
 if action='chat-send' then
  if not allowed then raise exception 'Messaging requires both profiles to follow each other and be discoverable' using errcode='42501';end if;
  if length(trim(data->>'body')) not between 1 and 2000 or data->>'nonce' is null then raise exception 'Write a message under 2,000 characters' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended('chat:'||me.owner_id,0));
  select * into item from public.bytequest_chat_messages m where m.sender=me.public_id and m.client_nonce=(data->>'nonce')::uuid;
  if found then
   if item.recipient<>peer.public_id or item.body<>trim(data->>'body') then raise exception 'Message retry does not match its original content' using errcode='22023';end if;
   return jsonb_build_object('message',jsonb_build_object('id',item.id,'body',item.body,'created_at',item.created_at,'isOwn',true));
  end if;
  select * into lim from public.bytequest_chat_limits l where l.owner_id=me.owner_id;
  if found and (lim.last_sent>at_time-interval '1 second' or (lim.window_start>at_time-interval '10 minutes' and lim.sent>=60)) then raise exception 'Please slow down before sending another message' using errcode='P0001';end if;
  insert into public.bytequest_chat_limits(owner_id,last_sent,window_start,sent) values(me.owner_id,at_time,at_time,1) on conflict(owner_id) do update set last_sent=at_time,window_start=case when bytequest_chat_limits.window_start<=at_time-interval '10 minutes' then at_time else bytequest_chat_limits.window_start end,sent=case when bytequest_chat_limits.window_start<=at_time-interval '10 minutes' then 1 else bytequest_chat_limits.sent+1 end;
  insert into public.bytequest_chat_messages(sender,recipient,client_nonce,body) values(me.public_id,peer.public_id,(data->>'nonce')::uuid,trim(data->>'body')) returning * into item;
  insert into public.bytequest_live_events(owner_id,actor,kind,message_id) values(peer.owner_id,me.public_id,'message',item.id);
  return jsonb_build_object('message',jsonb_build_object('id',item.id,'body',item.body,'created_at',item.created_at,'isOwn',true));
 elsif action='chat-read' then
  update public.bytequest_chat_messages m set read_at=coalesce(m.read_at,at_time) where m.recipient=me.public_id and m.sender=peer.public_id and m.id<=coalesce((data->>'through')::bigint,0) and m.read_at is null;
  return '{"ok":true}'::jsonb;
 elsif action='chat-thread' then
  if not allowed and not exists(select 1 from public.bytequest_chat_messages m where (m.sender=me.public_id and m.recipient=peer.public_id) or (m.recipient=me.public_id and m.sender=peer.public_id)) then raise exception 'Conversation not found' using errcode='P0002';end if;
  select jsonb_build_object('peer',jsonb_build_object('public_id',peer.public_id,'username',case when peer.discoverable then peer.username else null end,'display_name',case when peer.discoverable then peer.display_name else 'Unavailable profile' end,'avatar_url',case when peer.discoverable then peer.avatar_url else '' end,'avatar_path',case when peer.discoverable then peer.avatar_path else '' end),'canMessage',allowed,'messages',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'body',t.body,'created_at',t.created_at,'isOwn',t.sender=me.public_id,'read',t.read_at is not null) order by t.id) from (select m.* from public.bytequest_chat_messages m where ((m.sender=me.public_id and m.recipient=peer.public_id) or (m.recipient=me.public_id and m.sender=peer.public_id)) and m.id>coalesce((data->>'after')::bigint,0) and (data->>'before' is null or m.id<(data->>'before')::bigint) order by case when coalesce((data->>'after')::bigint,0)>0 then m.id end asc,m.id desc limit 50) t),'[]'::jsonb)) into result;
  return result;
 end if;
 raise exception 'Unknown chat operation' using errcode='22023';
end $$;

create function public.bytequest_update_presence_live(owner_id text,page_id uuid,new_sequence bigint,is_active boolean,idle_ms integer) returns void
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare was_online boolean;is_online boolean;actor public.bytequest_social_profiles;last_notice timestamptz;begin
 perform pg_advisory_xact_lock(hashtextextended('presence-live:'||owner_id,0));
 was_online:=coalesce((public.bytequest_presence_status(owner_id,owner_id)->>'online')::boolean,false);
 perform public.bytequest_update_presence(owner_id,page_id,new_sequence,is_active,idle_ms);
 is_online:=coalesce((public.bytequest_presence_status(owner_id,owner_id)->>'online')::boolean,false);
 if was_online or not is_online then return;end if;
 select * into actor from public.bytequest_social_profiles p where p.owner_id=bytequest_update_presence_live.owner_id and p.discoverable and p.show_presence;
 if actor.owner_id is null then return;end if;
 select a.last_announced into last_notice from public.bytequest_online_announcements a where a.owner_id=actor.owner_id;
 if last_notice>clock_timestamp()-interval '15 seconds' then return;end if;
 insert into public.bytequest_online_announcements(owner_id,last_announced) values(actor.owner_id,clock_timestamp()) on conflict(owner_id) do update set last_announced=excluded.last_announced;
 insert into public.bytequest_live_events(owner_id,actor,kind) select recipient.owner_id,actor.public_id,'friend_online' from public.bytequest_follows f join public.bytequest_social_profiles recipient on recipient.public_id=f.follower where f.following=actor.public_id;
end $$;

create function public.bytequest_live_events_read(owner_id text,after_id bigint default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare me public.bytequest_social_profiles;result jsonb;cursor_id bigint;begin
 select * into me from public.bytequest_social_profiles p where p.owner_id=bytequest_live_events_read.owner_id;
 if after_id is null then
  delete from public.bytequest_live_events e where e.owner_id=bytequest_live_events_read.owner_id and e.created_at<now()-interval '7 days';
  select coalesce(max(e.id),0) into cursor_id from public.bytequest_live_events e where e.owner_id=bytequest_live_events_read.owner_id;
  return jsonb_build_object('cursor',cursor_id,'events','[]'::jsonb,'unread',(select count(*) from public.bytequest_chat_messages m where m.recipient=me.public_id and m.read_at is null));
 end if;
 with pending as materialized (select e.* from public.bytequest_live_events e where e.owner_id=bytequest_live_events_read.owner_id and e.id>after_id order by e.id limit 100),visible as (
  select e.*,p.public_id,p.username,p.display_name,p.avatar_url,p.avatar_path,p.discoverable,m.body from pending e join public.bytequest_social_profiles p on p.public_id=e.actor left join public.bytequest_chat_messages m on m.id=e.message_id
  where e.kind='message' or (p.discoverable and p.show_presence and exists(select 1 from public.bytequest_follows f where f.follower=me.public_id and f.following=p.public_id) and coalesce((public.bytequest_presence_status(p.owner_id,me.owner_id)->>'online')::boolean,false)))
 select jsonb_build_object('cursor',coalesce((select max(id) from pending),after_id),'events',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'kind',v.kind,'actor',jsonb_build_object('public_id',v.public_id,'username',case when v.discoverable then v.username else null end,'display_name',case when v.discoverable then v.display_name else 'A friend' end,'avatar_url',case when v.discoverable then v.avatar_url else '' end,'avatar_path',case when v.discoverable then v.avatar_path else '' end),'messageId',v.message_id,'preview',case when v.kind='message' then left(v.body,100) else null end) order by v.id) from visible v),'[]'::jsonb),'unread',(select count(*) from public.bytequest_chat_messages m where m.recipient=me.public_id and m.read_at is null)) into result;
 return result;
end $$;
revoke all on function public.bytequest_chat(text,text,jsonb),public.bytequest_update_presence_live(text,uuid,bigint,boolean,integer),public.bytequest_live_events_read(text,bigint) from public,anon,authenticated;
grant execute on function public.bytequest_chat(text,text,jsonb),public.bytequest_update_presence_live(text,uuid,bigint,boolean,integer),public.bytequest_live_events_read(text,bigint) to service_role;
