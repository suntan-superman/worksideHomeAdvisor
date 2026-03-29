# Workside Home Advisor
## Pixel-Level Tab Layout Specification
### Codex-Ready UI Blueprint

Last Updated: 2026-03-28

---

# 1. GLOBAL LAYOUT

## Page Structure

HEADER (fixed)
ACTION BAR (sticky)
TABS (sticky)
CONTENT AREA (scrollable)

---

# 2. HEADER (64px height)

LEFT:
- Property Name (H1)
- Address (subtext)

RIGHT:
- Refresh Pricing (primary)
- Generate Report (secondary)
- Back to Dashboard (ghost)

---

# 3. ACTION BAR (56px height, sticky)

Buttons (left to right):
- Add Photos
- Select Photos
- Enhance
- Generate Flyer
- Generate Report

Style:
- pill buttons
- primary = filled (Enhance / Report)
- others = outline

---

# 4. TAB BAR (48px height, sticky)

Tabs:

[ Overview ] [ Pricing ] [ Photos ] [ Vision ] [ Brochure ] [ Report ] [ Checklist ]

Behavior:
- underline active tab
- horizontal scroll on smaller screens

---

# 5. CONTENT GRID

Desktop layout:
- max width: 1400px
- grid: 12 columns
- gap: 24px

---

# 6. OVERVIEW TAB

GRID:

LEFT (8 cols):
- Hero Card
- AI Summary
- Recent Outputs

RIGHT (4 cols, sticky):
- Readiness Score
- Next Action
- Quick Stats

---

# 7. PRICING TAB

GRID:

LEFT (7 cols):
- Map (500px height)

RIGHT (5 cols):
- Comps List (scrollable)

BELOW FULL WIDTH:
- Pricing Narrative

---

# 8. PHOTOS TAB

GRID:

LEFT (8 cols):
- Photo Grid

RIGHT (4 cols, sticky):
- Selected Photo Detail
  - Image preview
  - AI scores
  - Actions:
    - Mark as Candidate
    - Enhance
    - Declutter
    - Add Note

---

# 9. VISION TAB

GRID:

TOP:
- Before / After (full width)

BOTTOM:

LEFT (6 cols):
- Action Presets

RIGHT (6 cols):
- Variant Gallery

---

# 10. BROCHURE TAB

GRID:

LEFT (5 cols):
- Controls
  - Headline
  - Description
  - Image selection

RIGHT (7 cols):
- Live Preview

---

# 11. REPORT TAB

GRID:

LEFT (5 cols):
- Report Controls
- Section Toggles

RIGHT (7 cols):
- Report Preview

TOP:
- Generate Report button (full width)

---

# 12. CHECKLIST TAB

GRID:

LEFT (8 cols):
- Task Groups (accordion)

RIGHT (4 cols):
- Progress Summary
- Next Task
- Provider Suggestions

---

# 13. RESPONSIVE RULES

Tablet:
- collapse right panel below main

Mobile:
- tabs scroll horizontally
- stack all sections
- action bar becomes bottom bar

---

# 14. COMPONENT BREAKDOWN

Components:

- PropertyHeader
- ActionBar
- TabNav
- OverviewPanel
- PricingMap
- CompsList
- PhotoGrid
- PhotoDetailPanel
- VisionWorkspace
- BrochureEditor
- ReportBuilder
- ChecklistPanel

---

# 15. FINAL NOTE

Do NOT redesign visuals yet.

First:
- implement layout
- move content into tabs

THEN refine styling.

---

End of Document
