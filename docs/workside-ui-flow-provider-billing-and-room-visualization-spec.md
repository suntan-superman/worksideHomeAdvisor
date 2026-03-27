# Workside Home Advisor
## UI Flow + Provider Onboarding + Billing System Spec

Last Updated: 2026-03-27

---

# 1. Purpose

This document defines two major additions to Workside Home Advisor:

1. the **seller-facing UI flow** for the checklist + provider marketplace
2. the **provider onboarding, billing, and monetization system**

The goal is to make the seller experience simple and useful while giving Workside a scalable provider revenue model.

---

# 2. Product Goals

The system should:

- guide sellers through the steps of selling a home
- surface relevant local providers at the right moment
- create a clean path for providers to join and pay
- support sponsorships, subscriptions, and lead tracking
- remain trustworthy and easy to use

---

# 3. Seller UI Flow

## 3.1 Entry Points

The checklist/provider experience should be reachable from:

- seller dashboard
- property workspace
- AI recommendation cards
- pricing results page
- flyer generation completion page
- under-contract workflow if later added

Recommended main nav label:

**Checklist**
or
**Sell My Home Checklist**

Recommended subheading:

> Step-by-step guidance, recommended providers, and next actions for your home sale.

---

## 3.2 Seller Dashboard Widget

Add a dashboard card:

### Card title
**Your Selling Checklist**

### Card contents
- overall completion percentage
- current phase
- next recommended task
- quick actions:
  - view checklist
  - find providers
  - continue where you left off

### Example
- Progress: 42%
- Current Phase: Pre-Listing
- Next Task: Select a photographer or upload final room photos

---

## 3.3 Checklist Main Screen

### Screen title
**Sell Your Home Checklist**

### Layout
Top summary:
- property address
- current phase
- progress bar
- estimated next milestone

Phase accordion/cards:
1. Pre-Listing
2. Listing Launch
3. Under Contract
4. Closing

Each phase card should show:
- number completed
- number remaining
- status badge
- expand/collapse action

Each checklist item should show:
- title
- short explanation
- status
- “find providers” button if relevant
- “mark complete” button
- “learn more” action

---

## 3.4 Checklist Item Detail Screen

### Example item
**Choose a Title Company**

### Screen sections
1. Why this matters
2. What to consider
3. Recommended providers nearby
4. Sponsored providers if applicable
5. Notes / reminders
6. Mark complete / save for later

### Actions
- call provider
- visit website
- request contact
- save provider
- compare providers

### Optional AI helper module
> “Ask AI what to look for when choosing a title company.”

---

## 3.5 Provider Results Panel

Each provider card should show:

- company name
- category
- city / distance
- rating + review count if available
- short description
- badges:
  - Sponsored
  - Verified
  - Popular with sellers
- actions:
  - call
  - website
  - save
  - request contact

### Expanded detail view
- business overview
- service area
- phone
- website
- office hours if available
- notes
- Workside disclaimer

---

## 3.6 Provider Comparison Flow

Allow the seller to select 2–3 providers and compare:

Columns:
- rating
- distance
- phone
- website
- sponsored or not
- service notes
- user saved/favorited

This is especially useful for:
- title companies
- inspectors
- attorneys
- photographers

---

## 3.7 Saved Providers Screen

### Purpose
Let the seller save providers for later review.

### Fields shown
- provider name
- category
- saved date
- linked checklist item
- contacted / not contacted
- notes

This becomes the seller’s working provider shortlist.

---

## 3.8 UI State Rules

### Normal state
Show provider list + task explanation

### Empty state
If no providers found:
- show fallback guidance
- allow broader search radius
- allow search by city

### Sponsored state
Sponsored providers should be clearly labeled

### Error state
Show:
> “We couldn’t load providers right now. Try again in a moment.”

---

# 4. Recommended Seller UX Sequence

## Phase 1
Seller sees checklist after pricing is complete.

## Phase 2
Checklist recommends tasks based on status:
- prep home
- photos
- flyer
- provider selection

## Phase 3
When seller opens relevant task:
- show education
- show providers
- allow save/contact

## Phase 4
Track progress and move them toward listing readiness.

This should feel like guided execution, not a directory dump.

---

# 5. Realtor / Agent UI Opportunity

Even though this is seller-friendly first, it should also support future agent mode.

## Agent benefits
- share provider recommendations with clients
- create a polished “next steps” plan during listing appointment
- recommend preferred title/inspection vendors
- optionally attach branded provider notes

Later, agent mode can include:
- preferred vendor lists
- brokerage-approved providers
- one-click seller handoff checklist

---

# 6. Provider Onboarding System

Create a provider-facing workflow for businesses such as:
- title companies
- inspectors
- photographers
- contractors
- attorneys
- cleaners
- stagers

---

## 6.1 Entry Points for Providers

