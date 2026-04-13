# AI Realtor Vision Pipeline Fix Plan
**Version:** 1.0  
**Audience:** Codex / engineering  
**Purpose:** Fix the current wall-paint and floor-preview pipeline end-to-end so concept previews produce strong visible changes while preserving room structure.

---

## 1. Executive Summary

The current pipeline is close, but the wall and floor concept system has one major architectural mismatch:

- the evaluation system is built as if edits are mask-driven localized transforms
- but the current execution path often behaves like weak full-image color adjustment or insufficiently constrained generation

That is why:
- dark floor shifts sometimes appear to work
- wall paint previews often show little or no visible difference
- hours are lost rerunning jobs that are structurally incapable of producing the desired change

### Core fix
Convert wall-paint and floor-finish presets into a true original-image-anchored, mask-driven edit pipeline with:
1. explicit source image anchoring
2. deterministic wall/floor masking
3. localized transformation
4. stronger visible-change rules
5. validation tied to the same mask actually used for editing
6. fallback logic when the preferred provider underperforms

---

## 2. Current Root Problems

### 2.1 Provider mismatch
Your orchestration and scoring system expect targeted edits, but many wall/floor presets are routed to `local_sharp`, which is only suitable for deterministic local recoloring and not semantic scene editing.

### Result
- floor darkening can sometimes succeed because luminance shifts are easy
- wall repaint often looks unchanged because walls need stronger selective recoloring and cleaner masks

### 2.2 Editing and evaluation are not tightly coupled
You compute sophisticated metrics like:
- `maskedChangeRatio`
- `maskedColorShiftRatio`
- `maskedLuminanceDelta`
- `outsideMaskChangeRatio`

But these only matter if the exact same edit-region mask is used consistently across:
1. edit generation
2. candidate scoring
3. sufficiency checks
4. ranking

If the effective edit region differs from the evaluation region, the system can score the wrong thing.

### 2.3 Local paint/floor transforms are too subtle
The local wall and floor transforms currently preserve realism well, but for seller-facing concept previews they can be too conservative.

### Result
The output is technically safer but visually disappointing:
- soft greige may barely move
- white paint may not read as clearly brighter
- floor tile/stone may not read as a clear material shift

### 2.4 No forced escalation when visible change is weak
A candidate that is structurally safe but visually weak should trigger:
- stronger local transform
- provider escalation
- deterministic fallback selection

### 2.5 Pipeline needs one source of truth
Every concept run must always start from:
- original uploaded image
- original analysis
- original masks or regenerated masks from original

Never from a previously generated concept image for a full-scene transform.

---

## 3. Desired Final Architecture

```text
Original Image
  ↓
Scene Analysis
  - room type normalization
  - wall mask
  - floor mask
  - furniture mask
  - structural reference regions
  ↓
Task Router
  - paint preview
  - floor preview
  - furniture removal
  - cleanup pass
  ↓
Execution Engine
  - local deterministic edit OR masked generative edit
  - strict prompt + strict mask coupling
  ↓
Validation Engine
  - visible change checks
  - structure drift checks
  - outside-mask contamination checks
  ↓
Ranking / Fallback
  - accept best safe strong candidate
  - retry stronger local settings
  - escalate provider if needed
```

---

## 4. End-to-End Fix Strategy

### 4.1 Keep three execution modes

#### Mode A: Local deterministic transform
Use for:
- wall paint previews
- most floor finish previews
- predictable, fast concept output

#### Mode B: Masked generative inpaint
Use for:
- furniture removal
- cleanup pass
- kitchen finish package changes
- exterior concept changes
- any preset where semantic object reasoning is required

#### Mode C: Recovery / fallback
Use when:
- mask is weak
- local transform is too subtle
- generated candidate changes outside target region
- result fails visibility threshold

---

## 5. Source-of-Truth Rule

Every preset must start from the original stored media asset, not from a previously generated variant.

### Required implementation rule
When a user triggers:
- `paint_*`
- `floor_*`
- `remove_furniture`
- `cleanup_empty_room`

the backend should resolve:

```js
const baseImage = await readStoredAsset(originalAsset.storageKey);
```

not:

```js
const baseImage = previousVariantBuffer;
```

### Allowed exception
A local cleanup pass may use a previous accepted concept image only if:
- it is a checkpoint variant
- it is local-only cleanup
- it does not restart a broad global transform

---

## 6. Provider Routing Fix

### 6.1 Recommended provider routing table

#### Wall paint
Default:
- `local_sharp`

Escalation:
- `replicate_basic`
- `replicate_advanced`

#### Flooring
Default:
- `local_sharp`

