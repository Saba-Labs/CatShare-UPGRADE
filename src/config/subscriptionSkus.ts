export const SUBSCRIPTION_SKUS = {
  monthly: "catshare_pro_monthly",
  yearly: "catshare_pro_yearly",
} as const;

/** Google Play base plan IDs — must match Subscriptions → each product → base plan ID in Play Console */
export const SUBSCRIPTION_BASE_PLAN_IDS: Record<
  (typeof SUBSCRIPTION_SKUS)[keyof typeof SUBSCRIPTION_SKUS],
  string
> = {
  [SUBSCRIPTION_SKUS.monthly]: "monthly",
  [SUBSCRIPTION_SKUS.yearly]: "yearly-v2",
};

export const INAPP_SKUS = {
  lifetime: "catshare_pro_lifetime",
} as const;

export const ALL_PRO_SKUS = new Set<string>([
  SUBSCRIPTION_SKUS.monthly,
  SUBSCRIPTION_SKUS.yearly,
  INAPP_SKUS.lifetime,
]);

