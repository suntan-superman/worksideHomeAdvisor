export function formatCurrency(value) {
  if (typeof value !== 'number') {
    return '$0';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function createSlug(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function average(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return 0;
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeUsPhoneToE164(value) {
  const digits = normalizePhoneDigits(value);

  if (!digits) {
    return '';
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return '';
}

export function isValidUsPhone(value) {
  return Boolean(normalizeUsPhoneToE164(value));
}

export function formatPhoneForDisplay(value) {
  const digits = normalizePhoneDigits(value);
  const normalized = digits.length === 11 && digits.startsWith('1')
    ? digits.slice(1)
    : digits.slice(0, 10);

  if (!normalized) {
    return '';
  }

  if (normalized.length < 4) {
    return `(${normalized}`;
  }

  if (normalized.length < 7) {
    return `(${normalized.slice(0, 3)}) ${normalized.slice(3)}`;
  }

  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6, 10)}`;
}

function normalizeTextToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeFreeText(value) {
  return String(value || '').trim();
}

const CAMPAIGN_ALIAS_ENTRIES = [
  {
    canonical: 'pricing_preview',
    aliases: [
      'pricing_preview',
      'pricing_preview_sellers',
      'price_preview',
      'price-range-preview',
      'price_range_preview',
      'home_value',
      'homevalue',
      'home_worth',
      'what_is_my_home_worth',
      'seller_pricing_preview',
    ],
  },
  {
    canonical: 'prep_checklist',
    aliases: [
      'prep_checklist',
      'prep',
      'declutter',
      'decluttering',
      'staging',
      'stage',
      'home_prep',
      'prep_before_listing',
      'listing_prep',
      'seller_prep',
    ],
  },
  {
    canonical: 'photo_ready',
    aliases: [
      'photo_ready',
      'photo-ready',
      'listing_photos',
      'listing_photo',
      'listing-photos',
      'photo_quality',
      'vision',
      'brochure',
      'flyer',
      'report',
      'marketing_materials',
    ],
  },
  {
    canonical: 'listing_presentation',
    aliases: [
      'listing_presentation',
      'listing-presentation',
      'seller_presentation',
      'win_listings',
      'listing_pitch',
    ],
  },
  {
    canonical: 'agent_pipeline',
    aliases: [
      'agent_pipeline',
      'pipeline',
      'scale_listings',
      'multiple_listings',
      'agent_capacity',
      'listing_capacity',
    ],
  },
  {
    canonical: 'local_leads',
    aliases: [
      'local_leads',
      'lead_generation',
      'book_more_jobs',
      'qualified_jobs',
      'provider_leads',
    ],
  },
  {
    canonical: 'trusted_provider',
    aliases: [
      'trusted_provider',
      'trusted-provider',
      'verification',
      'verify',
      'approved_provider',
      'provider_trust',
    ],
  },
];

const CAMPAIGN_ALIAS_MAP = new Map();

for (const entry of CAMPAIGN_ALIAS_ENTRIES) {
  for (const alias of entry.aliases) {
    CAMPAIGN_ALIAS_MAP.set(normalizeTextToken(alias), entry.canonical);
  }
}

export function resolveTrafficPlatform({ source = '', campaign = '', medium = '' } = {}) {
  const combined = [source, campaign, medium]
    .map((value) => normalizeTextToken(value))
    .filter(Boolean)
    .join('_');

  if (
    combined.includes('instagram') ||
    combined.includes('insta') ||
    combined.includes('_ig') ||
    combined.startsWith('ig_') ||
    combined === 'ig'
  ) {
    return 'instagram';
  }

  if (
    combined.includes('facebook') ||
    combined.includes('_fb') ||
    combined.startsWith('fb_') ||
    combined === 'fb' ||
    combined.includes('meta')
  ) {
    return 'facebook';
  }

  if (combined.includes('google') || combined.includes('search') || combined.includes('gads')) {
    return 'google';
  }

  return 'direct';
}

export function normalizeCampaignName(value, fallback = 'general') {
  const normalized = normalizeTextToken(value);
  if (!normalized) {
    return fallback;
  }

  return CAMPAIGN_ALIAS_MAP.get(normalized) || normalized;
}

export function normalizeLandingAttribution(input = {}) {
  const anonymousId = normalizeFreeText(input.anonymousId || '');
  const source = normalizeTextToken(input.source || input.src || input.utm_source);
  const medium = normalizeTextToken(input.medium || input.utm_medium);
  const campaign = normalizeCampaignName(input.campaign || input.utm_campaign || '');
  const adset = normalizeCampaignName(input.adset || input.utm_adset || '', '');
  const ad = normalizeCampaignName(input.ad || input.utm_content || '', '');
  const platform = resolveTrafficPlatform({ source, campaign, medium });
  const roleIntent = normalizeTextToken(input.roleIntent || input.role || '');
  const route = normalizeFreeText(input.route || '');

  return {
    anonymousId,
    platform,
    source: source || platform || 'direct',
    medium: medium || (platform === 'direct' ? 'organic' : 'paid_social'),
    campaign,
    adset,
    ad,
    roleIntent,
    route,
    landingPath: normalizeFreeText(input.landingPath || ''),
    referrer: normalizeFreeText(input.referrer || ''),
  };
}

export function buildAttributionKey(attribution = {}) {
  const normalized = normalizeLandingAttribution(attribution);
  return [
    normalized.platform,
    normalized.source,
    normalized.medium,
    normalized.campaign,
    normalized.adset || 'na',
    normalized.ad || 'na',
    normalized.roleIntent || 'unknown',
  ].join(':');
}

export function buildLandingSearchParams(attribution = {}, extras = {}) {
  const normalized = normalizeLandingAttribution(attribution);
  const search = new URLSearchParams();

  if (normalized.source) {
    search.set('src', normalized.source);
  }
  if (normalized.medium) {
    search.set('medium', normalized.medium);
  }
  if (normalized.campaign) {
    search.set('campaign', normalized.campaign);
  }
  if (normalized.adset) {
    search.set('adset', normalized.adset);
  }
  if (normalized.ad) {
    search.set('ad', normalized.ad);
  }
  if (attribution.anonymousId) {
    search.set('anonymousId', String(attribution.anonymousId).trim());
  }

  for (const [key, value] of Object.entries(extras || {})) {
    if (value === undefined || value === null) {
      continue;
    }
    const normalizedValue = String(value).trim();
    if (!normalizedValue) {
      continue;
    }
    search.set(key, normalizedValue);
  }

  return search;
}
