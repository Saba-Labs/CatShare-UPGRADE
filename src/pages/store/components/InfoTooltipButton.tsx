import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FiInfo } from 'react-icons/fi';

const VIEWPORT_PADDING = 12;
const GAP_BELOW_ICON = 8;
const TOOLTIP_MAX_WIDTH = 320;

interface InfoTooltipButtonProps {
  text: string;
  label?: string;
}

function computeTooltipStyle(buttonRect: DOMRect, tooltipWidth: number): CSSProperties {
  const maxWidth = Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
  const width = Math.min(Math.max(tooltipWidth, 1), maxWidth);
  const top = buttonRect.bottom + GAP_BELOW_ICON;
  const viewportRight = window.innerWidth - VIEWPORT_PADDING;

  let left = buttonRect.left + buttonRect.width / 2 - width / 2;
  if (left < VIEWPORT_PADDING) {
    left = VIEWPORT_PADDING;
  } else if (left + width > viewportRight) {
    left = viewportRight - width;
  }

  return {
    position: 'fixed',
    left,
    top,
    width,
    zIndex: 9999,
    maxWidth,
  };
}

export default function InfoTooltipButton({ text, label }: InfoTooltipButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  const measureAndPosition = () => {
    const btn = buttonRef.current;
    const tip = tooltipRef.current;
    if (!btn || !tip) return;
    const btnRect = btn.getBoundingClientRect();
    const tipWidth = tip.getBoundingClientRect().width;
    setStyle({ ...computeTooltipStyle(btnRect, tipWidth), visibility: 'visible' });
  };

  useLayoutEffect(() => {
    if (!open) return;
    setStyle({ visibility: 'hidden' });
    measureAndPosition();
    const frame = requestAnimationFrame(measureAndPosition);
    return () => cancelAnimationFrame(frame);
  }, [open, text]);

  useEffect(() => {
    if (!open) return;

    const close = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || tooltipRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onScroll = () => close();

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition flex-shrink-0"
        aria-label={label ?? 'More information'}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
      >
        <FiInfo className="w-4 h-4" />
      </button>
      {open
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              style={style}
              className="bg-gray-900 dark:bg-gray-700 text-white text-sm px-2.5 py-1.5 rounded shadow-lg leading-snug break-words max-w-[min(20rem,calc(100vw-24px))]"
            >
              {text}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
