# Workside Next Implementation Checklist

Last updated: 2026-04-07

This is the active execution checklist for the next implementation passes.

The intent is to keep the roadmap actionable while web/mobile deployment testing continues.

---

## 1. Current Execution Order

### Pass 1: Launch-flow validation and attribution hardening

- [ ] validate web forgot-password request -> verify -> reset end to end
- [ ] validate mobile forgot-password request -> verify -> reset end to end
- [ ] validate seller contact settings save/reload behavior end to end
- [ ] validate web photo import source + notes persistence
- [ ] validate mobile photo source persistence
- [ ] validate freeform enhancement requests against live backend jobs
- [ ] validate social-pack generation against live property data
- [x] preserve attribution identity from landing -> auth -> dashboard -> property
- [x] improve attribution reporting visibility in admin funnel views

### Pass 2: Public funnel hardening

- [ ] persist attribution cleanly for seller flows across refreshes and resumed sessions
- [ ] add campaign naming/parser rules for Meta / IG / FB traffic
- [ ] add stronger funnel-drop and completion event coverage
- [ ] add CRM/export-ready lead capture output
- [ ] add agent/provider capture flows comparable to seller capture

### Pass 3: Provider account and billing hardening

- [x] add provider account recovery / reset flow
- [x] add a cleaner “already have a provider account?” path inside onboarding
- [x] add provider account-linking tools for seeded providers
- [x] add provider billing diagnostics and manual sync support in portal/admin
- [x] add Stripe webhook audit logging and admin billing observability
- [x] add admin provider-level billing resync and latest-webhook visibility
- [x] harden Stripe webhook/session status handling for expired and async/failure states
- [ ] validate provider signup -> verify -> billing -> portal end to end
- [ ] confirm production webhook subscription-state handling

### Pass 4: Marketplace quality

- [x] improve Google fallback diagnostics
- [x] improve in-app provider map presentation and dense-market handling
- [x] make Workside provider precedence clearer in mixed result sets
- [x] improve no-coverage messaging when internal providers are unavailable

### Pass 5: Premium output quality

- [ ] improve brochure layout and PDF polish
- [ ] improve report layout and export finish
- [ ] improve social-pack presentation/export polish
- [ ] plan the larger property review PDF

### Pass 6: Media, vision, and listing-readiness maturity

- [ ] add explicit media ordering
- [ ] add brochure/report inclusion state on base media assets
- [ ] improve listing-photo candidate selection and ordering UX
- [ ] improve preset tuning and low-confidence filtering
- [ ] define how freeform requests affect preferred-variant selection

### Pass 7: Automated coverage expansion

- [ ] add focused coverage for forgot-password flows
- [ ] add coverage for seller profile update flows
- [ ] add coverage for attribution persistence
- [ ] add coverage for media source/notes flows
- [ ] add coverage for freeform enhancement requests
- [ ] add coverage for social-pack generation
- [x] add focused coverage for provider billing state transitions

### Pass 8: Property lifecycle controls

- [x] add clearer archive / restore management across dashboard and workspace
- [x] add permanent property delete flow with explicit confirmation and ownership safeguards
- [x] define how property deletion affects generated outputs, saved providers, and downstream audit history

---

## 2. In Progress Right Now

- [x] create a concrete next-step checklist
- [x] identify the attribution persistence gap in the current funnel
- [x] finish the browser-side attribution draft persistence helper
- [x] carry anonymous attribution identity through auth normalization
- [x] use stored signup attribution as a fallback during property creation
- [x] verify the updated attribution flow with targeted tests/build checks

---

## 3. Recommended Immediate Follow-Up After This Pass

1. Run the live manual validation items in Pass 1
2. Use the new provider billing diagnostics to validate signup -> verify -> billing -> portal end to end
3. Confirm production webhook subscription-state handling against real Stripe events
