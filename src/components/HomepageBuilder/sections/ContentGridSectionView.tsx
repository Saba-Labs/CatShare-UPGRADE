import type { ContentGridSection } from '../../../types/homepage';
import { commitInlineText } from '../../../utils/builderEditGuards';
import BuilderInlineEditable from '../BuilderInlineEditable';
import BuilderHtmlContent from '../BuilderHtmlContent';
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
          <BuilderInlineEditable
            tag="h2"
            className="grid-title"
            value={settings.title}
            onChange={updateSectionTitle}
            onMouseDown={stopEditPointer}
            onPointerDown={stopEditPointer}
            onClick={stopEditPointer}
          />
        ) : (
          <h2 className="grid-title">
            <BuilderHtmlContent html={settings.title} tag="span" />
          </h2>
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
                  <BuilderInlineEditable
                    tag="h3"
                    value={item.title}
                    onChange={(title) => updateItem(item.id, { title })}
                    onMouseDown={stopEditPointer}
                    onPointerDown={stopEditPointer}
                    onClick={stopEditPointer}
                  />
                  <BuilderInlineEditable
                    tag="p"
                    value={item.description}
                    onChange={(description) => updateItem(item.id, { description })}
                    onMouseDown={stopEditPointer}
                    onPointerDown={stopEditPointer}
                    onClick={stopEditPointer}
                  />
                </>
              ) : (
                <>
                  <h3>
                    <BuilderHtmlContent html={item.title} tag="span" />
                  </h3>
                  <p>
                    <BuilderHtmlContent html={item.description} tag="span" />
                  </p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
