import type { CSSProperties } from 'react';
import type { StorePublic } from '../../services/storeService';
import type { WebsiteSiteSettings } from '../../types/homepage';
import { resolveStoreHeroCopy } from '../../utils/storefrontHero';
import { useWebsiteStoreOptional } from '../WebsiteBuilder/WebsiteStoreContext';
import './storefront-orderform-header.css';

const IconStore = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

interface StorefrontOrderformHeaderProps {
  siteSettings: WebsiteSiteSettings;
  store?: StorePublic | null;
  preview?: boolean;
  onSelectHeader?: () => void;
  isHeaderSelected?: boolean;
}

export default function StorefrontOrderformHeader({
  siteSettings,
  store: storeProp,
  preview = false,
  onSelectHeader,
  isHeaderSelected = false,
}: StorefrontOrderformHeaderProps) {
  const webCtx = useWebsiteStoreOptional();
  const store = storeProp ?? webCtx?.store ?? null;

  const storeName =
    siteSettings.websiteName?.trim() ||
    store?.sellerBusinessName?.trim() ||
    (store?.storeSlug ? store.storeSlug.charAt(0).toUpperCase() + store.storeSlug.slice(1) : 'My Store');

  const logoUrl = siteSettings.logoUrl?.trim() || store?.sellerLogoUrl?.trim() || '';
  const { primary, secondary } = resolveStoreHeroCopy(store, siteSettings);

  const showOpenBadge = siteSettings.footerShowOpenBadge !== false;
  const openLabel = siteSettings.footerOpenBadgeLabel?.trim() || 'Open now';

  const surfaceStyle = {
    '--sf-of-surface': siteSettings.headerBg || '#f7f7f5',
    '--sf-of-text': siteSettings.headerTextColor || '#1a1a1a',
    '--sf-of-text2': siteSettings.headerTextColor || '#555555',
    '--sf-of-text3': siteSettings.headerTextColor ? undefined : '#999999',
    '--sf-of-border': siteSettings.footerBorderColor || 'rgba(0, 0, 0, 0.08)',
    '--sf-of-accent': siteSettings.footerAccentColor || '#1a6b4a',
    '--sf-of-accent-light': siteSettings.footerAccentBg || '#e8f4ef',
  } as CSSProperties;

  const heroInner = (
    <div className="sf-of-header__inner">
      <div className="sf-of-header__top">
        <div className="sf-of-header__logo">
          {logoUrl ? (
            <img src={logoUrl} alt="" />
          ) : (
            <span className="sf-of-header__logo-ph" aria-hidden>
              <IconStore />
            </span>
          )}
        </div>
        {showOpenBadge ? (
          <div className="sf-of-header__open-badge">
            <span className="sf-of-header__open-dot" />
            {openLabel}
          </div>
        ) : null}
      </div>
      <h1 className="sf-of-header__name">{storeName}</h1>
      {primary ? <p className="sf-of-header__tagline">{primary}</p> : null}
      {secondary ? <p className="sf-of-header__desc">{secondary}</p> : null}
    </div>
  );

  if (preview && onSelectHeader) {
    return (
      <div className="sf-of-header" style={surfaceStyle}>
        <button
          type="button"
          className={`sf-of-header__hit sf-of-header__hit--editable${isHeaderSelected ? ' is-selected' : ''}`}
          aria-label="Edit header"
          aria-pressed={isHeaderSelected}
          onClick={(e) => {
            e.stopPropagation();
            onSelectHeader();
          }}
        >
          {isHeaderSelected ? <span className="sf-of-header__selection-badge">Header</span> : null}
          {heroInner}
        </button>
      </div>
    );
  }

  return (
    <div className="sf-of-header" style={surfaceStyle}>
      {heroInner}
    </div>
  );
}
