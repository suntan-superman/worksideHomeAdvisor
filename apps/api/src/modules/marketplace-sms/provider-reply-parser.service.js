const ACCEPT_WORDS = new Set(['YES', 'Y', 'ACCEPT']);
const DECLINE_WORDS = new Set(['NO', 'N', 'DECLINE']);
const HELP_WORDS = new Set(['HELP']);
const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);

export function normalizeReplyBody(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function parseProviderReply(body) {
  const normalized = normalizeReplyBody(body);

  if (ACCEPT_WORDS.has(normalized)) {
    return { status: 'accepted', normalized };
  }

  if (DECLINE_WORDS.has(normalized)) {
    return { status: 'declined', normalized };
  }

  if (HELP_WORDS.has(normalized)) {
    return { status: 'help', normalized };
  }

  if (STOP_WORDS.has(normalized)) {
    return { status: 'opted_out', normalized };
  }

  return {
    status: 'custom_reply',
    normalized,
    rawBody: String(body || '').trim(),
  };
}
