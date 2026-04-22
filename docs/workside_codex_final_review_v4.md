# Workside Home Advisor — FINAL REVIEW + CODEX FIXES (V4)

## Context
Review of latest outputs for:
- Mainsail Property (Almost Ready)
- Peralta Residence (Needs Work)

Focus: final polish → remove friction, improve realism, eliminate template feel.

---

# TOP-LEVEL VERDICT

You are CLOSE.

✅ Product-quality  
❌ Not yet premium / agent-level

Remaining issues:
- subtle inconsistencies
- tone mismatches
- template residue

---

# CRITICAL FIXES

## 1. PHOTO METRIC BUG (CRITICAL)

Mainsail shows:
- TOTAL SELECTED PHOTOS = 4
- MARKETPLACE READY = 5 (impossible) fileciteturn14file0

### Fix
- enforce: marketplace_ready <= total_selected
- add validation + fallback

---

## 2. SUMMARY TONE MISALIGNMENT

### Peralta issue
Still contains marketing language ("beautifully updated...") fileciteturn14file2  
→ not acceptable for 39/100 readiness

### Mainsail issue
Leads with negatives ("8 retakes required") fileciteturn14file0  
→ too pessimistic for near-ready property

### Fix
- readiness-driven tone system
- first sentence must frame readiness, not features

---

## 3. RISK / OPPORTUNITY DUPLICATION

Both properties still:
- risk = photos weak
- opportunity = photos improve

### Fix
- enforce semantic separation
- add similarity check + regeneration

---

## 4. FLYER CLASS (IMPROVED, NEEDS TUNING)

### Good
Mainsail now correctly:
→ Pre-Launch Flyer fileciteturn14file1

### Remaining
- Mainsail still slightly conservative
- Peralta still visually over-polished for preview

### Fix
- stricter class rules
- reduce preview flyer complexity
- strengthen pre-launch CTA

---

## 5. READINESS ECONOMICS

Improved but still slightly verbose

### Fix
Force 4-line structure:
1. metric
2. explanation
3. interpretation
4. action

---

## 6. REPETITION SYSTEM

“Photo retakes required” appears too often

### Fix
- same insight max 2 mentions
- convert others to shorthand references

---

## 7. FLYER VS REPORT VOICE

Flyers still contain advisory language:
"should", "recommended", etc. fileciteturn14file1

### Fix
- ban advisory words in flyers
- enforce benefit-driven copy

---

## 8. PERALTA FLYER TOO LARGE

Preview flyer still feels like full brochure fileciteturn14file3

### Fix
- max 2 pages
- hero + highlights + CTA only

---

## 9. MAINSAIL SHOULD FEEL MORE READY

Currently under-positioned

### Fix
- if readiness >= 65 + price set:
  → lead with strengths
  → reduce prep emphasis

---

## 10. LAYOUT CONSISTENCY

### Fix
- max 3–4 bullets per section
- max 2 paragraphs per block
- enforce spacing tokens
- consistent header sizes

---

# PRIORITY ORDER

1. Photo metric bug
2. Summary tone
3. Risk/opportunity separation
4. Flyer class tuning
5. Repetition limiter
6. Voice separation
7. Preview size reduction
8. Near-ready tone upgrade
9. Layout polish
10. Final validation

---

# FINAL TARGET

## Peralta
- prep-first
- honest
- not over-marketed

## Mainsail
- confident
- near-launch
- market-facing

## System
- adaptive
- consistent
- premium

---

# FINAL NOTE

You are now optimizing for TRUST, not just output.

That last 10% = clarity + confidence + credibility.
