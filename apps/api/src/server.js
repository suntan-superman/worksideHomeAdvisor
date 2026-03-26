import { env } from './config/env.js';
import { connectToDatabase } from './lib/db.js';
import { buildApp } from './app.js';

const app = buildApp();

await connectToDatabase();

try {
  await app.listen({
    port: env.PORT,
    host: '0.0.0.0',
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
