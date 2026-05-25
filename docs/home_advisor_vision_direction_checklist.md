# Home Advisor Vision Direction Checklist

Last updated: 2026-05-18
Status: active working checklist

## Product Direction

Vision is now positioned as a Seller Photo Coach and photo-readiness support layer.

The goal is not to compete with Photoshop, virtual staging platforms, or AI remodeling tools. The goal is to help sellers and brokers quickly understand which photos are useful, improve the safe ones, prepare rooms for better listing presentation, and feed stronger photos and guidance into flyers, brochures, and seller reports.

## North Star

The seller or broker should feel:

- I uploaded photos and immediately got a clearer plan.
- I know which photos are strongest.
- I know what to fix before listing photos.
- I can safely improve basic presentation.
- My flyer, brochure, and report look more professional.

They should not feel:

- I am stuck in an AI workflow.
- I waited several minutes for no visible value.
- The app promised furniture, flooring, or staging changes it could not deliver.

## Completed

- [x] Reviewed the strategic Vision recommendations document.
- [x] Repositioned Vision around seller photo readiness instead of advanced image transformation.
- [x] Simplified the visible Vision experience toward three actions:
  - Improve Photo
  - Clean Up Photo
  - Explore Ideas
- [x] Updated the Vision workspace heading to Photo Coach.
- [x] Made seller guidance more central in the Vision tab.
- [x] Added photo score signals to the Vision surface when available:
  - Quality
  - Light
  - Composition
- [x] Changed advisor-only outcomes from "Subtle preview generated" to "Seller prep plan ready."
- [x] Changed Clean Up Photo to prioritize seller prep guidance by default instead of waiting on weak AI cleanup.
- [x] Added `HOMEADVISOR_ENABLE_GENERATIVE_CLEANUP=false` to `.env.example`.
- [x] Added a backend feature flag so generative cleanup can be intentionally re-enabled later.
- [x] Added backend seller prep plan completion for cleanup actions.
- [x] Preserved the ability to run generative cleanup later by setting `HOMEADVISOR_ENABLE_GENERATIVE_CLEANUP=true`.
- [x] Moved wall color previews to deterministic local rendering.
- [x] Moved floor tone previews to deterministic local rendering.
- [x] Kept tile/stone flooring hidden from the user-facing catalog.
- [x] Kept open-room/furniture-removal concepts on the existing generative concept path.
- [x] Renamed visible concept language toward seller-friendly labels:
  - Warm Walls
  - Lighten Floors
  - Warm Floors
  - Darken Floors
  - Neutralize Floors
- [x] Removed the visible concept chip grid from the main Vision action card.
- [x] Updated API tests to reflect deterministic wall/floor routing.
- [x] Verified API tests pass: 149/149.
- [x] Verified web tests pass: 2/2.
- [x] Verified web production build passes.
- [x] Verified `git diff --check` passes.

## Current Behavior

### Improve Photo

- [x] Listing-safe.
- [x] Deterministic/local.
- [x] Intended for fast brightness, clarity, white balance, and presentation improvement.
- [ ] Needs real-photo visual QA against the latest seller sample set.
- [ ] Needs final tuning for a more visible but still believable listing improvement.

### Clean Up Photo

- [x] Guidance-first by default.
- [x] Returns seller prep guidance instead of a weak AI edit.
- [x] Does not block the seller with long-running no-value generation.
- [x] Generative cleanup is behind `HOMEADVISOR_ENABLE_GENERATIVE_CLEANUP`.
- [ ] Needs UI copy review to make it obvious that this is a prep plan, not guaranteed object removal.
- [ ] Needs a future validated cleanup provider before being marketed as true AI declutter.

### Explore Ideas

- [x] Remains optional.
- [x] Concept-only framing is preserved.
- [x] Wall and floor tone concepts use deterministic local rendering.
- [x] Open-room concepts still use the generative provider chain.
- [ ] Needs a clearer dedicated concept selection surface if we keep multiple concept options.
- [ ] Needs stronger "planning only" language in reports and exports where concepts appear.

## Remaining Work By Phase

## Phase 1 - Market-Ready Seller Photo Coach

This is the launch-critical path.

