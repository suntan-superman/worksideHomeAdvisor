import sharp from 'sharp';

import { env } from '../../config/env.js';
import { isOpenAiConfigured } from '../../services/openaiClient.js';

const OPENAI_IMAGE_MODEL = 'gpt-image-1';

function buildOpenAiErrorMessage(data, status) {
  if (typeof data?.error?.message === 'string' && data.error.message.trim().length > 0) {
    return data.error.message.trim();
  }

  if (typeof data?.detail === 'string' && data.detail.trim().length > 0) {
    return data.detail.trim();
  }

  return `OpenAI image edit failed with status ${status}.`;
}

async function normalizeOpenAiEditAssets(sourceBuffer, maskBuffer) {
  const normalizedSourceBuffer = await sharp(sourceBuffer).rotate().png().toBuffer();
  const metadata = await sharp(normalizedSourceBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);

  if (!width || !height) {
    throw new Error('OpenAI image edit requires a valid source image size.');
  }

  const { data: grayscaleMask } = await sharp(maskBuffer)
    .rotate()
    .resize(width, height, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgbaMask = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const grayscale = grayscaleMask[index];
    const offset = index * 4;
    rgbaMask[offset] = 255;
    rgbaMask[offset + 1] = 255;
    rgbaMask[offset + 2] = 255;
    rgbaMask[offset + 3] = 255 - grayscale;
  }

  const normalizedMaskBuffer = await sharp(rgbaMask, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  return {
    normalizedSourceBuffer,
    normalizedMaskBuffer,
  };
}

async function resolveImageOutputBuffer(result) {
  if (typeof result?.b64_json === 'string' && result.b64_json.length > 0) {
    return Buffer.from(result.b64_json, 'base64');
  }

  if (typeof result?.url === 'string' && result.url.length > 0) {
    const response = await fetch(result.url);
    if (!response.ok) {
      throw new Error(`OpenAI image output download failed with status ${response.status}.`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error('OpenAI image edit did not return an image payload.');
}

export function isOpenAiImageEditConfigured() {
  return isOpenAiConfigured();
}

export async function runOpenAIImageEdit({
  sourceBuffer,
  maskBuffer,
  prompt,
  outputCount = 1,
  quality = 'high',
  size = 'auto',
  inputFidelity = 'high',
}) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const { normalizedSourceBuffer, normalizedMaskBuffer } = await normalizeOpenAiEditAssets(
    sourceBuffer,
    maskBuffer,
  );

  const form = new FormData();
  form.append('model', OPENAI_IMAGE_MODEL);
  form.append(
    'image',
    new Blob([normalizedSourceBuffer], { type: 'image/png' }),
    'source.png',
  );
  form.append(
    'mask',
    new Blob([normalizedMaskBuffer], { type: 'image/png' }),
    'mask.png',
  );
  form.append('prompt', String(prompt || '').trim());
  form.append('quality', quality);
  form.append('size', size);
  form.append('input_fidelity', inputFidelity);
  form.append('output_format', 'png');
  form.append('n', String(Math.max(1, Math.min(2, Number(outputCount || 1)))));

  const response = await fetch(`${env.OPENAI_BASE_URL}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: form,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(buildOpenAiErrorMessage(data, response.status));
  }

  const results = Array.isArray(data?.data) ? data.data : [];
  const outputs = [];
  for (const result of results) {
    const outputBuffer = await resolveImageOutputBuffer(result);
    outputs.push({
      outputBuffer,
      providerSourceUrl: typeof result?.url === 'string' ? result.url : null,
      metadata: {
        model: OPENAI_IMAGE_MODEL,
        revisedPrompt: result?.revised_prompt || null,
      },
    });
  }

  return outputs;
}
