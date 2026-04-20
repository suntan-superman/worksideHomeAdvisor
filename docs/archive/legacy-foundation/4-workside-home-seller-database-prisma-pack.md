# Workside Home Seller Assistant
## Database Schema + Prisma Models Pack for Codex

This pack gives Codex a production-oriented starting point for the database layer of the **Workside Home Seller Assistant** platform.

It includes:
1. relational design decisions
2. Prisma model guidance
3. implementation notes
4. indexing guidance
5. migration order
6. a full starter `schema.prisma`

---

# 1. Database Goals

The database must support:
- seller accounts and collaborators
- one or more properties per seller over time
- property details and onboarding state
- room-by-room analysis
- media/photo uploads and derived metadata
- comparable sales and pricing analyses
- improvement recommendations
- tasks/checklists
- documents and flyers
- AI conversation history
- background analysis jobs
- notifications
- admin auditability
- prompt version traceability

Recommended primary database:
- **PostgreSQL**

Recommended ORM:
- **Prisma**

Recommended supporting infra:
- **Redis** for queues, cache, and job orchestration
- **Object storage** for media and PDF artifacts

---

# 2. Core Design Principles

## 2.1 Source of truth boundaries
- PostgreSQL stores structured operational data
- Object storage stores images, PDFs, and generated exports
- JSON columns are allowed for flexible AI payloads, but the most important business entities should remain relational

## 2.2 AI traceability
Anything created by AI should be traceable via:
- `promptVersionId`
- `sourceType`
- `confidenceScore` where relevant
- audit logs for key generation events

## 2.3 Property-centric model
Most product activity revolves around a property workspace.
Nearly every major entity should be connected to `Property`.

## 2.4 Safe extensibility
Use enums for stable domains and JSON fields only where flexibility is needed:
- assumptions snapshots
- raw provider payloads
- citations
- AI metadata
- selected asset IDs
- highlights

---

# 3. Recommended Entity Groups

## Identity and access
- `User`
- `PropertyMembership`
- `SellerProfile`

## Core property domain
- `Property`
- `Room`
- `MediaAsset`

## Market intelligence
- `ComparableSale`
- `PricingAnalysis`
- `PricingScenario`

## Seller guidance
- `ImprovementRecommendation`
- `Task`

## Outputs
- `Document`
- `Flyer`

## AI and operations
- `AIConversationMessage`
- `AnalysisJob`
- `PromptVersion`
- `Notification`
- `AuditLog`

---

# 4. Important Modeling Decisions

## 4.1 Users vs seller profiles
`User` is the global identity.  
`SellerProfile` stores sale-goal context for a specific property and seller relationship.

## 4.2 Property ownership vs memberships
- `ownerUserId` on `Property` identifies the primary seller/account owner
- `PropertyMembership` allows spouse/co-owner/collaborator/admin-style access later

## 4.3 Rooms are first-class entities
Rooms need to exist independently because the platform provides room-by-room recommendations and photo association.

## 4.4 Media assets remain flexible
Photos and documents are stored in object storage, but key metadata is persisted in SQL:
- file identity
- MIME type
- dimensions
- processing status
- AI tags
- quality score
- room link

## 4.5 Pricing analysis snapshots
Do not rely only on live comp queries.  
Persist pricing analyses as snapshots so the user can compare prior recommendations and the system can explain historical outputs.

## 4.6 Improvement recommendations normalized
Each recommendation is a row so it can be:
- sorted
- filtered
- turned into tasks
- updated by status
- tracked over time

## 4.7 Prompt version linkages
Documents, flyers, analysis jobs, and AI messages should be linkable to prompt versions for auditability.

---

# 5. Indexing Strategy

At minimum, keep indexes on:
- foreign keys
- status fields used in queues
- time-series query fields
- entity lookup fields for dashboards

Important examples:
- `Property.ownerUserId`
- `Room.propertyId`
- `MediaAsset.propertyId`
- `ComparableSale.propertyId`
- `PricingAnalysis.propertyId + createdAt`
- `ImprovementRecommendation.propertyId + priority`
- `Task.propertyId + status`
- `Document.propertyId + documentType`
- `AIConversationMessage.propertyId + createdAt`
- `AnalysisJob.propertyId + jobType + status`
- `AuditLog.entityType + entityId`

