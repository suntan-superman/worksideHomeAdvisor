# Workside Home Advisor
## Backend Implementation Checklist + API Contract Pack
### Codex-Ready Execution Guide for Listing Vision Mode, Report Engine, Brochure, Media, Pricing, and Checklist Flows

Last Updated: 2026-03-29

---

# 1. Purpose

This document is the backend implementation checklist and API contract pack for Codex.

It is designed to convert the previously defined product specs into an execution-ready backend plan with:
- implementation phases
- module responsibilities
- data contracts
- endpoint contracts
- validation rules
- error response patterns
- job orchestration guidance
- rollout order

This document assumes the current Workside Home Advisor platform already has:
- working auth
- web and mobile connected to the live backend
- MongoDB
- media upload/storage
- pricing analysis
- AI photo review
- shared media between web and mobile
- flyer generation foundation
- report and Vision planning specs already defined

---

# 2. Core Backend Principles

All new backend work should follow these principles:

1. Keep the backend server-authoritative
2. Prefer async jobs for expensive work
3. Never recompute expensive operations unnecessarily
4. Return structured, predictable JSON contracts
5. Separate raw provider calls from product logic
6. Store generated assets and metadata cleanly
7. Design for seller mode now, realtor mode later
8. Make caching, usage enforcement, and logging first-class concerns

---

# 3. Recommended Module Layout

```text
apps/api/src/modules/
  auth/
  properties/
  pricing/
  media/
  media-ai/
  brochure/
  reports/
  checklist/
  providers/
  subscriptions/
  usage/
  common/
```

Recommended new or expanded modules:

```text
pricing/
  pricing.controller.ts
  pricing.service.ts
  pricing-analysis.repository.ts

media/
  media.controller.ts
  media.service.ts
  media.repository.ts
  media-upload.service.ts

media-ai/
  vision.controller.ts
  vision.service.ts
  vision-jobs.service.ts
  vision-variants.service.ts
  vision-provider-router.service.ts
  vision-preset.service.ts
  providers/
    openai.provider.ts
    replicate.provider.ts
    stability.provider.ts

brochure/
  brochure.controller.ts
  brochure.service.ts
  brochure-template.service.ts
  brochure-pdf.service.ts

reports/
  reports.controller.ts
  reports.service.ts
  report-payload.service.ts
  report-template.service.ts
  report-pdf.service.ts

checklist/
  checklist.controller.ts
  checklist.service.ts
  checklist.repository.ts

providers/
  providers.controller.ts
  providers.service.ts
  providers.repository.ts

usage/
  usage-enforcement.service.ts
  usage-tracking.repository.ts
  rate-limit.service.ts
```

---

# 4. Shared API Standards

## 4.1 Authentication
Every protected endpoint must require authenticated user context.

Recommended auth context fields:
```json
{
  "userId": "usr_001",
  "email": "user@example.com",
  "role": "seller",
  "planCode": "seller_pro"
}
```

---

## 4.2 Success Envelope
Prefer consistent success responses:

```json
{
  "ok": true,
  "data": {},
  "meta": {}
}
```

---

## 4.3 Error Envelope
Use predictable error responses:

```json
{
  "ok": false,
  "error": {
    "code": "MONTHLY_LIMIT_REACHED",
    "message": "You have reached your monthly vision job limit.",
    "details": {}
  }
}
```

Recommended error codes:
- UNAUTHORIZED
- FORBIDDEN
- NOT_FOUND
- VALIDATION_ERROR
- RATE_LIMITED
- MONTHLY_LIMIT_REACHED
- FEATURE_NOT_INCLUDED
- COOLDOWN_ACTIVE
- PROVIDER_UNAVAILABLE
- JOB_ALREADY_RUNNING
- INTERNAL_ERROR

---

## 4.4 Pagination Standard
Use:
```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 57
}
```

---

## 4.5 Date Standard
All timestamps must be ISO-8601 UTC strings.

---

# 5. Data Model Checklist

Codex should confirm these collections exist or are extended.

## 5.1 Existing / Required Core Collections
- users
- properties
- pricingAnalyses
- media
- subscriptions
- usageTracking

## 5.2 New / Expanded Collections
- brochures
- reports
- reportSnapshots
- checklistItems or checklistStates
- providerDirectory
- visionJobs
- visionVariants
- abuseEvents later if not already present

---

# 6. Backend Implementation Checklist by Domain

