# Workside Current Status

Last updated: 2026-03-28

This document is the current working snapshot of what has been accomplished across the HomeAdvisor / Workside codebase and what remains to be done next.

It is intended to be more up to date than the older roadmap notes, especially around:

- the rebuilt mobile app baseline
- shared media between mobile and web
- current seller workflow status
- practical next implementation priorities

## 1. Executive Summary

The project now has a real end-to-end seller workflow in place:

- web app deployed and connected to live backend
- API deployed and connected to MongoDB, RentCast, OpenAI, SendGrid, Stripe, and Google Cloud
- mobile app rebuilt from a clean baseline after runtime corruption issues
- Android working
- iOS working
- property pricing working
- photo capture and AI photo review working
- saved mobile photos now visible in the web property workspace

The biggest shift since the earlier roadmap is that the mobile app is no longer in a “broken but ambitious” state. It has been reset, stabilized, and rebuilt in controlled slices. That gives us a usable baseline again.

## 2. What Has Been Accomplished

### 2.1 Core Platform

- [x] Monorepo is in place with:
  - `apps/web`
  - `apps/mobile`
  - `apps/api`
  - `apps/admin-web`
  - shared packages
- [x] Web app deployed to Netlify
- [x] API deployed to Google Cloud Run
- [x] MongoDB Atlas integrated
- [x] RentCast integrated
- [x] OpenAI integrated
- [x] SendGrid integrated
- [x] Stripe integrated
- [x] Google Cloud Storage integrated for media

### 2.2 Authentication And Account Flow

- [x] Email/password signup implemented
- [x] OTP verification implemented
- [x] login implemented
- [x] OTP resend implemented
- [x] welcome email implemented
- [x] branded email templates implemented
- [x] web auth wired to live backend
- [x] mobile auth wired to live backend
- [x] last successful email is remembered in mobile for easier testing
- [x] auth screen footer on mobile now includes:
  - Terms of Service
  - Privacy Notice
  - Support link

### 2.3 Property And Pricing

- [x] seller can create and select properties in the web app
- [x] property dashboard/workspace loads from live backend
- [x] pricing analysis works end to end
- [x] RentCast AVM + comps flow is producing believable results
- [x] pricing narrative is generated and shown in web
- [x] selected comps are displayed in the web property page
- [x] Google Maps neighborhood section is working on web
- [x] comps are shown on the map

Current observed pricing quality:

- known Bakersfield test property moved from the earlier broken `$0 to $0` output
- current result is now in a believable range around the Zillow sanity check example

### 2.4 Media, Photos, And AI Review

- [x] mobile app can capture a photo with camera
- [x] mobile app can select a photo from library
- [x] photo is saved to the selected property
- [x] backend stores media metadata in MongoDB
- [x] media file is stored and served through backend storage flow
- [x] AI photo analysis runs and returns:
  - room guess
  - quality score
  - summary
  - retake recommendation / improvement guidance
- [x] mobile app shows saved-photo gallery for the selected property
- [x] mobile app shows selected photo details
- [x] web property workspace now shows photos captured on mobile

### 2.5 Flyer And Marketing Foundation

- [x] flyer generation exists on the backend
- [x] sale and rental flyer draft generation exist
- [x] flyer preview exists in the web property page
- [x] flyer PDF export endpoint exists
- [x] web property page has flyer preview + download controls

What is true right now:

- the flyer flow is real
- it is useful for testing
- it is not yet the finished, polished, print-quality listing collateral system

### 2.6 Billing And Product Gating

- [x] Stripe plan catalog is wired
- [x] Stripe checkout session creation exists
- [x] webhook endpoint exists
- [x] sample/test plans were added for demos
- [x] admin accounts can bypass subscription restrictions
- [x] demo account handling exists
- [x] web billing UI exists at a first-pass level
- [x] safeguard foundation exists for usage/rate limiting/duplicate-job protection

### 2.7 Web UX Improvements

- [x] cleaner error handling via toast UI
- [x] sign out routes back correctly
- [x] top nav cleaned up for auth state
- [x] footer added
- [x] legal pages created and filled with real content
- [x] property workspace map moved higher and made useful
- [x] mobile-captured property photos now render in web

### 2.8 Mobile Rebuild And Stabilization

This is the biggest recent accomplishment.

- [x] old corrupted mobile state was archived safely
- [x] `apps/mobile` was rebuilt from a clean Expo baseline
- [x] duplicate Expo/root-app confusion was removed
- [x] runtime dependency mismatches were corrected
- [x] missing polyfill package issue was corrected
- [x] fresh Android baseline now launches
- [x] iOS baseline now launches

Current rebuilt mobile slices that are back and working:

- [x] auth screen
- [x] login flow
- [x] OTP verify flow
- [x] email memory for testing convenience
- [x] property loading
- [x] property selection
- [x] collapsible property details
- [x] photo capture
- [x] photo library import
- [x] photo save to backend
- [x] gallery section
- [x] Vision section
- [x] Tasks section

Current mobile direction:

- rebuild safely
- test Android and iOS continuously
- avoid reintroducing risky native complexity too early
- add features in controlled slices

## 3. What Is Working Right Now

As of this snapshot, the following user flow is real and usable:

1. Sign up on web
2. Verify email via OTP
3. Log in on web
4. Create or select a property
5. Run pricing analysis
6. Open the mobile app with the same account
7. Select the property
8. Capture or choose room photos
9. Get AI photo feedback
10. Save those photos to the property
11. Return to web and see the same saved photos in the property workspace
12. Generate or preview flyer output using the property data and media

That is major progress. It means the product is no longer just separate experiments. The shared seller workflow now exists.

## 4. Known Issues / Incomplete Areas

