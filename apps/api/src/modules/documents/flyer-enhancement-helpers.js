function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRoomLabel(value) {
  return normalizeText(value).toLowerCase();
}

function roomBucket(roomLabel = '') {
  const room = normalizeRoomLabel(roomLabel);
  if (!room) {
    return 'other';
  }
  if (room.includes('exterior') || room.includes('front') || room.includes('backyard') || room.includes('yard')) {
    return 'exterior';
  }
  if (room.includes('kitchen')) {
    return 'kitchen';
  }
  if (room.includes('living') || room.includes('family') || room.includes('great room')) {
    return 'living';
  }
  if (room.includes('primary') || room.includes('bedroom')) {
    return 'bedroom';
  }
  if (room.includes('bath')) {
    return 'bathroom';
  }
  return 'other';
}

function buildPhotoScore(asset) {
  const quality = Number(asset?.analysis?.overallQualityScore || 0);
  const room = normalizeRoomLabel(asset?.roomLabel || '');
  const hasRetakeFlag = Boolean(asset?.analysis?.retakeRecommended);
  const listingBoost = asset?.listingCandidate ? 20 : 0;
  const preferredBoost = asset?.selectedVariant ? 10 : 0;
  const roomBoost = ['exterior', 'kitchen', 'living'].includes(roomBucket(room)) ? 8 : 0;
  const retakePenalty = hasRetakeFlag ? -18 : 0;
  return quality + listingBoost + preferredBoost + roomBoost + retakePenalty;
}

function sortAssetsForFlyer(assets = []) {
  return [...(assets || [])].sort((left, right) => buildPhotoScore(right) - buildPhotoScore(left));
}

function selectBalancedAssets(rankedAssets = [], selectedPhotoAssetIds = []) {
  const requestedIds = (selectedPhotoAssetIds || []).filter(Boolean);
  const byId = new Map((rankedAssets || []).map((asset) => [asset.id, asset]));
  const manualSelection = requestedIds.map((id) => byId.get(id)).filter(Boolean);
  const fallbackPool = rankedAssets.filter(
    (asset) => !manualSelection.some((selected) => selected.id === asset.id),
  );
  const orderedPool = [...manualSelection, ...fallbackPool];

  const selected = [];
  const usedBuckets = new Set();
  const prioritizedBuckets = ['exterior', 'kitchen', 'living', 'bedroom', 'bathroom'];

  for (const bucket of prioritizedBuckets) {
    const candidate = orderedPool.find(
      (asset) =>
        !selected.some((picked) => picked.id === asset.id) &&
        roomBucket(asset.roomLabel) === bucket,
    );
    if (!candidate) {
      continue;
    }
    selected.push(candidate);
    usedBuckets.add(bucket);
    if (selected.length >= 4) {
      return selected.slice(0, 4);
    }
  }

  for (const asset of orderedPool) {
    if (selected.length >= 4) {
      break;
    }
    if (selected.some((picked) => picked.id === asset.id)) {
      continue;
    }
    const bucket = roomBucket(asset.roomLabel);
    const sameBucketCount = selected.filter((picked) => roomBucket(picked.roomLabel) === bucket).length;
    if (sameBucketCount >= 2 && selected.length < 3) {
      continue;
    }
    selected.push(asset);
    usedBuckets.add(bucket);
  }

  return selected.slice(0, 4);
}

function average(values = []) {
  const numeric = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!numeric.length) {
    return 0;
  }
  return Math.round(numeric.reduce((sum, value) => sum + value, 0) / numeric.length);
}

export function deriveFlyerReadiness(selectedPhotos = []) {
  const qualityScore = average(selectedPhotos.map((photo) => Number(photo?.score || 0)));
  const marketplaceReadyCount = selectedPhotos.filter((photo) => photo?.listingCandidate).length;
  const preferredVariantCount = selectedPhotos.filter((photo) => photo?.usesPreferredVariant).length;
  const weakPhotoCount = selectedPhotos.filter((photo) => Number(photo?.score || 0) < 60).length;
  const roomDiversity = new Set(
    selectedPhotos.map((photo) => roomBucket(photo?.roomLabel || '')).filter(Boolean),
  ).size;

  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        qualityScore * 0.45 +
          marketplaceReadyCount * 15 +
          preferredVariantCount * 5 +
          roomDiversity * 5 -
          weakPhotoCount * 6,
      ),
    ),
  );

  return {
    readinessScore,
    qualityScore,
    marketplaceReadyCount,
    preferredVariantCount,
    weakPhotoCount,
    roomDiversity,
  };
}

export function selectFlyerMode({ readinessScore, marketplaceReadyCount, qualityScore }) {
  if (readinessScore >= 85 && marketplaceReadyCount >= 3 && qualityScore >= 78) {
    return 'premium';
  }
  if (readinessScore >= 62 && marketplaceReadyCount >= 2 && qualityScore >= 63) {
    return 'launch_ready';
  }
  return 'preview';
}

