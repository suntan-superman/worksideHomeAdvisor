# Workside Home Advisor — Production-Grade Landing, Funnel, and Conversion System Spec
## Codex-Ready Implementation Plan

**Version:** 1.0  
**Date:** 2026-04-02  
**Purpose:** Define the production-grade landing page, conversion funnel, onboarding handoff, subscription gating, analytics, and implementation architecture for sellers, agents, and providers.

This document is designed to be handed directly to Codex for implementation planning and build execution.

---

# 1. Executive Summary

Workside Home Advisor is now beyond core scaffolding. The seller product, provider marketplace, admin surfaces, billing, guided workflow, reports, and AI vision pipeline are already real and working, with the remaining work centered on refinement, hardening, premium output quality, and monetization strategy. The current platform status shows strong seller, provider, admin, billing, and workflow foundations already in place. The key remaining step is to convert traffic into subscriptions and production usage. See current project checkpoint for detailed implementation status and remaining priorities. fileciteturn1file0

This spec turns the current product into a **production-grade conversion system** by defining:

- seller, agent, and provider landing pages
- ad-to-app funnel flows from Instagram and Facebook
- progressive value gating
- onboarding handoff into the existing app
- subscription prompts and billing trigger points
- analytics and event tracking
- recommended component architecture
- API contracts
- rollout order
- the next 5 and next 10 most critical features

---

# 2. Strategic Product Positioning

## 2.1 The Real Product
Workside Home Advisor is not primarily:
- an AI image tool
- a comps tool
- a PDF generator
- a provider directory

The real product is:

> **A guided selling plan that helps sellers and agents move a property from uncertainty to market-ready status.**

Everything else supports that:
- pricing
- checklists
- provider matching
- media capture
- reports
- flyers
- trust signals
- billing

## 2.2 Funnel Thesis
Users should not be asked to understand the platform first.

Users should:
1. start with a simple input
2. get partial value quickly
3. feel momentum
4. continue naturally into full onboarding
5. encounter billing only after clear value has been demonstrated

---

# 3. Audience-Specific Funnel Architecture

Workside should not use a single generic landing page. It should run three dedicated funnels:

## 3.1 Seller Funnel
**Route:** `/sell`  
**Goal:** Convert homeowners into active seller subscriptions.

### Seller intent:
- “How much is my home worth?”
- “What should I do before listing?”
- “What should I fix first?”
- “Who can help me?”

### Seller promise:
- pricing guidance
- prep checklist
- photo guidance
- provider help
- market-ready materials

---

## 3.2 Agent Funnel
**Route:** `/agents`  
**Goal:** Convert agents into recurring subscriptions by positioning Workside as a listing acceleration tool.

### Agent intent:
- “How do I win more listings?”
- “How do I look more prepared in front of sellers?”
- “How do I streamline prep?”

### Agent promise:
- branded reports
- seller-facing professionalism
- listing preparation workflow
- provider coordination
- better listing presentations

---

## 3.3 Provider Funnel
**Route:** `/providers`  
**Goal:** Convert providers into lead-generation subscriptions.

### Provider intent:
- “How do I get more local jobs?”
- “Are these qualified leads?”
- “What kind of work will I receive?”

### Provider promise:
- high-intent seller leads
- local service requests
- profile trust and verification
- lead acceptance workflow

---

# 4. High-Level Production Funnel Flow

## 4.1 Seller Funnel (Primary)
```text
Instagram/Facebook Ad
-> /sell landing page
-> address input
-> preview result
-> email capture
-> property creation / auth
-> guided workflow dashboard
-> subscription gate at unlock moment
-> paid seller account
```

## 4.2 Agent Funnel
```text
Instagram/Facebook Ad
-> /agents landing page
-> example seller report preview
-> agent pain-point framing
-> email capture
-> account creation
-> property creation flow
-> guided dashboard
-> agent subscription
```

## 4.3 Provider Funnel
```text
Instagram/Facebook Ad or outbound outreach
-> /providers landing page
-> provider benefits
-> service category + ZIP input
-> signup
-> verification
-> billing
-> portal access
```

---

# 5. Landing Page Information Architecture

