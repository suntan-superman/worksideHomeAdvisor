# Workside Home Advisor
## Stripe-Integrated Usage Safeguards + Admin Dashboard + Analytics Dashboard Spec (Codex-Ready)

Last Updated: 2026-03-27

---

# 1. Purpose

This document extends the usage safeguards system and adds three critical layers:

1. **Stripe integration**
   - usage and plan enforcement tied directly to billing/subscription state
   - upgrade/downgrade behavior
   - monetization-aware limit handling

2. **Admin dashboard layout**
   - configurable controls for cooldowns, quotas, overrides, abuse review, and operational visibility

3. **Analytics dashboard layout**
   - visibility into cost, usage, conversion, abuse signals, cache performance, and pricing behavior

This spec is intended for Codex implementation in the Workside Home Advisor monorepo.

---

# 2. Strategic Goals

The system must do four things at once:

1. protect external API spend (RentCast, OpenAI, etc.)
2. enforce fair use by plan
3. support Stripe monetization and upgrades
4. give Workside clear operational visibility

The platform should feel:
- fast
- fair
- explainable
- premium

It should NOT feel:
- arbitrary
- punitive
- confusing
- broken

---

# 3. Core Safeguard Model

## 3.1 Cooldown by analysis type

Expensive operations should have cooldown windows.

Examples:
- pricing analysis: 24 hours
- photo analysis: 12 hours
- flyer generation: 1 hour
- marketing copy generation: 6 hours
- timing guidance: 24 hours
- improvement analysis: 24 hours

If a user requests the same analysis within the cooldown:
- return the latest successful result
- include metadata that it was served from cache
- do not call RentCast or OpenAI again unless explicitly permitted by policy

---

## 3.2 Monthly usage quotas by plan

Usage should be enforced by **unique properties analyzed** within a billing cycle, not just raw clicks.

### Example plan defaults
- Seller Free: 1 property/month
- Seller Plus: 3 properties/month
- Agent Starter: 10 properties/month
- Agent Pro: 30 properties/month
- Agent Team: 100 properties/month

Optional additional limits:
- photo analyses/month
- flyer exports/month
- document generations/month
- API-heavy refreshes/month

---

## 3.3 Rate limiting

Short-window protection should exist regardless of plan.

Recommended defaults:
- 5 analysis attempts per minute
- 20 analysis attempts per hour
- 100 total analysis attempts per day absolute cap
- 10 auth/email actions per hour

---

## 3.4 Duplicate job prevention

When an analysis job is already running for the same:
- property
- analysis type
- normalized input hash

Then:
- do not enqueue another identical job
- return current job state or last completed result

---

# 4. Stripe Integration (Critical)

## 4.1 Why Stripe must be tied into safeguards

Usage safeguards should not exist independently from billing.

They should enforce:
- what plan the user is on
- what features the plan includes
- what quotas apply
- when to offer upgrade paths

This is where safeguards become a business system, not just a protective system.

---

## 4.2 Required Stripe-backed concepts

Codex should implement a `subscriptions` collection in MongoDB that mirrors Stripe state.

### subscriptions collection
```json
{
  "_id": "sub_001",
  "userId": "usr_123",
  "stripeCustomerId": "cus_123",
  "stripeSubscriptionId": "sub_stripe_123",
  "planCode": "agent_pro",
  "billingInterval": "month",
  "status": "active",
  "trialEndsAt": "2026-04-05T00:00:00.000Z",
  "currentPeriodStart": "2026-03-05T00:00:00.000Z",
  "currentPeriodEnd": "2026-04-05T00:00:00.000Z",
  "cancelAtPeriodEnd": false,
  "seatsIncluded": 1,
  "seatsUsed": 1,
  "metadata": {},
  "createdAt": "2026-03-05T00:00:00.000Z",
  "updatedAt": "2026-03-20T00:00:00.000Z"
}
```

---

## 4.3 Plan definitions collection

Create a `planDefinitions` collection or config source.

