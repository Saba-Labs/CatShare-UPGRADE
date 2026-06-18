import { useEffect, useState } from 'react';
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
import { DEFAULT_SHIPPING_PREFERENCES, type ShippingPreferences } from '../core/types';
import {
  fetchShippingPreferences,
  updateShippingPreferences,
} from '../services/shippingPreferencesService';
import { IntegrationActionBar } from '../components/IntegrationActionBar';
import { IntegrationDemoBanner } from '../components/IntegrationDemoBanner';
import { IntegrationDetailsPanel } from '../components/IntegrationDetailsPanel';
import { IntegrationGuideCard } from '../components/IntegrationGuideCard';
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge';
import { ShiprocketConnectForm } from '../components/ShiprocketConnectForm';
import { ShippingPreferencesEditor } from '../components/ShippingPreferencesEditor';
import { useIntegrationProvider } from '../hooks/useIntegrationProvider';
import {
  INTEGRATIONS_PAGE_CSS,
  IconBack,
  IconCheck,
} from '../components/integrationsPageStyles';

export default function ShiprocketIntegrationPage() {
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
  } = useIntegrationProvider('shiprocket');

  const [showDetails, setShowDetails] = useState(false);
  const [apiEmail, setApiEmail] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [shippingPrefs, setShippingPrefs] = useState<ShippingPreferences>(
    DEFAULT_SHIPPING_PREFERENCES
  );
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const status = view?.status ?? 'not_connected';
  const canConnect = status === 'not_connected' || status === 'error';

  useEffect(() => {
    if (!sellerId) return;
    void (async () => {
      setPrefsLoading(true);
      const res = await fetchShippingPreferences(sellerId);
      setShippingPrefs(res.data);
      setPrefsLoading(false);
    })();
  }, [sellerId]);

  const handleConnect = async () => {
    if (!guardCloudWrite()) return;
    if (!apiEmail.trim() || !apiPassword) {
      showToast('Enter your Shiprocket API user email and password', 'error');
      return;
    }
    setActionLoading(true);
    const res = await connectIntegration(sellerId, 'shiprocket', {
      shiprocket: { email: apiEmail.trim(), password: apiPassword },
    });
    setActionLoading(false);
    if (res.error) {
      showToast(
        res.error instanceof Error ? res.error.message : 'Connect failed',
        'error'
      );
      return;
    }
    setApiPassword('');
    showToast('Shiprocket connected', 'success');
    setShowDetails(true);
    await reload();
  };

  const handleRefresh = async () => {
    if (!guardCloudWrite()) return;
    setActionLoading(true);
    const res = await refreshIntegrationStatus(sellerId, 'shiprocket');
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
    if (!window.confirm('Disconnect Shiprocket from CatShare?')) return;
    setActionLoading(true);
    const res = await disconnectIntegration(sellerId, 'shiprocket');
    setActionLoading(false);
    if (res.error) {
      showToast(
        res.error instanceof Error ? res.error.message : 'Disconnect failed',
        'error'
      );
      return;
    }
    showToast('Shiprocket disconnected', 'success');
    setShowDetails(false);
    setApiEmail('');
    setApiPassword('');
    await reload();
  };

  const handleSavePrefs = async () => {
    if (!guardCloudWrite()) return;
    setSavingPrefs(true);
    const res = await updateShippingPreferences(sellerId, shippingPrefs);
    setSavingPrefs(false);
    if (res.error) {
      showToast('Could not save shipping preferences', 'error');
      return;
    }
    if (res.data) setShippingPrefs(res.data);
    showToast('Shipping preferences saved', 'success');
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
        <h1 className="int-title">Shiprocket</h1>
      </header>

      <main className="int-main">
        {error ? <div className="int-error-box">{error}</div> : null}
        {view?.lastError ? (
          <div className="int-error-box" style={{ marginBottom: 12 }}>
            {view.lastError}
          </div>
        ) : null}

        {loading ? (
          <div className="int-loading">Loading…</div>
        ) : (
          <>
            <div className="int-card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="int-provider-icon shiprocket">SR</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Shiprocket</div>
                  <div style={{ fontSize: 12, color: 'var(--int-muted)', marginTop: 2 }}>
                    {provider.description}
                  </div>
                </div>
                <IntegrationStatusBadge
                  status={status}
                  label={view?.displayStatus}
                />
              </div>
            </div>

            {view?.isDemo ? <IntegrationDemoBanner providerName="Shiprocket" /> : null}

            {isConnectedStatus(status) && !view?.isDemo ? (
              <div className="int-connected-banner">
                <IconCheck /> Connected to Shiprocket
              </div>
            ) : null}

            {canConnect ? (
              <>
                <IntegrationGuideCard
                  title="How to connect Shiprocket"
                  steps={provider.getGuideSteps()}
                  securityNote={securityNote}
                />
                <ShiprocketConnectForm
                  email={apiEmail}
                  password={apiPassword}
                  loading={actionLoading}
                  onEmailChange={setApiEmail}
                  onPasswordChange={setApiPassword}
                  onSubmit={handleConnect}
                />
              </>
            ) : null}

            {view && showDetails ? <IntegrationDetailsPanel view={view} /> : null}

            {!canConnect ? (
              <IntegrationActionBar
                status={status}
                connectLabel="Connect Shiprocket"
                loading={actionLoading}
                onConnect={handleConnect}
                onRefresh={handleRefresh}
                onDisconnect={handleDisconnect}
                showDetails={showDetails}
                onToggleDetails={() => setShowDetails((v) => !v)}
              />
            ) : null}

            <h2 className="int-section-title">Shipping settings</h2>
            {prefsLoading ? (
              <div className="int-loading">Loading preferences…</div>
            ) : (
              <>
                <ShippingPreferencesEditor
                  value={shippingPrefs}
                  onChange={setShippingPrefs}
                  disabled={savingPrefs}
                />
                <button
                  type="button"
                  className="int-btn int-btn-primary"
                  style={{ marginTop: 8 }}
                  disabled={savingPrefs}
                  onClick={handleSavePrefs}
                >
                  {savingPrefs ? 'Saving…' : 'Save preferences'}
                </button>
              </>
            )}
          </>
        )}
      </main>

      <MainAppBottomNav active="store" />
    </div>
  );
}

