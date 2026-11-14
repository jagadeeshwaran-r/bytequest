-- Weighted practice scoring and privacy-filtered friend analytics. Service API only.
CREATE OR REPLACE FUNCTION public.bytequest_leaderboard(viewer_id text, board_scope text DEFAULT 'global'::text, ranking_period text DEFAULT 'all'::text, page_number integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
   coalesce(sum(case q.content->>'difficulty' when 'Easy' then 10 when 'Medium' then 25 when 'Hard' then 50 else 0 end),0)::integer as points,
   (count(q.id) filter(where q.content->>'difficulty'='Easy'))::integer as easy,
   (count(q.id) filter(where q.content->>'difficulty'='Medium'))::integer as medium,
   (count(q.id) filter(where q.content->>'difficulty'='Hard'))::integer as hard
  from scoped s
  left join lateral jsonb_each(case when jsonb_typeof(s.payload->'solved')='object' then s.payload->'solved' else '{}'::jsonb end) e on true
  left join public.bytequest_problems q on q.id=e.key and q.published and
   case when jsonb_typeof(e.value)='number' then (e.value::text)::numeric>0 and (e.value::text)::numeric between start_ms and end_ms else false end
  group by s.public_id,s.username,s.display_name,s.avatar_url,s.avatar_path,s.owner_id
 ),ranked as materialized (
  select scored.*,rank() over(order by points desc) as rank,row_number() over(order by points desc,username) as position from scored
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
end $function$;

CREATE OR REPLACE FUNCTION public.bytequest_profile_rank(viewer_id text, target text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare p public.bytequest_social_profiles;r jsonb;score jsonb;begin
 select * into p from public.bytequest_social_profiles s where (s.username=lower(target) or s.public_id::text=target) and (s.discoverable or s.owner_id=viewer_id);
 if p.owner_id is null then raise exception 'Profile not found' using errcode='P0002';end if;
 r:=public.bytequest_leaderboard(p.owner_id,'global','all',0)->'me';
 if r is null or r='null'::jsonb then
  select jsonb_build_object('rank',null,'solved',count(q.id),'points',coalesce(sum(case q.content->>'difficulty' when 'Easy' then 10 when 'Medium' then 25 when 'Hard' then 50 else 0 end),0)) into r
  from public.bytequest_firebase_progress g left join lateral jsonb_each(coalesce(g.payload->'solved','{}'::jsonb)) e on true
  left join public.bytequest_problems q on q.id=e.key and q.published and case when jsonb_typeof(e.value)='number' then (e.value::text)::numeric>0 and (e.value::text)::numeric<=extract(epoch from now())*1000 else false end
  where g.user_id=p.owner_id;
 end if;
 return (r-'avatar_path'-'avatar_url'-'display_name'-'username'-'public_id'-'isYou')||jsonb_build_object('isAdmin',exists(select 1 from public.bytequest_library_admins a where a.user_id=p.owner_id));
end $function$;

CREATE OR REPLACE FUNCTION public.bytequest_friend_analytics(viewer_id text, targets jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object('users',coalesce(jsonb_agg(jsonb_build_object(
  'public_id',s.public_id,'username',s.username,'display_name',s.display_name,'avatar_url',s.avatar_url,'avatar_path',s.avatar_path,
  'solves',coalesce((select jsonb_agg(jsonb_build_object('day',to_char(to_timestamp(e.at_ms::double precision/1000) at time zone 'UTC','YYYY-MM-DD'),'topic',q.content->>'topic'))
   from (select x.key,case when jsonb_typeof(x.value)='number' then (x.value::text)::numeric else null end as at_ms from jsonb_each(case when jsonb_typeof(g.payload->'solved')='object' then g.payload->'solved' else '{}'::jsonb end) x where jsonb_typeof(x.value)='number') e
   join public.bytequest_problems q on q.id=e.key and q.published where e.at_ms>0 and e.at_ms<=extract(epoch from now())*1000),'[]'::jsonb)) order by s.username),'[]'::jsonb))
 from public.bytequest_social_profiles me join public.bytequest_follows f on f.follower=me.public_id
 join public.bytequest_social_profiles s on s.public_id=f.following and s.discoverable
 left join public.bytequest_firebase_progress g on g.user_id=s.owner_id
 where me.owner_id=viewer_id and jsonb_typeof(targets)='array' and jsonb_array_length(targets)<=100 and targets ? s.public_id::text;
$function$;

CREATE OR REPLACE FUNCTION public.bytequest_friend_presence(viewer_id text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select jsonb_build_object('users',coalesce(jsonb_agg(jsonb_build_object(
 'public_id',p.public_id,'username',p.username,'display_name',p.display_name,'avatar_url',p.avatar_url,'avatar_path',p.avatar_path,
 'presence',public.bytequest_presence_status(p.owner_id,viewer_id)) order by p.username),'[]'::jsonb))
 from (select p.* from public.bytequest_social_profiles me join public.bytequest_follows f on f.follower=me.public_id join public.bytequest_social_profiles p on p.public_id=f.following
 where me.owner_id=viewer_id and p.owner_id<>viewer_id and p.discoverable and p.show_presence order by p.username limit 100) p;
$function$;


revoke all on function public.bytequest_leaderboard(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.bytequest_leaderboard(text,text,text,integer) to service_role;

revoke all on function public.bytequest_profile_rank(text,text) from public,anon,authenticated;
grant execute on function public.bytequest_profile_rank(text,text) to service_role;

revoke all on function public.bytequest_friend_analytics(text,jsonb) from public,anon,authenticated;
grant execute on function public.bytequest_friend_analytics(text,jsonb) to service_role;

revoke all on function public.bytequest_friend_presence(text) from public,anon,authenticated;
grant execute on function public.bytequest_friend_presence(text) to service_role;
