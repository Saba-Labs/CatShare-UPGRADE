-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  category_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, product_id)
);

-- Create deleted_products table
CREATE TABLE IF NOT EXISTS deleted_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category_id)
);

-- Create catalogues_definition table
CREATE TABLE IF NOT EXISTS catalogues_definition (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create fields_definition table
CREATE TABLE IF NOT EXISTS fields_definition (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  theme TEXT,
  watermark_enabled BOOLEAN,
  watermark_text TEXT,
  currency TEXT,
  price_units JSONB,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id_product_id ON products(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id_updated_at ON products(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_deleted_products_user_id ON deleted_products(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_products_user_id_product_id ON deleted_products(user_id, product_id);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id_category_id ON categories(user_id, category_id);

CREATE INDEX IF NOT EXISTS idx_catalogues_definition_user_id ON catalogues_definition(user_id);
CREATE INDEX IF NOT EXISTS idx_fields_definition_user_id ON fields_definition(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogues_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - Products table
CREATE POLICY "Users can view their own products" ON products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products" ON products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products" ON products
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products" ON products
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies - Deleted products table
CREATE POLICY "Users can view their own deleted products" ON deleted_products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert deleted products" ON deleted_products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their deleted products" ON deleted_products
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete deleted product records" ON deleted_products
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies - Categories table
CREATE POLICY "Users can view their own categories" ON categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies - Catalogues definition table
CREATE POLICY "Users can view their own catalogues definition" ON catalogues_definition
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert catalogues definition" ON catalogues_definition
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their catalogues definition" ON catalogues_definition
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their catalogues definition" ON catalogues_definition
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies - Fields definition table
CREATE POLICY "Users can view their own fields definition" ON fields_definition
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert fields definition" ON fields_definition
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their fields definition" ON fields_definition
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their fields definition" ON fields_definition
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies - User settings table
CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);
