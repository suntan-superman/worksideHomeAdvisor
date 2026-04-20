# Workside Home Seller Assistant
## Monorepo Scaffold Specification for Codex

This document defines the initial repository structure, package boundaries, naming conventions, environment setup, and implementation rules for the Workside Home Seller Assistant platform.

The goal is to give Codex a concrete scaffold to generate immediately, without guessing.

---

# 1. Monorepo Goals

The monorepo must:
- support web + mobile + API + admin portal
- support AI orchestration and async workers
- maximize code sharing where appropriate
- keep domain boundaries clear
- support production deployment and future white-labeling
- keep Workside Software branding easy to manage centrally

---

# 2. Recommended Repository Name

```text
workside-home-seller
```

Alternative:
```text
ai-home-seller
```

Use **workside-home-seller** unless there is a naming collision.

---

# 3. Package Manager and Workspace

## Recommendation
Use **pnpm workspaces**.

## Why
- fast installs
- clean workspace linking
- good monorepo ergonomics
- predictable shared package management

## Root files
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.editorconfig`
- `.gitignore`
- `.npmrc`
- `.env.example`
- `.prettierrc`
- `eslint.config.js` or equivalent
- `README.md`

---

# 4. Top-Level Folder Structure

```text
workside-home-seller/
  apps/
    web/
    mobile/
    api/
    admin-web/
  services/
    ai-orchestrator/
    media-worker/
    document-worker/
    market-data-worker/
    notification-worker/
  packages/
    ui/
    types/
    validation/
    config/
    prompts/
    utils/
    analytics/
    branding/
  infrastructure/
    docker/
    gcp/
    terraform/
    scripts/
  docs/
    architecture/
    api/
    prompts/
    operations/
  .github/
    workflows/
```

---

# 5. App Responsibilities

## 5.1 apps/web
Primary seller web portal.

### Responsibilities
- authentication UI
- seller onboarding
- property dashboard
- pricing/comps UI
- room/improvement UI
- marketing/flyer builder
- document center
- AI chat
- settings/profile

### Suggested stack
- React
- Next.js preferred
- TypeScript
- Tailwind CSS
- React Query
- Zustand for local UI state if needed

---

## 5.2 apps/mobile
Primary seller mobile portal.

### Responsibilities
- auth
- property summary
- photo capture/upload
- room walkthrough
- tasks
- AI chat
- notifications
- document/flyer preview

### Suggested stack
- React Native
- Expo managed
- TypeScript
- React Navigation
- React Query

---

## 5.3 apps/api
Main backend API.

### Responsibilities
- auth/session APIs
- property APIs
- room/media APIs
- pricing/improvement/marketing/document APIs
- orchestration of job requests
- admin-safe endpoints where appropriate
- audit logging
- permission enforcement

### Suggested stack
- Node.js
- TypeScript
- Fastify or NestJS
- PostgreSQL
- Redis
- Prisma or Drizzle ORM

---

## 5.4 apps/admin-web
Internal Workside Software admin console.

### Responsibilities
- prompt version management
- feature flags
- analytics dashboards
- user/property inspection
- flagged output review
- disclaimer/template management
- audit log viewing

### Suggested stack
- Next.js
- TypeScript
- Tailwind CSS
- React Query

---

# 6. Service Responsibilities

## 6.1 services/ai-orchestrator
Central AI orchestration service.

### Responsibilities
- build prompts
- fetch contextual data
- invoke model provider(s)
- validate JSON output
- store AI output versions
- attach confidence and disclaimer metadata
- support tool-calling patterns

### Internal modules
- prompt registry
- context builders
- output validators
- workflow runners
- moderation/risk checks

---

## 6.2 services/media-worker
Async media processing service.

### Responsibilities
- thumbnail generation
- image metadata extraction
- room classification
- quality scoring
- feature tagging
- duplicate detection placeholders

---

## 6.3 services/document-worker
Async document and export generation.

### Responsibilities
- render templates
- inject disclaimer blocks
- generate PDFs
- build flyer exports
- create downloadable artifacts

---

## 6.4 services/market-data-worker
Market/comps ingestion and normalization.

### Responsibilities
- pull comp/provider data
- normalize records
- geocode/clean addresses
- compute raw similarity signals
- cache datasets
- monitor provider freshness

---

## 6.5 services/notification-worker
Async notifications and reminder delivery.

### Responsibilities
- email delivery
- push notifications
- scheduled reminders
- event-driven notifications
- retry logic and delivery logs

---

# 7. Shared Packages

## 7.1 packages/ui
Shared design system for web/admin and partial reuse patterns.

### Contents
- buttons
- forms
- modals
- cards
- typography
- loading states
- empty states
- badges
- data display components

### Notes
- keep React web-compatible
- mobile should not directly depend on this package unless intentionally shared through separate abstractions

---

## 7.2 packages/types
Shared TypeScript types.

### Contents
- API DTOs
- domain entity shapes
- enums
- job payload types
- event types
- AI result types

---

## 7.3 packages/validation
Shared schema validation.

### Contents
- zod schemas
- API input validators
- AI output validators
- environment schemas

---

## 7.4 packages/config
Central config helpers.

### Contents
- env parsing
- feature flags
- app constants
- route constants
- provider config helpers

---

## 7.5 packages/prompts
Prompt templates and supporting prompt utilities.

### Contents
- pricing prompts
- improvement prompts
- room prompts
- marketing prompts
- flyer prompts
- document prompts
- timing prompts
- system rules
- prompt version metadata

---

## 7.6 packages/utils
Generic utilities.

### Contents
- date formatting
- currency formatting
- geo helpers
- string utilities
- scoring helpers
- file helpers

---

## 7.7 packages/analytics
Central event names and analytics payload types.

### Contents
- analytics event constants
- helper wrappers
- server-side event payload typing

---

## 7.8 packages/branding
Central branding config.

### Contents
- Workside Software brand tokens
- logo paths
- default footer copy
- product name constants
- export branding helpers

---

# 8. Domain Module Structure Inside apps/api

Use clear domain modules.

```text
apps/api/src/
  main.ts
  app.ts
  config/
  common/
  modules/
    auth/
    users/
    sellers/
    properties/
    rooms/
    media/
    comps/
    pricing/
    improvements/
    marketing/
    flyers/
    documents/
    ai/
    tasks/
    notifications/
    admin/
    audit/
  db/
  jobs/
  events/
