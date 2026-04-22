import {
  getSocialPackVariantKey,
  getSocialPackVariantLabel,
} from './workspaceClientHelpers';
import { getPreferredVariantLabel } from './workspaceVisionHelpers';

export function WorkspaceBrochureTab({
  renderCollapsibleSection,
  defaultSectionState,
  latestFlyer,
  flyerType,
  setFlyerType,
  listingCandidateAssets,
  mediaAssets,
  latestPricing,
  flyerHeadlineDraft,
  setFlyerHeadlineDraft,
  flyerSubheadlineDraft,
  setFlyerSubheadlineDraft,
  flyerSummaryDraft,
  setFlyerSummaryDraft,
  flyerCallToActionDraft,
  setFlyerCallToActionDraft,
  flyerCopySuggestions,
  flyerCopySuggestionSource,
  isSuggestingFlyerCopy,
  handleSuggestFlyerCopy,
  handleUseFlyerCopySuggestion,
  brochurePhotoPool,
  flyerSelectedPhotoIds,
  toggleFlyerPhotoSelection,
  status,
  documentGenerationState,
  isArchivedProperty,
  handleGenerateFlyer,
  handleDownloadFlyerPdf,
  flyerPreviewRef,
  handleExportSocialPack,
  latestSocialPack,
  activeSocialPackVariantKey,
  setActiveSocialPackVariantKey,
  activeSocialPackVariantDetails,
}) {
  return (
    <div className="workspace-tab-stack">
      {renderCollapsibleSection({
        sectionKey: 'brochure_controls',
        label: 'Flyer',
        title: 'Flyer controls',
        meta: latestFlyer ? 'Draft ready' : 'No draft yet',
        defaultOpen: defaultSectionState.brochure_controls,
        className: 'content-card flyer-generator-card',
        children: (
          <div className="workspace-tab-stack">
            <p>
              Generate a flyer from live pricing, selected photos, and the strongest
              seller-ready language.
            </p>
            <div className="mode-switch">
              <button
                type="button"
                className={flyerType === 'sale' ? 'mode-chip active' : 'mode-chip'}
                onClick={() => setFlyerType('sale')}
              >
                Sale flyer
              </button>
              <button
                type="button"
                className={flyerType === 'rental' ? 'mode-chip active' : 'mode-chip'}
                onClick={() => setFlyerType('rental')}
              >
                Rental flyer
              </button>
            </div>
            <div className="mini-stats">
              <div className="stat-card">
                <strong>Listing picks</strong>
                <span>{listingCandidateAssets.length} chosen</span>
              </div>
              <div className="stat-card">
                <strong>Vision-ready</strong>
                <span>{mediaAssets.filter((asset) => asset.selectedVariant).length} preferred variants</span>
              </div>
              <div className="stat-card">
                <strong>Price source</strong>
                <span>{latestPricing ? 'Live pricing attached' : 'Using latest saved pricing'}</span>
              </div>
            </div>
            <div className="workspace-inner-card brochure-control-card">
              <span className="label">Headline + copy plan</span>
              <div className="brochure-control-grid brochure-control-grid-form">
                <label className="workspace-control-field">
                  <span>Headline</span>
                  <input
                    type="text"
                    value={flyerHeadlineDraft}
                    onChange={(event) => setFlyerHeadlineDraft(event.target.value)}
                    placeholder="Seller-ready headline"
                    maxLength={140}
                  />
                </label>
                <label className="workspace-control-field">
                  <span>Subheadline</span>
                  <input
                    type="text"
                    value={flyerSubheadlineDraft}
                    onChange={(event) => setFlyerSubheadlineDraft(event.target.value)}
                    placeholder="Short positioning line"
                    maxLength={220}
                  />
                </label>
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Summary</span>
                  <textarea
                    value={flyerSummaryDraft}
                    onChange={(event) => setFlyerSummaryDraft(event.target.value)}
                    placeholder="How should this flyer frame the property?"
                    maxLength={600}
                  />
                </label>
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Call to action</span>
                  <input
                    type="text"
                    value={flyerCallToActionDraft}
                    onChange={(event) => setFlyerCallToActionDraft(event.target.value)}
                    placeholder="What should the seller or buyer do next?"
                    maxLength={180}
                  />
                </label>
              </div>
              <div className="workspace-action-column">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleSuggestFlyerCopy}
                  disabled={Boolean(status) || isArchivedProperty || isSuggestingFlyerCopy}
                >
                  {isSuggestingFlyerCopy ? 'Generating copy ideas...' : 'Suggest subheadline + summary'}
                </button>
              </div>
              {flyerCopySuggestions?.length ? (
                <div className="brochure-preview-sections">
                  {flyerCopySuggestions.map((suggestion, index) => (
                    <div
                      key={suggestion.id || `flyer-copy-suggestion-${index + 1}`}
                      className="brochure-preview-card"
                    >
                      <span className="label">Idea {index + 1}</span>
                      <strong>{suggestion.subheadline}</strong>
                      <p>{suggestion.summary}</p>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleUseFlyerCopySuggestion(suggestion)}
                        disabled={Boolean(status) || isArchivedProperty}
                      >
                        Use this idea
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {flyerCopySuggestionSource ? (
                <p className="workspace-control-note">
                  {flyerCopySuggestionSource === 'openai'
                    ? 'Ideas generated by AI from the current property context.'
                    : 'Showing starter fallback ideas from local templates.'}
                </p>
              ) : null}
            </div>
            <div className="workspace-inner-card brochure-control-card">
              <span className="label">Image selection</span>
              {brochurePhotoPool.length ? (
                <div className="brochure-photo-plan">
                  {brochurePhotoPool.slice(0, 6).map((asset) => (
                    <button
                      key={`brochure-photo-${asset.id}`}
                      type="button"
                      className={
                        flyerSelectedPhotoIds.includes(asset.id)
                          ? 'brochure-photo-plan-card active'
                          : 'brochure-photo-plan-card'
                      }
                      onClick={() => toggleFlyerPhotoSelection(asset.id)}
                    >
                      <img src={asset.imageUrl} alt={asset.roomLabel || 'Flyer candidate'} />
                      <div>
                        <strong>{asset.roomLabel}</strong>
                        <span>
                          {asset.listingNote ||
                            (asset.selectedVariant
                              ? `${asset.selectedVariant.label || 'Vision-ready'} selected`
                              : 'Available for flyer use')}
                        </span>
                        <em>
                          {flyerSelectedPhotoIds.includes(asset.id)
                            ? 'Included in flyer'
                            : 'Click to include'}
                        </em>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p>No photos are available yet. Add them in mobile, then return here to shape the flyer.</p>
              )}
              <p className="workspace-control-note">
                Up to 4 photos are used. Seller picks stay prioritized, and preferred vision variants
                still flow through automatically.
              </p>
            </div>
            <div className="button-stack flyer-generator-actions">
              <button
                type="button"
                className={status.includes('Generating') ? 'button-primary button-busy' : 'button-primary'}
                onClick={handleGenerateFlyer}
                disabled={Boolean(status) || isArchivedProperty}
              >
                {status.includes('Generating') ? 'Generating flyer...' : 'Generate flyer'}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={handleDownloadFlyerPdf}
                disabled={Boolean(status)}
              >
                Download latest flyer PDF
              </button>
            </div>
            <p className="workspace-control-note">
              Generate flyer creates a new saved flyer version. Download latest flyer PDF exports the
              most recent saved flyer for this property.
            </p>
            {documentGenerationState?.kind === 'flyer' ? (
              <p className="workspace-control-note">
                <strong>Flyer generation in progress:</strong>{' '}
                {documentGenerationState.phase || 'Working on your flyer...'}{' '}
                {Number.isFinite(documentGenerationState.elapsedSeconds)
                  ? `(${documentGenerationState.elapsedSeconds}s elapsed)`
                  : ''}
                {Number.isFinite(documentGenerationState.progressPercent) &&
                documentGenerationState.progressPercent > 0
                  ? ` • ${Math.round(documentGenerationState.progressPercent)}%`
                  : ''}
              </p>
            ) : null}
          </div>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'brochure_preview',
        label: 'Flyer',
        title: 'Live preview',
        meta: latestFlyer ? latestFlyer.flyerType : 'No preview',
        defaultOpen: defaultSectionState.brochure_preview,
        className: 'content-card',
        children: latestFlyer ? (
          <div ref={flyerPreviewRef} className="flyer-preview">
            <div className="flyer-hero">
              <span className="label">{latestFlyer.flyerType} flyer</span>
              <h2>{latestFlyer.headline}</h2>
              <p>{latestFlyer.subheadline}</p>
              <div className="mini-stats">
                <div className="stat-card">
                  <strong>Price</strong>
                  <span>{latestFlyer.priceText}</span>
                </div>
                <div className="stat-card">
                  <strong>Location</strong>
                  <span>{latestFlyer.locationLine}</span>
                </div>
              </div>
            </div>
            <div className="report-preview-section">
              <strong>Builder selections</strong>
              <div className="tag-row">
                <span>
                  {latestFlyer.customizations?.selectedPhotoAssetIds?.length ||
                    latestFlyer.selectedPhotos?.length ||
                    0}{' '}
                  selected photos
                </span>
                <span>{latestFlyer.customizations?.headline ? 'Custom headline' : 'AI headline'}</span>
                <span>{latestFlyer.customizations?.summary ? 'Custom summary' : 'AI summary'}</span>
              </div>
            </div>
            {latestFlyer.selectedPhotos?.length ? (
              <div className="flyer-photo-grid">
                {latestFlyer.selectedPhotos.slice(0, 4).map((photo) => (
                  <div key={photo.assetId || photo.imageUrl} className="flyer-photo-card">
                    {photo.imageUrl ? <img src={photo.imageUrl} alt={photo.roomLabel || 'Property photo'} /> : null}
                    <span>{photo.roomLabel || 'Selected photo'}</span>
                    <div className="flyer-photo-badges">
                      {photo.listingCandidate ? <strong className="flyer-photo-badge">Seller selected</strong> : null}
                      {photo.usesPreferredVariant ? (
                        <strong className="flyer-photo-badge flyer-photo-badge-vision">
                          {getPreferredVariantLabel(photo)}
                        </strong>
                      ) : null}
                    </div>
                    {photo.listingNote ? <em className="flyer-photo-note">{photo.listingNote}</em> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p>{latestFlyer.summary}</p>
            <ul className="plain-list">
              {(latestFlyer.highlights || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              <strong>CTA:</strong> {latestFlyer.callToAction}
            </p>
            <div className="brochure-preview-sections">
              <div className="brochure-preview-card">
                <span className="label">Headline</span>
                <strong>{latestFlyer.headline}</strong>
                <p>{latestFlyer.subheadline}</p>
              </div>
              <div className="brochure-preview-card">
                <span className="label">Highlights</span>
                <ul className="plain-list">
                  {(latestFlyer.highlights || []).slice(0, 4).map((item) => (
                    <li key={`highlight-${item}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <p>No flyer draft yet. Generate one to preview flyer output.</p>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'brochure_social',
        label: 'Flyer',
        title: 'Social ad pack',
        meta: latestSocialPack ? 'Available' : 'Not generated',
        defaultOpen: defaultSectionState.brochure_social,
        className: 'content-card',
        children: (
          <div className="workspace-tab-stack">
            <div className="workspace-action-column">
              <button
                type="button"
                className="button-secondary"
                onClick={handleExportSocialPack}
                disabled={Boolean(status) || isArchivedProperty}
              >
                Export social ad pack
              </button>
            </div>
            {latestSocialPack ? (
              <div className="workspace-tab-stack">
                <p className="workspace-control-note">
                  Select a format chip to inspect the copy, CTA, and guidance for that specific social placement.
                </p>
                <div className="tag-row">
                  {(latestSocialPack.variants || []).map((variant, index) => {
                    const variantKey = getSocialPackVariantKey(variant, index);
                    const isActive = variantKey === activeSocialPackVariantKey;
                    return (
                      <button
                        key={variantKey}
                        type="button"
                        className={isActive ? 'social-pack-chip active' : 'social-pack-chip'}
                        onClick={() => setActiveSocialPackVariantKey(variantKey)}
                      >
                        {getSocialPackVariantLabel(variant)}
                      </button>
                    );
                  })}
                </div>
                {activeSocialPackVariantDetails ? (
                  <div className="social-pack-detail-card">
                    <div className="workspace-tab-stack">
                      <div>
                        <span className="label">Selected format</span>
                        <h3>{activeSocialPackVariantDetails.title}</h3>
                      </div>
                      <p>{activeSocialPackVariantDetails.summary}</p>
                      {activeSocialPackVariantDetails.highlights.length ? (
                        <div className="tag-row">
                          {activeSocialPackVariantDetails.highlights.map((item) => (
                            <span key={`social-pack-highlight-${item}`}>{item}</span>
                          ))}
                        </div>
                      ) : null}
                      <p className="workspace-control-note">
                        <strong>Guidance:</strong> {activeSocialPackVariantDetails.guidance}
                      </p>
                      <div className="social-pack-detail-grid">
                        {activeSocialPackVariantDetails.sections.map((section) => (
                          <div
                            key={`${activeSocialPackVariantDetails.title}-${section.label}`}
                            className="social-pack-detail-block"
                          >
                            <strong>{section.label}</strong>
                            <span>{section.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                <p><strong>Headline:</strong> {latestSocialPack.headline}</p>
                <p><strong>Primary text:</strong> {latestSocialPack.primaryText}</p>
                <p><strong>Short caption:</strong> {latestSocialPack.shortCaption}</p>
                <p><strong>CTA:</strong> {latestSocialPack.cta}</p>
                {(latestSocialPack.disclaimers || []).length ? (
                  <ul className="plain-list">
                    {(latestSocialPack.disclaimers || []).map((item) => (
                      <li key={`social-disclaimer-${item}`}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                <pre className="workspace-control-note" style={{ whiteSpace: 'pre-wrap' }}>
                  {latestSocialPack.markdown}
                </pre>
              </div>
            ) : (
              <p className="workspace-control-note">
                Generate a social pack to get square/story guidance plus ad-ready headline, caption,
                CTA, and markdown copy.
              </p>
            )}
          </div>
        ),
      })}
    </div>
  );
}
