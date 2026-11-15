-- Creator lookup, participant-only chat signals, and recent public solve history.
create index if not exists bytequest_chat_seen on public.bytequest_chat_messages(sender,recipient,id desc) include(read_at) where read_at is not null;

create or replace function public.bytequest_creator_search(owner_id text,query_text text)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare q text:=trim(query_text);uname text:=lower(ltrim(trim(query_text),'@'));users jsonb;needs_profile boolean;begin
 if not exists(select 1 from public.bytequest_library_admins a where a.user_id=owner_id) then raise exception 'Library administrator access required' using errcode='42501';end if;
 if q is null or length(q) not between 2 and 180 or q !~ '^[A-Za-z0-9_:@-]+$' then raise exception 'Search by username, profile ID or exact Firebase user ID' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.username),'[]'::jsonb) into users from (
  select p.public_id,p.username,p.display_name,case when p.discoverable then p.avatar_url else '' end as avatar_url,case when p.discoverable then p.avatar_path else '' end as avatar_path,
   not p.discoverable as private_profile,(exists(select 1 from public.bytequest_firebase_editors e where e.user_id=p.owner_id) or exists(select 1 from public.bytequest_library_admins a where a.user_id=p.owner_id)) as creator
  from public.bytequest_social_profiles p join public.bytequest_firebase_profiles f on f.user_id=p.owner_id
  where f.project_id=split_part(owner_id,':',2) and (p.username=uname or p.public_id::text=lower(q) or f.user_id=q or f.firebase_uid=q
   or (p.discoverable and p.username like replace(uname,'_','\_')||'%' escape '\'))
  order by p.username limit 25
 ) t;
 select exists(select 1 from public.bytequest_firebase_profiles f where f.project_id=split_part(owner_id,':',2) and (f.user_id=q or f.firebase_uid=q) and not exists(select 1 from public.bytequest_social_profiles p where p.owner_id=f.user_id)) into needs_profile;
 return jsonb_build_object('users',users,'needsProfile',needs_profile);
end $$;

create or replace function public.bytequest_set_creator(owner_id text,target_ref text,allow_creator boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare target_id uuid;candidates uuid[];q text:=trim(target_ref);begin
 if not exists(select 1 from public.bytequest_library_admins a where a.user_id=owner_id) then raise exception 'Library administrator access required' using errcode='42501';end if;
 if q is null or length(q) not between 2 and 180 or q !~ '^[A-Za-z0-9_:@-]+$' or allow_creator is null then raise exception 'Choose a valid creator account' using errcode='22023';end if;
 select array_agg(p.public_id) into candidates from public.bytequest_social_profiles p join public.bytequest_firebase_profiles f on f.user_id=p.owner_id
 where f.project_id=split_part(owner_id,':',2) and (p.public_id::text=lower(q) or p.username=lower(ltrim(q,'@')) or f.user_id=q or f.firebase_uid=q);
 if cardinality(candidates)>1 then raise exception 'Several accounts matched. Choose the intended profile from search' using errcode='22023';end if;
 target_id:=candidates[1];
 if target_id is null then raise exception 'No matching profile. Ask this learner to create a ByteQuest profile first' using errcode='22023';end if;
 return public.bytequest_community(owner_id,'role-set',jsonb_build_object('target',target_id,'creator',allow_creator));
end $$;

create or replace function public.bytequest_chat_signals(owner_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare me public.bytequest_social_profiles;receipts jsonb;presence jsonb;begin
 select * into me from public.bytequest_social_profiles p where p.owner_id=bytequest_chat_signals.owner_id;
 if me.owner_id is null then return '{"receipts":[],"presence":[]}'::jsonb;end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.through desc),'[]'::jsonb) into receipts from (
  select m.recipient as public_id,max(m.id) as through from public.bytequest_chat_messages m
  where m.sender=me.public_id and m.read_at is not null group by m.recipient order by max(m.id) desc limit 100
 ) t;
 select coalesce(jsonb_agg(jsonb_build_object('public_id',p.public_id,'presence',public.bytequest_presence_status(p.owner_id,owner_id)) order by p.public_id),'[]'::jsonb) into presence from (
  select p.owner_id,p.public_id from public.bytequest_social_profiles p where p.public_id<>me.public_id and p.discoverable and (
   exists(select 1 from public.bytequest_chat_messages m where m.sender=me.public_id and m.recipient=p.public_id or m.recipient=me.public_id and m.sender=p.public_id)
   or exists(select 1 from public.bytequest_follows a join public.bytequest_follows b on b.follower=a.following and b.following=a.follower where a.follower=me.public_id and a.following=p.public_id)
  ) order by p.public_id limit 100
 ) p;
 return jsonb_build_object('receipts',receipts,'presence',presence);
end $$;

create or replace function public.bytequest_chat_view(owner_id text,action text,data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare result jsonb;me uuid;peer uuid;begin
 result:=public.bytequest_chat(owner_id,action,data);
 if action in ('chat-list','chat-thread') then result:=result||jsonb_build_object('signals',public.bytequest_chat_signals(owner_id));end if;
 if action='chat-read' then
  select p.public_id into me from public.bytequest_social_profiles p where p.owner_id=bytequest_chat_view.owner_id;peer:=(data->>'target')::uuid;
  result:=result||jsonb_build_object('unread',(select count(*) from public.bytequest_chat_messages m where m.recipient=me and m.sender=peer and m.read_at is null),'totalUnread',(select count(*) from public.bytequest_chat_messages m where m.recipient=me and m.read_at is null));
 end if;
 return result;
end $$;

create or replace function public.bytequest_activity_feed(owner_id text,after_id bigint default null,announcements_after bigint default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare chat jsonb;updates jsonb;begin
 chat:=public.bytequest_live_events_read(owner_id,after_id);updates:=public.bytequest_updates(owner_id,announcements_after,false);
 return chat||jsonb_build_object('announcements',updates->'events','announcementCursor',updates->'cursor','updatesUnread',updates->'unread','chatSignals',public.bytequest_chat_signals(owner_id));
end $$;

create or replace function public.bytequest_profile_insights(viewer_id text,target text)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare p public.bytequest_social_profiles;payload jsonb;skills jsonb;languages jsonb;details jsonb;recent jsonb;begin
 select * into p from public.bytequest_social_profiles s where (s.public_id::text=target or s.username=lower(target)) and (s.discoverable or s.owner_id=viewer_id);
 if p.owner_id is null then raise exception 'Profile not found' using errcode='P0002';end if;
 select g.payload into payload from public.bytequest_firebase_progress g where g.user_id=p.owner_id;
 with solved as (
  select x.key as id from jsonb_each(case when jsonb_typeof(payload->'solved')='object' then payload->'solved' else '{}'::jsonb end) x
  where case when jsonb_typeof(x.value)='number' then (x.value::text)::numeric>0 and (x.value::text)::numeric<=extract(epoch from now())*1000 else false end
  union select s.problem_id from public.bytequest_submissions s where s.owner_id=p.owner_id and s.created_at<=now()
 ),topics as (
  select q.content->>'topic' as topic,count(*) as solved from solved s join public.bytequest_problems q on q.id=s.id and q.published where coalesce(q.content->>'topic','')<>'' group by q.content->>'topic'
 ) select coalesce(jsonb_agg(jsonb_build_object('name',topic,'solved',solved) order by solved desc,topic),'[]'::jsonb) into skills from topics;
 select coalesce(jsonb_agg(jsonb_build_object('language',t.language,'solved',t.solved) order by t.solved desc,t.language),'[]'::jsonb) into languages from (
  select s.language,count(distinct s.problem_id) as solved from public.bytequest_submissions s join public.bytequest_problems q on q.id=s.problem_id and q.published where s.owner_id=p.owner_id and s.created_at<=now() group by s.language
 ) t;
 with legacy as (
  select x.key as problem_id,case when jsonb_typeof(x.value)='number' then case when (x.value::text)::numeric>0 and (x.value::text)::numeric<=extract(epoch from now())*1000 then to_timestamp(((x.value::text)::numeric/1000)::double precision) end end as solved_at,null::text as language
  from jsonb_each(case when jsonb_typeof(payload->'solved')='object' then payload->'solved' else '{}'::jsonb end) x
 ),evidence as (
  select * from legacy where solved_at is not null union all select s.problem_id,s.created_at,s.language from public.bytequest_submissions s where s.owner_id=p.owner_id and s.created_at<=now()
 ),latest as (
  select distinct on(e.problem_id) e.problem_id,e.solved_at,e.language,q.content->>'title' as title,q.content->>'difficulty' as difficulty
  from evidence e join public.bytequest_problems q on q.id=e.problem_id and q.published order by e.problem_id,e.solved_at desc,e.language nulls last
 ),limited as (select * from latest order by solved_at desc,problem_id limit 25)
 select coalesce(jsonb_agg(jsonb_build_object('problemId',problem_id,'title',title,'difficulty',difficulty,'solvedAt',solved_at,'language',language) order by solved_at desc,problem_id),'[]'::jsonb) into recent from limited;
 select to_jsonb(d)-'owner_id'-'updated_at' into details from public.bytequest_profile_details d where d.owner_id=p.owner_id;
 return jsonb_build_object('details',coalesce(details,'{}'::jsonb),'skills',skills,'languages',languages,'recentSolves',recent);
end $$;

revoke all on function public.bytequest_creator_search(text,text),public.bytequest_set_creator(text,text,boolean),public.bytequest_chat_signals(text),public.bytequest_chat_view(text,text,jsonb),public.bytequest_activity_feed(text,bigint,bigint),public.bytequest_profile_insights(text,text) from public,anon,authenticated;
grant execute on function public.bytequest_creator_search(text,text),public.bytequest_set_creator(text,text,boolean),public.bytequest_chat_signals(text),public.bytequest_chat_view(text,text,jsonb),public.bytequest_activity_feed(text,bigint,bigint),public.bytequest_profile_insights(text,text) to service_role;
