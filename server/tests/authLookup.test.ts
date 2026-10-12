import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser, createUserWithPermissions, detectEmulatedMongo } from './setup';
import { User, effectivePermissionsFor } from '../src/models/User';
import { Order } from '../src/models/Order';

const EMULATED = await detectEmulatedMongo();

describe('Per-request user lookup is slim, and never stale', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => { await clearCollections('users', 'orders', 'quotes'); });

  const me = (token: string) => request(app).get('/api/customers').set('Authorization', `Bearer ${token}`);

  it('a disabled user is blocked on the very next request (no cache to wait out)', async () => {
    const staff = await createTestUser('admin');
    expect((await me(staff.token)).status).toBe(200);
    await User.updateOne({ _id: staff.user._id }, { $set: { isActive: false } });
    const res = await me(staff.token);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Account not found or disabled');
  });

  it('a role change takes effect immediately', async () => {
    const staff = await createTestUser('admin');
    expect((await me(staff.token)).status).toBe(200);
    await User.updateOne({ _id: staff.user._id }, { $set: { role: 'customer' } });
    expect((await me(staff.token)).status).toBe(403);
  });

  it('a change to permission overrides takes effect immediately, in both directions', async () => {
    const granted = await createUserWithPermissions(['customers.read']);
    expect((await me(granted.token)).status).toBe(200);
    await User.updateOne({ _id: granted.user._id }, { $set: { permissionOverrides: [] } });
    expect((await me(granted.token)).status).toBe(403);
    await User.updateOne({ _id: granted.user._id }, { $set: { permissionOverrides: ['customers.read'] } });
    expect((await me(granted.token)).status).toBe(200);
  });

  it('a password change still invalidates access tokens issued before it', async () => {
    const staff = await createTestUser('admin');
    await User.updateOne({ _id: staff.user._id }, { $set: { passwordChangedAt: new Date(Date.now() + 60_000) } });
    const res = await me(staff.token);
    expect(res.status).toBe(401);
    expect(res.body.message).toContain('password change');
  });

  it('the optional-auth path (public endpoints) also sees a disabled account as anonymous', async () => {
    const admin = await createTestUser('admin');
    // As staff, includeInactive is honoured...
    const asStaff = await request(app).get('/api/categories?includeInactive=true').set('Authorization', `Bearer ${admin.token}`);
    expect(asStaff.status).toBe(200);
    await User.updateOne({ _id: admin.user._id }, { $set: { isActive: false } });
    // ...and once disabled the request is simply treated as a public one (no error, no staff view).
    const afterDisable = await request(app).get('/api/categories?includeInactive=true').set('Authorization', `Bearer ${admin.token}`);
    expect(afterDisable.status).toBe(200);
  });

  it('effectivePermissionsFor works on plain objects and de-duplicates', () => {
    const perms = effectivePermissionsFor('customer', ['customers.read', 'customers.read'] as never);
    expect(perms.filter((p) => p === 'customers.read')).toHaveLength(1);
    expect(effectivePermissionsFor('customer', undefined)).toEqual(effectivePermissionsFor('customer', []));
    expect(effectivePermissionsFor('super_admin').length).toBeGreaterThan(effectivePermissionsFor('customer').length);
  });
});

describe('Admin list limits and the customer profile', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => { await clearCollections('users', 'orders', 'quotes', 'coupons', 'blogposts', 'technicians', 'servicebookings', 'amccontracts', 'customerequipments'); });

  it('the customer profile returns at most the latest 50 of each list, but revenue still counts every paid order', async () => {
    const admin = await createTestUser('admin');
    const customer = await createTestUser('customer');
    const addr = { contactName: 'a', phone: '9999999999', line1: 'l', city: 'c', state: 's', pincode: '111111' };
    const orders = Array.from({ length: 55 }, (_, i) => ({
      orderNumber: `ORD-CAP-${i}`, user: customer.user._id, totalAmount: 10, paymentStatus: 'paid', status: 'confirmed', paymentMethod: 'cod',
      subtotal: 10, discount: 0, gstAmount: 0, shippingFee: 0, items: [], billingAddress: addr, shippingAddress: addr,
      createdAt: new Date(Date.now() - i * 60_000), updatedAt: new Date()
    }));
    await Order.collection.insertMany(orders);

    const res = await request(app).get(`/api/customers/${customer.user._id}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(50);
    expect(res.body.data.orders[0].orderNumber).toBe('ORD-CAP-0'); // newest first
    expect(res.body.data.revenue).toBe(550); // all 55 paid orders, not just the 50 shown
    expect(Object.keys(res.body.data).sort()).toEqual(['amc', 'equipment', 'orders', 'quotes', 'revenue', 'services', 'user']);
  });

  it('a customer with no orders has revenue 0', async () => {
    const admin = await createTestUser('admin');
    const customer = await createTestUser('customer');
    const res = await request(app).get(`/api/customers/${customer.user._id}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.revenue).toBe(0);
    expect(res.body.data.orders).toEqual([]);
  });

  it('admin lists that used to be unbounded still work (coupons, blog posts, technicians, equipment)', async () => {
    const admin = await createTestUser('admin');
    for (const url of ['/api/coupons', '/api/blog/admin/all', '/api/technicians', '/api/equipment', '/api/equipment/due']) {
      const res = await request(app).get(url).set('Authorization', `Bearer ${admin.token}`);
      expect(res.status, url).toBe(200);
      expect(Array.isArray(res.body.data), url).toBe(true);
    }
  });
});
