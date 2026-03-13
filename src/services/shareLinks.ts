import { getSupabaseClient, supabase } from '../supabaseClient';

function randomToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type ShareLinkItem = {
  productId: string;
  name: string;
  price?: string | number;
  priceUnit?: string;
  imageUrl?: string;
};

export async function createShareLink(options: {
  sellerUserId: string;
  sellerWhatsapp: string;
  items: ShareLinkItem[];
  expiresInDays?: number;
}): Promise<{ token: string; url: string }> {
  const token = randomToken(24);
  const expiresInDays = options.expiresInDays ?? 7;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const baseUrl =
    (import.meta as any).env?.VITE_PUBLIC_WEB_BASE_URL ||
    window.location.origin;

  const { error } = await getSupabaseClient()
    .from('share_links')
    .insert({
      token,
      seller_user_id: options.sellerUserId,
      seller_whatsapp: options.sellerWhatsapp,
      items: options.items,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error(error.message);
  }

  return { token, url: `${baseUrl.replace(/\/+$/, '')}/o/${token}` };
}

export async function fetchShareLinkForCustomer(token: string): Promise<{
  sellerWhatsapp: string;
  items: ShareLinkItem[];
} | null> {
  const { data, error } = await supabase.rpc('get_share_link', { p_token: token });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as { sellerWhatsapp: string; items: ShareLinkItem[] };
}

