'use client';

import { useEffect, useState } from 'react';

const INITIAL_FORM = {
  label: '',
  key: '',
  description: '',
  sortOrder: '',
  isActive: true,
};

function normalizeCategoryRows(categories = []) {
  return categories.map((category) => ({
    key: category.key,
    label: category.label || '',
    description: category.description || '',
    sortOrder: Number(category.sortOrder || 0),
    rolloutPhase: Number(category.rolloutPhase || 1),
    isActive: category.isActive !== false,
  }));
}

export function ProviderCategoryManager({ categories = [], onUpdated }) {
  const [createForm, setCreateForm] = useState(INITIAL_FORM);
  const [rows, setRows] = useState(normalizeCategoryRows(categories));
  const [busyKey, setBusyKey] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(normalizeCategoryRows(categories));
  }, [categories]);

  function updateRow(key, field, value) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  async function handleCreate(event) {
    event.preventDefault();
    setBusyKey('create');
    setStatus('Creating business type...');
    setError('');

    try {
      const response = await fetch('/api/admin/provider-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...createForm,
          sortOrder: createForm.sortOrder ? Number(createForm.sortOrder) : undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Provider category creation failed.');
      }

      setCreateForm(INITIAL_FORM);
      setStatus('Business type created. Refreshing categories...');
      if (onUpdated) {
        await onUpdated();
      }
    } catch (requestError) {
      setError(requestError.message);
      setStatus('');
    } finally {
      setBusyKey('');
    }
  }

  async function handleSaveRow(row) {
    setBusyKey(row.key);
    setStatus(`Saving ${row.label}...`);
    setError('');

    try {
      const response = await fetch(`/api/admin/provider-categories/${encodeURIComponent(row.key)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: row.label,
          description: row.description,
          sortOrder: Number(row.sortOrder || 0),
          rolloutPhase: Number(row.rolloutPhase || 1),
          isActive: Boolean(row.isActive),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Provider category update failed.');
      }

      setStatus(`${row.label} saved. Refreshing categories...`);
      if (onUpdated) {
        await onUpdated();
      }
    } catch (requestError) {
      setError(requestError.message);
      setStatus('');
    } finally {
      setBusyKey('');
    }
  }

  return (
    <div className="provider-category-stack">
      <form className="subpanel provider-category-form" onSubmit={handleCreate}>
        <h2>Add business type</h2>
        <p className="muted">
          Add new provider categories for the signup flow and admin provider tools.
        </p>
        <div className="form-grid">
          <label>
            Label
            <input
              value={createForm.label}
              onChange={(event) => setCreateForm((current) => ({ ...current, label: event.target.value }))}
              placeholder="Termite Inspection"
              maxLength={80}
              required
            />
          </label>
          <label>
            Optional key
            <input
              value={createForm.key}
              onChange={(event) => setCreateForm((current) => ({ ...current, key: event.target.value }))}
              placeholder="termite_inspection"
              maxLength={80}
            />
          </label>
          <label className="provider-category-description-field">
            Description
            <input
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Wood destroying organism and termite inspection services."
              maxLength={240}
            />
          </label>
          <label>
            Sort order
            <input
              type="number"
              min="0"
              max="9999"
              value={createForm.sortOrder}
              onChange={(event) => setCreateForm((current) => ({ ...current, sortOrder: event.target.value }))}
            />
          </label>
        </div>
        <div className="provider-category-toggle-row">
          <label className="provider-category-toggle">
            <input
              type="checkbox"
              checked={createForm.isActive}
              onChange={(event) => setCreateForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span>
              <strong>Show in provider signup</strong>
              <em>New providers will be able to pick this business type during onboarding.</em>
            </span>
          </label>
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        {status ? <div className="notice">{status}</div> : null}
        <button type="submit" className="admin-button" disabled={busyKey === 'create'}>
          {busyKey === 'create' ? 'Creating...' : 'Add business type'}
        </button>
      </form>

      <div className="provider-category-grid">
        {rows.map((row) => (
          <article key={row.key} className="lead-card provider-category-card">
            <div className="lead-card-header">
              <div>
                <div className="muted small-label">{row.key}</div>
                <h2>{row.label}</h2>
              </div>
              <span className={row.isActive ? 'status-badge status-success' : 'status-badge status-neutral'}>
                {row.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="form-grid provider-category-fields">
              <label>
                Label
                <input
                  value={row.label}
                  onChange={(event) => updateRow(row.key, 'label', event.target.value)}
                  maxLength={80}
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  min="0"
                  max="9999"
                  value={row.sortOrder}
                  onChange={(event) => updateRow(row.key, 'sortOrder', event.target.value)}
                />
              </label>
              <label className="provider-category-description-field">
                Description
                <input
                  value={row.description}
                  onChange={(event) => updateRow(row.key, 'description', event.target.value)}
                  maxLength={240}
                />
              </label>
              <label>
                Rollout phase
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={row.rolloutPhase}
                  onChange={(event) => updateRow(row.key, 'rolloutPhase', event.target.value)}
                />
              </label>
            </div>

            <div className="provider-category-toggle-row">
              <label className="provider-category-toggle">
                <input
                  type="checkbox"
                  checked={row.isActive}
                  onChange={(event) => updateRow(row.key, 'isActive', event.target.checked)}
                />
                <span>
                  <strong>Show in provider signup</strong>
                  <em>Hide this type from new providers without removing historical records.</em>
                </span>
              </label>
            </div>

            <div className="lead-action-row">
              <button
                type="button"
                className="admin-button"
                disabled={busyKey === row.key}
                onClick={() => handleSaveRow(row)}
              >
                {busyKey === row.key ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
