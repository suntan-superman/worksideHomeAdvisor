# Workside Home Advisor — Perfect Dashboard UI Spec
## Codex-Ready Product + UX Blueprint

**Version:** 1.0  
**Date:** 2026-04-04  
**Purpose:** Define the ideal seller dashboard experience for Workside Home Advisor so the product feels smooth, premium, directive, and conversion-oriented.

---

# 1. Dashboard Product Goal

The dashboard should not feel like:
- a task list
- a CRM
- a settings panel
- a pile of tabs

It should feel like:

> **A guided seller operating system**

The seller should always know:
1. where they are
2. what is done
3. what matters most now
4. what action to take next
5. what result that action creates

The UI should reduce thinking and increase momentum.

---

# 2. Core Design Principles

## 2.1 Single Dominant Next Action
At any moment, the user should see one clear next step.

## 2.2 Progress Over Navigation
The dashboard is not primarily for browsing. It is for moving forward.

## 2.3 Value-Reinforced Actions
Every action must answer:
- why this matters
- what outcome it creates

## 2.4 Premium Calm
The interface should remain:
- clean
- spacious
- soft
- professional
- not “busy startup software”

## 2.5 Collapsible Complexity
Show only what the user needs right now.
Details expand when relevant.

---

# 3. Ideal Dashboard Structure

```text
[ PROPERTY HEADER ]
Property identity + top actions + readiness snapshot

[ PRIMARY ACTION STRIP ]
Your next best move

[ MAIN LAYOUT ]
Left rail: workflow navigator
Center: active content / overview / current phase
Right rail: metrics, signals, smart recommendations
```

---

# 4. Perfect Layout — Desktop

## 4.1 Top Header Card
A full-width header card anchored at the top of the property workspace.

### Contents:
- property name
- full address
- pricing band
- chosen list price
- readiness score
- photo count
- top actions

### Recommended layout:
```text
---------------------------------------------------------
Mainsail Property
8612 Mainsail Drive, Bakersfield, CA 93312

[ $370k–$409k ] [ Chosen $395k ] [ 65/100 readiness ] [ 8 photos ]

                           [ Refresh pricing ] [ Generate report ] [ Back to dashboard ]
---------------------------------------------------------
```

### Rules:
- keep buttons on the right
- keep property identity on the left
- keep metrics as chips under the address
- keep this section visually calm and highly readable

---

## 4.2 Primary Action Strip
Directly under the header, place the most important action area.

### Purpose:
Show exactly what the user should do next.

### Structure:
```text
---------------------------------------------------------
YOUR NEXT BEST MOVE
Prepare your home

Complete the prep checklist to improve buyer appeal and raise listing readiness.

[ Start prep checklist ]
---------------------------------------------------------
```

### Required elements:
- status icon or status color
- one sentence describing why this step matters
- one dominant CTA
- optional secondary link: “Why this matters”

### Rules:
- only one primary action
- never show multiple equal-priority CTAs here
- change this automatically based on workflow state

---

# 5. Workflow Navigator (Left Rail)

## 5.1 Purpose
The current left rail is close, but it should become a real workflow engine.

It should:
- show phases
- show status
- show progress count where applicable
- visually de-emphasize completed work
- emphasize active work

---

## 5.2 Recommended Left Rail Structure

### Section title:
`Workflow Navigator`

### Progress summary at top:
```text
73% complete
Prep · Seller guide
```

### Two summary cards:
- Market-ready score
- Current step

---

## 5.3 Phases
Instead of a long flat list, group into phases:

### Phase 1 — Setup
- Add property details
- Review pricing

### Phase 2 — Photos
- Take photos
- Review your photos
- Improve your photos

### Phase 3 — Prep
- Prepare your home
- Get help if needed

### Phase 4 — Materials
- Create your report
- Create marketing materials
- Marketing plan

---

## 5.4 Step Card Design
Each workflow item should be a card, not a raw list row.

### Card contents:
- step title
- category
- status chip
- optional progress count
- optional blocker message

### Example:
```text
Prepare your home
Checklist

[ In progress ]
3 of 7 tasks complete
```

---

## 5.5 New Status System

Use these statuses only:

### Ready
Meaning:
- the step is available now
- user can begin immediately

Color:
- subtle blue or accent outline

### Recommended
Meaning:
- this is the system-selected next best move

Color:
- accent / warm highlight

