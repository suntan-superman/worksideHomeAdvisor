import { env } from './config/env.js';
import { connectToDatabase } from './lib/db.js';
import { buildApp } from './app.js';
import { startMediaVariantCleanupScheduler } from './modules/media/variant-lifecycle.service.js';

const app = buildApp();

await connectToDatabase();
const stopMediaVariantCleanupScheduler = startMediaVariantCleanupScheduler({
  logger: app.log,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopMediaVariantCleanupScheduler();
  });
}

try {
  await app.listen({
    port: env.PORT,
    host: '0.0.0.0',
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
