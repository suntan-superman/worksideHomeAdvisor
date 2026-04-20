import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';

import { getVariantSummary, getVisionJobLabel } from './rootScreen.helpers.js';
import { styles } from './rootScreen.styles.js';

export function PropertyVisionSection({
  showVisionDetails,
  setShowVisionDetails,
  roomCoverage,
  selectedAsset,
  createVariantMutationIsPending,
  pendingVisionJobType,
  visionActionRecommendation,
  recommendedVisionAction,
  recommendedDeclutterPresetKey,
  isDeclutterRecommended,
  isLightingRecommended,
  busy,
  handleGenerateVariant,
  freeformEnhancementInstructions,
  setFreeformEnhancementInstructions,
  handleGenerateFreeformVariant,
  selectedVariant,
  visibleVisionEffects,
  hiddenVisionEffectCount,
  currentVisionPipelinePackage,
  savedAssetForSelectedVariant,
  currentVisionSaveDefaults,
  mediaVariants,
  setSelectedVariantId,
  handleSaveCurrentVariantToPhotos,
  setSelectedAssetId,
  setPropertySection,
  handleSelectVariant,
  bestCandidates,
}) {
  return (
    <View style={styles.sectionPanel}>
      <Text style={styles.label}>Vision</Text>
      <Text style={styles.body}>Run each saved photo through First Impression, Smart Enhancement, and Listing Ready.</Text>
      <Pressable onPress={() => setShowVisionDetails((current) => !current)} style={styles.learnMoreButton}>
        <Text style={styles.learnMoreButtonText}>{showVisionDetails ? 'Hide details' : 'Learn more'}</Text>
      </Pressable>
      {showVisionDetails ? (
        <Text style={styles.body}>
          First Impression is the default starting pass. Smart Enhancement handles clutter, lighting, and targeted cleanup. Listing Ready is the stricter publish-confidence step you run after the baseline looks strong.
        </Text>
      ) : null}
      <View style={styles.coverageList}>
        {roomCoverage.map((item) => (
          <View key={item.roomLabel} style={styles.coverageRow}>
            <Text style={styles.coverageRoom}>{item.roomLabel}</Text>
            <Text style={item.captured ? styles.coverageDone : styles.coverageMissing}>
              {item.captured ? 'Captured' : 'Missing'}
            </Text>
          </View>
        ))}
      </View>
      {selectedAsset ? (
        <View style={styles.visionPanel}>
          <Text style={styles.label}>Selected photo</Text>
          <Image source={{ uri: selectedAsset.imageUrl }} style={styles.visionImage} />
          {selectedAsset.selectedVariant ? (
            <Text style={styles.preferredVariantTag}>
              Materials currently prefer {selectedAsset.selectedVariant.label || 'the saved vision variant'} for this photo.
            </Text>
          ) : null}
          {createVariantMutationIsPending ? (
            <View style={styles.visionJobCard}>
              <View style={styles.visionJobHeader}>
                <ActivityIndicator color="#d28859" />
                <Text style={styles.visionJobTitle}>{getVisionJobLabel(pendingVisionJobType)}</Text>
              </View>
              <Text style={styles.variantHint}>
                Workside is processing this image now. Your updated version will appear below automatically.
              </Text>
            </View>
          ) : null}
          {visionActionRecommendation?.reason ? (
            <View style={styles.summaryBulletList}>
              <Text style={styles.label}>Recommended next step</Text>
              <Text style={styles.summaryBullet}>• {visionActionRecommendation.label}</Text>
              <Text style={styles.summaryBullet}>• {visionActionRecommendation.reason}</Text>
            </View>
          ) : null}
          <View style={[styles.actionRow, styles.visionActionRow]}>
            <Pressable
              onPress={() => handleGenerateVariant('enhance_listing_quality')}
              style={[
                styles.button,
                recommendedVisionAction === 'enhance_listing_quality' ? styles.buttonPrimary : styles.buttonSecondary,
                styles.flexButton,
                styles.visionActionButton,
              ]}
              disabled={busy}
            >
              <Text
                style={[
                  recommendedVisionAction === 'enhance_listing_quality' ? styles.buttonText : styles.buttonSecondaryText,
                  styles.visionActionButtonText,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {pendingVisionJobType === 'enhance_listing_quality' && createVariantMutationIsPending
                  ? 'Running...'
                  : 'First Impression'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleGenerateVariant('combined_listing_refresh')}
              style={[
                styles.button,
                recommendedVisionAction === 'combined_listing_refresh' ? styles.buttonPrimary : styles.buttonSecondary,
                styles.flexButton,
                styles.visionActionButton,
              ]}
              disabled={busy}
            >
              <Text
                style={[
                  recommendedVisionAction === 'combined_listing_refresh' ? styles.buttonText : styles.buttonSecondaryText,
                  styles.visionActionButtonText,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {pendingVisionJobType === 'combined_listing_refresh' && createVariantMutationIsPending
                  ? 'Running...'
                  : 'Listing Ready'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleGenerateVariant(recommendedDeclutterPresetKey)}
              style={[
                styles.button,
                isDeclutterRecommended ? styles.buttonPrimary : styles.buttonSecondary,
                styles.flexButton,
                styles.visionActionButton,
              ]}
              disabled={busy}
            >
              <Text
                style={[
                  isDeclutterRecommended ? styles.buttonText : styles.buttonSecondaryText,
                  styles.visionActionButtonText,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {(pendingVisionJobType === 'declutter_light' ||
                  pendingVisionJobType === 'declutter_medium' ||
                  pendingVisionJobType === 'declutter_preview') &&
                createVariantMutationIsPending
                  ? 'Running...'
                  : recommendedDeclutterPresetKey === 'declutter_medium'
                    ? 'Smart Declutter+'
                    : 'Smart Declutter'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleGenerateVariant('lighting_boost')}
              style={[
                styles.button,
                isLightingRecommended ? styles.buttonPrimary : styles.buttonSecondary,
                styles.flexButton,
                styles.visionActionButton,
              ]}
              disabled={busy}
            >
              <Text
                style={[
                  isLightingRecommended ? styles.buttonText : styles.buttonSecondaryText,
                  styles.visionActionButtonText,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {pendingVisionJobType === 'lighting_boost' && createVariantMutationIsPending
                  ? 'Running...'
                  : 'Lighting'}
              </Text>
            </Pressable>
          </View>
          <TextInput
            placeholder="Describe a custom enhancement request"
            placeholderTextColor="#7d8a8f"
            style={[styles.input, styles.noteInput]}
            value={freeformEnhancementInstructions}
            onChangeText={setFreeformEnhancementInstructions}
            multiline
          />
          <Pressable
            onPress={handleGenerateFreeformVariant}
            style={[styles.button, styles.buttonSecondary]}
            disabled={busy || !freeformEnhancementInstructions.trim()}
          >
            <Text style={styles.buttonSecondaryText}>
              {pendingVisionJobType === 'freeform' && createVariantMutationIsPending
                ? 'Generating custom preview...'
                : 'Generate custom Smart Enhancement preview'}
            </Text>
          </Pressable>
          {selectedVariant ? (
            <>
              <Text style={styles.label}>Vision output</Text>
              <Text style={styles.variantSummary}>{getVariantSummary(selectedVariant)}</Text>
              <Image source={{ uri: selectedVariant.imageUrl }} style={styles.visionImage} />
              {visibleVisionEffects.length ? (
                <View style={styles.effectList}>
                  {visibleVisionEffects.map((effect) => (
                    <View key={effect} style={styles.effectChip}>
                      <Text style={styles.effectChipText}>{effect}</Text>
                    </View>
                  ))}
                  {hiddenVisionEffectCount ? (
                    <View style={styles.effectChip}>
                      <Text style={styles.effectChipText}>+{hiddenVisionEffectCount} more</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {selectedVariant.metadata?.differenceHint ? (
                <Text style={styles.variantHint}>{selectedVariant.metadata.differenceHint}</Text>
              ) : null}
              {selectedVariant.metadata?.smartEnhancementPathLabel || selectedVariant.metadata?.smartEnhancementReason ? (
                <View style={styles.summaryBulletList}>
                  <Text style={styles.label}>Execution path</Text>
                  {selectedVariant.metadata?.smartEnhancementPathLabel ? (
                    <Text style={styles.summaryBullet}>• {selectedVariant.metadata.smartEnhancementPathLabel}</Text>
                  ) : null}
                  {selectedVariant.metadata?.smartEnhancementReason ? (
                    <Text style={styles.summaryBullet}>• {selectedVariant.metadata.smartEnhancementReason}</Text>
                  ) : null}
                </View>
              ) : null}
              {selectedVariant.metadata?.confidenceBadge || selectedVariant.metadata?.listingReadyLabel ? (
                <View style={styles.effectList}>
                  {selectedVariant.metadata?.confidenceBadge ? (
                    <View style={styles.effectChip}>
                      <Text style={styles.effectChipText}>{selectedVariant.metadata.confidenceBadge}</Text>
                    </View>
                  ) : null}
                  {selectedVariant.metadata?.listingReadyLabel ? (
                    <View style={styles.effectChip}>
                      <Text style={styles.effectChipText}>{selectedVariant.metadata.listingReadyLabel}</Text>
                    </View>
                  ) : null}
                  {selectedVariant.metadata?.sourceReadinessScore && selectedVariant.metadata?.renderedReadinessScore ? (
                    <View style={styles.effectChip}>
                      <Text style={styles.effectChipText}>
                        {`Readiness ${selectedVariant.metadata.sourceReadinessScore}->${selectedVariant.metadata.renderedReadinessScore}`}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {selectedVariant.metadata?.pipelineDescriptor ? (
                <View style={styles.summaryBulletList}>
                  <Text style={styles.label}>Marketplace status</Text>
                  <Text style={styles.summaryBullet}>
                    • {selectedVariant.metadata.pipelineDescriptor.stageLabel || 'Vision result'} ·{' '}
                    {selectedVariant.metadata.pipelineDescriptor.statusLabel || 'Review pending'}
                  </Text>
                  {selectedVariant.metadata.pipelineDescriptor.reviewMessage ? (
                    <Text style={styles.summaryBullet}>
                      • {selectedVariant.metadata.pipelineDescriptor.reviewMessage}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {currentVisionPipelinePackage ? (
                <View style={styles.summaryBulletList}>
                  <Text style={styles.label}>Pipeline package</Text>
                  <Text style={styles.summaryBullet}>
                    • {currentVisionPipelinePackage.stageLabel} · {currentVisionPipelinePackage.statusLabel}
                  </Text>
                  <Text style={styles.summaryBullet}>• {currentVisionPipelinePackage.reviewMessage}</Text>
                  <Text style={styles.summaryBullet}>• {currentVisionPipelinePackage.deliveryMessage}</Text>
                </View>
              ) : null}
              {selectedVariant.metadata?.improvementsApplied?.length ? (
                <View style={styles.summaryBulletList}>
                  <Text style={styles.label}>Improvements applied</Text>
                  {selectedVariant.metadata.improvementsApplied.map((item) => (
                    <Text key={item} style={styles.summaryBullet}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}
              {selectedVariant.metadata?.recommendations?.length ? (
                <View style={styles.summaryBulletList}>
                  <Text style={styles.label}>Top improvements</Text>
                  {selectedVariant.metadata.recommendations.map((item) => (
                    <Text key={item} style={styles.summaryBullet}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}
              {selectedVariant.metadata?.nextActions?.length ? (
                <View style={styles.summaryBulletList}>
                  <Text style={styles.label}>Next actions</Text>
                  {selectedVariant.metadata.nextActions.map((item) => (
                    <Text key={item} style={styles.summaryBullet}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}
              {selectedVariant.metadata?.warning ? (
                <Text style={styles.body}>{selectedVariant.metadata.warning}</Text>
              ) : null}
              {savedAssetForSelectedVariant ? (
                <Text style={styles.body}>
                  This result is already saved in Photos as{' '}
                  {savedAssetForSelectedVariant.listingCandidate ? 'a listing candidate' : 'a review draft'}.
                </Text>
              ) : (
                <Text style={styles.body}>
                  {currentVisionSaveDefaults.listingCandidate
                    ? 'Saving this result to Photos will also mark it as a listing candidate.'
                    : 'Saving this result to Photos will keep it as a review draft until you promote it later.'}
                </Text>
              )}
              {currentVisionPipelinePackage?.publishable ? (
                <Text style={styles.body}>
                  This result is strong enough to serve as a final listing candidate once you keep it.
                </Text>
              ) : null}
              <View style={styles.variantList}>
                {mediaVariants.map((variant) => (
                  <Pressable
                    key={variant.id}
                    onPress={() => setSelectedVariantId(variant.id)}
                    style={[styles.taskActionChip, variant.id === selectedVariant?.id ? styles.taskActionChipActive : null]}
                  >
                    <Text
                      style={
                        variant.id === selectedVariant?.id
                          ? styles.taskActionChipTextActive
                          : styles.taskActionChipText
                      }
                    >
                      {variant.label}
                      {variant.isSelected ? ' · Preferred' : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {!savedAssetForSelectedVariant ? (
                <Pressable
                  onPress={handleSaveCurrentVariantToPhotos}
                  style={[styles.button, styles.buttonPrimary]}
                  disabled={busy}
                >
                  <Text style={styles.buttonText}>
                    {currentVisionSaveDefaults.listingCandidate
                      ? 'Save as listing photo'
                      : 'Save draft to Photos'}
                  </Text>
                </Pressable>
              ) : null}
              {savedAssetForSelectedVariant ? (
                <Pressable
                  onPress={() => {
                    setSelectedAssetId(savedAssetForSelectedVariant.id);
                    setPropertySection('gallery');
                  }}
                  style={[styles.button, styles.buttonSecondary]}
                  disabled={busy}
                >
                  <Text style={styles.buttonSecondaryText}>View saved photo</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => handleSelectVariant(selectedVariant.id)}
                style={[styles.button, styles.buttonSecondary]}
                disabled={busy || selectedVariant.isSelected}
              >
                <Text style={styles.buttonSecondaryText}>
                  {selectedVariant.isSelected ? 'Preferred variant selected' : 'Use this variant in materials'}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
      <View style={styles.candidateList}>
        {bestCandidates.length ? (
          bestCandidates.map((asset, index) => (
            <View key={asset.id} style={styles.candidateCard}>
              <Text style={styles.candidateRank}>#{index + 1}</Text>
              <View style={styles.candidateCopy}>
                <Text style={styles.candidateTitle}>{asset.roomLabel}</Text>
                <Text style={styles.candidateMeta}>
                  Quality {asset.analysis?.overallQualityScore || 0}/100
                  {asset.analysis?.bestUse ? ` · ${asset.analysis.bestUse}` : ''}
                </Text>
                {asset.listingCandidate ? (
                  <Text style={styles.candidateSelectedTag}>
                    Seller selected{asset.listingNote ? ` · ${asset.listingNote}` : ''}
                  </Text>
                ) : null}
                {asset.selectedVariant ? (
                  <Text style={styles.preferredVariantTag}>
                    {asset.selectedVariant.label || 'Vision preferred for materials'}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.body}>
            Save a few reviewed photos and the strongest listing candidates will show here.
          </Text>
        )}
      </View>
    </View>
  );
}
