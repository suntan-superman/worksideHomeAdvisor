PART 1 — Production-Ready Paint Scoring Function (Tuned for Perceptibility)

This version is Codex-ready and designed for your exact goal:
👉 “Make it visibly different or don’t bother”

✅ Core Philosophy Change

Old logic (problem):

Penalize aggressively
Favor subtle realism

New logic (correct):

Reward visible change
Only reject when truly useless
Detect “no-op rooms” early
🧠 Drop-In Scoring Function
// paintScoring.ts

export function scorePaintCandidate(metrics: {
  maskedChangeRatio: number;
  maskedColorShiftRatio: number;
  maskedLuminanceDelta: number;
  perceptibilityScore: number;
  outsideMaskChangeRatio: number;
  penalties: number;
}) {
  const {
    maskedChangeRatio,
    maskedColorShiftRatio,
    maskedLuminanceDelta,
    perceptibilityScore,
    outsideMaskChangeRatio,
    penalties
  } = metrics;

  // --- 1. Compute visual impact (PRIMARY driver now) ---
  const visualImpact =
    (maskedChangeRatio * 0.5) +
    (maskedColorShiftRatio * 0.3) +
    (Math.abs(maskedLuminanceDelta) * 0.2);

  // --- 2. Penalize spill outside mask (but don’t kill result) ---
  const spillPenalty = Math.max(0, outsideMaskChangeRatio - 0.15);

  // --- 3. Soft penalty system (NO MORE ZEROING OUT) ---
  const penaltyMultiplier = Math.max(0.4, 1 - penalties * 0.08);

  // --- 4. Final score ---
  const finalScore =
    (visualImpact * 0.7 + perceptibilityScore * 0.3)
    * penaltyMultiplier
    - spillPenalty;

  // --- 5. Classification ---
  let classification: 'strong' | 'weak' | 'no-op';

  if (visualImpact > 0.35 && perceptibilityScore > 0.25) {
    classification = 'strong';
  } else if (visualImpact > 0.25) {
    classification = 'weak';
  } else {
    classification = 'no-op';
  }

  return {
    finalScore,
    visualImpact,
    classification,
    shouldUse:
      classification === 'strong' ||
      (classification === 'weak' && finalScore > 0.2)
  };
}
💥 What this fixes immediately

From your logs:

maskedChangeRatio: 0.4079
perceptibilityScore: 0.2367

👉 OLD RESULT: rejected
👉 NEW RESULT: accepted (weak → usable)

🚫 PART 2 — STOP WASTING TIME (Pre-Check)

Before even calling OpenAI:

export function shouldSkipPaintGeneration(roomMetrics: {
  colorVariance: number;
  luminanceVariance: number;
  clutterScore: number;
}) {
  if (
    roomMetrics.colorVariance < 0.12 &&
    roomMetrics.luminanceVariance < 0.10 &&
    roomMetrics.clutterScore < 0.2
  ) {
    return {
      skip: true,
      reason: 'room_already_neutral'
    };
  }

  return { skip: false };
}
✅ UX Output (important)

Instead of generating:

“This room already presents well. Minimal visual difference expected.”

👉 You just saved:

3–5 seconds
API cost
user frustration
🎯 PART 3 — “DARK WALL” TEST MODE (THIS IS CRITICAL)

You NEED a forceful preset to prove the system works.

Right now you're testing with:

paint_warm_neutral → subtle by definition

That’s the wrong test.

✅ Add This Preset
export const PAINT_PRESETS = {
  paint_warm_neutral: {
    label: 'Warm Neutral',
    strength: 'low',
    prompt: `
    Repaint the walls with a soft warm neutral tone.
    Maintain realism and subtlety.
    `
  },

  // 🔥 NEW TEST PRESET
  paint_dark_modern: {
    label: 'Dark Modern (Test)',
    strength: 'high',
    prompt: `
    Repaint all visible walls a deep charcoal or dark slate color.
    Ensure strong, clearly visible contrast from the original image.
    Maintain realistic lighting and shadows.
    Do NOT leave walls light colored.
    `
  }
};
🧠 Add Strength Multiplier
const strengthBoost = preset.strength === 'high' ? 1.25 : 1.0;

const visualImpact =
  ((maskedChangeRatio * 0.5) +
   (maskedColorShiftRatio * 0.3) +
   (Math.abs(maskedLuminanceDelta) * 0.2))
  * strengthBoost;
🚀 PART 4 — Forced Perceptibility Mode (Optional but Powerful)

When testing:

if (presetKey === 'paint_dark_modern') {
  return {
    bypassScoring: true,
    acceptFirstValid: true
  };
}

👉 This ensures:

You SEE the change
You validate pipeline end-to-end
You remove scoring as a variable
🎯 PART 5 — Your New Decision Flow
1. Pre-check room
   → neutral? → SKIP

2. Generate image

3. Score with NEW function

4. If:
   strong → show
   weak → show (with note)
   no-op → advisor message
🔥 What will happen after this
For light rooms (like your example):

👉 No generation
👉 Smart message

For normal rooms:

👉 Subtle but accepted changes

For dark test preset:

👉 OBVIOUS transformation every time

💡 Final Reality Check (Important)

Right now your system is:

“Correct but invisible”

After this:

“Visibly useful”

That’s the difference between:

a demo
and a product people trust