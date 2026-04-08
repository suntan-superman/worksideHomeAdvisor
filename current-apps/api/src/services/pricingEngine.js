function roundCurrency(value) {
  return Math.round(value / 1000) * 1000;
}

function numberOrZero(...values) {
  for (const value of values) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }

  return 0;
}

function numberOrNull(...values) {
  for (const value of values) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return null;
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizePropertyType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function monthsBetween(dateString, now = new Date()) {
  if (!dateString) {
    return 12;
  }

  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 30.4375);
}

export function buildCompCacheKey(subject) {
  const sqftBucket = Math.round((Number(subject.squareFeet || 0) || 0) / 250) * 250;
  return [subject.zip, subject.bedrooms, subject.bathrooms, sqftBucket].join(':');
}

export function normalizeComp(rawComp, subject) {
  const price = numberOrZero(
    rawComp.price,
    rawComp.lastSalePrice,
    rawComp.salePrice,
    rawComp.listPrice,
    rawComp.closePrice,
  );
  const sqft = numberOrZero(rawComp.squareFootage, rawComp.livingArea, rawComp.sqft);
  const beds = numberOrZero(rawComp.bedrooms, rawComp.beds);
  const baths = numberOrZero(rawComp.bathrooms, rawComp.baths);
  const distanceMiles = numberOrZero(
    rawComp.distance,
    rawComp.distanceMiles,
    rawComp.miles,
    rawComp.distanceFromSubject,
  );
  const saleDate =
    rawComp.saleDate ||
    rawComp.lastSaleDate ||
    rawComp.soldDate ||
    rawComp.closedDate ||
    rawComp.listedDate ||
    null;
  const pricePerSqft = sqft > 0 ? price / sqft : 0;
  const propertyType =
    rawComp.propertyType || rawComp.type || rawComp.homeType || subject.propertyType;
  const listingType =
    rawComp.listingType ||
    rawComp.status ||
    rawComp.listingStatus ||
    (saleDate ? 'sold' : 'sale');
  const latitude = numberOrNull(
    rawComp.latitude,
    rawComp.lat,
    rawComp.location?.lat,
    rawComp.location?.latitude,
    rawComp.coordinates?.lat,
    rawComp.coordinates?.latitude,
  );
  const longitude = numberOrNull(
    rawComp.longitude,
    rawComp.lng,
    rawComp.lon,
    rawComp.location?.lng,
    rawComp.location?.longitude,
    rawComp.coordinates?.lng,
    rawComp.coordinates?.longitude,
  );

  return {
    _id: String(rawComp.id || rawComp._id || rawComp.propertyId || crypto.randomUUID()),
    propertyId: subject.id || subject.propertyId || 'subject-property',
    address: rawComp.formattedAddress || rawComp.addressLine1 || rawComp.address || '',
    price,
    sqft,
    beds,
    baths,
    pricePerSqft,
    distanceMiles,
    saleDate,
    daysOnMarket: Number(rawComp.daysOnMarket || 0) || undefined,
    propertyType,
    listingType,
    latitude,
    longitude,
    score: undefined,
    raw: rawComp,
    createdAt: new Date().toISOString(),
  };
}

export function filterComparableSales(comps, subject) {
  const subjectSqft = Number(subject.squareFeet || 0);
  const subjectType = normalizePropertyType(subject.propertyType);

  return comps.filter((comp) => {
    if (!comp.distanceMiles || comp.distanceMiles > 2) {
      return false;
    }

    if (monthsBetween(comp.saleDate) > 12) {
      return false;
    }

    if (subjectSqft > 0 && comp.sqft > 0) {
      const sqftDiffRatio = Math.abs(comp.sqft - subjectSqft) / subjectSqft;
      if (sqftDiffRatio > 0.5) {
        return false;
      }
    }

    const compType = normalizePropertyType(comp.propertyType);
    if (subjectType && compType && compType !== subjectType) {
      return false;
    }

    return true;
  });
}

