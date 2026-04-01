/**
 * invoiceGenerator.ts
 * Generates a clean, professional invoice PDF from an order.
 * Uses a pure HTML/CSS template rendered into a PDF via jsPDF + html2canvas.
 *
 * Install: npm install jspdf html2canvas
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface BusinessProfile {
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessLogoUrl?: string;
  gstNumber?: string;
}

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

function formatMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getInvoiceNumber(orderId: string): string {
  const short = orderId.replace(/-/g, '').substring(0, 8).toUpperCase();
  return `INV-${short}`;
}

function getStatusColor(status: string): { bg: string; text: string; border: string } {
  switch (status) {
    case 'completed': return { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' };
    case 'pending': return { bg: '#FEF9C3', text: '#854D0E', border: '#FDE047' };
    case 'cancelled': return { bg: '#FFE4E6', text: '#9F1239', border: '#FDA4AF' };
    default: return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
  }
}

/**
 * Builds the full HTML invoice template as a string.
 */
function buildInvoiceHTML(order: Order, business: BusinessProfile, symbol: string): string {
  const items: OrderItem[] = order.items || [];
  const invoiceNo = getInvoiceNumber(order.id);
  const invoiceDate = formatDate(order.created_at);
  const statusColor = getStatusColor(order.status);
  const statusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1);

  // Subtotal & tax breakdown
  const subtotal = items.reduce((s, it) => {
    const line = it.rowTotal ?? ((it.unitPrice || 0) * it.quantity);
    return s + line;
  }, 0);

  const hasAnyPrice = items.some(it => it.unitPrice != null && it.unitPrice > 0);
  const total = order.total_amount ?? subtotal;

  // Build item rows
  const itemRows = items.map((item, i) => {
    const hasCost = item.unitPrice != null && item.unitPrice > 0;
    const lineTotal = item.rowTotal ?? (hasCost ? item.unitPrice! * item.quantity : null);

    return `
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 12px 0; vertical-align: top;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="
              width: 36px; height: 36px; border-radius: 8px;
              background: #F8FAFC; border: 1px solid #E2E8F0;
              display: flex; align-items: center; justify-content: center;
              flex-shrink: 0; overflow: hidden; font-size: 15px;
            ">📦</div>
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #0F172A; line-height: 1.3;">${escapeHtml(item.name)}</div>
              ${item.category ? `<div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">${escapeHtml(item.category)}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="padding: 12px 8px; text-align: center; vertical-align: middle;">
          <span style="font-size: 13px; font-weight: 600; color: #374151;">${item.quantity}</span>
        </td>
        <td style="padding: 12px 8px; text-align: right; vertical-align: middle;">
          <span style="font-size: 13px; color: #374151;">
            ${hasCost ? formatMoney(item.unitPrice!, symbol) : '—'}
          </span>
        </td>
        <td style="padding: 12px 0; text-align: right; vertical-align: middle;">
          <span style="font-size: 13px; font-weight: 700; color: #0F172A;">
            ${lineTotal != null ? formatMoney(lineTotal, symbol) : '—'}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const logoSection = business.businessLogoUrl
    ? `<img src="${business.businessLogoUrl}" alt="" style="max-height: 52px; max-width: 140px; object-fit: contain; display: block; margin-bottom: 8px;" />`
    : `<div style="
        width: 44px; height: 44px; border-radius: 10px;
        background: linear-gradient(135deg, #16A34A, #15803D);
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 8px;
      ">
        <span style="font-size: 22px;">🛍️</span>
      </div>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${invoiceNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      background: #FFFFFF;
      color: #0F172A;
      -webkit-font-smoothing: antialiased;
      width: 794px;
    }

    .page {
      width: 794px;
      min-height: 1123px;
      background: #fff;
      padding: 0;
      position: relative;
    }

    /* ── Header band ── */
    .header-band {
      background: #0F172A;
      padding: 36px 48px 32px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .header-left {}

    .business-name {
      font-size: 20px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.3px;
      margin-bottom: 4px;
    }

    .business-meta {
      font-size: 12px;
      color: #94A3B8;
      line-height: 1.6;
    }

    .invoice-badge {
      text-align: right;
    }

    .invoice-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #64748B;
      margin-bottom: 4px;
    }

    .invoice-number {
      font-size: 26px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.5px;
    }

    .invoice-date {
      font-size: 12px;
      color: #64748B;
      margin-top: 4px;
    }

    /* ── Green accent line ── */
    .accent-line {
      height: 4px;
      background: linear-gradient(90deg, #16A34A, #4ADE80, #16A34A);
    }

    /* ── Body ── */
    .body {
      padding: 36px 48px;
    }

    /* ── Bill to / status row ── */
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      gap: 20px;
    }

    .bill-to-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #94A3B8;
      margin-bottom: 6px;
    }

    .customer-name {
      font-size: 18px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 4px;
    }

    .customer-phone {
      font-size: 13px;
      color: #64748B;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 700;
      background: ${statusColor.bg};
      color: ${statusColor.text};
      border: 1.5px solid ${statusColor.border};
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${statusColor.text};
    }

    /* ── Items table ── */
    .table-wrap {
      border: 1.5px solid #E2E8F0;
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 24px;
    }

    .table-head {
      display: grid;
      grid-template-columns: 1fr 80px 100px 100px;
      background: #F8FAFC;
      border-bottom: 1.5px solid #E2E8F0;
      padding: 10px 16px;
    }

    .th {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #94A3B8;
    }

    .th-center { text-align: center; }
    .th-right { text-align: right; }

    table {
      width: 100%;
      border-collapse: collapse;
      padding: 0 16px;
    }

    table td { padding: 12px 16px; }
    table tr:last-child td { border-bottom: none; }

    /* ── Totals block ── */
    .totals {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      margin-bottom: 32px;
    }

    .total-row {
      display: flex;
      gap: 40px;
      font-size: 13px;
    }

    .total-label { color: #64748B; font-weight: 400; min-width: 100px; text-align: right; }
    .total-value { color: #0F172A; font-weight: 600; min-width: 100px; text-align: right; }

    .grand-total-row {
      display: flex;
      gap: 40px;
      font-size: 16px;
      margin-top: 6px;
      padding-top: 10px;
      border-top: 2px solid #0F172A;
    }
    .grand-label { font-weight: 700; color: #0F172A; min-width: 100px; text-align: right; }
    .grand-value { font-weight: 800; color: #16A34A; min-width: 100px; text-align: right; }

    /* ── Footer ── */
    .footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      padding: 16px 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .footer-note {
      font-size: 11px;
      color: #94A3B8;
      line-height: 1.5;
    }

    .footer-brand {
      font-size: 11px;
      color: #CBD5E1;
      font-weight: 500;
      text-align: right;
    }

    .footer-brand span {
      color: #16A34A;
      font-weight: 700;
    }

    /* ── GST row ── */
    .gst-row {
      font-size: 11px;
      color: #94A3B8;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="header-band">
      <div class="header-left">
        ${logoSection}
        <div class="business-name">${escapeHtml(business.businessName || 'Your Business')}</div>
        <div class="business-meta">
          ${business.businessAddress ? escapeHtml(business.businessAddress) + '<br>' : ''}
          ${business.businessPhone ? '📞 ' + escapeHtml(business.businessPhone) : ''}
          ${business.businessEmail ? (business.businessPhone ? ' · ' : '') + '✉ ' + escapeHtml(business.businessEmail) : ''}
          ${business.gstNumber ? '<br>GST: ' + escapeHtml(business.gstNumber) : ''}
        </div>
      </div>
      <div class="invoice-badge">
        <div class="invoice-label">Invoice</div>
        <div class="invoice-number">${invoiceNo}</div>
        <div class="invoice-date">${invoiceDate}</div>
      </div>
    </div>

    <!-- Green accent -->
    <div class="accent-line"></div>

    <!-- Body -->
    <div class="body">

      <!-- Bill To + Status -->
      <div class="meta-row">
        <div>
          <div class="bill-to-label">Bill To</div>
          <div class="customer-name">${escapeHtml(order.customer_name)}</div>
          ${order.customer_whatsapp ? `<div class="customer-phone">📱 ${escapeHtml(order.customer_whatsapp)}</div>` : ''}
        </div>
        <div>
          <div class="bill-to-label" style="text-align: right;">Status</div>
          <div style="margin-top: 6px;">
            <span class="status-chip">
              <span class="status-dot"></span>
              ${statusLabel}
            </span>
          </div>
        </div>
      </div>

      <!-- Items table -->
      <div class="table-wrap">
        <div class="table-head">
          <div class="th">Item</div>
          <div class="th th-center">Qty</div>
          <div class="th th-right">Rate</div>
          <div class="th th-right">Amount</div>
        </div>
        <table>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div class="totals">
        ${hasAnyPrice && subtotal !== total ? `
          <div class="total-row">
            <div class="total-label">Subtotal</div>
            <div class="total-value">${formatMoney(subtotal, symbol)}</div>
          </div>
        ` : ''}
        <div class="grand-total-row">
          <div class="grand-label">Total</div>
          <div class="grand-value">${total > 0 ? formatMoney(total, symbol) : '—'}</div>
        </div>
        ${business.gstNumber ? `<div class="gst-row">GST No. ${escapeHtml(business.gstNumber)}</div>` : ''}
      </div>

      <!-- Thank you note -->
      <div style="
        background: #F8FAFC; border-radius: 12px; padding: 16px 20px;
        border: 1px solid #E2E8F0; margin-bottom: 80px;
      ">
        <div style="font-size: 13px; font-weight: 600; color: #16A34A; margin-bottom: 4px;">
          Thank you for your order! 🙏
        </div>
        <div style="font-size: 12px; color: #64748B; line-height: 1.5;">
          If you have any questions about this invoice, please contact us.
          We appreciate your business.
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-note">
        This is a computer-generated invoice.<br>
        No signature required.
      </div>
      <div class="footer-brand">
        Generated with <span>CatShare</span>
      </div>
    </div>

  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates a PDF blob from an order.
 * Renders the HTML template into an off-screen div, then captures it with html2canvas.
 */
export async function generateInvoicePDF(
  order: Order,
  business: BusinessProfile,
  symbol: string
): Promise<Blob> {
  const html = buildInvoiceHTML(order, business, symbol);

  // Create a hidden container
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 794px;
    background: white;
    z-index: -1;
  `;
  container.innerHTML = html;
  document.body.appendChild(container);

  // Wait for fonts & images to load
  await new Promise(r => setTimeout(r, 600));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,           // 2× for sharp text on retina
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png', 1.0);

    // A4: 210mm × 297mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfW = pdf.internal.pageSize.getWidth();   // 210
    const pdfH = pdf.internal.pageSize.getHeight();  // 297

    // Image dimensions in mm (canvas is 794px wide = 210mm @ 96dpi)
    const imgW = pdfW;
    const imgH = (canvas.height / canvas.width) * pdfW;

    // Multi-page support
    let yOffset = 0;
    let remaining = imgH;

    while (remaining > 0) {
      const sliceH = Math.min(pdfH, remaining);
      pdf.addImage(imgData, 'PNG', 0, -yOffset, imgW, imgH);

      remaining -= sliceH;
      yOffset += sliceH;

      if (remaining > 0) {
        pdf.addPage();
      }
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}