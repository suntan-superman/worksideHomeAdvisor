'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@workside/utils';

import { AppFrame } from '../../../components/AppFrame';
import { Toast } from '../../../components/Toast';
import { analyzePricing, getDashboard, getLatestPricing, getProperty } from '../../../lib/api';

export function PropertyWorkspaceClient({ propertyId }) {
  const [property, setProperty] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [latestPricing, setLatestPricing] = useState(null);
  const [status, setStatus] = useState('Loading property workspace...');
  const [toast, setToast] = useState(null);

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

  return (
    <AppFrame>
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
          <button type="button" className="button-primary" onClick={handleAnalyzePricing}>
            Refresh pricing
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
          <ul className="plain-list">
            {(latestPricing?.selectedComps || dashboard?.comps || []).slice(0, 8).map((comp) => (
              <li key={comp.externalId || comp._id || comp.address}>
                {comp.address} · {formatCurrency(comp.price)} · {(comp.distanceMiles || 0).toFixed(2)} mi
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AppFrame>
  );
}