Ways providers discover onboarding:
- public “List Your Business” landing page
- invite from Workside sales/admin
- ad slots in seller platform
- marketplace footer CTA
- outbound outreach by Workside

Recommended CTA:
**Get Your Business Listed on Workside Home Advisor**

---

## 6.2 Provider Onboarding Flow

### Step 1 — Account creation
Fields:
- business name
- contact name
- email
- phone
- password or magic link
- service category
- city / region

### Step 2 — Business profile
Fields:
- business description
- services offered
- website
- address
- service area radius
- years in business
- upload logo
- photos optional
- business hours optional

### Step 3 — Listing options
Choose plan:
- Free basic listing
- Sponsored placement
- Verified provider
- Pay-per-lead plan
- Premium monthly subscription

### Step 4 — Billing
Stripe checkout or customer portal

### Step 5 — Review / verification
- pending
- approved
- rejected
- needs edits

### Step 6 — Live listing
Provider becomes visible in seller searches

---

# 7. Provider Profile Data Model

Suggested `providers` collection:

```json
{
  "_id": "prov_001",
  "businessName": "ABC Home Inspections",
  "slug": "abc-home-inspections",
  "category": "inspector",
  "contactName": "Jane Smith",
  "email": "jane@abcinspect.com",
  "phone": "555-555-5555",
  "website": "https://example.com",
  "description": "Residential home inspections in Bakersfield and surrounding areas.",
  "address": {
    "line1": "123 Main St",
    "city": "Bakersfield",
    "state": "CA",
    "zip": "93301"
  },
  "serviceArea": {
    "type": "radius",
    "center": {
      "lat": 35.3733,
      "lng": -119.0187
    },
    "miles": 35
  },
  "rating": 4.8,
  "reviewCount": 91,
  "logoUrl": "",
  "isSponsored": true,
  "isVerified": true,
  "status": "active",
  "planCode": "provider_sponsored",
  "stripeCustomerId": "cus_123",
  "createdAt": "",
  "updatedAt": ""
}
```

---

# 8. Provider Billing System

Stripe should power all provider monetization.

---

## 8.1 Billing Models

### A. Free listing
- very limited visibility
- no sponsorship
- no analytics
- capped service area or category count

### B. Sponsored monthly subscription
- appears higher in results
- “Sponsored” badge
- visibility in checklist flows
- access to provider analytics

### C. Verified provider subscription
- verification badge
- richer profile
- additional trust indicators
- moderate placement benefits

### D. Premium bundle
- sponsored + verified + analytics + expanded geography

### E. Pay-per-lead
- optional later
- charge on click/contact/request lead event

Recommendation for MVP:
Start with:
1. free listing
2. sponsored monthly
3. premium monthly

Then add pay-per-lead later.

---

## 8.2 Suggested Stripe Products

### Product 1
`provider_basic_free`
- $0
- limited listing

### Product 2
`provider_sponsored_monthly`
- e.g. $99/month

### Product 3
`provider_premium_monthly`
- e.g. $199/month

### Product 4
`provider_lead_pack`
- optional future one-time or metered billing

---

## 8.3 Provider Subscription Collection

```json
{
  "_id": "provsub_001",
  "providerId": "prov_001",
  "stripeCustomerId": "cus_123",
  "stripeSubscriptionId": "sub_123",
  "planCode": "provider_premium_monthly",
  "status": "active",
  "currentPeriodStart": "2026-03-01T00:00:00.000Z",
  "currentPeriodEnd": "2026-04-01T00:00:00.000Z",
  "cancelAtPeriodEnd": false,
  "createdAt": "",
  "updatedAt": ""
}
```

---

## 8.4 Stripe Webhooks for Providers

Support:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.paid
- invoice.payment_failed

Webhook effects:
- activate or downgrade provider listing
- update sponsorship flags
- unlock analytics
- hide premium-only visibility if canceled

---

# 9. Provider Ranking Logic

Create a ranking score for provider search results.

Suggested factors:
- service area match
- relevance to checklist item
- rating
- review count
- verified status
- sponsored boost
- profile completeness
- recent response/engagement signals later

Example:

```ts
providerScore =
  (distanceScore * 0.25) +
  (ratingScore * 0.20) +
  (reviewScore * 0.10) +
  (relevanceScore * 0.20) +
  (profileCompleteness * 0.10) +
  (verifiedBoost * 0.05) +
  (sponsoredBoost * 0.10)
```

Important:
- Sponsored should boost, not fully replace relevance
- Keep results trustworthy

---

# 10. Provider Analytics Dashboard

Create:
```text
apps/provider-web or apps/admin-web/provider-portal
```

Provider analytics should show:
- profile views
- checklist appearances
- clicks
- saves
- contact requests
- geographic demand
- category demand
- conversion trend if trackable

This is what helps justify provider subscriptions.

---

# 11. Provider Portal UI Layout

## Main screens
1. Dashboard
2. Profile
3. Billing
4. Analytics
5. Leads / Requests
6. Settings

