/**
 * Sanitize a base filename for use as product display name; dedupe within a batch.
 */

export function sanitizeFilenameBase(name: string): string {
  const base = name.replace(/\.[^/.]+$/, "").trim();
  const cleaned = base
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 80) || "Product";
}

/** First occurrence keeps the base name; duplicates get " (2)", " (3)", … */
export function dedupeDisplayNamesFromFilenames(filenames: string[]): string[] {
  const seen = new Map<string, number>();
  return filenames.map((raw) => {
    const base = sanitizeFilenameBase(raw);
    const k = base.toLowerCase();
    const c = (seen.get(k) || 0) + 1;
    seen.set(k, c);
    if (c === 1) return base;
    return `${base} (${c})`;
  });
}
