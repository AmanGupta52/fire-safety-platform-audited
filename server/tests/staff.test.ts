import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

const sent: { to: string; subject: string; html: string }[] = [];
let failEmails = false;
vi.mock('../src/services/emailService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/emailService')>();
  return {
    ...original,
    sendEmail: vi.fn(async (to: string, subject: string, html: string) => {
      if (failEmails) throw new Error('SMTP is down');
      sent.push({ to, subject, html });
    })
  };
});

import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser } from './setup';
import { User } from '../src/models/User';
import { RefreshToken } from '../src/models/RefreshToken';

const body = (email: string, extra: Record<string, unknown> = {}) => ({ name: 'New Staff', email, role: 'admin', ...extra });
const create = (token: string, email: string, extra: Record<string, unknown> = {}) =>
  request(app).post('/api/staff').set('Authorization', `Bearer ${token}`).send(body(email, extra));
const tokenFrom = (mail: { html: string }) => /token=([a-f0-9]{64})/.exec(mail.html)![1];

describe('Staff accounts: no passwords by email, one-time set-password links', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    sent.length = 0;
    failEmails = false;
    await clearCollections('users', 'refreshtokens', 'auditlogs');
  });

  it('emails a one-time link, never a password, and never returns secrets in the response', async () => {
    const boss = await createTestUser('super_admin');
    const res = await create(boss.token, 'new.staff@example.com');
    expect(res.status).toBe(201);
    expect(res.body.data.inviteEmailSent).toBe(true);

    const raw = JSON.stringify(res.body);
    for (const field of ['password', 'passwordResetTokenHash', 'emailOtpHash']) expect(raw).not.toContain(`"${field}"`);

    const mail = sent.find((m) => m.to === 'new.staff@example.com')!;
    expect(mail.html).toMatch(/\/reset-password\?token=[a-f0-9]{64}/);
    expect(mail.html).not.toMatch(/temporary password|your password is/i);
  });

  it('the link lets the new person choose a password once, then they can sign in; the link is single-use', async () => {
    const boss = await createTestUser('super_admin');
    await create(boss.token, 'onboard@example.com');
    const token = tokenFrom(sent[0]);

    const set = await request(app).post('/api/auth/reset-password').send({ token, password: 'MyOwnPassword123!' });
    expect(set.status).toBe(200);
    const signIn = await request(app).post('/api/auth/login').send({ email: 'onboard@example.com', password: 'MyOwnPassword123!' });
    expect(signIn.status).toBe(200);
    expect(signIn.body.data.user.role).toBe('admin');

    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'AnotherOne456!' })).status).toBe(400);
  });

  it('nobody can sign in with the internal placeholder password before the link is used', async () => {
    const boss = await createTestUser('super_admin');
    await create(boss.token, 'not-yet@example.com');
    for (const guess of ['password', 'Password123!', 'ChangeMe123!', '']) {
      const res = await request(app).post('/api/auth/login').send({ email: 'not-yet@example.com', password: guess || 'x' });
      expect(res.status).toBe(401);
    }
  });

  it('an expired link is rejected (24-hour limit)', async () => {
    const boss = await createTestUser('super_admin');
    await create(boss.token, 'late@example.com');
    const token = tokenFrom(sent[0]);
    await User.updateOne({ email: 'late@example.com' }, { $set: { passwordResetExpiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'TooLate12345!' })).status).toBe(400);
  });

  it('if the invite email fails, the admin is told and can resend; the old link stops working', async () => {
    const boss = await createTestUser('super_admin');
    failEmails = true;
    const res = await create(boss.token, 'unreachable@example.com');
    expect(res.status).toBe(201);
    expect(res.body.data.inviteEmailSent).toBe(false);
    expect(res.body.message).toMatch(/could not be sent/i);
    const staff = (await User.findOne({ email: 'unreachable@example.com' }))!;

    // still down: the resend reports the failure honestly instead of pretending
    expect((await request(app).post(`/api/staff/${staff._id}/resend-invite`).set('Authorization', `Bearer ${boss.token}`)).status).toBe(502);

    failEmails = false;
    sent.length = 0;
    const resend = await request(app).post(`/api/staff/${staff._id}/resend-invite`).set('Authorization', `Bearer ${boss.token}`);
    expect(resend.status).toBe(200);
    expect(sent).toHaveLength(1);
    const fresh = tokenFrom(sent[0]);
    expect((await request(app).post('/api/auth/reset-password').send({ token: fresh, password: 'BrandNewPass123!' })).status).toBe(200);
  });

  it('a new link replaces the previous one', async () => {
    const boss = await createTestUser('super_admin');
    await create(boss.token, 'replaced@example.com');
    const first = tokenFrom(sent[0]);
    const staff = (await User.findOne({ email: 'replaced@example.com' }))!;
    await request(app).post(`/api/staff/${staff._id}/resend-invite`).set('Authorization', `Bearer ${boss.token}`);
    const second = tokenFrom(sent[1]);
    expect(second).not.toBe(first);
    expect((await request(app).post('/api/auth/reset-password').send({ token: first, password: 'OldLinkTry123!' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: second, password: 'NewLinkOk123!' })).status).toBe(200);
  });

  it('resend is refused for people who already signed in, customers, and without permission', async () => {
    const boss = await createTestUser('super_admin');
    const active = await createTestUser('admin', 'active-admin@example.com');
    await request(app).post('/api/auth/login').send({ email: 'active-admin@example.com', password: 'Password123!' });
    const customer = await createTestUser('customer');
    const plain = await createTestUser('customer');

    const send = (id: string, token: string) => request(app).post(`/api/staff/${id}/resend-invite`).set('Authorization', `Bearer ${token}`);
    expect((await send(active.user._id.toString(), boss.token)).status).toBe(400); // already signed in
    expect((await send(customer.user._id.toString(), boss.token)).status).toBe(404); // not staff
    expect((await send(active.user._id.toString(), plain.token)).status).toBe(403); // no permission
    expect((await send('not-an-id', boss.token)).status).toBe(400);
  });

  it('a plain admin cannot resend an invite to a super admin account', async () => {
    const admin = await createTestUser('admin');
    const pendingSuper = await createTestUser('super_admin');
    await User.updateOne({ _id: pendingSuper.user._id }, { $unset: { lastLoginAt: 1 } });
    const res = await request(app).post(`/api/staff/${pendingSuper.user._id}/resend-invite`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(403);
  });
});

