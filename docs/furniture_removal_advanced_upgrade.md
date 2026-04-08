# Workside Home Advisor — Advanced Furniture Removal Upgrade (Codex Spec)

## 🎯 Objective

Provide two critical upgrades:

1. Auto mask splitting (production-ready implementation)
2. Prompt engineering upgrade for reliable furniture removal

These fixes will dramatically improve success rate and prevent regression.

---

# 1. AUTO MASK SPLITTING (IMPLEMENTATION)

## Goal

Break large masks into smaller object-level masks before sending to AI.

---

## ✅ JavaScript Implementation (Drop-In)

```ts
import cv from "opencv4nodejs";

/**
 * Splits a binary mask into multiple object masks
 */
export function splitMask(maskBuffer: Buffer) {
  const mat = cv.imdecode(maskBuffer);

  // Convert to grayscale if needed
  const gray = mat.channels === 1 ? mat : mat.bgrToGray();

  // Threshold to ensure binary
  const thresh = gray.threshold(127, 255, cv.THRESH_BINARY);

  // Find connected components
  const contours = thresh.findContours(
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );

  const masks = [];

  contours.forEach((contour, index) => {
    const rect = contour.boundingRect();

    // Filter noise (too small)
    if (rect.width * rect.height < 5000) return;

    // Expand bounding box slightly
    const padding = 10;

    const x = Math.max(rect.x - padding, 0);
    const y = Math.max(rect.y - padding, 0);
    const width = Math.min(rect.width + padding * 2, mat.cols - x);
    const height = Math.min(rect.height + padding * 2, mat.rows - y);

    masks.push({
      id: index,
      bbox: { x, y, width, height },
      area: width * height
    });
  });

  // Sort largest first
  return masks.sort((a, b) => b.area - a.area).slice(0, 5);
}
```

---

## 🧠 Key Rules

- Max 3–5 masks per image
- Process largest objects first
- Ignore tiny noise regions
- NEVER send full-room mask to model

---

# 2. ENHANCED FURNITURE REMOVAL PROMPT

## 🚨 Problem

Generic prompts cause:
- hallucinations
- scene regeneration
- failure

---

## ✅ STRICT PRODUCTION PROMPT

```text
You are editing a real estate listing photo.

TASK:
Remove ONLY the furniture inside the masked area.

STRICT RULES:
- Do NOT change the layout of the room
- Do NOT modify walls, floors, windows, or lighting
- Do NOT add any new objects
- Do NOT regenerate the full scene
- Preserve perspective, geometry, and shadows

If the task cannot be completed safely:
RETURN THE ORIGINAL IMAGE unchanged.
```

---

## 🔥 CRITICAL ADDITION

Always include:

```text
If the task cannot be completed safely, return the original image unchanged.
```

This prevents hallucination attempts.

---

# 3. MODEL SETTINGS (IMPORTANT)

Use:

```ts
guidance_scale: 11,
strength: 0.3,
num_inference_steps: 30
```

---

# 4. EXECUTION PIPELINE

```ts
const masks = splitMask(mask);

for (const mask of masks) {
  const result = await runInpainting({
    image,
    mask,
    prompt: STRICT_PROMPT
  });

  if (result.success) {
    applyResult(result);
  }
}
```

---

# 5. EXPECTED RESULT

Before:
❌ No furniture removed  
❌ Immediate fallback  

After:
✅ Coffee table removed  
✅ Couch removed (partial)  
➡ System returns PARTIAL SUCCESS  

---

# 6. FINAL DIRECTIVE TO CODEX

- Never block execution before attempt
- Always split masks first
- Always attempt at least one pass
- Prefer partial success over full failure

---

# 🚀 Outcome

This will:
- Restore working furniture removal
- Increase success rate dramatically
- Prevent hallucinated room generation
- Improve seller trust

---

If needed next:
- Auto segmentation (SAM-style)
- Multi-pass refinement pipeline
- Real estate staging presets

