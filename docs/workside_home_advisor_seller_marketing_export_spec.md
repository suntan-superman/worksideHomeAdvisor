# Workside Home Advisor — Seller Marketing Export Engine
## Codex-Ready Implementation Specification

**Version:** 1.0  
**Prepared for:** Workside Home Advisor  
**Purpose:** Define the full seller marketing export system so property information entered once in the Workside Home Advisor app can be transformed into channel-ready outputs for MLS, Google, social media, email, SMS, flyers, landing pages, and internal advisor workflows.

---

## 1. Product Goal

Build a **single-source-of-truth listing marketing engine** inside Workside Home Advisor.

The seller, advisor, or internal admin enters the property details once. The system then generates:

- MLS-ready structured data
- Google Business / Google listing support content
- Social media post variants
- Property landing page content
- Email campaign content
- SMS teaser content
- Printable flyer content
- Open house promotional content
- Internal review/checklist output
- Downloadable export bundles

The goal is to eliminate repetitive data entry, standardize quality, speed up listing launch, and improve seller confidence.

---

## 2. Core Product Principles

1. **Enter once, publish everywhere**
2. **Structured first, AI second**
3. **Advisor review before publish**
4. **Channel-specific formatting**
5. **Auditability and version history**
6. **Seller-friendly and advisor-friendly**
7. **Media-rich outputs**
8. **Future-safe integration architecture**

---

## 3. High-Level Workflow

```text
Seller / Advisor enters property + seller + media + marketing preferences
    ->
Listing data validated
    ->
Marketing profile assembled
    ->
AI content generation pipeline runs
    ->
Channel adapters transform content into export-ready formats
    ->
Advisor reviews / edits / approves
    ->
Exports generated
    ->
Optional direct publishing integrations
    ->
Engagement tracking + revision cycle
```

---

## 4. In-Scope Channels

### 4.1 MLS
Generate MLS-ready structured listing content:
- Public remarks
- Private remarks
- Directions
- Property facts
- Room details
- Feature lists
- Showing instructions
- Exclusions / inclusions
- Open house notes
- Agent remarks

### 4.2 Google
Generate assets suitable for:
- Google Business Profile posts
- Google-indexable property landing pages
- Search metadata
- Local SEO snippets
- FAQ content
- Structured metadata for landing pages

### 4.3 Social Media
Generate channel-specific content for:
- Facebook
- Instagram
- Instagram Reels caption
- TikTok caption
- LinkedIn post
- X / short-form post
- YouTube Shorts description
- “Just Listed”
- “Open House”
- “Price Improvement”
- “Under Contract”
- “Back on Market”
- “Coming Soon”

### 4.4 Email
Generate:
- Buyer email blast
- Sphere / database announcement
- Neighbor announcement
- Open house invite
- Broker open invite
- Follow-up email after showings
- Price improvement email

### 4.5 SMS
Generate:
- New listing teaser
- Open house reminder
- Price improvement alert
- Follow-up for interested leads
- Neighbor marketing text
- Seller status update snippets

### 4.6 Printable / PDF Outputs
Generate:
- Single-page flyer
- Feature sheet
- Open house sign-in summary header content
- Seller marketing summary
- Listing launch packet

### 4.7 Landing Page / Web
Generate:
- Property headline
- Meta title
- Meta description
- Hero section copy
- Feature sections
- Neighborhood copy
- FAQ
- CTA blocks
- Inquiry prompts

---

## 5. User Roles

### 5.1 Seller
Can:
- Enter basic property info
- Upload photos/media
- Approve facts
- Provide highlight notes
- Choose marketing preferences
- Review generated marketing drafts (optional, controlled by permissions)

### 5.2 Advisor / Agent
Can:
- Edit all listing details
- Trigger generation
- Review and revise content
- Approve exports
- Download bundles
- Publish or hand off
- See history / versions
- Manage campaign status

