/**
 * Free-tier limits (when user is not Pro: trial ended and not subscribed).
 * Keep in sync with enforcement and UI copy (ProInfo, toasts).
 */

export const FREE_MAX_PRODUCTS = 50;

export const FREE_MAX_CATALOGUES = 3;

/** Default watermark when Free tier forces a fixed text (must match app defaults). */
export const FREE_WATERMARK_TEXT = "Created using CatShare";

/** Default watermark position when Free tier locks customization. */
export const FREE_WATERMARK_POSITION = "bottom-left" as const;

/** Max PDF generations per local calendar day on Free tier. */
export const FREE_MAX_PDF_PER_DAY = 1;

/** Max shareable order links per local calendar day on Free tier. */
export const FREE_MAX_SHARE_LINK_PER_DAY = 1;

/**
 * Fallback trial length for UI when API has not returned `trialDays` yet.
 * Server source of truth: `lib/subscriptionEntitlement.mjs` TRIAL_DAYS.
 */
export const TRIAL_DAYS_UI_FALLBACK = 14;
