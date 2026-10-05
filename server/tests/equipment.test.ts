import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser } from './setup';
import { User } from '../src/models/User';
import { CustomerEquipment } from '../src/models/CustomerEquipment';
import { AuditLog } from '../src/models/AuditLog';
import { makeService, makeTechnician, makeEquipment, makeBooking } from './testHelpers';

const PRIVATE_STRINGS = ['Gate code 4455', 'Warehouse B, 12 Private Road', '+91', '@example.com'];

async function owner(extra: Record<string, unknown> = {}) {
  const made = await createTestUser('customer', `owner-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.com`);
  if (Object.keys(extra).length) await User.updateOne({ _id: made.user._id }, { $set: extra });
  return made;
}

describe('Equipment passport: what an anonymous person can see', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('users', 'customerequipments', 'servicebookings', 'services', 'technicians', 'auditlogs');
  });

  it('shows the equipment facts but NEVER the owner contact details, address, notes or report links', async () => {
    const o = await owner();
    const equipment = await makeEquipment(o.user._id, { serialNumber: 'FE-PUBLIC-1' });
    equipment.serviceHistory.push({
      date: new Date(), type: 'inspection', technicianName: 'Ravi', pressureReading: '15 bar', physicalCondition: 'optimal',
      sealIntact: true, notes: 'Customer gate code 4455 and phone +919800000000', reportUrl: 'https://files.example.test/private-report.pdf'
    });
    await equipment.save();

    const res = await request(app).get('/api/equipment/passport/FE-PUBLIC-1');
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);

    for (const secret of [...PRIVATE_STRINGS, o.user.email, o.user.phone!, o.user.name, 'private-report.pdf', 'Ravi']) {
      expect(body, `public passport leaked: ${secret}`).not.toContain(secret);
    }
    expect(res.body.data.serialNumber).toBe('FE-PUBLIC-1');
    expect(res.body.data.status).toBeDefined();
    expect(res.body.data.serviceHistory[0]).toMatchObject({ type: 'inspection', pressureReading: '15 bar', sealIntact: true });
    expect(res.body.data.serviceHistory[0]).not.toHaveProperty('notes');
    expect(res.body.data.serviceHistory[0]).not.toHaveProperty('reportUrl');
    expect(res.body.data).not.toHaveProperty('installationLocation');
    expect(res.body.data.user).toBeUndefined();
  });

  it('shows a company name only when the owner is a business', async () => {
    const o = await owner({ companyName: 'Acme Industries Pvt Ltd' });
    await makeEquipment(o.user._id, { serialNumber: 'FE-CO-1' });
    const res = await request(app).get('/api/equipment/passport/FE-CO-1');
    expect(res.body.data.user).toEqual({ companyName: 'Acme Industries Pvt Ltd' });
  });

  it('looks up by serial number case-insensitively and returns a clean 404 for unknown ones', async () => {
    const o = await owner();
    await makeEquipment(o.user._id, { serialNumber: 'FE-CASE-1' });
    expect((await request(app).get('/api/equipment/passport/fe-case-1')).status).toBe(200);
    expect((await request(app).get('/api/equipment/passport/NOPE-123')).status).toBe(404);
    expect((await request(app).get('/api/equipment/passport/(')).status).toBe(404);
  });

  it('the owner and admins get the full record', async () => {
    const o = await owner();
    const admin = await createTestUser('admin');
    await makeEquipment(o.user._id, { serialNumber: 'FE-FULL-1' });

    for (const token of [o.token, admin.token]) {
      const res = await request(app).get('/api/equipment/passport/FE-FULL-1').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Gate code 4455');
      expect(res.body.data.installationLocation).toContain('Private Road');
    }
  });

  it("another customer is treated like an anonymous visitor", async () => {
    const o = await owner();
    const stranger = await owner();
    await makeEquipment(o.user._id, { serialNumber: 'FE-STRANGER-1' });
    const res = await request(app).get('/api/equipment/passport/FE-STRANGER-1').set('Authorization', `Bearer ${stranger.token}`);
    expect(JSON.stringify(res.body)).not.toContain('Gate code 4455');
  });

  it('a technician sees full details only for equipment on a job assigned to them', async () => {
    const o = await owner();
    const mine = await makeTechnician('mine');
    const other = await makeTechnician('other');
    const service = await makeService();
    const equipment = await makeEquipment(o.user._id, { serialNumber: 'FE-TECH-1' });
    await makeBooking({ customerId: o.user._id, serviceId: service._id, serviceType: service.slug, technicianId: mine.technician._id, equipmentId: equipment._id, status: 'assigned' });

    const assigned = await request(app).get('/api/equipment/passport/FE-TECH-1').set('Authorization', `Bearer ${mine.token}`);
    expect(assigned.body.data.notes).toBe('Gate code 4455');

    const unrelated = await request(app).get('/api/equipment/passport/FE-TECH-1').set('Authorization', `Bearer ${other.token}`);
    expect(JSON.stringify(unrelated.body)).not.toContain('Gate code 4455');
    expect(unrelated.body.data.user).toBeUndefined();
  });
});

