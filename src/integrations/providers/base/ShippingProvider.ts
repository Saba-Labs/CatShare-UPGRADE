import type { IntegrationProvider } from './IntegrationProvider';
import type { OrderShipment, SellerIntegration } from '../../core/types';

export interface ShippingPickupDetails {
  warehouseName: string | null;
  pickupAddress: string | null;
  connectedDate: string | null;
  status: string | null;
}

export interface ShippingProvider extends IntegrationProvider {
  getPickupDetails(connection: SellerIntegration): ShippingPickupDetails;

  /** Future: create AWB / shipment */
  createShipment?(
    sellerId: string,
    orderId: string
  ): Promise<OrderShipment>;

  /** Future: sync tracking from provider */
  handleWebhook?(event: unknown): Promise<OrderShipment | null>;
}