- [ ] Rename user-facing Vision nav or section copy to Photo Coach where appropriate.
- [ ] Audit the full web workspace for remaining internal AI wording:
  - fallback
  - orchestration
  - pipeline
  - confidence
  - hallucination
  - publishability
  - marketplace fallback
- [ ] Replace remaining weak-success copy with seller-value copy.
- [ ] Make the Clean Up Photo button copy and helper text unmistakably guidance-first.
- [ ] Add a simple "Recommended next photo action" block:
  - Keep this photo
  - Improve Photo
  - Prep room and retake
  - Use in flyer/report
- [ ] Add a photo readiness label for the selected photo:
  - Strong
  - Usable after prep
  - Retake recommended
- [ ] Add a "Best listing photo candidates" summary in the Photos or Vision area.
- [ ] Ensure saved enhanced photos can still be promoted cleanly into Photos.
- [ ] Ensure guidance-only attempts do not create confusing empty history entries.
- [ ] Confirm mobile photo capture/import still aligns with the Photo Coach direction.
- [ ] Update `docs/LIVE_SYSTEM.md` to reference Seller Photo Coach terminology.
- [ ] Update `docs/VISION_TIERS.md` to match the current implementation:
  - Core: Improve Photo, photo scoring, seller guidance, best-photo selection.
  - Advanced: optional concepts.
  - Experimental: external provider bakeoffs and true generative cleanup.

## Phase 2 - Improve Photo Quality

Improve Photo is now the safest real image feature. It should feel visibly useful.

- [ ] Build a golden sample set of real property photos:
  - living room
  - kitchen
  - bedroom
  - bathroom
  - exterior
  - bright/window-heavy rooms
  - dim rooms
  - cluttered rooms
- [ ] Save source and output snapshots for each test photo.
- [ ] Tune deterministic enhancement for real estate:
  - brightness lift
  - shadow recovery
  - highlight protection
  - white balance
  - contrast
  - sharpening
  - subtle crop or leveling if safe
- [ ] Add acceptance criteria:
  - visibly better in side-by-side review
  - no obvious overexposure
  - no distorted geometry
  - no fake objects
  - no color cast that makes walls/floors misleading
- [ ] Add before/after review notes to the golden set.
- [ ] Use the same sample set before every Vision release.

## Phase 3 - Seller Guidance And Best Photo Selection

This is likely the highest-value Vision work for sellers.

- [ ] Improve guidance generation using photo analysis signals:
  - lighting
  - clutter
  - composition
  - room type
  - retake recommendation
  - buyer appeal
- [ ] Make guidance room-specific:
  - living room
  - kitchen
  - bathroom
  - bedroom
  - exterior
- [ ] Add guidance priority:
  - do this before photos
  - do this if time allows
  - avoid doing this
- [ ] Add photo set guidance:
  - missing core rooms
  - duplicate angles
  - weak hero photo
  - too many detail shots
  - not enough exterior/context photos
- [ ] Add "Top picks for flyer" suggestions.
- [ ] Add "Top picks for report" suggestions.
- [ ] Feed photo guidance into seller reports in plain language.
- [ ] Feed best-photo selection into brochure/flyer defaults.

## Phase 4 - Concepts Without Overpromising

Concepts can stay, but they must not dominate the product.

- [ ] Decide whether Explore Ideas should open a dedicated concept drawer/modal.
- [ ] Keep default concept options limited:
  - Warm Walls
  - Brighten Walls
  - Soft Greige Walls
  - Lighten Floors
  - Warm Floors
  - Darken Floors
  - Neutralize Floors
  - Open Room Preview
- [ ] Keep tile/stone replacement hidden from seller-facing UI.
- [ ] Ensure wall/floor concepts are labeled as tone/direction previews.
- [ ] Add concept disclaimer to any report section using these outputs.
- [ ] Prevent concept previews from being treated as listing-ready photo saves by default.
- [ ] Add a user-friendly distinction:
  - Enhanced Photo
  - Prep Plan
  - Concept Preview
- [ ] Confirm generated concept images do not accidentally become primary listing photos unless explicitly saved.

## Phase 5 - Provider Bakeoff For True AI Editing

Do not rebuild a heavy in-house editing engine until provider quality justifies it.