These are not necessarily broken, but they are incomplete, rough, or not yet polished enough.

### 4.1 Mobile UX Still Needs More Refinement

- [ ] property workspace is improved but still not truly app-native navigation
- [ ] Vision is useful but still lightweight
- [ ] Tasks are useful but still lightweight
- [ ] gallery can review photos, but there is not yet a deeper photo-edit workflow
- [ ] no biometric login yet
- [ ] no true settings page / account center in the rebuilt app yet
- [ ] no dedicated delete-account flow in the rebuilt mobile baseline yet

### 4.2 Flyer System Is First-Pass

- [ ] PDF export needs polish
- [ ] stronger layout/template variations are needed
- [ ] photo selection for flyer should become explicit and user-driven
- [ ] web/mobile should let seller choose “listing candidate” photos
- [ ] flyer quality should become presentation grade

### 4.3 Vision / Listing Readiness

- [ ] current Vision section is basic
- [ ] we still need:
  - best-photo selection workflow
  - listing-candidate selection
  - room coverage scoring
  - retake prioritization
  - visual listing-readiness guidance

### 4.4 Seller Guidance

- [ ] stronger seller prep advice
- [ ] marketing guidance
- [ ] showing timing guidance
- [ ] where-to-market guidance
- [ ] improvement prioritization
- [ ] draft agreement / non-binding document support with disclaimers

### 4.5 Admin / Operations

- [ ] admin console still needs real workflows
- [ ] diagnostics views should be more complete
- [ ] more operational visibility is needed for billing, media, and AI usage

## 5. Remaining Work By Area

### 5.1 Mobile App

#### High Priority

- [ ] polish property workspace navigation further
- [ ] make gallery more listing-oriented
- [ ] allow marking photos as flyer/listing candidates
- [ ] add lightweight note/flag metadata to saved photos
- [ ] build a better “best 3–5 listing photos” flow
- [ ] build deeper room coverage guidance
- [ ] add settings page in rebuilt mobile app
- [ ] add delete-account support in rebuilt mobile app

#### Medium Priority

- [ ] remember selected property between launches
- [ ] add stronger empty states and success states
- [ ] improve capture flow pacing and visuals
- [ ] add photo retake queue
- [ ] bring back biometric login last

### 5.2 Web App

- [ ] improve property page layout further now that media is visible
- [ ] improve flyer preview quality
- [ ] add photo selection controls for flyer generation
- [ ] improve comp detail UX
- [ ] improve dashboard / onboarding UX
- [ ] make media review more desktop-friendly

### 5.3 AI / Media

- [ ] improve photo-analysis prompt quality
- [ ] improve room classification reliability
- [ ] better retake guidance
- [ ] better listing-candidate ranking
- [ ] photo editing workflow
- [ ] before/after / listing-vision concepts later

### 5.4 Pricing

- [ ] explain why comps were chosen
- [ ] show stronger confidence reasoning
- [ ] surface AVM/comps mix more clearly
- [ ] improve debugging visibility for pricing runs

### 5.5 Flyers

- [ ] better templates
- [ ] better PDF styling
- [ ] more seller controls over tone and imagery
- [ ] stronger marketing copy options
- [ ] export/share options

### 5.6 Billing / Monetization

- [ ] finish the full paid-feature path around flyers and premium outputs
- [ ] tighten upgrade prompts
- [ ] finish webhook/state handling maturity
- [ ] decide final seller vs realtor monetization flows

### 5.7 Seller Guidance / Product Intelligence

- [ ] seller checklist system
- [ ] provider marketplace
- [ ] improvement recommendations tied to providers
- [ ] marketing guidance
- [ ] showing guidance
- [ ] timing guidance
- [ ] non-binding draft agreement assistance

## 6. Recommended Next Priorities

If we want to keep momentum while staying stable, this is the recommended order.

### Priority 1: Complete The Safe Mobile Rebuild

- [ ] refine gallery and listing-candidate workflow
- [ ] add settings and delete-account support
- [ ] add property memory / last used property
- [ ] only then add biometrics

### Priority 2: Make Shared Media A Real Feature

- [ ] let seller choose which saved photos are “listing ready”
- [ ] expose those selections in web
- [ ] use them directly in flyer generation

### Priority 3: Improve Flyer Quality

- [ ] better layout
- [ ] better PDF output
- [ ] better tone controls
- [ ] better image selection logic

### Priority 4: Strengthen Seller Guidance

- [ ] task/checklist system
- [ ] prep recommendations
- [ ] marketing guidance
- [ ] showing/timing guidance

### Priority 5: Realtor / Expansion Layer

- [ ] realtor mode
- [ ] listing presentation outputs
- [ ] provider marketplace
- [ ] Merxus integration later

## 7. Practical Immediate Next Steps

These are the most sensible next implementation tasks from today’s state:

- [ ] let users mark saved photos as flyer/listing candidates
- [ ] show those candidate photos clearly in mobile Vision and web
- [ ] feed chosen photos into flyer generation
- [ ] polish the web property media section
- [ ] add rebuilt mobile settings page
- [ ] add rebuilt mobile delete-account flow
- [ ] improve flyer PDF output quality
- [ ] add seller checklist persistence and UI

## 8. Bottom Line

The project is now meaningfully past the “does it even work?” phase.

It has:

- real auth
- real pricing
- real photo capture
- real AI review
- real shared media between mobile and web
- real flyer groundwork
- real deployment

The most important change is that the mobile app is no longer blocked by the earlier corrupted state. It is stable enough to keep rebuilding properly.

The next phase is not heroic debugging. The next phase is product quality:

- make saved photos truly listing-ready
- make flyer output feel professional
- make seller guidance more actionable
- keep web and mobile tightly in sync
