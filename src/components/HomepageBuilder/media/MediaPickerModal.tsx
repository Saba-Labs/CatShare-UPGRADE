import React, { useRef, useState } from 'react';
import { BuilderMediaItem } from '../../../services/builderMediaLibrary';

interface MediaPickerModalProps {
  title: string;
  library: BuilderMediaItem[];
  onClose: () => void;
  onSelect: (url: string) => void;
  onUpload: (file: File) => Promise<void>;
  onRemove: (id: string) => void;
}

export default function MediaPickerModal({
  title,
  library,
  onClose,
  onSelect,
  onUpload,
  onRemove,
}: MediaPickerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setUploading(true);
      await onUpload(file);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
            {uploading ? 'Uploading…' : '+ Upload new image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <p className="media-picker-hint">JPG, PNG, or WebP. Images are stored for this store.</p>
          {error && <p className="media-picker-error">{error}</p>}
        </div>

        {library.length > 0 ? (
          <>
            <p className="media-picker-section-label">Recent uploads</p>
            <div className="media-picker-grid">
              {library.map((item) => (
                <div key={item.id} className="media-picker-item">
                  <button
                    type="button"
                    className="media-picker-thumb"
                    onClick={() => onSelect(item.url)}
                    title={item.name || 'Select image'}
                  >
                    <img src={item.url} alt="" loading="lazy" />
                  </button>
                  <button
                    type="button"
                    className="media-picker-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    title="Remove from library"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="media-picker-empty">No images yet. Upload one to get started.</p>
        )}
      </div>
    </div>
  );
}