describe('Staff accounts: privilege-escalation guards', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    sent.length = 0;
    await clearCollections('users', 'refreshtokens', 'auditlogs');
  });

  it('an admin cannot create a super admin, and customers cannot create staff at all', async () => {
    const admin = await createTestUser('admin');
    const customer = await createTestUser('customer');
    expect((await create(admin.token, 'wannabe@example.com', { role: 'super_admin' })).status).toBe(403);
    expect((await create(customer.token, 'x@example.com')).status).toBe(403);
    expect(await User.countDocuments({ email: 'wannabe@example.com' })).toBe(0);
  });

  it('rejects duplicate emails (409) and malformed input (422)', async () => {
    const boss = await createTestUser('super_admin');
    expect((await create(boss.token, 'dupe@example.com')).status).toBe(201);
    expect((await create(boss.token, 'dupe@example.com')).status).toBe(409);
    expect((await create(boss.token, 'not-an-email')).status).toBe(422);
    expect((await create(boss.token, 'role@example.com', { role: 'emperor' })).status).toBe(422);
  });

  it('changing a staff member\'s password ends all of their sessions and alerts them', async () => {
    const boss = await createTestUser('super_admin');
    const staff = await createTestUser('admin', 'victim-staff@example.com');
    const login = await request(app).post('/api/auth/login').send({ email: staff.user.email, password: 'Password123!' });
    expect(await RefreshToken.countDocuments({ user: staff.user._id, isRevoked: false })).toBe(1);

    sent.length = 0;
    const upd = await request(app).put(`/api/staff/${staff.user._id}`).set('Authorization', `Bearer ${boss.token}`).send({ password: 'ChangedByBoss123!' });
    expect(upd.status).toBe(200);
    expect(await RefreshToken.countDocuments({ user: staff.user._id, isRevoked: false })).toBe(0);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.data.refreshToken })).status).toBe(401);
    expect(sent.some((m) => m.to === staff.user.email)).toBe(true);
  });
});
