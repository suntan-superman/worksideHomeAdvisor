Vision Decision Model Redesign

Filename: vision-decision-model-v2.md

# Vision Decision Model v2
## Generate → Rank → Always Deliver → Label Quality

---

## 🎯 Objective

Replace the current rejection-heavy orchestration model with a **rank-first, always-deliver system** that:

- ALWAYS returns the best available visual result
- Classifies output quality instead of rejecting it
- Improves UX consistency and trust
- Separates **generation success** from **quality grading**

---

## 🧠 Core Philosophy

OLD MODEL:
generate → evaluate → reject → retry → possibly return nothing

NEW MODEL:
generate → evaluate → rank → ALWAYS return best → label quality

---

## 🔄 New Pipeline Overview

Generate candidates (multi-provider)
Score each candidate
Rank candidates
Select BEST candidate (always)
Assign quality label
Return result + label + diagnostics

---

## 🏗️ Pipeline Stages

### 1. Candidate Generation

Unchanged:

- replicate_basic
- replicate_advanced
- openai_edit (if available)
- local_sharp (fallback)

All candidates are collected:

```js
const allCandidates = []
2. Candidate Scoring

Each candidate receives:

perceptibilityScore
paintStrength
outsideMaskChangeRatio
structural integrity metrics

Reuse:

calculatePerceptibilityScore()
evaluatePaintStrength()
scorePaintCandidate()
3. Ranking (Primary Decision Driver)

Replace rejection filtering with ranking:

const ranked = rankCandidates(allCandidates, preset.key)

Top candidate is ALWAYS selected:

const bestCandidate = ranked[0] || null
4. Quality Classification (NEW)

Instead of rejecting, classify quality:

function classifyQuality(candidate, presetKey) {
  if (!candidate) return 'poor'

  const perceptibility = calculatePerceptibilityScore(candidate)
  const paintStrength = evaluatePaintStrength(candidate, presetKey)
  const outsideMask = Number(candidate.outsideMaskChangeRatio || 0)

  // HIGH QUALITY
  if (
    paintStrength.passes &&
    perceptibility >= 0.35 &&
    outsideMask <= 0.12
  ) {
    return 'high'
  }

  // GOOD QUALITY
  if (
    paintStrength.finalScore >= 5 &&
    perceptibility >= 0.25 &&
    outsideMask <= 0.2
  ) {
    return 'good'
  }

  // CONCEPT PREVIEW (MOST IMPORTANT CATEGORY)
  if (
    perceptibility >= 0.15 &&
    paintStrength.finalScore >= 3
  ) {
    return 'concept'
  }

  // POOR RESULT
  return 'poor'
}
5. Delivery Logic (CRITICAL CHANGE)

OLD:

if (!candidate.isSufficient) reject

NEW:

return {
  bestVariant: bestCandidate,
  quality: classifyQuality(bestCandidate, preset.key),
  deliveryMode: 'always_return_best',
}
6. UI Messaging Mapping
Quality	UI Label	Messaging
high	✅ Listing Ready	“Clean, high-quality result suitable for listing use.”
good	👍 Strong Preview	“Strong result with minor imperfections.”
concept	🎨 Concept Preview	“Clear visual direction; minor edge spill may exist.”
poor	⚠️ Low Confidence	“Limited change detected; result may not reflect intended update.”
🔥 Key Behavior Changes
✅ BEFORE
Could return nothing
Overly strict rejection
Confusing “diagnostic preview” states
✅ AFTER
ALWAYS returns a result
Quality is graded, not rejected
System feels consistent and reliable
🧪 Example Flow
Input:

Living room with heavy windows

Candidates:
replicate_basic → weak change
replicate_advanced → strong but spill
openai_edit → moderate
Ranking Result:

replicate_advanced wins

Classification:
perceptibility: high
spill: moderate
→ classified as: concept
Output:

Returned to user with:

{
  "quality": "concept",
  "message": "Concept preview — paint direction is visible. Minor edge spill may occur in bright areas."
}
🧠 Optional Enhancements (Future)
1. Confidence Score (0–100)
confidence =
  perceptibility * 50 +
  (paintStrength.finalScore / 10) * 30 +
  (1 - outsideMaskRatio) * 20
2. Mode-Based Strictness
mode: 'concept' | 'listing_ready'
concept → relaxed thresholds
listing_ready → strict thresholds
3. Multi-Variant Delivery (Premium)

Return:

best candidate
1 alternative
🚀 Migration Plan
Step 1

Remove hard rejection gates:

isCandidateSufficient blocking returns
“no_candidate_generated” terminal state
Step 2

Refactor:

selectReturnCandidate()

→ replace with:

const bestCandidate = rankCandidates(allCandidates)[0]
Step 3

Inject classification layer:

const quality = classifyQuality(bestCandidate, preset.key)
Step 4

Update response contract:

{
  bestVariant,
  quality,
  deliveryMode: 'always_return_best'
}
🧩 Final Principle

The system’s job is NOT to decide if the result is perfect.
The system’s job is to show the best possible result and explain its quality clearly.

✅ Result

You now have:

predictable outputs
better UX
fewer silent failures
clearer product positioning

End of Spec