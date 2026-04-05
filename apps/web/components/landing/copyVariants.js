function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

export function resolveTrafficSource({ source = '', campaign = '', medium = '' } = {}) {
  const combined = [source, campaign, medium]
    .map((item) => normalizeValue(item))
    .filter(Boolean)
    .join(' ');

  if (combined.includes('instagram') || combined.includes('insta') || combined.includes('ig')) {
    return 'instagram';
  }

  if (combined.includes('facebook') || combined.includes('fb') || combined.includes('meta')) {
    return 'facebook';
  }

  return 'default';
}

export function getSellerLandingVariant(context = {}) {
  const trafficSource = resolveTrafficSource(context);

  if (trafficSource === 'instagram') {
    return {
      heroEyebrow: 'Instagram seller funnel',
      heroTitle: 'See what your home could list for before you guess wrong.',
      heroSubtitle:
        'Get a fast pricing preview, prep priorities, and a clearer plan for listing-ready photos and materials in one guided flow.',
      primaryCta: 'Get my home preview',
      secondaryCta: 'See the listing plan',
      heroPanelLabel: 'Instagram-ready value',
      heroPanelBody:
        'Designed for the homeowner who wants quick clarity before committing to the full selling workflow.',
      valueItems: [
        {
          eyebrow: 'Pricing',
          title: 'Fast price range preview',
          body: 'Show the likely band first so the user feels immediate progress from the ad click.',
        },
        {
          eyebrow: 'Prep',
          title: 'Know the next move right away',
          body: 'Surface the first prep recommendations instead of making users wait for a dashboard to make sense.',
        },
        {
          eyebrow: 'Photos',
          title: 'Get listing-photo guidance early',
          body: 'Help the user understand what is hurting the listing impression before they ever hire help.',
        },
      ],
      finalTitle: 'Turn a scroll stop into a real selling plan.',
      finalBody:
        'The Instagram path should feel fast, visual, and confidence-building from the very first property preview.',
    };
  }

  if (trafficSource === 'facebook') {
    return {
      heroEyebrow: 'Facebook seller funnel',
      heroTitle: 'Get pricing guidance and a home-selling plan before you list.',
      heroSubtitle:
        'See the likely price range, prep priorities, and local help options before you commit to the full seller workspace.',
      primaryCta: 'Start my home plan',
      secondaryCta: 'See how it works',
      heroPanelLabel: 'Facebook-ready value',
      heroPanelBody:
        'Built for homeowners who want reassurance, structure, and a clear next step before signing up.',
      valueItems: [
        {
          eyebrow: 'Guidance',
          title: 'Understand the likely list range',
          body: 'Show homeowners a grounded pricing preview that reduces uncertainty early.',
        },
        {
          eyebrow: 'Checklist',
          title: 'Know what to fix and what to ignore',
          body: 'Turn vague anxiety into a short set of visible next moves.',
        },
        {
          eyebrow: 'Support',
          title: 'Bring in help only when you need it',
          body: 'Local providers can follow the workflow instead of forcing the user into a separate search process.',
        },
      ],
      finalTitle: 'Give homeowners clarity before asking for commitment.',
      finalBody:
        'The Facebook path should feel trustworthy, practical, and easy to continue into the full workflow.',
    };
  }

  return {
    heroEyebrow: 'Seller funnel',
    heroTitle: 'Sell your home with a plan, not a guess.',
    heroSubtitle:
      'Get pricing guidance, prep recommendations, photo help, and provider matches in minutes, then move naturally into the guided workspace when you are ready.',
    primaryCta: 'Start your selling plan',
    secondaryCta: 'See how it works',
    heroPanelLabel: 'Fast value',
    heroPanelBody:
      'Start with the property basics. We will show a partial result before we ask for signup.',
    valueItems: [
      {
        eyebrow: 'Pricing',
        title: 'Smart pricing guidance',
        body: 'Show likely list bands, confidence, and how much room you have to improve before launch.',
      },
      {
        eyebrow: 'Prep',
        title: 'Guided prep checklist',
        body: 'Know what to do first instead of staring at an overwhelming repair and staging list.',
      },
      {
        eyebrow: 'Providers',
        title: 'Local help when you need it',
        body: 'Surface photographers, cleaners, inspectors, and other providers without leaving the workflow.',
      },
    ],
    finalTitle: 'Start your plan now, then let the workflow carry the rest.',
    finalBody:
      'This is the shortest path from ad click to a real property workspace with pricing, prep, providers, and exports ready to unlock.',
  };
}

export function getAgentLandingVariant(context = {}) {
  const trafficSource = resolveTrafficSource(context);

  if (trafficSource === 'instagram') {
    return {
      eyebrow: 'Instagram agent funnel',
      title: 'Show up to the listing conversation with a real plan already framed.',
      subtitle:
        'Use Workside to turn pricing, prep, providers, and marketing outputs into a seller-facing advantage before the listing is won.',
      primaryCta: 'Get agent access',
      secondaryCta: 'See workflow preview',
    };
  }

  if (trafficSource === 'facebook') {
    return {
      eyebrow: 'Facebook agent funnel',
      title: 'Win more listings with a clearer prep and presentation system.',
      subtitle:
        'Give sellers a structured, professional path from pricing through market-ready materials without juggling disconnected tools.',
      primaryCta: 'Get agent access',
      secondaryCta: 'See workflow preview',
    };
  }

  return {
    eyebrow: 'Agent funnel',
    title: 'Win more listings. Get homes market-ready faster.',
    subtitle:
      'Use branded reports, pricing guidance, guided prep flows, and provider coordination to move listings forward with less friction.',
    primaryCta: 'Get agent access',
    secondaryCta: 'See workflow preview',
  };
}

export function getProviderLandingVariant(context = {}) {
  const trafficSource = resolveTrafficSource(context);

  if (trafficSource === 'instagram') {
    return {
      eyebrow: 'Instagram provider funnel',
      title: 'Get local seller jobs without living on random directories.',
      subtitle:
        'Join the Workside provider network and show up inside real seller workflows when your category is actually needed.',
      primaryCta: 'Start provider signup',
      secondaryCta: 'Open provider portal',
    };
  }

  if (trafficSource === 'facebook') {
    return {
      eyebrow: 'Facebook provider funnel',
      title: 'Turn local service coverage into qualified seller demand.',
      subtitle:
        'Set your category, ZIP, trust profile, and service radius so homeowners and agents can find you at the right moment.',
      primaryCta: 'Start provider signup',
      secondaryCta: 'Open provider portal',
    };
  }

  return {
    eyebrow: 'Provider funnel',
    title: 'Get high-intent seller jobs delivered to you.',
    subtitle:
      'Join the Workside provider network and receive local service requests from homeowners and agents preparing homes for market.',
    primaryCta: 'Start provider signup',
    secondaryCta: 'Open provider portal',
  };
}
