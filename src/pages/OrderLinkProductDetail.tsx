import type { Dispatch, SetStateAction } from 'react';
import ProductImageGallery from '../components/ProductImageGallery';
import ProductVariantsDisplay from '../components/ProductVariantsDisplay';
import { getShareLinkItemUnitPrice, type ShareLinkItem } from '../services/shareLinks';
import { productImageDisplayUrl } from '../utils/imageUrl';
import { shouldUseProductMediaGallery } from '../utils/productGallery';
import {
  formatVariantSelectionSummary,
  isVariantSelectionComplete,
} from '../utils/productVariants';
import {
  cartLinesForProduct,
  getCartLineQty,
  removeZeroQtyLinesForProduct,
  setCartLineQty,
  setCartLineQtyById,
  type OrderCartLine,
} from '../utils/orderCartLines';
import { normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { applyQuantityDelta, getEffectiveMinimumOrderQuantity } from '../utils/quantityPricingUtils';

type VariantSelectionMap = Record<string, Record<string, string>>;

function getQuantityStep(item: ShareLinkItem): number {
  return normalizeOrderQuantityStep(item.quantityStep);
}

function parseItemPriceNumeric(price: ShareLinkItem['price']): number {
  if (price === undefined || price === null || price === '') return NaN;
  const n = parseFloat(String(price).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function formatOrderMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatUnitPrice(price: ShareLinkItem['price'], symbol: string): string {
  const n = parseItemPriceNumeric(price);
  if (!Number.isFinite(n)) return String(price ?? '');
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getOrderUnitLabel(priceUnit: string | undefined): string {
  if (!priceUnit || String(priceUnit).trim() === '' || priceUnit === 'None') return 'units';
  const cleaned = String(priceUnit)
    .replace(/^\s*\/\s*/i, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return 'units';
  if (cleaned === 'piece' || cleaned === 'pieces' || cleaned === 'pc') return 'pieces';
  return cleaned;
}

function formatLineCalculationDetail(
  q: number,
  item: ShareLinkItem,
  currencySymbol: string
): string | null {
  if (q <= 0) return null;
  const unit = getShareLinkItemUnitPrice(item, q);
  if (!Number.isFinite(unit)) return null;
  const label = getOrderUnitLabel(item.priceUnit);
  const priceStr = `${currencySymbol}${unit.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const qstep = getQuantityStep(item);
  const setCount = Math.floor(q / qstep);
  return `${q} ${label} (${setCount}) × ${priceStr}`;
}

function getFieldLabelAndUnitSuffix(
  item: ShareLinkItem,
  n: number
): { label: string; unitSuffix: string } {
  const row = item as unknown as Record<string, string | undefined>;
  const explicitUnit = row[`field${n}Unit`];
  const rawLabel = row[`field${n}Label`];
  if (explicitUnit != null && String(explicitUnit).trim() !== '') {
    return { label: (rawLabel || `Field ${n}`).trim(), unitSuffix: String(explicitUnit).trim() };
  }
  if (rawLabel) {
    const m = rawLabel.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (m) return { label: m[1].trim(), unitSuffix: m[2].trim() };
    return { label: rawLabel.trim(), unitSuffix: '' };
  }
  return { label: `Field ${n}`, unitSuffix: '' };
}

function ImgIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function QtyControl({
  value,
  step,
  onChange,
}: {
  value: number;
  step: number;
  onChange: (delta: number) => void;
}) {
  const s = Math.max(1, Math.floor(step) || 1);
  const inc = s > 1 ? s : 1;
  return (
    <div className="of-qty">
      <button type="button" className="of-qty-btn" onClick={() => onChange(-inc)}>−</button>
      <span className="of-qty-val">{value}</span>
      <button type="button" className="of-qty-btn" onClick={() => onChange(inc)}>+</button>
    </div>
  );
}

export interface OrderLinkProductDetailProps {
  item: ShareLinkItem;
  currencySymbol: string;
  cartLines: OrderCartLine[];
  draftVariantSelections: VariantSelectionMap;
  onDraftVariantSelectionsChange: Dispatch<SetStateAction<VariantSelectionMap>>;
  onCartLinesChange: Dispatch<SetStateAction<OrderCartLine[]>>;
  onDone: () => void;
}

export default function OrderLinkProductDetail({
  item,
  currencySymbol,
  cartLines,
  draftVariantSelections,
  onDraftVariantSelectionsChange,
  onCartLinesChange,
  onDone,
}: OrderLinkProductDetailProps) {
  const drawerDraft = draftVariantSelections[item.productId] ?? {};
  const dQ = getCartLineQty(cartLines, item.productId, drawerDraft);
  const unit = getShareLinkItemUnitPrice(item, dQ);
  const dAmt = dQ > 0 && Number.isFinite(unit) ? dQ * unit : 0;
  const drawerVariantGroups = item.variantGroups ?? [];
  const drawerDraftComplete = isVariantSelectionComplete(drawerVariantGroups, drawerDraft);
  const drawerCommittedLines = cartLinesForProduct(cartLines, item.productId);
  const showDrawerDraftQty = drawerVariantGroups.length === 0 || (drawerDraftComplete && dQ === 0);
  const dHasPrice = Number.isFinite(parseItemPriceNumeric(item.price));
  const drawerCalcDetail =
    dHasPrice && dQ > 0 ? formatLineCalculationDetail(dQ, item, currencySymbol) : null;

  const fields = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => {
      const val = (item as Record<string, unknown>)[`field${n}`];
      if (val === undefined || val === null || String(val).trim() === '') return null;
      const { label, unitSuffix } = getFieldLabelAndUnitSuffix(item, n);
      return { label, value: unitSuffix ? `${String(val)} ${unitSuffix}` : String(val) };
    })
    .filter(Boolean) as { label: string; value: string }[];

  const changeQty = (delta: number) => {
    const draftSelection = draftVariantSelections[item.productId] ?? {};
    const groups = item.variantGroups ?? [];
    if (groups.length > 0 && !isVariantSelectionComplete(groups, draftSelection)) {
      return;
    }
    const current = getCartLineQty(cartLines, item.productId, draftSelection);
    const next = applyQuantityDelta(
      current,
      delta,
      getQuantityStep(item),
      getEffectiveMinimumOrderQuantity(item.minimumOrderQuantity, getQuantityStep(item))
    );
    onCartLinesChange((prev) => setCartLineQty(prev, item.productId, draftSelection, next));
  };

  const changeCartLineQty = (lineId: string, delta: number) => {
    const line = cartLines.find((l) => l.lineId === lineId);
    if (!line) return;
    const next = applyQuantityDelta(
      line.quantity,
      delta,
      getQuantityStep(item),
      getEffectiveMinimumOrderQuantity(item.minimumOrderQuantity, getQuantityStep(item))
    );
    onCartLinesChange((prev) => setCartLineQtyById(prev, lineId, next));
  };

  return (
    <article className="of-product-page-layout">
      <div className="of-product-page-media">
        {shouldUseProductMediaGallery(item.imageUrls?.length ?? 0, item.videoUrls?.length ?? 0) ? (
          <div className="of-product-page-gallery">
            <ProductImageGallery
              urls={item.imageUrls ?? (item.imageUrl ? [item.imageUrl] : [])}
              videoUrls={item.videoUrls}
              primaryIndex={item.primaryImageIndex ?? 0}
              primaryImageVersion={item.imageVersion}
            />
          </div>
        ) : item.imageUrl ? (
          <img
            key={productImageDisplayUrl(item.imageUrl, item.imageVersion)}
            src={productImageDisplayUrl(item.imageUrl, item.imageVersion)}
            alt={item.name}
            className="of-product-page-img"
          />
        ) : (
          <div className="of-product-page-img-ph"><ImgIcon /></div>
        )}
      </div>

      <div className="of-product-page-body">
        <h1 className="of-drawer-name">{item.name}</h1>
        {item.subtitle ? <div className="of-drawer-sub">({item.subtitle})</div> : null}

        {item.price !== undefined && item.price !== '' ? (
          <div className="of-drawer-price-row">
            <div className="of-drawer-price">
              {formatUnitPrice(item.price, currencySymbol)}
              {item.priceUnit ? ` ${item.priceUnit}` : ''}
            </div>
          </div>
        ) : null}

        {fields.length > 0 ? (
          <div className="of-detail-table">
            {fields.map((f, i) => (
              <div key={i} className="of-detail-row">
                <span className="of-detail-label">{f.label}</span>
                <span className="of-detail-val">{f.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        {drawerVariantGroups.length > 0 ? (
          <ProductVariantsDisplay
            groups={drawerVariantGroups}
            mode="select"
            selection={drawerDraft}
            onSelect={(groupId, option) => {
              const nextSelection = {
                ...(draftVariantSelections[item.productId] ?? {}),
                [groupId]: option,
              };
              onDraftVariantSelectionsChange((prev) => ({
                ...prev,
                [item.productId]: nextSelection,
              }));
              onCartLinesChange((prev) => removeZeroQtyLinesForProduct(prev, item.productId));
            }}
          />
        ) : null}

        <div className="of-drawer-qty-section">
          <div className="of-drawer-qty-label">Select quantity</div>
          <div className="of-drawer-qty-row">
            {showDrawerDraftQty ? (
              <QtyControl
                value={dQ}
                step={getQuantityStep(item)}
                onChange={changeQty}
              />
            ) : null}
            {showDrawerDraftQty && dQ > 0 ? (
              <div className="of-drawer-line-total-wrap">
                {drawerCalcDetail ? (
                  <div className="of-drawer-line-calc">{drawerCalcDetail}</div>
                ) : null}
                <span className="of-drawer-line-total">
                  {dHasPrice ? formatOrderMoney(dAmt, currencySymbol) : '—'}
                </span>
              </div>
            ) : null}
          </div>

          {drawerCommittedLines.length > 0 ? (
            <div className="of-product-variant-lines">
              {drawerCommittedLines.map((line) => {
                const lineSummary = formatVariantSelectionSummary(
                  drawerVariantGroups,
                  line.variantSelection
                );
                return (
                  <div key={line.lineId} className="of-product-variant-line">
                    <button
                      type="button"
                      className="of-product-variant-line-label"
                      onClick={() =>
                        onDraftVariantSelectionsChange((prev) => ({
                          ...prev,
                          [item.productId]: { ...line.variantSelection },
                        }))
                      }
                    >
                      {lineSummary || 'Variant'}
                    </button>
                    <QtyControl
                      value={line.quantity}
                      step={getQuantityStep(item)}
                      onChange={(delta) => changeCartLineQty(line.lineId, delta)}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <button type="button" className="of-drawer-done" onClick={onDone}>
          {dQ > 0 ? 'Add to cart' : 'Back to items'}
        </button>
      </div>
    </article>
  );
}
