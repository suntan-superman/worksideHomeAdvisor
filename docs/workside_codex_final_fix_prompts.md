# Workside Home Advisor — FINAL FIX PROMPTS (Codex-Ready)

## Purpose
These prompts target ONLY the remaining critical issues after the latest iteration.

Focus:
- Fix broken action system
- Enforce deterministic flyer logic
- Eliminate provider dead-ends
- Improve CTA + conversion
- Remove redundancy
- Elevate ROI + action visibility

Run these AFTER your previous implementation.

---

# 🔥 PROMPT 1 — FIX BROKEN ACTION PIPELINE (P0)

```text
Task:
Fix the structured recommendation → action card pipeline.

Current issue:
Report shows:
"No structured recommendation actions were generated"

But recommendations clearly exist.

Steps:
1. Locate recommendation generation logic.
2. Ensure ALL recommendations map to structured action objects.
3. Add fallback mapper:
   IF structured actions missing:
       → convert raw recommendations into action cards

Each action must include:
- title
- priority (P1/P2/P3)
- category (photo, staging, exterior, pricing)
- estimated cost
- expected impact
- CTA label

Output:
- Action cards MUST always render (never empty)

Add logging:
- Log count of recommendations vs action cards
- Throw warning if mismatch

Deliverable:
docs/codex/action-pipeline-fix.md
```

---

# 🔥 PROMPT 2 — ENFORCE DETERMINISTIC FLYER MODE (P1)

```text
Task:
Fix flyer mode inconsistency.

Current issue:
Same property generates BOTH preview and launch-ready modes.

Implement strict rule:

IF readiness < 50 OR marketplace_ready_photos < 2:
    mode = "preview"
ELSE IF readiness >= 70 AND marketplace_ready_photos >= 3:
    mode = "launch-ready"
ELSE:
    mode = "preview"

Requirements:
- Centralize logic in ONE function
- Remove any conflicting overrides
- Log selected mode + reason

Output must NEVER contradict readiness score.

Deliverable:
docs/codex/flyer-mode-fix.md
```

---

# 🔥 PROMPT 3 — PROVIDER FALLBACK (P1)

```text
Task:
Eliminate "No providers found" output.

Implementation:
1. If marketplace providers exist → use them
2. ELSE → fetch fallback providers via:
   - Google Places OR existing provider API
3. If still empty:
   → generate placeholder providers:
      - "Local Professional Photographer"
      - "Local Cleaning Service"
      - "Home Staging Specialist"

Each provider must include:
- name
- category
- reason matched

Never show empty provider section.

Deliverable:
docs/codex/provider-fallback-fix.md
```

---

# 🔥 PROMPT 4 — REMOVE REDUNDANCY (P2)

```text
Task:
Eliminate repeated insights across report.

Remove duplicates of:
- "5 photo retakes still need attention"
- repeated readiness explanations
- repeated action lists

Rules:
- Each insight appears ONCE in primary section
- Other sections reference it briefly

Reduce report length by ~25% without losing meaning.

Deliverable:
docs/codex/redundancy-cleanup.md
```

---

# 🔥 PROMPT 5 — MAKE ROI DOMINANT (P2)

```text
Task:
Make ROI visually dominant.

Changes:
- Move ROI to top 1/3 of readiness page
- Increase font size (2x current)
- Add label:
  "Estimated Value at Risk"

Add simple comparison:
"$2,720 upside vs $1,700 prep cost"

Ensure:
- ROI stands out more than descriptive text
- Always visible in quick summary

Deliverable:
docs/codex/roi-visual-upgrade.md
```

---

# 🔥 PROMPT 6 — FIX CTA (P1)

```text
Task:
Replace weak CTA across flyer + report.

Replace:
"Please contact seller"

With:

Primary CTA:
- "Request Showing"
- "Get Property Details"

Secondary:
- phone
- email

Rules:
- CTA must be visually distinct
- Use button-style formatting
- Add CTA metadata (route or link placeholder)

Apply to:
- flyer cover
- flyer footer
- report final page

Deliverable:
docs/codex/cta-upgrade.md
```

---

# 🔥 PROMPT 7 — ADD URGENCY LAYER (P2)

```text
Task:
Add urgency without exaggeration.

Examples:
- "Addressing these items before listing may improve first impressions and buyer engagement."
- "Current photo quality may limit showing performance."

Apply to:
- summary
- readiness
- action plan

Do NOT:
- fabricate statistics
- sound alarmist

Deliverable:
docs/codex/urgency-layer.md
```

---

# 🔥 PROMPT 8 — CLEAN READINESS LAYOUT (P2)

```text
Task:
Improve visual clarity of readiness section.

Changes:
- Convert stacked text → card layout
- Separate:
  - metrics
  - risk/opportunity
  - actions
  - ROI

Add spacing:
- consistent padding
- clear section separation

Ensure:
- readable in under 5 seconds

Deliverable:
docs/codex/readiness-layout-fix.md
```

---

# 🔥 PROMPT 9 — IMPROVE PHOTO FEEDBACK (P3)

```text
Task:
Enhance photo feedback clarity.

Replace:
"Photo review pending"

With:
- "Lighting too dark"
- "Composition unbalanced"
- "Clutter visible"

Ensure:
- each photo has specific feedback
- max 1 short sentence

Deliverable:
docs/codex/photo-feedback-upgrade.md
```

---

# 🔥 PROMPT 10 — FINAL VALIDATION PASS (P0)

```text
Task:
Run final validation across report + flyer.

Checklist:
- No empty action cards
- No empty provider section
- Flyer mode matches readiness
- No duplicate insights
- CTA upgraded everywhere
- ROI visible and prominent

If any fail:
→ log warning

Deliverable:
docs/codex/final-validation.md
```

---

# 🚀 EXECUTION ORDER

1. Action pipeline fix (CRITICAL)
2. Flyer mode fix
3. Provider fallback
4. CTA upgrade
5. Redundancy cleanup
6. ROI upgrade
7. Readiness layout
8. Urgency layer
9. Photo feedback
10. Final validation

---

# ✅ SUCCESS STATE

Seller Report:
- Always actionable
- No dead ends
- Clean + professional
- Fast to scan

Flyer:
- Always consistent with readiness
- Strong CTA
- Conversion-focused

---

# 🔥 FINAL NOTE

Do NOT expand scope.
Fix precision, not features.
