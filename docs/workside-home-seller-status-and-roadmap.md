# Workside Home Seller Status And Roadmap

Last updated: 2026-03-27

This document is the working reference for what has already been built in the `HomeAdvisor` monorepo and what remains to take the product from a strong prototype to a polished production system.

Related strategy references:

- `docs/How to make money.md`
- `C:\Users\sjroy\Downloads\workside-strategy-seller-vs-realtor.md`

## 1. Product Vision

Workside Home Seller Assistant is a seller-facing platform with:

- a web portal for onboarding, pricing, and property workspace management
- an Expo-managed mobile app for in-field seller workflows, especially photo capture
- an API/backend that combines MongoDB Atlas, RentCast, Google Cloud, SendGrid, and OpenAI
- AI guidance for pricing, prep, improvements, marketing, timing, and property presentation

Longer term, the product should help sellers:

- understand likely pricing and confidence
- identify strongest nearby comps
- decide what to improve before listing
- capture better listing photos
- receive AI feedback on photo quality and content gaps
- generate marketing copy and listing collateral
- automatically create a property flyer for sale or rental use

Expanded strategic direction:

- support both individual sellers and real estate professionals
- become an AI operating system for preparing and presenting a home
- eventually connect listing prep and listing communications through Merxus AI

## 1.1 Audience Strategy

### Seller Mode

- guided
- simplified
- confidence-building
- optimized for DIY sellers and low-friction acquisition

### Realtor / Agent Mode

- faster
- more customizable
- presentation-ready
- optimized for listing appointments and client-facing value delivery

Core workflow for both:

Property -> Pricing -> Photos -> Improvements -> Flyer -> Export

## 1.2 Monetization Strategy

Recommended revenue structure:

- Seller: low-friction revenue, not the primary revenue engine
- Realtor / Agent: recurring subscription revenue, primary growth path
- Merxus bundle: later-stage cross-product bundle

Recommended commercial direction:

- seller plan: free tier plus one-time unlock or light subscription
- agent plans: subscription tiers such as Starter, Pro, Team
- bundle later with Merxus AI for listing-to-lead lifecycle value

## 2. What Has Been Completed

### 2.1 Monorepo And App Foundation

- [x] Monorepo scaffolded under a single repository
- [x] Next.js seller-facing web app created in `apps/web`
- [x] Expo-managed React Native mobile app created in `apps/mobile`
- [x] Fastify API created in `apps/api`
- [x] Internal admin shell created in `apps/admin-web`
- [x] Shared packages created for branding, prompts, validation, utilities, and config
- [x] Production-oriented folder structure documented and working

### 2.2 Backend, Data, And Environment

- [x] MongoDB Atlas selected and integrated as the primary database
- [x] Root environment loading fixed so local scripts read the correct `.env`
- [x] Property persistence implemented
- [x] Pricing analysis persistence implemented
- [x] Media metadata persistence implemented
- [x] Shared config and env examples updated for current stack

### 2.3 Authentication

- [x] Email + password signup flow implemented
- [x] Email OTP verification flow implemented
- [x] Login flow implemented
- [x] OTP resend/request flow implemented
- [x] JWT session issuance implemented
- [x] Web app auth wired to live backend
- [x] Mobile app auth wired to live backend

### 2.4 Email Delivery

- [x] Console email mode supported for local/debug use
- [x] SMTP mode supported in backend email service
- [x] SendGrid mode implemented
- [x] Welcome email sent after successful email verification
- [x] OTP email templates upgraded from utility style to branded product email style
- [x] Welcome email template upgraded with clearer branding and onboarding tone
- [x] Gmail delivery verified

Notes:

- Corporate mailbox delivery has shown filtering behavior outside the app itself.
- Domain authentication and sender verification exist in SendGrid, but enterprise inbox handling may still require safelisting.

### 2.5 Pricing And Market Data

