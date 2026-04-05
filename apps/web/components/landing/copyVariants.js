function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function buildCombinedContext({ source = '', campaign = '', medium = '' } = {}) {
  return [source, campaign, medium]
    .map((item) => normalizeValue(item))
    .filter(Boolean)
    .join(' ');
}

export function resolveTrafficSource(context = {}) {
  const combined = buildCombinedContext(context);

  if (combined.includes('instagram') || combined.includes('insta') || combined.includes('ig')) {
    return 'instagram';
  }

  if (combined.includes('facebook') || combined.includes('fb') || combined.includes('meta')) {
    return 'facebook';
  }

  return 'default';
}

function withTheme(base, theme) {
  return {
    ...base,
    themeEyebrow: theme.themeEyebrow || base.themeEyebrow,
    themePills: theme.themePills || base.themePills,
    heroTitle: theme.heroTitle || base.heroTitle,
    heroSubtitle: theme.heroSubtitle || base.heroSubtitle,
    heroPanelLabel: theme.heroPanelLabel || base.heroPanelLabel,
    heroPanelBody: theme.heroPanelBody || base.heroPanelBody,
    valueItems: theme.valueItems || base.valueItems,
    pricingTitle: theme.pricingTitle || base.pricingTitle,
    pricingBody: theme.pricingBody || base.pricingBody,
    pricingBullets: theme.pricingBullets || base.pricingBullets,
    finalTitle: theme.finalTitle || base.finalTitle,
    finalBody: theme.finalBody || base.finalBody,
  };
}

