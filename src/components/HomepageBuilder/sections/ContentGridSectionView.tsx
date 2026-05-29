import type { ContentGridSection } from '../../../types/homepage';
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
  const paddingValue =
    settings.padding === 'small' ? '1.5rem' : settings.padding === 'large' ? '3rem' : '2rem';
  const gapValue = settings.gap === 'small' ? '1rem' : settings.gap === 'large' ? '2rem' : '1.5rem';

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

  return (
    <div
      className="content-grid-section"
      style={{
        backgroundColor: settings.backgroundColor,
        padding: paddingValue,
      }}
    >
      {settings.title && <h2 className="grid-title">{settings.title}</h2>}

      <div
        className="grid-container"
        style={{
          gridTemplateColumns: `repeat(${settings.columns}, 1fr)`,
          gap: gapValue,
        }}
      >
        {content.items.map((item) => (
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
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
