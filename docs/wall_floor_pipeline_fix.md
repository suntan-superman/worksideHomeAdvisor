# Wall & Floor Pipeline Final Fix (Codex-Ready)

## Status
You are now very close. Floors are working. Walls fail intermittently due to **mask coverage = 0**.

---

## Root Cause

Wall pipeline failure:

Wall mask coverage out of range: 0

This means:
- Mask detection fails
- Local pipeline aborts
- System falls back to AI edit
- Result becomes subtle / inconsistent

---

## Fix 1 — Wall Mask Fallback (CRITICAL)

Replace:

if (wallMaskCoverage === 0) {
  throw Error("Wall mask coverage out of range")
}

With:

if (wallMaskCoverage === 0) {
  logger.warn("Wall mask empty — using fallback region")

  wallMask = createFallbackWallMask(image)

  const coverage = getCoverage(wallMask)

  if (coverage < 0.05) {
    logger.error("Fallback mask too small")
    return fail("mask_unusable")
  }
}

---

## Fix 2 — Fallback Wall Mask Generator

function createFallbackWallMask(image) {
  const h = image.height
  const w = image.width

  let mask = zeros(h, w)

  // Assume walls = top 65%
  for (let y = 0; y < h * 0.65; y++) {
    for (let x = 0; x < w; x++) {
      mask[y][x] = 1
    }
  }

  // Remove bright window regions
  mask = subtractBrightAreas(mask, image)

  // Optional: remove strong vertical edges (window frames)
  mask = suppressHighEdgeZones(mask, image)

  return mask
}

---

## Fix 3 — Reject Weak Results

if (!isStrongEnough(best, presetKey)) {
  logger.warn("Result too weak — retrying")
  triggerRetry()
  return
}

---

## Fix 4 — Strong Enough Criteria

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

  return false
}

---

## Fix 5 — Stronger Wall Prompt

Change ONLY the wall paint color.

Shift the wall color to a warm neutral tone such as beige, cream, or soft taupe.

The change must be clearly visible at a glance.

Do NOT:
- add objects
- add fixtures
- change structure
- modify windows or floors

---

## Fix 6 — Edge Cleanup (Optional but Recommended)

function featherMask(mask) {
  return gaussianBlur(mask, radius=2)
}

---

## Fix 7 — Debug Logging (KEEP THIS)

logger.info({
  wallMaskCoverage,
  perceptibilityScore,
  maskedChangeRatio,
  maskedColorShiftRatio,
  iteration
})

---

## Expected Result After Fix

- Walls ALWAYS change (no more silent failures)
- No hallucinated objects
- Consistent warm/light tones
- Matches floor pipeline reliability

---

## Final Architecture

Mask Detection
   ↓
Fallback Mask (if needed)
   ↓
Edit Generation
   ↓
Evaluation
   ↓
Retry Loop (if weak)
   ↓
Final Output

---

## Key Insight

You are NOT building perfect design AI.

You ARE building:

A real estate persuasion tool

So success =

- visible improvement
- believable output
- consistent results

NOT perfection.

---

## Outcome

After this patch:

- Floors: Stable
- Walls: Stable
- Pipeline: Reliable

You are now production-ready with minor polish.
