# Workside Home Advisor
## Full Mobile App Specification for Codex
### Expo + React Native + Firebase Auth + MongoDB-Backed API

Last Updated: 2026-03-27

---

# 1. Purpose

This document defines the complete mobile-app specification for Workside Home Advisor.

The mobile app should be a field-first capture and decision tool for:
- homeowners preparing to sell
- real estate professionals walking properties
- fast photo capture and organization
- AI-assisted photo evaluation
- visualization and improvement workflows
- checklist execution while on-site

---

# 2. Product Role of the Mobile App

## 2.1 Mobile app mission
The mobile app should do these jobs exceptionally well:
1. authenticate the user
2. show the user the properties already created in the system
3. let the user quickly select a property
4. let the user capture and upload photos by room
5. let the user review existing property photos
6. let the user tag, describe, and organize photos
7. let the user run AI-assisted photo analysis
8. let the user preview Listing Vision Mode transformations
9. let the user view pricing and key property insights
10. let the user work through seller checklists in the field

## 2.2 What mobile should not try to be
The mobile app should not be the main place for:
- deep data entry
- large report review
- admin operations
- heavy comp table comparison
- extensive billing management

Those remain better suited to web.

---

# 3. Core Mobile Design Principle

Capture + Enhance + Decide

The mobile app should feel:
- fast
- visual
- camera-first
- guided
- low-friction
- polished

The mobile app should avoid:
- dense dashboards
- spreadsheet-like experiences
- long forms whenever possible
- too many settings screens

---

# 4. Recommended Tech Stack

## 4.1 Core stack
- React Native
- Expo managed workflow
- TypeScript
- React Navigation
- React Query
- Firebase Auth
- secure token persistence
- backend API integration for property, photo, AI, checklist, pricing, and provider data

## 4.2 Recommended libraries

### Navigation
- @react-navigation/native
- @react-navigation/native-stack
- @react-navigation/bottom-tabs

### API and state
- @tanstack/react-query
- lightweight local UI state via Zustand if needed

### Expo modules
- expo-camera
- expo-image-picker
- expo-image-manipulator
- expo-file-system
- expo-notifications
- expo-secure-store
- expo-constants

### UI helpers
- react-native-safe-area-context
- react-native-screens
- react-native-gesture-handler
- react-native-reanimated

### Media / image
- expo-image
- upload helpers
- optional image compression/resizing before upload

### Forms / validation
- zod
- react-hook-form

---

# 5. User Types Supported by Mobile

## 5.1 Home seller
Needs:
- access to their property
- photo capture guidance
- AI suggestions
- checklist support
- simple explanations

## 5.2 Realtor / agent
Needs:
- fast access to multiple properties
- polished on-site workflow
- quick photo capture and tagging
- instant AI suggestions
- listing vision previews
- property presentation support

The app should support both user types with the same base app, and later allow mode-based UX differences.

---

# 6. Mobile Information Architecture

## 6.1 Primary navigation
Use a bottom tab bar with five tabs:

Properties | Capture | Vision | Tasks | Profile

---

# 7. Screen Map

## 7.1 Authentication flow
- SplashScreen
- WelcomeScreen
- LoginScreen
- SignupScreen
- VerifyEmailOTPScreen
- ForgotPasswordScreen optional later

## 7.2 Main app flow
- PropertiesListScreen
- PropertyDetailScreen
- PropertyPhotosScreen
- PhotoDetailScreen
- CaptureScreen
- CaptureReviewScreen
- VisionHomeScreen
- VisualizationJobScreen
- PricingSummaryScreen
- ChecklistScreen
- ChecklistItemDetailScreen
- ProviderResultsScreen
- SavedProvidersScreen
- ProfileScreen
- SubscriptionScreen optional
- NotificationsScreen optional

---

# 8. Navigation Structure

## 8.1 Root navigator
Use a root stack:
- AuthStack
- AppTabs
- Modal stack for selected workflows

## 8.2 App tabs

### Tab 1: Properties
Contains:
- properties list
- property detail
- pricing summary
- photo gallery
- checklist access

### Tab 2: Capture
Contains:
- camera-first experience
- photo review before upload
- room tagging
- AI quick actions

### Tab 3: Vision
Contains:
- Listing Vision Mode
- before/after concept previews
- saved visualizations

### Tab 4: Tasks
Contains:
- checklist summary
- seller next steps
- provider connections
- task status

### Tab 5: Profile
Contains:
- account settings
- plan/subscription summary
- notification settings
- logout

---

# 9. Authentication UX

## 9.1 Entry
The app opens to:
- splash
- token/session check
- either auth flow or main app

## 9.2 Login screen
Fields:
- email
- password

Actions:
- log in
- go to sign up
- resend verification if needed

## 9.3 Signup screen
Fields:
- first name
- last name
- email
- password
- optional phone later

