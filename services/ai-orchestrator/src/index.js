import { aiEnv } from './config/env.js';
import { runImprovementWorkflow } from './workflows/improvements.js';
import { runPricingWorkflow } from './workflows/pricing.js';

const previewContext = {
  property: {
    title: '1234 Ridgeview Lane',
    city: 'Sacramento',
    state: 'CA',
  },
  comps: [],
  sellerGoals: ['maximize-profit'],
  rooms: ['living room', 'primary bedroom'],
  budget: 5000,
  media: [],
};

async function main() {
  const pricing = await runPricingWorkflow(previewContext);
  const improvements = await runImprovementWorkflow(previewContext);

  console.log('AI orchestrator preview booted', {
    defaultModel: aiEnv.defaultModel,
    pricingPreview: pricing.output.recommendedListMid,
    improvementActions: improvements.output.topActions.length,
  });
}

main();
