import { getSupabaseClient } from '../supabaseClient';

export interface HomepageProduct {
  id: string;
  name: string;
  image?: string;
  price?: number;
  category?: string;
  description?: string;
  featured?: boolean;
}

export interface HomepageCategory {
  id: string;
  name: string;
  image?: string;
  itemCount?: number;
}

export async function fetchStoreProducts(
  storeId: string,
  limit: number = 50,
  offset: number = 0
): Promise<HomepageProduct[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('products')
    .select('id, name, main_image_url, price, category, description, featured')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    image: p.main_image_url,
    price: p.price,
    category: p.category,
    description: p.description,
    featured: p.featured,
  }));
}

export async function fetchStoreCategories(
  storeId: string
): Promise<HomepageCategory[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, image_url, item_count')
    .eq('store_id', storeId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return (data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    image: c.image_url,
    itemCount: c.item_count,
  }));
}

export async function searchStoreProducts(
  storeId: string,
  searchQuery: string,
  categoryFilter?: string
): Promise<HomepageProduct[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('products')
    .select('id, name, main_image_url, price, category, description, featured')
    .eq('store_id', storeId)
    .ilike('name', `%${searchQuery}%`);

  if (categoryFilter) {
    query = query.eq('category', categoryFilter);
  }

  const { data, error } = await query.order('name', { ascending: true }).limit(50);

  if (error) {
    console.error('Error searching products:', error);
    return [];
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    image: p.main_image_url,
    price: p.price,
    category: p.category,
    description: p.description,
    featured: p.featured,
  }));
}

export async function getProductById(productId: string): Promise<HomepageProduct | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('products')
    .select('id, name, main_image_url, price, category, description, featured')
    .eq('id', productId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching product:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    image: data.main_image_url,
    price: data.price,
    category: data.category,
    description: data.description,
    featured: data.featured,
  };
}

export async function getCategoryById(categoryId: string): Promise<HomepageCategory | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, image_url, item_count')
    .eq('id', categoryId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching category:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    image: data.image_url,
    itemCount: data.item_count,
  };
}

export async function getMultipleProducts(productIds: string[]): Promise<HomepageProduct[]> {
  if (productIds.length === 0) return [];

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('products')
    .select('id, name, main_image_url, price, category, description, featured')
    .in('id', productIds);

  if (error) {
    console.error('Error fetching multiple products:', error);
    return [];
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    image: p.main_image_url,
    price: p.price,
    category: p.category,
    description: p.description,
    featured: p.featured,
  }));
}

export async function getMultipleCategories(categoryIds: string[]): Promise<HomepageCategory[]> {
  if (categoryIds.length === 0) return [];

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, image_url, item_count')
    .in('id', categoryIds);

  if (error) {
    console.error('Error fetching multiple categories:', error);
    return [];
  }

  return (data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    image: c.image_url,
    itemCount: c.item_count,
  }));
}
