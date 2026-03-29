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
  imageUrl,
  model = 'lucataco/sdxl-inpainting:latest',
  prompt,
  strength = 0.75,
  outputCount = 2,
  guidanceScale = 7.5,
  numInferenceSteps = 35,
}) {
  const replicate = getReplicateClient();
  const output = await replicate.run(model, {
    input: {
      image: imageUrl,
      prompt,
      num_outputs: outputCount,
      guidance_scale: guidanceScale,
      num_inference_steps: numInferenceSteps,
      strength,
    },
  });

  if (!Array.isArray(output)) {
    return output ? [typeof output === 'string' ? output : output?.url?.() || String(output)] : [];
  }

  return output
    .map((item) => (typeof item === 'string' ? item : item?.url?.() || String(item)))
    .filter(Boolean);
}
