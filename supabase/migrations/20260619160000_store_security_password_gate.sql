-- Simplified store security: password gate + verify RPC for public storefront.

alter table public.stores
  alter column security_settings set default '{
    "version": 1,
    "passwordProtected": false,
    "storePassword": ""
  }'::jsonb;

comment on column public.stores.security_settings is 'Store password gate for public storefront';

create or replace function public.get_store_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  us_currency text;
  us_data jsonb;
  eff_currency text;
  eff_logo text;
  bp jsonb;
  sec jsonb;
  pwd_protected boolean;
begin
  select
    s.id,
    s.seller_user_id,
    s.store_slug,
    s.catalogue_id,
    s.created_at,
    coalesce(s.is_live, true) as is_live,
    s.store_whatsapp,
    coalesce(s.homepage_enabled, true) as homepage_enabled,
    coalesce(s.website_mode_enabled, false) as website_mode_enabled,
    coalesce(s.security_settings, '{}'::jsonb) as security_settings
  into rec
  from public.stores s
  where lower(s.store_slug) = lower(trim(p_slug))
  limit 1;

  if rec is null then
    return null;
  end if;

  sec := coalesce(rec.security_settings, '{}'::jsonb);
  pwd_protected := coalesce(sec ->> 'passwordProtected', 'false') = 'true'
    and length(trim(coalesce(sec ->> 'storePassword', ''))) > 0;

  select u.currency, coalesce(u.data, '{}'::jsonb)
  into us_currency, us_data
  from public.user_settings u
  where u.user_id = rec.seller_user_id::uuid
  limit 1;

  eff_currency := coalesce(nullif(trim(upper(us_currency)), ''), 'INR');
  bp := coalesce(us_data -> 'businessProfile', '{}'::jsonb);
  eff_logo := coalesce(nullif(trim(bp ->> 'logoUrl'), ''), '');

  return jsonb_build_object(
    'storeId', rec.id,
    'sellerUserId', rec.seller_user_id,
    'storeSlug', rec.store_slug,
    'catalogueId', rec.catalogue_id,
    'sellerCurrencyCode', eff_currency,
    'sellerLogoUrl', eff_logo,
    'sellerBusinessName', nullif(trim(bp ->> 'businessName'), ''),
    'sellerAbout', nullif(trim(bp ->> 'about'), ''),
    'sellerPhone', nullif(trim(bp ->> 'phone'), ''),
    'sellerEmail', nullif(trim(bp ->> 'email'), ''),
    'sellerWebsite', nullif(trim(bp ->> 'website'), ''),
    'sellerAddress', nullif(trim(bp ->> 'address'), ''),
    'sellerDescription', nullif(trim(bp ->> 'description'), ''),
    'createdAt', rec.created_at,
    'isLive', coalesce(rec.is_live, true),
    'whatsapp', nullif(trim(rec.store_whatsapp), ''),
    'homepageEnabled', coalesce(rec.website_mode_enabled, false) and coalesce(rec.homepage_enabled, true),
    'websiteModeEnabled', coalesce(rec.website_mode_enabled, false),
    'passwordProtected', pwd_protected,
    'cataloguesDefinitionUserSettings', us_data -> 'cataloguesDefinition',
    'cataloguesDefinitionManaged', (
      select cd.data
      from public.catalogues_definition cd
      where cd.user_id = rec.seller_user_id::uuid
      limit 1
    )
  );
end;
$$;

revoke all on function public.get_store_by_slug(text) from public;
grant execute on function public.get_store_by_slug(text) to anon, authenticated;

create or replace function public.verify_store_password(p_slug text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  sec jsonb;
  expected text;
begin
  select coalesce(s.security_settings, '{}'::jsonb)
  into sec
  from public.stores s
  where lower(s.store_slug) = lower(trim(p_slug))
  limit 1;

  if sec is null then
    return false;
  end if;

  if coalesce(sec ->> 'passwordProtected', 'false') <> 'true' then
    return true;
  end if;

  expected := coalesce(sec ->> 'storePassword', '');
  if length(trim(expected)) = 0 then
    return false;
  end if;

  return trim(coalesce(p_password, '')) = trim(expected);
end;
$$;

revoke all on function public.verify_store_password(text, text) from public;
grant execute on function public.verify_store_password(text, text) to anon, authenticated;
