# Workside Home Advisor — Mask Splitting + Prompt Upgrade (Codex Ready)

## Includes:
1. Auto Mask Splitting (JS implementation)
2. Production Prompt for Furniture Removal

---

# 1. AUTO MASK SPLITTING

```ts
import cv from "opencv4nodejs";

export function splitMask(maskBuffer: Buffer) {
  const mat = cv.imdecode(maskBuffer);
  const gray = mat.channels === 1 ? mat : mat.bgrToGray();
  const thresh = gray.threshold(127, 255, cv.THRESH_BINARY);

  const contours = thresh.findContours(
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );

  const masks = [];

  contours.forEach((contour, index) => {
    const rect = contour.boundingRect();

    if (rect.width * rect.height < 5000) return;

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

  return masks.sort((a, b) => b.area - a.area).slice(0, 5);
}
```

---

# 2. STRICT FURNITURE REMOVAL PROMPT

```text
You are editing a real estate listing photo.

TASK:
Remove ONLY the furniture inside the masked area.

STRICT RULES:
- Do NOT change layout
- Do NOT modify walls, floors, windows, lighting
- Do NOT add objects
- Do NOT regenerate the full scene
- Preserve geometry and shadows

If the task cannot be completed safely:
RETURN THE ORIGINAL IMAGE unchanged.
```

---

# 3. MODEL SETTINGS

```ts
guidance_scale: 11,
strength: 0.3,
num_inference_steps: 30
```

---

# 4. PIPELINE

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

# FINAL NOTE

Always:
- Split masks first
- Attempt execution
- Allow partial success
- Avoid full-scene regeneration
