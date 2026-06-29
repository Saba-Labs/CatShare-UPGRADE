import { STORE_FIELD_CLASS } from '../storeTypography';

interface MinimumOrderValueFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  /** Shown below the input — use to explain cross-page sync. */
  linkedNote?: string;
}

export default function MinimumOrderValueField({
  value,
  onChange,
  disabled,
  error,
  linkedNote = 'Leave at 0 for no minimum. This value is shared with the other store admin page that edits it.',
}: MinimumOrderValueFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
        Minimum Order Value
      </label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        disabled={disabled}
        className={`${STORE_FIELD_CLASS} ${
          error ? 'border-red-300 bg-red-50 text-gray-900 dark:bg-red-950/30' : ''
        }`}
      />
      {error ? (
        <p className="text-red-600 text-sm mt-2">{error}</p>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{linkedNote}</p>
      )}
    </div>
  );
}
