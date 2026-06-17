import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { fetchOrderShipmentByOrderId } from '../services/orderShipmentsService';
import type { OrderShipment } from '../core/types';

export function useOrderShipment(orderId: string | undefined) {
  const { user } = useAuth();
  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [shipment, setShipment] = useState<OrderShipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!sellerId || !orderId) {
      setShipment(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetchOrderShipmentByOrderId(sellerId, orderId);
    if (res.error) {
      setError(
        res.error instanceof Error ? res.error.message : 'Could not load shipment'
      );
    }
    setShipment(res.data);
    setLoading(false);
  }, [sellerId, orderId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { shipment, loading, error, reload };
}