### Example
```json
{
  "planCode": "agent_pro",
  "displayName": "Agent Pro",
  "stripePriceId": "price_123",
  "monthlyPropertyLimit": 30,
  "pricingCooldownHours": 24,
  "photoAnalysisLimit": 300,
  "flyerExportLimit": 100,
  "documentGenerationLimit": 50,
  "features": {
    "presentationMode": true,
    "customBranding": true,
    "pdfExport": true,
    "teamSharing": false,
    "merxusBundleEligible": true
  },
  "isActive": true
}
```

---

## 4.4 Stripe webhook events to support

Codex must support at minimum:
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`

### Webhook responsibilities
- sync plan status to MongoDB
- update billing dates
- enable or disable features
- trigger grace-period logic if needed
- log billing events for auditability

---

## 4.5 Enforcement flow

When a user requests an analysis:

1. load subscription
2. resolve active plan
3. load plan definition
4. load usage record for current billing month
5. enforce plan limits
6. if allowed:
   - serve cached result if within cooldown
   - otherwise run analysis
7. if not allowed:
   - return structured upgrade response

---

## 4.6 Upgrade trigger behavior

When quota is reached:
- do not show only an error
- show the current usage
- show the plan limit
- show the next plan tier
- provide upgrade CTA

### Example response
```json
{
  "status": "quota_reached",
  "message": "You have analyzed 10 of 10 properties this billing cycle.",
  "currentPlan": "agent_starter",
  "suggestedPlan": "agent_pro",
  "upgradeRequired": true,
  "checkoutPath": "/billing/upgrade?target=agent_pro"
}
```

---

## 4.7 Grace and edge cases

### Payment failure
If Stripe reports payment failure:
- do not immediately wipe access
- optionally set grace period: 3–7 days
- warn user in UI
- continue read-only access if appropriate

### Downgrades
If user downgrades:
- preserve historical data
- limit future usage based on new plan
- keep premium-generated artifacts viewable
- restrict new premium actions if outside new plan

### Trials
- track trial end clearly
- apply standard quotas during trial
- show trial countdown in billing UI

---

# 5. Data Model Extensions

## 5.1 usageTracking collection

Track current-cycle usage and support fast enforcement.

```json
{
  "_id": "usage_001",
  "userId": "usr_123",
  "billingCycleKey": "2026-03-05_to_2026-04-05",
  "planCode": "agent_starter",
  "uniquePropertiesAnalyzed": 8,
  "pricingRunsTotal": 14,
  "pricingCacheHits": 6,
  "photoAnalysisRuns": 22,
  "flyersGenerated": 7,
  "flyerExports": 5,
  "documentGenerations": 3,
  "lastPricingRunAt": "2026-03-26T20:10:00.000Z",
  "updatedAt": "2026-03-26T20:10:00.000Z"
}
```

---

## 5.2 analysisLocks collection

Prevent duplicate or overlapping execution.

```json
{
  "_id": "lock_001",
  "propertyId": "prop_123",
  "userId": "usr_123",
  "analysisType": "pricing",
  "inputHash": "sha256_abc",
  "status": "processing",
  "createdAt": "2026-03-27T10:00:00.000Z",
  "expiresAt": "2026-03-27T10:15:00.000Z"
}
```

---

## 5.3 analysisResults collection
(Or reuse existing pricing/media/etc. collections plus metadata)

Store:
- result payload
- cost metadata
- cache metadata
- source provider status

### Example metadata
```json
{
  "servedFromCache": true,
  "cacheReason": "cooldown_active",
  "providerCalls": {
    "rentcast": 0,
    "openai": 0
  },
  "estimatedCostUsd": 0
}
```

---

## 5.4 abuseEvents collection

Track suspicious behavior.

```json
{
  "_id": "abuse_001",
  "userId": "usr_123",
  "eventType": "repeated_quota_hits",
  "severity": "medium",
  "details": {
    "analysisType": "pricing",
    "count": 18,
    "window": "1h"
  },
  "createdAt": "2026-03-27T10:00:00.000Z",
  "reviewStatus": "open"
}
```

---

# 6. Backend Enforcement Logic

## 6.1 Canonical service
Create a central service:

```text
apps/api/src/modules/usage/usage-enforcement.service.ts
```

This service should:
- load subscription
- load plan definition
- resolve cooldown rules
- resolve quota rules
- check rate limits
- determine cache eligibility
- produce allow/deny/serve-cache decision

---

## 6.2 Decision output contract

Every expensive request should receive a normalized decision.

### Example TypeScript shape
```ts
type UsageDecision =
  | {
      action: "ALLOW_FRESH_RUN";
      planCode: string;
      limits: Record<string, unknown>;
    }
  | {
      action: "RETURN_CACHED_RESULT";
      cacheReason: "COOLDOWN_ACTIVE" | "DUPLICATE_JOB" | "RECENT_SUCCESS";
      analysisId: string;
      cachedAt: string;
    }
  | {
      action: "DENY_UPGRADE_REQUIRED";
      currentPlan: string;
      suggestedPlan?: string;
      reason: "MONTHLY_LIMIT_REACHED" | "FEATURE_NOT_INCLUDED";
      checkoutPath?: string;
    }
  | {
      action: "DENY_RATE_LIMIT";
      retryAfterSeconds: number;
    };
