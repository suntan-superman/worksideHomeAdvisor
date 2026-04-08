import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFallbackPack, buildMarkdown } from './social-pack.service.js';

test('buildFallbackPack prefers marketing copy and reflects selected photos', () => {
  const pack = buildFallbackPack({
    property: {
      title: 'Maple Grove',
      city: 'Bakersfield',
      state: 'CA',
    },
    pricing: {
      recommendedListMid: 512000,
    },
    selectedPhotos: [
      { assetId: 'a1', roomLabel: 'Living room', imageUrl: 'https://example.com/a1.jpg' },
      { assetId: 'a2', roomLabel: 'Kitchen', imageUrl: 'https://example.com/a2.jpg' },
    ],
    marketing: {
      headline: 'Seller-ready launch in Bakersfield',
      shortDescription: 'Professional visuals and grounded pricing support a strong first impression.',
    },
  });

  assert.equal(pack.headline, 'Seller-ready launch in Bakersfield');
  assert.match(pack.primaryText, /Professional visuals/);
  assert.match(pack.shortCaption, /2 strong photo options ready\./);
  assert.equal(pack.selectedPhotos.length, 2);
});

test('buildMarkdown includes copy, formats, and disclaimers', () => {
  const markdown = buildMarkdown({
    headline: 'Headline',
    primaryText: 'Primary text',
    shortCaption: 'Caption',
    cta: 'Call to action',
    variants: [
      { format: 'Square concept', width: 1080, height: 1080, guidance: 'Use the hero image.' },
    ],
    disclaimers: ['Review before public use.'],
  });

  assert.match(markdown, /## Headline/);
  assert.match(markdown, /Primary text/);
  assert.match(markdown, /Square concept: 1080x1080 - Use the hero image\./);
  assert.match(markdown, /- Review before public use\./);
});
