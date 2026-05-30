import { useId, useRef } from 'react';
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

interface ColorPickerFieldProps {
  label?: string;
  value: string;
  defaultValue?: string;
  onChange: (hex: string) => void;
  /** Tighter layout for theme grids */
  compact?: boolean;
}

export default function ColorPickerField({
  label,
  value,
  defaultValue = '#ffffff',
  onChange,
  compact = false,
}: ColorPickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hex = normalizeHex(value || defaultValue, defaultValue);

  const openPicker = () => inputRef.current?.click();

  return (
    <div className={`color-picker-field${compact ? ' color-picker-field--compact' : ''}`}>
      {label && !compact ? <span className="panel-label color-picker-field__label">{label}</span> : null}
      <div className="color-picker-field__row">
        <button
          type="button"
          className="color-picker-swatch"
          onClick={openPicker}
          title={label ? `${label}: ${hex}` : hex}
          aria-label={label ? `Choose ${label}` : 'Choose color'}
          style={{ ['--swatch-color' as string]: hex }}
        >
          <span className="color-picker-swatch__checker" aria-hidden />
          <span className="color-picker-swatch__fill" style={{ background: hex }} aria-hidden />
          <FiDroplet className="color-picker-swatch__icon" aria-hidden />
        </button>
        <input
          ref={inputRef}
          id={inputId}
          type="color"
          className="color-picker-native"
          value={hex}
          onChange={(e) => onChange(normalizeHex(e.target.value, defaultValue))}
          tabIndex={-1}
          aria-hidden
        />
        <input
          type="text"
          className="panel-input color-picker-hex"
          value={hex}
          onChange={(e) => onChange(normalizeHex(e.target.value, defaultValue))}
          spellCheck={false}
          maxLength={7}
          aria-label={label ? `${label} hex` : 'Color hex'}
        />
      </div>
      {label && compact ? <span className="color-picker-field__compact-label">{label}</span> : null}
    </div>
  );
}