## 5.1 Root Route Strategy
Route `/` should not be a dense, generic landing page.

It should either:
- redirect to `/sell` by default, or
- present a clean role chooser:
  - I’m selling a home
  - I’m a real estate agent
  - I provide home services

### Recommendation
Use `/` as a role chooser and keep `/sell`, `/agents`, and `/providers` dedicated.

---

# 6. Seller Landing Page — Production Spec

## 6.1 Purpose
This is the main revenue page.

It must:
- reduce hesitation
- start the experience quickly
- demonstrate value before signup
- hand users into the existing seller workflow cleanly

---

## 6.2 Seller Landing Page Structure

### Section 1 — Hero
**Headline:**  
Sell your home with a plan — not a guess.

**Subheadline:**  
Get pricing guidance, prep recommendations, photo help, and provider matches in minutes.

**Primary CTA:**  
Start your selling plan

**Secondary CTA:**  
See how it works

### Section 2 — Fast Value Bar
Three short value cards:
- Smart pricing guidance
- Guided prep checklist
- Help from local providers

### Section 3 — Mini Onboarding
Embed the first steps of the app:
- property address
- property type
- beds / baths / square footage

This should feel like:
> “Start here. We’ll guide the rest.”

### Section 4 — Preview Result
Show a partial result:
- rough value range
- 1–2 checklist recommendations
- market-ready score preview
- blurred or locked deeper results

### Section 5 — Email Capture Gate
Once user sees enough value to care, require:
- email
- password or magic-link/OTP continuation

### Section 6 — How It Works
Simple 3-step explanation:
1. Enter your property
2. Get your plan
3. Prepare and market smarter

### Section 7 — Provider Support
Show categories:
- cleaners
- photographers
- stagers
- landscapers
- inspectors
- handymen

### Section 8 — Social Proof / Trust
Initial placeholder structure:
- “Built for homeowners and real estate professionals”
- future testimonials
- trust language around provider verification

### Section 9 — Pricing / Unlock
Simple subscription framing:
- free preview
- paid full plan / active property access

### Section 10 — Final CTA
Repeat:
Start your selling plan

---

## 6.3 Seller Landing Page Conversion Rules
### Must do:
- let user begin before signup
- show meaningful partial value
- gate before full result
- push into existing workflow state

### Must not do:
- force login at top of page
- show giant feature dumps
- show too many navigation choices
- ask for payment before value

---

# 7. Agent Landing Page — Production Spec

## 7.1 Positioning
Agents should not be sold “AI.”
They should be sold:
- faster listing prep
- better seller presentations
- more professional materials
- stronger differentiation

---

## 7.2 Agent Landing Page Structure

### Hero
**Headline:**  
Win more listings. Get homes market-ready faster.

**Subheadline:**  
Use branded reports, pricing guidance, guided prep flows, and provider coordination to move listings forward with less friction.

**Primary CTA:**  
Get agent access

### Proof Blocks
- polished seller reports
- listing prep workflows
- reusable process across properties
- active property capacity model

### Mini Demo
Show:
- example report
- example checklist
- example seller-facing workflow rail

### Agent CTA Gate
Prompt for:
- email
- brokerage
- name

### Pricing Framing
Agent plans should be framed around:
- active properties
- workflow capacity
- report + brochure creation
- seller-facing professionalism

---

# 8. Provider Landing Page — Production Spec

## 8.1 Positioning
Providers should feel:
- this is a real opportunity
- these are real homeowner jobs
- verification improves trust and lead quality

---

## 8.2 Provider Landing Page Structure

### Hero
**Headline:**  
Get high-intent seller jobs delivered to you.

**Subheadline:**  
Join the Workside provider network and receive local service requests from homeowners and agents preparing homes for market.

**Primary CTA:**  
Join provider network

### Value Cards
- qualified local demand
- trust badges and verification
- simple lead workflow
- profile visibility

### Service Category Selector
Let providers indicate:
- category
- ZIP
- service radius

### Trust Section
Explain:
- self-reported trust fields
- verification
- optional document uploads
- provider ranking impact

### CTA
Start provider signup

---

# 9. Instagram / Facebook Funnel Implementation

## 9.1 Traffic Source Strategy

