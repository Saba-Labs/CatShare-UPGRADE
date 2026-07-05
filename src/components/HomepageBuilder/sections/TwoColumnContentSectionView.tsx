import React from 'react';
import { TwoColumnContentSection } from '../../../types/homepage';
import BuilderInlineEditable from '../BuilderInlineEditable';
import BuilderHtmlContent from '../BuilderHtmlContent';
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
          <BuilderInlineEditable
            tag="h3"
            value={columnContent.title}
            onChange={(title) => updateColumn(side, { title })}
            onPointerDown={stopEditPointer}
            onMouseDown={stopEditPointer}
            onClick={stopEditPointer}
          />
          <BuilderInlineEditable
            tag="p"
            value={columnContent.description}
            onChange={(description) => updateColumn(side, { description })}
            onPointerDown={stopEditPointer}
            onMouseDown={stopEditPointer}
            onClick={stopEditPointer}
          />
        </>
      ) : (
        <>
          <h3>
            <BuilderHtmlContent html={columnContent.title} tag="span" />
          </h3>
          <p>
            <BuilderHtmlContent html={columnContent.description} tag="span" />
          </p>
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
