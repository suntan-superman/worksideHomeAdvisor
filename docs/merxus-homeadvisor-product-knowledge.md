# Merxus Backend Product Knowledge Pack: Workside Home Advisor

Date: 2026-05-07

## Purpose

This document gives the Merxus AI backend enough Workside Home Advisor product and workflow knowledge to make the website chat widget useful beyond basic sales Q&A.

The goal is to reduce support and sales load by allowing the chat assistant to:

- answer public product questions clearly
- guide logged-in sellers and agents through the correct next step
- explain why a workflow step is blocked or recommended
- route billing, account, property, photo, pricing, provider, and report questions to the right action
- request human support only when account-specific intervention or a true failure is likely

## Product Summary

Workside Home Advisor is a seller-prep and listing-readiness platform. It helps a homeowner, seller, or real estate advisor move from property intake to pricing, photo readiness, prep guidance, provider coordination, and report/export generation.

The core promise:

- help the seller understand what to do next
- improve the presentation of the property
- support pricing and readiness decisions
- generate trustworthy outputs useful in real listing workflows

The canonical workflow is:

1. Onboarding
2. Pricing
3. Photos
4. Checklist
5. Providers
6. Reports

The expanded in-app guided workflow is:

1. Create account
2. Complete profile
3. Add property
4. Add property details
5. Review pricing
6. Capture or import photos
7. Review and select marketplace-ready photos
8. Optionally enhance photos with Vision
9. Work the prep checklist
10. Use providers where needed
11. Generate seller report
12. Create brochure or flyer
13. Final review

## Audience Modes

### Seller Mode

Seller mode should feel guided, simple, confidence-building, and optimized for DIY sellers or low-friction acquisition.

Best assistant tone:

- plain language
- reassuring but not overpromising
- focus on the next one or two actions
- avoid overwhelming with every feature at once

Seller framing examples:

- "Start with property details and pricing so the rest of the workspace has a solid base."
- "The next useful step is to add enough photos for the main rooms, then choose your best seller picks."
- "Your report will be stronger after pricing and at least three marketplace-ready photos are in place."

### Agent Mode

Agent mode should feel faster, more customizable, and presentation-ready. The agent likely cares about client-facing confidence, listing appointments, multiple properties, branding, and reusable outputs.

Best assistant tone:

- direct and workflow-oriented
- emphasize presentation-ready materials
- talk about comps, seller report, brochure, and repeatable property pipeline
- avoid sounding like a generic homeowner checklist

Agent framing examples:

- "For an agent workspace, confirm property facts first, review comps, then build the photo and report package for the seller conversation."
- "If you are preparing for a listing appointment, prioritize pricing, seller-report generation, and a clean brochure before optional Vision work."

### Provider Mode

Provider-facing flows exist for marketplace participation. Providers can create profiles, supply business/category/coverage details, provide verification documents, and manage marketplace status and billing.

Best assistant behavior:

- answer basic provider onboarding questions publicly
- direct provider users to `/providers/join` or `/providers/portal`
- escalate only for billing account mismatches, verification problems, or missing profile access

## Current App Surfaces

Public routes:

- `/` public seller landing
- `/sell` seller funnel
- `/agents` agent funnel
- `/providers` provider marketplace page
- `/providers/join` provider signup
- `/providers/portal` provider portal
- `/auth` login/signup/OTP
- `/privacy`
- `/terms`
- `/sms-consent`

Logged-in routes:

- `/dashboard`
- `/properties/:propertyId`

Important dashboard behavior:

- Lists properties owned by the logged-in user.
- Prompts the user to create the first property when none exist.
- Shows billing status and upgrade plans.
- Shows guided workflow state for the selected property.
- Shows readiness score, current phase, next action, phase progress, and provider highlights.

Important property workspace tabs:

- Overview
- Pricing
- Photos
- Vision
- Checklist
- Report
- Brochure

## Runtime Context The Backend Should Request Or Use

To make chat genuinely helpful for logged-in users, the frontend or backend should attach a lightweight HomeAdvisor context object to public chat requests when available.

Recommended context fields:

