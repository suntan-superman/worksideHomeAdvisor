# Workside Home Advisor
## Provider Onboarding UX Spec (Codex-Ready)

Last Updated: 2026-03-29

---

# 1. Key Answer First (Your Question)

Yes — 100%:

👉 Until you have providers onboarded, you SHOULD use Google as a fallback.

### Recommended Hybrid Approach (IMPORTANT)

Phase 1:
- Show Google-based providers (links out)
- No lead routing yet OR limited

Phase 2:
- Mix:
  - Your onboarded providers (top)
  - Google fallback providers (below)

Phase 3:
- Your providers dominate results
- Google becomes backup only

---

# 2. Onboarding Philosophy

The onboarding must be:

- Fast (under 3 minutes)
- Mobile-friendly
- No friction
- No overwhelm
- Immediate value

👉 If onboarding feels like work → providers won’t finish

---

# 3. Provider Onboarding Flow (Step-by-Step)

## Step 0 — Entry Points

Providers enter via:

- “List your business” CTA
- Invite link from admin
- SMS/email invite
- Landing page (future)

---

## Step 1 — Basic Info (Screen 1)

Fields:
- Business Name
- Category (dropdown)
- Phone
- Email

CTA:
👉 Continue

---

## Step 2 — Location & Coverage (Screen 2)

Fields:
- City
- State
- ZIP
- Service radius (5–50 miles slider)

Optional:
- Add multiple ZIPs

---

## Step 3 — Business Details (Screen 3)

Fields:
- Short description (AI-assisted optional)
- Website (optional)
- Years in business (optional)

---

## Step 4 — Lead Preferences (Screen 4)

Fields:
- Receive leads via:
  - SMS
  - Email
- Phone for SMS
- Preferred contact method

---

## Step 5 — Plan Selection (Screen 5)

Options:
- Free / Basic
- Standard
- Featured

Display:
- simple comparison
- no clutter

CTA:
👉 Continue to payment

---

## Step 6 — Stripe Checkout

- redirect to Stripe Checkout
- collect payment
- return to app

---

## Step 7 — Confirmation Screen

Show:
- “You’re live”
- next steps
- how leads work

CTA:
👉 Go to Provider Dashboard

---

# 4. Provider Dashboard (Initial UX)

## Overview Screen

Cards:
- Leads received
- Leads accepted
- Response rate
- Subscription status

---

## Leads Screen

List:
- property city
- category
- time received
- status

Actions:
- Accept
- Decline

---

## Profile Screen

Editable:
- business info
- service area
- contact methods

---

## Billing Screen

- plan
- renewal date
- upgrade button

---

# 5. Google Fallback Integration (VERY IMPORTANT)

## Why Use It

- instant coverage
- no cold start problem
- fills gaps in provider network

---

## How To Use It Properly

### Display Structure

Section 1:
👉 “Recommended Providers” (your system)

Section 2:
👉 “Other Local Options” (Google)

---

## Google Provider Card

Show:
- name
- rating
- address
- “View on Google” button

DO NOT:
- mix them with your providers
- allow confusion

---

## Label Clearly

Use:

👉 “From Google”

---

# 6. Transition Strategy (Critical)

## Early Stage

- 100% Google fallback allowed

## Growth Stage

- prioritize your providers
- show Google only if insufficient providers

## Mature Stage

- hide Google by default
- only show when no providers exist

---

# 7. Conversion Optimization Tricks

## Keep onboarding friction low

- no verification at start
- no documents
- no complexity

---

## Show immediate value

After signup:

👉 “You can start receiving leads today”

---

## Use scarcity

“Only 3 providers shown per category”

---

## SMS-first experience

Providers respond faster to SMS than apps

---

# 8. Admin Controls for Onboarding

Admin should be able to:

- manually add providers
- invite providers
- approve / reject providers
- mark verified
- upgrade/downgrade plans

---

# 9. Codex Implementation Checklist

## Onboarding Flow
- [ ] build multi-step onboarding UI
- [ ] create provider signup endpoint
- [ ] validate required fields
- [ ] persist provider record (pending billing)

## Billing Integration
- [ ] create Stripe checkout session
- [ ] handle success callback
- [ ] activate provider

## Dashboard
- [ ] provider dashboard overview
- [ ] provider leads view
- [ ] provider profile edit
- [ ] provider billing page

## Google Fallback
- [ ] integrate Google Places API
- [ ] fetch local providers by category + location
- [ ] map results to UI format
- [ ] clearly label as external

---

# 10. Final UX Principle

The onboarding should feel like:

👉 “I listed my business in 2 minutes and I’m already getting opportunities”

NOT:

👉 “I filled out a long form and now I wait”

---

# 11. Recommendation to Codex

Build onboarding as:
- step-based
- minimal friction
- Stripe-integrated
- SMS-first
- instantly actionable

Support Google fallback initially, but architect for replacement with internal providers.

---

End of Document