- [x] RentCast selected as primary comps/data provider
- [x] RentCast client implemented
- [x] RentCast AVM and sale-listing retrieval implemented
- [x] Comparable normalization implemented
- [x] Comparable filtering rules implemented
- [x] Comparable scoring implemented
- [x] Price band generation implemented
- [x] Pricing narrative generation implemented
- [x] Pricing analysis saved to MongoDB
- [x] Web dashboard wired to live pricing analysis
- [x] Pricing refresh available from seller workspace
- [x] Zero-dollar fallback issue fixed by improving comp handling and AVM fallback behavior

Current pricing status:

- The system is now producing a believable price band for the known Bakersfield test property.
- Example observed output: approximately `$370,000` to `$409,000`, midpoint around `$389,000`.
- This is directionally aligned with third-party market references and is a strong improvement over the earlier `$0 to $0` failure mode.

### 2.6 OpenAI Integration

- [x] OpenAI Responses API wired into backend workflows
- [x] Structured JSON generation implemented for pricing insights
- [x] Improvement recommendations flow scaffolded
- [x] Marketing suggestions flow scaffolded
- [x] Timing guidance flow scaffolded
- [x] Document drafting flow scaffolded
- [x] Fallback behavior implemented when OpenAI is unavailable

### 2.7 Seller Web App

- [x] Live auth connected
- [x] Property creation flow connected
- [x] Property selection connected
- [x] Dashboard snapshot connected to live backend
- [x] Property workspace page connected
- [x] Pricing analysis action connected
- [x] Human-readable toast messaging implemented
- [x] Raw JSON/Zod validation dumps replaced with cleaner user-facing errors
- [x] Body-less POST pricing bug fixed in shared API helper
- [x] Property workspace comp cards improved
- [x] Property workspace map section added
- [x] Flyer generation now scrolls users directly to the preview state

### 2.8 Mobile App

- [x] Expo-managed app created and running
- [x] Android emulator flow working
- [x] iOS device/debug flow working
- [x] Mobile login/OTP flow connected to backend
- [x] Mobile property loading working
- [x] Mobile pricing refresh working
- [x] Camera capture flow implemented
- [x] Photo library selection implemented
- [x] AI photo analysis endpoint connected to mobile app
- [x] Mobile login wording cleaned up for clearer UX
- [x] Entry-point and React-version issues resolved for Expo/native builds

### 2.9 Media And Photo Storage

- [x] Photo analysis endpoint created in backend
- [x] Media records stored in MongoDB
- [x] Mobile photo gallery for a property implemented
- [x] Local disk media storage path implemented for development
- [x] Google Cloud Storage storage provider implemented
- [x] API route for serving stored media files implemented
- [x] Cloud Run/GCS storage path documented

Important note:

- New uploads can use GCS in production once Cloud Run is deployed with `STORAGE_PROVIDER=gcs`.
- Existing locally stored test assets are not automatically migrated.

### 2.10 Deployment And Hosting

- [x] Web app deployed to Netlify
- [x] API deployed to Google Cloud Run
- [x] MongoDB Atlas connected to deployed backend
- [x] RentCast connected to deployed backend
- [x] OpenAI connected to deployed backend
- [x] Cloud Build and Cloud Run deployment docs created
- [x] Google Cloud Storage media deployment docs created
- [x] Netlify monorepo build path clarified

### 2.11 CI And Developer Experience

- [x] GitHub Actions CI fixed to use `npm` instead of `pnpm`
- [x] `.gitignore` improved for local build/debug artifacts
- [x] Local output/debug file noise reduced
- [x] Build verification has been run repeatedly across the workspace

### 2.12 Flyers, Documents, And Billing Hooks

- [x] AI flyer draft generation implemented for sale and rental use
- [x] Flyer drafts saved in MongoDB
- [x] Flyer preview UI added to the property workspace
- [x] First-pass flyer PDF export endpoint implemented
- [x] Flyer PDF download control added to the web app
- [x] Stripe checkout UI added to the dashboard
- [x] Demo/sample Stripe plans added for low-cost live testing

## 3. Current Product Strengths