```json
{
  "product": "home_advisor",
  "tenantId": "home-advisor-platform",
  "user": {
    "id": "user id",
    "role": "seller | agent | provider | admin",
    "emailVerified": true,
    "isDemoAccount": false
  },
  "billing": {
    "planKey": "free | seller_unlock | seller_pro | agent_starter | agent_pro | agent_team | demo_bypass | admin_bypass",
    "status": "free | active | trialing | past_due | checkout_created | open | paid",
    "features": ["pricing.preview", "photo.capture.basic"],
    "propertyCapacity": {
      "activeCount": 1,
      "archivedCount": 0,
      "activeLimit": 1,
      "remainingActiveSlots": 0,
      "canCreateActiveProperty": false
    }
  },
  "selectedProperty": {
    "id": "property id",
    "title": "123 Main St",
    "status": "draft | active | archived",
    "addressComplete": true,
    "detailsComplete": true
  },
  "workflow": {
    "role": "seller",
    "currentPhase": "photos",
    "currentPhaseLabel": "Photos",
    "currentStep": "review_photos",
    "completionPercent": 46,
    "marketReadyScore": 58,
    "nextAction": {
      "key": "review_photos",
      "title": "Review your photos",
      "description": "Choose the best images for your listing.",
      "helperText": "3 marketplace-ready photos are recommended before report and brochure generation.",
      "actionTarget": "photos",
      "actionHref": "/properties/:propertyId"
    },
    "metrics": {
      "photoCount": 8,
      "roomCoverageCount": 4,
      "listingCandidateCount": 2,
      "explicitListingCandidateCount": 1,
      "preferredVariantCount": 0,
      "publishableVisionCount": 0,
      "reviewDraftCount": 1,
      "checklistProgress": 35,
      "providerLeadCount": 0
    },
    "readinessSummary": {
      "tone": "building",
      "label": "Foundation in place",
      "message": "You have 46% complete..."
    }
  }
}
```

Best backend behavior:

- If `workflow.nextAction` is present, use it as the primary answer for "what should I do next?"
- If `selectedProperty.status` is `archived`, explain that edits, new pricing runs, and new changes are blocked until the property is restored.
- If `billing.planKey` is `free`, explain free access limits before suggesting upgrade.
- If no selected property exists, guide the user to create a property from `/dashboard`.

## Logged-In Guidance Rules

### General "What should I do next?"

If workflow context is available:

1. State the current phase and readiness score.
2. Give the exact next recommended action.
3. Explain why that action matters.
4. Give the route or tab to open.
5. Mention one blocker only if relevant.

Example:

"You are in the Photos phase with a readiness score of 58/100. The next best step is to review your photos and mark at least three seller picks. Those photos feed the report and brochure, so getting the hero image set right will make the final materials stronger. Open the property workspace and go to the Photos tab."

If workflow context is not available:

"The usual order is property details, pricing, photos, checklist, providers, then report and brochure. If you are already logged in, open the dashboard and follow the recommended next action card."

### If No Property Exists

Recommend:

1. Open `/dashboard`.
2. Create the first property.
3. Enter address, city, state, ZIP, property type, bedrooms, bathrooms, and square feet.
4. After creation, run pricing analysis.

Do not recommend photo uploads, reports, or providers before property creation.

### If Property Details Are Incomplete

Recommend completing:

- address
- city/state/ZIP
- property type
- bedrooms
- bathrooms
- square feet
- year built if available
- notes or condition details if the UI supports them

Explain:

"Pricing, reports, and provider matching are only as good as the property facts. Finish the details before relying on comps or generated materials."

### If Pricing Is Missing

Recommend:

1. Open the property workspace.
2. Go to Pricing.
3. Run or refresh pricing analysis.
4. Review selected comps and price band.
5. Save a chosen list price if the user has one.

Explain:

- Pricing uses RentCast market data where available.
- The analysis produces a suggested low/mid/high range, confidence, selected comps, and pricing narrative.
- The chosen list price is separate from the suggested range and carries into future materials.

Do not say it is an appraisal. Use disclaimers:

"This is pricing guidance, not an appraisal, legal advice, tax advice, or brokerage advice."

