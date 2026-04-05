import puppeteer from 'puppeteer';
import { formatCurrency } from '@workside/utils';

import { env } from '../../config/env.js';

const SUPPORT_EMAIL = 'support@worksidesoftware.com';

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

function renderMetricCard(label, value, support = '') {
  return `
    <div class="metric-card">
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
    return `<div class="empty-card">No internal provider recommendations are ready yet for this property.</div>`;
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
    return `<div class="empty-card">Comparable properties will appear here once pricing analysis is complete.</div>`;
  }

  return `
    <div class="comp-table">
      <div class="comp-table-head">
        <span>Comp</span>
        <span>Price</span>
        <span>Details</span>
      </div>
      ${comps
        .slice(0, 6)
        .map(
          (comp, index) => `
            <div class="comp-row">
              <div>
                <strong>${String.fromCharCode(65 + index)}. ${escapeHtml(comp.address || 'Comparable property')}</strong>
                <div class="muted">${escapeHtml(comp.soldDate || comp.listedDate || '')}</div>
              </div>
              <div><strong>${escapeHtml(formatCurrency(comp.price || 0))}</strong></div>
              <div class="muted">${escapeHtml(
                `${comp.beds || '--'} bd • ${comp.baths || '--'} ba • ${comp.sqft || '--'} sqft • ${(Number(comp.distanceMiles || 0)).toFixed(2)} mi`,
              )}</div>
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
        ${escapeHtml(String(env.PUBLIC_WEB_URL || 'https://worksideadvisor.com'))}
      </div>
      <div>
        ${escapeHtml(SUPPORT_EMAIL)}<br/>
        ${escapeHtml(pageLabel)}
      </div>
    </footer>
  `;
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
      .metric-card { padding: 14px 16px; }
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
      .comp-table-head, .comp-row { display: grid; grid-template-columns: 1.35fr 0.55fr 1.1fr; gap: 14px; align-items: start; }
      .comp-table-head { padding: 0 4px; text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); }
      .comp-row { border: 1px solid var(--line); background: rgba(255,255,255,0.88); border-radius: 18px; padding: 14px 16px; }
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
      .gallery-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .gallery-strip img {
        width: 100%;
        height: 170px;
        object-fit: cover;
        display: block;
        border-radius: 16px;
        border: 1px solid var(--line);
      }
      .two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
      .badge-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .badge { padding: 8px 12px; border-radius: 999px; background: var(--moss-soft); color: var(--moss); font-size: 12px; font-weight: 600; }
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
  const featureTags = propertyDetails.featureTags || [];
  const topReasonsToBuy = buyerPersonaSummary.topReasonsToBuy || [];

  const body = `
    <section class="page hero-page">
      <div>
        <div class="brand-kicker">Workside Home Advisor · Seller Intelligence Report</div>
        <h1>${escapeHtml(report.title || property.title || 'Property Summary Report')}</h1>
        <p class="lede" style="margin-top:12px;">${escapeHtml(report.executiveSummary || '')}</p>
        <div class="summary-grid" style="margin-top:22px;">
          ${renderMetricCard('Readiness', `${readinessSummary.overallScore || 0}/100`, readinessSummary.label || 'Needs Work')}
          ${renderMetricCard('Selected price', property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set', report.pricingSummary?.mid ? `Suggested midpoint ${formatCurrency(report.pricingSummary.mid)}` : 'Pricing recommendation pending')}
          ${renderMetricCard('Photo coverage', `${photoSummary.roomCoverageCount || 0}/5 rooms`, `${photoSummary.totalPhotos || 0} photos · ${photoSummary.listingCandidateCount || 0} listing-ready`)}
          ${renderMetricCard('Checklist', `${checklistSummary.progressPercent || 0}% complete`, `${checklistSummary.completedCount || 0} complete · ${checklistSummary.openCount || 0} open`)}
        </div>
        <div class="cta-band">
          <div class="cta-label">Report date</div>
          <p class="lede">${escapeHtml(formatDateLabel(report.updatedAt || report.createdAt || new Date()))}</p>
          ${renderBulletList(
            [
              report.payload?.improvementGuidance?.summary,
              ...(report.improvementItems || []).slice(0, 3),
            ],
            'Use the guided workflow to continue improving readiness and launch confidence.',
          )}
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
        ${renderMetricCard('Midpoint', report.pricingSummary?.mid ? formatCurrency(report.pricingSummary.mid) : '—', report.pricingSummary?.confidence ? `${Math.round(report.pricingSummary.confidence * 100)}% confidence` : 'Confidence pending')}
        ${renderMetricCard('Chosen price', property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set', property?.selectedListPrice ? 'Seller-confirmed' : 'Set in pricing tab')}
        ${renderMetricCard('Selected comps', String((report.selectedComps || []).length), 'Top market references included')}
      </div>
      <div class="section-grid">
        <div class="content-card">
          <div class="section-kicker">Comp map</div>
          <div class="map-frame" style="margin-top:12px;">
            ${compMapImageUrl ? `<img src="${escapeHtml(compMapImageUrl)}" alt="Comparable properties map" />` : ''}
          </div>
        </div>
        <div class="sidebar-card">
          <div class="section-kicker">Pricing narrative</div>
          <h3>${escapeHtml(report.payload?.listingDescriptions?.shortDescription || 'Pricing recommendation')}</h3>
          <p class="muted" style="margin-top:8px;">${escapeHtml(report.pricingSummary?.narrative || 'Pricing narrative is not available yet.')}</p>
          <div class="page-spacer"></div>
          <div class="section-kicker">Risk and opportunity</div>
          <p class="muted" style="margin-top:8px;"><strong>${escapeHtml(riskOpportunity.biggestRisk || 'Risk pending')}</strong></p>
          <p class="muted" style="margin-top:8px;">${escapeHtml(riskOpportunity.biggestOpportunity || 'Opportunity pending')}</p>
        </div>
      </div>
      <div class="content-card" style="margin-top:18px;">
        <div class="section-kicker">Comparable properties</div>
        <h3>Recent nearby comps</h3>
        <div class="page-spacer"></div>
        ${renderCompRows(report.selectedComps || [])}
      </div>
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
            ${renderBulletList(report.improvementItems || [], 'Improvement recommendations will appear as pricing, photos, and checklist inputs mature.')}
          </div>
          <div class="sidebar-card">
            <div class="section-kicker">Cost and ROI</div>
            <h3>${escapeHtml(improvementEconomics.summary || 'Improvement economics pending')}</h3>
            <div class="badge-row">
              ${improvementEconomics.estimatedCost ? `<div class="badge">Est. cost ${escapeHtml(formatCurrency(improvementEconomics.estimatedCost))}</div>` : ''}
              ${improvementEconomics.estimatedRoi ? `<div class="badge">Potential ROI ${escapeHtml(formatCurrency(improvementEconomics.estimatedRoi))}</div>` : ''}
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
        <div class="content-card">
          <div class="section-kicker">Property details</div>
          <h3>Core home facts</h3>
          <div class="metric-grid" style="grid-template-columns:repeat(2, minmax(0,1fr)); margin-top:12px;">
            ${renderMetricCard('Bedrooms', propertyDetails.bedrooms || '--')}
            ${renderMetricCard('Bathrooms', propertyDetails.bathrooms || '--')}
            ${renderMetricCard('Interior', propertyDetails.squareFeet ? `${propertyDetails.squareFeet} sqft` : '--')}
            ${renderMetricCard('Lot / year', propertyDetails.yearBuilt ? `${propertyDetails.yearBuilt}` : '—', propertyDetails.lotSizeSqFt ? `${propertyDetails.lotSizeSqFt} lot sqft` : '')}
          </div>
        </div>
        <div class="content-card">
          <div class="section-kicker">Buyer persona</div>
          <h3>Who this home should resonate with</h3>
          <p class="muted" style="margin-top:8px;">${escapeHtml(buyerPersonaSummary.buyerPersona || 'Buyer persona guidance will appear once marketing signals are available.')}</p>
          <div class="page-spacer"></div>
          <div class="section-kicker">Top reasons to buy</div>
          ${renderBulletList(topReasonsToBuy, 'Key buyer-facing reasons will appear once pricing and marketing guidance are available.')}
        </div>
      </div>
      <div class="content-card" style="margin-top:18px;">
        <div class="section-kicker">Provider recommendations</div>
        <h3>Marketplace support nearby</h3>
        <div class="page-spacer"></div>
        ${renderProviderCards(providerRecommendations)}
      </div>
      <div class="two-col" style="margin-top:18px;">
        <div class="content-card">
          <div class="section-kicker">Next steps</div>
          <h3>Ordered launch plan</h3>
          ${renderBulletList(
            nextSteps.map((step) => `${step.title} (${step.eta}, ${step.owner})`),
            'No action plan has been generated yet.',
          )}
        </div>
        <div class="content-card">
          <div class="section-kicker">Checklist and marketing</div>
          <h3>Current momentum</h3>
          ${renderBulletList(report.marketingHighlights || [], 'Marketing highlights will appear here after brochure and report signals are generated.')}
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
  const galleryPhotos = selectedPhotos.slice(1, 4);
  const featureTags = (flyer.highlights || []).filter(Boolean);
  const topReasonsToBuy = [
    ...(featureTags || []),
    property?.selectedListPrice ? `Positioned at ${formatCurrency(property.selectedListPrice)}` : '',
    'Designed to convert interest into showings',
  ]
    .filter(Boolean)
    .slice(0, 5);

  const body = `
    <section class="page hero-page">
      <div>
        <div class="brand-kicker">Workside Home Advisor · Marketing Report</div>
        <h1>${escapeHtml(flyer.headline || property.title || 'Marketing brochure')}</h1>
        <p class="lede" style="margin-top:14px;">${escapeHtml(flyer.subheadline || '')}</p>
        <div class="summary-grid" style="margin-top:24px;">
          ${renderMetricCard('List price', flyer.priceText || 'Pricing on request', property?.selectedListPrice ? 'Seller-confirmed list price' : 'Suggested market positioning')}
          ${renderMetricCard('Highlights', `${property?.bedrooms || '--'} bd · ${property?.bathrooms || '--'} ba`, `${property?.squareFeet || '--'} sqft · ${property?.propertyType || 'Residential home'}`)}
          ${renderMetricCard('Location', property?.city || 'Property city', property?.state || '')}
          ${renderMetricCard('CTA', flyer.callToAction || 'Schedule a showing')}
        </div>
        <div class="feature-grid" style="margin-top:18px;">
          ${featureTags.map((tag) => `<div class="feature-pill">${escapeHtml(tag)}</div>`).join('')}
        </div>
        <div class="cta-band">
          <div class="cta-label">Lifestyle description</div>
          <p class="lede">${escapeHtml(flyer.summary || '')}</p>
        </div>
      </div>
      <div>
        <div class="hero-photo">
          ${heroPhoto?.imageUrl ? `<img src="${escapeHtml(heroPhoto.imageUrl)}" alt="${escapeHtml(heroPhoto.roomLabel || 'Hero property photo')}" />` : ''}
        </div>
        <p class="muted" style="margin-top:10px;">${escapeHtml(propertyAddress)}</p>
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
                <div class="gallery-strip">
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
        <div class="two-col">
          <div class="content-card">
            <div class="section-kicker">Key features</div>
            <h3>Top reasons to buy</h3>
            ${renderBulletList(topReasonsToBuy, 'Top buyer-facing reasons will appear here once the marketing set is finalized.')}
          </div>
          <div class="content-card">
            <div class="section-kicker">Call to action</div>
            <h3>${escapeHtml(flyer.callToAction || 'Schedule a showing')}</h3>
            <p class="muted" style="margin-top:8px;">Prepared by Workside Home Advisor to support listing-ready marketing collateral and brochure refinement.</p>
            <div class="badge-row">
              <div class="badge">${escapeHtml(propertyAddress)}</div>
              <div class="badge">${escapeHtml(SUPPORT_EMAIL)}</div>
            </div>
          </div>
        </div>
        <div class="two-col">
          <div class="content-card">
            <div class="section-kicker">Neighborhood</div>
            <h3>Local context</h3>
            <div class="map-frame" style="margin-top:12px;">
              ${neighborhoodMapImageUrl ? `<img src="${escapeHtml(neighborhoodMapImageUrl)}" alt="Neighborhood map" />` : ''}
            </div>
          </div>
          <div class="content-card">
            <div class="section-kicker">Pricing positioning</div>
            <h3>${escapeHtml(flyer.priceText || 'Pricing on request')}</h3>
            <p class="muted" style="margin-top:8px;">${escapeHtml(
              property?.selectedListPrice
                ? 'The marketing brochure uses the seller-confirmed price so buyer-facing materials stay consistent.'
                : 'This brochure reflects the current pricing recommendation and should be refreshed if the list price changes.',
            )}</p>
            <div class="page-spacer"></div>
            <div class="section-kicker">Contact</div>
            <p class="muted" style="margin-top:8px;">${escapeHtml(SUPPORT_EMAIL)}</p>
            <p class="muted">${escapeHtml(String(env.PUBLIC_WEB_URL || 'https://worksideadvisor.com'))}</p>
          </div>
        </div>
      </div>
      ${renderFooter('Marketing Report · Gallery & Positioning')}
    </section>
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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=medium'],
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
