# Workside Home Advisor — PDF Upgrade Spec for Codex

## Objective

Upgrade both PDF outputs so they feel like premium, market-ready real estate deliverables rather than raw generated reports.

Affected outputs:
- Seller Intelligence Report / Property Summary Report
- Marketing Report / Sales Brochure

Primary goals:
- improve visual hierarchy
- improve typography, spacing, and page composition
- eliminate placeholder / empty states in production PDFs
- make the Seller Report feel analytical and trustworthy
- make the Marketing Report feel aspirational and conversion-focused
- preserve Puppeteer as the primary renderer and keep the pdf-lib fallback only as a safety net

---

## Current Problems to Fix

### 1. Reports feel generated instead of premium
The current layouts are structurally good, but the cards, spacing, typography, and density feel generic. They need stronger hierarchy and cleaner rhythm.

### 2. Too many sections have equal visual weight
The page needs stronger emphasis on:
- readiness / score
- selected price
- top opportunities
- top photos
- call to action

### 3. Placeholder content must never appear in production
Do not render text such as:
- Risk pending
- Opportunity pending
- No action plan has been generated yet
- No internal provider recommendations are ready yet
- blank property details like --

If data is missing:
- either hide the section entirely
- or render a polished fallback sentence that still feels intentional

### 4. Marketing PDF needs to sell
The marketing brochure should feel like a polished listing flyer / digital brochure that a realtor would be proud to send.

### 5. Page layout needs better print discipline
Need better control of:
- page breaks
- card splitting
- image cropping
- footer consistency
- margin consistency
- orphan headings

---

## Global Design Direction

Build the reports in a clean, premium style inspired by modern real estate brands and executive dashboards.

### Visual style
- clean white / soft warm neutral background
- strong dark headings
- muted secondary text
- restrained accent color using Workside green/sage tones
- generous spacing
- rounded cards
- subtle borders, not heavy fills
- avoid visually muddy beige stacking

### Typography
Use a clear hierarchy:
- H1: strong serif or premium display style for the main title
- H2/H3: clean sans-serif, bold, tight spacing
- body: highly readable sans-serif, 14–16px equivalent in HTML
- micro labels: uppercase tracking, muted

Suggested font pairing if available in HTML/PDF:
- Headings: Playfair Display, Libre Baskerville, or similar
- Body/UI: Inter, system-ui, or Helvetica/Arial fallback

### Layout rules
- max 2–3 primary columns on dense pages
- avoid tiny text blocks crammed into narrow cards
- use consistent internal padding on all cards
- maintain clear vertical rhythm between sections
- keep each page visually balanced

### Shared PDF rules
- all pages need consistent footer
- footer should include:
  - Workside Home Advisor
  - site URL
  - support email
  - report title + page section
- footer should be subtle and small
- do not let footer crowd content

---

## Technical Requirements

### Rendering
- Keep Puppeteer as primary renderer
- Keep pdf-lib fallback only for failure recovery
- Add explicit logging when fallback is used

### Page CSS
Codex should improve the HTML/CSS templates with print-safe CSS:
- use `@page` for margins
- use `page-break-inside: avoid` on cards, photo groups, and comp rows where possible
- use `break-inside: avoid` for modern CSS support
- prevent headings from landing at bottom of page without content beneath
- ensure image containers use `object-fit: cover`
- ensure cards do not overflow page width or page height

### Graceful rendering rules
Create helper utilities so each section only renders if data quality is sufficient.

Examples:
- only show comps section if comps array has usable values
- only show provider recommendations if at least one provider exists
- only show next steps if at least one action exists
- only show buyer persona if non-empty
- if property details are incomplete, show a polished compact property facts block using only available fields

---

## Seller Intelligence Report — Required Changes

## 1. Cover Page Redesign

### Current issue
The cover has good ingredients but weak hierarchy. Metrics and summary compete visually with the image.

### Required redesign
Create a stronger hero layout:
- report eyebrow at top
- large title
- one concise value-oriented summary paragraph
- hero image on right or top-right with more confident framing
- below hero, a 4-card KPI row

### KPI cards should contain
- Readiness score
- Selected price
- Photo coverage
- Checklist progress

### KPI card behavior
Each card should include:
- micro label
- large metric
- one short supporting line

