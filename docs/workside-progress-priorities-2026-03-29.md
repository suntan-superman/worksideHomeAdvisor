# Workside Progress And Priorities

Last updated: 2026-03-31

This document is the working checkpoint after the latest implementation pass across the HomeAdvisor / Workside codebase.

It is meant to answer three questions clearly:

1. What is already real and working?
2. What exists but still needs refinement?
3. What should we work on next, in priority order?

---

## 1. Executive Snapshot

The platform is now well beyond the scaffold stage.

### Seller side

- Web app is live and usable
- Mobile app is working on Android and iOS
- Auth, OTP verification, dashboard, pricing, media capture, report generation, flyer generation, checklist persistence, and listing-photo workflows are all in place
- Vision generation is running with Replicate-backed presets and before/after review UI
- Property workspace now includes a computed guided workflow rail with role-aware seller / realtor copy, progress, next-step guidance, and market-ready scoring

### Admin side

- Admin login exists and is protected
- Admin overview, users, properties, billing, usage, workers, and providers pages are implemented
- Provider operations and variant lifecycle visibility exist
- Providers page now has a tabbed workspace to reduce scrolling

### Marketplace side

- Provider marketplace foundation exists
- Provider onboarding flow exists
- Provider billing hookup exists
- Provider portal exists
- Provider lead operations exist in admin
- Provider verification tiers, trust fields, and document upload now exist

### Infrastructure side

- Backend is deployed on Cloud Run
- Seller web app is deployed
- Admin web app is deployed
- Stripe is wired for seller/agent plans and now extended for provider billing
- Twilio groundwork exists, but production marketplace SMS rollout is intentionally paused pending the dedicated number / approval path

Bottom line:

The product now has real seller, provider, and admin surfaces. The main remaining work is refinement, hardening, and closing the last architecture gaps rather than inventing brand-new foundations.

---

## 2. What Is Implemented

### 2.1 Core platform

- [x] Monorepo structure with `apps/web`, `apps/mobile`, `apps/api`, `apps/admin-web`
- [x] MongoDB-backed API
- [x] Google Cloud deployment path
- [x] Netlify deployment path for web/admin
- [x] SendGrid / email workflows
- [x] RentCast pricing/comps integration
- [x] Replicate integration for vision phase 1
- [x] Stripe shared billing foundation

### 2.2 Auth and account system

- [x] Email/password signup
- [x] OTP verification
- [x] Login and resend-OTP
- [x] Seller role
- [x] Agent role
- [x] Provider role
- [x] Admin and super-admin roles
- [x] Provider onboarding now creates a real provider auth account when needed
- [x] Provider verification emails are role-aware

### 2.3 Seller workflow

- [x] Property creation and selection
- [x] Active-property limits tied to seller / agent billing access
- [x] Property archive / restore with read-only archived state
- [x] Pricing analysis
- [x] Comp display and map
- [x] Media upload and storage
- [x] AI photo review
- [x] Listing-candidate selection
- [x] Checklist persistence and scoring
- [x] Guided workflow state engine for property-level seller / realtor flows
- [x] Role-aware next-step recommendations in the property workspace
- [x] Brochure/flyer generation
- [x] Seller report generation and export

### 2.4 Vision pipeline

- [x] Vision job and variant models
- [x] Preferred variant selection
- [x] Variant lifecycle with temporary expiration and cleanup
- [x] Replicate provider integration
- [x] `declutter_light`
- [x] `declutter_medium`
- [x] `remove_furniture`
- [x] Before/after slider in web Vision tab
- [x] Variant scoring / ranking metadata

### 2.5 Provider marketplace

- [x] Provider records and categories
- [x] Provider lead requests
- [x] Provider save/request flows from seller checklist context
- [x] Admin provider seeding
- [x] Admin provider review/approval controls
- [x] Provider signup flow
- [x] Provider billing checkout flow
- [x] Provider portal
- [x] Provider lead accept/decline in portal
- [x] Self-reported provider verification fields
- [x] Provider verification details in onboarding and portal
- [x] Provider insurance and license document upload
- [x] Provider verification submission for admin review
- [x] Seller-facing provider trust badges and disclaimer
- [x] Admin document access and verification actions

### 2.6 Admin and ops

- [x] Admin login page and middleware protection
- [x] Admin overview
- [x] Users page
- [x] Properties page
- [x] Billing page
- [x] Usage page
- [x] Workers page
- [x] Providers page
- [x] Worker / variant cleanup visibility
- [x] Manual variant cleanup action
- [x] Provider lead resend / close actions

### 2.7 Legal and compliance pages

- [x] Terms page
- [x] Privacy page
- [x] SMS consent page
- [x] Mailing address added
- [x] SMS approval-oriented disclosure copy added

---

