import React, { useRef, useCallback } from 'react';
import { FiClipboard, FiCopy, FiScissors } from 'react-icons/fi';
import { useToast } from '../context/ToastContext';

const clipBtn =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors';

export default function BulkDescriptionField({
  value,
  onChange,
  inputClassName,
  placeholder = 'Store description',
  rows = 5,
}) {
  const { showToast } = useToast();
  const textareaRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  const saveSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    selectionRef.current = {
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0,
    };
  }, []);

  const readSelection = useCallback(() => {
    const el = textareaRef.current;
    if (el && document.activeElement === el) {
      saveSelection();
    }
    return { ...selectionRef.current };
  }, [saveSelection]);

  const focusTextarea = useCallback((start, end = start) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    selectionRef.current = { start, end };
  }, []);

  const handleToolbarMouseDown = useCallback(
    (event) => {
      saveSelection();
      event.preventDefault();
    },
    [saveSelection],
  );

  const handleCopy = useCallback(async () => {
    const text = value ?? '';
    const { start, end } = readSelection();
    const slice = start !== end ? text.slice(start, end) : text;
    if (!slice) {
      showToast('Nothing to copy', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(slice);
      showToast(start !== end ? 'Selection copied' : 'Copied', 'success');
    } catch {
      showToast('Could not copy', 'error');
    }
  }, [readSelection, showToast, value]);

  const handleCut = useCallback(async () => {
    const text = value ?? '';
    const { start, end } = readSelection();
    if (start === end) {
      showToast('Select text to cut', 'warning');
      return;
    }
    const slice = text.slice(start, end);
    try {
      await navigator.clipboard.writeText(slice);
    } catch {
      showToast('Could not cut', 'error');
      return;
    }
    onChange(text.slice(0, start) + text.slice(end));
    requestAnimationFrame(() => focusTextarea(start, start));
    showToast('Cut to clipboard', 'success');
  }, [focusTextarea, onChange, readSelection, showToast, value]);

  const handlePaste = useCallback(async () => {
    let pasted = '';
    try {
      pasted = await navigator.clipboard.readText();
    } catch {
      showToast('Could not paste — allow clipboard access', 'error');
      return;
    }
    if (!pasted) {
      showToast('Clipboard is empty', 'warning');
      return;
    }
    const text = value ?? '';
    const { start, end } = readSelection();
    const next = text.slice(0, start) + pasted + text.slice(end);
    onChange(next);
    const cursor = start + pasted.length;
    requestAnimationFrame(() => focusTextarea(cursor, cursor));
    showToast('Pasted', 'success');
  }, [focusTextarea, onChange, readSelection, showToast, value]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <div
        className="flex items-center justify-end gap-0.5"
        role="toolbar"
        aria-label="Description clipboard"
        onMouseDown={handleToolbarMouseDown}
      >
        <button type="button" className={clipBtn} onClick={handleCut} aria-label="Cut" title="Cut">
          <FiScissors className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={clipBtn} onClick={handleCopy} aria-label="Copy" title="Copy">
          <FiCopy className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={clipBtn} onClick={handlePaste} aria-label="Paste" title="Paste">
          <FiClipboard className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onSelect={saveSelection}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onFocus={saveSelection}
        className={inputClassName}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}
