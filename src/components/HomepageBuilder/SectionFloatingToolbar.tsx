import { useEffect } from 'react';
import { FaAlignCenter, FaAlignLeft, FaAlignRight } from 'react-icons/fa';
import { FiCopy, FiImage, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import type { BlockAlign, BlockLayout, HomepageSection } from '../../types/homepage';
import {
  applyMediaUrlToSection,
  applyMediaUrlsToSection,
  sectionSupportsMultiMedia,
  sectionSupportsQuickMedia,
} from '../../utils/sectionMedia';
import { useBuilderMedia } from './media/BuilderMediaContext';
import BuilderInlineFormatControls from './BuilderInlineFormatControls';
import { useBuilderInlineEdit } from './BuilderInlineEditContext';
import { useDraggableFloatingToolbar } from './useDraggableFloatingToolbar';

interface SectionFloatingToolbarProps {
  section: HomepageSection & { id: string };
  isFreeform: boolean;
  align: BlockAlign;
  liveWidth: number;
  setAlign: (id: string, align: BlockAlign) => void;
  setWidth: (id: string, width: number) => void;
  resetHeight: (id: string) => void;
  storeId: string;
  onUpdateSection: (id: string, updates: Partial<HomepageSection>) => void;
  onDuplicateSection: (id: string) => void;
  onRemoveSection: (id: string) => void;
}

function ToolbarDivider() {
  return <span className="sites-floating-sep" aria-hidden />;
}

export default function SectionFloatingToolbar({
  section,
  isFreeform,
  align,
  liveWidth,
  setAlign,
  setWidth,
  resetHeight,
  storeId,
  onUpdateSection,
  onDuplicateSection,
  onRemoveSection,
}: SectionFloatingToolbarProps) {
  const { openMediaPicker } = useBuilderMedia();
  const inlineEdit = useBuilderInlineEdit();
  const showFormat = inlineEdit?.activeSectionId === section.id && inlineEdit.isFormatActive;
  const { toolbarRef, isUserPositioned, style, onDragHandlePointerDown, resetPosition } =
    useDraggableFloatingToolbar();

  useEffect(() => {
    resetPosition();
  }, [section.id, resetPosition]);

  const hasFixedHeight = Boolean(
    (section as HomepageSection & { blockLayout?: BlockLayout }).blockLayout?.heightPx
  );

  return (
    <div
      ref={toolbarRef}
      className={`sites-floating-toolbar${isUserPositioned ? ' sites-floating-toolbar--positioned' : ''}`}
      style={style}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="sites-floating-drag-handle"
        title="Drag toolbar"
        aria-label="Drag toolbar"
        onPointerDown={onDragHandlePointerDown}
        onDoubleClick={(e) => {
          e.stopPropagation();
          resetPosition();
        }}
      >
        <span className="sites-drag-grip-dots" aria-hidden />
      </button>

      {!isFreeform && (
        <>
          <div className="sites-float-icon-group" role="group" aria-label="Block alignment">
            <button
              type="button"
              className={`sites-float-icon-btn${align === 'left' ? ' active' : ''}`}
              title="Align left"
              aria-label="Align left"
              onClick={() => setAlign(section.id, 'left')}
            >
              <FaAlignLeft size={13} />
            </button>
            <button
              type="button"
              className={`sites-float-icon-btn${align === 'center' ? ' active' : ''}`}
              title="Align center"
              aria-label="Align center"
              onClick={() => setAlign(section.id, 'center')}
            >
              <FaAlignCenter size={13} />
            </button>
            <button
              type="button"
              className={`sites-float-icon-btn${align === 'right' ? ' active' : ''}`}
              title="Align right"
              aria-label="Align right"
              onClick={() => setAlign(section.id, 'right')}
            >
              <FaAlignRight size={13} />
            </button>
          </div>
          <select
            className="sites-float-select"
            value={String(liveWidth)}
            aria-label="Block width"
            onChange={(e) => setWidth(section.id, Number(e.target.value))}
          >
            <option value="50">50%</option>
            <option value="75">75%</option>
            <option value="100">100%</option>
          </select>
          {hasFixedHeight ? (
            <button
              type="button"
              className="sites-float-icon-btn"
              title="Reset height to auto"
              aria-label="Reset height to auto"
              onClick={() => resetHeight(section.id)}
            >
              <FiRefreshCw size={14} />
            </button>
          ) : null}
        </>
      )}

      {sectionSupportsQuickMedia(section.type) && (
        <button
          type="button"
          className="sites-float-icon-btn"
          title={sectionSupportsMultiMedia(section.type) ? 'Add images' : 'Change image'}
          aria-label={sectionSupportsMultiMedia(section.type) ? 'Add images' : 'Change image'}
          onClick={() => {
            const isMulti = sectionSupportsMultiMedia(section.type);
            openMediaPicker({
              storeId,
              assetKey: `${section.id}-quick`,
              title: isMulti ? 'Add carousel images' : 'Choose image',
              multiple: isMulti,
              onSelect: isMulti
                ? undefined
                : (url) => {
                    const patch = applyMediaUrlToSection(section, url);
                    if (patch) onUpdateSection(section.id, patch);
                  },
              onSelectMultiple: isMulti
                ? (urls) => {
                    const patch = applyMediaUrlsToSection(section, urls);
                    if (patch) onUpdateSection(section.id, patch);
                  }
                : undefined,
            });
          }}
        >
          <FiImage size={15} />
        </button>
      )}

      <button
        type="button"
        className="sites-float-icon-btn"
        title="Duplicate block"
        aria-label="Duplicate block"
        onClick={() => onDuplicateSection(section.id)}
      >
        <FiCopy size={15} />
      </button>
      <button
        type="button"
        className="sites-float-icon-btn sites-float-icon-btn--danger"
        title="Delete block"
        aria-label="Delete block"
        onClick={() => onRemoveSection(section.id)}
      >
        <FiTrash2 size={15} />
      </button>

      {showFormat ? (
        <>
          <ToolbarDivider />
          <BuilderInlineFormatControls />
        </>
      ) : null}
    </div>
  );
}