- The seller can sign up, verify email, sign in, create/select a property, and run pricing analysis.
- Web and mobile are both talking to the same live backend.
- Real data services are involved: MongoDB Atlas, RentCast, OpenAI, SendGrid, and Google Cloud.
- Photo capture and AI-based photo feedback are already started, which is a major differentiator.
- The product has moved beyond static mockups into a functioning end-to-end system.

## 4. What Still Needs To Be Done

This section is the working checklist for the next waves of development.

### 4.1 Pricing And Comps Improvements

- [ ] show why each comp was selected
- [ ] display comp score, distance, recency, and similarity factors in the UI
- [ ] show whether pricing is:
  - comp-driven
  - AVM-assisted
  - AVM-fallback
- [ ] make confidence scoring more explainable to the user
- [ ] improve confidence calculation with more nuanced signals:
  - comp count
  - recency
  - variance
  - distance spread
  - property-type alignment
- [ ] capture and store more pricing debug metadata for review
- [ ] add seller-facing explanation for low-confidence scenarios
- [ ] allow controlled widening of radius/time filters in thin-comp markets
- [ ] consider using RentCast `/properties` support endpoint for additional validation/enrichment
- [ ] improve “selected comps” UI from a dense bullet list to clearer cards/table rows

### 4.2 Property Intake And Data Quality

- [ ] improve property creation form validation and UX
- [ ] support richer property fields:
  - year built
  - lot size
  - HOA
  - condition
  - upgrades
  - occupancy status
  - notes
- [ ] add editable seller goals and selling timeline
- [ ] support multiple property statuses:
  - draft
  - preparing
  - active
  - under contract
  - closed
- [ ] add data quality checks so incomplete property records are clearly flagged

### 4.3 Photo Capture And AI Evaluation

- [ ] improve the photo analysis prompt and schema so feedback is more actionable
- [ ] identify room type automatically where possible
- [ ] score photo quality dimensions such as:
  - lighting
  - framing
  - clutter
  - sharpness
  - horizontal alignment
  - feature emphasis
- [ ] give retake instructions that are simple and seller-friendly
- [ ] suggest missing shots for a complete listing package
- [ ] tell the seller which images should lead the gallery
- [ ] tell the seller which rooms should be re-shot after cleanup or staging
- [ ] add photo tagging and room categorization
- [ ] add thumbnail generation and upload resizing
- [ ] support multiple photos per room
- [ ] support batch analysis of a full photo set
- [ ] add in-app photo editing for listing photos
- [ ] support quick edits such as:
  - crop
  - rotate
  - brightness
  - straightening
  - light cleanup
- [ ] let sellers approve which mobile photos are eligible for flyer/export use
- [ ] sync selected listing photos cleanly from mobile into the web workspace

### 4.4 AI-Driven Improvement Guidance

- [ ] turn the current improvement flow into a first-class seller feature
- [ ] let AI recommend:
  - which rooms to paint
  - which repairs matter most
  - which updates have the best ROI
  - which projects should be skipped
- [ ] distinguish low-cost, mid-cost, and premium prep recommendations
- [ ] connect photo analysis with improvement suggestions
- [ ] build “most bang for the buck” prioritization
- [ ] add before-listing checklist generation from the improvement output

### 4.5 Automatic Flyer Generation

This is one of the most important next-level features and should become a first-class workflow.

- [ ] define flyer types:
  - for sale flyer
  - rental flyer
  - open house flyer
  - agent/shareable summary flyer
- [x] generate flyer content from:
  - property data
  - pricing analysis
  - feature highlights
  - selected photos
  - AI-generated marketing copy
- [x] let AI choose which photos should appear in the flyer
- [x] generate headline, subheadline, highlights, and CTA automatically
- [x] create first-pass PDF-ready flyer templates
- [x] support both web preview and downloadable PDF
- [ ] allow the seller to regenerate with different tones:
  - luxury
  - family-friendly
  - investor-oriented
  - rental-focused
