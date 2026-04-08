function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function ResultPreviewCard({ preview, loading, onUnlock }) {
  const hasPreview = Boolean(preview);

  return (
    <section className="landing-slab landing-preview-card">
      <div className="landing-section-header">
        <span className="label">Preview result</span>
        <h2>See the first slice of value before signup.</h2>
        <p>
          Show enough momentum to matter, then gate the deeper plan where the
          real subscription value begins.
        </p>
      </div>

      <div className="landing-preview-grid">
        <article className={`landing-preview-metric ${!hasPreview ? 'is-placeholder' : ''}`}>
          <span className="label">Suggested range</span>
          <strong>
            {hasPreview
              ? `${formatCurrency(preview.estimatedRange.low)} to ${formatCurrency(preview.estimatedRange.high)}`
              : '$410k to $460k'}
          </strong>
          <p>Midpoint guidance is ready as soon as the preview finishes.</p>
        </article>

        <article className={`landing-preview-metric ${!hasPreview ? 'is-placeholder' : ''}`}>
          <span className="label">Market-ready score</span>
          <strong>{hasPreview ? `${preview.marketReadyScore}/100` : '42/100'}</strong>
          <p>Enough to show urgency, not enough to replace the full dashboard.</p>
        </article>

        <article className={`landing-preview-panel ${!hasPreview ? 'is-placeholder' : ''}`}>
          <span className="label">Checklist preview</span>
          <ul className="landing-bullet-list">
            {(hasPreview
              ? preview.previewChecklistItems
              : ['Declutter the main living areas', 'Improve curb appeal before photos']
            ).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="landing-preview-panel landing-preview-locked">
          <span className="label">Locked until signup</span>
          <div className="landing-lock-grid">
            <span>Full prep checklist</span>
            <span>Provider shortlist</span>
            <span>Saved workspace</span>
            <span>Report + flyer exports</span>
          </div>
          <button type="button" className="button-primary" onClick={onUnlock} disabled={loading}>
            {loading ? 'Building preview...' : 'Unlock full plan'}
          </button>
        </article>
      </div>
    </section>
  );
}
