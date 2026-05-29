import { useRef, useState } from 'react';
import { BuilderMediaItem } from '../../../services/builderMediaLibrary';

interface MediaPickerModalProps {
  title: string;
  library: BuilderMediaItem[];
  multiple?: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  onSelectMultiple?: (urls: string[]) => void;
  onUpload: (file: File) => Promise<string>;
  onRemove: (id: string) => void;
}

export default function MediaPickerModal({
  title,
  library,
  multiple = false,
  onClose,
  onSelect,
  onSelectMultiple,
  onUpload,
  onRemove,
}: MediaPickerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);

  const toggleUrl = (url: string) => {
    setSelectedUrls((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  };

  const handleThumbClick = (url: string) => {
    if (multiple) {
      toggleUrl(url);
      return;
    }
    onSelect(url);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setError('Please select image files (JPG, PNG, or WebP).');
      return;
    }

    try {
      setUploading(true);
      const uploaded: string[] = [];
      for (const file of imageFiles) {
        const url = await onUpload(file);
        uploaded.push(url);
      }
      if (multiple) {
        setSelectedUrls((prev) => {
          const next = [...prev];
          for (const url of uploaded) {
            if (!next.includes(url)) next.push(url);
          }
          return next;
        });
      } else if (uploaded[0]) {
        onSelect(uploaded[0]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmMultiple = () => {
    if (selectedUrls.length === 0) return;
    onSelectMultiple?.(selectedUrls);
  };

  return (
    <div className="media-picker-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="media-picker-modal">
        <header className="media-picker-header">
          <h3>{title}</h3>
          <button type="button" className="media-picker-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="media-picker-upload-zone">
          <button
            type="button"
            className="btn-secondary media-picker-upload-btn"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading
              ? 'Uploading…'
              : multiple
                ? '+ Upload images'
                : '+ Upload new image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={multiple}
            hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <p className="media-picker-hint">
            {multiple
              ? 'Select multiple from your library or upload several at once (JPG, PNG, WebP).'
              : 'JPG, PNG, or WebP. Images are stored for this store.'}
          </p>
          {error && <p className="media-picker-error">{error}</p>}
        </div>

        {library.length > 0 ? (
          <>
            <p className="media-picker-section-label">
              {multiple ? 'Click images to select' : 'Recent uploads'}
            </p>
            <div className="media-picker-grid">
              {library.map((item) => {
                const isSelected = multiple && selectedUrls.includes(item.url);
                return (
                  <div key={item.id} className="media-picker-item">
                    <button
                      type="button"
                      className={`media-picker-thumb${isSelected ? ' media-picker-thumb--selected' : ''}`}
                      onClick={() => handleThumbClick(item.url)}
                      title={multiple ? (isSelected ? 'Deselect' : 'Select image') : item.name || 'Select image'}
                    >
                      <img src={item.url} alt="" loading="lazy" />
                      {multiple && isSelected ? (
                        <span className="media-picker-check" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="media-picker-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.id);
                        setSelectedUrls((prev) => prev.filter((u) => u !== item.url));
                      }}
                      title="Remove from library"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="media-picker-empty">No images yet. Upload one to get started.</p>
        )}

        {multiple ? (
          <footer className="media-picker-footer">
            <button type="button" className="btn-text" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={selectedUrls.length === 0}
              onClick={confirmMultiple}
            >
              Add {selectedUrls.length > 0 ? `${selectedUrls.length} ` : ''}
              image{selectedUrls.length === 1 ? '' : 's'}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
