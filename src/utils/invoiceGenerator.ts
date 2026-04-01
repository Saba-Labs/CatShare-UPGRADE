/**
 * invoiceGenerator.ts
 * Generates a clean, professional invoice PDF from an order.
 * Uses jsPDF directly — no html2canvas dependency.
 */

import { jsPDF } from 'jspdf';
import type { BusinessProfile } from '../config/businessProfile';

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  rowTotal?: number;
  category?: string;
  imageUrl?: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_whatsapp?: string;
  items?: OrderItem[];
  total_amount?: number;
  currency_code?: string;
  status: string;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getInvoiceNumber(orderId: string): string {
  const short = orderId.replace(/-/g, '').substring(0, 8).toUpperCase();
  return `INV-${short}`;
}

function getStatusColors(status: string): { bg: number[]; text: number[]; border: number[] } {
  switch (status) {
    case 'completed': return { bg: [220, 252, 231], text: [22, 101, 52],  border: [134, 239, 172] };
    case 'pending':   return { bg: [254, 249, 195], text: [133, 77, 14],  border: [253, 224, 71]  };
    case 'cancelled': return { bg: [255, 228, 230], text: [159, 18, 57],  border: [253, 164, 175] };
    default:          return { bg: [241, 245, 249], text: [71, 85, 105],  border: [203, 213, 225] };
  }
}

/**
 * Render any text — including Unicode currency symbols (₹, €, etc.) and
 * emoji — to a crisp PNG via canvas, then embed in the PDF as an image.
 * jsPDF's built-in fonts cannot render these characters correctly.
 */
