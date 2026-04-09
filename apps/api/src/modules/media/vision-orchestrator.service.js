import {
  buildProviderChain,
  isCandidateSufficient,
  rankCandidates,
  resolveVisionUserPlan,
} from './vision-orchestrator.helpers.js';

export async function orchestrateVisionJob({
  asset,
  preset,
  roomType,
  instructions = '',
  normalizedPlan = null,
  requestedMode = 'preset',
  userPlan = '',
  sourceBuffer,
  sourceImageBase64,
  existingJob = null,
  providerRunners = {},
}) {
  const effectiveUserPlan = resolveVisionUserPlan({ preset, userPlan });
  const openAiAvailable = typeof providerRunners.runOpenAiEdit === 'function';
  const chain = buildProviderChain({
    preset,
    userPlan: effectiveUserPlan,
    openAiAvailable,
  });
  const exhaustProviderChain = preset?.key === 'remove_furniture';
  const attempts = [];
  const allCandidates = [];

  for (const providerKey of chain) {
    try {
      let providerCandidates = [];

      if (providerKey === 'local_sharp') {
        providerCandidates = await providerRunners.runLocalSharp?.({
          asset,
          preset,
          roomType,
          instructions,
          normalizedPlan,
          requestedMode,
          userPlan: effectiveUserPlan,
          sourceBuffer,
          sourceImageBase64,
          existingJob,
        });
      } else if (providerKey === 'replicate_basic' || providerKey === 'replicate_advanced') {
        providerCandidates = await providerRunners.runReplicateProvider?.({
          providerKey,
          asset,
          preset,
          roomType,
          instructions,
          normalizedPlan,
          requestedMode,
          userPlan: effectiveUserPlan,
          sourceBuffer,
          sourceImageBase64,
          existingJob,
        });
      } else if (providerKey === 'openai_edit') {
        providerCandidates = await providerRunners.runOpenAiEdit?.({
          providerKey,
          asset,
          preset,
          roomType,
          instructions,
          normalizedPlan,
          requestedMode,
          userPlan: effectiveUserPlan,
          sourceBuffer,
          sourceImageBase64,
          existingJob,
        });
      }

      const normalizedCandidates = rankCandidates(
        (providerCandidates || []).map((candidate, index) => ({
          ...candidate,
          providerKey,
          providerAttemptIndex: attempts.length,
          providerCandidateIndex: index,
          isSufficient: isCandidateSufficient(candidate, preset.key),
        })),
        preset.key,
      );

      attempts.push({
        providerKey,
        candidateCount: normalizedCandidates.length,
        sufficientCount: normalizedCandidates.filter((candidate) => candidate.isSufficient).length,
        topOverallScore: Number(normalizedCandidates[0]?.overallScore || 0),
        topObjectRemovalScore: Number(normalizedCandidates[0]?.objectRemovalScore || 0),
        topRemainingFurnitureOverlapRatio: Number(
          normalizedCandidates[0]?.remainingFurnitureOverlapRatio || 0,
        ),
        topLargestComponentPersistenceRatio: Number(
          normalizedCandidates[0]?.largestComponentPersistenceRatio || 0,
        ),
        topNewFurnitureAdditionRatio: Number(
          normalizedCandidates[0]?.newFurnitureAdditionRatio || 0,
        ),
      });

      allCandidates.push(...normalizedCandidates);

      const sufficient = rankCandidates(
        normalizedCandidates.filter((candidate) => candidate.isSufficient),
        preset.key,
      )[0];
      if (sufficient && !exhaustProviderChain) {
        return {
          providerUsed: providerKey,
          providerAttemptCount: attempts.length,
          fallbackApplied: chain.indexOf(providerKey) > 0,
          bestVariant: sufficient,
          allCandidates: rankCandidates(allCandidates, preset.key),
          orchestration: { chain, attempts },
          userPlan: effectiveUserPlan,
        };
      }
    } catch (error) {
      attempts.push({
        providerKey,
        candidateCount: 0,
        sufficientCount: 0,
        topOverallScore: 0,
        topObjectRemovalScore: 0,
        topRemainingFurnitureOverlapRatio: 0,
        topLargestComponentPersistenceRatio: 0,
        topNewFurnitureAdditionRatio: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const rankedCandidates = rankCandidates(allCandidates, preset.key);
  const providerUsed = rankedCandidates[0]?.providerKey || null;
  return {
    providerUsed,
    providerAttemptCount: attempts.length,
    fallbackApplied: providerUsed ? chain.indexOf(providerUsed) > 0 : false,
    bestVariant: rankedCandidates[0] || null,
    allCandidates: rankedCandidates,
    orchestration: { chain, attempts },
    userPlan: effectiveUserPlan,
  };
}
