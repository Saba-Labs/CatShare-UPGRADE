import {
  createManualAdjustment,
  parseManualAdjustmentAmount,
  type ManualOrderAdjustment,
  type ManualOrderAdjustmentAmountKind,
} from '../utils/manualOrderAdjustments';
import './manual-order-adjustments.css';

type Props = {
  adjustments: ManualOrderAdjustment[];
  onChange: (next: ManualOrderAdjustment[]) => void;
};

function updateAdjustment(
  rows: ManualOrderAdjustment[],
  id: string,
  patch: Partial<ManualOrderAdjustment>
): ManualOrderAdjustment[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export default function ManualOrderAdjustmentsEditor({
  adjustments,
  onChange,
}: Props) {
  const addAdjustment = (
    kind: 'discount' | 'charge',
    amountKind: ManualOrderAdjustmentAmountKind
  ) => {
    onChange([...adjustments, createManualAdjustment(kind, 0, amountKind)]);
  };

  return (
    <div className="moa-card">
      <div className="moa-toolbar">
        <span className="moa-title">Adjustments</span>
        <div className="moa-toolbar__actions">
          <select
            className="moa-add moa-add--discount"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                addAdjustment('discount', e.target.value as ManualOrderAdjustmentAmountKind);
                e.target.value = '';
              }
            }}
            aria-label="Add discount"
          >
            <option value="" disabled>+ Discount</option>
            <option value="flat">Fixed discount</option>
            <option value="percent">Percentage discount</option>
          </select>
          <select
            className="moa-add moa-add--charge"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                addAdjustment('charge', e.target.value as ManualOrderAdjustmentAmountKind);
                e.target.value = '';
              }
            }}
            aria-label="Add charge"
          >
            <option value="" disabled>+ Charge</option>
            <option value="flat">Fixed charge</option>
            <option value="percent">Percentage charge</option>
          </select>
        </div>
      </div>

      {adjustments.length > 0 ? (
        <div className="moa-list">
          {adjustments.map((row) => {
            const isCharge = row.kind === 'charge';

            return (
              <div
                key={row.id}
                className={`moa-row${isCharge ? ' moa-row--charge' : ' moa-row--discount'}`}
              >
                <input
                  type="text"
                  className="moa-input"
                  value={row.label}
                  onChange={(e) => onChange(updateAdjustment(adjustments, row.id, { label: e.target.value }))}
                  placeholder={isCharge ? 'Charge label' : 'Discount label'}
                  aria-label={isCharge ? 'Charge label' : 'Discount label'}
                />

                <select
                  className="moa-type-select"
                  value={row.amountKind}
                  onChange={(e) =>
                    onChange(
                      updateAdjustment(adjustments, row.id, {
                        amountKind: e.target.value as ManualOrderAdjustmentAmountKind,
                      })
                    )
                  }
                  aria-label="Adjustment type"
                >
                  <option value="flat">Fixed</option>
                  <option value="percent">Percent</option>
                </select>

                <div className="moa-amount-wrap">
                  <span className="moa-amount-sign" aria-hidden>
                    {isCharge ? '+' : '−'}
                  </span>
                  <span className="moa-amount-prefix" aria-hidden>
                    {row.amountKind === 'percent' ? '%' : '₹'}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="moa-amount-input"
                    value={row.amount > 0 ? String(row.amount) : ''}
                    onChange={(e) =>
                      onChange(
                        updateAdjustment(adjustments, row.id, {
                          amount: parseManualAdjustmentAmount(e.target.value),
                        })
                      )
                    }
                    placeholder="0"
                    aria-label={row.amountKind === 'percent' ? 'Adjustment percentage' : 'Adjustment amount'}
                  />
                </div>

                <button
                  type="button"
                  className="moa-remove"
                  onClick={() => onChange(adjustments.filter((item) => item.id !== row.id))}
                  aria-label="Remove adjustment"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
