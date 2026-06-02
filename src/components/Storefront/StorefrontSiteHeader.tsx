import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { headerLayoutForVariant } from '../../config/headerVariants';
import type { WebsiteNavItem, WebsiteSiteSettings } from '../../types/homepage';
import { isExternalHref, normalizeStorefrontPath, resolveStorefrontHref } from '../../utils/storefrontHref';
import StorefrontOrderformHeader from './StorefrontOrderformHeader';
import './storefront-site-header.css';

const DEFAULT_NAV: WebsiteNavItem[] = [{ id: 'home', label: 'Home', href: '/' }];

interface StorefrontSiteHeaderProps {
  siteSettings: WebsiteSiteSettings;
  /** Base path for in-app routes, e.g. `/store/my-shop` or `` on subdomain */
  basePath?: string;
  /** Builder preview: non-navigating labels, drawer still works */
  preview?: boolean;
  /** Builder: click the announcement strip to edit site settings */
  onSelectAnnouncement?: () => void;
  isAnnouncementSelected?: boolean;
  /** Builder: click the header bar (not announcement) to edit header settings */
  onSelectHeader?: () => void;
  isHeaderSelected?: boolean;
}

export default function StorefrontSiteHeader({
  siteSettings,
  basePath = '',
  preview = false,
  onSelectAnnouncement,
  isAnnouncementSelected = false,
  onSelectHeader,
  isHeaderSelected = false,
}: StorefrontSiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMobileGroupId, setOpenMobileGroupId] = useState<string | null>(null);
  const [openDesktopGroupId, setOpenDesktopGroupId] = useState<string | null>(null);
  const navItems = siteSettings.navItems?.length ? siteSettings.navItems : DEFAULT_NAV;
  const layout = headerLayoutForVariant(siteSettings.headerVariant || 'classic');

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

  useEffect(() => {
    if (!openDesktopGroupId || preview) return;
    const onPointerDown = () => setOpenDesktopGroupId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDesktopGroupId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openDesktopGroupId, preview]);

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
    const normalizedHref = normalizeStorefrontPath(item.href);
    const to = resolveStorefrontHref(normalizedHref, basePath);
    if (isExternalHref(normalizedHref)) {
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

  const renderDesktopNavItem = (item: WebsiteNavItem) => {
    const children = item.children || [];
    if (children.length === 0) {
      return renderNavLink(item, 'storefront-site-header__nav-link');
    }
    return (
      <div
        key={item.id}
        className={`storefront-site-header__nav-group${openDesktopGroupId === item.id ? ' is-open' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {preview ? (
          <span className="storefront-site-header__nav-link storefront-site-header__nav-link--group">
            {item.label}
            <span className="storefront-site-header__nav-caret" aria-hidden />
          </span>
        ) : (
          <button
            type="button"
            className="storefront-site-header__nav-link storefront-site-header__nav-link--group"
            aria-expanded={openDesktopGroupId === item.id}
            onClick={(e) => {
              e.stopPropagation();
              setOpenDesktopGroupId((prev) => (prev === item.id ? null : item.id));
            }}
          >
            {item.label}
            <span className="storefront-site-header__nav-caret" aria-hidden />
          </button>
        )}
        <div className="storefront-site-header__nav-dropdown" role="menu" aria-label={item.label}>
          {children.map((child) => renderNavLink(child, 'storefront-site-header__nav-dropdown-link'))}
        </div>
      </div>
    );
  };

  const announcementBlock =
    siteSettings.showAnnouncement && siteSettings.announcementText ? (
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
    ) : null;

  if (layout === 'orderform') {
    return (
      <div className="storefront-site-header storefront-site-header--layout-orderform">
        {announcementBlock}
        <StorefrontOrderformHeader
          siteSettings={siteSettings}
          preview={preview}
          onSelectHeader={onSelectHeader}
          isHeaderSelected={isHeaderSelected}
        />
      </div>
    );
  }

  const barContent = (
    <>
      {preview && onSelectHeader ? (
        <button
          type="button"
          className={`storefront-site-header__bar storefront-site-header__bar--editable${
            isHeaderSelected ? ' is-selected' : ''
          }`}
          aria-label="Edit header"
          aria-pressed={isHeaderSelected}
          onClick={(e) => {
            e.stopPropagation();
            onSelectHeader();
          }}
        >
          {isHeaderSelected ? (
            <span className="storefront-site-header__selection-badge">Header</span>
          ) : null}
          {renderBarInner()}
        </button>
      ) : (
        <div className="storefront-site-header__bar">{renderBarInner()}</div>
      )}
    </>
  );

  function renderBarInner() {
    return (
      <>
        {preview ? (
          <span className="storefront-site-header__brand">{brandContent}</span>
        ) : (
          <Link to={basePath || '/'} className="storefront-site-header__brand" onClick={closeMenu}>
            {brandContent}
          </Link>
        )}

        <nav className="storefront-site-header__nav-desktop" aria-label="Main">
          {navItems.map(renderDesktopNavItem)}
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
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </>
    );
  }

  return (
    <>
      <header
        className={`storefront-site-header storefront-site-header--layout-${layout}`}
        style={headerStyle}
      >
        {announcementBlock}

        {barContent}
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
                (item.children || []).length > 0 ? (
                  <div key={item.id} className="storefront-nav-drawer__group">
                    <button
                      type="button"
                      className="storefront-nav-drawer__link storefront-nav-drawer__link--group"
                      onClick={() =>
                        setOpenMobileGroupId((prev) => (prev === item.id ? null : item.id))
                      }
                    >
                      <span>{item.label}</span>
                      <span aria-hidden>{openMobileGroupId === item.id ? '−' : '+'}</span>
                    </button>
                    {openMobileGroupId === item.id ? (
                      <div className="storefront-nav-drawer__subnav">
                        {(item.children || []).map((child) =>
                          preview ? (
                            <button
                              key={child.id}
                              type="button"
                              className="storefront-nav-drawer__sublink"
                              onClick={closeMenu}
                            >
                              {child.label}
                            </button>
                          ) : (
                            renderNavLink(child, 'storefront-nav-drawer__sublink', closeMenu)
                          )
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : preview ? (
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
