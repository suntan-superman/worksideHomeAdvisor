# Workside Home Advisor
## Full Provider Marketplace Implementation Model
### Codex-Ready Spec: Marketplace + Stripe Billing + Lead Routing + Twilio SMS + Admin Dashboard

Last Updated: 2026-03-29

---

# 1. Purpose

This document defines the full implementation model for the Workside Home Advisor provider marketplace.

It includes:
1. full provider marketplace product and backend spec
2. Stripe billing model for providers
3. lead routing and SMS notification system using Twilio
4. admin dashboard design and operational workflows

This system is intended to turn Workside Home Advisor into more than a seller tool. It becomes a workflow-driven local services marketplace that connects sellers and real estate professionals to the providers they need at the exact time those services matter.

---

# 2. Strategic Product Positioning

The marketplace should not behave like a generic directory.

It should behave like:

A property-aware service recommendation engine

That means:
- providers appear inside checklist and workflow steps
- recommendations are tied to the property’s stage
- the seller sees relevant providers only when needed
- the platform controls quality, trust, and monetization

---

# 3. Marketplace Product Principles

## 3.1 Core Principles
- Contextual, not generic
- Local, not broad
- Guided, not overwhelming
- Trust-first, not spammy
- Lead-efficient, not noisy
- Monetizable without harming user trust

## 3.2 Marketplace Entry Points
Providers should appear through:
- seller checklist steps
- report provider section
- improvement recommendations
- visual improvement recommendations
- dedicated providers view later
- realtor workflow tools later

## 3.3 Supported Categories (Recommended Rollout)

### Phase 1
- inspectors
- title companies
- real estate attorneys
- photographers
- cleaning services

### Phase 2
- painters
- flooring contractors
- handymen
- staging services
- landscapers

### Phase 3
- mortgage brokers
- insurance
- movers
- junk removal
- storage
- specialty contractors

---

# 4. Marketplace User Flows

# 4.1 Seller Flow

### Example
1. Seller is in checklist
2. Task says: Schedule home inspection
3. System shows top 3 inspectors for the property ZIP / radius
4. Seller clicks:
   - View providers
   - Request quotes
   - Save provider
5. System creates a lead request
6. Providers are notified via SMS/email
7. Seller sees response status in app

---

# 4.2 Realtor Flow (Future-Ready)
1. Agent prepares listing
2. Vision system recommends painter / cleaner / photographer
3. Agent requests 3 quotes
4. Providers respond
5. Agent shares recommendations with seller or books externally

---

# 4.3 Provider Flow
1. Provider receives lead via SMS/email or provider portal
2. Provider accepts or declines
3. Acceptance recorded
4. Seller/realtor sees that provider has engaged
5. Provider may follow up directly
6. Platform tracks response and lead conversion

---

# 5. Provider Marketplace Spec (Codex-Ready)

## 5.1 Main Marketplace Objects
- Provider
- ProviderCategory
- ProviderCoverageArea
- ProviderSubscription
- LeadRequest
- LeadDispatch
- ProviderResponse
- SavedProvider
- ProviderReview later
- ProviderAnalytics

---

## 5.2 Provider Profile Requirements

Each provider should have:
- business name
- category
- service area
- business phone
- website
- short description
- hours / response expectations later
- verified flag
- sponsored flag
- subscription plan
- lead delivery settings
- quality score / ranking inputs
- status (active, paused, pending, suspended)

---

## 5.3 Ranking Strategy

Providers should not be shown randomly.

Recommended scoring model:

ProviderRankScore =
  (qualityScore * 0.35)
+ (responseSpeedScore * 0.20)
+ (leadAcceptanceScore * 0.15)
+ (distanceScore * 0.10)
+ (subscriptionBoostScore * 0.10)
+ (freshnessScore * 0.10)

