import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser } from './setup';
import { ServiceBooking } from '../src/models/ServiceBooking';
import { isoDay, SLOT, makeService, makeBooking, makeEquipment, makeTechnician } from './testHelpers';

const base = (extra: Record<string, unknown> = {}) => ({
  phone: '+919876543210',
  address: 'Plot 42, Sector 18, Industrial Area, Gurugram',
  preferredDate: isoDay(5),
  timeSlot: SLOT,
  ...extra
});

describe('Booking creation', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('servicebookings', 'services', 'technicians', 'users', 'customerequipments');
  });

  it('creates a booking from a catalog service and takes serviceType from the catalog slug', async () => {
    const { token, user } = await createTestUser('customer');
    const service = await makeService({ name: 'Industrial Hydrant Testing', slug: 'industrial-hydrant-testing' });

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(base({ serviceId: service._id.toString(), problemDescription: 'Annual testing' }));

    expect(res.status).toBe(201);
    expect(res.body.data.user).toBe(user._id.toString());
    expect(res.body.data.serviceType).toBe('industrial-hydrant-testing');
    expect(res.body.data.status).toBe('requested');
    expect(res.body.data.timeline[0].action).toBe('requested');
  });

  it('resolves a catalog service from serviceType (slug) when serviceId is not sent', async () => {
    const { token } = await createTestUser('customer');
    const service = await makeService({ slug: 'fire-safety-audit', name: 'Fire Safety Audit' });

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(base({ serviceType: 'fire-safety-audit' }));

    expect(res.status).toBe(201);
    expect(res.body.data.service).toBe(service._id.toString());
  });

  it('rejects a serviceType that is not in the catalog (no more free-text types)', async () => {
    const { token } = await createTestUser('customer');
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(base({ serviceType: 'totally-made-up' }));
    expect(res.status).toBe(400);
    expect(await ServiceBooking.countDocuments()).toBe(0);
  });

  it.each([
    ['inactive', { isActive: false }],
    ['unpublished', { isPublished: false }],
    ['deleted', { isDeleted: true }]
  ])('rejects booking a %s service', async (_label, flags) => {
    const { token } = await createTestUser('customer');
    const service = await makeService(flags);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(base({ serviceId: service._id.toString() }));
    expect(res.status).toBe(400);
  });

  it('does not crash (500) on regex-looking serviceType input', async () => {
    const { token } = await createTestUser('customer');
    for (const evil of ['(', '[a-', '.*', '(?<x>', 'a{1,}']) {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(base({ serviceType: evil }));
      expect(res.status).toBeLessThan(500);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('rejects an invalid time slot and a date in the past', async () => {
    const { token } = await createTestUser('customer');
    const service = await makeService();
    const badSlot = await request(app).post('/api/bookings').set('Authorization', `Bearer ${token}`)
      .send(base({ serviceId: service._id.toString(), timeSlot: '03:00 - 04:00' }));
    expect(badSlot.status).toBe(400);

    const past = await request(app).post('/api/bookings').set('Authorization', `Bearer ${token}`)
      .send(base({ serviceId: service._id.toString(), preferredDate: isoDay(-3) }));
    expect(past.status).toBe(400);
  });

  it("does not let a customer attach someone else's equipment", async () => {
    const owner = await createTestUser('customer');
    const attacker = await createTestUser('customer');
    const service = await makeService();
    const equipment = await makeEquipment(owner.user._id);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attacker.token}`)
      .send(base({ serviceId: service._id.toString(), equipmentId: equipment._id.toString() }));
    expect(res.status).toBe(404);
  });

  it('enforces slot capacity on creation (409 once the slot is full)', async () => {
    const service = await makeService();
    // With no technicians the slot holds 3 bookings. Fill it directly.
    for (let i = 0; i < 3; i++) {
      const other = await createTestUser('customer');
      await makeBooking({ customerId: other.user._id, serviceId: service._id, serviceType: service.slug, daysFromNow: 5 });
    }
    const { token } = await createTestUser('customer');
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(base({ serviceId: service._id.toString() }));
    expect(res.status).toBe(409);
    expect(await ServiceBooking.countDocuments()).toBe(3);
  });

  it('cancelled bookings free their place in the slot', async () => {
    const service = await makeService();
    for (let i = 0; i < 3; i++) {
      const other = await createTestUser('customer');
      await makeBooking({
        customerId: other.user._id, serviceId: service._id, serviceType: service.slug, daysFromNow: 5,
        status: i === 0 ? 'cancelled' : 'requested'
      });
    }
    const { token } = await createTestUser('customer');
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(base({ serviceId: service._id.toString() }));
    expect(res.status).toBe(201);
  });

  it('reports slot availability for a date', async () => {
    const res = await request(app).get(`/api/bookings/slots?date=${isoDay(4)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slots.length).toBe(4);
    expect(res.body.data.slots.every((s: { isAvailable: boolean }) => s.isAvailable)).toBe(true);
  });

  it('rejects a malformed slots date', async () => {
    expect((await request(app).get('/api/bookings/slots?date=tomorrow')).status).toBe(400);
  });
});

