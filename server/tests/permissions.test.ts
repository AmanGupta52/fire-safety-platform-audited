import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser } from './setup';
import { Technician } from '../src/models/Technician';

describe('Permissions & Role-Based Access Control (RBAC) Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearCollections('users', 'technicians');
  });

  describe('Authentication Gate (requireAuth)', () => {
    it('should return 401 Unauthorized when no Authorization header is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/token missing/i);
    });

    it('should return 401 Unauthorized when malformed or fake token is sent', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should allow access when valid user token is provided', async () => {
      const { token, user } = await createTestUser('customer');
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(user._id.toString());
    });
  });

  describe('Role-Based Access Control Gates (requirePermission / requireRole)', () => {
    it('should deny customer access (403 Forbidden) to admin service catalog endpoints', async () => {
      const { token } = await createTestUser('customer');
      const res = await request(app)
        .get('/api/services/admin/catalog')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should deny customer access (403 Forbidden) to admin bookings list', async () => {
      const { token } = await createTestUser('customer');
      const res = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow super_admin access to any protected resource without explicit permission check', async () => {
      const { token } = await createTestUser('super_admin');
      const res = await request(app)
        .get('/api/services/admin/catalog')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow admin role with services.read to view admin catalog', async () => {
      const { token } = await createTestUser('admin');
      const res = await request(app)
        .get('/api/services/admin/catalog')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow technician to access technician my-jobs route', async () => {
      const { user, token } = await createTestUser('technician');
      await Technician.create({
        user: user._id,
        name: user.name,
        phone: user.phone || '+919876543210',
        employeeId: `TECH-${Date.now()}`,
        skills: ['installation'],
        status: 'active'
      });

      const res = await request(app)
        .get('/api/bookings/technician/my-jobs')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should deny technician access (403) to staff management routes', async () => {
      const { token } = await createTestUser('technician');
      const res = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should deny non-staff roles from modifying service catalog items', async () => {
      const { token } = await createTestUser('customer');
      const res = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Hacked Service',
          description: 'Malicious modification',
          startingPrice: 100
        });
      expect(res.status).toBe(403);
    });
  });
});