### Definitions
- qualityScore = internal quality / manual admin score
- responseSpeedScore = how quickly provider accepts/responds
- leadAcceptanceScore = acceptance rate
- distanceScore = closer providers rank higher
- subscriptionBoostScore = paid featured tier boost
- freshnessScore = recently active providers get a small bump

## Important
Featured placement should influence ranking but not completely override trust and relevance.

---

## 5.4 Provider Display Rules

Each provider card should show:
- business name
- category
- city / distance
- short description
- verified badge
- sponsored badge if applicable
- response speed badge later
- rating/review count later if supported
- actions:
  - request contact
  - save provider
  - visit website
  - call

---

## 5.5 Trust Rules
- sponsored providers must be labeled
- verified providers must have a real verification process
- avoid showing more than 3–5 providers inline in checklist flow
- avoid turning workflow steps into ad clutter
- never show irrelevant categories just to monetize

---

# 6. Database Model

## 6.1 providers
```json
{
  "_id": "prov_001",
  "businessName": "ABC Home Inspections",
  "slug": "abc-home-inspections",
  "categoryKey": "inspector",
  "description": "Residential inspections for Bakersfield and nearby areas.",
  "phone": "555-555-5555",
  "email": "owner@example.com",
  "websiteUrl": "https://example.com",
  "status": "active",
  "isVerified": true,
  "isSponsored": true,
  "qualityScore": 82,
  "averageResponseMinutes": 35,
  "serviceArea": {
    "city": "Bakersfield",
    "state": "CA",
    "zipCodes": ["93312", "93313"],
    "radiusMiles": 25
  },
  "leadRouting": {
    "deliveryMode": "sms_and_email",
    "twilioPhone": null,
    "notifyPhone": "555-111-2222",
    "notifyEmail": "sales@example.com"
  },
  "subscription": {
    "planCode": "provider_featured",
    "status": "active",
    "stripeCustomerId": "cus_xxx",
    "stripeSubscriptionId": "sub_xxx"
  },
  "createdAt": "2026-03-29T00:00:00.000Z",
  "updatedAt": "2026-03-29T00:00:00.000Z"
}
```

Indexes:
- categoryKey
- status
- serviceArea.city + serviceArea.state
- serviceArea.zipCodes
- isSponsored
- qualityScore

---

## 6.2 providerCategories
```json
{
  "_id": "cat_001",
  "key": "inspector",
  "label": "Home Inspectors",
  "isActive": true,
  "sortOrder": 1
}
```

---

## 6.3 leadRequests
```json
{
  "_id": "lead_001",
  "propertyId": "prop_001",
  "userId": "usr_001",
  "requestedByRole": "seller",
  "categoryKey": "inspector",
  "source": "checklist_task",
  "sourceRefId": "task_001",
  "propertySnapshot": {
    "address": "8612 Mainsail Drive",
    "city": "Bakersfield",
    "state": "CA",
    "zip": "93312"
  },
  "status": "open",
  "maxProviders": 3,
  "message": "Seller requested inspection providers before listing.",
  "createdAt": "2026-03-29T00:00:00.000Z",
  "updatedAt": "2026-03-29T00:00:00.000Z"
}
```

Indexes:
- propertyId
- userId
- categoryKey
- status
- createdAt

---

## 6.4 leadDispatches
```json
{
  "_id": "dispatch_001",
  "leadRequestId": "lead_001",
  "providerId": "prov_001",
  "status": "sent",
  "deliveryChannels": ["sms", "email"],
  "sentAt": "2026-03-29T00:05:00.000Z",
  "respondedAt": null,
  "responseStatus": null,
  "leadFeeCents": 1500
}
```

Indexes:
- leadRequestId
- providerId
- status
- sentAt

---

## 6.5 providerResponses
```json
{
  "_id": "response_001",
  "leadRequestId": "lead_001",
  "providerId": "prov_001",
  "responseStatus": "accepted",
  "note": "We can contact the seller today.",
  "createdAt": "2026-03-29T00:20:00.000Z"
}
```

