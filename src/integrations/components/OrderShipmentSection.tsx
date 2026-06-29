import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';

import { getSellerStore } from '../../services/storeService';

import { readCachedSellerStore } from '../../utils/storePageCache';

import { normalizeCheckoutSettings } from '../../types/checkoutSettings';

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

type ShipmentHeroTone = 'delivered' | 'transit' | 'created' | 'failed' | 'neutral';

function shipmentHeroTone(status: string): ShipmentHeroTone {
  if (status === 'delivered') return 'delivered';
  if (status === 'failed' || status === 'cancelled') return 'failed';
  if (
    status === 'in_transit' ||
    status === 'picked_up' ||
    status === 'out_for_delivery' ||
    status === 'reached_hub'
  ) {
    return 'transit';
  }
  if (status === 'created' || status === 'pickup_scheduled') return 'created';
  return 'neutral';
}

function ShipmentHeroIcon({ tone }: { tone: ShipmentHeroTone }) {
  if (tone === 'delivered') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14" />
        <path
          d="M7 12.5l3 3 7-7.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tone === 'failed') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14" />
      <path
        d="M4 8h11v8H4zM15 10h2.5l2 2.5V16H15z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="17" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ShipmentField({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }, [value]);

  if (!value || value === '—') return null;

  return (
    <div className="od-ship-field">
      <span className="od-ship-field-label">{label}</span>
      <div className="od-ship-field-body">
        <span className={`od-ship-field-value${mono ? ' od-ship-field-value--mono' : ''}`}>{value}</span>
        {copyable ? (
          <button type="button" className="od-ship-copy" onClick={() => void handleCopy()} aria-label={`Copy ${label}`}>
            {copied ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

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
  const [cancelling, setCancelling] = useState(false);
  const [shippingCollectionMode, setShippingCollectionMode] = useState<'manual' | 'provider'>('manual');

  useEffect(() => {
    const sellerId = user?.uid;
    if (!sellerId) return;
    const cached = readCachedSellerStore(sellerId);
    if (cached) {
      setShippingCollectionMode(
        normalizeCheckoutSettings(cached.checkoutSettings).shippingCollectionMode
      );
    }
    void getSellerStore(sellerId).then((result) => {
      if (result.success && result.data) {
        setShippingCollectionMode(
          normalizeCheckoutSettings(result.data.checkoutSettings).shippingCollectionMode
        );
      }
    });
  }, [user?.uid]);

  const isManualFulfillment = shippingCollectionMode === 'manual';

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

  const handleCancelShipment = async () => {
    if (!guardCloudWrite()) return;
    if (!shiprocketProvider.cancelShipment) return;
    if (
      !window.confirm(
        'Cancel this shipment in Shiprocket? This voids the AWB if pickup has not started. You can create a new AWB afterwards.'
      )
    ) {
      return;
    }

    setCancelling(true);
    try {
      const sellerId = user?.uid || shipment?.sellerUserId || '';
      if (!sellerId) throw new Error('Sign in to cancel shipments');
      await shiprocketProvider.cancelShipment(sellerId, orderId);
      showToast('Shipment cancelled in Shiprocket', 'success');
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not cancel shipment', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const statusLabel = shipment
    ? DELIVERY_LABELS[shipment.deliveryStatus] ?? shipment.deliveryStatus
    : '';
  const heroTone = shipment ? shipmentHeroTone(shipment.deliveryStatus) : 'neutral';
  const statusPill = shipment ? getDeliveryStatusPill(shipment.deliveryStatus) : null;
  const awbDisplay = shipment?.awbNumber || shipment?.trackingNumber || null;
  const isCancelled = shipment?.deliveryStatus === 'cancelled';
  const isDelivered = shipment?.deliveryStatus === 'delivered';
  const canCancelShipment = Boolean(
    shipment && shiprocketLive && !isCancelled && !isDelivered && shiprocketProvider.cancelShipment
  );
  const canRecreateAwb = Boolean(shipment && isCancelled && shiprocketLive);

  return (
    <>
      <OdSectionLabel>Shipment</OdSectionLabel>
      <OdCard className="od-card--shipment">
        {loading ? (
          <div className="od-ship-loading">
            <span className="od-ship-loading-dot" />
            Loading shipment…
          </div>
        ) : !shipment ? (
          <div className="od-ship-empty-wrap">
            {isManualFulfillment ? (
              <OdEmptyState
                icon={<OdIcons.Shipment />}
                title="Manual shipping"
                description="You dispatch this order on your own. Reach out to the customer when it ships."
              />
            ) : (
              <>
                <OdEmptyState
                  icon={<OdIcons.Shipment />}
                  title="No shipment yet"
                  description={
                    shiprocketLive
                      ? needsAddressForm
                        ? 'Enter the customer delivery address, then create an AWB in Shiprocket.'
                        : 'Create an AWB in Shiprocket for this order.'
                      : 'Connect Shiprocket in Store → Shipping to create AWBs and track deliveries.'
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
                  <div className="od-address-preview od-address-preview--card">
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
            )}
          </div>
        ) : (
          <>
            <div className={`od-ship-hero od-ship-hero--${heroTone}`}>
              <div className="od-ship-hero-glow" aria-hidden />
              <div className="od-ship-hero-inner">
                <div className="od-ship-hero-icon-wrap">
                  <ShipmentHeroIcon tone={heroTone} />
                </div>
                <div className="od-ship-hero-content">
                  <div className="od-ship-hero-top">
                    {statusPill ? (
                      <OdStatusPill {...statusPill} label={statusLabel} kind="delivery" />
                    ) : null}
                    <span className="od-ship-provider">Shiprocket</span>
                  </div>
                  {awbDisplay ? <div className="od-ship-awb">{awbDisplay}</div> : null}
                  <div className="od-ship-hero-title">{shipment.courier || 'Shipment'}</div>
                  <div className="od-ship-hero-sub">
                    {isCancelled
                      ? 'Cancelled in Shiprocket. Create a new AWB if you still need to ship this order.'
                      : shipment.lastUpdatedAt
                        ? `Last updated ${formatDateTime(shipment.lastUpdatedAt)}`
                        : 'Tracking updates from your courier partner'}
                  </div>
                  {shipment.trackingUrl && !isCancelled ? (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="od-ship-track"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" strokeLinecap="round" />
                        <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" />
                      </svg>
                      Track package
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="od-ship-grid">
              <ShipmentField label="Shipment ID" value={shipment.shipmentId} mono copyable />
              <ShipmentField label="Tracking no." value={shipment.trackingNumber} mono copyable />
              <ShipmentField label="AWB" value={shipment.awbNumber} mono copyable />
              <ShipmentField label="Pickup" value={formatDate(shipment.pickupDate)} />
              <ShipmentField label="Est. delivery" value={formatDate(shipment.estimatedDelivery)} />
              <ShipmentField label="Last updated" value={formatDateTime(shipment.lastUpdatedAt)} />
            </div>

            {shipment.timeline.length > 0 ? (
              <div className="od-ship-timeline-wrap">
                <div className="od-ship-timeline-label">Tracking timeline</div>
                <ShipmentTrackingTimeline events={shipment.timeline} />
              </div>
            ) : null}

            {canCancelShipment || canRecreateAwb ? (
              <div className="od-ship-actions">
                {canCancelShipment ? (
                  <button
                    type="button"
                    className="od-ship-cancel"
                    disabled={cancelling || creating}
                    onClick={() => void handleCancelShipment()}
                  >
                    {cancelling ? 'Cancelling…' : 'Cancel shipment'}
                  </button>
                ) : null}
                {canRecreateAwb ? (
                  <button
                    type="button"
                    className="od-btn-primary od-ship-recreate"
                    disabled={creating || cancelling}
                    onClick={() => void handleCreateAwb()}
                  >
                    {creating ? 'Creating AWB…' : 'Create new AWB'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </OdCard>
    </>
  );
}
