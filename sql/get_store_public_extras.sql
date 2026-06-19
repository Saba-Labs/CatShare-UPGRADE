-- Public storefront extras: password gate flag + marketing settings (security definer).
-- Run in Supabase SQL editor when catalog store is not showing announcement / password gate.

alter table public.stores
  add column if not exists marketing_settings jsonb not null default '{
    "version": 1,
    "seo": {"metaTitle":"","metaDescription":"","keywords":"","ogImageUrl":""},
    "tracking": {"googleSearchConsoleVerification":""},
    "promotions": {
      "announcementBarEnabled": false,
      "announcementText": "Free shipping on orders over ₹999",
      "announcementLink": ""
    }
  }'::jsonb;

create or replace function public.get_store_public_extras(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sec jsonb;
  mkt jsonb;
  pwd_protected boolean;
declare
  found boolean := false;
begin
  select
    true,
    coalesce(s.security_settings, '{}'::jsonb),
    coalesce(s.marketing_settings, '{}'::jsonb)
  into found, sec, mkt
  from public.stores s
  where lower(s.store_slug) = lower(trim(p_slug))
  limit 1;

  if not coalesce(found, false) then
    return null;
  end if;

  pwd_protected := coalesce(sec ->> 'passwordProtected', 'false') = 'true'
    and length(trim(coalesce(sec ->> 'storePassword', ''))) > 0;

  return jsonb_build_object(
    'passwordProtected', pwd_protected,
    'marketingSettings', mkt,
    'securitySettings', sec
  );
end;
$$;

revoke all on function public.get_store_public_extras(text) from public;
grant execute on function public.get_store_public_extras(text) to anon, authenticated;