function renderTextToImage(
  text: string,
  fontSize = 40,
  color = '#0f172a',
  bold = false,
): { dataUrl: string; width: number; height: number } | null {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const weight = bold ? '700' : '400';
    const font   = `${weight} ${fontSize}px -apple-system, "Segoe UI", Arial, sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(text);

    const pad    = fontSize * 0.4;
    const scale  = 3; // high-res for crisp text
    const cw     = metrics.width + pad * 2;
    const ch     = fontSize * 1.8;

    canvas.width  = cw * scale;
    canvas.height = ch * scale;

    ctx.scale(scale, scale);
    ctx.font          = font;
    ctx.fillStyle     = color;
    ctx.textBaseline  = 'middle';
    ctx.fillText(text, pad, ch / 2);

    return { dataUrl: canvas.toDataURL('image/png'), width: cw, height: ch };
  } catch {
    return null;
  }
}

/**
 * Add a canvas-rendered text image to the PDF, vertically centred at `midY`.
 * Returns the rendered width in mm (useful for layout).
 */
function addTextImage(
  pdf: jsPDF,
  text: string,
  x: number,
  midY: number,
  targetHeightMm: number,
  color: string,
  fontSize = 36,
  bold = false,
  alignRight = false,
): number {
  const img = renderTextToImage(text, fontSize, color, bold);
  if (!img) return 0;
  const wMm = (img.width / img.height) * targetHeightMm;
  const drawX = alignRight ? x - wMm : x;
  pdf.addImage(img.dataUrl, 'PNG', drawX, midY - targetHeightMm / 2, wMm, targetHeightMm);
  return wMm;
}

// ─── Section renderers ───────────────────────────────────────────────────────

/** Dark header band */
function drawHeader(
  pdf: jsPDF,
  order: Order,
  business: BusinessProfile,
  pageWidth: number,
  margin: number,
  headerH: number,
) {
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, headerH, 'F');

  // ── Left: business info ──
  const businessName = business.businessName?.trim() || 'Your Business';
  let y = 13;

  // Business name via canvas (handles any Unicode in the name)
  addTextImage(pdf, businessName, margin, y + 3, 6, '#ffffff', 42, true);
  y += 9;

  // Meta lines — plain ASCII so jsPDF font is fine
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);

  const metaLines: string[] = [];
  if ((business as any).businessAddress) metaLines.push((business as any).businessAddress.trim());
  const cp: string[] = [];
  if ((business as any).businessPhone) cp.push((business as any).businessPhone.trim());
  if ((business as any).businessEmail) cp.push((business as any).businessEmail.trim());
  if (cp.length) metaLines.push(cp.join('  ·  '));
  if ((business as any).gstNumber) metaLines.push(`GST: ${(business as any).gstNumber.trim()}`);

  const maxW = pageWidth * 0.55;
  for (const line of metaLines) {
    for (const wl of pdf.splitTextToSize(line, maxW)) {
      pdf.text(wl, margin, y);
      y += 4.2;
    }
  }

  // ── Right: invoice badge ──
  const bx = pageWidth - margin;

  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('INVOICE', bx, 12, { align: 'right' });

  // Invoice number
  addTextImage(pdf, getInvoiceNumber(order.id), bx, 22, 7.5, '#ffffff', 52, true, true);

  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(formatDate(order.created_at), bx, 30, { align: 'right' });
}

/** Green solid accent line below header */
function drawAccentLine(pdf: jsPDF, y: number, pageWidth: number) {
  pdf.setFillColor(22, 163, 74); // #16A34A
  pdf.rect(0, y, pageWidth, 3, 'F');
}

/** Bill-To + Status chip row */
function drawBillToRow(
  pdf: jsPDF,
  order: Order,
  y: number,
  margin: number,
  pageWidth: number,
): number {
  const labelColor: [number, number, number] = [148, 163, 184];
  const darkColor:  [number, number, number] = [15, 23, 42];

  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(...labelColor);
  pdf.text('BILL TO', margin, y);
  pdf.text('STATUS', pageWidth - margin, y, { align: 'right' });

  y += 5.5;

  // Customer name via canvas
  addTextImage(pdf, order.customer_name, margin, y + 2, 5.5, '#0f172a', 44, true);
  y += 7;

  if (order.customer_whatsapp) {
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    // Avoid emoji — use plain text prefix
    pdf.text(`Ph: ${order.customer_whatsapp}`, margin, y);
  }

  // Status chip
  const statusLabel  = order.status.charAt(0).toUpperCase() + order.status.slice(1);
  const sc           = getStatusColors(order.status);
  const chipW = 30, chipH = 9;
  const chipX = pageWidth - margin - chipW;
  const chipY = y - 12;

  pdf.setFillColor(...(sc.bg   as [number,number,number]));
  pdf.setDrawColor(...(sc.border as [number,number,number]));
  pdf.setLineWidth(0.4);
  (pdf as any).roundedRect(chipX, chipY, chipW, chipH, 4, 4, 'FD');

  // Dot
  pdf.setFillColor(...(sc.text as [number,number,number]));
  pdf.circle(chipX + 5.5, chipY + chipH / 2, 1.5, 'F');

  // Status label via canvas so it's always crisp
  addTextImage(
    pdf, statusLabel,
    chipX + chipW / 2 + 1, chipY + chipH / 2,
    4, `rgb(${sc.text.join(',')})`, 30, true,
  );

  return y + 6;
}

/** Items table — full border box, no emojis */
function drawItemsTable(
  pdf: jsPDF,
  items: OrderItem[],
  symbol: string,
  startY: number,
  margin: number,
  pageWidth: number,
): number {
  const contentW = pageWidth - 2 * margin;
  const rowH     = 13;
  const headH    = 10;
  const totalH   = headH + items.length * rowH;

  // Column X positions
  const colItem   = margin;
  const colQty    = margin + contentW * 0.55;
  const colRate   = margin + contentW * 0.72;
  const colAmount = margin + contentW;

  // ── Outer border (full table) ──
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.35);
  (pdf as any).roundedRect(margin, startY, contentW, totalH, 3, 3, 'S');

  // ── Header background ──
  pdf.setFillColor(248, 250, 252);
  (pdf as any).roundedRect(margin, startY, contentW, headH, 3, 3, 'F');

  // Header bottom divider
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(margin, startY + headH, margin + contentW, startY + headH);

  // Header labels
  const hMid = startY + headH / 2 + 1;
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text('ITEM',   colItem + 4,    hMid);
  pdf.text('QTY',    colQty  + (colRate - colQty) / 2, hMid, { align: 'center' });
  pdf.text('RATE',   colRate + (colAmount - colRate) / 2, hMid, { align: 'center' });
  pdf.text('AMOUNT', colAmount - 4,  hMid, { align: 'right' });

  let y = startY + headH;

  for (let i = 0; i < items.length; i++) {
    const item      = items[i];
    const hasCost   = item.unitPrice != null && item.unitPrice > 0;
    const lineTotal = item.rowTotal ?? (hasCost ? item.unitPrice! * item.quantity : null);
    const rowMidY   = y + rowH / 2;

    // Row separator (skip after last row)
    if (i > 0) {
      pdf.setDrawColor(241, 245, 249);
      pdf.setLineWidth(0.2);
      pdf.line(margin, y, margin + contentW, y);
    }

    // ── Item box icon (drawn, no emoji) ──
    const iconX = colItem + 3;
    const iconY = rowMidY - 3;
    const iconS = 6;
    pdf.setFillColor(241, 245, 249);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    (pdf as any).roundedRect(iconX, iconY, iconS, iconS, 1, 1, 'FD');
    // Small square inside as "product" symbol
    pdf.setFillColor(148, 163, 184);
    pdf.rect(iconX + 1.5, iconY + 1.5, 3, 3, 'F');

    // ── Item name ──
    const nameX    = colItem + 12;
    const nameMaxW = colQty - nameX - 3;
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    const nameLines = pdf.splitTextToSize(item.name, nameMaxW);
    pdf.text(nameLines[0], nameX, item.category ? rowMidY - 1 : rowMidY + 1);

    if (item.category) {
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(item.category, nameX, rowMidY + 4);
    }

    // ── Qty ──
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(55, 65, 81);
    pdf.text(String(item.quantity), colQty + (colRate - colQty) / 2, rowMidY + 1, { align: 'center' });

    // ── Rate (canvas for ₹) ──
    if (hasCost) {
      const rateStr = `${symbol}${item.unitPrice!.toLocaleString('en-IN')}`;
      addTextImage(pdf, rateStr, colRate + (colAmount - colRate) / 2, rowMidY, 4, '#374151', 30, false, false);
    } else {
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text('—', colRate + (colAmount - colRate) / 2, rowMidY + 1, { align: 'center' });
    }

    // ── Amount (canvas for ₹) ──
    if (lineTotal != null) {
      const amtStr = `${symbol}${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      addTextImage(pdf, amtStr, colAmount - 4, rowMidY, 4.2, '#0f172a', 32, true, true);
    } else {
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text('—', colAmount - 4, rowMidY + 1, { align: 'right' });
    }

    y += rowH;
  }

  return y; // returns exact bottom edge of table
}

