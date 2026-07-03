import React, { useCallback, useEffect, useRef } from 'react';
import { TwoColumnContentSection } from '../../../types/homepage';
import './TwoColumnContent.css';

type ColumnContent = TwoColumnContentSection['content']['leftContent'];
type ColumnSide = 'leftContent' | 'rightContent';

interface TwoColumnContentSectionViewProps {
  section: TwoColumnContentSection & { id: string };
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<TwoColumnContentSection>) => void;
}

function stopEditPointer(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation();
}

interface EditableFieldProps {
  tag: 'h3' | 'p';
  value: string;
  onCommit: (value: string) => void;
}

function EditableColumnField({ tag: Tag, value, onCommit }: EditableFieldProps) {
  const ref = useRef<HTMLElement>(null);
  const isFocusedRef = useRef(false);

  const syncDomFromProp = useCallback(() => {
    const el = ref.current;
    if (!el || isFocusedRef.current) return;
    const next = value || '';
    if (el.textContent !== next) {
      el.textContent = next;
    }
  }, [value]);

  useEffect(() => {
    syncDomFromProp();
  }, [syncDomFromProp]);

  const commit = (next: string) => {
    if (next === value) return;
    onCommit(next);
  };

  return (
    <Tag
      ref={ref as never}
      className="sites-inline-editable"
      contentEditable
      suppressContentEditableWarning
      onPointerDown={stopEditPointer}
      onMouseDown={stopEditPointer}
      onClick={stopEditPointer}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={(e) => {
        isFocusedRef.current = false;
        commit(e.currentTarget.textContent || '');
      }}
    />
  );
}

export default function TwoColumnContentSectionView({
  section,
  editMode,
  onUpdateSection,
}: TwoColumnContentSectionViewProps) {
  const { settings, content } = section;
  const canInlineEdit = editMode && !!onUpdateSection;

  const updateColumn = (side: ColumnSide, patch: Partial<ColumnContent>) => {
    if (!onUpdateSection) return;
    const existing = content[side];
    const hasChange = (Object.keys(patch) as Array<keyof typeof patch>).some(
      (key) => (existing[key] ?? '') !== (patch[key] ?? '')
    );
    if (!hasChange) return;
    onUpdateSection({
      content: {
        ...content,
        [side]: { ...existing, ...patch },
      },
    });
  };

  const renderColumn = (columnContent: ColumnContent, side: ColumnSide) => (
    <div className="column">
      {columnContent.imageUrl && (
        <div className="column-image">
          <img src={columnContent.imageUrl} alt={columnContent.title} />
        </div>
      )}
      {canInlineEdit ? (
        <>
          <EditableColumnField
            tag="h3"
            value={columnContent.title}
            onCommit={(title) => updateColumn(side, { title })}
          />
          <EditableColumnField
            tag="p"
            value={columnContent.description}
            onCommit={(description) => updateColumn(side, { description })}
          />
        </>
      ) : (
        <>
          <h3>{columnContent.title}</h3>
          <p>{columnContent.description}</p>
        </>
      )}
    </div>
  );

  return (
    <div
      className={`two-column-section sites-section-pad--${settings.padding === 'small' ? 'small' : settings.padding === 'large' ? 'large' : 'medium'}`}
      style={{
        backgroundColor: settings.backgroundColor,
      }}
    >
      <div className={`two-column-container two-column-container--gap-${settings.gap}`}>
        {renderColumn(content.leftContent, 'leftContent')}
        {renderColumn(content.rightContent, 'rightContent')}
      </div>
    </div>
  );
}
