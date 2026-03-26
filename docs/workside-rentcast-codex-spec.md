# Workside Home Advisor  
## RentCast → AI Pricing Engine (Codex Spec — PRODUCTION READY)

---

# 1. 🔌 Core RentCast Endpoints

## PRIMARY
GET https://api.rentcast.io/v1/avm/value

## SECONDARY
GET https://api.rentcast.io/v1/listings/sale

## SUPPORT
GET https://api.rentcast.io/v1/properties

---

# 2. 📡 Endpoint Usage

## Example Request

GET /avm/value?address=123 Main St, Bakersfield, CA

### Recommended Params
- compCount=15
- maxRadius=2
- daysOld=180
- propertyType=Single Family
- bedrooms=4
- bathrooms=3
- squareFootage=2100

Header:
X-Api-Key: YOUR_API_KEY

---

# 3. 🧱 Normalized Comp Schema

```ts
interface Comp {
  _id: string;
  propertyId: string;
  price: number;
  sqft: number;
  beds: number;
  baths: number;
  pricePerSqft: number;
  distanceMiles: number;
  saleDate?: string;
  daysOnMarket?: number;
  propertyType?: string;
  listingType?: string;
  score?: number;
  raw: any;
  createdAt: string;
}
```

---

# 4. 🧠 Comp Scoring

score =
(distance * 0.25) +
(sqft * 0.20) +
(bedBath * 0.15) +
(recency * 0.20) +
(type * 0.10) +
(velocity * 0.10)

---

# 5. 🧹 Filtering Rules

- distance > 2mi → reject  
- older than 12 months → reject  
- sqft diff > 50% → reject  
- property type mismatch → reject  

---

# 6. 💰 Pricing Engine

1. Take top 5–10 comps  
2. Calculate median price per sqft  
3. Multiply by subject sqft  

Range:
- low = -3%  
- mid = base  
- high = +3%  

---

# 7. 🤖 AI Input/Output

Input:
- subject
- comps
- price range
- confidence

Output:
- summary
- strengths
- risks
- pricing strategy

---

# 8. 🔁 Flow

1. Fetch property  
2. Call RentCast  
3. Normalize comps  
4. Filter  
5. Score  
6. Calculate pricing  
7. Call AI  
8. Save  
9. Return  

---

# 9. 🧠 Caching

Key:
zip + beds + baths + sqft bucket

TTL:
24 hours

---

# 10. ⚠️ Edge Cases

- <3 comps → low confidence  
- high variance → widen range  
- rural → increase radius  

---

# 11. 🔥 Final Rule

Data ≠ Value  
Interpretation = Value
