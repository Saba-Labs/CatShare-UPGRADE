import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  CHECKOUT_RULE_PRESETS,
  createRuleFromPreset,
  type CheckoutApplyBase,
  type CheckoutPaymentMethod,
  type CheckoutRule,
  type CheckoutRuleCategory,
  type CheckoutRulePreset,
  type StoreCheckoutSettings,
  DEFAULT_CHECKOUT_SETTINGS,
} from '../types/checkoutSettings';

const CSS = `
  .ck-root {
    font-family: var(--font, 'DM Sans', system-ui, sans-serif);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Global toggles (match Store toggle-card) ── */
  .ck-prefs {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
  }
  .ck-pref {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 12px;
    background: #fff;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: var(--radius-sm, 10px);
    transition: border-color 0.2s, background 0.2s;
  }
  .ck-pref.is-on {
    border-color: var(--green-border, #c3e8d5);
    background: var(--green-bg, #f0faf5);
  }
  .ck-pref-text { min-width: 0; flex: 1; }
  .ck-pref-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #0f172a);
    letter-spacing: -0.1px;
    line-height: 1.3;
  }
  .ck-pref-sub {
    font-size: 11px;
    color: var(--text-secondary, #64748b);
    margin-top: 2px;
    line-height: 1.35;
  }
  .ck-pref.is-on .ck-pref-sub { color: var(--green, #1a7a4a); }

  .ck-switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
  .ck-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .ck-switch .ck-slider {
    position: absolute; inset: 0;
    background: #d6d0ca;
    border-radius: 24px;
    cursor: pointer;
    transition: background 0.22s;
  }
  .ck-switch .ck-slider::before {
    content: '';
    position: absolute;
    width: 18px; height: 18px;
    left: 3px; top: 3px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.16);
    transition: transform 0.22s cubic-bezier(.34,1.56,.64,1);
  }
  .ck-switch input:checked + .ck-slider { background: var(--green-dot, #34c97a); }
  .ck-switch input:checked + .ck-slider::before { transform: translateX(20px); }
  .ck-switch--sm { width: 40px; height: 22px; }
  .ck-switch--sm .ck-slider { border-radius: 22px; }
  .ck-switch--sm .ck-slider::before { width: 16px; height: 16px; }
  .ck-switch--sm input:checked + .ck-slider::before { transform: translateX(18px); }

  /* ── Category blocks ── */
  .ck-section {
    margin-bottom: 12px;
    background: #fff;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: var(--radius-sm, 10px);
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15,23,42,0.04);
  }
  .ck-section--shipping { border-top: 3px solid #3b82f6; }
  .ck-section--tax { border-top: 3px solid #d97706; }
  .ck-section--discount { border-top: 3px solid #16a34a; }

  .ck-section-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
    border-bottom: 1px solid var(--border, #e2e8f0);
  }
  .ck-section-icon {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .ck-section--shipping .ck-section-icon { background: #eff6ff; color: #2563eb; }
  .ck-section--tax .ck-section-icon { background: #fffbeb; color: #d97706; }
  .ck-section--discount .ck-section-icon { background: #f0fdf4; color: #16a34a; }

  .ck-section-meta { flex: 1; min-width: 0; }
  .ck-section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary, #0f172a);
    letter-spacing: -0.15px;
  }
  .ck-section-count {
    font-size: 11px;
    color: var(--text-muted, #94a3b8);
    margin-top: 1px;
  }
  .ck-section-body { padding: 10px 12px 12px; }

  .ck-empty {
    text-align: center;
    padding: 16px 12px;
    border: 1px dashed var(--border, #e2e8f0);
    border-radius: var(--radius-xs, 8px);
    background: #f8fafc;
    margin-bottom: 10px;
  }
  .ck-empty-title { font-size: 12px; font-weight: 600; color: var(--text-secondary, #64748b); }
  .ck-empty-sub { font-size: 11px; color: var(--text-muted, #94a3b8); margin-top: 4px; }

  /* ── Rule card ── */
  .ck-rule {
    background: #f8fafc;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: var(--radius-xs, 8px);
    margin-bottom: 8px;
    overflow: hidden;
    transition: opacity 0.2s, border-color 0.2s;
  }
  .ck-rule:last-child { margin-bottom: 0; }
  .ck-rule.is-off { opacity: 0.62; }
  .ck-rule.is-off .ck-rule-fields { display: none; }

  .ck-rule-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 10px 12px;
    background: #fff;
    border-bottom: 1px solid transparent;
  }
  .ck-rule:not(.is-off) .ck-rule-head { border-bottom-color: var(--border, #e2e8f0); }

  .ck-rule-name {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #0f172a);
    font-family: inherit;
    letter-spacing: -0.1px;
    padding: 2px 0;
    outline: none;
  }
  .ck-rule-name:focus {
    box-shadow: 0 1px 0 var(--accent, #2563eb);
  }
  .ck-rule-type {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted, #94a3b8);
    padding: 2px 6px;
    border-radius: 4px;
    background: #f1f5f9;
    flex-shrink: 0;
    max-width: 88px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ck-rule-del {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-muted, #94a3b8);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .ck-rule-del:hover { background: var(--red-bg, #fdf4f3); color: var(--red, #c0392b); }

  .ck-rule-fields {
    padding: 10px 12px 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 12px;
  }
  @media (max-width: 400px) { .ck-rule-fields { grid-template-columns: 1fr; } }

  .ck-field { display: flex; flex-direction: column; gap: 4px; }
  .ck-field label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.45px;
    text-transform: uppercase;
    color: var(--text-muted, #94a3b8);
  }
  .ck-field input,
  .ck-field select {
    width: 100%;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    padding: 7px 0 8px;
    border: none;
    border-bottom: 1px solid var(--border, #e2e8f0);
    border-radius: 0;
    background: transparent;
    color: var(--text-primary, #0f172a);
    outline: none;
    transition: border-color 0.18s;
  }
  .ck-field input:focus,
  .ck-field select:focus { border-bottom-color: var(--accent, #2563eb); }
  .ck-field select { cursor: pointer; }

  /* ── Add rule / presets ── */
  .ck-add-wrap { margin-top: 10px; }
  .ck-add-primary {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 12px;
    border-radius: var(--radius-xs, 8px);
    border: 1px dashed #cbd5e1;
    background: #fff;
    color: var(--accent, #2563eb);
    font-size: 12.5px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .ck-add-primary:hover { border-color: var(--accent, #2563eb); background: #eff6ff; }

  .ck-preset-panel {
    margin-top: 8px;
    padding: 10px;
    background: #f8fafc;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: var(--radius-xs, 8px);
    animation: ck-fade-in 0.18s ease;
  }
  @keyframes ck-fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .ck-preset-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-muted, #94a3b8);
    margin-bottom: 8px;
  }
  .ck-preset-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  @media (max-width: 360px) { .ck-preset-grid { grid-template-columns: 1fr; } }
  .ck-preset-chip {
    text-align: left;
    padding: 9px 10px;
    border-radius: 8px;
    border: 1px solid var(--border, #e2e8f0);
    background: #fff;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: inherit;
  }
  .ck-preset-chip:hover {
    border-color: var(--accent, #2563eb);
    box-shadow: 0 2px 8px rgba(37,99,235,0.08);
  }
  .ck-preset-chip-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary, #0f172a);
    line-height: 1.25;
  }
  .ck-preset-chip-hint {
    font-size: 10px;
    color: var(--text-muted, #94a3b8);
    margin-top: 3px;
    line-height: 1.3;
  }
  .ck-preset-cancel {
    margin-top: 8px;
    width: 100%;
    padding: 7px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #64748b);
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .ck-preset-cancel:hover { color: var(--text-primary, #0f172a); }

  /* ── Save ── */
  .ck-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--border, #e2e8f0);
  }
  .ck-save {
    height: 36px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid #1e293b;
    background: #0f172a;
    color: #fff;
    font-size: 12.5px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.12s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .ck-save:hover:not(:disabled) { opacity: 0.94; }
  .ck-save:active:not(:disabled) { transform: translateY(1px); }
  .ck-save:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const CATEGORY_META: Record<
  CheckoutRuleCategory,
  { label: string; subtitle: string; icon: ReactNode }
> = {
  shipping: {
    label: 'Shipping & handling',
    subtitle: 'Delivery, packing, COD & free shipping',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="1" y="3" width="15" height="13" rx="1" />
        <path d="M16 8h4l3 5v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  tax: {
    label: 'Taxes',
    subtitle: 'GST, VAT & other tax rules',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
  },
  discount: {
    label: 'Discounts & coupons',
    subtitle: 'Auto discounts & coupon codes',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
};

function presetsForCategory(category: CheckoutRuleCategory): CheckoutRulePreset[] {
  return CHECKOUT_RULE_PRESETS.filter((p) => p.category === category);
}

function updateRule(rules: CheckoutRule[], id: string, patch: Partial<CheckoutRule>): CheckoutRule[] {
  return rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

function SwitchToggle({
  checked,
  onChange,
  label,
  sub,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
}) {
  return (
    <div className={`ck-pref${checked ? ' is-on' : ''}`}>
      <div className="ck-pref-text">
        <div className="ck-pref-title">{label}</div>
        {sub ? <div className="ck-pref-sub">{sub}</div> : null}
      </div>
      <label className="ck-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="ck-slider" />
      </label>
    </div>
  );
}

function RuleEditor({
  rule,
  onChange,
  onRemove,
}: {
  rule: CheckoutRule;
  onChange: (patch: Partial<CheckoutRule>) => void;
  onRemove: () => void;
}) {
  const isFreeShipping = rule.type === 'free_shipping_above';
  const isCoupon = rule.type.startsWith('coupon_');
  const showValue = !isFreeShipping;
  const showPercent = rule.amountKind === 'percent' && showValue;
  const typeLabel = rule.type === 'custom' ? 'Custom' : rule.label.split(' ')[0];

  return (
    <div className={`ck-rule${rule.enabled ? '' : ' is-off'}`}>
      <div className="ck-rule-head">
        <label className="ck-switch ck-switch--sm">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            aria-label={`Enable ${rule.label}`}
          />
          <span className="ck-slider" />
        </label>
        <input
          className="ck-rule-name"
          value={rule.label}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-label="Rule name"
        />
        <span className="ck-rule-type" title={rule.type}>{typeLabel}</span>
        <button type="button" className="ck-rule-del" onClick={onRemove} aria-label="Remove rule">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        </button>
      </div>
      <div className="ck-rule-fields">
        {isFreeShipping ? (
          <div className="ck-field">
            <label>Free above (order value)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={rule.freeAbove ?? ''}
              onChange={(e) => onChange({ freeAbove: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="e.g. 999"
            />
          </div>
        ) : null}
        {showValue ? (
          <div className="ck-field">
            <label>{showPercent ? 'Rate (%)' : 'Amount'}</label>
            <input
              type="number"
              min={0}
              step={showPercent ? 0.1 : 0.01}
              value={rule.value}
              onChange={(e) => onChange({ value: Number(e.target.value) || 0 })}
            />
          </div>
        ) : null}
        {isCoupon ? (
          <div className="ck-field">
            <label>Coupon code</label>
            <input
              type="text"
              value={rule.code ?? ''}
              onChange={(e) => onChange({ code: e.target.value.toUpperCase() })}
              placeholder="SAVE10"
            />
          </div>
        ) : null}
        {rule.category === 'discount' && rule.amountKind === 'percent' ? (
          <div className="ck-field">
            <label>Max discount cap</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={rule.maxAmount ?? ''}
              onChange={(e) => onChange({ maxAmount: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="Optional"
            />
          </div>
        ) : null}
        <div className="ck-field">
          <label>Min order (optional)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={rule.minSubtotal ?? ''}
            onChange={(e) => onChange({ minSubtotal: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder="No minimum"
          />
        </div>
        {rule.type === 'custom' || rule.category === 'tax' ? (
          <div className="ck-field">
            <label>Calculate on</label>
            <select
              value={rule.applyBase}
              onChange={(e) => onChange({ applyBase: e.target.value as CheckoutApplyBase })}
            >
              <option value="subtotal">Subtotal</option>
              <option value="after_discount">After discount</option>
              <option value="after_shipping">After shipping</option>
            </select>
          </div>
        ) : null}
        {rule.type === 'custom' || rule.type === 'cod_charge' ? (
          <div className="ck-field">
            <label>Payment method</label>
            <select
              value={rule.paymentMethod}
              onChange={(e) => onChange({ paymentMethod: e.target.value as CheckoutPaymentMethod })}
            >
              <option value="any">Any</option>
              <option value="prepaid">Prepaid only</option>
              <option value="cod">COD only</option>
            </select>
          </div>
        ) : null}
        {rule.type === 'custom' ? (
          <>
            <div className="ck-field">
              <label>Amount type</label>
              <select
                value={rule.amountKind}
                onChange={(e) => onChange({ amountKind: e.target.value as 'flat' | 'percent' })}
              >
                <option value="flat">Flat amount</option>
                <option value="percent">Percent</option>
              </select>
            </div>
            <div className="ck-field">
              <label>Rule category</label>
              <select
                value={rule.category}
                onChange={(e) => onChange({ category: e.target.value as CheckoutRuleCategory })}
              >
                <option value="shipping">Shipping</option>
                <option value="tax">Tax</option>
                <option value="discount">Discount</option>
              </select>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export interface StoreCheckoutSettingsEditorProps {
  value: StoreCheckoutSettings;
  onChange: (next: StoreCheckoutSettings) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  currencySymbol?: string;
}

export default function StoreCheckoutSettingsEditor({
  value,
  onChange,
  onSave,
  saving = false,
}: StoreCheckoutSettingsEditorProps) {
  const [addMenuOpen, setAddMenuOpen] = useState<CheckoutRuleCategory | null>(null);

  const rulesByCategory = useMemo(() => {
    const groups: Record<CheckoutRuleCategory, CheckoutRule[]> = {
      shipping: [],
      tax: [],
      discount: [],
    };
    for (const r of value.rules) {
      groups[r.category]?.push(r);
    }
    for (const cat of Object.keys(groups) as CheckoutRuleCategory[]) {
      groups[cat].sort((a, b) => a.order - b.order);
    }
    return groups;
  }, [value.rules]);

  const enabledCount = value.rules.filter((r) => r.enabled).length;

  const patchSettings = useCallback(
    (patch: Partial<StoreCheckoutSettings>) => onChange({ ...value, ...patch }),
    [value, onChange]
  );

  const patchRule = useCallback(
    (id: string, patch: Partial<CheckoutRule>) => {
      patchSettings({ rules: updateRule(value.rules, id, patch) });
    },
    [value.rules, patchSettings]
  );

  const removeRule = useCallback(
    (id: string) => patchSettings({ rules: value.rules.filter((r) => r.id !== id) }),
    [value.rules, patchSettings]
  );

  const addPreset = (preset: CheckoutRulePreset) => {
    const rule = createRuleFromPreset(preset);
    patchSettings({ rules: [...value.rules, rule] });
    setAddMenuOpen(null);
  };

  return (
    <div className="ck-root">
      <style>{CSS}</style>

      <div className="ck-prefs">
        <SwitchToggle
          checked={value.showBreakdown}
          onChange={(v) => patchSettings({ showBreakdown: v })}
          label="Show price breakdown"
          sub="Customers see shipping, tax & discount lines at checkout"
        />
        <SwitchToggle
          checked={value.allowCouponEntry}
          onChange={(v) => patchSettings({ allowCouponEntry: v })}
          label="Coupon codes"
          sub="Let customers enter a code during checkout"
        />
        <SwitchToggle
          checked={value.enableCod}
          onChange={(v) => patchSettings({ enableCod: v })}
          label="Cash on delivery"
          sub="Offer COD as a payment option on your store"
        />
      </div>

      {(['shipping', 'tax', 'discount'] as CheckoutRuleCategory[]).map((category) => {
        const meta = CATEGORY_META[category];
        const rules = rulesByCategory[category];
        const activeInSection = rules.filter((r) => r.enabled).length;

        return (
          <div key={category} className={`ck-section ck-section--${category}`}>
            <div className="ck-section-head">
              <div className="ck-section-icon">{meta.icon}</div>
              <div className="ck-section-meta">
                <div className="ck-section-title">{meta.label}</div>
                <div className="ck-section-count">
                  {rules.length === 0
                    ? meta.subtitle
                    : `${activeInSection} active · ${rules.length} rule${rules.length === 1 ? '' : 's'}`}
                </div>
              </div>
            </div>

            <div className="ck-section-body">
              {rules.length === 0 ? (
                <div className="ck-empty">
                  <div className="ck-empty-title">No rules yet</div>
                  <div className="ck-empty-sub">Add a preset below to get started</div>
                </div>
              ) : (
                rules.map((rule) => (
                  <RuleEditor
                    key={rule.id}
                    rule={rule}
                    onChange={(patch) => patchRule(rule.id, patch)}
                    onRemove={() => removeRule(rule.id)}
                  />
                ))
              )}

              <div className="ck-add-wrap">
                {addMenuOpen !== category ? (
                  <button type="button" className="ck-add-primary" onClick={() => setAddMenuOpen(category)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add rule
                  </button>
                ) : (
                  <div className="ck-preset-panel">
                    <div className="ck-preset-label">Choose a rule type</div>
                    <div className="ck-preset-grid">
                      {presetsForCategory(category).map((preset) => (
                        <button
                          key={preset.type + preset.label}
                          type="button"
                          className="ck-preset-chip"
                          onClick={() => addPreset(preset)}
                        >
                          <div className="ck-preset-chip-title">{preset.label}</div>
                          {preset.hint ? <div className="ck-preset-chip-hint">{preset.hint}</div> : null}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="ck-preset-cancel" onClick={() => setAddMenuOpen(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div className="ck-actions">
        <button type="button" className="ck-save" disabled={saving} onClick={() => void onSave()}>
          {saving ? (
            'Saving…'
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save checkout settings
              {enabledCount > 0 ? ` (${enabledCount})` : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function emptyCheckoutSettings(): StoreCheckoutSettings {
  return { ...DEFAULT_CHECKOUT_SETTINGS, rules: [] };
}
