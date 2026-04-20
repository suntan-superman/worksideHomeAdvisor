# Workside Home Advisor - Complete End-to-End Execution Test Plan

Last updated: 2026-04-20  
Owner: QA + Engineering  
Applies to: `apps/web`, `apps/mobile`, `apps/api`, `apps/admin-web`

---

## 1. TEST STRATEGY OVERVIEW

### Scope

This plan validates production-critical behavior across:

- Seller journey (public funnel through pricing, photos, providers, deliverables, billing)
- Agent journey (agent signup, multi-property workflow, seller-facing outputs)
- Provider journey (signup, profile, billing, lead reception/response lifecycle)
- Admin operations (monitoring, moderation, billing diagnostics, cleanup, worker health)
- Cross-surface parity (web vs mobile)
- Integration correctness (Stripe, Twilio, OpenAI/Replicate, Google APIs)
- Data correctness in MongoDB and cross-collection consistency

### Environments

| Environment | Purpose | Data | Integrations | Notes |
|---|---|---|---|---|
| Local Dev | Fast feedback, schema/validation checks | Seeded + synthetic | Mostly mocked/console; optional sandbox keys | Use for developer smoke, not final signoff |
| Shared QA/Staging | Formal feature QA, integration validation | Resettable QA fixtures | Stripe test mode, Twilio test/sandbox number, OpenAI/Replicate non-prod keys, Google test keys | Primary pre-release validation environment |
| Pre-Prod Mirror (if available) | Deployment and migration confidence | Production-like anonymized datasets | Full integration wiring with test contracts | Use for release candidate validation |
| Production (guarded) | Post-deploy smoke only | Live | Live | Restrict to low-risk synthetic probes |

### Test Types

- Manual E2E: role-based guided journeys, visual confirmation, UX quality, error messaging
- API Integration: endpoint contracts, status codes, schema validation, idempotency, auth/rate limits
- Database Verification: expected writes, updates, relationships, lifecycle state transitions
- Integration Contract: webhook verification, third-party timeout/fallback behavior
- Regression: release checklist run before each deploy
- Exploratory: high-risk areas (vision orchestration, async jobs, billing state transitions)

### Required Observability During Test Execution

- API logs (local terminal or Cloud Run logs)
- MongoDB inspection (Compass or shell) for key collections:
  - `User`, `PasswordResetToken`
  - `Property`, `PricingAnalysis`, `PropertyChecklist`
  - `MediaAsset`, `MediaVariant`, `ImageJob`, `Job`
  - `Flyer`, `Report`, `SocialPack`
  - `Provider`, `LeadRequest`, `LeadDispatch`, `ProviderResponse`, `ProviderReference`, `ProviderSmsLog`, `SmsLog`
  - `BillingSubscription`, `BillingWebhookEvent`
  - `PublicFunnelEvent`, `UsageTracking`, `RateLimitEvent`, `PricingQueryPolicy`, `PricingPropertyUsage`, `AnalysisLock`
- Stripe dashboard (test mode)
- Twilio console (messages, webhook requests, status callbacks)
- OpenAI/Replicate request telemetry where available

### Entry Criteria

- Environment deployed and reachable
- Baseline seed data loaded
- Integration keys configured for intended test scope
- Test users/roles provisioned
- Known blockers documented

### Exit Criteria

- All Critical and High tests pass
- No open blockers in auth, pricing, media upload, async jobs, billing, provider lead routing
- No data integrity defects across primary collections
- Regression checklist complete with signed evidence

---

## 2. ROLE-BASED TEST MATRICES

### SELLER

| Test ID | Preconditions | Test Flow | Expected Outcomes | Failure Conditions |
|---|---|---|---|---|
| S-01 | Public web entry available | Generate seller preview from landing | Preview returned with range/readiness + attribution captured | 4xx schema errors, no `PublicFunnelEvent`, wrong attribution defaults |
| S-02 | New seller email | Signup -> verify email OTP -> login | Account created; role `seller`; session token issued | OTP mismatch loops, missing email delivery, invalid token/session |
| S-03 | Verified seller user | Create property via web intake | Property created and visible in dashboard list | Duplicate create, missing owner mapping, malformed property facts |
| S-04 | Existing property | Run pricing analysis and set list price decision | Pricing snapshot stored; decision saved and reflected in UI | 402/429 mishandled, stale data shown as fresh, decision not persisted |
| S-05 | Property with photos | Upload photos, run vision enhancement, select variant | Variant generated, selectable, save-to-photos works | Long-running job deadlock, no cancel/retry path, blank/failed compare state |
| S-06 | Provider categories seeded | Request providers + send lead | Lead dispatch created; outbound SMS/email attempts logged | Lead created without dispatch, Twilio errors swallowed, no user feedback |
| S-07 | Pricing + media available | Generate report/flyer/social pack | Deliverables created or queued; exports downloadable | Job never completes, stale exports, missing selected photos/sections |
| S-08 | Billing plan configured | Start checkout and sync session | Subscription status updates correctly in summary | Checkout success UI without backend state sync, webhook mismatch |

