# Drop-in Window Rejection Module (Codex-Ready)
## Workside Advisor Vision Pipeline

---

# Objective

Add a **drop-in window rejection module** that aggressively removes window interiors, blinds, and blown-out exterior light from wall masks before paint generation runs.

This module is specifically designed to fix the current failure mode:

- wall segmentation is mostly working
- but bright / structured window areas still leak into the wall mask
- that causes streaking, banding, repaint bleed, and uneven wall tone near windows

The goal is simple:

- keep wall paint changes on actual painted wall planes
- never repaint windows, blinds, trim, or exterior scenery
- improve consistency for `paint_*` presets without changing provider orchestration

---

# Problem Summary

Your latest outputs show the core wall system is now much better, but window contamination is still the main remaining defect.

Typical symptoms:
- paint streaks inside blinds
- subtle banding near window edges
- inconsistent tone around the bay window
- different repaint intensity across wall sections

This means the wall mask is now good enough to find walls, but still not good enough to **reject windows as non-wall regions**.

---

# Design Principles

The window rejection module should be:

- deterministic
- cheap
- local
- debuggable
- compatible with current semantic wall segmentation
- able to run before provider generation
- safe enough to use on every `paint_*` request

---

# Integration Point

This module should run inside the semantic wall refinement flow:

```ts
semantic wall classification
→ morphology cleanup
→ vertical continuity bridge
→ WINDOW REJECTION MODULE
→ danger-zone suppression
→ component cleanup
→ final wall mask
```

This must happen **before** final wall mask selection and before mask PNG generation.

---

# New Module API

### File: `media-ai.service.js`

Add:

```ts
function buildWindowRejectionMask({
  sourceProbe,
  width,
  height,
  startY,
  endY,
})
```

### Returns:

```ts
{
  binaryMask: Uint8Array,
  debug: {
    coverageRatio: number,
    brightPixelRatio: number,
    structuredPixelRatio: number,
  }
}
```

Then subtract it from the current wall mask:

```ts
current = subtractBinaryMask(current, windowRejection.binaryMask);
```

---

# Why This Works

Windows are visually different from walls in 4 important ways:

1. **Higher brightness**
2. **Higher local structure**
3. **Vertical stripe patterns from blinds**
4. **Rectangular continuity**

Walls are usually:
- smoother
- less structured
- less bright
- more uniform

So the module should explicitly target:
- bright + structured regions
- stripe-like regions
- tall rectangular clusters
- blown-out exterior light zones

---

# PATCH 1 — Core Feature Extraction

### File: `media-ai.service.js`

Add this helper:

```ts
function buildWindowProbeFeatures(sourceProbe, width, height) {
  const luminance = new Float32Array(width * height);
  const horizontalGrad = new Float32Array(width * height);
  const verticalGrad = new Float32Array(width * height);
  const texture = new Float32Array(width * height);
  const stripeScore = new Float32Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 3;
    const r = sourceProbe[offset];
    const g = sourceProbe[offset + 1];
    const b = sourceProbe[offset + 2];
    luminance[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;

      const left = luminance[i - 1];
      const right = luminance[i + 1];
      const up = luminance[i - width];
      const down = luminance[i + width];

      horizontalGrad[i] = Math.abs(left - right);
      verticalGrad[i] = Math.abs(up - down);
      texture[i] = (horizontalGrad[i] + verticalGrad[i]) / 2;

      const verticalStripeSignal =
        Math.abs(left - right) > 14 &&
        Math.abs(up - down) < 10;

      stripeScore[i] = verticalStripeSignal ? 1 : 0;
    }
  }

  return {
    luminance,
    horizontalGrad,
    verticalGrad,
    texture,
    stripeScore,
  };
}
```

---

# PATCH 2 — Build Raw Window Candidate Mask

Add:

```ts
function buildRawWindowCandidateMask({
  features,
  width,
  height,
  startY,
  endY,
}) {
  const binary = new Uint8Array(width * height);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;

      const lum = Number(features.luminance[i] || 0);
      const tex = Number(features.texture[i] || 0);
      const hGrad = Number(features.horizontalGrad[i] || 0);
      const vGrad = Number(features.verticalGrad[i] || 0);
      const stripe = Number(features.stripeScore[i] || 0);

      const isBlownOut = lum > 235;
      const isBrightStructured = lum > 205 && tex > 10;
      const isBlindRegion = lum > 180 && stripe > 0 && hGrad > vGrad * 1.15;
      const isExteriorLightPatch = lum > 215 && tex > 8;

      if (isBlownOut || isBrightStructured || isBlindRegion || isExteriorLightPatch) {
        binary[i] = 1;
      }
    }
  }

  return binary;
}
```

---

# PATCH 3 — Rectangular Window Consolidation

The raw candidate mask will be noisy. Windows need to become **solid regions**.

Add:

```ts
function consolidateWindowRegions(binaryMask, width, height) {
  let current = new Uint8Array(binaryMask);

  current = closeBinaryMask(current, width, height, 1);
  current = fillBinaryMaskHoles(current, width, height);

  current = filterBinaryMaskComponents(current, width, height, {
    minArea: Math.max(60, Math.round(width * height * 0.004)),
    minBoxWidth: Math.max(6, Math.round(width * 0.05)),
    minBoxHeight: Math.max(10, Math.round(height * 0.16)),
  });

  current = dilateBinaryMask(current, width, height, 1);

  return current;
}
```

### Why
This turns:
- thin bright stripes
- partial blind detections
- broken bright patches

into:
- unified window rejection regions

---

# PATCH 4 — Final Window Rejection Builder