function resolveSellerCampaignTheme(context = {}) {
  const combined = buildCombinedContext(context);

  if (
    combined.includes('price') ||
    combined.includes('pricing') ||
    combined.includes('value') ||
    combined.includes('worth') ||
    combined.includes('homevalue')
  ) {
    return {
      themeEyebrow: 'Pricing-first path',
      themePills: ['Price range preview', 'Confidence signal', 'List strategy'],
      heroTitle: 'See the likely list range before you overprice or undersell.',
      heroSubtitle:
        'Start with the property basics and get a pricing preview, confidence signal, and smarter next move before the full seller workflow unlocks.',
      heroPanelLabel: 'Pricing-first value',
      heroPanelBody:
        'Built for ad traffic that cares most about “what could this home realistically list for?”',
      valueItems: [
        {
          eyebrow: 'Range',
          title: 'See the likely price band quickly',
          body: 'Lead with the number homeowners care about first, then use that momentum to open the broader plan.',
        },
        {
          eyebrow: 'Confidence',
          title: 'Understand how solid the pricing signal is',
          body: 'Show that the estimate is grounded, not just a decorative calculator result.',
        },
        {
          eyebrow: 'Strategy',
          title: 'Move from price curiosity to listing strategy',
          body: 'Carry the pricing preview into the prep, photo, and marketing workflow instead of stopping at a number.',
        },
      ],
      pricingTitle: 'Pricing curiosity should flow naturally into the full seller plan.',
      pricingBody:
        'This path is strongest when the user gets a credible price range first, then sees why the deeper checklist and outputs are worth unlocking.',
      pricingBullets: [
        'Lead with the likely list band before signup.',
        'Use the readiness score to frame pricing confidence.',
        'Unlock the full seller workspace when the user wants the deeper plan.',
      ],
      finalTitle: 'Turn price curiosity into a real listing strategy.',
      finalBody:
        'This campaign works best when the price preview feels immediate and the next steps feel genuinely useful.',
    };
  }

  if (
    combined.includes('prep') ||
    combined.includes('checklist') ||
    combined.includes('declutter') ||
    combined.includes('stage') ||
    combined.includes('staging')
  ) {
    return {
      themeEyebrow: 'Prep-first path',
      themePills: ['Checklist preview', 'Prep priorities', 'Provider help'],
      heroTitle: 'Know what to do before you list, and what can wait.',
      heroSubtitle:
        'Start with a short property preview, then see the first prep actions, provider support, and market-ready momentum before the full workflow opens.',
      heroPanelLabel: 'Prep-first value',
      heroPanelBody:
        'Built for homeowners coming from ads about decluttering, staging, repairs, and listing readiness.',
      valueItems: [
        {
          eyebrow: 'Checklist',
          title: 'Show the first prep moves quickly',
          body: 'Reduce overwhelm by surfacing a few visible next steps instead of an endless home-improvement list.',
        },
        {
          eyebrow: 'Photos',
          title: 'Understand what still hurts the listing impression',
          body: 'Tie prep work directly to better listing photos and stronger marketing outputs.',
        },
        {
          eyebrow: 'Providers',
          title: 'Bring in local help only when the workflow needs it',
          body: 'Photographers, cleaners, and other providers can follow the plan instead of living in separate searches.',
        },
      ],
      pricingTitle: 'The prep path should unlock only after the first useful actions are visible.',
      pricingBody:
        'Users coming from prep ads should feel momentum from the checklist preview first, then naturally continue into the full guided workspace.',
      pricingBullets: [
        'Lead with prep clarity, not subscription language.',
        'Show the first 1–3 checklist actions before signup.',
        'Unlock providers and exports once the user wants the deeper plan.',
      ],
      finalTitle: 'Turn home-prep anxiety into a short, workable plan.',
      finalBody:
        'This campaign is strongest when the seller feels guided instead of overwhelmed.',
    };
  }

  if (
    combined.includes('photo') ||
    combined.includes('photos') ||
    combined.includes('vision') ||
    combined.includes('flyer') ||
    combined.includes('brochure') ||
    combined.includes('report')
  ) {
    return {
      themeEyebrow: 'Photos-and-materials path',
      themePills: ['Photo guidance', 'Vision help', 'Marketing outputs'],
      heroTitle: 'Get your home photo-ready before the listing goes live.',
      heroSubtitle:
        'Use Workside to improve the first visual impression, guide listing photos, and turn the property into stronger marketing materials.',
      heroPanelLabel: 'Visual-first value',
      heroPanelBody:
        'Built for ad traffic that responds to before-and-after improvements, brochure polish, and listing photo quality.',
      valueItems: [
        {
          eyebrow: 'Photos',
          title: 'See what is hurting the listing impression',
          body: 'Help the homeowner understand which rooms and shots need attention before they pay for visuals or launch materials.',
        },
        {
          eyebrow: 'Vision',
          title: 'Improve the strongest images inside the workflow',
          body: 'Photo improvement should feel connected to readiness, not like a standalone AI trick.',
        },
        {
          eyebrow: 'Materials',
          title: 'Carry the best images into reports and flyers',
          body: 'The product feels premium when the photo workflow naturally leads to seller-facing outputs.',
        },
      ],
      pricingTitle: 'Visual campaigns should naturally lead into market-ready outputs.',
      pricingBody:
        'This path works best when the user sees that photos, prep, pricing, and exports all belong to one selling plan.',
      pricingBullets: [
        'Photo quality should feel tied to listing readiness.',
        'Brochure and report value should be visible before billing.',
        'Unlock the full workspace once the user wants to save the property and move forward.',
      ],
      finalTitle: 'Turn stronger listing visuals into a stronger selling plan.',
      finalBody:
        'This campaign works when the product feels like a complete listing system, not just a photo tool.',
    };
  }

  return null;
}

