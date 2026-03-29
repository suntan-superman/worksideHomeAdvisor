# Workside Home Advisor
## Vision Feature Phase 1: Declutter + Furniture Removal (Codex Instructions)

Last Updated: 2026-03-29

---

# 1. Objective

Implement HIGH-QUALITY:
- Declutter (light + medium)
- Furniture Removal

This is Phase 1 of Vision Mode and must feel:
- realistic
- clean
- trustworthy
- impressive

---

# 2. Replicate Models (EXACT)

## Primary Model (USE THIS FIRST)

Model:
lucataco/sdxl-inpainting:latest

Why:
- Best balance of realism + control
- Supports inpainting workflows
- Strong for object removal

---

# 3. Exact Prompt Templates

## Declutter (Light)

Clean up this residential interior photo for real estate listing use.
Remove small clutter items, improve brightness and cleanliness.
Keep all furniture and structure. Stay realistic.

---

## Declutter (Medium)

Clean and simplify this residential interior photo.
Reduce clutter and visual noise but preserve layout and furniture.
Make the space feel open and tidy.

---

## Remove Furniture

Create a realistic version of this room with most movable furniture removed.
Keep structure and layout intact.
Make the room feel open and empty.

---

# 4. Replicate Parameters

Use:

guidance_scale: 7.5  
num_inference_steps: 35  
num_outputs: 2  

Strength:
- declutter_light: 0.6
- declutter_medium: 0.75
- remove_furniture: 0.85

---

# 5. Provider Code

```ts
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function runInpainting({
  imageUrl,
  prompt,
  strength = 0.75,
}) {
  const output = await replicate.run(
    "lucataco/sdxl-inpainting:latest",
    {
      input: {
        image: imageUrl,
        prompt,
        num_outputs: 2,
        guidance_scale: 7.5,
        num_inference_steps: 35,
        strength
      },
    }
  );

  return output;
}
```

---

# 6. Router Mapping

```ts
if (presetKey === "declutter_light") {
  return runInpainting({ imageUrl, prompt, strength: 0.6 });
}

if (presetKey === "declutter_medium") {
  return runInpainting({ imageUrl, prompt, strength: 0.75 });
}

if (presetKey === "remove_furniture") {
  return runInpainting({ imageUrl, prompt, strength: 0.85 });
}
```

---

# 7. Before/After Slider UI

Install:

npm install react-compare-slider

---

## Component

```tsx
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";

export default function BeforeAfter({ original, enhanced }) {
  return (
    <ReactCompareSlider
      itemOne={<ReactCompareSliderImage src={original} />}
      itemTwo={<ReactCompareSliderImage src={enhanced} />}
    />
  );
}
```

---

# 8. UI Layout

Top of Vision tab:

- Before/After slider
- Variant thumbnails below
- Actions: Select / Use / Regenerate

---

# 9. Variant Rules

- Always generate 2 variants
- Allow selection
- Cache results

---

# 10. Success Criteria

- Realistic output
- No distortion
- Clear improvement
- Smooth slider interaction

---

End of Document
