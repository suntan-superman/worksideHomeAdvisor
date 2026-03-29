'use client';

import { useState } from 'react';

const CATEGORY_OPTIONS = [
  { value: 'inspector', label: 'Home Inspectors' },
  { value: 'title_company', label: 'Title Companies' },
  { value: 'real_estate_attorney', label: 'Real Estate Attorneys' },
  { value: 'photographer', label: 'Photographers' },
  { value: 'cleaning_service', label: 'Cleaning Services' },
];

const INITIAL_FORM = {
  businessName: '',
  categoryKey: 'photographer',
  phone: '',
  email: '',
  city: '',
  state: '',
  zipCodes: '',
  radiusMiles: 25,
  description: '',
  websiteUrl: '',
  isVerified: true,
  isSponsored: false,
  qualityScore: 78,
  averageResponseMinutes: 90,
  planCode: 'provider_standard',
};

export function CreateProviderCard() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('Creating provider...');
    setError('');

    try {
      const response = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          zipCodes: form.zipCodes
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Provider creation failed.');
      }

      setStatus('Provider created. Refreshing...');
      window.location.reload();
    } catch (requestError) {
      setError(requestError.message);
      setStatus('');
    }
  }

  return (
    <form className="subpanel" onSubmit={handleSubmit}>
      <h2>Create provider</h2>
      <p className="muted">
        Use this to seed the marketplace manually before provider onboarding is live.
      </p>
      <div className="form-grid">
        <label>
          Business name
          <input
            value={form.businessName}
            onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
            maxLength={140}
            required
          />
        </label>
        <label>
          Category
          <select
            value={form.categoryKey}
            onChange={(event) => setForm((current) => ({ ...current, categoryKey: event.target.value }))}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Phone
          <input
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            maxLength={40}
            required
          />
        </label>
        <label>
          Email
          <input
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            maxLength={120}
            type="email"
          />
        </label>
        <label>
          City
          <input
            value={form.city}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            maxLength={80}
            required
          />
        </label>
        <label>
          State
          <input
            value={form.state}
            onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
            maxLength={40}
            required
          />
        </label>
        <label>
          ZIPs
          <input
            value={form.zipCodes}
            onChange={(event) => setForm((current) => ({ ...current, zipCodes: event.target.value }))}
            placeholder="93312, 93313"
          />
        </label>
        <label>
          Radius
          <input
            type="number"
            min="5"
            max="150"
            value={form.radiusMiles}
            onChange={(event) => setForm((current) => ({ ...current, radiusMiles: Number(event.target.value) }))}
          />
        </label>
      </div>
      <label>
        Description
        <textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          rows={3}
          maxLength={600}
        />
      </label>
      <div className="form-grid">
        <label>
          Website
          <input
            value={form.websiteUrl}
            onChange={(event) => setForm((current) => ({ ...current, websiteUrl: event.target.value }))}
            type="url"
            maxLength={180}
          />
        </label>
        <label>
          Plan code
          <input
            value={form.planCode}
            onChange={(event) => setForm((current) => ({ ...current, planCode: event.target.value }))}
            maxLength={60}
          />
        </label>
        <label>
          Quality score
          <input
            type="number"
            min="0"
            max="100"
            value={form.qualityScore}
            onChange={(event) => setForm((current) => ({ ...current, qualityScore: Number(event.target.value) }))}
          />
        </label>
        <label>
          Avg response minutes
          <input
            type="number"
            min="5"
            max={7 * 24 * 60}
            value={form.averageResponseMinutes}
            onChange={(event) =>
              setForm((current) => ({ ...current, averageResponseMinutes: Number(event.target.value) }))
            }
          />
        </label>
      </div>
      <div className="check-row">
        <label>
          <input
            type="checkbox"
            checked={form.isVerified}
            onChange={(event) => setForm((current) => ({ ...current, isVerified: event.target.checked }))}
          />
          Verified
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.isSponsored}
            onChange={(event) => setForm((current) => ({ ...current, isSponsored: event.target.checked }))}
          />
          Sponsored
        </label>
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      {status ? <div className="notice">{status}</div> : null}
      <button type="submit" className="button-primary">
        Create provider
      </button>
    </form>
  );
}
