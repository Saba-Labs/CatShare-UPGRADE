import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import { headerLayoutForPageSurface } from '../../config/headerVariants';
import type { WebsiteNavItem, WebsiteSiteSettings } from '../../types/homepage';
import { isExternalHref, normalizeStorefrontPath, resolveStorefrontHref } from '../../utils/storefrontHref';
import type { StorePublic } from '../../services/storeService';
import StorefrontOrderformHeader from './StorefrontOrderformHeader';
import StorefrontHeaderSearch from './StorefrontHeaderSearch';
import SiteAnnouncementRotator from './SiteAnnouncementRotator';
import { buildHeaderSurfaceStyle, headerLayoutDataAttributes } from '../../utils/headerSurfaceStyle';
import {
  getActiveSiteAnnouncementMessages,
  hasVisibleSiteAnnouncement,
  resolveSiteAnnouncementRotation,
  resolveSiteAnnouncementRotationInterval,
} from '../../utils/siteAnnouncementMessages';
import './storefront-site-header.css';

const DEFAULT_NAV: WebsiteNavItem[] = [{ id: 'home', label: 'Home', href: '/' }];

/** Approximate compact pinned bar height — used for orderform scroll threshold math. */
const COMPACT_HEADER_HEIGHT = 60;
const SCROLL_LEAVE_THRESHOLD = 4;
/** Scroll distance before morphing centered/classic headers to compact bar (header stays pinned). */
const COMPACT_MORPH_SCROLL = 28;

function resolveScrollThreshold(
  headerEl: HTMLElement,
  layout: ReturnType<typeof headerLayoutForPageSurface>
): number {
  if (layout === 'centered' || layout === 'classic') {
    return COMPACT_MORPH_SCROLL;
  }

  if (layout === 'orderform') {
    const fullHeight = headerEl.offsetHeight;
    return Math.max(40, fullHeight - COMPACT_HEADER_HEIGHT);
  }

  if (layout === 'floating' || layout === 'immersive') {
    const isHeroOverlay = headerEl.classList.contains('storefront-site-header--hero-overlay');
    if (isHeroOverlay) return 24;
    const fullHeight = headerEl.offsetHeight;
    return Math.max(24, fullHeight - COMPACT_HEADER_HEIGHT);
  }

  return 16;
}

interface StorefrontSiteHeaderProps {
  siteSettings: WebsiteSiteSettings;
  store?: StorePublic | null;
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
  /** Inner pages (product, category, etc.) always render the classic top bar. */
  pageSurface?: 'homepage' | 'inner';
  /** Floating/immersive layouts only overlay when the first homepage block is a hero section. */
  heroOverlay?: boolean;
  /** @deprecated Use heroOverlay */
  immersiveOverHero?: boolean;
  /** Builder preview: open product page overlay from header search */
  onProductPreview?: (product: ProductWithCatalogueData) => void;
  /** Builder preview: open category page overlay from header search */
  onCategoryPreview?: (category: { id: string; label: string }) => void;
}