After signup:
- send OTP / verification email
- move to VerifyEmailOTPScreen

## 9.4 Verify email OTP screen
Fields:
- OTP input
Actions:
- verify
- resend
- go back

## 9.5 Auth behavior rules
- store token securely
- restore session on app relaunch
- gracefully handle expired sessions
- redirect to login on invalid token

---

# 10. Properties Tab Specification

## 10.1 PropertiesListScreen

### Purpose
Show all properties available to the logged-in user.

### Layout
Top:
- search field
- optional filters
- optional mode badge later (Seller / Agent)

Body:
- property cards

### Property card fields
- property thumbnail
- property address
- city/state
- status badge
- last updated
- optional readiness score
- optional pricing snapshot

### Actions
- tap to open property
- optional quick capture
- optional quick pricing refresh if plan permits

### Empty state
Show:
No properties yet. Create one on the web app or add a property later if mobile creation is enabled.

## 10.2 PropertyDetailScreen

### Purpose
This is the property-level mobile command center.

### Header
- address
- property status
- quick actions:
  - Add Photos
  - Run AI
  - View Pricing
  - Generate Flyer later if enabled

### Top summary cards
- Pricing Snapshot
- Readiness Progress
- Photos Uploaded
- Next Recommended Task

### Content sections
- quick insights
- latest AI suggestions
- recent photos
- checklist preview
- latest visualization previews

### Internal tabs or segmented controls
Recommended:
Photos | Insights | Vision | Checklist

---

# 11. Photos Experience

## 11.1 PropertyPhotosScreen

### Purpose
Show all photos for the selected property.

### Layout
- grid view by default
- optional grouped by room later

### Each photo tile shows
- image thumbnail
- room tag
- AI quality badge
- featured badge if selected
- processing status if pending

### Actions
- tap to open photo detail
- filter by room
- filter by recommended
- sort newest / best / room

## 11.2 PhotoDetailScreen

### Purpose
Review and manage a single property image.

### Fields shown
- full image
- room label
- description
- uploaded date
- AI analysis summary
- quality score if available
- photo issues if detected

### Actions
- edit description
- assign or change room type
- run AI photo analysis
- mark as featured
- add to flyer candidates
- open in Vision Mode
- delete later with confirmation if allowed

### Metadata fields
- room location: kitchen, living room, master bedroom, etc.
- custom description
- seller/agent notes
- AI-recommended status

## 11.3 Photo tagging system
Supported room/location tags:
- exterior front
- exterior rear
- entry
- living room
- family room
- dining room
- kitchen
- primary bedroom
- bedroom
- primary bathroom
- bathroom
- office
- loft
- laundry
- garage
- backyard
- patio
- pool
- other

### Tagging UX
Keep it very fast:
- chips / buttons
- search for room types if needed
- allow custom note in addition

---

# 12. Capture Tab Specification

## 12.1 CaptureScreen

### Purpose
Camera-first property media capture.

### Core UX
- choose property first if not already selected
- open camera
- capture one or more photos quickly
- optionally choose from library

### UI elements
- camera preview
- shutter button
- gallery picker
- flash toggle
- property badge
- room quick-tag buttons

### Fast room tagging suggestions
Show quick buttons:
- Kitchen
- Living
- Bedroom
- Bathroom
- Exterior
- Other

### Flow after capture
Go to CaptureReviewScreen

## 12.2 CaptureReviewScreen

### Purpose
Let user approve, tag, describe, and upload newly captured media.

### Layout
- image preview
- selected property
- suggested room type if AI or heuristic available
- description field
- optional mark as key photo
- upload button

### AI quick actions
- analyze now
- save without analysis
- queue for batch analysis later

### Upload states
- uploading
- uploaded
- failed
- retry available

### Important
If offline or on poor connection:
- keep photo in pending queue
- upload later when connection resumes

## 12.3 Capture workflow philosophy
This should be optimized for speed.

Ideal field flow:
1. select property
2. capture room
3. assign room tag in one tap
4. upload
5. continue to next room

Agents should be able to move through a house quickly.

---

# 13. Vision Tab Specification

## 13.1 VisionHomeScreen

### Purpose
Show available photos and allow AI visualization workflows.

### Title
Listing Vision Mode

### Content
- choose property
- choose photo
- choose transformation type
- view past generated previews

### Transformation modes
- declutter / furniture removal concept
- paint wall color concept
- flooring change concept
- light staging concept
- combined concept

## 13.2 VisualizationJobScreen

### Purpose
Show generation progress and result comparison.

### Layout
Top:
- original photo
- selected transformation type

Body:
- progress / processing state
- completed concept preview
- variant selector

Bottom actions:
- save concept
- regenerate
- choose another preset
- share later
- use in flyer candidate list

### Comparison modes
- side-by-side
- swipe compare later
- tab toggle:
  - Original
  - Concept Preview
  - Recommended Variant

