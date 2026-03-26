import { env } from '../config/env.js';

const responseCache = new Map();

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

  let listings = [];
  try {
    const listingsResponse = await rentcastGet('/listings/sale', commonParams);
    listings = Array.isArray(listingsResponse)
      ? listingsResponse
      : listingsResponse?.results || [];
  } catch (error) {
    listings = avm?.comparables || avm?.comps || [];
  }

  const result = {
    source: 'rentcast',
    usedLiveData: true,
    avm,
    comparables: listings,
  };

  if (cacheKey) {
    setCacheEntry(cacheKey, result);
  }

  return result;
}
