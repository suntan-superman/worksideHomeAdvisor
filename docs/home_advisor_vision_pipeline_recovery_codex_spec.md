# Home Advisor Vision Pipeline Recovery — Codex Implementation Spec

## Purpose

Apply a targeted recovery to the Home Advisor Vision pipeline so the product stops regressing into barely changed previews while preserving the safety improvements already made.

The current pipeline over-corrected toward safety. Listing-safe enhancement should remain conservative, but concept tools such as Open Room Preview, furniture removal, flooring, and wall paint need a separate, stronger concept pipeline.

This spec separates the system into two clear tracks:

1. **Listing Safe Pipeline**
   - Deterministic.
   - Fast.
   - Publish-safe.
   - Uses local Sharp/OpenCV-style enhancement.
   - Does not remove major furniture.
   - Does not use generative reconstruction.

2. **Concept Studio Pipeline**
   - Generative.
   - Explicitly labeled as concept-only.
   - Used for furniture removal, flooring, wall color, kitchen concepts, and exterior concepts.
   - Can use Replicate and OpenAI image editing.
   - Allowed to make larger visual changes, but must still protect windows, trim, ceiling lines, and structural geometry.

---

# Current Problem

Recent “Medium Declutter” output barely changes the photo. The likely causes are:

- `declutter_medium` is over-prompted to preserve too much.
- Negative prompts explicitly discourage removing visible furniture and major objects.
- `remove_furniture` was changed into a very conservative “Open Room Preview.”
- `remove_furniture` provider chain was reduced to only `replicate_basic`.
- Strength was capped too low.
- Trust thresholds are being applied too broadly.
- Concept tools are being treated like listing-safe tools.

This caused the system to preserve geometry better, which is good, but visibly useful edits became too weak.

---

# High-Level Required Changes

## Keep These Improvements

Do not undo these:

- `combined_listing_refresh` should remain deterministic/local only.
- `enhance_listing_quality` should remain deterministic/local only.
- `lighting_boost` should remain deterministic/local only.
- Window/trim/ceiling protection should remain strict.
- Trust scoring should remain in place.
- User-facing language should avoid engineering terms like hallucination, low-confidence, artifact, geometry failure, or pipeline failure.

## Restore Controlled Concept Power

For concept operations, restore stronger generation:

- Open Room / furniture removal should use multiple providers again.
- Concept tools should be allowed to create visible changes.
- Trust scoring should reject broken results, not prevent generation from trying.
- OpenAI image editing should be added into concept chains when configured.
- Replicate output count should be increased for concept tools so ranking can choose the best result.

---

# Files To Modify

Likely files:

```txt
backend/src/modules/media/vision-presets.js
backend/src/modules/media/vision-orchestrator.helpers.js
backend/src/modules/media/vision-orchestrator.service.js
backend/src/modules/media/media-ai.service.js
backend/src/modules/media/openai-image.provider.js
backend/src/modules/media/replicate-provider.service.js
backend/src/modules/media/media-ai.service.test.js
```

Adjust paths if the project structure differs.

---

# Implementation Phase 1 — Split Pipeline Classification

## Goal

Introduce an explicit pipeline classification so the orchestrator knows whether the requested operation is:

- listing-safe
- concept-studio
- finish-concept
- cleanup-enhancement

## Add Helper Functions

In `vision-orchestrator.helpers.js`, add:

```js
export function isListingSafePreset(presetKey = '') {
  return [
    'enhance_listing_quality',
    'lighting_boost',
    'combined_listing_refresh',
  ].includes(String(presetKey || ''));
}

export function isConceptStudioPreset(presetKey = '') {
  const key = String(presetKey || '');
  return (
    key === 'remove_furniture' ||
    key === 'cleanup_empty_room' ||
    key.startsWith('paint_') ||
    key.startsWith('floor_') ||
    key.startsWith('kitchen_') ||
    key.startsWith('exterior_') ||
    key.startsWith('backyard_')
  );
}

export function resolveVisionPipelineMode(presetKey = '') {
  if (isListingSafePreset(presetKey)) {
    return 'listing_safe';
  }

  if (isConceptStudioPreset(presetKey)) {
    return 'concept_studio';
  }

  return 'enhancement';
}
```

## Acceptance Criteria

- Listing-safe presets resolve to `listing_safe`.
- Furniture/floor/wall/kitchen/exterior concepts resolve to `concept_studio`.
- Tests cover these helpers.

---

# Implementation Phase 2 — Restore Concept Provider Chains

## Goal

Listing-safe tools remain local-only, but concept tools regain enough provider coverage to produce visible results.