### Required disclaimer
Always show:
AI visualizations are conceptual previews only. Actual results and value impact may vary.

---

# 14. Insights / Pricing Summary Specification

## 14.1 PricingSummaryScreen

### Purpose
Show a light, mobile-optimized summary of pricing and comps.

### Content
- recommended price range
- confidence level
- latest analysis date
- summary of why this range was selected
- mini list of top comps
- button to open web for deep review if needed later

### Important
Do not try to reproduce the full desktop comp experience here.
Keep it concise and visually digestible.

### Comps mini cards
Each card:
- sale price
- beds/baths
- sqft
- distance
- sale date
- comp score optional

### Future enhancement
Show map preview with subject property and comps

---

# 15. Checklist / Tasks Tab Specification

## 15.1 ChecklistScreen

### Purpose
Guide the seller or agent through the next steps of preparing and selling the home.

### Layout
Top:
- overall progress
- current phase
- next task

Phases:
- Pre-Listing
- Listing Launch
- Under Contract
- Closing

Each task row:
- title
- status
- related provider count if relevant
- quick action:
  - view
  - mark complete
  - find providers

## 15.2 ChecklistItemDetailScreen

### Purpose
Explain a task and help user act on it.

### Sections
- why this matters
- what to consider
- AI helper note
- provider suggestions if applicable
- related photos or deliverables if applicable

### Actions
- mark complete
- save for later
- find providers
- ask AI later

## 15.3 SavedProvidersScreen

### Purpose
Let user manage providers saved from checklist tasks.

### Layout
- provider cards
- category
- linked checklist item
- save date
- contacted / not contacted
- notes field later

---

# 16. Provider Results Experience

## 16.1 ProviderResultsScreen

### Purpose
Show local providers related to a selected task.

### Provider card fields
- business name
- category
- city / distance
- rating + review count if available
- Sponsored badge if paid
- Verified badge if applicable
- short description

### Actions
- call
- website
- save
- request contact later

### Important trust rule
Sponsored listings must be clearly labeled.

### Disclaimer
Workside does not endorse or guarantee providers. Sellers should independently evaluate providers before making a decision.

---

# 17. Profile Tab Specification

## 17.1 ProfileScreen
Fields:
- name
- email
- plan name
- account type
- current subscription summary later
- notification settings
- logout

### Actions
- manage account
- billing summary later
- help / support
- legal / privacy / terms

---

# 18. Notifications

## 18.1 Notification types
- upload completed
- AI analysis ready
- visualization ready
- pricing updated
- checklist reminder
- plan limit or cooldown notice
- provider contact response later

## 18.2 UX behavior
- in-app notifications feed later
- push notifications for meaningful events only
- do not over-notify

---

# 19. Shared Data / Sync Rules

## 19.1 Web-to-mobile relationship
The web app remains the best place for:
- deep pricing review
- large report reading
- flyer editing
- full admin functions

The mobile app remains the best place for:
- capture
- quick review
- in-the-field decisions
- task execution

## 19.2 Sync expectations
The mobile app must always reflect backend truth for:
- properties
- photos
- AI analysis results
- checklist status
- saved providers
- pricing snapshot

Use React Query caching with background refresh.

---

# 20. AI Mobile Features

## 20.1 AI photo analysis
The app should support:
- image quality review
- room-type suggestion
- clutter/lighting/framing notes
- suggestions for retakes
- best for listing recommendation

### Example output
- Great hero image candidate
- Retake recommended due to low light
- Kitchen island should be centered in frame
- Declutter countertops for stronger listing appeal

## 20.2 AI best-photo selection
Allow action:
Generate Best Listing Photos

This should:
- score current photo set
- identify top 5–10 images
- mark them as listing candidates

## 20.3 AI room visualization
Allow action:
See the Potential

This should:
- remove clutter conceptually
- repaint walls conceptually
- change flooring conceptually
- save concept variants

---

# 21. Realtor Mode Enhancements (Future-Friendly)

The app should be designed so future Agent Mode can add:
- presentation-first property detail screen
- preferred vendors
- branded notes
- client-facing preview mode
- faster listing appointment workflow
- live demo flow in front of sellers

Do not hard-code the UX so only sellers make sense.

---

# 22. Design Language Recommendations

## 22.1 Visual style
- clean
- modern
- premium
- photo-forward
- not overly playful

## 22.2 Color/system feel
- calm neutral base
- blue accents aligned with Workside branding
- soft card surfaces
- strong image presentation
- obvious primary actions

## 22.3 Typography
- clear hierarchy
- large section headers
- readable body text
- high contrast

---

# 23. Performance Requirements

## 23.1 Must feel fast
- property list should load quickly
- gallery thumbnails should be cached
- uploads should show immediate feedback
- analysis progress should be visible

