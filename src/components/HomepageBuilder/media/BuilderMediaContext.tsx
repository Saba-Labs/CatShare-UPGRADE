import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { uploadProductImageToR2 } from '../../../services/r2Upload';
import {
  addToBuilderMediaLibrary,
  getMergedBuilderMediaLibrary,
  loadBuilderMediaLibrary,
  removeFromBuilderMediaLibrary,
  syncBuilderMediaLibraryFromLayout,
  BuilderMediaItem,
} from '../../../services/builderMediaLibrary';
import type { HomepageLayout } from '../../../types/homepage';
import MediaPickerModal from './MediaPickerModal';

export interface MediaPickRequest {
  storeId: string;
  assetKey: string;
  title?: string;
  /** When true, user can select multiple library images and upload several at once */
  multiple?: boolean;
  /** Required for single-select; optional when `multiple` and `onSelectMultiple` are set */
  onSelect?: (url: string) => void;
  onSelectMultiple?: (urls: string[]) => void;
}

interface BuilderMediaContextValue {
  library: BuilderMediaItem[];
  openMediaPicker: (request: MediaPickRequest) => void;
  uploadImage: (file: File, storeId: string, assetKey: string) => Promise<string>;
  refreshLibrary: (storeId: string) => void;
  removeFromLibrary: (storeId: string, id: string) => void;
}

const BuilderMediaContext = createContext<BuilderMediaContextValue | null>(null);

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

function librariesEqual(a: BuilderMediaItem[], b: BuilderMediaItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.id === b[i]?.id && item.url === b[i]?.url);
}

export function BuilderMediaProvider({
  storeId,
  layout,
  children,
}: {
  storeId: string;
  layout?: HomepageLayout | null;
  children: React.ReactNode;
}) {
  const [storedLibrary, setStoredLibrary] = useState<BuilderMediaItem[]>(() => {
    syncBuilderMediaLibraryFromLayout(storeId, layout);
    return loadBuilderMediaLibrary(storeId);
  });
  const [pickerRequest, setPickerRequest] = useState<MediaPickRequest | null>(null);

  useEffect(() => {
    const synced = syncBuilderMediaLibraryFromLayout(storeId, layout);
    setStoredLibrary((prev) => (librariesEqual(prev, synced) ? prev : synced));
  }, [storeId, layout]);

  const library = useMemo(
    () => getMergedBuilderMediaLibrary(storeId, layout),
    [storeId, layout, storedLibrary]
  );

  const refreshLibrary = useCallback((sid: string) => {
    setStoredLibrary(loadBuilderMediaLibrary(sid));
  }, []);

  const uploadImage = useCallback(async (file: File, sid: string, assetKey: string) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select an image file.');
    }
    const dataUrl = await readFileAsDataUrl(file);
    const productId = `homepage-${sid}-${assetKey}-${Date.now()}`;
    const uploaded = await uploadProductImageToR2({ productId, dataUrl });
    const next = addToBuilderMediaLibrary(sid, uploaded.url, file.name);
    setStoredLibrary(next);
    return uploaded.url;
  }, []);

  const openMediaPicker = useCallback((request: MediaPickRequest) => {
    syncBuilderMediaLibraryFromLayout(request.storeId, layout);
    refreshLibrary(request.storeId);
    setPickerRequest(request);
  }, [layout, refreshLibrary]);

  const removeFromLibrary = useCallback((sid: string, id: string) => {
    const next = removeFromBuilderMediaLibrary(sid, id);
    setStoredLibrary(next);
  }, []);

  const closePicker = useCallback(() => setPickerRequest(null), []);

  const handleSelect = useCallback(
    (url: string) => {
      if (pickerRequest) {
        addToBuilderMediaLibrary(pickerRequest.storeId, url);
        refreshLibrary(pickerRequest.storeId);
        pickerRequest.onSelect?.(url);
      }
      closePicker();
    },
    [pickerRequest, refreshLibrary, closePicker]
  );

  const handleSelectMultiple = useCallback(
    (urls: string[]) => {
      if (!pickerRequest || urls.length === 0) return;
      for (const url of urls) {
        addToBuilderMediaLibrary(pickerRequest.storeId, url);
      }
      refreshLibrary(pickerRequest.storeId);
      if (pickerRequest.onSelectMultiple) {
        pickerRequest.onSelectMultiple(urls);
      } else {
        urls.forEach((url) => pickerRequest.onSelect?.(url));
      }
      closePicker();
    },
    [pickerRequest, refreshLibrary, closePicker]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      if (!pickerRequest) throw new Error('No active picker');
      return uploadImage(file, pickerRequest.storeId, pickerRequest.assetKey);
    },
    [pickerRequest, uploadImage]
  );

  const value = useMemo(
    () => ({
      library,
      openMediaPicker,
      uploadImage,
      refreshLibrary,
      removeFromLibrary,
    }),
    [library, openMediaPicker, uploadImage, refreshLibrary, removeFromLibrary]
  );

  return (
    <BuilderMediaContext.Provider value={value}>
      {children}
      {pickerRequest && (
        <MediaPickerModal
          title={pickerRequest.title || (pickerRequest.multiple ? 'Choose images' : 'Choose image')}
          library={library}
          multiple={pickerRequest.multiple}
          onClose={closePicker}
          onSelect={handleSelect}
          onSelectMultiple={handleSelectMultiple}
          onUpload={handleUpload}
          onRemove={(id) => removeFromLibrary(pickerRequest.storeId, id)}
        />
      )}
    </BuilderMediaContext.Provider>
  );
}

export function useBuilderMedia(): BuilderMediaContextValue {
  const ctx = useContext(BuilderMediaContext);
  if (!ctx) {
    throw new Error('useBuilderMedia must be used within BuilderMediaProvider');
  }
  return ctx;
}

export function useBuilderMediaOptional(): BuilderMediaContextValue | null {
  return useContext(BuilderMediaContext);
}
