# Workside Home Seller Assistant — Report Specifications (Production-Grade)

## Overview
This document defines two core reports generated from the Home Advisor platform:

1. Property Summary Report (Seller Intelligence Report)
2. Marketing Report (Listing / Sales Brochure)

---

# 1. PROPERTY SUMMARY REPORT

## Purpose
Data-driven seller report covering pricing, readiness, comps, and next steps.

## Key Sections
- Cover Page
- Executive Summary (AI)
- Property Details
- Pricing Analysis
- Comparable Properties (with details + adjustments)
- Photo Review + AI scoring
- Readiness Score (0–100)
- Task Status (complete / in-progress / pending)
- Prep Recommendations (ROI-based)
- Provider Recommendations (local + marketplace)
- Risk & Opportunity Analysis
- Next Steps (action plan)

---

# 2. MARKETING REPORT (BROCHURE)

## Purpose
Buyer-facing document designed to convert interest into showings.

## Key Sections
- Cover (hero image + headline)
- Property Highlights
- Lifestyle Description (AI)
- Photo Gallery (curated)
- Key Features
- Neighborhood Overview
- Pricing Positioning
- Call-To-Action
- Contact Info

---

# Additional Enhancements (Highly Recommended)

## Property Summary Additions
- Timeline to market readiness
- Estimated cost of improvements
- Expected ROI per improvement
- “What happens if you don’t do this” insights
- Buyer persona targeting (who this home appeals to)

## Marketing Report Additions
- Emotional headline generator
- “Top 5 reasons to buy this home”
- Visual feature callouts on images
- QR code linking to listing page
- Short-form social version (for IG/FB ads)

---

# Design Requirements
- Clean, modern UI (match app)
- Card-based layout
- Strong typography hierarchy
- Print-friendly PDF formatting

---

# Codex Implementation Notes

## Backend
- /reports/property-summary/:id
- /reports/marketing/:id

## PDF Generation
- Puppeteer (recommended)

## Components
- ReportSection
- CompCard
- ProviderCard
- PhotoGrid

## AI Usage
- Summary
- Pricing explanation
- Marketing copy
- Recommendations

---

# Positioning

Property Summary = Decision Engine  
Marketing Report = Conversion Engine  

Together = Complete Seller Experience
