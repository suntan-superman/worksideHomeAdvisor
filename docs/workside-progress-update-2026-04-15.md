# Workside Progress Update

Last updated: 2026-04-15

Includes the morning live wall-preview test artifacts from:

- `../results.md`
- `../output.txt`
- `C:/Users/sjroy/Pictures/Screenshots/Screenshot 2026-04-15 063414.png`
- `C:/Users/sjroy/Pictures/Screenshots/Screenshot 2026-04-15 063426.png`

This is the current checkpoint and active to-do list for the HomeAdvisor / Workside codebase.

It is intended to let a new chat pick up without losing recent Vision, workspace, pricing, and performance context.

---

## 1. Executive Snapshot

The product is no longer in a “missing major surfaces” phase.

It is now in a:

- workflow simplification
- Vision reliability / quality tuning
- query optimization
- premium polish

phase.

The most important truth right now is:

- the system can create real seller-facing value today
- the remaining work is mostly about consistency, clarity, and reducing false starts

The best recent progress:

- furniture removal became genuinely useful
- floor lightening finally began producing visible changes
- Vision history / saving / deleting is much more manageable
- pricing safeguards and admin controls are real
- backend diagnostics and cleanup tooling are much stronger
- the 2026-04-15 morning live wall test produced a visually usable result with believable walls, stable floors, and preserved trim / windows

The biggest unresolved area:

- wall and floor finish previews still need more tuning to become reliably subtle-but-believable without hallucinations or no-op results
- the latest live wall test looked good, but the logs show the wall masking path still failed and the result was carried by fallback behavior instead of a healthy masked wall pipeline

---

## 2. Major Accomplishments

### 2.1 Core account and property workflow

- [x] seller auth and account flows are in place
- [x] forgot-password / reset flows exist
- [x] profile/contact state is editable and persisted
- [x] property archive / restore exists
- [x] permanent property delete exists with backend cleanup behavior
- [x] idle web session timeout was fixed so elapsed inactivity logs the user out even after sleep / overnight idle

### 2.2 Photos and library workflow

- [x] direct web photo import exists
- [x] mobile capture/import exists
- [x] source metadata and notes are stored on photos
- [x] photo categorization exists:
  - Kitchen
  - Living Room
  - Master Bedroom
  - Master Bathroom
  - Other
  - Exterior
- [x] Seller Pick behavior exists
- [x] photo details modal exists
- [x] variations modal exists
- [x] variations can be viewed, selected, kept, and deleted
- [x] variation count updates were improved after delete
- [x] variation sorting was added
- [x] variation bulk-selection groundwork exists

### 2.3 Vision workflow foundation

- [x] single-photo Vision workspace exists
- [x] staged workflow exists:
  - Clean
  - Finishes / Buyer Appeal Previews
  - Style
  - Finalize
- [x] a selected variant can be used as the source for the next stage
- [x] attempts can be viewed, kept, deleted, and saved back into Photos
- [x] long-running Vision progress UI exists
- [x] disconnect recovery exists
- [x] completion sound exists for longer jobs
- [x] clearer error and recovery toasts exist
- [x] browser-native delete confirm dialogs were replaced with in-app confirmation UI

### 2.4 Vision quality progress

#### Clean room / furniture removal

- [x] furniture removal moved from unstable to useful
- [x] stronger provider fallback behavior exists
- [x] obvious staged-room false winners were reduced
- [x] cleanup-oriented chaining from cleaned room to later steps exists

#### Floors

- [x] dark-floor previews became visibly useful
- [x] light-floor previews finally began producing visible output
- [x] material-swap experiments revealed that full tile/stone replacement is not yet a dependable product surface
- [x] finish-stage copy was redesigned away from overpromising exact material installation

Current reality for floors:

- tonal / buyer-appeal direction previews are working better
- exact material reinterpretation still needs caution

#### Walls

