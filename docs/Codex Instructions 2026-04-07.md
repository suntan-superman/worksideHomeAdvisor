# Workside Home Advisor – Codex Implementation Plan

## Objective

Implement the next major feature set for Workside Home Advisor with a clear, phased plan and explicit engineering direction.

This spec covers:

1. Forgot password via OTP email + forced password reset flow
2. Capture seller mobile number with formatted input
3. Third-party photo import + labeling + notes
4. Advanced photo enhancement with natural-language instructions
5. SMS confirmations after registration and provider feedback
6. Export-ready IG/FB advertising materials

---

# 1. Forgot Password via OTP Email + Forced Reset

## Goal

Allow a seller to request a password reset from either web or mobile, receive a short-lived OTP code via email, verify the code, and then be forced into a new password + confirm password screen.

## UX Requirements

### Entry points

* Web login screen: add `Forgot password?`
* Mobile login screen: add `Forgot password?`

### Flow

1. User enters email
2. Backend generates OTP
3. OTP emailed to user
4. User enters OTP
5. If valid, app navigates to `Set New Password`
6. User enters:

   * New password
   * Confirm password
7. Backend invalidates OTP after use
8. User is signed in or redirected to login

## Security Requirements

* OTP expires in 10 minutes
* One-time use only
* Max 5 attempts
* Rate limit by email + IP/device
* Hash OTP in database, never store plain OTP
* Invalidate all older password reset tokens for that user

## Data Model

### `password_reset_tokens`

```ts
{
  _id: ObjectId,
  userId: ObjectId,
  email: string,
  otpHash: string,
  expiresAt: Date,
  usedAt?: Date,
  attemptCount: number,
  createdAt: Date
}
```

## API Endpoints

* `POST /api/auth/forgot-password/request`
* `POST /api/auth/forgot-password/verify`
* `POST /api/auth/forgot-password/reset`

## Frontend Requirements

### Web

* `ForgotPasswordRequestPage`
* `ForgotPasswordVerifyPage`
* `ForgotPasswordResetPage`

### Mobile

* `ForgotPasswordRequestScreen`
* `ForgotPasswordVerifyScreen`
* `ForgotPasswordResetScreen`

## Email Template

Subject:
`Your Workside Home Advisor password reset code`

Body:
`Use this one-time code to reset your password: {{OTP}}`

## Codex Notes

* Reuse SendGrid
* Reuse existing auth store
* Keep flow app-controlled

---

# 2. Capture Seller Mobile Number + Formatted Input

## Goal

Collect and store seller mobile number during registration and profile editing for SMS communication.

## Requirements

* Add mobile number field to registration
* Add mobile number field to account/profile settings
* Format as user types
* Store in E.164 format in backend
* Validate US numbers initially
* Add SMS opt-in checkbox with consent language

Display format:
`(661) 555-1212`

Store format:
`+16615551212`

Consent copy:
`I agree to receive transactional SMS messages from Workside Home Advisor regarding account activity, provider responses, and listing workflow updates. Message frequency varies. Reply STOP to opt out.`

### `users` additions

```ts
{
  mobilePhone?: string,
  smsOptIn?: boolean,
  smsOptInAt?: Date
}
```

## Codex Notes

* Use libphonenumber-js or equivalent
* Normalize on server
* Do not send SMS without opt-in

---

# 3. Third-Party Photo Import + Label + Notes

## Goal

Support photos from outside the mobile device workflow and allow assignment of room labels and notes.

## Supported sources

* Upload from web
* Upload from mobile library
* Drag-and-drop on web
* Manual metadata assignment
* Third-party import source flag

### `property_photos`

```ts
{
  _id: ObjectId,
  propertyId: ObjectId,
  url: string,
  source: "mobile_capture" | "mobile_library" | "web_upload" | "third_party_import",
  label?: "kitchen" | "living_room" | "primary_bedroom" | "bathroom" | "exterior" | "dining_room" | "office" | "garage" | "other",
  notes?: string,
  uploadedByUserId: ObjectId,
  createdAt: Date
}
```

## Web UI

Create `Photo Import Manager` with:

* Upload zone
* Thumbnail grid
* Label dropdown
* Notes field
* Bulk assign label

## Mobile UI

Add:

* Import from library
* Label selection after import
* Notes field

## Codex Notes

* Extend existing photo model
* Require label before marketing-ready status
* Preserve upload source

---

# 4. Advanced Photo Enhancement + Natural Language Editing

## Goal

Allow freeform enhancement requests in addition to preset enhancements.

Example:
`Please remove furniture, change flooring to dark hardwood, and change wall colors to light green.`

