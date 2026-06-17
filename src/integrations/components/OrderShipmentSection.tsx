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
  OD_COLORS,
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

const addressInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: `1.5px solid ${OD_COLORS.border}`,
  fontSize: 14,
  background: '#FAFAFA',
  fontFamily: 'inherit',
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
          <div style={{ padding: '20px 16px', fontSize: 13, color: OD_COLORS.muted }}>
            Loading shipment…
          </div>
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
                  : 'Connect Shiprocket in Store → Integrations to create AWBs and track deliveries.'
              }
            />

            {needsAddressForm ? (
              <div
                style={{
                  padding: '0 16px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: OD_COLORS.text,
                  }}
                >
                  Delivery address
                </div>
                <input
                  type="text"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  placeholder="Street / building / area"
                  style={addressInputStyle}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    style={addressInputStyle}
                  />
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    style={addressInputStyle}
                  />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Pincode"
                  style={addressInputStyle}
                />
              </div>
            ) : savedAddress ? (
              <div style={{ padding: '0 16px 12px', fontSize: 13, color: OD_COLORS.muted, lineHeight: 1.5 }}>
                {savedAddress.line1}, {savedAddress.city}, {savedAddress.state} — {savedAddress.pincode}
              </div>
            ) : null}

            {shiprocketLive ? (
              <div style={{ padding: '0 16px 14px' }}>
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateAwb}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    border: 'none',
                    background: '#7C3AED',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: creating ? 'wait' : 'pointer',
                    opacity: creating ? 0.7 : 1,
                  }}
                >
                  {creating ? 'Creating AWB…' : 'Create AWB in Shiprocket'}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <OdCardHeader
              icon={<OdIcons.Shipment />}
              title={shipment.courier || 'Shipment'}
              subtitle={shipment.awbNumber ? `AWB ${shipment.awbNumber}` : undefined}
              accentColor="#7C3AED"
              badge={
                <OdStatusPill
                  {...getDeliveryStatusPill(shipment.deliveryStatus)}
                  label={DELIVERY_LABELS[shipment.deliveryStatus] ?? shipment.deliveryStatus}
                />
              }
            />

            <OdDetailRow label="Shipment ID" value={shipment.shipmentId} mono />
            <OdDetailRow label="Tracking no." value={shipment.trackingNumber} mono />
            <OdDetailRow label="Pickup" value={formatDate(shipment.pickupDate)} />
            <OdDetailRow label="Est. delivery" value={formatDate(shipment.estimatedDelivery)} />
            <OdDetailRow label="Last updated" value={formatDateTime(shipment.lastUpdatedAt)} isLast />

            {shipment.trackingUrl ? (
              <div style={{ padding: '12px 16px 14px', borderTop: `1px solid ${OD_COLORS.divider}` }}>
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    border: `1.5px solid ${OD_COLORS.border}`,
                    background: OD_COLORS.surface,
                    fontSize: 14,
                    fontWeight: 600,
                    color: OD_COLORS.blue,
                    textDecoration: 'none',
                  }}
                >
                  Track package
                </a>
              </div>
            ) : null}

            {shipment.timeline.length > 0 ? (
              <div
                style={{
                  borderTop: `1px solid ${OD_COLORS.divider}`,
                  padding: '14px 16px 16px',
                  background: '#FAFAFA',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: OD_COLORS.subtle,
                    marginBottom: 10,
                  }}
                >
                  Tracking timeline
                </div>
                <ShipmentTrackingTimeline events={shipment.timeline} />
              </div>
            ) : null}
          </>
        )}
      </OdCard>
    </>
  );
}
