import { useEffect, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';

import { shiprocketProvider } from '../providers/shipping/shiprocket/ShiprocketProvider';

import { isConnectedStatus } from '../core/IntegrationStatusService';

import { useOrderShipment } from '../hooks/useOrderShipment';

import { useSellerIntegrations } from '../hooks/useSellerIntegrations';

import {
  isCompleteShippingAddress,
  normalizeShippingAddress,
  type ShippingAddress,
} from '../utils/shippingAddress';

import { ShipmentTrackingTimeline } from './ShipmentTrackingTimeline';

import {
  OdCard,
  OdCardHeader,
  OdDetailRow,
  OdEmptyState,
  OdIcons,
  OdSectionLabel,
  OdStatusPill,
  getDeliveryStatusPill,
} from './orderDetailUi';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  } catch {
    return iso;
  }
}

const DELIVERY_LABELS: Record<string, string> = {
  created: 'Created',
  pickup_scheduled: 'Pickup scheduled',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  reached_hub: 'Reached hub',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
  unknown: 'Unknown',
};

type OrderShipmentSectionProps = {
  orderId: string;
  shippingAddress?: ShippingAddress | null;
  onShippingAddressSaved?: (address: ShippingAddress) => void;
};

export function OrderShipmentSection({
  orderId,
  shippingAddress,
  onShippingAddressSaved,
}: OrderShipmentSectionProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();
  const { shipment, loading, reload } = useOrderShipment(orderId);
  const { views } = useSellerIntegrations();
  const [creating, setCreating] = useState(false);

  const savedAddress = isCompleteShippingAddress(shippingAddress) ? shippingAddress : null;
  const [line1, setLine1] = useState(savedAddress?.line1 ?? '');
  const [city, setCity] = useState(savedAddress?.city ?? '');
  const [state, setState] = useState(savedAddress?.state ?? '');
  const [pincode, setPincode] = useState(savedAddress?.pincode ?? '');

  useEffect(() => {
    if (!savedAddress) return;
    setLine1(savedAddress.line1);
    setCity(savedAddress.city);
    setState(savedAddress.state);
    setPincode(savedAddress.pincode);
  }, [savedAddress?.line1, savedAddress?.city, savedAddress?.state, savedAddress?.pincode]);

  const shiprocketView = views.find((v) => v.provider === 'shiprocket');
  const shiprocketLive =
    shiprocketView &&
    isConnectedStatus(shiprocketView.status) &&
    !shiprocketView.isDemo;

  const needsAddressForm = shiprocketLive && !savedAddress;

  const handleCreateAwb = async () => {
    if (!guardCloudWrite()) return;
    if (!shiprocketProvider.createShipment) return;

    const addressFromForm = normalizeShippingAddress({
      line1,
      city,
      state,
      pincode,
      country: 'India',
    });

    if (!savedAddress && !addressFromForm) {
      showToast('Fill in the delivery address below before creating an AWB', 'error');
      return;
    }

    setCreating(true);
    try {
      const sellerId = user?.uid || shipment?.sellerUserId || '';
      if (!sellerId) throw new Error('Sign in to create shipments');

      const addressToSend = addressFromForm ?? savedAddress;
      await shiprocketProvider.createShipment(sellerId, orderId, addressToSend);

      if (addressToSend && !savedAddress) {
        onShippingAddressSaved?.(addressToSend);
      }

      showToast('AWB created in Shiprocket', 'success');
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not create AWB', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <OdSectionLabel>Shipment</OdSectionLabel>
      <OdCard>
        {loading ? (
          <div className="od-loading">Loading shipment…</div>
        ) : !shipment ? (
          <>
            <OdEmptyState
              icon={<OdIcons.Shipment />}
              title="No shipment yet"
              description={
                shiprocketLive
                  ? needsAddressForm
                    ? 'Enter the customer delivery address, then create an AWB in Shiprocket.'
                    : 'Create an AWB in Shiprocket for this order.'
                  : 'Connect Shiprocket in Store settings to create AWBs and track deliveries.'
              }
            />

            {needsAddressForm ? (
              <div className="od-form-block">
                <div className="od-form-label">Delivery address</div>
                <input
                  type="text"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  placeholder="Street / building / area"
                  className="od-input"
                />
                <div className="od-input-grid">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="od-input"
                  />
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className="od-input"
                  />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Pincode"
                  className="od-input"
                />
              </div>
            ) : savedAddress ? (
              <div className="od-address-preview">
                {savedAddress.line1}, {savedAddress.city}, {savedAddress.state} — {savedAddress.pincode}
              </div>
            ) : null}

            {shiprocketLive ? (
              <div className="od-actions">
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateAwb}
                  className="od-btn-primary"
                >
                  {creating ? 'Creating AWB…' : 'Create AWB in Shiprocket'}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <OdCardHeader
              variant="shipment"
              icon={<OdIcons.Shipment />}
              title={shipment.courier || 'Shipment'}
              subtitle={shipment.awbNumber ? `AWB ${shipment.awbNumber}` : undefined}
              badge={
                <OdStatusPill
                  {...getDeliveryStatusPill(shipment.deliveryStatus)}
                  label={DELIVERY_LABELS[shipment.deliveryStatus] ?? shipment.deliveryStatus}
                />
              }
            />

            <div className="od-detail-grid">
              <OdDetailRow label="Shipment ID" value={shipment.shipmentId} mono />
              <OdDetailRow label="Tracking no." value={shipment.trackingNumber} mono />
              <OdDetailRow label="Pickup" value={formatDate(shipment.pickupDate)} />
              <OdDetailRow label="Est. delivery" value={formatDate(shipment.estimatedDelivery)} />
              <OdDetailRow label="Last updated" value={formatDateTime(shipment.lastUpdatedAt)} isLast />
            </div>

            {shipment.trackingUrl ? (
              <div className="od-actions">
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="od-btn-secondary"
                >
                  Track package
                </a>
              </div>
            ) : null}

            {shipment.timeline.length > 0 ? (
              <div className="od-timeline-wrap">
                <div className="od-timeline-label">Tracking timeline</div>
                <ShipmentTrackingTimeline events={shipment.timeline} />
              </div>
            ) : null}
          </>
        )}
      </OdCard>
    </>
  );
}
