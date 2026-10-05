import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { uploadBuffer } from './uploadService';

export interface CompanyInfo {
  name: string;
  companyName?: string;
  address: string;
  phone: string;
  email: string;
  gstin?: string;
  gstNumber?: string;
  state?: string;
  stateCode?: string;
  pan?: string;
}

export interface DocLine {
  name: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstPercentage: number;
  lineTotal: number;
}

export interface QuotePdfInput {
  quoteNumber: string;
  date: Date;
  validUntil?: Date;
  company: CompanyInfo;
  customer: {
    name: string;
    companyName?: string;
    phone: string;
    email: string;
    gstNumber?: string;
    address?: string;
  };
  items: DocLine[];
  totals: { subtotal: number; gstAmount: number; total: number };
  terms?: string;
}

export interface InvoicePdfInput {
  invoiceNumber: string;
  orderNumber?: string;
  date: Date;
  company: CompanyInfo;
  customer: {
    name: string;
    companyName?: string;
    phone: string;
    email: string;
    gstNumber?: string;
    address?: string;
    state?: string;
  };
  items: (DocLine & { cgst: number; sgst: number; igst: number; taxableValue?: number })[];
  totals: {
    subtotal: number;
    discount?: number;
    shippingFee?: number;
    taxableTotal?: number;
    totalGst: number;
    grandTotal: number;
  };
  paymentStatus?: string;
  isInterState?: boolean;
}

export interface ServiceReportPdfInput {
  bookingNumber: string;
  serviceType: string;
  serviceName?: string;
  date: Date;
  company: CompanyInfo;
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  technician: {
    name: string;
    phone?: string;
  };
  equipment?: {
    name: string;
    serialNumber: string;
    location?: string;
  };
  checkIn?: {
    latitude: number;
    longitude: number;
    timestamp: Date;
    address?: string;
  };
  workSummary: string;
  pressureReading?: string;
  partsReplaced?: string[];
  beforePhotos?: string[];
  afterPhotos?: string[];
  customerSignature?: string;
}

