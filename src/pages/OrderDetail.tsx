import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { useNavigate, useParams } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capacitor-community/file-opener';
import { OpenInvoicePdf } from '../plugins/openInvoicePdf';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchSellerOrders, updateOrder, updateOrderStatus, deleteOrder, type Order } from '../services/orderService';
import {
  getCatalogueData,
  isProductEnabledForCatalogue,
  normalizeOrderQuantityStep,
  type ProductWithCatalogueData,
} from '../config/catalogueProductUtils';
import { getAllCatalogues, type Catalogue } from '../config/catalogueConfig';
import { generateInvoicePDF } from '../utils/invoiceGenerator';
import { getBusinessProfileForPdf } from '../config/businessProfile';
import { getSymbolForCurrencyCode } from '../utils/currencyUtils';
import './OrderDetail.css';
import MainAppBottomNav from '../components/MainAppBottomNav';
import { SyncBusyOverlay } from '../components/SyncBusyOverlay';
import { safeGetFromStorage, getStorageKey } from '../utils/safeStorage';
import { productImageDisplayUrl } from '../utils/imageUrl';
import { isDeliberateEdgeSwipeBack } from '../utils/swipeBackGesture';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';
import { resolveListOfferEffective } from '../utils/offerPriceUtils';

/** Haptics throws/rejects on desktop web — avoids dozens of console errors in DevTools. */
async function safeHapticsLight() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* ignore */
  }
}

/** Base64-encode PDF bytes without stack overflow on large buffers. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length);
    const chunk = bytes.subarray(offset, end);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusType = 'pending' | 'completed' | 'cancelled';

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  rowTotal?: number;
  category?: string;
  subtitle?: string;
  variantSummary?: string;
  productId?: string;
  imageUrl?: string;
  imageVersion?: number;
  priceUnit?: string;
  quantityStep?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMoney(amount: number, symbol: string) {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Short label from price unit (e.g. "/ piece" → "pcs"). */
function getOrderUnitLabel(priceUnit: string | undefined): string {
  if (!priceUnit || String(priceUnit).trim() === '' || priceUnit === 'None') {
    return 'units';
  }
  const cleaned = String(priceUnit)
    .replace(/^\s*\/\s*/i, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return 'units';
  if (cleaned === 'piece' || cleaned === 'pieces' || cleaned === 'pc') return 'pieces';
  return cleaned;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Parse variant summary string (e.g., "Size: L; Colour: Green") into pills. */
function parseVariantSummary(summary: string): string[] {
  if (!summary || !summary.trim()) return [];
  return summary.split(';').map(s => s.trim()).filter(Boolean);
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return {
        bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
        border: '#FDE68A',
        text: '#92400E',
        dot: '#F59E0B',
        label: 'Pending',
        icon: '⏳',
        accent: '#F59E0B',
      };
    case 'completed':
      return {
        bg: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
        border: '#BBF7D0',
        text: '#14532D',
        dot: '#16A34A',
        label: 'Completed',
        icon: '✅',
        accent: '#16A34A',
      };
    case 'cancelled':
      return {
        bg: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)',
        border: '#FECDD3',
        text: '#881337',
        dot: '#F43F5E',
        label: 'Cancelled',
        icon: '✕',
        accent: '#F43F5E',
      };
    default:
      return {
        bg: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)',
        border: '#E2E8F0',
        text: '#475569',
        dot: '#94A3B8',
        label: status,
        icon: '•',
        accent: '#94A3B8',
      };
  }
}

const billText = (order: Order, symbol: string) => {
  const date = formatDate(order.created_at);
  const items: OrderItem[] = order.items || [];
  const lines: string[] = [];
  lines.push(`🧾 *Order Bill*`);
  lines.push(`Customer: ${order.customer_name}`);
  lines.push(`Date: ${date}`);
  lines.push('');
  lines.push('*Items:*');
  items.forEach((item, i) => {
    const unitStr = item.unitPrice ? `${symbol}${item.unitPrice} × ${item.quantity}` : `Qty: ${item.quantity}`;
    const totalStr = item.rowTotal ? ` = ${symbol}${item.rowTotal}` : '';
    lines.push(`${i + 1}. ${item.name} — ${unitStr}${totalStr}`);
  });
  lines.push('');
  if (order.total_amount) {
    lines.push(`💰 *Total: ${symbol}${order.total_amount.toLocaleString('en-IN')}*`);
  }
  lines.push(`Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`);
  return lines.join('\n');
};

const CATSHARE_SHARE_PROMO_LINE =
  'Grow your business online 🚀\nDownload CatShare and create your own online store easily.\n\n📲 https://play.google.com/store/apps/details?id=com.catshare.official';

function buildInvoiceShareText(customerName: string): string {
  return `Hi ${customerName}, please find your invoice attached.\n\n${CATSHARE_SHARE_PROMO_LINE}`;
}

function buildOrderImageShareText(customerName: string): string {
  return `Hi ${customerName}, here is your order summary.\n\n${CATSHARE_SHARE_PROMO_LINE}`;
}

/** Safe PDF filename for device storage (avoid path separators and reserved chars). */
function invoicePdfFileName(order: Order): string {
  const idPart = order.id.substring(0, 8);
  const raw = (order.customer_name || 'customer').replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').slice(0, 80);
  return `Invoice_${idPart}_${raw || 'customer'}.pdf`;
}

function orderSnapshotPngFileName(order: Order): string {
  const idPart = order.id.substring(0, 8);
  const raw = (order.customer_name || 'customer').replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').slice(0, 80);
  return `Order_${idPart}_${raw || 'customer'}.png`;
}

/** Supabase JSON may use snake_case; UI expects camelCase. */
function normalizeOrderItemFromApi(raw: unknown): Order['items'][number] {
  const r = raw as Record<string, unknown>;
  const imageUrl =
    (typeof r.imageUrl === 'string' && r.imageUrl.trim()) ||
    (typeof r.image_url === 'string' && r.image_url.trim()) ||
    undefined;
  const iv = r.imageVersion ?? r.image_version;
  const imageVersion =
    typeof iv === 'number' && Number.isFinite(iv)
      ? iv
      : typeof iv === 'string' && /^\d+$/.test(iv)
        ? Number(iv)
        : undefined;
  const productId =
    (typeof r.productId === 'string' && r.productId.trim()) ||
    (typeof r.product_id === 'string' && r.product_id.trim()) ||
    undefined;
  return {
    ...(raw as object),
    ...(imageUrl ? { imageUrl } : {}),
    ...(imageVersion != null ? { imageVersion } : {}),
    ...(productId ? { productId } : {}),
  } as Order['items'][number];
}

function normalizeOrderFromApi(o: Order): Order {
  return {
    ...o,
    items: (o.items || []).map((it) => normalizeOrderItemFromApi(it)),
  };
}

/**
 * Orders do not store catalogue_id. Infer the catalogue from line items: every line
 * must reference a product enabled in that catalogue; tie-break with price match.
 */
