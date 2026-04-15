import {
  buildProviderChain,
  calculatePerceptibilityScore,
  evaluatePaintStrength,
  getPreferredFinishFallbackCandidates,
  getVisionExecutionTimeBudgetMs,
  isHighConfidenceEarlyExitCandidate,
  isCandidateSufficient,
  PAINT_STRENGTH_MIN_ACCEPTABLE_SCORE,
  PAINT_STRENGTH_MIN_COLOR_SHIFT,
  PAINT_STRENGTH_MIN_LUMINANCE_DELTA,
  PAINT_STRENGTH_MIN_PERCEPTIBILITY,
  rankCandidates,
  resolveVisionUserPlan,
} from './vision-orchestrator.helpers.js';

const MAX_PAINT_RETRIES = 3;
const PAINT_STRENGTH_RETRY_APPENDIX =
  'Apply a clearly visible, uniform coat of paint to all wall surfaces. The color must be noticeably different from the original. Do not preserve original wall tones or accept subtle drift. Maintain clean edges around windows, trim, ceilings, and built-ins.';

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
  const normalizedPresetKey = String(preset?.key || '');
  const chain = buildProviderChain({
    preset,
    userPlan: effectiveUserPlan,
    openAiAvailable,
  });
  const isSurfaceFinishPreset =
    normalizedPresetKey.startsWith('paint_') || normalizedPresetKey.startsWith('floor_');
  const isPaintPreset = normalizedPresetKey.startsWith('paint_');
  const isFloorPreset = normalizedPresetKey.startsWith('floor_');
  const exhaustProviderChain =
    normalizedPresetKey === 'remove_furniture' || isSurfaceFinishPreset;
  const requiresLocalTileStoneAttempt = normalizedPresetKey === 'floor_tile_stone';
  const allowBestEffortFinishCandidate = normalizedPresetKey.startsWith('floor_');
  const startedAt = Number(nowFn());
  const maxExecutionTimeMs = getVisionExecutionTimeBudgetMs(preset?.key);
  const attempts = [];
  const allCandidates = [];
  const allSufficientCandidates = [];
  const maxAdaptiveIterations = isPaintPreset ? MAX_PAINT_RETRIES + 1 : 1;
  let activePreset = { ...preset };
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

  const isStrongEnoughFinishCandidate = (candidate) => {
    if (!candidate) {
      return false;
    }

    if (isPaintPreset) {
      const paintStrength = evaluatePaintStrength(candidate);
      return (
        Number(candidate.maskedChangeRatio || 0) >= 0.12 &&
        Number(candidate.maskedColorShiftRatio || 0) >= PAINT_STRENGTH_MIN_COLOR_SHIFT &&
        Math.abs(Number(candidate.maskedLuminanceDelta || 0)) >=
          PAINT_STRENGTH_MIN_LUMINANCE_DELTA &&
        Number(candidate.newFurnitureAdditionRatio || 0) <= 0.01 &&
        paintStrength.perceptibilityScore >= PAINT_STRENGTH_MIN_PERCEPTIBILITY &&
        paintStrength.passes
      );
    }

    if (isFloorPreset) {
      return (
        Number(candidate.focusRegionChangeRatio || 0) >= 0.12 &&
        Number(candidate.maskedChangeRatio || 0) >= 0.14
      );
    }

    return Boolean(candidate.isSufficient);
  };

  const diagnoseFinishFailure = (candidates = []) => {
    const best = rankCandidates(candidates, normalizedPresetKey)[0];
    if (!best) {
      return { shouldRetry: false };
    }

    if (isPaintPreset) {
      const paintStrength = evaluatePaintStrength(best);
      if (
        Number(best.newFurnitureAdditionRatio || 0) > 0.01 ||
        Number(best.maskedEdgeDensityDelta || 0) > 0.01 ||
        Number(best.topHalfChangeRatio || 0) > 0.08 ||
        Number(best.outsideMaskChangeRatio || 0) > 0.12
      ) {
        return { shouldRetry: true, type: 'hallucination', action: 'tighten_negative_prompt', best };
      }
      if (Number(best.maskedChangeRatio || 0) < 0.08) {
        return { shouldRetry: true, type: 'too_subtle', action: 'increase_strength', best };
      }
      if (Number(best.maskedColorShiftRatio || 0) < PAINT_STRENGTH_MIN_COLOR_SHIFT) {
        return { shouldRetry: true, type: 'color_not_distinct', action: 'increase_color_shift', best };
      }
      if (
        Math.abs(Number(best.maskedLuminanceDelta || 0)) <
        PAINT_STRENGTH_MIN_LUMINANCE_DELTA
      ) {
        return { shouldRetry: true, type: 'not_bright_enough', action: 'increase_brightness', best };
      }
      if (paintStrength.perceptibilityScore < PAINT_STRENGTH_MIN_PERCEPTIBILITY) {
        return { shouldRetry: true, type: 'low_perceptibility', action: 'increase_strength', best };
      }
      if (paintStrength.finalScore < PAINT_STRENGTH_MIN_ACCEPTABLE_SCORE) {
        return { shouldRetry: true, type: 'score_too_low', action: 'increase_strength', best };
      }
    }

    if (isFloorPreset) {
      if (Number(best.focusRegionChangeRatio || 0) < 0.08) {
        return { shouldRetry: true, type: 'floor_not_changed', action: 'increase_strength', best };
      }
      if (Number(best.maskedEdgeDensityDelta || 0) < 0.005) {
        return { shouldRetry: true, type: 'no_texture', action: 'increase_detail', best };
      }
    }

    return { shouldRetry: false, best };
  };

  const applyAdaptiveAdjustment = (currentPreset, adjustment, iteration) => {
    if (!adjustment?.shouldRetry) {
      return currentPreset;
    }

    const updatedPreset = {
      ...currentPreset,
      intensity:
        adjustment.action === 'increase_color_shift' ||
        adjustment.action === 'increase_brightness'
          ? 'very strong'
          : 'strong',
      strength: Number(
        Math.min(0.99, Number(currentPreset.strength || 0.7) + 0.08).toFixed(2),
      ),
      guidanceScale: Number(
        Math.min(10, Number(currentPreset.guidanceScale || 7.5) + 0.75).toFixed(2),
      ),
      numInferenceSteps: Math.min(76, Number(currentPreset.numInferenceSteps || 35) + 8),
    };

    if (!String(updatedPreset.basePrompt || '').includes(PAINT_STRENGTH_RETRY_APPENDIX)) {
      updatedPreset.basePrompt =
        `${currentPreset.basePrompt} ${PAINT_STRENGTH_RETRY_APPENDIX}`.trim();
    }

    if (adjustment.action === 'increase_brightness') {
      updatedPreset.basePrompt =
        `${updatedPreset.basePrompt} Make the repaint clearly brighter and more visible without touching windows or trim.`.trim();
    }

    if (adjustment.action === 'increase_color_shift') {
      updatedPreset.basePrompt =
        `${updatedPreset.basePrompt} The wall color difference must be immediately noticeable at first glance.`.trim();
    }

    if (adjustment.action === 'tighten_negative_prompt') {
      updatedPreset.negativePrompt = `${currentPreset.negativePrompt}, added furniture, decor, fixtures, radiator, heater, vent cover, framed art, picture frames, wall sconces`;
    }

    console.log('vision_finish_iteration_adjustment', {
      presetKey: currentPreset.key,
      iteration,
      failureType: adjustment.type,
      action: adjustment.action,
      previousScore: adjustment.best
        ? {
            maskedChangeRatio: Number(adjustment.best.maskedChangeRatio || 0),
            maskedColorShiftRatio: Number(adjustment.best.maskedColorShiftRatio || 0),
            maskedLuminanceDelta: Number(adjustment.best.maskedLuminanceDelta || 0),
            newFurnitureAdditionRatio: Number(adjustment.best.newFurnitureAdditionRatio || 0),
            perceptibilityScore: calculatePerceptibilityScore(adjustment.best),
            paintStrength: evaluatePaintStrength(adjustment.best),
          }
        : null,
      nextSettings: {
        intensity: updatedPreset.intensity,
        strength: updatedPreset.strength,
        guidanceScale: updatedPreset.guidanceScale,
        numInferenceSteps: updatedPreset.numInferenceSteps,
      },
    });

    return updatedPreset;
  };

  for (let iteration = 0; iteration < maxAdaptiveIterations; iteration += 1) {
    const iterationCandidates = [];

    for (const [providerIndex, providerKey] of chain.entries()) {
      const elapsedBeforeProvider = Math.max(0, Number(nowFn()) - startedAt);
      if (
        elapsedBeforeProvider >= maxExecutionTimeMs &&
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

      try {
        let providerCandidates = [];

        if (providerKey === 'local_sharp') {
          providerCandidates = await providerRunners.runLocalSharp?.({
            asset,
            preset: activePreset,
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
            preset: activePreset,
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
            preset: activePreset,
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

        const filteredCandidates =
          isFloorPreset || isPaintPreset
            ? [...(providerCandidates || [])]
            : (providerCandidates || []).filter((candidate) => {
                const maskedChange = Number(candidate?.maskedChangeRatio || 0);
                const luminance = Math.abs(Number(candidate?.maskedLuminanceDelta || 0));
                const colorShift = Number(candidate?.maskedColorShiftRatio || 0);

                const isNoOp =
                  maskedChange < 0.01 && luminance < 0.01 && colorShift < 0.01;

                return !isNoOp;
              });

        if (isSurfaceFinishPreset) {
          console.log('Provider raw vs filtered', {
            presetKey: activePreset?.key,
            providerKey,
            iteration,
            rawCount: (providerCandidates || []).length,
            filteredCount: filteredCandidates.length,
          });
        }

        const normalizedCandidates = rankCandidates(
          filteredCandidates.map((candidate, index) => {
            const paintStrength = isPaintPreset ? evaluatePaintStrength(candidate) : null;

            return {
              ...candidate,
              providerKey,
              providerAttemptIndex: attempts.length,
              providerCandidateIndex: index,
              paintStrength,
              isSufficient: isCandidateSufficient(candidate, activePreset.key),
            };
          }),
          activePreset.key,
        );

        if (isSurfaceFinishPreset && normalizedCandidates.length) {
          normalizedCandidates.forEach((candidate) => {
            const paintStrength = isPaintPreset
              ? candidate.paintStrength || evaluatePaintStrength(candidate)
              : null;
            console.log('Candidate evaluation', {
              presetKey: activePreset.key,
              providerKey,
              iteration,
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
              perceptibilityScore: calculatePerceptibilityScore(candidate),
              paintStrengthFinalScore: paintStrength?.finalScore ?? null,
              paintStrengthPenaltyCount: paintStrength?.penalties ?? null,
              isSufficient: Boolean(candidate.isSufficient),
            });

            if (paintStrength) {
              console.log('Paint Strength Check', {
                presetKey: activePreset.key,
                providerKey,
                iteration,
                maskedColorShiftRatio: paintStrength.maskedColorShiftRatio,
                maskedLuminanceDelta: paintStrength.maskedLuminanceDelta,
                perceptibilityScore: paintStrength.perceptibilityScore,
                penalties: paintStrength.penalties,
                baselineScore: paintStrength.baselineScore,
                finalScore: paintStrength.finalScore,
                passes: paintStrength.passes,
              });
            }
          });
        }

        attempts.push({
          providerKey,
          iteration,
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

        iterationCandidates.push(...normalizedCandidates);
        allCandidates.push(...normalizedCandidates);
        allSufficientCandidates.push(
          ...normalizedCandidates.filter((candidate) => candidate.isSufficient),
        );

        const sufficient = rankCandidates(
          normalizedCandidates.filter((candidate) => candidate.isSufficient),
          activePreset.key,
        )[0];
        const shouldStopForCurrentCandidate =
          sufficient &&
          (!requiresLocalTileStoneAttempt || providerKey === 'local_sharp') &&
          (!exhaustProviderChain ||
            isHighConfidenceEarlyExitCandidate(sufficient, activePreset.key));
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
        if (isSurfaceFinishPreset) {
          console.log('Surface finish provider failure', {
            presetKey: activePreset?.key,
            providerKey,
            iteration,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        attempts.push({
          providerKey,
          iteration,
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

    if (!isPaintPreset || iteration >= maxAdaptiveIterations - 1) {
      break;
    }

    const bestCurrentIterationCandidate = selectBestCandidates(iterationCandidates)[0];
    if (isStrongEnoughFinishCandidate(bestCurrentIterationCandidate)) {
      break;
    }

    const adjustment = diagnoseFinishFailure(iterationCandidates);
    if (!adjustment.shouldRetry) {
      break;
    }

    activePreset = applyAdaptiveAdjustment(activePreset, adjustment, iteration + 1);
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
        ? rankedCandidates[0] || allCandidates[0] || null
        : null
      : rankedCandidates[0] || allCandidates[0] || null;
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