### Seller campaigns
Run campaigns pointing to:
- `/sell?src=ig-seller`
- `/sell?src=fb-seller`

### Agent campaigns
Run campaigns pointing to:
- `/agents?src=ig-agent`
- `/agents?src=fb-agent`

### Provider campaigns
Run campaigns pointing to:
- `/providers?src=ig-provider`
- `/providers?src=fb-provider`

---

## 9.2 Campaign Types

### Sellers
1. awareness ads
2. value-demo ads
3. retargeting ads

### Agents
1. listing-win ads
2. report-demo ads
3. retargeting ads

### Providers
1. join-network ads
2. category-specific ads
3. retargeting ads

---

## 9.3 Seller Ad Flow
```text
Ad click
-> /sell landing
-> address entered
-> preview result
-> email capture
-> auth continuation
-> property dashboard
-> subscription conversion
```

### Seller ad messaging themes
- pricing clarity
- sell smarter
- prep plan in minutes
- know what to do first

---

## 9.4 Retargeting Logic
Retarget users who:
- visited landing page but did not start input
- entered address but did not continue
- reached email gate but did not submit
- created account but did not subscribe

### Retargeting examples
- “See your full selling plan”
- “Unlock your prep checklist”
- “Finish getting your home market-ready”

---

# 10. Production Conversion Mechanics

## 10.1 Progressive Commitment
Do not ask for everything at once.

### Recommended sequence
1. address
2. property basics
3. preview result
4. email capture
5. account completion
6. full dashboard
7. billing prompt

---

## 10.2 Value Gating
### Show before signup:
- basic estimated range
- one checklist recommendation
- basic market-ready score preview

### Lock until signup:
- full report
- provider shortlist
- report export
- saved property state
- deeper checklist details

---

## 10.3 Billing Timing
Do not show billing immediately.

Billing should appear:
- after property creation
- after partial value is visible
- after user understands what the subscription unlocks

### Billing prompt examples
- Unlock full seller plan
- Activate your property workspace
- Continue with full checklist, provider help, and exports

---

# 11. Codex Instructions — Landing Pages

## 11.1 Build Scope
Codex should build:
- `/`
- `/sell`
- `/agents`
- `/providers`

### Rule
Do not overcomplicate. Start with conversion-first v1 pages, not content-heavy marketing sites.

---

## 11.2 Codex Requirements
### General
- use shared design system components
- keep pages fast and lightweight
- mobile-first responsive design
- no feature clutter above the fold
- all landing CTAs should push into first meaningful action

### Seller page
- hero
- mini onboarding widget
- preview result shell
- email capture modal
- CTA sections
- FAQ section stub

### Agent page
- hero
- branded workflow blocks
- report preview shell
- CTA sections

### Provider page
- hero
- category + ZIP capture
- provider benefits
- trust badge explanation
- CTA sections

---

## 11.3 Codex Component Structure
```tsx
/routes
  LandingChooserPage.tsx
  SellerLandingPage.tsx
  AgentLandingPage.tsx
  ProviderLandingPage.tsx

/components/landing
  HeroSection.tsx
  ValueCardRow.tsx
  MiniOnboardingCard.tsx
  ResultPreviewCard.tsx
  EmailGateModal.tsx
  HowItWorksSection.tsx
  PricingTeaserSection.tsx
  FinalCTASection.tsx
  RoleChooser.tsx
```

---

## 11.4 Codex Event Handling Requirements
### Track these events:
- landing_viewed
- mini_onboarding_started
- address_entered
- preview_generated
- email_gate_viewed
- email_submitted
- signup_completed
- subscription_prompt_viewed
- subscription_started
- subscription_completed

### Include source tags:
- source
- campaign
- adset
- medium
- route

---

# 12. Production React Route / Component Specification

## 12.1 Route Map
```ts
export const routes = {
  root: '/',
  sell: '/sell',
  agents: '/agents',
  providers: '/providers',
  dashboard: '/dashboard',
  property: '/properties/:propertyId',
  signup: '/signup',
}
```

