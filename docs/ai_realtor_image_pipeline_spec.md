# AI Realtor Image Pipeline Spec
**Version:** 1.0  
**Audience:** Codex / engineering implementation  
**Goal:** Build a reliable, production-grade image pipeline for AI Realtor that preserves room structure while supporting furniture removal, cleanup, material previews, and realistic seller-facing concept generation.

---

## 1. Product Goal

AI Realtor is **not** an interior design toy. The product should prioritize:

- structural realism
- geometric consistency
- room fidelity
- predictable results
- simple UX for non-technical users

The system should behave like:

- a **real-estate visualization assistant**
- a **listing prep and seller guidance tool**
- a **property improvement preview engine**

It should **not** behave like:

- a highly creative image art generator
- a style-transfer playground
- a tool that invents a different room every pass

### Primary UX promise
Given a real room photo, AI Realtor should:
1. preserve the true room layout
2. remove clutter/furniture when requested
3. preview upgrades with minimal distortion
4. avoid changing walls, windows, trim, floor shape, ceiling shape, and perspective unless explicitly requested

---

## 2. Core Problem To Solve

Current behavior suggests the system can remove furniture well, but later passes degrade:

- wall geometry
- floor perspective
- baseboard alignment
- window spacing
- room proportions
- lighting consistency

This typically happens when:
1. the system reprocesses a previously generated image
2. prompts are too creative
3. no structural constraints are used
4. the same model is asked to solve object removal and material transformation with the same settings
5. large surfaces like floors are regenerated instead of texture-edited

---

## 3. Guiding Principles

### 3.1 Always preserve source-of-truth geometry
Every new generation should reference the **original uploaded image**, not the previous generated result, unless explicitly running a controlled intermediate pipeline step.

### 3.2 Separate workflows by task class
Use distinct pipelines for:
- furniture removal
- cleanup / repair
- floor material preview
- wall paint preview
- staging
- exterior enhancement

### 3.3 Creativity must be constrained
Use low-creativity settings for real-estate workflows. The model should modify only the requested region while preserving the room.

### 3.4 Geometry before texture
First preserve:
- room edges
- perspective
- openings
- trim
- light direction

Then apply:
- floor texture
- paint color
- decor
- staging elements

### 3.5 Favor layered composition over full-scene regeneration
Whenever possible:
- segment the room
- transform only the relevant region
- composite results back onto the original

---

## 4. Recommended Architecture Overview

```text
Upload Original Image
    ↓
Image Analysis Layer
    - detect room type
    - segment floor / wall / ceiling / windows / trim / furniture
    - detect perspective lines
    - estimate depth
    - quality check
    ↓
Task Router
    - furniture removal
    - cleanup
    - floor preview
    - paint preview
    - staging
    - exterior
    ↓
Specialized Pipeline
    - task-specific model settings
    - masks
    - structural control inputs
    - low-creativity prompt templates
    ↓
Validation Layer
    - compare to original structure
    - reject warped results
    - score realism
    ↓
Result Store
    - save result
    - save metadata
    - save relationship to original image
    - save masks, attempts, and scores
```

---

## 5. Canonical Data Model

Each upload should produce a **project image record** and all future transforms should link back to it.

## 5.1 Entities

### OriginalImage
```json
{
  "id": "orig_123",
  "listingId": "listing_456",
  "storageUrl": "https://...",
  "width": 2048,
  "height": 1536,
  "roomType": "living_room",
  "analysisStatus": "complete",
  "createdAt": "2026-04-12T12:00:00Z"
}
```

### ImageAnalysis
```json
{
  "originalImageId": "orig_123",
  "floorMaskUrl": "https://...",
  "wallMaskUrl": "https://...",
  "windowMaskUrl": "https://...",
  "trimMaskUrl": "https://...",
  "furnitureMaskUrl": "https://...",
  "depthMapUrl": "https://...",
  "edgeMapUrl": "https://...",
  "perspectiveLines": [],
  "qualityScore": 0.94
}
```

