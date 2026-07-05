const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'font']);

const FONT_SIZE_OPTIONS = [
  { value: '0.875rem', label: 'Small' },
  { value: '1rem', label: 'Medium' },
  { value: '1.25rem', label: 'Large' },
  { value: '1.5rem', label: 'XL' },
  { value: '2rem', label: '2XL' },
] as const;

export { FONT_SIZE_OPTIONS };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isAllowedCssColor(val: string): boolean {
  const v = val.trim();
  return (
    /^#[0-9a-f]{3,8}$/i.test(v) ||
    /^rgba?\(\s*[\d.%,\s]+\)$/i.test(v) ||
    /^hsla?\(\s*[\d.%,\s]+\)$/i.test(v)
  );
}

function sanitizeStyle(style: string): string {
  const parts: string[] = [];
  for (const chunk of style.split(';')) {
    const [rawKey, rawVal] = chunk.split(':');
    if (!rawKey || !rawVal) continue;
    const key = rawKey.trim().toLowerCase();
    const val = rawVal.trim();
    if (key === 'color' && isAllowedCssColor(val)) parts.push(`color:${val}`);
    if (key === 'font-size' && /^(\d+(\.\d+)?(px|rem|em)|small|medium|large|x-large)$/.test(val)) {
      parts.push(`font-size:${val}`);
    }
    if (key === 'font-weight' && /^(normal|bold|[4-7]00)$/.test(val)) parts.push(`font-weight:${val}`);
  }
  return parts.join(';');
}

function sanitizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return Array.from(el.childNodes).map(sanitizeNode).join('');

  if (tag === 'br') return '<br>';

  const attrs: string[] = [];
  if (tag === 'span' || tag === 'font') {
    const style = sanitizeStyle(el.getAttribute('style') || '');
    if (style) attrs.push(` style="${style}"`);
    const color = el.getAttribute('color');
    if (color && isAllowedCssColor(color)) {
      attrs.push(` style="${style ? `${style};` : ''}color:${color}"`);
    }
  }

  const inner = Array.from(el.childNodes).map(sanitizeNode).join('');
  return `<${tag}${attrs.join('')}>${inner}</${tag}>`;
}

/** Strip unsafe markup while keeping basic inline formatting. */
export function sanitizeBuilderHtml(html: string): string {
  const trimmed = (html || '').trim();
  if (!trimmed) return '';
  if (!trimmed.includes('<')) return escapeHtml(trimmed);
  if (typeof document === 'undefined') return trimmed.replace(/<[^>]+>/g, '');

  const doc = new DOMParser().parseFromString(trimmed, 'text/html');
  return Array.from(doc.body.childNodes).map(sanitizeNode).join('').trim() || '';
}

export function readInlineEditableContent(el: HTMLElement): string {
  const html = el.innerHTML.replace(/\u00a0/g, ' ').trim();
  if (!html || html === '<br>') return '';
  if (!html.includes('<')) return el.textContent?.trim() || '';
  return sanitizeBuilderHtml(html);
}

export function writeInlineEditableContent(el: HTMLElement, value: string) {
  if (!value) {
    el.innerHTML = '';
    return;
  }
  if (value.includes('<')) {
    el.innerHTML = sanitizeBuilderHtml(value);
  } else {
    el.textContent = value;
  }
}

export function containsBuilderHtml(value: string | undefined): boolean {
  return Boolean(value && value.includes('<'));
}

/** Wrap the current selection (or all content) with an inline style. */
export function wrapEditableInlineStyle(el: HTMLElement, prop: 'color' | 'font-size', value: string) {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    const text = selection.toString();
    document.execCommand(
      'insertHTML',
      false,
      `<span style="${prop}:${value}">${escapeHtml(text)}</span>`
    );
    return;
  }

  const current = readInlineEditableContent(el);
  if (!current) return;
  const inner = current.includes('<') ? sanitizeBuilderHtml(current) : escapeHtml(current);
  writeInlineEditableContent(el, `<span style="${prop}:${value}">${inner}</span>`);
}
