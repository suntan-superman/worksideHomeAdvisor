import React from 'react';
import { Text, View } from 'react-native';

import {
  PropertyCaptureSection,
  PropertyGallerySection,
  PropertyOverviewSection,
  PropertySectionTabs,
  PropertyTasksSection,
} from './rootScreenPropertySections.js';
import { PropertyVisionSection } from './rootScreenVisionSection.js';
import { styles } from './rootScreen.styles';

export function RootScreenPropertyWorkspaceContent({
  workflow,
  viewerRole,
  propertySection,
  setPropertySection,
  recommendedSection,
  dashboard,
  capturedRoomCount,
  gallery,
  mediaVariants,
  checklistItems,
  openChecklistItems,
  pricingHighlights,
  nextMissingRoom,
  roomCoverage,
  form,
  updateField,
  handlePickImage,
  photoAsset,
  handleSavePhoto,
  busy,
  selectedAsset,
  setSelectedAssetId,
  handleToggleListingCandidate,
  listingNoteDraft,
  setListingNoteDraft,
  handleSaveListingNote,
  showVisionDetails,
  setShowVisionDetails,
  createVariantMutationIsPending,
  pendingVisionJobType,
  visionActionRecommendation,
  recommendedVisionAction,
  recommendedDeclutterPresetKey,
  isDeclutterRecommended,
  isLightingRecommended,
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
  setSelectedVariantId,
  handleSaveCurrentVariantToPhotos,
  handleSelectVariant,
  bestCandidates,
  checklist,
  completedChecklistItems,
  showCompletedTasks,
  setShowCompletedTasks,
  handleUpdateChecklistStatus,
  customTaskTitle,
  setCustomTaskTitle,
  handleCreateCustomTask,
}) {
  return (
    <>
      {workflow ? (
        <View style={styles.workflowGuideCard}>
          <Text style={styles.label}>Your progress</Text>
          <Text style={styles.taskSummaryValue}>{workflow.completionPercent}% complete</Text>
          <Text style={styles.taskSummaryText}>
            {workflow.currentPhaseLabel} · {viewerRole === 'agent' ? 'Realtor guide' : 'Seller guide'}
          </Text>
          <Text style={styles.taskSummaryText}>Market-ready {workflow.marketReadyScore}/100</Text>
          <View style={styles.summaryBulletList}>
            <Text style={styles.summaryBullet}>
              {workflow.metrics?.listingCandidateCount || 0} marketplace-ready photo
              {(workflow.metrics?.listingCandidateCount || 0) === 1 ? '' : 's'}
            </Text>
            <Text style={styles.summaryBullet}>
              {workflow.metrics?.publishableVisionCount || 0} publishable Vision save
              {(workflow.metrics?.publishableVisionCount || 0) === 1 ? '' : 's'}
            </Text>
            <Text style={styles.summaryBullet}>
              {workflow.metrics?.reviewDraftCount || 0} review draft
              {(workflow.metrics?.reviewDraftCount || 0) === 1 ? '' : 's'}
            </Text>
          </View>
          {workflow.nextStep ? (
            <View style={styles.workflowNextCard}>
              <Text style={styles.workflowNextLabel}>Next step</Text>
              <Text style={styles.taskTitle}>{workflow.nextStep.title}</Text>
              <Text style={styles.taskDetail}>{workflow.nextStep.description}</Text>
              {workflow.nextStep.helperText ? (
                <Text style={styles.workflowHelperText}>{workflow.nextStep.helperText}</Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.workflowPhaseRow}>
            {(workflow.phases || []).map((phase) => (
              <View
                key={phase.key}
                style={[
                  styles.workflowPhaseChip,
                  phase.status === 'complete'
                    ? styles.workflowPhaseChipComplete
                    : phase.status === 'in_progress'
                      ? styles.workflowPhaseChipActive
                      : null,
                ]}
              >
                <Text style={styles.workflowPhaseChipLabel}>{phase.label}</Text>
                <Text style={styles.workflowPhaseChipMeta}>
                  {phase.completedSteps}/{phase.totalSteps}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <PropertySectionTabs
        propertySection={propertySection}
        setPropertySection={setPropertySection}
        recommendedSection={recommendedSection}
        dashboard={dashboard}
        capturedRoomCount={capturedRoomCount}
        gallery={gallery}
        mediaVariants={mediaVariants}
        checklistItems={checklistItems}
        openChecklistItems={openChecklistItems}
      />

      {propertySection === 'overview' ? (
        <PropertyOverviewSection dashboard={dashboard} pricingHighlights={pricingHighlights} />
      ) : null}

      {propertySection === 'capture' ? (
        <PropertyCaptureSection
          workflow={workflow}
          capturedRoomCount={capturedRoomCount}
          nextMissingRoom={nextMissingRoom}
          roomCoverage={roomCoverage}
          form={form}
          updateField={updateField}
          handlePickImage={handlePickImage}
          photoAsset={photoAsset}
          handleSavePhoto={handleSavePhoto}
          busy={busy}
        />
      ) : null}

      {propertySection === 'gallery' ? (
        <PropertyGallerySection
          gallery={gallery}
          selectedAsset={selectedAsset}
          setSelectedAssetId={setSelectedAssetId}
          handleToggleListingCandidate={handleToggleListingCandidate}
          busy={busy}
          listingNoteDraft={listingNoteDraft}
          setListingNoteDraft={setListingNoteDraft}
          handleSaveListingNote={handleSaveListingNote}
        />
      ) : null}

      {propertySection === 'vision' ? (
        <PropertyVisionSection
          showVisionDetails={showVisionDetails}
          setShowVisionDetails={setShowVisionDetails}
          roomCoverage={roomCoverage}
          selectedAsset={selectedAsset}
          createVariantMutationIsPending={createVariantMutationIsPending}
          pendingVisionJobType={pendingVisionJobType}
          visionActionRecommendation={visionActionRecommendation}
          recommendedVisionAction={recommendedVisionAction}
          recommendedDeclutterPresetKey={recommendedDeclutterPresetKey}
          isDeclutterRecommended={isDeclutterRecommended}
          isLightingRecommended={isLightingRecommended}
          busy={busy}
          handleGenerateVariant={handleGenerateVariant}
          freeformEnhancementInstructions={freeformEnhancementInstructions}
          setFreeformEnhancementInstructions={setFreeformEnhancementInstructions}
          handleGenerateFreeformVariant={handleGenerateFreeformVariant}
          selectedVariant={selectedVariant}
          visibleVisionEffects={visibleVisionEffects}
          hiddenVisionEffectCount={hiddenVisionEffectCount}
          currentVisionPipelinePackage={currentVisionPipelinePackage}
          savedAssetForSelectedVariant={savedAssetForSelectedVariant}
          currentVisionSaveDefaults={currentVisionSaveDefaults}
          mediaVariants={mediaVariants}
          setSelectedVariantId={setSelectedVariantId}
          handleSaveCurrentVariantToPhotos={handleSaveCurrentVariantToPhotos}
          setSelectedAssetId={setSelectedAssetId}
          setPropertySection={setPropertySection}
          handleSelectVariant={handleSelectVariant}
          bestCandidates={bestCandidates}
        />
      ) : null}

      {propertySection === 'tasks' ? (
        <PropertyTasksSection
          checklist={checklist}
          checklistItems={checklistItems}
          openChecklistItems={openChecklistItems}
          completedChecklistItems={completedChecklistItems}
          showCompletedTasks={showCompletedTasks}
          setShowCompletedTasks={setShowCompletedTasks}
          handleUpdateChecklistStatus={handleUpdateChecklistStatus}
          busy={busy}
          customTaskTitle={customTaskTitle}
          setCustomTaskTitle={setCustomTaskTitle}
          handleCreateCustomTask={handleCreateCustomTask}
        />
      ) : null}
    </>
  );
}
