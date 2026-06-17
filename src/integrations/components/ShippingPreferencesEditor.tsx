import type { ShippingPreferences, ShippingPreferenceMode } from '../core/types';

export function ShippingPreferencesEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: ShippingPreferences;
  onChange: (next: ShippingPreferences) => void;
  disabled?: boolean;
}) {
  const setMode = (mode: ShippingPreferenceMode) => {
    onChange({ ...value, mode });
  };

  const options: { mode: ShippingPreferenceMode; label: string }[] = [
    { mode: 'actual', label: 'Charge Actual Shipping Cost' },
    { mode: 'free', label: 'Free Shipping' },
    { mode: 'flat', label: 'Flat Shipping' },
  ];

  return (
    <div className="int-card">
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Shipping Preferences
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map((opt) => (
          <label
            key={opt.mode}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <input
              type="radio"
              name="shipping-pref-mode"
              checked={value.mode === opt.mode}
              disabled={disabled}
              onChange={() => setMode(opt.mode)}
            />
            {opt.label}
          </label>
        ))}
      </div>

      {value.mode === 'flat' ? (
        <div style={{ marginTop: 14 }}>
          <label
            style={{ fontSize: 12, color: 'var(--int-muted)', display: 'block', marginBottom: 6 }}
          >
            Flat shipping amount (₹)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            disabled={disabled}
            value={value.flatAmount ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                flatAmount: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--int-border)',
              fontSize: 14,
              fontFamily: 'var(--int-font)',
            }}
          />
        </div>
      ) : null}

      {value.mode === 'free' ? (
        <div style={{ marginTop: 14 }}>
          <label
            style={{ fontSize: 12, color: 'var(--int-muted)', display: 'block', marginBottom: 6 }}
          >
            Free above (₹) — optional
          </label>
          <input
            type="number"
            min={0}
            step={1}
            disabled={disabled}
            placeholder="Leave empty for always free"
            value={value.freeAboveAmount ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                freeAboveAmount:
                  e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--int-border)',
              fontSize: 14,
              fontFamily: 'var(--int-font)',
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
