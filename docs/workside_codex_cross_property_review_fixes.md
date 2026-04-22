# Workside Home Advisor — Cross-Property Review and Codex Fixes

## Purpose
This document summarizes the latest review of the Peralta and Mainsail seller reports and flyers, then translates the findings into concrete Codex instructions.

The goal is not to keep tuning one property at a time. The goal is to make the report system flexible enough to produce excellent output across:
- low-readiness properties
- mid-readiness properties
- near-launch properties
- properties with missing pricing
- properties with weak vs strong photo sets

---

# Executive assessment

## What is working
The system is now much stronger than earlier iterations:
- seller reports are more structured and professional
- readiness, pricing, photos, and action planning now feel like parts of one product
- flyer outputs are beginning to adapt to readiness state
- cross-property consistency is improving

## What is still wrong
The current output still feels too template-driven and not adaptive enough.

The same core problems show up across both properties:
1. readiness adaptation is incomplete
2. flyers still read too much like reports
3. photo logic is inconsistent with readiness and marketplace reality
4. risk/opportunity/action language is still repetitive
5. some sections are present because the template expects them, not because the property needs them
6. Mainsail is being treated as more prep-heavy than it should be
7. Peralta is still getting too much buyer-facing or marketing language for a property with weak photo readiness

---

# Property-by-property review

## Peralta Residence

### Seller report observations
Peralta is a low-readiness property with a readiness score of 39/100, pending pricing, and 0 marketplace-ready photos. The report correctly signals that it needs work, but some sections still speak in a marketing voice instead of a preparation voice. fileciteturn13file0

Specific issues:
- The summary still includes broad marketing language like “beautifully updated” and “abundant natural light,” which is not the right tone for a prep-first property. fileciteturn13file0
- The readiness economics page repeats the same idea in multiple forms, and the “Risk focus” and “Opportunity focus” are too similar. fileciteturn13file0
- The photo gallery correctly identifies that there are no marketplace-ready photos, but then an additional “Photo preparation priorities” page appears and feels like a template continuation rather than a genuinely necessary page. fileciteturn13file0
- The action plan still carries repeated “photo retakes are still required” language in multiple sections. fileciteturn13file0

### Flyer observations
The Peralta flyer is improved in one important way: it now presents itself as a Flyer Preview instead of pretending the home is fully launch-ready, which is the right direction for a property with 0 marketplace-ready images. fileciteturn13file1

However:
- The cover still includes a strong listing-style hero treatment that visually overstates readiness. fileciteturn13file1
- The “Highlights and gallery” page correctly states that no marketplace-ready photos are available, but the property still gets a four-page flyer structure that feels too polished for its current condition. fileciteturn13file1
- The “Pricing and positioning” and “Neighborhood and positioning” pages are still too report-like and too repetitive for a prep-mode flyer. fileciteturn13file1

Bottom line for Peralta:
This should be a prep-first preview artifact, not a buyer-facing flyer pretending to be one step away from MLS.

---

## Mainsail Property

### Seller report observations
Mainsail is much closer to launch: readiness 68/100, seller-confirmed price at $395,000, 5 marketplace-ready photos, and 5 of 7 checklist items complete. fileciteturn13file2

That is materially different from Peralta, but the system still gives it a fairly prep-heavy report.

Specific issues:
- The summary says the property is “almost ready,” but the key insight still leads with “8 priority photo retakes,” which makes the report feel more negative than the actual readiness state. fileciteturn13file2
- The readiness dashboard is structurally strong, but the “Biggest risk” and “Biggest opportunity” are too similar again. fileciteturn13file2
- The “Readiness economics” page repeats the same ROI explanation twice. fileciteturn13file2
- The action plan is improved, but still weighted too heavily toward prep mechanics for a property that already has enough ready photos for buyer-facing presentation. fileciteturn13file2

### Flyer observations
The Mainsail flyer is the strongest output of the set. It uses a real gallery with multiple distinct images and better feature phrasing, including updated kitchen, corner lot, and room-to-room flow. fileciteturn13file3

However:
- It is still labeled Flyer Preview, even though there are enough ready photos for a buyer-facing gallery and the property is almost ready. fileciteturn13file2turn13file3
- The flyer still uses prep-mode language such as “Preparation and inquiry,” which is weaker than a true listing-oriented CTA. fileciteturn13file3
- The final page still relies too much on generic neighborhood utility language rather than stronger buyer positioning. fileciteturn13file3

Bottom line for Mainsail:
This should be upgraded from preview flyer to a more confident launch-near marketing brochure.

---

# Core design and system conclusions

## 1. The report engine still over-relies on templates
The system is still assembling sections because they exist in the layout system, not because the property state truly calls for them.

