/**
 * invoiceGenerator.ts
 * Features: Multi-page support, Unit labels, Subtitles, and High-Contrast Table.
 */

import { jsPDF } from 'jspdf';
import type { BusinessProfile } from '../config/businessProfile';

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  rowTotal?: number;
  category?: string;
  subtitle?: string;
  priceUnit?: string;
}

function formatQuantityLabel(quantity: number, priceUnit?: string): string {
  if (!priceUnit || String(priceUnit).trim() === '' || priceUnit === 'None') {
    return `${quantity} Units`;
  }
  const cleaned = String(priceUnit).replace(/^\s*\/\s*/i, '').trim();
  return `${quantity} ${cleaned}`;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_whatsapp?: string;
  items?: OrderItem[];
  total_amount?: number;
  created_at: string;
}

const MARGIN = 16;
const PAGE_BREAK_THRESHOLD = 260; // MM before jumping to new page

function normalizePdfCurrencySymbol(symbol: string): string {
  return String(symbol || '').trim();
}

function formatAmountNumber(amount: number, locale?: string): string {
  return locale
    ? amount.toLocaleString(locale, { minimumFractionDigits: 2 })
    : amount.toLocaleString();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return [r, g, b];
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return [r, g, b];
}

function addUniformText(
  pdf: jsPDF, text: string, x: number, y: number, 
  sizeMm: number, color: string, bold = false, align: 'left' | 'center' | 'right' = 'left'
) {
  const safeText = String(text ?? '');
  const [r, g, b] = hexToRgb(color);

  // jsPDF uses points for font size. Convert from mm-like visual size.
  const fontSizePt = Math.max(7, sizeMm * 2.6);

  pdf.setFont('helvetica', bold ? 'bold' : 'normal');
  pdf.setFontSize(fontSizePt);
  pdf.setTextColor(r, g, b);
  pdf.text(safeText, x, y, { align, baseline: 'middle' });
}

type CurrencyGlyph = { dataUrl: string; width: number; height: number };
const currencyGlyphCache = new Map<string, CurrencyGlyph>();