function resolveAgentCampaignTheme(context = {}) {
  const combined = buildCombinedContext(context);

  if (
    combined.includes('listing') ||
    combined.includes('presentation') ||
    combined.includes('win') ||
    combined.includes('seller presentation')
  ) {
    return {
      eyebrow: 'Listing-presentation path',
      title: 'Walk into the listing conversation with a real plan already framed.',
      subtitle:
        'Use Workside to show pricing, prep, providers, and materials in a seller-facing workflow that helps you look prepared before you ask for the listing.',
      valueItems: [
        {
          eyebrow: 'Presentation',
          title: 'Look sharper in the first seller meeting',
          body: 'Show a structured plan instead of talking in generalities about what comes next.',
        },
        {
          eyebrow: 'Workflow',
          title: 'Guide the prep work once the listing is won',
          body: 'Keep the same structure moving after the presentation instead of switching into a different process.',
        },
        {
          eyebrow: 'Outputs',
          title: 'Carry the plan into polished seller-facing materials',
          body: 'Reports and marketing outputs help the platform feel like a real listing accelerator.',
        },
      ],
      finalTitle: 'Use the pitch and the workflow as one system.',
      finalBody:
        'This campaign should feel like a listing-winning advantage first and a software tool second.',
    };
  }

  if (
    combined.includes('pipeline') ||
    combined.includes('capacity') ||
    combined.includes('multiple listings') ||
    combined.includes('scale')
  ) {
    return {
      eyebrow: 'Pipeline-management path',
      title: 'Run more active listings without losing structure.',
      subtitle:
        'Use Workside as the guided system for pricing, prep, providers, photos, and seller-facing outputs across multiple properties at once.',
      valueItems: [
        {
          eyebrow: 'Pipeline',
          title: 'Keep active listings moving with one repeatable process',
          body: 'The same property workflow can drive pricing, checklist work, provider support, and materials across the whole pipeline.',
        },
        {
          eyebrow: 'Capacity',
          title: 'Match the subscription to active listing volume',
          body: 'The billing model feels stronger when it maps to how agents really manage concurrent properties.',
        },
        {
          eyebrow: 'Clarity',
          title: 'Give sellers a more consistent experience',
          body: 'A structured system helps each listing feel organized and professionally managed.',
        },
      ],
      finalTitle: 'Treat listing operations like a system, not a scramble.',
      finalBody:
        'This campaign is strongest when the product feels like operational leverage for the agent team.',
    };
  }

  return null;
}

function resolveProviderCampaignTheme(context = {}) {
  const combined = buildCombinedContext(context);

  if (
    combined.includes('lead') ||
    combined.includes('jobs') ||
    combined.includes('demand') ||
    combined.includes('book more')
  ) {
    return {
      eyebrow: 'Lead-generation path',
      title: 'Get local seller jobs without chasing low-intent directory traffic.',
      subtitle:
        'Join the Workside network so your service appears when a seller workflow actually needs a photographer, cleaner, inspector, or other local provider.',
      valueItems: [
        {
          eyebrow: 'Demand',
          title: 'Qualified local work',
          body: 'The strongest leads come from real prep workflow needs, not generic browsing traffic.',
        },
        {
          eyebrow: 'Clarity',
          title: 'See what kind of work the marketplace sends',
          body: 'Providers should understand the category, coverage, and expectations before they ever hit billing.',
        },
        {
          eyebrow: 'Trust',
          title: 'Use verification to improve visibility',
          body: 'Profiles feel more credible when trust signals are part of the marketplace itself.',
        },
      ],
      finalTitle: 'Turn local coverage into real seller demand.',
      finalBody:
        'This campaign should make the marketplace feel like a practical lead channel, not just another profile to maintain.',
    };
  }

  if (
    combined.includes('verify') ||
    combined.includes('trusted') ||
    combined.includes('approved') ||
    combined.includes('professional')
  ) {
    return {
      eyebrow: 'Trust-and-verification path',
      title: 'Stand out with a provider profile sellers can actually trust.',
      subtitle:
        'Use Workside to show service area, category, verification signals, and profile quality in the same marketplace workflow sellers already use.',
      valueItems: [
        {
          eyebrow: 'Trust',
          title: 'Verification improves credibility at the moment of selection',
          body: 'The marketplace can distinguish between self-reported and verified information instead of hiding that difference.',
        },
        {
          eyebrow: 'Profile',
          title: 'Coverage and category setup should be clear',
          body: 'The provider should look like a good fit for the exact seller task, not just a random local business.',
        },
        {
          eyebrow: 'Placement',
          title: 'Visibility should follow profile quality',
          body: 'Premium placement makes more sense once the profile is actually ready to convert sellers.',
        },
      ],
      finalTitle: 'Make trust part of the profile, not an afterthought.',
      finalBody:
        'This campaign works best when providers can see how verification and profile quality improve marketplace visibility.',
    };
  }

  return null;
}

