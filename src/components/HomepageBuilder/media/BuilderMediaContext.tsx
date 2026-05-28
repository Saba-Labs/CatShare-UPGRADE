import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { uploadProductImageToR2 } from '../../../services/r2Upload';
import {
  addToBuilderMediaLibrary,
  loadBuilderMediaLibrary,
  removeFromBuilderMediaLibrary,
  BuilderMediaItem,
} from '../../../services/builderMediaLibrary';
import MediaPickerModal from './MediaPickerModal';

export interface MediaPickRequest {
  storeId: string;
  assetKey: string;
  title?: string;
  onSelect: (url: string) => void;
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

export function BuilderMediaProvider({
  storeId,
  children,
}: {
  storeId: string;
  children: React.ReactNode;
}) {
  const [library, setLibrary] = useState<BuilderMediaItem[]>(() => loadBuilderMediaLibrary(storeId));
  const [pickerRequest, setPickerRequest] = useState<MediaPickRequest | null>(null);

  const refreshLibrary = useCallback((sid: string) => {
    setLibrary(loadBuilderMediaLibrary(sid));
  }, []);

  const uploadImage = useCallback(async (file: File, sid: string, assetKey: string) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select an image file.');
    }
    const dataUrl = await readFileAsDataUrl(file);
    const productId = `homepage-${sid}-${assetKey}`;
    const uploaded = await uploadProductImageToR2({ productId, dataUrl });
    const next = addToBuilderMediaLibrary(sid, uploaded.url, file.name);
    setLibrary(next);
    return uploaded.url;
  }, []);

  const openMediaPicker = useCallback((request: MediaPickRequest) => {
    refreshLibrary(request.storeId);
    setPickerRequest(request);
  }, [refreshLibrary]);

  const removeFromLibrary = useCallback((sid: string, id: string) => {
    const next = removeFromBuilderMediaLibrary(sid, id);
    setLibrary(next);
  }, []);

  const handleSelect = useCallback(
    (url: string) => {
      if (pickerRequest) {
        addToBuilderMediaLibrary(pickerRequest.storeId, url);
        refreshLibrary(pickerRequest.storeId);
        pickerRequest.onSelect(url);
      }
      setPickerRequest(null);
    },
    [pickerRequest, refreshLibrary]
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
          title={pickerRequest.title || 'Choose image'}
          library={library}
          onClose={() => setPickerRequest(null)}
          onSelect={handleSelect}
          onUpload={async (file) => {
            const url = await uploadImage(file, pickerRequest.storeId, pickerRequest.assetKey);
            handleSelect(url);
          }}
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