### 5.3 Admin
Can:
- Configure templates
- Configure export mappings
- Configure channel defaults
- Manage AI prompt templates
- Manage integration credentials
- Audit all changes

---

## 6. Required Data Model

## 6.1 Listing Entity

```ts
type Listing = {
  id: string
  sellerId: string
  advisorId: string
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived'
  address: Address
  propertyType: 'single_family' | 'condo' | 'townhome' | 'multi_family' | 'land' | 'mobile_home' | 'other'
  listingType: 'sale' | 'lease'
  askingPrice?: number
  bedrooms?: number
  bathrooms?: number
  squareFeet?: number
  lotSize?: string
  yearBuilt?: number
  hoa?: HoaInfo
  schools?: SchoolInfo[]
  parking?: string
  stories?: number
  interiorFeatures?: string[]
  exteriorFeatures?: string[]
  appliances?: string[]
  utilities?: string[]
  heatingCooling?: string[]
  constructionDetails?: string[]
  roof?: string
  flooring?: string[]
  accessibilityFeatures?: string[]
  financialDetails?: FinancialDetails
  occupancyStatus?: string
  showingInstructions?: string
  directions?: string
  inclusions?: string[]
  exclusions?: string[]
  sellerHighlights?: string[]
  neighborhoodHighlights?: string[]
  upgrades?: UpgradeItem[]
  roomDetails?: RoomDetail[]
  mediaIds: string[]
  openHouses?: OpenHouse[]
  complianceFlags?: ComplianceFlags
  channelPreferences?: ChannelPreferences
  marketingSettings?: MarketingSettings
  createdAt: string
  updatedAt: string
}
```

## 6.2 Address

```ts
type Address = {
  street1: string
  street2?: string
  city: string
  state: string
  postalCode: string
  county?: string
  latitude?: number
  longitude?: number
}
```

## 6.3 Upgrade Item

```ts
type UpgradeItem = {
  category: 'kitchen' | 'bath' | 'roof' | 'hvac' | 'flooring' | 'windows' | 'landscaping' | 'paint' | 'plumbing' | 'electrical' | 'other'
  description: string
  year?: number
  estimatedValue?: number
}
```

## 6.4 Room Detail

```ts
type RoomDetail = {
  name: string
  level?: string
  dimensions?: string
  features?: string[]
}
```

## 6.5 Media Asset

```ts
type MediaAsset = {
  id: string
  listingId: string
  type: 'photo' | 'video' | 'floorplan' | 'drone' | 'virtual_tour' | 'document'
  url: string
  title?: string
  caption?: string
  tags?: string[]
  orderIndex: number
  isPrimary?: boolean
  aiVisionSummary?: string
  createdAt: string
}
```

## 6.6 Marketing Settings

```ts
type MarketingSettings = {
  tone: 'luxury' | 'family' | 'modern' | 'investment' | 'warm' | 'neutral'
  targetAudience: Array<'first_time_buyers' | 'move_up_buyers' | 'downsizers' | 'investors' | 'luxury_buyers' | 'relocation_buyers'>
  emphasize: string[]
  avoidTerms?: string[]
  socialPlatforms: string[]
  exportChannels: string[]
  includeNeighborhoodCopy: boolean
  includeSchoolCopy: boolean
  includeOpenHousePromotion: boolean
  includeShortFormVideoScripts: boolean
}
```

## 6.7 Export Artifact

```ts
type ExportArtifact = {
  id: string
  listingId: string
  channel: string
  variant: string
  format: 'json' | 'txt' | 'html' | 'pdf' | 'csv' | 'md'
  filename: string
  content: string
  metadata?: Record<string, unknown>
  generatedAt: string
  generatedBy: string
  approvedAt?: string
  version: number
}
```

## 6.8 Version Snapshot

```ts
type ListingSnapshot = {
  id: string
  listingId: string
  sourceVersion: number
  listingData: Record<string, unknown>
  generatedContent: Record<string, unknown>
  createdAt: string
  createdBy: string
}
```

---

