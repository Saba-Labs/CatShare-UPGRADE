import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getSellerStore } from '../../services/storeService';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import ToggleSwitch from './components/ToggleSwitch';
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
  productsToShow: 'all' | 'wholesale' | 'reseller' | 'featured' | 'category';
  maxProducts: number;
  defaultSorting: 'newest' | 'oldest' | 'price-low' | 'price-high' | 'alphabetical';

  // Display Settings
  viewMode: 'grid' | 'list';
  productImageRatio: 'square' | 'portrait' | 'landscape';
  productsPerRow: '1' | '2' | '3' | '4';
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
  productsToShow: 'all',
  maxProducts: 100,
  defaultSorting: 'newest',
  viewMode: 'grid',
  productImageRatio: 'square',
  productsPerRow: '2',
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [settings, setSettings] = useState<StoreSettingsState>(INITIAL_STATE);
  const [originalSettings, setOriginalSettings] = useState<StoreSettingsState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<SettingsKey, string>>>({});
  const [slugValidation, setSlugValidation] = useState<'available' | 'taken' | 'invalid' | null>(null);
  const [slugValidating, setSlugValidating] = useState(false);

  // Load initial settings
  useEffect(() => {
    if (!user?.uid) return;

    const loadSettings = async () => {
      try {
        const result = await getSellerStore(user.uid);
        if (result.success && result.data) {
          const store = result.data;
          const loadedSettings: StoreSettingsState = {
            ...INITIAL_STATE,
            storeSlug: store.storeSlug || '',
            storeEnabled: store.isLive !== false,
            whatsappNumber: store.storeWhatsapp || '',
            minimumOrderValue: store.minimumOrderValue?.toString() || '0',
            viewMode: store.viewMode || 'grid',
          };
          setSettings(loadedSettings);
          setOriginalSettings(loadedSettings);
        }
      } catch (error) {
        console.error('Failed to load store settings:', error);
        showToast('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user?.uid, showToast]);

  // Check for unsaved changes
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  // Validate store slug
  const validateSlug = useCallback(async (slug: string) => {
    if (!slug.trim()) {
      setSlugValidation('invalid');
      return;
    }

    if (!/^[a-z0-9-]{3,50}$/.test(slug)) {
      setSlugValidation('invalid');
      return;
    }

    setSlugValidating(true);
    try {
      // Simulate slug availability check
      // In production, this would call a real API endpoint
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (slug === originalSettings.storeSlug) {
        setSlugValidation(null);
      } else {
        // Simulate checking against existing slugs
        const takenSlugs = ['admin', 'store', 'api', 'dashboard'];
        setSlugValidation(takenSlugs.includes(slug.toLowerCase()) ? 'taken' : 'available');
      }
    } finally {
      setSlugValidating(false);
    }
  }, [originalSettings.storeSlug]);

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
    if (!validateForm()) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    setSaving(true);
    try {
      // Simulate API call to save settings
      await new Promise(resolve => setTimeout(resolve, 800));

      // Update original settings to mark as no longer changed
      setOriginalSettings(settings);
      showToast('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle copy store URL
  const copyStoreUrl = () => {
    if (settings.storeSlug) {
      const url = `my.catshare.app/${settings.storeSlug}`;
      navigator.clipboard.writeText(url);
      showToast('Store URL copied to clipboard', 'success');
    }
  };

  // Handle open store
  const openStore = () => {
    if (settings.storeSlug) {
      window.open(`https://my.catshare.app/${settings.storeSlug}`, '_blank');
    }
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

  return (
    <StoreLayout>
      <div className="pb-24 md:pb-6">
        <PageHeader
          title="Store Settings"
          description="Configure how your store behaves and how customers interact with it."
        />

        <div className="space-y-6">
          {/* Store Status Section */}
          <SettingsCard
            title="Store Status"
            description="Control store visibility and maintenance mode"
          >
            <div className="space-y-5">
              <div className="flex items-start justify-between pb-5 border-b border-gray-200">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Store Live</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Customers can access your store when enabled.
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.storeEnabled}
                  onChange={(value) => handleChange('storeEnabled', value)}
                  disabled={saving}
                />
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Maintenance Mode</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Temporarily disable customer access while keeping the store available for editing.
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.maintenanceMode}
                  onChange={(value) => handleChange('maintenanceMode', value)}
                  disabled={saving}
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
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Store Slug
                </label>
                <input
                  type="text"
                  value={settings.storeSlug}
                  onChange={(e) => handleChange('storeSlug', e.target.value.toLowerCase())}
                  placeholder="my-store"
                  disabled={saving}
                  className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
                    validationErrors.storeSlug
                      ? 'border-red-300 bg-red-50 text-gray-900'
                      : 'border-gray-300 bg-white text-gray-900'
                  } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />

                {/* Slug validation message */}
                {settings.storeSlug && (
                  <div className="mt-2 flex items-center gap-2">
                    {slugValidating ? (
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
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
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                    Your Store URL
                  </p>
                  <p className="font-medium text-gray-900 break-all">
                    my.catshare.app/{settings.storeSlug}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 flex-col sm:flex-row">
                <button
                  onClick={copyStoreUrl}
                  disabled={!settings.storeSlug || saving}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <FiCopy className="h-4 w-4" />
                  Copy Link
                </button>
                <button
                  onClick={openStore}
                  disabled={!settings.storeSlug || saving}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <FiExternalLink className="h-4 w-4" />
                  Open Store
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
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Products to Show
                </label>
                <select
                  value={settings.productsToShow}
                  onChange={(e) => handleChange('productsToShow', e.target.value as any)}
                  disabled={saving}
                  className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="all">All Products</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="reseller">Reseller</option>
                  <option value="featured">Featured Collection</option>
                  <option value="category">Category</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Maximum Products
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={settings.maxProducts}
                  onChange={(e) => handleChange('maxProducts', parseInt(e.target.value) || 100)}
                  disabled={saving}
                  className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Default Sorting
                </label>
                <select
                  value={settings.defaultSorting}
                  onChange={(e) => handleChange('defaultSorting', e.target.value as any)}
                  disabled={saving}
                  className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
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
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  View Mode
                </label>
                <div className="flex gap-3">
                  {(['grid', 'list'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleChange('viewMode', mode)}
                      disabled={saving}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                        settings.viewMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      } disabled:opacity-50 disabled:cursor-not-allowed capitalize`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Default Product Image Ratio
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['square', 'portrait', 'landscape'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => handleChange('productImageRatio', ratio)}
                      disabled={saving}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                        settings.productImageRatio === ratio
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      } disabled:opacity-50 disabled:cursor-not-allowed capitalize text-sm`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Products Per Row
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {(['1', '2', '3', '4'] as const).map((num) => (
                    <button
                      key={num}
                      onClick={() => handleChange('productsPerRow', num)}
                      disabled={saving}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                        settings.productsPerRow === num
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900">Show Product Price</label>
                  <ToggleSwitch
                    checked={settings.showPrice}
                    onChange={(value) => handleChange('showPrice', value)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900">Show Product Availability</label>
                  <ToggleSwitch
                    checked={settings.showAvailability}
                    onChange={(value) => handleChange('showAvailability', value)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900">Show Categories</label>
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
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Customer WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={settings.whatsappNumber}
                  onChange={(e) => handleChange('whatsappNumber', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  disabled={saving}
                  className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
                    validationErrors.whatsappNumber
                      ? 'border-red-300 bg-red-50 text-gray-900'
                      : 'border-gray-300 bg-white text-gray-900'
                  } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
                {validationErrors.whatsappNumber && (
                  <p className="text-red-600 text-sm mt-2">{validationErrors.whatsappNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
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
                  className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
                    validationErrors.minimumOrderValue
                      ? 'border-red-300 bg-red-50 text-gray-900'
                      : 'border-gray-300 bg-white text-gray-900'
                  } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
                {validationErrors.minimumOrderValue && (
                  <p className="text-red-600 text-sm mt-2">{validationErrors.minimumOrderValue}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Default Currency
                </label>
                <select
                  value={settings.defaultCurrency}
                  onChange={(e) => handleChange('defaultCurrency', e.target.value)}
                  disabled={saving}
                  className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {CURRENCIES.map((cur) => (
                    <option key={cur} value={cur}>
                      {cur}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Default Language
                </label>
                <select
                  value={settings.defaultLanguage}
                  onChange={(e) => handleChange('defaultLanguage', e.target.value)}
                  disabled={saving}
                  className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900">Customer Notifications</label>
                  <ToggleSwitch
                    checked={settings.customerNotifications}
                    onChange={(value) => handleChange('customerNotifications', value)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900">Allow Guest Browsing</label>
                  <ToggleSwitch
                    checked={settings.allowGuestBrowsing}
                    onChange={(value) => handleChange('allowGuestBrowsing', value)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900">Require Login Before Checkout</label>
                  <ToggleSwitch
                    checked={settings.requireLoginBeforeCheckout}
                    onChange={(value) => handleChange('requireLoginBeforeCheckout', value)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </SettingsCard>

          {/* Advanced Settings Section */}
          <SettingsCard
            title="Advanced Settings"
            description="For experienced users and developers"
          >
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <FiInfo className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  These settings are for future functionality and developer use.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Store Time Zone
                </label>
                <select
                  value={settings.timeZone}
                  onChange={(e) => handleChange('timeZone', e.target.value)}
                  disabled={saving}
                  className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {TIME_ZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Business Country
                </label>
                <select
                  value={settings.businessCountry}
                  onChange={(e) => handleChange('businessCountry', e.target.value)}
                  disabled={saving}
                  className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Default Shipping Region
                </label>
                <select
                  value={settings.defaultShippingRegion}
                  onChange={(e) => handleChange('defaultShippingRegion', e.target.value)}
                  disabled={saving}
                  className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900">Enable Debug Mode</label>
                  <ToggleSwitch
                    checked={settings.debugMode}
                    onChange={(value) => handleChange('debugMode', value)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-start justify-between">
                  <label className="font-medium text-gray-900">Developer Mode</label>
                  <ToggleSwitch
                    checked={settings.developerMode}
                    onChange={(value) => handleChange('developerMode', value)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </SettingsCard>
        </div>
      </div>

      {/* Sticky Save Button (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 p-4 space-y-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving || slugValidation === 'taken'}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            !hasChanges || saving || slugValidation === 'taken'
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      {/* Sticky Save Button (Desktop) */}
      <div className="hidden md:block fixed bottom-6 right-6">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving || slugValidation === 'taken'}
          className={`px-6 py-3 rounded-lg font-medium transition-all shadow-lg ${
            !hasChanges || saving || slugValidation === 'taken'
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 hover:shadow-xl'
          }`}
        >
          {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      {/* Unsaved changes warning */}
      {hasChanges && (
        <div className="hidden md:block fixed bottom-20 right-6 text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-200">
          You have unsaved changes
        </div>
      )}
    </StoreLayout>
  );
}
