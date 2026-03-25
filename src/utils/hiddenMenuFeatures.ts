/** Session-only: unlock does not survive reload. Clears legacy persisted flag from older builds. */
const LEGACY_STORAGE_KEY = 'catshareHiddenMenuUnlocked';

try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
} catch {
  /* ignore */
}

export const HIDDEN_MENU_UNLOCKED_EVENT = 'catshare-hidden-menu-unlocked-changed';

/** Fired when the user completes the 7-tap “Menu” unlock in the side drawer (this session only). */
export function notifyHiddenMenuUnlocked(): void {
  window.dispatchEvent(new CustomEvent(HIDDEN_MENU_UNLOCKED_EVENT));
}
