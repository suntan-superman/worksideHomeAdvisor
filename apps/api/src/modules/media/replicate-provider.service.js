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
