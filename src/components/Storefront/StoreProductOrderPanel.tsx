import ProductImageGallery from '../ProductImageGallery';
import ProductVariantsDisplay from '../ProductVariantsDisplay';
import {
  formatVariantSelectionSummary,
  getProductVariantGroups,
  getVariantCombinationData,
} from '../../utils/productVariants';
import { getCatalogueData } from '../../config/catalogueProductUtils';
import { getProductOrderQuantityRules } from '../../utils/quantityPricingUtils';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { StorePublic } from '../../services/storeService';
import {
  buildStorefrontDetailFields,
  fmt,
  fmtCalc,
  getEffectiveQuantitySlabs,
  getStorefrontPriceAndUnit,
  getStoreProductGalleryProps,
  getStorefrontProductGalleryProps,
  getStorefrontVariantPrimaryImageUrl,
  isDisplayableProductImage,
  unitLabel,
} from './storefrontOrderHelpers';
import { formatQuantitySlabRange, type QuantityPriceSlab } from '../../utils/quantityPricingUtils';
import { IconImage, MoqHint, PackHint } from './StorefrontIcons';
import ProductDescriptionView from '../ProductDescriptionView';
import './store-product-order-page.css';

function QtyControl({
  value,
  step,
  onChange,
  accent = false,
}: {
  value: number;
  step: number;
  onChange: (d: number) => void;
  accent?: boolean;
}) {
  const s = Math.max(1, Math.floor(step) || 1);
  const handleMinus = () => onChange(-s);
  const handlePlus = () => onChange(s);
  return (
    <div className={`sv-qty${accent ? ' accent' : ''}`}>
      <button type="button" className="sv-qty-btn" onClick={handleMinus}>
        −
      </button>
      <span className="sv-qty-val">{value}</span>
      <button type="button" className="sv-qty-btn" onClick={handlePlus}>
        +
      </button>
    </div>
  );
}

function slabMatchesQuantity(slab: QuantityPriceSlab, qty: number): boolean {
  if (qty <= 0) return false;
  return qty >= slab.minQty && (slab.maxQty == null || qty <= slab.maxQty);
}

