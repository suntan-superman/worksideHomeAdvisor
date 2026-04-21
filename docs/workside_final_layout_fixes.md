# Workside Home Advisor — FINAL UI / LAYOUT FIXES (Codex Instructions)

## Context
Latest outputs reviewed:
- Seller Report: see page 1 (strong cover) and page 11 (readiness dashboard) fileciteturn7file0  
- Flyer: hero + gallery issues fileciteturn7file1  

You are very close. Remaining issues are now:
- Missing / weak photo usage in flyer
- Blank / underutilized pages
- Layout inconsistencies
- Minor UX polish gaps

---

# 🔥 PRIMARY ISSUES TO FIX

## 1. FLYER PHOTO USAGE (CRITICAL)

Problem:
- Flyer hero uses images, but gallery page says:
  "photo set still being curated" fileciteturn7file1  
- This creates inconsistency + weak perception

---

# PROMPT 1 — FIX FLYER IMAGE PIPELINE (P0)

```text
Task:
Ensure flyer ALWAYS displays a complete, intentional photo set.

Rules:
1. Use BEST available photos (even if imperfect)
2. Minimum:
   - 1 exterior
   - 1 kitchen
   - 1 living/main area
3. If photos are weak:
   → still show them
   → label flyer as "Preview Mode"

Remove:
- "photo set still being curated"

Replace with:
- "Current preview gallery — final images coming soon"

Goal:
Never show empty or placeholder gallery
```

---

## 2. BLANK / LOW-VALUE PAGES

Problem:
- Some pages exist mainly as separators or repeated headers
- Example: thin content pages around readiness + ROI sections fileciteturn7file0  

---

# PROMPT 2 — REMOVE OR MERGE LOW-VALUE PAGES (P1)

```text
Task:
Eliminate pages that do not add new information.

Rules:
- Each page must answer a NEW question
- If not → merge into previous page

Target:
- Standalone ROI pages
- Thin divider pages
- Repeated header/footer-only pages

Goal:
Reduce total pages by ~15–25%
```

---

## 3. LAYOUT INCONSISTENCY

Problem:
- Some sections are tight (photo grid)
- Others feel spaced out or empty
- Cards not always aligned consistently

---

# PROMPT 3 — STANDARDIZE GRID SYSTEM (P1)

```text
Task:
Apply consistent layout grid across all pages.

Rules:
- Use 12-column grid
- Consistent margins:
  desktop: 32px
- Card spacing:
  gap: 16–24px

Ensure:
- All cards align vertically
- No floating elements
- Equal padding inside all cards

Goal:
Everything feels structured and balanced
```

---

## 4. READABILITY / SPACING

Problem:
- Some text blocks still dense
- Some sections too tight (especially actions + pricing)

---

# PROMPT 4 — IMPROVE SPACING + BREATHING ROOM (P2)

```text
Task:
Improve readability via spacing.

Rules:
- Increase line height for paragraphs
- Add vertical spacing between sections
- Limit paragraph width (~60–75 chars)

Goal:
Make report feel premium and easy to read
```

---

## 5. PHOTO GRID POLISH

Problem:
- Photo grid is good, but:
  - inconsistent sizing
  - alignment slightly off
  - labels compete with image

👉 See page 16 gallery fileciteturn7file0  

---

# PROMPT 5 — POLISH PHOTO GRID (P2)

```text
Task:
Refine photo gallery layout.

Fix:
- Uniform image height
- Consistent aspect ratio
- Overlay labels cleaner (top-left only)

Add:
- subtle shadow
- rounded corners

Ensure:
- images feel like a system, not separate blocks
```

---

## 6. FLYER VISUAL HIERARCHY

Problem:
- Hero is strong
- But lower sections feel flat / repetitive

---

# PROMPT 6 — STRENGTHEN FLYER STRUCTURE (P1)

```text
Task:
Improve flyer layout hierarchy.

Structure:

1. Hero (image + title)
2. Key highlights (left column)
3. Image gallery (right column)
4. Pricing + CTA block (bottom)

Rules:
- Do NOT stack everything vertically
- Use 2-column layout where possible

Goal:
Make flyer feel like a designed brochure, not a report
```

---

## 7. CTA CONSISTENCY

Problem:
- CTA appears multiple times but not always visually dominant

---

# PROMPT 7 — CTA VISUAL CONSISTENCY (P1)

```text
Task:
Standardize CTA appearance.

Rules:
- Same button style everywhere
- Same color
- Same size

Placement:
- Top (hero)
- Bottom (final section)

Goal:
Clear conversion path
```

---

## 8. FINAL POLISH (MICRO-DETAILS)

---

# PROMPT 8 — MICRO UI POLISH (P2)

```text
Task:
Apply final polish pass.

Checklist:
- Align all icons
- Ensure consistent font weights
- Remove awkward line breaks
- Fix any overflow text
- Ensure no orphan words

Goal:
Make output feel designed, not generated
```

---

# 🚀 EXECUTION ORDER

1. Fix flyer images (CRITICAL)
2. Remove blank pages
3. Standardize grid
4. Improve flyer structure
5. CTA consistency
6. Photo grid polish
7. Spacing improvements
8. Final micro polish

---

# ✅ SUCCESS STATE

Seller Report:
- No wasted pages
- Clean, consistent layout
- Balanced spacing

Flyer:
- Always shows photos
- Strong visual hierarchy
- Feels like a real marketing asset

---

# 🔥 FINAL NOTE

You are no longer fixing logic.
You are refining EXPERIENCE.

Think:
👉 “Would an agent confidently show this to a client?”
