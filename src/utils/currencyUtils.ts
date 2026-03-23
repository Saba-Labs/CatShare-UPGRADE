/**
 * Currency Utilities
 * Manages currency symbols and defaults across the app
 */

export interface CurrencyData {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: { [key: string]: CurrencyData } = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£' },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  HKD: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  MXN: { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
};

/**
 * Get current currency code from localStorage
 * Defaults to INR if not set
 */
export function getCurrentCurrency(): string {
  if (typeof window === 'undefined') return 'INR';
  const stored = localStorage.getItem('defaultCurrency');
  return stored || 'INR';
}

/**
 * Resolve display symbol for a currency code (standard + custom in localStorage).
 */
export function getSymbolForCurrencyCode(code: string): string {
  const c = (code || 'INR').trim() || 'INR';
  if (CURRENCIES[c]) {
    return CURRENCIES[c].symbol;
  }
  try {
    const raw = localStorage.getItem('customCurrencies');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed[c]) {
        return parsed[c];
      }
    }
  } catch {
    /* ignore */
  }
  return '₹';
}

/**
 * Get current currency symbol
 */
export function getCurrentCurrencySymbol(): string {
  return getSymbolForCurrencyCode(getCurrentCurrency());
}

/** Payload from `get_share_link` RPC (optional fields for older RPC versions). */
export type ShareLinkCurrencyPayload = {
  sellerCurrencyCode?: string;
  sellerCurrencySymbol?: string;
  /** From `user_settings.data.customCurrencies` — lets buyers resolve custom codes. */
  sellerCustomCurrencies?: Record<string, string> | null;
};

/**
 * Currency code + symbol to store on a new share link — prefers Supabase `user_settings`
 * (cloud) over localStorage so strict-online / multi-device stays correct.
 */
export function getSellerCurrencyForShareLink(userSettings: any | null | undefined): {
  code: string;
  symbol: string;
} {
  const raw =
    (typeof userSettings?.currency === 'string' && userSettings.currency.trim()) ||
    (typeof userSettings?.defaultCurrency === 'string' && userSettings.defaultCurrency.trim()) ||
    getCurrentCurrency();
  const code = (raw || 'INR').trim().toUpperCase() || 'INR';

  const cloudCustom =
    userSettings?.data?.customCurrencies != null &&
    typeof userSettings.data.customCurrencies === 'object' &&
    !Array.isArray(userSettings.data.customCurrencies)
      ? (userSettings.data.customCurrencies as Record<string, string>)
      : null;

  const fromCloud = cloudCustom?.[code]?.trim();
  if (fromCloud) {
    return { code, symbol: fromCloud };
  }
  if (CURRENCIES[code]) {
    return { code, symbol: CURRENCIES[code].symbol };
  }
  return { code, symbol: getSymbolForCurrencyCode(code) };
}

/**
 * Display symbol on the public order form from RPC data (+ optional custom map).
 */
export function resolveShareLinkCurrencyDisplay(payload: ShareLinkCurrencyPayload): string {
  const code = (payload.sellerCurrencyCode || 'INR').trim().toUpperCase() || 'INR';
  const apiSym = (payload.sellerCurrencySymbol || '').trim();
  const custom =
    payload.sellerCustomCurrencies != null &&
    typeof payload.sellerCustomCurrencies === 'object' &&
    !Array.isArray(payload.sellerCustomCurrencies)
      ? payload.sellerCustomCurrencies
      : null;

  const customSym = custom?.[code]?.trim();
  if (customSym) return customSym;

  if (CURRENCIES[code]) {
    if (!apiSym || (code !== 'INR' && apiSym === '₹')) {
      return CURRENCIES[code].symbol;
    }
    return apiSym;
  }

  if (apiSym) return apiSym;
  return '₹';
}

/**
 * Get currency data by code
 */
export function getCurrencyData(code: string): CurrencyData {
  // Check standard currencies first
  if (CURRENCIES[code]) {
    return CURRENCIES[code];
  }

  // Check custom currencies
  try {
    const customCurrencies = localStorage.getItem('customCurrencies');
    if (customCurrencies) {
      const parsed = JSON.parse(customCurrencies);
      if (parsed[code]) {
        return {
          code,
          symbol: parsed[code],
          name: `Custom - ${code}`,
        };
      }
    }
  } catch (e) {
    // Silently fail
  }

  return CURRENCIES['INR'];
}

/**
 * Get all available currencies as array
 */
export function getAllCurrencies(): CurrencyData[] {
  return Object.values(CURRENCIES);
}

/**
 * Listen for currency changes
 */
export function onCurrencyChange(callback: (currency: string, symbol: string) => void): () => void {
  const handleCurrencyChanged = (event: any) => {
    const currency = event.detail?.currency || 'INR';
    const symbol = getSymbolForCurrencyCode(currency);
    callback(currency, symbol);
  };

  window.addEventListener('currencyChanged', handleCurrencyChanged);

  // Return unsubscribe function
  return () => {
    window.removeEventListener('currencyChanged', handleCurrencyChanged);
  };
}