Escalation:
- `replicate_basic`
- `replicate_advanced`

#### Furniture removal
Default:
- `replicate_basic`
- `replicate_advanced`
- `openai_edit` if available

#### Cleanup empty room
Default:
- `replicate_basic`
- `replicate_advanced`

#### Kitchen / exterior concept
Default:
- `replicate_basic`
- `replicate_advanced`

### 6.2 Build provider chain by preset and failure mode
For wall/floor presets, do not force only one provider forever. Use the local pass first, then escalate if it is too weak.

```js
function buildProviderChain({ preset, userPlan, openAiAvailable = false } = {}) {
  const key = String(preset?.key || '');

  if (String(key).startsWith('paint_') || String(key).startsWith('floor_')) {
    return ['local_sharp', 'replicate_basic', 'replicate_advanced'];
  }

  if (preset?.providerPreference === 'local_sharp') {
    return ['local_sharp'];
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
```

---

## 7. Masking Fix

### 7.1 One editing mask per task
Each task must define a canonical mask:
- `paint_*` → wall mask excluding windows, trim, outlets, doors
- `floor_*` → floor mask excluding baseboards and furniture
- `remove_furniture` → furniture mask
- `cleanup_empty_room` → artifact cleanup mask or source furniture footprint mask

### Critical rule
The exact same mask family used for editing must also be used for evaluation.

### 7.2 Wall mask recommendations
Use a hybrid approach:
1. broad geometric seed region
2. color similarity to wall cluster
3. texture suppression
4. exclusion of:
   - windows
   - trim/baseboards
   - shelving/built-ins
   - large edge-dense objects

### Required improvements
- tighten upper and side exclusions around windows and trim
- increase mask confidence threshold where edge density spikes
- add optional debug artifact save for every mask
- compute wall-mask coverage ratio and reject obviously bad masks

```js
if (wallMaskCoverageRatio < 0.08 || wallMaskCoverageRatio > 0.62) {
  throw new Error('Wall mask coverage is out of expected range.');
}
```

### 7.3 Floor mask recommendations
Improve by:
- explicitly biasing toward lower-half plane continuity
- excluding vertical structures
- excluding furniture silhouettes before final mask smoothing
- preserving a small dead zone above baseboards to avoid bleed

```js
if (floorMaskCoverageRatio < 0.12 || floorMaskCoverageRatio > 0.58) {
  throw new Error('Floor mask coverage is out of expected range.');
}
```

### 7.4 Save every mask in debug mode
For every candidate attempt, save:
- source image thumbnail
- mask thumbnail
- candidate output thumbnail
- blended output thumbnail

---

## 8. Local Wall Paint Fix

### 8.1 Goal
Make paint shifts:
- obvious at first glance
- still realistic
- limited to wall region only

### 8.2 Required changes
Increase effective repaint strength for paint presets.

#### `paint_bright_white`
```js
{
  targetHue: 34 / 360,
  targetSaturation: 0.02,
  targetLightness: 0.995,
  targetHueMix: 1,
  targetSaturationMix: 1,
  lightnessMix: 1,
  additionalLift: 0.28,
  blendMix: 0.998,
  alphaExponent: 0.58,
  minBlend: 0.92,
  shadingRange: 0.10,
}
```

#### `paint_soft_greige`
```js
{
  targetHue: 28 / 360,
  targetSaturation: 0.18,
  targetLightness: 0.60,
  targetHueMix: 1,
  targetSaturationMix: 1,
  lightnessMix: 1,
  additionalLift: 0.02,
  blendMix: 0.996,
  alphaExponent: 0.60,
  minBlend: 0.90,
  shadingRange: 0.14,
}
```

#### `paint_warm_neutral`
```js
{
  targetHue: 30 / 360,
  targetSaturation: 0.20,
  targetLightness: 0.72,
  targetHueMix: 1,
  targetSaturationMix: 1,
  lightnessMix: 1,
  additionalLift: 0.04,
  blendMix: 0.994,
  alphaExponent: 0.60,
  minBlend: 0.89,
  shadingRange: 0.13,
}
```

### 8.3 Add post-transform local composite
```js
const finalBuffer = await blendVariantWithSourceMask({
  sourceBuffer,
  variantBuffer: recoloredBuffer,
  maskBuffer: wallMaskBuffer,
  maskBlur: 1.8,
});
```

---

## 9. Local Floor Transform Fix

### 9.1 Goal
Make the floor read clearly as:
- darker wood
- lighter wood
- neutral LVP
- tile/stone

while preserving:
- perspective
- shadows
- wall/floor boundary
- furniture silhouettes