## Modify `buildProviderChain`

In `vision-orchestrator.helpers.js`, update the provider chain logic.

### Required Behavior

```js
if (isListingSafePreset(key)) {
  return ['local_sharp'];
}
```

For `remove_furniture` / `Open Room Preview`:

```js
if (key === 'remove_furniture') {
  return openAiAvailable
    ? ['replicate_basic', 'replicate_advanced', 'openai_edit']
    : ['replicate_basic', 'replicate_advanced'];
}
```

For `cleanup_empty_room`:

```js
if (key === 'cleanup_empty_room') {
  return openAiAvailable
    ? ['replicate_basic', 'replicate_advanced', 'openai_edit']
    : ['replicate_basic', 'replicate_advanced'];
}
```

For floor concepts:

```js
if (isFloorPreset) {
  return openAiAvailable
    ? ['replicate_basic', 'replicate_advanced', 'openai_edit', 'local_sharp']
    : ['replicate_basic', 'replicate_advanced', 'local_sharp'];
}
```

For paint concepts, keep current broad chain:

```js
if (isPaintPreset) {
  return openAiAvailable
    ? ['replicate_basic', 'replicate_advanced', 'openai_edit', 'local_sharp']
    : ['replicate_basic', 'replicate_advanced', 'local_sharp'];
}
```

## Important

Do not let listing-safe presets use Replicate or OpenAI.

## Acceptance Criteria

Tests should assert:

```js
buildProviderChain({
  preset: { key: 'combined_listing_refresh' },
  openAiAvailable: true,
}) === ['local_sharp'];

buildProviderChain({
  preset: { key: 'remove_furniture' },
  userPlan: 'premium',
  openAiAvailable: true,
}) === ['replicate_basic', 'replicate_advanced', 'openai_edit'];

buildProviderChain({
  preset: { key: 'floor_dark_hardwood' },
  userPlan: 'premium',
  openAiAvailable: true,
}) includes 'openai_edit';
```

---

# Implementation Phase 3 — Restore Visible Open Room Preview

## Goal

Open Room Preview should no longer be a no-op. It should reduce visible distractions and, when safe, remove selected furniture or bulky items.

## Modify `remove_furniture` Preset

In `vision-presets.js`, update `remove_furniture`.

### Replace current base prompt with:

```txt
Create a realistic open-room concept preview for this real estate photo. Remove or simplify movable furniture and visual distractions when it can be done believably. Prioritize clearing portable seating, small tables, decor, throws, clutter, and bulky visual distractions while preserving the true room architecture. Keep windows, blinds, trim, ceiling lines, baseboards, built-ins, doors, permanent fixtures, lighting direction, and perspective intact. The room should feel more open and easier to understand, but must remain realistic.
```

### Replace helper text with:

```txt
Create a concept preview that makes the room feel more open while preserving structural truth.
```

### Suggested settings

```js
strength: 0.76,
guidanceScale: 7.8,
numInferenceSteps: 38,
outputCount: 3,
```

### Replace negative prompt with:

```txt
warped windows, distorted blinds, changed windows, altered trim, changed ceiling, changed wall geometry, changed floor perspective, fake architecture, added furniture, new staging, unrealistic shadows, blurry, low quality
```

## Key Change

Remove these phrases from the negative prompt:

```txt
removed sofa
removed chair
removed large chair
removed bed
removed coffee table
```

Those phrases prevent visible furniture removal.

## Acceptance Criteria

- Open Room Preview produces a visible difference.
- It may remove/simplify furniture in concept mode.
- Windows and architecture are preserved.
- It remains labeled concept-only.

---

# Implementation Phase 4 — Fix Declutter Presets

## Goal

Declutter should visibly remove clutter and soft furnishings, but not attempt full room reconstruction.

## Modify `declutter_light`

Use for small cleanup only.

Suggested settings:

```js
strength: 0.62,
guidanceScale: 7.6,
numInferenceSteps: 32,
outputCount: 2,
```

Base prompt:

```txt
Clean up this residential interior photo for real estate listing use. Remove small movable distractions such as loose throws, remotes, cords, papers, small decor clusters, shelf clutter, table clutter, and floor-edge clutter. Preserve the main furniture, rug, windows, walls, flooring, lamps, shelving, architecture, and room layout. Make the room visibly tidier and more buyer-friendly while staying realistic.
```

Negative prompt:

```txt
changed windows, changed walls, changed flooring, changed rug, new furniture, restaging, empty room, warped furniture, distorted architecture, fake geometry, unrealistic shadows, blurry, low quality
```