## 7. Input Collection UX

## 7.1 Seller / Advisor Form Sections

1. Property basics
2. Pricing + timing
3. Interior features
4. Exterior + lot features
5. Upgrades / recent improvements
6. Neighborhood / lifestyle highlights
7. School / commute notes
8. Showing instructions
9. Open house information
10. Media uploads
11. Marketing preferences
12. Compliance + fair housing safeguards
13. Review + submit

## 7.2 UX Requirements

- Save draft automatically
- Progress indicator
- “Required for MLS” markers
- “Recommended for better marketing” markers
- Advisor notes per section
- AI assist buttons such as:
  - “Improve this description”
  - “Suggest features from uploaded photos”
  - “Generate neighborhood highlights”
- Media drag/drop with reordering
- Validation warnings before generation

---

## 8. Content Generation Pipeline

## 8.1 Pipeline Stages

### Stage 1 — Normalize Input
Transform raw listing form inputs into normalized structured listing data.

### Stage 2 — Validate Required Fields
Ensure MLS/core export requirements are met:
- Address
- Property type
- beds / baths if applicable
- price
- primary photo
- property summary facts

### Stage 3 — Create Marketing Context Object
Merge:
- structured facts
- upgrade history
- media summaries
- neighborhood notes
- target audience
- tone preferences
- channel list

### Stage 4 — Generate Core Copy Blocks
Generate reusable master blocks:
- headline
- short summary
- long summary
- key feature bullets
- upgrade summary
- neighborhood summary
- CTA options
- open house copy
- disclaimers / safe language checks

### Stage 5 — Channel Adaptation
Transform core copy into specific outputs for each channel.

### Stage 6 — Compliance / Policy Pass
Check for:
- prohibited claims
- fair housing risks
- unverifiable statements
- overlong outputs for certain channels
- missing disclaimers
- MLS field length issues

### Stage 7 — Review State
Mark outputs as:
- generated
- needs review
- approved
- rejected / regenerate

---

## 9. AI Prompt Architecture

AI should not generate directly from freeform chaos. It should receive a structured prompt payload.

## 9.1 Prompt Input Object

```ts
type MarketingPromptPayload = {
  propertyFacts: {
    addressLine: string
    cityStateZip: string
    propertyType: string
    price?: number
    bedrooms?: number
    bathrooms?: number
    squareFeet?: number
    lotSize?: string
    yearBuilt?: number
  }
  sellerHighlights: string[]
  upgrades: string[]
  roomHighlights: string[]
  neighborhoodHighlights: string[]
  mediaVisionNotes: string[]
  tone: string
  targetAudience: string[]
  emphasize: string[]
  avoidTerms: string[]
  outputType: string
  channel: string
  channelConstraints: {
    maxLength?: number
    bulletCount?: number
    format?: string
  }
}
```

## 9.2 Core Rules for Prompts

- Never invent facts not in input
- Prefer concrete features over vague adjectives
- Avoid fair housing violations
- Avoid discriminatory language
- Avoid absolute claims unless verified
- Keep output channel-appropriate
- Use structured output format where possible
- Return JSON where adapters need machine readability

## 9.3 Example Prompt Modes

- `core_summary`
- `mls_public_remarks`
- `social_caption`
- `google_post`
- `landing_page_copy`
- `sms_teaser`
- `email_blast`
- `open_house_copy`
- `price_improvement_copy`

---

## 10. Channel Export Specifications

# 10.1 MLS Export Spec

## Fields to generate
- Public remarks
- Private remarks
- Directions
- Showing instructions
- Exclusions
- Inclusions
- Room notes
- Open house remarks

## Constraints
- Field-level length limits configurable by MLS region
- Plain text output
- No emojis
- No unsupported formatting
- No unverifiable superlatives unless advisor approves

## Output format
```json
{
  "publicRemarks": "...",
  "privateRemarks": "...",
  "directions": "...",
  "showingInstructions": "...",
  "inclusions": ["..."],
  "exclusions": ["..."],
  "roomDetails": [{ "name": "Kitchen", "notes": "..." }]
}
```