export function scoreComparableSales(comps, subject) {
  const subjectSqft = Number(subject.squareFeet || 0) || 1;
  const subjectBeds = Number(subject.bedrooms || 0);
  const subjectBaths = Number(subject.bathrooms || 0);
  const subjectType = normalizePropertyType(subject.propertyType);

  return comps
    .map((comp) => {
      const distanceScore = clamp(1 - comp.distanceMiles / 2, 0, 1);
      const sqftScore = clamp(1 - Math.abs(comp.sqft - subjectSqft) / subjectSqft, 0, 1);
      const bedBathGap =
        Math.abs((comp.beds || 0) - subjectBeds) + Math.abs((comp.baths || 0) - subjectBaths);
      const bedBathScore = clamp(1 - bedBathGap / 4, 0, 1);
      const recencyScore = clamp(1 - monthsBetween(comp.saleDate) / 12, 0, 1);
      const typeScore =
        normalizePropertyType(comp.propertyType) === subjectType ? 1 : 0;
      const velocityScore = comp.daysOnMarket
        ? clamp(1 - comp.daysOnMarket / 90, 0, 1)
        : 0.5;

      const score =
        distanceScore * 0.25 +
        sqftScore * 0.2 +
        bedBathScore * 0.15 +
        recencyScore * 0.2 +
        typeScore * 0.1 +
        velocityScore * 0.1;

      return {
        ...comp,
        score: Number(score.toFixed(4)),
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function calculatePricingFromComps(comps, subject) {
  const selectedComps = comps.slice(0, 10);
  const pricePerSqftValues = selectedComps
    .map((comp) => comp.pricePerSqft)
    .filter((value) => Number.isFinite(value) && value > 0);
  const medianPricePerSqft = median(pricePerSqftValues);
  const subjectSqft = Number(subject.squareFeet || 0);
  const basePrice = medianPricePerSqft * subjectSqft;
  const variance =
    pricePerSqftValues.length > 1
      ? (Math.max(...pricePerSqftValues) - Math.min(...pricePerSqftValues)) / medianPricePerSqft
      : 0;

  let spread = 0.03;
  if (selectedComps.length < 3 || variance > 0.15) {
    spread = 0.05;
  }

  const low = roundCurrency(basePrice * (1 - spread));
  const mid = roundCurrency(basePrice);
  const high = roundCurrency(basePrice * (1 + spread));

  let confidence = 0.82;
  if (selectedComps.length < 3) {
    confidence = 0.45;
  } else if (selectedComps.length < 5) {
    confidence = 0.62;
  } else if (variance > 0.15) {
    confidence = 0.58;
  } else if (variance > 0.1) {
    confidence = 0.7;
  }

  return {
    selectedComps,
    medianPricePerSqft: Number(medianPricePerSqft.toFixed(2)),
    range: {
      low,
      mid,
      high,
    },
    variance: Number(variance.toFixed(3)),
    confidence: Number(confidence.toFixed(2)),
  };
}

export function calculatePricingFromAvm(avm, subject) {
  const subjectSqft = Number(subject.squareFeet || 0);
  const low =
    numberOrZero(
      avm?.priceRangeLow,
      avm?.low,
      avm?.valueRangeLow,
      avm?.lowerValue,
      avm?.lower,
    ) || 0;
  const high =
    numberOrZero(
      avm?.priceRangeHigh,
      avm?.high,
      avm?.valueRangeHigh,
      avm?.upperValue,
      avm?.upper,
    ) || 0;
  const mid =
    numberOrZero(
      avm?.price,
      avm?.value,
      avm?.avm,
      avm?.estimatedValue,
      avm?.priceEstimate,
    ) || 0;

  const resolvedMid =
    mid ||
    (low > 0 && high > 0 ? (low + high) / 2 : 0);
  const resolvedLow = low || (resolvedMid > 0 ? resolvedMid * 0.95 : 0);
  const resolvedHigh = high || (resolvedMid > 0 ? resolvedMid * 1.05 : 0);
  const medianPricePerSqft =
    subjectSqft > 0 && resolvedMid > 0 ? resolvedMid / subjectSqft : 0;

  return {
    selectedComps: [],
    medianPricePerSqft: Number(medianPricePerSqft.toFixed(2)),
    range: {
      low: roundCurrency(resolvedLow),
      mid: roundCurrency(resolvedMid),
      high: roundCurrency(resolvedHigh),
    },
    variance: 0.08,
    confidence: 0.45,
  };
}

export function summarizePricingStrengths(comps) {
  const strengths = [];
  const risks = [];

  if (comps.length >= 5) {
    strengths.push('Strong comparable set with at least five usable nearby sales.');
  } else {
    risks.push('Limited comp count reduces pricing confidence.');
  }

  if (comps.some((comp) => comp.distanceMiles <= 0.75)) {
    strengths.push('At least one highly local comp supports neighborhood alignment.');
  }

  if (comps.some((comp) => monthsBetween(comp.saleDate) <= 3)) {
    strengths.push('Recent sales help ground the recommendation in current demand.');
  } else {
    risks.push('Most usable comps are older, so market drift may affect pricing.');
  }

  return { strengths, risks };
}
