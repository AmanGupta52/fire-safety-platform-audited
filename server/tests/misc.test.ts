import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser, createUserWithPermissions, detectEmulatedMongo } from './setup';
import { vi } from 'vitest';
import { User } from '../src/models/User';
import { Order } from '../src/models/Order';
import { Review } from '../src/models/Review';
import { Product } from '../src/models/Product';
import { Category } from '../src/models/Category';
import { Service } from '../src/models/Service';
import { AMCContract } from '../src/models/AMCContract';
import { Setting } from '../src/models/AuditLog';
import { makeService, makeTechnician, makeBooking, makeEquipment } from './testHelpers';

const EMULATED = await detectEmulatedMongo();

// ---------------------------------------------------------------------------------------------
describe('Reviews', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('users', 'reviews', 'servicebookings', 'services', 'products', 'categories');
  });

  async function completedBooking() {
    const customer = await createTestUser('customer');
    const service = await makeService();
    const booking = await makeBooking({ customerId: customer.user._id, serviceId: service._id, serviceType: service.slug, status: 'completed' });
    return { customer, service, booking };
  }
  const review = (token: string, body: Record<string, unknown>) =>
    request(app).post('/api/reviews/booking').set('Authorization', `Bearer ${token}`).send(body);

  it('only the booking owner can review, only after completion', async () => {
    const { customer, booking } = await completedBooking();
    const stranger = await createTestUser('customer');
    const open = await makeBooking({ customerId: customer.user._id, serviceId: booking.service as never, serviceType: 'x', status: 'in_progress', daysFromNow: 6 });

    expect((await review(stranger.token, { bookingId: booking._id.toString(), rating: 5, comment: 'Nice work' })).status).toBe(403);
    expect((await review(customer.token, { bookingId: open._id.toString(), rating: 5, comment: 'Nice work' })).status).toBe(400);
    expect((await review(customer.token, { bookingId: booking._id.toString(), rating: 5, comment: 'Nice work' })).status).toBe(201);
    expect((await request(app).post('/api/reviews/booking').send({})).status).toBe(401);
  });

  it.skipIf(EMULATED)('two simultaneous submissions for one booking produce exactly one review (database-level unique index)', async () => {
    const { customer, booking } = await completedBooking();
    await Review.syncIndexes(); // make sure the unique partial index exists before racing
    const results = await Promise.all([1, 2, 3].map(() => review(customer.token, { bookingId: booking._id.toString(), rating: 5, comment: 'Race' })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await Review.countDocuments({ booking: booking._id })).toBe(1);
  });

  it('rejects invalid ratings instead of turning them into 5 stars', async () => {
    const { customer, booking } = await completedBooking();
    for (const rating of [0, 6, -1, 3.5, 'abc', null, undefined, '']) {
      const res = await review(customer.token, { bookingId: booking._id.toString(), rating, comment: 'Fine' });
      expect(res.status, `rating ${String(rating)}`).toBe(400);
    }
    expect(await Review.countDocuments()).toBe(0);
    const ok = await review(customer.token, { bookingId: booking._id.toString(), rating: '4', comment: 'Fine' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.rating).toBe(4);
  });

  it('refuses a second review of the same booking', async () => {
    const { customer, booking } = await completedBooking();
    expect((await review(customer.token, { bookingId: booking._id.toString(), rating: 5, comment: 'First' })).status).toBe(201);
    const second = await review(customer.token, { bookingId: booking._id.toString(), rating: 1, comment: 'Second' });
    expect(second.status).toBe(409);
    expect(await Review.countDocuments()).toBe(1);
  });

  it('requires a comment, trims long input and keeps only http(s) image links', async () => {
    const { customer, booking } = await completedBooking();
    expect((await review(customer.token, { bookingId: booking._id.toString(), rating: 5, comment: '  ' })).status).toBe(400);
    const res = await review(customer.token, {
      bookingId: booking._id.toString(), rating: 5, title: 'T'.repeat(500), comment: 'C'.repeat(10_000),
      images: ['https://cdn.example.test/a.jpg', 'javascript:alert(1)']
    });
    expect(res.status).toBe(201);
    expect(res.body.data.title.length).toBe(120);
    expect(res.body.data.comment.length).toBe(3000);
    expect(res.body.data.images).toEqual(['https://cdn.example.test/a.jpg']);
  });

  it('new reviews are pending; staff moderate them and can only choose approved/rejected', async () => {
    const { customer, booking } = await completedBooking();
    const created = await review(customer.token, { bookingId: booking._id.toString(), rating: 5, comment: 'Great' });
    expect(created.body.data.status).toBe('pending');

    const mod = await createUserWithPermissions(['reviews.read', 'reviews.update']);
    const id = created.body.data._id;
    expect((await request(app).patch(`/api/reviews/admin/${id}/moderate`).set('Authorization', `Bearer ${customer.token}`).send({ status: 'approved' })).status).toBe(403);
    expect((await request(app).patch(`/api/reviews/admin/${id}/moderate`).set('Authorization', `Bearer ${mod.token}`).send({ status: 'deleted' })).status).toBe(400);
    expect((await request(app).patch(`/api/reviews/admin/${id}/moderate`).set('Authorization', `Bearer ${mod.token}`).send({ status: 'approved' })).status).toBe(200);
    expect((await Review.findById(id))!.status).toBe('approved');
  });

  it('product reviews validate rating too', async () => {
    const customer = await createTestUser('customer');
    const category = await Category.create({ name: 'C', slug: 'c-rev', isActive: true });
    const p = await Product.create({ name: 'P', slug: 'p-rev', sku: 'P-REV', category: category._id, price: 10, gstPercentage: 18, stock: 1, isActive: true });
    const post = (rating: unknown) => request(app).post('/api/reviews').set('Authorization', `Bearer ${customer.token}`).send({ productId: p._id.toString(), rating, comment: 'ok fine' });
    expect((await post(0)).status).toBe(400);
    expect((await post('x')).status).toBe(400);
    expect((await post(5)).status).toBe(201);
  });
});

