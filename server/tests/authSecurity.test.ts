import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Capture outgoing emails instead of sending them, so the tests can read reset links and alerts.
const sent: { to: string; subject: string; html: string }[] = [];
vi.mock('../src/services/emailService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/emailService')>();
  return {
    ...original,
    sendEmail: vi.fn(async (to: string, subject: string, html: string) => {
      sent.push({ to, subject, html });
    })
  };
});

import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser, detectEmulatedMongo } from './setup';
import { User } from '../src/models/User';
import { RefreshToken } from '../src/models/RefreshToken';
import { LoginThrottle } from '../src/models/LoginThrottle';
import { AuditLog } from '../src/models/AuditLog';
import { REFRESH_REUSE_GRACE_MS, refreshTtlMs, hashToken } from '../src/utils/jwt';
import { env } from '../src/config/env';

const EMULATED = await detectEmulatedMongo();
const PASSWORD = 'Password123!';
const login = (email: string, password = PASSWORD, headers: Record<string, string> = {}) =>
  request(app).post('/api/auth/login').set(headers).send({ email, password });

const fromIp = (ip: string) => ({ 'X-Forwarded-For': ip });
const ATTACKER = '198.51.100.9';
const OWNER_HOME = '203.0.113.20';

describe('Login: errors never reveal whether an account exists', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    sent.length = 0;
    await clearCollections('users', 'refreshtokens', 'auditlogs');
  });

  it('unknown email and wrong password look identical (status AND message)', async () => {
    const { user } = await createTestUser('customer', 'real@example.com');
    const wrong = await login(user.email, 'WrongPassword!1');
    const unknown = await login('nobody@example.com');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
    expect(wrong.body.message).not.toMatch(/attempt|lock|block|remaining/i);
  });

  it('a blocked IP gets exactly the same answer as a wrong password, even with the CORRECT password', async () => {
    const { user } = await createTestUser('customer', 'victim@example.com');
    for (let i = 0; i < 5; i++) await login(user.email, 'WrongPassword!1', fromIp(ATTACKER));

    const blocked = await login(user.email, PASSWORD, fromIp(ATTACKER));
    const unknown = await login('ghost@example.com', PASSWORD, fromIp(ATTACKER));
    expect(blocked.status).toBe(401);
    expect(blocked.body.message).toBe(unknown.body.message);
  });

  it('a stranger guessing your password can NOT lock you out: the owner on another IP still signs in', async () => {
    const { user } = await createTestUser('customer', 'owner-safe@example.com');
    for (let i = 0; i < 12; i++) await login(user.email, 'WrongPassword!1', fromIp(ATTACKER));
    // the attacker is blocked...
    expect((await login(user.email, PASSWORD, fromIp(ATTACKER))).status).toBe(401);
    // ...but the real owner is not
    const owner = await login(user.email, PASSWORD, fromIp(OWNER_HOME));
    expect(owner.status).toBe(200);
    expect(owner.body.data.accessToken).toBeTruthy();
  });

  it('guessing spread over many IPs still locks the account for everyone (credential-stuffing botnet)', async () => {
    const { user } = await createTestUser('customer', 'botnet@example.com');
    for (let i = 0; i < 20; i++) await login(user.email, 'WrongPassword!1', fromIp(`192.0.2.${i + 1}`));

    const owner = await login(user.email, PASSWORD, fromIp(OWNER_HOME)); // fresh IP, correct password
    expect(owner.status).toBe(401);
    const audit = await AuditLog.find({ action: 'account_locked' });
    expect(audit).toHaveLength(1);
    expect(audit[0].actorEmail).toBe(user.email);
    expect(sent.filter((m) => m.to === user.email && /locked/i.test(m.subject))).toHaveLength(1);
  });

  it('the owner is told by email when an IP is blocked, exactly once, and the block is audited', async () => {
    const { user } = await createTestUser('customer', 'told@example.com');
    for (let i = 0; i < 8; i++) await login(user.email, 'WrongPassword!1', fromIp(ATTACKER)); // 3 extra after the block

    const mails = sent.filter((m) => m.to === user.email && /blocked/i.test(m.subject));
    expect(mails).toHaveLength(1);
    expect(mails[0].html).toContain(ATTACKER);
    expect(mails[0].html).toMatch(/not locked out/i);

    const audit = await AuditLog.find({ action: 'login_blocked' });
    expect(audit).toHaveLength(1);
    expect(audit[0].actorType).toBe('system');
    expect(audit[0].ipAddress).toBe(ATTACKER);
    expect(String(audit[0].user)).toBe(user._id.toString());
  });

  it('unknown emails are throttled too (so probing unregistered addresses gains nothing), without alerts', async () => {
    for (let i = 0; i < 6; i++) await login('not-registered@example.com', 'WrongPassword!1', fromIp(ATTACKER));
    const record = await LoginThrottle.findOne({ scope: 'ip_account' });
    expect(record!.count).toBeGreaterThanOrEqual(5);
    expect(record!.lockUntil).toBeTruthy();
    expect(sent).toHaveLength(0);
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it('counters hold hashes, never the plain email address or IP', async () => {
    await login('plain-text-check@example.com', 'WrongPassword!1', fromIp(ATTACKER));
    const raw = JSON.stringify(await LoginThrottle.find().lean());
    expect(raw).not.toContain('plain-text-check');
    expect(raw).not.toContain(ATTACKER);
  });

  it('a successful login clears the failure counters', async () => {
    const { user } = await createTestUser('customer', 'recover@example.com');
    for (let i = 0; i < 3; i++) await login(user.email, 'WrongPassword!1');
    expect((await login(user.email)).status).toBe(200);
    expect(await LoginThrottle.countDocuments()).toBe(0);
    // ...so four more mistakes do not block this address
    for (let i = 0; i < 4; i++) await login(user.email, 'WrongPassword!1');
    expect((await login(user.email)).status).toBe(200);
  });

  it('a block ends by itself: after it expires the correct password works again', async () => {
    const { user } = await createTestUser('customer', 'expiry@example.com');
    for (let i = 0; i < 5; i++) await login(user.email, 'WrongPassword!1', fromIp(ATTACKER));
    expect((await login(user.email, PASSWORD, fromIp(ATTACKER))).status).toBe(401);
    await LoginThrottle.updateMany({}, { $set: { lockUntil: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() - 1000) } });
    expect((await login(user.email, PASSWORD, fromIp(ATTACKER))).status).toBe(200);
  });

  it('old failures stop counting once the failure window has passed', async () => {
    const { user } = await createTestUser('customer', 'window@example.com');
    for (let i = 0; i < 4; i++) await login(user.email, 'WrongPassword!1', fromIp(ATTACKER));
    await LoginThrottle.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await login(user.email, 'WrongPassword!1', fromIp(ATTACKER)); // would have been the 5th
    expect((await login(user.email, PASSWORD, fromIp(ATTACKER))).status).toBe(200); // not blocked
  });

  it.skipIf(EMULATED)('a burst of parallel wrong guesses is still blocked afterwards (atomic counter)', async () => {
    const { user } = await createTestUser('customer', 'burst@example.com');
    await Promise.all(Array.from({ length: 10 }, () => login(user.email, 'WrongPassword!1', fromIp(ATTACKER))));
    const record = await LoginThrottle.findOne({ scope: 'ip_account' });
    expect(record!.count).toBeGreaterThanOrEqual(5);
    expect(record!.lockUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(sent.filter((m) => /blocked/i.test(m.subject))).toHaveLength(1); // one alert, not ten
  });

  it('keeps the disabled-account and unverified-email messages for people who DO know the password', async () => {
    const disabled = await createTestUser('customer', 'off@example.com');
    await User.updateOne({ _id: disabled.user._id }, { $set: { isActive: false } });
    expect((await login('off@example.com')).status).toBe(403);

    const unverified = await createTestUser('customer', 'unverified@example.com');
    await User.updateOne({ _id: unverified.user._id }, { $set: { isEmailVerified: false } });
    expect((await login('unverified@example.com')).status).toBe(403);
    // ...but a wrong password on those accounts still gives the generic 401, leaking nothing
    expect((await login('off@example.com', 'WrongPassword!1')).status).toBe(401);
  });
});

