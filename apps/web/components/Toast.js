'use client';

import { useEffect } from 'react';

export function Toast({ tone = 'info', title, message, onClose, autoDismissMs }) {
  useEffect(() => {
    if (!message) {
      return undefined;
    }

    if (autoDismissMs === 0) {
      return undefined;
    }

    const dismissDelayMs =
      typeof autoDismissMs === 'number'
        ? autoDismissMs
        : tone === 'error'
        ? 0
        : tone === 'success'
        ? 6500
        : 5000;

    if (dismissDelayMs <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onClose?.();
    }, dismissDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [autoDismissMs, message, onClose, tone]);

  if (!message) {
    return null;
  }

  return (
    <div
      className={`toast toast-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <div className="toast-copy">
        {title ? <strong>{title}</strong> : null}
        <span>{message}</span>
      </div>
      <button type="button" className="toast-dismiss" onClick={onClose} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  );
}
