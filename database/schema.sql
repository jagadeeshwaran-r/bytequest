-- ByteQuest: public learning content, private account progress, explicit editors.
create table public.bytequest_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.bytequest_problems (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,63}$'),
  content jsonb not null check (
    jsonb_typeof(content)='object'
    and content ? 'id' and content->>'id'=id
    and content ? 'tests' and jsonb_typeof(content->'tests')='array'
    and pg_column_size(content)<=300000
  ),
  published boolean not null default false,
  position integer not null default 0 check (position between 0 and 1000000),
  revision bigint not null default 1 check (revision>0),
  updated_at timestamptz not null default now()
);
create index bytequest_problems_published_order on public.bytequest_problems(position,id) where published;
create table public.bytequest_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"version":1}'::jsonb check (
    jsonb_typeof(payload)='object' and payload ? 'version' and payload->'version'='1'::jsonb and pg_column_size(payload)<=1000000
  ),
  revision bigint not null default 0 check (revision>=0),
  updated_at timestamptz not null default now()
);

alter table public.bytequest_admins enable row level security;
alter table public.bytequest_problems enable row level security;
alter table public.bytequest_progress enable row level security;
revoke all on public.bytequest_admins,public.bytequest_problems,public.bytequest_progress from public,anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.bytequest_admins to authenticated;
grant select on public.bytequest_problems to anon,authenticated;
grant insert,update on public.bytequest_problems to authenticated;
grant select,insert,update,delete on public.bytequest_progress to authenticated;

create policy admins_read_own_role on public.bytequest_admins for select to authenticated
  using (user_id=(select auth.uid()));
create policy visitors_read_published on public.bytequest_problems for select to anon
  using (published);
create policy learners_read_published_or_editor on public.bytequest_problems for select to authenticated
  using (published or exists(select 1 from public.bytequest_admins a where a.user_id=(select auth.uid())));
create policy editors_insert_problems on public.bytequest_problems for insert to authenticated
  with check (exists(select 1 from public.bytequest_admins a where a.user_id=(select auth.uid())));
create policy editors_update_problems on public.bytequest_problems for update to authenticated
  using (exists(select 1 from public.bytequest_admins a where a.user_id=(select auth.uid())))
  with check (exists(select 1 from public.bytequest_admins a where a.user_id=(select auth.uid())));
create policy progress_select_own on public.bytequest_progress for select to authenticated
  using (user_id=(select auth.uid()));
create policy progress_insert_own on public.bytequest_progress for insert to authenticated
  with check (user_id=(select auth.uid()));
create policy progress_update_own on public.bytequest_progress for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy progress_delete_own on public.bytequest_progress for delete to authenticated
  using (user_id=(select auth.uid()));

-- Optimistic concurrency: a stale device receives the latest record and merges
-- before retrying. This function runs as the caller and remains subject to RLS.
create function public.sync_bytequest_progress(new_payload jsonb,expected_revision bigint)
returns table(payload jsonb,revision bigint,applied boolean)
language plpgsql security invoker set search_path='' as $$
declare
  caller uuid := auth.uid();
  stored public.bytequest_progress%rowtype;
begin
  if caller is null then raise exception 'Sign in to sync progress' using errcode='42501'; end if;
  if new_payload is null or jsonb_typeof(new_payload)<>'object'
     or new_payload->'version' is distinct from '1'::jsonb
     or pg_column_size(new_payload)>1000000 or expected_revision is null or expected_revision<0 then
    raise exception 'Invalid progress data' using errcode='22023';
  end if;
  insert into public.bytequest_progress(user_id) values(caller) on conflict(user_id) do nothing;
  select p.* into stored from public.bytequest_progress p where p.user_id=caller for update;
  if stored.revision<>expected_revision then
    return query select stored.payload,stored.revision,false;
    return;
  end if;
  update public.bytequest_progress p set payload=new_payload,revision=p.revision+1,updated_at=now()
    where p.user_id=caller returning p.* into stored;
  return query select stored.payload,stored.revision,true;
end;
$$;
revoke execute on function public.sync_bytequest_progress(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.sync_bytequest_progress(jsonb,bigint) to authenticated;
