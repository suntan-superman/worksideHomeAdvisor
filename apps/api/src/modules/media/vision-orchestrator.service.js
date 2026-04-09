import {
  buildProviderChain,
  getVisionExecutionTimeBudgetMs,
  isHighConfidenceEarlyExitCandidate,
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
  nowFn = Date.now,
}) {
  const effectiveUserPlan = resolveVisionUserPlan({ preset, userPlan });
  const openAiAvailable = typeof providerRunners.runOpenAiEdit === 'function';
  const chain = buildProviderChain({
    preset,
    userPlan: effectiveUserPlan,
    openAiAvailable,
  });
  const exhaustProviderChain = preset?.key === 'remove_furniture';
  const startedAt = Number(nowFn());
  const maxExecutionTimeMs = getVisionExecutionTimeBudgetMs(preset?.key);
  const attempts = [];
  const allCandidates = [];

  const buildResponse = ({
    providerUsed = null,
    bestVariant = null,
    stoppedEarlyReason = null,
    timeBudgetReached = false,
  } = {}) => ({
    providerUsed,
    providerAttemptCount: attempts.length,
    fallbackApplied: providerUsed ? chain.indexOf(providerUsed) > 0 : false,
    bestVariant,
    allCandidates: rankCandidates(allCandidates, preset.key),
    orchestration: { chain, attempts },
    userPlan: effectiveUserPlan,
    stoppedEarlyReason,
    timeBudgetReached,
    elapsedTimeMs: Math.max(0, Number(nowFn()) - startedAt),
    maxExecutionTimeMs,
  });

  for (const providerKey of chain) {
    const elapsedBeforeProvider = Math.max(0, Number(nowFn()) - startedAt);
    if (elapsedBeforeProvider >= maxExecutionTimeMs && allCandidates.length) {
      const rankedCandidates = rankCandidates(allCandidates, preset.key);
      const providerUsed = rankedCandidates[0]?.providerKey || null;
      return buildResponse({
        providerUsed,
        bestVariant: rankedCandidates[0] || null,
        stoppedEarlyReason: 'time_budget',
        timeBudgetReached: true,
      });
    }

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
        elapsedMs: Math.max(0, Number(nowFn()) - startedAt),
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
      const shouldStopForCurrentCandidate =
        sufficient &&
        (!exhaustProviderChain || isHighConfidenceEarlyExitCandidate(sufficient, preset.key));
      if (shouldStopForCurrentCandidate) {
        return buildResponse({
          providerUsed: providerKey,
          bestVariant: sufficient,
          stoppedEarlyReason:
            exhaustProviderChain && preset?.key === 'remove_furniture'
              ? 'high_confidence_candidate'
              : 'sufficient_candidate',
        });
      }

      const elapsedAfterProvider = Math.max(0, Number(nowFn()) - startedAt);
      if (elapsedAfterProvider >= maxExecutionTimeMs && allCandidates.length) {
        const rankedCandidates = rankCandidates(allCandidates, preset.key);
        const providerUsed = rankedCandidates[0]?.providerKey || null;
        return buildResponse({
          providerUsed,
          bestVariant: rankedCandidates[0] || null,
          stoppedEarlyReason: 'time_budget',
          timeBudgetReached: true,
        });
      }
    } catch (error) {
      attempts.push({
        providerKey,
        candidateCount: 0,
        sufficientCount: 0,
        elapsedMs: Math.max(0, Number(nowFn()) - startedAt),
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
  return buildResponse({
    providerUsed,
    bestVariant: rankedCandidates[0] || null,
  });
}
