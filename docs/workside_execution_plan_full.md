# WORKSIDE – FULL LANDING, FUNNEL, AND FEATURE EXECUTION PLAN

Last updated: 2026-04-02

---

# 1. STRATEGIC CONTEXT

You are no longer building infrastructure.
You are building a conversion engine.

System status:
- Seller workflow: complete and usable
- Provider marketplace: functional
- Admin system: functional
- Billing: connected
- Vision: functional but not premium
- Workflow engine: implemented

👉 Phase:
Conversion + Monetization + Refinement

---

# 2. CORE FUNNEL ARCHITECTURE

You have 3 products, not 1:

SELLERS → /sell
AGENTS → /agents
PROVIDERS → /providers

---

# 3. GLOBAL FLOW

Landing
→ Mini onboarding
→ Partial result
→ Email capture
→ Full experience
→ Subscription

---

# 4. SELLER LANDING (PRIMARY)

## HERO

Sell your home with a plan — not a guess.

CTA:
Start your plan

---

## MINI ONBOARDING

Inputs:
- Address
- Beds / baths / sqft

---

## PARTIAL RESULT

Show:
- price range (blurred)
- readiness score
- 1 recommendation

Lock:
- full checklist
- providers
- report

---

## EMAIL GATE

Trigger before full value reveal

---

## FLOW

User enters address
→ sees preview
→ enters email
→ enters dashboard
→ upsell

---

# 5. AGENT LANDING

Message:
Win more listings. Close faster.

Features:
- branded reports
- seller presentations
- faster deals

CTA:
Get Agent Access

---

# 6. PROVIDER LANDING

Message:
Get high-intent seller jobs

Features:
- qualified leads
- scoped jobs
- local targeting

CTA:
Join Provider Network

---

# 7. IG + FACEBOOK FUNNEL

Ad → /sell → onboarding → preview → email → dashboard → subscription

Retarget:
- no email
- no conversion

---

# 8. CONVERSION RULES

DO:
- let user start immediately
- show value early
- gate before completion

DO NOT:
- require login first
- show pricing too early

---

# 9. TOP 10 FEATURES

1. Guided onboarding (extend existing workflow engine)
2. Seller funnel completion
3. Provider billing validation
4. Provider coverage UX
5. Vision refinement
6. Report / flyer polish
7. Provider trust system
8. Property billing model
9. Google fallback stability
10. Automated testing

---

# 10. NEXT 5 ACTIONS

1. Build /sell landing
2. Add mini onboarding
3. Add email gate
4. Connect backend
5. Add subscription prompt

---

# 11. CODEX IMPLEMENTATION SCAFFOLD

## ROUTES

export const routes = {
  sell: '/sell',
  agents: '/agents',
  providers: '/providers'
}

---

## COMPONENTS

<Hero />
<ValueCards />
<MiniOnboarding />
<ResultPreview />
<EmailGate />
<CTA />

---

## FLOW LOGIC

if (!emailCaptured):
  showEmailGate()

---

# 12. CORE PRODUCT INSIGHT

Your product is NOT:
- AI
- vision
- reports

Your product is:
👉 Guided selling plan + checklist

---

# 13. FINAL DIRECTION

Focus:
→ Convert traffic into subscriptions

---

END
