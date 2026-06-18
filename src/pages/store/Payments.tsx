import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCreditCard, FiShield } from 'react-icons/fi';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import PaymentGatewayCard from './components/PaymentGatewayCard';
import { PAYMENT_GATEWAYS, getActivePaymentGateways } from './config/paymentGateways';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { useSellerIntegrations } from '../../integrations/hooks/useSellerIntegrations';
import { disconnectIntegration } from '../../integrations/core/IntegrationConnectionService';
import { isConnectedStatus } from '../../integrations/core/IntegrationStatusService';
import type { PaymentGatewayId } from './config/paymentGateways';

export default function Payments() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();
  const { sellerId, views, loading, error, reload } = useSellerIntegrations();
  const [disconnectingId, setDisconnectingId] = useState<PaymentGatewayId | null>(null);

  const activeGateways = getActivePaymentGateways();

  const connectedGateways = useMemo(
    () =>
      activeGateways.filter(
        (gateway) =>
          gateway.integrationProviderId &&
          views.some(
            (view) =>
              view.provider === gateway.integrationProviderId &&
              isConnectedStatus(view.status)
          )
      ),
    [views, activeGateways]
  );

  const viewForGateway = (gatewayId: PaymentGatewayId) => {
    const gateway = PAYMENT_GATEWAYS.find((item) => item.id === gatewayId);
    if (!gateway?.integrationProviderId) return null;
    return views.find((view) => view.provider === gateway.integrationProviderId) ?? null;
  };

  const handleConnect = (gatewayId: PaymentGatewayId) => {
    const gateway = PAYMENT_GATEWAYS.find((item) => item.id === gatewayId);
    if (!gateway?.managePath) return;
    navigate(gateway.managePath);
  };

  const handleManage = (gatewayId: PaymentGatewayId) => {
    const gateway = PAYMENT_GATEWAYS.find((item) => item.id === gatewayId);
    if (!gateway?.managePath) return;
    navigate(gateway.managePath);
  };

  const handleDisconnect = async (gatewayId: PaymentGatewayId) => {
    if (!guardCloudWrite()) return;

    const gateway = PAYMENT_GATEWAYS.find((item) => item.id === gatewayId);
    if (!gateway?.integrationProviderId || !sellerId) return;

    if (!window.confirm(`Disconnect ${gateway.name} from your store?`)) return;

    setDisconnectingId(gatewayId);
    const result = await disconnectIntegration(sellerId, gateway.integrationProviderId);
    setDisconnectingId(null);

    if (result.error) {
      showToast(
        result.error instanceof Error ? result.error.message : 'Disconnect failed',
        'error'
      );
      return;
    }

    showToast(`${gateway.name} disconnected`, 'success');
    await reload();
  };

  return (
    <StoreLayout>
      <PageHeader
        title="Payments"
      />

      <div className="space-y-6 max-w-3xl">
        <SettingsCard
          title="Payment Gateways"
          description={
            loading
              ? 'Loading your payment connections…'
              : connectedGateways.length > 0
                ? `${connectedGateways.length} gateway${connectedGateways.length === 1 ? '' : 's'} connected`
                : 'Connect a gateway to start accepting online payments.'
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
            {activeGateways.map((gateway) => {
              const view = viewForGateway(gateway.id);
              return (
                <PaymentGatewayCard
                  key={gateway.id}
                  gateway={gateway}
                  status={view?.status}
                  displayStatus={view?.displayStatus}
                  loading={loading}
                  actionLoading={disconnectingId === gateway.id}
                  onConnect={() => handleConnect(gateway.id)}
                  onManage={() => handleManage(gateway.id)}
                  onDisconnect={() => void handleDisconnect(gateway.id)}
                />
              );
            })}
          </div>
        </SettingsCard>

        <SettingsCard
          title="Secure Payments"
          description="How CatShare handles payment credentials and customer checkout."
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/20 p-4">
              <FiShield className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Payments go directly to your gateway account
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Customer payments are collected by your connected provider. CatShare never stores
                  your gateway dashboard password.
                </p>
              </div>
            </div>
          </div>
        </SettingsCard>
      </div>
    </StoreLayout>
  );
}
