import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainAppBottomNav from '../../components/MainAppBottomNav';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import {
  connectIntegration,
  disconnectIntegration,
  refreshIntegrationStatus,
} from '../core/IntegrationConnectionService';
import { isConnectedStatus } from '../core/IntegrationStatusService';
import { IntegrationActionBar } from '../components/IntegrationActionBar';
import { IntegrationDetailsPanel } from '../components/IntegrationDetailsPanel';
import { IntegrationGuideCard } from '../components/IntegrationGuideCard';
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge';
import { useIntegrationProvider } from '../hooks/useIntegrationProvider';
import {
  INTEGRATIONS_PAGE_CSS,
  IconBack,
  IconCheck,
} from '../components/integrationsPageStyles';

export default function RazorpayIntegrationPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();
  const {
    sellerId,
    provider,
    view,
    loading,
    actionLoading,
    setActionLoading,
    error,
    reload,
  } = useIntegrationProvider('razorpay');

  const [showDetails, setShowDetails] = useState(false);
  const status = view?.status ?? 'not_connected';

  const handleConnect = async () => {
    if (!guardCloudWrite()) return;
    setActionLoading(true);
    const res = await connectIntegration(sellerId, 'razorpay');
    setActionLoading(false);
    if (res.error) {
      showToast(
        res.error instanceof Error ? res.error.message : 'Connect failed',
        'error'
      );
      return;
    }
    showToast('Razorpay connection started', 'success');
    await reload();
  };

  const handleRefresh = async () => {
    if (!guardCloudWrite()) return;
    setActionLoading(true);
    const res = await refreshIntegrationStatus(sellerId, 'razorpay');
    setActionLoading(false);
    if (res.error) {
      showToast(
        res.error instanceof Error ? res.error.message : 'Refresh failed',
        'error'
      );
      return;
    }
    showToast('Status updated', 'success');
    await reload();
  };

  const handleDisconnect = async () => {
    if (!guardCloudWrite()) return;
    if (!window.confirm('Disconnect Razorpay from CatShare?')) return;
    setActionLoading(true);
    const res = await disconnectIntegration(sellerId, 'razorpay');
    setActionLoading(false);
    if (res.error) {
      showToast(
        res.error instanceof Error ? res.error.message : 'Disconnect failed',
        'error'
      );
      return;
    }
    showToast('Razorpay disconnected', 'success');
    setShowDetails(false);
    await reload();
  };

  const securityNote = provider.getSecurityNote();

  return (
    <div className="int-root">
      <style>{INTEGRATIONS_PAGE_CSS}</style>
      <div className="int-status-bar" aria-hidden />
      <header className="int-header">
        <button
          type="button"
          className="int-back"
          onClick={() => navigate('/store/integrations')}
          aria-label="Back"
        >
          <IconBack />
        </button>
        <h1 className="int-title">Razorpay</h1>
      </header>

      <main className="int-main">
        {error ? <div className="int-error-box">{error}</div> : null}

        {loading ? (
          <div className="int-loading">Loading…</div>
        ) : (
          <>
            <div className="int-card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="int-provider-icon razorpay">RZ</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Razorpay</div>
                  <div style={{ fontSize: 12, color: 'var(--int-muted)', marginTop: 2 }}>
                    {provider.description}
                  </div>
                </div>
                <IntegrationStatusBadge status={status} />
              </div>
            </div>

            {isConnectedStatus(status) ? (
              <div className="int-connected-banner">
                <IconCheck /> Connected
              </div>
            ) : null}

            {status === 'pending_verification' ? (
              <div className="int-card" style={{ fontSize: 13, color: 'var(--int-amber)' }}>
                Verification in progress. Click Refresh Status after Razorpay activates your
                account.
              </div>
            ) : null}

            {status === 'not_connected' || status === 'error' ? (
              <IntegrationGuideCard
                title="How to connect Razorpay"
                steps={provider.getGuideSteps()}
                securityNote={securityNote}
              />
            ) : null}

            {view && showDetails ? <IntegrationDetailsPanel view={view} /> : null}

            <IntegrationActionBar
              status={status}
              connectLabel="Connect Razorpay"
              loading={actionLoading}
              onConnect={handleConnect}
              onRefresh={handleRefresh}
              onDisconnect={handleDisconnect}
              showDetails={showDetails}
              onToggleDetails={() => setShowDetails((v) => !v)}
            />
          </>
        )}
      </main>

      <MainAppBottomNav active="store" />
    </div>
  );
}