### ImageTransformAttempt
```json
{
  "id": "attempt_789",
  "originalImageId": "orig_123",
  "parentAttemptId": null,
  "transformType": "furniture_removal",
  "inputMaskUrls": [],
  "promptTemplateVersion": "v1",
  "modelProfile": "strict_real_estate_inpaint",
  "settings": {
    "creativity": 0.15,
    "preserveGeometry": true
  },
  "outputUrl": "https://...",
  "validationScore": 0.91,
  "status": "accepted",
  "createdAt": "2026-04-12T12:04:00Z"
}
```

### Important rule
`originalImageId` must always remain attached to every attempt.

---

## 6. Pipeline Strategy by Workflow

## 6.1 Furniture Removal Pipeline

### Goal
Remove existing furniture/clutter while preserving:
- walls
- floor geometry
- windows
- trim
- room depth
- light direction

### Inputs
- original image
- furniture mask
- optional user refinement mask

### Required controls
- edge map from original
- depth map from original
- floor mask lock
- wall/window/trim preservation mask

### Prompt style
Use language like:
- remove only the selected furniture and clutter
- preserve the exact room structure
- do not move walls, windows, trim, or flooring geometry
- reconstruct missing background naturally
- keep the same perspective and lighting

### Recommended settings
- low to medium denoise
- low creativity
- strict inpainting boundaries
- preserve_structure = true

### Output policy
Accept result only if:
- floor lines remain aligned
- windows do not shift
- no visible warping near removed object area
- trim/baseboards remain stable

---

## 6.2 Cleanup / Repair Pipeline

### Goal
Repair artifacts after furniture removal:
- shadows
- wall blemishes
- floor discontinuities
- patch seams

### Inputs
- original image
- prior accepted furniture removal attempt
- local repair masks only

### Important rule
This pipeline should be **localized only**. It must not regenerate the full scene.

### Method
- small-mask repair pass
- tile/patch blending
- edge-aware fill
- texture continuity repair

### Do not
- rerun full room generation
- allow broad changes to walls/floor

---

## 6.3 Floor Material Preview Pipeline

### Goal
Show tile / stone / LVP / hardwood alternatives while keeping:
- exact floor shape
- perspective
- shadowing
- reflections
- baseboard intersections

### Inputs
- original image
- floor mask
- selected material profile
- perspective and depth controls

### Best practice
This should be a **surface replacement pipeline**, not a room regeneration pipeline.

### Approach
1. isolate floor region
2. estimate plane and perspective
3. map selected material texture to the floor plane
4. blend with original lighting and shadow information
5. protect wall/furniture/window regions entirely

### Material mapping requirements
- plank or tile direction should follow room perspective
- grout or board scale must match room size
- reflections should be subtle and realistic
- floor edges at trim/walls must stay clean

### Prompt style
If generative step is used:
- replace flooring material only within masked floor region
- preserve exact room geometry
- preserve trim and wall boundaries
- do not alter windows, walls, or room shape

### Validation checks
Reject result if:
- floor lines bend unnaturally
- floor creeps into baseboards
- room perspective changes
- wall color shifts unexpectedly

---

## 6.4 Wall Paint Preview Pipeline

### Goal
Preview new paint colors while preserving:
- wall texture
- shadows
- trim color
- windows and openings
- lighting

### Inputs
- wall mask excluding trim and windows
- color selection
- original image

### Method
Use color-aware transformation rather than full regeneration whenever possible.

### Requirements
- keep original lighting gradients
- preserve shadows and corner falloff
- avoid paint bleeding into trim or ceiling
- maintain wall texture

---

## 6.5 Virtual Staging Pipeline

### Goal
Add attractive but realistic furniture while preserving room scale and layout.

### Inputs
- original or cleaned room image
- room type
- style selection
- keep-out masks for windows, doors, walkways

