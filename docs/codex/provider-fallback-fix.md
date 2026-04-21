# Provider Fallback Fix

## Status
Implemented.

## Changes
- Provider lookup now allows external fallback provider candidates.
- If no marketplace/external provider is found, placeholder providers are generated:
  - Local Professional Photographer
  - Local Cleaning Service
  - Home Staging Specialist
- Provider section rendering now always receives non-empty provider cards.

## Files
- apps/api/src/modules/documents/report.service.js
- apps/api/src/modules/documents/html-pdf.service.js