## 3. Implemented But Still Needing Refinement

These areas exist and are useful, but they are not yet “finished product” quality.

### 3.1 Vision quality

- [~] Replicate presets work, but output quality still needs tuning
- [~] Mask strategy is heuristic, not segmentation-grade
- [~] Declutter / remove-furniture results are still inconsistent
- [~] Vision is useful now, but not yet a true premium differentiator

### 3.2 Documents

- [~] Brochure/flyer generation is real, but presentation quality can improve
- [~] Report generation is real, but export/layout quality still has room to grow
- [~] PDF generation is good enough for workflow use, not yet best-in-class design

### 3.3 Provider system

- [~] Provider marketplace foundation is real, but provider ranking and coverage fallback are still early
- [~] Provider portal exists, but account-management maturity is still limited
- [~] Provider onboarding is much better now, but billing + verification UX can still be polished
- [~] Verification is now real, but admin automation and expiry workflows are still early

### 3.4 Admin UX

- [~] Providers page is now tabbed, but broader admin UX still needs more operational polish
- [~] Admin is functional, but not yet a fully optimized operations console

### 3.5 Testing and hardening

- [ ] Real automated tests are still mostly missing
- [ ] Worker services are still lightweight placeholders compared with the full future architecture

### 3.6 Property lifecycle and billing model

- [~] Active-property limits now exist, but the actual commercial plan strategy still needs refinement
- [~] Archived properties are read-only and excluded from active counts, but broader admin/archive reporting is still light
- [~] Seller and agent billing now behaves more like a capacity model, but per-property charging/accounting is still not a finished product

### 3.7 Guided workflow rollout

- [~] A property-level workflow engine now exists, but it is currently centered in the property workspace rather than across the entire product
- [~] Seller / realtor workflow copy is now role-aware, but account setup and dashboard surfaces still need the same guided treatment
- [~] Workflow state is computed automatically, but deeper blocker logic and more nuanced optional-step handling can still improve

---

## 4. Current Blockers Or Deliberate Pauses

### 4.1 Marketplace SMS rollout

- Twilio integration groundwork exists in backend
- Marketplace SMS sending logic exists
- Inbound webhook route exists
- Existing Merxus number/webhook should not be disturbed
- Dedicated marketplace SMS number / approval flow is the safe path

Current status:

- SMS is intentionally paused until the new number and approval path are ready

### 4.2 Provider fallback outside marketplace coverage

- Internal provider recommendations exist
- Area-aware fallback behavior is not fully implemented yet
- Google fallback remains a future refinement

---

## 5. Remaining Work By Priority

## Priority 0: Stabilize The Current Launch-Critical Flows

These are the highest-value refinements because they affect trust, demos, and everyday use right now.

### 5.1 Provider account ownership and access hardening

- [ ] add provider account recovery / reset flow
- [ ] add admin tooling to link older seeded providers to real provider accounts
- [ ] add cleaner “already have a provider account?” path inside onboarding
- [ ] tighten provider-only account management boundaries further
- [ ] add provider email change / re-verification flow if account email needs to be corrected later

### 5.2 Provider billing validation

- [ ] complete live end-to-end provider signup -> verify -> billing -> portal test with Stripe
- [ ] confirm webhook updates for provider subscription states in production
- [ ] verify featured placement behavior against provider Stripe plans

### 5.2a Seller and agent billing / property-cap model

- [x] define how seller plans map to active property count limits
- [x] define how agent plans map to active property count limits
- [ ] support per-property billing / subscription visibility where needed
- [x] make dashboard billing chooser show only plans relevant to the signed-in account type everywhere
- [x] show active subscription count and remaining active-property capacity in seller and agent UI

### 5.2b Guided workflow system expansion

- [x] introduce a real computed workflow state engine for seller / realtor property flows
- [x] surface progress, next step, and role-specific workflow copy in the property workspace
- [ ] extend guided workflow into dashboard / onboarding so the path starts before the property workspace
- [ ] add a mobile workflow companion layer with room-by-room progress tied directly to the same workflow state
- [ ] add stronger blocked-state logic and dependency explanations for steps that cannot start yet
- [ ] connect workflow steps to richer property-edit screens where “open dashboard” is still a fallback
- [ ] decide whether optional steps should be skippable or silently auto-resolved in more cases

### 5.3 Vision quality refinement

- [ ] tune prompts and mask regions by preset and room type
- [ ] improve artifact rejection / low-confidence filtering
- [ ] better differentiate `declutter_light`, `declutter_medium`, and `remove_furniture`
- [ ] make selected best variants more obvious in seller outputs

---

## Priority 1: Make The Marketplace Operationally Strong

### 5.4 Provider coverage and ranking

