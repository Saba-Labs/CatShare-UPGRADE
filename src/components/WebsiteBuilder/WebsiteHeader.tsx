import type { WebsiteSiteSettings } from '../../types/homepage';
import { storeBasePath } from '../../utils/websiteStorefront';
import StorefrontSiteHeader from '../Storefront/StorefrontSiteHeader';

interface WebsiteHeaderProps {
  slug: string;
  siteSettings: WebsiteSiteSettings;
  onSubdomain?: boolean;
  pageSurface?: 'homepage' | 'inner';
  immersiveOverHero?: boolean;
}

export default function WebsiteHeader({
  slug,
  siteSettings,
  onSubdomain,
  pageSurface = 'homepage',
  immersiveOverHero = false,
}: WebsiteHeaderProps) {
  const basePath = storeBasePath(slug, onSubdomain);
  return (
    <StorefrontSiteHeader
      siteSettings={siteSettings}
      basePath={basePath}
      pageSurface={pageSurface}
      immersiveOverHero={immersiveOverHero}
    />
  );
}
