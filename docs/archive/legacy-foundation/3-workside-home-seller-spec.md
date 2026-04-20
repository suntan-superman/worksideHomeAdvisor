# Workside Software — AI Home Seller Assistant
## Full Product & Engineering Specification for Codex

**Document purpose:** This specification defines the MVP+ architecture, product scope, workflows, data model, AI behavior, compliance guardrails, and implementation plan for a Workside Software platform that helps homeowners prepare, price, market, and manage the process of selling a home.

**Primary goal:** Build a professional web + mobile platform with an AI backend that assists homeowners through the home-selling journey while promoting **Workside Software** as the software provider.

**Branding direction:**  
- Public-facing product should be branded **“Powered by Workside Software”**  
- No brokerage branding required at this stage  
- System should support future white-labeling, but current deployment should emphasize Workside Software exposure

---

# 1. Product Vision

Create an AI-powered real estate seller assistant that helps homeowners:

1. Understand likely listing price ranges based on nearby comparable sales, local market conditions, and property features  
2. Decide what improvements offer the best return before listing  
3. Determine which rooms to paint or update and what to leave alone  
4. Get photo, staging, and listing recommendations  
5. Generate marketing materials such as flyers and listing content from owner-uploaded photos and property details  
6. Get recommendations on best listing timing and launch strategy  
7. Draft real-estate-related documents and disclosures with clear disclaimers and jurisdiction-aware warnings  
8. Track tasks, documents, conversations, offers, and progress from one place  
9. Use both web and mobile portals with a shared AI system and common backend

---

# 2. Product Positioning

## 2.1 Core value proposition
This platform helps sellers make better, faster, and more profitable home-sale decisions without having to guess about pricing, improvements, timing, or presentation.

## 2.2 What makes it valuable
- AI-assisted pricing guidance using location, property details, and comps
- Practical “best bang for the buck” improvement guidance
- Seller-friendly recommendations in plain English
- Marketing asset generation from owner inputs
- One place for preparation, listing readiness, and transaction support
- Workside Software branding for credibility and exposure

## 2.3 What this is NOT
- Not a replacement for licensed legal counsel
- Not a replacement for licensed real estate brokerage services
- Not a guaranteed valuation engine
- Not a title/escrow system for MVP
- Not a substitute for licensed home inspection or contractor bids

---

# 3. User Types

## 3.1 Primary users
### Home Seller
A homeowner who wants help selling a home with minimal confusion.

### Seller Co-Owner / Spouse / Family Member
Additional household participant who can collaborate on tasks, uploads, photos, and decisions.

## 3.2 Secondary users
### Workside Admin
Internal user who manages tenants, moderation, quality review, templates, prompts, analytics, and support.

### Optional Future Role: Real Estate Professional
An agent, consultant, photographer, stager, or transaction coordinator invited into the workspace.

---

# 4. Platforms

## 4.1 Web portal
Primary workspace for:
- onboarding
- detailed property entry
- comp review
- AI reports
- task management
- flyer generation
- document drafting
- admin console

## 4.2 Mobile portal
Optimized for:
- capture/upload of property photos
- room-by-room walkthrough
- AI chat
- quick tasks
- document review
- alerts and reminders
- progress tracking
- offer updates
- checklist completion

## 4.3 AI backend
Central AI service supporting both web and mobile:
- structured property analysis
- comp interpretation
- pricing narratives
- room improvement suggestions
- marketing copy generation
- contract/disclosure drafting with disclaimers
- image selection suggestions
- seller Q&A

---

# 5. High-Level Feature Set

## 5.1 Seller onboarding
- account creation
- email/password or passwordless auth
- property address entry
- auto-fill property basics where available
- seller goals questionnaire
- timeline selection (urgent sale / normal / maximize profit)
- occupancy status
- budget for improvements
- target move date
- confidence level with DIY work

## 5.2 Property profile
- address
- home type
- year built
- square footage
- lot size
- bedrooms
- bathrooms
- garage
- pool
- upgrades
- HOA
- school district
- occupancy
- recent remodels
- known issues
- neighborhood notes
- view / cul-de-sac / corner lot / oversized lot / ADU / solar / RV parking / etc.

