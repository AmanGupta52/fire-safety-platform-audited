import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

// The real PDF generator renders a document and stores it. These tests are about permissions and data flow,
// so it is replaced by a stub that returns a fixed URL.
vi.mock('../src/services/pdfService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/pdfService')>();
  return {
    ...original,
    generateServiceReportPdf: vi.fn(async () => ({ url: 'https://files.example.test/report.pdf', publicId: 'report-1' }))
  };
});

import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser, detectEmulatedMongo } from './setup';

// FerretDB cannot run an atomic findOneAndUpdate under real concurrency, so the race test below only runs on real MongoDB (CI).
const EMULATED = await detectEmulatedMongo();
import { ServiceBooking } from '../src/models/ServiceBooking';
import { CustomerEquipment } from '../src/models/CustomerEquipment';
import { makeService, makeTechnician, makeEquipment, makeBooking, isoDay } from './testHelpers';

const SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const completeBody = (extra: Record<string, unknown> = {}) => ({
  workSummary: 'Pressure tested, seal replaced.',
  pressureReading: '15 bar',
  physicalCondition: 'optimal',
  sealIntact: true,
  customerSignature: SIGNATURE,
  ...extra
});

async function scenario(slug = 'fire-safety-audit', status = 'assigned') {
  const customer = await createTestUser('customer');
  const assigned = await makeTechnician('assigned');
  const other = await makeTechnician('other');
  const service = await makeService({ slug, name: slug });
  const equipment = await makeEquipment(customer.user._id);
  const booking = await makeBooking({
    customerId: customer.user._id, serviceId: service._id, serviceType: service.slug,
    technicianId: assigned.technician._id, equipmentId: equipment._id, status
  });
  return { customer, assigned, other, service, equipment, booking };
}

describe('Technician flow: only the assigned technician can act on a job', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('servicebookings', 'services', 'technicians', 'users', 'customerequipments', 'auditlogs');
  });

  it('lets the assigned technician check in, which moves the job to in_progress', async () => {
    const { assigned, booking } = await scenario();
    const res = await request(app).post(`/api/bookings/${booking._id}/check-in`)
      .set('Authorization', `Bearer ${assigned.token}`).send({ latitude: 28.61, longitude: 77.2 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
    expect(res.body.data.checkInLocation.latitude).toBe(28.61);
  });

  it('rejects out-of-range or missing GPS coordinates', async () => {
    const { assigned, booking } = await scenario();
    for (const body of [{}, { latitude: 'x', longitude: 1 }, { latitude: 120, longitude: 10 }, { latitude: 10, longitude: 400 }]) {
      const res = await request(app).post(`/api/bookings/${booking._id}/check-in`)
        .set('Authorization', `Bearer ${assigned.token}`).send(body);
      expect(res.status).toBe(400);
    }
  });

  it('403 for a different technician, on check-in AND on completion', async () => {
    const { other, booking } = await scenario();
    const a = await request(app).post(`/api/bookings/${booking._id}/check-in`)
      .set('Authorization', `Bearer ${other.token}`).send({ latitude: 1, longitude: 1 });
    const b = await request(app).post(`/api/bookings/${booking._id}/complete-report`)
      .set('Authorization', `Bearer ${other.token}`).send(completeBody());
    expect(a.status).toBe(403);
    expect(b.status).toBe(403);
    expect((await ServiceBooking.findById(booking._id))!.status).toBe('assigned');
  });

  it('403 for a customer (even the booking owner) trying to complete a job', async () => {
    const { customer, booking } = await scenario();
    const res = await request(app).post(`/api/bookings/${booking._id}/complete-report`)
      .set('Authorization', `Bearer ${customer.token}`).send(completeBody());
    expect(res.status).toBe(403);
    expect((await ServiceBooking.findById(booking._id))!.status).toBe('assigned');
  });

  it('401 without a token', async () => {
    const { booking } = await scenario();
    const res = await request(app).post(`/api/bookings/${booking._id}/complete-report`).send(completeBody());
    expect(res.status).toBe(401);
  });
});

