-- Apply only after the Firebase, community, authorship and presence schemas.
-- The hosted project already has this change. This file also documents a fresh install.
create table if not exists public.bytequest_account_deletions (
 owner_hash text primary key,
 requested_at timestamptz not null default now(),
 completed_at timestamptz,
 avatar_path text not null default ''
);
alter table public.bytequest_account_deletions enable row level security;
revoke all on public.bytequest_account_deletions from public,anon,authenticated;
grant select,insert,update on public.bytequest_account_deletions to service_role;

CREATE OR REPLACE FUNCTION public.bytequest_touch_active_account(owner_id text, firebase_project text, firebase_subject text, account_email text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_id,0));
 if exists(select 1 from public.bytequest_account_deletions d where d.owner_hash=encode(sha256(convert_to(owner_id,'UTF8')),'hex')) then raise exception 'This account was removed. Sign out to finish.' using errcode='28000';end if;
 perform public.touch_bytequest_firebase_account(owner_id,firebase_project,firebase_subject,account_email);
end $function$;

CREATE OR REPLACE FUNCTION public.bytequest_begin_account_deletion(owner_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare hashed text:=encode(sha256(convert_to(owner_id,'UTF8')),'hex');photo text;job public.bytequest_account_deletions;begin
 perform pg_advisory_xact_lock(hashtextextended(owner_id,0));
 select * into job from public.bytequest_account_deletions d where d.owner_hash=hashed;
 if found then return jsonb_build_object('avatar_path',job.avatar_path,'completed',job.completed_at is not null);end if;
 select p.avatar_path into photo from public.bytequest_social_profiles p where p.owner_id=bytequest_begin_account_deletion.owner_id;
 insert into public.bytequest_account_deletions(owner_hash,avatar_path) values(hashed,coalesce(photo,''));
 delete from public.bytequest_problems q using public.bytequest_problem_authors a where a.problem_id=q.id and a.user_id=bytequest_begin_account_deletion.owner_id and not q.published;
 update public.bytequest_problem_history h set changed_by='Deleted account' where h.changed_by=bytequest_begin_account_deletion.owner_id;
 delete from public.bytequest_firebase_profiles p where p.user_id=bytequest_begin_account_deletion.owner_id;
 return jsonb_build_object('avatar_path',coalesce(photo,''),'completed',false);
end $function$;

CREATE OR REPLACE FUNCTION public.bytequest_finish_account_deletion(owner_id text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 update public.bytequest_account_deletions d set completed_at=coalesce(d.completed_at,now()),avatar_path='' where d.owner_hash=encode(sha256(convert_to(owner_id,'UTF8')),'hex');
$function$;


revoke all on function public.bytequest_touch_active_account(text,text,text,text) from public,anon,authenticated;
grant execute on function public.bytequest_touch_active_account(text,text,text,text) to service_role;

revoke all on function public.bytequest_begin_account_deletion(text) from public,anon,authenticated;
grant execute on function public.bytequest_begin_account_deletion(text) to service_role;

revoke all on function public.bytequest_finish_account_deletion(text) from public,anon,authenticated;
grant execute on function public.bytequest_finish_account_deletion(text) to service_role;