### AGENT (REALTOR)

| Test ID | Preconditions | Test Flow | Expected Outcomes | Failure Conditions |
|---|---|---|---|---|
| A-01 | New agent email | Signup -> OTP verify -> login | User role `agent`; agent dashboard/workflow enabled | Agent role downgraded to seller, OTP routing broken |
| A-02 | Agent user + property permission | Create property for client context | Property created and linked to agent owner | Owner/role mismatch, inaccessible property workspace |
| A-03 | Property has pricing/media | Generate seller-facing report and flyer | Output tone/sections reflect presentation use | Missing pricing context, export fails, branding fields ignored |
| A-04 | Multiple properties exist | Switch between properties and refresh workflow | Isolation maintained per property; no cross-leakage | Data bleed across properties, wrong snapshot loaded |
| A-05 | Agent branding inputs present | Use export flow for listing presentation | Downloadable assets and consistent visual content | Broken downloads, stale cached assets, wrong property in export |

### PROVIDER

| Test ID | Preconditions | Test Flow | Expected Outcomes | Failure Conditions |
|---|---|---|---|---|
| P-01 | New provider + optional existing auth | Provider signup flow | Provider profile created; portal token/session issued | Requires fields not validated clearly, duplicate account collisions |
| P-02 | Provider with pending billing | Start Stripe checkout and sync | Subscription status transitions to active state | Stuck in `checkout_created`, sync endpoint mismatch |
| P-03 | Provider with portal token | Update profile and upload verification docs | Profile changes saved; doc retrievable by file endpoint | Token auth bypass, file upload corruption, missing metadata |
| P-04 | Provider lead dispatch exists | Receive SMS lead and respond accepted/declined | Lead lifecycle transitions captured end-to-end | Signature verification false negatives, response not persisted |
| P-05 | Provider moderation scenario | Submit verification and await review | Correct review status transitions visible in portal/admin | Invalid state transitions, review status inconsistency |

### ADMIN

| Test ID | Preconditions | Test Flow | Expected Outcomes | Failure Conditions |
|---|---|---|---|---|
| AD-01 | Admin account exists | Admin login with main auth credentials | Access granted only for `admin/super_admin` roles | Non-admin access allowed, session cookie not persisted |
| AD-02 | System has data | Open overview/users/properties pages | Metrics and lists load with coherent counts | Null/partial responses, dashboard cards misleading |
| AD-03 | Billing activity exists | Inspect `/admin/billing` snapshot | Subscription and webhook summaries accurate | Missed failed webhooks, stale sync diagnostics |
| AD-04 | Media variants exist | View media variants + run cleanup | Cleanup removes only eligible variants | Selected/active variants deleted accidentally |
| AD-05 | Provider ops needed | Review provider, link account, sync billing | Admin actions reflected in provider state | Account-link conflicts, destructive action without confirmation |
| AD-06 | Lead requests exist | Resend/close provider leads | Lead action audit trail and state transitions correct | Duplicate notifications, invalid close state |

---

## 3. FULL END-TO-END FLOWS (STEP-BY-STEP)

### SELLER FLOW

#### Step 1 - Public funnel entry

| Field | Details |
|---|---|
| UI actions | Open landing page (`/`, `/sell`, or campaign URL), confirm page content and CTA render. |
| API calls involved | Optional tracking path through `POST /api/v1/public/events`. |
| Expected DB changes | `PublicFunnelEvent` insert if tracking is enabled. |
| Expected UI state | Landing loads with no auth requirement and stable CTA behavior. |
| Edge cases | Campaign params missing; malformed UTM/ad params; direct traffic. |
| Failure handling | Show graceful UI without blocking access; log event errors without crash. |

#### Step 2 - Address input

| Field | Details |
|---|---|
| UI actions | Submit property preview form fields (address, city, state, zip, property facts). |
| API calls involved | `POST /api/v1/public/seller-preview` |
| Expected DB changes | `PublicFunnelEvent` event `seller_preview_generated` with attribution + preview context. |
| Expected UI state | Preview readiness score and estimated range displayed; continue CTA enabled. |
| Edge cases | Invalid zip/state, very small/large square footage, unsupported property type value. |
| Failure handling | Form validation errors inline; non-blocking retry option. |

#### Step 3 - Signup (email + OTP)

