# Project Summary

## What The Product Does

Workside Home Seller Assistant is a multi-surface product for helping a homeowner, agent, or service provider move a home from "not ready" to "market ready." The implemented platform already supports:

- seller and agent account creation with email/password plus email OTP verification
- property workspace creation and property portfolio management
- pricing analysis using RentCast comps plus AI-generated narrative guidance
- photo capture, upload, analysis, and AI enhancement workflows
- seller checklist and guided workflow progression
- flyer, report, and social-pack generation
- billing and entitlement checks through Stripe
- provider discovery, provider lead routing, and provider portal workflows
- admin visibility into users, properties, funnel activity, usage, billing, providers, and media variants

The strongest current product shape is not "general real estate software." It is a guided seller-prep and listing-readiness platform with three major value streams:

1. Pricing confidence
2. Listing-prep workflow
3. Marketing/export generation

## Current Product Reality Vs. Planning Docs

This repository contains a large amount of documentation, but it is mixed in maturity:

- Some docs describe the real implemented system.
- Some docs describe roadmap intent.
- Some older docs still assume Prisma, PostgreSQL, and TypeScript-heavy service boundaries that are no longer the live implementation.
- A large cluster of April 2026 docs focuses on experimental wall/vision enhancement behavior, which reflects active iteration but also shows product drift away from the core marketplace value proposition.

The live codebase is best understood as:

- a working JavaScript monorepo
- backed by Fastify + MongoDB
- with a real seller web app, real mobile app, real admin app, and real deployment paths
- but with uneven maturity across modules

## Primary User Groups

- Sellers: the current primary product experience
- Agents/Realtors: partially implemented, especially in workflow language, billing plans, and dashboard positioning
- Providers: increasingly real, with onboarding, billing, verification, lead routing, SMS, and admin moderation surfaces
- Admins: internal operations users with a separate admin web app and protected API routes

## Overall Assessment

The product is beyond prototype stage. It already has:

- real authentication
- real data persistence
- real pricing computation
- real AI integrations
- real payments
- real provider flows
- real deployment docs and infrastructure assumptions

The biggest problem is not lack of features. The biggest problem is platform coherence:

- too many important flows are concentrated in very large client files
- some supporting services are placeholders rather than production services
- job execution, observability, and cancellation are not mature enough for heavy AI/media workloads
- roadmap docs are ahead of implementation truth and can mislead prioritization

# Architecture Overview

## Monorepo Structure

The repository is a workspace monorepo driven from the root `package.json`.

### Apps

- `apps/web`: seller/agent-facing Next.js web application
- `apps/mobile`: Expo/React Native mobile application
- `apps/api`: Fastify API and primary backend
- `apps/admin-web`: Next.js admin console

### Shared Packages

- `packages/branding`: shared brand constants and product identity
- `packages/config`: feature flags, routes, and product-level configuration
- `packages/prompts`: prompt builders for pricing, improvements, marketing, timing, and document workflows
- `packages/types`: shared enums and domain constants
- `packages/utils`: formatting, attribution, phone normalization, and utility helpers
- `packages/validation`: Zod schemas for auth, property creation, AI requests, and media analysis

### Services

- `services/ai-orchestrator`
- `services/document-worker`
- `services/market-data-worker`
- `services/media-worker`
- `services/notification-worker`

These services exist structurally, but today they are mostly placeholders or simplified shells. The actual production logic still largely lives inside `apps/api`.

## Runtime Architecture

### Frontend Surfaces

#### Web App

The web app is the richest product surface today. It contains:

- public landing and role-based funnels
- auth and onboarding
- dashboard with billing, workflow, and property portfolio state
- large property workspace for pricing, photos, brochure, report, checklist, and provider flows
- provider landing, join flow, and provider portal entry

The property workspace is implemented in a single very large client component:

- `apps/web/app/properties/[propertyId]/PropertyWorkspaceClient.js` at about 8,430 lines

That file currently acts as a product shell, workflow engine consumer, pricing UI, media UI, vision UI, provider UI, export UI, and quick-guide system all at once.