describe('Equipment passport: recording a service event', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('users', 'customerequipments', 'servicebookings', 'services', 'technicians', 'auditlogs');
  });

  const event = (extra: Record<string, unknown> = {}) => ({ type: 'inspection', pressureReading: '14 bar', physicalCondition: 'fair', notes: 'checked', ...extra });

  it('401 without login, 403 for customers (even the owner) - the open hole in the old code', async () => {
    const o = await owner();
    const equipment = await makeEquipment(o.user._id);
    expect((await request(app).post(`/api/equipment/passport/${equipment._id}/log`).send(event())).status).toBe(401);
    const asOwner = await request(app).post(`/api/equipment/passport/${equipment._id}/log`).set('Authorization', `Bearer ${o.token}`).send(event());
    expect(asOwner.status).toBe(403);
    const stranger = await owner();
    expect((await request(app).post(`/api/equipment/passport/${equipment._id}/log`).set('Authorization', `Bearer ${stranger.token}`).send(event())).status).toBe(403);
    expect((await CustomerEquipment.findById(equipment._id))!.serviceHistory).toHaveLength(0);
  });

  it('an unrelated technician is refused; one without a bookingId is refused', async () => {
    const o = await owner();
    const mine = await makeTechnician('mine');
    const other = await makeTechnician('other');
    const service = await makeService();
    const equipment = await makeEquipment(o.user._id);
    const booking = await makeBooking({ customerId: o.user._id, serviceId: service._id, serviceType: service.slug, technicianId: mine.technician._id, equipmentId: equipment._id, status: 'in_progress' });

    const noBooking = await request(app).post(`/api/equipment/passport/${equipment._id}/log`).set('Authorization', `Bearer ${mine.token}`).send(event());
    expect(noBooking.status).toBe(400);

    const wrongTech = await request(app).post(`/api/equipment/passport/${equipment._id}/log`).set('Authorization', `Bearer ${other.token}`).send(event({ bookingId: booking._id.toString() }));
    expect(wrongTech.status).toBe(403);
    expect((await CustomerEquipment.findById(equipment._id))!.serviceHistory).toHaveLength(0);
  });

  it('the assigned technician can record it, and the technician NAME comes from the server, not the request', async () => {
    const o = await owner();
    const mine = await makeTechnician('Real Name');
    const service = await makeService();
    const equipment = await makeEquipment(o.user._id);
    const booking = await makeBooking({ customerId: o.user._id, serviceId: service._id, serviceType: service.slug, technicianId: mine.technician._id, equipmentId: equipment._id, status: 'in_progress' });

    const res = await request(app).post(`/api/equipment/passport/${equipment._id}/log`).set('Authorization', `Bearer ${mine.token}`)
      .send(event({ bookingId: booking._id.toString(), technicianName: 'Forged Name', nextDate: '2027-01-01' }));
    expect(res.status).toBe(200);
    const entry = (await CustomerEquipment.findById(equipment._id))!.serviceHistory[0];
    expect(entry.technicianName).toBe('Technician Real Name');
    expect(String(entry.bookingId)).toBe(booking._id.toString());
    expect((await AuditLog.findOne({ action: 'log_service_event' }))).toBeTruthy();
  });

  it('a technician cannot use a booking for DIFFERENT equipment, or a finished job', async () => {
    const o = await owner();
    const mine = await makeTechnician('mine');
    const service = await makeService();
    const equipA = await makeEquipment(o.user._id);
    const equipB = await makeEquipment(o.user._id);
    const bookingForA = await makeBooking({ customerId: o.user._id, serviceId: service._id, serviceType: service.slug, technicianId: mine.technician._id, equipmentId: equipA._id, status: 'in_progress' });
    const doneForB = await makeBooking({ customerId: o.user._id, serviceId: service._id, serviceType: service.slug, technicianId: mine.technician._id, equipmentId: equipB._id, status: 'completed', daysFromNow: 4 });

    const wrongEquipment = await request(app).post(`/api/equipment/passport/${equipB._id}/log`).set('Authorization', `Bearer ${mine.token}`).send(event({ bookingId: bookingForA._id.toString() }));
    expect(wrongEquipment.status).toBe(403);
    const finished = await request(app).post(`/api/equipment/passport/${equipB._id}/log`).set('Authorization', `Bearer ${mine.token}`).send(event({ bookingId: doneForB._id.toString() }));
    expect(finished.status).toBe(403);
  });

  it('admins can record on any equipment; bad input is rejected', async () => {
    const o = await owner();
    const admin = await createTestUser('admin');
    const equipment = await makeEquipment(o.user._id);
    const url = `/api/equipment/passport/${equipment._id}/log`;

    expect((await request(app).post(url).set('Authorization', `Bearer ${admin.token}`).send(event({ type: 'refilling', nextDate: '2027-06-01' }))).status).toBe(200);
    const updated = (await CustomerEquipment.findById(equipment._id))!;
    expect(updated.serviceHistory[0].type).toBe('refilling');
    expect(updated.lastRefillDate).toBeTruthy();
    expect(updated.nextRefillDate!.toISOString().slice(0, 10)).toBe('2027-06-01');

    for (const bad of [{ type: 'hacking' }, { type: undefined }, { reportUrl: 'javascript:alert(1)' }, { nextDate: 'tomorrow-ish' }]) {
      expect((await request(app).post(url).set('Authorization', `Bearer ${admin.token}`).send(event(bad))).status).toBe(400);
    }
    expect((await request(app).post('/api/equipment/passport/not-an-id/log').set('Authorization', `Bearer ${admin.token}`).send(event())).status).toBe(400);
  });
});
