/**
 * Vercel REST API helpers for project custom domains (server-only).
 * @see https://vercel.com/docs/rest-api/reference/endpoints/projects/add-a-domain-to-a-project
 */

export type VercelDomainVerificationRecord = {
  type: string;
  domain: string;
  value: string;
  reason?: string;
};

export type VercelProjectDomain = {
  name: string;
  verified: boolean;
  verification?: VercelDomainVerificationRecord[];
  error?: { code?: string; message?: string };
};

function vercelApiConfig(): { token: string; projectId: string; teamId?: string } | null {
  const token = String(process.env.VERCEL_API_TOKEN || '').trim();
  const projectId = String(
    process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME || ''
  ).trim();
  if (!token || !projectId) return null;
  const teamId = String(process.env.VERCEL_TEAM_ID || '').trim();
  return { token, projectId, teamId: teamId || undefined };
}

function teamQuery(teamId?: string): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}

async function vercelFetch(path: string, init?: RequestInit): Promise<Response> {
  const cfg = vercelApiConfig();
  if (!cfg) {
    throw new Error('VERCEL_API_TOKEN and VERCEL_PROJECT_ID are not configured on the server.');
  }
  const url = `https://api.vercel.com${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

function mapVerification(
  raw: unknown
): VercelDomainVerificationRecord[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: VercelDomainVerificationRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const type = String(o.type || '');
    const domain = String(o.domain || '');
    const value = String(o.value || '');
    if (!type || !domain || !value) continue;
    out.push({
      type,
      domain,
      value,
      reason: o.reason != null ? String(o.reason) : undefined,
    });
  }
  return out.length ? out : undefined;
}

function mapDomainPayload(data: Record<string, unknown>): VercelProjectDomain {
  const err = data.error;
  let error: VercelProjectDomain['error'];
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    error = {
      code: e.code != null ? String(e.code) : undefined,
      message: e.message != null ? String(e.message) : undefined,
    };
  }
  return {
    name: String(data.name || data.domain || ''),
    verified: data.verified === true,
    verification: mapVerification(data.verification),
    error,
  };
}

export function isVercelDomainsConfigured(): boolean {
  return vercelApiConfig() != null;
}

export async function addProjectDomain(hostname: string): Promise<VercelProjectDomain> {
  const cfg = vercelApiConfig();
  if (!cfg) throw new Error('Vercel domain API is not configured.');

  const res = await vercelFetch(`/v10/projects/${encodeURIComponent(cfg.projectId)}/domains${teamQuery(cfg.teamId)}`, {
    method: 'POST',
    body: JSON.stringify({ name: hostname }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (body.error as { message?: string } | undefined)?.message ||
      (typeof body.message === 'string' ? body.message : null) ||
      `Vercel API error (${res.status})`;
    throw new Error(msg);
  }
  return mapDomainPayload(body);
}

export async function getProjectDomain(hostname: string): Promise<VercelProjectDomain | null> {
  const cfg = vercelApiConfig();
  if (!cfg) throw new Error('Vercel domain API is not configured.');

  const res = await vercelFetch(
    `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(hostname)}${teamQuery(cfg.teamId)}`
  );

  if (res.status === 404) return null;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (body.error as { message?: string } | undefined)?.message ||
      (typeof body.message === 'string' ? body.message : null) ||
      `Vercel API error (${res.status})`;
    throw new Error(msg);
  }
  return mapDomainPayload(body);
}

export async function removeProjectDomain(hostname: string): Promise<void> {
  const cfg = vercelApiConfig();
  if (!cfg) throw new Error('Vercel domain API is not configured.');

  const res = await vercelFetch(
    `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(hostname)}${teamQuery(cfg.teamId)}`,
    { method: 'DELETE' }
  );

  if (res.status === 404) return;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const msg =
      (body.error as { message?: string } | undefined)?.message ||
      (typeof body.message === 'string' ? body.message : null) ||
      `Vercel API error (${res.status})`;
    throw new Error(msg);
  }
}
