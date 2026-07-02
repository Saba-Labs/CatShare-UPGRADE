import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaAlignCenter,
  FaAlignLeft,
  FaAlignRight,
  FaBold,
  FaItalic,
  FaListOl,
  FaListUl,
  FaRedo,
  FaSmile,
  FaUnderline,
  FaUndo,
} from 'react-icons/fa';
import {
  applyFontSizeToSelection,
  DEFAULT_PRODUCT_DESCRIPTION_FONT_SIZE,
  getSelectionFontSize,
  PRODUCT_DESCRIPTION_FONT_SIZES,
  sanitizeProductDescriptionHtml,
} from '../utils/productDescriptionHtml';
import './ProductDescriptionEditor.css';

const EMOJI_OPTIONS = [
  '✨', '❤️', '🌸', '💰', '🤔', '👶', '📦', '✅', '⭐', '🔥', '💯', '🎁',
  '📏', '🧵', '👕', '💝', '🛍️', '😊', '🙏', '☀️', '🌿', '💧', '🧼', '📌',
];

export interface ProductDescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  compact?: boolean;
}

const HISTORY_LIMIT = 100;

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`pde-toolbar-btn${active ? ' is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export default function ProductDescriptionEditor({
  value,
  onChange,
  placeholder = 'Tell customers about this product on your store…',
  minHeight = 100,
  compact = false,
}: ProductDescriptionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const fontSizeRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const syncingRef = useRef(false);
  const suppressHistoryRef = useRef(false);
  const historyRef = useRef<{ past: string[]; future: string[]; last: string }>({
    past: [],
    future: [],
    last: '',
  });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState(DEFAULT_PRODUCT_DESCRIPTION_FONT_SIZE);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryFlags = useCallback(() => {
    const h = historyRef.current;
    setCanUndo(h.past.length > 0);
    setCanRedo(h.future.length > 0);
  }, []);

  const saveSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
      setCurrentFontSize(getSelectionFontSize(editor, savedRangeRef.current));
    }
  }, []);

  const recordHistory = useCallback(
    (html: string) => {
      if (suppressHistoryRef.current) return;
      const h = historyRef.current;
      if (html === h.last) return;
      h.past.push(h.last);
      if (h.past.length > HISTORY_LIMIT) {
        h.past.shift();
      }
      h.last = html;
      h.future = [];
      syncHistoryFlags();
    },
    [syncHistoryFlags],
  );

  const restoreHistoryEntry = useCallback(
    (html: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      suppressHistoryRef.current = true;
      syncingRef.current = true;
      const cleaned = sanitizeProductDescriptionHtml(html);
      editor.innerHTML = cleaned;
      historyRef.current.last = cleaned;
      onChange(cleaned);

      requestAnimationFrame(() => {
        suppressHistoryRef.current = false;
        syncingRef.current = false;
        editor.focus();
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        saveSelection();
      });
    },
    [onChange, saveSelection],
  );

  const handleUndo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;

    h.future.unshift(h.last);
    const previous = h.past.pop() ?? '';
    h.last = previous;
    restoreHistoryEntry(previous);
    syncHistoryFlags();
  }, [restoreHistoryEntry, syncHistoryFlags]);

  const handleRedo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;

    h.past.push(h.last);
    const next = h.future.shift() ?? '';
    h.last = next;
    restoreHistoryEntry(next);
    syncHistoryFlags();
  }, [restoreHistoryEntry, syncHistoryFlags]);

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current;
    const range = savedRangeRef.current;
    const selection = window.getSelection();
    if (!editor || !range || !selection) return false;
    if (!editor.contains(range.commonAncestorContainer)) return false;
    selection.removeAllRanges();
    selection.addRange(range.cloneRange());
    return true;
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || syncingRef.current || suppressHistoryRef.current) return;
    const next = sanitizeProductDescriptionHtml(value || '');
    if (editor.innerHTML !== next) {
      editor.innerHTML = next;
      historyRef.current = { past: [], future: [], last: next };
      syncHistoryFlags();
      return;
    }
    if (!historyRef.current.last && historyRef.current.past.length === 0) {
      historyRef.current.last = next;
    }
  }, [value, syncHistoryFlags]);

  useEffect(() => {
    if (!emojiOpen && !fontSizeOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (emojiOpen && emojiRef.current?.contains(target)) return;
      if (fontSizeOpen && fontSizeRef.current?.contains(target)) return;
      setEmojiOpen(false);
      setFontSizeOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [emojiOpen, fontSizeOpen]);

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    syncingRef.current = true;
    const cleaned = sanitizeProductDescriptionHtml(editor.innerHTML);
    if (editor.innerHTML !== cleaned) {
      editor.innerHTML = cleaned;
    }
    recordHistory(cleaned);
    onChange(cleaned);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [onChange, recordHistory]);

  const handleEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    },
    [handleRedo, handleUndo],
  );

  const applyFontSize = useCallback(
    (fontSize: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();
      restoreSelection();
      const applied = applyFontSizeToSelection(fontSize, editor, savedRangeRef.current);
      if (applied) {
        saveSelection();
        emitChange();
      }
      setFontSizeOpen(false);
    },
    [emitChange, restoreSelection, saveSelection],
  );

  const runCommand = useCallback(
    (command: string, commandValue?: string) => {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand(command, false, commandValue);
      saveSelection();
      emitChange();
    },
    [emitChange, restoreSelection, saveSelection],
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand('insertText', false, emoji);
      saveSelection();
      emitChange();
      setEmojiOpen(false);
    },
    [emitChange, restoreSelection, saveSelection],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const html = event.clipboardData.getData('text/html');
      const text = event.clipboardData.getData('text/plain');
      event.preventDefault();
      editorRef.current?.focus();
      restoreSelection();
      if (html) {
        document.execCommand('insertHTML', false, sanitizeProductDescriptionHtml(html));
      } else {
        document.execCommand('insertText', false, text);
      }
      saveSelection();
      emitChange();
    },
    [emitChange, restoreSelection, saveSelection],
  );

  return (
    <div className={`product-description-editor${compact ? ' product-description-editor--compact' : ''}`}>
      <div
        className="pde-toolbar"
        role="toolbar"
        aria-label="Description formatting"
        onMouseDownCapture={saveSelection}
      >
        <ToolbarButton
          label="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={handleUndo}
        >
          <FaUndo size={compact ? 12 : 13} />
        </ToolbarButton>
        <ToolbarButton
          label="Redo (Ctrl+Y)"
          disabled={!canRedo}
          onClick={handleRedo}
        >
          <FaRedo size={compact ? 12 : 13} />
        </ToolbarButton>
        <span className="pde-toolbar-sep" aria-hidden />
        <div className="pde-font-size-wrap" ref={fontSizeRef}>
          <button
            type="button"
            className={`pde-font-size-trigger${fontSizeOpen ? ' is-open' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              saveSelection();
              setFontSizeOpen((open) => !open);
              setEmojiOpen(false);
            }}
            aria-label="Font size"
            aria-haspopup="listbox"
            aria-expanded={fontSizeOpen}
            title="Font size"
          >
            <span className="pde-font-size-value">
              {PRODUCT_DESCRIPTION_FONT_SIZES.find((size) => size.value === currentFontSize)?.label ?? '14'}
            </span>
            <span className="pde-font-size-chevron" aria-hidden>
              ▾
            </span>
          </button>
          {fontSizeOpen ? (
            <div className="pde-font-size-menu" role="listbox" aria-label="Font size">
              {PRODUCT_DESCRIPTION_FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  className={`pde-font-size-option${size.value === currentFontSize ? ' is-active' : ''}`}
                  role="option"
                  aria-selected={size.value === currentFontSize}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyFontSize(size.value)}
                >
                  {size.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <span className="pde-toolbar-sep" aria-hidden />
        <ToolbarButton label="Bold" onClick={() => runCommand('bold')}>
          <FaBold size={compact ? 12 : 13} />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => runCommand('italic')}>
          <FaItalic size={compact ? 12 : 13} />
        </ToolbarButton>
        <ToolbarButton label="Underline" onClick={() => runCommand('underline')}>
          <FaUnderline size={compact ? 12 : 13} />
        </ToolbarButton>
        <span className="pde-toolbar-sep" aria-hidden />
        <ToolbarButton label="Align left" onClick={() => runCommand('justifyLeft')}>
          <FaAlignLeft size={compact ? 12 : 13} />
        </ToolbarButton>
        <ToolbarButton label="Align center" onClick={() => runCommand('justifyCenter')}>
          <FaAlignCenter size={compact ? 12 : 13} />
        </ToolbarButton>
        <ToolbarButton label="Align right" onClick={() => runCommand('justifyRight')}>
          <FaAlignRight size={compact ? 12 : 13} />
        </ToolbarButton>
        <span className="pde-toolbar-sep" aria-hidden />
        <ToolbarButton label="Bullet list" onClick={() => runCommand('insertUnorderedList')}>
          <FaListUl size={compact ? 12 : 13} />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => runCommand('insertOrderedList')}>
          <FaListOl size={compact ? 12 : 13} />
        </ToolbarButton>
        <span className="pde-toolbar-sep" aria-hidden />
        <div className="pde-emoji-wrap" ref={emojiRef}>
          <ToolbarButton label="Insert emoji" active={emojiOpen} onClick={() => setEmojiOpen((v) => !v)}>
            <FaSmile size={compact ? 12 : 13} />
          </ToolbarButton>
          {emojiOpen ? (
            <div className="pde-emoji-picker" role="listbox" aria-label="Emoji picker">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="pde-emoji-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertEmoji(emoji)}
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div
        ref={editorRef}
        className="pde-body"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        data-placeholder={placeholder}
        style={{ minHeight }}
        onInput={emitChange}
        onBlur={emitChange}
        onKeyDown={handleEditorKeyDown}
        onPaste={handlePaste}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onFocus={saveSelection}
        onSelect={saveSelection}
      />
    </div>
  );
}
