import type { Order } from '../../services/orderService';
import { buildOrderTrackingUrl } from '../../services/orderTrackingService';
import {
  OdCard,
  OdCardHeader,
  OdIcons,
  OdSectionLabel,
  OD_COLORS,
  OD_FONT,
} from './orderDetailUi';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function OrderCustomerTrackingSection({
  order,
  onCopy,
}: {
  order: Order;
  onCopy: (url: string) => void | Promise<void>;
}) {
  if (!order.tracking_token) return null;

  return (
    <>
      <OdSectionLabel>Customer tracking link</OdSectionLabel>
      <OdCard>
        <OdCardHeader
          icon={<OdIcons.Link />}
          title="Share with customer"
          subtitle="View & edit while pending"
          accentColor={OD_COLORS.blue}
        />
        <div style={{ padding: '14px 16px' }}>
          <p
            style={{
              fontSize: 13,
              color: OD_COLORS.muted,
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            Send this link so your customer can view their order and make edits while it is still
            pending.
          </p>
          {order.customer_edited_at ? (
            <div
              style={{
                fontSize: 12,
                color: OD_COLORS.blue,
                fontWeight: 600,
                marginBottom: 12,
                padding: '8px 10px',
                borderRadius: 10,
                background: OD_COLORS.blueLight,
              }}
            >
              Customer last edited {formatDate(order.customer_edited_at)}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void onCopy(buildOrderTrackingUrl(order.tracking_token!))}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '14px',
              borderRadius: 14,
              border: `1.5px solid ${OD_COLORS.border}`,
              background: OD_COLORS.surface,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: OD_FONT,
              color: OD_COLORS.blue,
              transition: 'background 0.15s',
            }}
          >
            <OdIcons.Copy />
            Copy tracking link
          </button>
        </div>
      </OdCard>
    </>
  );
}
