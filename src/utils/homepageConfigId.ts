const PERSISTED_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when id is a real database UUID (not a client-side temp placeholder). */
export function isPersistedHomepageConfigId(configId: string | undefined | null): boolean {
  if (!configId || configId.startsWith('temp-') || configId.startsWith('local-')) return false;
  return PERSISTED_UUID_RE.test(configId);
}

/** True when store id is a Supabase UUID (not a local offline placeholder). */
export function isPersistedStoreId(storeId: string | undefined | null): boolean {
  return isPersistedHomepageConfigId(storeId);
}
