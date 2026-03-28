# Workside Home Advisor
## PDF Property Report System Spec + AI Image Enhancement Pipeline Spec
### Codex-Ready Product and Technical Blueprint

Last Updated: 2026-03-28

---

# 1. Purpose

This document defines two major next-phase systems for Workside Home Advisor:

1. Full Property Report PDF Engine
2. AI Image Enhancement / Listing Vision Pipeline

These systems should turn the current working web + mobile + backend platform into a polished, premium, seller- and realtor-ready product.

This spec assumes the current status already achieved, including:
- live web app
- live API
- MongoDB + RentCast + OpenAI + Stripe integrations
- working mobile photo capture and AI review
- shared media between mobile and web
- existing flyer generation foundation
- working comps map on web

---

# 2. Strategic Product Goal

The next phase is not basic functionality. It is product quality and product differentiation.

The PDF system should answer:

“What is my home worth, what should I do next, and how do I sell it well?”

The AI image system should answer:

“What would this home look like if we improved it, decluttered it, or staged it?”

Together, these become a major competitive advantage for:
- individual home sellers
- FSBO users
- real estate agents
- future provider marketplace flows

---

# 3. System A: Full Property Report PDF Engine

## 3.1 Product Positioning

### Suggested output name
Seller Intelligence Report

Alternative names:
- Home Sale Readiness Report
- Listing Strategy Report
- Property Analysis Report
- Workside Seller Report

### Product role
This is not just a flyer.

It is a full, presentation-grade report that combines:
- pricing
- comps
- map
- photos
- AI recommendations
- checklist
- provider guidance
- marketing strategy

It should be suitable for:
- seller self-service download
- agent presentation in listing appointment
- internal reference during prep
- premium subscription output
- future white-label / realtor-branded exports

---

## 3.2 PDF Report Goals

The report must:
- look polished and professional
- feel worth paying for
- be print-quality
- work as a PDF download from web
- support future branding modes
- clearly separate facts, estimates, and AI guidance
- include appropriate disclaimers

---

## 3.3 Report Generation Entry Points

The report should be creatable from:
- web property workspace
- future mobile Generate Report action
- future realtor presentation mode
- admin/testing tools

### Main CTA
Generate Full Property Report

### Future CTAs
- Refresh Report
- Download PDF
- Share Report
- Email Report
- Generate Realtor-Branded Version

---

## 3.4 Recommended API Endpoints

### Generate / refresh report
POST /properties/:id/report/generate

### Get latest report metadata
GET /properties/:id/report/latest

### Download PDF
GET /reports/:id/download

### Get HTML preview data
GET /reports/:id/preview

### Optional future
POST /properties/:id/report/share
POST /properties/:id/report/email

---

## 3.5 Report Generation Flow

1. User selects property
2. User clicks Generate Full Report
3. Backend loads:
   - property metadata
   - pricing analysis
   - selected comps
   - comp map inputs
   - media
   - AI photo analyses
   - checklist status
   - provider suggestions
   - marketing guidance
4. Backend validates required data
5. Backend assembles normalized report payload
6. HTML template is rendered
7. HTML is converted to PDF
8. PDF is stored
9. Report metadata saved to MongoDB
10. Download URL returned to frontend

---

## 3.6 Report Sections (Required)

### Section 1 — Cover Page
Include:
- property address
- report title
- generated date
- Workside branding
- hero property image
- optional subtitle:
  - AI-powered pricing, prep, and listing guidance

Optional future:
- realtor branding
- seller name
- agent name

### Section 2 — Executive Summary
AI-generated summary:
- what this property is
- current estimated price range
- listing readiness summary
- biggest opportunities
- biggest risks

### Section 3 — Property Overview
Include:
- address
- city/state/zip
- property type
- beds
- baths
- square footage
- lot size if available
- year built if available
- seller-entered notes if appropriate
- current status

### Section 4 — Pricing Analysis
Include:
- recommended low / mid / high range
- confidence score
- analysis date
- pricing narrative
- pricing strategy recommendation

Subsections:
- How this price range was estimated
- Why confidence is high / moderate / low
- Suggested listing approach

### Section 5 — Comparable Properties
Include top 5–10 comps:
- address
- sale price
- beds/baths
- sqft
- distance
- sold date
- price per sqft
- comp score if available
- short why-this-comp-matters explanation

### Section 6 — Comp Map
Include:
- subject property marker
- comp markers
- legend
- optional radius ring
- optional map subtitle

Implementation note:
Generate map snapshot image from web map or static map flow for PDF embedding.

### Section 7 — Photo Review Summary
Include:
- top listing-ready photos
- weaker photos
- missing room coverage
- room-by-room observations
- AI recommendations