- [x] wall masking fallback work was added
- [x] perceptibility / strong-enough logic was introduced
- [x] stricter anti-hallucination logic was added for wall fixtures / decor

Current reality for walls:

- the system is better than before
- the latest live test produced a clean, believable seller-usable visual result
- logs from that same run showed `wallMaskCoverage: 0` and `Fallback wall mask coverage out of range: 0`
- `local_sharp` failed on the wall fallback mask, so the current good result appears to be coming from `openai_edit` / global shift behavior instead of the intended wall-mask architecture
- that means wall output is currently usable on some images, but still fragile and not yet controlled enough to call “done”

### 2.5 Marketing outputs

- [x] brochure generation exists
- [x] report generation exists
- [x] social ad pack generation exists
- [x] latest flyer/report/social pack retrieval exists
- [x] selected photos and saved Vision outputs can flow into brochure/report generation

### 2.6 Pricing analysis and safeguards

- [x] pricing analysis now keeps only the latest record per property
- [x] cleanup tooling exists for duplicate pricing analyses
- [x] RentCast pricing cooldown is admin-controlled
- [x] per-property / per-user pricing query caps exist
- [x] seller-facing pricing refresh messaging explains cooldown / query-limit behavior
- [x] admin pricing policy controls exist

### 2.7 Performance, cleanup, and diagnostics

- [x] media variant cleanup tooling exists
- [x] pricing analysis cleanup tooling exists
- [x] media index verification tooling exists
- [x] duplicate-checklist race on second property creation was fixed
- [x] Mongo query logging was added for debugging
- [x] route/timing instrumentation improved delete-path diagnosis
- [x] request routing around temporary media URLs for Replicate was debugged and corrected

### 2.8 Morning live test reality check

Artifacts reviewed:

- `../results.md`
- `../output.txt`
- `C:/Users/sjroy/Pictures/Screenshots/Screenshot 2026-04-15 063414.png`
- `C:/Users/sjroy/Pictures/Screenshots/Screenshot 2026-04-15 063426.png`

What the screenshots showed:

- walls looked clean and believable
- floors stayed stable and realistic
- windows / trim stayed untouched
- no obvious hallucinations were visible in the tested output

What the logs showed:

- provider output for the tested wall preset came from `openai_edit`
- the wall debug log reported `strategy: 'fallback_wall'`
- `wallMaskCoverage: 0`
- `reason: 'Wall mask coverage out of range: 0'`
- `local_sharp` failed because the fallback wall mask was empty
- a long-running request completed around `160031 ms`, so this path is still expensive and operationally fragile

Meaning of that combination:

- the user-facing result can already look product-usable on some images
- but the intended wall-mask pipeline is still not healthy
- the current success is still too dependent on fallback behavior and prompt quality
- the system is working despite the architecture more than because of it

---

## 3. Current Product State

### What feels genuinely strong now

- property lifecycle basics
- photo import and organization
- seller picks / photo details / variations management
- furniture removal as a seller-facing presentation tool
- some real wall-preview outputs now look seller-usable even on live tests
- brochure and report generation as real product surfaces
- pricing guardrails and admin control direction

### What still feels fragile or unfinished

- wall color previews
- wall fallback masking can still collapse to zero coverage on real images
- floor material replacement previews
- some finish-stage hallucination behavior
- query duplication / workspace over-fetching
- overall workspace information density
- clearer step-by-step guidance in the UI

---

## 4. Important Architectural Changes Already Landed

These matter for the next chat because they change where work should continue.

### Backend aggregation / query reduction

- [x] `GET /api/v1/properties/:id/full` exists
- [x] consolidated workspace snapshot service exists in `apps/api/src/modules/properties/property-workspace.service.js`
- [x] dashboard and workflow backend now reuse the snapshot service
- [x] batched media variant loading with `$in` exists in the snapshot service
- [x] projections were added to multiple property/media/pricing queries

### Vision masking / finish infrastructure