## Modify `declutter_medium`

Use for stronger cleanup, still not full furniture removal.

Suggested settings:

```js
strength: 0.74,
guidanceScale: 8.0,
numInferenceSteps: 38,
outputCount: 3,
```

Base prompt:

```txt
Create a visibly cleaner listing-photo version of this residential interior. Remove loose throws, remotes, cords, papers, small decor clusters, shelf clutter, table clutter, and floor-edge clutter. Simplify visually noisy surfaces and make the room read cleaner at thumbnail size. Preserve major furniture, windows, walls, flooring, rug, lamps, built-ins, architecture, lighting direction, and room layout. Do not fully empty or restage the room.
```

Negative prompt:

```txt
changed windows, changed walls, changed flooring, changed rug, new furniture, full restaging, empty room, warped furniture, distorted architecture, fake geometry, unrealistic shadows, blurry, low quality
```

## Important

Remove these from declutter negative prompts:

```txt
removed sofa
removed chair
removed coffee table
```

For declutter, the prompt already says to preserve major furniture. The negative prompt should focus on preventing geometry drift, not preventing all removal.

## Acceptance Criteria

- Medium declutter should visibly reduce throws, shelf clutter, table clutter, and loose objects.
- It should not remove the entire room.
- It should preserve windows, flooring, rug, walls, and major furniture.

---

# Implementation Phase 5 — Add OpenAI Concept Fallback

## Goal

When OpenAI image editing is configured, concept tools should use it after Replicate attempts.

## Required Behavior

In `orchestrateVisionJob`, ensure `openai_edit` provider can run for:

- `remove_furniture`
- `cleanup_empty_room`
- `floor_*`
- `paint_*`
- `kitchen_*`
- `exterior_*`
- `backyard_*`

## OpenAI Prompt Strategy

When provider key is `openai_edit`, build a slightly different prompt:

```txt
Edit this real estate image realistically. Apply only the requested concept edit. Preserve all windows, blinds, trim, ceiling lines, baseboards, doors, built-ins, structural geometry, lighting direction, and camera perspective. Do not add unrelated objects. Do not restage unless explicitly requested. Keep the result believable as a planning concept.
```

Append preset-specific instructions after that.

## Acceptance Criteria

- OpenAI is part of concept provider chain when configured.
- OpenAI is not used for listing-safe deterministic tools.
- OpenAI outputs are ranked with the same scoring framework.

---

# Implementation Phase 6 — Trust Score Should Reject Bad Outputs, Not Prevent Strong Attempts

## Goal

Trust score should be used after candidate generation, not to make generation so conservative that all outputs are no-ops.

## Required Rules

In `selectReturnCandidate` / ranking logic:

1. Rank visible candidates.
2. Reject candidates below minimum trust threshold.
3. If all concept candidates fail trust:
   - return the best deterministic/local fallback if available
   - otherwise return the original-safe enhancement
   - do not show a broken generative output

## Concept Thresholds

Use slightly lower thresholds for concept studio:

```js
export function getMinimumTrustThreshold(presetKey = '') {
  const key = String(presetKey || '');

  if (isListingSafePreset(key)) {
    return 78;
  }

  if (key === 'remove_furniture' || key === 'cleanup_empty_room') {
    return 64;
  }

  if (key.startsWith('paint_') || key.startsWith('floor_')) {
    return 66;
  }

  return 64;
}
```

## Important

A concept preview may be imperfect, but it must not be structurally broken.

Reject:
- warped windows
- shifted blinds
- fake ceiling lines
- changed baseboards
- changed perspective
- invented fireplace
- duplicated furniture
- obviously fake shadows

Allow:
- stronger object removal
- visible floor change
- visible wall color shift
- concept-level imperfections if structure is intact

## Acceptance Criteria

- Concept candidates are not over-rejected for merely being visibly different.
- Listing-safe results remain strict.
- Broken windows/geometry still cause rejection.

---

# Implementation Phase 7 — Immutable Window / Trim Composite

## Goal

Even when generative tools are used, protected structural regions should be composited back from the original image.

## Add Function

In `media-ai.service.js`, add:

```js
export async function compositeProtectedRegions({
  sourceBuffer,
  variantBuffer,
  protectedMaskBuffer,
}) {
  const source = sharp(sourceBuffer).rotate();
  const variant = sharp(variantBuffer).rotate();

  const metadata = await source.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);

  const normalizedMask = await sharp(protectedMaskBuffer)
    .resize(width, height, { fit: 'fill', kernel: sharp.kernel.nearest })
    .greyscale()
    .threshold(128)
    .png()
    .toBuffer();

  return sharp(variantBuffer)
    .rotate()
    .composite([
      {
        input: await sharp(sourceBuffer).rotate().png().toBuffer(),
        blend: 'over',
        mask: normalizedMask,
      },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
```