describe('Sign-in alerts and the recorded IP address', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    sent.length = 0;
    await clearCollections('users', 'refreshtokens', 'auditlogs');
  });

  it('first login: no alert. Same browser again: no alert. New browser: alert with the details', async () => {
    const { user } = await createTestUser('customer', 'devices@example.com');
    const chrome = { 'User-Agent': 'Chrome/120 Windows' };

    expect((await login(user.email, PASSWORD, chrome)).status).toBe(200);
    expect(sent.filter((m) => /sign-in/i.test(m.subject))).toHaveLength(0);

    expect((await login(user.email, PASSWORD, chrome)).status).toBe(200);
    expect(sent.filter((m) => /sign-in/i.test(m.subject))).toHaveLength(0);

    expect((await login(user.email, PASSWORD, { 'User-Agent': 'Firefox/121 Linux' })).status).toBe(200);
    const alerts = sent.filter((m) => /sign-in/i.test(m.subject));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].html).toContain('Firefox/121 Linux');
  });

  it('staff are also alerted when they sign in from a new IP address, customers are not (browser unchanged)', async () => {
    const staff = await createTestUser('admin', 'staff-ip@example.com');
    const customer = await createTestUser('customer', 'cust-ip@example.com');
    const ua = { 'User-Agent': 'Same Browser/1.0' };

    for (const u of [staff, customer]) await login(u.user.email, PASSWORD, { ...ua, 'X-Forwarded-For': '198.51.100.10' });
    sent.length = 0;
    for (const u of [staff, customer]) await login(u.user.email, PASSWORD, { ...ua, 'X-Forwarded-For': '203.0.113.77' });

    expect(sent.filter((m) => m.to === staff.user.email && /sign-in/i.test(m.subject))).toHaveLength(1);
    expect(sent.filter((m) => m.to === customer.user.email && /sign-in/i.test(m.subject))).toHaveLength(0);
  });

  it('escapes a hostile User-Agent in the alert email', async () => {
    const { user } = await createTestUser('customer', 'xss@example.com');
    await login(user.email, PASSWORD, { 'User-Agent': 'Normal/1.0' });
    await login(user.email, PASSWORD, { 'User-Agent': '"><script>alert(1)</script>' });
    const alert = sent.find((m) => /sign-in/i.test(m.subject))!;
    expect(alert.html).not.toContain('<script>');
    expect(alert.html).toContain('&lt;script&gt;');
  });

  it('the recorded IP comes from the trusted proxy hop, not from a header the client invented', async () => {
    const { user } = await createTestUser('customer', 'spoof@example.com');
    // A client can prepend anything; with ONE trusted proxy only the entry that proxy appended counts.
    for (let i = 0; i < 5; i++) await login(user.email, 'WrongPassword!1', { 'X-Forwarded-For': '6.6.6.6, 203.0.113.50' });
    const lock = await AuditLog.findOne({ action: 'login_blocked' });
    expect(lock!.ipAddress).toBe('203.0.113.50');
    expect(lock!.ipAddress).not.toBe('6.6.6.6');
  });
});