- [x] canonical surface-mask resolution was introduced in `apps/api/src/modules/media/media-ai.service.js`
- [x] wall fallback mask logic exists
- [x] floor mask debugging and local finish debugging were added
- [x] finish evaluation and perceptibility logic were tightened

---

## 5. Current In-Progress Work That Was Not Yet Fully Verified

These are the most important “do not lose context” items from the most recent working session.

### 5.1 Workspace query optimization on the web

Work was actively being applied in:

- `apps/web/app/properties/[propertyId]/PropertyWorkspaceClient.js`
- `apps/web/styles/globals.css`

Intent of the change:

- switch the workspace from separate dashboard/checklist/media boot queries to the new consolidated property snapshot
- coalesce repeated refresh calls through one shared snapshot refresh path
- add a dismissible `Home Advisor Agent` guide card in the right rail

Status:

- partially edited
- not yet fully verified with build/test in the last active thread

This is the first thing the next chat should validate before building more on top of it.

### 5.2 Right-rail guide / UX enhancement

The intended guide behavior is:

- if no pricing: point user to Pricing
- if no photos: point user to Photos
- if no seller picks: point user to Seller Picks / Photos
- if no brochure: point user to Brochure
- if no report: point user to Report
- otherwise point user to the guided workflow next step

Status:

- design direction is clear
- implementation is underway
- verification still needed

### 5.3 Morning live wall test findings that now need action

The most important new context from the 2026-04-15 morning live test is:

- the visual result looked good enough to be encouraging
- but the architecture did not work the way it is supposed to

Confirmed from `results.md` + `output.txt`:

- wall preview output looked clean, believable, and free of obvious artifacts
- floor output remained stable
- `wallMaskCoverage` still hit `0`
- fallback wall masking was rejected before the deterministic/local wall path could help
- `openai_edit` did the heavy lifting on the successful-looking result

Most likely immediate failure zone from the current evidence:

- fallback wall coverage is probably being zeroed during refinement rather than never being created at all
- first suspects are the wall-mask cleanup / rejection steps such as bright-area suppression, edge suppression, or final mask rejection thresholds

Conclusion:

- this is no longer a “can the UI show something useful?” problem
- it is now a “make the wall pipeline deterministic, controlled, and repeatable” problem
- wall masking stability is now more important than adding more wall presets or more polish on top

---

## 6. Highest Priority Remaining Work

### Priority 0: Fix The Live-Test Wall Mask Failure

- [ ] reproduce the `paint_warm_neutral` live-test case and keep the artifact references with it
- [ ] force the fallback wall mask to stay non-zero before any refinement logic runs
- [ ] add explicit before/after coverage logs around wall-mask refinement steps so it is obvious where the mask dies
- [ ] inspect the steps that most likely zero the mask now: bright-area suppression, edge suppression, and final wall-mask rejection thresholds
- [ ] temporarily disable or soften over-filtering steps if they are zeroing the fallback wall mask
- [ ] lower the temporary wall-mask rejection threshold for debugging until coverage is observable in logs
- [ ] verify logs show non-zero `wallMaskCoverage` and confirm the local / masked wall path runs again

### Priority 1: Verify The Current Client Refactor

- [ ] verify `PropertyWorkspaceClient` compiles and builds after the latest snapshot / guide edits
- [ ] verify the right-rail `Home Advisor Agent` card appears and can be dismissed/restored
- [ ] verify workspace boot no longer does redundant dashboard/checklist/media fetches on first load
- [ ] verify post-action refreshes reuse the consolidated snapshot instead of duplicating network work

### Priority 2: Finish Wall / Floor Reliability

- [ ] continue wall mask fallback and perceptibility tuning so visible wall changes happen without invented wall fixtures
- [ ] reduce introduced wall frames / radiators / trim-like artifacts
- [ ] keep floor tone previews believable while tightening rough edges and mask bleed
- [ ] decide whether exact floor material replacement should stay hidden/de-emphasized for now
- [ ] keep finish-stage language aligned with “buyer appeal preview” instead of exact remodeling promise