### In Progress
Meaning:
- user started but has not finished

Color:
- amber

### Blocked
Meaning:
- another prerequisite is unfinished

Color:
- light gray

### Completed
Meaning:
- done

Color:
- soft green
- completed cards can visually collapse

---

## 5.6 Behavior Rules
- recommended step gets strongest emphasis
- completed steps are visually lighter
- blocked steps show why they are blocked
- clicking a step opens related tab/content
- current step remains sticky in user memory

---

# 6. Main Content Area (Center Panel)

This is the primary working surface.

The center panel should change depending on selected tab or step, but the **Overview** tab should become the best summary page in the product.

---

# 7. Perfect Overview Tab

## 7.1 Overview Layout
The overview should have 4 stacked sections:

### A. AI / System Summary
### B. Latest Deliverables
### C. Next Step Card
### D. Quick Stats + Readiness Insights

---

## 7.2 AI Summary Card
Current direction is good, but tighten it.

### Structure:
```text
AI SUMMARY
What the workspace is signaling

Your current price band is competitive for this neighborhood.
Photo coverage is strong, but prep work is still holding back listing readiness.
Finishing the prep checklist should be the next priority.

• 4 seller-selected photo picks
• 6 preferred vision variants
• 4 checklist tasks complete
```

### Rules:
- 3–5 concise sentences max
- no giant wall of text
- speak like a calm advisor, not a report engine

---

## 7.3 Latest Deliverables Card
This card is working well conceptually.

### Improve by:
- show brochure and report side by side when both exist
- include freshness timestamp
- include quick open action

### Example:
```text
BROCHURE
Charming 3-Bedroom Home on a Spacious Corner Lot
Updated 12 min ago
[ Open brochure ]

REPORT
Seller Intelligence Report
Updated 18 min ago
[ Open report ]
```

---

## 7.4 Next Step Card
This must be stronger and more specific.

### Instead of:
`Prepare your home`

### Use:
```text
NEXT STEP
Prepare your home

Complete the remaining prep items to increase buyer appeal and move closer to market-ready status.

[ Start checklist ]
```

### Optional enhancement:
Add impact note:
`This could move readiness from 65 to 78.`

---

## 7.5 Quick Stats Card
Keep this, but make it more interpretable.

### Better structure:
```text
QUICK STATS
- 8 comps loaded
- 4 listing photo picks
- 6 preferred image variants
- 4 checklist tasks complete
- 2 provider matches available
```

### Optional enhancement:
Turn these into mini-stat tiles instead of bullets.

---

# 8. Tab System

Your tabs are sensible:
- Overview
- Pricing
- Photos
- Vision
- Brochure
- Report
- Checklist

Keep them.

## Improve them by:
- making active tab stronger
- adding subtle completion indicators
- tying tab defaults to current step

### Example:
If current step = Prepare your home
then clicking dashboard should default to:
- Overview with Next Step card
or
- Checklist tab, depending on user preference

---

# 9. Pricing Tab UI

## Ideal structure:
Left: map + comps
Right: selected list price + pricing insights

### Must include:
- chosen list price
- suggested range
- comp count
- confidence %
- one explanation block:
  “Why this price makes sense”

### Improvement:
Use stronger hierarchy around chosen list price.
That value matters and should look important.

---

# 10. Photos Tab UI

## Goal:
Turn the photo area into “listing photo curation,” not asset management.

### Left side:
- candidate photo strip
- gallery grid

### Right side:
- selected photo details
- quality notes
- actions:
  - mark as listing photo
  - enhance
  - declutter
  - delete

### UX note:
This is already good. Main improvement is copy clarity and action priority.

---

# 11. Vision Tab UI

## Goal:
This should feel like an intelligent enhancement studio.

### Keep:
- before/after compare
- selected variant card
- variant chips

### Improve:
- label top variant as:
  `Best candidate`
- label lower-confidence variants clearly
- reduce text density
- show one “Use this version” CTA

---

# 12. Brochure Tab UI

## Goal:
This should feel like “build polished marketing materials,” not “configure export settings.”

### Improve:
- emphasize selected photos visually
- reduce form density
- place preview slightly higher
- add “seller-facing preview” language

### Better card labels:
- Headline & positioning
- Photo selection
- Flyer preview
- Export actions

---

# 13. Report Tab UI

## Goal:
This should feel premium and high-value.

