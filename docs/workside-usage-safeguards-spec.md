# Workside Home Advisor
## Usage Safeguards + Anti-Abuse System (Codex Spec)

Last Updated: 2026-03-27

---

# 1. Purpose

This system protects Workside Home Advisor from:

- excessive API costs (RentCast, AI, etc.)
- repeated unnecessary analysis runs
- account sharing / subscription abuse
- automation or bot-like usage

---

# 2. Core Principles

1. NEVER recompute expensive operations unnecessarily
2. ALWAYS cache analysis results
3. LIMIT usage based on plan
4. TRACK usage at user + property level
5. MAKE limits configurable via admin
6. FAIL gracefully

---

# 3. Key Safeguards

## Analysis Cooldown
- Default: 24 hours
- If re-run within window → return cached result

## Monthly Limits (Agents)
- Starter: 10 properties/month
- Pro: 30 properties/month
- Team: 100 properties/month

## Rate Limiting
- 5 requests/minute
- 20 requests/hour

---

# 4. Mongo Collections

## propertyAnalyses
Stores cached results with expiration

## usageTracking
Tracks per-user monthly usage

## rateLimit
Tracks short-term request bursts

---

# 5. Backend Flow

1. Check cache
2. Check cooldown
3. Check monthly quota
4. Check rate limit
5. Run analysis
6. Save result
7. Update usage

---

# 6. Admin Config

Plans configurable via systemConfig:
- cooldownHours
- monthlyPropertyLimit

---

# 7. UI Messaging

Cooldown:
"Showing recent analysis"

Limit reached:
"Upgrade required"

---

# 8. Final Directive

Prevent cost overruns while maintaining smooth UX.
