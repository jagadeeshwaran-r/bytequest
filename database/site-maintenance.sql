-- ByteQuest site maintenance, staged as a DISABLED draft. Migration is safe
-- to apply before deploying the matching Edge Function/frontend.
-- 20 November 2026, 01:00–02:00 IST = 19 November 2026, 19:30–20:30 UTC.
begin;
create table if not exists public.bytequest_site_maintenance (
  key text primary key default 'site' check (key='site'),
  enabled boolean not null default false,
  mode text not null default 'scheduled' check (mode in ('scheduled','on')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  message text not null check (char_length(message) between 1 and 280),
  revision bigint not null default 0 check (revision>=0),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint maintenance_window_order check (ends_at>starts_at)
);
alter table public.bytequest_site_maintenance enable row level security;
revoke all on public.bytequest_site_maintenance from public,anon,authenticated;
grant select,update on public.bytequest_site_maintenance to service_role;
drop policy if exists bytequest_maintenance_service_role on public.bytequest_site_maintenance;
create policy bytequest_maintenance_service_role
  on public.bytequest_site_maintenance for all to service_role
  using(true) with check(true);

-- Never overwrite a schedule already edited by an administrator.
-- enabled=false means the example schedule will NOT activate automatically.
insert into public.bytequest_site_maintenance
  (key,enabled,mode,starts_at,ends_at,message,revision)
values (
  'site',false,'scheduled',
  '2026-11-19 19:30:00+00'::timestamptz,
  '2026-11-19 20:30:00+00'::timestamptz,
  'We''re upgrading ByteQuest to make your coding experience better.',
  0
) on conflict(key) do nothing;
commit;

-- Verify (read-only): SELECT enabled,mode,starts_at,ends_at,revision
-- FROM public.bytequest_site_maintenance WHERE key='site';
-- Expected on a fresh install: enabled=false, mode='scheduled', revision=0.
