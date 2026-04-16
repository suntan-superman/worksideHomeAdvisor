# Never Show Empty Result System (Codex-Ready)
## Workside Advisor Vision Pipeline

---

# Objective

Design the vision pipeline so the user is **never left with an empty outcome** after waiting for processing.

That means the system must never end in a user-facing state that feels like:

- “Variant generation failed”
- “No provider produced a usable output”
- long wait followed by nothing
- silent rejection of all generated candidates

Instead, every request must end in one of these user-meaningful outcomes:

1. **Strong preview returned**
2. **Acceptable preview returned**
3. **Best-effort preview returned with warning**
4. **Advisor-only response returned**
5. **True system failure** only when nothing could be generated at all due to an actual infrastructure/runtime issue

---

# Core product rule

> If the system has enough information to help the user, it must help the user.

That help may be:
- a strong visual preview
- a subtle but safe preview
- a recommendation-only result explaining why previewing was not useful

But it must not be:
- an empty state after a long wait

---

# The current problem

The current architecture still allows this failure path:

```ts
providers run
→ candidate(s) generated
→ scoring rejects all candidates
→ bestVariant is null
→ createImageEnhancementJob throws
→ user sees failure toast
```

This is a product failure, not a provider failure.

---

# New result contract

Replace the old mental model:

```ts
success = preview exists
failure = preview missing
```

With:

```ts
success = user received something useful
failure = infrastructure prevented all useful output
```

---

# Delivery modes

Every completed request must return one of these delivery modes:

```ts
type VisionDeliveryMode =
  | 'high_confidence'
  | 'acceptable'
  | 'best_effort_preview'
  | 'advisor_only'
  | 'system_failure';
```

---

# New state model

## Completed outcomes

### 1. high_confidence
A strong preview passed the preferred thresholds.

### 2. acceptable
A valid preview passed relaxed thresholds and is safe to show.

### 3. best_effort_preview
A preview is imperfect, subtle, or noisy, but still useful enough to show with warning.

### 4. advisor_only
No visual preview is justified or perceptible enough, but the user gets a recommendation response.

## True failure only

### 5. system_failure
Use only when:
- provider runner crashes before any candidate is created
- source image cannot be read
- storage write fails
- serialization fails
- request is cancelled
- hard upstream exception with no recoverable artifact

---

# Rewrite the success policy

## Old policy
- if `bestVariant` missing → fail

## New policy
- if high-confidence candidate exists → return it
- else if acceptable candidate exists → return it
- else if safe best-effort candidate exists → return it with warning
- else if room is low-opportunity or subtle → return advisor-only
- else if no candidate exists at all → system failure

---

# Result selection ladder

Use this order:

```ts
function selectFinalOutcome({
  candidates,
  presetKey,
  advisorPayload,
  infrastructureError = null,
}) {
  const ranked = rankCandidates(candidates, presetKey);

  const strong = ranked.find((candidate) => candidate.deliveryMode === 'high_confidence');
  if (strong) {
    return {
      status: 'completed',
      deliveryMode: 'high_confidence',
      selectedVariant: strong,
      warning: '',
    };
  }

  const acceptable = ranked.find((candidate) => candidate.deliveryMode === 'acceptable');
  if (acceptable) {
    return {
      status: 'completed',
      deliveryMode: 'acceptable',
      selectedVariant: acceptable,
      warning: '',
    };
  }

  const bestEffort = ranked.find((candidate) => candidate.deliveryMode === 'best_effort_preview');
  if (bestEffort) {
    return {
      status: 'completed',
      deliveryMode: 'best_effort_preview',
      selectedVariant: bestEffort,
      warning: 'Showing the best available concept preview. Review manually.',
    };
  }

  if (advisorPayload) {
    return {
      status: 'completed',
      deliveryMode: 'advisor_only',
      selectedVariant: null,
      warning: 'No strong visual change was appropriate for this image.',
      advisorPayload,
    };
  }

  return {
    status: 'failed',
    deliveryMode: 'system_failure',
    selectedVariant: null,
    warning: infrastructureError || 'No recoverable output could be produced.',
  };
}
```

---

# Candidate classification

Every normalized candidate should get a delivery classification immediately after evaluation.

```ts
function assignDeliveryMode(candidate, presetKey) {
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
    return 'best_effort_preview';
  }

  return 'unusable';
}
```

Then store it:

```ts
normalizedCandidate.deliveryMode = assignDeliveryMode(normalizedCandidate, presetKey);
```

---

# Never-throw rule for missing preview

## Current anti-pattern

```ts
if (!orchestrationResult.bestVariant) {
  throw new Error('No provider produced a usable output.');
}
```

