import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { wrapEditableInlineStyle } from '../../utils/builderRichText';

type CommitHandler = () => void;

interface BuilderInlineEditContextValue {
  activeEl: HTMLElement | null;
  activeSectionId: string | null;
  isFormatActive: boolean;
  registerCommit: (el: HTMLElement, commit: CommitHandler) => () => void;
  runCommand: (command: string, value?: string) => void;
  applyFontSize: (size: string) => void;
  applyTextColor: (color: string) => void;
  saveSelection: () => void;
}

const BuilderInlineEditContext = createContext<BuilderInlineEditContextValue | null>(null);

function isFormatToolbarTarget(node: HTMLElement | null): boolean {
  return Boolean(
    node?.closest(
      '.sites-floating-toolbar, .sites-floating-drag-handle, .builder-inline-format-toolbar, .builder-format-toolbar, .builder-format-select, .builder-format-color'
    )
  );
}

export function BuilderInlineEditProvider({ children }: { children: ReactNode }) {
  const [activeEl, setActiveEl] = useState<HTMLElement | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const commitsRef = useRef(new Map<HTMLElement, CommitHandler>());
  const savedRangeRef = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const editable =
      node instanceof HTMLElement
        ? node.closest('.sites-inline-editable')
        : node.parentElement?.closest('.sites-inline-editable');
    if (!editable) return;
    savedRangeRef.current = range.cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const range = savedRangeRef.current;
    if (!range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const commitActive = useCallback(() => {
    if (!activeEl) return;
    commitsRef.current.get(activeEl)?.();
  }, [activeEl]);

  const runCommand = useCallback(
    (command: string, value?: string) => {
      if (!activeEl) return;
      activeEl.focus();
      restoreSelection();
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand(command, false, value);
      saveSelection();
      commitActive();
    },
    [activeEl, commitActive, restoreSelection, saveSelection]
  );

  const applyFontSize = useCallback(
    (size: string) => {
      if (!activeEl) return;
      activeEl.focus();
      restoreSelection();
      wrapEditableInlineStyle(activeEl, 'font-size', size);
      saveSelection();
      commitActive();
    },
    [activeEl, commitActive, restoreSelection, saveSelection]
  );

  const applyTextColor = useCallback(
    (color: string) => {
      if (!activeEl) return;
      activeEl.focus();
      restoreSelection();
      wrapEditableInlineStyle(activeEl, 'color', color);
      saveSelection();
      commitActive();
    },
    [activeEl, commitActive, restoreSelection, saveSelection]
  );

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.classList.contains('sites-inline-editable')) return;
      if (!target.closest('.sites-canvas')) return;
      setActiveEl(target);
      const block = target.closest('.sites-document-block');
      setActiveSectionId(block?.getAttribute('data-section-id') || null);
    };

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as HTMLElement | null;
      if (isFormatToolbarTarget(next)) return;
      setActiveEl(null);
      setActiveSectionId(null);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const registerCommit = useCallback((el: HTMLElement, commit: CommitHandler) => {
    commitsRef.current.set(el, commit);
    return () => {
      commitsRef.current.delete(el);
    };
  }, []);

  return (
    <BuilderInlineEditContext.Provider
      value={{
        activeEl,
        activeSectionId,
        isFormatActive: Boolean(activeEl),
        registerCommit,
        runCommand,
        applyFontSize,
        applyTextColor,
        saveSelection,
      }}
    >
      {children}
    </BuilderInlineEditContext.Provider>
  );
}

export function useBuilderInlineEdit() {
  return useContext(BuilderInlineEditContext);
}
