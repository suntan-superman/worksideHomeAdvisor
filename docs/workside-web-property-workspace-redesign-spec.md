# Workside Home Advisor
## Screen-by-Screen Web Property Workspace Redesign Spec
### Codex-Ready UX and Product Blueprint

Last Updated: 2026-03-28

---

# 1. Purpose

This document defines the redesigned **web property workspace** for Workside Home Advisor.

The goal is to turn the current property page from a functional collection of sections into a premium, guided workspace that feels like a true command center for:
- pricing
- comps
- maps
- media
- AI photo review
- listing-ready photo selection
- AI image enhancement
- brochure generation
- full property report generation
- seller checklist and provider guidance

This redesign should unify the product around one core experience:

> **Prepare, price, present, and sell the property from one workspace**

---

# 2. Design Goals

The web property workspace must feel:
- premium
- highly useful
- guided
- realtor-ready
- seller-friendly
- visually strong
- data-rich without feeling cluttered

It should:
- surface the most important actions first
- reduce hunting for next steps
- help users move through a guided property workflow
- support both seller and future realtor modes
- integrate media, pricing, checklist, flyer, and report systems cleanly

---

# 3. Primary Product Principle

The property workspace should not behave like a generic dashboard.

It should behave like:

> **A step-by-step listing preparation studio**

---

# 4. High-Level Workspace Structure

Recommended top-level page structure:

```text
Property Header
Action Bar
Progress / Readiness Summary
Primary Workspace Tabs
Context Panel / Secondary Cards
```

### Primary workspace tabs
Recommended:
- Overview
- Pricing
- Photos
- Vision
- Brochure
- Report
- Checklist

Optional future:
- Providers
- Activity
- Realtor Mode

---

# 5. Global Workspace Layout

## 5.1 Page Header

### Left side
- property address
- city/state/zip
- status badge
- property summary line:
  - beds
  - baths
  - sqft
  - property type

### Right side
Primary actions:
- Run Pricing
- Generate Brochure
- Generate Report
- Share later
- More Actions dropdown

### Status chips
- Pricing Ready / Needs Refresh
- Media Coverage Score
- Listing Readiness Score
- Checklist Progress

---

## 5.2 Sticky Action Bar

Directly below the header, include a sticky action bar with the highest-value actions:

- Add Photos
- Select Listing Photos
- Enhance Photo
- Generate Brochure
- Generate Full Report
- View Checklist
- Refresh Pricing

This bar should remain visible while scrolling the workspace.

---

## 5.3 Readiness Summary Strip

Show four prominent cards:

### Card 1 — Pricing
- current range
- confidence
- last analyzed date

### Card 2 — Photos
- number uploaded
- room coverage summary
- listing candidate count

### Card 3 — Readiness
- overall listing readiness score
- short AI summary

### Card 4 — Next Best Action
Example:
- “Select 5 listing-ready photos”
- “Retake kitchen photos”
- “Generate full seller report”

This strip should make the workspace immediately understandable.

---

# 6. Screen 1 — Workspace Overview Tab

## Purpose
This is the property home screen inside the workspace.

It should answer:
- what do I know about this property?
- what is still missing?
- what should I do next?

---

## Layout

### Section A — Hero Summary
Show:
- hero image or best selected listing photo
- short AI property summary
- readiness score
- status chips

### Section B — Quick Metrics Grid
Cards:
- Recommended Price Range
- Top Comp Count
- Uploaded Photos
- Listing Candidate Photos
- Checklist Completion
- Report Status

### Section C — AI Insights Summary
Show a stacked card with:
- pricing summary
- photo readiness summary
- top improvement recommendations
- strongest selling points
- biggest current weakness

### Section D — Next Steps Module
Show a prioritized task list:
1. Select listing-ready photos
2. Review top comps
3. Improve living room photo coverage
4. Generate brochure
5. Generate full report

### Section E — Recent Outputs
Show cards for:
- latest brochure
- latest report
- latest pricing analysis
- latest enhanced photo

### Section F — Seller View / Agent View Future Toggle
Reserve space for future audience-specific layout switching

---

# 7. Screen 2 — Pricing Tab

## Purpose
Make pricing feel trustworthy, explainable, and visual.

It should answer:
- what is the suggested price?
- why?
- which comps support it?
- where are those comps located?
- how confident is the system?

---

## Layout

### Section A — Pricing Summary Card
Show:
- low / mid / high range
- confidence score
- latest analysis date
- recommended pricing posture:
  - conservative
  - balanced
  - aggressive

### Section B — Why This Price
Large explanation card with:
- AI narrative
- confidence reasoning
- AVM + comps explanation
- “what could raise or lower confidence”

### Section C — Comps Table
Columns:
- Address
- Sale Price
- Beds/Baths
- SqFt
- Distance
- Sold Date
- Price/SqFt
- Comp Score
- Why Selected