### KPI card styling
- white cards with subtle border
- slightly larger numerals
- better spacing between label, metric, and support text
- score / status pill should have color logic

### Status color logic
- Ready: green
- Almost Ready: amber
- Needs Work: muted red

### Summary narrative block
Under the KPI row, render:
- brief summary of overall condition
- top opportunity
- top risk
- estimated budget / value-protection message if available

This section should feel like an executive summary, not a raw data dump.

---

## 2. Pricing Analysis Page

### Keep core structure but improve execution
The pricing page should feel like a polished market analysis dashboard.

### Required elements
- suggested range
- midpoint
- chosen list price
- pricing confidence
- pricing narrative
- comp map
- risk and opportunity if available

### Specific instructions
- Put the 3–4 pricing metrics in a tight top row
- Make the pricing narrative shorter and more scannable
- Use a dedicated “pricing rationale” card with 2–3 short paragraphs max
- If risk / opportunity exists, render them as labeled chips or mini callouts
- If they do not exist, do not render placeholders

### Comp map
- improve framing and sizing
- ensure map fills its card better
- avoid tiny map in giant empty container
- if static map is low resolution, upscale or improve map generation

---

## 3. Comparable Sales Section

### Current issue
The comp list is too plain and text-heavy.

### Required redesign
Convert comparable properties into a clean table or stacked comparison cards.

### For each comp include
- label (A, B, C...)
- address
- sale/list price
- beds / baths
- sqft
- distance
- price per sqft if calculable

### Formatting requirements
- align numeric columns cleanly
- emphasize price and distance
- make address readable but not oversized
- include light zebra striping or row separators
- do not allow rows to split awkwardly across pages

### Optional improvement
If enough data exists, add a tiny summary row above the table:
- median comp price
- median price/sqft
- closest comp
- strongest comp match

---

## 4. Readiness and Preparation Page

### Current strength
This is one of the strongest pages already. Preserve the idea, but polish it heavily.

### Required changes
- keep selected photo gallery
- improve image card consistency
- use fixed aspect ratio thumbnails
- add better caption hierarchy
- if enhancement status exists, show it as a small badge

### Readiness score card
Make this a stronger dashboard card with:
- overall readiness
- photo quality
- retakes
- open items

Use more prominent numerals and better spacing.

### Preparation recommendations
Convert recommendations into a ranked list:
1. top 5 max on page
2. each item can optionally show estimated effort / impact if available
3. if more than 5 exist, show “additional items available in app” or similar polished note

### Cost and ROI card
This card should feel important:
- show estimated prep investment
- show estimated value protection / upside
- if both numbers exist, render a simple ratio or comparison line

---

## 5. Action Plan Page

### Current issue
This page is the weakest because too much data is missing.

### Required redesign
This page should become a clear execution page, but only show sections with usable data.

### Candidate sections
- property details
- buyer persona
- top reasons to buy
- provider recommendations
- next steps
- checklist / marketing momentum

### Rendering rules
- If property details are missing, do not show placeholder dashes
- Only render facts that exist
- If no providers exist, replace with a polished sentence like:
  “Provider recommendations will appear here once local marketplace matches are available.”
  or hide the entire section if preferred
- If no action plan exists, generate a default ordered launch checklist from available report data

### Default launch checklist if none exists
Use a sensible fallback derived from readiness data:
1. Complete top photo retakes
2. Finish open checklist items
3. Address top staging / decluttering issue
4. Review pricing and confirm launch position
5. Prepare marketing brochure and showing assets

This page should never feel empty.

---

## Marketing Report — Required Changes

## 1. Cover Page Redesign

### Current issue
The cover has a decent layout but does not feel premium or emotionally compelling enough.

### Required redesign
Turn the cover into a true listing brochure cover.

### Layout
- stronger hero image presence
- cleaner title block
- shorter supporting paragraph
- prominent price badge
- better highlights strip
- cleaner CTA block

### Headline guidance
The headline should sound polished and marketable, not generic. Example style:
- Comfortable Corner-Lot Living in Northwest Bakersfield
- Bright, Updated 3-Bedroom Home with Spacious Backyard

Generate headline from property strengths when possible.

### CTA block
Use a visually distinct CTA box with:
- schedule a showing
- request full property package
- support/contact info

Do not let the CTA card become an awkward narrow text column.

---

## 2. Gallery / Conversion Page