## 5.3 Comparable sales analysis
- map nearby sold listings
- filter by radius, beds, baths, square footage, lot, property type, age, condition
- identify strongest comps
- calculate similarity score
- create pricing range narrative
- explain tradeoffs
- show conservative / target / stretch pricing scenarios

## 5.4 AI pricing guidance
- recommend likely list price band
- explain reasoning
- identify factors helping value
- identify factors hurting value
- show confidence level
- show what changes could improve value before listing

## 5.5 Improvement recommender
- suggest highest ROI improvements
- recommend paint updates
- identify rooms to prioritize
- identify avoidable wasteful upgrades
- label each suggestion as:
  - must do
  - high ROI
  - optional
  - avoid
- estimate approximate cost range
- estimate likely buyer perception impact
- estimate likelihood of improving speed of sale

## 5.6 Room-by-room AI advisor
For each room:
- condition summary
- paint suggestion
- decluttering guidance
- lighting guidance
- furniture/staging suggestion
- repair recommendations
- “leave as-is” where appropriate
- photo readiness score

## 5.7 Marketing assistant
- listing headline suggestions
- short property description
- full listing description
- social media post ideas
- open house promo text
- neighborhood highlight copy
- buyer persona angle suggestions (family, first-time buyer, move-up buyer, retiree, investor)

## 5.8 Photo intelligence
- owner uploads photos
- AI groups photos by room
- suggests best hero image
- suggests photo order
- flags poor-quality images
- recommends retakes
- suggests missing shots
- identifies standout features to highlight
- creates photo shortlist for flyer/listing

## 5.9 Flyer generation
- generate printable flyer from uploaded photos + property data
- choose layouts
- export PDF
- Workside Software branding footer
- optional QR code to property microsite
- editable text blocks
- feature highlights automatically generated by AI

## 5.10 Best listing day / launch strategy
- recommend listing day(s)
- recommend listing season window
- recommend pre-market timeline
- recommend task sequence before going live
- explain that timing recommendations depend on local market conditions and available data

## 5.11 Document drafting
- draft:
  - listing agreement preparation notes
  - seller questionnaire summaries
  - repair addendum drafts
  - counteroffer language drafts
  - offer summary sheets
  - property fact sheets
  - marketing disclaimers
  - basic disclosure-support documents
- every drafted document must include clear disclaimers:
  - not legal advice
  - not brokerage advice
  - must be reviewed by licensed professionals in the applicable jurisdiction

## 5.12 Seller AI chat
Ask natural-language questions such as:
- “Should I paint the kitchen cabinets?”
- “Which repairs matter most?”
- “What price should I list at?”
- “Which photos should be first?”
- “What can I do with a $5,000 prep budget?”
- “How should I respond to a low offer?”

## 5.13 Checklist + project management
- pre-listing checklist
- improvement tracker
- photo shoot checklist
- document checklist
- showing readiness checklist
- offer review checklist
- escrow milestone checklist (future)

## 5.14 Notifications
- task reminders
- pending upload reminders
- doc review reminders
- flyer ready
- new AI recommendations
- offer status changes (future)
- “you’re ready to list” milestone

## 5.15 Admin console
- tenant/account management
- AI prompt version control
- output moderation flags
- template management
- analytics dashboard
- pricing/comps data pipeline monitoring
- legal disclaimer template management
- feature flags

---

# 6. Core User Flows

## 6.1 New seller journey
1. Create account
2. Verify email
3. Create property workspace
4. Enter address and property basics
5. Complete seller goals questionnaire
6. Upload room photos
7. AI creates readiness analysis
8. AI produces pricing range and top improvement suggestions
9. Seller reviews checklist
10. Seller generates marketing copy and flyer
11. Seller drafts relevant documents
12. Seller iterates until ready to list

## 6.2 Pricing flow
1. Seller opens Pricing tab
2. System loads nearby comps and filters
3. AI selects strongest comps and explains why
4. Seller sees value range
5. Seller adjusts condition assumptions
6. System recalculates pricing scenario
7. Seller saves recommended range

## 6.3 Improvement flow
1. Seller uploads photos or walks through room checklist
2. AI classifies rooms/features
3. AI suggests improvements ranked by ROI
4. Seller selects budget
5. System creates action plan
6. Seller tracks completed items

