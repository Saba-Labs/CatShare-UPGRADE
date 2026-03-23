import type { Country } from 'world-countries';
import countries from 'world-countries';

export type WhatsAppCountryOption = {
  /** ISO 3166-1 alpha-2 */
  iso2: string;
  name: string;
  flag: string;
  /** E.164-style prefix including + (e.g. +1, +1242, +91) */
  dial: string;
};

/**
 * Derive international dial prefix(es) from world-countries ITU data.
 * Handles NANP (+1), shared +7, and multi-prefix territories (e.g. SH).
 */
function dialPrefixesForCountry(country: Country): string[] {
  const root = country.idd?.root;
  if (!root) return [];
  const suffixes = country.idd.suffixes || [];
  if (suffixes.length === 0) return [root];

  // United States, Canada, Puerto Rico, etc.: many area-code suffixes → single country calling code +1
  if (root === '+1') {
    return suffixes.length === 1 ? [`+1${suffixes[0]}`] : ['+1'];
  }

  // Russia & Kazakhstan share +7; suffixes are mobile leading digits
  if (root === '+7') {
    if (suffixes.length > 1 && suffixes.every((s) => s.length === 1)) {
      return ['+7'];
    }
  }

  if (suffixes.length === 1) {
    return [root + suffixes[0]];
  }

  // Multiple distinct prefixes (e.g. Saint Helena +290 / Ascension +247)
  return suffixes.map((s) => root + s);
}

/** Vatican ITU data is non-standard; WhatsApp uses Italy +39 */
const DIAL_OVERRIDES: Record<string, string> = {
  VA: '+39',
};

function buildOptions(): WhatsAppCountryOption[] {
  const out: WhatsAppCountryOption[] = [];

  for (const c of countries) {
    const override = DIAL_OVERRIDES[c.cca2];
    if (override) {
      out.push({
        iso2: c.cca2,
        name: c.name.common,
        flag: c.flag,
        dial: override,
      });
      continue;
    }

    const prefixes = dialPrefixesForCountry(c);
    for (const dial of prefixes) {
      out.push({
        iso2: c.cca2,
        name: c.name.common,
        flag: c.flag,
        dial,
      });
    }
  }

  // Stable sort: country name, then dial (so +1 regions group sensibly)
  out.sort((a, b) => {
    const n = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    if (n !== 0) return n;
    return a.dial.localeCompare(b.dial, 'en');
  });

  return out;
}

export const WHATSAPP_COUNTRY_OPTIONS: WhatsAppCountryOption[] = buildOptions();

/** Longest prefix first — used to split saved E.164 numbers into dial + local parts */
const SORTED_DIAL_PREFIXES: string[] = Array.from(
  new Set(WHATSAPP_COUNTRY_OPTIONS.map((o) => o.dial))
).sort((a, b) => b.length - a.length);

export function parseWhatsAppNumber(saved: string): { dial: string; local: string } {
  const cleaned = (saved || '').replace(/\s+/g, '').trim();
  if (!cleaned) return { dial: '', local: '' };

  const match = SORTED_DIAL_PREFIXES.find((d) => cleaned.startsWith(d));
  if (match) {
    const local = cleaned.slice(match.length).replace(/\D/g, '');
    return { dial: match, local };
  }

  const local = cleaned.replace(/\D/g, '');
  return { dial: '', local };
}

/** When several countries share a dial (e.g. +1), pick a sensible default for the picker. */
export function defaultCountryOptionForDial(dial: string): WhatsAppCountryOption | undefined {
  const opts = WHATSAPP_COUNTRY_OPTIONS.filter((o) => o.dial === dial);
  if (opts.length === 0) return undefined;
  if (dial === '+1') {
    const us = opts.find((o) => o.iso2 === 'US');
    if (us) return us;
    const ca = opts.find((o) => o.iso2 === 'CA');
    if (ca) return ca;
  }
  return opts[0];
}
