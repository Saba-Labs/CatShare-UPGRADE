import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import ShippingProviderCard from './components/ShippingProviderCard';
import ShippingAddressFields from './components/ShippingAddressFields';
import ToggleSwitch from './components/ToggleSwitch';
import { SHIPPING_PROVIDERS, getActiveShippingProviders } from './config/shippingProviders';
import type { ShippingProviderId } from './config/shippingProviders';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { useSellerIntegrations } from '../../integrations/hooks/useSellerIntegrations';
import { disconnectIntegration } from '../../integrations/core/IntegrationConnectionService';
import { isConnectedStatus } from '../../integrations/core/IntegrationStatusService';
import {
  DEFAULT_SHIPPING_PREFERENCES,
  type ShippingPreferenceMode,
  type ShippingPreferences,
  type ShippingZoneRule,
} from '../../integrations/core/types';
import {
  fetchShippingPreferences,
  updateShippingPreferences,
} from '../../integrations/services/shippingPreferencesService';
import { readCachedShippingPreferences } from '../../utils/storePageCache';
import {
  STORE_CHIP_CLASS,
  STORE_FIELD_CLASS,
  STORE_SAVE_BTN_DISABLED,
  STORE_SAVE_BTN_ENABLED,
} from './storeTypography';

const DELIVERY_MODES: { mode: ShippingPreferenceMode; label: string; description: string }[] = [
  {
    mode: 'actual',
    label: 'Actual Cost',
    description: 'Charge the carrier rate calculated at checkout.',
  },
  {
    mode: 'flat',
    label: 'Flat Rate',
    description: 'Apply a fixed delivery charge on every order.',
  },
  {
    mode: 'free',
    label: 'Free Shipping',
    description: 'Waive delivery charges based on your rules.',
  },
];