describe('Refresh tokens: rotation, reuse detection, logout', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    sent.length = 0;
    await clearCollections('users', 'refreshtokens', 'auditlogs');
  });

  async function signedIn(email = 'rt@example.com') {
    const { user } = await createTestUser('customer', email);
    const res = await login(user.email);
    return { user, access: res.body.data.accessToken as string, refresh: res.body.data.refreshToken as string };
  }
  const refreshWith = (token: string) => request(app).post('/api/auth/refresh').send({ refreshToken: token });

  it('stores only a hash, and rotates the token on every refresh', async () => {
    const { refresh } = await signedIn();
    const stored = await RefreshToken.find();
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).toBe(hashToken(refresh));
    expect(JSON.stringify(stored)).not.toContain(refresh);

    const res = await refreshWith(refresh);
    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).not.toBe(refresh);
    expect(await RefreshToken.countDocuments({ isRevoked: false })).toBe(1);
    expect((await RefreshToken.findOne({ tokenHash: hashToken(refresh) }))!.revokedReason).toBe('rotated');
  });

  it('a just-used token (two tabs) is refused WITHOUT killing the session that won the race', async () => {
    const { refresh } = await signedIn();
    const winner = await refreshWith(refresh);
    const loser = await refreshWith(refresh); // replayed inside the grace window
    expect(winner.status).toBe(200);
    expect(loser.status).toBe(401);
    expect((await refreshWith(winner.body.data.refreshToken)).status).toBe(200); // winner still works
  });

  it('replaying an old rotated token after the grace window ends that login, and only that login', async () => {
    const a = await signedIn('device-a@example.com');
    const otherLogin = await login('device-a@example.com'); // same user, second device = separate family
    const bRefresh = otherLogin.body.data.refreshToken as string;

    const rotated = await refreshWith(a.refresh);
    await RefreshToken.updateOne(
      { tokenHash: hashToken(a.refresh) },
      { $set: { revokedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 5_000) } }
    );

    const replay = await refreshWith(a.refresh); // looks like theft
    expect(replay.status).toBe(401);
    expect((await refreshWith(rotated.body.data.refreshToken)).status).toBe(401); // thief's descendant is dead too
    expect((await refreshWith(bRefresh)).status).toBe(200); // the user's other device is untouched
    expect((await RefreshToken.findOne({ tokenHash: hashToken(rotated.body.data.refreshToken) }))!.revokedReason).toBe('reuse_detected');
  });

  it('logging out revokes the refresh token on the SERVER, so a copied token stops working', async () => {
    const { refresh } = await signedIn();
    const out = await request(app).post('/api/auth/logout').send({ refreshToken: refresh });
    expect(out.status).toBe(200);
    expect((await refreshWith(refresh)).status).toBe(401);
    expect((await RefreshToken.findOne({ tokenHash: hashToken(refresh) }))!.revokedReason).toBe('logout');
  });

  it('logout without a body or with junk is a harmless 200 / 422 and never throws a 500', async () => {
    expect((await request(app).post('/api/auth/logout').send({})).status).toBe(200);
    expect((await request(app).post('/api/auth/logout').send({ refreshToken: 'x' })).status).toBe(422);
    expect((await request(app).post('/api/auth/logout').send({ refreshToken: 'not-a-real-token-but-long-enough' })).status).toBe(200);
  });

  it('rejects tampered, expired-in-database and disabled-account refresh tokens', async () => {
    const { user, refresh } = await signedIn();
    expect((await refreshWith(refresh + 'x')).status).toBe(401);

    const second = await refreshWith(refresh);
    await RefreshToken.updateOne({ tokenHash: hashToken(second.body.data.refreshToken) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await refreshWith(second.body.data.refreshToken)).status).toBe(401);

    const fresh = await login(user.email);
    await User.updateOne({ _id: user._id }, { $set: { isActive: false } });
    expect((await refreshWith(fresh.body.data.refreshToken)).status).toBe(401);
  });

  it.skipIf(EMULATED)('two simultaneous refreshes with the same token: exactly one succeeds (atomic claim)', async () => {
    const { refresh } = await signedIn();
    const results = await Promise.all([refreshWith(refresh), refreshWith(refresh), refreshWith(refresh)]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 401, 401]);
    expect(await RefreshToken.countDocuments({ isRevoked: false })).toBe(1);
  });

  it('old sessions saved before token families existed never cause a mass sign-out', async () => {
    const victim = await createTestUser('customer', 'bystander@example.com');
    const bystander = await login(victim.user.email);

    // A legacy row: no family field, already rotated long ago.
    const legacyUser = await createTestUser('customer', 'legacy@example.com');
    const { token } = await import('../src/utils/jwt').then(async (m) => {
      const t = m.signRefreshToken({ userId: legacyUser.user._id.toString(), jti: 'legacy-jti' });
      return { token: t };
    });
    await RefreshToken.collection.insertOne({
      user: legacyUser.user._id, tokenHash: hashToken(token), isRevoked: true, revokedReason: 'rotated',
      revokedAt: new Date(Date.now() - 3600_000), expiresAt: new Date(Date.now() + 86400_000), createdAt: new Date(), updatedAt: new Date()
    });

    expect((await refreshWith(token)).status).toBe(401); // replay detected
    expect((await refreshWith(bystander.body.data.refreshToken)).status).toBe(200); // unrelated user unaffected
  });

  it('refresh lifetime follows JWT_REFRESH_EXPIRES_IN (the old code hard-coded 7 days)', () => {
    const original = env.jwtRefreshExpiresIn;
    try {
      env.jwtRefreshExpiresIn = '30d';
      expect(refreshTtlMs()).toBe(30 * 86_400_000);
      env.jwtRefreshExpiresIn = '12h';
      expect(refreshTtlMs()).toBe(12 * 3_600_000);
    } finally {
      env.jwtRefreshExpiresIn = original;
    }
  });
});