### Current issue
The gallery is decent, but the lower sections feel underdeveloped and leave too much empty space.

### Required redesign
This page should feel like a polished brochure interior.

### Required sections
- photo gallery
- key features
- property highlights
- neighborhood / local lifestyle context
- pricing positioning
- CTA/contact

### Photo gallery
- use larger images
- maintain consistent cropping
- consider 2x2 or 3-up layout depending on photo count
- avoid tiny images floating in oversized containers

### Key features
- tighten language
- use 4–6 bullets max
- remove repetitive phrasing
- support stronger buyer appeal language

### Neighborhood section
If neighborhood data exists, render it.
If not, generate a tasteful local context summary from city/neighborhood/address data, such as:
- convenience to local shopping
- established residential setting
- family-friendly or move-up buyer appeal

Do not leave giant blank boxes.

### Pricing positioning
This should not just repeat price.
Instead say something like:
- competitively positioned at $395,000
- aligned with recent comparable sales
- intended to balance value perception and buyer demand

---

## 3. Final Page / Page Flow

If the marketing PDF only needs 2 pages, keep it to 2 polished pages.
Do not force a weak 3rd page with excessive whitespace.

### Rules
- If content fits cleanly in 2 pages, output 2 pages only
- Only add a third page if there is meaningful content:
  - larger gallery
  - neighborhood map + points of interest
  - expanded property details

The current extra whitespace is unacceptable in production.

---

## Content Quality Rules

Codex should improve generated copy before rendering.

### Rules
- avoid repetitive adjectives
- avoid robotic phrasing
- vary sentence length
- keep marketing copy warm, natural, and concise
- keep seller report copy analytical and grounded
- do not overpromise ROI or sale outcomes

### Never render
- placeholder dashes
- “pending” labels
- empty bullet lists
- broken sections with no data
- raw enum-like values such as `single_family`

Instead format values for humans:
- `single_family` -> `Single-family home`

---

## Data Formatting Rules

Codex should add formatters for:
- currency
- percent
- sqft
- beds / baths
- title case labels
- address consistency
- date formatting

### Examples
- 1315 -> `1,315 sqft`
- 0.27 -> `0.27 mi`
- 395000 -> `$395,000`
- single_family -> `Single-family home`

---

## Image Handling Rules

- all images should be cropped intentionally
- no distorted aspect ratios
- use rounded corners consistently
- use high enough resolution to avoid blurry print results
- if image count is low, enlarge the best images rather than showing many weak thumbnails
- if a map is low quality, do not render it oversized

---

## Reusable Component Refactor

Codex should refactor report rendering into reusable components/partials so both reports share the same design language.

Create reusable building blocks such as:
- report shell
- page header
- footer
- metric card
- section heading
- image tile
- comp table
- CTA card
- pill / badge
- fact grid

This is important because both PDFs should feel like part of the same product family.

---

## Implementation Priorities

### Phase 1 — Must do now
1. remove all placeholders / empty states from production PDFs
2. improve typography, spacing, and metric hierarchy
3. fix weak page composition and whitespace issues
4. improve marketing report CTA and cover page
5. make final page counts intentional

### Phase 2 — Strongly recommended
1. refactor into shared components
2. improve comp table formatting
3. generate better fallback narrative text when data is partial
4. improve map rendering quality

### Phase 3 — Nice to have
1. optional branded themes
2. white-label support for agents/brokerages
3. optional QR codes for property page / showing request
4. optional “prepared for seller” personalization

---

## Acceptance Criteria

Codex implementation is complete when:

- both PDFs look premium and intentional
- no placeholder text appears anywhere
- no empty boxes remain
- seller report feels analytical and polished
- marketing report feels like a true brochure
- typography and spacing are materially improved
- page breaks are clean
- 2-page vs 3-page decisions are content-driven
- all human-facing values are formatted properly
- Puppeteer path still works as primary renderer
- fallback path remains in place for reliability

---

## Explicit Instruction to Codex

Implement this as a real design pass, not a minor CSS tweak.

I want:
- improved HTML templates
- improved print CSS
- component cleanup / reuse
- stronger copy formatting
- graceful section rendering
- premium report quality suitable for real seller-facing and buyer-facing use

Do not stop at “working.”
Stop when the PDFs feel polished enough that we would confidently show them to real homeowners and agents.
