import { formatCurrency } from '@workside/utils';

export function WorkspaceOverviewTab({
  property,
  latestReport,
  latestPricing,
  dashboard,
  readinessScore,
  listingCandidateAssets,
  mediaAssets,
  checklist,
  recentOutputs,
  setActiveTab,
}) {
  return (
    <div className="workspace-tab-stack">
      <div className="content-card workspace-hero-card">
        <span className="label">Overview</span>
        <h2>Snapshot for this property</h2>
        <p>
          {latestReport?.executiveSummary ||
            latestPricing?.summary ||
            dashboard?.pricingSummary ||
            'Use the workspace tabs to move from pricing to photos, brochure, report, and checklist work.'}
        </p>
        <div className="mini-stats">
          <div className="stat-card">
            <strong>Price band</strong>
            <span>
              {latestPricing
                ? `${formatCurrency(latestPricing.recommendedListLow)} to ${formatCurrency(
                    latestPricing.recommendedListHigh,
                  )}`
                : 'Run pricing analysis'}
            </span>
          </div>
          <div className="stat-card">
            <strong>Chosen list price</strong>
            <span>
              {property?.selectedListPrice
                ? formatCurrency(property.selectedListPrice)
                : 'Not set yet'}
            </span>
          </div>
          <div className="stat-card">
            <strong>Confidence</strong>
            <span>
              {latestPricing?.confidenceScore
                ? `${Math.round(latestPricing.confidenceScore * 100)}%`
                : 'Pending'}
            </span>
          </div>
          <div className="stat-card">
            <strong>Readiness</strong>
            <span>{readinessScore}/100</span>
          </div>
        </div>
      </div>

      <div className="content-card">
        <span className="label">AI summary</span>
        <h2>What the workspace is signaling</h2>
        <p>
          {latestReport?.payload?.marketingGuidance?.shortDescription ||
            latestPricing?.pricingStrategy ||
            'The strongest next step is to turn pricing and photo selection into brochure and report output.'}
        </p>
        <ul className="plain-list">
          <li>{listingCandidateAssets.length} seller-selected photo pick(s)</li>
          <li>{mediaAssets.filter((asset) => asset.selectedVariant).length} preferred vision variant(s)</li>
          <li>{checklist?.summary?.completedCount ?? 0} checklist task(s) complete</li>
        </ul>
      </div>

      <div className="content-card">
        <span className="label">Recent outputs</span>
        <h2>Latest deliverables</h2>
        {recentOutputs.length ? (
          <div className="workspace-output-list">
            {recentOutputs.map((output) => (
              <button
                key={output.key}
                type="button"
                className="workspace-output-card"
                onClick={() => setActiveTab(output.tab)}
              >
                <span className="label">{output.label}</span>
                <strong>{output.title}</strong>
                <span>{output.detail}</span>
              </button>
            ))}
          </div>
        ) : (
          <p>No brochure or report output has been generated yet.</p>
        )}
      </div>
    </div>
  );
}
