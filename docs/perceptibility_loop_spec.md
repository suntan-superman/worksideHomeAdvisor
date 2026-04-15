# Perceptibility-Aware Generation Loop Spec

## Objective
Transform the vision pipeline into a self-correcting system that ensures:
- Clearly visible changes (especially for walls/floors)
- Zero hallucinations
- Consistent, decision-grade outputs for real estate use

---

## High-Level Flow

1. Generate candidates
2. Evaluate candidates
3. Diagnose weaknesses
4. Apply adjustments
5. Regenerate
6. Repeat (max 2–3 iterations)

---

## Loop Implementation

```ts
for (let iteration = 0; iteration < maxIterations; iteration++) {
  for (provider of chain) {
    run provider
    evaluate candidates
  }

  const best = selectBestCandidates(allCandidates)[0]

  if (isStrongEnough(best)) break

  const adjustment = diagnoseFailure(allCandidates, preset)

  if (!adjustment.shouldRetry) break

  applyAdjustment(adjustment)
}
```

---

## Failure Diagnosis

```ts
function diagnoseFailure(candidates, presetKey) {
  const best = rankCandidates(candidates, presetKey)[0]

  if (!best) return { shouldRetry: false }

  if (presetKey.startsWith("paint_")) {
    if (best.maskedChangeRatio < 0.08) {
      return { type: "too_subtle", action: "increase_strength" }
    }
    if (best.maskedColorShiftRatio < 0.04) {
      return { type: "color_not_distinct", action: "increase_color_shift" }
    }
    if (best.maskedLuminanceDelta < 0.015) {
      return { type: "not_bright_enough", action: "increase_brightness" }
    }
    if (best.newFurnitureAdditionRatio > 0.02) {
      return { type: "hallucination", action: "tighten_negative_prompt" }
    }
  }

  if (presetKey.startsWith("floor_")) {
    if (best.focusRegionChangeRatio < 0.08) {
      return { type: "floor_not_changed", action: "increase_strength" }
    }
    if (best.maskedEdgeDensityDelta < 0.005) {
      return { type: "no_texture", action: "increase_detail" }
    }
  }

  return { shouldRetry: false }
}
```

---

## Adaptive Adjustments

```ts
function applyAdjustment(adjustment, currentSettings) {
  switch (adjustment.action) {
    case "increase_strength":
      currentSettings.strength = Math.min(0.98, currentSettings.strength + 0.05)
      break

    case "increase_color_shift":
      currentSettings.guidanceScale += 0.5
      break

    case "increase_brightness":
      currentSettings.prompt += " Make the change clearly brighter and more visible."
      break

    case "tighten_negative_prompt":
      currentSettings.negativePrompt += ", added furniture, decor, fixtures"
      break

    case "increase_detail":
      currentSettings.numInferenceSteps += 6
      break
  }

  return currentSettings
}
```

---

## Strong Enough Criteria

```ts
function isStrongEnough(candidate, presetKey) {
  if (presetKey.startsWith("paint_")) {
    return (
      candidate.maskedChangeRatio >= 0.12 &&
      candidate.maskedColorShiftRatio >= 0.06 &&
      candidate.maskedLuminanceDelta >= 0.02 &&
      candidate.newFurnitureAdditionRatio <= 0.01
    )
  }

  if (presetKey.startsWith("floor_")) {
    return (
      candidate.focusRegionChangeRatio >= 0.12 &&
      candidate.maskedChangeRatio >= 0.14
    )
  }

  return candidate.isSufficient
}
```

---

## Perceptibility Score

```ts
perceptibilityScore =
  maskedChangeRatio * 0.5 +
  maskedColorShiftRatio * 0.3 +
  Math.abs(maskedLuminanceDelta) * 0.2
```

Reject if:

```ts
perceptibilityScore < 0.08
```

---

## Ranking Priority

1. No hallucinations
2. Perceptibility score (higher is better)
3. Edge cleanliness

---

## Prompt Upgrade (Critical)

Replace vague prompts like:
"shift toward a warmer neutral direction"

With:

"Change the wall color to a clearly warmer beige, cream, or soft taupe tone.  
The difference must be immediately noticeable at first glance.  
Do NOT add any new objects, fixtures, or structural elements."

---

## Iteration Strategy

Iteration 0:
- Default settings

Iteration 1:
- Increase strength
- Increase guidance scale
- Stronger prompt wording

Iteration 2:
- Force visibility language
- Max strength

---

## Observability

Log each iteration:

```ts
{
  iteration: 1,
  failureType: "too_subtle",
  adjustment: "increase_strength",
  previousScore: {...},
  newScore: {...}
}
```

---

## Expected Outcome

- Wall changes become clearly visible
- Floors consistently transform
- No hallucinated objects
- System self-corrects weak outputs

---

## Summary

This converts the pipeline from:

Static AI output  
→  

Self-correcting, perception-aware system

This is the key step to making the product reliable and decision-grade.
