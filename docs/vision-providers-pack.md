# Workside Home Advisor
## Vision AI Providers Implementation Pack
### Replicate Models + API Code + Cost Estimates + Preset Mapping

Last Updated: 2026-03-29

---

# 1. Exact Replicate Models to Use (Recommended)

## A. Declutter / Object Removal
Model:
- lucataco/sdxl-inpainting

Use for:
- declutter_light
- declutter_medium
- remove_furniture

Notes:
- Strong inpainting capability
- Good for removing objects while preserving structure

---

## B. Virtual Staging / Interior Transformation
Model:
- zsxkib/realistic-vision-v5

Alternative:
- stability-ai/sdxl (with strong prompt guidance)

Use for:
- virtual_stage_light
- virtual_stage_modern

---

## C. Paint / Wall Color Changes
Model:
- lucataco/sdxl-inpainting

Use for:
- paint_warm_neutral
- paint_bright_white
- paint_soft_greige

---

## D. Flooring Changes
Model:
- lucataco/sdxl-inpainting

Use for:
- floor_light_wood
- floor_medium_wood
- floor_lvp_neutral

---

# 2. Preset → Model Mapping

| Preset | Provider | Model |
|------|--------|------|
| enhance_listing_quality | OpenAI | gpt-image-1 |
| declutter_light | Replicate | sdxl-inpainting |
| declutter_medium | Replicate | sdxl-inpainting |
| remove_furniture | Replicate | sdxl-inpainting |
| virtual_stage_light | Replicate | realistic-vision-v5 |
| virtual_stage_modern | Replicate | realistic-vision-v5 |
| paint_* | Replicate | sdxl-inpainting |
| floor_* | Replicate | sdxl-inpainting |

---

# 3. Working API Code (Provider Layer)

## 3.1 Install

npm install replicate openai

---

## 3.2 Replicate Provider

```ts
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function generateReplicateVariants({
  imageUrl,
  prompt,
  outputCount = 2
}) {
  const output = await replicate.run(
    "lucataco/sdxl-inpainting",
    {
      input: {
        image: imageUrl,
        prompt: prompt,
        num_outputs: outputCount
      }
    }
  );

  return output;
}
```

---

## 3.3 OpenAI Provider

```ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateOpenAIEnhancement({
  prompt
}) {
  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt: prompt,
  });

  return result.data;
}
```

---

## 3.4 Provider Router

```ts
export async function generateVision({
  preset,
  imageUrl,
  prompt
}) {
  if (preset.category === "enhancement") {
    return generateOpenAIEnhancement({ prompt });
  }

  if (preset.category === "concept_preview") {
    return generateReplicateVariants({ imageUrl, prompt });
  }

  throw new Error("Unsupported preset");
}
```

---

# 4. Cost Estimates

## OpenAI
- $0.02 – $0.06 per image

## Replicate
- $0.01 – $0.05 per image

---

## Per User

Seller:
- ~10 images/month → $0.30 – $0.80

Agent:
- ~50 images/month → $2 – $4

Heavy:
- ~200 images/month → $8 – $15

---

# 5. Pricing Strategy

| Plan | Cost | Suggested Price |
|------|------|----------------|
| Free | ~$0.30 | Free |
| Seller Pro | ~$1 | $9–19 |
| Agent | ~$5 | $29–79 |

---

# 6. Best Practices

- Generate 2–3 variants per request
- Cache identical requests
- Limit monthly usage
- Store all outputs

---

# 7. Build Order

1. OpenAI enhancement
2. Replicate declutter
3. staging
4. paint + flooring

---

# 8. Final Advice

Start with:
- declutter_light
- remove_furniture

Perfect those first.

---

End of Document