## Replace with

```ts
if (!orchestrationResult.bestVariant) {
  job.status = 'completed';
  job.message = 'No strong visual change detected for this image.';
  job.warning =
    'The room may already present well, or the requested change was too subtle to preview reliably.';
  job.fallbackMode = 'advisor_only';
  job.failureReason = '';
  await job.save();

  return serializeImageJob(job.toObject(), []);
}
```

This single change eliminates the fake-failure path.

---

# Advisor-only fallback

When preview is not useful, the system must still provide guidance.

## Advisor payload shape

```ts
type AdvisorOnlyPayload = {
  title: string;
  summary: string;
  recommendations: string[];
  nextActions: string[];
  rationale: string;
};
```

## Example response

```ts
{
  title: 'This room already presents well',
  summary: 'The requested wall change would likely create only a subtle visible difference.',
  recommendations: [
    'Optional: test a darker wall concept for comparison',
    'Optional: explore lighter flooring for stronger contrast',
    'No decluttering appears necessary in this room'
  ],
  nextActions: [
    'Try a darker wall preset to validate perceptible repainting',
    'Move to another room with greater improvement opportunity'
  ],
  rationale: 'This room is already bright, neutral, and visually clean.'
}
```

---

# Low-opportunity early exit

Do not waste provider calls on rooms that are already bright neutral no-op candidates.

## Pre-check helper

```ts
function shouldExitAdvisorOnly({
  presetKey,
  roomMetrics,
  assetAnalysis,
}) {
  if (!String(presetKey || '').startsWith('paint_')) {
    return { exit: false };
  }

  if (presetKey === 'paint_dark_charcoal_test') {
    return { exit: false };
  }

  const isBrightNeutral =
    Number(roomMetrics?.meanLuminance || 0) >= 0.58 &&
    Number(roomMetrics?.meanSaturation || 0) <= 0.18 &&
    Number(roomMetrics?.colorVariance || 1) <= 0.12 &&
    Number(roomMetrics?.luminanceVariance || 1) <= 0.12;

  const presentsWell =
    Number(assetAnalysis?.overallQualityScore || 0) >= 72 &&
    Number(assetAnalysis?.lightingScore || 0) >= 65 &&
    !Boolean(assetAnalysis?.retakeRecommended);

  return {
    exit: isBrightNeutral && presentsWell,
    reason: isBrightNeutral && presentsWell ? 'room_already_neutral' : '',
  };
}
```

## Usage

If true:
- mark job completed
- skip generation
- return advisor-only payload

---

# Hard time-budget fallback

No request should run indefinitely while waiting for a better candidate.

## Rule

If:
- time budget exceeded
- any safe candidate exists

Then:
- return best available candidate immediately

## Pseudocode

```ts
if (elapsedMs >= maxExecutionTimeMs) {
  const selection = selectBestSafeCandidate(allCandidates, preset.key);

  if (selection) {
    return {
      status: 'completed',
      deliveryMode: selection.deliveryMode,
      selectedVariant: selection,
      timeBudgetReached: true,
      warning: 'Returned best available result when time budget was reached.',
    };
  }

  return {
    status: 'completed',
    deliveryMode: 'advisor_only',
    selectedVariant: null,
    advisorPayload: buildAdvisorOnlyPayload(...),
    timeBudgetReached: true,
  };
}
```

---

# UI contract

The UI must stop using failure language for non-failure situations.

## Replace these

### Old
- Variant generation failed
- No provider produced a usable output

### New
- Preview ready
- Preview ready with warning
- No strong visual change detected
- Room already presents well

---

# UI message mapping

## high_confidence
**Title:** Preview ready  
**Message:** A strong concept preview was generated.

## acceptable
**Title:** Preview ready  
**Message:** A usable concept preview was generated.

## best_effort_preview
**Title:** Preview ready with warning  
**Message:** Showing the best available concept preview. Review manually.

## advisor_only
**Title:** No strong visual change detected  
**Message:** The room may already present well, or the requested change was too subtle to preview reliably.

## system_failure
**Title:** Preview unavailable  
**Message:** We were unable to generate a preview due to a system issue. Please try again.

---

# Job model usage rules

Keep the existing schema if you want, but reinterpret it.

## `status = completed`
Use for:
- high_confidence
- acceptable
- best_effort_preview
- advisor_only

## `status = failed`
Use only for:
- true infrastructure failure
- unrecoverable runtime exception
- no candidates created and no advisor fallback available

## `fallbackMode`
Use values like:
- `best_effort_preview`
- `advisor_only`
- `time_budget_best_available`

---

# Selected-variant rules

## If preview exists
- `selectedVariantId` must point to the chosen variant

