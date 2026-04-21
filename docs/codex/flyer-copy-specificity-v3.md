# Flyer Copy Specificity V3

## Status
Implemented.

## What changed
- Added property-signal extraction from selected flyer photos and property facts.
- Fallback flyer subheadline/summary now uses concrete signals (kitchen, layout flow, exterior/curb cues, light) instead of generic filler.
- Added copy-tightening replacement rules to strip generic phrases.
- Fallback suggestion generator now outputs signal-driven options.

## Files
- apps/api/src/modules/documents/flyer.service.js
