export function logInfo(message, meta = {}) {
  console.log(`[api] ${message}`, meta);
}

export function logError(message, meta = {}) {
  console.error(`[api] ${message}`, meta);
}
