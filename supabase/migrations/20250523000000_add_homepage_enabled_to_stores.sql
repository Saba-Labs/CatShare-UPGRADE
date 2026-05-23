-- Add homepage_enabled column to stores table
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS homepage_enabled BOOLEAN NOT NULL DEFAULT true;

-- Create index for efficient filtering by homepage_enabled status
CREATE INDEX IF NOT EXISTS stores_homepage_enabled_idx
  ON public.stores (homepage_enabled);
