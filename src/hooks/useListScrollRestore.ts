import { useEffect, type RefObject } from 'react';

/** Read scroll from container, or window if the container is not the scroller yet. */
export function readListScrollY(scrollEl: HTMLElement | null): number {
  if (scrollEl) {
    const st = scrollEl.scrollTop;
    if (st > 0 || scrollEl.scrollHeight > scrollEl.clientHeight + 1) {
      return st;
    }
  }
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

export function persistListScroll(storageKey: string, scrollEl: HTMLElement | null) {
  localStorage.setItem(storageKey, String(readListScrollY(scrollEl)));
}

type UseListScrollRestoreOptions = {
  /** When false, skip (e.g. wrong route). */
  active: boolean;
  /** List row count — re-run when list updates after fetch. */
  contentLength: number;
  /** Optional second node to observe (e.g. inner list wrapper). */
  extraObserveSelector?: string;
};

/**
 * Restore exact scrollTop after returning from another screen (same pattern as products list).
 * Tears down ResizeObserver / load listeners when done so manual scroll is not overridden.
 */
export function useListScrollRestore(
  storageKey: string,
  scrollRef: RefObject<HTMLElement | null>,
  options: UseListScrollRestoreOptions
) {
  const { active, contentLength, extraObserveSelector } = options;

  useEffect(() => {
    if (!active) return;
    const raw = localStorage.getItem(storageKey);
    if (raw == null) return;
    const target = parseFloat(raw);
    if (Number.isNaN(target) || target < 0) {
      localStorage.removeItem(storageKey);
      return;
    }
    if (contentLength === 0) {
      localStorage.removeItem(storageKey);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const clearKey = () => {
      localStorage.removeItem(storageKey);
    };

    let ro: ResizeObserver | null = null;
    const node = scrollRef.current;

    const applyExactScroll = (): boolean => {
      if (cancelled) return true;
      const el = scrollRef.current;
      if (!el) return true;
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const y = Math.min(target, maxScroll);
      el.scrollTop = y;

      const reached = maxScroll + 0.5 >= target;
      const pinnedBottom = target > maxScroll && maxScroll > 0 && Math.abs(y - maxScroll) < 1.5;
      return reached || pinnedBottom;
    };

    const finishRestore = () => {
      if (cancelled) return;
      cancelled = true;
      ro?.disconnect();
      ro = null;
      node?.removeEventListener('load', onImgLoadCapture, true);
      timers.forEach(clearTimeout);
      timers.length = 0;
      clearKey();
    };

    const onImgLoadCapture = () => {
      if (cancelled) return;
      if (applyExactScroll()) finishRestore();
    };

    if (node) {
      node.addEventListener('load', onImgLoadCapture, true);
    }
    if (node && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (cancelled) return;
        if (applyExactScroll()) finishRestore();
      });
      ro.observe(node);
      if (extraObserveSelector) {
        try {
          const inner = node.querySelector(extraObserveSelector);
          if (inner) ro.observe(inner);
        } catch {
          /* ignore */
        }
      }
    }

    const tick = () => {
      if (cancelled) return true;
      if (applyExactScroll()) {
        finishRestore();
        return true;
      }
      return false;
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) tick();
      });
    });

    [0, 16, 50, 100, 200, 400, 700, 1200, 2000].forEach((ms) => {
      timers.push(
        setTimeout(() => {
          if (tick()) return;
        }, ms)
      );
    });

    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        applyExactScroll();
        finishRestore();
      }, 2800)
    );

    return () => {
      cancelled = true;
      ro?.disconnect();
      node?.removeEventListener('load', onImgLoadCapture, true);
      timers.forEach(clearTimeout);
    };
  }, [active, contentLength, storageKey, extraObserveSelector]);
}
