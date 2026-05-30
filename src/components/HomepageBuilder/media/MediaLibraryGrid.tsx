import { useCallback, useRef, useState } from 'react';
import { FiCopy, FiPlus, FiTrash2 } from 'react-icons/fi';
import type { BuilderMediaItem } from '../../../services/builderMediaLibrary';

export type MediaLibraryGridMode = 'pick-single' | 'pick-multiple' | 'manage';
export type MediaLibraryGridAppearance = 'default' | 'gallery';

interface MediaLibraryGridProps {
  library: BuilderMediaItem[];
  mode: MediaLibraryGridMode;
  appearance?: MediaLibraryGridAppearance;
  uploadLabel?: string;
  onSelect?: (url: string) => void;
  onSelectMultiple?: (urls: string[]) => void;
  onUpload: (file: File) => Promise<string>;
  onRemove: (id: string) => void;
  onCopyUrl?: (url: string) => void;
  onCancel?: () => void;
}

function UploadSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`media-gallery-spinner media-gallery-spinner--${size}`} aria-hidden />;
}

export default function MediaLibraryGrid({
  library,
  mode,
  appearance = 'default',
  uploadLabel,
  onSelect,
  onSelectMultiple,
  onUpload,
  onRemove,
  onCopyUrl,
  onCancel,
}: MediaLibraryGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [pendingSlots, setPendingSlots] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const multiple = mode === 'pick-multiple';
  const manage = mode === 'manage';
  const gallery = appearance === 'gallery';

  const toggleUrl = (url: string) => {
    setSelectedUrls((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  };

  const handleThumbClick = (url: string) => {
    if (manage) {
      onCopyUrl?.(url);
      return;
    }
    if (multiple) {
      toggleUrl(url);
      return;
    }
    onSelect?.(url);
  };

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      setError(null);
      const imageFiles = list.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        setError(gallery ? 'Images only' : 'Please select image files (JPG, PNG, or WebP).');
        return;
      }

      try {
        setUploading(true);
        setUploadProgress({ done: 0, total: imageFiles.length });
        if (gallery) setPendingSlots(imageFiles.length);

        const uploaded: string[] = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const url = await onUpload(imageFiles[i]);
          uploaded.push(url);
          setUploadProgress({ done: i + 1, total: imageFiles.length });
          if (gallery) setPendingSlots((n) => Math.max(0, n - 1));
        }

        if (multiple) {
          setSelectedUrls((prev) => {
            const next = [...prev];
            for (const url of uploaded) {
              if (!next.includes(url)) next.push(url);
            }
            return next;
          });
        } else if (uploaded[0] && !manage) {
          onSelect?.(uploaded[0]);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        if (gallery) setPendingSlots(0);
      } finally {
        setUploading(false);
        setUploadProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [gallery, manage, multiple, onSelect, onUpload]
  );

  const handleFiles = (files: FileList | null) => void processFiles(files || []);

  const confirmMultiple = () => {
    if (selectedUrls.length === 0) return;
    onSelectMultiple?.(selectedUrls);
  };

  const defaultUploadLabel = multiple ? '+ Upload images' : '+ Upload new image';

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    void processFiles(e.dataTransfer.files);
  };

  const uploadZone = gallery ? (
    <div
      ref={dropRef}
      className={`media-gallery-upload${dragOver ? ' media-gallery-upload--drag' : ''}${uploading ? ' media-gallery-upload--busy' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!dropRef.current?.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <button
        type="button"
        className="media-gallery-upload__cta"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        aria-busy={uploading}
      >
        {uploading ? (
          <>
            <UploadSpinner size="sm" />
            <span className="media-gallery-upload__cta-text">
              {uploadProgress
                ? `Uploading ${uploadProgress.done}/${uploadProgress.total}`
                : 'Uploading…'}
            </span>
          </>
        ) : (
          <>
            <span className="media-gallery-upload__cta-icon" aria-hidden>
              <FiPlus />
            </span>
            <span className="media-gallery-upload__cta-text">Add photos</span>
          </>
        )}
      </button>
      {!uploading ? <span className="media-gallery-upload__hint">or drop files</span> : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error ? <p className="media-gallery-upload__error">{error}</p> : null}
    </div>
  ) : (
    <div className="media-picker-upload-zone">
      <button
        type="button"
        className="btn-secondary media-picker-upload-btn"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        aria-busy={uploading}
      >
        {uploading ? (
          <span className="media-picker-upload-btn__busy">
            <UploadSpinner size="sm" />
            {uploadProgress ? `${uploadProgress.done}/${uploadProgress.total}` : 'Uploading…'}
          </span>
        ) : (
          uploadLabel || defaultUploadLabel
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple || manage}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {!gallery && (
        <p className="media-picker-hint">
          {multiple
            ? 'Select multiple from your library or upload several at once (JPG, PNG, WebP).'
            : 'JPG, PNG, or WebP. Images are stored for this store.'}
        </p>
      )}
      {error && <p className="media-picker-error">{error}</p>}
    </div>
  );

  const pendingTiles =
    gallery && pendingSlots > 0
      ? Array.from({ length: pendingSlots }, (_, i) => (
          <div key={`pending-${i}`} className="media-gallery-tile media-gallery-tile--pending">
            <UploadSpinner size="md" />
          </div>
        ))
      : null;

  const gridClass = gallery ? 'media-gallery-grid' : 'media-picker-grid';
  const itemClass = gallery ? 'media-gallery-tile' : 'media-picker-item';

  return (
    <>
      {uploadZone}

      {library.length > 0 || pendingTiles ? (
        <>
          {!gallery && (
            <p className="media-picker-section-label">
              {multiple ? 'Click images to select' : 'Your library'}
            </p>
          )}
          <div className={gridClass}>
            {pendingTiles}
            {library.map((item) => {
              const isSelected = multiple && selectedUrls.includes(item.url);
              const canRemove = Boolean(item.addedAt);

              if (gallery) {
                return (
                  <div key={item.id} className={itemClass}>
                    <button
                      type="button"
                      className="media-gallery-tile__thumb"
                      onClick={() => handleThumbClick(item.url)}
                      title="Copy URL"
                    >
                      <img src={item.url} alt="" loading="lazy" />
                      <span className="media-gallery-tile__overlay">
                        <FiCopy aria-hidden />
                      </span>
                    </button>
                    {canRemove ? (
                      <button
                        type="button"
                        className="media-gallery-tile__remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(item.id);
                          setSelectedUrls((prev) => prev.filter((u) => u !== item.url));
                        }}
                        aria-label="Remove"
                      >
                        <FiTrash2 aria-hidden />
                      </button>
                    ) : null}
                  </div>
                );
              }

              return (
                <div key={item.id} className={itemClass}>
                  <button
                    type="button"
                    className={`media-picker-thumb${isSelected ? ' media-picker-thumb--selected' : ''}`}
                    onClick={() => handleThumbClick(item.url)}
                    title={item.name || 'Select image'}
                  >
                    <img src={item.url} alt="" loading="lazy" />
                    {multiple && isSelected ? (
                      <span className="media-picker-check" aria-hidden>
                        ✓
                      </span>
                    ) : null}
                  </button>
                  {canRemove ? (
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
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : !gallery ? (
        <p className="media-picker-empty">No images yet. Upload one to get started.</p>
      ) : null}

      {multiple ? (
        <footer className="media-picker-footer">
          {onCancel ? (
            <button type="button" className="btn-text" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
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
    </>
  );
}
