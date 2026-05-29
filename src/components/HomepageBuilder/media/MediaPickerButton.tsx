import React, { useState } from 'react';
import { useBuilderMedia } from './BuilderMediaContext';

interface MediaPickerButtonProps {
  storeId: string;
  assetKey: string;
  label?: string;
  currentUrl?: string;
  onUrl: (url: string) => void;
  /** Allow selecting multiple images at once (calls onUrls) */
  multiple?: boolean;
  onUrls?: (urls: string[]) => void;
  className?: string;
  showPreview?: boolean;
}

export default function MediaPickerButton({
  storeId,
  assetKey,
  label = 'Choose image',
  currentUrl,
  onUrl,
  multiple = false,
  onUrls,
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
            title: multiple ? label.replace(/image/i, 'images') : label,
            multiple,
            onSelect: multiple
              ? undefined
              : (url) => {
                  setPreviewUrl(url);
                  onUrl(url);
                },
            onSelectMultiple: multiple
              ? (urls) => {
                  if (urls[0]) {
                    setPreviewUrl(urls[0]);
                    onUrl(urls[0]);
                  }
                  onUrls?.(urls);
                }
              : undefined,
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