### Constraints
- no oversized furniture
- no blocking windows
- no floating objects
- maintain realistic scale

### Product recommendation
Staging should be treated as a separate premium workflow, not mixed with removal/repair/material preview logic.

---

## 6.6 Exterior Enhancement Pipeline

### Goal
Improve curb appeal while preserving structure.

### Safe transformations
- sky cleanup
- grass enhancement
- shrub cleanup
- mulch refresh
- minor paint color preview
- lighting cleanup

### High-risk transformations
- roof changes
- driveway redesign
- major facade restructuring

High-risk transformations should require user confirmation and stronger warnings.

---

## 7. Processing Rule: Never Chain from Final Output by Default

## Problem
Repeatedly transforming generated outputs causes compounding drift.

## Required policy
Every workflow starts from:
- the original image
- the original masks
- the original structural analysis

### Allowed exception
A controlled intermediate result may be used only when:
- it is marked as an approved pipeline checkpoint
- it carries structural validation metadata
- it is used for a local follow-up pass only

### Example
Allowed:
```text
Original → Furniture Removal → Local Cleanup
```

Not allowed:
```text
Original → Furniture Removal → Full Scene Tile Preview using prior generated image
```

Instead:
```text
Original + Floor Mask + Prior furniture mask knowledge → Floor Preview
```

---

## 8. Structural Preservation Layer

This is the most important technical addition.

## 8.1 Required preserved elements
- room boundaries
- floor perimeter
- wall corners
- window and door frames
- trim/baseboards
- ceiling lines
- major perspective vanishing directions

## 8.2 Recommended control inputs
Depending on stack:
- canny/edge map
- line segment map
- depth map
- segmentation masks
- room plane estimation
- corner/keypoint detection

## 8.3 Structural similarity scoring
Before accepting a result, compare original vs output for:
- edge displacement
- window box displacement
- floor perimeter consistency
- trim edge overlap
- vanishing line shift

### Example validation thresholds
- window frame displacement < 3% of image width
- floor perimeter IoU > 0.92
- wall edge displacement < 2.5%
- baseboard continuity score > 0.90

If below threshold:
- reject
- retry with stricter settings
- or fall back to non-generative texture mapping

---

## 9. Task Router Design

A task router should choose the correct pipeline based on user action.

### Actions
- remove furniture
- remove clutter
- clean walls
- replace flooring
- change paint color
- stage room
- improve exterior

### Router output
```json
{
  "taskType": "floor_preview",
  "pipeline": "surface_replace_floor_v2",
  "requiresOriginalImage": true,
  "requiredMasks": ["floorMask"],
  "preserveMasks": ["wallMask", "windowMask", "trimMask"],
  "validationProfile": "strict_geometry_floor"
}
```

---

## 10. Prompt Framework

Prompting should be modular, deterministic, and task-specific.

## 10.1 Global system rules
Every prompt template should include hidden system constraints such as:
- preserve exact room geometry
- preserve perspective
- preserve all windows, doors, trim, and ceiling lines
- modify only the requested region
- do not restyle the room beyond the request
- keep lighting natural and consistent

## 10.2 Example template: furniture removal
```text
Remove only the selected furniture and clutter from this room.
Preserve the exact room layout, walls, windows, trim, floor perspective, and lighting.
Reconstruct the obscured wall and floor areas naturally.
Do not alter room proportions or create new architectural features.
```

## 10.3 Example template: floor preview
```text
Replace the flooring material only within the masked floor region using the selected material.
Preserve the exact room geometry, wall boundaries, trim, windows, and perspective.
Do not alter the room structure, wall color, or window placement.
Maintain realistic lighting and shadow continuity.
```

## 10.4 Example template: wall paint
```text
Change only the wall paint color within the masked wall region.
Preserve trim, ceiling, windows, shadows, and wall texture.
Do not modify room geometry or any non-wall surfaces.
```

