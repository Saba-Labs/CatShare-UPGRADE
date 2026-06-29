import { createPortal } from 'react-dom';
import {
  STORE_SAVE_BTN_DISABLED,
  STORE_SAVE_BTN_ENABLED,
} from '../storeTypography';

interface StoreSaveBarProps {
  hasChanges: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  savingLabel?: string;
}

/** Sits above the fixed main app bottom tab bar on all screen sizes. */
const SAVE_BAR_BOTTOM = 'calc(4.5rem + env(safe-area-inset-bottom, 0px))';

export default function StoreSaveBar({
  hasChanges,
  saving,
  canSave,
  onSave,
  savingLabel = 'Saving…',
}: StoreSaveBarProps) {
  if (!hasChanges && !saving) return null;

  const label = saving ? savingLabel : 'Save Changes';

  const bar = (
    <div
      className="fixed inset-x-0 z-[55] border-t border-gray-200 bg-white/95 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95"
      style={{ bottom: SAVE_BAR_BOTTOM }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        {hasChanges ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">You have unsaved changes</p>
        ) : (
          <span className="hidden sm:block" aria-hidden />
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={`${canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED} w-full shadow-lg sm:ml-auto sm:w-auto`}
        >
          {label}
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return bar;
  }

  return createPortal(bar, document.body);
}
