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
 * Render text (especially currency symbols like ₹) to a PNG data URL via canvas.
 * Keeps Unicode symbols crisp in PDF output.
 */
function renderTextToImage(
  text: string,
  fontSize = 40,
  color = '#0f172a'
): { dataUrl: string; width: number; height: number } | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const font = `600 ${fontSize}px Arial, sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(text);

  const scale = 2;
  canvas.width  = (metrics.width + 20) * scale;
  canvas.height = fontSize * 1.6  * scale;

  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 10, (fontSize * 1.6) / 2);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width:   metrics.width + 20,
    height:  fontSize * 1.6,
  };
}

// ─── Section renderers ───────────────────────────────────────────────────────

/** Dark header band — mirrors the HTML template's .header-band */
function drawHeader(
  pdf: jsPDF,
  order: Order,
  business: BusinessProfile,
  pageWidth: number,
  margin: number,
  headerH: number
) {
  // Dark background
  pdf.setFillColor(15, 23, 42); // #0F172A
  pdf.rect(0, 0, pageWidth, headerH, 'F');

  // ── Left: business info ──
  let y = 14;
  const businessName = business.businessName?.trim() || 'Your Business';

  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(255, 255, 255);
  pdf.text(businessName, margin, y);
  y += 7;

  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(148, 163, 184); // slate-400

  const metaLines: string[] = [];
  if (business.businessAddress) metaLines.push(business.businessAddress.trim());

  const contactParts: string[] = [];
  if ((business as any).businessPhone) contactParts.push((business as any).businessPhone.trim());
  if ((business as any).businessEmail) contactParts.push((business as any).businessEmail.trim());
  if (contactParts.length) metaLines.push(contactParts.join('   ·   '));
  if ((business as any).gstNumber) metaLines.push(`GST: ${(business as any).gstNumber.trim()}`);

  const maxMetaW = pageWidth * 0.55;
  for (const line of metaLines) {
    const wrapped = pdf.splitTextToSize(line, maxMetaW);
    for (const wl of wrapped) {
      pdf.text(wl, margin, y);
      y += 4.5;
    }
  }

  // ── Right: invoice badge ──
  const badgeX = pageWidth - margin;

  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139); // slate-500
  pdf.text('INVOICE', badgeX, 14, { align: 'right' });

  pdf.setFontSize(20);
  pdf.setTextColor(255, 255, 255);
  pdf.text(getInvoiceNumber(order.id), badgeX, 23, { align: 'right' });

  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(formatDate(order.created_at), badgeX, 29, { align: 'right' });
}

/** Green gradient accent line below header */
function drawAccentLine(pdf: jsPDF, y: number, pageWidth: number) {
  const steps = 40;
  const segW   = pageWidth / steps;
  // Gradient: #16A34A → #4ADE80 → #16A34A
  for (let i = 0; i < steps; i++) {
    const t   = i / (steps - 1);
    const mid = Math.abs(t - 0.5) * 2; // 0 at center, 1 at edges
    const r   = Math.round(22  + (74 - 22)  * (1 - mid));
    const g   = Math.round(163 + (222 - 163)* (1 - mid));
    const b   = Math.round(74  + (128 - 74) * (1 - mid));
    pdf.setFillColor(r, g, b);
    pdf.rect(i * segW, y, segW + 0.5, 3, 'F');
  }
}

/** Bill-To + Status row */
function drawBillToRow(
  pdf: jsPDF,
  order: Order,
  y: number,
  margin: number,
  pageWidth: number
): number {
  const labelColor: [number, number, number] = [148, 163, 184];
  const darkColor:  [number, number, number] = [15, 23, 42];

  // BILL TO label
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...labelColor);
  pdf.text('BILL TO', margin, y);

  // STATUS label (right-aligned)
  pdf.text('STATUS', pageWidth - margin, y, { align: 'right' });

  y += 6;

  // Customer name
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...darkColor);
  pdf.text(order.customer_name, margin, y);
  y += 6;

  // Phone
  if (order.customer_whatsapp) {
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`📱 ${order.customer_whatsapp}`, margin, y);
  }

  // Status chip (right side, vertically centred with customer name)
  const statusLabel  = order.status.charAt(0).toUpperCase() + order.status.slice(1);
  const statusColors = getStatusColors(order.status);
  const chipW = 28, chipH = 8, chipR = 4;
  const chipX = pageWidth - margin - chipW;
  const chipY = y - 10;

  pdf.setFillColor(...(statusColors.bg as [number, number, number]));
  pdf.setDrawColor(...(statusColors.border as [number, number, number]));
  pdf.setLineWidth(0.4);
  (pdf as any).roundedRect(chipX, chipY, chipW, chipH, chipR, chipR, 'FD');

  // Dot
  pdf.setFillColor(...(statusColors.text as [number, number, number]));
  pdf.circle(chipX + 6, chipY + chipH / 2, 1.5, 'F');

  // Label
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...(statusColors.text as [number, number, number]));
  pdf.text(statusLabel, chipX + chipW / 2 + 2, chipY + chipH / 2 + 1, { align: 'center' });

  return y + 8;
}

/** Items table */
function drawItemsTable(
  pdf: jsPDF,
  items: OrderItem[],
  symbol: string,
  startY: number,
  margin: number,
  pageWidth: number
): number {
  const contentW  = pageWidth - 2 * margin;
  const col = {
    item:   margin,
    qty:    margin + contentW * 0.56,
    rate:   margin + contentW * 0.72,
    amount: margin + contentW,
  };

  // Table border
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.4);
  (pdf as any).roundedRect(margin, startY, contentW, 10, 2, 2, 'S');

  // Header background
  pdf.setFillColor(248, 250, 252);
  (pdf as any).roundedRect(margin, startY, contentW, 10, 2, 2, 'F');

  // Header labels
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text('ITEM',   col.item   + 4, startY + 6.5);
  pdf.text('QTY',    col.qty,        startY + 6.5, { align: 'center' });
  pdf.text('RATE',   col.rate   + (col.amount - col.rate) / 2 - 8, startY + 6.5, { align: 'right' });
  pdf.text('AMOUNT', col.amount - 4, startY + 6.5, { align: 'right' });

  let y = startY + 10;

  for (const item of items) {
    const rowH      = 14;
    const hasCost   = item.unitPrice != null && item.unitPrice > 0;
    const lineTotal = item.rowTotal ?? (hasCost ? item.unitPrice! * item.quantity : null);

    // Row separator
    pdf.setDrawColor(241, 245, 249);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y, margin + contentW, y);

    // Box icon
    pdf.setFontSize(9);
    pdf.text('📦', col.item + 2, y + rowH / 2 + 1.5);

    // Name + category
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    const nameMaxW = col.qty - col.item - 16;
    const nameLines = pdf.splitTextToSize(item.name, nameMaxW);
    pdf.text(nameLines[0], col.item + 13, y + (item.category ? 5 : rowH / 2 + 1.5));

    if (item.category) {
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(148, 163, 184);
      pdf.text(item.category, col.item + 13, y + 10);
    }

    // Qty
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(55, 65, 81);
    pdf.text(String(item.quantity), col.qty, y + rowH / 2 + 1.5, { align: 'center' });

    // Rate — rendered via canvas for ₹
    if (hasCost) {
      const rateImg = renderTextToImage(`${symbol}${item.unitPrice}`, 28, '#374151');
      if (rateImg) {
        const ih = 4.5;
        const iw = (rateImg.width / rateImg.height) * ih;
        const ix = col.rate + (col.amount - col.rate) / 2 - iw / 2 - 4;
        pdf.addImage(rateImg.dataUrl, 'PNG', ix, y + rowH / 2 - ih / 2, iw, ih);
      }
    } else {
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text('—', col.rate + (col.amount - col.rate) / 2 - 8, y + rowH / 2 + 1.5, { align: 'right' });
    }

    // Line total — rendered via canvas for ₹
    if (lineTotal != null) {
      const totalImg = renderTextToImage(`${symbol}${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 30, '#0f172a');
      if (totalImg) {
        const ih = 4.8;
        const iw = (totalImg.width / totalImg.height) * ih;
        pdf.addImage(totalImg.dataUrl, 'PNG', col.amount - iw - 4, y + rowH / 2 - ih / 2, iw, ih);
      }
    } else {
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text('—', col.amount - 4, y + rowH / 2 + 1.5, { align: 'right' });
    }

    y += rowH;
  }

  // Bottom border close
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y, margin + contentW, y);

  return y + 4;
}