/** Totals block — right-aligned, tight spacing */
function drawTotals(
  pdf: jsPDF,
  items: OrderItem[],
  total: number,
  symbol: string,
  y: number,
  margin: number,
  pageWidth: number,
  gstNumber?: string,
): number {
  const subtotal     = items.reduce((s, it) => s + (it.rowTotal ?? ((it.unitPrice || 0) * it.quantity)), 0);
  const hasAnyPrice  = items.some(it => it.unitPrice != null && it.unitPrice > 0);
  const showSubtotal = hasAnyPrice && subtotal !== total;

  const labelX = pageWidth - margin - 55;
  const valueX = pageWidth - margin;

  y += 5;

  if (showSubtotal) {
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Subtotal', labelX, y);

    const subStr = `${symbol}${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    addTextImage(pdf, subStr, valueX, y, 4, '#374151', 28, false, true);
    y += 7;
  }

  // Divider line
  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(0.6);
  pdf.line(labelX, y, valueX, y);
  y += 6;

  // Grand total label
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Total', labelX, y);

  // Grand total value via canvas
  if (total > 0) {
    const gtStr = `${symbol}${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    addTextImage(pdf, gtStr, valueX, y, 5.5, '#16A34A', 40, true, true);
  } else {
    pdf.setTextColor(148, 163, 184);
    pdf.text('—', valueX, y, { align: 'right' });
  }

  y += 6;

  if (gstNumber) {
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`GST No. ${gstNumber}`, valueX, y, { align: 'right' });
    y += 5;
  }

  return y;
}

/** Thank-you note box — no emoji, clean layout */
function drawThankYouBox(
  pdf: jsPDF,
  y: number,
  margin: number,
  pageWidth: number,
): number {
  const contentW = pageWidth - 2 * margin;
  const boxH     = 16;

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  (pdf as any).roundedRect(margin, y, contentW, boxH, 3, 3, 'FD');

  // Green left accent bar
  pdf.setFillColor(22, 163, 74);
  (pdf as any).roundedRect(margin, y, 2.5, boxH, 1.5, 1.5, 'F');

  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(22, 163, 74);
  pdf.text('Thank you for your order!', margin + 6, y + 6);

  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    'If you have any questions about this invoice, please contact us. We appreciate your business.',
    margin + 6,
    y + 11.5,
    { maxWidth: contentW - 10 },
  );

  return y + boxH;
}

/** Footer — pinned to bottom of page */
function drawFooter(pdf: jsPDF, pageWidth: number, pageHeight: number) {
  const footerH = 14;
  const footerY = pageHeight - footerH;

  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, footerY, pageWidth, footerH, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.line(0, footerY, pageWidth, footerY);

  const midY = footerY + footerH / 2 + 1;

  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text('This is a computer-generated invoice. No signature required.', margin + 2, midY);

  // Right: "Generated with CatShare"
  const catshare = 'CatShare';
  const prefix   = 'Generated with ';
  const prefixW  = pdf.getTextWidth(prefix);
  const brandW   = pdf.getTextWidth(catshare);
  const totalW   = prefixW + brandW;
  const startX   = pageWidth - margin - 2 - totalW;

  pdf.setTextColor(148, 163, 184);
  pdf.text(prefix, startX, midY);

  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(22, 163, 74);
  pdf.text(catshare, startX + prefixW, midY);
}

// ─── Public API ──────────────────────────────────────────────────────────────

const margin = 14;

export async function generateInvoicePDF(
  order: Order,
  business: BusinessProfile,
  symbol: string,
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth  = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const items   = order.items || [];
  const total   = order.total_amount
    ?? items.reduce((s, it) => s + (it.rowTotal ?? ((it.unitPrice || 0) * it.quantity)), 0);
  const headerH = 44;

  drawHeader(pdf, order, business, pageWidth, margin, headerH);
  drawAccentLine(pdf, headerH, pageWidth);

  let y = headerH + 3; // just below accent line

  y = drawBillToRow(pdf, order, y + 8, margin, pageWidth);

  y += 4; // gap before table

  y = drawItemsTable(pdf, items, symbol, y, margin, pageWidth);

  y = drawTotals(pdf, items, total, symbol, y, margin, pageWidth, (business as any).gstNumber);

  y += 5; // gap before thank-you box

  drawThankYouBox(pdf, y, margin, pageWidth);
  drawFooter(pdf, pageWidth, pageHeight);

  return pdf.output('blob') as Blob;
}