### If Pricing Confidence Is Low

Possible reasons:

- too few nearby comps
- comps are older
- comps vary widely
- property data is incomplete
- thin market
- property type mismatch

Recommended answer:

"Low confidence usually means the comp set is thin or uneven. Confirm the property facts first, then review the selected comps. If the range still looks off, treat the midpoint as a starting point and use a local professional or agent for final pricing decisions."

### If Photos Are Missing

Recommend:

1. Add photos in the Photos tab or mobile app.
2. Prioritize core rooms:
   - living room
   - kitchen
   - primary bedroom
   - bathroom
   - exterior
3. Use bright natural light.
4. Stand in a room corner when possible.
5. Keep the camera level.
6. Reduce visible clutter before shooting.

Explain:

"Reports and brochures become much stronger once the app has a basic photo set. Start with coverage before optional enhancements."

### If Photos Exist But Seller Picks Are Low

The workflow expects at least three marketplace-ready or seller-selected photos before final materials are strong.

Recommend:

1. Open Photos.
2. Review each room group.
3. Mark strongest images as seller picks.
4. Use Details or Variations if needed.
5. Aim for at least three strong marketplace-ready photos.

Explain:

"Seller picks help the system decide which images should lead flyers, reports, and brochures."

### If Vision Is Available

Vision is a support feature, not the whole product. It should be framed as listing-readiness help.

Recommended order:

1. Import or capture original photos.
2. Select the photo that needs help.
3. Use Vision for first-impression cleanup or listing polish.
4. Review drafts.
5. Save the best publishable variant.
6. Use saved variants in materials only when they improve trust and presentation.

Do not overpromise perfect edits.

Allowed framing:

- "Vision can help improve first impression and presentation."
- "Use it selectively on photos that need polish."
- "Generated images should be reviewed before use in listing materials."

Avoid:

- "This will perfectly renovate the room."
- "This guarantees a higher sale price."
- "This is a replacement for professional photography."

### If Vision Is Locked

Likely cause:

- user is on free access or plan without Vision entitlement

Recommended answer:

"Basic photo capture is available now. Vision enhancements unlock on upgraded plans. You can still upload photos, mark seller picks, run pricing, and generate available teaser outputs depending on your plan."

### If Checklist Is Not Started

Recommend:

1. Open Checklist.
2. Review listing-prep phases.
3. Start with high-priority open tasks.
4. Mark tasks as todo, in progress, or done.
5. Add custom tasks for local or personal prep items.

Explain:

"The checklist turns pricing and photo observations into practical prep steps. Completing it increases readiness and improves final report quality."

### If Checklist Has Open Provider-Linked Tasks

Recommend:

1. Open Checklist.
2. Use Provider Suggestions for the linked task.
3. Review marketplace providers.
4. Use Google fallback if internal providers are unavailable.
5. Save up to five provider references.
6. Download the provider reference sheet if helpful.
7. Request a provider lead when ready.

Important disclaimers:

- Provider credentials may be self-reported or verified where indicated.
- Workside does not guarantee provider accuracy.
- Users should independently confirm licensing, insurance, pricing, availability, and scope.

### If No Internal Providers Are Available

Recommended answer:

"No internal marketplace providers are ranked for that task yet. You can still use Google fallback from the provider suggestions area, save external references to the provider sheet, and continue the rest of the workflow."

### If Report Is Missing

Recommend report generation after:

- property details are complete
- pricing is reviewed
- at least three strong photos are selected
- checklist has meaningful progress

If asked when to generate:

"You can generate a report earlier, but it will be stronger after pricing and photo picks are in place. If you are preparing a seller conversation, run pricing first, choose photos, then generate the report."

### If Brochure/Flyer Is Missing

Recommend brochure/flyer generation after:

- chosen list price is saved
- at least three strong photos are selected
- listing summary/copy is reviewed if available

Explain:

"The brochure and flyer pull from property details, pricing, selected photos, and generated copy. Better inputs produce better marketing materials."

### If Final Review Is Incomplete

Check common blockers:

- pricing not reviewed
- too few marketplace-ready photos
- checklist progress too low
- report missing
- brochure/flyer missing

