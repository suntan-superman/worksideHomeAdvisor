# CTA Upgrade

## Status
Implemented.

## Changes
- Replaced weak CTA language with:
  - Request Showing
  - Get Property Details
- Updated CTA labels in flyer helper metadata and rendered HTML.
- Added secondary contact info (phone fallback label + email) in flyer CTA blocks and report final action band.
- Kept CTA metadata route placeholders in flyer payload.

## Files
- apps/api/src/modules/documents/flyer-enhancement-helpers.js
- apps/api/src/modules/documents/flyer.service.js
- apps/api/src/modules/documents/html-pdf.service.js
