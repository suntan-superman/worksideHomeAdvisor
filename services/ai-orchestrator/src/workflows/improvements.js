import { buildImprovementPrompt } from '../prompts/index.js';

export async function runImprovementWorkflow(context) {
  return {
    prompt: buildImprovementPrompt(context),
    output: {
      summary: 'Prioritize paint, curb appeal, and brighter photography before any major remodel.',
      topActions: [
        'Paint living room',
        'Paint primary bedroom',
        'Replace dim hallway fixtures',
      ],
      avoidActions: ['Full kitchen remodel before listing'],
    },
  };
}
