import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle } from 'react-icons/fi';
import StoreLayout, { STORE_SCROLL_SAVE_BOTTOM_PADDING_CLASS } from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import StoreSaveBar from './components/StoreSaveBar';
import { PAYMENT_GATEWAYS } from './config/paymentGateways';
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
  type StorePaymentCollectionMode,
} from '../../types/checkoutSettings';
import { isValidUpiId, normalizeUpiId } from '../../utils/upiPayment';
import ToggleSwitch from './components/ToggleSwitch';
import { STORE_FIELD_CLASS, STORE_HINT } from './storeTypography';

const COLLECTION_OPTIONS: Array<{
  id: StorePaymentCollectionMode;
  title: string;
  hint: string;
}> = [
  {
    id: 'manual',
    title: 'Manual',
    hint: 'Order confirmation only — you collect payment offline.',
  },
  {
    id: 'upi',
    title: 'UPI',
    hint: 'Show your UPI ID at checkout; you verify payment.',
  },
  {
    id: 'gateway',
    title: 'Online gateway',
    hint: 'Pay online via Razorpay.',
  },
];

const RAZORPAY_GATEWAY = PAYMENT_GATEWAYS.find((g) => g.id === 'razorpay')!;

export default function Payments() {
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

  const razorpayView = views.find((v) => v.provider === 'razorpay');
  const razorpayConnected =
    razorpayView != null && isConnectedStatus(razorpayView.status) && !razorpayView.isDemo;
  const razorpayStatus = razorpayView?.status ?? 'not_connected';
  const razorpayBadge = getIntegrationStatusBadge(razorpayStatus);
  const gatewayBlocked =
    settings.paymentCollectionMode === 'gateway' && !razorpayConnected && !settings.enableCod;

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
    if (settings.paymentCollectionMode === 'upi') {
      const upi = normalizeUpiId(settings.sellerUpiId);
      if (!isValidUpiId(upi)) {
        showToast('Enter a valid UPI ID (e.g. yourname@oksbi)', 'error');
        return;
      }
    }
    if (gatewayBlocked) {
      showToast('Connect Razorpay or enable Cash on Delivery', 'error');
      return;
    }

    setSaving(true);
    const result = await updateStoreCheckoutSettings(sellerId, {
      ...settings,
      sellerUpiId: normalizeUpiId(settings.sellerUpiId),
      enablePrepaid: settings.paymentCollectionMode === 'gateway',
    });
    setSaving(false);

    if (!result.success || !result.data) {
      showToast(result.error ?? 'Could not save payment settings', 'error');
      return;
    }
    const saved = normalizeCheckoutSettings(result.data.checkoutSettings);
    setSettings(saved);
    setOriginalSettings(saved);
    showToast('Payment settings saved', 'success');
  };

  const handleRazorpayAction = () => {
    navigate(RAZORPAY_GATEWAY.managePath!);
  };

  const handleDisconnectRazorpay = async () => {
    if (!guardCloudWrite() || !sellerId) return;
    if (!window.confirm('Disconnect Razorpay from your store?')) return;

    setDisconnecting(true);
    const result = await disconnectIntegration(sellerId, 'razorpay');
    setDisconnecting(false);

    if (result.error) {
      showToast(
        result.error instanceof Error ? result.error.message : 'Disconnect failed',
        'error'
      );
      return;
    }
    showToast('Razorpay disconnected', 'success');
    await reload();
  };

  return (
    <StoreLayout>
      <PageHeader title="Payments" description="How customers pay at checkout." />

      <div className={`max-w-lg space-y-6 ${STORE_SCROLL_SAVE_BOTTOM_PADDING_CLASS}`}>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-2" role="radiogroup" aria-label="Payment method">
            {COLLECTION_OPTIONS.map(({ id, title, hint }) => {
              const selected = settings.paymentCollectionMode === id;
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
                      name="paymentCollectionMode"
                      className="mt-1 h-4 w-4 flex-shrink-0 accent-gray-900 dark:accent-gray-100"
                      checked={selected}
                      onChange={() => patchSettings({ paymentCollectionMode: id })}
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

                  {selected && id === 'upi' ? (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Your UPI ID
                      </label>
                      <input
                        type="text"
                        className={`${STORE_FIELD_CLASS} mt-2`}
                        placeholder="yourname@oksbi"
                        value={settings.sellerUpiId}
                        onChange={(e) => patchSettings({ sellerUpiId: e.target.value })}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <p className={`${STORE_HINT} mt-2 flex items-start gap-1.5`}>
                        <FiAlertTriangle
                          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600"
                          aria-hidden
                        />
                        <span>
                          CatShare cannot verify UPI payments. Confirm them yourself in Orders.
                        </span>
                      </p>
                    </div>
                  ) : null}

                  {selected && id === 'gateway' ? (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                          style={{
                            backgroundColor: RAZORPAY_GATEWAY.logo.background,
                            color: RAZORPAY_GATEWAY.logo.color,
                          }}
                          aria-hidden
                        >
                          {RAZORPAY_GATEWAY.logo.initials}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Razorpay
                          </span>
                          {integrationsLoading ? (
                            <span className="text-xs text-gray-400">…</span>
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                razorpayBadge.variant === 'success'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : razorpayBadge.variant === 'pending'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {razorpayView?.displayStatus ?? razorpayBadge.label}
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
                          {canConnect(razorpayStatus) ? (
                            <button
                              type="button"
                              onClick={handleRazorpayAction}
                              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                            >
                              Connect
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleRazorpayAction}
                              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              Manage
                            </button>
                          )}
                          {canDisconnect(razorpayStatus) && razorpayStatus !== 'not_connected' ? (
                            <button
                              type="button"
                              onClick={() => void handleDisconnectRazorpay()}
                              disabled={disconnecting}
                              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {gatewayBlocked ? (
                        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                          Connect Razorpay or enable Cash on Delivery to use this method.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="rounded-xl border border-gray-200 bg-white/60 dark:border-gray-800 dark:bg-gray-900/30">
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Cash on delivery
                  </span>
                  <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">
                    Let customers pay when the order is delivered.
                  </span>
                </div>
                <ToggleSwitch
                  checked={settings.enableCod}
                  onChange={(enableCod) => patchSettings({ enableCod })}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        )}

        <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">
          Manual and UPI payments are between you and your customer. CatShare never stores your UPI
          PIN or gateway password.
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
