# Workside Home Advisor — Codex Instructions for Refactoring Current UI Files
## Photos + Vision Workflow Refactor

## Objective

Refactor the current UI so the Photos and Vision experience is clean, intuitive, and impossible to lose track of.

This is not a visual polish pass only.
This is a workflow ownership refactor.

The user must immediately understand:

1. what photo they are editing
2. what result is current
3. what is temporary
4. what is saved
5. what action to take next

---

# Core Product Rule

## Photos = ownership
Photos is the durable library of images the user owns and can use for listing output.

## Vision = workspace
Vision is the editing workspace where the user experiments, processes, reviews, and promotes results.

## Bridge between them
The explicit bridge is:

**Save as Listing Photo**

No generated result should silently behave like a saved photo unless the user explicitly promotes it.

---

# Refactor Goals

1. Make Photos the obvious home base
2. Make Vision focused on one current result
3. Hide history behind a drawer / modal
4. Remove repeated metadata blocks and redundant controls
5. Introduce a first-class “saved generated asset” experience

---

# Required Refactor Scope

## Areas to update
- Photos page
- Vision page
- photo cards / room groups
- Vision result card
- attempt history UI
- save-to-photos action flow
- state management for current source / current result / saved asset
- related API hooks used by these views

---

# Part 1 — Refactor the Photos Page

## Goal
Photos must clearly show:
- originals
- saved AI-generated images
- listing picks

## Required layout
Group by room/category rather than flat mixed grid.

### New structure
```text
Living Room
  - Original
  - AI Cleaned
  - AI Finish Update
  - Listing Pick

Kitchen
  - Original
  - AI Cleaned
```

## Codex instructions

### 1. Refactor room/photo grouping
Find the current Photos page component and replace flat card rendering with grouped rendering.

Create a room-group component if needed:

```text
PhotosPage
  -> RoomPhotoGroup
      -> PhotoAssetCard
```

### 2. Add asset-type badges on every card
Each card must render one of:
- Original
- AI Cleaned
- AI Finish Update
- AI Styled
- Listing Pick

### 3. Add quick actions to each photo card
For original assets:
- Open in Vision
- Add note
- Delete

For generated saved assets:
- Open in Vision
- Set as Listing Pick
- Delete saved version

### 4. Visually separate originals from generated assets
Generated assets should not look identical to originals.
Use:
- badge
- sublabel
- optional icon
- source note like “Saved from Vision”

### 5. Show selected / primary status clearly
If a photo is selected for listing, render a visible marker:
- Primary
- Listing Pick

---

# Part 2 — Refactor the Vision Page

## Goal
Vision must stop looking like a wall of system state and start feeling like a guided editing workspace.

## Rule
The user should always see:
- source photo
- current stage
- current best result
- next action

## Required layout

### Section 1 — Context Header
Always show at top:

```text
Editing: Living Room
Source: Original Photo
Stage: Clean Room
```

Optional pills:
- Original Photo
- Current Result
- Saved to Photos

### Section 2 — Stage Selector
Simplify stage labels to:

- Clean Room
- Update Finishes
- Apply Style
- Finalize

### Section 3 — Current Result Card
This is the main visual focus.

Must contain:
- before / after view or source/result pairing
- result title
- short explanation
- Save as Listing Photo button
- Try another version
- Continue to next stage

### Section 4 — Previous Attempts
Hide behind a drawer/modal

---

# Part 3 — Introduce a Single Current Result Pattern

## Problem
Too many variants and metadata blocks compete visually.

## Fix
The Vision page must render one primary result only.

## Codex instructions

### 1. Select one current result
Use whichever source of truth already exists:
- selected variant
- latest successful variant
- explicitly chosen current result

### 2. Render only that result in the main card
Do not render all attempts inline by default.

### 3. Move alternate attempts into history
Previous attempts must only appear in:
- drawer
- modal
- side panel

### 4. Add a clear title block
Example:
```text
Strong Declutter Preview
This version removes furniture and opens the room while preserving structure.
```

---

# Part 4 — Replace “Saved Drafts” Language Everywhere

## Problem
“Saved drafts” sounds durable and user-owned.
It is causing confusion.

## Codex instructions

Find and replace user-facing copy:

### Replace
- Saved drafts
- Show workflow history
- Use selected result for finish updates
- latest generated draft

### With
- Previous attempts
- View previous attempts
- Use this result for finish updates
- Current result

### Rule
Do not expose internal pipeline vocabulary unless absolutely necessary.

---

# Part 5 — Add Explicit Promotion Flow

## Goal
A result generated in Vision must become a durable asset only when the user clicks save.

## Codex instructions

### 1. Add primary button to Vision result card
```text
Save as Listing Photo
```

This button must be the dominant CTA after generation.

### 2. Wire button to new or existing backend save endpoint
When clicked:
- create generated asset in Photos library
- mark it as `assetType = generated`
- store lineage to source media / source variant

### 3. Show success feedback
On success:
- toast: `Saved to Photos`
- optional inline status: `Saved successfully`
- optional button: `View in Photos`

### 4. Update Photos state immediately
After save:
- either refetch Photos data
- or optimistic update the room group

### 5. Do not auto-save intermediate variants
The user must choose to save.

---

# Part 6 — Add “View in Photos” After Save

## Goal
Close the loop immediately.

## Codex instructions

After successful save, show one of:
- inline button
- toast action
- success banner

Text:
```text
Saved to Photos
View in Photos
```

