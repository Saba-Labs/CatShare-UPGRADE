import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StoreLayout, { STORE_SCROLL_SAVE_BOTTOM_PADDING_CLASS } from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import StoreSaveBar from './components/StoreSaveBar';
import { SHIPPING_PROVIDERS } from './config/shippingProviders';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { getSellerStore, updateStoreCheckoutSettings } from '../../services/storeService';
import { readCachedSellerStore } from '../../utils/storePageCache';
import { useSellerIntegrations } from '../../integrations/hooks/useSellerIntegrations';
import { disconnectIntegration } from '../../integrations/core/IntegrationConnectionService';
import {
  canConnect,
  canDisconnect,
  getIntegrationStatusBadge,
  isConnectedStatus,
} from '../../integrations/core/IntegrationStatusService';
import {
  DEFAULT_CHECKOUT_SETTINGS,
  normalizeCheckoutSettings,
  type StoreCheckoutSettings,
  type StoreShippingCollectionMode,
} from '../../types/checkoutSettings';

const FULFILLMENT_OPTIONS: Array<{
  id: StoreShippingCollectionMode;
  title: string;
  hint: string;
}> = [
  {
    id: 'manual',
    title: 'Manual',
    hint: 'You pack and dispatch orders yourself — no courier integration at checkout.',
  },
  {
    id: 'provider',
    title: 'Shipping provider',
    hint: 'Connect Shiprocket for AWB creation and delivery tracking.',
  },
];

const SHIPROCKET_PROVIDER = SHIPPING_PROVIDERS.find((p) => p.id === 'shiprocket')!;

