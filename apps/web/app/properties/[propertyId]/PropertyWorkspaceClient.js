'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@workside/utils';

import { AppFrame } from '../../../components/AppFrame';
import { PropertyLocationMap } from '../../../components/PropertyLocationMap';
import { Toast } from '../../../components/Toast';
import {
  analyzePricing,
  createBillingCheckoutSession,
  generateFlyer,
  generateReport,
  getFlyerExportUrl,
  getDashboard,
  getLatestReport,
  listMediaAssets,
  getLatestFlyer,
  getLatestPricing,
  getProperty,
  getReportExportUrl,
  updateMediaAsset,
} from '../../../lib/api';
import { getStoredSession, setStoredSession } from '../../../lib/session';

function buildAddressQuery(property) {
  return [
    property?.addressLine1,
    property?.city,
    property?.state,
    property?.zip,
  ]
    .filter(Boolean)
    .join(', ');
}

export function PropertyWorkspaceClient({ propertyId, mapsApiKey = '' }) {
  const flyerPreviewRef = useRef(null);
  const [property, setProperty] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [latestPricing, setLatestPricing] = useState(null);
  const [latestFlyer, setLatestFlyer] = useState(null);
  const [latestReport, setLatestReport] = useState(null);
  const [mediaAssets, setMediaAssets] = useState([]);
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState('');
  const [flyerType, setFlyerType] = useState('sale');
  const [listingNoteDraft, setListingNoteDraft] = useState('');
  const [status, setStatus] = useState('Loading property workspace...');
  const [toast, setToast] = useState(null);
  const selectedMediaAsset = useMemo(
    () => mediaAssets.find((asset) => asset.id === selectedMediaAssetId) || mediaAssets[0] || null,
    [mediaAssets, selectedMediaAssetId],
  );
  const listingCandidateAssets = useMemo(
    () => mediaAssets.filter((asset) => asset.listingCandidate),
    [mediaAssets],
  );

  useEffect(() => {
    setListingNoteDraft(selectedMediaAsset?.listingNote || '');
  }, [selectedMediaAsset?.id, selectedMediaAsset?.listingNote]);

  async function refreshMediaAssets(preferredAssetId = selectedMediaAssetId) {
    const mediaResponse = await listMediaAssets(propertyId);
    const nextAssets = mediaResponse.assets || [];
    setMediaAssets(nextAssets);
    setSelectedMediaAssetId(preferredAssetId || nextAssets?.[0]?.id || '');
    return nextAssets;
  }

  useEffect(() => {
    const nextSession = {
      ...(getStoredSession() || {}),
      lastPropertyId: propertyId,
    };
    setStoredSession(nextSession);
  }, [propertyId]);

  useEffect(() => {
    async function loadWorkspace() {
      setStatus('Loading property workspace...');
      setToast(null);

      try {
        const [propertyResponse, dashboardResponse] = await Promise.all([
          getProperty(propertyId),
          getDashboard(propertyId),
        ]);

        setProperty(propertyResponse.property);
        setDashboard(dashboardResponse);

        try {
          const pricingResponse = await getLatestPricing(propertyId);
          setLatestPricing(pricingResponse.analysis);
        } catch {
          setLatestPricing(null);
        }

        try {
          const flyerResponse = await getLatestFlyer(propertyId);
          setLatestFlyer(flyerResponse.flyer);
        } catch {
          setLatestFlyer(null);
        }

        try {
          const reportResponse = await getLatestReport(propertyId);
          setLatestReport(reportResponse.report);
        } catch {
          setLatestReport(null);
        }

        try {
          await refreshMediaAssets();
        } catch {
          setMediaAssets([]);
          setSelectedMediaAssetId('');
        }
      } catch (requestError) {
        setToast({
          tone: 'error',
          title: 'Could not load property',
          message: requestError.message,
        });
      } finally {
        setStatus('');
      }
    }

    loadWorkspace();
  }, [propertyId]);

  async function handleAnalyzePricing() {
    setStatus('Refreshing RentCast + AI pricing analysis...');
    setToast(null);

    try {
      const analysisResponse = await analyzePricing(propertyId);
      const dashboardResponse = await getDashboard(propertyId);
      setLatestPricing(analysisResponse.analysis);
      setDashboard(dashboardResponse);
      setToast({
        tone: 'success',
        title: 'Pricing refreshed',
        message: 'The latest analysis and comp set are ready.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Pricing refresh failed',
        message: requestError.message,
      });
    } finally {
      setStatus('');
    }
  }

  async function handleGenerateFlyer() {
    setStatus(`Generating ${flyerType} flyer...`);
    setToast(null);

    try {
      const response = await generateFlyer(propertyId, flyerType);
      setLatestFlyer(response.flyer);
      setToast({
        tone: 'success',
        title: 'Flyer generated',
        message: 'A fresh flyer draft is ready below. We scrolled you to the preview.',
      });
      requestAnimationFrame(() => {
        flyerPreviewRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    } catch (requestError) {
      if (
        requestError.status === 402 &&
        requestError.details?.suggestedPlan
      ) {
        const session = getStoredSession();
        if (session?.user?.id) {
          setStatus('Opening Stripe checkout...');

          try {
            const checkout = await createBillingCheckoutSession(
              {
                userId: session.user.id,
                planKey: requestError.details.suggestedPlan,
              },
              session.user.id,
            );

            if (checkout.url) {
              window.location.href = checkout.url;
              return;
            }
          } catch (checkoutError) {
            setToast({
              tone: 'error',
              title: 'Billing required',
              message: checkoutError.message,
            });
            setStatus('');
            return;
          }
        }
      }

      setToast({
        tone: 'error',
        title: 'Flyer generation failed',
        message: requestError.message,
      });
    } finally {
      setStatus('');
    }
  }

  async function handleGenerateReport() {
    setStatus('Generating seller intelligence report...');
    setToast(null);

    try {
      const response = await generateReport(propertyId);
      setLatestReport(response.report);
      setToast({
        tone: 'success',
        title: 'Report generated',
        message: 'A fresh property report preview is ready below.',
      });
    } catch (requestError) {
      if (
        requestError.status === 402 &&
        requestError.details?.suggestedPlan
      ) {
        const session = getStoredSession();
        if (session?.user?.id) {
          setStatus('Opening Stripe checkout...');

          try {
            const checkout = await createBillingCheckoutSession(
              {
                userId: session.user.id,
                planKey: requestError.details.suggestedPlan,
              },
              session.user.id,
            );

            if (checkout.url) {
              window.location.href = checkout.url;
              return;
            }
          } catch (checkoutError) {
            setToast({
              tone: 'error',
              title: 'Billing required',
              message: checkoutError.message,
            });
            setStatus('');
            return;
          }
        }
      }

      setToast({
        tone: 'error',
        title: 'Report generation failed',
        message: requestError.message,
      });
    } finally {
      setStatus('');
    }
  }

  async function handleToggleListingCandidate() {
    if (!selectedMediaAsset) {
      return;
    }

    const nextValue = !selectedMediaAsset.listingCandidate;
    setStatus(nextValue ? 'Marking photo as listing candidate...' : 'Removing listing-candidate mark...');
    setToast(null);

    try {
      await updateMediaAsset(selectedMediaAsset.id, {
        listingCandidate: nextValue,
      });
      await refreshMediaAssets(selectedMediaAsset.id);
      setToast({
        tone: 'success',
        title: nextValue ? 'Listing candidate selected' : 'Listing candidate removed',
        message: nextValue
          ? 'This photo will now be prioritized for flyer generation.'
          : 'This photo will no longer be prioritized for the flyer.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not update photo',
        message: requestError.message,
      });
    } finally {
      setStatus('');
    }
  }

  async function handleSaveListingNote() {
    if (!selectedMediaAsset) {
      return;
    }

    setStatus('Saving photo note...');
    setToast(null);

    try {
      await updateMediaAsset(selectedMediaAsset.id, {
        listingNote: listingNoteDraft,
      });
      await refreshMediaAssets(selectedMediaAsset.id);
      setToast({
        tone: 'success',
        title: 'Photo note saved',
        message: 'Your note will stay attached to this photo for listing review.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not save note',
        message: requestError.message,
      });
    } finally {
      setStatus('');
    }
  }

  function handleDownloadFlyerPdf() {
    const exportUrl = getFlyerExportUrl(propertyId, flyerType);
    window.open(exportUrl, '_blank', 'noopener,noreferrer');
  }

  function handleDownloadReportPdf() {
    const exportUrl = getReportExportUrl(propertyId);
    window.open(exportUrl, '_blank', 'noopener,noreferrer');
  }

  const addressQuery = buildAddressQuery(property);
  const googleMapsUrl = addressQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`
    : null;

  return (
    <AppFrame busy={Boolean(status)}>
      <Toast
        tone={toast?.tone}
        title={toast?.title}
        message={toast?.message}
        onClose={() => setToast(null)}
      />
      <section className="dashboard-header">
        <div>
          <span className="label">Property workspace</span>
          <h1>{property?.title || 'Property'}</h1>
          <p>
            Live pricing, comps, and seller-facing AI output for this home.
          </p>
        </div>
        <div className="button-stack align-end">
          <button
            type="button"
            className={status.includes('Refreshing') ? 'button-primary button-busy' : 'button-primary'}
            onClick={handleAnalyzePricing}
            disabled={Boolean(status)}
          >
            {status.includes('Refreshing') ? 'Refreshing analysis...' : 'Refresh pricing'}
          </button>
          <Link href="/dashboard" className="button-secondary inline-button">
            Back to dashboard
          </Link>
        </div>
      </section>

      {status ? <p className="status-copy">{status}</p> : null}

      <section className="dashboard-grid">
        <article className="feature-card">
          <span className="label">Address</span>
          <h3>{property?.addressLine1}</h3>
          <p>
            {property?.city}, {property?.state} {property?.zip}
          </p>
        </article>

        <article className="feature-card">
          <span className="label">Recommended price band</span>
          <h3>
            {latestPricing
              ? `${formatCurrency(latestPricing.recommendedListLow)} to ${formatCurrency(latestPricing.recommendedListHigh)}`
              : 'Run pricing analysis'}
          </h3>
          <p>
            {latestPricing
              ? `Midpoint ${formatCurrency(latestPricing.recommendedListMid)} with ${Math.round(
                  (latestPricing.confidenceScore || 0) * 100,
                )}% confidence.`
              : 'This property does not have a stored pricing analysis yet.'}
          </p>
        </article>

        <article className="feature-card">
          <span className="label">Property snapshot</span>
          <ul className="plain-list">
            <li>{property?.bedrooms || 0} bedrooms</li>
            <li>{property?.bathrooms || 0} bathrooms</li>
            <li>{property?.squareFeet || 0} square feet</li>
            <li>{property?.propertyType}</li>
          </ul>
        </article>
      </section>

      <section className="workspace-grid dashboard-content-grid">
        <div className="workspace-primary-column">
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

          <div className="content-card property-map-card">
            <div className="property-map-header">
              <div>
                <span className="label">Property map</span>
                <h2>Neighborhood context</h2>
                <p>
                  A quick visual for location, nearby streets, and the property&apos;s surrounding
                  area.
                </p>
              </div>
            {googleMapsUrl ? (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="button-secondary inline-button button-no-wrap"
              >
                Open in Google Maps
              </a>
            ) : null}
          </div>
          {addressQuery ? (
            <PropertyLocationMap
              property={property}
              comps={latestPricing?.selectedComps || dashboard?.comps || []}
              mapsApiKey={mapsApiKey}
              googleMapsUrl={googleMapsUrl}
            />
          ) : (
            <p>No map available until the property address is complete.</p>
          )}
          </div>
        </div>

        <div className="content-card workspace-secondary-card">
          <div className="section-header-tight">
            <div>
              <span className="label">Selected comps</span>
              <h2>Nearby sales context</h2>
            </div>
            <span className="section-header-meta">
              {(latestPricing?.selectedComps || dashboard?.comps || []).slice(0, 8).length} comps shown
            </span>
          </div>
          <div className="comp-grid comp-grid-scroll">
            {(latestPricing?.selectedComps || dashboard?.comps || []).slice(0, 8).map((comp) => (
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
            ))}
          </div>
        </div>
      </section>

      <section className="content-grid dashboard-content-grid">
        <div className="content-card flyer-generator-card">
          <div className="flyer-generator-layout">
            <div className="flyer-generator-copy">
              <span className="label">Flyer generator</span>
              <h2>AI flyer draft</h2>
              <p>
                Generate a seller-facing flyer draft from live pricing, property details, and the
                best available photos.
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
              <p className="flyer-generator-note">
                Best for testing listing language, layout direction, and which photos deserve top
                placement.
              </p>
            </div>

            <div className="flyer-generator-side">
              <div className="flyer-generator-meta">
                <div className="stat-card">
                  <strong>Pricing</strong>
                  <span>{latestPricing ? 'Live pricing attached' : 'Uses latest saved pricing'}</span>
                </div>
                <div className="stat-card">
                  <strong>Photos</strong>
                  <span>
                    {latestFlyer?.selectedPhotos?.length
                      ? `${latestFlyer.selectedPhotos.length} selected for the latest draft`
                      : 'Uses top available property photos'}
                  </span>
                </div>
                <div className="stat-card">
                  <strong>Listing picks</strong>
                  <span>
                    {listingCandidateAssets.length
                      ? `${listingCandidateAssets.length} manually selected`
                      : 'No manual listing picks yet'}
                  </span>
                </div>
                <div className="stat-card">
                  <strong>Output</strong>
                  <span>Headline, highlights, CTA, and preview draft</span>
                </div>
              </div>
              <div className="button-stack flyer-generator-actions">
                <button
                  type="button"
                  className={status.includes('Generating') ? 'button-primary button-busy' : 'button-primary'}
                  onClick={handleGenerateFlyer}
                  disabled={Boolean(status)}
                >
                  {status.includes('Generating') ? 'Generating flyer...' : 'Generate flyer'}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleDownloadFlyerPdf}
                  disabled={Boolean(status)}
                >
                  Download PDF
                </button>
                <span className="flyer-generator-helper">
                  Generate for preview, then export a simple PDF flyer from the current property.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div ref={flyerPreviewRef} className="content-card">
          <span className="label">Latest flyer preview</span>
          {latestFlyer ? (
            <div className="flyer-preview">
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
              {latestFlyer.selectedPhotos?.length ? (
                <div className="flyer-photo-grid">
                  {latestFlyer.selectedPhotos.slice(0, 4).map((photo) => (
                    <div key={photo.assetId || photo.imageUrl} className="flyer-photo-card">
                      {photo.imageUrl ? (
                        <img src={photo.imageUrl} alt={photo.roomLabel || 'Property photo'} />
                      ) : null}
                      <span>{photo.roomLabel || 'Selected photo'}</span>
                      {photo.listingCandidate ? (
                        <strong className="flyer-photo-badge">Seller selected</strong>
                      ) : null}
                      {photo.listingNote ? (
                        <em className="flyer-photo-note">{photo.listingNote}</em>
                      ) : null}
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
            </div>
          ) : (
            <p>No flyer draft yet. Generate one to preview sale or rental marketing output.</p>
          )}
        </div>
      </section>

      <section className="content-grid dashboard-content-grid">
        <div className="content-card report-generator-card">
          <div className="flyer-generator-layout">
            <div className="flyer-generator-copy">
              <span className="label">Seller report</span>
              <h2>Property intelligence report</h2>
              <p>
                Generate a richer PDF-ready report that combines pricing, comps, selected photos,
                improvement priorities, and launch checklist context.
              </p>
              <p className="flyer-generator-note">
                This is the next premium deliverable after the flyer: a stronger presentation-ready
                asset for review and export.
              </p>
            </div>

            <div className="flyer-generator-side">
              <div className="flyer-generator-meta">
                <div className="stat-card">
                  <strong>Pricing</strong>
                  <span>{latestPricing ? 'Included from latest analysis' : 'Will reflect saved pricing when available'}</span>
                </div>
                <div className="stat-card">
                  <strong>Photos</strong>
                  <span>
                    {latestReport?.selectedPhotos?.length
                      ? `${latestReport.selectedPhotos.length} photos in the latest report`
                      : `${listingCandidateAssets.length || mediaAssets.length} photos available for report selection`}
                  </span>
                </div>
                <div className="stat-card">
                  <strong>Checklist + prep</strong>
                  <span>Includes current prep tasks, top improvements, and marketing highlights</span>
                </div>
              </div>
              <div className="button-stack flyer-generator-actions">
                <button
                  type="button"
                  className={status.includes('report') ? 'button-primary button-busy' : 'button-primary'}
                  onClick={handleGenerateReport}
                  disabled={Boolean(status)}
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
            </div>
          </div>
        </div>

        <div className="content-card">
          <span className="label">Latest report preview</span>
          {latestReport ? (
            <div className="report-preview">
              <div className="flyer-hero">
                <span className="label">{latestReport.reportType}</span>
                <h2>{latestReport.title}</h2>
                <p>{latestReport.executiveSummary}</p>
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
                  <strong>Confidence</strong>
                  <span>
                    {latestReport.pricingSummary?.confidence
                      ? `${Math.round(latestReport.pricingSummary.confidence * 100)}%`
                      : 'Pending'}
                  </span>
                </div>
              </div>
              <div className="report-preview-section">
                <strong>Top checklist items</strong>
                <ul className="plain-list">
                  {(latestReport.checklistItems || []).slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="report-preview-section">
                <strong>Top improvements</strong>
                <ul className="plain-list">
                  {(latestReport.improvementItems || []).slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="report-preview-section">
                <strong>Marketing highlights</strong>
                <div className="tag-row">
                  {(latestReport.marketingHighlights || []).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p>No seller report has been generated yet. Create one to preview the premium report flow.</p>
          )}
        </div>
      </section>

      <section className="content-grid dashboard-content-grid">
        <div className="content-card">
          <div className="section-header-tight">
            <div>
              <span className="label">Property media</span>
              <h2>Photos captured in mobile</h2>
            </div>
            <span className="section-header-meta">
              {mediaAssets.length} saved photo{mediaAssets.length === 1 ? '' : 's'} · {listingCandidateAssets.length} listing candidate{listingCandidateAssets.length === 1 ? '' : 's'}
            </span>
          </div>

          {mediaAssets.length ? (
            <div className="property-media-layout">
              {listingCandidateAssets.length ? (
                <div className="property-media-candidate-strip">
                  <div className="property-media-candidate-header">
                    <div>
                      <span className="label">Best listing photos</span>
                      <h3>Seller-selected candidates</h3>
                    </div>
                    <span className="section-header-meta">{listingCandidateAssets.length} chosen</span>
                  </div>
                  <div className="property-media-candidate-list">
                    {listingCandidateAssets.map((asset) => (
                      <button
                        key={`candidate-${asset.id}`}
                        type="button"
                        className={
                          asset.id === selectedMediaAsset?.id
                            ? 'property-media-candidate-card active'
                            : 'property-media-candidate-card'
                        }
                        onClick={() => setSelectedMediaAssetId(asset.id)}
                      >
                        <img src={asset.imageUrl} alt={asset.roomLabel || 'Listing candidate'} />
                        <div>
                          <strong>{asset.roomLabel}</strong>
                          <span>{asset.listingNote || 'Ready for flyer and listing materials'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="property-media-rail">
                {mediaAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className={asset.id === selectedMediaAsset?.id ? 'property-media-thumb active' : 'property-media-thumb'}
                    onClick={() => setSelectedMediaAssetId(asset.id)}
                  >
                    <img src={asset.imageUrl} alt={asset.roomLabel || 'Property photo'} />
                    <span>{asset.roomLabel}</span>
                  </button>
                ))}
              </div>

              {selectedMediaAsset ? (
                <div className="property-media-detail">
                    <img
                      src={selectedMediaAsset.imageUrl}
                      alt={selectedMediaAsset.roomLabel || 'Selected property photo'}
                      className="property-media-hero"
                    />
                  <div className="property-media-copy">
                    <h3>{selectedMediaAsset.roomLabel}</h3>
                    <p>
                      Saved {new Date(selectedMediaAsset.createdAt).toLocaleDateString()}
                      {selectedMediaAsset.analysis?.roomGuess
                        ? ` · AI sees ${selectedMediaAsset.analysis.roomGuess.toLowerCase()}`
                        : ''}
                    </p>
                    {selectedMediaAsset.analysis?.summary ? (
                      <p>{selectedMediaAsset.analysis.summary}</p>
                    ) : (
                      <p>No AI photo summary is stored for this image yet.</p>
                    )}
                    {typeof selectedMediaAsset.analysis?.overallQualityScore === 'number' ? (
                      <div className="property-media-badges">
                        <span>Quality {selectedMediaAsset.analysis.overallQualityScore}/100</span>
                        {typeof selectedMediaAsset.analysis?.lightingScore === 'number' ? (
                          <span>Light {selectedMediaAsset.analysis.lightingScore}/100</span>
                        ) : null}
                        {typeof selectedMediaAsset.analysis?.compositionScore === 'number' ? (
                          <span>Composition {selectedMediaAsset.analysis.compositionScore}/100</span>
                        ) : null}
                        {selectedMediaAsset.analysis?.retakeRecommended ? (
                          <span>Retake suggested</span>
                        ) : (
                          <span>Ready for listing review</span>
                        )}
                        {selectedMediaAsset.listingCandidate ? <span>Listing candidate</span> : null}
                      </div>
                    ) : null}
                    <div className="property-media-actions">
                      <button
                        type="button"
                        className={selectedMediaAsset.listingCandidate ? 'button-secondary' : 'button-primary'}
                        onClick={handleToggleListingCandidate}
                        disabled={Boolean(status)}
                      >
                        {selectedMediaAsset.listingCandidate ? 'Remove from listing picks' : 'Mark as listing candidate'}
                      </button>
                    </div>
                    <label className="property-media-note-field">
                      Listing note
                      <textarea
                        value={listingNoteDraft}
                        onChange={(event) => setListingNoteDraft(event.target.value)}
                        maxLength={280}
                        placeholder="Why this photo is strong, what it should lead with, or where it belongs in the story."
                      />
                    </label>
                    <div className="button-stack">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={handleSaveListingNote}
                        disabled={Boolean(status)}
                      >
                        Save photo note
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p>No photos have been saved for this property yet. Capture one from the mobile app to see it here.</p>
          )}
        </div>

        <div className="content-card">
          <span className="label">Media notes</span>
          <h2>How this fits the workflow</h2>
          <p>
            The property photo set is now shared across mobile and web. As you capture rooms in the
            mobile app, those images become available here for review, flyer generation, and future
            listing-vision improvements.
          </p>
          <ul className="plain-list">
            <li>Use mobile for fast room-by-room capture.</li>
            <li>Use web for desktop review, flyer prep, and marketing output.</li>
            <li>Stronger photos will naturally feed later AI listing and flyer experiences.</li>
          </ul>
        </div>
      </section>

    </AppFrame>
  );
}
