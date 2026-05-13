# Home Advisor Simplification Reset — Codex Implementation Plan

This document defines the required simplification reset for the Home Advisor Vision system.

Key direction:
- simplify aggressively
- remove workflow complexity
- hide orchestration details
- make the product seller-first
- keep Vision supportive, not dominant
- prioritize reliability over advanced AI

## Core Product Reset

The current Vision experience is:
- too complex
- too experimental
- too internally focused
- too workflow-heavy

The new direction is:
- simple
- fast
- trustworthy
- obvious
- useful immediately

---

# Replace Entire Vision Workflow With 3 Actions

## ACTION 1 — Improve Photo

Purpose:
- fast deterministic enhancement
- listing-safe
- reliable

Uses:
- local_sharp only
- no generative AI

Operations:
- brightness
- contrast
- white balance
- sharpening
- shadow recovery
- subtle crop

UI Copy:

"Quick listing-safe enhancement that improves brightness, clarity, and presentation while keeping the room realistic."

---

## ACTION 2 — Clean Up Photo

Purpose:
- remove visible distractions
- simplify clutter
- preserve room realism

Allowed:
- throw blankets
- remotes
- cords
- papers
- shelf clutter
- countertop clutter
- loose small objects

Not allowed:
- wall changes
- flooring changes
- room reconstruction
- window changes
- major furniture removal

UI Copy:

"Reduce visual distractions and simplify clutter while preserving the real room layout and furniture."

If AI result is weak:
DO NOT return weak enhancement.
Return seller guidance instead.

---

## ACTION 3 — Explore Ideas

Purpose:
- concept previews only

Contains:
- Open Room Preview
- Wall Color Preview
- Flooring Preview
- Kitchen Preview
- Exterior Preview

UI Copy:

"Concept previews for planning and inspiration only."

These are NOT listing-ready.

---

# Remove Entire Workflow System

DELETE:
- First Impression
- Smart Enhancement
- Listing Ready
- Finalize
- Pipeline package
- Marketplace status
- Safe Enhancement Fallback
- Execution path
- Structural realism
- Confidence metrics
- Stage guidance
- Workflow recommendations
- Readiness delta
- Current workflow draft

Users should never think:
"What stage am I in?"

---

# New Vision Layout

-------------------------------------------------
PHOTO
-------------------------------------------------

[ before / after slider ]

-------------------------------------------------
QUICK ACTIONS
-------------------------------------------------

[ Improve Photo ]
[ Clean Up Photo ]
[ Explore Ideas ]

-------------------------------------------------
SELLER GUIDANCE
-------------------------------------------------

• remove throw blanket
• simplify shelf decor
• open blinds evenly
• retake from slightly wider angle

-------------------------------------------------
SAVE
-------------------------------------------------

[ Save Enhanced Version ]
[ Keep Original ]

---

# Remove Internal AI Terminology

Never show:
- fallback
- hallucination
- artifact
- geometry
- pipeline
- confidence
- publishability
- stage
- orchestration

Replace:

"Safe Enhancement Fallback"

with:

"Enhanced Preview"

---

# Seller Guidance Is Critical

If enhancement quality is weak:
DO NOT pretend the enhancement succeeded.

Instead provide guidance.

Example:

"This room already photographs fairly well.

To improve the listing photo:
• remove the throw blanket
• simplify shelf decor
• reduce coffee-table clutter
• open blinds evenly"

---

# Keep Backend Complexity Hidden

Keep internally:
- trust scoring
- ranking
- masking
- orchestration
- OpenAI integration
- Replicate integration
- deterministic enhancement

But hide it from users.

---

# Simplify API Responses

OLD:
- pipelineDescriptor
- readinessDelta
- publishability
- workflowStageKey
- deliveryMode

NEW:

{
  resultType: 'enhanced' | 'cleanup' | 'concept' | 'guidance_only',
  imageUrl: '',
  message: '',
  sellerGuidance: [],
  improvementsApplied: [],
  conceptOnly: false
}

---

# Simplify History

Replace workflow history with:

Simple attempt drawer:

- Enhanced Photo
- Cleanup Attempt
- Warm Wall Concept

Only:
- thumbnail
- timestamp
- action used

---

# Product Philosophy

Home Advisor is NOT:
- an AI Photoshop competitor
- an AI staging platform
- an architectural rendering suite

Home Advisor IS:
- a seller preparation platform

Core strengths:
- pricing/comps
- seller guidance
- readiness
- providers
- reports/flyers
- simple trustworthy enhancement

Vision should support those strengths.

---

# Immediate Priorities

1. Simplify UI
2. Make Improve Photo reliable
3. Replace weak AI with seller guidance
4. Hide orchestration complexity
5. Keep concept previews optional

---

# Final Product Principle

"Simple beats impressive.
Trustworthy beats clever.
Helpful beats experimental."
