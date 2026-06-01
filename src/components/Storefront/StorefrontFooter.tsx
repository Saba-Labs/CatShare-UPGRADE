import { useMemo, type CSSProperties, type ReactNode } from 'react';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import { parseBusinessProfile } from '../../config/businessProfile';
import type { StorePublic } from '../../services/storeService';
import { footerLayoutForVariant, type FooterLayoutMode } from '../../config/footerVariants';
import type { WebsiteSiteSettings } from '../../types/homepage';
import { currencySymbolFor } from '../../utils/websiteStorefront';
import { useBuilderCatalogue } from '../HomepageBuilder/catalogue/BuilderCatalogueContext';
import StorefrontLink from '../WebsiteBuilder/StorefrontLink';
import CatSharePoweredBy from '../WebsiteBuilder/CatSharePoweredBy';
import { useWebsiteStoreOptional } from '../WebsiteBuilder/WebsiteStoreContext';
import './storefront-footer.css';

export interface StorefrontFooterProps {
  siteSettings: WebsiteSiteSettings;
  previewMode?: boolean;
  store?: StorePublic | null;
  products?: ProductWithCatalogueData[];
  categoryCount?: number;
}

function webHref(raw: string): string {
  const t = raw.trim();
  if (!t) return '#';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function readCachedBusinessProfile() {
  try {
    const raw = localStorage.getItem('businessProfile');
    if (raw) return parseBusinessProfile(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return parseBusinessProfile(null);
}

function productCategories(products: ProductWithCatalogueData[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    for (const c of p.category || []) {
      const t = String(c).trim();
      if (t) set.add(t);
    }
  }
  return Array.from(set);
}

function resolveTagline(store: StorePublic | null | undefined, siteSettings: WebsiteSiteSettings) {
  if (siteSettings.footerDescription?.trim()) return siteSettings.footerDescription.trim();
  const a = store?.sellerAbout?.trim() || '';
  const t = store?.tagline?.trim() || '';
  const d = store?.sellerDescription?.trim() || '';
  if (a) return a;
  if (t) return t;
  if (d) return d;
  const bp = readCachedBusinessProfile();
  if (bp.about?.trim()) return bp.about.trim();
  if (bp.description?.trim()) return bp.description.trim();
  return '';
}

const IconLink = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);
const IconInstagram = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4.1" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const IconTwitterX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2H21l-6.02 6.88L22 22h-5.563l-4.36-5.89L6.92 22H4.16l6.44-7.36L2 2h5.704l3.94 5.31L18.244 2zm-.968 18.21h1.54L6.87 3.69H5.217L17.276 20.21z" />
  </svg>
);
const IconFacebook = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M22 12.07C22 6.51 17.52 2 12 2S2 6.51 2 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.47H15.2c-1.24 0-1.63.78-1.63 1.57v1.89h2.77l-.44 2.9h-2.33V22c4.78-.75 8.43-4.91 8.43-9.93z" />
  </svg>
);

