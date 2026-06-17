import type { IntegrationProvider } from '../providers/base/IntegrationProvider';
import type { SellerIntegrationView } from '../core/types';
import { IntegrationStatusBadge } from './IntegrationStatusBadge';
import { IconChevron } from './integrationsPageStyles';

export function IntegrationCard({
  provider,
  view,
  onClick,
}: {
  provider: IntegrationProvider;
  view: SellerIntegrationView | null;
  onClick: () => void;
}) {
  const status = view?.status ?? 'not_connected';

  return (
    <button type="button" className="int-card int-card-clickable" onClick={onClick}>
      <div className={`int-provider-icon ${provider.iconKey}`}>
        {provider.iconKey === 'razorpay' ? 'RZ' : 'SR'}
      </div>
      <div className="int-card-body">
        <div className="int-card-name">{provider.displayName}</div>
        <div className="int-card-desc">{provider.description}</div>
        <div style={{ marginTop: 8 }}>
          <IntegrationStatusBadge status={status} />
        </div>
      </div>
      <span className="int-chevron">
        <IconChevron />
      </span>
    </button>
  );
}
