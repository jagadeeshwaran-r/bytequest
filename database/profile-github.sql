-- Optional GitHub handle, preserved across older clients that do not send it.
-- Run once after database/profile-inbox.sql.
alter table public.bytequest_profile_details
 add column if not exists github_url text not null default ''
 constraint bytequest_profile_details_github_url_check
 check(length(github_url)<=1000 and (github_url='' or github_url ~ '^https://github[.]com/[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?/?$'));

create or replace function public.bytequest_save_profile(owner_id text,data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare result jsonb;begin
 result:=public.bytequest_community(owner_id,'profile-save',data);
 if data ?| array['organization_type','organization_name','organization_url','linkedin_url','github_url'] then
  insert into public.bytequest_profile_details(owner_id,organization_type,organization_name,organization_url,linkedin_url,github_url)
  values(owner_id,coalesce(data->>'organization_type',''),coalesce(data->>'organization_name',''),coalesce(data->>'organization_url',''),coalesce(data->>'linkedin_url',''),coalesce(data->>'github_url',''))
  on conflict(owner_id) do update set
   organization_type=excluded.organization_type,
   organization_name=excluded.organization_name,
   organization_url=excluded.organization_url,
   linkedin_url=excluded.linkedin_url,
   github_url=case when data ? 'github_url' then excluded.github_url else bytequest_profile_details.github_url end,
   updated_at=now();
 end if;
 return result;
end $$;