# 6A. Pricing Domain

## Checklist
- [ ] confirm latest pricing analysis schema is stable
- [ ] confirm selected comps are persisted
- [ ] persist pricing narrative + confidence
- [ ] expose lightweight summary endpoint
- [ ] expose full pricing detail endpoint
- [ ] expose map-ready comp payload
- [ ] add stale-analysis detection
- [ ] add report-integration payload builder
- [ ] add brochure-integration pricing summary builder

## Required outcome
Pricing data must be consumable by:
- pricing tab
- brochure system
- report system
- overview workspace cards

---

# 6B. Media Domain

## Checklist
- [ ] confirm media upload URL flow
- [ ] confirm media completion endpoint
- [ ] persist room tags
- [ ] persist descriptions / notes
- [ ] persist AI photo review fields
- [ ] add listing-candidate flags
- [ ] add brochure-use flags
- [ ] add report-use flags
- [ ] add media ordering support
- [ ] add media summary endpoint by property

## Required outcome
Media must support:
- gallery review
- candidate selection
- AI enhancement / Vision variants
- brochure/report selection logic

---

# 6C. Vision / Media-AI Domain

## Checklist
- [ ] create visionJobs collection support
- [ ] create visionVariants collection support
- [ ] implement vision preset catalog
- [ ] implement provider router
- [ ] implement first provider adapter
- [ ] add cached duplicate-job detection
- [ ] enforce credits / quotas
- [ ] return job status and variants
- [ ] allow preferred variant selection
- [ ] allow useInBrochure / useInReport flags
- [ ] add variant list endpoint per media
- [ ] add job polling endpoint
- [ ] log provider latency and failures

## Required outcome
Vision system must support:
- enhancement jobs
- concept preview jobs
- multiple variants
- brochure/report integration

---

# 6D. Brochure Domain

## Checklist
- [ ] create brochure record schema
- [ ] implement brochure payload assembler
- [ ] implement copy-generation logic
- [ ] support selected photos only
- [ ] support listing-candidate fallback logic
- [ ] support manual overrides
- [ ] add brochure preview endpoint
- [ ] add brochure PDF export endpoint
- [ ] persist brochure generation metadata
- [ ] enforce plan gating

## Required outcome
Brochure system should be a distinct backend asset pipeline, not a transient text blob.

---

# 6E. Reports Domain

## Checklist
- [ ] create reports schema
- [ ] create reportSnapshots schema or equivalent
- [ ] implement report payload assembler
- [ ] aggregate pricing + comps + map + media + checklist + providers
- [ ] support selected enhancement variants
- [ ] support optional concept preview section
- [ ] render HTML template
- [ ] convert HTML to PDF
- [ ] store PDF in cloud storage
- [ ] return download URL
- [ ] support stale vs current report status
- [ ] enforce plan gating / regeneration rules

## Required outcome
Report system must produce a presentation-grade downloadable asset.

---

# 6F. Checklist Domain

## Checklist
- [ ] create checklist state model
- [ ] support system-generated default tasks
- [ ] support custom tasks
- [ ] support status updates
- [ ] support notes
- [ ] support phase grouping
- [ ] support next-best-task calculation
- [ ] support provider linkage by task
- [ ] expose summary + detailed checklist endpoints
- [ ] expose report-ready checklist payload

## Required outcome
Checklist should work as an actual guided workflow, not just notes storage.

---

# 6G. Providers Domain

## Checklist
- [ ] create provider directory schema
- [ ] support categories
- [ ] support city / region filtering
- [ ] support sponsored / verified flags
- [ ] support task-category matching
- [ ] support provider summaries for report inclusion
- [ ] support save-provider action later if not present
- [ ] support future analytics hooks

## Required outcome
Providers should be pluggable into checklist and report sections without rewriting business logic later.

---

# 6H. Usage / Safeguards Domain

## Checklist
- [ ] enforce plan-based quotas for vision jobs
- [ ] enforce plan-based quotas for report generation
- [ ] enforce pricing cooldown rules
- [ ] enforce duplicate-job caching
- [ ] track cache hits vs fresh runs
- [ ] expose usage summary for UI
- [ ] return structured upgrade-required responses

## Required outcome
No expensive feature should run without going through usage enforcement.

---

# 7. API Contract Pack

# 7A. Pricing Contracts

## GET /properties/:id/pricing/latest

