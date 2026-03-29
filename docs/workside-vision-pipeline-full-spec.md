# Workside Home Advisor
## Listing Vision Mode: Full Codex-Ready Spec
### Vision Pipeline + Exact Prompts/Presets + Detailed Vision Tab UI + PDF/Report Integration

Last Updated: 2026-03-29

---

# 1. Purpose

This document defines the full Listing Vision Mode system for Workside Home Advisor.

It includes:
1. a Codex-ready Vision pipeline specification
2. exact prompts + preset definitions
3. a detailed Vision tab UI design
4. integration of Vision outputs into the PDF/report system

This system is intended to make Workside Home Advisor feel visually premium, highly differentiated, and especially valuable in the hands of both home sellers and real estate professionals.

---

# 2. Product Positioning

Listing Vision Mode should be positioned as:

"See the potential before you spend the money."

For sellers, it reduces uncertainty.

For agents, it creates a presentation tool that helps win listings.

For Workside, it becomes:
- a premium feature
- a monetization lever
- a differentiator that competitors will struggle to match well

---

# 3. Core Product Rules

The system must always distinguish between:

## A. Listing Enhancement
Improve the current photo while keeping the room truthful and realistic.

Examples:
- brighten dark image
- reduce clutter
- improve presentation quality
- simplify distracting surfaces

## B. Concept Preview
Show a conceptual what-if version of the room.

Examples:
- remove furniture
- repaint walls
- change flooring
- add light staging

## Required Labels
Every output must be labeled clearly as one of:
- Original
- Enhanced
- Concept Preview

## Required Disclaimer
Always display:
AI visualizations are conceptual previews only. Actual condition, remodel results, and value impact may vary.

---

# 4. Vision Pipeline Specification (Codex-Ready)

## 4.1 High-Level Flow

1. User selects a property photo
2. User opens Vision tab or clicks a Vision action
3. System resolves room type
4. User selects a preset action
5. Backend creates a vision job
6. Provider router selects image AI provider
7. Provider generates 1–3 variants
8. Variants are stored and indexed
9. Frontend polls job status
10. User compares results
11. User selects preferred variant
12. Selected variant can be used in brochure/report systems

---

## 4.2 Recommended Endpoint Set

### Create an enhancement job
POST /media/:id/vision/enhance

### Create a concept preview job
POST /media/:id/vision/preview

### Get job status
GET /vision/jobs/:id

### Get all variants for a media item
GET /media/:id/vision/variants

### Select preferred variant
PATCH /media/:id/vision/variants/:variantId/select

### Mark variant for brochure use
PATCH /media/:id/vision/variants/:variantId/use-in-brochure

### Mark variant for report use
PATCH /media/:id/vision/variants/:variantId/use-in-report

### Archive/delete variant later
DELETE /media/:id/vision/variants/:variantId

---

## 4.3 Core Backend Modules

apps/api/src/modules/vision/
- vision.controller.ts
- vision.service.ts
- vision-jobs.service.ts
- vision-variants.service.ts
- vision-provider-router.service.ts
- vision-preset.service.ts
- prompts/
  - enhancement.prompts.ts
  - concept.prompts.ts
- providers/
  - openai.provider.ts
  - replicate.provider.ts
  - stability.provider.ts

---

## 4.4 Provider Routing Strategy

Use a provider abstraction layer.

### Recommended early routing
- OpenAI image editing provider:
  - cleanup
  - listing enhancement
  - basic declutter
- Replicate provider:
  - virtual staging
  - furniture reduction
  - stronger style changes
- Stability or future provider:
  - flooring, wall tones, alternate stylization workflows

### Why this matters
Different providers are likely to perform better on different tasks. Codex should not hardwire all vision features to one provider.

---

## 4.5 Vision Job Types

Suggested enum:
- enhance_listing_quality
- declutter_light
- declutter_medium
- remove_furniture
- virtual_stage_light
- virtual_stage_modern
- paint_warm_neutral
- paint_bright_white
- paint_soft_greige
- floor_light_wood
- floor_medium_wood
- floor_lvp_neutral
- combined_listing_refresh