#### Mobile App

The mobile app is Expo-managed and focused on:

- auth
- property selection
- dashboard snapshot
- checklist updates
- photo capture/import
- media gallery and variant selection
- vision enhancements
- profile updates

Its primary screen is also concentrated in one large file:

- `apps/mobile/src/screens/RootScreen.js` at about 3,968 lines

This makes the mobile product capable, but fragile and hard to maintain.

#### Admin Web

The admin app is a separate Next.js surface with pages for:

- overview
- billing
- login
- properties
- providers
- usage
- users
- workers

It reads from protected admin endpoints and appears to be a real operational console, not just a stub.

### Backend API

The API is a Fastify application registered in `apps/api/src/app.js` and booted in `apps/api/src/server.js`.

Core API route groups:

- `/api/v1/auth`
- `/api/v1/public`
- `/api/v1/admin`
- `/api/v1/billing`
- `/api/v1/properties`
- `/api/v1/media`
- `/api/v1/marketplace/twilio/*`
- `/api/v1/providers`
- `/api/v1/tasks`
- `/api/v1/workflow`
- `/api/v1/dashboard`
- `/api/v1/reports`
- `/api/v1/ai`

### Backend Module Responsibilities

#### Auth

- user signup/login
- email verification OTP
- forgot-password OTP
- profile update
- account delete
- rate-limiting hooks
- JWT session verification

#### Properties

- property CRUD
- archive/restore/delete
- selected price decision
- full workspace snapshot assembly
- attribution carry-through from public funnel to owned property

#### Pricing

- pricing analysis requests
- cached-result return rules
- entitlement enforcement
- property-specific run limits
- latest pricing retrieval

#### Dashboard + Workflow

- aggregated property dashboard payload
- guided workflow state calculation
- phase progression and next-step recommendations

#### Media / Vision

- photo analysis
- media storage and retrieval
- variant creation and selection
- AI enhancement jobs
- job polling and cancellation
- preset catalog
- temp file serving
- variant pruning and save-to-photos flows

This is one of the most complex areas in the codebase and also one of the most operationally fragile.

#### Tasks / Checklist

- property checklist read/create/update
- progress scoring and readiness contribution

#### Documents / Exports

- flyer generation
- report generation
- PDF export
- social-pack generation
- provider reference sheet export

#### Providers / Marketplace

- provider discovery
- internal provider ranking
- Google Maps / Places fallback sourcing
- provider leads
- saved providers and provider references
- provider signup and portal sessioning
- provider verification document upload
- provider billing sync
- provider dispatch response handling

#### Billing / Entitlements

- plan catalog
- checkout creation
- checkout sync
- webhook handling
- usage gating
- monthly property limits
- pricing/flyer/report feature access

#### Public Funnel

- address-first seller preview
- email capture
- funnel event tracking
- continue-signup handoff into auth

#### Admin

- admin session enforcement
- overview metrics
- billing snapshot
- usage snapshot
- pricing-query policy editing
- worker snapshot
- funnel overview
- media variant cleanup
- provider moderation and lead operations

## Data Layer

### Primary Database

The live application uses MongoDB through Mongoose. This is the actual source of truth, even though several older docs still describe Prisma/Postgres.

### Key Collections / Schemas

#### Users

- email, password hash, names
- role
- demo and billing bypass flags
- Stripe customer id
- email verification and OTP state
- mobile phone and SMS opt-in
- signup attribution

#### Properties

- owner
- address and core home metadata
- selected list price and source
- archive status
- readiness score
- seller profile fields
- attribution context

#### Media Assets

- property linkage
- room label
- original vs generated asset type
- generation stage
- storage metadata
- listing candidate flags
- photo analysis snapshot

#### Media Variants

- generated vision results and lifecycle state
- usage flags for brochure/report
- source job linkage

#### Image Jobs

- enhancement job orchestration state
- cancelable job records

#### Pricing Analyses

- recommended price ranges
- comp snapshots
- confidence and narrative fields

#### Checklists

- property checklist
- item status, priority, readiness impact