| Field | Details |
|---|---|
| UI actions | Continue from preview, complete signup form, submit OTP, then login. |
| API calls involved | `POST /api/v1/public/continue-signup`, `POST /api/v1/auth/signup`, `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/login` |
| Expected DB changes | New `User`; OTP artifacts and verification state updates; optional `PublicFunnelEvent` entries. |
| Expected UI state | “Account created” -> OTP form -> verified session -> routed to dashboard. |
| Edge cases | Existing email, wrong OTP, expired OTP, repeated resend requests, attribution values empty. |
| Failure handling | Clear error toasts, resend OTP path, no account duplication. |

#### Step 4 - Property creation

| Field | Details |
|---|---|
| UI actions | Create first property from dashboard/intake form. |
| API calls involved | `POST /api/v1/properties` |
| Expected DB changes | New `Property` with `ownerUserId`, attribution payload normalization, lifecycle defaults. |
| Expected UI state | Property appears in property list and selected workspace opens. |
| Edge cases | Missing optional facts (beds/baths/sqft), duplicate title/address attempt. |
| Failure handling | Validation errors surfaced; no orphan property records. |

#### Step 5 - Dashboard load

| Field | Details |
|---|---|
| UI actions | Open property dashboard/workspace and refresh data panels. |
| API calls involved | `GET /api/v1/properties/:propertyId/dashboard`, `GET /api/v1/properties/:propertyId/full` |
| Expected DB changes | Read-only for standard load. |
| Expected UI state | Pricing summary, checklist state, media summary, next-step guidance visible. |
| Edge cases | No pricing yet, no checklist yet, archived property. |
| Failure handling | Empty-state messaging with next actionable step. |

#### Step 6 - Pricing analysis

| Field | Details |
|---|---|
| UI actions | Click “Refresh pricing” and wait for result. |
| API calls involved | `POST /api/v1/properties/:propertyId/pricing/analyze`, `GET /api/v1/properties/:propertyId/pricing/latest` |
| Expected DB changes | New `PricingAnalysis` or cached response metadata; usage updates in `UsageTracking` and pricing-policy collections. |
| Expected UI state | Range/strategy/confidence + comp list shown; selected list price controls enabled. |
| Edge cases | Cached return branch, rate-limit branch, upgrade-required branch. |
| Failure handling | 402/429 messaging includes action guidance; no silent failure. |

#### Step 7 - Pricing explanation visibility

| Field | Details |
|---|---|
| UI actions | Open Pricing tab and verify narrative explanation + comp details + selection controls. |
| API calls involved | `GET /api/v1/properties/:propertyId/dashboard`, `GET /api/v1/properties/:propertyId/pricing/latest`, `PATCH /api/v1/properties/:propertyId/pricing-decision` |
| Expected DB changes | `Property.selectedListPrice` + `selectedListPriceSource` updated on save. |
| Expected UI state | Decision sticks after refresh and appears in report/flyer defaults. |
| Edge cases | Custom value outside suggested range, no prior analysis. |
| Failure handling | Block invalid decision saves, preserve previous good value. |

#### Step 8 - Photo upload (web + mobile)

| Field | Details |
|---|---|
| UI actions | Web: upload/select image. Mobile: capture camera + gallery import via Expo ImagePicker. |
| API calls involved | `POST /api/v1/properties/:propertyId/media`, `GET /api/v1/properties/:propertyId/media` |
| Expected DB changes | New `MediaAsset` per upload with room label, analysis metadata, source (`web_upload`, `mobile_capture`, `mobile_library`). |
| Expected UI state | New asset appears in gallery and is selectable. |
| Edge cases | Permission denied on mobile, upload cancel, oversized payload, unsupported mime type. |
| Failure handling | Retryable error messaging; no partial “ghost” media card. |

#### Step 9 - Photo analysis

| Field | Details |
|---|---|
| UI actions | Trigger or review photo analysis output for uploaded image. |
| API calls involved | `POST /api/v1/properties/:propertyId/media/analyze-photo` (direct analysis path) and analysis metadata from media create path. |
| Expected DB changes | Analysis details linked on `MediaAsset.analysis`. |
| Expected UI state | Quality/readiness cues update and can influence recommendation order. |
| Edge cases | Low-resolution images, dark photos, non-room imagery. |
| Failure handling | Show analysis unavailable warning but keep source image usable. |

#### Step 10 - Vision enhancement (jobs, polling, cancel, retry)

| Field | Details |
|---|---|
| UI actions | Generate preset/freeform enhancement, monitor progress, optionally cancel and retry. |
| API calls involved | `POST /api/v1/media/assets/:assetId/vision/enhance` (web) or `POST /api/v1/media/assets/:assetId/enhance` (mobile), `GET /api/v1/vision/jobs/:jobId`, `PATCH /api/v1/vision/jobs/:jobId/cancel`, `GET /api/v1/media/assets/:assetId/vision/variants`, `PATCH /api/v1/media/assets/:assetId/variants/:variantId/select` |
| Expected DB changes | `ImageJob`/`Job` status lifecycle (`queued`, `running`, `reconnecting`, `completed`, `failed`, `cancelled`), new `MediaVariant` records, selected variant flags. |
| Expected UI state | Progress card/timer updates, final compare view appears, selected variant persists. |
| Edge cases | >60s processing, browser disconnect, provider fallback path, warning-only result, no-strong-change result. |
| Failure handling | Deterministic error toast, cancel button effectiveness, retry from same source image. |