---

## 4.6 MongoDB Collections

### visionJobs
```json
{
  "_id": "visionjob_001",
  "mediaId": "media_001",
  "propertyId": "prop_001",
  "userId": "usr_001",
  "jobType": "declutter_light",
  "jobCategory": "enhancement",
  "roomType": "kitchen",
  "status": "processing",
  "provider": "openai",
  "providerJobId": "prov_123",
  "presetKey": "declutter_light",
  "promptVersion": 1,
  "inputHash": "sha256_xxx",
  "selectedVariantId": null,
  "createdAt": "2026-03-28T00:00:00.000Z",
  "updatedAt": "2026-03-28T00:00:00.000Z"
}
```

### visionVariants
```json
{
  "_id": "variant_001",
  "visionJobId": "visionjob_001",
  "mediaId": "media_001",
  "propertyId": "prop_001",
  "userId": "usr_001",
  "variantType": "declutter_light",
  "variantCategory": "enhancement",
  "label": "Decluttered Preview A",
  "storagePath": "vision/prop_001/media_001/variant_001.jpg",
  "thumbnailPath": "vision/prop_001/media_001/variant_001_thumb.jpg",
  "isSelected": false,
  "useInBrochure": false,
  "useInReport": false,
  "metadata": {
    "roomType": "kitchen",
    "provider": "openai",
    "presetKey": "declutter_light",
    "promptVersion": 1
  },
  "createdAt": "2026-03-28T00:00:00.000Z"
}
```

### visionUsage
```json
{
  "userId": "usr_001",
  "billingCycleKey": "2026-03",
  "jobsRun": 8,
  "enhancementJobs": 5,
  "conceptJobs": 3,
  "cacheHits": 2,
  "updatedAt": "2026-03-28T00:00:00.000Z"
}
```

---

## 4.7 Job Decision / Safeguard Flow

Before running any Vision job:

1. authenticate user
2. confirm access to property/media
3. load subscription / plan
4. enforce monthly vision credits
5. compute input hash from:
   - mediaId
   - presetKey
   - roomType
   - promptVersion
6. check if identical recent job exists
7. if cached, return existing variants
8. otherwise enqueue fresh job

### Recommended defaults
- Free seller: 3 jobs/month
- Paid seller: 20 jobs/month
- Agent Pro: 100 jobs/month
- Team: configurable

### Cooldown
- exact same preset + same image: return cached result for 24 hours

---

# 5. Exact Presets and Prompts

## 5.1 Prompt System Rules

Do not expose raw prompt entry for MVP.

Use curated presets only.

Each preset should define:
- presetKey
- displayName
- category
- room compatibility
- provider preference
- base prompt
- outputCount
- disclaimer type

---

## 5.2 Enhancement Presets

### Preset 1
**presetKey:** enhance_listing_quality
**Display Name:** Enhance for Listing
**Category:** enhancement
**Use Case:** Improve listing readiness while preserving truthfulness

**Prompt**
```text
Enhance this real estate photo for listing use. Improve brightness, clarity, and overall presentation while preserving the true structure, layout, and finishes of the room. Keep the image realistic, natural, and honest. Do not invent architectural features or remove major permanent elements.
```

### Preset 2
**presetKey:** declutter_light
**Display Name:** Light Declutter
**Category:** enhancement
**Use Case:** Remove small distracting clutter while keeping room realistic

**Prompt**
```text
Create a cleaner, more listing-ready version of this room by lightly reducing visible clutter, simplifying surfaces, and improving presentation quality. Keep the room realistic and truthful. Preserve architecture, major furniture, layout, and core finishes.
```

### Preset 3
**presetKey:** declutter_medium
**Display Name:** Medium Declutter
**Category:** enhancement
**Use Case:** Stronger cleanup without crossing into unrealistic transformation

