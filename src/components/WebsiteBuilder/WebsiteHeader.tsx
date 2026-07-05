import type { WebsiteSiteSettings } from '../../types/homepage';
import { storeBasePath } from '../../utils/websiteStorefront';
import StorefrontSiteHeader from '../Storefront/StorefrontSiteHeader';

interface WebsiteHeaderProps {
  slug: string;
  siteSettings: WebsiteSiteSettings;
  onSubdomain?: boolean;
  pageSurface?: 'homepage' | 'inner';
  heroOverlay?: boolean;
  /** @deprecated Use heroOverlay */
  immersiveOverHero?: boolean;
}

export default function WebsiteHeader({
  slug,
  siteSettings,
  onSubdomain,
  pageSurface = 'homepage',
  heroOverlay,
  immersiveOverHero,
}: WebsiteHeaderProps) {
  const basePath = storeBasePath(slug, onSubdomain);
  return (
    <StorefrontSiteHeader
      siteSettings={siteSettings}
      basePath={basePath}
      pageSurface={pageSurface}
      heroOverlay={heroOverlay ?? immersiveOverHero}
    />
  );
}