describe('Technician flow: completing a job', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('servicebookings', 'services', 'technicians', 'users', 'customerequipments', 'auditlogs');
  });

  it("completes the job, stores the report and updates the equipment passport for a HYPHENATED catalog slug", async () => {
    const { assigned, booking, equipment } = await scenario('fire-safety-audit', 'in_progress');

    const res = await request(app).post(`/api/bookings/${booking._id}/complete-report`)
      .set('Authorization', `Bearer ${assigned.token}`).send(completeBody());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.serviceReportUrl).toBe('https://files.example.test/report.pdf');
    expect(res.body.data.completedAt).toBeTruthy();

    const updated = await CustomerEquipment.findById(equipment._id);
    expect(updated!.serviceHistory).toHaveLength(1);
    expect(updated!.serviceHistory[0].type).toBe('inspection'); // 'fire-safety-audit' used to fail the history enum
    expect(updated!.serviceHistory[0].technicianName).toBe('Technician assigned');
    expect(updated!.nextInspectionDate!.getTime()).toBeGreaterThan(Date.now());
    expect(updated!.lastInspectionDate).toBeTruthy();
  });

  it('handles the "amc" slug as an inspection and refills move the refill date', async () => {
    const amc = await scenario('amc', 'in_progress');
    const r1 = await request(app).post(`/api/bookings/${amc.booking._id}/complete-report`)
      .set('Authorization', `Bearer ${amc.assigned.token}`).send(completeBody());
    expect(r1.status).toBe(200);
    expect((await CustomerEquipment.findById(amc.equipment._id))!.serviceHistory[0].type).toBe('inspection');

    const refill = await scenario('fire-extinguisher-refilling', 'in_progress');
    const r2 = await request(app).post(`/api/bookings/${refill.booking._id}/complete-report`)
      .set('Authorization', `Bearer ${refill.assigned.token}`).send(completeBody());
    expect(r2.status).toBe(200);
    const eq = await CustomerEquipment.findById(refill.equipment._id);
    expect(eq!.serviceHistory[0].type).toBe('refilling');
    expect(eq!.nextRefillDate!.getTime()).toBeGreaterThan(Date.now());
  });

  it('a service type an admin invented is recorded as maintenance instead of crashing', async () => {
    const s = await scenario('hydrant-flow-testing', 'in_progress');
    const res = await request(app).post(`/api/bookings/${s.booking._id}/complete-report`)
      .set('Authorization', `Bearer ${s.assigned.token}`).send(completeBody());
    expect(res.status).toBe(200);
    expect((await CustomerEquipment.findById(s.equipment._id))!.serviceHistory[0].type).toBe('maintenance');
  });

  it.skipIf(EMULATED)('a double submit completes once: the second request is 409 and history has one entry', async () => {
    const s = await scenario('amc', 'in_progress');
    const [a, b] = await Promise.all([
      request(app).post(`/api/bookings/${s.booking._id}/complete-report`).set('Authorization', `Bearer ${s.assigned.token}`).send(completeBody()),
      request(app).post(`/api/bookings/${s.booking._id}/complete-report`).set('Authorization', `Bearer ${s.assigned.token}`).send(completeBody())
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await CustomerEquipment.findById(s.equipment._id))!.serviceHistory).toHaveLength(1);
  });

  it('requires a work summary and a valid signature image', async () => {
    const s = await scenario('amc', 'in_progress');
    const noSummary = await request(app).post(`/api/bookings/${s.booking._id}/complete-report`)
      .set('Authorization', `Bearer ${s.assigned.token}`).send(completeBody({ workSummary: '   ' }));
    expect(noSummary.status).toBe(400);

    const badSignature = await request(app).post(`/api/bookings/${s.booking._id}/complete-report`)
      .set('Authorization', `Bearer ${s.assigned.token}`).send(completeBody({ customerSignature: 'data:text/html;base64,PHNjcmlwdD4=' }));
    expect(badSignature.status).toBe(400);
    expect((await ServiceBooking.findById(s.booking._id))!.status).toBe('in_progress');
  });

  it('refuses to complete a job that was cancelled', async () => {
    const s = await scenario('amc', 'cancelled');
    const res = await request(app).post(`/api/bookings/${s.booking._id}/complete-report`)
      .set('Authorization', `Bearer ${s.assigned.token}`).send(completeBody());
    expect(res.status).toBe(409);
  });

  it('ignores non-URL photo values instead of storing them', async () => {
    const s = await scenario('amc', 'in_progress');
    const res = await request(app).post(`/api/bookings/${s.booking._id}/complete-report`)
      .set('Authorization', `Bearer ${s.assigned.token}`)
      .send(completeBody({ beforePhotos: ['javascript:alert(1)', 'https://cdn.example.test/a.jpg'], afterPhotos: 'nope' }));
    expect(res.status).toBe(200);
    expect(res.body.data.beforePhotos).toEqual(['https://cdn.example.test/a.jpg']);
    expect(res.body.data.afterPhotos).toEqual([]);
  });
});

