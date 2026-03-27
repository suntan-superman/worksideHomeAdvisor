# Workside Home Advisor
## Listing Vision Mode + AI Room Visualization (Full Product + Technical Spec)

Last Updated: 2026-03-27

---

# 1. Overview

This document defines the **Listing Vision Mode** feature for Workside Home Advisor.

This feature allows:
- sellers and agents to visualize improvements
- generate before/after concepts
- tie improvements to pricing strategy
- generate leads for local providers

This is a **signature feature** designed to:
- win listings (for agents)
- increase seller confidence
- drive marketplace monetization

---

# 2. Core Concept

Move from:
“Here’s what you should do”

To:
“Here’s what it will look like if you do it”

---

# 3. Primary Use Cases

## 3.1 Realtor Listing Appointment

1. Agent enters property
2. Takes room photos
3. Runs visualization
4. Shows before/after
5. Ties changes to pricing
6. Generates flyer

Outcome:
- wins listing
- builds trust instantly

---

## 3.2 Seller Self-Service

1. Upload room photos
2. Select improvement options
3. View concept images
4. Decide what changes are worth doing

---

# 4. Visualization Modes

## 4.1 Furniture Removal / Declutter
- remove or reduce furniture
- clean room appearance

---

## 4.2 Wall Color Changes
- warm neutral
- white
- greige
- modern tones

---

## 4.3 Flooring Changes
- light wood
- medium wood
- vinyl plank
- remove carpet concept

---

## 4.4 Light Staging
- minimal furniture placement
- decor suggestions

---

## 4.5 Combined Mode
- declutter + paint + flooring

---

# 5. UI Flow

## 5.1 Entry Points

- property dashboard
- photo upload screen
- improvement recommendations
- agent mode quick tools

---

## 5.2 Screen: “See the Potential”

Title:
**Listing Vision Mode**

Layout:
- original image (left)
- concept preview (right)
- toggle variants

---

## 5.3 Controls

- select room type
- select transformation type
- choose presets
- regenerate
- save concept
- compare variants

---

## 5.4 Output Display

Show:
- Original
- Concept Preview
- Suggested Improvement Label

---

# 6. Pricing Integration

After visualization:

Display:

“If completed, similar homes suggest pricing range improvement of $X–$Y”

This must be:
- directional
- not guaranteed

---

# 7. Marketplace Integration

Each suggestion links to providers:

Example:

“Paint walls neutral”
→ show local painters

“Replace flooring”
→ show flooring providers

---

# 8. Monetization Strategy

## Sellers
- limited free previews
- paid unlock for more renders

## Realtors
- included in Pro plan
- limited credits or unlimited tier

## Providers
- leads from visualization-driven actions

---

# 9. Data Model

## roomVisualizations

```json
{
  "_id": "...",
  "propertyId": "...",
  "userId": "...",
  "roomType": "living_room",
  "originalImage": "...",
  "transformations": [
    {
      "type": "paint",
      "variant": "warm_neutral",
      "outputImage": "...",
      "createdAt": "..."
    }
  ],
  "selectedVariant": "...",
  "createdAt": "..."
}
```

---

# 10. Backend Flow

1. user uploads image
2. classify room
3. user selects transformation
4. create transformation job
5. call AI image model
6. store result
7. return to UI

---

# 11. AI Model Approach

Use image-to-image transformation models:

Capabilities:
- segmentation (walls, floors, objects)
- targeted editing
- style transformation

Important:
- aim for realistic but not perfect
- speed > perfection for UX

---

# 12. Prompt Strategy (Conceptual)

Example:

“Transform this living room by removing furniture and repainting walls a warm neutral tone with improved lighting.”

---

# 13. Storage

Store:
- original image
- transformed images
- metadata
- transformation types

Use CDN for delivery.

---

# 14. Safeguards

- limit transformations per user
- cache results
- reuse similar transformations
- avoid duplicate jobs

---

# 15. Disclaimers (MANDATORY)

Display:

“AI visualizations are conceptual previews only. Actual results and value impact may vary.”

---

# 16. Admin Controls

Allow:
- max renders per user
- render cooldown
- enable/disable transformation types
- pricing integration toggle

---

# 17. Strategic Impact

This feature enables:

- listing differentiation
- stronger agent presentations
- higher seller engagement
- marketplace monetization
- premium subscription justification

---

# 18. Final Positioning

For agents:

“Show sellers what their home could be before listing.”

For sellers:

“See if improvements are worth it before spending money.”

---

# 19. Future Expansion

- AR-based walkthrough previews
- cost estimation per improvement
- contractor bidding integration
- automated staging packages

---

# 20. Final Directive

Focus on:
- speed
- clarity
- trust
- visual impact

This is a WOW feature.

---

End of Document
