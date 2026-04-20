# Workside Home Seller Assistant
## Sprint-by-Sprint Implementation Plan for Codex

This plan assumes a production-minded MVP built in a monorepo with:
- Web app
- Mobile app
- API/backend
- AI orchestration services
- Background workers
- Shared packages

Recommended cadence:
- 2-week sprints
- 8 implementation sprints
- 1 hardening/release sprint

---

# 1. Delivery Principles

## Priorities
1. Trustworthy seller experience
2. Fast path to visible product value
3. AI outputs must be structured, auditable, and disclaimer-safe
4. Web-first depth, mobile-first convenience
5. Build architecture that supports future white-labeling without requiring it now

## Definition of done for every sprint
- feature implemented
- API contract defined or updated
- validation added
- happy path tested
- failure states handled
- analytics/events added where appropriate
- audit logging added for critical actions
- documentation updated

---

# 2. Team Assumptions for Codex Execution

Codex should behave like a senior implementation agent and follow this order:
1. establish monorepo and shared standards
2. implement backend domain model and APIs first
3. wire web UI to live APIs
4. wire mobile UI to the same APIs
5. add AI orchestration behind typed service boundaries
6. add jobs/workers for heavy or slow workflows
7. add observability, admin tools, and release readiness

---

# 3. Suggested Sprint Timeline Overview

- Sprint 0: Architecture + repo foundation
- Sprint 1: Auth + property onboarding
- Sprint 2: Media pipeline + room model + dashboard shell
- Sprint 3: Comps + pricing engine
- Sprint 4: Improvement advisor + room-by-room AI
- Sprint 5: Marketing copy + flyer generation
- Sprint 6: Document drafting + disclaimers + export
- Sprint 7: AI chat + tasks + notifications
- Sprint 8: Admin console + analytics + auditability
- Sprint 9: Hardening + QA + pilot release

---

# 4. Sprint 0 — Architecture and Monorepo Foundation

## Goals
Establish the codebase, shared standards, deployment shape, and technical guardrails.

## Deliverables
- monorepo created
- package manager/workspace configured
- TypeScript base config
- linting, formatting, commit hooks
- environment configuration strategy
- containerization baseline
- CI pipeline baseline
- database + migration setup
- shared UI/types/validation packages
- Workside Software branding baseline

## Codex tasks
### Repo foundation
- create monorepo root
- configure pnpm or npm workspaces
- add root scripts for dev/build/test/lint/typecheck
- add `.editorconfig`, lint config, prettier config
- add root env examples

### Shared packages
- `packages/types`
- `packages/validation`
- `packages/ui`
- `packages/config`
- `packages/prompts`
- `packages/utils`

### Apps/services scaffolding
- `apps/web`
- `apps/mobile`
- `apps/api`
- `apps/admin-web`
- `services/ai-orchestrator`
- `services/document-worker`
- `services/media-worker`
- `services/market-data-worker`
- `services/notification-worker`

### Infrastructure
- Dockerfiles
- local docker-compose for db + redis
- deployment manifests or infra placeholders
- secrets strategy document

## Acceptance criteria
- all apps boot locally
- CI runs lint/typecheck on PR
- db connection works
- shared types import correctly
- environment strategy documented

---

# 5. Sprint 1 — Authentication and Property Onboarding

## Goals
Get a seller from sign-up to a saved property workspace.

## Deliverables
- auth system
- session handling
- seller profile creation
- property creation
- onboarding wizard on web
- simplified onboarding on mobile
- base property dashboard shell

## Backend tasks
- implement user model
- implement auth routes
- implement role model
- implement seller profile entity
- implement property CRUD
- add address validation and geocoding abstraction
- add audit logging for account creation and property creation

## Web tasks
- signup/login screens
- onboarding wizard:
  - seller info
  - address
  - property basics
  - goals/timeline/budget
- dashboard shell after onboarding

## Mobile tasks
- login/signup
- quick property setup flow
- property summary screen

## AI-related tasks
- none beyond future-ready service boundaries
- create stub AI service clients and interfaces

## Acceptance criteria
- user can create account
- user can create property
- onboarding data persists correctly
- dashboard loads property summary
- property data visible in both web and mobile

---

# 6. Sprint 2 — Media Pipeline, Rooms, and Dashboard Core

## Goals
Allow sellers to upload photos, organize rooms, and see useful dashboard summaries.

## Deliverables
- signed upload flow
- media asset persistence
- thumbnail generation
- room entities
- room assignment
- dashboard cards
- mobile photo capture/upload flow

## Backend tasks
- media asset model
- signed upload URL endpoint
- upload completion endpoint
- storage integration
- background thumbnail job
- room CRUD
- media-to-room linking
- asset metadata persistence
- audit logs for uploads

## Web tasks
- media manager page
- upload UI with progress
- room list editor
- assign photos to rooms
- property dashboard widgets:
  - photos uploaded
  - rooms completed
  - next tasks placeholder
  - readiness placeholder

## Mobile tasks
- camera/gallery upload
- upload retry/failure handling
- room photo checklist UI
- room summary cards

