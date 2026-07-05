import { useCallback, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

interface FixedToolbarPosition {
  top: number;
  left: number;
}

interface UseDraggableFloatingToolbarResult {
  toolbarRef: React.RefObject<HTMLDivElement>;
  isUserPositioned: boolean;
  style: CSSProperties | undefined;
  onDragHandlePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  resetPosition: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export function useDraggableFloatingToolbar(): UseDraggableFloatingToolbarResult {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<FixedToolbarPosition | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originTop: number;
    originLeft: number;
  } | null>(null);

  const resetPosition = useCallback(() => {
    setPosition(null);
  }, []);

  const onDragHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const toolbar = toolbarRef.current;
      if (!toolbar) return;

      const toolbarRect = toolbar.getBoundingClientRect();
      const originTop = position?.top ?? toolbarRect.top;
      const originLeft = position?.left ?? toolbarRect.left;

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originTop,
        originLeft,
      };

      event.currentTarget.setPointerCapture(event.pointerId);

      const onPointerMove = (ev: PointerEvent) => {
        const drag = dragStateRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;

        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        const width = toolbar.offsetWidth;
        const height = toolbar.offsetHeight;
        const canvas = toolbar.closest('.sites-canvas')?.getBoundingClientRect();
        const padding = 8;

        let nextLeft = drag.originLeft + dx;
        let nextTop = drag.originTop + dy;

        if (canvas) {
          nextLeft = clamp(nextLeft, canvas.left + padding, canvas.right - width - padding);
          nextTop = clamp(nextTop, canvas.top + padding, canvas.bottom - height - padding);
        }

        setPosition({ top: nextTop, left: nextLeft });
      };

      const endDrag = (ev: PointerEvent) => {
        const drag = dragStateRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        dragStateRef.current = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', endDrag);
        window.removeEventListener('pointercancel', endDrag);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
    },
    [position]
  );

  const style: CSSProperties | undefined = position
    ? {
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'none',
        zIndex: 5000,
      }
    : undefined;

  return {
    toolbarRef,
    isUserPositioned: position !== null,
    style,
    onDragHandlePointerDown,
    resetPosition,
  };
}
