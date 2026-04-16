The Real Problem (not theory anymore)

Your pipeline is working correctly… then throwing the result away.

Specifically:

👉 This function is killing your output:

isCandidateSufficient(...)

🔍 For your exact preset (paint_dark_charcoal_test)

Here’s the gate:

return (
  maskedChangeRatio >= 0.12 &&
  maskedColorShiftRatio >= 0.08 &&
  abs(maskedLuminanceDelta) >= 0.06 &&
  maskedEdgeDensityDelta <= 0.003 &&
  topHalfChangeRatio <= 0.08 &&
  outsideMaskChangeRatio <= limit &&
  furnitureCoverageIncreaseRatio <= 0.01 &&
  newFurnitureAdditionRatio <= 0.01
)
🚨 Why your image fails (this specific room)

Look at your image:

Bright windows
Lots of light spill
Thin wall surfaces
Complex edges (blinds, trim, shadows)

👉 That causes:

❌ outsideMaskChangeRatio too high
❌ maskedEdgeDensityDelta too high
❌ maskedChangeRatio too low (because mask is imperfect)
🧠 Translation into plain English

Your system is saying:

“Yes, the walls changed…
but the change isn’t clean enough / isolated enough / strong enough”

So it rejects it entirely.

⚠️ The critical mistake

You built a perfect production validator

…but you're still in:

“Does this even work?” phase

🔥 There’s a SECOND hidden killer

This one is even worse:

evaluatePaintStrength(...)

if (maskedColorShiftRatio < minColorShift) penalties += 3
if (maskedLuminanceDelta < minLuminanceDelta) penalties += 2
if (perceptibilityScore < minPerceptibility) penalties += 2

Then:

finalScore = baselineScore - penalties
passes = finalScore >= minAcceptableScore
💣 This is brutal

Even a visibly changed image can fail because:

color shift slightly low → penalty
luminance slightly low → penalty
perceptibility slightly low → penalty

👉 stacked penalties = rejection

🧠 Combined effect

Your pipeline is doing:

Generate → Analyze → Penalize → Reject → Show “no change”

Even when change EXISTS.

🎯 What just happened in your test

You gave:

“deep rich dark green… must be immediately noticeable”

Your system:

Generated something (almost guaranteed)
Scored it
Said:
❌ “Not strong enough”
Threw it away

Lied to you with:

“No strong visual change detected”

🚀 What you need to do (no more theory)
🔥 Step 1 — TEMPORARILY BREAK THE SYSTEM

Inside isCandidateSufficient:

if (presetKey === 'paint_dark_charcoal_test') {
  return true;
}
🔥 Step 2 — Disable paint strength rejection

Inside evaluatePaintStrength usage:

Replace:

if (!paintStrength.passes) reject

with:

// TEMP DEBUG
paintStrength.passes = true;
🔥 Step 3 — Log actual values

Right before rejection:

console.log({
  maskedChangeRatio,
  maskedColorShiftRatio,
  maskedLuminanceDelta,
  outsideMaskChangeRatio,
  perceptibilityScore,
  paintStrength
});
🧪 What you will learn immediately
Scenario A (most likely)

You suddenly see:

👉 Dark green walls appear

✅ Conclusion:

Replicate is working
Prompt is working
Mask is “good enough”
Your scoring system is too strict
Scenario B

Still no change

👉 Then the issue is:

mask is wrong
OR provider never executed
OR prompt not reaching provider
⚠️ One more subtle but HUGE issue

Your provider chain:

['replicate_basic', 'replicate_advanced', 'local_sharp']

If both Replicate attempts fail scoring:

👉 it falls back to local_sharp

Which cannot repaint walls realistically

💥 So worst case today:
Replicate generates something decent
Your scoring rejects it
System falls back to local
Local does almost nothing
UI says “no change”
🧠 Final diagnosis

You don’t have a generation problem.

You have a:

“Over-aggressive quality gate blocking valid outputs” problem

🎯 What I would do (if this were my system)

Phase 1 (NOW):

👉 Disable ALL rejection
👉 Always return best candidate

Phase 2:

👉 Log metrics
👉 Build histogram of real outputs

Phase 3:

👉 Rebuild thresholds based on reality
(not guesses)

🧩 Bottom line

You didn’t fail.

You built something too advanced too early.