#### Billing

- subscriptions
- webhook events

#### Providers

- business profile
- category
- verification state
- lead routing
- portal access
- subscription metadata

#### Provider Marketplace Objects

- lead requests
- lead dispatches
- provider responses
- saved providers
- provider references
- provider analytics
- provider SMS logs

#### Public Funnel Events

- anonymous attribution events
- capture and conversion continuity

#### Usage / Safeguards

- usage tracking
- rate-limit events
- pricing query policy
- pricing property usage
- analysis locks

#### Documents

- flyers
- reports
- social packs

## External Dependencies

### Implemented In Code

- `MongoDB Atlas`: primary persistent store
- `Stripe`: billing, checkout, webhook processing, entitlement model
- `SendGrid` / `SMTP` / console email: auth email and provider/admin email flows
- `Twilio`: provider lead SMS and inbound/status webhooks
- `RentCast`: pricing and comparable sales
- `OpenAI Responses API`: structured JSON generation and photo/variant analysis
- `Replicate`: media/vision inpainting pipeline
- `Google Maps / Geocoding / Places / Static Maps`: provider discovery fallback, map images, report maps
- `Google Cloud Storage`: production media/document storage path
- `Puppeteer` and `pdf-lib`: export generation

### Not Detected In Live Code

- Slack integration was not found in the current codebase

## Configuration And Environment

The environment model is extensive and production-oriented. The `.env.example` and `apps/api/src/config/env.js` together show configuration for:

- application URLs
- MongoDB
- JWT and bcrypt
- email providers
- Twilio
- Stripe
- OpenAI
- Replicate
- RentCast
- Google Maps
- GCS storage
- media lifecycle cleanup

This is a strength because the system already thinks in deployment environments, but it is also a risk because the number of live integrations now exceeds the observability and test maturity of the repo.

## Documentation State

The documentation folder currently contains about 110 files. It includes:

- foundational product/spec docs
- roadmap and progress updates
- deployment guides
- billing/usage/provider specs
- many vision/media experiments
- UX redesign specs

The documentation is rich, but fragmented. There is not yet a single maintained "truth" document that cleanly distinguishes:

- implemented
- partially implemented
- deprecated
- exploratory

This `project-analysis.md` should be treated as that baseline until the repo is rationalized further.

# Feature Inventory

## Core Platform

- **Account system**: Implemented
  Supports signup, login, email OTP verification, forgot-password OTP, JWT sessions, profile updates, and account deletion.

- **Role support**: Partially implemented
  Seller, agent, provider, admin, and super-admin roles exist in the data model and routing, but seller is the most complete end-user experience.

- **Property portfolio management**: Implemented
  Users can create, list, select, archive, restore, and delete property workspaces.

- **Guided workflow engine**: Partially implemented
  The dashboard and property workspace already use workflow state, phases, next-step recommendations, and readiness metrics, but the workflow system is not yet the clean backbone of every experience.

- **Checklist / readiness system**: Implemented, but still maturing
  Property checklists, readiness percentages, and task updates are real. They need richer automation and deeper integration with AI outputs and providers.

- **Public funnel / attribution tracking**: Implemented
  The seller-preview funnel, email capture, and event attribution flows are already in the API and web app.

## AI / Communications

- **Pricing narrative generation**: Implemented
  Structured AI output and fallback narrative logic exist.

- **Improvement guidance**: Partially implemented
  Prompt infrastructure and service scaffolding exist, but this is not yet a fully productized top-level seller feature.

- **Marketing copy generation**: Partially implemented
  Prompting and report/flyer/social-pack generation exist, but configurable tone, reuse, and editorial control are still early.

- **Document drafting**: Partially implemented
  Structured draft generation exists with disclaimer orientation, but broader document-center workflows remain incomplete.

- **Photo analysis**: Implemented
  OpenAI-based photo quality analysis with fallback scoring is live.

- **Vision enhancement / image generation**: Implemented but unstable
  The system supports presets, freeform instructions, provider orchestration, selection, draft pruning, and job cancellation, but reliability, duration, and output quality are still inconsistent.