#### Step 11 - Checklist interaction

| Field | Details |
|---|---|
| UI actions | Toggle checklist item states and add custom tasks. |
| API calls involved | `GET /api/v1/properties/:propertyId/checklist`, `POST /api/v1/properties/:propertyId/checklist/items`, `PATCH /api/v1/checklist-items/:itemId` |
| Expected DB changes | `PropertyChecklist` item statuses/notes updated. |
| Expected UI state | Readiness progress and checklist grouping update immediately or after refresh. |
| Edge cases | Empty custom task title, rapid status toggles, simultaneous edits in two tabs. |
| Failure handling | Reject invalid updates with clear message; preserve prior status if save fails. |

#### Step 12 - Provider recommendations

| Field | Details |
|---|---|
| UI actions | Open providers tab, filter category/task, inspect provider map/list, save provider reference. |
| API calls involved | `GET /api/v1/provider-categories`, `GET /api/v1/properties/:propertyId/providers`, `GET /api/v1/properties/:propertyId/provider-map`, `POST /api/v1/properties/:propertyId/providers/:providerId/save`, `GET/POST /api/v1/properties/:propertyId/provider-references` |
| Expected DB changes | Saved providers and references in `SavedProvider`/`ProviderReference`; optional analytics updates. |
| Expected UI state | Ranked providers visible; source labeling (`internal` vs Google fallback) visible. |
| Edge cases | No internal providers, Google key missing, includeExternal toggled. |
| Failure handling | Fallback diagnostics shown, recommendations still render safely. |

#### Step 13 - Provider contact / SMS routing

| Field | Details |
|---|---|
| UI actions | Submit provider lead request from property workflow; provider receives SMS and can respond. |
| API calls involved | `POST /api/v1/properties/:propertyId/provider-leads`, `GET /api/v1/properties/:propertyId/provider-leads`, Twilio webhooks `POST /api/v1/twilio/sms/inbound` and `POST /api/v1/twilio/sms/status` |
| Expected DB changes | `LeadRequest`, `LeadDispatch`, `ProviderSmsLog`, `SmsLog`, `ProviderResponse` state transitions. |
| Expected UI state | Seller sees lead status progression; provider portal reflects dispatch/response. |
| Edge cases | Signature mismatch, unreachable provider number, STOP/opt-out style replies. |
| Failure handling | Dispatch failure surfaced and recoverable (resend/close actions available in admin). |

#### Step 14 - Report generation

| Field | Details |
|---|---|
| UI actions | Configure report draft fields, generate report, preview, export PDF. |
| API calls involved | `POST /api/v1/properties/:propertyId/report/generate`, `GET /api/v1/properties/:propertyId/report/latest`, `GET /api/v1/properties/:propertyId/report/export.pdf`, optional `GET /api/v1/jobs/:jobId` |
| Expected DB changes | New `Report` document (or cached return metadata); job entry when queued path used. |
| Expected UI state | Report preview appears with selected sections/photos and freshness metadata. |
| Edge cases | Cached return branch, queued job branch, stale pricing/media references. |
| Failure handling | Job failures report actionable error; export only allowed when report available. |

#### Step 15 - Flyer generation

| Field | Details |
|---|---|
| UI actions | Configure flyer mode (sale/rental), customize content, generate, preview, export PDF. |
| API calls involved | `POST /api/v1/properties/:propertyId/flyer/generate`, `GET /api/v1/properties/:propertyId/flyer/latest`, `GET /api/v1/properties/:propertyId/flyer/export.pdf`, optional `GET /api/v1/jobs/:jobId` |
| Expected DB changes | New `Flyer` document (or cached return metadata); job entry for queued generation path. |
| Expected UI state | Flyer preview with selected photos/listing notes and pricing signals. |
| Edge cases | No selected photos, too many selected photos, cooldown/rate limit path. |
| Failure handling | Friendly failure and retry path; no broken download links. |

#### Step 16 - Social pack generation

| Field | Details |
|---|---|
| UI actions | Trigger social pack generation and inspect latest output. |
| API calls involved | `POST /api/v1/properties/:propertyId/marketing/social-pack`, `GET /api/v1/properties/:propertyId/marketing/social-pack/latest` |
| Expected DB changes | New `SocialPack` entry. |
| Expected UI state | Caption/headline/hash-tag style content appears in marketing section. |
| Edge cases | Missing property context fields; stale pricing references. |
| Failure handling | Message identifies generation failure without breaking workspace navigation. |

