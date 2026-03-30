'use client';

import { useEffect, useState } from 'react';

const FALLBACK_CATEGORY_OPTIONS = [
  { value: 'inspector', label: 'Home Inspectors' },
  { value: 'title_company', label: 'Title Companies' },
  { value: 'real_estate_attorney', label: 'Real Estate Attorneys' },
  { value: 'photographer', label: 'Photographers' },
  { value: 'cleaning_service', label: 'Cleaning Services' },
  { value: 'termite_inspection', label: 'Termite Inspectors' },
  { value: 'notary', label: 'Notaries' },
  { value: 'nhd_report', label: 'NHD Report Providers' },
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
  turnaroundLabel: '24-48 hours',
  pricingSummary: '',
  serviceHighlights: 'Licensed, Local specialist',
  approvalStatus: 'approved',
  licenseStatus: 'verified',
  insuranceStatus: 'verified',
  planCode: 'provider_standard',
};

export function CreateProviderCard({ categories = [], onCreated }) {
  const categoryOptions =
    categories.length
      ? categories.filter((category) => category.isActive !== false).map((category) => ({
          value: category.key,
          label: category.label,
        }))
      : FALLBACK_CATEGORY_OPTIONS;
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!categoryOptions.length) {
      return;
    }

    if (categoryOptions.some((option) => option.value === form.categoryKey)) {
      return;
    }

    setForm((current) => ({
      ...current,
      categoryKey: categoryOptions[0]?.value || current.categoryKey,
    }));
  }, [categoryOptions, form.categoryKey]);

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
          serviceHighlights: form.serviceHighlights
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Provider creation failed.');
      }

      setStatus('Provider created. Refreshing snapshot...');
      if (onCreated) {
        await onCreated();
      } else {
        window.location.reload();
      }
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
            {categoryOptions.map((option) => (
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
        <label>
          Turnaround
          <input
            value={form.turnaroundLabel}
            onChange={(event) => setForm((current) => ({ ...current, turnaroundLabel: event.target.value }))}
            maxLength={80}
          />
        </label>
        <label>
          Pricing summary
          <input
            value={form.pricingSummary}
            onChange={(event) => setForm((current) => ({ ...current, pricingSummary: event.target.value }))}
            maxLength={140}
          />
        </label>
        <label>
          Approval status
          <select
            value={form.approvalStatus}
            onChange={(event) => setForm((current) => ({ ...current, approvalStatus: event.target.value }))}
          >
            <option value="approved">Approved</option>
            <option value="review">Review</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label>
          License
          <select
            value={form.licenseStatus}
            onChange={(event) => setForm((current) => ({ ...current, licenseStatus: event.target.value }))}
          >
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="not_required">Not required</option>
          </select>
        </label>
        <label>
          Insurance
          <select
            value={form.insuranceStatus}
            onChange={(event) => setForm((current) => ({ ...current, insuranceStatus: event.target.value }))}
          >
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="not_required">Not required</option>
          </select>
        </label>
      </div>
      <label>
        Service highlights
        <input
          value={form.serviceHighlights}
          onChange={(event) => setForm((current) => ({ ...current, serviceHighlights: event.target.value }))}
          placeholder="Licensed, Luxury listings, Weekend availability"
        />
      </label>
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
