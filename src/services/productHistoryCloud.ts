import { getSupabaseClient } from "../supabaseClient";
import type { ProductHistoryEntry } from "../utils/productHistory";

const PRODUCT_HISTORY_LIMIT = 20;
const PRODUCT_HISTORY_SOURCES = new Set(["created", "product", "variants", "bulk"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isProductHistoryEntry(value: unknown, productId: string): value is ProductHistoryEntry {
  return isRecord(value) &&
    typeof value.id === "string" &&
    String(value.productId) === productId &&
    typeof value.timestamp === "string" &&
    typeof value.source === "string" &&
    PRODUCT_HISTORY_SOURCES.has(value.source) &&
    Array.isArray(value.changes) &&
    value.changes.every((change) =>
      isRecord(change) &&
      typeof change.path === "string" &&
      "before" in change &&
      "after" in change
    );
}

export async function syncProductHistory(
  userId: string,
  entries: ProductHistoryEntry[]
): Promise<{ success: boolean; error?: string }> {
  if (!userId || entries.length === 0) return { success: true };

  const rows = entries.map((entry) => ({
    user_id: userId,
    product_id: String(entry.productId),
    entry_id: entry.id,
    occurred_at: entry.timestamp,
    source: entry.source,
    entry,
  }));

  const { error } = await getSupabaseClient()
    .from("product_history")
    .upsert(rows, {
      onConflict: "user_id,product_id,entry_id",
      ignoreDuplicates: true,
    });

  return error ? { success: false, error: error.message } : { success: true };
}

export async function deleteProductHistory(
  userId: string,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await getSupabaseClient()
    .from("product_history")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", String(productId));

  return error ? { success: false, error: error.message } : { success: true };
}

export async function fetchProductHistory(
  userId: string,
  productId: string
): Promise<ProductHistoryEntry[]> {
  const { data, error } = await getSupabaseClient()
    .from("product_history")
    .select("entry")
    .eq("user_id", userId)
    .eq("product_id", String(productId))
    .order("occurred_at", { ascending: false })
    .order("entry_id", { ascending: false })
    .limit(PRODUCT_HISTORY_LIMIT);

  if (error) throw new Error(error.message);

  return (data || [])
    .map((row) => row.entry)
    .filter((entry) => isProductHistoryEntry(entry, String(productId))) as ProductHistoryEntry[];
}