#### Step 17 - Billing / upgrade flow

| Field | Details |
|---|---|
| UI actions | Open plans, initiate checkout, complete/abort checkout, return to app, sync status. |
| API calls involved | `GET /api/v1/billing/plans`, `POST /api/v1/billing/checkout-session`, `POST /api/v1/billing/sync-session`, Stripe webhook to `POST /api/v1/billing/webhook`, `GET /api/v1/billing/summary/:userId` |
| Expected DB changes | `BillingSubscription` and `BillingWebhookEvent` inserts/updates with Stripe identifiers and status transitions. |
| Expected UI state | Plan/entitlement state updates after webhook or sync call. |
| Edge cases | Successful Stripe checkout but delayed webhook, failed async payment, expired session. |
| Failure handling | Sync endpoint recovers state; UI clearly indicates pending vs active. |

#### Step 18 - Returning session behavior

| Field | Details |
|---|---|
| UI actions | Refresh browser/app, re-open later, return to last property/workspace context. |
| API calls involved | `POST /api/v1/auth/login` (if needed), `GET /api/v1/auth/me`, `GET /api/v1/properties`, workspace fetch calls (`dashboard`, `workflow`, `media`, `checklist`). |
| Expected DB changes | Read-only unless user performs edits; no duplicate writes on restore. |
| Expected UI state | Session continuity with expected re-auth prompts on expiry. |
| Edge cases | Token expiration mid-workflow, stale local state, archived property resume. |
| Failure handling | Redirect to login with context-friendly messaging; avoid data loss in drafts where applicable. |

---

### AGENT FLOW

#### Flow A1 - Signup + onboarding

| Field | Details |
|---|---|
| UI actions | Sign up as `agent`, verify OTP, log in via `/auth`. |
| API calls involved | `POST /api/v1/auth/signup`, `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/login` |
| Expected DB changes | `User.role = agent`; verification flags true. |
| Expected UI state | Agent route/workflow copy shown in auth/dashboard. |
| Edge cases | Existing seller account trying to switch role. |
| Failure handling | Explicit role conflict guidance and corrective action path. |

#### Flow A2 - Property creation for client

| Field | Details |
|---|---|
| UI actions | Create property and open workspace as agent. |
| API calls involved | `POST /api/v1/properties`, `GET /api/v1/properties/:id/full`, `GET /api/v1/properties/:id/workflow?role=agent` |
| Expected DB changes | `Property` owner linkage to agent user. |
| Expected UI state | Agent-focused next-step recommendations and pricing guidance. |
| Edge cases | Multiple active properties with rapid switching. |
| Failure handling | Preserve property isolation and selected context. |

#### Flow A3 - Report generation for listing presentation

| Field | Details |
|---|---|
| UI actions | Generate report and flyer with seller-facing messaging. |
| API calls involved | Report/flyer generation and export endpoints under `/api/v1/properties/:id/*`. |
| Expected DB changes | `Report` and `Flyer` created/updated with customizations. |
| Expected UI state | Presentation-ready outputs download and preview correctly. |
| Edge cases | Missing selected photos, pricing not run yet. |
| Failure handling | Actionable prompts to run prerequisite steps first. |

#### Flow A4 - Multi-property management

| Field | Details |
|---|---|
| UI actions | Navigate among 3+ properties, refresh each, verify independent state. |
| API calls involved | Repeated property/dashboard/workflow/media/report calls by property ID. |
| Expected DB changes | No cross-property writes unless explicitly edited. |
| Expected UI state | Correct property title/address and data in all tabs. |
| Edge cases | Browser back/forward navigation race conditions. |
| Failure handling | Force-safe refetch on property switch when stale context detected. |

#### Flow A5 - Branding/export usage + seller-facing presentation flow

| Field | Details |
|---|---|
| UI actions | Customize narrative fields, export PDF assets, present side-by-side with source data. |
| API calls involved | Report/flyer/social-pack latest + export endpoints. |
| Expected DB changes | Output versions increment and persist latest references. |
| Expected UI state | Agent can deliver clean assets without internal-only metadata leakage. |
| Edge cases | Old cached report shown after new generation request. |
| Failure handling | Latest version and freshness labels visible and trustworthy. |

---

### PROVIDER FLOW

#### Flow P1 - Provider signup

| Field | Details |
|---|---|
| UI actions | Complete provider join flow including business and compliance fields. |
| API calls involved | `POST /api/v1/provider-portal/signup` |
| Expected DB changes | `Provider` created with initial status (`pending_billing`), optional linked `User` and OTP requirement for new account path. |
| Expected UI state | Provider receives clear next steps for billing and verification. |
| Edge cases | Existing auth account, existing provider email, incomplete required fields. |
| Failure handling | Reject duplicates clearly without partial profile artifacts. |