### Purpose
Return current pricing summary for workspace cards and report/brochure integrations.

### Response
```json
{
  "ok": true,
  "data": {
    "propertyId": "prop_001",
    "analysisId": "pricing_001",
    "status": "completed",
    "priceRange": {
      "low": 370000,
      "mid": 389000,
      "high": 409000
    },
    "confidenceScore": 58,
    "strategy": "balanced",
    "summary": "Suggested listing range is supported by nearby comparable sales.",
    "analyzedAt": "2026-03-28T00:00:00.000Z",
    "stale": false
  }
}
```

---

## GET /properties/:id/pricing/detail

### Purpose
Return full pricing detail including comps and narrative.

### Response
```json
{
  "ok": true,
  "data": {
    "propertyId": "prop_001",
    "analysisId": "pricing_001",
    "priceRange": {
      "low": 370000,
      "mid": 389000,
      "high": 409000
    },
    "confidenceScore": 58,
    "strategy": "balanced",
    "narrative": "Based on nearby comparable sales...",
    "comps": [
      {
        "compId": "comp_001",
        "address": "8105 Mossrock Dr, Bakersfield, CA 93312",
        "price": 329900,
        "beds": 3,
        "baths": 2,
        "sqft": 1280,
        "distanceMiles": 0.27,
        "soldDate": "2026-02-17",
        "pricePerSqft": 257.73,
        "score": 93,
        "lat": 35.0,
        "lng": -119.0,
        "whySelected": "Close in size and location."
      }
    ]
  }
}
```

---

## POST /properties/:id/pricing/analyze

### Purpose
Run pricing if allowed, otherwise return cached or quota-aware response.

### Success response
```json
{
  "ok": true,
  "data": {
    "action": "ALLOW_FRESH_RUN",
    "jobId": "pricingjob_001",
    "message": "Pricing analysis started."
  }
}
```

### Cached response
```json
{
  "ok": true,
  "data": {
    "action": "RETURN_CACHED_RESULT",
    "analysisId": "pricing_001",
    "message": "Showing latest analysis from earlier today."
  }
}
```

### Limit response
```json
{
  "ok": false,
  "error": {
    "code": "COOLDOWN_ACTIVE",
    "message": "Pricing was already analyzed recently.",
    "details": {
      "retryAfterHours": 18
    }
  }
}
```

---

# 7B. Media Contracts

## GET /properties/:id/media

### Purpose
Return all media and summary info for the property.

### Response
```json
{
  "ok": true,
  "data": {
    "summary": {
      "total": 12,
      "listingCandidates": 5,
      "enhancedVariants": 3,
      "roomsCovered": ["kitchen", "living_room", "exterior"]
    },
    "items": [
      {
        "mediaId": "media_001",
        "imageUrl": "https://...",
        "thumbnailUrl": "https://...",
        "roomType": "kitchen",
        "description": "Wide kitchen angle",
        "qualityScore": 74,
        "aiSummary": "Good listing candidate with improved declutter recommended.",
        "isListingCandidate": true,
        "useInBrochure": true,
        "useInReport": true,
        "createdAt": "2026-03-28T00:00:00.000Z"
      }
    ]
  }
}
```

---

## PATCH /media/:id

### Purpose
Update metadata on a media item.

### Request
```json
{
  "roomType": "living_room",
  "description": "Main seating area with fireplace",
  "isListingCandidate": true,
  "useInBrochure": true,
  "useInReport": true,
  "listingNote": "Potential hero interior image"
}
```

### Response
```json
{
  "ok": true,
  "data": {
    "mediaId": "media_001",
    "updated": true
  }
}
```

---

# 7C. Vision Contracts

## POST /media/:id/vision/enhance

### Purpose
Create an enhancement job.

### Request
```json
{
  "presetKey": "declutter_light",
  "roomType": "kitchen"
}
```

### Response
```json
{
  "ok": true,
  "data": {
    "jobId": "visionjob_001",
    "status": "processing",
    "category": "enhancement",
    "presetKey": "declutter_light"
  }
}
```

---

## POST /media/:id/vision/preview

### Purpose
Create a concept preview job.

### Request
```json
{
  "presetKey": "paint_warm_neutral",
  "roomType": "living_room"
}
```

### Response
```json
{
  "ok": true,
  "data": {
    "jobId": "visionjob_002",
    "status": "processing",
    "category": "concept_preview",
    "presetKey": "paint_warm_neutral"
  }
}
```