---

# 6. Notes for Codex Before Generating Migrations

## 6.1 Decimal usage
Use `Decimal` for:
- prices
- fees
- confidence scores
- ROI scores
- distance where fractional values matter

## 6.2 JSON usage
Use JSON for:
- AI citations
- prompt metadata
- raw provider payloads
- selected asset lists in flyers
- comp snapshots and assumptions

## 6.3 Avoid premature normalization
Do not try to create dozens of tiny reference tables in MVP for every possible room feature or home amenity.

## 6.4 Soft delete
This starter schema does not include soft delete fields.  
If Workside wants full archival behavior later, add:
- `deletedAt`
- `deletedByUserId`
to selected entities.

## 6.5 Multi-tenant future
This schema is property-centric and can be extended to full tenant isolation later by adding:
- `tenantId`
to top-level records.

---

# 7. Suggested Migration Order

Codex should create migrations in this order:

1. `User`
2. `Property` + `PropertyMembership` + `SellerProfile`
3. `Room`
4. `MediaAsset`
5. `ComparableSale`
6. `PricingAnalysis` + `PricingScenario`
7. `ImprovementRecommendation`
8. `Task`
9. `PromptVersion`
10. `Document`
11. `Flyer`
12. `AIConversationMessage`
13. `AnalysisJob`
14. `Notification`
15. `AuditLog`

This order keeps dependency chains clean.

---

# 8. Recommended Seed Strategy

Create demo seed data for:
- 1 admin
- 1 seller
- 1 collaborator
- 1 demo property
- seller profile for that property
- 6–8 rooms
- 10 media assets
- 6 comparable sales
- 1 pricing analysis with 3 scenarios
- 8 improvement recommendations
- 10 tasks
- 2 documents
- 1 flyer
- 8 AI conversation messages
- 2 notifications
- 1 active prompt version per major category

This makes the app demo-ready immediately.

---

# 9. Starter Prisma Schema

Save this as:

```text
apps/api/prisma/schema.prisma
```

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  SELLER
  COLLABORATOR
  ADMIN
  SUPER_ADMIN
}

enum PropertyType {
  SINGLE_FAMILY
  CONDO
  TOWNHOME
  MULTI_FAMILY
  MANUFACTURED
  LAND
  OTHER
}

enum OccupancyStatus {
  OWNER_OCCUPIED
  TENANT_OCCUPIED
  VACANT
  PARTIAL
  OTHER
}

enum SaleTimeline {
  ASAP
  THIRTY_DAYS
  SIXTY_DAYS
  NINETY_DAYS
  FLEXIBLE
}

enum UrgencyLevel {
  LOW
  MEDIUM
  HIGH
}

enum RiskTolerance {
  LOW
  MEDIUM
  HIGH
}

enum DIYPreference {
  NONE
  LIGHT
  MODERATE
  HEAVY
}

enum RoomType {
  EXTERIOR_FRONT
  EXTERIOR_REAR
  ENTRY
  LIVING_ROOM
  FAMILY_ROOM
  DINING_ROOM
  KITCHEN
  PRIMARY_BEDROOM
  BEDROOM
  PRIMARY_BATHROOM
  BATHROOM
  OFFICE
  LOFT
  BONUS_ROOM
  LAUNDRY
  GARAGE
  BACKYARD
  PATIO
  POOL
  OTHER
}

enum AssetType {
  IMAGE
  PDF
  DOCX
  OTHER
}

enum MediaProcessingStatus {
  UPLOADED
  PROCESSING
  READY
  FAILED
}

enum RecommendationPriority {
  MUST_DO
  HIGH_ROI
  OPTIONAL
  AVOID
}

enum RecommendationCategory {
  PAINT
  REPAIR
  STAGING
  DECLUTTER
  LANDSCAPING
  LIGHTING
  CLEANING
  CURB_APPEAL
  PHOTOGRAPHY
  PRICING_STRATEGY
  OTHER
}

