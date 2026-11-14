-- Defaults apply to future profiles. Existing privacy choices stay intact.
alter table public.bytequest_social_profiles alter column discoverable set default true;
alter table public.bytequest_social_profiles alter column show_presence set default true;

-- The verified Edge Function supplies viewer_id; browsers cannot call this RPC directly.
create function public.bytequest_friend_presence(viewer_id text)
 returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('users',coalesce(jsonb_agg(jsonb_build_object(
  'public_id',friend.public_id,'username',friend.username,'display_name',friend.display_name,
  'presence',public.bytequest_presence_status(friend.owner_id,viewer_id)) order by friend.username),'[]'::jsonb))
 from (
  select p.owner_id,p.public_id,p.username,p.display_name
  from public.bytequest_social_profiles me
  join public.bytequest_follows f on f.follower=me.public_id
  join public.bytequest_social_profiles p on p.public_id=f.following
  where me.owner_id=viewer_id and p.owner_id<>viewer_id and p.discoverable and p.show_presence
  order by p.username limit 100
 ) friend;
$$;
revoke all on function public.bytequest_friend_presence(text) from public,anon,authenticated;
grant execute on function public.bytequest_friend_presence(text) to service_role;
