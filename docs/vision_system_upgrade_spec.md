Vision System Upgrade Spec
(Warm Walls + Surface Finish Reliability v2)
🎯 OBJECTIVE

Fix two core issues in surface-finish presets:

Low perceptibility (users can’t see changes)
Hallucinations (e.g., radiators appearing)

Target outcome:

Changes are obvious, intentional, and explainable
Zero structural hallucinations
Output is trustworthy for real estate decision-making
1. PERCEPTIBILITY UPGRADE SYSTEM
Problem

Current prompts allow subtle changes:

Users cannot confidently identify what changed
System accepts low-visibility outputs

Warm wall in real-world terms should be:

Cream / beige / soft taupe shift
Clearly warmer than cool gray or stark white
(“warm neutrals create a more inviting and comfortable space”) ()
Solution
🔧 Prompt Upgrade (ALL paint_* presets)
Replace:

"shift toward a warmer neutral direction"

With:

"Change the wall color to a clearly warmer beige, cream, or soft taupe tone.
The difference must be immediately noticeable at first glance.
Avoid subtle or barely visible changes."

🔧 Add Hard Visibility Constraint

Append to ALL wall prompts:

"Ensure the wall color shift is visually obvious without needing comparison.
The new tone should be clearly distinguishable from the original image."

🔧 Enforce Perceptibility Thresholds

Update isCandidateSufficient for paint:

OLD:

maskedChangeRatio >= 0.07
maskedColorShiftRatio >= 0.035

NEW:

maskedChangeRatio >= 0.12
maskedColorShiftRatio >= 0.06
maskedLuminanceDelta >= 0.02
🔧 Add Perceptibility Score
perceptibilityScore =
  maskedChangeRatio * 0.5 +
  maskedColorShiftRatio * 0.3 +
  abs(maskedLuminanceDelta) * 0.2;

Reject if:

perceptibilityScore < 0.08
2. WALL MASKING V2 (CRITICAL)
Problem

Mask includes:

floor edges
window regions
baseboards

→ causes hallucinations (radiator appeared)

Solution
🔧 Mask Exclusion Zones

Apply BEFORE generation:

wallMask = wallMask
  - bottom 10% of image (floor/baseboard zone)
  - window bounding boxes
  - high-edge-density regions
🔧 Window Detection (simple v1)

Heuristic:

bright rectangular regions
vertical/horizontal edge clusters

Remove:

if (region.brightness > threshold && region.rectangularity > 0.7)
  excludeFromMask(region)
🔧 Edge Density Filter

Reject unstable areas:

if (edgeDensity > threshold)
  excludeFromMask(region)
🔧 Trim Protection

Protect:

baseboards
crown molding
window frames
if (edgeDensity high AND horizontal alignment)
  excludeFromMask(region)
3. HALLUCINATION REJECTION LAYER
Problem

Model can:

add radiators
add vents
add fake furniture

Current system:

only weakly penalizes this
Solution
🔧 Hard Constraint in Prompt

Add to ALL paint presets:

"Do NOT add any new objects, fixtures, radiators, vents, or architectural elements.
Only modify wall paint color."

🔧 Detection Heuristic (post-generation)

Reject candidate if:

newObjectDetected =
  newFurnitureAdditionRatio > 0.02 ||
  maskedEdgeDensityDelta > 0.01 ||
  unexpected vertical structure detected
🔧 Vertical Object Detection (simple)

Detect hallucinated objects like radiators:

if (
  verticalEdgeCluster near bottom of wall &&
  not present in original image
)
  rejectCandidate()
🔧 Structural Drift Guard

Reject if:

topHalfChangeRatio > 0.08
outsideMaskChangeRatio > 0.12
4. RANKING IMPROVEMENTS

Prioritize:

No hallucinations
High perceptibility
Low structural drift
Updated Ranking Priority
1. newFurnitureAdditionRatio (LOWER)
2. maskedEdgeDensityDelta (LOWER)
3. perceptibilityScore (HIGHER)
4. maskedChangeRatio (HIGHER)
5. EXPECTED OUTPUT (SUCCESS CRITERIA)

A correct "Warm Walls" result:

✅ Walls clearly warmer (cream/beige shift)
✅ Immediate visual difference
✅ No added objects
✅ Windows, trim, floors untouched
✅ Lighting preserved

6. FAILURE CONDITIONS

Reject output if:

❌ User must “look closely” to see change
❌ Any new object appears
❌ Floor/wall boundary altered
❌ Window brightness changes

7. SUMMARY (FOR CODEX)

Implement:

Stronger prompt language (force visible change)
Mask tightening (remove floor + windows)
Hallucination detection (new object rejection)
Higher perceptibility thresholds
🚀 RESULT

This upgrade moves system from:

"subtle AI enhancement"

→ to →

"clear, trustworthy real estate visualization tool"