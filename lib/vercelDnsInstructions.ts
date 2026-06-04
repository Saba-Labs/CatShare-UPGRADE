/**
 * Build DNS setup rows for sellers when Vercel returns no verification[] (common once verified).
 */
import type { VercelDomainVerificationRecord } from './vercelDomains.js';

export type VercelDomainConfigResponse = {
  misconfigured?: boolean;
  configuredBy?: string | null;
  recommendedCNAME?: Array<{ rank?: number; value?: string }>;
  recommendedIPv4?: Array<Array<string>>;
};

function apexHostLabel(hostname: string): string {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return '@';
  return parts[0];
}

/** True for `example.com`; false for `shop.example.com`. */
export function isApexHostname(hostname: string): boolean {
  const parts = hostname.split('.').filter(Boolean);
  return parts.length === 2;
}

export function recordsFromDomainConfig(
  hostname: string,
  config: VercelDomainConfigResponse | null | undefined
): VercelDomainVerificationRecord[] {
  if (!config) return [];

  const out: VercelDomainVerificationRecord[] = [];
  const cnames = config.recommendedCNAME ?? [];
  for (const entry of cnames) {
    const value = String(entry?.value ?? '').trim();
    if (!value) continue;
    if (isApexHostname(hostname)) {
      out.push({
        type: 'CNAME',
        domain: 'www',
        value,
        reason: 'Recommended CNAME (optional www)',
      });
    } else {
      out.push({
        type: 'CNAME',
        domain: apexHostLabel(hostname),
        value,
        reason: 'Recommended CNAME from Vercel',
      });
    }
  }

  const ipv4Groups = config.recommendedIPv4 ?? [];
  for (const group of ipv4Groups) {
    const ip = Array.isArray(group) ? String(group[0] ?? '').trim() : '';
    if (!ip) continue;
    out.push({
      type: 'A',
      domain: isApexHostname(hostname) ? '@' : apexHostLabel(hostname),
      value: ip,
      reason: 'Recommended A record from Vercel',
    });
  }

  return out;
}

/** Standard Vercel pointing records (legacy targets still widely used). */
export function buildFallbackDnsRecords(hostname: string): VercelDomainVerificationRecord[] {
  const host = hostname.trim().toLowerCase();
  if (!host) return [];

  if (isApexHostname(host)) {
    return [
      {
        type: 'A',
        domain: '@',
        value: '76.76.21.21',
        reason: `Apex domain (${host}) — use @ or leave host blank at registrar`,
      },
      {
        type: 'CNAME',
        domain: 'www',
        value: 'cname.vercel-dns.com',
        reason: 'Optional — so www.' + host + ' works',
      },
    ];
  }

  const label = apexHostLabel(host);
  return [
    {
      type: 'CNAME',
      domain: label,
      value: 'cname.vercel-dns.com',
      reason: `Subdomain — host/name is usually "${label}" only, not the full domain`,
    },
  ];
}

export function mergeDnsRecordsForDisplay(
  hostname: string,
  apiVerification: VercelDomainVerificationRecord[] | undefined,
  config?: VercelDomainConfigResponse | null
): VercelDomainVerificationRecord[] {
  const fromApi = (apiVerification ?? []).filter((r) => r.type && r.domain && r.value);
  if (fromApi.length) return fromApi;

  const fromConfig = recordsFromDomainConfig(hostname, config);
  if (fromConfig.length) return fromConfig;

  return buildFallbackDnsRecords(hostname);
}