export default function StorefrontFooter({
  siteSettings,
  previewMode,
  store: storeProp,
  products: productsProp,
  categoryCount: categoryCountProp,
}: StorefrontFooterProps) {
  const webCtx = useWebsiteStoreOptional();
  const catalogue = useBuilderCatalogue();
  const layout: FooterLayoutMode = footerLayoutForVariant(siteSettings.footerVariant || 'classic');

  const store = storeProp ?? webCtx?.store ?? null;
  const products = productsProp ?? webCtx?.products ?? catalogue.products;
  const bp = useMemo(() => readCachedBusinessProfile(), []);

  const storeName =
    siteSettings.websiteName?.trim() ||
    store?.sellerBusinessName?.trim() ||
    bp.businessName?.trim() ||
    (store?.storeSlug ? store.storeSlug.charAt(0).toUpperCase() + store.storeSlug.slice(1) : 'My Store');

  const tagline = resolveTagline(store, siteSettings);

  const displayLocation =
    siteSettings.footerLocationText?.trim() ||
    store?.sellerAddress?.trim() ||
    store?.location?.trim() ||
    bp.address?.trim() ||
    '';
  const displayPhone =
    siteSettings.footerPhoneText?.trim() ||
    store?.sellerPhone?.trim() ||
    store?.phone?.trim() ||
    bp.phone?.trim() ||
    '';
  const displayEmail =
    siteSettings.footerEmailText?.trim() ||
    store?.sellerEmail?.trim() ||
    bp.email?.trim() ||
    '';
  const whatsapp = store?.whatsapp?.trim() || '';

  const currencyCode = store?.sellerCurrencyCode || catalogue.currencyCode || 'INR';
  const currencySymbol = currencySymbolFor(currencyCode);
  const minimumOrderValue = store?.minimumOrderValue ?? 0;
  const productCount = products.length;
  const categoryCount =
    categoryCountProp ??
    (catalogue.categories.length > 0 ? catalogue.categories.length : productCategories(products).length);

  const ig = store?.instagram?.trim() || bp.instagram?.trim();
  const tw = store?.twitter?.trim() || bp.twitter?.trim();
  const fb = store?.facebook?.trim() || bp.facebook?.trim();
  const siteWeb = (store?.sellerWebsite || store?.website || bp.website)?.trim();

  type SocialLink = { label: string; url: string; icon: ReactNode };
  const socialLinks: SocialLink[] = [
    ig && { label: 'Instagram', url: webHref(ig), icon: <IconInstagram /> },
    tw && { label: 'Twitter/X', url: webHref(tw), icon: <IconTwitterX /> },
    fb && { label: 'Facebook', url: webHref(fb), icon: <IconFacebook /> },
    siteWeb && { label: 'Website', url: webHref(siteWeb), icon: <IconLink /> },
  ].filter(Boolean) as SocialLink[];

  const showOpenBadge = siteSettings.footerShowOpenBadge !== false;
  const openLabel = siteSettings.footerOpenBadgeLabel?.trim() || 'Open now';

  const showLocation = siteSettings.footerShowLocation !== false;
  const showContact = siteSettings.footerShowContact !== false;
  const showStoreInfo = siteSettings.footerShowStoreInfo !== false;
  const showFollow = siteSettings.footerShowFollow !== false;
  const linkColumns = siteSettings.footerColumns || [];
  const hasLinkColumns = linkColumns.length > 0;
  const showInfoGrid =
    layout === 'info-cards' &&
    (showLocation || showContact || showStoreInfo || showFollow);
  const showFollowInMenus =
    showFollow && (layout === 'link-columns' || layout === 'centered' || layout === 'split');

  const footerBg = siteSettings.footerBg || '#ffffff';
  const footerText = siteSettings.footerTextColor || '#1a1a1a';

  const footerStyle = {
    background: footerBg,
    color: footerText,
    '--sf-footer-surface': footerBg,
    '--sf-footer-text': footerText,
    '--sf-footer-text-secondary': footerText,
    '--sf-footer-muted': `color-mix(in srgb, ${footerText} 62%, transparent)`,
    '--sf-footer-col-bg': siteSettings.footerColBg || '#f2f2f0',
    '--sf-footer-border': siteSettings.footerBorderColor || 'rgba(0, 0, 0, 0.08)',
    '--sf-footer-accent': siteSettings.footerAccentColor || '#1a6b4a',
    '--sf-footer-accent-bg': siteSettings.footerAccentBg || '#e8f4ef',
  } as CSSProperties;

  const fmtMin = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${currencySymbol}${n}`;
    }
  };

  const renderLink = (href: string, children: ReactNode) =>
    previewMode ? (
      <span className="sf-footer-link sf-footer-link--static">{children}</span>
    ) : (
      <StorefrontLink href={href} className="sf-footer-link">
        {children}
      </StorefrontLink>
    );

  const renderMenuLink = (link: { id: string; label: string; href: string }) =>
    previewMode ? (
      <span className="sf-footer-menu-link sf-footer-menu-link--static">{link.label}</span>
    ) : (
      <StorefrontLink href={link.href} className="sf-footer-menu-link">
        {link.label}
      </StorefrontLink>
    );

  const footerHead = (
    <div className="sf-footer-head">
      <div>
        <div className="sf-footer-brand">{storeName}</div>
        {tagline ? <div className="sf-footer-note">{tagline}</div> : null}
      </div>
      {showOpenBadge ? (
        <div className="sf-footer-status">
          <span className="sf-footer-open-dot" />
          {openLabel}
        </div>
      ) : null}
    </div>
  );

  const footerSocials = socialLinks.length > 0 ? (
    <div className="sf-footer-socials">
      {socialLinks.map((s) =>
        previewMode ? (
          <span key={s.label} className="sf-footer-social-btn" title={s.label}>
            {s.icon}
          </span>
        ) : (
          <a
            key={s.label}
            className="sf-footer-social-btn"
            href={s.url}
            target="_blank"
            rel="noreferrer"
            title={s.label}
          >
            {s.icon}
          </a>
        )
      )}
    </div>
  ) : null;

  const linkColumnsNav = (opts: { includeBrandCol?: boolean; centered?: boolean }) => {
    if (!hasLinkColumns) return null;
    const { includeBrandCol = false, centered = false } = opts;
    return (
      <nav
        className={`sf-footer-menus${centered ? ' sf-footer-menus--centered' : ''}`}
        aria-label="Footer navigation"
      >
        {linkColumns.map((column, index) => (
          <div key={`${column.title}-${index}`} className="sf-footer-menu-col">
            <h3 className="sf-footer-menu-title">{column.title}</h3>
            <ul className="sf-footer-menu-links">
              {column.links.map((link) => (
                <li key={link.id}>{renderMenuLink(link)}</li>
              ))}
            </ul>
          </div>
        ))}
        {includeBrandCol ? (
          <div className="sf-footer-menu-col sf-footer-menu-col--brand">
            <div className="sf-footer-brand">{storeName}</div>
            {tagline ? <p className="sf-footer-menu-tagline">{tagline}</p> : null}
            {showOpenBadge ? (
              <div className="sf-footer-status sf-footer-status--inline">
                <span className="sf-footer-open-dot" />
                {openLabel}
              </div>
            ) : null}
            {showFollowInMenus ? footerSocials : null}
          </div>
        ) : null}
      </nav>
    );
  };

  const layoutBody = (() => {
    switch (layout) {
      case 'link-columns':
        return (
          <>
            {hasLinkColumns ? linkColumnsNav({ includeBrandCol: true }) : footerHead}
          </>
        );
      case 'centered':
        return (
          <>
            <div className="sf-footer-centered-top">
              <div className="sf-footer-brand">{storeName}</div>
              {tagline ? <p className="sf-footer-menu-tagline">{tagline}</p> : null}
              {showOpenBadge ? (
                <div className="sf-footer-status sf-footer-status--inline">
                  <span className="sf-footer-open-dot" />
                  {openLabel}
                </div>
              ) : null}
              {showFollowInMenus ? footerSocials : null}
            </div>
            {linkColumnsNav({ centered: true })}
          </>
        );
      case 'split':
        return (
          <div className="sf-footer-split-band">
            <div className="sf-footer-split-brand">
              <div className="sf-footer-brand">{storeName}</div>
              {tagline ? <p className="sf-footer-menu-tagline">{tagline}</p> : null}
              {showOpenBadge ? (
                <div className="sf-footer-status sf-footer-status--inline">
                  <span className="sf-footer-open-dot" />
                  {openLabel}
                </div>
              ) : null}
              {showFollowInMenus ? footerSocials : null}
            </div>
            <div className="sf-footer-split-menus">{linkColumnsNav({})}</div>
          </div>
        );
      case 'info-cards':
      default:
        return (
          <>
            {footerHead}
            {hasLinkColumns ? (
              <div className="sf-footer-menus-wrap">{linkColumnsNav({})}</div>
            ) : null}
          </>
        );
    }
  })();

  const footerWidth = siteSettings.footerWidth === 'full' ? 'full' : 'boxed';

  return (
    <footer
      className={`sf-footer sf-footer--layout-${layout} sf-footer--width-${footerWidth}${
        previewMode ? ' sf-footer--preview' : ''
      }`}
      style={footerStyle}
    >
      {layoutBody}

      {showInfoGrid ? (
      <div className="sf-footer-grid">
        {showLocation ? (
          <section className="sf-footer-col">
            <div className="sf-footer-col-title">Location</div>
            <ul className="sf-footer-list">
              <li className="sf-footer-item">{displayLocation || 'Address not provided'}</li>
            </ul>
          </section>
        ) : null}

        {showContact ? (
          <section className="sf-footer-col">
            <div className="sf-footer-col-title">Contact</div>
            <ul className="sf-footer-list">
              {displayPhone ? (
                <li className="sf-footer-item">
                  {previewMode ? <>Call: {displayPhone}</> : renderLink(`tel:${displayPhone}`, <>Call: {displayPhone}</>)}
                </li>
              ) : null}
              {displayEmail ? (
                <li className="sf-footer-item">
                  {previewMode ? <>Email: {displayEmail}</> : renderLink(`mailto:${displayEmail}`, <>Email: {displayEmail}</>)}
                </li>
              ) : null}
              {whatsapp ? (
                <li className="sf-footer-item">
                  {previewMode ? (
                    <>WhatsApp: {whatsapp}</>
                  ) : (
                    renderLink(
                      `https://wa.me/${whatsapp.replace(/\D/g, '')}`,
                      <>WhatsApp: {whatsapp}</>
                    )
                  )}
                </li>
              ) : null}
              {!displayPhone && !displayEmail && !whatsapp ? (
                <li className="sf-footer-item">Contact details not provided</li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {showStoreInfo ? (
          <section className="sf-footer-col">
            <div className="sf-footer-col-title">Store Info</div>
            <ul className="sf-footer-list">
              <li className="sf-footer-item">Currency: {currencyCode}</li>
              {minimumOrderValue > 0 ? (
                <li className="sf-footer-item">Minimum order: {fmtMin(minimumOrderValue)}</li>
              ) : null}
              <li className="sf-footer-item">
                {productCount} item{productCount === 1 ? '' : 's'} listed
              </li>
              <li className="sf-footer-item">
                {categoryCount} categor{categoryCount === 1 ? 'y' : 'ies'}
              </li>
            </ul>
          </section>
        ) : null}

        {showFollow && layout === 'info-cards' ? (
          <section className="sf-footer-col">
            <div className="sf-footer-col-title">Follow</div>
            {socialLinks.length > 0 ? (
              <div className="sf-footer-socials">
                {socialLinks.map((s) =>
                  previewMode ? (
                    <span key={s.label} className="sf-footer-social-btn" title={s.label}>
                      {s.icon}
                    </span>
                  ) : (
                    <a
                      key={s.label}
                      className="sf-footer-social-btn"
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      title={s.label}
                    >
                      {s.icon}
                    </a>
                  )
                )}
              </div>
            ) : (
              <ul className="sf-footer-list">
                <li className="sf-footer-item">No social links added</li>
              </ul>
            )}
          </section>
        ) : null}
      </div>
      ) : null}

      <CatSharePoweredBy previewMode={previewMode} />
    </footer>
  );
}
