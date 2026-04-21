# Photo Feedback V3

## Status
Implemented.

## What changed
- Replaced repetitive feedback with room-aware feedback logic:
  - kitchen: lighting/clutter/workspace flow
  - exterior: shadows/angle
  - living: composition/framing
  - bedroom/bathroom: angle/light clarity
- Ensured one short sentence per photo.
- Added validation warning if duplicate feedback still appears in a run.

## Files
- apps/api/src/modules/documents/html-pdf.service.js
