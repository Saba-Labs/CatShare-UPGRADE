import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface CataloguePickerModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onDone: () => void;
  doneLabel?: string;
}

export default function CataloguePickerModal({
  title,
  children,
  onClose,
  onDone,
  doneLabel = 'Done',
}: CataloguePickerModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="media-picker-overlay catalogue-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="media-picker-modal catalogue-picker-modal" onClick={(e) => e.stopPropagation()}>
        <header className="media-picker-header catalogue-picker-modal__header">
          <h3>{title}</h3>
          <button type="button" className="media-picker-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="catalogue-picker-modal__body">{children}</div>
        <footer className="catalogue-picker-modal__footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onDone}>
            {doneLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
