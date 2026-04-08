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

async function runReplicatePrediction({
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
  const sanitizedGuidanceScale = Math.max(1, Math.min(10, Number(guidanceScale || 7.5)));
  const input = {
    image,
    mask,
    prompt,
    num_outputs: outputCount,
    guidance_scale: sanitizedGuidanceScale,
    steps: numInferenceSteps,
    strength,
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

export async function runReplicateGenericInpainting(options = {}) {
  return runReplicatePrediction(options);
}

export async function runReplicateFurnitureRemoval({
  outputCount = 1,
  strength = 0.52,
  guidanceScale = 8.6,
  numInferenceSteps = 40,
  negativePrompt =
    'new furniture, replacement furniture, staged furniture, recolored furniture, reshaped furniture, sofa, couch, chair, coffee table, side table, ottoman, rug, clutter, fireplace, mantel, built-in, new room, different room, low quality, unrealistic geometry, warped lines, distorted walls',
  ...options
} = {}) {
  return runReplicatePrediction({
    ...options,
    outputCount,
    strength,
    guidanceScale,
    numInferenceSteps,
    negativePrompt,
  });
}

export async function runReplicateInpainting(options = {}) {
  return runReplicateGenericInpainting(options);
}
