import {
  getCatalogueData,
  type CatalogueData,
  type ProductWithCatalogueData,
} from '../../config/catalogueProductUtils';
import type { Catalogue } from '../../config/catalogueConfig';
import { getFieldsDefinition, isFieldVisibleOnSurface } from '../../config/fieldConfig';
import { productImageDisplayUrl } from '../../utils/imageUrl';
import { getProductImageUrls, getPrimaryImageIndex } from '../../utils/productImages';
import { resolveListOfferEffective } from '../../utils/offerPriceUtils';
import { getVariantCombinationData } from '../../utils/productVariants';

export function unitLabel(u?: string): string {
  if (!u || String(u).trim() === '' || u === 'None') return 'unit';
  const c = String(u).replace(/^\s*\/\s*/i, '').trim().toLowerCase();
  if (!c) return 'unit';
  if (c === 'piece' || c === 'pieces' || c === 'pc') return 'pc';
  return c;
}

export function fmt(n: number, sym: string) {
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function fmtCalc(
  qty: number,
  price: number,
  u: string | undefined,
  sym: string,
  qstep: number = 1
): string | null {
  if (qty <= 0 || !Number.isFinite(price)) return null;
  return `${qty} ${unitLabel(u)} × ${fmt(price, sym)}`;
}

export function getCats(p: ProductWithCatalogueData): string[] {
  return Array.from(new Set((p.category || []).map((c: string) => String(c).trim()).filter(Boolean)));
}

function isDisplayableImageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  if (!t) return false;
  if (t.startsWith('data:image/')) return true;
  try {
    const p = new URL(t);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

function pickProductImageSrc(p: ProductWithCatalogueData | Record<string, unknown>): string | undefined {
  const r = p as Record<string, unknown>;
  const asSrc = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s) || s.startsWith('data:image/')) return s;
    return undefined;
  };
  for (const k of ['imageUrl', 'image_url', 'thumbnailUrl', 'thumbnail_url', 'image'] as const) {
    const u = asSrc(r[k]);
    if (u) return u;
  }
  return undefined;
}

export function displayStoreProductImage(p: ProductWithCatalogueData): string | undefined {
  const raw = pickProductImageSrc(p);
  if (!raw) return undefined;
  if (raw.startsWith('data:image/')) return raw;
  const r = p as Record<string, unknown>;
  const v = r.imageVersion ?? r.image_version;
  const ver = typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  return productImageDisplayUrl(raw, ver);
}

export function pickStorefrontDetailField(
  product: ProductWithCatalogueData,
  preferredCatalogueId: string | undefined,
  n: number
): { text: string; unitSuffix: string; label: string | null } | null {
  const key = `field${n}`;
  const unitKey = `field${n}Unit`;
  const labelKey = `field${n}Label`;
  const tryRow = (row: Record<string, unknown> | null | undefined) => {
    if (!row || typeof row !== 'object') return null;
    const v = row[key];
    if (v == null || String(v).trim() === '') return null;
    const u = row[unitKey];
    const unitSuffix =
      u != null && String(u).trim() !== '' && String(u).trim() !== 'None' ? String(u).trim() : '';
    const l = row[labelKey];
    const label =
      l != null && String(l).trim() !== '' && String(l).trim() !== 'None' ? String(l).trim() : null;
    return { text: String(v).trim(), unitSuffix, label };
  };

  const cid = String(preferredCatalogueId ?? '').trim();
  if (cid) {
    const a = tryRow(getCatalogueData(product, cid) as unknown as Record<string, unknown>);
    if (a) return a;
  }
  const top = tryRow(product as unknown as Record<string, unknown>);
  if (top) return top;
  const map = product.catalogueData;
  if (map && typeof map === 'object') {
    for (const id of Object.keys(map).sort()) {
      const sub = map[id];
      if (!sub || typeof sub !== 'object') continue;
      const b = tryRow(sub as Record<string, unknown>);
      if (b) return b;
    }
  }
  return null;
}

