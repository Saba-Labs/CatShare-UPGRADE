-- Add catalogue_id column to stores table
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS catalogue_id text;

-- Ensure the column is not null for existing rows (default to empty string if not set)
UPDATE public.stores
  SET catalogue_id = ''
  WHERE catalogue_id IS NULL;

-- Add the NOT NULL constraint
ALTER TABLE public.stores
  ALTER COLUMN catalogue_id SET NOT NULL;

-- Create index for efficient filtering by catalogue_id
CREATE INDEX IF NOT EXISTS stores_catalogue_id_idx
  ON public.stores (catalogue_id);
