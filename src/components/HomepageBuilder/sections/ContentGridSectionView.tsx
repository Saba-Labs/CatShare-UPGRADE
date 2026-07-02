import type { ContentGridSection } from '../../../types/homepage';
import { commitInlineText } from '../../../utils/builderEditGuards';
import { useBuilderMediaOptional } from '../media/BuilderMediaContext';
import './ContentGrid.css';
interface ContentGridSectionViewProps {
  section: ContentGridSection & { id: string };
  storeId?: string;
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<ContentGridSection>) => void;
}

export default function ContentGridSectionView({
  section,
  storeId,
  editMode,
  onUpdateSection,
}: ContentGridSectionViewProps) {
  const { settings, content } = section;
  const media = useBuilderMediaOptional();

  const openItemImagePicker = (itemId: string) => {
    if (!media || !storeId || !onUpdateSection) return;
    media.openMediaPicker({
      storeId,
      assetKey: `${section.id}-grid-${itemId}`,
      title: 'Choose image',
      onSelect: (url) => {
        const items = content.items.map((item) => (item.id === itemId ? { ...item, imageUrl: url } : item));
        onUpdateSection({ content: { items } });
      },
    });
  };

  const stopEditPointer = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
  };

  const updateSectionTitle = (title: string) => {
    if (!onUpdateSection) return;
    commitInlineText(settings.title, title, (next) => {
      onUpdateSection({
        settings: {
          ...settings,
          title: next,
        },
      });
    });
  };

  const updateItem = (itemId: string, patch: Partial<(typeof content.items)[number]>) => {
    if (!onUpdateSection) return;
    const existing = content.items.find((item) => item.id === itemId);
    if (!existing) return;
    const hasChange = (Object.keys(patch) as Array<keyof typeof patch>).some(
      (key) => (existing[key] ?? '') !== (patch[key] ?? '')
    );
    if (!hasChange) return;
    const items = content.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
    onUpdateSection({ content: { items } });
  };
  return (
    <div
      className={`content-grid-section sites-section-pad--${settings.padding}`}
      style={{
        backgroundColor: settings.backgroundColor,
      }}
    >
      {settings.title ? (
        editMode && onUpdateSection ? (
          <h2
            className="grid-title sites-inline-editable"
            contentEditable
            suppressContentEditableWarning
            onMouseDown={stopEditPointer}
            onPointerDown={stopEditPointer}
            onClick={stopEditPointer}
            onBlur={(e) => updateSectionTitle(e.currentTarget.textContent || '')}
          >            {settings.title}
          </h2>
        ) : (
          <h2 className="grid-title">{settings.title}</h2>
        )
      ) : null}

      <div
        className={`content-grid__track content-grid__track--gap-${settings.gap}`}
        style={{
          ['--grid-cols' as string]: settings.columns,
        }}
      >        {content.items.map((item) => (
          <div key={item.id} className="grid-item">
            <div className="grid-item-image">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  style={{ cursor: editMode && media ? 'pointer' : undefined }}
                  onClick={editMode && media ? () => openItemImagePicker(item.id) : undefined}
                  title={editMode ? 'Click to change image' : undefined}
                />
              ) : (
                <button
                  type="button"
                  className="image-placeholder image-placeholder--btn"
                  disabled={!editMode || !media}
                  onClick={editMode ? () => openItemImagePicker(item.id) : undefined}
                >
                  {editMode ? '+ Add image' : 'Image'}
                </button>
              )}
            </div>
            <div className="grid-item-content">
              {editMode && onUpdateSection ? (
                <>
                  <h3
                    className="sites-inline-editable"
                    contentEditable
                    suppressContentEditableWarning
                    onMouseDown={stopEditPointer}
                    onPointerDown={stopEditPointer}
                    onClick={stopEditPointer}
                    onBlur={(e) => updateItem(item.id, { title: e.currentTarget.textContent || '' })}
                  >
                    {item.title}
                  </h3>
                  <p
                    className="sites-inline-editable"
                    contentEditable
                    suppressContentEditableWarning
                    onMouseDown={stopEditPointer}
                    onPointerDown={stopEditPointer}
                    onClick={stopEditPointer}
                    onBlur={(e) => updateItem(item.id, { description: e.currentTarget.textContent || '' })}
                  >                    {item.description}
                  </p>
                </>
              ) : (
                <>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
