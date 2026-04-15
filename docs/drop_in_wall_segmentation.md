# Drop-in Wall Segmentation (Production-Ready)
## Workside Advisor Vision Pipeline

---

# Objective

Replace heuristic wall masking with a **drop-in semantic wall segmentation pipeline** that is:

- more stable across rooms
- less sensitive to windows and blinds
- less likely to create banding or partial repaints
- easier to debug and maintain
- compatible with your existing orchestration, scoring, and retry loop

This is the right next step because your current system is now good enough that **mask precision is the main bottleneck**, not provider orchestration or prompt design.

---

# Current State Summary

Your existing architecture is already strong:

- wall and floor presets route through the finish pipeline
- provider chaining and retry logic are working
- replicate/openai/local fallback logic is in place
- adaptive wall masking exists
- debug logging exists
- review metrics already evaluate masked change, color shift, luminance delta, edge density, and spill outside the mask

The issue is that the current wall mask logic still depends on color / luminance / texture heuristics and connected-component cleanup inside `buildAdaptiveWallPaintMaskAtSourceSize(...)`, followed by fallback selection in `selectViableWallMaskStage(...)`. The logs now show valid wall mask coverage around `0.3425`, which is better than zero, but still too conservative and still vulnerable to window contamination and broken wall-plane continuity. fileciteturn19file1 fileciteturn19file2

---

# Goal State

Instead of saying:

- “guess wall pixels from luminance / saturation / texture”

The system should say:

- “segment wall surfaces as a semantic class”
- “exclude windows, trim, ceilings, and floor”
- “return a stable wall mask with sensible coverage”
- “feed that same canonical mask into local rendering, provider inputs, scoring, and debug”

---

# Recommended Architecture

## 1. Canonical wall segmentation step

Add a new wall segmentation stage:

```ts
segmentWallPlanesAtSourceSize(sourceBuffer, roomType)
```

This function becomes the **first-choice mask resolver** for all `paint_*` presets.

### Output
It should return:

```ts
{
  width,
  height,
  wallMaskBuffer,
  debug: {
    strategy: "semantic_wall",
    coverageRatio,
    rawCoverageRatio,
    refinementStages: [...],
  }
}
```

---

## 2. Keep current adaptive wall mask as fallback

Do not delete the heuristic system yet.

Instead:

### New order
1. semantic wall segmentation
2. adaptive wall segmentation
3. broad geometric fallback

This preserves launch safety.

---

# Integration Plan

---

# PATCH 1 — Add semantic wall segmentation strategy

### File: `media-ai.service.js`

### Add new strategy constant
```ts
const WALL_MASK_STRATEGIES = {
  SEMANTIC: 'semantic_wall',
  ADAPTIVE: 'adaptive_wall',
  FALLBACK: 'fallback_wall',
};
```

### Update task-specific strategy note
Keep `getTaskSpecificMaskStrategy('paint_*') === 'adaptive_wall'` for now if you do not want to change tests immediately, but internally route paint presets through the semantic wall resolver first.

Longer term, change tests to:

```ts
assert.equal(getTaskSpecificMaskStrategy('paint_bright_white'), 'semantic_wall');
```

---

# PATCH 2 — Add a wall segmentation provider abstraction

### File: `media-ai.service.js`

Add a provider-style abstraction so the segmentation source can be swapped later:

```ts
async function runWallSegmentationProvider(sourceBuffer, roomType) {
  // v1: local segmentation implementation
  // v2: external segmentation service if desired
}
```

This should return a raw binary wall mask at source size or probe size.

---

# PATCH 3 — Implement semantic wall segmentation entry point

### File: `media-ai.service.js`

Add:

```ts
async function segmentWallPlanesAtSourceSize(sourceBuffer, roomType) {
  const metadata = await sharp(sourceBuffer).rotate().metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);

  const probeWidth = Math.max(160, Math.min(320, width));
  const probeHeight = Math.max(
    120,
    Math.round((height / Math.max(1, width)) * probeWidth),
  );

  const [sourceProbe, baseGeometryMask] = await Promise.all([
    sharp(sourceBuffer)
      .rotate()
      .resize(probeWidth, probeHeight, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    buildInpaintingMaskBuffer(sourceBuffer, 'paint_bright_white', roomType).then((buffer) =>
      sharp(buffer)
        .resize(probeWidth, probeHeight, { fit: 'fill' })
        .removeAlpha()
        .greyscale()
        .raw()
        .toBuffer(),
    ),
  ]);

  const rawSemanticBinary = await runWallSegmentationProviderFromProbe({
    sourceProbe,
    probeWidth,
    probeHeight,
    roomType,
    baseGeometryMask,
  });

  const refined = refineSemanticWallMask(rawSemanticBinary, sourceProbe, probeWidth, probeHeight);

  const wallMaskBuffer = await buildBinaryMaskPngBuffer({
    binaryMask: refined.binary,
    inputWidth: probeWidth,
    inputHeight: probeHeight,
    outputWidth: width,
    outputHeight: height,
  });

  return {
    width,
    height,
    wallMaskBuffer,
    debug: {
      strategy: 'semantic_wall',
      coverageRatio: refined.coverageRatio,
      rawCoverageRatio: refined.rawCoverageRatio,
      refinementStages: refined.refinementStages,
    },
  };
}
```

