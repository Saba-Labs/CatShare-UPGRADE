/**
 * invoiceGenerator.ts
 * Upgraded with larger fonts, better spacing, and modern layout.
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

// ─── Configuration ──────────────────────────────────────────────────────────
const MARGIN = 16; // Increased margin for a more "breathable" design

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

function renderTextToImage(
  text: string,
  fontSize = 48, // Increased default
  color = '#0f172a',
  bold = false,
): { dataUrl: string; width: number; height: number } | null {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const weight = bold ? '700' : '400';
    const font = `${weight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(text);

    const pad = fontSize * 0.5;
    const scale = 4; // Higher resolution for crispness
    const cw = metrics.width + pad * 2;
    const ch = fontSize * 2;

    canvas.width = cw * scale;
    canvas.height = ch * scale;

    ctx.scale(scale, scale);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad, ch / 2);

    return { dataUrl: canvas.toDataURL('image/png'), width: cw, height: ch };
  } catch {
    return null;
  }
}

function addTextImage(
  pdf: jsPDF,
  text: string,
  x: number,
  midY: number,
  targetHeightMm: number,
  color: string,
  fontSize = 48,
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

function drawHeader(
  pdf: jsPDF,
  order: Order,
  business: BusinessProfile,
  pageWidth: number,
  headerH: number,
) {
  pdf.setFillColor(15, 23, 42); // Slate 900
  pdf.rect(0, 0, pageWidth, headerH, 'F');

  // Business Name (Large)
  const businessName = business.businessName?.trim() || 'Your Business';
  addTextImage(pdf, businessName, MARGIN, 18, 8, '#ffffff', 56, true);

  // Business Details
  pdf.setFontSize(10); // Increased from 8
  pdf.setTextColor(148, 163, 184); // Slate 400
  let y = 28;
  
  const address = (business as any).businessAddress?.trim();
  if (address) {
    pdf.text(address, MARGIN, y);
    y += 5;
  }
  
  const contact = [(business as any).businessPhone, (business as any).businessEmail].filter(Boolean).join('  |  ');
  if (contact) {
    pdf.text(contact, MARGIN, y);
    y += 5;
  }

  // Right Side: Invoice Branding
  const bx = pageWidth - MARGIN;
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text('INVOICE', bx, 18, { align: 'right' });

  addTextImage(pdf, getInvoiceNumber(order.id), bx, 28, 8, '#ffffff', 52, true, true);

  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(10);
  pdf.text(formatDate(order.created_at), bx, 38, { align: 'right' });
}

function drawBillTo(pdf: jsPDF, order: Order, y: number, pageWidth: number): number {
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184);
  pdf.text('BILL TO', MARGIN, y);
  pdf.text('STATUS', pageWidth - MARGIN, y, { align: 'right' });

  y += 8;

  // Customer Name (Large)
  addTextImage(pdf, order.customer_name, MARGIN, y, 6.5, '#0f172a', 50, true);
  
  // Status Badge
  const statusLabel = order.status.toUpperCase();
  const sc = getStatusColors(order.status);
  const chipW = 34, chipH = 10;
  const chipX = pageWidth - MARGIN - chipW;
  
  pdf.setFillColor(...(sc.bg as [number, number, number]));
  (pdf as any).roundedRect(chipX, y - 6, chipW, chipH, 2, 2, 'F');
  addTextImage(pdf, statusLabel, chipX + chipW / 2, y - 1, 4, `rgb(${sc.text.join(',')})`, 34, true, false);

  if (order.customer_whatsapp) {
    y += 8;
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`WhatsApp: ${order.customer_whatsapp}`, MARGIN, y);
  }

  return y + 15;
}

function drawItemsTable(
  pdf: jsPDF,
  items: OrderItem[],
  symbol: string,
  startY: number,
  pageWidth: number,
): number {
  const contentW = pageWidth - 2 * MARGIN;
  const rowH = 16; // Increased for better spacing
  const headH = 12;
  
  const colQty = MARGIN + contentW * 0.6;
  const colRate = MARGIN + contentW * 0.75;
  const colAmount = MARGIN + contentW;

  // Header
  pdf.setFillColor(248, 250, 252);
  pdf.rect(MARGIN, startY, contentW, headH, 'F');
  
  pdf.setFontSize(9.5);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(100, 116, 139);
  
  const hY = startY + headH / 2 + 1.5;
  pdf.text('DESCRIPTION', MARGIN + 4, hY);
  pdf.text('QTY', colQty, hY, { align: 'center' });
  pdf.text('RATE', colRate, hY, { align: 'center' });
  pdf.text('TOTAL', colAmount - 4, hY, { align: 'right' });

  let y = startY + headH;

  items.forEach((item, i) => {
    const rowMidY = y + rowH / 2;
    
    // Bottom border for rows
    pdf.setDrawColor(241, 245, 249);
    pdf.line(MARGIN, y + rowH, MARGIN + contentW, y + rowH);

    // Item Name
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont(undefined, 'bold');
    pdf.text(item.name, MARGIN + 4, rowMidY);

    if (item.category) {
      pdf.setFontSize(8);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(148, 163, 184);
      pdf.text(item.category.toUpperCase(), MARGIN + 4, rowMidY + 5);
    }

    // Qty
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(item.quantity), colQty, rowMidY + 1, { align: 'center' });

    // Rate & Total (Canvas for symbols)
    const rate = item.unitPrice || 0;
    const total = item.rowTotal || (rate * item.quantity);
    
    addTextImage(pdf, `${symbol}${rate.toLocaleString()}`, colRate, rowMidY + 1, 4.5, '#475569', 36, false, false);
    addTextImage(pdf, `${symbol}${total.toLocaleString()}`, colAmount - 4, rowMidY + 1, 5, '#0f172a', 40, true, true);

    y += rowH;
  });

  return y;
}

function drawTotals(
  pdf: jsPDF,
  total: number,
  symbol: string,
  y: number,
  pageWidth: number,
): number {
  y += 12;
  const labelX = pageWidth - MARGIN - 60;
  const valueX = pageWidth - MARGIN;

  pdf.setFontSize(12);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Grand Total', labelX, y);

  // Big Green Total
  addTextImage(pdf, `${symbol}${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, 8, '#16A34A', 60, true, true);

  return y + 20;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateInvoicePDF(
  order: Order,
  business: BusinessProfile,
  symbol: string,
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const items = order.items || [];
  const total = order.total_amount || items.reduce((s, it) => s + ((it.unitPrice || 0) * it.quantity), 0);
  
  // 1. Header
  drawHeader(pdf, order, business, pageWidth, 48);

  // 2. Bill To
  let currentY = 65;
  currentY = drawBillTo(pdf, order, currentY, pageWidth);

  // 3. Items Table
  currentY = drawItemsTable(pdf, items, symbol, currentY, pageWidth);

  // 4. Totals
  currentY = drawTotals(pdf, total, symbol, currentY, pageWidth);

  // 5. Footer (Simple & Clean)
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184);
  pdf.text('Thank you for choosing ' + (business.businessName || 'us') + '!', MARGIN, pageHeight - 20);
  pdf.text('Generated via CatShare PDF Engine', pageWidth - MARGIN, pageHeight - 20, { align: 'right' });

  return pdf.output('blob') as Blob;
}