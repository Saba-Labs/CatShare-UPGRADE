import { useEffect, useRef, useCallback } from 'react';
import { HomepageLayout } from '../types/homepage';
import { autoSaveHomepage } from '../services/homepageService';
import { isPersistedHomepageConfigId } from '../utils/homepageConfigId';

interface UseHomepageAutosaveProps {
  configId: string;
  layout: HomepageLayout;
  isDirty: boolean;
  /** When false, skips autosave (e.g. config not created in DB yet). */
  enabled?: boolean;
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
}

export function useHomepageAutosave({
  configId,
  layout,
  isDirty,
  enabled = true,
  debounceMs = 2000,
  onSaveStart,
  onSaveComplete,
  onSaveError,
}: UseHomepageAutosaveProps) {
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  const lastSavedRef = useRef<string>('');

  const save = useCallback(async () => {
    if (!enabled || !isPersistedHomepageConfigId(configId)) {
      return;
    }
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
  }, [configId, layout, enabled, onSaveStart, onSaveComplete, onSaveError]);

  useEffect(() => {
    if (!enabled || !isDirty) return;

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
  }, [enabled, isDirty, layout, debounceMs, save]);

  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    return save();
  }, [save]);

  return { saveNow };
}
