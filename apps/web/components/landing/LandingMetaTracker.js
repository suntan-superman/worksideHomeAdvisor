'use client';

import { useEffect, useRef } from 'react';

import { trackMetaPixelEvent } from '../../lib/meta-pixel';

export function LandingMetaTracker({
  eventName = 'ViewContent',
  roleIntent = '',
  contentName = '',
  contentCategory = 'landing_page',
  source = '',
  campaign = '',
  medium = '',
  adset = '',
  ad = '',
}) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    trackMetaPixelEvent(eventName, {
      content_name: contentName || roleIntent || 'Workside Home Advisor landing page',
      content_category: contentCategory,
      role_intent: roleIntent,
      source,
      campaign,
      medium,
      adset,
      ad,
    });
  }, [ad, adset, campaign, contentCategory, contentName, eventName, medium, roleIntent, source]);

  return null;
}

