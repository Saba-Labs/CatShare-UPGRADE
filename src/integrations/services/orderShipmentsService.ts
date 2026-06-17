/**
 * Order shipment records and tracking timeline.
 */
import { getSupabaseClient, setSupabaseRlsUserId } from '../../supabaseClient';
import type {
  DeliveryStatus,
  OrderShipment,
  ShipmentTimelineEvent,
} from '../core/types';

function parseTimeline(raw: unknown): ShipmentTimelineEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === 'object')
    .map((e) => {
      const ev = e as Record<string, unknown>;
      return {
        id: String(ev.id ?? ''),
        label: String(ev.label ?? ''),
        status: (ev.status === 'done' || ev.status === 'error'
          ? ev.status
          : 'pending') as ShipmentTimelineEvent['status'],
        at: ev.at != null ? String(ev.at) : null,
      };
    });
}

function mapShipmentRow(row: Record<string, unknown>): OrderShipment {
  return {
    id: String(row.id ?? ''),
    orderId: String(row.order_id ?? row.orderId ?? ''),
    sellerUserId: String(row.seller_user_id ?? row.sellerUserId ?? ''),
    provider: String(row.provider ?? ''),
    shipmentId: row.shipment_id != null ? String(row.shipment_id) : null,
    awbNumber: row.awb_number != null ? String(row.awb_number) : null,
    courier: row.courier != null ? String(row.courier) : null,
    trackingNumber:
      row.tracking_number != null ? String(row.tracking_number) : null,
    trackingUrl: row.tracking_url != null ? String(row.tracking_url) : null,
    pickupDate: row.pickup_date != null ? String(row.pickup_date) : null,
    estimatedDelivery:
      row.estimated_delivery != null ? String(row.estimated_delivery) : null,
    deliveryStatus: String(
      row.delivery_status ?? 'unknown'
    ) as DeliveryStatus,
    timeline: parseTimeline(row.timeline),
    lastUpdatedAt:
      row.last_updated_at != null ? String(row.last_updated_at) : null,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at ?? row.createdAt ?? ''),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? ''),
  };
}

export const DEFAULT_SHIPMENT_TIMELINE: ShipmentTimelineEvent[] = [
  { id: 'created', label: 'Shipment Created', status: 'pending' },
  { id: 'pickup_scheduled', label: 'Pickup Scheduled', status: 'pending' },
  { id: 'picked_up', label: 'Picked Up', status: 'pending' },
  { id: 'in_transit', label: 'In Transit', status: 'pending' },
  { id: 'reached_hub', label: 'Reached Hub', status: 'pending' },
  { id: 'out_for_delivery', label: 'Out For Delivery', status: 'pending' },
  { id: 'delivered', label: 'Delivered', status: 'pending' },
];

export async function fetchOrderShipmentByOrderId(
  sellerUserId: string,
  orderId: string
): Promise<{ data: OrderShipment | null; error: unknown }> {
  try {
    if (!sellerUserId || !orderId) {
      return { data: null, error: new Error('Missing seller or order id') };
    }
    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('order_shipments')
      .select('*')
      .eq('seller_user_id', sellerUserId)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { data: null, error: null };
      }
      return { data: null, error };
    }
    if (!data) return { data: null, error: null };
    return {
      data: mapShipmentRow(data as Record<string, unknown>),
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}

/** Future: webhook / Shiprocket sync will call this */
export async function upsertOrderShipment(
  sellerUserId: string,
  shipment: Partial<OrderShipment> & { orderId: string; provider: string }
): Promise<{ data: OrderShipment | null; error: unknown }> {
  try {
    setSupabaseRlsUserId(sellerUserId);
    const row = {
      order_id: shipment.orderId,
      seller_user_id: sellerUserId,
      provider: shipment.provider,
      shipment_id: shipment.shipmentId ?? null,
      awb_number: shipment.awbNumber ?? null,
      courier: shipment.courier ?? null,
      tracking_number: shipment.trackingNumber ?? null,
      tracking_url: shipment.trackingUrl ?? null,
      pickup_date: shipment.pickupDate ?? null,
      estimated_delivery: shipment.estimatedDelivery ?? null,
      delivery_status: shipment.deliveryStatus ?? 'unknown',
      timeline: shipment.timeline ?? DEFAULT_SHIPMENT_TIMELINE,
      last_updated_at: shipment.lastUpdatedAt ?? new Date().toISOString(),
      metadata: shipment.metadata ?? {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await getSupabaseClient()
      .from('order_shipments')
      .upsert(row, { onConflict: 'order_id' })
      .select()
      .single();

    if (error) return { data: null, error };
    return {
      data: mapShipmentRow(data as Record<string, unknown>),
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}
