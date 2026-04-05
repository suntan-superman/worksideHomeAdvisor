# Workside Progress And Priorities

Last updated: 2026-04-04

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
- Property workspace, seller dashboard, and mobile workspace now include a computed guided workflow layer with role-aware seller / realtor copy, progress, next-step guidance, and market-ready scoring
- Seller workflow now includes a persisted chosen list price, shortlist-based provider reference sheet export, property archive / restore, and active-property limits
- Seller acquisition funnel now exists with a public landing page, mini onboarding, partial preview, email gate, and dashboard handoff

### Admin side

- Admin login exists and is protected
- Admin overview, users, properties, billing, usage, workers, and providers pages are implemented
- Provider operations and variant lifecycle visibility exist
- Providers page now has a tabbed workspace to reduce scrolling
- Provider roster now supports stronger review controls, exact-name delete confirmation, and better operational sorting/filtering

### Marketplace side

- Provider marketplace foundation exists
- Provider onboarding flow exists
- Provider billing hookup exists
- Provider portal exists
- Provider lead operations exist in admin
- Provider verification tiers, trust fields, and document upload now exist
- Provider matching now uses ZIP-plus-radius coverage logic
- Provider shortlist / printable provider reference sheet flow now exists
- In-app provider map exists and Google-fallback search paths now have both structured and map-search fallbacks

### Infrastructure side

- Backend is deployed on Cloud Run
- Seller web app is deployed
- Admin web app is deployed
- Stripe is wired for seller/agent plans and now extended for provider billing
- Twilio groundwork exists, but production marketplace SMS rollout is intentionally paused pending the dedicated number / approval path
- Public landing funnel backend endpoints now exist for seller preview, funnel capture, event tracking, and continue-signup

Bottom line:

The product now has real seller, provider, and admin surfaces. The main remaining work is refinement, hardening, and closing the last architecture gaps rather than inventing brand-new foundations.

---

## 1.1 Recent Progress Since The Last Update

- [x] chosen list price flow implemented and persisted on properties
- [x] flyer / report generation now prefer seller-selected list price when present
- [x] provider reference sheet shortlist and printable PDF export implemented
- [x] provider map modal implemented inside the seller workspace for better viewport control
- [x] provider matching now uses service ZIP plus radius instead of mostly city/state heuristics
- [x] provider portal category editing added so providers can correct mismatched business types
- [x] admin alert email added when an approved provider changes their profile
- [x] provider delete flow in admin now requires exact-name confirmation
- [x] provider roster now exposes more identifying details and sorting / filtering controls
- [x] mobile camera capture flow now prompts to save or discard after each shot
- [x] web photo deletion now uses a real in-app confirmation modal
- [x] idle logout added across seller web, provider portal, and admin
- [x] public landing funnel backend module added for seller preview, funnel capture, event tracking, and continue-signup
- [x] root `/` now acts as a role chooser instead of a generic placeholder
- [x] dedicated public landing pages now exist for `/sell`, `/agents`, and `/providers`
- [x] seller landing now includes mini onboarding, partial pricing/readiness preview, and email gate
- [x] seller landing handoff now pre-fills signup and dashboard property creation
- [x] provider join flow now accepts landing prefills for category and ZIP
- [x] trust / proof sections added across public landing funnels
- [x] ad-specific copy variants added for Instagram and Facebook traffic
- [x] campaign-specific copy variants added for seller, agent, and provider acquisition campaigns

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
- [x] Seller-chosen list price with low / mid / high / custom selection
- [x] Comp display and map
- [x] Media upload and storage
- [x] AI photo review
- [x] Listing-candidate selection
- [x] Checklist persistence and scoring
- [x] Guided workflow state engine for property-level seller / realtor flows
- [x] Role-aware next-step recommendations in the property workspace
- [x] Brochure/flyer generation
- [x] Seller report generation and export
- [x] Provider shortlist / reference sheet PDF export

### 2.3a Public acquisition funnel

- [x] Public role chooser at `/`
- [x] Seller landing page at `/sell`
- [x] Agent landing page at `/agents`
- [x] Provider landing page at `/providers`
- [x] Seller mini onboarding with partial result preview
- [x] Email gate before full seller value reveal
- [x] Landing-to-auth handoff with seller draft preservation
- [x] Dashboard property-create prefill from captured seller draft
- [x] Public funnel event tracking endpoint
- [x] Platform-aware copy variants for Instagram and Facebook
- [x] Campaign-aware copy variants for seller, agent, and provider funnels

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
- [x] Provider map inside seller workspace
- [x] ZIP-plus-radius provider coverage matching
- [x] Internal provider vs not-yet-live provider distinction in seller discovery
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
- [x] Admin alert email when approved providers update their profile

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