### 9.2 Required changes
Increase floor material stylization modestly, but only inside the floor mask.

#### Dark hardwood
```js
{
  targetHue: 24 / 360,
  targetSaturation: 0.50,
  targetLightness: 0.18,
  targetHueMix: 0.98,
  targetSaturationMix: 0.98,
  lightnessMix: 0.99,
  blendMix: 0.992,
  alphaExponent: 0.66,
  minBlend: 0.90,
  shadingScale: 0.62,
  additionalLift: 0.01,
  contrastBoost: 0.02,
}
```

### 9.3 Always composite result back through the floor mask
Use `blendVariantWithSourceMask(...)` for local floor outputs before scoring.

---

## 10. Prompt Fix for Generative Escalation

### 10.1 Wall prompt template
```text
Repaint ONLY the walls inside the masked region.
Make the new wall color clearly visible at first glance and noticeably different from the source.
Do not leave the wall color unchanged.
Do not alter trim, baseboards, ceilings, windows, doors, outlets, floors, furniture, built-ins, room geometry, or lighting direction.
Preserve shadows and wall texture naturally.
```

### 10.2 Floor prompt template
```text
Change ONLY the flooring inside the masked floor region.
Make the flooring change clearly visible at first glance.
Do not alter walls, trim, windows, furniture, built-ins, room shape, or perspective.
Preserve realistic shadows, floor perspective, and baseboard boundaries.
```

### 10.3 Furniture removal prompt template
Add:
```text
Do not replace removed furniture with different furniture.
Do not restage the room.
Prioritize true empty floor area and true subtraction.
```

---

## 11. Validation Fix

### 11.1 Candidate sufficiency should match user expectation
For paint/floor, a structurally safe but barely visible change is not sufficient.

For `paint_bright_white`:
```js
maskedChangeRatio >= 0.14
maskedColorShiftRatio >= 0.075
maskedLuminanceDelta >= 0.045
maskedEdgeDensityDelta <= 0.003
topHalfChangeRatio <= 0.08
outsideMaskChangeRatio <= 0.16
furnitureCoverageIncreaseRatio <= 0.012
newFurnitureAdditionRatio <= 0.01
```

For `paint_soft_greige`:
```js
maskedChangeRatio >= 0.13
maskedColorShiftRatio >= 0.07
topHalfChangeRatio <= 0.09
outsideMaskChangeRatio <= 0.18
```

For dark hardwood:
```js
focusRegionChangeRatio >= 0.14
maskedChangeRatio >= 0.16
maskedLuminanceDelta <= -0.05
furnitureCoverageIncreaseRatio <= 0.015
outsideMaskChangeRatio <= 0.18
```

For tile/stone:
```js
focusRegionChangeRatio >= 0.14
maskedChangeRatio >= 0.16
maskedColorShiftRatio >= 0.10
topHalfChangeRatio <= 0.08
outsideMaskChangeRatio <= 0.16
```

### 11.2 Add “visually weak” rejection reason
```js
const isVisuallyWeak =
  presetKey.startsWith('paint_')
    ? maskedChangeRatio < threshold || maskedColorShiftRatio < threshold
    : presetKey.startsWith('floor_')
      ? maskedChangeRatio < threshold
      : false;
```

If `isVisuallyWeak`, do not stop the provider chain.

---

## 12. Ranking Fix

For paint and floor presets, ranking should prefer:
1. strong but safe visible change
2. low outside-mask contamination
3. low structure drift
4. no furniture additions
5. higher concept clarity

### Suggested ranking order for paint
1. `newFurnitureAdditionRatio`
2. `furnitureCoverageIncreaseRatio`
3. `outsideMaskChangeRatio`
4. `topHalfChangeRatio`
5. `maskedColorShiftRatio`
6. `maskedLuminanceDelta` for bright white
7. `maskedChangeRatio`
8. `overallScore`

### Suggested ranking order for flooring
1. `furnitureCoverageIncreaseRatio`
2. `outsideMaskChangeRatio`
3. `topHalfChangeRatio`
4. `maskedColorShiftRatio` for tile/stone
5. `maskedLuminanceDelta` for dark hardwood
6. `maskedChangeRatio`
7. `focusRegionChangeRatio`
8. `overallScore`

---

## 13. Fallback Logic

### 13.1 Paint fallback sequence
1. local wall recolor
2. local wall recolor with stronger config
3. masked generative repaint via `replicate_basic`
4. masked generative repaint via `replicate_advanced`
5. choose best candidate using same wall mask metrics

