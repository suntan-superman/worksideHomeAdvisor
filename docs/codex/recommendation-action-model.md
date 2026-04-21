# Recommendation Action Model

This model is generated in report payloads at:

- `report.payload.recommendationActions[]`

Each action contains:

- `id`
- `title`
- `reason`
- `urgency` (`high`, `medium`, `low`)
- `estimatedCost`
- `expectedOutcome`
- `recommendedActionType` (`photo_retake`, `staging_improvement`, `lighting_improvement`, `declutter`, `curb_appeal`, `pricing_review`, `provider_booking`, `report_regeneration`)
- `ctaLabel`
- `ctaDestination`
- `linkedChecklistItemIds[]`
- `linkedProviderCategory`
- `cta`:
  - `label`
  - `destinationType`
  - `destinationRoute`
  - `relatedPropertyId`
  - `relatedTaskId`
  - `relatedProviderCategory`
  - `priority`
  - `visibilityConditions[]`

Legacy compatibility:

- `report.improvementItems[]` is still populated.
- It is now derived from `recommendationActions` when available.

