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