enum RecommendationStatus {
  NEW
  ACCEPTED
  DEFERRED
  COMPLETED
  DISMISSED
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  BLOCKED
  DONE
  CANCELED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum SourceType {
  USER
  AI
  SYSTEM
  ADMIN
}

enum PricingScenarioType {
  CONSERVATIVE
  TARGET
  STRETCH
}

enum DocumentType {
  PROPERTY_SUMMARY
  PRE_LISTING_PLAN
  OFFER_COMPARISON
  SELLER_RESPONSE
  REPAIR_RESPONSE
  BUYER_QA_RESPONSE
  DISCLOSURE_PREP_CHECKLIST
  OPEN_HOUSE_INFO
  FLYER
  GENERIC
}

enum DocumentStatus {
  DRAFT
  READY_FOR_REVIEW
  REVIEWED
  EXPORTED
  ARCHIVED
}

enum FlyerStatus {
  DRAFT
  READY
  EXPORTED
  ARCHIVED
}

enum ConversationRole {
  SYSTEM
  USER
  ASSISTANT
  TOOL
}

enum AnalysisJobType {
  PRICING
  IMPROVEMENTS
  ROOM_ANALYSIS
  MARKETING_COPY
  FLYER_GENERATION
  DOCUMENT_GENERATION
  CHAT_RESPONSE
  PHOTO_ANALYSIS
}

enum AnalysisJobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  RETRYING
}

enum NotificationChannel {
  EMAIL
  PUSH
  IN_APP
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  READ
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  GENERATE
  LOGIN
  LOGOUT
  EXPORT
  REVIEW
  COMPLETE
  FLAG
}

enum PromptCategory {
  PRICING
  IMPROVEMENTS
  ROOM_ANALYSIS
  MARKETING
  FLYER
  DOCUMENT
  CHAT
  MODERATION
}

enum PromptStatus {
  DRAFT
  ACTIVE
  INACTIVE
  ARCHIVED
}

model User {
  id                    String                 @id @default(cuid())
  email                 String                 @unique
  hashedPassword        String?
  firstName             String?
  lastName              String?
  displayName           String?
  phone                 String?
  role                  UserRole               @default(SELLER)
  isEmailVerified       Boolean                @default(false)
  isActive              Boolean                @default(true)
  lastLoginAt           DateTime?
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  sellerProfiles        SellerProfile[]
  propertyMemberships   PropertyMembership[]
  aiMessages            AIConversationMessage[]
  tasksCreated          Task[]                 @relation("TaskCreatedBy")
  documentsCreated      Document[]             @relation("DocumentCreatedBy")
  documentsReviewed     Document[]             @relation("DocumentReviewedBy")
  flyersCreated         Flyer[]                @relation("FlyerCreatedBy")
  notifications         Notification[]
  auditLogs             AuditLog[]             @relation("AuditActor")
}

model Property {
  id                         String                      @id @default(cuid())
  ownerUserId                String
  title                      String?
  addressLine1               String
  addressLine2               String?
  city                       String
  state                      String
  zip                        String
  county                     String?
  country                    String                      @default("US")
  latitude                   Decimal?                    @db.Decimal(10, 7)
  longitude                  Decimal?                    @db.Decimal(10, 7)
  propertyType               PropertyType
  yearBuilt                  Int?
  squareFeet                 Int?
  lotSizeSqFt                Int?
  bedrooms                   Decimal?                    @db.Decimal(4, 1)
  bathrooms                  Decimal?                    @db.Decimal(4, 1)
  garageSpaces               Int?
  hoa                        Boolean?
  hoaFeeMonthly              Decimal?                    @db.Decimal(10, 2)
  occupancyStatus            OccupancyStatus?
  currentConditionScore      Int?
  estimatedOriginalListPrice Decimal?                    @db.Decimal(12, 2)
  estimatedCurrentValue      Decimal?                    @db.Decimal(12, 2)
  readinessScore             Int?
  publicMicrositeSlug        String?                     @unique
  notes                      String?
  createdAt                  DateTime                    @default(now())
  updatedAt                  DateTime                    @updatedAt

  owner                      User                        @relation(fields: [ownerUserId], references: [id], onDelete: Restrict)
  sellerProfile              SellerProfile?
  memberships                PropertyMembership[]
  rooms                      Room[]
  mediaAssets                MediaAsset[]
  comparableSales            ComparableSale[]
  pricingAnalyses            PricingAnalysis[]
  improvementRecommendations ImprovementRecommendation[]
  tasks                      Task[]
  documents                  Document[]
  flyers                     Flyer[]
  aiMessages                 AIConversationMessage[]
  analysisJobs               AnalysisJob[]
  notifications              Notification[]
  auditLogs                  AuditLog[]
}