## AI-related tasks
- define image-analysis request/response schemas
- create stubs for:
  - room classification
  - photo quality scoring
  - feature tagging

## Acceptance criteria
- user can upload images from web/mobile
- system stores originals and thumbnails
- photos can be linked to rooms
- dashboard updates with media counts

---

# 7. Sprint 3 — Comps and Pricing Engine

## Goals
Deliver the first major value moment: pricing guidance.

## Deliverables
- comparable sales model
- market data abstraction
- comp retrieval service
- comp scoring engine
- pricing analysis endpoint
- pricing UI with scenarios
- comp map/list view
- pricing narrative from AI

## Backend tasks
- comparable sale schema
- market data provider abstraction
- geospatial search support
- comp scoring algorithm
- pricing analysis entity
- pricing calculation service:
  - low / mid / high range
  - confidence score
  - assumptions snapshot
- pricing analysis API
- cache comp results
- log source/provider health

## Web tasks
- pricing page
- comp list with filters
- comp map
- scenario cards:
  - conservative
  - target
  - stretch
- assumptions panel
- save pricing analysis

## Mobile tasks
- pricing summary screen
- simplified comp highlights
- pricing band card
- confidence summary

## AI tasks
- implement Pricing Advisor prompt
- require structured JSON
- render narrative from JSON
- include:
  - strengths
  - weaknesses
  - uncertainty explanation
  - next steps

## Acceptance criteria
- system can analyze a property and return pricing guidance
- UI explains why comps were chosen
- confidence score displayed
- pricing analysis stored historically

---

# 8. Sprint 4 — Improvement Advisor and Room-by-Room AI

## Goals
Turn raw property + photo data into actionable prep guidance.

## Deliverables
- room analysis pipeline
- improvement recommendation engine
- ROI ranking
- room-by-room advice UI
- budget-aware action plan

## Backend tasks
- room analysis job
- improvement recommendation schema
- ROI ranking logic
- cost-range model
- “must do / high ROI / optional / avoid” categorization
- recommendation status tracking
- generate tasks from recommendations

## Web tasks
- room advisor page
- improvement planner
- filters by priority/category/room
- budget slider/input
- action-plan generator

## Mobile tasks
- room-by-room recommendations
- checklist interaction
- quick mark complete/defer
- recommendation details view

## AI tasks
- implement Visual Property Advisor
- implement Improvement Advisor
- outputs must include:
  - recommended paint changes
  - staging/decluttering guidance
  - repair ideas
  - ROI estimate category
  - avoid recommendations
  - confidence + missing inputs
- map AI results into normalized DB records

## Acceptance criteria
- uploaded photos can trigger room guidance
- user sees prioritized improvements
- recommendations can be turned into tasks
- system supports budget-based prioritization

---

# 9. Sprint 5 — Marketing Copy and Flyer Generation

## Goals
Give sellers polished marketing assets from their photos and data.

## Deliverables
- listing copy generator
- photo ranking for marketing
- flyer builder
- PDF export
- editable marketing text
- Workside branding in exports

## Backend tasks
- flyer entity
- flyer template schema
- PDF generation pipeline
- selected photo persistence
- marketing text generation endpoints
- export endpoints

## Web tasks
- marketing copy studio
- editable:
  - headline
  - short description
  - full description
  - feature bullets
- flyer builder:
  - choose template
  - choose hero image
  - reorder photos
  - preview
  - export PDF

## Mobile tasks
- flyer preview
- marketing copy preview/edit light mode
- share/export hook

## AI tasks
- Marketing Advisor prompt
- photo ranking prompt/tool
- feature highlight selection
- headline generation
- fair housing filter before output display
- output alternatives, not just one version

## Acceptance criteria
- user can generate listing copy
- user can generate flyer
- flyer exports as PDF
- photo selection logic is explainable

---

# 10. Sprint 6 — Document Drafting, Disclaimers, and Export

## Goals
Allow users to draft helpful seller documents safely.

## Deliverables
- document center
- document templates
- state-aware disclaimer library
- AI-generated drafts
- PDF export
- document review state

## Backend tasks
- document entity
- disclaimer library
- document type registry
- document generation service
- export pipeline
- review-required flags
- prompt version persistence

## Web tasks
- document center page
- create draft flow
- edit draft UI
- disclaimer preview
- export/download actions
- mark reviewed

## Mobile tasks
- document list
- read-only or light-edit mode
- disclaimer acknowledgement view

## AI tasks
- Document Drafting Assistant
- required outputs:
  - structured sections
  - unresolved questions
  - disclaimer block
  - review warnings
- if state/jurisdiction unsupported:
  - explicit warning
  - no false confidence

## Acceptance criteria
- user can draft at least 5 document types
- relevant disclaimers always included
- exports function correctly
- audit log tracks document generation

---

# 11. Sprint 7 — AI Chat, Tasks, and Notifications

## Goals
Create the persistent seller assistant experience.

## Deliverables
- contextual AI chat
- task engine
- recommendation-to-task workflow
- reminders
- in-app notifications
- push/email notification infrastructure