## UI action
- Download MLS JSON
- Copy all fields
- Copy field-by-field
- Future: direct MLS bridge via partner API where available

---

# 10.2 Google Export Spec

## Purpose
Support Google visibility through:
- Google Business Profile posts
- SEO landing page metadata
- FAQ content
- locally relevant snippets

## Output set
- Post headline
- Post body
- CTA text
- SEO title
- SEO meta description
- FAQ entries
- schema-ready property summary

## Output format
```json
{
  "googleBusinessPost": {
    "headline": "...",
    "body": "...",
    "cta": "Learn more"
  },
  "seo": {
    "title": "...",
    "metaDescription": "..."
  },
  "faq": [
    { "q": "What makes this home stand out?", "a": "..." }
  ],
  "schemaSummary": {
    "headline": "...",
    "description": "..."
  }
}
```

---

# 10.3 Social Media Export Spec

## Required variants
- Facebook long
- Facebook short
- Instagram caption
- Instagram short
- Reel caption
- TikTok caption
- LinkedIn professional version
- X short version
- Open house version
- Price drop version
- Coming soon version
- Just listed version

## Constraints
- Character limits per platform configurable
- Optional emoji profile by brand setting
- Hashtag generation toggle
- CTA variants
- Include shortened property URL placeholder

## Output format
```json
{
  "facebookLong": "...",
  "facebookShort": "...",
  "instagramCaption": "...",
  "instagramReelCaption": "...",
  "tiktokCaption": "...",
  "linkedinPost": "...",
  "xPost": "...",
  "hashtags": ["#JustListed", "#BakersfieldHomes"]
}
```

---

# 10.4 Email Export Spec

## Required variants
- Buyer blast
- Sphere blast
- Neighbor email
- Broker open invite
- Open house reminder
- Price improvement email

## Output format
```json
{
  "buyerBlast": {
    "subject": "...",
    "preheader": "...",
    "bodyHtml": "...",
    "bodyText": "..."
  },
  "neighborAnnouncement": {
    "subject": "...",
    "bodyHtml": "...",
    "bodyText": "..."
  }
}
```

---

# 10.5 SMS Export Spec

## Required variants
- New listing alert
- Open house reminder
- Price improvement
- Lead follow-up
- Seller update

## Constraints
- Keep concise
- Include opt-out footer only where campaign type requires it
- Branded but not bloated
- Use approved short links

## Output format
```json
{
  "newListingTeaser": "...",
  "openHouseReminder": "...",
  "priceImprovementAlert": "...",
  "leadFollowUp": "..."
}
```

---

# 10.6 Landing Page Export Spec

## Sections
- Hero headline
- Subheadline
- Property overview
- Feature bullets
- Upgrade section
- Neighborhood section
- Gallery captions
- FAQ
- CTA blocks
- inquiry form intro

## Output format
```json
{
  "hero": {
    "headline": "...",
    "subheadline": "..."
  },
  "overview": "...",
  "features": ["...", "..."],
  "upgrades": ["...", "..."],
  "neighborhood": "...",
  "faq": [
    { "q": "...", "a": "..." }
  ],
  "ctaBlocks": [
    { "title": "...", "body": "...", "buttonText": "Schedule a tour" }
  ]
}
```

---

# 10.7 PDF / Flyer Export Spec

## Generated documents
- One-page flyer
- Feature sheet
- Open house flyer
- Seller marketing summary

## Inputs
- primary photo
- key facts
- top bullets
- QR code URL
- advisor branding
- contact information

## Output
Structured content payload for rendering engine:
```json
{
  "title": "...",
  "subtitle": "...",
  "facts": ["3 Bed", "2 Bath", "1,850 SF"],
  "featureBullets": ["...", "..."],
  "contact": {
    "name": "...",
    "phone": "...",
    "email": "..."
  },
  "qrUrl": "..."
}
```

