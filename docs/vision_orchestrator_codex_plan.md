# Workside Home Advisor — Vision Orchestrator Service (Codex Ready)

## Objective

Build a dedicated orchestration layer that routes image-enhancement jobs across multiple providers, applies fallback logic, enforces plan-based access, and always returns the best available result instead of failing early.

This service becomes the single entry point for:
- declutter
- furniture removal
- flooring changes
- cabinet color changes
- wall paint previews
- exterior upgrade concepts

---

# 1. New Service

Create:

```text
apps/api/src/modules/media/vision-orchestrator.service.js
```

Purpose:
- choose provider sequence
- run provider attempts
- evaluate sufficiency
- apply fallback
- persist orchestration metadata
- return best candidate

---

# 2. High-Level Flow

```text
request
  -> resolve preset + feature tier
  -> build task payload
  -> choose provider chain
  -> run provider 1
  -> evaluate candidate
  -> if sufficient: return
  -> else run provider 2
  -> evaluate
  -> if sufficient: return
  -> else run provider 3
  -> return best available candidate
```

---

# 3. Provider Strategy Table

## Standard plan
Use:
1. local_sharp (if enhancement-only)
2. replicate_basic

Allowed tasks:
- enhance_listing_quality
- declutter_light
- declutter_medium
- combined_listing_refresh

## Pro plan
Use:
1. replicate_basic
2. replicate_advanced

Allowed tasks:
- remove_furniture (partial / object-level)
- paint previews
- flooring previews
- kitchen finish previews

## Premium plan
Use:
1. replicate_basic
2. replicate_advanced
3. openai_edit

Allowed tasks:
- advanced furniture removal
- empty room concept
- full flooring transformations
- cabinet recolors
- exterior feature concepts

---

# 4. Core API

## Exported function

```js
export async function orchestrateVisionJob({
  asset,
  preset,
  roomType,
  instructions = '',
  normalizedPlan = null,
  requestedMode = 'preset',
  userPlan = 'standard',
  sourceBuffer,
  sourceImageBase64,
  existingJob,
})
```

Returns:

```js
{
  providerUsed: 'replicate_basic',
  providerAttemptCount: 2,
  fallbackApplied: true,
  bestVariant: { ... },
  allCandidates: [...],
  orchestration: {
    chain: ['replicate_basic', 'replicate_advanced'],
    attempts: [...]
  }
}
```

---

# 5. Service Skeleton

```js
import { runReplicateInpainting } from './replicate-provider.service.js';
import { runOpenAIImageEdit } from './openai-image.provider.js';
import {
  buildProviderChain,
  buildProviderPayload,
  isCandidateSufficient,
  rankCandidates,
} from './vision-orchestrator.helpers.js';

export async function orchestrateVisionJob(input) {
  const chain = buildProviderChain(input);
  const candidates = [];
  const attempts = [];

  for (const providerKey of chain) {
    const payload = await buildProviderPayload({ ...input, providerKey });

    let providerResults = [];
    if (providerKey === 'replicate_basic' || providerKey === 'replicate_advanced') {
      providerResults = await runReplicateProviderVariant({ ...payload, providerKey });
    } else if (providerKey === 'openai_edit') {
      providerResults = await runOpenAIImageEdit(payload);
    } else if (providerKey === 'local_sharp') {
      providerResults = await runLocalEnhancement(payload);
    }

    const reviewed = await reviewProviderResults({
      providerKey,
      results: providerResults,
      sourceImageBase64: input.sourceImageBase64,
      presetKey: input.preset.key,
      roomLabel: input.asset.roomLabel,
      variantCategory: input.preset.category,
    });

    attempts.push({
      providerKey,
      candidateCount: reviewed.length,
    });

    candidates.push(...reviewed);

    const sufficient = reviewed.find((candidate) =>
      isCandidateSufficient(candidate, input.preset.key)
    );

    if (sufficient) {
      return {
        providerUsed: providerKey,
        providerAttemptCount: attempts.length,
        fallbackApplied: attempts.length > 1,
        bestVariant: sufficient,
        allCandidates: candidates,
        orchestration: { chain, attempts },
      };
    }
  }

  const bestVariant = rankCandidates(candidates, input.preset.key)[0] || null;

  return {
    providerUsed: bestVariant?.providerKey || null,
    providerAttemptCount: attempts.length,
    fallbackApplied: true,
    bestVariant,
    allCandidates: candidates,
    orchestration: { chain, attempts },
  };
}
```

---

# 6. New Helper File

Create:

```text
apps/api/src/modules/media/vision-orchestrator.helpers.js
```

Responsibilities:
- provider-chain resolution
- plan gating
- provider payload shaping
- sufficiency checks
- candidate ranking

---

# 7. Provider Chain Resolution

