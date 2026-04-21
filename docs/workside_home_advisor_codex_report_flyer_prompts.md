# Workside Home Advisor — Exact Codex Prompts to Implement Report + Flyer Improvements

## How to use this file
Use these prompts one at a time in Codex. Do not paste all prompts at once. Run them in order. After each phase, review the diff, test the behavior, and commit before moving to the next prompt.

These prompts are written to implement the improvements identified from the current seller report and flyer behavior:

- make recommendations actionable
- add consequence / urgency framing
- strengthen ROI framing
- auto-fill provider recommendations instead of showing empty state
- align flyer behavior with readiness state
- upgrade flyer CTA into a trackable conversion asset
- improve agent-facing presentation value
- preserve current working behavior while improving output quality

---

# Prompt 1 — Audit current report/flyer generation paths and create an implementation plan

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Audit the current implementation paths for:
1. seller report generation
2. flyer / marketing report generation
3. readiness score usage
4. provider recommendation injection
5. pricing narrative / ROI language
6. report and flyer template rendering
7. any API endpoints and shared prompt/template builders involved

Goals:
- Identify the exact files, modules, prompt builders, template renderers, API routes, and data sources that drive the current seller report and flyer outputs.
- Identify where the report currently generates:
  - readiness score
  - top opportunity
  - top risk
  - recommendations
  - budget / ROI
  - provider recommendations
  - buyer appeal copy
  - CTA text
- Identify where the flyer currently chooses whether to present the property as fully market-ready vs still in preparation.
- Identify any empty-state logic that causes "No providers matched yet" to appear.

Deliverable:
Create a new markdown file at:
docs/codex/report-flyer-improvements-audit.md

The file must include:
- exact file paths
- current data flow
- current rendering flow
- current prompts/templates involved
- identified gaps
- recommended implementation order

Constraints:
- Do not change behavior yet.
- Do not refactor anything yet.
- Only audit and document.
```

---

# Prompt 2 — Add actionable recommendation objects to seller report generation

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Upgrade the seller report generation pipeline so that every major recommendation can be rendered as an actionable recommendation object rather than passive text.

Current problem:
The seller report says things like:
- "5 photo retakes still need attention"
- "Enhance Kitchen Presentation and Lighting"
but does not clearly convert those into direct next-step actions.

Implement:
Create a normalized recommendation action model that supports:
- title
- reason
- urgency
- estimated cost
- expected outcome
- recommended action type
- CTA label
- CTA destination
- linked checklist item ids (if applicable)
- linked provider category (if applicable)

Recommended action types should support at minimum:
- photo_retake
- staging_improvement
- lighting_improvement
- declutter
- curb_appeal
- pricing_review
- provider_booking
- report_regeneration

Requirements:
1. Identify the best shared location for this model in the existing codebase.
2. Update report-generation logic to produce structured recommendation actions.
3. Preserve current text recommendations, but make them derive from structured recommendation actions where possible.
4. Ensure the output can be consumed later by both:
   - seller report PDF
   - dashboard UI
   - mobile UI

Deliverables:
- implement the model
- wire it into the report generation pipeline
- document the shape in:
  docs/codex/recommendation-action-model.md

Constraints:
- Preserve existing behavior as much as possible.
- Do not redesign the entire report layout yet.
- Add tests for serialization / mapping if test patterns already exist nearby.
```

---

# Prompt 3 — Add urgency and consequence framing to seller report language

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Improve seller report language so it does not only inform, but also explains consequences of inaction.

Current problem:
The report communicates status but not enough urgency. It says what is wrong, but not what may happen if the seller ignores it.

Implement consequence framing for:
- poor photo quality
- incomplete checklist
- unconfirmed pricing
- weak presentation readiness
- missing provider execution support

Add a structured consequence layer that can produce language such as:
- likely buyer first-impression risk
- likely showing friction
- risk of lower perceived value
- risk of delayed launch
- risk of leaving value on the table

Requirements:
1. Add a reusable consequence-framing helper or narrative builder.
2. Ensure the language stays professional, credible, and non-alarmist.
3. Do not invent unsupported market statistics.
4. Use cautious language such as:
   - may reduce appeal
   - may delay launch
   - may weaken first impressions
   - may limit perceived value
