# Conditional Sections

## Goal
Pages are rendered only when property state justifies them.

## Seller report rules
- `includePhotoPreparationPage`: prep-heavy states, low ready-photo coverage, or severe blockers
- `includeActionSupportPages`: prep/balanced by default; launch only when blockers remain
- `includeReadinessEconomics`: always for prep/balanced; launch when pricing/blockers still need interpretation

## Flyer rules
- `includeMarketingGallery`: requires enough ready visuals for the flyer class
- `includePricingPositioningPage`: requires chosen price or non-preview class
- `includeNeighborhoodPositioningPage`: requires non-preview confidence or adequate context signals

## Implementation
Registry returned from `buildSectionRegistry(...)` drives page inclusion in `html-pdf.service.js`.
