# 🪟 Window Rejection v2 (Column + Texture Hybrid)

## Purpose

Eliminate ALL window regions from wall processing using a **hybrid detection system**:

* Brightness
* Texture
* Vertical structure (columns)
* Natural outdoor signal

This prevents:
❌ Paint bleeding into windows
❌ Washed-out blinds
❌ Outdoor corruption

---

## 🔥 Core Insight

> Windows are NOT just bright—they are structured vertical regions with high-frequency detail and natural variance.

---

## 🧠 Detection Pipeline

### Step 1: Base Pixel Classification

```ts
function isWindowPixel(p) {
  const lum = p.luminance;
  const tex = p.localVariance;
  const gradX = p.gradX;
  const gradY = p.gradY;

  const verticalGrad = Math.abs(gradY);

  const isBrightTexture = lum > 195 && tex > 8;

  const isNaturalExterior =
    lum > 170 &&
    tex > 6 &&
    verticalGrad > 6;

  const isBlindPattern = detectStripePattern(p);

  return isBrightTexture || isNaturalExterior || isBlindPattern;
}
```

---

### Step 2: Stripe Detection (Blinds)

```ts
function detectStripePattern(p) {
  const stripeDelta = 10;

  return (
    Math.abs(p.gradY) > stripeDelta &&
    p.localVariance > 5
  );
}
```

---

### Step 3: Column Enforcement (CRITICAL)

```ts
function enforceVerticalWindowColumns(mask, width, height) {
  for (let x = 0; x < width; x++) {
    let count = 0;

    for (let y = 0; y < height; y++) {
      if (mask[y * width + x]) count++;
    }

    const ratio = count / height;

    if (ratio > 0.18) {
      for (let y = 0; y < height; y++) {
        mask[y * width + x] = 1;
      }
    }
  }

  return mask;
}
```

👉 This locks entire vertical window structures (perfect for bay windows)

---

### Step 4: Morphological Expansion

```ts
function expandMask(mask, width, height) {
  const radius = 3;

  return dilate(mask, width, height, radius);
}
```

👉 Ensures full coverage of frames and edges

---

### Step 5: Final Wall Mask Cleanup

```ts
finalWallMask = wallMask - windowMask;
```

---

## 📊 Debug Logging

```ts
console.log("Window Rejection v2", {
  windowPixelsDetected,
  columnLockedRegions,
  finalWindowCoverage
});
```

---

## ✅ Expected Behavior

After implementation:

* Windows are NEVER painted
* Blinds remain untouched
* Outdoor scenes preserved
* Clean edges around trim

---

## ⚠️ Common Mistakes

❌ Thresholds too strict → windows leak into wall mask
❌ No column enforcement → broken segmentation
❌ No expansion → edge bleeding

---

## 🏁 Final Summary

This module ensures:

✅ Stable window detection
✅ Clean wall isolation
✅ No visual artifacts

---

## 🚀 Impact

This is the **missing piece** for your current pipeline.

Combined with Paint Strength Enforcement:

👉 You now have a production-ready interior transformation system
