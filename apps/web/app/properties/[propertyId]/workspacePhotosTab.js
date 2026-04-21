import {
  getMediaAssetPrimaryLabel,
  getMediaAssetSummary,
} from './workspaceVisionHelpers';

function PhotoLibrarySection({
  group,
  renderCollapsibleSection,
  selectedMediaAssetPhotoCategory,
  firstPopulatedPhotoCategoryKey,
  selectedMediaAsset,
  setSelectedMediaAssetId,
  setActivePhotoDetailsAsset,
  handleToggleListingCandidateForAsset,
  status,
  isArchivedProperty,
  handleOpenPhotoVariations,
}) {
  const isSelectedCategory = selectedMediaAssetPhotoCategory?.key === group.key;
  const defaultOpen = isSelectedCategory || group.key === firstPopulatedPhotoCategoryKey;
  const sellerPickCount = group.assets.filter((asset) => asset.listingCandidate).length;
  const photoCountLabel = `${group.assets.length} photo${group.assets.length === 1 ? '' : 's'}`;
  const sellerPickLabel = `${sellerPickCount} seller pick${sellerPickCount === 1 ? '' : 's'}`;

  return renderCollapsibleSection({
    sectionKey: `photos_room_${group.key}`,
    label: 'Photo category',
    title: group.label,
    meta: `${photoCountLabel} · ${sellerPickLabel}`,
    defaultOpen,
    className: 'content-card workspace-collapsible-section photo-library-section',
    children: group.assets.length ? (
      <div className="photo-room-grid">
        {group.assets.map((asset) => (
          <article
            key={asset.id}
            className={asset.id === selectedMediaAsset?.id ? 'photo-library-card active' : 'photo-library-card'}
          >
            <button
              type="button"
              className="photo-library-card-preview"
              onClick={() => {
                setSelectedMediaAssetId(asset.id);
                setActivePhotoDetailsAsset(asset);
              }}
            >
              <img src={asset.imageUrl} alt={asset.roomLabel || 'Property photo'} />
            </button>
            <div className="photo-library-card-body">
              <div className="photo-card-badge-row">
                <span className="photo-card-status-pill">{getMediaAssetPrimaryLabel(asset)}</span>
                {asset.savedFromVision ? <span className="photo-card-status-pill">Saved from Vision</span> : null}
                <button
                  type="button"
                  className={asset.listingCandidate ? 'photo-card-action-pill active' : 'photo-card-action-pill'}
                  onClick={() => handleToggleListingCandidateForAsset(asset)}
                  disabled={Boolean(status) || isArchivedProperty}
                >
                  {asset.listingCandidate ? 'Seller Pick' : 'Add Seller Pick'}
                </button>
              </div>
              <strong>{asset.roomLabel}</strong>
              <p className="photo-card-summary">{getMediaAssetSummary(asset)}</p>
              <div className="photo-library-card-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => handleOpenPhotoVariations(asset)}
                >
                  Variations
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setSelectedMediaAssetId(asset.id);
                    setActivePhotoDetailsAsset(asset);
                  }}
                >
                  Details
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <p className="workspace-control-note photo-library-empty-state">
        No photos have been added to {group.label.toLowerCase()} yet.
      </p>
    ),
  });
}

export function WorkspacePhotosTab({
  renderCollapsibleSection,
  defaultSectionState,
  mediaAssets,
  handleImportPhotoFiles,
  photoImportSource,
  setPhotoImportSource,
  photoImportRoomLabel,
  setPhotoImportRoomLabel,
  photoImportRoomLabelOptions,
  photoImportNotes,
  setPhotoImportNotes,
  photoImportProgress,
  canAccessVisionWorkspace,
  photoImportSourceOptions,
  photoCategoryGroups,
  selectedMediaAssetPhotoCategory,
  firstPopulatedPhotoCategoryKey,
  selectedMediaAsset,
  setSelectedMediaAssetId,
  setActivePhotoDetailsAsset,
  handleToggleListingCandidateForAsset,
  status,
  isArchivedProperty,
  handleOpenPhotoVariations,
}) {
  const importProgressCopy = photoImportProgress
    ? (() => {
        const total = Math.max(0, Number(photoImportProgress.total || 0));
        const completed = Math.max(0, Number(photoImportProgress.completed || 0));
        const currentIndex = Math.max(1, Number(photoImportProgress.currentIndex || 1));
        const displayIndex = Math.min(total || 1, currentIndex);
        const currentFileName = photoImportProgress.currentFileName
          ? ` ${photoImportProgress.currentFileName}`
          : '';

        if (photoImportProgress.phase === 'refreshing') {
          return `Uploaded ${completed} of ${total} photos. Refreshing the library...`;
        }

        if (photoImportProgress.phase === 'uploading') {
          return `Uploading photo ${displayIndex} of ${total}:${currentFileName}`;
        }

        if (photoImportProgress.phase === 'saved') {
          return `Saved photo ${completed} of ${total}:${currentFileName}`;
        }

        return `Preparing photo ${displayIndex} of ${total}:${currentFileName}`;
      })()
    : '';

  return (
    <div className="workspace-tab-stack">
      {renderCollapsibleSection({
        sectionKey: 'photos_import',
        label: 'Photos',
        title: 'Import photos',
        meta: `${mediaAssets.length} saved`,
        defaultOpen: defaultSectionState.photos_import,
        className: 'content-card workspace-collapsible-section photo-import-section',
        children: (
          <div
            className="workspace-inner-card brochure-control-card photo-import-card-compact"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleImportPhotoFiles(event.dataTransfer?.files);
            }}
          >
            <div className="brochure-control-grid brochure-control-grid-form">
              <label className="workspace-control-field">
                <span>Import source</span>
                <select
                  className="select-input"
                  value={photoImportSource}
                  onChange={(event) => setPhotoImportSource(event.target.value)}
                >
                  {photoImportSourceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-control-field">
                <span>Room label</span>
                <select
                  className="select-input"
                  value={
                    photoImportRoomLabelOptions.includes(photoImportRoomLabel)
                      ? photoImportRoomLabel
                      : 'Other'
                  }
                  onChange={(event) => setPhotoImportRoomLabel(event.target.value)}
                >
                  {photoImportRoomLabelOptions.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-control-field workspace-control-field-full">
                <span>Notes</span>
                <textarea
                  value={photoImportNotes}
                  onChange={(event) => setPhotoImportNotes(event.target.value)}
                  placeholder="Add optional context for imported third-party or web-uploaded photos."
                  maxLength={500}
                />
              </label>
            </div>
            <label className="button-secondary inline-button" style={{ display: 'inline-flex', cursor: 'pointer' }}>
              Upload or drop photos
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(event) => handleImportPhotoFiles(event.target.files)}
              />
            </label>
            {photoImportProgress ? (
              <p className="workspace-control-note" role="status" aria-live="polite">
                {importProgressCopy}
              </p>
            ) : null}
            <p className="workspace-control-note">
              {canAccessVisionWorkspace
                ? 'Drag-and-drop works here too. Import first, then open Vision when you are ready.'
                : 'Drag-and-drop works here too. Vision enhancements unlock after upgrade.'}
            </p>
          </div>
        ),
      })}

      <section className="photo-library-workspace-card">
        {photoCategoryGroups.map((group) => (
          <PhotoLibrarySection
            key={group.key}
            group={group}
            renderCollapsibleSection={renderCollapsibleSection}
            selectedMediaAssetPhotoCategory={selectedMediaAssetPhotoCategory}
            firstPopulatedPhotoCategoryKey={firstPopulatedPhotoCategoryKey}
            selectedMediaAsset={selectedMediaAsset}
            setSelectedMediaAssetId={setSelectedMediaAssetId}
            setActivePhotoDetailsAsset={setActivePhotoDetailsAsset}
            handleToggleListingCandidateForAsset={handleToggleListingCandidateForAsset}
            status={status}
            isArchivedProperty={isArchivedProperty}
            handleOpenPhotoVariations={handleOpenPhotoVariations}
          />
        ))}
      </section>
    </div>
  );
}