describe('Password reset', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    sent.length = 0;
    await clearCollections('users', 'refreshtokens', 'auditlogs');
  });

  it('ends every session, kills access tokens issued before the change, alerts staff and is audited', async () => {
    const staff = await createTestUser('admin', 'reset-staff@example.com');
    const session = await login(staff.user.email);
    const oldAccess = session.body.data.accessToken as string;
    const oldRefresh = session.body.data.refreshToken as string;
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldAccess}`)).status).toBe(200);

    await request(app).post('/api/auth/forgot-password').send({ email: staff.user.email });
    const mail = sent.find((m) => /reset/i.test(m.subject) && m.to === staff.user.email)!;
    // Tokens carry their issue time in whole seconds, so make sure the change lands in a LATER second.
    await new Promise((r) => setTimeout(r, 1100));
    const token = /token=([a-f0-9]+)/i.exec(mail.html)![1];

    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewPassword456!' });
    expect(reset.status).toBe(200);

    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh })).status).toBe(401);
    // The 15-minute access token is rejected too, not just the refresh token.
    expect((await User.findById(staff.user._id))!.passwordChangedAt).toBeInstanceOf(Date);
    const stale = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldAccess}`);
    expect(stale.status).toBe(401);

    expect((await login(staff.user.email, 'NewPassword456!')).status).toBe(200);
    expect(sent.some((m) => m.to === staff.user.email && /password/i.test(m.subject) && /staff|reset/i.test(m.html))).toBe(true);

    const audit = await AuditLog.findOne({ action: 'password_reset' });
    expect(audit).toBeTruthy();
    expect(audit!.actorType).toBe('system');
    expect(audit!.actorEmail).toBe(staff.user.email);
  });

  it('resetting the password through the mailbox also lifts any sign-in blocks on that address', async () => {
    const { user } = await createTestUser('customer', 'unblock@example.com');
    for (let i = 0; i < 5; i++) await login(user.email, 'WrongPassword!1', fromIp(ATTACKER));
    expect((await login(user.email, PASSWORD, fromIp(ATTACKER))).status).toBe(401);

    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const token = /token=([a-f0-9]+)/i.exec(sent.find((m) => /reset/i.test(m.subject))!.html)![1];
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'FreshPassword789!' })).status).toBe(200);

    expect(await LoginThrottle.countDocuments()).toBe(0);
    expect((await login(user.email, 'FreshPassword789!', fromIp(ATTACKER))).status).toBe(200);
  });

  it('a reset token works once and is rejected when invalid', async () => {
    const { user } = await createTestUser('customer', 'once@example.com');
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const token = /token=([a-f0-9]+)/i.exec(sent.find((m) => /reset/i.test(m.subject))!.html)![1];

    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'FirstChange123!' })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'SecondChange123!' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'ab'.repeat(32), password: 'Whatever123!' })).status).toBe(400);
    // a malformed (too short) token is rejected by validation before it ever reaches the database
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'deadbeef', password: 'Whatever123!' })).status).toBe(422);
  });

  it('forgot-password answers the same for unknown emails (no account enumeration)', async () => {
    const real = await createTestUser('customer', 'known@example.com');
    const a = await request(app).post('/api/auth/forgot-password').send({ email: real.user.email });
    const b = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.com' });
    expect(a.status).toBe(b.status);
    expect(a.body.message).toBe(b.body.message);
  });
});

describe('Rate limiting on the password endpoints', () => {
  beforeAll(connectTestDb);
  afterAll(async () => {
    delete process.env.RATE_LIMIT_TESTS;
    await disconnectTestDb();
  });

  it('answers 429 after too many forgot-password requests from one IP', async () => {
    process.env.RATE_LIMIT_TESTS = '1';
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await request(app).post('/api/auth/forgot-password').set('X-Forwarded-For', '192.0.2.200').send({ email: 'spam@example.com' });
      statuses.push(res.status);
    }
    delete process.env.RATE_LIMIT_TESTS;
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});