model PropertyMembership {
  id          String    @id @default(cuid())
  propertyId  String
  userId      String
  roleLabel   String
  canEdit     Boolean   @default(false)
  canComment  Boolean   @default(true)
  canUpload   Boolean   @default(true)
  canViewDocs Boolean   @default(true)
  createdAt   DateTime  @default(now())

  property    Property  @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([propertyId, userId])
  @@index([userId])
}

model SellerProfile {
  id               String        @id @default(cuid())
  userId           String
  propertyId       String        @unique
  saleTimeline     SaleTimeline?
  budgetMin        Decimal?      @db.Decimal(12, 2)
  budgetMax        Decimal?      @db.Decimal(12, 2)
  urgencyLevel     UrgencyLevel?
  targetMoveDate   DateTime?
  riskTolerance    RiskTolerance?
  diyPreference    DIYPreference?
  goalsJson        Json?
  sellerNotes      String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  property         Property      @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Room {
  id                     String      @id @default(cuid())
  propertyId             String
  roomType               RoomType
  customLabel            String?
  levelLabel             String?
  squareFeet             Int?
  conditionScore         Int?
  paintRecommended       Boolean?
  paintNotes             String?
  stagingNotes           String?
  repairNotes            String?
  declutterNotes         String?
  lightingNotes          String?
  photoReadinessScore    Int?
  aiSummary              String?
  aiConfidenceScore      Decimal?    @db.Decimal(4, 3)
  createdAt              DateTime    @default(now())
  updatedAt              DateTime    @updatedAt

  property               Property    @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  mediaAssets            MediaAsset[]
  recommendations        ImprovementRecommendation[]

  @@index([propertyId, roomType])
}

model MediaAsset {
  id                   String                  @id @default(cuid())
  propertyId           String
  roomId               String?
  assetType            AssetType               @default(IMAGE)
  originalFilename     String
  mimeType             String
  fileSizeBytes        Int?
  storagePath          String
  publicUrl            String?
  thumbnailPath        String?
  thumbnailUrl         String?
  width                Int?
  height               Int?
  sha256Checksum       String?
  processingStatus     MediaProcessingStatus   @default(UPLOADED)
  metadataJson         Json?
  aiTagsJson           Json?
  qualityScore         Int?
  isRecommended        Boolean                 @default(false)
  isHeroCandidate      Boolean                 @default(false)
  uploadedAt           DateTime                @default(now())
  processedAt          DateTime?
  createdAt            DateTime                @default(now())
  updatedAt            DateTime                @updatedAt

  property             Property                @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  room                 Room?                   @relation(fields: [roomId], references: [id], onDelete: SetNull)
  flyersAsHero         Flyer[]                 @relation("FlyerHeroImage")

  @@index([propertyId])
  @@index([roomId])
  @@index([processingStatus])
}

model ComparableSale {
  id                    String      @id @default(cuid())
  propertyId            String
  externalSourceId      String?
  sourceName            String?
  addressLine1          String
  city                  String
  state                 String
  zip                   String?
  latitude              Decimal?    @db.Decimal(10, 7)
  longitude             Decimal?    @db.Decimal(10, 7)
  saleDate              DateTime?
  salePrice             Decimal?    @db.Decimal(12, 2)
  originalListPrice     Decimal?    @db.Decimal(12, 2)
  daysOnMarket          Int?
  pricePerSqFt          Decimal?    @db.Decimal(10, 2)
  propertyType          PropertyType?
  yearBuilt             Int?
  squareFeet            Int?
  lotSizeSqFt           Int?
  bedrooms              Decimal?    @db.Decimal(4, 1)
  bathrooms             Decimal?    @db.Decimal(4, 1)
  distanceMiles         Decimal?    @db.Decimal(6, 3)
  conditionEstimate     String?
  relevanceScore        Decimal?    @db.Decimal(5, 4)
  notesJson             Json?
  rawPayloadJson        Json?
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  property              Property    @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  @@index([propertyId])
  @@index([saleDate])
  @@index([relevanceScore])
}

model PricingAnalysis {
  id                       String                  @id @default(cuid())
  propertyId               String
  recommendedListLow       Decimal                 @db.Decimal(12, 2)
  recommendedListMid       Decimal                 @db.Decimal(12, 2)
  recommendedListHigh      Decimal                 @db.Decimal(12, 2)
  confidenceScore          Decimal?                @db.Decimal(4, 3)
  assumptionsJson          Json?
  compSnapshotJson         Json?
  marketSnapshotJson       Json?
  aiNarrative              String?
  createdAt                DateTime                @default(now())
  createdBySource          SourceType              @default(AI)

  property                 Property                @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  scenarios                PricingScenario[]

  @@index([propertyId, createdAt])
}

model PricingScenario {
  id                 String               @id @default(cuid())
  pricingAnalysisId  String
  scenarioType       PricingScenarioType
  listPrice          Decimal              @db.Decimal(12, 2)
  expectedDaysOnMkt  Int?
  rationale          String?
  createdAt          DateTime             @default(now())

  pricingAnalysis    PricingAnalysis      @relation(fields: [pricingAnalysisId], references: [id], onDelete: Cascade)

  @@unique([pricingAnalysisId, scenarioType])
}

model ImprovementRecommendation {
  id                    String                    @id @default(cuid())
  propertyId            String
  roomId                String?
  category              RecommendationCategory
  title                 String
  description           String
  priority              RecommendationPriority
  roiScore              Decimal?                  @db.Decimal(5, 2)
  costLow               Decimal?                  @db.Decimal(12, 2)
  costHigh              Decimal?                  @db.Decimal(12, 2)
  estimatedImpact       String?
  recommendationType    String?
  confidenceScore       Decimal?                  @db.Decimal(4, 3)
  status                RecommendationStatus      @default(NEW)
  sourceType            SourceType                @default(AI)
  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @updatedAt

  property              Property                  @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  room                  Room?                     @relation(fields: [roomId], references: [id], onDelete: SetNull)

  @@index([propertyId, priority])
  @@index([roomId])
  @@index([status])
}

model Task {
  id                  String        @id @default(cuid())
  propertyId          String
  createdByUserId     String?
  title               String
  description         String?
  dueDate             DateTime?
  status              TaskStatus    @default(TODO)
  priority            TaskPriority  @default(MEDIUM)
  sourceType          SourceType    @default(USER)
  sourceReferenceId   String?
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  completedAt         DateTime?

  property            Property      @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  createdBy           User?         @relation("TaskCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)

  @@index([propertyId, status])
  @@index([createdByUserId])
}

model Document {
  id                    String           @id @default(cuid())
  propertyId            String
  createdByUserId       String?
  reviewedByUserId      String?
  documentType          DocumentType
  title                 String
  status                DocumentStatus   @default(DRAFT)
  bodyMarkdown          String?
  bodyHtml              String?
  pdfPath               String?
  pdfUrl                String?
  disclaimersJson       Json?
  jurisdictionState     String?
  promptVersionId       String?
  requiresReview        Boolean          @default(true)
  reviewedAt            DateTime?
  exportedAt            DateTime?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  property              Property         @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  createdBy             User?            @relation("DocumentCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)
  reviewedBy            User?            @relation("DocumentReviewedBy", fields: [reviewedByUserId], references: [id], onDelete: SetNull)
  promptVersion         PromptVersion?   @relation(fields: [promptVersionId], references: [id], onDelete: SetNull)

  @@index([propertyId, documentType])
  @@index([status])
  @@index([promptVersionId])
}

model Flyer {
  id                    String           @id @default(cuid())
  propertyId            String
  createdByUserId       String?
  templateKey           String
  title                 String
  status                FlyerStatus      @default(DRAFT)
  pdfPath               String?
  pdfUrl                String?
  heroImageAssetId      String?
  selectedAssetIdsJson  Json?
  highlightsJson        Json?
  promptVersionId       String?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt
  exportedAt            DateTime?

  property              Property         @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  createdBy             User?            @relation("FlyerCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)
  heroImage             MediaAsset?      @relation("FlyerHeroImage", fields: [heroImageAssetId], references: [id], onDelete: SetNull)
  promptVersion         PromptVersion?   @relation(fields: [promptVersionId], references: [id], onDelete: SetNull)

  @@index([propertyId])
  @@index([status])
  @@index([promptVersionId])
}

model AIConversationMessage {
  id                    String             @id @default(cuid())
  propertyId            String
  userId                String?
  role                  ConversationRole
  content               String
  citationsJson         Json?
  promptVersionId       String?
  metadataJson          Json?
  createdAt             DateTime           @default(now())

  property              Property           @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  user                  User?              @relation(fields: [userId], references: [id], onDelete: SetNull)
  promptVersion         PromptVersion?     @relation(fields: [promptVersionId], references: [id], onDelete: SetNull)

  @@index([propertyId, createdAt])
  @@index([userId])
  @@index([promptVersionId])
}

model AnalysisJob {
  id                    String               @id @default(cuid())
  propertyId            String
  jobType               AnalysisJobType
  status                AnalysisJobStatus    @default(QUEUED)
  requestedByUserId     String?
  idempotencyKey        String?
  inputJson             Json?
  outputJson            Json?
  errorMessage          String?
  promptVersionId       String?
  queuedAt              DateTime             @default(now())
  startedAt             DateTime?
  completedAt           DateTime?
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  property              Property             @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  promptVersion         PromptVersion?       @relation(fields: [promptVersionId], references: [id], onDelete: SetNull)

  @@index([propertyId, jobType, status])
  @@index([idempotencyKey])
  @@index([promptVersionId])
}

model Notification {
  id                    String               @id @default(cuid())
  propertyId            String?
  userId                String
  channel               NotificationChannel
  status                NotificationStatus   @default(PENDING)
  title                 String
  body                  String
  payloadJson           Json?
  sentAt                DateTime?
  readAt                DateTime?
  createdAt             DateTime             @default(now())

  property              Property?            @relation(fields: [propertyId], references: [id], onDelete: SetNull)
  user                  User                 @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([propertyId])
}

model AuditLog {
  id                    String         @id @default(cuid())
  actorUserId           String?
  propertyId            String?
  entityType            String
  entityId              String
  action                AuditAction
  beforeJson            Json?
  afterJson             Json?
  metadataJson          Json?
  createdAt             DateTime       @default(now())

  actor                 User?          @relation("AuditActor", fields: [actorUserId], references: [id], onDelete: SetNull)
  property              Property?      @relation(fields: [propertyId], references: [id], onDelete: SetNull)

  @@index([actorUserId])
  @@index([propertyId])
  @@index([entityType, entityId])
  @@index([createdAt])
}

model PromptVersion {
  id                    String                 @id @default(cuid())
  category              PromptCategory
  name                  String
  version               Int
  status                PromptStatus           @default(DRAFT)
  systemPrompt          String
  developerPrompt       String?
  outputSchemaJson      Json?
  metadataJson          Json?
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  documents             Document[]
  flyers                Flyer[]
  aiMessages            AIConversationMessage[]
  analysisJobs          AnalysisJob[]

  @@unique([category, version])
  @@index([category, status])
}

```

---

# 10. Immediate Next Files Codex Should Create

After adding `schema.prisma`, Codex should generate:

1. `prisma/seed.ts`
2. `src/modules/*` folders aligned to the schema
3. DTO and zod schema pack for:
   - auth
   - properties
   - rooms
   - media
   - pricing
   - improvements
   - tasks
   - documents
   - flyers
   - ai chat
4. repository/service layers
5. migration files
6. sample admin queries

---

# 11. Suggested Prisma Seed Outline

Seed at least:
- admin user
- seller user
- demo property
- demo seller profile
- room records
- media assets
- comparable sales
- pricing analysis and scenarios
- recommendations
- tasks
- sample flyer and documents
- prompt versions

Keep image/document URLs as fake but realistic placeholders in dev.

---

# 12. Final Direction to Codex

Use this schema as the MVP baseline.

Do not block implementation waiting on:
- advanced tenancy
- escrow workflows
- e-signature
- MLS final provider abstraction
- external CRM integration

Focus first on:
- clean relational integrity
- prompt traceability
- property-centric workflows
- seller-ready UX support
- Workside Software demo readiness