/** Totals block */
function drawTotals(
  pdf: jsPDF,
  items: OrderItem[],
  total: number,
  symbol: string,
  y: number,
  margin: number,
  pageWidth: number,
  gstNumber?: string
): number {
  const subtotal    = items.reduce((s, it) => {
    return s + (it.rowTotal ?? ((it.unitPrice || 0) * it.quantity));
  }, 0);
  const hasAnyPrice = items.some(it => it.unitPrice != null && it.unitPrice > 0);
  const showSubtotal = hasAnyPrice && subtotal !== total;

  const labelX = pageWidth - margin - 70;
  const valueX = pageWidth - margin;

  if (showSubtotal) {
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Subtotal', labelX, y, { align: 'right' });

    const subImg = renderTextToImage(
      `${symbol}${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      28, '#374151'
    );
    if (subImg) {
      const ih = 4.5;
      const iw = (subImg.width / subImg.height) * ih;
      pdf.addImage(subImg.dataUrl, 'PNG', valueX - iw, y - ih + 1, iw, ih);
    }
    y += 7;
  }

  // Divider
  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(0.5);
  pdf.line(labelX - 10, y, valueX, y);
  y += 5;

  // Grand total label
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Total', labelX, y, { align: 'right' });

  // Grand total value via canvas
  if (total > 0) {
    const gtImg = renderTextToImage(
      `${symbol}${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      36, '#16A34A'
    );
    if (gtImg) {
      const ih = 5.5;
      const iw = (gtImg.width / gtImg.height) * ih;
      pdf.addImage(gtImg.dataUrl, 'PNG', valueX - iw, y - ih + 1.5, iw, ih);
    }
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

/** Thank-you note box */
function drawThankYouBox(
  pdf: jsPDF,
  y: number,
  margin: number,
  pageWidth: number
): number {
  const contentW = pageWidth - 2 * margin;
  const boxH     = 18;

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  (pdf as any).roundedRect(margin, y, contentW, boxH, 3, 3, 'FD');

  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(22, 163, 74); // green-600
  pdf.text('Thank you for your order! 🙏', margin + 6, y + 6.5);

  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    'If you have any questions about this invoice, please contact us. We appreciate your business.',
    margin + 6,
    y + 13,
    { maxWidth: contentW - 12 }
  );

  return y + boxH + 4;
}

/** Footer */
function drawFooter(
  pdf: jsPDF,
  pageWidth: number,
  pageHeight: number
) {
  const footerH = 16;
  const footerY = pageHeight - footerH;

  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, footerY, pageWidth, footerH, 'F');

  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.line(0, footerY, pageWidth, footerY);

  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text('This is a computer-generated invoice. No signature required.', 12, footerY + 6);

  // Brand (right)
  pdf.setTextColor(203, 213, 225);
  pdf.text('Generated with ', pageWidth - 12 - 18, footerY + 6, { align: 'right' });
  const gw = pdf.getTextWidth('Generated with ');
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(22, 163, 74);
  pdf.text('CatShare', pageWidth - 12, footerY + 6, { align: 'right' });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates an invoice PDF blob from an order.
 * Uses only jsPDF — no html2canvas required.
 */
export async function generateInvoicePDF(
  order: Order,
  business: BusinessProfile,
  symbol: string
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth  = pdf.internal.pageSize.getWidth();   // 210
  const pageHeight = pdf.internal.pageSize.getHeight();  // 297
  const margin     = 14;

  const items    = order.items || [];
  const total    = order.total_amount ?? items.reduce((s, it) => s + (it.rowTotal ?? ((it.unitPrice || 0) * it.quantity)), 0);
  const headerH  = 46;

  // ── Header ──
  drawHeader(pdf, order, business, pageWidth, margin, headerH);

  // ── Accent line ──
  drawAccentLine(pdf, headerH, pageWidth);

  let y = headerH + 3 + 10; // accent line height (3mm) + top padding

  // ── Bill To ──
  y = drawBillToRow(pdf, order, y, margin, pageWidth);

  // ── Items table ──
  y = drawItemsTable(pdf, items, symbol, y, margin, pageWidth);

  y += 4;

  // ── Totals ──
  y = drawTotals(pdf, items, total, symbol, y, margin, pageWidth, (business as any).gstNumber);

  y += 6;

  // ── Thank you ──
  drawThankYouBox(pdf, y, margin, pageWidth);

  // ── Footer ──
  drawFooter(pdf, pageWidth, pageHeight);

  return pdf.output('blob') as Blob;
}