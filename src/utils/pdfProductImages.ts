/**
 * Preload product photos as data URLs before PDF export so jsPDF always receives pixels.
 * Runs the same hydrate + fetch path on web and native (native: disk via hydrate).
 */

import { hydrateProductSourceForRender } from "./productSourceImage";
import { fetchUrlAsDataUrl } from "./fetchImageCrossPlatform";

export type PdfExportProductRow = {
  id: string | number;
  name: string;
  subtitle?: string;
  image?: string;
  price?: string | number;
  priceUnit?: string;
  field1?: string;
  field2?: string;
  field3?: string;
  field4?: string;
  field5?: string;
  field6?: string;
  field7?: string;
  field8?: string;
  field9?: string;
  field10?: string;
  field1Unit?: string;
  field2Unit?: string;
  field3Unit?: string;
  field4Unit?: string;
  field5Unit?: string;
  field6Unit?: string;
  field7Unit?: string;
  field8Unit?: string;
  field9Unit?: string;
  field10Unit?: string;
};

async function resolveImageForPdfRow(
  sp: PdfExportProductRow,
  full: Record<string, unknown> | undefined
): Promise<PdfExportProductRow> {
  if (!full) return sp;

  try {
    const clone: Record<string, unknown> = { ...full };
    await hydrateProductSourceForRender(clone);
    const hydrated = clone.image;
    if (
      typeof hydrated === "string" &&
      hydrated.startsWith("data:") &&
      hydrated.length > 64
    ) {
      return { ...sp, image: hydrated };
    }
  } catch (e) {
    console.warn("PDF: hydrate failed for product", sp.id, e);
  }

  const raw = sp.image;
  if (typeof raw === "string" && /^https?:\/\//i.test(raw.trim())) {
    try {
      const dataUrl = await fetchUrlAsDataUrl(raw.trim());
      return { ...sp, image: dataUrl };
    } catch (e) {
      console.warn("PDF: fetch image URL failed for product", sp.id, e);
    }
  }

  return sp;
}

/**
 * Sequentially resolve images so UI can show per-item progress.
 */
export async function prepareSelectedProductsForPdfExport(
  rows: PdfExportProductRow[],
  allProducts: Record<string, unknown>[],
  onProgress?: (loaded: number, total: number) => void
): Promise<PdfExportProductRow[]> {
  const total = rows.length;
  const out: PdfExportProductRow[] = [];
  onProgress?.(0, total);

  for (let i = 0; i < rows.length; i++) {
    const sp = rows[i];
    const full = allProducts.find((p) => p.id === sp.id) as Record<string, unknown> | undefined;
    const next = await resolveImageForPdfRow(sp, full);
    out.push(next);
    onProgress?.(i + 1, total);
  }
  return out;
}