---

## 11. Model Profiles

Use named model profiles rather than ad hoc settings.

### strict_real_estate_inpaint
Use for:
- furniture removal
- cleanup

Characteristics:
- low creativity
- strong structure preservation
- strict masked edits
- minimal style drift

### floor_surface_replace
Use for:
- floor material preview

Characteristics:
- floor-only transform
- strong perspective mapping
- texture realism
- wall lock

### wall_color_transform
Use for:
- paint preview

Characteristics:
- color-focused
- minimal geometry change
- preserve light/shadow

### premium_virtual_staging
Use for:
- staged scenes

Characteristics:
- moderate creativity
- scale-aware object placement
- premium décor libraries

---

## 12. Retry and Fallback Logic

Do not expose unstable attempts as final results by default.

## 12.1 Retry strategy
For each request:
1. run initial attempt
2. validate structure
3. if failed, retry with stricter settings
4. if still failed, switch to fallback method

### Example fallback for flooring
Fallback from:
- generative room transform

To:
- deterministic floor plane texture projection + shadow blend

### Example fallback for paint
Fallback from:
- generative paint transformation

To:
- masked color mapping preserving luminance

---

## 13. Attempt History Strategy

The UI already hints at attempt history. That is good, but it needs strong logic.

## 13.1 Each attempt should store
- original image reference
- workflow type
- mask set
- model profile
- validation score
- rejection reason if failed
- thumbnail
- timestamp

## 13.2 Attempt states
- processing
- accepted
- soft_rejected
- hard_rejected
- user_kept
- user_deleted

## 13.3 Default user experience
Show only:
- accepted attempts
- highest-scoring result first

Hide:
- failed or distorted attempts unless user opens history

---

## 14. UI/UX Spec Implications

## 14.1 Users need to know what is being changed
Before generation, show:
- selected action
- affected area
- whether geometry is locked
- whether this is concept preview or premium workflow

### Example
**Current Action:** Floor Material Preview  
**Mode:** Structure Locked  
**Edit Region:** Floor Only

## 14.2 Recommended workflow labels
- Remove Furniture
- Clean Up Room
- Preview New Floors
- Preview Paint Colors
- Virtually Stage Room
- Enhance Exterior

Avoid vague labels like:
- Generate
- Transform
- Vision mode

## 14.3 Comparison UX
Support:
- before / after slider
- attempt history
- keep this version
- delete this version
- rerun with stricter realism
- refine mask

---

## 15. Masking Requirements

Good masks are the backbone of this system.

## 15.1 Required masks
- floor
- walls
- ceiling
- windows
- trim/baseboards
- furniture/clutter
- doors/openings
- fixtures if needed

## 15.2 User mask refinement
Allow user to:
- add to mask
- subtract from mask
- brush with simple controls
- zoom for detail areas

## 15.3 Auto-mask QA
Before running generation:
- ensure floor mask does not overlap walls
- ensure wall mask excludes windows and trim
- ensure furniture mask is reasonable and not swallowing architecture

---

## 16. Validation Layer

A result should be scored before surfacing.

## 16.1 Validation dimensions
- geometry preservation
- mask adherence
- realism
- artifact detection
- color consistency
- lighting continuity

## 16.2 Example output
```json
{
  "geometryScore": 0.95,
  "maskAdherenceScore": 0.92,
  "realismScore": 0.88,
  "artifactScore": 0.91,
  "overallScore": 0.91,
  "accepted": true
}
```

## 16.3 Automatic rejection examples
Reject when:
- windows shift
- baseboards warp
- floor angle changes
- room becomes wider/narrower
- obvious AI smears appear
- sunlight direction changes unnaturally

---

## 17. Recommended Implementation Phases

## Phase 1: Stabilize existing furniture removal
Build:
- original image locking
- mask persistence
- edge/depth preservation
- validation scoring
- accepted attempt history

