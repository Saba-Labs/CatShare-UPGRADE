import { useMemo, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import ToggleSwitch from './ToggleSwitch';
import {
  CHECKOUT_RULE_PRESETS,
  createRuleFromPreset,
  type CheckoutRule,
  type CheckoutRuleCategory,
  type CheckoutRulePreset,
} from '../../../types/checkoutSettings';

const fieldClassName =
  'w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';

interface CheckoutRulesSectionProps {
  category: CheckoutRuleCategory;
  rules: CheckoutRule[];
  onChange: (rules: CheckoutRule[]) => void;
  disabled?: boolean;
  /** Limit presets shown when adding rules */
  presetFilter?: (preset: CheckoutRulePreset) => boolean;
  emptyHint?: string;
}

export default function CheckoutRulesSection({
  category,
  rules,
  onChange,
  disabled = false,
  presetFilter,
  emptyHint = 'Add a rule to configure this section.',
}: CheckoutRulesSectionProps) {
  const [showPresets, setShowPresets] = useState(false);

  const categoryRules = useMemo(
    () => rules.filter((rule) => rule.category === category).sort((a, b) => a.order - b.order),
    [rules, category]
  );

  const presets = useMemo(() => {
    const base = CHECKOUT_RULE_PRESETS.filter((preset) => preset.category === category);
    return presetFilter ? base.filter(presetFilter) : base;
  }, [category, presetFilter]);

  const patchRule = (id: string, patch: Partial<CheckoutRule>) => {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const removeRule = (id: string) => {
    onChange(rules.filter((rule) => rule.id !== id));
  };

  const addPreset = (preset: CheckoutRulePreset) => {
    onChange([...rules, createRuleFromPreset(preset)]);
    setShowPresets(false);
  };

  return (
    <div className="space-y-3">
      {categoryRules.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-5 text-center">
          {emptyHint}
        </p>
      ) : (
        categoryRules.map((rule) => (
          <div
            key={rule.id}
            className={`rounded-xl border p-4 transition-opacity ${
              rule.enabled
                ? 'border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60'
                : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <input
                type="text"
                value={rule.label}
                disabled={disabled}
                onChange={(e) => patchRule(rule.id, { label: e.target.value })}
                className={`${fieldClassName} font-semibold`}
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                <ToggleSwitch
                  checked={rule.enabled}
                  onChange={(enabled) => patchRule(rule.id, { enabled })}
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  disabled={disabled}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  aria-label={`Remove ${rule.label}`}
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {rule.amountKind === 'percent' ? 'Value (%)' : 'Amount (₹)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={rule.amountKind === 'percent' ? 0.1 : 1}
                  value={rule.value}
                  disabled={disabled}
                  onChange={(e) => patchRule(rule.id, { value: Number(e.target.value) || 0 })}
                  className={fieldClassName}
                />
              </div>

              {rule.type.startsWith('coupon_') ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    value={rule.code ?? ''}
                    disabled={disabled}
                    onChange={(e) => patchRule(rule.id, { code: e.target.value.toUpperCase() })}
                    className={fieldClassName}
                    placeholder="SAVE10"
                  />
                </div>
              ) : null}

              {rule.type === 'free_shipping_above' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Free above (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={rule.freeAbove ?? ''}
                    disabled={disabled}
                    onChange={(e) =>
                      patchRule(rule.id, {
                        freeAbove: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className={fieldClassName}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))
      )}

      {showPresets ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Choose a rule type</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={`${preset.type}-${preset.label}`}
                type="button"
                onClick={() => addPreset(preset)}
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
          <button
            type="button"
            onClick={() => setShowPresets(false)}
            className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPresets(true)}
          disabled={disabled || presets.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiPlus className="h-4 w-4" />
          Add Rule
        </button>
      )}
    </div>
  );
}
