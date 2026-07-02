const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'div',
  'span',
]);

const ALLOWED_ALIGN = new Set(['left', 'center', 'right', 'justify']);

const ALLOWED_STYLE_CLASSES = new Set(['pd-heading', 'pd-subheading', 'pd-body']);

const FONT_SIZE_MAP = ['10px', '13px', '14px', '16px', '18px', '24px', '32px', '48px'];

export const PRODUCT_DESCRIPTION_FONT_SIZES: ReadonlyArray<{
  value: string;
  label: string;
}> = FONT_SIZE_MAP.map((value) => ({
  value,
  label: value.replace('px', ''),
}));

export const DEFAULT_PRODUCT_DESCRIPTION_FONT_SIZE = '14px';

const ALLOWED_FONT_FAMILY_TOKENS = new Set([
  'system-ui',
  'sans-serif',
  'serif',
  'georgia',
  'times new roman',
  'arial',
  'helvetica',
  'ui-monospace',
  'monospace',
  'courier new',
  'dm sans',
  'inherit',
]);

export type ProductDescriptionStyleClass = 'pd-heading' | 'pd-subheading' | 'pd-body';

export const PRODUCT_DESCRIPTION_STYLES: ReadonlyArray<{
  key: ProductDescriptionStyleClass;
  label: string;
  shortLabel: string;
}> = [
  { key: 'pd-heading', label: 'Heading', shortLabel: 'H' },
  { key: 'pd-subheading', label: 'Subheading', shortLabel: 'Sub' },
  { key: 'pd-body', label: 'Normal', shortLabel: 'Txt' },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isAllowedFontSize(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return /^(\d+(\.\d+)?(px|em|rem)|small|medium|large|x-large|xx-large)$/.test(v);
}

function isAllowedFontWeight(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === 'normal' || v === 'bold' || v === '400' || v === '500' || v === '600' || v === '700';
}

function isAllowedFontFamily(value: string): boolean {
  const parts = value
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((part) => ALLOWED_FONT_FAMILY_TOKENS.has(part));
}

function legacyFontSizeFromAttribute(sizeAttr: string | null): string | undefined {
  if (!sizeAttr) return undefined;
  const idx = Number.parseInt(sizeAttr, 10) - 1;
  if (!Number.isFinite(idx) || idx < 0 || idx >= FONT_SIZE_MAP.length) return undefined;
  return FONT_SIZE_MAP[idx];
}

function preserveAllowedStyles(el: HTMLElement): void {
  const textAlign = el.style.textAlign?.toLowerCase() ?? '';
  const fontSize = el.style.fontSize ?? '';
  const fontFamily = el.style.fontFamily ?? '';
  const fontWeight = el.style.fontWeight ?? '';
  const allowedClass = el.className
    .split(/\s+/)
    .filter((name) => ALLOWED_STYLE_CLASSES.has(name))
    .join(' ');

  [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));

  if (allowedClass) {
    el.className = allowedClass;
  }
  if (ALLOWED_ALIGN.has(textAlign)) {
    el.style.textAlign = textAlign;
  }
  if (isAllowedFontSize(fontSize)) {
    el.style.fontSize = fontSize;
  }
  if (isAllowedFontFamily(fontFamily)) {
    el.style.fontFamily = fontFamily;
  }
  if (isAllowedFontWeight(fontWeight)) {
    el.style.fontWeight = fontWeight;
  }
}

export function looksLikeProductDescriptionHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

