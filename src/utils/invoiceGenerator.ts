import jsPDF from 'jspdf';
import { Order } from '../services/orderService';
import { BusinessProfile } from '../config/businessProfile';

export async function generateInvoicePDF(
  order: Order,
  businessProfile: BusinessProfile,
  currencySymbol: string
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 15;

  // Helper functions
  const fontSize = (size: number) => doc.setFontSize(size);
  const textColor = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);
  const text = (content: string, x: number, y: number, options?: any) =>
    doc.text(content, x, y, options);

  // Header: Logo + Business Details
  const margin = 15;
  let logoWidth = 0;

  // Add logo if available
  if (businessProfile.logoUrl) {
    try {
      const imgData = businessProfile.logoUrl;
      logoWidth = 20;
      doc.addImage(imgData, 'PNG', margin, yPosition - 5, logoWidth, 20);
    } catch {
      logoWidth = 0;
    }
  }

  // Business name and details
  const detailsX = margin + logoWidth + (logoWidth > 0 ? 8 : 0);
  textColor(15, 23, 42);
  fontSize(18);
  text(businessProfile.businessName || 'Invoice', detailsX, yPosition);

  yPosition += 8;
  fontSize(9);
  textColor(100, 116, 139);

  if (businessProfile.address) {
    text(businessProfile.address, detailsX, yPosition);
    yPosition += 5;
  }

  if (businessProfile.phone) {
    text(`Phone: ${businessProfile.phone}`, detailsX, yPosition);
    yPosition += 4;
  }

  if (businessProfile.email) {
    text(`Email: ${businessProfile.email}`, detailsX, yPosition);
    yPosition += 4;
  }

  yPosition += 3;

  // Divider line
  textColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // Invoice header info
  textColor(15, 23, 42);
  fontSize(12);
  text('INVOICE', margin, yPosition);

  yPosition += 6;
  fontSize(9);
  textColor(100, 116, 139);

  // Order details section
  const detailsStartX = margin;
  const detailsEndX = pageWidth - margin - 40;

  text('Invoice #:', detailsStartX, yPosition);
  textColor(15, 23, 42);
  text(order.id.substring(0, 8).toUpperCase(), detailsStartX + 25, yPosition);

  textColor(100, 116, 139);
  text('Date:', detailsEndX, yPosition);
  textColor(15, 23, 42);
  text(formatDate(order.created_at), detailsEndX + 12, yPosition);

  yPosition += 6;
  textColor(100, 116, 139);
  text('Status:', detailsStartX, yPosition);
  textColor(15, 23, 42);
  text(order.status.charAt(0).toUpperCase() + order.status.slice(1), detailsStartX + 25, yPosition);

  yPosition += 8;

  // Customer section
  textColor(100, 116, 139);
  fontSize(8);
  text('BILL TO:', margin, yPosition);

  yPosition += 5;
  textColor(15, 23, 42);
  fontSize(10);
  text(order.customer_name || 'Customer', margin, yPosition);

  yPosition += 8;

  // Items table
  const tableStartY = yPosition;
  const colX = {
    sn: margin,
    item: margin + 12,
    qty: pageWidth - margin - 65,
    rate: pageWidth - margin - 45,
    total: pageWidth - margin - 20,
  };

  // Table header
  textColor(22, 163, 74);
  fontSize(9);
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, yPosition - 3, pageWidth - margin * 2, 7, 'F');

  textColor(22, 163, 74);
  text('S.No.', colX.sn, yPosition);
  text('Item', colX.item, yPosition);
  text('Qty', colX.qty, yPosition);
  text('Rate', colX.rate, yPosition);
  text('Total', colX.total, yPosition);

  yPosition += 8;

  // Table rows
  const items = order.items || [];
  textColor(15, 23, 42);
  fontSize(8);

  items.forEach((item, index) => {
    // Check if we need a new page
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 15;
    }

    text((index + 1).toString(), colX.sn, yPosition);
    
    // Item name (truncated if too long)
    const itemName = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
    text(itemName, colX.item, yPosition);
    
    text(item.quantity.toString(), colX.qty, yPosition);
    text(`${currencySymbol}${item.unitPrice?.toLocaleString('en-IN') || '0'}`, colX.rate, yPosition);
    text(`${currencySymbol}${item.rowTotal?.toLocaleString('en-IN') || '0'}`, colX.total, yPosition);

    yPosition += 5;
  });

  // Total section
  yPosition += 3;
  textColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  textColor(15, 23, 42);
  fontSize(11);
  doc.setFont(undefined, 'bold');
  text('Total:', colX.rate, yPosition);
  text(
    `${currencySymbol}${(order.total_amount || 0).toLocaleString('en-IN')}`,
    colX.total,
    yPosition
  );

  yPosition += 10;

  // Footer
  textColor(148, 163, 184);
  fontSize(8);
  doc.setFont(undefined, 'normal');
  text('Thank you for your business!', pageWidth / 2, pageHeight - 15, { align: 'center' });

  return doc.output('blob');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
