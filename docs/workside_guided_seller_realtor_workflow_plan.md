# Workside Home Advisor — Guided Seller & Realtor Workflow Plan
## Codex-Ready Implementation Spec for Sidebar Wizard + Checklist Experience

**Version:** 1.0  
**Purpose:** Define two guided, low-friction, step-by-step experiences inside Workside Home Advisor:
1. Seller Guide
2. Realtor Guide

The goal is to help users move from account setup to market-ready materials with minimal thinking, clear next steps, and strong completion momentum.

---

# 1. Product Goal

Build a persistent guided workflow system that:
- reduces decision fatigue
- makes the platform feel simple
- shows users exactly what to do next
- adapts based on role (seller vs realtor)
- supports both web and mobile participation
- drives completion from signup to market-ready package

This should feel like:
- a sidebar wizard
- a progress checklist
- a coach inside the app

---

# 2. Core UX Principles

1. One next step at a time
2. Never leave the user wondering what to do next
3. Progress should always be visible
4. Tasks should be short, concrete, and actionable
5. Mobile capture should feel tightly connected to desktop workflow
6. Provider requests should be embedded naturally into the flow
7. Role-specific wording and sequencing should be used
8. The system should feel like a guided assistant, not a project manager

---

# 3. Two Guided Experiences

## 3.1 Seller Guide
Designed for homeowners preparing their own property for sale.

Focus:
- setup
- property info
- photos
- checklist completion
- provider requests
- report/brochure generation
- readiness for realtor or market

## 3.2 Realtor Guide
Designed for agents managing listing prep for a seller/client.

Focus:
- create seller/property
- pricing review
- media capture coordination
- provider orchestration
- listing material creation
- presentation readiness
- faster path to market

---

# 4. UX Delivery Format

## 4.1 Sidebar Wizard
A persistent right or left sidebar that shows:
- current phase
- current step
- next recommended action
- completion progress
- blockers / missing items

## 4.2 Checklist Panel
A role-specific checklist with:
- expandable sections
- status icons
- due-soon / incomplete indicators
- quick links into relevant screens

## 4.3 Mobile Companion Prompting
Inside mobile:
- focused prompts for photo capture
- room-by-room guidance
- upload confirmation
- what-next nudges

---

# 5. High-Level Guided Workflow

```text
Create account
  ->
Complete profile
  ->
Create/select property
  ->
Enter property details
  ->
Review pricing/comps
  ->
Capture/upload photos
  ->
Run AI photo review / vision enhancements
  ->
Complete prep checklist
  ->
Request providers if needed
  ->
Generate report + brochure/flyer
  ->
Review final materials
  ->
Ready for market
```

---

# 6. Seller Guide — Full Step-by-Step Flow

# Phase 1 — Account Setup

## Step 1: Create your account
Checklist item:
- Create seller account
- Verify email / OTP
- Log in successfully

Wizard copy:
- Let’s get your account ready.
- This only takes a minute.

Success state:
- account verified
- role = seller

---

## Step 2: Complete your profile
Checklist item:
- Full name
- Phone number
- Preferred contact method

Wizard copy:
- Help us personalize your experience.

Optional:
- timeline to sell
- whether working with an agent already

---

# Phase 2 — Start Your Property

## Step 3: Add your property
Checklist item:
- property address
- property type
- occupancy status

Wizard copy:
- Start with the property you want to prepare for sale.

UX notes:
- allow use my current property
- allow property nickname

---

## Step 4: Enter basic property details
Checklist item:
- bedrooms
- bathrooms
- square footage
- lot size
- year built
- standout features

Wizard copy:
- These details help us price, prepare, and market your home.

UX guidance:
- required vs optional clearly labeled
- save progress automatically

---

# Phase 3 — Understand Pricing

## Step 5: Review pricing insights
Checklist item:
- pricing analysis viewed
- comps reviewed
- initial pricing understanding confirmed

Wizard copy:
- See how your home compares before you do anything else.

Seller outcome:
- better confidence
- clearer expectations

