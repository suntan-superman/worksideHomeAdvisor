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
  const [command = '', requestReference = ''] = normalized.split(' ');

  if (ACCEPT_WORDS.has(command)) {
    return { status: 'accepted', normalized, requestReference };
  }

  if (DECLINE_WORDS.has(command)) {
    return { status: 'declined', normalized, requestReference };
  }

  if (HELP_WORDS.has(command)) {
    return { status: 'help', normalized, requestReference };
  }

  if (STOP_WORDS.has(command)) {
    return { status: 'opted_out', normalized, requestReference };
  }

  return {
    status: 'custom_reply',
    normalized,
    requestReference,
    rawBody: String(body || '').trim(),
  };
}