- **Provider SMS communications**: Implemented
  Twilio outbound lead delivery, reply parsing, inbound hooks, and status callbacks are present.

- **Email communications**: Implemented
  OTP, welcome, provider lead, seller match, and admin alert email workflows exist.

## Routing / Workflows

- **Seller dashboard routing**: Implemented
  The dashboard routes users into property workflows, billing actions, provider suggestions, and readiness guidance.

- **Property workspace routing**: Implemented
  Tabs and workflow-guided navigation exist for overview, pricing, photos, seller picks, brochure, report, and checklist.

- **Role-based funnel routing**: Partially implemented
  Landing pages and auth flows differentiate seller, agent, and provider intent, but role-specific end-state experiences are still uneven.

- **Background/cached analysis flows**: Partially implemented
  Pricing, flyer, and report generation have gating and caching logic. Media jobs have job models and cancellation. The overall job execution architecture is still too API-centric and not worker-centric enough.

## Billing / Onboarding

- **Stripe plan catalog**: Implemented
  Seller, agent, provider, and demo plans are defined in code.

- **Checkout session creation**: Implemented
  Both end-user and provider billing flows are wired.

- **Webhook handling**: Partially implemented
  Webhook entrypoints and persistence exist, but lifecycle completeness and edge-case hardening remain important follow-up work.

- **Feature gating / usage safeguards**: Implemented
  Pricing, flyer, and report access is gated by plan entitlements and usage policies.

- **Seller onboarding**: Partially implemented
  The web app has meaningful onboarding and handoff behavior, but there is still no clean, dedicated multi-step onboarding sequence across all primary roles.

- **Provider onboarding**: Implemented, but operationally maturing
  Provider signup, portal access, billing, verification docs, and profile management exist. Compliance review and marketplace quality controls still need tightening.

## Integrations

- **RentCast**: Implemented
  Used for AVM and sale-listing retrieval that feed pricing analysis.

- **Stripe**: Implemented
  Used for billing and entitlement flows.

- **Twilio**: Implemented
  Used for provider marketplace SMS dispatch and inbound replies.

- **SendGrid / SMTP**: Implemented
  Used for auth and marketplace/admin emails.

- **OpenAI**: Implemented
  Used for structured JSON workflows and image review/analysis.

- **Replicate**: Implemented
  Used in the vision/media pipeline for inpainting-oriented transformations.

- **Google Maps / Places / Geocoding**: Implemented
  Used for provider discovery fallback, property maps, report maps, and map images.

- **Google Cloud Storage**: Implemented
  Used as the intended production storage backend for media assets.

- **Slack**: Not implemented

## Mobile Capabilities

- **Shared auth with backend**: Implemented
- **Property list + selection**: Implemented
- **Dashboard snapshot**: Implemented
- **Checklist interaction**: Implemented
- **Camera capture and library import**: Implemented
- **Photo upload and media review**: Implemented
- **Vision enhancement trigger and variant selection**: Implemented
- **Profile editing**: Implemented
- **Native-quality screen architecture**: Not yet mature
  The mobile app currently behaves more like a dense unified operations screen than a modular native app.

## Admin / Internal Tools

- **Protected admin API**: Implemented
- **Admin web overview**: Implemented
- **Users/properties/billing/usage/workers pages**: Implemented
- **Pricing-query policy controls**: Implemented
- **Media variant cleanup controls**: Implemented
- **Provider moderation and billing sync**: Implemented
- **Provider lead operations**: Implemented
- **Deeper forensic/debug tooling**: Partial
  The foundations are there, but diagnostics for long-running vision jobs, failed AI outputs, and storage/linkage issues should be much stronger.

# Current Gaps & Risks

## Strategic Gaps

- The product has accumulated too much energy in experimental wall/vision behavior relative to pricing, workflow clarity, provider marketplace value, and seller/agent outcomes.
- Agent mode exists conceptually, in pricing/billing language, and in some workflow branching, but it is not yet a clearly differentiated commercial product.
- The checklist/workflow engine is important but still not the unifying operating model across dashboard, workspace, mobile, exports, and provider actions.

