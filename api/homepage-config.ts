import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;
  const { action, storeId, configId, layout, themeSettings, updatedBy } = req.body || req.query;

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

    if (method === 'PUT' && action === 'publish') {
      const { note } = req.body || {};
      const { data: existing, error: fetchError } = await supabase
        .from('store_homepage_configs')
        .select('layout, publish_history')
        .eq('id', configId)
        .single();
      if (fetchError) return res.status(400).json({ error: fetchError.message });

      const nextLayout = layout || existing?.layout || {};
      if (nextLayout && typeof nextLayout === 'object') {
        (nextLayout as any).websiteConfig = (nextLayout as any).websiteConfig || {};
        (nextLayout as any).websiteConfig.versioning = {
          ...((nextLayout as any).websiteConfig.versioning || {}),
          publishedAt: new Date().toISOString(),
          updatedBy: typeof updatedBy === 'string' ? updatedBy : null,
        };
      }

      const publishedAt = new Date().toISOString();
      const historyEntry = {
        id: `pub-${Date.now()}`,
        publishedAt,
        layout: nextLayout,
        note: typeof note === 'string' ? note : undefined,
      };
      const priorHistory = Array.isArray(existing?.publish_history) ? existing.publish_history : [];
      const publishHistory = [historyEntry, ...priorHistory].slice(0, 20);

      const { data, error } = await supabase
        .from('store_homepage_configs')
        .update({
          layout: nextLayout,
          theme_settings: themeSettings || (nextLayout as any)?.theme,
          published_layout: nextLayout,
          published_at: publishedAt,
          publish_history: publishHistory,
          updated_at: publishedAt,
        })
        .eq('id', configId)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (method === 'PUT' && action === 'unpublish') {
      const { data, error } = await supabase
        .from('store_homepage_configs')
        .update({
          published_layout: null,
          published_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', configId)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (method === 'PUT' && action === 'restore-version') {
      const { versionId, target } = req.body || {};
      if (!versionId) return res.status(400).json({ error: 'versionId is required' });

      const { data: existing, error: fetchError } = await supabase
        .from('store_homepage_configs')
        .select('publish_history')
        .eq('id', configId)
        .single();
      if (fetchError) return res.status(400).json({ error: fetchError.message });

      const history = Array.isArray(existing?.publish_history) ? existing.publish_history : [];
      const entry = history.find((h: { id?: string }) => h?.id === versionId);
      if (!entry?.layout) return res.status(404).json({ error: 'Version not found' });

      const now = new Date().toISOString();
      const restoreTarget = target === 'live' ? 'live' : 'draft';
      const patch =
        restoreTarget === 'live'
          ? {
              layout: entry.layout,
              published_layout: entry.layout,
              published_at: entry.publishedAt || now,
              theme_settings: entry.layout?.theme,
              updated_at: now,
            }
          : {
              layout: entry.layout,
              theme_settings: entry.layout?.theme,
              updated_at: now,
            };

      const { data, error } = await supabase
        .from('store_homepage_configs')
        .update(patch)
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
