import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;
  const { action, storeId, configId, layout, themeSettings } = req.body || req.query;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (method === 'GET' || (method === 'POST' && action === 'get')) {
      // Get homepage config
      const { data, error } = await supabase
        .from('store_homepage_configs')
        .select('*')
        .eq('store_id', storeId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(200).json({ data: null });
        }
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ data });
    }

    if (method === 'POST' && action === 'create') {
      // Create new config
      const { data, error } = await supabase
        .from('store_homepage_configs')
        .insert({
          store_id: storeId,
          layout,
          theme_settings: themeSettings,
        })
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (method === 'PUT' && action === 'update') {
      // Update config
      const { data, error } = await supabase
        .from('store_homepage_configs')
        .update({
          layout,
          theme_settings: themeSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', configId)
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (method === 'DELETE') {
      // Delete config
      const { error } = await supabase
        .from('store_homepage_configs')
        .delete()
        .eq('id', configId);

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
}