## 6.4 Flyer flow
1. Seller uploads photos
2. AI recommends top 5–10 images
3. AI drafts headline and feature bullets
4. Seller chooses flyer template
5. System renders flyer preview
6. Seller edits text
7. Export PDF

## 6.5 Document drafting flow
1. Seller chooses document type
2. System gathers property and transaction context
3. AI drafts structured content
4. System injects required disclaimers
5. Seller edits
6. Export / copy / share
7. Mark as “requires professional review”

---

# 7. Functional Requirements

## 7.1 Authentication
- email/password
- magic link optional
- social login optional future
- MFA optional future
- secure sessions
- role-based access control

## 7.2 Multi-property support
A seller can manage more than one property in the future, though MVP may default to one active property.

## 7.3 File uploads
Support:
- images
- PDFs
- DOCX
- spreadsheets (future)
- max upload size controls
- virus scanning
- metadata extraction
- image optimization

## 7.4 AI conversation history
- store chat history per property
- pin important answers
- promote AI advice to tasks
- allow “re-run analysis”

## 7.5 Reporting
- pricing summary report
- improvement report
- photo recommendations report
- market readiness report
- seller action plan
- flyer export
- draft documents

## 7.6 Search
Search within:
- property details
- tasks
- documents
- AI chat
- comps

## 7.7 Audit logging
Log:
- user actions
- document generations
- prompt versions
- AI output versions
- disclaimer acceptance
- admin actions

## 7.8 Security
- encryption in transit
- encryption at rest
- signed URLs for uploads
- role checks
- admin action logs
- prompt/output traceability

---

# 8. Non-Functional Requirements

## 8.1 Performance
- dashboard load under 3 seconds for normal scenarios
- AI first response under 8 seconds for simple chat
- heavier analysis under 20–30 seconds with progress indicators
- image upload progress and retry support

## 8.2 Reliability
- retries for AI workflows
- idempotent document generation jobs
- job queue for heavy processing
- graceful fallback for missing market data

## 8.3 Scalability
- multi-tenant ready architecture
- async job workers for image and report processing
- horizontal scaling for API + AI orchestration layers

## 8.4 Accessibility
- WCAG-aware UI
- keyboard navigation on web
- readable contrast
- clear error messages

## 8.5 Observability
- structured logs
- error tracking
- analytics
- AI prompt/output monitoring
- job status visibility

---

# 9. Recommended Tech Stack

## 9.1 Frontend
### Web
- React
- TypeScript
- Next.js or Vite-based React app
- Tailwind CSS
- React Query
- Zustand or Redux Toolkit for app state as needed
- Component library: shadcn/ui or equivalent

### Mobile
- React Native
- Expo managed workflow
- TypeScript
- React Navigation
- React Query
- Expo Image Picker / Camera / FileSystem / Notifications

## 9.2 Backend
- Node.js
- TypeScript
- NestJS or Express/Fastify with modular architecture
- PostgreSQL for structured data
- Redis for caching/jobs
- Object storage for media/documents
- Background job processor (BullMQ or equivalent)

## 9.3 AI backend
- LLM orchestration layer
- prompt templates with versioning
- structured JSON outputs
- RAG support for disclaimers/templates/knowledge base
- image-analysis pipeline for room/photo evaluation
- document generation service
- optional vector store for semantic retrieval

## 9.4 Maps / geo / comps
- Google Maps or Mapbox
- MLS / third-party data provider integration
- public records integration where licensing permits
- geocoding + radius search

## 9.5 Document / PDF generation
- server-side HTML-to-PDF generation
- DOCX template service optional
- flyer template renderer

## 9.6 Hosting
- GCP preferred for consistency with Workside stack
- Cloud Run / containerized services
- managed database
- managed Redis
- object storage bucket
- CDN for media delivery

---

# 10. Proposed System Architecture

## 10.1 Services
### 1. Identity Service
Auth, sessions, role management

### 2. Property Service
Property records, attributes, room data, upgrades, seller goals

### 3. Market Intelligence Service
Comps ingestion, scoring, pricing calculations, market trend summaries

