import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAttributionKey,
  buildLandingSearchParams,
  normalizeLandingAttribution,
  normalizeCampaignName,
  resolveTrafficPlatform,
} from './index.js';

test('resolveTrafficPlatform detects Instagram and Facebook traffic', () => {
  assert.equal(resolveTrafficPlatform({ source: 'ig_campaign' }), 'instagram');
  assert.equal(resolveTrafficPlatform({ medium: 'paid_meta' }), 'facebook');
  assert.equal(resolveTrafficPlatform({ source: 'google-search' }), 'google');
  assert.equal(resolveTrafficPlatform({}), 'direct');
});

test('normalizeLandingAttribution standardizes campaign inputs', () => {
  const attribution = normalizeLandingAttribution({
    src: 'IG',
    medium: 'Paid Social',
    campaign: '  Pricing Preview  ',
    adset: 'Bakersfield Sellers',
    ad: 'Carousel 1',
    roleIntent: 'Seller',
    route: '/sell',
  });

  assert.deepEqual(attribution, {
    platform: 'instagram',
    source: 'ig',
    medium: 'paid_social',
    campaign: 'pricing_preview',
    adset: 'bakersfield_sellers',
    ad: 'carousel_1',
    roleIntent: 'seller',
    route: '/sell',
    landingPath: '',
    referrer: '',
  });
});

test('buildAttributionKey creates stable cache/reporting keys', () => {
  const key = buildAttributionKey({
    source: 'facebook',
    medium: 'paid-social',
    campaign: 'Lead Form',
    adset: 'Sellers',
    ad: 'Video A',
    roleIntent: 'seller',
  });

  assert.equal(key, 'facebook:facebook:paid_social:lead_form:sellers:video_a:seller');
});

test('normalizeCampaignName maps common ad campaign aliases to canonical names', () => {
  assert.equal(normalizeCampaignName('Home Value'), 'pricing_preview');
  assert.equal(normalizeCampaignName('listing-photos'), 'photo_ready');
  assert.equal(normalizeCampaignName('book more jobs'), 'local_leads');
  assert.equal(normalizeCampaignName(''), 'general');
});

test('buildLandingSearchParams preserves normalized attribution and extras', () => {
  const search = buildLandingSearchParams(
    {
      source: 'IG',
      medium: 'Paid Social',
      campaign: 'Home Value',
      adset: 'Bakersfield Sellers',
      ad: 'Carousel 1',
      anonymousId: 'anon-123',
    },
    {
      role: 'seller',
      zip: '93312',
    },
  );

  assert.equal(
    search.toString(),
    'src=ig&medium=paid_social&campaign=pricing_preview&adset=bakersfield_sellers&ad=carousel_1&anonymousId=anon-123&role=seller&zip=93312',
  );
});