- [ ] Create a provider evaluation folder or spreadsheet.
- [ ] Select 20 representative property photos.
- [ ] Define benchmark tasks:
  - remove small clutter
  - remove furniture/open room
  - virtual staging
  - wall color direction
  - floor tone direction
  - exterior curb appeal
- [ ] Test candidate providers:
  - Virtual Staging AI
  - Decor8 AI
  - HomeDesigns AI
  - Adobe Firefly
  - Cloudinary AI
  - Photoroom
  - Stability
  - OpenAI image editing
- [ ] Score each provider on:
  - visible improvement
  - realism
  - speed
  - cost
  - API reliability
  - artifact rate
  - furniture/window/floor drift
  - commercial licensing fit
  - implementation complexity
- [ ] Integrate only if the provider beats the current system by a clear margin.
- [ ] Keep provider-driven edits behind a beta or premium label until proven.

## Phase 6 - Reporting And Marketing Output Alignment

Vision should strengthen the outputs that are already good.

- [ ] Add a Photo Coach summary to the seller report.
- [ ] Include top seller prep actions in the report.
- [ ] Include best photo recommendations in the report.
- [ ] Include enhanced photos only when listing-safe.
- [ ] Include concept previews only in a planning/inspiration section.
- [ ] Update report wording from "AI vision" to seller-friendly language.
- [ ] Ensure flyer/brochure defaults prefer:
  - seller picks
  - strong original photos
  - saved enhanced photos
  - not guidance-only attempts
  - not concept previews unless explicitly selected

## Phase 7 - Operational Safety

- [ ] Add telemetry for Photo Coach actions:
  - Improve Photo clicked
  - Clean Up Photo guidance returned
  - Explore Ideas clicked
  - result saved
  - original kept
  - report/flyer used photo
- [ ] Track runtimes for every Vision action.
- [ ] Track guidance-only frequency.
- [ ] Track save rate by result type.
- [ ] Track failed/abandoned jobs.
- [ ] Track whether users prefer originals or enhanced versions.
- [ ] Add dashboard/admin visibility for poor Vision outcomes.
- [ ] Keep long-running generative tasks away from critical seller flow.

## Phase 8 - Documentation Cleanup

- [ ] Mark older "full AI editing suite" Vision docs as historical or superseded.
- [ ] Update README references to point to current Vision direction.
- [ ] Update `docs/LIVE_SYSTEM.md`.
- [ ] Update `docs/VISION_TIERS.md`.
- [ ] Add a short operator note explaining `HOMEADVISOR_ENABLE_GENERATIVE_CLEANUP`.
- [ ] Add a testing note for the golden Vision photo set once it exists.

## Release Acceptance Criteria

Before market launch, Vision should meet these standards:

- [ ] A seller can understand the Vision screen in under 10 seconds.
- [ ] Improve Photo returns quickly and visibly improves common photos.
- [ ] Clean Up Photo never leaves the seller waiting minutes for no value.
- [ ] Guidance-only results feel useful, not like a failure.
- [ ] No user-facing copy promises reliable furniture removal or flooring replacement.
- [ ] Concepts are clearly optional and planning-only.
- [ ] Flyers and reports use trustworthy photos by default.
- [ ] The app helps select better photos, not just generate variants.
- [ ] Internal/debug language is hidden from normal sellers.
- [ ] API tests pass.
- [ ] Web tests pass.
- [ ] Web production build passes.

## Current Implementation References

- Photo Coach UI: `apps/web/app/properties/[propertyId]/PropertyWorkspaceClient.js`
- Vision presets: `apps/api/src/modules/media/vision-presets.js`
- Provider routing: `apps/api/src/modules/media/vision-orchestrator.helpers.js`
- Vision job/service behavior: `apps/api/src/modules/media/media-ai.service.js`
- Vision tests: `apps/api/src/modules/media/media-ai.service.test.js`
- Feature flag: `.env.example`

## Decision Log

- Keep Vision, but stop positioning it as a full AI editing suite.
- Make deterministic Improve Photo the core image feature.
- Make Clean Up Photo guidance-first until generative cleanup is validated.
- Keep Explore Ideas optional.
- Keep wall and floor concepts deterministic and directional.
- Keep heavy generative edits out of the primary seller path.
- Validate external providers before investing more time in advanced in-house image editing.

