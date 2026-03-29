# Workside Home Advisor — Seller Marketing Dashboard UX Spec
## Codex-Ready UX Specification

**Version:** 1.0  
**Purpose:** Define the full UX for the Seller Marketing Dashboard used by advisors (and optionally sellers) to review, approve, edit, and monitor listing marketing outputs.

---

# 1. Product Objective

Create a **central command center** where advisors can:

- Review generated marketing content across all channels
- Edit and refine outputs
- Approve or regenerate content
- Track listing performance (future phase)
- Download/export marketing bundles
- Monitor listing readiness before launch

This dashboard is the **control layer between AI generation and real-world publishing**.

---

# 2. Core UX Principles

1. **Clarity over complexity**
2. **Everything in one place**
3. **Fast approve / fast iterate**
4. **Channel separation with unified context**
5. **Visual + data-driven feedback**
6. **Minimal clicks to launch**
7. **Safe (compliance-first)**

---

# 3. Page Layout Overview

```text
------------------------------------------------------
| Top Nav: Listing Info + Status + Actions           |
------------------------------------------------------
| Left Panel | Center Panel        | Right Panel     |
|------------|---------------------|-----------------|
| Listing    | Channel Tabs        | Actions         |
| Summary    | Content Editor      | Approvals       |
| Media      |                     | Warnings        |
| Warnings   |                     | Export          |
------------------------------------------------------
| Bottom: Version History / Activity Timeline        |
------------------------------------------------------
```

---

# 4. Top Navigation Bar

## Elements

- Property address (bold)
- Listing status badge:
  - Draft
  - Generated
  - Needs Review
  - Approved
  - Published
- Key facts (beds / baths / sqft / price)
- Last updated timestamp
- Buttons:
  - Generate / Regenerate
  - Approve All
  - Export Bundle
  - Publish (future)
  - Back to Listings

---

# 5. Left Panel — Listing Overview

## Sections

### 5.1 Property Summary
- Address
- Price
- Beds / Baths
- Sq Ft
- Property type

### 5.2 Media Preview
- Primary image (large)
- Thumbnail strip
- Drag-to-reorder (optional quick access)

### 5.3 Validation Warnings
- Missing fields (MLS critical)
- Weak content areas
- Media quality issues

### 5.4 Listing Completeness Score
- % complete (0–100)
- Visual progress bar

---

# 6. Center Panel — Content Workspace

## 6.1 Channel Tabs

Tabs:
- MLS
- Google
- Social
- Email
- SMS
- Landing Page
- PDF / Flyer

---

## 6.2 Content Editor

Each tab contains:

### Header
- Channel name
- Status badge (Needs Review / Approved)
- Last generated timestamp

### Content Area
- Editable text areas or structured JSON view
- Toggle:
  - “Formatted view”
  - “Raw JSON view”

### Variant Selector
- Dropdown or pills:
  - Example (Social):
    - Facebook Long
    - Instagram
    - TikTok
    - X
    - Open House
    - Price Drop

---

## 6.3 Inline Actions

Per content block:

- Edit (inline)
- Copy
- Regenerate (single variant)
- Compare previous version
- Approve
- Reject

---

# 7. Right Panel — Actions + Intelligence

## 7.1 Approval Panel

- Approve current channel
- Reject and regenerate
- Approve all variants in channel
- Approve entire listing

---

## 7.2 Warnings Panel

Grouped alerts:

### Critical
- Missing MLS-required fields
- Compliance violations

### Moderate
- Weak descriptions
- Missing neighborhood info

### Suggestions
- Add more upgrades
- Improve headline strength

---

## 7.3 Export Panel

Buttons:

- Download channel file
- Download full bundle (ZIP)
- Copy all content

---

## 7.4 AI Assist Panel

Buttons:

- Improve tone
- Make more luxury-focused
- Make more concise
- Add urgency
- Rewrite for investors

---

# 8. Bottom Panel — Version History

## Timeline View

Each entry includes:

- Timestamp
- User (advisor / system)
- Action:
  - Generated
  - Edited
  - Approved
  - Regenerated
- Version number

---

## Compare Feature

- Select two versions
- Side-by-side diff view
- Highlight changes

---

# 9. User Flows

## 9.1 Standard Flow

```text
Enter listing ->
Generate ->
Review per channel ->
Edit ->
Approve ->
Export bundle
```

---

## 9.2 Fast Approve Flow

```text
Generate ->
Quick scan ->
Approve All ->
Export
```

---

## 9.3 Iteration Flow

```text
Generate ->
Identify weak content ->
Regenerate specific channel ->
Edit ->
Approve
```

---

# 10. Interaction States

## Content States

- Not Generated
- Generated
- Edited
- Needs Review
- Approved
- Locked

---

## UI Indicators

- Green = Approved
- Yellow = Needs Review
- Red = Issues
- Gray = Not Generated

---

# 11. Permissions UX

## Seller View (Optional)

- Read-only view
- Can comment
- Cannot approve/publish

## Advisor View

- Full edit + approve rights

## Admin View

- Full override + audit

---

# 12. Component Map (React)

```text
SellerMarketingDashboard
  TopNavBar
  LeftPanel
    PropertySummaryCard
    MediaPreview
    ValidationWarnings
    CompletenessScore
  CenterPanel
    ChannelTabs
    ContentEditor
      VariantSelector
      EditableContentBlock
  RightPanel
    ApprovalPanel
    WarningPanel
    ExportPanel
    AIAssistPanel
  BottomPanel
    VersionTimeline
    CompareModal
```

---

# 13. API Requirements

## Fetch Dashboard

GET /api/listings/:id/dashboard

## Approve Artifact

POST /api/listings/:id/marketing/:artifactId/approve

## Regenerate

POST /api/listings/:id/marketing/regenerate

## Export

POST /api/listings/:id/exports/build

---

# 14. UX Enhancements (Phase 2)

- Real-time collaboration
- Inline comments
- Seller approval workflow
- Performance analytics panel
- “What’s missing?” AI suggestions
- Channel preview (simulate Instagram, etc.)

---

# 15. Acceptance Criteria

- Advisor can review all channels in one screen
- Can edit and approve content per channel
- Can approve entire listing
- Can download export bundle
- Can see warnings and fix issues
- Can view version history
- UX is fast (<2 clicks per major action)

---

# 16. Final Notes

This dashboard is the **brain of the marketing system**.

If done right, it:
- replaces 5–7 separate tools
- dramatically speeds up listing launches
- ensures consistent, high-quality marketing
- becomes a major differentiator for Workside Home Advisor
