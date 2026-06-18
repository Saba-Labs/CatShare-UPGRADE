import type { ShippingAddress } from '../../../integrations/core/types';
import { STORE_FIELD_CLASS } from '../storeTypography';

interface ShippingAddressFieldsProps {
  value: ShippingAddress;
  onChange: (next: ShippingAddress) => void;
  disabled?: boolean;
  idPrefix: string;
}

export default function ShippingAddressFields({
  value,
  onChange,
  disabled = false,
  idPrefix,
}: ShippingAddressFieldsProps) {
  const update = (key: keyof ShippingAddress, next: string) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label htmlFor={`${idPrefix}-contact`} className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Contact Name
        </label>
        <input
          id={`${idPrefix}-contact`}
          type="text"
          value={value.contactName}
          onChange={(e) => update('contactName', e.target.value)}
          disabled={disabled}
          className={STORE_FIELD_CLASS}
          placeholder="Warehouse manager"
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-phone`} className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Phone
        </label>
        <input
          id={`${idPrefix}-phone`}
          type="tel"
          value={value.phone}
          onChange={(e) => update('phone', e.target.value)}
          disabled={disabled}
          className={STORE_FIELD_CLASS}
          placeholder="+91 98765 43210"
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-line1`} className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Address Line 1
        </label>
        <input
          id={`${idPrefix}-line1`}
          type="text"
          value={value.line1}
          onChange={(e) => update('line1', e.target.value)}
          disabled={disabled}
          className={STORE_FIELD_CLASS}
          placeholder="Building, street"
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-line2`} className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Address Line 2
        </label>
        <input
          id={`${idPrefix}-line2`}
          type="text"
          value={value.line2}
          onChange={(e) => update('line2', e.target.value)}
          disabled={disabled}
          className={STORE_FIELD_CLASS}
          placeholder="Area, landmark (optional)"
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-city`} className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          City
        </label>
        <input
          id={`${idPrefix}-city`}
          type="text"
          value={value.city}
          onChange={(e) => update('city', e.target.value)}
          disabled={disabled}
          className={STORE_FIELD_CLASS}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-state`} className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          State
        </label>
        <input
          id={`${idPrefix}-state`}
          type="text"
          value={value.state}
          onChange={(e) => update('state', e.target.value)}
          disabled={disabled}
          className={STORE_FIELD_CLASS}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-pincode`} className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Pincode
        </label>
        <input
          id={`${idPrefix}-pincode`}
          type="text"
          inputMode="numeric"
          value={value.pincode}
          onChange={(e) => update('pincode', e.target.value)}
          disabled={disabled}
          className={STORE_FIELD_CLASS}
          placeholder="110001"
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-country`} className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Country
        </label>
        <input
          id={`${idPrefix}-country`}
          type="text"
          value={value.country}
          onChange={(e) => update('country', e.target.value)}
          disabled={disabled}
          className={STORE_FIELD_CLASS}
        />
      </div>
    </div>
  );
}
