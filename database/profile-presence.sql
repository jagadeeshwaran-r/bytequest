alter table public.bytequest_social_profiles add column if not exists show_presence boolean not null default false;
CREATE OR REPLACE FUNCTION public.bytequest_community(owner_id text, action text, data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare me public.bytequest_social_profiles; target public.bytequest_social_profiles; rowdata jsonb; result jsonb; is_admin boolean; begin
 select * into me from public.bytequest_social_profiles s where s.owner_id=bytequest_community.owner_id;
 select exists(select 1 from public.bytequest_library_admins a where a.user_id=bytequest_community.owner_id) into is_admin;
 if action='profile-save' then
  insert into public.bytequest_social_profiles(owner_id,username,display_name,bio,avatar_url,discoverable)
  values(bytequest_community.owner_id,data->>'username',data->>'display_name',data->>'bio',data->>'avatar_url',(data->>'discoverable')::boolean)
  on conflict(owner_id) do update set username=excluded.username,display_name=excluded.display_name,bio=excluded.bio,avatar_url=excluded.avatar_url,avatar_path=case when excluded.avatar_url<>'' then '' else bytequest_social_profiles.avatar_path end,discoverable=excluded.discoverable,updated_at=now();
  update public.bytequest_social_profiles set show_presence=coalesce((data->>'show_presence')::boolean,false) where bytequest_social_profiles.owner_id=bytequest_community.owner_id;
  select * into me from public.bytequest_social_profiles s where s.owner_id=bytequest_community.owner_id;
 end if;
 if action in ('self','profile-save') then
  return jsonb_build_object('profile',case when me.owner_id is null then null else to_jsonb(me)-'owner_id' end,'admin',is_admin,'creator',is_admin or exists(select 1 from public.bytequest_firebase_editors e where e.user_id=bytequest_community.owner_id));
 elsif action='search' then
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from
   (select p.public_id,p.username,p.display_name,p.avatar_url,p.avatar_path from public.bytequest_social_profiles p where p.discoverable and
    (p.username like replace(replace(lower(data->>'query'),'%',''), '_','\_')||'%' escape '\' or p.public_id::text=data->>'query') order by p.username limit 25) s;
  return jsonb_build_object('users',result);
 elsif action in ('profile','follow','followers','following') then
  select * into target from public.bytequest_social_profiles p where (p.username=lower(data->>'target') or p.public_id::text=data->>'target') and (p.discoverable or p.owner_id=bytequest_community.owner_id);
  if target.owner_id is null then raise exception 'Profile not found' using errcode='P0002';end if;
  if action='follow' then
   if me.owner_id is null or not me.discoverable then raise exception 'Create a discoverable profile first' using errcode='22023';end if;
   if me.public_id=target.public_id then raise exception 'You cannot follow yourself' using errcode='22023';end if;
   if (data->>'following')::boolean then insert into public.bytequest_follows(follower,following) values(me.public_id,target.public_id) on conflict do nothing;
   else delete from public.bytequest_follows f where f.follower=me.public_id and f.following=target.public_id;end if;
  end if;
  if action in ('followers','following') then
   select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (
    select p.public_id,p.username,p.display_name,p.avatar_url,p.avatar_path from public.bytequest_follows f join public.bytequest_social_profiles p on p.public_id=case when action='followers' then f.follower else f.following end
    where (case when action='followers' then f.following else f.follower end)=target.public_id and p.discoverable order by p.username limit 100) s;
   return jsonb_build_object('users',result);
  end if;
  select jsonb_build_object('days',coalesce(g.payload->'days','[]'),'solved',coalesce((select count(*) from jsonb_object_keys(g.payload->'solved')),0),'solves',coalesce((select jsonb_agg(jsonb_build_object('day',to_char(to_timestamp((item.value::text)::double precision/1000) at time zone 'UTC','YYYY-MM-DD'),'topic',p.content->>'topic')) from jsonb_each(g.payload->'solved') item join public.bytequest_problems p on p.id=item.key and p.published),'[]'::jsonb)) into rowdata
   from public.bytequest_firebase_progress g where g.user_id=target.owner_id;
  return jsonb_build_object('presence',case when target.show_presence and target.discoverable or target.owner_id=bytequest_community.owner_id then (select jsonb_build_object('visible',true,'online',f.last_seen_at>now()-interval '2 minutes','lastSeen',f.last_seen_at) from public.bytequest_firebase_profiles f where f.user_id=target.owner_id) else jsonb_build_object('visible',false) end,'profile',to_jsonb(target)-'owner_id','stats',coalesce(rowdata,'{"days":[],"solved":0}'),
    'followers',(select count(*) from public.bytequest_follows f join public.bytequest_social_profiles p on p.public_id=f.follower where f.following=target.public_id and p.discoverable),
    'following',(select count(*) from public.bytequest_follows f join public.bytequest_social_profiles p on p.public_id=f.following where f.follower=target.public_id and p.discoverable),
    'isFollowing',exists(select 1 from public.bytequest_follows f where f.follower=me.public_id and f.following=target.public_id),'isOwn',target.owner_id=bytequest_community.owner_id);
 elsif action='notifications' then
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (select a.* from public.bytequest_announcements a join public.bytequest_problems p on p.id=a.problem_id where p.published order by a.id desc limit 50) s;
  return jsonb_build_object('items',result,'lastRead',coalesce((select n.last_read from public.bytequest_notification_reads n where n.user_id=bytequest_community.owner_id),0));
 elsif action='notifications-read' then
  insert into public.bytequest_notification_reads(user_id,last_read) values(bytequest_community.owner_id,least((data->>'id')::bigint,coalesce((select max(id) from public.bytequest_announcements),0))) on conflict(user_id) do update set last_read=greatest(bytequest_notification_reads.last_read,excluded.last_read);
  return '{"ok":true}';
 elsif action in ('roles','role-set') then
  if not is_admin then raise exception 'Library administrator access required' using errcode='42501';end if;
  if action='role-set' then
   select * into target from public.bytequest_social_profiles p where p.public_id::text=data->>'target';
   if target.owner_id is null then raise exception 'Profile not found' using errcode='P0002';end if;
   if (data->>'creator')::boolean then insert into public.bytequest_firebase_editors(user_id) values(target.owner_id) on conflict do nothing;
   else delete from public.bytequest_firebase_editors e where e.user_id=target.owner_id;end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (select p.public_id,p.username,p.display_name from public.bytequest_firebase_editors e join public.bytequest_social_profiles p on p.owner_id=e.user_id order by p.username) s;
  return jsonb_build_object('creators',result);
 end if;
 raise exception 'Unknown community action' using errcode='22023';
end $function$

;
