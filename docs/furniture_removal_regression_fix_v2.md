# 🚨 Furniture Removal Regression Fix (Codex Spec)

## Problem Summary

We have regressed from:
- ✅ Partial furniture removal working
To:
- ❌ Zero furniture removal (always fallback to "Need safer selection")

### Observed Behavior
- System immediately triggers `guided_selection`
- No attempts at actual removal
- No partial success

---

# 🎯 Root Cause (Very Likely)

## 1. Over-aggressive Safety Gating
Your pipeline is **failing too early**:
- mask too large → immediate rejection
- no retry attempted
- no partial execution

## 2. Retry Logic Not Executing
Pipeline is likely:
```
validate → FAIL → fallback
```
Instead of:
```
validate → TRY → retry → partial → fallback
```

## 3. Mask Splitting Not Running
Entire room treated as ONE mask:
- couches + table + chairs = one job
- model refuses → full failure

---

# ✅ REQUIRED FIXES

---

# 1. Fix Validation Logic (CRITICAL)

## ❌ Current (bad)
```ts
if (maskArea > 0.45) {
  return guidedSelection;
}
```

## ✅ Replace with:
```ts
if (maskArea > 0.45) {
  allowProcessing = true;
  forceSplit = true;
}
```

👉 NEVER block execution at validation stage  
👉 Only influence STRATEGY

---

# 2. Enforce Retry Execution

## Add hard guarantee:
```ts
if (attemptCount === 0) {
  MUST_RUN_ATTEMPT_1 = true;
}
```

## Pipeline MUST be:
```
Attempt 1 → Attempt 2 → Attempt 3 → THEN fallback
```

---

# 3. Force Mask Splitting BEFORE Attempt 1

## Add:
```ts
if (maskArea > 0.25 || detectedObjects > 1) {
  masks = splitMask(mask);
}
```

## Minimum requirement:
- Each mask ≈ single object cluster
- Max 3–5 masks per image

---

# 4. Add Partial Success Mode (THIS IS MISSING)

## Current issue:
If 1 fails → whole job fails

## Fix:
```ts
successfulMasks = []
failedMasks = []

for (mask of masks) {
  result = runEnhancement(mask)

  if (result.success) {
    successfulMasks.push(result)
  } else {
    failedMasks.push(mask)
  }
}

if (successfulMasks.length > 0) {
  return PARTIAL_SUCCESS
}
```

---

# 5. Fix Fallback Trigger Timing

## ❌ Current:
Fallback too early

## ✅ Correct:
Fallback ONLY after:
- all retries exhausted
- AND no masks succeeded

---

# 6. Relax Quality Guardrails (Temporarily)

You likely added stricter checks.

## Adjust:
```ts
ALLOW_MINOR_ARTIFACTS = true
ALLOW_SMALL_LAYOUT_DRIFT = true
```

## Only block:
- full scene replacement
- major geometry changes

---

# 7. Logging (You NEED this)

Add logs:

```ts
log({
  maskArea,
  splitCount,
  attempt,
  result: "success" | "fail",
  reason
})
```

---

# 🔁 Correct Pipeline Flow

```
1. receive request
2. analyze mask
3. split mask (if needed)
4. run attempt 1 (ALL masks)
5. retry failed masks
6. collect successes
7. if any success → return partial
8. else → fallback
```

---

# 🧠 Expected Behavior After Fix

### Your Example Room

Instead of:
❌ "Need safer selection"

You get:
✅ couch removed  
❌ chairs remain  
➡ "Partial success achieved"

---

# 🚀 Priority Fix Order

1. REMOVE early validation block ❗
2. FORCE attempt execution
3. ENABLE mask splitting
4. ADD partial success return
5. DELAY fallback trigger

---

# 🧪 Quick Test

Use your exact image:

Expected result:
- coffee table removed OR
- one couch removed

If NOTHING removed → still broken

---

# 💬 Final Directive to Codex

> “Do not prioritize safety over execution.  
> Always attempt, then degrade gracefully.”

---

If you want next level after this:
I can give you:
- exact mask splitting algorithm (OpenCV / JS)
- object detection assist (segment-anything style)
- prompt tuning for furniture removal

Just say the word.