**Prompt**
```text
Create a significantly cleaner and more presentation-ready version of this room by reducing visual clutter, simplifying countertops and surfaces, and improving overall buyer appeal. Keep the room realistic and believable. Preserve the true room layout, major architecture, and essential permanent features.
```

### Preset 4
**presetKey:** combined_listing_refresh
**Display Name:** Listing Refresh
**Category:** enhancement
**Use Case:** Light enhancement + declutter + brightness

**Prompt**
```text
Transform this room photo into a cleaner, brighter, more listing-ready version. Improve lighting, reduce clutter, and create a polished real-estate-photo feel while preserving the room’s true structure, layout, and finishes. Keep the image realistic and honest.
```

---

## 5.3 Concept Preview Presets

### Preset 5
**presetKey:** remove_furniture
**Display Name:** Remove Furniture
**Category:** concept_preview
**Use Case:** Show room with less furniture

**Prompt**
```text
Create a conceptual preview of this room with most movable furniture removed to make the space feel more open. Preserve the architecture, layout, and permanent finishes. Keep the output realistic, but clearly suitable as a conceptual preview rather than an exact final result.
```

### Preset 6
**presetKey:** virtual_stage_light
**Display Name:** Light Virtual Staging
**Category:** concept_preview
**Use Case:** Add tasteful staging to sparse or awkward rooms

**Prompt**
```text
Create a tasteful virtual staging concept for this room using light, modern, buyer-friendly furniture and decor. Keep the staging realistic, minimal, and aligned with a mainstream residential listing style. Preserve the room layout and architecture.
```

### Preset 7
**presetKey:** virtual_stage_modern
**Display Name:** Modern Staging
**Category:** concept_preview
**Use Case:** Stronger polished staging concept

**Prompt**
```text
Create a polished modern virtual staging concept for this room using clean, upscale, buyer-friendly furnishings and decor. Keep the result realistic and balanced for a residential real estate listing. Preserve architecture and room proportions.
```

### Preset 8
**presetKey:** paint_warm_neutral
**Display Name:** Warm Neutral Walls
**Category:** concept_preview
**Use Case:** Show warm neutral paint concept

**Prompt**
```text
Create a conceptual preview of this room with the walls repainted in a warm neutral tone suitable for broad buyer appeal. Preserve all architecture, trim, windows, and layout. Keep the image realistic and suitable for showing a paint concept only.
```

### Preset 9
**presetKey:** paint_bright_white
**Display Name:** Bright White Walls
**Category:** concept_preview
**Use Case:** Show cleaner brighter wall concept

**Prompt**
```text
Create a conceptual preview of this room with the walls repainted a bright white tone for a clean and airy listing presentation. Preserve architecture, trim, and layout. Keep the result realistic and clearly a concept preview.
```

### Preset 10
**presetKey:** paint_soft_greige
**Display Name:** Soft Greige Walls
**Category:** concept_preview
**Use Case:** Show a current-market designer-neutral wall concept

**Prompt**
```text
Create a conceptual preview of this room with the walls changed to a soft greige tone that feels modern and buyer-friendly. Preserve the room’s true structure and layout. Keep the output realistic and suitable for listing-planning visualization.
```

### Preset 11
**presetKey:** floor_light_wood
**Display Name:** Light Wood Floors
**Category:** concept_preview
**Use Case:** Replace carpet or dated flooring conceptually

**Prompt**
```text
Create a conceptual preview of this room with the flooring changed to a light wood look suitable for a modern residential listing. Preserve room proportions, baseboards, walls, and architecture. Keep the output realistic and clearly a planning concept.
```

### Preset 12
**presetKey:** floor_medium_wood
**Display Name:** Medium Wood Floors
**Category:** concept_preview
**Use Case:** Slightly richer wood tone concept

**Prompt**
```text
Create a conceptual preview of this room with the flooring changed to a medium-tone wood finish that feels warm, modern, and buyer-friendly. Preserve the room structure and layout. Keep the output realistic and appropriate for planning visualization.
```