export default function Shipping() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();
  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';
  const { views, loading: integrationsLoading, error, reload } = useSellerIntegrations();
  const [disconnecting, setDisconnecting] = useState(false);

  const [settings, setSettings] = useState<StoreCheckoutSettings>(DEFAULT_CHECKOUT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<StoreCheckoutSettings>(DEFAULT_CHECKOUT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const shiprocketView = views.find((v) => v.provider === 'shiprocket');
  const shiprocketConnected =
    shiprocketView != null && isConnectedStatus(shiprocketView.status) && !shiprocketView.isDemo;
  const shiprocketStatus = shiprocketView?.status ?? 'not_connected';
  const shiprocketBadge = getIntegrationStatusBadge(shiprocketStatus);
  const providerBlocked =
    settings.shippingCollectionMode === 'provider' && !shiprocketConnected;

  useLayoutEffect(() => {
    if (!sellerId) return;
    const cached = readCachedSellerStore(sellerId);
    if (cached) {
      const loaded = normalizeCheckoutSettings(cached.checkoutSettings);
      setSettings(loaded);
      setOriginalSettings(loaded);
      setLoading(false);
    }
  }, [sellerId]);

  const loadSettings = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    const cached = readCachedSellerStore(sellerId);
    if (cached) {
      const loaded = normalizeCheckoutSettings(cached.checkoutSettings);
      setSettings(loaded);
      setOriginalSettings(loaded);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const result = await getSellerStore(sellerId);
    if (!result.success || !result.data) {
      if (!cached) setLoading(false);
      return;
    }
    const loaded = normalizeCheckoutSettings(result.data.checkoutSettings);
    setSettings(loaded);
    setOriginalSettings(loaded);
    setLoading(false);
  }, [sellerId]);

  useEffect(() => {
    if (authLoading) return;
    void loadSettings();
  }, [authLoading, loadSettings]);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(originalSettings),
    [settings, originalSettings]
  );

  const patchSettings = (patch: Partial<StoreCheckoutSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    if (!guardCloudWrite() || !sellerId) return;
    if (providerBlocked) {
      showToast('Connect Shiprocket before using shipping provider mode', 'error');
      return;
    }

    setSaving(true);
    const result = await updateStoreCheckoutSettings(sellerId, settings);
    setSaving(false);

    if (!result.success || !result.data) {
      showToast(result.error ?? 'Could not save shipping settings', 'error');
      return;
    }
    const saved = normalizeCheckoutSettings(result.data.checkoutSettings);
    setSettings(saved);
    setOriginalSettings(saved);
    showToast('Shipping settings saved', 'success');
  };

  const handleShiprocketAction = () => {
    navigate(SHIPROCKET_PROVIDER.managePath!);
  };

  const handleDisconnectShiprocket = async () => {
    if (!guardCloudWrite() || !sellerId) return;
    if (!window.confirm('Disconnect Shiprocket from your store?')) return;

    setDisconnecting(true);
    const result = await disconnectIntegration(sellerId, 'shiprocket');
    setDisconnecting(false);

    if (result.error) {
      showToast(
        result.error instanceof Error ? result.error.message : 'Disconnect failed',
        'error'
      );
      return;
    }
    showToast('Shiprocket disconnected', 'success');
    await reload();
  };

  return (
    <StoreLayout>
      <PageHeader title="Shipping" description="How you fulfill orders." />

      <div className={`max-w-lg space-y-6 ${STORE_SCROLL_SAVE_BOTTOM_PADDING_CLASS}`}>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-2" role="radiogroup" aria-label="Fulfillment method">
            {FULFILLMENT_OPTIONS.map(({ id, title, hint }) => {
              const selected = settings.shippingCollectionMode === id;
              return (
                <div
                  key={id}
                  className={`rounded-xl border transition-colors ${
                    selected
                      ? 'border-gray-900 dark:border-gray-200 bg-white dark:bg-gray-900/60'
                      : 'border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/30'
                  }`}
                >
                  <label className="flex cursor-pointer items-start gap-3 p-4">
                    <input
                      type="radio"
                      name="shippingCollectionMode"
                      className="mt-1 h-4 w-4 flex-shrink-0 accent-gray-900 dark:accent-gray-100"
                      checked={selected}
                      onChange={() => patchSettings({ shippingCollectionMode: id })}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {title}
                      </span>
                      <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">
                        {hint}
                      </span>
                    </span>
                  </label>

                  {selected && id === 'provider' ? (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                          style={{
                            backgroundColor: SHIPROCKET_PROVIDER.logo.background,
                            color: SHIPROCKET_PROVIDER.logo.color,
                          }}
                          aria-hidden
                        >
                          {SHIPROCKET_PROVIDER.logo.initials}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Shiprocket
                          </span>
                          {integrationsLoading ? (
                            <span className="text-xs text-gray-400">…</span>
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                shiprocketBadge.variant === 'success'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : shiprocketBadge.variant === 'pending'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {shiprocketView?.displayStatus ?? shiprocketBadge.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {error ? (
                        <button
                          type="button"
                          onClick={() => void reload()}
                          className="mt-2 text-xs text-red-600 underline dark:text-red-400"
                        >
                          Failed to load — retry
                        </button>
                      ) : null}

                      {!integrationsLoading ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {canConnect(shiprocketStatus) ? (
                            <button
                              type="button"
                              onClick={handleShiprocketAction}
                              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                            >
                              Connect
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleShiprocketAction}
                              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              Manage
                            </button>
                          )}
                          {canDisconnect(shiprocketStatus) && shiprocketStatus !== 'not_connected' ? (
                            <button
                              type="button"
                              onClick={() => void handleDisconnectShiprocket()}
                              disabled={disconnecting}
                              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {providerBlocked ? (
                        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                          Connect Shiprocket to use this method.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">
          Delivery fees and free-shipping rules are set in{' '}
          <button
            type="button"
            onClick={() => navigate('/store/checkout')}
            className="font-medium text-gray-600 underline underline-offset-2 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
          >
            Checkout settings
          </button>
          .
        </p>
      </div>

      <StoreSaveBar
        hasChanges={dirty}
        saving={saving}
        canSave={dirty && !saving}
        onSave={() => void handleSave()}
      />
    </StoreLayout>
  );
}
