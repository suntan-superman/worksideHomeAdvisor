# AI Realtor Vision Redesign
**Purpose:** Reposition Vision from a fragile “AI interior design” system into a reliable **seller and realtor sales assistant** that produces believable, useful previews.

---

## 1. Product Reframe

### Old framing
- “Show flooring replacements”
- “Show tile or stone installs”
- “Show major finish transformations”

### New framing
- “Help sellers and agents explain likely improvement directions”
- “Help buyers imagine cleaner, brighter, simpler spaces”
- “Provide believable before/after planning visuals for reports and conversations”

### Core principle
Vision should optimize for:
- trust
- clarity
- speed
- believable outputs
- strong report visuals

Vision should **not** optimize for:
- exact material simulation
- construction-grade install previews
- interior-design experimentation
- complex large-surface generative reconstruction

This matches your product goal exactly: a **sales assistant**, not a full interior design app.

---

## 2. Keep / Change / Remove

## Keep
These are already aligned with the product and the current architecture:
- enhance listing quality
- light declutter
- medium declutter
- remove furniture
- cleanup empty room
- report story blocks
- variant history
- seller-facing concept disclaimers

Furniture removal is still worth keeping because it creates a large, obvious, high-value visual difference and already works materially better than surface replacement. The preset and provider path are already built around replicate for this use case. fileciteturn8file4

## Keep with redesign
- wall color previews
- floor finish previews

## Remove for now
- true tile / stone replacement as a core marketed feature
- exact flooring material simulation
- detailed installation-style finish previews

The current tile/stone path is still based on replicate inpainting rather than a true perspective-aware material pipeline, and recent logs show very low focus-region change and masked change scores on attempts. fileciteturn8file0turn8file4turn8file7

---

## 3. New Vision Feature Set

## Tier 1: Listing-safe enhancements
These should feel fast, safe, and dependable.

### 3.1 Enhance for Listing
Purpose:
- improve brightness
- improve clarity
- improve overall presentation

Pipeline:
- deterministic only

### 3.2 Light Declutter
Purpose:
- remove small distractions
- tidy counters and edges

Pipeline:
- replicate inpainting

### 3.3 Medium Declutter
Purpose:
- stronger cleanup for busy rooms

Pipeline:
- replicate inpainting

---

## Tier 2: Seller persuasion visuals
These are concept previews, but they must stay believable and simple.

### 3.4 Remove Furniture
Purpose:
- show openness
- help seller understand staging / simplification value

Pipeline:
- replicate inpainting
- cleanup pass if needed

### 3.5 Empty Room Cleanup
Purpose:
- smooth artifacts after furniture removal

Pipeline:
- replicate inpainting light cleanup

---

## Tier 3: Finish direction previews
These are not exact replacements. They are **directional finish concepts**.

### 3.6 Floor Tone Preview
Replace the current flooring set with tone-based presets:

- Lighten Floors
- Warm Floors
- Neutralize Floors
- Darken Floors

Do **not** market this as:
- tile installation preview
- stone replacement
- exact material replacement

Market it as:
- flooring direction
- tone and finish mood
- resale positioning

### 3.7 Wall Color Preview
Keep wall color previews, but reposition them as:
- Brighten Walls
- Warm Neutral Walls
- Soft Greige Walls

Do not claim exact paint matching.
Do claim:
- cleaner feel
- brighter feel
- more current-market neutral feel

---

## 4. Why Flooring Should Be Tone-Based

The current system architecture is strong in orchestration but the wrong underlying approach is being used for major material replacement.

### 4.1 What the code does well
- preset routing
- provider orchestration
- candidate scoring
- fallback logic
- finish-specific thresholds
- detailed review metrics

The orchestrator already evaluates candidates using masked change ratios, focus-region change ratios, outside-mask change ratios, and sufficiency rules. fileciteturn8file6turn8file3

### 4.2 What is failing
The tile/stone path is still based on replicate inpainting rather than a true perspective-aware material pipeline. The preset uses a replicate inpaint model and a prompt trying to force material replacement. fileciteturn8file4turn8file7

That is the mismatch:
- orchestration is sophisticated
- model/task fit is poor

### 4.3 Product decision
Stop promising exact material replacement.
Use floor transformations that preserve existing floor texture and geometry while changing:
- darkness
- warmth
- neutrality
- perceived finish direction

This is much more believable and much more useful in a sales workflow.

---

## 5. How Wall Colors Should Work

Wall colors are different from flooring because they are naturally closer to a **masked color transform** than a geometry-sensitive material reconstruction.

That means wall previews are still viable.

### 5.1 Keep wall previews
Keep:
- Bright White Walls
- Warm Neutral Walls
- Soft Greige Walls

### 5.2 Product positioning
Describe wall previews as:
- “paint direction”
- “neutralization concept”
- “brightening concept”

Not:
- “exact Sherwin-Williams match”
- “true paint simulation”

### 5.3 Technical strategy
Wall previews should stay on the deterministic local path because the code already has a dedicated local wall paint renderer, wall masks, and tone configs. fileciteturn8file2

### 5.4 UX guidance
If a wall preview is weak, show a lighter disclaimer:
- “Concept preview only. Final paint color and coverage may vary.”

Do not fail the request unless the output is truly near-original or structurally damaged.

---

## 6. Redesign the Preset Catalog

## Keep as-is
- Enhance for Listing
- Light Declutter
- Medium Declutter
- Remove Furniture
- Cleanup Empty Room

## Rename floor presets
Current:
- Light Wood Floors
- Medium Wood Floors
- Dark Hardwood Floors
- Neutral LVP Floors
- Tile / Stone Floors

