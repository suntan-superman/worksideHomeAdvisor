'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@workside/utils';

import { AppFrame } from '../../../components/AppFrame';
import { PropertyLocationMap } from '../../../components/PropertyLocationMap';
import { Toast } from '../../../components/Toast';
import {
  analyzePricing,
  createChecklistItem,
  createBillingCheckoutSession,
  createImageEnhancementJob,
  generateFlyer,
  generateReport,
  getFlyerExportUrl,
  getChecklist,
  getDashboard,
  getLatestReport,
  listMediaAssets,
  listMediaVariants,
  getLatestFlyer,
  getLatestPricing,
  getProperty,
  getReportExportUrl,
  selectMediaVariant,
  updateChecklistItem,
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

function formatChecklistStatus(status) {
  if (status === 'in_progress') {
    return 'In progress';
  }

  if (status === 'done') {
    return 'Done';
  }

  return 'To do';
}

function formatChecklistCategory(category) {
  return String(category || 'custom')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatChecklistPriority(priority) {
  return `${String(priority || 'medium').replace(/\b\w/g, (character) => character.toUpperCase())} priority`;
}

function getPreferredVariantLabel(item) {
  return item?.variantLabel || 'Preferred vision variant';
}

function getVariantSummary(variant) {
  return (
    variant?.metadata?.summary ||
    variant?.metadata?.warning ||
    'This prototype variant is available for flyer and report selection once marked preferred.'
  );
}

export function PropertyWorkspaceClient({ propertyId, mapsApiKey = '' }) {
  const flyerPreviewRef = useRef(null);
  const [property, setProperty] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [latestPricing, setLatestPricing] = useState(null);
  const [latestFlyer, setLatestFlyer] = useState(null);
  const [latestReport, setLatestReport] = useState(null);
  const [mediaAssets, setMediaAssets] = useState([]);
  const [mediaVariants, setMediaVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState('');
  const [flyerType, setFlyerType] = useState('sale');
  const [listingNoteDraft, setListingNoteDraft] = useState('');
  const [customChecklistTitle, setCustomChecklistTitle] = useState('');
  const [customChecklistDetail, setCustomChecklistDetail] = useState('');
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
  const selectedVariant = useMemo(
    () =>
      mediaVariants.find((variant) => variant.id === selectedVariantId) ||
      mediaVariants.find((variant) => variant.isSelected) ||
      mediaVariants[0] ||
      null,
    [mediaVariants, selectedVariantId],
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

  async function refreshMediaVariants(assetId = selectedMediaAssetId) {
    if (!assetId) {
      setMediaVariants([]);
      setSelectedVariantId('');
      return [];
    }

    const variantsResponse = await listMediaVariants(assetId);
    const nextVariants = variantsResponse.variants || [];
    setMediaVariants(nextVariants);
    setSelectedVariantId(
      nextVariants.find((variant) => variant.isSelected)?.id || nextVariants[0]?.id || '',
    );
    return nextVariants;
  }

  async function refreshDashboardSnapshot() {
    const dashboardResponse = await getDashboard(propertyId);
    setDashboard(dashboardResponse);

    if (dashboardResponse?.property) {
      setProperty(dashboardResponse.property);
    }

    return dashboardResponse;
  }

  async function refreshChecklist() {
    const checklistResponse = await getChecklist(propertyId);
    setChecklist(checklistResponse.checklist);
    return checklistResponse.checklist;
  }

  useEffect(() => {
    const nextSession = {
      ...(getStoredSession() || {}),
      lastPropertyId: propertyId,
    };
    setStoredSession(nextSession);
  }, [propertyId]);

  useEffect(() => {
    refreshMediaVariants(selectedMediaAsset?.id).catch(() => {
      setMediaVariants([]);
      setSelectedVariantId('');
    });
  }, [selectedMediaAsset?.id]);

  useEffect(() => {
    async function loadWorkspace() {
      setStatus('Loading property workspace...');
      setToast(null);

      try {
        const [propertyResponse, dashboardResponse, checklistResponse] = await Promise.all([
          getProperty(propertyId),
          getDashboard(propertyId),
          getChecklist(propertyId),
        ]);

        setProperty(propertyResponse.property);
        setDashboard(dashboardResponse);
        setChecklist(checklistResponse.checklist);

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
      const [dashboardResponse, checklistResponse] = await Promise.all([
        refreshDashboardSnapshot(),
        refreshChecklist(),
      ]);
      setLatestPricing(analysisResponse.analysis);
      setDashboard(dashboardResponse);
      setChecklist(checklistResponse);
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
      await Promise.all([refreshDashboardSnapshot(), refreshChecklist()]);
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
      await Promise.all([refreshDashboardSnapshot(), refreshChecklist()]);
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
      await Promise.all([
        refreshMediaAssets(selectedMediaAsset.id),
        refreshDashboardSnapshot(),
        refreshChecklist(),
      ]);
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

  async function handleGenerateVariant(jobType) {
    if (!selectedMediaAsset) {
      return;
    }

    setStatus(
      jobType === 'declutter_preview'
        ? 'Generating declutter preview...'
        : 'Generating enhanced listing version...',
    );
    setToast(null);

    try {
      const response = await createImageEnhancementJob(selectedMediaAsset.id, {
        jobType,
      });
      await Promise.all([
        refreshMediaAssets(selectedMediaAsset.id),
        refreshMediaVariants(selectedMediaAsset.id),
      ]);
      setSelectedVariantId(response.variant?.id || '');
      setToast({
        tone: 'success',
        title:
          jobType === 'declutter_preview'
            ? 'Declutter preview ready'
            : 'Enhanced photo ready',
        message:
          response.job?.warning ||
          'A new image variant is available below for review and selection.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Variant generation failed',
        message: requestError.message,
      });
    } finally {
      setStatus('');
    }
  }

  async function handleSelectVariant(variantId) {
    if (!selectedMediaAsset) {
      return;
    }

    setStatus('Selecting preferred variant...');
    setToast(null);

    try {
      await selectMediaVariant(selectedMediaAsset.id, variantId);
      await Promise.all([
        refreshMediaAssets(selectedMediaAsset.id),
        refreshMediaVariants(selectedMediaAsset.id),
      ]);
      setSelectedVariantId(variantId);
      setToast({
        tone: 'success',
        title: 'Preferred variant selected',
        message: 'Flyer and report generation will now prefer this image variant.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not select variant',
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

  async function handleSetChecklistItemStatus(itemId, nextStatus) {
    setStatus(nextStatus === 'done' ? 'Marking checklist item done...' : 'Updating checklist item...');
    setToast(null);

    try {
      const response = await updateChecklistItem(itemId, {
        status: nextStatus,
      });
      setChecklist(response.checklist);
      await refreshDashboardSnapshot();
      setToast({
        tone: 'success',
        title: 'Checklist updated',
        message: 'Seller prep progress has been saved.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Checklist update failed',
        message: requestError.message,
      });
    } finally {
      setStatus('');
    }
  }

  async function handleCreateChecklistTask(event) {
    event.preventDefault();

    if (!customChecklistTitle.trim()) {
      setToast({
        tone: 'error',
        title: 'Task title required',
        message: 'Add a short title before creating a custom checklist task.',
      });
      return;
    }

    setStatus('Saving custom checklist task...');
    setToast(null);

    try {
      const response = await createChecklistItem(propertyId, {
        title: customChecklistTitle,
        detail: customChecklistDetail,
        category: 'custom',
        priority: 'medium',
      });
      setChecklist(response.checklist);
      await refreshDashboardSnapshot();
      setCustomChecklistTitle('');
      setCustomChecklistDetail('');
      setToast({
        tone: 'success',
        title: 'Task added',
        message: 'The custom checklist task now appears in the shared property workflow.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not add task',
        message: requestError.message,
      });
    } finally {
      setStatus('');
    }
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
                      <div className="flyer-photo-badges">
                        {photo.listingCandidate ? (
                          <strong className="flyer-photo-badge">Seller selected</strong>
                        ) : null}
                        {photo.usesPreferredVariant ? (
                          <strong className="flyer-photo-badge flyer-photo-badge-vision">
                            {getPreferredVariantLabel(photo)}
                          </strong>
                        ) : null}
                      </div>
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
        <div className="content-card checklist-card">
          <div className="section-header-tight">
            <div>
              <span className="label">Seller checklist</span>
              <h2>Listing-prep progress</h2>
              <p>
                Work through the shared checklist here or in mobile. Status changes update
                readiness and feed the seller report.
              </p>
            </div>
            <span className="section-header-meta">
              {checklist?.summary?.progressPercent ?? 0}% ready
            </span>
          </div>

          <div className="mini-stats">
            <div className="stat-card">
              <strong>Completed</strong>
              <span>{checklist?.summary?.completedCount ?? 0}</span>
            </div>
            <div className="stat-card">
              <strong>Open</strong>
              <span>{checklist?.summary?.openCount ?? 0}</span>
            </div>
            <div className="stat-card">
              <strong>Next task</strong>
              <span>{checklist?.nextTask?.title || 'No open tasks right now'}</span>
            </div>
          </div>

          {checklist?.items?.length ? (
            <div className="checklist-list">
              {checklist.items.map((item) => (
                <article key={item.id} className="checklist-item-card">
                  <div className="checklist-item-meta">
                    <span className={`checklist-status checklist-status-${item.status}`}>
                      {formatChecklistStatus(item.status)}
                    </span>
                    <span className="checklist-chip">{formatChecklistCategory(item.category)}</span>
                    <span className={`checklist-chip checklist-chip-${item.priority}`}>
                      {formatChecklistPriority(item.priority)}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.detail || 'No additional guidance is attached to this task yet.'}</p>
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
                        disabled={Boolean(status)}
                      >
                        {formatChecklistStatus(nextStatus)}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>No checklist items have been created yet for this property.</p>
          )}

          <form className="checklist-form" onSubmit={handleCreateChecklistTask}>
            <label>
              Add a custom task
              <input
                type="text"
                value={customChecklistTitle}
                onChange={(event) => setCustomChecklistTitle(event.target.value)}
                placeholder="Schedule deep clean, confirm paint quote, prep disclosures..."
                maxLength={140}
              />
            </label>
            <label>
              Details
              <textarea
                value={customChecklistDetail}
                onChange={(event) => setCustomChecklistDetail(event.target.value)}
                placeholder="Optional notes about the task, vendor, or next action."
                maxLength={280}
              />
            </label>
            <div className="button-stack">
              <button type="submit" className="button-secondary" disabled={Boolean(status)}>
                Add checklist task
              </button>
            </div>
          </form>
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
                  <span>
                    {checklist?.summary?.totalCount
                      ? `${checklist.summary.completedCount}/${checklist.summary.totalCount} checklist items completed`
                      : 'Includes current prep tasks, top improvements, and marketing highlights'}
                  </span>
                </div>
                <div className="stat-card">
                  <strong>Status</strong>
                  <span>
                    {latestReport
                      ? latestReport.freshness?.isStale
                        ? 'Stale until refreshed'
                        : 'Current with latest workspace data'
                      : 'No report generated yet'}
                  </span>
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
                <div className="tag-row">
                  <span>
                    {latestReport.freshness?.isStale ? 'Stale report' : 'Current report'}
                  </span>
                  <span>Version {latestReport.reportVersion || 1}</span>
                  <span>
                    {latestReport.payload?.readinessSummary?.label ||
                      'Readiness summary pending'}
                  </span>
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
                  <strong>Confidence</strong>
                  <span>
                    {latestReport.pricingSummary?.confidence
                      ? `${Math.round(latestReport.pricingSummary.confidence * 100)}%`
                      : 'Pending'}
                  </span>
                </div>
                <div className="stat-card">
                  <strong>Readiness</strong>
                  <span>
                    {latestReport.payload?.readinessSummary?.overallScore
                      ? `${latestReport.payload.readinessSummary.overallScore}/100`
                      : 'Pending'}
                  </span>
                </div>
                <div className="stat-card">
                  <strong>Photos</strong>
                  <span>
                    {latestReport.payload?.photoSummary?.totalPhotos ?? 0} uploaded ·{' '}
                    {latestReport.payload?.photoSummary?.listingCandidateCount ?? 0} selected ·{' '}
                    {latestReport.payload?.photoSummary?.selectedPreferredVariantCount ??
                      latestReport.selectedPhotos?.filter((photo) => photo.usesPreferredVariant)
                        .length ??
                      0}{' '}
                    vision-ready
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
              <div className="report-preview-section">
                <strong>Included sections</strong>
                <ul className="plain-list">
                  {(latestReport.payload?.sectionOutline || []).slice(0, 8).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="report-preview-section">
                <strong>Photo review summary</strong>
                <p>
                  {latestReport.payload?.photoSummary?.summary ||
                    'No photo-review summary is available yet.'}
                </p>
                {latestReport.payload?.photoSummary?.missingRooms?.length ? (
                  <div className="tag-row">
                    {latestReport.payload.photoSummary.missingRooms.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              {latestReport.selectedPhotos?.length ? (
                <div className="report-preview-section">
                  <strong>Selected photo set</strong>
                  <div className="flyer-photo-grid">
                    {latestReport.selectedPhotos.slice(0, 4).map((photo) => (
                      <div key={`report-photo-${photo.assetId || photo.imageUrl}`} className="flyer-photo-card">
                        {photo.imageUrl ? (
                          <img src={photo.imageUrl} alt={photo.roomLabel || 'Report photo'} />
                        ) : null}
                        <span>{photo.roomLabel || 'Selected report photo'}</span>
                        <div className="flyer-photo-badges">
                          {photo.listingCandidate ? (
                            <strong className="flyer-photo-badge">Seller selected</strong>
                          ) : null}
                          {photo.usesPreferredVariant ? (
                            <strong className="flyer-photo-badge flyer-photo-badge-vision">
                              {getPreferredVariantLabel(photo)}
                            </strong>
                          ) : null}
                        </div>
                        {photo.listingNote ? (
                          <em className="flyer-photo-note">{photo.listingNote}</em>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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
              <div className="report-preview-section">
                <strong>Draft listing description</strong>
                <p>
                  {latestReport.payload?.listingDescriptions?.shortDescription ||
                    latestReport.payload?.marketingGuidance?.shortDescription ||
                    'Listing-description guidance is not available yet.'}
                </p>
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
                        <div className="property-media-candidate-meta">
                          <strong>{asset.roomLabel}</strong>
                          <span>{asset.listingNote || 'Ready for flyer and listing materials'}</span>
                          {asset.selectedVariant ? (
                            <em className="property-media-candidate-tag">
                              {asset.selectedVariant.label || 'Preferred vision variant ready'}
                            </em>
                          ) : null}
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
                    <div>
                      <strong>{asset.roomLabel}</strong>
                      {asset.selectedVariant ? (
                        <small>{asset.selectedVariant.label || 'Vision preferred'}</small>
                      ) : asset.listingCandidate ? (
                        <small>Seller pick</small>
                      ) : null}
                    </div>
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
                    {selectedMediaAsset.selectedVariant ? (
                      <p>
                        Preferred vision variant: {selectedMediaAsset.selectedVariant.label || 'Vision-ready version'}.
                        Flyer and report generation will now use that version first.
                      </p>
                    ) : null}
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
                        {selectedMediaAsset.selectedVariant ? <span>Preferred variant selected</span> : null}
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
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleGenerateVariant('enhance_listing_quality')}
                        disabled={Boolean(status)}
                      >
                        Generate enhanced version
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleGenerateVariant('declutter_preview')}
                        disabled={Boolean(status)}
                      >
                        Create declutter preview
                      </button>
                    </div>
                    {selectedVariant ? (
                      <div className="property-media-variant-panel">
                        <div className="property-media-variant-compare">
                          <div>
                            <span className="label">Original</span>
                            <p className="property-media-variant-caption">
                              Untouched mobile capture.
                            </p>
                            <img
                              src={selectedMediaAsset.imageUrl}
                              alt={selectedMediaAsset.roomLabel || 'Original property photo'}
                              className="property-media-variant-image"
                            />
                          </div>
                          <div>
                            <span className="label">Vision output</span>
                            <p className="property-media-variant-caption">
                              {getVariantSummary(selectedVariant)}
                            </p>
                            <img
                              src={selectedVariant.imageUrl}
                              alt={selectedVariant.label || 'Generated image variant'}
                              className="property-media-variant-image"
                            />
                          </div>
                        </div>
                        {selectedVariant.metadata?.effects?.length ? (
                          <div className="property-media-variant-effects">
                            {selectedVariant.metadata.effects.map((effect) => (
                              <span key={effect}>{effect}</span>
                            ))}
                          </div>
                        ) : null}
                        {selectedVariant.metadata?.differenceHint ? (
                          <p className="property-media-variant-hint">
                            {selectedVariant.metadata.differenceHint}
                          </p>
                        ) : null}
                        <div className="property-media-variant-list">
                          {mediaVariants.map((variant) => (
                            <button
                              key={variant.id}
                              type="button"
                              className={
                                variant.id === selectedVariant?.id
                                  ? 'property-media-variant-chip active'
                                  : 'property-media-variant-chip'
                              }
                              onClick={() => setSelectedVariantId(variant.id)}
                            >
                              {variant.label}
                              {variant.isSelected ? ' · Preferred' : ''}
                            </button>
                          ))}
                        </div>
                        {selectedVariant.metadata?.warning ? (
                          <p>{selectedVariant.metadata.warning}</p>
                        ) : null}
                        <div className="button-stack">
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => handleSelectVariant(selectedVariant.id)}
                            disabled={Boolean(status) || selectedVariant.isSelected}
                          >
                            {selectedVariant.isSelected ? 'Preferred variant selected' : 'Use this variant in materials'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="property-media-variant-panel">
                        <p>
                          Generate an enhanced version or declutter preview to begin the Vision workflow for this photo.
                        </p>
                      </div>
                    )}
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
