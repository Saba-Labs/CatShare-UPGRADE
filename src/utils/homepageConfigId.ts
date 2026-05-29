/** True when id is a real database UUID (not a client-side temp placeholder). */
export function isPersistedHomepageConfigId(configId: string | undefined | null): boolean {
  if (!configId || configId.startsWith('temp-')) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(configId);
}
