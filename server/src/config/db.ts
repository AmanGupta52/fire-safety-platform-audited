import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.mongodbUri, {
      // Sized for an Atlas free cluster (500 connection cap shared with everyone) and a 512 MB instance.
      maxPoolSize: 10,
      // Fail fast (and let the process restart) instead of hanging forever when Atlas is unreachable.
      serverSelectionTimeoutMS: 10_000,
      // Drop sockets that stay silent for 45 s so a half-dead connection can't stall a request indefinitely.
      socketTimeoutMS: 45_000
    });
    logger.info(`[db] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    logger.fatal({ err }, '[db] MongoDB connection failed');
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('[db] MongoDB disconnected');
  });
}