5. Add this consequence framing into the seller report sections where it fits best:
   - summary
   - top risk
   - launch status
   - action plan

Deliverables:
- implementation
- updated seller report output
- before/after examples documented in:
  docs/codex/consequence-framing-examples.md
```

---

# Prompt 4 — Upgrade ROI framing from passive estimate to decision-driving messaging

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Improve how ROI / value-protection messaging is presented inside the seller report.

Current problem:
The report currently includes value and prep-cost language, but it is too passive and easy to overlook.

Implement:
1. Preserve the underlying calculations already in place.
2. Upgrade the wording so the output can clearly express:
   - estimated prep investment
   - estimated value protection or upside
   - net upside framing where appropriate
   - a simple decision message

Example tone:
- "A focused pre-listing investment of about $1,700 may protect or unlock roughly $2,720 in presentation-driven value."
- "Based on the current readiness signals, the home may be leaving presentation value on the table until the highest-impact prep items are completed."

Requirements:
- Do not overstate certainty.
- Keep the language seller-friendly.
- Reuse calculations already present if available.
- If calculations are weak or missing, improve fallback wording rather than fabricating precision.
- Make the ROI block visually and semantically more prominent in the generated report data model if the report templates support it.

Deliverables:
- implementation in report generation path
- documentation of wording rules in:
  docs/codex/roi-language-rules.md
```

---

# Prompt 5 — Replace empty provider section with automatic fallback provider population

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Eliminate the dead-end experience where the seller report says "No providers matched yet."

Current problem:
The report identifies needed help (photography, cleaning, prep, etc.) but can still output an empty provider section, which breaks the action chain.

Implement provider fallback logic:
1. If curated/provider-marketplace matches exist, use them.
2. If marketplace matches do not exist, automatically attempt fallback recommendations using any existing Google Maps / Places / provider discovery logic already in the repo.
3. If fallback discovery succeeds, populate the report with useful nearby provider suggestions.
4. Only show a true empty-state message if both curated and fallback sources fail.

Also implement:
- provider source label (marketplace vs nearby discovery)
- category label
- reason matched
- optional confidence / relevance note if your current architecture supports it

Requirements:
- Reuse existing provider discovery/fallback code wherever possible.
- Avoid broad refactors unless necessary.
- Preserve current provider moderation rules if curated providers require approval.
- Make sure the report output always favors action over emptiness.

Deliverables:
- provider fallback implementation
- updated report-generation logic
- docs/codex/provider-fallback-flow.md
- tests for the fallback decision path if test coverage patterns exist nearby
```

---

# Prompt 6 — Add report CTA metadata for action buttons / links in future UI

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Extend the seller report output model to include CTA metadata that future UI surfaces can use for direct action.

Goal:
The report should no longer be a dead-end PDF/data artifact. It should describe next-step actions in a structured way that can later be rendered as:
- Find photographer
- Review pricing
- Book cleaning help
- Retake kitchen photos
- Regenerate report

Implement a CTA metadata structure with fields such as:
- label
- destination type
- destination route
- related property id
- related task id
- related provider category
- priority
- visibility conditions

Requirements:
1. Add CTA metadata to relevant report sections.
2. Preserve compatibility with current PDF generation even if CTA buttons are not yet visually rendered.
3. Make the data available in report payloads/APIs where appropriate.
4. Do not break current consumers.

Deliverables:
- implementation
- API/report payload updates if needed
- docs/codex/report-cta-metadata.md
```

---

# Prompt 7 — Introduce readiness-aware flyer modes

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Update the flyer / marketing report generation logic so it adapts to property readiness state.

Current problem:
The marketing flyer can present a property as fully polished even when the seller report says the home still "Needs Work." This creates a credibility mismatch.

Implement flyer modes based on readiness thresholds:
1. Preview mode
   Use when readiness is low and/or photo quality is weak.
   Tone: early preview, opportunity, coming-soon, property package available.
2. Launch-ready mode
   Use when readiness is solid and photo quality is acceptable.
   Tone: polished listing presentation.
