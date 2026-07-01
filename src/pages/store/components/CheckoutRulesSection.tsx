import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiCalendar, FiCheck, FiChevronLeft, FiChevronRight, FiClock, FiGrid, FiPackage, FiPercent, FiPlus, FiShoppingBag, FiTag, FiTrash2, FiTruck, FiX } from 'react-icons/fi';
import ToggleSwitch from './ToggleSwitch';
import ConfirmDialog from './ConfirmDialog';
import {
  CHECKOUT_RULE_PRESETS,
  createRuleFromPreset,
  dateTimeInputsToExpiresAt,
  describeCheckoutRule,
  expiresAtToDateInput,
  expiresAtToTimeInput,
  formatCouponExpiryPreview,
  formatCouponExpirySummary,
  isCategoryCouponRuleType,
  isCouponRuleExpired,
  isCouponRuleType,
  isProductCouponRuleType,
  summarizeCheckoutRule,
  type CheckoutApplyBase,
  type CheckoutPaymentMethod,
  type CheckoutRule,
  type CheckoutRuleCategory,
  type CheckoutRulePreset,
} from '../../../types/checkoutSettings';
import { STORE_FIELD_CLASS, STORE_SECTION_TITLE } from '../storeTypography';
import InfoTooltipButton from './InfoTooltipButton';

