# Workside Home Advisor
## Vision Quality Upgrade Pack for Codex
### Room-Specific Prompts + Artifact Reduction + AI Before/After Storytelling Flow

Last Updated: 2026-03-29

---

# 1. Purpose

This document gives Codex the next-level refinement guidance for Vision Mode.

It covers three critical areas:
1. room-specific prompts (kitchen vs living room and more)
2. artifact reduction strategies (edges, shadows, distortion, realism issues)
3. AI before/after storytelling flow for the PDF/report system

These upgrades are intended to move Vision Mode from:
- nice enhancement

to:
- credible, premium, persuasive visual intelligence

---

# 2. Room-Specific Prompt System

## 2.1 Why Room-Specific Prompts Matter

A generic prompt may improve lighting and clarity, but it often underperforms at the exact kind of transformation you want.

Examples:
- kitchens need countertop cleanup and appliance realism
- living rooms need sofa/chair removal without damaging layout
- bedrooms need restrained staging and calm composition
- bathrooms need fixture/tile preservation

Codex should not use one generic prompt for all rooms.

Instead:
- start with a base preset prompt
- append a room-specific suffix

---

## 2.2 Prompt Composition Pattern

Use this pattern:

FINAL_PROMPT =
BASE_PRESET_PROMPT
+ ROOM_SPECIFIC_SUFFIX
+ REALISM_GUARDRAILS

---

## 2.3 Base Prompt Templates

### A. Enhance for Listing
Enhance this residential real estate photo for listing use. Improve brightness, clarity, balance, and visual appeal while preserving the true layout, architecture, proportions, and finishes of the room. Keep the result realistic, natural, and honest.

### B. Declutter Light
Create a cleaner, more listing-ready version of this room by lightly removing small clutter, simplifying surfaces, and improving visual presentation. Preserve architecture, furniture, layout, and finishes. Keep the output realistic and truthful.

### C. Declutter Medium
Create a significantly cleaner, simpler, and more presentation-ready version of this room by removing visible clutter and reducing visual noise. Preserve the true structure, layout, and essential major furniture. Keep the result realistic and believable.

### D. Remove Furniture
Create a realistic version of this room with movable furniture removed so the space feels open and ready for showing. Preserve walls, floors, trim, windows, fixed cabinetry, and architectural details. Maintain realism, perspective, and proper proportions.

---

## 2.4 Room-Specific Suffixes

### Kitchen
Maintain realistic countertops, cabinetry, backsplash, appliances, sink, and lighting. Remove only clutter and non-essential movable items. Preserve cabinet alignment, appliance proportions, and countertop edges. Do not invent new finishes or alter cabinet layout.

### Living Room
Preserve major focal points such as windows, fireplace, built-ins, and sightlines. Keep the room proportional and spacious. If furniture is removed, maintain realistic floor visibility, rug boundaries where appropriate, and clean wall/floor transitions.

### Bedroom
Keep the room calm, simple, and proportional. Preserve windows, bed wall alignment, trim, and flooring transitions. Avoid over-staging or introducing unrealistic decor. If decluttering, keep the room believable and modest.

### Bathroom
Preserve tile, vanity, mirrors, fixtures, shower or tub geometry, and countertop edges accurately. Emphasize cleanliness and brightness. Avoid changing plumbing fixture placement, tile layout, or mirror proportions.

### Dining Room
Preserve room symmetry, windows, and lighting fixtures. Keep the space balanced and open. If furniture is removed, maintain realistic floor and wall continuity and avoid introducing distortions in the table zone.

### Exterior
Preserve the true roofline, windows, doors, driveway, landscaping boundaries, and lot shape. Improve visual cleanliness and presentation only. Do not alter architecture, add new permanent structures, or misrepresent the property exterior.

### Office / Bonus Room
Keep proportions realistic and preserve built-ins, windows, flooring, and permanent features. If decluttering, remove distractions while keeping the room versatile and buyer-friendly.

---

## 2.5 Universal Realism Guardrails

Append this to all prompts:

Keep the result realistic, natural, and suitable for residential real estate marketing. Do not distort walls, windows, doors, ceilings, floors, trim, or permanent fixtures. Do not invent architecture or major finishes that are not already present.

---

## 2.6 Example Final Prompt (Kitchen Declutter Medium)

Create a significantly cleaner, simpler, and more presentation-ready version of this room by removing visible clutter and reducing visual noise. Preserve the true structure, layout, and essential major furniture. Keep the result realistic and believable.

Maintain realistic countertops, cabinetry, backsplash, appliances, sink, and lighting. Remove only clutter and non-essential movable items. Preserve cabinet alignment, appliance proportions, and countertop edges. Do not invent new finishes or alter cabinet layout.

