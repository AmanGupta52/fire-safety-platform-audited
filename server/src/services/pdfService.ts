import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { uploadBuffer } from './uploadService';

interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin?: string;
}

interface DocLine {
  name: string;
  quantity: number;
  unitPrice: number;
  gstPercentage: number;
  lineTotal: number;
}

interface QuotePdfInput {
  quoteNumber: string;
  date: Date;
  validUntil?: Date;
  company: CompanyInfo;
  customer: { name: string; companyName?: string; phone: string; email: string; gstNumber?: string; address?: string };
  items: DocLine[];
  totals: { subtotal: number; gstAmount: number; total: number };
  terms?: string;
}

interface InvoicePdfInput {
  invoiceNumber: string;
  date: Date;
  company: CompanyInfo;
  customer: { name: string; companyName?: string; phone: string; email: string; gstNumber?: string; address?: string };
  items: (DocLine & { cgst: number; sgst: number; igst: number })[];
  totals: { subtotal: number; totalGst: number; grandTotal: number };
}

function buildDocBuffer(render: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    render(doc);
    doc.end();
  });
}

function renderHeader(doc: PDFKit.PDFDocument, company: CompanyInfo, docTitle: string, docNumber: string, date: Date) {
  doc.fontSize(18).fillColor('#B91C1C').text(company.name, { continued: false });
  doc.fontSize(9).fillColor('#333').text(company.address);
  doc.text(`Phone: ${company.phone}  |  Email: ${company.email}`);
  if (company.gstin) doc.text(`GSTIN: ${company.gstin}`);
  doc.moveDown(1);
  doc.fontSize(14).fillColor('#000').text(docTitle, { align: 'right' });
  doc.fontSize(10).text(`No: ${docNumber}`, { align: 'right' });
  doc.text(`Date: ${date.toLocaleDateString('en-IN')}`, { align: 'right' });
  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ddd').stroke();
  doc.moveDown(0.5);
}

function renderCustomer(doc: PDFKit.PDFDocument, customer: InvoicePdfInput['customer']) {
  doc.fontSize(11).fillColor('#000').text('Bill To:', { underline: true });
  doc.fontSize(10).text(customer.name);
  if (customer.companyName) doc.text(customer.companyName);
  if (customer.address) doc.text(customer.address);
  doc.text(`Phone: ${customer.phone}`);
  doc.text(`Email: ${customer.email}`);
  if (customer.gstNumber) doc.text(`GSTIN: ${customer.gstNumber}`);
  doc.moveDown(1);
}

export async function generateQuotePdf(input: QuotePdfInput): Promise<{ url: string; publicId?: string }> {
  const buffer = await buildDocBuffer((doc) => {
    renderHeader(doc, input.company, 'QUOTATION', input.quoteNumber, input.date);
    renderCustomer(doc, input.customer);

    const tableTop = doc.y;
    doc.fontSize(9).fillColor('#000');
    doc.text('Item', 40, tableTop, { width: 200 });
    doc.text('Qty', 250, tableTop, { width: 50 });
    doc.text('Unit Price', 310, tableTop, { width: 80 });
    doc.text('GST %', 400, tableTop, { width: 50 });
    doc.text('Total', 460, tableTop, { width: 90 });
    doc.moveTo(40, tableTop + 14).lineTo(555, tableTop + 14).strokeColor('#ddd').stroke();

    let y = tableTop + 20;
    for (const item of input.items) {
      doc.text(item.name, 40, y, { width: 200 });
      doc.text(String(item.quantity), 250, y, { width: 50 });
      doc.text(`Rs. ${item.unitPrice.toFixed(2)}`, 310, y, { width: 80 });
      doc.text(`${item.gstPercentage}%`, 400, y, { width: 50 });
      doc.text(`Rs. ${item.lineTotal.toFixed(2)}`, 460, y, { width: 90 });
      y += 18;
    }

    doc.moveTo(40, y + 4).lineTo(555, y + 4).strokeColor('#ddd').stroke();
    y += 12;
    doc.text(`Subtotal: Rs. ${input.totals.subtotal.toFixed(2)}`, 350, y, { width: 200, align: 'right' });
    y += 14;
    doc.text(`GST: Rs. ${input.totals.gstAmount.toFixed(2)}`, 350, y, { width: 200, align: 'right' });
    y += 14;
    doc.fontSize(11).text(`Grand Total: Rs. ${input.totals.total.toFixed(2)}`, 350, y, { width: 200, align: 'right' });

    doc.moveDown(3);
    if (input.validUntil) {
      doc.fontSize(9).fillColor('#555').text(`This quotation is valid until ${input.validUntil.toLocaleDateString('en-IN')}.`);
    }
    doc.text(input.terms || 'Prices are subject to change without prior notice. GST as applicable. Delivery timelines are indicative.');
  });

  return uploadBuffer(buffer, 'quotes', `${input.quoteNumber}.pdf`, 'raw');
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<{ url: string; publicId?: string }> {
  const buffer = await buildDocBuffer((doc) => {
    renderHeader(doc, input.company, 'TAX INVOICE', input.invoiceNumber, input.date);
    renderCustomer(doc, input.customer);

    const tableTop = doc.y;
    doc.fontSize(8).fillColor('#000');
    doc.text('Item', 40, tableTop, { width: 140 });
    doc.text('Qty', 180, tableTop, { width: 30 });
    doc.text('Price', 210, tableTop, { width: 55 });
    doc.text('CGST', 265, tableTop, { width: 45 });
    doc.text('SGST', 310, tableTop, { width: 45 });
    doc.text('IGST', 355, tableTop, { width: 45 });
    doc.text('Total', 480, tableTop, { width: 75 });
    doc.moveTo(40, tableTop + 14).lineTo(555, tableTop + 14).strokeColor('#ddd').stroke();

    let y = tableTop + 20;
    for (const item of input.items) {
      doc.text(item.name, 40, y, { width: 140 });
      doc.text(String(item.quantity), 180, y, { width: 30 });
      doc.text(item.unitPrice.toFixed(2), 210, y, { width: 55 });
      doc.text(item.cgst.toFixed(2), 265, y, { width: 45 });
      doc.text(item.sgst.toFixed(2), 310, y, { width: 45 });
      doc.text(item.igst.toFixed(2), 355, y, { width: 45 });
      doc.text(`Rs. ${item.lineTotal.toFixed(2)}`, 480, y, { width: 75 });
      y += 18;
    }

    doc.moveTo(40, y + 4).lineTo(555, y + 4).strokeColor('#ddd').stroke();
    y += 12;
    doc.text(`Subtotal: Rs. ${input.totals.subtotal.toFixed(2)}`, 350, y, { width: 200, align: 'right' });
    y += 14;
    doc.text(`Total GST: Rs. ${input.totals.totalGst.toFixed(2)}`, 350, y, { width: 200, align: 'right' });
    y += 14;
    doc.fontSize(11).text(`Grand Total: Rs. ${input.totals.grandTotal.toFixed(2)}`, 350, y, { width: 200, align: 'right' });

    doc.moveDown(3);
    doc.fontSize(8).fillColor('#777').text('This is a system-generated invoice based on configured business/tax settings.');
  });

  return uploadBuffer(buffer, 'invoices', `${input.invoiceNumber}.pdf`, 'raw');
}

// Ensures local /uploads/{quotes,invoices} exist when Cloudinary isn't configured.
export function ensurePdfDirs() {
  for (const folder of ['quotes', 'invoices']) {
    fs.mkdirSync(path.join(__dirname, '../../uploads', folder), { recursive: true });
  }
}
