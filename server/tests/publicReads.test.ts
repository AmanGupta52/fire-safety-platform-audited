import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser, detectEmulatedMongo } from './setup';
import { Category } from '../src/models/Category';
import { Product } from '../src/models/Product';
import { Banner } from '../src/models/Content';
import { Setting } from '../src/models/AuditLog';
import { setCacheEnabled, publicCache } from '../src/utils/ttlCache';

const EMULATED = await detectEmulatedMongo();

describe('Public list endpoints: lean output, Cache-Control and pagination limits', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => { await clearCollections('users', 'products', 'categories', 'banners', 'services', 'blogposts'); });

  it('product list keeps its response shape and sends Cache-Control: public, max-age=30', async () => {
    const category = await Category.create({ name: 'Ext', slug: 'ext', isActive: true });
    await Product.create({ name: 'P1', slug: 'p1', sku: 'P-1', category: category._id, price: 100, gstPercentage: 18, stock: 3, brand: 'B', shortDescription: 's', description: 'd', isActive: true });

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30');
    expect(res.body.success).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    const item = res.body.data[0];
    expect(item).toMatchObject({ name: 'P1', slug: 'p1', sku: 'P-1', price: 100, stock: 3 });
    expect(typeof item._id).toBe('string');
    expect(item.category).toMatchObject({ name: 'Ext', slug: 'ext' }); // populate still works with lean
    expect(typeof item.createdAt).toBe('string');
  });

  it('the staff view that includes inactive products is NOT marked publicly cacheable', async () => {
    const admin = await createTestUser('admin');
    const res = await request(app).get('/api/products?includeInactive=true').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBeUndefined();
  });

  it('product detail still returns the product with its populated category and related products', async () => {
    const category = await Category.create({ name: 'Ext', slug: 'ext', isActive: true });
    const mk = (n: number) => Product.create({ name: `P${n}`, slug: `p${n}`, sku: `P-${n}`, category: category._id, price: 100, gstPercentage: 18, stock: 3, brand: 'B', shortDescription: 's', description: 'd', isActive: true });
    await mk(1); await mk(2); await mk(3);

    const res = await request(app).get('/api/products/p1');
    expect(res.status).toBe(200);
    expect(res.body.data.product).toMatchObject({ slug: 'p1', category: { name: 'Ext', slug: 'ext' } });
    expect(res.body.data.related.map((r: { slug: string }) => r.slug).sort()).toEqual(['p2', 'p3']);
    expect((await request(app).get('/api/products/missing')).status).toBe(404);
  });

  it('page and limit values that used to misbehave are clamped, never an error', async () => {
    for (const qs of ['page=-1', 'page=abc', 'limit=-5', 'limit=abc', 'limit=0', 'limit=100000', 'page=99999999999']) {
      const res = await request(app).get(`/api/products?${qs}`);
      expect(res.status, qs).toBe(200);
      expect(res.body.meta.page).toBeGreaterThanOrEqual(1);
      expect(res.body.meta.limit).toBeGreaterThanOrEqual(1);
      expect(res.body.meta.limit).toBeLessThanOrEqual(100);
    }
    expect((await request(app).get('/api/products?limit=100000')).body.meta.limit).toBe(100);
  });

  it('categories, banners, public settings, services and blog list are public and carry the 30 s Cache-Control', async () => {
    for (const url of ['/api/categories', '/api/banners', '/api/settings/public', '/api/services', '/api/blog']) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(200);
      expect(res.headers['cache-control'], url).toBe('public, max-age=30');
    }
  });
});

