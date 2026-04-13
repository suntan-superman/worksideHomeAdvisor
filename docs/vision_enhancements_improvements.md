from pathlib import Path

content = """# AI Realtor Vision Pipeline Fix Plan
**Version:** 1.0  
**Audience:** Codex / engineering  
**Goal:** Fix the wall-paint and floor-concept pipeline end-to-end so changes are clearly visible, structurally stable, and consistently selected.

---

## 1. Executive Summary

The current pipeline is not failing because the prompts are weak or because Replicate cannot do the work. It is failing because the wall and floor presets are routed to `local_sharp` instead of the generative inpainting pipeline, and the current local branch returns a locally rendered candidate directly as the final provider result. In the current code, `buildProviderChain()` immediately returns `['local_sharp']` whenever `preset.providerPreference === 'local_sharp'`, which means paint and floor presets never reach the Replicate orchestration path at all. The tests explicitly lock that behavior in today. fileciteturn1file6 fileciteturn1file10

That routing matches the preset definitions: the wall-paint presets and all floor presets are currently configured with `providerPreference: 'local_sharp'`, while furniture removal is still configured for Replicate. fileciteturn1file8 fileciteturn1file2

Once routed into `local_sharp`, the service builds a candidate in `buildReviewedLocalSharpCandidates()` and returns it with `providerKey: 'local_sharp'` instead of letting the orchestration pipeline evaluate true inpainted alternatives. fileciteturn1file0 fileciteturn1file4

Meanwhile, the Replicate provider already accepts `image`, `mask`, `prompt`, `strength`, `guidance_scale`, and `steps`, so the actual inpainting infrastructure exists and is ready to use. fileciteturn1file16

The fix is therefore architectural:

1. move wall and floor presets off `local_sharp`
2. build task-specific masks for walls and floors
3. route those presets through Replicate first
4. keep `local_sharp` only as fallback or optional post-processing
5. tighten prompt wording so the requested change must be visibly applied
6. align ranking/acceptance thresholds with visible-change goals
7. update tests so they assert the new provider chain and new success path

---

## 2. Current Root Cause

### 2.1 Provider routing is wrong for paint and floors
`buildProviderChain()` currently short-circuits to `['local_sharp']` when `providerPreference` is `local_sharp`. fileciteturn1file6

That means:
- `paint_warm_neutral`
- `paint_bright_white`
- `paint_soft_greige`
- `floor_light_wood`
- `floor_medium_wood`
- `floor_dark_hardwood`
- `floor_lvp_neutral`
- `floor_tile_stone`

all bypass Replicate entirely because those presets are configured with `providerPreference: 'local_sharp'`. fileciteturn1file8 fileciteturn1file2

### 2.2 Tests are enforcing the wrong behavior
The test suite currently asserts that wall paint presets and floor finish presets use the `local_sharp` provider chain. fileciteturn1file10

### 2.3 The local branch is being treated like a full provider
`buildReviewedLocalSharpCandidates()` computes review metrics and then returns a single final candidate using `providerKey: 'local_sharp'`. fileciteturn1file0 fileciteturn1file4

### 2.4 Acceptance logic expects visible localized change
The sufficiency rules for paint and floors are actually reasonable:
- paint expects `maskedChangeRatio`, `maskedColorShiftRatio`, and for bright white also `maskedLuminanceDelta`
- floor expects `focusRegionChangeRatio`, `maskedChangeRatio`, and floor-specific checks like `maskedLuminanceDelta` for dark hardwood or `maskedColorShiftRatio` for tile/stone fileciteturn1file18 fileciteturn1file19

The issue is not the metrics. The issue is that the provider routing makes it hard for the system to produce candidates that satisfy those metrics consistently.

---

## 3. End-State Architecture

## 3.1 Provider strategy by workflow

### Keep `local_sharp` for:
- truthful enhancements
- simple listing polish
- exposure / contrast cleanup
- optional deterministic fallback

### Use Replicate first for:
- wall paint concepts
- floor material concepts
- furniture removal
- cleanup passes
- kitchen finish concepts
- exterior concept transforms

### Optional fallback order
- `replicate_basic`
- `replicate_advanced`
- `local_sharp_fallback`
- `openai_edit` only where it adds clear value

---

## 4. Required Code Changes

## 4.1 Change preset providerPreference values

### File
`vision-presets.js`

### Change these presets:
- `paint_warm_neutral`
- `paint_bright_white`
- `paint_soft_greige`
- `floor_light_wood`
- `floor_medium_wood`
- `floor_dark_hardwood`
- `floor_lvp_neutral`
- `floor_tile_stone`

### From:
```js
providerPreference: 'local_sharp'
To:
providerPreference: 'replicate'
Why

These presets need real masked inpainting, not only deterministic local recoloring. Today they are locked to local_sharp in the preset definitions. fileciteturn1file8 fileciteturn1file2

4.2 Update provider-chain logic
File

vision-orchestrator.helpers.js

Current issue

This block hard-stops routing to local_sharp:

if (preset?.providerPreference === 'local_sharp') {
  return ['local_sharp'];
}

That is why those presets never reach Replicate. fileciteturn1file6

Replace with this logic
local_sharp should remain an exclusive provider only for truthful enhancement presets
concept previews for walls/floors should go through Replicate first
local_sharp may be appended as fallback, not primary
Recommended implementation
export function buildProviderChain({ preset, userPlan, openAiAvailable = false } = {}) {
  const key = String(preset?.key || '');
  const isPaintPreset = key.startsWith('paint_');
  const isFloorPreset = key.startsWith('floor_');
  const isDeterministicOnly =
    key === 'enhance_listing_quality' || key === 'combined_listing_refresh';

  if (isDeterministicOnly || preset?.providerPreference === 'local_sharp_only') {
    return ['local_sharp'];
  }

  if (isPaintPreset || isFloorPreset) {
    return ['replicate_basic', 'replicate_advanced', 'local_sharp'];
  }

  if (STANDARD_ONLY_PRESET_KEYS.has(key)) {
    return ['replicate_basic'];
  }

  if (PREMIUM_PRESET_KEYS.has(key) && userPlan === 'premium' && openAiAvailable) {
    return ['replicate_basic', 'replicate_advanced', 'openai_edit'];
  }

  if (
    PREMIUM_PRESET_KEYS.has(key) ||
    PRO_PRESET_KEYS.has(key) ||
    preset?.category === 'concept_preview'
  ) {
    return ['replicate_basic', 'replicate_advanced'];
  }

  return ['replicate_basic'];
}
Key point

Use a new value such as local_sharp_only for presets that should never leave deterministic processing.

4.3 Split mask generation by task type
File

media-ai.service.js

Current state

You already have:

buildAdaptiveWallPaintMaskAtSourceSize(...)
buildAdaptiveFloorMaskAtSourceSize(...)
buildInpaintingMaskBuffer(...)

These are good building blocks. The missing step is to use the adaptive wall/floor masks as the actual inpainting mask for paint and floor Replicate runs instead of the more generic shape mask. The current Replicate path starts from buildInpaintingMaskBuffer(...) for all jobs. fileciteturn1file0

Add a new helper
async function buildTaskSpecificMaskBuffer(sourceBuffer, presetKey, roomType) {
  if (String(presetKey || '').startsWith('paint_')) {
    return (await buildAdaptiveWallPaintMaskAtSourceSize(sourceBuffer, presetKey, roomType))
      .adaptiveMaskBuffer;
  }

  if (String(presetKey || '').startsWith('floor_')) {
    return (await buildAdaptiveFloorMaskAtSourceSize(sourceBuffer, presetKey, roomType))
      .adaptiveMaskBuffer;
  }

  return buildInpaintingMaskBuffer(sourceBuffer, presetKey, roomType);
}
Then change Replicate candidate generation

Replace:

const maskBuffer = await buildInpaintingMaskBuffer(
  sourceBuffer,
  preset.key,
  resolvedRoomType,
);

With:

const maskBuffer = await buildTaskSpecificMaskBuffer(
  sourceBuffer,
  preset.key,
  resolvedRoomType,
);
Why

Wall paint and floors require localized target masks. Generic rectangular masks are too broad and too easy for the model to ignore or partially reinterpret.

4.4 Strengthen prompt assembly for visible change
File

media-ai.service.js

Current state

The preset base prompts say the change should be visible, but for paint/floor concepts you should add a stronger task-specific “must change” clause inside the final provider prompt.

Add stronger preset prompt add-ons
For paint presets
if (wallColorPresetKeys.has(presetKey)) {
  return 'Repaint ONLY the masked wall regions. The wall color must change clearly and visibly at first glance. Do not leave walls close to the original color. Preserve trim, baseboards, outlets, windows, doors, ceiling, shadows, furniture, built-ins, and room geometry exactly. Do not add or remove objects.';
}
For floor presets
if (flooringPresetKeys.has(presetKey)) {
  return 'Change ONLY the masked floor region. The flooring material and tone must read clearly differently at first glance. Preserve walls, baseboards, windows, furniture, shadows, perspective, and room geometry exactly. Do not add rugs, decor, furniture, reflections, or new architecture.';
}
Why

The system should explicitly forbid “near-original” outcomes.

4.5 Raise paint/floor inpainting strength slightly
File

vision-presets.js

Recommended changes
Paint
paint_warm_neutral: 0.91 -> 0.96
paint_bright_white: 0.95 -> 0.98
paint_soft_greige: 0.91 -> 0.96
Floors
floor_light_wood: 0.90 -> 0.95
floor_medium_wood: 0.90 -> 0.95
floor_dark_hardwood: keep 0.95 or move to 0.97
floor_lvp_neutral: 0.90 -> 0.95
floor_tile_stone: 0.93 -> 0.96
Why

The Replicate provider already sanitizes strength into a safe range and accepts up to 0.99. fileciteturn1file16
For visible concept transforms, under-driving strength is more harmful than slightly over-driving it.

4.6 Let local sharp become fallback, not primary
File

media-ai.service.js

Current state

The local-sharp candidate builder is currently used as if it is a normal provider branch for paint/floor concepts. fileciteturn1file0

Change

Keep buildReviewedLocalSharpCandidates(...), but use it only when:

Replicate returns no candidates
all Replicate candidates fail sufficiency
or the job is explicitly deterministic-only
Recommended fallback rule
const useLocalSharpFallback =
  preset.key.startsWith('paint_') ||
  preset.key.startsWith('floor_');

if (!acceptedCandidates.length && useLocalSharpFallback) {
  fallbackCandidates = await buildReviewedLocalSharpCandidates(...);
}
Important

Persist fallback metadata:

fallbackApplied: true
fallbackReason: 'replicate_no_acceptable_candidate'

You already persist fallbackApplied; continue that pattern. fileciteturn1file11

4.7 Add source-of-truth image locking
File

media-ai.service.js

Current state

You already compute sourceVariantId, sourceOrigin, and inputHash, and the job stores the source metadata. That is good. fileciteturn1file14

Hard requirement

For paint/floor/furniture workflows, always use the original asset image buffer as the transform base unless the workflow is an explicit local cleanup stage.

Recommended rule
remove_furniture may produce a checkpoint variant
cleanup_empty_room may use that checkpoint variant
all floor and wall transforms should default back to the original room photo, not a previously edited concept image
Why

This avoids cumulative drift and weak repeated edits.

5. Acceptance and Ranking Adjustments

The current sufficiency rules for paint and floor are directionally good, but once Replicate becomes primary you should tighten visible-change requirements slightly while still controlling drift. The current paint and floor sufficiency checks are in isCandidateSufficient(...). fileciteturn1file18 fileciteturn1file19

5.1 Paint
Current bright white thresholds
maskedChangeRatio >= 0.12
maskedColorShiftRatio >= 0.065
maskedLuminanceDelta >= 0.034
maskedEdgeDensityDelta <= 0.003

These are solid. Keep them.

Add one more ranking preference

For paint presets, prefer a candidate with:

lower outsideMaskChangeRatio
lower topHalfChangeRatio
higher maskedColorShiftRatio

You already rank on these dimensions; keep that ordering but move outsideMaskChangeRatio slightly earlier if repaint drift remains a problem.

5.2 Floors
Keep
dark hardwood requires negative maskedLuminanceDelta
tile/stone requires higher maskedColorShiftRatio
all floor presets must keep furnitureCoverageIncreaseRatio low

These rules already reflect the user-visible goals. fileciteturn1file18

Add

For floor candidates, reject any candidate where:

outsideMaskChangeRatio > 0.12 for wood
outsideMaskChangeRatio > 0.14 for tile/stone
topHalfChangeRatio > 0.06 for any floor concept in this product phase
6. Test Plan Changes
6.1 Replace old provider-chain tests
File

media-ai.service.test.js

Current tests

These tests assert the broken behavior:

wall paint presets now use the local sharp provider chain
floor finish presets now use the local sharp provider chain fileciteturn1file10
Replace with:
test('wall paint presets now use replicate-first provider chain with local fallback', () => {
  assert.deepEqual(
    buildProviderChain({
      preset: resolveVisionPreset('paint_bright_white'),
      userPlan: 'premium',
      openAiAvailable: true,
    }),
    ['replicate_basic', 'replicate_advanced', 'local_sharp'],
  );
});

test('floor finish presets now use replicate-first provider chain with local fallback', () => {
  assert.deepEqual(
    buildProviderChain({
      preset: resolveVisionPreset('floor_tile_stone'),
      userPlan: 'premium',
      openAiAvailable: true,
    }),
    ['replicate_basic', 'replicate_advanced', 'local_sharp'],
  );
});
6.2 Add mask-selection tests

Add tests that verify:

paint presets call buildAdaptiveWallPaintMaskAtSourceSize
floor presets call buildAdaptiveFloorMaskAtSourceSize
non paint/floor presets still use buildInpaintingMaskBuffer

You can do this through dependency injection or by breaking mask selection into a pure helper.

6.3 Add fallback tests

Add tests asserting:

Replicate failure triggers local fallback
local fallback is marked in metadata
a replicate-accepted candidate outranks local fallback when both exist
7. UI / Product Adjustments
7.1 Improve action labels

The UI labels are understandable, but the product would benefit from showing the mode clearly:

Concept Preview
Structure Locked
Edit Region: Walls Only
Edit Region: Floor Only
7.2 Add visible-change feedback

For walls and floors, if the accepted result barely differs, show:

Result too subtle
Retrying with stronger transformation

This is better than silently surfacing a weak change.

7.3 Show source base

In attempt history, label whether the attempt was based on:

original image
prior cleanup checkpoint
fallback deterministic render
8. Recommended Implementation Order
Phase 1 — Routing fix
change wall/floor preset providerPreference to replicate
update buildProviderChain()
update tests for provider chain
Phase 2 — Task-specific masks
add buildTaskSpecificMaskBuffer(...)
use adaptive wall mask for paint
use adaptive floor mask for floor transforms
add mask-selection tests
Phase 3 — Prompt and strength tuning
strengthen paint/floor prompt add-ons
increase preset strengths
verify visible changes with manual test images
Phase 4 — Fallback cleanup
restrict local_sharp to fallback or deterministic-only presets
mark fallback metadata
add fallback tests
Phase 5 — Source locking
enforce original image as default base
allow only limited checkpoint chaining
update attempt-history labels
9. Concrete Patch Summary
9.1 vision-presets.js
change paint and floor presets from local_sharp to replicate
raise strengths as listed above
9.2 vision-orchestrator.helpers.js
stop hard-short-circuiting all local_sharp presets
use replicate-first chain for paint/floor presets
reserve local_sharp for deterministic-only presets or fallback
9.3 media-ai.service.js
add buildTaskSpecificMaskBuffer(...)
feed adaptive wall/floor masks into Replicate candidate generation
keep buildReviewedLocalSharpCandidates(...) only for fallback
enforce original-image locking for floor/wall tasks
strengthen prompt add-ons for paint/floor
9.4 media-ai.service.test.js
replace local_sharp provider tests
add mask-selection tests
add replicate fallback tests
10. Reference Patch Snippets
10.1 Replace providerPreference in presets
providerPreference: 'replicate'
10.2 Add task-specific mask router
async function buildTaskSpecificMaskBuffer(sourceBuffer, presetKey, roomType) {
  if (String(presetKey || '').startsWith('paint_')) {
    return (await buildAdaptiveWallPaintMaskAtSourceSize(sourceBuffer, presetKey, roomType))
      .adaptiveMaskBuffer;
  }

  if (String(presetKey || '').startsWith('floor_')) {
    return (await buildAdaptiveFloorMaskAtSourceSize(sourceBuffer, presetKey, roomType))
      .adaptiveMaskBuffer;
  }

  return buildInpaintingMaskBuffer(sourceBuffer, presetKey, roomType);
}
10.3 Use task-specific mask in Replicate path
const maskBuffer = await buildTaskSpecificMaskBuffer(
  sourceBuffer,
  preset.key,
  resolvedRoomType,
);
10.4 Strengthen paint prompt addon
return 'Repaint ONLY the masked wall regions. The wall color must change clearly and visibly at first glance. Do not leave walls close to the original color. Preserve trim, baseboards, outlets, windows, doors, ceiling, shadows, furniture, built-ins, and room geometry exactly. Do not add or remove objects.';
10.5 Strengthen floor prompt addon
return 'Change ONLY the masked floor region. The flooring material and tone must read clearly differently at first glance. Preserve walls, baseboards, windows, furniture, shadows, perspective, and room geometry exactly. Do not add rugs, decor, furniture, reflections, or new architecture.';
11. Expected Result After Fix

After these changes:

Walls
visible repaint instead of “almost no change”
reduced room drift
better candidate acceptance
Floors
still visibly different
stronger localized material transforms
less reliance on broad tonal darkening
System behavior
concept presets use real masked inpainting
deterministic processing is reserved for truthful enhancement or fallback
tests reflect the intended product behavior
attempt history and metadata accurately report