Keep the result realistic, natural, and suitable for residential real estate marketing. Do not distort walls, windows, doors, ceilings, floors, trim, or permanent fixtures. Do not invent architecture or major finishes that are not already present.

---

## 2.7 Example Final Prompt (Living Room Furniture Removal)

Create a realistic version of this room with movable furniture removed so the space feels open and ready for showing. Preserve walls, floors, trim, windows, fixed cabinetry, and architectural details. Maintain realism, perspective, and proper proportions.

Preserve major focal points such as windows, fireplace, built-ins, and sightlines. Keep the room proportional and spacious. If furniture is removed, maintain realistic floor visibility, rug boundaries where appropriate, and clean wall/floor transitions.

Keep the result realistic, natural, and suitable for residential real estate marketing. Do not distort walls, windows, doors, ceilings, floors, trim, or permanent fixtures. Do not invent architecture or major finishes that are not already present.

---

# 3. Artifact Reduction Strategy

## 3.1 Common Artifact Problems

Codex should expect and actively reduce:
- bent lines
- broken edges
- smeared cabinets
- warped flooring
- duplicate shadows
- melted furniture remnants
- distorted windows/trim
- inconsistent lighting direction

These issues can destroy trust even if the idea is good.

---

## 3.2 Primary Causes

Artifacts usually come from:
- overly aggressive strength
- weak room-specific prompting
- too much transformation at once
- poor input image quality
- no post-generation quality filter
- trying to remove too many objects without guardrails

---

## 3.3 Parameter Tuning Guidance

### Recommended strength guidance
- enhance_listing_quality: 0.45 to 0.6
- declutter_light: 0.55 to 0.7
- declutter_medium: 0.7 to 0.8
- remove_furniture: 0.8 to 0.9

### Important rule
Do not use one strength value for all presets.

---

## 3.4 Variant Count Rule

Always generate 2–3 variants.
Then select best result.

Do not trust the first output blindly.

---

## 3.5 Automated Quality Review Layer

After a provider returns variants, run a simple internal review pass.

Codex should score each variant on:
- structural realism
- edge quality
- lighting consistency
- artifact severity
- listing usefulness

### Suggested internal scores
- structuralIntegrityScore (0–100)
- artifactScore (0–100)
- listingAppealScore (0–100)

---

## 3.6 Basic Heuristic Filtering

Codex should reject or down-rank variants when:
- straight walls become visibly warped
- cabinet lines look smeared
- windows deform
- flooring pattern becomes unnatural
- shadows appear duplicated or illogical
- furniture leaves obvious ghost remnants

Even a simple manual/AI scoring pass is much better than showing every output.

---

## 3.7 Suggested Post-Generation Review Prompt

Use your own AI review system after variant generation.

### Example review prompt
Review this real estate image variant for realism and listing quality. Check for:
- warped walls or windows
- broken edges
- unrealistic shadows
- distorted floors
- smeared furniture remnants
- overall buyer-facing credibility

Return a short structured assessment and a score from 0 to 100 for:
1. structural realism
2. artifact severity
3. listing appeal

---

## 3.8 Best-Practice Workflow for Artifact Reduction

1. detect room type
2. choose preset
3. choose room-specific suffix
4. run generation
5. score each variant
6. pick best candidate
7. hide poor variants by default
8. allow manual override if desired

---

## 3.9 UI Recommendations for Quality Control

In the Vision tab:
- show only best 1–2 variants by default
- hide poor outputs behind “Show more variants”
- label weaker outputs internally, not publicly
- preserve original side-by-side always

---

## 3.10 Special Recommendations by Room

### Kitchens
Most fragile areas:
- cabinet lines
- backsplash
- countertop edges
- appliance doors

Use stronger cabinetry-preservation language in prompt.
Avoid overly aggressive furniture removal logic here unless clearly necessary.

### Living Rooms
Most fragile areas:
- sofa removal zones
- rugs
- table shadows
- floor continuity

Use more variants here.
Furniture removal is highest value, but also highest risk.

### Bathrooms
Most fragile areas:
- mirror reflections
- tile grout lines
- fixture geometry

Prefer enhancement + declutter more than aggressive transformation in phase 1.

---

# 4. AI Before/After Storytelling Flow for Reports

## 4.1 Why This Matters

A before/after image only becomes persuasive when it is framed properly.

Without storytelling, it feels like an image gimmick.

With storytelling, it becomes:
- a decision aid for sellers
- a listing pitch tool for agents
- a trust-building visual proof point in the report

---

## 4.2 Goal of the Storytelling Flow

The report should not just show:
- original image
- AI image

It should explain:
- what changed
- why it matters
- how it affects buyer perception
- what action the seller should consider next

---

## 4.3 New Report Section Recommendation

Add a dedicated section:

