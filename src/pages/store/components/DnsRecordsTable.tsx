import { FiCopy } from 'react-icons/fi';
import type { CustomDomainVerificationRecord } from '../../../services/storeCustomDomainApi';

interface DnsRecordsTableProps {
  records: CustomDomainVerificationRecord[];
  onCopyAll?: () => void;
  onCopyValue?: (value: string) => void;
  disabled?: boolean;
}

export function formatDnsRecordsForCopy(records: CustomDomainVerificationRecord[]): string {
  return records
    .map((record) =>
      [`Type: ${record.type}`, `Name: ${record.domain}`, `Value: ${record.value}`].join('\n')
    )
    .join('\n\n');
}

export default function DnsRecordsTable({ records, onCopyAll, onCopyValue, disabled }: DnsRecordsTableProps) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-5 text-center">
        DNS records will appear after you connect a domain.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {onCopyAll ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCopyAll}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <FiCopy className="h-4 w-4" />
            Copy all records
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Name / Host
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Value
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Copy
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {records.map((record, index) => (
              <tr key={`${record.type}-${record.domain}-${index}`}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {record.type}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                  {record.domain}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                  {record.value}
                  {record.reason ? (
                    <p className="mt-1 font-sans text-xs text-amber-700 dark:text-amber-300">
                      {record.reason}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <CopyButton
                    value={record.value}
                    label={`Copy value for ${record.type} ${record.domain}`}
                    disabled={disabled}
                    onCopy={onCopyValue}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CopyButton({
  value,
  label,
  disabled,
  onCopy,
}: {
  value: string;
  label: string;
  disabled?: boolean;
  onCopy?: (value: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        onCopy?.(value);
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
    >
      <FiCopy className="h-4 w-4" />
    </button>
  );
}