describe('Customer booking management', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('servicebookings', 'services', 'technicians', 'users', 'customerequipments');
  });

  it("lists a customer's own bookings and hides internal admin notes", async () => {
    const { token, user } = await createTestUser('customer');
    const other = await createTestUser('customer');
    const service = await makeService();
    const mine = await makeBooking({ customerId: user._id, serviceId: service._id, serviceType: service.slug });
    await ServiceBooking.updateOne({ _id: mine._id }, { $set: { adminNotes: 'INTERNAL: customer is difficult' } });
    await makeBooking({ customerId: other.user._id, serviceId: service._id, serviceType: service.slug });

    const res = await request(app).get('/api/bookings/my').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).not.toHaveProperty('adminNotes');
    expect(JSON.stringify(res.body)).not.toContain('INTERNAL');
  });

  it('reschedules an own booking and records it in the customer-visible timeline (not adminNotes)', async () => {
    const { token, user } = await createTestUser('customer');
    const service = await makeService();
    const booking = await makeBooking({ customerId: user._id, serviceId: service._id, serviceType: service.slug });

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredDate: isoDay(9), timeSlot: '14:00 - 16:00', reason: 'Out of town' });

    expect(res.status).toBe(200);
    expect(res.body.data.timeSlot).toBe('14:00 - 16:00');
    const last = res.body.data.timeline.at(-1);
    expect(last.action).toBe('rescheduled');
    expect(last.note).toContain('Out of town');
    expect(res.body.data.adminNotes ?? '').not.toContain('Out of town');
  });

  it('enforces slot capacity when rescheduling too', async () => {
    const { token, user } = await createTestUser('customer');
    const service = await makeService();
    const booking = await makeBooking({ customerId: user._id, serviceId: service._id, serviceType: service.slug });
    for (let i = 0; i < 3; i++) {
      const other = await createTestUser('customer');
      await makeBooking({ customerId: other.user._id, serviceId: service._id, serviceType: service.slug, daysFromNow: 9, slot: '14:00 - 16:00' });
    }
    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredDate: isoDay(9), timeSlot: '14:00 - 16:00' });
    expect(res.status).toBe(409);
  });

  it("refuses to reschedule or cancel somebody else's booking (403)", async () => {
    const owner = await createTestUser('customer');
    const stranger = await createTestUser('customer');
    const service = await makeService();
    const booking = await makeBooking({ customerId: owner.user._id, serviceId: service._id, serviceType: service.slug });

    const r1 = await request(app).patch(`/api/bookings/${booking._id}/reschedule`)
      .set('Authorization', `Bearer ${stranger.token}`).send({ preferredDate: isoDay(8), timeSlot: SLOT });
    const r2 = await request(app).patch(`/api/bookings/${booking._id}/cancel`)
      .set('Authorization', `Bearer ${stranger.token}`).send({});
    expect(r1.status).toBe(403);
    expect(r2.status).toBe(403);
  });

  it('cancels an own booking, but not once it is in progress or completed', async () => {
    const { token, user } = await createTestUser('customer');
    const service = await makeService();
    const open = await makeBooking({ customerId: user._id, serviceId: service._id, serviceType: service.slug });
    const working = await makeBooking({ customerId: user._id, serviceId: service._id, serviceType: service.slug, status: 'in_progress', daysFromNow: 6 });
    const done = await makeBooking({ customerId: user._id, serviceId: service._id, serviceType: service.slug, status: 'completed', daysFromNow: 7 });

    const ok = await request(app).patch(`/api/bookings/${open._id}/cancel`).set('Authorization', `Bearer ${token}`).send({ reason: 'No longer needed' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('cancelled');

    for (const b of [working, done]) {
      const res = await request(app).patch(`/api/bookings/${b._id}/cancel`).set('Authorization', `Bearer ${token}`).send({});
      expect(res.status).toBe(400);
    }
  });
});

