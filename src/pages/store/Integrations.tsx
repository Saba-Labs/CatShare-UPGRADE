import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiGrid, FiShield } from 'react-icons/fi';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import IntegrationAppCard from './components/IntegrationAppCard';
import {
  STORE_INTEGRATION_CATEGORIES,
  STORE_INTEGRATION_CATEGORY_ORDER,
  getActiveStoreIntegrations,
  type StoreIntegrationId,
} from './config/storeIntegrations';
import { useToast } from '../../context/ToastContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { ProFeatureGate } from '../../components/ProFeatureGate';
import { useSellerIntegrations } from '../../integrations/hooks/useSellerIntegrations';
import { disconnectIntegration } from '../../integrations/core/IntegrationConnectionService';
import { isConnectedStatus } from '../../integrations/core/IntegrationStatusService';
import { STORE_CATEGORY_TITLE, STORE_SECTION_DESCRIPTION } from './storeTypography';

export default function Integrations() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isPro } = useSubscription();
  const { guardCloudWrite } = useCloudWriteGate();
  const { sellerId, views, loading, error, connectedCount, reload } = useSellerIntegrations();
  const [disconnectingId, setDisconnectingId] = useState<StoreIntegrationId | null>(null);

  const activeIntegrations = getActiveStoreIntegrations();

  const connectedApps = useMemo(
    () =>
      activeIntegrations.filter(
        (app) =>
          app.integrationProviderId &&
          views.some(
            (view) =>
              view.provider === app.integrationProviderId &&
              isConnectedStatus(view.status)
          )
      ),
    [views, activeIntegrations]
  );

  const viewForApp = (appId: StoreIntegrationId) => {
    const app = activeIntegrations.find((item) => item.id === appId);
    if (!app?.integrationProviderId) return null;
    return views.find((view) => view.provider === app.integrationProviderId) ?? null;
  };

  const handleConnect = (appId: StoreIntegrationId) => {
    const app = activeIntegrations.find((item) => item.id === appId);
    if (!app?.managePath) return;
    navigate(app.managePath);
  };

  const handleManage = (appId: StoreIntegrationId) => {
    const app = activeIntegrations.find((item) => item.id === appId);
    if (app?.managePath) {
      navigate(app.managePath);
      return;
    }
    if (app?.platformManaged) {
      showToast(`${app.name} is managed by CatShare`, 'success');
    }
  };

  const handleDisconnect = async (appId: StoreIntegrationId) => {
    if (!guardCloudWrite()) return;

    const app = activeIntegrations.find((item) => item.id === appId);
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
      <PageHeader
        title="Integrations"
      />

      {!isPro ? (
        <ProFeatureGate featureName="Integrations" locked={true}>
          <div className="max-w-6xl space-y-8 pb-8 min-h-[500px]" />
        </ProFeatureGate>
      ) : (
      <div className="max-w-6xl space-y-8 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 p-5">
            <div className="flex items-start gap-3">
              <FiGrid className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {loading
                    ? 'Loading integrations…'
                    : connectedCount > 0
                      ? `${connectedCount} integration${connectedCount === 1 ? '' : 's'} connected`
                      : 'No integrations connected yet'}
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Browse apps below to connect payments, shipping, and more.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 p-5">
            <div className="flex items-start gap-3">
              <FiShield className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Secure connections
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Credentials are encrypted. CatShare never stores your provider dashboard passwords.
                </p>
              </div>
            </div>
          </div>
        </div>

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

        {STORE_INTEGRATION_CATEGORY_ORDER.map((category) => {
          const apps = activeIntegrations.filter((app) => app.category === category);
          if (apps.length === 0) return null;
          const meta = STORE_INTEGRATION_CATEGORIES[category];

          return (
            <section key={category}>
              <div className="mb-3">
                <h2 className={STORE_CATEGORY_TITLE}>{meta.label}</h2>
                <p className={STORE_SECTION_DESCRIPTION}>{meta.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {apps.map((app) => {
                  const view = viewForApp(app.id);
                  return (
                    <IntegrationAppCard
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
            </section>
          );
        })}

        {connectedApps.length > 0 ? (
          <SettingsCard
            title="Connected Apps"
            description="Quick overview of your active integrations."
          >
            <ul className="space-y-2">
              {connectedApps.map((app) => (
                <li
                  key={app.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 px-4 py-3"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {app.name}
                  </span>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                    Connected · v{app.version}
                  </span>
                </li>
              ))}
            </ul>
          </SettingsCard>
        ) : null}
      </div>
      )}
    </StoreLayout>
  );
}
