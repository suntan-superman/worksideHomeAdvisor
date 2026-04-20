export function buildAddressQuery(property) {
  return [property?.addressLine1, property?.city, property?.state, property?.zip]
    .filter(Boolean)
    .join(', ');
}

export function buildGoogleMapsRouteUrl(property, comps = []) {
  const propertyAddress = buildAddressQuery(property);
  const compAddresses = (comps || [])
    .map((comp) => comp?.address)
    .filter(Boolean)
    .slice(0, 8);

  if (!propertyAddress) {
    return null;
  }

  if (!compAddresses.length) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(propertyAddress)}`;
  }

  const [destination, ...waypoints] = compAddresses;
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', propertyAddress);
  url.searchParams.set('destination', destination);
  url.searchParams.set('travelmode', 'driving');

  if (waypoints.length) {
    url.searchParams.set('waypoints', waypoints.join('|'));
  }

  return url.toString();
}

export function formatChecklistStatus(status) {
  if (status === 'in_progress') {
    return 'In progress';
  }

  if (status === 'done') {
    return 'Done';
  }

  return 'To do';
}

export function formatChecklistCategory(category) {
  return String(category || 'custom')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatChecklistPriority(priority) {
  return `${String(priority || 'medium').replace(/\b\w/g, (character) => character.toUpperCase())} priority`;
}

export function buildDashboardFromSnapshot(snapshot = {}) {
  const latestPricing = snapshot?.pricingAnalyses?.latest || null;
  const latestFlyer = snapshot?.reports?.latestFlyer || null;
  const latestReport = snapshot?.reports?.latestReport || null;

  return {
    property: snapshot?.property || null,
    comps: latestPricing?.selectedComps || [],
    pricingSummary: latestPricing?.summary || '',
    flyer: latestFlyer,
    report: latestReport,
  };
}

export function readWorkspaceSectionState(storageKey) {
  if (typeof window === 'undefined' || !storageKey) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function readBooleanWorkspacePreference(storageKey, fallbackValue = false) {
  if (typeof window === 'undefined' || !storageKey) {
    return fallbackValue;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (rawValue == null) {
      return fallbackValue;
    }

    return rawValue === 'true';
  } catch {
    return fallbackValue;
  }
}

export function getSocialPackVariantKey(variant, index = 0) {
  return `${variant?.format || 'variant'}-${variant?.width || 0}-${variant?.height || 0}-${index}`;
}

export function getSocialPackVariantLabel(variant) {
  if (!variant) {
    return 'Social pack view';
  }

  return variant.width && variant.height
    ? `${variant.format} ${variant.width}x${variant.height}`
    : variant.format;
}

export function buildSocialPackVariantDetails(pack, variant) {
  if (!pack || !variant) {
    return null;
  }

  const normalizedFormat = String(variant.format || '').toLowerCase();
  const sections = [];
  const highlights = [];

  if (variant.width && variant.height) {
    highlights.push(`${variant.width}x${variant.height} canvas`);
  }

  if (normalizedFormat.includes('square')) {
    highlights.push('Feed-ready layout');
    sections.push(
      { label: 'Headline', value: pack.headline },
      { label: 'Short caption', value: pack.shortCaption },
      { label: 'CTA', value: pack.cta },
    );
    return {
      title: getSocialPackVariantLabel(variant),
      summary: 'Use this for square feed placements, static ads, and simple hero-image posts.',
      guidance: variant.guidance,
      highlights,
      sections,
    };
  }

  if (normalizedFormat.includes('story') || normalizedFormat.includes('reel')) {
    highlights.push('Vertical motion-friendly');
    sections.push(
      { label: 'Headline', value: pack.headline },
      { label: 'Short caption', value: pack.shortCaption },
      { label: 'CTA', value: pack.cta },
    );
    return {
      title: getSocialPackVariantLabel(variant),
      summary: 'Use this for story, reel, or vertical placements where the opening frame and CTA need to land quickly.',
      guidance: variant.guidance,
      highlights,
      sections,
    };
  }

  if (normalizedFormat.includes('ad copy')) {
    highlights.push('Long-form copy block');
    sections.push(
      { label: 'Headline', value: pack.headline },
      { label: 'Primary text', value: pack.primaryText },
      { label: 'Short caption', value: pack.shortCaption },
      { label: 'Disclaimers', value: (pack.disclaimers || []).join(' ') },
    );
    return {
      title: getSocialPackVariantLabel(variant),
      summary: 'This is the copy reference view for ad drafting, approvals, and export review.',
      guidance: variant.guidance,
      highlights,
      sections,
    };
  }

  highlights.push('Call-to-action guidance');
  sections.push(
    { label: 'Primary CTA', value: pack.cta },
    { label: 'Short caption', value: pack.shortCaption },
    {
      label: 'Compliance reminder',
      value:
        pack.disclaimers?.[0] ||
        'Review generated copy and imagery before public advertising use.',
    },
  );
  return {
    title: getSocialPackVariantLabel(variant),
    summary: 'Use this to choose the CTA language and the supporting line you want to pair with it.',
    guidance: variant.guidance,
    highlights,
    sections,
  };
}

export function formatWorkflowStatus(status) {
  if (status === 'in_progress') {
    return 'In progress';
  }
  if (status === 'complete') {
    return 'Complete';
  }
  if (status === 'blocked') {
    return 'Blocked';
  }
  if (status === 'locked') {
    return 'Locked';
  }
  return 'Available';
}

export function buildPropertyAddressLabel(property) {
  return [property?.addressLine1, property?.city, property?.state, property?.zip]
    .filter(Boolean)
    .join(', ');
}

export function buildProviderFallbackQuery(task, property) {
  const categoryQueryByKey = {
    inspector: 'home inspector',
    title_company: 'title company',
    real_estate_attorney: 'real estate attorney',
    photographer: 'real estate photographer',
    cleaning_service: 'house cleaning service',
    termite_inspection: 'termite inspection',
    notary: 'mobile notary',
    nhd_report: 'natural hazard disclosure report provider',
    staging_company: 'home staging company',
  };
  const categoryLabel =
    categoryQueryByKey[task?.providerCategoryKey] || task?.providerCategoryLabel || task?.title || 'home services';
  const addressLabel = buildPropertyAddressLabel(property);
  const fallbackLocationLabel = [property?.city, property?.state, property?.zip].filter(Boolean).join(', ');
  return [categoryLabel, addressLabel || fallbackLocationLabel || 'this property']
    .filter(Boolean)
    .join(' ');
}

export function formatProviderStatusLabel(status) {
  return String(status || 'unavailable')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatProviderLeadStatusLabel(status) {
  return formatProviderStatusLabel(status || 'open');
}

export function formatDateTimeLabel(value) {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString();
}

export function formatProviderReferenceAccessLabel(reference) {
  if (reference?.websiteUrl) {
    try {
      return new URL(reference.websiteUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'Website available';
    }
  }

  if (reference?.mapsUrl) {
    return reference?.source === 'google_maps' ? 'Google Maps reference saved' : 'Maps link available';
  }

  return 'Contact details not listed';
}

export function buildProviderCoverageGuidance(providerSuggestionTask, providerSource) {
  if (!providerSuggestionTask) {
    return null;
  }

  const categoryLabel =
    providerSource?.categoryLabel ||
    providerSuggestionTask.providerCategoryLabel ||
    providerSuggestionTask.title ||
    'providers';
  const categoryLabelLower = categoryLabel.toLowerCase();
  const liveCount = Number(providerSource?.internalProviders || 0);
  const unavailableCount = Number(providerSource?.unavailableProviders || 0);
  const externalCount = Number(providerSource?.externalProviders || 0);
  const totalMatches = Number(providerSource?.totalCategoryProviders || 0);
  const fallback = providerSource?.googleFallback || null;
  const fallbackEnabled = Boolean(providerSource?.googleFallbackEnabled || fallback?.enabled);

  if (liveCount > 0) {
    return null;
  }

  if (unavailableCount > 0) {
    const statusCounts = Object.entries(providerSource?.unavailableStatusCounts || {})
      .map(([status, count]) => `${count} ${formatProviderStatusLabel(status).toLowerCase()}`)
      .join(', ');

    return {
      tone: 'setup',
      eyebrow: 'Coverage status',
      title: `No live ${categoryLabelLower} yet`,
      message: `Workside found matching providers for this property, but they are still completing onboarding and marketplace setup.`,
      highlights: [
        `${unavailableCount} matching provider${unavailableCount === 1 ? '' : 's'} still in setup`,
        statusCounts || null,
        fallbackEnabled ? 'Google fallback is ready for backup search' : 'Google fallback is not available in this session',
      ].filter(Boolean),
      nextStep: fallbackEnabled
        ? 'Use Google fallback or the live map search below if you need an outside option before these providers go live.'
        : 'These providers should appear here automatically once they are approved and fully live.',
    };
  }

  if (fallback?.triggered && fallback.status === 'results' && externalCount > 0) {
    return {
      tone: 'fallback',
      eyebrow: 'Marketplace gap',
      title: `No live Workside ${categoryLabelLower} for this property`,
      message: `There is not yet active marketplace coverage for this category at this address, so the workspace loaded outside local options from Google fallback below.`,
      highlights: [
        `${externalCount} Google fallback result${externalCount === 1 ? '' : 's'} loaded`,
        fallback.locationLabel ? `Search area: ${fallback.locationLabel}` : null,
        fallback.queryUsed ? `Query: ${fallback.queryUsed}` : null,
      ].filter(Boolean),
      nextStep: 'Review the fallback contacts below, save the best ones to the provider sheet, and keep the task moving while marketplace coverage grows.',
    };
  }

  if (fallback?.triggered && fallback.status === 'no_results') {
    return {
      tone: 'empty',
      eyebrow: 'Search result',
      title: `No nearby ${categoryLabelLower} were found in fallback search`,
      message: `Workside does not have live coverage here yet, and Google fallback did not return structured nearby results for this request.`,
      highlights: [
        fallback.locationLabel ? `Search area: ${fallback.locationLabel}` : null,
        fallback.queryUsed ? `Query: ${fallback.queryUsed}` : null,
        'Open the live map search below for a broader manual search',
      ].filter(Boolean),
      nextStep: 'If you still need coverage, open the map search below and save any promising outside contacts to the provider reference sheet.',
    };
  }

  if (fallback?.triggered && fallback.status === 'error') {
    return {
      tone: 'warning',
      eyebrow: 'Search issue',
      title: `Google fallback could not finish for ${categoryLabelLower}`,
      message:
        fallback.diagnostic ||
        'The workspace could not complete the outside-provider search right now, so only marketplace coverage is shown.',
      highlights: [
        totalMatches > 0
          ? `${totalMatches} Workside provider record${totalMatches === 1 ? '' : 's'} matched overall`
          : 'No matching Workside provider records in coverage yet',
        'You can still open the live map search below',
      ],
      nextStep: 'Try the fallback search again or continue with the live map search while we improve marketplace coverage.',
    };
  }

  if (fallbackEnabled) {
    return {
      tone: 'coverage',
      eyebrow: 'Marketplace gap',
      title: `No live Workside ${categoryLabelLower} for this property`,
      message: `This task does not yet have active marketplace coverage at the property location, but you can broaden the search with Google fallback or the live map search below.`,
      highlights: [
        totalMatches > 0
          ? `${totalMatches} Workside provider record${totalMatches === 1 ? '' : 's'} matched, but none are live here`
          : 'No matching Workside provider records in this coverage area yet',
        'Google fallback is available on demand',
      ],
      nextStep: 'Use the fallback actions below to keep the checklist moving while Workside coverage fills in.',
    };
  }

  return {
    tone: 'coverage',
    eyebrow: 'Marketplace gap',
    title: `No live ${categoryLabelLower} are available here yet`,
    message: `This property does not currently have marketplace coverage for this task, and Google fallback is not configured for this session.`,
    highlights: [
      totalMatches > 0
        ? `${totalMatches} Workside provider record${totalMatches === 1 ? '' : 's'} matched, but none are live here`
        : 'No matching Workside provider records in this coverage area yet',
    ],
    nextStep: 'You can keep moving with the rest of the checklist now, then revisit this step when provider coverage expands.',
  };
}

export function buildProviderSourceSummary(providerSource) {
  if (!providerSource) {
    return '';
  }

  const totalMatches = Number(providerSource.totalCategoryProviders || 0);
  const liveMatches = Number(providerSource.internalProviders || 0);
  const unavailableMatches = Number(providerSource.unavailableProviders || 0);
  const externalMatches = Number(providerSource.externalProviders || 0);
  const parts = [];

  if (totalMatches > 0) {
    parts.push(
      `${totalMatches} matching Workside provider record(s): ${liveMatches} live${unavailableMatches ? ` · ${unavailableMatches} still in setup` : ''}`,
    );
  } else {
    parts.push('No Workside provider records match this category and coverage yet');
  }

  if (externalMatches > 0) {
    parts.push(`${externalMatches} external Google fallback result(s) loaded separately`);
  } else if (providerSource.googleFallbackEnabled) {
    parts.push('Google fallback available if you want broader local search');
  } else {
    parts.push('Google fallback unavailable for this browser session');
  }

  return parts.join(' · ');
}

export function buildGoogleFallbackSummary(providerSource) {
  const fallback = providerSource?.googleFallback || null;
  if (!fallback?.enabled) {
    return 'Google fallback is not configured yet, so this workspace can only show Workside marketplace coverage.';
  }

  if (!fallback.triggered) {
    return 'Google fallback is available if you want to broaden the search beyond Workside providers.';
  }

  if (fallback.status === 'results') {
    return `Google fallback found ${fallback.resultCount || 0} result(s) using ${fallback.searchMode === 'places_legacy_textsearch' ? 'legacy text search' : 'Places search'}${fallback.queryUsed ? ` for "${fallback.queryUsed}"` : ''}.`;
  }

  if (fallback.status === 'no_results') {
    return `Google fallback did not return structured results${fallback.locationLabel ? ` near ${fallback.locationLabel}` : ''}${fallback.queryUsed ? ` for "${fallback.queryUsed}"` : ''}.`;
  }

  if (fallback.status === 'error') {
    return fallback.diagnostic || 'Google fallback search could not be completed at this time.';
  }

  return providerSource?.googleFallbackDiagnostic || 'Google fallback is available on demand.';
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Could not read ${file?.name || 'file'}.`));
    reader.readAsDataURL(file);
  });
}