describe('Staff: assignment and status flow', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('servicebookings', 'services', 'technicians', 'users', 'customerequipments');
  });

  it('admin assigns a technician (status becomes assigned) and the customer cannot', async () => {
    const customer = await createTestUser('customer');
    const admin = await createTestUser('admin');
    const { technician } = await makeTechnician();
    const service = await makeService();
    const booking = await makeBooking({ customerId: customer.user._id, serviceId: service._id, serviceType: service.slug });

    const denied = await request(app).patch(`/api/bookings/${booking._id}/assign`)
      .set('Authorization', `Bearer ${customer.token}`).send({ technicianId: technician._id.toString() });
    expect(denied.status).toBe(403);

    const ok = await request(app).patch(`/api/bookings/${booking._id}/assign`)
      .set('Authorization', `Bearer ${admin.token}`).send({ technicianId: technician._id.toString() });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('assigned');
    expect(ok.body.data.assignedTechnician).toBe(technician._id.toString());
  });

  it('rejects impossible status jumps and completing without a report', async () => {
    const customer = await createTestUser('customer');
    const admin = await createTestUser('admin');
    const service = await makeService();
    const booking = await makeBooking({ customerId: customer.user._id, serviceId: service._id, serviceType: service.slug });

    const jump = await request(app).patch(`/api/bookings/${booking._id}/status`)
      .set('Authorization', `Bearer ${admin.token}`).send({ status: 'completed' });
    expect(jump.status).toBe(400);

    const cancelled = await makeBooking({ customerId: customer.user._id, serviceId: service._id, serviceType: service.slug, status: 'cancelled', daysFromNow: 8 });
    const revive = await request(app).patch(`/api/bookings/${cancelled._id}/status`)
      .set('Authorization', `Bearer ${admin.token}`).send({ status: 'in_progress' });
    expect(revive.status).toBe(400);
  });

  it('admin can confirm a requested booking and rejects unknown status values with 422', async () => {
    const customer = await createTestUser('customer');
    const admin = await createTestUser('admin');
    const service = await makeService();
    const booking = await makeBooking({ customerId: customer.user._id, serviceId: service._id, serviceType: service.slug });

    const ok = await request(app).patch(`/api/bookings/${booking._id}/status`)
      .set('Authorization', `Bearer ${admin.token}`).send({ status: 'confirmed', adminNotes: 'Called customer' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('confirmed');

    const junk = await request(app).patch(`/api/bookings/${booking._id}/status`)
      .set('Authorization', `Bearer ${admin.token}`).send({ status: 'teleported' });
    expect(junk.status).toBe(422);
  });

  it('keeps the legacy read-only aliases working and no longer maps /services/:id/status to bookings', async () => {
    const customer = await createTestUser('customer');
    const admin = await createTestUser('admin');
    const service = await makeService();
    const booking = await makeBooking({ customerId: customer.user._id, serviceId: service._id, serviceType: service.slug });

    const my = await request(app).get('/api/services/my').set('Authorization', `Bearer ${customer.token}`);
    expect(my.status).toBe(200);
    expect(my.body.data).toHaveLength(1);

    // On /services this path is the CATALOG item, so a booking id must not be accepted as a booking.
    const catalogRoute = await request(app).patch(`/api/services/catalog/${booking._id}/status`)
      .set('Authorization', `Bearer ${admin.token}`).send({ isActive: false });
    expect(catalogRoute.status).toBe(404);
    expect((await ServiceBooking.findById(booking._id))!.status).toBe('requested');
  });
});
