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

export default function StoreSaveBar({
  hasChanges,
  saving,
  canSave,
  onSave,
  savingLabel = 'Saving…',
}: StoreSaveBarProps) {
  if (!hasChanges && !saving) return null;

  const label = saving ? savingLabel : 'Save Changes';

  return (
    <>
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-4 z-[55]">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED}
        >
          {label}
        </button>
      </div>

      <div className="hidden md:block fixed bottom-6 right-6">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={`${canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED} shadow-lg`}
        >
          {label}
        </button>
      </div>

      {hasChanges ? (
        <div className="hidden md:block fixed bottom-20 right-6 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
          You have unsaved changes
        </div>
      ) : null}
    </>
  );
}