function QuantitySlabPricing({
  slabs,
  quantity,
  currencySymbol,
}: {
  slabs: QuantityPriceSlab[];
  quantity: number;
  currencySymbol: string;
  priceUnit?: string;
}) {
  if (slabs.length === 0) return null;

  return (
    <div className="sv-order-slab-compact" aria-label="Volume pricing tiers">
      <span className="sv-order-slab-label">Bulk pricing</span>
      <div className="sv-order-slab-chips">
        {slabs.map((slab) => {
          const active = slabMatchesQuantity(slab, quantity);
          const rangeLabel = formatQuantitySlabRange(slab);
          return (
            <span
              key={`${slab.minQty}-${slab.maxQty ?? 'open'}`}
              className={`sv-order-slab-chip${active ? ' is-active' : ''}`}
            >
              {rangeLabel} · {fmt(slab.price, currencySymbol)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function VariantPills({ summary }: { summary: string }) {
  const parts = summary.split(/;\s*/).filter(Boolean);
  return (
    <div className="sv-variant-pills">
      {parts.map((part) => (
        <span key={part} className="sv-variant-pill">
          {part}
        </span>
      ))}
    </div>
  );
}

export interface StoreProductOrderPanelProps {
  product: ProductWithCatalogueData;
  store: StorePublic;
  currencySymbol: string;
  catalogue: import('../../config/catalogueConfig').Catalogue | null;
  sellerFieldsDefinition: unknown;
  quantity: number;
  variantSelection: Record<string, string>;
  variantError: boolean;
  onVariantSelect: (groupId: string, option: string) => void;
  onQtyChange: (delta: number) => void;
  onDone: () => void;
  layout?: 'page' | 'drawer';
  layoutVariant?: 'editorial' | 'tech' | 'minimal';
  orderCtaLabel?: string;
  ctaStyle?: 'solid' | 'outline';
  showQuantitySelector?: boolean;
}

export default function StoreProductOrderPanel({
  product,
  store,
  currencySymbol,
  catalogue,
  sellerFieldsDefinition,
  quantity,
  variantSelection,
  variantError,
  onVariantSelect,
  onQtyChange,
  onDone,
  layout = 'page',
  layoutVariant = 'minimal',
  orderCtaLabel = 'Done',
  ctaStyle = 'solid',
  showQuantitySelector = true,
}: StoreProductOrderPanelProps) {
  const catalogueId = catalogue?.id ?? store.catalogueId ?? '';
  const catData = catalogueId ? getCatalogueData(product, catalogueId) : null;
  const variantData = getVariantCombinationData(product, variantSelection, catalogueId);
  const rules = getProductOrderQuantityRules(catData, variantData?.customFields);
  const qstep = rules.step;
  const minQty = rules.minQty;
  const slabTiers = getEffectiveQuantitySlabs(catData, variantData ?? undefined);
  const { price, priceUnit, listPrice, showOffer, priceFrom } = getStorefrontPriceAndUnit(
    catData,
    catalogue,
    product,
    variantSelection,
    quantity
  );
  const calcDetail = quantity > 0 ? fmtCalc(quantity, price, priceUnit, currencySymbol, qstep) : null;
  const fields = buildStorefrontDetailFields(
    product,
    catalogueId,
    sellerFieldsDefinition,
    variantSelection
  );
  const groups = getProductVariantGroups(product);
  const variantSummary = formatVariantSelectionSummary(groups, variantSelection);
  const gallery = getStorefrontProductGalleryProps(product, variantData);
  const imageSrc = gallery.fallback;

  const rootClass =
    layout === 'page'
      ? `sv-product-order-page website-product-page wp-${layoutVariant}`
      : 'sv-drawer-inner';

  const imageBlock = (
    <div
      className={`sv-drawer-img-wrap${gallery.urls.length > 1 ? ' sv-drawer-img-wrap--gallery sv-drawer-img-wrap--thumbs' : ''}`}
    >
      {gallery.urls.length > 1 ? (
        <ProductImageGallery
          urls={gallery.urls}
          primaryIndex={gallery.primaryIndex}
          primaryImageVersion={gallery.primaryImageVersion}
          fillContainer
          objectFit="contain"
          showPrimaryBadge={false}
          showThumbnails
          className="sv-store-gallery"
        />
      ) : isDisplayableProductImage(imageSrc) ? (
        <img src={imageSrc} alt={product.name} />
      ) : (
          <div className="sv-drawer-img-ph">
            <IconImage size={48} />
          </div>
      )}
    </div>
  );

  const fieldsTable =
    fields.length > 0 ? (
      <div className="sv-detail-table">
        {fields.map((f) => (
          <div key={`${f.label}-${f.value}`} className="sv-detail-row">
            <span className="sv-detail-lbl">{f.label}</span>
            <span className="sv-detail-val">{f.value}</span>
          </div>
        ))}
      </div>
    ) : null;

  const descriptionEl =
    (product.description ?? '').trim() ? (
      <ProductDescriptionView html={product.description} />
    ) : null;

  const orderSection = showQuantitySelector ? (
    <div className="sv-drawer-qty-section sv-order-qty-card">
      <div className="sv-drawer-qty-header">
        <span className="sv-drawer-qty-label">Quantity</span>
        {(qstep > 1 || rules.moq > 1) ? (
          <div className="sv-drawer-qty-rules" role="list" aria-label="Ordering rules">
            {qstep > 1 ? <PackHint step={qstep} /> : null}
            {rules.moq > 1 ? <MoqHint minQty={minQty} /> : null}
          </div>
        ) : null}
      </div>
      <div className="sv-drawer-qty-row">
        <QtyControl value={quantity} step={qstep} onChange={onQtyChange} accent={quantity > 0} />
        <div className="sv-drawer-total-wrap">
          {calcDetail ? <div className="sv-drawer-calc">{calcDetail}</div> : null}
          <div className="sv-drawer-total">{fmt(price * quantity, currencySymbol)}</div>
        </div>
      </div>
      <button
        type="button"
        className={`sv-drawer-done${ctaStyle === 'outline' ? ' sv-drawer-done--outline' : ''}`}
        onClick={onDone}
      >
        {orderCtaLabel}
      </button>
    </div>
  ) : (
    <button
      type="button"
      className={`sv-drawer-done${ctaStyle === 'outline' ? ' sv-drawer-done--outline' : ''}`}
      onClick={onDone}
      style={{ marginTop: 20 }}
    >
      {orderCtaLabel}
    </button>
  );

  const fieldsAfterOrder = layout === 'page';

  const detailsBlock = (
    <div className="sv-drawer-body">
      <div className="sv-drawer-name">{product.name}</div>
      {product.subtitle ? <div className="sv-drawer-sub">{product.subtitle}</div> : null}
      {variantSummary ? <VariantPills summary={variantSummary} /> : null}

      <div className="sv-drawer-price">
        {Number.isFinite(price) ? (
          <>
            {priceFrom ? 'From ' : ''}
            {fmt(price, currencySymbol)}
            {showOffer && listPrice != null && listPrice > 0 ? (
              <span className="sv-price-strike">{fmt(listPrice, currencySymbol)}</span>
            ) : null}
            {priceUnit ? <span>/ {unitLabel(priceUnit)}</span> : null}
          </>
        ) : (
          <span style={{ color: 'var(--c-text3)', fontWeight: 400 }}>Price on request</span>
        )}
      </div>
      {slabTiers.length > 0 ? (
        <QuantitySlabPricing
          slabs={slabTiers}
          quantity={quantity}
          currencySymbol={currencySymbol}
        />
      ) : null}

      {!fieldsAfterOrder ? (
        <>
          {fieldsTable}
          {descriptionEl}
        </>
      ) : null}

      {groups.length > 0 ? (
        <ProductVariantsDisplay
          groups={groups}
          mode="select"
          selection={variantSelection}
          error={variantError}
          onSelect={onVariantSelect}
        />
      ) : null}

      {orderSection}

      {fieldsAfterOrder && fieldsTable ? (
        <div className="sv-detail-table-after-order">{fieldsTable}</div>
      ) : null}

      {fieldsAfterOrder && descriptionEl ? (
        <div className="sv-product-description-row sv-product-description-row--span">{descriptionEl}</div>
      ) : null}
    </div>
  );

  if (layout === 'drawer') {
    return (
      <div className={rootClass}>
        {imageBlock}
        {detailsBlock}
      </div>
    );
  }

  return (
    <article className={rootClass}>
      <div className="website-product-gallery sv-product-order-media">{imageBlock}</div>
      <div className="website-product-info sv-product-order-details">{detailsBlock}</div>
    </article>
  );
}
