'use client';

import { useEffect } from 'react';

export function Toast({ tone = 'info', title, message, onClose }) {
  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onClose?.();
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [message, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
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
