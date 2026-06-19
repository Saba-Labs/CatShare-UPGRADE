import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTruck } from 'react-icons/fi';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import ShippingProviderCard from './components/ShippingProviderCard';
import { SHIPPING_PROVIDERS, getActiveShippingProviders } from './config/shippingProviders';
import type { ShippingProviderId } from './config/shippingProviders';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { useSellerIntegrations } from '../../integrations/hooks/useSellerIntegrations';
import { disconnectIntegration } from '../../integrations/core/IntegrationConnectionService';
import { isConnectedStatus } from '../../integrations/core/IntegrationStatusService';

export default function Shipping() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();
  const { sellerId, views, loading, error, reload } = useSellerIntegrations();
  const [disconnectingId, setDisconnectingId] = useState<ShippingProviderId | null>(null);

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

  return (
    <StoreLayout>
      <PageHeader title="Shipping" />

      <div className="space-y-6 max-w-3xl">
        <SettingsCard
          title="Shipping Providers"
          description={
            loading
              ? 'Loading provider connections…'
              : connectedProviders.length > 0
                ? `${connectedProviders.length} provider${connectedProviders.length === 1 ? '' : 's'} connected`
                : 'Connect a logistics provider to automate fulfillment.'
          }
        >
          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
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
                  loading={loading}
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
          title="Delivery charges & fees"
          description="Configure what customers pay at checkout."
        >
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/20 p-4">
            <FiTruck className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Set shipping fees on the Checkout page
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Flat shipping, free-shipping thresholds, packing charges, taxes, and COD fees are
                configured under Store → Checkout.
              </p>
              <button
                type="button"
                onClick={() => navigate('/store/checkout')}
                className="mt-3 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open Checkout settings
              </button>
            </div>
          </div>
        </SettingsCard>
      </div>
    </StoreLayout>
  );
}
