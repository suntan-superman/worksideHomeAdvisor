# Workside Home Advisor — CROSS-PROPERTY GENERALIZATION FIX (Codex Instructions)

## Context (Critical Insight)

You now have TWO real test cases:

### 1. Mainsail Property (Mid-readiness, cleaner data)
- Readiness: 68/100 (Almost Ready)
- Strong photo coverage (5/5)
- Clear pricing ($395k)
- Balanced content

### 2. Peralta Residence (Low readiness, incomplete data)
- Readiness: 39/100 (Needs Work)
- Weak photo coverage (0 marketplace-ready)
- Price not set
- More “in-progress” signals

---

### 🚨 CORE PROBLEM

Your system is currently:
👉 tuned for Peralta (problem property)

But needs to be:
👉 **adaptive across property states**

---

# 🔥 PRINCIPLE: ADAPTIVE REPORT SYSTEM

Every output must adapt to:

| Condition | Behavior |
|----------|--------|
| High readiness | Confident, marketing-focused |
| Mid readiness | Balanced prep + marketing |
| Low readiness | Prep-focused, NOT marketing-heavy |

---

# 🔥 PROMPT 1 — CONDITIONAL CONTENT ENGINE (P0)

Task:
Make ALL sections conditional based on readiness score.

Rules:

IF readiness >= 70:
    → emphasize marketing + positioning
    → minimize prep language

IF 50 <= readiness < 70:
    → balanced report

IF readiness < 50:
    → emphasize preparation
    → REDUCE marketing language
    → DO NOT oversell property

Goal:
Tone matches reality

---

# 🔥 PROMPT 2 — REMOVE GENERIC COPY SYSTEM-WIDE (P0)

Task:
Eliminate reusable generic phrases.

Fix:
- Only include feature if UNIQUE to property
- Otherwise remove

Goal:
Each property feels custom

---

# 🔥 PROMPT 3 — PHOTO PIPELINE MUST ADAPT (P0)

Task:
Fix photo logic across conditions.

IF marketplace-ready photos >= 3:
    → full gallery

IF 1–2:
    → partial gallery + note

IF 0:
    → DO NOT show marketing gallery
    → show preparation message instead

Goal:
Never fake visual readiness

---

# 🔥 PROMPT 4 — PRICING MODULE ADAPTATION (P1)

Task:
Handle missing pricing correctly.

IF price NOT set:
    → show:
       "Recommended range available — final pricing decision pending"

Goal:
Avoid awkward empty states

---

# 🔥 PROMPT 5 — ACTION PLAN SHOULD SCALE (P0)

Task:
Adjust action plan depth.

IF readiness < 50:
    → more detailed actions

IF readiness > 60:
    → shorter action list

Goal:
Effort matches need

---

# 🔥 PROMPT 6 — REMOVE DUPLICATE INSIGHT SYSTEM (P0)

Task:
Global deduplication.

Fix:
- Primary location only
- Short references elsewhere

Goal:
Cleaner, smarter report

---

# 🔥 PROMPT 7 — FLYER MUST BE CONDITIONAL (CRITICAL)

Task:
Flyer MUST adapt to readiness.

IF readiness < 50:
    → preview flyer ONLY
    → minimal marketing language

IF readiness >= 60:
    → full marketing flyer

Goal:
Flyer honesty builds trust

---

# 🔥 PROMPT 8 — REMOVE TEMPLATE STRUCTURE FEEL (P1)

Task:
Break template repetition.

Fix:
- Vary:
   - headline structure
   - feature order
   - section emphasis

Goal:
Feels dynamic, not templated

---

# 🔥 PROMPT 9 — CONTENT DENSITY ADAPTATION (P1)

Task:
Adjust density per property.

High readiness:
→ lighter, cleaner

Low readiness:
→ more guidance

Goal:
Balanced experience

---

# 🔥 PROMPT 10 — FINAL CROSS-PROPERTY VALIDATION (P0)

Checklist:

- Tone matches readiness
- No generic copy reused
- Photo logic correct
- Pricing handled gracefully
- No duplicate insights
- Flyer matches property condition

---

# 🚀 EXECUTION ORDER

1. Conditional engine
2. Photo pipeline fix
3. Flyer adaptation
4. Action plan scaling
5. Remove generic copy
6. Deduplication
7. Pricing handling
8. Density balancing
9. Template variation
10. Final validation

---

# 🏁 FINAL SUCCESS STATE

Mainsail:
👉 Clean, confident, ready

Peralta:
👉 Honest, prep-focused

System:
👉 Works for ANY property
