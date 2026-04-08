'use client';

import { PasswordInput } from '../PasswordInput';

export function EmailGateModal({
  open,
  email,
  firstName,
  setEmail,
  setFirstName,
  password,
  setPassword,
  loading,
  onClose,
  onSubmit,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="workspace-modal-card landing-email-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-email-gate-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="label">Email gate</span>
        <h2 id="landing-email-gate-title">Save your preview and continue into the full plan.</h2>
        <p>
          Enter your email to carry this property into the guided seller
          workspace. You will verify your account and unlock the full checklist,
          provider help, and export tools next.
        </p>

        <form className="landing-email-gate-form" onSubmit={onSubmit}>
          <label>
            First name
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Taylor"
              autoComplete="given-name"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label>
            Create password
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </label>

          <div className="workspace-modal-actions">
            <button type="button" className="button-secondary" onClick={onClose} disabled={loading}>
              Not yet
            </button>
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? 'Continuing...' : 'Continue to full plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
