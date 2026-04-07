# Workside Progress Update

Last updated: 2026-04-07

This document is the new working checkpoint for the HomeAdvisor / Workside codebase.

It updates the earlier priorities document with:

- what is now newly implemented
- what is currently being deployed and validated
- what remains from the prior task list
- the recommended order for the next execution passes

---

## 1. Executive Snapshot

The platform is now meaningfully stronger in three important areas:

- seller account maturity
- media / vision workflow flexibility
- marketing-output readiness

Since the previous checkpoint, the codebase gained a real forgot-password flow, seller account contact settings, phone + SMS preference capture, source-aware media imports, freeform AI enhancement requests, and a persisted social ad pack generator.

The product now has stronger continuity between web, mobile, and backend for day-to-day seller use. The immediate focus is no longer basic feature existence. The immediate focus is deployment validation, workflow hardening, premium output quality, attribution/reporting, provider operational maturity, and broader automated coverage.

---

## 2. Newly Implemented Since The Previous Update

### 2.1 Auth and account system

- [x] forgot-password OTP request flow added
- [x] forgot-password OTP verification flow added
- [x] reset-password completion flow added
- [x] password-reset token persistence added in backend
- [x] seller `GET /auth/me` and `PATCH /auth/profile` account endpoints added
- [x] seller profile editing now supports first name, last name, mobile phone, and SMS opt-in
- [x] signup now captures seller mobile phone and SMS consent state
- [x] seller auth/session payload now returns mobile phone and SMS preference data

### 2.2 Seller SMS groundwork

- [x] seller SMS logging model added
- [x] registration confirmation SMS support added in code
- [x] seller provider-pending SMS support added in code
- [x] seller provider-match SMS support added in code
- [~] marketplace SMS rollout is still intentionally paused pending the dedicated production number / approval path

### 2.3 Media and vision workflow

- [x] media records now persist upload source metadata
- [x] media records now persist seller notes
- [x] media records now track uploading user identity
- [x] web photo import now supports direct file upload into a property workspace
- [x] mobile photo save now labels camera vs library origin
- [x] source-aware media creation is now supported across backend, web, and mobile
- [x] freeform AI enhancement requests added alongside preset enhancement actions
- [x] enhancement jobs now persist freeform instructions, mode, and normalized plan metadata
- [x] `/api/v1/photos/enhance` alias route added for cleaner enhancement submission

### 2.4 Marketing output expansion

- [x] persisted social ad pack model added
- [x] backend social-pack generation endpoint added
- [x] latest social-pack retrieval endpoint added
- [x] web property workspace now supports social-pack generation and preview
- [x] seller property marketing output now includes ad-oriented copy variants in addition to brochure/report flows

### 2.5 Web application progress

- [x] web auth page now includes end-to-end forgot-password flow
- [x] web signup now includes mobile phone and SMS opt-in capture
- [x] dashboard now includes seller contact/account settings
- [x] property workspace now supports direct web photo import with source / room / notes metadata
- [x] property workspace now supports freeform image enhancement requests
- [x] property workspace now supports social-pack generation and preview

### 2.6 Mobile application progress

- [x] mobile auth flow now includes forgot-password request / verify / reset states
- [x] mobile app now includes seller account settings editing
- [x] mobile account settings now support mobile phone and SMS preference updates
- [x] mobile vision flow now supports custom freeform enhancement input
- [x] mobile photo import flow now persists camera vs library source metadata

### 2.7 Verification completed on this pass

- [x] API test suite passed
- [x] web test suite passed
- [x] web production build passed
- [x] API app import/load check passed
- [ ] full interactive runtime validation of the rebuilt mobile app is still pending during active deployment/testing

---

## 3. What This Means For Current Product Readiness

The codebase is now stronger in several practical ways:

- sellers can recover account access without manual intervention
- seller contact details and SMS preferences are now real account data instead of missing profile surface area
- media captured on mobile and media imported on web now carry better provenance and context
- AI enhancement can now accept natural-language requests, which is a better fit for iterative seller workflows
- marketing output is no longer limited to flyer/report concepts; social ad copy generation now exists as a real backend-backed asset

This is a real step toward a more complete seller operating system rather than just a collection of individual tools.

---

## 4. Remaining Work Carried Forward From The Previous Task List

The items below remain active and should continue moving forward. They are grouped by practical execution priority rather than by original write-up order alone.

### Priority 0: Deployment Validation And Launch-Critical Hardening

- [ ] complete live deployment validation for the latest web build
- [ ] complete live deployment validation for the current mobile build on Android
- [ ] complete live deployment validation for the current mobile build on iOS
- [ ] run end-to-end manual checks for forgot-password flows on web and mobile
- [ ] validate seller profile editing and SMS preference persistence end to end
- [ ] validate web photo import, source metadata, and notes persistence end to end
- [ ] validate freeform enhancement requests against real backend image jobs
- [ ] validate social-pack generation and export behavior against live property data
- [ ] confirm no regression in OTP signup/login flows after the auth changes

### Priority 1: Conversion Funnel Hardening And Attribution

- [ ] add durable attribution persistence from landing -> auth -> dashboard -> property
- [ ] add a canonical Meta / IG / FB campaign naming convention and parser
- [ ] add stronger seller funnel event coverage and funnel-drop reporting
- [ ] add agent/provider lead capture endpoints and admin visibility similar to seller funnel capture
- [ ] add CRM/export-ready lead records for public funnel submissions
- [ ] add safer analytics around preview completion, email gate completion, signup completion, and subscription conversion
- [ ] add experiment hooks for headline / CTA / value-card testing
- [ ] add real visual proof assets and stronger production screenshots to the public pages
- [ ] add the right post-preview subscription / plan upsell treatment for seller traffic

