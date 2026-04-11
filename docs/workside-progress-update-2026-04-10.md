# Workside Progress Update

Last updated: 2026-04-10

This is the current checkpoint and active task list for the HomeAdvisor / Workside codebase.

It is intended to replace scattered working notes while active testing continues.

---

## 1. Executive Snapshot

The codebase is no longer in a “feature missing” phase. It is now in a “workflow hardening, simplification, and premium polish” phase.

The biggest changes since the prior checkpoint are:

- a much deeper Photos + Vision workflow
- real multi-step room transformation capability
- stronger admin and billing observability
- safer property lifecycle controls
- stronger backend usage safeguards, cleanup tools, and pricing limits

The product is now clearly usable in several important areas:

- sellers can log in, recover access, and manage account/contact state
- properties can be archived, restored, and permanently deleted safely
- photos can be uploaded, reviewed, saved, and routed into a dedicated Vision workflow
- room cleanup / furniture-removal concepts can now produce useful seller-facing presentation outputs
- brochure, report, and social-pack generation are real product surfaces
- admin visibility for billing, provider operations, variants, and usage is much stronger

The main work remaining is not basic invention. The main work remaining is:

- simplify the Photos / Vision experience
- harden quality and speed of finish-upgrade passes
- reduce redundancy and confusion in workspace UX
- complete live validation on the newest safeguards and admin controls

---

## 2. Comprehensive Review Of What Has Been Done

### 2.1 Seller auth, account, and core property workflow

- [x] forgot-password request / verify / reset flows exist
- [x] seller profile editing supports first name, last name, phone, and SMS preference
- [x] seller-facing account/profile state is persisted through web and mobile flows
- [x] guided workspace / dashboard workflow foundation exists
- [x] property archive / restore behavior is implemented
- [x] permanent property delete is implemented for archived properties only
- [x] property delete uses a real backend cleanup cascade instead of a shallow delete

### 2.2 Photos foundation

- [x] direct web photo import exists
- [x] mobile photo capture/import exists
- [x] source metadata is stored for imported media
- [x] seller notes are stored on photos
- [x] listing-pick / seller-pick behavior exists
- [x] generated Vision results can now be saved back into Photos as durable assets
- [x] category-based photo organization exists in the Photos tab
- [x] photo details modal exists for the selected image

### 2.3 Vision system foundation

- [x] Vision presets exist for listing enhancement / declutter / furniture removal / flooring / wall / kitchen / exterior concepts
- [x] staged Vision workflow exists:
  - `Clean`
  - `Finishes`
  - `Style`
  - `Finalize`
- [x] Vision supports using a selected variant as the next-stage source
- [x] long-running Vision jobs now show progress UI
- [x] long-running Vision jobs now have disconnect-recovery behavior
- [x] long-running Vision jobs now have an audible completion indicator
- [x] attempt history exists for generated variants
- [x] attempts can now be kept or deleted individually
- [x] variants can be saved back into Photos
- [x] scripts now exist to clean up old variants from the backend

### 2.4 Vision quality progress

- [x] furniture removal moved from “mostly non-working” to “usable for seller/agent planning”
- [x] multi-provider orchestration foundation exists
- [x] provider fallback / recovery messaging exists in the UI
- [x] cleaned-room outputs can now be chained into finish updates
- [x] dark-floor pass can now operate on a cleaned-room result instead of only the original

What this means in practical terms:

- furniture removal is now good enough to support presentation planning
- the workflow can support a staged room transformation model
- the app is beginning to behave like a guided listing-presentation assistant instead of a pile of unrelated image buttons

### 2.5 Marketing output and listing materials

- [x] persisted social ad pack generation exists
- [x] brochure generation exists
- [x] report generation exists
- [x] latest brochure / report / social-pack retrieval exists
- [x] workspace actions for these outputs are real and backend-backed
- [x] saved generated assets can be promoted into listing-photo flow

### 2.6 Provider, billing, and admin progress

- [x] provider account recovery / linking / review tooling exists
- [x] Stripe and provider billing visibility are much stronger
- [x] admin usage views exist
- [x] admin media-variant visibility and cleanup actions exist
- [x] admin provider and provider-lead management is much deeper than before
- [x] usage safeguards for long-running / costly flows are beginning to move from code constants into admin-controlled settings

### 2.7 Pricing analysis and RentCast safeguards

- [x] pricing analysis now keeps only the latest analysis record per property
- [x] cleanup tooling exists for duplicate pricing analyses
- [x] RentCast pricing-query policy model exists
- [x] pricing cooldown is now configurable through admin policy rather than hardcoded only in pricing routes
- [x] max fresh pricing queries per property / user is now configurable
- [x] workspace pricing refresh can now explain when cached pricing is being shown due to cooldown or query-limit rules
- [x] admin usage page now includes pricing-analysis criteria controls

### 2.8 Operational tooling and cleanup

- [x] variant cleanup script exists
- [x] pricing-analysis cleanup script exists
- [x] media-index verification script exists
- [x] delete-performance timing instrumentation exists for variant deletion
- [x] attempt-history timestamps / latest-result recovery behavior were improved

---

## 3. Current State Of The Product

### What now feels strong

- seller account basics
- property lifecycle controls
- photo import + organization
- Vision progress / recovery feedback
- furniture-removal concept generation
- admin visibility and cleanup tooling
- pricing safeguard direction

### What still feels confusing or fragile