### 4. Media Service
Photo uploads, compression, room classification, image metadata, signed URLs

### 5. AI Orchestration Service
Prompt building, tool selection, workflow execution, JSON validation, response storage

### 6. Document Service
Templates, disclaimers, PDF generation, flyer rendering

### 7. Task & Workflow Service
Checklists, reminders, progress tracking

### 8. Notification Service
Email, push, in-app notifications

### 9. Admin Service
Prompt versions, moderation, analytics, user support tools

## 10.2 AI workflow approach
Use a tool-based orchestration pattern where the AI can call:
- property context fetch
- comp retrieval
- price band calculator
- room/image analyzer
- ROI suggestion engine
- document template retriever
- disclaimer injector
- flyer generator

---

# 11. Data Model (Conceptual)

## 11.1 Users
- id
- email
- hashed_password
- name
- phone
- role
- created_at
- updated_at

## 11.2 Properties
- id
- owner_user_id
- address_line_1
- city
- state
- zip
- lat
- lng
- property_type
- year_built
- sqft
- lot_size
- beds
- baths
- garage_spaces
- hoa
- occupancy_status
- current_condition_score
- notes
- created_at
- updated_at

## 11.3 Seller Profiles
- id
- property_id
- sale_timeline
- budget_min
- budget_max
- urgency_level
- target_move_date
- risk_tolerance
- diy_preference
- goals_json

## 11.4 Rooms
- id
- property_id
- room_type
- condition_score
- paint_recommended
- paint_notes
- staging_notes
- repair_notes
- photo_readiness_score
- ai_summary

## 11.5 Media Assets
- id
- property_id
- room_id nullable
- asset_type
- storage_url
- thumbnail_url
- metadata_json
- ai_tags_json
- quality_score
- is_recommended
- created_at

## 11.6 Comparable Sales
- id
- property_id
- external_source_id
- address
- sale_date
- sale_price
- beds
- baths
- sqft
- lot_size
- year_built
- distance_miles
- condition_estimate
- relevance_score
- notes_json

## 11.7 Pricing Analyses
- id
- property_id
- recommended_list_low
- recommended_list_mid
- recommended_list_high
- confidence_score
- assumptions_json
- comp_snapshot_json
- ai_narrative
- created_at

## 11.8 Improvement Recommendations
- id
- property_id
- room_id nullable
- category
- title
- description
- priority
- roi_score
- cost_low
- cost_high
- estimated_impact
- recommendation_type
- status

## 11.9 Tasks
- id
- property_id
- title
- description
- due_date
- status
- priority
- source_type
- source_reference_id

## 11.10 Documents
- id
- property_id
- document_type
- title
- status
- body_markdown
- body_html
- pdf_url
- disclaimers_json
- prompt_version
- requires_review
- created_by
- created_at

## 11.11 Flyers
- id
- property_id
- template_id
- title
- pdf_url
- hero_image_asset_id
- selected_asset_ids_json
- highlights_json
- created_at

## 11.12 AI Conversations
- id
- property_id
- user_id
- message_role
- content
- citations_json
- prompt_version
- created_at

## 11.13 Audit Logs
- id
- actor_user_id
- entity_type
- entity_id
- action
- before_json
- after_json
- created_at

---

# 12. AI System Design

## 12.1 AI modules
### A. Pricing Advisor
Inputs:
- property profile
- comps
- market conditions
- seller goals

Outputs:
- pricing range
- reasoning
- confidence score
- risks
- sensitivity analysis

### B. Improvement Advisor
Inputs:
- property details
- room details
- uploaded photos
- seller budget

Outputs:
- ranked improvements
- paint suggestions
- repair priorities
- estimated ROI categories
- “skip this” advice

### C. Marketing Advisor
Inputs:
- property details
- photos
- notable features
- neighborhood context

Outputs:
- listing copy
- flyer text
- captions
- feature ranking
- hero image recommendations

### D. Listing Timing Advisor
Inputs:
- local market activity
- seasonal indicators
- seller timeline

Outputs:
- recommended listing window
- prep schedule
- launch sequence
- explanation and confidence

### E. Document Drafting Assistant
Inputs:
- document type
- jurisdiction
- property data
- transaction context

