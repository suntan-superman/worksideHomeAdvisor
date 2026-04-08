import crypto from 'node:crypto';

import { env } from '../../config/env.js';

export function buildNormalizedPublicUrl(pathname = '') {
  return `${String(env.PUBLIC_API_URL || '').replace(/\/+$/, '')}${pathname}`;
}

export function verifyTwilioSignature({
  url,
  params = {},
  providedSignature = '',
  authToken = env.TWILIO_AUTH_TOKEN,
}) {
  if (!authToken) {
    return true;
  }

  const sortedEntries = Object.entries(params).sort(([left], [right]) => left.localeCompare(right));
  let payload = url;

  for (const [key, value] of sortedEntries) {
    payload += `${key}${value ?? ''}`;
  }

  const expected = crypto.createHmac('sha1', authToken).update(payload).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(String(providedSignature || ''));
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