Optional callout:
- You can share this with your realtor later.

---

# Phase 4 — Capture Photos

## Step 6: Capture photos with your phone
Checklist item:
- open mobile companion
- capture key rooms
- upload required room set

Required capture guidance:
- front exterior
- living room
- kitchen
- primary bedroom
- primary bathroom
- backyard / patio
- any standout features

Wizard copy:
- Use your phone to take photos room by room. We’ll guide you.

Mobile UX:
- room checklist
- sample shot examples
- retake support
- automatic upload confirmation

---

## Step 7: Review uploaded photos
Checklist item:
- all required photos uploaded
- blurry/weak photos flagged
- listing candidates selected

Wizard copy:
- Now let’s choose the best images for your listing materials.

UX notes:
- mark good for brochure
- mark good for listing
- reorder primary images

---

## Step 8: Enhance photos with AI
Checklist item:
- AI photo review run
- optional declutter applied
- preferred variants selected

Wizard copy:
- Want a cleaner, stronger first impression? We can enhance select images.

UX notes:
- keep optional
- explain before/after clearly
- make best variant obvious

---

# Phase 5 — Prepare The Home

## Step 9: Complete the prep checklist
Checklist item examples:
- declutter
- touch-up paint
- landscaping
- deep cleaning
- staging notes
- repairs needed

Wizard copy:
- This checklist helps you focus on the items that improve presentation and buyer confidence.

UX notes:
- progress score
- mark complete / not needed
- save notes

---

## Step 10: Request help from providers
Checklist item:
- view recommended providers
- request services needed
- save providers of interest

Provider categories:
- cleaners
- photographers
- stagers
- inspectors
- landscapers
- handymen
- junk removal
- pressure washing
- title / escrow / related future categories

Wizard copy:
- Need help? We’ll connect you with providers for the tasks you don’t want to handle yourself.

UX notes:
- embedded inside checklist
- no dead-end if no providers available
- fallback recommendations if marketplace is thin

---

# Phase 6 — Create Market Materials

## Step 11: Generate your seller report
Checklist item:
- report generated
- reviewed
- saved/exported

Wizard copy:
- We’ll turn your property details and photos into a polished report.

Seller-facing output:
- prep summary
- pricing snapshot
- key features
- readiness insights

---

## Step 12: Generate brochure / flyer
Checklist item:
- brochure created
- selected photos included
- reviewed for quality

Wizard copy:
- Create listing-style marketing materials in minutes.

UX notes:
- allow photo inclusion choices
- allow final review before export

---

# Phase 7 — Ready For Market

## Step 13: Final review
Checklist item:
- pricing reviewed
- photos selected
- checklist mostly complete
- providers contacted if needed
- report and brochure generated

Wizard copy:
- You’re almost market-ready. Let’s make sure nothing was missed.

Display:
- readiness score
- incomplete items
- quick links to fix gaps

---

## Step 14: Market-ready status
Checklist item:
- property marked ready

Wizard copy:
- Your materials are ready. You can now share them with your realtor or prepare to list.

Actions:
- download materials
- share with agent
- continue improving
- duplicate/update materials later

---

# 7. Realtor Guide — Full Step-by-Step Flow

# Phase 1 — Account Setup

## Step 1: Create realtor account
Checklist item:
- create account
- verify email / OTP
- role = agent

Wizard copy:
- Set up your agent workspace and start preparing listings faster.

---

## Step 2: Complete agent profile
Checklist item:
- name
- brokerage
- phone
- preferred contact method

Optional:
- brand profile / logo
- listing presentation preferences

Wizard copy:
- This helps personalize materials and future exports.

---

# Phase 2 — Create Client Property

## Step 3: Add seller/client property
Checklist item:
- property address
- seller/client association
- property nickname
- occupancy status

Wizard copy:
- Add the property you’re preparing so everything stays organized in one place.

Optional:
- invite seller later
- note whether seller is participating directly

---

## Step 4: Enter property basics
Checklist item:
- beds/baths/sqft
- lot / year built
- major features
- upgrades
- neighborhood notes