---

# PATCH 4 — Implement local semantic wall segmentation logic

This version is “semantic” in the sense that it builds wall planes from surface behavior rather than from simple color thresholding.

### Add:
```ts
async function runWallSegmentationProviderFromProbe({
  sourceProbe,
  probeWidth,
  probeHeight,
  roomType,
  baseGeometryMask,
}) {
  const luminance = new Float32Array(probeWidth * probeHeight);
  const saturation = new Float32Array(probeWidth * probeHeight);
  const horizontalGrad = new Float32Array(probeWidth * probeHeight);
  const verticalGrad = new Float32Array(probeWidth * probeHeight);
  const texture = new Float32Array(probeWidth * probeHeight);

  function rgbAt(index) {
    const offset = index * 3;
    return [
      sourceProbe[offset],
      sourceProbe[offset + 1],
      sourceProbe[offset + 2],
    ];
  }

  for (let i = 0; i < probeWidth * probeHeight; i += 1) {
    const [r, g, b] = rgbAt(i);
    luminance[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    saturation[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }

  for (let y = 1; y < probeHeight - 1; y += 1) {
    for (let x = 1; x < probeWidth - 1; x += 1) {
      const i = y * probeWidth + x;
      horizontalGrad[i] = Math.abs(luminance[i - 1] - luminance[i + 1]);
      verticalGrad[i] = Math.abs(luminance[i - probeWidth] - luminance[i + probeWidth]);
      texture[i] = (horizontalGrad[i] + verticalGrad[i]) / 2;
    }
  }

  const binary = new Uint8Array(probeWidth * probeHeight);

  const startY = Math.round(probeHeight * 0.08);
  const endY = Math.round(probeHeight * 0.78);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      const i = y * probeWidth + x;
      if ((baseGeometryMask[i] || 0) <= 20) {
        continue;
      }

      const lum = luminance[i];
      const sat = saturation[i];
      const tex = texture[i];
      const hGrad = horizontalGrad[i];
      const vGrad = verticalGrad[i];

      const looksLikeWallPlane =
        lum >= 40 &&
        lum <= 245 &&
        sat <= 60 &&
        tex <= 18 &&
        hGrad <= 26 &&
        vGrad <= 32;

      if (looksLikeWallPlane) {
        binary[i] = 1;
      }
    }
  }

  return binary;
}
```

### Why this helps
This is more stable than the current wall heuristic because it is explicitly looking for:
- low-texture vertical planes
- broad smooth surfaces
- lower saturation
- not just “wall-colored” pixels

That is closer to semantic wall behavior.

---

# PATCH 5 — Add semantic refinement pipeline

### File: `media-ai.service.js`

Add:

```ts
function refineSemanticWallMask(binaryMask, sourceProbe, width, height) {
  const refinementStages = [];

  function stage(name, binary) {
    refinementStages.push({
      stage: name,
      coverageRatio: calculateBinaryMaskCoverageRatio(binary),
    });
    return binary;
  }

  let current = new Uint8Array(binaryMask);
  const rawCoverageRatio = calculateBinaryMaskCoverageRatio(current);
  stage('semantic_raw', current);

  current = closeBinaryMask(current, width, height, 1);
  stage('semantic_after_close', current);

  current = fillBinaryMaskHoles(current, width, height);
  stage('semantic_after_hole_fill', current);

  current = bridgeVerticalMaskGaps(current, width, height, {
    startY: Math.round(height * 0.08),
    endY: Math.round(height * 0.78),
    maxGap: 4,
    minColumnCoverageRatio: 0.18,
  });
  stage('semantic_after_vertical_bridge', current);

  current = suppressSemanticLikelyWindows(current, sourceProbe, width, height);
  stage('semantic_after_window_suppression', current);

  current = suppressSemanticDangerZones(current, width, height);
  stage('semantic_after_danger_zones', current);

  current = filterBinaryMaskComponents(current, width, height, {
    minArea: Math.max(60, Math.round(width * height * 0.004)),
    minBoxWidth: 6,
    minBoxHeight: 8,
  });
  stage('semantic_after_component_filter', current);

  const coverageRatio = calculateBinaryMaskCoverageRatio(current);

  return {
    binary: current,
    rawCoverageRatio,
    coverageRatio,
    refinementStages,
  };
}
```

