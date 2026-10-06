import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser, createUserWithPermissions } from './setup';
import { AuditLog } from '../src/models/AuditLog';
import { writeSystemAuditLog, verifyAuditChain, computeLogHash } from '../src/services/auditService';
import { env } from '../src/config/env';

const fakeReq = (ip = '203.0.113.1', ua = 'unit-test') =>
  ({ ip, socket: { remoteAddress: ip }, headers: { 'user-agent': ua } }) as never;

async function write(n: number, extra: { data?: unknown } = {}) {
  for (let i = 0; i < n; i++) {
    await writeSystemAuditLog(fakeReq(), 'unit_event', 'tests', { email: `u${i}@example.com`, entity: 'Thing', entityId: `id-${i}`, data: extra.data ?? { i } });
  }
}

describe('Audit log: tamper-evident chain', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('auditlogs');
  });

  it('chains entries with consecutive sequence numbers and verifies', async () => {
    await write(5);
    const rows = await AuditLog.find().sort({ seq: 1 }).lean();
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(rows[0].prevHash).toMatch(/^0+$/); // genesis
    for (let i = 1; i < rows.length; i++) expect(rows[i].prevHash).toBe(rows[i - 1].hash);

    const result = await verifyAuditChain();
    expect(result).toMatchObject({ isValid: true, sealedLogs: 5, legacyLogs: 0 });
  });

  it('simultaneous writes cannot fork the chain (no false tamper alarm)', async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) =>
      writeSystemAuditLog(fakeReq(), 'burst', 'tests', { email: `p${i}@example.com`, data: { i } })
    ));
    const rows = await AuditLog.find().sort({ seq: 1 }).lean();
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.seq)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(new Set(rows.map((r) => r.prevHash)).size).toBe(12); // every entry has its own, distinct predecessor
    expect((await verifyAuditChain()).isValid).toBe(true);
  });

  it('detects an edited field, including previousValue/newValue (the old hash ignored them)', async () => {
    await write(4);
    const target = (await AuditLog.findOne({ seq: 2 }).lean())!;
    // Raw collection access bypasses the model's "immutable" hooks, like an attacker with database access would.
    await AuditLog.collection.updateOne({ _id: target._id }, { $set: { newValue: { i: 'FORGED' } } });
    const result = await verifyAuditChain();
    expect(result.isValid).toBe(false);
    expect(result.invalidEntryId).toBe(String(target._id));
    expect(result.reason).toMatch(/changed after it was written/i);
  });

  it.each([
    ['ipAddress', { ipAddress: '10.9.9.9' }],
    ['actorEmail', { actorEmail: 'someone-else@example.com' }],
    ['action', { action: 'nothing_happened' }],
    ['userAgent', { userAgent: 'forged' }]
  ])('detects an edited %s', async (_name, change) => {
    await write(3);
    const target = (await AuditLog.findOne({ seq: 3 }).lean())!;
    await AuditLog.collection.updateOne({ _id: target._id }, { $set: change });
    expect((await verifyAuditChain()).isValid).toBe(false);
  });

  it('detects a deleted entry in the middle (sequence gap)', async () => {
    await write(5);
    await AuditLog.collection.deleteOne({ seq: 3 });
    const result = await verifyAuditChain();
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/removed or reordered/i);
  });

  it('detects swapped entries', async () => {
    await write(4);
    const [a, b] = await AuditLog.find({ seq: { $in: [2, 3] } }).sort({ seq: 1 }).lean();
    // `seq` has a unique index (that is what stops forks), so a direct swap collides on the first
    // update. Park one entry on a free number first; the end state is the same swap.
    await AuditLog.collection.updateOne({ _id: a._id }, { $set: { seq: 999 } });
    await AuditLog.collection.updateOne({ _id: b._id }, { $set: { seq: 2 } });
    await AuditLog.collection.updateOne({ _id: a._id }, { $set: { seq: 3 } });
    expect((await verifyAuditChain()).isValid).toBe(false);
  });

  it('cannot be re-sealed by someone who does not know the secret key', async () => {
    await write(2);
    const target = (await AuditLog.findOne({ seq: 2 }).lean())!;
    const forgedFields = { ...target, newValue: { i: 'FORGED' } };
    const guess = computeLogHash(
      {
        seq: forgedFields.seq!, prevHash: forgedFields.prevHash, actorId: '', actorEmail: forgedFields.actorEmail || '',
        action: forgedFields.action, module: forgedFields.module, entity: forgedFields.entity || '',
        entityId: String(forgedFields.entityId ?? ''), previousValue: forgedFields.previousValue, newValue: forgedFields.newValue,
        diff: forgedFields.diff, ipAddress: forgedFields.ipAddress || '', userAgent: forgedFields.userAgent || '',
        isoTimestamp: new Date(forgedFields.createdAt).toISOString()
      },
      'attacker-does-not-know-the-key'
    );
    await AuditLog.collection.updateOne({ _id: target._id }, { $set: { newValue: { i: 'FORGED' }, hash: guess } });
    expect((await verifyAuditChain()).isValid).toBe(false);
  });

  it('fails verification if the HMAC secret is different from the one that sealed the entries', async () => {
    await write(2);
    const original = env.auditHmacSecret;
    try {
      env.auditHmacSecret = 'a-completely-different-secret';
      expect((await verifyAuditChain()).isValid).toBe(false);
    } finally {
      env.auditHmacSecret = original;
    }
    expect((await verifyAuditChain()).isValid).toBe(true);
  });

  it('old entries written before the sealed chain are counted, not treated as tampering', async () => {
    // Shape of the first-generation entries: a hash and prevHash but no hashVersion/seq.
    await AuditLog.collection.insertMany([
      { action: 'create', module: 'products', hash: 'a'.repeat(64), prevHash: '0'.repeat(64), createdAt: new Date(Date.now() - 20_000) },
      { action: 'update', module: 'products', hash: 'b'.repeat(64), prevHash: 'a'.repeat(64), createdAt: new Date(Date.now() - 10_000) }
    ]);
    await write(3);
    const result = await verifyAuditChain();
    expect(result).toMatchObject({ isValid: true, legacyLogs: 2, sealedLogs: 3 });
    expect((await AuditLog.findOne({ seq: 1 }).lean())!.prevHash).toBe('b'.repeat(64)); // linked to the newest legacy entry
  });

  it('an empty log verifies as valid', async () => {
    expect(await verifyAuditChain()).toMatchObject({ isValid: true, totalLogs: 0 });
  });

  it('records system events without a signed-in user, and redacts credentials in stored values', async () => {
    await writeSystemAuditLog(fakeReq('198.51.100.7', 'curl/8'), 'password_reset', 'auth', {
      email: 'x@example.com', data: { password: 'hunter2', refreshToken: 'secret', nested: { apiKey: 'k', note: 'visible' } }
    });
    const row = (await AuditLog.findOne({ action: 'password_reset' }).lean())!;
    expect(row.actorType).toBe('system');
    expect(row.user).toBeUndefined();
    expect(row.ipAddress).toBe('198.51.100.7');
    const stored = JSON.stringify(row.newValue);
    expect(stored).not.toContain('hunter2');
    expect(stored).not.toContain('secret');
    expect(stored).toContain('visible');
  });

  it('the model refuses updates and deletes', async () => {
    await write(1);
    await expect(AuditLog.updateOne({}, { $set: { action: 'x' } })).rejects.toThrow(/immutable/i);
    await expect(AuditLog.deleteMany({})).rejects.toThrow(/immutable/i);
    await expect(AuditLog.findOneAndDelete({})).rejects.toThrow(/immutable/i);
    expect(await AuditLog.countDocuments()).toBe(1);
  });
});

