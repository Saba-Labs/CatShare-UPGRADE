import { useState } from 'react';
import { FaBold, FaItalic, FaUnderline } from 'react-icons/fa';
import { FONT_SIZE_OPTIONS } from '../../utils/builderRichText';
import { useBuilderInlineEdit } from './BuilderInlineEditContext';

export default function BuilderInlineFormatControls() {
  const inlineEdit = useBuilderInlineEdit();
  const [textColor, setTextColor] = useState('#ffffff');

  if (!inlineEdit?.isFormatActive) return null;

  const { runCommand, applyFontSize, applyTextColor, saveSelection } = inlineEdit;

  return (
    <div
      className="builder-inline-format-toolbar"
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={(e) => {
        e.preventDefault();
        saveSelection();
      }}
    >
      <button type="button" className="sites-float-icon-btn" aria-label="Bold" title="Bold" onClick={() => runCommand('bold')}>
        <FaBold size={12} />
      </button>
      <button type="button" className="sites-float-icon-btn" aria-label="Italic" title="Italic" onClick={() => runCommand('italic')}>
        <FaItalic size={12} />
      </button>
      <button type="button" className="sites-float-icon-btn" aria-label="Underline" title="Underline" onClick={() => runCommand('underline')}>
        <FaUnderline size={12} />
      </button>
      <select
        className="sites-float-select sites-float-select--compact"
        aria-label="Text size"
        defaultValue=""
        onChange={(e) => {
          const next = e.target.value;
          if (!next) return;
          applyFontSize(next);
          e.target.value = '';
        }}
      >
        <option value="" disabled>
          Size
        </option>
        {FONT_SIZE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <label className="builder-format-color" title="Text color">
        <span className="builder-format-color__swatch" style={{ background: textColor }} aria-hidden />
        <input
          type="color"
          value={textColor}
          aria-label="Text color"
          onChange={(e) => {
            setTextColor(e.target.value);
            applyTextColor(e.target.value);
          }}
        />
      </label>
    </div>
  );
}