---

## GET /vision/jobs/:id

### Purpose
Poll job status and retrieve variants when complete.

### Response
```json
{
  "ok": true,
  "data": {
    "jobId": "visionjob_001",
    "status": "completed",
    "mediaId": "media_001",
    "presetKey": "declutter_light",
    "variants": [
      {
        "variantId": "variant_001",
        "label": "Decluttered Preview A",
        "imageUrl": "https://...",
        "thumbnailUrl": "https://...",
        "isSelected": false,
        "useInBrochure": false,
        "useInReport": false
      }
    ]
  }
}
```

---

## GET /media/:id/vision/variants

### Purpose
Return all variants for a media item.

### Response
```json
{
  "ok": true,
  "data": {
    "mediaId": "media_001",
    "variants": [
      {
        "variantId": "variant_001",
        "variantType": "declutter_light",
        "variantCategory": "enhancement",
        "label": "Decluttered Preview A",
        "imageUrl": "https://...",
        "isSelected": true,
        "useInBrochure": true,
        "useInReport": false,
        "createdAt": "2026-03-28T00:00:00.000Z"
      }
    ]
  }
}
```

---

## PATCH /media/:id/vision/variants/:variantId/select

### Purpose
Select preferred variant.

### Response
```json
{
  "ok": true,
  "data": {
    "variantId": "variant_001",
    "isSelected": true
  }
}
```

---

## PATCH /media/:id/vision/variants/:variantId/use-in-brochure

### Request
```json
{
  "value": true
}
```

### Response
```json
{
  "ok": true,
  "data": {
    "variantId": "variant_001",
    "useInBrochure": true
  }
}
```

---

## PATCH /media/:id/vision/variants/:variantId/use-in-report

### Request
```json
{
  "value": true
}
```

### Response
```json
{
  "ok": true,
  "data": {
    "variantId": "variant_001",
    "useInReport": true
  }
}
```

---

# 7D. Brochure Contracts

## POST /properties/:id/brochure/generate

### Purpose
Generate or refresh brochure content and asset selection.

### Request
```json
{
  "brochureType": "sale",
  "tone": "professional",
  "selectedMediaIds": ["media_001", "media_002"],
  "selectedVariantIds": ["variant_001"],
  "headlineOverride": null
}
```

### Response
```json
{
  "ok": true,
  "data": {
    "brochureId": "brochure_001",
    "status": "completed",
    "previewHtmlUrl": "https://...",
    "pdfUrl": null
  }
}
```

---

## GET /properties/:id/brochure/latest

### Response
```json
{
  "ok": true,
  "data": {
    "brochureId": "brochure_001",
    "status": "completed",
    "headline": "Charming 3-Bedroom Home on a Spacious Corner Lot",
    "selectedMedia": [],
    "selectedVariants": [],
    "previewHtmlUrl": "https://..."
  }
}
```

---

## GET /brochures/:id/download

### Purpose
Download brochure PDF.

---

# 7E. Reports Contracts

## POST /properties/:id/report/generate

### Purpose
Generate full seller report PDF.

### Request
```json
{
  "includeChecklist": true,
  "includeProviders": true,
  "includeVisionSection": true,
  "selectedMediaIds": ["media_001", "media_002"],
  "selectedVariantIds": ["variant_001", "variant_005"]
}
```

### Response
```json
{
  "ok": true,
  "data": {
    "reportId": "report_001",
    "status": "processing",
    "message": "Report generation started."
  }
}
```

---

## GET /properties/:id/report/latest

### Response
```json
{
  "ok": true,
  "data": {
    "reportId": "report_001",
    "status": "completed",
    "stale": false,
    "generatedAt": "2026-03-28T00:00:00.000Z",
    "downloadUrl": "https://...",
    "previewSummary": {
      "sections": [
        "Executive Summary",
        "Pricing",
        "Comps",
        "Map",
        "Photos",
        "Visual Improvement Previews",
        "Checklist",
        "Providers"
      ]
    }
  }
}
```

---

## GET /reports/:id/download

### Purpose
Download final PDF.

---

# 7F. Checklist Contracts

## GET /properties/:id/checklist

### Purpose
Return grouped checklist data and summary.