export function getSellerLandingVariant(context = {}) {
  const trafficSource = resolveTrafficSource(context);

  let base;
  if (trafficSource === 'instagram') {
    base = {
      heroEyebrow: 'Instagram seller funnel',
      heroTitle: 'See what your home could list for before you guess wrong.',
      heroSubtitle:
        'Get a fast pricing preview, prep priorities, and a clearer plan for listing-ready photos and materials in one guided flow.',
      primaryCta: 'Get my home preview',
      secondaryCta: 'See the listing plan',
      heroPanelLabel: 'Instagram-ready value',
      heroPanelBody:
        'Designed for the homeowner who wants quick clarity before committing to the full selling workflow.',
      themeEyebrow: 'Fast-moving funnel',
      themePills: ['Quick preview', 'Visual momentum', 'Low-friction start'],
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
      pricingTitle: 'Fast momentum first, full workspace second.',
      pricingBody:
        'The Instagram path should feel visual and immediate, with the account gate appearing only after the first useful result is visible.',
      pricingBullets: [
        'Start with a quick property preview.',
        'Use the first pricing/prep signal to build momentum.',
        'Unlock the deeper workflow once the user wants to save and continue.',
      ],
      finalTitle: 'Turn a scroll stop into a real selling plan.',
      finalBody:
        'The Instagram path should feel fast, visual, and confidence-building from the very first property preview.',
    };
  } else if (trafficSource === 'facebook') {
    base = {
      heroEyebrow: 'Facebook seller funnel',
      heroTitle: 'Get pricing guidance and a home-selling plan before you list.',
      heroSubtitle:
        'See the likely price range, prep priorities, and local help options before you commit to the full seller workspace.',
      primaryCta: 'Start my home plan',
      secondaryCta: 'See how it works',
      heroPanelLabel: 'Facebook-ready value',
      heroPanelBody:
        'Built for homeowners who want reassurance, structure, and a clear next step before signing up.',
      themeEyebrow: 'Trust-first funnel',
      themePills: ['Practical guidance', 'Step-by-step plan', 'Clear next move'],
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
      pricingTitle: 'Show practical value before talking about the paid plan.',
      pricingBody:
        'Facebook traffic should feel guided and reassured before it is asked to continue deeper into the seller workspace.',
      pricingBullets: [
        'Start with the most useful high-level signal.',
        'Use the preview to prove the workflow is real.',
        'Introduce the full workspace only after the value is visible.',
      ],
      finalTitle: 'Give homeowners clarity before asking for commitment.',
      finalBody:
        'The Facebook path should feel trustworthy, practical, and easy to continue into the full workflow.',
    };
  } else {
    base = {
      heroEyebrow: 'Seller funnel',
      heroTitle: 'Sell your home with a plan, not a guess.',
      heroSubtitle:
        'Get pricing guidance, prep recommendations, photo help, and provider matches in minutes, then move naturally into the guided workspace when you are ready.',
      primaryCta: 'Start your selling plan',
      secondaryCta: 'See how it works',
      heroPanelLabel: 'Fast value',
      heroPanelBody:
        'Start with the property basics. We will show a partial result before we ask for signup.',
      themeEyebrow: 'Core funnel',
      themePills: ['Pricing', 'Prep', 'Providers'],
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
      pricingTitle: 'Free preview first. Paid plan at the real unlock point.',
      pricingBody:
        'We should not ask for payment before the user understands the value. The subscription prompt belongs after the property exists and the deeper workflow is visible.',
      pricingBullets: [
        'Preview the pricing band before signup.',
        'Save the property and unlock the full checklist next.',
        'Billing appears only when the user is ready to continue the real workspace.',
      ],
      finalTitle: 'Start your plan now, then let the workflow carry the rest.',
      finalBody:
        'This is the shortest path from ad click to a real property workspace with pricing, prep, providers, and exports ready to unlock.',
    };
  }

  const theme = resolveSellerCampaignTheme(context);
  return theme ? withTheme(base, theme) : base;
}