- [~] Provider marketplace foundation is real, but Google fallback discovery is still inconsistent compared with consumer Google Maps behavior
- [~] Provider portal exists, but account-management maturity is still limited
- [~] Provider onboarding is much better now, but billing + verification UX can still be polished
- [~] Verification is now real, but admin automation and expiry workflows are still early
- [~] Provider matching is much stronger now, but it still depends heavily on clean category/status/ZIP data in provider records

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

- [~] A property-level workflow engine now exists across property workspace, dashboard, and mobile, but account setup / onboarding still needs the same guided treatment
- [x] Seller / realtor workflow copy is now role-aware in the property workspace, dashboard, and mobile workspace
- [~] Workflow state is computed automatically, but deeper blocker logic and more nuanced optional-step handling can still improve
- [~] Property workspace layout is much better, but several tabs still need more mid-width responsive polish

### 3.8 Public landing and conversion flow

- [~] Seller / agent / provider public funnels now exist, but attribution persistence and reporting still need hardening
- [~] Seller funnel preview is real, but the quality of the partial result and trust sections can still become more premium
- [~] Agent and provider funnels now have campaign-aware copy, but their lead capture and downstream conversion loops are still lighter than the seller flow
- [~] Public funnels are live enough for traffic, but analytics, experiments, and CRM-grade lead handling are still early

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
- Area-aware internal matching is implemented with ZIP-plus-radius coverage
- Structured Google fallback exists, but it is still not matching consumer Google Maps results reliably in all cases
- Live Google Maps search and the in-app provider map are currently the practical fallback experiences when structured Google fallback returns zero results

### 4.3 Google provider search parity

- The backend now tries multiple Google search strategies, including broader query variants and a legacy text-search fallback
- External Google Maps still often shows providers that the backend structured fallback does not return
- This remains an active product-quality issue rather than a missing feature

---

## 5. Remaining Work By Priority

## Priority 0: Stabilize The Current Launch-Critical Flows

These are the highest-value refinements because they affect trust, demos, everyday use, and paid traffic conversion right now.

### 5.1 Conversion funnel hardening and attribution

- [ ] add durable attribution persistence from landing -> auth -> dashboard -> property
- [ ] add a simple canonical Meta/IG/FB campaign naming convention and parser so copy variants stay predictable
- [ ] add stronger seller funnel event coverage and funnel-drop reporting
- [ ] add agent/provider lead capture endpoints and dashboard/admin visibility similar to seller funnel capture
- [ ] add CRM/export-ready lead records for public funnel submissions
- [ ] add safer analytics around preview completion, email gate completion, signup completion, and subscription conversion
- [ ] add experiment hooks for headline/CTA/value-card testing without rewriting the funnel shell
- [ ] add real visual proof assets and production-quality screenshots to the public pages
- [ ] add subscription / plan upsell treatment at the correct post-preview moment for seller traffic

### 5.2 Provider account ownership and access hardening

- [ ] add provider account recovery / reset flow
- [ ] add admin tooling to link older seeded providers to real provider accounts
- [ ] add cleaner “already have a provider account?” path inside onboarding
- [ ] tighten provider-only account management boundaries further
- [ ] add provider email change / re-verification flow if account email needs to be corrected later

### 5.3 Provider billing validation

- [ ] complete live end-to-end provider signup -> verify -> billing -> portal test with Stripe
- [ ] confirm webhook updates for provider subscription states in production
- [ ] verify featured placement behavior against provider Stripe plans

### 5.3a Seller and agent billing / property-cap model

- [x] define how seller plans map to active property count limits
- [x] define how agent plans map to active property count limits
- [ ] support per-property billing / subscription visibility where needed
- [x] make dashboard billing chooser show only plans relevant to the signed-in account type everywhere
- [x] show active subscription count and remaining active-property capacity in seller and agent UI

### 5.3b Guided workflow system expansion

- [x] introduce a real computed workflow state engine for seller / realtor property flows
- [x] surface progress, next step, and role-specific workflow copy in the property workspace
- [x] extend guided workflow into the seller / realtor dashboard
- [x] add a mobile workflow companion layer with room-by-room progress tied directly to the same workflow state
- [ ] extend guided workflow into auth / onboarding so the path starts before the first property is created
- [ ] add stronger blocked-state logic and dependency explanations for steps that cannot start yet
- [ ] connect workflow steps to richer property-edit screens where “open dashboard” is still a fallback
- [ ] decide whether optional steps should be skippable or silently auto-resolved in more cases