If Sharp mask compositing requires an alpha mask instead of `mask`, implement by creating an RGBA overlay from source pixels and protected mask alpha.

## Protected Regions

Build mask from:

- bright structured windows
- blind regions
- window trim
- ceiling top band
- baseboards if detected
- built-ins / shelving if high confidence

At minimum, implement windows + top ceiling band first.

## Apply To

After any generative provider returns a candidate for:

- remove_furniture
- cleanup_empty_room
- paint_*
- floor_*
- kitchen_*
- exterior_*
- backyard_*

composite protected regions back over the generated result before scoring and saving.

## Acceptance Criteria

- Generated concept results cannot alter windows.
- Blinds remain from original.
- Ceiling band remains stable.
- Before/after no longer shows window wobble.

---

# Implementation Phase 8 — Add “Visible Change But Safe” Candidate Ranking

## Goal

Select the candidate that has the best balance of:

- visible useful change
- trust score
- task-specific success

## Add scoring function

In `vision-orchestrator.helpers.js`:

```js
export function calculateConceptUtilityScore(candidate = {}, presetKey = '') {
  const trust = calculateRealEstateTrustScore(candidate, presetKey) / 100;
  const visibleChange = Math.min(1, Number(candidate.focusRegionChangeRatio || candidate.maskedChangeRatio || 0) * 3);
  const objectRemoval = Math.min(1, Number(candidate.objectRemovalScore || 0) * 2.2);
  const paintOrFloorChange = Math.min(
    1,
    Number(candidate.maskedChangeRatio || 0) * 1.8 +
      Math.abs(Number(candidate.maskedLuminanceDelta || 0)) * 1.2 +
      Number(candidate.maskedColorShiftRatio || 0) * 1.3
  );

  let taskScore = visibleChange;

  if (presetKey === 'remove_furniture' || presetKey === 'cleanup_empty_room') {
    taskScore = Math.max(visibleChange, objectRemoval);
  } else if (String(presetKey).startsWith('paint_') || String(presetKey).startsWith('floor_')) {
    taskScore = Math.max(visibleChange, paintOrFloorChange);
  }

  return Number((trust * 0.58 + taskScore * 0.42).toFixed(4));
}
```

Use this in ranking for concept presets.

## Acceptance Criteria

- A candidate with no visible change should not win just because it is safe.
- A candidate with visible change but broken windows should not win.
- The winner should be the best balance of useful + believable.

---

# Implementation Phase 9 — User-Facing Labels

## Goal

Stop showing user-facing warning language that makes the system look broken.

## Required External Labels

Use only:

```txt
Listing Ready
Enhanced Preview
Concept Preview
Needs Review
```

## Replace Messages

Replace:

```txt
Low-confidence preview
Preview ready with warning
Artifacting
Hallucination
Geometry issue
Pipeline failure
```

With:

```txt
Subtle preview generated.
Changes were intentionally kept conservative to preserve realism.
```

For concept mode:

```txt
Concept preview generated.
Use this to explore possibilities before preparing final listing photos.
```

For failed concept:

```txt
We kept the safer version because the stronger concept did not preserve the room realistically.
```

## Acceptance Criteria

- No raw engineering terms appear in UI payloads.
- Internal logs can keep engineering terms.
- API response `warning` and `message` fields are sanitized.

---

# Implementation Phase 10 — Frontend Button Grouping

## Goal

Make the UX match the architecture.

## Recommended UI Groups

### Listing Safe

- Enhance for Listing
- Lighting Boost
- Listing Refresh

Label:

```txt
Safe for listing preparation
```

### Cleanup

- Light Declutter
- Medium Declutter

Label:

```txt
Clean up visible distractions
```

### Concept Studio

- Open Room Preview
- Wall Color Preview
- Flooring Preview
- Kitchen Preview
- Exterior Preview

Label:

```txt
Concept previews for planning only
```

## Required Copy

For Open Room Preview:

```txt
Creates a planning preview that makes the room feel more open. Not intended to replace final listing photos.
```

For Medium Declutter:

```txt
Removes loose visual distractions while preserving major furniture and room layout.
```

## Acceptance Criteria

- Users understand concept previews are not listing-ready.
- Users do not expect perfect empty-room renders from normal declutter.
- Listing-safe tools feel reliable and fast.

---

# Implementation Phase 11 — Tests To Add / Update

