# Orchestrator Rewrite (Codex-Ready)
## Workside Advisor Vision Pipeline

---

# Why the current behavior feels broken

The current stack is rejecting generated candidates after scoring instead of degrading gracefully.

The logs show the request reaches `createImageEnhancementJob(...)`, runs orchestration, and then throws `No provider produced a usable output.` when `orchestrationResult.bestVariant` is missing. That exception is what produces the user-facing failure toast. fileciteturn24file6 fileciteturn24file5

Your orchestrator currently uses:
- strict provider chains for paint and floor presets
- strict paint strength thresholds
- `no_usable_finish_candidate` as a terminal state
- no guaranteed best-effort return for paint presets

That behavior is confirmed by the current tests, which explicitly expect some paint runs to return `providerUsed === null`, `bestVariant === null`, and `stoppedEarlyReason === 'no_usable_finish_candidate'`. fileciteturn24file12

The helper thresholds are also aggressive for wall paint:
- `minColorShift = 0.22`
- `minLuminanceDelta = 0.18`
- `minPerceptibility = 0.65`
- `minAcceptableScore = 7.5`

with only a slight relaxation for `paint_warm_neutral`. fileciteturn24file4

---

# Rewrite goal

Rewrite the orchestrator so it becomes:

- **fault-tolerant**
- **best-result-first**
- **time-budget-aware**
- **never-empty when any candidate exists**
- **advisory-aware for low-opportunity images**

The new rule is:

> If any provider produced any visually safe candidate, the system must return the best one.
> Hard failure should be reserved only for:
> - no candidate generated at all
> - cancellation
> - fatal upstream exception before candidate generation begins

---

# New orchestration policy

## Old policy
- provider runs
- candidate scoring
- strict sufficiency filter
- if none pass -> fail

## New policy
- provider runs
- candidate scoring
- classify candidate into:
  - high_confidence
  - acceptable
  - advisory_fallback
  - unusable
- always return the best safe candidate if one exists
- use `failed` only when literally nothing was produced

---

# Rewrite plan

## 1. Introduce candidate quality tiers

### New helper
```ts
function classifyCandidateQuality(candidate, presetKey) {
  if (!candidate) {
    return 'unusable';
  }

  if (isHighConfidenceEarlyExitCandidate(candidate, presetKey)) {
    return 'high_confidence';
  }

  if (isCandidateSufficient(candidate, presetKey)) {
    return 'acceptable';
  }

  if (isSafeBestEffortCandidate(candidate, presetKey)) {
    return 'advisory_fallback';
  }

  return 'unusable';
}
```

### Why
Current code already distinguishes:
- strong enough
- acceptable finish fallback
- no usable finish candidate

but it does not unify those into a delivery-first policy. fileciteturn24file3

---

## 2. Add `isSafeBestEffortCandidate(...)`

### New helper
```ts
function isSafeBestEffortCandidate(candidate, presetKey) {
  if (!candidate) {
    return false;
  }

  const topHalfChangeRatio = Number(candidate.topHalfChangeRatio || 0);
  const outsideMaskChangeRatio = Number(candidate.outsideMaskChangeRatio || 0);
  const newFurnitureAdditionRatio = Number(candidate.newFurnitureAdditionRatio || 0);
  const furnitureCoverageIncreaseRatio = Number(candidate.furnitureCoverageIncreaseRatio || 0);
  const maskedEdgeDensityDelta = Number(candidate.maskedEdgeDensityDelta || 0);

  if (String(presetKey || '').startsWith('paint_')) {
    return (
      Number(candidate.maskedChangeRatio || 0) >= 0.03 &&
      Number(candidate.maskedColorShiftRatio || 0) >= 0.05 &&
      Math.abs(Number(candidate.maskedLuminanceDelta || 0)) >= 0.04 &&
      topHalfChangeRatio <= 0.12 &&
      outsideMaskChangeRatio <= 0.16 &&
      newFurnitureAdditionRatio <= 0.01 &&
      furnitureCoverageIncreaseRatio <= 0.01 &&
      maskedEdgeDensityDelta <= 0.008
    );
  }

  if (String(presetKey || '').startsWith('floor_')) {
    return (
      Number(candidate.focusRegionChangeRatio || 0) >= 0.03 &&
      Number(candidate.maskedChangeRatio || 0) >= 0.04 &&
      topHalfChangeRatio <= 0.12 &&
      outsideMaskChangeRatio <= 0.18 &&
      furnitureCoverageIncreaseRatio <= 0.02 &&
      newFurnitureAdditionRatio <= 0.01
    );
  }

  return Number(candidate.overallScore || 0) >= 6.5;
}
```

### Intent
This is the “better than nothing, safe to show, do not fail the user” tier.

---

## 3. Rewrite response selection order

### Replace current winner logic with:

```ts
function selectReturnCandidate(candidates, presetKey) {
  const ranked = rankCandidates(candidates, presetKey);

  const highConfidence = ranked.find((candidate) =>
    classifyCandidateQuality(candidate, presetKey) === 'high_confidence'
  );
  if (highConfidence) {
    return {
      variant: highConfidence,
      stoppedEarlyReason: 'high_confidence_candidate',
      deliveryMode: 'high_confidence',
    };
  }

  const acceptable = ranked.find((candidate) =>
    classifyCandidateQuality(candidate, presetKey) === 'acceptable'
  );
  if (acceptable) {
    return {
      variant: acceptable,
      stoppedEarlyReason: 'acceptable_candidate',
      deliveryMode: 'acceptable',
    };
  }

  const advisory = ranked.find((candidate) =>
    classifyCandidateQuality(candidate, presetKey) === 'advisory_fallback'
  );
  if (advisory) {
    return {
      variant: advisory,
      stoppedEarlyReason: 'advisory_fallback',
      deliveryMode: 'advisory_fallback',
    };
  }

  return {
    variant: null,
    stoppedEarlyReason: 'no_candidate_generated',
    deliveryMode: 'none',
  };
}
```

---

## 4. Rewrite `orchestrateVisionJob(...)` to always deliver best-safe candidate

### Current problem
The orchestrator can end in:
- `bestVariant = null`
- `providerUsed = null`
- `stoppedEarlyReason = 'no_usable_finish_candidate'`

for finish presets. fileciteturn24file12

### New rule
At the end of orchestration:

```ts
const selection = selectReturnCandidate(allCandidates, activePreset.key);

return buildResponse({
  providerUsed: selection.variant?.providerKey || null,
  bestVariant: selection.variant || null,
  stoppedEarlyReason: selection.stoppedEarlyReason,
  timeBudgetReached,
  cancelled,
  deliveryMode: selection.deliveryMode,
});
```

### Important
Do **not** return `bestVariant = null` if any safe advisory candidate exists.

---

## 5. Introduce hard time-budget fallback

Your helper already defines:
- 150s max for `remove_furniture`
- 120s for everything else. fileciteturn24file4

But the user experienced 721s elapsed in the UI, meaning backend and UI are not enforcing a real stop behavior.

### Add hard time-budget delivery

```ts
if (elapsedBeforeProvider >= maxExecutionTimeMs) {
  const selection = selectReturnCandidate(allCandidates, activePreset.key);

  return buildResponse({
    providerUsed: selection.variant?.providerKey || null,
    bestVariant: selection.variant || null,
    stoppedEarlyReason: selection.variant
      ? 'time_budget_best_available'
      : 'time_budget_no_candidate',
    timeBudgetReached: true,
  });
}
```

### Rule
If time budget is exceeded:
- return best safe candidate immediately
- never continue iterating
- never let the UI wait indefinitely for a perfect result

---

## 6. Loosen paint thresholds for delivery, not for ranking

Keep strict thresholds for **ranking**
but add softer thresholds for **delivery fallback**.

### Leave existing paint strength scoring in place
This is still useful for:
- ranking
- diagnostics
- retry logic

### But stop using it as the only gate for delivery
Current strict thresholds are defined in `vision-orchestrator.helpers.js`. fileciteturn24file4

### New policy
- strict thresholds = “high confidence”
- moderate thresholds = “acceptable”
- soft safe thresholds = “advisory fallback”

That preserves quality without causing empty results.

---

## 7. Patch `createImageEnhancementJob(...)` so best-effort results do not throw

Current code:

```ts
if (!orchestrationResult.bestVariant) {
  throw new Error('No provider produced a usable output.');
}
```

This is the immediate reason the request fails. fileciteturn24file6

### Replace with:

```ts
if (!orchestrationResult.bestVariant) {
  job.status = 'completed';
  job.message = 'No strong visual change detected for this image.';
  job.warning =
    'The room may already present well, or the requested change was too subtle to preview reliably.';
  job.failureReason = '';
  job.fallbackMode = 'advisor_only';
  await job.save();

  return serializeImageJob(job.toObject(), []);
}
```

### Then, for advisory fallback:

```ts
if (orchestrationResult.deliveryMode === 'advisory_fallback') {
  job.status = 'completed';
  job.warning =
    'Showing the best available concept preview. Visual change is subtle and should be reviewed manually.';
  job.fallbackMode = 'best_effort_preview';
}
```

---

## 8. Change image job semantics

Right now the model supports:
- queued
- processing
- completed
- failed
- cancelled fileciteturn23file6

### Keep schema unchanged for now
But change usage rules:

## `failed`
Use only when:
- provider runner crashes before candidate creation
- storage write fails
- asset missing
- cancellation or fatal exception

## `completed`
Use for all of:
- strong result
- acceptable result
- advisory fallback
- no major change / advisor-only result

This alone will remove the false-failure UX.

---

## 9. Add `deliveryMode` to orchestration response

### Extend `buildResponse(...)`

