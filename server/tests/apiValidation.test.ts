import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, detectEmulatedMongo, connectTestDb, disconnectTestDb, clearCollections, createTestUser } from './setup';
import { Product } from '../src/models/Product';
import { Category } from '../src/models/Category';
import { Service } from '../src/models/Service';

const EMULATED = await detectEmulatedMongo();

describe('API Validation & Error Handling Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearCollections('products', 'categories', 'services', 'users');
  });

  describe('404 Not Found Handling', () => {
    it('should return 404 with structured JSON response for non-existent routes', async () => {
      const res = await request(app).get('/api/non-existent-route-12345');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/route not found/i);
    });
  });

  describe('Validation Error Handling (Zod Schemas)', () => {
    it('should return 422 with descriptive validation errors when required fields are missing on booking', async () => {
      const { token } = await createTestUser('customer');

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          // missing serviceId/serviceType, phone, address, preferredDate
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/validation/i);
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('should return 422 when password does not meet complexity standards on registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bob',
          email: 'bob@example.com',
          password: 'short', // Too short, missing capital/special
          phone: '+919876543210'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should return 422 when startingPrice is negative in service catalog creation', async () => {
      const { token } = await createTestUser('super_admin');

      const res = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Negative Price Service',
          description: 'Valid description with enough length',
          startingPrice: -500
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Catalog Listing and Text Search Validation', () => {
    it('should list published services and support search query on clean /api/services route', async () => {
      await Service.create([
        {
          name: 'CO2 Fire Extinguisher Refilling',
          slug: 'co2-fire-extinguisher-refilling',
          description: 'High-purity carbon dioxide gas refilling service',
          startingPrice: 850,
          category: 'refilling',
          isActive: true,
          isPublished: true
        },
        {
          name: 'Sprinkler System Annual Maintenance',
          slug: 'sprinkler-system-amc',
          description: 'Comprehensive testing of commercial sprinkler valves and pumps',
          startingPrice: 12000,
          category: 'maintenance',
          isActive: true,
          isPublished: true
        }
      ]);

      // List all public services
      const listRes = await request(app).get('/api/services');
      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.length).toBe(2);

      // Search services by text
      const searchRes = await request(app).get('/api/services?q=sprinkler');
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.length).toBe(1);
      expect(searchRes.body.data[0].slug).toBe('sprinkler-system-amc');
    });

    // Product search uses MongoDB $text, which FerretDB does not implement; it runs on real MongoDB (CI).
    it.skipIf(EMULATED)('should list active products and support search query on /api/products', async () => {
      const category = await Category.create({
        name: 'Fire Extinguishers',
        slug: 'fire-extinguishers',
        isActive: true
      });

      await Product.create({
        name: 'ABC Powder Fire Extinguisher 4kg',
        slug: 'abc-powder-fire-extinguisher-4kg',
        sku: 'EXT-ABC-04',
        category: category._id,
        price: 1800,
        gstPercentage: 18,
        stock: 50,
        brand: 'FireGuard',
        shortDescription: 'Multi-purpose dry powder fire extinguisher',
        isActive: true
      });

      const res = await request(app).get('/api/products?q=FireGuard');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].sku).toBe('EXT-ABC-04');
    });
  });

  describe('Resource Not Found & Invalid Identifier Handling', () => {
    it('should return 404 when product slug does not exist', async () => {
      const res = await request(app).get('/api/products/slug/non-existent-product-slug');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when service slug does not exist', async () => {
      const res = await request(app).get('/api/services/non-existent-service-slug');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
