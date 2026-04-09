# Workside Home Advisor — Performance Optimization + Next-Level Removal Plan

## 🎯 Objective

Now that the pipeline is producing strong results, this phase focuses on:

1. Dramatically reducing execution time
2. Increasing consistency of object removal
3. Moving toward production-grade reliability

---

# 🚀 PART 1 — PERFORMANCE OPTIMIZATION

## 1. Early Exit (CRITICAL)

### Problem
Pipeline continues running even after a good result is found.

### Fix

```js
for (const candidate of reviewed) {
  if (isCandidateSufficient(candidate, presetKey)) {
    return candidate;
  }
}
```

### Impact
- Reduces runtime by up to 70%
- Eliminates unnecessary provider calls

---

## 2. Limit Attempts Per Provider

```js
const MAX_ATTEMPTS = {
  replicate_basic: 2,
  replicate_advanced: 2,
  openai_edit: 1
};
```

---

## 3. Reduce Output Count

```js
outputCount = 1 or 2
```

---

## 4. Add Result Caching

Key:
image_hash + preset_key

---

## 5. Timeout Protection

```js
const MAX_EXECUTION_TIME = 120000;
```

---

# 🔥 PART 2 — NEXT-LEVEL OBJECT REMOVAL

## Core Principle

Remove objects one at a time instead of all at once.

---

## Multi-Pass Strategy

1. Split image into regions
2. Process each region independently
3. Merge results sequentially

---

## Region Example

```js
[
  "center_floor",
  "left_seating",
  "right_seating"
]
```

---

## Object Removal Order

1. Coffee table
2. Small items
3. Chairs
4. Couch

---

## Adaptive Retry

```js
retry({
  strength: lower,
  guidance: higher,
  mask: tighter
});
```

---

## Acceptance Criteria

```js
focusRegionChange > 0.10
```

---

# ⚙️ IMPLEMENTATION PHASES

Phase 1:
- early exit
- attempt limits
- reduce outputs

Phase 2:
- multi-pass removal
- region masking

Phase 3:
- segmentation (SAM)

---

# 💰 MONETIZATION

Standard:
- enhancement

Pro:
- partial removal

Premium:
- full transformations

---

# 🚀 EXPECTED RESULT

- Runtime: 300s → 60–120s
- More consistent removal
- Better UX

---

END OF FILE