Indexes:
- leadRequestId
- providerId
- responseStatus

---

## 6.6 savedProviders
```json
{
  "_id": "saved_001",
  "propertyId": "prop_001",
  "userId": "usr_001",
  "providerId": "prov_001",
  "categoryKey": "inspector",
  "createdAt": "2026-03-29T00:00:00.000Z"
}
```

Indexes:
- propertyId
- userId
- providerId

---

## 6.7 providerAnalytics
```json
{
  "_id": "pan_001",
  "providerId": "prov_001",
  "monthKey": "2026-03",
  "leadCount": 18,
  "acceptedCount": 11,
  "declinedCount": 3,
  "expiredCount": 4,
  "avgResponseMinutes": 29,
  "billableLeadCount": 11,
  "revenueCents": 16500
}
```

Indexes:
- providerId + monthKey

---

# 7. Stripe Billing Model for Providers

## 7.1 Billing Philosophy

Use a simple model first:
- recurring provider subscription
- optional lead fees
- optional featured placement upgrade

Do not start with too many billing permutations.

---

## 7.2 Recommended Plans

### Plan A — Free / Basic Provider
- limited profile
- no featured placement
- low or no lead priority
- optional access for initial seeding

### Plan B — Standard Provider
- active listing in marketplace
- lead delivery enabled
- moderate ranking
- fixed monthly subscription

Suggested price:
- $49–$99/month

### Plan C — Featured Provider
- sponsored badge
- ranking boost
- enhanced profile visibility
- better placement in checklist/report sections

Suggested price:
- $149–$299/month

### Optional Add-On — Pay Per Accepted Lead
- bill when provider accepts a lead
- can vary by category

Suggested lead fee ranges:
- inspector: $10–$25
- title company: $15–$40
- attorney: $20–$50
- photographer: $10–$25
- contractor lead: $15–$35

---

## 7.3 Stripe Objects

For each provider:
- Stripe customer
- Stripe subscription (for recurring plan)
- Stripe invoice tracking
- optional metered item later if lead billing becomes metered

### Recommended simple approach first
Monthly subscription + manually or app-recorded lead fees

---

## 7.4 Stripe Fields to Store

On provider record:
- stripeCustomerId
- stripeSubscriptionId
- stripePriceId
- subscriptionStatus
- billingPlanCode
- billingCycleAnchor later if useful

---

## 7.5 Billing Events to Handle
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.paid
- invoice.payment_failed

---

## 7.6 Provider Billing Workflow

### New provider onboarding
1. provider signs up
2. creates business profile
3. selects plan
4. Stripe checkout starts
5. checkout succeeds
6. provider profile becomes active
7. admin can verify later if needed

### Featured upgrade
1. provider clicks upgrade
2. choose featured plan
3. Stripe handles proration/update
4. profile immediately flagged as sponsored when active

### Lead billing later
1. lead accepted
2. lead marked billable
3. line item or internal balance recorded
4. invoice later or immediate charge later

---

# 8. Lead Routing + Twilio SMS System

## 8.1 Goals
- notify providers quickly
- keep seller/realtor workflow simple
- track acceptance
- avoid over-sending and lead spam
- keep routing explainable

---

## 8.2 Routing Logic

When a lead request is created:
1. determine category
2. determine location (zip/city/radius)
3. query active providers in coverage area
4. sort providers by ProviderRankScore
5. select top N providers (default 3)
6. create leadDispatches
7. send SMS + optional email
8. wait for responses
9. surface status to user/admin

---

## 8.3 Twilio SMS Workflow

### Outbound provider lead SMS
Example message:

New Workside lead: Inspection request for property near 93312. Reply YES to accept or NO to decline.

### Provider response parsing
- YES / Y = accept
- NO / N = decline
- HELP = support
- STOP = opt out from marketplace SMS

### On accept
- mark providerResponse accepted
- update leadDispatch
- optionally stop routing further providers if the lead is satisfied

### On decline
- mark declined
- optionally route next provider in queue

