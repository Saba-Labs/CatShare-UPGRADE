import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import {
  getSellerStore,
  updateStoreSlug,
  updateStoreLiveStatus,
  updateStoreMaintenanceMode,
  updateStoreViewMode,
  updateStoreWhatsapp,
  updateStoreMinimumOrderValue,
  updateStoreCheckoutSettings,
  updateStoreCatalogue,
  normalizeStoreWhatsappInput,
  normalizeStoreMinimumOrderValueInput,
  validateStoreSlug,
  isStoreSlugAvailable,
} from '../../services/storeService';
import { fetchBehaviorSettings, updateBehaviorSettings } from '../../services/storeBehaviorService';
import {
  behaviorFromStoreSettingsState,
  normalizeBehaviorSettings,
} from '../../types/storeBehaviorSettings';
import { normalizeCheckoutSettings } from '../../types/checkoutSettings';
import { buildStorefrontPublicUrl } from '../../utils/storefrontDomain';
import { getAllCatalogues } from '../../config/catalogueConfig';
import {
  readCachedBehaviorSettings,
  readCachedSellerStore,
} from '../../utils/storePageCache';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import ToggleSwitch from './components/ToggleSwitch';
import {
  STORE_CHIP_CLASS,
  STORE_FIELD_CLASS,
  STORE_SAVE_BTN_DISABLED,
  STORE_SAVE_BTN_ENABLED,
} from './storeTypography';
import {
  FiAlertCircle,
  FiCheck,
  FiCopy,
  FiExternalLink,
  FiInfo,
} from 'react-icons/fi';

interface StoreSettingsState {
  // Store Status
  storeEnabled: boolean;
  maintenanceMode: boolean;

  // Store URL
  storeSlug: string;

  // Catalogue Settings
  catalogueId: string;
  productsToShow: 'all' | 'wholesale' | 'reseller' | 'featured' | 'category';
  defaultSorting: 'newest' | 'oldest' | 'price-low' | 'price-high' | 'alphabetical';

  // Display Settings
  viewMode: 'grid' | 'list';
  productImageRatio: 'square' | 'portrait' | 'landscape';
  showPrice: boolean;
  showAvailability: boolean;
  showCategories: boolean;

  // Customer Settings
  whatsappNumber: string;
  minimumOrderValue: string;
  defaultCurrency: string;
  defaultLanguage: string;
  customerNotifications: boolean;
  allowGuestBrowsing: boolean;
  requireLoginBeforeCheckout: boolean;

  // Advanced Settings
  timeZone: string;
  businessCountry: string;
  defaultShippingRegion: string;
  debugMode: boolean;
  developerMode: boolean;
}

type SettingsKey = keyof StoreSettingsState;

const INITIAL_STATE: StoreSettingsState = {
  storeEnabled: true,
  maintenanceMode: false,
  storeSlug: '',
  catalogueId: '',
  productsToShow: 'all',
  defaultSorting: 'newest',
  viewMode: 'grid',
  productImageRatio: 'square',
  showPrice: true,
  showAvailability: true,
  showCategories: true,
  whatsappNumber: '',
  minimumOrderValue: '0',
  defaultCurrency: 'USD',
  defaultLanguage: 'en',
  customerNotifications: true,
  allowGuestBrowsing: true,
  requireLoginBeforeCheckout: false,
  timeZone: 'UTC',
  businessCountry: 'US',
  defaultShippingRegion: 'worldwide',
  debugMode: false,
  developerMode: false,
};

const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'AED', 'SAR', 'ZAR', 'BRL', 'MXN'
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

const TIME_ZONES = [
  'UTC', 'EST', 'CST', 'MST', 'PST', 'GMT', 'CET', 'IST', 'JST', 'AEST', 'NZST'
];

const COUNTRIES = [
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'JP', 'CN', 'IN', 'BR', 'MX', 'ZA', 'AE'
];

const REGIONS = [
  'worldwide', 'north-america', 'europe', 'asia-pacific', 'middle-east', 'africa', 'south-america'
];

