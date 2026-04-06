import puppeteer from 'puppeteer';
import { BRANDING } from '@workside/branding';
import { formatCurrency } from '@workside/utils';

import { env } from '../../config/env.js';

const SUPPORT_EMAIL = BRANDING.supportEmail;
const PUBLIC_WEB_URL = BRANDING.publicWebUrl || String(env.PUBLIC_WEB_URL || 'https://worksideadvisor.com');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateLabel(value = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function formatMetricValue(value, fallback = 'Unavailable') {
  return value || value === 0 ? escapeHtml(value) : fallback;
}

function buildPropertyAddress(property) {
  return [property?.addressLine1, property?.city, property?.state, property?.zip]
    .filter(Boolean)
    .join(', ');
}

function buildComparableMapImageUrl(property, comps = []) {
  const propertyQuery = buildPropertyAddress(property);
  if (!propertyQuery || !env.GOOGLE_MAPS_SERVER_API_KEY) {
    return '';
  }

  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('key', env.GOOGLE_MAPS_SERVER_API_KEY);
  url.searchParams.set('size', '1400x900');
  url.searchParams.set('scale', '2');
  url.searchParams.set('maptype', 'roadmap');
  url.searchParams.append('markers', `color:0xc87447|label:S|${propertyQuery}`);
  url.searchParams.append('visible', propertyQuery);

  comps.slice(0, 6).forEach((comp, index) => {
    if (!comp?.address) {
      return;
    }
    const label = String.fromCharCode(65 + index);
    url.searchParams.append('markers', `color:0x4f7b62|label:${label}|${comp.address}`);
    url.searchParams.append('visible', comp.address);
  });

  return url.toString();
}

function buildNeighborhoodMapImageUrl(property) {
  const propertyQuery = buildPropertyAddress(property);
  if (!propertyQuery || !env.GOOGLE_MAPS_SERVER_API_KEY) {
    return '';
  }

  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('key', env.GOOGLE_MAPS_SERVER_API_KEY);
  url.searchParams.set('size', '1400x900');
  url.searchParams.set('scale', '2');
  url.searchParams.set('maptype', 'roadmap');
  url.searchParams.append('markers', `color:0xc87447|label:H|${propertyQuery}`);
  url.searchParams.append('visible', propertyQuery);
  return url.toString();
}

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }
    return !['--', '—', 'pending', 'risk pending', 'opportunity pending'].includes(trimmed.toLowerCase());
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulValue(item));
  }

  return true;
}

function titleCaseLabel(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatPercentValue(value, digits = 0) {
  if (!hasMeaningfulValue(value) && value !== 0) {
    return '';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  return `${numeric.toFixed(digits)}%`;
}

function formatSqftValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return `${numeric.toLocaleString('en-US')} sqft`;
}

function formatDistanceMiles(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return `${numeric.toFixed(numeric < 10 ? 2 : 1)} mi`;
}

function formatPropertyTypeLabel(value) {
  if (!hasMeaningfulValue(value)) {
    return '';
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'single_family') {
    return 'Single-family home';
  }
  return titleCaseLabel(normalized);
}

function formatCompactNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  return numeric.toLocaleString('en-US');
}

function pickMeaningfulLines(items = [], limit = 5) {
  return (items || [])
    .flat()
    .map((item) => String(item ?? '').trim())
    .filter((item) => hasMeaningfulValue(item))
    .slice(0, limit);
}

function getReadinessTone({ score, label }) {
  const normalizedLabel = String(label || '').toLowerCase();
  const numericScore = Number(score || 0);
  if (normalizedLabel.includes('ready') && !normalizedLabel.includes('almost')) {
    return 'ready';
  }
  if (normalizedLabel.includes('almost') || numericScore >= 70) {
    return 'almost';
  }
  return 'needs-work';
}

function renderMetricCard(label, value, support = '', tone = 'default') {
  return `
    <div class="metric-card metric-card-${escapeHtml(tone)}">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${formatMetricValue(value)}</div>
      ${support ? `<div class="metric-support">${escapeHtml(support)}</div>` : ''}
    </div>
  `;
}

