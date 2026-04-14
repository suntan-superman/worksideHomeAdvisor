# MASKING UPGRADE (PRODUCTION-READY)
## Workside Advisor – Vision Pipeline

---

# 🎯 Goal
Upgrade floor and wall masking from crude geometric blobs to **room-aware, surface-aware masks** that:
- follow real floor boundaries
- exclude windows, trim, ceilings, and shelving
- reduce edge bleed and carpet hallucinations
- improve realism for floor tone and wall paint previews

---

# Why this matters

Your current system is strong in:
- provider orchestration
- prompt routing
- fallback behavior
- candidate scoring

But masking is still the weak link.

Right now, large parts of the pipeline still rely on broad geometric masks such as rectangles and ellipses. That is acceptable for rough inpainting, but not for:
- flooring direction previews
- wall-color previews
- finish-only transformations

The current code still contains geometric floor/wall mask shapes as a fallback strategy in `buildMaskShapes(...)`, including broad floor rectangles and ellipses for floor presets and broad upper-wall rectangles for wall presets. fileciteturn12file3

The correct move now is to promote the **adaptive masks** into the primary masking system and harden them with QA, edge exclusions, and debug output.

---

# 1. Final masking architecture

## 1.1 Floors
Use:
- adaptive floor mask
- perspective-aware lower-plane bias
- exclusion of trim/baseboards
- exclusion of furniture silhouettes if present
- light feather only

## 1.2 Walls
Use:
- adaptive wall mask
- explicit exclusion of windows
- explicit exclusion of trim/baseboards
- ceiling exclusion
- shelving / built-in suppression

## 1.3 Generic inpainting tasks
Keep broad masks only for:
- remove_furniture
- declutter
- cleanup_empty_room
- some kitchen/exterior concept tasks

Do NOT use broad geometric masks as the main path for:
- `paint_*`
- `floor_*`

---

# 2. Current codebase reality

You already have the right foundation.

## Existing strengths already present
The media AI service already includes:
- `buildAdaptiveWallPaintMaskAtSourceSize(...)`
- `buildAdaptiveFloorMaskAtSourceSize(...)`
- `buildBinaryMaskPngBuffer(...)`
- `buildTemporaryReplicateInputUrls(...)`

Those are the correct foundation for the upgraded system. fileciteturn12file3

You also already route wall/floor transforms through local/adaptive surface logic in:
- `renderLocalWallPaintVariantBuffer(...)`
- `renderLocalFloorVariantBuffer(...)`

So the upgrade is not a rewrite. It is a **promotion + hardening** of what you already built. fileciteturn12file3

---

# 3. Upgrade strategy

## 3.1 For wall and floor presets
Replace:
- broad fallback masks
with:
- adaptive masks by default

## 3.2 Add mask QA
Every adaptive mask must be validated before being used.

## 3.3 Add mask debug output
Every finish preview should be able to save:
- source preview
- raw mask
- feathered mask
- final result

## 3.4 Add exclusions
For walls:
- windows
- trim/baseboards
- ceiling line
- built-ins

For floors:
- baseboards
- lower trim edge
- vertical furniture bleed
- rug / carpet hallucination region

---

# 4. Patch plan for Codex

---

# 🧩 PATCH 1 — Make adaptive masks the default for paint and floor

### File: `media-ai.service.js`

### Goal
For any paint or floor preset, always resolve and use adaptive masks instead of relying on `buildMaskShapes(...)`.

### Add helper
```js
function isWallPreset(presetKey = '') {
  return String(presetKey || '').startsWith('paint_');
}

function isFloorPreset(presetKey = '') {
  return String(presetKey || '').startsWith('floor_');
}
```

### Add canonical mask resolver
```js
async function resolveSurfaceMaskAtSourceSize(sourceBuffer, presetKey, roomType) {
  if (isWallPreset(presetKey)) {
    const wall = await buildAdaptiveWallPaintMaskAtSourceSize(sourceBuffer, presetKey, roomType);
    return {
      maskBuffer: wall.adaptiveMaskBuffer,
      debug: {
        strategy: 'adaptive_wall',
        ...wall,
      },
    };
  }

  if (isFloorPreset(presetKey)) {
    const floor = await buildAdaptiveFloorMaskAtSourceSize(sourceBuffer, presetKey, roomType);
    return {
      maskBuffer: floor.adaptiveMaskBuffer,
      debug: {
        strategy: 'adaptive_floor',
        ...floor,
      },
    };
  }

  return {
    maskBuffer: await buildInpaintingMaskBuffer(sourceBuffer, presetKey, roomType),
    debug: {
      strategy: 'geometric_fallback',
    },
  };
}
```