export function getAgentLandingVariant(context = {}) {
  const trafficSource = resolveTrafficSource(context);

  let base;
  if (trafficSource === 'instagram') {
    base = {
      eyebrow: 'Instagram agent funnel',
      title: 'Show up to the listing conversation with a real plan already framed.',
      subtitle:
        'Use Workside to turn pricing, prep, providers, and marketing outputs into a seller-facing advantage before the listing is won.',
      primaryCta: 'Get agent access',
      secondaryCta: 'See workflow preview',
      themePills: ['Listing pitch', 'Prep workflow', 'Seller-facing polish'],
      valueItems: [
        {
          eyebrow: 'Listings',
          title: 'Look prepared before the seller meeting',
          body: 'Show a plan instead of promising one later.',
        },
        {
          eyebrow: 'Workflow',
          title: 'Reuse the same listing system across properties',
          body: 'Pricing, prep, providers, photos, and reports live in one guided sequence.',
        },
        {
          eyebrow: 'Capacity',
          title: 'Plans framed around active properties',
          body: 'Agent billing fits the real work model: how many active listings you are moving forward at once.',
        },
      ],
      finalTitle: 'Turn seller confidence into signed listings.',
      finalBody:
        'Workside helps agents show up with pricing, prep, provider support, and presentation polish already mapped out.',
    };
  } else if (trafficSource === 'facebook') {
    base = {
      eyebrow: 'Facebook agent funnel',
      title: 'Win more listings with a clearer prep and presentation system.',
      subtitle:
        'Give sellers a structured, professional path from pricing through market-ready materials without juggling disconnected tools.',
      primaryCta: 'Get agent access',
      secondaryCta: 'See workflow preview',
      themePills: ['Professional system', 'Seller clarity', 'Repeatable workflow'],
      valueItems: [
        {
          eyebrow: 'Listings',
          title: 'Look prepared before the seller meeting',
          body: 'Show a plan instead of promising one later.',
        },
        {
          eyebrow: 'Workflow',
          title: 'Reuse the same listing system across properties',
          body: 'Pricing, prep, providers, photos, and reports live in one guided sequence.',
        },
        {
          eyebrow: 'Capacity',
          title: 'Plans framed around active properties',
          body: 'Agent billing fits the real work model: how many active listings you are moving forward at once.',
        },
      ],
      finalTitle: 'Turn seller confidence into signed listings.',
      finalBody:
        'Workside helps agents show up with pricing, prep, provider support, and presentation polish already mapped out.',
    };
  } else {
    base = {
      eyebrow: 'Agent funnel',
      title: 'Win more listings. Get homes market-ready faster.',
      subtitle:
        'Use branded reports, pricing guidance, guided prep flows, and provider coordination to move listings forward with less friction.',
      primaryCta: 'Get agent access',
      secondaryCta: 'See workflow preview',
      themePills: ['Listings', 'Workflow', 'Capacity'],
      valueItems: [
        {
          eyebrow: 'Listings',
          title: 'Look prepared before the seller meeting',
          body: 'Show a plan instead of promising one later.',
        },
        {
          eyebrow: 'Workflow',
          title: 'Reuse the same listing system across properties',
          body: 'Pricing, prep, providers, photos, and reports live in one guided sequence.',
        },
        {
          eyebrow: 'Capacity',
          title: 'Plans framed around active properties',
          body: 'Agent billing fits the real work model: how many active listings you are moving forward at once.',
        },
      ],
      finalTitle: 'Turn seller confidence into signed listings.',
      finalBody:
        'Workside helps agents show up with pricing, prep, provider support, and presentation polish already mapped out.',
    };
  }

  const theme = resolveAgentCampaignTheme(context);
  return theme
    ? {
        ...base,
        ...theme,
        themePills: theme.themePills || base.themePills,
        valueItems: theme.valueItems || base.valueItems,
        finalTitle: theme.finalTitle || base.finalTitle,
        finalBody: theme.finalBody || base.finalBody,
      }
    : base;
}

