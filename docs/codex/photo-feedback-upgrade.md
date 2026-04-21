# Photo Feedback Upgrade

## Status
Implemented.

## Changes
- Replaced generic pending message with actionable short feedback.
- Feedback now uses specific one-line language when no explicit listing note exists:
  - Lighting too dark.
  - Composition unbalanced.
  - Clutter visible.
  - Good composition.
- Each photo card keeps score, quality label, and priority badge.

## Files
- apps/api/src/modules/documents/html-pdf.service.js