#### Flow P2 - Verification

| Field | Details |
|---|---|
| UI actions | Upload verification docs and submit verification. |
| API calls involved | `POST /api/v1/provider-portal/providers/:providerId/verification-documents`, `POST /api/v1/provider-portal/providers/:providerId/verification/submit`, file retrieval endpoint for validation |
| Expected DB changes | Provider verification metadata/document references updated. |
| Expected UI state | Verification status progression shown in provider portal and admin. |
| Edge cases | Unsupported mime types, oversized base64 payloads. |
| Failure handling | Validation error plus retry guidance per document type. |

#### Flow P3 - Profile setup

| Field | Details |
|---|---|
| UI actions | Update service area, highlights, contact preferences, compliance fields. |
| API calls involved | `PATCH /api/v1/provider-portal/providers/:providerId/profile` |
| Expected DB changes | Provider profile fields updated atomically. |
| Expected UI state | Persisted values visible on refresh and reflected in provider discovery ranking inputs. |
| Edge cases | Invalid state/zip formats, contradictory contact settings. |
| Failure handling | Block invalid save and preserve previous valid profile. |

#### Flow P4 - Billing

| Field | Details |
|---|---|
| UI actions | Start provider checkout and return to portal; run sync if needed. |
| API calls involved | `POST /api/v1/provider-portal/billing/checkout`, `POST /api/v1/provider-portal/billing/sync-session`, Stripe webhook endpoint |
| Expected DB changes | Provider subscription fields (`stripeCustomerId`, `stripeCheckoutSessionId`, etc.) and status transitions updated. |
| Expected UI state | Billing status reflects active/pending accurately. |
| Edge cases | Checkout abandoned, asynchronous payment pending. |
| Failure handling | Admin/provider sync endpoints recover stale state. |

#### Flow P5 - Lead reception + response + lifecycle tracking

| Field | Details |
|---|---|
| UI actions | Receive lead via SMS/email, respond accepted/declined from portal or SMS reply. |
| API calls involved | Seller lead creation endpoint, portal response endpoint, Twilio inbound/status callbacks |
| Expected DB changes | `LeadRequest`/`LeadDispatch`/`ProviderResponse` status updates and `ProviderSmsLog` records. |
| Expected UI state | Provider lead queue updates in near real-time and historical tracking visible. |
| Edge cases | Duplicate Twilio callbacks, out-of-order status webhooks, invalid signature. |
| Failure handling | Idempotent status handling and robust signature enforcement (403 on invalid). |

---

### ADMIN FLOW

#### Flow AD1 - Admin login

| Field | Details |
|---|---|
| UI actions | Login via admin web login screen and verify role-gated access. |
| API calls involved | Admin web auth proxy calls plus underlying `/api/v1/auth/login`; admin endpoints guarded by admin session hook. |
| Expected DB changes | Session cookie/token state only. |
| Expected UI state | Non-admin blocked, admin routed to overview. |
| Edge cases | OTP-required account, timed-out admin session. |
| Failure handling | Clear remediations (verify in main app first). |

#### Flow AD2 - Dashboard metrics + user/property inspection

| Field | Details |
|---|---|
| UI actions | Open overview, users, properties, funnel, workers pages. |
| API calls involved | `/api/v1/admin/overview`, `/users`, `/properties`, `/funnel`, `/workers` |
| Expected DB changes | Read-only under normal inspection. |
| Expected UI state | Coherent metric totals and list snapshots. |
| Edge cases | Empty datasets, partial integration outage. |
| Failure handling | Error notices instead of blank UI. |

#### Flow AD3 - Pricing diagnostics and policy

| Field | Details |
|---|---|
| UI actions | Inspect and update pricing query policy. |
| API calls involved | `GET /api/v1/admin/pricing-query-policy`, `PATCH /api/v1/admin/pricing-query-policy` |
| Expected DB changes | `PricingQueryPolicy` updated with auditable values. |
| Expected UI state | Updated limits reflected in subsequent user pricing behavior. |
| Edge cases | Invalid boundary values. |
| Failure handling | Schema validation errors prevent invalid policy writes. |

#### Flow AD4 - Media cleanup

| Field | Details |
|---|---|
| UI actions | Inspect variant inventory, run cleanup command from admin endpoint. |
| API calls involved | `GET /api/v1/admin/media/variants`, `POST /api/v1/admin/media/cleanup-variants` |
| Expected DB changes | Cleanup-eligible variant records removed according to policy without deleting selected/persistent records. |
| Expected UI state | Updated counts and cleanup summary visible. |
| Edge cases | Concurrent generation while cleanup runs. |
| Failure handling | Cleanup safe-guards prevent deleting active/currently selected variants. |

