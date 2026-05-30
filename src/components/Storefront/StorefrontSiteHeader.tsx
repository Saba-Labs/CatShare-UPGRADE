import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WebsiteNavItem, WebsiteSiteSettings } from '../../types/homepage';
import './storefront-site-header.css';

const DEFAULT_NAV: WebsiteNavItem[] = [{ id: 'home', label: 'Home', href: '/' }];

function resolveNavHref(href: string, basePath: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) {
    const suffix = href === '/' ? '' : href;
    const combined = `${basePath}${suffix}`;
    return combined.replace(/([^:]\/)\/+/g, '$1');
  }
  return href;
}

interface StorefrontSiteHeaderProps {
  siteSettings: WebsiteSiteSettings;
  /** Base path for in-app routes, e.g. `/store/my-shop` or `` on subdomain */
  basePath?: string;
  /** Builder preview: non-navigating labels, drawer still works */
  preview?: boolean;
  /** Builder: click the announcement strip to edit site settings */
  onSelectAnnouncement?: () => void;
  isAnnouncementSelected?: boolean;
}

export default function StorefrontSiteHeader({
  siteSettings,
  basePath = '',
  preview = false,
  onSelectAnnouncement,
  isAnnouncementSelected = false,
}: StorefrontSiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = siteSettings.navItems?.length ? siteSettings.navItems : DEFAULT_NAV;

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen || preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen, preview, closeMenu]);

  const headerStyle = useMemo(
    () => ({
      background: siteSettings.headerBg || '#fff',
      color: siteSettings.headerTextColor || '#111827',
    }),
    [siteSettings.headerBg, siteSettings.headerTextColor]
  );

  const brandName = siteSettings.websiteName || 'My Store';

  const brandContent = (
    <span className="storefront-site-header__brand-inner">
      {siteSettings.logoUrl ? (
        <img
          className="storefront-site-header__logo"
          src={siteSettings.logoUrl}
          alt=""
        />
      ) : null}
      <span className="storefront-site-header__brand-name">{brandName}</span>
    </span>
  );

  const renderNavLink = (item: WebsiteNavItem, className: string, onNavigate?: () => void) => {
    if (preview) {
      return (
        <span key={item.id} className={className}>
          {item.label}
        </span>
      );
    }
    const to = resolveNavHref(item.href, basePath);
    if (/^https?:\/\//i.test(to)) {
      return (
        <a key={item.id} href={to} className={className} onClick={onNavigate}>
          {item.label}
        </a>
      );
    }
    return (
      <Link key={item.id} to={to} className={className} onClick={onNavigate}>
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <header className="storefront-site-header" style={headerStyle}>
        {siteSettings.showAnnouncement && siteSettings.announcementText ? (
          preview && onSelectAnnouncement ? (
            <button
              type="button"
              className={`storefront-site-header__announcement storefront-site-header__announcement--editable${
                isAnnouncementSelected ? ' is-selected' : ''
              }`}
              style={{
                background: siteSettings.announcementBg || '#111827',
                color: siteSettings.announcementTextColor || '#fff',
              }}
              aria-label="Edit announcement bar"
              aria-pressed={isAnnouncementSelected}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnnouncement();
              }}
            >
              {isAnnouncementSelected ? (
                <span className="storefront-site-header__announcement-badge">Announcement</span>
              ) : null}
              {siteSettings.announcementText}
            </button>
          ) : (
            <div
              className="storefront-site-header__announcement"
              style={{
                background: siteSettings.announcementBg || '#111827',
                color: siteSettings.announcementTextColor || '#fff',
              }}
            >
              {siteSettings.announcementText}
            </div>
          )
        ) : null}

        <div className="storefront-site-header__bar">
          {preview ? (
            <span className="storefront-site-header__brand">{brandContent}</span>
          ) : (
            <Link to={basePath || '/'} className="storefront-site-header__brand" onClick={closeMenu}>
              {brandContent}
            </Link>
          )}

          <nav className="storefront-site-header__nav-desktop" aria-label="Main">
            {navItems.map((item) => renderNavLink(item, 'storefront-site-header__nav-link'))}
          </nav>

          <button
            type="button"
            className="storefront-site-header__menu-btn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <>
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      {menuOpen ? (
        <>
          <div
            className="storefront-nav-overlay"
            role="presentation"
            onClick={(e) => {
              e.stopPropagation();
              closeMenu();
            }}
          />
          <aside
            className="storefront-nav-drawer"
            style={headerStyle}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <div className="storefront-nav-drawer__head">
              <span>{siteSettings.websiteName || 'Menu'}</span>
              <button type="button" className="storefront-nav-drawer__close" onClick={closeMenu} aria-label="Close menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="storefront-nav-drawer__nav" aria-label="Main">
              {navItems.map((item) =>
                preview ? (
                  <button
                    key={item.id}
                    type="button"
                    className="storefront-nav-drawer__link"
                    onClick={closeMenu}
                  >
                    {item.label}
                  </button>
                ) : (
                  renderNavLink(item, 'storefront-nav-drawer__link', closeMenu)
                )
              )}
            </nav>
          </aside>
        </>
      ) : null}
    </>
  );
}
