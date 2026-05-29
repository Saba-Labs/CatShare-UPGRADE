import type { WebsiteSiteSettings } from '../../types/homepage';
import StorefrontFooter from '../Storefront/StorefrontFooter';

interface WebsiteFooterProps {
  siteSettings: WebsiteSiteSettings;
  previewMode?: boolean;
}

/** Global storefront footer — matches OrderForm / classic store layout. */
export default function WebsiteFooter({ siteSettings, previewMode }: WebsiteFooterProps) {
  return <StorefrontFooter siteSettings={siteSettings} previewMode={previewMode} />;
}
