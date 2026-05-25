'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeLandingAttribution } from '@workside/utils';

import { Toast } from '../Toast';
import {
  captureFunnelLead,
  continuePublicSignup,
  getPublicSellerPreview,
  trackLandingEvent,
} from '../../lib/api';
import { setStoredAttributionDraft } from '../../lib/attribution-draft';
import { trackMetaPixelEvent } from '../../lib/meta-pixel';
import { EmailGateModal } from './EmailGateModal';

const SELLER_LANDING_DRAFT_KEY = 'worksideSellerLandingDraft';
const LANDING_ANONYMOUS_ID_KEY = 'worksideLandingAnonymousId';

const SELLER_OUTPUTS = [
  ['Seller Report', 'A clean plan sellers can save, share, and act on.'],
  ['Pricing Story', 'A plain-English range and market narrative.'],
  ['Prep Checklist', 'The next steps that matter before listing.'],
  ['Marketing Flyer', 'A sharper handoff for the launch conversation.'],
];

const TRUST_ITEMS = ['AI-guided', 'Human support available', 'Local providers', 'Seller-first workflow'];

function normalizeState(value) {
  return String(value || '').trim().toUpperCase().slice(0, 2);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getOrCreateAnonymousId() {
  if (typeof window === 'undefined') return '';

  const existingId = window.localStorage.getItem(LANDING_ANONYMOUS_ID_KEY);
  if (existingId) return existingId;

  const nextId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(LANDING_ANONYMOUS_ID_KEY, nextId);
  return nextId;
}

function FlowIcon({ index }) {
  return (
    <span className={`marketing-flow-icon marketing-flow-icon-${index}`} aria-hidden="true">
      <span />
    </span>
  );
}

export function SellerLandingClient({
  source = 'direct-sell',
  campaign = '',
  medium = '',
  adset = '',
  ad = '',
}) {
  const router = useRouter();
  const [anonymousId, setAnonymousId] = useState('');
  const [form, setForm] = useState({
    address: '',
    city: '',
    state: 'CA',
    postalCode: '',
    propertyType: 'single_family',
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
  });
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [emailGateOpen, setEmailGateOpen] = useState(false);
  const [gateEmail, setGateEmail] = useState('');
  const [gateFirstName, setGateFirstName] = useState('');
  const [gatePassword, setGatePassword] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const attribution = useMemo(
    () =>
      normalizeLandingAttribution({
        source,
        campaign,
        medium,
        adset,
        ad,
        roleIntent: 'seller',
        route: '/sell',
        landingPath: '/sell',
        referrer: typeof document === 'undefined' ? '' : document.referrer,
      }),
    [ad, adset, campaign, medium, source],
  );

  useEffect(() => {
    setAnonymousId(getOrCreateAnonymousId());
  }, []);

  useEffect(() => {
    if (!anonymousId) return;

    setStoredAttributionDraft({
      ...attribution,
      anonymousId,
      roleIntent: 'seller',
    });
  }, [anonymousId, attribution]);

  useEffect(() => {
    if (!anonymousId || !preview) return;

    setStoredAttributionDraft(
      {
        ...attribution,
        anonymousId,
        roleIntent: 'seller',
      },
      {
        previewReadyScore: preview.marketReadyScore,
        previewMidPrice: preview.estimatedRange?.mid,
      },
    );
  }, [anonymousId, attribution, preview]);

  useEffect(() => {
    trackLandingEvent({
      name: 'seller_landing_viewed',
      anonymousId,
      roleIntent: 'seller',
      ...attribution,
    }).catch(() => {});
  }, [anonymousId, attribution]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === 'state' ? normalizeState(value) : value,
    }));
  }

  function scrollToStart() {
    document.getElementById('seller-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openEmailGate() {
    setEmailGateOpen(true);
    trackLandingEvent({
      name: 'seller_email_gate_viewed',
      anonymousId,
      roleIntent: 'seller',
      ...attribution,
    }).catch(() => {});
  }

  async function handlePreviewSubmit(event) {
    event.preventDefault();
    setLoadingPreview(true);
    setToast(null);

    try {
      await trackLandingEvent({
        name: 'seller_preview_started',
        anonymousId,
        roleIntent: 'seller',
        ...attribution,
        payload: {
          propertyType: form.propertyType,
        },
      }).catch(() => {});

      const response = await getPublicSellerPreview({
        ...form,
        ...attribution,
        anonymousId,
      });
      setPreview(response);

      await trackLandingEvent({
        name: 'seller_preview_completed',
        anonymousId,
        roleIntent: 'seller',
        ...attribution,
        payload: {
          estimatedMid: response.estimatedRange?.mid,
          marketReadyScore: response.marketReadyScore,
        },
      }).catch(() => {});

      openEmailGate();
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not build preview',
        message: requestError.message,
      });
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleEmailGateSubmit(event) {
    event.preventDefault();

    if (!isValidEmail(gateEmail)) {
      setToast({
        tone: 'error',
        title: 'Valid email required',
        message: 'Enter a valid email so we can create your seller workspace.',
      });
      return;
    }

    if (gatePassword.trim().length < 8) {
      setToast({
        tone: 'error',
        title: 'Password too short',
        message: 'Use at least 8 characters for the account password.',
      });
      return;
    }

    setGateLoading(true);
    setToast(null);

    try {
      const previewContext = {
        ...form,
        preview,
      };

      await captureFunnelLead({
        email: gateEmail,
        anonymousId,
        roleIntent: 'seller',
        ...attribution,
        previewContext,
      });
      await trackLandingEvent({
        name: 'seller_email_submitted',
        anonymousId,
        roleIntent: 'seller',
        ...attribution,
        payload: {
          address: form.address,
          postalCode: form.postalCode,
        },
      }).catch(() => {});
      trackMetaPixelEvent(
        'Lead',
        {
          content_name: 'Seller email gate',
          content_category: 'seller_landing',
          role_intent: 'seller',
          source: attribution.source,
          campaign: attribution.campaign,
          medium: attribution.medium,
          adset: attribution.adset,
          ad: attribution.ad,
        },
        {
          eventId: `seller_email_submitted_${anonymousId || gateEmail}`,
        },
      );

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          SELLER_LANDING_DRAFT_KEY,
          JSON.stringify({
            title: form.address,
            addressLine1: form.address,
            city: form.city,
            state: form.state,
            zip: form.postalCode,
            propertyType: form.propertyType,
            bedrooms: Number(form.bedrooms),
            bathrooms: Number(form.bathrooms),
            squareFeet: Number(form.squareFeet),
            preview,
            attribution: {
              ...attribution,
              anonymousId,
              previewReadyScore: preview?.marketReadyScore || 0,
              previewMidPrice: preview?.estimatedRange?.mid || 0,
            },
          }),
        );
      }

      const continuation = await continuePublicSignup({
        email: gateEmail,
        anonymousId,
        roleIntent: 'seller',
        ...attribution,
        previewContext,
      });
      const nextPath = new URL(continuation.nextPath, window.location.origin);
      nextPath.searchParams.set('firstName', gateFirstName);
      nextPath.searchParams.set('prefillPassword', gatePassword);

      router.push(nextPath.pathname + nextPath.search);
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not continue',
        message: requestError.message,
      });
    } finally {
      setGateLoading(false);
    }
  }

  return (
    <>
      <Toast
        tone={toast?.tone}
        title={toast?.title}
        message={toast?.message}
        onClose={() => setToast(null)}
      />

      <section className="marketing-hero marketing-hero-seller">
        <div className="marketing-hero-copy">
          <span className="hero-kicker">For home sellers</span>
          <h1>Sell your home with a smarter prep plan.</h1>
          <p>Get pricing guidance, prep priorities, photo feedback, and local provider help before you list.</p>
          <div className="cta-row">
            <button type="button" className="button-primary" onClick={scrollToStart}>
              Start My Seller Plan
            </button>
            <a className="button-secondary" href="#seller-outputs">
              See Example Report
            </a>
          </div>
        </div>
        <div className="marketing-hero-visual" aria-label="Workside seller dashboard preview">
          <img src="/marketing/seller-prep-before-list.png" alt="Workside Home Advisor seller dashboard mockup" />
        </div>
      </section>

      <section className="marketing-flow" aria-label="Simple selling plan flow">
        {[
          ['Enter Your Property', 'Address + basic details'],
          ['Get Your Prep Plan', 'Pricing range, photo readiness, checklist'],
          ['List With Confidence', 'Reports, flyers, providers, marketing'],
        ].map(([title, body], index) => (
          <article key={title} className="marketing-flow-step">
            <FlowIcon index={index + 1} />
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section id="seller-outputs" className="marketing-output-section">
        <div className="marketing-section-heading">
          <span className="label">Outputs</span>
          <h2>Everything you need before the listing conversation.</h2>
        </div>
        <div className="marketing-output-grid">
          {SELLER_OUTPUTS.map(([title, body]) => (
            <article key={title} className="marketing-output-card">
              <span className="marketing-output-mark" aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-trust-row" aria-label="Trust signals">
        {TRUST_ITEMS.map((item) => (
          <div key={item}>
            <span aria-hidden="true" />
            <strong>{item}</strong>
          </div>
        ))}
      </section>

      <section id="seller-start" className="marketing-start-panel">
        <div>
          <span className="label">Start</span>
          <h2>Enter your address and create your seller workspace.</h2>
        </div>
        <form className="landing-onboarding-form" onSubmit={handlePreviewSubmit}>
          <label>
            Property address
            <input
              type="text"
              value={form.address}
              onChange={(event) => updateField('address', event.target.value)}
              placeholder="8612 Mainsail Drive"
              autoComplete="street-address"
            />
          </label>
          <div className="split-fields">
            <label>
              City
              <input
                type="text"
                value={form.city}
                onChange={(event) => updateField('city', event.target.value)}
                placeholder="Bakersfield"
                autoComplete="address-level2"
              />
            </label>
            <label>
              State
              <input
                type="text"
                value={form.state}
                onChange={(event) => updateField('state', event.target.value)}
                placeholder="CA"
                autoComplete="address-level1"
              />
            </label>
            <label>
              ZIP
              <input
                type="text"
                value={form.postalCode}
                onChange={(event) => updateField('postalCode', event.target.value)}
                placeholder="93312"
                autoComplete="postal-code"
              />
            </label>
          </div>
          <div className="split-fields split-fields-four">
            <label>
              Property type
              <select
                value={form.propertyType}
                onChange={(event) => updateField('propertyType', event.target.value)}
              >
                <option value="single_family">Single-family</option>
                <option value="condo">Condo</option>
                <option value="townhome">Townhome</option>
                <option value="multi_family">Multi-family</option>
              </select>
            </label>
            <label>
              Beds
              <input
                type="number"
                min="0"
                max="12"
                value={form.bedrooms}
                onChange={(event) => updateField('bedrooms', Number(event.target.value))}
              />
            </label>
            <label>
              Baths
              <input
                type="number"
                min="0"
                max="12"
                step="0.5"
                value={form.bathrooms}
                onChange={(event) => updateField('bathrooms', Number(event.target.value))}
              />
            </label>
            <label>
              Square feet
              <input
                type="number"
                min="400"
                max="20000"
                value={form.squareFeet}
                onChange={(event) => updateField('squareFeet', Number(event.target.value))}
              />
            </label>
          </div>
          <button type="submit" className="button-primary" disabled={loadingPreview}>
            {loadingPreview ? 'Creating plan...' : 'Start your selling plan in minutes'}
          </button>
        </form>
      </section>

      <section className="marketing-final-band">
        <h2>Start your selling plan in minutes.</h2>
        <button type="button" className="button-primary" onClick={scrollToStart}>
          Start My Seller Plan
        </button>
      </section>

      <EmailGateModal
        open={emailGateOpen}
        email={gateEmail}
        setEmail={setGateEmail}
        firstName={gateFirstName}
        setFirstName={setGateFirstName}
        password={gatePassword}
        setPassword={setGatePassword}
        loading={gateLoading}
        onClose={() => setEmailGateOpen(false)}
        onSubmit={handleEmailGateSubmit}
      />
    </>
  );
}

