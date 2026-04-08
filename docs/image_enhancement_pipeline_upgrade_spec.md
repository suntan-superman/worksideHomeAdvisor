# Workside Home Advisor – Image Enhancement Pipeline Upgrade Spec

## Objective

Upgrade the current image enhancement pipeline to improve reliability for furniture removal and other constrained real-estate photo edits.

This spec covers three required upgrades:

1. Auto mask splitting
2. Retry logic
3. Fallback modes

The goal is to reduce scene-replacement failures, improve edit precision, and create a predictable seller experience.

---

# 1. Auto Mask Splitting

## Problem

Large masks that cover multiple overlapping furniture items often cause the model to regenerate the room instead of surgically editing the intended objects.

## Goal

Automatically split one broad mask into multiple smaller masks so edits can run in smaller, safer passes.

## Strategy

### Input
- Original image
- User-drawn mask or system-generated mask

### Output
- Array of smaller mask regions, each tied to one likely object or object cluster

## Implementation Plan

### Step 1 – Connected Component Extraction
If a binary mask is provided:
- find connected regions
- compute bounding boxes
- discard tiny noise regions

### Step 2 – Region Expansion
Expand each bounding box slightly to preserve object edges and shadows:
- padding: 8–20 px depending on image size

### Step 3 – Merge/Separate Rules
- If two regions overlap heavily, keep them together
- If regions are clearly separate, split them into different tasks
- Limit each mask to one major object cluster where possible

### Step 4 – Sort by Priority
Process larger masks first:
- sofa
- bed
- dining table
- then smaller objects

## Suggested Data Model

```ts
{
  _id: ObjectId,
  enhancementJobId: ObjectId,
  maskIndex: number,
  bbox: { x: number, y: number, width: number, height: number },
  area: number,
  status: "pending" | "processing" | "completed" | "failed" | "skipped",
  createdAt: Date
}
```

## Codex Requirements
- Build mask splitting utility in backend service
- Save split masks as temporary assets
- Support both manual masks and future segmentation-generated masks
- Reject masks that cover too much of the room (for example > 45% of image area) unless explicitly approved

---

# 2. Retry Logic

## Problem

Some edits fail because the prompt, mask size, or generation settings are too aggressive.

## Goal

Retry intelligently instead of failing immediately.

## Retry Philosophy

Do not retry with the exact same settings.
Each retry must become more conservative.

## Retry Plan

### Attempt 1 – Standard
- use original mask
- standard strict prompt
- guidance_scale: 10–11
- strength: 0.35–0.45

### Attempt 2 – Conservative
- shrink mask slightly
- strengthen “do not alter structure” language
- lower strength to 0.25–0.35

### Attempt 3 – Segmented / Object-only
- split mask further
- run only on highest-confidence object region
- keep all other objects untouched

### Attempt 4 – Fallback mode trigger
- stop attempting full furniture removal
- move to declutter or light cleanup mode

## Retry Conditions

Retry only when failure reason is one of:
- scene replacement detected
- structural distortion detected
- new object hallucination detected
- excessive layout drift
- obvious artifacting

Do NOT retry if:
- image is too low quality
- mask is invalid
- request is impossible for current model

## Suggested Job Tracking

```ts
{
  _id: ObjectId,
  propertyPhotoId: ObjectId,
  mode: "remove_furniture" | "declutter" | "flooring_change" | "wall_color",
  attemptCount: number,
  maxAttempts: 4,
  currentStage: "initial" | "conservative_retry" | "split_retry" | "fallback",
  failureReason?: string,
  status: "queued" | "processing" | "completed" | "failed",
  outputUrls: string[],
  selectedOutputUrl?: string
}
```

## Codex Requirements
- Add attempt counter to enhancement jobs
- Persist each attempt and its settings
- Save intermediate outputs for audit/debugging
- Stop retries once a valid result passes quality checks

---

# 3. Fallback Modes

## Problem

Some rooms are too complex for full furniture removal.

## Goal

Provide graceful alternatives instead of hard failure.

## Required Fallback Modes

### A. Declutter Lite
Use when:
- furniture removal fails
- room is dense
- many overlapping pieces exist

Behavior:
- reduce small clutter
- simplify surfaces
- preserve major furniture

### B. Visual Cleanup
Use when:
- object removal is unstable
- room still benefits from improvement

Behavior:
- brighten
- straighten
- improve white balance
- reduce visible distractions
- preserve full layout

