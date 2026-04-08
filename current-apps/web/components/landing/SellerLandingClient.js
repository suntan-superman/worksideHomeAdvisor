'use client';

import Link from 'next/link';
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
import { EmailGateModal } from './EmailGateModal';
import { FinalCTASection } from './FinalCTASection';
import { HeroSection } from './HeroSection';
import { HowItWorksSection } from './HowItWorksSection';
import { MiniOnboardingCard } from './MiniOnboardingCard';
import { PricingTeaserSection } from './PricingTeaserSection';
import { ResultPreviewCard } from './ResultPreviewCard';
import { TrustSignalSection } from './TrustSignalSection';
import { ValueCardRow } from './ValueCardRow';
import { getSellerLandingVariant } from './copyVariants';

const SELLER_LANDING_DRAFT_KEY = 'worksideSellerLandingDraft';
const LANDING_ANONYMOUS_ID_KEY = 'worksideLandingAnonymousId';

function normalizeState(value) {
  return String(value || '').trim().toUpperCase().slice(0, 2);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getOrCreateAnonymousId() {
  if (typeof window === 'undefined') {
    return '';
  }

  const existingId = window.localStorage.getItem(LANDING_ANONYMOUS_ID_KEY);
  if (existingId) {
    return existingId;
  }

  const nextId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(LANDING_ANONYMOUS_ID_KEY, nextId);
  return nextId;
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

  const previewCategories = useMemo(
    () => preview?.previewProviderCategories || ['cleaners', 'photographers'],
    [preview?.previewProviderCategories],
  );
  const copyVariant = useMemo(
    () => getSellerLandingVariant({ source, campaign, medium }),
    [campaign, medium, source],
  );
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
    if (!anonymousId) {
      return;
    }

    setStoredAttributionDraft({
      ...attribution,
      anonymousId,
      roleIntent: 'seller',
    });
  }, [anonymousId, attribution]);

  useEffect(() => {
    if (!anonymousId || !preview) {
      return;
    }

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

  function openEmailGate() {
    setEmailGateOpen(true);
    trackLandingEvent({
      name: 'seller_email_gate_viewed',
      anonymousId,
      roleIntent: 'seller',
      ...attribution,
    }).catch(() => {});
  }

  async function handleEmailGateSubmit(event) {
    event.preventDefault();

    if (!isValidEmail(gateEmail)) {
      setToast({
        tone: 'error',
        title: 'Valid email required',
        message: 'Enter a valid email so we can carry your preview into the full plan.',
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

      <HeroSection
        eyebrow={copyVariant.heroEyebrow}
        title={copyVariant.heroTitle}
        subtitle={copyVariant.heroSubtitle}
        actions={
          <>
            <button type="button" className="button-primary" onClick={openEmailGate}>
              {copyVariant.primaryCta}
            </button>
            <a href="#sell-how-it-works" className="button-secondary">
              {copyVariant.secondaryCta}
            </a>
          </>
        }
        aside={
          <div className="landing-hero-metrics">
            <div className="landing-mini-panel">
              <span className="label">{copyVariant.heroPanelLabel}</span>
              <strong>{preview?.estimatedRange?.mid ? `Midpoint ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(preview.estimatedRange.mid)}` : 'Address to preview in under a minute'}</strong>
              <p>{copyVariant.heroPanelBody}</p>
            </div>
            <div className="landing-mini-panel">
              <span className="label">{copyVariant.themeEyebrow || 'Preview categories'}</span>
              <div className="tag-row">
                {(copyVariant.themePills || previewCategories).map((category) => (
                  <span key={category}>{category}</span>
                ))}
              </div>
            </div>
          </div>
        }
      />

      <ValueCardRow
        items={copyVariant.valueItems}
      />

      <MiniOnboardingCard
        title="Start with the property basics."
        subtitle="This is the first slice of the real workflow, not a dead-end marketing form."
        footer={<p>We only need enough detail to show a useful preview and create momentum.</p>}
      >
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
          <div className="landing-onboarding-actions">
            <button type="submit" className="button-primary" disabled={loadingPreview}>
              {loadingPreview ? 'Building preview...' : 'Preview my selling plan'}
            </button>
            <button type="button" className="button-secondary" onClick={openEmailGate}>
              Skip to signup
            </button>
          </div>
        </form>
      </MiniOnboardingCard>

      <ResultPreviewCard preview={preview} loading={loadingPreview} onUnlock={openEmailGate} />

      <section className="landing-slab landing-provider-support">
        <div className="landing-section-header">
          <span className="label">Provider support</span>
          <h2>We can bring local help into the plan once the property starts moving.</h2>
          <p>Photographers, cleaners, stagers, inspectors, and other prep categories can follow the same workflow instead of living in separate tabs and browser searches.</p>
        </div>
        <div className="tag-row">
          {['Cleaners', 'Photographers', 'Stagers', 'Landscapers', 'Inspectors', 'Handymen'].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <TrustSignalSection
        eyebrow="Trust"
        title="Built to guide real sellers, not just collect leads."
        body="Workside should feel credible before billing ever appears. Trust starts with clear workflow language, grounded provider framing, and honest visibility into what is self-reported versus verified."
        items={[
          {
            eyebrow: 'Homeowners',
            title: 'Built for people who have never sold before',
            body: 'The funnel starts with plain-language property questions and carries naturally into a guided workspace instead of dropping users into a complicated dashboard.',
          },
          {
            eyebrow: 'Providers',
            title: 'Provider trust is explicit, not implied',
            body: 'Profiles distinguish self-reported credentials from verified ones so sellers can see the difference before they request help.',
          },
          {
            eyebrow: 'Momentum',
            title: 'Partial value appears before signup',
            body: 'Price band, readiness, and first prep actions show up early so the user understands what the subscription is actually unlocking.',
          },
        ]}
      />

      <div id="sell-how-it-works">
        <HowItWorksSection
          steps={[
            {
              title: 'Enter the property basics',
              body: 'Start with the address and a few facts so Workside can frame the first decisions.',
            },
            {
              title: 'Get a partial result quickly',
              body: 'Show the price band, readiness signal, and first prep moves before forcing account creation.',
            },
            {
              title: 'Continue into the guided workspace',
              body: 'Verify your account, save the property, and unlock the full checklist, providers, and exports.',
            },
          ]}
        />
      </div>

      <PricingTeaserSection
        title={copyVariant.pricingTitle}
        body={copyVariant.pricingBody}
        bullets={copyVariant.pricingBullets}
        primaryHref="/auth?mode=signup&role=seller"
        primaryLabel="Create seller account"
        secondaryHref="/dashboard"
        secondaryLabel="View workspace preview"
      />

      <FinalCTASection
        title={copyVariant.finalTitle}
        body={copyVariant.finalBody}
        primaryHref="/auth?mode=signup&role=seller"
        primaryLabel={copyVariant.primaryCta}
        secondaryHref="/dashboard"
        secondaryLabel="See the seller dashboard"
      />

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
