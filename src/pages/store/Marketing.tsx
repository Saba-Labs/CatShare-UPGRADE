import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import {
  fetchMarketingSettings,
  updateMarketingSettings,
} from '../../services/storeMarketingService';
import {
  DEFAULT_MARKETING_SETTINGS,
  type StoreMarketingSettings,
} from '../../types/storeMarketingSettings';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import ToggleSwitch from './components/ToggleSwitch';
import MarketingIntegrationCard from './components/MarketingIntegrationCard';
import { getActiveMarketingIntegrations } from './config/marketingIntegrations';

const fieldClassName =
  'w-full px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <h3 className="font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        {description ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        ) : null}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function Marketing() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [settings, setSettings] = useState<StoreMarketingSettings>(DEFAULT_MARKETING_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<StoreMarketingSettings>(
    DEFAULT_MARKETING_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeMarketingIntegrations = getActiveMarketingIntegrations();

  const loadSettings = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await fetchMarketingSettings(sellerId);
    if (result.error) {
      showToast('Failed to load marketing settings', 'error');
    }
    setSettings(result.data);
    setOriginalSettings(result.data);
    setLoading(false);
  }, [sellerId, showToast]);

  useEffect(() => {
    if (authLoading && !sellerId) return;
    void loadSettings();
  }, [authLoading, sellerId, loadSettings]);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
  const canSave = hasChanges && !saving;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const patch = (partial: Partial<StoreMarketingSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = async () => {
    if (!sellerId || !guardCloudWrite()) return;

    setSaving(true);
    const result = await updateMarketingSettings(sellerId, settings);
    setSaving(false);

    if (result.error || !result.data) {
      showToast('Failed to save marketing settings', 'error');
      return;
    }

    setSettings(result.data);
    setOriginalSettings(result.data);
    showToast('Marketing settings saved', 'success');
  };

  if (loading || authLoading) {
    return (
      <StoreLayout>
        <div className="animate-pulse space-y-6 py-8 max-w-3xl">
          <div className="h-12 w-48 rounded bg-gray-200 dark:bg-gray-800" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 max-w-3xl">
        <PageHeader
          title="Marketing"
          sticky
          actions={(
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave}
              className={`hidden sm:inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                canSave
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        />

        <div className="space-y-6">
          <SettingsCard
            title="SEO"
            description="Help customers find your store on search engines and social platforms."
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Meta Title
                </label>
                <input
                  type="text"
                  value={settings.seo.metaTitle}
                  disabled={saving}
                  onChange={(e) =>
                    patch({ seo: { ...settings.seo, metaTitle: e.target.value } })
                  }
                  placeholder="Your Store — Wholesale Catalogue"
                  className={fieldClassName}
                  maxLength={70}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {settings.seo.metaTitle.length}/70 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Meta Description
                </label>
                <textarea
                  value={settings.seo.metaDescription}
                  disabled={saving}
                  onChange={(e) =>
                    patch({ seo: { ...settings.seo, metaDescription: e.target.value } })
                  }
                  placeholder="Browse our wholesale catalogue and place orders online."
                  rows={3}
                  className={fieldClassName}
                  maxLength={160}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {settings.seo.metaDescription.length}/160 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Keywords
                </label>
                <input
                  type="text"
                  value={settings.seo.keywords}
                  disabled={saving}
                  onChange={(e) =>
                    patch({ seo: { ...settings.seo, keywords: e.target.value } })
                  }
                  placeholder="wholesale, fashion, reseller, catalogue"
                  className={fieldClassName}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Comma-separated keywords for search relevance.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Open Graph Image URL
                </label>
                <input
                  type="url"
                  value={settings.seo.ogImageUrl}
                  disabled={saving}
                  onChange={(e) =>
                    patch({ seo: { ...settings.seo, ogImageUrl: e.target.value } })
                  }
                  placeholder="https://example.com/og-image.jpg"
                  className={fieldClassName}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Image shown when your store link is shared on social media (1200×630 recommended).
                </p>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Tracking & Analytics"
            description="Connect verification and analytics tools to measure performance."
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Google Search Console
                </label>
                <input
                  type="text"
                  value={settings.tracking.googleSearchConsoleVerification}
                  disabled={saving}
                  onChange={(e) =>
                    patch({
                      tracking: {
                        ...settings.tracking,
                        googleSearchConsoleVerification: e.target.value,
                      },
                    })
                  }
                  placeholder="google-site-verification=..."
                  className={fieldClassName}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Paste your Google Search Console verification meta tag content.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Facebook Pixel ID
                </label>
                <input
                  type="text"
                  value={settings.tracking.facebookPixelId}
                  disabled={saving}
                  onChange={(e) =>
                    patch({
                      tracking: { ...settings.tracking, facebookPixelId: e.target.value },
                    })
                  }
                  placeholder="123456789012345"
                  className={fieldClassName}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Google Analytics ID
                </label>
                <input
                  type="text"
                  value={settings.tracking.googleAnalyticsId}
                  disabled={saving}
                  onChange={(e) =>
                    patch({
                      tracking: { ...settings.tracking, googleAnalyticsId: e.target.value },
                    })
                  }
                  placeholder="G-XXXXXXXXXX or UA-XXXXXXXX-X"
                  className={fieldClassName}
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Announcement Bar"
            description="Display a slim banner at the top of your storefront."
          >
            <div className="space-y-4">
              <ToggleRow
                title="Enable announcement bar"
                description="Show a scrolling or static message above your store header."
                checked={settings.promotions.announcementBarEnabled}
                onChange={(announcementBarEnabled) =>
                  patch({
                    promotions: { ...settings.promotions, announcementBarEnabled },
                  })
                }
                disabled={saving}
              />

              {settings.promotions.announcementBarEnabled ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Announcement text
                    </label>
                    <input
                      type="text"
                      value={settings.promotions.announcementText}
                      disabled={saving}
                      onChange={(e) =>
                        patch({
                          promotions: {
                            ...settings.promotions,
                            announcementText: e.target.value,
                          },
                        })
                      }
                      className={fieldClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Link URL (optional)
                    </label>
                    <input
                      type="url"
                      value={settings.promotions.announcementLink}
                      disabled={saving}
                      onChange={(e) =>
                        patch({
                          promotions: {
                            ...settings.promotions,
                            announcementLink: e.target.value,
                          },
                        })
                      }
                      placeholder="https://"
                      className={fieldClassName}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Promo Banner"
            description="Highlight promotions with a prominent storefront banner."
          >
            <div className="space-y-4">
              <ToggleRow
                title="Enable promo banner"
                description="Show a promotional banner on your store homepage."
                checked={settings.promotions.promoBannerEnabled}
                onChange={(promoBannerEnabled) =>
                  patch({
                    promotions: { ...settings.promotions, promoBannerEnabled },
                  })
                }
                disabled={saving}
              />

              {settings.promotions.promoBannerEnabled ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Banner title
                    </label>
                    <input
                      type="text"
                      value={settings.promotions.promoBannerTitle}
                      disabled={saving}
                      onChange={(e) =>
                        patch({
                          promotions: {
                            ...settings.promotions,
                            promoBannerTitle: e.target.value,
                          },
                        })
                      }
                      className={fieldClassName}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Banner message
                    </label>
                    <input
                      type="text"
                      value={settings.promotions.promoBannerMessage}
                      disabled={saving}
                      onChange={(e) =>
                        patch({
                          promotions: {
                            ...settings.promotions,
                            promoBannerMessage: e.target.value,
                          },
                        })
                      }
                      className={fieldClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      CTA button text
                    </label>
                    <input
                      type="text"
                      value={settings.promotions.promoBannerCta}
                      disabled={saving}
                      onChange={(e) =>
                        patch({
                          promotions: {
                            ...settings.promotions,
                            promoBannerCta: e.target.value,
                          },
                        })
                      }
                      className={fieldClassName}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </SettingsCard>

          <SettingsCard
            title="WhatsApp Share"
            description="Make it easy for customers to share your store on WhatsApp."
          >
            <div className="space-y-4">
              <ToggleRow
                title="Enable WhatsApp share"
                description="Show a share button that opens WhatsApp with a pre-filled message."
                checked={settings.sharing.whatsappShareEnabled}
                onChange={(whatsappShareEnabled) =>
                  patch({
                    sharing: { ...settings.sharing, whatsappShareEnabled },
                  })
                }
                disabled={saving}
              />

              {settings.sharing.whatsappShareEnabled ? (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Default share message
                  </label>
                  <textarea
                    value={settings.sharing.whatsappShareMessage}
                    disabled={saving}
                    onChange={(e) =>
                      patch({
                        sharing: {
                          ...settings.sharing,
                          whatsappShareMessage: e.target.value,
                        },
                      })
                    }
                    rows={2}
                    className={fieldClassName}
                  />
                </div>
              ) : null}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Campaigns"
            description="Discount and email marketing tools for your store."
          >
            <div className="space-y-4 divide-y divide-gray-200 dark:divide-gray-800">
              <ToggleRow
                title="Discount campaigns"
                description="Run time-limited discounts and promotional offers."
                checked={settings.campaigns.discountCampaignsEnabled}
                onChange={(discountCampaignsEnabled) =>
                  patch({
                    campaigns: { ...settings.campaigns, discountCampaignsEnabled },
                  })
                }
                disabled={saving}
              />
              <div className="pt-4">
                <ToggleRow
                  title="Email marketing"
                  description="Collect subscribers and send promotional emails."
                  checked={settings.campaigns.emailMarketingEnabled}
                  onChange={(emailMarketingEnabled) =>
                    patch({
                      campaigns: { ...settings.campaigns, emailMarketingEnabled },
                    })
                  }
                  disabled={saving}
                />
              </div>
              <p className="pt-4 text-sm text-gray-600 dark:text-gray-400">
                Campaign automation will connect to your storefront in a future release. Settings
                are saved now for when features go live.
              </p>
            </div>
          </SettingsCard>

          {activeMarketingIntegrations.length > 0 ? (
            <SettingsCard
              title="Advertising Integrations"
              description="Connect paid ad platforms to promote your store."
            >
              <div className="space-y-4">
                {activeMarketingIntegrations.map((integration) => (
                  <MarketingIntegrationCard key={integration.id} integration={integration} />
                ))}
              </div>
            </SettingsCard>
          ) : null}
        </div>
      </div>

      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-4 z-[55]">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className={`w-full py-3 rounded-xl font-medium transition-colors ${
            !canSave
              ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      <div className="hidden md:block fixed bottom-6 right-6">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className={`px-6 py-3 rounded-xl font-medium transition-all shadow-lg ${
            !canSave
              ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 hover:shadow-xl'
          }`}
        >
          {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      {hasChanges ? (
        <div className="hidden md:block fixed bottom-20 right-6 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
          You have unsaved changes
        </div>
      ) : null}
    </StoreLayout>
  );
}
