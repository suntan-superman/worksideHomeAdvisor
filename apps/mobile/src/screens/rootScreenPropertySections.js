import React from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  ROOM_LABEL_OPTIONS,
  formatChecklistStatus,
  formatCreatedAt,
  formatCurrency,
  getNextChecklistStatus,
} from './rootScreen.helpers.js';
import { styles } from './rootScreen.styles.js';

const PROPERTY_SECTION_OPTIONS = [
  ['overview', 'Overview'],
  ['capture', 'Capture'],
  ['gallery', 'Gallery'],
  ['vision', 'Vision'],
  ['tasks', 'Tasks'],
];

export function PropertySectionTabs({
  propertySection,
  setPropertySection,
  recommendedSection,
  dashboard,
  capturedRoomCount,
  gallery,
  mediaVariants,
  checklistItems,
  openChecklistItems,
}) {
  return (
    <View style={styles.sectionChipRow}>
      {PROPERTY_SECTION_OPTIONS.map(([value, label]) => (
        <Pressable
          key={value}
          onPress={() => setPropertySection(value)}
          style={[
            styles.sectionChip,
            value !== propertySection && value === recommendedSection ? styles.sectionChipRecommended : null,
            value !== propertySection &&
            ((value === 'overview' && Boolean(dashboard?.pricing)) ||
              (value === 'capture' && capturedRoomCount >= ROOM_LABEL_OPTIONS.length) ||
              (value === 'gallery' && gallery.length > 0) ||
              (value === 'vision' &&
                (mediaVariants.some((variant) => variant.isSelected) ||
                  gallery.some((asset) => Boolean(asset.selectedVariant)))) ||
              (value === 'tasks' && checklistItems.length > 0 && openChecklistItems.length === 0))
              ? styles.sectionChipComplete
              : null,
            value === propertySection ? styles.sectionChipActive : null,
          ]}
        >
          <Text
            style={
              propertySection === value
                ? styles.sectionChipLabelActive
                : value === recommendedSection
                  ? styles.sectionChipLabelRecommended
                  : styles.sectionChipLabel
            }
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function PropertyOverviewSection({ dashboard, pricingHighlights }) {
  if (!dashboard?.pricing && !pricingHighlights.length) {
    return null;
  }

  return (
    <>
      {dashboard?.pricing ? (
        <View style={styles.pricingCard}>
          <Text style={styles.label}>Recommended price band</Text>
          <Text style={styles.priceBand}>
            {formatCurrency(dashboard.pricing.low)} to {formatCurrency(dashboard.pricing.high)}
          </Text>
          <View style={styles.summaryBulletList}>
            <Text style={styles.summaryBullet}>
              Midpoint {formatCurrency(dashboard.pricing.mid)} with{' '}
              {Math.round((dashboard.pricing.confidence || 0) * 100)}% confidence.
            </Text>
            <Text style={styles.summaryBullet}>
              Chosen price stays aligned with your marketing brochure and seller report.
            </Text>
          </View>
        </View>
      ) : null}

      {pricingHighlights.length ? (
        <View style={styles.overviewInsightCard}>
          <Text style={styles.label}>Latest analysis</Text>
          {pricingHighlights.map((highlight) => (
            <Text key={highlight} style={styles.summaryBullet}>
              {`\u2022 ${highlight}`}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );
}

export function PropertyCaptureSection({
  workflow,
  capturedRoomCount,
  nextMissingRoom,
  roomCoverage,
  form,
  updateField,
  handlePickImage,
  photoAsset,
  handleSavePhoto,
  busy,
}) {
  return (
    <View style={styles.captureCard}>
      <Text style={styles.label}>Photo capture</Text>
      <Text style={styles.body}>
        {workflow?.nextStep?.key === 'capture_photos'
          ? workflow.nextStep.description
          : 'Capture or select the next room photo and save it to this property.'}
      </Text>
      <View style={styles.taskSummaryCard}>
        <Text style={styles.taskSummaryText}>
          {capturedRoomCount} of {ROOM_LABEL_OPTIONS.length} core rooms complete
        </Text>
        <Text style={styles.taskSummaryText}>
          Next focus: {nextMissingRoom}.{' '}
          {workflow?.nextStep?.helperText || 'Stand in the corner. Keep the camera level.'}
        </Text>
      </View>

      <View style={styles.roomChipRow}>
        {ROOM_LABEL_OPTIONS.map((room) => (
          <Pressable
            key={room}
            onPress={() => updateField('roomLabel', room)}
            style={[
              styles.roomChip,
              room === nextMissingRoom && !roomCoverage.find((item) => item.roomLabel === room)?.captured
                ? styles.roomChipRecommended
                : null,
              roomCoverage.find((item) => item.roomLabel === room)?.captured
                ? styles.roomChipDone
                : null,
              form.roomLabel === room ? styles.roomChipActive : null,
            ]}
          >
            <Text
              style={
                form.roomLabel === room
                  ? styles.roomChipLabelActive
                  : roomCoverage.find((item) => item.roomLabel === room)?.captured
                    ? styles.roomChipLabelDone
                    : styles.roomChipLabel
              }
            >
              {room}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => handlePickImage('camera')}
          style={[styles.button, styles.buttonPrimary, styles.flexButton]}
        >
          <Text style={styles.buttonText}>Use camera</Text>
        </Pressable>
        <Pressable
          onPress={() => handlePickImage('library')}
          style={[styles.button, styles.buttonSecondary, styles.flexButton]}
        >
          <Text style={styles.buttonSecondaryText}>Choose from library</Text>
        </Pressable>
      </View>

      {photoAsset ? (
        <View style={styles.photoPreviewCard}>
          <Image source={{ uri: photoAsset.uri }} style={styles.photoPreview} />
          <Text style={styles.body}>
            Ready to save as {form.roomLabel.toLowerCase()} for this property.
          </Text>
          <Pressable
            onPress={handleSavePhoto}
            style={[styles.button, busy ? styles.buttonDisabled : styles.buttonPrimary]}
            disabled={busy}
          >
            <Text style={styles.buttonText}>Save photo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function PropertyGallerySection({
  gallery,
  selectedAsset,
  setSelectedAssetId,
  handleToggleListingCandidate,
  busy,
  listingNoteDraft,
  setListingNoteDraft,
  handleSaveListingNote,
}) {
  return (
    <View style={styles.galleryCard}>
      <Text style={styles.label}>Saved photo gallery</Text>
      <Text style={styles.body}>
        Saved photos stay attached to this property and can feed later flyer and vision workflows.
      </Text>

      {gallery.length ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRail}>
            {gallery.map((asset) => (
              <Pressable
                key={asset.id}
                onPress={() => setSelectedAssetId(asset.id)}
                style={[styles.galleryTile, asset.id === selectedAsset?.id ? styles.galleryTileActive : null]}
              >
                <Image source={{ uri: asset.imageUrl }} style={styles.galleryTileImage} />
                <Text style={styles.galleryTileLabel} numberOfLines={1}>
                  {asset.roomLabel}
                </Text>
                {asset.selectedVariant ? (
                  <Text style={styles.galleryTileTag} numberOfLines={1}>
                    {asset.selectedVariant.label || 'Vision preferred'}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          {selectedAsset ? (
            <View style={styles.selectedAssetCard}>
              <Image source={{ uri: selectedAsset.imageUrl }} style={styles.selectedAssetImage} />
              <Text style={styles.selectedAssetTitle}>{selectedAsset.roomLabel}</Text>
              <Text style={styles.selectedAssetMeta}>
                Saved {formatCreatedAt(selectedAsset.createdAt) || 'recently'}
                {selectedAsset.analysis?.roomGuess
                  ? ` · AI sees ${selectedAsset.analysis.roomGuess.toLowerCase()}`
                  : ''}
              </Text>
              {selectedAsset.analysis?.summary ? (
                <Text style={styles.body}>{selectedAsset.analysis.summary}</Text>
              ) : null}
              {typeof selectedAsset.analysis?.overallQualityScore === 'number' ? (
                <Text style={styles.assetScore}>
                  Quality score {selectedAsset.analysis.overallQualityScore}/100
                  {selectedAsset.analysis?.retakeRecommended ? ' · Retake suggested' : ''}
                </Text>
              ) : null}
              {selectedAsset.listingCandidate ? (
                <Text style={styles.listingCandidateTag}>Listing candidate selected</Text>
              ) : null}
              {selectedAsset.selectedVariant ? (
                <Text style={styles.preferredVariantTag}>
                  Preferred vision variant: {selectedAsset.selectedVariant.label || 'Vision-ready version'}
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                <Pressable
                  onPress={handleToggleListingCandidate}
                  style={[
                    styles.button,
                    selectedAsset.listingCandidate ? styles.buttonSecondary : styles.buttonPrimary,
                    styles.flexButton,
                  ]}
                  disabled={busy}
                >
                  <Text
                    style={
                      selectedAsset.listingCandidate
                        ? styles.buttonSecondaryText
                        : styles.buttonText
                    }
                  >
                    {selectedAsset.listingCandidate ? 'Remove candidate' : 'Mark candidate'}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                placeholder="Add a listing note for this photo"
                placeholderTextColor="#7d8a8f"
                style={[styles.input, styles.noteInput]}
                value={listingNoteDraft}
                onChangeText={setListingNoteDraft}
                multiline
              />
              <Pressable
                onPress={handleSaveListingNote}
                style={[styles.button, styles.buttonSecondary]}
                disabled={busy}
              >
                <Text style={styles.buttonSecondaryText}>Save note</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.body}>No saved photos yet for this property.</Text>
      )}
    </View>
  );
}

export function PropertyTasksSection({
  checklist,
  checklistItems,
  openChecklistItems,
  completedChecklistItems,
  showCompletedTasks,
  setShowCompletedTasks,
  handleUpdateChecklistStatus,
  busy,
  customTaskTitle,
  setCustomTaskTitle,
  handleCreateCustomTask,
}) {
  return (
    <View style={styles.sectionPanel}>
      <Text style={styles.label}>Tasks</Text>
      <Text style={styles.body}>Shared seller checklist progress now syncs with the web workspace and report.</Text>
      <View style={styles.taskSummaryCard}>
        <Text style={styles.taskSummaryValue}>{checklist?.summary?.progressPercent ?? 0}% ready</Text>
        <Text style={styles.taskSummaryText}>
          {checklist?.summary?.completedCount ?? 0} completed · {checklist?.summary?.openCount ?? 0} open
        </Text>
        <Text style={styles.taskSummaryText}>Next: {checklist?.nextTask?.title || 'No open tasks right now'}</Text>
      </View>
      <View style={styles.taskList}>
        {openChecklistItems.length ? (
          openChecklistItems.map((task) => (
            <View
              key={task.id}
              style={[styles.taskCard, task.status === 'in_progress' ? styles.taskCardWorking : null]}
            >
              <View style={styles.taskMetaRow}>
                <Text
                  style={
                    task.status === 'done'
                      ? styles.taskDone
                      : task.status === 'in_progress'
                        ? styles.taskWorking
                        : styles.taskOpen
                  }
                >
                  {formatChecklistStatus(task.status)}
                </Text>
                <Text style={styles.taskCategory}>{String(task.category || 'custom').replace(/_/g, ' ')}</Text>
              </View>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskDetail}>{task.detail}</Text>
              <Pressable
                onPress={() => handleUpdateChecklistStatus(task.id, getNextChecklistStatus(task.status))}
                style={[styles.button, styles.buttonSecondary, styles.taskStatusButton]}
                disabled={busy}
              >
                <Text style={styles.buttonSecondaryText}>
                  {task.status === 'todo'
                    ? 'Start task'
                    : task.status === 'in_progress'
                      ? 'Mark done'
                      : 'Reopen task'}
                </Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.body}>
            {checklistItems.length
              ? 'All current checklist items are complete.'
              : 'No checklist items yet for this property.'}
          </Text>
        )}
      </View>
      {completedChecklistItems.length ? (
        <View style={styles.completedTasksCard}>
          <Pressable
            onPress={() => setShowCompletedTasks((current) => !current)}
            style={styles.completedTasksToggle}
          >
            <Text style={styles.completedTasksTitle}>Completed tasks ({completedChecklistItems.length})</Text>
            <Text style={styles.completedTasksToggleText}>{showCompletedTasks ? 'Hide' : 'Show'}</Text>
          </Pressable>
          {showCompletedTasks
            ? completedChecklistItems.map((task) => (
                <View key={task.id} style={[styles.taskCard, styles.taskCardComplete]}>
                  <View style={styles.taskMetaRow}>
                    <Text style={styles.taskDone}>{formatChecklistStatus(task.status)}</Text>
                    <Text style={styles.taskCategory}>{String(task.category || 'custom').replace(/_/g, ' ')}</Text>
                  </View>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskDetail}>{task.detail}</Text>
                  <Pressable
                    onPress={() => handleUpdateChecklistStatus(task.id, 'todo')}
                    style={[styles.button, styles.buttonSecondary, styles.taskStatusButton]}
                    disabled={busy}
                  >
                    <Text style={styles.buttonSecondaryText}>Reopen task</Text>
                  </Pressable>
                </View>
              ))
            : null}
        </View>
      ) : null}
      <View style={styles.customTaskComposer}>
        <TextInput
          placeholder="Add a custom seller task"
          placeholderTextColor="#7d8a8f"
          style={[styles.input, styles.customTaskInput]}
          value={customTaskTitle}
          onChangeText={setCustomTaskTitle}
        />
        <Pressable
          onPress={handleCreateCustomTask}
          style={[styles.button, styles.buttonPrimary, styles.customTaskButton]}
          disabled={busy}
        >
          <Text style={styles.buttonText}>Add task</Text>
        </Pressable>
      </View>
    </View>
  );
}
