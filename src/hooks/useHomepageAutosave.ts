import { useEffect, useRef, useCallback } from 'react';
import { HomepageLayout } from '../types/homepage';
import { autoSaveHomepage } from '../services/homepageService';

interface UseHomepageAutosaveProps {
  configId: string;
  layout: HomepageLayout;
  isDirty: boolean;
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
}

export function useHomepageAutosave({
  configId,
  layout,
  isDirty,
  debounceMs = 2000,
  onSaveStart,
  onSaveComplete,
  onSaveError,
}: UseHomepageAutosaveProps) {
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  const lastSavedRef = useRef<string>('');

  const save = useCallback(async () => {
    try {
      onSaveStart?.();

      const layoutStr = JSON.stringify(layout);
      if (layoutStr === lastSavedRef.current) {
        onSaveComplete?.();
        return;
      }

      await autoSaveHomepage(configId, layout);
      lastSavedRef.current = layoutStr;
      onSaveComplete?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onSaveError?.(err);
    }
  }, [configId, layout, onSaveStart, onSaveComplete, onSaveError]);

  useEffect(() => {
    if (!isDirty) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      save();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isDirty, layout, debounceMs, save]);

  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    return save();
  }, [save]);

  return { saveNow };
}
