import { useEffect, useState } from "react";
import { FiClock, FiX } from "react-icons/fi";
import { getPersistedAuthUserId } from "../utils/authUserId";
import {
  readProductHistory,
  type ProductHistoryChange,
  type ProductHistoryEntry,
  areProductHistoryValuesEqual,
} from "../utils/productHistory";

type ProductHistoryModalProps = {
  productId: string;
  productName: string;
  open: boolean;
  onClose: () => void;
};

function humanize(value: string): string {
  return value
    .replace(/\[(.*?)\]/g, " · $1")
    .replace(/[._-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (Array.isArray(value)) {
    if (value.every((item) => item == null || ["string", "number", "boolean"].includes(typeof item))) {
      return value.length ? value.map(String).join(", ") : "None";
    }
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "object") {
    const details = JSON.stringify(value);
    return details.length > 240 ? `${details.slice(0, 237)}…` : details;
  }
  const text = String(value);
  return /^https?:\/\//i.test(text) ? "Image or link updated" : text;
}

function entryTitle(entry: ProductHistoryEntry): string {
  if (entry.source === "created") return "Product created";
  if (entry.source === "variants") return "Variants updated";
  if (entry.source === "bulk") return `Bulk edit · ${entry.affectedProductCount || 1} products`;
  return "Product updated";
}

function ChangeDetails({ changes, omittedChangeCount = 0 }: { changes: ProductHistoryChange[]; omittedChangeCount?: number }) {
  const changedFields = changes.filter((change) => !areProductHistoryValuesEqual(change.before, change.after));
  return (
    <div className="mt-3 space-y-2">
      {changedFields.map((change, index) => (
        <div key={`${change.path}-${index}`} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3">
          <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">{humanize(change.path)}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="min-w-0 rounded bg-red-50 dark:bg-red-950/30 px-2.5 py-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">Before</div>
              <div className="break-words text-gray-700 dark:text-gray-200">{formatValue(change.before)}</div>
            </div>
            <div className="min-w-0 rounded bg-green-50 dark:bg-green-950/30 px-2.5 py-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-300">After</div>
              <div className="break-words text-gray-700 dark:text-gray-200">{formatValue(change.after)}</div>
            </div>
          </div>
        </div>
      ))}
      {omittedChangeCount > 0 && (
        <p className="text-xs text-gray-500">{omittedChangeCount} additional field changes are not shown.</p>
      )}
    </div>
  );
}

export default function ProductHistoryModal({ productId, productName, open, onClose }: ProductHistoryModalProps) {
  const [entries, setEntries] = useState<ProductHistoryEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const userId = getPersistedAuthUserId() || undefined;

  useEffect(() => {
    if (!open) return;
    const refresh = () => setEntries(readProductHistory(userId, productId));
    const handleHistoryChange = (event: Event) => {
      const changedProductId = (event as CustomEvent<{ productId?: string }>).detail?.productId;
      if (!changedProductId || String(changedProductId) === String(productId)) refresh();
    };
    refresh();
    window.addEventListener("product-history-changed", handleHistoryChange);
    return () => window.removeEventListener("product-history-changed", handleHistoryChange);
  }, [open, productId, userId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-history-title"
        className="flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-gray-50 shadow-2xl dark:bg-gray-900 sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"><FiClock /></span>
            <div className="min-w-0">
              <h2 id="product-history-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">History</h2>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{productName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close history" className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"><FiX size={18} /></button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-5">
          {entries.length === 0 ? (
            <div className="py-12 text-center">
              <FiClock className="mx-auto mb-3 text-gray-400" size={24} />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No changes recorded yet</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Future saved edits will appear here.</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {entries.map((entry) => {
                const isExpanded = expanded === entry.id;
                const date = new Date(entry.timestamp);
                const timestamp = Number.isNaN(date.getTime())
                  ? entry.timestamp
                  : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
                const changeCount = entry.changes.filter(
                  (change) => !areProductHistoryValuesEqual(change.before, change.after)
                ).length + (entry.omittedChangeCount || 0);
                return (
                  <li key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpanded(isExpanded ? null : entry.id)}
                      className="flex w-full items-center justify-between gap-4 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{entryTitle(entry)}</span>
                        <span className="mt-1 block truncate text-xs text-gray-600 dark:text-gray-300">{entry.productName || productName}</span>
                        <time dateTime={entry.timestamp} className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{timestamp}</time>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {entry.source !== "created" && (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            {entry.source === "bulk" && !entry.exactBulkChanges ? "Older bulk edit" : `${changeCount} fields`}
                          </span>
                        )}
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{isExpanded ? "Hide" : "View"}</span>
                      </span>
                    </button>
                    {isExpanded && entry.source === "bulk" && !entry.exactBulkChanges && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        Detailed field changes weren’t captured for this older bulk edit.
                      </p>
                    )}
                    {isExpanded && entry.changes.length > 0 && (entry.source !== "bulk" || entry.exactBulkChanges) && (
                      <ChangeDetails changes={entry.changes} omittedChangeCount={entry.omittedChangeCount} />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
