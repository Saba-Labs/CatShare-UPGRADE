import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
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
import { readCachedMarketingSettings } from '../../utils/storePageCache';
import StoreLayout, { STORE_SCROLL_SAVE_BOTTOM_PADDING_CLASS } from './components/StoreLayout';
import StoreSaveBar from './components/StoreSaveBar';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import ToggleSwitch from './components/ToggleSwitch';
import { FiInfo } from 'react-icons/fi';
import {
  STORE_FIELD_CLASS,
} from './storeTypography';

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
  tooltipOpen,
  onTooltipToggle,
  tooltipKey,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  tooltipOpen?: string | null;
  onTooltipToggle?: (key: string) => void;
  tooltipKey?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <div className="flex items-center gap-2 relative">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">{title}</h3>
          {description && onTooltipToggle && tooltipKey ? (
            <>
              <button
                type="button"
                onClick={() => onTooltipToggle(tooltipKey)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                aria-label={`${title} information`}
                title={description}
              >
                <FiInfo className="w-4 h-4" />
              </button>
              {tooltipOpen === tooltipKey && (
                <div className="absolute top-full left-0 mt-2 bg-gray-900 dark:bg-gray-700 text-white text-sm px-2 py-1 rounded whitespace-nowrap z-10">
                  {description}
                </div>
              )}
            </>
          ) : null}
        </div>
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
  const [tooltipOpen, setTooltipOpen] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!sellerId) return;
    const cached = readCachedMarketingSettings(sellerId);
    if (cached) {
      setSettings(cached);
      setOriginalSettings(cached);
      setLoading(false);
    }
  }, [sellerId]);

  const loadSettings = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const cached = readCachedMarketingSettings(sellerId);
    if (!cached) {
      setLoading(true);
    }

    const result = await fetchMarketingSettings(sellerId);
    if (result.error && !cached) {
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
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className={`${STORE_SCROLL_SAVE_BOTTOM_PADDING_CLASS} max-w-3xl`}>
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
            description="Help customers find your general store on search engines and when links are shared."
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Image shown when your store link is shared on social media (1200×630 recommended).
                </p>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Google Search Console"
            description="Verify your general store with Google Search Console."
          >
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Verification token
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
                placeholder="google-site-verification=…"
                className={STORE_FIELD_CLASS}
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Paste the meta tag content from Google Search Console. Applies to your general
                store only; custom website pages use Homepage Builder SEO.
              </p>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Announcement Bar"
            description="Display a slim banner at the top of your general store (catalog mode)."
          >
            <div className="space-y-4">
              <ToggleRow
                title="Enable announcement bar"
                description="Shown on your general store. Custom website stores use Homepage Builder announcement settings instead."
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
                      className={STORE_FIELD_CLASS}
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
                      className={STORE_FIELD_CLASS}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </SettingsCard>
        </div>
      </div>

      <StoreSaveBar
        hasChanges={hasChanges}
        saving={saving}
        canSave={canSave}
        onSave={() => void handleSave()}
      />
    </StoreLayout>
  );
}