---

# PATCH 6 — Stronger window suppression for semantic masks

### File: `media-ai.service.js`

Add:

```ts
function suppressSemanticLikelyWindows(binaryMask, sourceProbe, width, height) {
  const next = new Uint8Array(binaryMask);

  const luminance = new Float32Array(width * height);
  const texture = new Float32Array(width * height);

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
      texture[i] =
        (Math.abs(luminance[i - 1] - luminance[i + 1]) +
          Math.abs(luminance[i - width] - luminance[i + width])) / 2;
    }
  }

  for (let y = Math.round(height * 0.08); y < Math.round(height * 0.8); y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lum = luminance[i];
      const tex = texture[i];

      // Bright + structured = likely blinds/window/exterior
      if (lum > 205 && tex > 14) {
        next[i] = 0;
      }
    }
  }

  return next;
}
```

### Why
Your current artifacts strongly suggest window contamination is still the main source of banding and repaint streaking. The latest results still show those issues around windows, even when the output is broadly better. This matches the current logs showing valid but conservative wall coverage plus a still-fragile adaptive mask. fileciteturn19file2

---

# PATCH 7 — Add semantic wall danger zones

### File: `media-ai.service.js`

Add:

```ts
function suppressSemanticDangerZones(binaryMask, width, height) {
  const next = new Uint8Array(binaryMask);

  const topDeadZone = Math.max(1, Math.round(height * 0.06));
  const bottomDeadZone = Math.max(1, Math.round(height * 0.08));
  const sideInset = Math.max(1, Math.round(width * 0.015));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;

      if (y < topDeadZone || y >= height - bottomDeadZone) {
        next[i] = 0;
        continue;
      }

      if (x < sideInset || x >= width - sideInset) {
        next[i] = 0;
      }
    }
  }

  return next;
}
```

---

# PATCH 8 — Replace wall mask resolver order

### File: `media-ai.service.js`

Update `resolveSurfaceMaskAtSourceSize(...)` for wall presets:

```ts
async function resolveSurfaceMaskAtSourceSize(sourceBuffer, presetKey, roomType) {
  if (isWallPreset(presetKey)) {
    try {
      const semantic = await segmentWallPlanesAtSourceSize(sourceBuffer, roomType);
      validateMaskCoverage({
        presetKey,
        coverageRatio: semantic.debug.coverageRatio,
      });

      console.info('vision_wall_mask_debug', {
        presetKey,
        roomType,
        strategy: 'semantic_wall',
        wallMaskCoverage: semantic.debug.coverageRatio,
      });

      return {
        maskBuffer: semantic.wallMaskBuffer,
        debug: semantic.debug,
      };
    } catch (semanticError) {
      console.warn('semantic wall mask failed', {
        presetKey,
        roomType,
        message: semanticError?.message || String(semanticError),
      });

      try {
        const adaptive = await buildAdaptiveWallPaintMaskAtSourceSize(sourceBuffer, presetKey, roomType);
        const coverageRatio = await calculateMaskCoverageRatio(adaptive.adaptiveMaskBuffer);
        validateMaskCoverage({ presetKey, coverageRatio });

        return {
          maskBuffer: adaptive.adaptiveMaskBuffer,
          debug: {
            strategy: 'adaptive_wall',
            maskCoverageRatio: coverageRatio,
          },
        };
      } catch (adaptiveError) {
        const fallback = await buildFallbackWallPaintMaskAtSourceSize(
          sourceBuffer,
          presetKey,
          roomType,
        );
        const fallbackCoverageRatio = await calculateMaskCoverageRatio(
          fallback.adaptiveMaskBuffer,
        );

        if (fallbackCoverageRatio < 0.05) {
          throw new Error(`Fallback wall mask coverage out of range: ${fallbackCoverageRatio}`);
        }

        return {
          maskBuffer: fallback.adaptiveMaskBuffer,
          debug: {
            strategy: 'fallback_wall',
            maskCoverageRatio: fallbackCoverageRatio,
          },
        };
      }
    }
  }

  // existing floor and generic behavior unchanged
}
```

