/**
 * invoiceGenerator.ts
 * Fixed: Restored Footer, Enlarged Header/Date, and Uniform Table Sizing.
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

/** * High-resolution text rendering for symbols and alignment perfection 
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
  const img = renderTextToImage(text, 48, color, bold);
  if (!img) return;
  const wMm = (img.width / img.height) * sizeMm;
  let drawX = x;
  if (align === 'center') drawX = x - wMm / 2;
  if (align === 'right') drawX = x - wMm;
  pdf.addImage(img.dataUrl, 'PNG', drawX, y - sizeMm / 2, wMm, sizeMm);
}

// ─── Renderers ───────────────────────────────────────────────────────────────

function drawHeader(pdf: jsPDF, order: Order, business: BusinessProfile, pageWidth: number) {
  const headerH = 48;
  pdf.setFillColor(15, 23, 42); 
  pdf.rect(0, 0, pageWidth, headerH, 'F');

  // Business Name (Increased Size)
  addUniformText(pdf, (business.businessName || 'Your Business').toUpperCase(), MARGIN, 20, 8, '#FFFFFF', true);

  // Green Accent Line
  pdf.setFillColor(22, 163, 74); 
  pdf.rect(0, headerH, pageWidth, 3, 'F');

  // Invoice Meta
  const bx = pageWidth - MARGIN;
  addUniformText(pdf, 'INVOICE', bx, 15, 4, '#94A3B8', true, 'right');
  addUniformText(pdf, `INV-${order.id.substring(0, 8).toUpperCase()}`, bx, 24, 7, '#FFFFFF', true, 'right');
  
  // Date (Increased Size)
  addUniformText(pdf, formatDate(order.created_at), bx, 34, 5, '#CBD5E1', false, 'right');
}

function drawBillTo(pdf: jsPDF, order: Order, y: number) {
  addUniformText(pdf, 'BILL TO', MARGIN, y, 3.5, '#64748B', true);
  y += 9;
  addUniformText(pdf, order.customer_name, MARGIN, y, 7, '#0F172A', true);
  if (order.customer_whatsapp) {
    y += 8;
    addUniformText(pdf, `WhatsApp: ${order.customer_whatsapp}`, MARGIN, y, 4.5, '#475569');
  }
  return y + 18;
}

function drawItemsTable(pdf: jsPDF, items: OrderItem[], symbol: string, startY: number, pageWidth: number) {
  const contentW = pageWidth - 2 * MARGIN;
  const colQty = MARGIN + contentW * 0.65;
  const colRate = MARGIN + contentW * 0.82;
  const colTotal = MARGIN + contentW;
  
  // Header Row
  pdf.setFillColor(248, 250, 252);
  pdf.rect(MARGIN, startY, contentW, 14, 'F');
  const hY = startY + 7;
  
  const hColor = '#475569';
  addUniformText(pdf, 'DESCRIPTION', MARGIN + 4, hY, 4, hColor, true);
  addUniformText(pdf, 'QTY', colQty, hY, 4, hColor, true, 'center');
  addUniformText(pdf, 'RATE', colRate, hY, 4, hColor, true, 'center');
  addUniformText(pdf, 'TOTAL', colTotal - 4, hY, 4, hColor, true, 'right');

  let y = startY + 14;
  const rowH = 16;

  items.forEach((item) => {
    const midY = y + (rowH / 2);
    pdf.setDrawColor(241, 245, 249);
    pdf.line(MARGIN, y + rowH, MARGIN + contentW, y + rowH);

    // Uniform row size: 5mm for all text
    addUniformText(pdf, item.name, MARGIN + 4, midY, 5, '#0F172A', true);
    addUniformText(pdf, String(item.quantity), colQty, midY, 5, '#0F172A', false, 'center');
    
    const rate = `${symbol}${ (item.unitPrice || 0).toLocaleString() }`;
    addUniformText(pdf, rate, colRate, midY, 5, '#475569', false, 'center');

    const total = `${symbol}${ (item.rowTotal || (item.unitPrice || 0) * item.quantity).toLocaleString() }`;
    addUniformText(pdf, total, colTotal - 4, midY, 5, '#0F172A', true, 'right');

    y += rowH;
  });

  return y;
}

function drawThankYouBox(pdf: jsPDF, y: number, pageWidth: number) {
  const boxW = pageWidth - (MARGIN * 2);
  const boxH = 22;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  (pdf as any).roundedRect(MARGIN, y, boxW, boxH, 2, 2, 'FD');

  pdf.setFillColor(22, 163, 74);
  pdf.rect(MARGIN, y, 2.5, boxH, 'F');

  addUniformText(pdf, 'Thank you for your business!', MARGIN + 8, y + 8, 4.5, '#16A34A', true);
  addUniformText(pdf, 'Please contact us if you have any questions regarding this invoice.', MARGIN + 8, y + 15, 3.8, '#64748B');
}

function drawFooter(pdf: jsPDF, pageWidth: number, pageHeight: number) {
  const footerY = pageHeight - 15;
  addUniformText(pdf, 'This is a computer generated invoice.', MARGIN, footerY, 3, '#94A3B8');
  
  // Restored: Generated by CatShare
  const brandX = pageWidth - MARGIN;
  addUniformText(pdf, 'Generated by ', brandX - 18, footerY, 3, '#94A3B8', false, 'right');
  addUniformText(pdf, 'CatShare', brandX, footerY, 3, '#16A34A', true, 'right');
}

// ─── Main Function ───────────────────────────────────────────────────────────

export async function generateInvoicePDF(order: Order, business: BusinessProfile, symbol: string): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  drawHeader(pdf, order, business, pageWidth);

  let currentY = 65;
  currentY = drawBillTo(pdf, order, currentY);
  currentY = drawItemsTable(pdf, order.items || [], symbol, currentY, pageWidth);

  // Grand Total Section
  currentY += 12;
  addUniformText(pdf, 'GRAND TOTAL', pageWidth - MARGIN - 50, currentY, 5, '#64748B', true);
  const totalStr = `${symbol}${ (order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }`;
  addUniformText(pdf, totalStr, pageWidth - MARGIN, currentY, 8, '#16A34A', true, 'right');

  // Thank you box
  drawThankYouBox(pdf, currentY + 20, pageWidth);
  
  // Footer
  drawFooter(pdf, pageWidth, pageHeight);

  return pdf.output('blob') as Blob;
}