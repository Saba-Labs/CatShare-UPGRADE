import React from 'react';
import { WebsiteModeConfig } from '../../types/homepage';

function getSitemapPublicUrl(storeSlug: string): string {
  const envBase = String(import.meta.env.VITE_APP_URL || import.meta.env.VITE_PUBLIC_WEB_BASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const origin =
    envBase || (typeof window !== 'undefined' ? window.location.origin : 'https://catshare.app');
  return `${origin}/api/store-sitemap?slug=${encodeURIComponent(storeSlug)}`;
}
import MediaPickerButton from './media/MediaPickerButton';

interface SeoSettingsPanelProps {
  websiteConfig: WebsiteModeConfig;
  storeId: string;
  storeSlug?: string;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  /** Inside a sidebar card — omit outer section chrome */
  embedded?: boolean;
}

export default function SeoSettingsPanel({
  websiteConfig,
  storeId,
  storeSlug,
  onUpdateWebsiteConfig,
  embedded = false,
}: SeoSettingsPanelProps) {
  const seo = websiteConfig.seo || {};
  const siteName = websiteConfig.siteSettings.websiteName || 'My Store';

  const patchSeo = (updates: Partial<typeof seo>) => {
    onUpdateWebsiteConfig({ seo: { ...seo, ...updates } });
  };

  const sitemapUrl = storeSlug ? getSitemapPublicUrl(storeSlug) : null;

  return (
    <>
      {!embedded && (
        <>
          <div className="sidebar-panel-divider" />
          <div className="sidebar-panel-header">
            <h3>SEO</h3>
          </div>
          <p className="sidebar-hint">Search and social preview for your live storefront.</p>
        </>
      )}

      <div className="sidebar-field">
        <label className="panel-label">Page title</label>
        <input
          className="panel-input"
          placeholder={siteName}
          value={seo.metaTitle || ''}
          onChange={(e) => patchSeo({ metaTitle: e.target.value })}
        />
        <p className="sidebar-field-hint">Leave empty to use site name on the home page.</p>
      </div>

      <div className="sidebar-field">
        <label className="panel-label">Meta description</label>
        <textarea
          className="panel-textarea"
          rows={3}
          placeholder="Describe your store for Google and social shares…"
          value={seo.metaDescription || ''}
          onChange={(e) => patchSeo({ metaDescription: e.target.value })}
        />
      </div>

      <div className="sidebar-field">
        <label className="panel-label">Keywords</label>
        <input
          className="panel-input"
          placeholder="e.g. fashion, wholesale, Mumbai"
          value={seo.keywords || ''}
          onChange={(e) => patchSeo({ keywords: e.target.value })}
        />
      </div>

      <div className="sidebar-field">
        <label className="panel-label">Social share image</label>
        <MediaPickerButton
          storeId={storeId}
          assetKey="seo-og-image"
          label="Choose OG image"
          currentUrl={seo.ogImageUrl}
          onUrl={(url) => patchSeo({ ogImageUrl: url })}
        />
      </div>

      <div className="sidebar-field">
        <label className="panel-label">Favicon</label>
        <MediaPickerButton
          storeId={storeId}
          assetKey="seo-favicon"
          label="Choose favicon"
          currentUrl={seo.faviconUrl}
          onUrl={(url) => patchSeo({ faviconUrl: url })}
        />
        <p className="sidebar-field-hint">If not set, the store logo will be used automatically.</p>
      </div>

      <label className="sidebar-toggle">
        <input
          type="checkbox"
          checked={seo.allowIndexing !== false}
          onChange={(e) => patchSeo({ allowIndexing: e.target.checked })}
        />
        <span>Allow search engines to index</span>
      </label>

      <div className="sidebar-field">
        <label className="panel-label">Google site verification</label>
        <input
          className="panel-input"
          placeholder="verification code only"
          value={seo.googleSiteVerification || ''}
          onChange={(e) => patchSeo({ googleSiteVerification: e.target.value })}
        />
      </div>

      {sitemapUrl && (
        <div className="sidebar-field seo-sitemap-box">
          <label className="panel-label">Sitemap</label>
          <p className="sidebar-hint" style={{ wordBreak: 'break-all' }}>
            Submit in Google Search Console:
          </p>
          <code className="seo-sitemap-url">{sitemapUrl}</code>
          <button
            type="button"
            className="btn-secondary btn-sm"
            style={{ marginTop: 8, width: '100%' }}
            onClick={() => {
              void navigator.clipboard.writeText(sitemapUrl);
            }}
          >
            Copy sitemap URL
          </button>
        </div>
      )}
    </>
  );
}