```

---

## 6.3 Recommended request flow

### Pricing analyze endpoint
```ts
1. authenticate user
2. resolve property access
3. build normalized input signature
4. call usage enforcement service
5. switch on decision:

   if RETURN_CACHED_RESULT:
      return prior analysis with cache metadata

   if DENY_UPGRADE_REQUIRED:
      return 402-like business response
      include plan and upgrade metadata

   if DENY_RATE_LIMIT:
      return 429 with retryAfter

   if ALLOW_FRESH_RUN:
      acquire analysis lock
      call RentCast + pricing engine + AI
      persist result
      increment usage counters
      release lock
      return result
```

---

## 6.4 Usage increments
Only increment costly usage after a successful fresh run, not when returning cache.

Track separately:
- attempted action
- fresh execution
- cache hit
- denied action

This distinction is essential for analytics.

---

# 7. Admin Dashboard Layout Spec

Create:
```text
apps/admin-web/src/features/usage-safeguards/
```

The admin dashboard should include the following major sections.

---

## 7.1 Admin Dashboard Overview Screen

### Title
**Usage Safeguards Overview**

### Top summary cards
- Active Users Today
- Fresh Pricing Runs Today
- Cache Hit Rate Today
- RentCast Calls Today
- OpenAI Calls Today
- Upgrade Prompts Triggered Today
- Abuse Events Open
- Estimated External API Spend Today

### Main page sections
1. Plan Limits Snapshot
2. Recent Usage Spikes
3. Top Accounts by Usage
4. Recent Abuse Events
5. Recent Stripe Billing State Changes

---

## 7.2 Plan Configuration Screen

### Title
**Plan Definitions & Limits**

### Table columns
- Plan Name
- Stripe Price ID
- Monthly Property Limit
- Pricing Cooldown
- Flyer Export Limit
- Photo Analysis Limit
- Included Features
- Status
- Edit Action

### Edit drawer or modal fields
- displayName
- planCode
- stripePriceId
- monthlyPropertyLimit
- pricingCooldownHours
- photoAnalysisCooldownHours
- flyerCooldownMinutes
- flyerExportLimit
- photoAnalysisLimit
- documentGenerationLimit
- customBrandingEnabled
- presentationModeEnabled
- merxusBundleEligible
- softWarningThresholdPercent
- gracePeriodDays
- active/inactive toggle

### Important
Changes should take effect for future enforcement without redeploy.

---

## 7.3 User Usage Detail Screen

### Title
**User Usage & Subscription Detail**

### Header summary
- User Name / Email
- Current Plan
- Stripe Status
- Billing Cycle Dates
- Trial / Grace / Active / Past Due
- Upgrade/Downgrade History

### Cards
- Unique Properties Analyzed This Cycle
- Pricing Fresh Runs
- Pricing Cache Hits
- Flyer Exports
- Photo Analyses
- Document Generations
- Denied Requests
- Abuse Flags

### Tables
#### Recent analyses
Columns:
- Timestamp
- Property
- Analysis Type
- Fresh Run / Cache Hit
- Cost Estimate
- Result Status

#### Recent limit denials
Columns:
- Timestamp
- Reason
- Plan
- Suggested Upgrade
- User Action if tracked

### Admin actions
- reset usage counters
- apply manual quota override
- grant temporary unlock
- change plan override
- disable account
- clear abuse flag
- resend billing prompt
- open Stripe customer link

---

## 7.4 Abuse Events Screen

### Title
**Abuse Detection & Review**

### Filters
- severity
- event type
- review status
- user
- date range

### Event types to display
- repeated cooldown abuse
- repeated quota hits
- burst analysis attempts
- suspicious multi-account IP overlap
- excessive property turnover
- high denied-request rate
- repeated payment-failure usage

### Columns
- Timestamp
- User
- Event Type
- Severity
- Summary
- Review Status
- Assigned Admin

### Detail panel
- full event metadata
- related usage history
- related Stripe/subscription status
- notes field
- resolve / escalate / suspend user actions

---

## 7.5 Billing & Upgrade Funnel Screen

### Title
**Billing Enforcement & Upgrade Funnel**

### Metrics cards
- Upgrade prompts shown
- Upgrade clicks
- Checkout sessions started
- Checkout sessions completed
- Conversion rate
- Trial expirations this week
- Accounts in grace period
- Failed payment accounts

### Funnel table
- plan reached limit
- upgrade prompt shown
- upgrade clicked
- checkout started
- checkout completed

This is where Workside sees whether limits are causing revenue or frustration.

---

## 7.6 Cost Control Screen

### Title
**External Cost Control**

### Cards
- RentCast Calls Today
- OpenAI Calls Today
- Cache Hit Rate
- Estimated Cost per Active User
- Estimated Cost per Plan Tier
- Top Cost Drivers

### Charts
- daily RentCast call volume
- daily OpenAI call volume
- fresh runs vs cache hits
- cost by analysis type
- cost by plan tier

---

# 8. Analytics Dashboard Layout Spec

Create:
```text
apps/admin-web/src/features/analytics/
```

This dashboard is separate from the operations dashboard. It focuses on product and business insight.

---

## 8.1 Executive Analytics Dashboard

### Title
**Home Advisor Business Analytics**

### Top cards
- Active Paid Subscribers
- MRR
- Trial-to-Paid Conversion
- Average Properties Analyzed per Paid User
- Cache Hit Rate
- Avg Cost per Paid User
- Gross Margin Estimate
- Top Performing Plan

### Sections
1. Revenue & Subscription Trends
2. Usage & Cost Trends
3. Product Adoption
4. Limit/Upgrade Behavior
5. Realtor vs Seller Segment Performance

---

## 8.2 Usage Analytics Screen

### Title
**Usage Analytics**

### Charts
- unique properties analyzed by day/week/month
- fresh runs vs cache hits
- analysis volume by type
- average analyses per user
- usage distribution by plan
- usage distribution by segment:
  - seller
  - realtor

### Tables
- most-used properties
- top users by volume
- users approaching limit
- plans with highest overage pressure

---

## 8.3 Cache & Cooldown Performance Screen

### Title
**Cache Efficiency**

### Key metrics
- pricing cache hit rate
- photo analysis cache hit rate
- flyer generation cache hit rate
- avoided RentCast calls
- avoided OpenAI calls
- estimated dollars saved by caching

### Charts
- cache hit rate over time
- fresh run volume over time
- cooldown-triggered returns over time
- cache savings by plan tier

This screen proves the safeguards are saving real money.

---

## 8.4 Subscription Behavior Screen

### Title
**Subscription Behavior**

### Breakdown
- free → paid conversion
- seller vs realtor conversion
- trial completion rate
- churn by plan
- upgrade rate after hitting usage limit
- downgrade rate after low utilization

### Critical chart
**Upgrade after limit hit**
This should show whether your quotas are placed correctly.

---

## 8.5 Realtor Value Screen

### Title
**Realtor Adoption & Value**

Because realtors are likely the best monetization path, this screen should show:

### Metrics
- active realtor accounts
- avg properties analyzed per agent
- avg flyer exports per agent
- avg pricing presentations per agent
- percent of agents using comp explanation feature
- percent of agents using custom branding
- avg conversion from trial to paid for agents

### Strategic importance
This helps Workside validate the “realtor mode” thesis.

---

## 8.6 Seller Value Screen

### Title
**Seller Adoption & Self-Serve Value**

### Metrics
- active seller accounts
- properties created
- pricing analyses run
- flyer exports
- improvement analyses
- conversion to paid
- conversion to realtor referral if later supported

---

# 9. UI/UX Messaging Rules

## 9.1 Cooldown hit
Show:
> “Pricing was already analyzed recently. Showing the latest saved result to avoid unnecessary refreshes.”

Optional subtext:
> “Last updated 6 hours ago.”

Optional CTA:
- View latest analysis
- Refresh when eligible in 18 hours
- Upgrade if plan includes accelerated refreshes later

---

## 9.2 Monthly plan limit reached
Show:
> “You’ve reached your monthly property analysis limit for Agent Starter.”

Subtext:
> “10 of 10 properties analyzed this billing cycle.”

CTA:
- Upgrade to Agent Pro
- View billing options

---

## 9.3 Rate limit hit
Show:
> “Too many requests in a short time. Please wait a moment and try again.”

Do not make this a billing prompt.

---

## 9.4 Feature not included
Show:
> “This feature is available on Agent Pro and above.”

CTA:
- Upgrade now

---

# 10. Suggested Default Policies

These should be editable in admin.

## Seller Free
- monthlyPropertyLimit: 1
- pricingCooldownHours: 24
- flyerExportLimit: 1
- photoAnalysisLimit: 20

## Seller Plus
- monthlyPropertyLimit: 3
- pricingCooldownHours: 24
- flyerExportLimit: 10
- photoAnalysisLimit: 100

## Agent Starter
- monthlyPropertyLimit: 10
- pricingCooldownHours: 24
- flyerExportLimit: 25
- photoAnalysisLimit: 200

## Agent Pro
- monthlyPropertyLimit: 30
- pricingCooldownHours: 24
- flyerExportLimit: 100
- photoAnalysisLimit: 500

## Agent Team
- monthlyPropertyLimit: 100
- pricingCooldownHours: 24
- flyerExportLimit: 500
- photoAnalysisLimit: 2000
- seatsIncluded: configurable

---

# 11. Codex Implementation Order

## Phase 1 — Core Enforcement
1. subscriptions collection
2. planDefinitions collection
3. usageTracking collection
4. usage enforcement service
5. pricing cooldown and cache return logic
6. Stripe webhook sync

## Phase 2 — Product UI
7. billing/upgrade response contracts
8. frontend limit messaging
9. billing page / upgrade CTA integration

## Phase 3 — Admin Operations
10. plan configuration screen
11. user usage detail screen
12. abuse events screen
13. cost control screen

## Phase 4 — Analytics
14. executive analytics dashboard
15. cache efficiency screen
16. subscription behavior screen
17. realtor vs seller analytics

---

# 12. Final Directive to Codex

This system must be implemented as a business-critical control layer.

It is not just about preventing abuse.

It must:
- control spend
- enforce monetization
- support self-serve upgrades
- reveal operational problems quickly
- validate product-market fit by segment

The clearest success signals will be:
- high cache hit rates
- low wasted provider calls
- clean plan enforcement
- meaningful upgrade conversions when users hit limits
- strong realtor adoption relative to seller-only usage

---

End of Document
