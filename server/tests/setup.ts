import mongoose from 'mongoose';
import { createApp } from '../src/app';
import { User, IUser } from '../src/models/User';
import { signAccessToken, signRefreshToken } from '../src/utils/jwt';
import { ROLE_PERMISSIONS, Role } from '../src/config/permissions';

// Environment (secrets, mail/Cloudinary switched off, test database) is injected by vitest.config.mts before
// anything is imported, so it cannot be overridden by a developer's real server/.env.
const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fire-safety-test-suite';

/** These tests DELETE every document in the collections they touch, so refuse to run against a non-test database. */
export function assertSafeTestDatabase(uri: string) {
  const dbName = (uri.split('?')[0].split('/').pop() || '').toLowerCase();
  if (!dbName.includes('test')) {
    throw new Error(
      `Refusing to run tests against database "${dbName}": its name must contain "test" because the suite wipes it. ` +
        'Set MONGODB_URI_TEST to a dedicated test database.'
    );
  }
}

export const app = createApp();

export async function connectTestDb() {
  assertSafeTestDatabase(TEST_DB_URI);
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI);
  }
}

export async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await clearCollections();
  }
}

export async function clearCollections(...collectionNames: string[]) {
  if (mongoose.connection.readyState === 0) return;
  const collections = mongoose.connection.collections;
  if (collectionNames.length > 0) {
    // Failed-login counters are keyed by email + IP, and tests reuse both, so they are always cleared too.
    if (!collectionNames.includes('loginthrottles')) collectionNames = [...collectionNames, 'loginthrottles'];
    for (const name of collectionNames) {
      if (collections[name]) {
        await collections[name].deleteMany({});
      }
    }
  } else {
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
}

export async function createTestUser(role: Role = 'customer', email?: string): Promise<{ user: IUser; token: string; refreshToken: string }> {
  const timestamp = Date.now() + Math.floor(Math.random() * 100000);
  const userEmail = email || `test-${role}-${timestamp}@example.com`;
  
  const user = await User.create({
    name: `Test ${role}`,
    email: userEmail,
    password: 'Password123!',
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    role,
    permissionOverrides: ROLE_PERMISSIONS[role] || [],
    isActive: true,
    isEmailVerified: true
  });

  const token = signAccessToken({
    userId: user._id.toString(),
    role: user.role,
    permissions: user.effectivePermissions()
  });

  const refreshToken = signRefreshToken({
    userId: user._id.toString()
  });

  return { user, token, refreshToken };
}

/**
 * True when the tests run against FerretDB (a MongoDB look-alike) instead of real MongoDB. FerretDB does not
 * implement a few things the app relies on: $text search, and atomic read-modify-write under concurrent
 * requests. Tests that exercise exactly those features are skipped on the emulator and run for real in CI,
 * which uses a genuine MongoDB 6 service container.
 */
export async function detectEmulatedMongo(): Promise<boolean> {
  assertSafeTestDatabase(TEST_DB_URI);
  const conn = await mongoose.createConnection(TEST_DB_URI, { serverSelectionTimeoutMS: 8000 }).asPromise();
  try {
    const info = await conn.db!.admin().command({ buildInfo: 1 });
    return Boolean(info.ferretdbVersion);
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}

/** Creates a signed-in user whose permissions are EXACTLY the given list (on top of the plain customer role). */
export async function createUserWithPermissions(
  permissions: string[],
  role: Role = 'customer'
): Promise<{ user: IUser; token: string }> {
  const { user } = await createTestUser(role);
  user.permissionOverrides = permissions as never;
  await user.save();
  const token = signAccessToken({
    userId: user._id.toString(),
    role: user.role,
    permissions: user.effectivePermissions()
  });
  return { user, token };
}
