# Workside Home Advisor — Codex UI Redesign Spec
## Vision + Photos Workflow Simplification

## Objective

Redesign the Photos and Vision experience so sellers and agents always understand:

1. which photo they are editing
2. what result is currently selected
3. whether a generated image is only a draft or a saved asset
4. where to find a saved AI-generated image later

The current system is powerful but confusing because generated outputs remain trapped inside the Vision workflow state and do not clearly become user-owned photo assets.

This redesign fixes that.

---

# Product Principle

The user should never have to ask:

> “Where did my generated image go?”

The UI must make the distinction between these three states obvious:

1. **Original Photo**
2. **Working Vision Result**
3. **Saved Listing Photo**

---

# Core UX Model

## A. Photos tab = library / owned assets
This tab should contain:
- original photos
- saved AI-generated photos
- seller-selected listing picks

## B. Vision tab = editing workspace
This tab should contain:
- one source photo at a time
- one current best generated result
- optional previous attempts/history
- explicit save action

## C. Promotion step is required
A generated image should not silently be treated as saved.

The user must explicitly click:

**Save as Listing Photo**

That action promotes the current Vision result into the Photos library.

---

# Required UI Changes

## 1. Add an explicit primary action in Vision

### New primary CTA
Add a prominent button directly below the current best result:

```text
Save as Listing Photo
```

### Secondary buttons
Keep secondary actions smaller:
- Try another version
- Continue to finish updates
- View previous attempts

### Rule
The primary call to action should always answer:
> “What should I do if I want to keep this?”

---

## 2. Rename confusing workflow labels

### Replace
- Saved drafts
- Show workflow history (88 saved drafts)

### With
- Previous attempts
- View processing history

### Reason
“Saved drafts” sounds like something user-owned and durable.
These are actually intermediate workflow outputs, not final saved photos.

---

## 3. Make current context obvious at top of Vision tab

Add a compact context header above the result:

```text
Editing: Living room
Source: Original photo
Current stage: Clean room
Current result: Stronger Declutter Preview B
```

Use pill tags if desired:
- Original photo
- Clean room
- Current result

### Reason
The user should always know:
- which room is being edited
- which source image is being used
- which stage they are in

---

## 4. Show only one current result prominently

The current Vision tab should focus on a single best result card.

### Structure
- before / after slider
- result title
- short explanation
- primary action button
- secondary actions

### Example layout
```text
Before / After Slider

Stronger Declutter Preview B
This result opens the room and reduces clutter while preserving the structure.

[ Save as Listing Photo ]
[ Try another version ]   [ Continue to finish updates ]
```

### Rule
Previous attempts must not compete visually with the current best result.

---

## 5. Collapse history by default

History should remain hidden until the user asks for it.

### Default label
```text
View previous attempts
```

### Optional helper text
```text
Older generated versions are kept here for reference.
```

### Rule
History should be treated as secondary support information, not the main workspace.

---

# Photos Tab Redesign

## Goal
The Photos tab must become the single source of truth for saved images.

---

## 6. Group photos by room

Instead of a flat mixed grid, group assets under room headings.

### Example
```text
Living room
- Original photo
- AI Cleaned
- AI Styled

Kitchen
- Original photo
- AI Cleaned

Primary bedroom
- Original photo
- AI Cleaned
```

### Benefit
The user can instantly understand:
- what belongs to which room
- which images are original
- which images were AI-generated

---

## 7. Add asset type labels to every photo card

Each photo card should display one of:

- Original
- AI Cleaned
- AI Finish Update
- AI Styled
- Seller Pick

### Example card metadata
```text
Living room
AI Cleaned
Saved from Vision
Ready for listing review
```

### Rule
No saved AI photo should look identical to an original in the library.

---

## 8. Add a “Saved from Vision” badge for promoted images

When a Vision result is saved into Photos, mark it clearly:

```text
Saved from Vision
```

Optional alternate:
```text
Generated from Original
```

### Reason
This preserves trust and makes lineage obvious.

---

## 9. Add quick actions on photo cards

For saved AI-generated images in Photos:

- Set as Primary
- Open in Vision
- Add listing note
- Remove from listing picks
- Delete saved version

For original photos:
- Open in Vision
- Add listing note
- Delete original photo (if allowed)

---

# Vision → Photos Promotion Flow

## 10. New explicit promotion behavior

When the user clicks **Save as Listing Photo**, do the following:

### Backend behavior
Create a new saved photo asset record.