## 12.2 Seller Page Component Tree
```tsx
<SellerLandingPage>
  <HeroSection />
  <TrustStrip />
  <ValueCardRow />
  <MiniOnboardingCard />
  <ResultPreviewCard />
  <HowItWorksSection />
  <ProviderSupportSection />
  <PricingTeaserSection />
  <FAQSection />
  <FinalCTASection />
  <EmailGateModal />
</SellerLandingPage>
```

---

# 13. API Contracts

## 13.1 Landing Preview Endpoint
Used before signup.

### Request
`POST /api/public/seller-preview`

```json
{
  "address": "123 Main St",
  "city": "Bakersfield",
  "state": "CA",
  "postalCode": "93301",
  "propertyType": "single_family",
  "bedrooms": 3,
  "bathrooms": 2,
  "squareFeet": 1800,
  "source": "fb-seller"
}
```

### Response
```json
{
  "estimatedRange": {
    "low": 410000,
    "mid": 435000,
    "high": 460000
  },
  "marketReadyScore": 42,
  "previewChecklistItems": [
    "Declutter primary living areas",
    "Improve exterior first impression"
  ],
  "previewProviderCategories": [
    "cleaners",
    "photographers"
  ],
  "requiresSignupForFullPlan": true
}
```

---

## 13.2 Email Capture Endpoint
`POST /api/public/funnel-capture`

```json
{
  "email": "user@example.com",
  "roleIntent": "seller",
  "source": "ig-seller",
  "previewContext": {
    "address": "123 Main St"
  }
}
```

---

## 13.3 Signup Continuation Endpoint
`POST /api/public/continue-signup`

Should:
- create or continue auth flow
- create draft property if applicable
- attach source attribution
- route into guided workflow

---

# 14. Subscription / Billing Trigger Points

## 14.1 Seller Billing Trigger
Show billing prompt when user tries to:
- save full property plan
- unlock full checklist
- generate report
- export flyer
- access provider shortlist persistence beyond preview

## 14.2 Agent Billing Trigger
Show billing prompt when user tries to:
- create active listing workspaces beyond plan capacity
- generate branded report package
- use agent-only workflow features

## 14.3 Provider Billing Trigger
Show billing prompt when provider:
- completes signup
- reaches plan selection
- wants featured placement or premium visibility

---

# 15. Analytics and Event Tracking

## 15.1 Event Schema
```ts
type AnalyticsEvent = {
  name: string
  userId?: string
  anonymousId?: string
  roleIntent?: 'seller' | 'agent' | 'provider'
  propertyId?: string
  source?: string
  campaign?: string
  route?: string
  payload?: Record<string, unknown>
  createdAt: string
}
```

## 15.2 Must-Track Funnel Events
- seller_landing_viewed
- seller_preview_started
- seller_preview_completed
- seller_email_gate_viewed
- seller_email_submitted
- seller_signup_completed
- seller_property_created
- seller_subscription_prompt_viewed
- seller_subscription_completed

Equivalent sets should exist for agents and providers.

---

# 16. Next 5 Most Important and Critical Features

Based on current status and launch-critical gaps in the project checkpoint, these are the next 5 highest-priority features to implement. fileciteturn1file0

## 1. Seller Conversion Landing Funnel
Why:
- This is the shortest path from traffic to revenue.
- Existing product value is strong enough to monetize if the landing flow is correct.

Includes:
- `/sell` landing
- mini onboarding
- preview result
- email gate
- subscription trigger

---

## 2. Guided Workflow Expansion Into Auth / Onboarding
Why:
- Current workflow begins at property level, but the project status explicitly notes onboarding should receive the same guided treatment. fileciteturn1file0

Includes:
- account creation guidance
- first property creation guidance
- dependency explanations for blocked steps

---

## 3. Provider Billing Validation and Subscription State Hardening
Why:
- It is explicitly called out as launch-critical unfinished work. fileciteturn1file0
- Provider monetization breaks trust if billing is not fully reliable.

Includes:
- live provider signup test
- subscription webhook verification
- featured placement validation

---

## 4. Provider Coverage / No-Coverage UX and Fallback Clarity
Why:
- Marketplace trust depends on never leaving sellers at a dead end.
- Current Google fallback remains inconsistent. fileciteturn1file0

