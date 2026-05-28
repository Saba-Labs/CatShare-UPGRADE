import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { collectSitemapPaths } from '../src/utils/storefrontSeo';
import { buildStorefrontUrl } from '../src/utils/storefrontDomain';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = String(req.query.slug || '').trim().toLowerCase();
  if (!slug) {
    return res.status(400).send('Missing slug query parameter');
  }

  try {
    const { data: storeRow, error: storeError } = await supabase
      .from('stores')
      .select('id, store_slug, seller_user_id, website_mode_enabled')
      .eq('store_slug', slug)
      .maybeSingle();

    if (storeError || !storeRow?.id) {
      return res.status(404).send('Store not found');
    }

    if (storeRow.website_mode_enabled !== true) {
      return res.status(404).send('Website mode not enabled');
    }

    const { data: configRow } = await supabase
      .from('store_homepage_configs')
      .select('published_layout, layout')
      .eq('store_id', storeRow.id)
      .maybeSingle();

    const layout = configRow?.published_layout || configRow?.layout || null;

    const sellerId = storeRow.seller_user_id;
    const { data: products } = sellerId
      ? await supabase.from('products').select('id, name').eq('user_id', sellerId).limit(500)
      : { data: [] };

    const productList = (products || []).map((p) => ({ id: p.id, name: p.name || p.id }));
    const paths = collectSitemapPaths(slug, layout as any, productList as any, false);
    const base = buildStorefrontUrl(slug).replace(/\/$/, '');

    const urls = paths
      .map((path) => {
        const loc = path === `/store/${slug}` || path === `/store/${slug}/`
          ? `${base}/`
          : `${base}${path.replace(`/store/${slug}`, '')}`;
        return `  <url><loc>${escapeXml(loc)}</loc><changefreq>weekly</changefreq><priority>${path.includes('/products/') ? '0.8' : '0.9'}</priority></url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).send(xml);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).send(message);
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
