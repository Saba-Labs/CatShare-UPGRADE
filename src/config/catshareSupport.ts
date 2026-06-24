/** CatShare in-app support contact (WhatsApp). */
export const CATSHARE_SUPPORT_WHATSAPP_E164 = '919600500662';

export const CATSHARE_SUPPORT_WHATSAPP_DISPLAY = '+91 96005 00662';

const DEFAULT_SUPPORT_MESSAGE =
  'Hi CatShare Support, I need some help with the app.';

export function buildCatShareSupportWhatsAppUrl(message = DEFAULT_SUPPORT_MESSAGE): string {
  const digits = CATSHARE_SUPPORT_WHATSAPP_E164.replace(/\D/g, '');
  const text = encodeURIComponent(message.trim());
  return `https://wa.me/${digits}?text=${text}`;
}