### Preset 13
**presetKey:** floor_lvp_neutral
**Display Name:** Neutral LVP Floors
**Category:** concept_preview
**Use Case:** Luxury vinyl plank concept

**Prompt**
```text
Create a conceptual preview of this room with the flooring changed to a neutral luxury vinyl plank look suitable for a practical, updated residential listing. Preserve architecture and room proportions. Keep the image realistic and suitable as a concept only.
```

---

## 5.4 Room-Specific Prompt Add-Ons

Use room-aware suffixes appended to prompts.

### Kitchen add-on
```text
Keep countertops, cabinets, appliances, and backsplash visually coherent and realistic.
```

### Living room add-on
```text
Preserve focal points such as fireplace, windows, and major seating zones.
```

### Bedroom add-on
```text
Keep the room calm, uncluttered, and proportional, without over-staging.
```

### Bathroom add-on
```text
Preserve tile, vanity, mirrors, and fixtures accurately while improving visual cleanliness.
```

### Exterior add-on
```text
Preserve the real structure, roofline, doors, windows, and lot boundaries.
```

---

# 6. Detailed Vision Tab UI Design

## 6.1 Vision Tab Purpose

The Vision tab should feel like a premium studio.

It should answer:
- what can I improve about this photo?
- what would this room look like with updates?
- which version should I use in brochure/report materials?

---

## 6.2 Desktop Layout

### Global structure
Header
Preset Action Row
Main Compare Workspace
Variant Rail
Context / Usage Panel

### Grid
- 12-column layout
- 24px gap
- max width 1400px

---

## 6.3 Vision Tab Header

### Left
- Title: Listing Vision Mode
- Property name
- Current selected photo room tag

### Right
- Usage credits remaining
- Link to original media item
- Quick action:
  - Use selected in brochure
  - Use selected in report

---

## 6.4 Preset Action Row

Horizontal preset groups:

### Group 1 — Enhance
- Enhance for Listing
- Light Declutter
- Medium Declutter
- Listing Refresh

### Group 2 — Preview
- Remove Furniture
- Virtual Stage
- Warm Neutral Walls
- Bright White Walls
- Soft Greige Walls
- Light Wood Floors
- Medium Wood Floors
- Neutral LVP

UI behavior:
- chip buttons or segmented action cards
- active selection highlighted
- tooltip or helper text on hover

---

## 6.5 Main Compare Workspace

### Layout
Left panel: Original image
Right panel: Selected output variant

### Controls above images
- Original
- Enhanced
- Concept Preview
- Compare mode toggle:
  - Side by side
  - Tab switch
  - Slider later

### Info block below selected variant
- Preset used
- Created at
- Category:
  - Enhancement
  - Concept Preview
- Recommended use:
  - Brochure
  - Report
  - Internal planning only

---

## 6.6 Variant Rail

Right-side column or lower panel:
- thumbnail list of all generated variants for this media
- each card shows:
  - variant label
  - type
  - created time
  - selected state
  - use in brochure/report toggles

Actions per variant:
- View
- Set as preferred
- Use in brochure
- Use in report
- Archive later

---

## 6.7 Context / Guidance Panel

Below or right of the compare area, show:

### AI guidance block
- why this preset was suggested
- what this variant improves
- whether this is better for:
  - brochure
  - seller report
  - decision-making only

### Example text
- This decluttered version improves visual simplicity and may photograph better in brochure materials.
- This paint preview is best used as a planning concept, not as a direct marketing image.

---

## 6.8 Required Actions

Buttons visible on selected variant:
- Set as Preferred Variant
- Use in Brochure
- Use in Report
- Generate Another Variant
- Return to Original

---

## 6.9 Empty State

If no variants exist:
- show selected photo
- show top suggested presets
- show short explanation:
  Generate your first enhanced or conceptual version to preview how this room could present better.

---

## 6.10 Loading State

When a job is running:
- visible progress card
- status text:
  - Preparing image
  - Generating variant
  - Finalizing output
