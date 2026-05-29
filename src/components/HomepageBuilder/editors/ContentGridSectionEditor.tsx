import { v4 as uuid } from 'uuid';
import type { ContentGridSection } from '../../../types/homepage';
import MediaPickerButton from '../media/MediaPickerButton';

interface ContentGridSectionEditorProps {
  section: ContentGridSection & { id: string };
  storeId: string;
  onUpdate: (updates: Partial<ContentGridSection>) => void;
}

export default function ContentGridSectionEditor({ section, storeId, onUpdate }: ContentGridSectionEditorProps) {
  const { settings, content } = section;
  const items = content.items || [];

  const updateItems = (next: ContentGridSection['content']['items']) => {
    onUpdate({ content: { items: next } });
  };

  const patchItem = (index: number, patch: Partial<ContentGridSection['content']['items'][number]>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    updateItems(next);
  };

  return (
    <>
      <div className="sidebar-field">
        <label className="panel-label">Grid title</label>
        <input
          type="text"
          className="panel-input"
          value={settings.title || ''}
          onChange={(e) => onUpdate({ settings: { ...settings, title: e.target.value } })}
        />
      </div>

      <div className="sidebar-field">
        <label className="panel-label">Columns</label>
        <select
          className="panel-select"
          value={String(settings.columns)}
          onChange={(e) =>
            onUpdate({
              settings: { ...settings, columns: parseInt(e.target.value, 10) as 2 | 3 | 4 },
            })
          }
        >
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </div>

      <div className="sidebar-field">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label className="panel-label" style={{ margin: 0 }}>
            Grid items ({items.length})
          </label>
          <button
            type="button"
            className="btn-text"
            onClick={() =>
              updateItems([
                ...items,
                {
                  id: uuid(),
                  imageUrl: '',
                  title: 'New item',
                  description: 'Short description',
                  link: '#',
                },
              ])
            }
          >
            + Add
          </button>
        </div>

        {items.length === 0 ? (
          <p className="sidebar-empty-hint">No items yet.</p>
        ) : (
          <div className="sidebar-list">
            {items.map((item, index) => (
              <div key={item.id} className="sidebar-list-item">
                <span className="sidebar-list-item__index">Item {index + 1}</span>
                <MediaPickerButton
                  storeId={storeId}
                  assetKey={`${section.id}-grid-${item.id}`}
                  label="Image"
                  currentUrl={item.imageUrl}
                  onUrl={(url) => patchItem(index, { imageUrl: url })}
                />
                <input
                  type="text"
                  className="panel-input"
                  placeholder="Title"
                  value={item.title}
                  onChange={(e) => patchItem(index, { title: e.target.value })}
                />
                <textarea
                  className="panel-textarea"
                  rows={2}
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => patchItem(index, { description: e.target.value })}
                />
                <button
                  type="button"
                  className="btn-text danger"
                  style={{ alignSelf: 'flex-end' }}
                  onClick={() => updateItems(items.filter((i) => i.id !== item.id))}
                >
                  Remove item
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
