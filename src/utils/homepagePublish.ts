import { HomepageLayout } from '../types/homepage';
import { normalizeHomepageLayoutForWebsiteMode } from '../config/homepageBuilderConfig';

/** Shallow-stable compare for draft vs published change detection in the editor. */
export function homepageLayoutsEqual(a: HomepageLayout | undefined | null, b: HomepageLayout | undefined | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(canonicalizeLayoutForCompare(a)) === JSON.stringify(canonicalizeLayoutForCompare(b));
  } catch {
    return false;
  }
}

function canonicalizeLayoutForCompare(layout: HomepageLayout): HomepageLayout {
  const normalized = normalizeHomepageLayoutForWebsiteMode(layout);
  const cloned = JSON.parse(JSON.stringify(normalized)) as HomepageLayout;
  // Publish metadata is expected to differ immediately after publish; ignore it for dirty-state detection.
  if (cloned.websiteConfig?.versioning) {
    delete cloned.websiteConfig.versioning;
  }
  return cloned;
}

export function formatPublishDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}
