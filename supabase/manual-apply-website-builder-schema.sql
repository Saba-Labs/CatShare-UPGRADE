-- Run this in Supabase Dashboard → SQL Editor → Run
-- Fixes: "Could not find the 'website_mode_enabled' column of 'stores' in the schema cache"
-- Safe to run more than once (uses IF NOT EXISTS).

-- 1) Website mode toggle on stores
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS website_mode_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stores.website_mode_enabled
IS 'Enables full website runtime on /store/:slug routes.';

-- 2) Draft vs published homepage config
ALTER TABLE public.store_homepage_configs
ADD COLUMN IF NOT EXISTS published_layout jsonb,
ADD COLUMN IF NOT EXISTS published_at timestamptz;

COMMENT ON COLUMN public.store_homepage_configs.published_layout
IS 'Published website/homepage payload used by public storefront runtime.';

-- 3) Drop legacy publish version history (draft + published_layout only)
ALTER TABLE public.store_homepage_configs
DROP COLUMN IF EXISTS publish_history;

-- Refresh PostgREST schema cache (Supabase API)
NOTIFY pgrst, 'reload schema';