Subsections:
- Best candidate photos
- Retake recommendations
- Rooms that still need better coverage

### Section 8 — Listing Readiness Score
Compute a total score from 0–100.

Suggested sub-scores:
- Pricing confidence
- Photo quality
- Room coverage
- Condition / readiness
- Marketing readiness
- Seller task completion

Output:
- overall readiness score
- Needs Work / Almost Ready / Listing Ready label

### Section 9 — Improvement Recommendations
For each recommendation include:
- title
- reason
- rough cost range
- rough impact range
- ROI label (High / Medium / Low)
- urgency
- related room
- related photo(s) if applicable

Example:
- Declutter kitchen counters
- Repaint living room to warm neutral tone
- Replace worn carpet in primary bedroom
- Improve exterior entry photo
- Remove oversized furniture from family room before shoot

### Section 10 — Seller Checklist
Structured by phase:

#### Pre-Listing
- price confirmed
- photos captured
- top photos selected
- improvements prioritized
- listing-ready cleanup completed

#### Listing Launch
- choose final marketing photos
- finalize brochure
- choose listing date
- publish listing

#### Under Contract
- title company
- inspection
- contract review
- repair negotiation prep

#### Closing
- final walkthrough
- document signing
- move planning

Each item should show:
- status
- next action
- optional notes

### Section 11 — Local Providers
Include:
- title companies
- inspectors
- attorneys if state-appropriate
- photographers
- contractors / painters / cleaners later

Each provider card should show:
- business name
- category
- city
- phone/website if allowed
- sponsored / verified badge if applicable

### Section 12 — Marketing Guidance
Include:
- ideal buyer positioning
- strongest home features to highlight
- suggested listing headline
- suggested descriptive copy
- best marketing channels
- best first photo guidance
- timing suggestions

### Section 13 — AI Draft Listing Description
Generate:
- short description
- long description
- optional premium / emotional tone version
- optional factual/clean version

Future variants:
- MLS tone
- Zillow tone
- brochure tone
- social media snippet

### Section 14 — Disclaimers
Required:
- pricing is estimate only
- report is informational only
- not legal, tax, brokerage, or appraisal advice
- provider listings are not guarantees
- AI outputs may contain inaccuracies
- visualizations are conceptual only

---

## 3.7 Data Requirements for Report Generation

The report service should aggregate from:

### Property
- property record
- seller-entered metadata

### Pricing
- latest pricing analysis
- pricing narrative
- confidence score
- top comps

### Map
- subject property lat/lng
- comp lat/lng
- display metadata

### Media
- property media
- selected listing candidates
- AI photo analysis results

### Checklist
- seller checklist state
- task completion

### Providers
- local provider suggestions
- sponsored flags

### AI outputs
- executive summary
- marketing guidance
- improvement recommendations
- draft listing description

---

## 3.8 MongoDB Collections for Report System

### reports
{
  "_id": "report_001",
  "propertyId": "prop_001",
  "userId": "usr_001",
  "type": "seller_intelligence_report",
  "status": "completed",
  "htmlStoragePath": "reports/report_001/index.html",
  "pdfStoragePath": "reports/report_001/report.pdf",
  "reportVersion": 1,
  "generatedFrom": {
    "pricingAnalysisId": "pricing_001",
    "mediaSnapshotId": "media_snapshot_001",
    "checklistSnapshotId": "check_001"
  },
  "createdAt": "2026-03-28T00:00:00.000Z",
  "updatedAt": "2026-03-28T00:00:00.000Z"
}

### reportSnapshots
Optional if you want immutable payloads:
{
  "_id": "reportsnap_001",
  "reportId": "report_001",
  "payload": {},
  "createdAt": "2026-03-28T00:00:00.000Z"
}

---

## 3.9 HTML-to-PDF Rendering Approach

### Recommended
Use:
- Puppeteer
or
- Playwright

### Why
- strong layout control
- reusable HTML templates
- professional styling
- easier iteration than hand-built PDF libraries

### Architecture
apps/api/src/modules/reports/
- report.service.ts
- report-payload.service.ts
- report-template.service.ts
- report-pdf.service.ts
- templates/
  - seller-intelligence-report.html
  - partials/

---

## 3.10 Report Template Styling Guidelines

The PDF should feel:
- premium
- modern
- clean
- data-rich but readable

### Recommended style rules
- full-width cover image
- blue Workside accents
- strong hierarchy
- clean cards / section separators
- comp tables readable in print
- image captions
- page breaks controlled intentionally
- repeated footer with report title + page number

---

## 3.11 Regeneration Rules

A report should be refreshable, but not regenerated needlessly.

### Default rules
- allow manual regenerate
- use cached latest report if no material changes
- mark report stale if:
  - pricing changed
  - selected photos changed
  - checklist changed
  - provider suggestions refreshed materially