export function getProviderLandingVariant(context = {}) {
  const trafficSource = resolveTrafficSource(context);

  let base;
  if (trafficSource === 'instagram') {
    base = {
      eyebrow: 'Instagram provider funnel',
      title: 'Get local seller jobs without living on random directories.',
      subtitle:
        'Join the Workside provider network and show up inside real seller workflows when your category is actually needed.',
      primaryCta: 'Start provider signup',
      secondaryCta: 'Open provider portal',
      themePills: ['Local jobs', 'Workflow demand', 'Trust profile'],
      valueItems: [
        {
          eyebrow: 'Demand',
          title: 'Qualified local work',
          body: 'Providers appear when a seller workflow actually needs help, not as random cold directory traffic.',
        },
        {
          eyebrow: 'Trust',
          title: 'Trust badges and verification',
          body: 'Self-reported and verified signals help providers build confidence in the marketplace.',
        },
        {
          eyebrow: 'Workflow',
          title: 'Simple lead acceptance flow',
          body: 'Join, verify, appear in the marketplace, then manage requests from the portal instead of scattered email threads.',
        },
      ],
      finalTitle: 'Join the network before the next seller request is routed.',
      finalBody:
        'Set the category, ZIP, and service radius now, then continue into the provider signup and billing flow from there.',
    };
  } else if (trafficSource === 'facebook') {
    base = {
      eyebrow: 'Facebook provider funnel',
      title: 'Turn local service coverage into qualified seller demand.',
      subtitle:
        'Set your category, ZIP, trust profile, and service radius so homeowners and agents can find you at the right moment.',
      primaryCta: 'Start provider signup',
      secondaryCta: 'Open provider portal',
      themePills: ['Coverage setup', 'Trust profile', 'Qualified requests'],
      valueItems: [
        {
          eyebrow: 'Demand',
          title: 'Qualified local work',
          body: 'Providers appear when a seller workflow actually needs help, not as random cold directory traffic.',
        },
        {
          eyebrow: 'Trust',
          title: 'Trust badges and verification',
          body: 'Self-reported and verified signals help providers build confidence in the marketplace.',
        },
        {
          eyebrow: 'Workflow',
          title: 'Simple lead acceptance flow',
          body: 'Join, verify, appear in the marketplace, then manage requests from the portal instead of scattered email threads.',
        },
      ],
      finalTitle: 'Join the network before the next seller request is routed.',
      finalBody:
        'Set the category, ZIP, and service radius now, then continue into the provider signup and billing flow from there.',
    };
  } else {
    base = {
      eyebrow: 'Provider funnel',
      title: 'Get high-intent seller jobs delivered to you.',
      subtitle:
        'Join the Workside provider network and receive local service requests from homeowners and agents preparing homes for market.',
      primaryCta: 'Start provider signup',
      secondaryCta: 'Open provider portal',
      themePills: ['Local demand', 'Verification', 'Lead workflow'],
      valueItems: [
        {
          eyebrow: 'Demand',
          title: 'Qualified local work',
          body: 'Providers appear when a seller workflow actually needs help, not as random cold directory traffic.',
        },
        {
          eyebrow: 'Trust',
          title: 'Trust badges and verification',
          body: 'Self-reported and verified signals help providers build confidence in the marketplace.',
        },
        {
          eyebrow: 'Workflow',
          title: 'Simple lead acceptance flow',
          body: 'Join, verify, appear in the marketplace, then manage requests from the portal instead of scattered email threads.',
        },
      ],
      finalTitle: 'Join the network before the next seller request is routed.',
      finalBody:
        'Set the category, ZIP, and service radius now, then continue into the provider signup and billing flow from there.',
    };
  }

  const theme = resolveProviderCampaignTheme(context);
  return theme
    ? {
        ...base,
        ...theme,
        themePills: theme.themePills || base.themePills,
        valueItems: theme.valueItems || base.valueItems,
        finalTitle: theme.finalTitle || base.finalTitle,
        finalBody: theme.finalBody || base.finalBody,
      }
    : base;
}
