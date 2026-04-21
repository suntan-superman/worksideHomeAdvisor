# Report/Flyer Improvements Final Summary

Implemented in this pass:

- Structured recommendation action model for seller reports
- Consequence framing layer in report payload and rendered report language
- Decision-driven ROI messaging with net-upside metadata
- Provider recommendation fallback labeling (marketplace vs nearby discovery)
- Report CTA metadata for future action surfaces
- Flyer readiness-aware modes (`preview`, `launch_ready`, `premium`)
- Flyer CTA strategy metadata and mode-aware CTA text
- Enhanced flyer photo selection logic for room balance and quality
- Report and flyer template updates to render the new structured fields

Files changed:

- `apps/api/src/modules/documents/report.service.js`
- `apps/api/src/modules/documents/flyer.service.js`
- `apps/api/src/modules/documents/html-pdf.service.js`
- `apps/api/src/modules/documents/flyer.model.js`
- `apps/api/src/modules/documents/report-improvement-helpers.js`
- `apps/api/src/modules/documents/flyer-enhancement-helpers.js`
- `docs/codex/*` implementation docs

Known limitations / future work:

- No dedicated regression tests were added for report/flyer generation paths yet.
- CTA metadata is now emitted and rendered in PDF copy, but track analytics wiring is still future UI/backend work.
- Agent presentation mode hooks are not fully expanded in this pass.

