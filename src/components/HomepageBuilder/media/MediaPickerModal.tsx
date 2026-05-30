import MediaLibraryGrid from './MediaLibraryGrid';
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
  return (
    <div className="media-picker-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="media-picker-modal">
        <header className="media-picker-header">
          <h3>{title}</h3>
          <button type="button" className="media-picker-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <MediaLibraryGrid
          library={library}
          mode={multiple ? 'pick-multiple' : 'pick-single'}
          onSelect={onSelect}
          onSelectMultiple={onSelectMultiple}
          onUpload={onUpload}
          onRemove={onRemove}
          onCancel={multiple ? onClose : undefined}
        />
      </div>
    </div>
  );
}