3. Premium mode
   Reserve for strong readiness, strong gallery, and stronger marketing assets if available.

At minimum:
- Define the rules for mode selection.
- Adjust headline/subheadline/CTA language based on mode.
- Prevent weak photo sets from being framed as fully market-ready.
- Preserve current general design direction unless template changes are necessary.

Requirements:
- Use existing readiness / photo quality signals already available in the system.
- Keep rules transparent and documented.
- Avoid hardcoding copy in too many places; centralize mode logic.

Deliverables:
- flyer mode selector implementation
- updated copy logic
- docs/codex/flyer-mode-rules.md
```

---

# Prompt 8 — Strengthen flyer copy so it is specific, not generic

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Improve flyer / marketing report copy quality so it feels more specific to the property and less interchangeable with any generic listing.

Current problem:
Current copy is clean but too generic. It does not fully capitalize on the specific property signals available in the system.

Implement:
1. Improve headline and body copy generation rules so they prioritize:
   - strongest true property differentiators
   - buyer fit
   - spatial benefits
   - specific appeal points supported by the available data/photos
2. Reduce generic filler language.
3. Make buyer appeal statements feel more grounded and property-specific.
4. Preserve safe wording when the data is incomplete.

Requirements:
- Do not invent unsupported claims.
- Use only supported property facts, photo analysis findings, and known highlights.
- Keep copy concise and marketable.
- If structured AI prompt builders are already used, improve them.
- If templates are rule-based, improve the ranking and selection logic for highlights.

Deliverables:
- improved flyer copy logic
- updated prompt/template builder(s)
- docs/codex/flyer-copy-guidelines.md
```

---

# Prompt 9 — Replace weak flyer CTA with trackable contact/conversion CTA

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Upgrade the flyer / marketing report CTA so it is a trackable conversion asset, not just a plain text instruction.

Current problem:
The flyer currently uses simple contact language such as "Please contact seller at ..." which is weak, outdated, and hard to track.

Implement CTA upgrades:
1. Add a CTA strategy layer that supports:
   - request showing
   - request property packet
   - contact agent
   - contact seller
   - learn more
2. Select CTA based on tenant / context / readiness mode where possible.
3. Make CTA copy stronger and more actionable.
4. If current rendering system supports links, include trackable URLs or route metadata.
5. If PDF rendering cannot include active tracking yet, still include structured CTA metadata in the output model.

Requirements:
- Preserve backward compatibility.
- Do not assume agent-mode is always active.
- Use the best available contact target based on current property and user context.
- Document the CTA selection logic clearly.

Deliverables:
- CTA strategy implementation
- updated flyer CTA output
- docs/codex/flyer-cta-strategy.md
```

---

# Prompt 10 — Improve photo selection logic for flyer generation

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Improve the photo selection logic used by flyer / marketing report generation.

Current problem:
The current flyer can present weak or not-yet-marketplace-ready photos in a way that reduces listing quality.

Implement:
1. Rank candidate photos using current available signals such as:
   - photo quality
   - room coverage
   - retake flags
   - marketplace-ready status
   - preferred vision variant if available
2. If high-quality / marketplace-ready images are limited, choose the strongest safe set and downgrade flyer mode if needed.
3. Avoid repeating nearly identical photos unless coverage is too limited.
4. Prefer a balanced gallery:
   - exterior
   - kitchen
   - living/main area
   - strongest additional room/feature
5. If the photo set is weak, allow the flyer to explicitly behave like a preview rather than pretending launch polish.

Requirements:
- Reuse existing media scoring where possible.
- Preserve current fallbacks if too few assets exist.
- Document the ranking rules.
- Add tests for selection ordering if practical.

Deliverables:
- updated photo-selection logic
- docs/codex/flyer-photo-selection-rules.md
```

---

# Prompt 11 — Add agent presentation mode for seller-facing marketing assets

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Lay the groundwork for agent-facing presentation mode in seller marketing assets.

Goal:
The same property outputs should become more useful in listing presentations for agents, not just seller self-service flows.

Implement a first-pass agent presentation mode that can support:
- agent-branded CTA target if available
- seller-facing "recommended next steps" language
- cleaner presentation framing for a listing consultation
- future support for brokerage branding

