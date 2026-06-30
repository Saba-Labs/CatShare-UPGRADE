import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronRight, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import ToggleSwitch from './ToggleSwitch';
import ConfirmDialog from './ConfirmDialog';
import {
  CHECKOUT_RULE_PRESETS,
  createRuleFromPreset,
  describeCheckoutRule,
  summarizeCheckoutRule,
  type CheckoutApplyBase,
  type CheckoutPaymentMethod,
  type CheckoutRule,
  type CheckoutRuleCategory,
  type CheckoutRulePreset,
} from '../../../types/checkoutSettings';
import { STORE_FIELD_CLASS, STORE_SECTION_TITLE } from '../storeTypography';

interface CheckoutRulesSectionProps {
  category: CheckoutRuleCategory;
  rules: CheckoutRule[];
  onChange: (rules: CheckoutRule[]) => void;
  disabled?: boolean;
  presetFilter?: (preset: CheckoutRulePreset) => boolean;
  ruleFilter?: (rule: CheckoutRule) => boolean;
  emptyHint?: string;
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
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
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
        className="relative z-10 w-full max-w-lg flex flex-col min-h-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)]"
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
}: {
  rule: CheckoutRule;
  onChange: (patch: Partial<CheckoutRule>) => void;
  disabled?: boolean;
}) {
  const isCoupon = rule.type.startsWith('coupon_');
  const isFreeShipping = rule.type === 'free_shipping_above';
  const isCod = rule.type === 'cod_charge';
  const isPercent = rule.amountKind === 'percent' && !isFreeShipping;
  const showApplyBase =
    rule.category === 'tax' || rule.category === 'discount' || rule.type === 'custom';
  const showPaymentMethod = rule.type === 'cod_charge' || rule.type === 'custom';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Rule name
        </label>
        <input
          type="text"
          value={rule.label}
          disabled={disabled}
          onChange={(e) => onChange({ label: e.target.value })}
          className={STORE_FIELD_CLASS}
        />
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed -mt-1">
        {describeCheckoutRule(rule)}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!isFreeShipping ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              {isPercent
                ? rule.category === 'discount'
                  ? 'Discount rate (%)'
                  : rule.category === 'tax'
                    ? 'Tax rate (%)'
                    : 'Rate (%)'
                : isCod
                  ? 'COD fee (₹)'
                  : rule.category === 'shipping'
                    ? 'Charge (₹)'
                    : 'Amount (₹)'}
            </label>
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

        {isFreeShipping ? (
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Free shipping when order reaches (₹)
            </label>
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

        {isCoupon ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Coupon code *
            </label>
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

        {!isFreeShipping ? (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Minimum order (₹)
              </label>
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
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Maximum order (₹)
              </label>
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
          </>
        ) : null}

        {isPercent ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              {rule.category === 'discount' ? 'Max discount cap (₹)' : 'Max charge cap (₹)'}
            </label>
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Calculate on
            </label>
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Payment method
            </label>
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
  emptyHint = 'Add a rule to configure this section.',
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

  const editorIsCoupon = editorDraft?.type.startsWith('coupon_');
  const editorCouponInvalid =
    Boolean(editorIsCoupon) && !String(editorDraft?.code ?? '').trim();

  return (
    <>
      <div className="space-y-2">
        {sectionRules.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-5 text-center">
            {emptyHint}
          </p>
        ) : (
          sectionRules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-xl border transition-opacity ${
                rule.enabled
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
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {rule.label}
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
                  disabled={disabled}
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
          ))
        )}

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
          description="Choose the type of rule to configure."
          onClose={() => setPickerOpen(false)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={`${preset.type}-${preset.label}`}
                type="button"
                onClick={() => handlePickPreset(preset)}
                disabled={disabled}
                className="rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {preset.label}
                </span>
                {preset.hint ? (
                  <span className="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {preset.hint}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </StoreModal>
      ) : null}

      {editorDraft ? (
        <StoreModal
          title={isNewRule ? 'Configure new rule' : 'Edit rule'}
          description={describeCheckoutRule(editorDraft)}
          onClose={closeEditor}
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
                disabled={disabled || editorCouponInvalid}
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
