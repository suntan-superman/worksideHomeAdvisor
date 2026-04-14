import {
  buildProviderChain,
  getPreferredFinishFallbackCandidates,
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
  const normalizedPresetKey = String(preset?.key || '');
  const isSurfaceFinishPreset =
    normalizedPresetKey.startsWith('paint_') || normalizedPresetKey.startsWith('floor_');
  const exhaustProviderChain =
    normalizedPresetKey === 'remove_furniture' || isSurfaceFinishPreset;
  const requiresLocalTileStoneAttempt = normalizedPresetKey === 'floor_tile_stone';
  const allowBestEffortFinishCandidate = normalizedPresetKey.startsWith('floor_');
  const startedAt = Number(nowFn());
  const maxExecutionTimeMs = getVisionExecutionTimeBudgetMs(preset?.key);
  const attempts = [];
  const allCandidates = [];
  const allSufficientCandidates = [];
  const selectBestCandidates = (candidates = allCandidates) => {
    const sufficientCandidates = rankCandidates(
      candidates.filter((candidate) => candidate.isSufficient),
      preset.key,
    );
    if (sufficientCandidates.length) {
      return sufficientCandidates;
    }

    const preferredFinishFallbackCandidates = getPreferredFinishFallbackCandidates(
      candidates,
      preset.key,
    );
    if (preferredFinishFallbackCandidates.length) {
      return preferredFinishFallbackCandidates;
    }

    return rankCandidates(candidates, preset.key);
  };

  const canStopForTimeBudget = () => {
    if (!allSufficientCandidates.length) {
      return false;
    }

    if (!exhaustProviderChain) {
      return true;
    }

    if (normalizedPresetKey === 'remove_furniture') {
      const openAiPlanned = chain.includes('openai_edit');
      if (openAiPlanned) {
        return attempts.some((attempt) => attempt.providerKey === 'openai_edit');
      }

      return attempts.some((attempt) => attempt.providerKey === 'replicate_advanced');
    }

    return attempts.some(
      (attempt) =>
        attempt.providerKey === 'replicate_advanced' || attempt.providerKey === 'local_sharp',
    );
  };

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
    allCandidates: selectBestCandidates(allCandidates),
    orchestration: { chain, attempts },
    userPlan: effectiveUserPlan,
    stoppedEarlyReason,
    timeBudgetReached,
    elapsedTimeMs: Math.max(0, Number(nowFn()) - startedAt),
    maxExecutionTimeMs,
  });

  for (const [providerIndex, providerKey] of chain.entries()) {
    const elapsedBeforeProvider = Math.max(0, Number(nowFn()) - startedAt);
    if (elapsedBeforeProvider >= maxExecutionTimeMs && allCandidates.length && canStopForTimeBudget()) {
      const rankedCandidates = selectBestCandidates(allCandidates);
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

      // Filter out true no-op results before ranking so silent failures do not look usable.
      const filteredCandidates = (providerCandidates || []).filter((candidate) => {
        const maskedChange = Number(candidate?.maskedChangeRatio || 0);
        const luminance = Math.abs(Number(candidate?.maskedLuminanceDelta || 0));
        const colorShift = Number(candidate?.maskedColorShiftRatio || 0);

        const isNoOp =
          maskedChange < 0.01 &&
          luminance < 0.01 &&
          colorShift < 0.01;

        return !isNoOp;
      });

      const normalizedCandidates = rankCandidates(
        filteredCandidates.map((candidate, index) => ({
          ...candidate,
          providerKey,
          providerAttemptIndex: attempts.length,
          providerCandidateIndex: index,
          isSufficient: isCandidateSufficient(candidate, preset.key),
        })),
        preset.key,
      );

      if (isSurfaceFinishPreset && normalizedCandidates.length) {
        normalizedCandidates.forEach((candidate) => {
          console.log('Candidate evaluation', {
            presetKey: preset.key,
            providerKey,
            overallScore: Number(candidate.overallScore || 0),
            maskedChangeRatio: Number(candidate.maskedChangeRatio || 0),
            focusRegionChangeRatio: Number(candidate.focusRegionChangeRatio || 0),
            outsideMaskChangeRatio: Number(candidate.outsideMaskChangeRatio || 0),
            maskedColorShiftRatio: Number(candidate.maskedColorShiftRatio || 0),
            maskedLuminanceDelta: Number(candidate.maskedLuminanceDelta || 0),
            maskedEdgeDensityDelta: Number(candidate.maskedEdgeDensityDelta || 0),
            newFurnitureAdditionRatio: Number(candidate.newFurnitureAdditionRatio || 0),
            furnitureCoverageIncreaseRatio: Number(
              candidate.furnitureCoverageIncreaseRatio || 0,
            ),
            isSufficient: Boolean(candidate.isSufficient),
          });
        });
      }

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
      allSufficientCandidates.push(
        ...normalizedCandidates.filter((candidate) => candidate.isSufficient),
      );

      const sufficient = rankCandidates(
        normalizedCandidates.filter((candidate) => candidate.isSufficient),
        preset.key,
      )[0];
      const shouldStopForCurrentCandidate =
        sufficient &&
        (!requiresLocalTileStoneAttempt || providerKey === 'local_sharp') &&
        (!exhaustProviderChain || isHighConfidenceEarlyExitCandidate(sufficient, preset.key));
      if (shouldStopForCurrentCandidate) {
        return buildResponse({
          providerUsed: providerKey,
          bestVariant: sufficient,
          stoppedEarlyReason:
            exhaustProviderChain ? 'high_confidence_candidate' : 'sufficient_candidate',
        });
      }

      const elapsedAfterProvider = Math.max(0, Number(nowFn()) - startedAt);
      if (
        providerIndex < chain.length - 1 &&
        elapsedAfterProvider >= maxExecutionTimeMs &&
        allCandidates.length &&
        canStopForTimeBudget()
      ) {
        const rankedCandidates = selectBestCandidates(allCandidates);
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

  const rankedCandidates = selectBestCandidates(allCandidates);
  const shouldRequireRealFinishCandidate =
    normalizedPresetKey.startsWith('paint_') || normalizedPresetKey.startsWith('floor_');
  const sufficientCandidateExists = allCandidates.some((candidate) => candidate.isSufficient);
  const preferredFinishFallbackExists = getPreferredFinishFallbackCandidates(
    allCandidates,
    preset.key,
  ).length > 0;
  const hasRealChange = allCandidates.some(
    (candidate) =>
      Number(candidate.maskedChangeRatio || 0) > 0.02 ||
      Math.abs(Number(candidate.maskedLuminanceDelta || 0)) > 0.02 ||
      Number(candidate.maskedColorShiftRatio || 0) > 0.02,
  );
  const bestVariant =
    shouldRequireRealFinishCandidate &&
    (!sufficientCandidateExists || !hasRealChange) &&
    !preferredFinishFallbackExists
      ? allowBestEffortFinishCandidate
        ? rankedCandidates[0] || null
        : null
      : rankedCandidates[0] || null;
  const providerUsed = rankedCandidates[0]?.providerKey || null;
  return buildResponse({
    providerUsed: bestVariant ? providerUsed : null,
    bestVariant,
    stoppedEarlyReason:
      shouldRequireRealFinishCandidate &&
      (!sufficientCandidateExists || !hasRealChange) &&
      !preferredFinishFallbackExists
        ? allowBestEffortFinishCandidate
          ? 'best_effort_finish_candidate'
          : 'no_usable_finish_candidate'
        : null,
  });
}
