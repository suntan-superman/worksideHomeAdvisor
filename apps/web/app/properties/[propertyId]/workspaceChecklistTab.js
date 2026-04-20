import {
  buildGoogleFallbackSummary,
  buildProviderSourceSummary,
  formatChecklistCategory,
  formatChecklistPriority,
  formatChecklistStatus,
  formatDateTimeLabel,
  formatProviderLeadStatusLabel,
  formatProviderReferenceAccessLabel,
  formatProviderStatusLabel,
} from './workspaceClientHelpers';

function ExternalProviderList({
  shouldShowExternalProviderSection,
  externalProviderRecommendations,
  handleSaveProviderReference,
  providerReferenceIds,
  providerReferences,
  status,
  isArchivedProperty,
  setActiveProviderDetails,
  providerSource,
}) {
  if (!shouldShowExternalProviderSection) {
    return null;
  }

  return (
    <div className="provider-card-list">
      <div className="section-header-tight">
        <div>
          <strong>External Google fallback results</strong>
          <p className="workspace-control-note">
            Broaden the search outside the Workside marketplace when you need extra local options or
            backup contacts.
          </p>
        </div>
      </div>
      {externalProviderRecommendations.map((provider) => (
        <article key={provider.id} className="provider-card provider-card-external">
          <div className="provider-card-header">
            <div>
              <strong>{provider.businessName}</strong>
              <span>{provider.description}</span>
            </div>
            <span className="checklist-chip checklist-chip-medium">Google result</span>
          </div>
          <div className="provider-quality-row">
            {provider.rating ? (
              <span>
                {provider.rating.toFixed(1)} stars
                {provider.reviewCount ? ` · ${provider.reviewCount} reviews` : ''}
              </span>
            ) : null}
            {provider.phone ? <span>{provider.phone}</span> : null}
            <span>External discovery</span>
          </div>
          <div className="provider-card-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => handleSaveProviderReference(provider, 'google_maps')}
              disabled={
                Boolean(status) ||
                isArchivedProperty ||
                providerReferenceIds.has(`google_maps:${provider.id}`) ||
                providerReferences.length >= 5
              }
            >
              {providerReferenceIds.has(`google_maps:${provider.id}`) ? 'On sheet' : 'Add to sheet'}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() =>
                setActiveProviderDetails({
                  ...provider,
                  categoryLabel: providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
                })
              }
            >
              Details
            </button>
            {provider.mapsUrl ? (
              <a href={provider.mapsUrl} target="_blank" rel="noreferrer" className="button-primary inline-button">
                Open in Maps
              </a>
            ) : null}
            {provider.websiteUrl ? (
              <a href={provider.websiteUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                Visit website
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function WorkspaceChecklistTab({
  renderCollapsibleSection,
  defaultSectionState,
  isWorkspaceSectionOpen,
  setWorkspaceSectionOpen,
  checklist,
  checklistGroups,
  checklistSummaryMode,
  setChecklistSummaryMode,
  completedChecklistItems,
  openChecklistItems,
  readinessScore,
  customChecklistTitle,
  setCustomChecklistTitle,
  customChecklistDetail,
  setCustomChecklistDetail,
  handleCreateChecklistTask,
  handleSetChecklistItemStatus,
  status,
  isArchivedProperty,
  focusProviderSuggestions,
  providerSuggestionsRef,
  providerSuggestionTask,
  providerSearchStatus,
  providerRecommendations,
  unavailableProviderRecommendations,
  providerSource,
  providerGoogleSearchUrl,
  providerMapProviders,
  setProviderMapScope,
  setShowProviderMap,
  handleBrowseGoogleFallback,
  externalProviderRecommendations,
  showExternalProviderFallback,
  providerCoverageGuidance,
  shouldShowExternalProviderSection,
  hasInternalProviderResults,
  handleSaveProvider,
  handleSaveProviderReference,
  handleRequestProviderLead,
  providerReferenceIds,
  providerReferences,
  setActiveProviderDetails,
  handleRemoveProviderReference,
  handleDownloadProviderReferenceSheet,
  providerLeads,
}) {
  return (
    <div className="workspace-tab-stack">
      {renderCollapsibleSection({
        sectionKey: 'checklist_tasks',
        label: 'Checklist',
        title: 'Listing-prep phases',
        meta: `${checklist?.summary?.progressPercent ?? 0}% ready`,
        defaultOpen: defaultSectionState.checklist_tasks,
        className: 'content-card checklist-card',
        children: checklistGroups.length ? (
          <div className="workspace-accordion-list">
            {checklistGroups.map(([groupName, items]) => {
              const groupSectionKey = `checklist_group_${groupName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
              const groupOpen = isWorkspaceSectionOpen(groupSectionKey, true);
              return (
                <details
                  key={groupName}
                  className="workspace-accordion"
                  open={groupOpen}
                  onToggle={(event) => setWorkspaceSectionOpen(groupSectionKey, event.currentTarget.open, true)}
                >
                  <summary>
                    <span>{groupName}</span>
                    <span>{items.length} task(s)</span>
                  </summary>
                  <div className="checklist-list">
                    {items.map((item) => (
                      <article key={item.id} className="checklist-item-card">
                        <div className="checklist-item-meta">
                          <span className={`checklist-status checklist-status-${item.status}`}>
                            {formatChecklistStatus(item.status)}
                          </span>
                          <span className={`checklist-chip checklist-chip-${item.priority}`}>
                            {formatChecklistPriority(item.priority)}
                          </span>
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.detail || 'No additional guidance is attached to this task yet.'}</p>
                        {item.providerCategoryLabel ? (
                          <div className="checklist-provider-inline">
                            <div>
                              <strong>{item.providerCategoryLabel}</strong>
                              <span>
                                {item.providerPrompt || 'Local provider recommendations are available for this task.'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => focusProviderSuggestions(item.id)}
                            >
                              Show providers
                            </button>
                          </div>
                        ) : null}
                        <div className="checklist-action-row">
                          {['todo', 'in_progress', 'done'].map((nextStatus) => (
                            <button
                              key={`${item.id}-${nextStatus}`}
                              type="button"
                              className={
                                item.status === nextStatus
                                  ? 'checklist-action-chip active'
                                  : 'checklist-action-chip'
                              }
                              onClick={() => handleSetChecklistItemStatus(item.id, nextStatus)}
                              disabled={Boolean(status) || isArchivedProperty}
                            >
                              {formatChecklistStatus(nextStatus)}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <p>No checklist items yet. The shared seller-prep workflow will appear here.</p>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'checklist_summary',
        label: 'Checklist',
        title: 'Progress summary',
        meta: `${readinessScore}/100 readiness`,
        defaultOpen: defaultSectionState.checklist_summary,
        className: 'content-card workspace-side-panel',
        children: (
          <div className="workspace-tab-stack">
            <div className="mini-stats">
              <button
                type="button"
                className={
                  checklistSummaryMode === 'completed'
                    ? 'stat-card stat-card-button active'
                    : 'stat-card stat-card-button'
                }
                onClick={() => setChecklistSummaryMode('completed')}
              >
                <strong>Completed</strong>
                <span>{checklist?.summary?.completedCount ?? 0}</span>
              </button>
              <button
                type="button"
                className={
                  checklistSummaryMode === 'open'
                    ? 'stat-card stat-card-button active'
                    : 'stat-card stat-card-button'
                }
                onClick={() => setChecklistSummaryMode('open')}
              >
                <strong>Open</strong>
                <span>{checklist?.summary?.openCount ?? 0}</span>
              </button>
            </div>
            <p>
              <strong>Next task:</strong> {checklist?.nextTask?.title || 'No open tasks right now'}
            </p>
            <div className="workspace-inner-card checklist-summary-card">
              <strong>{checklistSummaryMode === 'completed' ? 'Completed items' : 'Open items'}</strong>
              {(checklistSummaryMode === 'completed' ? completedChecklistItems : openChecklistItems).length ? (
                <ul className="plain-list checklist-summary-list">
                  {(checklistSummaryMode === 'completed' ? completedChecklistItems : openChecklistItems)
                    .slice(0, 6)
                    .map((item) => (
                      <li key={`summary-${item.id}`}>
                        <strong>{item.title}</strong>
                        <span>{formatChecklistCategory(item.category)}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="workspace-control-note">
                  {checklistSummaryMode === 'completed'
                    ? 'Completed tasks will appear here as you finish them.'
                    : 'Open tasks will appear here until they are completed.'}
                </p>
              )}
            </div>
          </div>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'checklist_custom',
        label: 'Checklist',
        title: 'Add custom task',
        meta: 'Optional',
        defaultOpen: defaultSectionState.checklist_custom,
        className: 'content-card checklist-form',
        children: (
          <form className="workspace-tab-stack" onSubmit={handleCreateChecklistTask}>
            <input
              type="text"
              value={customChecklistTitle}
              onChange={(event) => setCustomChecklistTitle(event.target.value)}
              placeholder="Example: book pre-listing cleaner"
              maxLength={80}
            />
            <input
              type="text"
              value={customChecklistDetail}
              onChange={(event) => setCustomChecklistDetail(event.target.value)}
              placeholder="Optional context or reminder"
              maxLength={180}
            />
            <button type="submit" className="button-secondary" disabled={Boolean(status) || isArchivedProperty}>
              Save task
            </button>
          </form>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'checklist_providers',
        label: 'Checklist',
        title: 'Provider suggestions',
        meta: providerSuggestionTask?.providerCategoryLabel || 'No linked task',
        defaultOpen: defaultSectionState.checklist_providers,
        className: 'content-card workspace-side-panel',
        children: (
          <div ref={providerSuggestionsRef} className="workspace-tab-stack">
            <p>
              {providerSuggestionTask?.providerPrompt ||
                'Provider recommendations appear here when a checklist task has a linked marketplace category.'}
            </p>
            {providerSearchStatus ? <p className="workspace-control-note">{providerSearchStatus}</p> : null}
            {providerRecommendations.length ? (
              <div className="provider-card-list">
                <div className="section-header-tight">
                  <div>
                    <strong>Workside marketplace providers</strong>
                    <p className="workspace-control-note">
                      Ranked internal providers matched by category, coverage, and marketplace readiness.
                    </p>
                  </div>
                </div>
                {providerRecommendations.map((provider) => (
                  <article key={provider.id} className="provider-card">
                    <div className="provider-card-header">
                      <div>
                        <strong>{provider.businessName}</strong>
                        <span>{provider.coverageLabel || [provider.city, provider.state].filter(Boolean).join(', ')}</span>
                      </div>
                      {provider.isSponsored ? (
                        <span className="checklist-chip checklist-chip-medium">Sponsored</span>
                      ) : null}
                    </div>
                    <p>{provider.description || 'No provider description has been added yet.'}</p>
                    <div className="provider-quality-row">
                      <span>{provider.turnaroundLabel || 'Turnaround not listed'}</span>
                      <span>{provider.pricingSummary || 'Pricing summary not listed'}</span>
                      <span>
                        {provider.verification?.review?.level === 'verified'
                          ? 'Verified credentials'
                          : provider.verification?.review?.level === 'details_provided'
                            ? 'Trust details provided'
                            : 'Self-reported trust profile'}
                      </span>
                      <span>
                        {provider.compliance?.licenseStatus === 'verified'
                          ? 'License verified'
                          : provider.verification?.license?.hasLicense
                            ? 'License self-reported'
                            : provider.compliance?.licenseStatus === 'not_required'
                              ? 'License not required'
                              : 'License unverified'}
                      </span>
                      <span>
                        {provider.compliance?.insuranceStatus === 'verified'
                          ? 'Insurance verified'
                          : provider.verification?.insurance?.hasInsurance
                            ? 'Insurance self-reported'
                            : provider.compliance?.insuranceStatus === 'not_required'
                              ? 'Insurance not required'
                              : 'Insurance unverified'}
                      </span>
                    </div>
                    <div className="tag-row">
                      {(provider.rankingBadges || []).map((badge) => (
                        <span key={`${provider.id}-${badge}`}>{badge}</span>
                      ))}
                      {(provider.serviceHighlights || []).map((highlight) => (
                        <span key={`${provider.id}-${highlight}`}>{highlight}</span>
                      ))}
                    </div>
                    <div className="provider-card-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleSaveProvider(provider.id)}
                        disabled={Boolean(status) || isArchivedProperty || provider.saved}
                      >
                        {provider.saved ? 'Saved' : 'Save provider'}
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleSaveProviderReference(provider, 'internal')}
                        disabled={
                          Boolean(status) ||
                          isArchivedProperty ||
                          providerReferenceIds.has(`internal:${provider.id}`) ||
                          providerReferences.length >= 5
                        }
                      >
                        {providerReferenceIds.has(`internal:${provider.id}`) ? 'On sheet' : 'Add to sheet'}
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={() => handleRequestProviderLead(provider)}
                        disabled={Boolean(status) || isArchivedProperty}
                      >
                        Request provider
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() =>
                          setActiveProviderDetails({
                            ...provider,
                            categoryLabel:
                              providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
                          })
                        }
                      >
                        Details
                      </button>
                      {provider.websiteUrl ? (
                        <a href={provider.websiteUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                          Visit website
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {unavailableProviderRecommendations.length ? (
              <div className="provider-card-list">
                <div className="section-header-tight">
                  <div>
                    <strong>Matching providers still in setup</strong>
                    <p className="workspace-control-note">
                      These providers match the category and coverage, but they are not fully live in the marketplace yet.
                    </p>
                  </div>
                </div>
                {unavailableProviderRecommendations.map((provider) => (
                  <article key={provider.id} className="provider-card provider-card-unavailable">
                    <div className="provider-card-header">
                      <div>
                        <strong>{provider.businessName}</strong>
                        <span>{provider.coverageLabel || [provider.city, provider.state].filter(Boolean).join(', ')}</span>
                      </div>
                      <span className="checklist-chip checklist-chip-medium">
                        {formatProviderStatusLabel(provider.status)}
                      </span>
                    </div>
                    <p>
                      {provider.description ||
                        'This provider matches the category, but their marketplace profile is not fully live yet.'}
                    </p>
                    <div className="provider-quality-row">
                      <span>{provider.turnaroundLabel || 'Turnaround not listed'}</span>
                      <span>{provider.pricingSummary || 'Pricing summary not listed'}</span>
                      <span>
                        {provider.verification?.review?.level === 'verified'
                          ? 'Verified credentials'
                          : provider.verification?.review?.level === 'details_provided'
                            ? 'Trust details provided'
                            : 'Self-reported trust profile'}
                      </span>
                    </div>
                    <div className="tag-row">
                      {(provider.rankingBadges || []).map((badge) => (
                        <span key={`${provider.id}-${badge}`}>{badge}</span>
                      ))}
                    </div>
                    <div className="provider-card-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() =>
                          setActiveProviderDetails({
                            ...provider,
                            categoryLabel:
                              providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
                          })
                        }
                      >
                        Details
                      </button>
                      {provider.websiteUrl ? (
                        <a href={provider.websiteUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                          Visit website
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {providerSource?.googleFallbackEnabled || providerGoogleSearchUrl || providerMapProviders.length ? (
              <div className="provider-card-actions">
                {providerMapProviders.length ? (
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => {
                      setProviderMapScope(hasInternalProviderResults ? 'internal' : 'all');
                      setShowProviderMap(true);
                    }}
                    disabled={Boolean(status)}
                  >
                    Open provider map
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleBrowseGoogleFallback}
                  disabled={Boolean(status) || Boolean(providerSearchStatus)}
                >
                  {externalProviderRecommendations.length || showExternalProviderFallback
                    ? 'Refresh Google fallback'
                    : 'Browse Google fallback'}
                </button>
                {providerGoogleSearchUrl ? (
                  <a href={providerGoogleSearchUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                    Open map search
                  </a>
                ) : null}
              </div>
            ) : null}
            {providerCoverageGuidance ? (
              <div
                className={`workspace-inner-card provider-coverage-card provider-coverage-card-${providerCoverageGuidance.tone}`}
              >
                <div className="provider-coverage-card-header">
                  <span className="label">{providerCoverageGuidance.eyebrow}</span>
                  <strong>{providerCoverageGuidance.title}</strong>
                </div>
                <p>{providerCoverageGuidance.message}</p>
                {providerCoverageGuidance.highlights?.length ? (
                  <div className="provider-quality-row provider-coverage-highlights">
                    {providerCoverageGuidance.highlights.map((highlight) => (
                      <span key={highlight}>{highlight}</span>
                    ))}
                  </div>
                ) : null}
                {providerCoverageGuidance.nextStep ? (
                  <p className="workspace-control-note provider-coverage-next-step">
                    {providerCoverageGuidance.nextStep}
                  </p>
                ) : null}
              </div>
            ) : null}
            {providerSearchStatus ? <p className="workspace-control-note">{providerSearchStatus}</p> : null}
            <ExternalProviderList
              shouldShowExternalProviderSection={shouldShowExternalProviderSection}
              externalProviderRecommendations={externalProviderRecommendations}
              handleSaveProviderReference={handleSaveProviderReference}
              providerReferenceIds={providerReferenceIds}
              providerReferences={providerReferences}
              status={status}
              isArchivedProperty={isArchivedProperty}
              setActiveProviderDetails={setActiveProviderDetails}
              providerSource={providerSource}
            />
            {providerSource ? (
              <p className="workspace-control-note">{buildProviderSourceSummary(providerSource)}</p>
            ) : null}
            {providerSource?.googleFallback && !providerCoverageGuidance ? (
              <p className="workspace-control-note">{buildGoogleFallbackSummary(providerSource)}</p>
            ) : null}
            {hasInternalProviderResults ? (
              <p className="workspace-control-note provider-disclaimer">
                {providerRecommendations[0]?.verification?.disclaimer ||
                  unavailableProviderRecommendations[0]?.verification?.disclaimer ||
                  'Provider credentials are self-reported or verified where indicated. Workside does not guarantee accuracy.'}
              </p>
            ) : null}
            <div className="workspace-inner-card provider-reference-sheet-card">
              <div className="section-header-tight">
                <div>
                  <strong>Provider reference sheet</strong>
                  <p className="workspace-control-note">
                    Save up to 5 internal or Google-discovered contacts here, then export a printable reference sheet.
                  </p>
                </div>
                <span className="section-header-meta">{providerReferences.length}/5 saved</span>
              </div>
              {providerReferences.length ? (
                <div className="provider-reference-list">
                  {providerReferences.map((reference) => (
                    <article key={reference.id} className="provider-reference-item">
                      <div className="provider-reference-copy">
                        <strong>{reference.businessName}</strong>
                        <span>
                          {[reference.categoryLabel || reference.categoryKey, reference.city, reference.state]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <span>
                          {reference.phone || reference.email || formatProviderReferenceAccessLabel(reference)}
                        </span>
                        {reference.source === 'google_maps' ? (
                          <span className="provider-reference-source">Google-discovered reference</span>
                        ) : null}
                      </div>
                      <div className="provider-reference-actions">
                        {reference.websiteUrl ? (
                          <a href={reference.websiteUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                            Visit website
                          </a>
                        ) : null}
                        {reference.mapsUrl ? (
                          <a href={reference.mapsUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                            Open in Maps
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => handleRemoveProviderReference(reference.id)}
                          disabled={Boolean(status) || isArchivedProperty}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="workspace-control-note">
                  Save providers from the recommendations above to build a printable shortlist for this property.
                </p>
              )}
              <div className="provider-card-actions">
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleDownloadProviderReferenceSheet}
                  disabled={!providerReferences.length}
                >
                  Download reference sheet
                </button>
              </div>
            </div>
            {providerLeads.length ? (
              <div className="provider-lead-list">
                <strong>Recent lead requests</strong>
                {providerLeads.slice(0, 3).map((lead) => (
                  <article key={lead.id} className="provider-card provider-lead-card">
                    <div className="provider-card-header">
                      <div>
                        <strong>{String(lead.categoryKey || 'provider').replace(/_/g, ' ')}</strong>
                        <span>
                          {formatProviderLeadStatusLabel(lead.status)}
                          {lead.selectedProviderName ? ` · matched with ${lead.selectedProviderName}` : ''}
                        </span>
                      </div>
                      <span className="checklist-chip">
                        {lead.dispatchSummary?.contacted || lead.dispatches?.length || 0} contacted
                      </span>
                    </div>
                    <div className="provider-quality-row">
                      <span>
                        Latest dispatch: {formatProviderLeadStatusLabel(lead.activity?.latestDispatchStatus || 'queued')}
                      </span>
                      <span>
                        Latest reply:{' '}
                        {formatProviderLeadStatusLabel(lead.activity?.latestResponseStatus || 'awaiting response')}
                      </span>
                      <span>
                        Seller notified:{' '}
                        {lead.sellerNotifiedAt ? `${formatDateTimeLabel(lead.sellerNotifiedAt)}` : 'Not yet'}
                      </span>
                    </div>
                    <p className="workspace-control-note">
                      {lead.selectedProviderName
                        ? `${lead.selectedProviderName} currently holds this lead.`
                        : 'Provider outreach is still in progress.'}{' '}
                      {lead.sellerNotificationChannels?.length
                        ? `Notification channels: ${lead.sellerNotificationChannels.join(', ')}.`
                        : ''}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ),
      })}
    </div>
  );
}