function resolveOrderCatalogueId(
  orderItems: OrderItem[],
  products: ProductWithCatalogueData[],
  catalogues: Catalogue[]
): string | null {
  const ids = orderItems.map((it) => it.productId).filter(Boolean) as string[];
  if (ids.length === 0) return null;
  const productById = new Map<string, ProductWithCatalogueData>();
  for (const p of products) {
    if (p?.id != null) productById.set(String(p.id), p);
  }
  const candidates: string[] = [];
  for (const cat of catalogues) {
    let ok = true;
    for (const pid of ids) {
      const p = productById.get(String(pid));
      if (!p || !isProductEnabledForCatalogue(p, cat.id)) {
        ok = false;
        break;
      }
    }
    if (ok) candidates.push(cat.id);
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  let best = candidates[0];
  let bestScore = Infinity;
  for (const catId of candidates) {
    const cat = catalogues.find((c) => c.id === catId);
    if (!cat) continue;
    let score = 0;
    for (const it of orderItems) {
      if (!it.productId) continue;
      const p = productById.get(String(it.productId));
      if (!p) continue;
      const catData = getCatalogueData(p, catId);
      const expected = resolveListOfferEffective(
        catData,
        cat.priceField,
        p as Record<string, unknown>
      ).effectiveUnitPrice;
      score += Math.abs(expected - (it.unitPrice || 0));
    }
    if (score < bestScore) {
      bestScore = score;
      best = catId;
    }
  }
  return best;
}

function buildOrderItemFromProduct(product: ProductWithCatalogueData, catalogue: Catalogue): OrderItem {
  const catData = getCatalogueData(product, catalogue.id);
  const unitPrice = resolveListOfferEffective(
    catData,
    catalogue.priceField,
    product as Record<string, unknown>
  ).effectiveUnitPrice;
  const priceUnit = catData[catalogue.priceUnitField];
  const quantityStep = normalizeOrderQuantityStep(
    (catData as { orderQuantityStep?: unknown }).orderQuantityStep
  );
  const qty = quantityStep;
  const rawImg = product.imageUrl ?? (product as { image?: string }).image;
  const imageUrl = typeof rawImg === 'string' && rawImg.trim() ? rawImg.trim() : undefined;
  const imageVersion =
    typeof product.imageVersion === 'number' && Number.isFinite(product.imageVersion)
      ? product.imageVersion
      : undefined;
  return {
    productId: String(product.id),
    name: product.name || 'Product',
    quantity: qty,
    unitPrice,
    rowTotal: unitPrice * qty,
    category: Array.isArray(product.category) ? product.category[0] : undefined,
    subtitle: typeof product.subtitle === 'string' ? product.subtitle : undefined,
    imageUrl,
    imageVersion,
    priceUnit,
    quantityStep,
  };
}

function resolveOrderItemImageUrl(item: OrderItem): string | undefined {
  const a = item.imageUrl;
  if (typeof a === 'string' && a.trim()) return a.trim();
  const b = (item as unknown as { image_url?: string }).image_url;
  if (typeof b === 'string' && b.trim()) return b.trim();
  return undefined;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  dw: number,
  dh: number
) {
  const el = source as HTMLImageElement;
  const iw = el.naturalWidth || el.width;
  const ih = el.naturalHeight || el.height;
  if (!iw || !ih) return;
  const scale = Math.max(dw / iw, dh / ih);
  const rw = iw * scale;
  const rh = ih * scale;
  const x = (dw - rw) / 2;
  const y = (dh - rh) / 2;
  ctx.drawImage(source, 0, 0, iw, ih, x, y, rw, rh);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Snapshot only: html2canvas mis-draws avatar & product imgs; rasterize with Canvas2D then restore. */
function replaceCustomerAvatarWithCanvasForCapture(container: HTMLElement): () => void {
  const el = container.querySelector<HTMLElement>('[data-order-avatar-capture]');
  if (!el) return () => {};

  const dot = el.getAttribute('data-dot') || '#F59E0B';
  const initial = el.getAttribute('data-initial') || '?';
  const parent = el.parentElement;
  if (!parent) return () => {};

  const size = 44;
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.style.display = 'block';
  canvas.style.flexShrink = '0';

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  ctx.scale(dpr, dpr);

  const rgb = hexToRgb(dot);
  ctx.beginPath();
  ctx.arc(22, 22, 20, 0, Math.PI * 2);
  if (rgb) {
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0x18 / 255})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0x30 / 255})`;
  } else {
    ctx.fillStyle = dot;
    ctx.fill();
    ctx.strokeStyle = dot;
  }
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font =
    '700 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = dot;
  ctx.fillText(initial, 22, 22);

  parent.insertBefore(canvas, el);
  const prev = el.style.display;
  el.style.display = 'none';
  return () => {
    el.style.display = prev;
    canvas.remove();
  };
}

async function prepareImagesForCaptureSnapshot(container: HTMLElement): Promise<() => void> {
  const restores: Array<() => void> = [];
  restores.push(replaceCustomerAvatarWithCanvasForCapture(container));

  const imgs = Array.from(container.querySelectorAll('img'));
  const { loadImage } = await import('../utils/canvasRenderer');

  for (const node of imgs) {
    const img = node as HTMLImageElement;
    const url = (img.currentSrc || img.src || '').trim();
    if (!url) continue;

    const parent = img.parentElement;
    if (!parent) continue;

    const w = img.offsetWidth || 52;
    const h = img.offsetHeight || 52;
    if (w < 4 || h < 4) continue;

    try {
      const loaded = await loadImage(url);
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2);
      const cw = Math.round(w * dpr);
      const ch = Math.round(h * dpr);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.display = 'block';
      canvas.style.borderRadius = getComputedStyle(img).borderRadius || '12px';

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      drawImageCover(ctx, loaded, cw, ch);

      parent.insertBefore(canvas, img);
      const prevDisplay = img.style.display;
      img.style.display = 'none';
      restores.push(() => {
        img.style.display = prevDisplay;
        canvas.remove();
      });
    } catch (e) {
      console.warn('Order snapshot: could not rasterize thumb', url, e);
    }
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });

  return () => {
    restores.forEach((fn) => fn());
  };
}

/** Ensure every img in the snapshot subtree is decoded so layout and raster match across runs. */
async function waitForImagesInElement(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
  await Promise.all(
    imgs.map(async (img) => {
      const src = (img.currentSrc || img.src || '').trim();
      if (!src) return;
      if (!img.complete) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      }
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {
        /* decode() rejects for some broken/cached images; capture still proceeds */
      }
    })
  );
}

function flushSnapshotLayout(container: HTMLElement): void {
  void container.offsetHeight;
  void container.scrollWidth;
  container.getBoundingClientRect();
}

/**
 * Web fonts + layout flush + multiple paint frames so html2canvas sees a stable tree (mobile WebView varies run-to-run).
 */
async function waitForSnapshotPaintReady(container: HTMLElement): Promise<void> {
  try {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    /* ignore */
  }
  flushSnapshotLayout(container);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });
  flushSnapshotLayout(container);
  if (Capacitor.isNativePlatform()) {
    await new Promise<void>((r) => setTimeout(r, 180));
    flushSnapshotLayout(container);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }
}

type StoredProductRow = { id?: string; imageUrl?: string; imageVersion?: number };

/**
 * WebView (Capacitor) can apply different text autosizing / subpixel layout than desktop Chrome.
 * Normalize on the cloned document so PNG matches web as closely as possible.
 */
function applySnapshotCloneRootHints(doc: Document) {
  const imp = 'important';
  if (doc.body instanceof HTMLElement) {
    doc.body.style.setProperty('-webkit-text-size-adjust', '100%', imp);
  }
  const root = doc.querySelector('[data-order-snapshot-root]');
  if (root instanceof HTMLElement) {
    root.style.setProperty('-webkit-text-size-adjust', '100%', imp);
    root.style.setProperty('text-rendering', 'geometricPrecision', imp);
    root.style.setProperty('-webkit-font-smoothing', 'antialiased', imp);
    root.style.setProperty('overflow', 'visible', imp);
    /* Tighter inset in PNG only — live Order Detail keeps padding on the element in JSX */
    root.style.setProperty('padding', '10px', imp);
  }
}

/** html2canvas can clip descendants; widen overflow on the clone ancestor chain (snapshot subtree only). */
function forceSnapshotCloneAncestorsOverflowVisible(doc: Document, leaf: HTMLElement) {
  const imp = 'important';
  let n: HTMLElement | null = leaf;
  const htmlEl = doc.documentElement;
  while (n) {
    n.style.setProperty('overflow', 'visible', imp);
    n.style.setProperty('overflow-x', 'visible', imp);
    n.style.setProperty('overflow-y', 'visible', imp);
    if (n === htmlEl) break;
    n = n.parentElement;
  }
}

/** Injected only in html2canvas clone — not visible on the live Order Detail page. */
function appendOrderSnapshotCaptureFooter(doc: Document) {
  const root = doc.querySelector('[data-order-snapshot-root]');
  if (!(root instanceof HTMLElement)) return;
  if (root.querySelector('[data-order-snapshot-capture-footer]')) return;

  const footer = doc.createElement('div');
  footer.setAttribute('data-order-snapshot-capture-footer', 'true');
  footer.style.cssText = [
    'margin-top:0',
    'padding:0 0 5px 0',
    'display:flex',
    'justify-content:flex-end',
    'align-items:center',
    'box-sizing:border-box',
    "font-family:'DM Sans',system-ui,sans-serif",
    '-webkit-font-smoothing:antialiased',
  ].join(';');

  const line = doc.createElement('span');
  line.style.cssText = 'font-size:11px;color:#A3AFBF;line-height:1.35;white-space:nowrap';
  line.appendChild(doc.createTextNode('Generated by '));
  const brand = doc.createElement('span');
  brand.textContent = 'CatShare';
  brand.style.cssText = 'color:#23824C;font-weight:600';
  line.appendChild(brand);

  footer.appendChild(line);
  root.appendChild(footer);
}

/**
 * Snapshot only: html2canvas misaligns flex rows. Live Order Detail keeps a simple flex layout;
 * we re-assert stretch + inner flex centering on the cloned DOM before rasterize.
 */
function applyOrderSnapshotLayoutForClone(doc: Document) {
  const imp = 'important';
  applySnapshotCloneRootHints(doc);

  const customerRow = doc.querySelector('[data-order-customer-snapshot-row]');
  if (customerRow instanceof HTMLElement) {
    customerRow.style.setProperty('display', 'flex', imp);
    customerRow.style.setProperty('flex-direction', 'row', imp);
    customerRow.style.setProperty('justify-content', 'space-between', imp);
    customerRow.style.setProperty('gap', '12px', imp);
    customerRow.style.setProperty('box-sizing', 'border-box', imp);
    customerRow.style.setProperty('width', '100%', imp);
    customerRow.style.setProperty('align-items', 'center', imp);
    customerRow.style.setProperty('padding', '14px 16px', imp);

    const left = customerRow.children[0];
    const right = customerRow.children[1];
    if (left instanceof HTMLElement) {
      left.style.setProperty('display', 'flex', imp);
      left.style.setProperty('flex-direction', 'row', imp);
      left.style.setProperty('align-items', 'center', imp);
      left.style.setProperty('gap', '12px', imp);
      left.style.setProperty('flex', '1', imp);
      left.style.setProperty('min-width', '0', imp);
      left.style.setProperty('overflow', 'visible', imp);
    }
    const textEl = customerRow.querySelector('[data-order-customer-text-snapshot]');
    if (textEl instanceof HTMLElement) {
      textEl.style.setProperty('min-width', '0', imp);
      textEl.style.setProperty('overflow', 'visible', imp);
    }
    if (right instanceof HTMLElement) {
      right.style.setProperty('display', 'flex', imp);
      right.style.setProperty('flex-direction', 'column', imp);
      right.style.setProperty('justify-content', 'center', imp);
      right.style.setProperty('align-items', 'flex-end', imp);
      right.style.setProperty('text-align', 'right', imp);
      right.style.setProperty('white-space', 'nowrap', imp);
      // PNG-only; right totals column only
      right.style.setProperty('padding', '0 0 4px', imp);
      right.style.setProperty('box-sizing', 'border-box', imp);
      right.style.setProperty('margin-top', '-2px', imp);
    }

    const waLink = customerRow.querySelector('[data-order-customer-text-snapshot] a[href*="wa.me"]');
    if (waLink instanceof HTMLElement) {
      forceSnapshotCloneAncestorsOverflowVisible(doc, waLink);
      waLink.style.setProperty('display', 'inline', imp);
      waLink.style.setProperty('justify-content', 'flex-start', imp);
      waLink.style.setProperty('gap', '0', imp);
      waLink.style.setProperty('margin-top', '2px', imp);
      waLink.style.setProperty('font-size', '13px', imp);
      waLink.style.setProperty('white-space', 'nowrap', imp);
      waLink.style.setProperty('overflow', 'visible', imp);
      // Snapshot-only: number should be gray (not WhatsApp green)
      waLink.style.setProperty('color', COLORS.muted, imp);
      waLink.style.setProperty('text-decoration', 'none', imp);
      waLink.querySelectorAll('svg').forEach((icon) => {
        if (icon instanceof SVGElement) icon.style.setProperty('display', 'none', imp);
      });
    }
  }

  const orderTotalRow = doc.querySelector('[data-order-snapshot-order-total-row]');
  if (orderTotalRow instanceof HTMLElement) {
    orderTotalRow.style.setProperty('display', 'flex', imp);
    orderTotalRow.style.setProperty('flex-direction', 'row', imp);
    orderTotalRow.style.setProperty('justify-content', 'space-between', imp);
    orderTotalRow.style.setProperty('align-items', 'center', imp);
    // PNG-only padding: tighter than before; still a touch more bottom than top so the row doesn’t hug the card edge
    orderTotalRow.style.setProperty('padding', '2px 0 16px', imp);
    orderTotalRow.style.setProperty('box-sizing', 'border-box', imp);
  }

  doc.querySelectorAll('[data-order-snapshot-line-right]').forEach((node) => {
    if (node instanceof HTMLElement) {
      node.style.setProperty('padding', '0 0 4px', imp);
      node.style.setProperty('box-sizing', 'border-box', imp);
      node.style.setProperty('margin-top', '-2px', imp);
    }
  });

  const orderTotalValue = doc.querySelector('[data-order-snapshot-order-total-value]');
  if (orderTotalValue instanceof HTMLElement) {
    orderTotalValue.style.setProperty('display', 'inline-block', imp);
    orderTotalValue.style.setProperty('padding', '0 0 4px', imp);
    orderTotalValue.style.setProperty('box-sizing', 'border-box', imp);
    orderTotalValue.style.setProperty('margin-top', '-2px', imp);
  }

  appendOrderSnapshotCaptureFooter(doc);
}

function hydrateOrderItemImagesFromLocalProducts(
  items: Order['items'],
  userId: string | undefined
): Order['items'] {
  if (!userId) return items;
  const products = safeGetFromStorage(getStorageKey('products', userId), [] as StoredProductRow[]);
  const byId = new Map<string, StoredProductRow>();
  for (const p of products) {
    if (p?.id != null) byId.set(String(p.id), p);
  }
  return items.map((it) => {
    if (resolveOrderItemImageUrl(it as OrderItem)) return it;
    const pid = (it as { productId?: string }).productId;
    if (!pid) return it;
    const p = byId.get(String(pid));
    const u = typeof p?.imageUrl === 'string' ? p.imageUrl.trim() : '';
    if (!u) return it;
    const imageVersion =
      typeof p?.imageVersion === 'number' && Number.isFinite(p.imageVersion)
        ? p.imageVersion
        : undefined;
    return { ...it, imageUrl: u, ...(imageVersion != null ? { imageVersion } : {}) } as Order['items'][number];
  });
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Clipboard } = await import('@capacitor/clipboard');
    await Clipboard.write({ string: text, label: 'Order bill' });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error('Clipboard unavailable');
}

/** Opens HTTPS links reliably in the Capacitor WebView (window.open is often blocked). */
async function openExternalHttpsUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, toolbarColor: '#ffffff' });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const FONT = "'DM Sans', system-ui, sans-serif";
const COLORS = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  border: '#E8E8ED',
  text: '#1C1C1E',
  muted: '#6E6E73',
  subtle: '#AEAEB2',
  green: '#16A34A',
  greenLight: '#F0FDF4',
  blue: '#0A84FF',
  red: '#FF3B30',
};

// ─── SVG Icons (crisp, iOS-style) ────────────────────────────────────────────
const Ic = {
  Back: () => (
    <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
      <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
      <path d="M1 1L6 7L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
      <path d="M1 5.5L5 9.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  WhatsApp: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  Copy: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  ),
  Edit: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  PDF: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Trash: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  ),
  Minus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Phone: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.2 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  Img: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
    </svg>
  ),
  ImageShare: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  /** Arrow-into-tray — used for Download image (distinct from ImageShare). */
  Download: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  MoreVertical: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
    </svg>
  ),
};

// ─── Status Pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 11px', borderRadius: 100,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.text, fontSize: 12, fontWeight: 600,
      letterSpacing: '0.1px',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ─── Card shell ───────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: COLORS.surface, borderRadius: 16,
      border: `1px solid ${COLORS.border}`,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.6px',
      textTransform: 'uppercase', color: COLORS.subtle,
      padding: '0 4px', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

// ─── Row divider ─────────────────────────────────────────────────────────────
const Divider = () => (
  <div style={{ height: 1, background: '#F2F2F7', margin: '0 16px' }} />
);

// ─── Status dropdown ─────────────────────────────────────────────────────────
function StatusDropdown({
  current,
  onChange,
  onClose,
}: {
  current: string;
  onChange: (s: StatusType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const statuses: StatusType[] = ['pending', 'completed', 'cancelled'];

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 6px)', right: 0,
      background: '#FFFFFF', borderRadius: 14,
      border: `1px solid ${COLORS.border}`,
      boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      zIndex: 300, overflow: 'hidden', minWidth: 180,
      animation: 'dropIn 0.15s cubic-bezier(0.34,1.3,0.64,1)',
    }}>
      <style>{`@keyframes dropIn { from { opacity: 0; transform: translateY(-6px) scale(0.97) } to { opacity: 1; transform: none } }`}</style>
      {statuses.map((s, i) => {
        const cfg = getStatusConfig(s);
        const isActive = s === current;
        return (
          <button
            key={s}
            onClick={() => { onChange(s); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '12px 16px',
              border: 'none', borderBottom: i < statuses.length - 1 ? `1px solid #F2F2F7` : 'none',
              background: isActive ? `${cfg.accent}08` : 'transparent',
              cursor: 'pointer', fontFamily: FONT,
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              color: isActive ? cfg.text : COLORS.text,
              transition: 'background 0.1s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: cfg.dot, flexShrink: 0,
              }} />
              {cfg.label}
            </span>
            {isActive && <span style={{ color: cfg.accent }}><Ic.Check /></span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Actions dropdown menu ───────────────────────────────────────────────────
function ActionsMenu({
  onClose,
  onWhatsApp,
  onOpenPDF,
  onCopyBill,
  onDownloadOrderImage,
  onShareOrderImage,
  pdfLoading,
  shareImageLoading,
  copied,
}: {
  onClose: () => void;
  onWhatsApp: () => void;
  onOpenPDF: () => void;
  onCopyBill: () => void;
  onDownloadOrderImage: () => void;
  onShareOrderImage: () => void;
  pdfLoading: boolean;
  shareImageLoading: boolean;
  copied: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const actions = [
    { icon: <Ic.WhatsApp size={16} />, label: 'Send Invoice', sublabel: 'WhatsApp', onClick: onWhatsApp, color: '#16A34A' },
    { icon: <Ic.PDF />, label: 'Open PDF', sublabel: pdfLoading ? 'Generating…' : 'Invoice', onClick: onOpenPDF, color: '#0A84FF' },
    { icon: <Ic.Copy />, label: copied ? 'Copied!' : 'Copy Bill', sublabel: 'Plain text', onClick: onCopyBill, color: '#8B5CF6' },
    { icon: <Ic.Download />, label: 'Download image', sublabel: shareImageLoading ? 'Preparing…' : 'Order summary PNG', onClick: onDownloadOrderImage, color: '#0EA5E9' },
    { icon: <Ic.ImageShare />, label: 'Share image', sublabel: shareImageLoading ? 'Preparing…' : 'Order summary', onClick: onShareOrderImage, color: '#14B8A6' },
  ];

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
      background: '#FFFFFF', borderRadius: 14,
      border: `1px solid ${COLORS.border}`,
      boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      zIndex: 300, overflow: 'hidden', minWidth: 240,
      animation: 'dropIn 0.15s cubic-bezier(0.34,1.3,0.64,1)',
    }}>
      <style>{`@keyframes dropIn { from { opacity: 0; transform: translateY(-6px) scale(0.97) } to { opacity: 1; transform: none } }`}</style>
      {actions.map((action, i) => {
        const isDisabled =
          (pdfLoading && i !== 2) ||
          (shareImageLoading && (i === 3 || i === 4));
        return (
          <button
            key={i}
            onClick={() => { if (!isDisabled) { action.onClick(); onClose(); } }}
            disabled={isDisabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', padding: '12px 16px',
              border: 'none', borderBottom: i < actions.length - 1 ? `1px solid #F2F2F7` : 'none',
              background: 'transparent',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontFamily: FONT,
              fontSize: 13, fontWeight: 500,
              color: isDisabled ? COLORS.muted : COLORS.text,
              transition: 'background 0.1s, opacity 0.1s',
              opacity: isDisabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isDisabled) e.currentTarget.style.background = '#F5F5F7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{ color: isDisabled ? COLORS.muted : action.color, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isDisabled ? 0.6 : 1 }}>
              {action.icon}
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: isDisabled ? COLORS.muted : COLORS.text }}>{action.label}</div>
              <div style={{ fontSize: 11, color: isDisabled ? COLORS.subtle : COLORS.muted, marginTop: 2 }}>{action.sublabel}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Action tile ─────────────────────────────────────────────────────────────
function ActionTile({
  icon, label, sublabel, color, bg, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  color: string;
  bg: string;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '14px 14px 12px',
        background: pressed ? `${bg}` : '#FAFAFA',
        border: `1.5px solid ${color}18`,
        borderRadius: 14, cursor: 'pointer', fontFamily: FONT,
        transition: 'transform 0.1s, background 0.1s',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        gap: 10,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.text, lineHeight: 1.3 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10.5, color: COLORS.subtle, marginTop: 1 }}>{sublabel}</div>}
      </div>
    </button>
  );
}

