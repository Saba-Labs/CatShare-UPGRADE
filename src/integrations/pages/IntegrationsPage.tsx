import { useNavigate } from 'react-router-dom';
import MainAppBottomNav from '../../components/MainAppBottomNav';
import { listProvidersByCategory } from '../core/registry';
import { IntegrationCard } from '../components/IntegrationCard';
import { useSellerIntegrations } from '../hooks/useSellerIntegrations';
import {
  INTEGRATIONS_PAGE_CSS,
  IconBack,
} from '../components/integrationsPageStyles';

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const { views, loading, error, connectedCount } = useSellerIntegrations();

  const paymentProviders = listProvidersByCategory('payments');
  const shippingProviders = listProvidersByCategory('shipping');

  const viewFor = (providerId: string) =>
    views.find((v) => v.provider === providerId) ?? null;

  return (
    <div className="int-root">
      <style>{INTEGRATIONS_PAGE_CSS}</style>
      <div className="int-status-bar" aria-hidden />
      <header className="int-header">
        <button
          type="button"
          className="int-back"
          onClick={() => navigate('/store')}
          aria-label="Back to store"
        >
          <IconBack />
        </button>
        <h1 className="int-title">Integrations</h1>
      </header>

      <main className="int-main">
        {error ? <div className="int-error-box">{error}</div> : null}

        {loading ? (
          <div className="int-loading">Loading integrations…</div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--int-muted)', marginBottom: 4 }}>
              {connectedCount > 0
                ? `${connectedCount} connected`
                : 'Connect payment and shipping providers'}
            </p>

            <h2 className="int-section-title">Payments</h2>
            {paymentProviders.map((provider) => (
              <IntegrationCard
                key={provider.id}
                provider={provider}
                view={viewFor(provider.id)}
                onClick={() => navigate(`/store/integrations/${provider.id}`)}
              />
            ))}

            <h2 className="int-section-title">Shipping</h2>
            {shippingProviders.map((provider) => (
              <IntegrationCard
                key={provider.id}
                provider={provider}
                view={viewFor(provider.id)}
                onClick={() => navigate(`/store/integrations/${provider.id}`)}
              />
            ))}
          </>
        )}
      </main>

      <MainAppBottomNav active="store" />
    </div>
  );
}
