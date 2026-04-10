import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';

/** Orders RLS (see SUPABASE_ORDERS_SQL.md) uses `x-user-id`. Restore from session before seller mutations when header was cleared (e.g. after StoreView order). */
async function ensureOrdersRlsHeaderFromSession(): Promise<void> {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (session?.user?.id) setSupabaseRlsUserId(session.user.id);
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  rowTotal: number;
  category?: string;
  subtitle?: string;
  priceUnit?: string;
  imageUrl?: string;
  /** Bumps when product image changes — cache bust for CDN/browser */
  imageVersion?: number;
  quantityStep?: number;
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
  order_source?: 'link' | 'manual' | 'store';
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
  customerWhatsapp?: string,
  orderSource: 'link' | 'manual' | 'store' = 'link'
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
      order_source: orderSource,
    });

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Create a new order directly (without share link - for manual seller entry)
 */
export async function createOrderDirectly(
  sellerUserId: string,
  customerName: string,
  items: OrderItem[],
  totalAmount: number | undefined,
  currencyCode: string = 'INR',
  customerWhatsapp?: string,
  catalogueId?: string,
  orderSource: 'link' | 'manual' | 'store' = 'manual'
): Promise<{ data: Order | null; error: any }> {
  try {
    const client = getSupabaseClient();

    const { data, error } = await client.from('orders').insert({
      share_link_token: 'manual-order',
      seller_user_id: sellerUserId,
      customer_name: customerName,
      customer_whatsapp: customerWhatsapp,
      items: items,
      total_amount: totalAmount,
      currency_code: currencyCode,
      status: 'pending',
      order_source: orderSource,
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
    // Validate seller user ID is provided and not empty
    if (!sellerUserId || sellerUserId.trim() === '') {
      return {
        data: null,
        error: new Error('Seller user ID is required and cannot be empty')
      };
    }

    // Validate UUID format (roughly: 8-4-4-4-12 hex chars)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sellerUserId)) {
      return {
        data: null,
        error: new Error('Invalid seller user ID format. Guest users cannot access orders.')
      };
    }

    const trimmed = sellerUserId.trim();
    // RLS matches seller_user_id to x-user-id; customer flows clear the header after insert — restore for seller reads.
    setSupabaseRlsUserId(trimmed);

    const client = getSupabaseClient();

    let query = client
      .from('orders')
      .select('*')
      .eq('seller_user_id', trimmed)
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
    await ensureOrdersRlsHeaderFromSession();
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
 * Update order (items, customer details, total amount)
 */
export async function updateOrder(
  orderId: string,
  updates: {
    items?: OrderItem[];
    customer_name?: string;
    customer_whatsapp?: string;
    total_amount?: number;
  }
): Promise<{ data: Order | null; error: any }> {
  try {
    await ensureOrdersRlsHeaderFromSession();
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('orders')
      .update({ ...updates, updated_at: new Date().toISOString() })
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
    await ensureOrdersRlsHeaderFromSession();
    const client = getSupabaseClient();

    const { error } = await client.from('orders').delete().eq('id', orderId);

    return { error };
  } catch (err) {
    return { error: err };
  }
}