- Photos and Vision still have too much overlapping language and too many ways to do similar actions
- Vision result selection still needs to feel more obvious and more stable
- finish-update presets can still add unwanted furniture or subtle artifacts
- some long-running Vision jobs are still slow enough to create uncertainty for the user
- attempt history is better but still not as simple as it should be
- workspace information density is still too high in places

---

## 4. Prioritized Remaining Work

The list below is the active to-do list, in recommended execution order.

### Priority 0: Test And Stabilize What Was Just Added

- [ ] validate the new pricing-analysis criteria controls in admin
- [ ] validate pricing cooldown messaging in the seller workspace
- [ ] validate per-property pricing query cap behavior end to end
- [ ] validate that latest pricing is still returned correctly when fresh queries are blocked
- [ ] validate Photos -> Vision handoff across all major room categories
- [ ] validate Vision attempt keep/delete/save behavior with real user flows
- [ ] inspect variant-delete timing logs and confirm whether storage cleanup is the main bottleneck

### Priority 1: Simplify The Photos / Vision UX

- [ ] make Photos the unmistakable entry point for image work
- [ ] make the selected-photo -> open Vision path more obvious and singular
- [ ] remove remaining redundant controls and repeated information blocks
- [ ] reduce information density in Vision current-result / metadata areas
- [ ] make “what should I do next?” obvious at every Vision stage
- [ ] improve attempt-history browsing so it feels like a clear drawer / modal, not a wall of options
- [ ] make it impossible to lose track of the latest generated result

### Priority 2: Strengthen The Staged Vision Workflow

- [ ] add / refine a dedicated `cleanup_empty_room` second pass after furniture removal
- [ ] improve finish passes so they preserve the cleaned room without adding furniture
- [ ] make floor-only changes more dramatic when requested, while preventing added objects
- [ ] improve wall / cabinet / countertop pass quality on cleaned variants
- [ ] make stage-to-stage chaining clearer and more reliable
- [ ] clarify how saved Photos assets, Vision drafts, and stage baselines relate to each other

### Priority 3: Improve Output Quality Without Turning The App Into An Interior Design Tool

- [ ] keep “cleaned room” outputs presentation-focused, not decorative
- [ ] add a stronger distinction between:
  - cleaned room
  - updated finishes
  - styled concept
- [ ] improve brochure polish and section organization
- [ ] improve report readability and section organization
- [ ] improve social-ad-pack usefulness and export clarity

### Priority 4: Performance And Cost Control

- [ ] reduce average Vision processing time for premium room-cleanup workflows
- [ ] add stronger caching / reuse of intermediate cleaned-room results
- [ ] identify which provider chain steps are consuming the most time
- [ ] continue enforcing admin-configurable safeguards on costly pricing / vision flows
- [ ] decide whether some slower Vision passes should become explicit premium / upgraded runs

### Priority 5: Admin / Operations / Diagnostics

- [ ] add route/API tests for pricing cooldown and per-property cap decisions
- [ ] expose more pricing-guard telemetry in admin if needed
- [ ] refine variant cleanup lifecycle so temporary attempts expire more predictably
- [ ] add a better admin runbook for media-variant cleanup, pricing cleanup, and index verification
- [ ] continue tightening docs so they reflect the current staged Vision model

### Priority 6: Broader Product Expansion After Stabilization

- [ ] full provider signup -> verify -> billing -> portal production validation
- [ ] stronger public funnel attribution and conversion reporting
- [ ] broader mobile validation for the newest workspace flows
- [ ] additional premium marketing-output polish after Photos / Vision UX is stable

---

## 5. Suggested Immediate Testing Order

While active testing is happening, the most valuable sequence is:

1. Pricing analysis safeguards
   - test fresh run
   - test cached run within cooldown
   - test max-query limit behavior
   - confirm admin settings actually change the behavior

2. Photos -> Vision handoff
   - select room
   - open correct photo in Vision
   - confirm current result / attempt history / baseline source behave correctly

3. Vision staged flow
   - remove furniture
   - keep or save the best result
   - use that result for finish updates
   - test dark floors / wall pass

4. Attempt lifecycle
   - view attempt
   - keep attempt
   - save attempt to Photos
   - delete attempt permanently
   - confirm deletion speed and resulting UI state

---

## 6. Recommended Next Implementation Passes

If work continues immediately after testing, the best order is:

### Pass A: Photos / Vision simplification

- make the image workflow cleaner and more obvious
- reduce redundancy
- clarify current result vs history vs saved photo

### Pass B: Vision quality on top of the cleaned-room baseline

- cleanup pass refinement
- floor / wall / cabinet finish quality
- no-new-furniture safeguards on finish passes

### Pass C: Performance and lifecycle hardening

- faster Vision completion
- clearer result persistence
- stronger temporary-attempt cleanup

### Pass D: Marketing-output polish

- brochure/report/social-pack UX and export polish

---

## 7. Notes

- The platform now clearly supports the “step-by-step listing presentation” direction.
- The biggest remaining product risk is not missing features. It is user confusion caused by too much information and too many overlapping controls.
- The biggest technical risk is still Vision speed / cost / quality tradeoff on longer premium runs.
- The newest pricing safeguards are now implemented, but they need real validation in deployment and admin use.

This means the next phase should emphasize simplification, preservation of user confidence, and deliberate high-value polish rather than expanding the surface area too quickly.