// ─── Qty stepper ─────────────────────────────────────────────────────────────
function QtyStepper({ value, step, onChange }: { value: number; step: number; onChange: (n: number) => void }) {
  const normalizedStep = normalizeOrderQuantityStep(step);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F2F2F7', borderRadius: 6, border: '1.5px solid #E2E8F0', width: 'fit-content' }}>
      <button
        onClick={() => onChange(Math.max(0, value - normalizedStep))}
        style={{ width: 34, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: value === 0 ? '#CBD5E1' : COLORS.text }}
        disabled={value === 0}
      >
        <Ic.Minus />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value > 0 ? String(value) : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          if (!digits) {
            onChange(0);
          } else {
            const num = parseInt(digits, 10);
            // Manual typing should allow exact override (not forced to quantity step)
            onChange(Math.max(0, num));
          }
        }}
        aria-label="Quantity"
        style={{
          width: 40,
          border: 'none',
          background: 'transparent',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 700,
          color: value === 0 ? '#94A3B8' : COLORS.text,
          fontFamily: 'inherit',
          padding: 0,
          outline: 'none',
        }}
      />
      <button
        onClick={() => onChange(value + normalizedStep)}
        style={{ width: 34, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.text }}
      >
        <Ic.Plus />
      </button>
    </div>
  );
}

