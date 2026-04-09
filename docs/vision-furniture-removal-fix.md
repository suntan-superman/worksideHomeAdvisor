# Workside Home Advisor — Vision Pipeline Fix (Furniture Removal)

## Objective

Fix regression where **no furniture is being removed** due to overly strict validation and rejection logic.

Restore behavior where:

* Partial removals are accepted
* Best candidate is selected (not rejected)
* Pipeline produces usable outputs instead of failing

---

## Root Cause

Current pipeline is **over-rejecting valid outputs** due to:

1. Strict thresholds:

   * focusRegionChangeRatio too high
   * topHalfChangeRatio too low tolerance

2. Hard rejection logic:

   * Valid outputs are discarded before selection

3. Misaligned success criteria:

   * System expects "perfect removal"
   * Reality: model produces **partial removal**

---

## REQUIRED CHANGES

---

# 1. RELAX THRESHOLDS

## File:

media-ai.service.js

### FIND:

```js
if (focusRegionChangeRatio < 0.14)
```

### REPLACE WITH:

```js
if (focusRegionChangeRatio < 0.08)
```

---

### FIND:

```js
if (topHalfChangeRatio > 0.16)
```

### REPLACE WITH:

```js
if (topHalfChangeRatio > 0.22)
```

---

## WHY

* Allows partial object removal
* Prevents valid candidates from being rejected
* Reduces over-sensitivity to minor structural drift

---

# 2. DISABLE HARD REJECTION (CRITICAL FIX)

## FIND BLOCK:

```js
if (rejectForArchitecturalDrift) {
  rejectedCandidates.push({
    index,
    output,
    buffer,
    review,
    overallScore,
    visualChangeRatio,
    focusRegionChangeRatio,
    topHalfChangeRatio,
    roomPromptAddon,
    presetPromptAddon,
  });
  continue;
}
```

---

## REPLACE WITH:

```js
if (rejectForArchitecturalDrift) {
  // DO NOT reject — downgrade score instead
  overallScore = Math.max(0, overallScore - 15);
}
```

---

## WHY

Previously:

* Good outputs thrown away ❌

Now:

* All outputs kept
* Lower-quality ones ranked lower ✅

---

# 3. REMOVE FAILURE CONDITION

## FIND:

```js
if (!createdVariants.length) {
  throw new Error(...)
}
```

---

## REPLACE WITH:

```js
if (!createdVariants.length && rejectedCandidates.length) {
  // fallback to best rejected candidate
  const fallback = rejectedCandidates.sort((a, b) => {
    return b.focusRegionChangeRatio - a.focusRegionChangeRatio;
  })[0];

  createdVariants.push(fallback);
}
```

---

## WHY

* Prevents total failure
* Always returns best available result

---

# 4. ADJUST SCORING (IMPORTANT)

## FIND:

```js
if (visualChangeRatio < 0.22) {
  overallScore = Math.max(0, overallScore - 22);
}
```

---

## REPLACE WITH:

```js
if (visualChangeRatio < 0.15) {
  overallScore = Math.max(0, overallScore - 10);
}
```

---

## FIND:

```js
if (focusRegionChangeRatio < 0.2) {
  overallScore = Math.max(0, overallScore - 28);
}
```

---

## REPLACE WITH:

```js
if (focusRegionChangeRatio < 0.12) {
  overallScore = Math.max(0, overallScore - 12);
}
```

---

## WHY

* Prevents over-penalizing good results
* Allows "some removal" to be considered success

---

# 5. ADD DEBUG LOGGING (TEMP)

## ADD AFTER VARIANT GENERATION LOOP:

```js
console.log("VISION DEBUG:", {
  visualChangeRatio,
  focusRegionChangeRatio,
  topHalfChangeRatio,
  overallScore
});
```

---

## WHY

You need visibility into:

* Why candidates are failing
* What thresholds actually look like in real data

---

# EXPECTED RESULT AFTER FIX

Before:
❌ 0 objects removed
❌ pipeline rejects all outputs
❌ user sees failure

After:
✅ coffee tables removed
✅ some chairs removed
✅ couch may remain (acceptable)
✅ pipeline always returns usable result

---

# IMPORTANT DESIGN PRINCIPLE

Furniture removal is NOT binary.

DO NOT optimize for:
❌ "perfect empty room"

OPTIMIZE for:
✅ "visibly improved room"

---

# NEXT PHASE (DO NOT IMPLEMENT YET)

After this fix stabilizes:

* Multi-pass removal (object-by-object)
* Smart mask segmentation
* Retry logic per region

---

# FINAL NOTE

DO NOT:

* Change models
* Rewrite prompts
* Replace Replicate

THIS IS A VALIDATION LAYER PROBLEM — NOT A MODEL PROBLEM.

---

# EXECUTION INSTRUCTIONS FOR CODEX

1. Apply all threshold changes
2. Remove hard rejection logic
3. Replace with score downgrades
4. Ensure fallback always returns at least 1 variant
5. Add debug logging
6. Run test image

---

# SUCCESS CRITERIA

* At least ONE furniture object removed
* No "variant generation failed"
* Always returns image

---

END OF FILE
