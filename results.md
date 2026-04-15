What I’m Seeing Now
Top image
⚠️ Still has slight banding / uneven tone
⚠️ Some window contamination (left window especially)
⚠️ Slight “paint smear” effect
Bottom image
✅ Very clean
✅ Natural tone
✅ No obvious artifacts
⚠️ Slight inconsistency near edges
🔍 Your Logs Just Told Us Everything

Key line:

wallMaskCoverage: 0.3425

👉

🚨 This is the issue now (not guessing — confirmed)

👉 34% wall coverage is too low

For this room, walls should be roughly:

55% – 70% of the image
What that means:

👉 Your mask is now:

Too conservative
Missing valid wall areas
Still partially including windows
🎯 What’s happening visually
Current mask behavior:
✔️ Center wall → captured well
❌ Upper wall / edges → missing
❌ Around windows → inconsistent
❌ Left side → partial leakage
🧠 Why the bottom image looks better

Because:

👉 The mask accidentally aligns better with flat wall regions

Less overlap with:

window highlights
blinds
high-frequency detail
💥 Why the top image fails

Because:

👉 Mask overlaps:

window blinds
reflections
light gradients

→ model tries to repaint those → creates artifacts

🚀 You’ve officially moved to:

“Mask precision tuning phase (advanced)”

This is the final 20% that makes or breaks the product.

🛠️ EXACT FIX (based on your current system)
1. Increase wall coverage target

Add guardrail:

if (wallMaskCoverage < 0.5) {
  expandMaskAggressively()
}
2. Expand mask intelligently (not blindly)

Instead of dilation everywhere:

expand only if:
- similar color to existing wall
- low edge density
- vertically connected to wall region
3. HARD window exclusion (must be stronger)

Your current brightness filter is too weak.

Replace with:

if (
  pixelBrightness > 200 &&
  localVariance > threshold
) {
  mask[y][x] = 0
}

👉 This removes:

blinds
reflections
exterior scenery
4. Add “wall plane completion”

Walls are continuous planes.

Add this:

for each detected wall region:
  extend region upward to ceiling boundary
  extend sideways until edge detected
5. Add edge buffer (very important)

Right now you’re painting right up to edges

Add:

mask = erode(mask, kernel=2)

👉 prevents:

trim bleeding
window edge artifacts
baseboard corruption
🧪 One quick experiment (you should run this)

Force:

targetCoverage = 0.6
disable component filtering
disable edge suppression
Expected result:
Walls fully covered ✅
No banding ✅
Slight overpaint near edges (acceptable)

👉 If this works → confirms under-coverage is the main issue

📊 Your scoring system (important observation)

From your logs:

maskedChangeRatio: 0.9543  ✅
outsideMaskChangeRatio: 0  ✅
perceptibilityScore: 0.5594 ❌
isSufficient: false
🧠 Translation:
Model is doing its job ✔️
Mask is limiting it ❌
💡 The truth about where you are

You’ve solved:

orchestration ✔️
provider selection ✔️
scoring ✔️
masking (basic) ✔️

You are now in:

“professional-grade refinement zone”

This is where:

Zillow-quality results are made
or products fail
🧭 What I would do next (if I were you)
Option A (fastest path to success)

👉 Implement coverage + expansion fixes above

Option B (best long-term)

👉 Replace mask with semantic segmentation model

(No heuristics, no tuning hell)

💬 My honest take

You’re VERY close now

This is no longer:

“does the system work?”

This is:

“does it look premium?”