## Phase 1

Keep presets:

* declutter
* brighten
* straighten
* listing-ready

Add freeform instruction box and async enhancement request.

### `photo_enhancement_jobs`

```ts
{
  _id: ObjectId,
  propertyPhotoId: ObjectId,
  propertyId: ObjectId,
  originalUrl: string,
  mode: "preset" | "freeform",
  preset?: string,
  instructions?: string,
  normalizedPlan?: {
    removeObjects?: string[],
    styleChanges?: string[],
    roomType?: string,
    flooring?: string,
    wallColor?: string,
    lighting?: string
  },
  status: "queued" | "processing" | "completed" | "failed",
  outputUrls: string[],
  selectedOutputUrl?: string,
  createdAt: Date
}
```

### Endpoint

* `POST /api/photos/enhance`

## Codex Notes

* Never overwrite originals
* Persist prompts and outputs
* Save preferred output per room
* Keep processing async

---

# 5. SMS Confirmation After Registration + Provider Feedback

## Goal

Send SMS for important workflow events.

### Required events

A. Registration confirmation
`Welcome to Workside Home Advisor. Your account is active and we’ll text you important listing and provider updates here. Reply STOP to opt out.`

B. Provider accepted
`Good news — a provider has responded to your request for {{serviceType}} at {{propertyName}}. We’ll update your workspace now.`

C. Pending / declined
`Update: your {{serviceType}} request for {{propertyName}} is still pending. We’ll keep looking and notify you when a provider responds.`

## Logging

Create `sms_logs`:

```ts
{
  _id: ObjectId,
  userId?: ObjectId,
  propertyId?: ObjectId,
  requestId?: ObjectId,
  direction: "outbound" | "inbound",
  to?: string,
  from?: string,
  body: string,
  status?: string,
  providerId?: ObjectId,
  createdAt: Date
}
```

## Codex Notes

* Use `TWILIO_MESSAGING_SERVICE_SID` if available
* Fallback to `TWILIO_PHONE_NUMBER`
* Respect STOP/HELP
* Only send if `smsOptIn === true`
* Ensure idempotency

---

# 6. IG / FB Export-Ready Ad Materials

## Goal

Extend flyer generation so each property can also generate a baseline social ad pack.

## Initial outputs

* 1 square concept (1080x1080)
* 1 story/reel concept (1080x1920)
* 1 ad copy document
* 1 CTA recommendation set

## Use as inputs

* best photos
* top reasons to buy
* pricing signal
* property facts
* neighborhood context

### Output shape

```ts
{
  headline: string,
  primaryText: string,
  shortCaption: string,
  cta: string,
  disclaimers?: string[]
}
```

### Endpoint

* `POST /api/marketing/social-pack`

## UI

Add:

* Export Flyer PDF
* Export Seller Report PDF
* Export Social Ad Pack

## Codex Notes

* Start with JSON/markdown export if PNG rendering is not ready
* Degrade gracefully when photo inventory is limited

---

# Phased Delivery Plan

## Phase 1

1. Forgot password OTP flow
2. Mobile phone capture + formatting + opt-in
3. Registration SMS confirmation
4. Provider response SMS confirmation

## Phase 2

5. Third-party photo import + labels + notes
6. Social ad pack export

## Phase 3

7. Natural-language photo enhancement

---

# Backend Task List

1. Add password reset token model and endpoints
2. Extend user model with `mobilePhone`, `smsOptIn`, `smsOptInAt`
3. Centralize SMS send helper
4. Trigger registration and provider-feedback SMS
5. Add photo import endpoints and metadata support
6. Add enhancement job model and async worker hooks
7. Add social pack generator endpoint

# Web Task List

1. Add forgot password screens
2. Add reset password screens
3. Add formatted mobile number input to registration/profile
4. Add photo import manager
5. Add social export action in marketing/report UI

# Mobile Task List

1. Add forgot password screens
2. Add formatted mobile number input to registration/profile
3. Add import-from-library flow with label and notes
4. Add freeform enhancement UI
5. Add provider/SMS status indicators

---

# Non-Negotiable Rules

1. No silent failures
2. Every async job must persist status
3. No SMS without opt-in
4. No reset token stored in plain text
5. Original photos must always be preserved
6. Social export must degrade gracefully

---

# Final Directive to Codex

Implement in phases, but architect all six features cohesively.
Prioritize:

* reliability
* auditability
* seller clarity
* future monetization

Strongest differentiators:

* guided seller workflow
* provider communication loop
* premium photo enhancement
* marketing asset generation