```

## Rules
- each module owns its controller/routes, service, schema, and persistence mapping
- cross-module access should happen through exported services/interfaces, not ad hoc imports
- AI orchestration should not directly own core data persistence for every domain; domain modules should remain authoritative

---

# 9. Suggested Web App Structure

```text
apps/web/
  src/
    app/ or pages/
    components/
    features/
      auth/
      onboarding/
      dashboard/
      pricing/
      comps/
      rooms/
      improvements/
      media/
      marketing/
      flyers/
      documents/
      ai-chat/
      settings/
    hooks/
    lib/
    providers/
    styles/
```

## Notes
Prefer feature-based organization over giant generic components folders.

Each feature folder should contain:
- UI components
- hooks
- API client helpers
- view model logic
- local types if truly feature-specific

---

# 10. Suggested Mobile App Structure

```text
apps/mobile/
  src/
    navigation/
    screens/
      Auth/
      Onboarding/
      Dashboard/
      Pricing/
      Rooms/
      Media/
      Improvements/
      Tasks/
      Documents/
      Flyer/
      Chat/
      Settings/
    components/
    features/
    hooks/
    services/
    store/
    utils/
    theme/
```

## Notes
- keep API client shared where practical
- centralize upload/resume handling
- centralize notification handling
- keep platform-specific code isolated

---

# 11. AI Orchestrator Structure

```text
services/ai-orchestrator/src/
  index.ts
  config/
  providers/
  prompts/
  workflows/
    pricing/
    improvements/
    rooms/
    marketing/
    flyers/
    documents/
    chat/
  tools/
  validators/
  formatters/
  risk/
  storage/
```

## Workflow pattern
Each workflow should have:
- input schema
- context builder
- prompt builder
- model invocation
- output validation
- fallback/error handling
- persistence adapter

---

# 12. Worker Structure

Example:

```text
services/media-worker/src/
  jobs/
  processors/
  storage/
  image/
  classifiers/
  queues/
  utils/
```

Same pattern for other workers:
- job registration
- processor logic
- queue adapters
- provider clients
- logging

---

# 13. Database / ORM Structure

If using Prisma:

```text
apps/api/prisma/
  schema.prisma
  migrations/
  seeds/
```

If using Drizzle:

```text
apps/api/src/db/
  schema/
  migrations/
  seeds/
  client.ts