## Visual Improvement Previews

Structure:
1. original image
2. improved or concept image
3. what changed
4. why it matters
5. recommended seller action
6. disclaimer

---

## 4.4 Storytelling Card Pattern

For each before/after pair, use this pattern:

### Title
Example:
- Kitchen Declutter Concept
- Living Room Furniture Reduction Preview
- Warm Neutral Paint Preview

### Before / After Row
- original on left
- variant on right

### Narrative Block
Include:

#### What changed
Example:
- countertops and surfaces were visually simplified
- movable furniture was removed
- the room now feels more open and easier to photograph

#### Why it matters
Example:
- cleaner spaces tend to photograph better
- open-looking rooms can improve first impressions
- buyers may better understand room scale and layout

#### Suggested action
Example:
- declutter counters and remove small items before final photo shoot
- reduce oversized furniture before showings
- consider repainting in a neutral tone before listing

#### Disclaimer
Example:
- this is a conceptual preview for planning purposes only

---

## 4.5 Example Storytelling Copy: Kitchen Declutter

### Title
Kitchen Declutter Preview

### What changed
This preview reduces visible countertop clutter and simplifies the kitchen presentation while keeping the true room layout and finishes intact.

### Why it matters
Cleaner kitchens usually photograph better and help buyers focus on the cabinetry, counter space, and natural light rather than small distractions.

### Suggested action
Before final listing photos, clear counters, remove extra small appliances, and simplify visible kitchen items.

### Disclaimer
This image is an AI-generated planning preview and may not reflect exact final results.

---

## 4.6 Example Storytelling Copy: Living Room Furniture Removal

### Title
Living Room Open-Space Preview

### What changed
This preview removes most movable furniture to help show the room’s open floor area and natural flow.

### Why it matters
When a room feels less crowded, buyers may better understand its size, layout, and flexibility.

### Suggested action
Consider removing oversized furniture, reducing accent pieces, and simplifying the room before photography or showings.

### Disclaimer
This image is an AI-generated concept preview for planning purposes only.

---

## 4.7 Report Integration Rules

### Use enhancement variants in:
- photo readiness section
- selected media section
- brochure-support section

### Use concept previews in:
- improvement recommendations
- visual improvement previews section
- optional appendix

### Do not silently replace original photo with concept preview
Always show before/after pairing for concept previews.

---

## 4.8 Brochure Integration Rules

### Brochure can use:
- enhanced realistic images
- light decluttered images if still truthful

### Brochure should not use by default:
- empty-room furniture-removal concepts
- strong staging concepts
- flooring or paint concept previews
unless explicitly labeled as concept imagery

Trust matters more than novelty here.

---

## 4.9 Recommended Report Flow Placement

Suggested report order:
1. Executive Summary
2. Pricing
3. Comps + Map
4. Photo Readiness Summary
5. Visual Improvement Previews
6. Improvement Recommendations
7. Checklist
8. Providers
9. Draft Listing Description
10. Disclaimers

This makes Vision feel like a strategic asset, not an isolated gimmick.

---

## 4.10 Backend Payload Suggestion

Add report-ready story blocks:

```json
{
  "visionStoryBlocks": [
    {
      "title": "Kitchen Declutter Preview",
      "originalMediaId": "media_001",
      "variantId": "variant_101",
      "variantCategory": "enhancement",
      "whatChanged": "Counters and visible clutter were simplified.",
      "whyItMatters": "Cleaner kitchens generally photograph better and feel more buyer-ready.",
      "suggestedAction": "Clear visible countertop items before listing photos.",
      "disclaimer": "AI-generated planning preview."
    }
  ]
}
```

---

# 5. Codex Implementation Checklist

## Room-Specific Prompt Layer
- [ ] create room prompt suffix map
- [ ] append room suffix to base preset prompt
- [ ] append realism guardrail to all prompts
- [ ] add roomType resolution fallback logic

## Artifact Reduction
- [ ] tune strength by preset
- [ ] generate 2–3 variants per request
- [ ] add post-generation scoring pass
- [ ] hide low-quality variants by default
- [ ] store scoring metadata per variant

## Report Storytelling Flow
- [ ] add visual improvement preview section to report payload
- [ ] create storytelling blocks for selected variants
- [ ] show before/after pairs in report template
- [ ] keep concept previews clearly labeled
- [ ] wire enhancement vs concept rules into brochure/report systems

---

# 6. Final Direction to Codex

Do not treat Vision as a generic image-editing feature.

Treat it as:
- a seller decision system
- a realtor persuasion tool
- a report enhancement engine

The quality difference will come from:
1. room-aware prompts
2. quality filtering
3. strong storytelling around the result

That is how the feature becomes premium instead of gimmicky.

---

End of Document