Wizard copy:
- Get the basics in place so pricing, media, and materials generate correctly.

---

# Phase 3 — Pricing & Positioning

## Step 5: Review pricing and comps
Checklist item:
- pricing analysis reviewed
- comps reviewed
- pricing strategy noted

Wizard copy:
- Use comps early so listing prep aligns with the expected market position.

Optional:
- save pricing notes
- flag for seller discussion

---

# Phase 4 — Capture / Collect Media

## Step 6: Capture or coordinate photo collection
Checklist item:
- photos captured via mobile or uploaded manually
- required room set complete
- weak assets flagged

Wizard copy:
- Capture the essential spaces first, then refine from there.

Paths:
- agent captures directly
- seller captures via mobile
- professional photographer later

Required images:
- exterior
- living room
- kitchen
- primary suite
- bathrooms
- yard / lot
- standout features

---

## Step 7: Review listing photo candidates
Checklist item:
- best assets selected
- reorder approved
- brochure/report inclusion selected

Wizard copy:
- Choose the images that tell the strongest listing story.

---

## Step 8: Run optional AI enhancements
Checklist item:
- AI review run
- selected enhancements approved
- best variants chosen

Wizard copy:
- Use AI selectively to strengthen presentation before generating materials.

---

# Phase 5 — Coordinate Prep Work

## Step 9: Use prep checklist
Checklist item:
- required prep items reviewed
- seller-facing tasks identified
- provider-needed tasks identified

Wizard copy:
- This becomes your prep roadmap for the seller.

UX notes:
- checklist can be shared with seller
- track complete / pending / delegated

---

## Step 10: Request and manage providers
Checklist item:
- services requested
- providers shortlisted
- lead requests sent

Wizard copy:
- Coordinate cleaners, photographers, stagers, inspectors, and more without leaving the workflow.

UX notes:
- providers tied to checklist items
- service-area aware recommendations
- graceful fallback if no providers available

---

# Phase 6 — Produce Listing Materials

## Step 11: Generate seller-facing report
Checklist item:
- report generated
- reviewed for professionalism
- shared/exported if needed

Wizard copy:
- Create a polished property prep report for the seller or your internal workflow.

---

## Step 12: Generate brochure / flyer
Checklist item:
- brochure created
- branding reviewed
- final export ready

Wizard copy:
- Build market-facing materials quickly once the media and prep work are in place.

---

# Phase 7 — Ready To Launch

## Step 13: Final listing prep review
Checklist item:
- pricing reviewed
- photos approved
- checklist mostly complete
- providers engaged if needed
- materials generated

Wizard copy:
- You’re close. Review the final gaps before taking the property live.

---

## Step 14: Market-ready state
Checklist item:
- listing prep marked complete

Wizard copy:
- The property is market-ready. Use the completed materials to launch confidently.

Actions:
- export brochure/report
- continue revising
- use as listing presentation asset
- share with seller

---

# 8. Shared Sidebar Wizard Structure

## 8.1 Sidebar Sections
Display:
- current phase
- current step
- completion percent
- quick actions
- missing items
- estimated time remaining

## 8.2 Example Sections
- Account
- Property
- Pricing
- Photos
- Prep
- Providers
- Materials
- Final Review

## 8.3 Status Indicators
- Not started
- In progress
- Complete
- Needs attention
- Blocked

---

# 9. Checklist Behavior

## 9.1 Checklist Requirements
Each item should have:
- title
- short description
- status
- action link
- optional skip / not needed
- optional notes

## 9.2 Checklist Logic
- auto-complete when data exists
- mark blocked if dependency missing
- allow manual completion where appropriate
- show why an item matters

## 9.3 Checklist Enhancements
- Recommended next step
- Fastest way to finish
- Missing items preventing market-ready status

---

# 10. Mobile Capture Experience

## 10.1 Mobile Entry Point
Inside seller or realtor flow:
- Capture photos on mobile

Possible actions:
- QR code to open mobile flow
- text link to mobile deep link
- continue on your phone prompt

