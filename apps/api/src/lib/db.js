import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { logError, logInfo } from './logger.js';
import { enableMongooseQueryLogging } from './mongoose-query-logger.js';

export async function connectToDatabase() {
  try {
    enableMongooseQueryLogging();
    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
    });
    logInfo('Connected to MongoDB', {
      database: env.MONGODB_DB_NAME,
    });
    return true;
  } catch (error) {
    logError('MongoDB connection failed. The API will still boot for scaffold work.', {
      message: error.message,
    });
    return false;
  }
}
