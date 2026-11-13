-- Additive Firebase account storage. Existing Supabase-auth records are retained.
-- Only the verified-token Edge Function can access these tables.
create table public.bytequest_firebase_profiles (
  user_id text primary key check (length(user_id) between 12 and 200),
  project_id text not null,
  firebase_uid text not null check (length(firebase_uid) between 1 and 128),
  email text not null check (length(email)<=320),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(project_id,firebase_uid),
  check(user_id='firebase:'||project_id||':'||firebase_uid)
);
create table public.bytequest_firebase_progress (
  user_id text primary key references public.bytequest_firebase_profiles(user_id) on delete cascade,
  payload jsonb not null default '{"version":1}'::jsonb check (
    jsonb_typeof(payload)='object' and payload->'version'='1'::jsonb and payload ? 'version' and pg_column_size(payload)<=1000000
  ),
  revision bigint not null default 0 check (revision>=0),
  updated_at timestamptz not null default now()
);
create table public.bytequest_firebase_editors (
  user_id text primary key references public.bytequest_firebase_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.bytequest_firebase_profiles enable row level security;
alter table public.bytequest_firebase_progress enable row level security;
alter table public.bytequest_firebase_editors enable row level security;
revoke all on public.bytequest_firebase_profiles,public.bytequest_firebase_progress,public.bytequest_firebase_editors from public,anon,authenticated;
grant select,insert,update,delete on public.bytequest_firebase_profiles,public.bytequest_firebase_progress,public.bytequest_firebase_editors to service_role;
create policy firebase_profiles_block_client on public.bytequest_firebase_profiles for all to anon,authenticated using(false) with check(false);
create policy firebase_progress_block_client on public.bytequest_firebase_progress for all to anon,authenticated using(false) with check(false);
create policy firebase_editors_block_client on public.bytequest_firebase_editors for all to anon,authenticated using(false) with check(false);

create function public.touch_bytequest_firebase_account(owner_id text,firebase_project text,firebase_subject text,account_email text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  insert into public.bytequest_firebase_profiles(user_id,project_id,firebase_uid,email)
    values(owner_id,firebase_project,firebase_subject,account_email)
    on conflict(user_id) do update set email=excluded.email,last_seen_at=now();
end;
$$;
revoke execute on function public.touch_bytequest_firebase_account(text,text,text,text) from public,anon,authenticated;
grant execute on function public.touch_bytequest_firebase_account(text,text,text,text) to service_role;

-- The owner_id is supplied exclusively by the backend after Firebase signature,
-- issuer, audience, expiry and provider checks. Clients cannot execute this RPC.
create function public.sync_bytequest_firebase_progress(owner_id text,new_payload jsonb,expected_revision bigint)
returns table(payload jsonb,revision bigint,applied boolean)
language plpgsql security invoker set search_path='' as $$
declare stored public.bytequest_firebase_progress%rowtype;
begin
  if owner_id is null or length(owner_id)>200 or owner_id not like 'firebase:%' then
    raise exception 'Invalid account identity' using errcode='22023';
  end if;
  if new_payload is null or jsonb_typeof(new_payload)<>'object'
     or new_payload->'version' is distinct from '1'::jsonb or pg_column_size(new_payload)>1000000
     or expected_revision is null or expected_revision<0 or expected_revision>9007199254740991 then
    raise exception 'Invalid progress data' using errcode='22023';
  end if;
  insert into public.bytequest_firebase_progress(user_id) values(owner_id) on conflict(user_id) do nothing;
  select p.* into stored from public.bytequest_firebase_progress p where p.user_id=owner_id for update;
  if stored.revision<>expected_revision then return query select stored.payload,stored.revision,false;return;end if;
  update public.bytequest_firebase_progress p set payload=new_payload,revision=p.revision+1,updated_at=now()
    where p.user_id=owner_id returning p.* into stored;
  return query select stored.payload,stored.revision,true;
end;
$$;
revoke execute on function public.sync_bytequest_firebase_progress(text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.sync_bytequest_firebase_progress(text,jsonb,bigint) to service_role;