## `buildProviderChain`

Add tests:

```js
test('listing-safe presets remain local only', () => {
  assert.deepEqual(
    buildProviderChain({
      preset: resolveVisionPreset('combined_listing_refresh'),
      userPlan: 'standard',
      openAiAvailable: true,
    }),
    ['local_sharp'],
  );
});
```

```js
test('open room preview uses full concept provider chain when OpenAI is available', () => {
  assert.deepEqual(
    buildProviderChain({
      preset: resolveVisionPreset('remove_furniture'),
      userPlan: 'premium',
      openAiAvailable: true,
    }),
    ['replicate_basic', 'replicate_advanced', 'openai_edit'],
  );
});
```

```js
test('open room preview uses replicate concept chain when OpenAI is unavailable', () => {
  assert.deepEqual(
    buildProviderChain({
      preset: resolveVisionPreset('remove_furniture'),
      userPlan: 'premium',
      openAiAvailable: false,
    }),
    ['replicate_basic', 'replicate_advanced'],
  );
});
```

## Preset Tests

Add tests confirming:

- `remove_furniture.strength >= 0.72`
- `remove_furniture.outputCount >= 3`
- `remove_furniture.negativePrompt` does not include:
  - `removed sofa`
  - `removed chair`
  - `removed coffee table`

## Trust Tests

Add tests:

```js
test('concept candidate with visible change and acceptable trust can pass', () => {
  const candidate = {
    focusRegionChangeRatio: 0.28,
    maskedChangeRatio: 0.32,
    outsideMaskChangeRatio: 0.12,
    topHalfChangeRatio: 0.04,
    newFurnitureAdditionRatio: 0,
    windowIntegrityChangeRatio: 0.005,
  };

  assert.ok(meetsMinimumTrustThreshold(candidate, 'remove_furniture'));
});
```

```js
test('candidate with window drift fails trust even with strong visible change', () => {
  const candidate = {
    focusRegionChangeRatio: 0.42,
    maskedChangeRatio: 0.45,
    outsideMaskChangeRatio: 0.1,
    topHalfChangeRatio: 0.04,
    newFurnitureAdditionRatio: 0,
    windowIntegrityChangeRatio: 0.08,
  };

  assert.equal(meetsMinimumTrustThreshold(candidate, 'remove_furniture'), false);
});
```

---

# Implementation Phase 12 — Recommended Rollout Order

Do this in order:

1. Add pipeline classification helpers.
2. Restore provider chain for concept tools.
3. Update `remove_furniture` preset.
4. Update declutter prompts and strengths.
5. Add OpenAI concept fallback.
6. Add concept utility score.
7. Lower concept trust thresholds only.
8. Add protected-region compositing.
9. Sanitize user-facing messages.
10. Update tests.
11. Run backend tests.
12. Run side-by-side manual tests on:
    - living room with windows
    - kitchen with counters
    - bedroom with bed
    - exterior photo
    - flooring change
    - wall paint change

---

# Manual QA Checklist

Use the same living room photo.

## Medium Declutter Should

- remove/simplify loose throw on sofa
- reduce shelf clutter
- clean small table/visual distractions
- preserve windows
- preserve sofa/chairs
- preserve rug
- preserve floor
- preserve room perspective
- show visible improvement

## Open Room Preview Should

- visibly simplify room
- possibly remove or reduce some furniture
- preserve windows/blinds
- preserve ceiling and trim
- preserve floor direction
- not invent fireplace, new shelves, or fake staging
- clearly be labeled concept preview

## Listing Refresh Should

- run quickly
- improve exposure
- lift shadows
- improve clarity
- preserve everything
- produce a publish-safe asset

---

# Do Not Do

Do not:

- make listing refresh generative again
- show raw warning language to users
- let concept outputs auto-promote to listing-ready
- remove trust scoring
- weaken window protection
- rely on a single Replicate result for concept previews
- use negative prompts that prohibit the actual desired edit

---

# Expected Outcome

After these changes:

- Listing Refresh becomes stable and trustworthy.
- Medium Declutter creates visible but safe cleanup.
- Open Room Preview becomes useful again as a concept tool.
- Flooring and wall paint regain enough generative strength to be evaluated honestly.
- Bad geometry still gets rejected.
- Users stop seeing scary warning messages.
- The product regains forward momentum without returning to the earlier hallucination-heavy failure mode.

---

# Final Product Principle

Use this as the guiding rule:

```txt
Listing Safe = conservative, deterministic, publishable.
Concept Studio = stronger, generative, clearly labeled, structurally protected.
```

Do not mix those two pipelines again.
