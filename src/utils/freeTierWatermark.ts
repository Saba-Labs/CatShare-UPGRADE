import {
  FREE_WATERMARK_POSITION,
  FREE_WATERMARK_TEXT,
} from "../config/freeTierLimits";
import { safeGetFromStorage } from "./safeStorage";

/**
 * Effective watermark text for rendering and previews.
 * Free tier: always default copy (custom text is not applied).
 */
export function getEffectiveWatermarkText(isPro: boolean): string {
  if (isPro) {
    return safeGetFromStorage("watermarkText", FREE_WATERMARK_TEXT);
  }
  return FREE_WATERMARK_TEXT;
}

/**
 * Effective watermark position. Free tier: locked to bottom-left.
 */
export function getEffectiveWatermarkPosition(isPro: boolean): string {
  if (isPro) {
    return safeGetFromStorage("watermarkPosition", FREE_WATERMARK_POSITION);
  }
  return FREE_WATERMARK_POSITION;
}