export function getStorefrontPriceAndUnit(
  catData: CatalogueData | null | undefined,
  catalogue: Catalogue | null,
  product?: ProductWithCatalogueData | null,
  variantSelection?: Record<string, string> | null
): { price: number; priceUnit?: string; listPrice?: number; showOffer: boolean } {
  const pr = product as Record<string, unknown> | null | undefined;
  let variantOverride: ReturnType<typeof getVariantCombinationData> | null = null;
  if (product && variantSelection) {
    variantOverride = getVariantCombinationData(product, variantSelection);
  }

  const pack = (res: ReturnType<typeof resolveListOfferEffective>, priceUnit: string | undefined) => {
    const unit = Number.isFinite(res.effectiveUnitPrice) ? res.effectiveUnitPrice : 0;
    const pay = unit > 0 ? unit : res.listPrice;
    return {
      price: pay,
      priceUnit,
      listPrice: res.showStrikeout ? res.listPrice : undefined,
      showOffer: res.showStrikeout,
    };
  };

  if (variantOverride?.price != null && typeof variantOverride.price === 'number') {
    const rawOffer = variantOverride.customFields?.offer;
    const offerPrice =
      typeof rawOffer === 'number' ? rawOffer : rawOffer != null ? Number(rawOffer) : NaN;
    const hasOffer = Number.isFinite(offerPrice) && offerPrice < variantOverride.price;
    const priceUnit = catalogue
      ? (catData?.[catalogue.priceUnitField as keyof CatalogueData] as string | undefined)
      : undefined;
    const result: { price: number; priceUnit?: string; listPrice?: number; showOffer: boolean } = {
      price: variantOverride.price,
      priceUnit,
      showOffer: hasOffer,
    };
    if (hasOffer) {
      result.listPrice = variantOverride.price;
      result.price = offerPrice;
    }
    return result;
  }

  if (catalogue && catData) {
    const res = resolveListOfferEffective(catData, catalogue.priceField, pr ?? null);
    const priceUnit = catData[catalogue.priceUnitField as keyof CatalogueData] as string | undefined;
    return pack(res, priceUnit);
  }

  if (catData && !catalogue) {
    for (let n = 1; n <= 10; n++) {
      const pf = `price${n}`;
      const res = resolveListOfferEffective(catData, pf, pr ?? null);
      if (res.effectiveUnitPrice > 0 || res.listPrice > 0) {
        const uk = `price${n}Unit` as keyof CatalogueData;
        return pack(res, catData[uk] as string | undefined);
      }
    }
  }

  return { price: 0, priceUnit: undefined, showOffer: false };
}

export function buildStorefrontDetailFields(
  product: ProductWithCatalogueData,
  catalogueId: string | undefined,
  sellerFieldsDefinition: unknown,
  variantSelection: Record<string, string>
): Array<{ label: string; value: string }> {
  const raw = (sellerFieldsDefinition as { fields?: unknown })?.fields;
  let cloudFields: Array<{ key: string; label?: string; enabled?: boolean }> | null = null;
  if (Array.isArray(raw)) cloudFields = raw as Array<{ key: string; label?: string; enabled?: boolean }>;
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) cloudFields = parsed;
    } catch {
      /* ignore */
    }
  }
  const resolvedFields = cloudFields ?? getFieldsDefinition().fields ?? [];
  const fieldDefinition = { fields: resolvedFields };
  const variantData = getVariantCombinationData(product, variantSelection);

  const visible = new Set(
    fieldDefinition.fields
      .filter((f) => {
        if (!f.key.startsWith('field')) return false;
        const n = Number(String(f.key).replace('field', ''));
        if (!Number.isFinite(n) || n < 1 || n > 10) return false;
        if (pickStorefrontDetailField(product, catalogueId, n)) return true;
        return f.enabled === true && isFieldVisibleOnSurface(f as never, 'onlineStore');
      })
      .map((f) => Number(String(f.key).replace('field', '')))
      .filter((n) => Number.isFinite(n))
  );

  return Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => {
      if (!visible.has(n)) return null;
      const fieldKey = `field${n}`;
      const fieldUnitKey = `field${n}Unit`;
      const picked = pickStorefrontDetailField(product, catalogueId, n);
      const cloudLabel = fieldDefinition.fields.find((f) => f.key === fieldKey)?.label?.trim() || null;
      const label = picked?.label?.trim() || cloudLabel || `Field ${n}`;

      const variantValue = variantData?.customFields?.[fieldKey];
      const variantUnit = variantData?.customFields?.[fieldUnitKey];
      if (variantValue != null && String(variantValue).trim() !== '') {
        const unitSuffix =
          variantUnit != null && String(variantUnit).trim() !== '' && String(variantUnit).trim() !== 'None'
            ? String(variantUnit).trim()
            : '';
        const value = unitSuffix ? `${String(variantValue).trim()} ${unitSuffix}` : String(variantValue).trim();
        return { label, value };
      }
      if (!picked) return null;
      const value = picked.unitSuffix ? `${picked.text} ${picked.unitSuffix}` : picked.text;
      return { label, value };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;
}

export function getStoreProductGalleryProps(p: ProductWithCatalogueData) {
  const urls = getProductImageUrls(p);
  const primaryIndex = getPrimaryImageIndex(p);
  const r = p as Record<string, unknown>;
  const v = r.imageVersion ?? r.image_version;
  const primaryImageVersion = typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  return { urls, primaryIndex, primaryImageVersion, fallback: displayStoreProductImage(p) };
}

export function isDisplayableProductImage(url?: string) {
  return isDisplayableImageUrl(url);
}
