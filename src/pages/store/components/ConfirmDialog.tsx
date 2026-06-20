import { useEffect, useId, useRef, type ReactNode } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { STORE_SECTION_TITLE } from '../storeTypography';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
  requireConfirmText?: string;
  confirmTextValue?: string;
  onConfirmTextChange?: (value: string) => void;
  confirmHint?: string;
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  requireConfirmText,
  confirmTextValue = '',
  onConfirmTextChange,
  confirmHint,
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const isDanger = variant === 'danger';
  const textRequired = Boolean(requireConfirmText);
  const textMatches =
    !textRequired || confirmTextValue.trim() === requireConfirmText?.trim();
  const canConfirm = !loading && textMatches;

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    cancelRef.current?.focus();

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`relative w-full max-w-md rounded-2xl border shadow-xl ${
          isDanger
            ? 'border-red-200 dark:border-red-900/60 bg-white dark:bg-gray-900'
            : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
        }`}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {isDanger ? (
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
                  <FiAlertTriangle className="h-5 w-5" />
                </span>
              ) : null}
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className={`${STORE_SECTION_TITLE} ${
                    isDanger
                      ? 'text-red-900 dark:text-red-100'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {title}
                </h2>
                <p
                  id={descId}
                  className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed"
                >
                  {description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {children ? <div className="mt-4">{children}</div> : null}

          {textRequired ? (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                {confirmHint ?? `Type ${requireConfirmText} to confirm`}
              </label>
              <input
                type="text"
                value={confirmTextValue}
                onChange={(e) => onConfirmTextChange?.(e.target.value)}
                placeholder={requireConfirmText}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:border-transparent"
                autoComplete="off"
                autoFocus
              />
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canConfirm}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDanger
                  ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {loading ? 'Processing…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
