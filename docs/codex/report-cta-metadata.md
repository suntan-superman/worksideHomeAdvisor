# Report CTA Metadata

CTA metadata now ships in:

- `report.payload.ctaMetadata[]`
- `report.payload.recommendationActions[].cta`

Fields:

- `label`
- `destinationType`
- `destinationRoute`
- `relatedPropertyId`
- `relatedTaskId`
- `relatedProviderCategory`
- `priority`
- `visibilityConditions[]`

Compatibility notes:

- Existing report PDF generation still works if CTA metadata is absent.
- Existing consumers of `improvementItems` are not broken.