Recommended answer:

"Final review usually becomes useful after pricing, photo picks, prep checklist progress, and materials are aligned. The dashboard next-action card should show the single blocker that matters most."

## Billing And Entitlements Knowledge

Base free features:

- `pricing.preview`
- `photo.capture.basic`

Seller plans:

- `seller_unlock`
  - one-time payment
  - one active property
  - unlocks fuller seller-ready outputs
  - features include pricing full, flyer generation/export, marketing export, client-ready reports

- `seller_pro`
  - subscription
  - up to three active properties
  - ongoing seller access for deeper pricing, exports, and AI guidance

Agent plans:

- `agent_starter`
  - subscription
  - up to five active properties
  - pricing full, flyer generation/export, marketing export, client-ready reports, presentation mode

- `agent_pro`
  - subscription
  - up to fifteen active properties
  - adds custom branding

- `agent_team`
  - subscription
  - up to fifty active properties
  - adds team/multi-user oriented access

Demo/admin:

- demo accounts may use `demo_bypass`
- admin/super admin users may use `admin_bypass`
- sample billing plans exist for low-cost Stripe flow testing

Billing guidance:

- If checkout succeeds but access has not updated, tell the user to refresh billing or wait briefly for Stripe sync.
- If the user has reached an active-property limit, recommend archiving an old property or upgrading.
- If checkout fails or plan state is inconsistent, escalate to human support.

Do not provide exact prices unless the backend has live Stripe `priceLabel` data. Prices are environment-configured.

## Public Sales Knowledge

### What Workside Home Advisor Does

It helps sellers and agents prepare a property for market by combining:

- property intake
- pricing guidance
- comp review
- photo capture/import
- photo readiness review
- optional Vision enhancements
- prep checklist
- provider suggestions
- seller reports
- brochures/flyers
- billing and plan gating

### What Makes It Different

Use this framing:

"Most tools stop at a valuation estimate or a marketing template. Workside Home Advisor connects pricing, photos, prep tasks, local provider support, and seller-ready outputs into one guided workflow."

### Who It Is For

- homeowners preparing to sell
- FSBO or DIY sellers who need structure
- real estate agents preparing listing appointments
- agent teams managing multiple properties
- providers who want marketplace visibility for seller-prep tasks

### What It Is Not

It is not:

- an appraisal
- legal advice
- tax advice
- brokerage advice
- inspection advice
- contractor advice
- a guarantee of sale price or sale outcome

## Common Intent Routing

### Sales Or Demo

Triggers:

- "pricing"
- "how much"
- "demo"
- "trial"
- "agent plan"
- "seller plan"
- "is this for realtors"

Answer with product fit and plan categories. Offer human handoff for demos or custom plan questions.

### Account/Login

Triggers:

- "can't log in"
- "OTP"
- "verify email"
- "password"

Guidance:

- Use `/auth`.
- Signup requires email/password and OTP verification.
- OTP can be requested/resend.
- If OTP emails do not arrive after checking spam/promotions and confirming email spelling, escalate.

### Property Setup

Triggers:

- "add home"
- "create property"
- "first property"
- "address"

Guide to `/dashboard` create property form.

### Pricing

Triggers:

- "comps"
- "RentCast"
- "price band"
- "confidence"
- "list price"
- "why is price wrong"

Guide to Pricing tab. Explain comp-driven guidance and disclaimers.

### Photos

Triggers:

- "upload photos"
- "seller picks"
- "marketplace ready"
- "photo capture"

Guide to Photos tab or mobile app. Emphasize core room coverage and seller picks.

### Vision

Triggers:

- "enhance"
- "declutter"
- "paint"
- "remove furniture"
- "before after"

Frame as optional photo-readiness support. Mention plan lock if applicable. Do not overpromise.

### Checklist

Triggers:

- "what repairs"
- "prep"
- "tasks"
- "what should I fix"

Guide to Checklist. Explain priority/status and readiness impact.

### Providers

Triggers:

- "find cleaner"
- "contractor"
- "stager"
- "photographer"
- "provider"
- "vendor"

Guide to provider suggestions from linked checklist tasks. Include provider disclaimers.