Desired behavior:
The engine should decide:
- which sections appear
- how long they are
- what tone they use
- how much detail they include

based on the property state.

---

## 2. Readiness state needs to drive output class, not just wording
Right now readiness mostly influences copy. It needs to influence the document type itself.

Needed output classes:
- Prep Report — low readiness
- Balanced Readiness Report — mid readiness
- Launch Report — near-launch

And for flyers:
- Preview Flyer — low readiness or weak visuals
- Pre-Launch Flyer — mid readiness
- Marketing Flyer — enough strong visuals plus pricing confidence

---

## 3. Risk and opportunity language needs to be complementary, not duplicated
Both properties still show a version of:
- risk = photo weakness
- opportunity = photo improvement

That is logically correct, but not editorially strong.

Better pattern:
- Risk = what currently suppresses response
- Opportunity = what can unlock response fastest
- Top Action = what to do next

These should not read like lightly rewritten copies of one another.

---

## 4. Photo logic needs two separate concepts
The system is currently mixing:
- total photos
- saved photos
- priority retakes
- marketplace-ready photos

That makes Mainsail feel worse than it is.

Needed distinction:
Codex should explicitly separate:
- usable buyer-facing gallery count
- retake backlog count
- priority retake count
- must-fix-before-launch count

That will stop near-ready properties from sounding too broken.

---

## 5. Flyer and seller report should not share the same voice model
The seller report should be operational and consultative.
The flyer should be persuasive and visually led.

Right now the flyer still borrows too much report language and section logic.

---

# Codex fixes

## Prompt 1 — Build a true output-class engine

Task:
Introduce an output-class decision layer before document generation.

Define report classes:
- prep_report
- balanced_report
- launch_report

Define flyer classes:
- preview_flyer
- prelaunch_flyer
- marketing_flyer

Inputs should include:
- readiness score
- marketplace_ready_photo_count
- chosen_price_present
- checklist completion
- priority retake count

Suggested rules:
IF readiness < 50 OR marketplace_ready_photo_count == 0:
    seller_report_class = prep_report
    flyer_class = preview_flyer

IF 50 <= readiness < 70:
    seller_report_class = balanced_report
    flyer_class = prelaunch_flyer

IF readiness >= 70 AND marketplace_ready_photo_count >= 3 AND chosen_price_present:
    seller_report_class = launch_report
    flyer_class = marketing_flyer

Deliverable:
- one shared decision function
- log selected class plus reason
- docs/codex/output-class-engine.md

---

## Prompt 2 — Make section inclusion conditional

Task:
Stop rendering sections just because they exist in the template.

For each section, add:
- inclusion rule
- tone rule
- max detail level

Examples:
- prep_report may include "Photo preparation priorities"
- launch_report should not include that page unless there is a severe photo blocker
- marketing_flyer should include real gallery pages
- preview_flyer should suppress buyer-facing gallery if no ready images exist

Goal:
Every page must justify its existence based on property state.

Deliverable:
- section registry with include or exclude rules
- docs/codex/conditional-sections.md

---

## Prompt 3 — Split photo readiness into 4 separate metrics

Task:
Refactor photo logic so the report distinguishes between:
1. total selected photos
2. marketplace-ready photos
3. saved photos flagged for improvement
4. priority retakes required before launch

Problem:
Mainsail sounds too broken even though it has 5 marketplace-ready photos.
Peralta needs stronger prep gating because it has 0.

Update:
- dashboard summaries
- photo gallery metrics
- action plan language
- flyer gating

Goal:
Stop using one photo count to represent multiple realities.

Deliverable:
- updated photo metrics model
- docs/codex/photo-readiness-model.md

---

## Prompt 4 — Rewrite risk, opportunity, and action as distinct layers

Task:
Refactor risk, opportunity, and action narratives so they do not repeat the same idea.

Rules:
- Risk = current friction
- Opportunity = highest-value upside
- Action = next concrete step

Example for Peralta:
Risk:
"Current photo quality may suppress early buyer confidence."
Opportunity:
"Improved kitchen, exterior, and living-room visuals can materially strengthen showing interest."
Action:
"Complete the 5 priority retakes before buyer-facing launch."

Example for Mainsail:
Risk:
"Remaining flagged images may soften first impressions."
Opportunity:
"A tighter final image set can elevate click-through and showing quality."
Action:
"Complete the most visible retakes and finalize the launch gallery."

Deliverable:
- narrative builder update
- docs/codex/risk-opportunity-action-rules.md

---

## Prompt 5 — Differentiate seller-report tone by class

Task:
Implement tone profiles for seller reports.

prep_report tone:
- practical
- honest
- preparation-first
- avoid broad marketing adjectives

