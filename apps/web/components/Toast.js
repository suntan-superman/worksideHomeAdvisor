'use client';

import { useEffect } from 'react';

export function Toast({
  tone = 'info',
  title,
  message,
  onClose,
  autoDismissMs,
  actionLabel,
  onAction,
}) {
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
        : tone === 'warning'
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
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      aria-live={tone === 'error' || tone === 'warning' ? 'assertive' : 'polite'}
    >
      <div className="toast-copy">
        {title ? <strong>{title}</strong> : null}
        <span>{message}</span>
        {actionLabel && onAction ? (
          <button type="button" className="toast-action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      <button type="button" className="toast-dismiss" onClick={onClose} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  );
}
