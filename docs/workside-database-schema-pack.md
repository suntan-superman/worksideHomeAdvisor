# Workside Home Advisor
## Database Schema Pack (MongoDB)
### Codex-Ready Collections, Indexes, and Relationships

Last Updated: 2026-03-29

---

# 1. Overview

This schema pack defines all collections required for:

- Properties
- Pricing
- Media
- Vision (AI image pipeline)
- Brochure
- Reports
- Checklist
- Providers
- Usage tracking

Designed for:
- scalability
- fast reads
- clean relationships
- asset-heavy workloads

---

# 2. Core Collections

## 2.1 properties

```json
{
  "_id": "prop_001",
  "userId": "usr_001",
  "address": {
    "street": "123 Main St",
    "city": "Bakersfield",
    "state": "CA",
    "zip": "93312"
  },
  "beds": 3,
  "baths": 2,
  "sqft": 1800,
  "status": "draft",
  "createdAt": "ISO_DATE",
  "updatedAt": "ISO_DATE"
}
```

Indexes:
- userId
- address.city + address.state

---

## 2.2 pricingAnalyses

```json
{
  "_id": "pricing_001",
  "propertyId": "prop_001",
  "priceRange": {
    "low": 370000,
    "mid": 389000,
    "high": 409000
  },
  "confidenceScore": 58,
  "strategy": "balanced",
  "comps": [],
  "narrative": "text",
  "createdAt": "ISO_DATE"
}
```

Indexes:
- propertyId
- createdAt (desc)

---

## 2.3 media

```json
{
  "_id": "media_001",
  "propertyId": "prop_001",
  "userId": "usr_001",
  "imageUrl": "https://...",
  "roomType": "kitchen",
  "qualityScore": 74,
  "isListingCandidate": true,
  "useInBrochure": false,
  "useInReport": false,
  "createdAt": "ISO_DATE"
}
```

Indexes:
- propertyId
- roomType

---

## 2.4 visionJobs

```json
{
  "_id": "visionjob_001",
  "mediaId": "media_001",
  "propertyId": "prop_001",
  "userId": "usr_001",
  "presetKey": "declutter_light",
  "status": "processing",
  "provider": "openai",
  "createdAt": "ISO_DATE"
}
```

Indexes:
- mediaId
- propertyId
- userId

---

## 2.5 visionVariants

```json
{
  "_id": "variant_001",
  "visionJobId": "visionjob_001",
  "mediaId": "media_001",
  "variantType": "declutter_light",
  "imageUrl": "https://...",
  "isSelected": false,
  "useInBrochure": false,
  "useInReport": false,
  "createdAt": "ISO_DATE"
}
```

Indexes:
- mediaId
- visionJobId

---

## 2.6 brochures

```json
{
  "_id": "brochure_001",
  "propertyId": "prop_001",
  "headline": "Beautiful home",
  "selectedMediaIds": [],
  "selectedVariantIds": [],
  "pdfUrl": null,
  "createdAt": "ISO_DATE"
}
```

Indexes:
- propertyId

---

## 2.7 reports

```json
{
  "_id": "report_001",
  "propertyId": "prop_001",
  "pdfUrl": "https://...",
  "status": "completed",
  "createdAt": "ISO_DATE"
}
```

Indexes:
- propertyId
- createdAt

---

## 2.8 checklistItems

```json
{
  "_id": "task_001",
  "propertyId": "prop_001",
  "title": "Take photos",
  "status": "pending",
  "phase": "pre_listing",
  "createdAt": "ISO_DATE"
}
```

Indexes:
- propertyId
- phase

---

## 2.9 providers

```json
{
  "_id": "prov_001",
  "name": "ABC Inspections",
  "category": "inspector",
  "city": "Bakersfield",
  "isSponsored": true,
  "createdAt": "ISO_DATE"
}
```

Indexes:
- category
- city

---

## 2.10 usageTracking

```json
{
  "userId": "usr_001",
  "month": "2026-03",
  "visionJobsUsed": 8,
  "reportsGenerated": 1
}
```

Indexes:
- userId + month

---

# 3. Relationships

- properties → pricingAnalyses (1:N)
- properties → media (1:N)
- media → visionJobs (1:N)
- visionJobs → visionVariants (1:N)
- properties → brochures (1:N)
- properties → reports (1:N)
- properties → checklistItems (1:N)

---

# 4. Design Decisions

## Embedded vs Referenced

Embedded:
- small summaries (priceRange)

Referenced:
- media
- variants
- reports

---

# 5. Index Strategy

Critical indexes:
- propertyId everywhere
- userId for ownership
- createdAt for sorting
- mediaId for variant lookup

---

# 6. Final Notes

- Avoid large documents (>16MB)
- Store images in cloud storage, not Mongo
- Cache expensive AI outputs
- Always index before scaling

---

End of Document