export default function StoreSettings() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const [settings, setSettings] = useState<StoreSettingsState>(INITIAL_STATE);
  const [originalSettings, setOriginalSettings] = useState<StoreSettingsState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<SettingsKey, string>>>({});
  const [slugValidation, setSlugValidation] = useState<'available' | 'taken' | 'invalid' | null>(null);
  const [slugValidating, setSlugValidating] = useState(false);
  const [catalogues, setCatalogues] = useState<Array<{ id: string; label: string }>>([]);
  const [tooltipOpen, setTooltipOpen] = useState<string | null>(null);

  const applyLoadedSettings = useCallback(
    (
      store: Awaited<ReturnType<typeof getSellerStore>>['data'] | null | undefined,
      behavior: ReturnType<typeof normalizeBehaviorSettings>
    ) => {
      let checkoutRequireLogin = behavior.requireLoginBeforeCheckout;
      let checkoutAllowGuest = behavior.allowGuestBrowsing;

      if (store?.checkoutSettings?.experience) {
        checkoutRequireLogin = store.checkoutSettings.experience.requireLoginBeforeCheckout;
        checkoutAllowGuest = store.checkoutSettings.experience.allowGuestCheckout;
      }

      if (store) {
        const loadedSettings: StoreSettingsState = {
          ...INITIAL_STATE,
          ...behavior,
          catalogueId: store.catalogueId || '',
          storeSlug: store.storeSlug || '',
          storeEnabled: store.isLive !== false,
          maintenanceMode: store.maintenanceMode === true,
          whatsappNumber: store.storeWhatsapp || '',
          minimumOrderValue:
            store.minimumOrderValue != null ? String(store.minimumOrderValue) : '0',
          viewMode: store.viewMode || 'grid',
          requireLoginBeforeCheckout: checkoutRequireLogin,
          allowGuestBrowsing: checkoutAllowGuest,
        };
        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);
      } else {
        const loadedSettings: StoreSettingsState = {
          ...INITIAL_STATE,
          ...behavior,
        };
        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);
      }
    },
    []
  );

  useLayoutEffect(() => {
    if (!user?.uid) return;

    const cataloguesList = getAllCatalogues(user.uid);
    if (cataloguesList && cataloguesList.length > 0) {
      setCatalogues(cataloguesList.map((cat) => ({ id: cat.id, label: cat.label })));
    }

    const cachedStore = readCachedSellerStore(user.uid);
    const cachedBehavior = readCachedBehaviorSettings(user.uid);
    if (cachedStore || cachedBehavior) {
      applyLoadedSettings(
        cachedStore,
        normalizeBehaviorSettings(cachedBehavior ?? undefined)
      );
      setLoading(false);
    }
  }, [user?.uid, applyLoadedSettings]);

  // Load initial settings
  useEffect(() => {
    if (!user?.uid) return;

    const loadSettings = async () => {
      const hadCache =
        Boolean(readCachedSellerStore(user.uid)) || Boolean(readCachedBehaviorSettings(user.uid));

      if (!hadCache) {
        setLoading(true);
      }

      try {
        const [storeResult, behaviorResult] = await Promise.all([
          getSellerStore(user.uid),
          fetchBehaviorSettings(user.uid),
        ]);

        const behavior = normalizeBehaviorSettings(behaviorResult.data);
        applyLoadedSettings(storeResult.data, behavior);
      } catch (error) {
        console.error('Failed to load store settings:', error);
        showToast('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user?.uid, showToast, applyLoadedSettings]);

  // Check for unsaved changes
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
  const canSave = hasChanges && !saving && slugValidation !== 'taken';

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Validate store slug
  const validateSlug = useCallback(async (slug: string) => {
    if (!user?.uid) return;

    const validation = validateStoreSlug(slug);
    if (!validation.valid) {
      setSlugValidation('invalid');
      return;
    }

    if (slug === originalSettings.storeSlug) {
      setSlugValidation(null);
      return;
    }

    setSlugValidating(true);
    try {
      const result = await isStoreSlugAvailable(slug, user.uid);
      setSlugValidation(result.available ? 'available' : 'taken');
    } finally {
      setSlugValidating(false);
    }
  }, [originalSettings.storeSlug, user?.uid]);

  // Debounced slug validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (settings.storeSlug !== originalSettings.storeSlug) {
        validateSlug(settings.storeSlug);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [settings.storeSlug, originalSettings.storeSlug, validateSlug]);

  // Validate form
  const validateForm = (): boolean => {
    const errors: Partial<Record<SettingsKey, string>> = {};

    // Phone validation
    if (settings.whatsappNumber.trim()) {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(settings.whatsappNumber.replace(/[\s-()]/g, ''))) {
        errors.whatsappNumber = 'Invalid phone number';
      }
    }

    // Store slug validation
    if (!settings.storeSlug.trim()) {
      errors.storeSlug = 'Store slug is required';
    } else if (!/^[a-z0-9-]{3,50}$/.test(settings.storeSlug)) {
      errors.storeSlug = 'Only lowercase letters, numbers, and hyphens allowed';
    } else if (slugValidation === 'taken') {
      errors.storeSlug = 'This slug is already taken';
    }

    // Minimum order value validation
    if (settings.minimumOrderValue) {
      const value = parseFloat(settings.minimumOrderValue);
      if (isNaN(value) || value < 0) {
        errors.minimumOrderValue = 'Must be a valid non-negative number';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle field changes
  const handleChange = (key: SettingsKey, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Clear validation error for this field
    if (validationErrors[key]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!user?.uid) return;

    if (!originalSettings.storeSlug) {
      showToast('Please create a store first', 'error');
      return;
    }

    if (!guardCloudWrite()) return;

    if (!validateForm()) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    setSaving(true);
    const sellerId = user.uid;
    const failures: string[] = [];

    try {
      if (settings.storeSlug !== originalSettings.storeSlug) {
        const result = await updateStoreSlug(sellerId, settings.storeSlug);
        if (!result.success) {
          failures.push(result.error || 'Failed to update store URL');
        }
      }

      if (settings.storeEnabled !== originalSettings.storeEnabled) {
        const result = await updateStoreLiveStatus(sellerId, settings.storeEnabled);
        if (!result.success) {
          failures.push(result.error || 'Failed to update store live status');
        }
      }

      const maintenanceActive = settings.maintenanceMode && settings.storeEnabled;
      const originalMaintenanceActive =
        originalSettings.maintenanceMode && originalSettings.storeEnabled;
      if (maintenanceActive !== originalMaintenanceActive) {
        const result = await updateStoreMaintenanceMode(sellerId, maintenanceActive);
        if (!result.success) {
          failures.push(result.error || 'Failed to update maintenance mode');
        }
      }

      if (settings.minimumOrderValue !== originalSettings.minimumOrderValue) {
        const normalized = normalizeStoreMinimumOrderValueInput(settings.minimumOrderValue);
        if (normalized.ok === false) {
          failures.push(normalized.error);
        } else {
          const result = await updateStoreMinimumOrderValue(sellerId, normalized.value);
          if (!result.success) {
            failures.push(result.error || 'Failed to update minimum order value');
          }
        }
      }

      if (settings.whatsappNumber !== originalSettings.whatsappNumber) {
        const normalized = normalizeStoreWhatsappInput(settings.whatsappNumber);
        if (normalized.ok === false) {
          failures.push(normalized.error);
        } else {
          const result = await updateStoreWhatsapp(sellerId, normalized.value);
          if (!result.success) {
            failures.push(result.error || 'Failed to update WhatsApp number');
          }
        }
      }

      if (settings.viewMode !== originalSettings.viewMode) {
        const result = await updateStoreViewMode(sellerId, settings.viewMode);
        if (!result.success) {
          failures.push(result.error || 'Failed to update view mode');
        }
      }

      if (settings.catalogueId !== originalSettings.catalogueId) {
        const result = await updateStoreCatalogue(sellerId, settings.catalogueId);
        if (!result.success) {
          failures.push(result.error || 'Failed to update catalogue');
        }
      }

      const behaviorChanged =
        JSON.stringify(behaviorFromStoreSettingsState(settings)) !==
          JSON.stringify(behaviorFromStoreSettingsState(originalSettings)) ||
        settings.catalogueId !== originalSettings.catalogueId;

      if (behaviorChanged) {
        const behavior = behaviorFromStoreSettingsState({
          ...settings,
          productsToShow:
            settings.catalogueId !== originalSettings.catalogueId ? 'all' : settings.productsToShow,
        });
        const behaviorResult = await updateBehaviorSettings(sellerId, behavior);
        if (behaviorResult.error) {
          failures.push('Failed to save catalogue and display preferences');
        }
      }

      const loginPrefsChanged =
        settings.requireLoginBeforeCheckout !== originalSettings.requireLoginBeforeCheckout ||
        settings.allowGuestBrowsing !== originalSettings.allowGuestBrowsing;

      if (loginPrefsChanged) {
        const storeResult = await getSellerStore(sellerId);
        if (storeResult.success && storeResult.data) {
          const checkout = normalizeCheckoutSettings(storeResult.data.checkoutSettings);
          const nextCheckout = {
            ...checkout,
            experience: {
              ...checkout.experience,
              requireLoginBeforeCheckout: settings.requireLoginBeforeCheckout,
              allowGuestCheckout: settings.requireLoginBeforeCheckout
                ? false
                : settings.allowGuestBrowsing,
            },
          };
          const checkoutResult = await updateStoreCheckoutSettings(sellerId, nextCheckout);
          if (!checkoutResult.success) {
            failures.push(checkoutResult.error || 'Failed to update checkout login preferences');
          }
        }
      }

      if (failures.length > 0) {
        showToast(failures[0], 'error');
        return;
      }

      setOriginalSettings(settings);
      showToast('Settings saved successfully', 'success');

      // Dispatch custom event to notify StoreView component of changes (especially catalogue_id)
      const event = new CustomEvent('store-updated', { detail: { catalogueIdChanged: settings.catalogueId !== originalSettings.catalogueId } });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const storefrontUrl = settings.storeSlug
    ? buildStorefrontPublicUrl(settings.storeSlug)
    : '';

  const copyStoreUrl = () => {
    if (!storefrontUrl) return;
    void navigator.clipboard.writeText(storefrontUrl);
    showToast('Store link copied to clipboard', 'success');
  };

  const openStore = () => {
    if (!storefrontUrl) return;
    window.open(storefrontUrl, '_blank');
  };

  if (loading || authLoading) {
    return (
      <StoreLayout>
        <div className="animate-pulse space-y-6 py-8">
          <div className="h-12 w-48 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (!originalSettings.storeSlug && !loading) {
    return (
      <StoreLayout>
        <div className="pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-6">
          <PageHeader title="Store Settings" sticky />
          <div className="mt-8 flex items-center justify-center">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-8 max-w-md text-center">
              <FiAlertCircle className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Store Yet</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">You need to create a store first before you can configure settings.</p>
              <button
                onClick={() => navigate('/store')}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Create Store
              </button>
            </div>
          </div>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-6">
        <PageHeader
          title="Store Settings"
          sticky
          actions={(
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={`hidden sm:inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                canSave
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        />

        <div className="space-y-6">
          {/* Store Status Section */}
          <SettingsCard
            title="Store Status"
            description="Control store visibility and maintenance mode"
          >
            <div className="space-y-5">
              <div className="flex items-start justify-between pb-5 border-b border-gray-200 dark:border-gray-800">
                <div className="flex-1">
                  <div className="flex items-center gap-2 relative">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Store Live</h3>
                    <button
                      type="button"
                      onClick={() => setTooltipOpen(tooltipOpen === 'storeLive' ? null : 'storeLive')}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                      aria-label="Store Live information"
                      title="Customers can access your store when enabled."
                    >
                      <FiInfo className="w-4 h-4" />
                    </button>
                    {tooltipOpen === 'storeLive' && (
                      <div className="absolute top-full left-0 mt-2 bg-gray-900 dark:bg-gray-700 text-white text-sm px-2 py-1 rounded whitespace-nowrap z-10">
                        Customers can access your store when enabled.
                      </div>
                    )}
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.storeEnabled}
                  onChange={(value) => {
                    handleChange('storeEnabled', value);
                    if (!value) handleChange('maintenanceMode', false);
                  }}
                  disabled={saving}
                />
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 relative">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Maintenance Mode</h3>
                    <button
                      type="button"
                      onClick={() => setTooltipOpen(tooltipOpen === 'maintenanceMode' ? null : 'maintenanceMode')}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                      aria-label="Maintenance Mode information"
                      title="Temporarily disable customer access while keeping the store available for editing."
                    >
                      <FiInfo className="w-4 h-4" />
                    </button>
                    {tooltipOpen === 'maintenanceMode' && (
                      <div className="absolute top-full left-0 mt-2 bg-gray-900 dark:bg-gray-700 text-white text-sm px-2 py-1 rounded whitespace-nowrap z-10">
                        Temporarily disable customer access while keeping the store available for editing.
                      </div>
                    )}
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.maintenanceMode}
                  onChange={(value) => handleChange('maintenanceMode', value)}
                  disabled={saving || !settings.storeEnabled}
                />
              </div>
            </div>
          </SettingsCard>

          {/* Store URL Section */}
          <SettingsCard
            title="Store URL"
            description="Manage your store's web address"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Store Slug
                </label>
                <input
                  type="text"
                  value={settings.storeSlug}
                  onChange={(e) => handleChange('storeSlug', e.target.value.toLowerCase())}
                  placeholder="my-store"
                  disabled={saving}
                  className={`${STORE_FIELD_CLASS} ${
                    validationErrors.storeSlug
                      ? 'border-red-300 bg-red-50 text-gray-900'
                      : ''
                  }`}
                />

                {/* Slug validation message */}
                {settings.storeSlug && (
                  <div className="mt-2 flex items-center gap-2">
                    {slugValidating ? (
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                        <div className="h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                        Checking availability...
                      </div>
                    ) : slugValidation === 'available' ? (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <FiCheck className="h-4 w-4" />
                        Available
                      </div>
                    ) : slugValidation === 'taken' ? (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <FiAlertCircle className="h-4 w-4" />
                        Already taken
                      </div>
                    ) : slugValidation === 'invalid' ? (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <FiAlertCircle className="h-4 w-4" />
                        Invalid characters or length
                      </div>
                    ) : null}
                  </div>
                )}

                {validationErrors.storeSlug && (
                  <p className="text-red-600 text-sm mt-2">{validationErrors.storeSlug}</p>
                )}
              </div>

              {/* Full URL display */}
              {settings.storeSlug && (
                <div className="bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Your Store URL
                  </p>
                  <p className="font-medium text-gray-900 dark:text-gray-100 break-all">
                    {storefrontUrl || 'Configure your store slug above'}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 flex-col sm:flex-row">
                <button
                  onClick={copyStoreUrl}
                  disabled={!settings.storeSlug || saving}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <FiCopy className="h-4 w-4" />
                  Copy Link
                </button>
                <button
                  onClick={openStore}
                  disabled={!settings.storeSlug || saving}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <FiExternalLink className="h-4 w-4" />
                  Open Store
                </button>
                <button
                  onClick={() => {
                    const base = settings.storeSlug.replace(/-?\d+$/, '');
                    const suggestion = `${base || 'my-store'}-${Math.floor(Math.random() * 900 + 100)}`;
                    handleChange('storeSlug', suggestion);
                    showToast('Suggested slug generated', 'success');
                  }}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Generate Suggestions
                </button>
              </div>
            </div>
          </SettingsCard>

          {/* Catalogue Settings Section */}
          <SettingsCard
            title="Catalogue"
            description="Control which products are displayed"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Products to Show
                </label>
                <select
                  value={settings.catalogueId}
                  onChange={(e) => handleChange('catalogueId', e.target.value)}
                  disabled={saving || catalogues.length === 0}
                  className={STORE_FIELD_CLASS}
                >
                  <option value="">Select a catalogue...</option>
                  {catalogues.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Default Sorting
                </label>
                <select
                  value={settings.defaultSorting}
                  onChange={(e) => handleChange('defaultSorting', e.target.value as any)}
                  disabled={saving}
                  className={STORE_FIELD_CLASS}
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="price-low">Price Low to High</option>
                  <option value="price-high">Price High to Low</option>
                  <option value="alphabetical">Alphabetical</option>
                </select>
              </div>
            </div>
          </SettingsCard>

          {/* Display Settings Section */}
          <SettingsCard
            title="Store Appearance"
            description="Control how products are displayed"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  View Mode
                </label>
                <div className="flex gap-3">
                  {(['grid', 'list'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleChange('viewMode', mode)}
                      disabled={saving}
                      className={`${STORE_CHIP_CLASS} flex-1 ${
                        settings.viewMode === mode
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed capitalize`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Default Product Image Ratio
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['square', 'portrait', 'landscape'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => handleChange('productImageRatio', ratio)}
                      disabled={saving}
                      className={`${STORE_CHIP_CLASS} ${
                        settings.productImageRatio === ratio
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed capitalize text-sm`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900 dark:text-gray-100">Show Product Price</label>
                  <ToggleSwitch
                    checked={settings.showPrice}
                    onChange={(value) => handleChange('showPrice', value)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900 dark:text-gray-100">Show Product Availability</label>
                  <ToggleSwitch
                    checked={settings.showAvailability}
                    onChange={(value) => handleChange('showAvailability', value)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900 dark:text-gray-100">Show Categories</label>
                  <ToggleSwitch
                    checked={settings.showCategories}
                    onChange={(value) => handleChange('showCategories', value)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </SettingsCard>

          {/* Customer Settings Section */}
          <SettingsCard
            title="Customer Experience"
            description="Customize customer interactions"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Customer WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={settings.whatsappNumber}
                  onChange={(e) => handleChange('whatsappNumber', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  disabled={saving}
                  className={`${STORE_FIELD_CLASS} ${
                    validationErrors.whatsappNumber
                      ? 'border-red-300 bg-red-50 text-gray-900'
                      : ''
                  }`}
                />
                {validationErrors.whatsappNumber && (
                  <p className="text-red-600 text-sm mt-2">{validationErrors.whatsappNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Minimum Order Value
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.minimumOrderValue}
                  onChange={(e) => handleChange('minimumOrderValue', e.target.value)}
                  placeholder="0"
                  disabled={saving}
                  className={`${STORE_FIELD_CLASS} ${
                    validationErrors.minimumOrderValue
                      ? 'border-red-300 bg-red-50 text-gray-900'
                      : ''
                  }`}
                />
                {validationErrors.minimumOrderValue && (
                  <p className="text-red-600 text-sm mt-2">{validationErrors.minimumOrderValue}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Default Currency
                </label>
                <select
                  value={settings.defaultCurrency}
                  onChange={(e) => handleChange('defaultCurrency', e.target.value)}
                  disabled={saving}
                  className={STORE_FIELD_CLASS}
                >
                  {CURRENCIES.map((cur) => (
                    <option key={cur} value={cur}>
                      {cur}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Default Language
                </label>
                <select
                  value={settings.defaultLanguage}
                  onChange={(e) => handleChange('defaultLanguage', e.target.value)}
                  disabled={saving}
                  className={STORE_FIELD_CLASS}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </SettingsCard>

        </div>
      </div>

      {/* Sticky Save Button (Mobile) */}
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-4 space-y-2 z-[55]">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED}
        >
          {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      {/* Sticky Save Button (Desktop) */}
      <div className="hidden md:block fixed bottom-6 right-6">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={`${canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED} shadow-lg`}
        >
          {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      {/* Unsaved changes warning */}
      {hasChanges && (
        <div className="hidden md:block fixed bottom-20 right-6 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
          You have unsaved changes
        </div>
      )}
    </StoreLayout>
  );
}
