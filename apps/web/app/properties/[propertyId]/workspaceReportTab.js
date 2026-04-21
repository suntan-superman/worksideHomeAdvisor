import { formatCurrency } from '@workside/utils';

import { getPreferredVariantLabel } from './workspaceVisionHelpers';

export function WorkspaceReportTab({
  renderCollapsibleSection,
  defaultSectionState,
  latestReport,
  status,
  documentGenerationState,
  isArchivedProperty,
  handleGenerateReport,
  handleDownloadReportPdf,
  listingCandidateAssets,
  mediaAssets,
  checklist,
  selectedComps,
  reportTitleDraft,
  setReportTitleDraft,
  reportExecutiveSummaryDraft,
  setReportExecutiveSummaryDraft,
  reportListingDescriptionDraft,
  setReportListingDescriptionDraft,
  reportSectionOptions,
  reportIncludedSections,
  toggleReportSection,
  reportPhotoPool,
  reportSelectedPhotoIds,
  toggleReportPhotoSelection,
  reportPreviewRef,
  property,
}) {
  return (
    <div className="workspace-tab-stack">
      {renderCollapsibleSection({
        sectionKey: 'report_builder',
        label: 'Report',
        title: 'Report builder',
        meta: latestReport ? 'Draft ready' : 'No report yet',
        defaultOpen: defaultSectionState.report_builder,
        className: 'content-card report-generator-card',
        children: (
          <div className="workspace-tab-stack">
            <p>
              Make the report feel premium by combining pricing, comps, photos, checklist progress,
              and marketing guidance into one place.
            </p>
            <div className="workspace-action-column">
              <button
                type="button"
                className={status.includes('report') ? 'button-primary button-busy' : 'button-primary'}
                onClick={handleGenerateReport}
                disabled={Boolean(status) || isArchivedProperty}
              >
                {status.includes('report') ? 'Generating report...' : 'Generate report'}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={handleDownloadReportPdf}
                disabled={Boolean(status)}
              >
                Download report PDF
              </button>
            </div>
            {documentGenerationState?.kind === 'report' ? (
              <p className="workspace-control-note">
                <strong>Report generation in progress:</strong>{' '}
                {documentGenerationState.phase || 'Working on your seller report...'}{' '}
                {Number.isFinite(documentGenerationState.elapsedSeconds)
                  ? `(${documentGenerationState.elapsedSeconds}s elapsed)`
                  : ''}
                {Number.isFinite(documentGenerationState.progressPercent) &&
                documentGenerationState.progressPercent > 0
                  ? ` • ${Math.round(documentGenerationState.progressPercent)}%`
                  : ''}
              </p>
            ) : null}
            <div className="mini-stats">
              <div className="stat-card">
                <strong>Status</strong>
                <span>
                  {latestReport
                    ? latestReport.freshness?.isStale
                      ? 'Refresh recommended'
                      : 'Current report ready'
                    : 'No report generated yet'}
                </span>
              </div>
              <div className="stat-card">
                <strong>Photos</strong>
                <span>
                  {latestReport?.selectedPhotos?.length
                    ? `${latestReport.selectedPhotos.length} in latest report`
                    : `${listingCandidateAssets.length || mediaAssets.length} available`}
                </span>
              </div>
              <div className="stat-card">
                <strong>Checklist</strong>
                <span>{checklist?.summary?.completedCount ?? 0} complete</span>
              </div>
              <div className="stat-card">
                <strong>Comps</strong>
                <span>{selectedComps.length} included</span>
              </div>
            </div>
            <div className="workspace-inner-card report-outline-card">
              <span className="label">Title + summary</span>
              <div className="brochure-control-grid brochure-control-grid-form">
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Report title</span>
                  <input
                    type="text"
                    value={reportTitleDraft}
                    onChange={(event) => setReportTitleDraft(event.target.value)}
                    placeholder="Seller-facing report title"
                    maxLength={180}
                  />
                </label>
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Executive summary</span>
                  <textarea
                    value={reportExecutiveSummaryDraft}
                    onChange={(event) => setReportExecutiveSummaryDraft(event.target.value)}
                    placeholder="Lead with the main pricing, readiness, and launch story."
                    maxLength={1200}
                  />
                </label>
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Draft listing description</span>
                  <textarea
                    value={reportListingDescriptionDraft}
                    onChange={(event) => setReportListingDescriptionDraft(event.target.value)}
                    placeholder="Optional seller-facing listing-description draft."
                    maxLength={1200}
                  />
                </label>
              </div>
            </div>
            <div className="workspace-inner-card report-outline-card">
              <span className="label">Section toggles</span>
              <div className="report-outline-grid">
                {reportSectionOptions.map((section) => (
                  <button
                    key={`outline-${section.id}`}
                    type="button"
                    className={
                      reportIncludedSections.includes(section.id)
                        ? 'report-outline-item active'
                        : 'report-outline-item'
                    }
                    onClick={() => toggleReportSection(section.id)}
                  >
                    <strong>{section.label}</strong>
                    <span>
                      {reportIncludedSections.includes(section.id)
                        ? 'Included in the generated report'
                        : 'Click to include this section'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="workspace-inner-card brochure-control-card">
              <span className="label">Photo set</span>
              {reportPhotoPool.length ? (
                <div className="brochure-photo-plan">
                  {reportPhotoPool.slice(0, 6).map((asset) => (
                    <button
                      key={`report-photo-${asset.id}`}
                      type="button"
                      className={
                        reportSelectedPhotoIds.includes(asset.id)
                          ? 'brochure-photo-plan-card active'
                          : 'brochure-photo-plan-card'
                      }
                      onClick={() => toggleReportPhotoSelection(asset.id)}
                    >
                      <img src={asset.imageUrl} alt={asset.roomLabel || 'Report candidate'} />
                      <div>
                        <strong>{asset.roomLabel}</strong>
                        <span>
                          {asset.listingNote ||
                            (asset.selectedVariant
                              ? `${asset.selectedVariant.label || 'Vision-ready'} selected`
                              : 'Available for report use')}
                        </span>
                        <em>
                          {reportSelectedPhotoIds.includes(asset.id)
                            ? 'Included in report'
                            : 'Click to include'}
                        </em>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p>No photos are available yet for report review.</p>
              )}
            </div>
          </div>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'report_preview',
        label: 'Report',
        title: 'Live preview',
        meta: latestReport ? 'Report ready' : 'No preview',
        defaultOpen: defaultSectionState.report_preview,
        className: 'content-card',
        children: latestReport ? (
          <div ref={reportPreviewRef} className="report-preview">
            <div className="flyer-hero">
              <span className="label">{latestReport.reportType}</span>
              <h2>{latestReport.title}</h2>
              <p>{latestReport.executiveSummary}</p>
              <div className="tag-row">
                <span>{latestReport.freshness?.isStale ? 'Stale report' : 'Current report'}</span>
                <span>Version {latestReport.reportVersion || 1}</span>
                <span>{latestReport.payload?.readinessSummary?.label || 'Readiness summary pending'}</span>
              </div>
            </div>
            <div className="report-preview-section">
              <strong>Builder selections</strong>
              <div className="tag-row">
                {(latestReport.payload?.sectionOutline || []).map((item) => (
                  <span key={`section-${item}`}>{item}</span>
                ))}
                <span>{latestReport.selectedPhotos?.length || 0} selected photos</span>
              </div>
            </div>
            <div className="mini-stats">
              <div className="stat-card">
                <strong>Price band</strong>
                <span>
                  {latestReport.pricingSummary?.low
                    ? `${formatCurrency(latestReport.pricingSummary.low)} to ${formatCurrency(latestReport.pricingSummary.high)}`
                    : 'Pricing pending'}
                </span>
              </div>
              <div className="stat-card">
                <strong>Chosen list price</strong>
                <span>
                  {latestReport.pricingSummary?.selectedListPrice
                    ? formatCurrency(latestReport.pricingSummary.selectedListPrice)
                    : property?.selectedListPrice
                      ? formatCurrency(property.selectedListPrice)
                      : 'Not set yet'}
                </span>
              </div>
              <div className="stat-card">
                <strong>Readiness</strong>
                <span>
                  {latestReport.payload?.readinessSummary?.overallScore
                    ? `${latestReport.payload.readinessSummary.overallScore}/100`
                    : 'Not included'}
                </span>
              </div>
            </div>
            {latestReport.freshness?.isStale ? (
              <div className="report-preview-section">
                <strong>Refresh recommended</strong>
                <ul className="plain-list">
                  {(latestReport.freshness.staleReasons || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {latestReport.payload?.photoSummary ? (
              <div className="report-preview-section">
                <strong>Photo review summary</strong>
                <p>{latestReport.payload.photoSummary.summary || 'No photo-review summary is available yet.'}</p>
              </div>
            ) : null}
            {latestReport.selectedPhotos?.length ? (
              <div className="report-preview-section">
                <strong>Selected photo set</strong>
                <div className="flyer-photo-grid">
                  {latestReport.selectedPhotos.slice(0, 4).map((photo) => (
                    <div key={`report-preview-photo-${photo.assetId || photo.imageUrl}`} className="flyer-photo-card">
                      {photo.imageUrl ? <img src={photo.imageUrl} alt={photo.roomLabel || 'Report photo'} /> : null}
                      <span>{photo.roomLabel || 'Selected report photo'}</span>
                      <div className="flyer-photo-badges">
                        {photo.listingCandidate ? <strong className="flyer-photo-badge">Seller selected</strong> : null}
                        {photo.usesPreferredVariant ? (
                          <strong className="flyer-photo-badge flyer-photo-badge-vision">
                            {getPreferredVariantLabel(photo)}
                          </strong>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {(latestReport.payload?.visionStoryBlocks || []).length ? (
              <div className="report-preview-section">
                <strong>Visual improvement previews</strong>
                <div className="vision-story-grid">
                  {(latestReport.payload?.visionStoryBlocks || []).slice(0, 3).map((story) => (
                    <article key={`vision-story-${story.variantId || story.title}`} className="vision-story-card">
                      <div className="vision-story-images">
                        {story.originalImageUrl ? (
                          <div>
                            <span className="label">Before</span>
                            <img src={story.originalImageUrl} alt={`${story.title || 'Vision preview'} before`} />
                          </div>
                        ) : null}
                        {story.variantImageUrl ? (
                          <div>
                            <span className="label">After</span>
                            <img src={story.variantImageUrl} alt={story.title || 'Vision preview'} />
                          </div>
                        ) : null}
                      </div>
                      <div className="workspace-tab-stack">
                        <strong>{story.title}</strong>
                        <p><strong>What changed:</strong> {story.whatChanged}</p>
                        <p><strong>Why it matters:</strong> {story.whyItMatters}</p>
                        <p><strong>Suggested action:</strong> {story.suggestedAction}</p>
                        <p className="workspace-control-note">{story.disclaimer}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="report-preview-grid">
              {(latestReport.marketingHighlights || []).length ? (
                <div className="report-preview-section">
                  <strong>Marketing highlights</strong>
                  <div className="tag-row">
                    {(latestReport.marketingHighlights || []).slice(0, 6).map((item) => (
                      <span key={`marketing-${item}`}>{item}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {(latestReport.checklistItems || []).length ? (
                <div className="report-preview-section">
                  <strong>Top checklist items</strong>
                  <ul className="plain-list">
                    {(latestReport.checklistItems || []).slice(0, 4).map((item) => (
                      <li key={`task-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {(latestReport.improvementItems || []).length ? (
                <div className="report-preview-section">
                  <strong>Top improvements</strong>
                  <ul className="plain-list">
                    {(latestReport.improvementItems || []).slice(0, 4).map((item) => (
                      <li key={`improvement-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {latestReport.payload?.listingDescriptions?.shortDescription ||
              latestReport.payload?.marketingGuidance?.shortDescription ? (
                <div className="report-preview-section">
                  <strong>Draft listing description</strong>
                  <p>
                    {latestReport.payload?.listingDescriptions?.shortDescription ||
                      latestReport.payload?.marketingGuidance?.shortDescription}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p>No seller report has been generated yet. Create one to preview the premium report flow.</p>
        ),
      })}
    </div>
  );
}
