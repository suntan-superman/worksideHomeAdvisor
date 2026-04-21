# Flyer Mode Fix

## Status
Implemented.

## Deterministic Rule
- If readiness < 50 OR marketplace-ready photos < 2: preview
- Else if readiness >= 70 AND marketplace-ready photos >= 3: launch_ready
- Else: preview

## Changes
- Centralized deterministic mode decision in one helper function.
- Added explicit mode reason logging during flyer generation.
- Stored mode decision reason in readiness signals.

## Files
- apps/api/src/modules/documents/flyer-enhancement-helpers.js
- apps/api/src/modules/documents/flyer.service.js
