import { useCallback, useState } from 'react';
import { FiCheck } from 'react-icons/fi';
import { useBuilderMedia } from './BuilderMediaContext';
import MediaLibraryGrid from './MediaLibraryGrid';

interface MediaLibraryPanelProps {
  storeId: string;
}

export default function MediaLibraryPanel({ storeId }: MediaLibraryPanelProps) {
  const { library, uploadImage, removeFromLibrary, refreshLibrary } = useBuilderMedia();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const imageCountLabel =
    library.length === 1 ? '1 image' : `${library.length} images`;

  const handleUpload = useCallback(
    async (file: File) => uploadImage(file, storeId, 'gallery'),
    [uploadImage, storeId]
  );

  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl((prev) => (prev === url ? null : prev)), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      removeFromLibrary(storeId, id);
      refreshLibrary(storeId);
    },
    [removeFromLibrary, refreshLibrary, storeId]
  );

  return (
    <div className="sidebar-panel media-library-panel">
      <h3 className="media-library-panel__title">
        Photos
        <span className="media-library-panel__count">{imageCountLabel}</span>
      </h3>

      {copiedUrl ? (
        <div className="media-library-toast" role="status">
          <FiCheck aria-hidden />
          <span>Copied</span>
        </div>
      ) : null}

      <MediaLibraryGrid
        library={library}
        mode="manage"
        appearance="gallery"
        onUpload={handleUpload}
        onRemove={handleRemove}
        onCopyUrl={(url) => void handleCopyUrl(url)}
      />
    </div>
  );
}
