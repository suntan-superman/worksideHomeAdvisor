import { env } from '../config/env.js';

const responseCache = new Map();

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.results)) {
    return value.results;
  }

  return [];
}

function buildComparableKey(comp) {
  return (
    comp?.id ||
    comp?._id ||
    comp?.propertyId ||
    comp?.formattedAddress ||
    comp?.addressLine1 ||
    comp?.address ||
    null
  );
}

function mergeComparableSets(...sets) {
  const seen = new Set();
  const merged = [];

  for (const set of sets) {
    for (const comp of toArray(set)) {
      const key = buildComparableKey(comp) || crypto.randomUUID();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(comp);
    }
  }

  return merged;
}

function getApiKey() {
  return env.RENTCAST_API_KEY || env.MARKET_DATA_API_KEY;
}

function getCacheEntry(key) {
  const entry = responseCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return entry.value;
}

function setCacheEntry(key, value) {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });
}

async function rentcastGet(pathname, searchParams) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const url = new URL(`${env.RENTCAST_BASE_URL}${pathname}`);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`RentCast request failed with status ${response.status} for ${pathname}`);
  }

  return response.json();
}

export async function fetchRentcastPricingData({
  addressLine1,
  city,
  state,
  zip,
  propertyType = 'Single Family',
  bedrooms,
  bathrooms,
  squareFootage,
  maxRadius = 2,
  compCount = 15,
  daysOld = 180,
  cacheKey,
}) {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      source: 'rentcast',
      usedLiveData: false,
      avm: null,
      comparables: [],
      warning: 'Missing RENTCAST_API_KEY. Falling back to demo comps.',
    };
  }

  if (cacheKey) {
    const cached = getCacheEntry(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const address = `${addressLine1}, ${city}, ${state} ${zip}`;
  const commonParams = {
    address,
    compCount,
    maxRadius,
    daysOld,
    propertyType,
    bedrooms,
    bathrooms,
    squareFootage,
  };

  const avm = await rentcastGet('/avm/value', commonParams);
  const avmComparables = avm?.comparables || avm?.comps || [];

  let listings = [];
  try {
    const listingsResponse = await rentcastGet('/listings/sale', commonParams);
    listings = Array.isArray(listingsResponse)
      ? listingsResponse
      : listingsResponse?.results || [];
  } catch (error) {
    listings = [];
  }

  const result = {
    source: 'rentcast',
    usedLiveData: true,
    avm,
    comparables: mergeComparableSets(avmComparables, listings),
  };

  if (cacheKey) {
    setCacheEntry(cacheKey, result);
  }

  return result;
}
