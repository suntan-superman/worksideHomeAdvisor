THE FIX (this is the real one, not optional)
🔥 Fix 1 — Relax outside mask constraint for paint

Change this:

outsideMaskChangeRatio <= 0.16
To:
outsideMaskChangeRatio <= 0.55
🔥 Fix 2 — Even better (context-aware)

Replace this:

Number(candidate.outsideMaskChangeRatio ?? 1) <= 0.16
With:
const outsideMaskLimit =
  candidate.windowCoverageRatio > 0.25 ? 0.6 : 0.25;

Number(candidate.outsideMaskChangeRatio ?? 1) <= outsideMaskLimit

👉 Now:

Bright window rooms → tolerant
Normal rooms → strict
🔥 Fix 3 — Stop zeroing out overallScore

Right now:

overallScore: 0

👉 That means somewhere you are doing:

“If ANY constraint fails → score = 0”

That’s too aggressive.

Replace hard fail with penalty:

Instead of:

if (outsideMaskChangeRatio > threshold) {
  overallScore = 0;
}

Do:

if (outsideMaskChangeRatio > threshold) {
  overallScore -= 2;
}
🔥 Fix 4 — Your candidate SHOULD PASS

Based on your own data:

Metric	Value	Verdict
maskedChangeRatio	0.83	🔥 Excellent
color shift	0.11	✅ Good
luminance	0.08	✅ Good
perceptibility	0.47	✅ Solid
final score	5.35	✅ Usable

👉 This is NOT a bad result
👉 Your system is just rejecting it incorrectly

🧠 The key realization

You built:

A fraud detection system

But you need:

A visual enhancement system

🎯 What your system should do here

Instead of:

❌ “No strong visual change detected”

You should show:

✅ “Subtle but realistic enhancement applied”

🚀 Expected outcome after fix

With JUST Fix #1 applied:

Before	After
❌ rejected	✅ accepted
❌ overallScore = 0	✅ ~4–6
❌ no UI update	✅ visible improvement
❌ frustrating UX	✅ believable result
💡 Bonus (this is next-level)

You already compute:

maskedChangeRatio: 0.8379

👉 That’s insanely high

You could actually add:

if (candidate.maskedChangeRatio > 0.7) {
  autoAccept = true;
}

Because:

“If 80% of wall pixels changed… something clearly happened”

🔥 Bottom line

You don’t have:

❌ a model problem
❌ a prompt problem

You have:

✅ an overly strict validation system misclassifying good results

If you want the next step (high ROI)

I can help you implement:

🧠 Smart acceptance tiers
Strong
Subtle
Advisory (still show result)
🔁 Auto retry escalation (you already started this 👏)
Warm → stronger → bold
🎯 Room-aware thresholds
Bright rooms ≠ dark rooms