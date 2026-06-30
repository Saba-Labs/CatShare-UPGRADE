import type { Order } from '../../services/orderService';
import { buildOrderTrackingUrlForSeller } from '../../services/orderTrackingService';
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
  onEnsureToken,
}: {
  order: Order;
  onCopy: (url: string) => void | Promise<void>;
  onEnsureToken?: () => Promise<string | null>;
}) {
  if (!order.tracking_token && !onEnsureToken) return null;

  const handleCopy = async () => {
    let token = order.tracking_token?.trim() || null;
    if ((!token || token.length < 16) && onEnsureToken) {
      token = await onEnsureToken();
    }
    if (!token || token.length < 16) return;
    await onCopy(buildOrderTrackingUrlForSeller(token));
  };

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
            pending. Once you mark the order as processing, they can view status but cannot change it.
          </p>
          {order.customer_edited_at ? (
            <div className="od-edited-badge">
              Customer last edited {formatDate(order.customer_edited_at)}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void handleCopy()}
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
