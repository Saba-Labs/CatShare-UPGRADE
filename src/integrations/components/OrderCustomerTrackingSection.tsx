import type { Order } from '../../services/orderService';
import { buildOrderTrackingUrl } from '../../services/orderTrackingService';
import {
  OdCard,
  OdCardHeader,
  OdIcons,
  OdSectionLabel,
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
          variant="tracking"
          icon={<OdIcons.Link />}
          title="Share with customer"
          subtitle="View & edit while pending"
        />
        <div className="od-tracking-body">
          <p className="od-tracking-copy">
            Send this link so your customer can view their order and make edits while it is still
            pending. Once you confirm the order, they can view status but cannot change it.
          </p>
          {order.customer_edited_at ? (
            <div className="od-edited-badge">
              Customer last edited {formatDate(order.customer_edited_at)}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void onCopy(buildOrderTrackingUrl(order.tracking_token!))}
            className="od-btn-secondary"
          >
            <OdIcons.Copy />
            Copy tracking link
          </button>
        </div>
      </OdCard>
    </>
  );
}
