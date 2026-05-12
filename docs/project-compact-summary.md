# Workside Home Advisor Compact Project Summary

Last updated: 2026-05-12

Workside Home Advisor is a seller-prep and listing-readiness platform. The current product helps a homeowner, advisor, or agent move from property intake through pricing, photo readiness, checklist work, provider coordination, and report/export generation.

## What We Built

- A pnpm monorepo with `apps/api`, `apps/web`, `apps/admin-web`, `apps/mobile`, shared packages, worker-service shells, docs, and deployment infrastructure.
- A Fastify + MongoDB Atlas backend for auth, properties, pricing, media, AI workflows, billing, providers, tasks, public funnels, reports, and admin operations.
- A seller-facing Next.js web app with landing/onboarding, auth, dashboard, property workspace, pricing, photos, Vision workflows, checklist, provider flows, reports, brochure/social outputs, and billing context.
- An Expo mobile app for seller workflows, including auth, property selection, photo capture/import, gallery review, Vision sections, and profile/workspace updates.
- A Next.js admin console for users, properties, billing, usage controls, provider management, worker/cleanup actions, and operational visibility.
- Shared packages for branding, config, prompts, types, validation, and utilities.
- Deployment docs and config for Cloud Run API deployment, MongoDB Atlas, Google Cloud Storage media, Netlify-hosted web/admin surfaces, and Secret Manager-based production secrets.

## Major Product Areas Completed

- Email/password auth with OTP verification, password reset, JWT sessions, profile editing, and account deletion.
- Property lifecycle: create, update, archive, restore, delete, dashboard snapshots, and multi-property seller support.
- Pricing analysis using RentCast plus AI narrative guidance, with cached/latest results and admin-controlled query safeguards.
- Photo upload/import, source metadata, categorization, seller picks, photo details, variation history, variant selection, delete/keep/save flows, and cleanup tooling.
- Vision/photo-readiness workflows for cleaning, furniture removal, wall/floor previews, style passes, and listing-oriented final outputs.
- Brochure, seller report, and social-pack generation, including selected photo and Vision-output usage.
- Stripe billing and entitlement checks, including plan summaries, checkout sessions, webhook handling, and admin billing views.
- Provider marketplace groundwork: provider onboarding, verification, billing sync, lead routing, provider portal, admin review, and Twilio SMS reply handling.
- Admin usage controls for pricing limits, free teaser resets, document history cleanup, and media variant cleanup.

## Current Architecture Reality

- MongoDB Atlas is the live database direction, not the older Prisma/Postgres plan.
- `apps/api` is still the operational center of the system; several `services/*` folders exist as future worker boundaries but are mostly placeholder/shell services today.
- Long-running AI/media/report flows are moving toward a shared job model with queued/running/completed/failed/cancelled states.
- Production media should use Google Cloud Storage because Cloud Run has an ephemeral filesystem.
- The repo has both `apps/*` and `current-apps/*`; the live development focus appears to be `apps/*`, with `current-apps/*` acting as a snapshot/reference copy.

## Recent Focus

- Added and refined the public chat/widget experience on the web app.
- Improved the onboarding process across recent commits.
- Strengthened deployment documentation for Cloud Run, MongoDB, Secret Manager, and GCS-backed media.
- Continued Vision reliability work, especially around furniture removal, wall/floor finish previews, fallback behavior, and listing-safe outputs.
- Improved pricing safeguards, cleanup tooling, diagnostics, and admin controls.

## Known Risks / Cleanup Targets

- The main web property workspace and mobile root screen are very large and should eventually be split into smaller, testable modules.
- Vision wall/floor edits can produce usable results but are still fragile, especially where mask fallback behavior fails or produces no-op/hallucinated outputs.
- Worker separation, observability, cancellation, and recovery need more hardening for heavy AI/media workloads.
- Some docs are older roadmap/spec material and no longer match the live Mongo/Fastify architecture. Prefer `docs/LIVE_SYSTEM.md` when docs conflict.
- The project has many docs and experimental notes; the product needs continued consolidation around the canonical seller workflow: onboarding, pricing, photos, checklist, providers, reports.

## Best Next Steps

- Keep `docs/LIVE_SYSTEM.md` as the source of truth and archive or mark superseded planning docs.
- Continue moving long-running Vision/report/document work out of direct API request paths and into worker-backed jobs.
- Refactor the largest web/mobile workspace files into focused components and hooks.
- Tighten production deployment: Cloud Run env/secrets, GCS media, health checks, logging, and admin cleanup operations.
- Prioritize dependable seller value over experimental image manipulation: pricing clarity, photo readiness, checklist guidance, provider coordination, and trustworthy reports.