### Priority 2: Provider Account, Billing, And Marketplace Hardening

- [ ] add provider account recovery / reset flow
- [ ] add admin tooling to link older seeded providers to real provider accounts
- [ ] add a cleaner “already have a provider account?” path inside onboarding
- [ ] tighten provider-only account management boundaries further
- [ ] add provider email change / re-verification flow
- [ ] complete live end-to-end provider signup -> verify -> billing -> portal validation with Stripe
- [ ] confirm provider subscription webhook handling in production
- [ ] verify featured-placement behavior against provider Stripe plans
- [ ] improve structured Google fallback reliability and diagnostics
- [ ] improve in-app provider map presentation, marker detail, and viewport fitting
- [ ] give stronger precedence to registered Workside providers over fallback results
- [ ] add better uncovered-area messaging when no internal providers exist

### Priority 3: Seller / Agent Billing And Workflow Expansion

- [ ] support per-property billing / subscription visibility where needed
- [ ] extend the guided workflow system into auth / onboarding before first property creation
- [ ] add stronger blocked-state logic and dependency explanations for workflow steps
- [ ] connect workflow steps to richer property-edit screens where dashboard fallback still appears
- [ ] decide where optional workflow steps should be skippable vs auto-resolved

### Priority 4: Premium Output Quality

- [ ] improve brochure layout and visual finish
- [ ] improve report layout and PDF polish
- [ ] add a comprehensive property review PDF with a full-page comp map and richer gathered context
- [ ] persist brochure/report draft state more explicitly per property
- [ ] add stronger seller-facing customization controls for output tone and imagery
- [ ] store final PDFs with durable download URLs
- [ ] decide whether the provider reference sheet should become an appendix to the larger property review PDF
- [ ] improve social-pack formatting/export polish now that the generation foundation exists

### Priority 5: Media And Vision Maturity

- [ ] add explicit media ordering
- [ ] add first-class brochure/report inclusion state on base media assets
- [ ] refine listing-photo candidate review and ordering UX
- [ ] improve cross-device media management polish
- [ ] tune prompts and mask regions by preset and room type
- [ ] improve artifact rejection / low-confidence filtering
- [ ] better differentiate `declutter_light`, `declutter_medium`, and `remove_furniture`
- [ ] make selected best variants more obvious in seller outputs
- [ ] decide how freeform enhancement requests should interact with preset ranking and preferred-variant selection

### Priority 6: Usage, Diagnostics, And Trust

- [ ] enforce plan-based vision quotas
- [ ] expose vision usage summary in UI/admin
- [ ] add better upgrade-required responses for premium vision usage
- [ ] improve structured logs for provider, billing, vision, and funnel flows
- [ ] add clearer admin diagnostics for failures and long-running jobs
- [ ] improve worker-backed processing for long-running document and vision tasks
- [ ] add admin notifications/tasks when providers submit verification
- [ ] add public funnel analytics and conversion reporting views in admin
- [ ] formalize shared billing env/docs for Merxus + HomeAdvisor
- [ ] tighten outdated docs that still describe older assumptions
- [ ] add more explicit deployment and rollout runbooks

### Priority 7: Automated Testing Expansion

- [ ] add focused automated coverage for forgot-password flows
- [ ] add automated coverage for seller profile update flows
- [ ] add automated coverage for media upload/source metadata flows
- [ ] add automated coverage for freeform enhancement job submission
- [ ] add automated coverage for social-pack generation endpoints
- [ ] add automated coverage for pricing flows
- [ ] add automated coverage for report generation
- [ ] add automated coverage for provider onboarding and billing
- [ ] add automated coverage for admin auth and provider lead actions
- [ ] add automated coverage for public seller landing preview and email-gate flows
- [ ] add automated coverage for attribution persistence from landing to dashboard

---

## 5. Recommended Next Implementation Order

If work continues immediately after deployment/testing, the most sensible order is:

1. finish live validation of the newly added auth, profile, media-import, and social-pack flows
2. harden public funnel attribution and reporting so traffic can be measured confidently
3. complete provider account recovery, linking, and real billing-path validation
4. improve marketplace fallback quality, diagnostics, and map presentation
5. raise premium output quality across brochure, report, and social-pack exports
6. deepen media organization, listing-photo selection, and vision quality controls
7. expand automated coverage around the newer launch-critical workflows

---

## 6. Suggested Immediate Starting Point

The best next execution pass is:

### Pass A: Finish validation on what was just added

- verify web and mobile forgot-password flows end to end
- verify seller contact settings persistence
- verify media source/notes flows from both web and mobile
- verify social-pack generation with real property data

### Pass B: Move directly into conversion hardening

- persist attribution cleanly from landing through account creation and property creation
- add campaign parsing standards
- add stronger funnel event reporting and admin visibility

### Pass C: Then move into provider and billing hardening

- provider account recovery
- provider account linking/admin tools
- real Stripe lifecycle validation

Recommended choice:

Start with **Pass A**, then **Pass B**, then **Pass C**.

That preserves momentum, reduces regression risk, and keeps the product moving toward production-safe acquisition and operational readiness.

---

## 7. Notes For Restart

- Web and API verification passed on this implementation pass
- Mobile still needs broader runtime/device validation during current deployment testing
- Seller SMS support is now deeper in code, but production rollout remains intentionally paused
- Freeform enhancement support now exists, but quality tuning and UX clarity still need follow-through
- Social-pack generation now exists as a real saved asset, which creates a good bridge into broader seller marketing-output work
- The remaining roadmap is still mostly refinement, validation, premium polish, attribution, diagnostics, and operational maturity rather than foundational product invention