## Architecture Risks

- The largest web and mobile experiences are each concentrated in one oversized component file, which raises regression risk and slows iteration.
- The repo includes worker services, but most real heavy lifting still lives inside the API. That creates an architectural mismatch between intended and actual runtime behavior.
- Vision/media workflows can be long-running, provider-dependent, and operationally expensive, but the system does not yet have robust queueing, orchestration visibility, or SLA-aware fallback behavior.

## Product Reliability Risks

- Long-running image enhancement jobs can take too long for users and can still fail after significant wait time.
- Heavy workflows have partial cancellation support, but the overall UX around progress, retry, timeout, and degradation is not fully consistent.
- The maintenance CLI story is uneven. For example, `npm` argument forwarding around cleanup scripts is not ergonomic and can confuse operators.

## UX Risks

- Seller and provider workflows are feature-rich but dense.
- The dashboard and property workspace contain a lot of power, but the experience can feel like many tools living side by side rather than one clean guided product.
- Mobile has breadth, but not enough screen decomposition, which makes stability and native UX harder.

## Operational Risks

- The system depends on many external services, but error tracking and observable job-state debugging are not yet mature enough for the complexity.
- Secret and environment surface area is large.
- Documentation drift means engineers can easily implement toward a stale architectural assumption.

## Testing Risks

- API test coverage exists in important places, which is a real strength.
- Web and mobile still rely heavily on placeholder lint/test scripts.
- Integration coverage for critical user journeys remains too light for the current integration count.

# Prioritized Roadmap

## 1. Establish A Single Runtime Truth For Heavy Jobs

- **Title**: Move long-running AI/media/report work onto a real job-execution architecture
- **Description**: The repo has worker-shaped services and job models, but most important heavy work is still anchored in the API. This is the main reason timeouts, long waits, partial failures, and confusing lifecycle behavior remain painful.
- **Priority**: Critical
- **Category**: Performance
- **Suggested implementation approach**: Define one canonical async execution model for pricing-adjacent heavy tasks, vision jobs, flyer/report generation, and notifications. Keep the API focused on request validation, entitlement checks, job creation, and status polling. Either wire the existing worker services properly or collapse them and introduce a real queue-backed worker path.

## 2. Decompose The Two Mega-Clients

- **Title**: Split the web property workspace and mobile root screen into domain modules
- **Description**: `PropertyWorkspaceClient.js` and `RootScreen.js` are now major operational risks. Their size makes changes slower, testing harder, and regressions more likely.
- **Priority**: Critical
- **Category**: Tech Debt
- **Suggested implementation approach**: Extract domain slices such as pricing, gallery, vision, exports, providers, checklist, account, and workflow navigation into isolated components/hooks/services. Preserve behavior first, then improve composition.

## 3. Stabilize The Core Seller Journey

- **Title**: Make the seller flow consistently move from onboarding to listing-ready outputs
- **Description**: The product has the right pieces, but the experience still feels like several powerful modules rather than one coherent guided plan.
- **Priority**: Critical
- **Category**: UX
- **Suggested implementation approach**: Define one canonical seller journey: onboarding -> property details -> pricing -> photos -> checklist -> providers -> report/flyer/export. Use workflow state to drive the primary CTA in dashboard, workspace, and mobile.

## 4. Strengthen Pricing Explainability

- **Title**: Productize comp transparency and confidence communication
- **Description**: Pricing analysis exists and is credible, but the user still needs more explanation about why comps were selected and how confident the system is.
- **Priority**: High
- **Category**: Feature
- **Suggested implementation approach**: Expose comp score, distance, recency, AVM role, variance, and low-confidence reasons in both dashboard and report surfaces. Persist richer debug metadata in pricing analyses for admin review.

## 5. Make The Workflow Engine The Product Backbone

