What just happened (based on your screenshot)

You now get:

“Custom enhancement ready with warning”

and

“spill into bright upper-wall and window-adjacent regions…”

✅ Translation

Your system:

DID generate a visible wall change
DID pass enough checks to show it
BUT flagged:
spill near windows
upper wall contamination

👉 So it downgraded to “diagnostic preview”

🎯 This is a HUGE milestone

You just moved from:

❌ “No change detected”
➡️ to
✅ “Change detected but not clean”

That’s progress.

💥 Now let’s connect this to your code (this is the important part)
This message is coming from your orchestration logic

Specifically this flow:

Candidate classification:
classifyCandidateQuality(candidate)

Then:

selectReturnCandidate(...)

The key part:
if (isAcceptableFinishFallbackCandidate(candidate) ||
    isSafeBestEffortCandidate(candidate)) {
  return 'best_effort_preview';
}
Then:
return {
  variant: bestEffort,
  stoppedEarlyReason: 'best_effort_preview_candidate',
  deliveryMode: 'best_effort_preview',
};
🧠 So your UI message is actually correct

Your system is saying:

“This is usable… but not listing-grade clean”

🔍 Why it’s still failing “clean”

This is the critical part:

Your spill tolerance is dynamic:
getPaintOutsideMaskLimit(candidate)

For window-heavy rooms:
if (isWindowHeavyRoom) {
  return 0.6;
}
BUT…

Even though you allow up to 60% spill, you still have this gate:

In fallback acceptance:
if (outsideMaskChangeRatio > outsideMaskLimit) {
  return false;
}
AND ALSO:
if (topHalfChangeRatio > 0.12) return false;
if (maskedEdgeDensityDelta > 0.004) return false;
🧠 Why your specific image struggles

Your room has:

3 large bright windows
blinds (high-frequency edges)
top-heavy lighting

👉 That causes:

Metric	Effect
outsideMaskChangeRatio	🔺 high
topHalfChangeRatio	🔺 high
maskedEdgeDensityDelta	🔺 high
💥 So the system concludes:

“The paint is real… but it contaminated areas it shouldn’t”

🔥 Here’s the REAL insight (this matters for product)

You are solving two different problems at once:

1. “Did the model repaint the walls?”

👉 YES (you proved it)

2. “Did it repaint them perfectly clean?”

👉 NOT ALWAYS (expected)

🚨 And right now your system treats #2 as critical

That’s why users see warnings.

🧠 What you should do next (this is the unlock)
✅ Option A (what I recommend for your product)

Change messaging from:

“diagnostic preview”

to something like:

“Concept preview — paint direction is visible. Minor edge spill may occur in high-light areas.”

✅ Option B (code change — small but powerful)

Relax THIS:

if (topHalfChangeRatio > 0.12) return false;

👉 Change to:

if (topHalfChangeRatio > 0.25) return false;
✅ Option C (even better)

Only enforce strict rules for listing-ready mode

if (mode === 'listing_ready') {
   strict thresholds
} else {
   relaxed thresholds
}
🧪 What your tests are already telling you

You actually already accounted for this case:

test('paint_warm_neutral accepts window-heavy warm wall candidates with high outside-mask change')

Meaning:

👉 You know this situation is valid
👉 But your charcoal preset is stricter

🎯 Final diagnosis

You are now in:

✅ “Generation works”
❌ “Scoring still too strict for real-world rooms”

🧠 Big picture (this is important)

You’re building:

A production-grade vision QA system

…but your users just want:

“Does this look like dark green walls?”

🚀 My recommendation (very direct)
Right now:

👉 Lean into “best_effort_preview” as a FEATURE

Not a failure.