# Vision Pipeline Stabilization & Realism Fix Plan

## Executive Summary

The current Vision pipeline is actually much closer than it appears.

The screenshots and code reveal that:

- The orchestration architecture is strong.
- The scoring system is sophisticated.
- The fallback logic is intelligent.
- The masking framework is significantly more advanced than typical real-estate AI tools.

However:

The system is suffering from a core strategic issue:

# The pipeline is attempting “semantic reconstruction” instead of “listing-safe constrained editing.”

That is the root problem.

The current Replicate workflows are trying to:

- recreate geometry
- hallucinate missing surfaces
- invent wall continuity
- rebuild flooring
- regenerate lighting
- infer missing architecture

This creates:

- warped windows
- lighting inconsistency
- fake geometry
- perspective drift
- furniture hallucination
- low-confidence previews
- “concept only” results

For Home Advisor:

THIS IS TOO AGGRESSIVE.

Your business objective is NOT:

“Create artistic redesigns.”

Your objective is:

# Create trustworthy first-impression improvements for sellers and agents.

That means:

- realism > creativity
- trust > transformation
- consistency > dramatic changes
- publish-safe > visually impressive

---

# The Most Important Strategic Change

## STOP trying to fully remove furniture using generative reconstruction.

Instead:

# Transition to:

## “Listing-safe subtraction workflows”

Meaning:

- simplify
- soften
- reduce
- declutter
- visually minimize
- brighten
- stage lightly
- clean edges
- improve perception

WITHOUT attempting to rebuild entire rooms.

This changes everything.

---

# Why Zillow-Like Systems Look Better

Competitors succeed because they:

- constrain edits heavily
- use deterministic enhancement
- avoid rebuilding structure
- minimize AI freedom
- accept subtle improvements
- avoid empty-room generation
- preserve windows at all costs
- preserve perspective at all costs

Your current pipeline gives the AI too much freedom.

---

# The Biggest Technical Problems

---

# 1. Furniture Removal Is Over-Scoped

Current:

```js
remove_furniture
```

tries to:

- remove sofas
- rebuild walls
- rebuild windows
- rebuild floor reflections
- infer geometry
- repair shadows

This is causing:

- warped window columns
- fake floor patterns
- inconsistent brightness
- impossible reflections
- wall distortions

---

# REQUIRED FIX

## Replace “Remove Furniture” with:

# "Open Room Simplification"

Meaning:

DO NOT:

- fully remove large furniture
- reconstruct room structure
- regenerate walls
- recreate missing floors

INSTEAD:

- reduce visual dominance
- simplify clutter
- brighten around furniture
- soften dark areas
- remove portable distractions only
- reduce small movable items

---

# New Product Positioning

Replace:

```txt
Remove Furniture
```

with:

```txt
Open Room Preview
```

and:

```txt
Reduce visual distractions and simplify the room to help buyers focus on space and layout.
```

This dramatically lowers user expectations while improving trust.

---

# CRITICAL UI ISSUE

## The warning system is backwards.

Current:

```txt
Preview ready with warning
Low-confidence preview
```

This destroys confidence.

Users immediately assume:

- the AI failed
- the app is unreliable
- results are broken

---

# REQUIRED FIX

Replace technical warnings with:

## Human-first messaging.

Examples:

Instead of:

```txt
Low-confidence preview — limited change detected.
```

Use:

```txt
Subtle preview generated.
This room already photographs well, so changes were intentionally kept conservative.
```

Instead of:

```txt
Needs extra review
```

Use:

```txt
Concept preview
Use this to explore possibilities before preparing final listing photos.
```

---

# REMOVE THESE TERMS ENTIRELY

NEVER SHOW USERS:

- hallucination
- artifacting
- low confidence
- structural inconsistency
- distortion
- geometry issue
- failed generation
- masking issue
- pipeline failure

Those are INTERNAL ENGINEERING TERMS.

---

# 2. Window Protection Is Still Not Strong Enough

Your masking system is impressive.

However:

The model is still touching windows.

The screenshots prove this.

This is the #1 realism killer.

---

# REQUIRED FIX

## HARD LOCK WINDOWS

Do NOT merely “discourage” edits.

Actually:

# prohibit generation in those regions.

Meaning:

When masks are generated:

```js
window pixels = immutable
```

NOT:

```js
window pixels = lower confidence
```

---

# Add Immutable Window Regions

New concept:

```js
protectedRegions
```

Example:

```js
{
  windows: true,
  trim: true,
  ceilingLines: true,
  builtIns: true
}
```

Then:

- freeze pixels
- composite original pixels back over result
- NEVER allow diffusion to modify them

---

# This is the single biggest realism improvement you can make.

Especially for:

- living rooms
- kitchens
- bay windows
- high brightness scenes

---

# 3. The Pipeline Is Too Generative

Current chain:

```js
replicate_basic
replicate_advanced
openai_edit
local_sharp
```

This assumes:

“more AI passes = better.”

That is NOT true for real-estate photography.

Each generative pass:

- compounds drift
- compounds geometry changes
- compounds lighting inconsistency
- compounds perspective issues

---

# REQUIRED FIX

# New Pipeline Philosophy

## Deterministic First
## Generative Last

---

# New Order

## Stage 1 — Deterministic Cleanup

Use Sharp/OpenCV only:

- brightness normalization
- shadow recovery
- white balance
- local contrast
- perspective correction
- vertical line stabilization
- highlight recovery
- denoise
- sharpen

NO AI YET.

---

# Stage 2 — Safe Semantic Cleanup

Very constrained:

Allowed:

- countertop clutter
- small decor
- portable items
- cables
- trash cans
- loose objects

NOT allowed:

- sofas
- beds
- windows
- cabinets
- walls
- floors

---

