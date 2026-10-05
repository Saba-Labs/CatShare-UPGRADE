import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiClock, FiTrash2, FiX } from "react-icons/fi";
import { getPersistedAuthUserId } from "../utils/authUserId";
import { getAllCatalogues } from "../config/catalogueConfig";
import { getAllFields } from "../config/fieldConfig";
import {
  clearProductHistory,
  isProductHistoryCloudClearPending,
  mergeProductHistory,
  queueProductHistorySync,
  readProductHistory,
  type ProductHistoryChange,
  type ProductHistoryEntry,
  areProductHistoryValuesEqual,
} from "../utils/productHistory";
import { fetchProductHistory } from "../services/productHistoryCloud";

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

function historyChangeLabel(
  path: string,
  catalogueLabels: Map<string, string>,
  fields: ReturnType<typeof getAllFields>
): string {
  const cataloguePath = /^catalogueData\.([^.]+)\.(.+)$/.exec(path);
  const root = path.split(/[.\[]/)[0];
  const field = fields.find((item) => item.key === root || item.unitField === root);
  const fieldLabel = field
    ? field.unitField === root && field.key !== root ? `${field.label} Unit` : field.label
    : humanize(root);
  if (!cataloguePath) return fieldLabel;

  const [, catalogueId, catalogueFieldPath] = cataloguePath;
  const pathParts = catalogueFieldPath.split(/[.\[]/);
  const catalogueField = pathParts.shift() || "";
  const configuredField = fields.find(
    (item) => item.key === catalogueField || item.unitField === catalogueField
  );
  const label = configuredField
    ? configuredField.unitField === catalogueField && configuredField.key !== catalogueField
      ? `${configuredField.label} Unit`
      : configuredField.label
    : humanize(catalogueField);
  const nestedPath = pathParts.filter(Boolean).join(" ");
  const suffix = nestedPath ? ` · ${humanize(nestedPath)}` : "";
  return `${catalogueLabels.get(catalogueId) || "Catalogue"} · ${label}${suffix}`;
}

function entryTitle(entry: ProductHistoryEntry): string {
  if (entry.source === "created") return "Product created";
  if (entry.source === "variants") return "Variants updated";
  if (entry.source === "bulk") return `Bulk edit · ${entry.affectedProductCount || 1} products`;
  return "Product updated";
}

function isLegacyEntry(entry: ProductHistoryEntry): boolean {
  return (entry.source === "product" && !entry.exactProductChanges) ||
    (entry.source === "bulk" && !entry.exactBulkChanges);
}

function isLegacyDefaultAddition(change: ProductHistoryChange): boolean {
  const beforeIsEmpty = change.before == null || change.before === "" || (Array.isArray(change.before) && change.before.length === 0);
  if (!beforeIsEmpty) return false;
  if (change.after === "None" || change.after === "/ piece" || change.after === true) return true;
  if (change.after === 1 && /\.(orderQuantityStep|minimumOrderQuantity)$/.test(change.path)) return true;
  return Array.isArray(change.after) && change.after.length === 0;
}

function visibleHistoryChanges(entry: ProductHistoryEntry): ProductHistoryChange[] {
  const changed = entry.changes.filter(
    (change) => !areProductHistoryValuesEqual(change.before, change.after)
  );
  if (!isLegacyEntry(entry)) return changed;

  const canonicalFields = new Set([
    "name", "subtitle", "description", "privateNotes", "category", "catalogueData", "variants",
    "imageUrl", "imageUrls", "primaryImageIndex", "videoUrls", "fontColor", "imageBgColor",
    "bgColor", "cropAspectRatio", "suggestedColors",
  ]);
  const productAliases = /^(field\d+(Unit)?|price\d+(Unit)?|wholesale(Unit)?|packageUnit|ageUnit|badge|stock|wholesaleStock)$/;
  const catalogueChanges = changed.filter((change) => change.path.startsWith("catalogueData."));
  const canonicalChanges = changed.filter((change) => {
    const root = change.path.split(/[.\[]/)[0];
    return canonicalFields.has(root) || (!catalogueChanges.length && productAliases.test(root));
  });

  return canonicalChanges.filter((change) => {
    const root = change.path.split(/[.\[]/)[0];
    if (catalogueChanges.length && productAliases.test(root)) return false;
    return !isLegacyDefaultAddition(change);
  });
}

function ChangeDetails({
  changes,
  catalogueLabels,
  fields,
  omittedChangeCount = 0,
}: {
  changes: ProductHistoryChange[];
  catalogueLabels: Map<string, string>;
  fields: ReturnType<typeof getAllFields>;
  omittedChangeCount?: number;
}) {
  const changedFields = changes.filter((change) => !areProductHistoryValuesEqual(change.before, change.after));
  return (
    <div className="mt-3 space-y-2">
      {changedFields.map((change, index) => (
        <div key={`${change.path}-${index}`} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3">
          <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">{historyChangeLabel(change.path, catalogueLabels, fields)}</div>
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
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const userId = getPersistedAuthUserId() || undefined;
  const catalogueLabels = useMemo(
    () => new Map(getAllCatalogues(userId).map((catalogue) => [catalogue.id, catalogue.label])),
    [userId]
  );
  const fields = useMemo(() => getAllFields(), [userId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const refresh = () => setEntries(readProductHistory(userId, productId));
    const handleHistoryChange = (event: Event) => {
      const changedProductId = (event as CustomEvent<{ productId?: string }>).detail?.productId;
      if (!changedProductId || String(changedProductId) === String(productId)) refresh();
    };
    refresh();
    window.addEventListener("product-history-changed", handleHistoryChange);

    if (userId) {
      fetchProductHistory(userId, String(productId))
        .then((cloudEntries) => {
          if (!active) return;
          if (isProductHistoryCloudClearPending(userId, String(productId))) {
            refresh();
            return;
          }
          const localEntries = readProductHistory(userId, productId);
          const cloudIds = new Set(cloudEntries.map((entry) => entry.id));
          mergeProductHistory(userId, productId, cloudEntries);
          queueProductHistorySync(
            userId,
            localEntries.filter((entry) => !cloudIds.has(entry.id))
          );
        })
        .catch((error) => {
          console.debug("Product history cloud fetch failed; showing local history:", error);
        });
    }

    return () => {
      active = false;
      window.removeEventListener("product-history-changed", handleHistoryChange);
    };
  }, [open, productId, userId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleClearHistory = () => {
    clearProductHistory(userId, String(productId));
    setEntries(readProductHistory(userId, productId));
    setExpanded(null);
    setShowClearConfirmation(false);
  };

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
          <div className="flex shrink-0 items-center gap-1">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirmation(true)}
                aria-label="Clear product history"
                title="Clear product history"
                className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
              >
                <FiTrash2 size={16} />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close history" className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"><FiX size={18} /></button>
          </div>
        </header>

        <div className="overflow-y-auto p-4 sm:p-5">
          {showClearConfirmation && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/30">
              <p id="clear-product-history-confirmation" className="text-sm font-medium text-gray-800 dark:text-gray-100">
                Clear all history for this product? This can’t be undone.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirmation(false)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  aria-describedby="clear-product-history-confirmation"
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Clear history
                </button>
              </div>
            </div>
          )}
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
                const visibleChanges = visibleHistoryChanges(entry);
                const legacyEntry = isLegacyEntry(entry);
                const changeCount = visibleChanges.length + (legacyEntry ? 0 : entry.omittedChangeCount || 0);
                return (
                  <li key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={`${entryTitle(entry)}, ${changeCount} ${changeCount === 1 ? "field" : "fields"}, ${isExpanded ? "collapse" : "expand"}`}
                      onClick={() => setExpanded(isExpanded ? null : entry.id)}
                      className="flex w-full items-center justify-between gap-4 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{entryTitle(entry)}</span>
                        <time dateTime={entry.timestamp} className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{timestamp}</time>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {entry.source !== "created" && (
                          <span className="inline-flex items-baseline gap-1 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {legacyEntry && visibleChanges.length === 0 ? (
                              <span className="text-[10px] font-medium">{entry.source === "bulk" ? "Older bulk edit" : "Older save"}</span>
                            ) : (
                              <>
                                <span className="text-sm font-semibold leading-none text-gray-800 dark:text-gray-100">{changeCount}</span>
                                <span className="text-[10px] font-medium">{changeCount === 1 ? "field" : "fields"}</span>
                              </>
                            )}
                          </span>
                        )}
                        <FiChevronDown
                          aria-hidden="true"
                          className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          size={16}
                        />
                      </span>
                    </button>
                    {isExpanded && legacyEntry && visibleChanges.length > 0 && (
                      <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                        Recovered from an older history entry; unchanged aliases are hidden.
                      </p>
                    )}
                    {isExpanded && legacyEntry && visibleChanges.length === 0 && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        No reliable field-level changes could be recovered from this older entry.
                      </p>
                    )}
                    {isExpanded && visibleChanges.length > 0 && (
                      <ChangeDetails
                        changes={visibleChanges}
                        catalogueLabels={catalogueLabels}
                        fields={fields}
                        omittedChangeCount={legacyEntry ? 0 : entry.omittedChangeCount}
                      />
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
