# Final Consistency V3

## Status
Implemented.

## Validation checks in code
- Flyer mode mismatch warning (mode vs readiness/photo thresholds).
- CTA upgrade warning if non-approved CTA labels appear.
- No-action-cards warning.
- No-provider-section warning.
- ROI visibility warning.
- Duplicate insights warning.
- Duplicate photo-feedback warning.

## Files
- apps/api/src/modules/documents/html-pdf.service.js
- apps/api/src/modules/documents/flyer.service.js
