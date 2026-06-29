import { useMemo, useState } from 'react';
import type { StorePublic } from '../../services/storeService';

function isPublicUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const p = new URL(url.trim());
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

const IconStore = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    style={{ color: '#aaa' }}
    aria-hidden
  >
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 01-8 0" />
  </svg>
);

function resolveStoreDisplayName(store: StorePublic): string {
  const name = store.sellerBusinessName?.trim();
  if (name) return name;
  if (store.storeSlug) {
    return store.storeSlug.charAt(0).toUpperCase() + store.storeSlug.slice(1);
  }
  return 'Store';
}

function resolveHeroSubtitle(store: StorePublic): { primary: string | null; secondary: string | null } {
  const a = store.sellerAbout?.trim() || '';
  const t = store.tagline?.trim() || '';
  const d = store.sellerDescription?.trim() || '';
  if (a) return { primary: a, secondary: d && d !== a ? d : null };
  if (t) return { primary: t, secondary: d && d !== t ? d : null };
  if (d) return { primary: d, secondary: null };
  return { primary: null, secondary: null };
}

interface CatalogStoreHeroProps {
  store: StorePublic;
}

/** Classic default-store hero — original `sv-hero` block from StoreView. */
export default function CatalogStoreHero({ store }: CatalogStoreHeroProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const storeDisplayName = useMemo(() => resolveStoreDisplayName(store), [store]);
  const heroSubtitle = useMemo(() => resolveHeroSubtitle(store), [store]);

  return (
    <div className="sv-hero">
      <div className="sv-hero-bg" />
      <div className="sv-hero-inner">
        <div className="sv-hero-top">
          <div className="sv-logo">
            {store.sellerLogoUrl && !logoFailed && isPublicUrl(store.sellerLogoUrl) ? (
              <img
                src={store.sellerLogoUrl}
                alt={storeDisplayName}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <IconStore />
            )}
          </div>
          <div className="sv-open-badge">
            <div className="sv-open-dot" />
            Open now
          </div>
        </div>

        <div className="sv-store-name">{storeDisplayName}</div>
        {heroSubtitle.primary ? <div className="sv-store-tagline">{heroSubtitle.primary}</div> : null}
        {heroSubtitle.secondary ? <div className="sv-store-desc">{heroSubtitle.secondary}</div> : null}
      </div>
    </div>
  );
}
