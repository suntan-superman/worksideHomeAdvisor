# Action Pipeline Fix

## Status
Implemented.

## Changes
- Added structured-action fallback mapping in report rendering so action cards are always produced from raw recommendations and improvement items.
- Added backend fallback action mapping when structured actions are unexpectedly empty.
- Added action pipeline logging for raw recommendation count vs action card count.
- Added warning logs when action cards are fewer than raw recommendations.

## Files
- apps/api/src/modules/documents/html-pdf.service.js
- apps/api/src/modules/documents/report.service.js
- apps/api/src/modules/documents/report-improvement-helpers.js