# Stage 3 — Optional Concept Preview

ONLY if user explicitly requests:

- wall color
- floor replacement
- empty room
- kitchen redesign

AND:

- clearly label as concept
- never auto-promote to listing-ready

---

# 4. Listing Refresh Should NEVER Use Generative AI

This is critical.

Your:

```js
combined_listing_refresh
```

should NOT use Replicate.

Ever.

---

# Listing Refresh Should Be 100% Deterministic

Using:

- Sharp
- OpenCV
- local enhancement
- histogram balancing
- local tone mapping
- adaptive white balance
- edge sharpening
- vertical correction
- mild object cleanup

This alone will produce:

- faster execution
- trustworthy results
- publish-safe outputs
- consistent realism
- dramatically lower failures

---

# Suggested Split

## Listing Ready

NO generative AI.

Only:

- deterministic enhancement
- cleanup
- polish

---

## Concept Preview

Generative AI allowed.

But:

- sandboxed
- clearly labeled
- never auto-promoted

---

# 5. Your Quality Scoring Is Too Engineering-Centric

Current:

- maskedChangeRatio
- edge density
- luminance delta
- perceptibility

These are technically smart.

But they do NOT reflect:

# “Would a seller trust this?”

---

# REQUIRED FIX

Add:

## Real-Estate Trust Scoring

Example:

```js
trustScore
```

Factors:

- window integrity
- perspective integrity
- ceiling line stability
- floor continuity
- no impossible geometry
- believable lighting
- no AI-looking texture
- no duplicated objects

Weight this MORE than transformation strength.

---

# IMPORTANT

A subtle but believable result is BETTER than:

- a dramatic but fake result

Always.

---

# 6. Your Local Sharp Pipeline Should Become Primary

Currently:

```js
local_sharp
```

is treated like fallback.

This is backwards.

---

# REQUIRED FIX

Promote local deterministic enhancement to:

# PRIMARY LISTING ENGINE

Replicate/OpenAI should become:

# Optional Concept Modules

---

# 7. Add Confidence Tiers Internally Only

Internally:

```js
publish_safe
safe_preview
concept_only
experimental
```

Externally:

Never show those labels.

Instead:

```txt
Listing Ready
Enhanced Preview
Design Preview
```

---

# 8. Fix the “Always Return Best” Strategy

Current problem:

The pipeline returns:

“least bad candidate.”

But users still see broken geometry.

---

# REQUIRED FIX

Add:

```js
minimumTrustThreshold
```

If below threshold:

DO NOT SHOW GENERATED IMAGE.

Instead:

Return:

- original image
- deterministic enhancement only
- subtle cleanup

This is FAR better than showing broken AI.

---

# 9. Add a Vision Safety Governor

Before ANY image is returned:

Run:

## Structural Truth Check

Reject if:

- windows shifted
- ceiling bent
- floor perspective broken
- wall edges warped
- duplicate furniture
- impossible shadows
- inconsistent vanishing points
- geometry drift

---

# 10. Empty Rooms Are NOT Your Core Business

This is important strategically.

Home Advisor is:

# seller guidance software

NOT:

# interior design AI

Therefore:

Your competitive advantage is:

- listing readiness
- seller preparation
- realistic improvements
- provider coordination
- marketing workflow
- first impressions
- trust

NOT:

- fantasy redesigns
- architectural reconstruction
- cinematic staging

---

# Recommended Product Direction

# PRIMARY VALUE

## First Impression Engine

Focus on:

- brighter rooms
- cleaner rooms
- less clutter
- improved composition
- balanced exposure
- cleaner countertops
- better presentation
- realistic polish

This is where you can dominate.

---

# DO NOT COMPETE WITH:

- interior AI design tools
- renovation visualization tools
- full architectural rendering systems

Those are completely different businesses.

---

# Exact Engineering Changes Required

# PRIORITY 1

## Make Listing Refresh Deterministic Only

### Remove Replicate/OpenAI from:

```js
combined_listing_refresh
enhance_listing_quality
lighting_boost
```

Use:

```js
local_sharp only
```

---

# PRIORITY 2

## Freeze Window Pixels

Add:

```js
immutableWindowComposite
```

After generation:

Composite original windows back onto result.

Mandatory.

---

# PRIORITY 3

## Replace Furniture Removal With:

```txt
Open Room Preview
```

Reduce scope dramatically.

Do NOT reconstruct architecture.

---

# PRIORITY 4

## Add Trust Score

Hard reject:

- warped windows
- bent perspective
- inconsistent shadows
- geometry drift

---

# PRIORITY 5

## Change User Messaging

Stop exposing engineering uncertainty.

Use:

- realistic
- conservative
- concept preview
- enhanced preview
- listing-ready

---

# PRIORITY 6

## Add Before/After Slider Everywhere

This increases trust dramatically.

Users forgive subtle changes.

They do NOT forgive fake geometry.

---

# PRIORITY 7

## Add “Safe Mode” as Default

Default mode:

```txt
Listing Safe
```

Advanced concept mode:

```txt
Explore Ideas
```

Huge UX improvement.

---

# Final Strategic Recommendation

You are EXTREMELY close.

But:

The current system is trying to be:

- Zillow + interior design AI + renovation AI + staging AI

That is too broad.

---

# Narrow the mission.

Become:

# The BEST seller-first listing preparation platform.

That means:

- trustworthy
- subtle
- realistic
- fast
- publish-safe
- professional

If you make that shift:

the entire Vision pipeline becomes dramatically stronger.

And:

your outputs will immediately look more premium.

Even with LESS AI.

Ironically:

# the less AI freedom you allow,
# the better the product becomes.

---

# Most Important Single Fix

If you only do ONE thing:

# STOP allowing AI to modify windows.

That alone will massively improve realism and trust.