---

## 11.1 Provider Dashboard
Cards:
- active subscription
- views this month
- clicks this month
- saved by sellers
- contact requests
- billing status

---

## 11.2 Profile Screen
- business details
- logo
- service area
- category
- description
- photos
- phone / website
- preview of seller-facing card

---

## 11.3 Billing Screen
- current plan
- next invoice date
- update payment method
- cancel subscription
- upgrade/downgrade plan
- invoice history

---

## 11.4 Analytics Screen
Charts:
- views over time
- clicks over time
- saves over time
- contacts over time
- appearance by checklist category

---

# 12. Local Provider Monetization Strategy

## Stage 1 — Visibility revenue
Charge for sponsored placement and premium listings.

## Stage 2 — Performance revenue
Charge for:
- contact requests
- call clicks
- website click-throughs
- booked consultations if later integrated

## Stage 3 — Market partnerships
Offer local packages to:
- title companies
- inspection firms
- photographers
- stagers
- contractors

This can become a recurring B2B revenue stream.

---

# 13. Important Legal / Trust Requirements

Every provider-facing and seller-facing workflow must include:

> Workside does not endorse, guarantee, or warrant any provider. Sellers should independently evaluate providers before making a decision.

Also:
- clearly label Sponsored
- do not represent paid providers as “best” without disclosure
- allow removal of providers if flagged

---

# 14. Codex Implementation Order

## Phase 1 — Seller-side marketplace
1. checklist UI flow
2. provider schema
3. provider cards
4. provider search API
5. save/contact/click tracking

## Phase 2 — Provider onboarding
6. public provider signup page
7. provider profile management
8. provider approval workflow
9. Stripe checkout for provider plans
10. provider subscription sync

## Phase 3 — Monetization and analytics
11. sponsored placement logic
12. provider analytics dashboard
13. billing portal integration
14. admin moderation tools

---

# 15. AI-Powered Room Visualization — Feasibility and Product Opportunity

Yes, AI can absolutely help with this.

It is possible for AI to take a generic picture of a room and:
- remove or reduce visible furniture
- change wall colors
- change flooring appearance
- add light staging concepts
- create mock “after” variations

This can be very valuable for sellers because it helps them visualize:
- what a paint change might look like
- whether decluttering helps
- how different floors or staging might improve presentation

---

## 15.1 Best use cases

### A. Virtual declutter / furniture removal preview
Show a cleaner version of the room to help the seller see the impact of removing furniture or clutter.

### B. Paint color preview
Generate multiple wall-color variants:
- warm neutral
- bright white
- soft greige
- modern muted tones

### C. Flooring concept preview
Generate alternatives like:
- light wood
- medium wood
- luxury vinyl plank
- neutral carpet removal concepts

### D. Before/after concept cards
Show:
- current photo
- decluttered version
- painted version
- flooring-modified version

This helps sellers decide if changes feel worth it.

---

## 15.2 Important caveats

This should be positioned as:
- visualization guidance
- concept rendering
- not guaranteed construction accuracy
- not guaranteed cost/value outcome

Do NOT imply:
- exact remodel result
- precise material match
- guaranteed increase in value

Recommended disclaimer:
> AI room visualizations are conceptual previews for planning purposes only. Final results and resale impact may vary.

---

## 15.3 Technical approach

This should be implemented as an image transformation workflow, not as a simple text-only suggestion.

Recommended pipeline:
1. seller uploads room photo
2. system classifies room type
3. seller chooses visualization mode:
   - remove furniture
   - change wall color
   - change floor appearance
   - light staging concept
4. image transformation job runs
5. output images saved as “concept variants”
6. seller compares before/after
7. AI estimates possible value or listing-appeal impact separately

---

## 15.4 Product rule

Always keep the original image visible next to the transformed concept.

Recommended labels:
- Original
- Concept Preview
- Suggested Improvement

This builds trust and avoids confusion.

---

## 15.5 Strong product opportunity

This can become one of Workside Home Advisor’s signature features:

> “See what your room could look like before spending money.”

That is very compelling for:
- individual sellers
- realtors preparing listing advice
- vendors upselling paint/flooring/staging services

---

## 15.6 Suggested future module

```text
modules/room-visualization/
```

Suggested storage:
- originalAssetId
- transformationType
- promptPreset
- outputAssetIds
- roomType
- userAcceptedVariant
- createdAt

---

# 16. Final Product Direction

The checklist + provider marketplace system gives Workside Home Advisor:
- stronger seller value
- deeper realtor usefulness
- new B2B revenue channels
- an eventual local-services marketplace

The room visualization feature adds:
- a major “wow” factor
- practical seller guidance
- stronger ROI discussions around improvements
- a premium feature opportunity

Together, these move the platform from:
- pricing and prep tool

to:
- full home-sale guidance system with monetizable local ecosystem support

---

End of Document