New:
- Lighten Floors
- Warm Floors
- Darken Floors
- Neutralize Floors

Remove:
- Tile / Stone Floors

### Why
The current tile preset remains the unstable one and has consumed disproportionate effort. The logs show replicate attempts returning very low finish-change metrics and failing sufficiency. fileciteturn8file0

## Rename wall presets
Current:
- Warm Neutral Walls
- Bright White Walls
- Soft Greige Walls

New display labels:
- Warm Walls
- Brighten Walls
- Soft Greige Walls

These are easier for a seller to understand and less likely to imply exact paint specification.

---

## 7. New UX Copy

## Section title
Change from:
- Vision enhancements
- Finish updates

To:
- Buyer Appeal Previews

## Category labels
### Listing Safe
- Enhance for Listing
- Declutter
- Open Room Preview

### Finish Direction
- Brighten Walls
- Warm Walls
- Soft Greige Walls
- Lighten Floors
- Warm Floors
- Darken Floors
- Neutralize Floors

## Explanatory text
Use:
- “These previews help you visualize listing-friendly improvement directions.”
- “They are intended for planning and persuasion, not construction or exact material specification.”

---

## 8. Recommended Technical Architecture After Redesign

## 8.1 Deterministic-only
Use deterministic rendering only for:
- Enhance for Listing
- Wall previews
- Floor tone previews

This matches current code investment in local wall and local floor rendering. The local render path already exists in `renderLocalWallPaintVariantBuffer` and `renderLocalFloorVariantBuffer`. fileciteturn8file2

## 8.2 Replicate only
Use replicate only for:
- declutter
- remove furniture
- cleanup empty room
- selected premium kitchen/exterior concepts

### Remove replicate from floor tone previews
After redesign, floor tone previews should not need replicate at all.
That will:
- reduce latency
- reduce cost
- reduce weird artifacts
- improve consistency

## 8.3 Optional future path
If you later want premium flooring replacement, build it as a separate experimental feature using:
- floor plane detection
- depth/perspective estimation
- procedural texture mapping

Do not block product launch on this.

---

## 9. Concrete Code Direction for Codex

## 9.1 Remove `floor_tile_stone` from user-facing catalog
Keep internally only if needed for experiments, but hide it from product UI.

## 9.2 Replace floor presets with deterministic tone-only options
Use local floor renderer only:
- `floor_lighten`
- `floor_warm`
- `floor_darken`
- `floor_neutralize`

These can map to updated local tone configs in the floor renderer.

## 9.3 Keep wall presets on `local_sharp_only`
That already matches current routing expectations for paint presets in tests and provider routing. fileciteturn8file1turn8file3

## 9.4 Remove replicate chain for floor tone previews
Once tile/stone is gone, floor previews should be deterministic only.

## 9.5 Keep replicate chain for:
- remove_furniture
- cleanup_empty_room
- declutter presets
- kitchen premium concepts
- exterior premium concepts

That already aligns with existing preset definitions. fileciteturn8file4

---

## 10. Seller-Facing Report Strategy

This redesign actually improves your reports.

### Instead of saying:
- “Here is tile/stone replacement”

Say:
- “Here is a lighter, cleaner flooring direction”
- “Here is a darker, richer flooring direction”
- “Here is a warmer flooring direction”

That is more persuasive and less legally risky.

### Wall examples:
- “A brighter wall palette may make the room feel more open.”
- “A softer greige palette may feel more current to buyers.”
- “A warm neutral palette may reduce visual harshness and help buyers focus on the room.”

### Floor examples:
- “A lighter floor direction may brighten the room.”
- “A darker floor direction may add contrast and perceived richness.”
- “A neutralized floor direction may better match broad buyer tastes.”

---

## 11. What to Stop Spending Time On

Stop spending more days trying to perfect:
- exact tile grids
- stone realism
- grout realism
- fully replacing wood floors with tile using inpainting
- repeated prompt tweaks for the same tile preset

The recent output and metrics show that the system is not failing because of one small bug. It is fighting the wrong class of task for the model and pipeline being used. fileciteturn8file0turn8file4turn8file7

---

## 12. Final Product Recommendation

### Ship this story:
AI Realtor helps sellers and agents:
- clean up rooms
- remove clutter
- preview openness
- brighten spaces
- test simple wall-color directions
- test floor tone directions
- generate clearer seller conversations and stronger reports

### Do not ship this story:
AI Realtor can:
- accurately replace flooring materials
- simulate true tile or stone installation
- provide construction-grade finish previews

---

## 13. Final Decision

### Should you scrap Vision entirely?
No.

### Should you scrap tile/stone replacement as a core feature?
Yes, for now.

### Should you keep wall color previews?
Yes.

### Should you keep floor previews?
Yes, but only as tone / finish direction previews.

### Should you move on?
Yes. After this redesign, stop trying to perfect large-surface generative material swaps and spend time on features that will actually make the product feel strong, polished, and useful.

---

## 14. Codex Handoff Summary

Redesign Vision as a **seller and realtor sales-assistant preview system**, not an interior design engine. Keep enhancement, declutter, furniture removal, cleanup, wall color previews, and floor tone previews. Remove true tile/stone replacement from the user-facing product because the current inpainting-based approach is unreliable for large-surface material reconstruction. Reposition floor previews as lighter, darker, warmer, and neutral finish directions using deterministic local transforms only. Keep wall previews as deterministic masked color concepts. Preserve disclaimers and report story blocks, and focus the UX on buyer appeal, listing readiness, and seller persuasion rather than exact material simulation.
