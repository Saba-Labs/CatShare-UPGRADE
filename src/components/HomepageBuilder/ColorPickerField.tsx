import { useId } from 'react';
import { FiDroplet } from 'react-icons/fi';

function normalizeHex(raw: string, fallback: string): string {
  const v = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const h = v.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return fallback;
}

function isCssColor(value: string): boolean {
  const v = value.trim();
  return /^#[0-9a-fA-F]{3,8}$/i.test(v) || /^rgba?\(/i.test(v) || /^hsla?\(/i.test(v);
}

interface ColorPickerFieldProps {
  label?: string;
  value: string;
  defaultValue?: string;
  onChange: (color: string) => void;
  /** Allow rgba / hsl in the text field (footer card backgrounds, etc.) */
  allowCssColor?: boolean;
  /** Tighter layout for theme grids */
  compact?: boolean;
}

export default function ColorPickerField({
  label,
  value,
  defaultValue = '#ffffff',
  onChange,
  allowCssColor = false,
  compact = false,
}: ColorPickerFieldProps) {
  const inputId = useId();
  const raw = (value || '').trim();
  const pickerHex = normalizeHex(raw, defaultValue);
  const textValue = allowCssColor && raw && isCssColor(raw) ? raw : pickerHex;
  const swatchColor = allowCssColor && raw && isCssColor(raw) ? raw : pickerHex;

  return (
    <div className={`color-picker-field${compact ? ' color-picker-field--compact' : ''}`}>
      {label && !compact ? <span className="panel-label color-picker-field__label">{label}</span> : null}
      <div className="color-picker-field__row">
        <label
          className="color-picker-swatch"
          htmlFor={inputId}
          title={label ? `${label}: ${textValue}` : textValue}
          style={{ ['--swatch-color' as string]: swatchColor }}
        >
          <span className="color-picker-swatch__checker" aria-hidden />
          <span className="color-picker-swatch__fill" style={{ background: swatchColor }} aria-hidden />
          <FiDroplet className="color-picker-swatch__icon" aria-hidden />
          <input
            id={inputId}
            type="color"
            className="color-picker-native-in-swatch"
            value={pickerHex}
            onChange={(e) => onChange(normalizeHex(e.target.value, defaultValue))}
            aria-label={label ? `Choose ${label}` : 'Choose color'}
          />
        </label>
        <input
          type="text"
          className="panel-input color-picker-hex"
          value={textValue}
          onChange={(e) => {
            const next = e.target.value.trim();
            if (allowCssColor && isCssColor(next)) {
              onChange(next);
              return;
            }
            onChange(normalizeHex(next, defaultValue));
          }}
          spellCheck={false}
          maxLength={allowCssColor ? 32 : 7}
          placeholder={allowCssColor ? '#hex or rgba(...)' : '#000000'}
          aria-label={label ? `${label} color` : 'Color value'}
        />
      </div>
      {label && compact ? <span className="color-picker-field__compact-label">{label}</span> : null}
    </div>
  );
}
