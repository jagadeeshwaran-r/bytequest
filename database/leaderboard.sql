-- Rankings expose aggregates of discoverable profiles through the verified API only.
create function public.bytequest_leaderboard(viewer_id text,board_scope text default 'global',ranking_period text default 'all',page_number integer default 0)
 returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 at_time timestamptz:=now();start_ms numeric:=0;end_ms numeric:=extract(epoch from now())*1000;result jsonb;
begin
 if board_scope not in ('global','friends') or ranking_period not in ('all','week','month') or page_number<0 or page_number>1000000 or board_scope is null or ranking_period is null or page_number is null then
  raise exception 'Choose a valid leaderboard, period and page' using errcode='22023';
 end if;
 if ranking_period<>'all' then
  start_ms:=extract(epoch from (date_trunc(ranking_period,at_time at time zone 'UTC') at time zone 'UTC'))*1000;
 end if;
 with scoped as materialized (
  select p.owner_id,p.public_id,p.username,p.display_name,p.avatar_url,p.avatar_path,coalesce(g.payload,'{}'::jsonb) as payload
  from public.bytequest_social_profiles p
  left join public.bytequest_firebase_progress g on g.user_id=p.owner_id
  where p.discoverable and (board_scope='global' or p.owner_id=viewer_id or exists(
   select 1 from public.bytequest_social_profiles me join public.bytequest_follows f on f.follower=me.public_id
   where me.owner_id=viewer_id and f.following=p.public_id
  ))
 ),scored as materialized (
  select s.public_id,s.username,s.display_name,s.avatar_url,s.avatar_path,s.owner_id=viewer_id as "isYou",
   count(q.id)::integer as solved,
   (count(q.id) filter(where q.content->>'difficulty'='Easy'))::integer as easy,
   (count(q.id) filter(where q.content->>'difficulty'='Medium'))::integer as medium,
   (count(q.id) filter(where q.content->>'difficulty'='Hard'))::integer as hard
  from scoped s
  left join lateral jsonb_each(case when jsonb_typeof(s.payload->'solved')='object' then s.payload->'solved' else '{}'::jsonb end) e on true
  left join public.bytequest_problems q on q.id=e.key and q.published and
   case when jsonb_typeof(e.value)='number' then (e.value::text)::numeric>0 and (e.value::text)::numeric between start_ms and end_ms else false end
  group by s.public_id,s.username,s.display_name,s.avatar_url,s.avatar_path,s.owner_id
 ),ranked as materialized (
  select scored.*,rank() over(order by solved desc) as rank,row_number() over(order by solved desc,username) as position from scored
 )
 select jsonb_build_object(
  'users',coalesce((select jsonb_agg(to_jsonb(t)-'position' order by t.position) from (select * from ranked order by position limit 25 offset page_number*25) t),'[]'::jsonb),
  'me',(select to_jsonb(r)-'position' from ranked r where r."isYou"),
  'total',(select count(*) from ranked),'page',page_number,'pageSize',25,'scope',board_scope,'period',ranking_period,
  'hasProfile',exists(select 1 from public.bytequest_social_profiles p where p.owner_id=viewer_id),
  'discoverable',coalesce((select p.discoverable from public.bytequest_social_profiles p where p.owner_id=viewer_id),false),
  'generatedAt',at_time
 ) into result;
 return result;
end $$;
revoke all on function public.bytequest_leaderboard(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.bytequest_leaderboard(text,text,text,integer) to service_role;
