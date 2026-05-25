'use client';

export function trackMetaPixelEvent(eventName, payload = {}, options = {}) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    return false;
  }

  if (options.eventId) {
    window.fbq('track', eventName, payload, { eventID: options.eventId });
  } else {
    window.fbq('track', eventName, payload);
  }

  return true;
}

