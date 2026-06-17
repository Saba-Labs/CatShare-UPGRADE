/**
 * Strip server-only fields from integration rows returned to the browser.
 */

const SERVER_ONLY_METADATA_KEYS = new Set([
  'encryptedPassword',
  'encryptedAccessToken',
  'apiUserEmail',
  'encryptedKeyId',
  'encryptedKeySecret',
]);

export function sanitizeIntegrationMetadata(
  metadata: unknown
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (SERVER_ONLY_METADATA_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

export function sanitizeIntegrationRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...row,
    metadata: sanitizeIntegrationMetadata(row.metadata),
  };
}

export function sanitizeIntegrationRows(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return rows.map(sanitizeIntegrationRow);
}