```js
export function buildProviderChain({ preset, userPlan }) {
  const key = preset.key;

  const enhancementOnly = new Set([
    'enhance_listing_quality',
    'declutter_light',
    'declutter_medium',
    'combined_listing_refresh',
  ]);

  const conceptTier = new Set([
    'remove_furniture',
    'paint_warm_neutral',
    'paint_bright_white',
    'paint_soft_greige',
    'floor_light_wood',
    'floor_medium_wood',
    'floor_dark_hardwood',
    'floor_lvp_neutral',
    'floor_tile_stone',
    'kitchen_white_cabinets_granite',
    'kitchen_white_cabinets_quartz',
    'kitchen_green_cabinets_granite',
    'kitchen_green_cabinets_quartz',
    'exterior_curb_appeal_refresh',
    'backyard_entertaining_refresh',
    'backyard_pool_preview',
  ]);

  if (enhancementOnly.has(key)) {
    return ['local_sharp', 'replicate_basic'];
  }

  if (conceptTier.has(key) && userPlan === 'premium') {
    return ['replicate_basic', 'replicate_advanced', 'openai_edit'];
  }

  if (conceptTier.has(key) && userPlan === 'pro') {
    return ['replicate_basic', 'replicate_advanced'];
  }

  return ['replicate_basic'];
}
```

---

# 8. Replicate Basic vs Advanced

Do NOT treat all Replicate calls the same.

## `replicate_basic`
Use current production settings or slightly relaxed settings.

Good for:
- declutter
- mild concept changes
- partial removal

## `replicate_advanced`
Use:
- more targeted masks
- more inference steps
- slightly higher guidance
- slightly lower strength for preservation tasks
- split-object attempts for furniture removal

Example:

```js
function getReplicateSettings(providerKey, preset) {
  if (providerKey === 'replicate_advanced') {
    return {
      model: preset.replicateModel,
      outputCount: Math.max(3, preset.outputCount || 2),
      guidanceScale: (preset.guidanceScale || 8) + 1,
      numInferenceSteps: (preset.numInferenceSteps || 35) + 8,
      strength: Math.max(0.2, Math.min(0.85, (preset.strength || 0.7) - 0.08)),
    };
  }

  return {
    model: preset.replicateModel,
    outputCount: preset.outputCount || 2,
    guidanceScale: preset.guidanceScale,
    numInferenceSteps: preset.numInferenceSteps,
    strength: preset.strength,
  };
}
```

---

# 9. OpenAI Provider

Create:

```text
apps/api/src/modules/media/openai-image.provider.js
```

Purpose:
- only invoked for premium path
- handles high-value edits
- used when Replicate is insufficient

## Exported function

```js
export async function runOpenAIImageEdit({
  sourceBuffer,
  prompt,
  maskBuffer,
  preset,
  roomType,
  instructions,
})
```

Return normalized array:

```js
[
  {
    providerKey: 'openai_edit',
    outputBuffer,
    providerSourceUrl: null,
    metadata: {
      model: 'gpt-image-1'
    }
  }
]
```

## Codex note
Keep provider outputs normalized so `reviewProviderResults()` can treat all providers the same.

---

# 10. Candidate Review Layer

Create a helper:

```js
export async function reviewProviderResults({
  providerKey,
  results,
  sourceImageBase64,
  presetKey,
  roomLabel,
  variantCategory,
}) {
  // convert buffers to base64
  // call reviewVisionVariant
  // compute custom metrics
  // return normalized candidate objects
}
```

Candidate shape:

```js
{
  providerKey,
  outputBuffer,
  review,
  overallScore,
  visualChangeRatio,
  focusRegionChangeRatio,
  topHalfChangeRatio,
  objectRemovalScore,
  isSufficient,
  metadata: {}
}
```

---

# 11. Sufficiency Logic

## Critical rule
Stop using “hard reject everything” logic.

Use provider-independent sufficiency checks.

```js
export function isCandidateSufficient(candidate, presetKey) {
  if (!candidate) return false;

  if (presetKey === 'remove_furniture') {
    return (
      candidate.focusRegionChangeRatio >= 0.10 &&
      candidate.objectRemovalScore >= 0.18
    );
  }

  if (String(presetKey).startsWith('floor_')) {
    return candidate.focusRegionChangeRatio >= 0.08;
  }

  if (String(presetKey).startsWith('paint_')) {
    return candidate.visualChangeRatio >= 0.06;
  }

  return candidate.overallScore >= 62;
}
```

## Important
A candidate can be sufficient even if it is not perfect.
Prefer “usable” over “failed”.

---

# 12. Ranking Logic