---

## 11. Export Bundle Strategy

## 11.1 Bundle Types

### Listing Launch Bundle
Includes:
- MLS JSON
- Social JSON
- Email JSON
- SMS JSON
- Landing page JSON
- Google JSON
- Readme.md

### Advisor Review Bundle
Includes:
- human-readable markdown summary
- generated copy grouped by channel
- validation warnings
- missing field checklist

### Marketing Archive Bundle
Includes:
- approved content snapshots
- version metadata
- publish timestamps
- source listing snapshot

## 11.2 Download Naming Convention

```text
listing-{listingId}-launch-bundle-v{version}.zip
listing-{listingId}-advisor-review-v{version}.zip
listing-{listingId}-archive-v{version}.zip
```

---

## 12. Backend Architecture

## 12.1 Recommended Services

### Listing Service
Handles property and seller listing data.

### Media Service
Handles uploads, ordering, AI vision summaries, and primary asset selection.

### Marketing Generation Service
Builds prompt payloads, calls LLM services, validates content, stores outputs.

### Export Service
Transforms approved content into channel-specific downloadable files.

### Compliance Service
Runs rule-based safety and formatting checks.

### Audit / Version Service
Stores snapshots, revisions, approvals, and export history.

---

## 12.2 Suggested API Surface

### Listings
- `POST /api/listings`
- `GET /api/listings/:id`
- `PUT /api/listings/:id`
- `POST /api/listings/:id/submit-for-generation`

### Media
- `POST /api/listings/:id/media`
- `PUT /api/listings/:id/media/reorder`
- `POST /api/listings/:id/media/vision-analyze`

### Marketing
- `POST /api/listings/:id/marketing/generate`
- `GET /api/listings/:id/marketing`
- `PUT /api/listings/:id/marketing/:artifactId`
- `POST /api/listings/:id/marketing/:artifactId/approve`
- `POST /api/listings/:id/marketing/regenerate`

### Exports
- `POST /api/listings/:id/exports/build`
- `GET /api/listings/:id/exports`
- `GET /api/exports/:exportId/download`

### Review / Audit
- `GET /api/listings/:id/history`
- `POST /api/listings/:id/version-snapshot`

---

## 13. Example Generation Request

```json
{
  "channels": ["mls", "google", "social", "email", "sms", "landing_page", "pdf"],
  "tone": "warm",
  "targetAudience": ["move_up_buyers", "first_time_buyers"],
  "includeNeighborhoodCopy": true,
  "includeOpenHousePromotion": true
}
```

---

## 14. Example Backend Response

```json
{
  "listingId": "lst_123",
  "generationRunId": "gen_456",
  "status": "completed",
  "artifacts": [
    { "channel": "mls", "artifactId": "art_1", "status": "needs_review" },
    { "channel": "social", "artifactId": "art_2", "status": "needs_review" },
    { "channel": "email", "artifactId": "art_3", "status": "needs_review" }
  ],
  "warnings": [
    "Missing school information",
    "Directions field may require manual review"
  ]
}
```

---

## 15. Advisor Review UX Spec

## 15.1 Review Screen Layout

### Left Panel
- Listing facts summary
- media preview
- validation warnings
- missing info

### Center Panel
- generated content tabs:
  - MLS
  - Google
  - Social
  - Email
  - SMS
  - Landing page
  - PDF

### Right Panel
- quick actions:
  - approve
  - reject
  - regenerate
  - edit manually
  - copy
  - download channel file
  - compare previous version

## 15.2 Required Actions
- Approve per artifact
- Approve all
- Request regeneration with reason
- Edit and save custom version
- Lock approved version

---

## 16. Compliance and Safety Layer

## 16.1 Must Block / Warn On
- Fair housing language risk
- Health/disability/family-status targeting language
- Unverified school quality claims
- Unverified commute times
- Overstated ROI / investment claims
- Missing disclaimer fields
- Excluded facts accidentally included in public remarks

