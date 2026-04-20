# Workside Home Advisor — Codex Execution Plan

## Objective
Stabilize and clarify the existing platform into a coherent seller-prep and listing-readiness system.

---

## Phase 1 — Truth Reset
- Create LIVE_SYSTEM.md
- Archive stale docs
- Classify vision: core / advanced / experimental

---

## Phase 2 — Async Job System
- Introduce canonical job model
- Move heavy tasks (vision, reports) off API request path
- Add job states: queued, running, failed, completed, cancelled

---

## Phase 3 — Decompose Mega Files
- Split PropertyWorkspaceClient.js
- Split RootScreen.js
- Extract domain modules and hooks

---

## Phase 4 — Seller Workflow Backbone
Flow:
onboarding → pricing → photos → checklist → providers → reports

- Shared workflow engine
- Unified CTA logic

---

## Phase 5 — Pricing Explainability
- Add comp scoring
- Confidence bands
- Admin debug metadata

---

## Phase 6 — Billing + Entitlements
- Normalize Stripe lifecycle
- Single entitlement resolver

---

## Phase 7 — Vision Refocus
Core:
- declutter
- lighting
- listing-ready

Advanced:
- wall/floor edits

---

## Phase 8 — Reports as Assets
- Versioning
- Regeneration tracking
- Export improvements

---

## Phase 9 — Observability
- Correlation IDs
- Job diagnostics
- Admin debugging tools

---

## Phase 10 — Testing
- Auth
- Property creation
- Pricing
- Media flows

---

## Codex Instructions
- Preserve behavior during refactors
- Work in small commits
- Update docs continuously