#### Flow AD5 - Provider moderation + billing inspection + worker inspection

| Field | Details |
|---|---|
| UI actions | Review provider, link account, sync billing, resend/close lead, inspect billing and worker health. |
| API calls involved | `/api/v1/admin/providers*`, `/api/v1/admin/provider-leads*`, `/api/v1/admin/billing`, `/api/v1/admin/workers` |
| Expected DB changes | Provider review states, linked user metadata, lead resolution updates, billing sync metadata updates. |
| Expected UI state | Operational controls reflect state changes quickly and safely. |
| Edge cases | Provider/user email mismatch, stale Stripe session IDs. |
| Failure handling | Strong error payloads and no destructive side effects on failed actions. |

---

## 4. INTEGRATION TESTING

### STRIPE

#### Checkout

- Validate seller and provider checkout session creation with correct plan metadata.
- Confirm success/cancel URLs and session ID returned.
- Verify session-to-user/provider linkage is persisted.

#### Webhook handling

- Send signed `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
- Validate signature rejection path for invalid `stripe-signature`.
- Confirm idempotent processing for duplicate event IDs.

#### Subscription state sync

- Validate `POST /api/v1/billing/sync-session` and provider sync endpoint reconcile delayed webhook states.
- Confirm `BillingSubscription` and provider subscription fields are aligned.

#### Failure scenarios

- Stripe API unavailable during checkout creation.
- Webhook arrives before local checkout response is consumed.
- Payment fails after frontend optimistic success message.

### TWILIO

#### Outbound SMS

- Trigger provider lead request and verify outbound request to Twilio with expected To/From/body.
- Confirm `ProviderSmsLog`/`SmsLog` records include message SID.

#### Inbound replies

- Simulate inbound webhook with valid signature.
- Validate dispatch mapping and response creation (`accepted`/`declined`).

#### Webhook status callbacks

- Simulate delivered/failed/undelivered callbacks.
- Confirm status transitions and error-code persistence.
- Confirm invalid signature returns 403 XML response and no DB mutation.

### OPENAI / REPLICATE

#### Response success

- Validate successful text workflows (`/api/v1/ai/workflows`) and vision jobs produce usable outputs.
- Confirm selected provider chain behavior for presets.

#### Malformed responses

- Inject malformed payload or missing image URL path in test harness.
- Verify robust error surface and no broken variant insertion.

#### Timeout handling

- Simulate long response times and gateway timeouts.
- Validate job state transitions to failed/reconnecting and UI retry/cancel controls.

#### Fallback behavior

- Force primary provider failure; validate fallback provider path and warning metadata.
- Confirm “warning” outputs are labeled and not silently treated as listing-ready without criteria.

### GOOGLE APIs

#### Geocoding

- Validate property/provider geocoding request success and normalized coordinates.
- Test invalid/ambiguous address behavior.

#### Provider discovery fallback

- When internal provider results are empty, validate Google fallback search appears with source labeling.
- Validate behavior when Google keys are missing (diagnostic and safe degradation).

---

## 5. MOBILE-SPECIFIC TESTS

### Camera capture

- Permission prompt first-run and denied-state handling.
- Capture image and verify base64 payload integrity.
- Save captured photo to selected property.

### Gallery import

- Library permission handling.
- Import high-resolution and low-resolution images.
- Confirm imported source metadata (`mobile_library`) persists.

### Upload reliability

- Simulate unstable network during upload.
- Ensure retry path does not duplicate assets.
- Confirm no half-created `MediaAsset` records.

### Background/resume behavior

- Trigger enhancement generation and background app.
- Resume app and verify query invalidation refreshes state without crash.
- Confirm session continuity and auth mode recovery.

### Network interruption handling

- Lose connectivity during login, OTP verify, and photo save.
- Validate user-friendly error and retained form data where possible.

### Job polling reliability

- Generate vision job and verify state updates while app remains open.
- Test manual refresh behavior after reconnect.
- Validate cancel/selection actions remain stable after delayed responses.

---

## 6. FAILURE & EDGE CASES (CRITICAL)

| Scenario | What to validate | Expected safe behavior |
|---|---|---|
| Slow AI jobs (>60s) | Job state progression + UI elapsed-time messaging | User sees progress, can cancel, no frozen loading state |
| Job failure mid-process | Variant generation error path | Clear error toast/status, no corrupt selected variant |
| Duplicate submissions | Double-click submit for signup/checkout/generate | Idempotent behavior or dedupe guard; no duplicate records |
| Network drop during upload | Interrupt media create request | No partial unusable media record; retry supported |
| Partial data saves | Failure during multi-step generation flows | Atomic updates or compensating cleanup on failure |
| Billing failure after success UI | Stripe async payment fail after return | UI corrected via webhook/sync; no false “active” entitlement |
| SMS delivery failure | Twilio status callback with failure | Dispatch status and admin diagnostics updated |
| Webhook delays | Stripe/Twilio events delayed or out-of-order | Sync/reconcile endpoints recover consistency |
| Invalid Twilio signature | Fake webhook attempt | 403 response and zero business state mutation |
| OTP abuse attempts | Repeated OTP/reset requests | Rate limits with `Retry-After` and no service degradation |
| Archived property mutation attempts | Try edits on archived property | Mutations blocked, read-only state communicated |
| Cross-tenant access risk | Attempt to read/update other owner property via ID | Access denied and no data leakage |

---

## 7. AUTOMATION PLAN

### What should be automated first

- Auth contract tests (signup/login/OTP/reset + rate limits)
- Property CRUD and ownership guardrails
- Pricing analyze contract branches (fresh, cached, 402, 429)
- Media upload + vision job lifecycle API tests (queued/running/completed/failed/cancelled)
- Checklist and provider lead endpoints
- Billing webhook signature/idempotency handling
- Admin authorization gates

### What should remain manual

- Visual quality and UX acceptability of generated images
- Seller/agent presentation quality for report/flyer copy
- Mobile camera/gallery real-device behavior across OS versions
- End-to-end third-party console verification (Stripe/Twilio dashboards)

### Suggested tooling

- Web UI: Playwright
  - Auth, dashboard, pricing, media workflow, report/flyer/social pack smoke suites
- Mobile UI: Detox
  - Login, property selection, capture/import, save photo, generate enhancement, checklist updates
- API: Supertest (or Fastify inject for module-level speed)
  - Route contract tests, auth errors, role guards, webhook signature validation, idempotency
- Contract mocks:
  - Stripe CLI/webhook fixtures
  - Twilio webhook fixture payloads + signature test harness
  - Mock OpenAI/Replicate adapters for deterministic CI

### CI execution tiers

- Tier 1 (PR): API contracts + unit tests + lightweight Playwright smoke
- Tier 2 (nightly): full Playwright + Detox + integration-contract suite
- Tier 3 (release candidate): staging E2E with sandbox third-party integrations

---

## 8. TEST DATA STRATEGY

### Seed data requirements

- Users:
  - Seller verified/unverified
  - Agent verified
  - Provider with pending billing, active billing, and rejected verification
  - Admin and super-admin users
- Properties:
  - Fresh property (no pricing/media)
  - Property with pricing only
  - Property with pricing + media + variants + deliverables
  - Archived property
- Providers:
  - Internal providers across categories
  - Sparse category for Google fallback testing
- Billing:
  - Active, past_due, incomplete, cancelled subscriptions
- Leads:
  - Open, responded, closed lead requests

### Mock vs real integrations

- Local:
  - Mock OpenAI/Replicate/Google where practical
  - Stripe/Twilio optional or sandbox only
- Staging:
  - Stripe test mode required
  - Twilio test/sandbox number required
  - OpenAI/Replicate real non-prod keys recommended for realistic latency/fallback behavior
  - Google server key required for map/discovery fallback tests

### Sandbox environments and data hygiene

- Use deterministic naming conventions (`qa-seller-001`, `qa-agent-001`, etc.).
- Rotate and purge stale media variants using cleanup scripts/endpoints.
- Reset key collections between test cycles where repeatability is needed.
- Preserve one long-lived “soak” dataset for regression over time.

---

## 9. REGRESSION CHECKLIST

Run this checklist for every release candidate:

1. Auth
- Seller signup, OTP verify, login, forgot-password reset
- Agent login path
- Provider portal session creation
- Admin login role gating

2. Seller core workflow
- Create property
- Dashboard/workflow load
- Pricing analyze + list price decision save
- Checklist update + custom task create

3. Media and vision
- Web upload + mobile upload
- Generate preset enhancement
- Generate freeform enhancement
- Job polling and cancel
- Variant select + save-to-photos

4. Providers
- Provider list + map load
- Lead request creation
- Twilio inbound reply and status callback processed

5. Deliverables
- Generate flyer + export
- Generate report + export
- Generate social pack
- Provider reference sheet export

6. Billing
- List plans
- Create checkout session
- Simulate webhook success/failure
- Run sync-session reconciliation
- Verify entitlement update in UI

7. Admin operations
- Overview/users/properties snapshots
- Billing and usage snapshots
- Media variant cleanup dry-run/live action
- Provider review/link/sync actions
- Provider lead resend/close actions

8. Reliability guardrails
- Rate-limit messaging paths
- Archived property edit protection
- 404/400 error handling consistency
- Session timeout/re-auth path

9. Final signoff evidence
- Capture API logs for critical journeys
- Capture DB state diffs for major workflows
- Capture third-party dashboard proofs (Stripe/Twilio)
- Attach pass/fail matrix and open risk list