function EditorSection({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 p-4 space-y-3 ${className}`}
    >
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FieldLabel({
  children,
  info,
  infoLabel,
}: {
  children: ReactNode;
  info?: string;
  infoLabel?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{children}</span>
      {info ? <InfoTooltipButton text={info} label={infoLabel ?? String(children)} /> : null}
    </div>
  );
}

function CouponExpiryField({
  expiresAt,
  disabled,
  onChange,
}: {
  expiresAt?: string | null;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  const dateValue = expiresAtToDateInput(expiresAt);
  const timeValue = expiresAtToTimeInput(expiresAt);
  const preview = formatCouponExpiryPreview(expiresAt);

  const patch = (date: string, time: string) => {
    onChange(dateTimeInputsToExpiresAt(date, time));
  };

  return (
    <div className="space-y-2">
      <FieldLabel
        info="Coupon turns off automatically when this moment passes. Leave empty for no expiry."
        infoLabel="Ends"
      >
        Ends
      </FieldLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <FiCalendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="date"
            value={dateValue}
            disabled={disabled}
            onChange={(e) => patch(e.target.value, timeValue)}
            className={`${STORE_FIELD_CLASS} pl-9`}
          />
        </div>
        <div className="relative">
          <FiClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="time"
            value={timeValue}
            disabled={disabled || !dateValue}
            onChange={(e) => patch(dateValue, e.target.value)}
            className={`${STORE_FIELD_CLASS} pl-9`}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 min-h-[1.25rem]">
        {preview ? (
          <p className="text-xs text-gray-600 dark:text-gray-400">Ends {preview}</p>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">No end date set</p>
        )}
        {dateValue ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CategorySelectGrid({
  options,
  selected,
  disabled,
  onToggle,
}: {
  options: string[];
  selected: string[];
  disabled?: boolean;
  onToggle: (name: string) => void;
}) {
  if (options.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">No categories in catalogue yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((name) => {
        const isSelected = selected.includes(name);
        const initial = name.trim().charAt(0).toUpperCase() || '?';
        return (
          <button
            key={name}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(name)}
            className={`relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
              isSelected
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-sm ring-1 ring-blue-500/30'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 hover:border-blue-300 dark:hover:border-blue-700'
            }`}
          >
            <span
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              {initial}
            </span>
            <span
              className={`min-w-0 flex-1 text-sm font-semibold truncate ${
                isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {name}
            </span>
            {isSelected ? (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                <FiCheck className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ProductThumb({
  imageUrl,
  name,
  size = 'md',
}: {
  imageUrl?: string;
  name: string;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11';
  return (
    <span
      className={`${dim} flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <FiPackage className="h-4 w-4 text-gray-400" aria-hidden />
      )}
    </span>
  );
}

function SelectedProductsRail({
  products,
  disabled,
  onRemove,
}: {
  products: CheckoutProductOption[];
  disabled?: boolean;
  onRemove: (id: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [products, updateScrollState]);

  const scroll = (direction: -1 | 1) => {
    railRef.current?.scrollBy({ left: direction * 168, behavior: 'smooth' });
  };

  if (products.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {products.length} selected
        </p>
        {(canScrollLeft || canScrollRight) && products.length > 2 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled || !canScrollLeft}
              onClick={() => scroll(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 disabled:opacity-30"
              aria-label="Scroll selected products left"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={disabled || !canScrollRight}
              onClick={() => scroll(1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 disabled:opacity-30"
              aria-label="Scroll selected products right"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative -mx-1">
        {canScrollLeft ? (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-gray-50 dark:from-gray-900/80 to-transparent" />
        ) : null}
        {canScrollRight ? (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-gray-50 dark:from-gray-900/80 to-transparent" />
        ) : null}
        <div
          ref={railRef}
          className="flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              disabled={disabled}
              onClick={() => onRemove(product.id)}
              className="group relative flex w-[5.5rem] flex-shrink-0 flex-col items-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 p-2 text-center transition-colors hover:border-red-300 dark:hover:border-red-800"
            >
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <FiX className="h-2.5 w-2.5" />
              </span>
              <ProductThumb imageUrl={product.imageUrl} name={product.name} size="md" />
              <span className="w-full text-[11px] font-semibold leading-tight text-gray-900 dark:text-gray-100 line-clamp-2">
                {product.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductSelectList({
  allProducts,
  filteredProducts,
  selectedIds,
  query,
  disabled,
  onQueryChange,
  onToggle,
}: {
  allProducts: CheckoutProductOption[];
  filteredProducts: CheckoutProductOption[];
  selectedIds: string[];
  query: string;
  disabled?: boolean;
  onQueryChange: (q: string) => void;
  onToggle: (id: string) => void;
}) {
  if (allProducts.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">No products in catalogue yet.</p>;
  }

  const selectedProducts = selectedIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter((p): p is CheckoutProductOption => Boolean(p));

  return (
    <div className="space-y-3">
      <SelectedProductsRail products={selectedProducts} disabled={disabled} onRemove={onToggle} />
      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => onQueryChange(e.target.value)}
          className={STORE_FIELD_CLASS}
          placeholder="Search products…"
        />
      </div>
      <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-2">
        {filteredProducts.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
            No products match your search.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredProducts.map((product) => {
              const selected = selectedIds.includes(product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggle(product.id)}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border p-2.5 text-center transition-all ${
                    selected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-500/40'
                      : 'border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/40 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <ProductThumb imageUrl={product.imageUrl} name={product.name} />
                  <span className="w-full min-w-0">
                    <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
                      {product.name}
                    </span>
                    {product.subtitle ? (
                      <span className="block text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                        {product.subtitle}
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                      <FiCheck className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const COUPON_PRESET_GROUPS: { title: string; subtitle: string; types: string[] }[] = [
  {
    title: 'Whole order',
    subtitle: 'Discount applies to the entire cart',
    types: ['coupon_percent', 'coupon_flat'],
  },
  {
    title: 'By category',
    subtitle: 'Only items in selected categories',
    types: ['coupon_category_percent', 'coupon_category_flat'],
  },
  {
    title: 'By product',
    subtitle: 'Only the products you pick',
    types: ['coupon_product_percent', 'coupon_product_flat'],
  },
];

function presetIcon(preset: CheckoutRulePreset) {
  if (preset.type.startsWith('coupon_product_')) return FiPackage;
  if (preset.type.startsWith('coupon_category_')) return FiGrid;
  if (preset.type.startsWith('coupon_')) return FiShoppingBag;
  if (preset.category === 'shipping') return FiTruck;
  if (preset.category === 'tax') return FiPercent;
  return FiTag;
}

function presetAccent(preset: CheckoutRulePreset): string {
  if (preset.type.startsWith('coupon_product_')) return 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300';
  if (preset.type.startsWith('coupon_category_')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
  if (preset.type.startsWith('coupon_')) return 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
  if (preset.category === 'shipping') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
  if (preset.category === 'tax') return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function RulePresetCard({
  preset,
  disabled,
  onPick,
}: {
  preset: CheckoutRulePreset;
  disabled?: boolean;
  onPick: (preset: CheckoutRulePreset) => void;
}) {
  const Icon = presetIcon(preset);
  const accent = presetAccent(preset);
  const badge = preset.amountKind === 'percent' ? '%' : '₹';

  return (
    <button
      type="button"
      onClick={() => onPick(preset)}
      disabled={disabled}
      className="group flex w-full items-start gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-3.5 text-left transition-all hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50"
    >
      <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preset.label}</span>
          <span className="rounded-md bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:text-gray-300">
            {badge}
          </span>
        </span>
        {preset.hint ? (
          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400 leading-snug">{preset.hint}</span>
        ) : null}
      </span>
      <FiChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors" />
    </button>
  );
}

function RulePresetPicker({
  presets,
  disabled,
  onPick,
}: {
  presets: CheckoutRulePreset[];
  disabled?: boolean;
  onPick: (preset: CheckoutRulePreset) => void;
}) {
  const isCouponPicker = presets.length > 0 && presets.every((p) => p.type.startsWith('coupon_'));

  if (isCouponPicker) {
    return (
      <div className="space-y-5">
        {COUPON_PRESET_GROUPS.map((group) => {
          const groupPresets = presets.filter((p) => group.types.includes(p.type));
          if (groupPresets.length === 0) return null;
          return (
            <section key={group.title}>
              <div className="mb-2.5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{group.subtitle}</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {groupPresets.map((preset) => (
                  <RulePresetCard key={`${preset.type}-${preset.label}`} preset={preset} disabled={disabled} onPick={onPick} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {presets.map((preset) => (
        <RulePresetCard key={`${preset.type}-${preset.label}`} preset={preset} disabled={disabled} onPick={onPick} />
      ))}
    </div>
  );
}

interface CheckoutProductOption {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string;
}

interface CheckoutRulesSectionProps {
  category: CheckoutRuleCategory;
  rules: CheckoutRule[];
  onChange: (rules: CheckoutRule[]) => void;
  disabled?: boolean;
  presetFilter?: (preset: CheckoutRulePreset) => boolean;
  ruleFilter?: (rule: CheckoutRule) => boolean;
  /** Product category labels for category coupon rules */
  categoryOptions?: string[];
  /** Store products for product coupon rules */
  productOptions?: CheckoutProductOption[];
}

const APPLY_BASE_LABELS: Record<CheckoutApplyBase, string> = {
  subtotal: 'Item subtotal',
  after_discount: 'After discounts',
  after_shipping: 'After shipping',
};

function StoreModal({
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`relative z-10 w-full flex flex-col min-h-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] ${
          wide ? 'max-w-xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="min-w-0 pr-1">
            <h2 id={titleId} className={`${STORE_SECTION_TITLE} text-gray-900 dark:text-gray-100`}>
              {title}
            </h2>
            {description ? (
              <p
                id={descId}
                className="mt-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-5 flex-1 min-h-0">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 flex-shrink-0 bg-white dark:bg-gray-900 rounded-b-2xl">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function RuleEditorForm({
  rule,
  onChange,
  disabled,
  categoryOptions = [],
  productOptions = [],
}: {
  rule: CheckoutRule;
  onChange: (patch: Partial<CheckoutRule>) => void;
  disabled?: boolean;
  categoryOptions?: string[];
  productOptions?: CheckoutProductOption[];
}) {
  const isCoupon = isCouponRuleType(rule.type);
  const isCategoryCoupon = isCategoryCouponRuleType(rule.type);
  const isProductCoupon = isProductCouponRuleType(rule.type);
  const isFreeShipping = rule.type === 'free_shipping_above';
  const isCod = rule.type === 'cod_charge';
  const isPercent = rule.amountKind === 'percent' && !isFreeShipping;
  const showApplyBase =
    rule.category === 'tax' || rule.category === 'discount' || rule.type === 'custom';
  const showPaymentMethod = rule.type === 'cod_charge' || rule.type === 'custom';
  const selectedCategories = Array.isArray(rule.allowedCategories) ? rule.allowedCategories : [];
  const selectedProductIds = Array.isArray(rule.allowedProductIds) ? rule.allowedProductIds : [];
  const [productQuery, setProductQuery] = useState('');

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return productOptions;
    return productOptions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.subtitle?.toLowerCase().includes(q) ?? false)
    );
  }, [productOptions, productQuery]);

  const toggleAllowedCategory = (name: string) => {
    const next = selectedCategories.includes(name)
      ? selectedCategories.filter((c) => c !== name)
      : [...selectedCategories, name];
    onChange({ allowedCategories: next });
  };

  const toggleAllowedProduct = (id: string) => {
    const next = selectedProductIds.includes(id)
      ? selectedProductIds.filter((pid) => pid !== id)
      : [...selectedProductIds, id];
    onChange({ allowedProductIds: next });
  };

  const couponCommonFields = isCoupon ? (
    <>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 px-3 py-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Once per customer</span>
          <InfoTooltipButton
            text="Each WhatsApp / phone number can use this code only once."
            label="Once per customer"
          />
        </div>
        <ToggleSwitch
          checked={rule.oncePerCustomer === true}
          onChange={(oncePerCustomer) => onChange({ oncePerCustomer })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel
            info="Maximum orders that can use this code across all customers. Leave empty for unlimited."
            infoLabel="Total Coupons available"
          >
            Total Coupons available
          </FieldLabel>
          <input
            type="number"
            min={1}
            step={1}
            value={rule.maxTotalUses ?? ''}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                maxTotalUses: e.target.value === '' ? null : Math.max(1, Number(e.target.value) || 0),
              })
            }
            className={STORE_FIELD_CLASS}
            placeholder="Unlimited"
          />
        </div>
        <div className="sm:col-span-2">
          <CouponExpiryField
            expiresAt={rule.expiresAt}
            disabled={disabled}
            onChange={(expiresAt) => onChange({ expiresAt })}
          />
        </div>
      </div>
    </>
  ) : null;

  const orderConditionFields = !isFreeShipping ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <FieldLabel info="Rule applies only when order subtotal is at least this amount.">
          Min order (₹)
        </FieldLabel>
        <input
          type="number"
          min={0}
          value={rule.minSubtotal ?? ''}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              minSubtotal: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          className={STORE_FIELD_CLASS}
          placeholder="No minimum"
        />
      </div>
      <div>
        <FieldLabel info="Rule does not apply when order subtotal exceeds this amount.">
          Max order (₹)
        </FieldLabel>
        <input
          type="number"
          min={0}
          value={rule.maxSubtotal ?? ''}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              maxSubtotal: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          className={STORE_FIELD_CLASS}
          placeholder="No maximum"
        />
      </div>
      {isPercent ? (
        <div>
          <FieldLabel
            info={
              rule.category === 'discount'
                ? 'Optional cap on how much discount can be applied.'
                : 'Optional cap on how much can be charged.'
            }
          >
            {rule.category === 'discount' ? 'Max discount (₹)' : 'Max cap (₹)'}
          </FieldLabel>
          <input
            type="number"
            min={0}
            value={rule.maxAmount ?? ''}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                maxAmount: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            className={STORE_FIELD_CLASS}
            placeholder="Optional"
          />
        </div>
      ) : null}
      {showApplyBase ? (
        <div>
          <FieldLabel info="Which part of the order total this rule is calculated from.">
            Calculate on
          </FieldLabel>
          <select
            value={rule.applyBase}
            disabled={disabled}
            onChange={(e) => onChange({ applyBase: e.target.value as CheckoutApplyBase })}
            className={STORE_FIELD_CLASS}
          >
            {Object.entries(APPLY_BASE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {showPaymentMethod ? (
        <div>
          <FieldLabel info="Limit this rule to a specific payment method at checkout.">
            Payment method
          </FieldLabel>
          <select
            value={rule.paymentMethod}
            disabled={disabled || rule.type === 'cod_charge'}
            onChange={(e) =>
              onChange({ paymentMethod: e.target.value as CheckoutPaymentMethod })
            }
            className={STORE_FIELD_CLASS}
          >
            <option value="any">Any</option>
            <option value="prepaid">Prepaid / online only</option>
            <option value="cod">Cash on delivery only</option>
          </select>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <EditorSection title="Basics">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <FieldLabel>Rule name</FieldLabel>
            <input
              type="text"
              value={rule.label}
              disabled={disabled}
              onChange={(e) => onChange({ label: e.target.value })}
              className={STORE_FIELD_CLASS}
            />
          </div>

          {!isFreeShipping ? (
            <div>
              <FieldLabel>
                {isPercent
                  ? rule.category === 'discount'
                    ? 'Discount (%)'
                    : rule.category === 'tax'
                      ? 'Tax (%)'
                      : 'Rate (%)'
                  : isCod
                    ? 'COD fee (₹)'
                    : rule.category === 'shipping'
                      ? 'Charge (₹)'
                      : 'Amount (₹)'}
              </FieldLabel>
              <input
                type="number"
                min={0}
                step={isPercent ? 0.1 : 1}
                value={rule.value}
                disabled={disabled}
                onChange={(e) => onChange({ value: Number(e.target.value) || 0 })}
                className={STORE_FIELD_CLASS}
              />
            </div>
          ) : null}

          {isCoupon ? (
            <div>
              <FieldLabel>Coupon code *</FieldLabel>
              <input
                type="text"
                value={rule.code ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({ code: e.target.value.toUpperCase() })}
                className={STORE_FIELD_CLASS}
                placeholder="SAVE10"
              />
            </div>
          ) : null}

          {isFreeShipping ? (
            <div className="sm:col-span-2">
              <FieldLabel info="Waive delivery charges when the order subtotal reaches this amount.">
                Free shipping above (₹)
              </FieldLabel>
              <input
                type="number"
                min={0}
                value={rule.freeAbove ?? ''}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    freeAbove: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className={STORE_FIELD_CLASS}
                placeholder="e.g. 999"
              />
            </div>
          ) : null}
        </div>
      </EditorSection>

      {isCategoryCoupon ? (
        <EditorSection title="Applies to · Categories">
          {categoryOptions.length > 0 ? (
            <CategorySelectGrid
              options={categoryOptions}
              selected={selectedCategories}
              disabled={disabled}
              onToggle={toggleAllowedCategory}
            />
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">No categories in catalogue yet.</p>
          )}
        </EditorSection>
      ) : null}

      {isProductCoupon ? (
        <EditorSection title="Applies to · Products">
          {productOptions.length > 0 ? (
            <ProductSelectList
              allProducts={productOptions}
              filteredProducts={filteredProducts}
              selectedIds={selectedProductIds}
              query={productQuery}
              disabled={disabled}
              onQueryChange={setProductQuery}
              onToggle={toggleAllowedProduct}
            />
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">No products in catalogue yet.</p>
          )}
        </EditorSection>
      ) : null}

      {isCoupon ? <EditorSection title="Usage limits">{couponCommonFields}</EditorSection> : null}

      {orderConditionFields ? (
        <EditorSection title="Order conditions">{orderConditionFields}</EditorSection>
      ) : null}
    </div>
  );
}

export default function CheckoutRulesSection({
  category,
  rules,
  onChange,
  disabled = false,
  presetFilter,
  ruleFilter,
  categoryOptions = [],
  productOptions = [],
}: CheckoutRulesSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<CheckoutRule | null>(null);
  const [isNewRule, setIsNewRule] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CheckoutRule | null>(null);

  const sectionRules = useMemo(
    () =>
      rules
        .filter((rule) => rule.category === category && (ruleFilter ? ruleFilter(rule) : true))
        .sort((a, b) => a.order - b.order),
    [rules, category, ruleFilter]
  );

  const presets = useMemo(() => {
    const base = CHECKOUT_RULE_PRESETS.filter((preset) => preset.category === category);
    return presetFilter ? base.filter(presetFilter) : base;
  }, [category, presetFilter]);

  const patchRule = (id: string, patch: Partial<CheckoutRule>) => {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const openEditor = (rule: CheckoutRule, isNew = false) => {
    setEditorDraft({ ...rule });
    setIsNewRule(isNew);
  };

  const closeEditor = () => {
    setEditorDraft(null);
    setIsNewRule(false);
  };

  const handlePickPreset = (preset: CheckoutRulePreset) => {
    const newRule = createRuleFromPreset(preset);
    setPickerOpen(false);
    openEditor(newRule, true);
  };

  const saveEditor = () => {
    if (!editorDraft) return;
    if (isNewRule) {
      onChange([...rules, editorDraft]);
    } else {
      onChange(rules.map((rule) => (rule.id === editorDraft.id ? editorDraft : rule)));
    }
    closeEditor();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onChange(rules.filter((rule) => rule.id !== deleteTarget.id));
    if (editorDraft?.id === deleteTarget.id) closeEditor();
    setDeleteTarget(null);
  };

  const editorIsCoupon = editorDraft ? isCouponRuleType(editorDraft.type) : false;
  const editorCouponInvalid =
    Boolean(editorIsCoupon) && !String(editorDraft?.code ?? '').trim();
  const editorCategoryCouponInvalid =
    Boolean(editorDraft && isCategoryCouponRuleType(editorDraft.type)) &&
    !(editorDraft?.allowedCategories?.length ?? 0);
  const editorProductCouponInvalid =
    Boolean(editorDraft && isProductCouponRuleType(editorDraft.type)) &&
    !(editorDraft?.allowedProductIds?.length ?? 0);
  const editorSaveDisabled =
    disabled ||
    editorCouponInvalid ||
    editorCategoryCouponInvalid ||
    editorProductCouponInvalid;

  return (
    <>
      <div className="space-y-2">
        {sectionRules.map((rule) => {
          const expired = isCouponRuleType(rule.type) && isCouponRuleExpired(rule);
          const expiryLabel = isCouponRuleType(rule.type) ? formatCouponExpirySummary(rule) : null;
          return (
            <div
              key={rule.id}
              className={`rounded-xl border transition-opacity ${
                rule.enabled && !expired
                  ? 'border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60'
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 opacity-70'
              }`}
            >
              <div className="flex items-center gap-2 p-3 sm:p-3.5">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => openEditor(rule)}
                  className="flex flex-1 items-center gap-2 min-w-0 text-left rounded-lg -m-1 p-1 hover:bg-gray-100/80 dark:hover:bg-gray-800/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {rule.label}
                      </div>
                      {expired ? (
                        <span className="flex-shrink-0 rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          Expired
                        </span>
                      ) : expiryLabel && expiryLabel.startsWith('Ends') ? (
                        <span className="flex-shrink-0 rounded-full bg-gray-200/80 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                          {expiryLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">
                      {summarizeCheckoutRule(rule)}
                    </div>
                  </div>
                  <FiChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden />
                </button>
                <ToggleSwitch
                  checked={rule.enabled}
                  onChange={(enabled) => patchRule(rule.id, { enabled })}
                  disabled={disabled || expired}
                />
                <button
                  type="button"
                  onClick={() => setDeleteTarget(rule)}
                  disabled={disabled}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex-shrink-0"
                  aria-label={`Delete ${rule.label}`}
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={disabled || presets.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiPlus className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      {pickerOpen ? (
        <StoreModal
          title="Add rule"
          description="Pick a rule type to configure."
          onClose={() => setPickerOpen(false)}
        >
          <RulePresetPicker presets={presets} disabled={disabled} onPick={handlePickPreset} />
        </StoreModal>
      ) : null}

      {editorDraft ? (
        <StoreModal
          title={isNewRule ? 'Configure new rule' : 'Edit rule'}
          description={describeCheckoutRule(editorDraft)}
          onClose={closeEditor}
          wide
          footer={
            <>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditor}
                disabled={editorSaveDisabled}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isNewRule ? 'Add rule' : 'Save changes'}
              </button>
            </>
          }
        >
          <RuleEditorForm
            rule={editorDraft}
            disabled={disabled}
            categoryOptions={categoryOptions}
            productOptions={productOptions}
            onChange={(patch) => setEditorDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        </StoreModal>
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete rule?"
        description={
          deleteTarget
            ? `"${deleteTarget.label}" will be removed from checkout. This takes effect after you save checkout settings.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Keep rule"
        variant="danger"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
