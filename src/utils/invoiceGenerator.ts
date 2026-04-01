/**
 * invoiceGenerator.ts
 * Optimized for symmetry, uniform font sizes, and consistent branding.
 */

import { jsPDF } from 'jspdf';
import type { BusinessProfile } from '../config/businessProfile';

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  rowTotal?: number;
  category?: string;
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * Renders text to a high-res canvas. 
 * Used for currency symbols and to ensure consistent thickness across all fields.
 */
function renderTextToImage(text: string, fontSize: number, color: string, bold: boolean) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const scale = 4;
    const weight = bold ? '700' : '400';
    const font = `${weight} ${fontSize}px -apple-system, sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const cw = metrics.width + fontSize * 0.4;
    const ch = fontSize * 1.5;
    canvas.width = cw * scale;
    canvas.height = ch * scale;
    ctx.scale(scale, scale);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, (fontSize * 0.2), ch / 2);
    return { dataUrl: canvas.toDataURL('image/png'), width: cw, height: ch };
  } catch { return null; }
}

function addUniformText(
  pdf: jsPDF, text: string, x: number, y: number, 
  sizeMm: number, color: string, bold = false, align: 'left' | 'center' | 'right' = 'left'
) {
  // We use canvas for EVERYTHING in the table to ensure 1:1 visual scaling
  const img = renderTextToImage(text, 40, color, bold);
  if (!img) return;
  const wMm = (img.width / img.height) * sizeMm;
  let drawX = x;
  if (align === 'center') drawX = x - wMm / 2;
  if (align === 'right') drawX = x - wMm;
  pdf.addImage(img.dataUrl, 'PNG', drawX, y - sizeMm / 2, wMm, sizeMm);
}

// ─── Renderers ───────────────────────────────────────────────────────────────

function drawHeader(pdf: jsPDF, order: Order, business: BusinessProfile, pageWidth: number) {
  const headerH = 44;
  pdf.setFillColor(15, 23, 42); 
  pdf.rect(0, 0, pageWidth, headerH, 'F');

  // Business Name
  addUniformText(pdf, (business.businessName || 'Your Business').toUpperCase(), MARGIN, 18, 6, '#FFFFFF', true);

  // Green Accent Line
  pdf.setFillColor(22, 163, 74); 
  pdf.rect(0, headerH, pageWidth, 3, 'F');

  // Invoice Meta
  const bx = pageWidth - MARGIN;
  addUniformText(pdf, 'INVOICE', bx, 14, 3.5, '#64748B', true, 'right');
  addUniformText(pdf, `INV-${order.id.substring(0, 8).toUpperCase()}`, bx, 22, 6, '#FFFFFF', true, 'right');
  addUniformText(pdf, formatDate(order.created_at), bx, 30, 4, '#94A3B8', false, 'right');
}

function drawBillTo(pdf: jsPDF, order: Order, y: number) {
  addUniformText(pdf, 'BILL TO', MARGIN, y, 3, '#94A3B8', true);
  y += 8;
  addUniformText(pdf, order.customer_name, MARGIN, y, 6, '#0F172A', true);
  if (order.customer_whatsapp) {
    y += 7;
    addUniformText(pdf, `WhatsApp: ${order.customer_whatsapp}`, MARGIN, y, 4, '#475569');
  }
  return y + 15;
}

function drawItemsTable(pdf: jsPDF, items: OrderItem[], symbol: string, startY: number, pageWidth: number) {
  const contentW = pageWidth - 2 * MARGIN;
  const colQty = MARGIN + contentW * 0.65;
  const colRate = MARGIN + contentW * 0.82;
  const colTotal = MARGIN + contentW;
  
  // Header Row
  pdf.setFillColor(248, 250, 252);
  pdf.rect(MARGIN, startY, contentW, 12, 'F');
  const hY = startY + 6;
  
  const hColor = '#64748B';
  addUniformText(pdf, 'DESCRIPTION', MARGIN + 4, hY, 3.5, hColor, true);
  addUniformText(pdf, 'QTY', colQty, hY, 3.5, hColor, true, 'center');
  addUniformText(pdf, 'RATE', colRate, hY, 3.5, hColor, true, 'center');
  addUniformText(pdf, 'TOTAL', colTotal - 4, hY, 3.5, hColor, true, 'right');

  let y = startY + 12;
  const rowH = 14;

  items.forEach((item) => {
    const midY = y + (rowH / 2);
    pdf.setDrawColor(241, 245, 249);
    pdf.line(MARGIN, y + rowH, MARGIN + contentW, y + rowH);

    // All text here uses size 4.5 for perfect equality
    addUniformText(pdf, item.name, MARGIN + 4, midY, 4.5, '#0F172A', true);
    addUniformText(pdf, String(item.quantity), colQty, midY, 4.5, '#0F172A', false, 'center');
    
    const rate = `${symbol}${ (item.unitPrice || 0).toLocaleString() }`;
    addUniformText(pdf, rate, colRate, midY, 4.5, '#475569', false, 'center');

    const total = `${symbol}${ (item.rowTotal || (item.unitPrice || 0) * item.quantity).toLocaleString() }`;
    addUniformText(pdf, total, colTotal - 4, midY, 4.5, '#0F172A', true, 'right');

    y += rowH;
  });

  return y;
}

function drawThankYouBox(pdf: jsPDF, y: number, pageWidth: number) {
  const boxW = pageWidth - (MARGIN * 2);
  const boxH = 20;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  (pdf as any).roundedRect(MARGIN, y, boxW, boxH, 2, 2, 'FD');

  // Green vertical accent inside box
  pdf.setFillColor(22, 163, 74);
  pdf.rect(MARGIN, y, 2, boxH, 'F');

  addUniformText(pdf, 'Thank you for your business!', MARGIN + 6, y + 7, 4, '#16A34A', true);
  addUniformText(pdf, 'Please contact us if you have any questions regarding this invoice.', MARGIN + 6, y + 13, 3.5, '#64748B');
}

// ─── Main Function ───────────────────────────────────────────────────────────

export async function generateInvoicePDF(order: Order, business: BusinessProfile, symbol: string): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  drawHeader(pdf, order, business, pageWidth);

  let currentY = 60;
  currentY = drawBillTo(pdf, order, currentY);
  currentY = drawItemsTable(pdf, order.items || [], symbol, currentY, pageWidth);

  // Totals
  currentY += 10;
  addUniformText(pdf, 'Grand Total', pageWidth - MARGIN - 45, currentY, 5, '#64748B', true);
  const totalStr = `${symbol}${ (order.total_amount || 0).toLocaleString() }`;
  addUniformText(pdf, totalStr, pageWidth - MARGIN, currentY, 7, '#16A34A', true, 'right');

  // Thank you box
  drawThankYouBox(pdf, currentY + 15, pageWidth);



  // 5. Footer (Simple & Clean)
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184);
  pdf.text('Thank you for choosing ' + (business.businessName || 'us') + '!', MARGIN, pageHeight - 20);
  pdf.text('Generated via CatShare PDF Engine', pageWidth - MARGIN, pageHeight - 20, { align: 'right' });

  return pdf.output('blob') as Blob;
}