Outputs:
- structured draft
- inserted disclaimers
- review reminders
- unresolved questions list

### F. Visual Property Advisor
Inputs:
- uploaded photos
- room categories
- property metadata

Outputs:
- room identification
- condition cues
- staging notes
- retake suggestions
- photo ordering

## 12.2 AI output structure
All major AI outputs should return structured JSON first, then render user-facing prose from validated JSON.

Example JSON:
```json
{
  "summary": "Focus on paint, lighting, and front-entry curb appeal before listing.",
  "top_actions": [
    {
      "title": "Paint primary bedroom walls a light neutral",
      "priority": "high_roi",
      "cost_range": [300, 900],
      "impact": "Improves perceived freshness and photo quality"
    }
  ],
  "avoid_actions": [
    {
      "title": "Full kitchen remodel",
      "reason": "High cost with low payback for this price tier and timeline"
    }
  ],
  "confidence_score": 0.81
}
```

## 12.3 Guardrails
- Never present valuation as guaranteed
- Never present legal drafts as final legal advice
- Never claim professional inspection certainty from photos
- Must clearly distinguish:
  - estimate
  - recommendation
  - assumption
  - missing data
- Must cite data sources where possible
- Must display “Review with licensed local professionals” on legal or contract-related outputs

## 12.4 Confidence framework
Each AI recommendation should include:
- confidence score
- missing inputs
- factors increasing confidence
- factors decreasing confidence

---

# 13. Data Ingestion & Comps Strategy

## 13.1 Required comp inputs
- sold listings
- pending listings
- active listings
- withdrawn/expired optional
- price per square foot
- days on market
- sale date recency
- proximity
- similarity in structure/features

## 13.2 Comp scoring
Recommended weighted scoring:
- distance from subject property
- recency of sale
- square footage similarity
- bed/bath similarity
- property type match
- condition match
- lot size match
- neighborhood/school area match

## 13.3 Fallback when data is weak
If insufficient comps:
- widen radius
- widen date range
- lower confidence
- clearly explain uncertainty
- ask for manual condition or upgrade info

---

# 14. Photo/Visual Intelligence Requirements

## 14.1 Image processing
- compress originals for preview
- preserve source originals
- generate thumbnails
- detect blur, darkness, tilt
- tag room category
- tag features (fireplace, island, pool, backyard, updated bath, view, etc.)

## 14.2 Visual recommendations
- best cover image
- best sequence order
- missing image suggestions
- duplicate detection
- “retake because” reasons
- best rooms to feature in flyer

## 14.3 Flyer image logic
Choose images using score:
- room importance
- visual quality
- uniqueness
- selling appeal
- feature diversity

---

# 15. Document Drafting Requirements

## 15.1 Draftable documents in MVP
- property summary sheet
- pre-listing improvement plan
- offer comparison worksheet
- seller response draft
- repair request response draft
- buyer question response draft
- disclosure prep checklist
- open house info sheet
- flyer / brochure

## 15.2 Document disclaimers
Every relevant draft must include a disclaimer section such as:

> This draft was generated by Workside Software’s AI assistant for informational purposes only. It is not legal advice, not brokerage advice, and not a substitute for review by a licensed real estate professional or attorney in your jurisdiction.

## 15.3 Jurisdiction awareness
- user must specify state
- document generator selects state-aware disclaimer pack
- if state-specific logic is missing, system must explicitly say so

---

# 16. UX / UI Recommendations

## 16.1 Design direction
- polished, modern, professional
- confidence-building, not flashy
- clean dashboard
- card-based summaries
- obvious next steps
- strong progress indicators
- “Powered by Workside Software” visible but tasteful

## 16.2 Core web screens
- Login / Signup
- Seller onboarding wizard
- Property dashboard
- Pricing analysis
- Comp map + list
- Room-by-room advisor
- Improvement planner
- Photo manager
- Flyer builder
- Document center
- AI chat
- Settings
- Admin console

## 16.3 Core mobile screens
- Login / Signup
- Property summary
- Capture photos
- Tasks checklist
- AI chat
- Room suggestions
- Pricing snapshot
- Flyer preview
- Notifications
- Profile/settings

