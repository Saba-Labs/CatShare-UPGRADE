import ProductImageGallery from '../ProductImageGallery';
import ProductVariantsDisplay from '../ProductVariantsDisplay';
import {
  formatVariantSelectionSummary,
  getProductVariantGroups,
  getVariantCombinationData,
} from '../../utils/productVariants';
import { getCatalogueData, normalizeOrderQuantityStep } from '../../config/catalogueProductUtils';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { StorePublic } from '../../services/storeService';
import {
  buildStorefrontDetailFields,
  fmt,
  fmtCalc,
  getStorefrontPriceAndUnit,
  getStoreProductGalleryProps,
  isDisplayableProductImage,
  unitLabel,
} from './storefrontOrderHelpers';
import { IconImage, PackHint } from './StorefrontIcons';
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
  const s = normalizeOrderQuantityStep(step);
  return (
    <div className={`sv-qty${accent ? ' accent' : ''}`}>
      <button type="button" className="sv-qty-btn" onClick={() => onChange(-s)}>
        −
      </button>
      <span className="sv-qty-val">{value}</span>
      <button type="button" className="sv-qty-btn" onClick={() => onChange(s)}>
        +
      </button>
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
  const catData = store.catalogueId ? getCatalogueData(product, store.catalogueId) : null;
  const variantData = getVariantCombinationData(product, variantSelection);
  const { price, priceUnit, listPrice, showOffer } = getStorefrontPriceAndUnit(
    catData,
    catalogue,
    product,
    variantSelection
  );
  const qstep = normalizeOrderQuantityStep(
    variantData?.customFields?.orderQuantityStep ?? catData?.orderQuantityStep
  );
  const calcDetail = quantity > 0 ? fmtCalc(quantity, price, priceUnit, currencySymbol, qstep) : null;
  const fields = buildStorefrontDetailFields(
    product,
    store.catalogueId,
    sellerFieldsDefinition,
    variantSelection
  );
  const groups = getProductVariantGroups(product);
  const variantSummary = formatVariantSelectionSummary(groups, variantSelection);
  const gallery = getStoreProductGalleryProps(product);
  const variantImageUrl = variantData?.image;
  const imageSrc = variantImageUrl || gallery.fallback;

  const rootClass =
    layout === 'page'
      ? `sv-product-order-page website-product-page wp-${layoutVariant}`
      : 'sv-drawer-inner';

  const imageBlock = (
    <div
      className={`sv-drawer-img-wrap${gallery.urls.length > 1 ? ' sv-drawer-img-wrap--gallery sv-drawer-img-wrap--thumbs' : ''}`}
    >
      {variantImageUrl ? (
        <img src={variantImageUrl} alt={product.name} />
      ) : gallery.urls.length > 1 ? (
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

  const orderSection = showQuantitySelector ? (
    <div className="sv-drawer-qty-section">
      <div className="sv-drawer-qty-header">
        <div className="sv-drawer-qty-label">Quantity</div>
        {qstep > 1 ? <PackHint step={qstep} className="website-product-pack-hint" /> : null}
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

      {!fieldsAfterOrder ? fieldsTable : null}

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