export default function StorefrontSiteHeader({
  siteSettings,
  store,
  basePath = '',
  preview = false,
  onSelectAnnouncement,
  isAnnouncementSelected = false,
  onSelectHeader,
  isHeaderSelected = false,
  pageSurface = 'homepage',
  heroOverlay: heroOverlayProp,
  immersiveOverHero: immersiveOverHeroProp,
  onProductPreview,
  onCategoryPreview,
}: StorefrontSiteHeaderProps) {
  const heroOverlay = heroOverlayProp ?? immersiveOverHeroProp ?? false;
  const headerRef = useRef<HTMLElement>(null);
  const headerScrolledRef = useRef(false);
  const scrollThresholdRef = useRef(60);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [navPortalTarget, setNavPortalTarget] = useState<HTMLElement | null>(null);
  const [openMobileGroupId, setOpenMobileGroupId] = useState<string | null>(null);
  const [openDesktopGroupId, setOpenDesktopGroupId] = useState<string | null>(null);
  const [pinnedSpacerHeight, setPinnedSpacerHeight] = useState(0);
  const navItems = siteSettings.navItems?.length ? siteSettings.navItems : DEFAULT_NAV;
  const layout = headerLayoutForPageSurface(siteSettings.headerVariant, pageSurface);
  const livePinned = !preview && headerScrolled;

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) {
      setNavPortalTarget(null);
      return;
    }
    if (preview) {
      const frame = headerRef.current?.closest('.sites-page-frame');
      setNavPortalTarget((frame as HTMLElement | null) ?? document.body);
    } else {
      setNavPortalTarget(document.body);
    }
  }, [menuOpen, preview]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', onKey);
    if (preview) {
      return () => document.removeEventListener('keydown', onKey);
    }
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

  useEffect(() => {
    headerScrolledRef.current = headerScrolled;
  }, [headerScrolled]);

  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    const scrollRoot = headerEl.closest('.sites-canvas-area') as HTMLElement | null;

    const measureThreshold = () => {
      if (!headerScrolledRef.current) {
        scrollThresholdRef.current = resolveScrollThreshold(headerEl, layout);
      }
    };

    const getScrollOffset = () => (scrollRoot ? scrollRoot.scrollTop : window.scrollY);

    let rafId = 0;

    const updateScrollState = () => {
      rafId = 0;
      const offset = getScrollOffset();
      const enterAt = scrollThresholdRef.current;

      if (!headerScrolledRef.current && offset > enterAt) {
        headerScrolledRef.current = true;
        setHeaderScrolled(true);
        return;
      }

      if (headerScrolledRef.current && offset <= SCROLL_LEAVE_THRESHOLD) {
        headerScrolledRef.current = false;
        setHeaderScrolled(false);
        requestAnimationFrame(measureThreshold);
      }
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(updateScrollState);
    };

    measureThreshold();
    updateScrollState();

    const onResize = () => {
      measureThreshold();
      updateScrollState();
    };

    if (scrollRoot) {
      scrollRoot.addEventListener('scroll', onScroll, { passive: true });
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      scrollRoot?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [
    layout,
    heroOverlay,
    siteSettings.showAnnouncement,
    siteSettings.announcementText,
    siteSettings.announcementMessages,
    siteSettings.announcementRotation,
    siteSettings.announcementRotationInterval,
    siteSettings.headerCenteredLogoSize,
    siteSettings.headerCenteredBrandLayout,
    siteSettings.logoUrl,
  ]);

  useLayoutEffect(() => {
    if (!livePinned) {
      setPinnedSpacerHeight(0);
      return;
    }

    const measure = () => {
      const height = headerRef.current?.offsetHeight ?? 0;
      setPinnedSpacerHeight(height);
    };

    measure();
  }, [
    livePinned,
    layout,
    siteSettings.showAnnouncement,
    siteSettings.announcementText,
    siteSettings.announcementMessages,
    siteSettings.announcementRotation,
    siteSettings.announcementRotationInterval,
    siteSettings.headerCenteredLogoSize,
    siteSettings.headerCenteredBrandLayout,
    siteSettings.logoUrl,
  ]);

  useEffect(() => {
    if (!livePinned) return;

    const measure = () => {
      const height = headerRef.current?.offsetHeight ?? 0;
      setPinnedSpacerHeight(height);
    };

    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, [livePinned]);

  const headerStyle = useMemo(
    () => buildHeaderSurfaceStyle(siteSettings, { scrolled: headerScrolled, layout, heroOverlay }),
    [siteSettings, headerScrolled, layout, heroOverlay]
  );

  const layoutDataAttrs = useMemo(
    () => headerLayoutDataAttributes(siteSettings, layout),
    [siteSettings, layout]
  );

  const headerClassName = `storefront-site-header storefront-site-header--layout-${layout}${
    headerScrolled ? ' is-scrolled' : ''
  }${livePinned ? ' storefront-site-header--pinned-live' : ''}${
    preview ? ' storefront-site-header--preview' : ''
  }${heroOverlay ? ' storefront-site-header--hero-overlay' : ''}`;

  const pinnedSpacer =
    livePinned && pinnedSpacerHeight > 0 ? (
      <div
        className="storefront-site-header__spacer"
        style={{ height: pinnedSpacerHeight }}
        aria-hidden="true"
      />
    ) : null;

  const brandName = siteSettings.websiteName || 'My Store';
  const centeredBrandLayout = siteSettings.headerCenteredBrandLayout || 'logo-beside';
  const showBrandName =
    centeredBrandLayout !== 'logo-only' || !siteSettings.logoUrl;

  const brandContent = (
    <span className="storefront-site-header__brand-inner">
      {siteSettings.logoUrl ? (
        <img
          className="storefront-site-header__logo"
          src={siteSettings.logoUrl}
          alt=""
        />
      ) : null}
      {showBrandName ? (
        <span className="storefront-site-header__brand-name">{brandName}</span>
      ) : null}
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

  const announcementMessages = useMemo(
    () => getActiveSiteAnnouncementMessages(siteSettings),
    [siteSettings.announcementMessages, siteSettings.announcementText]
  );

  const announcementBlock =
    hasVisibleSiteAnnouncement(siteSettings) ? (
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
          <SiteAnnouncementRotator
            messages={announcementMessages}
            animation={resolveSiteAnnouncementRotation(siteSettings)}
            intervalMs={resolveSiteAnnouncementRotationInterval(siteSettings)}
          />
        </button>
      ) : (
        <div
          className="storefront-site-header__announcement"
          style={{
            background: siteSettings.announcementBg || '#111827',
            color: siteSettings.announcementTextColor || '#fff',
          }}
        >
          <SiteAnnouncementRotator
            messages={announcementMessages}
            animation={resolveSiteAnnouncementRotation(siteSettings)}
            intervalMs={resolveSiteAnnouncementRotationInterval(siteSettings)}
          />
        </div>
      )
    ) : null;

  const renderMenuButton = () => (
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
  );

  const renderDesktopNavAndSearch = () => {
    const searchProps = {
      preview,
      onProductPreview,
      onCategoryPreview,
    };

    return (
      <>
        <nav className="storefront-site-header__nav-desktop" aria-label="Main">
          {navItems.map(renderDesktopNavItem)}
          <StorefrontHeaderSearch
            {...searchProps}
            className="storefront-header-search--nav-inline"
          />
        </nav>

        <StorefrontHeaderSearch
          {...searchProps}
          className="storefront-header-search--bar-end"
        />
      </>
    );
  };

  const renderNavChrome = () => (
    <>
      {renderMenuButton()}
      {renderDesktopNavAndSearch()}
    </>
  );

  const mobileMenu = menuOpen ? (
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
  ) : null;

  if (layout === 'orderform') {
    return (
      <>
        <header ref={headerRef} className={headerClassName} style={headerStyle} {...layoutDataAttrs}>
          {announcementBlock}
          <div className="sf-of-header-layout">
            <div className="storefront-site-header__orderform-actions">{renderNavChrome()}</div>
            <StorefrontOrderformHeader
              siteSettings={siteSettings}
              store={store}
              preview={preview}
              onSelectHeader={onSelectHeader}
              isHeaderSelected={isHeaderSelected}
            />
          </div>
        </header>
        {pinnedSpacer}
        {mobileMenu && navPortalTarget ? createPortal(mobileMenu, navPortalTarget) : null}
      </>
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
        {renderMenuButton()}
        {preview ? (
          <span className="storefront-site-header__brand">{brandContent}</span>
        ) : (
          <Link to={basePath || '/'} className="storefront-site-header__brand" onClick={closeMenu}>
            {brandContent}
          </Link>
        )}
        {renderDesktopNavAndSearch()}
      </>
    );
  }

  return (
    <>
      <header ref={headerRef} className={headerClassName} style={headerStyle} {...layoutDataAttrs}>
        {announcementBlock}

        {barContent}
      </header>

      {pinnedSpacer}

      {mobileMenu && navPortalTarget ? createPortal(mobileMenu, navPortalTarget) : null}
    </>
  );
}
