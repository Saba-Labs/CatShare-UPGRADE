import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { fetchOrderPaymentByOrderId } from '../services/orderPaymentsService';
import type { OrderPayment } from '../core/types';

export function useOrderPayment(orderId: string | undefined) {
  const { user } = useAuth();
  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [payment, setPayment] = useState<OrderPayment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!sellerId || !orderId) {
      setPayment(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetchOrderPaymentByOrderId(sellerId, orderId);
    if (res.error) {
      setError(
        res.error instanceof Error ? res.error.message : 'Could not load payment'
      );
    }
    setPayment(res.data);
    setLoading(false);
  }, [sellerId, orderId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { payment, loading, error, reload };
}