## Backend tasks
- AI conversation model
- chat endpoint with property context
- task model enhancements
- notification preferences
- notification queue/worker
- in-app notification records

## Web tasks
- property-aware AI chat panel/page
- pin answer / convert to task
- task board/list
- reminder settings
- in-app alerts UI

## Mobile tasks
- AI chat screen
- task checklist
- push notification permission flow
- quick actions from notifications

## AI tasks
- contextual chat with tools:
  - fetch property details
  - latest pricing
  - improvement recommendations
  - media summary
  - documents summary
- implement response safety rules
- expose confidence/missing information when needed

## Acceptance criteria
- chat answers use property context
- recommendations can become tasks
- reminders send correctly
- users can manage task completion in web and mobile

---

# 12. Sprint 8 — Admin Console, Analytics, and Auditability

## Goals
Provide control, oversight, and operational visibility for Workside Software.

## Deliverables
- admin portal
- prompt version management
- feature flags
- analytics dashboards
- moderation/flag review
- audit log viewer

## Backend tasks
- admin authorization
- prompt registry CRUD
- feature flag service
- analytics aggregation endpoints
- audit log query endpoints
- flagged output handling
- support notes placeholders

## Admin web tasks
- admin dashboard
- users/properties list
- prompt versions page
- flag review queue
- audit log explorer
- template/disclaimer manager

## AI tasks
- attach prompt versions to outputs
- flag low-confidence or risky outputs
- moderation metadata support

## Acceptance criteria
- admin can inspect prompt versions
- admin can review logs and flagged outputs
- system analytics available for pilot monitoring

---

# 13. Sprint 9 — Hardening, QA, and Pilot Release

## Goals
Prepare for real pilot usage and Workside exposure.

## Deliverables
- end-to-end testing
- performance tuning
- production env setup
- seed/demo property workspaces
- branded pilot content
- support tooling
- release checklist

## Backend tasks
- rate limits
- caching pass
- queue retry tuning
- error handling review
- production configs
- backup strategy

## Web/mobile tasks
- empty states
- offline/resume behavior on mobile uploads
- error banners and recovery UX
- accessibility pass
- responsive polish
- branded marketing copy for landing pages

## AI tasks
- evaluation harness
- golden test prompts
- response consistency checks
- disclaimer compliance checks
- hallucination regression tests

## Acceptance criteria
- pilot users can onboard and reach core value flows
- critical flows covered by test plan
- exports and uploads stable
- logs/alerts in place for production monitoring

---

# 14. Cross-Sprint Engineering Standards

## Validation
Use shared schemas for:
- request bodies
- AI JSON outputs
- database payloads
- event messages

## Error handling
Every user-visible async workflow must expose:
- queued
- processing
- success
- failed
- retry available

## Audit logging
Required for:
- login
- property creation/update
- pricing generation
- improvement generation
- document generation
- flyer generation
- admin prompt changes

## Security
- signed uploads only
- no direct public bucket writes
- role checks everywhere
- redact secrets from logs
- encrypt sensitive records where necessary

---

# 15. Testing Strategy by Sprint

## Unit tests
- scoring logic
- validation schemas
- formatting functions
- permission checks
- prompt renderers

## Integration tests
- auth flow
- property creation
- upload completion
- pricing generation
- document generation
- flyer export

## End-to-end tests
- new seller onboarding
- upload photos
- generate pricing report
- generate improvement plan
- generate flyer
- draft document
- ask AI question
- complete tasks

## AI evaluation tests
- structured JSON validity
- disclaimer presence
- prohibited output checks
- confidence language checks
- fair housing language filters

---

# 16. Suggested Backlog Priority Within Each Sprint

When time is tight, prioritize in this order:
1. backend domain/API
2. web UI for primary flow
3. mobile support for same flow
4. AI polish and alternative outputs
5. admin/internal tooling
6. secondary UX refinements

---

# 17. Pilot Readiness Checklist

Before any external pilot:
- auth and session security reviewed
- disclaimers reviewed
- pricing outputs reviewed for wording
- legal-document outputs reviewed
- fair housing content filter tested
- storage lifecycle rules confirmed
- analytics and error monitoring active
- at least 2 demo properties loaded
- support workflow defined for pilot users

---

# 18. Post-MVP Recommended Next Sprints

## Post-MVP A
- offers tracker
- property microsite
- agent/collaborator invites

## Post-MVP B
- contractor/vendor referrals
- staging shopping lists
- timeline/calendar sync

## Post-MVP C
- e-signature integration
- escrow milestone workflows
- advanced market forecasting

---

# 19. Final Direction to Codex for Execution

Code in vertical slices:
- define schema
- create API
- implement service
- build UI
- add tests
- add analytics
- add audit logging

Do not leave AI as a loose chat layer.  
Treat AI as a controlled system that returns typed, reviewable, traceable outputs.

Do not postpone disclaimers.  
They must be part of the implementation from the first document and pricing workflows onward.

Build for a polished MVP that clearly showcases **Workside Software** as a serious, professional software company.