## 23.2 Media handling
- compress oversized images before upload where appropriate
- generate thumbnails on server
- lazy-load gallery assets
- keep scroll smooth

## 23.3 Offline tolerance
At minimum:
- captured media should not be lost when offline
- pending uploads should retry later
- user should see clear status

---

# 24. Security Requirements

- secure token storage via SecureStore
- backend token validation
- no direct exposure of sensitive provider keys
- uploads should use secure backend-issued paths
- sensitive actions require authenticated API requests only

---

# 25. Suggested Folder Structure

```text
apps/mobile/
  src/
    app/
    navigation/
      RootNavigator.tsx
      AuthStack.tsx
      AppTabs.tsx
      PropertiesStack.tsx
      TasksStack.tsx
      VisionStack.tsx
    screens/
      auth/
        WelcomeScreen.tsx
        LoginScreen.tsx
        SignupScreen.tsx
        VerifyEmailOTPScreen.tsx
      properties/
        PropertiesListScreen.tsx
        PropertyDetailScreen.tsx
        PropertyPhotosScreen.tsx
        PhotoDetailScreen.tsx
        PricingSummaryScreen.tsx
      capture/
        CaptureScreen.tsx
        CaptureReviewScreen.tsx
      vision/
        VisionHomeScreen.tsx
        VisualizationJobScreen.tsx
      tasks/
        ChecklistScreen.tsx
        ChecklistItemDetailScreen.tsx
        ProviderResultsScreen.tsx
        SavedProvidersScreen.tsx
      profile/
        ProfileScreen.tsx
    components/
      property/
      photo/
      checklist/
      providers/
      shared/
    features/
      auth/
      properties/
      media/
      ai/
      checklist/
      providers/
      usage/
    hooks/
    services/
      api/
      auth/
      uploads/
      notifications/
    store/
    theme/
    types/
    utils/
```

---

# 26. Core API Endpoints Needed by Mobile

## Authentication
- POST /auth/signup
- POST /auth/login
- POST /auth/verify-email
- POST /auth/resend-otp
- GET /auth/me

## Properties
- GET /properties
- GET /properties/:id
- GET /properties/:id/dashboard

## Pricing
- GET /properties/:id/pricing/latest
- POST /properties/:id/pricing/analyze

## Media
- GET /properties/:id/media
- POST /properties/:id/media/upload-url
- POST /properties/:id/media/complete
- POST /media/:id/analyze
- PATCH /media/:id
- DELETE /media/:id later if allowed

## Vision / visualization
- POST /properties/:id/visualizations
- GET /properties/:id/visualizations
- GET /visualizations/:id

## Checklist / tasks
- GET /properties/:id/checklist
- PATCH /checklist-items/:id
- GET /properties/:id/providers
- POST /providers/:id/save

## Notifications
- GET /notifications
- PATCH /notifications/:id/read

---

# 27. Usage Safeguards on Mobile

The app must support backend-enforced cooldowns and quotas.

### Behavior examples
If pricing analysis is within cooldown:
- show latest saved result
- message: Showing the latest analysis from earlier today.

If visualization limit is hit:
- show plan-aware message
- prompt upgrade if appropriate later

Do not make these messages feel punitive.

---

# 28. Analytics Events Recommended

Track:
- login success
- property opened
- photo captured
- photo uploaded
- room tag assigned
- AI photo analysis started
- AI photo analysis completed
- visualization started
- visualization completed
- checklist item completed
- provider card viewed
- provider saved
- pricing summary viewed

These events are especially useful for validating:
- seller vs realtor usage differences
- feature adoption
- conversion opportunities

---

# 29. Recommended MVP Build Order

## Phase 1
- auth flow
- properties list
- property detail
- media gallery
- camera capture
- upload flow

## Phase 2
- photo detail
- room tagging
- AI photo analysis
- pricing summary

## Phase 3
- checklist flow
- provider results
- saved providers

## Phase 4
- vision mode
- visualization jobs
- comparison UI

## Phase 5
- polish
- offline queue improvements
- notifications
- subscription/limit messaging

---

# 30. Acceptance Criteria for MVP

The MVP mobile app is successful when a user can:
1. log in successfully
2. see their available properties
3. select a property
4. view photos already attached to that property
5. capture and upload new photos
6. tag each photo with room/location and optional description
7. run AI photo analysis
8. review pricing summary
9. work through the checklist
10. open a room photo in Listing Vision Mode
11. receive a concept preview result

---

# 31. Final Direction to Codex

Build the mobile app as a polished field tool, not as a compressed desktop app.

Prioritize:
- camera-first capture
- quick property access
- AI photo intelligence
- room organization
- checklist execution
- Listing Vision Mode

The mobile app should feel powerful in the hands of:
- a homeowner standing in their own house
- a realtor standing in a listing appointment

That is the product standard.

---

End of Document
