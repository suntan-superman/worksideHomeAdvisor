'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createPublicChatSession,
  isPublicChatClosedError,
  isPublicChatClosedPayload,
  listPublicChatMessages,
  publicChatErrorMessage,
  requestPublicChatHuman,
  sendPublicChatMessage,
  sendPublicChatTranscript,
  timeoutPublicChatSession,
} from '../lib/public-chat';
import { getStoredSession } from '../lib/session';

const STORAGE_PREFIX = 'worksideHomeAdvisor.publicChat';
const IDLE_WARNING_MS = 5 * 60 * 1000;
const IDLE_TERMINATE_MS = 60 * 1000;
const IDLE_CHECK_MS = 5000;
const INITIAL_MESSAGE = {
  id: 'welcome',
  sender: 'ai',
  body: 'Hi, I am the Workside Home Advisor assistant. I can answer product questions or notify a person when you need live help.',
};

let chatAudioContext;

function messageKey(message) {
  return message.id || `${message.sender}:${message.body}:${message.createdAt || ''}`;
}

function isInboundMessage(message) {
  const sender = String(message?.sender || message?.role || '').toLowerCase();
  return Boolean(message?.body) && message.id !== 'welcome' && sender !== 'visitor' && sender !== 'user';
}

function hasNewInboundMessage(previousMessages = [], nextMessages = []) {
  if (!previousMessages.length) return false;
  const previousKeys = new Set(previousMessages.map(messageKey));
  return nextMessages.some((message) => isInboundMessage(message) && !previousKeys.has(messageKey(message)));
}

function getStoredValue(key) {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(`${STORAGE_PREFIX}.${key}`) || '';
}

function setStoredValue(key, value) {
  if (typeof window === 'undefined') return;
  if (!value) {
    window.localStorage.removeItem(`${STORAGE_PREFIX}.${key}`);
    return;
  }
  window.localStorage.setItem(`${STORAGE_PREFIX}.${key}`, value);
}

function clearStoredChat() {
  if (typeof window === 'undefined') return;
  ['sessionId', 'lastActivityAt'].forEach((key) => {
    window.localStorage.removeItem(`${STORAGE_PREFIX}.${key}`);
  });
}

function getVisitorId() {
  const existing = getStoredValue('visitorId');
  if (existing) return existing;
  const next = `home_advisor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  setStoredValue('visitorId', next);
  return next;
}

function unlockChatSound() {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  chatAudioContext = chatAudioContext || new AudioContextClass();
  if (chatAudioContext.state === 'suspended') {
    chatAudioContext.resume().catch(() => {});
  }
}

function playChatSound() {
  try {
    unlockChatSound();
    if (!chatAudioContext) return;
    const oscillator = chatAudioContext.createOscillator();
    const gain = chatAudioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(784, chatAudioContext.currentTime);
    oscillator.frequency.setValueAtTime(1046, chatAudioContext.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, chatAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, chatAudioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, chatAudioContext.currentTime + 0.28);
    oscillator.connect(gain);
    gain.connect(chatAudioContext.destination);
    oscillator.start();
    oscillator.stop(chatAudioContext.currentTime + 0.3);
  } catch (_) {
  }
}

function normalizeMessages(messages = []) {
  const seen = new Set();
  return [INITIAL_MESSAGE, ...messages]
    .map((message) => {
      const sender = message.sender || (message.role === 'assistant' ? 'ai' : message.role) || 'system';
      const body = message.body || message.text || '';
      return {
        ...message,
        sender,
        body,
        role: sender === 'ai' ? 'assistant' : sender,
        text: body,
      };
    })
    .filter((message) => {
      const key = message.id || `${message.sender}:${message.body}:${message.createdAt || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      if (!message.body || message.body === 'undefined') return false;
      return message.body.trim().toLowerCase() !== 'i would like to talk to a person.';
    });
}

function isValidLeadName(value) {
  return value.trim().length >= 3;
}

function isValidLeadEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function renderMessageBody(body) {
  const text = String(body || '');
  const parts = text.split(/(https?:\/\/[^\s]+|\/(?:dashboard|auth|sell|agents|providers)\/?[^\s]*)/g);
  return parts.map((part, index) => {
    if (/^(https?:\/\/|\/)/.test(part)) {
      return (
        <a key={`${part}-${index}`} href={part} target={part.startsWith('http') ? '_blank' : undefined} rel={part.startsWith('http') ? 'noreferrer' : undefined}>
          {part}
        </a>
      );
    }
    return <span key={`${index}-${part.slice(0, 8)}`}>{part}</span>;
  });
}

function ChatIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z" />
    </svg>
  );
}

function SendIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function UserIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21a7 7 0 0 0-14 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CloseIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SpinnerIcon({ size = 18 }) {
  return (
    <svg className="website-chat-spin" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </svg>
  );
}

export default function WebsiteChatWidget({
  product = 'home_advisor',
  tenantId = 'home-advisor-platform',
  tenantType = 'platform',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => getStoredValue('sessionId'));
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState('');
  const [leadTouched, setLeadTouched] = useState({ name: false, email: false });
  const [humanRequested, setHumanRequested] = useState(false);
  const [teamNotice, setTeamNotice] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(60);
  const [confirmEndChat, setConfirmEndChat] = useState(false);
  const [emailTranscriptOnEnd, setEmailTranscriptOnEnd] = useState(true);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [lastActivityAt, setLastActivityAt] = useState(() => Number(getStoredValue('lastActivityAt')) || Date.now());
  const [storedSession, setStoredSession] = useState(null);
  const visitorId = useMemo(getVisitorId, []);
  const threadRef = useRef(null);
  const messagesRef = useRef(messages);
  const lastActivityRef = useRef(lastActivityAt);

  const loggedInName = (storedSession?.user?.name || storedSession?.user?.email?.split('@')[0] || storedSession?.user?.email || '').trim();
  const loggedInEmail = (storedSession?.user?.email || '').trim();
  const isLoggedIn = Boolean(storedSession?.token && storedSession?.user);
  const effectiveLeadName = isLoggedIn ? loggedInName : leadName.trim();
  const effectiveLeadEmail = isLoggedIn ? loggedInEmail : leadEmail.trim();
  const leadNameReady = isValidLeadName(effectiveLeadName);
  const leadEmailReady = isValidLeadEmail(effectiveLeadEmail);
  const leadCaptured = leadNameReady && leadEmailReady;
  const shouldShowLead = !isLoggedIn && !leadCaptured;
  const showLeadSummary = leadCaptured && Boolean(effectiveLeadName || effectiveLeadEmail);
  const leadNameError = shouldShowLead && leadTouched.name && !leadNameReady ? 'Name must be at least 3 characters.' : '';
  const leadEmailError = shouldShowLead && leadTouched.email && !leadEmailReady ? 'Enter a valid email address.' : '';
  const talkToPersonDisabled = isSending || humanRequested || (!isLoggedIn && !leadCaptured);

  function markConversationEnded(nextMessages = messagesRef.current) {
    setMessages(nextMessages?.length ? nextMessages : messagesRef.current);
    setConversationEnded(true);
    setHumanRequested(false);
    setTeamNotice(false);
    setConfirmEndChat(false);
    setError('');
    setSessionId('');
    setStoredValue('sessionId', '');
  }

  useEffect(() => {
    setStoredSession(getStoredSession());
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLeadName(loggedInName);
    setLeadEmail(loggedInEmail);
    setLeadTouched({ name: false, email: false });
  }, [isLoggedIn, loggedInName, loggedInEmail]);

  useEffect(() => {
    messagesRef.current = messages;
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, isOpen]);

  useEffect(() => {
    if (!sessionId || !isOpen) return undefined;

    let cancelled = false;
    async function pollMessages() {
      setIsPolling(true);
      try {
        const result = await listPublicChatMessages(sessionId);
        if (!cancelled) {
          const nextMessages = normalizeMessages(result.messages || []);
          if (hasNewInboundMessage(messagesRef.current, nextMessages)) playChatSound();
          setMessages(nextMessages);
          if (isPublicChatClosedPayload(result)) {
            markConversationEnded(nextMessages);
            return;
          }
          setError('');
        }
      } catch (pollError) {
        if (!cancelled) {
          if (isPublicChatClosedError(pollError)) {
            markConversationEnded();
            return;
          }
          setError(publicChatErrorMessage(pollError));
        }
      } finally {
        if (!cancelled) setIsPolling(false);
      }
    }

    pollMessages();
    const timer = window.setInterval(pollMessages, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sessionId, isOpen]);

  function recordActivity() {
    const next = Date.now();
    lastActivityRef.current = next;
    setStoredValue('lastActivityAt', String(next));
    setLastActivityAt(next);
    setIdleWarning(false);
    setIdleCountdown(60);
  }

  function resetConversation() {
    clearStoredChat();
    setSessionId('');
    setMessages([INITIAL_MESSAGE]);
    setDraft('');
    setLeadName(isLoggedIn ? loggedInName : '');
    setLeadEmail(isLoggedIn ? loggedInEmail : '');
    setLeadTouched({ name: false, email: false });
    setHumanRequested(false);
    setTeamNotice(false);
    setIdleWarning(false);
    setIdleCountdown(60);
    setConfirmEndChat(false);
    setEmailTranscriptOnEnd(true);
    setConversationEnded(false);
    setError('');
    recordActivity();
  }

  async function endConversation(reason = 'visitor_inactivity_timeout', { emailTranscript = false } = {}) {
    const activeSessionId = sessionId;
    if (!activeSessionId) return;

    setIsSending(true);
    setError('');
    try {
      if (emailTranscript) {
        if (!leadEmailReady) {
          setError('Enter a valid email address before requesting a transcript.');
          return;
        }
        await sendPublicChatTranscript(activeSessionId, {
          visitorId,
          email: effectiveLeadEmail,
          leadName: effectiveLeadName,
          leadEmail: effectiveLeadEmail,
          subject: 'Your Workside Home Advisor chat transcript',
          includeCustomerMessages: true,
          includeHumanMessages: true,
          includeAiMessages: false,
          includeSystemMessages: false,
        });
      }
      await timeoutPublicChatSession(activeSessionId, {
        visitorId,
        reason,
        emailTranscript,
        transcriptEmail: emailTranscript ? effectiveLeadEmail : undefined,
      });
      resetConversation();
    } catch (endError) {
      setError(publicChatErrorMessage(endError));
    } finally {
      setIsSending(false);
    }
  }

  async function endConversationFromIdle(reason = 'visitor_inactivity_timeout') {
    const activeSessionId = sessionId;
    resetConversation();
    if (!activeSessionId) return;
    try {
      await timeoutPublicChatSession(activeSessionId, { visitorId, reason });
    } catch (_) {
    }
  }

  useEffect(() => {
    if (!teamNotice) return undefined;
    const timer = window.setTimeout(() => setTeamNotice(false), 4500);
    return () => window.clearTimeout(timer);
  }, [teamNotice]);

  useEffect(() => {
    if (!idleWarning) return undefined;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((IDLE_TERMINATE_MS - (Date.now() - startedAt)) / 1000));
      setIdleCountdown(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        endConversationFromIdle('visitor_inactivity_timeout');
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [idleWarning]);

  useEffect(() => {
    lastActivityRef.current = lastActivityAt;
  }, [lastActivityAt]);

  useEffect(() => {
    if (!isOpen || !sessionId) return undefined;

    const checkIdle = () => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_WARNING_MS + IDLE_TERMINATE_MS) {
        endConversationFromIdle('visitor_inactivity_timeout');
        return;
      }
      if (idleFor >= IDLE_WARNING_MS) {
        setIdleWarning(true);
        setIdleCountdown(Math.max(0, Math.ceil((IDLE_WARNING_MS + IDLE_TERMINATE_MS - idleFor) / 1000)));
      }
    };

    checkIdle();
    const interval = window.setInterval(checkIdle, IDLE_CHECK_MS);
    window.addEventListener('focus', checkIdle);
    document.addEventListener('visibilitychange', checkIdle);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkIdle);
      document.removeEventListener('visibilitychange', checkIdle);
    };
  }, [isOpen, sessionId]);

  async function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending || conversationEnded) return;
    recordActivity();
    unlockChatSound();

    setIsSending(true);
    setError('');
    setDraft('');
    const optimistic = {
      id: `local_${Date.now()}`,
      sender: 'visitor',
      body: text,
      pending: true,
    };
    setMessages((current) => normalizeMessages([...current.filter((item) => item.id !== 'welcome'), optimistic]));

    try {
      const basePayload = {
        product,
        tenantId,
        tenantType,
        source: 'website_chat',
        sourceUrl: window.location.href,
        visitorId,
        leadName: effectiveLeadName,
        leadEmail: effectiveLeadEmail,
        authenticated: isLoggedIn,
        appBaseUrl: window.location.origin,
      };

      const result = sessionId
        ? await sendPublicChatMessage(sessionId, { ...basePayload, message: text })
        : await createPublicChatSession({
            ...basePayload,
            initialIntent: 'general',
            initialMessage: text,
          });

      if (result.session?.id && !sessionId) {
        setSessionId(result.session.id);
        setStoredValue('sessionId', result.session.id);
      }
      if (result.session?.leadName) setLeadName(result.session.leadName);
      if (result.session?.leadEmail) setLeadEmail(result.session.leadEmail);
      setMessages((current) => normalizeMessages([...current.filter((item) => !item.pending), ...(result.messages || [])]));
    } catch (sendError) {
      setError(publicChatErrorMessage(sendError));
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(text);
    } finally {
      setIsSending(false);
    }
  }

  async function handleHumanRequest() {
    if (humanRequested || isSending || conversationEnded) return;
    recordActivity();
    unlockChatSound();
    if (!isLoggedIn && !leadCaptured) {
      setLeadTouched({ name: true, email: true });
      setError('Please enter your name and a valid email before we notify the team.');
      return;
    }

    setError('');
    setIsSending(true);
    try {
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        const result = await createPublicChatSession({
          product,
          tenantId,
          tenantType,
          source: 'website_chat',
          sourceUrl: window.location.href,
          visitorId,
          initialIntent: 'support',
          initialMessage: 'I would like to talk to a person.',
          leadName: effectiveLeadName,
          leadEmail: effectiveLeadEmail,
          authenticated: isLoggedIn,
          appBaseUrl: window.location.origin,
        });
        activeSessionId = result.session?.id;
        setSessionId(activeSessionId);
        setStoredValue('sessionId', activeSessionId);
        setMessages(normalizeMessages(result.messages || []));
      }

      const requested = await requestPublicChatHuman(activeSessionId, {
        visitorId,
        leadName: effectiveLeadName,
        leadEmail: effectiveLeadEmail,
        authenticated: isLoggedIn,
        appBaseUrl: window.location.origin,
      });
      setHumanRequested(true);
      setTeamNotice(true);
      setMessages((current) => normalizeMessages([...current.filter((item) => item.id !== 'welcome'), requested.message].filter(Boolean)));
    } catch (requestError) {
      setError(publicChatErrorMessage(requestError));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="website-chat-widget" aria-live="polite">
      {isOpen ? (
        <section className="website-chat-panel" aria-label="Workside Home Advisor chat" onClick={(event) => event.stopPropagation()}>
          <header className="website-chat-header">
            <div>
              <div className="website-chat-title">Workside Home Advisor</div>
              <div className="website-chat-subtitle">{isPolling ? 'Checking for replies' : 'Sales and support'}</div>
              {showLeadSummary ? (
                <div className="website-chat-identity">
                  <span>{effectiveLeadName}</span>
                  <small>{effectiveLeadEmail}</small>
                </div>
              ) : null}
            </div>
            <div className="website-chat-header-actions">
              {sessionId && !conversationEnded ? (
                <button
                  type="button"
                  className="website-chat-end-header"
                  onClick={() => {
                    recordActivity();
                    setEmailTranscriptOnEnd(Boolean(leadEmailReady));
                    setConfirmEndChat(true);
                  }}
                  disabled={isSending}
                >
                  End
                </button>
              ) : null}
              <button type="button" className="website-chat-icon-button" onClick={() => setIsOpen(false)} aria-label="Close chat">
                <CloseIcon />
              </button>
            </div>
          </header>

          <div className="website-chat-thread" ref={threadRef}>
            {messages.map((message) => (
              <div key={message.id || `${message.sender}-${message.body}`} className={`website-chat-message ${message.role || message.sender}`}>
                {message.sender === 'agent' ? <UserIcon size={14} /> : null}
                <span>{renderMessageBody(message.body)}</span>
              </div>
            ))}
          </div>

          {shouldShowLead ? (
            <div className="website-chat-lead">
              <label className="website-chat-field">
                <input
                  value={leadName}
                  onChange={(event) => {
                    recordActivity();
                    setConfirmEndChat(false);
                    setLeadName(event.target.value);
                    if (error) setError('');
                  }}
                  onBlur={() => setLeadTouched((current) => ({ ...current, name: true }))}
                  placeholder="Name"
                  aria-label="Name"
                  aria-invalid={Boolean(leadNameError)}
                />
                {leadNameError ? <span>{leadNameError}</span> : null}
              </label>
              <label className="website-chat-field">
                <input
                  value={leadEmail}
                  onChange={(event) => {
                    recordActivity();
                    setConfirmEndChat(false);
                    setLeadEmail(event.target.value);
                    if (error) setError('');
                  }}
                  onBlur={() => setLeadTouched((current) => ({ ...current, email: true }))}
                  placeholder="Email"
                  aria-label="Email"
                  aria-invalid={Boolean(leadEmailError)}
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                />
                {leadEmailError ? <span>{leadEmailError}</span> : null}
              </label>
            </div>
          ) : null}

          {error ? <div className="website-chat-error">{error}</div> : null}
          {conversationEnded ? <div className="website-chat-notice">This chat has ended.</div> : null}

          {idleWarning ? (
            <div className="website-chat-timeout">
              <div>
                <strong>Still there?</strong>
                <span>This chat will end in {idleCountdown}s.</span>
              </div>
              <button type="button" onClick={recordActivity}>Continue</button>
            </div>
          ) : null}

          {confirmEndChat ? (
            <div className="website-chat-confirm" role="dialog" aria-label="Confirm end chat">
              <div>
                <strong>End this chat?</strong>
                <span>You can receive a copy by email before the conversation closes.</span>
              </div>
              {leadEmailReady ? (
                <label className="website-chat-transcript-choice">
                  <input
                    type="checkbox"
                    checked={emailTranscriptOnEnd}
                    onChange={(event) => setEmailTranscriptOnEnd(event.target.checked)}
                    disabled={isSending}
                  />
                  <span>Email transcript to {effectiveLeadEmail}</span>
                </label>
              ) : (
                <p className="website-chat-confirm-note">Add a valid email if you want a transcript.</p>
              )}
              <div className="website-chat-confirm-actions">
                <button type="button" onClick={() => setConfirmEndChat(false)} disabled={isSending}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => endConversation('visitor_ended_chat', { emailTranscript: emailTranscriptOnEnd })}
                  disabled={isSending}
                >
                  End chat
                </button>
              </div>
            </div>
          ) : null}

          {teamNotice ? <div className="website-chat-notice"><UserIcon size={15} /> Team notified</div> : null}

          {!humanRequested && !conversationEnded ? (
            <div className="website-chat-actions">
              <button type="button" className="website-chat-human" onClick={handleHumanRequest} disabled={talkToPersonDisabled}>
                <UserIcon />
                <span>Talk to a person</span>
              </button>
            </div>
          ) : null}

          <form className="website-chat-composer" onSubmit={handleSend}>
            <input
              value={draft}
              onChange={(event) => {
                recordActivity();
                setConfirmEndChat(false);
                setDraft(event.target.value);
              }}
              placeholder={conversationEnded ? 'This chat has ended' : 'Type your message'}
              aria-label="Type your message"
              disabled={conversationEnded}
            />
            <button type="submit" disabled={conversationEnded || isSending || !draft.trim()} aria-label="Send message">
              {isSending ? <SpinnerIcon /> : <SendIcon />}
            </button>
          </form>
        </section>
      ) : (
        <button
          type="button"
          className="website-chat-launcher"
          onClick={() => {
            unlockChatSound();
            setIsOpen(true);
          }}
          aria-label="Open Workside Home Advisor chat"
          data-testid="chat-open-button"
        >
          <ChatIcon />
        </button>
      )}
    </div>
  );
}