### 13.2 Floor fallback sequence
1. local floor transform
2. local floor transform with stronger material config
3. masked generative floor edit via `replicate_basic`
4. masked generative floor edit via `replicate_advanced`

---

## 14. Recommended Code Changes

### 14.1 Change provider chain behavior
File: `vision-orchestrator.helpers.js`

Replace paint/floor one-provider behavior with hybrid escalation.

### 14.2 Add mask coverage QA
File: `media-ai.service.js`

After:
- `buildAdaptiveWallPaintMaskAtSourceSize`
- `buildAdaptiveFloorMaskAtSourceSize`

compute:
```js
const coverage = await calculateMaskCoverageRatio(maskBuffer);
```

reject or fall back if coverage is implausible.

### 14.3 Always composite local variants through mask
For both:
- `renderLocalWallPaintVariantBuffer`
- `renderLocalFloorVariantBuffer`

return the transformed buffer, then composite it with:
```js
blendVariantWithSourceMask(...)
```

before final evaluation.

### 14.4 Add stronger local pass option
```js
function getLocalPassIntensity(presetKey, attemptIndex = 0) {
  if (attemptIndex <= 0) return 'normal';
  return 'strong';
}
```

### 14.5 Introduce provider escalation for paint/floor
In orchestration:
- if local candidate fails sufficiency OR is visually weak
- continue chain to `replicate_basic`
- if still insufficient, continue to `replicate_advanced`

### 14.6 Save debug metrics
```js
metadata.debug = {
  maskCoverageRatio,
  focusRegionChangeRatio,
  maskedChangeRatio,
  maskedColorShiftRatio,
  maskedLuminanceDelta,
  outsideMaskChangeRatio,
  topHalfChangeRatio,
  providerKey,
  wasEscalated,
}
```

---

## 15. Suggested Implementation Phases

### Phase 1: Fast rescue
1. add provider escalation for `paint_*` and `floor_*`
2. strengthen local paint/floor configs
3. composite local output through actual mask
4. add visually weak rejection rule

### Phase 2: Mask hardening
1. add mask coverage QA
2. save debug mask thumbnails
3. tighten trim/window exclusion
4. tighten floor/baseboard separation

### Phase 3: Generative fallback polish
1. add stronger masked prompts
2. enforce mask coupling for scoring
3. tune sufficiency thresholds with real examples

### Phase 4: Production stabilization
1. store original-image anchor explicitly
2. persist attempt lineage
3. add admin debug screen for mask + metrics
4. auto-retry when visible change is too weak

---

## 16. Example Pseudocode Flow

```js
async function runConceptPreview({
  originalBuffer,
  preset,
  roomType,
  userPlan,
}) {
  const providerChain = buildProviderChain({ preset, userPlan, openAiAvailable: true });
  const candidates = [];

  const editMask = await resolveTaskMask(originalBuffer, preset.key, roomType);
  await validateMaskCoverage(editMask, preset.key);

  for (const providerKey of providerChain) {
    const providerCandidates = await runProvider({
      providerKey,
      preset,
      originalBuffer,
      editMask,
      roomType,
    });

    const scored = await scoreCandidates({
      candidates: providerCandidates,
      sourceBuffer: originalBuffer,
      maskBuffer: editMask,
      presetKey: preset.key,
    });

    candidates.push(...scored);

    const bestSoFar = rankCandidates(candidates, preset.key)[0];
    if (bestSoFar && isCandidateSufficient(bestSoFar, preset.key) && !isVisuallyWeak(bestSoFar, preset.key)) {
      return bestSoFar;
    }
  }

  return rankCandidates(candidates, preset.key)[0] || null;
}
```

---

## 17. Exact Codex Handoff

Implement the wall-paint and floor-preview system as a mask-driven hybrid pipeline. Keep `local_sharp` as the first-pass provider for paint and floor presets, but do not stop there when the visible change is weak. Use the same canonical wall or floor mask for editing, validation, sufficiency checks, and ranking. Strengthen local wall and floor tone transforms so concept previews are obvious at first glance, then composite the result back onto the original image through the blurred edit mask. Add mask-coverage QA, debug mask saves, and explicit escalation to `replicate_basic` and `replicate_advanced` when the local result is too subtle. Ensure every concept run starts from the original uploaded image, not a prior generated variant.

---

## 18. Final Recommendation

The fastest path to success is not to throw away your current system. Your evaluation and ranking work is already strong. The fix is to make execution match the evaluation model:

- edit the right region
- make the change clearly visible
- measure the same region you edited
- escalate when the first pass is too subtle
- always anchor to the original image

That will turn this from a frustrating loop into a pipeline that behaves like a real seller-facing product.
