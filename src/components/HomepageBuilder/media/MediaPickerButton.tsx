import React, { useState } from 'react';
import { useBuilderMedia } from './BuilderMediaContext';

interface MediaPickerButtonProps {
  storeId: string;
  assetKey: string;
  label?: string;
  currentUrl?: string;
  onUrl: (url: string) => void;
  className?: string;
  showPreview?: boolean;
}

export default function MediaPickerButton({
  storeId,
  assetKey,
  label = 'Choose image',
  currentUrl,
  onUrl,
  className = 'btn-secondary',
  showPreview = true,
}: MediaPickerButtonProps) {
  const { openMediaPicker } = useBuilderMedia();
  const [previewUrl, setPreviewUrl] = useState(currentUrl);

  React.useEffect(() => {
    setPreviewUrl(currentUrl);
  }, [currentUrl]);

  return (
    <div className="media-picker-field">
      <button
        type="button"
        className={className}
        style={{ width: '100%' }}
        onClick={() =>
          openMediaPicker({
            storeId,
            assetKey,
            title: label,
            onSelect: (url) => {
              setPreviewUrl(url);
              onUrl(url);
            },
          })
        }
      >
        {previewUrl ? 'Change image' : label}
      </button>
      {showPreview && previewUrl ? (
        <div className="media-picker-field-preview">
          <img src={previewUrl} alt="" />
        </div>
      ) : null}
    </div>
  );
}