### Why
This gives you one canonical mask path for:
- local transforms
- replicate input generation
- validation
- scoring

---

# 🧩 PATCH 2 — Add mask coverage QA

### File: `media-ai.service.js`

### Add helper
```js
async function calculateMaskCoverageRatio(maskBuffer) {
  const metadata = await sharp(maskBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);

  const raw = await sharp(maskBuffer)
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer();

  let active = 0;
  for (let i = 0; i < raw.length; i += 1) {
    if ((raw[i] || 0) >= 128) {
      active += 1;
    }
  }

  const total = Math.max(1, width * height);
  return Number((active / total).toFixed(4));
}
```

### Add mask validation
```js
function validateMaskCoverage({ presetKey, coverageRatio }) {
  if (String(presetKey || '').startsWith('paint_')) {
    if (coverageRatio < 0.08 || coverageRatio > 0.62) {
      throw new Error(`Wall mask coverage out of range: ${coverageRatio}`);
    }
  }

  if (String(presetKey || '').startsWith('floor_')) {
    if (coverageRatio < 0.10 || coverageRatio > 0.58) {
      throw new Error(`Floor mask coverage out of range: ${coverageRatio}`);
    }
  }
}
```

### Why
This catches:
- empty masks
- giant masks that swallow the whole image
- masks that overlap too much of the room

---

# 🧩 PATCH 3 — Add trim / ceiling dead zones for wall masks

### File: `media-ai.service.js`

### Inside `buildAdaptiveWallPaintMaskAtSourceSize(...)`
Add these ideas after the adaptive mask is computed:

```js
function suppressWallDangerZones(binaryMask, width, height) {
  const topDeadZone = Math.round(height * 0.06);      // ceiling buffer
  const bottomDeadZone = Math.round(height * 0.08);   // baseboard / trim buffer
  const sideInset = Math.round(width * 0.015);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;

      if (y < topDeadZone || y > height - bottomDeadZone) {
        binaryMask[idx] = 0;
        continue;
      }

      if (x < sideInset || x > width - sideInset) {
        binaryMask[idx] = 0;
      }
    }
  }
}
```

### Why
This reduces:
- paint leaking into ceiling
- paint bleeding into baseboards
- edge garbage near borders

---

# 🧩 PATCH 4 — Exclude windows from wall masks more aggressively

### Goal
Windows are currently one of the biggest reasons wall previews fail or look fake.

### Add a heuristic exclusion
Inside `buildAdaptiveWallPaintMaskAtSourceSize(...)`:
- detect high-brightness + high-edge-density rectangles
- suppress those areas from the wall mask

### Pseudocode
```js
function suppressLikelyWindows(binaryMask, luminance, texture, width, height) {
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const lum = luminance[idx] || 0;
      const tex = texture[idx] || 0;

      const isLikelyWindow = lum > 215 && tex > 18;
      if (isLikelyWindow) {
        binaryMask[idx] = 0;
      }
    }
  }
}
```

### Why
Windows are:
- bright
- edge-dense
- structured

Exactly the opposite of painted walls.

---

# 🧩 PATCH 5 — Add baseboard dead zone for floor masks

### File: `media-ai.service.js`

### Inside `buildAdaptiveFloorMaskAtSourceSize(...)`
After the floor mask is generated, carve out a small zone near the wall/floor boundary.

```js
function suppressFloorDangerZones(binaryMask, width, height) {
  const sideInset = Math.round(width * 0.01);
  const bottomInset = Math.round(height * 0.02);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;

      if (x < sideInset || x > width - sideInset) {
        binaryMask[idx] = 0;
      }

      if (y > height - bottomInset) {
        binaryMask[idx] = 0;
      }
    }
  }
}
```