// ─── Product image ────────────────────────────────────────────────────────────
function ProductThumb({
  url,
  name,
  imageVersion,
}: {
  url?: string;
  name: string;
  imageVersion?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = url
    ? url.startsWith('data:') || !/^https?:\/\//i.test(url)
      ? url
      : productImageDisplayUrl(url, imageVersion)
    : '';
  const valid = url && (url.startsWith('data:') || /^https?:\/\//i.test(url)) && !failed;
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 12, flexShrink: 0,
      overflow: 'hidden', background: '#F2F2F7',
      border: `1px solid ${COLORS.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {valid ? (
        <img
          key={src}
          src={src}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Ic.Img />
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, supabaseData } = useAuth();
  const { showToast } = useToast();
  const { guardOnline } = useCloudWriteGate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<(OrderItem & { _key: string })[]>([]);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareImageLoading, setShareImageLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [addItemsSearch, setAddItemsSearch] = useState('');
  const [editingPriceKey, setEditingPriceKey] = useState<string | null>(null);
  const [priceEditValue, setPriceEditValue] = useState('');
  const isSwipeProcessingRef = useRef(false);
  const pdfProcessingRef = useRef(false);
  const shareImageProcessingRef = useRef(false);
  const orderShareCaptureRef = useRef<HTMLDivElement>(null);
  const editModeRef = useRef(editMode);

  const setEditModeSync = (val: boolean) => {
  editModeRef.current = val;
  setEditMode(val);
  if (val) {
    window.history.pushState({ editMode: true }, '');
  }
};

useEffect(() => {
  const onPopState = (e: PopStateEvent) => {
    if (editModeRef.current) {
      // Native back was triggered while in edit mode — just exit edit mode
      editModeRef.current = false;
      setEditMode(false);
      // Don't navigate away
    }
  };
  window.addEventListener('popstate', onPopState);
  return () => window.removeEventListener('popstate', onPopState);
}, []);

  const localProducts = useMemo(() => {
    const cloud = supabaseData?.products;
    if (Array.isArray(cloud) && cloud.length > 0) return cloud as ProductWithCatalogueData[];
    if (!user?.uid) return [] as ProductWithCatalogueData[];
    return safeGetFromStorage(getStorageKey('products', user.uid), []) as ProductWithCatalogueData[];
  }, [supabaseData?.products, user?.uid]);

  const orderCatalogueId = useMemo(
    () =>
      order
        ? resolveOrderCatalogueId(
            (order.items || []) as OrderItem[],
            localProducts,
            getAllCatalogues(user?.uid)
          )
        : null,
    [order, localProducts, user?.uid]
  );

  const orderCatalogueConfig = useMemo(
    () =>
      orderCatalogueId && user?.uid
        ? getAllCatalogues(user.uid).find((c) => c.id === orderCatalogueId) || null
        : null,
    [orderCatalogueId, user?.uid]
  );

  const addableCatalogueProducts = useMemo(() => {
    if (!orderCatalogueId || !orderCatalogueConfig || !localProducts.length) return [];
    const inOrder = new Set(editItems.map((it) => it.productId).filter(Boolean).map(String));
    const q = addItemsSearch.trim().toLowerCase();
    return localProducts.filter((p) => {
      if (!isProductEnabledForCatalogue(p, orderCatalogueId)) return false;
      if (inOrder.has(String(p.id))) return false;
      if (q) {
        const name = (p.name || '').toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [orderCatalogueId, orderCatalogueConfig, localProducts, editItems, addItemsSearch]);

  useEffect(() => {
    if (!editMode) {
      setAddItemsOpen(false);
      setAddItemsSearch('');
    }
  }, [editMode]);

  const handleAddProductFromCatalogue = useCallback(
    (product: ProductWithCatalogueData) => {
      if (!orderCatalogueConfig) return;
      const line = buildOrderItemFromProduct(product, orderCatalogueConfig);
      setEditItems((prev) => [
        ...prev,
        {
          ...line,
          _key: `k-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        },
      ]);
      void safeHapticsLight();
    },
    [orderCatalogueConfig]
  );

  const swipeHandlers = useSwipeable({
    onSwipedRight: async (e) => {
      if (isSwipeProcessingRef.current) return;
      if (!isDeliberateEdgeSwipeBack(e)) return;

      // Capture synchronously before any awaits
      const wasInEditMode = editModeRef.current;

      isSwipeProcessingRef.current = true;
      await safeHapticsLight();

      if (wasInEditMode) {
        setEditModeSync(false);
      } else {
        navigate(-1);
      }

      setTimeout(() => {
        isSwipeProcessingRef.current = false;
      }, 400);
    },
    trackMouse: false,
    delta: 50,
  });

  useEffect(() => {
    if (!user?.uid || !id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await fetchSellerOrders(user.uid);
      if (!error && data) {
        const found = data.find((o: Order) => o.id === id);
        if (found) {
          const normalized = normalizeOrderFromApi(found);
          const hydrated = {
            ...normalized,
            items: hydrateOrderItemImagesFromLocalProducts(normalized.items, user.uid),
          };
          setOrder(hydrated);
          setEditName(hydrated.customer_name || '');
          setEditPhone((hydrated as any).customer_whatsapp || '');
          setEditItems((hydrated.items || []).map((it: OrderItem, i: number) => ({ ...it, _key: String(i) })));
        } else showToast('Order not found', 'error');
      } else showToast('Failed to load order', 'error');
      setLoading(false);
    })();
  }, [user?.uid, id]);

  const handleBack = async () => {
    await safeHapticsLight();
    if (editMode) {
      setEditModeSync(false);
    } else {
      navigate(-1);
    }
  };

  const handleStatusChange = async (status: StatusType) => {
    if (!order) return;
    if (!guardOnline()) return;

    await safeHapticsLight();

    // Store old status in case we need to revert
    const oldStatus = order.status;

    // Update local state immediately for optimistic UI
    setOrder(prev => prev ? { ...prev, status } : null);

    // Persist to backend
    const { error } = await updateOrderStatus(order.id, status);
    if (error) {
      showToast('Failed to update order status', 'error');
      // Revert on error
      setOrder(prev => prev ? { ...prev, status: oldStatus } : null);
    } else {
      showToast(`Marked as ${status}`, 'success');
    }
  };

  const handleEnterEditMode = useCallback(() => {
    if (!order) return;
    setEditName(order.customer_name || '');
    setEditPhone((order as any).customer_whatsapp || '');
    setEditItems((order.items || []).map((it: OrderItem, i: number) => ({ ...it, _key: String(i) })));
    setEditModeSync(true);
  }, [order]);

  const handleSaveEdit = async () => {
    if (!order) return;
    if (!guardOnline()) return;
    setSaveLoading(true);
    try {
      const persistedEditItems = editItems.filter((it) => it.quantity > 0);
      const total = persistedEditItems.reduce((s, it) => s + ((it.unitPrice || 0) * it.quantity), 0);
      const itemsToSave = persistedEditItems.map(({ _key, ...item }) => ({
        ...item,
        rowTotal: (item.unitPrice || 0) * item.quantity,
      })) as any[];
      const { error } = await updateOrder(order.id, {
        items: itemsToSave as any,
        customer_name: editName,
        customer_whatsapp: editPhone,
        total_amount: total,
      });

      if (error) {
        showToast('Failed to save order', 'error');
        setSaveLoading(false);
        return;
      }

      const updatedItems = persistedEditItems.map(item => ({
        ...item,
        rowTotal: (item.unitPrice || 0) * item.quantity,
      }));
      setEditItems(updatedItems.map((it, i) => ({ ...it, _key: String(i) })));
      setOrder({
        ...order,
        items: updatedItems,
        customer_name: editName,
        customer_whatsapp: editPhone,
        total_amount: total,
      } as any);
      setEditModeSync(false);
      showToast('Order saved', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save order', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleOpenPriceEdit = (itemKey: string, currentPrice: number) => {
    setEditingPriceKey(itemKey);
    setPriceEditValue(String(currentPrice));
  };

  const handleSavePriceEdit = () => {
    if (editingPriceKey === null) return;
    const newPrice = parseFloat(priceEditValue) || 0;
    if (newPrice < 0) {
      showToast('Price cannot be negative', 'error');
      return;
    }
    setEditItems((prev) =>
      prev.map((x) => (x._key === editingPriceKey ? { ...x, unitPrice: newPrice } : x))
    );
    setEditingPriceKey(null);
    setPriceEditValue('');
    showToast('Price updated', 'success');
  };

  const handleCancelPriceEdit = () => {
    setEditingPriceKey(null);
    setPriceEditValue('');
  };

  const handleOpenPDF = async () => {
    if (!order || pdfProcessingRef.current) return;
    pdfProcessingRef.current = true;
    setPdfLoading(true);
    try {
      const businessProfile = getBusinessProfileForPdf(supabaseData?.userSettings);
      const currencyForPdf = getSymbolForCurrencyCode(order.currency_code);
      const pdfBlob = await generateInvoicePDF(order, businessProfile, currencyForPdf);
      const fileName = invoicePdfFileName(order);

      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        try {
          const arrayBuffer = await pdfBlob.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);

          const writeResult = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Cache,
            recursive: true,
          });

          const filePath = writeResult.uri;

          // Android: use app FileProvider via native plugin (same as Share). The file-opener
          // plugin uses a separate authority and can crash when resolving paths.
          if (Capacitor.getPlatform() === 'android') {
            try {
              await OpenInvoicePdf.openFile({ path: filePath });
            } catch (nativeErr) {
              console.error('OpenInvoicePdf.openFile failed, falling back to FileOpener:', nativeErr);
              await FileOpener.open({
                filePath,
                contentType: 'application/pdf',
                openWithDefault: true,
              });
            }
          } else {
            await FileOpener.open({
              filePath,
              contentType: 'application/pdf',
              openWithDefault: true,
            });
          }
          showToast('Opening PDF…', 'success');
        } catch (err) {
          console.error('Open PDF error:', err);
          showToast('Could not open PDF. Please try again.', 'error');
        }
      } else {
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const opened = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
          URL.revokeObjectURL(pdfUrl);
          showToast('Allow pop-ups to view the PDF.', 'error');
        } else {
          showToast('Opening PDF…', 'success');
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 120_000);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to generate PDF', 'error');
    }
    setPdfLoading(false);
    pdfProcessingRef.current = false;
  };

  const handleShareWhatsApp = async () => {
    if (!order || pdfProcessingRef.current) return;
    pdfProcessingRef.current = true;
    setPdfLoading(true);
    try {
      const businessProfile = getBusinessProfileForPdf(supabaseData?.userSettings);
      const currencyForPdf = getSymbolForCurrencyCode(order.currency_code);
      const pdfBlob = await generateInvoicePDF(order, businessProfile, currencyForPdf);
      const fileName = invoicePdfFileName(order);

      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        try {
          // Android is more stable with a direct native ACTION_SEND flow.
          if (Capacitor.getPlatform() === 'android') {
            const arrayBuffer = await pdfBlob.arrayBuffer();
            const base64 = arrayBufferToBase64(arrayBuffer);
            const { uri } = await Filesystem.writeFile({
              path: fileName,
              data: base64,
              directory: Directory.Cache,
              recursive: true,
            });
            try {
              await OpenInvoicePdf.shareFile({
                path: uri,
                dialogTitle: 'Send invoice',
                title: `Invoice — ${order.customer_name}`,
                text: buildInvoiceShareText(order.customer_name),
              });
            } catch (nativeShareErr) {
              console.error('OpenInvoicePdf.shareFile failed, falling back to Share plugin:', nativeShareErr);
              try {
                await Share.share({
                  title: `Invoice — ${order.customer_name}`,
                  text: buildInvoiceShareText(order.customer_name),
                  url: uri,
                  dialogTitle: 'Send invoice',
                });
              } catch (shareErr) {
                console.error('Share plugin fallback failed, opening PDF instead:', shareErr);
                await handleOpenPDF();
                showToast('Invoice opened. Attach it manually if share is unavailable.', 'info');
                return;
              }
            }
            showToast('Choose an app to send the invoice', 'success');
          } else {
            showToast('Share is only configured for Android in this build.', 'info');
          }
        } catch (err) {
          console.error('Share invoice error:', err);
          showToast('Could not share invoice. Try Open PDF or Copy Bill.', 'error');
        }
      } else {
        // Web: Try native share or fallback to opening WhatsApp URL
        try {
          if (navigator.share) {
            await navigator.share({
              title: `Invoice - ${order.customer_name}`,
              text: buildInvoiceShareText(order.customer_name),
              files: [new File([pdfBlob], fileName, { type: 'application/pdf' })],
            });
            showToast('Invoice shared!', 'success');
          } else {
            // Fallback for web: download and suggest manual WhatsApp send
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
            showToast('Invoice downloaded. Please attach it in WhatsApp.', 'info');
          }
        } catch (err) {
          console.error('Web share error:', err);
          showToast('Failed to share invoice', 'error');
        }
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      // Fallback: Send bill as text if PDF generation fails
      try {
        const symbol = getSymbolForCurrencyCode(order.currency_code);
        const phone = ((order as any).customer_whatsapp || '').replace(/[^\d]/g, '');
        const text = encodeURIComponent(billText(order, symbol));
        await openExternalHttpsUrl(
          phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`
        );
        showToast('Opening WhatsApp with bill details', 'info');
      } catch {
        showToast('Failed to open WhatsApp', 'error');
      }
    } finally {
      setPdfLoading(false);
      pdfProcessingRef.current = false;
    }
  };

  const handleCopy = async () => {
    if (!order) return;
    const symbol = getSymbolForCurrencyCode(order.currency_code);
    try {
      await copyTextToClipboard(billText(order, symbol));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy. Try again.', 'error');
    }
  };

  const captureOrderSnapshotBlob = useCallback(async (): Promise<Blob | null> => {
    const el = orderShareCaptureRef.current;
    if (!el) return null;
    let restoreImages: (() => void) | undefined;
    try {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
      } catch {
        /* ignore */
      }
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      flushSnapshotLayout(el);

      await waitForImagesInElement(el);

      restoreImages = await prepareImagesForCaptureSnapshot(el);
      await waitForSnapshotPaintReady(el);
      flushSnapshotLayout(el);

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: COLORS.bg,
        imageTimeout: 30000,
        onclone: (clonedDoc) => {
          applyOrderSnapshotLayoutForClone(clonedDoc);
        },
      });
      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 0.92)
      );
    } catch (e) {
      console.error('captureOrderSnapshotBlob:', e);
      return null;
    } finally {
      restoreImages?.();
    }
  }, []);

  const handleDownloadOrderImage = async () => {
    if (!order || shareImageProcessingRef.current) return;
    shareImageProcessingRef.current = true;
    setShareImageLoading(true);
    try {
      const blob = await captureOrderSnapshotBlob();
      if (!blob) {
        showToast('Could not capture order view.', 'error');
        return;
      }
      const fileName = orderSnapshotPngFileName(order);
      if (Capacitor.isNativePlatform()) {
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
        showToast(`Saved ${fileName} to Documents`, 'success');
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 500);
        showToast('Image downloaded', 'success');
      }
    } catch (err) {
      console.error('Download order image error:', err);
      showToast('Could not save image.', 'error');
    } finally {
      setShareImageLoading(false);
      shareImageProcessingRef.current = false;
    }
  };

  const handleShareOrderImage = async () => {
    if (!order || shareImageProcessingRef.current) return;
    shareImageProcessingRef.current = true;
    setShareImageLoading(true);
    try {
      const blob = await captureOrderSnapshotBlob();
      if (!blob) {
        showToast('Could not capture order view.', 'error');
        return;
      }
      const fileName = orderSnapshotPngFileName(order);
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        try {
          if (Capacitor.getPlatform() === 'android') {
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = arrayBufferToBase64(arrayBuffer);
            const { uri } = await Filesystem.writeFile({
              path: fileName,
              data: base64,
              directory: Directory.Cache,
              recursive: true,
            });
            try {
              await OpenInvoicePdf.shareFile({
                path: uri,
                dialogTitle: 'Share order',
                title: `Order — ${order.customer_name}`,
                text: buildOrderImageShareText(order.customer_name),
              });
            } catch (nativeShareErr) {
              console.error('OpenInvoicePdf.shareFile failed:', nativeShareErr);
              await Share.share({
                title: `Order — ${order.customer_name}`,
                text: buildOrderImageShareText(order.customer_name),
                url: uri,
                dialogTitle: 'Share order',
              });
            }
            showToast('Choose an app to share', 'success');
          } else {
            showToast('Share image is optimized for Android in this build.', 'info');
          }
        } catch (err) {
          console.error('Share order image error:', err);
          showToast('Could not share image.', 'error');
        }
      } else {
        try {
          if (navigator.share) {
            await navigator.share({
              title: `Order — ${order.customer_name}`,
              text: buildOrderImageShareText(order.customer_name),
              files: [new File([blob], fileName, { type: 'image/png' })],
            });
            showToast('Shared!', 'success');
          } else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 500);
            showToast('Image downloaded', 'success');
          }
        } catch (err) {
          console.error('Web share order image:', err);
          showToast('Could not share. Try Download image.', 'error');
        }
      }
    } finally {
      setShareImageLoading(false);
      shareImageProcessingRef.current = false;
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    if (!guardOnline()) return;
    try {
      const { error } = await deleteOrder(order.id);
      if (error) {
        showToast('Failed to delete order', 'error');
        return;
      }
      showToast('Order deleted', 'success');
      navigate('/orders');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete order', 'error');
    }
  };

  // ── Loading ──
  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, fontFamily: FONT }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.blue, animation: 'spin 0.75s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: COLORS.subtle, fontSize: 14, margin: 0 }}>Loading order…</p>
      </div>
    </div>
  );

  if (!order) return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, fontFamily: FONT, padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>Order not found</div>
      <button onClick={handleBack} style={{ marginTop: 16, padding: '11px 24px', borderRadius: 100, border: 'none', background: COLORS.blue, color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        Back to Orders
      </button>
    </div>
  );

  const symbol = getSymbolForCurrencyCode(order.currency_code);
  const items: OrderItem[] = order.items || [];
  const phone = (order as any).customer_whatsapp || '';
  const editTotal = editItems.reduce((s, it) => s + ((it.unitPrice || 0) * it.quantity), 0);
  const statusCfg = getStatusConfig(order.status);

  return (
    <div {...swipeHandlers} style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: COLORS.bg, fontFamily: FONT, overflowX: 'hidden' }}>
      {/* Status bar */}
      <div style={{ position: 'fixed', inset: '0 0 auto', height: 40, background: '#1C1C1E', zIndex: 100 }} />

      {/* ── Header ── */}
      <div style={{
        position: 'sticky', top: 40, zIndex: 50,
        background: 'rgba(245,245,247,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        {/* Nav row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
          <button
            onClick={handleBack}
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surface, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLORS.blue, flexShrink: 0, transition: 'background 0.1s',
            }}
          >
            <Ic.Back />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: COLORS.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {editMode ? 'Edit Order' : order.customer_name}
            </div>
            {!editMode && (
              <div style={{ fontSize: 12, color: COLORS.subtle, marginTop: 1 }}>
                {formatDate(order.created_at)}
              </div>
            )}
          </div>
          {!editMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowStatusDrop(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px 6px 10px', borderRadius: 100,
                    background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
                    color: statusCfg.text, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusCfg.dot }} />
                  {statusCfg.label}
                  <span style={{ opacity: 0.7 }}><Ic.ChevronDown /></span>
                </button>
                {showStatusDrop && (
                  <StatusDropdown
                    current={order.status}
                    onChange={handleStatusChange}
                    onClose={() => setShowStatusDrop(false)}
                  />
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowActionsMenu(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, borderRadius: 100,
                    background: 'transparent', border: 'none',
                    color: COLORS.muted, cursor: 'pointer', fontFamily: FONT,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F7'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Ic.MoreVertical />
                </button>
                {showActionsMenu && (
                  <ActionsMenu
                    onClose={() => setShowActionsMenu(false)}
                    onWhatsApp={handleShareWhatsApp}
                    onOpenPDF={handleOpenPDF}
                    onCopyBill={handleCopy}
                    onDownloadOrderImage={handleDownloadOrderImage}
                    onShareOrderImage={handleShareOrderImage}
                    pdfLoading={pdfLoading}
                    shareImageLoading={shareImageLoading}
                    copied={copied}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status color bar */}
        <div style={{ height: 3, background: statusCfg.bg, borderTop: `1px solid ${statusCfg.border}` }}>
          <div style={{ height: '100%', background: statusCfg.dot, width: order.status === 'completed' ? '100%' : order.status === 'pending' ? '50%' : '0%', transition: 'width 0.5s ease', opacity: 0.5 }} />
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '4px 4px calc(96px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ animation: 'fadeUp 0.3s ease', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Customer + items: edit mode vs snapshot ref for share/download image ── */}
          {editMode ? (
            <>
              <SectionLabel>Customer Info</SectionLabel>
              <Card>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                      Customer Name
                    </label>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Enter name"
                      style={{
                        width: '100%', padding: '10px 12px',
                        borderRadius: 10, border: `1.5px solid ${COLORS.border}`,
                        fontSize: 15, background: '#FAFAFA',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                      WhatsApp Number
                    </label>
                    <input
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      type="tel" placeholder="+91 98xxxxxxxx"
                      style={{
                        width: '100%', padding: '10px 12px',
                        borderRadius: 10, border: `1.5px solid ${COLORS.border}`,
                        fontSize: 15, background: '#FAFAFA',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                    />
                  </div>
                </div>
              </Card>
              <SectionLabel>Edit Items</SectionLabel>
              <Card>
                <div style={{ padding: '4px 16px' }}>
                  {editItems.map((it, i) => (
                    <div key={it._key}>
                      {i > 0 && <Divider />}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 0',
                          gap: 12,
                          opacity: it.quantity === 0 ? 0.45 : 1,
                          transition: 'opacity 0.2s ease',
                        }}
                      >
                        <div style={{
  fontSize: 13, fontWeight: 700, color: '#94A3B8',
  flexShrink: 0, minWidth: 20, marginRight: -12,
}}>
  {i + 1}.
</div>
                        <ProductThumb url={resolveOrderItemImageUrl(it)} name={it.name} imageVersion={it.imageVersion} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>{it.name}</div>
                          {it.unitPrice ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.muted }}>
                              <span>{symbol}{it.unitPrice} / {getOrderUnitLabel(it.priceUnit)}</span>
                              <button
                                onClick={() => handleOpenPriceEdit(it._key, it.unitPrice || 0)}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 20, height: 20, borderRadius: 4,
                                  background: 'rgba(10, 132, 255, 0.08)',
                                  border: 'none', cursor: 'pointer',
                                  color: COLORS.blue, padding: 0,
                                  transition: 'background 0.15s',
                                  fontSize: 12,
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(10, 132, 255, 0.15)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(10, 132, 255, 0.08)'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12 }}>
                                  <Ic.Edit />
                                </div>
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <QtyStepper
                            value={it.quantity}
                            step={it.quantityStep ?? 1}
                            onChange={(qty) => {
                              setEditItems((prev) =>
                                prev.map((x) => (x._key === it._key ? { ...x, quantity: qty } : x))
                              );
                            }}
                          />
                          <div style={{ fontSize: 11, color: COLORS.muted }}>
                            ({Math.round(it.quantity / (it.quantityStep ?? 1))} sets)
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {editItems.length === 0 && (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: COLORS.subtle, fontSize: 14 }}>
                      No items remaining
                    </div>
                  )}
                </div>
                {orderCatalogueConfig && orderCatalogueId ? (
                  <div
                    style={{
                      borderTop: `1px solid ${COLORS.border}`,
                      padding: '12px 16px 16px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void safeHapticsLight();
                        setAddItemsOpen((o) => !o);
                      }}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 12,
                        border: '1px dashed rgba(0, 0, 0, 0.1)',
                        background: addItemsOpen ? 'rgba(10, 132, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                        color: COLORS.muted,
                        fontFamily: FONT,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <span style={{ color: addItemsOpen ? COLORS.blue : COLORS.subtle, display: 'flex' }}>
                        <Ic.Plus />
                      </span>
                      Add items
                      {orderCatalogueConfig.label ? (
                        <span style={{ fontWeight: 500, color: COLORS.muted, fontSize: 13 }}>
                          ({orderCatalogueConfig.label})
                        </span>
                      ) : null}
                    </button>
                    {addItemsOpen && (
                      <div style={{ marginTop: 12 }}>
                        <input
                          type="search"
                          value={addItemsSearch}
                          onChange={(e) => setAddItemsSearch(e.target.value)}
                          placeholder="Search products…"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: `1.5px solid ${COLORS.border}`,
                            fontSize: 14,
                            background: '#FAFAFA',
                            fontFamily: FONT,
                            marginBottom: 10,
                            boxSizing: 'border-box',
                          }}
                        />
                        <div
                          style={{
                            maxHeight: 280,
                            overflowY: 'auto',
                            borderRadius: 10,
                            border: `1px solid ${COLORS.border}`,
                            background: COLORS.surface,
                          }}
                        >
                          {addableCatalogueProducts.length === 0 ? (
                            <div
                              style={{
                                padding: '16px 12px',
                                textAlign: 'center',
                                color: COLORS.subtle,
                                fontSize: 13,
                              }}
                            >
                              {addItemsSearch.trim()
                                ? 'No matching products'
                                : 'All catalogue products are already in this order'}
                            </div>
                          ) : (
                            addableCatalogueProducts.map((p) => {
                              const catData = getCatalogueData(p, orderCatalogueId);
                              const unit = resolveListOfferEffective(
                                catData,
                                orderCatalogueConfig.priceField,
                                p as Record<string, unknown>
                              ).effectiveUnitPrice;
                              const thumbUrl =
                                (typeof p.imageUrl === 'string' && p.imageUrl.trim()) ||
                                (typeof (p as { image?: string }).image === 'string'
                                  ? (p as { image: string }).image.trim()
                                  : undefined);
                              return (
                                <button
                                  key={String(p.id)}
                                  type="button"
                                  onClick={() => handleAddProductFromCatalogue(p)}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 12px',
                                    border: 'none',
                                    borderBottom: `1px solid ${COLORS.border}`,
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontFamily: FONT,
                                  }}
                                >
                                  <ProductThumb
                                    url={thumbUrl}
                                    name={p.name || ''}
                                    imageVersion={p.imageVersion}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: COLORS.text,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {p.name}
                                    </div>
                                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                                      {symbol}
                                      {unit}{' '}
                                      / {getOrderUnitLabel(catData[orderCatalogueConfig.priceUnitField])}
                                    </div>
                                  </div>
                                  <span
                                    style={{
                                      flexShrink: 0,
                                      padding: '6px 12px',
                                      borderRadius: 10,
                                      border: '1px dashed rgba(0, 0, 0, 0.1)',
                                      background: 'rgba(255, 255, 255, 0.85)',
                                      boxShadow: '0 1px 0 rgba(0, 0, 0, 0.04)',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: COLORS.muted,
                                      letterSpacing: '0.02em',
                                    }}
                                  >
                                    Add
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </Card>

              {/* Price Edit Modal */}
              {editingPriceKey !== null && (
                <div style={{
                  position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)',
                  display: 'flex', alignItems: 'flex-end', zIndex: 1000,
                }}>
                  <div style={{
                    width: '100%', background: COLORS.surface,
                    borderRadius: '20px 20px 0 0', padding: '24px 16px 32px',
                    boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.1)',
                    animation: 'slideUp 0.3s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Edit Price</div>
                      <button
                        onClick={handleCancelPriceEdit}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: 'transparent', border: 'none',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: COLORS.muted,
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 8 }}>
                        Enter new price
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.text }}>{symbol}</span>
                        <input
                          type="number"
                          value={priceEditValue}
                          onChange={(e) => setPriceEditValue(e.target.value)}
                          placeholder="0"
                          autoFocus
                          style={{
                            flex: 1, padding: '12px 14px', borderRadius: 10,
                            border: `1.5px solid ${COLORS.border}`, fontSize: 16,
                            background: '#FAFAFA', fontFamily: FONT,
                            boxSizing: 'border-box',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePriceEdit();
                            if (e.key === 'Escape') handleCancelPriceEdit();
                            if (['ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={handleCancelPriceEdit}
                        style={{
                          flex: 1, padding: '12px', borderRadius: 10,
                          border: `1.5px solid ${COLORS.border}`, background: '#fff',
                          cursor: 'pointer', fontFamily: FONT, fontSize: 14,
                          fontWeight: 600, color: COLORS.muted, transition: 'background 0.15s',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSavePriceEdit}
                        style={{
                          flex: 1, padding: '12px', borderRadius: 10,
                          border: 'none', background: COLORS.blue,
                          cursor: 'pointer', fontFamily: FONT, fontSize: 14,
                          fontWeight: 600, color: '#fff', transition: 'opacity 0.15s',
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              ref={orderShareCaptureRef}
              data-order-snapshot-root
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 6,
                boxSizing: 'border-box',
                backgroundColor: COLORS.bg,
              }}
            >
              <SectionLabel>Customer</SectionLabel>
              <Card>
                <div
                  data-order-customer-snapshot-row
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  {/*
                    Avatar wrapper keeps canvas rasterization inside one flex child (see replaceCustomerAvatarWithCanvasForCapture).
                    data-order-customer-text-snapshot is for html2canvas onclone only.
                  */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div
                        data-order-avatar-capture
                        data-dot={statusCfg.dot}
                        data-initial={(order.customer_name || '?').charAt(0).toUpperCase()}
                        style={{
                          width: 44, height: 44, borderRadius: 22,
                          background: `${statusCfg.dot}18`,
                          border: `2px solid ${statusCfg.dot}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, fontWeight: 700, color: statusCfg.dot, flexShrink: 0,
                        }}
                      >
                        {(order.customer_name || '?').charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div data-order-customer-text-snapshot>
                      <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>{order.customer_name}</div>
                      {phone ? (
                        <a
                          href={`https://wa.me/${phone.replace(/[^\d]/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, color: '#25D366', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}
                        >
                          <Ic.WhatsApp size={12} />
                          {phone}
                        </a>
                      ) : (
                        <div style={{ fontSize: 12, color: COLORS.subtle, marginTop: 1 }}>No phone saved</div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.5px' }}>
                      {order.total_amount ? formatMoney(order.total_amount, symbol) : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.subtle, marginTop: 2 }}>
                      {items.length} item{items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </Card>
              <SectionLabel>Order Items</SectionLabel>
              <Card>
                <div style={{ padding: '4px 16px' }}>
                  {items.map((item, i) => {
                    const hasCost = item.unitPrice != null && item.unitPrice > 0;
                    const lineTotal = item.rowTotal || (hasCost ? item.unitPrice! * item.quantity : null);
                    return (
                      <div key={i}>
                        {i > 0 && <Divider />}
                        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0', gap: 12 }}>
                          <div style={{
  fontSize: 13, fontWeight: 700, color: '#94A3B8',
  flexShrink: 0, minWidth: 20, marginRight: -12,
}}>
  {i + 1}.
</div>
                          <ProductThumb url={resolveOrderItemImageUrl(item)} name={item.name} imageVersion={item.imageVersion} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{item.name}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {item.subtitle && (
                                <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500, display: 'inline-block', backgroundColor: '#f5f5f7', borderRadius: 4, padding: '3px 6px' }}>
                                  {item.subtitle}
                                </div>
                              )}
                              {item.variantSummary && parseVariantSummary(item.variantSummary).map((pill, idx) => (
                                <div key={idx} style={{ fontSize: 12, color: COLORS.green, fontWeight: 500, display: 'inline-block', backgroundColor: COLORS.greenLight, borderRadius: 4, padding: '3px 6px' }}>
                                  {pill}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div
                            data-order-snapshot-line-right
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}
                          >
                            {hasCost && (
                              <div style={{ fontSize: 12, color: COLORS.muted }}>
                                {item.quantity} {getOrderUnitLabel(item.priceUnit)} ({Math.round(item.quantity / (item.quantityStep ?? 1))}) × {symbol}{item.unitPrice}
                              </div>
                            )}
                            {!hasCost && (
                              <div style={{ fontSize: 12, color: COLORS.muted }}>
                                Qty: {item.quantity} {getOrderUnitLabel(item.priceUnit)}
                              </div>
                            )}
                            {lineTotal != null ? (
                              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>
                                {formatMoney(lineTotal, symbol)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div
                    data-order-snapshot-order-total-row
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 0 10px',
                      marginTop: 4,
                      borderTop: `2px solid ${COLORS.border}`,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.muted }}>Order Total</span>
                    <span
                      data-order-snapshot-order-total-value
                      style={{ fontSize: 20, fontWeight: 800, color: COLORS.green, letterSpacing: '-0.4px' }}
                    >
                      {order.total_amount ? formatMoney(order.total_amount, symbol) : '—'}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── Edit mode total ── */}
          {editMode && editTotal > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: COLORS.greenLight, borderRadius: 12, padding: '12px 16px',
              border: `1px solid #BBF7D0`,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>Updated Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>{formatMoney(editTotal, symbol)}</span>
            </div>
          )}

          {/* ── Actions (edit mode) ── */}
          {editMode ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setEditModeSync(false)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 14,
                  border: `1.5px solid ${COLORS.border}`, background: COLORS.surface,
                  fontSize: 15, fontWeight: 600, cursor: 'pointer', color: COLORS.muted, fontFamily: FONT,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saveLoading}
                style={{
                  flex: 2, padding: '14px', borderRadius: 14,
                  border: 'none', background: saveLoading ? '#A3E6BE' : COLORS.green,
                  fontSize: 15, fontWeight: 700, cursor: saveLoading ? 'not-allowed' : 'pointer',
                  color: '#fff', fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.2s',
                }}
              >
                {saveLoading ? (
                  <>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                    Saving…
                  </>
                ) : 'Save Changes'}
              </button>
            </div>
          ) : (
            <>
              <div style={{ padding: '0 6px' }}>
                <SectionLabel>Quick Actions</SectionLabel>
                <div style={{ padding: '4px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['pending', 'completed', 'cancelled'] as StatusType[]).filter(s => s !== order.status).map(s => {
                    const cfg = getStatusConfig(s);
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        style={{
                          flex: 1, padding: '11px 8px', borderRadius: 12,
                          border: `1.5px solid ${cfg.dot}25`,
                          background: cfg.bg, cursor: 'pointer',
                          fontSize: 12.5, fontWeight: 600, color: cfg.text, fontFamily: FONT,
                          transition: 'transform 0.1s',
                        }}
                      >
                        {s === 'completed' ? '✓ Complete' : s === 'cancelled' ? '✕ Cancel' : '↩ Reopen'}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleEnterEditMode}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 14,
                    border: `1.5px solid ${COLORS.border}`, background: COLORS.surface,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    color: COLORS.text, fontFamily: FONT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.15s',
                  }}
                >
                  <Ic.Edit />
                  Edit Order
                </button>

                {showDeleteConfirm ? (
                  <div style={{
                    background: '#FFF1F2', borderRadius: 14, border: `1.5px solid #FECDD3`,
                    padding: '16px',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#881337', textAlign: 'center', marginBottom: 4 }}>
                      Delete this order?
                    </div>
                    <div style={{ fontSize: 12, color: '#BE123C', textAlign: 'center', marginBottom: 14 }}>
                      This action cannot be undone.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowDeleteConfirm(false)} style={{
                        flex: 1, padding: '11px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`,
                        background: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: COLORS.muted,
                      }}>Keep</button>
                      <button onClick={handleDelete} style={{
                        flex: 1, padding: '11px', borderRadius: 10, border: 'none',
                        background: '#F43F5E', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#fff',
                      }}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      width: '100%', padding: '12px', borderRadius: 12,
                      border: `1.5px solid #FECDD3`, background: '#FFF1F2',
                      cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#F43F5E',
                      transition: 'background 0.15s',
                    }}
                  >
                    <Ic.Trash />
                    Delete Order
                  </button>
                )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <MainAppBottomNav active="orders" />
      {shareImageLoading ? (
        <SyncBusyOverlay
          title="Preparing image…"
          subtitle="Order summary"
          zClassName="z-[200]"
        />
      ) : null}
    </div>
  );
}