---

## 3.12 Premium / Realtor Future Enhancements

Future report variants:
- seller report
- realtor-branded report
- luxury listing report
- provider-enhanced prep report
- investor / ROI report
- rental strategy report

---

# 4. System B: AI Image Enhancement / Listing Vision Pipeline

## 4.1 Product Positioning

This system should be positioned as:
Listing Vision Mode

and also power:
AI Image Enhancement

This is both:
- a practical image-improvement system
- a visual planning tool
- a listing-winning feature for realtors

---

## 4.2 Product Goals

The image pipeline should:
- improve photo appeal for listing readiness
- help sellers visualize upgrades
- help agents show, not tell
- create premium before/after moments
- feed enhanced images into brochure and report systems

---

## 4.3 Supported AI Image Actions

### Tier 1 — Practical Listing Enhancement
These are the highest-priority features.

#### A. Declutter / Clean Up
- remove clutter
- simplify counters
- reduce visual mess
- remove distracting small objects

#### B. Lighting Enhancement
- brighten dark rooms
- improve exposure
- make images feel more listing-ready

#### C. Minor Visual Cleanup
- improve visual balance
- reduce distracting composition issues where feasible
- sharpen listing appeal

### Tier 2 — Conceptual Visualization
These are what-if transformations.

#### D. Furniture Reduction / Removal
- partially remove or reduce furniture
- create a more open feeling

#### E. Virtual Staging
- add tasteful staged furniture concepts
- light, clean, modern style only

#### F. Wall Color Visualization
- warm neutral
- bright white
- greige
- soft designer tones

#### G. Flooring Visualization
- remove carpet conceptually
- swap to light wood / medium wood / vinyl plank look

---

## 4.4 Required Product Positioning / Trust Rules

The system must clearly separate:

### Enhancement
Make this photo more listing-ready

from

### Visualization
See what this room could look like if changed

### Required labels
- Original
- Enhanced
- Concept Preview

### Required disclaimer
AI visualizations are conceptual previews only. Actual results and property value impact may vary.

---

## 4.5 User Entry Points

Image enhancement should be available from:

### Mobile
- property gallery
- photo detail
- Vision tab

### Web
- property media workspace
- photo review tools
- flyer candidate workflow
- future report refinement tools

---

## 4.6 User Workflow

1. User selects photo
2. User chooses action:
   - Enhance
   - Declutter
   - Stage
   - Paint
   - Flooring
3. Backend creates image job
4. AI provider processes image
5. Result saved to storage
6. Job status updated
7. Frontend shows before/after
8. User can save as listing candidate or brochure/report image

---

## 4.7 Recommended Backend Endpoints

### Create image enhancement job
POST /media/:id/enhance

### Create visualization job
POST /media/:id/visualize

### Get job status
GET /image-jobs/:id

### List variants for media
GET /media/:id/variants

### Select preferred variant
PATCH /media/:id/variants/:variantId/select

### Delete or archive variant later
DELETE /media/:id/variants/:variantId

---

## 4.8 Job Types

Suggested enum:
- enhance_listing_quality
- declutter
- remove_furniture
- virtual_stage
- paint_preview
- flooring_preview
- combined_preview

---

## 4.9 Data Model

### imageJobs
{
  "_id": "imgjob_001",
  "mediaId": "media_001",
  "propertyId": "prop_001",
  "userId": "usr_001",
  "jobType": "declutter",
  "status": "processing",
  "provider": "openai_or_replicate",
  "input": {
    "roomType": "living_room",
    "preset": "declutter_light",
    "promptVersion": 1
  },
  "outputVariantIds": [],
  "createdAt": "2026-03-28T00:00:00.000Z",
  "updatedAt": "2026-03-28T00:00:00.000Z"
}

### mediaVariants
{
  "_id": "variant_001",
  "mediaId": "media_001",
  "propertyId": "prop_001",
  "variantType": "declutter",
  "label": "Decluttered Preview",
  "storagePath": "media/prop_001/variants/variant_001.jpg",
  "isSelected": false,
  "metadata": {
    "roomType": "living_room",
    "promptPreset": "declutter_light"
  },
  "createdAt": "2026-03-28T00:00:00.000Z"
}

---

## 4.10 AI Provider Strategy

### Recommended MVP strategy
Use a provider abstraction layer.

Possible providers:
- OpenAI image editing
- Replicate-hosted image-to-image models
- Stability AI
- future internal provider router

### Why abstraction matters
You may want:
- one provider for cleanup
- one provider for staging
- one provider for paint/floor concepts

Architecture:
apps/api/src/modules/media-ai/
- media-ai.service.ts
- providers/
  - openai.provider.ts
  - replicate.provider.ts
  - stability.provider.ts

