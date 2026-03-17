export const SUBSCRIPTION_SKUS = {
  monthly: "catshare_pro_monthly",
  yearly: "catshare_pro_yearly",
} as const;

export const INAPP_SKUS = {
  lifetime: "catshare_pro_lifetime",
} as const;

export const ALL_PRO_SKUS = new Set<string>([
  SUBSCRIPTION_SKUS.monthly,
  SUBSCRIPTION_SKUS.yearly,
  INAPP_SKUS.lifetime,
]);