Requirements:
- Keep this implementation lightweight and backward compatible.
- Do not fully redesign agent mode yet.
- Focus on data model and copy hooks so future expansion is easy.
- Document what was added vs what remains future work.

Deliverables:
- first-pass agent presentation mode hooks
- docs/codex/agent-presentation-mode.md
```

---

# Prompt 12 — Update PDF/report templates to reflect new structured output

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Update the PDF/report rendering layer so the new structured output improvements are reflected in the seller report and flyer.

Specifically:
- make recommendation/action sections clearer
- surface consequence framing where appropriate
- make ROI/value-protection language more visible
- improve provider section rendering when fallback providers exist
- ensure flyer mode copy is correctly reflected
- ensure CTA text is stronger and consistent with mode

Requirements:
- Preserve existing design language as much as possible.
- Prefer targeted template improvements over a full redesign.
- Maintain printable/exportable quality.
- Avoid layout regressions.
- Test with current known sample property data if possible.

Deliverables:
- template/render updates
- screenshots or notes in:
  docs/codex/report-flyer-template-update-notes.md
```

---

# Prompt 13 — Add regression tests for seller report and flyer generation

```text
You are working inside the Workside Home Advisor monorepo.

Task:
Add focused regression coverage for seller report and flyer generation so the new improvements remain stable.

Cover at minimum:
1. report generation with weak readiness
2. report generation with provider fallback
3. flyer generation in preview mode
4. flyer generation in launch-ready mode
5. stronger CTA selection
6. structured recommendation action generation
7. consequence framing present when relevant
8. ROI block wording present when inputs exist

Requirements:
- Follow the repo's existing test style where possible.
- Keep tests focused and maintainable.
- Prefer deterministic fixture data.
- If snapshot tests are appropriate, use them carefully.
- If PDF binaries are hard to test directly, test the structured payload/template inputs instead.

Deliverables:
- test coverage
- any fixtures needed
- docs/codex/report-flyer-regression-tests.md
```

---

# Prompt 14 — Final polish pass and implementation summary

```text
You are working inside the Workside Home Advisor monorepo.

Task:
After completing the report/flyer improvement work, do a final polish pass.

Checklist:
- verify no dead-end provider empty states remain unless all discovery paths truly fail
- verify low-readiness properties do not receive over-polished flyer framing
- verify CTA language is stronger and more actionable
- verify seller report recommendations now read like direct next steps
- verify ROI/value-protection messaging is visible and credible
- verify copy remains grounded and does not invent unsupported claims
- verify all new docs under docs/codex are accurate

Deliverable:
Create a final implementation summary at:
docs/codex/report-flyer-improvements-final-summary.md

The summary must include:
- what changed
- what files changed
- what remains future work
- known limitations
- recommended next follow-up tasks
```

---

## Recommended execution order
Run the prompts in this order:

1. Audit current implementation
2. Recommendation action model
3. Consequence framing
4. ROI framing
5. Provider fallback
6. CTA metadata
7. Flyer modes
8. Flyer copy
9. Flyer CTA strategy
10. Flyer photo selection
11. Agent presentation mode hooks
12. Template updates
13. Regression tests
14. Final polish summary

---

## Implementation notes for you
After each Codex run:
1. review the diff
2. test with the same Peralta property sample
3. regenerate both the seller report and flyer
4. compare before vs after
5. commit before moving to the next prompt

Suggested commit names:
- audit report/flyer generation paths
- add structured recommendation action model
- add consequence and roi framing
- add provider fallback and report cta metadata
- introduce readiness-aware flyer modes
- improve flyer copy cta and photo selection
- update templates and add regression coverage

---

## What success looks like
When this work is complete:

### Seller report
- feels like an operating plan, not just a readout
- explains both recommendations and consequences
- highlights value protection/upside clearly
- always points toward execution

### Flyer / marketing report
- matches actual readiness
- uses stronger, more specific copy
- uses stronger CTA language
- behaves like a real conversion asset

### Product outcome
- the platform becomes more action-driving
- the reports become more commercially useful
- agent mode becomes easier to expand later