describe('Public reads are cached on the server and refreshed after an admin change', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    setCacheEnabled(true);
    publicCache.clear();
    await clearCollections('users', 'categories', 'banners', 'settings');
  });
  afterEach(() => { setCacheEnabled(false); publicCache.clear(); });

  it('categories: a repeat read is served from the cache, and an admin create/update/delete refreshes it', async () => {
    const admin = await createTestUser('admin');
    const auth = { Authorization: `Bearer ${admin.token}` };

    expect((await request(app).get('/api/categories')).body.data).toHaveLength(0);

    // A change made behind the API's back (direct DB write) is NOT visible yet: proof the second read is cached.
    await Category.create({ name: 'Sneaky', slug: 'sneaky', isActive: true });
    expect((await request(app).get('/api/categories')).body.data).toHaveLength(0);

    // An admin create invalidates the cache, so both categories show up straight away.
    const created = await request(app).post('/api/categories').set(auth).send({ name: 'Extinguishers' });
    expect(created.status).toBe(201);
    const afterCreate = await request(app).get('/api/categories');
    expect(afterCreate.body.data.map((c: { name: string }) => c.name).sort()).toEqual(['Extinguishers', 'Sneaky']);

    const id = created.body.data._id;
    expect((await request(app).put(`/api/categories/${id}`).set(auth).send({ name: 'Renamed' })).status).toBe(200);
    expect((await request(app).get('/api/categories')).body.data.map((c: { name: string }) => c.name)).toContain('Renamed');

    expect((await request(app).delete(`/api/categories/${id}`).set(auth)).status).toBe(200);
    expect((await request(app).get('/api/categories')).body.data.map((c: { name: string }) => c.name)).not.toContain('Renamed');
  });

  it('categories: the cache key includes the query string', async () => {
    await Category.create({ name: 'A', slug: 'a', isActive: true });
    const one = await request(app).get('/api/categories?x=1');
    await Category.create({ name: 'B', slug: 'b', isActive: true });
    const same = await request(app).get('/api/categories?x=1');
    const other = await request(app).get('/api/categories?x=2');
    expect(one.body.data).toHaveLength(1);
    expect(same.body.data).toHaveLength(1); // cached
    expect(other.body.data).toHaveLength(2); // different key, computed fresh
  });

  it('inactive categories shown to staff are never cached and never leak to the public', async () => {
    const admin = await createTestUser('admin');
    await Category.create({ name: 'Visible', slug: 'visible', isActive: true });
    await Category.create({ name: 'Hidden', slug: 'hidden', isActive: false });

    const staff = await request(app).get('/api/categories?includeInactive=true').set('Authorization', `Bearer ${admin.token}`);
    expect(staff.body.data).toHaveLength(2);
    const publicView = await request(app).get('/api/categories?includeInactive=true');
    expect(publicView.body.data.map((c: { name: string }) => c.name)).toEqual(['Visible']);
    // ...and the public view did not poison anything the other way round:
    const staffAgain = await request(app).get('/api/categories?includeInactive=true').set('Authorization', `Bearer ${admin.token}`);
    expect(staffAgain.body.data).toHaveLength(2);
  });

  it('banners: cached for the public, refreshed after an admin banner change', async () => {
    const admin = await createTestUser('admin');
    expect((await request(app).get('/api/banners')).body.data).toHaveLength(0);
    await Banner.create({ title: 'Direct', image: 'https://x.test/a.jpg', isActive: true });
    expect((await request(app).get('/api/banners')).body.data).toHaveLength(0); // cached

    const res = await request(app).post('/api/banners').set('Authorization', `Bearer ${admin.token}`).send({ title: 'Via API', image: 'https://x.test/b.jpg', isActive: true });
    expect(res.status).toBe(201);
    expect((await request(app).get('/api/banners')).body.data).toHaveLength(2);
  });

  it.skipIf(EMULATED)('public settings: cached, then refreshed when a super admin changes them', async () => {
    const superAdmin = await createTestUser('super_admin');
    await Setting.create({ key: 'company', value: { companyName: 'Old Name', phone: '1' } });
    expect((await request(app).get('/api/settings/public')).body.data.company.companyName).toBe('Old Name');

    await Setting.updateOne({ key: 'company' }, { value: { companyName: 'Direct Edit' } });
    expect((await request(app).get('/api/settings/public')).body.data.company.companyName).toBe('Old Name'); // cached

    const put = await request(app).put('/api/settings/company').set('Authorization', `Bearer ${superAdmin.token}`).send({ value: { companyName: 'New Name' } });
    expect(put.status).toBe(200);
    expect((await request(app).get('/api/settings/public')).body.data.company.companyName).toBe('New Name');
  });

  it('sitemap: cached for a minute and refreshed after an admin product change', async () => {
    const admin = await createTestUser('admin');
    const category = await Category.create({ name: 'Ext', slug: 'ext', isActive: true });
    const before = await request(app).get('/sitemap.xml');
    expect(before.status).toBe(200);
    expect(before.text).not.toContain('/product/fresh-one');

    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${admin.token}`).send({
      name: 'Fresh One', sku: 'fresh-1', category: category._id.toString(), price: 100, gstPercentage: 18, stock: 3, brand: 'B', shortDescription: 's', description: 'd'
    });
    expect(res.status).toBe(201);
    const after = await request(app).get('/sitemap.xml');
    expect(after.text).toContain('/product/fresh-one');
    expect(after.headers['content-type']).toContain('application/xml');
  });
});