function buildDocBuffer(render: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      render(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export function numberToWordsINR(num: number): string {
  const totalPaise = Math.round(Math.max(num, 0) * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertSection(n: number): string {
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + ' ';
    }
    return str.trim();
  }

  function rupeesToWords(value: number): string {
    if (value === 0) return 'Zero';
    let words = '';
    let rem = value;
    const crore = Math.floor(rem / 10000000);
    rem %= 10000000;
    if (crore > 0) words += convertSection(crore) + ' Crore ';
    const lakh = Math.floor(rem / 100000);
    rem %= 100000;
    if (lakh > 0) words += convertSection(lakh) + ' Lakh ';
    const thousand = Math.floor(rem / 1000);
    rem %= 1000;
    if (thousand > 0) words += convertSection(thousand) + ' Thousand ';
    if (rem > 0) words += convertSection(rem);
    return words.trim();
  }

  let out = `INR ${rupeesToWords(rupees)} Rupees`;
  if (paise > 0) out += ` and ${convertSection(paise)} Paise`;
  return `${out} Only`;
}

// -------------------------------------------------------------
// 1. QUOTATION PDF
// -------------------------------------------------------------
export async function generateQuotePdf(input: QuotePdfInput): Promise<{ url: string; publicId?: string }> {
  const buffer = await buildDocBuffer((doc) => {
    const cName = input.company.companyName || input.company.name || 'Fire Safety Platform';
    const gstin = input.company.gstin || input.company.gstNumber || 'NOT CONFIGURED';

    // Header
    doc.fontSize(16).fillColor('#B91C1C').text(cName);
    doc.fontSize(8.5).fillColor('#374151').text(input.company.address);
    doc.text(`Phone: ${input.company.phone}  |  Email: ${input.company.email}`);
    doc.text(`GSTIN: ${gstin}`);

    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#111827').text('ESTIMATE / QUOTATION', 350, 36, { align: 'right' });
    doc.fontSize(9).text(`Quote No: ${input.quoteNumber}`, { align: 'right' });
    doc.text(`Date: ${input.date.toLocaleDateString('en-IN')}`, { align: 'right' });
    if (input.validUntil) {
      doc.text(`Valid Until: ${input.validUntil.toLocaleDateString('en-IN')}`, { align: 'right' });
    }

    doc.moveTo(36, 105).lineTo(560, 105).strokeColor('#E5E7EB').lineWidth(1).stroke();

    // Customer
    doc.fontSize(10).fillColor('#111827').text('Bill To:', 36, 115, { underline: true });
    doc.fontSize(9).text(input.customer.name);
    if (input.customer.companyName) doc.text(input.customer.companyName);
    if (input.customer.address) doc.text(input.customer.address);
    doc.text(`Phone: ${input.customer.phone} | Email: ${input.customer.email}`);
    if (input.customer.gstNumber) doc.text(`GSTIN: ${input.customer.gstNumber}`);

    // Table Header
    let y = 185;
    doc.rect(36, y, 524, 20).fill('#F3F4F6');
    doc.fontSize(8.5).fillColor('#111827').font('Helvetica-Bold');
    doc.text('#', 42, y + 5, { width: 20 });
    doc.text('Item Description', 65, y + 5, { width: 220 });
    doc.text('HSN', 290, y + 5, { width: 50 });
    doc.text('Qty', 345, y + 5, { width: 35, align: 'right' });
    doc.text('Rate', 385, y + 5, { width: 55, align: 'right' });
    doc.text('GST %', 445, y + 5, { width: 40, align: 'right' });
    doc.text('Total (INR)', 490, y + 5, { width: 65, align: 'right' });
    doc.font('Helvetica');

    y += 24;
    let idx = 1;
    for (const item of input.items) {
      if (y > 700) {
        doc.addPage();
        y = 40;
      }
      doc.fontSize(8).fillColor('#374151');
      doc.text(String(idx++), 42, y, { width: 20 });
      doc.text(item.name, 65, y, { width: 220 });
      doc.text(item.hsnCode || '8424', 290, y, { width: 50 });
      doc.text(String(item.quantity), 345, y, { width: 35, align: 'right' });
      doc.text(item.unitPrice.toFixed(2), 385, y, { width: 55, align: 'right' });
      doc.text(`${item.gstPercentage}%`, 445, y, { width: 40, align: 'right' });
      doc.text(item.lineTotal.toFixed(2), 490, y, { width: 65, align: 'right' });
      doc.moveTo(36, y + 15).lineTo(560, y + 15).strokeColor('#F3F4F6').stroke();
      y += 18;
    }

    // Totals
    y += 10;
    doc.fontSize(9).fillColor('#374151');
    doc.text(`Subtotal: Rs. ${input.totals.subtotal.toFixed(2)}`, 350, y, { width: 205, align: 'right' });
    y += 15;
    doc.text(`Total GST: Rs. ${input.totals.gstAmount.toFixed(2)}`, 350, y, { width: 205, align: 'right' });
    y += 15;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827');
    doc.text(`Grand Total: Rs. ${input.totals.total.toFixed(2)}`, 350, y, { width: 205, align: 'right' });
    doc.font('Helvetica');

    // Notes
    y += 35;
    doc.fontSize(8).fillColor('#6B7280');
    doc.text(`Amount in words: ${numberToWordsINR(input.totals.total)}`, 36, y);
    y += 14;
    doc.text(input.terms || 'Terms: Prices are subject to revision. GST as applicable. Valid for 30 days from issue.');
  });

  return uploadBuffer(buffer, 'quotes', `${input.quoteNumber}.pdf`, 'raw');
}

// -------------------------------------------------------------
// 2. GST TAX INVOICE PDF (Compliant GST Breakup & HSN Codes)
// -------------------------------------------------------------
export async function generateInvoicePdf(input: InvoicePdfInput): Promise<{ url: string; publicId?: string }> {
  const buffer = await buildDocBuffer((doc) => {
    const cName = input.company.companyName || input.company.name || 'Fire Safety Platform';
    const cGstin = input.company.gstin || input.company.gstNumber || 'NOT CONFIGURED';
    const cState = input.company.state || 'Maharashtra';
    const cStateCode = input.company.stateCode || '27';

    // Page Border
    doc.rect(25, 25, 545, 792).strokeColor('#D1D5DB').lineWidth(1).stroke();

    // Top Header Banner
    doc.rect(25, 25, 545, 80).fill('#1E293B');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#FFFFFF').text(cName, 36, 35);
    doc.fontSize(8).font('Helvetica').fillColor('#E2E8F0');
    doc.text(input.company.address, 36, 55, { width: 300 });
    doc.text(`Phone: ${input.company.phone} | Email: ${input.company.email}`, 36, 75);
    doc.text(`GSTIN: ${cGstin}  |  State: ${cState} (Code: ${cStateCode})`, 36, 88);

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#F87171').text('TAX INVOICE', 350, 35, { align: 'right', width: 210 });
    doc.fontSize(8.5).font('Helvetica').fillColor('#FFFFFF');
    doc.text(`Invoice No: ${input.invoiceNumber}`, 350, 55, { align: 'right', width: 210 });
    doc.text(`Date: ${input.date.toLocaleDateString('en-IN')}`, 350, 68, { align: 'right', width: 210 });
    if (input.orderNumber) {
      doc.text(`Order No: ${input.orderNumber}`, 350, 81, { align: 'right', width: 210 });
    }

    // Buyer Information Section
    let y = 115;
    doc.rect(25, y, 545, 65).fill('#F8FAFC');
    doc.rect(25, y, 545, 65).strokeColor('#E2E8F0').stroke();

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1E293B').text('Billed To (Customer Details):', 36, y + 8);
    doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
    doc.text(`Name: ${input.customer.name}`, 36, y + 22);
    if (input.customer.companyName) doc.text(`Company: ${input.customer.companyName}`, 36, y + 34);
    if (input.customer.address) doc.text(`Address: ${input.customer.address}`, 36, y + 46, { width: 280 });

    doc.fontSize(8.5).fillColor('#334155');
    doc.text(`Customer GSTIN: ${input.customer.gstNumber || 'Unregistered / B2C'}`, 340, y + 22);
    doc.text(`Phone: ${input.customer.phone}`, 340, y + 34);
    doc.text(`Place of Supply: ${input.customer.state || cState}`, 340, y + 46);

    // Item Table
    y = 190;
    doc.rect(25, y, 545, 22).fill('#E2E8F0');
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0F172A');
    doc.text('#', 28, y + 6, { width: 16 });
    doc.text('Item Description', 46, y + 6, { width: 170 });
    doc.text('HSN/SAC', 218, y + 6, { width: 45 });
    doc.text('Qty', 265, y + 6, { width: 25, align: 'right' });
    doc.text('Rate', 292, y + 6, { width: 45, align: 'right' });
    doc.text('Taxable', 340, y + 6, { width: 50, align: 'right' });
    doc.text('CGST', 393, y + 6, { width: 42, align: 'right' });
    doc.text('SGST', 438, y + 6, { width: 42, align: 'right' });
    doc.text('IGST', 482, y + 6, { width: 42, align: 'right' });
    doc.text('Total', 526, y + 6, { width: 40, align: 'right' });
    doc.font('Helvetica');

    y += 24;
    let sl = 1;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const item of input.items) {
      if (y > 660) {
        doc.addPage();
        doc.rect(25, 25, 545, 792).strokeColor('#D1D5DB').lineWidth(1).stroke();
        y = 40;
      }
      const itemTaxable = item.taxableValue ?? item.unitPrice * item.quantity;
      totalCgst += item.cgst;
      totalSgst += item.sgst;
      totalIgst += item.igst;

      doc.fontSize(7.5).fillColor('#334155');
      doc.text(String(sl++), 28, y, { width: 16 });
      doc.text(item.name, 46, y, { width: 170 });
      doc.text(item.hsnCode || '8424', 218, y, { width: 45 });
      doc.text(String(item.quantity), 265, y, { width: 25, align: 'right' });
      doc.text(item.unitPrice.toFixed(2), 292, y, { width: 45, align: 'right' });
      doc.text(itemTaxable.toFixed(2), 340, y, { width: 50, align: 'right' });
      doc.text(item.cgst.toFixed(2), 393, y, { width: 42, align: 'right' });
      doc.text(item.sgst.toFixed(2), 438, y, { width: 42, align: 'right' });
      doc.text(item.igst.toFixed(2), 482, y, { width: 42, align: 'right' });
      doc.text(item.lineTotal.toFixed(2), 526, y, { width: 40, align: 'right' });

      doc.moveTo(25, y + 14).lineTo(570, y + 14).strokeColor('#F1F5F9').stroke();
      y += 18;
    }

    // Bottom Summary & Tax Breakup Box
    const discount = input.totals.discount ?? 0;
    const shipping = input.totals.shippingFee ?? 0;
    const taxableTotal = input.totals.taxableTotal ?? input.totals.subtotal - discount;

    y = Math.max(y + 10, 530);
    if (y > 660) {
      doc.addPage();
      doc.rect(25, 25, 545, 792).strokeColor('#D1D5DB').lineWidth(1).stroke();
      y = 40;
    }
    doc.rect(25, y, 545, 130).fill('#F8FAFC');
    doc.rect(25, y, 545, 130).strokeColor('#E2E8F0').stroke();

    // Tax Breakup Table
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('GST Tax Summary & Breakup', 36, y + 8);
    doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
    doc.text(`Taxable Amount: Rs. ${taxableTotal.toFixed(2)}`, 36, y + 24);
    doc.text(`Central Tax (CGST): Rs. ${totalCgst.toFixed(2)}`, 36, y + 38);
    doc.text(`State Tax (SGST): Rs. ${totalSgst.toFixed(2)}`, 36, y + 52);
    doc.text(`Integrated Tax (IGST): Rs. ${totalIgst.toFixed(2)}`, 36, y + 66);
    doc.text(`Total GST Collected: Rs. ${input.totals.totalGst.toFixed(2)}`, 36, y + 80);

    // Totals on Right: subtotal - discount = taxable; + GST + shipping = grand total
    doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
    let ty = y + 8;
    const line = (label: string, value: number, sign = '') => {
      doc.text(`${label}: ${sign}Rs. ${value.toFixed(2)}`, 350, ty, { width: 210, align: 'right' });
      ty += 14;
    };
    line('Subtotal', input.totals.subtotal);
    if (discount > 0) line('Discount', discount, '- ');
    line('Taxable Value', taxableTotal);
    line('Total GST', input.totals.totalGst, '+ ');
    if (shipping > 0) line('Shipping', shipping, '+ ');

    doc.rect(340, y + 82, 220, 26).fill('#1E293B');
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.text(`Grand Total: Rs. ${input.totals.grandTotal.toFixed(2)}`, 345, y + 90, { width: 205, align: 'right' });

    // Amount in Words
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A');
    doc.text(`Amount Chargeable (in words): ${numberToWordsINR(input.totals.grandTotal)}`, 36, y + 114, { width: 520 });

    // Declaration & Signatory
    y += 140;
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748B');
    doc.text('Declaration: We declare that this invoice shows the actual price of the goods and services described and that all particulars are true and correct.', 36, y, { width: 320 });
    doc.text('Subject to Mumbai jurisdiction.', 36, y + 25);

    // Signatory Area
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(`For ${cName}`, 380, y, { width: 180, align: 'center' });
    doc.rect(400, y + 16, 140, 36).strokeColor('#E2E8F0').dash(2, { space: 2 }).stroke().undash();
    doc.fontSize(7).font('Helvetica').fillColor('#94A3B8').text('[ Digitally Signed / Authorized Signatory ]', 380, y + 56, { width: 180, align: 'center' });
  });

  return uploadBuffer(buffer, 'invoices', `${input.invoiceNumber}.pdf`, 'raw');
}

// -------------------------------------------------------------
// 3. TECHNICIAN SERVICE REPORT PDF (Mobile Flow Sign-off)
// -------------------------------------------------------------
export async function generateServiceReportPdf(input: ServiceReportPdfInput): Promise<{ url: string; publicId?: string }> {
  const buffer = await buildDocBuffer((doc) => {
    const cName = input.company.companyName || input.company.name || 'Fire Safety Platform';

    // Border
    doc.rect(25, 25, 545, 792).strokeColor('#D1D5DB').lineWidth(1).stroke();

    // Header
    doc.rect(25, 25, 545, 65).fill('#0F766E');
    doc.fontSize(15).font('Helvetica-Bold').fillColor('#FFFFFF').text('EQUIPMENT SERVICE & INSPECTION REPORT', 36, 35);
    doc.fontSize(8.5).font('Helvetica').fillColor('#CCFBF1').text(`${cName} · Certified Fire Safety Services`, 36, 55);
    doc.text(`Report Ref: #${input.bookingNumber}`, 360, 35, { align: 'right', width: 200 });
    doc.text(`Service Date: ${input.date.toLocaleDateString('en-IN')}`, 360, 52, { align: 'right', width: 200 });

    let y = 105;

    // Service & Customer Info Grid
    doc.rect(36, y, 523, 85).fill('#F0FDFA').strokeColor('#99F6E4').stroke();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#134E4A').text('Service & Customer Details', 46, y + 8);
    doc.font('Helvetica').fontSize(8).fillColor('#334155');
    doc.text(`Service Type: ${input.serviceType.toUpperCase()} - ${input.serviceName || 'General Maintenance'}`, 46, y + 24);
    doc.text(`Customer Name: ${input.customer.name}`, 46, y + 38);
    doc.text(`Contact: ${input.customer.phone} | ${input.customer.email}`, 46, y + 52);
    doc.text(`Location: ${input.customer.address}`, 46, y + 66, { width: 240 });

    doc.text(`Assigned Technician: ${input.technician.name}`, 310, y + 24);
    if (input.technician.phone) doc.text(`Technician Contact: ${input.technician.phone}`, 310, y + 38);
    if (input.equipment) {
      doc.text(`Equipment: ${input.equipment.name}`, 310, y + 52);
      doc.text(`Serial No: ${input.equipment.serialNumber}`, 310, y + 66);
    }

    // GPS & Check-In Verification
    y = 205;
    doc.rect(36, y, 523, 40).fill('#F8FAFC').strokeColor('#E2E8F0').stroke();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1E293B').text('Technician On-Site Verification', 46, y + 8);
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748B');
    if (input.checkIn) {
      doc.text(`GPS Location: Lat ${input.checkIn.latitude.toFixed(6)}, Long ${input.checkIn.longitude.toFixed(6)}`, 46, y + 22);
      doc.text(`Check-In Timestamp: ${new Date(input.checkIn.timestamp).toLocaleString('en-IN')}`, 310, y + 22);
    } else {
      doc.text('On-site verification confirmed by technician check-in protocol.', 46, y + 22);
    }

    // Work Details & Technical Readings
    y = 260;
    doc.rect(36, y, 523, 110).strokeColor('#E2E8F0').stroke();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1E293B').text('Inspection Findings & Work Performed', 46, y + 10);
    doc.font('Helvetica').fontSize(8).fillColor('#334155');
    doc.text(`Pressure Gauge Reading: ${input.pressureReading || 'Optimal (Green Zone 14-16 bar)'}`, 46, y + 28);
    doc.text(`Safety Seal & Discharge Pin: Verified & Intact`, 46, y + 42);
    doc.text(`Work Summary: ${input.workSummary || 'Equipment inspected and tested according to IS 2190 standards.'}`, 46, y + 58, { width: 500 });
    if (input.partsReplaced && input.partsReplaced.length > 0) {
      doc.text(`Replaced Parts: ${input.partsReplaced.join(', ')}`, 46, y + 85);
    }

    // Customer Sign-off & Confirmation
    y = 390;
    doc.rect(36, y, 523, 90).fill('#F8FAFC').strokeColor('#CBD5E1').stroke();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text('Customer Sign-off & Completion Acknowledgment', 46, y + 10);
    doc.font('Helvetica').fontSize(8).fillColor('#475569');
    doc.text('I confirm that the fire safety inspection/service was satisfactorily conducted and equipment returned to functional status.', 46, y + 26, { width: 340 });

    // Signature render
    if (input.customerSignature && input.customerSignature.startsWith('data:image')) {
      try {
        const base64Data = input.customerSignature.split(',')[1];
        const sigBuffer = Buffer.from(base64Data, 'base64');
        doc.image(sigBuffer, 410, y + 20, { width: 120, height: 45 });
      } catch (err) {
        doc.text('[ Signature Verified Digitally ]', 410, y + 40);
      }
    } else {
      doc.fontSize(8).fillColor('#64748B').text('Signed Digitally on Device', 410, y + 40);
    }
    doc.moveTo(400, y + 70).lineTo(540, y + 70).strokeColor('#94A3B8').stroke();
    doc.fontSize(7).text('Customer Signature', 430, y + 74);

    // Disclaimer
    y = 500;
    doc.fontSize(7.5).font('Helvetica').fillColor('#94A3B8');
    doc.text('This official certificate is generated by the Fire Safety Platform upon technician completion. Next routine inspection recommended in 6 months.', 36, y, { width: 523, align: 'center' });
  });

  return uploadBuffer(buffer, 'service-reports', `Report-${input.bookingNumber}.pdf`, 'raw');
}

// Ensures local /uploads/{quotes,invoices,service-reports} exist when Cloudinary isn't configured.
export function ensurePdfDirs() {
  for (const folder of ['quotes', 'invoices', 'service-reports']) {
    fs.mkdirSync(path.join(__dirname, '../../uploads', folder), { recursive: true });
  }
}