### Minimum fields
```ts
{
  propertyId: ObjectId,
  roomLabel: string,
  sourceMediaId: ObjectId,
  sourceVariantId?: ObjectId,
  assetType: "generated",
  generationStage: "clean_room" | "finishes" | "style",
  generationLabel: string,
  imageUrl: string,
  isListingCandidate: boolean,
  createdAt: Date
}
```

### Frontend behavior
- show success toast
- update Photos tab immediately
- optionally mark the saved photo as selected candidate

### Toast copy
```text
Saved to Photos
```

Optional longer copy:
```text
This AI-generated version has been added to your photo library.
```

---

## 11. Add “Open in Photos” after save

After the save succeeds, show:

```text
Saved to Photos
[ View in Photos ]
```

This closes the loop and removes uncertainty.

---

# Recommended Vision Workflow Layout

## Top navigation stays:
- Overview
- Pricing
- Photos
- Vision
- Brochure
- Report
- Checklist

## Vision page layout

### Section 1 — Context Header
- Editing: Living room
- Source: Original photo
- Stage: Clean room

### Section 2 — Workflow Stage Selector
Rename stages using simpler language:
- 1. Clean room
- 2. Update finishes
- 3. Apply style
- 4. Finalize

### Section 3 — Current Action
Example:
- Remove Furniture
- Cleanup Empty Room
- Light Declutter
- Medium Declutter

### Section 4 — Main Result Card
- before/after
- result explanation
- quality summary
- Save as Listing Photo
- Try another version
- Continue to finish updates

### Section 5 — Previous Attempts
Collapsed drawer with thumbnails and timestamps

---

# Required Copy Changes

## Replace technical/system language with user language

### Before
- Saved drafts
- workflow history
- use selected result for finish updates

### After
- Previous attempts
- Saved image versions
- Use this result for finish updates

### Rule
Avoid internal pipeline terminology unless absolutely necessary.

---

# Recommended Button Hierarchy

## Primary buttons
Use for:
- Save as Listing Photo
- Use this result for finish updates

## Secondary buttons
Use for:
- Try another version
- View previous attempts
- Return to Photos

## Destructive buttons
Use only for:
- Delete saved version
- Remove from listing picks

---

# Data Model Recommendation

## Add a durable “saved generated asset” concept

The core issue is that generated variants and saved photos are currently blended conceptually.

Introduce a durable saved-asset model or extend the existing media asset model with:

```ts
{
  assetType: "original" | "generated",
  generationStage?: "clean_room" | "finishes" | "style",
  sourceMediaId?: ObjectId,
  sourceVariantId?: ObjectId,
  savedFromVision?: boolean,
  generationLabel?: string
}
```

### Rule
A saved generated asset must behave like a first-class photo in the Photos tab.

---

# API Changes

## New endpoint
```text
POST /api/media/:variantId/save-to-photos
```

### Request
```json
{
  "propertyId": "123",
  "roomLabel": "Living room",
  "generationStage": "clean_room"
}
```

### Response
```json
{
  "savedAssetId": "abc",
  "assetType": "generated",
  "message": "Saved to Photos"
}
```

---

# UI States to Support

## Vision tab
- generating
- current result ready
- saved to photos
- no result yet
- viewing previous attempts

## Photos tab
- original photo
- generated saved photo
- seller-selected candidate
- primary listing photo

---

# Migration / Transition Guidance

If older data already exists as variants only:

1. keep the current variant history intact
2. do not auto-promote historical variants
3. require explicit save action going forward
4. optionally add admin migration later for historically selected variants

---

# Acceptance Criteria

The redesign is successful when:

1. A user can generate a Vision result and save it without confusion
2. The saved AI-generated image appears in Photos immediately
3. The Photos tab clearly distinguishes original vs generated images
4. The Vision tab clearly distinguishes current result vs previous attempts
5. No user needs to guess where their generated image went

---

# Implementation Priorities for Codex

## Priority 1
- add Save as Listing Photo CTA
- add save-to-photos endpoint
- create generated saved asset records

## Priority 2
- update Photos tab to show generated images with badges
- group by room
- add quick actions

## Priority 3
- rename workflow labels
- simplify stage text
- reduce technical language

## Priority 4
- polish previous-attempts drawer
- add View in Photos after save
- improve candidate grouping

---

# Final Directive to Codex

This redesign is not cosmetic.
It fixes a workflow ownership problem.

The system currently understands variants, drafts, and stages.
The user understands photos they own.

Redesign the UI so that:
- Vision is the editing workspace
- Photos is the saved library
- Save as Listing Photo is the bridge between them

That bridge must become obvious, durable, and immediate.