- **Title**: Promote workflow/checklist state into the central orchestration layer
- **Description**: Workflow logic exists, but not every feature treats it as the primary source of next actions.
- **Priority**: High
- **Category**: Feature
- **Suggested implementation approach**: Standardize workflow step definitions, dependencies, completion rules, and CTA targets. Ensure pricing, photos, providers, reports, and billing all update workflow state instead of acting like parallel systems.

## 6. Finish Billing As The Source Of Truth For Access

- **Title**: Harden Stripe lifecycle handling and entitlement synchronization
- **Description**: Plan catalog, checkout, and sync exist, but subscriptions and access still need stronger lifecycle handling and admin clarity.
- **Priority**: High
- **Category**: Bug
- **Suggested implementation approach**: Audit all Stripe events that matter, document supported states, make webhook processing idempotent, and ensure every gated feature reads from one consistent entitlement model.

## 7. Build The Provider Marketplace Into A Revenue-Grade Surface

- **Title**: Complete provider ranking, verification, and lead operations
- **Description**: Provider foundations are stronger than many apps at this stage, but this area is still not polished enough to be a clear monetization engine.
- **Priority**: High
- **Category**: Feature
- **Suggested implementation approach**: Improve ranking transparency, surface verification state clearly, add sponsored labeling, refine provider/admin moderation tools, and strengthen lead acceptance/completion lifecycle tracking.

## 8. Reduce Vision Scope To Marketplace-Relevant Outcomes

- **Title**: Reframe the vision system around first-impression and listing-ready value
- **Description**: The system has spent too much complexity on subtle finish transformations that are difficult to validate and easy to fail.
- **Priority**: High
- **Category**: UX
- **Suggested implementation approach**: Narrow the default vision product to fast first-impression improvement, high-confidence declutter/lighting cleanup, and a stricter listing-ready pass. Treat experimental wall/floor/freeform transformations as diagnostic or advanced tools rather than core workflow anchors.

## 9. Improve Job Progress, Retry, And Cancellation UX

- **Title**: Standardize long-running job user experience
- **Description**: Job cancellation now exists for vision jobs, but the system still needs better expectations, retry paths, timeouts, and fallback behavior.
- **Priority**: High
- **Category**: UX
- **Suggested implementation approach**: Create shared job state semantics across web/mobile: queued, running, reconnecting, soft-failed, warning-result, completed, cancelled. Expose elapsed time, cancellation, and "use last best result" behaviors consistently.

## 10. Turn Reports And Flyers Into Durable Assets

- **Title**: Add versioning, storage strategy, and higher-quality export outputs
- **Description**: Flyers, reports, and social packs are real and useful, but they still feel closer to generated outputs than durable product assets.
- **Priority**: High
- **Category**: Feature
- **Suggested implementation approach**: Version outputs, store signatures for cache reuse, improve print/export layout quality, add stronger image selection controls, and make regeneration/editing more explicit.

## 11. Harden Observability And Failure Debugging

- **Title**: Add production-grade tracing, metrics, and structured failure review
- **Description**: The integration footprint is now large enough that logs alone are not enough.
- **Priority**: High
- **Category**: Performance
- **Suggested implementation approach**: Add request correlation, job correlation ids, explicit integration failure logging, external API timing, and admin-visible diagnostics for pricing, media, and billing failures.

## 12. Normalize Documentation Around The Live System

- **Title**: Reconcile docs with actual implementation and archive stale assumptions
- **Description**: The repo’s documentation is rich but inconsistent. Engineers can still read older Prisma/Postgres or exploratory vision docs and assume they are current.
- **Priority**: High
- **Category**: Tech Debt
- **Suggested implementation approach**: Create a doc taxonomy: live architecture, active roadmap, experiments, archived assumptions. Mark stale docs explicitly and link core docs from the root README.

## 13. Finish Web And Mobile Test Foundations

- **Title**: Replace placeholder web/mobile test and lint scripts with real coverage
- **Description**: API tests are meaningfully ahead of client-side test maturity.
- **Priority**: High
- **Category**: Tech Debt
- **Suggested implementation approach**: Add real linting and focused integration tests for auth, dashboard loading, property creation, pricing, gallery, and provider workflows. Keep test scope small but critical-path focused.

