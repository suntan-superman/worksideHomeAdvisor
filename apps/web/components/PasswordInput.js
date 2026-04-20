'use client';

import { useState } from 'react';

function EyeIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 12s3.6-6 9-6 9 6 9 6-3.6 6-9 6-9-6-9-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 12s3.6-6 9-6c2 0 3.8.8 5.2 1.9M21 12s-3.6 6-9 6c-2 0-3.8-.8-5.2-1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m4 4 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PasswordInput({
  value,
  onChange,
  placeholder = '',
  disabled = false,
  autoComplete,
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-shell">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        {...inputProps}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={disabled}
      >
        <EyeIcon visible={visible} />
      </button>
    </div>
  );
}