## 16.4 Dashboard widgets
- estimated price range
- readiness score
- top 5 improvements
- listing readiness timeline
- documents needing review
- photo score summary
- next recommended task

---

# 17. Compliance & Risk Controls

## 17.1 Required disclaimers
For pricing:
- estimated guidance only
- not an appraisal

For legal/contract content:
- not legal advice
- must be reviewed by licensed professional

For photo-based room assessments:
- limited by image quality and unseen conditions

## 17.2 Fair housing considerations
The system must avoid generating discriminatory listing copy or recommendations that violate fair housing principles.

Examples to avoid:
- language favoring protected classes
- neighborhood descriptions implying demographic preference

## 17.3 Human review triggers
Flag output for extra warning if:
- user asks for final legal language
- user asks for discriminatory ad copy
- user asks for certainty beyond available data
- confidence score too low
- insufficient market data

---

# 18. Suggested MVP Scope

## 18.1 MVP must-have
- auth
- property onboarding
- comp ingestion + pricing recommendation
- room/photo upload
- AI improvement recommendations
- AI marketing copy
- flyer generation PDF
- document drafting with disclaimers
- AI chat
- basic admin console
- notifications
- audit logging

## 18.2 Phase 2
- collaborative roles
- offer tracking
- property microsite
- local vendor recommendations
- staging shopping list
- contractor bid workflow
- calendar integration
- push notifications refinement
- voice assistant support

## 18.3 Phase 3
- agent invite workflow
- escrow milestones
- CRM integrations
- MLS posting workflow
- e-signature integration
- advanced AVM + market forecasting
- AI video walkthrough analysis

---

# 19. Suggested API Design

## 19.1 Auth
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- POST /auth/refresh

## 19.2 Properties
- POST /properties
- GET /properties/:id
- PATCH /properties/:id
- GET /properties/:id/dashboard

## 19.3 Rooms
- GET /properties/:id/rooms
- POST /properties/:id/rooms
- PATCH /rooms/:id

## 19.4 Media
- POST /properties/:id/media/upload-url
- POST /properties/:id/media/complete
- GET /properties/:id/media
- PATCH /media/:id

## 19.5 Comps / Pricing
- GET /properties/:id/comps
- POST /properties/:id/pricing/analyze
- GET /properties/:id/pricing/latest

## 19.6 Improvements
- POST /properties/:id/improvements/analyze
- GET /properties/:id/improvements
- PATCH /improvements/:id

## 19.7 Marketing / Flyers
- POST /properties/:id/marketing/generate
- POST /properties/:id/flyers/generate
- GET /properties/:id/flyers

## 19.8 Documents
- POST /properties/:id/documents/generate
- GET /properties/:id/documents
- GET /documents/:id
- PATCH /documents/:id
- POST /documents/:id/export-pdf

## 19.9 AI chat
- POST /properties/:id/ai/chat
- GET /properties/:id/ai/conversations

## 19.10 Tasks
- GET /properties/:id/tasks
- POST /properties/:id/tasks
- PATCH /tasks/:id

## 19.11 Admin
- GET /admin/users
- GET /admin/properties
- GET /admin/prompts
- PATCH /admin/prompts/:id
- GET /admin/audit-logs

---

# 20. AI Prompting Strategy for Codex Implementation

## 20.1 Prompt categories
- pricing analysis prompt
- improvement ranking prompt
- room paint advisor prompt
- marketing copy prompt
- flyer text prompt
- document draft prompt
- image review prompt
- listing timing prompt

## 20.2 Prompt template rules
- use structured system prompts
- include only relevant property context
- include confidence rubric
- force JSON schema output
- inject disclaimer requirements
- maintain prompt versions in database

## 20.3 Retrieval sources
- stored property details
- comp snapshots
- room metadata
- photo tags
- template library
- disclaimer library
- policy rules

---

# 21. Metrics / KPIs

## 21.1 Product KPIs
- onboarding completion rate
- property setup completion rate
- photo upload completion rate
- flyer generation rate
- pricing report generation rate
- task completion rate
- AI chat engagement rate

