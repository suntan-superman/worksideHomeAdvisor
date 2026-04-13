import Replicate from 'replicate';

import { env } from '../../config/env.js';

let replicateClient;

function getReplicateClient() {
  if (!env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not configured.');
  }

  if (!replicateClient) {
    replicateClient = new Replicate({
      auth: env.REPLICATE_API_TOKEN,
    });
  }

  return replicateClient;
}

export async function runReplicateInpainting({
  image,
  mask,
  model = 'lucataco/sdxl-inpainting:latest',
  prompt,
  strength = 0.75,
  outputCount = 2,
  guidanceScale = 7.5,
  numInferenceSteps = 35,
  scheduler = 'K_EULER',
  negativePrompt = 'monochrome, lowres, bad anatomy, worst quality, low quality',
  seed,
}) {
  const sanitizedOutputCount = Math.max(1, Math.min(4, Number(outputCount || 1)));
  const sanitizedGuidanceScale = Math.max(1, Math.min(10, Number(guidanceScale || 7.5)));
  const sanitizedInferenceSteps = Math.max(1, Math.min(150, Number(numInferenceSteps || 35)));
  const sanitizedStrength = Math.max(0.1, Math.min(0.99, Number(strength || 0.75)));

  const input = {
    image,
    mask,
    prompt,
    num_outputs: sanitizedOutputCount,
    guidance_scale: sanitizedGuidanceScale,
    num_inference_steps: sanitizedInferenceSteps,
    steps: sanitizedInferenceSteps,
    strength: sanitizedStrength,
    scheduler,
    negative_prompt: negativePrompt,
  };
  if (Number.isFinite(seed)) {
    input.seed = seed;
  }

  const replicate = getReplicateClient();
  const output = await replicate.run(model, {
    input,
  });

  if (!Array.isArray(output)) {
    return output ? [output] : [];
  }

  return output.filter(Boolean);
}