```js
export function rankCandidates(candidates = [], presetKey) {
  return [...candidates].sort((a, b) => {
    if (presetKey === 'remove_furniture') {
      if ((b.objectRemovalScore || 0) !== (a.objectRemovalScore || 0)) {
        return (b.objectRemovalScore || 0) - (a.objectRemovalScore || 0);
      }
      if ((b.focusRegionChangeRatio || 0) !== (a.focusRegionChangeRatio || 0)) {
        return (b.focusRegionChangeRatio || 0) - (a.focusRegionChangeRatio || 0);
      }
    }

    return (b.overallScore || 0) - (a.overallScore || 0);
  });
}
```

---

# 13. Object Removal Score

For `remove_furniture`, add a custom metric:

```js
export function calculateObjectRemovalScore({
  visualChangeRatio = 0,
  focusRegionChangeRatio = 0,
  topHalfChangeRatio = 0,
}) {
  const score =
    focusRegionChangeRatio * 0.55 +
    visualChangeRatio * 0.35 -
    topHalfChangeRatio * 0.15;

  return Number(Math.max(0, score).toFixed(4));
}
```

This is not perfect, but it is much better than rejecting everything for mild spillover.

---

# 14. Plan Gating

Add helper:

```js
export function canUsePremiumVision(userPlan, presetKey) {
  const premiumOnly = new Set([
    'remove_furniture',
    'floor_dark_hardwood',
    'kitchen_white_cabinets_quartz',
    'kitchen_green_cabinets_quartz',
    'exterior_curb_appeal_refresh',
    'backyard_entertaining_refresh',
    'backyard_pool_preview',
  ]);

  return !premiumOnly.has(presetKey) || userPlan === 'premium';
}
```

Use this in controller/service before orchestration.

---

# 15. Integration Point in `media-ai.service.js`

Current `createImageEnhancementJob()` is doing too much.

## Refactor goal
Move provider execution into orchestrator.

### Keep in `media-ai.service.js`
- asset lookup
- plan resolution
- prompt building
- job creation
- variant persistence

### Move out
- provider sequencing
- retry chain
- candidate sufficiency
- fallback routing

## Replace current direct provider block with:

```js
const orchestrationResult = await orchestrateVisionJob({
  asset,
  preset,
  roomType: resolvedRoomType,
  instructions: normalizedInstructions,
  normalizedPlan,
  requestedMode,
  userPlan,
  sourceBuffer: stored.buffer,
  sourceImageBase64,
  existingJob: job,
});

if (!orchestrationResult.bestVariant) {
  throw new Error('No provider produced a usable output.');
}
```

Then persist:
- all candidates if desired
- best variant definitely
- providerUsed
- fallbackApplied
- attempt chain

---

# 16. Persist Orchestration Metadata

Add to job metadata/input/output:

```js
job.input = {
  ...job.input,
  orchestrationChain: orchestrationResult.orchestration.chain,
};

job.message = `Generated via ${orchestrationResult.providerUsed}${orchestrationResult.fallbackApplied ? ' after fallback' : ''}.`;

job.warning = orchestrationResult.fallbackApplied
  ? 'Primary provider was insufficient; fallback provider used.'
  : '';
```

Add to variant metadata:

```js
metadata: {
  provider: orchestrationResult.providerUsed,
  fallbackApplied: orchestrationResult.fallbackApplied,
  orchestrationAttempts: orchestrationResult.orchestration.attempts,
}
```

---

# 17. UI Messaging

## Standard user
“Enhanced with AI.”

## Fallback used
“Enhanced using advanced AI fallback.”

## Premium user
“Premium AI enhancement used for this concept preview.”

Do NOT expose model names in the primary UI.

---

# 18. Cost Tracking

Create lightweight analytics log or collection:

```js
{
  propertyId,
  mediaId,
  presetKey,
  userPlan,
  providerChain: ['replicate_basic', 'replicate_advanced', 'openai_edit'],
  providerUsed: 'openai_edit',
  fallbackApplied: true,
  createdAt: new Date()
}
```

Purpose:
- track fallback frequency
- understand premium cost exposure
- support future monetization decisions

---

# 19. Rollout Plan

## Phase 1
- create orchestrator
- split provider logic
- add replicate_basic + replicate_advanced
- replace hard rejection with sufficiency checks

## Phase 2
- add OpenAI provider
- premium gating
- logging + analytics

## Phase 3
- object-level routing
- segmentation integration
- more deterministic transformations

---

# 20. Final Directive to Codex

Build the orchestrator as the new control layer for all vision tasks.

Priorities:
1. no more early hard-fail behavior
2. always return best available candidate
3. route by provider chain, not one provider
4. keep Replicate for inexpensive tasks
5. reserve OpenAI fallback for premium-value edits
6. make the system cost-aware and plan-aware from day one

The orchestrator is the foundation for:
- better reliability
- better monetization
- better future transformations