## 21.2 Outcome KPIs
- user-reported confidence increase
- time to “listing ready”
- percent of users completing top recommendations
- percent of users exporting flyer/docs

## 21.3 AI quality KPIs
- structured output validity
- user thumbs up/down on AI answers
- correction rate
- hallucination/flag rate
- human escalation rate

---

# 22. Recommended Repo / Monorepo Structure

```text
ai-home-seller/
  apps/
    web/
    mobile/
    api/
    admin-web/
  packages/
    ui/
    types/
    config/
    prompts/
    utils/
    validation/
  services/
    ai-orchestrator/
    document-worker/
    media-worker/
    market-data-worker/
    notification-worker/
  infrastructure/
    docker/
    gcp/
    terraform/
  docs/
    architecture/
    prompts/
    api/
```

---

# 23. Suggested Build Plan for Codex

## Phase 1 — Foundation
- set up monorepo
- configure shared TypeScript packages
- create auth
- create property entity + CRUD
- create media upload pipeline
- scaffold web/mobile apps
- add Workside Software branding

## Phase 2 — Market & Pricing
- build comp ingestion model
- implement comp scoring
- implement pricing analysis API
- build pricing dashboard UI
- generate AI pricing narrative

## Phase 3 — Visual & Improvement AI
- room/photo tagging
- room-level recommendations
- improvement ranking engine
- task generation from recommendations

## Phase 4 — Marketing & Flyer
- listing copy generator
- photo ranking
- flyer builder
- PDF export

## Phase 5 — Documents
- template library
- disclaimer library
- draft generation
- export and review state

## Phase 6 — AI Chat + Admin
- contextual seller chat
- audit logs
- prompt versioning
- admin dashboard
- analytics

---

# 24. Concrete Engineering Tasks for Codex

## 24.1 Backend
- create modular REST API
- add PostgreSQL schema + migrations
- implement signed upload flow
- implement market data ingestion abstraction
- create AI orchestration service with strict JSON validation
- add Redis-backed jobs
- implement audit logs
- implement PDF rendering pipeline

## 24.2 Web app
- onboarding wizard
- dashboard
- pricing pages
- comp explorer
- room advisor
- photo manager
- flyer builder
- document center
- AI chat UI
- settings

## 24.3 Mobile app
- auth flow
- property dashboard
- photo capture/upload
- room checklist
- tasks
- AI chat
- notifications
- flyer preview
- document list

## 24.4 AI
- define schemas
- create prompt library
- add guardrails and disclaimer enforcement
- add confidence scoring
- add retries/fallbacks
- add evaluation harness

---

# 25. Open Questions for Future Integration
These should not block the MVP but should be accounted for architecturally:
- MLS licensing/data source strategy
- appraiser-grade AVM vs guidance-only pricing
- jurisdiction-specific document templates
- vendor/contractor partner integrations
- title/escrow workflow integrations
- e-signature provider integration
- fair housing compliance review workflow

---

# 26. Recommended Launch Scope
For initial Workside Software exposure, launch as:

**Workside Home Seller Assistant**  
Subtitle: **AI guidance for pricing, prep, marketing, and sale readiness**  
Footer: **Powered by Workside Software**

This keeps Workside front and center while leaving room for future rebranding or white-label variants.

---

# 27. Final Direction to Codex

Build this as a production-oriented multi-tenant platform with:
- shared React/React Native design language
- Node/TypeScript backend
- modular AI orchestration
- strong disclaimers and auditability
- image upload + flyer generation
- pricing/comps intelligence
- best-bang-for-the-buck improvement guidance
- Workside Software branding throughout

Prioritize:
1. trustworthy pricing guidance  
2. practical improvement recommendations  
3. seller-friendly AI chat  
4. strong visual marketing workflows  
5. document generation with safe legal disclaimers  

Do **not** over-engineer brokerage workflows in the MVP.  
Focus on a polished seller experience that demonstrates the breadth and professionalism of Workside Software.

---

# 28. Suggested Immediate Next Deliverables
After this spec, Codex should produce:
1. system architecture document
2. database schema + Prisma models
3. REST API contract
4. web app screen map
5. mobile app screen map
6. AI prompt pack
7. implementation task breakdown by sprint
8. initial monorepo scaffold