function getCurrencyGlyph(symbol: string, color: string, bold: boolean): CurrencyGlyph | null {
  const key = `${symbol}|${color}|${bold ? 'b' : 'n'}`;
  const cached = currencyGlyphCache.get(key);
  if (cached) return cached;

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const fontPx = 64;
    const font = `${bold ? '700' : '500'} ${fontPx}px Arial, "Noto Sans", sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(symbol);
    const width = Math.ceil(metrics.width + 24);
    const height = Math.ceil(fontPx * 1.4);
    canvas.width = width;
    canvas.height = height;

    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 10, height / 2);

    const glyph = {
      dataUrl: canvas.toDataURL('image/png'),
      width,
      height,
    };
    currencyGlyphCache.set(key, glyph);
    return glyph;
  } catch {
    return null;
  }
}

function addCurrencyAmount(
  pdf: jsPDF,
  symbol: string,
  amountText: string,
  x: number,
  y: number,
  sizeMm: number,
  color: string,
  bold = false,
  align: 'left' | 'center' | 'right' = 'left'
) {
  const [r, g, b] = hexToRgb(color);
  const fontSizePt = Math.max(7, sizeMm * 2.6);
  pdf.setFont('helvetica', bold ? 'bold' : 'normal');
  pdf.setFontSize(fontSizePt);
  pdf.setTextColor(r, g, b);

  const glyph = getCurrencyGlyph(symbol, color, bold);
  if (!glyph) {
    pdf.text(`${symbol} ${amountText}`, x, y, { align, baseline: 'middle' });
    return;
  }

  const textWidth = pdf.getTextWidth(amountText);
  // Keep symbol visually even with adjacent numeric text across row + grand total.
  const glyphH = Math.max(3.9, sizeMm * 1.12);
  const glyphW = (glyph.width / glyph.height) * glyphH;
  const gap = 0.6;
  const totalW = glyphW + gap + textWidth;

  let startX = x;
  if (align === 'center') startX = x - totalW / 2;
  if (align === 'right') startX = x - totalW;

  const glyphY = y - glyphH / 2 + 0.15;
  pdf.addImage(glyph.dataUrl, 'PNG', startX, glyphY, glyphW, glyphH);
  pdf.text(amountText, startX + glyphW + gap, y, { align: 'left', baseline: 'middle' });
}

// ─── Component Renderers ─────────────────────────────────────────────────────

function drawHeader(pdf: jsPDF, order: Order, business: BusinessProfile, pageWidth: number) {
  const headerH = 48;
  pdf.setFillColor(15, 23, 42); 
  pdf.rect(0, 0, pageWidth, headerH, 'F');

  addUniformText(pdf, (business.businessName || 'Your Business').toUpperCase(), MARGIN, 20, 8, '#FFFFFF', true);

  pdf.setFillColor(22, 163, 74); 
  pdf.rect(0, headerH, pageWidth, 3, 'F');

  const bx = pageWidth - MARGIN;
  addUniformText(pdf, 'INVOICE', bx, 15, 4, '#94A3B8', true, 'right');
  addUniformText(pdf, `INV-${order.id.substring(0, 8).toUpperCase()}`, bx, 24, 7, '#FFFFFF', true, 'right');
  addUniformText(pdf, formatDate(order.created_at), bx, 34, 5, '#CBD5E1', false, 'right');
}

function drawTableHeader(pdf: jsPDF, y: number, pageWidth: number) {
  const contentW = pageWidth - 2 * MARGIN;
  pdf.setFillColor(241, 245, 249); // Lighter background for header
  pdf.rect(MARGIN, y, contentW, 14, 'F');
  
  const hY = y + 7;
  const colQty = MARGIN + contentW * 0.65;
  const colRate = MARGIN + contentW * 0.82;
  const colTotal = MARGIN + contentW;
  
  // INCREASED FONT SIZE FOR HEADINGS
  addUniformText(pdf, 'ITEM', MARGIN + 4, hY, 4.5, '#0F172A', true);
  addUniformText(pdf, 'QTY', colQty, hY, 4.5, '#0F172A', true, 'center');
  addUniformText(pdf, 'RATE', colRate, hY, 4.5, '#0F172A', true, 'center');
  addUniformText(pdf, 'TOTAL', colTotal - 4, hY, 4.5, '#0F172A', true, 'right');
  
  return y + 14;
}

function drawFooter(pdf: jsPDF, pageWidth: number, pageHeight: number) {
  const footerH = 15;
  const footerY = pageHeight - footerH;

  // Subtle footer band
  pdf.setFillColor(250, 251, 253);
  pdf.rect(0, footerY, pageWidth, footerH, 'F');
  pdf.setDrawColor(235, 240, 246);
  pdf.line(0, footerY, pageWidth, footerY);

  const textY = footerY + (footerH / 2) + 1;
  addUniformText(pdf, 'This is a computer generated document.', MARGIN, textY, 3.8, '#A3AFBF');

  const brandX = pageWidth - MARGIN;
  addUniformText(pdf, 'Generated by  ', brandX - 14, textY, 3.8, '#A3AFBF', false, 'right');
  addUniformText(pdf, 'CatShare', brandX, textY, 3.8, '#23824C', false, 'right');
}

// ─── Main Logic ──────────────────────────────────────────────────────────────

export async function generateInvoicePDF(order: Order, business: BusinessProfile, symbol: string): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const currency = normalizePdfCurrencySymbol(symbol);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  drawHeader(pdf, order, business, pageWidth);

  // Bill To (Large Heading)
  let currentY = 65;
  addUniformText(pdf, 'BILL TO', MARGIN, currentY, 4.5, '#64748B', true);
  currentY += 9;
  addUniformText(pdf, order.customer_name, MARGIN, currentY, 7, '#000000', true);
  currentY += 18;

  // Table Start
  currentY = drawTableHeader(pdf, currentY, pageWidth);

  const items = order.items || [];
  const contentW = pageWidth - 2 * MARGIN;
  const colQty = MARGIN + contentW * 0.65;
  const colRate = MARGIN + contentW * 0.82;
  const colTotal = MARGIN + contentW;
  const rowH = 16;

  items.forEach((item, index) => {
    // Check for page break
    if (currentY > PAGE_BREAK_THRESHOLD) {
      drawFooter(pdf, pageWidth, pageHeight);
      pdf.addPage();
      currentY = 20; // Margin at top of new page
      currentY = drawTableHeader(pdf, currentY, pageWidth);
    }

    const midY = currentY + (rowH / 2);
    pdf.setDrawColor(241, 245, 249);
    pdf.line(MARGIN, currentY + rowH, MARGIN + contentW, currentY + rowH);

    // 1. Item Name + Subtitle
    addUniformText(pdf, item.name, MARGIN + 4, currentY + 5.5, 5, '#000000', false);
    if (item.subtitle) {
      addUniformText(pdf, item.subtitle, MARGIN + 4, currentY + 11.5, 3.8, '#64748B', false);
    }

    // 2. Qty + Unit
    const qtyLabel = formatQuantityLabel(item.quantity, item.priceUnit);
    addUniformText(pdf, qtyLabel, colQty, midY, 5, '#000000', false, 'center');
    
    // 3. Rate (Now Black)
    addCurrencyAmount(
      pdf,
      currency,
      formatAmountNumber(item.unitPrice || 0),
      colRate,
      midY,
      5,
      '#000000',
      false,
      'center'
    );

    // 4. Total
    addCurrencyAmount(
      pdf,
      currency,
      formatAmountNumber(item.rowTotal || (item.unitPrice || 0) * item.quantity),
      colTotal - 4,
      midY,
      5,
      '#000000',
      false,
      'right'
    );

    currentY += rowH;
  });

  // Totals & Thank You Box (Ensure they don't get cut off)
  if (currentY > 230) {
    drawFooter(pdf, pageWidth, pageHeight);
    pdf.addPage();
    currentY = 20;
  }

  currentY += 15;
  addUniformText(pdf, 'GRAND TOTAL', MARGIN, currentY, 5.5, '#64748B', true);
  addCurrencyAmount(
    pdf,
    currency,
    formatAmountNumber(order.total_amount || 0, 'en-IN'),
    pageWidth - MARGIN - 4,
    currentY,
    8.5,
    '#16A34A',
    true,
    'right'
  );

  // Thank You Box
  currentY += 15;
  pdf.setFillColor(248, 250, 252);
  (pdf as any).roundedRect(MARGIN, currentY, pageWidth - (MARGIN * 2), 20, 2, 2, 'F');
  pdf.setFillColor(22, 163, 74);
  pdf.rect(MARGIN, currentY, 2.5, 20, 'F');
  addUniformText(pdf, 'Thank you for your business!', MARGIN + 8, currentY + 7, 4.5, '#16A34A', true);
  addUniformText(pdf, 'Please contact us if you have any questions regarding this invoice.', MARGIN + 8, currentY + 14, 3.8, '#64748B');

  // Final page footer
  drawFooter(pdf, pageWidth, pageHeight);

  return pdf.output('blob') as Blob;
}