describe('Technician: status updates and job list', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('servicebookings', 'services', 'technicians', 'users', 'customerequipments', 'auditlogs');
  });

  it('the technician can mark own job on the way / in progress, but not completed, cancelled or someone elses', async () => {
    const s = await scenario('amc', 'assigned');

    const onTheWay = await request(app).patch(`/api/bookings/${s.booking._id}/status`)
      .set('Authorization', `Bearer ${s.assigned.token}`).send({ status: 'technician_on_the_way' });
    expect(onTheWay.status).toBe(200);
    expect(onTheWay.body.data.status).toBe('technician_on_the_way');

    for (const status of ['completed', 'cancelled', 'rejected']) {
      const res = await request(app).patch(`/api/bookings/${s.booking._id}/status`)
        .set('Authorization', `Bearer ${s.assigned.token}`).send({ status });
      expect(res.status).toBe(403);
    }

    const foreign = await request(app).patch(`/api/bookings/${s.booking._id}/status`)
      .set('Authorization', `Bearer ${s.other.token}`).send({ status: 'in_progress' });
    expect(foreign.status).toBe(403);
  });

  it('a technician cannot edit the service catalog (services.update was removed from the role)', async () => {
    const { token } = await makeTechnician();
    const service = await makeService();
    const res = await request(app).put(`/api/services/catalog/${service._id}`)
      .set('Authorization', `Bearer ${token}`).send({ startingPrice: 1 });
    expect(res.status).toBe(403);
  });

  it('technician bookings list only shows their own jobs', async () => {
    const s = await scenario('amc', 'assigned');
    const res = await request(app).get('/api/bookings').set('Authorization', `Bearer ${s.other.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    const mine = await request(app).get('/api/bookings').set('Authorization', `Bearer ${s.assigned.token}`);
    expect(mine.body.data).toHaveLength(1);
  });

  it('my-jobs shows overdue open jobs, keeps cancelled ones out of upcoming, and sorts completed by completion date', async () => {
    const customer = await createTestUser('customer');
    const tech = await makeTechnician('mine');
    const service = await makeService();
    const common = { customerId: customer.user._id, serviceId: service._id, serviceType: service.slug, technicianId: tech.technician._id };
    const overdue = await makeBooking({ ...common, daysFromNow: -2, status: 'assigned', slot: '09:00 - 11:00' });
    const upcoming = await makeBooking({ ...common, daysFromNow: 4, status: 'assigned', slot: '11:00 - 13:00' });
    await makeBooking({ ...common, daysFromNow: 5, status: 'cancelled', slot: '14:00 - 16:00' });
    const oldDone = await makeBooking({ ...common, daysFromNow: -20, status: 'completed', slot: '16:00 - 18:00' });
    const newDone = await makeBooking({ ...common, daysFromNow: -30, status: 'completed', slot: '09:00 - 11:00' });
    await ServiceBooking.updateOne({ _id: oldDone._id }, { $set: { completedAt: new Date(Date.now() - 10 * 86400000) } });
    await ServiceBooking.updateOne({ _id: newDone._id }, { $set: { completedAt: new Date(Date.now() - 1 * 86400000) } });

    const res = await request(app).get('/api/bookings/technician/my-jobs').set('Authorization', `Bearer ${tech.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.overdueJobs.map((j: { _id: string }) => j._id)).toEqual([overdue._id.toString()]);
    expect(res.body.data.upcomingJobs.map((j: { _id: string }) => j._id)).toEqual([upcoming._id.toString()]);
    expect(res.body.data.completedJobs.map((j: { _id: string }) => j._id)).toEqual([newDone._id.toString(), oldDone._id.toString()]);
    expect(isoDay(0)).toBeTruthy();
  });
});
