create table public.bytequest_judge_limits(user_id text primary key references public.bytequest_firebase_profiles(user_id) on delete cascade,last_submission timestamptz not null default now());
alter table public.bytequest_judge_limits enable row level security;
revoke all on public.bytequest_judge_limits from public,anon,authenticated;
grant select,insert,update,delete on public.bytequest_judge_limits to service_role;
create policy api_only on public.bytequest_judge_limits for all to anon,authenticated using(false) with check(false);
create function public.bytequest_claim_judge(owner_id text) returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;begin
 insert into public.bytequest_judge_limits(user_id) values(owner_id) on conflict(user_id) do update set last_submission=now() where bytequest_judge_limits.last_submission<now()-interval '30 seconds';
 get diagnostics changed=row_count;return changed=1;
end $$;
revoke all on function public.bytequest_claim_judge(text) from public,anon,authenticated;
grant execute on function public.bytequest_claim_judge(text) to service_role;