- [ ] use provider service areas more explicitly in ranking/filtering
- [ ] show “no providers in area yet” gracefully
- [ ] add fallback path for uncovered areas
- [ ] give strong precedence to registered Workside providers over fallback results

### 5.5 Provider profile maturity

- [ ] richer service-area editing
- [ ] richer licensing / insurance / bonding review history
- [ ] add credential expiration alerts and admin follow-up queues
- [ ] add per-business-type verification requirement editing in admin
- [ ] add provider-side ability to replace or remove outdated uploaded documents cleanly
- [ ] add optional carrier, policy, and license audit fields for verified providers
- [ ] better featured / sponsored management
- [ ] better provider quality scoring inputs

### 5.6 Marketplace admin polish

- [ ] extend tabbed / workflow-oriented UX beyond just providers page
- [ ] add better filters/search on providers and leads
- [ ] add bulk actions where useful
- [ ] add better audit visibility for provider changes and lead routing outcomes

---

## Priority 2: Improve Premium Seller Output Quality

### 5.7 Reports and brochure quality

- [ ] improve brochure layout and visual finish
- [ ] improve report layout and PDF polish
- [ ] persist brochure/report draft state more explicitly per property
- [ ] add stronger seller-facing customization controls
- [ ] store final PDFs with durable download URLs

### 5.8 Media maturity

- [ ] add explicit media ordering
- [ ] add first-class brochure/report inclusion state on base assets
- [ ] refine listing-photo candidate review and ordering UX
- [ ] improve cross-device media management polish

### 5.8a Property lifecycle

- [x] add property archive state and archive / restore actions
- [x] prevent editing on archived properties while still allowing read-only access
- [x] exclude archived properties from active-property billing counts
- [ ] add admin visibility into active vs archived properties
- [ ] decide whether archived properties retain exports/media permanently or move to cold storage later

---

## Priority 3: Usage, Safeguards, And Trust

### 5.9 Vision quotas and usage visibility

- [ ] enforce plan-based vision quotas
- [ ] expose vision usage summary in UI/admin
- [ ] add better upgrade-required responses for premium vision usage

### 5.10 Diagnostics and operations

- [ ] better structured logs for provider, billing, and vision flows
- [ ] clearer usage / failure diagnostics in admin
- [ ] better worker-backed processing story for long-running document/vision jobs
- [ ] add admin notifications/tasks when a provider submits verification

---

## Priority 4: Engineering Hardening

### 5.11 Automated testing

- [ ] auth flows
- [ ] pricing flows
- [ ] media upload and vision job flows
- [ ] report generation
- [ ] provider onboarding and billing
- [ ] admin auth and provider lead actions

### 5.12 Cleanup and consistency

- [ ] formalize shared billing env/docs for Merxus + HomeAdvisor
- [ ] tighten outdated docs that still describe older assumptions
- [ ] add more explicit deployment/runbook notes for provider rollout

---

## 6. Recommended Next Implementation Order

If work resumes tomorrow, the most sensible order is:

1. Complete real provider signup -> verification -> billing -> portal end-to-end validation
2. Improve provider coverage filtering and graceful no-coverage handling
3. Refine the seller/agent property-cap model into a true per-property billing strategy where needed
4. Extend the guided workflow system into dashboard + mobile so the whole journey feels coached
5. Refine vision quality on the three Replicate presets
6. Polish report/brochure premium output quality
7. Add provider account recovery / linking tools
8. Start real automated tests around the new flows

---

## 7. Suggested “Tomorrow” Starting Point

If the goal is immediate product value with low rework risk, start here:

### Option A: Marketplace hardening

- validate live provider billing thoroughly
- tighten provider coverage filtering
- add graceful uncovered-area fallback behavior

### Option B: Premium output quality

- refine vision preset quality
- make brochure/report output feel more premium

### Option C: Trust and readiness

- add provider account recovery / linking
- add tests around auth, provider billing, and provider portal flows

Recommended choice:

Start with **Option A**, then move into **Option B**.

That gives the product a stronger operational core before spending more time on polish.

---

## 8. Notes For Restart

- Backend, seller web, and admin web are all active work surfaces now
- Admin providers page was recently converted to tabs
- The shared admin table/metric boundary issue has already been fixed
- Provider onboarding now creates real provider auth accounts and requires email verification before billing continuation
- Provider verification now supports self-reported trust fields, document upload, seller-facing trust display, and admin verification review
- Property workspace now has a real role-aware guided workflow rail powered by a backend workflow endpoint
- SMS marketplace logic exists in code, but rollout is paused intentionally

---

## 9. Bottom Line

This project now has:

- a real seller product
- a real provider foundation
- a real admin console
- a real billing path
- a working vision pipeline

What remains is mostly about:

- refinement
- trust
- operational maturity
- better premium output quality
- testing

That is a very different stage than where the project started.