```

## Recommendation
Use **Prisma** for initial speed and readability.

---

# 14. Environment Variable Strategy

## Root env example
Create:
- `.env.example`
- app-specific `.env.example` files where needed

## Categories

### Shared
- NODE_ENV
- APP_ENV
- LOG_LEVEL

### Database
- DATABASE_URL
- DIRECT_DATABASE_URL optional

### Redis
- REDIS_URL

### Storage
- STORAGE_BUCKET
- STORAGE_REGION
- STORAGE_ENDPOINT optional
- SIGNED_URL_TTL_SECONDS

### Auth
- JWT_SECRET
- JWT_REFRESH_SECRET
- SESSION_COOKIE_NAME

### Maps/Geo
- GOOGLE_MAPS_API_KEY or MAPBOX_TOKEN
- GEOCODING_PROVIDER

### AI
- OPENAI_API_KEY or provider key
- AI_MODEL_DEFAULT
- AI_MODEL_VISION
- AI_TIMEOUT_MS

### Notifications
- SENDGRID_API_KEY or equivalent
- SENDGRID_FROM_EMAIL
- EXPO_PUSH_ACCESS_TOKEN if needed

### Market data
- MARKET_DATA_PROVIDER
- MARKET_DATA_API_KEY
- MLS_REGION default if applicable

### Branding
- PUBLIC_PRODUCT_NAME
- PUBLIC_BRAND_NAME
- PUBLIC_SUPPORT_EMAIL

## Rules
- parse env vars centrally
- never access raw process.env throughout the codebase
- validate at startup

---

# 15. Shared Coding Standards

## TypeScript
- `strict: true`
- no `any` unless justified and isolated
- shared types preferred over duplicate DTOs

## Validation
- validate all external inputs
- validate all AI outputs
- validate queue messages

## Logging
- structured logging
- correlation/request IDs
- redact secrets and sensitive info

## Errors
- typed application errors
- normalized API error responses
- separate user-facing and internal error detail

---

# 16. API Client Sharing Strategy

Create a shared API client package or utility that both web and mobile can use for:
- auth requests
- property requests
- pricing/improvements/documents/media requests
- typed response parsing

Possible location:
```text
packages/utils/src/api-client/
```
or
```text
packages/types + per-app thin clients
```

Recommendation:
- shared DTOs in `packages/types`
- shared endpoint schemas in `packages/validation`
- per-app API client wrappers for platform-specific concerns

---

# 17. Jobs and Queue Conventions

## Queue names
- `media-processing`
- `document-generation`
- `flyer-generation`
- `pricing-analysis`
- `improvement-analysis`
- `notification-delivery`

## Job payload rules
- typed payloads only
- include request id / actor id / property id where applicable
- idempotency key for generation jobs

## Job status states
- queued
- processing
- completed
- failed
- retrying

---

# 18. Asset and Upload Conventions

## Storage paths
Use consistent paths:

```text
properties/{propertyId}/media/original/{assetId}.{ext}
properties/{propertyId}/media/thumb/{assetId}.jpg
properties/{propertyId}/documents/{documentId}.pdf
properties/{propertyId}/flyers/{flyerId}.pdf
```

## Media metadata
Store:
- original filename
- MIME type
- size
- width/height if image
- checksum
- upload timestamp
- processing status

---

# 19. Branding Rules

Centralize all product-facing strings in `packages/branding`.

Default branding:
- product name: `Workside Home Seller Assistant`
- powered by: `Powered by Workside Software`
- support email: configurable
- export footer: `© Workside Software`

## Important
Do not hardcode branding strings throughout apps.

---

# 20. Feature Flag Strategy

Create simple feature flag support from the beginning.

Examples:
- `enableDocumentDrafting`
- `enableFlyerExport`
- `enableAdvancedPricing`
- `enablePushNotifications`
- `enableAdminPromptEditor`

Flags should be:
- environment-backed initially
- db-backed later if needed

---

# 21. Testing Scaffold

## Root test scripts
- lint
- typecheck
- test
- test:unit
- test:integration
- test:e2e

## Per-app/service expectations
- API: unit + integration
- Web: component + minimal e2e
- Mobile: smoke tests + logic tests
- AI orchestrator: schema + workflow tests
- workers: processor tests

---

# 22. CI/CD Scaffold

## GitHub workflows
Create:
- `ci.yml`
- `web-deploy.yml`
- `api-deploy.yml`
- `admin-deploy.yml`
- optional worker deploy workflows

## CI steps
- install
- lint
- typecheck
- test
- build selected targets

## CD principle
Deploy apps/services independently.

---

# 23. Initial README Requirements

Root README should include:
- product overview
- repo layout
- local setup
- required tools
- env setup
- how to run web/mobile/api/admin
- how to run workers
- how to run database migrations
- how to seed demo data

---

# 24. Recommended Initial Commands Codex Should Support

At root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Per target:
```bash
pnpm --filter web dev
pnpm --filter mobile start
pnpm --filter api dev
pnpm --filter admin-web dev
pnpm --filter ai-orchestrator dev
```

Database:
```bash
pnpm db:migrate
pnpm db:seed
```

---

# 25. Initial Seed Data Requirements

Create demo seed data for:
- 1 admin user
- 1 seller user
- 1 demo property
- 5–10 mock comparable sales
- 6–10 mock media assets
- sample pricing analysis
- sample improvements
- sample tasks
- sample flyer
- sample document

This allows Workside to demo immediately.

---

# 26. Minimum First Commit Targets for Codex

Codex’s first scaffold PR should include:
- monorepo structure
- shared packages
- web/mobile/api/admin shells
- Prisma schema baseline
- auth and property models
- root scripts
- lint/typecheck/test setup
- local docker compose for db/redis
- README
- `.env.example`

---

# 27. Guardrails for Codex While Scaffolding

Do not:
- bury domain logic in generic utils
- mix admin and seller app code
- create circular dependencies across packages
- hardcode environment secrets
- skip validation layers
- make AI workflows directly manipulate DB without domain boundaries

Do:
- keep interfaces typed
- centralize schemas
- keep packages narrow and intentional
- prepare for async jobs early
- structure code for future multi-tenant support

---

# 28. Final Direction to Codex

Generate the scaffold in this order:
1. root workspace + tooling
2. shared packages
3. api base + db schema
4. web shell
5. mobile shell
6. admin shell
7. worker shells
8. env/config system
9. docker/local infra
10. seed/demo data

The result should be a serious production-oriented starting point for **Workside Home Seller Assistant**, clearly branded around **Workside Software** and ready for rapid feature implementation.