/** Strip unsafe markup; keep basic formatting used by the product description editor. */
export function sanitizeProductDescriptionHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';

  if (typeof document === 'undefined') {
    return escapeHtml(trimmed.replace(/<[^>]+>/g, ''));
  }

  const template = document.createElement('template');
  template.innerHTML = trimmed;

  const sanitizeNode = (node: Node): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'font') {
      const span = document.createElement('span');
      const face = el.getAttribute('face');
      const size = legacyFontSizeFromAttribute(el.getAttribute('size'));
      if (face && isAllowedFontFamily(face)) {
        span.style.fontFamily = face;
      }
      if (size) {
        span.style.fontSize = size;
      }
      while (el.firstChild) span.appendChild(el.firstChild);
      el.replaceWith(span);
      sanitizeNode(span);
      return;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      if (!parent) return;
      const children = [...el.childNodes];
      children.forEach((child) => parent.insertBefore(child, el));
      parent.removeChild(el);
      children.forEach(sanitizeNode);
      return;
    }

    preserveAllowedStyles(el);
    [...el.childNodes].forEach(sanitizeNode);
  };

  [...template.content.childNodes].forEach(sanitizeNode);
  normalizeListElements(template.content);
  return template.innerHTML.trim();
}

/** Ensure ul/ol contain li elements so bullets/numbers render. */
function normalizeListElements(root: ParentNode): void {
  if (!('querySelectorAll' in root)) return;

  root.querySelectorAll('ul, ol').forEach((list) => {
    const hasDirectLi = [...list.children].some((child) => child.tagName.toLowerCase() === 'li');
    if (hasDirectLi) return;

    const groups: ChildNode[][] = [[]];
    [...list.childNodes].forEach((child) => {
      if (child instanceof Element && child.tagName.toLowerCase() === 'br') {
        groups.push([]);
        return;
      }
      groups[groups.length - 1].push(child);
    });

    const lis: HTMLLIElement[] = [];
    groups.forEach((group) => {
      if (group.length === 0) return;
      const li = document.createElement('li');
      group.forEach((node) => li.appendChild(node));
      if ((li.textContent ?? '').trim()) {
        lis.push(li);
      }
    });

    list.replaceChildren(...(lis.length > 0 ? lis : [document.createElement('li')]));
  });
}

/** Plain text for bulk editor cells (no rich toolbar). */
export function descriptionToBulkEditPlainText(raw: string | undefined): string {
  const text = (raw ?? '').trim();
  if (!text) return '';
  if (!looksLikeProductDescriptionHtml(text)) return text;
  if (typeof document === 'undefined') {
    return text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
  }
  const div = document.createElement('div');
  div.innerHTML = sanitizeProductDescriptionHtml(text);
  return (div.innerText || div.textContent || '').trim();
}

/** Render stored description as safe HTML (plain text legacy → line breaks). */
export function getProductDescriptionHtml(raw: string | undefined): string {
  const text = (raw ?? '').trim();
  if (!text) return '';

  if (looksLikeProductDescriptionHtml(text)) {
    return sanitizeProductDescriptionHtml(text);
  }

  return sanitizeProductDescriptionHtml(escapeHtml(text).replace(/\n/g, '<br>'));
}

function expandCollapsedRangeToWord(range: Range): boolean {
  if (!range.collapsed) return true;

  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || !node.textContent) return false;

  const text = node.textContent;
  const offset = range.startOffset;

  if (offset < 0 || offset > text.length) return false;
  if (/\s/.test(text[offset] ?? '')) return false;

  let start = offset;
  let end = offset;

  while (start > 0 && !/\s/.test(text[start - 1] ?? '')) start -= 1;
  while (end < text.length && !/\s/.test(text[end] ?? '')) end += 1;

  if (start >= end) return false;

  range.setStart(node, start);
  range.setEnd(node, end);
  return true;
}

function classNameToLegacyFontSize(className: string): string | null {
  if (className === 'pd-heading') return '24px';
  if (className === 'pd-subheading') return '18px';
  if (className === 'pd-body') return '16px';
  return null;
}

function normalizeFontSizeValue(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v || !isAllowedFontSize(v)) return null;
  const match = FONT_SIZE_MAP.find((size) => size === v);
  if (match) return match;
  const px = Number.parseFloat(v);
  if (!Number.isFinite(px)) return null;
  const closest = FONT_SIZE_MAP.reduce((best, size) => {
    const bestPx = Number.parseFloat(best);
    const sizePx = Number.parseFloat(size);
    return Math.abs(sizePx - px) < Math.abs(bestPx - px) ? size : best;
  });
  return closest;
}

