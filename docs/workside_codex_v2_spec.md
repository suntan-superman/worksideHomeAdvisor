# WORKSIDE HOME ADVISOR — CODEX V2 SPEC

## EXECUTION PLAN (ExecPlan)

### Objective
Transform the current platform into a coherent, scalable, seller-prep and listing-readiness system.

### Success Criteria
- Unified seller workflow
- Stable async job system
- Modular web/mobile architecture
- Reliable billing + entitlements
- Production-grade observability

---

## SYSTEM DESIGN

### 1. Async Job System
States:
- queued
- running
- reconnecting
- failed
- completed
- cancelled

Collections:
- jobs
- job_logs

---

### 2. Workflow Engine
Canonical Flow:
onboarding → pricing → photos → checklist → providers → reports

Core:
- step registry
- dependency graph
- next-action resolver

---

### 3. Module Decomposition

Web تقسيم:
- pricing/
- photos/
- vision/
- checklist/
- providers/
- reports/

Mobile:
- dashboard/
- property/
- checklist/
- camera/
- gallery/

---

### 4. Entitlement System

Single resolver:
- plan
- usage
- overrides

---

## TASK BREAKDOWN

### Phase 1 — Foundation
- create docs/LIVE_SYSTEM.md
- archive stale docs
- define vision tiers

### Phase 2 — Jobs
- implement job schema
- move media/report jobs off API
- add polling endpoints

### Phase 3 — Refactor
- split PropertyWorkspaceClient
- split RootScreen

### Phase 4 — Workflow
- implement workflow engine
- unify CTA across app

### Phase 5 — Pricing
- add comp scoring
- confidence display

### Phase 6 — Billing
- normalize Stripe lifecycle
- implement entitlement resolver

### Phase 7 — Vision Scope
- restrict defaults to listing-ready outputs

### Phase 8 — Reports
- versioning
- regeneration tracking

### Phase 9 — Observability
- correlation IDs
- job diagnostics

### Phase 10 — Testing
- auth
- property
- pricing
- media

---

## VALIDATION

Must pass:
- No regression in auth
- Property flow intact
- Media jobs complete successfully
- Reports generate consistently

---

## CODEX INSTRUCTIONS

- Execute phase-by-phase
- Do not skip validation
- Preserve existing behavior during refactors
- Commit in small increments
- Update docs alongside code
