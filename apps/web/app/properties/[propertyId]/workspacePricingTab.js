import { formatCurrency } from '@workside/utils';

import { PropertyLocationMap } from '../../../components/PropertyLocationMap';

export function WorkspacePricingTab({
  addressQuery,
  setShowExpandedMap,
  googleMapsUrl,
  property,
  selectedComps,
  mapsApiKey,
  latestPricing,
  dashboard,
  pricingQuickPickOptions,
  selectedListPriceSourceDraft,
  setSelectedListPriceDraft,
  setSelectedListPriceSourceDraft,
  selectedListPriceDraft,
  handleSaveSelectedListPrice,
  status,
  isArchivedProperty,
}) {
  return (
    <div className="workspace-tab-stack">
      <div className="workspace-two-column workspace-pricing-grid">
        <div className="content-card property-map-card">
          <div className="property-map-header">
            <div>
              <span className="label">Pricing map</span>
              <h2>Neighborhood context</h2>
              <p>Review the home and nearby comps side by side instead of in a long stack.</p>
            </div>
            {addressQuery ? (
              <div className="property-map-actions">
                <button
                  type="button"
                  className="button-secondary inline-button button-no-wrap property-map-link"
                  onClick={() => setShowExpandedMap(true)}
                  title="Open a larger in-app map with the property and selected comps."
                >
                  Expand map
                </button>
                {googleMapsUrl ? (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button-secondary inline-button button-no-wrap property-map-link"
                    title="Open the subject property and selected comps in Google Maps."
                  >
                    View comps in Maps
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
          {addressQuery ? (
            <PropertyLocationMap
              property={property}
              comps={selectedComps}
              mapsApiKey={mapsApiKey}
              googleMapsUrl={googleMapsUrl}
            />
          ) : (
            <p>No map available until the property address is complete.</p>
          )}
        </div>

        <div className="content-card workspace-side-panel">
          <div className="section-header-tight">
            <div>
              <span className="label">Selected comps</span>
              <h2>Nearby sales</h2>
            </div>
            <span className="section-header-meta">{selectedComps.length} comps shown</span>
          </div>
          <div className="comp-grid comp-grid-scroll workspace-scroll-panel">
            {selectedComps.length ? (
              selectedComps.map((comp) => (
                <article key={comp.externalId || comp._id || comp.address} className="comp-card">
                  <strong>{comp.address}</strong>
                  <span>{formatCurrency(comp.price)}</span>
                  <span>{(comp.distanceMiles || 0).toFixed(2)} mi away</span>
                  <span>
                    {comp.beds || '--'} bd · {comp.baths || '--'} ba · {comp.sqft || '--'} sqft
                  </span>
                  {comp.saleDate ? (
                    <span>Sold/listed: {new Date(comp.saleDate).toLocaleDateString()}</span>
                  ) : null}
                  {typeof comp.score === 'number' ? (
                    <span>Comp score: {Math.round(comp.score * 100)}</span>
                  ) : null}
                </article>
              ))
            ) : (
              <p>No comps are stored yet. Refresh pricing to build the comp set.</p>
            )}
          </div>
        </div>
      </div>

      <div className="content-card">
        <span className="label">Selected list price</span>
        <h2>Choose the price you want to market</h2>
        <p>
          The pricing analysis gives you a suggested range. This is where you confirm the actual list
          price that should carry into future flyer and report generation.
        </p>
        <div className="pricing-summary-grid">
          <div className="stat-card pricing-summary-stat">
            <strong>Suggested range</strong>
            <span>
              {latestPricing
                ? `${formatCurrency(latestPricing.recommendedListLow)} to ${formatCurrency(
                    latestPricing.recommendedListHigh,
                  )}`
                : 'Run pricing first'}
            </span>
          </div>
          <div className="stat-card pricing-summary-stat">
            <strong>Recommended midpoint</strong>
            <span>
              {latestPricing?.recommendedListMid
                ? formatCurrency(latestPricing.recommendedListMid)
                : 'Not available yet'}
            </span>
          </div>
          <div className="stat-card pricing-summary-stat">
            <strong>Chosen list price</strong>
            <span>
              {property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set yet'}
            </span>
          </div>
        </div>
        <div className="workspace-inner-card pricing-decision-card">
          <div className="pricing-decision-layout">
            <div className="pricing-decision-copy">
              <span className="label">Quick picks</span>
              <h3>Choose a starting point</h3>
              <p>Pick one of the recommendations or enter your own custom price.</p>
              <div className="pricing-decision-chip-row">
                {pricingQuickPickOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={
                      selectedListPriceSourceDraft === option.key
                        ? 'checklist-action-chip active'
                        : 'checklist-action-chip'
                    }
                    onClick={() => {
                      setSelectedListPriceDraft(String(option.value));
                      setSelectedListPriceSourceDraft(option.key);
                    }}
                  >
                    {option.label}: {formatCurrency(option.value)}
                  </button>
                ))}
                <button
                  type="button"
                  className={
                    selectedListPriceSourceDraft === 'custom'
                      ? 'checklist-action-chip active'
                      : 'checklist-action-chip'
                  }
                  onClick={() => setSelectedListPriceSourceDraft('custom')}
                >
                  Custom
                </button>
              </div>
            </div>
            <div className="pricing-decision-form">
              <label className="workspace-control-field workspace-control-field-full">
                <span>Chosen list price</span>
                <input
                  type="number"
                  min="1"
                  step="1000"
                  value={selectedListPriceDraft}
                  onChange={(event) => {
                    setSelectedListPriceDraft(event.target.value);
                    setSelectedListPriceSourceDraft('custom');
                  }}
                  placeholder="389000"
                />
              </label>
              <button
                type="button"
                className="button-primary pricing-save-button"
                onClick={handleSaveSelectedListPrice}
                disabled={Boolean(status) || !selectedListPriceDraft || isArchivedProperty}
              >
                Save chosen price
              </button>
              <p className="workspace-control-note">
                This does not change the suggested range. It stores the price you intend to use in
                future materials.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="content-card">
        <span className="label">Pricing narrative</span>
        <h2>Latest analysis</h2>
        <p>{latestPricing?.summary || dashboard?.pricingSummary || 'No stored narrative yet.'}</p>
        {latestPricing?.pricingStrategy ? (
          <p>
            <strong>Strategy:</strong> {latestPricing.pricingStrategy}
          </p>
        ) : null}
      </div>
    </div>
  );
}
