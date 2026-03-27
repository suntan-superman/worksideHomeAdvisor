# Workside Home Advisor
## Seller Checklist + Local Provider Marketplace + Monetization + Integration Spec

Last Updated: 2026-03-27

---

# 1. Overview

This module expands Workside Home Advisor from a preparation tool into a **full transaction platform**.

It introduces:
- dynamic seller checklist
- local provider marketplace
- monetization via providers
- Google Places integration
- referral + tracking system

---

# 2. Core Concept

Move from:
AI guidance

To:
AI-guided execution of the entire home sale process

---

# 3. Seller Checklist System

## 3.1 Phases

### Pre-Listing
- pricing
- improvements
- photos
- flyer

### Listing
- publish listing
- manage inquiries

### Under Contract
- hire inspector
- select title company
- review contract
- negotiate repairs

### Closing
- final walkthrough
- sign documents
- transfer ownership

---

## 3.2 Mongo Schema

### checklists

```json
{
  "_id": "...",
  "propertyId": "...",
  "phases": [
    {
      "name": "pre_listing",
      "items": [
        {
          "title": "Set pricing",
          "status": "complete",
          "providers": []
        }
      ]
    }
  ]
}
```

---

# 4. Provider Marketplace

## 4.1 Provider Types
- inspectors
- title companies
- attorneys
- photographers
- contractors
- cleaners

---

## 4.2 Mongo Schema

```json
{
  "_id": "...",
  "name": "ABC Inspections",
  "type": "inspector",
  "city": "Bakersfield",
  "rating": 4.8,
  "phone": "...",
  "website": "...",
  "isSponsored": false,
  "createdAt": "..."
}
```

---

# 5. Google Places Integration

## Endpoint Example

```ts
GET https://maps.googleapis.com/maps/api/place/nearbysearch/json
```

## Query Params
- location (lat,lng)
- radius
- type (home_inspector, lawyer, etc.)
- key

---

## Flow

1. user opens checklist item
2. backend calls Google Places
3. normalize results
4. store in providers collection
5. return to frontend

---

# 6. Provider Ranking Logic

Score based on:
- proximity
- rating
- review count
- relevance to task
- sponsorship boost

---

# 7. Monetization Model

## 7.1 Sponsored Listings
- providers pay monthly
- appear at top

## 7.2 Pay Per Lead
- user clicks/contact → charge provider

## 7.3 Subscription Listings
- verified providers pay recurring fee

---

# 8. Referral Tracking

## Schema

```json
{
  "userId": "...",
  "propertyId": "...",
  "providerId": "...",
  "action": "clicked",
  "timestamp": "..."
}
```

---

# 9. UI Flow

User clicks checklist item → sees:
- explanation
- provider list
- sponsored providers
- contact options

---

# 10. Disclaimer

Must show:

"Workside does not endorse or guarantee providers."

---

# 11. Codex Implementation Order

1. checklist schema + API
2. provider schema
3. Google Places integration
4. provider ranking
5. UI integration
6. referral tracking
7. monetization hooks

---

# 12. Strategic Impact

This transforms the app into:

A transaction platform + marketplace

---

# 13. Final Directive

Focus on:
- simplicity first
- strong UX
- clear value

Then expand into:
- monetization
- provider ecosystem
- referral optimization

---

End of Document
