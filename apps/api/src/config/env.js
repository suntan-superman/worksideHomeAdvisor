import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnvPath = path.resolve(__dirname, '../../../../.env');
const appEnvPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: repoRootEnvPath });
dotenv.config({ path: appEnvPath, override: true });

const stripSecret = (value) => (value || '').replace(/[\s\r\n]+/g, '').trim();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  PUBLIC_WEB_URL: z.string().default('http://localhost:3000'),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/workside-home-seller'),
  MONGODB_DB_NAME: z.string().default('workside-home-seller'),
  JWT_SECRET: z.string().min(16).default('development-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'sendgrid']).default('console'),
  EMAIL_FROM: z.string().email().default('hello@workside.software'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_TTL_MINUTES: z.coerce.number().default(15),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_MODEL_DEFAULT: z.string().default('gpt-4.1-mini'),
  MARKET_DATA_PROVIDER: z.string().default('rentcast'),
  MARKET_DATA_API_KEY: z.string().optional(),
  RENTCAST_API_KEY: z.string().optional(),
  RENTCAST_BASE_URL: z.string().url().default('https://api.rentcast.io/v1'),
  STORAGE_PROVIDER: z.enum(['local', 'gcs']).default('local'),
  STORAGE_LOCAL_DIR: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  GCS_BUCKET_NAME: z.string().optional(),
  GCS_UPLOAD_PREFIX: z.string().default('media-assets'),
});

export const env = envSchema.parse({
  ...process.env,
  OPENAI_API_KEY: stripSecret(process.env.OPENAI_API_KEY),
  SENDGRID_API_KEY: stripSecret(process.env.SENDGRID_API_KEY),
});
