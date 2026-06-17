export type StoreIntegrationFlags = {
  razorpay: boolean;
  shiprocket: boolean;
};

export const DEFAULT_STORE_INTEGRATION_FLAGS: StoreIntegrationFlags = {
  razorpay: false,
  shiprocket: false,
};

export function normalizeStoreIntegrationFlags(raw: unknown): StoreIntegrationFlags {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STORE_INTEGRATION_FLAGS };
  const o = raw as Record<string, unknown>;
  return {
    razorpay: o.razorpay === true,
    shiprocket: o.shiprocket === true,
  };
}
