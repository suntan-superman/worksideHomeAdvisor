Workside Home Advisor — Image Enhancement Pipeline Spec (Codex-Ready)
🎯 Objective

Build a controlled, production-grade image enhancement system for real estate photos using Replicate that:

Enhances listing quality
Preserves structural integrity of the home
Prevents hallucinations (e.g., random fireplaces)
Supports both preset modes and natural language input
⚠️ Core Problem

Current approach uses unconstrained generative prompts, which causes:

Object hallucination
Layout changes
Inconsistent edits
✅ Solution Architecture

Move from:

❌ Full image generation
➡️
✅ Mask-based inpainting with strict constraints

🏗️ System Architecture
Flow
Mobile/Web UI
   ↓
API (Node backend)
   ↓
Image Processor Service
   ↓
Replicate (Inpainting Model)
   ↓
Storage (S3 / GCS)
   ↓
Return Enhanced Image
🔧 Feature Set
1. Enhancement Modes (Preset-Based)

Replace free text with structured options:

type EnhancementMode =
  | "declutter"
  | "modernize"
  | "brighten"
  | "luxury"
  | "flooring-upgrade"
  | "wall-color-change";
2. Natural Language Support (Optional Layer)

Input:

"Remove furniture and add dark hardwood floors"

Parse into:

{
  "tasks": [
    { "type": "remove_furniture" },
    { "type": "change_flooring", "material": "dark hardwood" }
  ]
}
🧠 Prompt Engineering (STRICT)
Global Prompt Template
You are editing a real estate listing photo.

STRICT RULES:
- Do NOT add new objects
- Do NOT change layout or structure
- Do NOT modify walls, windows, or lighting unless explicitly requested
- Preserve perspective and proportions

ONLY perform the requested task.
Task Prompts
1. Declutter
Remove all furniture and clutter from the masked area.
Keep walls, floors, windows, and lighting unchanged.
Do not add any new objects.
2. Flooring Upgrade
Replace ONLY the flooring with dark hardwood.
Match lighting and perspective.
Do not modify furniture, walls, or layout.
3. Wall Color Change
Change wall color to light neutral tones.
Preserve texture, lighting, and shadows.
Do not modify any other elements.
🎯 Mask Generation (CRITICAL)
Option A — Manual (MVP)
User taps areas on mobile
Draw mask overlay
Option B — Auto Detection (Phase 2)

Use:

Segmentation models (Replicate / custom)
Detect:
Furniture
Floors
Walls
🤖 Replicate Configuration
Recommended Models
stability-ai/stable-diffusion-xl
inpainting-specific models
controlnet-enabled models
Example API Call
const response = await replicate.run(
  "stability-ai/stable-diffusion-xl-inpainting",
  {
    input: {
      image: imageUrl,
      mask: maskUrl,
      prompt: finalPrompt,
      guidance_scale: 10,
      strength: 0.4,
      num_inference_steps: 30
    }
  }
);
Key Parameters
Parameter	Value	Purpose
guidance_scale	8–12	Reduce hallucination
strength	0.3–0.5	Preserve original
steps	25–40	Quality
🧩 Backend Implementation
Endpoint
POST /api/images/enhance
Request
{
  "imageUrl": "...",
  "mode": "declutter",
  "maskUrl": "...",
  "instructions": "optional natural language"
}
Response
{
  "enhancedImageUrl": "...",
  "status": "complete"
}
Async Processing (Recommended)
Queue job (BullMQ / Firebase queue)
Return jobId
Poll or webhook for completion
🖼️ Storage
Original images: /images/original
Masks: /images/masks
Enhanced: /images/enhanced
📱 UI/UX (CRITICAL)
Replace Free Text with:
Buttons:
✅ Remove Furniture
✅ Upgrade Flooring
✅ Brighten Room
✅ Modern Look
Optional Advanced Mode:
"Make this room feel modern and clean"

→ Parsed into structured tasks

🚀 Advanced Features (Phase 2)
1. Multi-Step Editing Pipeline
Step 1: Declutter
Step 2: Flooring upgrade
Step 3: Lighting enhancement
2. Before / After Slider
Essential for user trust
3. Confidence Scoring
Reject low-quality outputs automatically
4. Provider Integration
“Need help staging this room?”
→ Trigger SMS workflow (Twilio)
⚠️ Guardrails
MUST IMPLEMENT
Reject outputs that:
Add new structures
Distort geometry
Change layout
🧪 Testing Plan
Test Cases
Bedroom clutter removal
Kitchen flooring upgrade
Living room wall repaint
Edge case: low light images
💡 Key Insight

This feature is NOT about perfect AI editing.

It is about:

👉 Making homes look more market-ready with minimal friction

✅ Implementation Order
Phase 1 (MVP)
Preset modes
Manual mask
Inpainting
Phase 2
Auto segmentation
Natural language parsing
Phase 3
Multi-step pipeline
Marketplace integration
🔥 Outcome

This becomes one of your strongest differentiators:

Zillow does NOT do this well
Agents will LOVE it
Sellers will pay for it