### Reports And Brochures

Triggers:

- "generate report"
- "flyer"
- "brochure"
- "PDF"
- "download"
- "marketing materials"

Guide to Report or Brochure tabs. Explain best inputs and plan limits.

### Billing

Triggers:

- "upgrade"
- "Stripe"
- "checkout"
- "plan"
- "subscription"
- "property limit"

Use billing context if available. Escalate if payment succeeded but access does not sync after retry/refresh.

## Recommended Answer Patterns

### Pattern: Logged-In Next Action

```text
You are currently in [phase] with a readiness score of [score]/100.

The next best step is [nextAction.title]. [nextAction.description]

Why it matters: [short explanation tied to pricing/photos/checklist/reports].

Open [route/tab]. [Mention blocker or plan limit only if relevant.]
```

### Pattern: Blocked Step

```text
That step is blocked because [blocking reason].

Finish [required prior step] first. After that, [blocked step] will make more sense because [why].
```

### Pattern: Human Handoff Avoidance

Before requesting human support, try:

1. Identify the user role.
2. Identify whether they are public or logged in.
3. Identify selected property and current phase.
4. Give one next action.
5. Provide route/tab.
6. Ask for clarification only if there are two plausible paths.

Escalate when:

- billing/payment state is inconsistent
- user cannot access their account after OTP/password steps
- uploaded media is missing after successful upload
- report/flyer job fails repeatedly
- user needs plan/account changes not exposed in UI
- user asks for sales/demo contact
- user explicitly asks for a person

## Backend Knowledge Implementation Suggestions

### Add HomeAdvisor-Specific Knowledge Module

Create a HomeAdvisor knowledge service similar to the Merxus knowledge base:

- `getHomeAdvisorKnowledgeReply(text, context)`
- `getHomeAdvisorTaskGuidanceReply(text, context)`
- `getHomeAdvisorDefaultKnowledgeReply(context)`

Use product key:

```js
product === "home_advisor"
```

### Prefer Runtime Context Over Static Answers

For logged-in sessions, static knowledge should be secondary to workflow state:

1. If `context.workflow.nextAction` exists and the user asks "what now", answer from it.
2. If user asks about a specific tab, answer with role and state-aware guidance.
3. If user asks a general product question, use public knowledge.
4. If user asks account-specific but no context exists, ask them to open the app/dashboard or request human support if necessary.

### Suggested Intent Labels

- `homeadvisor_sales`
- `homeadvisor_onboarding`
- `homeadvisor_login_otp`
- `homeadvisor_property_setup`
- `homeadvisor_pricing`
- `homeadvisor_photos`
- `homeadvisor_vision`
- `homeadvisor_checklist`
- `homeadvisor_providers`
- `homeadvisor_reports`
- `homeadvisor_brochure`
- `homeadvisor_billing`
- `homeadvisor_final_review`
- `homeadvisor_support_needed`

### Suggested Escalation Reasons

- `homeadvisor_demo_requested`
- `homeadvisor_billing_sync_issue`
- `homeadvisor_account_access_issue`
- `homeadvisor_media_upload_failure`
- `homeadvisor_job_failure`
- `homeadvisor_provider_issue`
- `homeadvisor_plan_or_limit_question`
- `homeadvisor_user_requested_human`

## Source Of Truth Notes

The app already exposes a guided workflow through:

- `GET /api/v1/properties/:propertyId/workflow?role=seller`
- `GET /api/v1/properties/:propertyId/workflow?role=agent`

The workflow returns:

- current phase
- current step
- completion percent
- market-ready score
- phase summary
- step list
- next action
- readiness summary
- photo/checklist/provider metrics

The Merxus backend should avoid recreating this logic when possible. It should consume this object and explain it conversationally.

## Short Default Public Answer

Use this when no specific intent is detected:

"Workside Home Advisor helps sellers and real estate agents move from property intake to pricing, photos, prep checklist, provider coordination, and seller-ready reports or brochures. If you are logged in, the dashboard shows your next recommended step for the selected property. The best order is property details, pricing, photos, checklist, providers, then reports and brochure."