### Why
This reduces:
- carpet hallucination at bottom edge
- bleed into side walls
- edge fringing

---

# 🧩 PATCH 6 — Use adaptive masks for replicate finish inputs

### File: `media-ai.service.js`

### Current issue
Replicate finish inputs should use the exact same mask family as local transforms and scoring.

### Change `buildTemporaryReplicateInputUrls(...)`
Before generating temporary image/mask URLs, resolve the canonical adaptive mask:

```js
const { maskBuffer, debug } = await resolveSurfaceMaskAtSourceSize(
  imageBuffer,
  presetKey,
  roomType,
);
```

Use that mask instead of broad geometric fallback.

### Why
This aligns:
- generation
- review
- candidate scoring
- debug

---

# 🧩 PATCH 7 — Save debug mask artifacts

### File: `media-ai.service.js`

### Add metadata debug block
For wall/floor preview candidates, store:

```js
metadata.debug = {
  maskStrategy: debug?.strategy || null,
  maskCoverageRatio,
  rawMaskUrl,
  featheredMaskUrl,
}
```

### Save three optional debug files
- raw mask PNG
- final mask PNG
- mask-overlaid preview

### Why
This will save you enormous time when debugging “why did it paint the window” or “why did the floor spill to the right.”

---

# 🧩 PATCH 8 — Light feathering only

### Current problem
Heavy blur makes surface transitions look smeared.

### Rule
Use:
- walls: blur 0.4 – 0.8
- floors: blur 0.6 – 1.2

Do NOT use heavy feathering for finish previews.

### Recommendation
```js
const blurRadius = isWallPreset(presetKey) ? 0.6 : isFloorPreset(presetKey) ? 0.8 : 1.2;
```

---

# 🧩 PATCH 9 — Canonical mask strategy per preset

### File: `media-ai.service.test.js`

### Add tests
```js
test('paint presets resolve to adaptive wall masks', () => {
  assert.equal(getTaskSpecificMaskStrategy('paint_bright_white'), 'adaptive_wall');
});

test('floor presets resolve to adaptive floor masks', () => {
  assert.equal(getTaskSpecificMaskStrategy('floor_light_wood'), 'adaptive_floor');
});
```

This aligns with the existing test direction already in the suite. fileciteturn12file1

---

# 5. Recommended implementation order

## Phase 1 — High impact, low risk
1. Add canonical `resolveSurfaceMaskAtSourceSize(...)`
2. Add mask coverage QA
3. Add wall/floor danger-zone suppression
4. Lower feathering
5. Save debug masks

## Phase 2 — Better wall quality
1. Window suppression
2. Trim exclusion
3. Ceiling dead zone
4. Built-in shelving suppression

## Phase 3 — Better floor quality
1. Baseboard dead zone
2. Side-wall suppression
3. Bottom-edge cleanup
4. Optional rug / carpet suppression

---

# 6. UX / product implication

The masking upgrade directly improves:
- wall brightening previews
- warm wall previews
- greige previews
- floor lightening
- floor darkening
- neutralization previews

This is the upgrade that makes the product feel “smart” instead of “just AI.”

---

# 7. Codex handoff summary

Implement a **canonical adaptive mask system** for all wall and floor finish previews. Use `buildAdaptiveWallPaintMaskAtSourceSize(...)` for all `paint_*` presets and `buildAdaptiveFloorMaskAtSourceSize(...)` for all `floor_*` presets. Add mask coverage QA, danger-zone suppression for walls and floors, light feathering only, and debug artifact storage. Exclude windows, trim, ceilings, and baseboards from wall masks; exclude side-wall bleed, bottom-edge carpet bleed, and baseboard adjacency from floor masks. Use the same adaptive mask family for local rendering, replicate input generation, candidate review, and scoring.

---

# 8. Final recommendation

This masking upgrade is the right next move because:
- provider routing is now mostly correct
- floor generation is now producing real changes
- wall failures are now clearly tied to subtle edits + masking precision
- orchestration is already strong enough to support a better mask system

Once this is in place, your floor previews should become cleaner, and wall previews should stop failing or bleeding into windows/trim.

That is the point where the Vision feature stops feeling fragile and starts feeling truly product-ready.
