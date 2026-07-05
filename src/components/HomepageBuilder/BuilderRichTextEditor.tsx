import { useCallback, useEffect, useRef } from 'react';
import { FaBold, FaItalic, FaUnderline } from 'react-icons/fa';
import { FONT_SIZE_OPTIONS, sanitizeBuilderHtml } from '../../utils/builderRichText';
import ColorPickerField from './ColorPickerField';
import SidebarDropdownField from './SidebarDropdownField';

interface BuilderRichTextEditorProps {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="builder-format-btn"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function BuilderRichTextEditor({
  label = 'Content',
  value,
  onChange,
  minHeight = 120,
}: BuilderRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const range = savedRangeRef.current;
    if (!range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(sanitizeBuilderHtml(editor.innerHTML));
  }, [onChange]);

  const runCommand = useCallback(
    (command: string, commandValue?: string) => {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand(command, false, commandValue);
      saveSelection();
      emitChange();
    },
    [emitChange, restoreSelection, saveSelection]
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const next = value || '';
    if (next.includes('<')) editor.innerHTML = sanitizeBuilderHtml(next);
    else editor.textContent = next;
  }, [value]);

  return (
    <div className="panel-section builder-rich-text-editor">
      <label className="panel-label">{label}</label>
      <div className="builder-format-toolbar" role="toolbar" aria-label="Text formatting" onMouseDownCapture={saveSelection}>
        <ToolbarButton label="Bold" onClick={() => runCommand('bold')}>
          <FaBold size={13} />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => runCommand('italic')}>
          <FaItalic size={13} />
        </ToolbarButton>
        <ToolbarButton label="Underline" onClick={() => runCommand('underline')}>
          <FaUnderline size={13} />
        </ToolbarButton>
        <span className="builder-format-sep" aria-hidden />
        <SidebarDropdownField
          ariaLabel="Text size"
          value=""
          placeholder="Size"
          options={FONT_SIZE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          onChange={(next) => {
            if (!next) return;
            document.execCommand('styleWithCSS', false, 'true');
            runCommand('foreColor', '#111827');
            restoreSelection();
            const selected = window.getSelection()?.toString() || 'Text';
            document.execCommand('insertHTML', false, `<span style="font-size:${next}">${selected}</span>`);
            emitChange();
          }}
        />
      </div>
      <div
        ref={editorRef}
        className="builder-rich-text-editor__field panel-input"
        style={{ minHeight }}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onFocus={saveSelection}
        onBlur={emitChange}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
      />
      <ColorPickerField
        label="Selection color"
        value="#111827"
        defaultValue="#111827"
        onChange={(color) => runCommand('foreColor', color)}
      />
    </div>
  );
}
