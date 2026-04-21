import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { BRANDING } from '@workside/branding';
import { formatCurrency } from '@workside/utils';

import { env } from '../../config/env.js';

const SUPPORT_EMAIL = BRANDING.supportEmail;
const RAW_PUBLIC_WEB_URL = BRANDING.publicWebUrl || String(env.PUBLIC_WEB_URL || 'https://worksideadvisor.com');
const PUBLIC_WEB_URL = (() => {
  const normalized = String(RAW_PUBLIC_WEB_URL || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  if (!normalized || normalized.includes('netlify.app')) {
    return 'worksideadvisor.com';
  }
  return normalized;
})();

function logPdfEvent(event, details = {}) {
  const payload = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');
  console.info(`[pdf] ${event}${payload ? ` ${payload}` : ''}`);
}

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

function bytesContainStaticMapError(buffer) {
  if (!buffer) {
    return false;
  }

  try {
    const decoded = Buffer.from(buffer).toString('latin1');
    return decoded.includes('g.co/staticmaperror');
  } catch {
    return false;
  }
}

async function resolveStaticMapImageUrl(url) {
  if (!url) {
    return '';
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return '';
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return '';
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length || bytesContainStaticMapError(buffer)) {
      return '';
    }

    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
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
  const valueText = String(value ?? '').trim();
  const shouldWrapValue = valueText.length > 24 || valueText.includes('\n');
  return `
    <div class="metric-card metric-card-${escapeHtml(tone)}">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value ${shouldWrapValue ? 'metric-value-wrap' : ''}">${formatMetricValue(value)}</div>
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

function renderInsightList(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<p class="muted">${escapeHtml(emptyText)}</p>` : '';
  }

  return `
    <div class="insight-list">
      ${safeItems
        .map(
          (item) => `
            <div class="insight-row">
              <span class="insight-dot"></span>
              <span>${escapeHtml(item)}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderChecklistItems(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<p class="muted">${escapeHtml(emptyText)}</p>` : '';
  }

  return `
    <div class="checklist-ui">
      ${safeItems
        .map(
          (item, index) => `
            <div class="checklist-item">
              <div class="checklist-index">${index + 1}</div>
              <div class="checklist-copy">${escapeHtml(item)}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderHighlightGrid(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<div class="empty-card">${escapeHtml(emptyText)}</div>` : '';
  }

  return `
    <div class="highlight-grid">
      ${safeItems
        .map(
          (item, index) => `
            <div class="highlight-card">
              <div class="highlight-index">${index + 1}</div>
              <div class="highlight-copy">${escapeHtml(item)}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderStatusSentenceList(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<div class="empty-card">${escapeHtml(emptyText)}</div>` : '';
  }

  return `
    <div class="status-list">
      ${safeItems
        .map(
          (item) => `
            <div class="status-row">
              <span class="status-icon">•</span>
              <span class="status-copy">${escapeHtml(item)}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderConfidenceScale(confidence) {
  const numeric = Number(confidence || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }

  const percent = Math.max(0, Math.min(100, Math.round(numeric * 100)));
  return `
    <div class="confidence-scale">
      <div class="confidence-scale-head">
        <span class="metric-label">Pricing confidence</span>
        <strong>${escapeHtml(`${percent}%`)}</strong>
      </div>
      <div class="confidence-track">
        <div class="confidence-fill" style="width:${percent}%;"></div>
      </div>
      <p class="compact-copy">Confidence reflects how tightly the selected comparable sales support the current pricing stance.</p>
    </div>
  `;
}

function renderFeatureIconGrid(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<div class="empty-card">${escapeHtml(emptyText)}</div>` : '';
  }

  return `
    <div class="feature-icon-grid">
      ${safeItems
        .map((item, index) => `
          <div class="feature-icon-card">
            <div class="feature-icon-badge">${index + 1}</div>
            <div class="feature-icon-copy">${escapeHtml(item)}</div>
          </div>
        `)
        .join('')}
    </div>
  `;
}

function getProviderIconLabel(categoryLabel = '') {
  const normalized = String(categoryLabel || '').trim().toLowerCase();
  if (normalized.includes('photograph')) {
    return 'PH';
  }
  if (normalized.includes('inspect')) {
    return 'IN';
  }
  if (normalized.includes('clean')) {
    return 'CL';
  }
  if (normalized.includes('title')) {
    return 'TT';
  }
  if (normalized.includes('attorney')) {
    return 'AT';
  }
  if (normalized.includes('notar')) {
    return 'NO';
  }
  return String(categoryLabel || 'PR')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'PR';
}

function medianCompSummary(comps = []) {
  if (!comps.length) {
    return '';
  }

  const comparableRows = comps.slice(0, 6);
  const medianPrice = comparableRows
    .map((comp) => Number(comp.price || 0))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);

  if (!medianPrice.length) {
    return '';
  }

  const medianPriceValue = medianPrice[Math.floor(medianPrice.length / 2)];
  return `Median nearby comparable price ${formatCurrency(medianPriceValue)}.`;
}

function summarizeComparableSet(comps = []) {
  const comparableRows = (comps || []).slice(0, 6);
  const prices = comparableRows
    .map((comp) => Number(comp.price || 0))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  const pricePerSqftValues = comparableRows
    .map((comp) => {
      const price = Number(comp.price || 0);
      const sqft = Number(comp.sqft || 0);
      return price > 0 && sqft > 0 ? price / sqft : null;
    })
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const closestComp = comparableRows
    .map((comp) => ({ ...comp, _distance: Number(comp.distanceMiles || Number.POSITIVE_INFINITY) }))
    .sort((left, right) => left._distance - right._distance)[0];

  return {
    compCount: comparableRows.length,
    medianPrice: prices.length ? prices[Math.floor(prices.length / 2)] : null,
    medianPricePerSqft: pricePerSqftValues.length
      ? pricePerSqftValues[Math.floor(pricePerSqftValues.length / 2)]
      : null,
    closestComp,
    closestDistance: closestComp?._distance && Number.isFinite(closestComp._distance) ? closestComp._distance : null,
  };
}

function buildComparableInsights({ comps = [], selectedListPrice, pricingConfidence }) {
  const stats = summarizeComparableSet(comps);
  const signals = [];

  if (stats.medianPrice) {
    signals.push(`The selected comparable set centers near ${formatCurrency(stats.medianPrice)}.`);
  }

  if (selectedListPrice && stats.medianPrice) {
    const difference = Number(selectedListPrice) - Number(stats.medianPrice);
    const variance = Math.abs(difference) / Number(stats.medianPrice || 1);
    if (variance <= 0.03) {
      signals.push('The chosen list price stays close to the median comp cluster, supporting a balanced launch position.');
    } else if (difference > 0) {
      signals.push(`The chosen price sits above the median comp set by about ${formatPercentValue(variance * 100, 0)}, so presentation quality matters more.`);
    } else {
      signals.push(`The chosen price sits below the median comp set by about ${formatPercentValue(variance * 100, 0)}, which can improve early buyer response.`);
    }
  }

  if (stats.medianPricePerSqft) {
    signals.push(`Median comp pricing is about ${formatCurrency(Math.round(stats.medianPricePerSqft))} per square foot.`);
  }

  if (stats.closestDistance) {
    signals.push(`The closest selected comp is ${formatDistanceMiles(stats.closestDistance)} from the subject property.`);
  }

  if (pricingConfidence) {
    signals.push(`${Math.round(Number(pricingConfidence) * 100)}% pricing confidence based on available comparable support.`);
  }

  return pickMeaningfulLines(signals, 4);
}

function renderSuggestedCategoryCards(items = []) {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return '';
  }

  return `
    <div class="suggested-category-grid">
      ${safeItems
        .map(
          (item) => `
            <div class="suggested-category-card">
              <div class="suggested-category-label">Recommended support</div>
              <strong>${escapeHtml(item)}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function resolvePriorityMeta(priority = '') {
  const normalized = String(priority || '').trim().toLowerCase();
  if (normalized === 'high' || normalized === 'p1' || normalized.includes('must')) {
    return {
      key: 'p1',
      label: 'P1 Must fix',
      shortLabel: 'P1',
      badgeClass: 'priority-badge priority-badge-p1',
      cardClass: 'action-card-p1',
    };
  }
  if (normalized === 'low' || normalized === 'p3' || normalized.includes('nice')) {
    return {
      key: 'p3',
      label: 'P3 Nice to have',
      shortLabel: 'P3',
      badgeClass: 'priority-badge priority-badge-p3',
      cardClass: 'action-card-p3',
    };
  }
  return {
    key: 'p2',
    label: 'P2 Should fix',
    shortLabel: 'P2',
    badgeClass: 'priority-badge priority-badge-p2',
    cardClass: 'action-card-p2',
  };
}

function resolveActionCategory(action = {}) {
  const actionType = String(action.recommendedActionType || '').toLowerCase();
  if (actionType.includes('photo')) {
    return 'Photo';
  }
  if (actionType.includes('pricing')) {
    return 'Pricing';
  }
  if (actionType.includes('curb') || actionType.includes('exterior')) {
    return 'Exterior';
  }
  if (actionType.includes('staging') || actionType.includes('lighting') || actionType.includes('declutter')) {
    return 'Interior';
  }
  if (actionType.includes('provider')) {
    if (String(action.linkedProviderCategory || '').toLowerCase().includes('clean')) {
      return 'Interior';
    }
    if (String(action.linkedProviderCategory || '').toLowerCase().includes('staging')) {
      return 'Interior';
    }
    if (String(action.linkedProviderCategory || '').toLowerCase().includes('exterior')) {
      return 'Exterior';
    }
    return 'Interior';
  }
  return 'General';
}

function actionRoiScore(action = {}) {
  const actionType = String(action.recommendedActionType || '').toLowerCase();
  const scoreMap = {
    photo_retake: 95,
    pricing_review: 92,
    staging_improvement: 84,
    lighting_improvement: 80,
    curb_appeal: 76,
    declutter: 72,
    provider_booking: 68,
    report_regeneration: 50,
  };
  return Number(scoreMap[actionType] || 60);
}

function actionUrgencyScore(action = {}) {
  const meta = resolvePriorityMeta(action.urgency);
  if (meta.key === 'p1') {
    return 3;
  }
  if (meta.key === 'p2') {
    return 2;
  }
  return 1;
}

function sortRecommendationActions(actions = []) {
  return [...(actions || [])].sort((left, right) => {
    const roiDelta = actionRoiScore(right) - actionRoiScore(left);
    if (roiDelta !== 0) {
      return roiDelta;
    }
    return actionUrgencyScore(right) - actionUrgencyScore(left);
  });
}

function renderPriorityLegend() {
  return `
    <div class="priority-legend">
      <div class="priority-legend-label">Priority legend</div>
      <span class="priority-badge priority-badge-p1">P1 Must fix before listing</span>
      <span class="priority-badge priority-badge-p2">P2 Should fix</span>
      <span class="priority-badge priority-badge-p3">P3 Nice to have</span>
    </div>
  `;
}

function renderRecommendationActionCards(actions = [], emptyText = '') {
  const ranked = sortRecommendationActions(actions);
  if (!ranked.length) {
    return emptyText ? `<div class="empty-card">${escapeHtml(emptyText)}</div>` : '';
  }

  const categoryOrder = ['Photo', 'Interior', 'Exterior', 'Pricing', 'General'];
  const grouped = new Map(categoryOrder.map((category) => [category, []]));
  for (const action of ranked) {
    const category = resolveActionCategory(action);
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category).push(action);
  }

  return `
    <div class="action-category-stack">
      ${categoryOrder
        .filter((category) => (grouped.get(category) || []).length)
        .map((category) => {
          const items = grouped.get(category) || [];
          return `
            <section class="action-group">
              <div class="section-kicker">${escapeHtml(category)} actions</div>
              <div class="action-card-grid">
                ${items
                  .map((action, index) => {
                    const priorityMeta = resolvePriorityMeta(action.urgency);
                    return `
                      <article class="action-card ${priorityMeta.cardClass}">
                        <div class="action-card-head">
                          <h4>${escapeHtml(action.title || `Action ${index + 1}`)}</h4>
                          <span class="${priorityMeta.badgeClass}">${escapeHtml(priorityMeta.shortLabel)}</span>
                        </div>
                        <div class="action-meta">
                          <span>${escapeHtml(category)}</span>
                          ${action.estimatedCost ? `<span>Cost: ${escapeHtml(action.estimatedCost)}</span>` : ''}
                        </div>
                        ${action.expectedOutcome ? `<div class="action-impact"><strong>Expected impact:</strong> ${escapeHtml(action.expectedOutcome)}</div>` : ''}
                        ${action.reason ? `<div class="action-why"><strong>Why it matters:</strong> ${escapeHtml(action.reason)}</div>` : ''}
                      </article>
                    `;
                  })
                  .join('')}
              </div>
            </section>
          `;
        })
        .join('')}
    </div>
  `;
}

function classifyPhotoQuality(photo = {}) {
  const score = Number(photo?.score || 0);
  if (score >= 80 && photo?.listingCandidate) {
    return {
      label: 'Strong',
      priority: resolvePriorityMeta('p3'),
      badgeClass: 'photo-quality-badge photo-quality-strong',
    };
  }
  if (score >= 60) {
    return {
      label: 'Usable',
      priority: resolvePriorityMeta('p2'),
      badgeClass: 'photo-quality-badge photo-quality-usable',
    };
  }
  return {
    label: 'Needs Retake',
    priority: resolvePriorityMeta('p1'),
    badgeClass: 'photo-quality-badge photo-quality-retake',
  };
}

function buildPhotoFeedback(photo = {}, quality = {}) {
  const listingNote = String(photo?.listingNote || '').trim();
  if (listingNote) {
    return listingNote;
  }
  if (quality.label === 'Needs Retake') {
    return 'Lighting or composition needs improvement before listing launch.';
  }
  if (quality.label === 'Usable') {
    return photo?.listingCandidate
      ? 'Usable image with minor polish opportunities.'
      : 'Usable image, but clutter or framing may limit buyer appeal.';
  }
  return 'Good composition and listing-ready clarity.';
}

function renderPhotoTiles(photos = [], limit = 4) {
  const selected = photos.filter((photo) => photo?.imageUrl).slice(0, limit);
  if (!selected.length) {
    return `<div class="empty-card">No marketplace-ready photos selected yet.</div>`;
  }

  return `
    <div class="photo-grid">
      ${selected
        .map(
          (photo) => {
            const quality = classifyPhotoQuality(photo);
            const feedback = buildPhotoFeedback(photo, quality);
            const scoreLabel = Number.isFinite(Number(photo?.score))
              ? `${Math.round(Number(photo.score))}/100`
              : '--/100';

            return `
            <figure class="photo-tile">
              <img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(photo.roomLabel || 'Property photo')}" />
              <div class="photo-tile-overlay">
                <span class="photo-score-chip">${escapeHtml(scoreLabel)}</span>
                <span class="${quality.badgeClass}">${escapeHtml(`${quality.label} · ${quality.priority.shortLabel}`)}</span>
              </div>
              <figcaption>
                <strong>${escapeHtml(photo.roomLabel || 'Property photo')}</strong>
                <span class="photo-meta">${escapeHtml(photo.marketplaceStatus || 'Photo review pending')}</span>
                <span class="photo-feedback">${escapeHtml(feedback)}</span>
              </figcaption>
            </figure>
          `;
          },
        )
        .join('')}
    </div>
  `;
}

function renderProviderCards(items = []) {
  if (!items.length) {
    return `<div class="empty-card">No provider recommendations were available from marketplace or nearby discovery for this run. Continue checklist progress and regenerate after provider data updates.</div>`;
  }

  return `
    <div class="provider-grid">
      ${items
        .map(
          (provider) => `
            <article class="provider-card">
              <div class="provider-card-head">
                <div class="provider-icon">${escapeHtml(getProviderIconLabel(provider.categoryLabel || 'Provider'))}</div>
                <div>
                  <div class="provider-category">${escapeHtml(provider.categoryLabel || 'Provider')}</div>
                  <h4>${escapeHtml(provider.businessName || 'Provider recommendation')}</h4>
                </div>
              </div>
              <p class="provider-reason">${escapeHtml(provider.reason || provider.coverageLabel || '')}</p>
              <div class="provider-meta">
                ${provider.sourceLabel ? `<span>${escapeHtml(provider.sourceLabel)}</span>` : ''}
                ${provider.coverageLabel ? `<span>${escapeHtml(provider.coverageLabel)}</span>` : ''}
                ${provider.turnaroundLabel ? `<span>${escapeHtml(provider.turnaroundLabel)}</span>` : ''}
                ${provider.pricingSummary ? `<span>${escapeHtml(provider.pricingSummary)}</span>` : ''}
                ${provider.confidenceNote ? `<span>${escapeHtml(provider.confidenceNote)}</span>` : ''}
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

function shortenNarrative(value, maxSentences = 2) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return sentences.slice(0, maxSentences).join(' ');
}

function buildInsightSentences(value, fallback = []) {
  const text = String(value || '').trim();
  const sentenceParts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
  return pickMeaningfulLines([...sentenceParts, ...fallback], 4);
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
        --brand-blue: #2f5f8f;
        --brand-blue-soft: #dbe8f4;
        --accent: #c87447;
        --accent-soft: #f2d6c2;
        --moss: #4f7b62;
        --moss-soft: #dce8df;
        --risk: #b06254;
        --risk-soft: #f4dfda;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Aptos", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: #f4efe5;
        white-space: normal;
        word-break: keep-all;
        overflow-wrap: normal;
        hyphens: none;
      }
      p, span, div, li, strong, h1, h2, h3, h4 { white-space: normal; word-break: keep-all; overflow-wrap: normal; hyphens: none; }
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
      .hero-page { display: grid; gap: 14px; }
      .brand-kicker {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 10px;
        color: var(--moss);
        white-space: nowrap;
      }
      .section-kicker {
        letter-spacing: 0.08em;
        font-size: 10px;
        color: var(--moss);
        white-space: nowrap;
        font-weight: 700;
      }
      h1, h2, h3, h4, p { margin: 0; }
      h1 { font-family: Georgia, "Times New Roman", serif; font-size: 38px; line-height: 1.03; margin-top: 10px; }
      h2 { font-family: Georgia, "Times New Roman", serif; font-size: 28px; line-height: 1.1; margin-bottom: 8px; }
      h3 { font-size: 19px; margin-bottom: 8px; }
      h4 { font-size: 15px; margin-bottom: 6px; }
      .lede { font-size: 15px; line-height: 1.65; color: var(--muted); }
      .muted { color: var(--muted); font-size: 12px; line-height: 1.5; }
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
      .summary-grid, .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
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
      .metric-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 8px; white-space: nowrap; }
      .metric-value { font-size: 22px; font-weight: 700; white-space: nowrap; }
      .metric-value-wrap { white-space: normal; overflow-wrap: anywhere; line-height: 1.2; font-size: 19px; }
      .metric-support { margin-top: 8px; font-size: 12px; color: var(--muted); line-height: 1.4; }
      .section-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 14px; }
      .content-card, .sidebar-card { padding: 18px 20px; }
      .section-stack { display: flex; flex-direction: column; gap: 18px; }
      .bullet-list { margin: 10px 0 0; padding-left: 18px; }
      .bullet-list li { margin: 0 0 8px; color: var(--muted); line-height: 1.5; }
      .feature-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .feature-pill { padding: 10px 12px; font-size: 12px; color: var(--ink); background: rgba(255,255,255,0.78); }
      .photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .photo-tile { margin: 0; border: 1px solid var(--line); background: rgba(255,255,255,0.88); border-radius: 18px; overflow: hidden; position: relative; }
      .photo-tile img { width: 100%; height: 190px; display: block; object-fit: cover; }
      .photo-tile-overlay { position: absolute; top: 10px; left: 10px; right: 10px; display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
      .photo-score-chip { display: inline-block; padding: 6px 10px; border-radius: 999px; background: rgba(15,23,42,0.78); color: #fff; font-size: 11px; font-weight: 700; }
      .photo-quality-badge { display: inline-block; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #fff; }
      .photo-quality-retake { background: rgba(176,98,84,0.92); }
      .photo-quality-usable { background: rgba(170,120,36,0.9); }
      .photo-quality-strong { background: rgba(61,120,88,0.9); }
      .photo-tile figcaption { padding: 12px 14px 14px; display: grid; gap: 6px; }
      .photo-tile figcaption strong { font-size: 14px; }
      .photo-tile figcaption span { font-size: 12px; color: var(--muted); }
      .photo-meta { font-size: 11px; color: #6f7c7a; }
      .photo-feedback { font-size: 12px; color: var(--ink); line-height: 1.45; }
      .priority-legend { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
      .priority-legend-label { font-size: 11px; color: var(--muted); font-weight: 700; }
      .priority-badge { padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
      .priority-badge-p1 { background: var(--risk-soft); color: #8f4d41; border: 1px solid rgba(176,98,84,0.28); }
      .priority-badge-p2 { background: rgba(245,158,11,0.16); color: #9a6808; border: 1px solid rgba(245,158,11,0.28); }
      .priority-badge-p3 { background: var(--moss-soft); color: var(--moss); border: 1px solid rgba(79,123,98,0.24); }
      .action-category-stack { display: grid; gap: 16px; }
      .action-group { display: grid; gap: 10px; }
      .action-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
      .action-card { border: 1px solid var(--line); border-left-width: 4px; border-radius: 16px; background: rgba(255,255,255,0.94); padding: 14px 16px; }
      .action-card-p1 { border-left-color: #c86a5b; }
      .action-card-p2 { border-left-color: #d49a2b; }
      .action-card-p3 { border-left-color: #5a8b70; }
      .action-card-head { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
      .action-card-head h4 { margin: 0; font-size: 15px; line-height: 1.3; }
      .action-meta { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 8px; font-size: 11px; color: var(--muted); }
      .action-impact, .action-why { margin-top: 8px; font-size: 12px; line-height: 1.5; color: var(--ink); }
      .dashboard-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .roi-hero-card { border: 1px solid rgba(79,123,98,0.28); border-radius: 20px; padding: 18px 20px; background: linear-gradient(135deg, rgba(79,123,98,0.12), rgba(47,95,143,0.08)); }
      .roi-hero-value { font-size: 34px; line-height: 1.05; font-weight: 800; color: #2f6a4e; margin-top: 8px; }
      .roi-hero-sub { margin-top: 6px; font-size: 12px; color: var(--muted); }
      .roi-bar-shell { margin-top: 12px; display: grid; gap: 8px; }
      .roi-bar { height: 10px; border-radius: 999px; background: rgba(47,95,143,0.12); overflow: hidden; }
      .roi-bar-fill-upside { height: 100%; background: linear-gradient(90deg, rgba(79,123,98,0.72), rgba(47,95,143,0.88)); }
      .roi-bar-fill-cost { height: 100%; background: linear-gradient(90deg, rgba(176,98,84,0.62), rgba(200,116,71,0.78)); }
      .quick-summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .provider-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
      .provider-card { padding: 16px; }
      .provider-card-head { display: grid; grid-template-columns: 40px 1fr; gap: 12px; align-items: start; }
      .provider-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(47,95,143,0.12); color: var(--brand-blue); font-size: 12px; font-weight: 800; border: 1px solid rgba(47,95,143,0.18); }
      .provider-category { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 8px; white-space: nowrap; }
      .provider-reason { font-size: 13px; color: var(--muted); line-height: 1.5; min-height: 54px; }
      .provider-meta, .provider-contact { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 10px; font-size: 12px; color: var(--muted); }
      .comp-table { display: grid; gap: 10px; }
      .comp-summary-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
      .comp-table-head, .comp-row { display: grid; grid-template-columns: minmax(250px, 1.6fr) minmax(96px, 0.75fr) minmax(150px, 1fr) minmax(96px, 0.75fr); gap: 14px; align-items: start; }
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
      .brand-bar { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 14px; }
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
      .marketing-cover-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; margin-top: 24px; align-items: start; }
      .marketing-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
      .action-card {
        margin-top: 14px;
        padding: 18px 20px;
        border-radius: 18px;
        border: 1px solid rgba(79,123,98,0.2);
        background: rgba(255,255,255,0.9);
      }
      .gallery-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
      .gallery-strip img {
        width: 100%;
        height: 210px;
        object-fit: cover;
        display: block;
        border-radius: 16px;
        border: 1px solid var(--line);
      }
      .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
      .map-frame.compact { min-height: 220px; }
      .badge-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .badge { padding: 8px 12px; border-radius: 999px; background: var(--moss-soft); color: var(--moss); font-size: 12px; font-weight: 600; white-space: nowrap; }
      .badge-address, .badge-contact { white-space: normal; line-height: 1.4; }
      .kpi-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 22px; }
      .executive-summary-shell { display: grid; gap: 18px; margin-top: 18px; }
      .executive-callouts { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
      .callout-chip { border: 1px solid var(--line); background: rgba(255,255,255,0.9); border-radius: 18px; padding: 14px 16px; }
      .callout-chip-opportunity { border-color: rgba(79,123,98,0.24); background: rgba(244,251,246,0.96); }
      .callout-chip-risk { border-color: rgba(176,98,84,0.26); background: rgba(255,246,245,0.96); }
      .callout-chip-value { border-color: rgba(47,95,143,0.2); background: rgba(244,248,252,0.96); }
      .callout-chip strong { display: block; margin-top: 6px; font-size: 14px; }
      .fact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
      .fact-row { border: 1px solid var(--line); background: rgba(255,255,255,0.9); border-radius: 16px; padding: 12px 14px; }
      .fact-row-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 6px; white-space: nowrap; }
      .section-intro { margin-top: 6px; max-width: 6.2in; }
      .cover-price-badge { display: inline-flex; align-items: center; gap: 10px; margin-top: 16px; padding: 10px 14px; border-radius: 999px; background: rgba(79,123,98,0.14); color: var(--moss); font-weight: 700; }
      .marketing-hero-copy { display: grid; gap: 14px; }
      .brochure-bottom-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 16px; }
      .highlight-list li { margin-bottom: 10px; }
      .gallery-strip.two-up { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      .compact-copy { font-size: 12px; line-height: 1.52; color: var(--muted); }
      .page-spacer { height: 10px; }
      .insight-list { display: grid; gap: 10px; margin-top: 10px; }
      .insight-row { display: grid; grid-template-columns: 12px 1fr; gap: 10px; align-items: start; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.72); border: 1px solid rgba(79,123,98,0.14); }
      .insight-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--moss); margin-top: 6px; }
      .checklist-ui { display: grid; gap: 12px; margin-top: 10px; }
      .checklist-item { display: grid; grid-template-columns: 34px 1fr; gap: 12px; align-items: start; padding: 12px 14px; border-radius: 16px; border: 1px solid var(--line); background: rgba(255,255,255,0.88); }
      .checklist-index { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(79,123,98,0.14); color: var(--moss); font-weight: 700; }
      .checklist-copy { font-size: 14px; line-height: 1.5; }
      .highlight-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
      .highlight-card { display: grid; grid-template-columns: 36px 1fr; gap: 12px; align-items: start; padding: 14px 16px; border-radius: 18px; border: 1px solid rgba(79,123,98,0.16); background: rgba(255,255,255,0.92); }
      .highlight-index { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(200,116,71,0.14); color: var(--accent); font-weight: 800; }
      .highlight-copy { font-size: 14px; line-height: 1.5; color: var(--ink); }
      .feature-icon-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
      .feature-icon-card { display: grid; grid-template-columns: 40px 1fr; gap: 12px; align-items: start; padding: 14px 16px; border-radius: 18px; border: 1px solid rgba(47,95,143,0.16); background: rgba(244,248,252,0.96); box-shadow: 0 8px 18px rgba(19,32,43,0.05); }
      .feature-icon-badge { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 14px; background: linear-gradient(135deg, rgba(47,95,143,0.14), rgba(200,116,71,0.14)); color: var(--brand-blue); font-size: 15px; font-weight: 800; }
      .feature-icon-copy { font-size: 14px; line-height: 1.5; color: var(--ink); font-weight: 600; }
      .hero-signal-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .hero-signal-chip { padding: 10px 12px; border-radius: 14px; font-size: 12px; line-height: 1.45; font-weight: 600; border: 1px solid transparent; white-space: nowrap; }
      .hero-signal-chip-blue { background: var(--brand-blue-soft); color: var(--brand-blue); border-color: rgba(47,95,143,0.18); }
      .hero-signal-chip-green { background: var(--moss-soft); color: var(--moss); border-color: rgba(79,123,98,0.18); }
      .hero-signal-chip-orange { background: var(--accent-soft); color: #9a5a33; border-color: rgba(200,116,71,0.18); }
      .suggested-category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
      .suggested-category-card { padding: 14px 16px; border-radius: 18px; border: 1px solid rgba(47,95,143,0.16); background: rgba(244,248,252,0.96); }
      .suggested-category-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--brand-blue); margin-bottom: 8px; }
      .seller-cover-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: stretch; }
      .seller-cover-row-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
      .cover-right-stack { display: grid; gap: 10px; align-content: start; }
      .cover-photo-card { padding: 12px; }
      .score-hero { border-radius: 28px; padding: 24px 24px 20px; border: 1px solid rgba(200,116,71,0.24); background: linear-gradient(145deg, rgba(47,95,143,0.08), rgba(200,116,71,0.16) 62%, rgba(255,250,244,0.98) 100%); text-align: left; min-height: 3.3in; display: flex; flex-direction: column; justify-content: center; }
      .score-hero-value { font-size: 124px; line-height: 0.82; font-weight: 800; margin-top: 10px; letter-spacing: -0.07em; }
      .score-status { display: inline-flex; margin-top: 10px; padding: 8px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
      .score-status-ready { background: rgba(79,123,98,0.16); color: var(--moss); }
      .score-status-almost { background: rgba(200,116,71,0.16); color: #9a5a33; }
      .score-status-needs-work { background: rgba(176,108,99,0.16); color: #96554a; }
      .score-hero-note { margin-top: 10px; font-size: 13px; line-height: 1.48; color: var(--muted); max-width: 4.6in; }
      .compact-metric-stack { display: grid; gap: 12px; }
      .compact-metric-card { border: 1px solid var(--line); background: rgba(255,255,255,0.92); border-radius: 18px; padding: 14px 16px; min-height: 88px; }
      .compact-metric-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 8px; white-space: nowrap; }
      .compact-metric-value { font-size: 28px; line-height: 1.05; font-weight: 800; white-space: nowrap; }
      .compact-metric-support { margin-top: 6px; font-size: 12px; line-height: 1.45; color: var(--muted); }
      .seller-final-band { margin-top: 14px; padding: 16px 18px; border-radius: 18px; border: 1px solid rgba(200,116,71,0.2); background: linear-gradient(135deg, rgba(47,95,143,0.08), rgba(200,116,71,0.12)); }
      .full-page-grid { display: grid; gap: 18px; align-content: start; min-height: 9.2in; }
      .summary-shell { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; align-items: start; }
      .dense-two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
      .recommendation-grid { display: grid; gap: 14px; }
      .comp-map-stack { display: grid; gap: 14px; }
      .comp-meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
      .action-plan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; align-items: start; }
      .brochure-cover { position: relative; min-height: 5.2in; border-radius: 28px; overflow: hidden; border: 1px solid var(--line); background: linear-gradient(135deg, #304f72 0%, #203245 100%); }
      .brochure-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .brochure-cover-media-grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 8px; }
      .brochure-cover-media-grid img { position: relative; width: 100%; height: 100%; object-fit: cover; border-radius: 16px; }
      .brochure-cover::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(16,24,32,0.08) 0%, rgba(30,57,84,0.40) 30%, rgba(16,24,32,0.72) 68%, rgba(16,24,32,0.9) 100%); }
      .brochure-cover-overlay { position: relative; z-index: 1; min-height: 5.2in; padding: 30px 30px 26px; color: #ffffff; display: flex; flex-direction: column; justify-content: flex-end; }
      .brochure-cover-overlay .brand-kicker { color: rgba(255,255,255,0.78); }
      .brochure-cover-overlay h1 { color: #ffffff; font-size: 60px; line-height: 0.96; max-width: 6.2in; text-shadow: 0 10px 24px rgba(0,0,0,0.18); }
      .brochure-cover-overlay .lede { color: rgba(255,255,255,0.88); max-width: 5.4in; }
      .brochure-price { display: inline-flex; align-items: center; gap: 10px; margin: 0 0 12px; padding: 12px 18px; border-radius: 999px; background: rgba(255,255,255,0.18); color: #ffffff; border: 1px solid rgba(255,255,255,0.26); font-weight: 800; font-size: 15px; backdrop-filter: blur(3px); box-shadow: 0 12px 26px rgba(0,0,0,0.12); white-space: nowrap; }
      .brochure-cover-facts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
      .brochure-cover-fact { padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.22); font-size: 12px; color: #fff; white-space: nowrap; }
      .brochure-cover-lower { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 16px; }
      .brochure-cta-card { padding: 18px 20px; border-radius: 18px; border: 1px solid rgba(200,116,71,0.24); background: rgba(255,255,255,0.92); }
      .address-line { max-width: 100%; line-height: 1.45; overflow-wrap: normal; word-break: keep-all; }
      .status-list { display: grid; gap: 10px; margin-top: 12px; }
      .status-row { display: grid; grid-template-columns: 18px 1fr; gap: 10px; align-items: start; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.76); border: 1px solid rgba(47,95,143,0.12); }
      .status-icon { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(79,123,98,0.16); color: var(--moss); font-size: 14px; font-weight: 800; line-height: 1; }
      .status-copy { color: var(--ink); font-size: 13px; line-height: 1.5; }
      .confidence-scale { display: grid; gap: 10px; margin-top: 14px; padding: 16px 18px; border-radius: 18px; border: 1px solid rgba(47,95,143,0.14); background: rgba(244,248,252,0.94); }
      .confidence-scale-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .confidence-track { width: 100%; height: 12px; border-radius: 999px; background: rgba(47,95,143,0.10); overflow: hidden; }
      .confidence-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, rgba(79,123,98,0.55), rgba(47,95,143,0.88)); }
      .brochure-cta-button { display: inline-block; margin-top: 12px; padding: 12px 18px; border-radius: 999px; background: var(--accent); color: #fff; font-weight: 700; }
      .legend-note { margin-top: 10px; font-size: 11px; line-height: 1.45; color: var(--muted); }
      .marketing-gallery-card { padding: 14px 16px; }
      .closing-band { margin-top: 14px; padding: 14px 16px; border-radius: 18px; background: linear-gradient(135deg, rgba(47,95,143,0.10), rgba(200,116,71,0.12)); border: 1px solid rgba(47,95,143,0.14); }
      @media (max-width: 740px) {
        .photo-grid, .dashboard-row, .quick-summary-grid { grid-template-columns: 1fr; }
      }
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
  const consequenceFraming = report.payload?.consequenceFraming || {};
  const recommendationActions = report.payload?.recommendationActions || [];
  const buyerPersonaSummary = report.payload?.buyerPersonaSummary || {};
  const checklistSummary = report.payload?.checklistSummary || {};
  const compMapImageUrl = report._resolvedCompMapImageUrl || buildComparableMapImageUrl(property, report.selectedComps || []);
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
    : recommendationActions.length
      ? recommendationActions.map(
          (action) =>
            `${action.title}${action.urgency ? ` · ${titleCaseLabel(action.urgency)} urgency` : ''}`,
        )
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
  const compStats = summarizeComparableSet(report.selectedComps || []);
  const coverNarrative = shortenNarrative(executiveSummaryText, 1);
  const pricingInsightLines = pickMeaningfulLines([
    shortenNarrative(report.pricingSummary?.strategy, 1),
    ...(report.pricingSummary?.strengths || []),
    hasMeaningfulValue(riskOpportunity.biggestOpportunity) ? `Opportunity: ${riskOpportunity.biggestOpportunity}` : '',
    ...buildComparableInsights({
      comps: report.selectedComps || [],
      selectedListPrice: property?.selectedListPrice,
      pricingConfidence: report.pricingSummary?.confidence,
    }),
  ], 4);
  const coverPricingSignal = property?.selectedListPrice
    ? `Pricing signal: positioned at ${formatCurrency(property.selectedListPrice)}.`
    : '';
  const coverKeyInsight = Number(photoSummary.retakeCount || 0) > 0
    ? `Key insight: ${photoSummary.retakeCount} photo retake${Number(photoSummary.retakeCount || 0) === 1 ? '' : 's'} still need attention.`
    : `${checklistSummary.openCount || 0} checklist items still need closure before launch.`;
  const executiveSummaryBullets = pickMeaningfulLines([
    coverNarrative,
    coverPricingSignal,
    coverKeyInsight,
    hasMeaningfulValue(report.payload?.listingDescriptions?.shortDescription)
      ? report.payload.listingDescriptions.shortDescription
      : '',
  ], 3);
  const pricingRationaleBullets = pickMeaningfulLines([
    report.pricingSummary?.strategy,
    ...(report.pricingSummary?.strengths || []),
    hasMeaningfulValue(report.pricingSummary?.confidence)
      ? `${Math.round(report.pricingSummary.confidence * 100)}% pricing confidence based on the selected comparable set.`
      : '',
    medianCompSummary(report.selectedComps || []),
    pricingNarrative,
  ], 5);
  const readinessTone = getReadinessTone({ score: readinessSummary.overallScore, label: readinessSummary.label });
  const suggestedProviderCategories = pickMeaningfulLines([
    photoSummary.retakeCount || photoSummary.roomCoverageCount < 5 ? 'Professional photography' : '',
    Number(checklistSummary.openCount || 0) > 0 ? 'Cleaning and prep support' : '',
    hasMeaningfulValue(riskOpportunity.biggestOpportunity) ? 'Staging or presentation support' : '',
  ], 3);
  const summaryRecommendations = pickMeaningfulLines([
    report.payload?.improvementGuidance?.summary,
    ...recommendationActions.map((action) => action.title),
    ...(report.improvementItems || []).slice(0, 3),
    summaryOpportunity,
    pricingNarrative,
  ], 5);
  const recommendationActionLines = pickMeaningfulLines(
    recommendationActions.map(
      (action) =>
        `${action.title}${action.urgency ? ` (${titleCaseLabel(action.urgency)} urgency)` : ''}${action.expectedOutcome ? ` - ${action.expectedOutcome}` : ''}`,
    ),
    5,
  );
  const sortedRecommendationActions = sortRecommendationActions(recommendationActions);
  const topThreeActions = sortedRecommendationActions.slice(0, 3);
  const topThreeActionLines = pickMeaningfulLines(
    topThreeActions.map((action) => {
      const priorityMeta = resolvePriorityMeta(action.urgency);
      return `${priorityMeta.shortLabel} · ${action.title}`;
    }),
    3,
  );
  const topThreeIssues = pickMeaningfulLines([
    summaryRisk,
    ...(consequenceFraming.lines || []),
    checklistSummary.openCount ? `${checklistSummary.openCount} checklist items still open.` : '',
  ], 3);
  const launchStatusHighlights = pickMeaningfulLines([
    photoSummary.summary,
    checklistSummary.totalCount ? `${checklistSummary.completedCount || 0} of ${checklistSummary.totalCount} checklist items are complete.` : '',
    property?.selectedListPrice ? `Chosen list price ${formatCurrency(property.selectedListPrice)}.` : '',
    pricingInsightLines[0] || '',
    consequenceFraming.summary || '',
  ], 4);
  const roiUpside = Number(improvementEconomics.estimatedRoi || 0);
  const roiCost = Number(improvementEconomics.estimatedCost || 0);
  const roiMax = Math.max(roiUpside, roiCost, 1);
  const roiUpsideWidth = Math.max(4, Math.round((roiUpside / roiMax) * 100));
  const roiCostWidth = Math.max(4, Math.round((roiCost / roiMax) * 100));
  const pricingMetricCards = [
    renderMetricCard('Suggested range', report.pricingSummary?.low && report.pricingSummary?.high ? `${formatCurrency(report.pricingSummary.low)} - ${formatCurrency(report.pricingSummary.high)}` : 'Unavailable', report.pricingSummary?.strategy || 'Market-aligned pricing recommendation'),
    renderMetricCard('Midpoint', report.pricingSummary?.mid ? formatCurrency(report.pricingSummary.mid) : 'Unavailable', report.pricingSummary?.confidence ? `${Math.round(report.pricingSummary.confidence * 100)}% confidence` : 'Comparable signal based'),
    renderMetricCard('Chosen price', property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set', property?.selectedListPrice ? 'Seller-confirmed' : 'Set in pricing tab'),
    renderMetricCard('Selected comps', String((report.selectedComps || []).length), 'Top market references included'),
  ].join('');
  const pricingCompMetaCards = [
    report.pricingSummary?.confidence ? renderMetricCard('Confidence', `${Math.round(report.pricingSummary.confidence * 100)}%`, 'Pricing support') : '',
    compStats.medianPrice ? renderMetricCard('Median comp price', formatCurrency(compStats.medianPrice), 'Selected comp median') : '',
    compStats.medianPricePerSqft ? renderMetricCard('Median price / sqft', `${formatCurrency(Math.round(compStats.medianPricePerSqft))}`, 'Comparable density') : '',
    compStats.closestDistance ? renderMetricCard('Closest comp', formatDistanceMiles(compStats.closestDistance), 'Nearest selected comparable') : '',
  ].filter(Boolean).join('');

  const body = `
    <section class="page hero-page">
      <div class="seller-cover-grid">
        <div>
          <div class="brand-kicker">Workside Home Advisor · Seller Intelligence Report</div>
          <h1>${escapeHtml(report.title || property.title || 'Property Summary Report')}</h1>
          <div class="score-hero">
            <div class="metric-label">Readiness score</div>
            <div class="score-hero-value">${escapeHtml(`${readinessSummary.overallScore || 0}/100`)}</div>
            <div class="score-status score-status-${escapeHtml(readinessTone)}">${escapeHtml(readinessSummary.label || 'Needs work')}</div>
            <p class="score-hero-note">${escapeHtml(coverNarrative || 'This report turns property data into a clear launch decision and next-step sequence.')}</p>
          </div>
        </div>
        <div class="cover-right-stack">
          <div class="compact-metric-stack">
            <div class="compact-metric-card">
              <div class="compact-metric-label">Price</div>
              <div class="compact-metric-value">${escapeHtml(property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set')}</div>
              <div class="compact-metric-support">${escapeHtml(report.pricingSummary?.mid ? `Suggested midpoint ${formatCurrency(report.pricingSummary.mid)}` : 'Pricing guidance available below')}</div>
            </div>
            <div class="compact-metric-card">
              <div class="compact-metric-label">Photo coverage</div>
              <div class="compact-metric-value">${escapeHtml(`${photoSummary.roomCoverageCount || 0}/5`)}</div>
              <div class="compact-metric-support">${escapeHtml(`${photoSummary.listingCandidateCount || 0} marketplace-ready${photoSummary.savedVisionPublishableCount ? ` · ${photoSummary.savedVisionPublishableCount} publishable Vision` : ''} · ${photoSummary.retakeCount || 0} retakes`)}</div>
            </div>
            <div class="compact-metric-card">
              <div class="compact-metric-label">Checklist</div>
              <div class="compact-metric-value">${escapeHtml(`${checklistSummary.progressPercent || 0}%`)}</div>
              <div class="compact-metric-support">${escapeHtml(`${checklistSummary.completedCount || 0} complete · ${checklistSummary.openCount || 0} open`)}</div>
            </div>
          </div>
          <div class="content-card cover-photo-card">
            <div class="hero-photo">
              ${heroPhoto?.imageUrl ? `<img src="${escapeHtml(heroPhoto.imageUrl)}" alt="${escapeHtml(heroPhoto.roomLabel || 'Property photo')}" />` : ''}
            </div>
            <p class="muted address-line" style="margin-top:10px;">${escapeHtml(buildPropertyAddress(property))}</p>
          </div>
        </div>
      </div>
      <div class="seller-cover-row-two">
        <div class="content-card">
          <div class="section-kicker">Pricing signal</div>
          <h3>Positioning snapshot</h3>
          ${renderInsightList(
            pickMeaningfulLines([
              coverPricingSignal,
              report.pricingSummary?.mid ? `Suggested midpoint ${formatCurrency(report.pricingSummary.mid)}.` : '',
              pricingInsightLines[0] || '',
            ], 3),
            'Pricing is being positioned from the latest comparable sales and readiness signals.',
          )}
        </div>
        <div class="content-card">
          <div class="section-kicker">Key insight</div>
          <h3>What deserves attention first</h3>
          ${renderInsightList(
            pickMeaningfulLines([
              coverKeyInsight,
              summaryOpportunity,
              summaryRisk,
            ], 3),
            'The clearest launch insight is drawn from the current pricing, checklist, and photo signals.',
          )}
        </div>
      </div>
      ${renderFooter('Property Summary Report · Cover')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Quick summary</div>
          <h2>At a glance</h2>
          <p class="muted">Readiness, top issues, top actions, and ROI in one page.</p>
        </div>
      </div>
      <div class="metric-grid">
        ${renderMetricCard('Overall readiness', `${readinessSummary.overallScore || 0}/100`, readinessSummary.label || 'Needs work', readinessTone)}
        ${renderMetricCard('Photo quality score', `${photoSummary.averageQualityScore || 0}/100`, `${photoSummary.retakeCount || 0} retakes needed`)}
        ${renderMetricCard('Checklist completion', `${checklistSummary.progressPercent || 0}%`, `${checklistSummary.completedCount || 0}/${checklistSummary.totalCount || 0} complete`)}
        ${renderMetricCard('Launch status', readinessSummary.label || 'Needs work', topThreeIssues[0] || 'Address top action items before launch.', readinessTone)}
      </div>
      <div class="quick-summary-grid" style="margin-top:14px;">
        <div class="content-card">
          <div class="section-kicker">Top issues</div>
          <h3>What may hold launch back</h3>
          ${renderChecklistItems(topThreeIssues, 'No major issues are currently dominant.')}
        </div>
        <div class="content-card">
          <div class="section-kicker">Top actions</div>
          <h3>What to do next</h3>
          ${renderChecklistItems(topThreeActionLines.length ? topThreeActionLines : orderedNextSteps.slice(0, 3), 'Use the guided workflow to keep the launch plan moving.')}
        </div>
      </div>
      <div class="roi-hero-card" style="margin-top:14px;">
        <div class="section-kicker">ROI snapshot</div>
        <div class="roi-hero-value">${escapeHtml(roiUpside ? `~${formatCurrency(roiUpside)} potential upside` : 'Potential upside pending')}</div>
        <div class="roi-hero-sub">${escapeHtml(roiCost ? `Estimated prep cost: ${formatCurrency(roiCost)}` : 'Estimated prep cost pending')}</div>
        <div class="roi-hero-sub">${escapeHtml(`Estimated value at risk: ${roiUpside ? formatCurrency(roiUpside) : 'Pending'}`)}</div>
        <div class="roi-bar-shell">
          <div>
            <div class="metric-label">Potential upside</div>
            <div class="roi-bar"><div class="roi-bar-fill-upside" style="width:${roiUpsideWidth}%;"></div></div>
          </div>
          <div>
            <div class="metric-label">Estimated prep cost</div>
            <div class="roi-bar"><div class="roi-bar-fill-cost" style="width:${roiCostWidth}%;"></div></div>
          </div>
        </div>
      </div>
      ${renderFooter('Property Summary Report · Quick Summary')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Summary</div>
          <h2>Executive summary, insights, and recommendations</h2>
          <p class="muted">A seller-facing readout of the strongest signals, risks, and next opportunities.</p>
        </div>
      </div>
      <div class="summary-shell">
        <div class="content-card">
          <div class="section-kicker">Key insights</div>
          <h3>What matters most right now</h3>
          ${renderInsightList(executiveSummaryBullets, 'Use this report to identify the clearest launch priorities.')}
          <div class="page-spacer"></div>
          <div class="callout-chip callout-chip-opportunity">
            <div class="metric-label">Top opportunity</div>
            <strong>${escapeHtml(summaryOpportunity)}</strong>
          </div>
          <div class="page-spacer"></div>
          <div class="callout-chip callout-chip-risk">
            <div class="metric-label">Top risk</div>
            <strong>${escapeHtml(summaryRisk)}</strong>
          </div>
        </div>
        <div class="recommendation-grid">
          <div class="content-card">
            <div class="section-kicker">Recommendations</div>
            <h3>Priority actions</h3>
            ${renderBulletList(summaryRecommendations, 'Use the guided workflow to continue improving readiness and launch confidence.')}
          </div>
          <div class="callout-chip callout-chip-value">
            <div class="metric-label">Budget / ROI</div>
            <strong>${escapeHtml(economicsSummary || 'Use this report to coordinate a confident, disciplined launch.')}</strong>
          </div>
          <div class="content-card">
            <div class="section-kicker">Launch status</div>
            <h3>${escapeHtml(readinessSummary.label || 'Needs work')}</h3>
            ${renderHighlightGrid(
              launchStatusHighlights,
              'Launch status details are reflected here from pricing, photos, and checklist progress.',
            )}
          </div>
        </div>
      </div>
      ${renderFooter('Property Summary Report · Summary')}
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
        ${pricingMetricCards}
      </div>
      <div class="content-card" style="margin-top:18px;">
        <div class="section-kicker">Pricing narrative</div>
        <h3>What supports this recommendation</h3>
        <p class="muted">${escapeHtml(pricingNarrative)}</p>
        ${renderConfidenceScale(report.pricingSummary?.confidence)}
      </div>
      <div class="dense-two-col" style="margin-top:18px;">
        <div class="sidebar-card">
          <div class="section-kicker">Pricing rationale</div>
          <h3>Comparable-based rationale</h3>
          ${renderBulletList(pricingRationaleBullets, 'Comparable sales, property condition, and launch readiness support the pricing stance shown here.')}
          <div class="page-spacer"></div>
          <div class="section-kicker">Pricing callouts</div>
          <div class="badge-row">
            ${hasMeaningfulValue(riskOpportunity.biggestRisk) ? `<div class="badge">${escapeHtml(riskOpportunity.biggestRisk)}</div>` : ''}
            ${hasMeaningfulValue(riskOpportunity.biggestOpportunity) ? `<div class="badge">${escapeHtml(riskOpportunity.biggestOpportunity)}</div>` : ''}
            ${report.pricingSummary?.confidence ? `<div class="badge">${escapeHtml(`${Math.round(report.pricingSummary.confidence * 100)}% pricing confidence`)}</div>` : ''}
          </div>
        </div>
        <div class="content-card">
          <div class="section-kicker">Comp-derived signals</div>
          <h3>What the comp set is signaling</h3>
          ${renderHighlightGrid(pricingInsightLines, 'Comparable pricing signals are summarized here from the selected sales set.')}
        </div>
      </div>
      ${pricingCompMetaCards ? `<div class="comp-meta-grid" style="margin-top:14px;">${pricingCompMetaCards}</div>` : ''}
      ${renderFooter('Property Summary Report · Pricing & Comps')}
    </section>

    ${(report.selectedComps || []).length ? `
      <section class="page">
        <div class="brand-bar">
          <div>
            <div class="section-kicker">Comparable sales</div>
            <h2>Recent nearby comps</h2>
            <p class="muted">The selected comp set and its supporting local map.</p>
          </div>
        </div>
        <div class="comp-map-stack">
        ${shouldRenderCompMap ? `
          <div class="content-card">
            <div class="section-kicker">Comp map</div>
            <div class="map-frame" style="margin-top:12px;">
              <img src="${escapeHtml(compMapImageUrl)}" alt="Comparable properties map" onerror="this.closest('.content-card').style.display='none';" />
            </div>
            <div class="legend-note">Markers use S for the subject property and A-${String.fromCharCode(64 + Math.min((report.selectedComps || []).length, 6))} for the comparable sales listed below.</div>
            <div class="comp-summary-row" style="margin-top:12px;">
              ${compStats.medianPrice ? `<div class="badge">Median comp price ${escapeHtml(formatCurrency(compStats.medianPrice))}</div>` : ''}
              ${compStats.medianPricePerSqft ? `<div class="badge">Median ${escapeHtml(formatCurrency(Math.round(compStats.medianPricePerSqft)))}/sqft</div>` : ''}
              ${compStats.closestDistance ? `<div class="badge">Closest comp ${escapeHtml(formatDistanceMiles(compStats.closestDistance))}</div>` : ''}
              <div class="badge">${escapeHtml(`${compStats.compCount || 0} selected comps`)}</div>
              <div class="badge">${escapeHtml(`Markers S and A-${String.fromCharCode(64 + Math.min((report.selectedComps || []).length, 6))}`)}</div>
            </div>
          </div>
        ` : ''}
        <div class="content-card">
          ${renderCompRows(report.selectedComps || [])}
        </div>
        </div>
        ${renderFooter('Property Summary Report · Comparable Sales')}
      </section>
    ` : ''}

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Readiness and preparation</div>
          <h2>Readiness dashboard</h2>
          <p class="muted">A structured prep dashboard showing score, risk, opportunity, top actions, and value at risk.</p>
        </div>
      </div>
      ${renderPriorityLegend()}
      <div class="dashboard-row">
        ${renderMetricCard('R Overall readiness', `${readinessSummary.overallScore || 0}/100`, readinessSummary.label || 'Needs work', readinessTone)}
        ${renderMetricCard('P Photo quality', `${photoSummary.averageQualityScore || 0}/100`, `${photoSummary.retakeCount || 0} retakes pending`)}
        ${renderMetricCard('C Checklist completion', `${checklistSummary.progressPercent || 0}%`, `${checklistSummary.completedCount || 0}/${checklistSummary.totalCount || 0} complete`)}
        ${renderMetricCard('L Launch status', readinessSummary.label || 'Needs work', consequenceFraming.summary || 'Address top blockers before listing launch.', readinessTone)}
      </div>
      <div class="dashboard-row" style="margin-top:14px;">
        <div class="callout-chip callout-chip-risk">
          <div class="metric-label">Biggest risk</div>
          <strong>${escapeHtml(summaryRisk || 'No dominant launch risk identified.')}</strong>
          <div style="margin-top:10px;"><span class="priority-badge priority-badge-p1">P1 Must fix</span></div>
        </div>
        <div class="callout-chip callout-chip-opportunity">
          <div class="metric-label">Biggest opportunity</div>
          <strong>${escapeHtml(summaryOpportunity || 'No major opportunity signal was detected.')}</strong>
          <div style="margin-top:10px;"><span class="priority-badge priority-badge-p2">P2 Should fix</span></div>
        </div>
      </div>
      <div class="content-card" style="margin-top:14px;">
        <div class="section-kicker">Top 3 actions</div>
        <h3>What to do first</h3>
        ${renderChecklistItems(
          topThreeActionLines.length ? topThreeActionLines : orderedNextSteps.slice(0, 3),
          'Use the launch checklist to define the first three prep actions.',
        )}
      </div>
      <div class="roi-hero-card" style="margin-top:14px;">
        <div class="section-kicker">Estimated value at risk</div>
        <div class="roi-hero-value">${escapeHtml(roiUpside ? `~${formatCurrency(roiUpside)} potential upside` : 'Potential upside pending')}</div>
        <div class="roi-hero-sub">${escapeHtml(roiCost ? `Estimated prep cost: ${formatCurrency(roiCost)}` : 'Estimated prep cost pending')}</div>
        <div class="roi-hero-sub">${escapeHtml(improvementEconomics.decisionMessage || improvementEconomics.summary || 'Complete the top actions to protect listing value.')}</div>
        <div class="roi-bar-shell">
          <div>
            <div class="metric-label">Potential upside</div>
            <div class="roi-bar"><div class="roi-bar-fill-upside" style="width:${roiUpsideWidth}%;"></div></div>
          </div>
          <div>
            <div class="metric-label">Estimated prep cost</div>
            <div class="roi-bar"><div class="roi-bar-fill-cost" style="width:${roiCostWidth}%;"></div></div>
          </div>
        </div>
      </div>
      ${renderFooter('Property Summary Report · Readiness & Preparation')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Preparation action cards</div>
          <h2>Ranked recommendations by category</h2>
          <p class="muted">Recommendations are grouped by category and ordered by estimated ROI and urgency.</p>
        </div>
      </div>
      ${renderPriorityLegend()}
      <div class="content-card">
        <div class="section-kicker">Structured recommendations</div>
        <h3>Action cards</h3>
        ${renderRecommendationActionCards(
          sortedRecommendationActions,
          'No structured recommendation actions were generated for this report.',
        )}
      </div>
      ${renderFooter('Property Summary Report · Prep Action Cards')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Photo analysis</div>
          <h2>Scored photo gallery</h2>
          <p class="muted">Each selected photo includes quality score, readiness label, and one-line feedback.</p>
        </div>
      </div>
      ${renderPriorityLegend()}
      <div class="metric-grid">
        ${renderMetricCard('Total photos', String(photoSummary.totalPhotos || 0))}
        ${renderMetricCard('Marketplace-ready', String(photoSummary.listingCandidateCount || 0))}
        ${renderMetricCard('Retakes needed', String(photoSummary.retakeCount || 0), photoSummary.retakeCount ? 'Prioritize P1 retakes before listing launch.' : 'No high-priority retakes currently flagged.')}
        ${renderMetricCard('Average quality', `${photoSummary.averageQualityScore || 0}/100`)}
      </div>
      <div class="content-card" style="margin-top:14px;">
        <div class="section-kicker">Selected photos</div>
        <h3>Gallery review</h3>
        <div class="page-spacer"></div>
        ${renderPhotoTiles([heroPhoto, ...remainingPhotos].filter(Boolean), 6)}
      </div>
      ${renderFooter('Property Summary Report · Photo Gallery')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Action plan</div>
          <h2>Providers, next steps, and buyer fit</h2>
          <p class="muted">Use this page to coordinate launch support, sequence your next moves, and sharpen buyer-facing messaging.</p>
        </div>
      </div>
      <div class="action-plan-grid">
        <div class="section-stack">
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
          </div>
          ` : ''}
        </div>
        <div class="section-stack">
          <div class="content-card">
            <div class="section-kicker">Provider recommendations</div>
            <h3>Marketplace support nearby</h3>
            <div class="page-spacer"></div>
            ${shouldRenderProviders ? renderProviderCards(providerRecommendations) : `
              <div class="empty-card">No provider recommendations were available from marketplace or nearby discovery for this run. Continue checklist progress and regenerate after provider data updates.</div>
              ${renderSuggestedCategoryCards(suggestedProviderCategories)}
            `}
          </div>
          <div class="dense-two-col">
            <div class="content-card">
              <div class="section-kicker">Top reasons to buy</div>
              <h3>Buyer-facing highlights</h3>
              ${renderBulletList(
                topReasonsToBuy,
                'This home’s strongest buyer signals center on pricing, livability, and showing-ready presentation.',
              )}
            </div>
            <div class="content-card">
              <div class="section-kicker">Launch momentum</div>
              <h3>Current marketing posture</h3>
              ${renderBulletList(
                marketingMomentum.length
                  ? marketingMomentum
                  : pickMeaningfulLines([
                      checklistSummary.totalCount ? `${checklistSummary.completedCount || 0} of ${checklistSummary.totalCount} checklist items are complete.` : '',
                      photoSummary.summary,
                      pricingInsightLines[0] || '',
                    ], 4),
                'Current launch momentum reflects pricing, photos, and checklist progress.',
              )}
            </div>
          </div>
        </div>
      </div>
      <div class="dense-two-col" style="margin-top:14px;">
        <div class="content-card">
          <div class="section-kicker">Ordered launch steps</div>
          <h3>What to do next</h3>
          ${renderChecklistItems(
            orderedNextSteps,
            'Use the guided workflow in the app to continue the launch checklist.',
          )}
        </div>
        <div class="content-card">
          <div class="section-kicker">Seller guidance</div>
          <h3>Final reminder before launch</h3>
          ${renderBulletList(
            pickMeaningfulLines([
              'Review pricing, photos, and checklist progress together before launch.',
              'Use nearby provider support if any prep item is slowing the listing launch.',
              consequenceFraming.summary || '',
              'Regenerate the brochure and seller report after major pricing or photo updates.',
              'Treat this report as the operating plan for the next showing-ready phase.',
            ], 6),
            '',
          )}
        </div>
      </div>
      <div class="seller-final-band">
        <div class="section-kicker">Final call to action</div>
        <h3>Regenerate this report after meaningful updates</h3>
        <p class="compact-copy" style="margin-top:8px;">Refresh pricing, photo selections, and checklist progress after any major improvement so the launch plan, brochure, and buyer messaging stay aligned.</p>
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
  const neighborhoodMapImageUrl = flyer._resolvedNeighborhoodMapImageUrl || buildNeighborhoodMapImageUrl(property);
  const flyerMode = String(flyer.mode || 'launch_ready').toLowerCase();
  const modeLabel = flyer.modeLabel || titleCaseLabel(flyerMode.replace(/_/g, ' '));
  const ctaLabel = flyer.callToAction || flyer?.ctaMetadata?.label || (flyerMode === 'preview' ? 'Get Property Details' : 'Request Showing');
  const ctaButtonLabel = flyer?.ctaMetadata?.label || (flyerMode === 'preview'
    ? 'Get Property Details'
    : 'Request Showing');
  const modeHeroSignal = flyerMode === 'preview'
    ? 'Preview mode: positioning this property as an early opportunity while final prep is completed.'
    : flyerMode === 'premium'
      ? 'Premium mode: polished presentation designed to convert high-intent buyer interest.'
      : 'Launch-ready mode: private showings and property-package requests available now.';
  const selectedPhotos = (flyer.selectedPhotos || []).filter((photo) => photo?.imageUrl);
  const coverPhotos = selectedPhotos.slice(0, 4);
  const hasFourPhotoCover = coverPhotos.length >= 4;
  const heroPhoto = coverPhotos[0];
  const galleryPhotos = hasFourPhotoCover ? selectedPhotos.slice(4, 8) : selectedPhotos.slice(1, 5);
  const featureTags = pickMeaningfulLines(flyer.highlights || [], 6);
  const topReasonsToBuy = [
    ...(featureTags || []),
    property?.selectedListPrice ? `Positioned at ${formatCurrency(property.selectedListPrice)}` : '',
    buildNeighborhoodContext(property),
  ]
    .filter(Boolean)
    .slice(0, 6);
  const brochureSummary = hasMeaningfulValue(flyer.summary)
    ? shortenNarrative(flyer.summary, 2)
    : 'A buyer-facing brochure designed to spotlight the home’s strongest features, neighborhood appeal, and showing-ready presentation.';
  const lifestyleContext = buildNeighborhoodContext(property);
  const featureGridItems = pickMeaningfulLines([
    ...featureTags,
    property?.selectedListPrice ? `Seller-confirmed list price ${formatCurrency(property.selectedListPrice)}` : '',
    lifestyleContext,
  ], 6);
  const shouldRenderMapPage = Boolean(neighborhoodMapImageUrl && galleryPhotos.length >= 4);
  const brochureFactBadges = pickMeaningfulLines([
    property?.bedrooms ? `${property.bedrooms} bedrooms` : '',
    property?.bathrooms ? `${property.bathrooms} bathrooms` : '',
    formatSqftValue(property?.squareFeet),
    formatPropertyTypeLabel(property?.propertyType),
    modeLabel ? `${modeLabel} mode` : '',
  ], 4);

  const body = `
    <section class="page">
      <div class="brochure-cover">
        ${
          hasFourPhotoCover
            ? `
              <div class="brochure-cover-media-grid">
                ${coverPhotos
                  .map((photo) => `<img src="${escapeHtml(photo.imageUrl || '')}" alt="${escapeHtml(photo.roomLabel || 'Property photo')}" />`)
                  .join('')}
              </div>
            `
            : heroPhoto?.imageUrl
              ? `<img src="${escapeHtml(heroPhoto.imageUrl)}" alt="${escapeHtml(heroPhoto.roomLabel || 'Hero property photo')}" />`
              : ''
        }
        <div class="brochure-cover-overlay">
          <div class="brand-kicker">Workside Home Advisor · Marketing Report</div>
          <div class="brochure-price">${escapeHtml(property?.selectedListPrice ? `Starting at ${formatCurrency(property.selectedListPrice)}` : flyer.priceText || 'Pricing on request')}</div>
          <h1>${escapeHtml(flyer.headline || property.title || 'Marketing brochure')}</h1>
          <p class="lede" style="margin-top:12px;">${escapeHtml(flyer.subheadline || brochureSummary)}</p>
          <div class="hero-signal-row" style="margin-top:14px;">
            <div class="hero-signal-chip hero-signal-chip-orange">${escapeHtml(modeHeroSignal)}</div>
          </div>
          <div class="brochure-cover-facts">
            ${brochureFactBadges.map((item) => `<div class="brochure-cover-fact">${escapeHtml(item)}</div>`).join('')}
          </div>
        </div>
      </div>
      <div class="brochure-cover-lower">
        <div class="content-card">
          <div class="section-kicker">Buyer appeal</div>
          <h3>Why this home stands out</h3>
            ${renderFeatureIconGrid(featureGridItems, 'This brochure highlights the features most likely to drive buyer interest and showing activity.')}
        </div>
        <div class="brochure-cta-card">
          <div class="section-kicker">Call to action</div>
          <h3>${escapeHtml(ctaLabel)}</h3>
          <p class="compact-copy" style="margin-top:10px;">Prepared by Workside Home Advisor to support a polished listing launch, clearer buyer positioning, and smoother showing conversations.</p>
          <div class="badge-row">
            <div class="badge badge-address">${escapeHtml(propertyAddress)}</div>
            <div class="badge badge-contact">${escapeHtml(SUPPORT_EMAIL)}</div>
          </div>
          <div class="brochure-cta-button">${escapeHtml(ctaButtonLabel)}</div>
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
        <div class="content-card marketing-gallery-card">
          <div class="section-kicker">Photo gallery</div>
          <h3>Curated image sequence</h3>
          <div class="page-spacer"></div>
          ${
            galleryPhotos.length
              ? `
                <div class="gallery-strip">
                  ${galleryPhotos
                    .map(
                      (photo) =>
                        `<img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(photo.roomLabel || 'Gallery photo')}" />`,
                    )
                    .join('')}
                </div>
              `
              : `<div class="empty-card">The brochure is currently using the strongest available photo set while additional gallery selections are still being curated.</div>`
          }
        </div>
        <div class="brochure-bottom-grid">
          <div class="content-card">
            <div class="section-kicker">Key features</div>
            <h3>Most marketable highlights</h3>
            ${renderFeatureIconGrid(featureTags.length ? featureTags : topReasonsToBuy, 'This section captures the strongest reasons a buyer would choose this home right now.')}
          </div>
          <div class="content-card">
            <div class="section-kicker">Pricing positioning</div>
            <h3>${escapeHtml(flyer.priceText || 'Pricing on request')}</h3>
            ${renderInsightList(
              pickMeaningfulLines([
                property?.selectedListPrice
                  ? `Competitively positioned at ${formatCurrency(property.selectedListPrice)} to balance value perception and buyer demand.`
                  : 'Positioned to align with recent comparable sales and current buyer demand.',
                topReasonsToBuy[0] ? `Buyer signal: ${topReasonsToBuy[0]}` : '',
              ], 3),
              '',
            )}
            <div class="page-spacer"></div>
            <div class="section-kicker">Neighborhood context</div>
            <p class="compact-copy" style="margin-top:8px;">${escapeHtml(lifestyleContext)}</p>
            ${
              neighborhoodMapImageUrl
                ? `
                  <div class="map-frame compact" style="margin-top:14px;">
                    <img src="${escapeHtml(neighborhoodMapImageUrl)}" alt="Neighborhood map" onerror="this.closest('.map-frame').style.display='none';" />
                  </div>
                `
                : ''
            }
            <div class="page-spacer"></div>
            <div class="section-kicker">Call to action</div>
            <h3>${escapeHtml(ctaLabel)}</h3>
            <p class="muted" style="margin-top:8px;">Prepared by Workside Home Advisor to support marketplace-ready marketing collateral and brochure refinement.</p>
            <div class="badge-row">
              <div class="badge badge-address">${escapeHtml(propertyAddress)}</div>
              <div class="badge badge-contact">${escapeHtml(SUPPORT_EMAIL)}</div>
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
                  <img src="${escapeHtml(neighborhoodMapImageUrl)}" alt="Neighborhood map" onerror="this.closest('.map-frame').style.display='none';" />
                </div>
                <p class="muted" style="margin-top:10px;">${escapeHtml(propertyAddress)}</p>
                <div class="badge-row">
                  <div class="badge">${escapeHtml(property?.selectedListPrice ? `Starting at ${formatCurrency(property.selectedListPrice)}` : flyer.priceText || 'Pricing on request')}</div>
                  <div class="badge">${escapeHtml(topReasonsToBuy[0] || 'Move-in ready positioning')}</div>
                </div>
              </div>
              <div class="content-card">
                <div class="section-kicker">Why this home wins</div>
                <h3>Built to convert serious buyer interest</h3>
                ${renderInsightList(
                  pickMeaningfulLines([
                    topReasonsToBuy[0],
                    topReasonsToBuy[1],
                    'A polished listing package helps move buyers from browsing to booking a showing.',
                  ], 3),
                  '',
                )}
                <div class="page-spacer"></div>
                <div class="section-kicker">Urgency and contact</div>
                <h3>${escapeHtml(ctaLabel)}</h3>
                <p class="compact-copy" style="margin-top:8px;">Prepared by Workside Home Advisor to help this listing launch with stronger buyer clarity, cleaner positioning, and a more polished first impression.</p>
                <div class="badge-row">
                  <div class="badge badge-contact">${escapeHtml(SUPPORT_EMAIL)}</div>
                  <div class="badge badge-contact">${escapeHtml(PUBLIC_WEB_URL)}</div>
                </div>
                <div class="closing-band">
                  <div class="section-kicker">Final push</div>
                  <p class="compact-copy" style="margin-top:6px;">Homes that combine clear pricing, polished photography, and a strong first showing impression create more confident buyer momentum. Schedule the showing window while buyer interest is fresh.</p>
                </div>
                <div class="brochure-cta-button">${escapeHtml(ctaButtonLabel)}</div>
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
  const html = buildPropertySummaryHtml({
    property,
    report: {
      ...report,
      _resolvedCompMapImageUrl: await resolveStaticMapImageUrl(
        buildComparableMapImageUrl(property, report.selectedComps || []),
      ),
    },
  });
  return renderHtmlPdf({ html, filename });
}

export async function renderMarketingReportPdf({ property, flyer, filename }) {
  const html = buildMarketingReportHtml({
    property,
    flyer: {
      ...flyer,
      _resolvedNeighborhoodMapImageUrl: await resolveStaticMapImageUrl(
        buildNeighborhoodMapImageUrl(property),
      ),
    },
  });
  return renderHtmlPdf({ html, filename });
}

function getPuppeteerLaunchOptions({ protocolTimeout = 120000 } = {}) {
  return {
    headless: 'new',
    executablePath: env.PUPPETEER_EXECUTABLE_PATH || undefined,
    protocolTimeout,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=medium',
    ],
  };
}

export async function probePdfBrowserAvailability({ timeoutMs = 12000 } = {}) {
  let browser;
  const startedAt = Date.now();
  try {
    browser = await puppeteer.launch(
      getPuppeteerLaunchOptions({
        protocolTimeout: Math.max(5000, Number(timeoutMs) || 12000),
      }),
    );
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 640, deviceScaleFactor: 1 });
    await page.setContent(
      '<!doctype html><html><head><meta charset="utf-8"></head><body>pdf-health-check</body></html>',
      { waitUntil: 'domcontentloaded' },
    );
    const browserVersion = await browser.version();
    await page.close();

    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      browserVersion,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH || 'bundled',
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH || 'bundled',
      message: error?.message || String(error),
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function renderHtmlPdf({ html, filename }) {
  let browser;
  const startedAt = Date.now();
  try {
    logPdfEvent('launch_start', {
      filename,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH || 'bundled',
      nodeEnv: env.NODE_ENV,
    });
    browser = await puppeteer.launch(getPuppeteerLaunchOptions());
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1280, height: 1660, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const bytes = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    const renderedPdf = await PDFDocument.load(bytes);
    await page.close();
    logPdfEvent('render_success', {
      filename,
      durationMs: Date.now() - startedAt,
      pageCount: renderedPdf.getPageCount(),
      bytes: bytes.length,
    });
    return { bytes, filename };
  } catch (error) {
    logPdfEvent('render_failure', {
      filename,
      durationMs: Date.now() - startedAt,
      message: error?.message || String(error),
    });
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