- [ ] add compliance/disclaimer handling where needed
- [ ] support a rental flyer flow in addition to a sale flyer flow
- [ ] save flyer versions in MongoDB and object storage
- [ ] improve PDF export quality with:
  - stronger image placement
  - print-ready spacing
  - richer branding
  - multi-page layouts when needed
- [ ] add flyer sharing/export options beyond PDF

### 4.5.1 Flyer Monetization Hook

- [ ] treat flyer generation/export as a core paywall trigger
- [ ] let free users preview value before checkout
- [ ] gate export-quality flyer output behind paid plan or unlock
- [ ] support checkout trigger from “Generate Flyer” and “Export Flyer”
- [ ] design the paywall copy around outcomes, not features

### 4.6 Marketing And Listing Content

- [ ] improve AI-generated listing headlines and descriptions
- [ ] generate platform-tailored versions for:
  - flyer
  - MLS draft support
  - social post
  - email share
  - rental listing copy
- [ ] build feature-highlights UI into seller workspace
- [ ] let seller select tone and emphasis
- [ ] surface suggested best hero photo and photo ordering
- [ ] provide seller-facing guidance on:
  - where to market the property
  - how to position the listing
  - when to hold showings
  - what actions may improve response rate

### 4.7 Timing And Market Guidance

- [ ] expose timing guidance in the web/mobile UI
- [ ] improve “best listing day(s)” logic with clearer rationale
- [ ] incorporate seasonality and local listing activity where possible
- [ ] show simple seller-friendly explanation of timing confidence
- [ ] suggest ideal showing windows and open-house timing

### 4.8 Document And Drafting Workflows

- [ ] productize disclaimer-aware draft generation
- [ ] support seller-facing draft outputs such as:
  - prep plan
  - disclosure question checklist
  - showing readiness checklist
  - marketing summary sheet
- [ ] add non-binding seller agreement / sales agreement drafting with lawyer-review disclaimers
- [ ] make clear what is not legal advice
- [ ] add review warnings and required human review steps

### 4.9 Web App UX And Product Polish

- [ ] improve dashboard layout hierarchy
- [ ] create a true onboarding sequence instead of a mostly open dashboard
- [ ] add route guards and cleaner auth/session handling
- [ ] add loading, empty, and retry states everywhere
- [ ] improve property workspace visual presentation
- [ ] make comp displays, analysis cards, and AI cards easier to scan
- [ ] add a more intentional workflow for:
  - create property
  - analyze pricing
  - upload photos
  - review recommendations
  - generate flyer
- [ ] add better success states and progress indicators
- [ ] turn the new map section into a stronger neighborhood/context module

### 4.10 Mobile App UX And Product Polish

- [ ] improve mobile home/dashboard UX after login
- [ ] create a stronger “capture workflow” for room-by-room progress
- [ ] add visual checklist for required/ideal photo set
- [ ] allow upload status and retry behavior
- [ ] make the saved gallery more useful and more attractive
- [ ] support property switching and filtering more gracefully
- [ ] support offline-friendly capture queue for future enhancement

### 4.11 Admin Console

- [ ] define what admin users need to do
- [ ] add admin authentication and authorization
- [ ] expose pricing diagnostics and comp-debug views
- [ ] expose user/property/media management tools
- [ ] expose flyer generation review tools
- [ ] decide whether admin remains local-only or becomes separately deployed

### 4.12 Billing, Monetization, And Stripe

- [x] define Stripe product catalog
- [ ] create Stripe products such as:
  - `workside-home-advisor-seller`
  - `workside-home-advisor-agent`
  - future `workside-merxus-bundle`
- [ ] define Stripe price tiers for agent subscriptions
- [ ] define seller monetization model:
  - free tier
  - one-time unlock
  - or light subscription
- [x] implement Stripe checkout session creation endpoint
- [x] implement Stripe webhook endpoint
- [ ] handle webhook events:
  - `checkout.session.completed`
  - `invoice.paid`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- [x] store subscription state in MongoDB