describe('Audit log: API', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearCollections('auditlogs', 'users');
  });

  it('staff actions are recorded with the real client IP and user agent', async () => {
    const { token } = await createTestUser('super_admin');
    const res = await request(app)
      .put('/api/settings/company')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', '203.0.113.42')
      .set('User-Agent', 'AdminBrowser/9')
      .send({ value: { companyName: 'Acme Fire Safety', gstin: '27ABCDE1234F1Z5' } });
    expect(res.status).toBe(200);

    const row = (await AuditLog.findOne({ module: 'settings' }).lean())!;
    expect(row.actorType).toBe('user');
    expect(row.ipAddress).toBe('203.0.113.42');
    expect(row.userAgent).toBe('AdminBrowser/9');
    expect(row.hashVersion).toBe(2);
    expect((await verifyAuditChain()).isValid).toBe(true);
  });

  it('GET /audit-logs/verify needs audit.read and reports chain state', async () => {
    await write(2);
    const { token: customerToken } = await createTestUser('customer');
    expect((await request(app).get('/api/audit-logs/verify').set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);

    const { token } = await createUserWithPermissions(['audit.read']);
    const ok = await request(app).get('/api/audit-logs/verify').set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ isValid: true, sealedLogs: 2 });

    await AuditLog.collection.updateOne({ seq: 1 }, { $set: { action: 'tampered' } });
    const bad = await request(app).get('/api/audit-logs/verify').set('Authorization', `Bearer ${token}`);
    expect(bad.body.data.isValid).toBe(false);
  });

  it('lists entries newest first for people with audit.read and hides them from everyone else', async () => {
    await write(3);
    const { token } = await createUserWithPermissions(['audit.read']);
    const res = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    const { token: nobody } = await createTestUser('customer');
    expect((await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${nobody}`)).status).toBe(403);
  });
});
