import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../lib/apiCors.js';
import { getSupabaseUserFromRequest } from '../lib/supabaseAuthRequest.js';
import { validateStoreHostname } from '../lib/normalizeStoreHostname.js';
import {
  addProjectDomain,
  getDomainConfiguration,
  getProjectDomain,
  isVercelDomainsConfigured,
  removeProjectDomain,
  type VercelDomainVerificationRecord,
} from '../lib/vercelDomains.js';
import { mergeDnsRecordsForDisplay } from '../lib/vercelDnsInstructions.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

type DomainStatus = 'pending' | 'active' | 'error' | null;

function platformRootHost(): string {
  return String(process.env.STOREFRONT_ROOT_DOMAIN || 'catshare.app')
    .trim()
    .toLowerCase();
}

function mapStatus(verified: boolean, hasError: boolean): DomainStatus {
  if (hasError) return 'error';
  return verified ? 'active' : 'pending';
}

async function resolveDnsRecordsForHostname(
  hostname: string,
  apiVerification: VercelDomainVerificationRecord[] | undefined
): Promise<VercelDomainVerificationRecord[]> {
  let config = null;
  try {
    config = await getDomainConfiguration(hostname);
  } catch (e) {
    console.error('store-custom-domain: getDomainConfiguration', e);
  }
  return mergeDnsRecordsForDisplay(hostname, apiVerification, config);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'GET, POST, DELETE, OPTIONS')) return;

  const auth = await getSupabaseUserFromRequest(req.headers.authorization);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error });
  }

  if (!isVercelDomainsConfigured()) {
    return res.status(503).json({
      error:
        'Custom domains are not configured on the server. Set VERCEL_API_TOKEN and VERCEL_PROJECT_ID in Vercel environment variables.',
      configured: false,
    });
  }

  const userId = auth.userId;

  try {
    const { data: storeRow, error: storeErr } = await supabase
      .from('stores')
      .select('id, store_slug, custom_hostname, custom_domain_status')
      .eq('seller_user_id', userId)
      .maybeSingle();

    if (storeErr) {
      console.error('store-custom-domain: load store', storeErr);
      return res.status(500).json({ error: 'Could not load your store' });
    }
    if (!storeRow?.id) {
      return res.status(404).json({ error: 'Create your store first.' });
    }

    if (req.method === 'GET') {
      const hostname =
        typeof storeRow.custom_hostname === 'string' ? storeRow.custom_hostname.trim() : '';
      if (!hostname) {
        return res.status(200).json({
          configured: true,
          hostname: null,
          status: null,
          verified: false,
          verification: [] as VercelDomainVerificationRecord[],
          storeSlug: storeRow.store_slug,
        });
      }

      let vercelDomain = null;
      try {
        vercelDomain = await getProjectDomain(hostname);
      } catch (e) {
        console.error('store-custom-domain: getProjectDomain', e);
      }

      const verified = vercelDomain?.verified === true;
      const status = mapStatus(verified, vercelDomain?.error != null && !verified);
      const dbStatus = (storeRow.custom_domain_status as DomainStatus) || null;

      if (status !== dbStatus) {
        await supabase
          .from('stores')
          .update({
            custom_domain_status: status,
            custom_domain_updated_at: new Date().toISOString(),
          })
          .eq('id', storeRow.id);
      }

      const dnsRecords = await resolveDnsRecordsForHostname(
        hostname,
        vercelDomain?.verification
      );

      return res.status(200).json({
        configured: true,
        hostname,
        status,
        verified,
        verification: vercelDomain?.verification || [],
        dnsRecords,
        vercelError: vercelDomain?.error?.message || null,
        storeSlug: storeRow.store_slug,
        publicUrl: verified ? `https://${hostname}` : null,
      });
    }

    if (req.method === 'POST') {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const action = String(body.action || 'connect').trim().toLowerCase();

      if (action === 'refresh') {
        const hostname =
          typeof storeRow.custom_hostname === 'string' ? storeRow.custom_hostname.trim() : '';
        if (!hostname) {
          return res.status(400).json({ error: 'No custom domain connected yet.' });
        }
        const vercelDomain = await getProjectDomain(hostname);
        if (!vercelDomain) {
          return res.status(404).json({
            error: 'Domain not found on Vercel. Connect it again from this page.',
          });
        }
        const verified = vercelDomain.verified === true;
        const status = mapStatus(verified, vercelDomain.error != null && !verified);
        await supabase
          .from('stores')
          .update({
            custom_domain_status: status,
            custom_domain_updated_at: new Date().toISOString(),
          })
          .eq('id', storeRow.id);

        const dnsRecords = await resolveDnsRecordsForHostname(
          hostname,
          vercelDomain.verification
        );

        return res.status(200).json({
          hostname,
          status,
          verified,
          verification: vercelDomain.verification || [],
          dnsRecords,
          vercelError: vercelDomain.error?.message || null,
          publicUrl: verified ? `https://${hostname}` : null,
        });
      }

      if (action !== 'connect') {
        return res.status(400).json({ error: 'Unknown action' });
      }

      const hostnameInput = String(body.hostname || '').trim();
      const validation = validateStoreHostname(hostnameInput, {
        platformRootHost: platformRootHost(),
      });
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }
      const hostname = validation.hostname;

      const { data: taken } = await supabase
        .from('stores')
        .select('id')
        .eq('custom_hostname', hostname)
        .neq('seller_user_id', userId)
        .maybeSingle();

      if (taken?.id) {
        return res.status(409).json({ error: 'This domain is already connected to another store.' });
      }

      let vercelDomain;
      try {
        vercelDomain = await addProjectDomain(hostname);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not add domain to Vercel';
        if (/already|exists|in use/i.test(msg)) {
          const existing = await getProjectDomain(hostname);
          if (existing) vercelDomain = existing;
          else return res.status(409).json({ error: msg });
        } else {
          return res.status(502).json({ error: msg });
        }
      }

      const verified = vercelDomain.verified === true;
      const status = mapStatus(verified, vercelDomain.error != null && !verified);

      const { error: updateErr } = await supabase
        .from('stores')
        .update({
          custom_hostname: hostname,
          custom_domain_status: status,
          custom_domain_updated_at: new Date().toISOString(),
        })
        .eq('id', storeRow.id);

      if (updateErr) {
        console.error('store-custom-domain: update store', updateErr);
        return res.status(500).json({ error: 'Domain added on Vercel but could not save to database.' });
      }

      const dnsRecords = await resolveDnsRecordsForHostname(
        hostname,
        vercelDomain.verification
      );

      return res.status(200).json({
        hostname,
        status,
        verified,
        verification: vercelDomain.verification || [],
        dnsRecords,
        vercelError: vercelDomain.error?.message || null,
        publicUrl: verified ? `https://${hostname}` : null,
      });
    }

    if (req.method === 'DELETE') {
      const hostname =
        typeof storeRow.custom_hostname === 'string' ? storeRow.custom_hostname.trim() : '';
      if (hostname) {
        try {
          await removeProjectDomain(hostname);
        } catch (e) {
          console.error('store-custom-domain: removeProjectDomain', e);
        }
      }

      await supabase
        .from('stores')
        .update({
          custom_hostname: null,
          custom_domain_status: null,
          custom_domain_updated_at: new Date().toISOString(),
        })
        .eq('id', storeRow.id);

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('store-custom-domain:', e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Custom domain request failed',
    });
  }
}