- [x] create `subscriptions` collection
- [x] create `usageTracking` collection or equivalent usage model
- [x] implement feature gating based on subscription or unlock status
- [ ] gate high-value moments instead of hard-locking the whole app
- [ ] support free trial flow for agent plans
- [x] add first-pass billing/account management UI on web
- [ ] decide whether mobile routes to Stripe web checkout for paid features
- [ ] ensure iOS avoids in-app payment flow for this product and uses web checkout

### 4.17 Seller Checklist And Provider Marketplace

- [ ] add seller checklist schema and persistence
- [ ] add checklist UI with phases:
  - pre-listing
  - listing launch
  - under contract
  - closing
- [ ] add checklist progress widget to the dashboard
- [ ] add checklist item detail screens with education and next actions
- [ ] add provider schema and provider search API
- [ ] add Google Places integration for nearby providers
- [ ] normalize provider results and cache/store reusable providers
- [ ] add provider ranking logic that balances relevance, distance, rating, reviews, and sponsorship
- [ ] add saved providers and provider comparison flow
- [ ] add provider click/contact/save tracking
- [ ] add provider onboarding flow and provider-facing billing setup
- [ ] add provider analytics/admin moderation groundwork
- [ ] add clear sponsored-label and provider-disclaimer handling

### 4.18 Listing Vision Mode And Room Visualization

- [ ] add room visualization schema and storage
- [ ] add room classification workflow for uploaded photos
- [ ] support concept transforms such as:
  - declutter
  - paint color changes
  - flooring changes
  - light staging
  - combined mode
- [ ] store before/after variants with room metadata
- [ ] add before/after compare UI in web and mobile
- [ ] connect visualization output to pricing and prep recommendations
- [ ] connect improvement suggestions to nearby providers
- [ ] add conceptual-preview disclaimers everywhere this appears
- [ ] add safeguard limits and duplicate-job protection for visualization jobs

### 4.13 Realtor / Agent Mode

- [ ] define formal agent mode product requirements
- [ ] support faster property creation for agents
- [ ] add editable outputs for client-facing use
- [ ] add presentation mode for listing appointments
- [ ] add branding support for agent-facing deliverables
- [ ] let agents customize flyer, pricing narrative, and improvements output
- [ ] support multiple client properties with higher-volume workflows
- [ ] build agent-ready reports and presentation exports
- [ ] add “win more listings” messaging throughout the paid agent funnel
- [ ] define how seller mode and agent mode differ in UI and permissions

### 4.14 Merxus AI Integration

- [ ] define integration boundaries between Workside and Merxus AI
- [ ] decide whether Merxus integration is:
  - data-level
  - navigation-level
  - bundled billing
  - or all three
- [ ] identify first integration use cases for realtors:
  - inbound call handling
  - SMS follow-up
  - listing inquiry qualification
  - post-flyer lead response
- [ ] define cross-product identity/account strategy
- [ ] design future bundle offer for Workside + Merxus
- [ ] define shared CRM/contact touchpoints if applicable
- [ ] determine what signals from Workside should flow into Merxus

### 4.15 Infrastructure, Security, And Operations

- [ ] move all sensitive production secrets to Secret Manager where not already done
- [ ] rotate any credentials that were exposed during development/testing
- [ ] verify Cloud Run uses only current/valid secrets
- [ ] finish full Google Cloud Storage production cutover if not already completed in live env
- [ ] add image resizing and optimization pipeline
- [ ] add structured backend logging for pricing/media/email workflows
- [ ] add error monitoring and alerting
- [ ] add rate limiting and abuse protection for auth/email endpoints
- [ ] add stronger auditability for AI-generated outputs

### 4.16 Testing And Quality Assurance

- [ ] add unit tests for pricing engine
- [ ] add unit tests for comp normalization/filtering
- [ ] add integration tests for auth
- [ ] add integration tests for pricing analyze endpoint
- [ ] add integration tests for media upload flow
- [ ] add regression tests for email workflows
- [ ] create manual QA checklist for web
- [ ] create manual QA checklist for mobile
- [ ] create test property dataset for reliable verification

