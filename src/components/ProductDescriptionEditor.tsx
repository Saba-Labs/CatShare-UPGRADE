import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaAlignCenter,
  FaAlignLeft,
  FaAlignRight,
  FaBold,
  FaItalic,
  FaListOl,
  FaListUl,
  FaSmile,
  FaUnderline,
} from 'react-icons/fa';
import {
  applyDescriptionStyleToSelection,
  PRODUCT_DESCRIPTION_STYLES,
  type ProductDescriptionStyleClass,
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

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`pde-toolbar-btn${active ? ' is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function StyleButton({
  label,
  shortLabel,
  compact,
  onApply,
}: {
  label: string;
  shortLabel: string;
  compact: boolean;
  onApply: () => void;
}) {
  return (
    <button
      type="button"
      className="pde-style-btn"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onApply}
      aria-label={label}
      title={label}
    >
      {compact ? shortLabel : label}
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
  const savedRangeRef = useRef<Range | null>(null);
  const syncingRef = useRef(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const saveSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || syncingRef.current) return;
    const next = sanitizeProductDescriptionHtml(value || '');
    if (editor.innerHTML !== next) {
      editor.innerHTML = next;
    }
  }, [value]);

  useEffect(() => {
    if (!emojiOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (emojiRef.current?.contains(target)) return;
      setEmojiOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [emojiOpen]);

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    syncingRef.current = true;
    const cleaned = sanitizeProductDescriptionHtml(editor.innerHTML);
    if (editor.innerHTML !== cleaned) {
      editor.innerHTML = cleaned;
    }
    onChange(cleaned);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [onChange]);

  const applyTextStyle = useCallback(
    (styleClass: ProductDescriptionStyleClass) => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();
      const applied = applyDescriptionStyleToSelection(styleClass, editor, savedRangeRef.current);
      if (applied) {
        saveSelection();
        emitChange();
      }
    },
    [emitChange, saveSelection],
  );

  const runCommand = useCallback(
    (command: string, commandValue?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, commandValue);
      saveSelection();
      emitChange();
    },
    [emitChange, saveSelection],
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      editorRef.current?.focus();
      document.execCommand('insertText', false, emoji);
      saveSelection();
      emitChange();
      setEmojiOpen(false);
    },
    [emitChange, saveSelection],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const html = event.clipboardData.getData('text/html');
      const text = event.clipboardData.getData('text/plain');
      event.preventDefault();
      editorRef.current?.focus();
      if (html) {
        document.execCommand('insertHTML', false, sanitizeProductDescriptionHtml(html));
      } else {
        document.execCommand('insertText', false, text);
      }
      saveSelection();
      emitChange();
    },
    [emitChange, saveSelection],
  );

  return (
    <div className={`product-description-editor${compact ? ' product-description-editor--compact' : ''}`}>
      <div
        className="pde-toolbar"
        role="toolbar"
        aria-label="Description formatting"
        onMouseDown={saveSelection}
      >
        {PRODUCT_DESCRIPTION_STYLES.map((style) => (
          <StyleButton
            key={style.key}
            label={style.label}
            shortLabel={style.shortLabel}
            compact={compact}
            onApply={() => applyTextStyle(style.key)}
          />
        ))}
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
        onPaste={handlePaste}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onFocus={saveSelection}
      />
    </div>
  );
}