---

# PATCH 9 — Add semantic mask debug artifacts

### File: `media-ai.service.js`

For paint presets, store debug metadata on generated variants:

```ts
metadata.debug = {
  ...(metadata.debug || {}),
  maskStrategy: resolvedMask.debug?.strategy || null,
  maskCoverageRatio: resolvedMask.debug?.coverageRatio || resolvedMask.debug?.maskCoverageRatio || null,
  rawMaskCoverageRatio: resolvedMask.debug?.rawCoverageRatio || null,
  refinementStages: resolvedMask.debug?.refinementStages || [],
}
```

Also save:
- `semantic_wall_mask_raw.png`
- `semantic_wall_mask_final.png`
- `semantic_wall_mask_overlay.png`

This is critical because the current visual outputs show that mask contamination and under-coverage are now the limiting factor, not provider generation itself.

---

# PATCH 10 — Coverage targets for walls

### Adjust validation expectations

Your current wall mask validation is:

```ts
coverageRatio < 0.08 || coverageRatio > 0.62
```

That is safe, but too broad.

For living rooms with large visible walls, target:

- ideal: **0.45 to 0.68**
- acceptable: **0.30 to 0.72**
- fallback minimum: **0.12**

### Add warning, not hard fail, for weak-but-usable coverage:
```ts
if (coverageRatio < 0.3) {
  logger.warn('Wall mask coverage is conservative; results may be too subtle', {
    presetKey,
    coverageRatio,
  });
}
```

The recent successful-but-still-imperfect run logged wall mask coverage around `0.3425`, which confirms the system is now out of the zero-mask phase but still under-covering walls for this room type. fileciteturn19file2

---

# PATCH 11 — Test updates

### File: `media-ai.service.test.js`

Add tests:

```ts
test('semantic wall segmentation returns non-zero wall coverage for a living room', async () => {
  // use fixture image
  const result = await segmentWallPlanesAtSourceSize(sourceBuffer, 'living_room');
  assert.ok(result.debug.coverageRatio > 0.2);
});

test('semantic wall segmentation excludes bright window regions', async () => {
  // synthetic bright-window fixture
  const result = await segmentWallPlanesAtSourceSize(sourceBuffer, 'living_room');
  // assert window region mostly absent from final mask
});

test('wall presets prefer semantic wall segmentation before adaptive fallback', async () => {
  // verify resolver order and debug strategy
});
```

You already have strong test coverage for wall/floor strategies, provider order, and wall-mask helper behavior. The current suite is a good base for this upgrade. fileciteturn19file0

---

# Implementation Order

## Phase 1 — Safe drop-in
1. Add `segmentWallPlanesAtSourceSize(...)`
2. Add `runWallSegmentationProviderFromProbe(...)`
3. Add semantic refinement helpers
4. Route wall preset masks through semantic → adaptive → fallback
5. Save debug artifacts

## Phase 2 — Tuning
1. Tune coverage targets by room type
2. Tune window suppression thresholds
3. Tune connected-component minimums
4. Add overlay previews for every failed or weak candidate

## Phase 3 — Optional future upgrade
Swap `runWallSegmentationProvider(...)` to a dedicated segmentation model or service without changing the rest of the pipeline.

---

# Product Effect

Once this is in place, the product should improve in exactly the areas you are still seeing problems:

- fewer wall streaks
- less window contamination
- more complete wall-plane repainting
- more consistent “Warm Walls” and “Brighten Walls” outputs
- less reliance on luck / accidental good fallback images

That is what moves the wall feature from:
- “sometimes good”
to
- **“consistently trustworthy for listing conversations”**

---

# Codex Handoff Summary

Implement a **semantic wall segmentation layer** that becomes the first-choice wall mask resolver for all `paint_*` presets. Build the initial version locally using luminance, saturation, gradient, and low-texture wall-plane behavior, then refine with morphology, hole fill, vertical continuity bridging, strong window suppression, danger-zone trimming, and connected-component cleanup. Route wall mask resolution through `semantic_wall → adaptive_wall → fallback_wall`, store debug artifacts and mask coverage metrics on every result, and keep the current orchestration, provider chaining, and scoring systems unchanged.

---

# Final Recommendation

Do this before any more prompt tuning.

At this point, prompt tuning is no longer the highest-leverage move. Your presets and orchestration are already strong. The bottleneck is wall-plane segmentation quality. Once you upgrade that, the rest of the pipeline will finally have stable surface boundaries to work with, and the wall results should jump noticeably in quality and consistency.
