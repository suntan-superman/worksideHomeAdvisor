# Workside Home Advisor — Furniture Removal Code Review Findings for Codex

## Executive Summary

I reviewed the current furniture-removal pipeline and the regression is not primarily a UI problem. The core issue is that the backend is still running a workflow that is heavily optimized for safety and rejection, but it is not actually optimized for successful subtraction of furniture on the provided living-room photo.

The system is now doing a lot of analysis, masking, retries, drift checks, and fallback logic, but the actual inpainting path still appears too weak and too broad to remove furniture reliably. In practical terms, the code is sophisticated, but the model is still being asked to solve the hardest possible edit with a mask strategy and model choice that are not strong enough.

## Key Findings

### 1. The selected model is still too weak for this job

You are using `lucataco/sdxl-inpainting` through `runReplicateInpainting()` and the preset catalog. That model can do basic inpainting, but furniture removal in real estate interiors is one of the most failure-prone use cases. The current implementation is asking it to preserve room structure while removing large dark furniture clusters in a sunlit living room. That is a very hard request for this model. fileciteturn18file1 fileciteturn18file2

### 2. The mask strategy is still too broad and too heuristic

The code builds a furniture-removal mask by combining:
- static room-shape masks
- adaptive segmentation heuristics
- connected-region extraction
- split-region retries

That sounds good on paper, but the actual living-room image still has:
- dark furniture
- overlapping furniture
- a reflective glass coffee table
- patterned rug
- strong window light

Those conditions make the current heuristic mask logic unreliable. In particular, the adaptive furniture mask is based on luminance/color-distance rules and not true semantic segmentation. That means it can miss furniture edges, include floor/rug regions, or create mixed target regions that are not clean object masks. fileciteturn18file0

### 3. The retry chain exists, but it is still retrying the same weak move

The retry path changes:
- strength
- guidance scale
- mask region
- prompt suffix

but it does not change the underlying capability of the edit engine. You are retrying the same model family with modest variations instead of switching to a stronger object-removal strategy. fileciteturn18file0

### 4. The pipeline is rewarding safe but unchanged outputs

For `remove_furniture`, the code penalizes drift very aggressively, which is good for structure preservation, but it still allows the system to prefer candidates that did very little real subtraction. The result is that the safest outputs can still look almost unchanged while technically surviving parts of the review logic. fileciteturn18file0

### 5. The prompt is not the main bottleneck anymore

The `remove_furniture` prompt is already fairly strict:
- do not change layout
- do not modify walls/floors/windows
- do not add objects
- return original unchanged if unsafe

That is not the main problem now. The bigger problem is model capability plus target-mask quality. More prompt tuning alone will not fix this. fileciteturn18file2

## What Is Probably Happening

For the current living-room example, the system is likely:

1. building a broad or imperfect furniture mask
2. sending that to the generic SDXL inpainting model
3. receiving outputs that mostly preserve the furniture
4. rejecting outputs that drift too much
5. keeping only outputs that are safe but still not meaningfully subtractive

That matches the screenshots: the furniture remains, the room structure stays intact, and the edit looks like a near-original image rather than a successful removal.

## Exact Recommendations for Codex

### Recommendation 1 — Create a dedicated object-removal strategy
Do not keep `remove_furniture` on the same generic inpainting path as declutter and finish concepts. Add a separate strategy for furniture removal and route by strategy instead of only by provider preference. fileciteturn18file1 fileciteturn18file2

### Recommendation 2 — Stop defaulting to whole-room furniture removal
Move to explicit object-level targeting:
- coffee table
- left chair
- right chair
- side table
- sofa section

Each selected object should become its own mask and its own job. The current whole-room concept is too broad.

### Recommendation 3 — Reject near-original outputs
For `remove_furniture`, a result should fail if the target object silhouette is still clearly present. Add stronger post-checks for:
- unchanged dark-object footprint
- unchanged table/chair silhouette
- masked-region occupancy staying nearly the same

### Recommendation 4 — Test coffee-table-only removal first
The coffee table in your example is the easiest isolated object in the room. If the current provider path cannot remove the coffee table reliably, it should not be trusted for sofas or full-room removal.

### Recommendation 5 — Keep broad empty-room generation as a separate concept mode
Split the feature into:
1. `remove_small_object`
2. `remove_single_large_object`
3. `empty_room_concept`

Right now all of those are being forced through one `remove_furniture` path.

## Concrete Code Changes

### A. In `vision-presets.js`
Keep the preset, but add strategy metadata like:

```js
providerStrategy: 'object_removal'
```

Then route furniture removal differently from standard inpainting. fileciteturn18file2

### B. In `replicate-provider.service.js`
Refactor the provider layer into:
- `runReplicateGenericInpainting()`
- `runReplicateFurnitureRemoval()`

Even if both still hit Replicate initially, separate the execution paths now so they can evolve independently. fileciteturn18file1

### C. In `media-ai.service.js`
For `remove_furniture`:
1. bypass broad whole-room masks by default
2. require object-level mask list
3. run one-object-at-a-time jobs
4. merge only successful removals
5. if removal fails, return explicit failure for that object instead of a misleading near-original result

The current code is advanced, but it is still solving the wrong problem shape for this model. fileciteturn18file0

## Final Directive to Codex

Implement in this order:

1. create a dedicated `object_removal` strategy
2. stop defaulting to broad furniture masks
3. require object-level selection/masking
4. reject near-original outputs for furniture-removal jobs
5. validate with coffee-table-only removal first
6. only after object-level removal works, reintroduce broader empty-room concepts

## Bottom Line

The regression is not because nothing is happening.
It is because:
- the provider/model path is too weak for large furniture subtraction
- the mask generation is still too ambiguous
- the success criteria favor safe-but-unchanged outputs
- the product is still treating furniture removal as a broad room-level edit instead of object-level subtraction
