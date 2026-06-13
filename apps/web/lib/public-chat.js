const MERXUS_CHAT_API_BASE_URL = (
  process.env.NEXT_PUBLIC_MERXUS_CHAT_API_URL ||
  process.env.NEXT_PUBLIC_MERXUS_API_URL ||
  'https://api.merxus.ai/api'
).replace(/\/+$/g, '');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function meaningfulText(value) {
  const text = String(value ?? '').trim();
  if (!text || ['undefined', 'null', '[object object]'].includes(text.toLowerCase())) return '';
  return text;
}

function normalizeErrorCode(code) {
  return meaningfulText(code).replace(/[\s-]+/g, '_').toUpperCase();
}

function normalizeRequiredAction(action) {
  return meaningfulText(action).replace(/[\s-]+/g, '_').toLowerCase();
}

export class PublicChatError extends Error {
  constructor(message, { status = null, code = '', requiredAction = '', details = null, payload = null } = {}) {
    super(meaningfulText(message) || 'Chat is temporarily unavailable.');
    this.name = 'PublicChatError';
    this.status = status;
    this.code = normalizeErrorCode(code);
    this.requiredAction = normalizeRequiredAction(requiredAction);
    this.details = details;
    this.payload = payload;
  }
}

export function publicChatErrorMessage(error) {
  return meaningfulText(error?.message) || 'Chat is temporarily unavailable.';
}

export function isPublicChatClosedPayload(payload = {}) {
  const data = isPlainObject(payload) ? payload : {};
  const session = isPlainObject(data.session) ? data.session : {};
  const details = isPlainObject(data.details) ? data.details : {};
  const status = meaningfulText(
    data.status ||
      data.sessionStatus ||
      data.state ||
      details.status ||
      details.sessionStatus ||
      session.status ||
      session.sessionStatus ||
      session.state,
  ).toLowerCase();

  return (
    data.closed === true ||
    data.ended === true ||
    details.closed === true ||
    details.ended === true ||
    session.closed === true ||
    session.ended === true ||
    ['closed', 'ended', 'resolved', 'timeout', 'timed_out', 'visitor_ended_chat', 'agent_closed'].includes(status)
  );
}

export function isPublicChatClosedError(error) {
  if (!error) return false;
  if (['SESSION_CLOSED', 'CHAT_CLOSED', 'CONVERSATION_CLOSED'].includes(normalizeErrorCode(error.code))) return true;
  if (isPublicChatClosedPayload(error.payload) || isPublicChatClosedPayload(error.details)) return true;
  return /(?:session|chat|conversation)\s+(?:is\s+)?(?:closed|ended)/i.test(meaningfulText(error.message));
}

function extractPublicChatError(payload, response = {}) {
  const data = isPlainObject(payload) ? payload : {};
  const nested = isPlainObject(data.error) ? data.error : {};
  const details = isPlainObject(data.details) ? data.details : isPlainObject(nested.details) ? nested.details : null;
  const message =
    meaningfulText(nested.message) ||
    meaningfulText(data.error) ||
    meaningfulText(data.message) ||
    meaningfulText(details?.message) ||
    meaningfulText(response.statusText) ||
    'Chat is temporarily unavailable.';

  return {
    message,
    code: normalizeErrorCode(nested.code || data.code || details?.code),
    requiredAction: normalizeRequiredAction(nested.requiredAction || data.requiredAction || details?.requiredAction),
    details,
    payload,
  };
}

async function parsePayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function publicChatRequest(path, options = {}) {
  const response = await fetch(`${MERXUS_CHAT_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await parsePayload(response);
  if (!response.ok) {
    const parsed = extractPublicChatError(payload, response);
    throw new PublicChatError(parsed.message, {
      status: response.status,
      code: parsed.code,
      requiredAction: parsed.requiredAction,
      details: parsed.details,
      payload: parsed.payload,
    });
  }
  return payload;
}

export function createPublicChatSession(body) {
  return publicChatRequest('/chat/public/session', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function sendPublicChatMessage(sessionId, body) {
  return publicChatRequest(`/chat/public/session/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listPublicChatMessages(sessionId) {
  return publicChatRequest(`/chat/public/session/${encodeURIComponent(sessionId)}/messages`);
}

export function requestPublicChatHuman(sessionId, body = {}) {
  return publicChatRequest(`/chat/public/session/${encodeURIComponent(sessionId)}/request-human`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function submitPublicChatAnswerFeedback(sessionId, body = {}) {
  return publicChatRequest(`/chat/public/session/${encodeURIComponent(sessionId)}/answer-feedback`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function sendPublicChatTranscript(sessionId, body = {}) {
  return publicChatRequest(`/chat/public/session/${encodeURIComponent(sessionId)}/transcript`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function timeoutPublicChatSession(sessionId, body = {}) {
  return publicChatRequest(`/chat/public/session/${encodeURIComponent(sessionId)}/timeout`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
