-- Run in Supabase SQL editor after stores exist.
-- Extends security-definer get_store_by_slug so anonymous clients receive
-- cataloguesDefinitionUserSettings + cataloguesDefinitionManaged (RLS-safe).

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
    coalesce(s.website_mode_enabled, false) as website_mode_enabled
  into rec
  from public.stores s
  where s.store_slug = p_slug
  limit 1;

  if rec is null then
    return null;
  end if;

  select u.currency, coalesce(u.data, '{}'::jsonb)
  into us_currency, us_data
  from public.user_settings u
  where u.user_id = rec.seller_user_id::uuid
  limit 1;

  eff_currency := coalesce(
    nullif(trim(upper(us_currency)), ''),
    'INR'
  );

  bp := coalesce(us_data -> 'businessProfile', '{}'::jsonb);

  eff_logo := coalesce(
    nullif(trim(bp ->> 'logoUrl'), ''),
    ''
  );

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
    'homepageEnabled', coalesce(rec.homepage_enabled, true),
    'websiteModeEnabled', coalesce(rec.website_mode_enabled, false),
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
