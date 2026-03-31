# Workside Home Advisor — Provider Verification System Spec
## Codex-Ready Implementation

Version: 1.0

---

# 1. Objective

Design a progressive provider verification system that:
- Builds trust without hurting onboarding conversion
- Allows providers to upgrade credibility over time
- Enables monetization via verification tiers
- Supports future compliance workflows

---

# 2. Verification Model

## Tier 1 — Self-Reported
- Insured: Yes/No
- Bonded: Yes/No
- Licensed: Yes/No

verificationLevel = "self_reported"

---

## Tier 2 — Details Provided
- Insurance carrier
- Policy number (optional)
- License number
- License state

verificationLevel = "details_provided"

---

## Tier 3 — Verified
- Upload insurance certificate
- Upload license documentation
- Admin verification

verificationLevel = "verified"

---

# 3. Data Model

```ts
type ProviderVerification = {
  insurance: {
    hasInsurance: boolean
    carrier?: string
    policyNumber?: string
    expirationDate?: string
  }
  license: {
    hasLicense: boolean
    licenseNumber?: string
    state?: string
  }
  bonding: {
    hasBond: boolean
  }
  verification: {
    level: 'self_reported' | 'details_provided' | 'verified'
    verifiedAt?: string
  }
}
```

---

# 4. UX Flow

## Signup
- Ask: insured, licensed, bonded

## Post-Signup
- Prompt to complete profile

## Verification Upgrade
- Upload documents
- Submit for verification

---

# 5. Seller UI

- Show trust badges
- Highlight verified providers

---

# 6. Admin Tools

- Approve/reject verification
- Filter by status
- Flag expired credentials

---

# 7. Ranking Impact

Boost providers with:
- verified status
- full profiles

---

# 8. Monetization

Basic → self-reported  
Pro → details  
Verified → badge + ranking boost  

---

# 9. Compliance

Disclaimer:
Provider credentials are self-reported or verified where indicated. Workside does not guarantee accuracy.

---

# 10. Phases

Phase 1: schema + levels  
Phase 2: UI + ranking  
Phase 3: uploads + admin workflow  

---

# 11. Outcome

- Higher trust
- Better conversion
- Monetization layer
