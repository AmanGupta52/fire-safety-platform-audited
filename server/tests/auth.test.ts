import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDb, disconnectTestDb, clearCollections, createTestUser } from './setup';
import { User } from '../src/models/User';

describe('Authentication Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearCollections('users', 'refreshtokens');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and initiate email verification', async () => {
      const payload = {
        name: 'Jane Doe',
        email: 'janedoe@example.com',
        password: 'Password123!',
        phone: '+919876543210'
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(payload.email);
      expect(res.body.data.otpExpiresInMinutes).toBeDefined();

      // Verify user was stored with password properly hashed
      const stored = await User.findOne({ email: payload.email }).select('+password');
      expect(stored).not.toBeNull();
      expect(stored!.password).not.toBe(payload.password);
      expect(stored!.password).toMatch(/^\$2[aby]\$/);
    });

    it('should reject registration with duplicate email (409)', async () => {
      await createTestUser('customer', 'duplicate@example.com');

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: 'duplicate@example.com',
          password: 'Password123!',
          phone: '+919999888877'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('should reject registration when required fields are missing (422)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane'
          // missing email, password, phone
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should log in successfully with correct credentials for verified account', async () => {
      const testEmail = 'verifiedlogin@example.com';
      const testPassword = 'Password123!';

      await createTestUser('customer', testEmail);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
    });

    it('should return 401 when password is wrong', async () => {
      const testEmail = 'wrongpass@example.com';
      await createTestUser('customer', testEmail);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword999!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it('should return 401 for non-existent user email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 if user account is deactivated', async () => {
      const { user } = await createTestUser('customer', 'inactive@example.com');
      user.isActive = false;
      await user.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/disabled/i);
    });
  });

  describe('POST /api/auth/refresh & /api/auth/logout', () => {
    it('should issue new access token using a valid refresh token', async () => {
      const { user } = await createTestUser('customer', 'tokenref@example.com');

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'Password123!'
        });

      const refreshToken = loginRes.body.data.refreshToken;
      expect(refreshToken).toBeDefined();

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
    });

    it('should reject invalid or tampered refresh token (401)', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.jwt.token' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should successfully log out and invalidate refresh token', async () => {
      const { user } = await createTestUser('customer', 'logoutuser@example.com');

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'Password123!'
        });

      const refreshToken = loginRes.body.data.refreshToken;

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Attempting to refresh with the revoked token should now fail
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(reuseRes.status).toBe(401);
    });
  });
});
