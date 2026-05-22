-- Create store_homepage_configs table
CREATE TABLE IF NOT EXISTS public.store_homepage_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  layout JSONB NOT NULL DEFAULT '{"sections": [], "theme": {}}',
  theme_settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()),
  auto_saved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(store_id)
);

-- Create index on store_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_store_homepage_configs_store_id ON public.store_homepage_configs(store_id);

-- Enable RLS on the table
ALTER TABLE public.store_homepage_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now - adjust based on your auth requirements)
CREATE POLICY "Allow public read access" 
  ON public.store_homepage_configs 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow authenticated users to insert" 
  ON public.store_homepage_configs 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update" 
  ON public.store_homepage_configs 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Allow authenticated users to delete" 
  ON public.store_homepage_configs 
  FOR DELETE 
  USING (true);