## 14. Fix Mobile Runtime Fragility

- **Title**: Resolve mutation/query state instability and native surface fragility
- **Description**: The mobile app is featureful, but its dense architecture and current query/mutation coupling increase the chance of runtime errors.
- **Priority**: High
- **Category**: Bug
- **Suggested implementation approach**: Extract mutation hooks, normalize loading-state ownership, add defensive rendering around async state, and verify compatibility assumptions across Expo, React Native, and TanStack Query versions.

## 15. Make Admin A Better Operating Console

- **Title**: Expand admin from reporting to operational remediation
- **Description**: The admin app has real insight surfaces, but it still needs better intervention tools for failed jobs, subscriptions, provider review, and diagnostics.
- **Priority**: Medium
- **Category**: Feature
- **Suggested implementation approach**: Add drill-downs, action histories, rerun/repair tools, and explicit state-change operations for subscriptions, leads, pricing policy, and media cleanup.

## 16. Improve Storage And Asset Lifecycle Management

- **Title**: Formalize media asset retention, cleanup, and migration operations
- **Description**: Media lifecycle cleanup is present, but the operational story around migration, retention classes, and cleanup ergonomics is still rough.
- **Priority**: Medium
- **Category**: Performance
- **Suggested implementation approach**: Define lifecycle states clearly, add safer admin and script tooling, improve CLI UX for cleanup scripts, and document migration/retention behavior.

## 17. Deepen Provider-To-Checklist Linking

- **Title**: Tie checklist tasks directly to provider recommendations and outcomes
- **Description**: The provider system and checklist system are connected, but they can become much stronger together.
- **Priority**: Medium
- **Category**: Feature
- **Suggested implementation approach**: For provider-backed tasks, show ranked providers, saved providers, outreach status, and completion feedback inline with the task, not as adjacent systems.

## 18. Clarify Agent Mode As A Real Product

- **Title**: Turn agent support from role-flavoring into a clear commercial mode
- **Description**: Agent plan definitions and some role branching exist, but there is not yet a crisp agent workflow advantage.
- **Priority**: Medium
- **Category**: Feature
- **Suggested implementation approach**: Define agent-specific onboarding, faster property creation, presentation-oriented outputs, reusable branding, and multi-property workflows that materially differ from seller mode.

## 19. Expand Compliance And Auditability

- **Title**: Make disclaimers, approval states, and AI traceability more explicit
- **Description**: The repo shows good awareness of compliance, but it needs stronger end-to-end traceability for important outputs and decisions.
- **Priority**: Medium
- **Category**: Tech Debt
- **Suggested implementation approach**: Track prompt version, model/provider, fallback status, disclaimer state, and review requirement on major generated assets and AI decisions.

## 20. Replace Placeholder Worker Services Or Remove Them

- **Title**: Eliminate architectural ambiguity in `services/*`
- **Description**: The repo structure implies a distributed worker architecture, but the implementations are mostly placeholders. That creates false confidence about production boundaries.
- **Priority**: Medium
- **Category**: Tech Debt
- **Suggested implementation approach**: Either fully wire the worker services into the runtime model or collapse them and document the system as API-centric until real worker boundaries are introduced.

## 21. Improve Funnel Measurement Into Actionable Acquisition Data

- **Title**: Turn public funnel tracking into a true acquisition dashboard
- **Description**: Attribution and funnel events are present, which is a strong base, but acquisition intelligence is still mostly descriptive.
- **Priority**: Medium
- **Category**: Feature
- **Suggested implementation approach**: Add campaign performance views tied to signups, properties created, plan upgrades, flyer/report generation, and provider engagement so the business can optimize marketing spend.

## 22. Add A Notification Strategy Beyond Auth And SMS

- **Title**: Define reminders and status notifications as a product system
- **Description**: Email and Twilio are live, but broader notification behavior is still underdeveloped.
- **Priority**: Low
- **Category**: Feature
- **Suggested implementation approach**: Introduce notification preferences, reminder types, and event-driven delivery for seller workflow milestones, provider replies, job completion, and billing state changes.