```ts
const buildResponse = ({
  providerUsed = null,
  bestVariant = null,
  stoppedEarlyReason = null,
  timeBudgetReached = false,
  cancelled = false,
  deliveryMode = 'none',
} = {}) => ({
  providerUsed,
  providerAttemptCount: attempts.length,
  fallbackApplied: providerUsed ? chain.indexOf(providerUsed) > 0 : false,
  bestVariant,
  allCandidates: selectBestCandidates(allCandidates),
  orchestration: { chain, attempts },
  userPlan: effectiveUserPlan,
  stoppedEarlyReason,
  timeBudgetReached,
  cancelled,
  deliveryMode,
  elapsedTimeMs: Math.max(0, Number(nowFn()) - startedAt),
  maxExecutionTimeMs,
});
```

### Delivery mode values
- `high_confidence`
- `acceptable`
- `advisory_fallback`
- `advisor_only`
- `none`

---

## 10. Add low-opportunity short-circuit before expensive generation

This belongs in `createImageEnhancementJob(...)` before orchestration begins.

### New helper
```ts
function isLowOpportunityImage(asset, presetKey) {
  const analysis = asset?.analysis || {};
  const clutter = Number(analysis.clutterScore || 0);
  const lighting = Number(analysis.lightingScore || 0);
  const quality = Number(analysis.overallQualityScore || 0);

  return (
    String(presetKey || '').startsWith('paint_') &&
    clutter < 0.2 &&
    lighting > 0.7 &&
    quality > 75
  );
}
```

### Usage
```ts
if (isLowOpportunityImage(asset, preset.key)) {
  job.status = 'completed';
  job.message = 'This room already presents well.';
  job.warning =
    'No strong paint preview was generated because the room appears listing-ready already.';
  job.fallbackMode = 'advisor_only';
  await job.save();
  return serializeImageJob(job.toObject(), []);
}
```

---

# Test rewrite

The tests are currently enforcing failure behavior for paint presets in some cases. That behavior must change. fileciteturn24file12

## Replace this expectation:

```ts
assert.equal(result.providerUsed, null);
assert.equal(result.bestVariant, null);
assert.equal(result.stoppedEarlyReason, 'no_usable_finish_candidate');
```

## With:

```ts
assert.equal(result.providerUsed, 'local_sharp');
assert.equal(result.bestVariant?.providerKey, 'local_sharp');
assert.equal(result.stoppedEarlyReason, 'advisory_fallback');
assert.equal(result.deliveryMode, 'advisory_fallback');
```

---

## Add new tests

### 1. Paint preset returns advisory fallback instead of null
```ts
test('paint presets return advisory fallback instead of hard failing when change is subtle', async () => {
  // candidate below strict strength thresholds but visually safe
});
```

### 2. Time budget returns best available candidate
```ts
test('time budget returns best available candidate instead of waiting indefinitely', async () => {
  // simulate long chain with an early safe candidate
});
```

### 3. createImageEnhancementJob returns completed advisor-only state instead of throwing
```ts
test('createImageEnhancementJob completes with advisor-only message when no preview candidate is viable', async () => {
  // orchestrationResult.bestVariant null
});
```

### 4. floor presets continue best-effort behavior
Keep the existing best-effort floor behavior and confirm it still works.

---

# UI behavior rewrite

## Old toast
`Variant generation failed`

## New messages

### For advisory fallback
`Preview ready with warning`
> Showing the best available concept preview. Visual change is subtle and should be reviewed manually.

### For advisor-only / no-change
`No strong visual change detected`
> This room may already present well, or the requested change was too subtle to preview reliably.

This aligns the UI with reality instead of falsely implying provider failure.

---

# Recommended threshold split

## High confidence (keep strict)
Use current thresholds from `evaluatePaintStrength(...)`. fileciteturn24file4

## Acceptable
```ts
maskedChangeRatio >= 0.08
maskedColorShiftRatio >= 0.12
maskedLuminanceDelta >= 0.08
perceptibilityScore >= 0.45
finalScore >= 6.5
```

## Advisory fallback
```ts
maskedChangeRatio >= 0.03
maskedColorShiftRatio >= 0.05
maskedLuminanceDelta >= 0.04
outsideMaskChangeRatio <= 0.16
newFurnitureAdditionRatio <= 0.01
```

These fallback thresholds are for **delivery safety**, not for declaring a premium-quality result.

---

# Exact Codex handoff summary

Rewrite `orchestrateVisionJob(...)` so it always returns the best safe candidate instead of returning `bestVariant = null` when strict sufficiency thresholds are missed. Add candidate quality tiers (`high_confidence`, `acceptable`, `advisory_fallback`, `unusable`), introduce `isSafeBestEffortCandidate(...)`, enforce hard time-budget delivery, and return `deliveryMode` in the orchestration response. Patch `createImageEnhancementJob(...)` so `!bestVariant` no longer throws `No provider produced a usable output.` and instead completes the job with an advisor-style message. Update tests so subtle-but-safe paint runs return advisory fallback instead of hard failure.

---

# Bottom line

Right now the system is failing because it is optimized to reject imperfect candidates instead of deliver the best safe result. The rewrite above fixes that without throwing away your scoring, masking, or provider-chain work.

The goal is:

- strong result if available
- acceptable result if available
- advisory fallback if subtle
- advisor-only response if no preview is justified
- hard failure only for true system failure