export default function Shipping() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();
  const { sellerId, views, loading: integrationsLoading, error: integrationsError, reload } =
    useSellerIntegrations();

  const [settings, setSettings] = useState<ShippingPreferences>(DEFAULT_SHIPPING_PREFERENCES);
  const [originalSettings, setOriginalSettings] = useState<ShippingPreferences>(
    DEFAULT_SHIPPING_PREFERENCES
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<ShippingProviderId | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useLayoutEffect(() => {
    if (!sellerId) return;
    const cached = readCachedShippingPreferences(sellerId);
    if (cached) {
      setSettings(cached);
      setOriginalSettings(cached);
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const cached = readCachedShippingPreferences(sellerId);
      if (!cached) {
        setLoading(true);
      }

      const result = await fetchShippingPreferences(sellerId);
      if (result.error && !cached) {
        showToast('Failed to load shipping settings', 'error');
      }
      const loaded = result.data;
      setSettings(loaded);
      setOriginalSettings(loaded);
      setLoading(false);
    };

    void load();
  }, [sellerId, showToast]);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
  const canSave = hasChanges && !saving && validationErrors.length === 0;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const activeProviders = getActiveShippingProviders();

  const connectedProviders = useMemo(
    () =>
      activeProviders.filter(
        (provider) =>
          provider.integrationProviderId &&
          views.some(
            (view) =>
              view.provider === provider.integrationProviderId &&
              isConnectedStatus(view.status)
          )
      ),
    [views, activeProviders]
  );

  const viewForProvider = (providerId: ShippingProviderId) => {
    const provider = SHIPPING_PROVIDERS.find((item) => item.id === providerId);
    if (!provider?.integrationProviderId) return null;
    return views.find((view) => view.provider === provider.integrationProviderId) ?? null;
  };

  const updateSettings = (patch: Partial<ShippingPreferences>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.useSameAddressForPickup === true) {
        next.pickupAddress = { ...prev.warehouseAddress };
      }
      return next;
    });
    setValidationErrors([]);
  };

  const updateZone = (index: number, patch: Partial<ShippingZoneRule>) => {
    setSettings((prev) => ({
      ...prev,
      shippingZones: prev.shippingZones.map((zone, i) =>
        i === index ? { ...zone, ...patch } : zone
      ),
    }));
    setValidationErrors([]);
  };

  const addZone = () => {
    setSettings((prev) => ({
      ...prev,
      shippingZones: [
        ...prev.shippingZones,
        {
          id: `zone-${Date.now()}`,
          name: 'New Zone',
          regions: '',
          enabled: true,
        },
      ],
    }));
  };

  const removeZone = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      shippingZones: prev.shippingZones.filter((_, i) => i !== index),
    }));
  };

  const validate = (): boolean => {
    const errors: string[] = [];

    if (settings.mode === 'flat' && (settings.flatAmount == null || settings.flatAmount < 0)) {
      errors.push('Enter a valid flat delivery charge.');
    }

    if (
      settings.mode === 'free' &&
      settings.freeAboveAmount != null &&
      settings.freeAboveAmount < 0
    ) {
      errors.push('Free shipping threshold must be zero or greater.');
    }

    if (settings.estimatedDeliveryMinDays > settings.estimatedDeliveryMaxDays) {
      errors.push('Minimum delivery days cannot exceed maximum delivery days.');
    }

    const pincodePattern = /^\d{5,6}$/;
    if (settings.warehouseAddress.pincode && !pincodePattern.test(settings.warehouseAddress.pincode)) {
      errors.push('Warehouse pincode should be 5–6 digits.');
    }
    if (
      !settings.useSameAddressForPickup &&
      settings.pickupAddress.pincode &&
      !pincodePattern.test(settings.pickupAddress.pincode)
    ) {
      errors.push('Pickup pincode should be 5–6 digits.');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = async () => {
    if (!guardCloudWrite() || !sellerId) return;
    if (!validate()) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    setSaving(true);
    const payload: ShippingPreferences = {
      ...settings,
      pickupAddress: settings.useSameAddressForPickup
        ? { ...settings.warehouseAddress }
        : settings.pickupAddress,
    };

    const result = await updateShippingPreferences(sellerId, payload);
    setSaving(false);

    if (result.error || !result.data) {
      showToast('Failed to save shipping settings', 'error');
      return;
    }

    setSettings(result.data);
    setOriginalSettings(result.data);
    showToast('Shipping settings saved', 'success');
  };

  const handleConnect = (providerId: ShippingProviderId) => {
    const provider = SHIPPING_PROVIDERS.find((item) => item.id === providerId);
    if (!provider?.managePath) return;
    navigate(provider.managePath);
  };

  const handleDisconnect = async (providerId: ShippingProviderId) => {
    if (!guardCloudWrite()) return;

    const provider = SHIPPING_PROVIDERS.find((item) => item.id === providerId);
    if (!provider?.integrationProviderId || !sellerId) return;

    if (!window.confirm(`Disconnect ${provider.name} from your store?`)) return;

    setDisconnectingId(providerId);
    const result = await disconnectIntegration(sellerId, provider.integrationProviderId);
    setDisconnectingId(null);

    if (result.error) {
      showToast(
        result.error instanceof Error ? result.error.message : 'Disconnect failed',
        'error'
      );
      return;
    }

    showToast(`${provider.name} disconnected`, 'success');
    await reload();
  };

  if (loading) {
    return (
      <StoreLayout>
        <div className="animate-pulse space-y-6 py-8 max-w-3xl">
          <div className="h-12 w-48 rounded bg-gray-200 dark:bg-gray-800" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 max-w-3xl">
        <PageHeader
          title="Shipping"
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

        {validationErrors.length > 0 ? (
          <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <ul className="list-disc pl-5 space-y-1">
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-6">
          <SettingsCard
            title="Shipping Providers"
            description={
              integrationsLoading
                ? 'Loading provider connections…'
                : connectedProviders.length > 0
                  ? `${connectedProviders.length} provider${connectedProviders.length === 1 ? '' : 's'} connected`
                  : 'Connect a logistics provider to automate fulfillment.'
            }
          >
            {integrationsError ? (
              <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {integrationsError}
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="ml-2 font-semibold underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            ) : null}

            <div className="space-y-4">
              {activeProviders.map((provider) => {
                const view = viewForProvider(provider.id);
                return (
                  <ShippingProviderCard
                    key={provider.id}
                    provider={provider}
                    status={view?.status}
                    displayStatus={view?.displayStatus}
                    loading={integrationsLoading}
                    actionLoading={disconnectingId === provider.id}
                    onConnect={() => handleConnect(provider.id)}
                    onManage={() => handleConnect(provider.id)}
                    onDisconnect={() => void handleDisconnect(provider.id)}
                  />
                );
              })}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Warehouse Address"
            description="Primary warehouse used for inventory and fulfillment."
          >
            <ShippingAddressFields
              idPrefix="warehouse"
              value={settings.warehouseAddress}
              disabled={saving}
              onChange={(warehouseAddress) => {
                setSettings((prev) => ({
                  ...prev,
                  warehouseAddress,
                  pickupAddress: prev.useSameAddressForPickup
                    ? { ...warehouseAddress }
                    : prev.pickupAddress,
                }));
                setValidationErrors([]);
              }}
            />
          </SettingsCard>

          <SettingsCard
            title="Pickup Address"
            description="Where carriers collect packages for delivery."
          >
            <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  Same as warehouse address
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Use your warehouse address for carrier pickups.
                </p>
              </div>
              <ToggleSwitch
                checked={settings.useSameAddressForPickup}
                onChange={(useSameAddressForPickup) =>
                  updateSettings({ useSameAddressForPickup })
                }
                disabled={saving}
              />
            </div>

            {!settings.useSameAddressForPickup ? (
              <ShippingAddressFields
                idPrefix="pickup"
                value={settings.pickupAddress}
                disabled={saving}
                onChange={(pickupAddress) => updateSettings({ pickupAddress })}
              />
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pickup address mirrors your warehouse address.
              </p>
            )}
          </SettingsCard>

          <SettingsCard
            title="Delivery Charges"
            description="Configure how delivery fees are calculated at checkout."
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DELIVERY_MODES.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    disabled={saving}
                    onClick={() => updateSettings({ mode: option.mode })}
                    className={`${STORE_CHIP_CLASS} text-left ${
                      settings.mode === option.mode
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span
                      className={`mt-1 block text-xs ${
                        settings.mode === option.mode
                          ? 'text-blue-100'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>

              {settings.mode === 'flat' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Flat Delivery Charge (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={settings.flatAmount ?? ''}
                    disabled={saving}
                    onChange={(e) =>
                      updateSettings({
                        flatAmount:
                          e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    className={STORE_FIELD_CLASS}
                  />
                </div>
              ) : null}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Free Shipping Rules"
            description="Offer free delivery when order value meets your threshold."
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Enable free shipping threshold
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Waive delivery charges when the cart subtotal exceeds the amount below.
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.mode === 'free'}
                  onChange={(enabled) =>
                    updateSettings({ mode: enabled ? 'free' : 'actual' })
                  }
                  disabled={saving}
                />
              </div>

              {settings.mode === 'free' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Free shipping above (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Leave empty for always free"
                    value={settings.freeAboveAmount ?? ''}
                    disabled={saving}
                    onChange={(e) =>
                      updateSettings({
                        freeAboveAmount:
                          e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    className={STORE_FIELD_CLASS}
                  />
                </div>
              ) : null}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Additional Charges"
            description="Service, packaging, and handling fees added during checkout."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Service Charges (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={settings.serviceCharge}
                  disabled={saving}
                  onChange={(e) =>
                    updateSettings({ serviceCharge: Number(e.target.value) || 0 })
                  }
                  className={STORE_FIELD_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Packaging Charges (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={settings.packagingCharge}
                  disabled={saving}
                  onChange={(e) =>
                    updateSettings({ packagingCharge: Number(e.target.value) || 0 })
                  }
                  className={STORE_FIELD_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Handling Charges (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={settings.handlingCharge}
                  disabled={saving}
                  onChange={(e) =>
                    updateSettings({ handlingCharge: Number(e.target.value) || 0 })
                  }
                  className={STORE_FIELD_CLASS}
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Estimated Delivery Time"
            description="Set customer-facing delivery expectations on your storefront."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Minimum Days
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={settings.estimatedDeliveryMinDays}
                  disabled={saving}
                  onChange={(e) =>
                    updateSettings({
                      estimatedDeliveryMinDays: Number(e.target.value) || 1,
                    })
                  }
                  className={STORE_FIELD_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Maximum Days
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={settings.estimatedDeliveryMaxDays}
                  disabled={saving}
                  onChange={(e) =>
                    updateSettings({
                      estimatedDeliveryMaxDays: Number(e.target.value) || 1,
                    })
                  }
                  className={STORE_FIELD_CLASS}
                />
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Customers will see delivery estimates between{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {settings.estimatedDeliveryMinDays}–{settings.estimatedDeliveryMaxDays} business days
              </span>
              .
            </p>
          </SettingsCard>

          <SettingsCard
            title="Tracking Settings"
            description="Control shipment tracking visibility and customer notifications."
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Enable shipment tracking
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Sync tracking updates from connected shipping providers.
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.trackingEnabled}
                  onChange={(trackingEnabled) => updateSettings({ trackingEnabled })}
                  disabled={saving}
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Notify customer on ship
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Send a notification when the order is dispatched.
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.notifyCustomerOnShip}
                  onChange={(notifyCustomerOnShip) => updateSettings({ notifyCustomerOnShip })}
                  disabled={saving || !settings.trackingEnabled}
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Show tracking link to customers
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Display a tracking link on order confirmation and order status pages.
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.showTrackingLink}
                  onChange={(showTrackingLink) => updateSettings({ showTrackingLink })}
                  disabled={saving || !settings.trackingEnabled}
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Shipping Zones"
            description="Define regions where you deliver and control zone availability."
          >
            <div className="space-y-4">
              {settings.shippingZones.map((zone, index) => (
                <div
                  key={zone.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Zone Name
                        </label>
                        <input
                          type="text"
                          value={zone.name}
                          disabled={saving}
                          onChange={(e) => updateZone(index, { name: e.target.value })}
                          className={STORE_FIELD_CLASS}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Regions
                        </label>
                        <input
                          type="text"
                          value={zone.regions}
                          disabled={saving}
                          onChange={(e) => updateZone(index, { regions: e.target.value })}
                          className={STORE_FIELD_CLASS}
                          placeholder="States, pincodes, or countries"
                        />
                      </div>
                    </div>

                    {settings.shippingZones.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeZone(index)}
                        disabled={saving}
                        className="mt-8 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        aria-label={`Remove ${zone.name}`}
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Zone enabled
                    </span>
                    <ToggleSwitch
                      checked={zone.enabled}
                      onChange={(enabled) => updateZone(index, { enabled })}
                      disabled={saving}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addZone}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <FiPlus className="h-4 w-4" />
                Add Shipping Zone
              </button>
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