### Priority 3: Simplify Photos / Vision UX

- [ ] make Photos the clear entry point
- [ ] keep Vision contextual, not overwhelming
- [ ] reduce metadata density in current-result areas
- [ ] make “what should I do next?” obvious at every step
- [ ] continue improving attempt history so it feels like a clean review tool rather than a pile of variants

### Priority 4: Query Optimization / Performance

- [ ] finish moving web workspace state onto `GET /api/v1/properties/:id/full`
- [ ] remove leftover repeated fetch patterns in the property workspace
- [ ] measure actual latency gains after the client refactor
- [ ] continue tightening projections and duplicate reads where the logs still show waste

### Priority 5: Marketing Output Polish

- [ ] improve brochure readability / polish
- [ ] improve report structure and buyer/seller storytelling
- [ ] continue making Seller Picks the dominant photo story for outputs

### Priority 6: Admin / Ops / Diagnostics

- [ ] keep cleanup scripts documented and easy to run
- [ ] continue verifying pricing policy controls end-to-end
- [ ] keep variant lifecycle manageable so testing artifacts do not pile up

---

## 7. Recommended First Steps For The Next Chat

1. Reproduce and fix the live-test wall mask failure before doing more wall polish work.
2. In the wall pipeline, instrument and verify:
   - fallback wall mask creation coverage
   - coverage after bright-area suppression
   - coverage after edge suppression
   - coverage after any final refinement / rejection step
3. Confirm that the tested wall case no longer logs `wallMaskCoverage: 0` and that non-fallback wall processing runs.
4. Verify and finish the current `PropertyWorkspaceClient` snapshot/guide refactor.
5. Run:
   - `npm run test --workspace=@workside/api`
   - `npm run build --workspace=@workside/web`
6. If the web build is clean, retest:
   - property workspace boot
   - right-rail guide
   - photo import / seller picks
   - one wall preview
   - one floor preview
7. Then do one focused wall pass:
   - improve visible wall change
   - suppress introduced wall fixtures
   - confirm wall success is coming from a real mask path instead of accidental fallback success

---

## 8. Key Files For The Next Chat

### Backend

- `apps/api/src/modules/properties/property-workspace.service.js`
- `apps/api/src/modules/properties/property.routes.js`
- `apps/api/src/modules/workflow/workflow.service.js`
- `apps/api/src/modules/dashboard/dashboard.routes.js`
- `apps/api/src/modules/media/media-ai.service.js`
- `apps/api/src/modules/media/vision-presets.js`
- `apps/api/src/modules/media/vision-orchestrator.helpers.js`
- `apps/api/src/modules/media/vision-orchestrator.service.js`
- `apps/api/src/modules/media/openai-image.provider.js`
- `apps/api/src/modules/pricing/pricing.service.js`
- `apps/api/src/modules/tasks/tasks.service.js`

### Live test artifacts

- `../results.md`
- `../output.txt`
- `C:/Users/sjroy/Pictures/Screenshots/Screenshot 2026-04-15 063414.png`
- `C:/Users/sjroy/Pictures/Screenshots/Screenshot 2026-04-15 063426.png`

### Web

- `apps/web/app/properties/[propertyId]/PropertyWorkspaceClient.js`
- `apps/web/lib/api.js`
- `apps/web/styles/globals.css`

---

## 9. Bottom Line

We are no longer trying to prove the product concept.

We now have:

- usable property workflow
- usable photo workflow
- usable furniture-removal workflow
- usable brochure/report workflow
- usable pricing safeguards

The next value comes from:

- simplifying the workspace
- reducing duplicate work
- making wall/floor previews more reliable and more believable
- turning the wall pipeline from “visually good but fallback-dependent” into something controlled, repeatable, and actually mask-driven

That is a much better place to be than where the project started.
