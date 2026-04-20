# Live System

Last updated: 2026-04-19
Status: active source of truth

## Purpose

This document is the canonical description of the live Workside Home Advisor system.
Use it as the default reference when deciding what the product is, how the codebase is organized, and which workflows are currently considered in-scope.

If another document conflicts with this one, prefer this document unless a newer phase-specific implementation note clearly supersedes part of it.

## Product Definition

Workside Home Advisor is a seller-prep and listing-readiness platform.
The product helps a homeowner or advisor move from property intake to pricing, photo readiness, seller guidance, provider coordination, and report/export generation.

The core product promise is:

- help the seller understand what to do next
- improve the presentation of the property
- support pricing and readiness decisions
- generate trustworthy outputs that are useful in real listing workflows

The platform is not currently centered on speculative image manipulation as the main value proposition.
Vision exists to support listing readiness, first impressions, and safe presentation improvements.

## Canonical Seller Workflow

The intended end-to-end workflow is:

1. Onboarding
2. Pricing
3. Photos
4. Checklist
5. Providers
6. Reports

This sequence is the current backbone for future UI refactors, CTA logic, and entitlement decisions.
If a feature does not clearly support one of these stages, it should be treated as secondary until proven otherwise.

## Active Runtime Topology

### Applications

- `apps/web`
  Seller-facing web application built with Next.js and JavaScript.
  This is currently the richest surface for pricing, property workspace, media review, billing, and reports.

- `apps/mobile`
  Expo-managed React Native application for seller workflows in the field.
  It supports auth, property selection, photo capture/import, gallery review, and selected workflow sections.

- `apps/api`
  Fastify-based API and the current operational backend.
  It owns auth, properties, pricing, billing hooks, media, reports, and most domain logic that is live today.

- `apps/admin-web`
  Internal admin surface for operational and support workflows.

### Shared Packages

- `packages/branding`
- `packages/config`
- `packages/prompts`
- `packages/types`
- `packages/utils`
- `packages/validation`

These packages provide shared constants, helpers, prompt logic, and validation across apps.

### Services

- `services/ai-orchestrator`
- `services/document-worker`
- `services/market-data-worker`
- `services/media-worker`
- `services/notification-worker`

Important current-state note:
the repository is organized as if heavier work will move into dedicated workers, but much of the live production behavior still runs through `apps/api`.
Phase 2 of the current execution plan is expected to formalize the async job model and move long-running work off the direct API request path.

## Active Architecture Choices

The current live stack is:

- MongoDB Atlas as the primary database
- Fastify for the main API
- Next.js web app in JavaScript
- Expo-managed React Native mobile app
- JWT-based session handling after email/password plus OTP verification
- RentCast as the primary market-data provider
- OpenAI APIs for text and image workflows
- Stripe for subscriptions and billing events
- SendGrid for email delivery
- Twilio for marketplace/provider SMS flows
- Google Cloud Run for backend deployment
- Google Cloud Storage for production media storage

## Data And Storage Reality

- MongoDB is the live persistence model, not Prisma/Postgres.
- Media storage is provider-based:
  - local disk for simple local development
  - Google Cloud Storage for production-ready deployments
- The API is still the practical center of the system.

## Async Job Model

The live system now has a shared `jobs` collection for long-running work that should not block the main request path.

Canonical job states:

- `queued`
- `running`
- `reconnecting`
- `failed`
- `completed`
- `cancelled`

Current Phase 2 usage:

- vision enhancement requests queue into the shared job system and expose polling/cancel behavior through the existing vision job surface
- flyer generation can return a queued background job for fresh work while still returning cached output immediately
- seller report generation can return a queued background job for fresh work while still returning cached output immediately

This is an important transition step, not the final architecture.
The codebase still needs deeper worker separation and stronger recovery guarantees, but long-running vision and report generation are no longer required to complete fully inside the original API request.

## Current Product Priorities

The current product direction favors:

- reliable pricing and property guidance
- strong first-impression photo improvement
- safe listing-ready visual enhancement
- seller workflow continuity across web and mobile
- provider coordination and marketplace support
- reports and exports as durable assets
- billing and entitlement clarity
- operational visibility and debuggability

The system should avoid spending disproportionate time on fragile image edits that do not clearly improve marketplace value.

## Vision Scope

Vision is now classified into three tiers:

- Core
  Fast, trustworthy, listing-oriented improvements that should be easy to explain and safe to show by default.

- Advanced
  More opinionated concept workflows that can be useful, but should not be treated as the main product promise.

- Experimental
  Diagnostic or high-risk workflows that may still help development, but should not be surfaced as dependable default behavior.

The detailed tier definition lives in [VISION_TIERS.md](./VISION_TIERS.md).

## Documentation Canon

Start with these documents:

- this file: [LIVE_SYSTEM.md](./LIVE_SYSTEM.md)
- vision scope and release posture: [VISION_TIERS.md](./VISION_TIERS.md)
- deployment setup: [deployment/cloud-run-backend.md](./deployment/cloud-run-backend.md)
- production media storage: [deployment/google-cloud-storage-media.md](./deployment/google-cloud-storage-media.md)
- current architecture summary: [architecture/system-overview.md](./architecture/system-overview.md)
- broad codebase and roadmap analysis: [../project-analysis.md](../project-analysis.md)
- current execution spec: [workside_codex_v2_spec.md](./workside_codex_v2_spec.md)

## Archived Foundation Docs

The original numbered foundation docs captured an earlier scaffold direction that assumed Prisma/Postgres and a different baseline.
They are preserved for history, but they are no longer the canonical source for implementation decisions.

Archived location:

- [archive/legacy-foundation](./archive/legacy-foundation)

## Decision Rules

When deciding whether a change fits the live system:

1. Prefer seller workflow clarity over speculative breadth.
2. Prefer listing-ready trust over flashy edits.
3. Prefer durable architecture over one-off patches.
4. Prefer shared workflow logic across web and mobile.
5. Prefer visible operational diagnostics over silent failure states.

## Near-Term Execution Alignment

The current execution plan is aligned to this sequence:

1. Truth reset and doc cleanup
2. Async job system
3. Mega-file decomposition
4. Shared seller workflow backbone
5. Pricing explainability
6. Billing and entitlements
7. Vision refocus
8. Reports as assets
9. Observability
10. Testing and regression coverage

This document should be updated whenever one of those phases materially changes the live system.