---

## 4.11 Prompt / Preset Strategy

Do not let raw freeform prompts drive the user experience initially.

Use curated presets.

### Example enhancement presets
- listing_brightness_cleanup
- declutter_light
- declutter_medium
- modern_light_stage
- paint_warm_neutral
- paint_bright_white
- flooring_light_wood
- flooring_medium_wood

### Example internal prompt concept
Transform this living room photo into a cleaner, more listing-ready version by reducing clutter, improving lighting, and preserving realistic proportions. Keep architecture intact.

---

## 4.12 Room Awareness

Room type should be used in prompting and preset selection.

Possible room types:
- kitchen
- living_room
- bedroom
- bathroom
- exterior
- dining_room
- office
- other

Sources:
- AI photo analysis result
- user tag
- manual override

---

## 4.13 Usage Safeguards

Image jobs can become expensive quickly.

Must enforce:
- per-plan image credits
- cooldowns on repeated identical jobs
- duplicate input dedupe
- caching of exact same preset + image
- monthly job limits by plan

Example:
- Seller Free: 3 image jobs/month
- Seller Pro: 20 image jobs/month
- Agent Pro: 100 image jobs/month

---

## 4.14 Frontend UX Requirements

### Mobile
Photo detail actions:
- Enhance Photo
- Declutter Room
- Try Wall Colors
- Try New Flooring
- Stage This Room

### Web
Media workspace actions:
- Generate Enhanced Version
- Create Concept Preview
- Compare Versions
- Use In Flyer
- Use In Report

### Comparison UX
Support:
- side-by-side
- tab toggle
- before/after slider later

---

## 4.15 Integration with Existing Systems

### Flyer / brochure
Enhanced or selected variants can be used in:
- AI brochure
- flyer generation
- listing candidate set

### PDF report
Include:
- original + best enhanced preview where useful
- visualization examples in improvement recommendations section

### Checklist
If the system recommends:
- declutter
- repaint
- flooring changes

Tie those recommendations to:
- checklist tasks
- provider suggestions

---

## 4.16 Value / ROI Layer

Later, pair visualizations with directional ROI guidance.

Example:
- Decluttering and repainting may materially improve perceived listing readiness.
- Neutral wall colors often support broader buyer appeal.
- Flooring upgrades may justify a premium presentation strategy depending on neighborhood and property tier.

Important:
Avoid promising guaranteed value increases.

---

## 4.17 Required Guardrails

The image system must:
- preserve property truthfulness reasonably
- avoid misleading structural edits
- avoid making the home appear to have permanent features it does not have without labeling it as a concept
- label conceptual staging clearly
- keep original image always accessible

Do not:
- fabricate major renovations as if completed
- hide meaningful defects in a deceptive way
- represent concept previews as actual condition

---

## 4.18 Recommended Build Order for AI Image Pipeline

### Phase 1
- provider abstraction
- image job model
- declutter / enhance jobs
- variant storage
- before/after UI

### Phase 2
- virtual staging
- wall color previews
- flooring previews
- selection of preferred variant

### Phase 3
- integration into brochure
- integration into PDF report
- stronger realtor presentation mode

---

# 5. Combined Roadmap Recommendation

## Phase A — Big Revenue / Presentation Win
1. Full Property Report PDF
2. Better flyer/brochure output
3. Listing candidate photo selection

## Phase B — Big Wow Feature
4. AI image enhancement
5. Declutter + concept visualization
6. Before/after comparison UI

## Phase C — End-to-End Seller Guidance
7. Seller checklist persistence
8. Provider section in report
9. Improvement-to-provider matching

## Phase D — Realtor Differentiation
10. Realtor-branded report
11. Listing presentation mode
12. AI-enhanced presentation pack

---

# 6. Practical Immediate Next Tasks for Codex

## PDF System
- build normalized report payload assembler
- implement HTML template
- add Puppeteer or Playwright PDF render
- add report storage + metadata
- add report download UI in web
- generate static map image for PDF
- add photo summary / selected images section
- add checklist section
- add provider section
- add disclaimers

## AI Image Pipeline
- create image jobs + variants collections
- build provider abstraction
- implement first provider
- add Enhance Photo and Declutter actions
- create job polling/status UX
- add before/after comparison
- allow variant selection
- feed selected variant into brochure/report systems

---

# 7. Final Product Direction

The PDF report should make the product feel:
- premium
- trustworthy
- complete
- worth paying for

The AI image system should make the product feel:
- modern
- differentiated
- visual
- beyond compare

Together, these systems move Workside Home Advisor from:
- functional seller workflow

to:
- full home-selling intelligence platform

That is the right next phase.

---

End of Document