## If advisor-only
- `selectedVariantId = null`
- but the job still returns `status = completed`

This is essential. `null` preview must not imply failure.

---

# Storage rules

If any image candidate exists and is safe enough to show:
- save it
- return it
- never silently discard all variants unless they are truly unusable

If candidates are noisy but safe:
- persist best one with warning metadata
- mark with:
  - `deliveryMode`
  - `warning`
  - `requiresManualReview: true`

---

# Recommended metadata on every variant

```ts
variant.metadata.delivery = {
  mode: 'high_confidence' | 'acceptable' | 'best_effort_preview',
  warning: string,
  requiresManualReview: boolean,
  scoreSummary: {
    overallScore: number,
    perceptibilityScore: number,
    maskedChangeRatio: number,
    outsideMaskChangeRatio: number,
  },
};
```

---

# Orchestrator patch outline

## 1. Add delivery mode to every candidate
Inside normalization:

```ts
const normalizedCandidate = {
  ...candidate,
  providerKey,
  paintStrength,
  isSufficient: isCandidateSufficient(candidate, preset.key),
};

normalizedCandidate.deliveryMode = assignDeliveryMode(normalizedCandidate, preset.key);
```

## 2. Select best final outcome
At the end:

```ts
const outcome = selectFinalOutcome({
  candidates: allCandidates,
  presetKey: preset.key,
  advisorPayload: buildAdvisorOnlyPayloadIfNeeded(...),
});
```

## 3. Return completed advisor-only instead of throw
In `createImageEnhancementJob(...)`, remove throw-on-missing-bestVariant logic.

---

# Advisor-only builder

Add a helper like this:

```ts
function buildAdvisorOnlyPayload({ presetKey, roomType, roomMetrics }) {
  if (String(presetKey || '').startsWith('paint_')) {
    return {
      title: 'This room already presents well',
      summary:
        'The requested wall change would likely create only a subtle visible difference.',
      recommendations: [
        'Test a darker wall concept if you want a more obvious comparison',
        'Consider floor direction changes if stronger contrast is desired',
        'Move to another room with greater improvement opportunity'
      ],
      nextActions: [
        'Try paint_dark_charcoal_test',
        'Try floor_light_wood if the room feels heavy or dark'
      ],
      rationale:
        'The room appears bright, neutral, and visually clean already.',
    };
  }

  return {
    title: 'No major visual change recommended',
    summary: 'This image appears to need minimal enhancement.',
    recommendations: ['Consider another room or a stronger concept preset.'],
    nextActions: ['Try a different preset or image.'],
    rationale: 'The current image already presents reasonably well.',
  };
}
```

---

# Required tests

## 1. Missing bestVariant returns completed advisor-only
```ts
test('createImageEnhancementJob completes advisor-only instead of throwing when no preview is selected', async () => {
  // orchestrationResult.bestVariant = null
});
```

## 2. Best-effort candidate is returned instead of empty state
```ts
test('orchestrator returns best-effort preview instead of empty result', async () => {
  // only advisory fallback candidate exists
});
```

## 3. Time budget returns best available candidate
```ts
test('time budget exits with best available preview', async () => {
  // candidate exists before timeout
});
```

## 4. Bright neutral room returns advisor-only without provider calls
```ts
test('bright neutral room exits advisor-only before generation', async () => {
  // shouldSkipPaintGeneration / shouldExitAdvisorOnly
});
```

## 5. True provider crash still returns failure
```ts
test('system failure is reserved for unrecoverable runtime errors', async () => {
  // no candidates, hard exception
});
```

---

# Success criteria

The system passes this redesign when all of the following are true:

- user never waits and then gets nothing unless infrastructure truly failed
- subtle rooms return advisor-only instead of fake failure
- best-effort preview is shown when safe
- strong result is shown when available
- UI never uses failure language for a completed advisory outcome
- `failed` status becomes rare and meaningful

---

# Codex handoff summary

Design a **Never Show Empty Result** system for the vision pipeline. Replace the current fail-on-missing-preview behavior with a delivery ladder that always returns one of: `high_confidence`, `acceptable`, `best_effort_preview`, or `advisor_only`, and reserve `system_failure` only for true infrastructure/runtime failures. Add candidate delivery modes, an advisor-only fallback payload, hard time-budget fallback, low-opportunity early exit, and UI message mapping so the user always receives something useful after processing.

---

# Final recommendation

This is the highest-leverage UX change you can make right now.

It does not require:
- better models
- better prompts
- perfect masks

It only requires:
- correct orchestration policy
- honest UI messaging
- advisor fallback instead of empty-state failure

That will make the feature feel dramatically more reliable immediately.
