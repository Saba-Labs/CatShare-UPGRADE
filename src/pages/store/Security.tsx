import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import {
  fetchSecuritySettings,
  updateSecuritySettings,
} from '../../services/storeSecurityService';
import {
  DEFAULT_SECURITY_SETTINGS,
  type StoreSecuritySettings,
  type StoreVisibility,
} from '../../types/storeSecuritySettings';
import { readCachedSecuritySettings } from '../../utils/storePageCache';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import ToggleSwitch from './components/ToggleSwitch';
import { SECURITY_COUNTRY_OPTIONS } from './config/securityPlaceholders';
import {
  FiCheck,
  FiGlobe,
  FiPlus,
  FiShield,
  FiTrash2,
  FiUserX,
} from 'react-icons/fi';
import {
  STORE_CHIP_CLASS,
  STORE_FIELD_CLASS,
  STORE_SAVE_BTN_DISABLED,
  STORE_SAVE_BTN_ENABLED,
} from './storeTypography';

const VISIBILITY_OPTIONS: { value: StoreVisibility; label: string; description: string }[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone with your store link can browse and order.',
  },
  {
    value: 'unlisted',
    label: 'Unlisted',
    description: 'Store is accessible via direct link but hidden from discovery.',
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Storefront is hidden. Only you can preview it.',
  },
];

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

export default function Security() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [settings, setSettings] = useState<StoreSecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<StoreSecuritySettings>(
    DEFAULT_SECURITY_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [blockedInput, setBlockedInput] = useState('');

  useLayoutEffect(() => {
    if (!sellerId) return;
    const cached = readCachedSecuritySettings(sellerId);
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

    const cached = readCachedSecuritySettings(sellerId);
    if (!cached) {
      setLoading(true);
    }

    const result = await fetchSecuritySettings(sellerId);
    if (result.error && !cached) {
      showToast('Failed to load security settings', 'error');
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

  const patch = (partial: Partial<StoreSecuritySettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = async () => {
    if (!sellerId || !guardCloudWrite()) return;

    if (settings.passwordProtected && !settings.storePassword.trim()) {
      showToast('Enter a store password or disable password protection', 'error');
      return;
    }

    setSaving(true);
    const result = await updateSecuritySettings(sellerId, settings);
    setSaving(false);

    if (result.error || !result.data) {
      showToast('Failed to save security settings', 'error');
      return;
    }

    setSettings(result.data);
    setOriginalSettings(result.data);
    showToast('Security settings saved', 'success');
  };

  const toggleCountry = (code: string) => {
    setSettings((prev) => {
      const exists = prev.allowedCountries.includes(code);
      return {
        ...prev,
        allowedCountries: exists
          ? prev.allowedCountries.filter((c) => c !== code)
          : [...prev.allowedCountries, code],
      };
    });
  };

  const addBlockedCustomer = () => {
    const value = blockedInput.trim().toLowerCase();
    if (!value) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      showToast('Enter a valid email address', 'error');
      return;
    }
    if (settings.blockedCustomers.includes(value)) {
      showToast('Customer is already blocked', 'error');
      return;
    }
    patch({ blockedCustomers: [...settings.blockedCustomers, value] });
    setBlockedInput('');
  };

  const removeBlockedCustomer = (email: string) => {
    patch({
      blockedCustomers: settings.blockedCustomers.filter((item) => item !== email),
    });
  };

  if (loading || authLoading) {
    return (
      <StoreLayout>
        <div className="animate-pulse space-y-6 py-8 max-w-3xl">
          <div className="h-12 w-48 rounded bg-gray-200 dark:bg-gray-800" />
          {[...Array(6)].map((_, i) => (
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
          title="Security"
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
            title="Store Visibility"
            description="Choose who can discover and access your storefront."
          >
            <div className="space-y-3">
              {VISIBILITY_OPTIONS.map((option) => {
                const selected = settings.visibility === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={saving}
                    onClick={() => patch({ visibility: option.value })}
                    className={`w-full text-left rounded-xl border p-4 transition-all ${STORE_CHIP_CLASS} ${
                      selected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{option.label}</p>
                        <p className="text-sm mt-1 opacity-80">{option.description}</p>
                      </div>
                      {selected ? <FiCheck className="h-5 w-5 flex-shrink-0" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Password Protected Store"
            description="Require visitors to enter a password before viewing your catalogue."
          >
            <div className="space-y-4">
              <ToggleRow
                title="Enable password protection"
                description="Customers must enter your store password to browse products."
                checked={settings.passwordProtected}
                onChange={(value) => patch({ passwordProtected: value })}
                disabled={saving}
              />
              {settings.passwordProtected ? (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Store Password
                  </label>
                  <input
                    type="password"
                    value={settings.storePassword}
                    disabled={saving}
                    onChange={(e) => patch({ storePassword: e.target.value })}
                    placeholder="Enter a secure password"
                    className={STORE_FIELD_CLASS}
                    autoComplete="new-password"
                  />
                </div>
              ) : null}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Blocked Customers"
            description="Prevent specific customers from placing orders on your store."
          >
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={blockedInput}
                  disabled={saving}
                  onChange={(e) => setBlockedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addBlockedCustomer();
                    }
                  }}
                  placeholder="customer@email.com"
                  className={STORE_FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addBlockedCustomer}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  <FiPlus className="h-4 w-4" />
                  Block
                </button>
              </div>

              {settings.blockedCustomers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                  No blocked customers yet.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  {settings.blockedCustomers.map((email) => (
                    <li
                      key={email}
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50/80 dark:bg-gray-900/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FiUserX className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBlockedCustomer(email)}
                        disabled={saving}
                        className="rounded-lg p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        aria-label={`Unblock ${email}`}
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Allowed Countries"
            description="Restrict checkout to selected countries. Leave empty to allow worldwide orders."
          >
            <div className="flex flex-wrap gap-2">
              {SECURITY_COUNTRY_OPTIONS.map((country) => {
                const selected = settings.allowedCountries.includes(country.code);
                return (
                  <button
                    key={country.code}
                    type="button"
                    disabled={saving}
                    onClick={() => toggleCountry(country.code)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                      selected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                    }`}
                  >
                    <FiGlobe className="h-3.5 w-3.5" />
                    {country.name}
                  </button>
                );
              })}
            </div>
            {settings.allowedCountries.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Worldwide — all countries allowed.
              </p>
            ) : (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {settings.allowedCountries.length} countr
                {settings.allowedCountries.length === 1 ? 'y' : 'ies'} selected.
              </p>
            )}
          </SettingsCard>

          <SettingsCard
            title="Two Factor Authentication"
            description="Add an extra layer of protection when signing in to your merchant account."
          >
            <div className="space-y-4">
              <ToggleRow
                title="Enable two-factor authentication"
                description="Require a verification code from your authenticator app at sign in."
                checked={settings.twoFactorEnabled}
                onChange={(value) => patch({ twoFactorEnabled: value })}
                disabled={saving}
              />
              {settings.twoFactorEnabled ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <FiShield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>
                      Complete authenticator setup to activate 2FA. Until then, your account uses
                      standard password protection only.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </SettingsCard>
        </div>
      </div>

      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-4 z-[55]">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className={canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED}
        >
          {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      <div className="hidden md:block fixed bottom-6 right-6">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className={`${canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED} shadow-lg`}
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