## 23. Clean Up Maintenance And Operator UX

- **Title**: Fix script ergonomics, operator docs, and support tooling
- **Description**: There are useful scripts for cleanup, seeding, SMS testing, demo cloning, and admin setup, but they need clearer operator experience.
- **Priority**: Low
- **Category**: UX
- **Suggested implementation approach**: Standardize script invocation patterns, document examples that work across npm/PowerShell, and expose the most important operational actions in admin where possible.

# Suggested Execution Phases

## Phase 0: Alignment And Truth Reset

### Goals

- stop roadmap drift
- reset the team around the current architecture
- decide what is core versus experimental

### Scope

- adopt this file as the temporary source of truth
- mark stale docs, especially older Prisma/Postgres assumptions
- explicitly classify the vision system into core, advanced, and experimental modes
- define the canonical seller journey and canonical agent/provider expansions

### Why First

Without this phase, execution will continue to split between speculative docs, current code, and tactical bug-fixing.

## Phase 1: Platform Hardening

### Goals

- reduce regression risk
- stabilize heavy-job behavior
- make the system operable

### Scope

- decompose `PropertyWorkspaceClient.js`
- decompose `RootScreen.js`
- implement the real heavy-job execution model
- standardize progress/cancel/retry UX
- strengthen observability and job diagnostics
- fix mobile runtime fragility and add defensive async state handling

### Dependencies

- Requires Phase 0 decisions on what the vision system should actually optimize for

## Phase 2: Core Seller Experience

### Goals

- make the seller flow coherent and obviously useful
- turn workflow/checklist into the central operating system

### Scope

- improve onboarding handoff into property creation
- productize pricing explainability
- unify dashboard/workspace/mobile around the same next-step engine
- deepen checklist integration with pricing, photos, providers, and exports

### Dependencies

- Benefits from Phase 1 decomposition because the current client surfaces are too dense for clean UX iteration

## Phase 3: Monetization And Marketplace

### Goals

- make revenue and marketplace value more durable
- reduce ambiguity around entitlements and provider monetization

### Scope

- harden Stripe lifecycle handling
- clarify plan-to-feature mapping
- complete provider ranking, verification, and lead lifecycle
- expose acquisition/funnel performance in admin
- improve sponsored/provider disclosure UX

### Dependencies

- Needs stable workflow surfaces from Phase 2 so monetization happens inside a coherent product journey

## Phase 4: Durable Exports And Professional Outputs

### Goals

- turn generated content into dependable business assets

### Scope

- improve flyer/report/social-pack versioning
- strengthen export quality and asset storage
- improve image selection controls
- expand document/report traceability and compliance markers
- sharpen agent-facing presentation value where appropriate

### Dependencies

- Strongly benefits from Phase 2 because better workflow state should determine what gets exported and when

## Phase 5: Focused Differentiators

### Goals

- invest in unique product strengths without re-entering unbounded experimentation

### Scope

- keep first-impression and listing-ready visual tools
- integrate provider help more tightly with checklist outcomes
- expand agent mode into a distinct product
- add reminder and notification systems

### Dependencies

- Only pursue after the platform is stable and the seller journey is coherent

## Phase 6: Structural Cleanup And Scale Readiness

### Goals

- reduce hidden complexity
- prepare for more team members and more production load

### Scope

- replace or remove placeholder worker services
- finish real test/lint coverage across apps
- formalize asset lifecycle operations
- improve deployment, secret, and operator workflows

### Dependencies

- Can begin in parallel in small parts, but most value comes after the earlier phases produce a more stable product core

## Recommended Execution Order Summary

1. Reset documentation and strategic scope.
2. Harden job execution, observability, and giant-client maintainability.
3. Turn seller workflow into one coherent path.
4. Strengthen pricing clarity and checklist-driven value.
5. Complete billing and provider marketplace as revenue systems.
6. Upgrade exports, reports, and presentation outputs.
7. Reinvest in focused differentiators only after the foundation is stable.