## 10.2 Mobile Capture Sequence
1. choose property
2. show room-by-room checklist
3. show sample framing tips
4. capture / upload photo
5. confirm upload
6. move to next room
7. return summary screen

## 10.3 Mobile UX Rules
- one room at a time
- simple labels
- no clutter
- progress always visible
- obvious done state

---

# 11. Provider Discovery Integration

## 11.1 Trigger Points
Provider prompts should appear:
- when checklist item implies help is needed
- when user marks a task as need help
- after weak-photo or staging suggestions
- during final readiness review if prep gaps remain

## 11.2 Provider UX Copy
Examples:
- Need a cleaner for this?
- Want help with staging or photography?
- We found providers who can help with this task.

## 11.3 No-Coverage Fallback
If no providers exist:
- show no providers in your area yet
- show fallback options
- let user continue without getting stuck

---

# 12. Market-Ready Scoring

## 12.1 Purpose
Give users a simple sense of progress and readiness.

## 12.2 Inputs
- account/profile complete
- property details complete
- pricing reviewed
- photos uploaded
- selected images approved
- checklist completion
- provider requests initiated if needed
- report generated
- brochure generated

## 12.3 Output
Examples:
- 35% Ready
- 70% Ready
- 95% Market-Ready

## 12.4 Rules
Never block users entirely with the score.
Use it as guidance, not punishment.

---

# 13. Data Model Suggestions

```ts
type GuidedWorkflow = {
  id: string
  propertyId: string
  role: 'seller' | 'agent'
  phase: string
  currentStepKey: string
  completionPercent: number
  marketReadyScore: number
  steps: GuidedWorkflowStep[]
  createdAt: string
  updatedAt: string
}

type GuidedWorkflowStep = {
  key: string
  role: 'seller' | 'agent'
  phase: string
  title: string
  description: string
  status: 'not_started' | 'in_progress' | 'complete' | 'needs_attention' | 'blocked'
  actionUrl?: string
  isRequired: boolean
  canSkip?: boolean
  notes?: string
  completedAt?: string
}
```

---

# 14. Suggested Frontend Component Map

```text
GuidedWorkflowSidebar
GuidedWorkflowProgressCard
GuidedWorkflowChecklist
GuidedWorkflowStepItem
GuidedWorkflowPhaseGroup
RecommendedNextStepCard
MarketReadyScoreCard
MobileCaptureEntryCard
ProviderHelpPrompt
FinalReadinessSummary
```

---

# 15. Suggested API Surface

## Workflow
- GET /api/workflows/:propertyId
- POST /api/workflows/:propertyId/initialize
- PUT /api/workflows/:propertyId/steps/:stepKey
- POST /api/workflows/:propertyId/recalculate

## Mobile Capture
- POST /api/properties/:propertyId/mobile-capture/session
- POST /api/properties/:propertyId/photos

## Provider Assistance
- GET /api/properties/:propertyId/provider-suggestions
- POST /api/provider-requests

---

# 16. Recommended Initial Build Order

## Phase 1
- role-based workflow definition
- sidebar wizard
- checklist engine
- recommended next step logic

## Phase 2
- mobile capture integration
- provider prompt integration
- market-ready score

## Phase 3
- final readiness summary
- seller/realtor customization
- deeper automation and nudges

---

# 17. Acceptance Criteria

The feature is complete when:
1. Sellers see a guided path from signup to market-ready materials.
2. Realtors see a separate guided path optimized for listing preparation.
3. Users always know the next best action.
4. Mobile photo capture is clearly integrated into the workflow.
5. Provider requests are embedded naturally at the right moments.
6. The platform shows clear progress toward market-ready status.
7. There are no confusing dead ends in the core journey.

---

# 18. Final Recommendation

This should become one of the strongest UX differentiators in Workside Home Advisor.

If implemented well, the user experience becomes:
- simpler
- faster
- more confidence-building
- easier to finish

The goal is not to give users more tools.

The goal is to help them finish the process without thinking too much.
