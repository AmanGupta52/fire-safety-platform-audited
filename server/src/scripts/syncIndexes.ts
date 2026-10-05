/**
 * One-off index migration. Run it ONCE on any database that already has data:
 *
 *     npm run db:sync-indexes
 *
 * Why it exists: MongoDB allows only ONE text index per collection, and an index cannot be changed in place.
 * Earlier versions created a different text index on `products` (and a text index on `services`), so on an
 * existing database the new definitions fail to build until the old ones are dropped. This script drops only
 * those known-obsolete indexes, then builds every index the models declare. It never touches your data.
 */
import mongoose from 'mongoose';
import 'dotenv/config';
import { env } from '../config/env';
import { Product } from '../models/Product';
import { Service } from '../models/Service';
import { Review } from '../models/Review';
import { AuditLog } from '../models/AuditLog';
import { RefreshToken } from '../models/RefreshToken';
import { ServiceBooking } from '../models/ServiceBooking';
import { Order } from '../models/Order';
import { CustomerEquipment } from '../models/CustomerEquipment';
import { User } from '../models/User';

async function dropIfExists(model: { collection: mongoose.Collection }, matcher: (idx: { name?: string; key?: Record<string, unknown> }) => boolean, label: string) {
  let indexes: { name?: string; key?: Record<string, unknown> }[] = [];
  try {
    indexes = await model.collection.indexes();
  } catch {
    return; // collection does not exist yet; nothing to drop
  }
  for (const idx of indexes) {
    if (idx.name && matcher(idx)) {
      await model.collection.dropIndex(idx.name);
      console.log(`  dropped obsolete index ${label}: ${idx.name}`);
    }
  }
}

async function main() {
  await mongoose.connect(env.mongodbUri);
  console.log(`Connected to ${mongoose.connection.name}`);

  // products: keep only the current text index ("product_text_search").
  await dropIfExists(Product, (i) => !!i.key && '_fts' in i.key && i.name !== 'product_text_search', 'products');
  // services: the text index added in an earlier version is never used by the search code, so it is removed.
  await dropIfExists(Service, (i) => i.name === 'service_text_search' || (!!i.key && '_fts' in i.key), 'services');

  const models = [Product, Service, Review, AuditLog, RefreshToken, ServiceBooking, Order, CustomerEquipment, User];
  for (const m of models) {
    try {
      await m.createIndexes();
      console.log(`  indexes OK: ${m.collection.name}`);
    } catch (err) {
      console.error(`  FAILED on ${m.collection.name}:`, (err as Error).message);
      process.exitCode = 1;
    }
  }

  await mongoose.disconnect();
  console.log(process.exitCode ? 'Finished with errors (see above).' : 'Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
