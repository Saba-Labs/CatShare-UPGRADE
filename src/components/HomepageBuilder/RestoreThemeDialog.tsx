import { createPortal } from 'react-dom';

interface RestoreThemeDialogProps {
  open: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function RestoreThemeDialog({
  open,
  message,
  onCancel,
  onConfirm,
}: RestoreThemeDialogProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="builder-restore-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="builder-restore-title"
      onClick={onCancel}
    >
      <div className="builder-restore-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 id="builder-restore-title" className="builder-restore-dialog__title">
          Remove theme?
        </h3>
        <p className="builder-restore-dialog__message">{message}</p>
        <div className="builder-restore-dialog__actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="builder-restore-dialog__confirm" onClick={onConfirm}>
            Remove theme · restore original
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
