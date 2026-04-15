# 🎯 Paint Strength Enforcement Module (Codex-Ready Spec)

## Purpose

Ensure that all "paint" transformations are **visibly strong, consistent, and intentional**—not subtle color drift. This module enforces minimum perceptual thresholds so outputs always look like a true repaint.

---

## 🔥 Core Principle

> If a user selects a paint preset, the result MUST look like the room was repainted.

---

## 🧠 Problem This Solves

Current issue:

* High `maskedChangeRatio` (pixels are touched)
* LOW `maskedColorShiftRatio` and `maskedLuminanceDelta`

➡️ Result: Changes are technically applied but visually weak

---

## 📊 Metrics Used

| Metric                  | Description                     |
| ----------------------- | ------------------------------- |
| `maskedColorShiftRatio` | Average color delta inside mask |
| `maskedLuminanceDelta`  | Brightness change inside mask   |
| `perceptibilityScore`   | Overall visual strength         |

---

## ✅ Minimum Thresholds (STRICT)

```ts
const MIN_COLOR_SHIFT = 0.22;
const MIN_LUMINANCE_DELTA = 0.18;
const MIN_PERCEPTIBILITY = 0.65;
```

---

## 🧪 Enforcement Logic

### 1. Hard Rejection Rule

```ts
function enforcePaintStrength(metrics) {
  const {
    maskedColorShiftRatio,
    maskedLuminanceDelta,
    perceptibilityScore
  } = metrics;

  let penalties = 0;

  if (maskedColorShiftRatio < MIN_COLOR_SHIFT) {
    penalties += 3;
  }

  if (maskedLuminanceDelta < MIN_LUMINANCE_DELTA) {
    penalties += 2;
  }

  if (perceptibilityScore < MIN_PERCEPTIBILITY) {
    penalties += 2;
  }

  return penalties;
}
```

---

### 2. Score Integration

```ts
score -= enforcePaintStrength(metrics);
```

---

### 3. Final Acceptance Gate

```ts
const MIN_ACCEPTABLE_SCORE = 7.5;

const isSufficient = score >= MIN_ACCEPTABLE_SCORE;
```

---

## 🔁 Retry Strategy (Critical)

If rejected:

### Retry Prompt Adjustment

Increase transformation strength:

```ts
promptModifiers = {
  intensity: "strong",
  instruction: "Apply a clearly visible fresh coat of paint with uniform color. Avoid subtle shading or partial blending."
};
```

---

### Retry Count

```ts
MAX_RETRIES = 3;
```

---

## 🎨 Prompt Engineering Upgrade

### Base Prompt (Weak - DO NOT USE)

❌ "Apply warm neutral paint"

### Enforced Prompt (Use This)

```txt
Apply a clearly visible, uniform coat of warm neutral paint to all wall surfaces.
The color must be noticeably different from the original.
Do not preserve original wall tones or shading.
Maintain clean edges around windows, trim, and ceilings.
```

---

## 🧩 Optional: Auto-Boost Logic

If output is weak, automatically boost intensity:

```ts
if (maskedColorShiftRatio < 0.18) {
  nextPrompt.intensity = "very strong";
}
```

---

## 🧪 Debug Logging (Required)

```ts
console.log("Paint Strength Check", {
  maskedColorShiftRatio,
  maskedLuminanceDelta,
  perceptibilityScore,
  penalties,
  finalScore
});
```

---

## 🚀 Expected Outcome After Implementation

* Walls show **clear, uniform repainting**
* No more "barely changed" outputs
* Scores consistently ≥ 8
* Retry loop activates intelligently

---

## ⚠️ Common Mistakes to Avoid

❌ Allowing subtle tone shifts to pass
❌ Over-relying on maskedChangeRatio
❌ Not enforcing luminance delta
❌ Accepting first-pass results without validation

---

## 🏁 Final Summary

This module ensures:

✅ Strong visual repaint
✅ Consistent wall coverage
✅ Reliable output quality

Without this, your system will ALWAYS produce weak results—even if segmentation is perfect.

---

## 🔜 Next Recommended Module

👉 Window Rejection v2 (Column + Texture Hybrid)

(This is the missing piece for your bay window case.)
