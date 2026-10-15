import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDb, disconnectTestDb, clearCollections, detectEmulatedMongo } from './setup';
import { Category } from '../src/models/Category';
import { Product } from '../src/models/Product';

const EMULATED = await detectEmulatedMongo();

describe.skipIf(EMULATED)('GET /api/products/search', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  let categoryId: unknown;
  const make = (name: string, sku: string, extra: Record<string, unknown> = {}) =>
    Product.create({
      name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), sku, category: categoryId, price: 1000, gstPercentage: 18, stock: 5,
      brand: 'Generic', shortDescription: 'short', description: 'long', images: [{ url: `https://img.test/${sku}.jpg` }], isActive: true, ...extra
    });

  beforeEach(async () => {
    await clearCollections('products', 'categories');
    categoryId = (await Category.create({ name: 'Extinguishers', slug: 'extinguishers', isActive: true }))._id;
  });

  const search = (qs: string) => request(app).get(`/api/products/search${qs}`);

  it('finds products from a PARTIAL word, in any case, and returns image, price and stock for the result row', async () => {
    await make('ABC Dry Powder Fire Extinguisher 4kg', 'ABC-4KG', { discountPrice: 900 });
    await make('Smoke Detector', 'SD-1');

    const res = await search('?q=EXTIN');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      name: 'ABC Dry Powder Fire Extinguisher 4kg', sku: 'ABC-4KG', price: 1000, discountPrice: 900, stock: 5, image: 'https://img.test/ABC-4KG.jpg'
    });
    expect(Object.keys(res.body.data[0]).sort()).not.toContain('description'); // only what a row needs
  });

  it('matches by SKU and by brand, and every word must match', async () => {
    await make('Foam Extinguisher', 'FOAM-9L', { brand: 'Safex' });
    await make('Foam Hose Reel', 'HR-30', { brand: 'Other' });
    expect((await search('?q=foam-9')).body.data.map((p: { sku: string }) => p.sku)).toEqual(['FOAM-9L']);
    expect((await search('?q=safex')).body.data.map((p: { sku: string }) => p.sku)).toEqual(['FOAM-9L']);
    expect((await search('?q=foam extinguisher')).body.data.map((p: { sku: string }) => p.sku)).toEqual(['FOAM-9L']);
    expect((await search('?q=foam nothing')).body.data).toHaveLength(0);
  });

  it('ranks the exact SKU first, then names that start with the query, then names that merely contain it', async () => {
    await make('Wall mounted CO2 bracket', 'BR-1');
    await make('CO2 Fire Extinguisher', 'CO2-5');
    await make('Spare cylinder', 'CO2');
    const names = (await search('?q=co2')).body.data.map((p: { name: string }) => p.name);
    expect(names).toEqual(['Spare cylinder', 'CO2 Fire Extinguisher', 'Wall mounted CO2 bracket']);
  });

  it('hides inactive products', async () => {
    await make('Hidden Extinguisher', 'H-1', { isActive: false });
    expect((await search('?q=extinguisher')).body.data).toHaveLength(0);
  });

  it('paginates with a total, so a long result list can be loaded page by page', async () => {
    for (let i = 1; i <= 25; i++) await make(`Extinguisher ${String(i).padStart(2, '0')}`, `EX-${i}`);
    const first = await search('?q=extinguisher&limit=10&page=1');
    const third = await search('?q=extinguisher&limit=10&page=3');
    expect(first.body.meta).toMatchObject({ page: 1, limit: 10, total: 25, totalPages: 3 });
    expect(first.body.data).toHaveLength(10);
    expect(third.body.data).toHaveLength(5);
    const ids = new Set([...first.body.data, ...third.body.data].map((p: { _id: string }) => p._id));
    expect(ids.size).toBe(15); // no repeats between pages
    expect((await search('?q=extinguisher&limit=5000')).body.meta.limit).toBe(20); // capped
  });

  it('with no query it returns best sellers first (something to show before the person types)', async () => {
    await make('Plain product', 'P-1');
    await make('Star product', 'P-2', { isBestSeller: true });
    const res = await search('');
    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toBe('Star product');
  });

  it('survives hostile input without a 500', async () => {
    for (const q of ['(', '[a-z', '.*', '(a+)+$', '%00', "'; drop", 'a'.repeat(5000), '']) {
      const res = await search(`?q=${encodeURIComponent(q)}`);
      expect(res.status, q).toBe(200);
    }
    expect((await search('?q[$ne]=x')).status).toBe(200);
    expect((await search('?q[]=a&q[]=b')).status).toBe(200);
  });

  it('the product list uses the same partial matching', async () => {
    await make('ABC Dry Powder Fire Extinguisher 4kg', 'ABC-4KG');
    const res = await request(app).get('/api/products?q=extin');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
