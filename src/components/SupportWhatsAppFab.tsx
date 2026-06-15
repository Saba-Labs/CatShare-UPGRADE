import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { buildCatShareSupportWhatsAppUrl } from '../config/catshareSupport';

function IconWhatsApp({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/** Product create FAB in CatalogueApp uses h-14 (56px). */
export const MAIN_APP_PRODUCT_FAB_HEIGHT_PX = 56;
export const MAIN_APP_FAB_BOTTOM_OFFSET_PX = 64;

type SupportWhatsAppFabProps = {
  /** Bottom offset of the peer FAB (e.g. + button) above the tab bar */
  bottomOffsetPx?: number;
  /** Match vertical center to a peer FAB of this height at `bottomOffsetPx` */
  alignCenterWithHeightPx?: number;
};

const SUPPORT_FAB_HEIGHT_PX = 44; // h-11

export default function SupportWhatsAppFab({
  bottomOffsetPx = MAIN_APP_FAB_BOTTOM_OFFSET_PX,
  alignCenterWithHeightPx = MAIN_APP_PRODUCT_FAB_HEIGHT_PX,
}: SupportWhatsAppFabProps) {
  const href = buildCatShareSupportWhatsAppUrl();
  const centerAdjust =
    alignCenterWithHeightPx > 0
      ? (alignCenterWithHeightPx - SUPPORT_FAB_HEIGHT_PX) / 2
      : 0;
  const bottomPx = bottomOffsetPx + centerAdjust;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed left-4 z-40 flex h-11 items-center gap-2 rounded-full pl-2.5 pr-3.5 text-white shadow-xl shadow-green-600/40 ring-1 ring-white/20 transition-transform hover:scale-[1.03] active:scale-[0.97]"
      style={{
        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomPx}px)`,
        background: 'linear-gradient(145deg, #34d399 0%, #25d366 45%, #128c7e 100%)',
      }}
      title="Chat with CatShare Support on WhatsApp"
      aria-label="CatShare Support on WhatsApp"
      onClick={() => {
        void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
        <IconWhatsApp size={17} />
      </span>
      <span className="text-xs font-bold leading-none tracking-tight">Support</span>
    </a>
  );
}