function renderBulletList(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<p class="muted">${escapeHtml(emptyText)}</p>` : '';
  }

  return `
    <ul class="bullet-list">
      ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

function renderPhotoTiles(photos = [], limit = 4) {
  const selected = photos.filter((photo) => photo?.imageUrl).slice(0, limit);
  if (!selected.length) {
    return `<div class="empty-card">No listing-ready photos selected yet.</div>`;
  }

  return `
    <div class="photo-grid">
      ${selected
        .map(
          (photo) => `
            <figure class="photo-tile">
              <img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(photo.roomLabel || 'Property photo')}" />
              <figcaption>
                <strong>${escapeHtml(photo.roomLabel || 'Property photo')}</strong>
                <span>${photo.usesPreferredVariant ? 'Preferred enhancement selected' : 'Original or current selection'}</span>
              </figcaption>
            </figure>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderProviderCards(items = []) {
  if (!items.length) {
    return `<div class="empty-card">Provider recommendations will appear here once nearby marketplace matches or saved local referrals are available.</div>`;
  }

  return `
    <div class="provider-grid">
      ${items
        .map(
          (provider) => `
            <article class="provider-card">
              <div class="provider-category">${escapeHtml(provider.categoryLabel || 'Provider')}</div>
              <h4>${escapeHtml(provider.businessName || 'Provider recommendation')}</h4>
              <p class="provider-reason">${escapeHtml(provider.reason || provider.coverageLabel || '')}</p>
              <div class="provider-meta">
                ${provider.coverageLabel ? `<span>${escapeHtml(provider.coverageLabel)}</span>` : ''}
                ${provider.turnaroundLabel ? `<span>${escapeHtml(provider.turnaroundLabel)}</span>` : ''}
                ${provider.pricingSummary ? `<span>${escapeHtml(provider.pricingSummary)}</span>` : ''}
              </div>
              <div class="provider-contact">
                ${provider.phone ? `<span>${escapeHtml(provider.phone)}</span>` : ''}
                ${provider.email ? `<span>${escapeHtml(provider.email)}</span>` : ''}
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderCompRows(comps = []) {
  if (!comps.length) {
    return '';
  }

  const comparableRows = comps.slice(0, 6);
  const pricePerSqftValues = comparableRows
    .map((comp) => {
      const price = Number(comp.price || 0);
      const sqft = Number(comp.sqft || 0);
      return price > 0 && sqft > 0 ? price / sqft : null;
    })
    .filter((value) => Number.isFinite(value));
  const medianPrice = comparableRows
    .map((comp) => Number(comp.price || 0))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  const medianPriceValue = medianPrice.length ? medianPrice[Math.floor(medianPrice.length / 2)] : null;
  const medianPpsf = pricePerSqftValues.length
    ? pricePerSqftValues.sort((left, right) => left - right)[Math.floor(pricePerSqftValues.length / 2)]
    : null;
  const closestComp = comparableRows
    .map((comp) => ({ ...comp, _distance: Number(comp.distanceMiles || Number.POSITIVE_INFINITY) }))
    .sort((left, right) => left._distance - right._distance)[0];

  return `
    <div class="comp-summary-row">
      ${medianPriceValue ? `<div class="badge">Median comp price ${escapeHtml(formatCurrency(medianPriceValue))}</div>` : ''}
      ${medianPpsf ? `<div class="badge">Median ${escapeHtml(formatCurrency(Math.round(medianPpsf)))}/sqft</div>` : ''}
      ${closestComp?._distance && Number.isFinite(closestComp._distance) ? `<div class="badge">Closest comp ${escapeHtml(formatDistanceMiles(closestComp._distance))}</div>` : ''}
      <div class="badge">${escapeHtml(`${comparableRows.length} selected comps`)}</div>
    </div>
    <div class="comp-table">
      <div class="comp-table-head">
        <span>Comp</span>
        <span>Price</span>
        <span>Details</span>
        <span>Distance</span>
      </div>
      ${comparableRows
        .map(
          (comp, index) => `
            <div class="comp-row ${index % 2 === 1 ? 'comp-row-alt' : ''}">
              <div>
                <strong>${String.fromCharCode(65 + index)}. ${escapeHtml(comp.address || 'Comparable property')}</strong>
                <div class="muted">${escapeHtml(comp.soldDate || comp.listedDate || 'Recent nearby comparable')}</div>
              </div>
              <div><strong>${escapeHtml(formatCurrency(comp.price || 0))}</strong></div>
              <div class="muted">${escapeHtml(
                pickMeaningfulLines([
                  `${comp.beds || ''} bd`,
                  `${comp.baths || ''} ba`,
                  formatSqftValue(comp.sqft),
                  Number(comp.price || 0) > 0 && Number(comp.sqft || 0) > 0
                    ? `${formatCurrency(Math.round(Number(comp.price) / Number(comp.sqft)))}/sqft`
                    : '',
                ]).join(' • '),
              )}</div>
              <div class="muted"><strong>${escapeHtml(formatDistanceMiles(comp.distanceMiles) || 'Local')}</strong></div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderFooter(pageLabel) {
  return `
    <footer class="page-footer">
      <div>
        <strong>Workside Home Advisor</strong><br/>
        ${escapeHtml(PUBLIC_WEB_URL)}
      </div>
      <div>
        ${escapeHtml(SUPPORT_EMAIL)}<br/>
        ${escapeHtml(pageLabel)}
      </div>
    </footer>
  `;
}

function buildDefaultLaunchChecklist({ checklistSummary, photoSummary, improvementItems = [], hasSelectedPrice }) {
  const steps = [];
  if (Number(photoSummary?.retakeCount || 0) > 0) {
    steps.push('Complete the highest-priority photo retakes.');
  }
  if (Number(checklistSummary?.openCount || 0) > 0) {
    steps.push('Finish the remaining open checklist items.');
  }
  if (improvementItems[0]) {
    steps.push(`Address the top preparation issue: ${improvementItems[0]}.`);
  }
  steps.push(hasSelectedPrice ? 'Confirm the selected launch price and buyer-facing positioning.' : 'Review pricing and confirm the launch position.');
  steps.push('Prepare the brochure, report, and showing assets for launch.');
  return steps.slice(0, 5);
}

function buildNeighborhoodContext(property) {
  const city = property?.city ? titleCaseLabel(property.city) : 'the surrounding area';
  return [
    `Located in ${city}, this home benefits from an established residential setting that supports everyday convenience and buyer comfort.`,
    'The surrounding neighborhood context helps reinforce move-in appeal, practical livability, and a stronger showing experience.',
  ].join(' ');
}

function renderHtmlDocument({ title, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: Letter; margin: 0; }
      :root {
        color-scheme: light;
        --ink: #1d2a2f;
        --muted: #5e6d6b;
        --line: #d8d6cc;
        --card: #fffdfa;
        --soft: #f6f3ea;
        --accent: #c87447;
        --accent-soft: #f2d6c2;
        --moss: #4f7b62;
        --moss-soft: #dce8df;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Aptos", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: #f4efe5;
      }
      .page {
        width: 8.5in;
        min-height: 11in;
        padding: 0.55in 0.58in 0.6in;
        background:
          radial-gradient(circle at top right, rgba(200,116,71,0.12), transparent 36%),
          linear-gradient(180deg, #fffdf8 0%, #f8f4ea 100%);
        position: relative;
        page-break-after: always;
      }
      .page:last-child { page-break-after: auto; }
      .hero-page { display: grid; grid-template-columns: 1.12fr 0.88fr; gap: 22px; }
      .brand-kicker, .section-kicker {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 10px;
        color: var(--moss);
      }
      h1, h2, h3, h4, p { margin: 0; }
      h1 { font-family: Georgia, "Times New Roman", serif; font-size: 34px; line-height: 1.05; margin-top: 10px; }
      h2 { font-family: Georgia, "Times New Roman", serif; font-size: 28px; line-height: 1.1; margin-bottom: 8px; }
      h3 { font-size: 19px; margin-bottom: 8px; }
      h4 { font-size: 15px; margin-bottom: 6px; }
      .lede { font-size: 15px; line-height: 1.65; color: var(--muted); }
      .muted { color: var(--muted); font-size: 13px; line-height: 1.55; }
      .hero-photo, .map-frame {
        width: 100%;
        border-radius: 22px;
        overflow: hidden;
        border: 1px solid var(--line);
        background: #f3efe4;
      }
      .hero-photo img, .map-frame img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }
      .hero-photo { min-height: 280px; }
      .map-frame { min-height: 280px; }
      .summary-grid, .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
      .metric-card, .content-card, .sidebar-card, .provider-card, .feature-pill, .empty-card {
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.88);
        border-radius: 18px;
      }
      .metric-card, .content-card, .sidebar-card, .provider-card, .feature-pill, .empty-card,
      .cta-band, .hero-photo, .map-frame, .photo-grid, .gallery-strip, .two-col, .summary-grid,
      .metric-grid, .marketing-cover-grid, .marketing-metrics, .action-card {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .metric-card { padding: 14px 16px; }
      .metric-card-ready { border-color: rgba(79,123,98,0.35); background: rgba(244,251,246,0.96); }
      .metric-card-almost { border-color: rgba(200,116,71,0.35); background: rgba(255,249,243,0.97); }
      .metric-card-needs-work { border-color: rgba(176,108,99,0.34); background: rgba(255,246,245,0.97); }
      .metric-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 8px; }
      .metric-value { font-size: 22px; font-weight: 700; }
      .metric-support { margin-top: 8px; font-size: 12px; color: var(--muted); line-height: 1.4; }
      .section-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 18px; margin-top: 18px; }
      .content-card, .sidebar-card { padding: 18px 20px; }
      .section-stack { display: flex; flex-direction: column; gap: 18px; }
      .bullet-list { margin: 10px 0 0; padding-left: 18px; }
      .bullet-list li { margin: 0 0 8px; color: var(--muted); line-height: 1.5; }
      .feature-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .feature-pill { padding: 10px 12px; font-size: 12px; color: var(--ink); background: rgba(255,255,255,0.78); }
      .photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .photo-tile { margin: 0; border: 1px solid var(--line); background: rgba(255,255,255,0.88); border-radius: 18px; overflow: hidden; }
      .photo-tile img { width: 100%; height: 190px; display: block; object-fit: cover; }
      .photo-tile figcaption { padding: 12px 14px 14px; display: grid; gap: 4px; }
      .photo-tile figcaption strong { font-size: 14px; }
      .photo-tile figcaption span { font-size: 12px; color: var(--muted); }
      .provider-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .provider-card { padding: 16px; }
      .provider-category { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 8px; }
      .provider-reason { font-size: 13px; color: var(--muted); line-height: 1.5; min-height: 54px; }
      .provider-meta, .provider-contact { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 10px; font-size: 12px; color: var(--muted); }
      .comp-table { display: grid; gap: 10px; }
      .comp-summary-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
      .comp-table-head, .comp-row { display: grid; grid-template-columns: 1.3fr 0.55fr 1fr 0.45fr; gap: 14px; align-items: start; }
      .comp-table-head { padding: 0 4px; text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); }
      .comp-row { border: 1px solid var(--line); background: rgba(255,255,255,0.88); border-radius: 18px; padding: 14px 16px; }
      .comp-row-alt { background: rgba(252,250,245,0.95); }
      .page-footer {
        position: absolute;
        left: 0.58in;
        right: 0.58in;
        bottom: 0.34in;
        padding-top: 12px;
        border-top: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        gap: 20px;
        font-size: 11px;
        color: var(--muted);
      }
      .brand-bar { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 20px; }
      .empty-card { padding: 18px; color: var(--muted); font-size: 13px; }
      .cta-band {
        margin-top: 18px;
        padding: 18px 20px;
        border-radius: 20px;
        background: linear-gradient(135deg, rgba(200,116,71,0.14), rgba(79,123,98,0.08));
        border: 1px solid rgba(200,116,71,0.24);
      }
      .cta-label {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--accent);
        background: rgba(200,116,71,0.12);
        margin-bottom: 10px;
      }
      .single-column { display: grid; gap: 18px; }
      .marketing-cover-grid { display: grid; grid-template-columns: 1.02fr 0.98fr; gap: 18px; margin-top: 24px; align-items: start; }
      .marketing-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .action-card {
        margin-top: 14px;
        padding: 18px 20px;
        border-radius: 18px;
        border: 1px solid rgba(79,123,98,0.2);
        background: rgba(255,255,255,0.9);
      }
      .gallery-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .gallery-strip img {
        width: 100%;
        height: 150px;
        object-fit: cover;
        display: block;
        border-radius: 16px;
        border: 1px solid var(--line);
      }
      .two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
      .map-frame.compact { min-height: 220px; }
      .badge-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .badge { padding: 8px 12px; border-radius: 999px; background: var(--moss-soft); color: var(--moss); font-size: 12px; font-weight: 600; }
      .kpi-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 22px; }
      .executive-summary-shell { display: grid; gap: 18px; margin-top: 18px; }
      .executive-callouts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .callout-chip { border: 1px solid var(--line); background: rgba(255,255,255,0.9); border-radius: 18px; padding: 14px 16px; }
      .callout-chip strong { display: block; margin-top: 6px; font-size: 14px; }
      .fact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
      .fact-row { border: 1px solid var(--line); background: rgba(255,255,255,0.9); border-radius: 16px; padding: 12px 14px; }
      .fact-row-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 6px; }
      .section-intro { margin-top: 6px; max-width: 6.2in; }
      .cover-price-badge { display: inline-flex; align-items: center; gap: 10px; margin-top: 16px; padding: 10px 14px; border-radius: 999px; background: rgba(79,123,98,0.14); color: var(--moss); font-weight: 700; }
      .marketing-hero-copy { display: grid; gap: 14px; }
      .brochure-bottom-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 18px; margin-top: 18px; }
      .highlight-list li { margin-bottom: 10px; }
      .gallery-strip.two-up { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .compact-copy { font-size: 13px; line-height: 1.6; color: var(--muted); }
      .page-spacer { height: 14px; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function buildPropertySummaryHtml({ property, report }) {
  const photoSummary = report.payload?.photoSummary || {};
  const readinessSummary = report.payload?.readinessSummary || {};
  const propertyDetails = report.payload?.propertyDetails || {};
  const providerRecommendations = report.payload?.providerRecommendations || [];
  const nextSteps = report.payload?.nextSteps || [];
  const riskOpportunity = report.payload?.riskOpportunity || {};
  const improvementEconomics = report.payload?.improvementEconomics || {};
  const buyerPersonaSummary = report.payload?.buyerPersonaSummary || {};
  const checklistSummary = report.payload?.checklistSummary || {};
  const compMapImageUrl = buildComparableMapImageUrl(property, report.selectedComps || []);
  const heroPhoto = report.selectedPhotos?.[0];
  const remainingPhotos = (report.selectedPhotos || []).slice(1);
  const featureTags = pickMeaningfulLines(propertyDetails.featureTags || [], 6);
  const topReasonsToBuy = pickMeaningfulLines(buyerPersonaSummary.topReasonsToBuy || [], 5);
  const executiveSummaryText = hasMeaningfulValue(report.executiveSummary)
    ? report.executiveSummary
    : `${property.title || 'This property'} is currently positioned at ${readinessSummary.overallScore || 0}/100 readiness with the strongest opportunity centered on listing preparation and buyer-facing presentation.`;
  const summaryOpportunity = hasMeaningfulValue(riskOpportunity.biggestOpportunity)
    ? riskOpportunity.biggestOpportunity
    : pickMeaningfulLines(report.improvementItems || [], 1)[0] || 'Strengthen buyer confidence with final prep, pricing, and presentation decisions.';
  const summaryRisk = hasMeaningfulValue(riskOpportunity.biggestRisk)
    ? riskOpportunity.biggestRisk
    : Number(photoSummary.retakeCount || 0) > 0
      ? `${photoSummary.retakeCount} listing photo retake${Number(photoSummary.retakeCount || 0) === 1 ? '' : 's'} remain open.`
      : 'No single launch risk currently dominates the report.';
  const economicsSummary = hasMeaningfulValue(improvementEconomics.summary)
    ? improvementEconomics.summary
    : pickMeaningfulLines([
        improvementEconomics.estimatedCost ? `Estimated prep investment ${formatCurrency(improvementEconomics.estimatedCost)}.` : '',
        improvementEconomics.estimatedRoi ? `Potential value protection ${formatCurrency(improvementEconomics.estimatedRoi)}.` : '',
      ], 2).join(' ');
  const pricingNarrative = hasMeaningfulValue(report.pricingSummary?.narrative)
    ? report.pricingSummary.narrative
    : 'Pricing guidance is based on the latest comparable sales, home condition, and current market readiness signals.';
  const marketingMomentum = pickMeaningfulLines(report.marketingHighlights || [], 5);
  const orderedNextSteps = nextSteps.length
    ? nextSteps.map((step) => `${step.title}${step.eta ? ` · ${step.eta}` : ''}${step.owner ? ` · ${step.owner}` : ''}`)
    : buildDefaultLaunchChecklist({
        checklistSummary,
        photoSummary,
        improvementItems: report.improvementItems || [],
        hasSelectedPrice: Boolean(property?.selectedListPrice),
      });
  const propertyFacts = [
    { label: 'Address', value: buildPropertyAddress(property) },
    { label: 'Home type', value: formatPropertyTypeLabel(property?.propertyType) },
    { label: 'Bedrooms', value: hasMeaningfulValue(propertyDetails.bedrooms || property?.bedrooms) ? String(propertyDetails.bedrooms || property?.bedrooms) : '' },
    { label: 'Bathrooms', value: hasMeaningfulValue(propertyDetails.bathrooms || property?.bathrooms) ? String(propertyDetails.bathrooms || property?.bathrooms) : '' },
    { label: 'Interior', value: formatSqftValue(propertyDetails.squareFeet || property?.squareFeet) },
    { label: 'Lot size', value: formatSqftValue(propertyDetails.lotSizeSqFt || property?.lotSizeSqFt) },
    { label: 'Year built', value: hasMeaningfulValue(propertyDetails.yearBuilt || property?.yearBuilt) ? String(propertyDetails.yearBuilt || property?.yearBuilt) : '' },
  ].filter((fact) => hasMeaningfulValue(fact.value));
  const shouldRenderCompMap = Boolean(compMapImageUrl && (report.selectedComps || []).length);
  const shouldRenderProviders = providerRecommendations.length > 0;
  const shouldRenderBuyerPersona = hasMeaningfulValue(buyerPersonaSummary.buyerPersona) || topReasonsToBuy.length > 0;

  const body = `
    <section class="page hero-page">
      <div>
        <div class="brand-kicker">Workside Home Advisor · Seller Intelligence Report</div>
        <h1>${escapeHtml(report.title || property.title || 'Property Summary Report')}</h1>
        <p class="lede section-intro" style="margin-top:12px;">${escapeHtml(executiveSummaryText)}</p>
        <div class="kpi-strip">
          ${renderMetricCard('Readiness score', `${readinessSummary.overallScore || 0}/100`, readinessSummary.label || 'Needs work', getReadinessTone({ score: readinessSummary.overallScore, label: readinessSummary.label }))}
          ${renderMetricCard('Selected price', property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set', report.pricingSummary?.mid ? `Suggested midpoint ${formatCurrency(report.pricingSummary.mid)}` : 'Pricing guidance available below')}
          ${renderMetricCard('Photo coverage', `${photoSummary.roomCoverageCount || 0}/5 rooms`, `${photoSummary.listingCandidateCount || 0} listing-ready · ${photoSummary.retakeCount || 0} retakes`)}
          ${renderMetricCard('Checklist progress', `${checklistSummary.progressPercent || 0}%`, `${checklistSummary.completedCount || 0} complete · ${checklistSummary.openCount || 0} open`)}
        </div>
        <div class="executive-summary-shell">
          <div class="executive-callouts">
            <div class="callout-chip">
              <div class="metric-label">Top opportunity</div>
              <strong>${escapeHtml(summaryOpportunity)}</strong>
            </div>
            <div class="callout-chip">
              <div class="metric-label">Top risk</div>
              <strong>${escapeHtml(summaryRisk)}</strong>
            </div>
            <div class="callout-chip">
              <div class="metric-label">Value protection</div>
              <strong>${escapeHtml(economicsSummary || 'Use this report to coordinate a confident, disciplined launch.')}</strong>
            </div>
          </div>
          <div class="cta-band">
            <div class="cta-label">Report date</div>
            <p class="lede">${escapeHtml(formatDateLabel(report.updatedAt || report.createdAt || new Date()))}</p>
            ${renderBulletList(
              pickMeaningfulLines([
                report.payload?.improvementGuidance?.summary,
                ...(report.improvementItems || []).slice(0, 3),
              ], 4),
              'Use the guided workflow to continue improving readiness and launch confidence.',
            )}
          </div>
        </div>
      </div>
      <div>
        <div class="hero-photo">
          ${heroPhoto?.imageUrl ? `<img src="${escapeHtml(heroPhoto.imageUrl)}" alt="${escapeHtml(heroPhoto.roomLabel || 'Property photo')}" />` : ''}
        </div>
        <p class="muted" style="margin-top:10px;">${escapeHtml(buildPropertyAddress(property))}</p>
        <div class="feature-grid">
          ${featureTags.map((tag) => `<div class="feature-pill">${escapeHtml(tag)}</div>`).join('')}
        </div>
      </div>
      ${renderFooter('Property Summary Report · Cover')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Pricing analysis</div>
          <h2>Pricing, positioning, and comparable sales</h2>
          <p class="muted">Suggested range, chosen list price, pricing narrative, and comparable market context.</p>
        </div>
      </div>
      <div class="metric-grid">
        ${renderMetricCard('Suggested range', report.pricingSummary?.low && report.pricingSummary?.high ? `${formatCurrency(report.pricingSummary.low)} - ${formatCurrency(report.pricingSummary.high)}` : 'Unavailable', report.pricingSummary?.strategy || 'Market-aligned pricing recommendation')}
        ${renderMetricCard('Midpoint', report.pricingSummary?.mid ? formatCurrency(report.pricingSummary.mid) : 'Unavailable', report.pricingSummary?.confidence ? `${Math.round(report.pricingSummary.confidence * 100)}% confidence` : 'Confidence score not available')}
        ${renderMetricCard('Chosen price', property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set', property?.selectedListPrice ? 'Seller-confirmed' : 'Set in pricing tab')}
        ${renderMetricCard('Selected comps', String((report.selectedComps || []).length), 'Top market references included')}
      </div>
      <div class="section-grid">
        ${shouldRenderCompMap ? `
          <div class="content-card">
            <div class="section-kicker">Comp map</div>
            <div class="map-frame" style="margin-top:12px;">
              <img src="${escapeHtml(compMapImageUrl)}" alt="Comparable properties map" />
            </div>
          </div>
        ` : ''}
        <div class="sidebar-card">
          <div class="section-kicker">Pricing rationale</div>
          <h3>${escapeHtml(report.payload?.listingDescriptions?.shortDescription || 'Pricing recommendation')}</h3>
          <p class="muted" style="margin-top:8px;">${escapeHtml(pricingNarrative)}</p>
          <div class="page-spacer"></div>
          <div class="section-kicker">Pricing callouts</div>
          <div class="badge-row">
            ${hasMeaningfulValue(riskOpportunity.biggestRisk) ? `<div class="badge">${escapeHtml(riskOpportunity.biggestRisk)}</div>` : ''}
            ${hasMeaningfulValue(riskOpportunity.biggestOpportunity) ? `<div class="badge">${escapeHtml(riskOpportunity.biggestOpportunity)}</div>` : ''}
            ${report.pricingSummary?.confidence ? `<div class="badge">${escapeHtml(`${Math.round(report.pricingSummary.confidence * 100)}% pricing confidence`)}</div>` : ''}
          </div>
        </div>
      </div>
      ${(report.selectedComps || []).length ? `
        <div class="content-card" style="margin-top:18px;">
          <div class="section-kicker">Comparable properties</div>
          <h3>Recent nearby comps</h3>
          <div class="page-spacer"></div>
          ${renderCompRows(report.selectedComps || [])}
        </div>
      ` : ''}
      ${renderFooter('Property Summary Report · Pricing & Comps')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Readiness and preparation</div>
          <h2>Photos, readiness, and prep recommendations</h2>
          <p class="muted">Listing-quality images, launch blockers, and estimated improvement economics.</p>
        </div>
      </div>
      <div class="section-grid">
        <div class="content-card">
          <div class="section-kicker">Selected photos</div>
          <h3>Photo review</h3>
          <div class="page-spacer"></div>
          ${renderPhotoTiles([heroPhoto, ...remainingPhotos].filter(Boolean), 4)}
        </div>
        <div class="section-stack">
          <div class="sidebar-card">
            <div class="section-kicker">Readiness score</div>
            <h3>${escapeHtml(readinessSummary.label || 'Needs Work')}</h3>
            <div class="metric-grid" style="grid-template-columns:repeat(2, minmax(0,1fr)); margin-top:12px;">
              ${renderMetricCard('Overall', `${readinessSummary.overallScore || 0}/100`)}
              ${renderMetricCard('Photo quality', `${photoSummary.averageQualityScore || 0}/100`)}
              ${renderMetricCard('Retakes', String(photoSummary.retakeCount || 0))}
              ${renderMetricCard('Open items', String(checklistSummary.openCount || 0))}
            </div>
          </div>
          <div class="sidebar-card">
            <div class="section-kicker">Preparation recommendations</div>
            <h3>Highest-impact improvements</h3>
            ${renderBulletList(pickMeaningfulLines(report.improvementItems || [], 5), 'Use the checklist and photo review to identify the next preparation priorities.')}
          </div>
          <div class="sidebar-card">
            <div class="section-kicker">Cost and ROI</div>
            <h3>${escapeHtml(improvementEconomics.summary || 'Estimated prep investment and value-protection range')}</h3>
            <div class="badge-row">
              ${improvementEconomics.estimatedCost ? `<div class="badge">Est. cost ${escapeHtml(formatCurrency(improvementEconomics.estimatedCost))}</div>` : ''}
              ${improvementEconomics.estimatedRoi ? `<div class="badge">Potential ROI ${escapeHtml(formatCurrency(improvementEconomics.estimatedRoi))}</div>` : ''}
              ${improvementEconomics.estimatedCost && improvementEconomics.estimatedRoi ? `<div class="badge">${escapeHtml(`Potential upside ${formatCurrency(improvementEconomics.estimatedRoi)} vs. est. prep ${formatCurrency(improvementEconomics.estimatedCost)}`)}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
      ${renderFooter('Property Summary Report · Readiness & Preparation')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Action plan</div>
          <h2>Providers, next steps, and buyer fit</h2>
          <p class="muted">Use this page to coordinate launch support, sequence your next moves, and sharpen buyer-facing messaging.</p>
        </div>
      </div>
      <div class="two-col">
        ${propertyFacts.length ? `
        <div class="content-card">
          <div class="section-kicker">Property details</div>
          <h3>Core home facts</h3>
          <div class="fact-grid">
            ${propertyFacts
              .map(
                (fact) => `
                  <div class="fact-row">
                    <div class="fact-row-label">${escapeHtml(fact.label)}</div>
                    <div>${escapeHtml(fact.value)}</div>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
        ` : ''}
        ${shouldRenderBuyerPersona ? `
        <div class="content-card">
          <div class="section-kicker">Buyer persona</div>
          <h3>Who this home should resonate with</h3>
          <p class="muted" style="margin-top:8px;">${escapeHtml(buyerPersonaSummary.buyerPersona || 'This home should appeal to buyers seeking comfort, livability, and a well-positioned launch price.')}</p>
          <div class="page-spacer"></div>
          <div class="section-kicker">Top reasons to buy</div>
          ${renderBulletList(topReasonsToBuy, 'The strongest buyer reasons will appear here once pricing and marketing guidance are finalized.')}
        </div>
        ` : ''}
      </div>
      <div class="content-card" style="margin-top:18px;">
        <div class="section-kicker">Provider recommendations</div>
        <h3>Marketplace support nearby</h3>
        <div class="page-spacer"></div>
        ${shouldRenderProviders ? renderProviderCards(providerRecommendations) : `<p class="muted">Provider recommendations will appear here once local marketplace matches are available.</p>`}
      </div>
      <div class="two-col" style="margin-top:18px;">
        <div class="content-card">
          <div class="section-kicker">Next steps</div>
          <h3>Ordered launch plan</h3>
          ${renderBulletList(
            orderedNextSteps,
            'Use the guided workflow in the app to continue the launch checklist.',
          )}
        </div>
        <div class="content-card">
          <div class="section-kicker">Checklist and marketing</div>
          <h3>Current momentum</h3>
          ${renderBulletList(
            marketingMomentum.length
              ? marketingMomentum
              : pickMeaningfulLines([
                  checklistSummary.totalCount ? `${checklistSummary.completedCount || 0} of ${checklistSummary.totalCount} checklist items are complete.` : '',
                  photoSummary.summary,
                ], 4),
            'Current launch momentum will appear here as pricing, photos, and checklist steps are completed.',
          )}
        </div>
      </div>
      ${renderFooter('Property Summary Report · Action Plan')}
    </section>
  `;

  return renderHtmlDocument({
    title: report.title || property.title || 'Property Summary Report',
    body,
  });
}

function buildMarketingReportHtml({ property, flyer }) {
  const propertyAddress = buildPropertyAddress(property);
  const neighborhoodMapImageUrl = buildNeighborhoodMapImageUrl(property);
  const selectedPhotos = flyer.selectedPhotos || [];
  const heroPhoto = selectedPhotos[0];
  const galleryPhotos = selectedPhotos.slice(1, 5);
  const featureTags = pickMeaningfulLines(flyer.highlights || [], 6);
  const topReasonsToBuy = [
    ...(featureTags || []),
    property?.selectedListPrice ? `Positioned at ${formatCurrency(property.selectedListPrice)}` : '',
    buildNeighborhoodContext(property),
  ]
    .filter(Boolean)
    .slice(0, 6);
  const brochureSummary = hasMeaningfulValue(flyer.summary)
    ? flyer.summary
    : 'A buyer-facing brochure designed to spotlight the home’s strongest features, neighborhood appeal, and showing-ready presentation.';
  const lifestyleContext = buildNeighborhoodContext(property);
  const shouldRenderMapPage = Boolean(neighborhoodMapImageUrl && galleryPhotos.length >= 4);

  const body = `
    <section class="page hero-page">
      <div>
        <div class="brand-kicker">Workside Home Advisor · Marketing Report</div>
        <h1>${escapeHtml(flyer.headline || property.title || 'Marketing brochure')}</h1>
        <p class="lede section-intro" style="margin-top:14px;">${escapeHtml(flyer.subheadline || brochureSummary)}</p>
        <div class="cover-price-badge">${escapeHtml(flyer.priceText || 'Pricing on request')}</div>
        <div class="marketing-cover-grid">
          <div class="marketing-hero-copy">
            <div class="marketing-metrics">
              ${renderMetricCard('List price', flyer.priceText || 'Pricing on request', property?.selectedListPrice ? 'Seller-confirmed list position' : 'Market-aligned positioning')}
              ${renderMetricCard('Home details', `${property?.bedrooms || '--'} bd · ${property?.bathrooms || '--'} ba`, `${formatSqftValue(property?.squareFeet) || 'Residential home'} · ${formatPropertyTypeLabel(property?.propertyType) || 'Residential home'}`)}
              ${renderMetricCard('Location', property?.city || 'Property city', property?.state || '')}
            </div>
            <div class="feature-grid" style="margin-top:18px;">
              ${featureTags.map((tag) => `<div class="feature-pill">${escapeHtml(tag)}</div>`).join('')}
            </div>
            <div class="cta-band">
              <div class="cta-label">Property story</div>
              <p class="lede">${escapeHtml(brochureSummary)}</p>
            </div>
            <div class="action-card">
              <div class="section-kicker">Call to action</div>
              <h3 style="margin-top:8px;">${escapeHtml(flyer.callToAction || 'Schedule a showing or request the full property package.')}</h3>
              <p class="compact-copy" style="margin-top:10px;">Prepared by Workside Home Advisor to support a polished listing launch, clearer buyer positioning, and smoother showing conversations.</p>
              <div class="badge-row">
                <div class="badge">${escapeHtml(propertyAddress)}</div>
                <div class="badge">${escapeHtml(SUPPORT_EMAIL)}</div>
              </div>
            </div>
          </div>
          <div>
            <div class="hero-photo">
              ${heroPhoto?.imageUrl ? `<img src="${escapeHtml(heroPhoto.imageUrl)}" alt="${escapeHtml(heroPhoto.roomLabel || 'Hero property photo')}" />` : ''}
            </div>
            <p class="muted" style="margin-top:10px;">${escapeHtml(propertyAddress)}</p>
          </div>
        </div>
      </div>
      ${renderFooter('Marketing Report · Cover')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Conversion brochure</div>
          <h2>Highlights, gallery, and neighborhood context</h2>
          <p class="muted">A buyer-facing layout designed to support interest, clarity, and showing requests.</p>
        </div>
      </div>
      <div class="single-column">
        <div class="content-card">
          <div class="section-kicker">Photo gallery</div>
          <h3>Curated image sequence</h3>
          <div class="page-spacer"></div>
          ${
            galleryPhotos.length
              ? `
                <div class="gallery-strip ${galleryPhotos.length <= 2 ? 'two-up' : ''}">
                  ${galleryPhotos
                    .map(
                      (photo) =>
                        `<img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(photo.roomLabel || 'Gallery photo')}" />`,
                    )
                    .join('')}
                </div>
              `
              : `<div class="empty-card">More gallery-ready photos will appear here as the listing set is finalized.</div>`
          }
        </div>
        <div class="brochure-bottom-grid">
          <div class="content-card">
            <div class="section-kicker">Key features</div>
            <h3>Top reasons to buy</h3>
            <ul class="bullet-list highlight-list">
              ${topReasonsToBuy.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
          <div class="content-card">
            <div class="section-kicker">Pricing positioning</div>
            <h3>${escapeHtml(flyer.priceText || 'Pricing on request')}</h3>
            <p class="muted" style="margin-top:8px;">${escapeHtml(
              property?.selectedListPrice
                ? `Competitively positioned at ${formatCurrency(property.selectedListPrice)} to balance value perception and buyer demand.`
                : 'Positioned to align with recent comparable sales and current buyer demand.',
            )}</p>
            <div class="page-spacer"></div>
            <div class="section-kicker">Neighborhood context</div>
            <p class="compact-copy" style="margin-top:8px;">${escapeHtml(lifestyleContext)}</p>
            ${
              neighborhoodMapImageUrl
                ? `
                  <div class="map-frame compact" style="margin-top:14px;">
                    <img src="${escapeHtml(neighborhoodMapImageUrl)}" alt="Neighborhood map" />
                  </div>
                `
                : ''
            }
            <div class="page-spacer"></div>
            <div class="section-kicker">Call to action</div>
            <h3>${escapeHtml(flyer.callToAction || 'Schedule a showing')}</h3>
            <p class="muted" style="margin-top:8px;">Prepared by Workside Home Advisor to support listing-ready marketing collateral and brochure refinement.</p>
            <div class="badge-row">
              <div class="badge">${escapeHtml(propertyAddress)}</div>
              <div class="badge">${escapeHtml(SUPPORT_EMAIL)}</div>
            </div>
          </div>
        </div>
      </div>
      ${renderFooter('Marketing Report · Gallery & Conversion')}
    </section>

    ${
      shouldRenderMapPage
        ? `
          <section class="page">
            <div class="brand-bar">
              <div>
                <div class="section-kicker">Neighborhood and positioning</div>
                <h2>Local context and pricing posture</h2>
                <p class="muted">A cleaner neighborhood view and contact block designed for seller-facing brochure review.</p>
              </div>
            </div>
            <div class="two-col">
              <div class="content-card">
                <div class="section-kicker">Neighborhood</div>
                <h3>Local context</h3>
                <div class="map-frame compact" style="margin-top:12px;">
                  <img src="${escapeHtml(neighborhoodMapImageUrl)}" alt="Neighborhood map" />
                </div>
                <p class="muted" style="margin-top:10px;">${escapeHtml(propertyAddress)}</p>
              </div>
              <div class="content-card">
                <div class="section-kicker">Prepared for review</div>
                <h3>Marketing draft guidance</h3>
                <p class="muted" style="margin-top:8px;">This brochure is a branded marketing draft generated by Workside Home Advisor and should be reviewed before public distribution.</p>
                <div class="page-spacer"></div>
                <div class="section-kicker">Contact</div>
                <p class="muted" style="margin-top:8px;">${escapeHtml(SUPPORT_EMAIL)}</p>
                <p class="muted">${escapeHtml(PUBLIC_WEB_URL)}</p>
              </div>
            </div>
            ${renderFooter('Marketing Report · Neighborhood & Positioning')}
          </section>
        `
        : ''
    }
  `;

  return renderHtmlDocument({
    title: flyer.headline || property.title || 'Marketing Report',
    body,
  });
}

export async function renderPropertySummaryPdf({ property, report, filename }) {
  const html = buildPropertySummaryHtml({ property, report });
  return renderHtmlPdf({ html, filename });
}

export async function renderMarketingReportPdf({ property, flyer, filename }) {
  const html = buildMarketingReportHtml({ property, flyer });
  return renderHtmlPdf({ html, filename });
}

async function renderHtmlPdf({ html, filename }) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=medium',
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1660, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const bytes = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await page.close();
    return { bytes, filename };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