---

## 8.4 Twilio Webhooks Needed

### Inbound webhook
POST /marketplace/twilio/inbound

Responsibilities:
- verify Twilio signature
- parse From, Body
- locate matching provider
- locate latest pending lead dispatch
- update provider response
- trigger seller/app updates later

---

## 8.5 Optional Provider Portal + SMS Hybrid
Do both:
- provider can accept in dashboard
- provider can accept by SMS

This makes early adoption easier.

---

## 8.6 Lead Dispatch Rules

### Default
- send to top 3 providers

### Timeout
- if no response within X minutes/hours, optionally dispatch to next provider

Suggested initial timeout:
- 60 minutes for high-intent services
- 12 hours for lower-urgency categories

### Anti-spam rule
Never send every lead to every provider.

---

## 8.7 Lead Status Lifecycle

LeadRequest status:
- open
- routing
- matched
- completed
- expired
- cancelled

LeadDispatch status:
- queued
- sent
- accepted
- declined
- expired

ProviderResponse status:
- accepted
- declined
- no_response

---

# 9. Marketplace API Contracts

# 9.1 Provider Discovery

## GET /properties/:id/providers
Query params:
- category
- limit
- taskKey
- zipOverride later

Response:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "providerId": "prov_001",
        "businessName": "ABC Home Inspections",
        "categoryKey": "inspector",
        "city": "Bakersfield",
        "distanceMiles": 4.2,
        "description": "Residential inspections for Bakersfield and nearby areas.",
        "isVerified": true,
        "isSponsored": true,
        "rankingBadges": ["Top Pick", "Fast Response"]
      }
    ]
  }
}
```

---

# 9.2 Lead Request Creation

## POST /properties/:id/provider-leads

Request:
```json
{
  "categoryKey": "inspector",
  "source": "checklist_task",
  "sourceRefId": "task_001",
  "message": "Seller wants inspection options before listing."
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "leadRequestId": "lead_001",
    "status": "routing",
    "providersContacted": 3
  }
}
```

---

# 9.3 Seller Lead Status View

## GET /properties/:id/provider-leads

Response:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "leadRequestId": "lead_001",
        "categoryKey": "inspector",
        "status": "routing",
        "dispatches": [
          {
            "providerId": "prov_001",
            "businessName": "ABC Home Inspections",
            "status": "accepted"
          }
        ]
      }
    ]
  }
}
```

---

# 9.4 Save Provider

## POST /providers/:id/save

Response:
```json
{
  "ok": true,
  "data": {
    "saved": true
  }
}
```

---

# 9.5 Provider Signup / Profile Create

## POST /provider-portal/signup

Request:
```json
{
  "businessName": "ABC Home Inspections",
  "categoryKey": "inspector",
  "email": "owner@example.com",
  "phone": "555-555-5555",
  "city": "Bakersfield",
  "state": "CA"
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "providerId": "prov_001",
    "status": "pending_billing"
  }
}
```

---

# 9.6 Provider Billing Checkout

## POST /provider-portal/billing/checkout

Request:
```json
{
  "providerId": "prov_001",
  "planCode": "provider_featured"
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
}
```

---

# 9.7 Provider Dashboard Lead List

## GET /provider-portal/leads

