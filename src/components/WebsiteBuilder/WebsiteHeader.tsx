import type { WebsiteSiteSettings } from '../../types/homepage';
import StorefrontSiteHeader from '../Storefront/StorefrontSiteHeader';

interface WebsiteHeaderProps {
  slug: string;
  siteSettings: WebsiteSiteSettings;
  onSubdomain?: boolean;
}

export default function WebsiteHeader({ slug, siteSettings, onSubdomain }: WebsiteHeaderProps) {
  const basePath = onSubdomain ? '' : `/store/${slug}`;
  return <StorefrontSiteHeader siteSettings={siteSettings} basePath={basePath || '/'} />;
}