## 16.2 Examples of Flagged Language
- “Perfect for young families”
- “Ideal for Christians”
- “Safe neighborhood” unless approved by policy and phrasing rules
- “Best schools in town” without source support
- “Guaranteed appreciation”

## 16.3 Compliance Strategy
Use:
- rule engine first
- AI moderation / classification second
- advisor override logging third

---

## 17. Media Intelligence Features

## 17.1 AI Vision Support
Analyze uploaded images to suggest:
- bright updated kitchen
- vaulted ceilings
- large backyard
- covered patio
- dual vanity
- stainless appliances

## 17.2 Rules
- Suggestions only
- never auto-commit visual facts without advisor confirmation
- show confidence score
- allow accept/reject per suggestion

---

## 18. Database / Storage Guidance

## 18.1 Recommended Collections
- `listings`
- `listing_media`
- `marketing_generation_runs`
- `marketing_artifacts`
- `listing_snapshots`
- `export_jobs`
- `export_artifacts`
- `audit_logs`

## 18.2 File Storage
Use object storage for:
- media files
- generated PDFs
- zip bundles
- archived exports

---

## 19. Suggested Frontend Component Map

```text
ListingWizard
PropertyBasicsStep
FeaturesStep
UpgradesStep
NeighborhoodStep
MediaUploadStep
MarketingPreferencesStep
ReviewSubmitStep

MarketingDashboard
GenerationStatusCard
ArtifactTabs
ArtifactEditor
ArtifactApprovalBar
ValidationWarningPanel
VersionCompareModal
ExportBundlePanel
```

---

## 20. Suggested Backend Folder Structure

```text
/src
  /modules
    /listings
      listings.controller.ts
      listings.service.ts
      listings.repository.ts
      listings.types.ts
    /media
      media.controller.ts
      media.service.ts
      vision.service.ts
    /marketing
      marketing.controller.ts
      marketing.service.ts
      prompt-builder.service.ts
      channel-adapters/
        mls.adapter.ts
        google.adapter.ts
        social.adapter.ts
        email.adapter.ts
        sms.adapter.ts
        landing-page.adapter.ts
        pdf.adapter.ts
      validators/
        compliance.validator.ts
        formatting.validator.ts
    /exports
      exports.controller.ts
      exports.service.ts
      bundle-builder.service.ts
    /audit
      audit.service.ts
```

---

## 21. Channel Adapter Pattern

Each channel should use a dedicated adapter.

## 21.1 Interface

```ts
interface MarketingChannelAdapter {
  channel: string
  generate(input: MarketingPromptPayload): Promise<Record<string, unknown>>
  validate(output: Record<string, unknown>): ValidationResult[]
  serialize(output: Record<string, unknown>): string
}
```

## 21.2 Why This Matters
This keeps the system modular so Codex can implement channels independently without rewriting the whole generation engine.

---

## 22. Export File Examples

## 22.1 Social Export File
`social-export.json`

```json
{
  "listingId": "lst_123",
  "version": 2,
  "generatedAt": "2026-03-29T18:00:00Z",
  "posts": {
    "facebookLong": "...",
    "instagramCaption": "...",
    "tiktokCaption": "...",
    "xPost": "..."
  },
  "hashtags": ["#JustListed", "#DreamHome"]
}
```

## 22.2 MLS Export File
`mls-export.json`

```json
{
  "listingId": "lst_123",
  "version": 2,
  "publicRemarks": "...",
  "privateRemarks": "...",
  "directions": "...",
  "showingInstructions": "..."
}
```

## 22.3 Advisor Readme
`README.md`

```md
# Listing Launch Bundle

Included files:
- mls-export.json
- google-export.json
- social-export.json
- email-export.json
- sms-export.json
- landing-page-export.json

Status:
- MLS: Approved
- Social: Approved
- Email: Needs review
```

---

## 23. Future Direct Publishing Integrations

Phase 1 should focus on exports and review.

