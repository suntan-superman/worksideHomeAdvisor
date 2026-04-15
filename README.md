# Workside Home Seller Assistant

AI guidance for pricing, prep, marketing, and sale readiness.

This monorepo is the production-oriented foundation for a web portal, Expo mobile app, admin console, API, AI orchestration service, and supporting workers. It is tailored to the current product decisions:

- Next.js web app in JavaScript
- Expo-managed React Native mobile app
- Fastify API with MongoDB Atlas as the primary backend
- Email/password auth with email OTP verification
- RentCast as the comps and market-data provider
- Media storage is provider-based: local disk for simple local dev, Google Cloud Storage for production-ready Cloud Run deployments
- AI workflows for pricing, improvements, marketing, timing, flyer creation, and document drafting

## Workspace Layout

```text
apps/
  api/                 Main REST API and auth/property domains
  web/                 Seller-facing web portal
  mobile/              Expo-managed seller mobile portal
  admin-web/           Internal admin console
packages/
  branding/            Product and brand constants
  config/              Feature flags and route constants
  prompts/             AI prompt builders and guardrails
  types/               Shared enums and shape helpers
  utils/               Shared formatting and scoring helpers
  validation/          Zod schemas for API and AI payloads
services/
  ai-orchestrator/     AI workflow execution layer
  document-worker/     PDF and document generation placeholder
  media-worker/        Media processing placeholder
  market-data-worker/  Comparable sales provider abstraction
  notification-worker/ Email and reminder pipeline placeholder
infrastructure/
  docker/              Local Docker services
  gcp/                 Cloud Build and Cloud Run deployment assets
  scripts/             Dev helper placeholders
```

## Deployment

Cloud Run backend deployment guidance is documented in `docs/deployment/cloud-run-backend.md`.
Google Cloud Storage media setup is documented in `docs/deployment/google-cloud-storage-media.md`.

## Local Setup

1. Install `pnpm`, Node.js 20+, Docker Desktop, and Expo Go.
2. Copy `.env.example` to `.env` and fill in secrets.
3. Start local infrastructure:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

4. Install dependencies:

```bash
pnpm install
```

5. Start the key apps:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
pnpm dev:admin
pnpm dev:ai
```

## Current Backend Direction

The docs in `docs/` originally outlined a Postgres/Prisma baseline. The active scaffold in this repo intentionally pivots to MongoDB Atlas because it fits the current product direction and your preferences better:

- flexible property and AI snapshot storage
- simpler ingestion of comps and analysis artifacts
- smoother fit with the existing JavaScript AI backend patterns
- easier early-stage iteration while preserving clear domain boundaries

## Auth Model

The current auth foundation is designed around:

- email + password signup
- email OTP verification before full access
- JWT session issuance after verification
- support for a single seller owning multiple properties

## AI/Data Notes

- comp data is designed around RentCast, with seeded demo fallback data when no API key is configured yet
- AI workflows are structured JSON-first with disclaimers and confidence language, and now call the OpenAI Responses API when `OPENAI_API_KEY` is configured
- the legacy AI backend in `legacy-merxus-ai-backend/` is kept as a reference source for migration into the new `services/ai-orchestrator`

## Next Recommended Build Sequence

1. Wire Mongo collections and seed data into the API.
2. Connect the web onboarding flow to live auth/property endpoints.
3. Connect the Expo app to the same API.
4. Port reusable prompt/orchestration pieces from the legacy backend.
5. Add market-data provider integrations and document/flyer generation workers.

## Pricing Endpoints

- `POST /api/v1/properties/:propertyId/pricing/analyze`
- `GET /api/v1/properties/:propertyId/pricing/latest`
- `GET /api/v1/properties/:propertyId/dashboard`

## Billing Endpoints

- `GET /api/v1/billing/plans`
- `GET /api/v1/billing/summary/:userId`
- `POST /api/v1/billing/checkout-session`
- `POST /api/v1/billing/webhook`

## Admin Bootstrap

Create or update a verified admin or demo account:

```bash
npm run admin:user --workspace=@workside/api
```
//////////////////////////////////////////////////////////
To deploy backend:

git add .;git commit -m "Update Home Advisor Interface and Backend";git push

gcloud builds submit . `
  --config infrastructure/gcp/cloudbuild.api.yaml `
  --substitutions "_AR_HOST=us-central1-docker.pkg.dev,_AR_REPO=homeadvisor-api,_IMAGE_NAME=workside-api,_IMAGE_TAG=latest"

gcloud run deploy workside-api `
  --image us-central1-docker.pkg.dev/worksidehomeadvisor/homeadvisor-api/workside-api:latest `
  --region us-central1

//////////////////////////////////////////////////////////
to run the admin web app:

npm run dev --workspace=@workside/admin-web
or
cd C:\Users\sjroy\Source\HomeAdvisor\apps\admin-web
npm run dev
//////////////////////////////////////////////////////////
Replicate: https://replicate.com/
//////////////////////////////////////////////////////////
Twilio SMS Number: +1 888 949 4776
//////////////////////////////////////////////////////////
gcloud projects list
gcloud config get-value project
gcloud config set project worksidehomeadvisor
//////////////////////////////////////////////////////////

For mac build:
# root
git fetch origin
git reset --hard origin/main
git clean -fd
npm install

# mobile
cd apps/mobile
rm -rf ios android
npx expo prebuild --clean
cd ios
pod install
cd .. 

then open Xcode here:
open ios/*.xcworkspace
/////////////////////////////////////////////////////////////
https://worksideadvisor.com/
https://worksidehomeadvisoradmin.netlify.app/login
/////////////////////////////////////////////////////////////
npm run clone:demo --workspace=@workside/api -- --source=demo@worksidesoftware.com --target=demo@worksideadvisor.com
////////////////////////////////////////////////////////////
To clean up photo variants

From c:\Users\sjroy\Source\HomeAdvisor, use:

npm run cleanup:variants-before-date -- --before=2026-04-09
That shows what would be deleted.

If the dry run looks right, run:

npm run cleanup:variants-before-date -- --before=2026-04-09 --confirm

If you are already inside apps/api, the same command works there too.

////////////////////////////////////////////////////////////
