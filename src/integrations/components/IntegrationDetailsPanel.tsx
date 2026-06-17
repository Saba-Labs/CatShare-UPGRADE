import type { SellerIntegrationView } from '../core/types';

export function IntegrationDetailsPanel({
  view,
  expanded = true,
}: {
  view: SellerIntegrationView;
  expanded?: boolean;
}) {
  if (!expanded || view.details.length === 0) {
    return null;
  }

  return (
    <div className="int-card">
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Account details{view.isDemo ? ' (sample data)' : ''}
      </h3>
      {view.details.map((field) => (
        <div key={field.label} className="int-detail-row">
          <span className="int-detail-label">{field.label}</span>
          <span className={`int-detail-value${field.mono ? ' mono' : ''}`}>
            {field.value}
          </span>
        </div>
      ))}
      {view.lastError ? (
        <div className="int-error-box" style={{ marginTop: 12 }}>
          {view.lastError}
        </div>
      ) : null}
    </div>
  );
}