### C. Suggest Guided Selection
Use when:
- mask is too large
- multiple furniture groups overlap

Behavior:
- return original image
- prompt user to select individual objects instead

### D. Partial Success Mode
Use when:
- one object cluster can be removed safely
- full-room request cannot

Behavior:
- remove one or two cleanly isolated objects
- explain that additional edits are recommended in separate passes

## UX Messaging

### Instead of generic failure:
Use messages like:

#### Guided Selection
“This room is complex for full furniture removal. Try selecting individual items for better results.”

#### Declutter Lite
“Full furniture removal was not reliable for this photo. We applied a lighter declutter enhancement instead.”

#### Partial Success
“We safely improved part of the room. Additional objects may need separate edits.”

## Backend Fallback Decision Rules

If quality safeguard detects:
- scene replacement → fallback to Declutter Lite
- broad structural drift → fallback to Guided Selection
- isolated success only → fallback to Partial Success
- minor artifacts only → retry once conservatively before fallback

## Codex Requirements
- Implement fallback decision engine
- Return fallback mode used in API response
- Surface fallback explanation to UI
- Preserve original image and all alternate outputs

---

# 4. Quality Safeguards

## Goal

Ensure only safe, listing-quality edits are accepted.

## Detect and Reject
- new large objects introduced
- room layout visibly changed
- windows/doors moved
- lighting becomes unrealistic
- floor/wall geometry distorted
- unnatural textures or repeated artifacts

## Acceptance Criteria
A result can pass only if:
- structure remains intact
- requested edit is visible
- no major hallucinations appear
- image still looks like the original room

## Codex Requirements
- Build quality scoring function
- Add hard reject rules and soft warning rules
- Save reject reason for analytics

---

# 5. API Behavior

## Endpoint
`POST /api/photos/enhance`

## Request
```json
{
  "propertyPhotoId": "abc123",
  "mode": "remove_furniture",
  "maskUrl": "https://...",
  "instructions": "remove furniture"
}
```

## Response – Success
```json
{
  "status": "completed",
  "fallbackMode": null,
  "attemptCount": 2,
  "outputUrl": "https://...",
  "message": "Furniture removal completed successfully."
}
```

## Response – Fallback
```json
{
  "status": "completed",
  "fallbackMode": "declutter_lite",
  "attemptCount": 4,
  "outputUrl": "https://...",
  "message": "Full furniture removal was not reliable for this room. A lighter declutter enhancement was applied."
}
```

## Response – Guided Retry
```json
{
  "status": "needs_user_action",
  "fallbackMode": "guided_selection",
  "attemptCount": 2,
  "message": "Please select individual objects for better removal results."
}
```

---

# 6. UI / UX Requirements

## Add these states to enhancement UI
- Processing
- Retrying
- Fallback applied
- Needs user selection
- Completed

## Show
- before / after
- mode used
- retry count
- fallback explanation

## Add user-facing options
- Remove furniture
- Declutter only
- Improve lighting
- Select individual object
- Try again with safer settings

---

# 7. Processing Order Recommendation

For furniture-heavy rooms, use this order:

1. remove largest isolated furniture object
2. rerun quality check
3. remove next isolated object
4. stop if layout risk increases
5. fallback if full objective becomes unsafe

This is safer than attempting to clear the full room in one pass.

---

# 8. Suggested Milestone Plan

## Phase 1
- Implement retry logic
- Add fallback messaging
- Add Declutter Lite fallback

## Phase 2
- Implement auto mask splitting
- Add per-mask sequential processing
- Add attempt logging and quality scoring

## Phase 3
- Add automatic segmentation-based masks
- Add guided object selection UI
- Add analytics on failure reasons and fallback rates

---

# 9. Non-Negotiable Rules

1. Never overwrite originals
2. Never silently fail
3. Every attempt must be logged
4. Every fallback must be explicit to the user
5. Full-room furniture removal should not run on very broad masks without splitting
6. If structural integrity is uncertain, preserve authenticity over aggressiveness

---

# 10. Final Directive to Codex

Implement this as a reliability upgrade, not a cosmetic feature.

Priority order:
1. retry logic
2. fallback modes
3. auto mask splitting

The system should optimize for:
- structural accuracy
- user trust
- predictable outcomes
- premium real-estate-safe editing

A “lighter but believable” improvement is better than an aggressive hallucinated edit.
