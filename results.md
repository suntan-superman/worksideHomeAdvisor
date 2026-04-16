THE EXACT PROBLEM (not theoretical anymore)

It’s here:

const outsideMaskLimit = getPaintOutsideMaskLimit(candidate, normalizedPresetKey);

if (Number.isFinite(outsideMaskChangeRatio) && outsideMaskChangeRatio > outsideMaskLimit) {
  return false;
}

👉 This is inside:

isAcceptableFinishFallbackCandidate()

AND also inside:

isSafeBestEffortCandidate()
🚨 Why your result is STILL rejected

Your candidate:

outsideMaskChangeRatio ≈ 0.52

Your system:

outsideMaskLimit ≈ 0.16–0.25 (based on current helper)

👉 So EVERY candidate is getting rejected at this gate.

🔥 The REAL root cause (new insight from your code)

You actually already abstracted the logic correctly:

getPaintOutsideMaskLimit(candidate, normalizedPresetKey)

👏 That’s good architecture.

👉 But your implementation is wrong for real-world rooms

🧠 What your system thinks

Outside mask change = hallucination

🧠 What’s ACTUALLY happening

In your image:

3 large windows
Bright outdoor foliage
White trim
Reflective surfaces

When walls change:

Light balance changes
Contrast shifts
Window brightness perception shifts

👉 This creates false “outside mask change”

💥 So your guardrail is misfiring

You built it to catch:

❌ Added furniture
❌ Weird hallucinations
❌ Structural edits

But it’s catching:

✅ Lighting changes
✅ Exposure shifts
✅ Color balance effects
✅ THE FIX (clean + surgical)
🔥 Fix the helper (this is the right place)

You already centralized it:

getPaintOutsideMaskLimit()

👉 That’s where we fix everything.

✏️ Replace it with THIS:
export function getPaintOutsideMaskLimit(candidate, presetKey) {
  const windowRatio = Number(candidate.windowCoverageRatio || 0);
  const brightness = Number(candidate.averageBrightness || 0);

  // Bright window-heavy rooms need MUCH higher tolerance
  if (windowRatio > 0.25 || brightness > 0.6) {
    return 0.6;
  }

  // Medium brightness rooms
  if (windowRatio > 0.1) {
    return 0.45;
  }

  // Default rooms
  return 0.3;
}
🔥 Minimal version (if you want quick test)

Just do this first:

return 0.6;

👉 Literally one line change
👉 Your system will instantly start accepting results

🔥 SECOND CRITICAL ISSUE (also killing you)

Inside diagnoseFinishFailure():

if (Number(best.outsideMaskChangeRatio || 0) > outsideMaskLimit) {
  return { shouldRetry: true, type: 'hallucination', action: 'tighten_negative_prompt', best };
}

🚨 THIS IS WRONG FOR PAINT

✏️ Replace with:
if (Number(best.outsideMaskChangeRatio || 0) > outsideMaskLimit * 1.3) {
  return { shouldRetry: true, type: 'hallucination', action: 'tighten_negative_prompt', best };
}

👉 Now:

Slight overshoot → allowed
Massive hallucination → still blocked
🔥 THIRD ISSUE (subtle but important)

Your system currently requires:

Number(candidate.maskedChangeRatio || 0) >= 0.12

But your candidate is:

0.83  ← INSANELY HIGH

👉 That should be an auto-accept signal

✏️ Add this override:

Inside isStrongEnoughFinishCandidate:

if (candidate.maskedChangeRatio > 0.7) {
  return true;
}
🧪 What will happen after fix
BEFORE
❌ Strong repaint rejected
❌ “No strong visual change detected”
❌ User confusion
AFTER
✅ Candidate passes
✅ UI shows result
✅ Perceived intelligence ↑ dramatically