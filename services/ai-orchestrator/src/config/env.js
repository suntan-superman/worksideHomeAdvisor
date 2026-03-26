export const aiEnv = {
  defaultModel: process.env.OPENAI_MODEL_DEFAULT || 'gpt-4.1-mini',
  reasoningModel: process.env.OPENAI_MODEL_REASONING || 'o4-mini',
  visionModel: process.env.OPENAI_MODEL_VISION || 'gpt-4.1-mini',
};
