import { buildPricingPrompt } from '../prompts/index.js';

export async function runPricingWorkflow(context) {
  return {
    prompt: buildPricingPrompt(context),
    output: {
      recommendedListLow: 624000,
      recommendedListMid: 638000,
      recommendedListHigh: 649000,
      confidenceScore: 0.79,
      risks: ['Kitchen photography still weak', 'Comp condition data partly inferred'],
      disclaimers: ['Guidance only. Not an appraisal.'],
    },
  };
}