Phase 2 can add publishing integrations:
- Meta / Facebook APIs
- Instagram scheduling integrations
- Google Business Profile API
- email platform integrations
- CRM integrations
- SMS campaign platform connections
- syndication / MLS bridge partners where permitted

Architecture should assume this future:
```text
Generation -> Approval -> Export OR Publish
```

---

## 24. Metrics and Analytics

Track:
- time from draft to launch
- exports generated per listing
- most-used channels
- regenerate frequency
- advisor edit frequency
- publish conversion rate
- seller satisfaction feedback
- listing engagement by channel (future)

---

## 25. Permissions Model

### Seller
- can view select outputs if enabled
- cannot publish without advisor permission

### Advisor
- full create/edit/review/export approval rights

### Admin
- full system configuration and audit access

### Optional Team Roles
- marketing coordinator
- transaction coordinator
- content reviewer

---

## 26. Recommended Implementation Phases

# Phase 1 — Foundation
- listing schema
- media uploads
- marketing settings
- AI generation service
- MLS export
- social export
- email export
- download bundle

# Phase 2 — Review + Safety
- compliance engine
- review dashboard
- versioning
- approval workflow
- compare versions

# Phase 3 — Web + Google + PDF
- landing page export
- Google content export
- flyer / PDF rendering
- open house materials

# Phase 4 — Automation + Publishing
- scheduled regeneration
- direct publishing hooks
- CRM / SMS integration
- analytics dashboards

---

## 27. Codex Execution Tasks

## Task Group A — Data + APIs
1. Create listing schema/types
2. Create listing CRUD APIs
3. Create media upload APIs
4. Create marketing settings schema
5. Create export artifact schema

## Task Group B — Generation Engine
6. Build prompt builder
7. Build core copy generator
8. Build channel adapter framework
9. Implement MLS adapter
10. Implement social adapter
11. Implement email adapter
12. Implement SMS adapter
13. Implement Google adapter
14. Implement landing page adapter

## Task Group C — Review Workflow
15. Build artifact review UI
16. Build approve/reject actions
17. Build regenerate flow
18. Build version snapshots

## Task Group D — Export System
19. Build export job service
20. Build JSON/TXT/MD serializers
21. Build zip bundle output
22. Build download endpoints

## Task Group E — Compliance
23. Build rules-based content checker
24. Add warnings to review UI
25. Log overrides and approvals

---

## 28. Acceptance Criteria

The feature is complete when:

1. A seller or advisor can enter a listing once.
2. The system can generate channel-ready outputs for MLS, Google, social, email, SMS, and landing page.
3. Each output is editable before approval.
4. Approved outputs can be downloaded individually or as a zip bundle.
5. Content passes basic compliance checks.
6. All generated content is versioned and auditable.
7. The system is modular enough to add direct publishing later.

---

## 29. Practical Product Notes

- MLS fields vary by region, so field limits must be configurable.
- Google output is most valuable when paired with generated property landing pages.
- Social exports should be tone-aware and optionally emoji-light.
- PDF generation should likely be template-based, not AI layout generation.
- Keep structured data canonical and generated content derived.
- Do not let freeform AI become the source of truth.

---

## 30. Recommended Next Spec Files

After this implementation spec, the next high-value files would be:

1. **Seller Marketing Dashboard UX Spec**
2. **Property Landing Page Generator Spec**
3. **Provider Marketplace Tie-In Spec**
4. **Direct Publishing Integration Spec**
5. **Fair Housing / Compliance Rulebook Spec**

---

## 31. Final Build Recommendation

For initial implementation, prioritize this exact order:

1. Listing data model
2. Media management
3. Core marketing context builder
4. MLS export
5. Social export
6. Email + SMS export
7. Review dashboard
8. Bundle download
9. Google + landing page
10. PDF/flyer outputs

This gives Workside Home Advisor a powerful v1 that immediately helps advisors market listings faster while creating a strong architecture for future direct publishing and provider marketplace expansion.
