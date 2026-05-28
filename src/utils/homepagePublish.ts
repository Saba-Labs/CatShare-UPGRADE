import { HomepageLayout } from '../types/homepage';

/** Shallow-stable compare for draft vs published change detection in the editor. */
export function homepageLayoutsEqual(a: HomepageLayout | undefined | null, b: HomepageLayout | undefined | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
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