## Phase 2: Add deterministic floor pipeline
Build:
- floor segmentation
- plane estimation
- texture projection
- shadow blending
- tile/plank scale controls

## Phase 3: Add wall paint preview
Build:
- wall segmentation
- masked color transforms
- trim/window protection

## Phase 4: Add cleanup/refinement tools
Build:
- local patch repair
- shadow cleanup
- artifact removal
- brush refine

## Phase 5: Add premium staging
Build:
- room-type aware staging
- style presets
- realistic scale validation

---

## 18. Recommended Engineering Tasks for Codex

## Backend
- create image project record model
- create original-image anchored transform model
- create task router
- add model profiles
- add validation scoring service
- add attempt history service
- add retry/fallback orchestrator

## CV / image analysis
- segmentation for floor/walls/windows/trim/furniture
- edge map generation
- depth estimation
- perspective line estimation
- floor plane estimation

## Frontend
- workflow-specific action panel
- mask preview
- structure-locked badge
- before/after slider
- attempt history drawer
- keep/delete/rerun actions
- refine mask tools

## DevOps / storage
- store originals separately from outputs
- version attempts
- store masks and analysis artifacts
- cache thumbnails
- enable background processing queue

---

## 19. Non-Negotiable Rules

1. Never destroy the original image.
2. Never use a prior generated output as the default base for a new global transformation.
3. Always preserve windows, trim, wall edges, and floor shape unless explicitly requested otherwise.
4. Use specialized pipelines per task type.
5. Validate every output before showing it as a recommended result.
6. Prefer deterministic surface editing over full-scene generation whenever possible.
7. Keep UX language simple and confidence-building.

---

## 20. Example End-to-End Flows

## 20.1 Furniture removal
```text
Upload image
→ analyze scene
→ detect furniture mask
→ user reviews mask
→ run strict furniture removal
→ validate geometry
→ local cleanup if needed
→ save accepted result
```

## 20.2 Floor preview
```text
Upload image
→ analyze scene
→ detect floor mask + plane
→ user selects material
→ run floor surface replacement
→ validate perspective + boundaries
→ save accepted result
```

## 20.3 Paint preview
```text
Upload image
→ analyze scene
→ detect wall mask
→ exclude trim/windows
→ apply paint transform
→ validate edge integrity
→ save accepted result
```

---

## 21. Success Metrics

Track:
- accepted result rate
- retry rate
- geometry rejection rate
- user keep rate
- user delete rate
- average time to accepted result
- number of manual mask refinements
- percentage of outputs requiring fallback

### Product KPI targets
- > 85% accepted result rate for furniture removal
- > 90% geometry preservation pass rate for floor preview
- < 10% user deletion rate on accepted outputs
- < 2 attempts on average per accepted result

---

## 22. Final Recommendation

The most important change is this:

**AI Realtor should become an original-image-anchored, structure-preserving, workflow-specific image system.**

That means:
- original image stays the source of truth
- task router selects specialized pipeline
- large surfaces use deterministic mapping where possible
- generative models are constrained and validated
- failed attempts stay hidden unless explicitly opened

This will make the app feel:
- more trustworthy
- more professional
- more predictable
- more aligned with real-estate use cases

---

## 23. Build Priority Summary

Implement in this order:

1. original image locking
2. structural preservation and validation
3. furniture removal stabilization
4. deterministic floor preview pipeline
5. wall paint preview
6. local cleanup/refinement
7. premium staging

---

## 24. Codex Handoff Summary

Build AI Realtor image processing as a **multi-pipeline architecture** with strict structure preservation. Anchor every transform to the original uploaded image. Separate furniture removal, cleanup, floor preview, paint preview, and staging into distinct workflows with dedicated masks, prompts, settings, and validation thresholds. Reject or retry any output that shifts room geometry, windows, trim, or floor perspective. Favor deterministic surface replacement for floors and masked color transforms for walls instead of full-room regeneration.