### 5.4 Vision quality refinement

- [ ] tune prompts and mask regions by preset and room type
- [ ] improve artifact rejection / low-confidence filtering
- [ ] better differentiate `declutter_light`, `declutter_medium`, and `remove_furniture`
- [ ] make selected best variants more obvious in seller outputs

---

## Priority 1: Make The Marketplace Operationally Strong

### 5.5 Provider coverage and ranking

- [ ] use provider service areas more explicitly in ranking/filtering
- [ ] show “no providers in area yet” gracefully
- [~] fallback path for uncovered areas exists, but needs better structured Google result reliability and clearer user-facing explanation
- [ ] give strong precedence to registered Workside providers over fallback results
- [ ] add richer detail views and saved-reference actions for Google fallback providers
- [ ] improve in-app provider map presentation, marker detail, and viewport fitting for dense local markets
- [ ] make the external Google Maps search path clearly secondary to the controlled in-app provider map
- [ ] add better diagnostics when Google structured fallback returns zero while consumer Google Maps visibly has results

### 5.6 Provider profile maturity

- [ ] richer service-area editing
- [ ] richer licensing / insurance / bonding review history
- [ ] add credential expiration alerts and admin follow-up queues
- [ ] add per-business-type verification requirement editing in admin
- [ ] add provider-side ability to replace or remove outdated uploaded documents cleanly
- [ ] add optional carrier, policy, and license audit fields for verified providers
- [ ] better featured / sponsored management
- [ ] better provider quality scoring inputs

### 5.7 Marketplace admin polish

- [ ] extend tabbed / workflow-oriented UX beyond just providers page
- [ ] add better filters/search on providers and leads
- [ ] add bulk actions where useful
- [ ] add better audit visibility for provider changes and lead routing outcomes

---

## Priority 2: Improve Premium Seller Output Quality

### 5.8 Reports and brochure quality

- [ ] improve brochure layout and visual finish
- [ ] improve report layout and PDF polish
- [ ] add a comprehensive property review PDF that includes a full-page comp map and complete gathered property context
- [ ] persist brochure/report draft state more explicitly per property
- [ ] add stronger seller-facing customization controls
- [ ] store final PDFs with durable download URLs
- [ ] decide whether provider reference sheet should become an appendix to the larger property review PDF

### 5.9 Media maturity

- [ ] add explicit media ordering
- [ ] add first-class brochure/report inclusion state on base assets
- [ ] refine listing-photo candidate review and ordering UX
- [ ] improve cross-device media management polish

### 5.9a Property lifecycle

- [x] add property archive state and archive / restore actions
- [x] prevent editing on archived properties while still allowing read-only access
- [x] exclude archived properties from active-property billing counts
- [ ] add admin visibility into active vs archived properties
- [ ] decide whether archived properties retain exports/media permanently or move to cold storage later

---

## Priority 3: Usage, Safeguards, And Trust

### 5.10 Vision quotas and usage visibility

- [ ] enforce plan-based vision quotas
- [ ] expose vision usage summary in UI/admin
- [ ] add better upgrade-required responses for premium vision usage

### 5.11 Diagnostics and operations

- [ ] better structured logs for provider, billing, and vision flows
- [ ] clearer usage / failure diagnostics in admin
- [ ] better worker-backed processing story for long-running document/vision jobs
- [ ] add admin notifications/tasks when a provider submits verification
- [ ] add better diagnostics around Google fallback provider searches so we can distinguish API-empty, API-blocked, query-mismatch, and auth/key-scope failures
- [ ] add public funnel analytics and conversion reporting views in admin

---

## Priority 4: Engineering Hardening

### 5.12 Automated testing

- [ ] auth flows
- [ ] pricing flows
- [ ] media upload and vision job flows
- [ ] report generation
- [ ] provider onboarding and billing
- [ ] admin auth and provider lead actions
- [ ] public seller landing preview and email gate flows
- [ ] attribution persistence from landing to dashboard

### 5.13 Cleanup and consistency

- [ ] formalize shared billing env/docs for Merxus + HomeAdvisor
- [ ] tighten outdated docs that still describe older assumptions
- [ ] add more explicit deployment/runbook notes for provider rollout

---

## 6. Recommended Next Implementation Order

If work resumes tomorrow, the most sensible order is:

1. Harden the public conversion funnel with attribution persistence and campaign naming standards
2. Complete real provider signup -> verification -> billing -> portal end-to-end validation
3. Stabilize Google fallback provider discovery, diagnostics, and in-app provider map presentation
4. Refine the seller/agent property-cap model into a true per-property billing strategy where needed
5. Extend the guided workflow system into auth / onboarding so the whole journey starts coached
6. Refine vision quality on the three Replicate presets
7. Polish report/brochure premium output quality
8. Add provider account recovery / linking tools
9. Start real automated tests around the new flows

---

## 7. Suggested “Tomorrow” Starting Point

If the goal is immediate product value with low rework risk, start here:

### Option A: Conversion hardening

- lock down public funnel attribution
- make IG/FB campaign naming and copy routing production-safe
- add funnel analytics / reporting
- tighten seller preview -> email gate -> signup -> dashboard conversion handoff

### Option B: Marketplace hardening

- validate live provider billing thoroughly
- tighten provider coverage filtering
- stabilize structured Google fallback behavior and diagnostics
- improve the in-app provider map / provider details experience

### Option C: Premium output quality

- refine vision preset quality
- make brochure/report output feel more premium

### Option D: Trust and readiness

- add provider account recovery / linking
- add tests around auth, provider billing, and provider portal flows

Recommended choice:

Start with **Option A**, then move into **Option B**.

That gives the product a stronger traffic-to-conversion engine before spending more time on polish.

---

## 8. Notes For Restart

- Backend, seller web, and admin web are all active work surfaces now
- Admin providers page was recently converted to tabs
- The shared admin table/metric boundary issue has already been fixed
- Provider onboarding now creates real provider auth accounts and requires email verification before billing continuation
- Provider verification now supports self-reported trust fields, document upload, seller-facing trust display, and admin verification review
- Property workspace now has a real role-aware guided workflow rail powered by a backend workflow endpoint
- Provider discovery now supports internal providers, unavailable matching internal providers, shortlist saving, and an in-app provider map
- Structured Google fallback is still under active refinement and does not yet mirror consumer Google Maps results reliably
- Seller pricing flow now includes a persisted chosen list price that should carry into documents after regeneration
- SMS marketplace logic exists in code, but rollout is paused intentionally
- Public seller, agent, and provider landing pages now exist, with seller preview/email-gate flow and campaign-aware copy variants

---

## 8.1 Current Known Issues And Potential Risks

### Web app

- [ ] Structured Google fallback provider search can still return zero results even when consumer Google Maps clearly shows local matches
- [ ] External Google Maps search still controls its own zoom behavior, so the external map page remains inconsistent; the in-app provider map is the preferred controlled experience
- [ ] In-app provider map is finally functional again, but it still needs more polished bounds fitting, legend clarity, and denser-market marker handling
- [ ] Property workspace responsive behavior is much improved, but Report, Brochure, Checklist, and provider layouts can still feel cramped on mid-width desktop viewports
- [ ] Provider discovery quality is very sensitive to provider data hygiene: wrong category, non-active status, invalid ZIP/state, or incomplete radius coverage can make matching feel “broken”
- [ ] Generated reports and flyers may need regeneration after pricing, image, or chosen-price changes; this is correct behavior, but it can still surprise users if we do not make it explicit
- [ ] Google-backed provider content shown in-app should continue to be treated as fallback discovery, not durable exported directory content, unless first saved into a Workside-managed shortlist
- [ ] Public landing pages are live, but attribution reporting, experiment support, and production-grade analytics still need to be completed

### Mobile app

- [ ] Camera capture/save flow is much safer now, but it still needs broader end-to-end UX validation around multiple shots, interruptions, and resumed sessions
- [ ] Login / OTP and keyboard-safe layout have improved, but they still need a full App Store-style polish pass across device sizes
- [ ] Vision progress feedback is much better, but more end-to-end loading / error feedback could still help during slower backend jobs
- [ ] React Query now powers the main mobile workspace flow, but offline behavior, reconnect behavior, and background refresh expectations still need more testing
- [ ] Media management on mobile is still better at capture than at deeper organization/review compared with the web workspace

### Backend / platform risks

- [ ] Google geocoding and Places-based provider matching rely on external APIs, quotas, and category/query behavior that can differ from consumer Google Maps
- [ ] Provider duplication, category drift, and self-reported trust data can create misleading marketplace output unless admin review stays tight
- [ ] Provider SMS remains intentionally paused, so lead outreach is email-first for now and should be treated as an interim operational mode
- [ ] The codebase now has real breadth across seller, provider, admin, billing, and AI flows, so missing automated tests remain a material reliability risk
- [ ] Public funnel events and lead captures exist, but there is not yet a robust attribution/reporting layer to prove paid campaign performance end to end

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