Allow:
- sort
- compare
- expand row
- print-friendly styling

### Section D — Comp Map
Large Google map section:
- subject property marker
- comp markers
- optional distance ring
- clickable comp pins
- comp legend

### Section E — Pricing Notes
Allow seller/agent notes:
- custom notes
- pricing commentary
- save notes for report / brochure later

### Section F — Actions
Buttons:
- Refresh Pricing
- Include in Report
- Export Pricing PDF later
- Open Full Report

---

# 8. Screen 3 — Photos Tab

## Purpose
Turn media into a real listing-prep workflow, not just a gallery.

It should answer:
- what photos do I have?
- which are strongest?
- what is missing?
- which should be used for listing materials?

---

## Layout

### Section A — Media Summary Bar
Show:
- total uploaded photos
- rooms covered
- rooms missing
- listing candidate count
- enhanced image count

### Section B — AI Photo Coverage Card
Show:
- room coverage analysis
- missing room suggestions
- strongest room categories
- retake priorities

### Section C — Gallery Grid
Photo cards show:
- thumbnail
- room label
- quality score
- listing candidate badge
- enhanced variant available badge
- AI recommendation snippet

### Section D — Filters
Allow filtering by:
- room type
- listing candidate
- needs retake
- enhanced
- original only

### Section E — Photo Detail Drawer / Modal
When clicked, show:
- full image
- room tag
- description
- AI quality score
- AI summary
- issues / retake recommendations
- buttons:
  - Mark as Listing Candidate
  - Remove Candidate
  - Enhance Photo
  - Open in Vision
  - Use in Brochure
  - Include in Report

### Section F — Best Listing Photos Module
Dedicated card:
- AI-selected top 3–5 listing images
- allow manual override
- allow reorder
- save final selection

This is critical and should be visually prominent.

---

# 9. Screen 4 — Vision Tab

## Purpose
This is the home for AI image enhancement and conceptual property visualization.

It should answer:
- how can I improve this image?
- what would this room look like if updated?
- which version should be used in materials?

---

## Layout

### Section A — Vision Overview
Intro card:
- explanation of Enhancement vs Concept Preview
- disclaimer
- recent variants created

### Section B — Selected Photo Workspace
Main visual panel:
- original image on left
- selected variant on right

Tabs:
- Original
- Enhanced
- Concept Preview

### Section C — Action Presets
Buttons/cards:
- Enhance for Listing
- Declutter
- Remove Furniture
- Stage Room
- Try Wall Colors
- Try New Flooring

### Section D — Variant Gallery
Show all generated variants for selected media
Each variant card includes:
- type
- creation time
- selected/not selected
- actions:
  - set as preferred
  - use in brochure
  - use in report
  - compare
  - regenerate later

### Section E — Before/After Compare
Support:
- side-by-side compare
- future slider view

### Section F — AI Insight Note
Generate optional text:
- “This decluttered version may improve listing appeal by making the room feel more open.”
- “Neutral paint concepts may support broader buyer appeal.”

### Required Disclaimer
Always show:
AI visualizations are conceptual previews only. Actual results and value impact may vary.

---

# 10. Screen 5 — Brochure Tab

## Purpose
Turn selected property data + chosen images into polished marketing output.

It should answer:
- what will my listing brochure look like?
- which photos are being used?
- what copy is being used?
- can I improve it before export?

---

## Layout

### Section A — Brochure Summary
Show:
- brochure status
- brochure type
- last generated date
- number of selected images

### Section B — Layout Preview
Large preview card:
- brochure page preview
- selected theme/template
- mini page thumbnails for future multi-page support

### Section C — Included Photos
Show selected brochure photos
Allow:
- reorder
- swap
- add/remove from gallery
- mark hero image

### Section D — Marketing Copy Controls
Sections:
- headline
- subheadline
- short description
- long description
- key features list

Allow:
- AI regenerate
- tone switch:
  - professional
  - warm
  - premium
  - minimal

### Section E — Template Controls
Allow:
- choose template
- choose accent style
- choose image density
- choose brochure format:
  - single page
  - two page later
  - luxury mode later

### Section F — Actions
Buttons:
- Regenerate Brochure
- Download PDF
- Save Draft
- Include in Report Summary later
- Share later

---

# 11. Screen 6 — Report Tab

## Purpose
Own the full property report workflow.

It should answer:
- what will the final report include?
- is it current?
- can I regenerate it?
- can I download/share it?

---

## Layout

### Section A — Report Status Card
Show:
- latest report status
- last generated date
- stale / current badge
- report version if useful

### Section B — Report Preview Outline
Visual card showing included sections:
- Executive Summary
- Pricing
- Comps
- Map
- Photo Review
- Improvement Recommendations
- Checklist
- Providers
- Marketing Guidance
- Draft Listing Description

### Section C — Included Assets Summary
Show:
- hero image
- selected photos
- comp count
- checklist completion
- provider count

