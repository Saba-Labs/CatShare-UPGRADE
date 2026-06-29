import type { SellerIntegrationView } from '../core/types';

function DetailRows({ fields }: { fields: SellerIntegrationView['details'] }) {
  if (fields.length === 0) return null;
  return (
    <>
      {fields.map((field) => (
        <div key={field.label} className="int-detail-row">
          <span className="int-detail-label">{field.label}</span>
          <span className={`int-detail-value${field.mono ? ' mono' : ''}`}>{field.value}</span>
        </div>
      ))}
    </>
  );
}

export function IntegrationDetailsPanel({
  view,
  expanded = true,
}: {
  view: SellerIntegrationView;
  expanded?: boolean;
}) {
  if (!expanded) return null;

  const sections =
    view.detailSections && view.detailSections.length > 0
      ? view.detailSections
      : view.details.length > 0
        ? [{ title: 'Account details', fields: view.details }]
        : [];

  if (sections.length === 0 && !view.lastError) {
    return null;
  }

  return (
    <div className="int-card" style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Integration details{view.isDemo ? ' (sample data)' : ''}
      </h3>
      <p style={{ fontSize: 12, color: 'var(--int-muted)', marginBottom: 12, lineHeight: 1.45 }}>
        Connection info and how this integration works in your store.
      </p>

      {sections.map((section, index) => (
        <div
          key={section.title}
          className="int-detail-section"
          style={index > 0 ? { marginTop: 14, paddingTop: 14, borderTop: '1px solid #F1F5F9' } : undefined}
        >
          <h4 className="int-detail-section-title">{section.title}</h4>
          <DetailRows fields={section.fields} />
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