### Response
```json
{
  "ok": true,
  "data": {
    "summary": {
      "completionPercent": 33,
      "currentPhase": "pre_listing",
      "nextTask": "Capture the core listing rooms"
    },
    "phases": [
      {
        "phaseKey": "pre_listing",
        "title": "Pre-Listing",
        "items": [
          {
            "itemId": "task_001",
            "title": "Capture the core listing rooms",
            "status": "in_progress",
            "priority": "high",
            "category": "photos",
            "note": "2 of 5 core rooms are covered",
            "providerCount": 0
          }
        ]
      }
    ]
  }
}
```

---

## PATCH /checklist-items/:id

### Request
```json
{
  "status": "done",
  "note": "Kitchen, living room, and exterior completed."
}
```

### Response
```json
{
  "ok": true,
  "data": {
    "itemId": "task_001",
    "updated": true
  }
}
```

---

## POST /properties/:id/checklist/custom-task

### Request
```json
{
  "title": "Schedule deep clean",
  "details": "Get cleaner before final photos",
  "phaseKey": "pre_listing"
}
```

### Response
```json
{
  "ok": true,
  "data": {
    "itemId": "task_999",
    "created": true
  }
}
```

---

# 7G. Providers Contracts

## GET /properties/:id/providers

### Purpose
Return local providers relevant to the property and optionally a checklist task.

### Query params
- category
- city
- taskKey
- limit

### Response
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "providerId": "prov_001",
        "name": "ABC Home Inspections",
        "category": "inspector",
        "city": "Bakersfield",
        "phone": "555-555-5555",
        "website": "https://example.com",
        "isSponsored": true,
        "isVerified": true
      }
    ]
  }
}
```

---

# 7H. Usage Contracts

## GET /me/usage-summary

### Purpose
Return plan-aware usage summary for UI display.

### Response
```json
{
  "ok": true,
  "data": {
    "planCode": "seller_pro",
    "visionJobsUsed": 8,
    "visionJobsLimit": 20,
    "reportsGenerated": 1,
    "reportsLimit": 5,
    "pricingRunsThisMonth": 3
  }
}
```

---

# 8. Validation Checklist

## 8.1 Input Validation
Codex must validate:
- propertyId exists and belongs to user
- mediaId exists and belongs to property
- presetKey is valid
- roomType is supported if provided
- selectedMediaIds belong to the same property
- selectedVariantIds belong to the same property and user
- checklist status is one of allowed enum values

## 8.2 Output Validation
Codex must ensure:
- report cannot include unknown media/variant assets
- brochure cannot use invalid or archived assets
- concept previews are flagged correctly
- selected variant uniqueness is enforced per job/media

---

# 9. Background Jobs / Async Checklist

Use jobs for:
- pricing analysis
- vision generation
- brochure generation if heavy
- report PDF rendering

Recommended job payload fields:
```json
{
  "jobType": "report_generate",
  "propertyId": "prop_001",
  "userId": "usr_001",
  "triggeredBy": "manual",
  "payload": {}
}
```

Track job statuses:
- queued
- processing
- completed
- failed

---

# 10. Logging / Diagnostics Checklist

Codex should log:
- endpoint entry/exit
- provider request start/end
- usage decision results
- cache hits vs misses
- report generation duration
- brochure generation duration
- variant generation failures
- storage upload failures

Add correlation IDs where practical.

---

# 11. Recommended Build Order for Codex

## Phase 1
- [ ] stabilize media flags and candidate selection
- [ ] implement brochure contract end to end
- [ ] implement reports schema + payload assembler
- [ ] implement report generation endpoint
- [ ] implement usage enforcement hooks

## Phase 2
- [ ] implement vision jobs + variants
- [ ] implement first vision provider
- [ ] implement polling/status endpoints
- [ ] implement selected-variant flows
- [ ] connect variants to brochure/report

## Phase 3
- [ ] implement checklist persistence
- [ ] implement provider retrieval contracts
- [ ] implement report provider/checklist sections
- [ ] add diagnostics and admin views later

---

# 12. Final Direction to Codex

Do not build these systems as isolated one-off features.

Build them as connected backend asset pipelines:

- pricing produces trusted pricing data
- media produces structured property imagery
- vision produces optional enhanced/concept variants
- brochure produces polished marketing output
- reports produce premium downloadable intelligence
- checklist produces seller workflow guidance
- providers enrich the checklist and report flows

Every contract should support:
- seller use
- future realtor mode
- future monetization
- clean, predictable frontend integration

That is the standard for this backend phase.

---

End of Document
