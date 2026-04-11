import mongoose from 'mongoose';

import { logError, logInfo } from './logger.js';

const QUERY_LOG_DESTINATION = 'stdout';
let loggerInstalled = false;

function isQueryLoggingEnabled() {
  const rawValue = String(process.env.ENABLE_DB_QUERY_LOGGING || '')
    .trim()
    .toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(rawValue);
}

function normalizeForLog(value, depth = 0) {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (depth > 5) {
    return '[MaxDepth]';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer:${value.length}]`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForLog(item, depth + 1));
  }

  if (typeof value?.toHexString === 'function') {
    return value.toHexString();
  }

  if (typeof value?.toString === 'function') {
    const constructorName = value?.constructor?.name || '';
    if (constructorName === 'ObjectId') {
      return value.toString();
    }
  }

  if (typeof value === 'object') {
    const normalized = {};
    for (const [key, entryValue] of Object.entries(value)) {
      if (typeof entryValue === 'function') {
        continue;
      }
      normalized[key] = normalizeForLog(entryValue, depth + 1);
    }
    return normalized;
  }

  return String(value);
}

function resolveResultCount(result) {
  if (Array.isArray(result)) {
    return result.length;
  }

  if (result === null || result === undefined) {
    return 0;
  }

  if (typeof result === 'object') {
    if (typeof result.modifiedCount === 'number') {
      return result.modifiedCount;
    }
    if (typeof result.deletedCount === 'number') {
      return result.deletedCount;
    }
    if (typeof result.matchedCount === 'number') {
      return result.matchedCount;
    }
    if (typeof result.insertedCount === 'number') {
      return result.insertedCount;
    }
    if (typeof result.upsertedCount === 'number') {
      return result.upsertedCount;
    }
    if (typeof result.n === 'number') {
      return result.n;
    }
    if (typeof result.nModified === 'number') {
      return result.nModified;
    }
    return 1;
  }

  return null;
}

function writeQueryLog(entry) {
  try {
    console.log(JSON.stringify(entry));
  } catch (error) {
    logError('Mongo query logging failed', { message: error.message });
  }
}

function buildQueryEntry({
  collection,
  method,
  query,
  projection,
  update,
  pipeline,
  durationMs,
  result,
  error,
}) {
  const entry = {
    timestamp: new Date().toISOString(),
    collection,
    method,
    query: normalizeForLog(query),
    projection: normalizeForLog(projection),
    durationMs,
  };

  if (update && Object.keys(update).length) {
    entry.update = normalizeForLog(update);
  }

  if (pipeline?.length) {
    entry.pipeline = normalizeForLog(pipeline);
  }

  const resultCount = resolveResultCount(result);
  if (resultCount !== null) {
    entry.resultCount = resultCount;
  }

  if (error) {
    entry.success = false;
    entry.error = error.message;
  } else {
    entry.success = true;
  }

  return entry;
}

function installQueryExecLogger() {
  const originalExec = mongoose.Query.prototype.exec;

  mongoose.Query.prototype.exec = async function loggedQueryExec(...args) {
    const startedAt = Date.now();
    const collection =
      this.model?.collection?.name ||
      this.mongooseCollection?.name ||
      this.collection?.name ||
      'unknown';
    const method = this.op || 'query';
    const query = typeof this.getFilter === 'function' ? this.getFilter() : this.getQuery?.() || {};
    const projection =
      typeof this.projection === 'function' ? this.projection() : this._fields || null;
    const update =
      typeof this.getUpdate === 'function' ? this.getUpdate() : this._update || null;

    try {
      const result = await originalExec.apply(this, args);
      writeQueryLog(
        buildQueryEntry({
          collection,
          method,
          query,
          projection,
          update,
          durationMs: Date.now() - startedAt,
          result,
        }),
      );
      return result;
    } catch (error) {
      writeQueryLog(
        buildQueryEntry({
          collection,
          method,
          query,
          projection,
          update,
          durationMs: Date.now() - startedAt,
          error,
        }),
      );
      throw error;
    }
  };
}

function installAggregateExecLogger() {
  const originalExec = mongoose.Aggregate.prototype.exec;

  mongoose.Aggregate.prototype.exec = async function loggedAggregateExec(...args) {
    const startedAt = Date.now();
    const collection =
      this._model?.collection?.name ||
      this.options?.collection ||
      'unknown';
    const pipeline = typeof this.pipeline === 'function' ? this.pipeline() : this._pipeline || [];

    try {
      const result = await originalExec.apply(this, args);
      writeQueryLog(
        buildQueryEntry({
          collection,
          method: 'aggregate',
          query: {},
          projection: null,
          pipeline,
          durationMs: Date.now() - startedAt,
          result,
        }),
      );
      return result;
    } catch (error) {
      writeQueryLog(
        buildQueryEntry({
          collection,
          method: 'aggregate',
          query: {},
          projection: null,
          pipeline,
          durationMs: Date.now() - startedAt,
          error,
        }),
      );
      throw error;
    }
  };
}

export function enableMongooseQueryLogging() {
  if (!isQueryLoggingEnabled()) {
    return {
      enabled: false,
      destination: QUERY_LOG_DESTINATION,
    };
  }

  if (loggerInstalled) {
    return {
      enabled: true,
      destination: QUERY_LOG_DESTINATION,
    };
  }

  installQueryExecLogger();
  installAggregateExecLogger();
  loggerInstalled = true;

  writeQueryLog({
    timestamp: new Date().toISOString(),
    event: 'mongo_query_logging_enabled',
    success: true,
    destination: QUERY_LOG_DESTINATION,
  });

  logInfo('Mongo query logging enabled', {
    destination: QUERY_LOG_DESTINATION,
  });

  return {
    enabled: true,
    destination: QUERY_LOG_DESTINATION,
  };
}

export function getMongoQueryLogFilePath() {
  return null;
}