### Section D — Regenerate Controls
Allow:
- Regenerate Report
- Use Current Pricing
- Use Selected Listing Photos
- Include Enhanced Images
- Include Provider Section

### Section E — Preview Pane
HTML preview or simplified preview snapshot later

### Section F — Actions
Buttons:
- Generate Full Report
- Download PDF
- Email later
- Share later

---

# 12. Screen 7 — Checklist Tab

## Purpose
Turn seller guidance into an actionable workflow.

It should answer:
- what do I still need to do?
- what matters most next?
- who can help me do it?

---

## Layout

### Section A — Checklist Progress Header
Show:
- completion percentage
- current phase
- next recommended task
- readiness lift if task completed

### Section B — Phase Navigation
Accordion or segmented layout:
- Pre-Listing
- Listing Launch
- Under Contract
- Closing

### Section C — Task Cards
Each task shows:
- title
- why it matters
- status
- AI note
- related room/media if applicable
- provider count if relevant

Actions:
- mark complete
- save for later
- find providers
- add note

### Section D — Recommended Providers Inline
For relevant tasks, show top providers directly under task:
- title companies
- inspectors
- attorneys
- photographers
- cleaners / painters later

### Section E — Checklist Notes
Allow:
- seller notes
- agent notes later
- checklist export later

---

# 13. Future Screen — Providers Tab (Optional Early / Strong Later)

## Purpose
Separate provider exploration from task view when the marketplace grows.

### Layout
- provider category filters
- city/radius filters
- sponsored and verified labels
- compare providers
- save providers
- contact / website actions
- provider analytics later

---

# 14. Cross-Screen UX Rules

## 14.1 Consistent Property Context
Every tab should clearly show:
- current property
- current status
- last updated
- next best action

## 14.2 Persistent Right Rail or Summary Rail
On desktop, use a right rail for persistent context:
- readiness score
- selected listing photos count
- latest pricing
- latest brochure/report status
- quick action buttons

## 14.3 Empty State Design
Every major section needs polished empty states.

Examples:
- No pricing yet → Run pricing analysis
- No photos yet → Upload or capture photos
- No selected listing photos → Choose top images
- No brochure yet → Generate brochure
- No report yet → Generate full report

## 14.4 Toast and Status Messaging
Use clear, premium feedback:
- Report generated successfully
- Brochure updated
- Photo marked as listing candidate
- Enhanced image created
- Pricing is already current; showing latest analysis

---

# 15. Recommended Visual Design System

## Workspace should feel
- clean
- modern
- lightly premium
- grounded in real estate professionalism
- strong but not flashy

## Recommended design patterns
- large content cards
- clear section spacing
- subtle shadows
- blue Workside accents
- image-forward presentation
- dense information only where needed
- sticky actions
- crisp tables and map modules

---

# 16. Screen Prioritization for Codex

## Phase 1 — Highest Impact
1. Overview redesign
2. Pricing tab polish
3. Photos tab with listing-candidate workflow
4. Brochure tab polish
5. Report tab generation flow

## Phase 2 — Major Differentiation
6. Vision tab
7. Checklist tab with provider integration

## Phase 3 — Expansion
8. Providers tab
9. Realtor mode overlays
10. Presentation mode

---

# 17. Implementation Notes for Codex

## Suggested folder structure
```text
apps/web/src/features/property-workspace/
  components/
    header/
    action-bar/
    readiness-strip/
    overview/
    pricing/
    photos/
    vision/
    brochure/
    report/
    checklist/
  hooks/
  services/
  types/
```

## Suggested route structure
```text
/properties/:id
/properties/:id/pricing
/properties/:id/photos
/properties/:id/vision
/properties/:id/brochure
/properties/:id/report
/properties/:id/checklist
```

or preserve one main route with internal tabs if preferred.

## State/data rules
- React Query for all server-backed data
- optimistic updates for candidate-photo selection and checklist completion where appropriate
- separate loading states per section
- avoid making the whole page block on one section refresh

---

# 18. Acceptance Criteria

The redesign is successful when a user can:

1. understand the property status within 5 seconds
2. see the current pricing range and confidence clearly
3. understand why comps were chosen
4. see where comps are located on a map
5. review all saved photos
6. mark photos as listing-ready candidates
7. generate or view enhanced photo variants
8. generate and preview brochure output
9. generate and download a full report
10. work through the seller checklist from the same workspace

---

# 19. Final Direction to Codex

This redesign should not feel like a generic admin panel.

It should feel like:
- a listing preparation studio
- a seller command center
- a realtor-ready presentation tool
- a premium AI-assisted workspace

Prioritize:
- clarity
- actionability
- visual hierarchy
- cross-feature cohesion
- “next step” guidance
- strong output generation paths

The property workspace is the heart of the product. It should become the place where the user feels:

> “Everything I need to prepare and sell this property is right here.”

---

End of Document