Includes:
- “no providers in area yet” flow
- precedence for Workside providers
- clearer Google fallback presentation

---

## 5. Report / Flyer Premium Output Upgrade
Why:
- This is a direct subscription justification point.
- Current reports and brochure outputs work, but still need premium polish. fileciteturn1file0

Includes:
- better layout
- better visual finish
- stronger seller-facing presentation

---

# 17. Next 10 Most Important and Critical Features

## 1. Seller landing + conversion funnel
## 2. Guided onboarding expansion
## 3. Provider billing validation
## 4. Provider coverage + no-coverage UX
## 5. Vision quality refinement
## 6. Report / brochure premium redesign
## 7. Provider account recovery / linking
## 8. Provider trust system maturity (expiry alerts, review history, admin follow-up)
## 9. Property billing / capacity model refinement
## 10. Minimum automated test coverage for auth, billing, provider flows

These align tightly with the checkpoint’s Priority 0 / Priority 1 work and launch-critical reliability gaps. fileciteturn1file0

---

# 18. Recommended Build Order

## Phase 1 — Conversion Infrastructure
1. landing routes
2. mini onboarding preview endpoint
3. email gate
4. event tracking
5. source attribution persistence

## Phase 2 — Seller Funnel
6. seller landing page
7. preview result UI
8. signup continuation
9. billing trigger integration

## Phase 3 — Agent + Provider Funnel
10. agent landing page
11. provider landing page
12. provider ZIP/category prefill flow

## Phase 4 — Workflow Continuity
13. handoff into guided onboarding
14. dependency and blocked-state explanations
15. full dashboard continuity

## Phase 5 — Monetization Hardening
16. subscription event tracking
17. retargeting-ready audience events
18. upgrade prompts
19. report/flyer premium upsell positioning

---

# 19. Explicit Codex Build Instructions

## 19.1 Seller Landing
Implement `/sell` first.
Do not wait for all landing pages to be perfect before shipping seller.

### Requirements
- fast page load
- prominent hero
- embedded mini onboarding
- preview result card
- email gate modal
- CTA into existing seller app flow
- source attribution persistence

### Must integrate with:
- pricing/comps data pathway
- guided workflow continuation
- seller property creation flow
- billing chooser / active-property capacity

---

## 19.2 Agent Landing
Implement after `/sell`.

### Requirements
- strong listing-win messaging
- sample report shell
- CTA into agent auth flow
- billing framed around active property capacity and professional outputs

---

## 19.3 Provider Landing
Implement after seller and agent.

### Requirements
- category + ZIP capture
- provider benefits
- trust / verification explanation
- CTA into provider signup
- billing continuation handoff

---

## 19.4 Event Tracking
Codex must not ship landing pages without tracking events. Funnel optimization depends on analytics from day one.

---

# 20. Final Product Direction

The product is now technically broad enough. The next major leap is not more infrastructure — it is:

> **turning curiosity into subscriptions through guided, low-friction entry points**

The landing pages should not merely explain Workside.

They should:
- start the experience
- demonstrate value
- create momentum
- hand users into a guided, monetized product flow

That is the production-grade next step.

---
# 21. Suggested Immediate Task Checklist

## Landing / Funnel
- [ ] Build `/sell`
- [ ] Build public preview endpoint
- [ ] Add preview result card
- [ ] Add email gate
- [ ] Add source tracking
- [ ] Add subscription trigger after full unlock point

## Agent / Provider
- [ ] Build `/agents`
- [ ] Build `/providers`
- [ ] Add role-specific CTA flows

## Conversion Ops
- [ ] Add Meta pixel / event bridge if desired later
- [ ] Add ad attribution persistence
- [ ] Add re-engagement event list

## Core Product
- [ ] Extend workflow to onboarding
- [ ] Validate provider billing
- [ ] Improve provider coverage UX
- [ ] Polish premium documents
- [ ] Improve vision quality

---

# 22. Final Note

Once you finish testing the full sequence and share updated screenshots, the next review should focus on:
- UX friction
- layout hierarchy
- mobile clarity
- button priority
- messaging density
- conversion loss points

That review will be much more valuable once the funnel and sequence are fully wired.