Clicking it should:
- navigate back to Photos
- scroll/focus the saved asset if possible

---

# Part 7 — Refactor Attempt History Into a Drawer / Modal

## Problem
History currently feels like clutter, not support.

## Codex instructions

### 1. Replace inline history wall
Do not show full history by default.

### 2. Add trigger
```text
View previous attempts
```

### 3. Drawer/modal contents
For each attempt:
- thumbnail
- timestamp / relative time
- stage label
- small badge if kept
- actions:
  - Use this result
  - Save to Photos
  - Delete attempt

### 4. Highlight current selected result
If an attempt is the current result, label it:
- Current Result

### 5. Do not overload the drawer
Show key metadata only.
No large debug blocks.

---

# Part 8 — Clarify Stage-to-Stage Chaining

## Goal
The user must always know what image becomes the next stage baseline.

## Codex instructions

### 1. Show current baseline explicitly
On Finishes stage:
```text
Using: Clean Room result
```

On Style stage:
```text
Using: Finish Update result
```

### 2. Add stage source note above action controls
Small contextual label:
- Based on Original Photo
- Based on Saved Clean Room
- Based on Finish Update

### 3. If user changes source, show confirmation
Example:
```text
Switch finish updates to use this saved cleaned-room image?
```

### 4. Keep lineage visible but lightweight
Do not bury baseline source in metadata accordion only.

---

# Part 9 — State Management Refactor

## Goal
Separate temporary workspace state from durable photo state.

## Required state concepts

### Photos state
- room groups
- original assets
- generated saved assets
- listing picks

### Vision workspace state
- selected source media
- current stage
- current best result
- attempt history
- save status

## Codex instructions

### 1. Stop mixing temporary variants into durable asset collections
Do not let Vision attempts masquerade as Photos assets until save occurs.

### 2. Create explicit state fields
Suggested names:

```ts
currentVisionSource
currentVisionStage
currentVisionResult
visionAttemptHistory
savedGeneratedAssets
```

### 3. Make current result stable
Changing history should not accidentally wipe the main result.

### 4. Preserve latest successful result on refresh
If user refreshes Vision:
- restore current result
- restore current stage
- restore selected baseline

---

# Part 10 — API / Hook Refactor

## Goal
Support the new ownership model cleanly.

## Codex instructions

### 1. Add or normalize hook for save-to-photos
Example:
```ts
useSaveVisionResultToPhotos()
```

### 2. Add hook for room-grouped photos
Example:
```ts
useRoomGroupedPhotos(propertyId)
```

### 3. Add hook for Vision current result + attempts
Example:
```ts
useVisionWorkspaceState(propertyId, mediaId, stage)
```

### 4. Keep save response normalized
The UI should receive:
- savedAssetId
- roomLabel
- assetType
- imageUrl
- generationStage

---

# Part 11 — Recommended Component Structure

Use this as the target structure:

```text
PhotosPage
  ├── RoomPhotoGroup
  │     ├── PhotoAssetCard
  │     └── GeneratedAssetCard
  └── PhotoDetailsModal

VisionPage
  ├── VisionContextHeader
  ├── VisionStageStepper
  ├── VisionCurrentResultCard
  ├── VisionPrimaryActions
  ├── VisionHistoryDrawer
  └── VisionSaveSuccessBanner
```

## Component responsibilities

### VisionContextHeader
Shows:
- room
- source
- stage

### VisionCurrentResultCard
Shows:
- before/after
- result title
- explanation
- primary CTA

### VisionHistoryDrawer
Shows:
- attempts
- small actions
- current marker

### RoomPhotoGroup
Shows:
- room title
- asset grid
- grouped originals + generated

---

# Part 12 — Visual Hierarchy Rules

## Photos page
Primary hierarchy:
1. room
2. asset image
3. asset type
4. quick actions

## Vision page
Primary hierarchy:
1. current result
2. save action
3. next-stage action
4. previous attempts

## Rule
Do not give history, debug metadata, and current result equal visual weight.

---

# Part 13 — Copy Guidelines

Use plain human language.

## Preferred copy
- Save as Listing Photo
- View previous attempts
- Saved to Photos
- Use this result for finish updates
- Based on Original Photo
- Based on Clean Room result

## Avoid
- draft
- variant lifecycle
- saved draft
- workflow artifact
- source media lineage
- selected output variant

---

# Part 14 — Acceptance Criteria

The refactor is successful when:

1. A user generates a Vision result and instantly knows what to do next
2. A user can save that result and see it appear in Photos immediately
3. A user can tell original vs generated images at a glance
4. A user can view history without cluttering the main Vision page
5. A user never needs to ask where their saved image went

---

# Part 15 — Implementation Order for Codex

## Pass A
- Add Save as Listing Photo button
- Add save success flow
- Add View in Photos link
- Normalize durable generated asset handling

## Pass B
- Refactor Photos into room-grouped library
- Add badges and quick actions
- Separate original vs generated assets visually

## Pass C
- Refactor Vision to single current result layout
- Move attempts into drawer/modal
- simplify stage labels and metadata

## Pass D
- Stabilize state restoration
- improve current-result persistence
- polish transitions between Photos and Vision

---

# Final Directive to Codex

Refactor the current UI files around one principle:

**Generated results are temporary until explicitly saved.**

Make that visible in the architecture, the UI, the copy, and the navigation flow.

If the user improves a room, saves it, and returns later, they must immediately know:
- where it is
- what it is
- how to use it next
