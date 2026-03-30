# Workside Home Advisor — Daily Execution Checklist

## Goal
Execute the final 7-day push toward launch with **zero ambiguity**.

Each task is designed to be:
- actionable
- testable
- completable

---

# DAY 1 — Provider Flow (Part 1)

## Signup + Onboarding

- [ ] Create new provider account
- [ ] Verify email works correctly
- [ ] Complete onboarding form fully
- [ ] Attempt duplicate signup (same email)
- [ ] Attempt incomplete onboarding (exit midway)

## Validation

- [ ] Ensure provider record created correctly in DB
- [ ] Ensure role = provider
- [ ] Ensure admin sees new provider

---

# DAY 2 — Provider Flow (Part 2)

## Billing + Portal

- [ ] Complete Stripe checkout
- [ ] Confirm webhook fires
- [ ] Confirm subscription stored in DB
- [ ] Confirm provider redirected to portal

## Portal Behavior

- [ ] Login works
- [ ] Dashboard loads
- [ ] Leads section loads

## Edge Cases

- [ ] Simulate failed payment
- [ ] Simulate expired session
- [ ] Confirm no duplicate provisioning

---

# DAY 3 — Vision System (Part 1)

## Dataset

- [ ] Collect 20 real photos:
  - [ ] living rooms
  - [ ] kitchens
  - [ ] bedrooms

## Run Presets

- [ ] declutter_light
- [ ] declutter_medium
- [ ] remove_furniture

---

# DAY 4 — Vision System (Part 2)

## Refinement

- [ ] Compare outputs side-by-side
- [ ] Identify best results per room
- [ ] Tune prompts
- [ ] Adjust mask logic (if needed)

## Output UX

- [ ] Ensure best variant is obvious
- [ ] Ensure poor results are filtered

---

# DAY 5 — Provider Coverage + Fallback

## Coverage Logic

- [ ] Filter providers by service area
- [ ] Confirm ranking works
- [ ] Confirm featured providers show first

## Fallback UX

- [ ] Trigger "no providers" scenario
- [ ] Display fallback message
- [ ] Show alternative options (Google/manual)

## Validation

- [ ] No blank states anywhere
- [ ] User always sees a next step

---

# DAY 6 — Demo + Output Quality

## Demo Properties

- [ ] Create 2–3 polished listings
- [ ] Add full media sets
- [ ] Run vision enhancements

## Output Review

- [ ] Generate brochure
- [ ] Generate report
- [ ] Review layout quality

## Visual Polish

- [ ] Fix any obvious formatting issues
- [ ] Ensure outputs look “premium”

---

# DAY 7 — Launch Readiness

## Full Flow Test

- [ ] Seller creates listing
- [ ] Runs vision
- [ ] Generates outputs
- [ ] Requests provider
- [ ] Provider receives lead
- [ ] Provider responds

## Billing Validation

- [ ] Seller billing works
- [ ] Provider billing works
- [ ] Webhooks firing correctly

## Final Checks

- [ ] No broken screens
- [ ] No dead-end flows
- [ ] No console errors in production

---

# FINAL CHECKLIST (Must Pass)

- [ ] Provider flow is stable
- [ ] Billing is reliable
- [ ] Vision is impressive (80%+)
- [ ] No blank states
- [ ] Outputs look professional
- [ ] Admin can monitor everything

---

# SUCCESS CRITERIA

You are ready when:

- You can demo end-to-end without friction
- A real provider could onboard and get value
- A seller could complete the flow without confusion

---

# RULE

👉 Do NOT add new features during this phase  
👉 Only fix, refine, and stabilize

---

# OUTCOME

At the end of this checklist, you should have:

- a stable marketplace
- a compelling demo
- a working revenue path
- confidence to onboard real users
