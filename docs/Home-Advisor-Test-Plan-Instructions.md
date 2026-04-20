# TASK: Generate Complete End-to-End Test Procedure for Workside Home Advisor

You are working on a production-grade system called "Workside Home Advisor".

This is NOT a simple app. It is a multi-tenant, multi-surface platform with:

- Web app (Next.js)
- Mobile app (Expo React Native)
- Backend API (Fastify + MongoDB)
- External integrations (Stripe, Twilio, OpenAI, Replicate, Google APIs)

---

# OBJECTIVE

Generate a COMPLETE, production-grade QA test plan and execution procedure covering:

1. Seller flows
2. Realtor (Agent) flows
3. Provider flows
4. Admin flows

This must include:

- End-to-end user journeys
- Edge cases
- Failure scenarios
- Integration validation
- Mobile + Web differences
- API-level validation where relevant

---

# OUTPUT FORMAT (STRICT)

Return a structured `.md` file with:

## 1. TEST STRATEGY OVERVIEW
- Scope
- Environments
- Test types (manual, automated, integration, regression)

## 2. ROLE-BASED TEST MATRICES

### SELLER
### AGENT (REALTOR)
### PROVIDER
### ADMIN

Each must include:

- Preconditions
- Test flows
- Expected outcomes
- Failure conditions

---

## 3. FULL END-TO-END FLOWS (STEP-BY-STEP)

### SELLER FLOW

Include ALL steps:

1. Public funnel entry
2. Address input
3. Signup (email + OTP)
4. Property creation
5. Dashboard load
6. Pricing analysis
7. Pricing explanation visibility
8. Photo upload (web + mobile)
9. Photo analysis
10. Vision enhancement (jobs, polling, cancel, retry)
11. Checklist interaction
12. Provider recommendations
13. Provider contact / SMS routing
14. Report generation
15. Flyer generation
16. Social pack generation
17. Billing / upgrade flow
18. Returning session behavior

For EACH step include:

- UI actions
- API calls involved
- Expected DB changes
- Expected UI state
- Edge cases
- Failure handling

---

### AGENT FLOW

Include:

- Signup + onboarding
- Property creation for client
- Report generation for listing presentation
- Multi-property management
- Branding / export usage
- Seller-facing presentation flow

---

### PROVIDER FLOW

Include:

- Provider signup
- Verification
- Profile setup
- Billing
- Lead reception (SMS via Twilio)
- Lead response
- Lead lifecycle tracking
- Portal usage

---

### ADMIN FLOW

Include:

- Admin login
- Dashboard metrics
- User inspection
- Property inspection
- Pricing diagnostics
- Media cleanup
- Provider moderation
- Billing inspection
- Worker/job inspection

---

## 4. INTEGRATION TESTING

For each:

### STRIPE
- checkout
- webhook handling
- subscription state sync
- failure scenarios

### TWILIO
- outbound SMS
- inbound replies
- webhook status callbacks

### OPENAI / REPLICATE
- response success
- malformed responses
- timeout handling
- fallback behavior

### GOOGLE APIs
- geocoding
- provider discovery fallback

---

## 5. MOBILE-SPECIFIC TESTS

- Camera capture
- Gallery import
- Upload reliability
- Background/resume behavior
- Network interruption handling
- Job polling reliability

---

## 6. FAILURE & EDGE CASES (CRITICAL)

Include:

- Slow AI jobs (>60s)
- Job failure mid-process
- Duplicate submissions
- Network drop during upload
- Partial data saves
- Billing failure after success UI
- SMS delivery failure
- Webhook delays

---

## 7. AUTOMATION PLAN

Define:

- What should be automated
- What should remain manual
- Suggested tooling:
  - Playwright (web)
  - Detox (mobile)
  - Supertest (API)

---

## 8. TEST DATA STRATEGY

- Seed data requirements
- Mock vs real integrations
- Sandbox environments

---

## 9. REGRESSION CHECKLIST

Create a repeatable checklist for every release.

---

# IMPORTANT CONSTRAINTS

- Be EXTREMELY detailed
- Do NOT skip steps
- Do NOT assume happy path only
- Think like a QA lead for a production SaaS platform
- Include real-world failure scenarios

---

# GOAL

The output should be usable by:

- QA testers
- Engineers
- Automation systems

This is NOT documentation.

This is a COMPLETE EXECUTION TEST PLAN.