- skeleton placeholder in output pane
- non-blocking browsing of existing variants still allowed

---

## 6.11 Mobile/Responsive Notes

### Tablet
- stack original and selected variant vertically
- move variant rail below compare area

### Mobile
- tabbed internal compare:
  - Original
  - Variant
  - Compare
- action chips scroll horizontally
- selected variant action bar pinned near bottom

---

# 7. Wiring Vision into PDF / Report System

## 7.1 Integration Goal

Vision output should not remain isolated.

It must feed:
- brochure generation
- full seller report
- improvement recommendations
- future realtor presentation mode

---

## 7.2 Report Usage Rules

### Enhancement variants
These may be included directly in brochure/report imagery if:
- realistic
- clearly closer to truthful presentation
- not materially deceptive

Examples:
- brighter image
- light declutter
- listing refresh

### Concept preview variants
These should appear only in:
- improvement recommendations section
- optional concept appendix
- dedicated See the Potential section

They should not silently replace actual room photos.

---

## 7.3 Report Section Additions

Add a new optional report section:

## Section: Visual Improvement Previews

Include:
- Original image
- Enhanced or concept preview
- Title of preset used
- Short explanation
- Disclaimer

### Example layout
- Original kitchen photo
- Decluttered kitchen preview
- This concept shows how a cleaner presentation may improve listing appeal.

---

## 7.4 Improvement Recommendation Linkage

When improvement recommendations mention:
- declutter
- repaint
- flooring changes
- staging

And a Vision preview exists, attach it.

### Example
Recommendation: Repaint living room warm neutral
Add: Related preview image from paint_warm_neutral

This makes the report dramatically more persuasive.

---

## 7.5 Report Payload Fields

Extend report payload with:

```json
{
  "visionSummary": {
    "selectedEnhancementVariants": [],
    "selectedConceptVariants": [],
    "includeVisionSection": true
  }
}
```

Each included vision asset should include:
- originalMediaId
- variantId
- presetKey
- variantCategory
- label
- noteForReport
- disclaimerType

---

## 7.6 Report Template Usage

### In report body
Use enhancement images in:
- photo readiness section
- selected listing image section

### In report concept section
Use concept previews in:
- improvement recommendations
- visual potential section

### Report disclaimer block
If any concept previews are included, automatically include:
Some images in this section are AI-generated concept previews for planning purposes only and do not reflect completed improvements.

---

## 7.7 Brochure Usage Rules

### Allowed
- enhancement variants selected for brochure
- cleaner/brighter truthful images

### Not recommended by default
- concept staging or major remodel concept images in general brochure output, unless explicitly marked as concept preview

This preserves trust.

---

## 7.8 Realtor Presentation Mode (Future)

Vision output should later support:
- side-by-side before/after slides
- listing appointment pitch deck
- what to do before listing visual walkthrough

This is a major future upsell path.

---

# 8. Suggested Build Order

## Phase 1 — MVP Premium Win
1. provider router
2. enhancement presets
3. declutter presets
4. vision jobs + variants collections
5. desktop Vision tab compare UI
6. selected variant actions
7. brochure/report integration flags

## Phase 2 — Wow Features
8. virtual staging
9. wall-color previews
10. flooring previews
11. variant gallery improvements
12. guidance text per variant

## Phase 3 — Persuasion Layer
13. report Visual Improvement Previews section
14. recommendation-to-preview linking
15. before/after slider
16. realtor presentation mode later

---

# 9. Final Direction to Codex

Build Listing Vision Mode as a premium studio experience, not a utility feature.

Prioritize:
- realism
- clear labeling
- strong preset UX
- variant comparison
- simple selection actions
- integration into brochure/report outputs

Do not overcomplicate the first release with raw prompt entry or too many options.

The system should feel:
- visual
- trustworthy
- premium
- easy to use
- powerful in front of sellers

That is how this becomes one of the strongest features in the entire product.

---

End of Document
