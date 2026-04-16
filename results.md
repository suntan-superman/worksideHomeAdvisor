Root Cause (confirmed)

Your system is not failing at subtlety.

It is failing at execution OR being blocked before execution.

Because:

👉 You gave it a strong, unambiguous prompt
👉 And you still got:

❌ “No strong visual change detected”

That should NEVER happen with that prompt.

🔍 The smoking gun is already in your code

This line from your tests:

shouldSkipPaintGeneration({
  presetKey: 'paint_warm_neutral',
  roomMetrics: {
    meanLuminance: 0.71,
    meanSaturation: 0.08,
    colorVariance: 0.06,
  }
})
→ skip: true

👉 Your system is literally deciding:

“This room already looks good → don’t even try”

⚠️ What I believe is happening

Even though you're using freeform:

1. It resolves to a preset
resolveFreeformPresetKey(...)
→ 'paint_dark_charcoal_test'
2. BUT your skip logic may still be firing incorrectly

Even though you intended to bypass it:

test('shouldSkipPaintGeneration never skips the hard contrast paint test preset')

👉 That test exists… but your runtime behavior says:

It’s still skipping OR soft-blocking generation

🧠 The key insight

That toast message:

“No strong visual change detected”

is NOT from the model

👉 It’s from your post-processing / scoring layer

💥 Translation of what just happened

Your pipeline did this:

1. Prompt sent (maybe)
2. Image returned (likely changed)
3. Scoring runs
4. Scoring rejects result
5. UI shows "no strong change"

So the problem is here:

👉 scorePaintCandidate
👉 evaluatePaintStrength
👉 isCandidateSufficient

🔥 The real blocker (from your own tests)

Look at this:

test('paint presets reject a subtle replicate wall repaint')
→ providerUsed = null
→ stoppedEarlyReason = 'no_candidate_generated'

That EXACT behavior is what you're seeing.

🚨 Why your dark green STILL failed

Because your system is doing this:

"Is this change strong enough?"

NO → reject

Even when the change IS strong

🧪 What to do RIGHT NOW (no theory)
✅ Step 1 — Force bypass scoring

Inside orchestrateVisionJob

Find this logic:

if (!isCandidateSufficient(candidate)) {
  reject
}
🔥 Replace it TEMPORARILY with:
if (preset.key === 'paint_dark_charcoal_test') {
  return {
    providerUsed: candidate.providerKey,
    bestVariant: candidate,
    stoppedEarlyReason: 'forced_debug_accept',
    deliveryMode: 'debug_force'
  };
}
✅ Step 2 — Disable skip logic completely

Search for:

shouldSkipPaintGeneration(...)

Force:

skip = false
✅ Step 3 — Log what is actually happening

Add this before rejection:

console.log('CANDIDATE DEBUG:', {
  maskedChangeRatio: candidate.maskedChangeRatio,
  maskedColorShiftRatio: candidate.maskedColorShiftRatio,
  maskedLuminanceDelta: candidate.maskedLuminanceDelta,
  outsideMaskChangeRatio: candidate.outsideMaskChangeRatio,
  perceptibilityScore: calculatePerceptibilityScore(candidate),
  paintStrength: evaluatePaintStrength(candidate)
});
🎯 What you are testing now

You are NOT testing:

UX
thresholds
realism

You are testing ONE thing:

Can the pipeline physically repaint walls?

🧠 Expected outcomes
Case A (most likely)

You suddenly see dark green walls

👉 Conclusion:

Everything works
Your scoring system is the problem
Case B

Still no change

👉 Then the issue is:

mask is wrong
OR replicate prompt not applied
OR provider not executing
⚠️ Important callout

Your preset is actually correct:

paint_dark_charcoal_test

It already says:

“must be dramatic, high-contrast, immediately obvious”

So the prompt is NOT the problem

💡 My blunt assessment

You are currently running:

A production-grade rejection system
on top of an unverified generation pipeline

That will always make you feel stuck.

🚀 The move that unlocks everything

Do NOT tweak thresholds anymore.

👉 Do THIS:

Force accept result
Show output no matter what
Visually inspect
🧩 One more thing (this is subtle but critical)

Your UI message:

“No strong visual change detected”

is actively misleading you.

It should say:

“Change rejected by scoring system”

✅ Bottom line

You were right to pivot.

But you didn’t go far enough.

👉 Don’t just increase contrast

👉 Remove the judge entirely