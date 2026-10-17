import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { Types } from 'mongoose';
import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser, createUserWithPermissions } from './setup';
import { Invoice } from '../src/models/Invoice';
import { env } from '../src/config/env';
import { buildRawPublicId } from '../src/services/uploadService';

const binary = (res: NodeJS.ReadableStream, done: (err: Error | null, body?: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

const UPLOADS = path.resolve(__dirname, '../uploads/invoices');
const STORED = Buffer.from('%PDF-1.4\n% this is the stored original\n%%EOF\n');

describe('GET /api/invoices/:id/pdf', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => { await clearCollections('users', 'invoices', 'orders'); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const makeInvoice = (userId: unknown, extra: Record<string, unknown> = {}) =>
    Invoice.create({
      invoiceNumber: 'INV-2026-000777', order: new Types.ObjectId(), user: userId,
      companySnapshot: { name: 'AK Fire Safety', address: 'Mumbai', phone: '1', email: 'a@b.c', gstin: '27AAAAA0000A1Z5', state: 'Maharashtra', stateCode: '27' },
      customerSnapshot: { name: 'Aman', email: 'aman@example.com', address: 'Kandivali, Mumbai' },
      items: [{ name: 'Smoke Detector', hsnCode: '8424', quantity: 1, unitPrice: 799, gstPercentage: 18, cgst: 71.91, sgst: 71.91, igst: 0, lineTotal: 942.82, taxableValue: 799 }],
      subtotal: 799, discount: 0, shippingFee: 99, taxableTotal: 799, totalGst: 143.82, grandTotal: 1041.82, ...extra
    });

  const download = (token: string | undefined, id: string, qs = '') => {
    const req = request(app).get(`/api/invoices/${id}/pdf${qs}`).buffer(true).parse(binary as never);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('gives the owner a real PDF named after the invoice, even when no file was ever stored', async () => {
    const owner = await createTestUser('customer');
    const invoice = await makeInvoice(owner.user._id); // no pdfUrl: rebuilt from the invoice record
    const res = await download(owner.token, invoice._id.toString());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="INV-2026-000777.pdf"');
    expect(res.headers['cache-control']).toBe('private, no-store');
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(Number(res.headers['content-length'])).toBe(body.length);
  });

  it('?inline=1 opens it in the browser instead of downloading', async () => {
    const owner = await createTestUser('customer');
    const invoice = await makeInvoice(owner.user._id);
    const res = await download(owner.token, invoice._id.toString(), '?inline=1');
    expect(res.headers['content-disposition']).toBe('inline; filename="INV-2026-000777.pdf"');
  });

  it('serves the stored original when it is on this server', async () => {
    fs.mkdirSync(UPLOADS, { recursive: true });
    const file = path.join(UPLOADS, 'test-stored-invoice.pdf');
    fs.writeFileSync(file, STORED);
    try {
      const owner = await createTestUser('customer');
      const invoice = await makeInvoice(owner.user._id, { pdfUrl: `${env.publicUrl}/uploads/invoices/test-stored-invoice.pdf` });
      const res = await download(owner.token, invoice._id.toString());
      expect(res.status).toBe(200);
      expect((res.body as Buffer).equals(STORED)).toBe(true);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  it('never reads outside the uploads folder, whatever the stored URL says', async () => {
    const owner = await createTestUser('customer');
    const invoice = await makeInvoice(owner.user._id, { pdfUrl: `${env.publicUrl}/uploads/../../package.json` });
    const res = await download(owner.token, invoice._id.toString());
    expect(res.status).toBe(200);
    expect((res.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-'); // rebuilt, not package.json
  });

  it('fetches a Cloudinary-hosted original, but never any other host', async () => {
    const owner = await createTestUser('customer');
    const fetchMock = vi.fn(async () => new Response(STORED, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const hosted = await makeInvoice(owner.user._id, { pdfUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/fire-safety/invoices/vyia0znmrxayo42ryonf' });
    const ok = await download(owner.token, hosted._id.toString());
    expect((ok.body as Buffer).equals(STORED)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await Invoice.deleteMany({});
    fetchMock.mockClear();
    const evil = await makeInvoice(owner.user._id, { pdfUrl: 'https://evil.example/internal.pdf' });
    const res = await download(owner.token, evil._id.toString());
    expect(fetchMock).not.toHaveBeenCalled();
    expect((res.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('rebuilds the PDF when the stored file is blocked or is not a PDF at all', async () => {
    const owner = await createTestUser('customer');
    const invoice = await makeInvoice(owner.user._id, { pdfUrl: 'https://res.cloudinary.com/demo/raw/upload/x' });

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>blocked</html>', { status: 200 })));
    const notPdf = await download(owner.token, invoice._id.toString());
    expect((notPdf.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('denied', { status: 401 })));
    const blocked = await download(owner.token, invoice._id.toString());
    expect((blocked.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const offline = await download(owner.token, invoice._id.toString());
    expect(offline.status).toBe(200);
  });

  it('staff who can read orders may download anyone\'s invoice; other customers and staff without that permission may not', async () => {
    const owner = await createTestUser('customer');
    const other = await createTestUser('customer');
    const reader = await createUserWithPermissions(['orders.read']);
    const noOrders = await createUserWithPermissions(['products.read']);
    const invoice = await makeInvoice(owner.user._id);
    const id = invoice._id.toString();

    expect((await download(reader.token, id)).status).toBe(200);
    expect((await download((await createTestUser('super_admin')).token, id)).status).toBe(200);
    // Someone else's invoice looks exactly like one that does not exist.
    expect((await download(other.token, id)).status).toBe(404);
    expect((await download(noOrders.token, id)).status).toBe(404);
  });

  it('needs a login, and unknown or malformed ids are a clean 404 (never a 500)', async () => {
    const owner = await createTestUser('customer');
    const invoice = await makeInvoice(owner.user._id);
    expect((await download(undefined, invoice._id.toString())).status).toBe(401);
    expect((await download(owner.token, new Types.ObjectId().toString())).status).toBe(404);
    expect((await download(owner.token, 'not-an-id')).status).toBe(404);
  });

  it('only staff can have an invoice emailed (it used to be open to every signed-in user)', async () => {
    const owner = await createTestUser('customer');
    const invoice = await makeInvoice(owner.user._id);
    const res = await request(app).post(`/api/invoices/${invoice._id}/email`).set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(403);
  });
});

describe('buildRawPublicId', () => {
  it('ends in the file extension, so Cloudinary serves and saves it as a real .pdf', () => {
    expect(buildRawPublicId('pdf')).toMatch(/^\d+-[0-9a-f]{12}\.pdf$/);
    expect(buildRawPublicId('pdf')).not.toBe(buildRawPublicId('pdf'));
  });
});