function stripFontSizeFromNode(node: HTMLElement): void {
  node.style.removeProperty('font-size');
  stripDescriptionStyleClasses(node);
}

function stripFontSizeFromFragment(fragment: DocumentFragment): void {
  fragment.querySelectorAll('span').forEach((node) => stripFontSizeFromNode(node as HTMLElement));
}

function wrapRangeWithFontSize(range: Range, fontSize: string): HTMLSpanElement {
  const wrapper = document.createElement('span');
  wrapper.style.fontSize = fontSize;

  const fragment = range.extractContents();
  stripFontSizeFromFragment(fragment);
  wrapper.appendChild(fragment);
  range.insertNode(wrapper);

  return wrapper;
}

function wrapRangeWithStyle(range: Range, styleClass: ProductDescriptionStyleClass): HTMLSpanElement {
  const wrapper = document.createElement('span');
  wrapper.className = styleClass;

  try {
    range.surroundContents(wrapper);
  } catch {
    const fragment = range.extractContents();
    const styledNodes = fragment.querySelectorAll('span');
    styledNodes.forEach((node) => stripDescriptionStyleClasses(node as HTMLElement));
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
  }

  return wrapper;
}

function stripDescriptionStyleClasses(node: HTMLElement): void {
  ALLOWED_STYLE_CLASSES.forEach((className) => node.classList.remove(className));
  if (!node.className) {
    node.removeAttribute('class');
  }
}

/** Font size at the current caret/selection (for toolbar display). */
export function getSelectionFontSize(
  root?: HTMLElement | null,
  savedRange?: Range | null,
): string {
  if (!root || typeof window === 'undefined') return DEFAULT_PRODUCT_DESCRIPTION_FONT_SIZE;

  const selection = window.getSelection();
  const range = savedRange?.cloneRange() ?? (selection?.rangeCount ? selection.getRangeAt(0) : null);
  if (!range || !root.contains(range.commonAncestorContainer)) {
    return DEFAULT_PRODUCT_DESCRIPTION_FONT_SIZE;
  }

  let node: Node | null = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      const inlineSize = normalizeFontSizeValue(node.style.fontSize ?? '');
      if (inlineSize) return inlineSize;

      const legacyClass = node.className
        .split(/\s+/)
        .map((name) => classNameToLegacyFontSize(name))
        .find((size): size is string => Boolean(size));
      if (legacyClass) return legacyClass;
    }
    node = node.parentNode;
  }

  return DEFAULT_PRODUCT_DESCRIPTION_FONT_SIZE;
}

/** Apply pixel font size to the current selection. */
export function applyFontSizeToSelection(
  fontSize: string,
  root?: HTMLElement | null,
  savedRange?: Range | null,
): boolean {
  const normalized = normalizeFontSizeValue(fontSize);
  if (!root || !normalized) return false;

  const selection = window.getSelection();
  const range = savedRange?.cloneRange() ?? (selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null);
  if (!range || !root.contains(range.commonAncestorContainer)) return false;

  if (range.collapsed && !expandCollapsedRangeToWord(range)) {
    return false;
  }

  if (range.collapsed) {
    return false;
  }

  const wrapper = wrapRangeWithFontSize(range, normalized);

  selection?.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(wrapper);
  selection?.addRange(nextRange);
  return true;
}

/** Apply heading / subheading / body class to the current selection. */
export function applyDescriptionStyleToSelection(
  styleClass: ProductDescriptionStyleClass,
  root?: HTMLElement | null,
  savedRange?: Range | null,
): boolean {
  if (!root) return false;

  const selection = window.getSelection();
  const range = savedRange?.cloneRange() ?? (selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null);
  if (!range || !root.contains(range.commonAncestorContainer)) return false;

  if (range.collapsed && !expandCollapsedRangeToWord(range)) {
    return false;
  }

  if (range.collapsed) {
    return false;
  }

  const wrapper = wrapRangeWithStyle(range, styleClass);

  selection?.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(wrapper);
  selection?.addRange(nextRange);
  return true;
}
