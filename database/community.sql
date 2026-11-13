-- All access uses verified Firebase identity in the Edge Function.
create table public.bytequest_social_profiles (
 owner_id text primary key references public.bytequest_firebase_profiles(user_id) on delete cascade,
 public_id uuid not null default gen_random_uuid() unique,
 username text not null unique check (username ~ '^[a-z][a-z0-9_]{2,23}$'),
 display_name text not null check(length(display_name) between 1 and 60),
 bio text not null default '' check(length(bio)<=280),
 avatar_url text not null default '' check(length(avatar_url)<=1000 and (avatar_url='' or avatar_url ~ '^https://')),
 discoverable boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.bytequest_follows (
 follower uuid not null references public.bytequest_social_profiles(public_id) on delete cascade,
 following uuid not null references public.bytequest_social_profiles(public_id) on delete cascade,
 created_at timestamptz not null default now(), primary key(follower,following), check(follower<>following)
);
create index bytequest_following_idx on public.bytequest_follows(following);
create table public.bytequest_library_admins (
 user_id text primary key references public.bytequest_firebase_profiles(user_id) on delete cascade,
 created_at timestamptz not null default now()
);
create table public.bytequest_problem_private (
 problem_id text primary key references public.bytequest_problems(id) on delete cascade,
 hidden_tests jsonb not null default '[]' check(jsonb_typeof(hidden_tests)='array' and jsonb_array_length(hidden_tests)<=100 and pg_column_size(hidden_tests)<=250000)
);
create table public.bytequest_problem_history (
 problem_id text not null references public.bytequest_problems(id) on delete cascade,
 revision bigint not null, content jsonb not null, changed_by text not null,
 correction_note text not null, changed_at timestamptz not null default now(), primary key(problem_id,revision)
);
create table public.bytequest_announcements (
 id bigint generated always as identity primary key,
 problem_id text not null references public.bytequest_problems(id) on delete cascade,
 revision bigint not null, kind text not null check(kind in ('new','correction')),
 title text not null, message text not null, created_at timestamptz not null default now(), unique(problem_id,revision)
);
create table public.bytequest_notification_reads (
 user_id text primary key references public.bytequest_firebase_profiles(user_id) on delete cascade,
 last_read bigint not null default 0 check(last_read>=0)
);
do $$declare tab text;begin
 foreach tab in array array['bytequest_social_profiles','bytequest_follows','bytequest_library_admins','bytequest_problem_private','bytequest_problem_history','bytequest_announcements','bytequest_notification_reads'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated',tab);
 execute format('grant select,insert,update,delete on public.%I to service_role',tab);
 execute format('create policy api_only on public.%I for all to anon,authenticated using(false) with check(false)',tab);
 end loop;end $$;
grant usage,select on sequence public.bytequest_announcements_id_seq to service_role;

create function public.bytequest_community(owner_id text, action text, data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare me public.bytequest_social_profiles; target public.bytequest_social_profiles; rowdata jsonb; result jsonb; is_admin boolean; begin
 select * into me from public.bytequest_social_profiles s where s.owner_id=bytequest_community.owner_id;
 select exists(select 1 from public.bytequest_library_admins a where a.user_id=bytequest_community.owner_id) into is_admin;
 if action='profile-save' then
  insert into public.bytequest_social_profiles(owner_id,username,display_name,bio,avatar_url,discoverable)
  values(bytequest_community.owner_id,data->>'username',data->>'display_name',data->>'bio',data->>'avatar_url',(data->>'discoverable')::boolean)
  on conflict(owner_id) do update set username=excluded.username,display_name=excluded.display_name,bio=excluded.bio,avatar_url=excluded.avatar_url,discoverable=excluded.discoverable,updated_at=now();
  select * into me from public.bytequest_social_profiles s where s.owner_id=bytequest_community.owner_id;
 end if;
 if action in ('self','profile-save') then
  return jsonb_build_object('profile',case when me.owner_id is null then null else to_jsonb(me)-'owner_id' end,'admin',is_admin,'creator',is_admin or exists(select 1 from public.bytequest_firebase_editors e where e.user_id=bytequest_community.owner_id));
 elsif action='search' then
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from
   (select p.public_id,p.username,p.display_name,p.avatar_url from public.bytequest_social_profiles p where p.discoverable and
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
    select p.public_id,p.username,p.display_name,p.avatar_url from public.bytequest_follows f join public.bytequest_social_profiles p on p.public_id=case when action='followers' then f.follower else f.following end
    where (case when action='followers' then f.following else f.follower end)=target.public_id and p.discoverable order by p.username limit 100) s;
   return jsonb_build_object('users',result);
  end if;
  select jsonb_build_object('days',coalesce(g.payload->'days','[]'),'solved',coalesce((select count(*) from jsonb_object_keys(g.payload->'solved')),0)) into rowdata
   from public.bytequest_firebase_progress g where g.user_id=target.owner_id;
  return jsonb_build_object('profile',to_jsonb(target)-'owner_id','stats',coalesce(rowdata,'{"days":[],"solved":0}'),
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
end $$;
revoke all on function public.bytequest_community(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.bytequest_community(text,text,jsonb) to service_role;

create function public.bytequest_save_problem(owner_id text, problem jsonb, hidden_cases jsonb, publish boolean, position_number int, expected_revision bigint, correction text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare old public.bytequest_problems; next_revision bigint; kind text;begin
 if not exists(select 1 from public.bytequest_firebase_editors e where e.user_id=owner_id) and not exists(select 1 from public.bytequest_library_admins a where a.user_id=owner_id) then raise exception 'Creator access required' using errcode='42501';end if;
 -- Lock the ID even on a first insert; revision conflicts never overwrite another author.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(problem->>'id',0));
 select * into old from public.bytequest_problems p where p.id=problem->>'id' for update;
 if coalesce(old.revision,0)<>expected_revision then raise exception 'Revision conflict' using errcode='40001';end if;
 if old.published and publish and length(trim(correction))=0 then raise exception 'Describe the correction before publishing' using errcode='22023';end if;
 next_revision=expected_revision+1;
 insert into public.bytequest_problems(id,content,published,position,revision) values(problem->>'id',problem,publish,position_number,next_revision)
 on conflict(id) do update set content=excluded.content,published=excluded.published,position=excluded.position,revision=excluded.revision,updated_at=now();
 insert into public.bytequest_problem_private(problem_id,hidden_tests) values(problem->>'id',hidden_cases) on conflict(problem_id) do update set hidden_tests=excluded.hidden_tests;
 insert into public.bytequest_problem_history(problem_id,revision,content,changed_by,correction_note) values(problem->>'id',next_revision,problem,owner_id,correction);
 if publish then
  kind=case when old.published then 'correction' else 'new' end;
  insert into public.bytequest_announcements(problem_id,revision,kind,title,message) values(problem->>'id',next_revision,kind,problem->>'title',case when kind='new' then 'New bug spotted! Let’s squash it: '||(problem->>'title') else correction end);
 end if;
 return jsonb_build_object('id',problem->>'id','revision',next_revision);
end $$;
revoke all on function public.bytequest_save_problem(text,jsonb,jsonb,boolean,int,bigint,text) from public,anon,authenticated;
grant execute on function public.bytequest_save_problem(text,jsonb,jsonb,boolean,int,bigint,text) to service_role;
