import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import IntegrationAppRow from './components/IntegrationAppRow';
import { getActiveStoreIntegrations, type StoreIntegrationId } from './config/storeIntegrations';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { ProFeatureGate } from '../../components/ProFeatureGate';
import { useSellerIntegrations } from '../../integrations/hooks/useSellerIntegrations';
import { disconnectIntegration } from '../../integrations/core/IntegrationConnectionService';

export default function Integrations() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();
  const { sellerId, views, loading, error, connectedCount, reload } = useSellerIntegrations();
  const [disconnectingId, setDisconnectingId] = useState<StoreIntegrationId | null>(null);

  const connectableApps = useMemo(
    () => getActiveStoreIntegrations().filter((app) => app.integrationProviderId),
    []
  );

  const viewForApp = (appId: StoreIntegrationId) => {
    const app = connectableApps.find((item) => item.id === appId);
    if (!app?.integrationProviderId) return null;
    return views.find((view) => view.provider === app.integrationProviderId) ?? null;
  };

  const pageDescription =
    loading
      ? 'Loading your connections…'
      : connectedCount > 0
        ? `${connectedCount} provider${connectedCount === 1 ? '' : 's'} connected.`
        : 'Connect payment and shipping providers for your store.';

  const handleConnect = (appId: StoreIntegrationId) => {
    const app = connectableApps.find((item) => item.id === appId);
    if (!app?.managePath) return;
    navigate(app.managePath);
  };

  const handleManage = (appId: StoreIntegrationId) => {
    const app = connectableApps.find((item) => item.id === appId);
    if (app?.managePath) navigate(app.managePath);
  };

  const handleDisconnect = async (appId: StoreIntegrationId) => {
    if (!guardCloudWrite()) return;

    const app = connectableApps.find((item) => item.id === appId);
    if (!app?.integrationProviderId || !sellerId) return;

    if (!window.confirm(`Disconnect ${app.name} from your store?`)) return;

    setDisconnectingId(appId);
    const result = await disconnectIntegration(sellerId, app.integrationProviderId);
    setDisconnectingId(null);

    if (result.error) {
      showToast(
        result.error instanceof Error ? result.error.message : 'Disconnect failed',
        'error'
      );
      return;
    }

    showToast(`${app.name} disconnected`, 'success');
    await reload();
  };

  return (
    <StoreLayout>
      <PageHeader title="Integrations" description={pageDescription} />

      <ProFeatureGate featureName="Integrations">
        <div className="max-w-lg space-y-6 pb-8">
          {error ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
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

          <div className="space-y-2">
            {connectableApps.map((app) => {
              const view = viewForApp(app.id);
              return (
                <IntegrationAppRow
                  key={app.id}
                  integration={app}
                  status={view?.status}
                  displayStatus={view?.displayStatus}
                  loading={loading}
                  actionLoading={disconnectingId === app.id}
                  onConnect={() => handleConnect(app.id)}
                  onManage={() => handleManage(app.id)}
                  onDisconnect={() => void handleDisconnect(app.id)}
                />
              );
            })}
          </div>

          <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">
            Provider credentials are encrypted. Configure payment and shipping modes under Store →
            Payments and Store → Shipping.
          </p>
        </div>
      </ProFeatureGate>
    </StoreLayout>
  );
}
