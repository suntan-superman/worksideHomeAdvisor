VISION_MULTI_PROVIDER_STRATEGY.md
# Workside Home Advisor — Vision AI Multi-Provider Strategy

## 🎯 Objective

Move from a single-model pipeline (Replicate) to a **multi-provider intelligent system** that:

- Always returns a result (no failures)
- Improves quality via fallback
- Controls cost via tiered plans
- Enables advanced features (floors, cabinets, exterior)

---

# 🧠 CORE ARCHITECTURE

## Tiered Execution Pipeline

1. Replicate (fast + cheap)
2. Replicate Advanced (stronger config)
3. OpenAI Image Editing (premium fallback)

---

# 🔁 FALLBACK ORCHESTRATION (CRITICAL)

```ts
async function processVisionTask(task) {
  const result1 = await runReplicate(task);
  if (isSufficient(result1)) return result1;

  const result2 = await runReplicateAdvanced(task);
  if (isSufficient(result2)) return result2;

  const result3 = await runOpenAI(task);
  return result3;
}
🧪 SUFFICIENCY LOGIC

Replace rejection-based system with:

function isSufficient(result) {
  return (
    result.focusRegionChange > 0.12 ||
    result.visualImprovementScore > threshold ||
    result.objectRemoved === true
  );
}
🟢 STANDARD PLAN (Replicate Only)

Use cases:

Enhance listing
Light declutter
Medium declutter
🟡 PRO PLAN (Replicate Advanced)

Use cases:

Partial furniture removal
Paint preview
Basic flooring changes

Enhancements:

stronger prompts
better masks
multiple attempts
🔴 PREMIUM PLAN (OpenAI / High-End Models)

Use cases:

full furniture removal
empty room generation
cabinet recoloring
flooring transformation
exterior upgrades
🧩 FEATURE ROADMAP
Phase 1 (NOW)
Remove hard rejection logic
Add fallback pipeline
Accept partial success
Phase 2
Object-level removal (table, chair, etc.)
Add segmentation (SAM)
Phase 3
Flooring changes
Cabinet color updates
Wall repaint previews
Phase 4
Exterior AI (yard, curb appeal, pool)
⚙️ CODEX TASKS
Create vision-orchestrator.service.js
Add provider abstraction layer
Implement fallback logic
Replace rejection with scoring
Add plan-based feature gating
Add logging:
provider used
success rate
cost tracking
💰 MONETIZATION

Standard:

enhancement + declutter

Pro:

partial furniture removal
paint + floors (basic)

Premium:

full transformations
exterior upgrades
🚀 EXPECTED OUTCOME
No more "generation failed"
Always return best available image
Higher quality for premium users
Scalable cost model
🧠 FINAL PRINCIPLE

Do NOT depend on one model.

Instead:

orchestrate multiple models
accept partial success
route intelligently