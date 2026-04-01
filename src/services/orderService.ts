import { getSupabaseClient } from '../supabaseClient';

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  rowTotal: number;
  category?: string;
  priceUnit?: string;
  imageUrl?: string;
}

export interface Order {
  id: string;
  share_link_token: string;
  seller_user_id: string;
  customer_name: string;
  customer_whatsapp?: string;
  items: OrderItem[];
  total_amount?: number;
  currency_code: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

/**
 * Create a new order from customer confirmation
 */
export async function createOrder(
  sellerUserId: string,
  shareLinkToken: string,
  customerName: string,
  items: OrderItem[],
  totalAmount: number | undefined,
  currencyCode: string = 'INR',
  customerWhatsapp?: string
): Promise<{ data: Order | null; error: any }> {
  try {
    const client = getSupabaseClient();

    const { data, error } = await client.from('orders').insert({
      share_link_token: shareLinkToken,
      seller_user_id: sellerUserId,
      customer_name: customerName,
      customer_whatsapp: customerWhatsapp,
      items: items,
      total_amount: totalAmount,
      currency_code: currencyCode,
      status: 'pending',
    });

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Fetch all orders for a seller
 */
export async function fetchSellerOrders(
  sellerUserId: string,
  status?: 'pending' | 'completed' | 'cancelled'
): Promise<{ data: Order[] | null; error: any }> {
  try {
    const client = getSupabaseClient();

    let query = client
      .from('orders')
      .select('*')
      .eq('seller_user_id', sellerUserId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: 'pending' | 'completed' | 'cancelled'
): Promise<{ data: Order | null; error: any }> {
  try {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Delete an order
 */
export async function deleteOrder(orderId: string): Promise<{ error: any }> {
  try {
    const client = getSupabaseClient();

    const { error } = await client.from('orders').delete().eq('id', orderId);

    return { error };
  } catch (err) {
    return { error: err };
  }
}
