import React, { useCallback, useState } from 'react';
import { sanitizeDecimalPriceInput } from '../utils/offerPriceUtils';
import {
  coerceEditorQuantitySlabs,
  type QuantityPriceSlab,
} from '../utils/quantityPricingUtils';
import { InfoTooltip } from './InfoTooltip';

type Props = {
  value: QuantityPriceSlab[] | undefined;
  onChange: (slabs: QuantityPriceSlab[]) => void;
  theme?: 'classic' | 'glass';
};

function priceDraftFor(slab: QuantityPriceSlab): string {
  if (slab.price > 0) return String(slab.price);
  return '';
}

export default function QuantitySlabEditor({ value, onChange, theme = 'classic' }: Props) {
  const [slabs, setSlabs] = useState<QuantityPriceSlab[]>(() => coerceEditorQuantitySlabs(value));
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>(() => {
    const initial = coerceEditorQuantitySlabs(value);
    const drafts: Record<number, string> = {};
    initial.forEach((slab, i) => {
      drafts[i] = priceDraftFor(slab);
    });
    return drafts;
  });

  const emit = useCallback(
    (next: QuantityPriceSlab[]) => {
      setSlabs(next);
      onChange(next);
    },
    [onChange]
  );

  const inputClass =
    theme === 'glass'
      ? 'border border-gray-300/80 dark:border-gray-600/80 p-2 rounded text-xs bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm'
      : 'border border-gray-300 dark:border-gray-700 p-2 rounded text-xs bg-white dark:bg-gray-800';

  const updateSlab = (index: number, patch: Partial<QuantityPriceSlab>) => {
    const next = slabs.map((s, i) => (i === index ? { ...s, ...patch } : s));
    emit(next);
  };

  const addSlab = () => {
    const last = slabs[slabs.length - 1];
    const minQty = last ? (last.maxQty ?? last.minQty) + 1 : 1;
    const next = [...slabs, { minQty, price: 0 }];
    setPriceDrafts((prev) => ({ ...prev, [next.length - 1]: '' }));
    emit(next);
  };

  const removeSlab = (index: number) => {
    const next = slabs.filter((_, i) => i !== index);
    setPriceDrafts((prev) => {
      const rebuilt: Record<number, string> = {};
      next.forEach((slab, i) => {
        rebuilt[i] = prev[i < index ? i : i + 1] ?? priceDraftFor(slab);
      });
      return rebuilt;
    });
    emit(next);
  };

  return (
    <div className="space-y-2">
      {slabs.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <span>Min qty</span>
            <span>Max qty</span>
            <span>Unit price</span>
            <span />
          </div>
          {slabs.map((slab, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
              <input
                type="text"
                inputMode="numeric"
                value={slab.minQty > 0 ? String(slab.minQty) : ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  updateSlab(index, { minQty: digits ? parseInt(digits, 10) : 1 });
                }}
                className={inputClass}
                aria-label={`Slab ${index + 1} minimum quantity`}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="∞"
                value={slab.maxQty != null ? String(slab.maxQty) : ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  updateSlab(index, { maxQty: digits ? parseInt(digits, 10) : undefined });
                }}
                className={inputClass}
                aria-label={`Slab ${index + 1} maximum quantity`}
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={priceDrafts[index] ?? ''}
                onChange={(e) => {
                  const cleaned = sanitizeDecimalPriceInput(e.target.value);
                  setPriceDrafts((prev) => ({ ...prev, [index]: cleaned }));
                  updateSlab(index, {
                    price: cleaned ? parseFloat(cleaned) : 0,
                  });
                }}
                className={inputClass}
                aria-label={`Slab ${index + 1} unit price`}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => removeSlab(index)}
                className="text-red-500 hover:text-red-600 text-xs px-1"
                aria-label={`Remove slab ${index + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={addSlab}
        className="h-24 w-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-green-400 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-xs font-semibold text-gray-600 dark:text-gray-400"
      >
        <div className="flex flex-col items-center gap-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add slab</span>
        </div>
      </button>
    </div>
  );
}