Response:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "leadRequestId": "lead_001",
        "categoryKey": "inspector",
        "propertyCity": "Bakersfield",
        "status": "sent",
        "sentAt": "2026-03-29T00:05:00.000Z"
      }
    ]
  }
}
```

---

# 9.8 Provider Lead Response

## PATCH /provider-portal/leads/:id/respond

Request:
```json
{
  "responseStatus": "accepted",
  "note": "We can contact them today."
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "updated": true
  }
}
```

---

# 10. Admin Dashboard for Provider Management

## 10.1 Admin Goals
Admin must be able to:
- create/edit providers
- approve or suspend providers
- review billing state
- review lead flow
- clean up stale leads
- monitor provider quality
- manage featured placement
- see revenue and response metrics

---

## 10.2 Admin Dashboard Sections

### A. Provider List
Columns:
- business name
- category
- city
- status
- verified
- sponsored
- plan
- leads this month
- avg response time

Actions:
- view
- edit
- verify
- suspend
- change plan
- mark featured

### B. Provider Detail View
Sections:
- business profile
- contact info
- service area
- billing info
- lead performance
- verification notes
- internal admin notes

### C. Lead Operations View
Show:
- open leads
- routing leads
- accepted leads
- expired leads

Actions:
- resend
- cancel
- manually route
- override provider selection

### D. Revenue / Billing View
Show:
- active provider subscriptions
- churned providers
- current MRR
- lead fee revenue
- failed payments

### E. Verification Queue
For new providers:
- pending verification
- docs later if needed
- approve / reject

### F. Category Management
- enable/disable category
- reorder categories
- set lead fee defaults
- set category rollout flags

---

## 10.3 Admin Actions That Matter Most
Highest-value early admin tools:
- toggle provider active/suspended
- edit service area
- mark verified
- mark sponsored
- view recent leads
- view billing status

Do not overbuild the admin UI at first.

---

# 11. Codex Implementation Checklist

## Marketplace Core
- [ ] create providers collection
- [ ] create leadRequests collection
- [ ] create leadDispatches collection
- [ ] create providerResponses collection
- [ ] create savedProviders collection
- [ ] create providerAnalytics collection
- [ ] implement provider ranking service
- [ ] implement location/category provider filtering

## Seller/Realtor Flow
- [ ] add provider retrieval endpoint
- [ ] add create lead request endpoint
- [ ] add lead status retrieval endpoint
- [ ] add save provider endpoint
- [ ] connect checklist tasks to provider categories

## Stripe Billing
- [ ] create provider billing plan catalog
- [ ] create provider signup flow
- [ ] create provider checkout session endpoint
- [ ] wire webhook handling
- [ ] persist provider subscription state
- [ ] support featured plan upgrades

## Twilio Routing
- [ ] add Twilio outbound SMS service
- [ ] add inbound webhook endpoint
- [ ] parse YES / NO / HELP / STOP
- [ ] update providerResponse records
- [ ] implement routing timeout logic
- [ ] stop or continue routing based on acceptance rules

## Admin Dashboard
- [ ] provider list view
- [ ] provider detail view
- [ ] lead operations view
- [ ] billing state view
- [ ] verify/suspend actions
- [ ] sponsored/featured controls

---

# 12. Recommended Rollout Plan

## Phase 1 — Marketplace Foundation
- inspectors
- title companies
- photographers
- cleaning services

Build:
- provider records
- provider discovery
- lead request creation
- Twilio outbound notifications
- simple provider acceptance flow
- admin management basics

## Phase 2 — Billing + Featured Placement
- provider signup
- Stripe checkout
- recurring provider plans
- sponsored labeling
- ranking boost

## Phase 3 — Workflow Deep Integration
- provider recommendations in checklist
- provider recommendations in reports
- save provider flow
- provider analytics
- response speed and ranking improvements

## Phase 4 — Realtor and Scale Layer
- realtor-specific provider workflows
- quoting workflows later
- team-level provider plans later
- deeper marketplace analytics

---

# 13. Monetization Recommendations

Start simple:
1. monthly provider subscription
2. featured placement upgrade
3. accepted lead fee later if needed

Why:
- easier operationally
- easier to explain
- lower support burden
- cleaner billing stack at launch

If adoption is good:
- introduce category-specific lead fees later

---

# 14. Final Direction to Codex

Build the provider marketplace as:
- workflow-aware
- local
- curated
- monetizable
- trust-centered

Do not build a noisy directory.

Build a contextual service layer that helps the seller or agent move the property forward at the right moment.

That is what makes the marketplace valuable and competitive.

---

End of Document
