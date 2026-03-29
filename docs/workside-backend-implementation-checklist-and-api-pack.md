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

## 1.1 Status Legend

This checklist now reflects the actual repo state as of `2026-03-29`.

- `[x]` implemented in the current codebase
- `[~]` partially implemented or implemented with a narrower shape than originally planned
- `[ ]` not implemented yet

## 1.2 Current Repo Notes

The current backend is functionally ahead of the original planning baseline in several areas, but some module names differ from the idealized structure in this document.

Notable implementation realities:

- document generation currently lives under `apps/api/src/modules/documents/`
- checklist persistence currently lives under `apps/api/src/modules/tasks/`
- vision/media-AI currently lives under `apps/api/src/modules/media/`
- current route shapes differ slightly from the original examples below, especially for media and checklist:
  - media uses `/media/assets/:assetId/...`
  - checklist creation uses `/properties/:propertyId/checklist/items`
- current media upload flow is direct create/analyze storage, not signed-upload plus completion callbacks
- report and flyer export are implemented with `pdf-lib`, not HTML-to-PDF rendering
- admin operations and variant lifecycle management now exist beyond the original scope of this document

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
- [x] users
- [x] properties
- [x] pricingAnalyses
- [x] media
- [x] subscriptions
- [x] usageTracking

## 5.2 New / Expanded Collections
- [x] brochures via `flyers`
- [x] reports
- [~] reportSnapshots via embedded `sourceSnapshot` payload data instead of a separate collection
- [x] checklist state via `propertyChecklists`
- [ ] providerDirectory
- [x] visionJobs via `imageJobs`
- [x] visionVariants via `mediaVariants`
- [ ] abuseEvents later if needed

---

# 6. Backend Implementation Checklist by Domain

# 6A. Pricing Domain

## Checklist
- [x] confirm latest pricing analysis schema is stable
- [x] confirm selected comps are persisted
- [x] persist pricing narrative + confidence
- [x] expose lightweight summary endpoint
- [ ] expose full pricing detail endpoint
- [~] expose map-ready comp payload
- [ ] add stale-analysis detection
- [x] add report-integration payload builder
- [x] add brochure-integration pricing summary builder

## Required outcome
Pricing data must be consumable by:
- pricing tab
- brochure system
- report system
- overview workspace cards

---

# 6B. Media Domain

## Checklist
- [~] confirm media upload URL flow
- [~] confirm media completion endpoint
- [x] persist room tags
- [~] persist descriptions / notes
- [x] persist AI photo review fields
- [x] add listing-candidate flags
- [ ] add brochure-use flags on base media assets
- [ ] add report-use flags on base media assets
- [ ] add media ordering support
- [~] add media summary endpoint by property

## Required outcome
Media must support:
- gallery review
- candidate selection
- AI enhancement / Vision variants
- brochure/report selection logic

---

# 6C. Vision / Media-AI Domain

## Checklist
- [x] create visionJobs collection support
- [x] create visionVariants collection support
- [x] implement vision preset catalog
- [~] implement provider router
- [x] implement first provider adapter
- [x] add cached duplicate-job detection
- [ ] enforce credits / quotas
- [x] return job status and variants
- [x] allow preferred variant selection
- [x] allow useInBrochure / useInReport flags
- [x] add variant list endpoint per media
- [x] add job polling endpoint
- [~] log provider latency and failures

## Required outcome
Vision system must support:
- enhancement jobs
- concept preview jobs
- multiple variants
- brochure/report integration

Additional status now implemented beyond the original checklist:

- [x] Replicate provider support for `declutter_light`, `declutter_medium`, and `remove_furniture`
- [x] before/after slider in the web Vision tab
- [x] variant review/ranking metadata
- [x] variant lifecycle with temporary expiration, preferred-selection persistence, and cleanup job

---

# 6D. Brochure Domain

## Checklist
- [x] create brochure record schema
- [x] implement brochure payload assembler
- [x] implement copy-generation logic
- [x] support selected photos only
- [x] support listing-candidate fallback logic
- [x] support manual overrides
- [x] add brochure preview endpoint
- [x] add brochure PDF export endpoint
- [x] persist brochure generation metadata
- [x] enforce plan gating

## Required outcome
Brochure system should be a distinct backend asset pipeline, not a transient text blob.

---

# 6E. Reports Domain

## Checklist
- [x] create reports schema
- [~] create reportSnapshots schema or equivalent
- [x] implement report payload assembler
- [~] aggregate pricing + comps + map + media + checklist + providers
- [x] support selected enhancement variants
- [x] support optional concept preview section
- [ ] render HTML template
- [ ] convert HTML to PDF
- [ ] store PDF in cloud storage
- [ ] return download URL
- [x] support stale vs current report status
- [x] enforce plan gating / regeneration rules

## Required outcome
Report system must produce a presentation-grade downloadable asset.

---

# 6F. Checklist Domain

## Checklist
- [x] create checklist state model
- [x] support system-generated default tasks
- [x] support custom tasks
- [x] support status updates
- [x] support notes
- [x] support phase grouping
- [x] support next-best-task calculation
- [ ] support provider linkage by task
- [x] expose summary + detailed checklist endpoints
- [x] expose report-ready checklist payload

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
- [x] enforce plan-based quotas for report generation
- [x] enforce pricing cooldown rules
- [x] enforce duplicate-job caching
- [x] track cache hits vs fresh runs
- [ ] expose usage summary for UI
- [x] return structured upgrade-required responses

## Required outcome
No expensive feature should run without going through usage enforcement.

---

# 7. API Contract Pack

The contract examples below remain useful as product-shape references, but they should now be read alongside the current repo routes and serializers in the actual modules.

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
- [x] stabilize media flags and candidate selection
- [x] implement brochure contract end to end
- [x] implement reports schema + payload assembler
- [x] implement report generation endpoint
- [x] implement usage enforcement hooks

## Phase 2
- [x] implement vision jobs + variants
- [x] implement first vision provider
- [x] implement polling/status endpoints
- [x] implement selected-variant flows
- [x] connect variants to brochure/report

## Phase 3
- [x] implement checklist persistence
- [ ] implement provider retrieval contracts
- [ ] implement report provider/checklist sections
- [x] add diagnostics and admin views later

## Phase 4
- [ ] add provider directory + provider-task linkage
- [ ] add vision usage enforcement and quota visibility
- [ ] add property-scoped media ordering and explicit brochure/report asset state
- [ ] move heavy vision/report work toward worker-backed async processing
- [ ] strengthen automated test coverage for pricing, media, documents, and admin auth

## 11.1 Highest-Value Next Work

Based on the current implementation, the most valuable next implementation/refinement order is:

1. Provider marketplace foundation
- add provider schema, seedable provider data, property/provider query endpoints, and checklist task linkage
- include provider summaries in reports once real provider retrieval exists

2. Vision quality and governance
- enforce plan-aware quotas for vision jobs
- improve mask quality, preset tuning, and artifact rejection for the Replicate-powered presets
- expose lifecycle/expiration state in the seller UI where appropriate

3. Media selection maturity
- add explicit media ordering
- add first-class brochure/report inclusion flags at the base media level
- persist builder draft state per property so brochure/report selections survive without immediate regeneration

4. Document pipeline hardening
- decide whether to keep `pdf-lib` or move to HTML-to-PDF for higher-end layout control
- store generated PDFs in cloud storage and return stable download URLs
- improve export quality for premium deliverables

5. Testing and operational hardening
- replace placeholder tests with real coverage for auth, pricing, media upload/vision, report generation, and admin auth
- expand diagnostics for provider calls, vision provider failures, and usage decisions

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