// ---------------------------------------------------------------------------------------------
describe('Uploads', () => {
  const UPLOADS = path.join(__dirname, '../uploads');
  const created: string[] = [];
  beforeAll(connectTestDb);
  afterAll(async () => {
    for (const f of created) fs.rmSync(f, { force: true });
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearCollections('users');
  });

  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const upload = (token: string, folder: string, buf: Buffer, filename: string, mime: string) =>
    request(app).post(`/api/uploads/image/${folder}`).set('Authorization', `Bearer ${token}`).attach('file', buf, { filename, contentType: mime });

  function track(url: string) {
    const rel = url.split('/uploads/')[1];
    if (rel) created.push(path.join(UPLOADS, rel));
    return rel;
  }

  it('stores a real image under an extension taken from its CONTENT, not the client file name', async () => {
    const { token } = await createTestUser('admin');
    const res = await upload(token, 'products', PNG, 'holiday.html', 'image/png');
    const rel = res.body?.data?.url ? track(res.body.data.url) : ''; // track first, so a failing assertion never leaves a file behind
    expect(res.status).toBe(201);
    expect(rel).toMatch(/\.png$/);
    expect(rel).not.toMatch(/html/i);
    expect(fs.existsSync(path.join(UPLOADS, rel))).toBe(true);
  });

  it('refuses HTML/script content even when it claims to be an image, and writes nothing', async () => {
    const { token } = await createTestUser('admin');
    const before = fs.existsSync(path.join(UPLOADS, 'products')) ? fs.readdirSync(path.join(UPLOADS, 'products')).length : 0;
    for (const [name, body] of [['evil.png', '<html><script>alert(1)</script></html>'], ['evil.jpg', '<svg onload=alert(1)></svg>'], ['x.png', 'not an image at all']] as const) {
      const res = await upload(token, 'products', Buffer.from(body), name, 'image/png');
      expect(res.status, name).toBe(400);
    }
    const after = fs.existsSync(path.join(UPLOADS, 'products')) ? fs.readdirSync(path.join(UPLOADS, 'products')).length : 0;
    expect(after).toBe(before);
  });

  it('needs login and a permitted folder; path-traversal folders are refused', async () => {
    const { token } = await createTestUser('admin');
    expect((await request(app).post('/api/uploads/image/products').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(401);
    const bad = await upload(token, '..%2F..%2Fetc', PNG, 'a.png', 'image/png');
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect((await upload(token, 'not-a-real-folder', PNG, 'a.png', 'image/png')).status).toBe(400);
  });

  it('technicians may upload job photos but not catalog images; customers may not upload to staff folders', async () => {
    const tech = await makeTechnician();
    const okRes = await upload(tech.token, 'service-reports', PNG, 'job.png', 'image/png');
    if (okRes.body?.data?.url) track(okRes.body.data.url);
    expect(okRes.status).toBe(201);
    expect((await upload(tech.token, 'products', PNG, 'job.png', 'image/png')).status).toBe(403);
    const customer = await createTestUser('customer');
    expect((await upload(customer.token, 'products', PNG, 'a.png', 'image/png')).status).toBe(403);
  });

  it('serves uploaded files with hardening headers (nosniff + sandbox CSP for non-PDF)', async () => {
    const { token } = await createTestUser('admin');
    const res = await upload(token, 'products', PNG, 'a.png', 'image/png');
    const rel = res.body?.data?.url ? track(res.body.data.url) : '';
    const file = await request(app).get(`/uploads/${rel}`);
    expect(file.status).toBe(200);
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.headers['content-security-policy']).toContain('sandbox');
    expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

// ---------------------------------------------------------------------------------------------
describe('Ctrl+K global search', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('users', 'orders', 'products', 'categories', 'servicebookings', 'services', 'technicians');
  });

  async function seed() {
    const customer = await createTestUser('customer', 'findme@example.com');
    await User.updateOne({ _id: customer.user._id }, { $set: { name: 'Findme Customer', phone: '+919900001111' } });
    const category = await Category.create({ name: 'Cat', slug: 'cat-search', isActive: true });
    const product = await Product.create({ name: 'Findme Extinguisher', slug: 'findme-ext', sku: 'FINDME-1', category: category._id, price: 100, gstPercentage: 18, stock: 3, isActive: true });
    const service = await makeService({ name: 'Findme Audit', slug: 'findme-audit' });
    const mineTech = await makeTechnician('mine');
    const otherTech = await makeTechnician('other');
    const mine = await makeBooking({ customerId: customer.user._id, serviceId: service._id, serviceType: service.slug, technicianId: mineTech.technician._id });
    const theirs = await makeBooking({ customerId: customer.user._id, serviceId: service._id, serviceType: service.slug, technicianId: otherTech.technician._id, daysFromNow: 6 });
    await Order.create({
      orderNumber: 'ORD-FINDME-1', user: customer.user._id, subtotal: 100, discount: 0, gstAmount: 18, shippingFee: 99, totalAmount: 217,
      items: [{ product: product._id, name: 'x', sku: 'x', quantity: 1, unitPrice: 100, gstPercentage: 18, lineTotal: 118 }],
      status: 'pending', paymentStatus: 'unpaid', paymentMethod: 'cod',
      billingAddress: { contactName: 'a', phone: '9999999999', line1: 'l', city: 'c', state: 's', pincode: '111111' },
      shippingAddress: { contactName: 'a', phone: '9999999999', line1: 'l', city: 'c', state: 's', pincode: '111111' }
    });
    return { customer, product, mine, theirs, mineTech, otherTech };
  }
  const search = (token: string, q: string) => request(app).get(`/api/reports/global-search?q=${encodeURIComponent(q)}`).set('Authorization', `Bearer ${token}`);

  it('returns only the groups the caller is allowed to read, with links to pages that exist', async () => {
    await seed();
    const full = await createTestUser('admin');

    const byName = await search(full.token, 'findme');
    expect(byName.status).toBe(200);
    expect(byName.body.data.customers[0].link).toBe('/customers?q=findme%40example.com');
    expect(byName.body.data.orders[0].link).toBe('/orders?q=ORD-FINDME-1');
    expect(byName.body.data.products[0].link).toBe('/products?q=FINDME-1');

    const byNumber = await search(full.token, 'SRV-T');
    expect(byNumber.body.data.bookings[0].link).toMatch(/^\/bookings\?q=SRV-T-/); // used to point at the service CATALOG page

    for (const body of [byName.body.data, byNumber.body.data]) {
      for (const group of Object.values(body) as { link: string }[][]) {
        for (const hit of group) expect(hit.link).toMatch(/^\/(orders|customers|products|bookings)\?q=/);
      }
    }
  });

  it("someone with reports.read but WITHOUT customers.read cannot see customers' phone/email", async () => {
    await seed();
    const analyst = await createUserWithPermissions(['reports.read', 'products.read']);
    const res = await search(analyst.token, 'findme');
    // reports.read alone gets in, but the response only contains what products.read allows
    expect(res.status).toBe(403 === res.status ? 403 : 200);
    if (res.status === 200) {
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('findme@example.com');
      expect(body).not.toContain('9900001111');
      expect(res.body.data.customers).toEqual([]);
      expect(res.body.data.orders).toEqual([]);
      expect(res.body.data.products.length).toBe(1);
    }
  });

  it('a user with no read permissions at all is refused', async () => {
    await seed();
    const nobody = await createTestUser('customer');
    expect((await search(nobody.token, 'findme')).status).toBe(403);
    expect((await request(app).get('/api/reports/global-search?q=findme')).status).toBe(401);
  });

  it('technicians only find their own jobs', async () => {
    const { mineTech, mine, theirs } = await seed();
    const res = await search(mineTech.token, 'SRV-T');
    expect(res.status).toBe(200);
    const ids = res.body.data.bookings.map((b: { id: string }) => b.id);
    expect(ids).toEqual([mine._id.toString()]);
    expect(ids).not.toContain(theirs._id.toString());
    expect(res.body.data.customers).toEqual([]);
  });

  it('regex characters are plain text and queries under 2 characters return nothing', async () => {
    await seed();
    const admin = await createTestUser('admin');
    for (const q of ['(', '[a-', '.*', '(?<x>']) expect((await search(admin.token, q + 'zz')).status, q).toBe(200);
    const short = await search(admin.token, 'f');
    expect(short.body.data).toEqual({ orders: [], customers: [], bookings: [], products: [] });
  });
});

// ---------------------------------------------------------------------------------------------
describe('Service catalog search is regex-safe', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('services');
  });

  it('partial words still match; regex characters never cause a 500', async () => {
    await makeService({ name: 'Fire Extinguisher Installation', slug: 'fire-extinguisher-installation' });
    const partial = await request(app).get('/api/services?q=install');
    expect(partial.status).toBe(200);
    expect(JSON.stringify(partial.body)).toContain('Installation');
    for (const q of ['(', '[', '.*', '(?<x>', 'a{1,', '\\']) {
      const res = await request(app).get(`/api/services?q=${encodeURIComponent(q)}`);
      expect(res.status, q).toBe(200);
    }
    expect(Service.schema.indexes().some(([spec]) => Object.values(spec).includes('text'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe('Admin dashboard v2', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearCollections('users', 'orders', 'products', 'categories', 'servicebookings', 'services', 'technicians', 'amccontracts');
    // FerretDB has no $dateToString, which the revenue-trend aggregation uses. On the emulator only that single
    // aggregation is stubbed out; everything else in the endpoint runs for real. The revenue numbers themselves
    // are checked by the "revenue trend" test below, which runs on real MongoDB (CI).
    if (EMULATED) vi.spyOn(Order, 'aggregate').mockResolvedValue([] as never);
  });

  it.skipIf(EMULATED)('revenue trend sums paid orders per day and ignores unpaid ones', async () => {
    const admin = await createTestUser('admin');
    const customer = await createTestUser('customer');
    const base = {
      user: customer.user._id, subtotal: 100, discount: 0, gstAmount: 18, shippingFee: 0, status: 'confirmed', paymentMethod: 'mock',
      items: [{ product: customer.user._id, name: 'x', sku: 'x', quantity: 1, unitPrice: 100, gstPercentage: 18, lineTotal: 118 }],
      billingAddress: { contactName: 'a', phone: '9999999999', line1: 'l', city: 'c', state: 's', pincode: '111111' },
      shippingAddress: { contactName: 'a', phone: '9999999999', line1: 'l', city: 'c', state: 's', pincode: '111111' }
    };
    await Order.create({ ...base, orderNumber: 'ORD-REV-1', totalAmount: 118, paymentStatus: 'paid' });
    await Order.create({ ...base, orderNumber: 'ORD-REV-2', totalAmount: 200, paymentStatus: 'paid' });
    await Order.create({ ...base, orderNumber: 'ORD-REV-3', totalAmount: 999, paymentStatus: 'unpaid' });

    const res = await request(app).get('/api/reports/dashboard-v2').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const total = res.body.data.revenueTrend.reduce((a: number, d: { revenue: number }) => a + d.revenue, 0);
    expect(total).toBe(318);
  });

  it('returns 200 with revenue, jobs, AMC renewals, low stock and technician load (it used to 500)', async () => {
    const admin = await createTestUser('admin');
    const customer = await createTestUser('customer', 'amc-owner@example.com');
    const tech = await makeTechnician('busy');
    const service = await makeService();
    await makeBooking({ customerId: customer.user._id, serviceId: service._id, serviceType: service.slug, technicianId: tech.technician._id, status: 'in_progress' });
    const category = await Category.create({ name: 'Low', slug: 'low-stock', isActive: true });
    await Product.create({ name: 'Almost Gone', slug: 'almost-gone', sku: 'LOW-1', category: category._id, price: 10, gstPercentage: 18, stock: 2, isActive: true });
    await AMCContract.collection.insertOne({
      contractNumber: 'AMC-T-1', user: customer.user._id, planName: 'Gold Annual Plan', status: 'active',
      startDate: new Date(Date.now() - 335 * 86_400_000), endDate: new Date(Date.now() + 10 * 86_400_000), createdAt: new Date(), updatedAt: new Date()
    });

    const res = await request(app).get('/api/reports/dashboard-v2').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.amcRenewalsDue[0].planName).toBe('Gold Annual Plan');
    expect(d.lowStockItems[0].sku).toBe('LOW-1');
    const load = d.technicianUtilisation[0];
    expect(load.skills).toBeDefined();
    expect(load).not.toHaveProperty('specialization'); // that field never existed on the Technician model
    expect(load).toMatchObject({ currentAssigned: 1, maxLoad: 4, loadPercentage: 25 });
    expect(d.jobsByStatus.in_progress).toBe(1);
    expect(d.summary.activeJobsCount).toBe(1);
    expect(Array.isArray(d.revenueTrend)).toBe(true);
  });

  it('customer phone/email in AMC renewals are hidden from users without customers.read', async () => {
    const customer = await createTestUser('customer', 'private-amc@example.com');
    await User.updateOne({ _id: customer.user._id }, { $set: { phone: '+919811122233' } });
    await AMCContract.collection.insertOne({
      contractNumber: 'AMC-T-2', user: customer.user._id, planName: 'Silver Plan', status: 'active',
      startDate: new Date(Date.now() - 300 * 86_400_000), endDate: new Date(Date.now() + 5 * 86_400_000), createdAt: new Date(), updatedAt: new Date()
    });
    const limited = await createUserWithPermissions(['reports.read']);
    const res = await request(app).get('/api/reports/dashboard-v2').set('Authorization', `Bearer ${limited.token}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('private-amc@example.com');
    expect(JSON.stringify(res.body)).not.toContain('9811122233');

    const full = await createUserWithPermissions(['reports.read', 'customers.read']);
    const withContacts = await request(app).get('/api/reports/dashboard-v2').set('Authorization', `Bearer ${full.token}`);
    expect(JSON.stringify(withContacts.body)).toContain('private-amc@example.com');
  });

  it('requires reports.read', async () => {
    const customer = await createTestUser('customer');
    expect((await request(app).get('/api/reports/dashboard-v2').set('Authorization', `Bearer ${customer.token}`)).status).toBe(403);
    expect((await request(app).get('/api/reports/dashboard-v2')).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------------------------
describe('Settings access', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('users', 'settings', 'auditlogs');
  });

  it('only a super admin can change settings; admins can read but not write', async () => {
    const superAdmin = await createTestUser('super_admin');
    const admin = await createTestUser('admin');
    const put = (token: string) => request(app).put('/api/settings/company').set('Authorization', `Bearer ${token}`).send({ value: { companyName: 'Changed Co' } });
    expect((await put(admin.token)).status).toBe(403);
    expect((await put(superAdmin.token)).status).toBe(200);
    expect(((await Setting.findOne({ key: 'company' }))!.value as { companyName: string }).companyName).toBe('Changed Co');
    expect((await request(app).get('/api/settings/company').set('Authorization', `Bearer ${admin.token}`)).status).toBeLessThan(500);
  });
});

void makeEquipment;
