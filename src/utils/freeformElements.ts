import { v4 as uuid } from 'uuid';
import type {
  FreeformElement,
  FreeformElementLayout,
  FreeformElementType,
  FreeformSection,
} from '../types/homepage';

export const MIN_FREEFORM_SIZE = 4;
export const FREEFORM_SNAP = 1;

export function clampPercent(value: number, min = 0, max = 100): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function snapPercent(value: number): number {
  return clampPercent(Math.round(value / FREEFORM_SNAP) * FREEFORM_SNAP);
}

export function normalizeFreeformLayout(
  layout: Partial<FreeformElementLayout>
): FreeformElementLayout {
  const x = snapPercent(layout.x ?? 10);
  const y = snapPercent(layout.y ?? 10);
  const width = snapPercent(Math.max(layout.width ?? 30, MIN_FREEFORM_SIZE));
  const height = snapPercent(Math.max(layout.height ?? 12, MIN_FREEFORM_SIZE));
  return {
    x: clampPercent(x, 0, 100 - width),
    y: clampPercent(y, 0, 100 - height),
    width: clampPercent(width, MIN_FREEFORM_SIZE, 100 - x),
    height: clampPercent(height, MIN_FREEFORM_SIZE, 100 - y),
    zIndex: layout.zIndex ?? 1,
  };
}

const DEFAULT_LAYOUTS: Record<FreeformElementType, Omit<FreeformElementLayout, 'zIndex'>> = {
  image: { x: 22, y: 16, width: 56, height: 50 },
  text: { x: 8, y: 12, width: 45, height: 18 },
  button: { x: 32, y: 68, width: 36, height: 12 },
};

export function createFreeformElement(
  type: FreeformElementType,
  zIndex: number,
  layoutOverride?: Partial<FreeformElementLayout>
): FreeformElement {
  const base = DEFAULT_LAYOUTS[type];
  const layout = normalizeFreeformLayout({ ...base, ...layoutOverride, zIndex });

  if (type === 'text') {
    return {
      id: uuid(),
      type: 'text',
      layout,
      content: {
        text: 'Add your headline',
        fontSize: 28,
        color: '#111827',
        fontWeight: 'bold',
        textAlign: 'left',
      },
    };
  }

  if (type === 'image') {
    return {
      id: uuid(),
      type: 'image',
      layout,
      content: {
        url: '',
        alt: '',
        objectFit: 'cover',
        rounded: true,
        shadow: false,
      },
    };
  }

  return {
    id: uuid(),
    type: 'button',
    layout,
    content: {
      label: 'Shop now',
      href: '/collections/all',
    },
  };
}

export function createStarterFreeformSection(order: number, id: string): FreeformSection & { id: string; order: number } {
  return {
    id,
    type: 'freeform',
    order,
    settings: {
      minHeightPx: 420,
      backgroundColor: '#f1f3f4',
    },
    content: {
      elements: [],
    },
  };
}

export function sortFreeformElements(elements: FreeformElement[]): FreeformElement[] {
  return [...elements].sort((a, b) => (a.layout.zIndex ?? 0) - (b.layout.zIndex ?? 0));
}

export function patchFreeformElement(
  section: FreeformSection,
  elementId: string,
  patch: Partial<FreeformElement>
): FreeformSection {
  return {
    ...section,
    content: {
      elements: section.content.elements.map((el) =>
        el.id === elementId ? ({ ...el, ...patch } as FreeformElement) : el
      ),
    },
  };
}

export function removeFreeformElement(section: FreeformSection, elementId: string): FreeformSection {
  return {
    ...section,
    content: {
      elements: section.content.elements.filter((el) => el.id !== elementId),
    },
  };
}

export function patchFreeformElementInList(
  elements: FreeformElement[],
  elementId: string,
  patch: Partial<FreeformElement>
): FreeformElement[] {
  return elements.map((el) => (el.id === elementId ? ({ ...el, ...patch } as FreeformElement) : el));
}

/** Repair partial/corrupt saved layers so the canvas stays editable. */
export function normalizeFreeformElement(el: unknown, index: number): FreeformElement | null {
  if (!el || typeof el !== 'object') return null;
  const raw = el as Partial<FreeformElement> & { content?: Record<string, unknown> };
  const type: FreeformElementType =
    raw.type === 'image' || raw.type === 'button' || raw.type === 'text' ? raw.type : 'text';
  const fresh = createFreeformElement(type, raw.layout?.zIndex ?? index + 1, raw.layout);
  return {
    ...fresh,
    id: typeof raw.id === 'string' && raw.id ? raw.id : fresh.id,
    layout: normalizeFreeformLayout(raw.layout ?? fresh.layout),
    content: { ...fresh.content, ...(raw.content || {}) },
  } as FreeformElement;
}

export function normalizeFreeformElementsList(elements: unknown): FreeformElement[] {
  if (!Array.isArray(elements)) return [];
  return elements
    .map((el, i) => normalizeFreeformElement(el, i))
    .filter((el): el is FreeformElement => el != null);
}