### Structure:
- report controls
- section toggles
- photo selection
- report preview
- export action

### Improvement:
- move “Generate report” higher
- reduce number of visible controls before preview
- make section toggles more concise

---

# 14. Checklist Tab UI

This is one of your most important tabs.

## Make it feel like:
- guided action
- not admin task management

### Group checklist tasks by:
- Exterior
- Interior
- Cleanliness
- Repairs
- Presentation
- Final prep

### For each item show:
- task title
- why it matters
- status
- optional provider shortcut

### Example:
```text
Declutter primary living areas
Makes rooms feel larger and photographs better.

[ In progress ]
[ Need help? Find cleaners ]
```

---

# 15. Provider UX Inside Dashboard

Providers should not feel like a side feature.
They are both:
- utility
- monetization engine

## Recommended provider card structure:
- business name
- rating
- source (Workside / Google fallback)
- distance / area served
- tags:
  - recommended
  - fast response
  - best rated
  - insured

### CTA buttons:
- View details
- Save to shortlist
- Contact / Request help

---

# 16. Footer / Page Chrome

Your footer is functional, but inside the product workspace it is too visually busy.

## Recommendation:
Inside authenticated workspace:
- simplify footer
- reduce visual prominence
- keep only:
  - Terms
  - Privacy
  - Support email

The more marketing/footer noise inside the workspace, the less focused the product feels.

---

# 17. Most Important UI Changes to Make Now

## Top 10 changes

### 1. Add a large “Your next best move” card directly under header
This becomes the primary dashboard CTA.

### 2. Turn left rail into grouped phases, not a flat list
This reduces overwhelm.

### 3. Use the new status system:
- Ready
- Recommended
- In progress
- Blocked
- Completed

### 4. Collapse or visually soften completed steps
Users should focus on what remains.

### 5. Strengthen the readiness score with meaning
Example:
`65/100 readiness · Finish prep to improve market appeal`

### 6. Reduce AI summary verbosity
Shorter, more directive, more useful.

### 7. Show deliverables with timestamp and direct open action
Make outputs feel like real assets.

### 8. Reduce footer prominence in workspace
Less distraction.

### 9. Make quick stats visual instead of bullet-heavy
More scannable.

### 10. Make providers feel recommended, not just listed
This supports trust and monetization.

---

# 18. Pixel-Level Layout Recommendation

## Desktop grid
```text
Header: full width
Next Action Card: full width
Main body:
  Left rail: 280px
  Center content: flexible
  Right rail: 320px
```

## Spacing
- outer padding: 24–32px
- card gap: 20–24px
- section gap: 28–32px
- card radius: 24px
- button radius: pill / soft rounded

---

# 19. Mobile Dashboard Recommendation

When mobile comes into focus later, this should become:

### Stack order:
1. property header
2. next action
3. readiness
4. workflow phases
5. active tab content

### On mobile:
- left rail becomes collapsible phase accordion
- tabs become swipeable or segmented
- next action stays pinned near top

---

# 20. Suggested Codex Instructions

Use this exact build direction.

## Codex task:
```text
Redesign the property workspace dashboard to function as a guided seller operating system.

Requirements:
1. Add a dominant “Your next best move” card under the property header.
2. Convert the left sidebar into a grouped workflow navigator with phases:
   - Setup
   - Photos
   - Prep
   - Materials
3. Replace current statuses with:
   - ready
   - recommended
   - in_progress
   - blocked
   - completed
4. Show progress counts on in-progress items.
5. Visually soften completed items and highlight recommended item.
6. Tighten Overview tab into:
   - AI summary
   - latest deliverables
   - next step
   - quick stats
7. Reduce text density and increase directive guidance.
8. Reduce footer prominence inside authenticated workspace.
9. Make provider cards feel like recommendations, not raw list items.
10. Preserve current premium visual language while improving action clarity and progress psychology.
```

---

# 21. Final Product Vision

The dashboard should make the seller feel:

- supported
- organized
- guided
- in control
- one step away from progress at all times

It should feel like:
> a calm expert is walking them through the sale

not:
> software is showing them a bunch of modules

That is the difference between a usable tool and a product people will actually pay for.

---

# 22. Recommended Next Deliverable

After Codex implements this dashboard pass, the next review should focus on:
- real workflow speed
- friction points
- conversion hooks
- provider monetization placement
- mobile adaptation

That is the right sequence for the next design iteration.

---
END