Now add the main entry point:

```ts
function buildWindowRejectionMask({
  sourceProbe,
  width,
  height,
  startY,
  endY,
}) {
  const features = buildWindowProbeFeatures(sourceProbe, width, height);

  const rawMask = buildRawWindowCandidateMask({
    features,
    width,
    height,
    startY,
    endY,
  });

  const finalMask = consolidateWindowRegions(rawMask, width, height);

  const brightPixelCount = Array.from(features.luminance).filter((value) => value > 205).length;
  const structuredPixelCount = Array.from(features.texture).filter((value) => value > 10).length;

  return {
    binaryMask: finalMask,
    debug: {
      coverageRatio: calculateBinaryMaskCoverageRatio(finalMask),
      brightPixelRatio: Number((brightPixelCount / Math.max(1, width * height)).toFixed(4)),
      structuredPixelRatio: Number((structuredPixelCount / Math.max(1, width * height)).toFixed(4)),
    },
  };
}
```

---

# PATCH 5 — Plug Into Semantic Wall Refinement

### File: `media-ai.service.js`

Inside `refineSemanticWallMask(...)`, replace the current window suppression block with:

```ts
const windowRejection = buildWindowRejectionMask({
  sourceProbe,
  width,
  height,
  startY: Math.round(height * 0.08),
  endY: Math.round(height * 0.8),
});

current = subtractBinaryMask(current, windowRejection.binaryMask);

stage(
  'semantic_after_window_rejection',
  current,
  'After drop-in window rejection removed blinds, bright window interiors, and exterior light patches.',
);
```

---

# PATCH 6 — Add Debug Logging

Add:

```ts
console.info('vision_window_rejection_debug', {
  presetKey,
  roomType,
  coverageRatio: windowRejection.debug.coverageRatio,
  brightPixelRatio: windowRejection.debug.brightPixelRatio,
  structuredPixelRatio: windowRejection.debug.structuredPixelRatio,
});
```

### Why
This gives you direct insight into:
- whether the module is firing
- whether it is too weak or too aggressive
- how much of the image is being removed as “window”

---

# PATCH 7 — Save Debug Artifacts

Save:

- `window_rejection_raw.png`
- `window_rejection_final.png`
- `window_rejection_overlay.png`

Store in debug metadata:

```ts
metadata.debug = {
  ...(metadata.debug || {}),
  windowRejectionCoverageRatio: windowRejection.debug.coverageRatio,
  windowBrightPixelRatio: windowRejection.debug.brightPixelRatio,
  windowStructuredPixelRatio: windowRejection.debug.structuredPixelRatio,
}
```

This is extremely useful when a room has:
- plantation shutters
- strong sunlight
- tall bay windows
- overexposed exterior view

---

# PATCH 8 — Safety Guardrails

To prevent over-removal:

```ts
if (windowRejection.debug.coverageRatio > 0.32) {
  logger.warn('Window rejection mask is unusually large; clipping to safer threshold', {
    coverageRatio: windowRejection.debug.coverageRatio,
  });
}
```

Optional clamp strategy:
- if rejection coverage too large, erode once before subtracting

```ts
if (windowRejection.debug.coverageRatio > 0.32) {
  finalMask = erodeBinaryMask(finalMask, width, height, 1);
}
```

---

# PATCH 9 — Recommended Thresholds

Start with these defaults:

```ts
blownOutThreshold = 235
brightStructuredThreshold = 205
textureThreshold = 10
blindBrightnessThreshold = 180
blindStripeDeltaThreshold = 14
```

### Tuning notes
If windows still leak:
- lower bright threshold to 198
- lower blind threshold to 172

If too much wall gets removed:
- raise structured threshold to 12
- raise stripe threshold to 16

---

# PATCH 10 — Tests

### File: `media-ai.service.test.js`

Add:

```ts
test('window rejection identifies bright structured window interiors', () => {
  // synthetic bright-window fixture
});

test('window rejection suppresses blind-like stripe regions', () => {
  // synthetic blinds pattern
});

test('window rejection does not remove smooth wall surfaces', () => {
  // synthetic wall patch
});

test('semantic wall refinement subtracts window rejection before final mask selection', () => {
  // integration-level refinement test
});
```

---

# Expected Result

After this module is added, your wall previews should improve in the exact areas still causing problems:

### Before
- blinds partially repainted
- bright exterior light leaks into wall mask
- banding near window edges
- uneven wall tone across bay window

### After
- windows excluded completely
- cleaner wall repaint
- smoother tone continuity
- no repaint streaks inside blinds
- stronger confidence that wall changes are real and controlled

---

# Product Impact

This module is a **high-leverage drop-in improvement** because it fixes the most visible remaining defect in your wall pipeline without requiring:
- provider changes
- prompt changes
- orchestration changes
- retry loop changes

It improves:
- realism
- control
- consistency
- buyer-facing trust

That is exactly what your product needs.

---

# Codex Handoff Summary

Implement a **drop-in window rejection module** that identifies bright structured window interiors, blind-like stripe regions, and blown-out exterior light patches, consolidates them into stable window masks, and subtracts them from semantic wall masks before final wall paint generation. Add debug logging, saved debug artifacts, and conservative safety guardrails. Keep it fully local, deterministic, and compatible with the existing semantic wall segmentation and scoring pipeline.

---

# Final Recommendation

Do this immediately before further tuning wall prompts.

At this point, your main visible defect is window contamination, not provider weakness or prompt wording. Once windows are reliably excluded, the wall system should look dramatically cleaner and much more production-ready.
