'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@workside/utils';

import { AppFrame } from '../../../components/AppFrame';
import { Toast } from '../../../components/Toast';
import {
  analyzePricing,
  createBillingCheckoutSession,
  generateFlyer,
  getDashboard,
  getLatestFlyer,
  getLatestPricing,
  getProperty,
} from '../../../lib/api';
import { getStoredSession, setStoredSession } from '../../../lib/session';

export function PropertyWorkspaceClient({ propertyId }) {
  const flyerPreviewRef = useRef(null);
  const [property, setProperty] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [latestPricing, setLatestPricing] = useState(null);
  const [latestFlyer, setLatestFlyer] = useState(null);
  const [flyerType, setFlyerType] = useState('sale');
  const [status, setStatus] = useState('Loading property workspace...');
  const [toast, setToast] = useState(null);

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

      <section className="content-grid dashboard-content-grid">
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

        <div className="content-card">
          <span className="label">Selected comps</span>
          <div className="comp-grid">
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
                <span className="flyer-generator-helper">
                  Creates a stored draft from your latest pricing and property details.
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
    </AppFrame>
  );
}