## 5. Recommended Next-Phase Priorities

If the goal is to take the product to the next level without spreading effort too thin, this is the recommended order.

### Phase 1: Strengthen Core Seller Experience

- [ ] improve comp explanations and confidence transparency
- [ ] polish property workspace UI
- [ ] improve create-property and onboarding flow
- [ ] improve selected-comp presentation

### Phase 2: Photo Intelligence

- [ ] make room-photo capture and AI evaluation a standout feature
- [ ] add room detection, retake guidance, and missing-shot suggestions
- [ ] connect photo insights to prep/improvement recommendations
- [ ] add photo editing and photo-selection workflow for flyer-ready images

### Phase 3: Flyer Generation

- [x] build automatic sale flyer generation
- [x] build automatic rental flyer generation
- [x] support template preview + PDF export
- [ ] store generated flyers and versions
- [ ] improve export quality, layout sophistication, and sharing options

### Phase 4: Monetization And Agent Mode

- [x] implement Stripe checkout + webhooks
- [x] implement feature gating
- [ ] launch initial agent subscription structure
- [ ] add agent mode and presentation-friendly output

### Phase 5: Seller Prep And Marketing System

- [ ] expand improvement recommendations into a true prep planner
- [ ] expand marketing outputs beyond one-off copy
- [ ] combine pricing, photos, and improvements into one listing-readiness workflow
- [ ] build checklist + provider marketplace flow

### Phase 6: Merxus And Internal Hardening

- [ ] define first Merxus integration points
- [ ] define/administer internal admin workflows
- [ ] improve observability and tests
- [ ] tighten security and deployment maturity

### Phase 7: Signature Differentiators

- [ ] launch Listing Vision Mode / room transformation previews
- [ ] connect visualization to prep ROI, pricing confidence, and provider monetization

## 6. Suggested “Next Level” Feature Ideas

These are additive ideas that fit the product direction well.

- [ ] AI-powered “best first 5 photos” selector
- [ ] room-by-room completeness score for listing readiness
- [ ] seller prep score with prioritized actions
- [ ] “should I list now or wait?” advisor
- [ ] AI-generated open house sheet
- [ ] AI-generated rental listing package
- [ ] one-click PDF flyer export with map/photo layout options
- [ ] room-by-room visualization previews before repainting or decluttering
- [ ] provider marketplace recommendations tied directly to AI improvement advice
- [ ] side-by-side “before cleanup vs after cleanup” recommendation engine
- [ ] advertiser/sponsor placements for title companies, inspectors, stagers, lenders, or photographers
- [ ] trusted-vendor recommendation slots tied to seller workflow
- [ ] realtor-branded seller presentation deck export
- [ ] Merxus-powered automated lead follow-up after flyer sharing
- [ ] bundled Workside + Merxus subscription plans

## 7. Immediate Practical Next Steps

These are the most sensible concrete next steps from today’s state.

- [ ] add comp-selection explanation and better comp UI
- [ ] add pricing debug metadata to saved analyses
- [ ] improve photo-analysis schema and user-facing output
- [ ] improve flyer PDF export quality and sharing controls
- [ ] expand map/neighborhood visuals in the property workspace
- [ ] begin checklist + provider marketplace schema work
- [ ] design the first pass of listing vision mode / room visualization
- [ ] define seller vs agent mode requirements before pricing/billing work expands
- [ ] define Stripe products, plans, and webhook data model
- [ ] improve seller onboarding and property workspace flow
- [ ] finish production media-storage verification on GCS
- [ ] rotate exposed credentials and confirm production secret handling

## 8. Summary

The project has moved well beyond a scaffold. It now has:

- real deployments
- real auth
- real pricing analysis
- real AI integration
- real mobile capture flow
- real media persistence

The biggest opportunities now are not “get it working” tasks. They are product-quality tasks:

- make pricing more explainable
- make photo intelligence more useful
- turn AI output into polished seller deliverables
- build flyer generation into a signature feature

That is the path from a functioning app to a category-defining seller assistant.