balanced_report tone:
- balanced guidance plus opportunity framing

launch_report tone:
- confident
- seller reassurance
- launch-readiness language

Examples:
Peralta should NOT say:
"beautifully updated home"
Mainsail CAN use stronger confidence language, but should still stay grounded.

Deliverable:
- tone profiles
- docs/codex/seller-report-tone-profiles.md

---

## Prompt 6 — Differentiate flyer tone by class

Task:
Implement tone profiles for flyers.

preview_flyer:
- honest
- teaser or early opportunity
- minimal marketing claims
- no “full brochure” feel

prelaunch_flyer:
- limited but persuasive
- enough to support early conversations

marketing_flyer:
- strongest visuals first
- listing-grade language
- sales-forward CTA

Examples:
Peralta flyer should stay preview-only and suppress any visual implication of full launch readiness.
Mainsail flyer should move closer to marketing flyer language and CTA because it has enough ready visuals.

Deliverable:
- flyer tone profiles
- docs/codex/flyer-tone-profiles.md

---

## Prompt 7 — Reduce repeated ROI phrasing

Task:
The readiness economics page currently repeats nearly identical ROI language in both properties.

Refactor the page to contain:
- one headline metric
- one plain-language explanation
- one interpretation line
- one risk reminder

Do not restate the same sentence in multiple forms.

Goal:
Keep the economics page strong but concise.

Deliverable:
- updated ROI section builder
- docs/codex/readiness-economics-rules.md

---

## Prompt 8 — Scale action-plan depth by readiness

Task:
Action plan detail must vary by property state.

prep_report:
- more detailed action support
- deeper execution cards

balanced_report:
- concise top actions plus limited support

launch_report:
- top actions only, unless blockers are severe

Example:
Peralta can justify more prep detail.
Mainsail should be shorter, cleaner, and closer to launch polish.

Deliverable:
- action-plan depth rules
- docs/codex/action-plan-scaling.md

---

## Prompt 9 — Upgrade Mainsail flyer class and keep Peralta gated

Task:
Apply current property data to flyer class selection.

For Mainsail:
- enough marketplace-ready photos exist for a stronger buyer-facing gallery
- chosen price is confirmed
- readiness is almost ready
→ upgrade from preview flyer toward prelaunch or marketing flyer

For Peralta:
- price is pending
- 0 marketplace-ready photos
- readiness is low
→ remain preview-only

Do not let both properties look like the same flyer with different text.

Deliverable:
- revised flyer class logic
- sample outputs for both properties
- docs/codex/flyer-class-application.md

---

## Prompt 10 — Remove template-feel repetition across both properties

Task:
Review both properties side by side and remove obvious template sameness.

Vary:
- headline structure
- order of feature bullets
- CTA wording by flyer class
- section emphasis
- section count

Do NOT vary randomly.
Variation should be driven by property data and output class.

Goal:
Two properties should feel like the same product system, not the same document with swapped nouns.

Deliverable:
- template variation rules
- docs/codex/cross-property-variation.md

---

## Prompt 11 — Add property-state test fixtures

Task:
Create fixture-driven rendering tests for at least these states:
1. low readiness plus no ready photos plus no chosen price
2. mid readiness plus some ready photos plus chosen price
3. near launch plus strong gallery plus chosen price
4. sparse data edge case
5. high readiness but weak gallery mismatch case

Validate:
- selected output class
- included sections
- tone profile
- action-plan depth
- flyer type

Deliverable:
- fixtures
- tests
- docs/codex/property-state-fixtures.md

---

## Prompt 12 — Final side-by-side validation pass

Task:
Regenerate outputs for both Peralta and Mainsail after the above changes and compare them side by side.

Validation checklist:
- Peralta feels prep-first
- Mainsail feels launch-near
- Flyer classes differ appropriately
- Risk, opportunity, and action are distinct
- Photo logic is not misleading
- ROI page is concise
- Action plans scale correctly
- Reports feel adaptive, not templated

If any fail:
- log warning
- identify exact section causing the mismatch

Deliverable:
- docs/codex/cross-property-final-validation.md

---

# Recommended priority order

1. output-class engine
2. conditional section inclusion
3. photo readiness model
4. tone profiles
5. risk, opportunity, and action rewrite
6. action-plan scaling
7. flyer class application
8. cross-property variation
9. fixture tests
10. final validation

---

# Final product standard

## Peralta should feel like:
- an honest preparation document
- a guided pre-launch preview
- operational, not over-marketed

## Mainsail should feel like:
- a confident near-launch property
- concise and cleaner
- more market-facing and less prep-heavy

## The system should feel like:
- one product
- multiple adaptive modes
- not one static template