export function flyerModeLabel(mode = 'launch_ready') {
  if (mode === 'premium') {
    return 'Premium';
  }
  if (mode === 'preview') {
    return 'Preview';
  }
  return 'Launch-ready';
}

export function buildFlyerModeCopy({
  flyerType = 'sale',
  mode = 'launch_ready',
  propertyTitle = 'This home',
  locationLine = '',
}) {
  const listingContext = locationLine ? ` ${locationLine}.` : '';
  const modeCopy = {
    sale: {
      preview: {
        subheadline: 'Early preview with strong upside as final prep is completed.',
        summary: `${propertyTitle} is currently in pre-launch preparation mode.${listingContext} Position this as an early opportunity while high-impact photo and presentation refinements are being finalized.`,
        callToAction: 'Request the property packet and showing timeline.',
      },
      launch_ready: {
        subheadline: 'Listing-ready presentation with practical buyer appeal.',
        summary: `${propertyTitle} combines clean presentation, livable flow, and a market-ready value story.${listingContext} Use this flyer to support serious buyer conversations and showing requests.`,
        callToAction: 'Request showing details and the full property packet.',
      },
      premium: {
        subheadline: 'Premium presentation built for high-intent buyer demand.',
        summary: `${propertyTitle} is presented with a premium-quality marketing package and strong visual readiness.${listingContext} This mode is optimized for confident pricing posture and conversion-focused showing activity.`,
        callToAction: 'Schedule a private showing or request the premium packet.',
      },
    },
    rental: {
      preview: {
        subheadline: 'Early rental preview while final details are being prepared.',
        summary: `${propertyTitle} is being prepared as a high-clarity rental opportunity.${listingContext} Share this preview with qualified renters while final media refinements are completed.`,
        callToAction: 'Request availability details and the rental packet.',
      },
      launch_ready: {
        subheadline: 'Move-in-ready rental with clear everyday livability.',
        summary: `${propertyTitle} is positioned as a rental with practical flow, strong core spaces, and ready-to-tour presentation.${listingContext} Use this flyer to convert qualified inquiries into tour requests.`,
        callToAction: 'Request a tour and rental details.',
      },
      premium: {
        subheadline: 'Premium rental positioning for qualified tour demand.',
        summary: `${propertyTitle} is presented with premium-ready marketing visuals and polished renter-facing copy.${listingContext} Use this mode to attract high-intent renters and shorten decision timelines.`,
        callToAction: 'Book a priority tour and request full rental details.',
      },
    },
  };

  const group = modeCopy[flyerType === 'rental' ? 'rental' : 'sale'];
  return group[mode] || group.launch_ready;
}

export function buildFlyerCtaMetadata({
  flyerType = 'sale',
  mode = 'launch_ready',
  propertyId = '',
}) {
  const strategyByMode = {
    preview: flyerType === 'rental' ? 'request_property_packet' : 'request_property_packet',
    launch_ready: flyerType === 'rental' ? 'request_showing' : 'request_showing',
    premium: flyerType === 'rental' ? 'contact_agent' : 'request_showing',
  };
  const strategy = strategyByMode[mode] || 'request_showing';
  const map = {
    request_showing: {
      label: flyerType === 'rental' ? 'Request a tour' : 'Request showing details',
      destinationType: 'app_route',
      destinationRoute: `/properties/${propertyId || ':propertyId'}/showings/request`,
    },
    request_property_packet: {
      label: 'Request the property packet',
      destinationType: 'app_route',
      destinationRoute: `/properties/${propertyId || ':propertyId'}/packet/request`,
    },
    contact_agent: {
      label: 'Contact the listing team',
      destinationType: 'app_route',
      destinationRoute: `/properties/${propertyId || ':propertyId'}/contact`,
    },
    contact_seller: {
      label: 'Contact seller',
      destinationType: 'app_route',
      destinationRoute: `/properties/${propertyId || ':propertyId'}/contact`,
    },
    learn_more: {
      label: 'Learn more',
      destinationType: 'app_route',
      destinationRoute: `/properties/${propertyId || ':propertyId'}`,
    },
  };
  const selected = map[strategy] || map.request_showing;
  return {
    strategy,
    label: selected.label,
    destinationType: selected.destinationType,
    destinationRoute: selected.destinationRoute,
    relatedPropertyId: propertyId || '',
    priority: mode === 'premium' ? 90 : mode === 'launch_ready' ? 75 : 65,
    trackingKey: `flyer_${mode}_${strategy}`,
  };
}

export function chooseEnhancedFlyerAssets(assets = [], selectedPhotoAssetIds = []) {
  const rankedAssets = sortAssetsForFlyer(assets);
  return selectBalancedAssets(rankedAssets, selectedPhotoAssetIds);
}
