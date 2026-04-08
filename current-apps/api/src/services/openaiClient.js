import { env } from '../config/env.js';

function extractTextFromResponse(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim().length > 0) {
    return data.output_text;
  }

  if (!Array.isArray(data.output)) {
    return '';
  }

  const textParts = [];

  for (const item of data.output) {
    if (!Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (typeof contentItem.text === 'string') {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.join('\n').trim();
}

export function isOpenAiConfigured() {
  return Boolean(env.OPENAI_API_KEY);
}

export async function generateStructuredJson({
  schemaName,
  schema,
  systemPrompt,
  userPrompt,
  inputContent,
  model = env.OPENAI_MODEL_DEFAULT,
}) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const response = await fetch(`${env.OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      input:
        inputContent
          ? [{ role: 'system', content: systemPrompt }, ...inputContent]
          : [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message || `OpenAI request failed with status ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractTextFromResponse(data);
  if (!outputText) {
    throw new Error('OpenAI response did not include structured output text.');
  }

  return JSON.parse(outputText);
}
